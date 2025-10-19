# Mobile Restaurant Ordering (Render-ready)

This repository implements a mobile-friendly restaurant ordering web app with per-table customer pages, a cart, staff dashboard, and settings. It's designed to be deployed to Render.com and uses PostgreSQL as the persistent store.

Features
- Mobile customer menu page (open with ?table=1 to set table)
- Cart and checkout (creates an order)
- Staff dashboard showing table statuses and orders
- Settings page to change table count, add/edit menu, and view basic sales report

Quick deploy notes (Render)
1. Create a new Web Service on Render using this repo.
2. Set the Environment variables:
   - DATABASE_URL (Postgres connection string)
   - PORT (optional)
3. Build & Start command: npm install && npm run init-db && npm start

DB initialization
- The repo includes db/init.sql and db/init.js. The Render service should run `npm run init-db` once (or include it in the start command as above) to create tables and seed sample data.

Security & production notes
- Add authentication for staff/settings pages before production.
- Secure the database credentials and use Render managed Postgres.
- For QR payments integrate a payment provider and webhook to update orders to paid.

Files
- server.js - Express server and API
- db/init.sql - SQL schema and seed
- db/init.js - helper to run SQL using DATABASE_URL
- public/ - frontend static files
