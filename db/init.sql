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
  status TEXT DEFAULT 'available', -- available, order_pending, paid
  access_token TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_id INT REFERENCES tables(id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
  payment_method TEXT, -- cash, qr, etc
  served BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- seed tables (default 8 tables)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM tables) = 0 THEN
    INSERT INTO tables(id,name,status, access_token) SELECT i, concat('Table ', i), 'available', md5(random()::text || clock_timestamp()::text) FROM generate_series(1,8) i;
  END IF;
END$$;

-- sample menu
INSERT INTO menu(name,price,category,description)
SELECT 'Margherita', 8.50, 'Pizza', 'Classic cheese and tomato' WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='Margherita');
INSERT INTO menu(name,price,category,description)
SELECT 'Coke', 1.50, 'Drink', 'Can of coke' WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='Coke');

-- If the tables table existed from an earlier version without access_token, add the column
-- populate tokens for rows missing them

-- Seed Thai menu (idempotent)
-- Category: เลือกโต๊ะ (table selection as menu items with price 0)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM menu WHERE name = 'โต๊ะ 1') THEN
    INSERT INTO menu(name,price,category,description)
    VALUES
    ('โต๊ะ 1',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 2',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 3',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 4',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 5',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 6',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 7',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 8',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 9',0,'เลือกโต๊ะ',NULL),
    ('โต๊ะ 10',0,'เลือกโต๊ะ',NULL);
  END IF;
END$$;

-- ชุดเปิดเตา (mandatory opening set)
INSERT INTO menu(name,price,category,description)
SELECT 'ชุดเปิดเตา', 99, 'ชุดเปิดเตา (บังคับเลือก)', NULL
WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ชุดเปิดเตา');

-- อาหารสด (25 บาท)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM menu WHERE name='หมูสามชั้น') THEN
    INSERT INTO menu(name,price,category,description) VALUES
      ('หมูสามชั้น',25,'อาหารสด (25 บาท)',NULL),
      ('สามชั้นหมักงา',25,'อาหารสด (25 บาท)',NULL),
      ('สามชั้นพริกไทยดำ',25,'อาหารสด (25 บาท)',NULL),
      ('หมูนุ่ม',25,'อาหารสด (25 บาท)',NULL),
      ('หมูหมักงา',25,'อาหารสด (25 บาท)',NULL),
      ('หมูชาบู',25,'อาหารสด (25 บาท)',NULL),
      ('ตับสด',25,'อาหารสด (25 บาท)',NULL),
      ('เนื้อสไลด์',25,'อาหารสด (25 บาท)',NULL),
      ('สไบนาง',25,'อาหารสด (25 บาท)',NULL);
  END IF;
END$$;

-- อาหารทะเล
INSERT INTO menu(name,price,category,description)
SELECT 'กุ้งสด',50,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='กุ้งสด');
INSERT INTO menu(name,price,category,description)
SELECT 'ปลาดอลลี่',25,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ปลาดอลลี่');
INSERT INTO menu(name,price,category,description)
SELECT 'หมึกบั้ง',25,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='หมึกบั้ง');
INSERT INTO menu(name,price,category,description)
SELECT 'หนวดหมึกเรด้า',25,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='หนวดหมึกเรด้า');
INSERT INTO menu(name,price,category,description)
SELECT 'หมึกกรอบ',25,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='หมึกกรอบ');
INSERT INTO menu(name,price,category,description)
SELECT 'แมงกระพรุน',25,'อาหารทะเล',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='แมงกระพรุน');

-- ผัก / เส้น
INSERT INTO menu(name,price,category,description)
SELECT 'ผักบุ้ง',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ผักบุ้ง');
INSERT INTO menu(name,price,category,description)
SELECT 'ผักกาดขาว',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ผักกาดขาว');
INSERT INTO menu(name,price,category,description)
SELECT 'กระหล่ำปลี',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='กระหล่ำปลี');
INSERT INTO menu(name,price,category,description)
SELECT 'วุ้นเส้น',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='วุ้นเส้น');
INSERT INTO menu(name,price,category,description)
SELECT 'เส้นแก้ว',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เส้นแก้ว');
INSERT INTO menu(name,price,category,description)
SELECT 'เห็ด',10,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เห็ด');
INSERT INTO menu(name,price,category,description)
SELECT 'ไข่ไก่',5,'ผัก / เส้น',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ไข่ไก่');

