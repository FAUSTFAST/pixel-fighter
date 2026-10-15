'use strict';
const { build, Platform } = require('electron-builder');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { prepare, output, hash } = require('./prepare.cjs');
const config = require('./builder.cjs');
async function run() {
  const platform = process.argv[2];
  if (!['win', 'mac'].includes(platform)) throw new Error('Usage: node desktop/build.cjs win|mac');
  if (platform === 'mac' && process.platform !== 'darwin') throw new Error('Universal macOS packaging requires a Mac');
  await prepare();
  await build({ config, targets: (platform === 'mac' ? Platform.MAC : Platform.WINDOWS).createTarget(), publish: 'never' });
  const release = config.directories.output;
  if (platform === 'mac') {
    const application = path.join(release, 'mac-universal/Pixel Fighter.app');
    const version = require('../package.json').version.replace(/\.0$/, '');
    const zip = path.join(release, `Pixel-Fighter-macOS-Universal-v${version}.zip`);
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', application], { stdio: 'inherit' });
    // ditto preserves .app executable permissions and Framework symlinks.
    execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', application, zip], { stdio: 'inherit' });
  }
  const files = (await fs.readdir(release)).filter(name => name.endsWith('.zip') || name.endsWith('.dmg'));
  const checksums = [];
  for (const file of files.sort()) checksums.push(`${hash(await fs.readFile(path.join(release, file)))}  ${file}`);
  await fs.writeFile(path.join(release, 'SHA256SUMS.txt'), checksums.join('\n') + '\n');
  await fs.copyFile(path.join(output, 'resource-manifest.json'), path.join(output, `resource-manifest-${platform}.json`));
  console.log(`Artifacts: ${release}`);
}
run().catch(error => { console.error(error); process.exitCode = 1; });
