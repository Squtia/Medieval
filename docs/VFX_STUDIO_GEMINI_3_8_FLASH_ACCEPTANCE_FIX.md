# 特效工房驗收失敗修正任務書

> 執行模型：GEMINI 3.8 FLASH（依專案擁有者指定名稱）  
> 建立日期：2026-09-04  
> 文件性質：第一次實作後的阻斷修正指令，不是完成證明  
> 前置規格：`docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md`  
> 驗收結論：目前不通過，禁止進入新增 VFX、Shader 或視覺拋光階段

---

## 0. 直接交給 GEMINI 3.8 FLASH 的主指令

你已執行第一輪特效工房重構，但人工瀏覽器驗收發現版面、Inspector、時間軸、戰鬥播放語意與發布防線仍有阻斷缺陷。你的下一個任務不是擴充新特效，而是完成本文件列出的修正批次，並以可重現證據重新送驗。

開始前必須完整閱讀：

1. `.agents/AGENTS.md`
2. `docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md`
3. `docs/ARCHITECTURE.md`
4. `docs/HANDOVER.md`
5. `docs/CHANGELOG.md`
6. `docs/VFX_COMBAT_PIPELINE_HANDOVER.md`
7. 本文件

執行規則：

1. 先回報每項缺陷的原始碼證據、根因、預計修改檔案與回歸風險，等待使用者確認後才編碼。
2. 僅修復本文件的 P0、P1 阻斷項；不得趁機增加 Shader、粒子種類、Preset 或改造美術風格。
3. 不得以 `npm run check` 全綠取代瀏覽器人工驗收；目前自動測試全綠仍存在肉眼可見的壞版。
4. 不得把測試改成只檢查字串、檔案行數或 mock 自己的演算法。
5. 不得把例外吞掉、用 fallback 掩蓋不存在的 Preset，或用固定 timeout 假裝非同步播放已完成。
6. 不得全域覆寫 `Math.random`。
7. 戰鬥數值只能來自戰鬥結算；VFX Cue 只能決定演出時機與呈現方式。
8. 所有播放、排程、Cue、跳字與 hit-stop 必須共用同一時間基準，且可取消。
9. 若改動資料契約，需提供向後相容轉換、資料驗證與 migration 測試。
10. 每輪最多進行兩次失敗的測試／除錯循環；第三次仍失敗時停止，提出證據與替代方案。
11. 完成後同步更新 `docs/CHANGELOG.md`、`docs/HANDOVER.md`；只有架構真正變更才更新 `docs/ARCHITECTURE.md`。
12. 未滿足本文件全部完成定義前，禁止宣稱「完成」、「100%」、「可發布」或「已驗收」。

每輪固定回報格式：

```text
【本輪範圍】
【修正前證據】
【根因】
【修改檔案】
【實作內容】
【自動驗證】
【瀏覽器人工驗證】
【仍未完成】
【請使用者確認的下一步】
```

---

## 1. 目前已確認可保留的成果

以下項目已具備正向證據，修正時不得倒退：

- `tools/vfx-studio.html` 已由約 3,689 行降至約 752 行。
- 頁面已移除內嵌 Three.js renderer、舊 RAF loop 與主要頁內播放函式。
- 工房只保留正式 runtime 的 `#three-combat-fx-canvas`，沒有第二個 canvas。
- 已建立 `VFXStudioController`、`VFXStudioStore`、`VFXLibrary`、`VFXInspector`、`VFXTimeline` 等模組骨架。
- 已抽出 `src/styles/vfx-studio.css`。
- `VFXStudioAdapter.setTargets()` 已存在，可在目標 DOM 改變後重新綁定。
- 現況 `npm run check` 可通過 typecheck、213 個測試、production build、smoke 與 bundle budget。

這些成果只代表遷移方向部分正確，不代表功能驗收通過。

---

## 2. 驗收失敗摘要

