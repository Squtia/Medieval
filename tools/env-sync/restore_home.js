import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyFolder(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyFolder(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

const userProfile = process.env.USERPROFILE || 'C:/Users/Allen.Ko';
const projectRoot = path.resolve(__dirname, '../..');

// 1. 還原 MCP 到當前電腦的 Antigravity IDE 目錄
const srcMcp = path.resolve(__dirname, 'mcp-configs');
const targetMcp = path.join(userProfile, '.gemini/antigravity-ide/mcp');

if (fs.existsSync(srcMcp)) {
  copyFolder(srcMcp, targetMcp);
  console.log(`[OK] MCP 伺服器已還原至: ${targetMcp}`);
}

// 2. 還原全域 web_token 技能 (若全域不存在，則從專案中複製過去)
const srcSkill = path.join(projectRoot, '.agents/skills/web_token');
const targetSkill = path.join(userProfile, '.gemini/config/skills/web_token');

if (fs.existsSync(srcSkill)) {
  copyFolder(srcSkill, targetSkill);
  console.log(`[OK] 全域 web_token 技能已同步至: ${targetSkill}`);
}

console.log('=====================================================');
console.log('🎉 家用開發環境還原成功！');
console.log('請在專案根目錄執行 npm install 即可開始開發。');
console.log('=====================================================');
