import { GameState } from '../../core/GameState';
import { ToastManager } from '../ToastManager';
import { Adventurer } from '../../models/Adventurer';
import { DataStore } from '../../systems/DataStore';
import { FactionChampion } from '../../models/types';

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
              <button class="action-btn" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.2); border-color: #ef4444; font-size: 0.9em;">⛓️ 提審</button>
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

    const avatar = document.getElementById('prisoner-avatar');
    const nameEl = document.getElementById('prisoner-name');
    const titleEl = document.getElementById('prisoner-title');
    const descEl = document.getElementById('prisoner-desc');

    if (avatar) avatar.textContent = champion.portraitEmoji || '👑';
    if (nameEl) nameEl.textContent = champion.name;
    if (titleEl) titleEl.textContent = `【${champion.title}】 ${factionName}`;
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
    
    // 招募需要錢，加上花費提示
    const recruitCost = champion.powerTier * 2000;
    if (newBtnRecruit) {
      newBtnRecruit.innerHTML = `🤝 招降加入<br><span style="font-size: 0.8em; color: #fbbf24;">(${recruitCost} 金幣)</span>`;
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
        ToastManager.show(`🤝 成功招降【${champion.name}】！他已正式加入您的傭兵隊伍。`, 'success');
      };
    }

    if (newBtnRansom) {
      newBtnRansom.onclick = () => {
        modal.classList.remove('active');
        removePrisoner();
        const ransomGold = champion.powerTier * 500;
        GameState.myTerritory.addGold(ransomGold);
        if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 15);
        ToastManager.show(`💰 獲得贖金 ${ransomGold} 金幣，【${champion.name}】已安全交還給 ${factionName}。`, 'info');
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
        ToastManager.show(`⚰️ 處決了【${champion.name}】！${factionName} 對您的恨意暴增！`, 'error');
      };
    }

    if (newBtnRelease) {
      newBtnRelease.onclick = () => {
        modal.classList.remove('active');
        removePrisoner();
        if (faction) faction.playerFavor = Math.min(100, faction.playerFavor + 10);
        ToastManager.show(`🔓 釋放了【${champion.name}】。${factionName} 對您的仁慈表示敬意（好感度 +10）。`, 'info');
      };
    }
  }
}
