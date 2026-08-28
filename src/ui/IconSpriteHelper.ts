import { EquipmentSlot, WeaponType } from '../models/types';

export interface SpriteCoordConfig {
  col?: number;
  row?: number;
  bgX?: number; // 自訂 X 偏移百分比 (0~100)
  bgY?: number; // 自訂 Y 偏移百分比 (0~100)
  zoom?: number; // 縮放比例百分比 (預設 100)
  customImage?: string; // 自訂 Base64 或圖檔路徑
  customEmoji?: string; // 自訂 Emoji
}

/**
 * 🌟 全遊戲圖標統一 3 大標準尺寸級距 (Standardized Icon Design Tokens)
 */
export const ICON_SIZE = {
  SM: 32, // 緊湊行內、商店商品表格、材料消耗清單
  MD: 58, // 標準卡片、背包倉庫格子、二手貨架 (極致飽滿)
  LG: 68  // 焦點展示、角色裝備槽、鍛造大特寫、裝備更換視窗
} as const;

import defaultCustomConfig from '../data/custom_icon_config.json';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';

export const LOCAL_STORAGE_ICON_CONFIG_KEY = 'MEDIEVAL_CUSTOM_ICON_CONFIG';
export const LOCAL_STORAGE_ICON_DATASETS_KEY = 'MEDIEVAL_CUSTOM_ICON_DATASETS';

/**
 * 取得自訂圖標配置 (優先讀取 LocalStorage 即時微調，無則讀取專案磁碟 custom_icon_config.json)
 */
export function getCustomIconConfig(): Record<string, Record<string, SpriteCoordConfig>> {
  let storageConfig: any = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_ICON_CONFIG_KEY);
      if (saved) storageConfig = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('[IconSpriteHelper] 無法讀取 LocalStorage 設定:', e);
  }
  
  const fileConfig = (defaultCustomConfig || {}) as any;
  const datasets = (defaultCustomDatasets || {}) as any;

  const result: Record<string, Record<string, SpriteCoordConfig>> = {
    ...fileConfig,
    ...storageConfig,
  };

  // 動態合併所有 datasets 定義的分類
  Object.keys(datasets).forEach(catKey => {
    result[catKey] = { ...(fileConfig[catKey] || {}), ...(storageConfig[catKey] || {}) };
  });

  return result;
}

/**
 * 12 宮格武器座標預設對應表 (4 欄 × 3 列)
 */
export const WEAPON_SPRITE_COORDS: Record<string, SpriteCoordConfig> = {
  // 狂戰士 / 戰士
  GREATSWORD: { col: 0, row: 0, zoom: 100 },
  // 魔劍士
  DUAL_SWORDS: { col: 1, row: 0, zoom: 100 },
  // 大魔導士 / 法師
  STAFF: { col: 2, row: 0, zoom: 100 },
  // 死靈法師
  SCYTHE: { col: 3, row: 0, zoom: 100 },
  // 神射手 / 弓箭手
  BOW: { col: 0, row: 1, zoom: 100 },
  // 精靈使
  MAGIC_BOW: { col: 1, row: 1, zoom: 100 },
  // 暗殺者 / 盜賊
  DAGGERS: { col: 2, row: 1, zoom: 100 },
  // 詭術師
  MAGIC_RING: { col: 3, row: 1, zoom: 100 },
  // 聖騎士 / 騎士 (SWORD_AND_SHIELD / SHIELD)
  SWORD_AND_SHIELD: { col: 0, row: 2, zoom: 100 },
  SHIELD: { col: 0, row: 2, zoom: 100 },
  // 符文騎士 (RUNE_SHIELD / RUNIC_SHIELD)
  RUNE_SHIELD: { col: 1, row: 2, zoom: 100 },
  RUNIC_SHIELD: { col: 1, row: 2, zoom: 100 },
  // 大主教 / 祈禱者
  HOLY_BOOK: { col: 2, row: 2, zoom: 100 },
  // 異端拷問官 (HAMMER / WARHAMMER)
  HAMMER: { col: 3, row: 2, zoom: 100 },
  WARHAMMER: { col: 3, row: 2, zoom: 100 }
};

