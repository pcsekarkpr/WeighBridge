import React, { useEffect, useRef } from 'react';

export default function AlertModel({ modelConfig, onClose }) {
  if (!modelConfig || !modelConfig.isOpen) return null;

  const { title, messageEn, messageTa, isError, isConfirm } = modelConfig;
  const yesButtonRef = useRef(null);

  // 1. Automatically focus the YES button when the modal opens in confirm mode
  useEffect(() => {
    if (modelConfig.isOpen && isConfirm && yesButtonRef.current) {
      yesButtonRef.current.focus();
    }
  }, [modelConfig.isOpen, isConfirm]);

  // 2. Global Keyboard listener (Enter = Yes/Print, Escape = No/Cancel)
  useEffect(() => {
    if (!modelConfig.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onClose(true); // Resolves Promise to true
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose(false); // Resolves Promise to false
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modelConfig.isOpen, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className={`w-full max-w-md bg-slate-800 rounded-2xl border shadow-2xl overflow-hidden transform transition-all ${
        isError ? 'border-red-500/50' : 'border-emerald-500/50'
      }`}>
        {/* Header Banner */}
        <div className={`px-6 py-4 flex items-center justify-between ${
          isError ? 'bg-red-950/40 text-red-400' : 'bg-emerald-950/40 text-emerald-400'
        }`}>
          <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
            <span>{isError ? '⚠️' : '✅'}</span>
            <span>{title}</span>
          </h3>
          <button 
            type="button"
            onClick={() => onClose(false)} 
            className="text-slate-400 hover:text-white transition text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Message Content */}
        <div className="p-6 flex flex-col gap-3">
          {messageEn && (
            <p className="text-slate-200 text-sm font-semibold leading-relaxed">
              {messageEn}
            </p>
          )}
          {messageTa && (
            <p className="text-indigo-300 text-xs font-bold leading-relaxed border-t border-slate-700/60 pt-3">
              {messageTa}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-700/50 flex justify-end gap-3">
          {isConfirm ? (
            <>
              {/* YES BUTTON (Focused by default, triggers on Enter) */}
              <button
                ref={yesButtonRef}
                type="button"
                onClick={() => onClose(true)}
                className="px-5 py-2 rounded-xl text-xs font-black transition shadow-md bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              >
                Yes / ஆம் (Enter)
              </button>
              {/* NO BUTTON (Esc) */}
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-5 py-2 rounded-xl text-xs font-black transition shadow-md bg-slate-700 hover:bg-slate-600 text-slate-200"
              >
                No / இல்லை (Esc)
              </button>

              
            </>
          ) : (
            /* STANDARD OK BUTTON FOR SINGLE ALERTS */
            <button
              type="button"
              onClick={() => onClose(true)}
              className={`px-6 py-2 rounded-xl text-xs font-black transition shadow-md ${
                isError
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              OK / சரி
            </button>
          )}
        </div>
      </div>
    </div>
  );
}