| 優先級 | 缺陷 | 使用者可見影響 | 目前判定 |
|---|---|---|---|
| P0 | 工房 DOM 結構錯置，viewport 高度為 0 | 中央舞台消失、右欄擠入中央、時間軸錯位 | 阻斷 |
| P0 | Inspector ID／控制型別不一致 | 多個欄位顯示 `undefined`，部分控制無效 | 阻斷 |
| P0 | 戰鬥仍逐 event 啟動 VFX | 多段攻擊重播整套 VFX、跳字數量失真、非同步重疊 | 阻斷 |
| P0 | Cue 呈現模式放錯責任層 | 共用 Preset 無法依技能綁定正確呈現傷害 | 阻斷 |
| P0 | 播放速度未控制 timer | 慢動作時畫面、Cue、跳字、清理不同步 | 阻斷 |
| P1 | 時間軸只是靜態列 | 沒有播放頭、seek、拖曳與真正軌道編輯 | 未完成 |
| P1 | 發布 API 缺少伺服器端驗證與還原 | 非法資料可寫入 SSOT，快照不能形成完整復原流程 | 高風險 |
| P1 | 固定 seed 汙染全域 `Math.random` | 預覽期間可能改變其他系統隨機結果 | 高風險 |
| P1 | 舊按鈕與重複入口殘留 | UI 有看似可用但未綁定的控制 | 未完成 |
| P1 | 治療 fallback 指向不存在 Preset | 治療事件可能靜默無 VFX | 功能缺陷 |

---

## 3. 修正批次 A：DOM 與響應式版面

### 3.1 已知證據

- `tools/vfx-studio.html` 的 `.viewport-container`、`#viewport`、`.scene-overlay` 與 `#timeline-mount-point` closing tag 層級錯置。
- 瀏覽器實測 `#viewport` bounding rect：寬約 432px、高度 0px。
- `#timeline-mount-point` 初始寬高為 0，且位於錯誤父層。
- 視窗寬約 692px 時，`body.scrollWidth` 約 956px；CSS 以隱藏 overflow 掩蓋溢出，沒有真正 reflow。
- CSS 使用 `.sidebar-right`，但 HTML 右側面板為 `#inspector-right.inspector-panel`，選擇器契約不一致。

### 3.2 必須修正

1. 修正 HTML closing tag，使頂層工作區明確只有三欄：左資產庫、中央工作區、右 Inspector。
2. 中央工作區內再分成 top toolbar、可伸縮 viewport、底部 timeline。
3. `#timeline-mount-point` 不得嵌在 `#viewport` 或 `.scene-overlay` 中。
4. 統一右側欄 class／ID 契約，CSS 與 TypeScript 只能依同一組 selector。
5. viewport 必須具備可計算的 `min-height` 與 flex shrink/grow 規則，不能依子 canvas 撐高。
6. 窄視窗需真實重排或可控折疊；禁止僅使用 `overflow-x: hidden` 裁掉控制項。
7. ResizeObserver／window resize 後必須更新 renderer 與目標座標，不得留下 0×0 canvas。

### 3.3 瀏覽器驗收

至少在以下 viewport 實測並附截圖與 DOM 尺寸：

| 尺寸 | 驗收要求 |
|---|---|
| 1440×900 | 三欄完整，viewport 與 timeline 均可見 |
| 1280×720 | 不遮擋、不重疊，viewport 高度大於 240px |
| 1024×768 | 側欄可折疊或合理縮排，無不可達控制 |
| 768×900 | 允許改為堆疊／抽屜，但不得水平裁切主要操作 |

每個尺寸都需以程式讀取並回報：

```text
document.documentElement.clientWidth
document.body.scrollWidth
#viewport.getBoundingClientRect()
#timeline-mount-point.getBoundingClientRect()
#inspector-right.getBoundingClientRect()
```

完成門檻：`body.scrollWidth <= clientWidth + 1`，viewport 與 timeline 寬高皆大於 0，面板互不重疊。

---

## 4. 修正批次 B：Inspector 契約與資料正規化