/**
 * 12 宮格防具座標預設對應表 (4 欄 × 3 列: CLOTH/LEATHER/HEAVY × T1~T4)
 */
export const ARMOR_SPRITE_COORDS: Record<string, SpriteCoordConfig> = {
  // 布甲 (Row 0)
  CLOTH_T1: { col: 0, row: 0, zoom: 100 },
  CLOTH_T2: { col: 1, row: 0, zoom: 100 },
  CLOTH_T3: { col: 2, row: 0, zoom: 100 },
  CLOTH_T4: { col: 3, row: 0, zoom: 100 },
  // 皮甲 (Row 1)
  LEATHER_T1: { col: 0, row: 1, zoom: 100 },
  LEATHER_T2: { col: 1, row: 1, zoom: 100 },
  LEATHER_T3: { col: 2, row: 1, zoom: 100 },
  LEATHER_T4: { col: 3, row: 1, zoom: 100 },
  // 重鎧 (Row 2)
  HEAVY_T1: { col: 0, row: 2, zoom: 100 },
  HEAVY_T2: { col: 1, row: 2, zoom: 100 },
  HEAVY_T3: { col: 2, row: 2, zoom: 100 },
  HEAVY_T4: { col: 3, row: 2, zoom: 100 },
};

/**
 * 12 宮格羊皮紙設施座標對應表 (4 欄 × 3 列)
 */
export const FACILITY_SPRITE_COORDS: Record<string, SpriteCoordConfig> = {
  tavern: { col: 0, row: 0, zoom: 100 },
  forge: { col: 1, row: 0, zoom: 100 },
  weapon: { col: 2, row: 0, zoom: 100 },
  armor: { col: 3, row: 0, zoom: 100 },
  study: { col: 0, row: 1, zoom: 100 },
  defense: { col: 1, row: 1, zoom: 100 },
  church: { col: 0, row: 1, zoom: 100 }
};

/**
 * 12 宮格彩色素材與資源座標對應表 (4 欄 × 3 列)
 */
export const RESOURCE_SPRITE_COORDS: Record<string, SpriteCoordConfig> = {
  gold: { col: 2, row: 1, zoom: 100 },
  wood: { col: 3, row: 1, zoom: 100 },
  stone: { col: 0, row: 2, zoom: 100 },
  iron: { col: 1, row: 2, zoom: 100 },
  food: { col: 2, row: 2, zoom: 100 },
  essence: { col: 3, row: 2, zoom: 100 }
};

/**
 * 預設 Emoji 對照表 (作為未設定獨立圖標時的安全 fallback)
 */
