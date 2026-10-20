import { build } from 'esbuild';
import { copyFile, mkdir, mkdtemp, rename, access } from 'node:fs/promises';
import { resolve } from 'node:path';

// Assemble fresh output and preserve previous builds as local backups.
const output = await mkdtemp(resolve('.build-'));
await mkdir(`${output}/data`);
await copyFile('src/index.html', `${output}/index.html`);
await copyFile('src/styles.css', `${output}/styles.css`);
await build({ entryPoints: ['src/app.js'], outfile: `${output}/app.js`, bundle: true, minify: true, platform: 'browser', format: 'iife', target: ['es2020'] });
// Explicit allowlist: synthetic phase-one teaching inputs only.
for (const file of ['01_영업실적.xlsx', '02_온라인실적.xlsx', '03_팝업실적.xlsx', '04_보고양식.xlsx']) {
  await copyFile(resolve('../A_매출비교', file), `${output}/data/${file}`);
}
let hasPrevious = false;
try { await access('dist'); hasPrevious = true; } catch {}
if (hasPrevious) {
  await mkdir('../results/build-backups', { recursive: true });
  await rename('dist', `../results/build-backups/dist-${Date.now()}`);
}
await rename(output, 'dist');
console.log('Phase-one dashboard built in dist/ (4 synthetic input files).');
