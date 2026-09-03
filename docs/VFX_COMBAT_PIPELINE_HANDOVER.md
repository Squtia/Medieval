# 特效工房 × 戰鬥管線重構接手文件

> 狀態：待實作  
> 優先級：P0（回放正確性）→ P1（共用架構）→ P2（製作體驗）  
> 最後盤點：2026-09-03  
> 目的：讓接手者可以依本文件直接修改、測試與驗收，不需重新反查整個專案。

## 1. 接手結論

目前系統的方向是正確的：戰鬥模擬先完成數值結算，VFX 只負責演出；`CombatEvent` 也已具備 `skillId`、`vfxId`、`skillTargetId` 等串接欄位。

但現在尚未形成可靠的單一管線：

1. 特效工房與實戰各自維護一套 Three.js 播放邏輯。
2. 主遊戲 UI 會向後掃描事件來猜測一個技能的傷害與 HIT 數。
3. AOE、多目標、連鎖傷害與複合 VFX 會產生跳字、血條或目標錯配。
4. 戰鬥工房雖使用正式 `CombatSystem` 計算結果，卻沒有使用正式 VFX／回放管線。
5. 積木技能模型宣告了多項尚未真正執行的欄位。

因此下一階段不應繼續大量新增 Shader 或特效參數；應先完成「戰鬥 Action／Impact 契約」與共用播放器。

## 2. 不可破壞的設計原則

- 戰鬥結果不得依賴動畫幀、`setTimeout`、播放速度或 WebGL 是否可用。
- 跳過、快轉、背景模擬與蒙地卡羅測試必須得到相同戰鬥結果。
- 技能邏輯決定實際 HIT；VFX 只決定 HIT 演出發生的時間與樣式。
- 每一筆傷害、治療、護盾與狀態效果必須保留原始目標，不可在 UI 層重新分配。
- 特效工房、戰鬥工房與主遊戲必須使用同一個 VFX runtime。
- 所有延遲排程必須可取消；關閉或跳過戰鬥後不得再呼叫舊回呼。

## 3. 目前實際資料流

```text
tools/vfx-studio.html
  ├─ src/data/vfx_presets.json
  ├─ localStorage: MEDIEVAL_CUSTOM_VFX_PRESETS
  └─ localStorage: MEDIEVAL_SKILL_VFX_BINDINGS
                         │
                         ▼
src/data/SkillData.ts::getSkillVfxId()
                         │
                         ▼
src/systems/CombatSystem.ts
  └─ Skill.execute() / SkillEffectEngine
       ├─ 直接修改 CombatParticipant HP/MP/狀態
       └─ 產生 CombatEvent[]
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
CombatUIManager              CombatStudio.applyEventToUi
  ├─ 向後掃描 HIT/CRIT          ├─ 固定間隔播放
  ├─ 合併傷害                  ├─ 更新 HP/MP
  └─ CombatFXEngine            └─ 不播放正式 VFX
```

## 4. 已確認問題清單

### P0-1：AOE／多目標技能的回放錯配

位置：

- `src/systems/CombatSystem.ts`：建立 `SKILL_CAST` 時只放入 `skillTargets[0]`。
- `src/ui/CombatUIManager.ts`：`renderEventAsync()` 從 `SKILL_CAST` 後方掃描相同 actor 的所有 `HIT/CRIT`。

現行行為：

1. 把不同目標的傷害全部加到 `harvestedDamage`。
2. `finalTargetHp` 會被最後一筆目標事件覆蓋。
3. 所有動畫與跳字只施加到 `skillTargetId` 指向的第一個目標。
4. 被掃描的後續事件標記 `absorbedBySkillCast`，不再各自更新血條。

可能結果：三名敵人各受 100 傷害，畫面卻在第一名敵人身上顯示 300，並把第三名敵人的剩餘 HP 寫到第一名敵人的血條。

### P0-2：技能 HIT 與 VFX HIT 是兩套真相

- 真實技能段數：`EffectBlock.hitCount` 或靜態技能產生的 `CombatEvent` 數量。
- 視覺段數：`VFXPreset.hitCount || VFXPreset.salvoCount || 1`。

`CombatUIManager` 目前把真實總傷害平均切成視覺段數，會丟失：

- 每段原始傷害。
- 每段原始爆擊。
- 每段原始目標。
- 每段造成的實際 HP 快照。

