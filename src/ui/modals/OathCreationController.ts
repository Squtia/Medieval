import { Gender, JobConfig, TraitConfig } from '../../models/types';
import { GameDifficulty } from '../../models/WorldGeneration';
import { Adventurer } from '../../models/Adventurer';
import { DataStore } from '../../systems/DataStore';
import { GameState, initGameState } from '../../core/GameState';
import { UIManager } from '../UIManager';
import { getAvatarSpriteStyle } from '../IconSpriteHelper';
import { ToastManager } from '../ToastManager';
import { NameGenerator } from '../../systems/NameGenerator';
import { SaveManager } from '../../core/SaveManager';
import { clearGameLog } from '../../utils/Logger';
import { refreshGlobalUI } from '../../main';
import { setStartupMode, renderMap, ensurePhaserLoaded } from '../MapController';
import { enterScene } from '../SceneController';

export class OathCreationController {
  private static instance: OathCreationController | null = null;

  private selectedGender: Gender = Gender.MALE;
  private selectedAvatarIndex: number = 0;
  private selectedJobKey: string = 'WARRIOR';
  private selectedTraitKey: string = 'GUARDIAN_LOYAL';
  private currentDifficulty: GameDifficulty = GameDifficulty.NORMAL;
  private currentSeed: string = '';
  private currentSlot: number = 1;

  private readonly AVATAR_NAMES_MALE = [
    '滄桑老兵隊長 (1/10)',
    '銀髮雄獅騎士 (2/10)',
    '忠誠青年侍從 (3/10)',
    '金紋重甲將軍 (4/10)',
    '神秘兜帽遊俠 (5/10)',
    '狂怒戰斧勇士 (6/10)',
    '莊嚴黑袍神官 (7/10)',
    '堅毅歷戰傭兵 (8/10)',
    '森林長弓獵手 (9/10)',
    '全罩重裝步兵 (10/10)'
  ];

  private readonly AVATAR_NAMES_FEMALE = [
    '金髮璀璨聖騎 (1/10)',
    '聖潔修道神官 (2/10)',
    '颯爽赤髮劍士 (3/10)',
    '短髮英姿女騎 (4/10)',
    '暗影兜帽俠女 (5/10)',
    '紫袍秘術法師 (6/10)',
    '宮廷貴族女爵 (7/10)',
    '夜行黑皮刺客 (8/10)',
    '雙辮長弓射手 (9/10)',
    '重裝板金女戰 (10/10)'
  ];

  private readonly GUARDIAN_TRAITS = [
    { key: 'GUARDIAN_LOYAL', name: '🛡️ 忠誠護衛', effect: '【忠誠護衛】體質 +20%，力量 +10%', quote: '「誓死護衛領主大人，我的劍與盾與您同在！」' },
    { key: 'GUARDIAN_PRUDENT', name: '🧠 沉著參謀', effect: '【沉著參謀】敏捷 +15%，智慧 +15%', quote: '「保持冷靜與縝密，方能在亂世中奪回屬於我們的領地。」' },
    { key: 'GUARDIAN_VALIANT', name: '🔥 熱血戰魂', effect: '【熱血戰魂】力量 +20%，幸運 +10%', quote: '「敵人的數量越多，只會讓我手中的武器燃燒得更熾烈！」' },
    { key: 'GUARDIAN_DEVOUT', name: '✨ 堅毅信仰', effect: '【堅毅信仰】精神 +20%，體質 +10%', quote: '「榮光終將降臨，我會將受傷的您引領向復興之路。」' },
    { key: 'GUARDIAN_SCOUT', name: '🏹 敏銳斥候', effect: '【敏銳斥候】敏捷 +20%，幸運 +10%', quote: '「荒野的陰影由我來掃清，沒有任何人能偷襲我們！」' }
  ];

