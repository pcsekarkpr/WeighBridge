import { useState, useCallback, useRef } from 'react';

export function useModelAlert() {
  const [modelConfig, setModelConfig] = useState({
    isOpen: false,
    title: '',
    messageEn: '',
    messageTa: '',
    isError: false,
    isConfirm: false, // New property for Yes/No mode
  });

  const resolveRef = useRef(null);

  const triggerModelAlert = useCallback((title, messageEn, messageTa = '', isError = false, isConfirm = false) => {
    setModelConfig({
      isOpen: true,
      title,
      messageEn,
      messageTa,
      isError,
      isConfirm,
    });

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const closeModelAlert = useCallback((result = false) => {
    setModelConfig((prev) => ({ ...prev, isOpen: false }));

    if (resolveRef.current) {
      resolveRef.current(result); // Pass true/false back to caller
      resolveRef.current = null;
    }
  }, []);

  return {
    modelConfig,
    setModelConfig,
    triggerModelAlert,
    closeModelAlert,
  };
}