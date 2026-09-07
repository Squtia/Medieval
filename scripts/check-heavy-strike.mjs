import fs from 'fs';
import path from 'path';
import { VFXTimelineEvaluator } from '../src/ui/fx/VFXTimelineEvaluator.ts';

const vfxFile = path.resolve('./src/data/vfx_presets.json');
const presets = JSON.parse(fs.readFileSync(vfxFile, 'utf-8'));
const heavy = presets.find(p => p.id === 'VFX_HEAVY_STRIKE');

console.log('Heavy Strike in JSON:');
console.log('duration:', heavy.duration);
console.log('salvoDuration:', heavy.salvoDuration);
console.log('layers:', JSON.stringify(heavy.layers, null, 2));
console.log('impactCues:', JSON.stringify(heavy.impactCues, null, 2));
console.log('getEffectivePresentationDuration:', VFXTimelineEvaluator.getEffectivePresentationDuration(heavy));
