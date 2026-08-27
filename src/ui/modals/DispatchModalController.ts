import { positionFloatingElement } from '../FloatingPosition';
import { ToastManager } from '../ToastManager';
import { Adventurer } from '../../models/Adventurer';
import { MapNode, NodeLevel, AdventurerState } from '../../models/types';
import { GameState } from '../../core/GameState';
import { renderAdventurerCard, getAdventurerTooltipHtml } from '../components/AdventurerCard';
import { DispatchTask, EnemyFeature, TaskType, SubjugationMode } from '../../models/DispatchTask';
import { monsterSystem } from '../../systems/MonsterSystem';
import { getCombatPrestigeReward, getDifficultyModifiers } from '../../data/BalanceData';
import { FormationDB } from '../../systems/FormationDB';
import { Random } from '../../core/Random';

export class DispatchModalController {
  private static instance: DispatchModalController;
  
  private pendingDispatchTask: DispatchTask | null = null;
  private pendingDispatchNode: MapNode | null = null;
  private selectedAdventurersForDispatch: Set<string> = new Set();
  private selectedTroopsForDispatch: Record<string, number> = {};
  private currentFormationId: string = 'DEFAULT';
  private currentGridMap: Record<string, string> = {};
  private dragDraggedAdvId: string | null = null;
  private dragSourceSlot: string | null = null;

  private presetEventsInitialized = false;
  private currentSelectedPresetIndex: number = 0;

  private constructor() {}

  public static getInstance(): DispatchModalController {
    if (!DispatchModalController.instance) {
      DispatchModalController.instance = new DispatchModalController();
    }
    return DispatchModalController.instance;
  }

  private initPresetEvents() {
  if (this.presetEventsInitialized) return;
  this.presetEventsInitialized = true;

  const presetBtns = document.querySelectorAll('.btn-preset');
  const saveBtn = document.getElementById('btn-save-preset');

  const updatePresetButtonUI = () => {
    presetBtns.forEach(btn => {
      const idx = parseInt((btn as HTMLElement).dataset.preset || '0');
      if (idx === this.currentSelectedPresetIndex) {
        (btn as HTMLElement).style.background = 'rgba(59,130,246,0.5)';
        (btn as HTMLElement).style.borderColor = '#3b82f6';
        (btn as HTMLElement).style.color = '#fff';
      } else {
        (btn as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        (btn as HTMLElement).style.borderColor = 'transparent';
        (btn as HTMLElement).style.color = '#d4c4a8';
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.preset || '0');
      this.currentSelectedPresetIndex = idx;
      updatePresetButtonUI();
      
      const preset = GameState.formationPresets ? GameState.formationPresets[idx] : null;
      if (preset && preset.gridMap) {
        this.currentFormationId = preset.formationId || 'DEFAULT';
        this.currentGridMap = {};
        this.selectedAdventurersForDispatch.clear();
        
        let missingNames: string[] = [];
        
        for (const [slot, advId] of Object.entries(preset.gridMap)) {
          const adv = GameState.adventurers.find(a => a.id === advId);
          if (adv) {
            if (adv.currentState === AdventurerState.IDLE) {
              if (this.selectedAdventurersForDispatch.size < 5) {
                this.currentGridMap[slot] = advId;
                this.selectedAdventurersForDispatch.add(advId);
              }
            } else {
              missingNames.push(adv.name);
            }
          }
        }
        
        this.renderDispatchTeamRoster();
        this.renderDispatchAdvList();
        
        if (missingNames.length > 0) {
          ToastManager.show(`隊伍讀取不完整：${missingNames.join(', ')} 正在執行其他任務或休養中。`);
        } else {
          ToastManager.show(`已讀取隊伍 ${idx + 1}`);
        }
      } else {
        ToastManager.show(`隊伍 ${idx + 1} 尚未儲存任何配置`);
      }
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!GameState.formationPresets) {
        GameState.formationPresets = [];
      }
      
      // Ensure the array has enough elements
      while (GameState.formationPresets.length <= this.currentSelectedPresetIndex) {
        GameState.formationPresets.push({
          id: `preset_${GameState.formationPresets.length}`,
          name: `隊伍 ${GameState.formationPresets.length + 1}`,
          formationId: 'DEFAULT',
          gridMap: {}
        });
      }
      
      GameState.formationPresets[this.currentSelectedPresetIndex] = {
        id: `preset_${this.currentSelectedPresetIndex}`,
        name: `隊伍 ${this.currentSelectedPresetIndex + 1}`,
        formationId: this.currentFormationId,
        gridMap: { ...this.currentGridMap }
      };
      
      ToastManager.show(`已將當前配置儲存至隊伍 ${this.currentSelectedPresetIndex + 1}`);
    });
  }
  
  updatePresetButtonUI();
}