  // 初始基礎職業名稱
  private readonly JOBS = [
    { key: 'WARRIOR', name: '⚔️ 戰士' },
    { key: 'KNIGHT', name: '🛡️ 騎士' },
    { key: 'ARCHER', name: '🏹 弓手' },
    { key: 'MAGE', name: '🔮 法師' },
    { key: 'ROGUE', name: '🗡️ 盜賊' },
    { key: 'CLERIC', name: '📖 祈禱者' }
  ];

  public static getInstance(): OathCreationController {
    if (!OathCreationController.instance) {
      OathCreationController.instance = new OathCreationController();
    }
    return OathCreationController.instance;
  }

  public open(difficulty: GameDifficulty = GameDifficulty.NORMAL, seed: string = '', slot: number = 1) {
    this.currentDifficulty = difficulty;
    this.currentSeed = seed;
    this.currentSlot = slot;

    const modal = document.getElementById('modal-oath-creation');
    if (!modal) return;

    // 隨機重設初始狀態
    this.selectedGender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
    this.selectedAvatarIndex = 0;
    this.selectedJobKey = 'WARRIOR';
    this.selectedTraitKey = 'GUARDIAN_LOYAL';

    const iptName = document.getElementById('ipt-oath-name') as HTMLInputElement;
    if (iptName) {
      iptName.value = this.selectedGender === Gender.MALE ? '亞瑟' : '艾蓮娜';
    }

    this.bindEvents();
    this.render();
    modal.style.display = 'flex';
  }

  public close() {
    const modal = document.getElementById('modal-oath-creation');
    if (modal) modal.style.display = 'none';
  }

  private bindEvents() {
    // 性別切換
    document.getElementById('btn-oath-prev-gender')?.addEventListener('click', () => this.toggleGender());
    document.getElementById('btn-oath-next-gender')?.addEventListener('click', () => this.toggleGender());

    // 頭像切換 (支援 10 款男女立繪)
    document.getElementById('btn-oath-prev-avatar')?.addEventListener('click', () => {
      this.selectedAvatarIndex = (this.selectedAvatarIndex + 9) % 10;
      this.render();
    });
    document.getElementById('btn-oath-next-avatar')?.addEventListener('click', () => {
      this.selectedAvatarIndex = (this.selectedAvatarIndex + 1) % 10;
      this.render();
    });

    // 隨機取名
    document.getElementById('btn-oath-random-name')?.addEventListener('click', () => {
      const iptName = document.getElementById('ipt-oath-name') as HTMLInputElement;
      if (iptName) {
        iptName.value = NameGenerator.generateFullName(this.selectedGender);
      }
    });

    // 確認立誓
    const btnConfirm = document.getElementById('btn-confirm-oath');
    if (btnConfirm) {
      btnConfirm.onclick = () => this.confirmOathAndStart();
    }
  }

  private toggleGender() {
    this.selectedGender = this.selectedGender === Gender.MALE ? Gender.FEMALE : Gender.MALE;
    const iptName = document.getElementById('ipt-oath-name') as HTMLInputElement;
    if (iptName && (iptName.value === '亞瑟' || iptName.value === '艾蓮娜')) {
      iptName.value = this.selectedGender === Gender.MALE ? '亞瑟' : '艾蓮娜';
    }
    this.render();
  }

