import { Adventurer } from '../../models/Adventurer';
import { renderAdventurerCard, getAdventurerTooltipHtml, CardOptions } from './AdventurerCard';
import { positionFloatingElement } from '../FloatingPosition';

export interface HeroPickerOptions {
  container: HTMLElement;
  adventurers: Adventurer[];
  selectedIds?: Set<string> | string[];
  disabledIds?: Set<string> | string[];
  columns?: number;
  filter?: (adv: Adventurer) => boolean;
  sort?: (a: Adventurer, b: Adventurer) => number;
  onSelect: (adv: Adventurer) => void;
  onDisabledClick?: (adv: Adventurer) => void;
  draggable?: boolean;
  onDragStart?: (adv: Adventurer, e: DragEvent) => void;
  cardExtraOptions?: (adv: Adventurer) => CardOptions;
  cardWidth?: number;
  cardHeight?: number;
  cardScale?: number;
  emptyMessage?: string;
  enableHoverEffect?: boolean;
}

export class HeroPicker {
  public static render(options: HeroPickerOptions): void {
    const {
      container,
      adventurers,
      selectedIds,
      disabledIds,
      columns,
      filter,
      sort,
      onSelect,
      onDisabledClick,
      draggable = false,
      onDragStart,
      cardExtraOptions,
      cardWidth = 95,
      cardHeight = 110,
      cardScale = 1,
      emptyMessage = '目前沒有符合條件的傭兵。',
      enableHoverEffect = true,
    } = options;

    container.innerHTML = '';
    if (columns && columns > 0) {
      container.style.display = 'grid';
      container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      container.style.gap = '8px';
    } else {
      container.style.display = 'flex';
      container.style.flexWrap = 'wrap';
      container.style.gap = '10px';
    }
    container.style.overflowY = 'auto';
    container.style.overflowX = 'hidden';
    container.style.alignContent = 'flex-start';
    container.style.paddingRight = '4px';

    // 1. 過濾
    let filtered = filter ? adventurers.filter(filter) : [...adventurers];

    // 2. 排序
    if (sort) {
      filtered.sort(sort);
    }

    // 3. 空狀態
    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; width: 100%; color: #94a3b8; font-size: 0.88em; text-align: center; padding: 24px 10px; line-height: 1.6;">
          ${emptyMessage}
        </div>
      `;
      return;
    }

    // 4. 渲染卡片
    filtered.forEach(adv => {
      const isSelected = selectedIds ? (selectedIds instanceof Set ? selectedIds.has(adv.id) : selectedIds.includes(adv.id)) : false;
      const isDisabled = disabledIds ? (disabledIds instanceof Set ? disabledIds.has(adv.id) : disabledIds.includes(adv.id)) : false;

      const card = document.createElement('div');
      card.className = 'adventurer-card';
      card.style.width = (columns && columns > 0) ? '100%' : `${cardWidth}px`;
      card.style.height = `${cardHeight}px`;
      card.style.flexShrink = '0';
      card.style.position = 'relative';
      card.style.boxSizing = 'border-box';
      card.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease';

      if (cardScale !== 1) {
        card.style.transform = `scale(${cardScale})`;
        card.style.transformOrigin = 'center';
      }

      if (isDisabled) {
        card.style.cursor = 'not-allowed';
        card.style.opacity = '0.35';
      } else if (isSelected) {
        card.style.cursor = 'pointer';
        card.style.borderColor = '#eab308';
        card.style.boxShadow = '0 0 10px rgba(234, 179, 8, 0.55)';
        card.style.opacity = '0.6';
      } else {
        card.style.cursor = 'pointer';
        card.style.opacity = '1';
      }

      // 拖曳支援
      if (draggable && !isDisabled && !isSelected) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
          if (onDragStart) onDragStart(adv, e);
        });
      }

      // 卡片附加選項（例如底籤、統帥值等）
      const extraOpts = cardExtraOptions ? cardExtraOptions(adv) : {};
      card.innerHTML = renderAdventurerCard(adv, extraOpts);

      // Tooltip
      const tooltipHtml = getAdventurerTooltipHtml(adv);
      card.addEventListener('mouseenter', () => {
        if (enableHoverEffect && !isSelected && !isDisabled) {
          card.style.transform = cardScale !== 1 ? `scale(${cardScale * 1.04}) translateY(-2px)` : 'translateY(-3px)';
          card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6)';
        }
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.innerHTML = tooltipHtml;
          tEl.style.opacity = '1';
        }
      });

      card.addEventListener('mousemove', (e) => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
      });

      card.addEventListener('mouseleave', () => {
        if (enableHoverEffect && !isSelected && !isDisabled) {
          card.style.transform = cardScale !== 1 ? `scale(${cardScale})` : 'translateY(0)';
          card.style.boxShadow = 'none';
        }
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });

      // 點選事件
      card.addEventListener('click', (e) => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';

        if (isDisabled) {
          if (onDisabledClick) onDisabledClick(adv);
          return;
        }

        onSelect(adv);
      });

      container.appendChild(card);
    });
  }
}
