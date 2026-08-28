const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

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
  let rawFile;
  try {
    const requestedPrinterName = String(payload?.printerName || "");
    const rawData = String(payload?.rawData || "");
    if (!rawData) throw new Error("Conteúdo RAW da comanda não foi recebido.");

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
    rawFile = path.join(os.tmpdir(), `gestor-chapa-${process.pid}-${Date.now()}.bin`);
    fs.writeFileSync(rawFile, Buffer.from(rawData, "base64"));
    const scriptPath = path.join(__dirname, "rawPrinter.ps1");
    writePrintLog(`Enviando ${fs.statSync(rawFile).size} bytes em modo RAW/ESC-POS.`);

    const { stdout, stderr } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
      "-PrinterName", printer.name,
      "-DataFile", rawFile
    ], { windowsHide: true, timeout: 20000 });

    if (stdout.trim()) writePrintLog(`PowerShell: ${stdout.trim()}`);
    if (stderr.trim()) writePrintLog(`PowerShell aviso: ${stderr.trim()}`);
    writePrintLog("Dados RAW/ESC-POS entregues ao spooler do Windows.");
  } catch (error) {
    writePrintLog(`ERRO: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    throw error;
  } finally {
    if (rawFile && fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
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
