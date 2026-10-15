'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const target = process.env.RELEASE_REPO, version = process.env.RELEASE_VERSION;
if (!/^[\w.-]+\/[\w.-]+$/.test(target || '') || target.toLowerCase() === process.env.GITHUB_REPOSITORY?.toLowerCase() || !/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('Invalid destination/version');
if (!process.env.GH_TOKEN) throw new Error('Configure a fine-grained release-repository-only token');
const repo = JSON.parse(execFileSync('gh', ['api', `repos/${target}`], { encoding: 'utf8' }));
if (repo.private) throw new Error('Destination must be the separate public release repository');
const display = version.replace(/\.0$/, '');
const expected = [`Pixel-Fighter-Windows-x64-v${display}.zip`, `Pixel-Fighter-macOS-Universal-v${display}.zip`, `Pixel-Fighter-macOS-Universal-v${display}.dmg`, 'SHA256SUMS.txt'].sort();
const files = fs.readdirSync('release').sort();
if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error('Artifact allowlist mismatch; do not upload');
const checksums = fs.readFileSync('release/SHA256SUMS.txt', 'utf8');
for (const file of files.filter(name => name !== 'SHA256SUMS.txt')) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join('release', file))).digest('hex');
  if (!checksums.split('\n').includes(`${hash}  ${file}`)) throw new Error('Checksum mismatch: ' + file);
}
const notes = path.resolve('release-notes.txt');
fs.writeFileSync(notes, `Pixel Fighter v${version}\n\nWindows 10/11 x64: unzip the entire folder and open Pixel Fighter.exe.\nmacOS 12+: Universal arm64 + x64. Unzip and open Pixel Fighter.app, or drag it from the DMG to Applications.\n\nThis test build is not notarized by Apple and has no trusted publisher signature. Gatekeeper/SmartScreen may block first launch; verify SHA256 and follow your operating system's explicit approval flow only if you trust the download.\nASAR and identifier obfuscation deter casual inspection but do not prevent reverse engineering.\n`);
// Draft only. A human must inspect and publish the release in the destination repository.
execFileSync('gh', ['release', 'create', `v${version}`, '--repo', target, '--draft', '--title', `Pixel Fighter v${version}`, '--notes-file', notes, ...files.map(file => path.join('release', file))], { stdio: 'inherit' });
