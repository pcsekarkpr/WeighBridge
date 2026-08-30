import React, { useState, useEffect, useRef } from 'react';
import ReportsView from './reports';  
import ReprintView from './reprint'; 
import SettingsView from './settings';
import { useModelAlert } from './useModelAlert';
import AlertModel from './AlertModel';
import { printTicketWithDefaultLayout } from './PrinterSettingsManagement';

export default function WeighbridgeDashboard() {
  // Configurable Custom model State (Handles both Success and Error states seamlessly)
  /*const [modelConfig, setmodelConfig] = useState({
    show: false,
    title: '',
    message: '',
    tamilMessage: '',
    isError: false
  });*/
  const { modelConfig, triggerModelAlert, closeModelAlert } = useModelAlert();

  const mainVehicleInputRef = useRef(null);
  const [showReprint, setShowReprint] = useState(false);
  // Core Form Input State
  const [activeView, setActiveView] = useState('DASHBOARD'); // Layout states: 'DASHBOARD', 'REPORTS', or 'REPRINT'
  const [vehicleNo, setVehicleNo] = useState('');
  const [linkedTicketNo, setLinkedTicketNo] = useState('');
  const [loadStatus, setLoadStatus] = useState('Gross'); 
  const [materialInput, setMaterialInput] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); 
  
  // Weight Measurement & Capture Controls
  const [liveWeight, setLiveWeight] = useState(28540); 
  const [lockedWeight, setLockedWeight] = useState(null); 
  const [previousWeight, setPreviousWeight] = useState(0);
  const [netWeight, setNetWeight] = useState(0);

  // Master Lists & Logs Data State
  const [materialsList, setMaterialsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [historyWeights, setHistoryWeights] = useState([]);

  // Ref tracking the timestamp of the last Escape key stroke for the double-press close mechanic
  const lastEscPressTime = useRef(0);

  // Direct Sequential Focus Refs for Keyboard Navigation
  const fieldRefs = {
    vehicleNo: useRef(null),
    linkedTicketNo: useRef(null),
    loadStatus: useRef(null),
    material: useRef(null),
    partyName: useRef(null),
    mobileNo: useRef(null),
    amount: useRef(null),
    paymentMode: useRef(null),
    saveBtn: useRef(null)
  };

  // Sync Dropdown Masters on Startup
  useEffect(() => {
    async function loadMasterData() {
      if (window.api && window.api.getDropdownMasters) {
        try {
          const masters = await window.api.getDropdownMasters();
          setMaterialsList(masters.materials || []);
          setPartiesList(masters.parties || []);
        } catch (err) {
          console.error("Failed to load Master lists:", err);
        }
      }
    }
    loadMasterData();
  }, []);

  // Compute Net Weight Difference on change
  useEffect(() => {
    const baseline = lockedWeight !== null ? lockedWeight : liveWeight;
    if (previousWeight > 0) {
      setNetWeight(Math.abs(baseline - previousWeight));
    } else {
      setNetWeight(0);
    }
  }, [liveWeight, lockedWeight, previousWeight]);

  // Serial Hardware listener
  useEffect(() => {
    let unsubscribe = null;
    if (window.api && window.api.onLiveWeightUpdate) {
      unsubscribe = window.api.onLiveWeightUpdate((incomingWeight) => {
        setLiveWeight(incomingWeight);
      });
    }
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  //to Return the focus always to vehicle no when we close reprint or report
  useEffect(() => {
  if (activeView === 'DASHBOARD') {
    // Small timeout ensures the DOM has updated and the view is fully visible
    setTimeout(() => {
      if (fieldRefs.vehicleNo.current) {
        fieldRefs.vehicleNo.current.focus();
      }
    }, 50);
  }
}, [activeView]);
  // Query History Records on Vehicle Blur
  const handleVehicleBlur = (vNo) => {
    if (!vNo || !window.api) return;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database lookup timed out")), 3000)
    );

    Promise.race([
      window.api.getVehicleHistory(vNo),
      timeoutPromise
    ])
    .then((records) => {
      if (records) {
        console.log("📊 Raw History Records payload from background process:", records);
        setHistoryWeights(records);
      }
    })
    .catch((err) => {
      console.warn("Background vehicle history look-up bypassed:", err.message);
      setHistoryWeights([]); 
    });
  };

  const handleSelectOldTransaction = (record) => {
    setLinkedTicketNo(record.ticketNo);
    setPreviousWeight(parseInt(record.gross) || 0);
  };

  const handleTicketIdLookup = (tNo) => {
    setLinkedTicketNo(tNo);
    const matched = historyWeights.find(r => String(r.ticketNo) === String(tNo));
    if (matched) {
      setPreviousWeight(parseInt(matched.gross) || 0);
    } else {
      setPreviousWeight(0);
    }
  };

  const toggleWeightLock = () => {
    if (lockedWeight === null) {
      setLockedWeight(liveWeight);
    } else {
      setLockedWeight(null); 
    }
  };

  const handleVehicleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lockedWeight === null) {
        setLockedWeight(liveWeight);
      }
      fieldRefs.linkedTicketNo.current?.focus();
    }
  };

  // Centralized Shortcuts & Global Keydown Engine
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const targetTag = e.target.tagName;
      const isInputField = targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA';

      // --- 1. HANDLE ESCAPE ROUTINES (DOUBLE ESC TO LEAVE SUB-VIEWS) ---
      if (e.key === 'Escape') {
        e.preventDefault();
        
        // If an alert pop-up model is open, let single escape close it safely
        if (modelConfig.show) {
          closeModelAndResetFocus();
          return;
        }

        // If inside Reports or Reprint screen, require double tap within 500 milliseconds
        if (activeView === 'REPORTS' || activeView === 'REPRINT') {
          const currentTime = Date.now();
          if (currentTime - lastEscPressTime.current < 500) {
            setActiveView('DASHBOARD');
          } else {
            lastEscPressTime.current = currentTime;
          }
          return;
        }

        // Standard operational behavior inside dashboard main screen
        resetFormValues();
        return;
      }

      // --- 2. LAYOUT SWITCHING KEYBOARD SHORTCUT RECOGNITIONS ---
      // We process F1/F2 or raw single letter shortcuts if user isn't currently editing an input box
      if (activeView === 'DASHBOARD') {
        if (e.key === 'F1' || (!isInputField && (e.key === 'r' || e.key === 'R'))) {
          e.preventDefault();
          setActiveView('REPORTS');
        } else if (e.key === 'F2' || (!isInputField && (e.key === 'p' || e.key === 'P'))) {
          e.preventDefault();
          setActiveView('REPRINT');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [modelConfig.show, activeView]);

  const resetFormValues = () => {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    setVehicleNo('');
    setLinkedTicketNo('');
    setLockedWeight(null); 
    setPreviousWeight(0);
    setMaterialInput('');
    setPartyInput('');
    setAmount('');
    setMobileNo('');
    setHistoryWeights([]);
    setLoadStatus('Gross');
    setPaymentMode('CASH');
    
    setTimeout(() => {
      if (fieldRefs.vehicleNo.current) {
        fieldRefs.vehicleNo.current.focus();
      }
    }, 150);
  };

  const closemodelAndResetFocus = () => {
    const standardReset = !modelConfig.isError;
    setmodelConfig({ show: false, title: '', message: '', tamilMessage: '', isError: false });
    
    if (standardReset) {
      resetFormValues();
    } else {
      setTimeout(() => fieldRefs.vehicleNo.current?.focus(), 100);
    }
  };

  /*const triggermodelAlert = (title, message, tamilMessage, isError = false) => {
    setmodelConfig({
      show: true,
      title,
      message,
      tamilMessage,
      isError
    });
  };*/

  const handleEnterNavigation = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  const handleLoadStatusKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fieldRefs.material.current?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      setLoadStatus(prev => prev === 'Gross' ? 'Tare' : 'Gross');
    }
  };

  const handleFeeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fieldRefs.paymentMode.current?.focus();
    }
  };

  const handlePaymentKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fieldRefs.saveBtn.current?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      setPaymentMode(prev => prev === 'CASH' ? 'UPI' : 'CASH');
    }
  };

 const handleSaveTransaction = async () => {
    if (!vehicleNo) {
      return triggerModelAlert(
        "Validation Error", 
        "Vehicle number is required.", 
        "வண்டி எண் தேவை.", 
        true
      );
    }

    const matchedMaterial = materialsList.find(m => m.material_name === materialInput);
    const matchedParty = partiesList.find(p => p.party_name === partyInput);
    
    const computedGross = loadStatus === 'GROSS' ? (lockedWeight !== null ? lockedWeight : liveWeight) : 0;
    const computedTare = loadStatus === 'TARE' ? (lockedWeight !== null ? lockedWeight : liveWeight) : 0;
    const computedNet = Math.max(0, computedGross - computedTare);

    const payload = {
      vehicleNumber: vehicleNo,
      mobileNumber: mobileNo || null,
      materialId: matchedMaterial ? matchedMaterial.id : null,
      partyId: matchedParty ? matchedParty.id : null,
      currentWeight: lockedWeight !== null ? lockedWeight : liveWeight,
      loadStatus: loadStatus,
      previousWeighingId: linkedTicketNo || null,
      paymentMode: paymentMode,
      chargesAmount: amount || 0.00
    };

   if (window.api && window.api.saveTicket) {
  try {
    // 1. Save ticket in database
    const savedTicketResponse = await window.api.saveTicket(payload);
    const activeTicketId = savedTicketResponse?.ticketId || "89421";

    // 2. Prepare transaction data for print layout engine
    const printData = {
      ticketNo: activeTicketId,
      vehicleNo: vehicleNo,
      date: payload.date || new Date().toLocaleDateString('en-GB'),
      time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      material: payload.materialName || '',
      party: payload.partyName || '',
      gross: payload.grossWeight || '',
      tare: payload.tareWeight || '',
      net: payload.netWeight || '',
      charges: payload.charges || '150.00'
    };

    // 3. Prompt user with Yes/No confirmation (Title, English, Tamil, isError=false, isConfirm=true)
    const shouldPrint = await triggerModelAlert(
      "Ticket Saved Successfully",
      `Ticket #${activeTicketId} saved. Do you want to print it?`,
      "சீட்டு வெற்றிகரமாக சேமிக்கப்பட்டது. இதை அச்சிட விரும்புகிறீர்களா?",
      false, // isError
      true   // isConfirm (Enables Yes/No mode with key handlers)
    );

    // 4. Handle user decision
    if (shouldPrint) {
      await printTicketWithDefaultLayout(printData);
    }

    // 5. Navigate to Dashboard or Reset Form after completion
   
  } catch (err) {
    console.error("Transaction save/print error:", err);
    triggerModelAlert(
      "Printing / Database Error",
      "Failed to process transaction save and print operations.",
      "தரவுத்தளத்தில் சேமிக்க அல்லது அச்சிட முடியவில்லை.",
      true, // isError
      false // isConfirm
    );
  }
}};

  const formatDateTime = (row) => {
    if (!row) return '---';
    const rawDateTime = row.ticketDate || row.weighing_date || row.created_at || row.ticket_date || row.date_time;
    if (!rawDateTime) return '---';

    const dateObj = new Date(rawDateTime);
    if (isNaN(dateObj.getTime())) {
      return String(rawDateTime).substring(0, 16);
    }

    return dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit' }) + ' ' + 
           dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const activeCurrentWeight = lockedWeight !== null ? lockedWeight : liveWeight;
  const displayFirstWeight = linkedTicketNo ? previousWeight : activeCurrentWeight;
  const displaySecondWeight = linkedTicketNo ? activeCurrentWeight : previousWeight;

  return (
    <div className="h-screen w-screen bg-slate-100 font-sans text-slate-800 p-2 select-none flex flex-col overflow-hidden max-h-screen">
      
      {/* HEADER */}
      <header className="bg-white rounded-xl shadow-sm px-4 py-2 flex justify-between items-center mb-2 border border-slate-200 shrink-0">
        <div className="flex items-center gap-6 flex-grow">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-emerald-700">PC WEIGHBRIDGE</h1>
            <p className="text-xs font-bold text-slate-400 tracking-wider">FAST • ACCURATE • RELIABLE</p>
          </div>
          
          <div className="grid grid-cols-3 gap-3 border-l border-slate-200 pl-6 flex-grow max-w-xl">
            <button 
              type="button"
              onClick={() => setActiveView('REPORTS')}
              className="h-[52px] rounded-xl text-sm font-black uppercase bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition tracking-wider shadow-md flex flex-col items-center justify-center border border-indigo-700"
            >
              <span>📊 REPORTS</span>
              <span className="text-[10px] font-medium opacity-70">[F1] or [R]</span>
            </button>

            <button 
              type="button"
                            onClick={() => setActiveView('SETTINGS')}

              className="h-[52px] rounded-xl text-sm font-black uppercase bg-slate-800 text-white hover:bg-slate-900 active:scale-95 transition tracking-wider shadow-md flex flex-col items-center justify-center border border-slate-950"
            >
              <span>⚙️ SETTINGS</span>
              <span className="text-[10px] font-medium opacity-70">[F3]</span>
            </button>

            <button 
              type="button" 
              onClick={() => setActiveView('REPRINT')}
              className="h-[52px] rounded-xl text-sm font-black uppercase bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition tracking-wider shadow-md flex flex-col items-center justify-center border border-amber-700"
            >
              <span>📦 REPRINT</span>
              <span className="text-[10px] font-medium opacity-70">[F2] or [P]</span>
            </button>
          </div>
        </div>
        
        <div className="flex gap-4 items-center ml-4">
          <div className={`px-6 py-2 h-[52px] rounded-xl flex items-center gap-2 shadow-inner transition border-2 ${lockedWeight !== null ? 'bg-red-950 border-red-500 text-red-400' : 'bg-slate-900 border-transparent text-emerald-400'}`}>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{lockedWeight !== null ? 'LOCKED' : 'LIVE'}</span>
            <span className="text-3xl font-black tabular-nums">{liveWeight.toLocaleString()}</span>
            <span className="text-lg font-bold">kg</span>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTAINER SYSTEM WORKSPACE */}
      <div className="grid grid-cols-12 gap-2 flex-grow overflow-hidden min-h-0 items-stretch">
        {/* COLUMN 1: INPUT PANELS */}
        <div className="col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-4 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 shrink-0">Transaction Details / விவரங்கள்</h3>
            
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Vehicle No *</span>
                <span className="text-xs font-medium text-slate-400">வண்டி எண்</span>
              </label>
              <div className="flex gap-2 flex-grow">
                <input 
                  ref={fieldRefs.vehicleNo}
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  onBlur={() => handleVehicleBlur(vehicleNo)}
                  onKeyDown={handleVehicleKeyDown}
                  className="border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-lg font-black uppercase focus:border-emerald-500 outline-none transition flex-grow shadow-sm"
                 // placeholder="TN69AB1234"
                  autoFocus
                />
                <button 
                  type="button"
                  onClick={toggleWeightLock}
                  className={`px-4 rounded-lg font-black text-sm shadow transition uppercase tracking-wider shrink-0 ${lockedWeight !== null ? 'bg-red-600 text-white' : 'bg-amber-50 hover:bg-amber-100 border-2 border-amber-500 text-amber-700'}`}
                >
                  {lockedWeight !== null ? '🔒 Locked' : '🔓 Unlock'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Link Slip #</span>
                <span className="text-xs font-medium text-slate-400">இணைப்பு சீட்டு</span>
              </label>
              <input 
                ref={fieldRefs.linkedTicketNo}
                type="text"
                value={linkedTicketNo}
                onChange={(e) => handleTicketIdLookup(e.target.value)}
                onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.loadStatus)}
                className="flex-grow border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold text-indigo-700 focus:border-emerald-500 outline-none transition shadow-sm"
                //placeholder="Enter Slip Code"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Load Status *</span>
                <span className="text-xs font-medium text-slate-400">பார நிலை</span>
              </label>
              <div className="grid grid-cols-2 gap-2 h-11 flex-grow">
                <button 
                  ref={fieldRefs.loadStatus}
                  type="button"
                  onClick={() => setLoadStatus('Gross')}
                  onKeyDown={handleLoadStatusKeyDown}
                  className={`text-sm font-bold rounded-lg border-2 transition flex flex-col justify-center items-center ${loadStatus === 'Gross' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-black' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                  <span className="text-base">Gross Weight</span>
                  <span className="text-xs opacity-80">மொத்த எடை</span>
                </button>
                <button 
                  //ref={fieldRefs.loadStatus}
                  type="button"
                  onClick={() => setLoadStatus('Tare')}
                  onKeyDown={handleLoadStatusKeyDown}
                  className={`text-sm font-bold rounded-lg border-2 transition flex flex-col justify-center items-center ${loadStatus === 'Tare' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-black' : 'bg-white border-slate-200 text-slate-500'}`}
                >
                  <span className="text-base">Tare Weight</span>
                  <span className="text-xs opacity-80">வெற்று எடை</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Material *</span>
                <span className="text-xs font-medium text-slate-400">பொருள் வகை</span>
              </label>
              <div className="flex-grow">
                <input
                  ref={fieldRefs.material}
                  list="materials-options"
                  value={materialInput}
                  onChange={(e) => setMaterialInput(e.target.value)}
                  onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.partyName)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold focus:border-emerald-500 outline-none bg-white transition shadow-sm"
                  //placeholder="Select material"
                />
                <datalist id="materials-options">
                  {materialsList.map((m) => (
                    <option key={m.id} value={m.material_name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Customer *</span>
                <span className="text-xs font-medium text-slate-400">வாடிக்கையாளர்</span>
              </label>
              <div className="flex-grow">
                <input
                  ref={fieldRefs.partyName}
                  list="parties-options"
                  value={partyInput}
                  onChange={(e) => setPartyInput(e.target.value)}
                  onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.mobileNo)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold focus:border-emerald-500 outline-none bg-white transition shadow-sm"
                  //placeholder="Select partner"
                />
                <datalist id="parties-options">
                  {partiesList.map((p) => (
                    <option key={p.id} value={p.party_name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Mobile</span>
                <span className="text-xs font-medium text-slate-400">கைபேசி எண்</span>
              </label>
              <input 
                ref={fieldRefs.mobileNo}
                type="text"
                value={mobileNo}
                onChange={(e) => setMobileNo(e.target.value)}
                onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.amount)}
                className="flex-grow border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold focus:border-emerald-500 outline-none transition shadow-sm"
               // placeholder="10-digit number"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Fee (₹)</span>
                <span className="text-xs font-medium text-slate-400">கட்டணம்</span>
              </label>
              <input 
                ref={fieldRefs.amount}
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={handleFeeKeyDown}
                className="flex-grow border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold focus:border-emerald-500 outline-none transition shadow-sm"
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Payment *</span>
                <span className="text-xs font-medium text-slate-400">பணம் செலுத்துதல்</span>
              </label>
              <div className="grid grid-cols-2 gap-2 h-11 flex-grow">
                <button
                  ref={fieldRefs.paymentMode}
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  onKeyDown={handlePaymentKeyDown}
                  className={`rounded-lg border-2 font-bold transition flex flex-col justify-center items-center ${paymentMode === 'CASH' ? 'bg-emerald-600 border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                  <span className="text-base">💵 Cash</span>
                  <span className="text-xs opacity-90">ரொக்கம்</span>
                </button>
                <button
                 // ref={fieldRefs.paymentMode}
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  onKeyDown={handlePaymentKeyDown}
                  className={`rounded-lg border-2 font-bold transition flex flex-col justify-center items-center ${paymentMode === 'UPI' ? 'bg-emerald-600 border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                >
                  <span className="text-base">📱 UPI</span>
                  <span className="text-xs opacity-90">டிஜிட்டல்</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-12 gap-2 shrink-0">
            <button 
              ref={fieldRefs.saveBtn}
              onClick={handleSaveTransaction}
              className="col-span-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base py-2.5 rounded-lg shadow transition flex flex-col items-center justify-center line-clamp-1"
            >
              <span>💾 SAVE SLIP [ENTER]</span>
              <span className="text-xs font-medium opacity-80">சீட்டு சேமிக்க</span>
            </button>
            <button 
              type="button"
              onClick={resetFormValues}
              className="col-span-4 bg-slate-400 hover:bg-slate-500 text-white font-bold text-sm py-2.5 rounded-lg shadow transition flex flex-col items-center justify-center line-clamp-1"
            >
              <span>✕ RESET [ESC]</span>
              <span className="text-xs font-medium opacity-80">நீக்க</span>
            </button>
          </div>
        </div>

        {/* COLUMN 2: WEIGHT MATRICES */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col justify-center items-center text-center overflow-hidden">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">Weight Matrices / எடை விவரம்</h3>
          <div className="w-full flex flex-col gap-3 flex-grow justify-center">
            <div className="bg-slate-50 rounded-xl py-3 px-3 border border-slate-150 shadow-sm flex flex-col justify-center">
              <span className="text-sm font-bold text-slate-500 uppercase">First Weight</span>
              <span className="text-xs font-semibold text-slate-400 mb-0.5">முதல் எடை</span>
              <span className="text-4xl font-black text-slate-800 tabular-nums tracking-tight">
                {displayFirstWeight.toLocaleString()} <span className="text-xl font-bold text-slate-400">kg</span>
              </span>
            </div>
            
            <div className="bg-amber-50 rounded-xl py-3 px-3 border border-amber-100 shadow-sm flex flex-col justify-center">
              <span className="text-sm font-bold text-amber-600 uppercase">Second Weight</span>
              <span className="text-xs font-semibold text-amber-500 mb-0.5">இரண்டாம் எடை</span>
              <span className="text-4xl font-black text-amber-700 tabular-nums tracking-tight">
                {displaySecondWeight.toLocaleString()} <span className="text-xl font-bold text-slate-400">kg</span>
              </span>
            </div>
            
            <div className="bg-blue-50 rounded-xl py-4 px-3 border border-blue-100 shadow-sm flex flex-col justify-center">
              <span className="text-base font-bold text-blue-600 uppercase">Final Net Weight</span>
              <span className="text-xs font-semibold text-blue-500 mb-0.5">நிகர எடை</span>
              <span className="text-5xl font-black text-blue-800 tabular-nums tracking-tight">
                {netWeight.toLocaleString()} <span className="text-2xl font-extrabold text-blue-500">kg</span>
              </span>
            </div>
          </div>
        </div>

        {/* COLUMN 3: HISTORICAL LOGS */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col overflow-hidden">
          <h3 className="text-sm font-bold text-indigo-900 mb-0.5 tracking-wide shrink-0">
            🕒 Last 10 Weights / முந்தைய பதிவுகள்
          </h3>
          <p className="text-xs text-slate-400 mb-2 shrink-0">Click a row to link / இணைக்க அழுத்தவும்.</p>
          
          <div className="flex-grow overflow-y-auto border border-slate-100 rounded-lg minimal-scrollbar min-h-0">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-400 font-bold text-xs uppercase border-b border-slate-100">
                  <th className="p-2 w-[35%]">Slip No</th>
                  <th className="p-2 text-right w-[65%]">Weight / தேதி</th>
                </tr>
              </thead>
              <tbody className="text-base font-bold text-slate-700 divide-y divide-slate-100">
                {historyWeights.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="p-4 text-center text-slate-400 font-medium text-sm italic">No history found</td>
                  </tr>
                ) : (
                  historyWeights.map((row, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => handleSelectOldTransaction(row)}
                      className={`cursor-pointer transition ${String(linkedTicketNo) === String(row.ticketNo) ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-2 font-mono text-emerald-700 font-black truncate text-sm">#{row.ticketNo}</td>
                      <td className="p-2 text-right truncate whitespace-nowrap">
                        <div className="font-black text-slate-900 tracking-tight tabular-nums text-lg">{(parseInt(row.gross) || 0).toLocaleString()} kg</div>
                        <div className="text-xs font-medium text-slate-400 tabular-nums">{formatDateTime(row)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
                <AlertModel 
        modelConfig={modelConfig} 
        onClose={closeModelAlert} 
      />
      {/* ALERT model */}
      {modelConfig.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl ${modelConfig.isError ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {modelConfig.isError ? '✕' : '✓'}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{modelConfig.title}</h3>
            <p className="text-sm text-slate-600 mb-1 leading-relaxed">{modelConfig.message}</p>
            <p className="text-xs text-slate-400 mb-5 tracking-wide">{modelConfig.tamilMessage}</p>
            <button
              type="button"
              autoFocus
              onClick={(e) => {
                e.preventDefault();
                closemodelAndResetFocus();
              }}
              className={`w-full text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-md transition outline-none focus:ring-4 flex flex-col items-center justify-center ${modelConfig.isError ? 'bg-red-600 hover:bg-red-700 focus:ring-red-100' : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-100'}`}
            >
              <span>OK [ENTER]</span>
              <span className="text-xs font-normal opacity-90">சரி</span>
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY SUB-VIEWS LAYER */}
      {activeView === 'REPORTS' && (
        <ReportsView onClose={() => setActiveView('DASHBOARD')} />
      )}
      {activeView === 'REPRINT' && (
        <ReprintView onClose={() => setActiveView('DASHBOARD')} />
      )}
      {activeView === 'SETTINGS' && (
  <SettingsView onClose={() => setActiveView('DASHBOARD')} />
)}

      {/* FOOTER */}
      <footer className="mt-2 bg-white border border-slate-200 rounded-xl px-4 py-1.5 flex justify-between text-xs font-bold text-slate-500 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-emerald-600 flex items-center gap-1">● Live Interface Online</span>
          <span className="text-slate-300">|</span>
          <span>COM3 Connected</span>
        </div>
        <div>Engine Mode: Laptop Unscrollable v7.3</div>
      </footer>
    </div>
  );
}