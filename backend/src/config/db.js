const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function query(text, params) {
  return pool.query(text, params);
}

async function testConnection() {
  await query("SELECT 1");
}

module.exports = {
  pool,
  query,
  testConnection
};

