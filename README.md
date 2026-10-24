# conwiInventory

POS, inventory and sales tracker. Flask API (Render) + React app (Vercel) + Neon Postgres.

## Run locally
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then export the variables, or set them in your shell
flask --app app run --port 5000     # uses SQLite if DATABASE_URL is not set

# frontend
cd frontend && cp .env.example .env && npm install && npm run dev
```
Open http://localhost:5173. The first visit asks you to create the owner account.

## Deploy
1. **Neon**: create a project, click Connect, copy the connection string (it ends with `?sslmode=require`).
2. **Render**: push this repo to GitHub, then New > Blueprint (uses `render.yaml`), or create a Web Service with
   root directory `backend`, build `pip install -r requirements.txt`, start `gunicorn app:app --bind 0.0.0.0:$PORT`.
   Set env vars: `DATABASE_URL` (Neon string), `JWT_SECRET_KEY` (long random text),
   `CORS_ORIGINS` (your Vercel URL, e.g. `https://conwiinventory.vercel.app`), `STORAGE_LIMIT_MB` (your Neon plan limit, free = 512).
3. **Vercel**: import the repo, set Root Directory to `frontend`, add env var `VITE_API_URL` = your Render URL (no trailing slash). Deploy.
4. Go back to Render and make sure `CORS_ORIGINS` matches the final Vercel URL.

Tables are created automatically on first start.

## How it works
- **Products**: you enter the real price and your commission; selling price = real price + commission.
- **Status** is automatic: Available, Low (at or below your alert level) or Out of stock (0). Each sale subtracts from stock.
- **Dashboard / Sales**: filter by Day, Week (7 days), Month (30 days), Half year (6 months), Year (12 months).
  The chart splits income into capital and commission.
- **Analysis**: compares the period with the one before it, lists key insights, categories, payment methods, busiest days and hours, slow movers, and saves it all as a PDF.
- **Storage**: shows Neon database size against `STORAGE_LIMIT_MB`, size per table, and lets you delete old sales history or the stock log.