### 4.1 已知證據

目前至少有下列契約錯誤：

| TypeScript 綁定 | HTML 實際 ID／型別 | 問題 |
|---|---|---|
| `param-punch` | `param-punch-scale` | ID 不一致 |
| `param-shake` | `param-shake-intensity` | ID 不一致 |
| `param-spike-material-mode` | `param-spike-mat-mode` | ID 不一致 |
| checkbox：`param-slash-alternating` | `<select>` | 用 `.checked` 讀寫 select |
| checkbox：`param-multihit-impact` | `<select>` | 用 `.checked` 讀寫 select |
| checkbox：`param-spike-erupt-fire` | 必須重新核對實際元素 | 不得假定型別 |

瀏覽器實測至少出現 10 個 `undefined`，包含 slash angle/span/aspect/width/radius/jitter、salvo scatter、glow radius/opacity、spike width。

程式查找 `.card-slash-section`、`.card-spike-section`、`.card-salvo-section`，但 HTML 不存在這些 class，因此情境式欄位顯示邏輯無法生效。

### 4.2 必須修正

1. 建立單一 Inspector control map，明確定義：DOM id、Preset key、控制型別、解析器、formatter、default value、適用 VFX 類型。
2. HTML、CSS 與 TypeScript 必須以 control map 為契約，不得分散硬編碼三套名稱。
3. select boolean 必須以 `value === 'true'` 解析；真正 checkbox 才能使用 `.checked`。
4. 所有 optional 欄位先經 `normalizeVfxPreset()` 或等價邊界正規化，再進 Inspector 與 Player。
5. UI 不得顯示 `undefined`、`null`、`NaN`；缺值應顯示明確預設值或「不適用」。
6. 情境式 section 必須有真實存在的 selector，切換 Preset 後只顯示相關參數。
7. 綁定不存在元素時，開發環境須提供明確警告或驗證錯誤；不得靜默略過所有錯誤。

### 4.3 必要測試

- 驗證 control map 中每個 ID 在 DOM 恰好存在一次。
- 驗證每個控制的元素型別符合 binder。
- 遍歷全部正式 Preset，執行 `syncUI()` 後畫面不得包含 `undefined`／`NaN`。
- 修改每種 input、select、color 後，Store 產生正確型別與 dirty state。
- 切換 slash、spike、salvo 與一般 Preset，Inspector section 顯示符合類型。

---

## 5. 修正批次 C：真正的 CombatAction 播放鏈

### 5.1 已知證據

- `CombatStudio.stepPlayback()` 逐筆取得 `CombatEvent`，呼叫 `applyEventToUi(ev)` 後，以固定 timeout 前進。
- `applyEventToUi()` 觸發 `CombatStudioStageAdapter.playEventAction(ev)`，沒有 await，並以 `.catch(() => {})` 吞掉錯誤。
- 目前沒有真正的 `CombatActionPlayer` 負責一次技能行動。
- SKILL_CAST、HIT、CRIT 等事件可能各自重播完整 VFX；前一段尚未結束，下一事件已開始。
- 播放結束、Skip 或 clear 可能中途清掉仍在播放的效果。

### 5.2 正確責任與資料流

```text
CombatReport events
  → CombatActionGrouper（依 actionId／明確邊界分組）
  → CombatActionPlayer.play(action)
       ├─ 取得 SkillVfxBinding
       ├─ 取得已解析 VFXPreset
       ├─ 配對 action.impacts 與 preset.impactCues
       ├─ VFXPlayer 播放一次
       ├─ StageAdapter 依 Cue 呈現既有結算值
       └─ 回傳可 await、可取消的播放結果
  → 下一個 CombatAction
```

### 5.3 必須修正

