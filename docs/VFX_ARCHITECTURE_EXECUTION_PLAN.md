# 特效架構與特效工房改善執行計畫

> 狀態：待執行  
> 建立日期：2026-09-07  
> 適用範圍：`src/models/VFX.ts`、`src/tools/vfx-studio/`、`src/ui/fx/`、`src/systems/combat/`、`src/data/vfx_presets.json`、`vite.config.ts`  
> 執行原則：依 Phase 順序進行；每個 Phase 必須通過自己的驗收條件後，才能進入下一階段。

## 1. 目標

將目前可用但仍有資料閉環、確定性、生命週期與並行播放風險的 VFX 系統，整理成可安全用於正式內容製作的架構。

本計畫完成後必須達成：

1. 特效工房畫面中的修改能可靠發布到 `src/data/vfx_presets.json`。
2. 發布、重新載入與歷史快照還原形成可自動驗證的完整閉環。
3. 固定 Seed 能讓相同預設在相同時間點產生一致畫面。
4. 多目標與並行特效不會互相覆蓋或提前清除。
5. 所有 RAF、Timer、DOM Listener、Store Listener 與 Scheduler Listener 都能解除。
6. VFX 資料只有一個正式 Canonical Schema。
7. Client 與 Dev Server 使用同一套驗證規則。
8. 現有戰鬥數值、Cue 對應、技能綁定與 30 款既有預設不得退化。

## 2. 現況基準

執行前基準如下：

- 內建 VFX Preset：30 款。
- Impact Cue：43 個。
- Composite Layer：6 個。
- 找不到目標的 `presetId` 引用：0 個。
- TypeScript typecheck：通過。
- 特效與戰鬥相關測試：10 個測試檔案、85 項測試通過。
- VFX Studio layout：1440×900、1280×720、1024×768、768×900 全部通過。
- 100 次播放 soak test：Canvas 恆為 1、WebGL Context 穩定。

執行任何 Phase 前先記錄工作區狀態：

```powershell
git status --short
npm run typecheck
npm test -- --run src/tools/vfx-studio src/ui/fx src/systems/combat/VFXStudioBaseline.test.ts src/systems/combat/VFXSSOTPublishAndRestore.test.ts src/systems/combat/PlaybackClockAndTimeline.test.ts src/systems/combat/VFXSessionRngAndCleanup.test.ts src/systems/combat/CombatActionAndCueMapping.test.ts
npm run test:vfx
```

## 3. 不可破壞條件

所有階段都必須遵守：

- 不可改變戰鬥傷害、治療、護盾或狀態的實際結算值。
- 不可用視覺 Cue 直接產生不存在的戰鬥傷害。
- WebGL、Shader 或音效失敗時，戰鬥行動仍必須完成。
- 不可讓拖曳播放頭觸發已跳過的戰鬥結算事件。
- 不可新增第二個獨立 RAF 播放時鐘。
- 不可用 `setTimeout` 取代邏輯演出時鐘中的 Cue 排程。
- 不可讓使用者草稿在發布失敗時被標記為已發布。
- 不可覆蓋或還原使用者既有未提交修改。
- 不可直接刪除舊資料欄位；必須先提供 migration 與相容測試。

---

## Phase 0：補齊失敗案例測試

### 目的

先用會失敗的測試固定目前已知問題，避免修復只停留在 UI 表面。

### 任務

- [ ] 新增「修改目前 Preset 後發布」測試。
- [ ] 新增「發布後重新載入仍保留修改」測試。
- [ ] 新增「發布失敗時 Dirty 不可清除」測試。
- [ ] 新增「固定 Seed 重播一致」測試。
- [ ] 新增「兩個 Effect 同時播放不互相清除」測試。
- [ ] 新增「AOE 三目標各自有獨立 Effect Group」測試。
- [ ] 新增「反覆 mount/destroy 不增加 listener、RAF 或 canvas」測試。
- [ ] 新增「Layer 自我引用與循環引用被拒絕」測試。

### 建議測試檔案

