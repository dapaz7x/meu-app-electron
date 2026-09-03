const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const http = require("http");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const ORDER_SERVER_PORT = 37842;
const UPDATE_INTERVAL_MS = 10 * 60 * 1000;
let orderServer;

function printLogPath() {
  return path.join(app.getPath("userData"), "impressao.log");
}

function writePrintLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(printLogPath(), line, "utf8");
}

function updateLogPath() {
  return path.join(app.getPath("userData"), "atualizacao.log");
}

function writeUpdateLog(message) {
  fs.appendFileSync(updateLogPath(), `[${new Date().toISOString()}] ${message}\n`, "utf8");
}

function ordersPath() {
  return path.join(app.getPath("userData"), "pedidos.json");
}

function networkConfigPath() {
  return path.join(app.getPath("userData"), "rede.json");
}

function readOrdersFile() {
  try {
    const value = JSON.parse(fs.readFileSync(ordersPath(), "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeOrdersFile(orders) {
  fs.writeFileSync(ordersPath(), JSON.stringify(orders, null, 2), "utf8");
}

function readNetworkConfig() {
  try {
    return {
      mode: "local",
      serverIp: "",
      port: ORDER_SERVER_PORT,
      ...JSON.parse(fs.readFileSync(networkConfigPath(), "utf8"))
    };
  } catch {
    return { mode: "local", serverIp: "", port: ORDER_SERVER_PORT };
  }
}

function localIpv4Addresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(address => address && address.family === "IPv4" && !address.internal)
    .map(address => address.address);
}

function jsonResponse(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy(new Error("Dados excederam o limite permitido."));
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Dados inválidos."));
      }
    });
    request.on("error", reject);
  });
}

async function handleOrderRequest(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(response, 200, { ok: true, app: "gestor-chapa", version: app.getVersion() });
    }
    if (request.method === "GET" && url.pathname === "/orders") {
      return jsonResponse(response, 200, readOrdersFile());
    }
    if (request.method === "POST" && url.pathname === "/orders") {
      const order = await readJsonBody(request);
      if (!order?.id) return jsonResponse(response, 400, { error: "Pedido inválido." });
      const orders = readOrdersFile().filter(item => item.id !== order.id);
      writeOrdersFile([...orders, order]);
      return jsonResponse(response, 200, order);
    }
    if (request.method === "POST" && url.pathname === "/orders/import") {
      const body = await readJsonBody(request);
      const current = readOrdersFile();
      const merged = [...current, ...(Array.isArray(body.orders) ? body.orders : [])]
        .filter((order, index, all) => order?.id && all.findIndex(item => item.id === order.id) === index);
      writeOrdersFile(merged);
      return jsonResponse(response, 200, merged);
    }
    const statusMatch = url.pathname.match(/^\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      const body = await readJsonBody(request);
      const id = decodeURIComponent(statusMatch[1]);
      const orders = readOrdersFile().map(order => order.id === id ? { ...order, ...body } : order);
      writeOrdersFile(orders);
      return jsonResponse(response, 200, { ok: true });
    }
    return jsonResponse(response, 404, { error: "Rota não encontrada." });
  } catch (error) {
    return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function stopOrderServer() {
  const currentServer = orderServer;
  orderServer = undefined;
  if (!currentServer) return Promise.resolve();
  return new Promise(resolve => currentServer.close(resolve));
}

async function startOrderServer(config = readNetworkConfig()) {
  await stopOrderServer();
  if (config.mode !== "host") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleOrderRequest);
    server.once("error", reject);
    server.listen(config.port, "0.0.0.0", () => {
      server.removeListener("error", reject);
      server.on("error", error => writePrintLog(`ERRO NO SERVIDOR DE PEDIDOS: ${error.message}`));
      orderServer = server;
      resolve();
    });
  });
}

async function remoteOrderRequest(config, route, options = {}) {
  const response = await fetch(`http://${config.serverIp}:${config.port}${route}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(5000)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Falha de comunicação (${response.status}).`);
  return body;
}

function ordersOperation(localOperation, remoteRoute, remoteOptions) {
  const config = readNetworkConfig();
  if (config.mode === "client") return remoteOrderRequest(config, remoteRoute, remoteOptions);
  return Promise.resolve(localOperation());
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

ipcMain.handle("get-network-config", async () => ({
  ...readNetworkConfig(),
  localIps: localIpv4Addresses()
}));

ipcMain.handle("save-network-config", async (_event, payload) => {
  const mode = ["local", "host", "client"].includes(payload?.mode) ? payload.mode : "local";
  const port = Number(payload?.port || ORDER_SERVER_PORT);
  const serverIp = String(payload?.serverIp || "").trim();
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("A porta da sincronização é inválida.");
  }
  if (mode === "client") {
    if (!net.isIP(serverIp)) throw new Error("Informe o IP do computador principal.");
    await remoteOrderRequest({ serverIp, port }, "/health");
    const localOrders = readOrdersFile();
    if (localOrders.length) {
      await remoteOrderRequest({ serverIp, port }, "/orders/import", {
        method: "POST",
        body: JSON.stringify({ orders: localOrders })
      });
    }
  }
  const config = { mode, serverIp, port };
  fs.writeFileSync(networkConfigPath(), JSON.stringify(config, null, 2), "utf8");
  await startOrderServer(config);
  return { ...config, localIps: localIpv4Addresses() };
});

ipcMain.handle("orders-list", () => ordersOperation(readOrdersFile, "/orders"));