### P0-3：複合 VFX 可重複發送完整傷害演出

`VFXLayer.generatesHit` 會讓子 Preset 直接呼叫父層的 `onImpact`。每個子 Preset 都有自己的 `totalHits` 與「最後一擊」，可能重複顯示完整 `harvestedDamage`、重複更新血條與重複觸發終結震動。

`generatesHit` 應改名為 `emitsImpactCue`，並明確表示它只產生演出 cue，不會建立新的戰鬥傷害。

### P0-4：複合圖層座標被轉換兩次

`CombatFXEngine.playPreset()` 先把 `ScreenPoint` 轉成 Three.js 世界座標；播放 `layer.presetId` 時卻把世界座標再次傳入 `playPreset()`，造成第二次 `screenToWorld()`。

處理方式二選一：

- 將公開方法保留 `ScreenPoint`，新增私有 `playPresetWorld(preset, startPos, endPos, ...)`。
- 或遞迴播放時始終傳原始 `from/to`，不要傳 `startPos/endPos`。

建議採第一種，避免類型相同但座標空間不同。

### P0-5：清除特效不會取消排程

`CombatFXEngine.clear()` 只清理 `activeEffects` 與 scene children，沒有取消：

- salvo timers
- layer timers
- failsafe timer
- 尚未觸發的 impact callback

接手者應加入播放世代或 cancellation token：

```ts
private playbackGeneration = 0;
private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

public clear(): void {
  this.playbackGeneration++;
  this.scheduledTimers.forEach(clearTimeout);
  this.scheduledTimers.clear();
  // 再清理 active effects 與 scene
}
```

所有 timeout callback 必須先比對 generation，失效播放不得再產生 VFX 或 impact cue。

### P1-1：工房與實戰是兩套播放器

`tools/vfx-studio.html` 自行實作材質、幾何、彈幕、命中與圖層排程；`src/ui/fx/CombatFXEngine.ts` 又實作一份。

已知漂移：

- 工房的複合圖層保存 `presetId`，預覽時卻沒有真正載入該 Preset。
- `salvoSpreadRadius`、`multiHitImpact`、Bloom、`shieldShape`、`waveCount`、`textureSprite`、斬擊擾動等欄位並未全部被正式 runtime 使用。
- 部分特殊軌跡提前 `return`，可能跳過工房的複合圖層排程。

### P1-2：Preset 資料缺乏驗證

`src/data/vfx_presets.json` 目前有兩筆 `VFX_METEOR_STRIKE`，總筆數 29、唯一 ID 28。

另有 enum 漂移：

- TypeScript：`GROUND_BURST`
- 特效工房：`GROUND_ERUPTION`

JSON 現在透過 `as unknown as VFXPreset[]` 載入，TypeScript 無法阻止重複 ID、非法 enum 或缺欄位。

### P1-3：LocalStorage 載入規則不一致

- 特效工房遇到與內建 Preset 相同 ID 時忽略 LocalStorage 版本。
- `CombatFXEngine` 遇到相同 ID 時以 LocalStorage 覆寫內建版本。
- `CombatFXEngine.presetMap` 初始化後不會因另一個分頁保存而失效。

結果是工房重新開啟看到原廠值，遊戲重新整理後卻可能使用修改值。

### P1-4：戰鬥工房沒有驗收正式 VFX

`CombatStudio` 使用正式 `CombatSystem.simulateCombat()`，但 `applyEventToUi()` 只做日誌、血條與 CSS 抖動，沒有掛載 `CombatFXEngine`，也沒有等待 impact cue。

所以現在的戰鬥工房只適合驗證數值，不適合驗證技能與特效合作。

### P1-5：積木技能模型有未實作欄位

目前已宣告但未完整執行：

- 每個 block 的獨立 `targetType`
- `cost.hpPercent`
- `cost.consumeMarks`
- `scaleType`
- `delayEffect`
- 條件 `IS_CRIT`
- 觸發 `ON_MARK_STACK`

此外：

- `compile()` 只用第一個 block 的 `targetType` 決定整個技能目標。
- `ON_CRIT`、`ON_HIT_TAKEN` 主要只從普攻成功路徑觸發，技能傷害沒有走同一套 hook。
- `DELAYED_BOMB`、`FIELD_FIRE`、`FIELD_HOLY`、`FIELD_CURSE` 可被加入狀態，但回合狀態處理器沒有執行其效果。
- 技能傷害目前沒有一般命中／閃避判定；只有普攻使用 10%～95% 命中率公式。
- `STATUS_DAMAGE`、回合回復等部分事件缺少 `targetId`、`targetMaxHp`，UI 無法穩定定位目標與更新血條。

