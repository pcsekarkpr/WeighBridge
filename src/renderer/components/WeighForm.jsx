import React, { useState, useEffect, useRef } from 'react';
import ReportsView from './reports'; 
import ReprintView from './reprint'; 
import SettingsView from './settings';
import { useModelAlert } from './useModelAlert';
import AlertModel from './AlertModel';
import { printTicketWithDefaultLayout } from './PrinterSettingsManagement';
import { formatDateTime } from './util';
//import { createLogger } from 'vite';

export default function WeighbridgeDashboard() {
  const { modelConfig, triggerModelAlert, closeModelAlert } = useModelAlert();

  const mainVehicleInputRef = useRef(null);
  const [showReprint, setShowReprint] = useState(false);
  
  // Core Form Input State
  const [activeView, setActiveView] = useState('DASHBOARD'); 
  const [vehicleNo, setVehicleNo] = useState('');
  const [linkedTicketNo, setLinkedTicketNo] = useState('');
  const [loadStatus, setLoadStatus] = useState('Gross'); 
  const [materialInput, setMaterialInput] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH'); 

  // Weight Measurement & Capture Controls
  const [liveWeight, setLiveWeight] = useState(0); 
  const [lockedWeight, setLockedWeight] = useState(null); 
  const [previousWeight, setPreviousWeight] = useState(0);
  const [netWeight, setNetWeight] = useState(0);

  // Master Lists & Logs Data State
  const [materialsList, setMaterialsList] = useState([]);
  const [partiesList, setPartiesList] = useState([]);
  const [historyWeights, setHistoryWeights] = useState([]);

  // Ref tracking the timestamp of the last Escape key stroke
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
    saveBtn: useRef(null),
    fetchBtn:useRef(null)
  };

  // Sync Dropdown Masters on Startup
  const loadMasterData = async () => {
    if (window.api && window.api.getDropdownMasters) {
      try {
        const masters = await window.api.getDropdownMasters();
        setMaterialsList(masters.materials || []);
        setPartiesList(masters.parties || []);
      } catch (err) {
        console.error("Failed to load Master lists:", err);
      }
    }
  };

  useEffect(() => {
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

  // Focus vehicle input on dashboard return
  useEffect(() => {
    if (activeView === 'DASHBOARD') {
      setTimeout(() => {
        if (fieldRefs.vehicleNo.current) {
          fieldRefs.vehicleNo.current.focus();
        }
      }, 50);
    }
  }, [activeView]);

  // Helper to apply data from a selected or fetched ticket record
  const applySlipData = (record) => {
    if (!record) return;
    console.table(record);
    const oldRecordWeight = 
    parseInt(record.gross) || 
    parseInt(record.tare) || 
    parseInt(record.current_weight) || 
    0;

    // 1. Previous Weight
    //const w = parseInt(record.gross) || 0;
    setPreviousWeight(oldRecordWeight);

    console.table(record);

    // 2. Material
    if (record.material_id) {
      setMaterialInput((record.material_id).toUpperCase());
    }

    // 3. Customer / Party
    if (record.party_name) {
      setPartyInput((record.party_name .toUpperCase()));
    }

    // 4. Mobile Number
    if (record.mobile_number) {
      setMobileNo(record.mobile_number);
    }

    //setPreviousWeight(record.current_weight);
    // 5. Invert Load Status: Select the other value than the load status of link slip #
    const origStatus = (record.load_status || record.status || '').toUpperCase();
    if (origStatus === 'GROSS' || origStatus === 'LOADED') {
      setLoadStatus('Tare');
    } else if (origStatus === 'TARE' || origStatus === 'EMPTY' || origStatus === 'UNLOADED') {
      setLoadStatus('Gross');
    }
  };

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
    console.log("previous Txn "+ record.toLocaleString);
    applySlipData(record);
  };

  const handleTicketIdLookup = async (tNo) => {
    setLinkedTicketNo(tNo);
    if (!tNo) {
      setPreviousWeight(0);
      return;
    }

    // Check existing local history list first
    console.log("Checking for slip #"+tNo);
    const matched = historyWeights.find(r => String(r.ticketNo) === String(tNo));
    if (matched) {
      applySlipData(matched);
      return;
    }

    // If not found in current history list, query DB directly
    if (window.api) {
      try {
            console.log("Checking for slip # in the table"+tNo);

        //let fetchedRecord = null;
        const response = await window.api.getReportData({
        slipFrom: tNo,
        slipTo: tNo
      });

       /* if (window.api.getTicketById) {
          fetchedRecord = await window.api.getTicketById(tNo);
        } else if (window.api.getVehicleHistoryByTicket) {
          fetchedRecord = await window.api.getVehicleHistoryByTicket(tNo);
        }*/
        let fetchedRecord = Array.isArray(response)?response[0]:response;
        if (fetchedRecord) {
                      console.log("got the response for :"+tNo);

          // If vehicleNo was empty or different, set it and refresh vehicle history
          const fetchedVeh = fetchedRecord.vehicle_number || fetchedRecord.vehicleNo;
          if (fetchedVeh) {
            setVehicleNo(fetchedVeh.toUpperCase());
            const newHistory = await window.api.getVehicleHistory(fetchedVeh);
            if (newHistory && newHistory.length > 0) {
              setHistoryWeights(newHistory);
            }
          }
          applySlipData(fetchedRecord);
        } else {
          setPreviousWeight(0);
        }
      } catch (err) {
        console.error("DB Lookup failed for slip #:", err);
        setPreviousWeight(0);
      }
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

      if (e.key === 'Escape') {
        e.preventDefault();
        
        if (modelConfig.show) {
          closeModelAndResetFocus();
          return;
        }

        if (activeView === 'REPORTS' || activeView === 'REPRINT') {
          const currentTime = Date.now();
          if (currentTime - lastEscPressTime.current < 500) {
            setActiveView('DASHBOARD');
          } else {
            lastEscPressTime.current = currentTime;
          }
          return;
        }

        resetFormValues();
        return;
      }

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

  const closeModelAndResetFocus = () => {
    const standardReset = !modelConfig.isError;
    closeModelAlert();
    
    if (standardReset) {
      resetFormValues();
    } else {
      setTimeout(() => fieldRefs.vehicleNo.current?.focus(), 100);
    }
  };

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

    const currentActiveWeight = lockedWeight !== null ? lockedWeight : liveWeight;
    const finalMaterialName = materialInput.trim().toUpperCase();
    const finalPartyName = partyInput.trim().toUpperCase();

    let partyId = null;

    // Auto-insert new Party into database if not found in existing master list
    if (finalPartyName) {
      const matchedParty = partiesList.find(p => p.party_name?.toUpperCase() === finalPartyName);
      if (matchedParty) {
        partyId = matchedParty.id;
      } else if (window.api && window.api.addParty) {
        try {
          const newPartyRes = await window.api.addParty(finalPartyName );
          console.log("party id is :");
          console.table(newPartyRes);

          partyId = newPartyRes?.partyId?? null;
          await loadMasterData(); // Refresh local list
        } catch (pErr) {
          console.warn("Could not auto-add party record:", pErr);
        }
      }
    }

    // Weight calculations
    let calculatedGross = 0;
    let calculatedTare = 0;

    //if (loadStatus.toUpperCase() === 'GROSS') {
    //  calculatedGross = currentActiveWeight;
    //  calculatedTare = previousWeight > 0 ? previousWeight : 0;
    //} else {
    //  calculatedTare = currentActiveWeight;
    //  calculatedGross = previousWeight > 0 ? previousWeight : 0;
    //}

    const calculatedNet = (calculatedGross > 0 && calculatedTare > 0) 
      ? Math.abs(calculatedGross - calculatedTare) 
      : 0;

    const payload = {
      vehicleNumber: vehicleNo,
      mobileNumber: mobileNo || null,
      materialId: finalMaterialName || null,
      partyId: partyId,
      currentWeight: currentActiveWeight,
      loadStatus: loadStatus,
      previousWeighingId: linkedTicketNo || null,
      paymentMode: paymentMode,
      chargesAmount: amount || 0.00
    };

    let activeTicketId = 0;
    if (window.api && window.api.saveTicket) {
      try {
        const savedTicketResponse = await window.api.saveTicket(payload);
        
        console.log("Total rows is :"+ JSON.stringify(savedTicketResponse, null, 2));
        activeTicketId = savedTicketResponse?.ticketNo || "89421";
      } catch (err) {
        console.error("Transaction save error:", err);
        triggerModelAlert(
          "Printing / Database Error",
          "Failed to process transaction save operations.",
          "தரவுத்தளத்தில் சேமிக்க  முடியவில்லை.",
          true,
          false
        );
      }
      ///let First Weight: Historical weight if linked ticket exists, otherwise active scale weight
      const firstWeight = linkedTicketNo ? previousWeight : activeCurrentWeight;

        // Second Weight: Active scale weight if linked ticket exists, otherwise 0
      const secondWeight = linkedTicketNo ? activeCurrentWeight : 0;
      const ntWeight = Math.abs(secondWeight - firstWeight);

      try{
        
        const printData = {
          ticketNo: activeTicketId,
          vehicleNo: vehicleNo,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          material: finalMaterialName,
          party: finalPartyName,
          gross: calculatedGross ? String(firstWeight) : '',
          tare: calculatedTare ? String(secondWeight) : '',
          net: calculatedNet ? String(ntWeight) : '',
          charges: amount ? String(amount) : '150.00'
        };

        const shouldPrint = await triggerModelAlert(
          "Ticket Saved Successfully",
          `Ticket #${activeTicketId} saved. Do you want to print it?`,
          "சீட்டு வெற்றிகரமாக சேமிக்கப்பட்டது. இதை அச்சிட விரும்புகிறீர்களா?",
          false,
          true
        );

        if (shouldPrint) {
          await printTicketWithDefaultLayout(printData);
        }
      } 
      catch (err) {
        console.error("Transaction save/print error:", err);
        triggerModelAlert(
          "Printing / Database Error",
          "Failed to process transaction print operations.",
          "தரவுத்தளத்தில்  அச்சிட முடியவில்லை.",
          true,
          false
        );
      }
      console.log("Mobile no to send:"+mobileNo);
      

      try{
        if(mobileNo)
        {
          //console.log("Mobile no to send:"+mobileNo);
          let smsMessage =  "P.C. Weighbridge\nVeh:"+ payload.vehicleNumber + "\nFirstWt : "+ firstWeight +" kg";
          if( secondWeight != ""){
              smsMessage = smsMessage + "\nSecondWt: "+ secondWeight +" kg\nNet: "+ ntWeight+" kg\n";
          }
          smsMessage = smsMessage + "Amt: Rs."+ payload.chargesAmount;
          console.log("SMS Message is :"+ smsMessage);
          const smsPayload = {
            phoneNumber:mobileNo,
            message:smsMessage
          };

          // 2. Trigger web SMS asynchronously
          await window.api.sendWhatsApp({
            phone: mobileNo,
            message: smsMessage
          });
          //const response = await window.api.sendSms(smsPayload);
          console.log("Able to send SMS");
          triggerModelAlert(
           "SMS Sent Successfully",
            "SMS sent successfully! / எஸ்.எம்.எஸ் வெற்றிகரமாக அனுப்பப்பட்டது!",
            "எஸ்.எம்.எஸ் வெற்றிகரமாக அனுப்பப்பட்டது",
            false,
          false
          );
        }
      } catch (err) {
        console.error("Transaction sms:", err);
        triggerModelAlert(
         "SMS Error",
          "Failed to send SMS / எஸ்.எம்.எஸ் அனுப்ப முடியவில்லை",
          "SMS அனுப்ப முடியவில்லை" + err,
          true,
          false
        );
      }
        resetFormValues();
    }
  };

const activeCurrentWeight = lockedWeight !== null ? lockedWeight : liveWeight;

// First Weight: Historical weight if linked ticket exists, otherwise active scale weight
const displayFirstWeight = linkedTicketNo ? previousWeight : activeCurrentWeight;

// Second Weight: Active scale weight if linked ticket exists, otherwise 0
const displaySecondWeight = linkedTicketNo ? activeCurrentWeight : 0;

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

      {/* DASHBOARD WORKSPACE */}
      <div className="grid grid-cols-12 gap-2 flex-grow overflow-hidden min-h-0 items-stretch">
        {/* COLUMN 1: INPUT PANELS */}
        <div className="col-span-6 bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex flex-col justify-between overflow-hidden">
          <div className="flex flex-col gap-4 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5 shrink-0">Transaction Details / விவரங்கள்</h3>
            
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-bold text-slate-700 w-40 shrink-0 flex flex-col">
                <span className="text-base">Vehicle No *</span>
                <span className="text-xs font-bold text-slate-700">வண்டி எண்</span>
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
  
  <div className="flex gap-2 flex-grow">
    {/* Input box size reduced using a fixed/max width or lower flex ratio */}
    <input 
      ref={fieldRefs.linkedTicketNo}
      type="text"
      value={linkedTicketNo}
      onChange={(e) => setLinkedTicketNo(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (linkedTicketNo && linkedTicketNo.trim() !== '') {
            fieldRefs.fetchBtn?.current?.focus();
          } else {
            fieldRefs.loadStatus?.current?.focus();
          }
        }
      }}
      className="w-48 border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold text-indigo-700 focus:border-emerald-500 outline-none transition shadow-sm"
    />

    {/* Fetch Button expanded to match the UNLOCK button width */}
    <button
      ref={fieldRefs.fetchBtn}
      type="button"
      onClick={() => handleTicketIdLookup(linkedTicketNo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleTicketIdLookup(linkedTicketNo);
          fieldRefs.loadStatus?.current?.focus();
        }
      }}
      className="flex-grow py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 outline-none transition"
    >
      Fetch
    </button>
  </div>
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
                  onChange={(e) => setMaterialInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.partyName)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold uppercase focus:border-emerald-500 outline-none bg-white transition shadow-sm"
                />
                <datalist id="materials-options">
                  {materialsList.map((m) => (
                    <option key={m.id || m.material_name} value={m.material_name} />
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
                  onChange={(e) => setPartyInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => handleEnterNavigation(e, fieldRefs.mobileNo)}
                  className="w-full border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-base font-bold uppercase focus:border-emerald-500 outline-none bg-white transition shadow-sm"
                />
                <datalist id="parties-options">
                  {partiesList.map((p) => (
                    <option key={p.id || p.party_name} value={p.party_name} />
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
                <tr className="text-slate-400 font-bold text-sm uppercase border-b border-slate-100">
                  <th className="p-2 w-[28%]">Slip No</th>
                  <th className="p-2 text-center w-[38%]">தேதி / Date</th>
                  <th className="p-2 text-right w-[34%]">Weight</th>
                </tr>
              </thead>
              <tbody className="text-lg font-bold text-slate-700 divide-y divide-slate-100">
                {historyWeights.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-slate-400 font-medium text-base italic">
                      No history found
                    </td>
                  </tr>
                ) : (
                  historyWeights.map((row, idx) => (
        <tr 
          key={idx} 
          onClick={() => handleSelectOldTransaction(row)}
          className={`cursor-pointer transition ${
            String(linkedTicketNo) === String(row.ticketNo) 
              ? 'bg-amber-50 hover:bg-amber-100' 
              : 'hover:bg-slate-50'
          }`}
        >
          {/* Column 1: Slip No */}
          <td className="p-2 font-mono text-emerald-700 font-black truncate text-base">
            #{row.ticketNo}
          </td>

          {/* Column 2: Date & Time (Centered) */}
          <td className="p-2 text-center text-sm font-semibold text-slate-500 tabular-nums truncate whitespace-nowrap">
            {formatDateTime(row)}
          </td>

          {/* Column 3: Weight (Right-aligned) */}
          <td className="p-2 text-right font-black text-slate-900 tracking-tight tabular-nums text-base truncate whitespace-nowrap">
            {(parseInt(row.gross) || parseInt(row.tare) || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">kg</span>
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