1. 先定義或確認 `CombatAction` 的穩定邊界，不得依 UI event index 猜測。
2. 一個技能行動只能啟動一次 Preset 播放；多個 Cue 是同一次播放內的時間點。
3. `CombatActionPlayer.play()` 必須回傳 Promise；上層需 await 完成或明確採用可管理 scheduler。
4. 禁止 `.catch(() => {})`；錯誤需送到可觀察的錯誤狀態、日誌或 UI。
5. pause、resume、speed、skip、close、replay 都需由 action player 統一協調。
6. 取消後所有 timer、cue callback、浮字與畫面反饋都不得在新一輪播放中復活。
7. 無 VFX 或載入失敗時，戰鬥 UI 仍須依原始結算結果前進，但需留下可診斷警告。

### 5.4 必要測試

- 一個 SKILL_CAST + 三個 HIT event 組成一個 action，只呼叫一次 `VFXPlayer.play()`。
- 三個 Cue 各消費一個已結算 impact，順序與 cueId 正確。
- pause 後播放頭、Cue、跳字與下一 action 全部停止。
- speed 0.3× 與 2× 時，播放順序與傷害總值不變。
- skip／close 後 advance 不重入、callback 不殘留。
- Player reject 時錯誤可見，戰鬥流程依定義降級，不產生 unhandled rejection。

---

## 6. 修正批次 D：Impact Cue 與傷害呈現語意

### 6.1 已知證據

- `impactPresentationMode` 現在放在 `VFXPreset`。
- 30 個 Preset 全部被設為 `EXACT_IMPACTS`，沒有反映技能結算差異。
- `VFX_EARTH_SPIKE` 有三個 cue，權重 0.25／0.25／0.5，卻標成 EXACT，語意互相矛盾。
- `VFX_PHANTOM_SLASH` 有三個 cue；在逐 event 播放架構下可能形成三個事件乘三個 cue 的九次跳字。
- `CombatStudioStageAdapter.spawnFloatingNumber()` 仍以 cue weight 或 impactCount 重新乘除 event damage。

### 6.2 正確模型

- `VFXPreset` 描述視覺時間軸與 cue 名稱，不決定某個技能要如何拆分戰鬥數值。
- `SkillVfxBinding` 描述技能如何使用 Preset，包含 `impactPresentationMode` 與 cue-to-impact mapping。
- `CombatImpact` 保存戰鬥系統已結算的 amount、critical、targetId、element、status 等結果。
- StageAdapter 只能顯示已配對的 amount，不得重新計算戰鬥結果。

### 6.3 三種模式

#### EXACT_IMPACTS

- N 個真實 `CombatImpact` 對應 N 個可呈現 Cue。
- 每個跳字直接使用對應 impact.amount。
- cue weight 不得修改傷害。

#### SPLIT_SINGLE_IMPACT

- 戰鬥只有一個已結算 impact，演出上拆成多個跳字。
- 使用整數安全分配；所有片段加總必須精確等於原始 amount。
- 餘數需有確定性分配規則，負數治療／吸收等符號不可錯誤。
- 這只是顯示拆分，血量結算仍只套用一次。

#### PRIMARY_ONLY

- 可有多個視覺 cue，但只在 primary cue 顯示完整已結算 amount。
- 其他 cue 只能做無數值的視覺反饋。

### 6.4 必須修正

1. 將 mode 移至 `SkillVfxBinding` 或等價的消費端 binding；Preset 不再硬編碼所有技能的呈現語意。
2. 建立純函式 `mapImpactsToCues()` 或等價模組，Player 與 UI 共用，禁止各端自行猜測。
3. StageAdapter 接收已完成 mapping 的 presentation item，不再做 `damage * weight` 或 `damage / count`。
4. 對舊資料提供明確 migration default；不得把所有資料一律補成 EXACT。
5. 治療、護盾、miss、狀態、AOE、多目標各自有明確規則。

### 6.5 不變量測試

- 任一模式都不得改變戰鬥系統已結算的 HP 最終值。
- SPLIT 的所有顯示片段整數加總精確等於來源 amount。
- EXACT 的每個顯示值逐一等於來源 impact.amount。
- PRIMARY_ONLY 恰好一個數值呈現。
- 多目標 mapping 不得把 A 目標的 impact 顯示到 B 目標。
- 相同 seed／相同輸入得到相同 cue mapping。

