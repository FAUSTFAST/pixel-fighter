'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inflateRawSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const asar = require('@electron/asar');
const { root, output, hash } = require('./prepare.cjs');
const config = require('./builder.cjs');
function inspectASAR(archive, manifest) {
  const expected = ['main.cjs', 'protocol.cjs', 'package.json', ...manifest.files.map(file => 'public/' + file.file)].sort();
  const entries = asar.listPackage(archive).map(file => file.replaceAll('\\', '/').replace(/^\//, ''));
  const files = entries.filter(file => !asar.statFile(archive, file).files).sort();
  assert.deepEqual(files, expected, 'ASAR must contain runtime allowlist only');
  for (const file of manifest.files) assert.equal(hash(asar.extractFile(archive, 'public/' + file.file)), file.packagedSHA256, file.file);
  assert.equal(JSON.parse(asar.extractFile(archive, 'package.json')).version, manifest.version);
  return files.length;
}
function zipEntries(file, visit) {
  // ZIP central directory parser: no extraction, no platform-specific system tool.
  const bytes = fs.readFileSync(file);
  let eocd = bytes.length - 22;
  while (eocd >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  assert.ok(eocd >= 0, 'ZIP end record');
  const total = bytes.readUInt16LE(eocd + 10), names = [];
  let cursor = bytes.readUInt32LE(eocd + 16);
  for (let i = 0; i < total; i++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const length = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const name = bytes.subarray(cursor + 46, cursor + 46 + length).toString('utf8');
    assert.ok(!name.startsWith('/') && !name.split('/').includes('..'), 'safe ZIP entry');
    if (visit && !name.endsWith('/')) {
      const method = bytes.readUInt16LE(cursor + 10), compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
      const local = bytes.readUInt32LE(cursor + 42); assert.equal(bytes.readUInt32LE(local), 0x04034b50);
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const data = bytes.subarray(start, start + compressedSize);
      assert.ok([0, 8].includes(method), 'supported ZIP compression');
      const expanded = method === 8 ? inflateRawSync(data) : data; assert.equal(expanded.length, size);
      visit(name, expanded);
    }
    names.push(name); cursor += 46 + length + extra + comment;
  }
  return names;
}
function machOArchitectures(app) {
  const architectures = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) { walk(file); continue; }
      const fd = fs.openSync(file, 'r'), bytes = Buffer.alloc(4); fs.readSync(fd, bytes, 0, 4, 0); fs.closeSync(fd);
      if (![0xfeedface, 0xfeedfacf, 0xcafebabe, 0xcefaedfe, 0xcffaedfe, 0xbebafeca].includes(bytes.readUInt32BE())) continue;
      const arch = execFileSync('/usr/bin/lipo', ['-archs', file], { encoding: 'utf8' }).trim().split(/\s+/);
      assert.ok(arch.includes('arm64') && arch.includes('x86_64'), file + ' must be universal');
      architectures.push({ file: path.relative(app, file), architectures: arch });
    }
  }
  walk(app); return architectures;
}
function verify(platform) {
  const release = config.directories.output;
  const manifest = JSON.parse(fs.readFileSync(path.join(output, `resource-manifest-${platform}.json`)));
  const version = manifest.version.replace(/\.0$/, '');
  const result = { platform, version: manifest.version, passed: true, osExecutionTest: false,
    sourceSnapshot: { commit: manifest.commit, preparedAt: manifest.generatedAt }, artifacts: [] };
  const artifactNames = platform === 'win' ? [`Pixel-Fighter-Windows-x64-v${version}.zip`] :
    [`Pixel-Fighter-macOS-Universal-v${version}.zip`, `Pixel-Fighter-macOS-Universal-v${version}.dmg`];
  if (platform === 'win') {
    const unpacked = path.join(release, 'win-unpacked');
    const exe = fs.readFileSync(path.join(unpacked, 'Pixel Fighter.exe'));
    assert.equal(exe.subarray(0, 2).toString(), 'MZ');
    const pe = exe.readUInt32LE(0x3c); assert.equal(exe.readUInt32LE(pe), 0x4550); assert.equal(exe.readUInt16LE(pe + 4), 0x8664, 'x64 PE');
    for (const file of ['ffmpeg.dll', 'd3dcompiler_47.dll', 'icudtl.dat', 'resources.pak', 'v8_context_snapshot.bin', 'locales/en-US.pak', 'locales/zh-CN.pak']) assert.ok(fs.existsSync(path.join(unpacked, file)), file);
    result.asarFiles = inspectASAR(path.join(unpacked, 'resources/app.asar'), manifest);
    const names = zipEntries(path.join(release, `Pixel-Fighter-Windows-x64-v${version}.zip`), (name, bytes) => {
      assert.equal(hash(bytes), hash(fs.readFileSync(path.join(unpacked, name))), name + ' ZIP payload');
    });
    assert.ok(names.includes('Pixel Fighter.exe') && names.includes('resources/app.asar'));
    assert.ok(!names.some(name => /(?:^|\/)(?:\.git|scripts|desktop|node_modules)\//.test(name) || name.endsWith('.map')));
    result.zipEntries = names.length;
    result.zipPayloadsMatchUnpacked = true;
    result.note = 'PE x64, bundled runtime, ZIP structure, ASAR hashes verified. Actual Windows launch requires Windows hardware/VM.';
  } else {
    assert.equal(process.platform, 'darwin');
    const app = path.join(release, 'mac-universal/Pixel Fighter.app');
    const appASAR = path.join(app, 'Contents/Resources/app.asar');
    result.asarFiles = inspectASAR(appASAR, manifest);
    const asarSHA256 = hash(fs.readFileSync(appASAR));
    const minimumOS = execFileSync('/usr/bin/plutil', ['-extract', 'LSMinimumSystemVersion', 'raw', path.join(app, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
    assert.equal(minimumOS, config.mac.minimumSystemVersion, 'minimum macOS matches build configuration');
    result.minimumSystemVersion = minimumOS;
    result.machOBinaries = machOArchitectures(app);
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
    const checkDir = fs.mkdtempSync(path.join(output, 'zip-check-'));
    execFileSync('/usr/bin/ditto', ['-x', '-k', path.join(release, `Pixel-Fighter-macOS-Universal-v${version}.zip`), checkDir]);
    const restored = path.join(checkDir, 'Pixel Fighter.app');
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', restored]);
    assert.equal(hash(fs.readFileSync(path.join(restored, 'Contents/Resources/app.asar'))), asarSHA256, 'ZIP contains the verified game ASAR');
    assert.ok(fs.statSync(path.join(restored, 'Contents/MacOS/Pixel Fighter')).mode & 0o111);
    assert.ok(fs.lstatSync(path.join(restored, 'Contents/Frameworks/Electron Framework.framework/Versions/Current')).isSymbolicLink());
    const dmg = path.join(release, `Pixel-Fighter-macOS-Universal-v${version}.dmg`);
    execFileSync('/usr/bin/hdiutil', ['verify', dmg]);
    const mount = fs.mkdtempSync(path.join(output, 'dmg-check-'));
    execFileSync('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg]);
    try {
      assert.ok(fs.existsSync(path.join(mount, 'Pixel Fighter.app/Contents/MacOS/Pixel Fighter')));
      assert.equal(fs.readlinkSync(path.join(mount, 'Applications')), '/Applications');
      execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', path.join(mount, 'Pixel Fighter.app')]);
      assert.equal(hash(fs.readFileSync(path.join(mount, 'Pixel Fighter.app/Contents/Resources/app.asar'))), asarSHA256, 'DMG contains the verified game ASAR');
    } finally { execFileSync('/usr/bin/hdiutil', ['detach', mount]); }
    result.zipPermissionsAndSymlinks = true; result.dmgApplicationsLink = true;
    result.note = 'Universal Mach-O and ad-hoc signature verified, ZIP re-extracted, DMG mounted read-only. No Developer ID/notarization. OS launch is recorded separately.';
  }
  for (const name of artifactNames) {
    const file = path.join(release, name);
    result.artifacts.push({ file: name, bytes: fs.statSync(file).size, sha256: hash(fs.readFileSync(file)) });
  }
  result.verifiedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, `verification-${platform}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
}
const requested = process.argv.find(arg => arg.startsWith('--platform='))?.split('=')[1];
try {
  for (const platform of requested ? [requested] : ['win', 'mac']) {
    assert.ok(['win', 'mac'].includes(platform)); verify(platform);
  }
} catch (error) { console.error(error); process.exitCode = 1; }
module.exports = { inspectASAR, zipEntries };
