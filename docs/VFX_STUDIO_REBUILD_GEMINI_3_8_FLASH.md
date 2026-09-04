# 特效工房專業化重構製作規格

> 執行模型：GEMINI 3.8 FLASH（依專案擁有者指定名稱）  
> 建立日期：2026-09-04  
> 狀態：待實作；本文件不是完成證明  
> 路線：P0 單一播放管線 → P1 專業創作流程 → P2 實戰發布與品質管理

---

## 0. 給 GEMINI 3.8 FLASH 的主指令

你的任務不是在既有頁面繼續增加滑桿，而是把拼裝式特效原型逐步重構成可維護、可預覽、可發布、可由戰鬥可靠消費的「時間軸式 VFX Composer」。

執行規則：

1. 完整閱讀 `.agents/AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/HANDOVER.md`、`docs/CHANGELOG.md`、`docs/VFX_COMBAT_PIPELINE_HANDOVER.md` 與本文件。
2. 不得把舊文件的 `[x]`、`100% 完成` 或「已驗收」視為事實；以原始碼、瀏覽器行為與 production 測試為準。
3. 每次只做一個 Phase。修改前列出目標、檔案、排除範圍、風險和驗收方式，等待使用者確認。
4. 不得整份覆蓋 `tools/vfx-studio.html`，不得破壞使用者現有修改。
5. UI、註解、文件與錯誤訊息使用繁體中文；程式識別字使用英文。
6. 戰鬥數值不得依賴動畫幀、播放速度、WebGL 或 `setTimeout`。
7. VFX 只決定演出時間與樣式；傷害、治療、護盾、狀態、命中、爆擊只來自戰鬥結算。
8. 所有非同步播放必須可取消。關閉、Skip、切換 Preset 或重播後不得殘留 callback。
9. 每階段完成後更新 `CHANGELOG.md`、`HANDOVER.md`；架構真的落地後才更新 `ARCHITECTURE.md`。
10. 測試或除錯最多失敗兩輪；第三次仍失敗時停止並回報證據與替代方案。
11. 不得用新增 Facade、mock 內重寫算法、註解、完成勾選或文件敘述冒充功能完成。
12. 每項完成宣告必須附可重現證據。

每輪固定回報：

```text
【本輪目標】
【現況證據】
【修改檔案】
【實作內容】
【驗證結果】
【尚未完成】
【請使用者確認的下一步】
```

---

## 1. 最終目標

```text
選擇／建立特效
 → 選擇實戰情境
 → 新增圖層與軌道
 → 編排前搖、發射、命中、殘留
 → 建立具名 Impact Cue
 → 預覽單體、AOE、治療、護盾、攻城
 → 執行資料與效能驗證
 → 綁定技能
 → 發布至專案 SSOT
 → 戰鬥工房與主遊戲同源驗收
```

創作者不需要理解 Three.js 內部函式，也不需要複製 JSON 手動覆蓋專案檔案。

---

## 2. 目前基線

以下是 2026-09-04 盤點，實作前必須重新核對：

- `src/data/vfx_presets.json` 有 29 筆唯一 ID Preset。
- `tools/vfx-studio.html` 約 3,689 行，混合 HTML、CSS、狀態、儲存、綁定、renderer、材質、動畫與排程。
- `src/ui/fx/CombatFXEngine.ts` 約 2,170 行，承擔過多責任。
- `src/ui/fx/VFXPlayer.ts` 主要是 8 行 re-export Facade，不是獨立播放器。
- 工房同時存在舊 `#three-canvas` 與正式 runtime 的 `#three-combat-fx-canvas`。
- `btn-play` 仍呼叫頁內 `playCurrentEffect()`，工房仍有 `new THREE.WebGLRenderer`、自己的 RAF loop 與數十個播放函式。
- 頁內大量直接使用 `setTimeout`，不能保證切換或清除時全部取消。
- 多目標模式重建 DOM；Adapter 若保存舊目標引用會失效。
- 保存／同步走 Repository，但新增、複製、刪除仍有直接寫 `MEDIEVAL_CUSTOM_VFX_PRESETS` 的路徑，v1 陣列與 v2 schema 混用。
- 正式發布仍依賴複製 JSON、人工覆蓋 `src/data/vfx_presets.json`。
- `VFXImpactCue` 已有型別，但未形成完整 Preset 欄位、Repository 持久化、runtime 排程與戰鬥消費鏈。
- `CombatUIManager` 仍以 `hitIdx`／事件順序近似配對，不是依 `cueId` 消費 `CombatImpact`。
- `CombatStudio.applyEventToUi()` 主要更新日誌、血條與 CSS 抖動，尚未真正用正式 Action Player 播放 VFX。
- 介面同時顯示大量不相關參數，缺少時間軸、播放頭、關鍵幀、Undo／Redo、dirty state、效能預算及固定 seed。
- 窄於約 1,130px 時可能產生水平溢出和側欄裁切。

