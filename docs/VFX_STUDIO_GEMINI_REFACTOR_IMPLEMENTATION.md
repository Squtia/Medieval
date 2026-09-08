# 特效工房 × 戰鬥特效管線重整實作規格（交付 Gemini）

> 文件用途：本文件是可直接交給 Gemini 執行的編碼規格，不是概念提案。
>
> 專案：Medieval Mercenary Management RPG
>
> 優先級：P0 正確性 → P1 編輯體驗 → P2 架構收斂與品質
>
> 核心原則：戰鬥系統決定結果，VFX 只決定演出；編輯器顯示的每一個控制項必須真的影響正式 runtime。

---

## 0. 給 Gemini 的執行指令

請直接修改專案程式並完成測試，不要只提供分析或範例程式碼。

執行時必須遵守以下規則：

1. 先閱讀本文件列出的現有檔案，再修改程式。
2. 保留戰鬥數值與 VFX 播放解耦，不得讓動畫時間、播放速度、WebGL 狀態或 Cue 數量改變真正戰鬥結果。
3. 不得以 `as any`、`as unknown as`、跳過驗證或降低測試標準來消除錯誤。
4. 不得新增另一套播放器、另一套 Preset repository 或另一套戰鬥事件掃描器。
5. 所有正式播放入口必須走相同的 `CombatActionPlayer` 與 Stage Adapter。
6. 修正現有測試盲點；測試必須驗證使用者可觀察結果，而不只是 class、DOM ID 或文字存在。
7. 過程中若發現本文件與實際程式不同，以「戰鬥結果不可被 VFX 改變」和「一項設定只有一個權威來源」兩項原則判斷。
8. 完成後執行本文件最後列出的驗證命令，並逐項回報通過／失敗與原因。

禁止採取以下作法：

- 只重排 CSS，保留所有錯誤或無效欄位。
- 以更多 fallback 掩蓋 Cue／Impact 數量錯配。
- 在 `CombatUIManager` 再做一次傷害聚合或數值切分。
- 由 VFX 的 `hitCount` 或 `salvoCount` 建立真正戰鬥傷害。
- 同時保留兩個可編輯的總時長。
- 將 Legacy 與新版彈道欄位同時暴露給使用者。
- 測試中出現 console error、404、未預期 fallback 後仍宣告成功。

---

## 1. 現況與已確認缺陷

### 1.1 技能綁定的演出模式沒有進入正式播放管線

現有資料：

- `src/data/skill_vfx_bindings.json` 具有 `impactPresentationMode`。
- `SkillVfxBindingRegistry` 具有 `getPresentationMode(skillId)`。
- `CombatActionPlayer.playAction()` 卻只讀 `preset.impactPresentationMode`。
- LocalStorage 自訂技能綁定只儲存 `skillId -> vfxId` 字串，未保存 mode 與 cueMap。

造成結果：

- 同一個 VFX 無法針對不同技能使用不同演出模式。
- JSON 中的 `SPLIT_SINGLE_IMPACT`、`PRIMARY_ONLY` 可能被忽略。
- 使用者重新整理頁面後，自訂 mode 會遺失。
- `SkillVfxBinding.cueMap` 雖已宣告，但沒有正式 consumer。

### 1.2 Cue targetPolicy 沒有執行

UI 可編輯：

- `PRIMARY_TARGET`
- `EACH_TARGET`
- `CASTER`

但 `mapImpactsToCues()` 只把 `targetPolicy` 放進輸出，不依策略決定目標。多目標時，每個 target group 都會遍歷同一批 Cue。

造成結果：

- `PRIMARY_TARGET` 仍可能在所有目標產生呈現。
- `CASTER` 不會自動指向施法者。
- UI 控制項看似可用，實際沒有語意。

### 1.3 主遊戲存在雙重跳字／雙重結算呈現路徑

目前流程：

1. `CombatStageAdapter.playCombatAction()` 在 `onPresentImpact` 中建立 dummy event。
2. Adapter 呼叫 `triggerHitFeedback()`，已經產生 Cue 對齊的跳字與卡牌反饋。
3. `CombatUIManager.renderEventAsync()` 等 action 播完後，又逐目標找 `lastEv`。
4. 再呼叫一次 `applyDamageAndFloatingNumbers(lastEv)`。

造成結果：

- 單段傷害可能顯示兩次。
- 多段傷害逐段顯示後，又補顯示最後一段。
- Adapter 與 UI Manager 同時擁有跳字責任。

### 1.4 Adapter 把每一個 Cue 都當成最後一擊

`CombatStageAdapter` 與 `CombatStudioStageAdapter` 呼叫 `triggerHitFeedback()` 時，`totalHits` 固定傳入 `1`。

造成結果：

- `hitIdx >= totalHits - 1` 永遠成立。
- 每段 Cue 都可能使用完整 shake、punch、knockback、screen shake。
- `multiHitImpact` 的「前段輕顫、最後重震」失效。

### 1.5 SHIELD_BREAK 沒有成為正式 Impact

`CombatSystem` 可能產生 `SHIELD_DAMAGE` 或 `SHIELD_BREAK`，但：

- `totalImpactCount` 只計算 `SHIELD_DAMAGE`。
- `mapImpactsToCues()` 只篩選 `SHIELD_DAMAGE`。
- `resolveEventKind()` 沒有處理 `SHIELD_BREAK`。

造成結果：

