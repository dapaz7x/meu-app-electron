const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  printReceipt: (payload) => ipcRenderer.invoke("print-receipt", payload),
  openPrintLog: () => ipcRenderer.invoke("open-print-log"),
  checkNetworkPrinter: (payload) => ipcRenderer.invoke("check-network-printer", payload),
  getNetworkConfig: () => ipcRenderer.invoke("get-network-config"),
  saveNetworkConfig: (payload) => ipcRenderer.invoke("save-network-config", payload),
  checkNetworkLink: () => ipcRenderer.invoke("check-network-link"),
  ordersList: () => ipcRenderer.invoke("orders-list"),
  ordersSave: (order) => ipcRenderer.invoke("orders-save", order),
  ordersImport: (orders) => ipcRenderer.invoke("orders-import", orders),
  ordersStatus: (payload) => ipcRenderer.invoke("orders-status", payload),
  getAppVersion: () => ipcRenderer.invoke("get-app-version")
});
