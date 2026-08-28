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

ipcMain.handle("print-receipt", async (event, payload) => {
  let printWindow;
  try {
    const requestedPrinterName = String(payload?.printerName || "");
    const receiptHtml = String(payload?.html || "");
    if (!receiptHtml) throw new Error("Conteúdo da comanda não foi recebido.");

    const printers = await event.sender.getPrintersAsync();
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
    printWindow = new BrowserWindow({
      show: false,
      width: 303,
      height: 1123,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const printDocument = `<!doctype html>
      <html><head><meta charset="utf-8"><style>
        @page { margin: 0; }
        html, body { margin: 0; padding: 0; width: 72.1mm; background: white; }
        .thermal-print {
          width: 72.1mm; padding: 2mm; margin: 0; box-sizing: border-box;
          overflow: hidden; font-family: "Courier New", monospace;
          font-size: 14pt; line-height: 1.2; background: white; color: black;
        }
      </style></head><body>${receiptHtml}</body></html>`;

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printDocument)}`);
    writePrintLog("Janela exclusiva de impressão carregada com o tamanho de 80 mm.");

    await new Promise((resolve, reject) => {
      printWindow.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printer.name,
        usePrinterDefaultPageSize: true,
        margins: { marginType: "none" },
        landscape: false,
        scaleFactor: 100
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
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
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
