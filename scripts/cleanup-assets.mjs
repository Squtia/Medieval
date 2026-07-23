import fs from 'fs';
import path from 'path';

// 定義要掃描的原始碼目錄
const scanDirs = [
  path.resolve('src'),
  path.resolve('public/assets'),
  path.resolve('index.html')
];

const publicDir = path.resolve('public');
const assetsDir = path.resolve('public/assets');

// 收集所有在程式碼中被參照的字串 (粗略匹配檔名)
const referencedStrings = new Set();

function scanFile(filePath) {
  const ext = path.extname(filePath);
  if (['.ts', '.js', '.html', '.css', '.json'].includes(ext)) {
    const content = fs.readFileSync(filePath, 'utf8');
    // 找出所有可能是檔名的字串 (例如 node_castle.png, bg-map.webp)
    const regex = /[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|webp|gif|svg)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      referencedStrings.add(match[0]);
    }
  }
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    scanFile(dir);
    return;
  }
  const files = fs.readdirSync(dir);
  for (const file of files) {
    scanDirectory(path.join(dir, file));
  }
}

// 1. 掃描專案程式碼
scanDirs.forEach(scanDirectory);
console.log('✅ 已掃描專案原始碼，找出參照的圖檔...');

// 2. 找出 public 和 public/assets 中的所有圖檔
const allImages = [];
function collectImages(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      collectImages(filePath);
    } else {
      const ext = path.extname(file);
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
        allImages.push({ name: file, path: filePath });
      }
    }
  }
}
collectImages(publicDir);

// 3. 交叉比對並列出/刪除未使用的圖檔
let deletedCount = 0;
let bytesSaved = 0;
console.log('\n🗑️ 開始清理未使用的圖檔：');

for (const img of allImages) {
  // 如果圖檔名稱沒有在程式碼中被提及，就視為未使用
  if (!referencedStrings.has(img.name)) {
    const stat = fs.statSync(img.path);
    bytesSaved += stat.size;
    fs.unlinkSync(img.path);
    console.log(`- 刪除: ${path.relative(process.cwd(), img.path)}`);
    deletedCount++;
  }
}

if (deletedCount === 0) {
  console.log('✨ 專案很乾淨，沒有發現未使用的圖檔！');
} else {
  console.log(`\n🎉 清理完畢！共刪除 ${deletedCount} 個檔案，釋放了 ${(bytesSaved / 1024 / 1024).toFixed(2)} MB 的空間。`);
}
