const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

function printLogPath() {
  return path.join(app.getPath("userData"), "impressao.log");
}

function writePrintLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(printLogPath(), line, "utf8");
}

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
  try {
    const webContents = event.sender;
    const printers = await webContents.getPrintersAsync();
    const normalizedName = String(requestedPrinterName || "").trim().toLowerCase();
    writePrintLog(`Pedido de impressão. Nome configurado: ${requestedPrinterName || "(vazio)"}`);
    writePrintLog(`Impressoras do Windows: ${printers.map(p => `${p.name} (${p.displayName || "sem nome de exibição"})`).join(" | ")}`);

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

    writePrintLog(`Impressora selecionada: ${printer.name}`);
    await new Promise((resolve, reject) => {
      webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printer.name,
        margins: { marginType: "none" }
      }, (success, failureReason) => {
        if (success) {
          writePrintLog("Pedido aceito pela fila de impressão.");
          resolve();
        } else {
          writePrintLog(`Falha retornada pelo Windows: ${failureReason || "sem motivo"}`);
          reject(new Error(failureReason || "Falha ao imprimir."));
        }
      });
    });
  } catch (error) {
    writePrintLog(`ERRO: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    throw error;
  }
});

ipcMain.handle("open-print-log", async () => {
  if (!fs.existsSync(printLogPath())) {
    writePrintLog("Relatório de impressão criado. Nenhuma tentativa registrada nesta versão.");
  }
  const errorMessage = await shell.openPath(printLogPath());
  if (errorMessage) throw new Error(errorMessage);
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
