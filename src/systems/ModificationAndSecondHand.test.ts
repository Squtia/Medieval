import { describe, it, expect } from 'vitest';
import { DataStore } from './DataStore';
import { Territory } from '../models/Territory';
import { Adventurer } from '../models/Adventurer';
import { GameState } from '../core/GameState';
import { EquipmentGenerator } from './EquipmentGenerator';
import { EquipmentSlot, WeaponType, Equipment, ElementType, DamageType, NodeLevel } from '../models/types';
import { CombatSystem } from './CombatSystem';
import { calculateSkillDamage } from '../utils/CombatMath';
import { CombatParticipant } from '../models/Combat';
import { TaskType, DispatchTask, TradePhase } from '../models/DispatchTask';
import { DispatchSystem } from './DispatchSystem';

describe('Modification Workshop & Second-Hand Shop Systems', () => {
  it('loads modification recipes with valid properties', () => {
    const recipes = DataStore.ModificationRecipeDB;
    expect(recipes.length).toBeGreaterThanOrEqual(5);

    recipes.forEach(rec => {
      expect(rec.id).toBeDefined();
      expect(rec.name).toBeDefined();
      expect(rec.goldCost).toBeGreaterThan(0);
      expect(rec.targetSlots).toBeDefined();
      if (rec.requiredMaterials) {
        for (const [matId, amount] of Object.entries(rec.requiredMaterials)) {
          expect(amount).toBeGreaterThan(0);
          expect(DataStore.MaterialDB[matId]).toBeDefined();
        }
      }
    });
  });

  it('loads second-hand shop accessories and registers them in EquipmentDB', () => {
    const shopData = DataStore.SecondHandShopDB;
    expect(shopData.accessories.length).toBeGreaterThanOrEqual(4);

    shopData.accessories.forEach(acc => {
      expect(acc.id).toBeDefined();
      expect(acc.name).toBeDefined();
      expect(acc.basePrice).toBeGreaterThan(0);
      expect(acc.slot).toBe(EquipmentSlot.ACCESSORY);

      const template = DataStore.getEquipmentTemplate(acc.id);
      expect(template).not.toBeNull();
      expect(template?.name).toBe(acc.name);
    });
  });

  it('correctly calculates pawn price for second-hand items', () => {
    const mult = DataStore.SecondHandShopDB.resaleMultiplier || 0.5;
    const testEq: Equipment = {
      uuid: 'test_eq_pawn',
      id: 'wpn_iron_greatsword',
      name: '鐵大劍',
      slot: EquipmentSlot.WEAPON,
      weaponType: WeaponType.GREATSWORD,
      tier: 1,
      enhancementLevel: 0,
      baseCombatEffects: { patk: 12 },
      combatEffects: { patk: 12 },
      effects: {},
      requirements: {}
    };

    const baseVal = DataStore.EquipmentPriceDB[testEq.id] || 120;
    const expectedPrice = Math.max(10, Math.floor(baseVal * mult));
    expect(expectedPrice).toBeGreaterThan(0);
  });

  it('generates accessory and stores in warehouse', () => {
    const territory = new Territory('測試領地');
    territory.gold = 2000;
    const accDef = DataStore.SecondHandShopDB.accessories[0];

    territory.gold -= accDef.basePrice;
    const newEq = EquipmentGenerator.generate(accDef.id);
    expect(newEq).not.toBeNull();
    if (newEq) {
      territory.addEquipmentToWarehouse(newEq);
    }

    expect(territory.gold).toBe(2000 - accDef.basePrice);
    expect(territory.warehouse.some(e => e.id === accDef.id)).toBe(true);
  });

  it('directly modifies and enhances equipped weapon on adventurer without un-equipping', () => {
    const territory = new Territory('測試領地');
    territory.gold = 5000;
    territory.materials['mat_whetstone'] = 10;
    territory.materials['mat_iron_ingot'] = 10;

    const adv = new Adventurer('adv_test_mod', '亞瑟', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE);
    GameState.adventurers = [adv];
    const weapon = EquipmentGenerator.generate('wpn_iron_greatsword');
    expect(weapon).not.toBeNull();
    if (weapon) {
      adv.equip(weapon);
    }

    const initialPower = adv.getPower();
    const equippedWeapon = adv.equipment[EquipmentSlot.WEAPON];
    expect(equippedWeapon).toBeDefined();
    const initialStr = equippedWeapon?.effects?.str || 0;

    // 1. 模擬改造工藝：鋒刃精磨 (+1 STR, +2 PATK)
    const rec = DataStore.ModificationRecipeDB.find(r => r.id === 'mod_sharpen_str')!;
    territory.gold -= rec.goldCost;
    equippedWeapon!.effects = { ...equippedWeapon!.effects, str: (initialStr + 1) };
    equippedWeapon!.combatEffects = { ...equippedWeapon!.combatEffects, patk: ((equippedWeapon!.combatEffects?.patk || 0) + 2) };
    (equippedWeapon as any).modCount = 1;

    expect(adv.equipment[EquipmentSlot.WEAPON]?.effects?.str).toBe(initialStr + 1);
    expect(adv.getPower()).toBeGreaterThan(initialPower);
  });

  it('assigns adventurer combat element from equipped armor instead of weapon', () => {
    const adv = new Adventurer('adv_elem_test', '艾蓮娜', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE);
    GameState.adventurers = [adv];

    const weapon = EquipmentGenerator.generate('wpn_iron_greatsword');
    if (weapon) {
      weapon.element = ElementType.FIRE;
      adv.equipment[EquipmentSlot.WEAPON] = weapon;
    }

    const armor = EquipmentGenerator.generate('arm_heavy_t1');
    if (armor) {
      armor.element = ElementType.ICE;
      adv.equipment[EquipmentSlot.ARMOR] = armor;
    }

    expect(adv.equipment[EquipmentSlot.WEAPON]?.element).toBe(ElementType.FIRE);
    expect(adv.equipment[EquipmentSlot.ARMOR]?.element).toBe(ElementType.ICE);

    // 驗證戰鬥公式攻防分離：
    // 傭兵：火武器 (atkElement: FIRE), 冰防具 (defElement: ICE)
    const playerUnit: CombatParticipant = {
      id: adv.id,
      name: adv.name,
      isPlayer: true,
      row: 'FRONT',
      maxHp: 200,
      currentHp: 200,
      atkElement: ElementType.FIRE,
      defElement: ElementType.ICE,
      stats: { hp: 200, mp: 50, patk: 50, matk: 10, pdef: 10, mdef: 10, hit: 90, evade: 10, speed: 10, critRate: 0, critDmg: 150, atk: 50, def: 10 },
      statusEffects: []
    };

    // 雷屬性魔物 (atkElement: LIGHTNING, defElement: LIGHTNING)
    const lightningMonster: CombatParticipant = {
      id: 'monster_lightning',
      name: '雷霆幼龍',
      isPlayer: false,
      row: 'FRONT',
      maxHp: 200,
      currentHp: 200,
      atkElement: ElementType.LIGHTNING,
      defElement: ElementType.LIGHTNING,
      stats: { hp: 200, mp: 50, patk: 50, matk: 10, pdef: 10, mdef: 10, hit: 90, evade: 10, speed: 10, critRate: 0, critDmg: 150, atk: 50, def: 10 },
      statusEffects: []
    };

    // 1. 傭兵(火武器) 攻擊 雷怪(雷本體) ➔ 火剋雷 1.25x！
    const normalDmg = calculateSkillDamage(playerUnit, playerUnit, 50, DamageType.PHYSICAL, false, 0); // 同屬性基準
    const counterDmg = calculateSkillDamage(playerUnit, lightningMonster, 50, DamageType.PHYSICAL, false, 0); // 火打雷
    expect(counterDmg.damage).toBeGreaterThan(normalDmg.damage);

    // 2. 雷怪(雷攻擊) 攻擊 傭兵(冰防具) ➔ 雷剋冰 1.25x！
    const monsterToPlayer = calculateSkillDamage(lightningMonster, playerUnit, 50, DamageType.PHYSICAL, false, 0);
    expect(monsterToPlayer.damage).toBeGreaterThan(normalDmg.damage);
  });

  it('supports single-target caravan trade outbound cargo and destination buy', () => {
    const territory = new Territory('貿易領地');
    territory.gold = 1000;
    territory.tradeInventory = { tg_timber: 20 };

    const dispatchSys = new DispatchSystem(territory);
    const adv = new Adventurer('adv_trader', '赫爾墨斯', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE);
    GameState.adventurers = [adv];

    // 模擬目標城鎮
    const targetNode = {
      id: 'town_target',
      name: '目標城鎮',
      nodeLevel: NodeLevel.TOWN,
      x: 10,
      y: 10,
      marketData: {
        goods: [
          { goodId: 'tg_timber', buyPrice: 20, sellPrice: 15, stock: 50 },
          { goodId: 'tg_spice', buyPrice: 80, sellPrice: 60, stock: 30 }
        ]
      }
    } as any;

    // 建立單線跑商任務 (載運 10 原木去賣，並用 300 金幣採購香料)
    const task = new DispatchTask('單線商隊 (目標城鎮)', TaskType.TRADE, 1, 0, 0, 0, 0);
    task.tradeRouteNodeIds = ['town_target'];
    task.tradeItineraryNodeIds = ['town_target'];
    task.currentLegIndex = 0;
    task.tradePhase = TradePhase.OUTBOUND;
    task.caravanGold = 300;
    task.initialCaravanGold = 300;
    task.caravanCargo = { tg_timber: 10 };
    task.tradeInstructions = [{
      nodeId: 'town_target',
      buy: [{ goodId: 'tg_spice', maxAmount: 3 }],
      sell: ['tg_timber']
    }];

    dispatchSys.dispatchAdventurers([adv], task);
    expect(dispatchSys.getActiveMissions().length).toBe(1);
  });

  it('supports civic facility upgrades, multipliers and realtime prosperity calculation', () => {
    const terr = new Territory('測試領地');
    terr.workers = { FARMER: 10, UNASSIGNED: 5 }; // 總人口 15

    // 初始設施 Lv.1
    expect(terr.getFacilityLevel('farmland')).toBe(1);
    expect(terr.getFacilityMultiplier('farmland')).toBe(1.0);

    // 升級農田至 Lv.2
    terr.farmlandLevel = 2;
    expect(terr.getFacilityLevel('farmland')).toBe(2);
    expect(terr.getFacilityMultiplier('farmland')).toBe(1.5);

    // 升級採石場至 Lv.3
    terr.quarryLevel = 3;
    expect(terr.getFacilityLevel('quarry')).toBe(3);
    expect(terr.getFacilityMultiplier('quarry')).toBe(2.0);

    // 升級花費檢查
    const costLvl2 = terr.getFacilityUpgradeCost('farmland', 2);
    expect(costLvl2.gold).toBe(100);

    // 即時繁榮度計算: 人口(15) + 建築分 + 道路(2條=50) + 附庸(1個=100)
    const prosperity = terr.getRealtimeProsperity(2, 1, false);
    expect(prosperity).toBeGreaterThan(15 + 50 + 100);
  });
});
