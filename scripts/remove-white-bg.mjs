import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('public/assets');
const filesToProcess = [
  'node_castle.png',
  'node_town.png',
  'node_village.png',
  'node_ruins.png',
  'node_cave.png',
  'node_forest.png',
  'node_port.png',
  'node_monastery.png',
  'node_volcano.png',
  'btn_epic_crest.png',
  'btn_return_base_gold.png'
];

async function removeWhiteBackgrounds() {
  console.log('🧼 Starting white background removal on asset PNGs...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const filename of filesToProcess) {
    const filePath = path.join(assetsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filename}, skipping.`);
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;

    const processedBase64 = await page.evaluate(async ({ src, filename }) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const isButton = filename.startsWith('btn_');
          const canvas = document.createElement('canvas');
          canvas.width = isButton ? img.width : 128;
          canvas.height = isButton ? img.height : 128;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          const threshold = isButton ? 240 : 230;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r >= threshold && g >= threshold && b >= threshold) {
              data[i + 3] = 0; // Transparent alpha
            }
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = src;
      });
    }, { src: base64Image, filename });

    const base64Data = processedBase64.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`✅ Cleaned transparent background for: ${filename}`);
  }

  await browser.close();
  console.log('🎉 All asset PNG backgrounds successfully converted to transparent!');
}

removeWhiteBackgrounds().catch(err => {
  console.error('❌ Error processing images:', err);
  process.exit(1);
});
