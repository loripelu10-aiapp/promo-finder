/**
 * PromoFinder Region-Aware API Server
 *
 * Serves products from database with multi-region support
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const dealsRoutes = require('./routes/deals');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'PromoFinder Region-Aware API',
    version: '2.0.0',
    description: 'Multi-region product deals API with location-aware filtering',
    endpoints: {
      deals: '/api/deals?region=EU',
      stats: '/api/deals/stats?region=EU',
      regions: '/api/deals/regions',
      health: '/health'
    },
    examples: {
      euDeals: '/api/deals?region=EU&minDiscount=20',
      ukDeals: '/api/deals?region=UK',
      usDeals: '/api/deals?region=US',
      globalDeals: '/api/deals?region=GLOBAL',
      nikeOnly: '/api/deals?source=nike',
      shoes: '/api/deals?category=shoes'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/deals', dealsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Endpoint ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(80));
  console.log('🌍 PromoFinder Region-Aware API Server');
  console.log('='.repeat(80));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 API Docs: http://localhost:${PORT}/`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`   GET /api/deals?region=EU           - Get EU deals`);
  console.log(`   GET /api/deals?region=UK           - Get UK deals`);
  console.log(`   GET /api/deals?region=US           - Get US deals`);
  console.log(`   GET /api/deals/stats?region=EU     - Get EU stats`);
  console.log(`   GET /api/deals/regions             - List all regions`);
  console.log('');
  console.log('💡 Examples:');
  console.log(`   curl http://localhost:${PORT}/api/deals?region=EU&minDiscount=30`);
  console.log(`   curl http://localhost:${PORT}/api/deals/stats?region=UK`);
  console.log(`   curl http://localhost:${PORT}/api/deals/regions`);
  console.log('');
  console.log('='.repeat(80));
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
