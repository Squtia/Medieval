import { StoryStudioStore } from './StoryStudioStore';
import { escapeHtml } from './StoryStudioTypes';
import { renderUniversalPortrait } from '../../ui/IconSpriteHelper';

export class StoryStudioPreview {
  private store: StoryStudioStore;
  private previewCurrentPageIdx: number = 0;
  private previewGuardianGender: 'MALE' | 'FEMALE' = 'FEMALE';

  constructor(store: StoryStudioStore) {
    this.store = store;
  }

  public mount(): void {
    const btn = document.getElementById('btn-story-preview-dialogue');
    if (btn) {
      btn.addEventListener('click', () => this.open());
    }
  }

  public open(): void {
    const node = this.store.getActiveNode();
    if (!node) return;

    const modal = document.getElementById('modal-story-dialogue-preview');
    if (!modal) return;

    const pages = (node.dialoguePages && node.dialoguePages.length > 0)
      ? node.dialoguePages
      : [{
          speakerType: 'NPC',
          speakerName: node.npcName || '神秘訪客',
          speakerTitle: '【街角遇見的旅人】',
          speakerAvatar: node.npcAvatar || 'npc:npc_0',
          text: node.description || '（此節點尚未設定對話內容）'
        }];

    const titleEl = document.getElementById('story-preview-dialogue-node-title');
    const portraitEl = document.getElementById('story-preview-dialogue-portrait');
    const speakerNameEl = document.getElementById('story-preview-dialogue-speaker-name');
    const speakerTitleEl = document.getElementById('story-preview-dialogue-speaker-title');
    const textEl = document.getElementById('story-preview-dialogue-text');
    const prevBtn = document.getElementById('btn-story-preview-dialogue-prev');
    const nextBtn = document.getElementById('btn-story-preview-dialogue-next');
    const pageIndicator = document.getElementById('story-preview-dialogue-page-indicator');
    const choicesEl = document.getElementById('story-preview-dialogue-choices');
    const closeBtn = document.getElementById('btn-close-story-dialogue-preview');

    if (titleEl) titleEl.textContent = node.title || '對話事件';

    const renderPage = (idx: number) => {
      this.previewCurrentPageIdx = idx;
      const page = pages[idx] || pages[0];
      const isLastPage = idx >= pages.length - 1;

      let speakerName = page.speakerName || node.npcName || '神秘訪客';
      let speakerTitle = page.speakerTitle || '【街角遇見的旅人】';
      let avatarIcon = page.speakerAvatar || node.npcAvatar || 'npc:npc_0';

      if (page.speakerType === 'PLAYER_GUARDIAN') {
        speakerName = this.previewGuardianGender === 'FEMALE' ? '誓約守衛 (女·玩家自訂)' : '誓約守衛 (男·玩家自訂)';
        speakerTitle = ''; // 誓約守衛不顯示稱號
        avatarIcon = this.previewGuardianGender === 'FEMALE' ? 'guardian_f_talk:guardian_f_talk_0' : 'guardian_m_talk:guardian_m_talk_1';
      }

      if (speakerNameEl) {
        if (page.speakerType === 'PLAYER_GUARDIAN') {
          speakerNameEl.innerHTML = `
            <span>${escapeHtml(speakerName)}</span>
            <button id="btn-toggle-preview-gender" type="button" style="margin-left: 6px; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #fde68a; cursor: pointer;">
              🔄 切換性別 (${this.previewGuardianGender === 'FEMALE' ? '女' : '男'})
            </button>
          `;
          document.getElementById('btn-toggle-preview-gender')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.previewGuardianGender = this.previewGuardianGender === 'FEMALE' ? 'MALE' : 'FEMALE';
            renderPage(this.previewCurrentPageIdx);
          });
        } else {
          speakerNameEl.textContent = speakerName;
        }
      }

      if (speakerTitleEl) {
        if (speakerTitle && speakerTitle.trim()) {
          speakerTitleEl.textContent = speakerTitle;
          speakerTitleEl.style.display = 'block';
        } else {
          speakerTitleEl.textContent = '';
          speakerTitleEl.style.display = 'none';
        }
      }

      if (textEl) textEl.textContent = page.text;

      if (portraitEl) {
        portraitEl.innerHTML = `
          <div style="width: 140px; height: 260px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${renderUniversalPortrait(avatarIcon, 140)}
          </div>
        `;
      }

      if (pageIndicator) {
        pageIndicator.textContent = `頁數 ${idx + 1} / ${pages.length}`;
      }

      if (prevBtn) {
        prevBtn.style.display = idx > 0 ? 'inline-block' : 'none';
        prevBtn.onclick = () => renderPage(idx - 1);
      }

      if (isLastPage) {
        if (nextBtn) nextBtn.style.display = 'none';
        if (choicesEl) {
          choicesEl.style.display = 'flex';
          choicesEl.innerHTML = '';
          const choices = (node.choices && node.choices.length > 0)
            ? node.choices
            : [{ id: 'default_confirm', text: '知悉並繼續', effects: [], resultText: '' }];

          choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.style.cssText = `
              flex: 1 1 calc(50% - 10px);
              min-height: 42px;
              padding: 8px 12px;
              font-size: 0.85rem;
              text-align: center;
              border-radius: 6px;
              border: 1px solid rgba(217, 119, 6, 0.4);
              background: rgba(30, 25, 20, 0.9);
              color: #fde68a;
              cursor: pointer;
              transition: all 0.15s ease;
            `;
            btn.textContent = `▶ ${choice.text}`;
            btn.onmouseenter = () => {
              btn.style.borderColor = '#fbbf24';
              btn.style.background = 'rgba(217, 119, 6, 0.3)';
            };
            btn.onmouseleave = () => {
              btn.style.borderColor = 'rgba(217, 119, 6, 0.4)';
              btn.style.background = 'rgba(30, 25, 20, 0.9)';
            };
            btn.onclick = () => {
              const effectSummary = choice.effects.length > 0
                ? `\n觸發效果：${choice.effects.map(e => e.type).join(', ')}`
                : '';
              const resultMsg = choice.resultText ? `\n結果說明：${choice.resultText}` : '';
              alert(`【測試預覽】您選擇了：${choice.text}${resultMsg}${effectSummary}`);
              closeModal();
            };
            choicesEl.appendChild(btn);
          });
        }
      } else {
        if (nextBtn) {
          nextBtn.style.display = 'inline-block';
          nextBtn.onclick = () => renderPage(idx + 1);
        }
        if (choicesEl) choicesEl.style.display = 'none';
      }
    };

    const closeModal = () => {
      modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => {
      if (e.target === modal) closeModal();
    };

    renderPage(0);
    modal.style.display = 'flex';
  }
}
