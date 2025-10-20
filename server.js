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
    const r = await pool.query('SELECT * FROM menu ORDER BY category, id');
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

app.get('/api/menu/categories', async (req, res) => {
  try {
    const r = await pool.query('SELECT DISTINCT category FROM menu ORDER BY category');
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
    const r = await pool.query(
      'INSERT INTO orders(table_id, items, total, payment_method, status, created_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING *',
      [table_id, JSON.stringify(items), total, payment_method || 'pending', 'pending']
    );
    res.json(r.rows[0]);
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
    res.json(r.rows[0]);
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
    // fetch unpaid orders
    const r = await pool.query("SELECT * FROM orders WHERE table_id=$1 AND status!='paid'", [id]);
    const orders = r.rows;
    if(orders.length===0) return res.json({ count:0 });
    // mark orders as paid and set payment method and paid_at
    await pool.query("UPDATE orders SET status='paid', payment_method=$1, paid_at=now() WHERE table_id=$2 AND status!='paid'", [payment_method, id]);
    // move to sales archive
    for(const o of orders){
      await pool.query('INSERT INTO sales(orig_order_id, table_id, items, total, payment_method, created_at, paid_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [o.id, o.table_id, o.items, o.total, payment_method || o.payment_method, o.created_at, new Date()]);
    }
    // delete moved orders (clear current orders for the table)
    await pool.query("DELETE FROM orders WHERE table_id=$1", [id]);
    // update table status to 'paid'
    await pool.query("UPDATE tables SET status='paid' WHERE id=$1", [id]);
    res.json({ count: orders.length });
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
  const { name, price, category, description } = req.body;
  try {
    const r = await pool.query('INSERT INTO menu(name,price,category,description) VALUES($1,$2,$3,$4) RETURNING *', [name, price, category, description||null]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

app.put('/api/menu/:id', async (req, res) => {
  const id = parseInt(req.params.id,10);
  const { name, price, category, description } = req.body;
  try {
    const r = await pool.query('UPDATE menu SET name=$1, price=$2, category=$3, description=$4 WHERE id=$5 RETURNING *', [name, price, category, description||null, id]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

// Sales report
app.get('/api/reports/sales', async (req, res) => {
  try {
    const r = await pool.query("SELECT status, payment_method, COUNT(*) as count, SUM(total) as total FROM orders GROUP BY status, payment_method ORDER BY status");
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