- `src/tools/vfx-studio/VFXStudioPublishFlow.test.ts`
- `src/ui/fx/VFXDeterministicPlayback.test.ts`
- `src/ui/fx/VFXConcurrentPlayback.test.ts`
- `src/ui/fx/VFXLifecycle.test.ts`
- `src/ui/fx/VFXPresetGraphValidation.test.ts`

### 驗收條件

- 新增測試能準確重現問題。
- 測試失敗原因必須是預期缺陷，不可因 DOM mock 或測試環境錯誤而失敗。
- 現有測試仍維持全綠。

---

## Phase 1：修復工房發布資料閉環（P0）

### 問題

Inspector 與 Timeline 修改 `VFXStudioStore.currentPreset`，但發布流程使用 `VFXPresetRepository.getAllPresets()`。目前沒有在發布前將草稿寫回 Repository，因此發布可能寫出舊資料。

### 修改範圍

- `src/tools/vfx-studio/VFXLibrary.ts`
- `src/tools/vfx-studio/VFXStudioStore.ts`
- `src/ui/fx/VFXPresetRepository.ts`
- `vite.config.ts`
- Phase 0 的發布流程測試

### 任務

- [ ] 在 Repository 新增明確的 `upsertDraft` 或等價 API。
- [ ] 發布前取得 `store.getPreset()`，執行完整驗證。
- [ ] 驗證成功後，將目前草稿 upsert 到 Repository。
- [ ] 再由 Repository 組裝完整發布 payload。
- [ ] POST 成功後重新 GET `/api/get-vfx-presets`。
- [ ] 比對回讀資料中的目前 Preset 與 Store 草稿是否一致。
- [ ] 只有 POST 成功且回讀比對成功時，才允許 `store.setDirty(false)`。
- [ ] 發布失敗時保留 Dirty、Undo/Redo 與目前草稿。
- [ ] Clipboard fallback 只作為匯出，不可顯示成發布成功。
- [ ] 切換其他 Preset 前若 Dirty，必須提示保存、捨棄或取消；不得靜默遺失草稿。

### 建議交易流程

```text
Store Draft
  → Client Validation
  → Repository Upsert
  → Build Complete Payload
  → Server Validation
  → Atomic Snapshot
  → Atomic SSOT Write
  → Read Back
  → Deep Equality Check
  → Clear Dirty
```

### 驗收條件

- 修改 `colorCore`、一個 Layer、以及一個 Cue 後發布，三項皆出現在 `src/data/vfx_presets.json`。
- 重新整理工房後，畫面顯示發布後資料。
- 模擬 HTTP 400、500 與無法連線時，Dirty 仍為 `true`。
- 發布 payload 沒有重複 ID。
- 原子寫入與最近 20 份快照機制維持有效。

---

## Phase 2：統一驗證與引用圖防護（P1）

### 問題

Client Validator 與 `vite.config.ts` 各自維護驗證規則，容易漂移；目前也沒有阻擋 Layer 自我引用或循環引用。

### 修改範圍

- `src/ui/fx/VFXPresetValidator.ts`
- 新增可供 Node 與 Browser 共用的純資料驗證模組
- `vite.config.ts`
- `src/ui/fx/CombatFXEngine.ts`

### 任務

- [ ] 把驗證規則移到無 DOM、無 Three.js、無 Browser API 的共用模組。
- [ ] Client 與 Vite middleware 都呼叫同一個 Validator。
- [ ] 驗證所有必要欄位與巢狀欄位型別。
- [ ] 驗證 `delay >= 0`、`duration > 0`、fade 範圍合理。
- [ ] 驗證 Cue time 位於 Preset duration 範圍內。
- [ ] 驗證 Cue ID 在單一 Preset 內唯一。
- [ ] 驗證所有 Layer `presetId` 存在。
- [ ] 建立 Preset 引用有向圖並偵測 cycle。
- [ ] 禁止直接自我引用。
- [ ] 對最大引用深度設定明確限制，例如 8 層。
- [ ] Runtime 保留 recursion guard，不能只依賴發布驗證。
- [ ] 驗證 `SPLIT_SINGLE_IMPACT` 的 weight 為有限正數；定義是否必須正規化為 1。

### 驗收條件