- 破盾 Cue 可能消失。
- 被護盾完全吸收後留下 `damage: 0` 的 HIT，可能形成幽靈打擊。
- Debug Overlay 的 Impacts 數量可能與實際演出不同。

### 1.6 工房包含大量無效控制項

下列欄位目前在 Inspector／model 中存在，但正式 runtime 沒有完整消費：

- `coreMeshShape`
- `coreBrightness`
- `salvoSpreadAngle`
- `salvoSpreadRadius`
- `slashTrajectory`
- `slashAngleJitter`
- `slashAlternating`
- `spikeAlignToImpact`
- `shieldShape`
- `waveCount`
- `textureSprite`
- `waveColor`
- `bloomStr`
- `bloomRad`
- `bloomThresh`

其中護盾 renderer 目前固定建立同一種護盾；戰吼 renderer 呼叫時圈數固定為 `3`。

處理原則：

- 本次 P0/P1 不強迫把所有效果都實作。
- 不能在 UI 留下「調了但沒效果」的控制項。
- 已有明確低風險實作方式者可以補齊；其餘先從 UI 隱藏，保留資料相容讀取。

### 1.7 同一個總時長有兩個控制器

- 右側 `param-duration`：range，`0.1 ~ 1.5`，step `0.05`。
- Timeline `tl-input-duration`：number，`0.1 ~ 5.0`，step `0.05`。

Preset 若為 `0.28s`，range 可能量化為 `0.30s`，但標籤仍顯示 `0.28s`，使用者只要碰一下滑桿就改值。

### 1.8 新舊彈道模型同時暴露

Inspector 同時顯示：

- `spatialMode`
- `trajectoryPath`
- `reverse`
- Legacy `trajectory`

runtime 使用類似：

```ts
preset.spatialMode || preset.trajectoryPath || preset.trajectory
```

這讓使用者無法理解誰覆蓋誰，也讓測試容易只驗證其中一條路徑。

### 1.9 Inspector 情境顯示被 normalize 預設值污染

`normalizeVfxPreset()` 先替所有欄位補值，再用欄位是否存在判斷 `isSlash`、`isSpike`、`isSalvo`。

例如所有 Preset 都會擁有 `salvoDuration` 預設值，導致非連射特效也可能顯示 Salvo 卡片。

情境顯示應依 renderer capability、選取軌道種類與明確模式判斷，不能依「欄位存在」判斷。

### 1.10 驗證腳本有假陽性

- 部分 `.mjs` 直接 import extensionless TypeScript module，Node 執行時出現 `ERR_MODULE_NOT_FOUND`。
- Phase 6 瀏覽器驗證即使出現 404 與 Skip 後非預期 `FALLBACK`，仍輸出「100% 通過」。
- Layout 測試只確認 viewport 沒有水平 overflow，沒有驗證可用性、欄位生效或重複跳字。

---

## 2. 目標資料契約

### 2.1 CombatAction 必須攜帶解析後的綁定

修改 `src/ui/fx/CombatActionPlayer.ts` 的 `CombatAction`：

```ts
export interface CombatAction {
  actionId: string;
  actorId: string;
  skillId?: string;
  vfxId?: string;
  presentationMode?: ImpactPresentationMode;
  cueMap?: Record<string, string>;
  events: CombatEvent[];
}
```

權威解析順序：

1. `action.presentationMode`
2. `SkillVfxBindingRegistry.getBinding(action.skillId)?.impactPresentationMode`
3. Preset 上的 legacy `impactPresentationMode`
4. `'EXACT_IMPACTS'`

`cueMap` 同理，以 action／binding 為主，Preset 不應保存 skill-specific cueMap。

新增 registry API：

```ts
public getBinding(skillId: string): SkillVfxBinding | undefined {
  const binding = this.bindingsMap.get(skillId);
  return binding ? structuredClone(binding) : undefined;
}
```

### 2.2 LocalStorage 綁定 schema 升級

不要再保存：

```ts
Record<string, string>
```

改為：

```ts
export interface SkillVfxBindingStorageV2 {
  version: 2;
  overrides: Record<string, {
    vfxId: string;
    impactPresentationMode?: ImpactPresentationMode;
    cueMap?: Record<string, string>;
  }>;
}
```

必須相容讀取 v1：

```json
{
  "FIGHTER_HEAVY_STRIKE": "VFX_HEAVY_STRIKE"
}
```

v1 migration 規則：

- `vfxId` 使用舊字串。
- mode 優先沿用官方 binding，否則 `EXACT_IMPACTS`。
- migration 後下一次寫入使用 v2。

保存 override 的判定不可只比較 `vfxId`，必須比較：

- `vfxId`
- `impactPresentationMode`
- `cueMap`

### 2.3 CombatImpactKind 完整化

在 `src/models/Combat.ts` 補齊：

```ts
export type CombatImpactKind =
  | 'DAMAGE'
  | 'HEAL'
  | 'SHIELD_DAMAGE'
  | 'SHIELD_BREAK'
  | 'STATUS'
  | 'MISS';
```

`SHIELD_BREAK` 必須是正式 impact，並攜帶：

```ts
shieldDamage?: number;
shieldRemaining?: number;
targetId: string;
```

不得把破盾事件轉成一般 HP DAMAGE。

### 2.4 VFX 不得擁有真實 hitCount

`VFXPreset.hitCount` 目前的註解宣稱「戰鬥 HIT 判定段數」，違反解耦原則。

