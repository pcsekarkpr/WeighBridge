import React, { useState, useRef, useEffect } from 'react';
import MasterDataManagement from './MasterDataManagement';
import PrinterSettingsManagement from './PrinterSettingsManagement';
import WhatsAppModal from './WhatsAppModal';


export default function SettingsView({ onClose }) {
  const [settingsSubView, setSettingsSubView] = useState('MAIN'); 
  
  // Modal State
  const [isTareModalOpen, setIsTareModalOpen] = useState(false);
  const [vehicleNo, setVehicleNo] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);

  // Focus Refs
  const vehicleInputRef = useRef(null);
  const tareWeightInputRef = useRef(null);
  const saveButtonRef = useRef(null);

  // 1. Handle Esc key specially for Modal vs Main view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isTareModalOpen) {
          e.stopPropagation(); // Stops event from bubbling to parent handlers
          setIsTareModalOpen(false);
        } else if (settingsSubView === 'MAIN') {
          e.preventDefault();
          onClose(); // Exit Settings to main dashboard
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTareModalOpen, settingsSubView, onClose]);

  // 2. Focus Vehicle No input automatically on Modal open
  useEffect(() => {
    if (isTareModalOpen) {
      const timer = setTimeout(() => {
        vehicleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isTareModalOpen]);

  const handleSaveTareWeight = async (e) => {
    e.preventDefault();
    if (!vehicleNo.trim() || !tareWeight || parseFloat(tareWeight) <= 0) {
      alert('Please enter a valid vehicle number and weight.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      vehicleNumber: vehicleNo.trim().toUpperCase(),
      mobileNumber: null,
      materialId: null,
      partyId: null,
      currentWeight: parseFloat(tareWeight),
      loadStatus: 'Tare',
      previousWeighingId: null,
      paymentMode: 'CASH',
      chargesAmount: 0.00
    };

    try {
      if (window.api && window.api.saveTicket) {
        const savedTicketResponse = await window.api.saveTicket(payload);
        alert(`Tare Weight saved successfully! Ticket No: ${savedTicketResponse?.ticketNo || 'N/A'}`);
      } else {
        alert("Saved in UI mode!");
      }

      setVehicleNo('');
      setTareWeight('');
      setIsTareModalOpen(false);
    } catch (error) {
      console.error("Failed to save Tare weight:", error);
      alert("Failed to save tare weight. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (settingsSubView === 'MASTERS') {
    return <MasterDataManagement onBack={() => setSettingsSubView('MAIN')} />;
  }

  if (settingsSubView === 'PRINTER') {
    return <PrinterSettingsManagement onBack={() => setSettingsSubView('MAIN')} />;
  }

  return (
    <div className="fixed inset-0 bg-slate-100 z-40 flex flex-col p-4 font-sans select-none overflow-hidden h-screen w-screen">
      {/* Header */}
      <header className="bg-white rounded-xl shadow-sm px-6 py-3 flex justify-between items-center mb-4 border border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 flex items-center gap-2">
            <span>⚙️ System Control Panel</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 tracking-wider">CONFIGURATION & REGISTERS</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="bg-slate-800 hover:bg-slate-900 text-white font-black px-5 py-2 rounded-xl text-sm shadow transition flex flex-col items-center justify-center border border-slate-950"
        >
          <span>✕ CLOSE SETTINGS</span>
          <span className="text-[10px] font-medium opacity-70">[ESC]</span>
        </button>
      </header>

      {/* Main Settings Navigation */}
      <div className="flex-grow flex items-center justify-center max-w-6xl mx-auto w-full px-4">
        <div className="grid grid-cols-3 gap-6 w-full">
          <button
            type="button"
            onClick={() => setSettingsSubView('MASTERS')}
            className="bg-white hover:bg-indigo-50/50 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-64 group outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">
              👥
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">Parties & Materials</h2>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Add, manage, and delete customer names and raw material variants from a consolidated single-screen register.
              </p>
            </div>
            <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase group-hover:translate-x-1 transition">
              Open Master Management →
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsSubView('PRINTER')}
            className="bg-white hover:bg-amber-50/50 border-2 border-slate-200 hover:border-amber-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-64 group outline-none focus:ring-4 focus:ring-amber-100"
          >
            <div className="w-14 h-14 bg-amber-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">
              🖨️
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">Printer Profiles</h2>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Configure ticket layout setups, serial parameters, toggle auto-print engines, and choose target hardware environments.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 tracking-wider uppercase group-hover:translate-x-1 transition">
              Configure Print Engine →
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsTareModalOpen(true)}
            className="bg-white hover:bg-emerald-50/50 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-64 group outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">
              ⚖️
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">Add Tare Weight</h2>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Manually record fixed empty vehicle tare weights into the weighing transaction database for future reference.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase group-hover:translate-x-1 transition">
              Record Tare Weight →
            </span>
          </button>
              {/* WhatsApp Integration */}
          <button
            type="button"
            onClick={() => setIsWhatsAppOpen(true)}
            className="bg-white hover:bg-pink-50/60 border-2 border-slate-200 hover:border-pink-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition text-left flex flex-col justify-between h-64 group outline-none focus:ring-4 focus:ring-emerald-100"
          >
            <div className="w-14 h-14 bg-pink-100 text-red-600 rounded-xl flex items-center justify-center text-3xl group-hover:scale-110 transition">
              💬
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">WhatsApp Config</h2>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Link WhatsApp Web via QR code to automatically send weighment receipts and slip notifications to customers.
              </p>
            </div>
            <span className="text-xs font-bold text-pink-600 tracking-wider uppercase group-hover:translate-x-1 transition flex items-center gap-1">
              <span>Scan QR Code</span>
              <span>→</span>
            </span>
          </button>
        </div>
      </div>
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
      />
     

      {/* Tare Weight Input Modal */}
      {isTareModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-black text-lg flex items-center gap-2">
                <span>⚖️</span> Record Manual Tare Weight
              </h3>
              <button 
                type="button"
                onClick={() => setIsTareModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTareWeight} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Vehicle Number <span className="text-red-500">*</span>
                </label>
                <input
                  ref={vehicleInputRef}
                  type="text"
                  required
                  placeholder="e.g. TN 76 A 1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      tareWeightInputRef.current?.focus();
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none font-bold text-slate-800 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                  Tare Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  ref={tareWeightInputRef}
                  type="number"
                  required
                  step="0.01"
                  min="1"
                  placeholder="e.g. 4500"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveButtonRef.current?.focus();
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none font-bold text-slate-800"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsTareModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition"
                >
                  Cancel
                </button>
                <button
                  ref={saveButtonRef}
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow transition disabled:opacity-50 focus:ring-4 focus:ring-emerald-200 focus:outline-none"
                >
                  {isSubmitting ? 'Saving...' : 'Save Tare Weight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}