import { Adventurer } from '../../models/Adventurer';
import { AdventurerState } from '../../models/types';

export function getAdventurerTooltipHtml(adv: Adventurer | any): string {
  if (!adv) return '';
  const displayClass = adv.currentClass || (adv.job && adv.job.name) || '平民';
  
  let stateText = '';
  if (adv.currentState) {
    if (adv.currentState === AdventurerState.RESTING) stateText = `<span style="color:#fde047;">休養中(${adv.restingDaysLeft}天)</span>`;
    else if (adv.currentState === AdventurerState.DISPATCHED) stateText = `<span style="color:#f87171;">派遣中</span>`;
    else if (adv.currentState === AdventurerState.CAPTURED) stateText = `<span style="color:#ef4444;">被俘虜</span>`;
    else if (adv.currentState === AdventurerState.IDLE) stateText = `<span style="color:#4ade80;">閒置</span>`;
    else stateText = adv.currentState;
  }
  
  const powerVal = typeof adv.getPower === 'function' ? adv.getPower() : (adv.power ?? 0);
  const powerHtml = `<br/>戰鬥力：<span style="color:#eab308; font-weight:bold;">${powerVal}</span>`;
  const stateHtml = stateText ? `<br/>狀態：${stateText}` : '';

  return `
    <div style="padding:2px 4px; line-height:1.4;">
      <div style="font-weight:bold; color:#f8fafc; font-size:1.05em; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:4px; margin-bottom:4px;">
        【${adv.name}】
      </div>
      <div style="font-size:0.9em; color:#cbd5e1;">
        Lv.${adv.level || 1} ${displayClass}
        ${powerHtml}
        ${stateHtml}
      </div>
    </div>
  `;
}

export interface CardOptions {
  cornerLabel?: string;     // e.g. "👑", "任務中"
  bottomLabel?: string;     // e.g. "城主"
  bottomLabelBg?: string;   // e.g. "#1d4ed8" - 底部標籤自訂背景色
  bottomLabelRole?: string; // e.g. "row-toggle" - 加入 data-role 屬性失護同步 querySelector
  showDismissBtn?: boolean; // true/false
  extraStats?: string;      // e.g. "統帥: 5"
  dismissId?: string;       // holder.id for dismiss button
  isEmpty?: boolean;        // Is this an empty slot?
  emptyLabel?: string;      // Label for empty slot
}

