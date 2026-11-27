const { app, BrowserWindow, ipcMain, protocol, shell } = require('electron');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { METHODS, toChannel } = require('./channels.cjs');

// electron/main.cjs
// 听屿桌面壳：加载 Vite 产物，提供最小 preload IPC；未知桌面能力返回安全空值，不阻塞 Web UI。

protocol.registerSchemesAsPrivileged([{
  scheme: 'tingyu',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
}]);

const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const NETEASE_STATUS_CHANNEL = 'netease-api-status-changed';
let neteaseApp = null;
let neteasePort = null;
let neteaseStartPromise = null;
let neteaseStatus = { status: 'starting', port: null, error: null, updatedAt: Date.now() };

function publishNeteaseStatus(patch) {
  neteaseStatus = { ...neteaseStatus, ...patch, updatedAt: Date.now() };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(NETEASE_STATUS_CHANNEL, neteaseStatus);
  }
}

/** 让网易 API 监听随机空闲回环端口，避免和 Vite / 用户本机服务抢固定端口。 */
function reserveLocalPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

/** renderer 的 netease.ts 只认 getNeteasePort；这里提供真实内嵌后端而不是空桩。 */
async function startNeteaseApi() {
  if (neteaseApp?.server?.listening) return true;
  if (neteaseStartPromise) return neteaseStartPromise;
  neteaseStartPromise = (async () => {
    publishNeteaseStatus({ status: 'starting', port: null, error: null });
    try {
      const port = await reserveLocalPort();
      if (!port) throw new Error('could not reserve a loopback port');
      const { serveNcmApi } = require('@neteasecloudmusicapienhanced/api/server');
      const appExt = await serveNcmApi({ host: '127.0.0.1', port, checkVersion: false });
      await new Promise((resolve, reject) => {
        if (appExt.server.listening) return resolve();
        appExt.server.once('listening', resolve);
        appExt.server.once('error', reject);
      });
      neteaseApp = appExt;
      neteasePort = port;
      publishNeteaseStatus({ status: 'running', port, error: null });
      return true;
    } catch (error) {
      publishNeteaseStatus({ status: 'error', port: null, error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      neteaseStartPromise = null;
    }
  })();
  return neteaseStartPromise;
}

async function stopNeteaseApi() {
  const running = neteaseApp;
  neteaseApp = null;
  neteasePort = null;
  if (!running?.server?.listening) return;
  await new Promise(resolve => running.server.close(() => resolve()));
}

function registerAppProtocol() {
  protocol.registerFileProtocol('tingyu', (request, callback) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const target = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
    callback({ path: target.startsWith(DIST_DIR) ? target : path.join(DIST_DIR, 'index.html') });
  });
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings));
}

function updateStatus() {
  return {
    status: 'idle', supported: false, updateCheckSupported: false,
    platform: process.platform, updateCheckEnabled: false, autoUpdateEnabled: false,
    autoUpdateSupported: false, currentVersion: app.getVersion(), availableVersion: null,
    updateUrl: null, error: null, lastCheckedAt: null, lastSeenVersion: null,
    updateSeen: true, downloadProgress: null,
  };
}

function stubValue(name) {
  if (name === 'getUpdateStatus' || name === 'checkForUpdates' || name === 'markUpdateSeen'
    || name === 'downloadUpdate' || name === 'quitAndInstallUpdate') return updateStatus();
  if (name === 'getCacheDirectory') return { path: app.getPath('userData'), custom: false };
  if (name === 'getSettings') return readSettings();
  if (name.startsWith('is') || name.startsWith('has') || name.startsWith('getMainWindow')
    || name.startsWith('getRemoteControlAlwaysOnTop')) return false;
  if (name.endsWith('Usage')) return 0;
  if (name.startsWith('list') || name.endsWith('Models')) return [];
  if (name.startsWith('get')) return {};
  if (name.startsWith('set') || name.startsWith('publish') || name.startsWith('send')) return true;
  return null;
}

function registerIpc() {
  ipcMain.on('get-platform', event => { event.returnValue = process.platform; });
  ipcMain.on('get-is-linux-x11', event => { event.returnValue = false; });
  const handled = new Set([
    'get-settings', 'save-settings', 'open-external-url', 'quit-app',
    'get-netease-port', 'get-netease-api-status', 'restart-netease-api',
  ]);
  for (const name of METHODS) {
    const channel = toChannel(name);
    if (handled.has(channel)) continue;
    ipcMain.handle(channel, async () => stubValue(name));
  }
  ipcMain.handle('get-settings', async () => readSettings());
  ipcMain.handle('save-settings', async (_event, key, value) => {
    const settings = readSettings();
    if (key) settings[key] = value;
    else Object.assign(settings, value || {});
    writeSettings(settings);
    return value;
  });
  ipcMain.handle('open-external-url', async (_event, rawUrl) => {
    try {
      const url = new URL(String(rawUrl));
      if (!['http:', 'https:'].includes(url.protocol)) return false;
      await shell.openExternal(url.href);
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle('get-netease-port', async () => neteasePort);
  ipcMain.handle('get-netease-api-status', async () => neteaseStatus);
  ipcMain.handle('restart-netease-api', async () => {
    await stopNeteaseApi();
    return startNeteaseApi();
  });
  ipcMain.handle('quit-app', async () => { app.quit(); return true; });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 860,
    minHeight: 600,
    title: 'Tingyu',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (process.env.TINGYU_DESKTOP_DEV === 'true') {
    void window.loadURL('http://127.0.0.1:3000');
  } else {
    void window.loadURL('tingyu://app/index.html');
  }
}

registerIpc();
app.whenReady().then(() => {
  registerAppProtocol();
  void startNeteaseApi();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', () => { void stopNeteaseApi(); });