---

## 3. 不可破壞的設計原則

### 3.1 單一真相來源

- 正式 Preset：`src/data/vfx_presets.json`。
- 草稿、override、自訂項目由 Repository 管理。
- 技能綁定使用獨立 `SkillVfxBinding`，不混入可共用 Preset。
- runtime、工房、戰鬥工房只能透過 Repository 取得解析後資料。

### 3.2 單一播放管線

```text
VFX Composer UI → VFXStudioController → VFXPlayer ← Repository
                                      ├─ StudioStageAdapter
                                      ├─ CombatStageAdapter
                                      └─ CombatStudioStageAdapter
```

全專案只允許一個 renderer、scene、camera、animation loop 與 scheduler。HTML 不得建立 renderer、材質工廠、幾何生成器或動畫排程。

### 3.3 責任分離

```text
CombatSystem：計算結果
CombatActionPlayer：配對 CombatImpact 與 Cue
VFXPlayer：播放圖像、音效、畫面反饋
StageAdapter：DOM 座標、跳字、血條、卡片反應
```

### 3.4 漸進遷移

- 先建立等價回歸測試，再刪除舊播放器。
- 保留 29 個 Preset 的相容轉換。
- 不可一次同時重做 UI、schema、renderer 與戰鬥契約。
- 每個 Phase 必須能獨立 build、test、人工驗收與回退。

---

## 4. 目標介面

```text
┌────────────────────────────────────────────────────────────────────┐
│ 特效工房 │ 名稱／ID │ 草稿狀態 │ Undo Redo │ 驗證 │ 發布       │
├──────────────┬─────────────────────────────┬─────────────────────┤
│ 特效資產庫   │          實戰舞台           │ Inspector           │
│ 搜尋／分類   │ 單體／AOE／治療／攻城       │ 只顯示選取物件參數  │
│ 草稿／正式版 │ 背景／輔助線／固定 Seed     │ 基礎／進階          │
├──────────────┴─────────────────────────────┴─────────────────────┤
│ 播放控制 │ Windup │ Projectile │ Impact │ Screen FX │ Audio   │
│          │        │            │ cue_1  │           │         │
└────────────────────────────────────────────────────────────────────┘
```

### 頂部工具列

- 名稱、ID、已儲存／未儲存／驗證失敗狀態。
- Undo、Redo、驗證、發布。
- 技能選單不得干擾創作主流程。

### 左側資產庫

- 搜尋、Category、用途、狀態篩選。
- 正式、草稿、override、custom 標記。
- 顯示技能引用關係。
- 內建 Preset 只能 override 或還原，不能假裝永久刪除。

### 中央舞台

- 單體、前排 3 人、全體 6 人、友軍治療、自身 Buff、護盾、攻城門。
- 黑底、棋盤格、實戰背景。
- 0.25x、0.5x、1x、2x。
- 固定 seed、重新擲骰、軌跡／中心／安全區輔助線。

### 情境式 Inspector

- Slash 只顯示刀芒、弧度、角度、寬度。
- Projectile 只顯示彈道、弧高、速度、拖尾。
- Burst 只顯示粒子、散佈、生命週期、重力。
- Shield 只顯示形狀、尺寸、旋轉、淡入淡出。
- Cue 顯示 ID、時間、類型、權重、Primary、Target Policy。
- Shader 專家參數收在進階區；數值同時提供 slider 與精確輸入。

