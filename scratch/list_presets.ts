import { VFXPresetRepository } from '../src/ui/fx/VFXPresetRepository.ts';
const repo = VFXPresetRepository.getInstance();
const list = repo.getAllPresets().map(p => ({ id: p.id, name: p.name, shader: p.shaderMode, traj: p.trajectory, path: (p as any).trajectoryPath, spatial: p.spatialMode }));
console.log(JSON.stringify(list, null, 2));