本次處理：

1. runtime 不得使用它建立戰鬥事件。
2. fallback Cue 數量只可從 `impactCues` 或純視覺 `salvoCount` 取得。
3. 將欄位標記 deprecated：

```ts
/** @deprecated VFX 不得決定真正戰鬥 HIT；僅供舊資料 migration。 */
hitCount?: number;
```

4. 新建／儲存 Preset 不再寫入 `hitCount`。

---

## 3. Cue／Impact 映射演算法

### 3.1 輸入

```ts
export interface MapImpactsContext {
  actorId: string;
  primaryTargetId?: string;
  presentationMode: ImpactPresentationMode;
  cueMap?: Record<string, string>;
}
```

建議把函式簽名改為：

```ts
export function mapImpactsToCues(
  events: readonly CombatEvent[],
  cues: readonly VFXImpactCue[],
  context: MapImpactsContext
): CombatImpactPresentation[]
```

### 3.2 目標策略必須真正執行

每個 Cue 建立候選目標：

```ts
function resolveCueTargetIds(
  cue: VFXImpactCue,
  actorId: string,
  primaryTargetId: string | undefined,
  impactTargetIds: readonly string[]
): string[] {
  switch (cue.targetPolicy ?? 'PRIMARY_TARGET') {
    case 'CASTER':
      return [actorId];
    case 'EACH_TARGET':
      return [...new Set(impactTargetIds)];
    case 'PRIMARY_TARGET':
    default:
      return primaryTargetId ? [primaryTargetId] : impactTargetIds.slice(0, 1);
  }
}
```

規則：

- `PRIMARY_TARGET` 不得複製到所有目標。
- `EACH_TARGET` 對每個實際目標建立呈現。
- `CASTER` 指向 actor；若沒有對 actor 的真實 impact，產生 `VISUAL_ONLY`，不得挪用敵方傷害。
- 真實 impact 永遠保留自己的 target，不可因 Cue policy 被改成另一個 target。
- Cue policy 只決定「在哪些目標播放演出」；真正數值只能消費 target 相符的 impact。

### 3.3 EXACT_IMPACTS

- 同一目標的第 N 筆真實 impact 對應第 N 個可承載該 kind 的 Cue。
- 多出的 Cue 為 `VISUAL_ONLY`。
- impact 多於 Cue 時，建立 runtime fallback Cue，但必須：
  - `console.warn` 提供 skillId、vfxId、actionId、targetId、impact count、cue count。
  - Debug Overlay 標記為 degraded，而不是一般成功。
  - 戰鬥工房顯示可見警告。
- 若 binding 有 `cueMap`，優先依 event 的 `cueId`／impact index 映射，不做純順序猜測。

### 3.4 SPLIT_SINGLE_IMPACT

只允許一筆數值 impact 拆成多個顯示 slice。

- 真實戰鬥事件仍只有一筆。
- 所有 slice 整數總和必須等於原始 amount。
- `weight <= 0` 視為不可承載數值，不要偷偷 clamp 成 `0.01`。
- 餘數歸到 primary Cue；無 primary 時歸到最後一個有效 Cue。
- HP 條只在最後 slice 到達真實 `targetHp`；前段可提供純視覺插值值，但不得回寫戰鬥狀態。
- 爆擊樣式預設只放 primary／最後 slice。

### 3.5 PRIMARY_ONLY

- 完整 amount 只在 `isPrimary` Cue 呈現。
- 無 primary 時使用最後一個可承載數值的 Cue。
- 其他 Cue 全部為 `VISUAL_ONLY`。
- 不得因其他 Cue 的 kind 為 IMPACT 而生成額外傷害跳字。

### 3.6 Event kind 與 Cue kind 相容性

建立明確規則：

```ts
function cueAcceptsImpact(cueKind: VFXCueKind, impactKind: CombatImpactKind): boolean {
  if (cueKind === 'VISUAL_ONLY') return false;
  if (cueKind === 'HEAL') return impactKind === 'HEAL';
  if (cueKind === 'SHIELD') {
    return impactKind === 'SHIELD_DAMAGE' || impactKind === 'SHIELD_BREAK';
  }
  if (cueKind === 'STATUS') return impactKind === 'STATUS';
  return impactKind === 'DAMAGE' || impactKind === 'MISS';
}
```

若 Cue kind 與 impact kind 不相容，不得強行配對。

---

## 4. 主遊戲與戰鬥工房播放責任重整

### 4.1 單一 UI 呈現責任

規定：

- `CombatActionPlayer`：只負責 Cue 排程與 Impact mapping。
- Stage Adapter：負責卡牌 shake、flash、knockback、跳字與 HP/MP UI。
- `CombatUIManager`／`CombatStudio`：負責組裝 action、日誌與播放隊列，不得再次建立傷害跳字。

因此移除 `CombatUIManager.renderEventAsync()` 在 Action 播放後的重複呈現：

```ts
// 必須移除目前這類邏輯：
targetEventsMap.forEach(tEvents => {
  const lastEv = [...tEvents].reverse().find(...);
  this.applyDamageAndFloatingNumbers(lastEv);
});
```

播放 action 後只允許：

- Adapter 依 Cue 更新 UI。
- Action complete 將最終 HP 安全校正一次，但不得跳字、shake 或播放 VFX。

新增純函式：

```ts
private static reconcileFinalActionState(events: readonly CombatEvent[]): void
```