### P1-6：技能工房草稿與戰鬥執行來源不同

`CombatStudio` 會從 `MEDIEVAL_CUSTOM_COMPOSITE_SKILLS` 顯示技能工房草稿；真正執行技能的 `SkillRegistry` 與 `SkillEffectEngine.triggerHooks()` 主要讀取編譯時匯入的 `CustomSkillData.json`。

未存磁碟或未重新載入的草稿可能出現在選單裡，進入模擬後卻無法執行。`CompositeSkillDefinition` 也沒有正式 `vfxId` 欄位，目前自訂技能只能依 LocalStorage 綁定或名稱關鍵字猜測。

## 5. 目標架構

### 5.1 戰鬥事件契約

建議新增動作層級事件，不再由 UI 掃描相鄰事件：

```ts
export type CombatImpactKind =
  | 'DAMAGE'
  | 'HEAL'
  | 'SHIELD_DAMAGE'
  | 'STATUS_APPLY'
  | 'MISS';

export interface CombatImpact {
  impactId: string;
  cueId: string;
  targetId: string;
  kind: CombatImpactKind;
  amount?: number;
  isCrit?: boolean;
  targetHp?: number;
  targetMaxHp?: number;
  targetMp?: number;
  targetMaxMp?: number;
}

export interface CombatAction {
  actionId: string;
  actorId: string;
  skillId?: string;
  skillName?: string;
  vfxId: string;
  impacts: CombatImpact[];
}
```

最低風險遷移方案：先在現有 `CombatEvent` 加上以下欄位，不必一次重寫所有事件：

```ts
actionId?: string;
impactIndex?: number;
impactCount?: number;
impactKind?: CombatImpactKind;
```

同一次技能的 `SKILL_CAST`、`HIT`、`HEAL`、`STATUS_APPLY` 使用同一 `actionId`。UI 只收集完全相同 `actionId` 的事件，且每筆事件保留自己的 `targetId`。

### 5.2 VFX cue 契約

VFX 不應決定傷害次數，而應提供可對齊的時間 cue：

```ts
export interface VFXImpactCue {
  cueId: string;
  time: number;
  layerId?: string;
  weight?: number;
}
```

對齊規則必須依技能綁定的 presentation mode 處理，不可只比較兩邊的數量後猜測：

- `EXACT_IMPACTS`：一個真實 impact 對一個 cue，供魔劍士連擊等真正多段技能使用。
- `SPLIT_SINGLE_IMPACT`：一筆真實 impact 可拆成多個視覺跳字 slice，供「造成 1XX% 傷害」但希望演出多段打擊感的技能使用。
- `PRIMARY_ONLY`：只有主要 cue 顯示完整傷害，其餘 cue 為純視覺。
- 真實 impact 多於 cue：視為資料不完整，戰鬥工房必須警告；回放器以最後 cue 或安全的均分時間完成剩餘回放。
- `EXACT_IMPACTS` 下 cue 多於真實 impact：多出的 cue 為純視覺，不跳傷害、不更新血條。
- AOE：先依 `targetId` 分組，再為每個目標套用相同對齊規則，禁止跨目標合併傷害。
- Heal／Buff：使用對應 presentation，不得套用 `target-hit`、擊退或負傷跳字。

建議把模式放在技能與 VFX 的綁定資料，而不是放進可共用的 VFX Preset：

```ts
export type ImpactPresentationMode =
  | 'EXACT_IMPACTS'
  | 'SPLIT_SINGLE_IMPACT'
  | 'PRIMARY_ONLY';

export interface SkillVfxBinding {
  skillId: string;
  vfxId: string;
  impactPresentationMode: ImpactPresentationMode;
}
```

#### 必須支援的核心製作需求：由特效命中點驅動精確跳字

特效工房必須讓設計者在時間軸或複合圖層上建立多個「傷害命中點」，例如：

```text
cue_1：0.20 秒，第一刀
cue_2：0.42 秒，第二刀
cue_3：0.80 秒，終結重擊
```

實戰流程必須是：

