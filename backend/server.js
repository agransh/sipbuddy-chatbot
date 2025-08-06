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
const fs      = require('fs');

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

// — Get all distinct types from database —
app.get('/api/types', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT type, COUNT(*) as count, 
             GROUP_CONCAT(DISTINCT brand LIMIT 5) as sample_brands
      FROM LIQCODE 
      GROUP BY type 
      ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error in GET /api/types:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Map UI categories to LIQCODE.type codes (from CSV analysis) —
const TYPE_MAP = {
  Beer: ['60', '85', '94', '97'],  // Beer types from CSV
  Wine: ['7', '8', '56', '68']     // Wine types from CSV  
  // RTD is determined by product description, not type codes
};

// — Helper function to identify RTD products by description —
function isRTDProduct(product) {
  const searchText = `${product.brand} ${product.descrip}`.toLowerCase();
  
  // RTD indicators - Ready-To-Drink alcoholic beverages
  const rtdKeywords = [
    // Hard Seltzers
    'seltzer', 'hard seltzer', 'white claw', 'truly', 'bud light seltzer', 'natural light seltzer',
    'corona seltzer', 'michelob ultra seltzer', 'bon & viv', 'press', 'vizzy', 'barefoot refresh',
    
    // Canned Cocktails & RTDs
    'cocktail', 'margarita', 'mojito', 'cosmopolitan', 'bloody mary', 'moscow mule', 'mudslide',
    'daiquiri', 'pina colada', 'long island', 'mai tai', 'sex on the beach',
    
    // Flavored Malt Beverages
    'malt beverage', 'flavored malt', 'smirnoff ice', 'mike\'s hard', 'seagram\'s escapes',
    'twisted tea', 'not your father\'s', 'angry orchard', 'redd\'s', 'crispin',
    
    // Energy & Alcoholic Combinations
    'four loko', 'tilt', 'sparks', 'joose',
    
    // Premium RTDs
    'high noon', 'cutwater', 'on the rocks', 'crafthouse', 'social hour',
    'jose cuervo ready', 'bacardi ready', 'captain morgan ready', 'svedka ready',
    
    // General RTD terms
    'pre-mixed', 'premixed', 'ready to drink', 'canned cocktail', 'rtd',
    'sparkling cocktail', 'alcoholic soda', 'hard tea', 'hard lemonade', 'hard cider'
  ];
  
  // Must contain RTD keywords
  const hasRTDKeyword = rtdKeywords.some(keyword => searchText.includes(keyword));
  
  // Exclude obvious non-alcoholic items but be less strict
  const isDefinitelyNonAlcoholic = (
    searchText.includes('orange juice') || 
    searchText.includes('apple juice') ||
    searchText.includes('cranberry juice') ||
    searchText.includes('simple syrup') ||
    searchText.includes('coca cola') ||
    searchText.includes('pepsi') ||
    searchText.includes('sprite')
  ) && !searchText.includes('hard') && !searchText.includes('alcoholic');
  
  return hasRTDKeyword && !isDefinitelyNonAlcoholic;
}

// — Load and parse CSV data —
let csvProducts = [];

function loadCSVData() {
  try {
    const csvData = fs.readFileSync('vertopal.com_LIQCODE (1).csv', 'utf8');
    const lines = csvData.split('\n');
    csvProducts = [];
    
    // Parse data lines (skip header)
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const fields = lines[i].split(',');
        if (fields.length > 12) {
          csvProducts.push({
            code_num: fields[0],
            barcode: fields[1],
            brand: fields[3],
            descrip: fields[4],
            type: fields[5],
            size: fields[6],
            price: parseFloat(fields[12]) || 0
          });
        }
      }
    }
    console.log(`✅ Loaded ${csvProducts.length} products from CSV`);
    
    // Count RTD products after loading
    const rtdCount = csvProducts.filter(product => isRTDProduct(product)).length;
    console.log(`🍹 Found ${rtdCount} RTD products during CSV load`);
  } catch (error) {
    console.error('❌ Failed to load CSV:', error.message);
  }
}

// Load CSV data on startup
loadCSVData();

