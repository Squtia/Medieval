import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const assetsDir = path.resolve('public/assets');
const filesToProcess = [
  'node_castle.png'
];

async function removeBackground() {
  console.log('🧼 Starting flood-fill background removal on asset PNGs...');
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
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          // Target color is the top-left pixel
          const targetR = data[0];
          const targetG = data[1];
          const targetB = data[2];
          
          const tolerance = 60; // Distance tolerance

          const stack = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]];
          const visited = new Uint8Array(canvas.width * canvas.height);

          function colorMatch(x, y) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            if (a === 0) return false;
            // Calculate distance
            const dist = Math.sqrt((r-targetR)**2 + (g-targetG)**2 + (b-targetB)**2);
            return dist <= tolerance;
          }

          while(stack.length > 0) {
            const [x, y] = stack.pop();
            const idx = y * canvas.width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;

            if (colorMatch(x, y)) {
              const p = (y * canvas.width + x) * 4;
              data[p + 3] = 0; // Make transparent
              
              if (x > 0) stack.push([x - 1, y]);
              if (x < canvas.width - 1) stack.push([x + 1, y]);
              if (y > 0) stack.push([x, y - 1]);
              if (y < canvas.height - 1) stack.push([x, y + 1]);
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
  console.log('🎉 Processing complete!');
}

removeBackground().catch(err => {
  console.error('❌ Error processing images:', err);
  process.exit(1);
});
