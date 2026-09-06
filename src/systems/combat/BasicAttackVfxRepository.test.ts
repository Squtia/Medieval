import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BasicAttackVfxRepository, BASIC_ATTACK_STORAGE_KEY } from './BasicAttackVfxRepository';


// 標準 Node 環境 localStorage Mock 實作
const testStorage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => testStorage.has(key) ? testStorage.get(key)! : null),
  setItem: vi.fn((key: string, val: string) => { testStorage.set(key, String(val)); }),
  removeItem: vi.fn((key: string) => { testStorage.delete(key); }),
  clear: vi.fn(() => { testStorage.clear(); }),
  get length() { return testStorage.size; },
  key: vi.fn((idx: number) => Array.from(testStorage.keys())[idx] ?? null)
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

describe('BasicAttackVfxRepository (普攻特效綁定儲存庫規範測試)', () => {
  let repo: BasicAttackVfxRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = BasicAttackVfxRepository.getInstance();
    repo.resetToDefaults();
  });

  it('1. 應能正常設定並讀取武器普攻綁定，且同步持久化至 LocalStorage', () => {
    expect(repo.getBinding('GREATSWORD')).toBeUndefined();

    repo.setBinding('GREATSWORD', 'VFX_HEAVY_STRIKE');
    expect(repo.getBinding('GREATSWORD')).toBe('VFX_HEAVY_STRIKE');

    const storedRaw = localStorage.getItem(BASIC_ATTACK_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!);
    expect(stored['GREATSWORD']).toBe('VFX_HEAVY_STRIKE');
  });

  it('2. 應能刪除單一綁定並更新 LocalStorage', () => {
    repo.setBinding('BOW', 'VFX_ARROW_RAIN');
    repo.setBinding('STAFF', 'VFX_FIREBALL');

    expect(repo.getBinding('BOW')).toBe('VFX_ARROW_RAIN');
    repo.removeBinding('BOW');

    expect(repo.getBinding('BOW')).toBeUndefined();
    expect(repo.getBinding('STAFF')).toBe('VFX_FIREBALL');

    const stored = JSON.parse(localStorage.getItem(BASIC_ATTACK_STORAGE_KEY)!);
    expect(stored['BOW']).toBeUndefined();
    expect(stored['STAFF']).toBe('VFX_FIREBALL');
  });

  it('3. resetToDefaults 應清空所有綁定並移除 LocalStorage key', () => {
    repo.setBinding('SWORD', 'VFX_SLASH');
    repo.resetToDefaults();

    expect(Object.keys(repo.getAllBindings()).length).toBe(0);
    expect(localStorage.getItem(BASIC_ATTACK_STORAGE_KEY)).toBeNull();
  });

  it('4. 應依據優先層級精確解析特效 ID (武器 ➔ 職業 ➔ 攻擊型態)', () => {
    repo.setBinding('GREATSWORD', 'VFX_GIANT_SLASH');
    repo.setBinding('Mage', 'VFX_ARCANE_BLAST');
    repo.setBinding('MELEE', 'VFX_DEFAULT_SLASH');

    // (a) 精確匹配武器類型優先
    const res1 = repo.resolveVfxId({
      weaponType: 'GREATSWORD',
      baseClass: 'Mage',
      attackType: 'MELEE'
    });
    expect(res1).toBe('VFX_GIANT_SLASH');

    // (b) 無精確武器時，次級匹配基礎職業
    const res2 = repo.resolveVfxId({
      weaponType: 'DAGGER',
      baseClass: 'Mage',
      attackType: 'MELEE'
    });
    expect(res2).toBe('VFX_ARCANE_BLAST');

    // (c) 無武器與職業匹配時，匹配通用攻擊型態
    const res3 = repo.resolveVfxId({
      weaponType: 'DAGGER',
      baseClass: 'Thief',
      attackType: 'MELEE'
    });
    expect(res3).toBe('VFX_DEFAULT_SLASH');

    // (d) 完全無匹配時回傳 undefined
    const res4 = repo.resolveVfxId({
      weaponType: 'GUN',
      baseClass: 'Gunner',
      attackType: 'RANGED'
    });
    expect(res4).toBeUndefined();
  });

  it('5. 綁定異動時應正確通知訂閱監聽者', () => {
    const spy = vi.fn();
    const unsubscribe = repo.addChangeListener(spy);

    repo.setBinding('STAFF', 'VFX_ICE_SPEAR');
    expect(spy).toHaveBeenCalledTimes(1);

    repo.removeBinding('STAFF');
    expect(spy).toHaveBeenCalledTimes(2);

    unsubscribe();
    repo.setBinding('BOW', 'VFX_ARROW_RAIN');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