ipcMain.handle("orders-save", (_event, order) => ordersOperation(() => {
  const orders = readOrdersFile().filter(item => item.id !== order.id);
  writeOrdersFile([...orders, order]);
  return order;
}, "/orders", { method: "POST", body: JSON.stringify(order) }));

ipcMain.handle("orders-import", (_event, orders) => ordersOperation(() => {
  const current = readOrdersFile();
  const merged = [...current, ...(Array.isArray(orders) ? orders : [])]
    .filter((order, index, all) => order?.id && all.findIndex(item => item.id === order.id) === index);
  writeOrdersFile(merged);
  return merged;
}, "/orders/import", { method: "POST", body: JSON.stringify({ orders }) }));

ipcMain.handle("orders-status", (_event, payload) => ordersOperation(() => {
  writeOrdersFile(readOrdersFile().map(order => order.id === payload.id ? { ...order, ...payload.changes } : order));
  return { ok: true };
}, `/orders/${encodeURIComponent(payload.id)}/status`, {
  method: "PATCH",
  body: JSON.stringify(payload.changes)
}));

function sendToNetworkPrinter(host, port, data) {
  return new Promise((resolve, reject) => {
    if (!net.isIP(host)) return reject(new Error("Informe um IP válido para a impressora."));
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`A impressora não respondeu em ${host}:${port}.`));
    }, 8000);
    socket.once("connect", () => {
      socket.write(data, error => {
        if (error) reject(error);
        else socket.end();
      });
    });
    socket.once("error", error => {
      clearTimeout(timer);
      reject(new Error(`Não foi possível conectar à impressora em ${host}:${port}: ${error.message}`));
    });
    socket.once("close", hadError => {
      clearTimeout(timer);
      if (!hadError) resolve();
    });
  });
}

ipcMain.handle("check-network-printer", async (_event, payload) => {
  const host = String(payload?.printerIp || "").trim();
  const port = Number(payload?.printerPort || 9100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("A porta da impressora é inválida.");
  if (!net.isIP(host)) throw new Error("Informe um IP válido para a impressora.");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Nenhuma impressora respondeu em ${host}:${port}.`));
    }, 4000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ reachable: true });
    });
    socket.once("error", error => {
      clearTimeout(timer);
      reject(new Error(`Não foi possível localizar a impressora em ${host}:${port}: ${error.message}`));
    });
  });
});

ipcMain.handle("print-receipt", async (event, payload) => {
  let rawFile;
  try {
    const requestedPrinterName = String(payload?.printerName || "");
    const rawData = String(payload?.rawData || "");
    if (!rawData) throw new Error("Conteúdo RAW da comanda não foi recebido.");

    const printerMode = payload?.printerMode === "network" ? "network" : "usb";
    if (printerMode === "network") {
      const printerIp = String(payload?.printerIp || "").trim();
      const printerPort = Number(payload?.printerPort || 9100);
      if (!Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) {
        throw new Error("A porta da impressora é inválida.");
      }
      writePrintLog(`Pedido de impressão por rede em ${printerIp}:${printerPort}.`);
      await sendToNetworkPrinter(printerIp, printerPort, Buffer.from(rawData, "base64"));
      writePrintLog("Dados RAW/ESC-POS enviados diretamente à impressora pela rede.");
      return;
    }

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

    if (!printer) throw new Error(`Impressora "${requestedPrinterName}" não encontrada no Windows.`);

    writePrintLog(`Impressora selecionada: ${printer.name}`);
    rawFile = path.join(os.tmpdir(), `gestor-chapa-${process.pid}-${Date.now()}.bin`);
    fs.writeFileSync(rawFile, Buffer.from(rawData, "base64"));
    const scriptPath = app.isPackaged
      ? path.join(process.resourcesPath, "app.asar.unpacked", "rawPrinter.ps1")
      : path.join(__dirname, "rawPrinter.ps1");
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Arquivo auxiliar de impressão não encontrado: ${scriptPath}`);
    }
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

ipcMain.handle("get-app-version", () => app.getVersion());

async function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    writeUpdateLog(`Verificando atualizações. Versão instalada: ${app.getVersion()}.`);
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    writeUpdateLog(`ERRO AO VERIFICAR: ${error instanceof Error ? error.stack || error.message : String(error)}`);
  }
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", info => {
  writeUpdateLog(`Atualização ${info.version} encontrada. Iniciando download.`);
});

autoUpdater.on("update-not-available", info => {
  writeUpdateLog(`Aplicativo atualizado (${info.version}).`);
});

autoUpdater.on("error", error => {
  writeUpdateLog(`ERRO DO ATUALIZADOR: ${error instanceof Error ? error.stack || error.message : String(error)}`);
});

autoUpdater.on("download-progress", progress => {
  writeUpdateLog(`Download: ${Math.round(progress.percent)}%.`);
});

app.whenReady().then(() => {
  createWindow();
  startOrderServer().catch(error => {
    dialog.showErrorBox("Rede do Gestor de Chapa", `Não foi possível iniciar o compartilhamento: ${error.message}`);
  });
  setTimeout(checkForUpdates, 5000);
  setInterval(checkForUpdates, UPDATE_INTERVAL_MS);
});

autoUpdater.on("update-downloaded", () => {
  writeUpdateLog("Atualização baixada e pronta para instalar.");
  dialog.showMessageBox({
    type: "info",
    title: "Atualização disponível",
    message: "Uma nova versão foi baixada. O aplicativo será reiniciado."
  }).then(() => {
    autoUpdater.quitAndInstall();
  });
});

app.on("before-quit", stopOrderServer);
