const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/restaurant'
});

// Note: admin routes intentionally unprotected for this small local deployment.
// Staff page is only reachable via /plek which is not linked from the customer page.

// Block direct access to /staff.html to make staff page only reachable via /plek
app.get('/staff.html', (req,res)=>{
  res.status(404).send('Not found');
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/menu', async (req, res) => {
  try {
    // admin may request all items with ?all=1, customers only get available items
    const all = req.query.all === '1' || req.query.all === 'true';
    const q = all ? 'SELECT * FROM menu ORDER BY category, id' : "SELECT * FROM menu WHERE COALESCE(available, true) = true ORDER BY category, id";
    const r = await pool.query(q);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

app.get('/api/menu/categories', async (req, res) => {
  try {
    // categories for customer view should only include categories that have available items
    const all = req.query.all === '1' || req.query.all === 'true';
    const q = all ? 'SELECT DISTINCT category FROM menu ORDER BY category' : "SELECT DISTINCT category FROM menu WHERE COALESCE(available, true) = true ORDER BY category";
    const r = await pool.query(q);
    res.json(r.rows.map(r=>r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

// Tables overview
app.get('/api/tables', async (req, res) => {
  try {
    const r = await pool.query('SELECT id,name,status FROM tables ORDER BY id');
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Orders for a table
app.get('/api/orders/:tableId', async (req, res) => {
  const tableId = parseInt(req.params.tableId,10);
  try {
    const r = await pool.query('SELECT * FROM orders WHERE table_id=$1 ORDER BY created_at', [tableId]);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Place an order (create)
app.post('/api/orders', async (req, res) => {
  const { table_id, items, total, payment_method, token } = req.body;
  // validate token for table
  try{
    const t = await pool.query('SELECT access_token FROM tables WHERE id=$1', [table_id]);
    if(!t.rows[0] || t.rows[0].access_token !== token) return res.status(403).json({ error: 'invalid_table_token' });
  }catch(err){ console.error(err); return res.status(500).json({ error:'db_error' }); }
  try {
    // Create one order row per item instance so staff can mark individual items served.
    const created = [];
    for(const it of items){
      const qty = Number(it.qty || 1);
      for(let i=0;i<qty;i++){
        const singleItem = { id: it.id, name: it.name, price: it.price, qty: 1 };
        const r = await pool.query(
          'INSERT INTO orders(table_id, items, total, payment_method, status, created_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING *',
          [table_id, JSON.stringify([singleItem]), singleItem.price, payment_method || 'pending', 'pending']
        );
        created.push(r.rows[0]);
      }
    }
    // mark table as having pending orders
    await pool.query("UPDATE tables SET status='order_pending' WHERE id=$1", [table_id]);
    res.json({ created, count: created.length });
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Get table info by token (for customer page loading)
app.get('/api/table-by-token/:token', async (req,res)=>{
  try{
    const t = await pool.query('SELECT id,name,status FROM tables WHERE access_token=$1', [req.params.token]);
    if(!t.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(t.rows[0]);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Mark a specific order as served
app.post('/api/orders/:id/serve', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    const r = await pool.query('UPDATE orders SET served = TRUE WHERE id=$1 RETURNING *', [id]);
    const updated = r.rows[0];
    if(!updated) return res.status(404).json({ error:'not_found' });
    // check if any non-paid orders for this table remain unserved
    const chk = await pool.query("SELECT COUNT(*)::int as c FROM orders WHERE table_id=$1 AND served = FALSE AND status != 'paid'", [updated.table_id]);
    if(chk.rows[0].c === 0){
      // all current orders served
      await pool.query("UPDATE tables SET status='served' WHERE id=$1", [updated.table_id]);
    }
    res.json(updated);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Get detailed orders for a table (detailed view)
app.get('/api/tables/:id/orders', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    const r = await pool.query('SELECT * FROM orders WHERE table_id=$1 ORDER BY created_at', [id]);
    res.json(r.rows);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Mark all orders for a table as paid and move them to sales; returns count
app.post('/api/tables/:id/mark-paid', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  const { payment_method } = req.body;
  try{
    // Transactional: lock table row, aggregate orders, append sale to tables.sales_history, update last_sale_*, delete orders, and set status
    await pool.query('BEGIN');
    // lock the table row to avoid races
    const lock = await pool.query('SELECT * FROM tables WHERE id=$1 FOR UPDATE', [id]);
    if(!lock.rows[0]){ await pool.query('ROLLBACK'); return res.status(404).json({ error:'table_not_found' }); }
    const r = await pool.query("SELECT * FROM orders WHERE table_id=$1 AND status!='paid' ORDER BY created_at", [id]);
    const orders = r.rows;
    if(orders.length===0){ await pool.query('ROLLBACK'); return res.json({ count:0 }); }
    const total = orders.reduce((s,o)=>s + Number(o.total||0), 0);
    const firstOrderTime = orders[0].created_at;
    const ordersJsonArray = orders.map(o=>({ id:o.id, items:o.items, total:o.total, created_at:o.created_at }));
    const paidAt = new Date();
    const saleRecord = { table_id: id, orders: ordersJsonArray, first_order_time: firstOrderTime, total, payment_method: payment_method || null, paid_at: paidAt };
    // append single-element array (so sales_history remains an array of records)
    await pool.query("UPDATE tables SET sales_history = COALESCE(sales_history,'[]'::jsonb) || $1::jsonb, last_sale_orders = $2::jsonb, last_sale_first_order_time = $3, last_sale_total = $4, last_sale_payment_method = $5, last_sale_paid_at = $6 WHERE id=$7",
      [JSON.stringify([saleRecord]), JSON.stringify(ordersJsonArray), firstOrderTime, total, payment_method || null, paidAt, id]);
    // insert into bills table for reporting
    await pool.query('INSERT INTO bills(table_id, orders, total, first_order_time, last_order_time, payment_method, paid_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, JSON.stringify(ordersJsonArray), total, firstOrderTime, orders[orders.length-1].created_at, payment_method || null, paidAt]);
    await pool.query("DELETE FROM orders WHERE table_id=$1", [id]);
    await pool.query("UPDATE tables SET status='paid' WHERE id=$1", [id]);
    await pool.query('COMMIT');
    res.json({ count: orders.length });
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Mark table as cleaned/available (after paid and cleared)
app.post('/api/tables/:id/clean', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    await pool.query("UPDATE tables SET status='available' WHERE id=$1", [id]);
    const r = await pool.query('SELECT id,name,status FROM tables WHERE id=$1', [id]);
    res.json(r.rows[0]);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Admin: regenerate token for a table
app.post('/api/admin/tables/:id/regenerate-token', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    const r = await pool.query("UPDATE tables SET access_token = md5(random()::text || clock_timestamp()::text) WHERE id=$1 RETURNING id, access_token", [id]);
    if(!r.rows[0]) return res.status(404).json({ error:'not_found' });
    res.json(r.rows[0]);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Admin: list tables with tokens (for settings UI)
app.get('/api/admin/tables', async (req,res)=>{
  try{
    const r = await pool.query('SELECT id,name,status,access_token FROM tables ORDER BY id');
    // compose customer link base from request
    const host = (req.get('x-forwarded-proto') || req.protocol) + '://' + req.get('host');
    const rows = r.rows.map(row=>({ id: row.id, name: row.name, status: row.status, link: `${host}/table/${row.id}/${row.access_token}`, token: row.access_token }));
    res.json(rows);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Admin: generate QR as PNG for a table link
app.get('/api/admin/tables/:id/qr', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    const r = await pool.query('SELECT access_token FROM tables WHERE id=$1', [id]);
    if(!r.rows[0]) return res.status(404).json({ error:'not_found' });
    const host = (req.get('x-forwarded-proto') || req.protocol) + '://' + req.get('host');
    const link = `${host}/table/${id}/${r.rows[0].access_token}`;
    res.setHeader('Content-Type','image/png');
    const stream = QRCode.toFileStream(res, link, { type: 'png', width: 300 });
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Admin: generate label SVG (QR + table text) for printing; returned as SVG
app.get('/api/admin/tables/:id/label', async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try{
    const r = await pool.query('SELECT access_token, name FROM tables WHERE id=$1', [id]);
    if(!r.rows[0]) return res.status(404).json({ error:'not_found' });
    const host = (req.get('x-forwarded-proto') || req.protocol) + '://' + req.get('host');
    const link = `${host}/table/${id}/${r.rows[0].access_token}`;
    // generate QR as SVG fragment
    const qrSvg = await QRCode.toString(link, { type: 'svg', margin:1, width:300 });
    // qrSvg is an <svg>...</svg> string. We'll embed it inside a larger SVG label with table name
    const tableName = r.rows[0].name || `Table ${id}`;
    const labelSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="420" viewBox="0 0 400 420">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g transform="translate(50,20)">
    ${qrSvg}
  </g>
  <text x="200" y="370" font-family="Arial, Helvetica, sans-serif" font-size="36" text-anchor="middle" fill="#111">${escapeXml(tableName)}</text>
  <text x="200" y="402" font-family="Arial, Helvetica, sans-serif" font-size="14" text-anchor="middle" fill="#666">${escapeXml(link)}</text>
</svg>`;
    res.setHeader('Content-Type','image/svg+xml');
    res.send(labelSvg);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// Serve staff page at /plek for easy access
app.get('/plek', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

// sales report API - filter by paid_at date range (inclusive). Query params: from, to (YYYY-MM-DD). Defaults to today.
// Sales report (read from per-table sales_history)
app.get('/api/reports/sales', async (req,res)=>{
  try{
    const { from, to } = req.query;
    const today = new Date();
    const fmt = d=> new Date(d).toISOString().slice(0,10);
    const f = from || fmt(today);
    const t = to || fmt(today);
    const fromTs = f + ' 00:00:00';
    const toTs = t + ' 23:59:59';
    const q = `SELECT paid_at, table_id, payment_method, total, orders FROM bills WHERE paid_at >= $1 AND paid_at <= $2 ORDER BY paid_at DESC`;
    const r = await pool.query(q, [fromTs, toTs]);
    res.json(r.rows);
  }catch(err){ console.error(err); res.status(500).json({ error:'db_error' }); }
});

// serve a simple sales report page for staff
app.get('/plek/sales', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','plek-sales.html'));
});

// Serve customer page for tokenized table URLs (so /table/:id/:token loads the SPA)
app.get('/table/:id/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// helper to escape XML characters for the SVG text
function escapeXml(unsafe){
  return String(unsafe).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&apos;" }[c]; });
}

// Update order status (paid/cancel/update)
app.put('/api/orders/:id', async (req, res) => {
  const id = parseInt(req.params.id,10);
  const { status, payment_method } = req.body;
  try {
    const r = await pool.query('UPDATE orders SET status=$1, payment_method=$2, paid_at=CASE WHEN $1=$3 THEN now() ELSE paid_at END WHERE id=$4 RETURNING *',
      [status || 'pending', payment_method || null, 'paid', id]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Admin: update settings - number of tables
app.put('/api/settings/tables', async (req, res) => {
  const { count } = req.body;
  try {
    // naive approach: adjust tables table
    const cur = await pool.query('SELECT COUNT(*)::int as c FROM tables');
    const curCount = cur.rows[0].c;
    if (count > curCount) {
      for (let i = curCount+1; i<=count; i++) {
        await pool.query('INSERT INTO tables(id, name, status) VALUES($1,$2,$3)', [i, `Table ${i}`, 'available']);
      }
    } else if (count < curCount) {
      await pool.query('DELETE FROM tables WHERE id > $1', [count]);
    }
    const r = await pool.query('SELECT * FROM tables ORDER BY id');
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Admin: add/edit menu
app.post('/api/menu', async (req, res) => {
  const { name, price, category, description, available } = req.body;
  try {
    const r = await pool.query('INSERT INTO menu(name,price,category,description,available) VALUES($1,$2,$3,$4,$5) RETURNING *', [name, price, category, description||null, available === undefined ? true : available]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

app.put('/api/menu/:id', async (req, res) => {
  const id = parseInt(req.params.id,10);
  const { name, price, category, description, available } = req.body;
  try {
    const r = await pool.query('UPDATE menu SET name=$1, price=$2, category=$3, description=$4, available=$5 WHERE id=$6 RETURNING *', [name, price, category, description||null, available === undefined ? true : available, id]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Delete a menu item
app.delete('/api/menu/:id', async (req, res) => {
  const id = parseInt(req.params.id,10);
  try {
    const r = await pool.query('DELETE FROM menu WHERE id=$1 RETURNING *', [id]);
    if(!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// legacy sales-report removed; use the sales_history-backed /api/reports/sales defined earlier

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