- A → A、A → B → A、找不到的 `presetId` 全部被 Client 與 Server 拒絕。
- 合法的多層引用仍可播放。
- Client 與 Server 對同一 payload 產生相同結果。
- Runtime 即使收到繞過 Validator 的循環資料，也能安全停止且不造成無限排程。

---

## Phase 3：完成固定 Seed 與確定性渲染（P1）

### 問題

目前固定 Seed 只存在於 Store UI 狀態；部分 Renderer 與 Engine 仍直接使用 `Math.random()`。

### 修改範圍

- `src/tools/vfx-studio/VFXStudioController.ts`
- `src/tools/vfx-studio/VFXStudioStore.ts`
- `src/ui/fx/VFXPlayer.ts`
- `src/ui/fx/CombatFXEngine.ts`
- `src/ui/fx/renderers/ParticleLayerRenderer.ts`
- `src/ui/fx/renderers/TrailLayerRenderer.ts`
- `src/ui/fx/renderers/MeshLayerRenderer.ts`

### 任務

- [ ] 定義唯一的 seeded RNG 實作與 seed 型別。
- [ ] 固定 Seed 開啟時，從 Preset ID、明確 seed 與 Effect Instance ID 建立 RNG。
- [ ] 關閉固定 Seed 時才允許使用非確定性 seed。
- [ ] 所有 Renderer 必須由參數接收 RNG。
- [ ] 移除播放核心中的直接 `Math.random()`。
- [ ] 確保 seek 到相同時間 `t` 不依賴先前播放歷史。
- [ ] 確保播放、暫停、逐幀與拖曳在相同 seed/time 得到一致狀態。
- [ ] 在 UI 顯示目前 seed，並提供重新擲骰功能。

### 驗收條件

- 相同 Preset、seed、caster、target、time 的粒子位置與幾何參數完全一致。
- 連續播放到 0.5 秒與直接 seek 到 0.5 秒的結果一致。
- 重整頁面後使用相同 seed，驗收截圖差異在允許閾值內。
- 程式碼掃描確認 VFX runtime 與 Renderer 沒有未受控 `Math.random()`。

---

## Phase 4：建立獨立 Effect Instance，支援並行與 AOE（P1）

### 問題

目前 `CombatFXEngine` 共用 `studioPreviewGroup`、Scene 與 Scheduler。多目標 `Promise.all()` 或重疊播放時，一個 Effect 完成可能清除其他 Effect。

### 建議模型

```ts
interface VFXEffectInstance {
  id: string;
  root: THREE.Group;
  startTime: number;
  duration: number;
  updateAt(time: number): void;
  dispose(): void;
}
```

### 任務

- [ ] 每次播放建立獨立 root group。
- [ ] Effect 只可 dispose 自己建立的 Geometry、Material、Texture 與 Group。
- [ ] `clearStudioPreview()` 與正式戰鬥 Effect cleanup 分離。
- [ ] AOE 每個目標建立獨立 Effect Instance。
- [ ] 定義同時播放上限與超額降級策略。
- [ ] 建立 instance registry，提供 active count 與 debug 資訊。
- [ ] `clear()` 必須能取消並清除全部 instance。
- [ ] 單一 instance 完成不可清除其他 instance。
- [ ] Failsafe timer 完成或取消時，必須從 registry/Set 移除。

### 驗收條件

- 三目標 AOE 同時可見，位置各自正確。
- 兩個 duration 不同的 Effect 重疊時，短 Effect 結束不影響長 Effect。
- 連續播放 1,000 個短 Effect 後，active instance、timer 與場景物件回到基準。
- `renderer.info.memory.geometries/textures` 不隨循環無限增加。

---

## Phase 5：完整生命週期與資源管理（P1）

### 修改範圍

- `src/ui/fx/VFXPlayer.ts`
- `src/ui/fx/PlaybackClock.ts`
- `src/tools/vfx-studio/FrameTimelineEngine.ts`
- `src/tools/vfx-studio/VFXTimeline.ts`
- `src/tools/vfx-studio/VFXInspector.ts`
- `src/tools/vfx-studio/VFXLibrary.ts`
- `src/tools/vfx-studio/VFXStudioController.ts`
- Stage Adapters

### 任務