  private renderDispatchTeamRoster() {
  const container = document.getElementById('dispatch-team-grid');
  if (!container) return;
  container.innerHTML = '';
  
  // Render Formation Selector
  const select = document.getElementById('dispatch-formation-select') as HTMLSelectElement;
  if (select) {
    select.innerHTML = '';
    GameState.unlockedFormations.forEach(fid => {
      const form = FormationDB.getFormation(fid);
      const option = document.createElement('option');
      option.value = fid;
      option.textContent = `${form.icon} ${form.name}`;
      if (fid === this.currentFormationId) option.selected = true;
      select.appendChild(option);
    });
    
    if (!select.dataset.bound) {
      select.dataset.bound = 'true';
      select.addEventListener('change', (e) => {
        this.currentFormationId = (e.target as HTMLSelectElement).value;
        this.renderDispatchTeamRoster();
      });
    }
  }
  
  const descEl = document.getElementById('dispatch-formation-desc');
  const activeFormation = FormationDB.getFormation(this.currentFormationId);
  if (descEl) {
    descEl.textContent = activeFormation.description;
  }
  
  const isFormationActive = FormationDB.isFormationActive(this.currentGridMap, this.currentFormationId);
  
  for (let vr = 0; vr < 3; vr++) {
    for (let vc = 0; vc < 3; vc++) {
      const r = 2 - vc;
      const c = vr;
      const slotId = `${r}_${c}`;
      const advId = this.currentGridMap[slotId];
      const adv = advId ? GameState.adventurers.find(a => a.id === advId) : null;
      
      const isRequired = activeFormation.requiredSlots.some(s => s.row === r && s.col === c);
      
      const slot = document.createElement('div');
      slot.className = 'grid-slot';
      slot.style.width = '95px';
      slot.style.height = '110px';
      slot.style.border = '2px dashed ' + (isRequired ? (isFormationActive ? '#10b981' : '#eab308') : 'rgba(255,255,255,0.2)');
      slot.style.borderRadius = '6px';
      slot.style.background = 'rgba(0,0,0,0.4)';
      slot.style.position = 'relative';
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      
      const label = document.createElement('div');
      label.textContent = r === 0 ? '前排' : r === 1 ? '中排' : '後排';
      label.style.position = 'absolute';
      label.style.bottom = '-20px';
      label.style.color = '#94a3b8';
      label.style.fontSize = '0.7em';
      label.style.whiteSpace = 'nowrap';
      slot.appendChild(label);
      
      slot.dataset.slotId = slotId;
      slot.addEventListener('dragover', (e) => { e.preventDefault(); });
      slot.addEventListener('drop', (e) => this.handleDropOnGrid(e, slotId));
      
      if (adv) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'adventurer-card';
        cardDiv.style.transform = 'scale(0.85)';
        cardDiv.style.transformOrigin = 'center';
        cardDiv.style.pointerEvents = 'auto'; 
        cardDiv.draggable = true;
        
        cardDiv.innerHTML = renderAdventurerCard(adv, {
          showDismissBtn: true,
          dismissId: adv.id
        });
        
        const displayClass = (adv as any).currentClass || adv.job.name;
        const tooltipHtml = getAdventurerTooltipHtml(adv);
        
        cardDiv.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
        });
        cardDiv.addEventListener('mousemove', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
        });
        cardDiv.addEventListener('mouseleave', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        cardDiv.addEventListener('dragstart', (e) => {
          this.dragDraggedAdvId = adv.id;
          this.dragSourceSlot = slotId;
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        const removeBtn = cardDiv.querySelector('button');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            delete this.currentGridMap[slotId];
            this.selectedAdventurersForDispatch.delete(adv.id);
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) tEl.style.opacity = '0';
            this.renderDispatchTeamRoster();
            this.renderDispatchAdvList();
          });
        }
        
        slot.appendChild(cardDiv);
      } else if (isRequired) {
         const reqLabel = document.createElement('div');
         reqLabel.textContent = '📍';
         reqLabel.style.fontSize = '1.5em';
         reqLabel.style.opacity = '0.5';
         slot.appendChild(reqLabel);
      }
      
      container.appendChild(slot);
    }
  }
  
  const btnSave = document.getElementById('btn-save-preset');
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = 'true';
    btnSave.addEventListener('click', () => {
      if (Object.keys(this.currentGridMap).length === 0) {
        ToastManager.show('隊伍為空，無法儲存！');
        return;
      }
      if (GameState.formationPresets.length >= 5) {
        GameState.formationPresets.shift(); 
      }
      GameState.formationPresets.push({
        id: 'preset_' + Date.now(),
        name: `隊伍 ${GameState.formationPresets.length + 1}`,
        formationId: this.currentFormationId,
        gridMap: { ...this.currentGridMap }
      });
      ToastManager.show('隊伍配置已儲存！');
      this.renderDispatchTeamRoster();
    });
  }
  
  const presetBtns = document.querySelectorAll('.btn-preset');
  presetBtns.forEach((btn, index) => {
    const el = btn as HTMLElement;
    if (GameState.formationPresets[index]) {
      el.style.background = 'rgba(59,130,246,0.3)';
      el.style.color = '#fff';
      if (!el.dataset.bound) {
        el.dataset.bound = 'true';
        el.addEventListener('click', () => {
          const preset = GameState.formationPresets[index];
          this.currentFormationId = preset.formationId;
          this.currentGridMap = { ...preset.gridMap };
          this.selectedAdventurersForDispatch.clear();
          Object.values(this.currentGridMap).forEach(id => this.selectedAdventurersForDispatch.add(id as string));
          this.renderDispatchTeamRoster();
          this.renderDispatchAdvList();
        });
      }
    } else {
      el.style.background = 'rgba(255,255,255,0.1)';
      el.style.color = '#94a3b8';
    }
  });

  this.updateDispatchPowerPreview();
}

  private handleDropOnGrid(e: DragEvent, targetSlotId: string) {
  e.preventDefault();
  if (!this.dragDraggedAdvId) return;
  
  if (this.dragSourceSlot && this.dragSourceSlot !== 'pool') {
    const existingAdvInTarget = this.currentGridMap[targetSlotId];
    if (existingAdvInTarget) {
      this.currentGridMap[this.dragSourceSlot] = existingAdvInTarget;
    } else {
      delete this.currentGridMap[this.dragSourceSlot];
    }
  } else {
    const existingAdvInTarget = this.currentGridMap[targetSlotId];
    if (!existingAdvInTarget && this.selectedAdventurersForDispatch.size >= 5) {
      ToastManager.show('隊伍最多只能派出 5 名傭兵！');
      this.dragDraggedAdvId = null;
      this.dragSourceSlot = null;
      return;
    }

    // 拖曳編隊防線：每場戰鬥隊伍最多只能編入 1 位 UR 品質傭兵
    const draggedAdv = GameState.adventurers.find(a => a.id === this.dragDraggedAdvId);
    if (draggedAdv && draggedAdv.quality === 'UR') {
      const hasOtherUR = Array.from(this.selectedAdventurersForDispatch).some(id => {
        if (id === existingAdvInTarget) return false;
        const member = GameState.adventurers.find(a => a.id === id);
        return member?.quality === 'UR';
      });
      if (hasOtherUR) {
        ToastManager.show('⚠️ 戰鬥隊伍限制：每場戰鬥最多只能編入 1 位 UR 品質傭兵！');
        this.dragDraggedAdvId = null;
        this.dragSourceSlot = null;
        return;
      }
    }

    if (existingAdvInTarget) {
      this.selectedAdventurersForDispatch.delete(existingAdvInTarget);
    }
    this.selectedAdventurersForDispatch.add(this.dragDraggedAdvId);
  }
  
  this.currentGridMap[targetSlotId] = this.dragDraggedAdvId;
  this.dragDraggedAdvId = null;
  this.dragSourceSlot = null;
  
  this.renderDispatchTeamRoster();
  this.renderDispatchAdvList();
}

  private renderDispatchAdvList() {
  const container = document.getElementById('dispatch-adv-list');
  if (!container) return;
  container.innerHTML = '';
  
  const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
  
  if (idleAdvs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; grid-column: 1 / -1;">目前沒有閒置的冒險者可以派遣。</p>';
    return;
  }

  idleAdvs.forEach(adv => {
    const isSelected = this.selectedAdventurersForDispatch.has(adv.id);
    const card = document.createElement('div');
    card.className = 'adventurer-card';
    if (isSelected) {
      card.style.borderColor = '#3b82f6';
      card.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      card.style.opacity = '0.5';
    } else {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        this.dragDraggedAdvId = adv.id;
        this.dragSourceSlot = 'pool';
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });
    }
    
    card.innerHTML = renderAdventurerCard(adv);
    
    const displayClass = (adv as any).currentClass || adv.job.name;
    const tooltipHtml = getAdventurerTooltipHtml(adv);
    
    card.addEventListener('mouseenter', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
    });
    card.addEventListener('mousemove', (e) => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
    });
    card.addEventListener('mouseleave', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
    });

    card.addEventListener('click', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
      
      if (isSelected) {
        for (const [key, val] of Object.entries(this.currentGridMap)) {
          if (val === adv.id) delete this.currentGridMap[key];
        }
        this.selectedAdventurersForDispatch.delete(adv.id);
      } else {
        if (this.selectedAdventurersForDispatch.size >= 5) {
          ToastManager.show('隊伍最多只能派出 5 名傭兵！');
          return;
        }

        // 戰鬥規則防線：每場戰鬥隊伍最多只能編入 1 位 UR 品質傭兵
        if (adv.quality === 'UR') {
          const hasUR = Array.from(this.selectedAdventurersForDispatch).some(id => {
            const member = GameState.adventurers.find(a => a.id === id);
            return member?.quality === 'UR';
          });
          if (hasUR) {
            ToastManager.show('⚠️ 戰鬥隊伍限制：每場戰鬥最多只能編入 1 位 UR 品質傭兵！');
            return;
          }
        }

        let found = false;
        for (let r=0; r<3; r++) {
          for (let c=0; c<3; c++) {
            const key = `${r}_${c}`;
            if (!this.currentGridMap[key]) {
              this.currentGridMap[key] = adv.id;
              this.selectedAdventurersForDispatch.add(adv.id);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      this.renderDispatchAdvList();
      this.renderDispatchTeamRoster();
    });

    container.appendChild(card);
  });
}

  private updateDispatchPowerPreview() {
  let totalPower = 0;
  GameState.adventurers.forEach(adv => {
    if (this.selectedAdventurersForDispatch.has(adv.id)) {
      totalPower += adv.power;
    }
  });
  const el = document.getElementById('dispatch-total-power')!;
  const riskEl = document.getElementById('dispatch-risk-preview')!;
  el.textContent = totalPower.toString();
  
  if (this.pendingDispatchTask && totalPower >= this.pendingDispatchTask.minPowerRequired) {
    el.style.color = '#10b981'; // 綠色
  } else {
    el.style.color = '#eab308'; // 黃色
  }
  if (this.pendingDispatchTask) {
    const ratio = this.pendingDispatchTask.minPowerRequired > 0 ? totalPower / this.pendingDispatchTask.minPowerRequired : 1;
    const risk = ratio >= 1.4 ? '低' : ratio >= 1 ? '中' : '高';
    const color = risk === '低' ? '#10b981' : risk === '中' ? '#f59e0b' : '#ef4444';
    const roadText = this.pendingDispatchTask.roadBenefitApplied
      ? `｜🛤️ 道路加速（原 ${this.pendingDispatchTask.baseRequiredDays} 天）`
      : '';
    riskEl.innerHTML = `風險：<strong style="color:${color}">${risk}</strong>｜耗時 ${this.pendingDispatchTask.requiredDays} 天${roadText}｜預期 💰${this.pendingDispatchTask.expectedGold}／✨${this.pendingDispatchTask.expectedPrestige}｜失敗將休養`;
  }
}

  public static createDispatchTaskForNode(node: MapNode, actionType: 'subjugation' | 'war' | 'diplomacy'): DispatchTask {
    const difficultyModifiers = getDifficultyModifiers(GameState.worldGeneration?.difficulty);
    const rawBaseDiff = node.baseDifficulty !== undefined ? node.baseDifficulty : (node.nodeLevel === NodeLevel.WILDERNESS ? 10 : 20 + node.nodeLevel * 10);
    const baseDiff = Math.max(1, Math.round(rawBaseDiff * difficultyModifiers.enemyStrength));
    const rawMinPower = node.nodeLevel === NodeLevel.WILDERNESS ? 30 : 50 + node.nodeLevel * 40;
    const minPower = Math.max(1, Math.round(rawMinPower * difficultyModifiers.enemyStrength));
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);

    if (actionType === 'diplomacy') {
      const task = new DispatchTask(`外交使節前往${node.name}`, TaskType.DIPLOMACY, 3, 0, 50, 0, 30);
      task.targetNodeId = node.id;
      return task;
    } else if (actionType === 'war') {
      const prestigeReward = getCombatPrestigeReward(baseDiff, true, node.nodeLevel);
      const task = new DispatchTask(`攻城${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, prestigeReward, minPower, randomFeature);
      task.targetNodeId = node.id;
      task.isWar = true;
      task.allowTroops = true;
      return task;
    } else {
      const enemyLineup = (node.scoutData && node.scoutData.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0)
        ? node.scoutData.garrisonEncounter
        : monsterSystem.generateNodeEncounter(node);
      
      const rawGarrisonPower = (node.scoutData && node.scoutData.garrisonPower !== undefined)
        ? node.scoutData.garrisonPower
        : (enemyLineup ? enemyLineup.reduce((sum, m) => sum + m.calculatedPowerScore, 0) : 0);
      const subjugationMinPower = rawGarrisonPower > 0 ? Math.round(rawGarrisonPower) : minPower;

      const baseRewardGold = node.isEliteLair ? (100 + node.nodeLevel * 50) * 3 : (100 + node.nodeLevel * 50);
      const prestigeReward = getCombatPrestigeReward(baseDiff, false, node.nodeLevel) * (node.isEliteLair ? 2.5 : 1.0);
      const task = new DispatchTask(`討伐${node.name}`, TaskType.COMBAT, 4, baseDiff, baseRewardGold, prestigeReward, subjugationMinPower, randomFeature);
      task.targetNodeId = node.id;
      task.enemyLineup = enemyLineup;
      task.allowTroops = node.allowTroops !== false;
      if (node.narrativeSubjugation) {
        task.narrativeSubjugation = { ...node.narrativeSubjugation, journeyNodeIds: [...node.narrativeSubjugation.journeyNodeIds] };
        if (node.narrativeSubjugation.enemyFeature) task.enemyFeature = node.narrativeSubjugation.enemyFeature as EnemyFeature;
      }
      return task;
    }
  }

  public openDispatchSetup(node: MapNode, actionType: 'subjugation' | 'war' | 'diplomacy') {
    const modal = document.getElementById('modal-dispatch-setup')!;
    const title = document.getElementById('dispatch-setup-title')!;
    const desc = document.getElementById('dispatch-setup-desc')!;
    const reqPowerEl = document.getElementById('dispatch-req-power')!;
    
    this.pendingDispatchNode = node;
    this.selectedAdventurersForDispatch.clear();
    this.selectedTroopsForDispatch = {};
    this.currentFormationId = 'DEFAULT';
    this.currentGridMap = {};
    this.dragDraggedAdvId = null;
    this.dragSourceSlot = null;
  
  const optionsContainer = document.getElementById('dispatch-subjugation-options')!;
  optionsContainer.style.display = 'none';

  this.pendingDispatchTask = DispatchModalController.createDispatchTaskForNode(node, actionType);
  const baseDiff = this.pendingDispatchTask.baseDifficulty || 10;
  const randomFeature = this.pendingDispatchTask.enemyFeature;

  if (actionType === 'diplomacy') {
    title.innerHTML = '🤝 外交使節隊伍編制';
    desc.textContent = `目標：${node.name} (派遣使節前往簽署通商條約)`;
  } else if (actionType === 'war') {
    title.innerHTML = '🛡️ 攻城隊伍編制';
    let fStr = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
    if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  } else {
    title.innerHTML = node.isEliteLair ? '💀 稀有危險挑戰討伐' : '⚔️ 討伐隊伍編制';
    const enemyLineup = this.pendingDispatchTask.enemyLineup;
    let fStr = '';
    if (enemyLineup && enemyLineup.length > 0) {
      const monsterNames = enemyLineup.map(m => m.name).join('、');
      
      const elemMap: Record<string, string> = {
        'NONE': '無屬性', 'FIRE': '🔥火焰', 'ICE': '❄️冰霜', 'LIGHTNING': '⚡雷電', 'HOLY': '☀️聖光', 'DARK': '🌑黑暗'
      };
      const affixMap: Record<string, string> = {
        'MIASMA': '瘴氣之森 (持續中毒)',
        'VOLCANIC_HEAT': '灼熱熔岩 (持續灼燒)',
        'BLIZZARD': '極寒暴雪 (速度降低)',
        'FORTIFIED': '堅不可摧 (護甲提升)',
        'BERSERK_AURA': '狂暴光狂 (攻擊提升)'
      };

      const filteredElems = (node.scoutData?.mainElements || []).filter(e => e !== 'NONE');
      const elemDisplay = filteredElems.length > 0 ? filteredElems.map(e => elemMap[e] || e).join('/') : '無屬性';
      const elemStr = ` [威脅元素: ${elemDisplay}]`;
      const affixStr = node.scoutData?.affix ? ` [據點詞綴: ${affixMap[node.scoutData.affix] || node.scoutData.affix}]` : '';
      const eliteBonus = node.isEliteLair ? ' 🌟[高額傳奇戰利品/高掉寶]' : '';
      fStr = `\n情報回報：據點駐守 ${enemyLineup.length} 隻【${monsterNames}】${elemStr}${affixStr}${eliteBonus}`;
    } else {
      if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
      if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    }
    const eliteTag = node.isEliteLair ? '【💀 稀有危險挑戰】' : '';
    desc.textContent = `${eliteTag}目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  }

  reqPowerEl.textContent = `🎯 建議戰力：${this.pendingDispatchTask.minPowerRequired}`;
  
  // 討伐模式切換與動態提示說明
  const modeRadios = document.querySelectorAll('input[name="subjugation-mode"]');
  const hintEl = document.getElementById('subjugation-mode-hint');
  
  const updateSubjugationHint = () => {
    const selectedMode: string = 'SINGLE';
    if (this.pendingDispatchTask && actionType !== 'diplomacy') {
      const baseGold = 100 + node.nodeLevel * 50;
      const basePrestige = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
      if (selectedMode === 'PROGRESS') {
        this.pendingDispatchTask.subjugationMode = SubjugationMode.PROGRESS;
        this.pendingDispatchTask.totalWaves = 3;
        this.pendingDispatchTask.expectedGold = Math.floor(baseGold * 3.5);
        this.pendingDispatchTask.expectedPrestige = Math.floor(basePrestige * 3.5);
        if (hintEl) {
          hintEl.innerHTML = '🔥 <span style="color:#fbbf24; font-weight:bold;">【連續平定】(3波)</span>：連續交戰 3 波敵軍，成功全勝後據點將徹底平定並<span style="color:#ef4444; font-weight:bold;">【從地圖消失】</span>，獲得 <span style="color:#fbbf24;">3.5 倍</span> 基礎獎勵，並<span style="color:#a855f7; font-weight:bold;">必定獲得 1 件對應難度裝備</span>！';
        }
      } else {
        this.pendingDispatchTask.subjugationMode = SubjugationMode.SINGLE;
        this.pendingDispatchTask.totalWaves = 1;
        this.pendingDispatchTask.expectedGold = baseGold;
        this.pendingDispatchTask.expectedPrestige = basePrestige;
        if (hintEl) {
          hintEl.innerHTML = '💡 <span style="color:#38bdf8; font-weight:bold;">【單次討伐】(1波)</span>：討伐成功後獲得基礎戰利品，據點<span style="color:#4ade80; font-weight:bold;">【保留在地圖上】</span>供重複練級刷資源。';
        }
      }
    }
  };

  modeRadios.forEach(radio => {
    radio.removeEventListener('change', updateSubjugationHint);
    radio.addEventListener('change', () => {
      updateSubjugationHint();
      this.renderDispatchTeamRoster();
    });
  });
  updateSubjugationHint();
  
  const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  if (playerBase && GameState.roadSystem && this.pendingDispatchTask) {
    const roadTiming = GameState.roadSystem.getMissionDays(
      this.pendingDispatchTask.requiredDays,
      playerBase,
      node
    );
    if (roadTiming.hasRoad) {
      this.pendingDispatchTask.baseRequiredDays = roadTiming.baseDays;
      this.pendingDispatchTask.requiredDays = roadTiming.adjustedDays;
      this.pendingDispatchTask.roadBenefitApplied = true;
    }
  }

  this.renderDispatchAdvList();
  this.renderDispatchTeamRoster();
  this.initPresetEvents();

  // 更新確認按鈕事件
  const btnConfirm = document.getElementById('btn-confirm-dispatch')!;
  const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode!.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener('click', () => {
    if (this.selectedAdventurersForDispatch.size === 0) {
      ToastManager.show('請至少選擇一名冒險者！');
      return;
    }
    const team = GameState.adventurers.filter(a => this.selectedAdventurersForDispatch.has(a.id));
    const urCount = team.filter(a => a.quality === 'UR').length;
    if (urCount > 1) {
      ToastManager.show('⚠️ 戰鬥隊伍限制：每場戰鬥最多只能編入 1 位 UR 品質傭兵！');
      return;
    }
    if (this.pendingDispatchTask) {
      const totalPower = team.reduce((sum, adventurer) => sum + adventurer.power, 0);
      if (
        totalPower < this.pendingDispatchTask.minPowerRequired &&
        !confirm(`我方戰力 ${totalPower} 低於建議戰力 ${this.pendingDispatchTask.minPowerRequired}，預估勝率偏低，仍要出征嗎？`)
      ) {
        return;
      }
      if (actionType === 'subjugation' || actionType === 'war') {
        this.pendingDispatchTask.subjugationMode = SubjugationMode.SINGLE;
        
        // 驗證總派兵數是否超過領地庫存 (WAR 模式或允許帶兵的討伐模式)
        if (this.pendingDispatchTask.isWar || this.pendingDispatchTask.allowTroops) {
          const terr = GameState.myTerritory;
          const totals: Record<string, number> = { INFANTRY: 0, CAVALRY: 0, ARCHER: 0 };
          // this.selectedTroopsForDispatch is Record<string, any> where any is {type, count}
          for (const [id, tObj] of Object.entries(this.selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && this.selectedAdventurersForDispatch.has(id)) {
               totals[t.type] += t.count;
            }
          }
          if ((totals.INFANTRY > (terr.workers.INFANTRY || 0)) ||
              (totals.CAVALRY > (terr.workers.CAVALRY || 0)) ||
              (totals.ARCHER > (terr.workers.ARCHER || 0))) {
            ToastManager.show('派出的兵力總和超過了領地現有庫存！');
            return;
          }
          
          // 將有效兵力綁定至 Task
          this.pendingDispatchTask.troopAssignments = {};
          for (const [id, tObj] of Object.entries(this.selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && t.count > 0 && this.selectedAdventurersForDispatch.has(id)) {
              this.pendingDispatchTask.troopAssignments[id] = { type: t.type, count: t.count };
            }
          }
        }
      }
      
      this.pendingDispatchTask.formationId = this.currentFormationId;
      this.pendingDispatchTask.gridMap = { ...this.currentGridMap };
      
      GameState.system.dispatchAdventurers(team, this.pendingDispatchTask);
      modal.classList.remove('active');
    }
  });

  const btnClose = document.getElementById('btn-close-dispatch-setup')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
}

}
