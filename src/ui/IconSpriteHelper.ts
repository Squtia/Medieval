import { EquipmentSlot, WeaponType } from '../models/types';

/**
 * 12 宮格武器座標對應表 (4 欄 × 3 列)
 */
export const WEAPON_SPRITE_COORDS: Record<string, { col: number; row: number }> = {
  GREATSWORD: { col: 0, row: 0 },
  DUAL_SWORDS: { col: 1, row: 0 },
  STAFF: { col: 2, row: 0 },
  SCYTHE: { col: 3, row: 0 },
  BOW: { col: 0, row: 1 },
  MAGIC_BOW: { col: 1, row: 1 },
  DAGGERS: { col: 2, row: 1 },
  MAGIC_RING: { col: 3, row: 1 },
  SHIELD: { col: 0, row: 2 },
  RUNIC_SHIELD: { col: 1, row: 2 },
  HOLY_BOOK: { col: 2, row: 2 },
  WARHAMMER: { col: 3, row: 2 }
};

/**
 * 12 宮格羊皮紙設施座標對應表 (4 欄 × 3 列)
 */
export const FACILITY_SPRITE_COORDS: Record<string, { col: number; row: number }> = {
  tavern: { col: 0, row: 0 },
  forge: { col: 1, row: 0 },
  weapon: { col: 2, row: 0 },
  armor: { col: 3, row: 0 },
  study: { col: 0, row: 1 },
  defense: { col: 1, row: 1 }
};

/**
 * 12 宮格彩色素材與資源座標對應表 (4 欄 × 3 列)
 */
export const RESOURCE_SPRITE_COORDS: Record<string, { col: number; row: number }> = {
  gold: { col: 2, row: 1 },
  wood: { col: 3, row: 1 },
  stone: { col: 0, row: 2 },
  iron: { col: 1, row: 2 },
  food: { col: 2, row: 2 },
  essence: { col: 3, row: 2 }
};

/**
 * 取得品質邊框與光暈顏色
 */
export function getTierQualityStyle(tier: number = 1): { borderColor: string; glowColor: string } {
  switch (tier) {
    case 5:
      return { borderColor: '#f59e0b', glowColor: 'rgba(245, 158, 11, 0.6)' }; // 傳奇金
    case 4:
      return { borderColor: '#a855f7', glowColor: 'rgba(168, 85, 247, 0.5)' }; // 史詩紫
    case 3:
      return { borderColor: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.4)' }; // 稀有藍
    case 2:
      return { borderColor: '#10b981', glowColor: 'rgba(16, 185, 129, 0.3)' }; // 精良綠
    case 1:
    default:
      return { borderColor: 'rgba(148, 163, 184, 0.5)', glowColor: 'transparent' }; // 普通灰白
  }
}

/**
 * 渲染武器裝備 Sprite 圖標 HTML
 */