- [ ] 保存 RAF ID，提供 `stopLoop()`。
- [ ] 保存具名 resize handler，destroy 時解除。
- [ ] `PlaybackClock.onTick()` 的 unsubscribe 必須被持有並執行。
- [ ] Store 與 Repository subscription 必須集中保存。
- [ ] 所有 window/document listener 使用可解除的具名函式。
- [ ] 所有 Timer 必須註冊、完成後移除、destroy 時取消。
- [ ] ResizeObserver 必須 disconnect。
- [ ] Canvas 必須從舊容器安全移除後才能 mount 到新容器。
- [ ] 視需求呼叫 `renderer.dispose()` 與 `forceContextLoss()`；若引擎為全域長生命週期，需明確區分 unmount 與 final dispose。
- [ ] 每個主要元件提供冪等 `destroy()`。

### 驗收條件

- mount → destroy 重複 100 次後只有預期的一個 canvas 或零 canvas。
- Listener、Timer、Scheduler task、ResizeObserver 與 RAF 數量不成長。
- destroy 呼叫兩次不拋錯。
- 切換工房、戰鬥演播室與正式戰鬥容器時，canvas 不殘留於舊容器。

---

## Phase 6：收斂 Canonical VFX Schema（P1）

### 決策要求

在開始實作前，必須明確選擇：

1. 以 `VFXSequence` 為正式格式，`VFXPreset` 僅作 legacy import；或
2. 保留 `VFXPreset` 為正式格式，移除尚未落地的 `VFXSequence` 假抽象。

建議選擇方案 1，因為工房 UI 已經具備 Track、Clip、Cue 與 Layer Composer 概念。

### 任務

- [ ] 定義新的 schema version。
- [ ] 移除 `VFXClip.layer?: any`、`curves?: Record<string, any>` 等核心 `any`。
- [ ] 定義每種 Track 的 discriminated union payload。
- [ ] 將 Main Track、Layer、Impact Cue、Screen FX、Audio 都表達為正式 Track/Clip。
- [ ] 完成 Legacy Preset → Sequence migration。
- [ ] 必要時提供 Sequence → Legacy Runtime Adapter，作為過渡層。
- [ ] Repository 儲存 canonical schema，而不是 UI 特有狀態。
- [ ] Solo、Mute、Lock、Selection 不可寫進正式內容資料；它們屬於 Editor Session State。
- [ ] 補 migration snapshot tests。

### 驗收條件

- 30 款既有 Preset 全部能遷移且視覺／Cue 契約不退化。
- 舊存檔與 LocalStorage 資料能自動升級。
- Canonical data 不包含 DOM、Three.js instance 或 Editor-only state。
- Runtime 只有一個正式解析入口。

---

## Phase 7：拆分大型類別與整理依賴方向（P2）

### 目標依賴方向

```text
Models / Schema / Validation
           ↓
Repository / Commands / Evaluators
           ↓
Runtime Player / Effect Instances / Renderers
           ↓
Adapters
           ↓
Studio UI / Combat UI
```

UI 可以依賴核心；核心不可反向依賴工房 DOM。

### 任務

- [ ] 將 `VFXTimeline.ts` 拆成 TimelineView、TimelineInteraction、TimelineCommands、TimelineSelection。
- [ ] 將內嵌 HTML 樣板移出業務邏輯，或至少拆為小型 render functions。
- [ ] 將 `CombatFXEngine` 的特效種類 dispatch 移到 Renderer Registry。
- [ ] 每個 Renderer 只處理一種 track/payload。
- [ ] Controller 只負責 wiring，不直接存取 Engine protected/private state。
- [ ] 效能 HUD 改用公開 metrics API，不再 `(fxEngine as any).scene`。
- [ ] 清除重複註解、死 API 與未使用欄位，例如未接 Scheduler 的 `FrameTimelineEngine.speed`。
- [ ] 對外只由單一 barrel/API surface 匯出穩定介面。

### 建議尺寸目標

- 單一 UI Component：建議不超過 400 行。
- 單一 Renderer：建議不超過 500 行。
- Controller：建議不超過 300 行。
- 超過限制時必須說明其單一職責為何仍成立。

### 驗收條件

