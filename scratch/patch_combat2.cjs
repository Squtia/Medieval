const fs = require('fs');
const path = 'i:/gameproject/Medieval/src/systems/CombatSystem.ts';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// Imports
content = content.replace(
    "import { SKILLS, TargetType } from '../models/Skill';",
    "import { SKILLS, TargetType } from '../models/Skill';\nimport { FormationDB } from '../systems/FormationDB';"
);

content = content.replace(
    "enemyLineup?: import('../models/types').MonsterInstance[]\n  ): CombatReport {",
    "enemyLineup?: import('../models/types').MonsterInstance[],\n    formationId?: string,\n    gridMap?: Record<string, string>\n  ): CombatReport {"
);

const initTeamRegex = /\/\/ 1\. 初始化我方 \(僅初始化一次，狀態延續\)\n\s*attackerIds\.forEach\(\(id: string\) => \{/;
const initTeamReplace = `    const formationActive = formationId && gridMap ? FormationDB.isFormationActive(gridMap, formationId) : false;
    const formationConfig = formationId ? FormationDB.getFormation(formationId) : FormationDB.getFormation('DEFAULT');

    // 1. 初始化我方 (僅初始化一次，狀態延續)
    attackerIds.forEach((id: string) => {`;
content = content.replace(initTeamRegex, initTeamReplace);

const pushPlayerRegex = /playerTeam\.push\(\{\n\s*id: adv\.id,\n\s*name: adv\.name,\n\s*isPlayer: true,\n\s*row: adv\.formationRow \|\| FormationRow\.FRONT,/;
const pushPlayerReplace = `
        // Grid setup
        let gridRow: any = FormationRow.FRONT; // Fallback
        let r_c = '';
        if (gridMap && Object.keys(gridMap).length > 0) {
          for (const [key, val] of Object.entries(gridMap)) {
            if (val === id) {
              r_c = key;
              const r = parseInt(key.split('_')[0], 10);
              gridRow = r === 0 ? FormationRow.FRONT : (r === 1 ? 'MIDDLE' : FormationRow.BACK);
              break;
            }
          }
        } else {
           gridRow = adv.formationRow || FormationRow.FRONT;
        }

        // Apply formation buffs if active
        if (formationActive && r_c) {
          const r = parseInt(r_c.split('_')[0], 10);
          const c = parseInt(r_c.split('_')[1], 10);
          
          formationConfig.buffRules.forEach(rule => {
            let applies = false;
            if (rule.target === 'ALL') applies = true;
            else if (rule.target === 'FRONT_ROW' && r === 0) applies = true;
            else if (rule.target === 'MIDDLE_ROW' && r === 1) applies = true;
            else if (rule.target === 'BACK_ROW' && r === 2) applies = true;
            else if (rule.target === 'REQUIRED_SLOTS') {
               applies = formationConfig.requiredSlots.some(s => s.row === r && s.col === c);
            }
            
            if (applies) {
               if (rule.stats.atk) stats.atk = Math.floor(stats.atk * rule.stats.atk);
               if (rule.stats.def) stats.def = Math.floor(stats.def * rule.stats.def);
               if (rule.stats.evade) stats.evade = Math.floor(stats.evade * rule.stats.evade);
               if (rule.stats.hit) stats.hit = Math.floor(stats.hit * rule.stats.hit);
            }
          });
        }

        playerTeam.push({
          id: adv.id,
          name: adv.name,
          isPlayer: true,
          row: gridRow,`;
content = content.replace(pushPlayerRegex, pushPlayerReplace);

const targetRegex = /private static getValidTarget\(enemies: CombatParticipant\[\], preferRow\?: 'FRONT' \| 'BACK'\): CombatParticipant \| null \{[\s\S]*?return Random\.pick\(aliveEnemies\);\n  \}/;
const targetReplace = `private static getValidTarget(enemies: CombatParticipant[], preferRow?: 'FRONT' | 'BACK' | 'MIDDLE' | string): CombatParticipant | null {
    const aliveEnemies = enemies.filter(e => e.currentHp > 0);
    if (aliveEnemies.length === 0) return null;

    if (preferRow === 'FRONT') {
      const frontEnemies = aliveEnemies.filter(e => e.row === FormationRow.FRONT || e.row === 0);
      if (frontEnemies.length > 0) return Random.pick(frontEnemies);
      const middleEnemies = aliveEnemies.filter(e => e.row === 'MIDDLE' || e.row === 1);
      if (middleEnemies.length > 0) return Random.pick(middleEnemies);
      return Random.pick(aliveEnemies);
    } else if (preferRow === 'BACK') {
      const backEnemies = aliveEnemies.filter(e => e.row === FormationRow.BACK || e.row === 2);
      if (backEnemies.length > 0) return Random.pick(backEnemies);
      return Random.pick(aliveEnemies);
    }
    
    // Default to FRONT -> MIDDLE -> BACK for melee
    const row0 = aliveEnemies.filter(e => e.row === FormationRow.FRONT || e.row === 0);
    if (row0.length > 0) return Random.pick(row0);
    const row1 = aliveEnemies.filter(e => e.row === 'MIDDLE' || e.row === 1);
    if (row1.length > 0) return Random.pick(row1);
    return Random.pick(aliveEnemies);
  }`;
content = content.replace(targetRegex, targetReplace);

fs.writeFileSync(path, content, 'utf8');
console.log('Patch 2 complete with CRLF fix.');