### 底部時間軸

- 播放頭、時間刻度、縮放。
- Track 新增、刪除、排序、Mute、Solo、Lock。
- Clip 拖曳時間、改長度、複製。
- Cue 具名、可拖曳、可設 Primary 與 weight。

### 響應式要求

- 建議 1440×900；最低 1024×720。
- 小於 1180px，Inspector 變可收合抽屜。
- 小於 900px，資產庫與 Inspector 不同時常駐。
- body 不得水平捲動；時間軸可在自身區域水平捲動。

---

## 5. 目標資料契約

```ts
export type VFXTrackType =
  | 'MESH' | 'PARTICLE' | 'TRAIL' | 'DECAL'
  | 'LIGHT' | 'IMPACT' | 'SCREEN_FX' | 'AUDIO' | 'CUE';

export interface VFXSequence {
  schemaVersion: number;
  id: string;
  name: string;
  category: 'PHYSICAL' | 'ELEMENTAL' | 'HOLY_DARK' | 'SPECIAL';
  description: string;
  duration: number;
  randomSeed: number;
  tags: string[];
  tracks: VFXTrack[];
  impactCues: VFXImpactCue[];
  quality: VFXQualityProfile;
  metadata: VFXMetadata;
}

export interface VFXTrack {
  id: string;
  name: string;
  type: VFXTrackType;
  enabled: boolean;
  locked?: boolean;
  clips: VFXClip[];
}

export interface VFXClip {
  id: string;
  startTime: number;
  duration: number;
  layer: VFXLayerDefinition;
  curves?: Record<string, VFXCurve>;
}

export interface VFXImpactCue {
  cueId: string;
  time: number;
  kind: 'IMPACT' | 'HEAL' | 'SHIELD' | 'STATUS' | 'VISUAL_ONLY';
  weight?: number;
  isPrimary?: boolean;
  targetPolicy?: 'PRIMARY_TARGET' | 'EACH_TARGET' | 'CASTER';
}

export interface VFXQualityProfile {
  maxParticles: number;
  maxDrawCalls: number;
  maxConcurrentObjects: number;
  allowScreenShake: boolean;
  allowBloom: boolean;
}
```

技能綁定：

```ts
export interface SkillVfxBinding {
  skillId: string;
  vfxId: string;
  impactPresentationMode:
    | 'EXACT_IMPACTS'
    | 'SPLIT_SINGLE_IMPACT'
    | 'PRIMARY_ONLY';
  cueMap?: Record<string, string>;
}
```

正式 key 必須是穩定 `skillId`；中文名稱只供顯示或舊資料 migration。

舊 Preset 必須經純函式轉換：

```ts
migrateLegacyPreset(preset: LegacyVFXPreset): VFXSequence
```

必要遷移規則：

- `duration` → 主 Clip duration。
- `salvoCount` → 重複演出，不直接代表真實傷害次數。
- `hitCount` → 建立 legacy cue 並產生 migration warning。
- `layers[]` → Track／Clip。
- `generatesHit` → 演出 cue，不得建立戰鬥傷害。
- `GROUND_ERUPTION` → `GROUND_BURST`。
- 未知欄位寫入 migration report，禁止靜默遺失。

---

## 6. 目標模組

```text
src/ui/fx/
├─ VFXPlayer.ts
├─ VFXScheduler.ts
├─ VFXPresetRepository.ts
├─ VFXPresetValidator.ts
├─ VFXLegacyMigration.ts
├─ CombatActionPlayer.ts
├─ adapters/
│  ├─ StudioStageAdapter.ts
│  ├─ CombatStageAdapter.ts
│  └─ CombatStudioStageAdapter.ts
└─ renderers/
   ├─ MeshLayerRenderer.ts
   ├─ ParticleLayerRenderer.ts
   ├─ TrailLayerRenderer.ts
   ├─ ImpactLayerRenderer.ts
   ├─ ScreenFxRenderer.ts
   └─ AudioLayerRenderer.ts

src/tools/vfx-studio/
├─ VFXStudioController.ts
├─ VFXStudioStore.ts
├─ VFXTimeline.ts
├─ VFXInspector.ts
├─ VFXLibrary.ts
├─ VFXStage.ts
├─ VFXCommandHistory.ts
└─ VFXPublishService.ts
```