只更新：

- HP bar 最終值
- MP bar 最終值
- shield HUD 最終值
- death class

禁止建立 floating DOM。

### 4.2 正確傳遞 Cue 總數

Adapter 不得傳 `totalHits = 1`。

`CombatImpactPresentation` 增加：

```ts
cueCount: number;
presentationIndex: number;
presentationCount: number;
```

呼叫：

```ts
this.triggerHitFeedback(
  targetEl,
  dummyEv,
  impactCfg,
  item.presentationIndex,
  item.presentationCount,
  cue,
  item
);
```

對多目標 AOE，`presentationCount` 應以該目標自己的呈現數量計算，不可使用全 action 總數。

### 4.3 零傷害與純視覺 Cue

- `amount === 0 && kind === 'VISUAL_ONLY'`：可播放輕微視覺反饋，不顯示 `-0`。
- 被護盾完全吸收的 HP HIT：不得再顯示 HP 傷害 shake／跳字。
- `SHIELD_DAMAGE`：顯示盾牌樣式數字或 shield HUD，不使用紅色 HP 跳字。
- `SHIELD_BREAK`：顯示破盾字樣／圖示並使用破盾 Cue。
- `STATUS`：不得顯示 `-0`，使用狀態文字或 icon。
- `MISS`：顯示 MISS，不更新 HP。

### 4.4 Action 組裝

不要再以 actor-only lookahead 作正常路徑。

建立 helper：

```ts
export function collectCombatActions(events: readonly CombatEvent[]): Array<CombatAction | CombatEvent>
```

規則：

- 有 `actionId` 的事件一次預先分組。
- 保留原始事件順序。
- `SKILL_CAST`、該 action 的 HIT／HEAL／STATUS／SHIELD／MISS 一次交給播放器。
- `DEATH` 可留在 action 後播放，但不得阻止同 action 其他 impact 被收集。
- 沒有 `actionId` 的 legacy event 保留單事件 fallback。
- 不再在事件物件上寫入暫態 `absorbedBySkillCast`。

這可以避免 replay 同一份 report 時，第一次播放修改 event，第二次播放行為不同。

### 4.5 deterministic actionId

不要使用 `Date.now()` 作為模擬事件 ID 的一部分。

改用 combat session 內遞增 counter：

```ts
let actionSequence = 0;
const nextActionId = (kind: string, actorId: string, turn: number) =>
  `act_${kind}_${turn}_${actorId}_${actionSequence++}`;
```

相同 seed 與相同輸入應產生相同 event report，包括 actionId。

---

## 5. 特效工房 UI 重整

### 5.1 版面資訊架構

桌面版維持三欄，但責任重新定義：

```text
┌──────────────┬────────────────────────────────┬──────────────────┐
│ 素材與綁定    │ 舞台                           │ 情境 Inspector    │
│ Library       │ Stage                          │ Selected object   │
│ Search        ├────────────────────────────────┤ only              │
│ Categories    │ Timeline                       │                   │
└──────────────┴────────────────────────────────┴──────────────────┘
```

左欄只放：

- 搜尋框
- 分類 filter
- Preset 清單
- 新增／複製
- 技能綁定摘要與開啟綁定中心
- 發布狀態

左欄不得放效果參數、圖層參數或 Cue 參數。

中央只放：

- Stage
- 目標情境選擇
- Play／Pause／Stop／Loop／Speed
- Timeline ruler
- Track rows
- Add track／Add Cue

右欄只放目前選取項目的屬性。

### 5.2 選取狀態

建立明確 union：

```ts
export type VFXEditorSelection =
  | { type: 'PRESET' }
  | { type: 'MAIN_TRACK' }
  | { type: 'LAYER'; layerId: string }
  | { type: 'CUE'; cueId: string }
  | { type: 'BINDING'; skillId: string };
```

不要使用 array index 作持久選取識別；刪除或排序圖層／Cue 後 index 會漂移。

Store 增加：

```ts
private selection: VFXEditorSelection = { type: 'PRESET' };
public setSelection(selection: VFXEditorSelection): void;
public getSelection(): VFXEditorSelection;
```

### 5.3 Inspector capability schema

不要再用 `applicable: 'SLASH' | 'SPIKE' | ...` 加欄位存在判斷。

改為 renderer capability：

```ts
export type InspectorCapability =
  | 'TRANSFORM'
  | 'TRAJECTORY'
  | 'SLASH_GEOMETRY'
  | 'PROJECTILE_GEOMETRY'
  | 'FIRE_SHADER'
  | 'ICE_SHADER'
  | 'PARTICLES'
  | 'IMPACT_FEEDBACK'
  | 'CUE'
  | 'BINDING';

export interface InspectorControlConfig<T = unknown> {
  id: string;
  key: string;
  label: string;
  type: 'number' | 'range-number' | 'select' | 'boolean' | 'color';
  capability: InspectorCapability;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue: T;
  help?: string;
}
```

由選取內容回傳 capabilities：

```ts
function getSelectionCapabilities(
  preset: VFXPreset,
  selection: VFXEditorSelection
): Set<InspectorCapability>
```

範例：

- Slash 主軌：`TRANSFORM`, `TRAJECTORY`, `SLASH_GEOMETRY`
- Fire projectile：`TRANSFORM`, `TRAJECTORY`, `PROJECTILE_GEOMETRY`, `FIRE_SHADER`
- Cue：只有 `CUE`
- Binding：只有 `BINDING`

