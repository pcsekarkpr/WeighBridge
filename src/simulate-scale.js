// src/simulate-scale.js

function startWeightSimulation() {
  let currentWeight = 0;
  let targetWeight = 28540;
  let ascending = true;

  console.log('🚀 Internal Scale Simulator initialized.');

  setInterval(() => {
    // Check if the application has established the virtual background port yet
    if (global.mockScalePort && global.mockScalePort.writable) {
      if (ascending) {
        currentWeight += Math.floor(Math.random() * 800) + 400;
        if (currentWeight >= targetWeight) {
          currentWeight = targetWeight;
          ascending = false;
        }
      } else {
        // Add tiny realistic weight fluctuations
        currentWeight = targetWeight + (Math.floor(Math.random() * 15) - 7);
      }

      // Format exactly like industrial Essae/Contech indicator protocols
      const simulatedString = `ST,GS,+${String(currentWeight).padStart(6, '0')}kg\r\n`;
      
      // Inject directly into the virtual background stream buffer
      global.mockScalePort.port.emitData(Buffer.from(simulatedString));
    }
  }, 200);
}

module.exports = { startWeightSimulation };