責任與限制：

- `VFXPlayer` 播放 sequence，不查 DOM、不改戰鬥數值。
- `VFXScheduler` 管理播放頭、速度、pause、seek、cancel、generation。
- Layer Renderer 只渲染一種圖層。
- `CombatActionPlayer` 配對 CombatImpact 與 Cue。
- Adapter 管理座標、跳字、血條及卡片反應。
- Store 管理 immutable edit state、selection、dirty flag。
- Command History 管理 Undo／Redo。
- Publish Service 管理驗證、快照、atomic publish。
- renderer 不讀 LocalStorage；Repository 不 import DOM；CombatSystem 不 import Three.js。

---

## 7. 草稿與發布

狀態分層：`builtIn → override/custom draft → validated → published → snapshot`。

仿照其他工房，在 `vite.config.ts` 建立限定 DEV 的 API：

- `GET /api/get-vfx-presets`
- `POST /api/validate-vfx-presets`
- `POST /api/save-vfx-presets`
- `GET /api/list-vfx-backups`
- `POST /api/restore-vfx-backup`

安全規則：固定檔案白名單、`path.resolve`、atomic write、發布前驗證與快照、最多保留 20 份；production 不提供寫檔 API。

使用者流程：

- 儲存草稿：LocalStorage v3，不影響正式遊戲。
- 驗證：schema、引用、cue、效能、戰鬥契約。
- 發布：驗證成功後才寫入 SSOT。
- 還原草稿：只還原目前 Preset。
- 還原出廠：獨立危險操作，不順便清除所有技能綁定。

---

## 8. Cue 與戰鬥規則

### EXACT_IMPACTS

- N 筆真實 impact 對應 N 個具名 cue。
- 保留各自 target、amount、crit、HP snapshot。
- cue 不足時驗證失敗；runtime 只能使用明確 fallback 並警告。
- 多出的 cue 是純視覺。

### SPLIT_SINGLE_IMPACT

- 戰鬥只結算一次。
- cue 只切割跳字與血條過場。
- slice 整數總和必須等於原始 amount。
- 不可重觸吸血、反擊、狀態、死亡或被動。

### PRIMARY_ONLY

- 所有 cue 可有視覺反饋。
- 只有 `isPrimary=true` 顯示完整結果。
- 缺少 Primary 時使用最後一個 impact cue，並產生驗證警告。

### AOE／非傷害

- AOE 先依 `targetId` 分組，不跨目標加總。
- Heal 使用恢復樣式，不套負向擊退。
- Shield 操作護盾 UI，不假裝扣 HP。
- Status 顯示狀態，不虛構 damage。
- Miss 可播放落空，但不播放命中 flash、不扣血。

---

## 9. 專業能力範圍

第一版必須有：圖層、時間軸、播放頭、具名 Cue、Mesh／Particle／Trail／Impact／Screen FX、固定 seed、Undo／Redo、多情境預覽、草稿／驗證／發布／快照、效能 HUD。

第二版才做：Bezier 曲線視覺編輯、音效波形、貼圖與 atlas、3D 模型匯入、GPU 粒子、Shader Graph、縮圖或影片錄製。

本次不做：完整 DCC 工具、讓 VFX 改戰鬥數值、production 任意寫檔、Phase 0～2 大量新增 Preset、先追求新 Shader。

---

## 10. 效能預算

| 指標 | 一般技能 | 大招／攻城 | 超標處理 |
|---|---:|---:|---|
| 同時粒子 | 250 | 600 | 警告 |
| 同時物件 | 80 | 160 | 警告 |
| Draw Calls | 35 | 70 | 警告 |
| 演出長度 | 1.5 秒 | 3 秒 | 發布警告 |
| 排程 Timer | 30 | 80 | 發布警告 |
| Canvas | 1 | 1 | 阻止發布 |

`clear()` 後 scheduler、timer、RAF callback 與 scene child 必須歸零。支援 reduced motion、關閉 screen shake、固定 seed 重現。