### 5.4 控制項必須支援精確輸入

所有連續數值採「range + number」同一控制：

```html
<div class="param-range-number">
  <input type="range" ...>
  <input type="number" ...>
  <span class="unit">ms</span>
  <button type="button" class="reset-param">↺</button>
</div>
```

兩個 input 必須綁定同一個 update function，不得各自維護值。

建議範圍：

| 欄位 | 最小 | 最大 | step | 單位 |
|---|---:|---:|---:|---|
| duration | 0.05 | 5.0 | 0.01 | s |
| delay | 0 | 5.0 | 0.01 | s |
| scale | 0.1 | 4.0 | 0.05 | x |
| spin | -30 | 30 | 0.5 | rad/s |
| trailCount | 0 | 200 | 1 | particles |
| trailSize | 1 | 40 | 1 | px |
| burstCount | 0 | 300 | 1 | particles |
| hitStopTime | 0 | 120 | 1 | ms |
| targetPunchScale | 0.75 | 1.05 | 0.01 | x |
| shakeIntensity | 0 | 24 | 1 | px |
| shakeDuration | 0 | 1.0 | 0.01 | s |
| knockbackDistance | 0 | 80 | 1 | px |
| cue time | 0 | sequence duration | 0.01 | s |
| cue weight | 0 | 10 | 0.1 | weight |

### 5.5 唯一總時長

- 移除右側 `param-duration` 或將它改為 Timeline duration 控制的鏡像唯讀值。
- 建議保留 Timeline header 的 number + range 複合控制。
- 更新 duration 時：
  - 不得默默裁切超出範圍的 clip／Cue。
  - 若縮短後會超出，顯示確認區塊，列出超出的項目。
  - 提供「延長 sequence」「按比例縮放全部」「取消」三種選擇。

### 5.6 移除 Legacy 彈道 UI

使用者只看到：

```ts
spatialMode: 'AT_CASTER' | 'AT_TARGET' | 'TRAJECTORY';
trajectoryPath?: 'A_TO_B' | 'VERTICAL_SKY_TO_B' | 'DIAGONAL_SKY_TO_B' | 'A_TO_VERTICAL_SKY' | 'A_TO_DIAGONAL_SKY';
reverse?: boolean;
```

Legacy `trajectory`：

- 只在 repository load 時 migration。
- migration 後轉成新版欄位。
- Inspector 不顯示。
- 新資料不再依賴 legacy 欄位。

需要保留特殊 renderer 類型時，不要塞進 trajectory；使用：

```ts
rendererType:
  | 'SLASH'
  | 'PROJECTILE'
  | 'LIGHTNING'
  | 'BEAM'
  | 'GROUND_FISSURE'
  | 'AURA'
  | 'SHIELD'
  | 'SHOUT_WAVE';
```

### 5.7 無效控制項處置

本次最低要求：

#### 必須補實作或移除 UI

- `coreMeshShape`
- `coreBrightness`
- `salvoSpreadAngle`
- `salvoSpreadRadius`
- `slashTrajectory`
- `slashAngleJitter`
- `slashAlternating`
- `shieldShape`
- `waveCount`
- `textureSprite`
- `bloomStr`
- `bloomRad`
- `bloomThresh`

#### 建議本次直接補實作

- `waveCount`：傳入 `buildTauntShoutGroup(waveCount)`，範圍 1～8。
- `shieldShape`：`buildHolyShieldGroup()` 依 shape 建立 HEX／CROSS_SHIELD／RUNE_RING。
- `coreMeshShape`：projectile factory 建立 sphere／diamond／arrow／star／ring。
- `coreBrightness`：套入 shader emissive／uniform 強度。
- `salvoSpreadAngle`、`salvoSpreadRadius`：使用 session RNG，確保固定 seed 可重現。
- `slashAngleJitter`、`slashAlternating`：只作用在多發視覺 slash，不改真正 hit 數。

#### 建議暫時隱藏

- Bloom 三欄：目前沒有 EffectComposer／UnrealBloomPass 正式管線。
- `textureSprite`：目前沒有正式 texture atlas repository。
- `spikeAlignToImpact`：需要明確方向向量契約後再做。

隱藏不等於刪除資料；舊 Preset 必須仍可讀取與匯出。

### 5.8 模式相關欄位顯示規則

- `cue.weight`：只有 `SPLIT_SINGLE_IMPACT` 顯示。
- `cue.isPrimary`：`PRIMARY_ONLY` 必顯示；其他模式可顯示但標示用途。
- `cue.targetPolicy`：只有功能完整且測試通過後顯示。
- Salvo 控制：只有 projectile／slash 且 `salvoCount > 1` 或使用者明確啟用 Salvo 時顯示。
- Fire turbulence：只有 fire renderer 顯示。
- Fresnel：只有 ice／fresnel shader 顯示。
- Shield shape：只有 shield renderer 顯示。
- Impact feedback：選取 Impact track 或 Cue 時顯示，不要常駐佔滿右欄。

### 5.9 Dirty、儲存與發布語意

明確區分：

- `草稿`：目前記憶體狀態。
- `儲存到瀏覽器`：Repository／LocalStorage override。
- `發布到專案`：寫入 `src/data/vfx_presets.json` 的開發工具功能。

UI 必須顯示目前狀態：