```text
技能結算先產生真實 CombatImpact[]
  ├─ impact_1：目標 A，120 傷害，cue_1
  ├─ impact_2：目標 A，135 傷害，cue_2
  └─ impact_3：目標 A，280 傷害（暴擊），cue_3
                         │
                         ▼
CombatActionPlayer 讀取 VFXImpactCue[]
  ├─ 0.20 秒播放第一段受擊並跳 120
  ├─ 0.42 秒播放第二段受擊並跳 135
  └─ 0.80 秒播放終結受擊並跳暴擊 280
```

此需求的責任分工必須固定：

- **特效工房決定何時命中**：`cueId`、`time`、圖層與打擊強度等演出資料。
- **技能／戰鬥結算決定命中什麼**：每段實際 `amount`、`targetId`、`isCrit`、HP 快照與狀態結果。
- **CombatActionPlayer 負責配對**：命中 cue 到時，只消費相同 `cueId` 的真實 impact 並跳出該筆原始數值。
- **禁止重新計算**：UI／VFX runtime 不得把總傷害除以 cue 數、合併不同目標或自行建立戰鬥傷害。
- **純視覺打擊可存在**：未綁定 impact 的 cue 只播放火花、震動或音效，不顯示傷害數字。

在 `EXACT_IMPACTS` 模式下，設計三段特效命中點後，戰鬥回放能精確在三個命中時間顯示三筆已結算傷害；但單純把特效由三段改成五段，不會暗中把技能的遊戲傷害段數改成五段。若要變更真正 HIT 數，必須同步修改技能效果資料。一般單次傷害若選擇 `SPLIT_SINGLE_IMPACT`，則可在不增加真實 HIT 的前提下，把同一筆總傷害拆成多次視覺跳字。

#### 兩種傷害敘述的共存規則

##### A. 真正多段傷害：`EXACT_IMPACTS`

範例：魔劍士「連續攻擊 4 次，每次造成 55% 物理與 55% 魔法傷害」。

- 戰鬥系統執行四次傷害公式。
- 每段各自判定命中、爆擊、防禦、護盾與觸發效果。
- 產生四筆 `CombatImpact`，各自保留傷害、目標、爆擊與 HP 快照。
- 四筆 impact 依 `cueId` 對應四個 VFX cue，逐段顯示原始數值。

##### B. 單次傷害、多段演出：`SPLIT_SINGLE_IMPACT`

範例：技能只定義「造成 150% 傷害」，但 VFX 希望呈現兩次輕斬加一次終結斬。

- 戰鬥系統只執行一次 150% 傷害公式，也只判定一次命中與爆擊。
- 只產生一筆真實 `CombatImpact`，被動、吸血、反擊、護盾與死亡判定都只執行一次。
- 回放器依 cue 的 `weight` 把該筆傷害建立成多個 `DamagePopupSlice`。
- 所有 slice 的整數傷害總和必須精確等於原始 `CombatImpact.amount`。
- slice 只影響跳字、血條過場、震動強度與音效，不得重新修改真實戰鬥狀態。
- 若原始 impact 是爆擊，可讓全部 slice 使用爆擊樣式，或只強調最後一段；但不得再次抽爆擊。

```ts
export interface DamagePopupSlice {
  cueId: string;
  targetId: string;
  displayAmount: number;
  isCrit: boolean;
  isFinalSlice: boolean;
}
```

例如單次結算傷害為 `503`，三個 cue 的 `weight` 為 `20 / 20 / 60`，跳字可以是 `101 + 100 + 302 = 503`。整數餘數必須以固定算法補到最後一段或最大權重段，不能因四捨五入變成 `502` 或 `504`。

因此兩種技能不會衝突：它們共用同一套 cue 播放器，但使用不同的「傷害呈現模式」。需要嚴格禁止的是把 `SPLIT_SINGLE_IMPACT` 的視覺 slice 當成新的戰鬥 HIT。

### 5.3 共用 VFX runtime

建議新增：

```text
src/ui/fx/
├─ VFXPlayer.ts              # 唯一播放、圖層、彈幕、cue、取消邏輯
├─ VFXPresetRepository.ts    # 內建、覆寫、自訂、版本與驗證
├─ VFXPresetValidator.ts     # schema 與欄位使用檢查
├─ CombatFXEngine.ts         # 主遊戲 DOM/座標 adapter
└─ VFXStudioAdapter.ts       # 工房舞台 adapter
```

