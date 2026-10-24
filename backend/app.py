import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError

from models import Product, Sale, SaleItem, StockMovement, User, db, iso

TZ = ZoneInfo(os.environ.get("APP_TIMEZONE", "Asia/Manila"))


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message, self.status = message, status


def money(value, label):
    try:
        d = Decimal(str(value if value not in (None, "") else 0))
    except InvalidOperation:
        raise ApiError(f"{label} must be a number")
    if not d.is_finite() or d < 0:
        raise ApiError(f"{label} must be a number that is 0 or more")
    return d.quantize(Decimal("0.01"))


def whole(value, label, minimum=0):
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise ApiError(f"{label} must be a whole number")
    if n < minimum:
        raise ApiError(f"{label} must be at least {minimum}")
    return n


# ---------- date ranges (all reporting uses the shop's local timezone) ----------
def period_range(period):
    now = datetime.now(TZ)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        return today, "hour"
    if period == "week":
        return today - timedelta(days=6), "day"
    if period == "month":
        return today - timedelta(days=29), "day"
    if period in ("half", "year"):
        months = 6 if period == "half" else 12
        y, m = now.year, now.month - (months - 1)
        while m <= 0:
            m += 12
            y -= 1
        return today.replace(year=y, month=m, day=1), "month"
    raise ApiError("Unknown period. Use day, week, month, half or year.")


def to_utc_naive(dt):
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def bucket_starts(start, step, now):
    cur = start
    while cur <= now:
        yield cur
        if step == "hour":
            cur += timedelta(hours=1)
        elif step == "day":
            cur += timedelta(days=1)
        else:
            cur = (cur.replace(day=28) + timedelta(days=4)).replace(day=1)


def bucket_key(dt, step):
    return dt.strftime({"hour": "%Y-%m-%d %H", "day": "%Y-%m-%d", "month": "%Y-%m"}[step])


def bucket_label(dt, step):
    if step == "hour":
        return f"{dt.hour % 12 or 12} {'AM' if dt.hour < 12 else 'PM'}"
    return dt.strftime("%b %d" if step == "day" else "%b %Y")


