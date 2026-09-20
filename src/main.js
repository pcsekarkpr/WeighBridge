const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { Pool } = require('pg');
const { printerDbMethods } = require('./db'); // Importing the new multi-format printer methods
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { initWhatsApp, sendWhatsAppMessage } = require('./WhatsappService'); // Local import

// Configure your serial port settings (Adjust COM port and baudRate to match your scale)
const portName = 'COM3'; // e.g., 'COM1', 'COM3', or '/dev/ttyUSB0' on Linux
const baudRate = 9600;   // Common weighbridge baud rates: 9600, 4800, 2400

let port;

// --- SERIAL HARDWARE CONNECTION (Disabled for Simulation) ---
// const { SerialPort } = require('serialport');
// const { ReadlineParser } = require('@serialport/parser-readline');

const pool = new Pool({
  user: 'postgres',           // Your PG username
  host: 'localhost',          // Your PG host
  database: 'weighbridge',    // Your PG database name
  password: 'admin',          // Your PG password
  port: 5432,                 // Default PG port
});

let mainWindow;
let dummyInterval = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const forgeDevUrl = global.MAIN_WINDOW_VITE_DEV_URL;
  const forgeName = global.MAIN_WINDOW_VITE_NAME || 'main_window';

  if (forgeDevUrl) {
    mainWindow.loadURL(forgeDevUrl);
  } else if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${forgeName}/index.html`));
  }
}
ipcMain.on('init-whatsapp', () => {
  initWhatsApp(mainWindow); // Ensure mainWindow is passed here!
});


ipcMain.handle('send-whatsapp-msg', async (event, { phone, message }) => {
  return await sendWhatsAppMessage(phone, message);
});
// ==========================================
// NEW: MULTI-FORMAT PRINTER IPC HANDLERS
// ==========================================

// Get a list of all saved formats for dropdown selection
ipcMain.handle('get-all-printer-formats', async () => {
  try {
    return await printerDbMethods.getAllFormats();
  } catch (error) {
    console.error('Failed fetching format list:', error);
    return [];
  }
});

// Get a specific layout configuration by its formatId
ipcMain.handle('get-printer-config', async (event, formatId) => {
  try {
    return await printerDbMethods.getConfig(formatId);
  } catch (error) {
    console.error(`Failed fetching config for format ${formatId}:`, error);
    return null;
  }
});

// Save a specific layout configuration schema
ipcMain.handle('save-printer-config', async (event, payload) => {
  try {
    const { formatId, formatName, config } = payload;
    return await printerDbMethods.saveConfig(formatId, formatName, config);
  } catch (error) {
    console.error('Failed saving template payload:', error);
    return false;
  }
});

// ==========================================
// EXISTING DATABASE IPC HANDLERS
// ==========================================

ipcMain.handle('get-dropdown-masters', async () => {
  const client = await pool.connect();
  try {
    const materialsResult = await client.query('SELECT id, material_name FROM materials ORDER BY material_name ASC');
    const partiesResult = await client.query('SELECT id, party_name FROM parties ORDER BY party_name ASC');
    
    return {
      materials: materialsResult.rows,
      parties: partiesResult.rows
    };
  } catch (error) {
    console.error("PG Master fetch error:", error);
    throw error;
  } finally {
    client.release();
  }
});
ipcMain.handle('getDefaultPrinterConfig', async () => {
  try {
    //const defaultId = db.getDefaultFormatId();
        const defaultId = 3;

    if (!defaultId) {
      return null;
    }

    // Pull settings and mapped printing coordinates out of PG tables
    const layoutSpec = await db.printerDbMethods.getConfig(defaultId);
    if (layoutSpec) {
      // Append runtime markers so the frontend UI can explicitly check the box if re-opened
      layoutSpec.formatId = defaultId;
      layoutSpec.isDefault = true;
    }
    return layoutSpec;
  } catch (error) {
    console.error("IPC getDefaultPrinterConfig channel execution failed:", error);
    return null;
  }
});
ipcMain.handle('get-vehicle-history', async (event, vehicleNo) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT ticket_number AS "ticketNo", load_status AS "status", current_weight AS "gross", t.created_at AS "ticketDate", t.load_status, t.mobile_number,t.material_id, p.party_name
      FROM weighing_transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      WHERE UPPER(vehicle_number) = UPPER($1)
      ORDER BY t.created_at DESC 
      LIMIT 10
    `;
    const result = await client.query(query, [vehicleNo]);
    return result.rows;
  } catch (error) {
    console.error("PG History fetch error:", error);
    throw error;
  } finally {
    client.release();
  }
});