`tools/vfx-studio.html` 應只保留版面與控制項，將目前內嵌的大量渲染程式移到共用模組。

### 5.4 共用回放器

建議新增 `CombatActionPlayer`：

- 主遊戲與戰鬥工房共用事件排序、VFX 等待、血條更新與跳字。
- 主遊戲 adapter 使用正式戰鬥卡片。
- 戰鬥工房 adapter 使用 `cs-arena-card`。
- 蒙地卡羅模式不建立播放器，只使用 headless `CombatSystem`。

## 6. 實作階段與修改內容

### Phase 0：先建立回歸測試

- [ ] 新增 `CombatActionTimeline.test.ts`。
- [ ] 建立固定 RNG seed 或可注入 Random source。
- [ ] 覆蓋單體一擊、單體多段、AOE、連鎖、治療、護盾、MISS、死亡。
- [ ] 驗證每個 impact 的 `targetId`、傷害、暴擊與 HP 快照。
- [ ] 新增 VFX 預設重複 ID、非法 enum、缺欄位測試。
- [ ] 新增「清除後 callback 不得觸發」fake timer 測試。

完成條件：測試能穩定重現目前 AOE 第一目標錯配與 timer 殘留問題。

### Phase 1：修正 Action／Impact 正確性

涉及檔案：

- `src/models/Combat.ts`
- `src/systems/CombatSystem.ts`
- `src/systems/combat/SkillEffectEngine.ts`
- `src/ui/CombatUIManager.ts`

工作項目：

- [ ] 為每次普攻／技能建立唯一 `actionId`。
- [ ] 每個效果事件加入 `actionId` 與 `impactIndex`。
- [ ] 移除 `CombatUIManager` 的 actor-only lookahead harvesting。
- [ ] 移除 runtime 寫入的 `absorbedBySkillCast` 臨時欄位。
- [ ] UI 依事件的原始 `targetId` 更新跳字與血條。
- [ ] 保留每段實際傷害與每段爆擊，不再平均重切。
- [ ] Heal、Buff、Status、Shield 使用獨立演出種類。
- [ ] 補齊所有狀態事件的 actor／target／最大值欄位。

完成條件：AOE 每名目標的跳字總和與其實際 HP 損失完全一致。

### Phase 2：修正 VFX Scheduler

涉及檔案：

- `src/models/VFX.ts`
- `src/ui/fx/CombatFXEngine.ts`

工作項目：

- [ ] 將 `generatesHit` 遷移為 `emitsImpactCue`，保留舊欄位讀取 migration。
- [ ] 廢止語意混亂的 `VFXPreset.hitCount`；改由 `impactCues.length` 表示視覺命中點數，技能真正段數仍只讀 `EffectBlock.hitCount` 或結算產生的 impact 數。
- [ ] 分離 ScreenPoint 與 WorldPoint API，修正子圖層二次轉換。
- [ ] 所有 timer 納入 cancellation 管理。
- [ ] failsafe 僅負責 resolve，不得偽造尚未發生的 impact。
- [ ] failsafe 時間納入最大 layer delay、子圖層 duration 與 salvo duration。
- [ ] `clear()` 後不允許舊 Promise callback 修改新戰鬥 UI。
- [ ] 將實際未使用的 Preset 欄位逐一接通或標記 deprecated。
- [ ] 特效工房可新增、刪除、排序並預覽具唯一 `cueId` 的命中點。
- [ ] `CombatActionPlayer` 在 cue 時間只消費對應 impact，直接顯示該筆原始 `amount` 與 `isCrit`。
- [ ] cue 與 impact 數量不同時依契約 fallback，並在戰鬥工房顯示警告。
- [ ] 技能綁定可選 `EXACT_IMPACTS`、`SPLIT_SINGLE_IMPACT` 或 `PRIMARY_ONLY`。
- [ ] 特效工房的技能綁定區顯示「真實逐段／拆分單次／僅主段」選項與目前 impact、cue 數量預覽。
- [ ] `SPLIT_SINGLE_IMPACT` 使用固定整數分配算法，所有跳字 slice 總和必須等於原始傷害。
- [ ] 視覺 slice 不得重複觸發命中、爆擊、吸血、反擊、護盾、狀態或死亡判定。

完成條件：快速切換技能、關閉戰鬥、Skip、重新開戰皆無殘留 VFX 或舊跳字。

