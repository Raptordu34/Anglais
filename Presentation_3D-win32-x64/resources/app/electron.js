const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        fullscreen: true, // Lancement en plein écran
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Permet de charger des fichiers locaux facilement
        }
    });

    // Quitter le plein écran avec Echap
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape') {
            win.setFullScreen(false);
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});