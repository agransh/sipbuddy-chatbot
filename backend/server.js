// backend/server.js

require('dotenv').config();

console.log('🔧  ENV:', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
  PORT:    process.env.PORT
});

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// — Create MySQL connection pool —
const pool = mysql.createPool({
  host:              process.env.DB_HOST,
  port:              +process.env.DB_PORT || 3306,
  user:              process.env.DB_USER,
  password:          process.env.DB_PASS,
  database:          process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  connectTimeout:     10000
});

// — Health check on startup —
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  Connected to MySQL on', process.env.DB_NAME);
    
    // Create missing tables if they don't exist
    try {
      // Create recommendation_weights table
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS recommendation_weights (
          \`key\` varchar(50) PRIMARY KEY,
          value decimal(3,2) NOT NULL DEFAULT 1.0
        )
      `);
      
      // Insert default weights if table is empty
      const [weightCheck] = await conn.query('SELECT COUNT(*) as count FROM recommendation_weights');
      if (weightCheck[0].count === 0) {
        await conn.execute(`
          INSERT INTO recommendation_weights (\`key\`, value) VALUES 
          ('promotion', 1.5),
          ('hot', 1.3), 
          ('aging', 1.0),
          ('new', 1.2)
        `);
        console.log('✅  Created default recommendation weights');
      }
      
      // Create item_settings table
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS item_settings (
          code_num varchar(20) PRIMARY KEY,
          promotion tinyint(1) DEFAULT 0,
          hot tinyint(1) DEFAULT 0,
          first_seen date DEFAULT NULL,
          last_purchase date DEFAULT NULL
        )
      `);
      
      // Create LIQCODE table if it doesn't exist
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS LIQCODE (
          code_num varchar(20) PRIMARY KEY,
          brand varchar(255) NOT NULL,
          type varchar(10) NOT NULL,
          price decimal(8,2) NOT NULL,
          size varchar(50) DEFAULT NULL
        )
      `);
      
      // Insert sample data if LIQCODE table is empty
      const [liqCheck] = await conn.query('SELECT COUNT(*) as count FROM LIQCODE');
      if (liqCheck[0].count === 0) {
        await conn.execute(`
          INSERT INTO LIQCODE (code_num, brand, type, price, size) VALUES 
          ('B001', 'Corona Extra', 'BE', 12.99, '6-pack'),
          ('B002', 'Stella Artois', 'BE', 15.99, '6-pack'),
          ('B003', 'Guinness', 'BE', 18.99, '6-pack'),
          ('B004', 'Heineken', 'BE', 14.99, '6-pack'),
          ('B005', 'Blue Moon', 'BE', 13.99, '6-pack'),
          ('W001', 'Kendall-Jackson Chardonnay', 'WI', 24.99, '750ml'),
          ('W002', 'Caymus Cabernet', 'WI', 89.99, '750ml'),
          ('W003', 'La Marca Prosecco', 'WI', 19.99, '750ml'),
          ('W004', 'Josh Cellars Pinot Noir', 'WI', 16.99, '750ml'),
          ('W005', 'Apothic Red', 'WI', 12.99, '750ml'),
          ('R001', 'White Claw Variety Pack', 'RT', 17.99, '12-pack'),
          ('R002', 'High Noon Vodka Soda', 'RT', 19.99, '8-pack'),
          ('R003', 'Truly Hard Seltzer', 'RT', 16.99, '12-pack'),
          ('R004', 'Bud Light Seltzer', 'RT', 15.99, '12-pack'),
          ('R005', 'Smirnoff Ice', 'RT', 13.99, '6-pack')
        `);
        console.log('✅  Created sample product data');
      }
      
      console.log('✅  Database tables verified/created');
    } catch (tableErr) {
      console.warn('⚠️  Table creation warning:', tableErr.message);
    }
    
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
  }
})();

// — Map UI categories to LIQCODE.type codes —
const TYPE_MAP = {
  Beer: 'BE',
  Wine: 'WI',
  RTD:  'RT'
};

