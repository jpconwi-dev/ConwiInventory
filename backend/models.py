from datetime import date, datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(60), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, pw):
        self.password_hash = generate_password_hash(pw)

    def check_password(self, pw):
        return check_password_hash(self.password_hash, pw)


class Product(db.Model):
    __tablename__ = "products"
    id = db.Column(db.Integer, primary_key=True)
    sku = db.Column(db.String(40), unique=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(60), default="")
    real_price = db.Column(db.Numeric(12, 2), nullable=False, default=0)  # what you pay
    commission = db.Column(db.Numeric(12, 2), nullable=False, default=0)  # what you earn per unit
    price = db.Column(db.Numeric(12, 2), nullable=False, default=0)       # selling price = real + commission
    stock = db.Column(db.Integer, nullable=False, default=0)
    low_stock_at = db.Column(db.Integer, nullable=False, default=5)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def status(self):
        if self.stock <= 0:
            return "out"
        return "low" if self.stock <= self.low_stock_at else "available"

    def to_dict(self):
        return {
            "id": self.id, "sku": self.sku, "name": self.name, "category": self.category or "",
            "real_price": float(self.real_price), "commission": float(self.commission),
            "price": float(self.price), "stock": self.stock, "low_stock_at": self.low_stock_at,
            "status": self.status,
        }


class Sale(db.Model):
    __tablename__ = "sales"
    id = db.Column(db.Integer, primary_key=True)
    receipt_no = db.Column(db.String(30), unique=True, nullable=False)
    total = db.Column(db.Numeric(12, 2), nullable=False)
    commission_total = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    payment_method = db.Column(db.String(20), default="cash")
    amount_paid = db.Column(db.Numeric(12, 2), nullable=False)
    change_due = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    items = db.relationship("SaleItem", backref="sale", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id, "receipt_no": self.receipt_no, "total": float(self.total),
            "commission_total": float(self.commission_total), "payment_method": self.payment_method,
            "amount_paid": float(self.amount_paid), "change_due": float(self.change_due),
            "created_at": iso(self.created_at),
            "items": [i.to_dict() for i in self.items],
        }


class SaleItem(db.Model):
    __tablename__ = "sale_items"
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="SET NULL"))
    name = db.Column(db.String(120), nullable=False)  # snapshot, survives product deletion
    qty = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    unit_real_price = db.Column(db.Numeric(12, 2), nullable=False)
    unit_commission = db.Column(db.Numeric(12, 2), nullable=False)

    def to_dict(self):
        return {
            "name": self.name, "qty": self.qty, "unit_price": float(self.unit_price),
            "unit_commission": float(self.unit_commission),
            "subtotal": float(self.unit_price * self.qty),
        }


class StockMovement(db.Model):
    __tablename__ = "stock_movements"
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id", ondelete="SET NULL"))
    product_name = db.Column(db.String(120))
    change = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(60))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)


class EstoreEntry(db.Model):
    """E-store ledger: GCash / load / utang. Counts toward totals only once marked done."""
    __tablename__ = "estore_entries"
    id = db.Column(db.Integer, primary_key=True)
    service = db.Column(db.String(10), nullable=False, index=True)    # gcash | load | utang
    direction = db.Column(db.String(3), nullable=False)               # in | out
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    fee = db.Column(db.Numeric(12, 2), nullable=False, default=0)     # what you earn on it
    customer = db.Column(db.String(80), default="")
    note = db.Column(db.String(200), default="")
    status = db.Column(db.String(10), nullable=False, default="pending", index=True)  # pending | done
    entry_date = db.Column(db.Date, default=date.today)               # date of the transaction
    source = db.Column(db.String(10), nullable=False, default="admin")  # admin | public (store form)
    public_token = db.Column(db.String(32), index=True)               # lets the store form look up its own entries
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    done_at = db.Column(db.DateTime, index=True)

    def to_dict(self):
        return {
            "id": self.id, "service": self.service, "direction": self.direction,
            "amount": float(self.amount), "fee": float(self.fee), "customer": self.customer or "",
            "note": self.note or "", "status": self.status,
            "entry_date": self.entry_date.isoformat() if self.entry_date else None, "source": self.source,
            "created_at": iso(self.created_at), "done_at": iso(self.done_at),
        }
