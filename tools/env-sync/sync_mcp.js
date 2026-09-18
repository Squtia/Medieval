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
const mcpBase = path.join(userProfile, '.gemini/antigravity-ide/mcp');
const projectDst = path.resolve(__dirname, 'mcp-configs');

['codebase-memory', 'gemini-web-bridge', 'headroom'].forEach(mcp => {
  const src = path.join(mcpBase, mcp);
  const dst = path.join(projectDst, mcp);
  copyFolder(src, dst);
  console.log(`Copied ${mcp} -> ${dst}`);
});

console.log('ALL_MCP_COPIED_SUCCESS');
