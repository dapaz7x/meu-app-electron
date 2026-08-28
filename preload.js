const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (printerName) => ipcRenderer.invoke("print-receipt", printerName)
});
