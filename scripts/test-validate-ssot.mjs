import fs from 'fs';
import path from 'path';
import { VFXPresetValidator } from '../src/ui/fx/VFXPresetValidator.ts';

const vfxFile = path.resolve('./src/data/vfx_presets.json');
const presets = JSON.parse(fs.readFileSync(vfxFile, 'utf-8'));
const res = VFXPresetValidator.validatePresetList(presets);

console.log('Valid:', res.isValid);
if (!res.isValid) {
  console.log('Errors:', JSON.stringify(res.errors, null, 2));
} else {
  console.log('All presets are valid according to VFXPresetValidator!');
}
