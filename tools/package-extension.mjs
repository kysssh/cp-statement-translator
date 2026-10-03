import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
assert.equal(manifest.version, pkg.version, 'Build and package versions must match');
const archive = `cp-statement-translator-v${pkg.version}.zip`;
// Windows bsdtar supports ZIP through -a; use zip on other systems.
const result = process.platform === 'win32'
  ? spawnSync('tar', ['-a', '-cf', archive, '-C', 'dist', '.'], { stdio: 'inherit', windowsHide: true })
  : spawnSync('zip', ['-r', `../${archive}`, '.'], { cwd: 'dist', stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Generated ${archive}`);
