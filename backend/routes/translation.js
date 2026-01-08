/**
 * Translation API Routes
 * Endpoints for on-demand translation and cache management
 */

const express = require('express');
const router = express.Router();

// Translation service will be initialized in server.js and passed here
let translator = null;

/**
 * Initialize translator instance
 */
function initTranslator(translatorInstance) {
  translator = translatorInstance;
}

/**
 * POST /api/translate
 * Translate text or product to target language
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, texts, sourceLang, targetLang, type } = req.body;

    if (!translator) {
      return res.status(503).json({
        success: false,
        message: 'Translation service not initialized',
      });
    }

    // Validate languages
    const validLangs = ['en', 'it', 'es', 'fr', 'de', 'pt'];
    if (!validLangs.includes(targetLang)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target language. Must be one of: ${validLangs.join(', ')}`,
      });
    }

    // Single text translation
    if (text) {
      const result = await translator.translateText(
        text,
        sourceLang || 'en',
        targetLang
      );

      return res.json({
        success: true,
        translation: result,
        sourceLang: sourceLang || 'en',
        targetLang,
      });
    }

    // Batch translation
    if (texts && Array.isArray(texts)) {
      const results = await translator.batchTranslate(
        texts,
        sourceLang || 'en',
        targetLang
      );

      return res.json({
        success: true,
        translations: results,
        sourceLang: sourceLang || 'en',
        targetLang,
        count: results.length,
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Missing required fields: text or texts',
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Translation failed',
      error: error.message,
    });
  }
});

/**
 * POST /api/translate/product
 * Translate a product to target language
 */
router.post('/translate/product', async (req, res) => {
  try {
    const { product, targetLang } = req.body;

    if (!translator) {
      return res.status(503).json({
        success: false,
        message: 'Translation service not initialized',
      });
    }

    if (!product || !targetLang) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: product, targetLang',
      });
    }

    const translatedProduct = await translator.translateProduct(product, targetLang);

    return res.json({
      success: true,
      product: translatedProduct,
      targetLang,
    });
  } catch (error) {
    console.error('Product translation API error:', error);
    return res.status(500).json({
      success: false,
      message: 'Product translation failed',
      error: error.message,
    });
  }
});

/**
 * GET /api/translations/:lang
 * Get all translations for a language (loads locale files)
 */
router.get('/translations/:lang', async (req, res) => {
  try {
    const { lang } = req.params;
    const validLangs = ['en', 'it', 'es', 'fr', 'de', 'pt'];

    if (!validLangs.includes(lang)) {
      return res.status(400).json({
        success: false,
        message: `Invalid language. Must be one of: ${validLangs.join(', ')}`,
      });
    }

    // Load locale files
    const fs = require('fs');
    const path = require('path');
    const localesPath = path.join(__dirname, '../../shared/locales', lang);

    const translations = {};

    // Read all JSON files in the language directory
    const files = fs.readdirSync(localesPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const namespace = file.replace('.json', '');
        const content = fs.readFileSync(path.join(localesPath, file), 'utf-8');
        translations[namespace] = JSON.parse(content);
      }
    }

    return res.json({
      success: true,
      language: lang,
      translations,
    });
  } catch (error) {
    console.error('Get translations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load translations',
      error: error.message,
    });
  }
});

/**
 * GET /api/translate/stats
 * Get translation cache statistics
 */
router.get('/translate/stats', async (req, res) => {
  try {
    if (!translator) {
      return res.status(503).json({
        success: false,
        message: 'Translation service not initialized',
      });
    }

    const stats = await translator.getCacheStats();

    return res.json({
      success: true,
      provider: translator.getProviderName(),
      cache: stats,
    });
  } catch (error) {
    console.error('Translation stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get translation stats',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/translate/cache
 * Clear translation cache
 */
router.delete('/translate/cache', async (req, res) => {
  try {
    if (!translator) {
      return res.status(503).json({
        success: false,
        message: 'Translation service not initialized',
      });
    }

    await translator.clearCache();

    return res.json({
      success: true,
      message: 'Translation cache cleared',
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message,
    });
  }
});

module.exports = { router, initTranslator };
