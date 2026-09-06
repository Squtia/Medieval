/**
 * 🗡️ BasicAttackVfxRepository
 * 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 13 節規範：
 * 「CRUD、保存、還原只走 Repository」
 * 
 * 職責：
 * 1. 唯一管理玩家與怪物普通攻擊的特效 ID 綁定 (武器類型/職業/攻擊型態 ➔ VFX ID)
 * 2. 封裝持久化與反序列化，禁止業務層或 UI 層直接裸寫 localStorage
 * 3. 支援變更監聽與出廠預設解析 fallback
 */

export const BASIC_ATTACK_STORAGE_KEY = 'MEDIEVAL_BASIC_ATTACK_VFX_BINDINGS';

export interface BasicAttackActorContext {
  weaponType?: string;
  baseClass?: string;
  attackType?: string;
  isMagicalAttacker?: boolean;
}

export class BasicAttackVfxRepository {
  private static instance: BasicAttackVfxRepository | null = null;
  private bindings: Record<string, string> = {};
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): BasicAttackVfxRepository {
    if (!this.instance) {
      this.instance = new BasicAttackVfxRepository();
    }
    return this.instance;
  }

  /**
   * 自儲存空間載入綁定資料
   */
  public loadFromStorage(): void {
    this.bindings = {};
    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(BASIC_ATTACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          this.bindings = { ...parsed };
        }
      }
    } catch (err) {
      console.warn('[BasicAttackVfxRepository] Failed to load bindings from storage:', err);
    }
  }

  /**
   * 保存目前綁定資料至儲存空間
   */
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(BASIC_ATTACK_STORAGE_KEY, JSON.stringify(this.bindings));
    } catch (err) {
      console.error('[BasicAttackVfxRepository] Failed to save bindings to storage:', err);
    }
  }

  /**
   * 取得所有普攻綁定字典副本
   */
  public getAllBindings(): Record<string, string> {
    return { ...this.bindings };
  }

  /**
   * 查詢指定鍵 (武器類型/職業名/攻擊型態) 的專用特效 ID
   */
  public getBinding(key: string): string | undefined {
    return this.bindings[key];
  }

  /**
   * 設定一筆普攻綁定並持久化
   */
  public setBinding(key: string, vfxId: string): void {
    if (!key || !vfxId) return;
    this.bindings[key] = vfxId;
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * 移除一筆普攻綁定並持久化（恢復該鍵的預設解析）
   */
  public removeBinding(key: string): void {
    if (this.bindings[key]) {
      delete this.bindings[key];
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * 重置清空所有普攻綁定至出廠預設
   */
  public resetToDefaults(): void {
    this.bindings = {};
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BASIC_ATTACK_STORAGE_KEY);
    }
    this.notifyListeners();
  }

  /**
   * 🎯 依據攻擊者特徵 (武器、職業、攻擊型態) 解析普攻 VFX ID
   * 支援層級查找：武器精確匹配 ➔ 職業匹配 ➔ 攻擊型態匹配
   */
  public resolveVfxId(actor?: BasicAttackActorContext): string | undefined {
    if (!actor) return undefined;

    // 1. 精確匹配武器類型 (例如: GREATSWORD, BOW, STAFF, DAGGERS, SWORD_AND_SHIELD)
    if (actor.weaponType && this.bindings[actor.weaponType]) {
      return this.bindings[actor.weaponType];
    }

    // 2. 次級匹配基礎職業 (例如: Warrior, Mage, Archer, Knight, Thief, Cleric)
    if (actor.baseClass && this.bindings[actor.baseClass]) {
      return this.bindings[actor.baseClass];
    }

    // 3. 攻擊型態匹配 (例如: MELEE, RANGED, MAGIC)
    if (actor.attackType && this.bindings[actor.attackType]) {
      return this.bindings[actor.attackType];
    }

    return undefined;
  }

  /**
   * 註冊變更監聽器
   */
  public addChangeListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('[BasicAttackVfxRepository] Listener error:', e);
      }
    });
  }
}
