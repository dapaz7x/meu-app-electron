const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true
  });

  win.loadFile(path.join(__dirname, "dist/index.html"));
}

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