export const DEFAULT_RESOURCE_EMOJIS: Record<string, string> = {
  gold: '🪙',
  wood: '🌲',
  stone: '🧱',
  iron: '🔗',
  food: '🌾',
  essence: '✨',
  cotton: '🌿',
  tg_cotton: '🌿',
  hide: '🦬',
  tg_hide: '🦬',
  cloth: '🪢',
  mat_cloth: '🪢',
  leather: '📜',
  mat_leather: '📜'
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
  const safeTier = Math.min(4, Math.max(1, tier));
  const customConfig = getCustomIconConfig()?.[`weapons_t${safeTier}`]?.[normalizedType] 
    || getCustomIconConfig()?.weapons?.[normalizedType];
  const coord = customConfig || WEAPON_SPRITE_COORDS[normalizedType] || WEAPON_SPRITE_COORDS['GREATSWORD'];
  
  const quality = getTierQualityStyle(tier);
  const borderStyle = tier > 1 
    ? `border: 1.5px solid ${quality.borderColor}; box-shadow: 0 0 8px ${quality.glowColor};` 
    : `border: 1px solid rgba(255,255,255,0.15);`;

  const tierBadge = tier > 1 
    ? `<span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; font-weight: bold; color: ${quality.borderColor}; text-shadow: 0 1px 2px #000, 0 0 2px #000; line-height: 1;">T${tier}</span>` 
    : '';

  // 若有自訂單張圖片 (Base64 或自訂路徑)
  if (coord.customImage) {
    return `
      <div class="weapon-sprite-icon" style="
        width: ${sizePx}px;
        height: ${sizePx}px;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
        ${borderStyle}
        background-image: url('${coord.customImage}');
        background-size: cover;
        background-position: center;
      ">
        ${tierBadge}
      </div>
    `;
  }

  // 4 欄 x 3 列計算背景偏移
  const zoom = coord.zoom || 100;
  const col = coord.col ?? 0;
  const row = coord.row ?? 0;
  const bgX = coord.bgX !== undefined ? coord.bgX : (col * 33.3333);
  const bgY = coord.bgY !== undefined ? coord.bgY : (row * 50.0);
  const bgSizeX = 400 * (zoom / 100);
  const bgSizeY = 300 * (zoom / 100);

  // 根據階級對應不同的 12 宮格大圖
  let spriteSheetPath = 'assets/icons_weapons_12.jpg';
  if (safeTier === 2) spriteSheetPath = 'assets/icons_weapons_t2_12.jpg';
  else if (safeTier === 3) spriteSheetPath = 'assets/icons_weapons_t3_12.jpg';
  else if (safeTier === 4) spriteSheetPath = 'assets/icons_weapons_t4_12.jpg';

  const resolvedSpriteUrl = resolveSpriteAssetUrl(spriteSheetPath);

  return `
    <div class="weapon-sprite-icon" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      position: relative;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      ${borderStyle}
      background-image: url('${resolvedSpriteUrl}');
      background-size: ${bgSizeX}% ${bgSizeY}%;
      background-position: ${bgX}% ${bgY}%;
    ">
      ${tierBadge}
    </div>
  `;
}

/**
 * 渲染設施 Sprite 圖標 HTML (羊皮紙木刻風格)
 */
export function renderFacilitySpriteHtml(facilityType: string, sizePx: number = 44): string {
  const key = facilityType.toLowerCase();
  const customConfig = getCustomIconConfig()?.facilities?.[key];
  const coord = customConfig || FACILITY_SPRITE_COORDS[key] || FACILITY_SPRITE_COORDS['tavern'];

  if (coord.customImage) {
    return `
      <div class="facility-sprite-icon" style="
        width: ${sizePx}px;
        height: ${sizePx}px;
        border-radius: 6px;
        overflow: hidden;
        flex-shrink: 0;
        border: 1px solid rgba(139, 69, 19, 0.4);
        box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        background-image: url('${coord.customImage}');
        background-size: cover;
        background-position: center;
      "></div>
    `;
  }

  const zoom = coord.zoom || 100;
  const col = coord.col ?? 0;
  const row = coord.row ?? 0;
  const bgX = coord.bgX !== undefined ? coord.bgX : (col * 33.3333);
  const bgY = coord.bgY !== undefined ? coord.bgY : (row * 50.0);
  const bgSizeX = 400 * (zoom / 100);
  const bgSizeY = 300 * (zoom / 100);
  const resolvedSpriteUrl = resolveSpriteAssetUrl('assets/icons_facilities_parchment_12.jpg');

  return `
    <div class="facility-sprite-icon" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      border-radius: 6px;
      overflow: hidden;
      flex-shrink: 0;
      border: 1px solid rgba(139, 69, 19, 0.4);
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
      background-image: url('${resolvedSpriteUrl}');
      background-size: ${bgSizeX}% ${bgSizeY}%;
      background-position: ${bgX}% ${bgY}%;
    "></div>
  `;
}

/**
 * 渲染素材/資源 Sprite 圖標 HTML
 */
