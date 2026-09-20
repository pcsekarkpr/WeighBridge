const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let isReady = false;
let client = null;

// Dynamically resolve Puppeteer's executable inside packaged .exe
function getExecutablePath() {
  if (!app || !app.isPackaged) return undefined;

  // Unpacked Chromium path created by electron-builder / Vite
  const unpackedPath = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'puppeteer',
    '.local-chromium'
  );

  return fs.existsSync(unpackedPath) ? unpackedPath : undefined;
}

async function initWhatsApp(mainWindow) {
  // Graceful cleanup if init is called while a client instance exists
  if (isReady && client) {
    console.log('⚡ WhatsApp is already connected! Notifying UI...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('whatsapp-status', { connected: true });
    }
    return;
  }
  if (client) {
    console.log('🔄 Cleaning up existing WhatsApp client before re-initialization...');
    isReady = false;
    client.removeAllListeners();
    try {
      await client.destroy();
    } catch (e) {
      console.error('Error destroying previous instance:', e.message);
    }
    client = null;
  }

  console.log('🔄 Initializing WhatsApp Web Client...');

  const userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../.wwebjs_auth');
  const authDirectory = path.join(userDataPath, 'whatsapp_auth');

  if (!fs.existsSync(authDirectory)) {
    fs.mkdirSync(authDirectory, { recursive: true });
  }

  client = new Client({
    authStrategy: new LocalAuth({
      clientId: 'weighbridge-app',
      dataPath: authDirectory
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014133500-alpha.html',
    },
    puppeteer: {
      headless: true,
      executablePath: getExecutablePath(),
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

  // Log QR code arrival and send to UI if mainWindow is passed
  client.on('qr', async (qr) => {
    isReady = false;
    console.log('\n========================================');
    console.log('  SCAN THIS QR CODE WITH YOUR WHATSAPP  ');
    console.log('========================================\n');

    QRCode.toString(qr, { type: 'terminal', small: true }, (err, url) => {
      if (!err) console.log(url);
    });

    // Send base64 QR code image to Electron renderer frontend
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        mainWindow.webContents.send('whatsapp-qr', qrDataUrl);
      } catch (err) {
        console.error('Failed to process QR for Renderer:', err);
      }
    }
  });

  client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp Web Client is Ready and Connected!');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('whatsapp-status', { connected: true });
    }
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Auth Failure:', msg);
    isReady = false;
  });

  // Release Chromium process and file locks on disconnect/logout
  client.on('disconnected', async (reason) => {
    console.log('⚠️ WhatsApp Disconnected:', reason);
    isReady = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('whatsapp-status', { connected: false });
    }
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
        console.error('Error destroying client after disconnect:', err.message);
      } finally {
        client = null;
      }
    }
  });

  try {
    await client.initialize();
  } catch (err) {
    console.error('❌ Failed to initialize Puppeteer:', err);
    isReady = false;
    client = null;
  }
}

async function sendWhatsAppMessage(phone, message) {
  if (!isReady || !client) {
    throw new Error('WhatsApp is not ready. Please scan the QR code first.');
  }

  const cleanPhone = String(phone).trim().replace(/\D/g, '');
  const formattedNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const chatId = `${formattedNumber}@c.us`;

  try {
    const isRegistered = await client.isRegisteredUser(chatId);
    if (!isRegistered) {
      throw new Error(`Phone number ${formattedNumber} is not registered on WhatsApp.`);
    }

    return await client.sendMessage(chatId, message);
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err.message);
    throw err;
  }
}
function getWhatsAppStatus() {
  return { connected: isReady };
}
module.exports = { initWhatsApp, sendWhatsAppMessage, getWhatsAppStatus };