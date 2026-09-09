import * as THREE from 'three';
import { CombatFXEngine } from '../src/ui/fx/CombatFXEngine.ts';
import { VFXPresetRepository } from '../src/ui/fx/VFXPresetRepository.ts';

const fxEngine = CombatFXEngine.getInstance();
const repo = VFXPresetRepository.getInstance();

const meteorPreset = repo.getPreset('VFX_METEOR_STRIKE');
console.log('Meteor preset:', {
  id: meteorPreset.id,
  trajectory: meteorPreset.trajectory,
  spatialMode: meteorPreset.spatialMode,
  shaderMode: meteorPreset.shaderMode,
  salvoCount: meteorPreset.salvoCount
});

const caster = new THREE.Vector3(-260, 0, 0);
const target = new THREE.Vector3(260, 0, 0);

const meteorSalvo5 = { ...meteorPreset, salvoCount: 5 };
fxEngine.renderFrameWorldAt(meteorSalvo5, 0, caster, target);
const trackGroup = (fxEngine as any).studioTrackGroups[0];

console.log('\n--- Timeline trajectory check ---');
for (let t = 0; t <= 0.45; t += 0.05) {
  fxEngine.renderFrameWorldAt(meteorSalvo5, t, caster, target);
  const bullets = trackGroup.__cache.multiArcs.map((b: any) => 
    b.group.visible ? `(${b.group.position.x.toFixed(0)},${b.group.position.y.toFixed(0)})` : 'hidden'
  );
  console.log(`t=${t.toFixed(2)}:`, bullets.join(' '));
}

// 2. 模擬使用者拉動 salvoCount = 5

fxEngine.renderFrameWorldAt(meteorSalvo5, 0.27, caster, target);
console.log('\nAfter salvo=5 at t=0.27 (frame 14):');
console.log('volumetricGroup visible:', trackGroup.__cache.volumetricGroup?.visible);
console.log('volumetricGroup position in world:', trackGroup.__cache.volumetricGroup?.getWorldPosition(new THREE.Vector3()));
console.log('multiArcGroup visible:', trackGroup.__cache.multiArcGroup?.visible);
console.log('trackGroup children count:', trackGroup.children.length);
// 3. 模擬切換回雷電 (DIELECTRIC_LIGHTNING)
const lightningPreset = repo.getPreset('VFX_DEFAULT_LIGHTNING') || repo.getPreset('VFX_LIGHTNING_SPEAR') || {
  id: 'VFX_LIGHTNING',
  shaderMode: 'DIELECTRIC_LIGHTNING',
  duration: 0.4
};
fxEngine.renderFrameWorldAt(lightningPreset as any, 0.2, caster, target);
console.log('\nAfter switching to Lightning:');
console.log('trackGroup children count:', trackGroup.children.length);
console.log('volumetricGroup visible:', trackGroup.__cache.volumetricGroup?.visible);
console.log('volumetricGroup in scene world:', trackGroup.__cache.volumetricGroup?.getWorldPosition(new THREE.Vector3()));
console.log('multiArcGroup visible:', trackGroup.__cache.multiArcGroup?.visible);
console.log('multiArcGroup in scene world:', trackGroup.__cache.multiArcGroup?.getWorldPosition(new THREE.Vector3()));
console.log('lightningGroup visible:', trackGroup.__cache.lightningGroup?.visible);