export function renderResourceSpriteHtml(resourceType: string, sizePx: number = 36): string {
  const key = resourceType.toLowerCase();
  const customConfig = getCustomIconConfig()?.materials?.[key];
  const coord = customConfig || RESOURCE_SPRITE_COORDS[key];

  // 若有自訂圖片 (如自行上傳的棉麻/生皮圖)
  if (coord?.customImage) {
    return `
      <span class="resource-sprite-icon" style="
        display: inline-block;
        width: ${sizePx}px;
        height: ${sizePx}px;
        vertical-align: middle;
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
        background-image: url('${coord.customImage}');
        background-size: cover;
        background-position: center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
      "></span>
    `;
  }

  // 若為預設 6 大資源且在 Sprite 表內
  if (coord && (coord.col !== undefined || coord.bgX !== undefined)) {
    const zoom = coord.zoom || 100;
    const col = coord.col ?? 0;
    const row = coord.row ?? 0;
    const bgX = coord.bgX !== undefined ? coord.bgX : (col * 33.3333);
    const bgY = coord.bgY !== undefined ? coord.bgY : (row * 50.0);
    const bgSizeX = 400 * (zoom / 100);
    const bgSizeY = 300 * (zoom / 100);
    const resolvedSpriteUrl = resolveSpriteAssetUrl('assets/icons_materials_color_12_1.png');

    return `
      <span class="resource-sprite-icon" style="
        display: inline-block;
        width: ${sizePx}px;
        height: ${sizePx}px;
        vertical-align: middle;
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
        background-image: url('${resolvedSpriteUrl}');
        background-size: ${bgSizeX}% ${bgSizeY}%;
        background-position: ${bgX}% ${bgY}%;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));
      "></span>
    `;
  }

  // 安全 fallback: Emoji
  const emoji = coord?.customEmoji || DEFAULT_RESOURCE_EMOJIS[key] || '📦';
  return `<span class="resource-icon-emoji" style="display:inline-block; font-size: ${Math.round(sizePx * 0.75)}px; line-height: 1; vertical-align: middle;">${emoji}</span>`;
}

/**
 * 通用資源渲染入口 (支援 cotton, hide, gold 等所有資源與素材)
 */
export function renderResourceIcon(resourceKey: string, sizePx: number = 20): string {
  return renderResourceSpriteHtml(resourceKey, sizePx);
}

/**
 * 取得傭兵頭像的 CSS Background Style (支援 Icon Studio 自訂微調與獨立立繪覆寫)
 */
