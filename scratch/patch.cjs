const fs = require('fs');
const path = 'i:/gameproject/Medieval/src/ui/ModalController.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Imports
content = content.replace(
    "import { monsterSystem } from '../systems/MonsterSystem';",
    "import { monsterSystem } from '../systems/MonsterSystem';\nimport { FormationDB } from '../systems/FormationDB';\nimport { FormationPreset } from '../models/types';"
);

// 2. State variables
content = content.replace(
    "let selectedTroopsForDispatch: Record<string, number> = {};",
    "let selectedTroopsForDispatch: Record<string, number> = {};\nlet currentFormationId: string = 'DEFAULT';\nlet currentGridMap: Record<string, string> = {};\nlet dragDraggedAdvId: string | null = null;\nlet dragSourceSlot: string | null = null;"
);

// 3. Reset in openDispatchSetup
content = content.replace(
    "selectedTroopsForDispatch = {};\n  // 根據 NodeLevel",
    "selectedTroopsForDispatch = {};\n  currentFormationId = 'DEFAULT';\n  currentGridMap = {};\n  // 根據 NodeLevel"
);

// 4. Confirm Dispatch save formation info
const searchRegex = /pendingDispatchTask\.troopAssignments = \{\};[\s\S]*?\}\s*\}\s*\}\s*GameState\.system\.dispatchAdventurers\(team,\s*pendingDispatchTask\);/;
const replacement = `pendingDispatchTask.troopAssignments = {};
          for (const [id, tObj] of Object.entries(selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && t.count > 0 && selectedAdventurersForDispatch.has(id)) {
              pendingDispatchTask.troopAssignments[id] = { type: t.type, count: t.count };
            }
          }
        }
      }
      
      pendingDispatchTask.formationId = currentFormationId;
      pendingDispatchTask.gridMap = { ...currentGridMap };
      
      GameState.system.dispatchAdventurers(team, pendingDispatchTask);`;
content = content.replace(searchRegex, replacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Patch complete.');
