-- Schema for mobile restaurant ordering
CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS tables (
  id INT PRIMARY KEY,
  name TEXT,
  status TEXT DEFAULT 'available' -- available, order_pending, paid
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_id INT REFERENCES tables(id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  payment_method TEXT, -- cash, qr, etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- seed tables (default 8 tables)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM tables) = 0 THEN
    INSERT INTO tables(id,name,status) SELECT i, concat('Table ', i), 'available' FROM generate_series(1,8) i;
  END IF;
END$$;

-- sample menu
INSERT INTO menu(name,price,category,description)
SELECT 'Margherita', 8.50, 'Pizza', 'Classic cheese and tomato' WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='Margherita');
INSERT INTO menu(name,price,category,description)
SELECT 'Coke', 1.50, 'Drink', 'Can of coke' WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='Coke');
