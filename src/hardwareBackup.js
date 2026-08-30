// src/hardware.js
const { MockBinding } = require('@serialport/bindings-mock');
const { SerialPortStream } = require('@serialport/serialport-stream');
const { ReadlineParser } = require('@serialport/parser-readline');

function initScaleConnection(mainWindow) {
  // Create virtual registry path for COM3 if it doesn't exist
  MockBinding.createPort('COM3', { echo: false, record: true });

  const port = new SerialPortStream({
    binding: MockBinding,
    path: 'COM3',
    baudRate: 9600,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  parser.on('data', (data) => {
    const cleanData = data.toString().trim();
    const weightMatch = cleanData.match(/\d+/); 
    
    if (weightMatch) {
      const liveWeight = parseInt(weightMatch[0], 10);
      
      // console.log(`👉 Hardware streaming parsed weight: ${liveWeight} kg`); // Debug log
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scale:live-weight', liveWeight);
      }
    }
  });

  global.mockScalePort = port;
  console.log('✔ Pure JS Virtual Weight Scale bound successfully to virtual COM3');
}

module.exports = { initScaleConnection };