  private render() {
    // 1. 性別文字
    const txtGender = document.getElementById('txt-oath-gender');
    if (txtGender) {
      txtGender.textContent = this.selectedGender === Gender.MALE ? '👨 男性守衛' : '👩 女性守衛';
    }

    // 2. 頭像特寫
    const avatarBox = document.getElementById('oath-avatar-preview');
    if (avatarBox) {
      const style = getAvatarSpriteStyle(this.selectedGender, this.selectedAvatarIndex, true);
      avatarBox.style.backgroundImage = style.backgroundImage;
      avatarBox.style.backgroundSize = style.backgroundSize;
      avatarBox.style.backgroundPosition = style.backgroundPosition;
    }

    // 3. 頭像說明
    const txtAvatarName = document.getElementById('txt-oath-avatar-name');
    if (txtAvatarName) {
      const list = this.selectedGender === Gender.MALE ? this.AVATAR_NAMES_MALE : this.AVATAR_NAMES_FEMALE;
      txtAvatarName.textContent = list[this.selectedAvatarIndex] || `立繪 #${this.selectedAvatarIndex + 1}`;
    }

    // 4. 職業按鈕
    const jobList = document.getElementById('oath-job-list');
    if (jobList) {
      jobList.innerHTML = '';
      this.JOBS.forEach(j => {
        const isSel = j.key === this.selectedJobKey;
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.padding = '8px 6px';
        btn.style.fontSize = '0.85em';
        btn.style.background = isSel ? 'rgba(234, 179, 8, 0.25)' : 'rgba(0,0,0,0.4)';
        btn.style.border = `1px solid ${isSel ? '#eab308' : 'rgba(255,255,255,0.12)'}`;
        btn.style.color = isSel ? '#fbbf24' : '#cbd5e1';
        btn.textContent = j.name;
        btn.onclick = () => {
          this.selectedJobKey = j.key;
          this.render();
        };
        jobList.appendChild(btn);
      });
    }

    // 5. 性格按鈕
    const traitList = document.getElementById('oath-trait-list');
    if (traitList) {
      traitList.innerHTML = '';
      this.GUARDIAN_TRAITS.forEach(t => {
        const isSel = t.key === this.selectedTraitKey;
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.padding = '8px 6px';
        btn.style.fontSize = '0.82em';
        btn.style.background = isSel ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0,0,0,0.4)';
        btn.style.border = `1px solid ${isSel ? '#10b981' : 'rgba(255,255,255,0.12)'}`;
        btn.style.color = isSel ? '#34d399' : '#cbd5e1';
        btn.textContent = t.name;
        btn.onclick = () => {
          this.selectedTraitKey = t.key;
          this.render();
        };
        traitList.appendChild(btn);
      });
    }