export function renderWeaponSpriteHtml(weaponType: string | undefined, tier: number = 1, sizePx: number = 38): string {
  const normalizedType = (weaponType || 'GREATSWORD').toUpperCase();
  const coord = WEAPON_SPRITE_COORDS[normalizedType] || WEAPON_SPRITE_COORDS['GREATSWORD'];
  
  // 4 欄 x 3 列計算背景偏移 (0%, 33.333%, 66.666%, 100%) & (0%, 50%, 100%)
  const bgX = coord.col * 33.3333;
  const bgY = coord.row * 50.0;
  
  const quality = getTierQualityStyle(tier);
  const borderStyle = tier > 1 
    ? `border: 1.5px solid ${quality.borderColor}; box-shadow: 0 0 8px ${quality.glowColor};` 
    : `border: 1px solid rgba(255,255,255,0.15);`;

  return `
    <div class="weapon-sprite-icon" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      position: relative;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      ${borderStyle}
      background-image: url('./assets/icons_weapons_12.jpg');
      background-size: 400% 300%;
      background-position: ${bgX}% ${bgY}%;
    ">
      ${tier > 1 ? `<span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; font-weight: bold; color: ${quality.borderColor}; text-shadow: 0 1px 2px #000, 0 0 2px #000; line-height: 1;">T${tier}</span>` : ''}
    </div>
  `;
}

/**
 * 渲染設施 Sprite 圖標 HTML (羊皮紙木刻風格)
 */
export function renderFacilitySpriteHtml(facilityType: string, sizePx: number = 44): string {
  const coord = FACILITY_SPRITE_COORDS[facilityType.toLowerCase()] || FACILITY_SPRITE_COORDS['tavern'];
  const bgX = coord.col * 33.3333;
  const bgY = coord.row * 50.0;

  return `
    <div class="facility-sprite-icon" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
      border: 1px solid rgba(139, 69, 19, 0.4);
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
      background-image: url('./assets/icons_facilities_parchment_12.jpg');
      background-size: 400% 300%;
      background-position: ${bgX}% ${bgY}%;
    "></div>
  `;
}

/**
 * 渲染素材/資源 Sprite 圖標 HTML (彩色高辨識度風格)
 */
export function renderResourceSpriteHtml(resourceType: string, sizePx: number = 36): string {
  const key = resourceType.toLowerCase();
  const coord = RESOURCE_SPRITE_COORDS[key] || RESOURCE_SPRITE_COORDS['gold'];
  const bgX = coord.col * 33.3333;
  const bgY = coord.row * 50.0;

  return `
    <span class="resource-sprite-icon" style="
      display: inline-block;
      width: ${sizePx}px;
      height: ${sizePx}px;
      vertical-align: middle;
      border-radius: 3px;
      overflow: hidden;
      flex-shrink: 0;
      background-image: url('./assets/icons_materials_color_12_1.png');
      background-size: 400% 300%;
      background-position: ${bgX}% ${bgY}%;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
    "></span>
  `;
}

/**
 * 通用裝備圖示渲染入口 (向下相容 ShopController 等所有現有模組)
 */
export function renderEquipIcon(eq: any, sizePx: number = 38): string {
  if (!eq) return `<div style="font-size:1.6em;">🛡️</div>`;
  
  // 武器類別
  if (eq.slot === EquipmentSlot.WEAPON || !eq.slot || eq.weaponType) {
    const wType = eq.weaponType || (eq.id ? detectWeaponTypeFromId(eq.id) : 'GREATSWORD');
    return renderWeaponSpriteHtml(wType, eq.tier || 1, sizePx);
  }
  
  // 防具/飾品/盾牌
  if (eq.weaponType === 'SHIELD' || eq.weaponType === 'RUNIC_SHIELD') {
    return renderWeaponSpriteHtml(eq.weaponType, eq.tier || 1, sizePx);
  }

  // 其他插槽使用預設 Emoji 或自訂圖標
  return `<div style="font-size:1.6em; width: ${sizePx}px; height: ${sizePx}px; display: flex; align-items: center; justify-content: center;">${eq.icon || '🛡️'}</div>`;
}

function detectWeaponTypeFromId(id: string): string {
  if (id.includes('greatsword') || id.includes('claymore') || id.includes('blade')) return 'GREATSWORD';
  if (id.includes('dual') || id.includes('swords')) return 'DUAL_SWORDS';
  if (id.includes('staff') || id.includes('wand')) return 'STAFF';
  if (id.includes('scythe')) return 'SCYTHE';
  if (id.includes('magic_bow')) return 'MAGIC_BOW';
  if (id.includes('bow')) return 'BOW';
  if (id.includes('dagger')) return 'DAGGERS';
  if (id.includes('ring')) return 'MAGIC_RING';
  if (id.includes('runic_shield')) return 'RUNIC_SHIELD';
  if (id.includes('shield')) return 'SHIELD';
  if (id.includes('book') || id.includes('bible') || id.includes('holy')) return 'HOLY_BOOK';
  if (id.includes('hammer') || id.includes('mace')) return 'WARHAMMER';
  return 'GREATSWORD';
}
