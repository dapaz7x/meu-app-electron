const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "dist/index.html"));
}

ipcMain.handle("print-receipt", async (event, requestedPrinterName) => {
  const webContents = event.sender;
  const printers = await webContents.getPrintersAsync();
  const normalizedName = String(requestedPrinterName || "").trim().toLowerCase();
  const printer = printers.find(({ name, displayName }) =>
    name.toLowerCase() === normalizedName ||
    String(displayName || "").toLowerCase() === normalizedName
  ) || printers.find(({ name, displayName }) =>
    name.toLowerCase().includes("elgin i8") ||
    String(displayName || "").toLowerCase().includes("elgin i8")
  );

  if (!printer) {
    throw new Error("Impressora ELGIN i8 não encontrada no Windows.");
  }

  await new Promise((resolve, reject) => {
    webContents.print({
      silent: true,
      printBackground: true,
      deviceName: printer.name,
      margins: { marginType: "none" }
    }, (success, failureReason) => {
      if (success) resolve();
      else reject(new Error(failureReason || "Falha ao imprimir."));
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on("update-downloaded", () => {
  dialog.showMessageBox({
    type: "info",
    title: "Atualização disponível",
    message: "Uma nova versão foi baixada. O aplicativo será reiniciado."
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});
