const cron = require('node-cron');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';

/**
 * Cron job per aggiornare le offerte ogni 2 ore
 */
function setupCronJobs() {
  // Refresh deals every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    console.log('⏰ Cron: Running scheduled refresh (every 2 hours)');
    try {
      const response = await axios.get(`${API_URL}/api/deals/refresh`);
      console.log('✅ Cron refresh completed:', response.data);
    } catch (error) {
      console.error('❌ Cron refresh failed:', error.message);
    }
  });

  console.log('⏰ Cron jobs scheduled:');
  console.log('   - Deals refresh: every 2 hours (0 */2 * * *)');
}

// If running standalone
if (require.main === module) {
  console.log('🕐 Starting cron service...');
  setupCronJobs();

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('👋 Cron service shutting down');
    process.exit(0);
  });
}

module.exports = { setupCronJobs };
