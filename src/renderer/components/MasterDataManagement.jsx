import React, { useState, useEffect } from 'react';

export default function MasterDataManagement({ onBack }) {
  const [materials, setMaterials] = useState([]);
  const [parties, setParties] = useState([]);
  
  const [newMaterial, setNewMaterial] = useState('');
  const [newParty, setNewParty] = useState('');

  // Auto-load masters on panel display
  useEffect(() => {
    refreshData();
    
    // Bind Escape key safely back out to local main panel
    const handleLocalEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleLocalEsc);
    return () => window.removeEventListener('keydown', handleLocalEsc);
  }, []);

  const refreshData = async () => {
    if (window.api && window.api.getDropdownMasters) {
      try {
        const data = await window.api.getDropdownMasters();
        setMaterials(data.materials || []);
        setParties(data.parties || []);
      } catch (err) {
        console.error("Failed fetching master listings:", err);
      }
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.trim() || !window.api?.addMaterial) return;
    try {
      await window.api.addMaterial({ name: newMaterial.trim().toUpperCase() });
      setNewMaterial('');
      refreshData();
    } catch (err) { alert("Error adding material"); }
  };

  const handleAddParty = async (e) => {
    e.preventDefault();
    if (!newParty.trim() || !window.api?.addParty) return;
    try {
      await window.api.addParty({ name: newParty.trim().toUpperCase() });
      setNewParty('');
      refreshData();
    } catch (err) { alert("Error adding customer"); }
  };

  const handleDeleteItem = async (type, id) => {
    if (!confirm(`Are you sure you want to remove this ${type}?`)) return;
    
    if (window.api && window.api.deleteMasterItem) {
      try {
        await window.api.deleteMasterItem({ type, id });
        refreshData();
      } catch (err) {
        console.error("Failed to delete entry:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-100 z-50 flex flex-col p-4 font-sans select-none overflow-hidden h-screen w-screen">
      <header className="bg-white rounded-xl shadow-sm px-6 py-3 flex justify-between items-center mb-4 border border-slate-200 shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-800">👥 Master Registries</h1>
          <p className="text-xs font-bold text-indigo-600 tracking-wider">ADD OR REMOVE SYSTEM OPERATIONAL ENTRIES</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition shadow flex flex-col items-center justify-center"
        >
          <span>← BACK TO MENU</span>
          <span className="text-[9px] opacity-70">[ESC]</span>
        </button>
      </header>

      {/* Main Container Dual Workspace split system */}
      <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden min-h-0 items-stretch">
        
        {/* COLUMN A: MATERIALS CONTROL */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col overflow-hidden shadow-sm">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
            📦 Materials Ledger / பொருட்கள்
          </h2>
          
          <form onSubmit={handleAddMaterial} className="flex gap-2 mb-4 shrink-0">
            <input
              type="text"
              placeholder="Enter Material Name (e.g. BLUE METAL)"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              className="flex-grow border-2 border-slate-200 rounded-lg px-3 py-1.5 text-base font-bold focus:border-emerald-500 outline-none uppercase shadow-sm"
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 rounded-lg text-sm shadow tracking-wide">
              + ADD ITEM
            </button>
          </form>

          <div className="flex-grow overflow-y-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 font-bold text-xs text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="p-2 w-16">ID</th>
                  <th className="p-2">Material Specification</th>
                  <th className="p-2 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-50">
                {materials.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80">
                    <td className="p-2 font-mono text-xs text-slate-400">#{m.id}</td>
                    <td className="p-2 tracking-wide font-black text-slate-800">{m.material_name}</td>
                    <td className="p-2 text-center">
                      <button 
                        type="button"
                        onClick={() => handleDeleteItem('MATERIAL', m.id)}
                        className="text-red-500 hover:text-red-700 text-sm p-1 font-bold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMN B: CUSTOMERS/PARTIES CONTROL */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col overflow-hidden shadow-sm">
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 mb-3">
            🏢 Customer & Partners Register / வாடிக்கையாளர்
          </h2>

          <form onSubmit={handleAddParty} className="flex gap-2 mb-4 shrink-0">
            <input
              type="text"
              placeholder="Enter Customer Name (e.g. BALU TRADERS)"
              value={newParty}
              onChange={(e) => setNewParty(e.target.value)}
              className="flex-grow border-2 border-slate-200 rounded-lg px-3 py-1.5 text-base font-bold focus:border-emerald-500 outline-none uppercase shadow-sm"
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 rounded-lg text-sm shadow tracking-wide">
              + ADD PARTY
            </button>
          </form>

          <div className="flex-grow overflow-y-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 font-bold text-xs text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="p-2 w-16">ID</th>
                  <th className="p-2">Account Name</th>
                  <th className="p-2 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-50">
                {parties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="p-2 font-mono text-xs text-slate-400">#{p.id}</td>
                    <td className="p-2 tracking-wide font-black text-slate-800">{p.party_name}</td>
                    <td className="p-2 text-center">
                      <button 
                        type="button"
                        onClick={() => handleDeleteItem('PARTY', p.id)}
                        className="text-red-500 hover:text-red-700 text-sm p-1 font-bold"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}