```text
未修改 / 有未儲存修改 / 已儲存本機 / 與專案 SSOT 不同 / 已發布
```

發布失敗不得只用 console；要顯示錯誤內容與未發布狀態。

Production build 若不存在寫檔 endpoint，隱藏「發布至專案 SSOT」，不要讓按鈕點擊後才失敗。

---

## 6. Runtime 收斂

### 6.1 不要名義上 canonical、實際仍播放 legacy preset

目前 model 有 `VFXSequence`／tracks／clips，但 `CombatFXEngine` 仍大量直接讀 `VFXPreset` 欄位並自行組成 mainTrack／secondaryTracks。

本次採漸進方案：

1. Repository 對外提供 resolved `VFXSequence`。
2. Legacy JSON load 後立即 migration。
3. Studio Store 編輯 sequence view model。
4. Combat runtime 播放 sequence。
5. 暫時保留 `VFXPreset` import/export adapter，禁止新增 legacy-only renderer 行為。

新增：

```ts
public getSequence(id: string): VFXSequence | undefined;
public saveSequence(sequence: VFXSequence): ValidationResult;
```

### 6.2 Track payload 必須包含真正可調欄位

目前 migration 會漏掉多個 slash／projectile 欄位。重新定義 payload：

```ts
export interface VFXSlashClipPayload {
  rendererType: 'SLASH';
  colorCore: string;
  colorRim: string;
  scale: number;
  angle: number;
  arcSpan: number;
  aspect: number;
  bladeWidth: number;
  radius: number;
  reverse: boolean;
  shape: 'CRESCENT' | 'CROSS' | 'WHIRLWIND';
  salvo?: {
    count: number;
    rhythm: SalvoRhythmCurve;
    angleJitter: number;
    alternating: boolean;
  };
}
```

```ts
export interface VFXProjectileClipPayload {
  rendererType: 'PROJECTILE';
  shape: 'SPHERE' | 'DIAMOND' | 'ARROW' | 'STAR' | 'RING';
  shaderMode: VFXShaderMode;
  colorCore: string;
  colorRim: string;
  coreBrightness: number;
  scale: number;
  spin: number;
  path: VFXTrajectoryPath;
  reverse: boolean;
  arcHeight: number;
  salvo?: {
    count: number;
    duration: number;
    rhythm: SalvoRhythmCurve;
    spreadAngle: number;
    spreadRadius: number;
  };
}
```

Inspector 只能編輯目前 payload 支援的欄位。

### 6.3 Renderer 不得依 Preset ID 判斷造型

移除類似：

```ts
preset.id.includes('WHIRLWIND')
preset.id === 'VFX_HOLY_SHIELD'
```

效果應由 `rendererType`／payload shape 決定。Preset ID 只做識別與綁定，不應控制渲染行為。

### 6.4 固定亂數

所有以下行為必須使用同一個 session RNG：

- 粒子方向
- 落點散佈
- angle jitter
- 地刺位置
- lightning path jitter

不得在 renderer 內直接使用 `Math.random()`。

相同 preset、seed、from、to、time 必須產生相同幾何快照。

---

## 7. 逐檔修改清單

### `src/models/VFX.ts`

- 將 `hitCount` 標記 deprecated。
- 補 `rendererType` 與明確 clip payload。
- 保留 legacy type 作 migration input，不再作新資料 authoring schema。
- `SkillVfxBinding` 保留 mode 與 cueMap。
- 避免 `VFXTrackType` 宣告與實際 `'COMPOSITE_LAYER' as any` 不一致；正式加入 union。

### `src/models/Combat.ts`

- `CombatImpactKind` 加入 `SHIELD_BREAK`、`STATUS`。
- 確認每個 impact event 可帶 actionId、impactIndex、impactCount、target snapshot。
- 若已有欄位，移除重複或不一致定義。

### `src/systems/CombatSystem.ts`

- actionId 改 deterministic counter。
- `SHIELD_BREAK` 納入 impact count/index。
- 被盾完全吸收時，不得保留會被當作 HP damage 呈現的零傷害 HIT；可保留事件但標記為非數值 visual，或只發 shield impact。
- 每個 action 的 impactIndex 必須穩定、連續且與 events 順序一致。

### `src/systems/combat/SkillVfxBindingRegistry.ts`

- 增加 `getBinding()`。
- LocalStorage schema v2。
- 相容 migration v1。
- 保存／還原 `impactPresentationMode` 與 `cueMap`。
- 比較完整 binding 決定是否為 override。

### `src/ui/fx/CombatActionPlayer.ts`

- `CombatAction` 增加 presentation mode／cueMap。
- mode 解析改以 binding 為權威。
- `mapImpactsToCues()` 實作 targetPolicy 與 kind compatibility。
- 支援 `SHIELD_BREAK`。
- presentation item 增加 per-target index/count。
- fallback mismatch 設為 degraded diagnostics。

### `src/ui/fx/adapters/CombatStageAdapter.ts`

- 不再把 totalHits 固定為 1。
- 依 presentation item 的 per-target index/count 套用輕擊／終擊反饋。
- 將 HP、shield、status、miss 分成不同 presenter。
- 只由 Adapter 建立 Cue 時間點跳字。

### `src/ui/fx/adapters/CombatStudioStageAdapter.ts`

- 與主遊戲 Adapter 使用相同 presentation helper。
- DOM selector／樣式可不同，語意與演算法不可不同。
- 移除只為讓測試通過而存在的相容 callback 計數。

