const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname,'init.sql'),'utf8');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/restaurant' });

async function run(){
  try{
    console.log('Running DB init...');
    await pool.query(sql);
    console.log('DB initialized');
    await pool.end();
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

run();
