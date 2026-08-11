import { Adventurer } from '../../models/Adventurer';
import { GambitConditionType, GAMBIT_CONDITION_LABELS } from '../../models/Gambit';
import { getAdventurerSkillInfo } from '../../data/SkillData';
import { PartyModalController } from './PartyModalController';
import { StatusEffectType } from '../../models/Combat';

export class GambitModalController {
  private static instance: GambitModalController;
  private currentAdv: Adventurer | null = null;
  private currentIndex: number = -1;

  public static getInstance() {
    if (!this.instance) this.instance = new GambitModalController();
    return this.instance;
  }

  constructor() {
    this.bindEvents();
  }

  private bindEvents() {
    const btnClose = document.getElementById('btn-close-gambit-edit');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    const btnSave = document.getElementById('btn-save-gambit');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.save());
    }

    const conditionSelect = document.getElementById('gambit-condition-select') as HTMLSelectElement;
    if (conditionSelect) {
      conditionSelect.addEventListener('change', () => this.updateUIBasedOnCondition());
    }

    const actionSelect = document.getElementById('gambit-action-select') as HTMLSelectElement;
    if (actionSelect) {
      actionSelect.addEventListener('change', () => this.checkMeleeWarning());
    }
  }

  public open(adv: Adventurer, index: number) {
    this.currentAdv = adv;
    this.currentIndex = index;

    const modal = document.getElementById('modal-gambit-edit');
    if (!modal) return;
    
    // Ensure the gambit exists
    if (!adv.gambits) adv.gambits = [];
    while (adv.gambits.length <= index) {
      adv.gambits.push({
        isActive: false,
        conditionType: GambitConditionType.ALWAYS,
        actionSkillId: 'DEFAULT_ATTACK'
      });
    }

    const gambit = adv.gambits[index];

    // Populate condition select
    const conditionSelect = document.getElementById('gambit-condition-select') as HTMLSelectElement;
    conditionSelect.innerHTML = '';
    Object.keys(GAMBIT_CONDITION_LABELS).forEach(key => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = GAMBIT_CONDITION_LABELS[key as GambitConditionType];
      conditionSelect.appendChild(option);
    });
    conditionSelect.value = gambit.conditionType;

    // Populate value status select
    const valSelect = document.getElementById('gambit-value-select') as HTMLSelectElement;
    valSelect.innerHTML = '<option value="">任意負面狀態</option>';
    const statuses = [
      { val: StatusEffectType.POISON, label: '中毒' },
      { val: StatusEffectType.BLEED, label: '流血' },
      { val: StatusEffectType.STUN, label: '暈眩' },
      { val: StatusEffectType.ARMOR_BREAK, label: '破甲' },
      { val: StatusEffectType.SHOCK, label: '感電' }
    ];
    statuses.forEach(s => {
      const option = document.createElement('option');
      option.value = s.val;
      option.textContent = s.label;
      valSelect.appendChild(option);
    });

    // Populate actions
    const actionSelect = document.getElementById('gambit-action-select') as HTMLSelectElement;
    actionSelect.innerHTML = '<option value="DEFAULT_ATTACK">⚔️ 預設普攻</option>';
    
    const learnedSkills = getAdventurerSkillInfo(adv).filter(s => s.isLearned);
    learnedSkills.forEach(info => {
      const option = document.createElement('option');
      option.value = info.skill.id;
      option.textContent = `✨ ${info.skill.name} (${info.skill.mpCost} MP)`;
      actionSelect.appendChild(option);
    });
    
    // set current values
    actionSelect.value = gambit.actionSkillId || 'DEFAULT_ATTACK';
    const isActiveCheck = document.getElementById('gambit-is-active') as HTMLInputElement;
    if (isActiveCheck) isActiveCheck.checked = gambit.isActive;
    
    this.updateUIBasedOnCondition(gambit.conditionValue);
    
    modal.classList.add('active');
  }

  private updateUIBasedOnCondition(initialValue?: any) {
    const conditionSelect = document.getElementById('gambit-condition-select') as HTMLSelectElement;
    const valContainer = document.getElementById('gambit-value-container') as HTMLDivElement;
    const valInput = document.getElementById('gambit-value-number') as HTMLSelectElement;
    const valSelect = document.getElementById('gambit-value-select') as HTMLSelectElement;
    const valLabel = document.getElementById('gambit-value-label') as HTMLLabelElement;

    const condition = conditionSelect.value as GambitConditionType;

    if (condition === GambitConditionType.ALWAYS || condition === GambitConditionType.ENEMY_FRONT_ROW || condition === GambitConditionType.ENEMY_BACK_ROW) {
      valContainer.style.display = 'none';
    } else if (condition === GambitConditionType.ENEMY_HAS_DEBUFF || condition === GambitConditionType.ALLY_HAS_DEBUFF) {
      valContainer.style.display = 'flex';
      valInput.style.display = 'none';
      valSelect.style.display = 'block';
      valLabel.textContent = '特定負面狀態 (選填)';
      if (initialValue !== undefined) valSelect.value = initialValue;
    } else {
      valContainer.style.display = 'flex';
      valInput.style.display = 'block';
      valSelect.style.display = 'none';
      valLabel.textContent = '百分比數值 (選擇)';
      if (initialValue !== undefined) valInput.value = initialValue.toString();
      else valInput.value = '30';
    }

    this.checkMeleeWarning();
  }

  private checkMeleeWarning() {
    const conditionSelect = document.getElementById('gambit-condition-select') as HTMLSelectElement;
    const actionSelect = document.getElementById('gambit-action-select') as HTMLSelectElement;
    const warningBox = document.getElementById('gambit-warning-box') as HTMLDivElement;
    
    if (!conditionSelect || !actionSelect || !warningBox || !this.currentAdv) return;

    const condition = conditionSelect.value;
    const action = actionSelect.value;

    const meleeWeapons = ['GREATSWORD', 'DUAL_SWORDS', 'SWORD_AND_SHIELD', 'RUNE_SHIELD', 'DAGGERS', 'HAMMER'];
    const isMelee = meleeWeapons.includes(this.currentAdv.equipment['WEAPON']?.weaponType || '');

    // 方案A 防呆提示：若選擇打後排，且為近戰武器，加上技能為預設普攻或單體近戰技能時 (其實我們直接用 isMelee 判斷最快，因為武器是近戰就碰不到後排)
    if (condition === GambitConditionType.ENEMY_BACK_ROW && isMelee) {
      warningBox.style.display = 'block';
    } else {
      warningBox.style.display = 'none';
    }
  }

  private save() {
    if (!this.currentAdv || this.currentIndex < 0) return;

    const isActive = (document.getElementById('gambit-is-active') as HTMLInputElement).checked;
    const condition = (document.getElementById('gambit-condition-select') as HTMLSelectElement).value as GambitConditionType;
    const action = (document.getElementById('gambit-action-select') as HTMLSelectElement).value;
    
    let val: any = undefined;
    if (condition === GambitConditionType.ENEMY_HAS_DEBUFF || condition === GambitConditionType.ALLY_HAS_DEBUFF) {
       val = (document.getElementById('gambit-value-select') as HTMLSelectElement).value;
       if (!val) val = undefined;
    } else if (condition !== GambitConditionType.ALWAYS && condition !== GambitConditionType.ENEMY_FRONT_ROW && condition !== GambitConditionType.ENEMY_BACK_ROW) {
       val = (document.getElementById('gambit-value-number') as HTMLSelectElement).value;
       val = parseInt(val, 10);
       if (isNaN(val)) val = 30; // 預設防呆
    }

    this.currentAdv.gambits[this.currentIndex] = {
      isActive: isActive,
      conditionType: condition,
      conditionValue: val,
      actionSkillId: action
    };

    PartyModalController.getInstance().renderPartyUpperSection();
    this.close();
  }

  public close() {
    const modal = document.getElementById('modal-gambit-edit');
    if (modal) {
      modal.classList.remove('active');
    }
    this.currentAdv = null;
    this.currentIndex = -1;
  }
}
