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
      
      
      
      console.log('✅  Database tables verified/created');
    } catch (tableErr) {
      console.warn('⚠️  Table creation warning:', tableErr.message);
    }
    
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
  }
})();



// — Map UI categories to product_type from CSV —
const TYPE_MAP = {
  Beer: [
    'beer > ipa',
    'beer > lager',
    'beer > stout',
    'beer > wheat',
    'beer > cider',
    'beer > pale ale',
    'beer > double ipa',
    'beer > sour',
    'beer > fruit beer',
    'beer > imported beer',
    'beer > vienna lager',
    'beer > trappist ale',
    'beer > seasonal',
    'beer > non alcoholic',
    'beer > flavored malt beverage',
    'beer > seltzer',
    'beer'
  ],
  Wine: [
    'wine > red',
    'wine > white',
    'wine > sparkling',
    'wine > rose',
    'wine > port',
    'wine > dessert',
    'wine > orange',
    'wine > fortified',
    'wine > kosher',
    'wine',
    'spirits > sake',
    'spirits > soju'
  ],
  RTD: [
    'spirits > rtd',
    'spirits > vodka',
    'spirits > whiskey',
    'spirits > cocktail',
    'spirits'
  ]
};

// — Helper function to identify RTD products by description —
function isRTDProduct(product) {
  const searchText = `${product.title} ${product.description}`.toLowerCase();
  
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
    const csvData = fs.readFileSync('products.csv', 'utf8');
    const lines = csvData.split('\n');
    csvProducts = [];
    
    // Assuming the first line is a header
    const headers = lines[0].split(/,(?=(?:(?:[^\"]*"){2})*[^\"]*$)/).map(header => header.trim());

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        // Split by comma, but only if not inside double quotes
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(value => value.trim());
        const product = {};
        headers.forEach((header, index) => {
          // Remove leading/trailing quotes from values
          product[header] = values[index] ? values[index].replace(/^"|"$/g, '') : '';
        });
        
        // Dynamically assign image_link and product_link based on CSV headers
        const imageLinkIndex = headers.indexOf('image_link');
        const productLinkIndex = headers.indexOf('link'); // Assuming 'link' is the header for product_link

        let imageUrl = imageLinkIndex !== -1 && values[imageLinkIndex] ? values[imageLinkIndex].replace(/^"|"$/g, '') : '';
        let productLink = productLinkIndex !== -1 && values[productLinkIndex] ? values[productLinkIndex].replace(/^"|"$/g, '') : '';

        console.log('Parsed imageUrl:', imageUrl);
        console.log('Parsed productLink:', productLink);

        // Basic validation for image_link
        if (!imageUrl || imageUrl === 'in_stock' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
          imageUrl = 'https://picsum.photos/150'; // Placeholder image
        }

        // Map CSV fields to expected product structure
        csvProducts.push({
          id: product.id,
          title: product.title,
          description: product.description,
          brand: product.brand,
          price: parseFloat(product.price) || 0,
          image_link: imageUrl, // Use validated image URL
          product_link: productLink,
          product_type: product.product_type.toLowerCase() // Use product_type for categorization
        });
        
      }
    }
    console.log(`✅ Loaded ${csvProducts.length} products from products.csv`);
    
    // Count RTD products after loading
    const rtdCount = csvProducts.filter(product => isRTDProduct(product)).length;
    console.log(`🍹 Found ${rtdCount} RTD products during CSV load`);
  } catch (error) {
    console.error('❌ Failed to load products.csv:', error.message);
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
      id: product.id,
      title: product.title,
      brand: product.brand,
      description: product.description,
      price: product.price,
      image_link: product.image_link,
      tags: extractTagsFromBrand(`${product.brand} ${product.title}`, 'RTD')
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
    
    const targetTypes = TYPE_MAP[category];
    if (!targetTypes) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    categoryProducts = csvProducts.filter(product => 
      targetTypes.some(type => product.product_type.includes(type))
    );

    // Extract unique tags from all products in this category
    const tagSet = new Set();
    categoryProducts.forEach(product => {
      const productTags = extractTagsFromBrand(`${product.brand} ${product.title}`, category);
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
    // For now, return data from csvProducts as LIQCODE table is removed
    const items = csvProducts.map(product => ({
      code_num: product.id,
      name: product.title,
      price: product.price,
      size: product.size || '',
      promotion: 0, // Default value
      hot: 0,       // Default value
      first_seen: '', // Default value
      last_purchase: '' // Default value
    }));
    res.json(items);
  } catch (err) {
    console.error('Error in GET /api/admin/items:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// — Admin: update one item’s flags —
app.post('/api/admin/item/:code', async (req, res) => {
  try {
    // This endpoint would ideally update a database.
    // For now, we'll just log the update as LIQCODE table is removed.
    const { code } = req.params;
    const { promotion, hot, first_seen, last_purchase } = req.body;
    console.log(`Admin update for item ${code}: promotion=${promotion}, hot=${hot}, first_seen=${first_seen}, last_purchase=${last_purchase}`);
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
    
    const targetTypes = TYPE_MAP[category];
    if (!targetTypes) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    categoryProducts = csvProducts.filter(product => 
      targetTypes.some(type => product.product_type.includes(type))
    );

    // Apply pack filtering for Beer only (RTD products are often sold individually too)
    if (category === 'Beer') {
      categoryProducts = categoryProducts.filter(product => {
        const title = product.title.toLowerCase();
        const description = product.description.toLowerCase();
        const size = (product.size || '').toLowerCase();
        
        return (
          size.includes('pk') || size.includes('pack') || size.includes('case') ||
          title.includes('pack') || title.includes('case') || title.includes('variety') ||
          description.includes('pack') || description.includes('case') || description.includes('variety') ||
          size.includes('6') || size.includes('12') || size.includes('18') || size.includes('24')
        );
      });
    }
    
    // For RTD, we'll include both individual and pack items since they're commonly sold both ways

    // Filter by selected tags if any are provided
    if (selectedTags.length > 0) {
      categoryProducts = categoryProducts.filter(product => {
        const searchText = `${product.brand} ${product.title} ${product.description}`.toLowerCase();
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
      id: product.id,
      name: product.title.trim(),
      price: product.price,
      img: product.image_link, // Use image_link from CSV
      tags: extractTagsFromBrand(`${product.brand} ${product.title}`, category),
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
const extractTagsFromBrand = (product, category) => {
  const searchText = `${product.brand} ${product.title} ${product.description}`.toLowerCase();
  const tags = [];
  
  if (category === 'Wine') {
    if (searchText.includes('chardonnay')) tags.push('Chardonnay');
    if (searchText.includes('cabernet') || searchText.includes('cab sav')) tags.push('Cabernet Sauvignon');
    if (searchText.includes('pinot noir')) tags.push('Pinot Noir');
    if (searchText.includes('pinot grigio') || searchText.includes('pinot gris')) tags.push('Pinot Grigio');
    if (searchText.includes('merlot')) tags.push('Merlot');
    if (searchText.includes('sauvignon blanc')) tags.push('Sauvignon Blanc');
    if (searchText.includes('prosecco')) tags.push('Prosecco');
    if (searchText.includes('champagne')) tags.push('Champagne');
    if (searchText.includes('riesling')) tags.push('Riesling');
    if (searchText.includes('moscato')) tags.push('Moscato');
    if (searchText.includes('red') && !searchText.includes('chardonnay')) tags.push('Red Blend');
    if (searchText.includes('white') && !searchText.includes('claw')) tags.push('White Blend');
  } else if (category === 'Beer') {
    if (searchText.includes('lager') || searchText.includes('corona') || searchText.includes('stella')) tags.push('Lager');
    if (searchText.includes('ipa') || searchText.includes('pale ale')) tags.push('IPA');
    if (searchText.includes('stout') || searchText.includes('guinness')) tags.push('Stout');
    if (searchText.includes('wheat') || searchText.includes('blue moon')) tags.push('Wheat Beer');
    if (searchText.includes('light')) tags.push('Light Beer');
    if (searchText.includes('pilsner') || searchText.includes('heineken')) tags.push('Pilsner');
  } else if (category === 'RTD') {
    if (searchText.includes('seltzer') || searchText.includes('white claw') || searchText.includes('truly')) tags.push('Hard Seltzer');
    if (searchText.includes('vodka')) tags.push('Vodka Mix');
    if (searchText.includes('margarita')) tags.push('Margarita');
    if (searchText.includes('mojito')) tags.push('Mojito');
    if (searchText.includes('smirnoff')) tags.push('Flavored Malt');
    if (searchText.includes('iced tea')) tags.push('Iced Tea');
    if (searchText.includes('lemonade')) tags.push('Lemonade');
    if (searchText.includes('cocktail')) tags.push('Cocktail');
  }
  
  return tags;
};

app.get('/api/products', (req, res) => {
  res.json(csvProducts);
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
    // Since LIQCODE table is removed, we report based on CSV data
    const liqcode_exists = csvProducts.length > 0;
    const liqcode_count = csvProducts.length;
    const sample_data = csvProducts.slice(0, 3).map(p => ({ code_num: p.id, brand: p.brand, type: p.product_type, price: p.price, size: p.size }));

    // Check weights table
    const [weightsResult] = await pool.query('SELECT COUNT(*) as count FROM recommendation_weights');
    const weightsCount = weightsResult[0].count;
    
    res.json({
      liqcode_exists: liqcode_exists,
      liqcode_count: liqcode_count,
      weights_count: weightsCount,
      sample_products: sample_data
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// — Test simple query —
app.get('/api/test-beer', async (req, res) => {
  try {
    const beerProducts = csvProducts.filter(p => p.product_type.includes('beer')).slice(0, 3);
    res.json({ count: beerProducts.length, data: beerProducts });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.stack });
  }
});

// — Debug endpoint to check all data —
app.get('/api/debug', async (req, res) => {
  try {
    res.json({ 
      total_products: csvProducts.length,
      beer_count: csvProducts.filter(p => p.product_type.includes('beer')).length,
      wine_count: csvProducts.filter(p => p.product_type.includes('wine')).length, 
      rtd_count: csvProducts.filter(p => isRTDProduct(p)).length,
      sample_data: csvProducts.slice(0, 5).map(p => ({ id: p.id, title: p.title, product_type: p.product_type, price: p.price }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
});
