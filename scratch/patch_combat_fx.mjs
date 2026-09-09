import fs from 'fs';

const filePath = 'src/ui/fx/CombatFXEngine.ts';
let content = fs.readFileSync(filePath, 'utf-8');

const target = `    // 🏹 多彈道弧線散佈 (ARC_MULTI / 奧術飛彈)
    if (track.preset?.trajectory === 'ARC_MULTI' || track.spatialMode === 'ARC_MULTI') {
      MeshLayerRenderer.updateArcMulti(
        trackGroup,
        casterPos,
        targetPos,
        p,
        sc,
        track.colorRim || '#38bdf8',
        cache,
        track.preset?.salvoCount,
        (col, sz, op) => this.createGlowSprite(col, sz, op)
      );
      return;
    }`;

const replacement = `    // 🏹 多彈道弧線散佈 (ARC_MULTI / 多發彈幕 salvoCount > 1)
    if (track.preset?.trajectory === 'ARC_MULTI' || track.spatialMode === 'ARC_MULTI' || (track.preset?.salvoCount && track.preset.salvoCount > 1)) {
      MeshLayerRenderer.updateArcMulti(
        trackGroup,
        casterPos,
        targetPos,
        p,
        sc,
        track.colorRim || '#38bdf8',
        cache,
        track.preset?.salvoCount,
        (col, sz, op) => this.createGlowSprite(col, sz, op),
        track.preset?.salvoSpreadAngle || 0,
        track.preset?.salvoSpreadRadius || 0
      );
      return;
    }`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
const normReplacement = replacement.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  const updated = normContent.replace(normTarget, normReplacement);
  fs.writeFileSync(filePath, updated, 'utf-8');
  console.log('Successfully patched CombatFXEngine.ts');
} else {
  console.error('Target not found in CombatFXEngine.ts');
}
