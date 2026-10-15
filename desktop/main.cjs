'use strict';
const { app, BrowserWindow, Menu, protocol, net, session, screen, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ORIGIN, CSP, resolveRequest } = require('./protocol.cjs');

protocol.registerSchemesAsPrivileged([{
  scheme: 'pf-game', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true }
}]);
app.enableSandbox();
app.setName('Pixel Fighter');
let mainWindow;
function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    title: 'Pixel Fighter', width: Math.min(1200, area.width), height: Math.min(780, area.height),
    minWidth: Math.min(800, area.width), minHeight: Math.min(560, area.height),
    backgroundColor: '#080e1b', show: false, autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false, nodeIntegrationInWorker: false, contextIsolation: true,
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
      webviewTag: false, devTools: !app.isPackaged, spellcheck: false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== ORIGIN + '/' && url !== ORIGIN + '/index.html') event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  mainWindow.loadURL(ORIGIN + '/');
  mainWindow.on('closed', () => { mainWindow = null; });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); }
  });
  app.whenReady().then(() => {
    const publicRoot = path.join(app.getAppPath(), 'public');
    protocol.handle('pf-game', async request => {
      try {
        const file = resolveRequest(request.url, publicRoot);
        if (!file || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', CSP);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'fullscreen'));
    ses.setPermissionCheckHandler((_contents, permission, origin) => permission === 'fullscreen' && origin === ORIGIN);
    // No HTTP(S), CDN, analytics or remote code in the desktop game.
    ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] }, (_details, callback) => callback({ cancel: true }));
    ses.on('will-download', event => event.preventDefault());
    Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([
      { label: 'Pixel Fighter', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'togglefullscreen' }] }
    ]) : null);
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { dialog.showErrorBox('Pixel Fighter 启动失败', error.message); app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
