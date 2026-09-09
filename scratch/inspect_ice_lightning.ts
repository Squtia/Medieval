import * as THREE from 'three';
import { CombatFXEngine } from '../src/ui/fx/CombatFXEngine.ts';
import { VFXPresetRepository } from '../src/ui/fx/VFXPresetRepository.ts';

const fxEngine = CombatFXEngine.getInstance();
const repo = VFXPresetRepository.getInstance();

const caster = new THREE.Vector3(-260, 0, 0);
const target = new THREE.Vector3(260, 0, 0);

console.log('=== 1. 測試菲涅爾冰晶槍 (VFX_ICE_LANCE) ===');
const icePreset = repo.getPreset('VFX_ICE_LANCE')!;
console.log('Ice preset:', { id: icePreset.id, traj: icePreset.trajectory, shader: icePreset.shaderMode, spatial: icePreset.spatialMode, path: (icePreset as any).trajectoryPath });

// 單發測試
fxEngine.renderFrameWorldAt(icePreset, 0.2, caster, target);
let trackGroup = (fxEngine as any).studioTrackGroups[0];
let cache = trackGroup.__cache;
console.log('Ice salvo=1:');
console.log('  frostGroup visible:', cache.frostGroup?.visible);
console.log('  frostGroup world pos:', cache.frostGroup?.getWorldPosition(new THREE.Vector3()));
console.log('  trackGroup position:', trackGroup.position);

// 多發測試 (salvo=3)
const iceSalvo3 = { ...icePreset, salvoCount: 3 };
fxEngine.renderFrameWorldAt(iceSalvo3, 0.2, caster, target);
trackGroup = (fxEngine as any).studioTrackGroups[0];
cache = trackGroup.__cache;
console.log('Ice salvo=3:');
console.log('  frostGroup visible:', cache.frostGroup?.visible);
console.log('  frostGroup world pos:', cache.frostGroup?.getWorldPosition(new THREE.Vector3()));
console.log('  multiArcGroup visible:', cache.multiArcGroup?.visible);
console.log('  trackGroup position:', trackGroup.position);
if (cache.multiArcs) {
  cache.multiArcs.forEach((arc: any, i: number) => {
    console.log(`  bullet ${i}: visible=${arc.group.visible}, pos=(${arc.group.position.x.toFixed(1)}, ${arc.group.position.y.toFixed(1)})`);
  });
}

console.log('\n=== 2. 測試風暴狂雷 (VFX_LIGHTNING_BOLT) ===');
const lightningPreset = repo.getPreset('VFX_LIGHTNING_BOLT')!;
console.log('Lightning preset:', { id: lightningPreset.id, traj: lightningPreset.trajectory, shader: lightningPreset.shaderMode, spatial: lightningPreset.spatialMode });

fxEngine.renderFrameWorldAt(lightningPreset, 0.2, caster, target);
trackGroup = (fxEngine as any).studioTrackGroups[0];
cache = trackGroup.__cache;
console.log('Lightning:');
console.log('  lightningGroup visible:', cache.lightningGroup?.visible);
console.log('  lightningGroup world pos:', cache.lightningGroup?.getWorldPosition(new THREE.Vector3()));
console.log('  trackGroup position:', trackGroup.position);
if (cache.lightningGroup && cache.lightningGroup.children.length > 0) {
  cache.lightningGroup.children.forEach((c: any, i: number) => {
    console.log(`  child ${i}: type=${c.type}, pos=(${c.position.x.toFixed(1)}, ${c.position.y.toFixed(1)})`);
  });
}