---

## 7. 修正批次 E：單一時鐘、播放速度與取消

### 7.1 已知證據

- `CombatFXEngine.setPlaybackSpeed()` 只縮放 animation delta。
- Cue、layer、failsafe 等 `registerTimer()` 仍依真實時間排程。
- 因此慢動作下動畫會變慢，但 Cue、跳字、清理與完成 callback 仍按原時間觸發。

### 7.2 必須修正

1. 建立單一 playback clock／scheduler，動畫進度、Cue、layer、hit-stop、完成與清理都讀取同一 logical time。
2. speed 只改 logical time 的推進比例，禁止同時散落 `delay / speed` 與 delta scaling 兩套機制。
3. pause 時 logical time 不前進，所有 cue 均不得觸發。
4. resume 後從原 logical position 繼續，不得補觸發重複 cue。
5. abort signal／playback token 必須貫穿 Player、Engine、StageAdapter。
6. failsafe 可使用 wall clock，但需明確與演出排程分離，並在正常完成／取消時清除。

### 7.3 必要測試

- 0.3×、1×、2× 下，Cue 皆在相同 normalized progress 觸發。
- pause 500ms 後沒有任何新 cue、跳字或完成事件。
- seek 跨過 cue 時依產品規則只觸發一次或不觸發，行為必須明確且有測試。
- abort 後 scheduler pending count 為 0。
- 連續快速播放 20 次，只允許最後一個 session 產生 callback。

---

## 8. 修正批次 F：時間軸必須具備真實編輯能力

### 8.1 已知證據

- `VFXTimeline` constructor 只 subscribe，未對 `store.getPreset()` 進行初始 render，因此首次進入可能空白。
- 目前畫面主要是固定列、Cue 新增／刪除與 mode select。
- 沒有播放頭、seek、拖曳、縮放、clip／track model 或可驗證的時間編輯操作。

### 8.2 本輪最小可接受範圍

1. constructor 完成後立即 render 當前 Preset。
2. 顯示時間刻度、播放頭與目前秒數。
3. 點擊 ruler 可 seek；播放時 playhead 由共用 clock 驅動。
4. Cue marker 可拖曳並更新 Store，限制在 0～duration。
5. 拖曳是一筆 undo transaction，不得 mousemove 每次都建立 undo entry。
6. layer／cue 的 mute 只影響預覽，不得污染正式 Preset，除非使用者明確保存。
7. dirty state、undo、redo 與切換 Preset 的未儲存提示要能實際工作。

本輪可先不做曲線編輯器與完整 clip resize，但不得把靜態列稱為「專業時間軸完成」。

---

## 9. 修正批次 G：發布、驗證、快照與復原

### 9.1 已知證據

- `/__vfx_api/save_ssot` 目前只確認 payload 是陣列，就建立快照並覆寫 `src/data/vfx_presets.json`。
- 伺服器端沒有在寫檔前呼叫完整 validator。
- 有 list／snapshot，但沒有形成可用的 restore endpoint／流程。
- schema 仍處於 v2，與原規格預期的資料契約未完全對齊。

### 9.2 必須修正

1. Client validation 只負責即時回饋；Server validation 才是寫入 SSOT 前的最終防線。
2. Server 必須驗證 schema version、唯一 ID、必要欄位、數值範圍、cueId 唯一、cue time 範圍、合法 binding reference。
3. 驗證失敗回傳結構化 4xx 錯誤，不建立新 SSOT，也不覆蓋舊檔。
4. 寫入順序：驗證成功 → 建立可辨識快照 → atomic write → 回傳 hash／版本／筆數。
5. 提供 restore：列出快照、預覽 metadata、指定快照、再次驗證、建立 restore 前快照、atomic restore。
6. 限制 endpoint 只能在開發伺服器使用，並驗證路徑不得逃逸預定目錄。
7. 為新 schema 提供顯式 migration；載入舊 schema 不得靜默遺失欄位。