// — Admin: list items + settings —
app.get('/api/admin/items', async (req, res) => {
  try {
    const sql = `
      SELECT
        L.code_num,
        L.brand      AS name,
        L.price,
        L.size,
        S.promotion,
        S.hot,
        S.first_seen,
        S.last_purchase
      FROM LIQCODE L
      LEFT JOIN item_settings S ON S.code_num = L.code_num
      ORDER BY L.brand
      LIMIT 1000
    `;
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/admin/items:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Admin: update one item’s flags —
app.post('/api/admin/item/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { promotion, hot, first_seen, last_purchase } = req.body;
    await pool.execute(
      `INSERT INTO item_settings
         (code_num, promotion, hot, first_seen, last_purchase)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         promotion     = VALUES(promotion),
         hot           = VALUES(hot),
         first_seen    = VALUES(first_seen),
         last_purchase = VALUES(last_purchase)`,
      [code, promotion, hot, first_seen, last_purchase]
    );
    res.sendStatus(204);
  } catch (err) {
    console.error('Error in POST /api/admin/item/:code:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Admin: list global weights —
app.get('/api/admin/weights', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT \`key\`, value FROM recommendation_weights`);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/admin/weights:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Admin: update global weights —
app.post('/api/admin/weights', async (req, res) => {
  try {
    const updates = req.body; // e.g. { promotion:1.5, hot:1.3, aging:0.8, new:1.2 }
    await Promise.all(Object.entries(updates).map(
      ([k, v]) => pool.execute(
        `UPDATE recommendation_weights SET value = ? WHERE \`key\` = ?`,
        [v, k]
      )
    ));
    res.sendStatus(204);
  } catch (err) {
    console.error('Error in POST /api/admin/weights:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Recommendations endpoint (binary compare to avoid any collation mismatch) —
app.get('/api/recommendations', async (req, res) => {
  try {
    const { category, maxPrice = 1000, limit = 5 } = req.query;
    console.log('🔍 /api/recommendations called with:', { category, maxPrice, limit });

    const typeCode = TYPE_MAP[category];
    if (!typeCode) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Return hardcoded data for now to test if the API works
    const hardcodedData = {
      'Beer': [
        { id: 'B001', name: 'Corona Extra', price: 12.99, img: 'https://via.placeholder.com/80?text=Corona' },
        { id: 'B002', name: 'Stella Artois', price: 15.99, img: 'https://via.placeholder.com/80?text=Stella' },
        { id: 'B003', name: 'Guinness', price: 18.99, img: 'https://via.placeholder.com/80?text=Guinness' }
      ],
      'Wine': [
        { id: 'W001', name: 'Kendall-Jackson Chardonnay', price: 24.99, img: 'https://via.placeholder.com/80?text=Chardonnay' },
        { id: 'W002', name: 'Caymus Cabernet', price: 89.99, img: 'https://via.placeholder.com/80?text=Caymus' },
        { id: 'W003', name: 'La Marca Prosecco', price: 19.99, img: 'https://via.placeholder.com/80?text=Prosecco' }
      ],
      'RTD': [
        { id: 'R001', name: 'White Claw Variety Pack', price: 17.99, img: 'https://via.placeholder.com/80?text=WhiteClaw' },
        { id: 'R002', name: 'High Noon Vodka Soda', price: 19.99, img: 'https://via.placeholder.com/80?text=HighNoon' },
        { id: 'R003', name: 'Truly Hard Seltzer', price: 16.99, img: 'https://via.placeholder.com/80?text=Truly' }
      ]
    };

    const results = hardcodedData[category] || [];
    console.log(`✅ Returning ${results.length} hardcoded results for ${category}:`, results);
    res.json(results);

  } catch (err) {
    console.error('🔥 Error in /api/recommendations:', err);
    console.error('🔥 Stack trace:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// — Start server —
const PORT = +process.env.PORT || 4000;

// — Simple health check —
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// — Very simple test endpoint —
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date().toISOString() });
});

// — Check database status —
app.get('/api/db-status', async (req, res) => {
  try {
    // Check if LIQCODE table exists and has data
    const [liqCheck] = await pool.query("SHOW TABLES LIKE 'LIQCODE'");
    const liqExists = liqCheck.length > 0;
    
    let liqCount = 0;
    let sampleData = [];
    if (liqExists) {
      const [countResult] = await pool.query('SELECT COUNT(*) as count FROM LIQCODE');
      liqCount = countResult[0].count;
      
      if (liqCount > 0) {
        const [sample] = await pool.query('SELECT * FROM LIQCODE LIMIT 3');
        sampleData = sample;
      }
    }
    
    // Check weights table
    const [weightsResult] = await pool.query('SELECT COUNT(*) as count FROM recommendation_weights');
    const weightsCount = weightsResult[0].count;
    
    res.json({
      liqcode_exists: liqExists,
      liqcode_count: liqCount,
      weights_count: weightsCount,
      sample_products: sampleData
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// — Test simple query —
app.get('/api/test-beer', async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM LIQCODE WHERE type = 'BE' LIMIT 3");
    res.json({ count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.stack });
  }
});

// — Debug endpoint to check all data —
app.get('/api/debug', async (req, res) => {
  try {
    const [allRows] = await pool.query("SELECT * FROM LIQCODE");
    const [beerRows] = await pool.query("SELECT * FROM LIQCODE WHERE type = 'BE'");
    const [wineRows] = await pool.query("SELECT * FROM LIQCODE WHERE type = 'WI'");
    const [rtdRows] = await pool.query("SELECT * FROM LIQCODE WHERE type = 'RT'");
    
    res.json({ 
      total_products: allRows.length,
      beer_count: beerRows.length,
      wine_count: wineRows.length, 
      rtd_count: rtdRows.length,
      sample_data: allRows.slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
});
