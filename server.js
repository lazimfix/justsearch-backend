const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// 1. SECURITY & PROTOCOL HEADERS (HELMET)
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false, // Set strictly if serving HTML; disabled for JSON APIs
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Request Body limits to prevent memory exhaustion attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ==========================================
// 2. CORS SECURITY (ALLOWED ORIGINS ONLY)
// ==========================================
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or in whitelist
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    const err = new Error('CORS Policy: Access denied for this origin.');
    err.status = 403;
    return callback(err);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key'],
  credentials: true,
  maxAge: 86400 // Cache preflight for 24 hours
}));

// ==========================================
// 3. RATE LIMITING (ANTI-DDOS & BRUTE FORCE)
// ==========================================
// Global limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api/', globalLimiter);

// Strict limiter for Lead / Contact submissions: 5 requests per 15 minutes
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'You have submitted too many inquiries recently. Please contact us directly via WhatsApp.'
  }
});

// In-Memory Secure Store (or fallback for demo; easily swapped with Supabase/PostgreSQL)
const leadsStore = [];

// ==========================================
// 4. TIMING-SAFE API KEY AUTHENTICATION
// ==========================================
function verifyAdminApiKey(req, res, next) {
  const clientKey = req.headers['x-admin-api-key'];
  const serverKey = process.env.ADMIN_API_KEY;

  if (!serverKey) {
    return res.status(500).json({ success: false, error: 'Server authentication unconfigured' });
  }

  if (!clientKey) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing API Key' });
  }

  // Prevent timing attacks using crypto.timingSafeEqual
  const clientBuf = Buffer.from(String(clientKey));
  const serverBuf = Buffer.from(String(serverKey));

  if (clientBuf.length !== serverBuf.length || !crypto.timingSafeEqual(clientBuf, serverBuf)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid API Key' });
  }

  next();
}

// ==========================================
// 5. FREE NOTIFICATION DISPATCHER (TELEGRAM)
// Connected Bot: https://t.me/justsearchweb_bot (@justsearchweb_bot)
// ==========================================
const TELEGRAM_CONFIG = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '8813932843:AAEEl0FbdmsaTa8WlJh0O4_TzuqLR8GqNL4',
  chatId: process.env.TELEGRAM_CHAT_ID || '8664823234',
  botUrl: process.env.TELEGRAM_BOT_URL || 'https://t.me/justsearchweb_bot',
  botUsername: 'justsearchweb_bot'
};

async function sendTelegramAlert(leadData) {
  const botToken = TELEGRAM_CONFIG.botToken;
  const chatId = TELEGRAM_CONFIG.chatId;

  if (!botToken || !chatId) {
    console.log('[Notification] Telegram Bot credentials not configured. Skipping alert.');
    return;
  }

  const text = `🚀 *NEW WEBSITE LEAD RECEIVED!*\n\n` +
    `👤 *Name:* ${leadData.name}\n` +
    `📱 *Phone/WhatsApp:* ${leadData.phone}\n` +
    `📧 *Email:* ${leadData.email}\n` +
    `💼 *Service:* ${leadData.service}\n` +
    `💰 *Package:* ${leadData.package}\n` +
    `📝 *Message:* ${leadData.message}\n` +
    `⏰ *Time:* ${new Date().toISOString()}`;

  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    // Fallback native fetch in Node 18+
    const fetchFunc = global.fetch || fetch;
    
    await fetchFunc(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
    console.log('[Notification] Telegram alert sent successfully.');
  } catch (err) {
    console.error('[Notification Error] Failed to send Telegram alert:', err.message);
  }
}

// ==========================================
// 6. ROUTES
// ==========================================

// Health Check Endpoint (For monitoring & keeping free cloud servers awake)
app.get('/health', (req, res) => {
  res.status(200).json({
    telegram: {
      bot: '@justsearchweb_bot',
      url: 'https://t.me/justsearchweb_bot',
      configured: Boolean(TELEGRAM_CONFIG.botToken && TELEGRAM_CONFIG.chatId)
    },
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's'
  });
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    telegram: {
      bot: '@justsearchweb_bot',
      url: 'https://t.me/justsearchweb_bot',
      configured: Boolean(TELEGRAM_CONFIG.botToken && TELEGRAM_CONFIG.chatId)
    },
    service: 'Just Search Web Design LLC - Secure Agency API',
    version: '1.0.0',
    documentation: '/api/v1/health'
  });
});

// Contact / Lead Intake Endpoint
app.post('/api/v1/contact', contactLimiter, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      package: selectedPackage,
      message,
      _hp_website // HONEYPOT FIELD: Spambots will fill this hidden field!
    } = req.body;

    // A. HONEYPOT CHECK: If invisible bot field has content, silently discard!
    if (_hp_website && _hp_website.trim().length > 0) {
      console.warn('[Security Warning] Bot honeypot triggered. Request dropped silently.');
      return res.status(200).json({
    telegram: {
      bot: '@justsearchweb_bot',
      url: 'https://t.me/justsearchweb_bot',
      configured: Boolean(TELEGRAM_CONFIG.botToken && TELEGRAM_CONFIG.chatId)
    }, success: true, message: 'Inquiry received successfully.' });
    }

    // B. INPUT VALIDATION & SANITIZATION
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
      return res.status(400).json({ success: false, error: 'Please provide a valid name (2-60 characters).' });
    }

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7 || phone.trim().length > 20) {
      return res.status(400).json({ success: false, error: 'Please provide a valid contact/WhatsApp phone number.' });
    }

    // Sanitize inputs (escape dangerous HTML to prevent stored XSS)
    const sanitizedLead = {
      id: crypto.randomUUID(),
      name: validator.escape(name.trim()),
      email: validator.normalizeEmail(email.trim()),
      phone: validator.escape(phone.trim()),
      service: service ? validator.escape(String(service).trim()) : 'General Inquiries',
      package: selectedPackage ? validator.escape(String(selectedPackage).trim()) : 'AED 799 Deal',
      message: message ? validator.escape(String(message).trim().slice(0, 1000)) : 'No message provided',
      ip: req.ip || req.connection.remoteAddress,
      createdAt: new Date().toISOString()
    };

    // Save lead (Store in memory, or insert into Supabase / MongoDB)
    leadsStore.unshift(sanitizedLead);
    if (leadsStore.length > 500) leadsStore.pop(); // Keep bounded

    // Dispatch instant free notification in background
    sendTelegramAlert(sanitizedLead);

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your inquiry has been received. Our web specialist will contact you shortly.',
      leadId: sanitizedLead.id
    });

  } catch (error) {
    console.error('[Server Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred. Please reach out to us directly via WhatsApp.'
    });
  }
});

// Admin Endpoint: View recent leads (Protected by API Key)
app.get('/api/v1/leads', verifyAdminApiKey, (req, res) => {
  res.status(200).json({
    telegram: {
      bot: '@justsearchweb_bot',
      url: 'https://t.me/justsearchweb_bot',
      configured: Boolean(TELEGRAM_CONFIG.botToken && TELEGRAM_CONFIG.chatId)
    },
    success: true,
    total: leadsStore.length,
    leads: leadsStore
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global Error Handler (Never leaks stack trace in production)
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server security error' : err.message
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Production Security Server] Listening on port ${PORT}`);
  });
}

module.exports = app;