- 不再有 1,000 行以上的 Timeline 或 Engine 類別。
- Runtime 核心不直接查詢工房 DOM。
- 效能 HUD、Debug Overlay 與 Editor selection 不污染正式 VFX 資料。
- 現有公開 API 有相容層或完整遷移紀錄。

---

## Phase 8：量產品質與完整驗收（P2）

### 自動測試

```powershell
npm run typecheck
npm test
npm run build
npm run test:vfx
npm run test:smoke
npm run check:bundle
```

### 必要新增情境

- [ ] 編輯 → 發布 → 回讀 → 重整。
- [ ] 發布 HTTP 失敗與驗證失敗。
- [ ] 快照還原 → Repository reload → 工房畫面更新。
- [ ] 固定 Seed 的影像差異測試。
- [ ] 三目標 AOE。
- [ ] 兩個並行 Effect。
- [ ] 暫停超過 failsafe wall time 後恢復。
- [ ] WebGL context loss fallback。
- [ ] 1,000 次短特效 soak。
- [ ] mount/destroy 100 次。
- [ ] 循環引用與最大引用深度。
- [ ] 所有技能與普攻綁定皆指向存在的 VFX ID。

### 手動驗收矩陣

| 項目 | 驗收內容 |
|---|---|
| Timeline | 拖曳、逐幀、播放、暫停、循環、Clip resize、Cue 增刪移動 |
| Inspector | 主軌、Layer、Cue 情境面板正確切換，Undo/Redo 正確 |
| Library | 新增、複製、切換、發布、匯出、快照還原 |
| Determinism | 相同 seed 與 time 畫面一致 |
| Combat | 主遊戲與戰鬥演播室 Cue／傷害呈現一致 |
| AOE | 每個目標都有正確且獨立的特效與受擊回饋 |
| Cleanup | 播放、停止、切頁與關閉後無殘留 |
| Responsive | 1440×900、1280×720、1024×768、768×900 無溢出 |

## 4. 每個 Phase 的提交格式

每完成一個 Phase，更新 `docs/CHANGELOG.md` 與 `docs/HANDOVER.md`，內容必須包含：

1. 實際修改的檔案。
2. 修復前可重現行為。
3. 修復後行為。
4. 新增或修改的測試。
5. 執行過的完整命令及結果。
6. 尚未處理的風險。
7. 是否包含 schema 或存檔 migration。

禁止只寫「已完成」、「已優化」或「測試通過」，必須提供可核對的具體證據。

## 5. 完成定義（Definition of Done）

只有同時滿足以下條件，才能宣告整體改善完成：

- [ ] 工房目前草稿可確實發布並回讀。
- [ ] 發布失敗不會遺失草稿或錯誤清除 Dirty。
- [ ] Client／Server 共用同一 Validator。
- [ ] 引用不存在、自我引用與循環引用都有防護。
- [ ] 固定 Seed 真正控制所有 VFX 隨機來源。
- [ ] 播放與 seek 在相同 seed/time 下具確定性。
- [ ] AOE 與並行 Effect 使用獨立 Instance。
- [ ] 任一 Effect 完成不會清除其他 Effect。
- [ ] RAF、Timer、Listener、Observer 與 GPU 資源都有明確生命週期。
- [ ] Canonical Schema 已確立，Legacy migration 有測試。
- [ ] 30 款既有特效與全部技能綁定沒有退化。
- [ ] 全部自動測試、build、smoke、layout 與 soak 通過。
- [ ] 文件與實際程式碼一致，不再宣稱尚未落地的能力。

## 6. 建議實施順序摘要

```text
Phase 0 失敗案例測試
  ↓
Phase 1 發布閉環
  ↓
Phase 2 共用驗證與引用防護
  ↓
Phase 3 固定 Seed／確定性
  ↓
Phase 4 Effect Instance／並行與 AOE
  ↓
Phase 5 完整生命週期
  ↓
Phase 6 Canonical Schema
  ↓
Phase 7 大型類別拆分
  ↓
Phase 8 量產驗收
```

若只能先執行一項，必須優先完成 **Phase 1：工房發布資料閉環**。在 Phase 1 通過前，不應把「發布成功」視為目前畫面內容已進入專案 SSOT。
