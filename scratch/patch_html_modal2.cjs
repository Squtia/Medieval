const fs = require('fs');
const path = 'i:/gameproject/Medieval/index.html';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const regex = /<div class="modal-overlay" id="modal-dispatch-setup">[\s\S]*?<!-- 戰後俘虜處置 Modal -->/m;

const replacement = `<div class="modal-overlay" id="modal-dispatch-setup">
    <div class="glass-panel modal-content" style="width: 950px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 25px;">
      <button class="close-btn" id="btn-close-dispatch-setup">×</button>
      <div style="flex-shrink: 0;">
        <h2 style="text-align: center; color: #eab308; margin-top: 0; margin-bottom: 5px;" id="dispatch-setup-title">⚔️ 隊伍編制</h2>
        <p style="text-align: center; color: #94a3b8; margin-top: 0; margin-bottom: 15px;" id="dispatch-setup-desc">選擇要派出的傭兵</p>
      </div>
      
      <div style="display: flex; gap: 20px; align-items: stretch; flex: 1; min-height: 0;">
        <!-- Left Column: Mercenaries Pool & Action -->
        <div style="flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; border: 1px solid rgba(255,255,255,0.05); min-height: 0;">
          <div style="color: #cbd5e1; margin-bottom: 12px; font-weight: bold; font-size: 1.1em; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <span>⚔️ 可選傭兵</span>
            <span style="font-size: 0.8em; color: #94a3b8; font-weight: normal;">(將卡片拖曳至右側)</span>
          </div>
          
          <!-- Only this part has scrollbar, it shrinks as needed -->
          <div style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; align-content: flex-start; background: rgba(0,0,0,0.3); border-radius: 6px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);" id="dispatch-adv-list">
            <!-- JS 動態生成可派遣名單 -->
          </div>

          <!-- Options & Confirm attached to the bottom of the left column -->
          <div id="dispatch-subjugation-options" style="display: none; margin-top: 15px; padding: 12px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; flex-shrink: 0;">
            <div style="color: #cbd5e1; margin-bottom: 8px; font-weight: bold; font-size: 0.95em;">⚔️ 討伐模式：</div>
            <div style="display: flex; gap: 10px;">
              <label style="flex: 1; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; transition: background 0.2s; font-size: 0.85em;">
                <input type="radio" name="subjugation-mode" value="SINGLE" checked>
                <span>單次 <span style="color:#94a3b8; font-size:0.85em;">(1波)</span></span>
              </label>
              <label style="flex: 1; display: flex; align-items: center; gap: 6px; cursor: pointer; color: #e2e8f0; padding: 6px; background: rgba(255,255,255,0.05); border-radius: 6px; transition: background 0.2s; font-size: 0.85em;">
                <input type="radio" name="subjugation-mode" value="PROGRESS">
                <span>連續 <span style="color:#fbbf24; font-size:0.85em;">(3波)</span></span>
              </label>
            </div>
          </div>
          
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
              <div>
                <div style="color: #94a3b8; font-size: 0.85em; margin-bottom: 2px;">預估隊伍總戰力</div>
                <div id="dispatch-total-power" style="color: #eab308; font-size: 1.5em; font-weight: bold; line-height: 1;">0</div>
              </div>
              <div style="background: rgba(234, 179, 8, 0.15); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(234, 179, 8, 0.3);">
                <span style="color: #fbbf24; font-size: 0.85em; font-weight: bold;" id="dispatch-req-power">🎯 目標：-</span>
              </div>
            </div>
            <div id="dispatch-risk-preview" style="margin-bottom: 12px; color: #cbd5e1; font-size: 0.85em; min-height: 36px; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 4px; border-left: 3px solid #3b82f6;">風險與獎勵將在選擇隊伍後顯示。</div>
            <button id="btn-confirm-dispatch" class="action-btn" style="width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; letter-spacing: 2px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">🚀 確認出發</button>
          </div>
        </div>

        <!-- Right Column: Formation & Grid -->
        <div style="flex: 1; display: flex; flex-direction: column; padding: 15px; background: rgba(0,0,0,0.4); border: 1px solid rgba(234,179,8,0.3); border-radius: 8px; position: relative; box-shadow: inset 0 0 30px rgba(0,0,0,0.8); min-height: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(234,179,8,0.2); padding-bottom: 10px; flex-shrink: 0;">
            <div style="color: #eab308; font-weight: bold; font-size: 1.1em; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">🛡️ 出戰陣型與隊伍</div>
            <select id="dispatch-formation-select" style="background: #1e293b; color: #ebdcb6; border: 1px solid #8b4513; padding: 4px 8px; border-radius: 4px; font-family: 'Inter', sans-serif; cursor: pointer; outline: none; box-shadow: 0 2px 5px rgba(0,0,0,0.5); font-weight: bold; font-size: 0.9em;">
              <!-- JS 動態產生選項 -->
            </select>
          </div>
          
          <div id="dispatch-formation-desc" style="flex-shrink: 0; color: #e2e8f0; font-size: 0.85em; margin-bottom: 15px; text-align: center; min-height: 24px; background: rgba(0,0,0,0.5); padding: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
            <!-- 陣型描述 -->
          </div>
          
          <!-- 3x3 戰術板 (Centered) -->
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; min-height: 0; overflow-y: auto;">
            <div id="dispatch-team-grid" style="display: grid; grid-template-columns: repeat(3, 90px); grid-template-rows: repeat(3, 105px); gap: 10px; justify-content: center; position: relative; z-index: 2; margin: auto;">
              <!-- JS 動態生成 9 個格子 -->
            </div>
          </div>
          
          <!-- 預設隊伍按鈕區塊 -->
          <div style="display: flex; gap: 8px; justify-content: center; margin-top: 15px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;" id="preset-buttons-container">
            <button class="action-btn btn-preset" data-preset="0" style="padding: 4px 10px; font-size: 0.85em; background: rgba(255,255,255,0.1); border-radius: 4px;">隊伍 1</button>
            <button class="action-btn btn-preset" data-preset="1" style="padding: 4px 10px; font-size: 0.85em; background: rgba(255,255,255,0.1); border-radius: 4px;">隊伍 2</button>
            <button class="action-btn btn-preset" data-preset="2" style="padding: 4px 10px; font-size: 0.85em; background: rgba(255,255,255,0.1); border-radius: 4px;">隊伍 3</button>
            <button class="action-btn btn-preset" data-preset="3" style="padding: 4px 10px; font-size: 0.85em; background: rgba(255,255,255,0.1); border-radius: 4px;">隊伍 4</button>
            <button class="action-btn btn-preset" data-preset="4" style="padding: 4px 10px; font-size: 0.85em; background: rgba(255,255,255,0.1); border-radius: 4px;">隊伍 5</button>
            <button id="btn-save-preset" class="action-btn" style="padding: 4px 10px; font-size: 0.85em; background: rgba(59,130,246,0.4); border-color: #3b82f6; border-radius: 4px; box-shadow: 0 0 10px rgba(59,130,246,0.3);">💾 儲存</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 戰後俘虜處置 Modal -->`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Patch complete.');
} else {
    console.log('Regex not found!');
}
