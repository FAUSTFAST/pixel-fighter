'use strict';
const path = require('node:path');
const { version } = require('../package.json');
const displayVersion = version.replace(/\.0$/, '');
module.exports = {
  appId: 'io.github.faustfast.pixel-fighter', productName: 'Pixel Fighter',
  electronVersion: require('electron/package.json').version,
  directories: { app: path.resolve(__dirname, '../output/desktop/app'), output: path.resolve(__dirname, '../output/desktop/releases') },
  files: ['package.json', 'main.cjs', 'protocol.cjs', 'public/**/*'],
  asar: true, npmRebuild: false, buildDependenciesFromSource: false,
  electronLanguages: ['en-US', 'zh-CN'],
  // No publishing side effects, even on a tagged CI run.
  publish: null,
  mac: {
    target: [{ target: 'dmg', arch: ['universal'] }],
    category: 'public.app-category.action-games', minimumSystemVersion: '13.0',
    identity: '-', hardenedRuntime: true, notarize: false,
    entitlements: path.join(__dirname, 'entitlements.mac.plist'),
    entitlementsInherit: path.join(__dirname, 'entitlements.mac.plist'),
    artifactName: `Pixel-Fighter-macOS-Universal-v${displayVersion}.dmg`
  },
  dmg: { sign: false, title: 'Pixel Fighter', contents: [
    { x: 140, y: 180, type: 'file' }, { x: 420, y: 180, type: 'link', path: '/Applications' }
  ] },
  win: {
    target: [{ target: 'zip', arch: ['x64'] }],
    signAndEditExecutable: false,
    artifactName: `Pixel-Fighter-Windows-x64-v${displayVersion}.zip`
  }
};
