const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const configPath = path.join(app.getPath('userData'), 'wb_printer_config.json');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'weighbridge',
  password: 'admin', 
  port: 5432,
});


function getDefaultFormatId() {
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data.default_format_id || null;
    }
  } catch (err) {
    console.error("Error reading default print configuration pointer:", err);
  }
  return null;
}

/**
 * Sets the globally active default format ID in local storage
 */
function setDefaultFormatId(formatId) {
  try {
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
      currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    currentConfig.default_format_id = formatId ? parseInt(formatId, 10) : null;
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
    return true;
  } catch (err) {
    console.error("Error writing default print configuration pointer:", err);
    return false;
  }
}

async function initDatabase() {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS parties (
      id SERIAL PRIMARY KEY, 
      party_name VARCHAR(200) NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY, 
      material_name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weighing_transactions (
      id SERIAL PRIMARY KEY, 
      ticket_number SERIAL UNIQUE, 
      vehicle_number VARCHAR(20) NOT NULL, 
      mobile_number VARCHAR(15),
      material_id VARCHAR(255), 
      party_id INT REFERENCES parties(id) ON DELETE SET NULL,
      current_weight INT NOT NULL,
      load_status VARCHAR(10) CHECK (load_status IN ('Gross', 'Tare')),
      previous_weighing_id INT REFERENCES weighing_transactions(id) ON DELETE SET NULL,
      payment_mode VARCHAR(10) CHECK (payment_mode IN ('CASH', 'UPI')), 
      charges_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00, 
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS printer_settings (
      format_id SERIAL PRIMARY KEY,
      format_name TEXT NOT NULL,
      printer_type TEXT NOT NULL,
      paper_size TEXT NOT NULL,
      copies INTEGER NOT NULL,
      bg_image TEXT,
      bg_opacity INTEGER DEFAULT 60,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS printer_fields (
      id SERIAL PRIMARY KEY,
      format_id TEXT NOT NULL REFERENCES printer_settings(format_id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      display TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      font_size INTEGER NOT NULL,
      font_family TEXT NOT NULL,
      font_weight TEXT NOT NULL
    );
  `;
  
  try {
    await pool.query(createTablesQuery);
    console.log("PostgreSQL Relational Tables checked/created successfully.");

    // Seed initial mock masters so dropdowns have data initially
    await pool.query(`INSERT INTO materials (material_name) VALUES ('Paddy'), ('Rice'), ('Cement') ON CONFLICT DO NOTHING;`);
    await pool.query(`INSERT INTO parties (party_name) VALUES ('ABC Rice Mill'), ('Sri Srinivasa Traders') ON CONFLICT DO NOTHING;`);
  } catch (err) {
    console.error("Error creating tables:", err);
  }
}

// Fetch master items to fill drop downs inside React
async function getDropdownMasters() {
  const materialsRes = await pool.query('SELECT id, material_name FROM materials ORDER BY material_name;');
  const partiesRes = await pool.query('SELECT id, party_name FROM parties ORDER BY party_name;');
  return {
    materials: materialsRes.rows,
    parties: partiesRes.rows
  };
}

async function saveTicket(t) {
  const insertQuery = `
    INSERT INTO weighing_transactions (
      vehicle_number, mobile_number, material_id, party_id, 
      current_weight, load_status, previous_weighing_id, payment_mode, charges_amount
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *;
  `;
  
  const values = [
    t.vehicleNumber,
    t.mobileNumber || null,
    t.materialId ? parseInt(t.materialId) : null,
    t.partyId ? parseInt(t.partyId) : null,
    parseInt(t.currentWeight) || 0,
    t.loadStatus, 
    t.previousWeighingId || null,
    t.paymentMode.toUpperCase(), 
    parseFloat(t.chargesAmount) || 0.00
  ];

  const res = await pool.query(insertQuery, values);
  
  return res.rows[0];
}

async function checkSMSAPIKey() {
  let client;
  try {
    
    // Check if configuration table exists and read setting
    const query = `
      SELECT config_value 
      FROM app_config 
      WHERE config_key = 'SMS_KEY' 
      LIMIT 1;
    `;
    const res = await client.query(query);

    if (res.rows.length > 0 &&  res.rows[0].config_value &&  res.rows[0].config_value != "") {
      console.log("SMS Key is:"+ res.rows[0].config_value);
      return res.rows[0].config_value;
    }
    console.log("SMS Key is empty");

    return ""; // Table exists but no key found -> default to serial
  } catch (err) {
    console.warn("Could not check config table. Cant send sms", err.message);
    return false; // Table missing or DB error -> default to serial
  } 
}
async function getVehicleHistory(vehicleNo) {
  const historyQuery = `
    SELECT 
      t.ticket_number as "ticketNo", 
      t.created_at as "ticketDate", 
      t.current_weight as gross, 
      t.load_status as status
    FROM weighing_transactions t
    WHERE t.vehicle_number = $1 
    ORDER BY t.created_at DESC 
    LIMIT 10;
  `;
  const res = await pool.query(historyQuery, [vehicleNo]);
//console.log(JSON.stringify(res, null, 2));
  return res.rows;
  /*return res.rows.map(row => ({
    ...row,
    ticketDate: row.ticketDate ? new Date(row.ticketDate).toISOString() : null
  }));*/
}

/**
 * Fetches filtered reporting records from PostgreSQL weighing_transactions table
 */
const getReportData = async (filters = {}) => {
  // 1. Extract the new flag along with your existing filters
  const { slipFrom, slipTo, vehicle_number, dateFrom, dateTo, isLatestOnly } = filters;
  
  let queryParams = [];
  let whereClauses = [];

  let sql = `
    SELECT 
      t.id, t.ticket_number, t.vehicle_number, t.mobile_number, 
      t.material_id, t.party_id, t.load_status, t.previous_weighing_id, 
      t.payment_mode, t.charges_amount, t.created_at as "weighing_date", 
      t.current_weight,
      t2.current_weight as "first_weight"
      
    FROM weighing_transactions t
    LEFT JOIN weighing_transactions t2 ON (
      t.previous_weighing_id = t2.id 
    )
  `;

  // Apply traditional filters if not just fetching the latest single record
  if (!isLatestOnly) {
    if (slipFrom && slipTo) {
      queryParams.push(parseInt(slipFrom), parseInt(slipTo));
      whereClauses.push(`(t.ticket_number BETWEEN $${queryParams.length - 1} AND $${queryParams.length} OR t.id BETWEEN $${queryParams.length - 1} AND $${queryParams.length})`);
    }
    if (vehicle_number) {
      queryParams.push(`%${vehicle_number.trim().toUpperCase()}%`);
      whereClauses.push(`t.vehicle_number LIKE $${queryParams.length}`);
    }
    if (dateFrom && dateTo) {
      queryParams.push(`${dateFrom} 00:00:00`, `${dateTo} 23:59:59`);
      whereClauses.push(`t.created_at BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`);
    }
    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }
  }

  // Always order by the latest record first
  sql += ` ORDER BY COALESCE(t.ticket_number, t.id) DESC`;

  // 2. CRITICAL OPTIMIZATION: Stop the database from reading extra rows
  if (isLatestOnly) {
    sql += ` LIMIT 1`;
  }

  try {
    const result = await pool.query(sql, queryParams);
    //console.log("Query is"+ sql);
    return result.rows;
  } catch (err) {
    console.error("Database query execution error inside getReportData:", err);
    throw err;
  }
};
const printerDbMethods = {

  getAllFormats: async () => {
    const client = await pool.connect();
    try {
      // 1. Fetch format_id, format_name, and is_default
      const res = await client.query(
        'SELECT format_id, format_name, is_default FROM printer_settings ORDER BY updated_at DESC'
      );
      return res.rows;
    } catch (error) {
      console.error('Error fetching formats list:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  // MULTI-FORMAT PRINT ENGINE MANAGEMENT SUBPROCESSES
  saveConfig: async (formatId, formatName, config) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const isDefault = config.isDefault === 1 || config.isDefault === true;

      // 1. If this format is set as default, reset all other layouts to false
      if (isDefault) {
        await client.query('UPDATE printer_settings SET is_default = FALSE');
      }

      let currentFormatId = formatId;

      if (currentFormatId) {
        // Update existing profile
        const updateQuery = `
          UPDATE printer_settings 
          SET 
            format_name = $2, 
            printer_type = $3, 
            paper_size = $4, 
            copies = $5, 
            bg_image = $6, 
            bg_opacity = $7, 
            is_default = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE format_id = $1
        `;
        await client.query(updateQuery, [
          currentFormatId,
          formatName,
          config.printerType,
          config.paperSize,
          config.copies,
          config.bgImage,
          config.bgOpacity || 60,
          isDefault
        ]);
      } else {
        // Insert brand new template profile
        const insertQuery = `
          INSERT INTO printer_settings (format_name, printer_type, paper_size, copies, bg_image, bg_opacity, is_default, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          RETURNING format_id
        `;
        const insertRes = await client.query(insertQuery, [
          formatName,
          config.printerType,
          config.paperSize,
          config.copies,
          config.bgImage,
          config.bgOpacity || 60,
          isDefault
        ]);
        currentFormatId = insertRes.rows[0].format_id;
      }

      // 2. Clear out older sub-field records mapped to this format
      await client.query('DELETE FROM printer_fields WHERE format_id = $1', [currentFormatId]);

      // 3. Sequentially insert field parameters
      const fieldInsertQuery = `
        INSERT INTO printer_fields (format_id, field_key, display, x, y, font_size, font_family, font_weight)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      if (Array.isArray(config.fields)) {
        for (const f of config.fields) {
          await client.query(fieldInsertQuery, [
            currentFormatId,
            f.fieldKey,
            f.display,
            f.x,
            f.y,
            f.fontSize,
            f.fontFamily,
            f.fontWeight
          ]);
        }
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error executing saveConfig transaction in PG:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  getConfig: async (formatId) => {
    // If no ID is provided, return null early
    if (!formatId) return null;

    try {
      // 1. Fetch master printer settings profile including is_default
      const masterRes = await pool.query(
        'SELECT format_name, printer_type, paper_size, copies, bg_image, bg_opacity, is_default FROM printer_settings WHERE format_id = $1',
        [formatId]
      );

      if (masterRes.rows.length === 0) return null;

      const row = masterRes.rows[0];

      // 2. Fetch layout fields with key alias field_key AS "fieldKey"
      const fieldsRes = await pool.query(
      `SELECT 
        field_key AS "fieldKey", 
        display, 
        x, 
        y, 
        font_size AS "fontSize", 
        font_family AS "fontFamily", 
        font_weight AS "fontWeight" 
       FROM printer_fields 
       WHERE format_id = $1`,
      [formatId]
    );

      // 3. Format result object
      return {
        formatName: row.format_name,
        printerType: row.printer_type,
        paperSize: row.paper_size,
        copies: parseInt(row.copies, 10) || 1,
        bgImage: row.bg_image,
        bgOpacity: parseInt(row.bg_opacity, 10) || 60,
        isDefault: row.is_default,
        fields: fieldsRes.rows.map((f) => ({
        ...f,
        x: parseFloat(f.x) || 0,
        y: parseFloat(f.y) || 0,
        fontSize: parseInt(f.fontSize, 10) || 14,
      })),
      };
    } catch (error) {
      console.error('Error executing getConfig in PG:', error);
      throw error;
    }
  },

};
module.exports = { 
  initDatabase, 
  getDropdownMasters, 
  saveTicket, 
  getVehicleHistory, 
  getReportData,
  printerDbMethods,
  getDefaultFormatId,
  setDefaultFormatId, 
checkSMSAPIKey,
};