ipcMain.handle('save-ticket', async (event, payload) => {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO weighing_transactions 
      (vehicle_number, mobile_number, material_id, party_id, current_weight, load_status, previous_weighing_id, payment_mode, charges_amount, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING ticket_number;
    `;
    
    const values = [
      payload.vehicleNumber,
      payload.mobileNumber,
      payload.materialId,
      payload.partyId,
      payload.currentWeight,
      payload.loadStatus,
      payload.previousWeighingId,
      payload.paymentMode,
      payload.chargesAmount
    ];

    const result = await client.query(query, values);
    return { success: true, ticketNo: result.rows[0].ticket_number };
  } catch (error) {
    console.error("PG Ticket Save Insert error:", error);
    throw error;
  } finally {
    client.release();
  }
});


ipcMain.handle('add-party', async (event, partyName) => {
  if(!partyName || partyName == '') return; 
  const client = await pool.connect();

  try {

    const query = `
      INSERT INTO parties 
      (party_name, created_at)
      VALUES ($1,  NOW())
      RETURNING id;
    `;
    
    const values = [partyName];

    const result = await client.query(query, values);
    return { success: true, partyId: result.rows[0].id };
  } catch (error) {
    console.error("PG Ticket Save Insert error:", error);
    throw error;
  } finally {
    client.release();
  }
});

//const { app, BrowserWindow, ipcMain } = require('electron');
//const { printerDbMethods } = require('./db'); // Import your DB methods
import { exec } from 'child_process';
import fs from 'fs';
//import path from 'path';
import os from 'os';

ipcMain.handle('print-raw-ticket', async (event, payload) => {
  const { formatId, transactionData } = payload || {};

  try {
    let layout = null;
    if (formatId) {
      layout = await printerDbMethods.getConfig(formatId);
    }

    if (!layout) {
      const allFormats = await printerDbMethods.getAllFormats();
      const defaultFormat =
        allFormats?.find((f) => f.is_default === 1 || f.is_default === true) ||
        allFormats?.[0];

      if (defaultFormat) {
        layout = await printerDbMethods.getConfig(defaultFormat.format_id);
      }
    }

    if (!layout) {
      throw new Error('No valid printer format configuration found in database.');
    }

    const targetPrinterName = layout.printerName || layout.printer_name || 'TVS MSP 250 Star';

    // UI Canvas thresholds to identify column index
    const COL2_THRESHOLD = 250; 
    const COL3_THRESHOLD = 520; 

    // EXACT INDIVIDUAL COLUMN OFFSETS
    const COL1_SHIFT = -45; // Pulls Column 1 LEFT into its box
    const COL2_SHIFT = 38;  // Column 2 is aligned

    const COL3_SHIFT = 108; // Pushes Column 3 RIGHT into its box


    const drawCommands = (layout.fields || [])
      .map((f) => {
        if (f.display === false) return '';

        const rawValue = transactionData ? transactionData[f.fieldKey] : '';
        const fieldValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : '';
        if (!fieldValue) return '';

        const cleanText = fieldValue.replace(/'/g, "''");
        
        const fontSize = f.fontSize || 10; 
        const fontStyle = (f.fontWeight === 'bold' || f.fontWeight === '700') ? 'Bold' : 'Regular';
        const fontFamily = f.fontFamily || 'Courier New';

        let finalX = f.x || 0;
        const yPos = f.y || 0;

        // Apply specific column shift
        if (finalX >= COL3_THRESHOLD) {
          finalX += COL3_SHIFT;
        } else if (finalX >= COL2_THRESHOLD) {
          finalX += COL2_SHIFT;
        } else {
          finalX += COL1_SHIFT;
        }

        return `
        $fn = New-Object System.Drawing.Font('${fontFamily}', ${fontSize}, [System.Drawing.FontStyle]::${fontStyle});
        $graphics.DrawString('${cleanText}', $fn, $br, ${finalX}, ${yPos});
        $fn.Dispose();
        `;
      })
      .join('\n');

    // High-speed optimized PowerShell printing script
    const psScript = `
$ErrorActionPreference = 'Stop';
Add-Type -AssemblyName System.Drawing;
$pd = New-Object System.Drawing.Printing.PrintDocument;
$pd.PrinterSettings.PrinterName = '${targetPrinterName}';
$pd.OriginAtMargins = $false;

$pd.add_PrintPage({
    param($sender, $ev)
    $graphics = $ev.Graphics;
    $graphics.PageUnit = [System.Drawing.GraphicsUnit]::Display;
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit;

    $br = [System.Drawing.Brushes]::Black;
    
    ${drawCommands}
});

$pd.Print();
`;

    const psScriptPath = path.join(os.tmpdir(), `print_fast_${Date.now()}.ps1`);
    fs.writeFileSync(psScriptPath, psScript, 'utf8');

    return new Promise((resolve, reject) => {
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, (error, stdout, stderr) => {
        if (fs.existsSync(psScriptPath)) fs.unlinkSync(psScriptPath);

        if (error) {
          console.error('[GDI PRINT ERROR]:', stderr || error.message);
          reject(new Error(`Print failed: ${stderr || error.message}`));
        } else {
          console.log('[PRINT SUCCESS] Fast aligned ticket sent!');
          resolve(true);
        }
      });
    });

  } catch (error) {
    console.error('Error executing print job:', error);
    throw error;
  }
});


//import { ipcMain } from 'electron';

// Set your API key from fast2sms.com
//const FAST2SMS_API_KEY = await checkSMSAPIKey();
let FAST2SMS_API_KEY = '';

/*(async () => {
  try {
    FAST2SMS_API_KEY = await checkSMSAPIKey();
    console.log('Fast2SMS API Key loaded successfully');
  } catch (err) {
    console.error('Failed to load Fast2SMS API Key:', err);
  }
})();*/
//'Py9AwU2d7bDTlXxCnBQqSzVYo4ap5veWLKFEr8iImOZfghcJRN0TVKBpAEMRgH3aZtxiJFQX9Du8SPqW';

ipcMain.handle('send-sms', async (event, payload) => {
  const { phoneNumber, message } = payload || {};

  
  if (!phoneNumber || !message) {
    throw new Error('Phone number and message content are required.');
  }
  if(!FAST2SMS_API_KEY || FAST2SMS_API_KEY == ""){
        throw new Error('SMS key is empty.');
  }
  // Format to clean 10-digit Indian mobile number
  //const cleanNumber = String(phoneNumber).replace(/\D/g, '').slice(-10);
  const cleanNumber = String(phoneNumber).trim();

  // Validate: must be EXACTLY 10 digits and numbers only
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(cleanNumber)) {
    throw new Error('Invalid mobile number. Please enter a valid 10-digit number.');
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',               // Quick transactional route
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanNumber
      })
    });

    const result = await response.json();

    if (result.return === true) {
      console.log('[SMS SUCCESS]: Sent to', cleanNumber);
      return { success: true, message: 'SMS sent successfully!' };
    } else {
      const errorMsg = Array.isArray(result.message) ? result.message.join(', ') : result.message;
      throw new Error(errorMsg || 'SMS gateway rejected the request.');
    }
  } catch (error) {
    console.error('[SMS ERROR]:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
});


ipcMain.handle('get-report-data', async (event, filters) => {
  const client = await pool.connect();
  try {
    const { vehicle_number, slipFrom, slipTo, partyName, dateFrom, dateTo, isLatestOnly } = filters;
    
    let sql = `
      SELECT t.*, p.party_name, t.ticket_number as "ticketNo",  t2.current_weight as "first_weight"
      FROM weighing_transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      LEFT JOIN weighing_transactions t2 ON (
      t.previous_weighing_id = t2.id 
    )
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (vehicle_number) {
      sql += ` AND t.vehicle_number ILIKE $${paramIndex}`;
      values.push(`%${vehicle_number}%`);
      paramIndex++;
    }

    if (slipFrom) {
      sql += ` AND t.ticket_number >= $${paramIndex}`;
      values.push(Number(slipFrom));
      paramIndex++;
    }
    if (slipTo) {
      sql += ` AND t.ticket_number <= $${paramIndex}`;
      values.push(Number(slipTo));
      paramIndex++;
    }

    if (partyName) {
      sql += ` AND p.party_name = $${paramIndex}`;
      values.push(partyName);
      paramIndex++;
    }

    if (dateFrom) {
      sql += ` AND t.created_at >= $${paramIndex}::TIMESTAMP`;
      values.push(`${dateFrom} 00:00:00`);
      paramIndex++;
    }
    if (dateTo) {
      sql += ` AND t.created_at <= $${paramIndex}::TIMESTAMP`;
      values.push(`${dateTo} 23:59:59`);
      paramIndex++;
    }

    sql += ` ORDER BY t.created_at DESC`;
    if(isLatestOnly)
    {
      sql += ` Limit 1`;
    }

    const result = await client.query(sql, values);
    return result.rows;
  } catch (error) {
    console.error("PG Report fetch error:", error);
    throw error;
  } finally {
    client.release();
  }
});

