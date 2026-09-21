import { GameState } from '../../core/GameState';
import { Equipment, EquipmentSlot, AdventurerState } from '../../models/types';
import { Adventurer } from '../../models/Adventurer';
import { renderEquipIcon, ICON_SIZE, attachTooltip, getEquipTooltipHtml } from '../ShopController';
import { renderAvatarSpriteHtml } from '../IconSpriteHelper';

export interface EquipOwner {
  isWarehouse: boolean;
  adventurer?: Adventurer;
}

export interface EquipSourcePickerOptions {
  container: HTMLElement;
  selectedEquipUuid: string | null;
  onSelectEquip: (equip: Equipment, owner: EquipOwner) => void;
  slotFilter?: EquipmentSlot | 'ALL';
  customEquipFilter?: (equip: Equipment) => boolean;
  includeWarehouse?: boolean;
  title?: string;
}

export class EquipSourcePicker {
  private options: EquipSourcePickerOptions;
  private currentOwnerId: string = 'WAREHOUSE'; // 'WAREHOUSE' or adventurer.id
  private activeSlotFilter: EquipmentSlot | 'ALL' = 'ALL';

  constructor(options: EquipSourcePickerOptions) {
    this.options = options;
    this.activeSlotFilter = options.slotFilter || 'ALL';
    this.resolveInitialOwner();
  }

  public static render(options: EquipSourcePickerOptions): EquipSourcePicker {
    const picker = new EquipSourcePicker(options);
    picker.mount();
    return picker;
  }

