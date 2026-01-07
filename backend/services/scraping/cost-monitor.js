const fs = require('fs').promises;
const path = require('path');

/**
 * Cost Monitor for Claude API Usage
 *
 * Tracks API calls, calculates costs, and alerts/stops if spending exceeds limits
 */
class CostMonitor {
  constructor(config = {}) {
    this.config = {
      maxDailyCost: parseFloat(process.env.MAX_DAILY_API_COST) || 1.00, // $1/day default
      alertThreshold: parseFloat(process.env.ALERT_THRESHOLD) || 0.50,   // $0.50/day default
      logPath: path.join(__dirname, '../../logs/api-costs.json'),
      ...config
    };

    // Claude 3.5 Sonnet pricing (as of Jan 2026)
    this.pricing = {
      model: 'claude-3-5-sonnet-20241022',
      inputCostPerMillion: 3.00,    // $3 per million input tokens
      outputCostPerMillion: 15.00,  // $15 per million output tokens
      imageCostPerToken: 0.000003   // Approximate cost per image token
    };

    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalImageTokens: 0,
      totalCost: 0,
      calls: []
    };

    this.alertSent = false;
    this.stopped = false;
  }

  /**
   * Load today's stats from disk
   */
  async loadStats() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Ensure logs directory exists
      const logsDir = path.dirname(this.config.logPath);
      await fs.mkdir(logsDir, { recursive: true });

      // Try to load existing stats
      const data = await fs.readFile(this.config.logPath, 'utf8');
      const stats = JSON.parse(data);

      // Reset if different day
      if (stats.date !== today) {
        this.dailyStats.date = today;
        this.resetDailyStats();
        await this.saveStats();
      } else {
        this.dailyStats = stats;
      }
    } catch (error) {
      // File doesn't exist or invalid, start fresh
      await this.saveStats();
    }
  }

  /**
   * Save stats to disk
   */
  async saveStats() {
    try {
      const logsDir = path.dirname(this.config.logPath);
      await fs.mkdir(logsDir, { recursive: true });
      await fs.writeFile(this.config.logPath, JSON.stringify(this.dailyStats, null, 2));
    } catch (error) {
      console.error('❌ Failed to save cost stats:', error.message);
    }
  }

  /**
   * Reset daily stats
   */
  resetDailyStats() {
    this.dailyStats = {
      date: new Date().toISOString().split('T')[0],
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalImageTokens: 0,
      totalCost: 0,
      calls: []
    };
    this.alertSent = false;
    this.stopped = false;
  }

  /**
   * Calculate cost for a Claude API call
   */
  calculateCost(usage) {
    const inputCost = (usage.input_tokens / 1000000) * this.pricing.inputCostPerMillion;
    const outputCost = (usage.output_tokens / 1000000) * this.pricing.outputCostPerMillion;

    // Estimate image tokens (images are expensive - roughly 1000-2000 tokens per image)
    const imageCost = usage.hasImage ? 0.01 : 0; // Rough estimate

    return inputCost + outputCost + imageCost;
  }

  /**
   * Track an API call
   */
  async trackCall(callInfo) {
    await this.loadStats();

    const cost = this.calculateCost(callInfo.usage);

    this.dailyStats.totalCalls++;
    this.dailyStats.totalInputTokens += callInfo.usage.input_tokens;
    this.dailyStats.totalOutputTokens += callInfo.usage.output_tokens;
    if (callInfo.usage.hasImage) {
      this.dailyStats.totalImageTokens += 1500; // Estimate
    }
    this.dailyStats.totalCost += cost;

    this.dailyStats.calls.push({
      timestamp: new Date().toISOString(),
      scraper: callInfo.scraper,
      method: callInfo.method, // 'screenshot' or 'text'
      inputTokens: callInfo.usage.input_tokens,
      outputTokens: callInfo.usage.output_tokens,
      hasImage: callInfo.usage.hasImage || false,
      cost: cost
    });

    await this.saveStats();

    // Check thresholds
    await this.checkThresholds();

    return {
      callCost: cost,
      dailyTotal: this.dailyStats.totalCost,
      remaining: this.config.maxDailyCost - this.dailyStats.totalCost
    };
  }

  /**
   * Check if thresholds exceeded
   */
  async checkThresholds() {
    const { totalCost } = this.dailyStats;
    const { maxDailyCost, alertThreshold } = this.config;

    // Alert threshold reached
    if (!this.alertSent && totalCost >= alertThreshold) {
      this.alertSent = true;
      console.log('\n╔══════════════════════════════════════════════════════════════════╗');
      console.log('║                    ⚠️  COST ALERT                                ║');
      console.log('╚══════════════════════════════════════════════════════════════════╝');
      console.log(`💰 Daily spending: $${totalCost.toFixed(4)}`);
      console.log(`🎯 Alert threshold: $${alertThreshold.toFixed(2)}`);
      console.log(`🚨 Max daily limit: $${maxDailyCost.toFixed(2)}`);
      console.log(`📊 Calls today: ${this.dailyStats.totalCalls}`);
      console.log(`⏰ Time: ${new Date().toISOString()}\n`);
    }

    // Max limit reached - STOP
    if (!this.stopped && totalCost >= maxDailyCost) {
      this.stopped = true;
      console.log('\n╔══════════════════════════════════════════════════════════════════╗');
      console.log('║               🛑 MAXIMUM DAILY COST REACHED                      ║');
      console.log('╚══════════════════════════════════════════════════════════════════╝');
      console.log(`💰 Daily spending: $${totalCost.toFixed(4)}`);
      console.log(`🚨 Max daily limit: $${maxDailyCost.toFixed(2)}`);
      console.log(`📊 Total API calls today: ${this.dailyStats.totalCalls}`);
      console.log(`📝 Input tokens: ${this.dailyStats.totalInputTokens.toLocaleString()}`);
      console.log(`📝 Output tokens: ${this.dailyStats.totalOutputTokens.toLocaleString()}`);
      console.log('');
      console.log('🛑 AUTO-SCRAPING STOPPED TO PREVENT OVERSPENDING');
      console.log('');
      console.log('To continue scraping:');
      console.log('1. Review costs in: ' + this.config.logPath);
      console.log('2. Increase MAX_DAILY_API_COST in .env if acceptable');
      console.log('3. Restart the server\n');

      throw new Error('DAILY_COST_LIMIT_EXCEEDED');
    }
  }

  /**
   * Check if stopped
   */
  isStopped() {
    return this.stopped;
  }

  /**
   * Get current stats
   */
  async getStats() {
    await this.loadStats();
    return {
      ...this.dailyStats,
      limits: {
        maxDailyCost: this.config.maxDailyCost,
        alertThreshold: this.config.alertThreshold
      },
      status: {
        alertSent: this.alertSent,
        stopped: this.stopped,
        percentUsed: (this.dailyStats.totalCost / this.config.maxDailyCost) * 100
      },
      estimates: {
        avgCostPerCall: this.dailyStats.totalCalls > 0
          ? this.dailyStats.totalCost / this.dailyStats.totalCalls
          : 0,
        remainingCalls: this.dailyStats.totalCalls > 0
          ? Math.floor((this.config.maxDailyCost - this.dailyStats.totalCost) /
            (this.dailyStats.totalCost / this.dailyStats.totalCalls))
          : 0
      }
    };
  }

  /**
   * Format cost report
   */
  async formatReport() {
    const stats = await this.getStats();

    return `
╔══════════════════════════════════════════════════════════════════╗
║                    CLAUDE API COST REPORT                        ║
╚══════════════════════════════════════════════════════════════════╝

📅 Date: ${stats.date}
💰 Total Cost: $${stats.totalCost.toFixed(4)}
📊 Total Calls: ${stats.totalCalls}

Token Usage:
  📝 Input:  ${stats.totalInputTokens.toLocaleString()} tokens
  📝 Output: ${stats.totalOutputTokens.toLocaleString()} tokens
  🖼️  Images: ${stats.totalImageTokens.toLocaleString()} tokens (estimated)

Limits:
  🎯 Alert Threshold: $${stats.limits.alertThreshold.toFixed(2)} ${stats.alertSent ? '⚠️ REACHED' : '✅'}
  🚨 Daily Max: $${stats.limits.maxDailyCost.toFixed(2)} ${stats.stopped ? '🛑 REACHED' : '✅'}
  📊 Used: ${stats.status.percentUsed.toFixed(1)}%

Estimates:
  💵 Avg Cost/Call: $${stats.estimates.avgCostPerCall.toFixed(4)}
  🔢 Remaining Calls: ~${stats.estimates.remainingCalls}
  💰 Remaining Budget: $${(stats.limits.maxDailyCost - stats.totalCost).toFixed(4)}

Status: ${stats.stopped ? '🛑 STOPPED' : '✅ Active'}
`;
  }
}

// Singleton instance
let monitorInstance = null;

/**
 * Get or create cost monitor instance
 */
function getCostMonitor() {
  if (!monitorInstance) {
    monitorInstance = new CostMonitor();
  }
  return monitorInstance;
}

module.exports = {
  CostMonitor,
  getCostMonitor
};
