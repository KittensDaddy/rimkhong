const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/restaurant'
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
    const r = await pool.query('SELECT * FROM tables ORDER BY id');
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
  const { table_id, items, total, payment_method } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO orders(table_id, items, total, payment_method, status, created_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING *',
      [table_id, JSON.stringify(items), total, payment_method || 'pending', 'pending']
    );
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'db_error' }); }
});

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