// — Debug RTD products —
app.get('/api/debug-rtd', async (req, res) => {
  try {
    const rtdProducts = csvProducts.filter(product => isRTDProduct(product));
    
    console.log(`🔍 Found ${rtdProducts.length} RTD products by description analysis`);
    
    const sampleProducts = rtdProducts.slice(0, 10).map(product => ({
      type: product.type,
      brand: product.brand,
      descrip: product.descrip,
      size: product.size,
      price: product.price,
      tags: extractTagsFromBrand(`${product.brand} ${product.descrip}`, 'RTD')
    }));
    
    res.json({ 
      totalCount: rtdProducts.length, 
      detectionMethod: 'description-based',
      sampleProducts 
    });
  } catch (err) {
    console.error('Error in RTD debug:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Get category tags (extracted from real CSV data) —
app.get('/api/category-tags/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    let categoryProducts;
    
    if (category === 'RTD') {
      // RTD uses description-based detection
      categoryProducts = csvProducts.filter(product => isRTDProduct(product));
    } else {
      // Beer and Wine use type codes
      const typeCodes = TYPE_MAP[category];
      if (!typeCodes) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      categoryProducts = csvProducts.filter(product => 
        typeCodes.includes(product.type)
      );
    }

    // Extract unique tags from all products in this category
    const tagSet = new Set();
    categoryProducts.forEach(product => {
      const productTags = extractTagsFromBrand(`${product.brand} ${product.descrip}`, category);
      productTags.forEach(tag => tagSet.add(tag));
    });

    // Convert to sorted array
    const tags = Array.from(tagSet).sort();
    
    console.log(`📦 Returning ${tags.length} real tags for ${category}:`, tags);
    console.log(`🔍 ${category} category has ${categoryProducts.length} products`);
    res.json({ category, tags });
  } catch (err) {
    console.error('Error in GET /api/category-tags:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// — Recommendations endpoint (using real CSV data) —
app.get('/api/recommendations', async (req, res) => {
  try {
    const { category, maxPrice = 1000, limit = 5, tags } = req.query;
    console.log('🔍 /api/recommendations called with:', { category, maxPrice, limit, tags });

    // Parse selected tags
    const selectedTags = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    console.log('🏷️ Selected tags:', selectedTags);

    // Filter products by category
    let categoryProducts;
    
    if (category === 'RTD') {
      // RTD uses description-based detection
      categoryProducts = csvProducts.filter(product => isRTDProduct(product));
    } else {
      // Beer and Wine use type codes
      const typeCodes = TYPE_MAP[category];
      if (!typeCodes) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      categoryProducts = csvProducts.filter(product => 
        typeCodes.includes(product.type)
      );
    }

    // Apply pack filtering for Beer only (RTD products are often sold individually too)
    if (category === 'Beer') {
      categoryProducts = categoryProducts.filter(product => {
        const brand = product.brand.toLowerCase();
        const descrip = product.descrip.toLowerCase();
        const size = product.size.toLowerCase();
        
        return (
          size.includes('pk') || size.includes('pack') || size.includes('case') ||
          brand.includes('pack') || brand.includes('case') || brand.includes('variety') ||
          descrip.includes('pack') || descrip.includes('case') || descrip.includes('variety') ||
          size.includes('6') || size.includes('12') || size.includes('18') || size.includes('24')
        );
      });
    }
    
    // For RTD, we'll include both individual and pack items since they're commonly sold both ways

    // Filter by selected tags if any are provided
    if (selectedTags.length > 0) {
      categoryProducts = categoryProducts.filter(product => {
        const searchText = `${product.brand} ${product.descrip}`.toLowerCase();
        return selectedTags.some(tag => searchText.includes(tag));
      });
      console.log(`🎯 Filtered to ${categoryProducts.length} items matching tags: [${selectedTags.join(', ')}]`);
    }

    // Apply price filter
    categoryProducts = categoryProducts.filter(product => 
      product.price <= parseFloat(maxPrice) && product.price > 0
    );

    // Sort by price and take random sample for variety
    categoryProducts.sort(() => Math.random() - 0.5);
    
    // Apply limit
    const limitNum = parseInt(limit);
    const results = categoryProducts.slice(0, limitNum).map(product => ({
      id: product.code_num,
      name: `${product.brand} ${product.descrip}`.trim(),
      price: product.price,
      img: `https://via.placeholder.com/80?text=${encodeURIComponent(product.brand.split(' ')[0])}`,
      tags: extractTagsFromBrand(`${product.brand} ${product.descrip}`, category),
      size: product.size
    }));
    
    console.log(`✅ Returning ${results.length} real CSV results for ${category}`);
    res.json(results);

  } catch (err) {
    console.error('🔥 Error in /api/recommendations:', err);
    console.error('🔥 Stack trace:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Helper function to extract tags from brand name
const extractTagsFromBrand = (brandName, category) => {
  const lowerBrand = brandName.toLowerCase();
  const tags = [];
  
  if (category === 'Wine') {
    if (lowerBrand.includes('chardonnay')) tags.push('Chardonnay');
    if (lowerBrand.includes('cabernet') || lowerBrand.includes('cab sav')) tags.push('Cabernet Sauvignon');
    if (lowerBrand.includes('pinot noir')) tags.push('Pinot Noir');
    if (lowerBrand.includes('pinot grigio') || lowerBrand.includes('pinot gris')) tags.push('Pinot Grigio');
    if (lowerBrand.includes('merlot')) tags.push('Merlot');
    if (lowerBrand.includes('sauvignon blanc')) tags.push('Sauvignon Blanc');
    if (lowerBrand.includes('prosecco')) tags.push('Prosecco');
    if (lowerBrand.includes('champagne')) tags.push('Champagne');
    if (lowerBrand.includes('riesling')) tags.push('Riesling');
    if (lowerBrand.includes('moscato')) tags.push('Moscato');
    if (lowerBrand.includes('red') && !lowerBrand.includes('chardonnay')) tags.push('Red Blend');
    if (lowerBrand.includes('white') && !lowerBrand.includes('claw')) tags.push('White Blend');
  } else if (category === 'Beer') {
    if (lowerBrand.includes('lager') || lowerBrand.includes('corona') || lowerBrand.includes('stella')) tags.push('Lager');
    if (lowerBrand.includes('ipa') || lowerBrand.includes('pale ale')) tags.push('IPA');
    if (lowerBrand.includes('stout') || lowerBrand.includes('guinness')) tags.push('Stout');
    if (lowerBrand.includes('wheat') || lowerBrand.includes('blue moon')) tags.push('Wheat Beer');
    if (lowerBrand.includes('light')) tags.push('Light Beer');
    if (lowerBrand.includes('pilsner') || lowerBrand.includes('heineken')) tags.push('Pilsner');
  } else if (category === 'RTD') {
    if (lowerBrand.includes('seltzer') || lowerBrand.includes('white claw') || lowerBrand.includes('truly')) tags.push('Hard Seltzer');
    if (lowerBrand.includes('vodka')) tags.push('Vodka Mix');
    if (lowerBrand.includes('margarita')) tags.push('Margarita');
    if (lowerBrand.includes('mojito')) tags.push('Mojito');
    if (lowerBrand.includes('smirnoff')) tags.push('Flavored Malt');
  }
  
  return tags;
};

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