async function checkIsLoopbackMode() {
  let client;
  try {
    client = await pool.connect();
    
    // Check if configuration table exists and read setting
    const query = `
      SELECT config_value 
      FROM app_config 
      WHERE config_key = 'weight_source' 
      LIMIT 1;
    `;
    const res = await client.query(query);

    if (res.rows.length > 0) {
      return res.rows[0].config_value?.toLowerCase() === 'loopback';
    }
    return false; // Table exists but no key found -> default to serial
  } catch (err) {
    console.warn("Could not check config table (defaulting to Serial):", err.message);
    return false; // Table missing or DB error -> default to serial
  } finally {
    if (client) client.release();
  }
}

// Function: Start Loopback Mode (Dummy Generator)
function startLoopbackMode() {
  console.log("⚡ Starting Weight Source: LOOPBACK (Dummy Data)");
  let currentWeight = 33000;

  dummyInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const fluctuation = Math.floor(Math.random() * 41) - 20; 
      currentWeight += fluctuation;
      mainWindow.webContents.send('serial-weight-data', currentWeight);
    }
  }, 500);
}

// Function: Start Real Serial Port Reader
function initSerialPort() {
  console.log("🔌 Starting Weight Source: SERIAL PORT (COM3)");
  const portName = 'COM3';
  const baudRate = 9600;

  try {
    port = new SerialPort({
      path: portName,
      baudRate: baudRate,
      autoOpen: true,
    });

    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
      const numericMatch = String(data).match(/-?\d+(\.\d+)?/);
      if (numericMatch) {
        const liveWeight = Math.round(parseFloat(numericMatch[0]));
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('serial-weight-data', liveWeight);
        }
      }
    });

    port.on('error', (err) => {
      console.error('Serial Port Error:', err.message);
    });

  } catch (err) {
    console.error('Failed to initialize Serial Port:', err);
  }
}

// Application Lifecycle
app.whenReady().then(async () => {
  createWindow();
  initWhatsApp();

  // Determine whether to launch loopback or serial
  const isLoopback = await checkIsLoopbackMode();

  if (isLoopback) {
    startLoopbackMode();
  } else {
    initSerialPort();
  }
});;
