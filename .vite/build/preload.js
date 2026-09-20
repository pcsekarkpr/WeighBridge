//#region src/preload.js
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
	getDropdownMasters: () => ipcRenderer.invoke("get-dropdown-masters"),
	getVehicleHistory: (vNo) => ipcRenderer.invoke("get-vehicle-history", vNo),
	saveTicket: (payload) => ipcRenderer.invoke("save-ticket", payload),
	getReportData: (filters) => ipcRenderer.invoke("get-report-data", filters),
	addParty: (partyName) => ipcRenderer.invoke("add-party", partyName),
	sendSms: (payload) => ipcRenderer.invoke("send-sms", payload),
	sendWhatsApp: (data) => ipcRenderer.invoke("send-whatsapp-msg", data),
	initWhatsApp: () => ipcRenderer.send("init-whatsapp"),
	getAllPrinterFormats: () => ipcRenderer.invoke("get-all-printer-formats"),
	getPrinterConfig: (formatId) => ipcRenderer.invoke("get-printer-config", formatId),
	printRawTicket: (data) => ipcRenderer.invoke("print-raw-ticket", data),
	getDefaultPrinterConfig: () => ipcRenderer.invoke("getDefaultPrinterConfig"),
	savePrinterConfig: (formatId, formatName, config) => ipcRenderer.invoke("save-printer-config", {
		formatId,
		formatName,
		config
	}),
	onLiveWeightUpdate: (callback) => {
		const subscription = (event, weight) => callback(weight);
		ipcRenderer.on("serial-weight-data", subscription);
		return () => {
			ipcRenderer.removeListener("serial-weight-data", subscription);
		};
	},
	onWhatsAppQr: (callback) => {
		const listener = (_event, qrDataUrl) => callback(qrDataUrl);
		ipcRenderer.on("whatsapp-qr", listener);
		return () => ipcRenderer.removeListener("whatsapp-qr", listener);
	},
	onWhatsAppStatus: (callback) => {
		const listener = (_event, status) => callback(status);
		ipcRenderer.on("whatsapp-status", listener);
		return () => ipcRenderer.removeListener("whatsapp-status", listener);
	}
});
//#endregion
