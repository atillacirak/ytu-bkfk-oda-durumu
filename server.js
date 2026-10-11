const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1911';

const CLUB_INFO = {
  name: process.env.CLUB_NAME || 'YTÜ BKFK',
  fullName: process.env.CLUB_FULL_NAME || 'Yıldız Teknik Üniversitesi Bilim Kurgu ve Fantastik Kurgu Kulübü',
  location: process.env.ROOM_LOCATION || 'Davutpaşa Kampüsü, Kulüpler Binası'
};

const DATA_DIR = path.join(__dirname, 'data');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial status default values
const defaultStatus = {
  isOpen: true,
  occupancy: 'empty', // 'empty' | 'moderate' | 'full'
  activity: 'Kutu Oyunları & Muhabbet',
  responsible: 'Nöbetçi YK',
  note: 'Kulüp odasındayız, boyut kapısı açık! Çayımız var, bekleriz.',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Yönetim Kurulu',
  history: []
};

// Load or initialize status
let currentStatus = { ...defaultStatus };

function loadStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const raw = fs.readFileSync(STATUS_FILE, 'utf-8');
      currentStatus = { ...defaultStatus, ...JSON.parse(raw) };
    } else {
      saveStatus(currentStatus);
    }
  } catch (err) {
    console.error('Durum dosyası okunurken hata:', err.message);
  }
}

function saveStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch (err) {
    console.error('Durum kaydedilirken hata:', err.message);
  }
}

loadStatus();

// SSE Clients List
const sseClients = new Set();

function broadcastStatus() {
  const payload = `data: ${JSON.stringify({
    type: 'STATUS_UPDATE',
    status: currentStatus,
    timestamp: Date.now()
  })}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Helper
function verifyPin(req) {
  const pinHeader = req.headers['x-admin-pin'];
  const pinBody = req.body && req.body.pin;
  const pinQuery = req.query && req.query.pin;
  
  let cookiePin = null;
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)bkfk_admin_pin=([^;]+)/);
    if (match) {
      try {
        cookiePin = decodeURIComponent(match[1]);
      } catch {
        cookiePin = match[1];
      }
    }
  }

  const pin = pinHeader || pinBody || pinQuery || cookiePin;
  return pin && String(pin).trim() === String(ADMIN_PIN).trim();
}

// Routes

// 1. Get Current Status & Club Info
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    club: CLUB_INFO,
    data: currentStatus
  });
});

// 2. Verify Admin PIN
app.post('/api/verify-pin', (req, res) => {
  const isValid = verifyPin(req);
  if (isValid) {
    const pin = (req.body && req.body.pin) || req.headers['x-admin-pin'] || ADMIN_PIN;
    res.setHeader('Set-Cookie', `bkfk_admin_pin=${encodeURIComponent(pin)}; Path=/; Max-Age=31536000; SameSite=Lax`);
    res.json({ success: true, message: 'YK Kimlik Doğrulaması Başarılı' });
  } else {
    res.status(401).json({ success: false, message: 'Geçersiz YK PIN Kodu' });
  }
});

// 3. Update Status (YK Protected)
app.post('/api/status', (req, res) => {
  if (!verifyPin(req)) {
    return res.status(401).json({
      success: false,
      message: 'Yetkisiz erişim. Geçerli bir YK PIN kodu gereklidir.'
    });
  }

  const { isOpen, occupancy, activity, responsible, note, updatedBy } = req.body;

  // Validation
  const validOccupancies = ['empty', 'moderate', 'full'];
  const newOccupancy = validOccupancies.includes(occupancy) ? occupancy : currentStatus.occupancy;
  const newIsOpen = typeof isOpen === 'boolean' ? isOpen : currentStatus.isOpen;

  // Record history item (limit to last 20)
  const historyEntry = {
    isOpen: newIsOpen,
    occupancy: newOccupancy,
    activity: activity !== undefined ? activity : currentStatus.activity,
    responsible: responsible !== undefined ? responsible : currentStatus.responsible,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || 'YK'
  };

  const updatedHistory = [historyEntry, ...(currentStatus.history || [])].slice(0, 20);

  currentStatus = {
    isOpen: newIsOpen,
    occupancy: newOccupancy,
    activity: activity !== undefined ? String(activity).trim() : currentStatus.activity,
    responsible: responsible !== undefined ? String(responsible).trim() : currentStatus.responsible,
    note: note !== undefined ? String(note).trim() : currentStatus.note,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || currentStatus.responsible || 'YK',
    history: updatedHistory
  };

  saveStatus(currentStatus);
  broadcastStatus();

  res.json({
    success: true,
    message: 'Oda durumu başarıyla güncellendi.',
    data: currentStatus
  });
});

// 4. Server-Sent Events (SSE) Live Feed
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  // Send initial data immediately
  res.write(`data: ${JSON.stringify({
    type: 'INITIAL_STATE',
    status: currentStatus,
    club: CLUB_INFO,
    timestamp: Date.now()
  })}\n\n`);

  sseClients.add(res);

  // Keep connection alive with heartbeat every 25s
  const heartbeat = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Fallback to index.html for client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌌 YTÜ BKFK Oda Durumu Portalı başlatıldı: http://localhost:${PORT}`);
    console.log(`🔑 YK PIN Kodu: ${ADMIN_PIN}`);
  });
}

module.exports = app;
