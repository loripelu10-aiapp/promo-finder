console.log('Starting test...');

try {
  const REAL_PRODUCTS = require('./data/real-products.json');
  console.log('✅ Real products loaded:', REAL_PRODUCTS.length);

  const express = require('express');
  console.log('✅ Express loaded');

  const app = express();
  console.log('✅ App created');

  app.get('/test', (req, res) => {
    res.json({ test: 'ok', products: REAL_PRODUCTS.length });
  });

  app.listen(3001, () => {
    console.log('✅ Server listening on 3001');
    console.log('Test: http://localhost:3001/test');
  });

} catch (err) {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
}
