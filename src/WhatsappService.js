const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { app } = require('electron'); // <-- Add this import
let isReady = false;
let client = null;
const path = require('path');

function initWhatsApp() {
  if (client) return;

  console.log('🔄 Initializing WhatsApp Web Client...');

 const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../.wwebjs_auth');

client = new Client({
  authStrategy: new LocalAuth({ 
    clientId: 'weighbridge-app',
    dataPath: path.join(userDataPath, 'whatsapp_auth')
  }),
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014587000-alpha.html',
  },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }
  });

  // Log loading progress
  client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Loading WhatsApp Web: ${percent}% - ${message}`);
  });

  // Log QR code arrival explicitly
  client.on('qr', (qr) => {
    isReady = false;
    console.log('\n========================================');
    console.log('  SCAN THIS QR CODE WITH YOUR WHATSAPP  ');
    console.log('========================================\n');
    
    // Print QR ASCII code directly
    QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
      if (err) {
        console.error('Error printing QR Code:', err);
      } else {
        console.log(url);
      }
    });
  });

  client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp Web Client is Ready and Connected!');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Auth Failure:', msg);
    isReady = false;
  });

  client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp Disconnected:', reason);
    isReady = false;
  });

  try {
    client.initialize();
  } catch (err) {
    console.error('❌ Failed to initialize Puppeteer:', err);
  }
}

async function sendWhatsAppMessage(phone, message) {
  if (!isReady) {
    throw new Error('WhatsApp is not ready. Scan the QR code in your console terminal.');
  }

  const cleanPhone = phone.trim().replace(/\D/g, '');
  const formattedNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const chatId = `${formattedNumber}@c.us`;

  return await client.sendMessage(chatId, message);
}

module.exports = { initWhatsApp, sendWhatsAppMessage };