def create_app():
    app = Flask(__name__)
    uri = os.environ.get("DATABASE_URL", "sqlite:///conwi.db")
    # Neon/Render give postgres:// or postgresql://; always use the psycopg 3 driver
    uri = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg://", uri)
    app.config.update(
        SQLALCHEMY_DATABASE_URI=uri,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True, "pool_recycle": 300},
        JWT_SECRET_KEY=os.environ.get("JWT_SECRET_KEY", "dev-only-secret-change-me-please-32chars"),
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(days=7),
    )
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    CORS(app, origins=origins)
    db.init_app(app)
    JWTManager(app)
    with app.app_context():
        db.create_all()

    @app.errorhandler(ApiError)
    def handle_api_error(e):
        db.session.rollback()
        return jsonify(error=e.message), e.status

    @app.errorhandler(404)
    def handle_404(_):
        return jsonify(error="Not found"), 404

    @app.errorhandler(IntegrityError)
    def handle_integrity(_):
        db.session.rollback()
        return jsonify(error="That value already exists (for example, a duplicate SKU)."), 409

    # ---------- auth ----------
    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    @app.get("/api/auth/status")
    def auth_status():
        return jsonify(needs_setup=User.query.count() == 0)

    def token_response(user):
        return jsonify(token=create_access_token(identity=str(user.id)),
                       user={"id": user.id, "username": user.username})

    @app.post("/api/auth/setup")
    def setup():
        if User.query.count() > 0:
            raise ApiError("Setup is already done. Please log in.", 403)
        data = request.get_json(silent=True) or {}
        username, password = (data.get("username") or "").strip(), data.get("password") or ""
        if len(username) < 3 or len(password) < 6:
            raise ApiError("Username needs 3+ characters and password needs 6+ characters")
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return token_response(user)

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        user = User.query.filter_by(username=(data.get("username") or "").strip()).first()
        if not user or not user.check_password(data.get("password") or ""):
            raise ApiError("Wrong username or password", 401)
        return token_response(user)

    @app.get("/api/auth/me")
    @jwt_required()
    def me():
        user = db.get_or_404(User, int(get_jwt_identity()))
        return jsonify(id=user.id, username=user.username)

    # ---------- products ----------
    def apply_product(p, data):
        name = (data.get("name") or "").strip()
        if not name:
            raise ApiError("Product name is required")
        sku = (data.get("sku") or "").strip() or None
        if sku:
            clash = Product.query.filter(Product.sku == sku, Product.id != (p.id or 0)).first()
            if clash:
                raise ApiError(f"SKU {sku} is already used by {clash.name}")
        p.name, p.sku = name, sku
        p.category = (data.get("category") or "").strip()
        p.real_price = money(data.get("real_price"), "Real price")
        p.commission = money(data.get("commission"), "Commission")
        p.price = p.real_price + p.commission
        p.low_stock_at = whole(data.get("low_stock_at", 5) or 0, "Low stock alert")

    @app.get("/api/products")
    @jwt_required()
    def list_products():
        return jsonify([p.to_dict() for p in Product.query.order_by(Product.name).all()])

    @app.post("/api/products")
    @jwt_required()
    def create_product():
        data = request.get_json(silent=True) or {}
        p = Product()
        apply_product(p, data)
        p.stock = whole(data.get("stock") or 0, "Quantity")
        db.session.add(p)
        db.session.flush()
        if p.stock:
            db.session.add(StockMovement(product_id=p.id, product_name=p.name, change=p.stock, reason="initial stock"))
        db.session.commit()
        return jsonify(p.to_dict()), 201

    @app.put("/api/products/<int:pid>")
    @jwt_required()
    def update_product(pid):
        p = db.get_or_404(Product, pid)
        apply_product(p, request.get_json(silent=True) or {})
        db.session.commit()
        return jsonify(p.to_dict())

    @app.post("/api/products/<int:pid>/stock")
    @jwt_required()
    def adjust_stock(pid):
        p = db.get_or_404(Product, pid)
        change = whole((request.get_json(silent=True) or {}).get("change"), "Change", -1_000_000)
        if change == 0:
            raise ApiError("Enter a quantity to add or remove")
        if p.stock + change < 0:
            raise ApiError(f"Only {p.stock} in stock, so you can't remove {abs(change)}")
        p.stock += change
        db.session.add(StockMovement(product_id=p.id, product_name=p.name, change=change,
                                     reason="restock" if change > 0 else "removed"))
        db.session.commit()
        return jsonify(p.to_dict())

    @app.delete("/api/products/<int:pid>")
    @jwt_required()
    def delete_product(pid):
        db.session.delete(db.get_or_404(Product, pid))
        db.session.commit()
        return jsonify(ok=True)

    # ---------- sales ----------
    @app.post("/api/sales")
    @jwt_required()
    def checkout():
        data = request.get_json(silent=True) or {}
        wanted = {}
        for line in data.get("items") or []:
            pid = whole(line.get("product_id"), "Product")
            wanted[pid] = wanted.get(pid, 0) + whole(line.get("qty"), "Quantity", 1)
        if not wanted:
            raise ApiError("The cart is empty")

        products = (Product.query.filter(Product.id.in_(list(wanted))).order_by(Product.id)
                    .with_for_update().all())
        by_id = {p.id: p for p in products}
        sale = Sale(receipt_no=f"CW-{datetime.now(TZ):%y%m%d}-{secrets.token_hex(3).upper()}",
                    payment_method=(data.get("payment_method") or "cash")[:20])
        total = commission = Decimal("0")
        for pid, qty in wanted.items():
            p = by_id.get(pid)
            if not p:
                raise ApiError("A product in the cart no longer exists. Refresh and try again.")
            if p.stock < qty:
                raise ApiError(f"Only {p.stock} left of {p.name}")
            p.stock -= qty
            sale.items.append(SaleItem(product_id=p.id, name=p.name, qty=qty, unit_price=p.price,
                                       unit_real_price=p.real_price, unit_commission=p.commission))
            db.session.add(StockMovement(product_id=p.id, product_name=p.name, change=-qty, reason="sale"))
            total += p.price * qty
            commission += p.commission * qty

        paid = money(data["amount_paid"], "Amount paid") if data.get("amount_paid") not in (None, "") else total
        if paid < total:
            raise ApiError(f"Amount paid is less than the total ({total})")
        sale.total, sale.commission_total = total, commission
        sale.amount_paid, sale.change_due = paid, paid - total
        db.session.add(sale)
        db.session.commit()
        return jsonify(sale.to_dict()), 201

    @app.get("/api/sales")
    @jwt_required()
    def list_sales():
        filters = []
        if request.args.get("period"):
            start, _ = period_range(request.args["period"])
            filters.append(Sale.created_at >= to_utc_naive(start))
        sales = Sale.query.filter(*filters).order_by(Sale.created_at.desc()).limit(300).all()
        rev, com, count = db.session.query(
            func.coalesce(func.sum(Sale.total), 0), func.coalesce(func.sum(Sale.commission_total), 0),
            func.count(Sale.id)).filter(*filters).one()
        return jsonify(sales=[s.to_dict() for s in sales],
                       totals={"revenue": float(rev), "commission": float(com), "orders": count})

    # ---------- reports ----------
    @app.get("/api/reports")
    @jwt_required()
    def reports():
        start, step = period_range(request.args.get("period", "week"))
        start_utc, now = to_utc_naive(start), datetime.now(TZ)
        buckets = {}
        for b in bucket_starts(start, step, now):
            buckets[bucket_key(b, step)] = {"label": bucket_label(b, step), "revenue": 0.0,
                                            "commission": 0.0, "orders": 0}
        revenue = commission = 0.0
        sales = Sale.query.filter(Sale.created_at >= start_utc).all()
        for s in sales:
            local = s.created_at.replace(tzinfo=timezone.utc).astimezone(TZ)
            b = buckets.get(bucket_key(local, step))
            if b:
                b["revenue"] += float(s.total)
                b["commission"] += float(s.commission_total)
                b["orders"] += 1
            revenue += float(s.total)
            commission += float(s.commission_total)
        series = [{**b, "revenue": round(b["revenue"], 2), "commission": round(b["commission"], 2),
                   "capital": round(b["revenue"] - b["commission"], 2)} for b in buckets.values()]

        item_filter = SaleItem.sale_id == Sale.id
        items_sold = (db.session.query(func.coalesce(func.sum(SaleItem.qty), 0)).join(Sale, item_filter)
                      .filter(Sale.created_at >= start_utc).scalar())
        top = (db.session.query(SaleItem.name, func.sum(SaleItem.qty),
                                func.sum(SaleItem.qty * SaleItem.unit_price),
                                func.sum(SaleItem.qty * SaleItem.unit_commission))
               .join(Sale, item_filter).filter(Sale.created_at >= start_utc)
               .group_by(SaleItem.name).order_by(func.sum(SaleItem.qty).desc()).limit(6).all())

        prods = Product.query.all()
        alerts = sorted((p for p in prods if p.stock <= p.low_stock_at), key=lambda p: p.stock)[:8]
        return jsonify(
            period=request.args.get("period", "week"),
            totals={"revenue": round(revenue, 2), "commission": round(commission, 2),
                    "orders": len(sales), "items": int(items_sold)},
            buckets=series,
            top=[{"name": n, "qty": int(q), "revenue": float(r), "commission": float(c)} for n, q, r, c in top],
            inventory={"stock_cost": float(sum(p.real_price * p.stock for p in prods)),
                       "stock_commission": float(sum(p.commission * p.stock for p in prods)),
                       "alerts": [{"name": p.name, "stock": p.stock} for p in alerts]},
        )

    # ---------- storage monitor ----------
    @app.get("/api/storage")
    @jwt_required()
    def storage():
        limit = int(float(os.environ.get("STORAGE_LIMIT_MB", 512)) * 1024 * 1024)
        out = {"supported": False, "used_bytes": 0, "limit_bytes": limit, "tables": [], "oldest_sale": None}
        if db.engine.dialect.name == "postgresql":
            out["supported"] = True
            out["used_bytes"] = int(db.session.execute(text("select pg_database_size(current_database())")).scalar())
            models = {"products": Product, "sales": Sale, "sale_items": SaleItem,
                      "stock_movements": StockMovement, "users": User}
            rows = db.session.execute(text(
                "select relname, pg_total_relation_size(relid) from pg_stat_user_tables order by 2 desc")).all()
            out["tables"] = [{"name": n, "bytes": int(b),
                              "rows": db.session.query(func.count()).select_from(models[n]).scalar() if n in models else None}
                             for n, b in rows]
        oldest = db.session.query(func.min(Sale.created_at)).scalar()
        out["oldest_sale"] = iso(oldest)
        return jsonify(out)

    @app.post("/api/storage/cleanup")
    @jwt_required()
    def cleanup():
        data = request.get_json(silent=True) or {}
        target = data.get("target")
        if target not in ("sales", "stock_movements"):
            raise ApiError("Choose sales history or stock movement log")
        days = whole(data.get("older_than_days"), "Days", 1)
        model = Sale if target == "sales" else StockMovement
        query = db.session.query(model).filter(model.created_at < datetime.utcnow() - timedelta(days=days))
        count = query.count()
        if data.get("dry_run") or count == 0:
            return jsonify(count=count, deleted=False)
        query.delete(synchronize_session=False)  # sale_items go too (ON DELETE CASCADE)
        db.session.commit()
        if db.engine.dialect.name == "postgresql":  # hand the disk space back so the meter drops
            try:
                with db.engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                    for table in (["sales", "sale_items"] if target == "sales" else ["stock_movements"]):
                        conn.execute(text(f"VACUUM FULL {table}"))
            except Exception:
                pass
        return jsonify(count=count, deleted=True)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
