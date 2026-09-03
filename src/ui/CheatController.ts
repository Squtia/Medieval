import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { ToastManager } from './ToastManager';
import { renderBaseBuildings } from './SceneController';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { createUniqueAdventurer } from '../data/UniqueAdventurers';

export function initCheatController(): void {
  if (!(import.meta as any).env?.DEV) return;

  // 全域控制台後門資源修改器
  (window as any).cheatGold = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的金幣數量！');
    GameState.myTerritory.gold = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 金幣已修改為 ${amount}`);
  };

  (window as any).cheatWood = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的木材數量！');
    GameState.myTerritory.wood = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 木材已修改為 ${amount}`);
  };

  (window as any).cheatStone = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的石材數量！');
    GameState.myTerritory.stone = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 石材已修改為 ${amount}`);
  };

  (window as any).cheatIron = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的鐵礦數量！');
    GameState.myTerritory.iron = amount;
    UIManager.updateUI();
    console.log(`🧙‍♂️ [密技] 鐵礦已修改為 ${amount}`);
  };

  // 鍵盤輸入彩蛋密技 (輸入 gold, wood, rock, iron 觸發)
  let cheatSequence: string[] = [];
  const CHEAT_MAP: { [key: string]: { name: string, noPrompt?: boolean, setter: (val: number) => void } } = {
    'gold': { name: '金幣', setter: (v) => GameState.myTerritory.gold = v },
    'wood': { name: '木材', setter: (v) => GameState.myTerritory.wood = v },
    'rock': { name: '石材', setter: (v) => GameState.myTerritory.stone = v },
    'iron': { name: '鐵礦', setter: (v) => GameState.myTerritory.iron = v },
    'allres': { name: '所有物資(金/木/石/鐵/皮/麻)同時增加', setter: (v) => {
        GameState.myTerritory.gold += v;
        GameState.myTerritory.wood += v;
        GameState.myTerritory.stone += v;
        GameState.myTerritory.iron += v;
        if (!GameState.myTerritory.tradeInventory) GameState.myTerritory.tradeInventory = {};
        GameState.myTerritory.tradeInventory['tg_hide'] = (GameState.myTerritory.tradeInventory['tg_hide'] || 0) + v;
        GameState.myTerritory.tradeInventory['tg_cotton'] = (GameState.myTerritory.tradeInventory['tg_cotton'] || 0) + v;
    }},
    'fame': { name: '聲望', setter: (v) => GameState.myTerritory.prestige += v },
    'army': { name: '軍隊', setter: (v) => { 
        GameState.myTerritory.workers['INFANTRY'] = (GameState.myTerritory.workers['INFANTRY'] || 0) + v;
        GameState.myTerritory.workers['CAVALRY'] = (GameState.myTerritory.workers['CAVALRY'] || 0) + v;
        GameState.myTerritory.workers['ARCHER'] = (GameState.myTerritory.workers['ARCHER'] || 0) + v;
        EventBus.getInstance().publish({
          type: GameEventType.POPULATION_CHANGED,
          payload: { delta: v * 3, currentPopulation: GameState.myTerritory.population, reason: 'CHEAT' }
        });
    }},
    'tavern': { name: '酒館等級 (0~5)', setter: (v) => {
        GameState.myTerritory.tavernLevel = v;
        if (v > 0 && !GameState.myTerritory.unlockedBuildings.includes('bld_tavern')) {
          GameState.myTerritory.unlockedBuildings.push('bld_tavern');
        }
    }}
  };

  Object.assign(CHEAT_MAP, {
    'buildmax': { name: '全建築設施滿等', noPrompt: true, setter: () => {
        const blds = ['bld_tavern', 'bld_weapon', 'bld_armor', 'bld_forge', 'bld_defense'];
        blds.forEach(id => {
          if (!GameState.myTerritory.unlockedBuildings.includes(id)) {
            GameState.myTerritory.unlockedBuildings.push(id);
          }
        });
        GameState.myTerritory.tavernLevel = 5;
        GameState.myTerritory.weaponShopLevel = 5;
        GameState.myTerritory.armorShopLevel = 5;
        GameState.myTerritory.forgeLevel = 5;
        GameState.myTerritory.defenseLevel = 5;
        GameState.myTerritory.farmlandLevel = 5;
        GameState.myTerritory.lumberMillLevel = 5;
        GameState.myTerritory.quarryLevel = 5;
        GameState.myTerritory.huntingGroundLevel = 5;
        ToastManager.show(`🏰 領地內所有建築與生產設施已全部升至 5 等滿級！`, 'success');
    }},
    'lvlmax': { name: '全傭兵滿等', noPrompt: true, setter: () => {
        GameState.adventurers.forEach(adv => {
           if (adv.level < 10) {
               adv.level = 10;
               adv.unspentStatPoints = (adv.unspentStatPoints || 0) + 45;
           }
        });
        ToastManager.show(`✨ 旗下所有傭兵已提升至 10 等滿等！`);
    }},
    'testwpn': { name: '測試轉職武器', noPrompt: true, setter: () => {
        const now = Date.now();
        const testWeapons = [
          { uuid: 'test_wpn_gs_' + now, id: 'test_greatsword', name: '[測試] 滿等巨劍', slot: 'WEAPON', icon: '⚔️', enhancementLevel: 0, weaponType: 'GREATSWORD', allowedJobs: ['戰士'], requirements: { str: 5 }, effects: { str: 5 }, combatEffects: { patk: 15 } },
          { uuid: 'test_wpn_ds_' + now, id: 'test_dualswords', name: '[測試] 滿等雙劍', slot: 'WEAPON', icon: '⚔️', enhancementLevel: 0, weaponType: 'DUAL_SWORDS', allowedJobs: ['戰士'], requirements: { str: 3, int: 3 }, effects: { int: 5 }, combatEffects: { patk: 12, matk: 8, evade: 5 } },
          { uuid: 'test_wpn_ss_' + now, id: 'test_swordshield', name: '[測試] 滿等劍盾', slot: 'WEAPON', icon: '🛡️', enhancementLevel: 0, weaponType: 'SWORD_AND_SHIELD', allowedJobs: ['騎士'], requirements: { con: 5 }, effects: { con: 5 }, combatEffects: { patk: 10, pdef: 10 } },
          { uuid: 'test_wpn_rs_' + now, id: 'test_runeshield', name: '[測試] 滿等符文盾', slot: 'WEAPON', icon: '🛡️', enhancementLevel: 0, weaponType: 'RUNE_SHIELD', allowedJobs: ['騎士'], requirements: { spr: 5 }, effects: { spr: 5 }, combatEffects: { patk: 8, pdef: 12, mdef: 10 } },
          { uuid: 'test_wpn_st_' + now, id: 'test_staff', name: '[測試] 滿等法杖', slot: 'WEAPON', icon: '🪄', enhancementLevel: 0, weaponType: 'STAFF', allowedJobs: ['法師'], requirements: { int: 5 }, effects: { int: 5 }, combatEffects: { matk: 15, hit: 10 } },
          { uuid: 'test_wpn_sc_' + now, id: 'test_scythe', name: '[測試] 滿等戰鐮', slot: 'WEAPON', icon: '🪓', enhancementLevel: 0, weaponType: 'SCYTHE', allowedJobs: ['法師'], requirements: { int: 3, con: 3 }, effects: { con: 3, int: 3 }, combatEffects: { patk: 10, matk: 18 } },
          { uuid: 'test_wpn_bw_' + now, id: 'test_bow', name: '[測試] 滿等戰弓', slot: 'WEAPON', icon: '🏹', enhancementLevel: 0, weaponType: 'BOW', allowedJobs: ['弓箭手'], requirements: { agi: 5 }, effects: { agi: 5 }, combatEffects: { patk: 16, hit: 15 } },
          { uuid: 'test_wpn_mb_' + now, id: 'test_magicbow', name: '[測試] 滿等魔法弓', slot: 'WEAPON', icon: '🏹', enhancementLevel: 0, weaponType: 'MAGIC_BOW', allowedJobs: ['弓箭手'], requirements: { agi: 3, luk: 3 }, effects: { luk: 5 }, combatEffects: { patk: 12, matk: 10, hit: 10 } },
          { uuid: 'test_wpn_dg_' + now, id: 'test_daggers', name: '[測試] 滿等雙匕首', slot: 'WEAPON', icon: '🔪', enhancementLevel: 0, weaponType: 'DAGGERS', allowedJobs: ['盜賊'], requirements: { agi: 5 }, effects: { agi: 5 }, combatEffects: { patk: 14, evade: 8 } },
          { uuid: 'test_wpn_mr_' + now, id: 'test_magicring', name: '[測試] 滿等魔法戒指', slot: 'WEAPON', icon: '💍', enhancementLevel: 0, weaponType: 'MAGIC_RING', allowedJobs: ['盜賊'], requirements: { agi: 3, luk: 3 }, effects: { luk: 5 }, combatEffects: { patk: 10, matk: 12, evade: 12 } },
          { uuid: 'test_wpn_hb_' + now, id: 'test_holybook', name: '[測試] 滿等聖典', slot: 'WEAPON', icon: '📖', enhancementLevel: 0, weaponType: 'HOLY_BOOK', allowedJobs: ['祈禱者'], requirements: { spr: 5 }, effects: { spr: 5 }, combatEffects: { matk: 14, mp: 30 } },
          { uuid: 'test_wpn_hm_' + now, id: 'test_hammer', name: '[測試] 滿等戰鎚', slot: 'WEAPON', icon: '🔨', enhancementLevel: 0, weaponType: 'HAMMER', allowedJobs: ['祈禱者'], requirements: { str: 3, spr: 3 }, effects: { str: 3, spr: 3 }, combatEffects: { patk: 15, pdef: 5, mdef: 5 } }
        ];
        testWeapons.forEach(w => GameState.myTerritory.addEquipmentToWarehouse(w as any));
        ToastManager.show(`✨ 已將全套 12 種測試轉職武器放入倉庫！`);
    }},
    'advanc': { name: '解鎖滿等轉職', noPrompt: true, setter: () => {
        let count = 0;
        GameState.adventurers.forEach(adv => {
           if (adv.level >= 10 && !adv.isAdvanced) {
               adv.isAdvanced = true;
               count++;
           }
        });
        ToastManager.show(`✨ 已為 ${count} 名滿等傭兵解鎖轉職狀態！`);
    }},
    'advmat': { name: '取得所有轉職素材', noPrompt: true, setter: () => {
        if (!GameState.myTerritory.materials) GameState.myTerritory.materials = {};
        GameState.myTerritory.materials['ADVANCE_WARRIOR'] = (GameState.myTerritory.materials['ADVANCE_WARRIOR'] || 0) + 10;
        GameState.myTerritory.materials['ADVANCE_MAGE'] = (GameState.myTerritory.materials['ADVANCE_MAGE'] || 0) + 10;
        GameState.myTerritory.materials['ADVANCE_ARCHER'] = (GameState.myTerritory.materials['ADVANCE_ARCHER'] || 0) + 10;
        GameState.myTerritory.materials['ADVANCE_KNIGHT'] = (GameState.myTerritory.materials['ADVANCE_KNIGHT'] || 0) + 10;
        GameState.myTerritory.materials['ADVANCE_THIEF'] = (GameState.myTerritory.materials['ADVANCE_THIEF'] || 0) + 10;
        GameState.myTerritory.materials['ADVANCE_PRAYER'] = (GameState.myTerritory.materials['ADVANCE_PRAYER'] || 0) + 10;
        ToastManager.show(`✨ 已獲得全套轉職素材 (各 10 個)！`);
    }},
    'studio': { name: '開啟圖標工坊', noPrompt: true, setter: () => {
        window.open('./tools/icon-studio.html', '_blank');
        ToastManager.show(`🎨 已在新分頁開啟「圖標工坊 (Icon Studio)」！`);
    }},
    'story': { name: '開啟故事工坊', noPrompt: true, setter: () => {
        window.open('./tools/story-studio.html', '_blank');
        ToastManager.show(`🧭 已在新分頁開啟「故事工坊」！`);
    }},
    'combat': { name: '開啟戰鬥平衡工坊', noPrompt: true, setter: () => {
        window.open('./tools/combat-studio.html', '_blank');
        ToastManager.show(`⚔️ 已在新分頁開啟「戰術遭遇與戰鬥平衡工坊 (Combat Studio)」！`);
    }},
    'battle': { name: '開啟戰鬥平衡工坊', noPrompt: true, setter: () => {
        window.open('./tools/combat-studio.html', '_blank');
        ToastManager.show(`⚔️ 已在新分頁開啟「戰術遭遇與戰鬥平衡工坊 (Combat Studio)」！`);
    }},
    'equip': { name: '開啟裝備與素材工坊', noPrompt: true, setter: () => {
        window.open('./tools/equipment-studio.html', '_blank');
        ToastManager.show(`🛠️ 已在新分頁開啟「裝備、素材與配方工坊 (Equipment Studio)」！`);
    }},
    'material': { name: '開啟裝備與素材工坊', noPrompt: true, setter: () => {
        window.open('./tools/equipment-studio.html', '_blank');
        ToastManager.show(`🧱 已在新分頁開啟「裝備、素材與配方工坊 (Equipment Studio)」！`);
    }},
    'forge': { name: '開啟裝備與素材工坊', noPrompt: true, setter: () => {
        window.open('./tools/equipment-studio.html', '_blank');
        ToastManager.show(`🔨 已在新分頁開啟「裝備、素材與配方工坊 (Equipment Studio)」！`);
    }},
    'skill': { name: '開啟全自訂積木技能工坊', noPrompt: true, setter: () => {
        window.open('./tools/skill-workshop.html', '_blank');
        ToastManager.show(`⚡ 已在新分頁開啟「全自訂積木技能工坊 (Skill Workshop)」！`);
    }},
    'vfx': { name: '開啟專業 3D 技能特效工坊', noPrompt: true, setter: () => {
        window.open('./tools/vfx-studio.html', '_blank');
        ToastManager.show(`✨ 已在新分頁開啟「專業 3D 技能特效工坊 (VFX Studio)」！`);
    }},
    'fx': { name: '開啟專業 3D 技能特效工坊', noPrompt: true, setter: () => {
        window.open('./tools/vfx-studio.html', '_blank');
        ToastManager.show(`✨ 已在新分頁開啟「專業 3D 技能特效工坊 (VFX Studio)」！`);
    }},
    'vfxstudio': { name: '開啟專業 3D 技能特效工坊', noPrompt: true, setter: () => {
        window.open('./tools/vfx-studio.html', '_blank');
        ToastManager.show(`✨ 已在新分頁開啟「專業 3D 技能特效工坊 (VFX Studio)」！`);
    }},
    'addur': { name: '召喚唯一 UR【赤焰戰神】', noPrompt: true, setter: () => {
        const hero = createUniqueAdventurer('reyn');
        if (hero) {
          GameState.adventurers.push(hero);
          ToastManager.show(`👑 唯一 UR 傭兵【${hero.name}】已加入您的隊伍！`, 'success');
        }
    }},
    'addssr': { name: '召喚唯一 SSR【霜語大魔導】', noPrompt: true, setter: () => {
        const hero = createUniqueAdventurer('luna');
        if (hero) {
          GameState.adventurers.push(hero);
          ToastManager.show(`🌟 唯一 SSR 傭兵【${hero.name}】已加入您的隊伍！`, 'success');
        }
    }},
    'addoath': { name: '召喚唯一 UR【神聖誓約騎士】', noPrompt: true, setter: () => {
        const hero = createUniqueAdventurer('oath');
        if (hero) {
          GameState.adventurers.push(hero);
          ToastManager.show(`🛡️ 唯一 UR 傭兵【${hero.name}】已加入您的隊伍！`, 'success');
        }
    }},
    'layout': { name: '喚醒即時排版與美術編輯器', noPrompt: true, setter: async () => {
        const { LiveLayoutEditor } = await import('../tools/LiveLayoutEditor');
        LiveLayoutEditor.toggle();
    }},
    'edit': { name: '喚醒即時排版與美術編輯器', noPrompt: true, setter: async () => {
        const { LiveLayoutEditor } = await import('../tools/LiveLayoutEditor');
        LiveLayoutEditor.toggle();
    }},
    'theme': { name: '開啟全域視覺主題工坊', noPrompt: true, setter: async () => {
        const { UIThemeStudio } = await import('../tools/UIThemeStudio');
        UIThemeStudio.open();
        ToastManager.show('🎨 已開啟「全域視覺主題工坊 (UI & Asset Studio)」！', 'success');
    }}
  });

  (window as any).openIconStudio = () => {
    window.open('./tools/icon-studio.html', '_blank');
  };

  (window as any).openSkillWorkshop = () => {
    window.open('./tools/skill-workshop.html', '_blank');
  };

  (window as any).openLiveLayoutEditor = async () => {
    const { LiveLayoutEditor } = await import('../tools/LiveLayoutEditor');
    LiveLayoutEditor.open();
  };

  (window as any).toggleLiveLayoutEditor = async () => {
    const { LiveLayoutEditor } = await import('../tools/LiveLayoutEditor');
    LiveLayoutEditor.toggle();
  };

  (window as any).openThemeStudio = async () => {
    const { UIThemeStudio } = await import('../tools/UIThemeStudio');
    UIThemeStudio.open();
  };

  (window as any).openStoryStudio = () => {
    window.open('./tools/story-studio.html', '_blank');
  };

  (window as any).openCombatStudio = () => {
    window.open('./tools/combat-studio.html', '_blank');
  };

  (window as any).openEquipmentStudio = () => {
    window.open('./tools/equipment-studio.html', '_blank');
  };

  (window as any).openVfxStudio = () => {
    window.open('./tools/vfx-studio.html', '_blank');
  };

  (window as any).cheatVfx = () => {
    window.open('./tools/vfx-studio.html', '_blank');
  };

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const key = e.key.toLowerCase();
    // 僅快取 26 個英文字母，最大長度限制為 10
    if (/^[a-z]$/.test(key)) {
      cheatSequence.push(key);
      if (cheatSequence.length > 10) {
        cheatSequence.shift();
      }
      
      const currentStr = cheatSequence.join('');
      for (const code in CHEAT_MAP) {
        if (currentStr.endsWith(code)) {
          cheatSequence = []; // 觸發後清空
          const target = CHEAT_MAP[code];
          
          if (target.noPrompt) {
            target.setter(0);
            UIManager.updateUI();
            console.log(`🧙‍♂️ [密技] 領主觸發了無參數密技【${target.name}】。`);
            break;
          }

          const input = prompt(`🧙‍♂️ 偵測到領主祕密指令【${code}】。\n請輸入想要修改或設定的【${target.name}】數值：`);
          if (input !== null) {
            const val = parseInt(input.trim(), 10);
            if (!isNaN(val)) {
              target.setter(val);
              UIManager.updateUI();
              
              // 如果此時玩家在自宅內部升級面板，則重新渲染升級按鈕狀態
              const basePanel = document.getElementById('panel-enter-base');
              if (basePanel && basePanel.style.display !== 'none') {
                renderBaseBuildings();
              }
              
              ToastManager.show(`✨ 領地【${target.name}】已變更為 ${val}！`);
              console.log(`🧙‍♂️ [密技] 領主手動將【${target.name}】修改為 ${val}。`);
            } else {
              ToastManager.show('⚠️ 請輸入正確的整數！');
            }
          }
          break;
        }
      }
    }
  });
}
