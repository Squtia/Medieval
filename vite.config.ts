import { defineConfig, Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

function developmentStudioPlugin(): Plugin {
  return {
    name: 'development-studio-api',
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';

        const storyFile = path.resolve(__dirname, 'src/data/custom_stories.json');
        const storyBackupsDir = path.resolve(__dirname, 'src/data/story_backups');

        if (url === '/api/get-story-definitions' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(fs.existsSync(storyFile) ? fs.readFileSync(storyFile, 'utf-8') : '[]');
        }

        if (url === '/api/save-story-definitions' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              if (!Array.isArray(payload.stories)) throw new Error('stories 必須是陣列');
              fs.mkdirSync(storyBackupsDir, { recursive: true });
              fs.writeFileSync(storyFile, JSON.stringify(payload.stories, null, 2), 'utf-8');
              const now = new Date();
              const pad = (value: number) => value.toString().padStart(2, '0');
              const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const snapshot = `snapshot_${stamp}.json`;
              fs.writeFileSync(path.resolve(storyBackupsDir, snapshot), JSON.stringify({
                timestamp: now.toISOString(),
                note: payload.note || '使用者在故事工坊儲存',
                stories: payload.stories
              }, null, 2), 'utf-8');
              const backups = fs.readdirSync(storyBackupsDir).filter(file => file.startsWith('snapshot_')).sort().reverse();
              for (const oldFile of backups.slice(20)) fs.unlinkSync(path.resolve(storyBackupsDir, oldFile));
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, snapshot }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (url === '/api/list-story-backups' && req.method === 'GET') {
          const backups = fs.existsSync(storyBackupsDir)
            ? fs.readdirSync(storyBackupsDir).filter(file => file.startsWith('snapshot_')).sort().reverse().map(filename => {
              const fullPath = path.resolve(storyBackupsDir, filename);
              const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
              return { filename, timestamp: data.timestamp, note: data.note, size: fs.statSync(fullPath).size };
            })
            : [];
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ backups }));
        }

        if (url === '/api/restore-story-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { filename } = JSON.parse(body);
              if (typeof filename !== 'string' || path.basename(filename) !== filename || !filename.startsWith('snapshot_')) {
                throw new Error('快照檔名不合法');
              }
              const targetPath = path.resolve(storyBackupsDir, filename);
              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ success: false, error: '找不到該快照' }));
              }
              const snapshot = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
              if (!Array.isArray(snapshot.stories)) throw new Error('快照內容不合法');
              fs.writeFileSync(storyFile, JSON.stringify(snapshot.stories, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, stories: snapshot.stories }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }
        
        // 1. 讀取專案配置與圖集定義
        if (url === '/api/get-icon-config' && req.method === 'GET') {
          const dataDir = path.resolve(__dirname, 'src/data');
          const configFile = path.resolve(dataDir, 'custom_icon_config.json');
          const datasetsFile = path.resolve(dataDir, 'custom_icon_datasets.json');
          
          let configs = {};
          let datasets = null;

          if (fs.existsSync(configFile)) {
            try { configs = JSON.parse(fs.readFileSync(configFile, 'utf-8')); } catch (e) {}
          }
          if (fs.existsSync(datasetsFile)) {
            try { datasets = JSON.parse(fs.readFileSync(datasetsFile, 'utf-8')); } catch (e) {}
          }

          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ configs, datasets }));
        }

        // 2. 寫入專案檔案並自動建立輕量化歷史快照
        if (url === '/api/save-icon-config' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const dataDir = path.resolve(__dirname, 'src/data');
              const backupsDir = path.resolve(dataDir, 'icon_backups');
              const customIconsDir = path.resolve(__dirname, 'public/assets/custom_icons');
              
              if (!fs.existsSync(backupsDir)) {
                fs.mkdirSync(backupsDir, { recursive: true });
              }
              if (!fs.existsSync(customIconsDir)) {
                fs.mkdirSync(customIconsDir, { recursive: true });
              }

              // 檢查 datasets 中的 base64 並抽取寫入實體檔案
              const datasetsToSave = payload.datasets ? JSON.parse(JSON.stringify(payload.datasets)) : null;
              if (datasetsToSave) {
                for (const [key, cat] of Object.entries(datasetsToSave as Record<string, any>)) {
                  if (cat.spriteUrl && cat.spriteUrl.startsWith('data:image')) {
                    const matches = cat.spriteUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
                    if (matches) {
                      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                      const buffer = Buffer.from(matches[2], 'base64');
                      const filename = `${key}.${ext}`;
                      const filePath = path.resolve(customIconsDir, filename);
                      fs.writeFileSync(filePath, buffer);
                      cat.spriteUrl = `../public/assets/custom_icons/${filename}`;
                    }
                  }
                }
              }

              // 寫入主檔案 custom_icon_config.json
              const mainFile = path.resolve(dataDir, 'custom_icon_config.json');
              const contentToSave = payload.configs ? payload.configs : payload;
              fs.writeFileSync(mainFile, JSON.stringify(contentToSave, null, 2), 'utf-8');

              // 寫入自訂圖集定義檔案 custom_icon_datasets.json
              if (datasetsToSave) {
                const datasetsMainFile = path.resolve(dataDir, 'custom_icon_datasets.json');
                fs.writeFileSync(datasetsMainFile, JSON.stringify(datasetsToSave, null, 2), 'utf-8');
              }

              // 建立輕量化歷史快照 (自動保留最近 20 份，完全不含 Base64，單檔 3~25KB)
              const now = new Date();
              const pad = (n: number) => n.toString().padStart(2, '0');
              const dateStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const snapshotFile = `snapshot_${dateStr}.json`;
              const snapshotPath = path.resolve(backupsDir, snapshotFile);

              fs.writeFileSync(snapshotPath, JSON.stringify({
                timestamp: now.toISOString(),
                note: payload.note || '使用者在圖標工坊儲存',
                data: contentToSave,
                datasets: datasetsToSave || null
              }, null, 2), 'utf-8');

              // 清理超過 20 份的舊快照
              const allSnapshots = fs.readdirSync(backupsDir).filter(f => f.startsWith('snapshot_')).sort().reverse();
              if (allSnapshots.length > 20) {
                allSnapshots.slice(20).forEach(oldFile => {
                  try { fs.unlinkSync(path.resolve(backupsDir, oldFile)); } catch (e) {}
                });
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                success: true,
                message: '已成功寫入硬碟專案檔案！',
                snapshot: snapshotFile,
                timestamp: now.toISOString(),
                datasets: datasetsToSave
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 3. 列出所有歷史快照
        if (url === '/api/list-icon-backups' && req.method === 'GET') {
          const backupsDir = path.resolve(__dirname, 'src/data/icon_backups');
          if (!fs.existsSync(backupsDir)) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ backups: [] }));
          }
          const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('snapshot_')).sort().reverse();
          const backups = files.map(file => {
            try {
              const fullPath = path.resolve(backupsDir, file);
              const stat = fs.statSync(fullPath);
              const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
              return {
                filename: file,
                timestamp: content.timestamp || stat.mtime.toISOString(),
                note: content.note || '自動快照',
                size: stat.size
              };
            } catch (e) {
              return { filename: file, timestamp: '', note: '快照檔案' };
            }
          });
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ backups }));
        }

        // 4. 從歷史快照還原
        if (url === '/api/restore-icon-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { filename } = JSON.parse(body);
              const backupsDir = path.resolve(__dirname, 'src/data/icon_backups');
              const targetPath = path.resolve(backupsDir, filename);

              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ success: false, error: '找不到該快照檔案' }));
              }

              const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
              const mainFile = path.resolve(__dirname, 'src/data/custom_icon_config.json');
              const configData = content.data || content;
              fs.writeFileSync(mainFile, JSON.stringify(configData, null, 2), 'utf-8');

              if (content.datasets) {
                const datasetsMainFile = path.resolve(__dirname, 'src/data/custom_icon_datasets.json');
                fs.writeFileSync(datasetsMainFile, JSON.stringify(content.datasets, null, 2), 'utf-8');
              }

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                success: true,
                message: `已成功還原至快照 ${filename}！`,
                data: configData,
                datasets: content.datasets || null
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [developmentStudioPlugin()],
  // 將 base 設定為您的 GitHub Repository 名稱，這樣打包後的檔案路徑才會正確
  base: '/Medieval/'
});
 
