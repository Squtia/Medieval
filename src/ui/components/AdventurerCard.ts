import { Adventurer } from '../../models/Adventurer';

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
        <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px; font-size: 0.7em; white-space: nowrap; border: 1px solid rgba(255,255,255,0.3); color: #94a3b8; z-index: 5;">
          ${options.emptyLabel}
        </div>
      `;
    } else {
      return `<span style="color:#64748b; font-size: 0.8em;">空位</span>`;
    }
  }

  if (!adv) return '';

  const displayClass = (adv as any).currentClass || adv.job.name;
  const avatarIndex = adv.avatarIndex ?? 0;
  
  // 計算 Spritesheet 背景偏移
  // 5x5: X = (index % 5) * 25%, Y = floor(index / 5) * 25%
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
      <div${roleAttr} style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: ${bg}; padding: 2px 8px; border-radius: 10px; font-size: 0.7em; white-space: nowrap; border: 1px solid #fff; color: #fff; z-index: 5; cursor: ${options.bottomLabelRole ? 'pointer' : 'default'};">
        ${options.bottomLabel}
      </div>
    `;
  }

  let cornerLabelHtml = '';
  if (options.cornerLabel) {
    cornerLabelHtml = `
      <div style="position: absolute; top: -5px; right: -5px; background: #3b82f6; color: white; font-size: 0.7em; padding: 2px 5px; border-radius: 5px; box-shadow: 0 0 5px rgba(0,0,0,0.5); z-index: 5;">
        ${options.cornerLabel}
      </div>
    `;
  }

  // 預設頭像背景樣式
  const spriteStyle = `width: 100%; height: 100%; background-image: url('assets/avatars_5x5.png'); background-size: 500% 500%; background-position: ${bgX}% ${bgY}%;`;

  const qualityColor = adv.quality === 'SSR' ? '#eab308' : adv.quality === 'SR' ? '#c084fc' : adv.quality === 'R' ? '#60a5fa' : '#cbd5e1';

  return `
    <div class="adv-name" style="color: ${qualityColor};">${adv.name}</div>
    <div class="adv-avatar-wrapper">
      <div class="adv-avatar-sprite" style="${spriteStyle}"></div>
      <span style="font-size: 1.5em; position: absolute; z-index: -1;">🦸</span>
    </div>
    <div class="adv-card-gradient"></div>
    <div class="adv-card-info">
      <div class="adv-level" style="color: ${qualityColor};">Lv.${adv.level} ${displayClass}</div>
      ${extraStatsHtml}
    </div>
    ${dismissBtnHtml}
    ${bottomLabelHtml}
    ${cornerLabelHtml}
  `;
}
