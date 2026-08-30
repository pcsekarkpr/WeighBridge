import React, { useState, useEffect, useRef } from 'react';
import {useModelAlert } from './useModelAlert';
import AlertModel from './AlertModel';



const INITIAL_FIELDS = [
  { id: 'ticketNo_1', fieldKey: 'ticketNo', display: 'Ticket Sl No.', x: 40, y: 50, fontSize: 14, fontFamily: 'Courier New', fontWeight: 'bold' },
  { id: 'vehicleNo_1', fieldKey: 'vehicleNo', display: 'Vehicle Number', x: 220, y: 50, fontSize: 14, fontFamily: 'Courier New', fontWeight: 'bold' },
  { id: 'date_1', fieldKey: 'date', display: 'Current Date', x: 40, y: 90, fontSize: 12, fontFamily: 'Courier New', fontWeight: 'normal' },
  { id: 'time_1', fieldKey: 'time', display: 'Current Time', x: 220, y: 90, fontSize: 12, fontFamily: 'Courier New', fontWeight: 'normal' },
  { id: 'material_1', fieldKey: 'material', display: 'Material Name', x: 40, y: 130, fontSize: 12, fontFamily: 'Courier New', fontWeight: 'normal' },
  { id: 'party_1', fieldKey: 'party', display: 'Party / Customer', x: 40, y: 170, fontSize: 12, fontFamily: 'Courier New', fontWeight: 'normal' },
  { id: 'gross_1', fieldKey: 'gross', display: 'Gross Wt (kg)', x: 40, y: 220, fontSize: 16, fontFamily: 'Arial', fontWeight: 'bold' },
  { id: 'tare_1', fieldKey: 'tare', display: 'Square Wt (kg)', x: 220, y: 220, fontSize: 16, fontFamily: 'Arial', fontWeight: 'bold' },
  { id: 'net_1', fieldKey: 'net', display: 'Net Wt (kg)', x: 130, y: 260, fontSize: 18, fontFamily: 'Arial', fontWeight: 'black' },
  { id: 'charges_1', fieldKey: 'charges', display: 'Weighment Fee', x: 40, y: 310, fontSize: 12, fontFamily: 'Courier New', fontWeight: 'normal' }
];

const DATA_KEYS = [
  { key: 'ticketNo', label: 'Ticket / Sl No.' },
  { key: 'vehicleNo', label: 'Vehicle Number' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'material', label: 'Material' },
  { key: 'party', label: 'Party Name' },
  { key: 'gross', label: 'Gross Weight' },
  { key: 'tare', label: 'Tare Weight' },
  { key: 'net', label: 'Net Weight' },
  { key: 'charges', label: 'Charges/Fee' }
];

const PAPER_DIMENSIONS = {
  CONTINUOUS_HALF: { width: 760, height: 520, name: 'Continuous Slip (8x5.5 in)' },
  A4: { width: 740, height: 1045, name: 'A4 Standard Sheet' },
  ROLL_3INCH: { width: 320, height: 600, name: '3-Inch Receipt Roll' }
};

