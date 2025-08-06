const express = require('express');
const cors = require('cors');  
const app = express();
app.use(cors());     
// Health check
app.get('/', (req, res) => res.send('🖐️ SipBuddy backend alive!'));

// Quantity estimator endpoint
app.get('/estimate/quantity', (req, res) => {
  // Pull query params (defaulting if missing)
  const guestCount = Number(req.query.guestCount) || 10;
  const duration = Number(req.query.duration) || 4; // hours
  // Simple formula: 0.5 liters per guest per hour
  const estimatedLiters = guestCount * duration * 0.5;

  res.json({ guestCount, duration, estimatedLiters });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
}

module.exports = app;
