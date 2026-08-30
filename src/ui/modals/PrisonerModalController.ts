import { GameState } from '../../core/GameState';
import { ToastManager } from '../ToastManager';
import { Adventurer } from '../../models/Adventurer';
import { DataStore } from '../../systems/DataStore';
import { FactionChampion } from '../../models/types';
import { findHeroDef, createUniqueAdventurer, UniqueHeroDef } from '../../data/UniqueAdventurers';
import { renderUniversalIcon } from '../IconSpriteHelper';
import { monsterSystem } from '../../systems/MonsterSystem';
import { UIManager } from '../UIManager';

export class PrisonerModalController {
  private static instance: PrisonerModalController;
  private constructor() {}
  public static getInstance(): PrisonerModalController {
    if (!PrisonerModalController.instance) {
      PrisonerModalController.instance = new PrisonerModalController();
    }
    return PrisonerModalController.instance;
  }

  public init() {
    const btnDock = document.getElementById('btn-dock-dungeon');
    if (btnDock) {
      btnDock.addEventListener('click', () => {
        this.openDungeonList();
      });
    }

    const btnClose = document.getElementById('btn-close-dungeon-list');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        const modal = document.getElementById('dungeon-panel');
        if (modal) modal.classList.remove('active');
      });
    }
  }

  public openDungeonList() {
    const modal = document.getElementById('dungeon-panel');
    const container = document.getElementById('dungeon-list-container');
    if (!modal || !container) return;

    container.innerHTML = '';
    let hasPrisoners = false;

    // 1. 讀取領地地牢收押的傳奇英雄 (UniqueHeroDef)
    const territoryPrisonerIds = GameState.myTerritory?.dungeonPrisonerHeroIds || [];
    const validHeroIds: string[] = [];

    for (const hid of territoryPrisonerIds) {
      const heroDef = findHeroDef(hid);
      if (!heroDef) continue;

      // 若英雄已在隊伍中，自動移出地牢
      if (GameState.adventurers.some(a => a.id === heroDef.id || a.name.includes(heroDef.name))) {
        continue;
      }
      validHeroIds.push(hid);
      hasPrisoners = true;

      const card = document.createElement('div');
      card.style.background = 'rgba(0,0,0,0.4)';
      card.style.border = '1px solid rgba(239, 68, 68, 0.4)';
      card.style.padding = '12px';
      card.style.borderRadius = '6px';
      card.style.display = 'flex';
      card.style.gap = '15px';
      card.style.alignItems = 'center';

      const effectiveIcon = heroDef.avatarIcon || (heroDef.boundMonsterId ? monsterSystem.getMonsterById(heroDef.boundMonsterId)?.avatarIcon : '') || 'heroes_male:heroes_male_13?flip';
      const avatarHtml = renderUniversalIcon(effectiveIcon, 44);

      card.innerHTML = `
        <div style="flex-shrink: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">${avatarHtml}</div>
        <div style="flex: 1;">
          <div style="font-size: 1.1em; font-weight: bold; color: #fbbf24;">${heroDef.title || ''}${heroDef.name} <span style="font-size: 0.8em; color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; padding: 1px 4px;">${heroDef.quality}</span></div>
          <div style="font-size: 0.8em; color: #94a3b8;">Lv.${heroDef.level || 1} 【傳奇名將】 戰力係數: ${heroDef.quality}</div>
        </div>
        <button class="action-btn" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; font-size: 0.9em; cursor: pointer;">⛓️ 提審</button>
      `;

      const btn = card.querySelector('button');
      if (btn) {
        btn.addEventListener('click', () => {
          modal.classList.remove('active');
          this.openHeroPrisonerModal(heroDef);
        });
      }

      container.appendChild(card);
    }
    if (GameState.myTerritory) {
      GameState.myTerritory.dungeonPrisonerHeroIds = validHeroIds;
    }

    // 2. 讀取陣營派系的被俘武將 (FactionChampion)
    const factions = GameState.mapSystem?.getFactions() || [];
    for (const faction of factions) {
      if (faction.capturedChampionIds && faction.capturedChampionIds.length > 0) {
        for (const cid of faction.capturedChampionIds) {
          const champion = faction.champions?.find(c => c.id === cid);
          if (champion) {
            hasPrisoners = true;
            const card = document.createElement('div');
            card.style.background = 'rgba(0,0,0,0.4)';
            card.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            card.style.padding = '12px';
            card.style.borderRadius = '6px';
            card.style.display = 'flex';
            card.style.gap = '15px';
            card.style.alignItems = 'center';

            card.innerHTML = `
              <div style="font-size: 2.5em;">${champion.portraitEmoji || '👑'}</div>
              <div style="flex: 1;">
                <div style="font-size: 1.1em; font-weight: bold; color: #fbbf24;">${champion.name}</div>
                <div style="font-size: 0.8em; color: #94a3b8;">【${champion.title}】 ${faction.factionName}</div>
              </div>
              <button class="action-btn" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; font-size: 0.9em; cursor: pointer;">⛓️ 提審</button>
            `;

            const btn = card.querySelector('button');
            if (btn) {
              btn.addEventListener('click', () => {
                modal.classList.remove('active');
                this.openPrisonerModal(champion, faction);
              });
            }

            container.appendChild(card);
          }
        }
      }
    }

    if (!hasPrisoners) {
      container.innerHTML = '<div style="text-align: center; color: #64748b; padding: 20px;">地牢目前是空的。</div>';
    }

    modal.classList.add('active');
  }

  /**
   * 提審傳奇名將 (UniqueHeroDef) 彈窗
   */
  public openHeroPrisonerModal(heroDef: UniqueHeroDef) {
    const modal = document.getElementById('modal-prisoner-action');
    if (!modal) return;

    const avatar = document.getElementById('prisoner-avatar');
    const nameEl = document.getElementById('prisoner-name');
    const titleEl = document.getElementById('prisoner-title');
    const descEl = document.getElementById('prisoner-desc');

    if (avatar) {
      const effectiveIcon = heroDef.avatarIcon || (heroDef.boundMonsterId ? monsterSystem.getMonsterById(heroDef.boundMonsterId)?.avatarIcon : '') || 'heroes_male:heroes_male_13?flip';
      avatar.innerHTML = renderUniversalIcon(effectiveIcon, 64);
    }
    if (nameEl) nameEl.textContent = `${heroDef.title || ''}${heroDef.name}`;
    if (titleEl) {
      titleEl.textContent = `【傳奇名將】品質：${heroDef.quality} (Lv.${heroDef.level || 1})`;
    }
    if (descEl) descEl.textContent = heroDef.biography || '威震一方的傳奇名將。';

    modal.classList.add('active');

    const btnRecruit = document.getElementById('btn-prisoner-recruit');
    const btnRansom = document.getElementById('btn-prisoner-ransom');
    const btnExecute = document.getElementById('btn-prisoner-execute');
    const btnRelease = document.getElementById('btn-prisoner-release');

    const cloneAndReplace = (btn: HTMLElement | null) => {
      if (!btn) return null;
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      return newBtn;
    };

    const newBtnRecruit = cloneAndReplace(btnRecruit);
    const newBtnRansom = cloneAndReplace(btnRansom);
    const newBtnExecute = cloneAndReplace(btnExecute);
    const newBtnRelease = cloneAndReplace(btnRelease);

    const recruitCost = heroDef.quality === 'UR' ? 2500 : (heroDef.quality === 'SSR' ? 1500 : 1000);
    const ransomGold = heroDef.quality === 'UR' ? 1000 : (heroDef.quality === 'SSR' ? 600 : 400);

    if (newBtnRecruit) {
      newBtnRecruit.innerHTML = `🤝 招降加入<br><span style="font-size: 0.8em; color: #fbbf24;">(${recruitCost} 金幣)</span>`;
    }
    if (newBtnRansom) {
      newBtnRansom.innerHTML = `📦 沒收私產流放<br><span style="font-size: 0.8em; color: #fbbf24;">(+${ransomGold} 金幣)</span>`;
    }
    if (newBtnRelease) {
      newBtnRelease.innerHTML = `🔓 仁慈釋放流亡<br><span style="font-size: 0.8em; color: #86efac;">(化身在野傳奇)</span>`;
    }

    const removeHeroFromDungeon = () => {
      if (GameState.myTerritory && GameState.myTerritory.dungeonPrisonerHeroIds) {
        GameState.myTerritory.dungeonPrisonerHeroIds = GameState.myTerritory.dungeonPrisonerHeroIds.filter(id => id !== heroDef.id);
      }
    };

    if (newBtnRecruit) {
      newBtnRecruit.onclick = () => {
        if (GameState.myTerritory.gold < recruitCost) {
          ToastManager.show(`❌ 黃金不足！需要 ${recruitCost} 金幣。`, 'error');
          return;
        }
        GameState.myTerritory.gold -= recruitCost;
        modal.classList.remove('active');
        removeHeroFromDungeon();

        const newAdv = createUniqueAdventurer(heroDef.id);
        if (newAdv) {
          GameState.adventurers.push(newAdv);
          ToastManager.show(`🤝 成功招降傳奇名將【${heroDef.title || ''}${heroDef.name}】！他已正式加入您的傭兵隊伍。`, 'success');
        }
        UIManager.updateUI();
      };
    }

    if (newBtnRansom) {
      newBtnRansom.onclick = () => {
        modal.classList.remove('active');
        removeHeroFromDungeon();
        GameState.myTerritory.addGold(ransomGold);
        ToastManager.show(`📦 沒收了【${heroDef.name}】私產 ${ransomGold} 金幣，並將其驅逐出境流放荒野。`, 'info');
        UIManager.updateUI();
      };
    }

    if (newBtnExecute) {
      newBtnExecute.onclick = () => {
        modal.classList.remove('active');
        removeHeroFromDungeon();
        ToastManager.show(`⚰️ 處決了名將【${heroDef.name}】！一代豪傑就此殞命。`, 'error');
        UIManager.updateUI();
      };
    }

    if (newBtnRelease) {
      newBtnRelease.onclick = () => {
        modal.classList.remove('active');
        removeHeroFromDungeon();
        ToastManager.show(`🔓 仁慈釋放了名將【${heroDef.name}】！他感念領主大度，隱姓埋名浪跡天涯。`, 'info');
        UIManager.updateUI();
      };
    }
  }

  // 將 AI 派系武將轉換為玩家傭兵
  public convertChampionToAdventurer(champion: FactionChampion): Adventurer {
    const job = DataStore.JobDB[champion.jobId] || DataStore.JobDB['WARRIOR'];
    const trait = DataStore.TraitDB[champion.traitId] || DataStore.TraitDB['GUARDIAN'];

    const qualityMap: Record<string, 'R' | 'SR' | 'SSR'> = {
      'ELITE': 'R',
      'CHAMPION': 'SR',
      'LEGENDARY': 'SSR'
    };

    const newAdv = new Adventurer(
      `adv_${champion.id}_${Date.now()}`,
      champion.name,
      job,
      trait,
      qualityMap[champion.rarity] || 'SR'
    );

    const targetLevel = Math.max(1, champion.powerTier * 2);
    for (let i = 1; i < targetLevel; i++) {
      newAdv.gainXP(newAdv.getRequiredXP());
    }

    return newAdv;
  }

  public openPrisonerModal(champion: FactionChampion, factionObj: any = null) {
    const modal = document.getElementById('modal-prisoner-action');
    if (!modal) return;

    const faction = factionObj || GameState.mapSystem?.getFactions().find(f => f.id === champion.factionId);
    const factionName = faction ? faction.factionName : '未知派系';
    const controlledCount = faction?.controlledNodes ? faction.controlledNodes.length : 0;
    const isFallenFaction = Boolean(faction && controlledCount === 0);

    const avatar = document.getElementById('prisoner-avatar');
    const nameEl = document.getElementById('prisoner-name');
    const titleEl = document.getElementById('prisoner-title');
    const descEl = document.getElementById('prisoner-desc');

    if (avatar) avatar.textContent = champion.portraitEmoji || '👑';
    if (nameEl) nameEl.textContent = champion.name;
    if (titleEl) {
      titleEl.textContent = isFallenFaction 
        ? `【${champion.title}】 ${factionName} (亡國之將)`
        : `【${champion.title}】 ${factionName}`;
    }
    if (descEl) descEl.textContent = champion.description;

    modal.classList.add('active');

    const btnRecruit = document.getElementById('btn-prisoner-recruit');
    const btnRansom = document.getElementById('btn-prisoner-ransom');
    const btnExecute = document.getElementById('btn-prisoner-execute');
    const btnRelease = document.getElementById('btn-prisoner-release');

    // 清除舊事件
    const cloneAndReplace = (btn: HTMLElement | null) => {
      if (!btn) return null;
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      return newBtn;
    };

    const newBtnRecruit = cloneAndReplace(btnRecruit);
    const newBtnRansom = cloneAndReplace(btnRansom);
    const newBtnExecute = cloneAndReplace(btnExecute);
    const newBtnRelease = cloneAndReplace(btnRelease);
    
    // 招募需要錢：若母國已滅亡，亡國將領願以降價半價加盟
    const baseRecruitCost = champion.powerTier * 2000;
    const recruitCost = isFallenFaction ? Math.round(baseRecruitCost * 0.5) : baseRecruitCost;
    if (newBtnRecruit) {
      newBtnRecruit.innerHTML = isFallenFaction
        ? `🤝 招降亡將<br><span style="font-size: 0.8em; color: #86efac;">(${recruitCost} 金幣・半價加盟)</span>`
        : `🤝 招降加入<br><span style="font-size: 0.8em; color: #fbbf24;">(${recruitCost} 金幣)</span>`;
    }

    // 贖金金額
    const ransomGold = champion.powerTier * 500;
    if (newBtnRansom) {
      newBtnRansom.innerHTML = isFallenFaction
        ? `📦 沒收私產流放<br><span style="font-size: 0.8em; color: #fbbf24;">(+${ransomGold} 金幣)</span>`
        : `💰 索取母國贖金<br><span style="font-size: 0.8em; color: #fbbf24;">(+${ransomGold} 金幣)</span>`;
    }

    if (newBtnRelease) {
      newBtnRelease.innerHTML = isFallenFaction
        ? `🔓 仁慈釋放流亡<br><span style="font-size: 0.8em; color: #86efac;">(化身在野傳奇)</span>`
        : `🔓 仁慈釋放回國<br><span style="font-size: 0.8em; color: #86efac;">(母國好感 +10)</span>`;
    }

    const removePrisoner = () => {
      if (faction && faction.capturedChampionIds) {
        faction.capturedChampionIds = faction.capturedChampionIds.filter((id: string) => id !== champion.id);
      }
    };

    if (newBtnRecruit) {
      newBtnRecruit.onclick = () => {
        if (GameState.myTerritory.gold < recruitCost) {
           ToastManager.show(`❌ 黃金不足！需要 ${recruitCost} 金幣。`, 'error');
           return;
        }
        GameState.myTerritory.gold -= recruitCost;
        modal.classList.remove('active');
        removePrisoner();
        const newAdv = this.convertChampionToAdventurer(champion);
        GameState.adventurers.push(newAdv);
        if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 30);
        
        if (isFallenFaction) {
          ToastManager.show(`🤝 成功招降亡國名將【${champion.name}】！感念明主恩德，他已正式宣誓效忠您的領地。`, 'success');
        } else {
          ToastManager.show(`🤝 成功招降【${champion.name}】！他已正式加入您的傭兵隊伍。`, 'success');
        }
      };
    }

    if (newBtnRansom) {
      newBtnRansom.onclick = () => {
        modal.classList.remove('active');
        removePrisoner();
        GameState.myTerritory.addGold(ransomGold);
        if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 15);
        
        if (isFallenFaction) {
          ToastManager.show(`📦 沒收了【${champion.name}】舊族私產 ${ransomGold} 金幣，並將其驅逐出境流放荒野。`, 'info');
        } else {
          ToastManager.show(`💰 獲得母國贖金 ${ransomGold} 金幣，【${champion.name}】已安全交還給 ${factionName}。`, 'info');
        }
      };
    }

    if (newBtnExecute) {
      newBtnExecute.onclick = () => {
        modal.classList.remove('active');
        removePrisoner();
        if (faction) {
          if (!faction.defeatedChampionIds) faction.defeatedChampionIds = [];
          faction.defeatedChampionIds.push(champion.id);
          faction.playerFavor = Math.max(-100, faction.playerFavor - 60);
        }
        
        if (isFallenFaction) {
          ToastManager.show(`⚰️ 處決了亡國將領【${champion.name}】！一代名將自此殞命於亂世。`, 'error');
        } else {
          ToastManager.show(`⚰️ 處決了【${champion.name}】！${factionName} 對您的恨意暴增！`, 'error');
        }
      };
    }

    if (newBtnRelease) {
      newBtnRelease.onclick = () => {
        modal.classList.remove('active');
        removePrisoner();
        if (faction) faction.playerFavor = Math.min(100, faction.playerFavor + 10);
        
        if (isFallenFaction) {
          ToastManager.show(`🔓 仁慈釋放了亡國之將【${champion.name}】！他對領主不殺之恩感激涕零，隱姓埋名浪跡大陸，化身在野傳奇。`, 'info');
        } else {
          ToastManager.show(`🔓 釋放了【${champion.name}】。${factionName} 對您的仁慈表示敬意（好感度 +10）。`, 'info');
        }
      };
    }
  }
}
