import React, { useState, useEffect, useRef } from 'react';
import { printTicketWithDefaultLayout } from './PrinterSettingsManagement';
import { formatDate, formatDateTime, formatTime } from './util';

export default function ReprintView({ onClose }) {
  // Filter States
  const [slipNo, setSlipNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data Lists & Pagination States
  const [transactions, setTransactions] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  // Custom Modal Configuration State
  const [modalConfig, setModalConfig] = useState({
    show: false,
    title: '',
    message: '',
    tamilMessage: '',
    isError: false,
    isConfirm: false,
    onConfirm: null
  });

  // Focus Matrix Refs
  const slipInputRef = useRef(null);
  const vehicleInputRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const filterBtnRef = useRef(null);
  const printBtnRef = useRef(null);
  const tableRowsRef = useRef([]);

  // Helper helper to trigger the custom UI popup modal
  const triggerModalAlert = (title, message, tamilMessage, isError = false, isConfirm = false, onConfirm = null) => {
    setModalConfig({
      show: true,
      title,
      message,
      tamilMessage,
      isError,
      isConfirm,
      onConfirm
    });
  };

  // Core initialization: On loading page, load ONLY the single latest slip
  useEffect(() => {
    fetchLatestTransactionOnOpen();
    if (slipInputRef.current) {
      slipInputRef.current.focus();
    }
  }, []);

  // Watch transactions to auto-focus the first row when data finishes loading
  useEffect(() => {
    if (transactions.length > 0) {
      setTimeout(() => {
        tableRowsRef.current[0]?.focus();
      }, 50);
    }
  }, [transactions]);

  // Global Keyboard Shortcuts for ESC (Close) and ENTER (Print Selection context)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalConfig.show) {
          setModalConfig(prev => ({ ...prev, show: false }));
        } else {
          e.preventDefault();
          onClose();
        }
      }
      
      if (e.key === 'Enter' && !modalConfig.show) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'button' && selectedTicket) {
          e.preventDefault();
          handlePrintCommand(selectedTicket);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose, selectedTicket, modalConfig.show]);

  const fetchLatestTransactionOnOpen = async () => {
    setIsLoading(true);
    
    try {
      console.log("🔍 [Frontend] Requesting only the single latest transaction record...");
      
      const res = await window.api.getReportData({ isLatestOnly: true });
      
      if (res && res.length > 0) {
        const latestRecord = res[0];
        //console.log("Latest recoed is");
        //console.table(latestRecord);
        setTransactions([latestRecord]);
        setSelectedTicket(latestRecord);
        setSlipNo(String(latestRecord.ticket_number || latestRecord.id || ''));
        setCurrentPage(1);
      } else {
        setTransactions([]);
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error("Failed to load the default last transaction slip:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlipSearch = async (e) => {
    if (e) e.preventDefault();
    if (!slipNo || !window.api || !window.api.getReportData) return;

    setIsLoading(true);
    try {
      console.log("🔍 [Frontend] Sending search request for slip number:", slipNo);
      const res = await window.api.getReportData({
        slipFrom: slipNo,
        slipTo: slipNo
      });
      
      if (res && res.length > 0) {
        const sorted = [...res].sort((a, b) => (b.ticket_number || b.id) - (a.ticket_number || a.id));
        setTransactions(sorted);
        setSelectedTicket(sorted[0]);
        setCurrentPage(1);
      } else {
        setTransactions([]);
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error("Error performing slip database search loop:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvancedFilterSearch = async (e) => {
    if (e) e.preventDefault();
    if (!window.api || !window.api.getReportData) return;

    setIsLoading(true);
    try {
      const res = await window.api.getReportData({
        vehicle_number: vehicleNo.trim().toUpperCase() || null,
        dateFrom: startDate || null,
        dateTo: endDate || null
      });
      
      if (res && res.length > 0) {
        const sorted = [...res].sort((a, b) => (b.ticket_number || b.id) - (a.ticket_number || a.id));
        setTransactions(sorted);
        setSelectedTicket(sorted[0]); 
        setCurrentPage(1);
      } else {
        setTransactions([]);
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error("Advanced relational data load sequence aborted:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterKeyRoute = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextRef?.current?.focus();
    }
  };

  // Table Key Navigation Logic: Updates the selected state immediately with moving arrows
  const handleTableKeyDown = (e, index, rowData) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = tableRowsRef.current[index + 1];
      if (nextRow) {
        nextRow.focus();
        setSelectedTicket(currentRecords[index + 1]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = tableRowsRef.current[index - 1];
      if (prevRow) {
        prevRow.focus();
        setSelectedTicket(currentRecords[index - 1]);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setSelectedTicket(rowData);
      setTimeout(() => {
        printBtnRef.current?.focus();
      }, 60);
    }
  };

  const handlePrintCommand = (ticket) => {
    if (!ticket) return;

    const slipId = ticket.ticket_number || ticket.id;
    const vNo = ticket.vehicle_number || 'Unknown';
    
    triggerModalAlert(
      "⚠️ Confirm Print / அச்சு உறுதிப்படுத்தல்",
      `Confirm Thermal Reprint Request?\n\nSlip Number: #${slipId}\nVehicle Number: ${vNo}`,
      `ரசீது எண் #${slipId} மற்றும் வாகன எண் ${vNo} ஐ மீண்டும் அச்சிட வேண்டுமா?`,
      false,
      true,
      () => executePrintPipeline(ticket)
    );
  };

  const executePrintPipeline = async (ticket) => {
    console.log(JSON.stringify(ticket, null, 2));
    const slipId = ticket.ticket_number || ticket.id;
    const calculatedNet = ticket.first_weight && ticket.first_weight > 0 ? Math.abs(ticket.first_weight - ticket.current_weight) : '';
    setModalConfig(prev => ({ ...prev, show: false }));

    const formattedPrintData = {
      ticketNo: ticket.ticket_number,
      vehicleNo: ticket.vehicle_number,
      material: ticket.material_id,
      party: ticket.party_name,
      gross: ticket.first_weight,
      tare: ticket.current_weight,
      net: calculatedNet && calculatedNet > 0 ? calculatedNet : '',
      time: formatTime(ticket.created_at),
      date: formatDate(ticket.created_at),
      charges: ticket.charges_amount,
      ...ticket
    };

    try {
      await printTicketWithDefaultLayout(formattedPrintData);
      triggerModalAlert(
        "ℹ️ Success / வெற்றி", 
        `Receipt #${slipId} sent to the thermal driver module.`,
        `ரசீது #${slipId} அச்சுப்பொறிக்கு அனுப்பப்பட்டது.`
      );
    } catch (err) {
      triggerModalAlert("❌ Error / பிழை", "Printing command pipeline failure: " + err.message, "அச்சிடுவதில் பிழை ஏற்பட்டது.", true);
    }
  };

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = transactions.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(transactions.length / recordsPerPage);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-slate-100 w-full h-full max-w-7xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER BAR */}
        <header className="bg-white px-6 py-3 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-black text-amber-700 flex items-center gap-2">📦 REPRINT RECEIPT / ரசீது மறுஅச்சு</h2>
            <p className="text-xs font-bold text-slate-400">Search, verify database fields, and repeat thermal output printing streams.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              ref={printBtnRef}
              type="button"
              disabled={!selectedTicket}
              onClick={() => handlePrintCommand(selectedTicket)}
              className={`px-6 py-2 rounded-xl font-black text-sm transition flex items-center gap-2 shadow outline-none focus:ring-4 focus:ring-amber-300 ${selectedTicket ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              🖨️ PRINT SELECTED [ENTER]
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-black text-sm transition shadow-sm"
            >
              ✕ CLOSE [ESC]
            </button>
          </div>
        </header>

        {/* CONTROLS SUB-GRID */}
        <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-12 gap-4 shrink-0 shadow-sm">
          <form onSubmit={handleSlipSearch} className="col-span-4 border-r border-slate-200 pr-4 flex flex-col justify-end gap-1.5">
            <label className="text-xs font-black text-slate-500 uppercase">Search By Slip Number</label>
            <div className="flex gap-2">
              <input 
                ref={slipInputRef}
                type="text"
                value={slipNo}
                onChange={(e) => setSlipNo(e.target.value)}
                className="flex-grow border-2 border-slate-200 rounded-lg px-3 py-1.5 font-mono text-base font-black text-amber-800 focus:border-amber-500 outline-none transition bg-slate-50"
                placeholder="Slip #"
              />
              <button 
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 rounded-lg text-sm transition tracking-wider shadow"
              >
                FIND
              </button>
            </div>
          </form>

          <form onSubmit={handleAdvancedFilterSearch} className="col-span-8 grid grid-cols-12 gap-3 items-end">
            <div className="col-span-4 flex flex-col gap-1">
              <label className="text-xs font-black text-slate-500 uppercase">Vehicle No</label>
              <input 
                ref={vehicleInputRef}
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                onKeyDown={(e) => handleEnterKeyRoute(e, startDateRef)}
                className="w-full border-2 border-slate-200 rounded-lg px-3 py-1.5 font-black text-base focus:border-indigo-500 outline-none transition bg-slate-50 uppercase"
                placeholder="TN69AB1234"
              />
            </div>

            <div className="col-span-3 flex flex-col gap-1">
              <label className="text-xs font-black text-slate-500 uppercase">Start Date</label>
              <input 
                ref={startDateRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onKeyDown={(e) => handleEnterKeyRoute(e, endDateRef)}
                className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 font-bold text-sm focus:border-indigo-500 outline-none transition bg-slate-50"
              />
            </div>

            <div className="col-span-3 flex flex-col gap-1">
              <label className="text-xs font-black text-slate-500 uppercase">End Date</label>
              <input 
                ref={endDateRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onKeyDown={(e) => handleEnterKeyRoute(e, filterBtnRef)}
                className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 font-bold text-sm focus:border-indigo-500 outline-none transition bg-slate-50"
              />
            </div>

            <div className="col-span-2">
              <button 
                ref={filterBtnRef}
                type="submit"
                className="w-full h-[38px] bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-sm transition tracking-wider shadow uppercase outline-none focus:ring-2 focus:ring-indigo-300"
              >
                FILTER
              </button>
            </div>
          </form>
        </div>

        {/* WORKSPACE SECTOR */}
        <div className="flex-grow flex flex-col p-4 overflow-hidden min-h-0 bg-white border border-slate-200 m-3 rounded-xl shadow-sm">
          <div className="p-2 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-500 uppercase tracking-wider shrink-0">
            Matched Records Ledger / தரவுப்பட்டியல்
          </div>
          
          <div className="flex-grow overflow-y-auto minimal-scrollbar min-h-0">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 bg-slate-800 text-white z-10 font-bold text-xs uppercase">
                <tr>
                  <th className="p-2.5 w-[9%]">Slip #</th>
                  <th className="p-2.5 w-[14%]">Vehicle No</th>
                  <th className="p-2.5 w-[18%]">Date & Time</th>
                  <th className="p-2.5 w-[13%] text-right">First Wt</th>
                  <th className="p-2.5 w-[13%] text-right">Second Wt</th>
                  <th className="p-2.5 w-[14%] text-right">Net Weight</th>
                  <th className="p-2.5 w-[9%] text-center">Mode</th>
                  <th className="p-2.5 w-[10%] text-right pr-4">Charges</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400 font-medium italic">Fetching data records...</td>
                  </tr>
                ) : currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400 font-medium italic">No matched transactions inside table layer.</td>
                  </tr>
                ) : (
                  currentRecords.map((row, index) => {
                    const isSelected = selectedTicket?.ticket_number === row.ticket_number || selectedTicket?.id === row.id;
                    const isDualWeight = !!(row.previous_weighing_id);
                    const dbFirstWeight = row.first_weight ?? row.firstWeightRaw ?? row.firstWeight;

                    let firstWeight = 0;
                    if (isDualWeight) {
                      if (dbFirstWeight && parseInt(dbFirstWeight) > 0) {
                        firstWeight = dbFirstWeight;
                      } else {
                        const matchedParent = transactions.find(item => (item.id === row.previous_weighing_id || item.ticket_number === row.previous_weighing_id));
                        firstWeight = matchedParent ? matchedParent.current_weight : 0;
                      }
                    } else {
                      firstWeight = row.current_weight || 0;
                    }

                    const secondWeight = isDualWeight 
                      ? (row.current_weight || 0) 
                      : '---';

                    const netWeight = isDualWeight 
                      ? Math.abs(parseFloat(secondWeight) - parseFloat(firstWeight)) 
                      : (row.current_weight || 0);

                    return (
                      <tr 
                        ref={el => tableRowsRef.current[index] = el}
                        tabIndex={0}
                        key={row.id || row.ticket_number} 
                        onClick={() => setSelectedTicket(row)}
                        onKeyDown={(e) => handleTableKeyDown(e, index, row)}
                        className={`cursor-pointer transition outline-none border-b border-slate-100 ${
                          isSelected 
                            ? '!bg-amber-100 text-amber-950 border-y-2 border-amber-400 shadow-sm focus:bg-amber-200' 
                            : 'hover:bg-slate-100/90 focus:bg-slate-200'
                        }`}
                      >
                        <td className="p-2.5 font-mono text-xs font-black">#{row.ticket_number || row.id}</td>
                        <td className="p-2.5 truncate uppercase font-extrabold text-slate-900">
                          {row.vehicle_number}
                        </td>
                        <td className="p-2.5text-right font-mono text-sm font-black text-slate-800 tabular-nums">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-sm font-black text-slate-800 tabular-nums">
                          {parseInt(firstWeight).toLocaleString()} kg
                        </td>
                        <td className="p-2.5 text-right font-mono text-sm font-black text-slate-800 tabular-nums">
                          {secondWeight !== '---' ? `${parseInt(secondWeight).toLocaleString()} kg` : '---'}
                        </td>
                        <td className="p-2.5 text-right font-mono text-sm font-black tracking-tight text-slate-900 tabular-nums">
                          {parseInt(netWeight).toLocaleString()} kg
                        </td>
                        <td className="p-2.5 text-center font-mono text-xs text-slate-500">
                          {row.payment_mode || 'CASH'}
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900 tabular-nums pr-4">
                          ₹{parseFloat(row.charges_amount || 0).toFixed(0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* DYNAMIC PAGINATION CONTROL BAR */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0 mt-2 rounded-lg">
              <span className="text-xs text-slate-500 font-bold">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, transactions.length)} of {transactions.length} Records
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1 bg-white text-slate-700 text-xs font-black rounded-md border border-slate-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ◀ PREV
                </button>
                <span className="px-3 py-1 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1 bg-white text-slate-700 text-xs font-black rounded-md border border-slate-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  NEXT ▶
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CUSTOM POPUP DIALOG MODULE */}
      {modalConfig.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <h3 className={`text-base font-black uppercase tracking-wide flex items-center gap-2 ${modalConfig.isError ? 'text-rose-600' : 'text-slate-800'}`}>
              {modalConfig.title}
            </h3>
            
            <div className="flex flex-col gap-2 font-mono text-sm font-bold text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">
              <p className="whitespace-pre-wrap">{modalConfig.message}</p>
              {modalConfig.tamilMessage && (
                <p className="text-xs text-amber-800 font-sans border-t border-slate-200 pt-2 mt-1">{modalConfig.tamilMessage}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-2">
              {modalConfig.isConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition"
                  >
                    CANCEL / ரத்து
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={modalConfig.onConfirm}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-lg transition shadow"
                  >
                    YES, PRINT / அச்சிடு
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  autoFocus
                  onClick={() => setModalConfig(prev => ({ ...prev, show: false }))}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg transition shadow"
                >
                  OK / சரி
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}