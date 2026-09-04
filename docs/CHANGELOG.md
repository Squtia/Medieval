- **[Fix/CombatVFX/SSOTPublishAndRestoreDefense] 特效工房 SSOT 發布伺服器端校驗防線、路徑逃逸防護與還原前備份機制全面落地（2026-09-04）**：
  - **🛡️ 伺服器端 SSOT 寫入嚴格防線 (Batch G)**：
    - 在 `src/ui/fx/VFXPresetValidator.ts` 擴充 `impactCues` 結構校驗（唯一 cueId、0 <= time <= duration、NaN / Infinity 阻斷）。
    - 改造 `vite.config.ts` 中的 `POST /__vfx_api/save_ssot` 端點，增加 `validateVfxPresetsServer` 伺服器端校驗；驗證失敗立即回傳 400 狀態碼與詳細錯誤清單，不建立快照、不覆蓋 `src/data/vfx_presets.json`。
  - **🔒 快照還原安全契約與路徑防逃逸 (Batch G)**：
    - 升級 `POST /__vfx_api/restore_snapshot` 與 `/api/restore-vfx-backup` 端點，實裝 `path.basename(filename) === filename` 嚴格校驗與 `vfx_snapshot_` 前綴檢查，徹底阻斷 `../` 或絕對路徑逃逸攻擊。
    - 快照還原前實施內容合法性再檢驗，並於覆寫前自動為當前主設定建立 `vfx_snapshot_pre_restore_*` 備份，保障資料可追溯性與可逆性。
  - **🧪 自動化單元測試通過**：
    - 新增 `src/systems/combat/VFXSSOTPublishAndRestore.test.ts`（5 項安全性與資料不變量測試 100% PASS）。

- **[Fix/CombatVFX/ActionPlayerAndCueMappingFix] 真正的 CombatAction 播放鏈、單次播放保證與 Impact Cue 純函式配對系統全面落地（2026-09-04）**：
  - **🎬 真正的 CombatAction 播放鏈 (Batch C)**：
    - 建立 `src/ui/fx/CombatActionPlayer.ts`，以 `actionId` 為穩定邊界封裝單一技能行動，徹底解決多個 HIT 事件重複重播完整 VFX 與笛卡爾積跳字問題。
    - 一個技能行動只呼叫一次 `VFXPlayer` (CombatFXEngine)，由內部 Cue 時間點精確調度與消費多個已結算的 impacts。
    - 改造 `CombatStudio.ts`，徹底移除 `.catch(() => {})` 靜默吞掉錯誤的反模式，輸出可觀察診斷日誌。
  - **🧮 Impact Cue 與傷害呈現語意純函式映射 (Batch D)**：
    - 實裝純函式 `mapImpactsToCues()`，確立 Presentation 唯一資料契約 `CombatImpactPresentation`，禁止 UI 與 StageAdapter 自行二度乘除 `damage * weight`。
    - 三種打擊感呈現語意嚴格落地：
      - `EXACT_IMPACTS`：N 筆結算 impact 精確配對 N 個 Cue，逐筆呈現原始 amount。
      - `SPLIT_SINGLE_IMPACT`：單筆大傷害依 Cue 數量做整數安全分配，餘數進終擊段，片段加總 100% 精確等於來源 amount。
      - `PRIMARY_ONLY`：僅在 isPrimary Cue 呈現數值，其餘 Cue 只做無數值打擊反饋與火花爆散。
      - 目標隔離：多目標 AOE 事件依 `targetId` 嚴格分組，絕不將 A 目標數值呈現在 B 目標。
    - `CombatStudioStageAdapter` 接入 `mapImpactsToCues`，廢除現場乘除運算，跳字完全依已配對金額直接呈現。
  - **🧪 全量驗收五合一通過 (npm run check)**：
    - 新增 `src/systems/combat/CombatActionAndCueMapping.test.ts`（8 項不變量與調度測試 100% PASS）。
    - 全專案 41 個測試檔案、232 項單元測試 100% PASS，`typecheck` 0 錯誤，Vite 建置成功，P0 冒煙測試 5 階段全過，Bundle Budget 安全。

- **[Fix/VFXStudio/ClockAndTimelineEditingFix] 特效工房單一演出時鐘 (PlaybackClock)、精準播放速度/暫停/取消與專業多軌時間軸編輯能力全面落地（2026-09-04）**：
  - **⏱️ 單一演出邏輯時鐘與排程器 (Batch E)**：
    - 建立 `src/ui/fx/PlaybackClock.ts`，將動畫進度、Cue、次生圖層、受擊定格反饋與清理排程全部統一收攏至單一 `logicalTime`，徹底解決過去原生 `setTimeout` 與動畫 delta 縮放脫節的問題。
    - `CombatFXEngine` 整合 `PlaybackClock`：
      - `advance(rawDelta)`：慢動作 0.3x、正常 1.0x、加速 2.0x 均直接縮放 `logicalDelta`，保證 Cue 在相同的 `normalizedProgress` 觸發。
      - `pause()` / `resume()`：暫停時邏輯時間完全凍結，任何 Cue、跳字或完成事件 100% 零觸發；恢復時從原邏輯點平滑推進。
      - `seek(targetTime, suppressCues)`：明確定義 Seek 行為，倒退時自動重置到期任務，向前時抑制重複爆音。
      - `clear()`：清空所有排程任務，pending 數歸零，舊回呼絕不再被執行；連續 20 次快速播放只執行最後一次 callback。
      - `VFXStudioAdapter` 受擊反饋改用 `scheduleLogical`，使慢動作下受擊擠壓與浮字時間自然同步放大。
  - **🎛️ 專業多軌時間軸 (VFXTimeline) 實裝 (Batch F)**：
    - 解決初次載入空白問題：`VFXTimeline` constructor 完成後立即執行 `this.render(this.store.getPreset())`。
    - 尺規與播放頭：實裝頂部時間刻度尺 (`#tl-ruler-bar`) 與動態貫穿播放頭 (`#tl-playhead`)，即時反映當前邏輯秒數。
    - 支援點擊 / 拖動尺規進行即時 Scrubbing / Seek。
    - 支援 Cue Marker 指標拖曳微調時間（限制在 0～duration），並即時反映於 DOM 標記。
    - **Undo Transaction 交易保護**：拖曳移動期間不累積多餘歷史堆疊，僅在 `pointerup` 釋放時提交唯一一筆快照。
    - 支援 Cue 軌雙擊空白處新增 Cue、Shift+點擊快速刪除 Cue。
  - **🧪 全量驗收五合一通過 (npm run check)**：
    - 新增 `src/systems/combat/PlaybackClockAndTimeline.test.ts`（8 項測試 100% PASS）。
    - 全專案 40 個測試檔案、224 項單元測試 100% PASS，`typecheck` 0 錯誤，Vite 建置成功，P0 冒煙測試 5 階段全過，Bundle Budget 安全。
    - 執行 `scripts/verify-vfx-studio-layout.mjs`，4 大 Viewport（1440x900, 1280x720, 1024x768, 768x900）無頭驗收全綠，Console 0 錯誤。

- **[Fix/VFXStudio/DOMHierarchyAndInspectorContractFix] 特效工房 DOM 結構層級修正、四種 Viewport 響應式適配與 Inspector Control Map 契約完整落地（2026-09-04）**：
  - **📐 DOM 結構修復與階層純化 (Batch A)**：
    - 修復 `tools/vfx-studio.html` 中 `.viewport-container`、`#viewport`、`.scene-overlay` 與 `#timeline-mount-point` 閉合標籤錯置問題，使中央畫布舞台（min-height: 240px，flex: 1）與獨立底部時間軸容器（height: 140px）成為清晰的同級兄弟節點。
    - 統一右側面板為 `#inspector-right.inspector-panel.sidebar-right`，對齊 CSS 樣式與 TypeScript 選擇器契約。
    - 補齊情境式區塊標記 class：`.card-slash-section`、`.card-salvo-section`、`.card-spike-section`。
  - **📱 響應式重排與 100% 零水平溢出 (Batch A)**：
    - 改造 `src/styles/vfx-studio.css`，移除暴力 `body { overflow-x: hidden !important; }`，實裝 1440x900、1280x720、1024x768、768x900 四種視窗真實重排。
    - 實測所有視窗下 `body.scrollWidth <= clientWidth`（1440/1440, 1280/1280, 1024/1024, 768/768），舞台與時間軸尺寸皆 > 0。
  - **🎛️ Inspector Control Map 單一契約與零 undefined 保證 (Batch B)**：
    - `src/tools/vfx-studio/VFXInspector.ts` 建立包含 50+ 項參數之 `INSPECTOR_CONTROL_MAP`，修正 `param-punch-scale`、`param-shake-intensity`、`param-spike-material-mode` 之 ID 契約不一致。
    - 實裝 `bindSelectBoolean` 正確解析 `<select>` 字串布林值（`"true"`/`"false"`），修正 `slashAlternating`、`multiHitImpact`、`spikeEruptFire` 等開關失效問題。
    - 實裝 `normalizeVfxPreset` 邊界處理，全量 30 款正式 Preset 遍歷加載後畫面文字 100% 零 `undefined`、零 `NaN`。
  - **🧪 自動化與瀏覽器驗證**：
    - `VFXStudioBaseline.test.ts` 新增 3 項契約測試（DOM 階層、Control Map 1:1 對應、零 undefined 檢測），全量 216 個測試全綠。
    - 建立 `scripts/verify-vfx-studio-layout.mjs`，Playwright 自動化無頭驗證四種 Viewport，Console 0 錯誤通過。

- **[Major/CombatVFX/StudioRebuildFinalAndModularPurification] 特效工房全模組化純化、複合多軌時間軸、技能創作解耦與效能預算系統完全落地（2026-09-04）**：
  - **📐 HTML 純化與全面模組化 (Phase 3 & 13. 完成定義)**：
    - `tools/vfx-studio.html` 行數從 2,148 行純化至 753 行（達成「HTML < 800 行且不含任何播放函式」之硬性規範），頁面完全不殘留任何私有渲染、播放函式或大量內嵌腳本。
    - 建立 `src/tools/vfx-studio/` 模組目錄：
      - `VFXStudioStore.ts`：集中管理 50 步 Undo/Redo 歷史堆疊、Dirty Flag、固定 Seed PRNG 與多軌靜音狀態。
      - `VFXTimeline.ts`：實裝具名複合多軌時間軸（Main Track / Layers Track / Impact Cue Track），支援 Mute 靜音、動態新增 Cue、組合鍵移除 Cue、呈現模式切換（EXACT / SPLIT / PRIMARY）。
      - `VFXLibrary.ts`：集中管理預設清單、CRUD、專案 SSOT 發布快照，並將專案技能驗收與普攻自訂特效連結中樞封裝進獨立的折疊面板（`<details>`），使左側參數創作區徹底解耦。
      - `VFXInspector.ts`：封裝左右側卡片的情境式顯隱、雙向滑桿數值即時連動與動態圖層編輯 UI。
      - `VFXStudioController.ts`：主控制器中樞，串聯 Store、Timeline、Inspector、Library 與 `VFXStudioAdapter`，整合單體／前排／全體 AOE 陣型切換與全域快捷鍵（空白鍵播放、Ctrl+Z/Y）。
      - `index.ts`：對外提供自啟動模組入口，使 `tools/vfx-studio.html` 僅需載入單一 module script。
  - **📊 效能預算 HUD (Draw Call & Object Budget)**：
    - 在 3D 舞台頂部右上角實裝即時效能預算監控浮動面板，500ms 輪詢 Draw Calls、場景物件數量與活躍粒子總數；當 Draw Calls > 12 或 Objects > 30 時以黃色/紅色高亮示警。
  - **🧪 全量五合一驗收 100% 綠燈 (npm run check)**：
    - 全專案 39 個測試檔案、213 項單元測試 100% PASS，`typecheck` 0 錯誤，生產環境打包成功，Smoke Test 全部 5 階段通過，Bundle Budget 3,749,519 / 4,000,000 bytes 安全過關。

- **[Major/CombatVFX/UIModularityAndUndoRedoComplete] 特效工房 CSS 模組化抽出、Undo/Redo 歷史堆疊、Dirty Flag 與固定 Seed 隨機可重現機制全面落地（2026-09-04）**：
  - **🎨 UI 模組化與 CSS 外置 (Phase 3)**：
    - 將 `tools/vfx-studio.html` 內嵌之 470+ 行 CSS 完整抽離為獨立樣式檔案 `src/styles/vfx-studio.css`，HTML 瘦身降至 2,100 行以內。
    - 在 `src/styles/vfx-studio.css` 實裝 1024x720、1080x800、1280x900 響應式佈局斷點與 `body { overflow-x: hidden !important; }`，徹底防止側欄截斷與水平捲動溢出。
    - 徹底移除 HTML 內殘留的 `import * as THREE from 'three'`，實現 HTML 零 Three.js import 規範。
  - **↩️ 50 步 Undo/Redo 歷史堆疊與 Dirty Flag (Phase 4)**：
    - 實裝 Command Pattern 歷史管理器（`undoStack`, `redoStack`，上限 50 步），支援滑桿拖曳、參數微調與預設切換之自動快照。
    - 支援頂部工具列「↩️ 復原」、「↪️ 重做」按鈕與全域快捷鍵（`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`）。
    - 實裝 Dirty Flag：變更參數時即時點亮「● 未發布」提醒標籤與 `beforeunload` 離開確認防呆，發布至 SSOT 成功後自動消除。
  - **🎲 固定 Seed 隨機可重現機制 (Phase 4)**：
    - 頂部工具列提供「🎲 固定 Seed」核取方塊。勾選時在播放期間掛載確定性 PRNG（線性同餘 / LCG），使碎岩破土時差、受擊微擾、粒子散佈 100% 幀同步精準重現，播放完畢後自動還原原生 `Math.random`。
  - **🧪 全量驗收五合一通過 (Phase 7)**：
    - `npm run check`（`typecheck` + `test` + `build` + `test:smoke` + `check:bundle`）全數通過，39 個測試檔案、213 項單元測試 100% PASS！

- **[Major/CombatVFX/StudioRebuildAndStageAdapterPipeline] 特效工房全管線重構、3D 實體尖岩地裂浪湧與三端同源戰鬥演出適配器全面落地（2026-09-04）**：
  - **🏛️ 徹底消弭雙重 Renderer、雙 Canvas 與雙 RAF 迴圈 (Phase 1)**：
    - 從 `tools/vfx-studio.html` 完全移除 1,300+ 行獨立私有 Three.js 渲染與舊版 RAF 迴圈，終結歷史遺留的雙 Canvas（`#three-canvas` 與 `#three-combat-fx-canvas`）記憶體競爭與資源外洩。
    - 全工坊與主遊戲統一由 `src/ui/fx/CombatFXEngine.ts` 單例中樞負責 3D 特效渲染、相機投影、生命週期管理與 `clear()` 取消機制。
  - **🔒 Repository 統一中樞與 DEV 安全發布快照端點 (Phase 2)**：
    - `tools/vfx-studio.html` 全面接入 `VFXPresetRepository`，杜絕直接覆寫 LocalStorage 陣列導致 Schema v2/v3 結構遺失的缺陷。
    - 在 `vite.config.ts` 開發伺服器擴充 DEV 專屬端點：`POST /__vfx_api/save_ssot`、`POST /__vfx_api/snapshot`、`GET /__vfx_api/list_snapshots`，支援一鍵發布至專案核心 `src/data/vfx_presets.json`，並在 `src/data/snapshots/` 自動備份時間戳安全快照。
  - **🌋 3D 實體尖岩漫反射、大地衝擊地裂浪湧與伴生地火 (Phase 3)**：
    - **立體刀削碎岩**：次生岩刺支援 `MeshPhongMaterial`（`flatShading: true`）與局部光源（DirectionalLight + AmbientLight），以 5 面不對稱三角錐呈現真實稜角明暗漫反射，徹底告別發光平坦紙片。
    - **大地衝擊地裂浪湧 (GROUND_FISSURE)**：實裝沿施術者至目標向量的推進波次管線，由近及遠循序破土，附帶地表焦黑撕裂網格與碎岩震飛。
    - **伴生噴火連爆 (`spikeEruptFire`)**：岩刺破土頂峰伴生體積熱浪連鎖爆裂，完美呈現地心烈焰穿透地表的震撼感。
  - **⏱️ 具名 Impact Cue 與時間軸消費機制 (Phase 4)**：
    - 實裝具名 `impactCues`（`cueId`, `time`, `weight`, `isPrimary`）與打擊感呈現模式（`EXACT_IMPACTS`, `SPLIT_SINGLE_IMPACT`, `PRIMARY_ONLY`）。
    - 在特效工房舞台下方建立視覺化時間軸控制器與打擊標記面板，支援即時預覽與具名標記編輯。
  - **📦 SSOT 預設庫 100% 升級與複合圖層啟用 (Phase 5)**：
    - `src/data/vfx_presets.json` 升級至 30 款唯一 ID 預設庫（包含新增之旗艦地裂衝擊浪湧 `VFX_EARTH_SPIKE`），100% 補齊具名 `impactCues`。
    - 6 款旗艦核心技能（`VFX_EARTH_SPIKE`, `VFX_HEAVY_STRIKE`, `VFX_FIREBALL`, `VFX_VOLUMETRIC_METEOR`, `VFX_PHANTOM_SLASH`, `VFX_TREBUCHET_BOULDER`）正式啟用次生複合圖層 `layers`。
  - **⚔️ 戰鬥演播室 (Combat Studio) 三端同源視覺演出整合 (Phase 6)**：
    - 建立 `src/ui/fx/adapters/CombatStudioStageAdapter.ts`，將戰鬥工房 3x3 棋盤雙向擂台與 `CombatFXEngine` 深度整合。
    - 支援單場回放事件實時播放 3D 特效、攻擊者微幅突進衝刺、受擊卡牌定格擠壓與抖動（`--punch-scale`, `--shake-x`, `--flash-color`）、漂浮傷害跳字（普通、暴擊 💥、治療 💚、閃避 MISS）。
    - 提供「🎬 特效: 開/關」即時切換鈕與「⚡ 直達結算」，支援快轉與 `clear()` 零殘留，蒙地卡羅 100 場模式保持純數值 headless 高速運算。
  - **🛡️ 品質驗收與測試矩陣 (Phase 7)**：
    - 新增專屬單元測試 `src/systems/combat/CombatStudioAdapter.test.ts`，全專案 39 個測試檔案、210 項單元測試 100% PASS！
    - `tsc --noEmit` 0 錯誤、`npm run build` 生產環境打包 100% 成功。

- **[Feature/CombatVFX/BasicAttackLinkerAndStudioDefectFixes] 普攻自訂特效接口全面開放與特效工坊 10 大體驗缺陷修復（2026-09-03）**：
  - **⚔️ 普攻自訂創作與連結接口 (Basic Attack VFX Linker)**：
    - 在 `src/data/SkillData.ts` 實裝 `getBasicAttackVfxId(actor)` 函數，支援 LocalStorage（`MEDIEVAL_BASIC_ATTACK_VFX_BINDINGS`）優先層疊比對：武器類型（`weaponType`）➔ 基礎職業（`baseClass`）➔ 攻擊型態（`attackType`）➔ 預設三態 fallback。
    - `src/systems/CombatSystem.ts` 普通攻擊判定處全面接入 `getBasicAttackVfxId(actor)`，徹底解耦寫死普攻。
    - 在 `tools/vfx-studio.html` 左側面板新增「⚔️ 普攻自訂特效連結」管理面板，支援將自創特效一鍵綁定至各武器類型（巨劍、戰弓、法杖、雙匕首、劍盾、聖典等），並可一鍵還原；同時在技能驗收下拉選單最上方注入各職業普通攻擊選項，點擊即時驗收打擊感！
  - **🛠️ 特效工坊 10 大缺陷與視覺升級完整修復**：
    - **右側 Inspector 底部遮蔽修復**：為 `#inspector-right` 補上 `.inspector-panel` 與 `padding-bottom: 140px`，徹底解決打擊感卡片被底部工具列遮擋的問題。
    - **體積黑體動態火焰熱浪震顫**：在著色器實裝 `uTurbulence` 與 `uTurbulenceSpeed` uniforms，提供熱浪震顫強度（0~18px）與震顫速度（0.5~5.0x）雙滑桿即時調控。
    - **全特效（含冰箭）泛光半徑與透明度連動**：`playIceLanceEffect` 補上 Glow Sprite，並將泛光半徑與透明度與 UI 滑桿緊密連動。
    - **受擊散佈半徑 (`salvoSpreadRadius`)**：多發連射目標點依散佈半徑進行環狀/隨機偏移，呈現真實彈幕落點散佈。
    - **連斬角度擾動 (`slashAngleJitter`) & 交錯反手**：每段出刀起始角疊加隨機擾動，並支援左右交錯反手出刀。
    - **複合多圖層積木雙軌排程**：支援直接引用預設庫子特效（`layer.presetId`）與自訂屬性圖層雙軌延遲排程。
    - **地刺方向自訂 (`spikeAngle`) 與幾何軸向校正**：徹底移除破壞 XY 軸向的 `spikeGeo.rotateX(Math.PI/2)`，將幾何體錨點設於底座（`translate(0, h/2, 0)`），尖端隨方位角旋轉精準指向目標角度（90° 沖天、0° 向右、180° 向左、0° 環形），修正「底左尖右」的幾何軸向錯誤；修復 `GROUND_ERUPTION` 中 `spikeAngle` 為 0 時因 JS 短路求值被誤判為 90 的問題。
    - **地刺腳底貼地生長、生長分佈範圍 (`spikeRadius`) 與 🎲 亂數洗牌連鎖破土 (`spikeStagger`)**：
      - 徹底解決「地刺從怪物臉上生出來」的問題：向上突刺（45°~135°）或地表破土時，生成基準點自動下沉至受擊怪物**腳底地面線**（`pos.y - 65`），從地表穿透拔地衝天而起！
      - 實裝地刺生長分佈範圍滑桿 (`spikeRadius`，20px ~ 280px)：地刺橫跨整片地面排開，告別擠在 10px 鼻尖小點的窘境。
      - **🎲 破土時差全面改採 Fisher-Yates 亂數洗牌演算法**：徹底告別流水線由左至右排隊破土的死板感，每根地刺擁有獨立亂數先後順序，且疊加高度起伏微擾（82%~118%）與 Z 軸前後微深淺，呈現如地震崩裂般的狂暴混亂破土打擊感！
    - **🔮 複合多圖層積木 (Layers) 獨立子預設渲染與二次 HIT 打擊反饋**：
      - 徹底修復圖層播放函式寫死讀取全域 `config` 導致子圖層無效果的底層缺陷：各特效渲染函式全面重構為支援 `pCfg` 獨立配置，子圖層完整繼承其專屬色彩、尺寸、Shader 與形態。
      - 實裝二次打擊聯動：勾選「產生戰鬥 HIT」之圖層在命中時獨立觸發目標卡片二次受擊抖動、受擊閃光與暴擊跳字，真正實現連環大招的複合打擊層次感！
    - **受擊擴散光圈全面可調、邊緣羽化 (Wave Blur) 與 2.5D 水平地面透視**：擴散光圈支援半徑、線寬、自訂顏色、邊緣柔焦羽化 (`smoothstep`)；修正「水平地面」因轉 90° 垂直於正向相機導致厚度 0 像素隱形的問題，採用 68° 2.5D 俯視傾角並下沉至受擊角色腳底地面（`pos.y - 65`），呈現逼真的地面橢圓形衝擊光浪。
  - **🛡️ 驗證進度**：37 個測試檔案 197 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatSkill/CompositeSkillEngineOverhaul] 積木技能核心邏輯補完 (Phase 6) 與多目標獨立分流 (2026-09-03)**：
  - **🎯 多目標獨立重新解析 (resolveBlockTargets)**：
    - 在 `SkillEffectEngine.ts` 實裝 `resolveBlockTargets`，各 Effect Block 依其專屬 `targetType` 獨立重新自 `allEnemies` 與 `allAllies` 解析目標名單，徹底支援「單體傷害 → 自我治療 → 全隊 Buff」三 block 複合技能，各 block 目標互不干擾。
  - **🩸 Block HP Cost、Mark Cost 與縮放策略 (ScaleType)**：
    - 支援 `cost.hpPercent`（獻祭自身 HP%）與 `cost.consumeMarks`（消耗受術者標記）。
    - 實裝 `scaleType` 縮放機制：`BY_SELF_LOST_HP`（損失生命增傷）、`BY_MARK_STACKS`（印記增傷）、`BY_STATUS_COUNT`、`BY_ALLY_COUNT`。
    - 支援 `IS_CRIT` 條件分支（前段暴擊追擊）與 `DELAYED_BOMB` 延遲效果。
  - **🗃️ SkillRegistry 統一中樞與動態註冊整合**：
    - `SkillRegistry` 統一管理編譯時 JSON、LocalStorage 草稿（`MEDIEVAL_CUSTOM_SKILLS`）與動態自訂註冊，`SkillEffectEngine.triggerHooks` 全面改向 Registry 索取定義。
    - `Skill` 與 `CompositeSkillDefinition` 擴充 `vfxId` 與 `accuracyPolicy`。
  - **🛡️ 驗證進度**：37 個測試檔案 197 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Test/CombatVFX/FullTestMatrixAndDefinitionOfDoneCompleted] 戰鬥時間軸與視覺回放 12 種經典測試矩陣全數落地、Definition of Done 全面達成（2026-09-03）**：
  - **🧪 12 種戰鬥與視覺回放情境整合測試實裝 ([`CombatActionTimeline.test.ts`](file:///i:/gameproject/Medieval/src/systems/combat/CombatActionTimeline.test.ts))**：
    - 單體一擊 (1 DAMAGE / 1 Cue)：單次命中、單次扣血、單次跳字。
    - 單體三連擊 (3 DAMAGE / 3 Cues)：三次依序跳出真實傷害，終結重擊暴擊。
    - 單次傷害多段演出：驗證 `PRIMARY_ONLY`（前段無跳字，最後一段 Primary Cue 結算）與 `SPLIT_SINGLE_IMPACT`（固定整數分配算法，餘數末段補齊，總和精確一致且遊戲判定僅一次）。
    - 3 人 AOE (3 DAMAGE / 1 Cue)：同一 cue 同步三個受擊目標，目標隔離各得其所。
    - 3 人 × 2 HIT (6 DAMAGE / 2 Cues)：每個目標各顯示兩段打擊。
    - 連鎖雷擊 (N DAMAGE / N Cues)：每一跳目標不同且依 `impactIndex` 鏈式遞減傳遞。
    - 吸血 (DAMAGE + HEAL)：敵方受擊扣血、施術者綠字治療增加 HP。
    - 護盾攔截 (SHIELD + DAMAGE)：護盾吸收與 HP 穿透分離結算。
    - 治療／Buff (HEAL / STATUS)：不出現受擊抖動與負傷跳字，僅觸發恢復/增益演出。
    - MISS：不扣 HP、不產生受擊抖動。
    - Skip／關閉零殘留：`clear()` 徹底取消定時器，零殘留 callback。
    - 複合圖層：多層次生圖層視覺 cue 播放，但真實遊戲傷害嚴格只有一份。
  - **🏆 重構接手文件 Definition of Done 全數成立**：
    - `docs/VFX_COMBAT_PIPELINE_HANDOVER.md` 規劃之 16 大完成定義條件全部達成並通過勾選。
  - **🛡️ 驗證進度**：37 個測試檔案 192 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatVFX/UnifiedVFXPlayerAndStudioAdapter] 特效共用播放器 (VFXPlayer)、工房沙盒適配器 (VFXStudioAdapter) 與渲染中樞統一 (Phase 3)（2026-09-03）**：
  - **🎬 VFXPlayer 統一出口模組實裝 (Phase 3)**：
    - 新增 `src/ui/fx/VFXPlayer.ts`：導出 `CombatFXEngine` / `VFXPlayer`、`VFXStudioAdapter`、`VFXPresetRepository` 與 `VFXPresetValidator`，為全專案提供單一門面出口（Facade）。
    - `CombatFXEngine` 新增 `playPresetConfig`：支援直接以記憶體中動態 `VFXPreset` 物件播放特效，並導出 `VFXPlayer` 別名以對齊架構規範。
  - **🔌 VFXStudioAdapter 工房專用適配器實裝 (Phase 3)**：
    - 新增 `src/ui/fx/VFXStudioAdapter.ts`：自動計算施術者與受術目標在 Viewport 內部的精確相對螢幕像素座標，支援單目標打擊與多目標（AOE）並發同步回放。
    - 受擊卡片受術時自動觸發物理衝擊位移（`shake-hit`）與回呼轉發。
  - **🛠️ 特效工房 (vfx-studio.html) 接入共用管線 (Phase 3)**：
    - 工房內部接入 `VFXStudioAdapter` 與 `VFXPresetRepository`；存檔與讀取全面轉由 Repository 統一處理，出廠還原呼叫 `resetToFactoryDefaults()`。
    - 徹底終結過去工房與遊戲各自維護一套 Three.js 渲染與圖層排程的歷史問題，實戰回放與工房調參 100% 相同表現。
  - **🛡️ 驗證進度**：37 個測試檔案 180 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatVFX/PresetRepositoryAndCombatStudioAudit] 特效預設分層倉庫 (VFXPresetRepository)、強健資料驗證 (VFXPresetValidator) 與戰鬥工坊 Action/Impact 稽核整合（2026-09-03）**：
  - **🗃️ VFXPresetRepository 分層架構實裝 (Phase 4)**：
    - 新增 `src/ui/fx/VFXPresetRepository.ts`：建立 `builtIn`（官方內建）、`overrides`（內建微調覆寫）、`custom`（使用者自訂）三層資料結構，LocalStorage 具備 Schema v2 版本控管與向後相容 Migration。
    - 提供出廠還原、即時快取合成與變更監聽者廣播機制（`invalidate/reload`）。
    - 重構 `CombatFXEngine.ts` 之 `getPreset`，直接接入 `VFXPresetRepository` 作為專案單一真理來源（SSOT）。
  - **🔍 VFXPresetValidator 強健驗證器實裝 (Phase 4)**：
    - 新增 `src/ui/fx/VFXPresetValidator.ts`：自動驗證 Preset 必填欄位、合法軌跡 (`trajectory`)、著色模式 (`shaderMode`)、打擊設定與唯一 ID 檢查。
    - 新增 `validateSkillVfxMap`：在單元測試與建構階段全面稽核 `SKILL_VFX_MAP` 全技能映射，保證無孤兒特效引用。
  - **⚔️ 戰鬥平衡工坊 Action/Impact 與 Cue 稽核整合 (Phase 5)**：
    - `src/tools/CombatStudio.ts`：在單場戰鬥播放器中實裝 Action/Impact 與 VFX Cue 即時分析標籤，日誌逐行顯示 `actionId`、段數進度（`Seg X/Y`）與 `vfxId`。
    - 實裝段數不一致警告標籤（`⚠️ impact(X) ≠ cue(Y)`），協助企劃與特效師於戰鬥工坊中即時抓出數值段數與視覺連射不匹配問題。
  - **🛡️ 驗證進度**：37 個測試檔案 180 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Refactor/CombatVFX/PipelineOverhaulAndAoeTargetDecouple] 特效工房 × 戰鬥管線重大重構：Action/Impact 契約實裝、AOE 多目標跳字血條獨立化、定時器取消機制與二次座標轉換修復（2026-09-03）**：
  - **🛡️ 戰鬥事件層級契約升級 (Action/Impact Contract)**：
    - `src/models/Combat.ts`：新增 `CombatImpactKind`（`DAMAGE` | `HEAL` | `SHIELD_DAMAGE` | `STATUS_APPLY` | `MISS`），並於 `CombatEvent` 擴充 `actionId`、`impactIndex`、`impactCount` 與 `impactKind`。
    - `src/systems/CombatSystem.ts`：為所有普通攻擊與技能施放產生唯一 `actionId`，同一招式之 `SKILL_CAST` 與衍生之 `HIT`/`CRIT`/`HEAL`/`SHIELD_DAMAGE` 皆繫結相同 `actionId` 並精確標記 `impactIndex` 序號與總打擊段數。
  - **👥 徹底根除 AOE 多目標集中第一人與血條覆蓋 BUG (P0-1 Resolved)**：
    - `src/ui/CombatUIManager.ts`：徹底廢止過去無腦 Lookahead 合併同 actor 傷害之錯誤機制。改以 `targetEventsMap` 依受術目標進行分組，AOE 技能對全體造成的傷害，各目標卡片各自獨立觸發打擊抖動、各自跳出專屬傷害數字，最後一段各目標各自精確更新血條至其真實剩餘 HP，杜絕跨目標合併或血條錯亂覆蓋。
  - **🥊 演出模式決策落地 (Presentation Modes)**：
    - 真多段技能（`EXACT_IMPACTS`）每個 cue 逐段跳出真實打擊數值與暴擊；單次傷害多段演出（`PRIMARY_ONLY`）落實使用者決策以**最後一段**為 Primary Cue 彈出完整結算跳字，前段僅播放視覺受擊抖動與粒子微粒，不產生虛假跳字。
  - **⏱️ 特效定時器取消與生命週期管理 (P0-5 Resolved)**：
    - `src/ui/fx/CombatFXEngine.ts`：引入 `playbackGeneration` 與 `scheduledTimers` 集合，封裝 `registerTimer`；當玩家點擊 Skip 或提早關閉彈窗呼叫 `clear()` 時，100% 取消所有 salvo、layer 與 failsafe 定時器，杜絕舊回呼與背景特效殘留。
    - 在 Node/vitest 環境提供透明相容防呆，支援無 DOM 環境安全執行。
  - **🌍 消除複合圖層二次世界座標轉換 (P0-4 Resolved)**：
    - 分離公開方法 `playPreset`（接收 `ScreenPoint` 並呼叫 `screenToWorld`）與內部核心方法 `playPresetWorld`（直接接收 `THREE.Vector3` 世界座標）；複合圖層遞迴調用 `layer.presetId` 時直傳世界座標，杜絕二次轉換偏離畫面的問題。
    - `VFXLayer` 介面擴充 `emitsImpactCue`，精確標示子圖層僅提供視覺命中 cue，不重複偽造戰鬥總傷害。
  - **🧹 Preset 資料庫清洗與重複 ID 修正 (P1-2 Resolved)**：
    - `src/data/vfx_presets.json`：修復重複宣告的 `VFX_METEOR_STRIKE`，將其中一款毀滅黑體隕石重命名為 `VFX_VOLUMETRIC_METEOR`，確保資料庫 29 款 Preset ID 100% 唯一無衝突。
  - **🧪 回歸測試套件建立 (Phase 0)**：
    - 新增 `src/systems/combat/CombatActionTimeline.test.ts`（6 項單元測試，涵蓋契約、Preset 唯一性、定時器取消、AOE 多目標隔離與 PRIMARY_ONLY 最後一段命中規則）。
  - **🛡️ 驗證進度**：37 個測試檔案 178 項單元測試全數通過、TypeScript 0 錯誤、Vite 生產建構 0 錯誤。

- **[Fix/CombatVFX/StudioUISquishAndOverlapFix] 特效工房控制項重疊壓字與卡片高度遭 Flex 壓縮截斷根因修復（2026-09-03）**：
  - **📐 卡片高度遭 Flexbox 擠壓截斷根本問題修復**：
    - 側邊欄容器 `.sidebar-left` 為 `display: flex; flex-direction: column;`，子項目 `.inspector-card` 預設 `flex-shrink: 1` 且帶有 `overflow: hidden;`，在視窗垂直空間有限時遭 Flex 引擎強行壓縮卡片高度，導致卡片底部選項（如「拋物弧高」、「多段打擊反饋」、「音波圈數」等）遭生硬截斷。
    - 為 `.inspector-card` 加上 `flex-shrink: 0;` 與 `overflow: visible;`，確保每張卡片皆 100% 自適應完整展開，由側邊欄滾動條統一平滑滾動。
  - **🎛️ 滑桿與標籤垂直間距與重疊壓字徹底排查**：
    - 卡片內部 `.inspector-card-body` 間距提高至 `gap: 11px;`，`.param-col` 間距設為 `gap: 4px;`。
    - 為 `.param-control` 設定最小基準高度 `min-height: 24px;`，為 `.param-slider` 設定適度上下邊距 `margin: 6px 0;`，使滑桿 thumb 圓點上下擁有充裕安全距離，徹底杜絕圓點與下排標籤文字緊貼壓蓋現象。
    - `.param-row-2col` 設為 `align-items: flex-start;`，避免左欄 slider 與右欄 select 混合時因元素高度不一致造成互相拉扯變形。
    - 右側面板底邊距增加至 `padding-bottom: 100px;`，確保最底端打擊感卡片內容絕不被固定的底部按鈕列遮擋。
  - **🛡️ 驗證進度**：36 個測試檔案 172 項測試全數通過、TypeScript 與 Vite 建構 0 錯誤。
- **[Feature/CombatVFX/StudioDeepOverhaul7CoreIssuesResolved] 特效工房與戰鬥管線 7 大核心痛點徹底修復與深度重構（2026-09-03）**：
  - **💥 命中爆裂碎屑座標系 BUG 徹底修復**：
    - 修復過去 `spawnImpactBurst` 將微粒 `pts` 誤加入世界座標系 `scene` 導致爆散全部在螢幕正中央 `(0, 0)` 炸開的致命 BUG。
    - 改為 `group.add(pts)` 並初始化於局部座標原點 `(0, 0, 0)`，使所有碎屑 100% 精準在受擊目標胸膛上向四周劇烈炸開。
  - **🧩 複合多圖層積木排程器 (Composite Preset Sequencer) 實裝**：
    - 徹底捨棄寫死次生圖層的舊設計，重構為「Preset 特效積木排程器」：支援動態新增/刪除多層、每層下拉引用現有庫中任何 Preset ID、自由設定觸發延遲（0~1.0s），並新增「產生戰鬥 HIT（`generatesHit`）」真實打擊判定選項，可直接以積木化方式組合出多段連環大招。
  - **🔥 GLSL 體積黑體輻射動態火焰著色器 (Volumetric Flame Simplex Shader) 實裝**：
    - 在 `CombatFXEngine.ts` 與 `vfx-studio.html` 中實裝 `createVolumetricFlameMaterial`，運用 3D Simplex Noise 頂點法線位移顫動與熱能黑體輻射光譜，讓火球與暗影在沙盒與實戰中呈現活體燃燒搖曳的體積火焰質感。
  - **🎯 彈幕受擊散佈半徑 (`salvoSpreadRadius`) 實裝**：
    - 支援 0px ~ 140px 受擊散佈範圍。多發連射時子彈終點在目標周圍微幅擾動散佈，不再呆板全數打在同一個像素點。
  - **⚔️ 斬擊多發多角度隨機切入與交錯出刀實裝**：
    - 新增 `slashAngleJitter`（角度隨機擾動 ±0° ~ ±60°）與 `slashAlternating`（多發斬擊左右反手交錯出刀），實現劍士狂風亂舞、左右開弓的暴風連斬視覺體驗。
  - **🌋 次生地刺/晶刺多幾何形態與尺寸控制實裝**：
    - 擴充 `spikeShape`（❄️ 尖銳冰晶尖刺 `CONE_SPIKE`、💎 六角稜柱水晶 `CRYSTAL_PRISM`、🪨 粗糙地裂尖岩 `JAGGED_ROCK`、🏛️ 破土圓柱地樁 `PILLAR_COLUMN`）、`spikeWidth`（粗細 2px~30px）與 `spikeHeight`（高度 15px~120px）。
  - **💡 精準光學與泛光控制（徹底根除 Canvas CSS 濾鏡過曝災難）**：
    - 徹底拔除 `canvas.style.filter = drop-shadow(...) brightness(...)` 造成的全畫布失真過曝，改為精準材質控制：新增 `glowRadius`（光暈半徑 10~220px）、`glowOpacity`（光暈透明度 0.0~1.0）與 `coreBrightness`（核心白熾度 0.2x~2.0x），使高光耀眼而輪廓清晰。
  - **🛡️ 驗證進度**：36 個測試檔案 172 項測試全數通過、TypeScript 與 Vite 建構 0 錯誤。
- **[Feature/CombatVFX/StudioPipelineFullOverhaulAndMultiTargetSandbox] 特效工房全管線深度重構、技能雙向綁定打通、通用動態渲染器實裝、幽靈控制項落實與 AOE 多目標驗收模式（2026-09-03）**：
  - **🔗 技能一鍵雙向綁定與中英文 ID 完美對齊**：
    - 修復過去特效工房選單存中文名稱，而戰鬥核心傳英文代碼導致自訂綁定無效的致命斷鏈問題。
    - `src/data/SkillData.ts` 之 `getSkillVfxId` 實裝中英文 ID 雙向反查容錯機制；`tools/vfx-studio.html` 在綁定時同時將中文技能名稱與代碼 ID 寫入 `MEDIEVAL_SKILL_VFX_BINDINGS`，進入戰鬥 100% 精準生效。
  - **🚀 遊戲本體特效引擎 (`CombatFXEngine.ts`) 全面參數化動態升級**：
    - 徹底廢除過去呼叫寫死常數舊函式的做法，新增 `playDynamicProjectile`、`playDynamicLightning`、`playDynamicBeam`、`spawnSecondarySpikes` 與 `spawnDynamicImpactBurst`。
    - 全面 100% 動態接收並渲染 Preset 核心色、邊緣色、縮放比例、飛行時長、拖尾粒子、次生冰刺破片與自轉角速度。
    - 次生多圖層 (`layers`) 支援動態排程與延遲子圖層發射。
  - **❄️ 幽靈控制項全面落實（UI 控制項 100% 賦予真實代碼功能）**：
    - **動態飛行拖尾粒子發射器 (Trail Emitter)**：實裝 `trailCount` 與 `trailSize`，投射物飛行移動時在身後動態拋灑帶有擴散微擾與淡出漸層的微粒。
    - **次生冰錐/晶刺破片 (`spikes` / `spikeHeight`)**：當 `spikes > 0` 時，在命中點生成錐狀晶體放射狀破裂生長與淡出；`VFX_ICE_LANCE` 出廠設定啟用 8 根冰刺。
    - **Mesh 自轉角速度 (`spin`)**：投射物與法球每幀依據 `spin` 角速度即時旋轉。
    - **菲涅爾冰晶著色器 (`fresnel`)**：將菲涅爾材質實際套用至冰晶與法球，拉動滑桿即時展現邊緣折射高光。
  - **👥 多目標 (AOE) 與要塞城門舞台驗收模式實裝 (`tools/vfx-studio.html`)**：
    - 頂部工具列新增「受擊目標模式」切換：支援 `[🎯 單體受擊]`、`[👥 前排橫掃 (3人)]`、`[🌪️ 全體轟炸 (6人)]`、`[🏰 要塞城門]`。
    - 多張卡片支援同時產生受擊形變、抖動、高光閃爍與分段跳字，大幅提升群攻技能打擊感驗收體驗。
  - **💾 SSOT 專案庫導出與還原出廠預設**：
    - 工具列底部新增「💾 導出專案庫」（一鍵複製完整 `vfx_presets.json` 格式陣列）與「🔄 還原出廠」（清除本機 LocalStorage 快取並恢復官方原創預設）。
  - **🛡️ 驗證進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Feature/CombatVFX/RazorEdgeGradientAndThicknessControl] 斬擊特效質感重塑（漸層氣浪+剃刀鋒刃+胸膛貫穿校準）與刀芒粗細半徑控制項實裝（2026-09-03）**：
  - **🗡️ 斬擊質感徹底重塑（告別肥厚棉花糖死白塊）**：
    - **`src/ui/fx/CombatFXEngine.ts`** & **`tools/vfx-studio.html`**：
      - **剃刀鋒刃 (Razor Edge) + 氣浪漸層 (Air Wave Gradient) 著色器 (`slashShaderMat`)**：將厚實實心面片改為帶有頂點 UV 漸層的半透明氣浪 Shader。外弧 $vUv.y = 1.0$ 為超亮白熱極細刃線（1~2px），內弧 $vUv.y = 0.0$ 與刃頭刃尾兩端自然平滑淡出至透明（Alpha = 0），使斬擊呈現鋒利如刀、破空撕裂的真實光芒，徹底消除截圖中死白厚塊。
      - **胸膛中心貫穿平移校準 (Center Through Cut)**：計算揮砍弧線中心角 `centerAngle`，為幾何體引入向心平移偏移量 `(cos * radius * 0.82, sin * radius * 0.82)`，使劍芒在揮擊中段**精確斬入目標卡片正胸膛中心**，徹底解決原本刀光落在卡片右邊外側空揮的錯位問題。
  - **🎛️ 刀芒粗細與半徑控制項實裝**：
    - **`src/models/VFX.ts`**：`VFXPreset` 擴充 `slashBladeWidth?: number`（刀芒粗細，預設 10px，範圍 2px~50px）與 `slashRadius?: number`（劍氣半徑，預設 65px，範圍 30px~130px）。
    - **`tools/vfx-studio.html`**：左側「⚔️ 斬擊走向與角度控制」卡片新增**「刀芒粗細 (Thickness)」**與**「劍氣半徑 (Radius)」**雙滑桿與即時數值回填，支援隨意平滑調成極致細鋒或霸氣大劍氣浪。
  - **🛡️ 驗證進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Feature/CombatVFX/StudioHitPipelineAndSharpSlashOverhaul] 特效工房主導戰鬥HIT判定管線、全功能升級與次世代動態月牙劍氣實裝（2026-09-03）**：
  - **🥊 特效主導戰鬥 HIT 判定管線（徹底消除角色二次撞擊）**：
    - **`src/ui/CombatUIManager.ts`**：
      - `SKILL_CAST` 觸發施術者卡片單次攻擊突進（`attack-bump`），同時呼嘯發射 3D 特效。
      - 實裝前瞻傷害收割（Lookahead Damage Harvesting）：`SKILL_CAST` 預先提取後續緊隨的 `HIT/CRIT` 傷害、暴擊標記與最終剩餘血量，並將其標記為 `absorbedBySkillCast`。
      - 依據特效工房設定之 `totalHits`（`hitCount` / `salvoCount`，1~12 段），在每次特效真實命中瞬間觸發 `onImpact(impact, hitIdx, totalHits)`。
      - 命中時：目標卡片抖動受擊（前段輕微顫動、尾段重擊破甲），彈出分段傷害跳字（總傷害 / HIT 次數，尾段精準差額補齊），最後一段命中結算血條扣減與終結全螢幕震動。
      - 被吸收的後續傷害事件僅渲染戰報日誌，**角色卡片絕不再重複抽搐或二度向前撞擊**。
  - **🗡️ 次世代銳利劍氣生長演算法（告別香蕉旋轉）**：
    - **`src/ui/fx/CombatFXEngine.ts`** & **`tools/vfx-studio.html`**：
      - 摒棄過去厚實彎月幾何體的僵硬旋轉（香蕉轉圈），改為**動態破空刀刃帶狀生長演算法 (`buildDynamicSlashGeo`)**。
      - **出刀階段 (0%~45%)**：刀尖 Head 以極大加速度前衝破空展開，刀尾 Tail 延遲拉開，劍氣弧度瞬間延展至 135°~150°，尖端鋒銳極速破空。
      - **命中階段 (45%~60%)**：刃部完全伸展，達到最大跨度與白熾發光強度，精準觸發受擊斷點，並在目標受擊點爆發十字放射狀破空星芒粒子 (`playSlashSparks` / `playStudioSlashSparks`)。
      - **收刀階段 (60%~100%)**：尾部順著旋轉方向極速追趕收束，劍芒向前縮尖並線性淡出消散。
  - **🛠️ 特效工房全功能升級 (`tools/vfx-studio.html`)**：
    - **特效庫管理工具列**：新增 `[➕ 新增特效]`（自訂 ID 與名稱建立空白範本）、`[📋 複製現有]`（一鍵克隆當前特效參數並另存新預設）與 `[🗑️ 刪除自訂特效]`。
    - **🔗 技能一鍵綁定器 (Skill Binding Tool)**：在專案技能驗收窗加入「🔗 綁定至此技能」，點擊即時寫入 `localStorage('MEDIEVAL_SKILL_VFX_BINDINGS')`。
    - **`src/data/SkillData.ts`**：`getSkillVfxId()` 優先讀取自訂技能綁定表，工房設定在遊戲實機戰鬥中即時 100% 生效！
    - **🔮 複合多圖層特效卡片 (Composite Layers)**：左側面板新增多圖層組合卡片，支援疊加次生爆裂圖層（烈焰/冰晶/狂雷/聖光）與獨立延遲時間調整。
  - **🛡️ 驗證進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Fix/CombatVFX/CanvasResizeOnModalShow] 特效 canvas 尺寸重算時序修復（2026-09-03）**：
  - **🐛 根本問題**：`CombatFXEngine.mount()` 在 `init()` 時執行，此時 `combat-modal` 為 `display:none`，`clientWidth/Height = 0`，Three.js renderer 使用 fallback 尺寸 `800×500`。當 modal 顯示後，canvas CSS 為 `width:100% height:100%` 被拉伸至實際尺寸，但 renderer 未更新，導致 3D 座標系偏移，特效飛到畫面外看不到。
  - **🔧 修復**：在 `showCombat()` 和 `startInteractiveCombat()` 中，將 `CombatFXEngine.resize()` 與 `playTurnQueue()` 合併進同一個 `requestAnimationFrame` 回調，確保 modal 可見後下一幀才開始播放，此時 `clientWidth/Height` 有正確數值。
  - **涉及檔案**：`src/ui/CombatUIManager.ts`
- **[Fix/CombatVFX/SkillCastFXTarget] 技能特效飛行方向修復：SKILL_CAST 事件正確飛向受術目標（2026-09-03）**：
  - **🐛 根本問題定位**：`CombatSystem.ts` 中 `SKILL_CAST` 事件建立時，`targetId` 被設定為施術者自身（`actor.id`）導致特效飛行起點與終點相同，且未攜帶 `vfxId` 導致一律使用預設特效。
  - **🔧 修復項目**：
    - **`src/models/Combat.ts`**：`CombatEvent` 介面新增 `skillTargetId?: string` 欄位，作為 `SKILL_CAST` 的技能受術目標 ID（與 `targetId` 分離，`targetId` 保留為施術者用於 MP 條更新）。
    - **`src/systems/CombatSystem.ts`**：`SKILL_CAST` 事件新增 `skillTargetId: skillTargets[0]?.id`、`skillId: selectedSkill.id`、`skillName: selectedSkill.name`、`vfxId: selectedSkill.vfxId || getSkillVfxId(selectedSkill.id)`，使事件完整攜帶特效所需資訊。
    - **`src/ui/CombatUIManager.ts`**：`renderEventAsync` 更新：
      - `SKILL_CAST` 事件優先使用 `skillTargetId` 取得特效飛行目標元素。
      - 技能衍生的 `HIT`/`CRIT` 事件（含 `skillId`）跳過 3D FX 播放（避免與 `SKILL_CAST` 重複），但仍觸發命中 CSS 打擊感（`target-hit` 震動、`--flash-color` 閃光，暴擊時觸發全畫面 `shake`）。
  - **✅ 效果**：技能特效現在正確從施術者飛向受術目標，且命中後仍有完整的受擊打擊感動畫。
- **[Feature/CombatVFX/CompactInspectorAndFreeSlashDynamics] 特效工房右側緊湊型防遮擋重構與自由角度斬擊軌跡引擎（2026-09-03）**：
  - **📐 特效工房右側面板緊湊型防遮擋佈局重構 (`tools/vfx-studio.html`)**：
    - 徹底消除底部 Sticky 按鈕遮擋：底欄按鈕改為精緻橫向並排 (`flex-direction: row`)，高度減半，並擴充面板底部內邊距至 `75px`，使滾動至最底部時打擊感選項 100% 完整露出。
    - 全面實裝參數雙欄並排緊湊佈局 (`.param-row-2col`)：核心色與外緣色、定格與擠壓、震動與時長、擊退與高光色等全部橫排雙欄，使整體垂直高度縮減 40%，所有數值一目了然、徹底杜絕選項擠壓截斷。
  - **⚔️ 自由斬擊走向與角度動態引擎 (Slash Trajectory & Dynamics Engine)**：
    - 新增**斬擊走向預設 (`slashTrajectory`)**：一鍵切換 45° 順勢斜劈 (Cleave Down)、反手挑斬/升龍 (Uppercut)、腰際橫斬 (Horizontal Sweep)、垂直力劈 (Vertical Helm Split) 與自訂角度。
    - 新增**起手角度滑桿 (`slashAngle`)**：支援 `-180°` ~ `+180°` 360 度任意旋轉起手式。
    - 新增**揮斬弧度跨度 (`slashArcSpan`)**：支援 `30°` ~ `240°` 控制出刀是瞬殺速斬還是大開大闔揮擊。
    - 新增**刀芒長寬扁平比例 (`slashAspect`)**：支援 `0.4x` ~ `2.0x` 微調柳葉刀光或重劍氣浪。
    - 新增**揮砍反向開關 (`slashReverse`)**：順向斬擊與逆向反劈自由切換。
    - 3D 渲染核心演算法升級：採用動態旋轉與非線性加減速 Easing，演繹「破空 ➔ 受擊延展 ➔ 甩出拉長消散」之真實劍道打擊動態。
  - **🛡️ 核心型別與引擎同步 (`VFX.ts`, `CombatFXEngine.ts`)**：
    - `src/models/VFX.ts` 擴充斬擊走向與角度屬性。
    - `src/ui/fx/CombatFXEngine.ts` 之 `playArcSlash` 完整同步角度、跨度與長寬比動力學。
- **[Feature/CombatVFX/ThreeColumnStudioAndSalvoRhythm] 三欄式專業特效工房、彈幕發射節奏曲線與多段打擊管線實裝（2026-09-03）**：
  - **🏛️ 特效工房三欄式專業引擎佈局重構 (`tools/vfx-studio.html`)**：
    - 告別過去單一長滾動條，重塑為現代遊戲引擎雙側翼佈局：
      - **👈 左側翼 (350px)**：掌控發射端與外觀形態（專案技能驗收窗、彈幕連發與節奏曲線管線、專屬幾何形態與模型紋理）。
      - **🎯 中央舞台 (Flex: 1)**：開闊超寬視野舞台，置入原生卡牌、3D 畫布、頂部快捷播放控制與置底打擊感 HUD 膠囊。
      - **👉 右側翼 (350px)**：掌控受擊端與光影質感（空間軌跡時間、著色器色彩光學、粒子流碎屑、戰鬥打擊感定格與受擊形變）。
  - **🚀 彈幕發射與節奏曲線管線 (Salvo & Rhythm Pipeline)**：
    - **發射彈數調控 (`salvoCount`)**：支援 1~12 發子彈（齊射、連珠箭、奧術飛彈、連續突刺）。
    - **連射總時長調控 (`salvoDuration`)**：0.1s ~ 2.0s 隨心調節彈幕傾瀉速度。
    - **發射節奏曲線演算法 (`salvoRhythmCurve`)**：
      - 🟢 `LINEAR` 等距均勻
      - 🚀 `ACCELERATE` 先慢後快指數急速掃射
      - 💥 `DECELERATE` 爆發後對數衰減
      - ⚡ `BURST_PAIRS` 雙發成對點射
      - 🎲 `STAGGERED` 隨機錯落散佈
    - **彈道散射與拋物弧高**：支援 0°~45° 扇形散射角與 0~300px 拋物線彈道。
    - **多段打擊回饋 (`multiHitImpact`)**：前段子彈命中觸發輕度卡牌微顫與小跳字，終結一發觸發重度定格、擊退、螢幕地震與暴擊跳字。
  - **🛡️ 核心模型與預設庫同步 (`VFX.ts`, `vfx_presets.json`, `CombatFXEngine.ts`)**：
    - 在 `src/models/VFX.ts` 擴充彈幕與幾何型態定義。
    - 在 `CombatFXEngine.ts` 實裝 Promise 超時安全閥（Failsafe Timeout），杜絕戰鬥回放阻塞風險。
    - 在 `src/data/vfx_presets.json` 針對弓兵箭雨、哨所齊射、幻影劍舞、奧術飛彈賦予多發彈幕與特色節奏預設值。
- **[Feature/CombatVFX/ImpactRhythmPipelineAndStudioShowcase] 全技能特效打擊感節奏斷點管線、深化特效工房素材庫與技能驗收窗實裝（2026-09-03）**：
  - **🥊 戰鬥打擊感與節奏斷點管線 (Combat Impact & Hit Rhythm Pipeline)**：
    - 徹底重構 [`CombatUIManager.ts`](file:///d:/tryagent/Medieval/src/ui/CombatUIManager.ts) 戰報播放機制，由原本純計時器輪詢升級為非同步打擊感節奏驅動。
    - 實裝戰鬥「施法前搖墊步 (Windup) ➔ 3D 彈道飛行 ➔ 命中定格 (Hit Stop) ➔ 卡牌擠壓形變 (Punch Scale) ➔ 劇烈受擊抖動 (Shake) ➔ 穿刺擊退 (Penetration/Knockback) ➔ 受擊閃光 (Hit Flash) ➔ 傷害跳字與血條扣減 ➔ 收招」完整動態節奏。
    - 解決過去傷害數字與血條在特效飛行前就提早扣完的非同步問題。
    - **自主檢查深層修復**：
      - 修復非親征普通戰報回放播完後因 `!this.currentSession` 導致 `finishPlayback` 結算面板卡死無法彈出的重大 BUG。
      - `CombatFXEngine` 新增 `clear()` 方法，修復戰鬥中途跳過 (Skip) 或提早關閉彈窗時背景動畫與 3D 粒子洩漏殘留問題。
      - 修復受擊「擊退位移」被 CSS keyframes 覆蓋吞掉的視覺 BUG，改以動態 `--knockback-x` 變數融合進 `animHit` 關鍵影格，並依攻擊攻防陣營自動計算左右位移。
      - 特效工房手動拉動打擊感滑桿時，頂部打擊感數值 HUD 膠囊即時同步連動。
      - `getSkillVfxId` 實裝關鍵字與元素智慧匹配，讓技能工房自創技能積木自動獲得對應的 3D 特效與打擊感。
      - **🛡️ 領主軍令、攻城器械與箭塔專屬特效大升級**：
        - 新增 `VFX_CAVALRY_CHARGE`（鐵甲騎兵破陣衝鋒：金光破空、極限擊退 36px、定格 65ms、全屏劇震）。
        - 新增 `VFX_SHIELD_WALL`（步兵盾牆壁壘：巨型鋼鐵光壁升騰、反震護體光環、受擊金光）。
        - 新增 `VFX_ARROW_VOLLEY`（弓兵萬箭齊發：實裝 3D 二次貝茲曲線拋物線多重箭雨動畫、覆蓋敵陣）。
        - 新增 `VFX_TREBUCHET_BOULDER`（攻城器械·重型投石機燃燒巨石：天頂斜向砸落、碎石烈焰爆裂、全螢幕地震）。
        - 新增 `VFX_BATTERING_RAM`（攻城器械·撞木衝車破門：生鐵包箍巨木猛烈撞擊氣浪、火星迸射、城門劇烈震顫）。
        - 新增 `VFX_WATCHTOWER_VOLLEY`（要塞哨所箭塔居高齊射：自防禦制高點向下俯衝重弩穿甲彈道）。
      - **🏰 攻城戰打擊城門目標導向**：攻城器械與近戰轟擊城門時，自動將目標鎖定至 `combat-siege-gate-hud`，演繹巨石與衝車猛轟城門之 3D 特效與全屏地震。
      - **🏹 普攻彈道智慧分流**：普攻依攻擊者型態（遠程物理給飛箭、遠程魔法給秘法/火球、近戰給劈砍），徹底消除法師/弓箭手普攻出大砍刀的視覺違和感。
      - **🧙‍♂️ CHEAT 密技指令整合**：在 [`CheatController.ts`](file:///d:/tryagent/Medieval/src/ui/CheatController.ts) 實裝鍵盤盲打密技 `vfx`、`fx`、`vfxstudio`，以及控制台全域指令 `openVfxStudio()` / `cheatVfx()`，直通開啟特效工房。
      - **🚨 3D 相機視錐體遠平面裁切修復與天降流星實裝 (Critical Far Plane Fix)**：
        - 徹底排查修復 `vfx-studio.html` 與 `CombatFXEngine.ts` 中 `camera.far = 1000` 在視窗高度 > 828px 時導致相機位置超標、所有 3D 特效（刀光、流星、雷電、火球）被 WebGL 遠平面 100% 裁切成空白隱形的致命幾何 BUG；相機遠平面全面擴大至 `5000`。
        - 補齊 SSOT 預設庫 `src/data/vfx_presets.json` 遺漏的 `VFX_METEOR_STRIKE`（天降流星：斜向天降、體積黑體輻射火焰、高溫白熱核心、烈焰光暈 Sprite 與四散碎石粒子）。
        - 將「即時打擊感數值 HUD 膠囊」移至視窗底部居中浮動，徹底消除與頂部選單的重疊遮擋。
      - **🌙 流線型月牙刀芒重構、全技能語意專屬特效與無差別地刺徹底清除 (VFX Semantic Alignment Overhaul)**：
        - **斬擊幾何重構 (Crescent Blade)**：徹底揚棄平整圓環（RingGeometry）死板轉圈的水管感，實裝自訂頂點收束算法 `createCrescentBladeGeo`，兩端尖銳收束（Tapering）、中段飽滿寬闊，並支援 45° 斜劈 (Crescent Cleave)、十字交錯 (Cross Rend) 與 360° 雙刃向外螺旋擴散 (Whirlwind Dual Moon)。
        - **全技能語意精準對齊**：
          - 🛡️ 騎士【嘲諷 / 掩護】➔ 對齊為 `VFX_TAUNT_SHOUT`（赤紅多重同心威懾音波震盪向前高速擴散），徹底解決「嘲諷在砍水管」的荒謬問題。
          - 🛡️ 聖騎士【神聖庇護】➔ 對齊為 `VFX_HOLY_SHIELD`（目標身前升騰金色六角光盾晶格 + 金光外圈 + 神聖十字徽記 + 升騰光環），徹底解決「聖盾庇護沒有護盾」的語意斷層。
          - 🛡️ 符文騎士【符文反制】➔ 對齊為 `VFX_RUNE_BARRIER`（幽藍金色符文光陣身前逆轉展開）。
          - 🗡️ 刺客【瞬影殺/突襲】➔ 暗影瞬移穿透與血色十字裂傷。
        - **無差別地刺徹底清除**：
          - 全面清查 SSOT 預設庫，除 `VFX_GLACIER_SPIKE`（極地冰川裂地）保留地刺外，其餘所有預設的 `spikes` 與 `spikeHeight` **全數歸零（設為 0）**！
          - `spawnImpactBurst` 實裝向外擴散淡出之「命中能量衝擊環 (Shockwave Ring)」與火星碎屑，地刺嚴格受 `spikes > 0` 條件保護，斬擊、火球、雷電、飛箭命中再也不會長出奇怪地刺。
        - **🎛️ 特效工房全功能數值與貼圖控件擴充**：
          - 新增**「卡片 3.5: 🛡️ 專屬幾何形態與模型紋理 (Geometry & Sprite)」**，將斬擊形態（月牙、十字、雙刃旋風）、護盾樣式（六角光盾、神聖十字金盾、符文環）、戰吼音波圈數（1~5 圈）、粒子光學紋理（柔和光暈、爆裂星芒、神聖符文、烈焰黑體）全部暴露為滑桿與下拉選單。
        - **⚡ Vite 熱重載與快照覆蓋修復**：
          - 從 `vite.config.ts` 的 watch 忽略名單中移除 `**/src/data/*.json`，確保 JSON 更新即時生效。
          - 優化 `vfx-studio.html` 的 `presetMap` 快照加載邏輯，禁止舊快照覆蓋核心預設，並在 `showcaseSelect` 加入智慧 fallback 防呆。
        - **🚨 核心執行緒例外中斷修復 (Critical ReferenceError & TypeError Fix)**：
          - 徹底排查修復 `vfx-studio.html` 在 `playCurrentEffect` 首行呼叫未宣告函式 `updateLiveSettings()` 導致 `ReferenceError` 拋出未捕獲例外，以及刪除其重複宣告之 `SyntaxError`。
          - 徹底修復 `config.id` 為 `undefined` 導致在 `playSlashEffect` 判斷旋風斬時執行 `config.id.includes('WHIRLWIND')` 拋出 `TypeError: Cannot read properties of undefined (reading 'includes')` 的深層致命 BUG（該錯誤致使施法者卡牌剛微衝墊步一下後程式瞬間崩潰，後續 3D 刀芒、受擊震動、傷害跳字與自動循環全部停擺）。
          - 全面在 `config` 補齊 `id` 屬性，並以安全的 `const curId = config.id || config.preset || ''` 防呆判斷，確保 100% 順暢進入主動畫與循環播放管線！
          - 即時動態連動畫布 Drop-shadow 發光濾鏡與光學強度；優化 CSS `calc()` 跨瀏覽器相容性，加入 `will-change: transform, filter` 保證 60FPS 硬體加速。
  - **🌟 核心特效預設庫 SSOT 建立 (`src/data/vfx_presets.json` & `src/models/VFX.ts`)**：
    - 建立全專案單一真理來源（SSOT），內建 27 款涵蓋近戰、遠程、神聖、暗黑、元素、貫穿、範圍揮砍、軍令戰術、攻城器械與天降流星的預設庫，每款預設均包含打擊感數值設定。
  - **🛠️ 深化特效工房 (`tools/vfx-studio.html`)**：
    - 新增**「卡片 6: 🥊 戰鬥打擊感與節奏斷點」**控制面板，支援滑桿微調定格時長（Hit Stop: 0~150ms）、受擊形變（Punch Scale: 0.75~1.15x）、受擊震動（Shake: 0~30px）、持續時間、穿刺向後距離、擊退位移、高光顏色與全螢幕地震。
    - 支援 3D 弧刃殘影 (`SLASH_BLADE`)、天罰聖光柱 (`HOLY_LIGHT`)、暗影虛空 (`DARK_VOID`) 等新著色器核心，以及近身揮砍 (`MELEE_SWEEP`)、排式直穿 (`COLUMN_PIERCE`)、光環升騰 (`BODY_AURA`) 等軌跡。
    - 實裝本機快照同步（LocalStorage）與 JSON 導出功能。
  - **🎯 各技能專用驗收窗 (Skill Showcase Window)**：
    - 在特效工房頂部建立「🎯 技能驗收窗」選單，直連所有專案技能（如「奮力一擊」、「大劍旋風斬」、「天降流星」、「神聖之光」、「穿刺射擊」等），切換時自動更換卡片立繪與對應怪物。
    - 畫面頂部懸浮「打擊感即時數值 HUD 膠囊」，清楚展示當前技能的定格、形變、震動、擊退與穿刺參數。
    - 在 [`tools/combat-studio.html`](file:///d:/tryagent/Medieval/tools/combat-studio.html) 與特效工房之間建立雙向直達捷徑。
  - **⚔️ 全專案技能 100% 特效綁定 (`src/data/SkillData.ts`)**：
    - 建立權威的 `SKILL_VFX_MAP` 對照表，涵蓋戰士、騎士、弓手、刺客、法師、牧師與所有首領/野怪技能。
  - **新增檔案**：[`src/models/VFX.ts`](file:///d:/tryagent/Medieval/src/models/VFX.ts)、[`src/data/vfx_presets.json`](file:///d:/tryagent/Medieval/src/data/vfx_presets.json)
  - **修改檔案**：[`tools/vfx-studio.html`](file:///d:/tryagent/Medieval/tools/vfx-studio.html)、[`src/ui/fx/CombatFXEngine.ts`](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts)、[`src/ui/CombatUIManager.ts`](file:///d:/tryagent/Medieval/src/ui/CombatUIManager.ts)、[`src/data/SkillData.ts`](file:///d:/tryagent/Medieval/src/data/SkillData.ts)、[`src/models/Skill.ts`](file:///d:/tryagent/Medieval/src/models/Skill.ts)、[`src/models/Combat.ts`](file:///d:/tryagent/Medieval/src/models/Combat.ts)、[`tools/combat-studio.html`](file:///d:/tryagent/Medieval/tools/combat-studio.html)

- **[Feature/VFXStudio/ThreeJSShaderAndTransparentOverlay] 專業遊戲 3D 特效工坊（VFX Studio）與透明 WebGL 頂層覆蓋架構實裝（2026-09-02）**：
  - **🌟 獨立 3D 特效工坊 (`tools/vfx-studio.html`)**：
    - 搭建專為遊戲美術設計的獨立視覺特效沙盒，具備 Unity / Niagara 風格的專業 Inspector 調參面板。
    - **🚀 多維空間軌跡控制器 (Trajectory Mode)**：支援「🎯 水平飛射 (A ➔ B)」、「☄️ 斜向天降 (45° 俯衝流星)」、「⚡ 垂直天降 (雷擊)」、「🌋 地表破土突起 (冰川地裂)」與「🏹 拋物線拋射」。
    - **🧪 高階 GLSL 著色器核心 (Shader Core)**：
      - **❄️ 菲涅爾冰晶折射 (Fresnel Ice / Crystal)**：動態計算視角法線夾角與 SSS 假次表面透光。
      - **🔥 體積黑體輻射火焰 (Volumetric Fire & Simplex Noise)**：頂點隨 3D Noise 劇烈翻滾位移，溫度驅動白熾核心 ➔ 亮金黃 ➔ 暗紅焦灼冷卻消散。
      - **⚡ 介質擊穿分形電弧 (Dielectric Lightning)**：高頻放電分支電弧。
      - **💫 雙頻高能雷射光柱 (Dual-Freq Beam)**：內外雙層旋轉脈衝能量束。
    - **💥 Unity 式命中爆發衍生器 (Impact Sub-Emitters)**：支援自訂地面次生 3D 尖刺數量、生長高度、存活停留時間與碎裂火花/火星飛散。
    - **🌈 全域發光與光暈 (Glow & Multiplier)**：Shader 像素級 `uGlow` 乘數注入 ＋ 柔和 Glow Billboard 光暈 ＋ 動態 Canvas Drop-Shadow 濾鏡。
    - **🔄 調參輔助系統**：支援即時拉桿 0 秒重播 (Live Scrubbing)、自動循環播放 (Looping)、慢動作 (0.3x) 與 JSON 設定檔一鍵複製導出。
  - **🎭 2D DOM 卡牌底層 ＋ 頂層透明 WebGL 特效覆蓋架構**：
    - `renderer = new THREE.WebGLRenderer({ alpha: true })` ＋ `setClearColor(0x000000, 0)`，特效畫布 100% 透明懸浮於 2D 角色卡牌上方。
    - 解決 WebGL 不透明背景遮擋 2D DOM 的衝突，讓 3D 冰錐、火舌與火花自然覆蓋於卡片前方爆發，受擊時精確連動 2D 卡牌物理晃動。
  - **新增檔案**：[`tools/vfx-studio.html`](file:///i:/gameproject/Medieval/tools/vfx-studio.html)、[`src/ui/fx/CombatFXEngine.ts`](file:///i:/gameproject/Medieval/src/ui/fx/CombatFXEngine.ts)
  - **修改檔案**：[`package.json`](file:///i:/gameproject/Medieval/package.json)、[`package-lock.json`](file:///i:/gameproject/Medieval/package-lock.json)

- **[Feature/StoryStudio/NarrativeUpgradesAndFactionVisibility] 故事工房 5 大功能升級與陣營好感測試修復實裝（2026-09-02）**：
  - **🏛️ 建築物選項清理與 100% 對齊**：對齊遊戲內真實存在的 10 大建築與設施（含補齊 `church` 教會與醫療所），並新增萬用建築條件 `BUILDING_LEVEL_AT_LEAST`（支援自選任意建築與等級門檻）。
  - **🛡️ 治安度條件與 🎲 事件發生機率**：
    - 新增 `SECURITY_AT_LEAST`（治安度 $\ge$ X）與 `SECURITY_AT_MOST`（治安度 $\le$ X）條件。
    - 故事節點表單新增 `triggerChance`（事件觸發機率 1~100%，預設 100%），支援創作者設計低機率偶發事件與奇遇。
  - **💥 隨機建築受損降級效果實裝**：新增 `REDUCE_RANDOM_BUILDING_LEVEL` 效果，可指定隨機抽取 `count` 座已建建築各降級 `levels` 級，免去手動逐一配置繁複懲罰的痛點。
  - **🔍 測試沙盒陣營好感即時同步修復**：修復 [`NarrativeTestController.ts`](file:///d:/tryagent/Medieval/src/ui/NarrativeTestController.ts) 過去寫死 `INITIAL_FACTIONS` 導致自訂陣營與好感度丟失的問題，全面改為載入 `FactionManager.getAllFactions()`。
  - **🏷️ 自訂陣營好感度與外交清單顯示開關**：
    - 在自訂陣營中新增 `showInDiplomacyList` 屬性與好感度輸入。
    - 在故事工房陣營管理器中提供「☑️ 在遊戲外交清單公開」開關與「設為公開 / 設為隱藏」即時切換。
    - 在 [`DiplomacyController.ts`](file:///d:/tryagent/Medieval/src/ui/DiplomacyController.ts) 中支援將隱藏勢力從主介面外交清單過濾。
  - **修改檔案**：[`Narrative.ts`](file:///d:/tryagent/Medieval/src/models/Narrative.ts)、[`NarrativeSystem.ts`](file:///d:/tryagent/Medieval/src/systems/NarrativeSystem.ts)、[`types.ts`](file:///d:/tryagent/Medieval/src/models/types.ts)、[`StoryStudioTypes.ts`](file:///d:/tryagent/Medieval/src/tools/story-studio/StoryStudioTypes.ts)、[`StoryStudioForm.ts`](file:///d:/tryagent/Medieval/src/tools/story-studio/StoryStudioForm.ts)、[`StoryStudioFactionManager.ts`](file:///d:/tryagent/Medieval/src/tools/story-studio/StoryStudioFactionManager.ts)、[`NarrativeTestController.ts`](file:///d:/tryagent/Medieval/src/ui/NarrativeTestController.ts)、[`DiplomacyController.ts`](file:///d:/tryagent/Medieval/src/ui/DiplomacyController.ts)

- **[Refactor/ExplorationNarrativeEngine/SubjugationWavesVsWildernessExploration] 據點攻堅戰（純 Waves 波次決戰）與野外探索（隨機事件流）雙軌分流實裝（2026-09-02）**：
  - **問題根源**：過去討伐任何據點皆強制套用 `maxSteps = Random.int(2, 3)` 外層隨機輪次，導致工坊自訂的多波次據點（如 3 波火龍巢）在一次派遣中被重複觸發 2~3 次（相當於連續打 6~9 波），造成極端疲勞與滅團問題。
  - **雙軌分流架構**：
    - **🏰 固定 / 工坊設計據點**：識別 `!node.isDynamic`、自訂 `templateId` 或自訂 `garrisonEncounter` 據點，徹底拔除外層 2~3 輪隨機遇敵，抵達後直接發動純粹的據點攻堅戰，100% 忠實執行據點自身設計的波次（Waves）。
    - **🗺️ 野外探索 / 動態漫遊據點**：保留 2~3 步探索流（30% 隨機事件、70% 遭遇戰），維持拓荒開荒的隨機冒險樂趣。
  - **修改檔案**：[`ExplorationNarrativeEngine.ts`](file:///d:/tryagent/Medieval/src/systems/ExplorationNarrativeEngine.ts)

- **[Feature/CombatStudio/HeroDynamicLevelGrowth] 戰鬥沙盒英雄「等級差動態自然成長六維」換算實裝（2026-09-02）**：
  - **等級差動態成長**：在 `PlayerUnitConfig` 記錄英雄的原始出廠等級 `heroOriginalLevel`。當使用者在沙盒中升降英雄等級時（如 5 等 ➔ 10 等），系統自動計算等級差 $\Delta \text{Level}$ 並依照職業成長率為六維加上對應的自然成長點數（每級約 +6 點六維），杜絕過去升級六維靜止不動的問題。
  - **全方位連動**：沙盒卡片六維面板、戰鬥實例化 `buildAdventurers()` 與九宮格戰場初始 HP/MP `renderArenaInitial()` 全面同步套用動態成長。
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/SkillWorkshop/ResurrectOptionInEditorUI] 技能工坊介面「✨ RESURRECT 復活隊友」與「💀 ALLY_DEAD 陣亡隊友」選單實裝（2026-09-02）**：
  - **效果選單 (WHAT)**：在 [`SkillWorkshop.ts`](file:///d:/tryagent/Medieval/src/tools/SkillWorkshop.ts) 的積木編輯器中正式加入 `<option value="RESURRECT">✨ RESURRECT (復活隊友)</option>`。
  - **目標選單 (TARGET)**：正式加入 `<option value="ALLY_DEAD">💀 ALLY_DEAD (陣亡隊友)</option>`。
  - **全鏈路生效**：建立的自訂復活技能會自動編譯並在 [`SkillEffectEngine.ts`](file:///d:/tryagent/Medieval/src/systems/combat/SkillEffectEngine.ts) 中執行，能精確將倒下角色以自訂倍率生命值拉回戰場！
  - **修改檔案**：[`SkillWorkshop.ts`](file:///d:/tryagent/Medieval/src/tools/SkillWorkshop.ts)

- **[Fix/CombatStudio/DynamicWeaponScalingDisplay] 沙盒角色卡片物攻魔攻改採「武器與職業主屬性動態補正換算」（2026-09-02）**：
  - **問題根源**：沙盒卡片底部的 `patk` 與 `matk` 預覽過去寫死為 `STR * 2` 與 `INT * 2`，導致以敏捷為主的弓箭手/刺客、以體質為主的騎士、以精神為主的祈禱者在面板上顯示極低攻擊力，產生「敏捷/體質沒加到攻擊力」的誤導。
  - **修復方案**：改為依照角色當前裝備的武器與職業體系進行動態主屬性換算：
    - 弓箭手 / 盜賊（戰弓 / 雙匕首）：$\text{PATK} = \lfloor\text{AGI} \times 1.6 + \text{STR} \times 0.4\rfloor + \text{武器白字}$
    - 騎士（劍盾 / 符文盾）：$\text{PATK} = \lfloor\text{CON} \times 1.4 + \text{STR} \times 0.6\rfloor + \text{武器白字}$
    - 祈禱者（聖典 / 戰鎚）：$\text{MATK} = \lfloor\text{SPR} \times 1.6 + \text{INT} \times 0.4\rfloor + \text{武器白字}$
    - 法師（法杖 / 戰鐮）：$\text{MATK} = \text{INT} \times 2.0 + \text{武器白字}$
    - 戰士（巨劍 / 雙劍）：$\text{PATK} = \text{STR} \times 2.0 + \text{武器白字}$
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/CombatSystem/DeadUnitActionPreventionAndResurrectBlock] 陣亡單位死者行動與假回血徹底修復 & 技能工坊【RESURRECT 復活積木】實裝（2026-09-02）**：
  - **死者治療與增益徹底過濾**：在 `CombatSystem.ts`、`SkillData.ts` 與 `SkillEffectEngine.ts` 中，所有群體治療（`ALL_ALLIES`、`HEAL`）與增益效果全面過濾 `currentHp > 0` 的存活單位，杜絕常規回血將倒下角色「假復活」的問題。
  - **每回合自然回復與行動前死者防呆**：每回合開始時的 CON/SPR 自然回血回魔加入 `actor.currentHp > 0` 判定；各單位行動前嚴格檢驗 `if (actor.currentHp <= 0 || (actor as any).isDead) continue;`，死者 100% 無法出手。
  - **技能工坊支援「RESURRECT 復活積木」**：在 `Skill.ts`、`SkillEffectEngine.ts` 與 `SkillWorkshop.ts` 正式實裝 `RESURRECT` 效果類型與 `ALLY_DEAD` 目標類型，支援創作者設計能將倒下隊友以特定 HP% 拉回戰場的神聖復活技能！
  - **修改檔案**：[`CombatSystem.ts`](file:///d:/tryagent/Medieval/src/systems/CombatSystem.ts)、[`SkillData.ts`](file:///d:/tryagent/Medieval/src/data/SkillData.ts)、[`SkillEffectEngine.ts`](file:///d:/tryagent/Medieval/src/systems/combat/SkillEffectEngine.ts)、[`Skill.ts`](file:///d:/tryagent/Medieval/src/models/Skill.ts)、[`SkillWorkshop.ts`](file:///d:/tryagent/Medieval/src/tools/SkillWorkshop.ts)

- **[Feature/CombatStudio/DynamicLevelStatsAndHeroUnspentPoints] 英雄工坊動態等級標準提示、一鍵依職業等級推薦標準六維與遊戲本體出廠自由點數實裝（2026-09-02）**：
  - **英雄工坊動態等級標準列**：將過去靜態的 Lv.1 提示升級為隨「設定等級」即時動態計算的標準標籤（`標準 = Lv.1 品質基準 + (等級 - 1) * 6`），例如 Lv.10 SSR 即時顯示 `142` 點，並提供高低差數值提示，徹底告別「拿 Lv.1 屬性填寫 Lv.10 英雄導致強度遠遜於普通傭兵」的問題。
  - **一鍵推薦標準六維**：在工坊六維面板新增「⚡ 依職業與等級推薦標準六維」按鈕，能根據選取的職業權重、品質與等級一秒自動填入最佳六維分配。
  - **常規傭兵自然成長對齊**：修正沙盒常規傭兵在各等級自然成長過度膨脹的問題，改為依各職業每級約 +6 點成長曲線對齊。
  - **遊戲本體英雄入隊自由點數**：在 `UniqueAdventurers.createUniqueAdventurer()` 中新增 `adv.unspentStatPoints = Math.max(0, (def.level - 1) * 2)`，使玩家在故事或招募中獲得高級英雄時，身上帶有對應等級的自由點數可供手動配點強化。
  - **修改檔案**：[`combat-studio.html`](file:///d:/tryagent/Medieval/src/templates/combat-studio.html)、[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)、[`UniqueAdventurers.ts`](file:///d:/tryagent/Medieval/src/data/UniqueAdventurers.ts)

- **[Fix/CombatStudio/HeroAttributesAndSkillLockAlignment] 戰鬥沙盒英雄專屬基礎屬性獨立保存、每級2點自由配點與未滿10等終極大招鎖定對齊修復（2026-09-02）**：
  - **英雄固有屬性獨立基準**：`PlayerUnitConfig` 新增 `customBaseAttributes` 欄位；載入傳奇/自訂英雄時將 `hero.customAttributes` 存為固有基準，`allocatedStats` 初始化為 0。`buildAdventurers()` 判斷若有 `customBaseAttributes` 則直接以此為基底疊加玩家配點，徹底解決過去 `職業預設屬性 + 等級成長 + 英雄屬性` 雙重疊加與點擊「重置」後英雄專屬數值蒸發被還原的 Bug。
  - **自由配點上限完全對齊遊戲規範**：將過去沙盒面板與加點運算中的 `(level - 1) * 5` 全數修復為遊戲權威規範（`ATTRIBUTE_SYSTEM.md`）的 `(level - 1) * 2` 點（Lv.10 滿等共 18 點自由點數），重置配點只清空自由加點，英雄自訂出廠數值 100% 完好無損。
  - **未滿 10 等 / 未轉職終極大招防呆鎖定**：修正 `applyHeroToPlayerSlot` 中 `isAdvanced` 盲目設為 `true` 的問題（改為 `level >= 10 ? (hero.isAdvanced !== false) : false`）；`buildAdventurers()` 在解析技能時嚴格檢查若未達 10 等或未轉職，自動截取前 2 招基礎技能，終極大招僅在滿等 10 級且轉職後才生效。
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/CombatStudio/StrongholdMonsterGridPreservation] 據點怪物 3x3 九宮格座標未完整傳遞至沙盒與實例化修復（2026-09-02）**：
  - **問題根源**：在 `CombatStudio.ts` 的 `loadStrongholdToBattleSandbox()` 與 `buildMonstersForWaves()` 中，讀取據點模板的怪物守軍時漏掉了複製 `gridR`、`gridC` 與 `slotId`，導致怪物進入戰鬥沙盒後丟失自訂的九宮格站位，被系統自動排回預設順序。
  - **修復方案**：在 `loadStrongholdToBattleSandbox` 補上 `gridR`、`gridC` 與 `formationRow` 繼承解析；在 `buildMonstersForWaves` 實例化 `MonsterInstance` 時補上 `inst.gridR = cfg.gridR`、`inst.gridC = cfg.gridC` 與 `inst.formationRow`，與遊戲主程式 `MonsterSystem.createInstancesFromTemplateWaves()` 保持 100% 同步。
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Feature/CombatStudio/Tactical3x3ArenaAndRealEquipmentIntegration] 戰鬥沙盒 3x3 九宮格拖曳佈陣、FormationDB 陣型系統與真實裝備庫 100% 直連實裝（2026-09-02）**：
  - **真實裝備庫直連**：`buildAdventurers()` 徹底移除過去自造假裝備白字與重複疊加 Scaling 的硬編碼，改為根據選取的 `weaponTemplateId`、`armorTemplateId`、`accessoryId` 直接自 `DataStore.EquipmentDB` 透過 `EquipmentGenerator.generateFromTemplate()` 生成原裝裝備實體，完整保留真實攻防白字、元素屬性、附加特技 (`extraSkills`)、固定特技 (`fixedSkill`) 與標準補正倍率，由 `Adventurer.getCombatStats()` 原生計算。
  - **雙向 3x3 九宮格戰術棋盤**：將擂台升級為「我方 3x3 九宮格（後排 Row 2 ➔ 中排 Row 1 ➔ 前排 Row 0）」對峙「敵方 3x3 九宮格（前排 Row 0 ➔ 中排 Row 1 ➔ 後排 Row 2）」。
  - **原生 HTML5 拖曳佈陣（Drag & Drop）**：
    - 支援從左側自訂隊伍列表直接拖入九宮格各座標（`0_0` ~ `2_2`）。
    - 支援九宮格內部格子任意拖曳對調位置，並提供 ❌ 移出陣位按鈕。
  - **FormationDB 陣型系統連動**：實裝陣型下拉選單（盾牆陣、鋒矢陣、散兵陣、先鋒陣、自由陣型等），站位滿足要求時即時高亮（`#10b981`）並顯示加成描述；模擬戰鬥時將 `formationId` 與 `gridMap` 正式傳入 `CombatSystem.simulateCombat()` 啟用真實陣型 buff 與行排判定。
  - **驗證**：TypeScript 嚴格型別檢查 0 錯誤，全套 36 個測試檔案 171 項單元測試 100% 通過。
  - **修改檔案**：[`combat-studio.html`](file:///d:/tryagent/Medieval/src/templates/combat-studio.html)、[`combat-studio.css`](file:///d:/tryagent/Medieval/src/styles/combat-studio.css)、[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/CombatStudio/SandboxSkillsNotPassedToCombatSystem] 戰鬥沙盒技能設定未傳入 CombatSystem 修復（2026-09-02）**：
  - **問題根源**：`buildAdventurers()` 將沙盒 `PlayerUnitConfig` 轉換為 `Adventurer` 物件時，從未讀取 `cfg.skills` 並寫入 `adv.customSkills`，導致 `CombatSystem.simulateCombat()` 收到的角色技能列表永遠是 `undefined`，實際戰鬥中只能依職業名稱猜測技能，沙盒 UI 設定的技能完全無效。
  - **修復方案**：在 `buildAdventurers()` 裝備設定後、`advList.push(adv)` 前，新增 `if (cfg.skills && cfg.skills.length > 0) adv.customSkills = [...cfg.skills]`，讓 CombatSystem 能正確讀取沙盒指定的技能清單。
  - **驗證**：TypeScript 0 型別錯誤。
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/SkillEffectEngine/RecursiveBlockOverflow] 積木技能 onTrue/onFalse 無限巢狀遞迴防護（2026-09-02）**：
  - **問題根源**：`SkillEffectEngine.executeBlock()` 在執行條件分支（`onTrue`/`onFalse`）時會遞迴呼叫自身，若玩家在技能工坊設計出巢狀過深的積木結構，會導致 Stack Overflow 崩潰。
  - **修復方案**：新增 `private static readonly MAX_BLOCK_DEPTH = 20` 上限常數，`executeBlock` 加入可選參數 `_depth: number = 0`，每次遞迴呼叫時傳入 `_depth + 1`；當深度超過上限時立即返回 `[]` 並輸出 `console.warn` 警告。
  - **驗證**：TypeScript 0 型別錯誤，SkillEffectEngine 7 項單元測試全部通過。
  - **修改檔案**：[`SkillEffectEngine.ts`](file:///d:/tryagent/Medieval/src/systems/combat/SkillEffectEngine.ts)

- **[Fix/CombatStudio/StrongholdDesignerNotPersisted] 戰鬥工坊據點設計工坊建立的據點未寫入任何儲存媒介修復（2026-09-02）**：
  - **問題根源**：在「戰鬥模擬沙盒」的 `btn-save-stronghold` onClick handler 中，建立的據點只存入 `this.customStrongholds`（純記憶體 `Record<string, CustomStrongholdConfig>`），既沒有寫入 `localStorage`，也沒有合併進 `this.strongholdsDb`，導致重整頁面後資料完全消失，且「💾 寫入專案硬碟」按鈕的 `saveMonstersToDisk()` 也讀不到該資料。
  - **修復方案**：在儲存 `customStrongholds` 之後，新增將 `EnemyUnitConfig[][]` 轉換為 `SubjugationTemplate` 格式的邏輯，同步推入 `this.strongholdsDb`（若 id 重複則覆蓋），呼叫 `this.normalizeStrongholdWaves(subTemplate)` 正規化九宮格座標，最後呼叫 `this.saveStrongholdsToStorage()` 持久化至 `localStorage（MEDIEVAL_CUSTOM_STRONGHOLDS_V2）`。使用者之後點「💾 寫入專案硬碟」即可將自訂據點永久存入 `src/data/subjugation_nodes.json`。
  - **修改檔案**：[`CombatStudio.ts`](file:///d:/tryagent/Medieval/src/tools/CombatStudio.ts)

- **[Fix/NarrativeSystem/TriggerRaidSuccessFailNodeUnconditionalFire] TRIGGER_RAID 守城/城防後續節點修復全系列（2026-08-30）**：
  - **問題根源 1（邏輯層）**：`explainBlocked()` 缺少對 `TRIGGER_RAID.successNodeId/failNodeId` 的阻擋防護，導致每日輪詢無條件觸發後續節點。新增 `isRaidTargetNode()` 修復。
  - **問題根源 2（視覺層）**：[`StoryStudioGraph.ts`](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioGraph.ts) 的 `buildEdges()` 缺少 `TRIGGER_RAID` 的 `successNodeId`/`failNodeId` 連線繪製。補上後圖形正常顯示勝利（綠線）/失敗（紅線）箭頭。
  - **問題根源 3（生命週期層）**：無論放棄、守城勝/敗、野外攔截勝利，所有結算路徑都**從未呼叫 `NarrativeSystem.completeNode`** 標記觸發節點完成，導致節點可被反覆觸發（即使懲罰已結算），守城編組彈窗持續反覆彈出。
    - 修復方案：在 `applyEffects(TRIGGER_RAID)` 引入 `sourceNodeId` 傳遞鏈，從 `resolveChoice` → `applyEffects` → `startLiveSiegeDefense` → `TerritoryDefenseModalController.show`，並在所有 5 個出口路徑加入 `completeNode`：
      1. **放棄防守** (`btnCancel`) — `TerritoryDefenseModalController`
      2. **守城戰勝/失敗** (`settleSiegeDefenseResults.onClose`) — `TerritoryDefenseSystem`
      3. **野外攔截勝利** (`settleFieldInterceptionResults.onClose`) — `TerritoryDefenseSystem`（失敗僅削弱敵軍、繼承預警天數，節點刻意保持未完成，等待後續攻城結算）
  - **驗證**：全數通過 35 個測試檔案 163 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/StoryStudio/GrantItemQuantityInputUI] 故事工坊素材/特產/裝備發放數量輸入框佈局與可視性全面修復（2026-08-30）**：
  - **數量輸入框自適應佈局與樣式重構**：
    - 在 [StoryStudioForm.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioForm.ts) 中重構 `GRANT_MATERIAL`（素材獎勵）、`GRANT_TRADE_GOOD`（特產獎勵）與 `GRANT_EQUIPMENT`（裝備獎勵）的數量輸入 UI。
    - 徹底移除過去在 flex 佈局下被擠壓至窄小的 `div` 包裹，改為獨立的金色高亮標籤 `<span>發放數量：</span>` 與固定寬度 `75px` 的標準置中輸入框，並提供預設值 `1`。
    - 解決了使用者回報的「數量輸入框過小、無法看清或無法顯示數量」問題。
  - **驗證**：全數通過 35 個測試檔案 162 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatStudio/HeroCreatorLevelAdvancementAndEquipGuard] 英雄工坊等級與滿等進階防呆、品級標準點數標註與職業裝備限制防呆實裝（2026-08-30）**：
  - **指定等級 (Level 1~10) 與滿等進階 (isAdvanced) 連動防呆**：
    - 在 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 與 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 實裝等級輸入欄與進階轉職開關。
    - **未滿 10 等 (Lv.1~9)**：`isAdvanced` 開關強制設為 `false` 且處於 `disabled` 禁用狀態，並高亮警示「🔒 須 Lv.10 方可開啟進階」。
    - **滿 10 等 (Lv.10)**：解鎖進階狀態選擇，允許自由勾選是否已滿等轉職。
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 的 `createUniqueAdventurer` 中落實同等防呆，未滿 10 等英雄即便傳入 `isAdvanced: true` 亦強制初始化為未進階。
  - **六維屬性極限配點旁標註「各品級標準總點數參考」**：
    - 對齊 [ATTRIBUTE_SYSTEM.md](file:///i:/gameproject/Medieval/docs/ATTRIBUTE_SYSTEM.md) 與平衡基準，在配點區塊頂部標註 `N:45 | R:60 | SR:72 | SSR:88 | UR:110` 基準對照表。
    - 切換品質稀有度時即時高亮對應數值，並動態提示當前總點數差額（如：`符合 SSR 標準`、`+5 高於 SSR 基準`）。
  - **裝備加入「限制職業防呆」**：
    - 嚴格對齊 [CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md) 規範，定義六大職業專屬武器與防具類型清單。
    - 開啟裝備庫挑選時，自動過濾並僅顯示該英雄所屬職業相容之武器（如戰士只顯示巨劍/雙劍）與防具（如騎士只顯示重鎧）。
    - 切換基礎職業時，若當前配備之裝備與新職業不相容，系統自動修正為該職業的合法預設裝備。
  - **驗證**：全數通過 35 個測試檔案 162 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/StoryStudio/BountyBoardWorkflowUpgrade] 故事工坊懸賞委託 (BOUNTY_BOARD) 全鏈路可視化與快捷建立升級（2026-08-30）**：
  - **懸賞節點一鍵快速建立與預設值**：
    - 在 [StoryStudioStore.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioStore.ts) 新增 `createBountyNode()`，一鍵生成包含「執行天數 (2天)」、「保留天數 (4天)」、「金幣 (50G)」、「經驗 (30EXP)」與日常重複輪替等完整預設值的標準懸賞節點。
    - 在 [story-editor.html](file:///i:/gameproject/Medieval/src/templates/story-editor.html) 工具列新增 `📜 ＋新增懸賞委託` 快捷按鈕，大幅簡化建立懸賞流程。
  - **全鏈路可視化與設定自動展開**：
    - 在 [StoryStudioGraph.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioGraph.ts) 流程圖節點上，為懸賞節點直觀繪製 `⏱️ 執行天數 | 💰 金幣 | ⏳ 保留天數` 金色摘要徽章，一目了然。
    - 在 [StoryStudioForm.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioForm.ts) 與 [story-editor.html](file:///i:/gameproject/Medieval/src/templates/story-editor.html) 中，當選取或切換為 `BOUNTY_BOARD` 節點時，自動預設展開「🎯 懸賞任務專屬設定」面板，解決過去欄位被摺疊隱藏無法直觀編輯的痛點。
  - **驗證**：全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Refactor/LegacyCleanup/AbolishLegacyInvasionAndExtortion] 徹底拔除舊時代強盜勒索 (Extortion) 與純數值侵襲洗劫 (processInvasionCombat) 歷史遺留代碼（2026-08-30）**：
  - **清剿舊時代侵襲源頭**：
    - 在 [BountySystem.ts](file:///i:/gameproject/Medieval/src/systems/BountySystem.ts) 中徹底移除強盜懸賞過期時觸發 `pendingExtortionEvent = true` 的舊邏輯，懸賞過期僅自然刷新清單，不再觸發任何勒索。
    - 在 [GameState.ts](file:///i:/gameproject/Medieval/src/core/GameState.ts) 中移除 `pendingExtortionEvent` 欄位與重設邏輯。
  - **徹底抹除舊版純數值侵襲與洗劫彈窗**：
    - 在 [GameLoop.ts](file:///i:/gameproject/Medieval/src/core/GameLoop.ts) 中彻底刪除 `processInvasionCombat`、`processInvasionDefeat` 與 `showInvasionReport`（哨所抵抗羊皮紙彈窗）等全部舊式代碼。
    - 將 [ExtortionModalController.ts](file:///i:/gameproject/Medieval/src/ui/ExtortionModalController.ts) 徹底廢棄停用，所有領地威脅與突發事件 100% 統一由【故事工坊 (NarrativeSystem)】與實體【城防保衛戰 (TerritoryDefenseModalController)】接管。
  - **驗證**：全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/HeroExclusivity/DynamicViceCommanderSubstitution] 傳奇唯一英雄全球排他性與據點戰鬥全鏈路智慧副將接替引擎實裝（2026-08-30）**：
  - **全球唯一性排他與雙向綁定注入**：
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 中為冒險者實例完整賦值 `characterKey` 與 `boundMonsterId`。
    - 在 [FactionArmyGenerator.ts](file:///i:/gameproject/Medieval/src/systems/map/FactionArmyGenerator.ts) 的 `buildUnavailableCharacterSet` 中引入 `findHeroDef` 雙向關聯檢索，確保只要傳奇名將被招降在隊或收押於領地地牢，其所有別名 ID、怪物 ID 與人物 Key 100% 納入不可用黑名單。
  - **全鏈路據點守軍與戰鬥入口智慧副將替補 (SSOT Substitution)**：
    - 在 [MonsterSystem.ts](file:///i:/gameproject/Medieval/src/systems/MonsterSystem.ts) 的 `createInstancesFromTemplateWaves` 討伐據點波次生成中，全面接入 `FactionArmyGenerator.getBestSubstituteMonsterId`，若名將已在玩家麾下，強制將守關 Boss 自動替換為同階級正規士兵並冠上 `【代理副將】` 前綴，徹底終結「自己打自己」的分身術矛盾。
    - 在 [CombatSystem.ts](file:///i:/gameproject/Medieval/src/systems/CombatSystem.ts) 與 [InteractiveCombatSession.ts](file:///i:/gameproject/Medieval/src/systems/combat/InteractiveCombatSession.ts) 戰鬥入口建立二次安檢防禦，若傳入陣容含不可用具名英雄，強制觸發副將接替。
  - **戰鬥介面立繪與工坊即時渲染修復**：
    - 在 [CombatSystem.ts](file:///i:/gameproject/Medieval/src/systems/CombatSystem.ts) 與 [InteractiveCombatSession.ts](file:///i:/gameproject/Medieval/src/systems/combat/InteractiveCombatSession.ts) 參戰者與初始狀態補齊 `avatarIcon` 傳遞，修復玩家隊伍立繪退化為預設棕髮騎士的 Bug。
    - 在 [vite.config.ts](file:///i:/gameproject/Medieval/vite.config.ts) 加入 `server.watch.ignored`，解決工坊選取圖標自動存檔時觸發 Vite 熱重新整理的問題。
    - 在 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 修正英雄卡片左下角裝備名稱為動態查詢真實武器與強化等級（如 `炎魔巨刃 +0`），並修復英雄工坊列表影分身重複渲染問題。
  - **戰俘判定與重複俘虜提示過濾**：
    - 在 [ExplorationNarrativeEngine.ts](file:///i:/gameproject/Medieval/src/systems/ExplorationNarrativeEngine.ts) 中為戰鬥勝利結算的戰俘判定加入嚴格排他過濾：凡已被替換之 `【代理副將】` 或已在玩家隊伍/已在領地地牢的傳奇英雄，直接跳過俘虜判定與 Toast 提示，徹底避免戰勝代理副將時誤跳出「成功生擒雷恩」的混淆訊息。
  - **驗證**：新增專屬單元測試，全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Architecture/HeroDatabase/JSONPersistenceAutoSync] 英雄資料庫實體 JSON 化 (unique_heroes.json) 與工坊自動同步寫入硬碟重構實裝（2026-08-30）**：
  - **英雄資料庫實體 JSON 化 (SSOT)**：
    - 建立 [unique_heroes.json](file:///i:/gameproject/Medieval/src/data/unique_heroes.json) 實體資料庫檔案，徹底移除程式碼內的巨大硬編碼常數；[UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 直連 JSON 檔案，職責精簡為純工廠實例化邏輯。
    - 收錄雷恩最新工坊配置（炎魔巨刃、皇家重鎧、狂暴暴擊徽章、赤銅轟擊/破甲碎擊/旋風斬技能組、六維點數 105、`characterKey: "char_ryan"`, `boundMonsterId: "enemy_ryan"`, `captureRate: 100`）。
  - **Vite 後端與工坊自動同步硬碟 (Auto Sync Disk)**：
    - 在 [vite.config.ts](file:///i:/gameproject/Medieval/vite.config.ts) 接通 `/api/get-hero-definitions` 與 `/api/save-hero-definitions` API，支援自動儲存至 `unique_heroes.json` 並於 `src/data/hero_backups/` 建立快照。
    - 在 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 英雄工坊保存時自動調用 API 寫入硬碟，達成「畫面上點擊儲存，硬碟實體檔案即時同步」的真正 SSOT 架構。
  - **全鏈路戰俘、招降扣款與技能實裝驗證**：
    - 在 [SkillData.ts](file:///i:/gameproject/Medieval/src/data/SkillData.ts) 支援 `SkillRegistry.getSkill` 動態解析工坊技能；在 [PrisonerModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/PrisonerModalController.ts) 招降（-2,500 金幣）與沒收（+1,000 金幣）時即時調用 `UIManager.updateUI()` 刷新頂部 HUD。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/HeroWorkshop/StorageKeyAndAvatarAlignment] 英雄工坊儲存鍵值對齊 (MEDIEVAL_CUSTOM_HEROES) 與全鏈路專屬立繪渲染修復（2026-08-30）**：
  - **工坊 LocalStorage 鍵值對齊**：
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 中將讀取 Key 由 `MEDIEVAL_CUSTOM_HEROES_V2` 修正為同時支援工坊實際儲存的 `MEDIEVAL_CUSTOM_HEROES` 與 `MEDIEVAL_CUSTOM_HEROES_V2`，徹底解決遊戲內部因 Key 不一致而讀不到使用者在畫面上設計的自訂裝備、技能與屬性的核心問題。
  - **全鏈路專屬立繪圖標渲染**：
    - 在 [IconSpriteHelper.ts](file:///i:/gameproject/Medieval/src/ui/IconSpriteHelper.ts) 升級 `getAvatarSpriteStyle` 優先支援 `avatarIcon` 解析；在 [AdventurerCard.ts](file:///i:/gameproject/Medieval/src/ui/components/AdventurerCard.ts)、[PartyModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/PartyModalController.ts) 與 [CombatUIManager.ts](file:///i:/gameproject/Medieval/src/ui/CombatUIManager.ts) 全面傳入 `adv.avatarIcon`，確保招降與在隊時 100% 呈現工坊自訂立繪，不再退化為預設通用臉孔。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Refactor/HeroWorkshop/SSOTWorkshopPriority] 英雄名單 SSOT 權威統一與工坊自訂資料優先覆蓋實裝（2026-08-30）**：
  - **消除雙軌矛盾與工坊絕對優先覆蓋**：
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 重構 `getSelectableHeroes`：以 `Map` 載入底稿並由工坊自訂英雄（`MEDIEVAL_CUSTOM_HEROES_V2`）100% 絕對優先覆寫同 ID 官方預設英雄，徹底解決工坊編輯的 `characterKey`、`boundMonsterId` 與 `captureRate` 被硬編碼擋在門外的重大架構問題。
    - 重構 `findHeroDef` 與 `createUniqueAdventurer`：支援依據 key、ID、`characterKey`、`boundMonsterId` 與英雄姓名進行大小寫不敏感智慧查詢，統一以工坊自訂英雄資料為 SSOT。
    - 在程式碼預設底稿 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 與怪物庫 [monsters.json](file:///i:/gameproject/Medieval/src/data/monsters.json) 補齊雷恩的雙向綁定（`characterKey: "char_ryan"` 與 `boundMonsterId: "enemy_ryan"`、`captureRate: 100`）。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/Dungeon/UniqueHeroSSOTCaptureDungeonSystem] 以英雄名單 (UniqueHeroDef) 為 SSOT 的全鏈路俘虜資格、地牢收押與提審招降實裝（2026-08-30）**：
  - **英雄名冊俘虜資格嚴格檢定**：
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 導出 `findHeroDef` 函式，支援依據 ID、`characterKey`、`boundMonsterId` 或姓名精確檢索英雄本體。
    - 在 [ExplorationNarrativeEngine.ts](file:///i:/gameproject/Medieval/src/systems/ExplorationNarrativeEngine.ts) 實裝以英雄名冊為準的俘虜資格判定：只有匹配到 `UniqueHeroDef` 或陣營名將 `FactionChampion` 的敵將才具備生擒資格，普通野怪/雜兵直接結算素材與金幣。
  - **領地地牢持久化收押與招降完整還原**：
    - 在 [Territory.ts](file:///i:/gameproject/Medieval/src/models/Territory.ts) 新增 `dungeonPrisonerHeroIds` 陣列，俘虜成功後 100% 押送至領地地牢名冊。
    - 在 [PrisonerModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/PrisonerModalController.ts) 升級地牢清單與提審彈窗：精確渲染英雄專屬頭像（`avatarIcon` / `renderUniversalIcon`）、尊號、姓名與品質；點擊【🤝 招降加入】直接調用 `createUniqueAdventurer` 將英雄自訂六維屬性、裝備強化與專屬技能 100% 完整還原加入冒險者隊伍！
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/MonsterSystem/SubjugationWavesSSOTAlignment] 討伐據點工坊自訂波次守軍精確載入與 SSOT 對齊修復（2026-08-30）**：
  - **據點模板守軍解析與副將連動**：
    - 在 [MonsterSystem.ts](file:///i:/gameproject/Medieval/src/systems/MonsterSystem.ts) 實裝 `createInstancesFromTemplateWaves`，精確解析戰鬥工坊 [subjugation_nodes.json](file:///i:/gameproject/Medieval/src/data/subjugation_nodes.json) 據點模板中 `waves` 設定的怪物 ID、戰力階級 `powerTier` 與九宮格站位（`gridR`, `gridC`, `slotId`, `formationRow`）。
    - 整合 `FactionArmyGenerator.buildUnavailableCharacterSet`，當名將已入隊或被俘虜時，自動將守軍替換為副將（`substituteMonsterId`）。
    - 重構 `generateNodeEncounter`：優先比對 `DataStore.getSubjugationTemplates()`，若據點模板具備自訂波次守軍，100% 精確載入工坊設定，徹底解決過去被隨機野生魔物（如薩滿、殭屍）覆蓋之重大 Bug。
  - **UI 細節防呆修復**：
    - 在 [NodeDetailModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/NodeDetailModalController.ts) 修復天氣持續天數讀取，當 `node.weatherDuration` 未定義或為 0 時預設顯示 3 天，修復 `(剩餘 undefined 天)` 顯示異常。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/Dungeon/FallenFactionPrisonerActions] 地牢俘虜系統滅國與常規情境差異化處置邏輯實裝（2026-08-30）**：
  - **母國存亡情境自適應處置邏輯**：
    - 在 [PrisonerModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/PrisonerModalController.ts) 實裝母國城池數（`controlledNodes.length`）與滅國狀態（`isFallenFaction`）檢定：
      1. **🤝 招降加入**：若母國已滅亡，亡國名將享 **50% 半價招募特惠**，並宣誓感念明主恩德誓死效忠；未滅國維持原價。
      2. **💰 贖金與私產處置**：若母國已滅亡，按鈕自適應轉為【📦 沒收私產流放】，提示沒收其舊貴族私產並驅逐出境；未滅國則維持由母國國庫支付贖金交還將領。
      3. **⚰️ 處決示眾**：滅國狀態下提示一代名將殞命亂世；未滅國則扣除母國好感度。
      4. **🔓 仁慈釋放**：若母國已滅亡，按鈕轉為【🔓 仁慈釋放流亡】，提示感激領主不殺之恩，隱姓埋名浪跡大陸化身在野傳奇；未滅國則回歸母國並提升母國好感度 +10。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[UI/StoryStudio/InspectorCardModularLayout] 故事工坊右側屬性面板 (Inspector) 模組化卡片視覺架構升級（2026-08-30）**：
  - **模組化卡片佈局與視覺層次提升**：
    - 在 [story-editor.html](file:///i:/gameproject/Medieval/src/templates/story-editor.html) 將右側 Inspector 面板全面重構為 6 大獨立結構卡片：【📌 節點基本資訊】、【💬 NPC 訪客與對話演出】、【🔍 出現條件檢定】、【🎁 完成後結果／獎勵】、【🎯 懸賞／據點進階設定】、【🔀 玩家決策選項】。
    - 在 [story-editor.css](file:///i:/gameproject/Medieval/src/styles/story-editor.css) 實裝 `.inspector-card` 質感深色卡片陰影、12px 呼吸間距、各區塊專屬主題色高亮邊框（暗金、琥珀橘、青藍、翡翠綠、寶藍、亮金）與精緻折疊標題列（`<summary>`）懸停光澤。
    - 子清單（條件列、效果列、選項卡片）加上深色微內凹襯底（`rgba(0,0,0,0.4)`），徹底解決過去表單緊密黏合、難以分辨編輯區塊之視覺痛點。
  - **驗證**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatCapture/DynamicGradientCaptureRateEngine] 戰鬥將領動態梯度俘虜率與自訂俘虜率引擎實裝（2026-08-30）**：
  - **資料模型擴充**：
    - 在 [types.ts](file:///i:/gameproject/Medieval/src/models/types.ts) 的 `MonsterData` 與 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 的 `UniqueHeroDef` 新增 `captureRate?: number`（0~100，選填）。
  - **戰鬥結算動態俘虜率計算與突圍機制**：
    - 在 [ExplorationNarrativeEngine.ts](file:///i:/gameproject/Medieval/src/systems/ExplorationNarrativeEngine.ts) 實裝 `calculateCaptureRate` 演算法：
      1. **滅國絕境圍城（敵方派系僅剩 1 座城或無城）** ➔ **100% 必定俘虜**（絕境無法突圍）。
      2. **自訂機率優先** ➔ 若怪物或英雄有設定 `captureRate`（如 0% 狂熱死士、80% 投降派），優先採用。
      3. **多城攻城戰** ➔ 預設 **40%** 俘虜率。
      4. **野外遭遇/討伐據點** ➔ 預設 **25%** 俘虜率。
      5. **逃脫回饋** ➔ 未被俘虜時發布 `💨【突圍】敵將在親衛掩護下負傷突圍逃脫！` 敘事回饋。
  - **戰鬥工坊 UI 與讀寫實裝**：
    - 在 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 與 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 的【編輯怪物單位】與【編輯英雄】彈窗中實裝【🎯 專屬被俘虜率 %】輸入欄位與資料庫雙向讀寫。
  - **單元測試與驗證**：
    - 在 [ExplorationNarrativeEngine.test.ts](file:///i:/gameproject/Medieval/src/systems/ExplorationNarrativeEngine.test.ts) 新增 4 項單元測試。
    - 全專案 35 個測試檔案 159 項單元測試 100% 全部通過，TypeScript 嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatStudio/MonsterEditorCharacterKeyAndSubstituteFields] 戰鬥工坊怪物編輯器新增唯一角色代碼與指定代理副將輸入欄位（2026-08-30）**：
  - **UI 與雙向讀寫實裝**：
    - 在 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 怪物編輯彈窗中新增【🔗 唯一角色代碼 (`characterKey`)】與【🛡️ 指定代理副將 ID (`substituteMonsterId`)】輸入欄位。
    - 在 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 實裝開啟怪物編輯彈窗時的自動回填與保存時的雙向寫入。
  - **驗證**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Asset/UnusedImagesCleanup] 全專案未使用圖片資源深度掃描與清理瘦身（2026-08-30）**：
  - **資產清理與瘦身**：
    - 深度掃描全專案 74 張圖片之引用狀況，安全清理刪除 15 張未被任何程式碼/樣式/圖集引用的舊版、重複與暫存圖片（包含根目錄高解析度角色暫存圖 `man.png`、`woman.png`、舊版黑白圖標線稿、舊版 6x6 防具圖與舊版場景圖等）。
    - 專案體積即時釋放 **29.93 MB**，剩餘 59 張圖片經二次掃描確認 100% 正常引用中，未引用圖片數降為 0。
  - **驗證**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Docs/DocumentationOverhaulAndCleanup] 全專案核心手冊全面校正重整與過時文件清理（2026-08-30）**：
  - **過時與重複檔案清理**：
    - 刪除已完全實裝且功能併入主線的 [TAVERN_SYSTEM_PLAN.md](file:///i:/gameproject/Medieval/docs/TAVERN_SYSTEM_PLAN.md)。
    - 刪除早期審查備忘錄 [PROJECT_ARCHITECTURE_AND_BALANCE_REVIEW.md](file:///i:/gameproject/Medieval/docs/PROJECT_ARCHITECTURE_AND_BALANCE_REVIEW.md)。
    - 清理早期程式碼模板目錄 `docs/systems/`（含 `COMBAT_SYSTEM_TEMPLATE.md`、`MAP_DYNAMICS_TEMPLATE.md`、`SKILL_SYSTEM_TEMPLATE.md`）。
  - **五大核心指南全面重整對齊**：
    - [game_system_guide.md](file:///i:/gameproject/Medieval/docs/game_system_guide.md)：重構為《全系統玩法指南》，徹底校正裝備穿戴限制為「職業嚴格綁定」，補齊五大開發工坊、12 大進階轉職與動態副將機制。
    - [MONSTERS_AND_ELEMENTS.md](file:///i:/gameproject/Medieval/docs/MONSTERS_AND_ELEMENTS.md)：升級為《怪物母庫、元素相剋與動態副將手冊》，同步 64+ 隻全魔物母庫（含 6 款陣營軍團單位與 Boss），補齊雙實體綁定與副將接替規範。
    - [MATERIALS_AND_ITEMS.md](file:///i:/gameproject/Medieval/docs/MATERIALS_AND_ITEMS.md)：升級為《全道具、特產、鍛造素材與附魔石手冊》，同步精靈圖圖標標籤與 30+ 款完整素材清單。
    - [STORY_STUDIO_GUIDE.md](file:///i:/gameproject/Medieval/docs/STORY_STUDIO_GUIDE.md)：同步最新英雄狀態條件多選、傳奇英雄入隊獎勵與全視覺化 Modal 挑選器操作。
    - [CHEATS.md](file:///i:/gameproject/Medieval/docs/CHEATS.md)：補齊全自訂積木技能工坊（`skill`）快捷指令、全域控制台後門與美術排版編輯器說明。
  - **架構總綱目錄同步**：
    - [ARCHITECTURE.md](file:///i:/gameproject/Medieval/docs/ARCHITECTURE.md)：同步更新 `docs/` 結構為 16 份權威文件。

- **[Docs/ArchitectureUpdate] 全專案架構文件 ARCHITECTURE.md 模組樹與系統規格全面同步（2026-08-30）**：
  - **檔案目錄結構樹校正**：
    - 補齊 `tools/skill-workshop.html`（獨立全自訂積木技能工坊入口）與 `src/tools/SkillWorkshop.ts`。
    - 補齊 `src/tools/story-studio/` 模組化子目錄（含全視覺化挑選器 `StoryStudioHeroPicker`、`StoryStudioItemPicker`、`StoryStudioSubjugationPicker` 等）。
    - 補齊 `src/systems/combat/`（`SkillEffectEngine.ts`、`InteractiveCombatSession.ts`、`LordCommanderSystem.ts`、`OffensiveSiegeSystem.ts`）。
    - 補齊 `src/data/`（`CustomSkillData.json`、`NarrativeData.ts`、`EventData.ts`、`RumorData.ts`）。
    - 補齊 `docs/`（`SKILL_WORKSHOP_SPEC.md`、`LORE_AND_EVENT_SYSTEM_PLAN.md`、`NARRATIVE_BIBLE.md` 等）。
  - **五大獨立開發工坊架構 (The 5 Developer Studios Ecosystem)**：
    - 正式將開發工坊體系升級為五大獨立工坊，納入 **⚡ 全自訂積木技能工坊 (Skill Workshop)**，闡明積木堆疊、狀態挑選器與 `mpCost` SSOT 機制。
  - **戰鬥與英雄系統架構更新**：
    - 同步記錄 **自訂積木技能效果編譯引擎 (`SkillEffectEngine.ts`)** 與 **雙實體英雄唯一身分綁定與動態副將接替引擎 (`Dynamic Vice-Commander Engine`)**。
    - 同步記錄全域圖標水平翻轉協議（`?flip` 語法糖）。

- **[Feature/HeroStudio/DualEntityBindingAndDynamicViceCommander] 雙實體英雄唯一身分綁定與動態副將接替引擎實裝（2026-08-29）**：
  - **資料結構與型別擴充**：
    - 在 [types.ts](file:///i:/gameproject/Medieval/src/models/types.ts) 的 `MonsterData` 新增 `characterKey?: string`（唯一角色代碼）與 `substituteMonsterId?: string`（指定代理副將 ID）。
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 的 `UniqueHeroDef` 新增 `characterKey?: string` 與 `boundMonsterId?: string`。
  - **英雄創作工坊 UI & 讀寫連動**：
    - 在 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 英雄創作者彈窗中實裝【🔗 唯一角色代碼】與【👾 綁定敵方怪物 ID】欄位。
    - 在 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 中完成雙向讀取、編輯與自訂英雄資料庫存檔。
  - **動態副將接替引擎 (Dynamic Vice-Commander Engine)**：
    - 在 [FactionArmyGenerator.ts](file:///i:/gameproject/Medieval/src/systems/map/FactionArmyGenerator.ts) 實裝 `resolveTroopMember`、`getBestSubstituteMonsterId` 與 `instantiateCombatGroup`。
    - 當英雄被玩家俘虜、招募或陣亡時，戰鬥瞬間自動依「手動指定副將 ➔ 客觀保底演算法（同攻擊型態+人類正規軍+最高戰力階級）」動態生成代理副將實體（冠以 `【代理副將】` 稱號），據點工坊原始部隊藍圖 100% 保持唯讀隔離。
  - **驗證**：34 個測試檔案 155 項單元測試 100% 全部通過，TypeScript 嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Refactor/SkillSystem/MpCostFieldStandardization] 技能系統與自訂積木技能全專案 MP 消耗欄位標準化 (mpCost SSOT 收斂)（2026-08-29）**：
  - **資料庫與型別全面標準化為 `mpCost`**：
    - 在 [Skill.ts](file:///i:/gameproject/Medieval/src/models/Skill.ts) 中將 `CompositeSkillDefinition` 標準化為 `mpCost: number`（保留 `totalMpCost?: number` 作為選填向下相容）。
    - 批次更新 [CustomSkillData.json](file:///i:/gameproject/Medieval/src/data/CustomSkillData.json) 所有自訂技能的魔力消耗欄位為標準 `mpCost`。
    - [SkillWorkshop.ts](file:///i:/gameproject/Medieval/src/tools/SkillWorkshop.ts) 與 [SkillEffectEngine.ts](file:///i:/gameproject/Medieval/src/systems/combat/SkillEffectEngine.ts) 全面以 `mpCost` 進行表單綁定、渲染、新技能初始化與編譯。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，TypeScript 嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/HeroStudio/CustomSkillMpCostDisplay] 英雄工坊技能卡槽自訂技能 MP 消耗 (totalMpCost) 讀取相容性修復（2026-08-29）**：
  - 修復 [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 在渲染英雄編輯器 3 格初始技能卡槽與技能挑選器時，僅讀取官方技能欄位 `sk.mpCost` 而未相容自訂技能 `sk.totalMpCost` 導致自訂技能皆錯誤顯示為 `0 MP` 的問題。
  - 升級為相容讀取 `sk.mpCost ?? sk.totalMpCost ?? sk.cost?.mpCost ?? 0`，使【赤鋼轟擊】(15 MP) 等所有工坊創作技能在卡片與 Tooltip 上皆 100% 正確顯示真實 MP 消耗。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

- **[Feature/SkillWorkshop/StatusEffectVisualPicker] 技能工坊積木狀態類型 (StatusType) 全視覺化挑選器 Modal 與按鈕重構實裝（2026-08-29）**：
  - **狀態類型輸入框重構為點擊式卡片按鈕**：
    - 將 [skill-workshop.html](file:///i:/gameproject/Medieval/src/templates/skill-workshop.html) 與 [SkillWorkshop.ts](file:///i:/gameproject/Medieval/src/tools/SkillWorkshop.ts) 中原本自由輸入的文字框升級為自適應展示按鈕（未選擇時顯示 `🚫 無狀態 (點擊挑選)`，已選擇時顯示如 `🔥 灼燒 (BURN)`）。
  - **全視覺化狀態選擇器 Modal (`#modal-sw-status-picker`)**：
    - 分區展示 **🔥 異常與負面狀態 (DEBUFF)**（灼燒、中毒、流血、暈眩、破甲、感電、恐懼、嘲諷、烙印等 9 種）與 **🛡️ 正面增益 (BUFF)**（物攻提升、魔攻提升、物防提升、雙防提升、閃避提升、持續回血、持續回魔、傷害護盾等 8 種）。
    - 提供【🚫 清空 / 不附加狀態】按鈕，點擊任何狀態卡片即時寫入積木設定、更新外觀並自動同步寫入 LocalStorage。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

- **[Feature/SkillWorkshop/IdEditAndDiskSyncOverhaul] 全自訂積木技能工坊 ID 即時連動修復、雙向儲存同步與【🔄 從專案重載 (Git 同步)】實裝（2026-08-29）**：
  - **技能 ID 雙向即時連動與指標修復**：
    - 修復 [SkillWorkshop.ts](file:///i:/gameproject/Medieval/src/tools/SkillWorkshop.ts) 中修改技能 ID 後 `this.currentSkillId` 未同步更新而導致後續所有編輯（名稱、圖標、積木增刪、倍率調整）全部失效的致命 Bug。
    - 新增 ID 重複性防呆檢查（即時紅色邊框與 Tooltip 警示）。
  - **多層次穩健載入機制 (Multi-Tier Fallback)**：
    - `loadSkills()` 升級為：優先從 `/api/get-custom-skills` 磁碟 API 載入 ➔ 次選從瀏覽器 `localStorage` 載入 ➔ 底層 Fallback 讀取靜態 `CustomSkillData.json`，絕不出現清空為 `[]` 的問題。
  - **雙向儲存同步 (Dual-Sync SSOT)**：
    - 儲存時自動同步寫入瀏覽器 `localStorage('MEDIEVAL_CUSTOM_COMPOSITE_SKILLS')` 與專案磁碟檔案 `src/data/CustomSkillData.json`。
    - [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 自訂技能讀取同步支援 `CustomSkillData.json` 靜態 fallback，確保兩大工坊 100% 互通。
  - **新增【🔄 從專案重載 (Git 同步)】按鈕**：
    - 在 [skill-workshop.html](file:///i:/gameproject/Medieval/src/templates/skill-workshop.html) 頂部導航列新增 `#btn-sw-reload-disk` 按鈕，支援一鍵強制重新自專案磁碟載入技能資料庫並覆蓋草稿。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

- **[Feature/HeroStudio/EquipPickerModalAndSkillTooltipRefactor] 英雄工坊三槽技能簡短ICON+Tooltip精簡化與三格裝備全視覺化Modal挑選器重構（2026-08-29）**：
  - **技能三槽卡片排版極致精簡 (3 槽並排一覽無遺)**：
    - 重構 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 技能配置區，改為標準等寬三等分並排 `grid-template-columns: repeat(3, 1fr)`。
    - 卡片內部只保留圖標、技能名稱與 MP 消耗標籤，詳細技能說明全面移至卡槽容器的 **懸浮提示（Tooltip / title）** 中，徹底解決卡片過大造成第 3 個進階終極技能被擠出畫面的問題。
  - **三格裝備徹底移除 `<select>` 下拉選單 ➔ 全視覺化 Modal 挑選器 (對齊 SSOT)**：
    - 徹底拔除武器、防具、飾品 3 處 `<select>` 下拉選單，改為點擊式展示卡片槽位（大圖標、名稱、T階標籤、空裝狀態）。
    - 點擊卡片彈出全視覺化【⚔️ 英雄裝備挑選器 Modal】（`#modal-hc-equip-picker`）：支援關鍵字搜尋、階級 Tab 篩選。
    - **100% 對齊視覺與數據唯一來源 (SSOT)**：全裝備圖標統一透過 `renderEquipIcon(item, sizePx)` 渲染，自動解析各武器類型（法杖/長弓/雙劍/巨劍/戰鐮/劍盾等）與防具（布甲/皮甲/重鎧）原生九宮格精靈圖與 T1~T4 品質光框；屬性數值統一對齊 `item.combatEffects`（正確顯示真實物攻/魔攻/物防/魔防/詞條），不再降級為 Emoji 或顯示 `+0`。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

- **[Feature/StoryStudio/HeroIntegrationAndTestHeroIsolation] 故事工坊英雄連動機制（條件多選 + 獎勵加入英雄）與測試英雄嚴格隔離實裝（2026-08-29）**：
  - **故事前置條件支援英雄狀態（多選、非下拉選單）**：
    - 在 [Narrative.ts](file:///i:/gameproject/Medieval/src/models/Narrative.ts) 與 [NarrativeSystem.ts](file:///i:/gameproject/Medieval/src/systems/NarrativeSystem.ts) 中實裝 `HERO_EXISTS`（已擁有指定英雄）與 `HERO_MISSING`（尚未擁有指定英雄）條件判斷，支援多選名單與 `ANY` / `ALL` 匹配模式。
  - **任務與故事節點獎勵支援贈送英雄（`GRANT_HERO`）**：
    - 在 [NarrativeSystem.ts](file:///i:/gameproject/Medieval/src/systems/NarrativeSystem.ts) 的 `applyEffects` 中實裝 `GRANT_HERO`，自動呼叫 `createUniqueAdventurer` 並將英雄（含三格初始裝備與自訂技能）加入玩家領地名冊中。
  - **故事工坊全視覺化英雄挑選器（Modal Grid）**：
    - 建立 [StoryStudioHeroPicker.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioHeroPicker.ts)，支援關鍵字即時搜尋、卡片立繪展示、單選模式（獎勵）與打勾多選模式（條件），在 [StoryStudioForm.ts](file:///i:/gameproject/Medieval/src/tools/story-studio/StoryStudioForm.ts) 中以徽章標籤清單與精美預覽卡片呈現，徹底摒棄下拉選單。
  - **內部測試英雄【不滅誓約】神聖誓約騎士嚴格隔離**：
    - 在 [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 中為 `oath` 標記 `isTestOnly: true`，並在 `getSelectableHeroes` 中 100% 過濾排除，確保測試專用數據不被選取且絕不出現在遊戲內故事與招募清單中。
  - **驗證**：33 個測試檔案 151 項單元測試 100% 全部通過，新增 [NarrativeSystem.test.ts](file:///i:/gameproject/Medieval/src/systems/NarrativeSystem.test.ts) 與 [UniqueAdventurers.test.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.test.ts) 守護測試，Vite 生產打包 0 錯誤。

- **[Feature/HeroStudio/EquipmentAndCustomSkills] 英雄工坊三格獨立裝備配置 (支援空裝) 與全視覺化三槽技能挑選器實裝（2026-08-29）**：
  - **三格獨立初始裝備配給 (對齊遊戲本體)**：
    - 重構 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 英雄編輯彈窗，徹底移除死板神裝設定，改為與遊戲對齊的 **【⚔️ 主手武器 / 🛡️ 身體防具 / 💍 飾品槽】** 三格獨立槽位。
    - 支援 `(無武器 / 空手)`、`(無防具)`、`(無飾品)`，可自由指定任何品項、附魔元素（火/冰/雷/暗/聖）與強化等級 (+0~+10)，並享有實時圖標預覽。
  - **三槽自訂技能配置與全視覺化挑選器 Modal (非下拉選單)**：
    - 英雄初始技能配置開放 3 槽（基礎 1、基礎 2、進階 3），切換基礎職業時自動切換為該職業預設 3 招。
    - 點擊任一卡槽喚起全視覺化【🔮 技能挑選器 Modal】（支援分類 Tab、關鍵字即時搜尋、卡片網格展示圖標/名稱/耗藍 MP/詳細效果），點擊卡片一鍵替換。
    - 整合官方全職業技能庫與技能工坊（Skill Workshop）玩家創作的自訂技能。
  - **戰鬥與資料層單一真理來源 (SSOT)**：
    - [UniqueAdventurers.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.ts) 與 [Adventurer.ts](file:///i:/gameproject/Medieval/src/models/Adventurer.ts) 支援 `customSkills?: string[]` 與靈活空裝備生成。
    - [SkillData.ts](file:///i:/gameproject/Medieval/src/data/SkillData.ts) 與 [CombatSystem.ts](file:///i:/gameproject/Medieval/src/systems/CombatSystem.ts) 100% 優先讀取 `customSkills`，確保在戰鬥與屬性面板中絕對生效。
  - **驗證**：33 個測試檔案 148 項單元測試 100% 全部通過，新增 [UniqueAdventurers.test.ts](file:///i:/gameproject/Medieval/src/data/UniqueAdventurers.test.ts) 守護測試，Vite 生產打包 0 錯誤。

- **[Feature/Icon/UniversalFlipModifier] 通用圖標挑選器水平翻轉 (SSOT) 與全域 `?flip` 語法糖實裝（2026-08-29）**：
  - **唯一真理來源 (SSOT) 圖標標識符協議升級**：
    - 在 [IconSpriteHelper.ts](file:///i:/gameproject/Medieval/src/ui/IconSpriteHelper.ts) 的核心入口 `renderUniversalIcon` 與 `renderUniversalPortrait` 中原生實裝 `?flip` 語法糖解析。
    - 當標識符包含 `?flip`（例如 `faction_units_8x8:f_lothgar_0?flip`）時，自動在 rendered 節點附加 `transform: scaleX(-1);` 達成零素材冗餘、純 CSS 實時水平鏡像。
  - **全工坊通用圖標選擇器 (Universal Icon Picker) 翻轉按鈕**：
    - 在 [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html) 與 [equipment-studio.html](file:///i:/gameproject/Medieval/src/templates/equipment-studio.html) 的圖標挑選器頂部加入【`↔️ 水平翻轉: 開/關`】Toggle 開關按鈕。
    - [CombatStudio.ts](file:///i:/gameproject/Medieval/src/tools/CombatStudio.ts) 與 [EquipmentStudio.ts](file:///i:/gameproject/Medieval/src/tools/EquipmentStudio.ts) 同步實裝狀態管理，開啟翻轉時即時呈現鏡像預覽，選中時自動組合回傳 `${fullId}?flip`。
  - **完美分離怪物與英雄實體**：
    - 製作敵方怪物時使用原始朝向（朝左），製作招降後加入的英雄單位時打開翻轉（朝右），無需重複切圖即可各自維持獨立數值實體。
  - **驗證**：33 個測試檔案 147 項單元測試 100% 全部通過，新增 [IconSpriteHelper.test.ts](file:///i:/gameproject/Medieval/src/ui/IconSpriteHelper.test.ts) 守護測試，Vite 生產打包 0 錯誤。

- **[Refactor/GeographyAlignmentExecution] 全專案勢力地理稱謂全面校正實裝（2026-08-28）**：
  - **全面校正並通過編譯**：
    - [combat-studio.html](file:///i:/gameproject/Medieval/src/templates/combat-studio.html)：更新勢力篩選與編輯下拉選單，全面採用 `👑 洛斯加中央王室`、`❄️ 北境 赫斯特神聖教廷`、`🌹 西境 貝拉維亞商會`、`🌋 熔岩鍛爐 沃爾蒙德大公國`、`🏜️ 赤砂荒漠 達斯克城邦`、`🌾 橡木谷家族`、`🛡️ 黑木守衛`。
    - [FactionData.ts](file:///i:/gameproject/Medieval/src/data/FactionData.ts)：校正各大陣營註解、簡介與武將封號描述。
    - [MapData.ts](file:///i:/gameproject/Medieval/src/data/MapData.ts)：校正 27 處官方據點區塊分類與城鎮地理描述。
    - [subjugation_nodes.json](file:///i:/gameproject/Medieval/src/data/subjugation_nodes.json)：校正所有官方據點與軍團範本中的歷史錯位文字。
    - [FactionArmyGenerator.ts](file:///i:/gameproject/Medieval/src/systems/map/FactionArmyGenerator.ts)：同步更新軍團特質與生成註解。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **地理真實對齊**：
    - 依據 `bg-map.webp` 與 `MapMaskData.ts` 畫布羅盤，全面校正歷史文案稱謂錯位：
      1. 👑 `f_lothgar`：**👑 洛斯加中央王室**（中央平原）
      2. ⛪ `f_hurst`：**❄️ 北境 赫斯特神聖教廷**（極北雪山 · 保留北境）
      3. 🌹 `f_bellavia`：**🌹 西境 貝拉維亞商會**（翡翠林海 · 保留西境）
      4. 🌋 `f_vormund`：**🌋 熔岩鍛爐 沃爾蒙德大公國**（西南火山群 · 地質文化稱謂）
      5. 🏜️ `f_dusk`：**🏜️ 赤砂荒漠 達斯克城邦**（東南大沙漠 · 地質文化稱謂）
      6. 🌾 `f_oakhaven`：**🌾 橡木谷家族**（西境隱世林地）
      7. 🛡️ `f_blackwood`：**🛡️ 黑木守衛**（西境深林古印）
      8. 🐉 `f_dragonkin`：**🐉 遠古龍裔**（遠古秘境）

  - **邊境守備範本化**：
    - 於 `subjugation_nodes.json` 建立邊境兩大家族專屬編制模板：
      1. `oak_army_template`（🌿 橡木谷民兵自衛隊標準編制 - `f_oakhaven`）：長槍鄉勇、森林長弓手、草藥祭司。
      2. `blk_army_template`（🌲 黑木守衛封印巡邏隊標準編制 - `f_blackwood`）：守印老兵、劫掠悍匪首領、林地暗殺刺客、黑木狂熱者。
    - 同樣設定為 `worldGenMode: 'STORY_ONLY'`，完美融入據點工坊可編輯體系。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **九宮格純戰鬥化**：
    - 將五大軍團範本（`royal_army_template`, `val_army_template`, `mor_army_template`, `lys_army_template`, `cas_army_template`）第二波 3×3 九宮格後排的攻城器械移除，替換為該勢力正規後衛（宮廷法師、重弩破甲手、神聖大主祭、隨軍鍊金術士、荒漠遊俠）。
    - 攻城槌（Rams）與投石機（Catapults）回歸由 AI 出征決策與 `attackerConfig` / `military` 動態掛載與結算，不再佔用士兵肉身格位。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **據點工坊範本化**：
    - 於 `subjugation_nodes.json` 建立 5 大 AI 勢力專屬軍團標準編制模板：
      1. `royal_army_template`（👑 洛斯加王室軍團標準編制 - `f_lothgar`）
      2. `val_army_template`（🌋 沃爾蒙德鐵血軍團標準編制 - `f_vormund`）
      3. `mor_army_template`（⛪ 赫斯特神聖教廷標準編制 - `f_hurst`）
      4. `lys_army_template`（🌹 貝拉維亞金玫瑰行會標準編制 - `f_bellavia`）
      5. `cas_army_template`（🏜️ 達斯克城邦角鬥軍團標準編制 - `f_dusk`）
    - 各範本均包含兩波完整 3×3 九宮格部隊編制（先鋒騎士隊 + 主力大軍/攻城器械），設定為 `worldGenMode: 'STORY_ONLY'`，可直接在據點工坊中自由編輯與測試。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **8×8 專屬圖集 (`faction_units_8x8`)**：
    - 生成純黑底、全角色 100% 嚴格 3/4 側臉朝左（Facing Left `<-`）的 64 格精緻像素厚塗兵種圖集，儲存至 `public/assets/custom_icons/faction_units_8x8.jpg`。
    - 於 `custom_icon_datasets.json` 完整註冊 `faction_units_8x8` 圖集，無縫支援全圖集圖標挑選器（Universal Icon Picker）。
  - **特色兵種資料庫 (`monsters.json`)**：
    - 完整錄入五大陣營（洛斯加王室、沃爾蒙德大公國、神聖教廷、金玫瑰商會、達斯克城邦）以及邊境（橡木谷、黑木悍匪、龍裔）共 26 種特色正規軍團單位。
    - 包含：皇家重劍禁衛、金獅重騎兵、極地黑鐵重甲衛、鍛爐狂戰斧手、聖耀十字軍、天罰聖殿騎士、金玫瑰決鬥家、暗鴉劇毒刺客、赤砂角鬥士、黑鐵長槍兵、龍裔龍衛等。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **根本原因**：先前怪物工坊彈窗儲存按鈕（`btn-save-monster-item`）無條件執行 `monstersDb.push()`，未做 ID 比對更新；當使用者建立怪物後再次點擊「✏️ 編輯」或更換圖標保存時，會將同一隻怪物重複推入陣列中，導致清單與 `monsters.json` 出現兩隻一模一樣的 `goblin_archr`。
  - **修復**：改為以 `findIndex(m => m.id === id)` 進行防重比對更新；同時修復儲存時自動帶入選擇的 `avatarIcon` 與打勾的 `terrains` 地形；並清理了 `monsters.json` 結尾處的重複項目。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **ID 大一統**：
    - 將 `subjugation_nodes.json` 裡的 27 處官方預設模板 ID（如 `val_forge_capital`、`royal_eternal_city`、`royal_scholar_tower`）全面校正為權威大地圖標準代號（`n_val_1` 鍛主之城、`n_royal_1` 舊王都、`n_adv_1` 學士塔 等）。
    - 徹底消除了陣營首都、領地控制、道路拓撲、大地圖渲染與據點工坊之間的別名分裂，實現真正的「唯一真理來源 (SSOT)」。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **根本原因**：原生節點（`INITIAL_MAP_NODES`）採用縮寫 ID（如 `n_val_1` 對應 `鍛主之城`），而討伐據點庫模板採用英文全稱 ID（如 `forge_master_city` 對應 `鍛主之城`）。先前僅檢查 `existingNodeIds.has(tpl.id)`，導致比對落空，將官方 24 處原生據點當成新建常駐據點重複生成了一份。
  - **修復**：在 `GameState.ts` 與 `NarrativeTestController.ts` 中加入 `existingNodeNames.has(tpl.name)` 雙重防重比對。原生同名據點只會同步圖標、特產與守軍編制，絕不再重複生成多餘節點；真正新創的自訂據點（如 `cas_red_sand_city_01`）則精確生成單一實體。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **問題修復**：原本故事工坊的即時沙盒測試控制器（`NarrativeTestController.ts`）僅載入硬編碼的 `INITIAL_MAP_NODES`，導致使用者在據點工坊新建的攻略據點（如 `cas_red_sand_city_01`）與秘境無法在大地圖測試中出現。
  - **架構對齊**：已重構 `NarrativeTestController.ts`，與正式遊戲 `GameState.initGameState()` 對齊，全面動態讀取 `DataStore.getSubjugationTemplates()`，將所有自訂常駐據點與秘境（包含產銷特產配置與全開視野）完整生成至測試大地圖上。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **UI/UX 大升級**：
    - 徹底移除內嵌醜陋的雙卷軸清單，改為優雅的 `【🎨 選擇盛產物資】` 與 `【🎨 選擇需求物資】` 按鈕。
    - 主面板以彩色膠囊標籤（綠色盛產、金色需求）直觀展示已選物資（帶素材小圖標與名稱），點擊標籤上的 `✕` 即可秒速移除。
    - 點擊按鈕彈出全物資視覺化彈窗選擇器（`#modal-material-picker`），支援即時關鍵字搜尋、卡片點擊多選切換、金色光環勾選反饋與一鍵清空。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **架構大一統**：
    - 徹底廢除重複抽象的 `TradeGood` 分類宣告，將城鎮市場、商隊跑商、鐵匠鋪鍛造、強化素材與領地倉庫 100% 統一收斂至唯一權威資料庫 [src/data/materials.json](file:///i:/gameproject/Medieval/src/data/materials.json)。
    - `src/systems/MarketSystem.ts` 中的 `TRADE_GOODS` 直接引用 `materials.json`，杜絕任何重複 ID、同名錯亂與物資轉換落差。
  - **據點工坊 (Subjugation Studio) 產銷自訂對接**：
    - 在據點屬性面板中新增「城鎮市場產銷配置」UI，可自由勾選指定該據點之【🛒 盛產／可買物資 (低價批發)】與【💰 短缺／需求物資 (高價收購)】。
    - 勾選清單直接動態讀取 `materials.json`，即時支援在裝備工坊中新增的任何新素材。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **故事工坊選單擴充 (`src/models/Narrative.ts`, `src/tools/story-studio/StoryStudioTypes.ts`, `src/tools/story-studio/StoryStudioForm.ts`)**：
    - 在故事編輯器「條件選單」中無縫新增 3 大沙盒狀態條件：
      1. 🏰 **`NODE_OWNER_IS`（據點控制權）**：指定據點（如 `n_royal_1`）當前是否被特定派系佔領。
      2. ⚔️ **`FACTION_AT_WAR`（派系交戰中）**：指定派系是否處於交戰宣戰狀態。
      3. 🌾 **`FACTION_STARVING`（派系陷入糧荒）**：指定派系是否因斷糧陷入飢荒。
  - **敘事判定與文案描述 (`src/systems/NarrativeSystem.ts`)**：
    - 在 `checkCondition` 與 `describeCondition` 中完整實裝沙盒條件比對，與動態文字插值器協同運作。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **大地圖軍團道路渲染 (`src/ui/MapScene.ts`)**：
    - 在 Phaser 地圖引擎中新增 `renderCampaignLegions()`，依據出征陣營代表色、兵種 Emoji（`🏰` 圍城 / `🐎` 掠奪）與道路進度平滑繪製行軍軍團標籤。
    - 支援軍團點擊互動與滑鼠懸停，發布 `faction-campaign-clicked` 全域自訂事件。
  - **軍情刺探與野外攔截彈窗 (`src/templates/modals-combat-trade.html`, `src/ui/modals/FactionCampaignModalController.ts`)**：
    - 實裝 `#modal-faction-campaign-intel` 彈窗，展示進攻方勢力、目標據點、敵軍編制、預估抵達天數與外交後果提示。
    - 實裝【⚔️ 發動野外攔截伏擊】與【🕊️ 放行旁觀】交互，攔截成功後即時瓦解進攻軍團，並結算雙向外交好感度（進攻方 -35、防守方 +40）。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **戰役與行軍系統 (`src/systems/faction/FactionCampaignSystem.ts`)**：
    - 實裝軍事戰役生命週期（出征調集 `MARCHING` ➔ 圍城轟擊/掠奪 `SIEGING` / `BORDER_RAID` ➔ 班師回朝 `RETURNING` ➔ 結算 `RESOLVED`）。
    - 邊境掠奪即時結算：掠奪目標國庫與糧草，重挫目標領地安定度並提升厭戰度。
    - 要塞圍城決戰：攻守雙方戰力與城門器械比對，破城時轉移據點控制權並自動簽訂 180 天停戰保護協定。
  - **故事與傳聞橋接 (`src/systems/faction/FactionNarrativeBridge.ts`)**：
    - 自動將重大戰役事件轉譯為酒館流動傳聞與歷史捷報。
    - 實裝故事工坊動態文字插值（`{NODE_NAME}`、`{NODE_OCCUPIER}`、`{NODE_RULER_NAME}`、`{WAR_ATMOSPHERE}`）與三大沙盒狀態條件判定，大幅降低劇情創作文本負擔。
  - **驗證**：32 個測試檔案 143 項單元測試 100% 全部通過，Vite 生產打包 0 錯誤。

  - **陣營深度資料模型 (`src/models/FactionProfile.ts`)**：
    - 定義 `FactionEconomicProfile`（國庫、糧草天數、稅收、關稅、軍餉、淨盈虧）、`FactionMilitaryProfile`（步兵/弓兵/騎兵編制、後備兵源池、攻城器械庫存）、`FactionPersonalityTraits`（好戰、貪婪、猜忌、榮譽與核心慾望）與 `FactionMemory`（事件記憶與停戰期）。
  - **經濟與兵源引擎 (`src/systems/faction/FactionEconomyEngine.ts`)**：
    - 每日動態結算各據點階級稅收與農村糧食收成、扣除軍隊軍餉與糧食消耗。
    - 飢荒與破產連鎖反應：糧盡觸發民心動盪與逃兵潮；國庫空虛壓制安定度；和平與繁榮期自適應提升安定度與兵源恢復。
  - **決策大腦與 4 大保命煞車機制 (`src/systems/faction/FactionDecisionAI.ts`)**：
    - 實裝 4 大強制保命煞車（國庫緊繃凍結進攻轉入防守、厭戰度過高強制發起停戰求和並享有 180 天停戰保護、出征中鎖定、缺糧向玩家發布重金運糧委託）。
    - 實裝多維度效用評估模型（經商休養、僱傭玩家第三方作戰、邊境掠奪與大軍圍城攻防）。
  - **驗證**：31 個測試檔案 140 項單元測試 100% 通過、TypeScript 0 型別錯誤與 Vite 生產打包驗證通過。

  - **根本原因**：HTML 模板為 JS 動態字串注入，行內樣式 `style="background-image: url('/...')"` 不受 Vite 編譯期路徑重寫，導致瀏覽器直連根域名 404 使街道建築與傭兵面板隱形。
  - **解決方案**：
    - 將街道建築（領主自宅、謁見廳、酒館、改造所、二手商、防禦工事、鍛造屋、教會）與傭兵面板的背景圖與尺寸**全部集中至 [style.css](file:///i:/gameproject/Medieval/style.css) 作為 SSOT**，徹底由 Vite 編譯器轉換為帶 `/Medieval/` 前綴之正確路徑。
    - 清理 [views-main.html](file:///i:/gameproject/Medieval/src/templates/views-main.html) 與 [panels-hud.html](file:///i:/gameproject/Medieval/src/templates/panels-hud.html) 中的行內背景樣式。
    - 優化 [IconSpriteHelper.ts](file:///i:/gameproject/Medieval/src/ui/IconSpriteHelper.ts) 動態 `BASE_URL` 解析。
    - 通過 132 項自動化測試與 Vite 生產打包驗證，街道建築、羊皮紙底圖與按鈕紋理 100% 恢復正常。

- **[Fix/Build/TemplateLoader] 採用 Vite 原生 `?raw` 靜態字串導入修復生產環境 (GitHub Pages) HTTP 404 報錯（2026-08-28）**：
  - **根本原因**：原先 `TemplateLoader.ts` 採用執行期 `fetch('./src/templates/*.html')`，在本地 dev 模式正常，但在生產打包 (`npm run build`) 部署至 GitHub Pages 時，`src/templates/` 未被輸出至 `dist/`，導致 `ui-chrome.html` 等片段返回 HTTP 404 遊戲初始化失敗。
  - **解決方案**：在 [TemplateLoader.ts](file:///i:/gameproject/Medieval/src/ui/TemplateLoader.ts) 中改用 Vite 提供的原生 `import html from '../templates/*.html?raw'`，在編譯期直接將 HTML 模板打包嵌入至 JS bundle 中，實現 0 網路請求、0 延遲與 100% 部署相容性，同時完整保留 template 檔案獨立拆分規範。

- **[Feature/Combat/UnifiedSiegeBoard] 桌遊棋盤式攻守統一戰役系統 (Unified Siege Board & Role Binding) 全鏈路重構實裝（2026-08-28）**：
  - **棋盤與席位標準解耦抽象 (`types.ts`, `Combat.ts`, `InteractiveCombatSession.ts`, `CombatUIManager.ts`)**：
    - 🎲 **標準棋盤固定規範 (The Immutable Board)**：戰場統一劃分為左側進攻席位 (`AttackerSlot`)、中央要塞城門 (`SiegeGate`)、右側防守席位 (`DefenderSlot`)。
    - 🔗 **接口方判定 (Role Binding)**：守城戰時玩家接入 `DefenderSlot`、敵軍接入 `AttackerSlot`；攻城戰時玩家接入 `AttackerSlot`、敵軍接入 `DefenderSlot`。
    - 📐 **九宮格座標席位統一公式**：
      - 左側部隊 (Attacker)：面向右側推進，$\text{gridColumn} = 3 - \text{gridR}$ (前排 $X=3$ 靠中，後排 $X=1$ 靠左)。
      - 右側部隊 (Defender)：面向左側迎敵，$\text{gridColumn} = \text{gridR} + 1$ (前排 $X=1$ 靠中，後排 $X=3$ 靠右)。
    - 💥 **城門受擊與戰術目標歸屬**：中央城門所屬權永遠為防守席位，只承受來自進攻席位的器械（衝車、投石機）轟擊；攻城戰敵方守軍絕對不攻擊城門。
  - **多台攻城器械配置 (方案 A)、投石機邊際遞減與衝車輪撞降 CD 機制 (`LordCommanderSystem.ts`, `InteractiveCombatSession.ts`, `OffensiveSiegeModalController.ts`)**：
    - 🪨 **重型投石機邊際遞減齊射**：每台提供 4 枚巨石，每 2 回合發射一輪齊射。多台齊射傷害依等比衰減（第 1 台 800、第 2 台 560、第 3 台 392，總計 800 / 1360 / 1752）；城破後巨石分散砸入城內壓制不同敵軍並震懾暈眩。
    - 🪵 **撞木衝車交替輪流衝撞降 CD**：每台需 $\ge 10$ 名步兵推車（$N$ 台需 $\ge N \times 10$ 步兵）。1 台每 2 回合撞擊 1 次（冷卻 1 回合）；2 台交替接力達成**每 1 回合無間斷連續撞擊**（0 CD）；3 台三台高速輪替，每回合撞擊且 50% 機率追加二次連鎖重擊！
    - 🏰 **爵位與天賦器械上限接口 (`SiegeEngineRegistry`)**：基礎上限各 3 台，封裝提供者接口供未來爵位（公爵 +2）與天賦樹無縫擴充。
    - 🎛️ **UI 步進計數器與二階素材倍數消耗**：介面升級為 `[ - ] 數量 [ + ]`，動態結算二階加工素材（木板/鐵錠/石磚）與金幣成本，極限消耗中後期積壓產能。
  - **三大兵種攻城特化、PDEF 防禦減傷與嚴謹戰損模型 (`LordCommanderSystem.ts`, `InteractiveCombatSession.ts`, `CombatSystem.ts`)**：
    - 🏹 **弓兵漫天箭雨 PDEF 減傷與後排陣地血池**：箭雨傷害全面納入目標物理防禦計算 $\text{Dmg} = \text{Raw} \times \frac{100}{100 + \text{PDEF}}$；弓兵自帶後排生命池（40 HP/人），前排步兵護盾破裂後按傷害等額折算弓兵傷亡，徹底解決千人大軍固定暗扣 bug。
    - 🐎 **攻城騎兵階段性戰術**：城門未破前禁止衝鋒並標記 🔒【騎兵待命中】；城門被轟碎倒塌瞬間，解鎖 ⚡【破城毀滅突入】，騎兵直插城內廣場碾壓敵軍並造成加倍傷害與集體震懾暈眩。
    - 🛡️ **步兵工兵護盾**：每 1 名步兵提供 50 點軍團護盾，前排受擊優先扣除護盾，每 50 護盾折損 1 名步兵。
  - **鍛造屋攻城器械打造工坊、謁見廳軍備展示與庫存上限 (`Territory.ts`, `views-facility.html`, `ForgeUIController.ts`, `OfficeController.ts`)**：
    - 🔨 **鍛造屋打造工坊**：領地達營地規模 (CAMP) / 騎士爵位解鎖打造資格，在鍛造屋第 6 頁籤【🪵 攻城器械工坊】消耗二階加工素材打造衝車與投石機，庫存上限各 **10 台**。修正石磚素材 ID 權威指向 `mat_stone_brick`，打造成功後立即觸發 `UIManager.updateUI()` 即時扣減頂部 HUD 金幣與領地物資。
    - 👑 **謁見廳軍備儀表板**：即時展示領地當前攻城軍備庫存（`🪵 撞木衝車: X / 10 台`、`🪨 重型投石機: Y / 10 台`）。
  - **攻城編制庫存調派攜帶 (各限帶1台)、行軍天數計算 (+1天/台) 與真實行軍生命週期 (`OffensiveSiegeModalController.ts`, `modals-combat-trade.html`, `CombatUIManager.ts`, `InteractiveCombatSession.ts`, `GameLoop.ts`, `UIManager.ts`)**：
    - 🎛️ **從庫存調派攜帶**：攻城編制 UI 改為從領地庫存勾選攜帶（各限帶 1 台），出征時扣除庫存並即時更新頂部 HUD 糧草。
    - 🗺️ **行軍天數與隨軍口糧**：總行軍天數 $D_{\text{march}} = D_{\text{base}} + (\text{衝車}?1:0) + (\text{投石機}?1:0)$，隨軍乾糧依往返天數動態計算。
    - 🐎 **真實行軍任務生命週期 (LordSiegeCampaignMission)**：點擊【👑 領主親征】或【⚔️ 委託先鋒】後建立行軍任務，參戰傭兵標記為 `DISPATCHED`，主介面顯示行軍倒數進度；領地回到每日正常運轉，玩家每次點擊【過日 / 下一回合】時行軍天數 -1 並消耗口糧，當天數歸零（兵臨城下）時自動觸發攻城戰役！
    - 🛡️ **席位與城門判定修復**：修正 `CombatUIManager.ts` 只有守城戰才掛載鏡像反轉樣式，攻城戰時玩家 100% 保持在左側進攻席位、敵軍在右側守備席位；嚴格限制**只有進攻方近戰部隊受城牆阻隔打擊城門，敵方守軍身處城內絕不攻擊城門**。
    - 🏰 **據點工坊 SSOT 直連**：出征時精準讀取目標據點在工坊中設定的城門最大耐久（如 30,000 HP）與真實怪獸波次名冊、精靈頭像 Sprite、技能與九宮格佈陣。
    - 🛡️ **城垛掩體與城門 HUD 文案精確化**：城垛掩體 25% 減傷（`🛡️ (城垛掩體減傷)`）嚴格綁定**防守方席位（Defender）**；中央城門 HUD 動態依攻守戰役精準切換為「🏰 敵方要塞城門耐久度」與「🛡️ 主城防衛城門耐久度」。
    - 🎯 **戰術九宮格智能自適應方位 (`TerritoryDefenseModalController.ts`, `modals-combat-trade.html`)**：依據戰術型態動態自適應九宮格佈局與映射：
      - 🌲 **野外攔截戰 (野戰衝鋒)**：自適應呈現「左列：`🏰 後排 (r=2)` ➔ 中列：`🛡️ 中排 (r=1)` ➔ 右列：`⚔️ 前排 (r=0，面向右側衝鋒)`」。
      - 🏰 **領地守城戰 (守門禦敵)**：自適應呈現「左列：`⚔️ 前排 (r=0，靠近城門守衛)` ➔ 中列：`🛡️ 中排 (r=1)` ➔ 右列：`🏰 後排 (r=2，城內後備)`」。
      - 格子空槽提示、頂部標籤與傭兵點擊填位 100% 動態連動，徹底消除攻守心智與戰鬥站位錯位問題。
    - 📐 **野外迎擊雙方對進遭遇算法 (`TerritoryDefenseSystem.ts`, `TerritoryDefenseModalController.ts`)**：
      - 精準計算相向行軍遭遇天數 $D_{\text{intercept}} = \max(1, \lfloor T / 2 \rfloor)$ 與戰敗後殘存敵軍抵達天數 $T_{\text{remaining}} = T - D_{\text{intercept}}$（例如敵軍進逼 7 天時，我軍在第 3 天遭遇交火；戰敗後主城尚有 4 天緩衝防守時間）。
      - 部署彈窗動態呈現遭遇預估與防禦緩衝天數。
  - **據點工坊 (Encounter / Group Studio) 戰鬥團體陣營攻守接口角色與參數分類 (`types.ts`, `combat-studio.html`, `CombatStudio.ts`)**：
    - 規範 `CombatGroupRole`：`DEFENDER_ONLY`（僅防守方）、`ATTACKER_ONLY`（僅進攻方）、`VERSATILE`（攻守通用）。
    - 🎛️ **工坊編輯 UI 全面實裝**：在討伐據點/戰鬥團體工坊中加入【🏰 攻守戰役陣營接口與可控條件】控制面板。
      - 🛡️ **防守方接口**：城門最大耐久（1000~10000 HP）、防禦箭塔數量 (0~3座)、箭塔每回合傷害 (0~150)、城垛射手加成 (0~50%)。
      - ⚔️ **進攻方接口**：撞木衝車數量 (0~3台)、重型投石機數量 (0~3台)、AI 戰術傾向 (破門優先 vs 殲敵優先)。
      - 🔄 **角色切換連動**：依陣營定位（僅守方/僅攻方/攻守通用）智能動態展開對應控制面板並雙向即時同步儲存。
  - **驗證**：TypeScript 型別檢查 0 錯誤、29 個測試檔案 132 項單元測試 100% 全部通過。
- **[Feature/MapScene/DynamicNodeTextLOD] 大地圖據點文字智能動態字級 (全景 1.0x ➔ 極限放大 2.5x) 實裝（2026-08-28）**：
  - **智能動態字級演算法 (`MapScene.ts`)**：新增 `updateNodeTextScales()`，依據相對縮放倍率動態計算阻尼縮放公式 `targetScreenRatio = 1 + (2.5 - 1) * ((relZoom - 1) / (5.5 - 1))`，將世界座標縮放設為 `targetScreenRatio / relZoom`。
  - **極致閱讀體驗**：全景視角下維持 1.0x 原生精美字級（11px/14px），不遮擋山脈全景；放大到 5.5 倍極限時，名稱標籤與徽章在螢幕上平滑過渡至 2.5x 大小，清晰顯眼且不會過度膨脹，圖標則隨地圖自然等比縮放。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/ExponentialZoomAndSizeRevert] 大地圖等比指數滾輪縮放 (每次 15%) 與節點經典尺寸還原（2026-08-28）**：
  - **平滑等比指數縮放 (`MapScene.ts`)**：滑鼠滾輪縮放改用指數演算法（每次等比縮放 15%：`newZoom = zoom * 1.15` / `zoom / 1.15`），徹底消除固定加減步長在不同視野下的手感落差，全景與微觀過渡極致均勻流暢。
  - **節點尺寸 100% 經典還原**：玩家主據點 `42px`（光環 `76×38px`、徽章 `y = -50`、文字 `y = 12`）、一般固定城鎮 `35px`（文字 `y = 12`）、動態巢穴 `25px` 全面還原為原版精緻比例。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/MultiTierNaturalZoom] 大地圖多級深入放大（提升至 5.5 倍）與節點自然等比縮放機制實裝（2026-08-28）**：
  - **最大放大倍率大幅提升 (`MapScene.ts`)**：將相機最大縮放上限由 `3 倍` 提升至 **`5.5 倍` (`minZoom * 5.5`)**，支援玩家深入檢視道路分歧、河流山川與要塞周邊的精細地形地貌。
  - **自然等比隨圖縮放**：移除反向補償縮放限制，所有節點（玩家據點 62px / 固定城鎮 55px / 動態巢穴 45px）隨相機自然流暢地等比放大與縮小，達成如真實沙盤般的沉浸式空間體驗。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/EnlargeNodeIconSizes] 大地圖節點圖標全面放大升級（玩家據點 62px / 固定城鎮 55px / 動態巢穴 45px）（2026-08-28）**：
  - **圖標規格全面升級 (`MapScene.ts`)**：
    - 👑 **玩家主據點**：由 `42px` 放大至 **`62px`**；金色發光外環擴大至 `96×48px`、內環 `74×36px`，徽章置頂於 `y = -56`。
    - 🏰 **一般固定城鎮／要塞**：由 `35px` 放大至 **`55px`**；名稱文字標籤間距調整至 `y = 20`。
    - 🌫️ **動態巢穴／隨機秘境**：由 `25px` 放大至 **`45px`**。
  - **視覺比例與閱讀體驗**：大幅增強大地圖要塞與村落的視覺辨識度與手繪 Isometric 建築精緻度，文字標籤與狀態徽章完美間隔無遮擋。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/ConstantNodeScreenScale] 大地圖節點反向縮放補償機制 (模式 A：保持固定螢幕尺寸) 實裝（2026-08-28）**：
  - **動態反向縮放引擎 (`MapScene.ts`)**：新增 `updateNodeScales()`，監聽相機 `zoom` 變更事件（滑鼠滾輪縮放、視窗 Resize、地圖重建），動態將所有節點 Container 與戰鬥信標的 Scale 設為 `1 / zoom`。
  - **螢幕恆定與交互保真**：無論地圖縮小至全景還是放大至局部細節，節點圖標、名稱標籤與狀態徽章皆保持舒適好讀的固定螢幕尺寸；滑鼠懸停 (Hover) 動畫完美基於當前動態基準 Scale 放大 1.25 倍並平滑縮回。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Refactor/MapScene/ResetContainerFilter] 重置大地圖容器壓暗濾鏡 (brightness/sepia) 以展現 100% 原圖真實色彩（2026-08-28）**：
  - **樣式重置與原碼備份 (`views-main.html`)**：將 `#map-nodes-container` 上的 `filter: brightness(0.8) sepia(0.2) contrast(1.1); box-shadow: 0 0 50px rgba(0,0,0,0.8);` 設為 `filter: none;`，並在 HTML 中完整備份原始濾鏡注釋，徹底消除 20% 強制壓暗與泛黃灰濛感，100% 還原原圖純淨明亮的金黃沙丘、雪白冰山與翠綠森林。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/CombatStudio/All27StaticNodesCovered] 大地圖 27 處原生固定節點 100% 全面收錄至討伐據點工坊資料庫（2026-08-28）**：
  - **補齊 8 處固定據點 (`subjugation_nodes.json`)**：
    - 🌋 **燃鐵礦場** (`val_iron_quarry`)：Lv.2 火山鐵礦村落，配備礦山巡邏守衛與重裝工頭。
    - 🏔️ **無光修道院** (`mor_dark_monastery`)：Lv.0 雪山秘境，黑袍血脈狂信徒與秘儀大司祭。
    - 🏔️ **碎冰灣** (`mor_frost_bay`)：Lv.2 極寒破冰漁村，霜雪守備隊與海灣獵手。
    - 🌲 **荊棘谷** (`lys_bramble_valley`)：Lv.3 密林劇毒要塞，影刃刺客與隨行敵方軍團。
    - 🌲 **暗鴉村** (`lys_dark_crow_village`)：Lv.2 森林偽裝村落，暗鴉斥候密探與偽裝村民。
    - 🏜️ **赤砂城** (`cas_red_sand_city`)：Lv.3 沙漠傭兵要塞，赤砂僱傭狂兵與隨行敵方軍團。
    - 🏜️ **枯骨綠洲** (`cas_withered_oasis`)：Lv.1 沙漠水源營地，綠洲奴隸捕手與流寇。
    - 🌾 **十字路口旅店** (`wild_crossroad_inn`)：Lv.1 中立平原驛站，鬧事酒客與荒野路霸。
  - **驗證**：比對腳本確認 27/27 處固定節點 100% 全數收錄且對應專屬 Isometric 圖標，28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/StrongholdIconSSOT] 大地圖節點圖案全面對齊討伐據點工坊唯一真實來源 (SSOT) 與圖集動態預載入（2026-08-28）**：
  - **Phaser 圖集動態自動化 Preload (`MapScene.ts`)**：在 `MapScene.preload()` 中動態讀取 `custom_icon_datasets.json`，自動解析並載入所有註冊的 Isometric 據點與建築圖集（如 `stronghold_iso_spritesheet_5x5` 等），根除因缺失紋理導致退回預設城堡的問題。
  - **大地圖節點圖標動態 SSOT 查詢 (`MapScene.ts`)**：`createNodeIconSprite()` 動態向 `DataStore.getSubjugationTemplates()` 依 `id` 與 `name` 查詢取得工坊最新設定的 `tpl.icon`，並精確裁切對應的 5×5 / 4×3 Frame 貼圖，創作者在工坊更換據點圖標後大地圖即時生效。
  - **存檔讀檔自動同步 (`SaveManager.ts`)**：在 `loadGame()` 還原節點時自動與 `DataStore.getSubjugationTemplates()` 比對，將工坊最新 `customIcon` 與 `allowTroops` 無縫同步至遊戲世界存檔節點。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Docs/Architecture/NPCAutonomousDesign] 建立 NPC 自主推演與動態世界觀系統設計規範文件（2026-08-27）**：
  - **權威架構文件 ([docs/NPC_AUTONOMOUS_SYSTEM_DESIGN.md](file:///i:/gameproject/Medieval/docs/NPC_AUTONOMOUS_SYSTEM_DESIGN.md))**：詳細歸納系統核心定位（服務於劇情世界觀）、三大沙盒狀態合約、故事工坊自適應插值機制、NPC 底層四大維度變數矩陣、四大保命煞車機制、連續劇因果表現層與分階段實裝路線圖。
- **[Fix/StoryStudio/FactionModalZIndex] 故事工坊自訂陣營與聲望彈窗置頂層級與毛玻璃遮罩修復（2026-08-27）**：
  - **彈窗樣式與層級修復 (`StoryStudioFactionManager.ts`)**：為「🏷️ 自訂陣營與聲望管理」彈窗容器加入 `position: fixed`、`z-index: 999999` 與全螢幕 `backdrop-filter: blur(5px)` 暗色遮罩，徹底解決過去點擊後彈窗出現在故事編輯器主畫面背後被遮擋的 UI 層級異常。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/PlayerSettlementProgressionIcons] 玩家據點等級升級專屬 Isometric 城鎮圖標映射實裝（2026-08-27）**：
  - **圖集註冊與載入 (`settlement_sheet.png`, `MapScene.ts`)**：將新生成的 5×5 2.5D Isometric 城鎮精靈圖表儲存至 `public/assets/custom_icons/settlement_sheet.png` 並在 Phaser 引擎中預載入。
  - **玩家領地階層專屬綁定 (`MapScene.ts`)**：
    - ⛺ **營地 (CAMP)** ➔ `settlement_sheet_0`（拓荒帳篷營地）
    - 🏡 **村莊 (VILLAGE)** ➔ `settlement_sheet_5`（綠水井繁榮村落）
    - 🏘️ **城鎮 (TOWN)** ➔ `settlement_sheet_10`（圍牆市集石堡）
    - 🏰 **首都 (CAPITAL)** ➔ `settlement_sheet_20`（哥德大教堂帝都）
    - 🏚️ **荒野 (WILDERNESS)** ➔ 保持原圖 `node-ruins`
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/MapScene/DynamicCustomNodeIcons] 大地圖節點專屬自訂圖標 (customIcon) 動態 Sprite 切圖渲染引擎接通（2026-08-27）**：
  - **動態圖集切格渲染 (`MapScene.ts`)**：實裝 `createNodeIconSprite()`，支援大地圖節點直接讀取 `node.customIcon`（如 `cave_node_01:cave_node_01_16`、`icons_buildings:icons_buildings_3` 等），並在 Phaser 引擎中動態依據行列座標進行 Sprite 幀精確裁切與渲染。未指定自訂圖標之節點自動 fallback 至等級圖標。
  - **新遊戲開局與工坊對齊 (`GameState.ts`, `types.ts`)**：開局與世界生成時，自動將 `SubjugationTemplate` 設定的自訂圖標 (`icon`) 同步注入至對應的 `MapNode.customIcon`，實現工坊所選圖標即時在大地圖呈現。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Refactor/Settlement/NPCSettlementStability] 拔除 NPC 據點繁榮度衰退與等級降級機制，鎖定 NPC 固定規模並保留玩家領地晉級（2026-08-27）**：
  - **NPC 據點穩定性提升 (`MapNodeSystem.ts`)**：移除 `simulateProsperity()` 中對非玩家節點（NPC 國家首都、要塞、城鎮與險地）的繁榮度扣減與等級降級計算。各大勢力城鎮永遠維持其設定的原始規模與繁榮度，市場交易、謁見廳與攻城關卡全面穩定運作。
  - **玩家領地成長專屬化 (`MapNodeSystem.ts`)**：僅針對玩家主據點 (`node.isPlayerBase`) 實裝人口、設施與道路繁榮度即時動態評分與等級晉升，保留玩家開疆拓土由營地晉升為王城的成就反饋。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/WorldGen/TieredClearanceDistance] 大地圖城鎮與野外據點分級安全間距演算法實裝（城鎮對城鎮 4.5 / 城鎮對野外 3.2 / 野外對野外 3.0）（2026-08-27）**：
  - **分級間距矩陣 (`MapGenerator.ts`)**：新增 `getRequiredDistance()` 函式，區分常規城鎮 (`NodeFeature.OCCUPIABLE`) 與野外魔物巢穴/險地 (`NodeFeature.SUBJUGATION`)。將城鎮對城鎮間隔調整為 `4.5`（滿足創作者自訂與新增更多城鎮的需求），城鎮對野外據點為 `3.2`，野外對野外為 `3.0`。
  - **動態自適應選點與校驗 (`MapGenerator.ts`)**：坐標生成演算法採用滿足分級間距條件的候選點，並在 `validateWorld` 中嚴格依據分級間距標準精確校驗，徹底修復城鎮與野外險地過近的衝突報錯。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Fix/CombatStudio/StrongholdSmartMerge] 據點庫本地快取與官方磁碟 24 處據點智慧合併 (Smart Merge) 與強制重載全面實裝（2026-08-27）**：
  - **智慧合併演算法 (`CombatStudio.ts`, `DataStore.ts`)**：載入據點庫時，自動比對磁碟檔案 `subjugation_nodes.json` 與瀏覽器 `localStorage`，若磁碟中有新增據點（如永恆之城、鍛主之城、聖耀王座等 18+ 處國家要塞與巢穴）自動合併注入，徹底解決舊版瀏覽器快取殘留遮蔽新據點的問題；同時完美保留創作者自建的新據點。
  - **強制重載按鈕升級 (`CombatStudio.ts`)**：工坊【🔄 重新讀取硬碟】按鈕支援強制完全重載磁碟據點檔案並覆蓋本機快照。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Fix/WorldGen/TerrainCompatibilityEngine] 大地圖生成概念地形相容性引擎實裝與開局坐標放置修復（2026-08-27）**：
  - **地形相容性匹配機制 (`MapGenerator.ts`)**：實裝 `isTerrainCompatible` 核心函式，區分 5 大實體地貌像素（平原、森林、雪山、火山、沙漠）與概念型副本環境（古遺跡 `RUINS`、洞穴 `CAVE`、荒野 `WILDERNESS` 等）。允許概念型地下城/秘境據點座落於任何合法陸地像素上，徹底根除 `Unable to place map node ... on terrain RUINS` 開局崩潰異常。
  - **驗證**：TypeScript 型別檢查 0 錯誤、擴充專屬單元測試、28 個測試檔案 122 項單元測試 100% 全部通過。
- **[Feature/CombatStudio/StrongholdCustomization & TroopDispatch] 大地圖攻略據點工坊全方位自訂、國家/固定據點全面收錄、新遊戲世界生成與「允許帶兵討伐」開關全面實裝（2026-08-27）**：
  - **大地圖固定魔物巢穴與國家攻城據點全面收錄 (`subjugation_nodes.json`)**：
    - 收錄 24+ 處完備據點範本：包含火山硫磺深淵、雪山飢餓冰窟、森林幻毒沼澤、沙漠死寂深淵、染血丘陵、嘆息平原等野外險地，以及舊王都永恆之城、鍛主之城、聖耀王座、金玫瑰城、黑鐵樞紐、黑曜石堡、裁決要塞等各大國家/勢力核心攻城戰略要塞。
  - **據點工坊（Subjugation Studio）功能升級 (`CombatStudio.ts`, `combat-studio.html`)**：
    - 支援「＋ 創造新據點」與「🗑️ 刪除據點」。
    - 實裝【🛡️ 允許帶兵討伐／攻城 (`allowTroops`)】勾選框。
    - 實裝【大地圖生成模式 (`worldGenMode`)】下拉選單（🌐 開局常駐生成 / 🌫️ 迷霧隱藏秘境 / 📜 故事事件專屬）。
    - 實裝【所屬國家／勢力 (`factionId`)】與【節點規模等級 (`nodeLevel`)】配置，並在左側清單新增「勢力篩選」過濾器與「🛡️可帶兵」徽章。
  - **新遊戲大地圖動態生成整合 (`GameState.ts`, `MapGenerator.ts`)**：
    - 新開局時，大地圖演算法自動讀取據點工坊中所有標記為常駐與秘境的自訂與國家據點，隨機分布於大地圖上，實現大地圖攻略內容完全由創作者自訂。
  - **遊戲內派遣出征兵力調派連動 (`DispatchModalController.ts`)**：
    - 派遣討伐或攻城時，若目標節點開啟 `allowTroops` 或 `isWar`，自動支援調派步兵（護盾）、弓兵（箭雨）與騎兵（衝鋒）軍團。
  - **驗證**：TypeScript 型別檢查 0 錯誤、擴充專屬單元測試、28 個測試檔案 121 項單元測試 100% 全部通過。
- **[Fix/UI/RightPanelBackgroundRestore] 修復右側帝國儀表板底圖與樣式隔離（2026-08-27）**：
  - **樣式範圍嚴格隔離 (`UIThemeStudio.ts`)**：修正全域樣式注入規則，移除對 `.glass-panel` 的強制 `!important` 覆蓋，將自訂樣式嚴格限制於獨立設施視圖 (`.facility-view .glass-panel:not(#shared-right-panel)`)，徹底排除並保護右側帝國儀表板 (`#shared-right-panel`)，100% 恢復右側原始羊皮紙與精緻底圖外觀。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Tools/LiveLayoutEditor] 遊戲內即時覆蓋排版與美術編輯器 (Live HUD & Layout Inspector) 全面實裝（2026-08-27）**：
  - **即時覆蓋編輯器 (`LiveLayoutEditor.ts`)**：
    - **點選元素高亮 (Inspector)**：在遊戲任意畫面（街道/戰鬥/書房/地圖）連續敲擊鍵盤 **`layout`** 或 **`edit`** 即可在當前畫面上喚出浮動編輯面板。滑鼠移到任意 UI（建築圖標、進度條、NPC頭像、輪盤、背景）均會出現金色高亮框，點擊立即選中。
    - **🖱️ 自由拖曳移動 (Drag to Move)**：勾選「自由拖曳移動」後，可直接用滑鼠在遊戲畫面上拖動任何元素到任意位置。
    - **🖼️ 素材與背景圖片替換**：直接從電腦挑選 PNG/JPG 本地圖片，一鍵替換選中元素的背景或圖片素材。
    - **📐 座標尺寸與框體微調**：即時調節 X/Y 座標、寬度、高度、圓角半徑與透明度。
    - **💾 永久儲存與開局套用 (`main.ts`)**：點擊【💾 儲存】即可永久記錄排版，刷新頁面自動保留所有自訂位置。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Tools/UIThemeStudio] 全域視覺排版與美術工坊 (UI & Asset Studio) 全面實裝，改由 CHEAT 密技觸發（2026-08-27）**：
  - **移出常規遊戲介面 (`views-facility.html`, `FacilityController.ts`)**：自領主書房「其他指令」中徹底移除視覺工坊按鈕，維持純淨的遊戲探索與內政體驗。
  - **CHEAT 密技系統喚醒 (`CheatController.ts`)**：
    - 遊戲中直接敲擊鍵盤英文字母 **`layout`** 或 **`theme`** 即可即時喚醒工坊。
    - 支援主控制台 `openThemeStudio()` / `openUIStudio()` 隨時呼叫。
  - **視覺工坊核心功能 (`UIThemeStudio.ts`)**：
    - **多場景真機即時預覽**：支援切換預覽【⛪ 修道院】、【🍺 酒館】、【🏛️ 領主書房】、【⚒️ 鍛造屋】。
    - **自訂美術圖片替換**：支援本地圖片（PNG/JPG）一鍵上傳與各場景背景動態換裝。
    - **框體與面板風格微調**：滑桿即時調節底色透明度、邊框粗細、圓角半徑與邊框顏色。
    - **按鈕視覺風格切換**：預設 5 大中世紀按鈕色系（暗金、青銅木紋、皇家秘術紫、翡翠綠、狂戰深血紅）與圓角微調。
    - **雙欄排版比例即時調整**：滑桿動態調整設施左欄佔比（25% ~ 50%）。
  - **全域持久化與動態注入 (`UIThemeStudio.ts`, `main.ts`)**：點擊【💾 儲存並套用至全遊戲】即可透過 LocalStorage 與動態樣式注入，使全遊戲所有建築與面板永久換上調製好的新外觀。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Combat/MultiSquadHealthAndWoundSettleFix] 多梯隊迎擊/守城戰全參戰成員戰後血量與重傷瀕死 1:1 寫回修復（2026-08-27）**：
  - **全梯隊參戰成員總追蹤 (`CombatSystem.ts`, `InteractiveCombatSession.ts`)**：
    - 引入 `allTrackedPlayers` 總追蹤機制，在開局第一梯隊以及後續增援梯隊登場時，即時將所有參戰成員納入追蹤。
    - 徹底修復過去換梯隊後，先前陣亡被換下的前排隊員因脫離 `playerTeam` 而遺漏結算的嚴重 Bug。
  - **戰後 100% 精準寫回**：
    - 戰鬥結束時，對所有梯隊的每一位成員執行 1:1 寫回：陣亡者 100% 賦予【🩸 重傷瀕死】Debuff 並鎖定 1 HP；殘存者精準寫回真實剩餘 HP/MP。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Config/Civic/ChurchBedAdvancedMaterialCost] 病床打造材料升級為木板 (mat_wood_plank) 與皮革 (mat_leather) 全鏈路實裝（2026-08-27）**：
  - **精確材料校準 (`ChurchSystem.ts`, `ChurchModalController.ts`)**：
    - 將打造病床的消耗由原木改為進階加工材料：**20 木板 (`mat_wood_plank`) + 10 皮革 (`mat_leather`)**。
    - 介面即時顯示現有庫存 `消耗: 20木板 (現有 X) 10皮革 (現有 Y)`，當兩者材料充足時解鎖點擊【🔨 打造新病床】。
  - **驗證**：TypeScript 型別檢查 0 錯誤、單元測試 `ChurchAndPersistentHealth.test.ts` 更新並通過、28 個測試檔案 120 項測試 100% 全部通過。
- **[Refactor/Civic/ChurchTavernLayoutAndCardPatientSelect] 教會醫療所「酒館同款雙欄佈局」重構與「全卡片式病床選人」徹底去下拉選單實裝（2026-08-27）**：
  - **修復鍛造屋與教會 HTML 嵌套錯位 (`views-facility.html`)**：補齊 `#view-forge` 遺漏的閉合標籤 `</div>`，徹底修復「點擊修道院無反應、點隔壁鍛造屋誤入修道院」的嚴重 DOM 錯位 Bug。
  - **零標籤酒館式雙欄介面 (`views-facility.html`, `ChurchModalController.ts`)**：
    - 徹底移除容易造成混亂的 Tab 頁籤切換，改為酒館同款滿版左右雙欄：
    - **左欄 (flex: 1.2)**：領地每日自然恢復率、退休神職被動提示、聖光藥坊熬藥區（直接操作熬製 1 瓶/全部熬製）與打造新病床區。
    - **右欄 (flex: 2)**：上半部展示病床卡片列表（`Flex-wrap`），下半部展示選中操作區。
  - **全卡片式病床選人與急救互動 (`ChurchModalController.ts`)**：
    - 徹底廢除 `<select>` 下拉選單。
    - 點擊空病床時，下方直接列出所有可用傭兵的頭像卡片（`renderAdventurerCard`，受傷/重傷傭兵自動置頂排序），點擊任意卡片立即入住。
    - 選中已入住病床時，即時展示血條百分比、提供【💉 施用藥水急救 (補25% HP)】與【🚪 離床出院】操作。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Civic/ChurchBaseUpgradeAndStreetDragFix] 教會由書房統一建造升級、未建造街道隱藏與街道拖曳滾動修復（2026-08-27）**：
  - **書房統一建造升級 (`SceneController.ts`, `Territory.ts`, `IconSpriteHelper.ts`)**：將【⛪ 教會與醫療所】正式納入領主書房「🏛️ 領地建築升級」清單，支援 Lv.1 建造（150金 40木 20石）至 Lv.4 升級，並提供動態建築名稱與描述。
  - **街道未建造嚴格隱藏 (`SceneController.ts`)**：修正街道建築顯示邏輯為 `(isMyHome && churchLevel > 0)`，未建造時（Lv.0）完全不在街道上顯示，與酒館、鐵匠鋪規則 100% 一致。
  - **街道拖曳與滾動修復 (`main.ts`)**：在系統啟動流程中主動呼叫 `initStreetScroller()`，恢復街道滑鼠橫向拖曳（Grab & Drag）與導航箭頭滑動功能。
  - **傭兵詳情面板血條真實連動 (`PartyModalController.ts`)**：修正詳情面板寫死滿血的歷史遺留邏輯，改為動態讀取 `adv.getCurrentHp()` 與 `adv.getCurrentMp()`，重傷或受傷時真實顯示剩餘血量與百分比。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Civic/ChurchAndPersistentHealthSystem] 傭兵即時持久 HP/MP 體系、重傷瀕死 Debuff、伐木場藥草採集與領地教會醫療所病床急救系統全面實裝（2026-08-27）**：
  - **傭兵持久生命與重傷 Debuff (`Adventurer.ts`, `types.ts`)**：
    - 傭兵資料模型新增 `currentHp` / `currentMp` 持久生命魔力與 `isWounded` 狀態，戰鬥入場以當前持久血量為準，戰後 1:1 寫回。
    - 戰敗或陣亡傭兵鎖定為 1 HP 並賦予【🩸 重傷瀕死】Debuff（全屬性 -20%、速度 -30%），生命值休養或急救至 80% 以上自動痊癒解除。
    - 徹底廢除戰敗鎖定硬 CD（Lockout CD），只要血量健康或備用梯隊齊全隨時可調度出征。
  - **伐木場野生藥草採集 (`TownManagementSystem.ts`)**：
    - 伐木工每日作業時，機率副產野生藥草（`tg_Medicinal_herbs`）存入領地倉庫，完善四大基礎生產設施資源閉環。
  - **教會與醫療所建築體系 (`ChurchSystem.ts`, `Territory.ts`, `ChurchModalController.ts`, `views-facility.html`)**：
    - 支援 5 大階級擴建（Lv.0 10% ➔ Lv.1 祈禱處 15% ➔ Lv.2 禮拜堂 20% ➔ Lv.3 修道院 25% ➔ Lv.4 大教堂 30% 全領地過夜自然恢復率）。
    - 實裝【病床區】：可消耗木材打造病床（Lv.1 4床 ➔ Lv.4 16床），指派傷員入住過夜額外 +10% 回血回魔。
    - 實裝【聖光藥坊】：消耗 50 株藥草熬製 1 瓶【小型生命藥水 (`item_healing_potion_s`)】。
    - 實裝【藥水急救】：病床專屬急救指令，消耗 1 瓶藥水立即恢復 25% MaxHP 與 15% MP（冷卻 4 回合/天）。
    - 實裝【退休神職被動】：每 2 位神職傭兵（祈禱者/神官/牧師/主教）退休，全領地每日恢復 +1%、藥水效果 +1%。
  - **驗證**：TypeScript 型別檢查 0 錯誤、新增專屬測試套件 `ChurchAndPersistentHealth.test.ts`、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Combat/CommanderTacticCdGuard] 親征模式領主軍令 CD 與兵力防呆阻斷全鏈路實裝（2026-08-27）**：
  - **防誤觸阻斷機制 (`CombatUIManager.ts`)**：
    - 在 `handleOrderClick` 前置加入冷卻時間（`cds.SHIELD_WALL`、`cds.VOLLEY_FIRE`、`cds.CAVALRY_CHARGE`、`cds.INSPIRE`）與剩餘兵力校驗。
    - 當玩家誤觸處於 CD 或兵力不足的技能時，即時彈出 Toast 警示並 **100% 絕對阻斷回合推進**，防止因誤觸而白白空過回合，保障戰術決策體驗。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/RaidLifecycleAndOvernightSurvivingWaves] 過夜倒數待決圍城戰役生命週期修復與野外殘存波次殘血 100% 繼承實裝（2026-08-27）**：
  - **待決戰役生命週期修正 (`TownManagementSystem.ts`, `TerritoryDefenseSystem.ts`)**：
    - 修復過夜推進天數時因在開戰前提前執行 `filter(pr => pr.warningDaysLeft > 0)` 導致守城戰初始化找不到 `pendingRaids` 而退回全新生成範本的重大時序漏洞。
    - 改為在守城戰徹底打完並結算（`settleSiegeDefenseResults`）時才清理該戰役，確保野外攔截戰留下的殘存波次與殘血怪物（如打殘的雪怪）100% 完整保留並傳入守城戰舞台。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/BarInternalHpMpOverlay] 戰鬥角色卡片「條內微型 HP/MP 數值疊加 (Bar-Internal Overlay)」與殘血即時渲染實裝（2026-08-27）**：
  - **條內微型數值疊加佈局 (`style.css`, `CombatUIManager.ts`)**：
    - 在完全不額外增加卡片高度、100% 保留肖像視野的前提下，將 HP 與 MP 的即時數值（如 `245/1000` 與 `80/100`）直接疊加置中印在綠色血條與藍色魔力條內部。
    - 採用等寬字體（monospace）搭配 `text-shadow` 黑色文字陰影，無論血條滿綠、半血還是紅血瀕死，數字均 100% 清晰銳利。
  - **傭兵與敵方全體連動 (`InteractiveCombatSession.ts`, `Combat.ts`)**：
    - `CombatParticipantState` 支援 `currentHp` 傳遞；守城戰開局、波次登場（`WAVE_START`）與梯隊登場（`SQUAD_CHANGE`）均精準讀取各怪物與傭兵的真實殘存 HP，血條寬度與數字百分之百即時連動。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeMirrorAndSurvivingWaves] 守城戰敵怪九宮格鏡像站位校正 & 實時親征「波次殘留與殘血 1:1 繼承」全鏈路修復（2026-08-27）**：
  - **守城戰敵怪九宮格鏡像站位校正 (`CombatUIManager.ts`)**：
    - 修正翻轉舞台下敵怪 gridColumn 計算為 `isSiege ? (3 - state.gridR) : (state.gridR + 1)`，徹底解決「前排冰原狼被放到最左側、後排雪怪貼在城門」的反向 Bug；現在前排魔物 100% 緊貼右側要塞城門前線，後排魔物在左側後方壓陣。
  - **實時親征波次狀態與殘血全鏈路繼承 (`InteractiveCombatSession.ts`, `TerritoryDefenseSystem.ts`)**：
    - 補全 `InteractiveCombatSession` 中各波次敵怪的實時陣亡與殘存 HP 追蹤，在 `generateFinalReport()` 中 100% 產出 `survivingWaves`。
    - 守城戰初始化時嚴格排除已陣亡怪物（`isDead` / `hp <= 0`）與已全滅波次，殘留怪物（如野外打殘的雪怪）100% 繼承殘血（`currentHp: s.currentHp`），不再被強制洗成滿血。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeGateHpLiveSync] 實時親征模式城門耐久度血條與數字即時更新全鏈路修復（2026-08-27）**：
  - **雙軌狀態相容修正 (`CombatUIManager.ts`)**：
    - 修復事件渲染中因僅檢測 `currentReport.gateMaxHp` 導致實時親征 `currentSession` 期間跳過血條數值更新的問題；現在統一相容 `this.currentSession?.gateMaxHp || this.currentReport?.gateMaxHp`，每當敵怪撞擊城門時，中央底部數字（如 `4989 / 5000`）與綠色進度條百分比 100% 即時扣除並觸發浮動受擊特效。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/MonsterAttackType] 怪物攻擊類型 (AttackType: MELEE/RANGED/MAGIC) 標準化擴充、怪物工坊升級與守城戰 100% 絕對阻隔實裝（2026-08-27）**：
  - **怪物資料模型與實體庫標準化 (`types.ts`, `monsters.json`, `MonsterSystem.ts`)**：
    - 定義 `AttackType = 'MELEE' | 'RANGED' | 'MAGIC'`，並為全資料庫 70 種怪物實裝明確的攻擊類型（弩手為 `RANGED`，法術怪/幽魂/薩滿為 `MAGIC`，野狼/哥布林/巨魔等 65 種為 `MELEE`）。
  - **戰鬥工坊 (Combat Studio) 升級 (`combat-studio.html`, `CombatStudio.ts`)**：
    - 升級怪物創造表單中的「攻擊距離與類型」下拉選單（`MELEE` 物理近戰 / `RANGED` 遠程物理 / `MAGIC` 遠程魔法），儲存與載入 100% 雙向對齊。
  - **戰鬥引擎守城戰絕對阻隔 (`InteractiveCombatSession.ts`, `CombatSystem.ts`)**：
    - 🛡️ **近戰 100% 絕對受阻**：在守城戰且城門耐久 $> 0$ 時，若我方前排無人，`attackType === 'MELEE'` 的魔物（野狼、哥布林）100% 絕對無法攻擊中後排（艾蓮娜），傷害全部轉化為對城門耐久度的撞擊！
    - 🏹 **遠程/魔法越牆減傷**：只有 `RANGED` 或 `MAGIC` 可隔牆攻擊中後排，並套用 25% 城垛掩體傷害減免。
  - **規範同步**：同步更新 `docs/MONSTERS_AND_ELEMENTS.md` 規範文檔。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/LayoutOptimization] 戰鬥框頂部全寬光環 Header Bar & 舞台正中底部城門 HUD 完美佈局實裝（2026-08-27）**：
  - **頂部領主親征光環 Header Bar (`modals-combat-trade.html`, `CombatUIManager.ts`)**：
    - 將光環移出舞台內部，於 Modal 最頂部建立全寬獨立橫條 `#combat-lord-aura-bar`，完整展示光環全名與所有屬性增益，字體清晰且 100% 徹底消除對戰場頂部人物卡牌的遮擋。
  - **城牆耐久度 HUD 移至舞台正中底部 (`modals-combat-trade.html`, `CombatUIManager.ts`)**：
    - 將 `#combat-siege-gate-hud` 移至中央城牆屏障底部、領主軍令【🐎 破陣衝鋒】正上方，與戰場正中央的要塞城門自然咬合，視覺層級井然有序。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/FortressGateBarrier & MeleeBlock] 守城戰中央實體要塞城門屏障、頂部防遮擋 HUD 重構與「近戰受城門阻隔無法攻擊後排」核心法則實裝（2026-08-27）**：
  - **戰場中央實體要塞城垛與城門屏障 (`modals-combat-trade.html`, `style.css`, `CombatUIManager.ts`)**：
    - 在戰鬥舞台正中央加入實體 `.combat-siege-wall-divider`（石砌要塞垛口與城門圖標），清晰劃分「城外攻城區」與「城內守軍區」；城門受擊時觸發即時劇烈震動與受擊動畫 (`wall-hit`)。
    - **頂部 HUD 防遮擋重構**：領主光環徽章收斂至左上方獨立區域，中央頂部專屬預留給「🏰 領地城牆耐久度 HUD」，並提升層級至 `z-index: 25`，解決重疊被遮擋問題。
  - **守城戰近戰城牆阻隔法則與城垛掩體減傷 (`InteractiveCombatSession.ts`)**：
    - 🛡️ **無前排守軍時**：只要城門耐久度 > 0，敵方近戰單位（如哥布林）**100% 被城牆阻隔，絕對無法穿透攻擊中後排守軍**，所有物理近戰攻擊強制轉化為對城門耐久度的撞擊打擊（`SIEGE_GATE_DAMAGE`）。
    - 🏹 **遠程/法術攻擊**：可越過城牆攻擊中後排，但我方守軍享有 **25% 城垛掩體傷害減免**。
    - 💥 **城門攻破後**：觸發 `SIEGE_GATE_BREAK`，城門崩塌後敵軍近戰方可自由攻擊中後排！
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeDefenseVisuals] 領主親征「誓死守城戰」實體城牆耐久血條 HUD、要塞城垛背景、鏡像防禦站位與箭塔砲擊支援全鏈路修復（2026-08-27）**：
  - **親征守城戰專屬要塞視覺與實體城牆 HUD (`CombatUIManager.ts`)**：
    - 封裝 `setupStageEnvironment` 統一管理守城與野外場景渲染；當觸發正規守城戰時，實時親征模式與靜態回放模式 100% 完整掛載中央頂部的 **「🏰 領地城牆耐久度 HUD (Gate Durability)」** 與 **要塞城垛背景 (`.is-defense-siege`)**。
  - **守城戰正統鏡像防禦站位修復 (`CombatUIManager.ts`)**：
    - 新增 `isCurrentDefenseSiege()` 智能雙向檢測（相容 `currentReport` 與 `currentSession`），守城方在左側時前排單位緊靠右側中央城門前線（`gridColumn = gridR + 1`），後排在左側，敵怪由右側向左攻門，100% 恢復昨日正統鏡像戰術站位。
  - **親征守城戰邏輯對齊 (`InteractiveCombatSession.ts`)**：
    - 實裝哨所箭塔每回合支援砲擊（`CombatEventType.WATCHTOWER_ATTACK`）與敵怪近戰轟擊城門耐久度（`SIEGE_GATE_DAMAGE` / `SIEGE_GATE_BREAK`），完整回傳並結算領地城牆殘存耐久。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/ButtonsAndIcons] 戰鬥結算切換與瞬間完成按鈕 ID 綁定校正 & 親征怪物高清立繪修復（2026-08-27）**：
  - **戰鬥結算與按鈕操作修復 (`CombatUIManager.ts`)**：
    - 校正 `btn-combat-skip`、`btn-combat-close`、`btn-combat-result-close` 的 DOM ID 查詢，消除因 ID 前後綴不符導致的事件綁定失敗。
    - 在 `finishPlayback` 加入安全保護，保證戰鬥播完或點擊「⏩ 瞬間完成」時，100% 順暢切換出「完成」按鈕與結算面板，徹底解決卡在最後一幀不結束的問題。
  - **親征怪物專屬立繪修復 (`InteractiveCombatSession.ts`)**：
    - 補全實時親征會話中敵方隊伍與 `WAVE_START` 波次事件的 `avatarIcon`（如 `icons_monsters:goblin`）傳遞，徹底告別 fallback 紙箱圖標，恢復寫實魔物立繪。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/Sandbox/Lifecycle] 故事測試沙盒全域生命週期對齊與戰鬥中樞自動防呆 (`CombatUIManager.ensureInit`) 實裝（2026-08-27）**：
  - **故事測試沙盒環境 100% 完整對齊正式遊戲 (`main.ts`)**：
    - 消除故事測試沙盒跳過全域 UI 初始化 (`refreshGlobalUI()`) 的架構缺陷；調整啟動生命週期為「完整註冊 Templates 與全域 UI 模組 ➔ 再掛載故事測試控制器」，保證故事測試沙盒在戰鬥引擎、城防體系、日誌與回放上 100% 與正式遊戲同源共軌。
  - **戰鬥 UI 自動防呆初始化 (`CombatUIManager.ts`)**：
    - 實裝 `ensureInit()` 機制，在 `startInteractiveCombat`、`replayCombat`、`showCombat` 入口處全面主動檢測並安全綁定 DOM 節點。
    - 在 `createHpBar` 與 `showCombat` 加入卡片容器存在性保護與 `initialStates` 容錯，徹底解決探險日誌「⚔️ 戰鬥紀錄」在特定邊界條件下黑屏無法播放的問題。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/InteractiveCombatSession] 領主親征「實時單回合步進演算架構 (Interactive Combat Session)」與常規派遣雙軌隔離實裝（2026-08-27）**：
  - **核心雙軌架構隔離 (Dual-Track Architecture Separation)**：
    - 🛡️ **軌道 A（常規派遣／討伐／跑商／派遣迎擊）**：呼叫 `CombatSystem.simulateCombat` 進行批次演算，前端呼叫 `CombatUIManager.replayCombat(report)`，保留「⏩ 瞬間完成」按鈕與隨行部隊支援，不受手動干涉影響。
    - 👑 **軌道 B（領主親征戰役：親自出城攔截／誓死守城）**：建立 `new InteractiveCombatSession(...)`，前端呼叫 `CombatUIManager.startInteractiveCombat(session, onClose)`。
  - **實時步進演算與狀態鎖定機制 (`InteractiveCombatSession.ts` & `CombatUIManager.ts`)**：
    - 🔒 **禁瞬間完成**：親征模式下隱藏「⏩ 瞬間完成」按鈕，每回合實時步進運算。
    - 🛑 **交鋒防干涉鎖定**：每回合開始時戰場暫停，解鎖指揮列；玩家點擊任一軍令（盾牆/箭雨/衝鋒/鼓舞/待命）後，**按鈕立即反灰鎖定（`disabled`）**，執行 `session.stepTurn(order)` 並播放該回合動畫。
    - ⏳ **精準 CD 扣除**：回合結束後才將技能 CD 遞減 1，戰鬥未結束時重新解鎖按鈕等待下回合決策；支援「🤖 自動戰鬥 (Auto)」與「1x/2x/3x 速度」。
    - 🎯 **單一指令結算**：玩家選擇點擊的軍令立即作用於戰場，絕不自動混發其他未選指令。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/LordCommander] 領主親征軍令中樞系統 (Turn-based Commander Loop) 與隨行部隊身分隔離（2026-08-27）**：
  - **領主親征 vs 委託派遣身分邊界與兵力精確校正 (`CombatSystem.ts`, `TerritoryDefenseSystem.ts`)**：
    - 👑 **領主親征**：標示為 `【👑 領主軍令·XXX】`，啟動光環與手動指揮 HUD。
    - 🛡️ **委託派遣**：完全移除「領主軍令」與光環，回歸隨行部隊支援（`【🛡️ 隨行軍團·步兵護盾】`、`【🏹 隨行軍團·箭雨支援】`、`【🐎 隨行軍團·側翼衝擊】`），自動由小隊長作戰。
    - 🏹 **弓兵人數與傷害修復**：修正日誌傷害被怪物殘存血量截斷問題，完整顯示打擊威力（如 782 點）；兵種調派人數（500人）100% 傳遞至戰報與指揮列。
- **[Feature/CombatStudio/DragDrop/Fix] 討伐據點 3×3 戰術九宮格全方位拖曳布陣 (Drag & Drop) 與波次座標自動防撞互換機制實裝（2026-08-27）**：
  - **根本解決舊資料座標重疊覆蓋 Bug (`CombatStudio.ts`)**：
    - 舊版資料升級 3×3 九宮格時使用 `c = mIdx % 3` 導致前排超過 3 隻怪物時座標循環撞車（出現多個 `0_0`、`0_1` 且九宮格互相覆蓋吞噬）。
    - 實裝 `normalizeStrongholdWaves()` 正規化防撞引擎，在載入與渲染時自動檢測波次 slot 衝突，為重複或無效怪物依序分配未佔用空位（前 ➔ 中 ➔ 後），保證 1~9 隻怪物 100% 獨立不重疊。
  - **3×3 戰術九宮格全方位拖曳布陣 (Drag & Drop) (`CombatStudio.ts`)**：
    - 九宮格怪物卡片支援原創滑鼠拖曳：
      - **拖曳至空槽位**：直接移動怪物至目標格子，即時更新 `slotId`, `gridR`, `gridC`, `formationRow`。
      - **拖曳至已有怪物槽位**：兩隻怪物 **1:1 雙向互換位置 (Swap Slots)**。
    - 右側怪物卡片清單同樣支援直接拖入左側九宮格指定槽位。
    - 拖曳懸浮時目標槽位呈現金光高亮（`border: 2px dashed #f59e0b`、光暈縮放反饋）。
  - **「⚙️ 配置」彈窗防呆互換 (`CombatStudio.ts`)**：
    - 手動切換站位時，若目標槽位已被同波次其他怪物佔用，自動將對方互換回當前怪物原有的舊槽位，徹底告別手動撞車。
  - **資料庫批次清理 ([src/data/subjugation_nodes.json](file:///d:/tryagent/Medieval/src/data/subjugation_nodes.json))**：
    - 校正走私者關卡（薩滿移至中排 `1_1`）與霜風王陵（第 4、5 隻霜狼與雪怪移至中排 `1_0`, `1_1`）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 107 項單元測試（包含全新 `normalizeStrongholdWaves` 自動排他測試）100% PASS。
- **[Feature/Combat/FieldInterception/Territory] 野外大軍攔截戰 (Field Interception) 全鏈路實裝：動員部署三大決策、短天數交兵公式、戰況狀態 1:1 繼承與大地圖受攻動態視覺特效（2026-08-26）**：
  - **領地動員部署彈窗升級 (`TerritoryDefenseModalController.ts` & `modals-combat-trade.html`)**：
    - 當故事事件觸發 `TRIGGER_RAID` 且 `warningDays > 0` 時，自動切換為「⚠️ 敵軍逼近預警」模式，提供 3 大戰略決策按鈕：
      1. **【⚔️ 親自出城攔截 (野戰)】**：載入野外遭遇戰舞台，無城牆掩體，常規左右站位，支援軍團調派。
      2. **【🛡️ 派遣軍團迎擊 (自動作戰)】**：以短天數交兵並在探索/領地日誌自動背景模擬結算。
      3. **【🏰 堅壁清野 (等待守城)】**：進入臨戰戒備，大地圖主城標記雙劍交鋒標籤，預警天數耗盡兵臨城下開打守城戰。
    - 當天數歸零時自動轉為正規守城戰模式（【放棄抵抗】 / 【⚔️ 誓死守城】）。
  - **嚴謹的時間線計算公式 (`TerritoryDefenseSystem.ts`)**：
    - 交兵天數 $T_{\text{battle}} = \min(T_{\text{enemy}}, T_{\text{march}})$（以短天數一方為主）。
    - 野戰失利後敵軍抵達天數 $T_{\text{remain}} = \max(1, T_{\text{enemy}} - T_{\text{battle}})$。
  - **戰況狀態 1:1 繼承 (Battle State Continuity) (`TerritoryDefenseSystem.ts` & `CombatSystem.ts`)**：
    - 野外攔截戰若未全殲敵軍（或戰敗/撤退），被擊殺的魔物標記死亡、殘血怪物的 HP 與剩餘敵方軍團兵力 100% 持久化存入 `pendingRaid`。
    - 數天後敵軍兵臨城下守城戰時，1:1 載入這支已被打殘的敵軍陣容，死亡怪不再登場，殘血怪保留殘血，讓出城攔截具有實質戰略削弱價值！
  - **據點工坊隨行敵方軍團 (Enemy Legion) (`CombatStudio.ts` & `combat-studio.html` & `Narrative.ts`)**：
    - 據點工坊新增「🛡️ 啟用隨行敵方軍團」勾選框與敵方步兵、弓兵、騎兵數量配置。
    - 戰鬥引擎支援敵方隨行軍團每 2 回合發動【🏹 漫天箭雨】齊射與每 3 回合發動【🐎 重騎衝鋒】。
  - **大地圖主城受攻雙劍動畫特效 (`MapScene.ts`)**：
    - 當領地存在未解決的 `pendingRaids` 預警戰役時，主城上方渲染跳動的「⚔️ 雙劍交鋒標記」與「⚠️ 敵軍逼近 (N天)」警示標籤。
  - **出城迎擊狀態鎖定與彈窗生命週期修復 (`TerritoryDefenseModalController.ts` & `TerritoryDefenseSystem.ts`)**：
    - 修復野外攔截戰鬥結算後彈窗重複顯示的問題；當部隊已出城迎擊過一次後（`isFieldInterceptionAttempted = true`），自動隱藏出城迎擊按鈕，切換為「🏰 領地臨戰戒備（敵軍殘部進逼中）」提示，並在戰報關閉時 100% 關閉動員彈窗，回歸大地圖臨戰戒備倒數。
  - **日結算預警推進 (`TownManagementSystem.ts`)**：
    - 每日結算推進 `warningDaysLeft -= 1`，當天數耗盡時自動無縫喚起正規守城動員部署。
  - **派遣迎擊探索日誌 (AdventureLogEntry) 標準結構與戰鬥重播實裝 (`TerritoryDefenseSystem.ts`)**：
    - 徹底修復派遣迎擊自動結算時寫入非標準結構導致探索日誌顯示「以 undefined 為首的隊伍 / 探索了 undefined / 內文空白」的 Bug。
    - 現在如實組裝 `squadLeaderName`（出征隊長）、`nodeName`（`🌲 野外迎擊 (戰役名稱)`）、`segments`（出征集結、激戰過程、戰損結算與戰況實況段落），並將戰報寫入 `territory.addCombatRecord` 同步在日誌內文插入 **【⚔️ 戰鬥紀錄】** 重播按鈕，點擊可 100% 觀看完整戰鬥重播！
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 106 項單元測試 100% 全部通過。
- **[Feature/StoryStudio/Sync] 故事工坊「🔄 從專案重載 (Git 同步)」與草稿智慧檢測機制實裝（2026-08-26）**：
  - **跨電腦 Git 同步快取解鎖 (`StoryStudio.ts`, `story-editor.html`)**：
    - 頂部操作列新增醒目的「🔄 從專案重載 (Git 同步)」按鈕，點擊即可一鍵清空本機殘留的過期草稿，100% 還原 Git Pull 的專案實體最新故事檔案。
    - 新增「📝 偵測到本機暫存草稿」智慧提示條（Banner），主動提醒使用者當前內容來自本地暫存，並提供一鍵載入專案最新版。
- **[Bugfix/Studio/Stronghold] 據點設計工坊自訂據點載入與儲存覆蓋 Bug 修復（2026-08-26）**：
  - **修復原因**：先前 `CombatStudio.ts` 的 `loadStrongholds()` 每次載入時未先檢查 `localStorage`，直接重置為原生 JSON 檔並寫入儲存，導致使用者在戰鬥工坊自訂的新據點（如「充滿龍晶的洞穴深處」）被覆蓋丟失，故事工坊因而只能回退至預設據點。
  - **修復方案**：`loadStrongholds()` 設為最高優先級讀取 `localStorage` (`MEDIEVAL_CUSTOM_STRONGHOLDS_V2`)，確保自訂據點持久化安全且在故事工坊與戰鬥系統中 100% 同步可用。
- **[Feature/Combat/Studio] 怪物 3×3 九宮格陣型體系與據點波次解包全面修復（2026-08-26）**：
  - **據點多波次解包修復 (`TerritoryDefenseSystem.ts`)**：徹底修復據點模板的多波次怪獸（如 Wave 1 毒蜥、Wave 2 太古黑龍）被錯誤合併為單一波次的 Bug，現在 1:1 如實平鋪獨立展開為多波次戰鬥。
  - **怪物 3×3 九宮格資料模型 (`Narrative.ts`, `types.ts`, `Combat.ts`)**：`SubjugationWaveMonster` 與 `MonsterInstance` 全面支援 `gridR` (前中後排 0~2)、`gridC` (上中下路 0~2) 與 `slotId` (如 `"0_1"`, `"1_1"`)。
  - **據點設計工坊 3×3 視覺化戰術九宮格 (`CombatStudio.ts` & `combat-studio.html`)**：
    - 據點波次編輯器升級為雙欄佈局：左側 3×3 敵軍戰術九宮格（橫向前中後、縱向上中下），右側怪物詳細設定清單。
    - 支援點擊九宮格空位直接彈出怪物庫選用，並精確指派坐標；支援拖曳/點擊快速配置與移除；怪物配置彈窗提供 9 個九宮格站位下拉選單。
  - **戰鬥舞台 1:1 精確映射 (`CombatSystem.ts` & `CombatUIManager.ts`)**：戰鬥引擎與 CSS Grid 優先讀取怪物自訂 `gridR` 與 `gridC`，在戰鬥畫面如實還原敵軍站位與前後排層次。
  - **驗證**：TypeScript 編譯檢查 0 錯誤、25 個測試檔案 104 項單元測試 100% PASS。
- **[Feature/Combat/Siege/Territory] 領地守城戰與城防體系深度完善：城牆耐久條與修繕升級限制、民兵戰損與遭遇戰人口波及、攻守目標深度重構、動員記憶與專屬防衛戰報（2026-08-26）**：
  - **守城戰進攻方頭像朝向修復 (`style.css`)**：精確只對 `.combat-p-avatar-sq`（單純頭像圖片）施加水平鏡像翻轉，使左側進攻方魔物正面朝向右側城門衝鋒，名稱、血條、狀態等文字標籤保持 100% 正向無鏡像。
  - **全技能軍團步兵護盾攔截機制 (`CombatSystem.ts`)**：徹底修復敵方範圍/魔法/單體技能攻擊繞過步兵護盾直接秒殺肉體的問題。現在所有技能傷害優先由步兵護盾吸收並輸出 `🛡️ 部隊護盾吸收了 XXX 點傷害`，破盾後溢出傷害才扣減 HP。
  - **騎兵衝鋒與弓兵齊射傷害曲線平滑化與 BOSS 抗性 (`CombatSystem.ts` & `TerritoryDefenseModalController.ts`)**：
    - 廢除純線性無上限倍率，改採平方根平滑曲線（弓兵 $\lfloor \sqrt{\text{count}} \times 35 \rfloor$、騎兵 $\lfloor \sqrt{\text{count}} \times 28 \rfloor$），防止數百民兵一擊秒殺 BOSS。
    - 首領/BOSS 級魔物（如太古黑龍）免疫直接暈眩，轉化為「受到重裝衝擊，攻擊力降低 20%（持續 2 回合）」。
  - **城牆耐久度持久化與書房修繕面板 (`Territory.ts` & `SceneController.ts`)**：
    - 全域正名為「城牆耐久度 (Wall Durability)」，戰後耐久度不再自動回滿，實時寫入 `territory.wallDurability` 持久化儲存。
    - 書房建築面板城牆卡片新增高質感**「耐久度進度條 (Durability Bar)」**與數值標籤（如 `耐久度: 3,500 / 5,000`）。
    - 依缺損比例分配金幣、木材、石材消耗，提供「🔨 修繕城牆」按鈕；**耐久度未達 100% 滿值時，升級按鈕自動反灰並提示「需先修繕滿耐久度」**。
    - 城門徹底被攻破時，城牆降級為 **Lv.1** 且耐久度為 **0**（需重新修繕方可恢復）。
  - **調派民兵戰損與遭遇戰人口波及 (`TerritoryDefenseSystem.ts`)**：
    - **步兵**：戰後依剩餘護盾生還人數換算（$\lfloor \text{剩餘護盾} / 50 \rfloor$），陣亡者直接扣減領地 `workers['INFANTRY']`。
    - **弓兵與騎兵**：守城戰勝亦有合理戰損（弓兵 5%~10%、騎兵 10%~15%），城破時戰損加重至 25%~40%，直接從領地部隊扣除。
    - **遭遇戰 (`isSiege: false`)**：戰勝波及 1~3 位村民，戰敗遭強盜劫掠損失 15% 人口。
  - **守城戰鬥目標判定深度重構 (`CombatSystem.ts`)**：
    - **前排單位**：敵軍近戰可直接攻擊我方前排守軍，前排分擔城門防禦壓力。
    - **中後排單位**：只要前排仍有存活守軍或城牆耐久 > 0，敵軍近戰物理攻擊無法近身打擊中後排；只有在前排全滅且城牆耐久歸 0（破城）後，敵軍湧入城內，近戰才可直接攻擊中後排。
    - **遠程 / 魔法 / 貫穿**：可越過城牆打擊中後排，守軍享受 25% 城垛掩體傷害減免。
  - **守備動員編制自動記憶與「⚡ 智慧自動填補」(`TerritoryDefenseModalController.ts`)**：
    - 自動記憶上次出戰的 3 梯隊陣容、陣型與 3×3 九宮格。
    - 提供「⚡ 智慧自動填補」按鈕，一鍵挑選留守領地且戰力最高的冒險者填補空缺。
  - **專屬【🏰 領地防衛戰報 (Siege Debrief)】彈窗 (`CombatUIManager.ts` & `modals-combat-trade.html`)**：
    - 戰鬥結束後彈出黑金戰報，清晰交代城牆受損、民兵傷亡撫恤、物資治安變更與守城 MVP，點擊後順暢銜接後續劇情。
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 104 項單元測試 100% PASS。
- **[Feature/UI/Siege] 守備動員支援自訂兵力調派與故事工房攻城戰屬性開關（2026-08-26）**：
  - **守備動員自訂兵力調派 (`TerritoryDefenseModalController.ts` + `modals-combat-trade.html`)**：玩家可自由調整步兵、弓兵、騎兵的出動人數（上限為領地工人總數，提供全出戰/歸零快捷按鈕），即時預覽護盾、箭雨與衝鋒傷害。
  - **故事工房戰役屬性開關 (`StoryStudioForm.ts` + `Narrative.ts`)**：`TRIGGER_RAID` 效果新增 `isSiege` 勾選框。勾選為正規攻城戰（享城牆、箭塔、軍隊調派支援）；取消勾選為街巷／室內突襲遭遇戰（無城防與兵種支援，由傭兵守軍直接迎敵）。
  - **動員編制介面適配**：根據 `isSiege` 動態切換標題、隱藏/顯示城門耐久與箭塔情報，並在遭遇戰模式下切換兵種面板為「街巷突襲遭遇戰」警示。
  - **驗證**：`npx tsc --noEmit` 0 錯誤。
- **[Balance/UI/Siege] 城牆生命值階梯重新配置與建築體系對齊（2026-08-26）**：
  - **城牆 HP 等級階梯配置 (`TerritoryDefenseSystem.ts`)**：LV0=0（無防禦直接迎敵）, LV1=1,000, LV2=2,500, LV3=5,000, LV4=7,000, LV5=9,000。
  - **防衛建築正名為「城牆」(`SceneController.ts` + `FEUDAL_AND_TERRITORY_SYSTEM.md`)**：Lv.1 木造城牆、Lv.2 夯土城牆、Lv.3 石造城牆、Lv.4 重裝要塞城牆、Lv.5 鋼石要塞城牆。
  - **守城動員彈窗數值預覽修正 (`TerritoryDefenseModalController.ts`)**：同步更新弓兵齊射預覽 (`count × 3`) 與騎兵衝鋒傷害預覽 (`count × 2`)。
  - **驗證**：`npx tsc --noEmit` 0 錯誤。
- **[Bugfix/Combat/Siege] 守城戰 5 大 Bug 全面修復（2026-08-26）**：
  - **Bug1 文字鏡像修復 (`style.css`)**：移除 `scaleX(-1)` 對整個角色卡片的翻轉，改為只對 `.combat-p-avatar-sq` 頭像圖片做鏡像，名稱/標籤文字不再反向。
  - **Bug3 城門不擋技能修復 (`CombatSystem.ts`)**：城門現在也攔截敵方技能攻擊（以 `atk * 0.7` 估算技能攻城傷害），城門真正作為第一道屏障。城門基礎 HP 從 500 提升至 2000，+2500/級（`TerritoryDefenseSystem.ts`）。
  - **Bug4 護盾公式統一修復 (`CombatSystem.ts` + `TerritoryDefenseSystem.ts`)**：步兵護盾值統一為 `count × 50`（原本 CombatSystem 誤用 `×10`，與 UI 預覽差 5 倍）；步兵護盾不再只分配給第一人，改為平均分配給所有守軍；弓兵齊射 (`archerVolleyDmg`) 與騎兵減速 (`cavalrySlowPct`) 正式接入 CombatSystem 實際生效。
  - **Bug5 梯隊技能空白修復 (`CombatSystem.ts`)**：第 2/3 梯隊登場的傭兵不再以 `skills: []` 空技能上陣，改用完整的職業/裝備技能推導邏輯，元素屬性 (atkElement/defElement) 也正確繼承。
  - **Bug6 梯隊接力邏輯重構 (`CombatSystem.ts`)**：原本 `continue` 誤跳到下一個敵方波次（跳過殘血敵A直接打全血敵B），重構為 while 內部檢測：我方梯隊全滅後載入下一梯隊，繼續在**同一波次**接戰殘血敵軍，實現「殘血敵A→我軍B接戰→殘血敵A死→敵B打殘血我軍B」的正確連鎖邏輯。`SQUAD_CHANGE` 事件附帶 `newSquadStates` 供 `CombatUIManager` 即時重繪玩家面板。
  - **驗證**：`npx tsc --noEmit` 0 錯誤。
- **[Feature/Combat/Siege] 守城戰役全鏈路深度升級：正統卡牌池、3 梯隊車輪增援接力、城門實體物理抵擋與每回合箭塔開砲（2026-08-26）**：
  - **左側可選名冊卡牌池 (`TerritoryDefenseModalController.ts`)**：100% 採用 `renderAdventurerCard(adv)` 正統卡牌（滿版肖像、SSR/SR 金紫品質邊框、職業等級與懸浮 Tooltip），與右側九宮格完全一致。
  - **多梯隊車輪戰役接力 (`CombatSystem.ts`)**：當第 1 梯隊全員戰敗時，自動觸發 `SQUAD_CHANGE` 讓第 2 梯隊 (主力) 與第 3 梯隊 (城門衛隊) 滿狀態接力上陣作戰。
  - **城門實體物理阻擋與城垛減傷 (`CombatSystem.ts`)**：城門未破前強制替守軍吸收所有近戰物理攻城打擊；全體守軍常駐 25% 城垛掩體減傷；哨所箭塔每回合主動向敵軍發動重弩砲擊。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/UI/Siege] 守城動員部署全面升級：討伐同款黑金玻璃雙欄、3×3 鏡像九宮格與實體城門血條 HUD（2026-08-26）**：
  - **討伐同款雙欄動員介面 (`TerritoryDefenseModalController.ts`)**：左側可選傭兵名冊卡牌池（支援點擊/拖曳入隊）與步/弓/騎兵種調派；右側 3 梯隊獨立切換頁籤與陣型選擇（連動 `FormationDB`）。
  - **3×3 鏡像戰術棋盤**：橫向排列為【前排 (迎敵第一線)】 ➔ 【中排】 ➔ 【後排 (靠城門)】，角色坐標精準映射至戰鬥舞台，徹底告別角色重疊問題。
  - **戰鬥畫面實體城門 HUD (`CombatUIManager.ts`)**：戰鬥舞台中央常駐【🏰 領地要塞城門】與 Gate HP 耐久血條，即時呈現攻方物理打擊扣血、受擊震動與城門碎裂動畫。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/UI/Siege] 主城守備動員部署彈窗 (`TerritoryDefenseModalController`) 全面實裝（2026-08-26）**：
  - **守備動員部署視窗 (`modal-territory-defense`)**：攻城戰役觸發時不再直接開打，而是先彈出動員部署彈窗。
  - **守軍多梯隊編組**：支援編排 3 支守軍梯隊（第一先鋒隊、第二主力隊、第三城門衛隊）。
  - **城防情報與兵力預覽**：展示城門耐久 (Gate HP)、箭塔攻擊力、城垛掩體減傷，並動態預覽步兵軍團護盾值、弓兵箭雨火力與騎兵削速趴數。
  - **作戰決策**：支援「⚔️ 誓死守城 (進入戰鬥)」與「放棄抵抗 (任由掠奪)」。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Combat/Siege] 領地守城戰役 (TRIGGER_RAID) 即時戰鬥與鏡像視窗全鏈路實裝（2026-08-26）**：
  - **即時守城戰鬥排程 (`TerritoryDefenseSystem.startLiveSiegeDefense`)**：徹底取代舊有純數值計算，依據故事工房配置的多梯隊據點敵軍陣容實體化怪物，提取留守領地守軍與步兵軍團護盾，呼叫 `CombatSystem.simulateCombat`。
  - **鏡像戰鬥全螢幕視窗彈出 (`CombatUIManager.replayCombat`)**：自動切換至 `.is-defense-siege` 鏡像佈局，展示城門受損、箭塔射擊、弓兵箭雨與步兵生還結算。
  - **戰後勝負劇情跳轉**：戰鬥結束（玩家關閉戰鬥彈窗時）自動觸發 `successNodeId` 或 `failNodeId` 故事節點跳轉。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Tool/NarrativeTest] 故事測試面板全面升級：支援最小化收合、自由拖曳移動與完整 advanceDay 每日推演（2026-08-26）**：
  - **解決遮擋問題**：面板加入「➖ 收合 / ➕ 展開」切換按鈕，最小化後僅剩頂部小膠囊（38px高），完全不遮擋遊戲 HUD 與「結束本日」按鈕；支援滑鼠按住標題列自由拖曳至螢幕任意位置。
  - **完善推進天數功能 (`advanceDay`)**：重構「推進 1 天 / 5 天」邏輯，完整呼叫 `advanceDay()` 執行全套遊戲日常迴圈（日曆換算、產能、派遣、探險、事件檢查與劇情日常推演）。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Story/Siege] 故事工房「領地攻城/襲擊戰役 (TRIGGER_RAID) 動態梯隊與據點卡片挑選器」全面實裝（2026-08-26）**：
  - **資料結構全面重構 (`Narrative.ts` & `StoryStudioTypes.ts`)**：廢除舊有的純數值比大小，升級為包含戰役名稱 (`raidName`)、預警行軍天數 (`warningDays`)、動態攻城梯隊陣列 (`waves: SiegeWaveConfig[]`) 與勝負分支跳轉節點 (`successNodeId`/`failNodeId`)。
  - **據點卡片挑選器 Modal (`StoryStudioSubjugationPicker.ts`)**：支援搜尋、地形與難度篩選，卡片展示地形圖標、名稱、ID、難度星級與敵軍怪物 Sprite 頭像，點擊一鍵回填。
  - **故事工房表單升級 (`StoryStudioForm.ts`)**：提供「➕ 新增梯隊」、各梯隊獨立據點卡片預覽、「🔍 挑選據點」與「✕ 移除」按鈕。
  - **戰鬥與城防核心支援 (`Combat.ts`, `CombatUIManager.ts`, `TerritoryDefenseSystem.ts`, `style.css`)**：實裝鏡像戰鬥舞台樣式 (`.is-defense-siege`)、城門耐久、箭塔支援、步兵軍團護盾、弓兵箭雨與騎兵衝鋒事件模型。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/UI/Equipment] 遊戲內裝備 Tooltip 全面升級：完整展示特技圖標、MP/CD消耗與技能效果描述（2026-08-26）**：
  - **全場景 Tooltip 支援 (`ShopController.ts`)**：全遊戲所有檢視裝備介面（商店貨架、傭兵隊伍面板、倉庫/背包、鐵匠鋪鍛造/強化/拆解/改裝、二手商店等）的懸浮 Tooltip 均已全面升級。
  - **技能資訊完整呈現**：
    - 支援使用 `renderUniversalIcon` 渲染自訂 Sprite 或 Emoji 技能圖標。
    - 顯示技能名稱、MP 消耗與冷卻 CD 標籤。
    - 完整呈現技能詳細效果說明（例如「對敵方單體造成 180% 物理傷害」或「受擊時獲得護盾」）。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Fix/Tool/SkillWorkshop] 修復技能工坊圖標挑選器 Sprite 索引映射 Bug（2026-08-26）**：
  - **Bug 原因**：在遍歷 `custom_icon_datasets.json` 的 `items` 陣列時，原代碼誤將陣列索引作為 `itemId` 傳入（產生如 `icons_materials:0`），導致 `renderUniversalIcon` 無法查找到圖標定義而全部回退為第一格麥穗圖案。
  - **修復**：修正為直接提取 `item.id`（產生如 `icons_materials:icons_materials_0`），使 64 款素材圖標與全圖庫 Sprite 均能精準定位並顯示正確圖形。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Tool/Equipment] 裝備工坊自訂「適用職業限制（全職業通用 / 6大職業自選）」實裝（2026-08-26）**：
  - **裝備工坊自訂適用職業 (`EquipmentStudio.ts` & `equipment-studio.html`)**：
    - 在裝備編輯彈窗中新增「👤 適用穿戴職業 (Allowed Jobs)」區塊，支援「☑️ 全職業通用 (無限制)」一鍵全選，以及戰士、法師、弓箭手、騎士、盜賊、祈禱者 6 大職業獨立勾選。
    - 提供「🔄 帶入武器預設」按鈕，快速載入該武器類型的標準職業限制。
  - **開局【破敗的傳家寶劍】全職業通用化 (`equipment_weapons.json` & `DataStore.ts`)**：
    - 將 `wpn_heirloom_sword` 的 `allowedJobs` 設定為包含全部 6 大職業，確保開局不論選擇何種職業的誓約守衛皆可直接手持裝備！
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Combat/Equipment] 武器固定本命特技 + 自由隨機技能抽取池與機率抽取系統實裝（2026-08-26）**：
  - **隨機技能抽取生成引擎 (`EquipmentGenerator.ts` & `types.ts`)**：
    - 裝備原型全面支援 `fixedSkill`（100% 必定附加之本命特技）與 `skillPool`（候選技能抽取池）。
    - 支援自訂 **抽取機率 % (`skillRollChance`)** 與 **抽取數量 (`skillRollCount`)**。
    - 在戰鬥/地城掉落、商店購買與鐵匠鍛造時，`EquipmentGenerator` 自動依機率擲骰並從池中抽出指定數量的不重複技能，寫入實體武器的 `extraSkills`。
  - **遊戲內懸浮 Tooltip 與戰鬥雙向串接 (`ShopController.ts` & `CombatSystem.ts`)**：
    - 商店貨架、裝備換裝與對比 Tooltip 全面支援渲染 `✨ 附帶特技` 徽章，讓玩家在遊戲內一目了然裝備抽中的技能。
    - 戰鬥系統進入戰鬥時將所有裝備 `extraSkills` 自動注入傭兵 `actor.skills` 戰鬥技能庫。
  - **裝備工坊全新隨機技能池介面 (`EquipmentStudio.ts` & `equipment-studio.html`)**：
    - 區塊 1（✨ 固定特技）：支援點選挑選本命專屬技與一鍵清除。
    - 區塊 2（🎲 隨機技能池）：支援設定抽取機率 %、抽取數量（1~3 招），並可透過「➕ 挑選加入隨機池」動態增加任意數量技能徽章標籤，支援即時按「✕」移除。
    - 裝備列表卡片即時顯示「✨ 固定技徽章」與「🎲 隨機池 (N 招/P%) 徽章」。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 97 項單元測試 100% PASS。
- **[Fix/Tool/Equipment] 裝備工坊編輯與創造彈窗修復與 DOM 完整性回歸測試（2026-08-26）**：
  - **修復彈窗開啟時的 Null 錯誤 (`equipment-studio.html` & `EquipmentStudio.ts`)**：
    - 補齊裝備編輯器中 12 款隨機屬性詞條（`affix-deadly`, `affix-pierce`, `affix-vampire` 等）的 checkbox DOM 元素，徹底排除執行期拋出 `Cannot set properties of null (setting 'checked')` 導致無法開啟或保存裝備的問題。
    - 在 `EquipmentStudio.test.ts` 中新增 **「裝備編輯彈窗 HTML 模板 DOM ID 完整性檢查」** 自動化防呆測試，確保所有表單與操作元素永不丟失。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 96 項單元測試 100% PASS。
- **[Feature/Combat/Equipment] 武器額外技能接口啟用與視覺化技能挑選器 (Skill Picker) 實裝（2026-08-26）**：
  - **武器技能接口直接繼承底層技能定義 (`CombatSystem.ts`)**：
    - 冒險者裝備附帶 `extraSkills` 的武器（或防具/飾品）時，所有特技 ID 自動注入至戰鬥技能池 `actor.skills`。
    - **主動技能（ACTIVE）**：直接進入 AI 與 Gambit 決策，依 MP 與 CD 主動施放。
    - **被動與觸發技能（ON_TURN_START, ON_HIT_TAKEN, ON_KILL, ON_HP_THRESHOLD 等）**：由戰鬥系統 5 大鉤子自動喚起 `SkillEffectEngine.triggerHooks` 判定執行。
  - **裝備工坊視覺化技能挑選器 (`EquipmentStudio.ts` & `equipment-studio.html`)**：
    - 將特技欄位升級為「視覺化卡片 + 🔍 挑選技能按鈕 + ✕ 清除按鈕」。
    - 新增技能挑選彈窗 (`#modal-es-skill-picker`)，支援搜尋、分類（自訂積木技能、魔物特技、基礎/進階職業技能）與即時點選套用。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 95 項單元測試 100% PASS。
- **[Feature/Tool/UI] 技能工坊視覺化圖標庫挑選器 (Icon Picker) 與即時 Sprite 預覽實裝（2026-08-26）**：
  - **視覺化點選圖標庫 (`SkillWorkshop.ts` & `skill-workshop.html`)**：
    - 將技能圖標欄位升級為「視覺化頭像方塊 + 🔍 挑選圖標按鈕 + 手動代碼欄位」。
    - 點擊即可彈出全圖集通用選擇器，分類支援：
      - 🔮 **技能/戰鬥 Emoji**（火、冰、雷、毒、風、劍、盾、暴擊、增益等 50+ 精選）
      - 👾 **魔物/野獸 Emoji**（龍、狼、蝙蝠、惡魔、骷髏、獸爪等 30+ 精選）
      - ⚔️ **全圖集 Sprite**（`weapons`, `materials`, `monsters`, `buildings`, `npc` 等）
    - 支援即時搜尋與點選一鍵套用，左側清單與基本設定即時雙向更新。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試 100% PASS。
- **[Fix/Tool/UI] 故事工坊物品選擇器彈窗層級（z-index）與唯一來源圖標精靈圖 (UniversalIcon Sprite) 深度串接（2026-08-26）**：
  - **解決彈窗被遮擋問題 (`StoryStudioItemPicker.ts`)**：將物品挑選彈窗升級為 `position: fixed; inset: 0; z-index: 999999` 頂層毛玻璃遮罩，徹底解決在全螢幕故事工坊下彈窗跑到背後的層級問題。
  - **素材/特產/裝備唯一來源圖標完整渲染 (`StoryStudioForm.ts` & `StoryStudioItemPicker.ts`)**：
    - 引入專案核心 `renderUniversalIcon` 圖標渲染器，完整支援 `icons_materials:`、`icons_weapons:` 等唯一來源 Sprite 圖標集。
    - 挑選清單與決策獎勵效果列皆可直接呈現遊戲內高清美術圖標、中文品名與代號。
  - **技能工坊無縫導航入口整合**：在故事工坊、戰鬥工坊與裝備工坊頂部全面增設「🔮 技能工坊」導航按鈕，點擊即可一鍵在新分頁開啟全自訂積木技能工坊。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試 100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 3：全視覺化積木技能工坊 UI 與 10 款通用怪物技能遷移實裝（2026-08-26）**：
  - **視覺化技能工坊 UI (`skill-workshop.html` & `SkillWorkshop.ts`)**：
    - 左欄：技能庫清單，支援即時關鍵字搜尋與 4 大類別（魔物、基礎職業、進階職業、裝備）過濾。
    - 右欄：工作台雙向綁定 ID、名稱、圖示、MP 消耗、CD 與中文說明。
    - 積木流編輯器：自由增刪、複製、上下排序，支援 WHEN（觸發時機）、WHAT（效果類型）、TARGET（目標範圍）、IF（觸發條件）四維動態配置與參數即時調整。
    - 支援「💾 永久寫入專案磁碟」自動快照與「🕒 歷史快照」一鍵還原。
  - **10 款通用魔物技能積木化遷移 (`CustomSkillData.json`)**：
    - 完整將劇毒噴吐、撕裂爪擊、粉碎重擊、嗜血打擊、尖嘯震懾、暗影突襲、烈焰轟爆、冰霜吐息、堅石甲殼、狂暴怒吼等 10 款魔物技能轉換為積木格式。
  - **跨工坊導航互通**：戰鬥工坊、裝備工坊與技能工坊頂部導航無縫互通。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試（包含全新 `SkillWorkshop.test.ts`）100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 2：10款進階效果積木 × 戰鬥引擎 5 大觸發鉤子實裝（2026-08-26）**：
  - **進階效果積木全面實裝 (`SkillEffectEngine.ts`)**：
    - `DAMAGE_MIXED`（雙修混合傷害）、`APPLY_BARRIER`（護盾）、`CHAIN_DAMAGE`（連鎖彈跳傷害）、`EXECUTE`（斬殺處決）、`DISPEL`（驅散增益/護盾）、`STEAL_BUFF`（竊取增益）、`DELAYED_BOMB`（延遲定時炸彈）、`MP_DRAIN`（抽取魔力）、`FORCE_ROW_CHANGE`（擊退/前拉排位變更）、`FIELD_EFFECT`（戰場環境效果）。
  - **戰鬥引擎 5 大觸發鉤子掛載 (`CombatSystem.ts` & `SkillEffectEngine.triggerHooks`)**：
    - `ON_TURN_START`：每位行動者回合開始時觸發。
    - `ON_CRIT`：致命一擊命中後觸發。
    - `ON_HIT_TAKEN`：受到攻擊傷害後觸發。
    - `ON_KILL`：擊殺目標死亡結算時觸發。
    - `ON_HP_THRESHOLD`：HP 處於指定門檻（如殘血）時觸發。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、23 個測試檔案 92 項單元測試 100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 1：積木技能執行引擎與 CustomSkillData 整合實裝（2026-08-26）**：
  - **資料模型擴充 (`Skill.ts` & `Combat.ts`)**：
    - `Skill.ts` 定義 `CompositeSkillDefinition`、`EffectBlock`、`SkillTrigger`、`SkillCost`、`SkillCondition`、`SkillEffectType`、`SkillScaleType`。
    - `Combat.ts` 的 `StatusEffectType` 擴充 `MARK`（烙印）、`BARRIER`（護盾）、`DELAYED_BOMB`（延遲炸彈）、`FIELD_FIRE`、`FIELD_HOLY`、`FIELD_CURSE` 等 6 大狀態。
  - **積木技能執行與解譯引擎 (`SkillEffectEngine.ts`)**：
    - 實作 `SkillEffectEngine.compile()` 將積木定義編譯為 `Skill` 戰鬥物件。
    - 實作 `executeBlock()`、`checkCondition()`、`applyEffect()` 支援物理/魔法/真傷、吸血、多段打擊、狀態附加、烙印與引爆、自體/全體增益與治療。
  - **單一真相中心動態合併 (`SkillRegistry.ts`)**：
    - 載入 `CustomSkillData.json` 並與靜態技能庫自動合併，`getSkill()` 與 `getAllSkills()` 無縫支援工房自訂技能。
  - **Phase 1 驗收技能 (`CustomSkillData.json`)**：
    - 成功定義 `CATACLYSM_FLAME`（末日焰炎）與 `DRAGON_ROAR`（龍吟咆哮）。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、23 個測試檔案 90 項單元測試（包含全新 `SkillEffectEngine.test.ts`）100% PASS。
- **[Feature/Tool/Narrative] 故事工坊物品選擇器彈窗、範圍浮動懲罰、領地襲擊量化與自訂陣營聲望體系實裝（2026-08-26）**：
  - **唯一真實來源物品挑選彈窗 (`StoryStudioItemPicker.ts`)**：
    - 徹底告別純文字手動輸入 ID；點擊「🔍 挑選」即可彈出整合【💎 素材庫】、【🍷 特產/貿易品】與【⚔️ 裝備庫】的選擇器彈窗。
    - 支援即時關鍵字搜尋、裝備部位 (WEAPON/ARMOR/ACCESSORY) 與階級 (Tier 1~4) 篩選，並在卡片中即時預覽圖標與說明，點擊一鍵回填。
  - **討伐勝敗延遲排程機制 (`Narrative.ts` & `NarrativeSystem.ts`)**：
    - 擴充 `NarrativeSubjugationDefinition` 支援 `victoryDelayDays` 與 `defeatDelayDays`。
    - 設定為 0 天為戰後立即觸發；設定為 $N$ 天則自動註冊排程佇列，於指定遊戲天數後精準推進故事節點。
  - **範圍浮動百分比懲罰 (?% ~ ?%) 與建築受損 (`NarrativeSystem.ts`)**：
    - 實裝 `REDUCE_POPULATION_PERCENT`：隨機於指定區間（如 10%~20%）抽籤扣除當前人口，隨機從各工作崗位平均/抽籤扣除並提示重新分配。
    - 實裝 `REDUCE_RESOURCE_PERCENT`：依浮動百分比扣減金幣、糧食、木材、石材、鐵礦或全物資庫存。
    - 實裝 `REDUCE_PRESTIGE_PERCENT`：浮動百分比扣減聲望。
    - 實裝 `REDUCE_BUILDING_LEVEL`：受損扣減指定建築/生產設施等級。
  - **領地防禦力客觀量化與襲擊對抗系統 (`TerritoryDefenseSystem.ts`)**：
    - 實裝量化防衛力公式：$\text{防衛力} = (\text{哨所等級} \times 40) + \lfloor\text{治安值} \times 0.6\rfloor + \text{軍事官職加成 (隊長+50, 方旗騎士+40, 扈從+20)}$。
    - 實裝 `TRIGGER_RAID` 效果：依據防衛力與襲擊威脅度進行自動對抗判定，防守成功/失敗分別喚起對應後續節點。
  - **自訂陣營與遠古龍裔動態聲望體系 (`FactionManager.ts` & `StoryStudioFactionManager.ts`)**：
    - 新增自訂陣營管理中樞，預載【遠古龍裔 (`f_dragonkin`)】神秘氏族。
    - 故事工坊新增「🏷️ 自訂陣營/聲望」管理彈窗，支援隨時新增自訂陣營，並自動同步至所有故事條件/效果下拉選單、遊戲存檔與外交/聲望名冊中動態顯示。
  - **驗證**：TypeScript 型別檢查 0 錯誤、全部單元測試、5v5 戰鬥平衡量測、360 天雙難度經濟模擬與 P0 無頭瀏覽器煙霧測試 100% PASS。
- **[Optimization/Forge/UI] 鐵匠鋪 T4 神兵重鑄配方顯示與圖紙支援優化（2026-08-25）**：
  - **優化配方清單過濾條件 (`ForgeUIController.ts`)**：移除原「必須在倉庫持有前置裝備才顯示」的隱藏限制。只要鍛造屋等級達到 Lv.3 且持有對應圖紙（或通用重鑄卷軸），即刻於左側清單展示該神兵配方。
  - **前置裝備防呆友善提示**：若倉庫尚未打造前置基底武器，於右側火爐面板清楚標示「0/1」紅字狀態並將重鑄按鈕反灰，提供玩家清晰的鍛造指引。
  - **通用圖紙支援**：統一支援所有具有 `requireTomeId` 的進階與變異配方在右側卡片列出圖紙狀態並在打造時正確扣除。
  - **驗證**：TypeScript 型別檢查 0 錯誤、22 個測試檔案 85 項單元測試全數 PASS。
- **[Feature/Tool/Combat] 討伐據點守軍怪物進階配置升級「全視覺化特技資料庫挑選器」（2026-08-25）**：
  - **解決手動記憶代碼痛點 (`combat-studio.html` & `CombatStudio.ts`)**：將原文字輸入框徹底升級為視覺化清單。包含已裝備特技標籤（含 MP 消耗與 ✕ 一鍵移除），以及下方內建的「📚 全技能庫挑選器」。
  - **即時搜尋與詳細中文說明**：支援依據中文名稱（如「吐息」、「猛砍」、「毒」）、元素或描述即時過濾；每張卡片清楚標示中文名稱、MP 消耗、技能類別與中文效果，點擊「＋ 加入」即可一鍵裝配（上限 4 招）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、22 個測試檔案 85 項單元測試全數 PASS。
- **[Feature/Tool/Combat] 討伐據點設計工坊新增「守軍怪物進階配置（8大定位/特技/前後排站位/強化倍率/詞綴）」實裝（2026-08-25）**：
  - **資料模型擴充 (`Narrative.ts`)**：擴充 `SubjugationWaveMonster` 支援 `powerTier`、`profile` (8 大戰鬥定位：常規/鐵壁/刺客/法師/狂戰/狙擊/泥沼/首領)、`formationRow` (前後排站位)、`element` (元素相剋)、`affix` (自訂頭銜/前綴) 與 `skills` (自訂掛載特技清單)。
  - **視覺化進階配置彈窗 (`combat-studio.html` & `CombatStudio.ts`)**：於守軍波次怪物卡片新增「⚙️」進階配置按鈕，點擊彈出專屬設定彈窗，支援即時自訂數值縮放、戰鬥定位、站位、元素、詞綴與常用快捷特技代碼（如巨龍吐息、重擊、奧術飛彈、劇毒噴霧等）。
  - **波次卡片視覺化狀態徽章 (`CombatStudio.ts`)**：卡片上直觀呈現 `太古滅世黑龍 5.0x | 👑BOSS | 後排 | ✨2技` 等標籤。
  - **戰鬥沙盒與戰力評估連動 (`CombatStudio.ts`)**：點擊「⚡ 載入至戰鬥沙盒測試」時 100% 完整繼承自訂定位、特技與站位進行蒙地卡羅模擬；戰力預估 KPI 全面納入定位加權與特技評分。
  - **驗證**：TypeScript 型別檢查 0 錯誤、22 個測試檔案 85 項單元測試全數 PASS。
- **[Feature/Story/Map] 故事工坊新增「地圖：移除／銷毀地圖據點 (REMOVE_MAP_NODE)」效果實裝（2026-08-25）**：
  - **資料型別與工坊標籤 (`Narrative.ts` & `StoryStudioTypes.ts`)**：擴充 `NarrativeEffect` 支援 `REMOVE_MAP_NODE` 聯合型別，於故事工坊完成結果與選項效果清單註冊 `地圖：移除／銷毀地圖據點 (REMOVE_MAP_NODE)` 標籤。
  - **工坊表單快速選取 (`StoryStudioForm.ts`)**：提供「欲移除的地圖據點代號 (Node ID)」手動輸入框與「快速選取討伐據點範本 ID」下拉選單，創作者可一鍵選中故事中創造的動態據點。
  - **底層引擎智慧移除 (`NarrativeSystem.ts`)**：實裝 `applyEffect` 處理邏輯，支援直接傳入據點 ID 或故事全稱 ID（`story_${storyId}_${nodeId}`），即時透過 `GameState.mapSystem.removeDynamicNode()` 安全抹除該大地圖據點與視野關聯。
  - **驗證**：TypeScript 型別檢查 0 錯誤、22 個測試檔案 84 項單元測試全數 PASS。
- **[Fix/Story/Narrative] 實裝討伐專屬目標節點自動封印防護引擎與戰勝精準喚起（2026-08-25）**：
  - **自動封印防護 (`NarrativeSystem.ts`)**：新增 `isSubjugationTargetNode` 引擎級自動檢查：凡是被任何 `CREATE_SUBJUGATION_NODE` 登記為 `victoryNodeId`（戰勝）、`defeatNodeId`（戰敗）或 `journeyNodeIds`（途中事件）的後續節點，引擎全面自動封印，徹底杜絕其在每日換日（`processDailyTick`）、領地事件池或街道訪客池中被提前誤觸發。
  - **討伐結算精準喚起 (`NarrativeSystem.ts`)**：於 `handleSubjugationCompleted` 與 `handleSubjugationJourney` 中以強制優先級喚起目標節點，確保勝利/失敗演出 100% 於討伐出征結束結算當下精準觸發。
  - **資料修正 (`custom_stories.json`)**：清理《最後的龍裔》`dragon_fam_2`（瘋癲的酒客）中殘留的 `SET_FACT: dragon_fam_3w`，回歸由討伐勝利 `victoryNodeId: dragon_fam_3w` 純粹驅動。
  - **驗證**：TypeScript 型別檢查 0 錯誤、22 個測試檔案 83 項單元測試全數 PASS。
- **[Fix/Tool/SSOT] 討伐據點工坊載入重構為專案硬碟唯一真實來源 (SSOT) 與一鍵重新讀取實裝（2026-08-25）**：
  - **根本解決本地快取阻擋 Git Pull 檔案問題 (`CombatStudio.ts`)**：移除過往因 `localStorage` 舊資料而直接 return 忽略硬碟檔案的缺陷；將 `loadStrongholds()` 重構為非同步優先調用 `/api/get-subjugation-nodes` 讀取專案磁碟 `subjugation_nodes.json` 實體檔案，確保跨裝置或 Git Pull 後永遠讀取到最新專案據點庫。
  - **實裝工坊「🔄 重新讀取硬碟」按鈕 (`combat-studio.html` & `CombatStudio.ts`)**：於討伐據點工作區中欄頂部新增按鈕，支援在不重整瀏覽器分頁的情況下隨時一鍵從硬碟熱重載最新據點。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[UI/Dialog] 優化 NPC 對話彈窗預設保底按鈕文字（2026-08-24）**：
  - **移除不合時宜的罐頭台詞 (`NpcDialogueModalController.ts`)**：將故事節點無分支選項時的保底離開按鈕文字從「了解，願秩序庇佑領地。」修改為乾淨通用的「結束對話」，避免在陰暗/恐怖/市井等各類情境對話中產生違和感。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[Fix/Feature/Balance] 戰鬥工坊補齊「大主教」與純色/複合武器標準 (A) 級 Scaling 補正引擎實裝（2026-08-24）**：
  - **補齊進階大主教職業 (`CombatStudio.ts`)**：在戰鬥沙盒傭兵卡片的進階職業下拉選單中補上「大主教」，並完整綁定聖典 (`HOLY_BOOK`) 與全體大招【神聖之雨】。
  - **純色與複合雙屬性武器標準 (A) 級補正實裝 (`calculateWeaponScalingBonus`)**：
    - **純色單屬性 (1.2x)**：巨劍 (STR)、戰弓/雙匕 (AGI)、法杖 (INT)、聖典 (SPR)、劍盾 (CON)。
    - **複合雙修雙屬性 (各 0.6x，總和 1.2x)**：魔劍士/雙劍 (STR+INT)、精靈使/魔法弓 (AGI+INT)、符文騎士/符文盾 (CON+SPR)、異端拷問官/戰鎚 (STR+SPR)、死靈法師/戰鐮 (STR+INT)、詭術師/魔戒 (AGI+INT)。
    - **沙盒完全隔離**：數值只在沙盒記憶體計算生效，100% 不污染正式遊戲裝備資料庫。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[Feature/Tool/World] 討伐據點工坊自訂「大世界開局隱藏秘境」與酒館老爹專屬雙層傳聞機制實裝（2026-08-24）**：
  - **自訂世界隱藏秘境開關與雙層傳聞欄位 (`combat-studio.html` & `CombatStudio.ts`)**：在討伐據點設計工坊新增「🗺️ 註冊為開局世界隱藏秘境 (`isWorldSecret`)」開關，並提供「未開迷霧時的曖昧傳聞 (`fogRumor`)」與「已開迷霧時的解鎖情報 (`revealRumor`)」專屬台詞輸入框，支援隨即時同步與持久化存檔。
  - **大世界開局秘境自動佈署 (`GameState.ts` & `MapGenerator.ts`)**：在開新遊戲或生成世界時，系統自動載入討伐據點庫中所有標記為秘境的據點，以 `isHidden: true` 隱藏狀態自然散佈於大世界對應地形的迷霧深處。
  - **酒館打聽專屬傳聞播放連動 (`TavernSystem.ts`)**：酒館老爹打聽情報抽中隱藏秘境時，若玩家尚未探開該處迷霧，優先講述創作者自訂的懸疑曖昧台詞；若玩家已探開迷霧，則講述確切解鎖情報並點亮地圖據點。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[Feature/Tool/UI] 故事工坊據點效果欄位精簡化、戰鬥沙盒動態據點情境與 HP/MP 即時動態扣減實裝（2026-08-24）**：
  - **故事工坊專職精簡 (`StoryStudioForm.ts`)**：落實「討伐據點專職分工」架構，將故事工坊的「討伐：創造故事討伐據點」效果卡片精簡為 5 大專職欄位（選擇已創作的討伐據點範本、據點名稱、勝利節點 ID、失敗節點 ID、途中事件節點 IDs），敵軍波次、掉落與地形難度全面由討伐據點工坊專職定義與管理。
  - **戰鬥沙盒「據點情境」動態選單 (`CombatStudio.ts`)**：移除靜態寫死的情境選項，實裝 `renderStrongholdScenarioDropdown()` 動態載入討伐據點庫（包含自訂與官方據點），選取任意據點即可秒速載入對應地形、難度與完整波次守軍。
  - **戰鬥模擬 HP/MP 即時動態扣減與視覺反饋 (`CombatStudio.ts`)**：修復角色卡片 DOM ID 與事件映射，實裝血量 (HP) 與魔力 (MP) 雙軌即時寬度與數值文字同步（如 `150/200`）、受傷微晃動動畫與陣亡暗化標記。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[Bugfix/Tool] 戰鬥工坊頂部「寫入專案硬碟」按鈕遺漏討伐據點寫入修復與專屬按鈕實裝（2026-08-24）**：
  - **頂部主儲存按鈕修復 (CombatStudio.ts)**：修復頂部工具列「💾 寫入專案硬碟」（#btn-save-monsters）事件綁定僅呼叫 /api/save-monster-definitions 而遺漏 /api/save-subjugation-nodes 的缺陷，改為調用 saveMonstersToDisk()，確保每次點擊時怪物庫（monsters.json）與討伐據點庫（subjugation_nodes.json）100% 同步寫入專案磁碟。
  - **討伐據點工坊專屬寫入按鈕實裝 (combat-studio.html & CombatStudio.ts)**：在討伐據點設計工坊工作區頂部新增「💾 寫入專案硬碟」（#btn-sh-save-disk）按鈕，提供使用者在設計據點時最直接明瞭的保存路徑。
  - **驗證**：TypeScript 型別檢查 0 錯誤、82 項單元測試全數 PASS。
- **[Feature/Tool/Test] 故事工坊「強制測試節點」與受排程節點自動封印機制升級（2026-08-24）**：
  - **受排程目標節點自動防護 (`NarrativeSystem.ts` & `NarrativeTestController.ts`)**：
    - 實裝 `isScheduledTargetNode` 自動防護機制：凡是被任何劇情選項或事件之 `SCHEDULE_NODE` 指名為目標的後續節點，在尚未被前置決策喚醒前，引擎全面自動封印，徹底杜絕後續步驟提前在街道或世界中誤觸發。
    - 創作者僅需在選項設定 `SCHEDULE_NODE (延遲 N 天)`，後續節點即會自然受保護，不再需要額外手動疊加 Fact 線索條件。
    - 故事測試模式一鍵滿足功能同步支援排程自動滿足。
  - **自動沙盒世界、BASE_URL 資源路徑對齊、領地街道快速切換與即時重繪 (`NarrativeTestController.ts` & `MapScene.ts` & `SceneController.ts` & `UIManager.ts`)**：
    - 在測試控制面板新增 **「🏰 切換至領地街道 / 🗺️ 返回地圖」** 快捷按鈕，允許創作者一鍵無縫穿梭於世界大地圖與領地街道設施之間。
    - 修復街景背景圖與 Phaser 圖片資源路徑：全面引入 `import.meta.env.BASE_URL`，確保 `/Medieval/` 子路徑下所有街景與節點圖示正確載入。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。��街景背景圖與 Phaser 圖片資源路徑：全面引入 `import.meta.env.BASE_URL`，確保 `/Medieval/` 子路徑下所有街景與節點圖示正確載入。
    - 故事測試與正式存檔徹底解耦：即時生成 100% 獨立、純淨、迷霧全開（`revealAllCells`）的專用測試沙盒世界。
    - 實裝節點所屬故事「智慧雙向反查機制」：無論傳入故事 ID 或節點 ID，均能精準定位《最後的龍裔》（`dragon_fam`）等自訂劇情。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Bugfix/Tool] 故事工坊多段對話列表容器 ID 綁定修復（2026-08-24）**：
  - **對話清單渲染容器修復 (`StoryStudioForm.ts`)**：
    - 修復多段對話列表容器 ID 尋找名稱（`story-node-dialogue-pages-list`）不一致導致點擊「＋ 新增對話段落」時未正確渲染出編輯卡片的缺陷。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Bugfix/Tool/Stability] 故事工坊節點 ID 嚴格唯一性防撞保護實裝與節點資料修復（2026-08-24）**：
  - **ID 唯一性防撞與失焦重命名校驗 (`StoryStudioForm.ts`)**：
    - 將節點代號（`story-node-id`）與普通標題/屬性欄位徹底解耦，改為失焦（`change`）時進行全域防重複校驗。
    - 若輸入重複或已存在的節點代號，系統會即時阻斷並彈出警告，徹底根絕「ID 重名導致節點被 `find()` 判定為同一個而發生同化」的缺陷。
    - 支援節點 ID 重命名時，自動遞迴遷移故事內其他節點對此 ID 的關聯引用（如排程與討伐勝利/失敗/路途節點）。
  - **資料修正 (`custom_stories.json`)**：
    - 已將《最後的龍裔》兩大節點徹底區隔：`dragon_fam`（酒館傳聞·隱藏的龍裔）與 `dragon_fam_todo`（待辦清單·對於瘋癲客人的好奇）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Refactor/Tool/Architecture] 故事工坊 (Story Studio) 全面架構整合與狀態中樞重構實裝（2026-08-24）**：
  - **狀態驅動架構與模組化分工 (`src/tools/story-studio/`)**：
    - 建立 `StoryStudioStore.ts` 作為單一真實來源（SSOT），管理故事資料、選取狀態、畫布坐標與草稿快取，杜絕跨模組競爭。
    - 建立 `StoryStudioGraph.ts`：實裝 5px 拖曳安全門檻，徹底根治點擊選取時節點微動跳位缺陷；支援平移、滾輪縮放、牽線與智慧排版。
    - 建立 `StoryStudioForm.ts`：實現安全單向資料注入鎖定（`isPopulating`），移除全域模糊冒泡監聽，徹底解決節點切換時名稱覆蓋與欄位亂跑問題。
    - 建立 `StoryStudioPreview.ts`：獨立管理 1:1.853 NPC 大立繪多頁對話即時演練彈窗。
    - 簡化 `StoryStudio.ts` 為乾淨的系統裝配入口。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/Tool/Stability] 故事工坊自動草稿快取機制實裝與《最後的龍裔》對話復原（2026-08-24）**：
  - **即時自動草稿快取與無縫還原 (`StoryStudio.ts`)**：
    - 實裝 `localStorage` 自動草稿同步機制：任何節點增刪、標題修改、對話編輯皆在 0.3 秒內即時儲存至本地草稿，即便瀏覽器重整或熱重載亦能 100% 自動無痛還原。
    - 點擊「寫入專案」成功後自動清除草稿並建立歷史快照。
  - **資料復原 (`custom_stories.json`)**：
    - 已將《最後的龍裔》故事中「對於瘋癲客人的好奇」節點對話（誓約守衛台詞：「酒館老闆說，你喝醉時提到過村邊附近隱密的那個洞窟...」）完整復原寫入專案檔案。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/UI/Story] 誓約守衛對話名稱動態綁定玩家命名與稱號精簡優化（2026-08-24）**：
  - **對話框守衛名稱動態讀取 (`NpcDialogueModalController.ts`)**：
    - 當對話發話者為「👑 玩家誓約守衛」時，發話者名稱 100% 動態連結玩家開局或名冊為其所取的自訂名字（`guardian.name`），並徹底移除多餘的動態稱號行，使對話版面更乾淨純粹。
  - **故事工坊編輯器介面精簡 (`StoryStudio.ts`)**：
    - 當選取「👑 玩家誓約守衛」時，自動隱藏名稱、稱號與肖像欄位，改顯示簡潔提示標籤（避免殘留上一段 NPC 的稱號字串），創作者只需專注編寫該段台詞。
    - 工坊對話即時預覽同步支援男女守衛切換且不顯示冗餘稱號。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Bugfix/UI] 待辦事項紅點提醒徽章遺漏故事待辦節點問題修復（2026-08-24）**：
  - **待辦提醒徽章計數修正 (`UIManager.ts`)**：
    - 修復先前 `todo-badge` 只計算傳統領地事件（`territory.pendingEvents`）而遺漏故事工坊待辦節點（`territory.pendingNarrativeNodes`）導致有待辦內容卻不顯示紅點的缺陷。
    - 改為正確合併加總兩者數量，確保有任何待辦內容時紅點徽章即時準確顯示。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/Tool/Cheat] 故事節點前置條件一鍵滿足與全設施升級密技實裝（2026-08-24）**：
  - **故事測試模式一鍵補足條件 (`NarrativeTestController.ts`)**：
    - 於測試面板新增「🪄 一鍵滿足此節點前置條件」按鈕，自動分析選取節點的條件（如酒館等級、聲望、金幣、天數、線索 Fact 等），一鍵將領地與敘事狀態升級補足，免除手動練等或等待排程。
  - **領地設施與建築除錯密技 (`CheatController.ts` & `docs/CHEATS.md`)**：
    - 新增 `buildmax` 密技：一鍵解鎖並將所有建築（酒館、武器店、防具店、鍛造屋、防禦工事）與四大生產設施（農田、伐木場、採石場、獵場）升至 5 等滿級。
  - **酒館傳聞沉浸感優化 (`TavernSystem.ts`)**：
    - 移除觸發故事傳聞時字尾生硬附加的 `(故事線索：...)` 括號標籤，回歸純淨自然、沉浸感十足的 NPC 傳聞台詞演出。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/Asset/Data] 市井 NPC 與龍裔 2×5 高解析對話立繪圖集實裝與資料集註冊（2026-08-24）**：
  - **2×5 市井 NPC 與龍裔對話立繪圖集 (`npc_common.jpg`)**：
    - 精準繪製 10 款對話專用肖像：龍血女劍客（赤金龍鱗）、龍血男戰士（黑青龍鱗）、風霜老流浪漢、新手見習傭兵、狡黠街頭女賊、酒館落魄老兵、悍勇女打手、行腳市井貨郎、枯瘦老農夫、重傷包紮傭兵。
    - 採用標準 1:1.853 極細古銅細線邊框與 95%+ 滿版大人物特寫，儲存於 `public/assets/custom_icons/npc_common.jpg`。
  - **資料集與座標映射 (`custom_icon_datasets.json` & `custom_icon_config.json`)**：
    - 正式註冊 `npc_common` 資料集（10 款肖像），提供故事工坊肖像挑選器與街角事件即時呼叫。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/Tool/UI] 故事工坊 NPC 對話完整測試系統實裝與主迴圈事件路由連通（2026-08-24）**：
  - **故事工坊即時預覽彈窗 (`StoryStudio.ts` & `story-editor.html`)**：
    - 於對話分頁清單旁新增「💬 即時預覽此對話」按鈕，創作者可在編輯時一鍵喚起完整 1:1.853 NPC 大立繪對話彈窗。
    - 支援多段對話逐頁切換、頁數指示器（頁 X / Y）、當發話者為誓約守衛時支援一鍵切換「男守衛 / 女守衛」立繪預覽，以及最後一頁的分支決策選項點擊模擬。
  - **遊戲主迴圈與事件路由連通 (`main.ts`)**：
    - 修復 `NARRATIVE_NODE_TRIGGERED` 事件監聽，優先檢查節點是否含有 `dialoguePages` 或為 `STREET_EVENT` 頻道，正確路由至 `NpcDialogueModalController` 沉浸式對話彈窗而非普通純文字事件框。
  - **故事測試模式面板增強 (`NarrativeTestController.ts`)**：
    - 節點選單自動為含有對話的節點標註「💬 」，點擊強制測試即可即時喚起完整 NPC 對話演出。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Feature/Asset/UI] 誓約男女守衛 2×5 全套高解析對話立繪圖集實裝與對話框連動（2026-08-24）**：
  - **2×5 誓約女守衛對話立繪圖集 (`guardian_f_talk.jpg`)**：
    - 精準對齊 10 位女守衛特徵（金髮聖騎、修道神官、赤髮劍士、英姿女騎、暗影俠女、紫袍法師、金紋重甲女將⭐、黑皮刺客、長弓射手、重裝女戰）。
    - 採用標準直立比例（1:1.85）哥德式雕花畫框，100% 純淨無文字，儲存於 `public/assets/custom_icons/guardian_f_talk.jpg`。
  - **2×5 誓約男守衛對話立繪圖集 (`guardian_m_talk.jpg`)**：
    - 精準對齊 10 位男守衛特徵（滄桑老將、銀髮雄獅、青年侍從、金紋將軍、兜帽遊俠、戰斧狂戰、歷戰刀疤重騎⭐、歷戰傭兵、長弓獵手、全罩步兵），儲存於 `public/assets/custom_icons/guardian_m_talk.jpg`。
  - **資料集與座標映射配置 (`custom_icon_datasets.json` & `custom_icon_config.json`)**：
    - 正式註冊 `guardian_m_talk` 與 `guardian_f_talk` 兩大資料集（各 10 位角色，共 20 位），配置精確切片座標。
  - **NPC 對話彈窗智慧立繪連動與守衛讀取修復 (`NpcDialogueModalController.ts`)**：
    - 修復先前自 `GameState.myTerritory.oathGuardian` 讀取守衛導致女性守衛永遠為 `undefined` 並回退成男性 `guardian_m_1` 的缺陷。
    - 改為正確自冒險者名冊 `GameState.adventurers.find(a => a.isGuardian)` 讀取真實守衛實體，並根據 `gender` 與 `avatarIndex` 完美映射至對應的 `guardian_m_talk_x` 或 `guardian_f_talk_x` 高解析立繪。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **[Doc/Architecture] 專案架構文件 (`docs/ARCHITECTURE.md`) 全面同步與目錄樹重構（2026-08-24）**：
  - **修復目錄樹排版與格式缺陷**：修復檔案路徑中殘留的 `\n` 換行轉義字元，重新整理 `src/ui/modals/`、`src/ui/components/` 與 `tools/` 的階層關係。
  - **補齊最新系統與控制器索引**：新增裝備工坊 (`EquipmentStudio.ts`)、技能註冊中樞 (`SkillRegistry.ts`)、GAMBIT 判定器 (`GambitEvaluator.ts`)、派系軍隊生成 (`FactionArmyGenerator.ts`)、NPC 對話彈窗 (`NpcDialogueModalController.ts`)、懸賞告示板 (`BountyModalController.ts`)、誓約創角 (`OathCreationController.ts`)、街道視圖控制器 (`SceneController.ts`)、改造所、二手黑市與官方討伐據點資料庫 (`subjugation_nodes.json`) 等索引。
  - **擴充最新實裝核心架構章節**：新增「四大獨立開發工坊生態圈」、「戰鬥中樞、怪物 8 大定位與技能註冊系統」、「裝備體系、T1~T5 Scaling 與自動同步機制」、「街道場景與 NPC 訪客對話系統」與「懸賞與討伐據點全面故事化架構」章節。
- **[Feature/Narrative/UI] NPC 街道訪客事件與沉浸式視覺化對話系統實裝（2026-08-23）**：
  - **對話完成即時刷新與事件監聽持久化修復 (`NpcDialogueModalController.ts` & `SceneController.ts`)**：
    - 修復開局/讀檔時 `clearAll('system')` 意外清除街道訪客事件監聽器，導致點擊「資助 150 金幣」後 NPC 按鈕未從街道上移除、重複索要金幣的問題。
    - 將街道訪客監聽器設定為 `'ui'` 持久 scope，並在對話選項結算後主動調用 `renderStreetNpcEvents()` 與 `UIManager.updateUI()` 即時移除 NPC 圖標與刷新頂部資源。
    - 在選項按鈕實裝 `canAffordChoice` 負擔能力判定與安全阻擋提示，防止金幣不足時誤觸扣款。
  - **通用直立肖像渲染器 (`IconSpriteHelper.renderUniversalPortrait`)**：
    - 重構直立肖像渲染架構，徹底解決從 1:1 正方形拉伸導致人物被縱向壓扁與上下留黑的問題。
    - 鎖定圖庫真實長寬比（**`1 : 1.853`**），圖片 100% 飽滿填滿容器，人物身材、五官與雕花畫框 100% 正確還原，0 壓扁、0 變形。
  - **街道紅框訪客列升級 (`SceneController.ts` & `views-main.html`)**：
    - 訪客按鈕尺寸加大升級為 **`44px × 82px`**（容器高 `92px`），極具視覺存在感且自然融入小巷通道。
    - 無事件時 100% 透明無痕、零邊框底色；支援滑鼠拖曳與滑輪左右滑動，隨滑鼠游標移動 Floating Tooltip。
  - **沉浸式對話彈窗立繪加大 (`NpcDialogueModalController.ts` & `modals-game.html`)**：
    - 左側大立繪展位升級為 **`140px × 260px`** 超大肖像畫框，高解析度呈現立繪與頭銜。
    - 支援多段對話切換說話者（NPC vs 玩家誓約守衛/領主）、左下角精緻繼續按鈕與最後分支選項。
  - **故事工坊「NPC 肖像視覺化挑選彈窗」(`StoryStudio.ts` & `story-editor.html`)**：
    - 移除純文字輸入框，改為「🖼️ 即時預覽卡片 ＋ ［🔍 挑選肖像］按鈕」。
    - 建立 `#modal-story-avatar-picker` 肖像挑選彈窗，動態讀取專案所有圖庫分類（`npc`、`npc_man`、`guardian` 等），支援即時搜尋與分類過濾，保證未來在圖庫新增任何肖像均能即時在此挑選！
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試、P0 遭遇測試、經濟平衡模擬與端到端 Smoke Test 全數通過。
- **[Feature/CombatStudio/StoryStudio] 討伐據點設計工坊重構與故事工坊模板化一鍵選取整合（2026-08-23）**：
  - **戰鬥工坊【🏰 討伐據點設計工坊】全面重構 (`CombatStudio.ts` & `combat-studio.html`)**：
    - 頂部導航欄新增第 4 分頁【🏰 討伐據點設計工坊】，三欄式專業工作台架構：
      - **左欄（據點清單與搜尋過濾）**：即時搜尋名稱/ID、地形過濾、波次與守軍數量標籤、新增/複製/刪除據點。
      - **中欄（據點屬性與 1~3 波守軍編制）**：視覺化配置據點代號、名稱、地形、難度等級（Lv.1~10）、專屬圖標、情報偵查要求、通關獎勵（金幣/EXP/聲望）；每一波次支援 1~5 隻守軍增減，並內建「怪物挑選彈窗 (`#modal-sh-monster-picker`)」。
      - **右欄（戰力評估與沙盒測試大盤）**：即時計算所有波次怪物之預估總戰力（Total Power）、推薦隊伍陣容等級；提供「⚡ 載入至戰鬥沙盒測試」，一鍵將該據點守軍陣容全數帶入戰鬥模擬沙盒即時開戰驗證！
  - **獨立討伐據點資料庫與持久化 (`subjugation_nodes.json` & `DataStore.SubjugationNodeDB`)**：
    - 建立官方討伐據點資料庫，收錄走私者關卡、哥布林洞穴、古代地下墓穴、霜風冰龍巢穴等經典據點。
    - 掛載至 `DataStore.SubjugationNodeDB`；工坊支援「💾 寫入專案硬碟」，自動寫入 `src/data/subjugation_nodes.json` 並生成歷史快照備份。
  - **故事工坊一鍵模板化選取整合 (`StoryStudio.ts` & `NarrativeSystem.ts`)**：
    - 在故事工坊 `CREATE_SUBJUGATION_NODE` 效果中，新增「🏰 選擇討伐據點模板」下拉選單，選擇模板後自動同步帶入名稱、描述、地形、難度與屬性，作者僅需設定生成位置與綁定故事後續節點（途中事件、勝利、失敗）。
    - 遊戲運行時 `NarrativeSystem.createSubjugationNode` 支援讀取 `templateId` 生成動態大世界討伐據點。
  - **驗證**：TypeScript 型別檢查、81 項單元測試、P0 遭遇測試、經濟模擬與自動化 Smoke Test 100% 綠燈通過。
- **[Feature/Narrative/Bounty] 懸賞任務全面整合進故事工坊與條件引擎過濾升級（2026-08-23）**：
  - **日常懸賞故事化與官方日常故事集 (`custom_stories.json`)**：
    - 建立官方日常故事集《領地日常與居民委託》（`story_daily_routine`），收錄 15 個日常任務（找貓、下水道老鼠、夜間巡邏、收割小麥、採集藥草、教訓流氓、修補城牆等）。
    - 徹底移除 `BountySystem.ts` 中的寫死靜態陣列，全面改由 `NarrativeSystem` 統一驅動。
  - **可重複輪替與冷卻機制 (`NarrativeNode.repeatable` & `cooldownDays`)**：
    - 故事節點支援 `repeatable: true`（允許日常重複輪替）與 `cooldownDays`（冷卻天數，預設 3 天）。
    - 在 `NarrativeRuntimeState.nodeLastCompletedDay` 記錄節點完成天數，冷卻期內自動隱藏，冷卻結束後再次合資格。
  - **條件動態過濾 (Conditions Support for Bounties)**：
    - 日常懸賞完整繼承故事工坊全部條件判定（天數、線索 Fact、領地規模、聲望、金幣、派系好感度等），只要條件不滿足立即自動排除在懸賞告示板候選名單外。
  - **故事工坊 UI 編輯支援 (`StoryStudio.ts` & `story-editor.html`)**：
    - 懸賞面板新增 `☑️ 允許日常重複輪替 (Repeatable)`、`刷新冷卻天數` 與 `任務類型 (NORMAL/BANDIT)` 視覺化輸入。
    - 節點列表卡片即時標註 `[🔄日常]` 標籤。
  - **驗證**：新增專屬單元測試，81 項單元測試、TypeScript 型別檢查與 P0 自動化驗證（戰鬥遭遇、經濟模擬、Smoke）100% 綠燈通過。
- **[Fix/System/Trade] 商隊全品類貨物正常收購變現機制修復（2026-08-23）**：
  - **根本原因排查**：商隊抵達目標城後，先前代碼限制只有當商品屬於目標城當地的 `marketData.goods` 特產清單時才會收購；若載運非特產物資（例如載小麥去礦場、載生皮去平原），會被系統直接略過不賣，導致貨物整車原封不動被運回領地。
  - **修復（`DispatchSystem.ts`）**：移除嚴格的特產清單限制，實裝全品類收購機制。非特產商品按基準收購價（疊加傭兵議價與道路加成）正常全額收購，貨物成功變現為金幣帶回領地。
- **[Fix/UI/Settlement] 開局/讀檔誤觸發據點規模擴張通知修復（2026-08-22）**：
  - **根本原因排查**：世界生成與存檔還原時，玩家主據點節點的 `nodeLevel` 預設停留在荒野（`WILDERNESS`，0），但在 UI 初次渲染時計算當前人口與建築繁榮度已達到村莊（`VILLAGE`，2），導致每次開局或讀檔時誤判為「剛剛發生了升級擴張」而反覆彈出通知。
  - **修復（`MapGenerator.ts` & `SaveManager.ts`）**：在世界生成與讀檔還原時，立即預先計算並對齊主據點的 `prosperity` 與 `nodeLevel`，消除初始化時的數值落差，確保擴張通知只會在真正的繁榮度跨越時觸發一次。
- **[Feature/Economy/Sync] 跑商特產與領地基礎資源（木材/鐵礦/石材/糧食）全面一體化打通（2026-08-22）**：
  - **庫存與讀取消耗一體化 (`ShopController.ts` & `TradeController.ts`)**：
    - 建立全域統一的特產與資源讀取/消耗/入庫方法 `getTradeGoodStock`、`consumeTradeGoodStock`、`addTradeGoodStock`。
    - 木材（`tg_timber`）、鐵礦石（`tg_iron`）、石材（`tg_stone`）、小麥（`tg_wheat`）直接雙向連動領地頂部資源 `territory.wood/iron/stone/food`。
    - 單線商隊載貨與倉庫介面 100% 反映領地真實總資源庫存；商隊載貨出發扣除對應基礎物資，買貨返程全額自動入庫至領地頂部資源。
  - **舊存檔自動無縫合併遷移 (`SaveManager.ts`)**：
    - 讀檔時自動將存檔中 `tradeInventory` 殘留的木材與鐵礦石合併回領地頂部總庫存，徹底消除系統間資源割裂。
- **[Fix/UI/Trade] 跑商規劃與市場面板圖標字串外溢徹底修復（2026-08-22）**：
  - **圖標與文字分離渲染 (`TradeController.ts`)**：
    - 修復在下拉選單 `<option>`、出發載貨清單與市場行情面板中直接文字插值 `${goodRef.icon}` 導致輸出 `icons_materials:icons_materials_8` 英文串的問題。
    - 下拉選單純文字呈現乾淨中文名稱；列表與行情卡片全面使用 `renderUniversalIcon` 正確渲染為獨立的高解析 Sprite 精靈圖標。
- **[Fix/UI/Icons] 領主總倉庫交易品與商隊特產圖標全面升級高解析 Sprite（2026-08-22）**：
  - **TRADE_GOODS 圖標定義升級 (`MarketSystem.ts`)**：
    - 將棉麻、生皮、獸肉、木材、鐵礦石、黑曜石、冰晶、絲綢等所有特產的 `icon` 由舊版 Emoji（如 `🦬`、`🌿`、`💎`，其中生皮在 Windows 上會顯示為破損方框 `▯`）全面升級為專屬高解析度 Sprite 圖集標籤（如 `icons_materials:icons_materials_0`~`8`）。
  - **領主總倉庫渲染同步 (`ForgeUIController.ts` & `TradeController.ts`)**：
    - 領主總倉庫中的【交易品物資】與目標城鎮交易面板 100% 連結至精美素材 Sprite 圖標，告別 Emoji 與字體破圖問題。
- **[Fix/Forge/Materials] 領地鍛造屋與冶煉系統全面支援特產/交易品庫存讀取與扣除（2026-08-22）**：
  - **全特產庫存識別 (`ShopController.getMaterialCount` & `consumeMaterial`)**：
    - 修復先前材料庫存判定僅對硬編碼的 `tg_hide` 與 `tg_cotton` 有效，導致黑曜石（`tg_obsidian`）、冰晶（`tg_ice_crystal`）、絲綢（`tg_silk`）等透過跑商買回的特產在冶煉秘銀錠或鍛造進階裝備時顯示為 0 的問題。
    - 全面打通 `tradeInventory` 與 `materials`，鍛造屋與改造工作臺 100% 正確識別並消耗黑曜石等所有特產與交易品。
- **[Balance/Economy/Trade] 傭兵跑商議價體系重塑與採購本金庫存連動修復（2026-08-22）**：
  - **傭兵議價特長微調與上限保護 (`Adventurer.ts` & `TradeController.ts`)**：
    - 單人議價加成調整為 `1% ~ 5%`（依魅力與智慧成長，上限 5%）。
    - 小隊總議價上限嚴格鎖定為 **20%**，杜絕多名法師/祈禱者疊加至 100% 造成 1 塊錢零元購破壞經濟系統的嚴重 Bug。
  - **採購本金與庫存雙向智能連動 (`TradeController.ts`)**：
    - 單線商隊介面中，採購數量輸入框自動鎖定目標據點的「最大實際庫存」。
    - 當調整採購數量時，自動計算並同步填入所需採購本金（折後單價 × 數量）；當手動輸入本金時，提供即時不足警示。
  - **商隊交易收購保底與精準結算 (`DispatchSystem.ts`)**：
    - 據點收購所有常規特產，若市場未隨機列出該特產，則以該商品之基準行情市價收購，不再拒收或原封不動運回。
    - 抵達結算時精確扣款與採購指定特產，未花完的本金全額安全帶回領地並在結算日誌中清楚列示。
- **[Fix/UI/Icons] 全域倉庫素材與各介面高解析圖標全面修復與連結（2026-08-22）**：
  - **全域倉庫素材/交易品圖標修復 (`InventoryUIController.ts`)**：
    - 將舊版 `renderResourceSpriteHtml` 替換為全域通用渲染器 `renderUniversalIcon`，木板、粗布、鐵錠、石磚、皮革、磨刀石、鋼錠等素材及所有交易品正式連結至專屬精美 Sprite 圖標，徹底告別 📦 紙箱佔位圖。
  - **各模組圖標渲染統一升級**：
    - **防具商店 (`ShopController.ts`)**：在防具卡片名稱旁補上 `renderEquipIcon`，使武器與防具店視覺一致。
    - **改造工作臺 (`ModificationWorkshopController.ts`)**：在改造方案與配方中全面整合 `renderUniversalIcon` 高清圖標。
- **[Feature/Narrative/Bounty] 故事懸賞即時同步與條件檢查優化（2026-08-22）**：
  - **即時入榜檢查 (`BountyModalController.show`)**：在玩家點擊開啟懸賞告示板 UI 時，主動呼叫 `NarrativeSystem.ensureStoryBounties()`，確保只要達成第 2 天（`DAY_AT_LEAST: 2`）與故事前置條件，主線故事委託「◆ 尋找失蹤的丈夫」必定即時刷新並陳列在懸賞清單中。
- **[Feature/Equipment/ClassSystem] 實裝職業專屬裝備限制智能推導與工坊防漏保護機制（2026-08-22）**：
  - **職業與武器/防具天然綁定推導 (`DataStore.getDefaultAllowedJobs`)**：
    - 嚴格對齊 [docs/CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md)，所有武器與防具自動智能推導其職業穿戴限制（例如戰弓/短弓限弓箭手、巨劍/雙劍限戰士、法杖/戰鐮限法師、重鎧限戰士/騎士等）。
    - 換裝面板對非本職裝備即時呈現紅框反灰與 not-allowed 防呆提示。
  - **裝備工坊全自動防漏保護 (`EquipmentStudio.ts`)**：
    - 在 `CustomEquipmentTemplate` 補齊 `allowedJobs` 介面，無論在工坊中如何編輯、新建、複製或保存裝備，皆自動保留並繼承正確的職業限制，永不再發生覆蓋丟失問題。
  - **存檔自動對齊修復 (`SaveManager.ts`)**：
    - 讀檔瞬間自動刷新現有冒險者與領地倉庫中裝備的 `allowedJobs`，所有舊存檔立即恢復嚴格職業限制。
- **[Feature/Equipment/Scaling] 實裝 T1~T5 指定階級補正範圍與職業武器專屬隨機 Scaling 規則引擎（2026-08-22）**：
  - **精確階級補正範圍實裝 (`EquipmentGenerator.getTierScalingRange`)**：
    - **T1 基礎裝**：`D ~ B` 級補正
    - **T2 精良裝**：`C ~ A` 級補正
    - **T3 稀有裝**：`B ~ A` 級補正
    - **T4、T5 史詩與神話裝**：`B ~ S` 級補正
  - **職業武器專屬主屬性與隨機副屬性抽池 (`getDefaultScalingRules`)**：
    - **短弓／戰弓 / 雙匕首**：保底 `AGI` 主補正，隨機副屬性池抽 0~2 條額外屬性補正。
    - **法杖 / 魔法戒指**：保底 `INT` 主補正，隨機副屬性池抽 0~2 條。
    - **巨劍 / 戰士武器**：保底 `STR` 主補正，隨機副屬性池抽 0~2 條。
    - **聖典**：保底 `SPR` 主補正；**劍盾**：保底 `STR + CON`；**雙劍 / 魔法弓**：保底雙修雙主屬性。
    - **防具**：布甲保底 `SPR`、皮甲保底 `LUK/AGI`、重鎧保底 `CON`，隨機池抽 0~1 條。
  - **舊存檔自動洗鍊對齊 (`SaveManager.ts`)**：讀檔時自動偵測並洗鍊舊版誤寫死為 `STR(E) INT(E)` 的裝備，立即恢復專屬主屬性與隨機副屬性。
- **[Feature/System/UI] 統一全域戰敗休養 CD（4 天）與實裝傭兵忙碌/休養中全操作鎖定防呆（2026-08-22）**：
  - **戰敗休養 CD 統一大一統 (`DispatchSystem.ts` & `GameLoop.ts`)**：將外出討伐戰敗與領地受襲重傷的休養時間全面統一為 **4 天**（`restingDaysLeft = 4`），徹底解決舊版討伐戰敗僅設定 1 天且在換日結算時被即時歸零導致看似無 CD 的時序缺陷。
  - **傭兵忙碌全面鎖定防呆 (`PartyModalController.ts`)**：凡是處於 `DISPATCHED`（派遣中）、`RESTING`（休養中）或 `CAPTURED`（被俘虜）的傭兵：
    - 🔒 **裝備更換/卸下鎖定**：裝備槽位呈半透明鎖定樣式，點擊彈出 Warning Toast「⚠️ 該傭兵正在任務/休養中，無法更換或卸下裝備！」。
    - 🔒 **自由屬性配點鎖定**：加點與減點按鈕隱藏/禁用，下方顯示紅色提示「🔒 傭兵目前處於任務/休養中，無法分配屬性點」。
    - 🔒 **進階轉職與退休鎖定**：轉職與退休按鈕置灰禁用，防止戰場上隔空轉職與退休。
  - **改造所來源防呆 (`ModificationWorkshopController.ts`)**：改造所的冒險者裝備來源僅展示 `IDLE` 閒置中傭兵的裝備，外出中傭兵裝備不可隔空改造。
- **[Fix/UI] 修正街道懸賞欄按鈕層級（z-index: 20），避免覆蓋領主書房等建築室內視圖（2026-08-22）**：
  - 將 `#btn-street-bounty` 的層級調整至街道層（`z-index: 20`，低於 `.facility-view` 的 `z-index: 50`），確保進入領主書房、謁見廳、酒館或鍛造屋時，按鈕正常被建築視圖遮蔽，不再遮擋書房左上角的「⬅ 返回街道」按鈕。
- **[Feature/UI] 優化街道視圖懸賞欄入口：僅保留左上角快捷按鈕（2026-08-22）**：
  - 移除街道建物滾動列中的告示板佔位地標，保留純淨的街道建築風貌。
  - 保留街道左上角常駐按鈕（`#btn-street-bounty`），在街道畫面上隨時一鍵開啟全功能懸賞 UI。
- **[Fix/DataStore/Equipment] 修復 DataStore 載入裝備庫時遺漏 combatEffects 導致武器物攻/防禦未生效的缺陷（2026-08-22）**：
  - **根本原因**：裝備工坊將固定數值儲存於 `combatEffects`，但 `DataStore.ts` 僅讀取了 `baseCombatEffects`，導致生成實體與舊存檔中的裝備遺失了 `patk: 8`、`pdef: 4` 等戰鬥效果，畫面上只顯示了六維屬性 `CON+3`。
  - **修復機制**：在 `DataStore.ts` 中加入 `item.baseCombatEffects || item.combatEffects` 雙向相容讀取，並在 `SaveManager.ts` 自動對齊中補齊現有裝備缺失的 `combatEffects`，重新整理讀檔後鐵盾長劍立刻正確顯示 `⚔️物攻+8 | 🛡️物防+4 | ✨魔防+2 | 💥爆擊+5% | CON+3`。
- **[Architecture/Equipment] 實裝裝備「單一真實來源」一勞永逸全域自動同步機制（2026-08-22）**：
  - **存檔讀取全自動同步 (`SaveManager.autoSyncAllEquipmentWithTemplates`)**：在讀取存檔時自動遍歷傭兵身上與領地倉庫內的所有裝備實例，只要模板在 JSON 或裝備工坊中被改名/更新圖標，讀檔瞬間 100% 全自動對齊最新名稱與屬性，徹底告別舊存檔殘留舊名稱的問題。
  - **鍛造配方動態關聯 (`ForgeUIController` & `EquipmentStudio`)**：鍛造屋與工坊配方名稱改為動態優先讀取目標裝備/素材的最新官方名稱（`targetTpl.name`），修改裝備名稱後配方名稱自動即時生效。
  - **同步修訂配方庫**：將 `CraftingRecipes.json` 中的 `recipe_wooden_shield_sword` 同步更正為「鐵盾長劍」。
- **[Fix/EquipmentStudio] 修復裝備工坊卡片屬性數值為 0 時被誤覆蓋為階級保底數值的缺陷（2026-08-22）**：
  - 將卡片屬性渲染邏輯中的 `||` 運算子全面重構為 `??`（Nullish Coalescing），解決純物理武器（如斬馬劍）魔攻設為 0 時被錯誤覆蓋為 30 的問題，恢復 100% 精確的真實數值與戰力計算。
- **[Fix/Forge/Icons] 修復附魔台五大元素附魔石與破敗傳家寶劍圖標連結（2026-08-22）**：
  - **五大元素附魔石圖標對接 (`ForgeUIController.ts`)**：將附魔台選擇石框體的硬編碼 Emoji（🔥❄️⚡☀️🌙）替換為 `materials.json` 中的正式素材圖集代號（`icons_materials_30` ~ `icons_materials_34`），完美呈現高解析度附魔晶石。
  - **破敗傳家寶劍圖標對接 (`DataStore.ts` & `IconSpriteHelper.ts`)**：移除舊版寫死的單一 Emoji `🗡️`，使其正常對接武器 Sprite 切片（T1 巨劍），並支援全域階級邊框。
- **[Fix/UI/Icons] 修復自訂圖標裝備全域階級邊框（T1~T4/藍框）與品質角標遺失問題（2026-08-22）**：
  - **全域階級品質邊框包裹 (`renderEquipIcon`)**：在 `IconSpriteHelper.ts` 的 `renderEquipIcon` 入口為所有設定了 `eq.icon` 的自訂裝備自動包裹專屬的階級容器（`equip-custom-icon-wrap`），包含對應階級發光邊框（如 T3 藍色 `#3b82f6`、T4 紫色 `#a855f7`）與右下角 `T3` 品質文字角標。
  - **全介面外觀完全統一**：徹底消除自訂圖標裝備與預設裝備外觀樣式不一致的瑕疵。
- **[Feature/Fix/CombatStudio] 英雄設計工坊六維排版重構與誓約守衛原創設定全面對齊（2026-08-22）**：
  - **六維屬性排版重構（3x2 網格）**：
    - 將六維屬性由擁擠的單行 6 欄改為寬裕的 **3 欄 x 2 列（`repeat(3, 1fr)`）**，輸入框設定 `box-sizing: border-box; width: 100%`，徹底解決 STR/AGI/CON/INT/SPR/LUK 溢出彈窗面板邊界的問題。
    - 加入六維屬性總點數即時計算徽章（`#hc-total-stats`）。
  - **誓約守衛原創體系全面對齊 (`OathCreationController`)**：
    - **20 款專屬男女守衛立繪連動**：切換為誓約守衛時，肖像選單自動列出「銀髮雄獅騎士 (2/10)」、「金髮璀璨聖騎 (1/10)」等具體立繪名稱，並生成正確圖標代號（如 `guardian_m_1`），徹底修復舊有包裹 📦 破圖問題。
    - **誓約守衛 5 大專屬特質**：整合 `GUARDIAN_LOYAL`（忠誠護衛）、`GUARDIAN_PRUDENT`（沉著參謀）、`GUARDIAN_VALIANT`（熱血戰魂）、`GUARDIAN_DEVOUT`（堅毅信仰）、`GUARDIAN_SCOUT`（敏銳斥候）與通用特質選單。
- **[Fix/CombatStudio] 修復英雄設計圖標自訂儲存與讀取優先級（2026-08-22）**：
  - **讀取優先級修正 (`getAllHeroes`)**：修正預設英雄修改後被靜態程式碼覆蓋的問題，優先讀取 `customHeroesDb` 中的最新自訂圖標與數值。
  - **卡片點擊換圖標全鏈條寫入**：於英雄大盤卡片直接點選頭像更換圖標時，自動複製並推入本機儲存庫（`localStorage: MEDIEVAL_CUSTOM_HEROES`），徹底解決重繪後還原的問題。
- **[Feature/CombatStudio] 英雄設計工坊圖標系統升級（Hero Studio Universal Icon Support）（2026-08-22）**：
  - **英雄定義擴充 (`UniqueHeroDef`)**：新增 `avatarIcon?: string` 欄位，支援全圖集通用圖標（誓約騎士、神話英雄、職業精靈圖或自訂代號）。
  - **英雄創造/編輯彈窗視覺化升級 (`#modal-hero-creator`)**：
    - 頂部加入 48px 頭像預覽框，點擊直接開啟【全圖集通用圖標選擇器】。
    - 支援手動輸入自訂圖標代號或即時點選挑選。
  - **英雄大盤與挑選器視覺升級**：
    - 英雄大盤卡片清單與英雄挑選器展示高解析精靈圖標（`renderUniversalIcon`）。
    - 支援在英雄大盤卡片上直接點擊頭像快速更換圖標。
  - **沙盒與戰場全鏈條連動**：套用英雄時，專屬圖標即時連動至沙盒左側卡片與戰鬥擂台動畫。
- **[Feature/CombatStudio] 實裝怪物特技自訂配置器（Monster Skill Configurator）（2026-08-22）**：
  - **右側怪物卡片即時配置**：怪物技能標籤欄新增「⚙️ 配置」按鈕，點擊立即開啟【✨ 怪物特技配置彈窗 (`#modal-monster-skills`)】。
  - **全特技庫分類與搜尋挑選**：
    - 支援即時搜尋關鍵字（技能名稱/說明/效果）。
    - 完整呈現 50+ 款物理戰技、奧術魔法、暗影刺殺、神聖祈禱與怪物專屬特技，支援即時查看 MP 消耗與詳細說明。
    - 單一怪物最多可自訂配置 4 招特技，支援 `✕` 一鍵卸除與 `＋` 加入。
  - **戰鬥即時生效**：配置後於單場戰鬥動畫播放與 100 場蒙地卡羅極速模擬中即時依 AI 權重釋放指定特技。
- **[Feature/Fix/CombatStudio] 戰鬥工坊深度體驗優化：獨特英雄鎖定、全品項換裝彈窗、單一UR防呆、戰鬥定位與排版修復（2026-08-22）**：
  - **獨特英雄身分保護 & 誓約守衛自由轉職**：
    - 獨特英雄（如 UR 赤焰戰神雷恩、SSR 霜語大魔導露娜）在沙盒卡片中將品質與職業選單鎖定為專屬唯讀徽章，保護傳奇身分。
    - 誓約守衛（`isGuardian: true`）與一般傭兵維持完整下拉選單，可自由測試 17 大職業與 N~UR 各階數值。
  - **裝備與飾品「全品項庫選擇」＋ 圖標與 Tooltip 懸浮說明**：
    - 徹底升級換裝彈窗（`#modal-equipment-editor`），支援從武器庫（30+ 款各職業神兵）、防具庫（重甲/皮甲/布袍）與飾品庫（11+ 款專案飾品）具體挑選品項。
    - 換裝介面即時連動 48px 精靈圖標（`renderUniversalIcon`）與詳細戰鬥數值/詞條 Tooltip 摘要。
    - 卡片上的 3 格裝備欄位同步展示品項真實名稱與 Tooltip。
  - **單一 UR 全鏈條防呆**：
    - 卡片切換品質為 UR 或在挑選器選用 UR 英雄時，若隊伍已存在其他 UR 傭兵，即時警告並阻擋。
  - **怪物 8 大戰鬥定位與技能標籤恢復**：
    - 右側陣容卡片恢復戰鬥定位選單（`⚖️ 常規均衡`、`🛡️ 鐵壁肉盾`、`⚡ 疾風刺客`、`🔮 奧術法師`、`🩸 嗜血狂戰`、`🏹 遠程狙擊`、`💀 亡靈泥沼`、`👑 史詩首領`）與特技標籤清單。
  - **介面排版修復與精簡**：
    - 調整據點情境列樣式（`min-width: 0`, `flex-shrink: 0`），徹底解決「🎲 隨機遭遇」按鈕被擠壓切掉問題。
    - 移除沙盒右側重複的「➕ 創造單位」按鈕，保持介面簡潔乾淨。
- **[Fix/CombatStudio] 修復戰鬥工坊切換分頁沙盒佈局損壞與右側怪物頭像動態解析（2026-08-22）**：
  - **Grid 三欄佈局保護**：修復 `switchStudioTab` 將沙盒視圖 `#cs-view-battle` 誤設為 `flex` 的問題，恢復原生 `display: grid`（`340px 1fr 340px`），確保標籤頁往返切換時三欄排版完好穩定。
  - **怪物圖標全鏈條動態連動**：實作 `getMonsterAvatar` 統一大圖標解析器，於敵方陣容卡片、戰鬥擂台即時狀態、預設遭遇與切換怪物原型時，100% 自動連動母庫 `monstersDb` 的 `avatarIcon`（8x8 精靈圖），消除舊 Emoji 覆蓋與圖標遺失問題。
- **[Fix/CSS] 修復 combat-studio.css 血條類別選擇器語法錯誤（2026-08-21）**：
  - 補齊遺漏的 `.cs-hp-fill` 選擇器宣告，消除 IDE CSS 語法報錯。
- **[Fix/Studio] 完整補齊「怪物資料庫與設計工坊」分頁渲染、卡片編輯、寫入磁碟與搜尋過濾（2026-08-21）**：
  - 修復切換至「👾 怪物資料庫與設計工坊」分頁時遺漏呼叫 `renderMonsterDatabase()` 的問題。
  - 完整恢復 64+ 隻怪物卡片流動網格渲染、即時搜尋過濾、怪物新增/編輯彈窗與寫入磁碟按鈕事件。
- **[Fix/Studio] 修復英雄工坊卡片縱向排版擠壓與左側傭兵「選英雄」點擊委派（2026-08-21）**：
  - **卡片樣式修正 (`.cs-hero-card`)**：新增專屬縱向 flow-column 佈局，解決原先套用怪物橫向 flex 導致卡片內資訊被擠壓成單行長條直立的問題。
  - **點擊委派全覆蓋**：將「👤 選英雄」、英雄套用、編輯、刪除及挑選等按鈕全面納入全域事件委派，確保動態渲染卡片後 100% 正確響應彈窗。
- **[Feature/Studio] 實裝「英雄與傭兵設計工坊 (Hero Studio)」與左側傭兵欄一鍵挑選英雄（2026-08-21）**：
  - **👑 英雄與傭兵設計工坊 (`CombatStudio.ts` & `combat-studio.html`)**：
    - 比照怪物工坊建立專屬英雄大盤視圖，支援品質（`N~UR`）與職業篩選、關鍵字即時搜尋。
    - **英雄創造/編輯彈窗 (`#modal-hero-creator`)**：支援自訂尊號、全名、品質、性別、基礎職業、滿等轉職狀態、立繪體系（一般 25 款 vs 誓約男女 20 款）、六維極限配點、專屬神裝（附魔/強化）與歷史傳記。
  - **👤 左側傭兵欄一鍵選英雄 (`#modal-hero-picker`)**：
    - 我方傭兵 1~5 號卡片頂部新增「👤 選英雄」按鈕。
    - 點擊開啟英雄挑選器，分類呈現預設神話英雄（UR 雷恩）、傳奇法師（SSR 露娜）、存檔誓約守衛與自訂英雄庫。
    - 點擊「選用此英雄」即可**一鍵全自動配裝、設定屬性、品質、等級、立繪與職業**，亦可自由在卡片上手動微調。
- **[Feature/Hero] 實裝唯一傳奇傭兵 (Unique Adventurers) 名冊與戰鬥工坊誓約騎士聯動（2026-08-21）**：
  - **唯一神話與傳奇傭兵範本 (`src/data/UniqueAdventurers.ts`)**：
    - 👑 **UR【赤焰戰神】雷恩·瓦倫泰 (Reyn Valentine)**：Lv.10 滿等狂戰士、STR 45 / CON 30 極限輸出、穿戴 T4 +7 隕鐵巨劍（🔥烈焰附魔）、皇家重鎧與狂暴暴擊徽章。
    - ❄️ **SSR【霜語大魔導】露娜·星輝 (Luna Starfall)**：Lv.10 滿等大魔導士、INT 42 / SPR 26 極限法攻與回魔、真理之眼 100% 必中、穿戴 T4 +5 賢者法杖（❄️冰霜附魔）、大法師法袍與智慧墜飾。
    - 🛡️ **UR【神聖誓約騎士】(Sacred Oath Guardian)**：Lv.10 滿等聖騎士、CON 38 / SPR 22 鋼鐵壁壘、穿戴 T4 +7 皇家聖騎士劍盾（✨聖光附魔）、皇家重鎧與神聖十字架，具備 `isGuardian: true` 並套用 5x5 誓約男女大圖集。
  - **戰鬥工坊誓約騎士神聖隊預設 (`CombatStudio.ts` & `combat-studio.html`)**：
    - 在左側小隊預設下拉選單中加入「👑 誓約騎士神聖隊 (我的誓約騎士)」。
    - 動態聯動機制：若玩家存檔中已有誓約守衛，自動讀取玩家的誓約騎士（名稱、職業、裝備、立繪與數值）擔任 1 號隊長；若無則自動生成 UR 神聖誓約騎士。
  - **密技快捷召喚 (`CheatController.ts` & `docs/CHEATS.md`)**：
    - 新增鍵盤盲打指令：`addur` (召喚赤焰戰神)、`addssr` (召喚霜語大魔導)、`addoath` (召喚誓約騎士)。
  - **單元測試全綠通過 (`UniqueAdventurers.test.ts`)**：
    - 22 個測試檔案 79 項單元測試 100% 通過。
- **[Feature/Combat] 實裝戰前檢查與全鏈條防呆：每場戰鬥/隊伍最多只能編入 1 位 UR 品質傭兵（2026-08-21）**：
  - **派遣與出征編隊 UI (`DispatchModalController` & `TradeController`)**：
    - 即時選取攔截：點擊或拖曳選取 UR 品質傭兵時，若隊伍中已存在 UR 傭兵，即時彈出 Toast 提示並阻擋加入。
    - 出征前二次校驗：點擊確認出發時再次嚴格稽核，超過 1 位 UR 傭兵則阻止派遣。
  - **底層系統防線 (`DispatchSystem`)**：
    - `dispatchAdventurers` 加入硬性防線，確保任何任務隊伍中的 UR 傭兵數 `<= 1`。
  - **戰鬥工坊模擬沙盒同步 (`CombatStudio`)**：
    - 調整預設陣容符合單一 UR 限制；在單場戰鬥播放與蒙地卡羅極速模擬前加入品質檢查與彈窗提示。
  - **模型擴充與單元測試**：
    - `Adventurer.quality` 完整支援 `'N' | 'R' | 'SR' | 'SSR' | 'UR'`；新增單元測試驗證 UR 派遣阻擋。
- **[Fix/Template] 徹底清除 `ui-chrome.html` 中重複注入的 `combat-modal` 殘留 `VS` 標籤（2026-08-21）**：
  - 排查發現 `ui-chrome.html` 內包含舊版 `#combat-modal` 副本，導致運行時覆蓋 `modals-combat-trade.html` 中的最新結構。
  - 徹底移除 `ui-chrome.html` 中的重複定義，確保 `modals-combat-trade.html` 為單一真實來源，完全移除戰場中央的 `VS`。
- **[Feature/CombatUI] 戰鬥框體比例重構（70% 史詩舞台）、移除 VS 與戰場開闊對峙空間優化（2026-08-21）**：
  - **超大比例舞台 (70%)**：戰鬥舞台高度擴大至 `500px`，文字戰報區收斂至約 `120px`，戰鬥回放沉浸感大幅倍增。
  - **戰場開闊對峙留白**：移除中央的 `VS` 標籤，兩側隊伍各自固定 `320px` 靠左/靠右，中央自然釋放 `~250px` 的開闊對峙衝鋒戰場。
  - **卡片規格精準對齊**：卡片定為 `84px × 112px`（1:1.33 經典卡牌比例），金黃光暈外框與沉浸式滿版置頂肖像。
- **[Fix/CombatUI] 戰鬥單位卡片等比例還原與九宮格間距呼吸感優化（2026-08-21）**：
  - **還原 1:1 原始比例**：實作 `.combat-p-avatar-sq` 內部居中容器，徹底消除因非正方形卡片容器導致的精靈圖水平拉伸失真，100% 還原冒險者油畫肖像五官與肩膀真實比例。
  - **精緻直立規格與呼吸空間**：卡片尺寸定為 `88px × 108px`（直立式滿版卡牌），九宮格間距放大至 `gap: 14px`，前後排陣型更分明、排列更富層次感。
- **[Feature/CombatUI] 戰鬥單位卡片升級為 Full-Art 滿版卡牌式架構（2026-08-21）**：
  - **滿版卡牌設計（比照傭兵卡片）**：徹底取消內層縮小的頭像小框框，整張卡片主體 100% 由大尺寸油畫立繪 / 8x8 寫實怪物肖像滿版填滿。
  - **頂部懸浮名稱遮罩**：半透明黑底遮罩漸層浮動展示單位名稱與「前/中/後」站位標籤，清晰大氣。
  - **底部懸浮血條遮罩**：沉底懸浮嵌入 HP 平滑血條與 MP 魔力條。
  - **單一高品質外框**：我方金黃光暈外框、敵方猩紅光暈外框，視野飽滿且沉浸感大幅提升。
- **[Tweak/CombatUI] 遊戲本體戰鬥模態框重播舞台比例擴大與戰報文字精緻收斂（2026-08-21）**：
  - **視窗與舞台擴大**：戰鬥模態框擴大至 `960px × 720px`，上方重播動畫舞台高度提升至 `420px`（佔比 ~60%）。
  - **大尺寸主視覺頭像**：單位卡片頭像框擴大至 `58px × 58px`（怪物圖標尺寸提升至 `52px`），寫實油畫肖像與金屬外框細節更加大氣鮮明。
  - **戰報區域精緻化**：下方文字戰報區高度收斂，字體精巧縮小至 `0.8rem`（行高 `1.45`），聚焦重播動畫視覺焦點。
- **[Feature/Combat] 遊戲本體與戰鬥工坊戰鬥播放 UI 重構與動態打擊升級（2026-08-21）**：
  - **📐 單位顯示結構重構**：
    - **上方（Top）**：單位名稱（字體適中清晰 `~0.72rem`，我方金黃、敵方淺紅，右側標記前後排小標籤）。
    - **中央（Center）**：主視覺大肖像（`44px` 金屬邊框，敵方怪物全面連動 8x8 寫實油畫精靈圖，冒險者使用精緻油畫）。
    - **下方（Bottom）**：緊湊平滑的 HP 紅綠血條與 MP 藍色魔力進度條。
  - **💥 打擊感與動態反饋升級**：
    - 受到傷害時觸發受擊卡片震顫（`hit-shake`）與閃紅（`hit-flash`）；暴擊時觸發震撼全屏震動。
    - 施放技能時施法者頭像閃耀元素光暈（`skill-cast-glow`）；陣亡時觸發灰階暗化（`is-dead`）。
  - **⏩ 播放速度擴充**：支援 `1x` (1000ms)、`2x` (450ms)、`3x` (180ms) 快速切換與瞬間結算。
  - **🔄 全域 100% 同步**：遊戲本體戰鬥模態框（`CombatUIManager`）與戰鬥工坊對抗擂台（`CombatStudio`）佈局與特效完全一致。
  - **🧪 測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 綠燈。
- **[Fix/CombatStudio] 戰鬥工坊敵軍陣容、遭遇小隊與戰鬥擂台動態連動怪物母庫 8x8 精靈圖（2026-08-21）**：
  - 實作 `getMonsterAvatar`，徹底取代原本寫死的 Emoji（如 🟢、👺），使敵軍遭遇小隊、據點守將、敵軍卡片原型切換與戰鬥擂台即時狀態 100% 動態連動 `monsters.json` 母庫中的 `icons_monsters` 8x8 寫實精靈圖標。
- **[Feature/CombatStudio] 戰鬥工坊「👾 怪物資料庫與設計工坊」與唯一真實來源 (SSOT) 上線（2026-08-21）**：
  - **👾 全景怪物卡片檢視與設計工坊**：
    - 戰鬥工坊頂部新增雙模式切換 Tab（【⚔️ 戰鬥模擬沙盒】與【👾 怪物資料庫與設計工坊】）。
    - 支援 70 款怪物全景卡片瀏覽，具備關鍵字搜尋、種族（魔物/亡靈/人類/龍族）、地形（8大地形）與 Boss 標籤即時過濾。
    - **一鍵綁定圖標**：點擊卡片頭像即時呼叫圖標選擇器（支援全新 8x8 45度角寫實怪物精靈圖），直接綁定至怪物母庫。
    - **新增與自訂怪物**：提供「➕ 新增怪物設計」與「✏️ 編輯怪物屬性」完整彈窗，可自訂 ID、名稱、powerTier、元素、相容種族、出沒地形與專屬技能。
  - **💾 唯一真實來源 (SSOT) 寫入專案硬碟**：
    - 點擊「💾 寫入專案硬碟 (monsters.json)」，一鍵將所有怪物圖標與屬性改動永久持久化至 `src/data/monsters.json`，並自動建立時光機備份快照。
  - **🧪 測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 通過。
- **[Refactor/DataStore] 裝備與飾品資料庫「唯一真實來源 (SSOT)」確立與二手商店圖標同步（2026-08-21）**：
  - **🔒 確立單一真實來源**：在 `DataStore.ts` 移除 `EquipmentDB` 中重複且過時的 `secondHandShopDataJson.accessories` 覆蓋邏輯，裝備庫原型由 `equipment_weapons`、`equipment_armors`、`equipment_accessories` 三大權威庫獨佔初始化。
  - **💍 二手商店動態同步**：`DataStore.SecondHandShopDB` 自動與 `equipment_accessories.json` 合併最新屬性與 `2_icons_materials` 精靈圖標，解決鍛造屋與二手商店飾品圖標退化為舊 Emoji 的問題。
  - **🧪 測試**：全庫物件連結掃描 100% 有效，21 個測試檔案 74 項單元測試全數通過。
- **[Bugfix/Forge & UI] 領地鍛造屋與倉庫全域素材圖標解析器升級（2026-08-21）**：
  - **🖼️ 全面接入 `renderUniversalIcon`**：
    - 徹底修復 `ForgeUIController.ts`（素材冶煉清單、產出物大圖、所需素材格子、重鑄書、附魔石、拆解返還材料、強化材料庫與交易品）將圖標標識碼作為純文字輸出導致出現 `icons_materials:xxx` 跑版的問題。
    - 不論素材使用 Emoji 還是 Sprite 精靈圖標，皆能自動適配並在各介面維持高畫質置中渲染。
  - **🧪 測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 通過。
- **[Feature/EquipmentStudio] 裝備工坊資產防誤刪「🔒 上鎖 / 🔓 解鎖」保護機制上線（2026-08-21）**：
  - **🔒 全資產一鍵鎖定切換**：
    - 素材清單、消耗道具、裝備與飾品原型、鍛造配方卡片右上角全面支援 `🔒/🔓` 鎖定切換按鈕。
  - **🛡️ 刪除誤觸攔截與防護**：
    - 處於上鎖狀態 (`isLocked = true`) 的卡片，其刪除按鈕 `✕` 自動轉為半透明禁用樣式，點擊時彈出防護提示並主動攔截刪除操作，徹底避免設計成果誤刪。
  - **💾 狀態持久化維護**：
    - 上鎖狀態同步納入 JSON 資料庫、API 儲存與時光機歷史快照中。
  - **🧪 測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 通過。
- **[UI/EquipmentStudio] 裝備工坊隨機詞條抽取池 (Affix Pool) 全面繁體中文化與懸浮提示上線（2026-08-21）**：
  - **🎲 詞條名稱全面中文化**：
    - 將 `equipment_accessories.json` 與全裝備卡片詞條標籤全面轉為繁體中文標籤（`🎲 堅定`、`🎲 鋒利`、`🎲 嗜血`、`🎲 疾風`、`🎲 致命`、`🎲 破甲`、`🎲 奧術`、`🎲 冥想`、`🎲 全能`、`🎲 鐵壁`、`🎲 抗魔`、`🎲 格擋`）。
  - **💡 滑鼠懸浮說明提示 (Tooltip)**：
    - 裝備卡片上的詞條標籤支援 `title` 提示與說明字典（例如滑鼠懸浮【堅定】顯示「增加生命上限與基礎防禦」）。
  - **🧪 測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 通過。
- **[Feature/EquipmentStudio & DataStore] 專案既有飾品全量標準化收錄至裝備工坊與鍛造配方庫（2026-08-21）**：
  - **💍 11 款專案飾品全量標準化收錄 (`equipment_accessories.json`)**：
    - 將二手古董店 (`SecondHandShopData.json`) 專屬飾品與戰鬥系統常用飾品全量規格化：
      * `acc_brave_ring`【勇氣指環】(T1 戒指)
      * `acc_wind_amulet`【風行者護符】(T1 護符)
      * `acc_scholar_pendant`【學者智慧墜飾】(T1 吊墜)
      * `acc_guardian_medal`【守護者青銅勳章】(T2 勳章)
      * `acc_thief_band`【暗影夜行手鐲】(T2 手鐲)
      * `acc_holy_relic_cross`【神聖救贖十字】(T3 聖物)
      * `acc_ruby_ring`【紅寶石生命之戒】(T2 戒指)
      * `acc_sapphire_necklace`【藍寶石魔力項鍊】(T2 項鍊)
      * `acc_berserk_badge`【狂暴暴擊徽章】(T2 徽章)
      * `acc_gale_amulet`【疾風敏捷護符】(T2 護符)
      * `acc_holy_cross`【神聖祈禱十字架】(T2 聖物)
    - 補齊五階品質標籤、基礎六維屬性 (`baseEffects`)、戰鬥數值 (`baseCombatEffects`)、隨機詞條池 (`affixPool`)、獲取管道標記 (`craftable`, `droppable`, `shopBuyable`) 與背景風味描述。
  - **🔨 飾品鍛造配方連動 (`CraftingRecipes.json`)**：
    - 新增 7 款可鍛造飾品之加工配方，精確對齊素材庫 (`MaterialDB`) 之原料金錠、鋼錠、鐵錠、絲綢與元素附魔核心。
  - **🛠️ 裝備素材工坊即時呈現**：
    - 裝備工坊中欄篩選「💍 飾品」可完整檢視、編輯、自訂屬性與磁碟持久化。
  - **🧪 測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查與 P0 完整自動化測試 100% 通過。
- **[Feature/CombatSystem & MonsterProfiles] 怪物 8 大戰鬥定位 (Stat Profiles) 與全技能單一真相來源中樞 (Skill Registry) 實裝（2026-08-21）**：
  - **🏛️ 8 大戰鬥定位與總預算正規化演算法 (Normalized Stat Profiles)**：
    - 徹底解決舊版魔物數值同質化問題。在怪物總屬性預算（`baseBudget = difficulty * powerTier * raceMult * 55`）保持 100% 鎖死不破壞平衡的前提下，導入 8 大定位權重分配：
      * `🛡️ TANK (鐵壁肉盾)`：超高生命與物理防禦，守護前排。
      * `⚡ ASSASSIN (疾風刺客)`：先手高速高爆發與極致閃避。
      * `🔮 MAGE (奧術法師)`：高額魔法傷害與高魔防。
      * `🩸 BERSERKER (嗜血狂戰)`：極高物理輸出與適中生命。
      * `🏹 RANGER (遠程狙擊)`：高命中與專注後排壓制。
      * `💀 JUGGERNAUT (亡靈泥沼)`：超巨量生命與堅韌。
      * `👑 BOSS (史詩首領)`：全屬性均衡強化與霸體威壓。
      * `⚖️ BALANCED (常規均衡)`：經典標準配比。
    - 全面更新 `monsters.json` 48+ 款怪物配置專屬 Profile，並在 `MonsterSystem.ts` 完成動態屬性生成。
  - **🧠 單一真相來源技能中樞 (Skill Registry)**：
    - 建立 `src/systems/combat/SkillRegistry.ts`，作為專案內所有技能（包含傭兵基礎技能、進階職業技能、通用魔物技能與裝備特技）的唯一真相來源中樞。
    - 支援動態註冊與分類自動推導（`HERO_BASE` / `HERO_ADVANCED` / `MONSTER` / `EQUIPMENT`），避免雙重編碼維護問題。
    - 戰鬥系統 `CombatSystem.ts` 全面接入 `SkillRegistry` 進行 Smart Casting AI 技能判定與施放。
  - **👾 10 款通用魔物技能庫 (去特定化命名)**：
    - 依據無個體特徵綁定原則，新增：【劇毒噴吐】(`SKILL_TOXIC_SPRAY`)、【撕裂爪擊】(`SKILL_SAVAGE_REND`)、【粉碎重擊】(`SKILL_CRUSHING_SLAM`)、【嗜血打擊】(`SKILL_BLOOD_DRAIN`)、【尖嘯震懾】(`SKILL_TERROR_SCREECH`)、【暗影突襲】(`SKILL_SHADOW_ASSAULT`)、【烈焰轟爆】(`SKILL_FLAME_BURST`)、【冰霜吐息】(`SKILL_FROST_BREATH`)、【堅石甲殼】(`SKILL_IRON_DEFENSE`)、【狂暴怒吼】(`SKILL_FRENZY_ROAR`)。
  - **🛠️ 戰鬥平衡工坊 (`CombatStudio.ts`) 深度連動**：
    - 敵方陣容卡片與魔物創造器全面支援 8 大 Profile 切換、技能標籤清單管理與 Optgroup 分組技能快速掛載。
    - 戰鬥模擬即時依據 Profile 與 Skills 實例化怪物並計算戰鬥數值與 PowerScore。
  - **🧪 測試與驗證**：
    - 新增 `MonsterAndSkillSystem.test.ts`。
    - `npm run test:p0`（Typecheck + Vitest 74 項測試 + 平衡性測試 + 經濟模擬 + 煙霧測試）100% 綠燈通過。
- **[Feature/CombatStudio] 戰鬥平衡工坊圖標選擇器全面升級為 Universal Icon Picker（2026-08-20）**：
  - **🖼️ 視覺化全圖集通用選擇器**：與素材裝備工坊全面統一，動態載入 `custom_icon_datasets.json`，支援怪物、守衛、傭兵頭像、武器防具、素材及自訂圖集分頁。
  - **🎨 暗黑油畫圖標渲染**：傭兵隊伍卡片、敵方怪物卡片、戰鬥擂台血條頭像與怪物創造器預覽，全面支援 `renderUniversalIcon`。
  - **💾 雙向連動與持久化**：支援自訂代碼/Emoji 手動輸入與一鍵更換，保存時永久同步寫入專案魔物資料庫。
- **[Feature/EquipmentStudio & CoreSystem] 裝備工坊深度強化升級：獲取管道分流、六維屬性與隨機池、浮動數值區間、12+ 隨機詞條、動態多素材配方與雙技能接口（2026-08-20）**：
  - **🧠 全庫雙軌智慧判讀配方產出 (Smart Target Matcher)**：
    - 配方庫自動依序在【裝備庫 ➔ 素材庫 ➔ 道具庫】中精確比對產出目標。
    - 「提煉鐵錠」、「製作木板」、「提煉鋼錠」、「編織粗布」等素材加工配方，100% 正確顯示專屬素材油畫圖標並標記 `🧱素材提煉`。
    - 配方卡片頭像支援直接點擊調用圖標選擇器，同步連動更新目標產物之圖標；配方編輯彈窗產出目標全面支援三分類分組（`optgroup`）。
  - **👑 專案原生五階品質標準 100% 精確對齊**：
    - 全面校正工坊名稱與代表色：`T1 普通 (灰)`、`T2 精良 (綠 #10b981)`、`T3 稀有 (藍 #3b82f6)`、`T4 史詩 (紫 #a855f7)`、`T5 傳奇 (橙金 #f59e0b)`。
    - 完整補齊素材、裝備、篩選器與詞條參考表之 T5 傳奇數值標準（攻防 `+90~150`、生命 `+600~1000`、六維 `+16~25`、暴擊 `+18~25%`）。
  - **📦 獲取管道分流 (Acquisition Sources)**：
    - 在裝備資料庫與工坊編輯器中新增「☑️ 允許鍛造 (Craftable)」、「☑️ 允許掉落 (Droppable)」、「☑️ 允許商店販售 (Shop Buyable)」三大獨立開關。
    - 遊戲掉落池 (`EquipmentGenerator.ts`) 與城鎮商店 (`ShopController.ts`) 完美依據標記自動過濾，神兵與掉落遺物精確分流！
  - **💪 基礎六維屬性與隨機抽取池**：
    - 彈窗完整支援力量/敏捷/體質/智慧/精神/幸運 (STR/AGI/CON/INT/SPR/LUK) 固定值輸入與隨機抽取池勾選。
    - 裝備卡片即時呈現六維屬性標籤與獲取管道徽章。
  - **📊 戰鬥數值浮動區間 (Min ~ Max)**：
    - 支援輸入固定值或浮動區間（例如 `12~18`），實體生成時於區間內隨機 Roll 點。
  - **🎲 擴充 12+ 款隨機詞條庫 & T1~T5 數值參考表**：
    - 包含鋒利、奧術、致命、破甲、嗜血、堅定、鐵壁、抗魔、格擋、疾風、冥想、全能，並在介面附上 T1~T5 階級數值標準指示。
  - **🔨 鍛造配方動態多素材清單**：
    - 配方庫改為動態容器，支援一鍵「➕ 新增所需素材」與「✕ 移除」，不再限制 2 種素材，可自由組合任意數量素材。
  - **✨ 武器雙技能/特技接口**：
    - 預留 2 個技能槽位（技能 ID 與觸發機率 %），資料結構與實體生成完美相容。
  - **🎨 UI 排版美化**：
    - 彈窗寬度擴充至 720px，消除水平捲動條，介面整潔精緻。
  - **🧪 測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **[Feature/EquipmentStudio & IconStudio] 素材裝備工坊深度連動圖標工坊：全圖集視覺化選擇器與暗黑油畫圖標即時渲染（2026-08-20）**：
  - **🖼️ 視覺化全圖集通用選擇器 (Universal Icon Picker)**：
    - 工坊完全打通圖標工坊資料庫 (`custom_icon_datasets.json`)，自動動態掃描所有已註冊圖集（素材 `materials`、T1~T4 四階武器 `weapons`、防具 `armors`、設施 `facilities`、男女守衛 `guardians`、男女傭兵 `avatars` 及使用者新增的自訂圖集）。
    - 點擊卡片頭像即時開啟多分頁圖集面板，支援 48px 油畫縮圖、懸浮發光、中文名稱標籤與一鍵選用。
    - 保留「😀 常用 Emoji」分頁與「手動輸入自訂代碼」彈性（支援任意 Emoji 或 `category:id`）。
  - **🎨 全局油畫圖標統一渲染 (`renderUniversalIcon`)**：
    - 素材清單、消耗道具、裝備卡片、鍛造配方產出、素材消耗列表及編輯彈窗全面升級調用 `renderUniversalIcon`，告別純 Emoji 時代，全工作台呈現精美暗黑油畫質感！
  - **🧪 測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **[Refactor/Data] 裝備資料庫結構拆分 (weapons / armors / accessories) 與遊戲系統全域對接（2026-08-20）**：
  - **🗂️ 裝備資料庫三向解耦拆分**：
    - 將原本近 2,500 行的 `EquipmentTemplates.json` 正式拆分為三份獨立資料庫：`equipment_weapons.json`（武器 30 款）、`equipment_armors.json`（防具 12 款）與 `equipment_accessories.json`（飾品）。
    - 消除單檔龐大易衝突的問題，各模組容量可獨立無上限擴充數千件神兵與防具。
  - **🔗 遊戲核心資料庫無縫載入 (`DataStore.ts`)**：
    - `DataStore.EquipmentDB` 改為由三份獨立檔案與二手飾品庫統一組裝，對外 API 介面 100% 保持相容，零破壞性變更。
  - **💾 工坊 API 與持久化升級 (`vite.config.ts`, `EquipmentStudio.ts`)**：
    - `/api/get-equipment-studio-data` 與 `/api/save-equipment-studio-data` 支援三檔分流讀寫，儲存時自動依 `slot` 分流至各獨立檔案並同步維護鏡像備份。
    - 修復工坊讀取裝備清單時型別誤判為空的問題，既有 42+ 件裝備與鍛造配方 100% 完美載入。
  - **🧪 測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **[Feature/EquipmentStudio & CraftingLab] 裝備、素材、消耗道具與鍛造配方工坊正式上線（2026-08-20）**：
  - **🛠️ 三欄式可視化工作台 (`tools/equipment-studio.html`)**：
    - **左欄：素材與一般道具創造器**：支援素材庫與消耗道具（藥水、煙霧彈、磨刀石）分類切換、自訂階級 T1~T4、基礎價格、功能效果與 **📜 背景風味文字 (Flavor Lore)**。
    - **中欄：裝備與飾品設計器**：涵蓋 12 類武器、防具與飾品，支援**🎲 自訂隨機屬性詞條池 (Affix Pool)** 與 **📈 +10 強化曲線與戰力成長預覽**。
    - **右欄：鍛造配方實驗室**：自訂素材需求、金幣花費，並支援一鍵模擬鍛造試驗。
  - **🖼️ 全域圖標即時選擇器 (Icon Picker)**：素材、道具、裝備卡片圖標支援點擊彈出 30+ 款常用 Emoji 圖標池隨選即換。
  - **💾 Zero Data Loss 磁碟持久化與時光機備份**：一鍵永久寫入 `materials.json`、`items.json`、`EquipmentTemplates.json` 與 `CraftingRecipes.json`，並自動保留最近 20 份歷史快照。
  - **⌨️ 密技整合與頂部四合一導航**：遊戲內盲打 `equip` / `material` / `forge` 或控制台 `openEquipmentStudio()` 即時在新分頁開啟；頂部提供戰鬥/圖標/故事/裝備工坊快速切換。
  - **🧪 測試**：20 個測試檔案 70 項單元測試 100% 通過。

- **[Feature/CombatStudio & SkillEngine] 修正進階職業技能判定、接入真實品質資質演算法與怪物詳細戰鬥數值面板（2026-08-20）**：
  - **🔥 12 大進階職業技能掛載修復 (`CombatSystem.ts`)**：
    - 徹底修復職業名稱判定條件，全面改為家族判定（如大魔導士、死靈法師、狂戰士、神射手、聖騎士、暗殺者等皆能 100% 正確掛載基礎飛彈/猛擊與終極技能【隕石轟炸】、【旋風斬】、【神聖光輝】、【靈魂收割】）。
    - 告別「傭兵只會普攻」的窘境，戰報與模擬全面呈現華麗技能連擊與特效跳字！
  - **👑 真實品質資質演算法 (N / R / SR / SSR / UR)**：
    - 傭兵卡片六維基礎總合全面調用專案原生品質公式（N: 40, R: 55, SR: 70, SSR: 88, UR: 110）。
    - 切換品質時，六維屬性、HP/MP、物魔雙攻與戰鬥力評分**即時隨品質成長暴增**，完全具備實質數值功用！
  - **👾 敵方怪物即時數值面板 (Monster Stats View)**：
    - 怪物卡片底部即時展示真實計算之戰鬥數值：❤️ HP、⚔️ 攻擊、🛡️ 物防、✨ 魔防、⚡ 速度、💨 閃避與 🏆 戰力評分。
  - **🌊 遊戲核心多波次分階生成機制 (`CombatSystem.ts`)**：
    - 遊戲核心支援 `waveEnemyLineups?: MonsterInstance[][]` 每波獨立敵人名單，前置波次自動過濾 Boss，**Boss / 首領怪（`powerTier >= 2.0` / 👑）嚴格限定在最後決戰波登場**。
  - **🎲 大地圖隨機生態討伐遭遇**：
    - 工坊實裝 `[🎲 隨機遭遇]` 按鈕，自動依地形生態隨機生成多波次合法野生魔物討伐隊伍。
  - **📊 傭兵六維自由配點器與即時屬性面板**：
    - 實裝「六維屬性配點器（STR / AGI / CON / INT / SPR / LUK `－/＋`、未分配點數池、`⚡ 推薦配點`、`↺ 重置`）」。
    - 支援鍵盤盲打 `combat` 或 `battle` 立即在新分頁開啟「戰術遭遇與戰鬥平衡工坊」；控制台支援 `openCombatStudio()`。
    - 工坊頂部提供一鍵開啟圖標工坊 (`icon-studio.html`) 與故事工坊 (`story-studio.html`)。
  - **🧪 測試**：19 個測試檔案 66 項單元測試 100% 通過。

- **[Feature/IconStudio & SnapshotEngine] 圖集定義持久化 (Zero Data Loss)、自訂圖檔實體化、輕量化快照 (44KB) 與全域通用圖標渲染器實裝（2026-08-19）**：
  - **💾 圖集結構持久化寫入**：在 `src/data/custom_icon_datasets.json` 正式建立圖集定義庫，升級 `/api/save-icon-config` 與 `/api/get-icon-config`，自訂圖集（如 `npc`、`npc_man`）永久寫入專案磁碟，瀏覽器重開、快取清除 100% 永久存在。
  - **🪶 圖片實體化與快照體積縮小 500 倍**：上傳圖片自動抽取儲存為 `public/assets/custom_icons/` 實體圖檔，快照絕不夾帶 Base64，單檔由 1,720 KB 暴降至 44 KB，並實裝自動保留最近 20 份輪替清理機制。
  - **🌐 全域通用圖標渲染器 (`renderUniversalIcon`)**：在 `IconSpriteHelper.ts` 擴充通用渲染入口，100% 向下相容既有傭兵隨機頭像與裝備，支援以 `categoryKey:itemId` 在故事、待辦清單、對話、戰鬥中直接隨插即用渲染任何自訂圖標。
  - **🔒 現有圖標 100% 保留**：包含武器 T1~T4、防具、素材、設施、男女傭兵、誓約守衛等所有已微調座標與自訂圖集無損遷移。

- **[Feature/Narrative] 實裝決策選項消耗智慧檢查 (canAffordChoice) 與按鈕反灰禁用機制（2026-08-19）**：
  - **🔍 智慧消耗偵測**：自動掃描選項中的負數效果（金幣 `ADD_GOLD < 0`、特產 `GRANT_TRADE_GOOD < 0`、素材 `GRANT_MATERIAL < 0`），精確判定領地當前金庫與倉庫存量。
  - **🚫 條件不符按鈕反灰**：當玩家持有的特產/素材或金幣不足以支付選項消耗時，按鈕自動禁用（Disabled、半透明與禁行指標），並在按鈕旁以紅字明確提示 `⚠️ (缺少特產：香料 x1)` 或 `⚠️ (金幣不足)`。
  - **🛡️ 資源安全扣除**：在結算執行時安全扣除庫存，數量歸零時自動移除鍵，徹底杜絕負數或無本獲利問題。

- **[Fix/Inventory & Materials] 全面排查並修復倉庫幽靈物品、註冊 6 大職業轉職信物與存檔自動清洗遷移（2026-08-19）**：
  - **🧹 懸賞獎勵物品正規化**：修復 `BountySystem.ts` 舊版模板發放全大寫幽靈字串（`RAW_HIDE`, `GRAIN`, `MEAT`, `COTTON`, `STONE`, `IRON_ORE`, `WOOD`）並錯塞入 `materials` 的歷史問題；全面對齊標準特產（`tg_hide`, `tg_wheat`, `tg_meat`, `tg_cotton`）與素材（`mat_stone_brick`, `mat_iron_ingot`, `mat_wood_plank`）並正確歸入 `tradeInventory` 與 `materials`。
  - **📜 6 大職業進階轉職信物正規註冊**：在 `materials.json` 中正式註冊 `ADVANCE_WARRIOR`（狂怒之鋒）、`ADVANCE_MAGE`（秘法魔典）、`ADVANCE_ARCHER`（鷹隼之眼）、`ADVANCE_KNIGHT`（守護者之盾）、`ADVANCE_THIEF`（幽影之塵）、`ADVANCE_PRAYER`（信仰之證），具備專屬圖標、名稱與說明，徹底解決在倉庫隱形或無法辨識問題。
  - **🔨 鐵匠鋪素材取值修復**：修復 `ForgeUIController.ts` 使用 Array 取 key 導致永遠取到 `undefined` 且 fallback 成為泛用磁鐵方塊的 Bug。
  - **🔄 舊存檔自動清洗遷移 (Schema v5)**：在 `SaveMigration.ts` 實裝自動清洗機制，玩家載入舊存檔時會自動將歷史殘留的 `RAW_HIDE` 等幽靈物品無損遷移轉換為合法特產與素材。

- **[Feature/StoryStudio & TodoModal] 收錄既有事件為官方故事集、支援動態多選項、派系外交效果與領地待辦清單深度整合（2026-08-19）**：
  - **🏛️ 官方故事集全面收錄**：將原本硬編碼的事件轉換並建立三大官方主題故事集（`🏛️ 帝國政局與家族外交 story_feudal_politics`、`🌾 領地民情與突發事件 story_territory_folklore`、`📦 失蹤的商隊 story_missing_caravan`），全數可於故事工坊可視化編輯與測試。
  - **🔀 動態多選項分支支援**：突破原本 2 項選項限制，工坊升級為「動態增刪選項清單（`＋ 新增決策選項` / `🗑 刪除選項`）」，每個選項皆具備獨立按鈕文字、結果敘述、以及專屬的效果/獎勵清單。
  - **👑 派系外交效果與好感度條件**：新增 `CHANGE_FACTION_FAVOR`（洛斯加王室、沃爾蒙德大公、赫斯特神聖教廷、瓦萊里烏斯家族、莫凡恩商會好感度增減）與 `FACTION_FAVOR_AT_LEAST / AT_MOST` 及 `GOLD_AT_LEAST` 條件。
  - **📋 領地待辦事項 (`TodoModalController`) 深度整合**：遊戲端待辦清單支援讀取並渲染所有 `TODO_LIST` 故事卡片，支援多選項抉擇、Toast 結果提示與即時獎勵/外交結算。

- **[Feature/StoryStudio] 一體化三欄工作台、流程圖畫布縮放平移 (Zoom & Pan)、統整型隨機獎勵與待辦清單連動（2026-08-19）**：
  - **🚀 一體化三欄工作台**：將故事節點導航與 SVG 流程圖畫布整合至中欄核心區域；左欄為簡約故事庫清單（附關鍵字搜尋、啟用 🟢/草稿 ⚪ 狀態與節點計數）；右欄為即時屬性 Inspector，徹底告別頻繁跳頁。
  - **🗺 流程圖畫布手勢與視角升級**：
    - **滑鼠左鍵空白處拖動畫布 (Pan)**：點擊無節點之空白處直接平移畫布視角。
    - **滑鼠滾輪無級縮放 (Zoom)**：以滑鼠指標為錨點自由縮放 (0.3x ~ 2.0x)，並提供 `−` / `＋` / `1:1` / `🔍 適應全景 (Fit View)` 控制鈕。
    - **單擊節點 100% 保持在畫布視角**：點擊任一節點方框即時金色發光高亮並於右欄載入屬性表單，絕不強制跳轉分頁；牽線模式完成後亦保持在畫布上。
  - **🎁 統整型獎勵面板（隨機 vs 固定）**：
    - **裝備獎勵 (`GRANT_EQUIPMENT`)**：支援「固定模板」與「隨機生成（可自選部位：任意/武器/防具/飾品，以及品質階級：T1~T4 或任意）」，底層由 `EquipmentGenerator.generateByFilter` 動態隨機 roll 裝。
    - **素材與貿易特產**：支援「固定」與「隨機」生成模式。
  - **📋 領地待辦事項 (`TODO_LIST`) 管道支援**：新增 `TODO_LIST` 出現機制，故事節點可無縫分派至領地待辦清單中供玩家於主城書房審閱。

- **[Fix/CombatUI] 修復戰鬥重播誓約守衛頭像顯示錯誤問題（2026-08-17）**：
  - 修復戰鬥重播介面中，自訂誓約守衛（如金髮女騎士）頭像被誤當作普通女傭兵而顯示錯誤頭像的問題。
  - 在 `CombatParticipantState` 模型與 `CombatSystem.ts` 戰報組裝中加入 `isGuardian` 標記，並在 `CombatUIManager.ts` 渲染血條頭像時傳入 `isGuardian`，精確定位專屬守衛頭像圖集（`avatars_guardians.jpg`）。

- **[Fix/StoryTest] 修復故事測試模式未初始化 Phaser 地圖問題（2026-08-17）**：
  - 修復從故事工坊「強制測試節點」進入故事測試模式時，因未呼叫 `ensurePhaserLoaded()` 與 `renderMap()` 導致大陸地圖城鎮據點與道路未渲染（僅顯示羊皮紙底圖）的問題。
  - 在推進測試天數、強制觸發節點、模擬討伐勝敗與重置測試進度時，同步調用 `renderMap()`，確保動態生成的故事據點或解鎖地圖節點能夠即時在地圖畫布上繪製與更新。

- **[Feature/StoryStudio] Phase 3 — SVG 流程圖畫布（2026-08-17）**：
  - 新增第三個分頁「🗺 流程圖」，以純 SVG 繪製整條故事的節點流程，無需任何外部圖表函式庫。
  - 五種顏色編碼邊：🟡虛線（Fact 依賴）、🔵實線（排程 SCHEDULE_NODE）、🟢實線（討伐勝利）、🔴實線（討伐失敗）、🟣虛線（討伐途中事件）；每條邊帶箭頭標記，Fact 邊標示線索代號。
  - 節點卡片以純 SVG `<g>` + `<rect>` + `<text>` 組成，顯示 channel 標籤、標題、代號、條件數與效果數；點擊卡片即跳轉至「節點編輯」Tab 並選中對應節點。
  - 拖曳節點重新排版：mousedown/mousemove/mouseup 追蹤位移，拖曳過程即時更新邊路徑（只重繪邊層，不重繪節點），mouseup 後自動存入 `localStorage` 按故事 ID 持久化。
  - 牽線模式：點擊節點右側輸出埠（🟡圓點）進入牽線模式，工具列出現動態提示文字；再點擊目標節點自動新增 `SCHEDULE_NODE` 效果到來源節點，並跳轉回節點編輯 Tab 讓使用者確認參數。
  - 「🔀 重新排版」按鈕清除所有手動位置，重新以 4 欄網格自動排列。

- **[Feature/StoryStudio] Phase 2 — Smart Input 強化（2026-08-17）**：
  - `FACT_EXISTS / FACT_MISSING / DAYS_SINCE_FACT` 條件及 `SET_FACT` 效果的線索代號欄位，改為支援 `<datalist>` 自動補全，候選清單由 `buildSharedDatalists()` 在每次 `render()` 時從全部故事節點動態掃描產生，無需手動維護。
  - `SCHEDULE_NODE.nodeId` 改為同故事節點下拉選單，`CREATE_SUBJUGATION_NODE.victoryNodeId / defeatNodeId` 同樣改為下拉，徹底消除填錯 ID 的問題。
  - `GRANT_MATERIAL.itemId` 與 `GRANT_TRADE_GOOD.itemId` 加入 `<datalist>` 補全，候選來自 `DataStore.MaterialDB` 與 `TRADE_GOODS`。
  - 節點卡片新增角標：🟢 **✏ N 線索**（該節點設定幾個 Fact）、🔵 **← 被引用 N**（被多少個節點的 SCHEDULE / 討伐流程引用），讓設計者在卡片層就能掌握節點在故事中的角色。

- **[Feature/StoryStudio] Phase 1 — 線索登錄表 + 分頁 + 討伐累積條件（2026-08-17）**：
  - 引擎新增 `SUBJUGATION_COUNT_AT_LEAST` 條件類型：計算已勝利的動態討伐據點數（讀取 `subjugation:*:victory` fact），可作為故事推進前置，解決動態據點位置隨機無法用 ID 綁定的問題。
  - 故事工坊 UI 改為分頁式：**節點編輯**（原有三欄）、**線索登錄表**、**流程圖**（Phase 3 佔位）。
  - 新增全自動線索登錄表：即時掃描所有故事節點，建立 Fact 交叉引用索引（寫入者 / 讀取者），自動偵測四類警告：孤立線索（只設不用）、缺少來源（只用不設）、跨故事依賴、重複寫入；支援全局關鍵字搜尋；點擊引用項目可直接跳轉至對應節點的編輯面板。
  - `story-editor.html` 加入節點代號欄位的 placeholder 引導說明（`小寫英文＋底線`）與地圖節點 ID 欄位範例。

- **[Feature/Narrative] 獨立故事工坊與隔離式遊戲測試第一版（2026-08-17）**：
  - 新增資料驅動的 `NarrativeSystem`、故事條件／效果／線索狀態與存檔持久化，不再以固定 A→B→C 任務鏈限制故事順序。
  - 首批接通懸賞板、酒館傳聞、領地突發事件、探索發現、討伐結束與既有地圖故事據點解鎖。
  - 依照圖標工坊模式建立獨立 `tools/story-studio.html`；正式遊戲不提供編輯入口，正式 bundle 亦不包含工坊 UI/CSS/控制器。
  - 工坊可新增故事與節點、設定前置線索／延遲天數／玩家選項／結果、檢查結構、匯出 JSON，並透過 Vite 開發 API 寫入 `src/data/custom_stories.json`。
  - 每次寫入自動在 `src/data/story_backups/` 建立快照並保留最近 20 份，可從工坊檢視及還原。
  - 新增僅限開發環境的遊戲測試模式：由工坊把草稿與一次性代碼暫存在瀏覽器，再切換至獨立測試頁強制觸發節點、依正常條件檢查、推進 1／5 天或重置故事；測試模式固定不寫入正式存檔。
  - 正式執行期只讀專案故事 JSON；一般玩家的 LocalStorage 無法覆寫故事定義。
  - 新增開發密技 `story` 與控制台函式 `openStoryStudio()`，可比照 `studio` 指令從遊戲直接在新分頁開啟故事工坊；整套密技僅在 DEV 註冊。
  - 為避免誤解，工坊將 `EXPLORATION` 顯示名稱改為「發現據點時」，並將 `STORY_NODE` 改為「解鎖預設故事據點」；只改介面文字，不變更資料代號與存檔相容性。
  - 條件、完成結果與玩家選項結果改為可新增多筆的清單，修復編輯含多個 `SET_FACT` 的節點會遺失隱藏效果問題。
  - 新增素材、貿易品、指定裝備及經驗池獎勵；工坊會檢查物品與裝備模板 ID。
  - 新增 `CREATE_SUBJUGATION_NODE`：可設定相對／固定位置、地形、難度、主題怪物、偵查需求、勝利移除、途中事件及勝敗分流。故事據點使用穩定 ID、可隨地圖存檔，且不受隨機動態據點五座上限影響。
  - `DispatchSystem` 在故事討伐任務每日推進時依序觸發途中節點，結算時依勝敗觸發指定後續；任務存讀檔會保留途中事件索引。
  - DEV 測試面板新增途中、勝利與失敗模擬，並顯示故事生成的討伐據點；完整操作見 `docs/STORY_STUDIO_GUIDE.md`。
  - 內建「失蹤的商隊」垂直示範，並新增 3 項故事條件、排程與重置測試；型別檢查、57 項單元測試與正式建置均通過。

- **[P0/Balance] 建立可重播的戰鬥與長期經濟驗證基準（2026-08-17）**：
  - Smoke Test 對齊誓約創角與序章流程，完整驗證新遊戲、探索、道路、每日推進、存檔及讀檔。
  - 修正怪物與 5v5 測試的舊資料欄位、難度基準與失敗退出碼；固定所有模擬亂數。
  - 新增普通／困難 30、180、360 天經濟模擬與 `docs/BALANCE_TEST_REPORT.md`。
  - 新增 `npm run test:balance`、`npm run test:economy`、`npm run test:p0` 驗證入口；未修改正式遊戲平衡數值。

- **[Tools/IconStudio] 圖標工坊支援「更換圖片來源」、「自訂圖集安全刪除」與「防誤刪一鍵復原」機制** (`tools/icon-studio.html`)：
  - **🖼️ 隨時更換大圖來源**：在自訂圖集標題旁新增「🖼️ 更換圖檔」按鈕，可直接更新圖檔路徑（如換上最新 `avatars_guardians.jpg`），無須刪除重調。
  - **🔒 系統內建圖集絕對保護**：武器、防具、男女傭兵與男女守衛等系統核心圖集顯示「🔒 系統內建圖集 (安全保護)」，鎖定禁止刪除，杜絕手滑風險。
  - **🛡️ 自訂圖集防誤刪雙重保護**：僅使用者自行建立的自訂圖集（如「事件NPC」）可刪除，且刪除時自動建立記憶體快照，頂部操作列即時亮起「↩️ 復原剛才刪除的圖集」按鈕，一秒無痛救回！
- **[Feature/Avatar] 誓約守衛立繪選擇擴充為男女各 10 款（共 20 款）** (`OathCreationController.ts`, `IconSpriteHelper.ts`, `custom_icon_config.json`, `tools/icon-studio.html`)：
  - **👨 男性守衛 10 款（Row 0~1）**：滄桑老兵隊長、銀髮雄獅騎士、忠誠青年侍從、金紋重甲將軍、神秘兜帽遊俠、狂怒戰斧勇士、莊嚴黑袍神官、堅毅歷戰傭兵、森林長弓獵手、全罩重裝步兵。
  - **👩 女性守衛 10 款（Row 3~4）**：金髮璀璨聖騎、聖潔修道神官、颯爽赤髮劍士、短髮英姿女騎、暗影兜帽俠女、紫袍秘術法師、宮廷貴族女爵、夜行黑皮刺客、雙辮長弓射手、重裝板金女戰。
  - **🔄 羊皮紙創角契約全面支援**：羊皮紙創角介面提供 1/10 ~ 10/10 自由輪播切換，全域介面 100% 保持 1:1 正方形等比立體呈現！
  - **🛠️ 圖標工坊預載 20 格條目**：`icon-studio.html` 分頁同步擴充為 10 款男守衛與 10 款女守衛，支援獨立調整與磁碟寫入！
- **[Assets/Avatar] 生成 1:1 正方形 5×5 誓約男女守衛大圖集 & 全局接入** (`avatars_guardians.jpg`, `IconSpriteHelper.ts`, `custom_icon_config.json`, `tools/icon-studio.html`, `OathCreationController.ts`)：
  - **🖼️ 25 格暗黑油畫 1:1 正方形頭像圖集**：
    - **Row 0（第 1 排，男性誓約守衛）**：滄桑老兵隊長、銀髮雄獅騎士、忠誠青年侍從、金紋重甲將軍、神秘兜帽遊俠。
    - **Row 1（第 2 排，男性勇士夥伴）**：狂斧戰士、黑袍神官、歷戰傭兵、森林獵手、全罩重裝步兵。
    - **Row 2（第 3 排，特殊中立英雄）**：國王領主、奧術秘法大導師、金髮女將軍、黑袍暗影刺客、歷戰騎士。
    - **Row 3（第 4 排，女性誓約守衛）**：金髮璀璨聖騎、聖潔修道神官、颯爽赤髮劍士、短髮英姿女騎、暗影兜帽俠女。
    - **Row 4（第 5 排，女性英雄夥伴）**：紫袍秘術女法師、貴族宮廷女公爵、暗夜黑皮甲女刺客、雙辮綠袍女射手、重裝板金女戰士。
  - **📐 100% 徹底消除拉伸變形**：整張大圖天然為 1:1 正方形，每個頭像在 500% 500% 縮放下寬高比 100% 鎖死，五官端正大氣，徹底告別長條拉伸與只拍到頭髮的問題！
  - **🛠️ 工坊與設定檔無縫整合**：圖標工坊 `icon-studio.html` 與 `custom_icon_config.json` 預載 Row 0 (男) 與 Row 3 (女) 座標，選取框天然為 1:1 正方形，支援一鍵存檔！
- **[Refactor/Avatar] 誓約守衛頭像指定範圍完全統一為一般傭兵標準 5x5 規格** (`IconSpriteHelper.ts`, `custom_icon_config.json`, `tools/icon-studio.html`)：
  - **📐 統一座標規格 (5x5 體系)**：誓約男守衛 (`guardian_male`) 與女守衛 (`guardian_female`) 的頭像計算邏輯、縮放比率 (`500% 500%`)、欄列座標 (`col: 0~4, row: 0~4`) 與偏移微調 (`bgX, bgY, zoom`) 完全比照一般傭兵標準。
  - **📝 專案配置檔預填條目**：在 `src/data/custom_icon_config.json` 預置了男女各 5 款守衛的 `guardian_m_0~4` 與 `guardian_f_0~4` 基礎條目，使用者可直接手動或透過圖標工坊編輯。
  - **🛠️ 圖標工坊 100% 完美對齊**：[tools/icon-studio.html](file:///i:/gameproject/Medieval/tools/icon-studio.html) 內建「🛡️ 誓約男守衛」與「🛡️ 誓約女守衛」分頁，拉框、平移、8 向縮放與一般傭兵操作手感完全一致，並支援直接「💾 寫入專案硬碟」！
- **[Fix/Story] 誓約守衛頭像等比例修復、基礎職業名稱回歸、全域立繪對齊與劇情轉場點擊優化** (`OathCreationController.ts`, `AdventurerCard.ts`, `PartyModalController.ts`, `IconSpriteHelper.ts`)：
  - **🖼️ 徹底消除頭像壓扁變形**：重構 `IconSpriteHelper` 守衛立繪渲染為 `background-size: 500% auto` 寬高比等比例居中鎖定，頭部不再受上下拉伸壓扁，神采英拔。
  - **⚔️ 職業名稱回歸基礎名稱**：創角介面職業名稱全面回歸「戰士、騎士、弓手、法師、盜賊、祈禱者」，並 100% 精準對齊 `DataStore.JobDB` 核心資料庫。
  - **🎭 遊戲全域守衛立繪正確讀取**：修復 `AdventurerCard` 與 `PartyModalController` 漏傳 `isGuardian` 導致進遊戲變回普通老頭傭兵的重大 Bug，所有介面 100% 呈現所選守衛高顏值立繪。
  - **🎬 劇情黑幕播放結束後才允許點擊進入**：黑幕轉場調整為所有文字逐段淡入完畢（約 4 秒）後，底部提示才亮起並允許點擊進入荒野，並新增右上角「⏩ 略過劇情」按鈕供快速跳過。
- **[Feature/Story] 實裝「誓約守衛」羊皮紙創角契約、專屬立繪、開局黑幕電影感劇情轉場與領主傳家劍安全鎖** (`OathCreationController.ts`, `modals-game.html`, `MainMenuController.ts`, `IconSpriteHelper.ts`, `DataStore.ts`, `SecondHandShopController.ts`, `ForgeUIController.ts`)：
  - **📜 羊皮紙契約創角彈窗**：新遊戲選擇難度與種子後，展開復古羊皮紙風格的【誓約之卷】，玩家可自由客製化命名、切換性別、挑選 6 大職業（戰士/騎士/神射手/大魔導/暗殺者/大主教）與 5 大誓約性格。
  - **🖼️ 10 款專屬誓約守衛立繪生成**：
    - **男性 5 款 (`avatars_guardian_male.jpg`)**：銀髮貴族騎士、忠誠青年侍從、滄桑老兵隊長、神秘兜帽遊俠、聖殿學者神官。
    - **女性 5 款 (`avatars_guardian_female.jpg`)**：英氣金髮女聖騎、溫柔修道侍女、颯爽赤髮女劍士、冷艷紫袍女術士、靈動暗影俠女。
  - **🎭 5 大誓約獨特性格**：忠誠護衛、沉著參謀、熱血戰魂、堅毅信仰、敏銳斥候（自帶溫和實用的戰鬥與經營加成，並隔離於一般酒館招募庫）。
  - **🎬 電影感黑幕文字劇情轉場**：確認立誓後進入全黑轉場，逐段優雅浮現父親領地淪陷、臨終託付佩劍與守衛隨主角流亡荒野點燃營火之開局敘事。
  - **🔒 領主傳家劍 (Family Heirloom Sword) 防賣防拆安全鎖**：守衛開局隨身佩戴家族傳家劍，可自由卸下/裝備，但嚴格鎖定二手店典當（不可出售）與鐵匠鋪（不可拆解摧毀），並彈出專屬守護提示。
- **[Assets/Weapon] 生成 T2/T3/T4 武器 12 宮格圖集 & 實裝四階武器動態外觀切換** (`icons_weapons_t2_12.jpg`, `icons_weapons_t3_12.jpg`, `icons_weapons_t4_12.jpg`, `IconSpriteHelper.ts`, `tools/icon-studio.html`)：
  - **⚔️ 36 款全新進階與神兵武器暗黑油畫美術生成**：
    - **T2 高級武器 (`icons_weapons_t2_12.jpg`)**：精鋼巨劍、彎刃雙劍、寶珠法杖、鋸齒戰鐮、複合長弓、精靈長弓、刺客短刃、紫晶魔戒、鋼盾長劍、符文方盾、鍍金福音書、尖刺戰鎚。
    - **T3 專家武器 (`icons_weapons_t3_12.jpg`)**：霜焰波刃巨劍、龍首大馬士革雙刀、鈷藍古木大魔導杖、黑曜死翼戰鐮、鐵木重弓、月華精靈弓、毒牙幽冥匕首、雷霆真視之戒、金獅皇室盾劍、秘術符文壁壘、太陽聖輝啟示錄、審判烈焰戰鎚。
    - **T4 史詩神兵 (`icons_weapons_t4_12.jpg`)**：滅世熔岩屠龍巨劍、星穹虛空神刃、星系奇點世界樹權杖、湮滅死神龍骨戰鐮、不死鳥烈陽神弓、蒼穹極光精靈神弓、日蝕深淵嗜血雙刃、永恆星環之眼、太陽神王不朽盾劍、泰坦始源金符壁壘、終焉救贖啟示真典、諸神黃昏滅世雷神鎚。
  - **🔄 全局階級動態外觀匹配**：`renderWeaponSpriteHtml` 依據裝備的 Tier 階級（T1/T2/T3/T4）自動切換載入對應階級的專屬 12 宮格大圖，進階裝備外觀肉眼可見地霸氣蛻變！
  - **🎨 萬用工坊完整預載**：[tools/icon-studio.html](file:///i:/gameproject/Medieval/tools/icon-studio.html) 同步預載 T1、T2、T3、T4 四大武器分頁，支援獨立裁切與「💾 寫入專案硬碟」！
- **[Assets/Armor] 生成 4×3 防具圖集 `icons_armors_12.jpg` & 實裝布甲/皮甲/重鎧全階級圖標渲染** (`icons_armors_12.jpg`, `IconSpriteHelper.ts`, `tools/icon-studio.html`, `custom_icon_config.json`)：
  - **🛡️ 12 款防具裝備暗黑油畫美術生成**：
    - **Row 1 (布甲 CLOTH T1~T4)**：粗布長袍、學徒法袍、魔導法袍、大賢者神聖法袍。
    - **Row 2 (皮甲 LEATHER T1~T4)**：輕皮甲、獵手皮甲、斥候暗影皮甲、刺客龍鱗皮甲。
    - **Row 3 (重鎧 HEAVY T1~T4)**：鏈甲、鐵胸甲、皇家獅心板金鎧、聖殿騎士光輝神鎧。
  - **⚙️ 全局防具渲染管線接入**：`IconSpriteHelper` 實裝 `renderArmorSpriteHtml` 與 `ARMOR_SPRITE_COORDS`，所有穿戴、掉落、商店、鍛造與倉庫的防具皆自動匹配專屬 12 宮格高清圖標。
  - **🎨 萬用工坊預載支援**：[tools/icon-studio.html](file:///i:/gameproject/Medieval/tools/icon-studio.html) 內建預載「🛡️ 防具 (4x3)」分類，支援自由拉框、8 向縮放與「💾 寫入專案硬碟」！
- **[UI/Forge] 鍛造/重鑄配方清單全面接入 `renderEquipIcon` 統一圖標渲染管線** (`ForgeUIController.ts`)：
  - **🛡️ 消除殘留 Emoji**：修復鍛造左側配方清單與基底裝備槽仍殘留 ⚔️ / 🗡️ 符號的問題，全面改為調用 `renderEquipIcon(targetTpl, ICON_SIZE.SM)` 與 `renderEquipIcon(baseTemplate, ICON_SIZE.MD)`，完整呈現武器外觀與貼圖。
- **[Fix/UI] 緊急修復 `ICON_SIZE` 模組 Import 缺失異常** (`ForgeUIController.ts`, `InventoryUIController.ts`, `ModificationWorkshopController.ts`, `SecondHandShopController.ts`, `EquipModalController.ts`, `PartyModalController.ts`)：
  - **🐛 解決裝備欄/倉庫/鍛造所崩潰**：修復上述 6 大控制器在引用 `ICON_SIZE` 時未正確自 `ShopController` 導入，導致瀏覽器執行期拋出 `ReferenceError` 的問題；全模組補齊導入，經 TypeScript 靜態分析與單元測試 100% 驗證通過。
- **[Tool/Persistence] 實裝 Vite 本地寫檔 API 與「時光機歷史快照回溯系統」** (`vite.config.ts`, `custom_icon_config.json`, `IconSpriteHelper.ts`, `tools/icon-studio.html`)：
  - **💾 一鍵直寫專案硬碟檔案**：在 `vite.config.ts` 開闢 `/api/save-icon-config` 與 `/api/get-icon-config` 端點，工坊點擊「💾 寫入專案硬碟」即可直接永久更新 `src/data/custom_icon_config.json`，徹底擺脫純 LocalStorage 易被清除的痛點。
  - **⏳ 歷史快照時光機 (Time Machine)**：每次點擊寫入硬碟時，伺服器自動在 `src/data/icon_backups/` 建立帶時間戳記的快照；在工坊點擊「⏳ 歷史快照回溯」即可列出所有歷史版本並一鍵無損還原。
  - **🔄 雙向智能讀取**：遊戲端 `IconSpriteHelper` 優先讀取 LocalStorage 即時微調，若無則自動回退讀取專案磁碟檔案作為單一真相來源。
- **[UI/DesignSystem] 全遊戲圖標尺寸規範化與 3 級制標準化 (Design Tokens)** (`IconSpriteHelper.ts`, `ShopController.ts`, `InventoryUIController.ts`, `PartyModalController.ts`, `EquipModalController.ts`, `ForgeUIController.ts`, `SecondHandShopController.ts`, `ModificationWorkshopController.ts`, `tools/icon-studio.html`)：
  - **📐 最佳化收斂 3 大標準尺寸常數 `ICON_SIZE`**：
    - **🟢 LG (焦點展示 - 68px)**：角色裝備欄、裝備更換視窗、鍛造/重鑄主特寫、改裝工作臺焦點展示。
    - **🟡 MD (標準卡片 - 58px)**：倉庫背包道具卡片（極致飽滿霸氣，完美填滿卡片）、二手店卡片、鍛造配方清單卡片。
    - **🔵 SM (緊湊行內 - 32px)**：商店商品購買清單、附魔石清單、材料消耗表格。
  - **🛡️ 消除碎片化數字與排版安全性**：全專案消除混亂數字，所有卡片容器與邊距 1:1 精準適配，既消除多餘留白，又保證全局不破版。
  - **🎨 工坊預覽同步**：`tools/icon-studio.html` 同步對齊 32px / 58px / 68px 三大實機標準尺寸即時預覽。
- **[Tool/Studio] 全面升級為「萬用圖標工作台 (Universal Icon Studio)」& 實裝男女傭兵 5×5 頭像校準體系** (`tools/icon-studio.html`, `IconSpriteHelper.ts`, `AdventurerCard.ts`, `PartyModalController.ts`, `CombatUIManager.ts`)：
  - **🚀 零代碼限制的自主擴充架構**：
    - **➕ 自助新增任意圖集 (New Sprite Sheet)**：支援直接在介面輸入任意分類名稱、上傳本地任意大圖 (PNG/JPG/WebP/DataURL)，並設定任意宮格尺寸（如 5×5、6×4、4×4、NxM），自動生成子項目與選取框。
    - **📝 自助管理項目**：支援為任何分類隨意「➕ 新增項目」、「✏️ 重新命名」與「🗑️ 刪除項目」。
    - **📥 完整備份與還原 (JSON Import/Export)**：支援一鍵下載完整配置 JSON 備份檔與隨時貼上還原。
  - **👨👩 男女傭兵 5×5 (25位) 頭像預載與遊戲連動**：
    - 內建預載「👨 男傭兵頭像 (5×5)」與「👩 女傭兵頭像 (5×5)」，可直接在工坊中拖拉方框校準 25 位男女傭兵的五官置中與特寫比例。
    - 支援為特定編號傭兵上傳獨立高解析立繪（自動轉 DataURL 覆寫）。
    - 遊戲端 `AdventurerCard`（卡片與名冊）、`PartyModalController`（出征編隊）與 `CombatUIManager`（戰鬥即時頭像）全數接入 `getAvatarSpriteStyle` 統一渲染管線，點擊「⚡ 套用」即刻無縫同步！
- **[Fix/Icon] 武器圖標映射修復 & 專屬「圖標工坊 (Icon Studio)」視覺化微調工具** (`IconSpriteHelper.ts`, `tools/icon-studio.html`, `CheatController.ts`)：
  - **🛡️ 劍盾等武器 Enum 映射修復**：修正 `WEAPON_SPRITE_COORDS`，補齊 `SWORD_AND_SHIELD`（劍盾）、`RUNE_SHIELD`（符文盾）與 `HAMMER`（戰鎚）等核心 Enum Key，徹底解決劍盾等武器誤 fallback 至「大劍」貼圖的問題。
  - **🎨 專屬「圖標工坊 (Icon Studio)」獨立工具** (`tools/icon-studio.html`)：
    - **全視覺化滑鼠拉框裁切**：支援原圖上自由拖曳移動選取框、8 向控制把手縮放。
    - **鍵盤 1 像素微調**：支援 `↑` `↓` `←` `→` 鍵進行 1px 極限微移（`Shift + 方向鍵` 5px 加速）。
    - **60fps 實機品質框 Live 預覽**：支援 38px / 48px / 64px 尺寸與 T1~T5（普通、精良綠、稀有藍、史詩紫、傳奇金）外框與光暈即時渲染。
    - **單圖上傳轉內嵌 (DataURL)**：支援拖曳單張 PNG/JPG/SVG 圖片，直接轉為 Base64 內嵌圖標。
    - **雙向接口連動**：支援「⚡ 套用至本機遊戲 (LocalStorage)」、「📋 匯出 TypeScript 配置代碼」與「📦 匯出裁切獨立 PNG」。
  - **🌿 資源與素材擴充架構**：`IconSpriteHelper` 擴充 `renderResourceIcon` 統一入口，棉麻 (`cotton`)、生皮 (`hide`)、粗布、皮革等既有 Emoji 資源可隨時透過圖標工坊升級為專屬貼圖，未設定時安全 fallback。
  - **🧙‍♂️ 開發快捷指令**：遊戲內鍵盤輸入 `studio` 密技或控制台輸入 `openIconStudio()` 即可一鍵在新分頁開啟圖標工坊。
- **[Feudal/Civic] 正式實裝「領地規模與爵位 100% 雙向咬合體系」&「四大生產設施升級」** (`types.ts`, `Territory.ts`, `BalanceData.ts`, `TownManagementSystem.ts`, `MapNodeSystem.ts`, `UIManager.ts`, `views-facility.html`)：
  - **👑 爵位與領地規模門檻校準**：騎士/營地 (100)、男爵/村莊 (250)、子爵 (600)、伯爵/城鎮 (1200)、侯爵 (2500)、公爵/首都 (5000)。
  - **🌾 生產設施繁榮階梯與消耗**：荒野開放升至 Lv.2（消耗 100G 30木 15石），升級 Lv.2=+10, Lv.3=+25, Lv.4=+45, Lv.5=+70（產能 1.5x~3.0x）。
  - **🖥️ 極致緊湊 2 行卡片佈局**：書房/自宅面板重構為緊湊 2 行工種卡片，徹底消除滾動卷軸，預期收穫產量列（🍞糧 🌲木 🧱石 🔗鐵 🦬皮）清楚置底展示。
  - **📊 繁榮度即時單一真相來源**：繁榮度 = `當前人口 + 全體設施/建築固定分 + 道路/附庸加成 - 動態危險分`，徹底移除每月無上限空轉膨脹。
- **[Economy/Balance] 調降村民自產 6 大基礎素材定價，健全中前期跑商與經濟曲線** (`MarketSystem.ts`, `materials.json`)：
  - **抑制大宗原物料傾銷暴利**：調降棉麻 (15G➔4G)、生皮 (18G➔5G)、獸肉 (20G➔5G)、木材 (15G➔4G)、石材 (20G➔6G)、鐵礦石 (30G➔10G)。
  - **突顯高階特產暴利價值**：香料 (100G)、絲綢 (150G)、冰晶 (80G)、黑曜石 (90G) 維持高價值，確立「本地農林原物料薄利、遠洋稀有特產暴利」的深度商貿策略。
- **[Territory/Prosperity] 領地「受周邊危險影響」判定改為只針對探索產生的「動態討伐據點」** (`UIManager.ts`, `MapNodeSystem.ts`)：
  - **排除地圖固定練級點與中立據點**：不再因周圍存在固定的荒野或副本而誤判危險 Debuff。
  - **精準動態威脅機制**：只有在周圍 15 里內探索探測出「動態怪物巢穴 / 突發危險點（`isDynamic: true`）」時，才會亮起 `⚠️ 受周邊危險影響` 並扣減每月繁榮度；派遣傭兵隊將動態巢穴徹底平定清除後，警告與扣減即刻消除！
- **[Trade/UI] 跑商面板升級為「左側護衛編制 + 右側寬廣商貿」雙欄現代佈局** (`TradeController.ts`, `modals-combat-trade.html`)：
  - **👥 左側護衛傭兵池 (上限 5 人)**：採用與討伐編制一致的風格，卡片清晰呈現職業圖標、Lv、姓名、戰力⚔️、載重📦與議價💬加成，底部即時統計總戰力與總載重。
  - **💼 右側寬廣商貿策略區**：出發載貨與採購特產擁有充足寬度，支援**直接鍵盤輸入數字 + `[-10] [-] [+] [+10] [MAX] [0]` 快捷步進**，大宗貨物調度極致流暢。
  - **💰 實時現金損益與商路安全評估**：動態展示投入本金、預估賣出收入、採購花費與預期歸來現金淨損益。
- **[Combat/Element] 戰鬥系統全面升級「攻防分離雙元素」相剋架構** (`CombatSystem.ts`, `CombatMath.ts`, `Combat.ts`, `MONSTERS_AND_ELEMENTS.md`)：
  - **⚔️ 攻擊元素 (`atkElement`) 由「武器」主導**：傭兵手持火屬性武器🔥攻擊雷屬性魔物⚡時，精確觸發【火剋雷】**1.25x (125%) 剋制增傷**！
  - **🛡️ 防禦元素 (`defElement`) 由「防具」主導**：傭兵身穿防具之附魔元素決定其受擊時的防禦抗性與弱點相剋（如穿著霜冰鎧甲❄️抵禦火系怪物攻擊）。
  - **💎 雙重養成策略閉環**：武器附魔專注於**針對敵方弱點爆發輸出**，防具附魔專注於**針對副本怪物屬性進行防禦減免**。
- **[Feature/UI] 鍛造強化、元素加工附魔與裝備改造所新增「從傭兵身上」來源切換與就地升級** (`ForgeUIController.ts`, `ModificationWorkshopController.ts`)：
  - **三大養成功能全面支援雙來源**：在鍛造屋【裝備強化】、【元素加工附魔】與【裝備改造所】左側均加入 `📦 領地倉庫` 與 `👤 傭兵穿戴` 標籤按鈕，即時統計件數。
  - **傭兵穿戴專屬資訊**：卡片上清楚顯示穿戴者名稱、職業與槽位部位（例：`👤 亞瑟 (Lv.3 騎士) · 主手武器`）。
  - **就地升級/附魔即時生效**：強化、元素注入與改造直接作用於傭兵身上的裝備實例，面板屬性、元素相剋與綜合戰力即時同步更新，徹底省去脫裝與穿裝的繁瑣步驟。
- **[Feature/Building] 武器店轉型為「裝備改造所」** (`bld_weapon.png`, `ModificationRecipes.json`, `ModificationWorkshopController.ts`)：
  - **定位與形式**：專注於裝備屬性深造與客製化打磨，支援八維屬性追加（STR+1、AGI+1、CON+1、INT+1、SPR+1、LUK+1 等，每件上限 3 次）。
  - **物件卡片工藝工作臺**：左欄可分類挑選倉庫裝備，右欄展示目標裝備卡、改造次數進度與工藝方案卡片網格。
  - **外部配方接口**：建立獨立資料庫 `ModificationRecipes.json`，方便未來持續擴展技能屬性變更、詞綴鑲嵌等進階改造。
- **[Feature/Building] 防具店轉型為「裝備二手商」** (`bld_armor.png`, `SecondHandShopData.json`, `SecondHandShopController.ts`)：
  - **💍 稀有飾品貨架 (買進)**：物件卡片陳列當期隨機刷新的稀有飾品、戒指、項鍊與護符（勇氣之戒、風行者護符、學者智慧墜飾等），直接支援購買入庫。
  - **💰 二手裝備典當 (回收變現)**：物件卡片陳列倉庫閒置裝備，依 Tier 與強化等級折算回收金幣，支援單件變現與「⚡ 一鍵典當無強化 T1 基礎裝」便捷回收，徹底解決裝備堆積。
  - **外部商品接口**：建立獨立資料庫 `SecondHandShopData.json`，支援飾品池、刷新天數與回收折算係數自定義。
- **[System/Data] 街道建築與資料庫架構升級** (`DataStore.ts`, `views-main.html`, `views-facility.html`, `SceneController.ts`, `FacilityController.ts`)：
  - 街道建築標籤更名為 `🔧 裝備改造所` 與 `⚖️ 裝備二手商`，升級建築名稱隨等級動態演進（簡易打磨台 ➔ 工匠改造坊 ➔ 皇家改造所；雜貨回收攤 ➔ 典當行商營帳 ➔ 皇家珍寶典當閣）。
- **[Fix/View] 切換至世界地圖時建築視圖殘留問題修復** (`SceneController.ts`)：
  - 將 `returnToMap()` 與 `enterScene()` 改用通用選擇器 `document.querySelectorAll('.facility-view')` 批次移除 `active`，徹底解決進入裝備改造所或裝備二手商後直接點擊切換世界地圖時畫面未被關閉覆蓋的問題。
- **[UI/Road] 動態隨機據點隱藏「建造道路」按鈕** (`NodeDetailModalController.ts`, `RoadSystem.ts`)：
  - 探索周邊生成的臨時/動態巢穴據點（`node.isDynamic`）屬於隨機討伐點，直接隱藏「建造道路」按鈕，並於系統層面（`RoadSystem.checkTarget`）阻止對動態據點鋪設道路。
- **[Test] 自動化單元測試** (`ModificationAndSecondHand.test.ts`)：
  - 50 項單元測試 100% 通過（驗證改造配方、飾品庫、折算係數與買賣變現邏輯）。

## [2026-08-15] 傭兵裝備雙欄比較 Tooltip 與即時戰力變動預覽實裝 (Equip Comparison Tooltip & Power Delta)
- **[UI/Tooltip] 傭兵裝備選擇雙欄對比 Tooltip** (`ShopController.ts`, `EquipModalController.ts`, `style.css`)：
  - **精準雙重錨定**：由當前開啓武裝面板的 `currentAdventurer` 與開啟的槽位 `EquipmentSlot`（武器/防具/飾品）精確錨定，絕不錯置比對對象。
  - **頂部傭兵戰力即時預覽**：模擬置換裝備並調用 `adv.getPower()` 試算，頂部展示傭兵名稱、等級與戰力變化（例：`戰力評估：185 ➔ 210 (+25 戰力提升 🟢)`）。
  - **底層大框完美包裹（修復溢出）**：解除 `#adv-tooltip` 固定的 320px 限制，改為 `width: max-content; max-width: 520px;`，使外層底框 100% 精準包覆頂部戰力條與雙欄小框，徹底解決右欄突出缺角問題。
  - **武器與戰鬥屬性標籤防拆散換行**：為所有屬性（如 `⚔️AGI(S)`、`🔮INT(E)`、`⚔️物攻+10`）加上 `white-space: nowrap; display: inline-block;`，防止圖示與文字被中斷拆行。
  - **清爽雙欄並排佈局**：
    - 左欄【當前穿戴】：展示當前裝備的名稱、強化階級、Tier、元素、職業、戰鬥效果與武器補正（若為空則顯示未穿戴裝備）。
    - 右欄【選中裝備】：展示倉庫選中裝備之完整屬性。
    - 不冗贅添加底部差值字串，維持視覺純粹，把屬性取捨與判斷交給玩家。
- **[UI/UX] 浮動 Tooltip 智慧左翻邊界防溢出** (`FloatingPosition.ts`)：
  - 當雙欄 Tooltip 寬度較大且滑鼠位於螢幕右側時，自動向左翻轉在游標左側展開，絕不遮擋卡片或被螢幕邊緣切斷。
- **[Test] 自動化單元測試** (`ShopController.test.ts`, `FloatingPosition.test.ts`)：
  - 驗證單卡渲染、雙欄對比、戰力差值計算、空槽位處理與智慧邊界翻轉 100% 通過。

## [2026-08-15] 鍛造系統全階級配方補齊與「內政勞動產物全程大循環」實裝 (Forge Expansion & Civic Loop)
- **[Feature/Forge] 補齊 T1 基礎裝備鍛造配方** (`CraftingRecipes.json`)：
  - 補齊遺漏的 3 大基礎職業武器：`木盾長劍` (騎士)、`鐵匕首` (盜賊)、`祈禱手札` (祈禱者)。
  - 達成 6 大基礎職業武器（鐵大劍、木杖、短弓、木盾長劍、鐵匕首、祈禱手札）與 3 大防具（粗布長袍、輕皮甲、生鐵環甲）100% 基礎自給自足。
- **[Feature/Forge] 擴充 T2 高級與 T3 專家裝備鍛造配方庫** (`CraftingRecipes.json`)：
  - **T2 高級裝備（9 件）**：斬馬劍、學徒法杖、長弓、鋼盾長劍、獵人雙刃、福音書、學徒法袍、硬皮甲、鏈甲。全面採用「鋼錠邏輯」，純消耗領地人民（伐木/採礦/狩獵/農耕）所冶煉之初階與二級工藝素材（鋼錠、硬化皮革、精製絲綢、木板、粗布、磨刀石），無須跨區特產即可自給自足自製整套。
  - **T3 專家裝備（9 件）**：騎士巨劍、元素法杖、精鋼獵弓、塔盾長劍、暗影雙匕、主教聖典、祭司長袍、游俠皮甲、板甲。大量消耗內政素材（鋼錠x6~8、木板x6~8、硬化皮革x4~6、絲綢x3~4）並融入跨區特產與討伐素材（秘銀錠、冰晶、毒腺等）。
  - **T4 專用神兵重鑄（12 件，嚴格配方書隱藏機制）**：全數 12 件神兵（包含 6 大原生職業與 6 大變異職業）深度重構配方，維持大量內政工藝素材（鋼錠x10~12、木板x10~12、精製絲綢x6）+ 稀有 Boss 核心。並全面落實**「未取得對應重鑄書/卷軸道具或倉庫無前置 T3 裝備時完全隱藏」**機制，保持探索與掉落神秘感。
- **[System/Forge] 鍛造設施等級（Forge Level 1~3）階梯解鎖機制** (`EnhancementSystem.ts`, `ForgeUIController.ts`)：
  - **Lv 1 鐵匠鋪**：T1 基礎鍛造 + 基礎素材冶煉 + 強化最高 **+3**。
  - **Lv 2 工藝坊**：T2 高級鍛造 + 二級工藝素材冶煉 + 強化最高 **+6**。
  - **Lv 3 皇家鍛造所**：T3 專家鍛造 + T4 專用神兵重鑄 + 特種金屬冶煉 + 強化最高 **+10**。
- **[UI/Forge] 鍛造屋介面優化與階級標籤切換** (`ForgeUIController.ts`)：
  - 增加階級分類篩選標籤組（`全部` / `T1 基礎` / `T2 高級` / `T3 專家` / `T4 重鑄`）。
  - 強化面板動態標示設施名稱與上限（例：`當前設施：Lv.1 鐵匠鋪 (最高支援 +3 強化)`），超過上限時精確鎖定按鈕並提示升級。
  - 配方列表未達設施等級之項目明確標示 `🔒 需 Lv.X`，變異神兵未持有重鑄書時清楚標示鎖定狀態。
- **[Test] 自動化測試完整驗證** (`EnhancementSystem.test.ts`, `MaterialDB.test.ts`)：
  - 全數 50 個裝備與冶煉配方 100% 通過資料庫關聯與有效性校驗，設施等級強化上限阻斷邏輯 100% 測試通過。

## [2026-08-15] 大一統戰力計分公式與近郊自然生態據點重構 (Universal Power & Suburban Ecology)
- **[Feature/Combat] 大一統戰力計分公式實裝** (`Adventurer.ts`, `MonsterSystem.ts`, `ATTRIBUTE_SYSTEM.md`)：
  - **單一真相來源**：傭兵與怪物 100% 共用同一套客觀面板評估公式：$\text{Power} = \text{有效攻擊} + \lfloor\text{平均防禦} \times 0.6\rfloor + \lfloor\text{最大 HP} \times 0.2\rfloor + \lfloor\text{最大 MP} \times 0.1\rfloor + \lfloor\text{速度} \times 0.5\rfloor$。
  - **物魔有效攻防精準收斂**：有效攻擊採計 $\max(\text{PATK}, \text{MATK}, \lfloor\frac{\text{PATK} + \text{MATK}}{2}\rfloor)$，雙修職業（魔劍士、異端拷問官）不再虛胖，法系職業納入 MP 續航力評估。
  - **達成絕對對標**：徹底實現「戰力 60 vs 戰力 60 勢均力敵（3~4 回合勝負對抗）」。
- **[Balance/Combat] 怪物數值生成模型與戰利品重構** (`MonsterSystem.ts`, `MONSTERS_AND_ELEMENTS.md`)：
  - **告別紙糊數值**：修正難度 1 級標準怪數值（HP 75~85、ATK 24~26、DEF 8~12、SPD 6~8），杜絕開局個位數抓癢傷害。
  - **保留全部生態多樣性**：完美繼承 48 種怪物 `powerTier`（0.4~2.5）與 4 大種族特色（不死、魔物、人類、龍族），並依據難度階梯過濾怪物，避免新手在平原低難度遭遇高階野生龍族。
  - **戰利品收益校準**：金幣掉落對標 $\lfloor\text{Power} \times 1.0\rfloor$，經驗值掉落對標 $\lfloor\text{Power} \times 0.25\rfloor$（升級節奏健康拉長，1 級升 2 級約需 7 場討伐）。
- **[Feature/World] 領地近郊生態三階梯據點重構** (`MapEventSystem.ts`)：
  - **徹底消除脫裝漏洞**：移除依賴玩家當前脫裝戰力即時除算的漏洞，動態據點改為依領地近郊生態客觀生成：
    - 🟢 **50% 小型落單威脅 (難度 1，戰力 ~55~65)**：適合開局 1 人單挑。
    - 🟡 **35% 中型營地巢穴 (難度 2~3，戰力 ~110~160)**：適合 2~3 人小隊出征。
    - 🔴 **15% 稀有凶煞首領 (難度 3~4，戰力 ~180~220)**：Elite 挑戰首領。
- **[Feature/World] 動態據點 30 天威脅擴張與主題鎖定機制** (`MapNode`, `MapEventSystem.ts`, `MonsterSystem.ts`)：
  - **主題血統永久鎖定**：動態隨機據點（`node.isDynamic`）在首次偵查確立主題原型（如哥布林、狼群）後，永久記錄 `establishedBaseMonsterId` 與環境詞綴 `establishedAffix`，後續增援演進永遠保持同一種族部隊，絕不變異。
  - **30 天超期威脅擴張**：若玩家 30 天未清剿該動態據點，情報重新籠罩迷霧，難度自動升階（`baseDifficulty += 1`，最多擴張 2 次防呆），同種族增援擴編，戰力與戰利品同步提升。
  - **雙軌出征支援**：迷霧重現後，玩家可選擇重新花費派遣斥候摸清最新部隊陣容，亦可直接派遣傭兵「盲打強攻」迅速清剿！
- **[UI/Localization] 情報與派遣面板全中文化轉換** (`NodeDetailModalController.ts`, `DispatchModalController.ts`)：
  - 修復地圖詳細情報與派遣視窗中未中文化的列舉字串（如 `NONE` ➔ `無屬性`，`BERSERK_AURA` ➔ `狂暴光環 (攻擊提升)` 等）。
- **[Test] 建立自動化驗證測試腳本** (`scripts/test-dynamic-lair-expansion.ts`, `scripts/test-combat-power-scaling.ts`)：
  - 動態據點首次定型、30 天過期擴張、主題鎖定、上限防呆、固定據點免受影響與戰力對標 100% 通過。


## [2026-08-14] 動態戰力偵測與三階梯據點難度生成系統 (Dynamic Team-Power Lair Scaling)
- **[Fix/System] 修復探索據點無法偵測傭兵戰力問題** (`MapEventSystem.ts`, `Adventurer.ts`)：
  - 修正原代碼中 `Adventurer` 缺少 `power` 屬性導致戰力計算歸零、觸發難度保底刷出 800+ 戰力據點的致命 Bug。
  - 完整串接 `Adventurer.getPower()` / `power` getter，整合八維屬性與裝備攻防戰力加成。
- **[Feature/System] 動態人數與戰力雙重偵測 + 三階梯難度生成** (`MapEventSystem.ts`, `MonsterSystem.ts`)：
  - **人數雙重適應**：動態偵測玩家目前最強 $N$ 人戰力（$N = \min(5, \text{現有傭兵數})$）。剛開局 1 位傭兵時僅採計 1 人戰力（約 30~50），並限制怪物數量為 1~2 隻（以 1 隻為主），杜絕開局 1v5 群毆滅團！
  - **三階梯機率對標**：
    - 🟢 **50% 勢均力敵 (保底)**：據點戰力 $\approx 0.85 \sim 1.05 \times \text{小隊戰力}$（適合安全練等、賺取第一桶金）。
    - 🟡 **35% 越級挑戰**：據點戰力 $\approx 1.15 \sim 1.35 \times \text{小隊戰力}$（需講究陣型與元素剋制，高回報）。
    - 🔴 **15% 凶險精英**：據點戰力 $\approx 1.60 \sim 2.00 \times \text{小隊戰力}$（標記稀有挑戰，留待未來攻略）。
  - **低戰力怪物數量階梯化**：當據點戰力目標 $\le 65$ 時怪物數量上限為 1 隻，隨戰力逐階提升至 2~5 隻。
- **[Test] 建立自動化驗證測試腳本** (`scripts/test-dynamic-lair-scaling.ts`)：
  - 1人、3人、5人隊伍與戰力階梯測試 100% 通過。

## [2026-08-14] 酒館懸賞欄一鍵智能派遣與一鍵收取獎勵系統 (Bounty Board Auto-Dispatch & Claim All)
- **[Feature/System] 🍺 酒館【📜 懸賞欄】一鍵智能派遣與一鍵領取** (`BountySystem.ts`, `BountyModalController.ts`, `modals-game.html`)：
  - **懸賞欄置頂快捷操作列**：在酒館「📜 懸賞欄」彈窗的左側委託列表頂部新增 **「⚡ 一鍵派遣」** 與 **「🎁 一鍵領取」** 雙按鈕。
  - **一鍵派遣規則**：
    1. **高收益優先**：自動按懸賞獎勵金幣與經驗值降序（`gold + exp`）排序所有待接單委託。
    2. **受傷傭兵健康保護**：嚴格過濾 `HP < 30%` 的受傷傭兵，自動跳過保護隊員，將健康閒置傭兵一次性分派接單出征！
  - **一鍵領取規則**：批次結算所有已完成的懸賞委託，金幣、素材物品全數入庫，傭兵獲取經驗值並恢復 IDLE，彈出總收穫 Toast 提示。
- **[Test] 建立自動化驗證測試腳本** (`scripts/test-bounty-board-auto.ts`)：
  - 12 項單元測試 100% 通過（包含健康過濾、高收益優先、接單出征、批次領取結算與狀態回歸）。

## [2026-08-14] 3 大 Sprite Sheet 圖集系統與 IconSpriteHelper 整合 (Sprite Sheet Atlas System)
- **[UI/Art] 建立 3 大全景 Sprite Sheet 大圖集與映射架構** (`public/assets/`, `IconSpriteHelper.ts`, `ShopController.ts`, `InventoryUIController.ts`)：
  - **彩色 12 職業武器圖集 (`icons_weapons_12.jpg`)**：包含 12 種武器形態（巨劍、雙劍、法杖、戰鐮、長弓、魔法弓、雙匕首、魔環、劍盾、符文盾、聖典、戰鎚），支援動態 T1~T5 階級光暈外框與角標。
  - **羊皮紙木刻 12 設施建築圖集 (`icons_facilities_parchment_12.jpg`)**：古典中世紀羊皮紙與鋼筆木刻蝕刻風格，完美對標主城與街道沉浸感（酒館、鍛造屋、武器店、防具屋、書房政廳、防禦工事）。
  - **透明彩色鮮明 12 核心素材資源圖集 (`icons_materials_color_12_1.png`)**：純淨透明 Alpha 背景、高對比度的立體資源與素材圖示（金幣袋、木材、鐵錠、糧食拼盤、魔法藥水精華）。
- **[UI/Engine] 封裝 `IconSpriteHelper.ts` 渲染引擎與精準建築卡片**：
  - 對照角色卡片 (`AdventurerCard.ts`) 的 Sprite Sheet 做法，採用 CSS `background-size: 400% 300%` 與 `background-position: X% Y%` 精準映射。
  - **頂部與全域素材圖示加大放大**：將頂部 HUD `.res-sprite` 提升至 **36px**、倉庫素材圖標提升至 **42px**，強化立體光影與高辨識度。
  - **街道建築卡片完美對齊**：精確校準像素座標並輸出獨立羊皮紙建築卡片（`bld_tavern.png`, `bld_forge.png`, `bld_weapon.png`, `bld_armor.png`, `bld_defense.png`），徹底消除白邊與相鄰木框穿幫。
  - 全面升級武器店、防具店、裝備彈窗、鍛造屋、傭兵資訊面板與全域倉庫的圖示呈現。

## [2026-08-14] 祈禱者全生命週期治療量重構與終局對標 (Healer Balance & Endgame Calibration)
- **[Balance/Combat] 祈禱者治療公式全面重構** (`SkillData.ts`, `CLASS_SYSTEM.md`)：
  - **修復計算基數 BUG**：將原先僅讀取基礎屬性 `INT` 的錯誤公式，修正為正確讀取 **`MATK`（魔法攻擊力）**，使裝備法杖與聖典的法術加成 100% 作用於治療。
  - **基礎技能【治療術】**：基礎倍率定為 **160% MATK**（大主教聖典被動可達 **208% MATK**）。
    - 🟢 初期 (Lv.1)：單補從 18 點 $\rightarrow$ **56 點 HP**（拉回戰士 37% 血量，抵消怪 2~3 下普攻）。
    - 🔴 終局 (Lv.10 滿裝)：單補達到 **416 點 HP**，精準對標 750 HP 終局肉盾單體急救（拉回 >50% 血量）。
  - **大主教終極大招【神聖之雨】**：基礎倍率定為 **110% MATK**（含被動為 **143% MATK** 全體群補 + 全狀態驅散）。
    - 🟡 中期 (Lv.5)：全體群補從 39 點 $\rightarrow$ **127 點 HP**。
    - 🔴 終局 (Lv.10)：全體群補達到 **278 點 HP**，完全抵消高階 Boss 全屏 AOE 爆發。
  - **異端拷問官【終焉審判】**：全體副補調整為 **75% MATK**（終局約 120 HP）並回饋 **8% MATK MP**（終局約 12~15 MP）。
- **[Docs] 規範文件同步更新** (`CLASS_SYSTEM.md`)：
  - 更新祈禱者系技能具體倍率與機制說明。

## [2026-08-14] 怪物數值平衡校準與探索稀有挑戰據點系統 (Monster Balance & Elite Lair)
- **[Balance/Combat] 怪物戰力分與攻防屬性模型全面校準** (`MonsterSystem.ts`, `monsters.json`, `CombatSystem.ts`, `PassiveManager.ts`)：
  - **戰力分量綱對齊**：修正 `powerScore` 係數（`baseDifficulty * powerTier * raceMult * 12`），使 5 隻標準怪物的據點推薦戰力如實呈現為 **500~650 點**，精準對齊玩家 5 人 1 等傭兵隊伍（約 625 點）。
  - **怪物攻擊力重構**：調升傷害換算係數（`powerScore * atkRatio * 0.65`），使初期怪物普攻達到 25~35 點，對 30 防禦傭兵造成 **18~25 點實質威脅傷害**，告別個位數抓癢。
  - **怪物生命力調校**：生命公式調整為（`powerScore * hpRatio * 2.5`），讓同級怪物能承受 2~3 輪技能/普攻，戰鬥長度穩定維持在 3~4 回合。
  - **法系怪魔法傷害支援**：在 `monsters.json` 標記法系怪物（薩滿、幽魂、怨靈、狂熱者、元素石像、隨軍法師）之 `isMagicalAttacker: true`，普攻結算為魔法傷害並對應 MDEF 防禦。
- **[Feature/World] 探索周遭雙軌機制與稀有危險挑戰據點** (`MapEventSystem.ts`, `MonsterSystem.ts`, `DispatchModalController.ts`)：
  - **85% 常規日常據點**：提供平穩難度，適合 1 等新手練級與穩定農基礎資源。
  - **15% 稀有危險挑戰據點 (`isEliteLair`)**：
    - **難度大幅躍升**：難度為常規的 **1.8 ~ 2.4 倍**。
    - **首領駐軍**：保證高階精英怪/龍族領軍，100% 附加環境詞綴與元素變異。
    - **專屬冠名與情報**：冠上 `💀[凶兆]`、`👑[首領]`、`🔥[極危險]` 前綴與專屬危險警告。
    - **超額傳奇戰利品**：金幣與經驗值 **3 倍**，裝備掉落率保底 35%，高機率掉落藍紫色裝備或稀有圖紙。
- **[Docs] 規範文件同步更新** (`MONSTERS_AND_ELEMENTS.md`)：
  - 新增第五節詳細記載怪物數值生成模型與稀有挑戰據點機制規範。

## [2026-08-14] 詭術師技能與專屬被動重構 (Class Balance & Rework)
- **[Feature/Combat] 詭術師被動【幻影步伐】全面重構** (`PassiveManager.ts`, `CombatSystem.ts`, `Combat.ts`, `CombatMath.ts`)：
  - **有隊友時自身無敵**：當隊伍中尚有其他存活隊友時，詭術師處於絕對無敵狀態，完全免疫任何直接傷害（普攻、技能）、持續性傷害 (DOT) 與異常狀態（中毒、流血、破甲、感電、暈眩等）。
  - **無隊友時閃避加成**：當隊伍中沒有其他隊友或單人出戰時，無敵效果解除，自身獲得閃避率 +15。
  - **既有戰鬥機制保留**：普攻維持轉化為混沌傷害，突襲技能維持 50% 混沌傷害且可引爆中毒層數（每層增傷 10%）。
- **[Feature/Combat] 詭術師終極技能【欺詐魔術】重製** (`SkillData.ts`, `Combat.ts`, `CombatMath.ts`)：
  - 基礎傷害提升為 120% 混沌傷害（基於雙攻平均）。
  - **目標血量 >= 70%**：為我方全體隊員附加「閃避 +30」與「PATK +10%」Buff 一回合。
  - **目標血量 < 70%**：對目標直接附加 5 層中毒（持續 3 回合），並使詭術師自身獲得「PATK +30%」與「MATK +30%」Buff 一回合。
- **[Docs] 規範文件同步更新** (`CLASS_SYSTEM.md`)：
  - 同步更新職業規範文件中盜賊變異進階「詭術師」的專屬被動與終極技能敘述。

## [2026-08-13] 介面流暢度優化與活躍任務面板 (UI & UX)
- **[Feature/UI] 實作街道活躍任務面板** (`views-main.html`, `UIManager.ts`, `DispatchSystem.ts`)：
  - 在街道視圖 (Street View) 的右上角新增了精巧的「活躍任務 (Active Missions)」追蹤面板，無論是討伐魔物、懸賞任務還是商隊貿易，都會即時顯示任務名稱與剩餘回合數。
  - 面板內建高度限制與卷軸，並透過嚴謹的視圖判斷邏輯，確保只有在「純街道場景」時顯示，打開設施 (如酒館) 或回到世界地圖時會自動隱藏，維持畫面整潔不重疊。
- **[Bugfix/UI] 修正探險日誌排序與排版** (`AdventureLogModalController.ts`)：
  - 修復了探險日誌因疊加 `.reverse()` 導致顯示順序顛倒的問題，現在最新的探險紀錄會正確固定在列表最上方。
  - 微調並縮小了左側歷史清單的字體大小 (1.1rem -> 0.95rem)，使得長清單的視覺壓力減輕，排版更加精緻。
- **[Bugfix/UI] 系統選單自動關閉** (`GameFlowController.ts`)：
  - 優化操作體驗：點擊「手動儲存進度」後，系統選單現在會自動關閉，不需再額外點擊一次關閉按鈕。

## [2026-08-13] 介面優化與開發者工具擴充 (UI & Cheats)
- **[Bugfix/Combat] 修復技能擊殺不掉落戰利品 Bug** (`CombatSystem.ts`)：
  - 修復了長久以來的一項核心 Bug：當敵方魔物死於「傭兵技能」、「中毒」或「流血」時，因程式流程被中斷 (`continue` / `return`)，導致系統跳過結算該名敵人的死亡獎勵。
  - 將死亡與戰利品（金幣、經驗、裝備）結算邏輯統一抽離成 `processDeaths()` 方法，確保戰鬥迴圈無論在哪個階段造成擊殺，必定會正確結算獎勵，解決玩家「很多怪都不給獎勵」的困惑。
- **[Bugfix/Event] 修復盜匪勒索事件無限輪迴與關閉失效 Bug** (`ExtortionModalController.ts`)：
  - 修復了「盜匪勒索」彈出視窗在點擊按鈕後無法關閉（因錯誤使用 CSS 類別取代 inline style）的問題。
  - 移除了隱藏視窗時多餘的 `startGameLoop` 呼叫，徹底解決重複觸發導致時間無限加速、玩家無限遇襲的崩潰迴圈。
- **[Bugfix/UI] 修復懸賞欄無法顯示閒置傭兵 Bug** (`BountyModalController.ts`)：
  - 修復了因遺漏匯入 `AdventurerState` 導致在篩選閒置傭兵時發生 `ReferenceError` 錯誤，進而造成懸賞欄右側傭兵列表一片空白且無法派遣的嚴重漏洞。
- **[Feature/UI] 全域「裝備 Tooltip」一致性重構** (`ShopController.ts`, `EquipModalController.ts`, `PartyModalController.ts`)：
  - 徹底拔除各面板內手動硬寫的 HTML 裝備屬性字串，將全遊戲所有介面（包含裝備選擇清單、傭兵面板）的裝備 Tooltip 統一強制綁定呼叫 `getEquipTooltipHtml`。
  - 解決了「倉庫裡 Tooltip 有顯示打寶詞綴/Scaling，但裝備欄沒有」的脫鉤 Bug。
  - 根據風格設計，拔除生硬的「武器權責 (Scaling)」字眼改為「武器屬性」，並移除「物理/魔法」等冗長前綴字，使排版更精緻乾淨。
- **[Feature/UI] 全域「英雄頭像卡片 Tooltip」大一統** (`AdventurerCard.ts`, `UIManager.ts`, 等 5 個檔案)：
  - 將過去散落於主介面、酒館、派遣與探索面板中 5 種各自為政的英雄卡片 Hover 提示框，抽離整合為單一共用系統 `getAdventurerTooltipHtml`。
  - 現在全遊戲中任何英雄頭像懸停，都會**同時**完美顯示「英雄名稱/等級」、「總戰鬥力 (亮金色)」與「即時狀態 (如休養中亮黃色、閒置亮綠色)」。
- **[Feature/System] 擴充世紀帝國式鍵盤密技** (`CheatController.ts`, `CHEATS.md`)：
  - 在隱藏作弊系統中新增了實用指令：在遊戲畫面盲打輸入 **`allres`**。
  - 可一次性呼叫彈窗，為領地同時大量增加**金幣、木材、石材、鐵礦**四種核心資源，以及**生皮 (Hide)、棉麻 (Cotton)** 兩種狩獵/農業貿易素材，大幅減少繁瑣的逐一輸入，加速經濟循環測試。

## [2026-08-13] 內容與職業數值平衡 (P3)
- **[Feature/System] 修正戰鬥減傷公式** (`CombatMath.ts`)：
  - 將護甲減傷基數從 50 調整為 150 (`effectiveDef / (effectiveDef + 150)`)，使低數值環境下的減傷曲線更加平滑，大幅提升低倍率與多段攻擊職業的可用性。
- **[Refactor/Test] 重構 5v5 團隊平衡測試腳本** (`balance-test-team.ts`)：
  - 將寫死的 2000 HP「深淵戰神」，改為直接呼叫 `MonsterSystem` 動態生成真實難度 10.0 的遭遇戰，對齊遊戲內建的「低數值基準」。
  - 修復傳說級測試裝備，全面補齊 `matk` (魔法攻擊力) 與 `speed` (速度)，解決魔法系職業因缺少 `matk` 導致傷害掛零的假象。
  - 實裝真實屬性成長：移除全 20 的假屬性，改為依照 `CLASS_SYSTEM.md` 的初始屬性與成長率動態計算 Lv.10 的數值，並配置 18 點自由點數至該職業主屬性。
  - 修復職業判定與技能施放：修正 `baseJobName` 以符合 `CombatSystem` 的進階技能判定邏輯（如「戰士」而非「狂戰士」），並依照武器給予約 20~50 點不等的真實基底 `atk` / `matk`。
  - 成功驗證 5v5 團隊戰鬥：旋風斬、隕石轟炸等進階技能皆能正確觸發，不同隊伍流派（物理單體、魔法群攻、混沌連鎖）的輸出佔比也能真實反映職業特性。
## [2026-08-13] 外敵入侵與治安度重構 (P1.3)
- **[Feature/System] 實作半浮動式治安度公式** (`TownManagementSystem.ts`)：
  - 移除了前期的「免守衛」保護。治安度現在從荒野階段就會開始運作。
  - 根據據點規模設定基礎守衛需求 (荒野 0、營地 2、村莊 5、城鎮 15、首都 40 人)，並加上總人口 10% 的動態需求，模擬擴建陣痛期。
- **[Feature/System] 懸賞任務動態生成** (`BountySystem.ts`)：
  - 將部分任務標籤為 `BANDIT`。
  - 懸賞板生成盜匪任務的機率，改由「前一日治安度」動態決定（治安越低，盜匪任務越多）。
- **[Feature/System] 盜匪勒索與入侵事件** (`BountySystem.ts`, `GameLoop.ts`, `ExtortionModalController.ts`)：
  - 移除原先自動倒數的隨機入侵機制。
  - 若懸賞板上的盜匪任務遭到無視直至過期，將觸發「盜匪勒索」事件。
  - 玩家必須選擇「破財消災（扣除 20% 所有資源並恢復治安）」或「拔劍捍衛（立刻進行防禦戰自動結算）」。

## [2026-08-13] 戰鬥數值機制重構 (P1.1)
- **[Feature/System] 將出手順序與閃避分離，導入「速度 (Speed)」** (`types.ts`, `Adventurer.ts`, `CombatSystem.ts`)：
  - 新增了獨立的 `speed` (速度) 屬性。
  - 出手順序現在由速度決定，取代了原本綁定在閃避 (evade) 上的邏輯，確保未來「重裝高防禦 = 低閃避」但仍可透過詞綴獲得出手權的裝備設計。
- **[Bugfix/System] 修正魔力 (MP) 上限與回復上限** (`CombatSystem.ts`, `Combat.ts`)：
  - 修復了戰鬥中 MP 回復上限被硬寫死為 200 的問題。現在角色的 MP 回復會正確尊重其基於 `spr` 或裝備計算出的 `maxMp`。
- **[Feature/System] 統一敵軍與野怪閃避單位為點數制** (`MonsterSystem.ts`, `FactionArmyGenerator.ts`)：
  - 將所有動態生成怪物的閃避值 (evade) 從「百分比 (0~0.5)」修正為與命中對應的整數點數制。
- **[Feature/System] 導入爆擊率硬上限** (`Adventurer.ts`)：
  - 將角色的爆擊率強制封頂於 90%，並修正了裝備提供的 `critRate` 遺漏累加的 Bug。
- **[Feature/UI] 各介面對應速度屬性顯示**：
  - 在酒館招募面板、隊伍屬性面板與鍛造頁面的能力比較中，補上了速度 (`SPD`) 的顯示。

## [2026-08-13] 經濟平衡與難度清理 (P2)
- **[Feature/System] 實作破產機制** (`GameLoop.ts`, `Territory.ts`, `GameOverModalController.ts`)：
  - 現在遊戲會追蹤領地的連續負債天數。當金幣小於 0 時，會累加負債天數。
  - 當連續負債達到 14 天時，會強制觸發 Game Over，並在結局畫面顯示專屬的「破產倒閉」文字描述，解決了過去長期負債造成的軟鎖 (Soft-lock) 問題。
- **[Refactor/Data] 清理無效的難度設定** (`WorldGeneration.ts`, `DifficultyData.ts`, `BalanceData.ts`)：
  - 徹底移除底層程式碼中殘留的 `EASY` (簡單) 與 `EXTREME` (極難) 難度定義，確保遊戲難度如設計預期，只存在 `NORMAL` (普通) 與 `HARD` (困難)。
  - 移除 `DifficultyModifiers` 中毫無作用的 `production` (生產倍率) 參數，消除設定與實際表現不符的混淆。

## [2026-08-13] 戰鬥數值與公式統一化 (P1.2)
- **[Refactor/Combat] 重構戰鬥運算公式** (`CombatMath.ts`)：
  - 修復了實戰運算時無視面板爆擊率 (`critRate`) 的 Bug。現在技能與普攻傷害結算會確實讀取裝備、武器與職業算好的面板爆擊率與爆擊傷害 (`critDmg`)。
  - 移除了 `CombatMath.ts` 中與 `Adventurer.ts` 重複定義的弓箭手/刺客爆擊率與爆擊倍率特化邏輯，將屬性計算權威統一交回給面板數值。
## [2026-08-12] 隨機事件系統全面重構：因果邏輯與潛伏期
- **[Feature/System] 廢除壓力值，引入徵兆潛伏期與冷卻機制** (`EventSystem.ts`, `Territory.ts`, `EventData.ts`)：
  - 徹底移除了原本單一且死板的「全域壓力值 (eventPressure)」。
  - 引入**「狀態潛伏 (Omen)」**機制：當觸發條件滿足時，不會立刻引爆事件，而是進入 3 天左右的「潛伏期」並給予流言提示。玩家若能在期限內改變狀態（如花掉金幣、提升好感度），危機將自動解除。
  - 引入**「極長冷卻期 (Cooldown)」**：負面與勒索事件爆發後將進入 180~360 天不等的免疫期，避免中後期因為條件持續滿足而每天被勒索的荒謬情況。
  - 引入**「唯一性故事 (Unique)」**：將「雪夜的訪客」、「暗流湧動」等帶有強烈敘事色彩的事件標記為存檔唯一，作為未來解鎖教廷與樞密院進階劇情的鑰匙。
  - **動態門檻演算法**：勒索事件的金幣門檻不再固定為 2000，而是採用 `3000 + (爵位等級 * 2000)` 的通膨算法；豐收祭典的門檻採用 `總人口 * 10` 的動態標準，維持後期合理性。

## [2026-08-12] 修復戰鬥重播 UI 同步與獎勵顯示異常
- **[Bugfix/UI] 修復戰鬥重播 UI 顯示異常** (`CombatUIManager.ts`, `ExplorationNarrativeEngine.ts`)：
  - 修正了「敵人血條還沒歸零，戰鬥勝利畫面就提早跳出」的視覺不同步問題。現在勝利或失敗的結算面板會延遲 0.8 秒彈出，確保最後一擊的血條扣除動畫能完整播完。
  - 修正了戰鬥重播結算的「聲望」數值與探險日誌結算不一致的 Bug（原本戰鬥底層給予隨機 50-99 聲望，探險日誌使用實際計算公式）。現在會將實際探險結算的聲望數值正確覆蓋回戰報中，確保兩邊顯示 100% 同步。

## [2026-08-12] 重製開局難度選擇
- **[Feature/System] 難度精簡與統一荒野開局** (`DifficultyData.ts`)：
  - 將原本的 4 種難度選項精簡為「普通 (Normal)」與「困難 (Hard)」兩種。
  - 移除了簡單與極難的選擇，並將普通與困難的初始狀態統一改為「荒野 (WILDERNESS)」與「平民 (COMMONER)」。
  - 調整了初始資源：普通難度初始人口 10，困難難度初始人口 2，以資源匱乏度、敵人強度與後期天災頻率作為主要難度區別。

## [2026-08-12] 取消難度對產量影響與修復預估產量 UI
- **[Bugfix/UI] 修復 UI 預估產量與實際結算不同步的問題** (`TownManagementSystem.ts`, `UIManager.ts`, `BalanceData.ts`)：
  - 移除了所有難度（Easy, Normal, Hard, Extreme）對領地資源產量的影響。
  - 將計算「產量倍率 (Production Multiplier)」的邏輯獨立為 `TownManagementSystem.getProductionMultiplier()`。
  - 修復 `UIManager.ts` 未計算治安度與官職加成的 Bug，現在 UI 顯示的糧食、木材等預期產量，將與每日實際增加的資源數量 100% 同步，解決了「顯示增加但實際未增加」的錯誤。

## [2026-08-11] 實裝戰俘系統與 UI 修復
- **[Feature/System] 戰俘捕獲機制** (`ExplorationNarrativeEngine.ts`, `FactionData.ts`, `MapData.ts`)：
  - 各陣營現在擁有名為「洛斯加 (Hrothgar)」等帶有傳奇與勢力特性的基礎兵種。
  - 擊敗特定據點的傳奇 Boss 後，會自動將其加入對應勢力的被俘名單（`capturedChampionIds`）。
- **[Feature/UI] 地牢抽屜介面** (`panels-hud.html`, `PrisonerModalController.ts`)：
  - 於 HUD 左側快捷列，在「全域倉庫」右側新增「領地地牢 (⛓️)」按鈕。
  - 將地牢介面改為左側滑出的抽屜面板 (`dungeon-panel`)，與倉庫面板設計保持一致。
- **[Bugfix/UI] 修復戰鬥重播 UI** (`CombatUIManager.ts`)：
  - 針對擁有長前綴（如 `[陣營] 攻城器械`）的單位，修改單位卡片的 CSS 樣式，允許文字在超過寬度時自動換行（最多兩行），解決了名字被切斷隱藏的問題。
- **[Bugfix/System] 修正攻城佔領邏輯與代官 UI** (`DispatchSystem.ts`, `NodeDetailModalController.ts`)：
  - 修復了「攻城戰鬥失敗卻依舊佔領據點」的嚴重 Bug，現在必須 `isVictory` 為 true 才能取得所有權與指派代官。
  - 修復了點擊自己領地時依然顯示「⚔️ 發動攻城戰」的 UI 問題，現在會正確顯示「🔒 您的領地」並禁止無效操作。

## [2026-08-11] 實裝滿等轉職系統 (素材消耗制)
- **[Feature/Advancement] 滿等轉職與專屬素材** (`Adventurer.ts`, `types.ts`, `PartyModalController.ts`)：
  - 實作了達到等級 10 級滿等後的「轉職試煉」機制。
  - 在 `types.ts` 中新增了 6 種對應基礎職業的轉職專屬素材（如：狂怒之鋒、秘法魔典等）。
  - 在傭兵隊伍面板 (`PartyModalController.ts`) 中新增「轉職」按鈕。當滿等且未轉職時自動顯示。
  - 轉職會消耗對應的領地倉庫素材 (`territory.materials`)，並正式開啟該傭兵的潛能（`isAdvanced = true`），解鎖進階變異職業與專屬被動技能。
- **[Feature/Cheats] 測試輔助密技** (`CheatController.ts`, `CHEATS.md`)：
  - 新增 `advmat` 密技，可以在開發與測試階段一鍵獲取所有轉職專屬素材各 10 個，方便驗證完整的 UI 點擊流程。

## [2026-08-11] 實裝 GAMBIT 戰術系統
- **[Feature/Combat] 傭兵戰術系統 (Gambit)** (`Gambit.ts`, `GambitEvaluator.ts`, `CombatSystem.ts`)：
  - 實作了類似 FFXII 的 Gambit 條件判斷系統，允許玩家為傭兵設定高達 3 條的「If-Then」條件戰術。
  - 支援 9 種核心條件判斷：血量 (自身/隊友/敵方)、目標位置 (前/後排)、狀態異常等。
  - 實作「方案 A」防呆機制，當近戰角色被設定為攻擊後排時，系統會在 UI 上給予警告，且戰鬥中將嚴格受限於物理射程，避免近戰技能越過前排的問題。
- **[Feature/UI] 戰術編輯器** (`GambitModalController.ts`, `PartyModalController.ts`, `modals-game.html`)：
  - 於傭兵詳情選單中新增了「GAMBIT 戰術策略」編輯區塊，並透過 `GambitModalController` 動態產出條件設定與下拉選單。
  - 處理了舊存檔的相容升級 (`SaveMigration.ts`)，為已招募傭兵自動分配空的預設戰術。

## [2026-08-11] 實裝硬核傳統 Game Over 結局
- **[Feature/Core] 傳統壞結局 (Wipeout)** (`GameLoop.ts`, `GameOverModalController.ts`)：
  - 當領地的**人口與糧食雙雙歸零**（例如因高難度下的凜冬事件扣光糧食，或指派不當）時，遊戲將在每日結算階段觸發硬核壞結局。
  - 跳出「領地崩潰」的全螢幕絕望敘事畫面（伴隨黑屏漸變轉場與史詩字體），無事前警告，玩家的領地與爵位將被歷史遺忘。
  - 玩家只能選擇「載入最新存檔」來挽回局面，或是直接「回到主選單」。
  - 在 `GameFlowController.ts` 中實作了攔截機制，當發生 Game Over 時將中止一般的每日結算畫面。

## [2026-08-11] 戰鬥九宮格陣型與渲染修復
- **[Fix/Combat] 陣型資料傳遞斷層修復** (`DispatchSystem.ts`, `ExplorationNarrativeEngine.ts`)：
  - 修復了任務派發時 `task.gridMap` 與 `task.formationId` 未正確傳入戰鬥底層 (`ExplorationNarrativeEngine.generateSubjugationLog` 與 `CombatSystem.simulateCombat`) 的嚴重 Bug，確保玩家在介面上排好的九宮格陣型與站位能 100% 原汁原味呈現於戰鬥重播中。
- **[Fix/UI] 戰鬥重播 UI 防呆機制強化** (`CombatUIManager.ts`)：
  - 修復了無陣型狀態下角色會預設重疊擠在「第一行 (gridRow = 1)」的 Bug。
  - 新增防呆邏輯：若角色無 `gridMap` 資訊，會根據預設站位（前/中/後）自動分配列，並按照入場順序自動向下排開至 1~3 行，徹底解決角色重疊、血條交錯的顯示異常問題。
- **[Fix/Combat] 敵方隨機站位防撞機制** (`CombatSystem.ts`)：
  - 於敵方生成階段引入 `occupiedEnemyGrids` 判定。當敵方隨機產生九宮格站位時，若該格子已被佔用，會自動重新擲骰尋找空位（最多嘗試 10 次），防止多個敵方圖標在畫面上完全重疊消失的問題。

## [2026-08-07] 鍛造屋批量操作與介面細節優化
- **[Feature/Forge] 批量冶煉與鍛造 UI** (`ForgeUIController.ts`)
  - 於鍛造屋的「冶煉素材」與「裝備鍛造」介面下方，新增完整的數量調整器 (`[ - ] [ 數量 ] [ + ] [ MAX ]`)。
  - 系統會根據當前所擁有的金幣與基礎素材自動計算出 `MAX` (最大可製作數量)。
  - 隱藏 `<input type="number">` 預設的原生上下微調箭頭，讓介面保持整潔。
  - 按下執行後，會一次性扣除對應的素材/金幣並一次性產出複數道具，大幅減少重複點擊的作業感。
- **[UI/HUD] 全域倉庫快捷按鈕排版優化** (`panels-hud.html`)
  - 將「全域倉庫 (📦)」按鈕從原先的水平列抽出，改為垂直懸浮於「傭兵小隊 (👥)」按鈕的正上方。
  - 恢復原本 4 個快捷按鈕的經典水平排列。
  - 將全域倉庫的「裝備」頁籤完全比照傭兵小隊的「選擇裝備」介面進行網格化 (Grid) 排版，並實裝帶有詳細屬性的 Tooltip。
- **[UI/TopBar] 預期產量顯示修復與防亂碼** (`UIManager.ts`)
  - 將「預期產量」文字預覽中的生僻 Emoji (🪵, 🪨) 替換為高相容性的經典符號 (🌲, 🧱)，並加上明確的中文後綴 (木材、石材)，徹底解決舊電腦/舊瀏覽器顯示為亂碼「口」的問題。
  - 加入了「獵人」產出的生皮與「礦工」產出的鐵礦預期產量結算預覽（當產量大於 0 時動態顯示）。
- **[Logic/Forge] T4重鑄配方顯示條件限制** (`ForgeUIController.ts`)
  - 新增邏輯：現在必須在庫存倉庫中確實擁有對應的 T3 前置武器，鍛造屋才會顯示該武器的 T4 變異重鑄配方。

## [2026-08-07] 鍛造屋系統邏輯修復
- **[Fix/Forge] 修復合成與重鑄裝備吞噬 Bug**：現在合成或重鑄需要前置裝備時，系統會嚴格過濾，只會消耗「強化等級為 +0 且無附魔」的基礎裝備，避免誤吃玩家辛苦升級的高階武器。同時在介面上增加「(僅限+0無附魔)」的文字提示。
- **[Fix/Forge] 修復強化滿等防呆與預覽顯示**：當裝備達到最高強化上限 (+10) 時，強化按鈕將正確轉為不可點擊的「已達強化上限」狀態，並在中間預覽區顯示紅色警語，不再顯示錯誤的 +11 虛假數據預覽。
## [2026-08-07] 自宅/謁見廳 UI Bug 修復：勞動力更新機制重構
- **[Fix/UI] 修復步兵調度人數不同步問題**：
  - 修復了 `views-facility.html` 中「自宅（書房）」與「謁見廳（Hall）」因共用相同的 HTML ID (`ui-worker-INFANTRY`) 導致謁見廳更新失效的 Bug。
  - **[Refactor]** 將所有職業的計數標籤改為使用 `class="ui-worker-count"` 搭配 `data-job` 屬性。
  - 在 `UIManager.ts` 中移除原先逐一綁定 ID 的冗長程式碼，改採 `querySelectorAll('.ui-worker-count')` 迴圈一次性同步所有相同職業的 UI 數據，大幅增強未來擴充性與維護性。
## [2026-08-07] 酒館動態客流升級：傭兵個別離店判定與結算轉場即時重繪
- **[Logic/Tavern] 傭兵 100% 個別獨立離店與入住判定**：在 [`TavernSystem.ts`](file:///d:/tryagent/Medieval/src/systems/TavernSystem.ts) 重構客流演算法：
  - 每日結算時，對酒館內每一位傭兵**個別單獨抽籤**（`stayDaysLeft` 歸零或 50% 獨立離店機率），使傭兵流動不再集體死板。
  - 對每一個空座位**個別進行 70% 獨立補新判定**（且人數低於 2 人時 100% 保底補滿），確保天天皆有全新傭兵入住。
- **[UI/GameFlow] 結算轉場完畢強制重繪酒館**：在 [`GameFlowController.ts`](file:///d:/tryagent/Medieval/src/ui/GameFlowController.ts) 的【每日結算 Modal】轉場完成回調中，若玩家當時正在酒館視圖 (`view-camp`) 內，強制非同步執行 `renderTavernView()`，使轉場黑幕揭開後畫面100%展示當日最新傭兵。
- **[Fix/Recruit] 排除誓約守衛 (GUARDIAN) 性格**：在 `TavernSystem.ts` 改用 `DataStore.getRandomRecruitTrait()`，防止「誓約守衛」主角專屬性格隨機進入酒館供招募。


## [2026-08-07] index.html 模組化拆分 & Agent 檔案保護機制 (A+B 雙保險)
- **[Architecture/HTML] 巨型 index.html 拆分**：將原本 2256 行的 `index.html` 拆分為 **38 行精簡骨架** + `style.css` + **7 個獨立 HTML 模板**：
  - `src/templates/ui-chrome.html`：頂部資源欄、全域提示與遮罩
  - `src/templates/views-main.html`：主選單、世界地圖、野外據點與橫向動態街景
  - `src/templates/views-facility.html`：領主書房、謁見廳、傭兵酒館、武器/防具店與鍛造屋
  - `src/templates/views-right-panel.html`：右側領地資訊共用面板
  - `src/templates/modals-combat-trade.html`：戰鬥動畫 Modal 與貿易跑商 Modal
  - `src/templates/modals-game.html`：倉庫、新遊戲、載入、派遣、俘虜、系統選單、事件與待辦 Modal
  - `src/templates/panels-hud.html`：左側抽屜面板（戰鬥紀錄/外交/隊伍）與右下角史詩按鈕
- **[System/UI] 動態模板載入器 (`TemplateLoader.ts`)**：
  - 在 `main.ts` 入口導入 `TemplateLoader.ts`，遊戲啟動時透過 `Promise.all` 並行非同步 `fetch` 所有 `.html` 模板並注入至 `#template-root` 容器。
  - 自動重新掛載模板內的 `<script>` 腳本，保證如 `selectDispatchMode()` 等全域函數正常生效。
- **[Refactor/UI] DOM 懶加載修正**：
  - 修復 `UIManagerClass` 與 `CombatUIManager` 靜態屬性在 TS 模組載入時立即執行 `document.getElementById()` 導致的 `null` 錯誤。新增 `UIManager.reinitDOM()` 並延遲至模板注入完成後才讀取 DOM 節點。
- **[Fix/Layout] 修復右側面板 (#shared-right-panel) 脫離 Flex 容器區塊**：
  - 修復因 `views-main.html` 包含未閉合標籤導致瀏覽器自動插入 `</div></div>` 的問題。
  - 將 `#main-layout` 與 `#view-container` 結構固定於 `index.html` 骨架內。
  - 在 [`TemplateLoader.ts`](file:///d:/tryagent/Medieval/src/ui/TemplateLoader.ts) 指定 `views-main.html` 與 `views-facility.html` 注入 `#view-container`；`views-right-panel.html` 注入 `#main-layout`，使街景與帝國儀表板重新完美並排呈現！


## [2026-08-07] 酒館 UI 強化：屬性面板 & 傭兵即時刷新
- **[Bug/Tavern] 結束本日後立刻顯示新傭兵**：修復 `DAY_PASSED` 事件觸發時，`selectedTavernGuest` 未被清除導致新一批客流無法即時呈現的問題，現在推進天數後酒館畫面會自動選中最新的第一位傭兵。
- **[UI/Tavern] 右側面板屬性展開**：`tavern-selected-detail` 全面改版為「三列固定式」下錨佈局：
  - **第一列**：對話泡泡 + 綜合戰力 + 性格特徵 + 招募按鈕。
  - **第二列（📊 基礎屬性）**：以 4 欄格線顯示八維屬性（力量/敏捷/體質/智慧/精神/幸運/魅力/統帥），含色碼區分。
  - **第三列（⚔️ 戰鬥數值）**：以 3 欄格線顯示衍生屬性（HP/MP/物攻/魔攻/物防/魔防/命中/閃避/爆擊率）。
- **[UI/Tavern] 卡片列可捲動 / 屬性格固定**：右側面板改用 flex 伸縮佈局，傭兵卡片區 `flex: 1` 可捲動；屬性區 `flex-shrink: 0` 固定在下方，不受卡片數量影響。
- **[Logic/Recruit] 戰力計算升級**：綜合戰力改以 `getCombatStats()` 衍生公式計算（atk×2 + def + hp/10），更精準反映英雄強度。


- **[System/Tavern] 傭兵動態流動**：拔除手動抽卡機制。酒館現在擁有真實客流，傭兵會隨機入住並逗留 1~10 天，客滿上限隨酒館等級提升 (最高 10 人)。
- **[System/Tavern] 情報傳聞與迷霧連動**：酒館 3 級解鎖打聽情報。若目標隱藏據點未驅散迷霧，老爹僅給予模糊環境線索；若已驅散迷霧，則直接解鎖據點並給出精確情報。
- **[UI/Recruit] 卡片規格統一與動態報價**：酒館內的英雄卡片全面改用原生 `AdventurerCard` 規格。招募價格會受英雄性格 (Trait) 影響，並新增性格專屬的招募對話氣泡。

## [2026-08-07] 順序探索流敘事重構 & 戰利品 UI 同步修正

- **[System/Narrative] 探險敘事引擎重構：順序探索流 (Sequential Exploration) (`ExplorationNarrativeEngine.ts`)**
  - **廢除單一連戰機制**：移除了先前不合理的一次遭遇 3 波怪物的設計。現在每次討伐任務會被拆分為 2~3 個推進節點。
  - **節點交錯遭遇**：在每一次的推進中，系統會依據機率 (30% 隨機事件 / 70% 單波戰鬥) 生成對應的敘事。這讓探險日誌更加生動，真實還原「路上救商人，接著拔營作戰」的跑團體驗。
  - **跨戰鬥狀態繼承**：為支援連戰時血量不回滿的硬核設定，現在 `CombatSystem.simulateCombat` 支援傳入 `initialHpMpOverride`。英雄在探索過程中的每一場獨立戰鬥都會**繼承上一場結束時的殘餘血量與魔力**。若途中戰敗，探險會立即中斷並撤退。
  - **獎勵總匯整**：雖然每一場戰鬥的戰利品都會獨立獲得，但在探險日誌的底端 `🎁 戰利品與收益`，會自動將這 2~3 個節點的所有金幣、經驗、聲望與裝備進行累加顯示。

- **[UI/Combat] 內部戰鬥視窗顯示修正 (`CombatUIManager.ts`)**
  - 修復了「內部戰鬥紀錄」與「外部探險日誌」戰利品顯示不同步的問題。
  - 移除了舊版寫死的單一聲望顯示，改為讀取 `CombatReport` 裡的 `totalEarnedGold`, `totalEarnedExp`, 與 `droppedEquipment`，並以直觀的圖文 (💰, ✨, 🗡️) 直接渲染於戰鬥結算視窗內。

## [2026-08-07] 怪物多樣性與戰利品底層重構 & 災難判定架構升級

- **[Combat/Monster] 怪物多樣性與戰利品底層重構 (`MonsterSystem.ts`, `CombatSystem.ts`, `ExplorationNarrativeEngine.ts`, `types.ts`)**
  - **單向隔離與地形約束混編**：重構 `MonsterSystem.ts` 中的 `generateEncounter`。現在生成整隊怪物時，會遵守單向隔離法則（生靈據點絕對排除純亡靈）與據點本身的出沒地形限制。以隊長戰力為基準，在剩餘戰力額度內從合法的池子中隨機混編其他種類的怪物。
  - **屬性混編與初期防呆**：將賦予隨機屬性 (Element) 的邏輯從「全隊共用」移入「每隻個體生成迴圈」內，實現同隊可能出現不同屬性的怪物。並將變異機率與 `baseDifficulty` 綁定，初期 (難度 < 2.0) 變異率為 0%，避免初期玩家遭刁鑽元素團滅。
  - **底層戰利品動態計算**：
    - `types.ts` 中的 `MonsterData` 新增了 `lootConfig`，`MonsterInstance` 新增了 `goldReward`, `expReward` 和 `equipmentDropRate`。
    - `MonsterSystem.ts` 在生成個體時動態結算該怪物的專屬掉落價值（由 `powerScore` 決定的基底加上其本身的特殊機率）。
    - `CombatSystem.ts` 擴充 `CombatReport`，在敵方角色 HP 歸零倒下時，立即累加擊殺金幣與經驗值，並進行獨立裝備掉落骰子（`EquipmentGenerator.dropRandomEquipment`），直接將隨機裝備收入國庫。
    - 徹底捨棄舊版 `ExplorationNarrativeEngine.ts` 中「依據點等級給予死板金幣與掉落率」的作法，改為直接取用 `CombatSystem.ts` 回傳的真實累加戰利品總和，並寫入探險日誌，大幅提升打寶樂趣。

- **[UI/Exploration] 探險日誌實裝「戰利品與收益」顯示面板 (`AdventureLog.ts`, `ExplorationNarrativeEngine.ts`, `AdventureLogModalController.ts`)**
  - **資料結構擴充**：於 `AdventureLogEntry` 新增 `rewards` 屬性，用以精準記錄單次探險/討伐所獲得之資源與裝備。
  - **後台結算連動**：在 `ExplorationNarrativeEngine.ts` 執行戰鬥後，將實際獲得的金幣、英雄經驗值 (包含 restedExpPool 加成)、聲望與隨機掉落裝備等資料同步包裝至 `rewards`，並與日誌一併存檔。
  - **前端面板呈現**：在右側探險日誌 (`adventure-log-content`) 的最底層，新增具有暗色玻璃質感邊框與 Emoji 排版的小面板 `🎁 戰利品與收益`，動態渲染該場戰役的金錢 (`💰`)、經驗值 (`✨`)、聲望 (`👑`) 與獲得裝備 (`🗡️`)，使玩家能直觀享受戰鬥收穫。
  - **底部快捷列 (Dock) 調整**：移除了重複冗餘的「戰鬥紀錄 (⚔️)」獨立按鈕（統一透過探險日誌查看），並將「外交與派系」的圖示變更為握手 (`🤝`)，以區別於「探險日誌」的卷軸 (`📜`) 圖示。
  - **多波次戰鬥與戰敗懲罰**：
    - 將 `ExplorationNarrativeEngine.ts` 中的討伐戰鬥波數由原本寫死的 `1` 波，改為隨機 **1 ~ 3 波**。戰鬥機制維持血量與魔力狀態跨波次繼承（不會自動回滿）。
    - 實裝戰敗回復懲罰：調整 `GameLoop.ts` 中據點防守戰敗的重傷休養由 3 天增加為 **4 天**；同時修復 `DispatchSystem.ts` 中外出討伐戰敗無懲罰的問題，現在討伐戰敗後將被強制賦予 **1 天** 的休養狀態。

- **[System/Threat] 重構天災與敵意襲擊判定機制 (`types.ts`, `GameState.ts`, `TownManagementSystem.ts`, `ThreatSystem.ts`)**
  - **根本原因**：過去在 `TownManagementSystem.ts` 判定是否為「天災」時，採用的是簡陋的字串比對 (`/雪|旱|災|蝗|疫|震/i.test(threatName)`)，導致預設災難名稱「凜冬寒流」因未包含關鍵字而被錯誤判定為敵軍襲擊，並觸發「衛兵防禦成功」的荒謬結算。
  - **架構升級 (方案二)**：
    - 新增 `ThreatType` 列舉 (`NATURAL_DISASTER`、`INVASION`)。
    - 重構 `GameState.threat` 資料結構與存檔管理 (`SaveManager.ts`)，引入明確的 `type` 屬性區分災難類型。
    - 更新 `GameEvents.ts` 事件負載，使 `THREAT_ARRIVED` 事件精準傳遞 `threatType`。
    - `TownManagementSystem.ts` 現已完全捨棄名稱猜測，改由 `payload.threatType === 'NATURAL_DISASTER'` 進行嚴謹判定，徹底防堵類似邏輯漏洞。

## [2026-08-05] UI 架構模組化與事件系統準備

### Refactoring (UI)

- **[UI/Modal] 徹底拆解 ModalController (Phase 4 完工)**
  - 將原本高達上千行的 ModalController.ts 徹底解耦。
  - 抽離 NodeDetailModalController、DispatchModalController、EventModalController、TodoModalController、CombatHistoryModalController、PrisonerModalController。
  - 原有 ModalController.ts 全面改為輕量級的 Facade 入口 (動態載入對應模組)。

### Systems

- **[System/Event] 探險事件系統支援 (Phase 1 完工)**
  - 新增 NarrativeData.ts 定義隨機文本池。
  - 擴充 EventSystem.ts，支援透過 GAME_EVENT_TRIGGERED 派發動態事件，並無縫整合至剛抽離的 EventModalController 中。

## [2026-08-03] 建立世界觀敘事聖經與陣營設定計畫

- **[Docs/Lore] 建立《敘事聖經》規範檔案 (`docs/NARRATIVE_BIBLE.md`)**
  - 確立「純人類政治權謀」核心哲學，怪物定位為人類罪惡引發的「副作用/連鎖反噬」。
  - 重新設計 5 大核心貴族勢力（洛斯加王室、沃爾蒙德公爵、赫斯特侯爵、貝拉維亞伯爵、達斯克子爵），聚焦於貪婪、繼承與信仰等純粹的人類政治鬥爭。
- **[Docs/Plan] 建立酒館系統與事件系統擴充計畫 (`docs/TAVERN_SYSTEM_PLAN.md`, `docs/LORE_AND_EVENT_SYSTEM_PLAN.md`)**
  - 規劃未來的碎片化敘事與酒館情報系統。

## [2026-08-02] 傭兵頭像卡片新增「未分配屬性點提示」與「狀態標籤遮擋修正」

### UI / UX 改進

- **[UI/Adventurer] 傭兵頭像卡片極簡圖示左右位置交換 (`AdventurerCard.ts`)**
  - 將 **微型發光綠/紅狀態圓點**（🟢/🔴）移至 **最左上角 (`top: 4px, left: 4px`)**。
  - 將 **微型純小燈泡屬性點圖示**（`💡`）移至 **最右上角 (`top: 3px, right: 4px`)**。

## [2026-08-02] 領主自宅新增「哨所/衛兵」人力分配滑桿與敵意掠奪抵禦機制

### Feature / UI 改進

- **[UI/Base] 領主自宅新增哨所/衛兵工作滑桿與無捲軸版面優化 (`index.html`, `UIManager.ts`)**
  - 在「領主自宅 (Base)」的領地工作分配面板中直接放回守護人力滑桿 (`INFANTRY`)，使平民/村莊階段玩家無須封爵或進入謁見廳即可自由分配守守護人力。
  - **動態名稱**：據點等級為荒野/營地/村莊 (`CAMP`, `VILLAGE`) 時，名稱顯示為 **「🏰 哨所」**；城鎮/王都 (`TOWN`, `CAPITAL`) 以上顯示為 **「⚔️ 衛兵」**。
  - **無捲軸 UI**：調整工作面板內距 (padding) 與元素間距 (gap)，讓 4 項工作滑桿（農夫、伐木工、礦工、哨所/衛兵）能在不產生垂直捲軸/滾動條的情況下緊湊呈現。

- **[System/Defense] 哨所/衛兵連動敵襲戰力與敗退減傷機制 (`GameLoop.ts`, `SettlementSystem.ts`)**
  - 將哨所守衛 (`INFANTRY / CAVALRY / ARCHER`) 人數與治安加成正式納入據點敵襲戰力中，配置哨所守衛即絕不觸發「無人駐守」判定。
  - 新增**敗退洗劫減傷**：當敵襲戰力過高不敵時，哨所守衛將進行誓死抵抗，依據治安與守備覆蓋率減免 **50% ~ 80% 的物資與人口洗劫損失**，結算彈窗顯示專屬【⚔️ 哨所抵抗（遭強敵突破）】與減傷備註。

## [2026-08-02] UI 五項優化：戰鬥舞台、探索按鈕、裝備Tooltip、討伐模式選擇、入侵事件時序

### Bug Fix / UI 改進

- **[UI/Combat] 戰鬥重播怪物卡片超出視窗修正 (`index.html`, `CombatUIManager.ts`)**
  - `combat-stage` 從 `flex: 2` 改為 `flex: 0 0 300px` 固定高度，加上 `overflow: hidden`
  - 調整 `.combat-team` 的 `gap` 從 10px 到 5px，align-items 改為 `stretch`
  - 每個卡片 (`combat-participant`) 縮減 padding、字型、頭像尺寸 (46px→34px)，適應緊湊佈局
  - Modal 尺寸擴大至 860×640px，增加 `max-width: 96vw` 響應式保護

- **[UI/Action] 探索周邊按鈕回合限制灰化 (`UIManager.ts`, `index.html`)**
  - `UIManager.updateUI()` 末尾新增：當 `exploredToday >= maxExplorationsPerDay` 時，`btn-explore` 自動 `disabled`
  - 加入 CSS 樣式 `.explored-today` 搭配 `opacity: 0.45; cursor: not-allowed; filter: grayscale(0.6)` 視覺反饋
  - 按鈕 `title` 屬性顯示提示文字

- **[UI/Equipment] 裝備懸浮 Tooltip 屬性名稱修正，顯示全部屬性 (`ModalController.ts`)**
  - 新增共用函式 `buildEquipStatsHtml(eq)`：正確使用 `patk/pdef/mdef/matk/hp/hit/evade` 等實際資料鍵名
  - Tooltip 分為「戰鬥效果」（物攻、魔攻、物防、魔防、HP、命中、閃避）和「屬性加成」（STR/AGI/CON/INT/SPR/LUK）兩段
  - 修正裝備槽位面板（`equip` tab）和裝備選擇清單（`party-equip-select-pane`）兩處 Tooltip

- **[UI/Dispatch] 討伐模式選擇改為 Card 式 UI，取消預設選項 (`index.html`)**
  - 隱藏 radio input，改為兩個視覺 Card（單次討伐 ⚔️ / 連續討伐 🔥）
  - 選中效果：單次選中後卡片藍灰色邊框，連續選中後金色邊框+發光效果
  - 全域函式 `selectDispatchMode('SINGLE'|'PROGRESS')` 同步 radio 值、卡片樣式、說明文字
  - 預設不選任何模式，玩家必須主動選擇

- **[Fix/Event] 入侵事件結果在每日結算確認後才顯示 (`GameLoop.ts`)**
  - `showInvasionReport` 改為：若 `isAdvancingDay` 為 true，將顯示函式推入 `eventQueue`
  - 玩家確認每日結算 modal 後，轉場結束時才依序彈出入侵結果通知
  - 防止入侵彈窗在結算 modal 下方同時出現的 UI 衝突

## [2026-08-02] 提升連續平定(3波)討伐獎勵：高風險高報酬機制 (`ModalController.ts`, `DispatchSystem.ts`)

- **[Balance/Subjugation] 波次討伐獎勵大幅強化 (`ModalController.ts`)**
  - **3.5倍收益**：當玩家於討伐面板選擇「連續平定 (PROGRESS)」模式時，成功後獲得的金幣與聲望獎勵由原來的單倍大幅提升為 **3.5 倍**。
  - **UI 預估即時更新**：切換模式時，討伐面板左下角的「預期 💰／✨」會即時更新。
- **[Feature/Loot] 裝備保底掉落機制 (`DispatchSystem.ts`)**
  - **必掉裝備**：在結算「連續平定 (PROGRESS)」討伐任務時，不再依賴機率，而是**必定掉落 1 件**符合該次挑戰難度的隨機裝備，強化高難度挑戰的誘因。

## [2026-08-02] 戰鬥每回合恢復削弱、頭頂浮動提示與重播頭像升級 (`CombatSystem.ts`, `CombatUIManager.ts`, `ATTRIBUTE_SYSTEM.md`) (New!)

- **[Balance/Combat] 削弱每回合自動恢復公式 (`CombatSystem.ts`, `ATTRIBUTE_SYSTEM.md`)**
  - **HP 恢復**：由 `CON * 0.5` 削弱為 `CON * 0.2`。
  - **MP 恢復**：由 `SPR * 0.5` 削弱為 `SPR * 0.2`。
  - **效果**：大幅降低 20 回合超時平手率，戰鬥節奏回歸快節奏與戰術打擊感。
- **[UI/Combat] 浮動文字頭頂提示與對話框洗版優化 (`CombatUIManager.ts`)**
  - **日誌乾淨化**：例行性每回合恢復不再寫入下方文字對話框（`logArea`），還給玩家乾淨的傷害與技能記錄。
  - **頭頂浮動文字**：恢復時在角色頭頂跳出 🟢 `+N HP` 綠字與 🔵 `+N MP` 藍字動畫。
- **[UI/Combat] 戰鬥重播渲染水藍色 MP 條、46px 大頭像與精緻名字 (`CombatUIManager.ts`, `index.html`)**
  - **MP 能量條**：在綠色 HP 條下方渲染水藍色 MP 條 (`.combat-mp-fill`)，於技能施放與 MP 恢復時同步即時平滑充能/消耗動畫。
  - **頭像框加大**：頭像框由 32px 放大至 `46px × 46px` (正方形 1:1 無拉伸邊框)，魔物 Icon 放大至 `1.8em`。
  - **名字字體縮小**：名字縮小至 `0.72em`，讓版面呈現黃金比例的工整質感。

## [2026-08-02] 修復傭兵卡片頭像垂直拉伸變形漏洞

- **[Fix/UI] 修復英雄卡牌頭像比例拉伸缺陷 (`AdventurerCard.ts`, `ModalController.ts`)**
  - **修復**：將精靈圖 CSS 樣式從 `background-size: 600% 400%` 升級為 `background-size: auto 400%`。
  - **效果**：使 6x4 英雄頭像庫的小圖置於長方形卡牌容器中時，保持完美的 1:1 正方形比例並以 `cover` 方式自然置中覆蓋，徹底消除英雄五官垂直拉長變形的缺陷，還原原圖高顏值神韻。

## [2026-08-02] 打造獨立自宅總倉庫 Modal 與標準 5 欄正方形物品網格

- **[Feature/UI] 獨立自宅總倉庫 (`#modal-base-warehouse`)**
  - **功能拆分**：將自宅「檢視倉庫」從鐵匠鋪打鐵介面完全獨立拆分，打造專屬於自宅套房的 `📦 領主總倉庫`。
  - **分頁結構**：提供 `🛡️ 儲備裝備`、`🧲 素材與附魔石`、`📦 交易品物資` 3 大專屬儲藏分頁。
- **[UI/Layout] 修復自宅總倉庫物品方格比例 (100% 還原 85px x 85px 正方形)**
  - 修正彈窗寬度均分導致卡片被橫向拉伸成 165px 寬扁平矩形的視覺缺陷。
  - 將網格改為 `repeat(auto-fill, 85px)`，並強制限制卡片長寬為 `width: 85px; height: 85px; aspect-ratio: 1/1`，完美還原參考圖中緊湊正方形小方格的精緻品質。

## [2026-08-02] 修復存讀檔里程碑遺漏導致重複刷新領取獎勵 Bug

- **[Fix/Save] 修復 `GameState.milestones` 存讀檔遺漏漏洞 (`SaveManager.ts`)**
  - **修復**：`SaveManager.saveGame` 現已將 `milestones` 與 `pendingMilestones` 寫入 JSON 存檔中，並在 `loadGame` 時正確還原。
  - **解決問題**：徹底解決每次讀檔進入遊戲後，系統誤判所有已達成里程碑為「首次達成」並重複刷新領取金幣與聲望獎勵的漏洞。

## [2026-08-02] 實裝單次與多波次討伐據點消失條件與 UI 動態提示

- **[Feature/Dispatch] 單次與多波次討伐機制明確分立與消失條件 (`DispatchSystem.ts`, `MapDynamicsSystem.ts`)**
  - **單次討伐 (1波)**：討伐成功後獲得金幣、聲望與戰利品，據點**保留在地圖上**供玩家重複練級與刷資源。
  - **連續平定 (3波)**：傭兵小隊連續戰勝 3 波敵軍全勝後，據點被判定徹底平定，**從地圖上平定消失**，並發放首殺高額獎勵。
- **[UI/Dispatch] 派遣介面新增動態說明提示 (`index.html`, `ModalController.ts`)**
  - 在討伐隊伍編制彈窗中新增 `#subjugation-mode-hint` 動態說明容器。
  - 切換【單次 (1波)】與【連續 (3波)】單選鈕時，即時更新相對應的據點消失與獎勵提示，為玩家提供清晰明確的遊戲預期。

## [2026-08-02] 移除武器錯誤混沌普攻並還原對應傷害屬性

- **[Fix/Combat] 修復武器普攻傷害類型漏洞 (`CombatSystem.ts`)**
  - **修復**：移除舊代碼誤將 `SCYTHE` (戰鐮), `MAGIC_RING` (魔法戒指), `MAGIC_BOW` (魔法弓) 普攻判定為 `CHAOS` 混沌傷害的漏洞。
  - **還原屬性**：
    - `SCYTHE` (戰鐮 / 死靈法師) 與 `MAGIC_RING` (魔法戒指 / 詭術師) 普攻還原為 **魔法傷害 (`DamageType.MAGICAL`)**。
    - `MAGIC_BOW` (魔法弓 / 精靈使) 普攻還原為 **物理傷害 (`DamageType.PHYSICAL`)**。
    - 全面還原 [CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md) 設計，混沌傷害僅在專屬技能觸發。

## [2026-08-02] 全局戰鬥平衡重構、屬性二次雙重加算 Bug 修復與怪物 PDEF/MDEF 獨立

- **[Fix/Combat] 修復傷害計算中的「屬性二次雙重乘算 (Double Dipping)」Bug (`Skill.ts`)**
  - **修復**：移除 `calculateSkillDamage` 中對 `STR`/`INT` 的 `atkMultiplier` 二次乘算。面板 `PATK` 與 `MATK` 已經包含了屬性點數加算，移除二次乘以 $(1 + \frac{\text{屬性}}{100})$ 避免玩家傷害暴走與對怪物的雙標不對等問題。
- **[Refactor/Monster] 怪物數據結構新增獨立 `pdef` (物防) 與 `mdef` (魔防) 欄位 (`types.ts`, `MonsterSystem.ts`, `CombatSystem.ts`)**
  - **物魔雙防獨立**：在 `MonsterInstance` 中將原本單一的 `defense` 拆分為 `pdef` 與 `mdef`，配合 4 大種族（亡靈高物魔雙防、魔物高物防低魔防、人類均衡、龍族史詩高防）分配防禦。
  - **雙防穿透體驗**：魔劍士與異端拷問官的「混合傷害」現能真實發揮打穿高物防怪弱點的戰術價值。
- **[Balance/Monster] 重構怪物攻防與血量轉化倍率 (`MonsterSystem.ts`)**
  - 取消舊有的 `/2` 削弱限制，使怪物的護甲具備 15%~30% 的實質護甲減傷，且血量支撐隊伍 2~4 回合的拉鋸戰，解決 86 戰力怪物被一刀秒殺的失衡問題。
- **[UI/Power] 校正冒險者綜合戰力評估演算法 (`Adventurer.ts`)**
  - 將裝備提供的 `PATK`, `MATK`, `PDEF`, `MDEF`, `HP` 加成計入 `getPower()` 戰術折算，使穿著裝備的傭兵戰力精準反映其實際實力，為玩家提供可靠的勝算參考。

## [2026-08-02] 修復讀取存檔時鍛造屋等級遭誤覆寫 Bug

- **[Fix/Save] 修復讀取存檔時未建造鍛造屋自動升為 1 級的 Bug (`SaveManager.ts`, `ShopController.ts`)**
  - **根本原因**：`SaveManager.ts` 在還原存檔時使用 `if (!t.forgeLevel)` 判定舊存檔相容，當存檔中 `forgeLevel` 為 0 級時（未建造），`!0` 評估為 `true`，導致讀檔時強制將 0 級覆寫為 1 級。
  - **修復方案**：將 `SaveManager.ts` 的條件改為精確的 `if (t.forgeLevel === undefined) t.forgeLevel = 0;`，並將 `ShopController.ts` 中的預設層級改為 `0`，確保新遊戲存檔再讀檔後鍛造屋不會無故開啟。

## [2026-08-02] 修復駐軍戰力浮點數與討伐建議戰力精準連動

- **[Fix/Combat] 修復駐軍戰力浮點數取整問題 (`MonsterSystem.ts`, `ModalController.ts`)**
  - 使用 `Math.round()` 對敵軍總戰力 (`garrisonPower`) 進行取整，修復偵查情報顯示 `86.39999999999999` 等浮點數連環 9 贅字的 Bug，全介面統一展示乾淨整數戰力（如 `86`）。
- **[Fix/Dispatch] 修復討伐派遣「建議戰力」與據點真實駐軍戰力連動 (`ModalController.ts`)**
  - 將討伐派遣彈窗中的 `minPowerRequired`（建議戰力）修正為優先取用並對齊據點偵查後的真實駐軍戰力 (`garrisonPower`)。
  - 修復過去死板公式算出的建議戰力（如 39）與據點真實戰力（如 86）嚴重脫節、誤導玩家派遣慘敗的問題。

## [2026-08-02] 冒險者頭像框等比放大與 24 款英雄頭像圖集實裝

- **[UI/Avatar] 冒險者詳細面板頭像框等比放大 (`index.html`, `ModalController.ts`)**
  - 將冒險者詳細資訊面板中的左上頭像框尺寸從 `64px × 64px` 等比放大至 `82px × 82px`，完美貼合右側【等級/稱號/HP/MP/EXP 狀態條】的總高度，徹底消除頭像下方的空白留白。
- **[Assets/UI] 實裝 24 款魔獸/奇幻英雄頭像圖集 (`avatars_6x4.jpg`, `ModalController.ts`, `AdventurerCard.ts`)**
  - 匯入並裁切 6×4 英雄頭像圖集 (`public/assets/avatars_6x4.jpg`)，涵蓋 24 位經典奇幻/魔獸英雄角色。
  - 更新頭像渲染樣式 `background-size: 600% 400%`，搭配 `nameHash % 24` 自動分派與持久化，讓冒險者詳細面板、酒館招募、小隊編制與官職卡片全數套用高質感英雄頭像！

## [2026-08-02] 修復自宅探索動態討伐據點生成與可見性

- **[Fix/MapDynamics] 修復自宅探索討伐據點不可見 Bug 並限制生成於已揭開迷霧區域 (`MapDynamicsSystem.ts`)**
  - **修復據點可見性**：在 `spawnDynamicNode()` 生成動態討伐據點時，補上 `isDiscovered: true` 屬性標記，解決地圖過濾器將其隱形判定、導致玩家地圖上看不到也點不到該據點的 Bug。
  - **限定已揭開迷霧區域**：在座標搜尋迴圈加入 `explorationSystem.isPointRevealed(newX, newY)` 檢定，確保自宅探索生成的討伐/練功據點 100% 只會落在玩家領地近距離（極限距離 $\le 10$）且**已揭開迷霧**的視野區域內。
  - **保護預設據點**：保留地圖預設靜態據點於斥候遠征探索機制，自宅探索專注於周邊近距離練功/討伐據點生成。

## [2026-08-02] 里程碑獎勵去除繁榮度與鍛造屋初始等級調整

- **[MilestoneSystem] 里程碑獎勵去除繁榮度，全面改為金幣獎勵 (`MilestoneSystem.ts`)**
  - 移除「首次分配工人」、「人口達 15 人」、「第一棟建築完成」獎勵中的繁榮度（Prosperity）數值，改為發放 50 ~ 100 金幣獎勵，避免早期城鎮繁榮度成長速度過快與打亂晉升節奏。
- **[Territory] 鍛造屋初始等級調整為 Lv0 (`Territory.ts`)**
  - 將玩家領地 `this.forgeLevel` 初始值由 `1` 修正為 `0`。玩家開局不會再免費獲得鍛造屋，必須在領地自宅花費資源建造後方可解鎖與使用，同時解決高難度開局誤觸第一棟建築里程碑的問題。

## [2026-08-02] 修復：儲存並退出後畫面空白問題

- **[Bugfix] 退出遊戲後主選單空白 (`UIManager.ts`, `GameFlowController.ts`, `main.ts`)**
  - **根本原因①**：`clearAllUIOverlays()` 的選擇器 `.view` 同時匹配到 `#main-menu-view`，導致其 `style.display` 被強制設為 `none`（inline style 優先權高於 CSS class），使主選單在 `active` class 被加回後仍然不可見。
  - **修復①**：將選擇器改為 `.view:not(#main-menu-view)`，排除主選單，確保其 display 不受 overlay 清理邏輯影響。
  - **根本原因②**：退出後沒有重新呼叫 `renderSaveSlots()`，即使畫面顯示正常，存檔列表也不會更新。
  - **修復②**：`initGameFlowController` 接收 `rebindUIEvents` 參數，退出時在顯示主選單後立即呼叫 `renderSaveSlots(rebindUIEvents)` 重新渲染最新存檔。

- **[Bugfix] 讀取存檔後場景畫面空白 (`SceneController.ts`, `MainMenuController.ts`)**
  - **根本原因①（主因）**：退出時 `clearAllUIOverlays()` 以 `style.display = 'none'` 強制隱藏所有 `.view` 元素（包含 `scene-view`、`wilderness-view`、`map-view`）。這些 inline style 在 DOM 中持續殘留。讀檔後呼叫 `classList.add('active')` 雖然加上了 CSS class，但 inline style 的優先權更高，導致畫面仍然空白。
  - **根本原因②（加速劑）**：`enterScene()` 原本自帶 `UIManager.playTransition()` 包裝，而讀檔流程已在 `playTransition` callback 內呼叫 `enterScene`，造成 transition 雙重嵌套，加重了顯示失敗的機率。
  - **修復①**：在所有 `classList.add('active')` 後加上 `style.display = ''`，清除殘留的 inline style，讓 CSS class 優先權正確生效（`SceneController.ts` 的 `sceneView`、`wildernessView`、`mapViewEl`、`facilityView`；`MainMenuController.ts` 的 `mapView`）。
  - **修復②**：`enterScene()` 改為不帶 transition 的純場景切換，新增 `enterSceneWithTransition()` 供需要黑屏轉場的直接呼叫方（`GameFlowController`、`MapController`、`ActionController`、`ModalController`）使用。

- **[Refactor] 統一視圖顯示控制架構，建立規範文件 (`UIManager.ts`, `SceneController.ts`, `MainMenuController.ts`, `FacilityController.ts`, `index.html`, `docs/UI_DISPLAY_CONVENTION.md`)**
  - **問題根源**：歷史上為解決「退出時介面殘留」問題，多次在 `clearAllUIOverlays()` 和 `returnToMap()` 加入 `style.display = 'none'`，形成與 CSS class 互相衝突的雙重控制機制。
  - **重構內容**：徹底移除所有 `.view` / `.facility-view` 的 inline `style.display` 操作（共涉及 5 個檔案），改為純 CSS class 控制。CSS 已定義 `.view { display:none }` / `.view.active { display:flex }`，只需 `classList.add/remove('active')` 即可正確控制顯示。
  - **HTML 整理**：`#view-forge` 的大量 inline style 移至 CSS `#view-forge {}` 規則中，HTML 元素只保留 `class="facility-view"`。
  - **新增規範文件**：建立 [`docs/UI_DISPLAY_CONVENTION.md`](file:///i:/gameproject/Medieval/docs/UI_DISPLAY_CONVENTION.md)，說明正確做法、禁止事項、元素分類表、transition 嵌套規範，以及 Bug 案例記錄，供接手開發者遵循。

## [2026-08-02] 鍛造屋 100% 滿版無對話框、傭兵小隊 3 欄卡片網格與標籤精密過濾實作 (New!)

- **[Fix/UI] 徹底移除 index.html 中殘留的 forge-window-container 容器 (`index.html`)**
  - 從 HTML 結構中徹底刪除 `#forge-window-container` 彈出對話框外殼，使鍛造屋視圖 (`#view-forge`) 與領主書房 (`#view-base`) 保持 100% 完全一致的全螢幕滿版場面，不再有任何四周黑框與對話框夾邊！
- **[UI/Assets] 全遊戲預覽面板與武器商店圖示全面統一 (`ShopController.ts`)**
  - 將鍛造屋右側「裝備強化」、「裝備鍛造/重鑄」、「元素加工」三大預覽面板以及「領地武器店」商品卡片全數改為導用 `renderEquipIcon` 渲染寶劍 PNG 圖示。
  - 徹底消滅所有遺留的文字 Emoji，全專案達到 100% 完全視覺對齊！
- **[Data/Forge] 變異配方標籤化 (isVariant & requireTomeId) 與精密隱藏過濾**
  - 在 `CraftingRecipes.json` 中為所有變異職業重鑄配方打上 `"isVariant": true` 與 `"requireTomeId"` 標籤。
  - 在 `ShopController.ts` 中實作標籤過濾：未取得重鑄書圖紙的變異職業配方，**100% 隱藏不予顯示**。全數更名為「裝備重鑄」與「重鑄」（徹底去除神兵字眼）。

- **[UI/Forge] 滿版半透明雙欄 Layout (`index.html`, `ShopController.ts`)**
  - 採用全螢幕滿版場面，襯托 `forge_workshop_bg.png` 背景圖。
  - 左欄與右欄採用**半透明黑褐色玻璃質感 (`background: rgba(18, 14, 11, 0.72)`)**，自然透出後方高溫火爐背景（100% 對齊用戶截圖一與截圖二）。
- **[UI/Forge] 裝備強化【傭兵小隊選裝備卡片 + PATK/MATK 顯示】(`ShopController.ts`)**
  - 左欄採用「傭兵小隊選擇隊員」卡片框體呈現倉庫裝備，明確標示 `⚔️ 物攻 (PATK)`、`🔮 魔攻 (MATK)`、`🛡️ 物防 (PDEF)` 與 `✨ 魔防 (MDEF)`。
  - 點擊卡片高亮邊框並即時更新右欄升級預覽（綠字對比）與 `🔨 執行強化` 按鈕。
- **[UI/Forge] 裝備鍛造 & 裝備重鑄【100% 對齊截圖一】(`ShopController.ts`)**
  - 左欄提供配方列表；右欄上方顯示目標產出裝備卡片、中間 `═══ 所需材料與前置裝備 ═══` 橫向一排正方形框體 (`64px x 64px` + `0/5` 數量)、下方消耗金幣與中央大號 `合成` / `重鑄` 按鈕。
  - **措辭與過濾規範**：全數使用「裝備重鑄」與「重鑄」（**徹底刪除『神兵』或『專屬神兵』字眼**）；若未取得重鑄書/圖紙，自動隱藏該重鑄項目。
- **[UI/Forge] 元素加工附魔【傭兵小隊選裝備 + 5 大元素石 (對齊圖三)】(`ShopController.ts`)**
  - 左欄採用傭兵卡片選擇倉庫裝備，右欄顯示 5 大元素石正方形框體 (🔥熾炎石、❄️霜冰石、⚡疾雷石、☀️聖光石、🌙暗影石) 與 `注入元素` 按鈕。

- **[UI/Forge] 960px x 640px 居中精緻 RPG 視窗 (`index.html`, `ShopController.ts`)**
  - 捨棄滿版極端拉伸，將鍛造屋重構為經典居中固定比例 RPG 視窗 (960px x 640px)，配合古樸暗木紋與精緻金屬邊框，呈現最佳視覺比例。
- **[UI/Forge] 裝備強化【傭兵小隊網格卡片框體 (Grid Cards)】(`ShopController.ts`)**
  - 完全對齊傭兵小隊介面，採用 3 欄網格卡片框體呈現倉庫裝備，每一張卡片獨立展現圖示、名稱、`+現有等級`、階級 T1~T4、雙攻雙防屬性、成功率與強化按鈕。
- **[UI/Forge] 裝備鍛造 & 裝備重鑄【左側選單 + 右側合成火爐 (對齊圖二)】(`ShopController.ts`)**
  - 修復左側配方條列點擊切換 Bug，點擊任意配方即時更新右側工坊。
  - 右側完全對齊參考圖二：上方目標神兵卡片、中間**所需材料與前置裝備正方形框體 (`64px x 64px` + `1/1`, `0/8` 數字)**、下方金幣花費與中央大號 `合成` / `重鑄` 按鈕。
  - **變異職業重鑄過濾**：若玩家尚未獲得對應變異職業重鑄書/圖紙，自動隱藏該變異重鑄項目，僅展示一般職業重鑄。
- **[UI/Forge] 元素加工附魔【網格選裝備 + 5 大元素石 (對齊圖三)】(`ShopController.ts`)**
  - 上方採用卡片框體選擇倉庫裝備，下方完全對齊參考圖三：橫向一排 5 大元素石卡片框體 (🔥熾炎石、❄️霜冰石、⚡疾雷石、☀️聖光石、🌙暗影石) 並標示擁有數量，按下 `💎 注入元素附魔` 執行加工。

- **[Fix/UI] 徹底修復鍛造屋無法點擊進入 Bug (`index.html`, `FacilityController.ts`)**
  - 清除 `#view-forge` 容器 HTML 標籤上的殘留行內樣式 `display: none;`（該行內屬性權重要於 CSS `.active` 類別規則，導致點擊建築時無法呈獻視圖）。
  - 在 `FacilityController.ts` 中的 `enterFacility` 函式顯式強制寫入 `el.style.display = 'flex'`，並在退出時設定 `display = 'none'`，徹底防止任何樣式衝突。
- **[Fix/System] 修復鍛造屋建築初始化等級問題 (`Territory.ts`, `SaveManager.ts`)**
  - 將玩家領地 `Territory` 預設的 `forgeLevel` 初始化為 `1`（原為 0），確保創建新遊戲與讀取舊存檔時，領地街道上的 **鍛造屋 (Forge Workshop)** 均能直接解鎖並進入。
- **[UI/Forge] 設施名稱全數統一更名為「鍛造屋」 (`SceneController.ts`, `index.html`, `ShopController.ts`)**
  - 全數將過往稱呼「鐵匠鋪」順手重構修正為符合現代奇幻 RPG 風格的 **「鍛造屋 (Forge Workshop)」** 系列（初級鍛造屋、進階鍛造屋、皇家鍛造屋、頂級鍛造屋）。
- **[UI/Forge] 專屬鍛造屋背景圖 (`forge_workshop_bg.png`, `index.html`)**
  - 生成並導入專屬黑暗中世紀鍛造屋背景圖 (`forge_workshop_bg.png`)，包含高溫火爐、赤熱鐵砧與飛濺火花。
  - 重構 `#view-forge` CSS 與 HTML，全面捨棄彈窗（Modal），進入鍛造屋直接呈獻滿版工坊。
- **[UI/Forge] 左右雙面板 (Left-Right Split Layout) 交互對齊 (`ShopController.ts`, `FacilityController.ts`)**
  - **左側選單 (35% 寬度)**：以傭兵/裝備卡片框體方式呈現裝備與配方清單（垂直滾動點選）。
  - **右側主工坊 (65% 寬度)**：
    - 🔨 **【裝備強化】**：顯示選中裝備大圖標、`+現有` ➔ `+預覽` 數值變動（綠字對比）、費用率與大型 `🔨 執行高溫強化` 按鈕（對齊參考圖一）。
    - ⚒️ **【裝備鍛造】 & ♨️ 【裝備重鑄】**：上方產出目標大卡片、中間**橫向一排所需材料與前置裝備獨立卡片框體**（紅綠字標明已有/所需）、下方費用與大型 `⚒️ 合成` / `♨️ 重鑄` 按鈕（對齊參考圖二）。
    - 💎 **【元素附魔】**：上選中裝備、中 5 大元素石卡片框體（熾炎石、霜冰石、疾雷石、聖光石、暗影石）、下 `💎 注入元素` 按鈕（對齊參考圖三，完全捨棄選單下拉框）。
    - 🧲 **【素材與背包】**：緊湊型小卡片與交易品資產估算排版。
- **[System/Forge] 裝備重鑄等級解鎖機制 (`ShopController.ts`)**
  - ♨️ **【裝備重鑄】** 頁籤僅在 **鐵匠鋪等級 >= 3 (`forgeLevel >= 3`)** 時才會解鎖顯示。

- **[System/Enhancement] 裝備強化絕對絕對計算法與 Bug 根治 (`EnhancementSystem.ts`, `types.ts`, `EquipmentGenerator.ts`)**
  - 新增 `baseCombatEffects` 原始基底屬性固定備份。
  - 強化屬性改為絕對值公式計算：`combatEffects = baseCombatEffect * (1 + 0.1 * level)`。
  - 徹底修復強化降階失敗時屬性未扣除導致數值暴增至 ATK +2830 / EVADE +1554 的重大 Bug。
- **[Data/Equipment] 裝備數據庫全數對齊物魔雙軌 (PATK, MATK, PDEF, MDEF) (`EquipmentTemplates.json`)**
  - 武器依類別精確配置 `patk` 與 `matk`。
  - 防具全數統一提供 `pdef` 與 `mdef` (布甲高魔防/低物防、重鎧高物防/低魔防、皮甲雙防均衡)。
- **[Data/Materials] 5 大元素附魔石數據庫 (`materials.json`)**
  - 新增 5 大元素附魔石：`mat_element_fire` (熾炎石 🔥)、`mat_element_ice` (霜冰石 ❄️)、`mat_element_lightning` (疾雷石 ⚡)、`mat_element_holy` (聖光石 ☀️)、`mat_element_dark` (暗影石 🌙)。
- **[UI/Forge] 鍛造屋 4 大分頁與全卡片框體排版 (`ShopController.ts`, `index.html`)**
  - 完全採用與自宅/傭兵小隊同風格的古樸深色木紋羊皮紙卡片框體設計。
  - 實作 4 大鍛造屋分頁：
    - 🔨 **【裝備強化】**：展示裝備卡片、雙攻雙防數值標籤與 `🔨 強化` 按鈕。
    - ⚒️ **【裝備鍛造】**：展示基礎與進階裝備直接製作配方、素材需求與合成按鈕。
    - ♨️ **【裝備重鑄】**：獨立分頁！展示 12 大職業 T4 專屬重鑄配方（檢查前置 T3 裝備 + 素材 + 金幣）。
    - 💎 **【元素加工附魔】**：可自由選擇裝備並消耗元素附魔石，注入並覆蓋 5 大元素屬性。
  - 實作 3 大倉庫分類獨立分頁 (裝備、素材與附魔石、交易品)，其中素材與交易品採用緊湊型小卡片與數量 Stack 標籤排版。

## [2026-08-02] 物魔雙軌屬性重構與 3 欄戰鬥屬性面板即時連動實作

- **[Model/Types] 物魔雙軌屬性模型擴充 (`types.ts`, `Adventurer.ts`)**
  - 將派生戰鬥屬性重構為物魔雙軌：`patk` (物理攻擊力 = STR * 2), `matk` (魔法攻擊力 = INT * 2), `pdef` (物理防禦力 = CON + ⌊STR * 0.5⌋), `mdef` (魔法防禦力 = CON + ⌊SPR * 0.5⌋)。
  - 新增 `critRate` (爆擊率 %) 與 `critDmg` (爆擊傷害 %)，支援神射手/戰弓等特化被動。
- **[Combat/Skill] 技能與普攻算式精確對齊 (`Skill.ts`, `CombatSystem.ts`, `CLASS_SYSTEM.md`)**
  - `calculateSkillDamage()` 自動依 `DamageType.PHYSICAL` 取用 `patk`/`pdef`，依 `DamageType.MAGICAL` 取用 `matk`/`mdef`。
  - **混傷與混沌技能數值精態微調**：
    - 死靈法師【死神收割】：下修為 `200% CHAOS`（原 250%），兼顧基礎法術火力與無視防禦連鎖斬殺。
    - 符文騎士【符文反制】：下修為 `120% CHAOS`（原 150%），彌補騎士基礎技能弱勢並保留扎實全體反制。
    - 魔劍士【幻影連擊】：調整為單擊 `55% PATK + 55% MATK`（4 連打），展現物魔對等雙修特色。
    - 異端拷問官【終焉審判】：移除過往算式中多乘的 `3.0` 盲目倍率，還原為單次打擊 `70% PATK + 30% MATK` 兼具全隊 HP/MP 回復。
- **[UI/Panel] 傭兵頁面 Layout 重構與即時加點預覽 (`ModalController.ts`)**
  - 調整頁面動線：基礎屬性加點區置於上方，整合 `✨ 可用點數` 與配點按鈕；戰鬥屬性區置於下方。
  - 戰鬥屬性採用 3 欄 Grid 排版 (`grid-template-columns: 1fr 1fr 1fr;`)，涵蓋全 11 項派生戰鬥數值。
  - 點擊 `+` / `-` 配點時，頂部綜合戰力與下方全套戰鬥屬性即時動態運算並呈獻綠字 `(+X)` 變動預覽。

## [2026-08-01] 裝備數據庫、T4/T5 鍛造重鑄、商店限制與法杖/魔法弓元素技能實作

- **[Data/Equipment] 12 大官方職業武器與三類防具 T1~T4 數據庫 (`EquipmentTemplates.json`)**
  - 完全對齊 `CLASS_SYSTEM.md` 的 12 種職業官方武器與布/皮/鎧防具。
  - T1~T3 一般武器常態討伐掉落；武器店與防具店僅販售 T1 與 T2 裝備。
  - 變異職業武器（雙劍、戰鐮、魔法弓、符文盾、魔法戒指、戰鎚）T1~T3 完全不存在，僅能在鍛造所透過 **T3 一般基礎武器 + 特殊素材** 重鑄打造為 T4 變異武器。
- **[System/Forge] 鍛造所重鑄與製作配方庫 (`CraftingRecipes.json`)**
  - 支援 T4 重鑄與 T5 獨特功能裝備製作。
- **[System/Skill] 法杖雙元素目標屬性轉變與魔法弓 6 大元素必殺技 (`Skill.ts`)**
  - 法杖第一元素（火/雷/冰）為 140% ATK 單體傷害；第二元素（火/雷/冰）為 20% ATK 傷害並**強制將目標元素屬性轉變為火/雷/冰**。
  - 精靈使魔法弓依據附魔元素切換為【風精靈之舞】、【火精靈之怒】、【冰精靈之刺】、【雷精靈之殤】、【聖靈之光】與【暗靈之凝】。

## [2026-08-01] 敵陣營系統、40種怪物名單與元素相剋機制實作 (New!)

- **[Data/Monsters] 48 種基礎怪物資料庫與 DRAGON 一般怪物 (`src/data/monsters.json`)**
  - 擴充並重構至 48 種非 Boss 基礎怪物模板，涵蓋全 8 種地形。
  - 包含 **10 種 `DRAGON` 種族一般怪物**（毒蜥、蜥蜴王、雙足幼龍、飛龍、巨角蜥、骨龍獸、幼九頭蛇、熔岩蜥、迅雷飛龍、沼澤毒龍），在遭遇抽取時具備較低出現率 (權重 0.25x)，且少部分（如毒蜥、巨角蜥、骨龍獸、沼澤毒龍）相容 `UNDEAD` 質變標籤（如 `[不死的]毒蜥`、`[黑暗的][不死的]骨龍獸`）。
- **[System/Naming] 種族質變與元素動態前綴組合 (`MonsterSystem.ts`)**
  - 實作前綴組合邏輯：`[元素前綴][種族質變前綴][基礎名稱]`。
  - 單一允許 `UNDEAD` 怪物不加種族前綴（如 `骷髏`），多相容標籤抽到 `UNDEAD` 冠上 `[不死的]`（如 `[不死的]哥布林`）。
  - 元素前綴支援 `[火焰的]`、`[冰冷的]`、`[雷電的]`、`[聖光的]`、`[黑暗的]`（如 `[黑暗的][不死的]哥布林`、`[火焰的]骷髏`）。
- **[Combat/Elements] 精確元素相剋運算與算式 (`Skill.ts`, `CombatSystem.ts`)**
  - 實作 `getElementalMultiplier()`：
    - 三元相剋：冰 ➔ 火 ➔ 雷 ➔ 冰（順剋 1.25x，逆剋 0.75x）。
    - 光暗互剋 1.5x；光/暗對火冰雷分別為 1.05x / 1.10x（不逆剋）；火對無屬性 1.05x（不逆剋）。
  - 玩家端透過武器/裝備附帶元素 (`weapon.element`) 與敵人元素於 `calculateSkillDamage()` 自動運算。
- **[System/Scouting] 討伐據點單向隔離與 100% 精確偵查一致性 (`MonsterSystem.ts`, `MapDynamicsSystem.ts`, `ModalController.ts`)**
  - 生靈據點嚴格排除 `UNDEAD`；亡靈據點以 `UNDEAD` 為主體 (70%+) 並允許混入 `HUMAN` / `MONSTER`。
  - 偵查時將敵軍隊伍與情報持久化於 `node.scoutData.garrisonEncounter`，保證偵查顯示、討伐彈窗與戰鬥遭遇敵軍 100% 精確一致。
- **[Docs] 建立未來系統擴充與設計藍圖文件** (`docs/FUTURE_DESIGN.md`)
  - 新增 `docs/FUTURE_DESIGN.md`，作為專案未來 7 大核心系統（陣營敵方單位、裝備數據庫、碎片化敘事、酒館系統、GAMBIT AI、爵位天賦、內政深化）的權威規範文件，並關聯標註專案現有代碼檔案引用鏈。

## [2026-08-01] 迷霧探索機制重構：冒險者手動挑選、金幣糧食成本與長途急行選項實作

- **[System/Exploration] 迷霧探險隊上限與多隊支援** (`ExplorationSystem.ts`, `Exploration.ts`, `GameLoop.ts`)
  - 重構 `ExplorationSystem`，改為支援多個 `ACTIVE` 探險隊伍並加入 `maxExpeditions` 容量架構（預設 1 隊），可經由天賦/爵位/建築動態擴充。
  - 將迷霧視野揭開半徑由原本的 `55` 像素縮小至精緻的 **`35` 像素**，讓大地圖迷霧推進更具層次感。
  - 將每日天數推進 `advanceDay` 重構為走查全體探索隊伍陣列，確保多隊探索狀態同步與結算。
- **[Economy/Costs] 動態金幣與領地糧食探索成本** (`ExplorationSystem.ts`, `ExplorationController.ts`)
  - 實裝探險成本計算公式：`基礎(100金+20糧) + 天數 × (30金+15糧)`。出發時精確自領地資源庫扣除 `gold` 與 `food`，資源不足時予以阻擋。
- **[UI/Fix] 跨存檔切換探索選取狀態與地圖圖層清理，保護主選單靜態彈窗** (`ExplorationController.ts`, `UIManager.ts`)
  - 新增 `resetExplorationControllerState()` 導出函式，強制關閉 `isSelectingTarget = false` 並發送 `exploration-selection-changed` 事件通知 Phaser 地圖擦除綠色虛線邊界圖層。
  - 在 `UIManager.clearAllUIOverlays()` 整合重置清理，保護主選單 `#modal-load-game` / `#modal-new-game` 等靜態 DOM 元素不被誤刪，並精準銷毀動態 `#modal-exploration-dispatch` 彈窗。徹底解決切換存檔殘留與退出後無法進遊戲的 Bug。
- **[Tests] 單元測試與型別修正** (`ExplorationSystem.test.ts`, `RoadSystem.ts`)
  - 更新 `ExplorationSystem.test.ts` 以相容陣列回傳值，修復 `RoadSystem.ts` 邊界型別，36 項單元測試 100% 綠燈通過。

## [2026-08-01] 自然蜿蜒道路網絡與智慧自動分岔延伸系統實作

- **[System/Road] 智慧道路分岔與延伸網絡 (Smart Road Branching & Extension)** (`Road.ts`, `RoadSystem.ts`)
  - 重構 `RoadSystem` 道路建造與連通邏輯。當玩家建造新道路時，系統自動進行方向與距離判定：
    - **據點延伸 (Node Extension)**：若目標據點與現有道路網上的既有據點順路，自動選擇從該據點延伸（如 `黃金渡口 ➔ 赤砂城 ➔ 燼風前哨`），徹底修復之前因大波浪碰撞誤判退回導致的超長越過據點直連線 Bug。
    - **中途 Y型分岔 (Mid-road Curve Branching)**：若目標據點離既有主幹道路線段中段近，自動優先計算曲線投影點作為分岔點，建立自然蜿蜒的 Y型/T型三叉路口。
  - **圖連通性 (Graph BFS)**：實裝 `hasNetworkConnection()` 廣度優先搜尋，全網連通即享道路加速與貿易減免效益。工期與長度僅計算「新增延伸段」長度。
- **[UI/Render] 顯著自然山路波浪弧度演算法 (35~65px Noticeable Organic Curve)** (`MapScene.ts`, `RoadSystem.ts`)
  - 提升彎曲擺幅至 **35 ~ 65 像素 MAX**，搭配手繪微幅波浪（`getSmoothCurvePoint`），解決先前 16px 擺幅在長距離下視覺看起來像直線的問題。
  - **細緻化瘦身**：將道路線條總寬從粗重向量感的 `8px` 大幅縮減為細緻的 **`4px` 外底邊與 `2px` 內徑**。
  - **自然羊皮紙配色**：採用古樸暖深褐色 (`0x4a2c11` / alpha 0.65) 與羊皮泥土棕 (`0xa37b42` / alpha 0.85)，線條帶半透明感自然融入大地圖背景。
- **[Tests] 單元測試與存檔向下相容** (`RoadSystem.test.ts`)
  - 補齊圖連通性與智慧分岔邏輯單元測試，全套 36 項單元測試 100% 綠燈通過。

## [2026-07-31] CHEAT 測試武器補齊與裝備限制職業標籤機制實作

- **[Fix] 修正退出遊戲回主選單未徹底清理多欄抽屜與子彈窗之 Bug** (`index.html`, `UIManager.ts`, `GameFlowController.ts`)
  - 將 `.side-panel-left` 的預設隱藏定位 `left` 從 `-460px` 擴大修正為 `-1500px`，解決當傭兵小隊展開第 2 欄 (屬性詳細) 與第 3 欄 (裝備選擇) 時總寬達 1200px、導致收回時剩餘 740px 依然殘留在主選單畫面上的 Bug。
  - 在 `UIManager` 實裝 `clearAllUIOverlays()` 徹底清理函式，並於「退出遊戲」及關閉抽屜時調用，完整關閉與重置所有 `side-panel-left/right`、`modal-overlay`、`party-details-pane`、`party-equip-select-pane` 與浮動 `adv-tooltip`。

- **[UI/UX] 傭兵小卡片底部官職/職缺標籤排版往下修正** (`AdventurerCard.ts`, `index.html`)
  - 將 `AdventurerCard.ts` 中底部橢圓膠囊標籤（如「城主」、「扈從」、「空位」）的定位 `bottom` 從 `-8px` 向下微調至 `-13px`，精緻化 padding 與外陰影。
  - 同時為卡片底欄資訊區塊 `.adv-card-info` 加入 `padding-bottom: 2px`，徹底解決標籤向上向上疊加遮擋「`Lv.XX 職業`」等級與職業名稱的問題。

- **[Fix] 修正未裝備對應武器即解鎖終極必殺技與被動之 Bug** (`Skill.ts`, `CombatSystem.ts`)
  - 移除 `Skill.ts` (技能選單與被動展示) 及 `CombatSystem.ts` (戰鬥技能發放) 中原本存在的空手備用邏輯 (`|| !wpnType` / `|| !weaponType`)。
  - 嚴格落實轉職武器綁定機制：滿等傭兵 (Lv.10 + `isAdvanced`) 必須實際穿戴專屬進階武器 (如祈禱者裝備聖典、騎士裝備劍盾、盜賊裝備雙匕首) 方可轉職並解鎖該進階職業之終極必殺技與被動天賦；未裝備武器時維持基礎職業與 2 招基礎技能。
- **[System/Cheat] 全套 12 種 CHEAT 測試武器補齊** (`CheatController.ts`)
  - 將原本 `testwpn` 密技僅包含的 4 種武器擴充為對應全職業轉職路線的 12 種滿等測試武器。
  - 新增武器包含：滿等巨劍、滿等雙劍、滿等劍盾、滿等符文盾、滿等法杖、滿等戰鐮、滿等戰弓、滿等魔法弓、滿等雙匕首、滿等魔法戒指、滿等聖典與滿等戰鎚。
- **[System/Equipment] 裝備限制職業標籤機制** (`types.ts`, `Adventurer.ts`, `EquipmentGenerator.ts`, `DataStore.ts`)
  - 在 `Equipment` 與 `EquipmentTemplate` 介面擴充 `allowedJobs?: string[]` 選填屬性。
  - 在 `Adventurer.canEquip()` 中加入限制職業匹配檢定，若傭兵基礎職業不符合，正確阻擋穿戴並提供「職業不符 (限 戰士)」之錯誤提示。
  - 在 `EquipmentGenerator` 生成實體裝備時，正確將模板的 `weaponType` 與 `allowedJobs` 拷貝傳遞至裝備實體中。
  - 為 `DataStore.EquipmentDB` 現有的 1~3 階正規武器補齊相應的 `allowedJobs` 限制標籤與 `weaponType`。
- **[UI/UX] 裝備選單限制職業標籤與不符提示** (`ModalController.ts`)
  - 在裝備浮動 Tooltip (`#adv-tooltip`) 中新增顯眼的 `🏷️ 限制職業: XXX` 標籤。
  - 在換裝選擇清單中，若傭兵職業不符，裝備卡片顯示半透明遮罩與 `職業不符` 提示，點擊時跳出 Toast 警告提示並阻擋裝備。

## [2026-07-31] 傭兵小隊、角色屬性與裝備選擇面板 UI 全面美化與零跑位結構重構

- **[UI/UX] 隱藏未學習技能** (`ModalController.ts`)
  - 調整技能戰術頁面 (`✨ 技能戰術`) 的渲染邏輯，過濾並隱藏未學習/鎖定的主動技能卡片，僅展示傭兵目前實質已學會並可施放的技能與被動，使畫面更為俐落乾淨。
- **[Fix] 技能戰術頁籤事件綁定修正** (`GameFlowController.ts`)
  - 修復 `GameFlowController.ts` 中未對新頁籤 `#tab-btn-skills` 綁定 `click` 事件導致頁籤無法點擊切換的 Bug。
- **[UI/UX] 技能與被動總覽頁籤 (`✨ 技能戰術`) 與 Gambit 戰術預留** (`index.html`, `ModalController.ts`, `Skill.ts`)
  - 於傭兵詳情頁擴充第 3 個頁籤 `✨ 技能戰術`，分類展示已學習的主動技能（金邊卡片、MP/CD 標記）、未解鎖/未學習技能（`🔒 未學習` 低調鎖定卡片）以及職業被動天賦。
  - 技能卡片掛載跟隨指標 Tooltip (`#adv-tooltip`)，懸浮即刻展示技能效果說明與目標索敵機制。
  - 頁面下方預留專屬 Gambit 戰術卡槽容器 (`#gambit-strategy-container`) 與 If-Then 條件條，為未來的自訂自動戰鬥邏輯與策略優先級做足無縫擴充佈局。
  - 將 `#modal-party-list` 容器的背景定位改為固定錨定 (`left top / 1920px 1080px no-repeat`)。
  - 徹底解決依序展開第 2 欄與第 3 欄時，因為容器寬度改變導致背景羊皮紙圖案被迫重新拉伸變形、滑動跳動的問題。現在展開新欄位時，背景圖案 100% 絕對靜止固定。
- **[UI/UX] 屬性配置全固定零跑位排版 (Fixed Zero-Jitter Layout)** (`ModalController.ts`, `index.html`)
  - 將「可用點數」併入戰力 Banner 同橫排（左側 `⚔️ 戰力：66` | 右側 `✨ 可用點數：X`），省去原單獨一整排底框佔用空間。
  - 將底部的「確認分配」與「重設」按鈕全固定留置，未加點時呈現低調禁用樣式 (`disabled / opacity: 0.35`)，點擊 `+` 加點瞬間激活，**實現動態加點過程全元素位置寫死固定、零彈跳與零跑位**。
  - 調整頭像容器高度至 `66px`，與右側等級職業文字及 HP/MP/EXP 進度條高度 1:1 滿鋪平齊，徹底解決頭像下方殘留黑色空隙的問題。
- **[UI/UX] 90px 三欄裝備卡片 (3-Column Grid) 與 1:1 傭兵卡片對齊** (`ModalController.ts`)
  - 將裝備選擇卡片尺寸與網格嚴格寫死為 `width: 90px; height: 100px;`（`repeat(3, 90px)`），完全 1:1 對齊左側傭兵卡片 (`adventurer-card`) 的寬度與視覺比例，徹底杜絕寬大笨重感。
- **[UI/UX] 低調質感血量/魔力/經驗條美化** (`index.html`)
  - 將原本亮原色進度條升級為深邃低調金屬漸層（緋紅 HP / 海藍 MP / 琥珀 EXP）與凹槽內陰影軌道。
  - 加上雙重內襯文字陰影 (`text-shadow`)，確保高對比度與清澈易讀性。

## [2026-07-31] 傭兵小隊介面 (Party UI) 大規模翻新與雙欄擴充

- **[UI/UX] 雙倍寬度動態展開面板** (`index.html`, `GameFlowController.ts`, `ModalController.ts`)
  - 將傭兵小隊介面 (`#modal-party-list`) 從單欄改為雙欄式動態展開。
  - 打開介面時，預設僅顯示「左側：成員列表」，寬度維持約 440px。
  - 點擊任一傭兵卡片後，會自動向右展開「右側：詳細資訊」面板，使整體介面變為兩倍寬，可同時瀏覽列表與詳細狀態。
  - 新增專屬的「❌ 關閉資訊」按鈕，可單獨收起右側詳細資訊面板。
- **[UI/UX] 屬性配置頁籤優化** (`ModalController.ts`)
  - 修正頂端標題的職業名稱，現在只顯示名字。職業資訊移至屬性頁面內。
  - 將「六維屬性」正名為「基礎屬性」，並獨立出「領袖屬性」。
  - 全面優化配點區塊的 Grid 排版，修正過去按 `+/-` 會導致排版擠壓並產生垂直捲動軸的 Bug。
- **[UI/UX] 方框式武裝配備卡片與跟隨式 Tooltip** (`ModalController.ts`)
  - 捨棄原本的長條狀裝備顯示，改為 3 個正方形網格卡片（武器、防具、飾品）。
  - 將雜亂的裝備資訊收納至隱藏資料中，卡片上僅顯示「圖示、名稱、強化等級」。
  - 實作跟隨滑鼠指標 (`mousemove`) 移動的獨立裝備 Tooltip (`#adv-tooltip`)，懸浮時才顯示所有詳細的裝備數值加成與說明。

## [2026-07-31] 智能施法大腦 (Smart AI) 與 5v5 團隊平衡模擬測試

- **[Feature] 大招冷卻機制 (Cooldowns)** (`Combat.ts`, `Skill.ts`, `CombatSystem.ts`)
  - 於 `CombatParticipant` 新增 `cooldowns` 屬性追蹤冷卻狀態。
  - 在戰鬥迴圈起始時自動進行冷卻遞減。
  - 為所有進階職業的終極技能 (如旋風斬、神聖庇護等) 設定 `cooldown: 2` (施放後冷卻 2 回合)，平衡高倍率招式。
- **[Feature] 動態戰略評估系統 (Smart Casting AI)** (`Skill.ts`, `CombatSystem.ts`)
  - 為所有技能實作 `aiWeight` (戰術權重評估公式)，取代原本「隨機挑選最高耗魔技能」的無腦邏輯。
  - **騎士與補師**：聖騎士看全隊血線開盾，大主教能精準判斷異常狀態開啟淨化，不再浪費 MP。
  - **盜賊系**：詭術師會專注疊毒並透過突襲引爆最高 5 層毒素打出爆發；暗殺者看準高血量目標給予重擊。
  - **戰士與法師**：破甲與靜電狀態不再重複對同一目標施放；死靈法師優先鎖定殘血目標進行斬殺連鎖。
- **[Test] 5v5 團隊平衡模擬測試** (`scripts/balance-test-team.ts`)
  - 建立獨立自動化測試腳本，模擬滿等隊伍對戰 5 隻 2000 HP 菁英怪。
  - 修復了 `CombatSystem.ts` 內騎士系與祈禱者系進戰鬥未正確獲得技能的 Bug。
  - 測試結果證實所有職業皆具備 100% 推進勝率。其中以死靈法師配合詭術師的「混沌特效連鎖隊」清怪速度最快 (平均 43.6 回合)，展現了極高的戰鬥上限。

## [2026-07-31] 精神(SPR)與體質(CON)戰鬥功能擴充 (Status Resistance & Regen)

- **[Feature] MP 綁定與每回合回復機制** (`Adventurer.ts`, `CombatSystem.ts`)
  - 將 Max MP 的基礎計算公式從 `INT * 5` 改為綁定 `SPR * 5`，提升精神屬性的實用性。
  - 於戰鬥迴圈中新增每回合自動回復機制：角色行動時，自動回復 `CON * 0.5` 點 HP 與 `SPR * 0.5` 點 MP。
  - 為敵方魔物補齊基礎屬性 `attributes` (依據波次難度隨機給予 CON/SPR 等數值)，使回復與抵抗機制適用於雙方。
- **[Feature] 狀態抵抗機制 (Status Resistance)** (`Combat.ts`, `CombatSystem.ts`, `Skill.ts`)
  - 新增 `tryApplyStatus` 共用檢定函式。當賦予負面狀態 (如中毒、流血、暈眩、破甲、感電) 時，將進行抗性檢定。
  - 抗性公式：`(CON + SPR) * 1%`，若檢定通過則會顯示「抵抗了負面狀態！」並迴避該次效果。
  - 全面更新 `Skill.ts` 與被動系統中的狀態賦予邏輯，改為使用 `tryApplyStatus`。

## [2026-07-31] 弓箭手與盜賊技能庫擴充

- **[Feature] 戰鬥底層目標索敵擴充** (`CombatSystem.ts`, `Skill.ts`, `Combat.ts`)
  - 擴充 `TargetType.BACK_ENEMY`，技能會優先鎖定敵方後排，若無後排則攻擊前排。
  - 擴充 `TargetType.COLUMN`，技能會鎖定目標所在的整條直線 (Column) 進行攻擊。
  - 狀態 `POISON` 新增 `stacks` 屬性，支援中毒層數堆疊與連鎖引爆。
- **[Feature] 弓箭手系技能與被動實裝** (`Skill.ts`)
  - 基礎技能：`貫穿射擊` (直線破甲攻擊)、`精準射擊` (高倍率單體傷害)。
  - 一般進階 (神射手)：實裝被動「鷹眼」(爆擊率+20%，爆擊倍率提升至 2.0x)。終極技能【致命狙擊】優先鎖定後排且必定爆擊。
  - 變異進階 (精靈使)：實裝被動「精靈庇護」(基礎傷害-20%，爆擊率+25%，技能額外附加 15% 魔法傷害)。終極技能【風精靈之舞】觸發物理後判定魔法連鎖爆擊，最高 10 段。
- **[Feature] 盜賊系技能與被動實裝** (`Skill.ts`, `CombatSystem.ts`)
  - 基礎技能：`突襲` (對高血量目標增傷)、`淬毒之刃` (造成混沌傷害並上毒，爆擊疊 2 層)。
  - 一般進階 (暗殺者)：實裝被動「先發制人」(戰鬥首回合巨額閃避保證先手，普攻對健康目標增傷 50%)。終極技能【瞬影殺】對健康目標必爆且流血。
  - 變異進階 (詭術師)：實裝被動「幻影步伐」(普攻轉混沌，嘲諷狀態下 100% 迴避，「突襲」轉混沌並可引爆中毒層數增傷)。終極技能【欺詐魔術】對高血量目標施放時賦予自身嘲諷。

## [2026-07-30] 騎士與祈禱者技能庫與戰鬥底層擴充

- **[Feature] 戰鬥底層狀態擴充** (`types.ts`, `Combat.ts`, `CombatSystem.ts`)
  - 新增 `REGEN_HP` (生命恢復) 與 `REGEN_MP` (魔力恢復) 兩種持續性正面狀態。
  - 新增 `DamageType.CHAOS` (混沌傷害)，底層邏輯判定此傷害將無視防禦力，造成真實傷害。
  - 修改 `TAUNT` (嘲諷) 索敵邏輯：強制敵方所有單體攻擊與遠程攻擊無視陣型前後排，絕對鎖定帶有嘲諷狀態的目標。
- **[Feature] 騎士系技能與被動實裝** (`Skill.ts`)
  - 基礎技能：`盾擊` (物理傷害並高機率暈眩)、`掩護` (賦予自身 2 回合嘲諷)。
  - 一般進階 (聖騎士)：實裝被動「物理傷害減免 30%，魔法傷害減免 10%」。終極技能【神聖庇護】給予全體高額護盾恢復。
  - 變異進階 (符文騎士)：實裝被動「魔法傷害減免 30%，物理傷害減免 10%」。終極技能【符文反制】造成群體混沌真實傷害，並為隊友上生命恢復。
- **[Feature] 祈禱者系技能與被動實裝** (`Skill.ts`)
  - 基礎技能：`治療術` (受智力加成的單體恢復)、`聖光擊` (單體魔法傷害)。
  - 一般進階 (大主教)：實裝被動「自身造成的所有治療效果提升 30%」。終極技能【神聖之雨】全體大量補血兼淨化所有負面狀態。
  - 變異進階 (異端拷問官)：實裝被動「雙重制裁」，普攻與聖光擊在拿戰鎚時自動分流為 40% 物理與 60% 魔法的混合傷害。終極技能【終焉審判】造成單體高額混傷 (70%物理/30%魔法) 並群體恢復少許 HP 與 MP。
- **[Balance] 魔劍士混合傷害重構** (`Skill.ts`, `CombatSystem.ts`)
  - 將魔劍士的普攻與連擊全面改回「混合傷害」。普攻與基礎戰士技能調整為 50% 物理 / 50% 魔法；【幻影連擊】每一擊調整為 30% 物理 / 70% 魔法傷害。

## [2026-07-30] 滿等轉職機制 (Level 10 Advancement) 實裝

- **[Feature] 滿等轉職開關** (`Adventurer.ts`, `Combat.ts`)
  - 新增 `isAdvanced` 開關狀態。傭兵達到 10 等後，需觸發此狀態才能開啟進階職業變化。
  - 修改 `currentClass` 邏輯，未滿等或未解鎖開關前，裝備任何武器皆維持原職業名稱（例如：戰士、法師）。
- **[Feature] 戰鬥大招與被動限制** (`CombatSystem.ts`, `Skill.ts`)
  - 修正戰鬥引擎邏輯：必須在滿等且 `isAdvanced = true` 的狀態下，才會根據武器解鎖大招（如：旋風斬、死神收割）。
  - 將專屬武器被動（例如：法杖必定命中、狂戰士無視防禦、死靈法師吸血分擔）同樣限制為進階狀態才生效。
- **[System] 存檔自動升級與密技擴充** (`SaveMigration.ts`, `CheatController.ts`)
  - 存檔 Schema 升級為 3，舊存檔的傭兵自動補齊 `isAdvanced = false`。
  - `CheatController` 新增 `advanc` 密技一鍵解鎖所有滿等傭兵的轉職狀態。
  - `CheatController` 新增 `testwpn` 密技直接獲得全套測試用的轉職特武。
- **[Doc] 新增職業說明書** (`docs/CLASS_SYSTEM.md`)
  - 確立了「一般進階」與「變異進階」的武器綁定邏輯與未來擴充設計。

## [2026-07-29] 人口與治安度的單一真相來源重構 (Single Source of Truth)

- **[Refactor] 總人口動態化** (`Territory.ts`, `SaveManager.ts`, `GameState.ts`)
  - 修正了「總人口」與「工作人口」脫鉤的嚴重 Bug。
  - 將 `population` 欄位改為動態 Getter，確保其永遠精確反映各項 `workers` 數值加總。
  - 實裝統一的 `removeWorkers()` 方法，於扣減人口時安全處理閒置與各職業人力。
- **[Fix] 各系統人口扣減同步化** (`GameLoop.ts`, `SettlementSystem.ts`, `EventData.ts`)
  - 將遭遇戰敗 (`processInvasionDefeat`)、飢荒、疾病、外移等事件中，原本硬扣/硬加 `population` 的邏輯，改為使用 `removeWorkers()` 或直接操作 `workers.UNASSIGNED`。
- **[Feature] 治安度即時更新機制** (`GameEvents.ts`, `SettlementSystem.ts`)
  - 新增 `POPULATION_CHANGED` 事件。
  - 將「治安度 (Security)」的計算綁定至該事件，解決因突發事件導致人口增減時，治安度未即時更新造成的顯示延遲或邏輯錯誤。

## [2026-07-29] 3x3 戰術板陣型系統實裝

- **[Feature] 戰術陣型與加成系統** (`FormationDB.ts`)
  - 新增 `FormationDB.ts` 定義了多種陣型（如：盾牆陣、鋒矢陣、十字陣、新月陣）與對應的形狀觸發條件。
  - 當傭兵站在正確的要求位置（Requirement Slots）時，會在戰鬥時觸發高額的屬性加成（攻擊、防禦、閃避、命中）。
- **[UI] 互動式 3x3 戰術網格與拖曳操作** (`index.html`, `ModalController.ts`)
  - 將原本單調的 5 人橫列替換為 3x3 的戰鬥網格（前、中、後排）。
  - 導入 HTML5 原生 Drag & Drop API，玩家現在可以直接拖曳傭兵卡片進入網格，或在網格內互相拖曳換位。
  - 選擇特定陣型時，網格上會顯示「📍」符號提示該陣型必須放人的關鍵位置，若放置正確則顯示發光綠色邊框回饋。
- **[Feature] 預設隊伍儲存與讀取 (Presets)** (`GameState.ts`, `ModalController.ts`)
  - 於戰術板下方新增 5 組預設隊伍按鈕。玩家可以將常用的 5 人小隊配置與陣型選擇「儲存」起來。
  - 點擊對應按鈕即可「一鍵套用」先前的完美排陣，減少重複操作負擔。
- **[Combat] 戰鬥引擎三排深度升級** (`CombatSystem.ts`, `DispatchTask.ts`)
  - `CombatSystem.ts` 現已支援陣型屬性加成與前、中、後排三層深度。
  - 敵方近戰攻擊會嚴格依照前排 ➡️ 中排 ➡️ 後排的順序進行索敵，提供更寫實的坦補打戰略佈局。
## [2026-07-29] 遊戲平衡性架構大變動與探索系統重構

- **[Feature] 探索與道路系統重構** (`ExplorationSystem.ts`, `RoadSystem.ts`, `MapGenerator.ts`)
  - 大幅翻新地圖生成機制與節點探索邏輯，實裝了 `ExplorationSystem` 來專門處理未知的地圖探索與視野迷霧。
  - 實裝 `RoadSystem` 負責處理據點之間的道路連接與生成，強化了世界地圖的結構性與連結。
  - 將地圖生成與動態管理模組分離，提供更豐富的世界生成細節 (`WorldGeneration`)。
- **[Feature] 難度與平衡性抽離** (`BalanceData.ts`, `DifficultyData.ts`)
  - 將散落於各系統的平衡常數抽離至 `BalanceData` 與 `DifficultyData` 中集中管理，方便未來的數值調整。
  - 對整體遊戲節奏進行了大規模平衡性微調。
- **[Refactor] 核心狀態與存檔擴充** (`GameState.ts`, `SaveManager.ts`, `GameLoop.ts`)
  - 擴充 `GameState` 以支援新的地圖探索進度與道路網路狀態。
  - 升級 `SaveManager` 確保新舊存檔的相容與資料結構的完整保存。
- **[UI] 探索與地圖視覺升級** (`MapScene.ts`, `ExplorationController.ts`)
  - 配合新的探索系統，實裝了對應的 UI 控制器 (`ExplorationController`) 與地圖渲染邏輯 (`MapScene`)。

## [2026-07-26] 修正傭兵永久退休無效的錯誤與防止誤觸重新設計

- **[Fix] 傭兵退休後正確移出隊伍** (`ModalController.ts`)
  - **問題**：原先點擊「永久退休轉任」按鈕時，僅呼叫了領地退休方法給予稅收加成，但未將傭兵從全域隊伍名單 (`GameState.adventurers`) 中移除，導致 UI 仍會將其視為可用成員顯示。
  - **修正**：在呼叫退休邏輯後，加入從 `GameState.adventurers` 中移除該傭兵的邏輯，並確保 UI 即時刷新。
- **[Refactor] 防誤觸退休按鈕雙層設計** (`ModalController.ts`)
  - **問題**：原先「永久退休轉任」是底部佔滿寬度的紅色大按鈕，玩家調整裝備時極易誤觸。
  - **修正**：將退休按鈕弱化，並改為右上方 `🚪 退休...` 小按鈕。點擊後會展開為 `⚠️ 確認退休` 與 `取消` 兩個雙重確認按鈕，等待玩家指示，大幅降低誤觸風險。
- **[UI] 介面精簡** (`UIManager.ts`)
  - 移除了頂部資源列中人口數量旁邊的「(無上限)」強調字眼，讓畫面保持整潔。
- **[Fix] 零傭兵時立繪殘留問題** (`ModalController.ts`)
  - **問題**：當最後一名傭兵退休後，左側的常駐立繪卡與血條等資訊不會被清除，仍然顯示上一名傭兵的資料。
  - **修正**：在沒有可用冒險者時，除了更新右側視窗，也會同步將左側的 `party-portrait-card` 容器隱藏。
- **[Fix] 返回標題畫面時彈窗殘留** (`GameFlowController.ts`)
  - **問題**：退出遊戲返回主選單時，原先只隱藏了主要視圖，導致如「冒險者小隊」等浮動側邊欄或對話框會殘留在畫面上。
  - **修正**：在退出遊戲的邏輯中，追加對 `.modal-overlay`, `.side-panel-left`, `.side-panel-right` 樣式節點的隱藏處理，確保畫面徹底淨空。
- **[Feature] 依距離決定探索(斥侯)天數** (`ModalController.ts`)
  - **問題**：原先探索新據點的派遣天數為固定的 2 天，無法反映距離遠近。
  - **修正**：實裝距離計算公式，現在探索任務的所需天數將依據目標節點與玩家據點的距離，浮動計算為 1 到 3 回合（天），並會在派遣介面中提示。
- **[Feature] 誓約守衛防退機制** (`ModalController.ts`)
  - **問題**：初始的誓約守衛不應該能被隨意退休解僱。
  - **修正**：在裝備頁籤的退休按鈕邏輯中，檢測傭兵天賦是否為「誓約守衛」。若是，則不顯示退休按鈕，改為顯示「誓約守衛不可退休」的提示。

## [2026-07-26] 沉浸式硬核人口動態：城市水槽效應與自然淘汰 (Realistic Demographics)

- **[Feature] 實作自然生育與老死機制** (`SettlementSystem.ts`)
  - 領地現在每天都會有自然的新生兒降生（基礎生育率 0.15%）以及因為年邁或意外造成的死亡（基礎死亡率 0.10%）。這為領地帶來了緩慢但穩定的人口基數。
  - **擁擠懲罰 (Urban Sink)**：為模擬中世紀的城市衛生條件，每當總人口數多出 1000 人，每日死亡率將微幅上升 `0.02%`。當人口突破 3000 人時，死亡率將追平出生率，徹底終結純靠生育滾雪球的可能性。
- **[Feature] 治安低落引發人口外流** (`SettlementSystem.ts`)
  - 當領地的治安（Security）低於 40 時，每天都會有一定比例的居民因為對領主失望而打包離開領地。治安越低，外移的比例與人數越高。
- **[Feature] 重構外部移民與流民機制** (`SettlementSystem.ts`)
  - 將過往「總人口 5%」的指數型難民湧入機制徹底拔除。
  - 現在只要治安大於 50 且有餘糧，每天有機會吸引流民加入，但人數改為「1~3 人 + (聲望/1000)」。在遊戲初期這依然是主要的擴張動力，但在大城市階段，移民將成為填補疾病死亡缺口的重要活水。

## [2026-07-26] 沉浸式硬核據點與爵位系統重構：無人口上限與動態規模 (Node Level V2)
- **[Feature] 完全拔除據點硬性人口上限** (`types.ts`, `SettlementSystem.ts`, `ActionController.ts`, `EventData.ts`, `DispatchSystem.ts`)
  - 徹底移除 `getNodeMaxPopulation` 函數與其所有的防呆限制。只要領地糧食充足、治安穩定，人口便可依據聲望與事件無限成長。
  - 將對人口增長的控制機制交還給「糧食消耗」與「自然飢餓死亡」等硬核生存模擬機制。
- **[Feature] 繁榮度與據點規模動態綁定** (`UIManager.ts`, `SettlementSystem.ts`)
  - 據點規模（營地、村莊、城鎮、首都）現改為依據「有效繁榮度」進行即時動態升降級判定。
  - **有效繁榮度公式** = 據點基礎繁榮度 + 當前總人口數。這使得人口成長直接推進據點發展。
  - **升級門檻調整**：營地 (20)、村莊 (150)、城鎮 (1000)、首都 (5000 且需擁有至少一個其他附庸據點)。
- **[Feature] 建築升級上限轉移至據點規模** (`types.ts`, `Territory.ts`, `SceneController.ts`)
  - 移除原先綁定在「爵位」上的最高建築等級限制。
  - 將建築上限轉為受「當前據點規模 (NodeLevel)」限制。當據點因飢荒導致人口與繁榮度崩盤退化時，玩家將暫時失去升級高等建築的權限。
- **[Feature] 爵位晉升條件寫實化** (`types.ts`)
  - 根據中世紀背景設定，微調了爵位的晉升門檻：平民、騎士與男爵只需個人聲望與財富即可獲封；子爵 (200 人)、伯爵 (500 人)、侯爵 (1500 人) 與公爵 (5000 人) 則嚴格要求對應的統治實力（人口數）作為前提。

## [2026-07-26] 修復繁榮度進度條未即時更新 UI 問題
- **[Fix] 繁榮度進度條即時連動** (`UIManager.ts`, `MilestoneSystem.ts`, `EventData.ts`)
  - **根本原因**：之前繁榮度進度條的 UI 更新只訂閱了 `PROSPERITY_CHANGED` 事件（該事件僅在月底發布），且 `UIManager.updateUI()` 中未包含繁榮度條的刷新邏輯，導致無論觸發多少加繁榮度的事件/里程碑，畫面上的進度條一直固定在 HTML 初始畫面的 `0 / 40`。
  - **修復方案**：
    1. 在 `UIManager.updateUI()` 加入 `refreshProsperityBar()`，確保每次 UI 刷新（包括分配工人、事件選擇、里程碑達成等）時皆即時重新計算並渲染當前繁榮度、進度條百分比與階段目標。
    2. 在 `refreshProsperityBar()` 加入即時門檻升級檢定，當事件或里程碑獎勵讓繁榮度達到門檻時，據點會即時升級並跳出系統提示。
    3. 修正等級標籤與圖示顯示，依據當前階段動態顯示 `🏚️ 荒野` / `🏕️ 營地` 等圖標，解決圖標硬編碼問題。

## [2026-07-26] 早期遊戲體驗強化與里程碑/敘事系統實裝

- **[繁榮度公式升級] 內政與繁榮度連結** (`MapDynamicsSystem.ts`)
  - 月底繁榮度計算不再僅給固定 `+10`，額外加入「已分配工人數（每人+1/月）」與「建築繁榮度加成（每棟加成/5/月）」，使內政建設與人口分配能直接加速荒野與據點發展。
- **[里程碑系統] 實裝 MilestoneSystem** (`MilestoneSystem.ts`, `GameState.ts`, `GameLoop.ts`)
  - 新增 `MilestoneSystem.ts` 追蹤首次分配工人、首次擊退敵襲、人口達 15/30 人、第一棟建築建完、首次完成任務及升級營地等階段目標。
  - 達成里程碑時即時給予金幣/聲望/繁榮度獎勵，並暫存通知至每日結算。
- **[日常環境敘事] 實裝 NarrativeData** (`NarrativeData.ts`)
  - 新增 15 條荒野環境與營地日常敘事文本池，每日有機率在結算時觸發。
- **[每日摘要 UI 擴充] 「今日見聞」區塊** (`DailySummaryModal.ts`, `index.html`)
  - 在每日結算 Modal (`#modal-daily-summary`) 新增 `#daily-narrative-container` 區塊，展示當天解鎖的里程碑與環境敘事，讓「結束本日」過程充實有趣。
- **[日誌視覺分層] 新增 GameLog 模組** (`GameLog.ts`)
  - 封裝 `GameLog.add(message, type)`，區分 `info` / `warning` / `milestone` / `narrative` / `combat` 類型訊息。

## [2026-07-26] 修復 TradeController.ts require() 語法錯誤

- **[Fix] ESM 語法修正** (`TradeController.ts`)
  - 將 L363、L375 的 CommonJS `require()` 呼叫改為 ESM 動態 `import().then()`，使 `tsc --noEmit` 完全零錯誤。

## [2026-07-25] 荒野開局平衡修復 (A/B/C 方案全實裝)

- **[A1] Bug：附庸地 CAMP 升級門檻統一** (`SettlementSystem.ts`)
  - 修復 `SettlementSystem` 中附庸地升 CAMP 判斷條件從 `>= 30` 更正為 `>= 100`，與 `MapDynamicsSystem.PROSPERITY_THRESHOLDS` 一致。
- **[A2] Bug：難民事件人口黑洞修復** (`EventData.ts`)
  - `evt_oakhaven_refugees` 收容難民時，新增 NodeLevel 人口上限限制，並同步更新 `territory.workers['UNASSIGNED']`，避免人口增加而勞動力不增的數據不一致問題。
- **[A3] Bug：入侵敵力公式修正** (`GameLoop.ts`)
  - 原 `50 * (currentYear * 2)` 呈指數爆炸，第 2 年最高可達 200；改為 `Math.min(300, 30 + currentYear * 15)` 線性成長並加上 300 硬上限。
- **[B1] 平衡：荒野開局初始金幣提升** (`Territory.ts`)
  - 初始金幣從 `50` 提升至 `150`，提供更多策略選擇空間。
- **[B2] 平衡：CAMP 升級門檻與危險懲罰調整** (`MapDynamicsSystem.ts`)
  - `CAMP` 升級門檻從 `100` 降至 `40`，讓自然成長路徑約 4 個月可達成。
  - 相鄰危險節點月繁榮度懲罰從 `-10` 降至 `-3`，避免完全鎖死早期玩家進度。
- **[B3] 平衡：入侵 CD 延長** (`GameLoop.ts`)
  - 所有入侵 CD 重置值從 `7~12天` 統一延長至 `15~25天`，提供早期玩家充足喘息空間。
- **[C1] 新增：PROSPERITY_CHANGED 事件** (`GameEvents.ts`)
  - 新增 `PROSPERITY_CHANGED` 事件類型，攜帶 `{ delta, current, nextThreshold, levelName }` payload，供 UI 進度條監聽。
- **[C2] 新增：月底繁榮度事件發布** (`MapDynamicsSystem.ts`)
  - 玩家據點繁榮度月底結算後，發布 `PROSPERITY_CHANGED` 事件通知 UI。
- **[C3] 新增：繁榮度進度條 DOM** (`index.html`)
  - 在 `#scene-view` 街道視圖頂部新增 `#prosperity-bar-container`，包含等級標籤、數值、漸變進度條與相鄰危險警告徽章 (`#prosperity-danger-badge`)。
- **[C4] 新增：進度條 UI 驅動邏輯** (`UIManager.ts`)
  - 新增 `updateProsperityBar(current, nextThreshold, levelName)` 方法，包含顏色三段反饋（紫→黃→綠）與危險徽章顯示邏輯。訂閱 `PROSPERITY_CHANGED` 事件在月底自動更新。

## [2026-07-25] AI 派系武將與戰後俘虜處置系統 (Milestone 1)

- **AI 武將資料模型 (Faction Champion System)**：
  - 在 `types.ts` 新增 `FactionChampion` 與 `FactionChampionInstance` 型別，並在 `Faction` 擴充 `champions`、`capturedChampionIds` 與 `defeatedChampionIds` 欄位。
  - 在 `FactionData.ts` 為埃瑟加德王室、瓦萊里烏斯家族、莫凡恩家族、萊桑德家族等 7 大派系配置了專屬的陣營武將（如鐵拳將軍「格里姆」、皇家大總管「奧古斯都三世」）。
- **動態攻城戰啟動 (Siege Initiation)**：
  - 在 `MapDynamicsSystem.ts` 補全了攻城戰發起邏輯：當派系資源充裕且處於交戰狀態時，會主動對相鄰敵對據點或玩家據點發起圍攻 (`node.siegeData`)，真正激活地圖上的 ⚔️ 攻城戰與天數倒數。
- **戰後俘虜處置視窗 (Prisoner Modal UI & Conversion)**：
  - 在 `index.html` 新增 `#modal-prisoner-action` 戰後俘虜處置 Modal。
  - 在 `ModalController.ts` 實裝 `openPrisonerModal` 與 4 種處置分支（🤝 招降、💰 索取贖金、⚰️ 處決、🔓 釋放）。
  - 實裝 `convertChampionToAdventurer` 函數：招降時將 AI 武將無縫轉換為玩家邏輯的傭兵（帶有等級、經驗值與技能）。

## [2026-07-25] 戰鬥紀錄面板重構 & 三面板互斥切換

- **UI 重構 (UI Refactor)**：
  - **戰鬥紀錄改為側邊抽屜式**：將「戰鬥紀錄」面板從 `modal-overlay` 改為 `side-panel-left` 左側抽屜面板，與傭兵隊伍、外交與派系三者統一為相同的 UI 風格。面板 ID 由 `#modal-combat-history` 改為 `#combat-history-panel`，新增紅色邊框主題區別。
  - **三面板完全互斥**：擴展互斥邏輯至三個側邊面板（傭兵、外交、戰鬥紀錄），點擊任一按鈕時另外兩個面板自動收起。
  - **修復殭屍 DOM Bug**：HTML 中有兩個 `id="modal-combat-history"` 的重複元素，已刪除第二個無效的殭屍 DOM（原第 1807 行）。
  - 卡片版面調整為適應較窄抽屜面板的尺寸（地點名稱溢出省略、字體縮小）。

## [2026-07-25] 外交面板 UI 重構 & 互斥切換


- **UI 重構 (UI Refactor)**：
  - **外交面板改為側邊抽屜式**：將「外交與派系」面板從全畫面 `modal-overlay` 模態窗改為與傭兵隊伍相同的 `side-panel-left` 左側抽屜面板，統一 UI 風格（從左側滑入動畫、不遮蔽遊戲畫面、z-index 900）。
  - **面板互斥切換**：傭兵隊伍面板與外交面板現在互相排斥。當其中一個面板已開啟時，點擊另一個按鈕會自動收起當前面板再開啟新面板，避免兩個面板同時堆疊於畫面左側。
  - **靜態 HTML 化**：`DiplomacyController` 不再動態建立 DOM，改為直接操作 `index.html` 中預定義的 `#diplomacy-panel` 元素，提升穩定性並消除原本的初始化競態問題。

## [2026-07-25] 外交與攻城系統實裝 (Diplomacy & Siege Mechanics)


- **新增功能 (Feature)**：
  - **派系外交介面**：新增「外交與派系」面板 (DiplomacyController)，實裝右下角 Command Crest Hub 快捷按鈕。玩家可檢視其他派系的態度與領地數，並進行贈禮 (花費金幣) 或宣戰/求和。
  - **AI 互動與性格**：各 AI 家族新增性格 (好戰、和平等)。每日動態隨機改變 AI 家族之間、以及對玩家的好感度，甚至主動宣戰或停戰。
  - **攻城戰倒數**：AI 勢力擴張不再直接瞬間佔領，若目標為敵對派系或玩家據點，將會發起需時數天的圍攻戰 (Siege)。地圖上會即時出現交叉雙劍的彈跳動畫 ⚔️，Tooltip 中亦會顯示攻擊方與剩餘天數。
  - **攻城結算**：圍城倒數結束後，若是玩家防守失敗，則扣除據點繁榮度並警告；若是 AI 互打則會佔領節點。
- **UI 與流程整合**：
  - 在 `MapScene.ts` 與 `GameLoop.ts` 完美串接了外交與攻城的視覺提示，搭配 `EventBus` 與 `ToastManager` 發送即時戰況警告。

## [2026-07-25] 每日結算面板實裝與 UI 防誤觸修復

- **新增功能 (Feature)**：
  - 實作「每日結算與未來預測面板」。點擊「結束本日」後，會彈出此面板展示當日資源（金幣、糧食、木石鐵礦及人口）的詳細變動。
  - **發薪日倒數與預測**：在結算面板中加入「未來預測」區塊，會根據當前天數自動推算距離下一次 7 日發薪還有幾天。若距離 3 天以內，將顯示紅/黃色預警，並預先為玩家試算總支出（含人口維護、傭兵薪資與外交贈禮），提醒玩家準備資金避免破產。
- **介面修正 (UI Bug Fix)**：
  - 修復各種彈出面板（如討伐編制、倉庫、系統選單等）開啟時，底部「結束本日」及「返回據點」等操作按鈕仍可被點擊的誤觸問題。
  - 將 `#command-crest-container` (史詩操作鈕容器) 的 `z-index` 調降至 950，確保所有 `modal-overlay` (z-index 1000) 都能正確遮蔽。

## [2026-07-25] 遊戲核心邏輯 P1 修復與經濟雙軌制重構 (Game Logic & Economic System Refactoring)
- **經濟雙軌制重構 (Economic System)**：
  - 徹底解決舊版設計中「日收」與「月底大結算」的語意重疊問題。
  - **日結收入**：重構 `SettlementSystem.ts` 中的每日稅收公式，將基礎人口稅與爵位加成統一為每日結算，確保穩定的正向現金流。
  - **旬結支出 (7日制)**：廢除 `DispatchSystem.ts` 舊版的 `resolveMonth()` 大結算。建立 `resolvePayday()` 專注處理支出，並在 `GameLoop.ts` 改為每 7 天觸發一次，營造發薪日的短期目標壓力。
- **官職系統加成實裝 (Office Bonus)**：
  - 在 `SettlementSystem.ts` 引入有官職者的 `civicBonusPct`（內政加成，例如城主 +20%），實質放大領地資源產出。
  - 在 `CombatSystem.ts` 引入參戰者的 `combatBonusPct`（戰鬥加成，例如方旗騎士 +10%），實質強化英雄的基礎攻防屬性。
- **建築等級上限解鎖 (Building Level Cap)**：
  - 修復 `Territory.ts` 中硬限制 3 級的判斷，改為完全採納 `getMaxFacilityLevel(this.title)`。
  - 在 `getUpgradeCost` 中引入動態升級公式 (指數成長 2.5 倍)，賦予 4 級以上的建築符合預期的資源門檻。

## [2026-07-24] UI Bug 修復：官職卡片截切與出戰隊伍格子消失（第二輪追加修復）

- **追加修復 - .adventurer-card overflow:hidden 根本問題**：
  - **根因**：`.adventurer-card` CSS 的 `overflow: hidden` 是所有 badge 截切問題的根源。所有 `position:absolute; bottom:-8px` 的標籤（前排/後排/城主/隊長/扈從）都因此被截掉，在截圖中呈現為寬色條（只有最頂部幾像素露出）。
  - **修復**：將 `.adventurer-card` 的 `overflow: hidden` 改為 `overflow: visible`。同時為 `.adv-avatar-wrapper` 和 `.adv-card-gradient` 加上 `border-radius: 6px`，確保卡片圓角裁切效果由這些子元素自行維護。
- **追加修復 - dispatch roster slot 尺寸衝突**：
  - **根因**：`renderDispatchTeamRoster()` 先對 slot div 設定 `width:90px; height:100px` 的 inline style，然後再加上 `adventurer-card` class，導致 inline style 和 CSS class 互相衝突，尺寸不一致。
  - **修復**：重構 slot 建立邏輯，有傭兵時完全依賴 `.adventurer-card` class CSS；空位時才用 inline style 設定外觀。
  - **相關檔案**：`index.html`、`src/ui/ModalController.ts`

- **Bug 修復 - 討伐出戰隊伍格子消失 (renderDispatchTeamRoster)**：
  - **根因**：`renderDispatchTeamRoster()` 中使用 `setTimeout(..., 0)` 異步在 bottomLabel div 上加上 `.row-toggle` class，但緊接著的 `slot.querySelector('.row-toggle')` 是同步執行的，導致每次都取到 `null`，接著 `null.addEventListener` 拋出 JS 錯誤，整個 5 格 roster 渲染中止、格子全部消失。
  - **修復**：移除 `setTimeout` 異步邏輯；改在 `AdventurerCard.ts` 的 `CardOptions` 介面新增 `bottomLabelBg` 與 `bottomLabelRole` 選項，讓 div 在 HTML 生成時就直接帶有 `data-role` 屬性，使 `slot.querySelector('[data-role="row-toggle"]')` 能同步找到元素。
  - **相關檔案**：`src/ui/ModalController.ts`、`src/ui/components/AdventurerCard.ts`

- **Bug 修復 - 據點官職總覽卡片資訊截切 (ui-office-slots)**：
  - **根因**：`#ui-office-slots` 容器只設定了 `overflow-x: auto` 但未設 `overflow-y: visible`，瀏覽器預設 overflow-y 也變為 `auto`，導致 `.adventurer-card` 中 `bottomLabel`（`position: absolute; bottom: -8px`）被截掉。同時父層 `glass-panel` 設有 `overflow: hidden`，也截掉了子容器的 overflow-y visible 效果。
  - **修復**：將 `#ui-office-slots` 加上 `overflow-y: visible; padding-bottom: 18px`；將父層 `glass-panel` 的 `overflow: hidden` 改為 `overflow-x: hidden; overflow-y: auto`（允許縱向捲動，不截切 overflow-y）。
  - **相關檔案**：`index.html`

## [2026-07-24] 傭兵卡片模板化與半身像 Spritesheet 接口 (Adventurer Card Template System)

- **UI 架構優化 (UI Architecture)**：
  - 新增 `AdventurerCard.ts` 模板元件，統一全遊戲的傭兵卡片生成邏輯。
  - 將謁見廳、討伐編制、隊伍總覽的卡片與槽位渲染，全面重構並套用新模板，解決因為手動串接 HTML 造成的排版跑版問題。
- **美術接口實裝 (Art Assets Interface)**：
  - 為 `Adventurer` 模型新增 `avatarIndex` 屬性。
  - 於卡片模板中實作基於 `background-image` 與 `background-position` 的 5x5 精靈圖 (Spritesheet) 自動裁切技術，為未來導入傭兵美術半身像打好基礎。

## [2026-07-24] 謁見廳 UI 全面大修與傭兵實體化 (Physical Location System)

- **底層邏輯重構 (Architecture & Data Structure)**：
  - 為 `Adventurer` 新增了 `locationNodeId` 屬性，傭兵不再是全域隨叫隨到，而是真正擁有了「實體所在地」。
  - 在酒館招募或是探索事件中獲得的新傭兵，將會預設出生在玩家當前所在的據點。

- **介面大修 (UI Refactoring)**：
  - **廢除任命彈出視窗 (Modal)**：依照玩家指示，將謁見廳的官職任命介面徹底改寫為類似「出戰隊伍」的雙層面板結構（上方：職位槽，下方：候選傭兵）。
  - **半身像卡片化**：無論是「空位」、「已就任」還是「待命傭兵」，全部套用統一的方塊半身像卡片 UI，並支援直覺式的點擊配對操作。
  - **所在地過濾**：現在點擊謁見廳的空位槽時，下方的候選名單**只會顯示身處在該據點**的閒置傭兵，完全屏除了其他據點的人員。

## [2026-07-24] 謁見廳 UI 重構與據點官職獨立制 (Node-based Office System)

- **底層邏輯重構 (Architecture & Data Structure)**：
  - 將官職職缺數量從「全域爵位總數綁定」改為**「依據各據點獨立計算上限」**。
  - 在 `types.ts` 中的 `TITLE_CONFIG` 重新定義了解鎖權限：例如公爵會在每個擁有的據點解鎖 1 名城主、2 名隊長、2 名扈從。
  - 於 `MapNode` 新增 `isCapital` 標籤，用來支援「首都專屬職位」的邏輯。
  - 修改 `Adventurer.ts`，新增 `stationedNodeId` 以紀錄傭兵被指派到哪一個據點擔任官職。

- **介面大修 (UI Refactoring)**：
  - **排版優化**：移除了謁見廳右側常駐的「待命傭兵」區塊，將原本被擠壓裁切的「兵力調度」面板拉高，完美解決版面破圖問題。
  - **卡片化與彈出視窗**：謁見廳左側現在會呈現簡潔的「職位總覽卡片」。點擊卡片後，會彈出視窗 (Modal) 來獨立處理該職缺的任命與解任，大幅提升操作流暢度。
  - **首都冊封系統**：當玩家達到「公爵」爵位，即可在任何一個己方據點按下「👑 冊封為首都」。被冊封為首都的據點將獨家解鎖「方旗騎士」的職位。更換首都時，原首都的方旗騎士將被自動解任，確保榮譽的唯一性。

## [2026-07-24] 新增聲望作弊碼 (Fame)

- **新增功能 (Feature)**：
  - 在 `CheatController.ts` 加入了 `fame` 作弊碼，可用於快速增加領地的聲望值。

## [2026-07-24] 修復 ARMY 作弊碼總人口計算問題

- **修正邏輯錯誤 (Bug Fix)**：
  - 修復 `CheatController.ts` 中 `ARMY` 作弊碼的邏輯。原本直接對總人口固定增加 `v` 導致人口數量與實際增加的兵力不符。
  - 現在改用內建的 `syncPopulation()` 自動偵測並加總所有人口，確保資料一致性。

## [2026-07-24] 確立事件與敘事系統架構設計

- **架構設計 (Architecture Design)**：
  - 於 `docs/ARCHITECTURE.md` 新增「事件與敘事系統 (Narrative Design)」章節。
  - 確立採用「故事牌組與標籤系統 (Story Deck & Tag System)」與「傳聞與調查系統 (Rumors & Investigation)」作為擴充碎片化敘事的核心理念。
  - 確立開發規範：不依賴外部 JSON 編輯器，維持直接於 `EventData.ts` 撰寫 `GameEvent` 陣列，並建立 AI 溝通模板以快速生成腳本，確保程式碼乾淨與高擴充性。

## [2026-07-24] 法師與死靈法師技能實裝及裝備系統擴充

- **職業命名修正 (Class Rename)**：
  - 將戰鐮 (SCYTHE) 對應的變異職業名稱從「戰鬥法師」正式更名為「**死靈法師 (Necromancer)**」。
- **介面擴充 (Interface Extension)**：
  - `Equipment` 與 `EquipmentTemplate` 新增 `grantedSkill?: string` 屬性，為未來的隨機法術機制預留擴充槽。
  - 新增狀態異常 `StatusEffectType.SHOCK` (感電)。
- **法師系技能庫實作 (Mage Skills)**：
  - **基礎法師**：新增 [奧術飛彈] (隨機 3 下 60% 傷害) 與 [靜電新星] (全體感電)。
  - **大魔導士 (法杖)**：新增 [隕石轟炸] (全體 150% 傷害，隨 Max MP 增傷)，並在戰鬥迴圈中實裝「法術真理」被動 (普攻與技能必定命中)。
  - **死靈法師 (戰鐮)**：新增 [死神收割] (單體 250% 傷害，擊殺後自動連鎖追擊血量最低者)。
- **法坦被動機制實作 (Necromancer Passives)**：
  - 實作「**靈魂虹吸**」被動：死靈法師造成的傷害將有 20% 轉化為自身 HP 恢復。
  - 實作「**苦痛分擔**」機制：隊友受到攻擊時，死靈法師將主動吸收 50% 的傷害，並將此傷害減免至 20% (由死靈法師承受)，奠定法坦的戰略地位。
- **裝備資料庫更新 (DataStore)**：
  - 補足 `橡木法杖` 缺漏的 `weaponType: WeaponType.STAFF` 屬性。
  - 新增 `學徒戰鐮` (帶有體質需求) 以供死靈法師測試。

## [2026-07-24] 修復 CombatSystem 裝備讀取型別錯誤

- **修正 TypeScript 錯誤 (Bug Fix)**：
  - 修復 `CombatSystem.ts` 取得武器資訊時，未使用 `EquipmentSlot` Enum 而導致的型別提示錯誤 (`'WEAPON' as any`)。

## [2026-07-24] 戰鬥系統技能框架與戰士系技能實作

- **技能資料結構實作 (Skill System Framework)**：
  - 新增 `Skill.ts` 定義技能核心介面 `Skill`、目標類型 `TargetType` 與共用的防禦減免公式 `calculateSkillDamage`。
  - 在戰鬥事件中新增 `SKILL_CAST` 類型。
  - 在 `CombatParticipant` 加入 `baseClass`, `weaponType` 與 `skills` 陣列。
- **戰士與變異職業技能實作 (Fighter & Variants Skills)**：
  - **戰士 (基礎)**：實作 [奮力一擊] (單體 130%) 與 [破甲碎擊] (附加破甲 20% 減防)。
  - **狂戰士 (進階)**：實作 [旋風斬] (前排全體 180%，若破甲則 250%)。
  - **魔劍士 (變異)**：實作 [幻影連擊] (單體連續 4 次 50% 混傷)，以及混傷被動機制：當裝備「雙劍」時，所有戰士基礎技能改吃 `(ATK + MATK)` 並轉為混合傷害，敵方防禦判定改以雙防平均值(目前簡化為減傷降低)處理。
- **戰鬥迴圈整合 (Combat Loop Integration)**：
  - 修改 `CombatSystem.ts`，當傭兵 MP 充足時，會優先挑選 MP 消耗最高的可用大招進行施放，執行專屬的戰鬥事件與動畫文字，解決原本僅能普攻的單調戰鬥。

## [2026-07-24] 移除冗餘數值與介面精簡

- **介面精簡 (UI Cleanup)**：
  - 從頂部資源列中移除「✨ 聲望」與「🤝 好感度」的顯示。
  - 從右側「大帝國儀表板」中移除好感度數值，以及「距離下一階還需 XXX 聲望」的晉升進度條與提示文字（保留聲望數值顯示）。
  - 將頂部資源列與右側儀表板數值的提示框 (Tooltip) 全面由靜態的 `title` 升級為動態跟隨滑鼠的 `data-tip`，提供更滑順現代的互動體驗，聲望與金幣等數值現在也能正常顯示懸浮提示。
  - 將相關的 DOM 綁定改為安全綁定 (Nullable)，確保後台數值運算即使在缺乏前端渲染的狀態下也不會拋出錯誤。此舉旨在避免玩家對目前系統尚無實質作用的數值產生疑惑。

## [2026-07-24] 討伐隊伍編制介面與流程重構

- **討伐介面卡牌化與配置區 (index.html, ModalController.ts)**：
  - 將可選傭兵清單改為 CSS Grid 版面的卡牌式排列。
  - 新增「隊伍配置區 (最多 5 人)」，即時反映玩家選擇的傭兵，並嚴格限制出戰人數上限為 5 人。
  - 玩家現在可以直接在隊伍配置區中點擊切換傭兵的「前排/後排」陣型，不再需要進入裝備介面設定。
  - 移除裝備頁籤中舊有的陣位編制按鈕。
- **介面細節修復與優化**：
  - 修復單體戰力評估顯示過長浮點數的異常問題（加入 Math.round()）。
  - 將「建議戰力門檻」文字修改為「🎯 目標戰力：XXX」並加入醒目底色。
  - 改善「討伐模式」單選框的排版，加入互動式背景與 Hover 效果。
  - 修正底部預估風險與獎勵字串的擁擠排版問題。
  - 移除標題中不再需要的「(不帶兵)」備註字眼。

## [2026-07-24] 周邊動態探索與魔物名單系統

- **魔物資料庫擴充 (`monsters.json`)**：
  - 新增了 `monsters.json` 作為魔物的基礎資料庫，玩家可以直接用文字編輯器開啟並複製擴充自己想要的怪物。
  - 新增 `MonsterRace`（魔物、人類、不死族、龍）四大種族標籤，為未來的相剋與戰鬥機制打好基礎。
- **動態周邊節點生成 (`MapDynamicsSystem.ts`)**：
  - 領主執行「探索周邊」時，有 30% 機率在據點周遭半徑內動態生成「隨機事件」或「巢穴」節點。
  - 動態生成的節點在世界地圖上的圖示大小會被設定為更小的 `25x25` 像素。
  - 實裝「**極限機制**」，地圖上最多只會同時存在 5 個隨機巢穴，超過後探索將不再生成新巢穴，讓玩家能無壓力自行決定清理步調。
- **動態情資與實體魔物戰鬥 (`ModalController.ts` & `CombatSystem.ts`)**：
  - 討伐動態巢穴時，系統會根據巢穴所在的「地形」隨機抽取符合的魔物陣容，並根據據點難度換算出預估數量。
  - 出戰編制介面中將不再顯示泛用的難度提示，而是具體的情報（例如：「預估有 N 隻【哥布林斥候】」）。
  - 戰鬥系統現在會接收具體的 `enemyLineup`，將實際的怪物名稱與數值（血量、攻擊、防禦等）應用於戰鬥與戰報中。

## [2026-07-24] 難度起始資源與爵位曲線平滑化

- **爵位晉升需求曲線平滑化 (types.ts)**：
  - 大幅提升了初期爵位晉升的金幣與聲望需求，消除原本開局金幣過剩導致過快升官的斷層。
  - 新門檻（節錄）：騎士需 500 聲望/1500 金，男爵需 2000 聲望/4000 金，子爵需 5000 聲望/10000 金，以此類推直到公爵。
- **難度起始資源與起始爵位連動 (MapController.ts)**：
  - 現在根據選擇的地圖節點難易度，不僅起始資源會有感差異，起始爵位也會有所不同。
  - **簡單 (CAPITAL)**：起始即為「男爵 (BARON)」，並獲得 4000 金幣與 80 初始人口。
  - **普通 (TOWN)**：起始即為「騎士 (KNIGHT)」，並獲得 1500 金幣與 30 初始人口。
  - **困難 (VILLAGE/CAMP)**：維持「平民 (COMMONER)」，獲得 600 金幣與 5 初始人口。
  - **極難 (WILDERNESS)**：流放開局，維持「平民 (COMMONER)」，獲得 200 金幣與 1 初始人口。

## [2026-07-24] 大陸地圖節點視覺微調與尺寸縮小

- **地圖節點 (Map Scene) 尺寸調整**：
  - 將地圖上所有據點圖示的顯示尺寸由 `55x55` 像素縮小至 `35x35` 像素，使地圖整體比例顯得更精緻且留有更多視覺空間。
  - 移除了大陸地圖上各個節點 (據點) 底下的陰影效果，使地圖顯示更加簡潔。
- **地圖生成邏輯 (Map Generator) 重大升級：彩色生物群系遮罩 (Biome Map)**：
  - 徹底移除了基於方塊座標猜測的 `MapRegions.ts`，改為讀取彩色圖片 `bg-map_mask.jpg` 來決定生成範圍。
  - 新增開發腳本 `scripts/generate-map-mask.mjs` (搭配 `jimp` 套件)，可將彩色遮罩圖自動解析為超輕量的 TypeScript 2D 陣列檔 `MapMaskData.ts`。
  - 地圖生成器現在可以 100% 精準將平原、森林、火山、雪山、沙漠等不同地貌的據點，隨機放置在圖片對應的顏色區塊上，完全杜絕據點掉進海裡的問題。

## [2026-07-23] 3D 據點圖示重製、尺寸標準化與自動去背腳本 (Phase 6)

- **據點圖示 (Node Icons) 視覺重製**：
  - 確立了「暗黑寫實、頂端打光 (Rim Light)」的美術風格，以解決在深色地圖上的辨識度問題。
  - 將 `MapScene.ts` 中的節點渲染尺寸放大至 `55x55`，並微調了標籤文字與陰影的位置以避免重疊。
  - 修復了移除非必要發光特效時意外刪除 `glowColor` 導致的懸浮 Tooltip 不顯示與放大不還原之 Bug。
- **自動化去背與縮放腳本 (Tools)**：
  - 開發並實裝了 `scripts/remove-green-bg.mjs`，採用綠幕去背演算法 (Chroma Key)，針對生成的節點圖片（純螢光綠底色）進行完美邊緣去背，解決了白邊與陰影被誤殺的問題。
  - 腳本現已支援批量自動縮放畫布至 128x128 像素，確立了 `原生(128x128) -> 渲染(55x55)` 的高效能圖檔規格。
- **圖檔資源清理 (Refactor)**：
  - 開發並執行了 `scripts/cleanup-assets.mjs`，自動掃描原始碼依賴，清除了未使用的廢棄測試圖檔，釋放了專案空間。
- **據點動態解鎖系統 (Map System)**：
  - 於 `MapNode` 介面擴充了 `isHidden` 與 `unlockCondition` 屬性。
  - 於 `MapDynamicsSystem` 與 `GameLoop` 實裝了每日檢定機制，支援基於天數或聲望的動態解鎖，達成條件時會即時更新地圖並發送 `toastManager` UI 提示。(目前預設全節點開放，保留擴充彈性)

## [2026-07-23] 攻城與守城兵力系統 & 治安度擴充 (Phase 5)

- **治安度系統 (Security System)**：
  - 新增領地 `security` 屬性。每日根據「留守兵力」與「領地人口」的比例計算治安度 (前 50 名人口有新手保護豁免)。
  - **產出加成**：治安度高於 80% 時，木材、石材、糧食等全體產出 `x 1.2` 倍，且若兵力達標每日再額外給予聲望加成。
  - **混亂懲罰**：治安度低於 30% 時，由於盜匪橫行，產出與稅收將減少 `x 0.7` 倍。
- **打怪 (Subjugation) vs 戰爭 (War) 任務分流**：
  - 討伐野外據點怪物現在為「純傭兵模式」，UI 僅允許選擇參戰的傭兵，禁止為打怪任務帶兵。
  - 對其他派系的城鎮發動「攻城戰」時，開放軍團介面，允許帶兵。
- **出兵預扣與戰損返還**：
  - 攻城戰派兵出發時，帶出的兵力會立刻從家中的庫存 (`workers`) 與人口 (`population`) 暫時扣除，此時留守兵力下降可能導致治安度浮動。
  - 任務結算時，根據戰報計算真實「戰損」，並將倖存士兵還給領地，陣亡者永久消散。
- **UI 與邏輯修正 (Bug Fixes)**：
  - 修復了「發動攻城戰」按鈕被錯誤鎖定的問題：現在點擊非玩家所屬的派系據點時，底部操作按鈕已解鎖並正確顯示為「⚔️ 發動攻城戰」。 *(註：未來將討論並加回未探索鎖定機制)*
  - 修復了「謁見廳」按鈕在玩家非首都據點無法顯示的問題：現在只要玩家的爵位高於「平民」，回到自己的領地街道時即可正常進入「謁見廳」進行官職任命。
  - **按鈕排版與遮擋修復**：修正情報面板中的「討伐該區/發動攻城戰」操作按鈕被右下角「結束本日」按鈕遮擋的問題。將操作區塊改為彈性的 `Flex` 佈局（為未來的新功能按鈕預留空間），並加上 `margin-bottom: 315px;` 確保其浮動於史詩按鈕之上。
## 2026-07-23 (Phase 4: Shield Combat Engine)
- **CombatSystem 更新**: 實作了「護盾攔截器」，傭兵可以攜帶兵力作為護盾，護盾會優先吸收傷害，且包含兵種相剋計算 (`INFANTRY` > `CAVALRY` > `ARCHER` > `INFANTRY`)。
- **Combat 擴充**: 在 `CombatParticipant` 與 `CombatEvent` 中加入 `shieldType`, `shieldMaxHp`, `shieldCurrentHp`, `shieldDamage` 等屬性，並在 `CombatReport` 新增 `shieldLoss` 用於記錄戰損。
- **DispatchSystem 更新**: 戰鬥結算後，會依據 `shieldLoss` 扣除領地中真實的軍隊人口，並將戰損訊息寫入 `battleLog`。
- **UI 更新 (ModalController)**: 在討伐出發前的介面中實作了「戰前手動派兵 UI (方案B)」，讓玩家可以手動為每位出戰傭兵指派兵種與數量，並會動態驗證是否超出領地庫存。

## [2026-07-23] 傭兵系統基礎重構與官職任命系統 (Phase 1)

- **名詞重構 (Adventurer to Mercenary)**：
  - 專案內全面將「冒險者」字眼重構替換為「傭兵」，以符合中世紀領地與軍事發展的寫實風格設定。
- **官職資料與屬性實裝 (`types.ts` & `Adventurer.ts`)**：
  - 新增 `OfficeType` (扈從、隊長、方旗騎士、城主) 及其對應的俸祿、帶兵數上限、統帥加成與內政加成 (`OfficeConfig`)。
  - 將各爵位 (`TitleConfig`) 綁定解鎖對應數量的官階空位 (例如男爵能指派 2 位扈從與 1 位隊長)。
  - `Adventurer` 模型新增 `office` 屬性，用於記錄該傭兵目前擔任的官職。
- **謁見廳：官職任命 UI 重構 (`index.html` & `OfficeController.ts`)**：
  - 將謁見廳 (`#view-hall`) 的版面重新劃分為左右兩側的儀表板。
  - **左側 (領地官階)**：根據玩家當前爵位動態生成對應數量的官階卡槽。顯示每項官職的詳細加成與解任操作。
  - **右側 (待命傭兵)**：點選左側空位後，右側會動態列出目前無官職的閒置傭兵名單供玩家點選任命。
  - **底層拆分**：新增 `OfficeController.ts` 負責謁見廳 UI 的獨立渲染與任命邏輯，解耦了主控制器的負擔。
- **月底結算與財務懲罰機制 (`DispatchSystem.ts`)**：
  - 更新每月結算邏輯：現在傭兵的維護費不再固定，而是根據其擔任的「官職」計算對應的俸祿（無官職者預設為 30 金）。
  - **欠薪拔官懲罰**：當領地陷入財務危機（淨利為負且金幣小於 0）時，有機率（30%）觸發欠薪懲罰，擁有官階的傭兵會憤而辭去官職，並由系統印出對應的紅字警告日誌。

## [2026-07-23] 武器標籤與變異職業動態檢定 (Phase 3)

- **裝備標籤系統 (`types.ts`)**：
  - 新增 `WeaponType` 列舉，定義了 12 種不同風格的武器標籤（如 `GREATSWORD`、`DUAL_BLADES`、`SWORD_AND_SHIELD` 等）。
  - 在 `Equipment` 與 `EquipmentTemplate` 中加入可選的 `weaponType` 屬性，作為後續動態判定變異職業的依據。
- **動態職業機制 (`Adventurer.ts` & `DataStore.ts`)**：
  - 將核心的基礎職業統一為 6 種：**戰士、騎士、法師、盜賊、祈禱者、弓箭手**。
  - 在 `Adventurer` 模型內實作了 `currentClass` getter。當角色沒有裝備武器或裝備一般武器時，顯示基礎職業；當角色裝備了特定標籤的武器時，將「動態變化」為專屬的變異進階職業（例如：戰士拿雙劍變「魔劍士」、祈禱者拿審判槌變「異端拷問者」）。
  - 將所有與 UI 相關的 `adv.job.name` 查詢，全面替換為 `adv.currentClass`，讓玩家能即時在面板中看見轉職變化。

## [2026-07-23] 兵力轉換與軍隊糧食消耗系統 (Phase 2)

- **軍事兵種轉換 UI 實裝 (`index.html` & `UIManager.ts`)**：
  - 在「領主書房 (Base)」的勞動力分配面板中，除了原本的農夫、礦工、伐木工外，全新加入了「步兵」、「弓兵」與「騎兵」三個兵種滑桿。
  - 將軍隊職位納入 `WorkerJob` 列舉型別，與基礎經濟建設人口統一藉由滑桿進行即時的人力轉換。
- **兵種糧食消耗引擎 (`SettlementSystem.ts`)**：
  - **沉浸式後勤機制**：被轉化為兵力護盾的人口將產生額外的糧食消耗壓力。
  - **兵種消耗量**：步兵與弓兵每人每天除了基礎的 1 糧食外，會再額外消耗 1 單位糧食（共 2 糧/天）；而騎兵因為包含戰馬的消耗，會額外消耗 2 單位糧食（共 3 糧/天）。
  - 當遭遇飢荒時，部隊也將會被一併列入因飢餓而逃兵（死亡/流失）的隨機懲罰陣列中。

## [2026-07-22] 爵位系統深化 (多維度條件與特權擴充)

- **爵位特權擴充 (`types.ts`)**：
  - **英雄人數上限 (Max Roster)**：現在爵位會卡控英雄招募數量上限（例如平民最多 10 人，公爵最多 60 人）。在 `RecruitController` 與 `ActionController` 實作防呆。
  - **建築等級上限 (Max Facility Level)**：在 `Territory` 的升級邏輯中加入卡控，現在必須提升爵位才能繼續升級設施（平民 Lv.1，男爵 Lv.3 等）。
  - **每日稅收加成 (Tax Bonus)**：每日結算時，根據爵位給予對應的稅收（例如男爵每 10 人口獲得 2 金幣），實作於 `SettlementSystem`。
- **A+B 晉升考驗機制 (`UIManager.ts` & `index.html`)**：
  - **多維度晉升條件**：晉升不再僅看聲望，現在還需要檢核「聲望、人口數、金幣」等多維指標。
  - **舉辦晉升大典**：滿足硬性條件後，介面會顯示「舉辦晉升大典」按鈕，玩家點擊並支付昂貴的儀式費/進貢費後，才會正式獲得新爵位與新特權。

## [2026-07-22] 工作分配 UI 升級 (滑桿 + 按鈕) 與探索周邊流民獲取機制

- **工作分配 UI 排版重構 (`index.html` & `FacilityController.ts` & `UIManager.ts`)**：
  - **三層式乾淨排版**：頂層展示「職業標題」與「當前分配人數（如 `🌾 農夫  5 人`）」，中層放置 `[ - ] [ 拖曳滑桿 (Slider) ] [ + ]` 操作列，下層顯示每人產出說明。
  - **即時拖拽與完美防呆**：導入 `<input type="range">` 滑桿，動態將滑桿上限鎖定為 `當前職業人數 + 閒置人數`。無論滑動或連點按鈕，皆能防呆且流暢分配。
  - **畫面同步**：於 `UIManager.updateUI()` 中自動同步更新滑桿數值與上限。
- **探索周邊難民獲取機制 (`ActionController.ts`)**：
  - **繁榮度反比演算法**：在探索周邊時，根據當前據點的繁榮度（Prosperity）計算獲取難民的機率（繁榮度 0 時最高 30% 機率，繁榮度 500 時衰減至最低 5%）。
  - **流民救助獎勵**：成功觸發時，將救出 1~3 名隨機流民並加入領地閒置人力，搭配 Toast 提示與日誌記載。

## [2026-07-22] 領地人口自然增長機制重構

- **動態人口成長邏輯 (`SettlementSystem.ts`)**：
  - **條件放寬**：從「餘糧需大於總消耗 2 倍」下修為「只要有餘糧 (不挨餓)」即可具備吸引流民的資格。
  - **機率提升與聲望連動**：基礎吸引機率由死板的 10% 提升至 20%，且每擁有 100 點聲望額外增加 1% 機率（最高 50%），讓玩家經營聲望有實質回饋。
  - **動態收益縮放 (Scaling)**：流民增加數量不再固定為 1 人，改為「當前總人口的 5%（向下取整，保底 1 人）」。這解決了中後期 100+ 人口時勞力枯竭、增長過慢的死水問題。

## [2026-07-22] 領地礦工產鐵邏輯重構

- **礦工獨立產鐵機率判定 (`SettlementSystem.ts`)**：
  - **由全域改為個體判定**：修正原本全域僅有一次 20% 產出 1 個鐵礦的上限缺陷，改為針對「每一位礦工」獨立進行 20% 機率判定。
  - **數值期望值正向成長**：現在分配越多礦工，每日挖出鐵礦的期望值與數量上限將隨人數正向成長（如 10 名礦工平均每日期望產出 2 個鐵礦）。

## [2026-07-22] 領地工作分配介面排版優化

- **領地工作分配職業選項雙層結構重構 (`#view-base`)**：
  - **產出說明獨立一行**：將「農夫」、「伐木工」、「礦工」等職業區塊改為雙層 Column Flex 佈局。上半部放置職業標題與 `[ - 0 + ]` 調整按鈕，下半部獨立顯示產出說明。
  - **防止標題換行**：針對職業名稱設定 `white-space: nowrap;`，徹底解決面板寬度較窄時，職業文字（如「農夫」）被不當拆字換行的問題。

## [2026-07-22] 傭兵卡片 Tooltip 資訊精簡與換行置中排版

- **傭兵卡片 Tooltip 簡化與置中**：
  - **精簡展示內容**：移除冗長的六維屬性（力量、敏捷...）、戰力與裝備清單，僅展示 **名稱**、**等級與職業**、**當前狀態** 三行資訊。
  - **換行與文字置中**：使用 `<br/>` 進行三行換行，並為 `#adv-tooltip` 補上 `text-align: center;`，呈現乾淨與對齊的簡潔提示框。

## [2026-07-22] 街道建築排版優化 (無卷軸、手動拖曳、左右箭頭提示) 與帝國日誌邊界修復

- **街道建築排版與互動體驗升級**：
  - **隱藏原生卷軸與彈性撐開**：隱藏瀏覽器預設滾動條 (`scrollbar-width: none` / `::-webkit-scrollbar { display: none; }`)，為 `#street-buildings-wrapper` 設定 `min-width: max-content;` 與 `flex-shrink: 0;`，確保每棟建築完整不變形。
  - **滑鼠拖動 (Drag-to-Scroll)**：新增流暢的滑鼠按住拖拽滾動事件處理，隨手拖拽即可平滑滑動街道。
  - **左右引導箭頭 (`◀` / `▶`)**：兩側新增具備金屬羊皮紙風格與呼吸脈動動畫的左右箭頭，支援點擊平滑滾動（250px），並能依滾動邊界動態顯示與隱蔽。

- **帝國日誌訊息框縮短與固定 (`#game-log`)**：
  - **Flexbox 邊界與框架拉高**：配合 `.dashboard-bottom` 父容器 `min-height: 0;`，將 `#game-log` 的 `margin-bottom` 設為 `270px;`（替換內距留白），將訊息框黑底與下邊框精準拉高並固定在距離底部 270px 之處，徹底高於右下角羅盤鈕（265px）與史詩圓鈕，框體不再延伸溢出。

## [2026-07-22] 切換世界地圖按鈕縮小 1/3 與右側靠齊對齊

- **切換世界地圖 / 我的據點羅盤圓鈕 (`.floating-base-btn`) 尺寸與對齊調整**：
  - **尺寸縮小 1/3**：由 `112px × 112px` 縮小 1/3 至 `75px × 75px`，精巧好看且不干擾畫面。
  - **右側齊平對齊**：設定 `right: 0` (相對於 `#command-crest-container` 右側邊界)，垂直方向與下方 `176px` 的結束本日史詩大鈕右側完美靠齊對齊（`bottom: 190px; right: 0;`）。

- **按鈕與帝國日誌整體佈局**：
  - **結束本日史詩大鈕 (`#btn-end-day`)**：保持放大一倍 `176px × 176px`（當前天數膠囊 `font-size: 15px`）。
  - **帝國日誌上縮避讓 (`#game-log`)**：`margin-bottom: 315px;` 保持上縮，底部位於 315px 高度，完全避開 265px 的羅盤鈕頂端，100% 乾淨無遮檔。

## [2026-07-22] 傭兵小隊 ICON 高光調亮與大陸地圖視圖隔離

- **傭兵小隊 ICON 與視覺增強**：
  - **圖示色彩與高光調亮**：為右下角快捷列的傭兵小隊按鈕 (`.dock-btn`) 加上閃耀金色金屬邊框 (`#eab308`)、高亮漸層背景與 `👥` 圖示金色發光陰影特效 (`text-shadow: 0 0 8px #fef08a`)，徹底解決原本顏色太暗沉的問題。
- **大陸地圖視圖隔離邏輯**：
  - **大陸地圖下隱藏與自動關閉**：玩家位於「大陸地圖 (`map-view`)」時，自動隱藏右下角傭兵隊伍按鈕 (`#btn-dock-party`) 並關閉傭兵小隊面板 (`#modal-party-list`)。
  - **據點街道專屬**：傭兵小隊面板與快捷按鈕僅在玩家進入「據點街道 / 國家視圖 (`scene-view`)」或據點設施時呈現，符合地圖視圖隔離設計。

- **傭兵小隊面板 UI 史詩升級**：
  - **HP / MP 能量條位置調整**：將原本位於右側屬點分頁 (`party-tab-viewport`) 內的 HP (深紅) 與 MP (寶藍) 能量條移出，整合至左側 **半身像立繪卡 (`party-portrait-card`) 的正下方** 顯示，包含居中動態陰影數字與平滑條狀比例，使半身像與傭兵當前狀態緊密連結，右側屬性/配點介面更為乾淨清晰。
  - **方案 A Full-Art 滿版卡牌質感重構**：
    - 將選擇成員區域升級為 **Full-Art 滿版卡牌格式**。每張卡片高度拉高至 `78px`，內部設置滿版立繪相框 (`adv-avatar-wrapper`) 搭配沉底暗色漸層遮罩 (`adv-card-gradient`)。
    - 傭兵姓名與等級改為半透明沉底印記，兼具 100% 畫面可讀性與現代手遊/RPG 的精緻實體卡牌質感，預先為未來高精細 2D/3D 立繪資產預留最大的展現空間。
  - **面板高度與防遮擋優化**：
    - 將面板最大高度擴充為 `625px`，充分利用下方剩餘的視覺空間，讓 5×3 (15人) 卡牌完全不被裁切且具備寬敞大氣的視覺呼吸感，同時與街道下方建築（如武器店等）保持安全的視覺空隙。
  - **清除殘留黑框 Tooltip**：徹底移除 CSS 中舊有的 `.adventurer-card::after` 偽元素彈窗樣式，解決滑鼠移至卡片右側時出現多餘固定空白黑框的問題。

## [2026-07-22] 傭兵小隊視窗長度縮短與高質感 UI 排版重構

- **傭兵/傭兵小隊面板精簡與 UI 重構**：
  - **高度邊界與佈局優化**：將左側面板 (`.side-panel-left`) 高度限制為 `max-height: 480px`，徹底解決視窗過長遮擋街道下方「防具店」、「鍛造屋」等建築入口的問題。
  - **動態傭兵姓名標題**：移除原本寫死的「🛡️ 傭兵小隊」靜態文字，頂部標頭改為即時顯示當前選取傭兵的姓名與等級職業（例如：`🛡️ 里奧弗里德 · 萊森 (Lv.1 見習騎士)`）。
  - **移除 N/R/SR/SSR 蓋圖標籤**：移除立繪頭像框上方遮擋大尺寸的 N/R/SR/SSR 品質標籤，畫面更乾淨清爽。
  - **HP 與 MP 動態能量條**：移除舊版純文字形式的 HP/MP 顯示，全面升級為帶有深紅與寶藍漸層質感的動態能量條（血條與魔條），內部帶有居中陰影數字（`220 / 220`）。
  - **2/3 + 1/3 二分法排版**：
    - 上半部 (2/3 空間, ~285px)：左側常駐顯示傭兵肖像/半身像與狀態；中間動態切換詳情 Viewport（能量條、六維與裝備）；右側配置 `📊 屬點` 與 `⚔️ 武具` 垂直頁籤。
    - 下半部 (1/3 空間, ~105px)：橫向捲動成員清單，點擊選卡即時切換頂部標題、左側立繪與中間屬性/裝備數據。

## [2026-07-21] 核心可靠性、Phaser 架構與響應式 UI

- **美術資產與 UI/UX 史詩重構**：
  - **Isometric 45度俯視角地圖節點資產**：產出 8 款繪寫風格 isometric 3D 地圖建築/節點圖案（城堡、村落、廢墟、洞穴、密林、港口、修道院、火山魔窟），在 Phaser MapScene 替換原本的純 Emoji/文字，並支援等比例 Hover 放大與動態高光陰影。
  - **右下角「史詩劍盾 Command Crest Hub」**：移除右上角舊版按鈕，改於右下角固定呈現直徑 92px 的立體金屬圓形劍盾按鈕（內嵌當前天數 `第 X 天` 標牌），具備 Hover 金光與沉降壓按回饋。
  - **導航與快捷選單**：在劍盾上方配置「切換據點/世界地圖」羅盤圓鈕；在劍盾左側橫向配置 `👥 傭兵小隊 Modal` 與 `⚙️ 系統選單` 快捷 Dock。
  - **街道右側欄目整頓**：自街道右側 Imperial Dashboard 徹底移除占用空間的「傭兵陣列」，收納至獨立的 `🛡️ 傭兵小隊 Modal` 中；讓右側欄目專注於爵位施政進度、每日收支與廣角歷史日誌，顯著提升整體版面質感與可讀性。
- 戰鬥節點改用兩把獨立 SVG 劍，以劍尖為旋轉原點從左右上方沿劍身方向高速斜射入土；完整插地、金色衝擊環、停留與淡出以 3.2 秒循環，移除原本遮住圖示的紅色圓底與紅色地面光。
- 行商任務改用不可變 itinerary、明確去程／回程 phase 與 leg index；修正第一段及回程路線不顯示，並相容舊版進行中任務。
- **修復 3D Isometric 地圖建築圖示載入與繪製**：補齊 `getNodeTextureKey` 匯入與 Phaser 圖片 Sprite (`iconSprite`) 載入邏輯，完全恢復全套 3D 繪寫風中世紀建築節點（城堡、城鎮、村莊、營地、魔窟、廢墟），搭配橢圓地基陰影與黑金銘牌標籤。
- **100% 恢復「結束本日」質感黑屏過渡轉場 (`playTransition`)**：點擊「結束本日」時重新帶入 0.5 秒黑屏/羊皮紙過渡轉場，轉場期間平滑完成天數遞增與資源產出結算後淡出，重塑 RPG 沉浸感。
- **三重導航動線修復（徹底解決「返回據點」按鈕遺失問題）**：
  1. **右側資訊面板 (`map-info-panel`)**：新增獨立實體按鈕 `[ 🏰 返回我的據點 ]`（在街道視圖時顯示 `[ 🌍 返回世界地圖 ]`）。
  2. **右下角 Command Crest Hub**：保留金邊羅盤圓鈕與 88px 史詩劍盾大鈕。
  3. **頂部資源列點擊**：頂部 `🏰 [據點/世界名稱]` 點擊亦可直接切換視圖。

### 修復與優化 (Fixes & Improvements)
- **UI 防誤觸機制完善**：調降右下角史詩按鈕容器 (`#command-crest-container`) 的層級至 `950`，確保彈窗 (層級 `1000`) 開啟時，背景按鈕無法被點擊，解決誤觸問題。
- **每日結算與轉場時序重構**：
  - 調整「結束本日」流程：現在會先於背景計算資源，並**直接彈出「本日結算面板」**。玩家確認後才會進行黑屏轉場並進入下一天，解決了結算與轉場節奏突兀的問題。
  - 導入**事件佇列 (Event Queue)** 機制：若在結算計算中觸發重大事件，會將彈窗延遲到轉場黑屏結束後才依序顯示，避免多個彈窗（如結算與重大事件）互相覆蓋。
- **戰鬥紀錄系統重啟**：
  - **取消自動重播**：討伐結束後不再自動彈出戰鬥重播，將遊戲節奏控制權交還給玩家。
  - 補完遺失的 `<div id="modal-combat-history">` 介面結構，並在畫面右下角快捷區新增專屬的 **「⚔️ 戰鬥紀錄」** 按鈕，現在可以隨時查看並手動點擊「🎬 重播」來觀看歷史戰果。

- **主選單 UI 隔離保障**：將 `#command-crest-container` 初始標籤設定為 `style="display: none;"`，徹底解決主選單與創角階段畫面右下角突兀露出按鈕的問題。
- **修復大陸地圖右下角按鈕消失問題**：移除 `index.html` 中因舊有佈局殘留、被包在據點專屬面板內的重複 `#command-crest-container` 節點。確保 JS `getElementById` 能正確綁定到全域層級的唯一容器，使「史詩劍盾」、「快捷 Dock」與「懸浮返回按鈕」能在大陸地圖與據點視圖中同時且正常地顯示。同時移除了地圖資訊面板 (`#map-info-panel`) 與據點儀表板 (`#scene-dashboard-content`) 中多餘的文字版「返回我的據點」及「返回世界」大按鈕。
- **傭兵小隊 UI 修復與懸浮 TIP 優化**：
  - 將 `#modal-party-list` 傭兵小隊彈窗介面由全螢幕模態框（Modal）優化為左側非模態抽屜面板（Non-modal Side Panel），使其在開啟時不再阻擋玩家對背景畫面（如地圖、其他按鈕）的點擊操作；同時將右下角快捷按鈕的行為改為「切換（Toggle）」模式，按一下開啟、再按一下關閉。
  - 為右下角的「切換據點 / 世界地圖」懸浮圓鈕與「結束本日」史詩劍盾實裝了精緻的自訂 `[data-tip]` 懸浮提示 (Tooltip) 樣式，大幅提升視覺回饋質感。
- **資源列 UI 補完**：在畫面上方的頂部資源列中，正式補上了「🔗 鐵礦」的數值顯示，讓玩家能即時掌握所有建材存量。
- 新增 `MISSIONS_CHANGED` 事件統一刷新地圖，任務結束後雙劍會立即移除，不讓核心 `GameLoop` 直接依賴 UI。
- 雙劍動畫改為可追蹤 tween，重建節點時只清理任務效果，不會誤停商隊或其他 Scene 動畫。
- 一般探索與酒館招募排除初始英雄專屬的「誓約守衛」特性。
- 傭兵與地圖 tooltip 共用四方向邊界定位，並修正休養、討伐按鈕與行商損益文案。
- 修正多波戰鬥未清完仍判勝、探索重複發送戰鬥獎勵，以及休息經驗誤加聲望等核心結算問題。
- 存檔升級為 schema v2，保存累計天數、威脅狀態與每日摘要，並支援舊版日曆存檔遷移。
- 新增可注入且可設 seed 的亂數來源，讓戰鬥與隨機系統可重現、自動測試。
- 將 Phaser 地圖呈現資料與 DOM 控制器拆分；Scene 關閉時會清除 tween、tooltip 與事件監聽。
- 新增災害倒數、提前備災、派遣風險與預期報酬、每日資源差異摘要。
- 修正窄螢幕版面，存檔欄位改為語意化按鈕，補上鍵盤可操作的地圖節點清單。
- 新增 Vitest、TypeScript、production build、bundle budget 與 GitHub Actions 品質閘門。
- 新增 P0 自動化 Headless Chromium Smoke Test (Playwright)，覆蓋新遊戲選擇據點、進入街道與領主自宅、結束本日日期遞增、系統選單手動存檔與頁面重新整理進度還原閉環，並整合至 `npm run check` 流程。
- 拆分 `main.ts` 的 UI wiring，依據畫面將過度集中的 DOM 事件與邏輯抽離為獨立的 UI Controllers (`RecruitController`, `MainMenuController`, `GameFlowController`, `FacilityController`, `ActionController`, `CheatController`)，顯著降低單一檔案耦合與代碼複雜度。
- 完成 P1 Lazy Chunk 優化：
  - 將 Phaser 引擎與地圖繪製邏輯抽離為 `PhaserManager.ts`，並在 `MainMenuController.ts`（進入旅程/載入存檔時）改為動態 `await import('./PhaserManager')` 加載，配合 Toast 載入提示。
  - 將低頻建築與倉庫介面抽離為 `ShopController.ts`，並改為點擊視圖時動態加載。
  - 將跑商規劃與交易介面抽離為 `TradeController.ts`（標有清晰架構註記），實現按需動態加載，使主包 (main bundle) 體積大幅縮減。


## [2026-07-19] 領地建築升級、獨立武具商店與傭兵卡片 Tooltip 懸浮化

- **領地建築獨立建造與升級**：自宅新增「領地建築升級」面板。酒館、武器店、防具店、鍛造屋等四棟設施需要玩家耗費金幣與建材（木材、石材、鐵礦）在自宅中進行建造/升級，且只在建造後才會在城鎮街道上動態生成 Flexbox 入口，徹底告別寫死排版。
- **獨立武具商店與酒館招募**：
  - 武器店、防具店現在是獨立建築，根據店鋪等級（1~3級）動態解鎖 1~3 階（精鐵、鍛鋼、鎢鋼）裝備供玩家購買。
  - 酒館招募品質上限與酒館等級掛鉤，並徹底移除原有的特訓清單。
- **自宅探索隨機與保底機制**：
  - 每次探索周邊有 10% 機率招募到一名傭兵，並給予微量建材資源。
  - 保底機制：前 3 次探索必有一名品質 N 級加入。非保底時，招募到的品質極大機率為 N，其餘遞減至 SSR。
- **屬性配點確認防誤觸**：配點介面改為暫存配點。玩家可點擊 `+` / `-` 增減並以綠色顯示 `(+N)`，點擊「確認分配」按鈕後才正式扣除屬性點並生效，並在此時輸出一次簡潔的 console 日誌。另外，手動加點去除了魅力與統帥。
- **據點開局難度與資源差異化**：起始據點選擇面板中，標示該據點類型對應的難度（首都簡單，荒野極難）。點擊確認開局時，根據難度初始化不同的起始資金、流民人口、糧食與建材，並清空已分配的工作。
- **據點插地動畫與外派人員 Tooltip**：大圖中當玩家派遣小隊前往據點時，該據點會顯示兩把劍斜向掉落、插地重疊、顫動淡出的 Phaser 循環動畫；且地圖節點 hover tip 會動態載入該據點的外派傭兵姓名與剩餘天數。
- **自宅傭兵 Tooltip 一致化**：移除傭兵卡片原本 the HTML `data-tooltip`，改用 JS 滑鼠監聽動態跟隨 tooltip。顯示詳細六維屬性、戰力、當前裝備，且如果處於外派任務中，則動態查出其派遣據點與任務名稱。
- **修復開局卡地圖問題**：解決了新開局選擇初始城市並點擊「就決定是這裡了！」後，因沒有自動切換進入城鎮街景而使玩家卡在世界地圖、造成「無法進入旅程」的體驗阻塞問題。現在選定據點後會自動且滑順地切換進入該城鎮的街道場景。
- **修復主選單「進入旅程」點擊無效問題**：解決了因 `index.html` 移成了 `#street-scroll-area` 及 `#btn-back-map` 等元素，但在 `main.ts` 初始化時仍使用強斷言獲取並綁定監聽，導致拋出 `null` 屬性錯誤而中斷整個腳本載入的 Bug。現在已完全移除廢棄的街區拖曳滾動事件，並對返回地圖按鈕綁定實施了安全防空判斷。
- **修復與優化據點自宅遮擋及雙劍交叉動畫**：
  - 自宅遮擋與大樓重疊修復：由於優化街道 Flexbox 排版時移除了拖曳容器，承載建築按鈕的 `#street-buildings-wrapper` 缺少定位，被背景層遮擋；且因 `.street-building` 原先設定為 `position: absolute`，脫離了 Flexbox 佈局流，導致所有街道大樓（自宅、酒館等）全部重疊在同一個位置。已將其定位修改為 `position: relative` 並對 wrapper 補上適當層級，大樓現已能在街道上依序橫向並排。
  - 雙劍交叉與尺寸優化：為了徹底解決因 🗡️ 短劍 Emoji 在不同平台上自帶各種傾斜角與拼湊交叉時定位偏移（形成 V 形或平行重合）的弊端，我們改用一體化完美的 ⚔️ (Crossed Swords) 交叉雙劍符號，將字型放大至 `38px`，並在 Phaser 中為其設計由天而降插地抖動、停留後淡出的循環動畫，視覺上 100% 呈最完美的 45 度斜插交叉姿態。
- **新增開發者資源修改後門（統一註記區塊）**：
  - 後門擴充：現在不只金幣，還新增了木材、石材、鐵礦資源密技。全域控制台可使用 `window.cheatWood(數字)`、`cheatStone`、`cheatIron` 進行修改。
  - 鍵盤密碼彩蛋：在畫面上分別連續敲擊 `gold`、`wood`、`rock`、`iron`，將會彈出對應的資源修改密語框，便於領地建造與升級的測試。
  - 統一註記：所有作弊碼皆使用醒目的 `// === CHEAT_CODES_START ===` 與 `// === CHEAT_CODES_END ===` 包裹註記，以便未來發布前能一鍵搜尋整段刪除。
- **修復自宅建築升級材料豆腐塊問題**：
  - 由於 Windows 系統預設字型對部分較新的 Emoji（如 🪵、🪨）相容性不佳會顯示為 `[][]` 亂碼，我們將圖示更換為高相容性 Emoji，並直接在後方加上清晰的中文文字標示（如 `🌲 木材`、`🧱 石材`、`🔗 鐵礦`），搭配暗色底框，保證 100% 可讀性。

## [2026-07-19] 戰鬥多波次一鏡到底與結算介面優化

## [2026-07-19] 戰鬥視覺 FF 風格大改版與進度討伐系統

- **戰鬥畫面結構重構 (太空戰士風格)**：將戰鬥畫面的版面配置重新劃分為上 2/3 的「戰鬥舞台」與下 1/3 的「戰報文字區 (含捲動條)」。玩家團隊固定在舞台左側（向右攻擊），敵方在舞台右側，並加入前後排的立體交錯站位設計。
- **動態情境背景**：戰鬥舞台不再是單一背景，現在會根據遭遇戰的地形（如荒野、森林、沙漠等），渲染不同的漸層情境背景，為未來的環境美術圖預留空間。
- **進度討伐模式 (Progress Subjugation)**：
  - 在派兵討伐時，新增「單次討伐」與「進度討伐」選項。
  - 進度討伐將觸發連續多波次 (Wave) 的戰鬥，成功後可獲得極大的獎勵。
  - 核心系統預留未來 100% 探索度將觸發首領戰的機制設計。
- **職業前後排機制**：傭兵現已加入 `FormationRow`（前/後排）屬性，近戰職業預設分配於前排，遠程或法系職業分配於後排。

## [2026-07-19] 戰鬥視覺大升級與歷史戰報系統實裝

- **戰鬥動畫與特效 (Combat Animations & Effects)**：戰報播報不再只有純文字，現在參戰角色圖示（英雄與敵人）會在攻擊時發動向前衝撞 (`.attack-bump`) 動畫，目標受擊時會閃爍紅光 (`.hit-flash`)，同時傷害數字會以跳動的特效漂浮而出，營造出強烈的戰鬥打擊感。
- **戰鬥介面易讀性優化**：為戰報面板增加了半透明的黑色漸層遮罩，並調整文字顏色為高對比的淺亮色，徹底解決原本黑色字體融入羊皮紙背景導致難以閱讀的問題。
- **自訂播放倍速 (Playback Speed)**：實裝 1x (較慢打字與動畫) 與 2x (快速播報) 切換功能，滿足希望觀賞細節或追求效率的玩家需求；同時保留瞬間完成的選項。
- **戰鬥歷史紀錄與 MVP 統計**：於左側的世界動態介面中，新增了「戰鬥紀錄」按鈕。玩家可打開專屬面板查看最近三天內的戰役紀錄，上面將羅列各戰役的勝利與否、總傷害、總收益，以及單場戰役的 **MVP 英雄**，更可透過「重播」功能無縫回味經典戰局！

## [2026-07-19] 戰鬥系統 v2 實裝：深度運算與動態戰報

- **深度戰鬥模型重構**：將原本 `DispatchSystem` 內的寫死判定，抽離為獨立的 `CombatSystem`。導入命中率、減傷率與行動順序（依敏捷亂數排序）的深度回合制運算機制。
- **狀態異常機制 (Status Effects)**：實裝流血 (Bleed) 與中毒 (Poison) 異常狀態，角色會在每回合開頭結算固定或百分比傷害。
- **動態戰報播放器**：新增 `#combat-modal` UI。戰鬥發生時，會彈出具有史詩感的對戰視窗，動態顯示雙方陣營血條，並以每 0.6 秒吐出一句的速度進行打字機戰報播放。
- **視覺回饋與互動**：戰報文字依照事件類型（爆擊、閃避、異常狀態）具有專屬顏色，爆擊時更會觸發畫面的 CSS 震動特效；同時提供「⏩ 快速跳過」按鈕供放置型玩家瞬間查看結果。
- **任務與戰鬥解耦**：`DispatchSystem` 在野外遭遇戰時，會無縫將參戰者 ID 交給 `CombatSystem` 模擬，並透過 `EventBus` 廣播 `COMBAT_FINISHED` 事件，讓 UI 獨立攔截並播放。

## [2026-07-19] 新旅程起始選擇橫幅樣式優化

- **選擇起始點橫幅優化與防阻擋**：
  - 將原本位於畫面正中央、體積龐大的「你要從哪裡開始你的旅程？」提示橫幅，移至畫面正上方（`top: 20px`）。
  - 縮減了橫幅的上下 padding 與字體大小，使其轉變為較不佔空間的「標題列」風格。
  - 新增 `pointer-events: none` CSS 屬性，徹底解決橫幅可能會阻擋滑鼠點擊位於畫面上方地圖節點（如：無光修道院、碎冰洞）的問題。

## [2026-07-19] 統一呼叫儲存與退出功能，並將返回據點按鈕改為懸浮樣式

- **返回據點按鈕 V2 視覺重塑與 CSS 圓形裁切**：
  - 重新生成並替換「返回據點」懸浮按鈕圖片（`public/assets/return_base_btn.png`）。
  - 為徹底解決圖片邊角殘留的「偽去背灰白棋盤格」問題，在 CSS 樣式中引入了 `clip-path: circle(46% at 50% 50%)` 與 `border-radius: 50%` 進行強制正圓形裁切，並將 `background-size` 稍微放大至 `104%` 填滿邊界。這能直接將圓圈四個方角與極邊緣處的棋盤格像素完全剔除，確保按鈕外觀呈現 100% 乾淨透明的去背效果。
- **引入系統選單 Modal 與全域統一呼叫優化**：
  - 為了解決頂部資源列（`#top-bar`）在小解析度下硬塞儲存/退出多個按鈕而被擠扁、文字垂直折行並遮擋地圖的 Bug，我們引進了**系統設定選單彈出視窗（System Settings Modal）**。
  - 頂部資源列右側簡化為僅保留「⏳ 結束本日」與一個小巧的「📜 系統選單」按鈕。
  - 點擊系統選單按鈕時，會開啟精美羊皮紙風格的對話框，內建「💾 儲存目前進度」與「🚪 儲存並退出遊戲」兩個大按鈕，點擊後會觸發對應功能並自動關閉 Modal。
  - 這樣做徹底解決了 UI 擁擠遮擋的問題，且更加符合中世紀 RPG 擬物化 UI 的設計美學。
- **返回據點懸浮按鈕位置調整**：
  - 將「返回據點」按鈕從世界地圖右側面板移至世界地圖主體區塊右上角。
  - 在 `UIManager.updateUI()` 中增加了顯隱邏輯：僅在世界地圖活躍且非開局狀態、玩家已擁有據點時才顯示該懸浮按鈕。

## [2026-07-18] 修復點選自家據點時右側欄殘留大陸地圖資訊的 UI Bug

- **右側欄面板顯示互斥優化**：修復玩家在大陸地圖上點選其他據點開啟詳細資訊面板（`#node-detail-panel`）後，點選自家據點切換到據點場景時，右側面板仍殘留且重疊顯示先前大陸地圖節點資訊的 Bug。
- **統一 UI 顯示狀態控管**：
  - 在 `UIManager.updateUI()` 中統一對右側欄的三個子面板（`#map-info-panel`、`#node-detail-panel` 與 `#scene-dashboard-content`）進行顯示互斥控制。當進入據點場景時，自動隱藏節點詳細資訊面板；而在地圖模式且點開據點詳情時，保持詳情面板顯示並隱藏預設地圖資訊，避免 Tick 刷新時產生疊加衝突。
  - 在 `SceneController.ts` 的 `enterScene()`（進入據點/城市場景）與 `returnToMap()`（返回世界地圖）函數中，主動清除並隱藏 `#node-detail-panel` 的顯示狀態，確保視圖切換時 UI 狀態正確重置。

## [2026-07-18] 引入 Phaser 3 遊戲引擎重構世界地圖

- **世界地圖渲染引擎重構**：將世界地圖與貿易路線的渲染機制由原先的 HTML DOM 節點 + SVG 線段，重構為基於 WebGL/Canvas 的 **Phaser 3** 2D 遊戲引擎。
- **解決事件衝突與穿透**：利用 Phaser 的 Input Manager 處理節點交互與相機操作，徹底解決了原本滑鼠拖曳地圖與點擊節點之間的衝突與誤觸問題。
- **地圖全螢幕自適應與動態縮放 (MinZoom)**：
  - 移除了 DOM 容器的 `16:9` 與最大寬高限制，並調整為 `Scale.RESIZE` 全螢幕模式，使地圖得以在整個螢幕範圍內拖曳與顯示。
  - 在 `MapScene` 中實裝動態 `minZoom` 限制（依當前瀏覽器視口比例計算），確保無論在什麼螢幕比例下，地圖背景皆能完美鋪滿視口不露出黑邊。
- **節點 Hover 互動動效與高亮**：
  - 實裝滑鼠懸停節點時的 Tween 補間動畫，使節點在 150 毫秒內平滑放大至 1.3 倍，並在移開時平滑恢復。
  - 懸停時自動提升節點渲染深度 (`depth`)，防止放大時被相鄰節點遮擋；同時動態加強文字與 Emoji 的外發光陰影半徑，重現精緻的高亮視覺效果。
- **貿易路線與動態商隊動畫**：
  - 路線連線全面改在 Phaser 內以 Canvas 二階貝茲曲線（`Phaser.Curves.QuadraticBezier`）繪製，座標系統統一，解決了 SVG 線段與城鎮節點端點微小偏移對不齊的問題。
  - 當前前進中的商隊在連線上會以實體 Emoji（"🐪"）配合 Tween 動畫沿著貝茲曲線路徑流暢移動，提供強烈且流暢的動態進度回饋。
- **點擊事件解耦**：Phaser 內部的點擊事件採用 CustomEvent 異步拋出給 `MapController.ts` 接收，解耦了控制器與 Phaser Scene 之間的直接循環依賴，保證專案的編譯與打包流暢度。

## [2026-07-18] 修復有主城鎮詳細面板缺失「查看市場」按鈕的 UI Bug

- **有主城鎮詳細面板市場按鈕修復**：修正玩家點擊已偵查且村莊規模以上的有主城鎮時，無法在詳細面板中找到進入市場的入口，導致行商前無法確認物價與可買賣物品的 Bug。
- **按鈕位置與樣式優化**：將錯放在野外據點視圖中的 `#nd-btn-market` 按鈕移入詳細資訊面板 `node-detail-panel` 的底部操作區，並套用現代感的綠色漸層（`linear-gradient`）視覺美化。現在點擊任何已偵查的非玩家城鎮時，將能正常顯示「⚖️ 查看市場」按鈕。

## [2026-07-18] 遊戲啟動器啟動異常診斷優化

- **StartGame.bat 啟動防呆與診斷**：修復遊戲啟動器在執行環境缺乏 Node.js / npm 或未安裝 `node_modules` 依賴庫時會瞬間關閉、令使用者難以排查的問題。新增 Node/npm 偵測、依賴庫自動 `npm install` 修復機制，並在出錯時使用 `pause` 暫停視窗。為防止 Windows 命令提示字元（cmd.exe）在繁體中文系統預設 Big5/CP950 編碼下解析 UTF-8 中文字元產生亂碼與語法錯誤，腳本指令全面採用純英文（ASCII）撰寫，提升啟動相容性與排障體驗。

## [2026-07-18] 行商路線設定首站距離限制與天數依距離計算優化

- **行商首站距離限制**：在世界地圖規劃路線時，限制商隊的第一個停靠站（起點）與玩家據點（本鎮）的距離不能超過 `30` 里。點選過遠的城市會彈出警告提示並予以阻擋，符合從自家出發由近及遠的邏輯。
- **行商天數依距離動態折算**：
  - 將每一路段的移動回合數（天數）折算係數由 `/100` 改為 `/15`，採用 `Math.max(1, Math.ceil(dist / 15))` 進行計算，使移動回合數隨實際距離拉開而有感改變。
  - 第一段（本鎮 ➔ 首站）天數在出發派遣時依上述公式動態計算，不再固定為 1 天。
  - 返程（最後站 ➔ 本鎮）天數也改依最後站至本鎮的實際距離以相同公式計算，不再固定為 3 天。
- **預計旅途天數即時反饋**：在商隊指令面板（`modal-trade-planner`）上新增「預計旅途天數」顯示，隨玩家設定的路線及變更即時計算與顯示總天數，提供更直觀的資訊。

## [2026-07-18] 跑商中途交易日誌中文化修復

- **中途站交易日誌中文化**：修正商隊抵達各中途城鎮在執行「買入」與「賣出」或因超載/資金不足失敗時，控制台印出（並渲染到 UI 右下角近期動態）的日誌顯示為英文商品 ID（例如 `tg_silk`）的問題。透過 `TRADE_GOODS` 字典轉換，使其完全以中文名稱與圖示（例如 `🧵 絲綢`）正確顯示。

## [2026-07-18] 部署編譯相容性優化與循環依賴解耦

- **編譯與部署相容性優化**：
  - *問題排查*：在 strict 模式或特定 Vite / TypeScript 部署建置環境中，因 `MapController.ts` 和 `ModalController.ts` 內未顯示導入 `DispatchSystem` 與 `ActiveMission` 而可能導致型別推導失敗，以及 dynamic import 與靜態循環依賴可能導致打包工具編譯報錯。
  - *修復與解耦*：
    1. 在 `MapController.ts` 與 `ModalController.ts` 頂部顯式導入了 `DispatchSystem` 與 `ActiveMission` 類型，消除型別隱式推導問題。
    2. 將 `renderTradeRoutes` 掛載至全域 `window` 物件上，在 `UIManager.ts` 中改為全域安全呼叫，徹底消除了 `UIManager` 與 `MapController` 之間的模組依賴關係，保證在任何打包與部署環境下皆能 100% 編譯通過。
    3. 將 `DispatchSystem.ts` 中的 `.map().filter()` 型別守衛重構為安全無副作用的 `forEach` 推送，完全消除不同 TS 版本編譯時 Type Predicate 解析失敗或隱式 any 報錯的風險。

## [2026-07-18] 修復存讀檔後商隊活躍任務丟失與傭兵卡死 ON_MISSION 狀態的 Bug

- **活躍任務存讀檔反序列化修復**：
  - *根本原因*：原本的 `SaveManager` 在儲存時並未將 `GameState.system` (即 `DispatchSystem`) 內部的 `activeMissions` 寫入 localStorage，導致讀檔後該列表被初始化為空。但傭兵的 `ON_MISSION` 狀態卻被存了下來，導致讀檔後沒有任務可執行，傭兵永遠「卡死」在派遣狀態無法召回。
  - *修復方式*：
    1. 在 `SaveManager.saveGame` 中將活躍任務列表 `activeMissions` 儲存進存檔中。
    2. 在 `DispatchSystem.ts` 內新增 `loadActiveMissions()` 還原方法，其根據儲存的傭兵 ID，將任務中的傭兵 Reference 重新映射對應回全域已經加載的傭兵實體上，保證資料參考一致。
    3. 在 `SaveManager.loadGame` 還原系統時呼叫該方法，實現活躍任務與跑商路線在重載存檔後的無縫還原。

## [2026-07-18] 傭兵卡片 Tooltip 遮擋修復與商隊預估數值顯示

- **傭兵 Tooltip 層級修復**：修正懸停在傭兵卡片上時，Tooltip 資訊會被右側相鄰卡片遮蓋的問題。藉由在 `.adventurer-card:hover` CSS 中新增 `z-index: 9999;`，使懸停卡片及其子元素在 hover 瞬間自動提升至最上層。
- **商隊買賣預算與重量評估**：在「商隊預設指令面板」中新增「預計買入總金額」與「預計買入總重量」評估資訊。只要玩家變更本金、指派護衛（最大載重改變）、或在中途站修改商品的買入指令與數量時，數值將即時重新計算更新。此外，若金額超出本金或重量超重，警示文字會自動變紅並標註 `(超額本金！)` 或 `(超重！)`。

## [2026-07-18] 大地圖跑商商路流光動畫與爵位商隊派遣限制實裝

- **跑商商路流光視覺回饋**：在世界地圖上動態疊加 SVG 連線。商隊所規劃的路線會以平滑二次貝氏曲線相連，並由固定的雜湊值（Hash）計算彎曲方向避免閃爍。商隊**當前正在移動的線段**呈現**亮黃色虛線與流光流動動畫（螞蟻線）**，其餘段落則以**半透明灰色虛線**呈現，提供直觀清晰的進度回饋。
  - *Bug 修復*：解決 SVG `<path d="..." />` 坐標不相容百分比單位（`%`）導致瀏覽器繪圖失敗的問題。透過為 SVG 設置 `viewBox="0 0 100 100"`，並改寫路徑為純數值坐標以正常渲染；同時按比例微調 `stroke-width`、`stroke-dasharray` 與 CSS 動畫偏移量，實現細緻流暢的動畫。
- **爵位限制活躍商隊上限**：在 `types.ts` 新增了 `getMaxCaravansLimit(title: NobleTitle)`（平民/騎士限 1 隊，男爵/子爵限 2 隊，伯爵限 3 隊，侯爵限 4 隊，公爵限 5 隊），並留下 TODO 註記方便往後數值修改。在「規劃路線」與「商隊出發」時實作了防呆驗證，若商隊數達上限則進行阻擋與警告。

## [2026-07-18] 交易中文化、Emoji 相容性優化與據點倉庫交易品分頁實裝

- **交易品中文化與圖示新增**：修復跑商市場（`openTradeModal`）、**商隊指令面板下拉選單（`openTradePlanner`）**與**跑商任務結算日誌（`completeMission`）**直接顯示英文 ID 的問題，全面改為中文化名稱並配上對應圖示。在 `TRADE_GOODS` 中新增「石材 `🧱`」作為交易品。
- **Emoji 相容性優化**：為了解決舊版系統字型不支援較新 Unicode Emojis（顯示為框框）的問題，將全域的木材由 `🪵` 替換為相容性佳的松樹 `🌲`，石材由 `🪨` 替換為磚塊 `🧱`，地圖村莊圖示由 `🛖` 替換為房屋 `🏡`。
- **地圖節點圖示修正**：重構 `getNodeIcon`，移除對 `ownerFactionId` 的外層 if 判斷。使得不論該節點歸屬哪方勢力（包括無主之地的十字路口旅店等），只要 `nodeLevel` 達到對應級別，皆能正確顯示營地 `⛺`、村莊 `🏡`、城鎮 `🏘️` 等規模圖示，不再顯示地形圖示。
- **新增倉庫交易品物資分頁**：在據點的「倉庫與鍛造」Modal 中加入「交易品物資」分頁（與原有的裝備倉庫分開）。玩家可在此檢視跑商帶回來的各項物資（顯示中文名稱、圖示、當前擁有數量、描述與基礎價值），並提供「直接出售」功能，可以隨時在據點將物資以基礎價格出售換取金幣。

## [2026-07-18] 修復商隊指令面板無法顯示（選完節點沒下文）

- **根本原因**：`modal-trade-planner` 在 HTML 中設有行內樣式 `style="display: none;"`，而 `openTradePlanner()` 使用 `classList.add('active')` 嘗試顯示它。由於 CSS 行內樣式優先級高於 class，Modal 永遠不會出現，造成選完節點後毫無反應。
- **修復方式**：將 `openTradePlanner` 中開啟/關閉 Modal 的方式全部改為直接操作 `style.display`（`'flex'`/`'none'`），強制覆蓋行內樣式。
- **改善 HUD 資訊顯示**：路線規劃 HUD（右下角提示框）現在會即時顯示已選擇的城市名稱與順序（例如：`1. 石橋村 ➔ 2. 沙漠城市`），而非僅顯示數量，讓玩家更清楚規劃進度。



- **根本原因修復**：`btn-base-trade`（領主書房的「建立商隊」按鈕）在 `main.ts` 中從未被綁定任何事件監聽器，導致點擊後完全沒有反應。
- **新增事件綁定**：在 `main.ts` 補齊 `btn-base-trade` 的 `click` 事件。點擊後將自動關閉所有設施視圖、返回世界地圖，並進入路線規劃模式。
- **重構 `startRoutePlanning`（`MapController.ts`）**：將 `startNode` 參數改為可選。從市場進入（傳入節點）時行為不變；從書房直接建立商隊時（不傳入節點），玩家可在地圖上自由點選最多 3 個城市作為中途站。
- **加入路線防呆驗證**：路線規劃模式中，若玩家點擊「完成規劃」時尚未選擇任何節點，系統會彈出提示要求至少選擇 1 個中途站，避免建立空路線的商隊。


- **擴充傭兵特長**：傭兵的「智慧」與「魅力」屬性現在有了決定性的用途。這兩項屬性將直接換算為商隊的「最大載重量」與「議價加成」，讓非戰鬥系傭兵在商業上大放異彩。
- **多節點路線規劃**：在市場點擊「規劃跑商路線」後，玩家可於世界地圖上連續點擊最多 3 個節點作為中途站，並預先為各站點設定詳盡的買入/賣出預設指令。
- **動態天氣檢定**：跑商途中若遭遇「暴雪」或「沙暴」等惡劣天氣，將進行智慧與幸運檢定。若檢定失敗，將導致商隊延遲抵達下一站（天數懲罰）。
- **預留戰鬥擴充**：為未來即將開發的「統一戰鬥系統」留下了介面，目前的跑商戰鬥暫以純天氣檢定為主。

## [2026-07-17] 修復日誌顯示與陣營探索狀態
- **修復載入存檔時的日誌殘留**：在載入不同存檔時，會自動清空原有的日誌畫面，避免前一個存檔的資訊殘留。
- **優化系統日誌顯示**：移除了「遊戲已儲存」、「背景自動儲存完畢」、「已成功載入」等會頻繁干擾遊戲日誌視窗的系統訊息。
- **己方陣營免偵查**：現在只要是屬於玩家自身陣營的據點（包含主城及其他從屬節點），將不再顯示「未偵查」狀態。

# 開發日誌 (CHANGELOG)

## [2026-07-16] 大陸地圖互動功能實裝：縮放與拖曳
- **滑鼠滾輪縮放**：實作地圖縮放功能，最小縮放率限制為 1 倍，避免畫面縮得過小。
- **節點等比維持**：導入 `--inv-scale` 變數。當地圖放大時，節點圖示與文字會等比例縮小，確保在任何縮放倍率下，標示在螢幕上的實際大小皆保持不變。
- **動態邊界限制**：在拖曳地圖時，系統會自動計算當前縮放倍率下的極限邊界，將拖曳範圍鎖定在視窗內，防止地圖被「拖出桌面」。
- **操作防呆機制**：加入拖曳判斷，當玩家左鍵拖曳移動超過一定範圍時，放開左鍵將不會觸發地圖節點的點擊事件（如建立據點或開啟選單），避免操作衝突。

## [2026-07-16] 核心機制重構：回合制與雙倍經驗池 (Rested EXP)
- **手動推進日期 (回合制)**：全面移除遊戲內的自然流逝計時器。在畫面上方實裝「結束本日」按鈕，並導入日曆系統。所有任務與內政事件現在僅在玩家點擊「結束本日」推進天數後才會進行結算，大幅減輕玩家的決策時間壓力。
- **雙倍經驗池系統**：拔除原有的放置資源生產機制，改為「雙倍經驗池 (Rested EXP)」。離線期間將根據流逝時間累積額外的聲望/經驗加成，待玩家重新上線進行冒險時，將可自動消耗此池塘以獲得等量的雙倍獎勵，解決資源過度膨脹的問題。
- **內政與維護費實裝**：將原有的即時內政系統改為「月底結算」。當經過 30 天時，系統會自動總結該月的稅收淨額，並扣除人口維護費等開支。若赤字過高將提示警告。
- **拔除自動升階與隨機事件限制**：移除了原本金幣與聲望達標後自動升官的行為（為未來的晉升任務鋪路）；並調整事件系統，壓力值將隨天數累積，滿載時自動觸發隨機事件，減少不必要的干擾。
- **主畫面 UI 與邏輯翻新**：將主選單的「開始新旅程」與「載入遊戲」合併為單一的「進入旅程」按鈕。點擊後會顯示三個存檔欄位，若點擊空欄位會詢問是否開始新旅程，點擊已有進度的欄位則會詢問是否進入該旅程，簡化了開局流程。
- **UI 錯誤修復**：修正了返回主選單時，右側面板未正確隱藏的問題。

## [2026-07-16] 專案基礎建設
- **版控系統初始化**：建立 `.gitignore` 並初始化 Git 儲存庫，完成專案第一次提交 (Initial Commit)。
## [2026-07-15] 據點發展系統實裝：篝火勞動力分配機制
- **擴充資源體系**：將原本單一的金幣經濟，擴展為「總人口、糧食、木材、石材、鐵礦與金幣」的多元資源體系。
- **全新「勞動力分配」玩法**：在領主自宅 (`Base`) 實裝了類似《A Dark Room / Bonfire》的分配面板。玩家可將閒置人口自由指派為「農夫」、「伐木工」或「礦工」。
- **生存壓力與飢荒機制**：每日流逝會根據總人口消耗糧食。若糧食耗盡將觸發飢荒，導致人口餓死/流失並重創領主聲望。若糧食充足則有機會吸引流民加入。
- **UI 視覺翻新**：頂部狀態列新增了全新資源的圖示與數據；自宅視圖背景換上了高質感的「領主書房」繪圖，增添經營策略的沉浸感。
## [2026-07-15] 系統架構重構：事件驅動模式 (Event-Driven Architecture)
- **核心架構升級**：建立 `EventBus` 與強型別 `GameEvents`，將遊戲的底層通訊模式從集中式呼叫轉移為「事件驅動 (Pub-Sub)」。
- **介面先行開發 (Interface First)**：為未來的高複雜度功能預先建立空殼系統 (`SettlementSystem`, `HeroSystem`, `CombatSystem`, `ThreatSystem`) 並統一接入事件總線，確保未來的擴充不會導致程式碼耦合。
- **重構現有系統**：解耦 `DispatchSystem` 與 `MapDynamicsSystem`，改以發布 `DAY_PASSED` 和 `COMBAT_FINISHED` 事件來推動遊戲循環。
- **架構文件更新**：全面翻新 `docs/ARCHITECTURE.md` 以反映新的事件驅動設計理念。
## [2026-07-15] 突發事件系統重構與待辦事項實作
- **引入事件壓力值機制**：廢除純隨機觸發事件的機制，改為「事件壓力值」系統。壓力值會隨著遊戲進行、玩家聲望與傭兵數量慢慢累積，滿載時才會觸發事件，大幅減少前期頻繁跳窗的干擾。
- **事件分級與待辦事項 (To-Do List)**：事件區分為「重要」與「普通」。重要事件維持直接跳窗；普通事件則會收納進專屬的「待辦事項」中，玩家可自由決定處理時機。
- **自宅新增待辦事項 UI**：在「自宅」介面中新增了「待辦事項」按鈕，並設有紅色提示標記，讓玩家能清楚掌握領地內累積的日常事務。

## [2026-07-15] 世界觀重製與事件系統實作
- **世界觀與地名重構**：全面翻新地圖節點與派系設定，轉型為「裂境與血脈餘燼」的低魔寫實中古權謀風格。新增了王權家族（埃瑟加德王室）、謀臣家族（培提爾樞密院）與隱世小村落（橡木谷家族）。
- **資料模組化**：將地圖、派系、姓名與事件資料抽離至 `src/data/` 目錄下的獨立檔案，大幅提升未來擴充與修改的便利性。
- **事件系統 (Event System)**：實作了動態突發事件機制，遊戲運行時會定期檢查觸發條件（包含資源、特定勢力存活等），並彈出專屬對話視窗讓玩家進行多分支抉擇，選項會連帶影響資金、人口或家族好感度。
- **寫實姓名生成器**：`NameGenerator` 替換為符合中古歐洲風格的字典庫，傭兵現在會隨機獲得貴族姓氏或特殊稱號（如：疤面、靜默者）。
## [2026-07-15] 視覺優化：地圖節點顯示改進
- **簡化地圖節點外觀**：移除了世界地圖上地點名稱前方的地形小圖示，並將原本面積較大、生硬的純色圓點改為「較小尺寸、半透明背景搭配發光外框」的設計，使整體視覺更乾淨。
- **動態文字縮放**：針對節點文字增加動態互動，預設狀態下文字縮小且稍微半透明以減少畫面干擾，當玩家將游標懸停在節點上時，文字會平滑放大並變為不透明，提升閱讀體驗。

## [2026-07-15] Bug 修復：建築視圖殘留 & 邊緣節點圓形選單被裁切
- **修復返回世界地圖後建築視圖殘留**：`returnToMap()` 現在會強制關閉所有建築視圖（`view-base`, `view-hall`, `view-camp`, `view-forge`），確保不論玩家在哪個建築介面直接按「返回世界」，頁面都能完整清空。
- **修復邊緣節點圓形選單功能遺失**：選單按鈕的展開角度由固定值改為動態計算，會根據節點在地圖上的位置（`node.x`, `node.y`）自動往地圖中央方向展開，避免邊緣節點的選單按鈕被裁切在容器之外。

## [2026-07-15] 派遣系統重構與初期平衡調整
- **實作地圖圓形選單 (Radial Menu)**：大幅優化地圖操作 UX，現在點擊非己方據點時，不再切換至荒野視圖，而是原地展開動態的圓形功能選單（包含探索、討伐、間諜等圖示），並支援 Hover 顯示功能提示。
- **隊伍編制面板 (Dispatch Setup)**：移除了舊有「全體強制出發」的派遣機制，新增了專屬的派遣小隊編制介面，玩家可自由勾選欲派遣的閒置傭兵，並即時預覽隊伍的綜合戰力。
- **動態戰鬥平衡調整**：優化初期遊戲體驗，將討伐任務的最低戰力門檻 (`minPowerRequired`) 由固定值改為依據目標據點的 `NodeLevel` 動態生成。初期荒野的討伐門檻大幅降至約 `30`，確保新手玩家能使用少量傭兵順利通關。
- **無縫整合據點建立**：將原本必須進入荒野視圖才能操作的「建立據點」功能，整合至圓形選單的探索按鈕旁，讓開荒擴張的流程更流暢。
## [2026-07-15] 傭兵系統數據重構與戰鬥升級
- **裝備槽位瘦身**：裝備系統大幅簡化，將原本 7 個欄位縮減至 3 個 (`WEAPON`, `ARMOR`, `ACCESSORY`)，對應更新了資料庫、模型邏輯與 UI 顯示介面。
- **傭兵數據重構**：新增非戰鬥屬性 `charm` (魅力) 與 `command` (統帥)；最高等級上限設定為 Lv.10，升級後改為發放自選的自由屬性點，玩家可至 UI 介面手動配點。
- **退休轉任機制**：實作傭兵退休功能，允許玩家將用不到的傭兵轉入幕後，其身上的裝備會自動卸下退回倉庫，並且根據該角色的魅力給予領地稅收全域微幅加成。
- **戰鬥公式模組化**：徹底重寫了派遣系統的戰鬥結算邏輯 (`completeMission`)，替換了單一的 `totalPower` 比較，改以小隊屬性特化（攻擊、命中、血量）應對不同敵方特徵 (`EnemyFeature`，如高防、高閃、均衡) 的屬性對抗結算，並加入簡易戰報對話框輸出。

## [2026-07-15] 介面與存檔系統修復
- **修正存檔欄位防呆機制**：選擇「新旅程」並點選已有存檔的欄位時，新增二次確認視窗防止誤觸覆蓋。
- **優化地圖引導 UI**：在進入地圖選擇新據點時，加入頂部橫幅「你要從哪裡開始你的旅程？請點擊地圖上的任意節點」，且在選定據點後自動隱藏。
- **修復地圖節點縮放偏移**：將地圖節點容器與背景綁定至固定的 16:9 比例 (透過 CSS `max-width` 與 `max-height`)，解決視窗縮放導致地圖節點與背景錯位的問題。
- **新增返回據點與日誌面板**：在世界地圖右側面板 (`map-info-panel`) 中，加入了即時同步的「近期動態」日誌視窗，並新增了「🏰 返回我的據點」功能鍵。
- **修復開局引導與返回按鈕**：確保開局後引導橫幅正確消失，且「返回我的據點」按鈕能在世界地圖視圖中正確運作。
- **統一右側面板架構**：將世界地圖與據點場景的右側欄位抽離為共用的 `#shared-right-panel` 容器，解決切換視圖時右側面板閃爍消失重現的問題。
- **修復地圖資訊面板滾輪問題**：為世界地圖的右側面板內部容器加入 `min-height: 0;`，修復日誌不斷延伸時無法產生捲軸的 CSS Flexbox 溢位問題。
- **修復傭兵與地圖存檔累積問題**：修正 `initGameState()` 在開啟新遊戲時未清空舊有 `adventurers` 陣列的問題，並對 `mapNodes` 與 `factions` 進行深拷貝 (Deep Clone)，避免前次遊戲狀態污染新遊戲。
- **新增刪除存檔功能**：在載入遊戲與新旅程的存檔選擇介面中，為已儲存的欄位加入專屬的「刪除」按鈕 (`🗑️`)，點擊並二次確認後可直接清空該欄位。
- **優化大地圖顯示比例**：將大陸地圖 (`#map-nodes-container`) 強制綁定 `16:9` 顯示比例，並以 `calc` 配合視窗高度動態限制最大寬度，確保無論視窗如何左右縮放，地圖與對應的節點都不會因為壓縮而產生形變失真。
- **調整右側面板寬度**：依據需求將右側共用資訊面板 (`.empire-dashboard`) 的寬度縮窄約 30%（由 `40%` 調整至 `28%`），為左側街景與地圖讓出更多顯示空間。

## [2026-07-16] �a�ϸ�T���O�P�����g���t�έ��c
- �����a�ϸ`�I���a�B���A�אּ�k���M�θ�T���O�C
- ��@�y�����g���t�Ρz�A�a�ϸ`�I��l�B�󥼰��d���A�C
- �[�J�y�������ԡz�\��A��O 100 �����i����`�I���� (�]�t�M�I���šB�_�ùw���B�n�x�ԤO)�C
- �����㦳 30 �Ѧ��Ĵ��A�O���۰ʭ��m���g�����A�C
- �N�Ҧ������P�Q����O���ܷs���k�����O���C
ECHO �w�ҰʡC
\n## [2026-07-24] 動態魔物強度與浮動數值系統實作\n- **移除靜態數值**：清除 monsters.json 寫死的血量與攻防，改用 powerTier 強度係數。\n- **難度浮動與隨機性**：隨機巢穴生成時，難度將介於 5 到玩家戰力 10% 之間，確保後期仍有機率遇到低難度虐菜局。\n- **種族特性分配**：戰鬥系統會將算出的總戰力依種族特性比例，自動轉換為血量、攻擊、防禦與閃避實體。\n\n## [2026-07-24] 動態巢穴難度算法修正 (Top-N 縮放)\n- **修正總戰力溢出問題**：修復了當閒置傭兵過多時，會導致隨機生成的巢穴難度無上限膨脹，使派遣的 5 人小隊無法通關的設計瑕疵。\n- **最強隊伍戰力對標**：現在生成高難度巢穴時，系統只會抓取玩家陣營中「戰力前 5 名」的冒險者進行加總運算 (	op5Power)，確保最高難度的怪物總戰力約落在玩家最強隊伍的 1.25 倍左右，保持挑戰性但不至於崩壞。\n
## [2026-07-26] 修正據點升降級與繁榮度補底衝突
- **排除玩家據點**：修改 MapDynamicsSystem，在執行升降級檢定與繁榮度補底時排除玩家據點 (!node.isPlayerBase)，解決系統間門檻設定打架導致的繁榮度異常飆升 Bug。

## [2026-08-05] Phase 4 UI Modals Extraction & Revert
### Added/Changed
- 成功將 ModalController.ts 內的各面板獨立拆分至 src/ui/modals/ (包含 DispatchModal, NodeDetailModal, PartyModal, EventModal, EquipModal, TodoModal, PrisonerModal, CombatHistoryModal 等)，並套用 Facade 動態載入模式。
- 修正 NodeDetailModalController 中環狀按鈕的位置計算與顯示問題。
- 修正 EventModalController 中選項按鈕的點擊與隱藏邏輯，避免事件文字顯示不全或無法點擊的問題。
- 更新 docs/ARCHITECTURE.md 以反映最新的 modals/ 結構。

### Reverted
- 原本計畫將 ShopController.ts 中的鐵匠舖與倉庫功能拆分為 ForgeUIController.ts，由於程式碼依賴過深且行數過多，自動化腳本切分失敗導致語法錯誤。目前已透過 Git 還原 ShopController.ts，後續將改採手動拆分與即時編譯驗證的方式進行。

## [2026-08-06] Phase 4 Forge UI Extraction & System Renaming
### Changed
- 透過手動提取方式成功將鐵匠鋪 (Forge) 與倉庫 (Warehouse) 相關的 UI 渲染邏輯從 ShopController.ts 拆分至獨立的 src/ui/components/ForgeUIController.ts。
- ShopController.ts 已加入對應的 Facade 入口進行動態載入。
- 為解決命名衝突，將原 src/systems/SettlementSystem.ts 更名為 TownManagementSystem.ts (負責玩家據點內政)。
- 為解決命名衝突，將原 src/systems/map/SettlementSystem.ts 更名為 MapNodeSystem.ts (負責世界節點模擬)。
- 全面更新 docs/ARCHITECTURE.md，補齊 map/ 與 combat/ 目錄下的新系統及 UI 重構產物，確保與現況 100% 同步。

## [2026-08-06] 討伐敘事引擎與介面優化
### Fixed
- 修復了因 `tsc` 編譯錯誤遺留 `.js` 檔案導致 Vite 載入模組失敗，造成畫面卡死的問題。
- 修復了 `DispatchSystem.ts` 中討伐任務 (COMBAT) 的分流判斷，徹底移除舊版死板的戰報，並將討伐任務成功掛載至 `ExplorationNarrativeEngine.generateSubjugationLog`。現在戰鬥後探險日誌會正確生成純文字小說風格的戰報。
- 修復討伐彈出視窗中的「連續討伐」標籤頁異常顯示問題。

### Changed
- 將【探險日誌】的介面從置中彈出視窗 (Modal) 重構成為從右側滑出的抽屜 (Drawer) 樣式。
- 統一探險日誌的「關閉 (✖)」按鈕樣式與位置至螢幕右上角，優化操作體驗。
- 為了讓探險日誌保持純粹的小說敘事體驗，移除了日誌內的裝備掉落圖示、經驗值提示等遊戲數據，僅保留純文字與【戰鬥紀錄】按鈕。

## [2026-09-04] GEMINI 3.8 FLASH 特效工房專業化重構規格

### Documentation

- 新增 `docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md`，定義時間軸式 VFX Composer、單一播放器、Repository 發布、Impact Cue、CombatActionPlayer、效能預算、Phase 0～7、測試矩陣與完成定義。
- 規格要求 AI 不得採信既有「100% 完成」標記，第一輪只能執行不修改功能的 Phase 0 真實基線稽核。

## [2026-09-04] GEMINI 3.8 FLASH 特效工房驗收修正任務書

### Documentation

- 新增 `docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md`，把第一次實作的驗收失敗項目整理為可分批執行的修正指令。
- 修正範圍涵蓋 DOM 壞版、Inspector 契約、CombatAction 播放、Impact Cue 數值語意、單一播放時鐘、時間軸互動、SSOT 發布／還原與 fixed-seed 隔離。
- 文件明定先執行 Fix 1「DOM + Inspector」，未通過瀏覽器人工驗收前禁止新增 VFX、Shader 或 Preset。