---

## 11. 分階段計畫

### Phase 0：真實基線（不得改功能）

- 記錄 renderer、canvas、RAF loop、直接 timer 數量與位置。
- 建立載入、播放、切換 Preset、多目標、重播、清除 smoke test。
- 建立 Repository v1/v2 混寫失敗案例。
- 建立 Adapter 目標 DOM 重建測試。
- 建立單 renderer invariant，先確認舊版會失敗。
- 產生 29 個 Preset migration report。

驗收：交付真實呼叫圖、保存路徑圖及失敗型基線測試；不改視覺。

### Phase 1：單一 Player／Canvas

- 工房播放、Space、Auto Loop、Slow Motion 全走 Studio Controller。
- Adapter 動態解析目標或提供 `setTargets()`。
- 移除 `#three-canvas`、頁內 renderer、scene、camera、RAF、材質和播放函式。
- 所有計時改由 `VFXScheduler` 管理。
- 保持 29 個 Preset 視覺相容。

驗收：DOM 只有一張 VFX canvas；工房不 import Three.js；連按播放十次只存活最後一次；clear 後零殘留。

### Phase 2：Repository 與發布

- 定義 LocalStorage v3 與 v1→v2→v3 migration。
- CRUD／還原／保存全部只走 Repository。
- 建立 DEV API、atomic write、validation、snapshot、restore。
- 建立 dirty flag、離開警告和發布結果。

驗收：按鈕不直接 `localStorage.setItem`；發布前有快照；失敗不覆寫正式檔；production 無寫檔 API。

### Phase 3：UI 模組化

- 抽出 `vfx-studio.css`、Controller、Store、Library、Stage、Inspector。
- 技能綁定移到發布／整合區。
- 驗收 1440、1180、1024 三種尺寸。

驗收：HTML 建議低於 800 行；body 無水平捲動；不相關參數不會同時顯示；控制項具 label 與鍵盤焦點。

### Phase 4：時間軸與 Undo／Redo

- Track／Clip／Cue Store、播放頭、縮放、拖曳、Mute／Solo／Lock。
- Command Pattern，至少支援 50 步 Undo／Redo。
- Legacy Preset 顯示為 migration 後 sequence。
- 播放中編輯必須重新排程，不留舊 callback。

驗收：可建立「前搖→三刀→終結震屏→殘影」；重載後時間與順序一致；固定 seed 可重現。

### Phase 5：正式 Cue／CombatActionPlayer

- Sequence 持久化 Impact Cue。
- 建立 cue editor、SkillVfxBinding、production CombatActionPlayer。
- 實作 EXACT、SPLIT、PRIMARY、AOE、Heal、Shield、Status、Miss。
- 移除 UI 依陣列位置猜測的臨時邏輯。

驗收：三段真傷害精準對 cue；503 依 20/20/60 切割後總和仍為 503；純視覺 cue 不傷害；WebGL 失敗戰鬥仍完成。

### Phase 6：三端同源

- 戰鬥工房單場模式使用 CombatActionPlayer，Monte Carlo 保持 headless。
- 增加 Action／Impact／Cue／target／fallback Debug Overlay。
- 發布後可直接以正式技能試播。

驗收：工房、戰鬥工房、主遊戲的 cue、時間、target、生命週期一致；Skip／關閉零殘留。

### Phase 7：量產品質

- 效能 HUD、預算警告、鍵盤與 ARIA、reduced motion、WebGL fallback。
- 10 分鐘循環 soak test。
- 29 個 Preset migration 與人工視覺驗收。
- 完成架構、操作指南、日誌與交接。

驗收：長時間播放不持續增加 scene child、timer、記憶體物件；29 個 Preset 可載入、播放、保存、發布；1024×720 可工作。

---

## 12. 測試矩陣

### 資料與 Repository

- v1/v2/v3 migration、內建 override／還原、custom CRUD、重複 ID、非法 enum、缺少引用、發布失敗不覆寫、快照還原。

### Scheduler／Player

