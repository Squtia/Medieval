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
              const backups = fs.readdirSync(storyBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse();
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
            ? fs.readdirSync(storyBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse().map((filename: string) => {
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
              const allSnapshots = fs.readdirSync(backupsDir).filter((f: string) => f.startsWith('snapshot_')).sort().reverse();
              if (allSnapshots.length > 20) {
                allSnapshots.slice(20).forEach((oldFile: string) => {
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
          const files = fs.readdirSync(backupsDir).filter((f: string) => f.startsWith('snapshot_')).sort().reverse();
          const backups = files.map((file: string) => {
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

        // ==========================================
        // 怪物與單位資料庫 (Monster & Unit Definitions API)
        // ==========================================
        const monsterFile = path.resolve(__dirname, 'src/data/monsters.json');
        const monsterBackupsDir = path.resolve(__dirname, 'src/data/monster_backups');

        if (url === '/api/get-monster-definitions' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(fs.existsSync(monsterFile) ? fs.readFileSync(monsterFile, 'utf-8') : '[]');
        }

        if (url === '/api/save-monster-definitions' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const monsterList = Array.isArray(payload) ? payload : payload.monsters;
              if (!Array.isArray(monsterList)) throw new Error('monsters 必須是陣列');

              fs.mkdirSync(monsterBackupsDir, { recursive: true });
              fs.writeFileSync(monsterFile, JSON.stringify(monsterList, null, 2), 'utf-8');

              const now = new Date();
              const pad = (value: number) => value.toString().padStart(2, '0');
              const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const snapshot = `snapshot_${stamp}.json`;

              fs.writeFileSync(path.resolve(monsterBackupsDir, snapshot), JSON.stringify({
                timestamp: now.toISOString(),
                note: payload.note || '使用者在戰術平衡工坊儲存怪物資料庫',
                monsters: monsterList
              }, null, 2), 'utf-8');

              const backups = fs.readdirSync(monsterBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse();
              for (const oldFile of backups.slice(20)) fs.unlinkSync(path.resolve(monsterBackupsDir, oldFile));

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, snapshot, total: monsterList.length }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        if (url === '/api/list-monster-backups' && req.method === 'GET') {
          const backups = fs.existsSync(monsterBackupsDir)
            ? fs.readdirSync(monsterBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse().map((filename: string) => {
              const fullPath = path.resolve(monsterBackupsDir, filename);
              const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
              return { filename, timestamp: data.timestamp, note: data.note, size: fs.statSync(fullPath).size };
            })
            : [];
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ backups }));
        }

        if (url === '/api/restore-monster-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { filename } = JSON.parse(body);
              if (typeof filename !== 'string' || path.basename(filename) !== filename || !filename.startsWith('snapshot_')) {
                throw new Error('快照檔名不合法');
              }
              const targetPath = path.resolve(monsterBackupsDir, filename);
              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ success: false, error: '找不到該快照' }));
              }
              const snapshot = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
              if (!Array.isArray(snapshot.monsters)) throw new Error('快照內容不合法');
              fs.writeFileSync(monsterFile, JSON.stringify(snapshot.monsters, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true, monsters: snapshot.monsters }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // ==========================================
        // 裝備、素材、道具與鍛造配方 API (Equipment & Material Studio API)
        // ==========================================
        const materialsFile = path.resolve(__dirname, 'src/data/materials.json');
        const itemsFile = path.resolve(__dirname, 'src/data/items.json');
        const equipmentFile = path.resolve(__dirname, 'src/data/EquipmentTemplates.json');
        const weaponsFile = path.resolve(__dirname, 'src/data/equipment_weapons.json');
        const armorsFile = path.resolve(__dirname, 'src/data/equipment_armors.json');
        const accessoriesFile = path.resolve(__dirname, 'src/data/equipment_accessories.json');
        const recipesFile = path.resolve(__dirname, 'src/data/CraftingRecipes.json');
        const eqStudioBackupsDir = path.resolve(__dirname, 'src/data/equipment_studio_backups');

        const readEquipmentData = () => {
          let weapons: any[] = [];
          let armors: any[] = [];
          let accessories: any[] = [];
          if (fs.existsSync(weaponsFile)) {
            try { weapons = JSON.parse(fs.readFileSync(weaponsFile, 'utf-8')); } catch (e) {}
          }
          if (fs.existsSync(armorsFile)) {
            try { armors = JSON.parse(fs.readFileSync(armorsFile, 'utf-8')); } catch (e) {}
          }
          if (fs.existsSync(accessoriesFile)) {
            try { accessories = JSON.parse(fs.readFileSync(accessoriesFile, 'utf-8')); } catch (e) {}
          }
          if (weapons.length === 0 && armors.length === 0 && fs.existsSync(equipmentFile)) {
            try {
              const legacy = JSON.parse(fs.readFileSync(equipmentFile, 'utf-8'));
              weapons = legacy.weapons || [];
              armors = legacy.armors || [];
              accessories = legacy.accessories || [];
            } catch (e) {}
          }
          return { weapons, armors, accessories };
        };

        const saveEquipmentData = (rawEquip: any) => {
          let weapons: any[] = [];
          let armors: any[] = [];
          let accessories: any[] = [];
          if (Array.isArray(rawEquip)) {
            rawEquip.forEach((item: any) => {
              if (item.slot === 'ARMOR') {
                armors.push(item);
              } else if (item.slot === 'ACCESSORY') {
                accessories.push(item);
              } else {
                weapons.push(item);
              }
            });
          } else if (rawEquip && typeof rawEquip === 'object') {
            weapons = rawEquip.weapons || [];
            armors = rawEquip.armors || [];
            accessories = rawEquip.accessories || [];
          }
          fs.writeFileSync(weaponsFile, JSON.stringify(weapons, null, 2), 'utf-8');
          fs.writeFileSync(armorsFile, JSON.stringify(armors, null, 2), 'utf-8');
          fs.writeFileSync(accessoriesFile, JSON.stringify(accessories, null, 2), 'utf-8');
          fs.writeFileSync(equipmentFile, JSON.stringify({ weapons, armors, accessories }, null, 2), 'utf-8');
        };

        if (url === '/api/get-equipment-studio-data' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            materials: fs.existsSync(materialsFile) ? JSON.parse(fs.readFileSync(materialsFile, 'utf-8')) : [],
            items: fs.existsSync(itemsFile) ? JSON.parse(fs.readFileSync(itemsFile, 'utf-8')) : [],
            equipment: readEquipmentData(),
            recipes: fs.existsSync(recipesFile) ? JSON.parse(fs.readFileSync(recipesFile, 'utf-8')) : []
          }));
        }

        if (url === '/api/save-equipment-studio-data' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              fs.mkdirSync(eqStudioBackupsDir, { recursive: true });

              if (Array.isArray(payload.materials)) {
                fs.writeFileSync(materialsFile, JSON.stringify(payload.materials, null, 2), 'utf-8');
              }
              if (Array.isArray(payload.items)) {
                fs.writeFileSync(itemsFile, JSON.stringify(payload.items, null, 2), 'utf-8');
              }
              if (payload.equipment) {
                saveEquipmentData(payload.equipment);
              }
              if (Array.isArray(payload.recipes)) {
                fs.writeFileSync(recipesFile, JSON.stringify(payload.recipes, null, 2), 'utf-8');
              }

              const now = new Date();
              const pad = (value: number) => value.toString().padStart(2, '0');
              const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const snapshot = `snapshot_${stamp}.json`;

              fs.writeFileSync(path.resolve(eqStudioBackupsDir, snapshot), JSON.stringify({
                timestamp: now.toISOString(),
                note: payload.note || '使用者在裝備與素材工坊儲存',
                materials: payload.materials,
                items: payload.items,
                equipment: payload.equipment,
                recipes: payload.recipes
              }, null, 2), 'utf-8');

              const backups = fs.readdirSync(eqStudioBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse();
              for (const oldFile of backups.slice(20)) fs.unlinkSync(path.resolve(eqStudioBackupsDir, oldFile));

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

        if (url === '/api/list-equipment-studio-backups' && req.method === 'GET') {
          const backups = fs.existsSync(eqStudioBackupsDir)
            ? fs.readdirSync(eqStudioBackupsDir).filter((file: string) => file.startsWith('snapshot_')).sort().reverse().map((filename: string) => {
              const fullPath = path.resolve(eqStudioBackupsDir, filename);
              const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
              return { filename, timestamp: data.timestamp, note: data.note, size: fs.statSync(fullPath).size };
            })
            : [];
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ backups }));
        }

        if (url === '/api/restore-equipment-studio-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            try {
              const { filename } = JSON.parse(body);
              if (typeof filename !== 'string' || path.basename(filename) !== filename || !filename.startsWith('snapshot_')) {
                throw new Error('快照檔名不合法');
              }
              const targetPath = path.resolve(eqStudioBackupsDir, filename);
              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ success: false, error: '找不到該快照' }));
              }
              const snapshot = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
              if (Array.isArray(snapshot.materials)) fs.writeFileSync(materialsFile, JSON.stringify(snapshot.materials, null, 2), 'utf-8');
              if (Array.isArray(snapshot.items)) fs.writeFileSync(itemsFile, JSON.stringify(snapshot.items, null, 2), 'utf-8');
              if (snapshot.equipment) saveEquipmentData(snapshot.equipment);
              if (Array.isArray(snapshot.recipes)) fs.writeFileSync(recipesFile, JSON.stringify(snapshot.recipes, null, 2), 'utf-8');

              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                success: true,
                materials: snapshot.materials,
                items: snapshot.items,
                equipment: snapshot.equipment,
                recipes: snapshot.recipes
              }));
            } catch (err: any) {
              res.statusCode = 400;
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
 