-- ของหวาน / อาหารเสริม
INSERT INTO menu(name,price,category,description)
SELECT 'ไอติม',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ไอติม');
INSERT INTO menu(name,price,category,description)
SELECT 'น้ำแข็งใส',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='น้ำแข็งใส');
INSERT INTO menu(name,price,category,description)
SELECT 'วุ้นสามสี',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='วุ้นสามสี');
INSERT INTO menu(name,price,category,description)
SELECT 'เฉาก๊วย',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เฉาก๊วย');
INSERT INTO menu(name,price,category,description)
SELECT 'ขนมปัง',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ขนมปัง');
INSERT INTO menu(name,price,category,description)
SELECT 'สับปะรด',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='สับปะรด');
INSERT INTO menu(name,price,category,description)
SELECT 'แมงลัก',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='แมงลัก');
INSERT INTO menu(name,price,category,description)
SELECT 'ข้าวสวย',5,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ข้าวสวย');
INSERT INTO menu(name,price,category,description)
SELECT 'ข้าวผัด',10,'ของหวาน / อาหารเสริม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='ข้าวผัด');

-- เครื่องดื่ม
INSERT INTO menu(name,price,category,description)
SELECT 'น้ำแข็ง',10,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='น้ำแข็ง');
INSERT INTO menu(name,price,category,description)
SELECT 'น้ำอัดลม',45,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='น้ำอัดลม');
INSERT INTO menu(name,price,category,description)
SELECT 'น้ำเปล่า',20,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='น้ำเปล่า');
INSERT INTO menu(name,price,category,description)
SELECT 'เบียร์ช้าง',65,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เบียร์ช้าง');
INSERT INTO menu(name,price,category,description)
SELECT 'เบียร์ลีโอ',65,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เบียร์ลีโอ');
INSERT INTO menu(name,price,category,description)
SELECT 'เบียร์สิงห์',70,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='เบียร์สิงห์');
INSERT INTO menu(name,price,category,description)
SELECT 'หงส์กลม',320,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='หงส์กลม');
INSERT INTO menu(name,price,category,description)
SELECT 'หงส์แบน',170,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='หงส์แบน');
INSERT INTO menu(name,price,category,description)
SELECT 'แสงกลม',360,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='แสงกลม');
INSERT INTO menu(name,price,category,description)
SELECT 'แสงแบน',190,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='แสงแบน');
INSERT INTO menu(name,price,category,description)
SELECT 'โซดา',15,'เครื่องดื่ม',NULL WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name='โซดา');

UPDATE tables SET access_token = md5(random()::text || clock_timestamp()::text) WHERE access_token IS NULL;

-- ensure orders have served column for older DBs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS served BOOLEAN DEFAULT FALSE;

-- Per-table sales storage: keep a JSONB history and quick last-sale fields on the tables row.
-- This moves the sales columns into the tables table so each table stores its own sales history and last-sale summary.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS sales_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_sale_orders JSONB; -- JSON array of orders for the most recent sale
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_sale_first_order_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_sale_total NUMERIC(10,2);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_sale_payment_method TEXT;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS last_sale_paid_at TIMESTAMP WITH TIME ZONE;

-- Bills table: each completed bill (one row per paid table event)
CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  table_id INT REFERENCES tables(id) ON DELETE SET NULL,
  orders JSONB,
  total NUMERIC(10,2),
  first_order_time TIMESTAMP WITH TIME ZONE,
  last_order_time TIMESTAMP WITH TIME ZONE,
  payment_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index on paid_at for faster reporting
CREATE INDEX IF NOT EXISTS idx_bills_paid_at ON bills(paid_at);
