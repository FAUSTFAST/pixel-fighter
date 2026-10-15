'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fileURLToPath } = require('node:url');
const { staged } = require('../prepare.cjs');

test('production main confines renderer permissions, routes and network requests', async () => {
  const recorded = {}, contents = { handlers: {} };
  contents.setWindowOpenHandler = handler => { recorded.open = handler; };
  contents.on = (name, handler) => { contents.handlers[name] = handler; };
  class BrowserWindow {
    constructor(options) { recorded.window = options; this.webContents = contents; }
    once() {}
    on() {}
    loadURL(url) { recorded.url = url; }
    isFullScreen() { return false; }
    setFullScreen(value) { recorded.fullscreen = value; }
  }
  const session = {
    setPermissionRequestHandler(fn) { recorded.permission = fn; },
    setPermissionCheckHandler(fn) { recorded.check = fn; },
    webRequest: { onBeforeRequest(filter, fn) { recorded.block = fn; recorded.filter = filter; } },
    on(name, fn) { recorded[name] = fn; }
  };
  const electron = {
    app: { isPackaged: true, enableSandbox() { recorded.sandbox = true; }, setName() {}, requestSingleInstanceLock: () => true, on() {}, whenReady: () => Promise.resolve(), getAppPath: () => staged },
    BrowserWindow, Menu: { setApplicationMenu() {}, buildFromTemplate: value => value },
    protocol: { registerSchemesAsPrivileged(value) { recorded.schemes = value; }, handle(name, handler) { recorded.route = handler; } },
    net: { fetch: async url => new Response(fs.readFileSync(fileURLToPath(url))) },
    session: { defaultSession: session }, screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1440, height: 900 } }) }, dialog: { showErrorBox: assert.fail }
  };
  vm.runInNewContext(fs.readFileSync(path.join(staged, 'main.cjs'), 'utf8'), {
    require: name => name === 'electron' ? electron : name === './protocol.cjs' ? require('../protocol.cjs') : require(name),
    process: { platform: 'darwin' }, Response, Headers
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(recorded.sandbox, true);
  const prefs = recorded.window.webPreferences;
  for (const key of ['sandbox', 'contextIsolation', 'webSecurity']) assert.equal(prefs[key], true, key);
  for (const key of ['nodeIntegration', 'nodeIntegrationInWorker', 'webviewTag', 'devTools', 'allowRunningInsecureContent']) assert.equal(prefs[key], false, key);
  assert.equal(prefs.preload, undefined);
  assert.equal(recorded.url, 'pf-game://game/');
  assert.equal(recorded.open().action, 'deny');
  for (const permission of ['media', 'camera', 'microphone', 'notifications', 'geolocation', 'openExternal']) recorded.permission(null, permission, value => assert.equal(value, false));
  recorded.block({ url: 'https://example.com/game.js' }, value => assert.equal(value.cancel, true));
  let denied = false;
  contents.handlers['will-navigate']({ preventDefault() { denied = true; } }, 'https://example.com'); assert.equal(denied, true);
  const response = await recorded.route({ url: 'pf-game://game/assets/characters/air-normals/manifest.json', method: 'GET' });
  assert.equal(response.status, 200); assert.equal(Object.keys((await response.json()).characters).length, 6);
  assert.ok(response.headers.get('Content-Security-Policy').includes("script-src 'self'"));
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  for (const url of ['pf-game://other/index.html', 'pf-game://game/%2f../main.cjs', 'pf-game://game/%00']) assert.equal((await recorded.route({ url, method: 'GET' })).status, 404);
  assert.equal((await recorded.route({ url: 'pf-game://game/', method: 'POST' })).status, 404);
});