### `src/ui/CombatUIManager.ts`

- 改用 action collector，不再向後掃描並修改 event。
- 移除 `absorbedBySkillCast` mutation。
- 移除 Action 完成後重複跳字。
- 加入無動畫的 final state reconciliation。

### `src/tools/CombatStudio.ts`

- 使用同一 action collector。
- mismatch／fallback／degraded 必須顯示在 Debug Overlay。
- 快速結束後不得留下上一個 action 的 FALLBACK 狀態。

### `src/tools/vfx-studio/VFXStudioStore.ts`

- 增加明確 selection state。
- selection 以 ID 而不是 index。
- 分開 draft dirty、browser saved、project published 狀態。
- Undo snapshot 只包含可編輯資料，不包含 selection／solo／lock 等 session UI 狀態。

### `src/tools/vfx-studio/VFXInspector.ts`

- 改為 capability-driven。
- 移除 normalize 值對顯示判斷的影響。
- range + number 共用 update。
- Cue weight／primary／policy 依模式顯示。
- 隱藏所有尚未實作的控制項。

### `src/tools/vfx-studio/VFXTimeline.ts` 與 `timeline/*`

- 只保留唯一 duration editor。
- Track／Cue selection 使用穩定 ID。
- 顯示 clip 超界。
- Cue marker 可鍵盤選取、刪除、左右微調。
- mode 改由 Binding Inspector 編輯；Preset timeline 可顯示預覽 mode，但不得成為 skill-specific SSOT。

### `tools/vfx-studio.html`

- 左欄移除 Slash／Salvo／Shield 等參數卡片。
- 右欄改成 Inspector mount point，由 schema 動態渲染。
- Legacy trajectory select 移除。
- 重複 duration range 移除。
- 所有按鈕補明確 `aria-label`／title。

### `src/styles/vfx-studio.css`

- 中央舞台優先，1440px 時不得被左右欄壓到只剩狹窄區。
- 左欄建議 280～320px，右欄 320～360px；中央設合理 `min-width`。
- 卡片內容預設收斂，不要所有區段完整常駐。
- 768px 以下改為 tab／drawer，不要單純把三欄垂直串成超長頁面。
- 避免大量 inline style，移到 CSS class。

### `src/ui/fx/CombatFXEngine.ts`

- `waveCount` 不再寫死。
- renderer 依 payload 而不是 Preset ID 分支。
- 補齊決定保留的有效參數。
- 隱藏欄位不得繼續被聲稱已支援。
- 清除所有 `as any` 的 wave／track 欄位存取。

### 驗證腳本

- `.mjs` 不得直接 import 無法解析的 `.ts` extensionless module。
- 可改用 `vite-node`，或將純驗證抽成可由 Vitest import 的 TypeScript。
- console error、page error、404、unexpected fallback 任一出現，process exit code 必須非 0。

---

## 8. 必須新增或修正的測試

### 8.1 Binding 測試

1. 同一 Preset 綁兩個技能：一個 EXACT、一個 SPLIT，播放結果不同但總傷害相同。
2. 自訂 mode 儲存、重新建立 registry 後仍存在。
3. 自訂 cueMap 儲存、重新載入後仍存在。
4. v1 LocalStorage 可遷移到 v2。

### 8.2 Cue mapping 測試

1. `PRIMARY_TARGET`：AOE 只有主目標得到該 visual Cue。
2. `EACH_TARGET`：每個實際目標各得到一份 Cue。
3. `CASTER`：Cue 指向 actor，且不挪用敵方 damage。
4. HEAL 不可配到 IMPACT Cue。
5. SHIELD_BREAK 可配到 SHIELD Cue。
6. VISUAL_ONLY 永遠 amount 0。
7. SPLIT 權重總和精確等於原始傷害。
8. weight 0 不承載數值。
9. fallback cue mismatch 產生 degraded diagnostics。

### 8.3 DOM 可觀察行為測試

使用 fake timer 或 Playwright 驗證：

1. 單段傷害只建立一個 `.floating-dmg`。
2. 三段 EXACT 依序建立三個數值，不在完成後補第四個。
3. SPLIT 503、權重 20/20/60，顯示值總和必須為 503。
4. PRIMARY_ONLY 前段不跳字，primary 只跳一次完整數值。
5. AOE 三目標各自只更新自己的 HP bar。
6. 每個目標最後 HP 與 report snapshot 相同。
7. 完全護盾吸收不顯示紅色 HP 傷害。
8. 破盾顯示 shield-break presentation。
9. Skip 後零殘留 timer、RAF callback、floating number、debug fallback。

### 8.4 Inspector 欄位生效測試

建立 production field-consumption contract：

```ts
expect(getVisibleInspectorKeys(selection)).toEqual(
  expect.arrayContaining(getRendererConsumedKeys(rendererType))
);

expect(getVisibleInspectorKeys(selection)).not.toContain(
  anyUnimplementedKey
);
```

每個可見控制項至少要有一項測試：

1. UI 修改值。
2. Store 值改變。
3. Renderer 收到新值。
4. 幾何、材質、排程或 DOM 結果出現可觀察差異。

不能只測 event listener 存在。

### 8.5 Duration 測試

1. UI 只有一個可編輯 duration control。
2. `0.28` 不會因初始化或 focus 變成 `0.30`。
3. 可輸入 `0.01` 精度。
4. 縮短 duration 時超界 Cue 不得無聲遺失。

