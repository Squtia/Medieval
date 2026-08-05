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

/**
 * 將 AI 派系武將轉換為玩家傭兵 (Adventurer)
 */
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

  // 依據 powerTier 計算等級並提升
  const targetLevel = Math.max(1, champion.powerTier * 2);
  for (let i = 1; i < targetLevel; i++) {
    newAdv.gainXP(newAdv.getRequiredXP());
  }

  return newAdv;
}

/**
 * 開啟戰後俘虜處置 Modal
 */
public openPrisonerModal(champion: FactionChampion) {
  const modal = document.getElementById('modal-prisoner-action');
  if (!modal) return;

  const avatar = document.getElementById('prisoner-avatar');
  const nameEl = document.getElementById('prisoner-name');
  const titleEl = document.getElementById('prisoner-title');
  const descEl = document.getElementById('prisoner-desc');

  const faction = GameState.mapSystem?.getFactions().find(f => f.id === champion.factionId);
  const factionName = faction ? faction.factionName : '未知派系';

  if (avatar) avatar.textContent = champion.portraitEmoji;
  if (nameEl) nameEl.textContent = champion.name;
  if (titleEl) titleEl.textContent = `【${champion.title}】 ${factionName}`;
  if (descEl) descEl.textContent = champion.description;

  modal.classList.add('active');

  const btnRecruit = document.getElementById('btn-prisoner-recruit');
  const btnRansom = document.getElementById('btn-prisoner-ransom');
  const btnExecute = document.getElementById('btn-prisoner-execute');
  const btnRelease = document.getElementById('btn-prisoner-release');

  if (btnRecruit) {
    btnRecruit.onclick = () => {
      modal.classList.remove('active');
      const newAdv = this.convertChampionToAdventurer(champion);
      GameState.adventurers.push(newAdv);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 30);
      ToastManager.show(`🤝 成功招降【${champion.name}】！他已正式加入您的傭兵隊伍。`, 'success');
    };
  }

  if (btnRansom) {
    btnRansom.onclick = () => {
      modal.classList.remove('active');
      const ransomGold = champion.powerTier * 500;
      GameState.myTerritory.addGold(ransomGold);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 15);
      ToastManager.show(`💰 獲得贖金 ${ransomGold} 金幣，【${champion.name}】已安全交還給 ${factionName}。`, 'info');
    };
  }

  if (btnExecute) {
    btnExecute.onclick = () => {
      modal.classList.remove('active');
      if (faction) {
        if (!faction.defeatedChampionIds) faction.defeatedChampionIds = [];
        faction.defeatedChampionIds.push(champion.id);
        faction.playerFavor = Math.max(-100, faction.playerFavor - 60);
      }
      ToastManager.show(`⚰️ 處決了【${champion.name}】！${factionName} 對您的恨意暴增！`, 'error');
    };
  }

  if (btnRelease) {
    btnRelease.onclick = () => {
      modal.classList.remove('active');
      if (faction) faction.playerFavor = Math.min(100, faction.playerFavor + 10);
      ToastManager.show(`🔓 釋放了【${champion.name}】。${factionName} 對您的仁慈表示敬意（好感度 +10）。`, 'info');
    };
  }
}

}
