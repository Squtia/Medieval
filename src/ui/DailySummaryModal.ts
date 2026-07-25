import { GameState } from '../core/GameState';
import { getOfficeConfig } from '../models/types';

/**
 * 顯示每日結算與預測面板
 * @param onConfirm 使用者確認後的回呼函數 (用於關閉面板後繼續遊戲流程)
 */
export function showDailySummaryModal(onConfirm: () => void): void {
  const modal = document.getElementById('modal-daily-summary');
  if (!modal) {
    onConfirm();
    return;
  }
  
  // 1. 渲染本日結算
  renderDailySummary();

  // 2. 渲染未來預測
  renderForecast();

  // 3. 綁定按鈕
  const btnConfirm = document.getElementById('btn-daily-summary-confirm');
  if (btnConfirm) {
    // 為了防止重複綁定，我們先克隆節點
    const newBtn = btnConfirm.cloneNode(true) as HTMLElement;
    btnConfirm.replaceWith(newBtn);
    newBtn.addEventListener('click', () => {
      modal.classList.remove('active');
      onConfirm();
    });
  }
  
  // 顯示 Modal
  modal.classList.add('active');
}

function renderDailySummary() {
  const container = document.getElementById('daily-summary-content');
  if (!container) return;
  
  const summary = GameState.lastDailySummary;
  if (!summary) {
    container.innerHTML = '<p style="color: #94a3b8; font-style: italic;">無結算資料</p>';
    return;
  }

  let html = `<ul style="list-style: none; padding: 0; color: #ebdcb6; font-size: 1.05em;">`;
  
  // 金幣變化
  const goldColor = summary.goldDelta >= 0 ? '#4ade80' : '#ef4444';
  const goldSign = summary.goldDelta > 0 ? '+' : '';
  if (summary.goldDelta !== 0) {
    html += `<li style="margin-bottom: 8px;">💰 國庫資金：<span style="color: ${goldColor}; font-weight: bold;">${goldSign}${summary.goldDelta}</span> 金幣</li>`;
  }
  
  // 食物變化
  const foodColor = summary.foodDelta >= 0 ? '#4ade80' : '#ef4444';
  const foodSign = summary.foodDelta > 0 ? '+' : '';
  if (summary.foodDelta !== 0) {
    html += `<li style="margin-bottom: 8px;">🍞 存糧消耗：<span style="color: ${foodColor}; font-weight: bold;">${foodSign}${summary.foodDelta}</span> 單位</li>`;
  }

  // 資源 (綜合)
  if (summary.woodDelta !== 0 || summary.stoneDelta !== 0 || summary.ironDelta !== 0) {
    html += `<li style="margin-bottom: 8px;">📦 資源變動：木材 ${summary.woodDelta > 0 ? '+'+summary.woodDelta : summary.woodDelta} | 石材 ${summary.stoneDelta > 0 ? '+'+summary.stoneDelta : summary.stoneDelta} | 鐵礦 ${summary.ironDelta > 0 ? '+'+summary.ironDelta : summary.ironDelta}</li>`;
  }

  // 人口變化
  if (summary.populationDelta !== 0) {
      const popColor = summary.populationDelta > 0 ? '#4ade80' : '#ef4444';
      const popSign = summary.populationDelta > 0 ? '+' : '';
      html += `<li style="margin-bottom: 8px;">👥 人口變動：<span style="color: ${popColor}; font-weight: bold;">${popSign}${summary.populationDelta}</span> 人</li>`;
  }

  if (summary.goldDelta === 0 && summary.foodDelta === 0 && summary.woodDelta === 0 && summary.stoneDelta === 0 && summary.ironDelta === 0 && summary.populationDelta === 0) {
     html += `<li style="color: #94a3b8; font-style: italic;">今日領地度過了平靜的一天，沒有顯著的資源變動。</li>`;
  }

  html += `</ul>`;
  container.innerHTML = html;
}

function renderForecast() {
  const container = document.getElementById('daily-forecast-content');
  if (!container) return;

  // 距離發薪日還有幾天
  const currentDay = GameState.totalDays; // 因為已經 advanceDay，所以這是新的一天
  let daysToPayday = 7 - (currentDay % 7);
  if (daysToPayday === 7) {
    daysToPayday = 7; // 如果 %7 == 0，代表今天「剛剛」發薪完，下一次是 7 天後。
  }

  let html = ``;

  if (daysToPayday <= 3) {
    // 3 天內預警
    // 預估維護費
    const popUpkeep = Math.floor(GameState.myTerritory.population * 0.5);
    
    // 預估薪資
    let wages = 0;
    GameState.adventurers.forEach(adv => {
      if (adv.office) {
        wages += Math.floor(getOfficeConfig(adv.office).salary * 7 / 30);
      } else {
        wages += 7;
      }
    });

    const totalExpense = popUpkeep + wages + GameState.myTerritory.diplomaticGift;
    const warningColor = daysToPayday === 1 ? '#ef4444' : '#eab308'; // 剩1天時顯示紅色，其他黃色

    html += `
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div style="font-size: 2em;">📅</div>
        <div>
          <div style="font-weight: bold; font-size: 1.1em; color: ${warningColor};">距離發薪日還有 ${daysToPayday} 天</div>
          <div style="color: #cbd5e1; font-size: 0.95em; margin-top: 5px;">
            預估結算總支出：<span style="color: #ef4444; font-weight: bold;">-${totalExpense}</span> 金幣<br>
            <span style="font-size: 0.85em; color: #94a3b8;">(包含人口維護費 ${popUpkeep} 與傭兵薪俸 ${wages})</span>
          </div>
          ${totalExpense > GameState.myTerritory.gold ? `<div style="color: #ef4444; margin-top: 5px; font-weight: bold;">⚠️ 警告：國庫資金不足，若破產可能導致官員離職！</div>` : ''}
        </div>
      </div>
    `;
  } else {
    html += `
      <div style="display: flex; align-items: center; gap: 10px; color: #94a3b8;">
        <div style="font-size: 1.5em;">📅</div>
        <div>
          <div>距離下一次發薪日還有 <strong>${daysToPayday}</strong> 天。</div>
          <div style="font-size: 0.85em; margin-top: 4px;">國庫狀況目前穩定，請安心經營。</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}
