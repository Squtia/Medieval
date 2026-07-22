import { GameState } from '../core/GameState';
import { ToastManager } from './ToastManager';
import { UIManager } from './UIManager';
import { Random } from '../core/Random';
import { Adventurer } from '../models/Adventurer';
import { NameGenerator } from '../systems/NameGenerator';
import { DataStore } from '../systems/DataStore';
import { getMaxRosterLimit } from '../models/types';

export function initRecruitController(): void {
  const modalRecruit = document.getElementById('modal-recruit');
  const recruitCardsContainer = document.getElementById('recruit-cards-container');
  const btnRecruit = document.getElementById('btn-recruit');
  const btnCloseRecruit = document.getElementById('btn-close-recruit');

  if (!modalRecruit || !recruitCardsContainer || !btnRecruit) return;

  btnRecruit.addEventListener('click', () => {
    const territory = GameState.myTerritory;
    const tavernLvl = territory.tavernLevel || 0;
    if (tavernLvl <= 0) {
      ToastManager.show('⚠️ 請先至領主自宅（書房）建造冒險者酒館！');
      return;
    }
    
    const maxRoster = getMaxRosterLimit(territory.title);
    if (GameState.adventurers.length >= maxRoster) {
      ToastManager.show(`⚠️ 英雄名單已滿！當前爵位最多容納 ${maxRoster} 名英雄。`);
      return;
    }

    if (territory.gold >= 500) {
      recruitCardsContainer.innerHTML = '';
      
      // 品質隨機抽取算法
      const getQuality = (lvl: number): 'N' | 'R' | 'SR' | 'SSR' => {
        const r = Random.next();
        if (lvl === 1) {
          return r < 0.1 ? 'R' : 'N';
        } else if (lvl === 2) {
          if (r < 0.1) return 'SR';
          if (r < 0.4) return 'R';
          return 'N';
        } else { // 3級
          if (r < 0.1) return 'SSR';
          if (r < 0.3) return 'SR';
          if (r < 0.7) return 'R';
          return 'N';
        }
      };

      const getQualityLabel = (q: string) => {
        if (q === 'SSR') return { label: 'SSR 傳奇', color: '#eab308' };
        if (q === 'SR') return { label: 'SR 史詩', color: '#a855f7' };
        if (q === 'R') return { label: 'R 精英', color: '#3b82f6' };
        return { label: 'N 普通', color: '#94a3b8' };
      };

      for (let i = 0; i < 3; i++) {
        const quality = getQuality(tavernLvl);
        const qInfo = getQualityLabel(quality);
        
        const adv = new Adventurer(`adv_${Date.now()}_${i}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), quality);
        
        const card = document.createElement('div');
        card.className = 'recruit-card';
        card.style.border = `2px solid ${qInfo.color}`;
        card.style.boxShadow = `0 4px 15px ${qInfo.color}40`;
        
        card.innerHTML = `
          <div style="font-size:2em; margin-bottom:10px;">🦸</div>
          <strong>${adv.name}</strong><br/>
          <span style="color: ${qInfo.color}; font-weight: bold; font-size: 0.95em;">${qInfo.label}</span><br/>
          <span style="color:#cbd5e1; font-size:0.85em;">${adv.job.name} | ${adv.trait.name}</span><br/>
          <div style="margin-top:10px; font-size:0.85em; color:#94a3b8; line-height: 1.4; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px;">
            力:${adv.baseAttributes.str} 敏:${adv.baseAttributes.agi} 體:${adv.baseAttributes.con}<br/>
            智:${adv.baseAttributes.int} 精:${adv.baseAttributes.spr} 幸:${adv.baseAttributes.luk}
          </div>
        `;
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'action-btn';
        btnConfirm.style.marginTop = '15px';
        btnConfirm.style.width = '100%';
        btnConfirm.style.fontSize = '0.9em';
        btnConfirm.style.background = 'linear-gradient(135deg, #059669, #047857)';
        btnConfirm.innerText = '✅ 招募此人 (500金)';
        card.appendChild(btnConfirm);
        
        btnConfirm.addEventListener('click', (e) => {
          e.stopPropagation();
          if (territory.gold >= 500) {
            territory.gold -= 500;
            GameState.adventurers.push(adv);
            console.log(`🍻 [酒館] 花費 500 金幣招募了新夥伴「${adv.name}」(${qInfo.label}) 加入冒險者行列！`);
            modalRecruit.classList.remove('active');
            UIManager.updateUI();
          } else {
            ToastManager.show('⚠️ 金幣不足！');
          }
        });
        recruitCardsContainer.appendChild(card);
      }
      modalRecruit.classList.add('active');
    } else {
      ToastManager.show('⚠️ 金幣不足 500，無法進行招募！');
    }
  });

  if (btnCloseRecruit) {
    btnCloseRecruit.addEventListener('click', () => {
      modalRecruit.classList.remove('active');
    });
  }
}