- play、pause、resume、seek、speed、clear、generation 失效、Auto Loop、固定 seed。
- 每種 Layer Renderer、複合順序、dispose、WebGL fallback、單 canvas invariant。

### Combat Action

- 單體一擊、三段連擊、單次多段演出、3 人 AOE、3 人×2 HIT、連鎖、吸血、護盾、治療／Buff、Miss、死亡、Skip／關閉。

### UI／瀏覽器

- 建立、複製、編輯、草稿、重載、Undo／Redo、Track、Cue、多目標、驗證阻止發布、發布重載、三種 viewport 無水平溢出。

必要命令：

```powershell
npm run typecheck
npm test
npm run build
npm run test:smoke
npm run check:bundle
```

人工驗收：播放重擊、旋風斬、火球、冰槍、聖盾、戰吼、箭雨、投石機；切換單體、前排、全體、攻城；連續播放、暫停、切換、Skip、clear；檢查 console、canvas、scene child、timer、active effect。

---

## 13. 完成定義

- [ ] 工房只有一個 renderer、scene、camera、canvas、RAF loop。
- [ ] HTML 不 import Three.js、不含播放函式。
- [ ] 三端使用相同 VFXPlayer。
- [ ] Scheduler 支援 pause、seek、clear、cancel。
- [ ] CRUD、保存、還原只走 Repository。
- [ ] DEV API 支援驗證、快照、atomic publish。
- [ ] Sequence 有 Track、Clip、Impact Cue。
- [ ] Cue 以 `cueId` 配對 CombatImpact。
- [ ] EXACT、SPLIT、PRIMARY 有 production code 與測試。
- [ ] AOE、Heal、Shield、Status、Miss 演出正確。
- [ ] UI 有時間軸、情境式 Inspector、Undo／Redo、dirty state。
- [ ] 技能綁定與創作區分離。
- [ ] 有固定 seed 與效能預算。
- [ ] 29 個 Preset migration 無靜默遺失。
- [ ] 1024×720 無 body 水平溢出。
- [ ] WebGL 失敗不影響戰鬥完成。
- [ ] Skip／關閉後零 callback。
- [ ] 測試與瀏覽器驗收都有證據。
- [ ] 文件同步完成。

---

## 14. 禁止的假完成

- 只新增 `VFXPlayer` 名稱，內部仍是巨大 Engine。
- 初始化 Adapter，但播放仍走舊函式。
- 只新增型別，資料、保存、runtime、UI 都沒使用。
- 測試檔自己重寫算法，沒有 import production function。
- 戰鬥工房只顯示警告，沒有正式播放 VFX。
- 保留雙 canvas 卻宣稱統一。
- 部分按鈕走 Repository、其他 CRUD 直接寫 LocalStorage。
- 用註解、emoji、勾選或文件取代執行證據。

---

## 15. 建議提交順序

```text
test(vfx): capture legacy studio runtime baseline
refactor(vfx): route studio through single player
refactor(vfx): remove embedded studio renderer
fix(vfx-data): unify repository schema and CRUD
feat(vfx-data): add safe publish and snapshots
refactor(vfx-studio): extract controller store library inspector
feat(vfx-studio): add timeline and command history
feat(vfx): persist named impact cues
feat(combat): add production combat action player
feat(combat-studio): use shared action playback
feat(vfx-studio): add quality budgets
docs(vfx): finalize guides and handover
```

---

## 16. 第一輪啟動訊息

```text
請完整閱讀 .agents/AGENTS.md、docs/ARCHITECTURE.md、docs/HANDOVER.md、
docs/CHANGELOG.md、docs/VFX_COMBAT_PIPELINE_HANDOVER.md，以及
docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md。

本輪只執行新規格 Phase 0：建立真實基線與缺口稽核，不修改功能碼。
不要相信舊文件的 100% 完成標記；以目前原始碼、瀏覽器行為與測試為準。
請回報：renderer/canvas/RAF/timer 數量、btn-play 呼叫鏈、所有 CRUD 保存路徑、
Impact Cue 缺口圖、戰鬥工房真實整合狀態、失敗型基線測試清單，
以及 Phase 1 的精確範圍與風險。等待我確認後才開始 Phase 1。
```