export default function PrinterSettingsManagement({ onBack }) {
  const [formatsList, setFormatsList] = useState([]);
  const [selectedFormatId, setSelectedFormatId] = useState('');
  const [formatNameInput, setFormatNameInput] = useState('Standard Ticket');
  const [isDefault, setIsDefault] = useState(false);

  const [printerType, setPrinterType] = useState('DOT_MATRIX'); 
  const [paperSize, setPaperSize] = useState('CONTINUOUS_HALF'); 
  const [copies, setCopies] = useState(1);
  
  const [fields, setFields] = useState(INITIAL_FIELDS);

  //
  // const { triggerModelAlert, ModelAlertComponent } = useModelAlert();
  
  // --- MULTI-SELECT AND DRAG POSITION STATE ---
  const [selectedFieldIds, setSelectedFieldIds] = useState(['vehicleNo_1']);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartMousePos = useRef({ x: 0, y: 0 });
  const dragStartFieldPositions = useRef({}); 

  const [zoom, setZoom] = useState(1.0);
  const [bgImage, setBgImage] = useState(null);
  const [bgOpacity, setBgOpacity] = useState(60);
  const [duplicateYOffset, setDuplicateYOffset] = useState(360);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const { modelConfig, triggerModelAlert, closeModelAlert } = useModelAlert();


  const { width: currentWidth, height: currentHeight } = PAPER_DIMENSIONS[paperSize] || PAPER_DIMENSIONS.CONTINUOUS_HALF;

  useEffect(() => {
    loadFormatsDropdown();
  }, []);

  useEffect(() => {
    if (selectedFormatId) {
      loadSelectedConfig(selectedFormatId);
    }
  }, [selectedFormatId]);

  const loadFormatsDropdown = async () => {
    if (window.api && window.api.getAllPrinterFormats) {
      const list = await window.api.getAllPrinterFormats();
      setFormatsList(list || []);
      if (list && list.length > 0) {
        const defaultFormat = list.find(f => f.is_default === 1 || f.is_default === true) || list[0];
        setSelectedFormatId(defaultFormat.format_id);
        setFormatNameInput(defaultFormat.format_name);
        setIsDefault(!!defaultFormat.is_default);
      }
    }
  };

  const loadSelectedConfig = async (formatId) => {
    if (window.api && window.api.getPrinterConfig) {
      const savedConfig = await window.api.getPrinterConfig(formatId);
      if (savedConfig) {
        if (savedConfig.printerType) setPrinterType(savedConfig.printerType);
        if (savedConfig.paperSize) setPaperSize(savedConfig.paperSize);
        if (savedConfig.copies) setCopies(savedConfig.copies);
        
        // Match default flag from DB list or config
        const formatObj = formatsList.find(f => f.format_id === formatId);
        setIsDefault(formatObj ? !!formatObj.is_default : !!savedConfig.isDefault);
        
        if (savedConfig.fields && Array.isArray(savedConfig.fields)) {
          const sanitizedFields = savedConfig.fields.map((f, index) => {
            const safeId = f.id || `${f.fieldKey || 'field'}_${Date.now()}_${index}`;
            const inferredKey = f.fieldKey || safeId.split('_')[0] || 'vehicleNo';
            const matchedDataKey = DATA_KEYS.find(dk => dk.key === inferredKey);
            
            return {
              ...f,
              id: safeId,
              fieldKey: inferredKey,
              display: f.display || (matchedDataKey ? matchedDataKey.label : 'Field Item')
            };
          });
          
          setFields(sanitizedFields);
          if (sanitizedFields.length > 0) {
            setSelectedFieldIds([sanitizedFields[0].id]);
          }
        }
        if (savedConfig.bgImage) setBgImage(savedConfig.bgImage);
        if (savedConfig.bgOpacity) setBgOpacity(savedConfig.bgOpacity);
      } else {
        setFields(INITIAL_FIELDS);
        setBgImage(null);
        setIsDefault(false);
      }
    }
  };

  const handleSaveLayout = async () => {
    if (!window.api || !window.api.savePrinterConfig) {
      if (triggerModelAlert) {
        triggerModelAlert("IPC Connection Error", "IPC Connection Context Missing.", "சிக்னல் இணைப்பு கிடைக்கவில்லை.", true);
      }
      return;
    }

    // Build complete configuration object including format_name and is_default
    const payloadConfig = { 
      formatName: formatNameInput,
      isDefault: isDefault ? 1 : 0,
      printerType, 
      paperSize, 
      copies, 
      fields, 
      bgImage, 
      bgOpacity 
    };

    try {
      const success = await window.api.savePrinterConfig(
        selectedFormatId || null, 
        formatNameInput, 
        payloadConfig
      );

      if (success) {
        if (triggerModelAlert) {
          triggerModelAlert("Layout Configuration Saved", "Layout configuration saved successfully!", "அமைப்பு வடிவம் வெற்றிகரமாக சேமிக்கப்பட்டது!", false);
        }
        await loadFormatsDropdown(); 
      } else {
        if (triggerModelAlert) {
          triggerModelAlert("Save Operation Failed", "Failed to save layout configuration.", "அமைப்பை சேமிக்க இயலவில்லை.", true);
        }
      }
    } catch (err) {
      console.error("Save printer format error:", err);
      if (triggerModelAlert) {
        triggerModelAlert("Database Error", "Failed to persist format to database.", "தரவுத்தளத்தில் சேமிப்பதில் பிழை.", true);
      }
    }
  };

  const handleCreateNewFormat = () => {
    setSelectedFormatId(''); 
    setFormatNameInput('New Layout Style');
    setFields(INITIAL_FIELDS);
    setSelectedFieldIds([INITIAL_FIELDS[0].id]);
    setBgImage(null);
    setIsDefault(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setBgImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const updateSelectedField = (key, value) => {
    const primaryId = selectedFieldIds[0];
    if (!primaryId) return;
    setFields(prev => prev.map(f => f.id === primaryId ? { ...f, [key]: value } : f));
  };

  const handleDuplicateAllFields = () => {
    const timestamp = Date.now();
    const currentBaseCount = fields.filter(f => f.id.includes('_set')).length;
    const currentSetIndex = (currentBaseCount / INITIAL_FIELDS.length) + 2; 

    const multipliedSet = fields
      .filter(f => !f.id.includes('_set')) 
      .map(f => ({
        ...f,
        id: `${f.fieldKey}_set${currentSetIndex}_${timestamp}`,
        display: `${f.display} (S${currentSetIndex})`,
        y: f.y + (duplicateYOffset * (currentSetIndex - 1))
      }));

    setFields(prev => [...prev, ...multipliedSet]);
  };

  const handleClearAdditionalSets = () => {
    setFields(prev => prev.filter(f => !f.id.includes('_set')));
    setSelectedFieldIds([INITIAL_FIELDS[0].id]);
  };

  const handleCloneField = () => {
    const primaryId = selectedFieldIds[0];
    const sourceField = fields.find(f => f.id === primaryId);
    if (!sourceField) return;
    const newId = `${sourceField.fieldKey}_${Date.now()}`;
    const clonedElement = {
      ...sourceField,
      id: newId,
      display: `${sourceField.display} (Copy)`,
      x: sourceField.x + 20,
      y: sourceField.y + 20
    };
    setFields(prev => [...prev, clonedElement]);
    setSelectedFieldIds([newId]);
  };

  const handleDeleteField = () => {
    if (fields.length <= 1) return;
    setFields(prev => prev.filter(f => !selectedFieldIds.includes(f.id)));
    setSelectedFieldIds([fields[0].id]);
  };

  // --- MULTI-FIELD DRAGGING LOGIC ---
  const handleCanvasMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    const clickedField = fields.find(f => Math.abs(f.x - clickX) < (80 / zoom) && Math.abs(f.y - clickY) < (20 / zoom));
    
    if (clickedField) {
      let nextSelection = [...selectedFieldIds];
      
      if (e.ctrlKey || e.metaKey) {
        if (nextSelection.includes(clickedField.id)) {
          if (nextSelection.length > 1) {
            nextSelection = nextSelection.filter(id => id !== clickedField.id);
          }
        } else {
          nextSelection.push(clickedField.id);
        }
      } else {
        if (!nextSelection.includes(clickedField.id)) {
          nextSelection = [clickedField.id];
        }
      }

      setSelectedFieldIds(nextSelection);
      setIsDragging(true);
      dragStartMousePos.current = { x: e.clientX, y: e.clientY };
      
      const positions = {};
      fields.forEach(f => {
        if (nextSelection.includes(f.id)) {
          positions[f.id] = { x: f.x, y: f.y };
        }
      });
      dragStartFieldPositions.current = positions;
    } else {
      if (!e.ctrlKey && !e.metaKey) {
        if (fields.length > 0) setSelectedFieldIds([fields[0].id]);
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDragging || selectedFieldIds.length === 0) return;
    
    const deltaX = Math.round((e.clientX - dragStartMousePos.current.x) / zoom);
    const deltaY = Math.round((e.clientY - dragStartMousePos.current.y) / zoom);

    setFields(prev => prev.map(f => {
      if (selectedFieldIds.includes(f.id)) {
        const startingPos = dragStartFieldPositions.current[f.id] || { x: f.x, y: f.y };
        return {
          ...f,
          x: Math.max(0, Math.min(startingPos.x + deltaX, currentWidth - 40)),
          y: Math.max(0, Math.min(startingPos.y + deltaY, currentHeight - 20))
        };
      }
      return f;
    }));
  };

  const handleCanvasMouseUp = () => setIsDragging(false);

  const primarySelectedField = fields.find(f => f.id === selectedFieldIds[0]) || fields[0];

  const sampleValues = {
    ticketNo: '89421',
    vehicleNo: 'TN-59-AZ-4321',
    date: '19-07-2026',
    time: '21:55',
    material: 'BLUE METAL 20MM',
    party: 'BALU TRADERS',
    gross: '28450',
    tare: '10120',
    net: '18330',
    charges: '150.00'
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col p-4 font-sans select-none overflow-hidden h-screen w-screen text-slate-100">
      
      <header className="bg-slate-800 rounded-xl shadow-md px-6 py-3 flex justify-between items-center mb-4 border border-slate-700 shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">⚙️ Precision Print Layout Canvas</h1>
          <p className="text-xs font-bold text-indigo-400 tracking-wider">HOLD CTRL KEY TO DRAG & MOVE MULTIPLE FIELDS AT ONCE</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleSaveLayout} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2 rounded-xl text-sm shadow transition">
            💾 SAVE TEMPLATE
          </button>
          <button type="button" onClick={onBack} className="bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold px-4 py-2 rounded-xl text-sm transition border border-slate-600">
            ✕ CLOSE
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4 flex-grow overflow-hidden min-h-0 items-stretch">
        
        {/* LEFT PANEL CONTROLS */}
        <div className="col-span-4 bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto shadow-xl custom-scrollbar">
          
          {/* Format Profile Selector Module */}
          <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-2">
            <h3 className="text-xs font-black text-indigo-300 uppercase tracking-wide">📂 Selected Format Schema</h3>
            <div className="flex gap-2">
              <select 
                value={selectedFormatId} 
                onChange={e => {
                  const val = e.target.value;
                  const parsedId = val === "" ? "" : parseInt(val, 10);
                  setSelectedFormatId(parsedId);
                  const selectedObj = formatsList.find(f => f.format_id === parsedId);
                  if (selectedObj) {
                    setFormatNameInput(selectedObj.format_name);
                    setIsDefault(!!selectedObj.is_default);
                  }
                }}
                className="flex-grow border border-slate-600 rounded p-1.5 text-xs font-bold text-white bg-slate-900 focus:outline-none"
              >
                <option value="">-- Create/Save as New Format --</option>
                {formatsList.map(f => (
                  <option key={f.format_id} value={f.format_id}>{f.format_name} {f.is_default ? '★ (Default)' : ''}</option>
                ))}
              </select>
              <button type="button" onClick={handleCreateNewFormat} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded text-xs transition">
                + New
              </button>
            </div>
            
            <div>
              <input 
                type="text" 
                value={formatNameInput} 
                onChange={e => setFormatNameInput(e.target.value)} 
                className="w-full text-xs font-bold font-mono text-white px-2 py-1.5 rounded border border-slate-600 bg-slate-900" 
                placeholder="Layout Label Name" 
              />
            </div>

            {/* Default Status Flag Toggle */}
            <div className="flex items-center gap-2 mt-1 bg-slate-900/50 p-2 rounded border border-slate-700">
              <input 
                type="checkbox" 
                id="defaultFormatCheckbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 accent-indigo-500"
              />
              <label htmlFor="defaultFormatCheckbox" className="text-xs font-black text-slate-300 cursor-pointer">
                ⭐ Set as Default Format for Printing
              </label>
            </div>
          </div>

          {/* Viewport Scale Magnification */}
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-700">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide mb-2">🔍 Viewport Canvas Scaling</h3>
            <div className="grid grid-cols-4 gap-1.5 font-mono text-xs font-bold">
              {[0.6, 0.8, 1.0, 1.2].map((z) => (
                <button
                  key={z} type="button" onClick={() => setZoom(z)}
                  className={`py-1.5 rounded transition border ${zoom === z ? 'bg-indigo-600 border-indigo-500 text-white font-black' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'}`}
                >
                  {z * 100}%
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Configuration & Boundary Map */}
          <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700 flex flex-col gap-2.5">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide">📐 Document Page Specifications</h3>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block uppercase mb-1">Paper Bound Aspect Ratio</label>
              <select value={paperSize} onChange={e => setPaperSize(e.target.value)} className="w-full border border-slate-600 rounded p-1.5 text-xs font-bold bg-slate-900 text-white">
                {Object.entries(PAPER_DIMENSIONS).map(([key, val]) => (
                  <option key={key} value={key}>{val.name} ({val.width}x{val.height}px)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block uppercase mb-1">Printer Target Engine</label>
              <select value={printerType} onChange={e => setPrinterType(e.target.value)} className="w-full border border-slate-600 rounded p-1.5 text-xs font-bold bg-slate-900 text-white">
                <option value="DOT_MATRIX">Dot Matrix Impact Mode</option>
                <option value="THERMAL">Direct Thermal Roll Mode</option>
                <option value="LASER">Standard Laser/Inkjet Mode</option>
              </select>
            </div>
          </div>

          {/* Mass Duplicate Entire Field Block Layout */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 flex flex-col gap-2">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wide">📋 Weighbridge Slip Duplicate Sets</h3>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">Y-Spacing (px):</span>
              <input 
                type="number" 
                value={duplicateYOffset} 
                onChange={e => setDuplicateYOffset(parseInt(e.target.value) || 100)} 
                className="w-full border border-slate-600 rounded px-2 py-0.5 text-xs font-mono bg-slate-900 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleDuplicateAllFields} className="bg-amber-650 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs transition">
                ➕ DUPLICATE SET
              </button>
              <button type="button" onClick={handleClearAdditionalSets} className="bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold py-2 rounded-lg text-xs transition border border-slate-600">
                ✕ RESET TO 1
              </button>
            </div>
          </div>

          {/* Individual Asset Operations */}
          <div className="border-t border-slate-700 pt-3">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Element Parameters ({selectedFieldIds.length} Selected)</h3>
            <div className="flex flex-col gap-2.5">
              <div>
                <select 
                  value={selectedFieldIds[0] || ''} 
                  onChange={e => setSelectedFieldIds([e.target.value])} 
                  className="w-full border border-slate-600 rounded p-1.5 text-xs font-bold text-indigo-300 bg-slate-900"
                >
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>
                      {selectedFieldIds.includes(f.id) ? '✓ ' : ''}{f.display} [X:{f.x}, Y:{f.y}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-0.5">Data Key Mapping</label>
                  <select 
                    value={primarySelectedField?.fieldKey || ''} 
                    onChange={e => {
                      const selectedKey = e.target.value;
                      const labelObj = DATA_KEYS.find(k => k.key === selectedKey);
                      setFields(prev => prev.map(f => f.id === selectedFieldIds[0] ? { ...f, fieldKey: selectedKey, display: labelObj ? labelObj.label : f.display } : f));
                    }} 
                    className="w-full border border-slate-600 rounded p-1 text-xs font-bold bg-slate-900 text-white"
                  >
                    {DATA_KEYS.map(dk => <option key={dk.key} value={dk.key}>{dk.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-0.5">Typography Font</label>
                  <select value={primarySelectedField?.fontFamily || 'Arial'} onChange={e => updateSelectedField('fontFamily', e.target.value)} className="w-full border border-slate-600 rounded p-1 text-xs font-bold bg-slate-900 text-white">
                    <option value="Courier New">Courier New</option>
                    <option value="Arial">Arial</option>
                    <option value="monospace">Monospace</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-900/30 p-2 rounded border border-slate-700">
                <div>
                  <label className="text-[11px] font-bold text-slate-400">Position X (px)</label>
                  <input type="number" value={primarySelectedField?.x || 0} onChange={e => updateSelectedField('x', parseInt(e.target.value) || 0)} className="w-full border border-slate-600 rounded px-2 py-0.5 text-xs font-mono bg-slate-900 text-white"/>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400">Position Y (px)</label>
                  <input type="number" value={primarySelectedField?.y || 0} onChange={e => updateSelectedField('y', parseInt(e.target.value) || 0)} className="w-full border border-slate-600 rounded px-2 py-0.5 text-xs font-mono bg-slate-900 text-white"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-0.5">Scale Size (pt)</label>
                  <input type="number" value={primarySelectedField?.fontSize || 12} onChange={e => updateSelectedField('fontSize', parseInt(e.target.value) || 12)} className="w-full border border-slate-600 rounded p-1 text-xs font-bold bg-slate-900 text-white"/>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-0.5">Thickness Weight</label>
                  <select value={primarySelectedField?.fontWeight || 'normal'} onChange={e => updateSelectedField('fontWeight', e.target.value)} className="w-full border border-slate-600 rounded p-1 text-xs font-bold bg-slate-900 text-white">
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                    <option value="black">Black Heavy</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={handleCloneField} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs transition">
                  📄 CLONE FIELD
                </button>
                <button type="button" onClick={handleDeleteField} className="bg-red-900/40 hover:bg-red-900/60 text-red-200 font-bold py-1.5 rounded-lg text-xs transition border border-red-700/50">
                  ✕ REMOVE FIELD
                </button>
              </div>
            </div>
          </div>

          {/* Underlay Image Scans */}
          <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-3 flex flex-col gap-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wide">📸 Template Draft Overlay Background</h3>
            <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current.click()} className="w-full bg-slate-700 hover:bg-slate-650 text-xs font-bold py-2 rounded-lg transition border border-slate-600">
              {bgImage ? '🔄 CHANGE BG OVERLAY SCAN' : '📤 UPLOAD SCANNED FORM BASE'}
            </button>
            {bgImage && (
              <div className="flex items-center justify-between text-[11px] font-bold mt-1 text-slate-400">
                <span>Opacity: {bgOpacity}%</span>
                <input type="range" min="10" max="100" value={bgOpacity} onChange={e => setBgOpacity(parseInt(e.target.value))} className="w-2/3 accent-indigo-500"/>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CANVAS PANEL */}
        <div className="col-span-8 bg-slate-950 rounded-xl p-6 flex items-start justify-center overflow-auto shadow-inner border border-slate-800 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:20px_20px]">
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            className="bg-white relative shadow-2xl origin-top border-4 border-slate-400 rounded-sm shrink-0"
            style={{ 
              width: `${currentWidth}px`, 
              height: `${currentHeight}px`,
              transform: `scale(${zoom})`,
            }}
          >
            <div className="absolute inset-0 pointer-events-none opacity-15" style={{ backgroundImage: 'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

            {bgImage && (
              <img 
                src={bgImage} 
                alt="Weighbridge Boundary Template" 
                className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                style={{ opacity: bgOpacity / 100 }}
              />
            )}

            {fields.map((f) => {
              const fieldIdString = f.id || '';
              const isSelected = selectedFieldIds.includes(fieldIdString);
              const isPrimary = selectedFieldIds[0] === fieldIdString;
              const isDuplicateInstance = fieldIdString.includes('_set');
              const displayText = sampleValues[f.fieldKey] || f.display || 'SAMPLE';

              return (
                <div
                  key={f.id || Math.random().toString()}
                  className={`absolute px-2 py-0.5 rounded whitespace-nowrap select-none cursor-move transition-all inline-block ${
                    isSelected 
                      ? isPrimary
                        ? 'ring-2 ring-indigo-600 bg-indigo-200 text-indigo-950 z-30 font-black shadow-lg'
                        : 'ring-2 ring-indigo-400/70 bg-indigo-100 text-indigo-900 z-20 font-bold'
                      : isDuplicateInstance
                        ? 'bg-amber-50/90 text-amber-950 border border-amber-300 opacity-90'
                        : 'bg-white/90 text-slate-950 border border-slate-300 shadow-sm'
                  }`}
                  style={{
                    left: `${f.x || 0}px`,
                    top: `${f.y || 0}px`,
                    fontSize: `${f.fontSize || 12}px`,
                    fontFamily: f.fontFamily || 'Arial',
                    fontWeight: f.fontWeight === 'black' ? 900 : (f.fontWeight || 'normal'),
                    lineHeight: '1.2',
                    minWidth: 'max-content'
                  }}
                >
                  {displayText}
                </div>
              );
            })}
          </div>
        </div>

      </div>
       <AlertModel 
              modelConfig={modelConfig} 
              onClose={closeModelAlert} 
            />
    </div>
  );
}

// --- PRINT EXECUTION HELPER (EXPORTED OUTSIDE COMPONENT RENDER) ---
export const printTicketWithDefaultLayout = async (ticketData, formatId = null) => {
  if (!window.api || !window.api.printRawTicket) {
    console.error("IPC API not available for printing.");
    return false;
  }

  try {
    // Send transaction data directly to main process layout engine
    return await window.api.printRawTicket({
      formatId: formatId,
      transactionData: ticketData
    });
  } catch (err) {
    console.error("Print layout engine error:", err);
    throw err;
  }
};