export function renderAdventurerCard(adv: Adventurer | null, options: CardOptions = {}): string {
  if (options.isEmpty) {
    if (options.emptyLabel) {
      return `
        <div class="adv-avatar-wrapper"><span style="color:#64748b; font-size: 14px; margin-bottom: 5px;">空位</span></div>
        <div style="position: absolute; bottom: -13px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.1); padding: 1px 7px; border-radius: 10px; font-size: 0.68em; white-space: nowrap; border: 1px solid rgba(255,255,255,0.3); color: #94a3b8; z-index: 5;">
          ${options.emptyLabel}
        </div>
      `;
    } else {
      return `<span style="color:#64748b; font-size: 0.8em;">空位</span>`;
    }
  }

  if (!adv) return '';

  const displayClass = (adv as any).currentClass || adv.job.name;
  const nameHash = adv.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const avatarIndex = adv.avatarIndex ?? (nameHash % 24);
  adv.avatarIndex = avatarIndex; // save back so it persists next time
  
  // 計算 Spritesheet 背景偏移
  // 6x4: X = (index % 6) * 20%, Y = floor(index / 6) * 33.3333%
  const bgX = (avatarIndex % 5) * 25;
  const bgY = Math.floor(avatarIndex / 5) * 25;

  let extraStatsHtml = '';
  if (options.extraStats) {
    extraStatsHtml = `<div style="font-size: 8.5px; color: #4ade80; margin-top: 2px; text-shadow: 0 1px 2px #000, 0 0 2px #000;">${options.extraStats}</div>`;
  }

  let dismissBtnHtml = '';
  if (options.showDismissBtn && options.dismissId) {
    dismissBtnHtml = `<button class="btn-dismiss-holder" data-id="${options.dismissId}" style="position: absolute; top: -5px; right: -5px; padding: 2px 5px; font-size: 0.7em; background: #ef4444; border-radius: 50%; color: white; border: none; cursor: pointer; z-index: 10;">×</button>`;
  }

  let bottomLabelHtml = '';
  if (options.bottomLabel) {
    const bg = options.bottomLabelBg || '#b45309';
    const roleAttr = options.bottomLabelRole ? ` data-role="${options.bottomLabelRole}"` : '';
    bottomLabelHtml = `
      <div${roleAttr} style="position: absolute; bottom: -13px; left: 50%; transform: translateX(-50%); background: ${bg}; padding: 1px 7px; border-radius: 10px; font-size: 0.68em; white-space: nowrap; border: 1px solid #fff; color: #fff; z-index: 5; box-shadow: 0 2px 4px rgba(0,0,0,0.5); cursor: ${options.bottomLabelRole ? 'pointer' : 'default'};">
        ${options.bottomLabel}
      </div>
    `;
  }

  // 極簡狀態標記 (最左上角 top: 4px, left: 4px，純微型綠/紅發光圓點)
  let cornerLabelHtml = '';
  if (options.cornerLabel) {
    const isSelectedLabel = options.cornerLabel.includes('✓');
    if (isSelectedLabel) {
      cornerLabelHtml = `
        <div style="position: absolute; top: 2px; left: 4px; z-index: 6; background: #3b82f6; color: white; font-size: 0.6em; padding: 0 4px; border-radius: 4px;">
          ✓
        </div>
      `;
    } else {
      const isIdle = options.cornerLabel.includes('閒置') || options.cornerLabel.includes('IDLE');
      const hasCrown = options.cornerLabel.includes('👑');
      const dotColor = isIdle ? '#22c55e' : '#ef4444';
      const dotShadow = isIdle ? '0 0 4px #22c55e' : '0 0 4px #ef4444';

      cornerLabelHtml = `
        <div title="${options.cornerLabel}" style="position: absolute; top: 4px; left: 4px; z-index: 6; display: flex; align-items: center; gap: 2px; pointer-events: auto;">
          ${hasCrown ? '<span style="font-size: 8px; line-height: 1;">👑</span>' : ''}
          <span style="display: inline-block; width: 6px; height: 6px; background-color: ${dotColor}; border-radius: 50%; box-shadow: ${dotShadow}; border: 1px solid rgba(255,255,255,0.7);"></span>
        </div>
      `;
    }
  }

  // 極簡未分配屬性點提示 (最右上角 top: 3px, right: 4px，純微型燈泡圖示)
  let statPointBadgeHtml = '';
  if (adv.unspentStatPoints && adv.unspentStatPoints > 0) {
    statPointBadgeHtml = `
      <div title="尚有 ${adv.unspentStatPoints} 點屬性點可分配" style="position: absolute; top: 3px; right: 4px; font-size: 9px; line-height: 1; z-index: 6; pointer-events: none; filter: drop-shadow(0 0 3px #f59e0b);">
        💡
      </div>
    `;
  }

  // 預設頭像背景樣式 (6x4 英雄頭像庫，使用 auto 400% 保持 1:1 正方形不拉伸)
  const avatarImage = adv.gender === 'FEMALE' ? 'assets/avatars_female.jpg' : 'assets/avatars_male.jpg';
  const spriteStyle = `aspect-ratio: 1/1; min-width: 100%; min-height: 100%; flex-shrink: 0; background-image: url('${avatarImage}'); background-size: 500% 500%; background-position: ${bgX}% ${bgY}%;`;

  const qualityColor = adv.quality === 'SSR' ? '#eab308' : adv.quality === 'SR' ? '#c084fc' : adv.quality === 'R' ? '#60a5fa' : '#cbd5e1';

  return `
    <div class="adv-name" style="color: ${qualityColor};">${adv.name}</div>
    <div class="adv-avatar-wrapper" style="display: flex; justify-content: center; align-items: center; overflow: hidden;">
      <div class="adv-avatar-sprite" style="${spriteStyle}"></div>
    </div>
    <div class="adv-card-gradient"></div>
    <div class="adv-card-info">
      <div class="adv-level" style="color: ${qualityColor};">Lv.${adv.level} ${displayClass}</div>
      ${extraStatsHtml}
    </div>
    ${dismissBtnHtml}
    ${bottomLabelHtml}
    ${cornerLabelHtml}
    ${statPointBadgeHtml}
  `;
}