export function getAvatarSpriteStyle(
  gender: 'MALE' | 'FEMALE' | string = 'MALE', 
  avatarIndex: number = 0,
  isGuardian: boolean = false
): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  // 🌟 誓約守衛專屬 5x5 大圖集 (男守衛 10 款: Row 0~1，女守衛 10 款: Row 3~4)
  if (isGuardian || gender === 'GUARDIAN_MALE' || gender === 'GUARDIAN_FEMALE') {
    const isFem = gender === 'FEMALE' || gender === 'GUARDIAN_FEMALE';
    const catKey = isFem ? 'guardian_female' : 'guardian_male';
    const safeIdx = Math.max(0, Math.min(9, avatarIndex));
    const itemKey = `guardian_${isFem ? 'f' : 'm'}_${safeIdx}`;
    const customConfig = getCustomIconConfig()?.[catKey]?.[itemKey];

    if (customConfig?.customImage) {
      return {
        backgroundImage: `url('${customConfig.customImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }

    const defaultRow = isFem ? (3 + Math.floor(safeIdx / 5)) : Math.floor(safeIdx / 5);
    const zoom = customConfig?.zoom || 100;
    const col = customConfig?.col ?? (safeIdx % 5);
    const row = customConfig?.row ?? defaultRow;
    const bgX = customConfig?.bgX !== undefined ? customConfig.bgX : (col * 25);
    const bgY = customConfig?.bgY !== undefined ? customConfig.bgY : (row * 25);
    const bgSizeX = 500 * (zoom / 100);
    const bgSizeY = 500 * (zoom / 100);
    const resolvedSpriteUrl = resolveSpriteAssetUrl('assets/avatars_guardians.jpg');

    return {
      backgroundImage: `url('${resolvedSpriteUrl}')`,
      backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
      backgroundPosition: `${bgX}% ${bgY}%`
    };
  }

  // 既有一般傭兵 5x5 頭像
  const catKey = gender === 'FEMALE' ? 'avatars_female' : 'avatars_male';
  const itemKey = `${gender === 'FEMALE' ? 'female' : 'male'}_${avatarIndex}`;
  const customConfig = getCustomIconConfig()?.[catKey]?.[itemKey];
  
  if (customConfig?.customImage) {
    return {
      backgroundImage: `url('${customConfig.customImage}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  }

  const defaultImg = gender === 'FEMALE' ? 'assets/avatars_female.jpg' : 'assets/avatars_male.jpg';
  const zoom = customConfig?.zoom || 100;
  const col = customConfig?.col ?? (avatarIndex % 5);
  const row = customConfig?.row ?? Math.floor(avatarIndex / 5);
  const bgX = customConfig?.bgX !== undefined ? customConfig.bgX : (col * 25);
  const bgY = customConfig?.bgY !== undefined ? customConfig.bgY : (row * 25);
  const bgSizeX = 500 * (zoom / 100);
  const bgSizeY = 500 * (zoom / 100);
  const resolvedSpriteUrl = resolveSpriteAssetUrl(defaultImg);

  return {
    backgroundImage: `url('${resolvedSpriteUrl}')`,
    backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
    backgroundPosition: `${bgX}% ${bgY}%`
  };
}

/**
 * 渲染傭兵頭像 HTML
 */
export function renderAvatarSpriteHtml(
  gender: 'MALE' | 'FEMALE' | string = 'MALE', 
  avatarIndex: number = 0, 
  sizePx: number = 40, 
  borderStyle: string = '',
  isGuardian: boolean = false
): string {
  const style = getAvatarSpriteStyle(gender, avatarIndex, isGuardian);
  return `
    <div class="adv-avatar-sprite-rendered" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      ${borderStyle}
      background-image: ${style.backgroundImage};
      background-size: ${style.backgroundSize};
      background-position: ${style.backgroundPosition};
    "></div>
  `;
}

/**
 * 渲染防具 Sprite 圖標 HTML (icons_armors_12.jpg)
 */
export function renderArmorSpriteHtml(armorType: string | undefined, tier: number = 1, sizePx: number = 38): string {
  const normType = (armorType || 'CLOTH').toUpperCase();
  const key = `${normType}_T${Math.min(4, Math.max(1, tier))}`;
  const customConfig = getCustomIconConfig()?.armors?.[key];
  const coord = customConfig || ARMOR_SPRITE_COORDS[key] || ARMOR_SPRITE_COORDS['CLOTH_T1'];

  const quality = getTierQualityStyle(tier);
  const borderStyle = tier > 1 
    ? `border: 1.5px solid ${quality.borderColor}; box-shadow: 0 0 8px ${quality.glowColor};` 
    : `border: 1px solid rgba(255,255,255,0.15);`;

  const tierBadge = tier > 1 
    ? `<span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; font-weight: bold; color: ${quality.borderColor}; text-shadow: 0 1px 2px #000, 0 0 2px #000; line-height: 1;">T${tier}</span>` 
    : '';

  if (coord.customImage) {
    return `
      <div class="armor-sprite-icon" style="
        width: ${sizePx}px;
        height: ${sizePx}px;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
        ${borderStyle}
        background-image: url('${coord.customImage}');
        background-size: cover;
        background-position: center;
      ">
        ${tierBadge}
      </div>
    `;
  }

  const zoom = coord.zoom || 100;
  const col = coord.col ?? (tier - 1);
  const row = coord.row ?? (normType === 'LEATHER' ? 1 : (normType === 'HEAVY' ? 2 : 0));
  const bgX = coord.bgX !== undefined ? coord.bgX : (col * 33.3333);
  const bgY = coord.bgY !== undefined ? coord.bgY : (row * 50.0);
  const bgSizeX = 400 * (zoom / 100);
  const bgSizeY = 300 * (zoom / 100);
  const resolvedSpriteUrl = resolveSpriteAssetUrl('assets/icons_armors_12.jpg');

  return `
    <div class="armor-sprite-icon" style="
      width: ${sizePx}px;
      height: ${sizePx}px;
      position: relative;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      ${borderStyle}
      background-image: url('${resolvedSpriteUrl}');
      background-size: ${bgSizeX}% ${bgSizeY}%;
      background-position: ${bgX}% ${bgY}%;
    ">
      ${tierBadge}
    </div>
  `;
}

/**
 * 通用裝備圖示渲染入口 (向下相容 ShopController 等所有現有模組)
 */
export function renderEquipIcon(eq: any, sizePx: number = 38): string {
  if (!eq) return `<div style="font-size:1.6em;">🛡️</div>`;
  
  // 🌟 0. 優先讀取自訂圖標 (支援圖標工坊圖集 category:itemId 或自訂圖片/Emoji，排除舊版 Emoji 佔位符)
  if (eq.icon && eq.icon !== '🗡️' && eq.icon !== '🛡️' && eq.icon !== '📦') {
    const tier = eq.tier || (eq.id && eq.id.includes('_t4') ? 4 : (eq.id && eq.id.includes('_t3') ? 3 : (eq.id && eq.id.includes('_t2') ? 2 : 1)));
    const quality = getTierQualityStyle(tier);
    const borderStyle = tier > 1 
      ? `border: 1.5px solid ${quality.borderColor}; box-shadow: 0 0 8px ${quality.glowColor};` 
      : `border: 1px solid rgba(255,255,255,0.15);`;
    const tierBadge = tier > 1 
      ? `<span style="position: absolute; bottom: 1px; right: 2px; font-size: 9px; font-weight: bold; color: ${quality.borderColor}; text-shadow: 0 1px 2px #000, 0 0 2px #000; line-height: 1; pointer-events: none;">T${tier}</span>` 
      : '';

    return `
      <div class="equip-custom-icon-wrap" style="
        width: ${sizePx}px;
        height: ${sizePx}px;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #0d1117;
        ${borderStyle}
      ">
        ${renderUniversalIcon(eq.icon, sizePx)}
        ${tierBadge}
      </div>
    `;
  }

  // 1. 武器類別
  if (eq.slot === EquipmentSlot.WEAPON || (!eq.slot && eq.weaponType)) {
    const wType = eq.weaponType || (eq.id ? detectWeaponTypeFromId(eq.id) : 'GREATSWORD');
    return renderWeaponSpriteHtml(wType, eq.tier || 1, sizePx);
  }
  
  // 2. 盾牌
  if (eq.weaponType === 'SWORD_AND_SHIELD' || eq.weaponType === 'SHIELD' || eq.weaponType === 'RUNE_SHIELD' || eq.weaponType === 'RUNIC_SHIELD') {
    return renderWeaponSpriteHtml(eq.weaponType, eq.tier || 1, sizePx);
  }

  // 3. 防具類別 (布甲、皮甲、重鎧 T1~T4)
  if (eq.slot === EquipmentSlot.ARMOR || eq.armorType) {
    const aType = eq.armorType || detectArmorTypeFromId(eq.id || '');
    return renderArmorSpriteHtml(aType, eq.tier || 1, sizePx);
  }

  // 其他插槽使用預設 Emoji
  return `<div style="font-size:1.6em; width: ${sizePx}px; height: ${sizePx}px; display: flex; align-items: center; justify-content: center;">🛡️</div>`;
}

export function detectWeaponTypeFromId(id: string): string {
  if (id.includes('greatsword') || id.includes('claymore') || id.includes('blade')) return 'GREATSWORD';
  if (id.includes('dual') || id.includes('swords')) return 'DUAL_SWORDS';
  if (id.includes('staff') || id.includes('wand')) return 'STAFF';
  if (id.includes('scythe')) return 'SCYTHE';
  if (id.includes('magic_bow')) return 'MAGIC_BOW';
  if (id.includes('bow')) return 'BOW';
  if (id.includes('dagger')) return 'DAGGERS';
  if (id.includes('ring')) return 'MAGIC_RING';
  if (id.includes('runic_shield') || id.includes('rune_shield')) return 'RUNE_SHIELD';
  if (id.includes('shield_sword') || id.includes('sword_shield') || id.includes('shield')) return 'SWORD_AND_SHIELD';
  if (id.includes('book') || id.includes('bible') || id.includes('holy')) return 'HOLY_BOOK';
  if (id.includes('hammer') || id.includes('mace')) return 'HAMMER';
  return 'GREATSWORD';
}

export function detectArmorTypeFromId(id: string): string {
  if (id.includes('cloth') || id.includes('robe') || id.includes('silk')) return 'CLOTH';
  if (id.includes('leather') || id.includes('scout') || id.includes('hunter') || id.includes('assassin')) return 'LEATHER';
  if (id.includes('heavy') || id.includes('plate') || id.includes('mail') || id.includes('cuirass')) return 'HEAVY';
  return 'CLOTH';
}

/**
 * 解析圖片資源路徑，自動適配根目錄、子目錄 (tools/) 與 Vite Base
 */
export function resolveSpriteAssetUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  let clean = rawUrl.replace(/^\.\.\/public\//, '').replace(/^\/public\//, '').replace(/^public\//, '');
  if (clean.startsWith('/')) clean = clean.substring(1);
  if (clean.startsWith('./')) clean = clean.substring(2);

  const isSubDir = typeof window !== 'undefined' && window.location && window.location.pathname.includes('/tools/');
  if (isSubDir) return '../' + clean;

  const base = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.BASE_URL) ? (import.meta as any).env.BASE_URL : './';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}${clean}`;
}

/**
 * 🌟 全域通用圖標渲染函數 (Universal Icon Renderer)
 * 支援格式：
 * 1. "categoryKey:itemId" (例如 "npc_man:npc_man_0", "monsters:goblin", "weapons:GREATSWORD")
 * 2. "itemId" (自動在所有已註冊圖集中搜尋符合的 ID)
 */
export function renderUniversalIcon(identifier: string, sizePx: number = ICON_SIZE.MD, customClass: string = ''): string {
  if (!identifier) return `<div class="${customClass}" style="width:${sizePx}px; height:${sizePx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em;">🛡️</div>`;

  const allDatasets = (defaultCustomDatasets || {}) as Record<string, any>;
  const customConfigs = getCustomIconConfig();

  let catKey = '';
  let itemId = identifier;

  if (identifier.includes(':')) {
    const parts = identifier.split(':');
    catKey = parts[0];
    itemId = parts[1];
  } else {
    // 自動尋找所屬分類
    for (const [k, cat] of Object.entries(allDatasets)) {
      if (cat.items && cat.items.some((i: any) => i.id === identifier)) {
        catKey = k;
        break;
      }
    }
  }

  const catData = allDatasets[catKey];
  if (!catData) {
    // Fallback: 如果是 Emoji 或是未知項目
    return `<div class="${customClass}" style="width:${sizePx}px; height:${sizePx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em;">${identifier.length <= 4 ? identifier : '📦'}</div>`;
  }

  const itemDef = catData.items?.find((i: any) => i.id === itemId) || { col: 0, row: 0 };
  const config = customConfigs[catKey]?.[itemId] || {};

  if (config.customEmoji) {
    return `<div class="${customClass}" style="width:${sizePx}px; height:${sizePx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em;">${config.customEmoji}</div>`;
  }

  const cols = catData.cols || 4;
  const rows = catData.rows || 3;
  const defBgX = cols > 1 ? (config.col ?? itemDef.col ?? 0) * (100 / (cols - 1)) : 0;
  const defBgY = rows > 1 ? (config.row ?? itemDef.row ?? 0) * (100 / (rows - 1)) : 0;

  const bgX = config.bgX !== undefined ? config.bgX : defBgX;
  const bgY = config.bgY !== undefined ? config.bgY : defBgY;
  const zoom = config.zoom || 100;

  const bgSizeX = cols * 100 * (zoom / 100);
  const bgSizeY = rows * 100 * (zoom / 100);

  const rawSpriteUrl = config.customImage || catData.spriteUrl || '';
  const spriteUrl = resolveSpriteAssetUrl(rawSpriteUrl);

  return `<div class="universal-icon-sprite ${customClass}" style="
    width: ${sizePx}px;
    height: ${sizePx}px;
    background-image: url('${spriteUrl}');
    background-size: ${bgSizeX.toFixed(1)}% ${bgSizeY.toFixed(1)}%;
    background-position: ${bgX.toFixed(2)}% ${bgY.toFixed(2)}%;
    background-repeat: no-repeat;
    border-radius: 6px;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    flex-shrink: 0;
    display: inline-block;
  "></div>`;
}

/**
 * 🌟 通用直立肖像渲染器 (Universal Portrait Renderer)
 * 專為 NPC、英雄等直立肖像設計，鎖定真實長寬比 (1:1.853 或自訂比例)，絕不壓扁、零黑邊
 */
export function renderUniversalPortrait(
  identifier: string,
  widthPx: number = 44,
  customClass: string = '',
  aspectRatio: number = 1.853
): string {
  if (!identifier) {
    const heightPx = Math.round(widthPx * aspectRatio);
    return `<div class="${customClass}" style="width:${widthPx}px; height:${heightPx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em; background:rgba(0,0,0,0.6); border-radius:4px;">👤</div>`;
  }

  const heightPx = Math.round(widthPx * aspectRatio);
  const allDatasets = (defaultCustomDatasets || {}) as Record<string, any>;
  const customConfigs = getCustomIconConfig();

  let catKey = '';
  let itemId = identifier;

  if (identifier.includes(':')) {
    const parts = identifier.split(':');
    catKey = parts[0];
    itemId = parts[1];
  } else {
    for (const [k, cat] of Object.entries(allDatasets)) {
      if (cat.items && cat.items.some((i: any) => i.id === identifier)) {
        catKey = k;
        break;
      }
    }
  }

  const catData = allDatasets[catKey];
  if (!catData) {
    return `<div class="${customClass}" style="width:${widthPx}px; height:${heightPx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em; background:rgba(0,0,0,0.6); border-radius:4px;">${identifier.length <= 4 ? identifier : '👤'}</div>`;
  }

  const itemDef = catData.items?.find((i: any) => i.id === itemId) || { col: 0, row: 0 };
  const config = customConfigs[catKey]?.[itemId] || {};

  if (config.customEmoji) {
    return `<div class="${customClass}" style="width:${widthPx}px; height:${heightPx}px; display:flex; align-items:center; justify-content:center; font-size:1.4em; background:rgba(0,0,0,0.6); border-radius:4px;">${config.customEmoji}</div>`;
  }

  const cols = catData.cols || 5;
  const rows = catData.rows || 1;
  const defBgX = cols > 1 ? (config.col ?? itemDef.col ?? 0) * (100 / (cols - 1)) : 0;
  const defBgY = rows > 1 ? (config.row ?? itemDef.row ?? 0) * (100 / (rows - 1)) : 0;

  const bgX = config.bgX !== undefined ? config.bgX : defBgX;
  const bgY = config.bgY !== undefined ? config.bgY : defBgY;
  const zoom = config.zoom || 100;

  const bgSizeX = cols * 100 * (zoom / 100);
  const bgSizeY = rows * 100 * (zoom / 100);

  const rawSpriteUrl = config.customImage || catData.spriteUrl || '';
  const spriteUrl = resolveSpriteAssetUrl(rawSpriteUrl);

  return `<div class="universal-portrait-sprite ${customClass}" style="
    width: ${widthPx}px;
    height: ${heightPx}px;
    background-image: url('${spriteUrl}');
    background-size: ${bgSizeX.toFixed(1)}% ${bgSizeY.toFixed(1)}%;
    background-position: ${bgX.toFixed(2)}% ${bgY.toFixed(2)}%;
    background-repeat: no-repeat;
    border-radius: 4px;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    flex-shrink: 0;
    display: inline-block;
  "></div>`;
}

