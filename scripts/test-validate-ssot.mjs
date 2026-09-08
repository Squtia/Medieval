import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// 若由原生 Node 執行，自動透過 vite-node 轉發以精確解析 TS 模組相依性
if (!process.env.VITE_NODE) {
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxCmd, ['vite-node', 'scripts/test-validate-ssot.mjs'], {
    shell: true,
    encoding: 'utf-8',
    env: { ...process.env, VITE_NODE: 'true' }
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 0);
}

const { VFXPresetValidator } = await import('../src/ui/fx/VFXPresetValidator.ts');

const vfxFile = path.resolve('./src/data/vfx_presets.json');
const presets = JSON.parse(fs.readFileSync(vfxFile, 'utf-8'));
const res = VFXPresetValidator.validatePresetList(presets);

console.log('Valid:', res.isValid);
if (!res.isValid) {
  console.error('Errors:', JSON.stringify(res.errors, null, 2));
  process.exit(1);
} else {
  console.log('All presets are valid according to VFXPresetValidator!');
}