### 8.6 Determinism 測試

1. 相同 seed 的完整 CombatReport 深度相等，包括 actionId。
2. 相同 VFX seed 的 scatter／jitter 幾何相同。
3. 不同播放速度結果與 Cue 順序相同。

### 8.7 瀏覽器驗收

驗證尺寸：

- 1440 × 900
- 1280 × 720
- 1024 × 768
- 768 × 900

除 zero overflow 外，必須驗證：

- 初始畫面舞台與播放按鈕可見。
- 選主軌只顯示相關 Inspector。
- 選 Cue 只顯示 Cue Inspector。
- 選 Binding 只顯示 Binding Inspector。
- 無 console error、page error、404。
- 所有操作完成後沒有 unexpected fallback。

---

## 9. 建議實作階段

### Phase 0：先固定失敗案例

- 為重複跳字、binding mode 失效、targetPolicy 失效、SHIELD_BREAK 缺失建立會失敗的測試。
- 修正驗證腳本，使錯誤真正回傳非 0。

完成條件：新測試在舊程式上明確失敗，且能指出錯誤結果。

### Phase 1：修正戰鬥呈現契約

- Binding schema v2。
- Action 使用 binding mode。
- targetPolicy、kind compatibility、SHIELD_BREAK。
- deterministic actionId。

完成條件：所有 mapping 純函式測試通過。

### Phase 2：消除雙重播放責任

- action collector。
- 移除 absorbed mutation。
- 移除播放後重複跳字。
- Adapter 使用正確 per-target presentation count。

完成條件：主遊戲與 Combat Studio 的 DOM 行為測試通過。

### Phase 3：Inspector 與欄位收斂

- Selection union。
- capability-driven Inspector。
- 唯一 duration。
- Legacy trajectory 隱藏。
- 無效控制項補實作或隱藏。

完成條件：畫面上不存在「調整後 runtime 不變」的控制項。

### Phase 4：Canonical sequence 漸進收斂

- Repository load-time migration。
- typed clip payload。
- renderer 改依 payload。
- Preset ID 特判移除。

完成條件：新建 Preset 不依賴 legacy 欄位也能在工房、戰鬥工房、主遊戲一致播放。

### Phase 5：完整驗收

- 全測試。
- 四種 viewport。
- 單體、AOE、治療、護盾、MISS、多段、拆分、終擊、Skip、WebGL failure。
- 更新文件，不得保留不實的「100% 完成」。

---

## 10. Definition of Done

以下條件必須全部成立：

- [ ] 技能 binding 的 mode 是正式 runtime 權威來源。
- [ ] 自訂 binding 的 mode 與 cueMap 可持久化。
- [ ] `PRIMARY_TARGET`、`EACH_TARGET`、`CASTER` 行為不同且有測試。
- [ ] 單段傷害只跳一次數字。
- [ ] 多段傷害每段只跳一次，完成後不補跳。
- [ ] Adapter 不再把每個 Cue 都視為最後一擊。
- [ ] SHIELD_BREAK 是正式 Impact。
- [ ] 零傷害與純視覺 Cue 不顯示 `-0`。
- [ ] 不再修改 report event 寫入 `absorbedBySkillCast`。
- [ ] actionId 在固定 seed 下可重現。
- [ ] UI 只有一個總時長控制器。
- [ ] Legacy trajectory 不再出現在 Inspector。
- [ ] 每一個可見參數均有正式 runtime consumer。
- [ ] 未實作參數不出現在 UI。
- [ ] Inspector 只顯示選取物件相關屬性。
- [ ] 768px 版面不是三個完整長面板直接串接。
- [ ] 工房、Combat Studio、主遊戲使用相同 mapping 與 playback pipeline。
- [ ] 所有測試腳本在發生 console error、404 或 unexpected fallback 時失敗。
- [ ] TypeScript 無錯誤。
- [ ] 完整測試、build、smoke test 通過。

---

## 11. 驗證命令

至少執行：

```powershell
npm run typecheck
npm test
npm run build
npm run test:vfx:layout
npm run test:vfx:soak
npm run test:smoke
npm run check:bundle
```

另外將失效的 Node 驗證腳本改為可執行形式後執行：

```powershell
node scripts/check-heavy-strike.mjs
node scripts/test-validate-ssot.mjs
node scripts/verify-phase6-combat-debug.mjs
node scripts/verify-combat-vfx-direction.mjs
node scripts/verify-human-interactions.mjs
```

若腳本需要 dev server，腳本本身應：

1. 使用明確且一致的 port。
2. 檢查 server ready。
3. 在 finally 關閉 server／browser。
4. 對 console error、page error、404、unexpected fallback 設定非 0 exit code。

---

## 12. Gemini 完成後的回報格式

請用以下格式回報：

```markdown
## 完成內容
- 實際修改的資料契約
- 實際修正的播放錯誤
- UI 移除／隱藏／補實作的欄位

## 逐檔摘要
- path: 修改內容

## 相容性
- Legacy preset migration
- LocalStorage binding migration
- 舊存檔／舊自訂特效影響

## 驗證結果
- command: PASS/FAIL
- 測試數量
- Browser console errors
- Unexpected fallback count

## 尚未完成
- 明確列出，不得使用「基本完成」「大致完成」等模糊字眼
```

若 Definition of Done 有任何一項未完成，不得宣稱「100% 完成」。