    // 6. 性格描述
    const curTrait = this.GUARDIAN_TRAITS.find(t => t.key === this.selectedTraitKey);
    const txtEffect = document.getElementById('txt-oath-trait-effect');
    const txtQuote = document.getElementById('txt-oath-trait-quote');
    if (txtEffect && curTrait) txtEffect.textContent = curTrait.effect;
    if (txtQuote && curTrait) txtQuote.textContent = curTrait.quote;
  }

  private async confirmOathAndStart() {
    const iptName = document.getElementById('ipt-oath-name') as HTMLInputElement;
    const guardianName = iptName?.value.trim() || (this.selectedGender === Gender.MALE ? '亞瑟' : '艾蓮娜');

    // 1. 初始化新遊戲世界
    clearGameLog();
    initGameState({ difficulty: this.currentDifficulty, seed: this.currentSeed });
    refreshGlobalUI();
    GameState.currentSaveSlot = this.currentSlot;

    const playerBase = GameState.mapSystem.getNodes().find(node => node.isPlayerBase);
    const baseNodeId = playerBase?.id || 'node_base';

    // 2. 建立專屬誓約守衛 (N階)
    const jobConfig = DataStore.JobDB[this.selectedJobKey] || DataStore.JobDB.WARRIOR;
    const traitConfig = DataStore.TraitDB[this.selectedTraitKey] || DataStore.TraitDB.GUARDIAN_LOYAL;

    const guardian = new Adventurer(
      'p1',
      guardianName,
      jobConfig,
      traitConfig,
      'N',
      this.selectedGender,
      true
    );
    guardian.avatarIndex = this.selectedAvatarIndex;
    guardian.locationNodeId = baseNodeId;

    // 3. 裝備領主傳家劍 (已上鎖防賣防拆)
    const startWpn = DataStore.getEquipmentTemplate('wpn_heirloom_sword');
    if (startWpn) {
      const eq: any = {
        uuid: 'eq_heirloom_01',
        id: startWpn.id,
        name: startWpn.name,
        slot: startWpn.slot,
        icon: startWpn.icon,
        tier: 1,
        isLocked: true,
        enhancementLevel: 0,
        requirements: { ...startWpn.baseRequirements },
        effects: { ...startWpn.baseEffects },
        combatEffects: { ...startWpn.baseCombatEffects }
      };
      try {
        guardian.equip(eq);
      } catch (e: any) {
        console.error(e.message);
      }
    }

    // 替換初始隊員為客製化誓約守衛
    GameState.adventurers[0] = guardian;

    // 4. 關閉創角 Modal
    this.close();

    // 5. 確保地圖 Phaser 就緒
    await ensurePhaserLoaded();

    const mainMenu = document.getElementById('main-menu-view');
    const mapView = document.getElementById('map-view');
    const topBar = document.getElementById('top-bar');

    if (mainMenu && mapView && topBar && playerBase) {
      setStartupMode(false);
      mainMenu.classList.remove('active');
      mapView.classList.add('active');
      topBar.style.display = 'flex';
      renderMap();
      enterScene(playerBase);
      SaveManager.saveGame(this.currentSlot);
      document.dispatchEvent(new Event('game-started'));
    }

    // 6. 播放黑幕劇情轉場
    this.playPrologueSequence(guardianName);
  }

  private playPrologueSequence(guardianName: string) {
    const overlay = document.getElementById('overlay-prologue');
    const content = document.getElementById('prologue-content');
    const tip = document.getElementById('prologue-tip');
    if (!overlay || !content) {
      UIManager.updateUI();
      return;
    }

    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.onclick = null; // 初始化時先不允許點擊跳過

    if (tip) {
      tip.style.opacity = '0';
      tip.style.transition = 'opacity 0.8s ease';
    }

    // 右上角略過按鈕
    let skipBtn = document.getElementById('btn-skip-prologue');
    if (!skipBtn) {
      skipBtn = document.createElement('button');
      skipBtn.id = 'btn-skip-prologue';
      skipBtn.className = 'action-btn';
      skipBtn.style.position = 'absolute';
      skipBtn.style.top = '25px';
      skipBtn.style.right = '30px';
      skipBtn.style.padding = '6px 14px';
      skipBtn.style.fontSize = '0.85em';
      skipBtn.style.background = 'rgba(255,255,255,0.1)';
      skipBtn.style.border = '1px solid rgba(255,255,255,0.2)';
      skipBtn.style.color = '#94a3b8';
      skipBtn.textContent = '⏩ 略過劇情';
      overlay.appendChild(skipBtn);
    }

    const lines = [
      '那一夜，突如其來的刺耳號角與烈火撕裂了領地的寧靜……',
      '敵軍的無情突襲奪走了城堡，父親在奮戰至最後一刻時，將佩劍與唯一的孩子託付給了眼前最忠誠的守衛。',
      `「『${guardianName}，帶上我的孩子逃出去……用你的生命守護他，直到奪回屬於我們榮光的那一天！』」`,
      '穿過無盡的夜色、荒野與密林，你們終於在一處殘破的營地停下了逃亡的腳步。',
      '第一簇復興的營火被點燃，誓約與傳奇在此刻展開。'
    ];

    content.innerHTML = lines.map(line => `<p style="margin: 18px 0; opacity: 0; transition: opacity 1.2s ease;">${line}</p>`).join('');

    const pTags = content.querySelectorAll('p');
    pTags.forEach((p, idx) => {
      setTimeout(() => {
        (p as HTMLElement).style.opacity = '1';
      }, 400 + idx * 850);
    });

    const proceed = () => {
      overlay.style.transition = 'opacity 0.8s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.onclick = null;
        if (skipBtn) skipBtn.onclick = null;
        ToastManager.show(`⚔️ 誓約守衛【${guardianName}】已伴隨您踏入荒野營地！`, 'success');
        UIManager.updateUI();
      }, 800);
    };

    skipBtn.onclick = (e) => {
      e.stopPropagation();
      proceed();
    };

    // 當全部文字淡入完畢後（約 4.2 秒），才允許點擊任意處進入
    setTimeout(() => {
      if (tip) tip.style.opacity = '1';
      overlay.onclick = proceed;
    }, 400 + lines.length * 850);
  }
}
