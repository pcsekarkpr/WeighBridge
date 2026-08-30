import React, { useState, useEffect, useRef } from 'react';

export default function ReportsView({ onClose }) {
  // Search Filter Criteria Fields
  const [vehicleNo, setVehicleNo] = useState('');
  const [slipFrom, setSlipFrom] = useState('');
  const [slipTo, setSlipTo] = useState('');
  const [partyInput, setPartyInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Animation Trigger State for Enter Keypresses
  const [isSearchPressed, setIsSearchPressed] = useState(false);

  // Dropdown Master Collections
  const [partiesList, setPartiesList] = useState([]);

  // Database Query Output States
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    uniqueVehicles: 0,
    totalFee: 0,
    cashTotal: 0,
    upiTotal: 0
  });

  // PAGINATION STATES
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50); // You can change this to 25 or 10 to test it with 28 rows!

  // Sequential Refs for Enter Key Navigation Matrix
  const vehicleNoRef = useRef(null);
  const slipFromRef = useRef(null);
  const slipToRef = useRef(null);
  const partyNameRef = useRef(null);
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const searchBtnRef = useRef(null);

  // Keep a stable ref for onClose to avoid re-triggering the useEffect hook
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // RUNS ONCE ON MOUNT: Sync Dropdown Masters, Date baselines, and Listeners
  useEffect(() => {
    if (window.api && window.api.getDropdownMasters) {
      window.api.getDropdownMasters()
        .then(m => setPartiesList(m.parties || []))
        .catch(err => console.error("Failed to fetch dropdown masters for reports:", err));
    }
    
    const today = new Date().toISOString().split('T')[0];
    setDateFrom(today);
    setDateTo(today);

    // Initial focus happens exactly once on startup
    setTimeout(() => {
      vehicleNoRef.current?.focus();
    }, 100);

    // Global Key Listener for ESC key close action
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []); 

  const triggerSearchAnimation = () => {
    setIsSearchPressed(true);
    setTimeout(() => {
      setIsSearchPressed(false);
    }, 120);
  };

  const handleEnterNavigation = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef === searchBtnRef) {
        triggerSearchAnimation();
        handleSearch();
      } else {
        nextRef?.current?.focus();
      }
    }
  };

  const handleSearch = async () => {
    if (!window.api || !window.api.getReportData) {
      console.warn("IPC main process bridge 'window.api.getReportData' is missing.");
      return;
    }

    try {
      const records = await window.api.getReportData({
        vehicle_number: vehicleNo.toUpperCase() || null,
        slipFrom: slipFrom || null,
        slipTo: slipTo || null,
        partyName: partyInput || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      });
      
      setCurrentPage(1); 
      processRecords(records || []);
    } catch (err) {
      console.error("Database reporting lookup failed:", err);
    }
  };

  const processRecords = (records) => {
    setTransactions(records);
    let total = 0, cash = 0, upi = 0;
    const uniqueVehicleSet = new Set();
    
    records.forEach(r => {
      const amt = parseFloat(r.charges_amount) || 0;
      total += amt;
      
      if (r.vehicle_number) {
        uniqueVehicleSet.add(r.vehicle_number.toUpperCase().trim());
      }

      if (String(r.payment_mode).toUpperCase() === 'UPI') {
        upi += amt;
      } else {
        cash += amt;
      }
    });

    setSummary({
      totalCount: records.length,
      uniqueVehicles: uniqueVehicleSet.size,
      totalFee: total,
      cashTotal: cash,
      upiTotal: upi
    });
  };

  // PAGINATION MATHEMATICS CALCULATION LOGIC
  const totalPages = Math.ceil(transactions.length / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  
  // Sliced viewport selection to be mapped in table body layout below
  const currentPagedRows = transactions.slice(indexOfFirstRow, indexOfLastRow);

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-3 h-screen w-screen font-sans text-slate-800 select-none overflow-hidden max-h-screen">
      
      {/* TOP FILTERS CONTROL MATRIX BAR */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 shrink-0 flex flex-col gap-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-2xl font-bold text-indigo-950 tracking-tight">Transaction Reporting Engine <span className="text-base font-medium text-slate-400 pl-1">(அறிக்கை பக்கம்)</span></h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition"
          >
            ✕ Close Dashboard [ESC]
          </button>
        </div>

        {/* ALIGNED FLEX CONTROL ROW */}
        <div className="flex items-end gap-3 flex-wrap xl:flex-nowrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
              Vehicle No <span className="text-xs text-slate-400 font-normal">(வண்டி எண்)</span>
            </label>
            <input 
              ref={vehicleNoRef}
              type="text" 
              value={vehicleNo} 
              onChange={e => setVehicleNo(e.target.value)} 
              onKeyDown={e => handleEnterNavigation(e, slipFromRef)}
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold uppercase focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white placeholder:text-slate-400/70 placeholder:normal-case placeholder:font-normal" 
              placeholder="TN69AB1234" 
            />
          </div>

          <div className="flex gap-2 w-[220px] shrink-0">
            <div className="w-1/2">
              <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
                Slip From <span className="text-xs text-slate-400 font-normal">(முதல்)</span>
              </label>
              <input 
                ref={slipFromRef}
                type="number" 
                value={slipFrom} 
                onChange={e => setSlipFrom(e.target.value)} 
                onKeyDown={e => handleEnterNavigation(e, slipToRef)}
                className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white" 
              />
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
                Slip To <span className="text-xs text-slate-400 font-normal">(வரை)</span>
              </label>
              <input 
                ref={slipToRef}
                type="number" 
                value={slipTo} 
                onChange={e => setSlipTo(e.target.value)} 
                onKeyDown={e => handleEnterNavigation(e, partyNameRef)}
                className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white" 
              />
            </div>
          </div>

          <div className="flex-[1.5] min-w-[240px]">
            <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
              Customer / Party Name <span className="text-xs text-slate-400 font-normal">(வாடிக்கையாளர் பெயர்)</span>
            </label>
            <input 
              ref={partyNameRef}
              list="rep-parties" 
              value={partyInput} 
              onChange={e => setPartyInput(e.target.value)} 
              onKeyDown={e => handleEnterNavigation(e, dateFromRef)}
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white placeholder:text-slate-400/70 placeholder:font-normal" 
              placeholder="All Customers" 
            />
            <datalist id="rep-parties">
              {partiesList.map(p => <option key={p.id} value={p.party_name} />)}
            </datalist>
          </div>

          <div className="w-[180px] shrink-0">
            <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
              Date From <span className="text-xs text-slate-400 font-normal">(ஆரம்ப தேதி)</span>
            </label>
            <input 
              ref={dateFromRef}
              type="date" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)} 
              onKeyDown={e => handleEnterNavigation(e, dateToRef)}
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white" 
            />
          </div>

          <div className="w-[180px] shrink-0">
            <label className="block text-sm font-bold text-slate-600 mb-1.5 whitespace-nowrap">
              Date To <span className="text-xs text-slate-400 font-normal">(முடிவு தேதி)</span>
            </label>
            <input 
              ref={dateToRef}
              type="date" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)} 
              onKeyDown={e => handleEnterNavigation(e, searchBtnRef)}
              className="w-full border-2 border-slate-300 rounded-lg px-3 py-2 text-base font-semibold focus:border-indigo-600 outline-none transition shadow-sm bg-slate-50 focus:bg-white" 
            />
          </div>

          <div className="w-[130px] shrink-0">
            <button 
              ref={searchBtnRef}
              onClick={() => { triggerSearchAnimation(); handleSearch(); }} 
              className={`w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-extrabold text-sm h-[46px] rounded-lg shadow-md tracking-wider uppercase outline-none focus:ring-4 focus:ring-indigo-200 transition-all duration-100 ease-out ${
                isSearchPressed ? 'scale-[0.95] bg-indigo-800' : 'scale-100'
              }`}
            >
              Search [↵]
            </button>
          </div>
        </div>
      </div>

      {/* TWO COLUMN DISPLAY LAYOUT */}
      <div className="grid grid-cols-12 gap-3 flex-grow overflow-hidden mt-3 items-stretch print:block">
        
        {/* COLUMN 1: LIVE DB AGGREGATE SUMMARY */}
        <div className="col-span-4 bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-col justify-between print:hidden">
          <div>
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-1.5 mb-4">
              Summary <span className="text-xs font-normal text-slate-400 italic lowercase">(சுருக்கம்)</span>
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 flex flex-col justify-between">
                  <span className="block text-xs font-bold text-slate-500 min-h-[32px]">Total Slips (மொத்தம்)</span>
                  <span className="text-3xl font-black text-slate-800 tabular-nums block mt-1">
                    {summary.totalCount} <span className="text-sm font-medium text-slate-400">Nos</span>
                  </span>
                </div>
                <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200/60 flex flex-col justify-between">
                  <span className="block text-xs font-bold text-amber-700 min-h-[32px]">Unique Vehicles (வண்டிகள்)</span>
                  <span className="text-3xl font-black text-amber-900 tabular-nums block mt-1">
                    {summary.uniqueVehicles} <span className="text-sm font-medium text-amber-500">Vans</span>
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <span className="block text-sm font-bold text-emerald-700 mb-1">Gross Fee Collected (மொத்த கட்டணம்)</span>
                <span className="text-3xl font-black text-emerald-800 tabular-nums">
                  ₹{summary.totalFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <span className="block text-xs font-extrabold text-blue-600 mb-1">💵 CASH (ரொக்கம்)</span>
                  <span className="text-xl font-black text-blue-950 tabular-nums">
                    ₹{summary.cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <span className="block text-xs font-extrabold text-purple-600 mb-1">📱 UPI (டிஜிட்டல்)</span>
                  <span className="text-xl font-black text-purple-950 tabular-nums">
                    ₹{summary.upiTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={() => window.print()}
            disabled={transactions.length === 0}
            className="w-full bg-slate-900 hover:bg-black text-white font-bold text-base py-3.5 rounded-xl transition shadow-md mt-4 disabled:opacity-40 tracking-wider"
          >
            🖨️ Print Selected Records (அச்சிடுக)
          </button>
        </div>

        {/* COLUMN 2: DATA TABLE LIST WITH FIXED PAGINATION DISPLAY MAP */}
        <div className="col-span-8 bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-col overflow-hidden print:w-full print:border-none print:shadow-none">
          <div className="flex justify-between items-center mb-3 shrink-0 print:hidden">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Detailed Transaction Ledger <span className="text-xs font-normal text-slate-400 italic lowercase">(பரிவர்த்தனை பட்டியல்)</span>
            </h3>
            {transactions.length > 0 && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span>Rows:</span>
                <select 
                  value={rowsPerPage} 
                  onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 outline-none font-semibold text-slate-700 cursor-pointer focus:border-indigo-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="flex-grow overflow-y-auto border border-slate-200 rounded-lg minimal-scrollbar min-h-0 print:overflow-visible shadow-inner">
            <table className="w-full text-left border-collapse table-fixed text-base">
              <thead className="sticky top-0 bg-slate-200 z-10 border-b border-slate-300 print:static print:bg-white">
                <tr className="text-slate-700 font-bold text-sm">
                  <th className="p-3 w-[14%]">Slip # <br/><span className="text-xs text-slate-500 font-normal">சீட்டு எண்</span></th>
                  <th className="p-3 w-[24%]">Vehicle Number <br/><span className="text-xs text-slate-500 font-normal">வண்டி எண்</span></th>
                  <th className="p-3 w-[22%]">First Weight (kg) <br/><span className="text-xs text-slate-500 font-normal">எடை</span></th>
                  <th className="p-3 w-[18%]">Second weight <br/><span className="text-xs text-slate-500 font-normal">நிலை</span></th>
                  <th className="p-3 w-[12%]">Mode <br/><span className="text-xs text-slate-500 font-normal">வகை</span></th>
                  <th className="p-3 text-right w-[14%]">Charges <br/><span className="text-xs text-slate-500 font-normal">கட்டணம்</span></th>
                </tr>
              </thead>
              <tbody className="text-slate-700 font-medium divide-y divide-slate-300/50">
                {currentPagedRows.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-400 text-lg font-medium italic">No transactions found matching criteria parameters</td>
                  </tr>
                ) : (
                  /* FIX EFFECTED HERE: Mapping the paged slice array explicitly */
                  currentPagedRows.map((row, index) => (
                    <tr 
                      key={row.id || (indexOfFirstRow + index)} 
                      className="even:bg-slate-200/60 odd:bg-white hover:bg-indigo-100/50 transition-colors duration-150 print:break-inside-avoid"
                    >
                      <td className="p-3 font-mono text-emerald-800 font-bold text-base">
                        #{row.ticket_number || row.id || (indexOfFirstRow + index + 1)}
                      </td>
                      <td className="p-3 font-bold uppercase text-slate-900 truncate text-base">
                        {row.vehicle_number}
                      </td>
                      <td className="p-3 font-bold text-slate-800 tabular-nums text-base">
                        {(parseInt(row.first_weight) || parseInt(row.current_weight)).toLocaleString()} kg
                      </td>
                      <td className="p-3 text-sm font-semibold text-slate-600">
                        {row.first_weight ? `${(parseInt(row.current_weight) || 0).toLocaleString()} kg` : "-"}                      </td>
                      <td className="p-3 text-sm">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-xs tracking-wide ${String(row.payment_mode).toUpperCase() === 'UPI' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                          {row.payment_mode || 'CASH'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums text-slate-900 text-base">
                        ₹{(parseFloat(row.charges_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* COMPACT PAGINATION FOOTER */}
          {transactions.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 mt-3 shrink-0 text-sm font-bold text-slate-600 print:hidden">
              <div>
                Showing <span className="text-slate-900">{indexOfFirstRow + 1}</span> to <span className="text-slate-900">{Math.min(indexOfLastRow, transactions.length)}</span> of <span className="text-indigo-950 font-black">{transactions.length}</span> records
              </div>
              
              <div className="flex gap-1.5 items-center">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg select-none transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                >
                  « First
                </button>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg select-none transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                >
                  ◀ Prev
                </button>

                <div className="px-3 py-1 text-slate-800 font-extrabold bg-indigo-50 border border-indigo-200 rounded-lg">
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg select-none transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                >
                  Next ▶
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-lg select-none transition hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; background: white !important; }
          .print\\:w-full, .print\\:w-full * { visibility: visible; }
          .print\\:w-full { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}