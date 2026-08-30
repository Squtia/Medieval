import { FactionCampaign } from '../../systems/faction/FactionCampaignSystem';
import { GameState } from '../../core/GameState';
import { ToastManager } from '../ToastManager';

export class FactionCampaignModalController {
  private static currentCampaign: FactionCampaign | null = null;

  public static init(): void {
    const btnClose = document.getElementById('btn-close-campaign-intel');
    const btnPass = document.getElementById('btn-campaign-let-pass');
    const btnIntercept = document.getElementById('btn-campaign-intercept');

    btnClose?.addEventListener('click', () => this.close());
    btnPass?.addEventListener('click', () => this.close());

    btnIntercept?.addEventListener('click', () => {
      if (!this.currentCampaign) return;
      this.triggerInterception(this.currentCampaign);
      this.close();
    });

    document.addEventListener('faction-campaign-clicked', ((e: CustomEvent<{ campaign: FactionCampaign }>) => {
      if (e.detail?.campaign) {
        this.open(e.detail.campaign);
      }
    }) as EventListener);
  }

  public static open(campaign: FactionCampaign): void {
    this.currentCampaign = campaign;
    const modal = document.getElementById('modal-faction-campaign-intel');
    if (!modal) return;

    const allFactions = GameState.mapSystem?.getFactions() || [];
    const allNodes = GameState.mapSystem?.getNodes() || [];

    const atk = allFactions.find(f => f.id === campaign.attackerFactionId);
    const def = allFactions.find(f => f.id === campaign.targetFactionId);
    const targetNode = allNodes.find(n => n.id === campaign.targetNodeId);

    const titleEl = document.getElementById('campaign-intel-title');
    const subtitleEl = document.getElementById('campaign-intel-subtitle');
    const statusEl = document.getElementById('campaign-intel-status');
    const targetEl = document.getElementById('campaign-intel-target');
    const troopsEl = document.getElementById('campaign-intel-troops');

    if (titleEl) titleEl.innerText = `🚩 遭遇敵方軍團：${atk?.factionName || '未知勢力'}`;
    if (subtitleEl) subtitleEl.innerText = `正在前往【${targetNode?.name || '未知要塞'}】發起戰役`;
    
    const remainingMarchDays = Math.max(1, campaign.totalDays - campaign.elapsedDays);
    if (statusEl) statusEl.innerText = `🐎 行軍中 (預計 ${remainingMarchDays} 天後抵達)`;
    if (targetEl) targetEl.innerText = campaign.type === 'SIEGE' ? '🏰 要塞攻城戰' : '🔥 邊境掠奪奪糧';
    
    const siegeText = (campaign.siegeRams > 0 ? `、${campaign.siegeRams} 衝車` : '') + (campaign.siegeCatapults > 0 ? `、${campaign.siegeCatapults} 投石機` : '');
    if (troopsEl) troopsEl.innerText = `${campaign.infantry} 步兵、${campaign.archers} 弓兵、${campaign.cavalry} 騎兵${siegeText}`;

    modal.style.display = 'flex';
  }

  public static close(): void {
    const modal = document.getElementById('modal-faction-campaign-intel');
    if (modal) modal.style.display = 'none';
    this.currentCampaign = null;
  }

  private static triggerInterception(campaign: FactionCampaign): void {
    const allFactions = GameState.mapSystem?.getFactions() || [];
    const atk = allFactions.find(f => f.id === campaign.attackerFactionId);
    const def = allFactions.find(f => f.id === campaign.targetFactionId);

    // 外交連動：進攻方好感 -35，防守方好感 +40
    if (atk) {
      atk.playerFavor = Math.max(-100, (atk.playerFavor || 0) - 35);
    }
    if (def) {
      def.playerFavor = Math.min(100, (def.playerFavor || 0) + 40);
    }

    // 成功瓦解進攻軍團
    campaign.status = 'RESOLVED';
    ToastManager.show(`⚔️ 成功伏擊並瓦解了【${atk?.factionName}】的遠征軍團！獲得【${def?.factionName}】的崇高敬意。`);
  }
}
