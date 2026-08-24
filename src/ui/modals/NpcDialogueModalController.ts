import { GameState } from '../../core/GameState';
import { EventBus } from '../../core/EventBus';
import { GameEventType } from '../../core/GameEvents';
import { Gender } from '../../models/types';
import { NarrativeChoice, NarrativeDialoguePage } from '../../models/Narrative';
import { NarrativeNodeRef, NarrativeSystem } from '../../systems/NarrativeSystem';
import { renderUniversalIcon, renderUniversalPortrait } from '../IconSpriteHelper';
import { UIManager } from '../UIManager';
import { renderStreetNpcEvents } from '../SceneController';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export class NpcDialogueModalController {
  private static instance: NpcDialogueModalController | null = null;
  private currentRef: NarrativeNodeRef | null = null;
  private currentPageIdx: number = 0;
  private pages: NarrativeDialoguePage[] = [];

  private modal: HTMLElement | null = null;
  private portraitEl: HTMLElement | null = null;
  private speakerNameEl: HTMLElement | null = null;
  private speakerTitleEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private textEl: HTMLElement | null = null;
  private btnNext: HTMLElement | null = null;
  private choicesContainer: HTMLElement | null = null;

  public static getInstance(): NpcDialogueModalController {
    if (!this.instance) {
      this.instance = new NpcDialogueModalController();
    }
    return this.instance;
  }

  private initDom(): void {
    if (this.modal) return;
    this.modal = byId('modal-npc-dialogue');
    this.portraitEl = byId('npc-dialogue-portrait');
    this.speakerNameEl = byId('npc-dialogue-speaker-name');
    this.speakerTitleEl = byId('npc-dialogue-speaker-title');
    this.titleEl = byId('npc-dialogue-title');
    this.textEl = byId('npc-dialogue-text');
    this.btnNext = byId('btn-npc-dialogue-next');
    this.choicesContainer = byId('npc-dialogue-choices');

    if (this.btnNext) {
      this.btnNext.onclick = () => this.nextPage();
    }
  }

  public open(ref: NarrativeNodeRef): void {
    this.initDom();
    if (!this.modal) return;

    this.currentRef = ref;
    this.currentPageIdx = 0;

    // 取得或構建對話段落清單
    if (ref.node.dialoguePages && ref.node.dialoguePages.length > 0) {
      this.pages = ref.node.dialoguePages;
    } else {
      this.pages = [
        {
          speakerType: 'NPC',
          speakerName: ref.node.npcName || '神秘訪客',
          speakerTitle: '【街角遇見的旅人】',
          speakerAvatar: ref.node.npcAvatar || 'npc:npc_0',
          text: ref.node.description || '領主大人，請留步...'
        }
      ];
    }

    if (this.titleEl) {
      this.titleEl.textContent = ref.node.title || '街角見聞';
    }

    this.renderCurrentPage();
    this.modal.style.display = 'flex';
  }

  public close(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
    this.currentRef = null;
  }

  private nextPage(): void {
    if (this.currentPageIdx < this.pages.length - 1) {
      this.currentPageIdx++;
      this.renderCurrentPage();
    }
  }

  private renderCurrentPage(): void {
    if (!this.currentRef || !this.pages[this.currentPageIdx]) return;
    const page = this.pages[this.currentPageIdx];
    const isLastPage = this.currentPageIdx === this.pages.length - 1;

    let speakerName = page.speakerName || '神秘訪客';
    let speakerTitle = page.speakerTitle || '【街角遇見的旅人】';
    let avatarIcon = page.speakerAvatar || this.currentRef.node.npcAvatar || 'npc:npc_0';

    if (page.speakerType === 'PLAYER_GUARDIAN') {
      // 讀取當前領主 / 誓約守衛頭像與名稱
      const guardian = GameState.adventurers?.find(a => a.isGuardian) || GameState.adventurers?.[0];
      speakerName = guardian?.name || '誓約守衛';
      speakerTitle = ''; // 誓約守衛直接顯示名稱，不使用額外稱號

      const isFemale = (guardian?.gender as any) === 'FEMALE' || (guardian?.gender as any) === Gender.FEMALE;
      let curIcon = (guardian as any)?.avatarIcon;

      if (!curIcon) {
        const idx = (typeof guardian?.avatarIndex === 'number' && guardian.avatarIndex >= 0 && guardian.avatarIndex < 10)
          ? guardian.avatarIndex
          : (isFemale ? 0 : 1);
        curIcon = isFemale ? `guardian_f_talk_${idx}` : `guardian_m_talk_${idx}`;
      } else {
        if (curIcon.startsWith('guardian_m_') && !curIcon.includes('talk')) {
          curIcon = curIcon.replace('guardian_m_', 'guardian_m_talk_');
        } else if (curIcon.startsWith('guardian_f_') && !curIcon.includes('talk')) {
          curIcon = curIcon.replace('guardian_f_', 'guardian_f_talk_');
        }
      }
      avatarIcon = curIcon;
    }

    if (this.speakerNameEl) this.speakerNameEl.textContent = speakerName;
    if (this.speakerTitleEl) {
      if (speakerTitle && speakerTitle.trim()) {
        this.speakerTitleEl.textContent = speakerTitle;
        this.speakerTitleEl.style.display = 'block';
      } else {
        this.speakerTitleEl.textContent = '';
        this.speakerTitleEl.style.display = 'none';
      }
    }
    if (this.textEl) this.textEl.textContent = page.text;

    // 渲染 NPC 立繪大肖像 (嚴格鎖定 275.2:510 / 1:1.853 肖像畫框比例)
    if (this.portraitEl) {
      this.portraitEl.innerHTML = `
        <div style="width: 140px; height: 260px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          ${renderUniversalPortrait(avatarIcon, 140)}
        </div>
      `;
    }

    // 底部控制項
    if (isLastPage) {
      if (this.btnNext) this.btnNext.style.display = 'none';
      if (this.choicesContainer) {
        this.choicesContainer.style.display = 'flex';
        this.renderChoices();
      }
    } else {
      if (this.btnNext) this.btnNext.style.display = 'inline-block';
      if (this.choicesContainer) this.choicesContainer.style.display = 'none';
    }
  }

  private renderChoices(): void {
    if (!this.choicesContainer || !this.currentRef) return;
    this.choicesContainer.innerHTML = '';

    const choices = this.currentRef.node.choices && this.currentRef.node.choices.length > 0
      ? this.currentRef.node.choices
      : [
          {
            id: 'default_leave',
            text: '了解，願秩序庇佑領地。',
            effects: []
          }
        ];

    choices.forEach(c => {
      const afford = NarrativeSystem.canAffordChoice(c);
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.style.cssText = `
        padding: 9px 16px;
        font-size: 0.92em;
        text-align: left;
        background: ${afford.affordable ? 'linear-gradient(135deg, rgba(40, 32, 24, 0.95), rgba(20, 16, 12, 0.95))' : 'rgba(30, 25, 22, 0.6)'};
        border: 1px solid ${afford.affordable ? 'rgba(217, 119, 6, 0.5)' : 'rgba(255, 255, 255, 0.15)'};
        color: ${afford.affordable ? '#fef08a' : '#78716c'};
        border-radius: 6px;
        cursor: ${afford.affordable ? 'pointer' : 'not-allowed'};
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.15s ease;
        opacity: ${afford.affordable ? '1' : '0.6'};
      `;
      
      const missingHint = afford.affordable ? '' : `<span style="font-size: 0.8em; color: #ef4444; margin-left: auto;">⚠️ ${afford.missingReason}</span>`;
      btn.innerHTML = `<span style="color: ${afford.affordable ? '#fbbf24' : '#78716c'};">▶</span> <span>${escapeHtml(c.text)}</span> ${missingHint}`;

      if (afford.affordable) {
        btn.onmouseenter = () => {
          btn.style.borderColor = '#fbbf24';
          btn.style.background = 'linear-gradient(135deg, rgba(70, 52, 34, 0.95), rgba(35, 26, 18, 0.95))';
        };
        btn.onmouseleave = () => {
          btn.style.borderColor = 'rgba(217, 119, 6, 0.5)';
          btn.style.background = 'linear-gradient(135deg, rgba(40, 32, 24, 0.95), rgba(20, 16, 12, 0.95))';
        };

        btn.onclick = () => {
          this.selectChoice(c);
        };
      }

      if (this.choicesContainer) {
        this.choicesContainer.appendChild(btn);
      }
    });
  }

  private selectChoice(choice: NarrativeChoice): void {
    if (!this.currentRef) return;
    const afford = NarrativeSystem.canAffordChoice(choice);
    if (!afford.affordable) return;

    const storyId = this.currentRef.story.id;
    const nodeId = this.currentRef.node.id;

    NarrativeSystem.resolveChoice(storyId, nodeId, choice);
    this.close();

    // 🌟 即時更新遊戲 HUD 與街道訪客列表
    UIManager.updateUI();
    renderStreetNpcEvents();

    EventBus.getInstance().publish({
      type: GameEventType.MISSIONS_CHANGED,
      payload: { reason: 'COMPLETED' }
    });
  }
}
