export function initLogger(logContainer: HTMLElement) {
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    originalConsoleLog(...args);
    let msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    
    const div = document.createElement('div');
    div.className = 'log-entry';
    
    // 尋找包含在中括號內的標籤
    const tagMatch = msg.match(/\[(.*?)\]/);
    let tagText = '系統'; // 預設標籤
    
    if (tagMatch) {
      tagText = tagMatch[1];
      msg = msg.replace(`[${tagText}]`, '').trim(); // 從訊息中移除標籤文字
    } else if (msg.includes('遊戲啟動') || msg.includes('夥伴')) {
      tagText = '系統';
    }
    
    const tagSpan = document.createElement('span');
    tagSpan.className = 'log-tag';
    tagSpan.textContent = tagText;
    
    let categoryStr = 'system';
    
    // 依據標籤文字套用不同的顏色類別
    if (tagText.includes('系統')) { tagSpan.classList.add('tag-system'); categoryStr = 'system'; }
    else if (tagText.includes('任務') || tagText.includes('討伐')) { tagSpan.classList.add('tag-combat'); categoryStr = 'combat'; }
    else if (tagText.includes('內政') || tagText.includes('謁見') || tagText.includes('遷移')) { tagSpan.classList.add('tag-domestic'); categoryStr = 'domestic'; }
    else if (tagText.includes('招募') || tagText.includes('訓練')) { tagSpan.classList.add('tag-recruit'); categoryStr = 'recruit'; }
    else if (tagText.includes('探索')) { tagSpan.classList.add('tag-explore'); categoryStr = 'domestic'; }
    else { tagSpan.classList.add('tag-default'); categoryStr = 'system'; }
    
    div.setAttribute('data-category', categoryStr);
    div.appendChild(tagSpan);
    
    const msgSpan = document.createElement('span');
    msgSpan.textContent = msg;
    msgSpan.style.flex = '1';
    div.appendChild(msgSpan);
    
    logContainer.appendChild(div);
    
    // 同時輸出到世界地圖右側的小通知欄
    const mapLogContainer = document.getElementById('map-log-container');
    if (mapLogContainer) {
      const mapDiv = div.cloneNode(true) as HTMLElement;
      mapLogContainer.appendChild(mapDiv);
      // 限制 20 筆
      if (mapLogContainer.children.length > 20) {
        mapLogContainer.removeChild(mapLogContainer.firstChild!);
      }
      setTimeout(() => {
        mapLogContainer.scrollTop = mapLogContainer.scrollHeight;
      }, 10);
    }
    
    // 延遲滾動到底部以確保 DOM 已經更新
    setTimeout(() => {
      logContainer.scrollTop = logContainer.scrollHeight;
    }, 10);
  };
}