  public ensureUuid(eq: Equipment): string {
    if (!eq.uuid) {
      eq.uuid = `eq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    return eq.uuid;
  }

  /**
   * 根據傳入的 selectedEquipUuid 自動解析所屬對象
   */
  private resolveInitialOwner(): void {
    const uuid = this.options.selectedEquipUuid;
    const territory = GameState.myTerritory;

    if (uuid) {
      if (territory.warehouse?.some(eq => {
        this.ensureUuid(eq);
        return eq.uuid === uuid;
      })) {
        this.currentOwnerId = 'WAREHOUSE';
        return;
      }
      const foundAdv = (GameState.adventurers || []).find(adv => {
        const equips = [adv.equipment?.WEAPON, adv.equipment?.ARMOR, adv.equipment?.ACCESSORY];
        return equips.some(eq => {
          if (!eq) return false;
          this.ensureUuid(eq);
          return eq.uuid === uuid;
        });
      });
      if (foundAdv) {
        this.currentOwnerId = foundAdv.id;
        return;
      }
    }

    // 預設優先選取有裝備的對象
    if ((territory.warehouse?.length || 0) > 0 || this.options.includeWarehouse !== false) {
      this.currentOwnerId = 'WAREHOUSE';
    } else if ((GameState.adventurers || []).length > 0) {
      this.currentOwnerId = GameState.adventurers[0].id;
    }
  }

  /**
   * 當切換來源對象或部位篩選時，自動尋找並選取當前對象下的第一件有效裝備
   */
  private selectFirstValidForCurrentOwner(filterFn: (eq: Equipment | null | undefined) => boolean): void {
    const territory = GameState.myTerritory;
    if (this.currentOwnerId === 'WAREHOUSE') {
      const whEquips = (territory.warehouse || []).filter(filterFn);
      // 若原選中的裝備仍在當前倉庫且符合條件，維持選取
      const currentSelected = whEquips.find(eq => {
        this.ensureUuid(eq);
        return eq.uuid === this.options.selectedEquipUuid;
      });
      if (currentSelected) return;

      const firstEq = whEquips[0] || null;
      if (firstEq) {
        this.ensureUuid(firstEq);
        this.options.selectedEquipUuid = firstEq.uuid!;
        this.options.onSelectEquip(firstEq, { isWarehouse: true });
      } else {
        this.options.selectedEquipUuid = null;
      }
    } else {
      const adv = (GameState.adventurers || []).find(a => a.id === this.currentOwnerId);
      if (adv) {
        const slots: EquipmentSlot[] = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
        const validEquips: Equipment[] = [];
        slots.forEach(s => {
          const eq = adv.equipment?.[s];
          if (eq && filterFn(eq)) {
            this.ensureUuid(eq);
            validEquips.push(eq);
          }
        });

        // 若原選中的裝備仍在當前傭兵身上且符合條件，維持選取
        const currentSelected = validEquips.find(eq => {
          this.ensureUuid(eq);
          return eq.uuid === this.options.selectedEquipUuid;
        });
        if (currentSelected) return;

        const firstEq = validEquips[0] || null;
        if (firstEq) {
          this.ensureUuid(firstEq);
          this.options.selectedEquipUuid = firstEq.uuid!;
          this.options.onSelectEquip(firstEq, { isWarehouse: false, adventurer: adv });
        } else {
          this.options.selectedEquipUuid = null;
        }
      }
    }
  }

  public mount(): void {
    const container = this.options.container;
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.minHeight = '0';
    container.style.gap = '10px';

    const territory = GameState.myTerritory;
    const adventurers = (GameState.adventurers || []).filter(adv => adv.currentState === AdventurerState.IDLE);

    // 裝備篩選判斷器
    const passesFilter = (eq: Equipment | null | undefined): boolean => {
      if (!eq) return false;
      this.ensureUuid(eq);
      if (this.activeSlotFilter !== 'ALL' && eq.slot !== this.activeSlotFilter) return false;
      if (this.options.customEquipFilter && !this.options.customEquipFilter(eq)) return false;
      return true;
    };

    // ==========================================
    // 1. 頂部部位篩選標籤列
    // ==========================================
    const filterRow = document.createElement('div');
    filterRow.style.display = 'flex';
    filterRow.style.gap = '6px';
    filterRow.style.flexShrink = '0';

    const slots: { id: EquipmentSlot | 'ALL'; name: string }[] = [
      { id: 'ALL', name: '全部' },
      { id: EquipmentSlot.WEAPON, name: '武器' },
      { id: EquipmentSlot.ARMOR, name: '防具' },
      { id: EquipmentSlot.ACCESSORY, name: '飾品' },
    ];

    slots.forEach(s => {
      const btn = document.createElement('button');
      const isSel = this.activeSlotFilter === s.id;
      btn.style.flex = '1';
      btn.style.padding = '4px 0';
      btn.style.fontSize = '0.78em';
      btn.style.borderRadius = '4px';
      btn.style.cursor = 'pointer';
      btn.style.border = `1px solid ${isSel ? '#fbbf24' : 'rgba(255,255,255,0.15)'}`;
      btn.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
      btn.style.color = isSel ? '#fbbf24' : '#94a3b8';
      btn.textContent = s.name;
      btn.onclick = () => {
        this.activeSlotFilter = s.id;
        this.selectFirstValidForCurrentOwner(passesFilter);
        this.mount();
      };
      filterRow.appendChild(btn);
    });
    container.appendChild(filterRow);

    // ==========================================
    // 2. 上層：來源對象 4 欄網格 (倉庫 + 傭兵頭像卡)
    // ==========================================
    const ownerSection = document.createElement('div');
    ownerSection.style.display = 'flex';
    ownerSection.style.flexDirection = 'column';
    ownerSection.style.flexShrink = '0';
    ownerSection.style.gap = '4px';

    const ownerHeader = document.createElement('div');
    ownerHeader.style.display = 'flex';
    ownerHeader.style.justifyContent = 'space-between';
    ownerHeader.style.alignItems = 'center';
    ownerHeader.style.fontSize = '0.82em';
    ownerHeader.style.color = '#cbd5e1';
    ownerHeader.innerHTML = `<span>來源對象 (點擊切換)</span><span style="color:#94a3b8; font-size:0.9em;">共 ${adventurers.length + 1} 處</span>`;
    ownerSection.appendChild(ownerHeader);

    const ownerGrid = document.createElement('div');
    ownerGrid.style.display = 'grid';
    ownerGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    ownerGrid.style.gap = '8px';
    ownerGrid.style.maxHeight = '200px';
    ownerGrid.style.overflowY = 'auto';
    ownerGrid.style.overflowX = 'hidden';
    ownerGrid.style.alignContent = 'flex-start';
    ownerGrid.style.paddingRight = '2px';

    // 倉庫卡片
    if (this.options.includeWarehouse !== false) {
      const isWhSel = this.currentOwnerId === 'WAREHOUSE';
      const whEquips = (territory.warehouse || []).filter(passesFilter);
      const whTotal = territory.warehouse?.length || 0;

      const whCard = document.createElement('div');
      whCard.style.display = 'flex';
      whCard.style.flexDirection = 'column';
      whCard.style.alignItems = 'center';
      whCard.style.justifyContent = 'space-between';
      whCard.style.padding = '6px 4px 5px 4px';
      whCard.style.borderRadius = '6px';
      whCard.style.cursor = 'pointer';
      whCard.style.height = '88px';
      whCard.style.boxSizing = 'border-box';
      whCard.style.background = isWhSel ? 'rgba(234, 179, 8, 0.22)' : 'rgba(24, 18, 14, 0.85)';
      whCard.style.border = `1.5px solid ${isWhSel ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
      if (isWhSel) whCard.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.5)';

      whCard.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${isWhSel ? '#fbbf24' : '#d97706'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            <path d="m3.3 7 8.7 5 8.7-5"/>
            <path d="M12 22V12"/>
          </svg>
        </div>
        <div style="font-size:0.78em; font-weight:bold; color:${isWhSel ? '#fbbf24' : '#e2e8f0'}; white-space:nowrap;">儲備倉庫</div>
        <div style="font-size:0.7em; color:#94a3b8;">${whTotal} 件</div>
      `;

      whCard.onclick = () => {
        this.currentOwnerId = 'WAREHOUSE';
        this.selectFirstValidForCurrentOwner(passesFilter);
        this.mount();
      };
      ownerGrid.appendChild(whCard);
    }

    // 傭兵頭像卡片
    adventurers.forEach(adv => {
      const isAdvSel = this.currentOwnerId === adv.id;
      const advEquips = [adv.equipment?.WEAPON, adv.equipment?.ARMOR, adv.equipment?.ACCESSORY].filter(Boolean) as Equipment[];
      const qualityColor = adv.quality === 'SSR' ? '#eab308' : adv.quality === 'SR' ? '#c084fc' : adv.quality === 'R' ? '#60a5fa' : '#cbd5e1';

      const advCard = document.createElement('div');
      advCard.style.display = 'flex';
      advCard.style.flexDirection = 'column';
      advCard.style.alignItems = 'center';
      advCard.style.justifyContent = 'space-between';
      advCard.style.padding = '5px 3px 4px 3px';
      advCard.style.borderRadius = '6px';
      advCard.style.cursor = 'pointer';
      advCard.style.height = '88px';
      advCard.style.boxSizing = 'border-box';
      advCard.style.position = 'relative';
      advCard.style.background = isAdvSel ? 'rgba(234, 179, 8, 0.22)' : 'rgba(24, 18, 14, 0.85)';
      advCard.style.border = `1.5px solid ${isAdvSel ? '#eab308' : 'rgba(255, 255, 255, 0.1)'}`;
      if (isAdvSel) advCard.style.boxShadow = '0 0 8px rgba(234, 179, 8, 0.5)';

      // 穿戴件數微標籤
      const equipBadge = `<span style="position:absolute; top:3px; right:4px; font-size:0.62em; background:rgba(0,0,0,0.8); color:${advEquips.length > 0 ? '#fbbf24' : '#64748b'}; padding:0 3px; border-radius:3px; border:1px solid rgba(255,255,255,0.15);">${advEquips.length}/3</span>`;

      advCard.innerHTML = `
        ${equipBadge}
        <div style="flex:1; display:flex; align-items:center; justify-content:center; margin-top:2px;">
          ${renderAvatarSpriteHtml(adv.gender, adv.avatarIndex, 40, `border: 1px solid ${qualityColor}; border-radius: 4px;`, adv.isGuardian)}
        </div>
        <div style="font-size:0.75em; font-weight:bold; color:${qualityColor}; width:94%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${adv.name}</div>
        <div style="font-size:0.68em; color:#94a3b8; line-height:1;">Lv.${adv.level} ${adv.job?.name || ''}</div>
      `;

      attachTooltip(advCard, () => `
        <div style="padding:4px; line-height:1.4;">
          <strong style="color:${qualityColor};">${adv.name}</strong> (Lv.${adv.level} ${adv.job?.name || '傭兵'})<br/>
          穿戴裝備: ${advEquips.length}/3 件<br/>
          <span style="font-size:0.85em; color:#94a3b8;">點擊檢視穿戴裝備</span>
        </div>
      `);

      advCard.onclick = () => {
        this.currentOwnerId = adv.id;
        this.selectFirstValidForCurrentOwner(passesFilter);
        this.mount();
      };
      ownerGrid.appendChild(advCard);
    });

    ownerSection.appendChild(ownerGrid);
    container.appendChild(ownerSection);

    // ==========================================
    // 3. 下層：裝備槽位清單區 (即時連動)
    // ==========================================
    const slotSection = document.createElement('div');
    slotSection.style.display = 'flex';
    slotSection.style.flexDirection = 'column';
    slotSection.style.flex = '1';
    slotSection.style.minHeight = '0';
    slotSection.style.background = 'rgba(0,0,0,0.3)';
    slotSection.style.border = '1px solid rgba(217, 119, 6, 0.25)';
    slotSection.style.borderRadius = '6px';
    slotSection.style.padding = '8px';

    const renderEquipCard = (eq: Equipment, owner: EquipOwner): HTMLElement => {
      this.ensureUuid(eq);
      const isSelected = eq.uuid === this.options.selectedEquipUuid;
      const card = document.createElement('div');
      card.style.background = isSelected ? 'rgba(234, 179, 8, 0.35)' : 'rgba(20, 16, 12, 0.85)';
      card.style.border = `2px solid ${isSelected ? '#eab308' : 'rgba(217, 119, 6, 0.3)'}`;
      card.style.borderRadius = '6px';
      card.style.padding = '4px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.height = '88px';
      card.style.boxSizing = 'border-box';
      if (isSelected) {
        card.style.boxShadow = '0 0 12px rgba(234, 179, 8, 0.7)';
        card.style.outline = '1px solid #fef08a';
      }

      const slotName = eq.slot === EquipmentSlot.WEAPON ? '武器' : (eq.slot === EquipmentSlot.ARMOR ? '防具' : '飾品');

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          ${renderEquipIcon(eq, ICON_SIZE.MD)}
        </div>
        <div style="display:flex; justify-content:space-between; width:100%; font-size:0.7em; border-top:1px solid rgba(255,255,255,0.12); padding-top:2px;">
          <span style="color:#fbbf24; font-weight:bold;">+${eq.enhancementLevel || 0}</span>
          <span style="color:#94a3b8;">${slotName}</span>
          <span style="color:#cbd5e1;">T${eq.tier || 1}</span>
        </div>
      `;

      attachTooltip(card, () => getEquipTooltipHtml(eq));

      card.onclick = (e) => {
        e.stopPropagation();
        this.ensureUuid(eq);
        this.options.selectedEquipUuid = eq.uuid!;
        this.options.onSelectEquip(eq, owner);
        this.mount();
      };

      return card;
    };

    if (this.currentOwnerId === 'WAREHOUSE') {
      // 領地儲備倉庫
      const whEquips = (territory.warehouse || []).filter(passesFilter);
      const slotTitle = document.createElement('div');
      slotTitle.style.fontSize = '0.84em';
      slotTitle.style.color = '#fbbf24';
      slotTitle.style.fontWeight = 'bold';
      slotTitle.style.marginBottom = '8px';
      slotTitle.style.paddingBottom = '4px';
      slotTitle.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
      slotTitle.textContent = `✦ 領地儲備倉庫 (${whEquips.length} 件符合)`;
      slotSection.appendChild(slotTitle);

      const whSlotGrid = document.createElement('div');
      whSlotGrid.style.display = 'grid';
      whSlotGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
      whSlotGrid.style.gap = '8px';
      whSlotGrid.style.overflowY = 'auto';
      whSlotGrid.style.overflowX = 'hidden';
      whSlotGrid.style.alignContent = 'flex-start';
      whSlotGrid.style.flex = '1';
      whSlotGrid.style.paddingRight = '2px';

      if (whEquips.length === 0) {
        whSlotGrid.innerHTML = `<div style="grid-column: 1 / -1; color:#94a3b8; font-size:0.82em; text-align:center; padding:20px 0;">無符合條件之裝備</div>`;
      } else {
        whEquips.forEach(eq => {
          whSlotGrid.appendChild(renderEquipCard(eq, { isWarehouse: true }));
        });
      }
      slotSection.appendChild(whSlotGrid);

    } else {
      // 傭兵穿戴槽位 (固定 3 欄：武器、防具、飾品)
      const curAdv = adventurers.find(a => a.id === this.currentOwnerId);
      if (curAdv) {
        const slotTitle = document.createElement('div');
        slotTitle.style.fontSize = '0.84em';
        slotTitle.style.color = '#fbbf24';
        slotTitle.style.fontWeight = 'bold';
        slotTitle.style.marginBottom = '8px';
        slotTitle.style.paddingBottom = '4px';
        slotTitle.style.borderBottom = '1px solid rgba(217, 119, 6, 0.2)';
        slotTitle.textContent = `✦ ${curAdv.name} (Lv.${curAdv.level} ${curAdv.job?.name || ''}) 穿戴裝備`;
        slotSection.appendChild(slotTitle);

        const advSlotGrid = document.createElement('div');
        advSlotGrid.style.display = 'grid';
        advSlotGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        advSlotGrid.style.gap = '8px';
        advSlotGrid.style.flex = '1';
        advSlotGrid.style.alignContent = 'flex-start';

        const slotTypes: { slot: EquipmentSlot; name: string }[] = [
          { slot: EquipmentSlot.WEAPON, name: '武器' },
          { slot: EquipmentSlot.ARMOR, name: '防具' },
          { slot: EquipmentSlot.ACCESSORY, name: '飾品' },
        ];

        slotTypes.forEach(st => {
          const eq = curAdv.equipment?.[st.slot];
          if (eq && passesFilter(eq)) {
            advSlotGrid.appendChild(renderEquipCard(eq, { isWarehouse: false, adventurer: curAdv }));
          } else {
            // 空槽位卡片
            const emptyCard = document.createElement('div');
            emptyCard.style.background = 'rgba(15, 12, 10, 0.5)';
            emptyCard.style.border = '1px dashed rgba(255, 255, 255, 0.15)';
            emptyCard.style.borderRadius = '6px';
            emptyCard.style.height = '88px';
            emptyCard.style.display = 'flex';
            emptyCard.style.flexDirection = 'column';
            emptyCard.style.alignItems = 'center';
            emptyCard.style.justifyContent = 'center';
            emptyCard.style.color = '#64748b';
            emptyCard.style.fontSize = '0.78em';
            emptyCard.innerHTML = `
              <div style="font-size:1.4em; opacity:0.4; margin-bottom:4px;">🛡️</div>
              <div>${st.name}</div>
              <div style="font-size:0.85em; opacity:0.6;">(空)</div>
            `;
            advSlotGrid.appendChild(emptyCard);
          }
        });

        slotSection.appendChild(advSlotGrid);
      }
    }

    container.appendChild(slotSection);
  }
}