### 9.3 必要測試

- 重複 ID、非法 cue time、未知 binding、NaN／Infinity、錯誤 schema 均拒絕寫入。
- 驗證失敗前後 SSOT hash 完全相同。
- 正常發布後 snapshot 存在且可 restore。
- restore 後內容 hash 等於選定 snapshot，restore 前版本仍可復原。
- 非開發環境 endpoint 不可用。

---

## 10. 修正批次 H：其他高風險缺陷

### 10.1 固定 seed

禁止在 async 播放期間覆寫全域 `Math.random`。改為注入 session-scoped RNG：

```text
VFXPlaybackOptions.rng 或 seed
  → VFXPlayer session
  → Engine／emitter／trajectory helper
```

驗證：固定 seed 的兩次預覽輸出一致；同時執行的其他系統 `Math.random` 不受影響；取消或例外不需依賴 restore global。

### 10.2 重複與失效按鈕

盤點並移除或正式綁定舊的：

- `btn-save-project`
- `btn-publish-ssot`
- `btn-save`
- `btn-export-all`
- `btn-reset-defaults`

頁面只能保留一套清楚的草稿儲存、匯出、發布、還原入口。每個可見按鈕必須有實際 handler、disabled 狀態與錯誤回饋。

### 10.3 不存在的治療 Preset

`CombatStudioStageAdapter.resolveVfxId()` 指向 `VFX_HEALING_LIGHT`，但正式資料中沒有該 ID。必須選擇並明確實作其一：

- 新增經審核的正式治療 Preset；或
- 綁定到現有且語意正確的治療 Preset；或
- 治療事件在無 binding 時顯示明確診斷並採無 VFX 降級。

禁止回傳不存在 ID 後再靜默 fallback。

---

## 11. 測試改造要求

現有新增測試多數只能證明「字串存在」、「行數下降」或「mock 被呼叫」，無法攔截此次實際壞版。必須補足：

### 11.1 DOM 契約測試

- 驗證工作區父子結構，不只找得到 ID。
- 驗證 control map 與真實元素一一對應。
- 驗證初始化後 timeline 有內容、viewport 非 0 尺寸。

### 11.2 瀏覽器互動測試

- 開啟工房、切換至少四類 Preset、修改參數、播放、seek、拖 cue、undo／redo。
- 查找頁面文字不得含 `undefined`、`NaN`。
- 監測 console error、unhandled rejection 與重複 canvas。
- 覆蓋 1440、1280、1024、768 寬度。

### 11.3 行動播放整合測試

- 使用接近真實 `CombatReport` 的資料，不在 mock 中重寫分組或 mapping 演算法。
- 斷言每 action 的 play 次數、cue 次數、target、amount、順序、取消與錯誤路徑。
- 分別涵蓋單擊、多段、拆分演出、AOE、治療、miss、爆擊。

### 11.4 發布整合測試

- 使用暫存 SSOT 路徑，驗證拒寫、atomic write、snapshot、restore。
- 禁止測試直接修改正式 `src/data/vfx_presets.json`。

---

## 12. 執行順序與提交邊界

不可把所有項目混成一次大型修改。建議依下列順序逐批送驗：

1. **Fix 1：DOM + Inspector**  
   先讓工房可見、可操作、無 `undefined`，補 DOM 契約與瀏覽器測試。
2. **Fix 2：Clock + Timeline**  
   建立單一 logical clock、初始 render、playhead、seek、cue drag、取消。
3. **Fix 3：CombatAction + Cue mapping**  
   一個 action 播一次 VFX，binding 擁有 presentation mode，數值不重算。
4. **Fix 4：Publish + Restore**  
   補伺服器驗證、atomic write、快照復原與 migration。
5. **Fix 5：清理與完整回歸**  
   移除失效入口、修正治療 fallback、固定 seed 注入、三端人工驗收。