### Phase 3：抽出共用 VFXPlayer

涉及檔案：

- `tools/vfx-studio.html`
- `src/ui/fx/CombatFXEngine.ts`
- 新增 `VFXPlayer.ts`、`VFXStudioAdapter.ts`

工作項目：

- [ ] 把材質、幾何、特殊軌跡、salvo、layer scheduler 移到共用播放器。
- [ ] 特效工房改用共用播放器預覽。
- [ ] `layer.presetId` 在工房與實戰走同一條程式路徑。
- [ ] 特效工房的多目標卡僅由 adapter 提供 DOM 目標。
- [ ] 刪除工房內已重複的 Three.js 實作。

完成條件：同一 Preset、相同座標與 seed，在工房及主遊戲產生相同 cue 數、相同圖層與相同生命週期。

### Phase 4：Preset Repository 與資料驗證

涉及檔案：

- `src/data/vfx_presets.json`
- `src/models/VFX.ts`
- `src/data/SkillData.ts`
- `tools/vfx-studio.html`
- 新增 `VFXPresetRepository.ts`、`VFXPresetValidator.ts`

工作項目：

- [ ] 合併或重新命名重複的 `VFX_METEOR_STRIKE`。
- [ ] 統一 `GROUND_BURST`／`GROUND_ERUPTION`。
- [ ] 建立 `builtIn`、`overrides`、`custom`、`deletedCustomIds` 分層。
- [ ] LocalStorage 加入 schema version 與 migration。
- [ ] 保存後讓已建立的 runtime 立即 invalidate/reload。
- [ ] 自訂 ID 衝突時阻止保存並顯示錯誤。
- [ ] Build/test 階段檢查所有 `SKILL_VFX_MAP` 指向存在的 Preset。
- [ ] Build/test 階段檢查每個公開工房參數是否被 runtime 消費。

完成條件：工房重開、遊戲重開與跨分頁狀態完全一致。

### Phase 5：戰鬥工房正式整合

涉及檔案：

- `src/tools/CombatStudio.ts`
- `tools/combat-studio.html`
- 共用 `CombatActionPlayer`

工作項目：

- [ ] 單場戰鬥模式掛載正式 VFX canvas。
- [ ] 使用共用 Action Player，取代固定 600ms 的 `stepPlayback()`。
- [ ] 顯示 `actionId / skillId / vfxId / impactIndex` 除錯資訊。
- [ ] 增加「實際 impact 數 vs VFX cue 數」警告。
- [ ] 支援逐 Action、逐 HIT、暫停、慢動作與 Skip。
- [ ] Monte Carlo 保持 headless，不載入 Three.js。

完成條件：戰鬥工房單場播放與主遊戲使用同一份事件資料時，血條、跳字、目標與 VFX 一致。

### Phase 6：補完積木技能邏輯

涉及檔案：

- `src/models/Skill.ts`
- `src/systems/combat/SkillEffectEngine.ts`
- `src/systems/combat/SkillRegistry.ts`
- `src/tools/SkillWorkshop.ts`
- `src/tools/CombatStudio.ts`
- `src/data/CustomSkillData.json`

工作項目：

- [ ] 為每個 block 依 `targetType` 重新解析目標。
- [ ] 實作 block HP cost、mark cost 與縮放策略。
- [ ] 實作 `IS_CRIT` 與 `ON_MARK_STACK`，或在工房移除選項。
- [ ] 實作 `delayEffect` 與延遲炸彈結算。
- [ ] 實作或明確定義三種場地狀態效果。
- [ ] 技能與普攻走相同的 ON_CRIT／ON_HIT_TAKEN hook 規則。
- [ ] 在技能資料加入 `accuracyPolicy`，明確標示必中或逐段命中判定。
- [ ] `CompositeSkillDefinition` 增加 `vfxId`。
- [ ] `SkillRegistry` 統一磁碟、LocalStorage 草稿與動態註冊來源。
- [ ] `triggerHooks()` 不可再只讀編譯時 JSON。

完成條件：工房可建立「單體傷害 → 自我治療 → 全隊 Buff」且三個 block 都作用於正確目標；所有顯示中的積木欄位都有測試。

## 7. 建議測試矩陣

