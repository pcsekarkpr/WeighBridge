import React, { useEffect, useState } from 'react';

export default function WhatsAppModal({ isOpen, onClose }) {
  const [qrCode, setQrCode] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    // Listen for QR code updates sent from main process
    const handleQr = (qrDataUrl) => {
      setQrCode(qrDataUrl);
      setLoading(false);
      setIsConnected(false);
    };

    // Listen for connection status updates
    const handleStatus = (status) => {
      setIsConnected(status.connected);
      if (status.connected) {
        setQrCode(null);
      }
      setLoading(false);
    };

    // Initialize WhatsApp connection via IPC bridge
    if (window.api?.initWhatsApp) {
      window.api.initWhatsApp();
    }

    // Subscribe to events
    const cleanupQr = window.api?.onWhatsAppQr ? window.api.onWhatsAppQr(handleQr) : null;
    const cleanupStatus = window.api?.onWhatsAppStatus ? window.api.onWhatsAppStatus(handleStatus) : null;

    return () => {
      if (cleanupQr) cleanupQr();
      if (cleanupStatus) cleanupStatus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden text-center p-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <span>💬</span> WhatsApp Integration
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-xl"
          >
            ✕
          </button>
        </div>

        {isConnected ? (
          <div className="py-8 space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
              ✓
            </div>
            <h4 className="text-xl font-bold text-slate-800">WhatsApp Connected</h4>
            <p className="text-sm text-slate-500">
              Your session is saved. Weight scale receipts can now be sent directly to customers.
            </p>
          </div>
        ) : qrCode ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 font-medium">
              Scan this QR code using WhatsApp on your phone:
            </p>
            <div className="bg-white p-3 border-2 border-emerald-500/20 rounded-xl inline-block shadow-inner">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 mx-auto" />
            </div>
            <p className="text-xs text-slate-400">
              Open WhatsApp → Linked Devices → Link a Device
            </p>
          </div>
        ) : (
          <div className="py-12 space-y-3">
            <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm font-semibold text-slate-600">
              Initializing WhatsApp Web engine...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}