每批修改前先列出精確檔案；每批需可獨立 typecheck、test、build、瀏覽器驗收與回退。

---

## 13. 最終完成定義

只有以下全部成立才可重新送驗：

- [ ] 工房在四種指定 viewport 無重疊、主要控制無水平裁切。
- [ ] `#viewport` 與 timeline 初始尺寸皆非 0。
- [ ] 頁面文字沒有 `undefined`、`NaN`、`null` 洩漏。
- [ ] Inspector 所有可見控制都能正確讀寫 Store。
- [ ] 情境式 Inspector 只顯示相關參數。
- [ ] 時間軸初始即顯示，具播放頭、seek、cue drag、undo／redo。
- [ ] 播放速度與 pause 同步控制動畫、Cue、跳字與完成時機。
- [ ] replay、skip、close、切換 Preset 後沒有殘留 callback。
- [ ] 一個 CombatAction 只啟動一次 VFX 播放。
- [ ] `impactPresentationMode` 由 binding／消費端擁有，不由共用 Preset 強制。
- [ ] EXACT、SPLIT、PRIMARY 三模式符合數值不變量。
- [ ] StageAdapter 不重新計算戰鬥數值。
- [ ] 沒有全域覆寫 `Math.random`。
- [ ] 發布前有伺服器端驗證，失敗不改 SSOT。
- [ ] 快照可實際還原，restore 前後皆可追蹤。
- [ ] 所有可見儲存／發布／匯出按鈕皆有效且不重複。
- [ ] 治療不再解析到不存在的 Preset。
- [ ] `npm run check` 通過。
- [ ] 瀏覽器 console 無 error、無 unhandled rejection、只有一個 canvas。
- [ ] 附上四種尺寸截圖、關鍵 DOM 尺寸、測試摘要與未完成清單。

---

## 14. 禁止的假完成

以下任一做法都不算完成：

- 只補 closing tag，卻不驗證四種 viewport 與 scrollWidth。
- 只以 `|| 0` 隱藏 `undefined`，卻不修正 Inspector ID／型別契約。
- 每個 event 繼續播放完整 VFX，只把 timeout 調大避免重疊。
- 把 `.catch(() => {})` 換成 console.log，仍沒有錯誤狀態與降級契約。
- 所有 Preset 或 binding 一律標成 EXACT。
- StageAdapter 繼續以 weight 重算 damage，再用測試配合錯誤結果。
- 只縮放 animation delta 或只做 `timeout / speed`，仍保留雙時鐘。
- 畫出靜態時間軸背景，就宣稱支援 seek、拖曳或 clip 編輯。
- client validator 通過就直接寫 SSOT，server 不再驗證。
- 只建立快照檔案，沒有可驗證的 restore 流程。
- 用全域 `Math.random` monkey patch 實作 fixed seed。
- 新增 facade／adapter 名稱，但核心仍走舊 event 播放鏈。
- 測試只搜尋原始碼字串、class 名稱或行數。
- 自動測試全綠但未開瀏覽器檢查實際 layout 與互動。

---

## 15. 第一輪修正啟動訊息

將以下內容連同本文件交給 GEMINI 3.8 FLASH：

```text
請先完整閱讀 .agents/AGENTS.md、原始重構規格與
docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md。

本輪只能處理 Fix 1：DOM + Inspector，不得新增特效、Shader、Preset，
也不得提前修改 CombatAction、Cue schema 或發布 API。

請先不要寫程式。先回報：
1. DOM closing tag 的實際父子結構與根因；
2. 所有 Inspector ID／元素型別／Preset key mismatch 清單；
3. 預計修改的精確檔案；
4. 四種 viewport 的驗收方式；
5. 會新增或改造哪些 DOM 與瀏覽器測試；
6. 明確排除範圍與回退方式。

等待使用者確認後才開始修正。完成宣告必須附瀏覽器截圖、DOM 尺寸、
console 狀態、測試結果與仍未完成項目；npm run check 全綠本身不算驗收完成。
```