| 案例 | 真實事件 | VFX cue | 驗收重點 |
|---|---:|---:|---|
| 單體重擊 | 1 DAMAGE | 1 | 傷害、爆擊、HP 完全一致 |
| 三段連擊 | 3 DAMAGE | 3 | 保留每段不同傷害與暴擊 |
| 單次傷害、多段演出 | 1 DAMAGE | 3 | 三次視覺跳字總和等於單次傷害，遊戲判定仍只有一次 |
| 3 人 AOE | 3 DAMAGE | 1 | 同一 cue 同步三個目標 |
| 3 人 × 2 HIT | 6 DAMAGE | 2 | 每個目標各顯示兩段 |
| 連鎖雷擊 | N DAMAGE | N | 每一跳目標不同且順序正確 |
| 吸血 | DAMAGE + HEAL | 2 種 cue | 敵方受擊、施術者治療 |
| 護盾攔截 | SHIELD + DAMAGE | 1～2 | 護盾與 HP 分開顯示 |
| 治療／Buff | HEAL/STATUS | 1 | 不可出現受擊抖動與負傷跳字 |
| MISS | MISS | 1 | 不扣 HP、不出現命中 cue |
| Skip／關閉 | 任意 | 任意 | 清除後零殘留 callback |
| 複合圖層 | 1 DAMAGE + 多視覺層 | 多 cue | 只能有一份真實傷害 |

## 8. 完成定義（Definition of Done）

以下條件全部成立才可宣告此重構完成：

- [ ] 不再以 actor-only lookahead 推算技能傷害。
- [ ] AOE、連鎖與多段技能的每筆傷害保留正確 target。
- [ ] VFX cue 數與真實 HIT 數不一致時有明確 fallback 與警告。
- [ ] 特效工房製作的多段命中 cue，能在主遊戲與戰鬥工房的相同時間點逐段觸發精確傷害跳字。
- [ ] 每段跳字數值、爆擊樣式與目標都直接來自對應 `CombatImpact`，不由 VFX 平均、合併或重算。
- [ ] 真多段技能每段各自判定；單次傷害的多段演出只拆 presentation slice，兩者不共用模糊的 `hitCount` 語意。
- [ ] `SPLIT_SINGLE_IMPACT` 的所有視覺跳字總和與單筆真實傷害完全一致，且所有遊戲觸發只發生一次。
- [ ] VFX 無法播放或 WebGL 初始化失敗時，戰鬥回放仍能完成。
- [ ] Skip／clear 後不會出現延遲特效與舊回呼。
- [ ] 特效工房與主遊戲使用同一個 VFXPlayer。
- [ ] 戰鬥工房單場模式使用正式 Action Player。
- [ ] Preset 無重複 ID、無非法 enum、無無效必填欄位。
- [ ] 工房所有可見控制項在正式 runtime 確實有效。
- [ ] 自訂技能草稿、磁碟資料與戰鬥 Registry 來源一致。
- [ ] `npm run typecheck`、`npm test`、`npm run build` 全部通過。
- [ ] 至少新增上述測試矩陣的整合測試。

## 9. 建議提交順序

為降低一次性重構風險，建議拆成下列提交：

1. `test(combat): cover action impacts and multi-target playback contract`
2. `refactor(combat): add actionId and explicit impact metadata`
3. `fix(combat-ui): remove lookahead damage harvesting`
4. `fix(vfx): add cancellable scheduler and world-coordinate playback`
5. `refactor(vfx): extract shared VFXPlayer`
6. `feat(combat-studio): use shared action playback and VFX runtime`
7. `fix(vfx-data): validate presets and unify repository semantics`
8. `fix(skills): complete block targeting triggers costs and delayed effects`

每一個提交都應保持現有測試可執行，不要在同一提交同時搬移 renderer、修改事件契約與補技能邏輯。

## 10. 接手時第一輪操作

```powershell
npm run typecheck
npm test
npm run build
```

然後依序重現：

1. 戰鬥工房建立三個敵人的 AOE 戰鬥。
2. 記錄每個 `CombatEvent.targetId`、`damage`、`targetHp`。
3. 在主遊戲播放同類技能，確認目前所有跳字是否集中第一目標。
4. 播放含 `layers[].generatesHit` 的 Preset，確認是否重複跳完整傷害。
5. 在 salvo 尚未結束前按 Skip／關閉，確認 timer 是否殘留。

完成重現測試後，再開始 Phase 1；不要先從 Shader 或版面著手。
