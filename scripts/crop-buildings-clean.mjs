import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const OUT_DIR = 'd:/tryagent/Medieval/public/assets/buildings';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  console.log('🏛️ 精準對齊 6 大設施建築 (v3)...');
  const imgPath = 'd:/tryagent/Medieval/public/assets/icons_facilities_parchment_12.jpg';
  const img = await Jimp.read(imgPath);

  const rects = {
    'bld_tavern.png':   { x: 48,  y: 50,  w: 254, h: 254 },
    'bld_forge.png':    { x: 332, y: 50,  w: 254, h: 254 },
    'bld_weapon.png':   { x: 616, y: 50,  w: 254, h: 254 },
    'bld_armor.png':    { x: 900, y: 50,  w: 254, h: 254 },
    'bld_study.png':    { x: 48,  y: 342, w: 254, h: 254 },
    'bld_defense.png':  { x: 332, y: 342, w: 254, h: 254 }
  };

  for (const [key, r] of Object.entries(rects)) {
    const cropped = img.clone().crop({ x: r.x, y: r.y, w: r.w, h: r.h });
    await cropped.write(path.join(OUT_DIR, key));
    console.log(`✅ [${key}] 已輸出完美校準卡片 (${r.w}x${r.h})`);
  }

  console.log('🎉 6 大建築設施精確校準完成！');
}

main().catch(err => console.error(err));
