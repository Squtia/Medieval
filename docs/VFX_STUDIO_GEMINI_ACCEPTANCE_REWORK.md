# 特效工房、戰鬥特效管線 Gemini 驗收返工規格

> 文件用途：將本輪驗收未通過項目交由 Gemini 修正。
>
> 驗收狀態：**不通過，禁止標記完成**。
>
> 適用專案：`D:\tryagent\Medieval`
>
> 前置規格：`docs/VFX_STUDIO_GEMINI_REFACTOR_IMPLEMENTATION.md`

---

## 1. Gemini 執行指令

請直接檢查並修改本專案，不要只輸出建議、示意碼或報告。

必須遵守：

1. 保留使用者現有未提交修改，不得 reset、checkout 或覆蓋無關檔案。
2. 先以測試重現本文件列出的失敗案例，再修改 production code。
3. 不得用放寬 assertion、刪除測試、吞掉 warning、`as any`、`as unknown as` 或假 callback 讓測試通過。
4. 戰鬥數值以 `CombatSystem` 已結算事件為唯一真相；VFX 只能決定何時、何處、如何呈現。
5. 不得因 Cue 數量、Cue kind、targetPolicy、WebGL failure 或 Skip 而遺失真實 impact。
6. 完成後執行第 12 節全部命令，任一命令非 0 即不得聲稱完成。
7. 修改完成後依第 13 節格式回報。

---

## 2. 本次驗收基線

已通過：

- TypeScript typecheck。
- 62 個測試檔、368 個測試。
- production build。
- 四種 viewport layout 腳本。
- 100-cycle VFX soak test。
- P0 smoke test。
- bundle budget：`3,807,997 / 4,000,000 bytes`。
- Heavy Strike、SSOT、Phase 6 Debug Overlay。
- Human interaction 驗證。

仍不得驗收的原因：

- 多 impact 少 Cue 時，runtime fallback cue 不會由引擎觸發，後段呈現可被吞掉。
- `SHIELD_DAMAGE` 使用錯誤 amount 欄位，Skip／WebGL failure 可漏掉護盾呈現。
- `PRIMARY_TARGET` 目前會連真實 AOE 副目標的數字呈現一起刪除。
- final reconciliation 只取每個 target 最後一筆事件，可能漏掉較早的 HP／MP／shield 快照。
- canonical `VFXSequence` 只有 façade，正式戰鬥仍走 legacy preset。
- 768px 仍為多個完整長面板縱向串接。
- Status presenter 遺失實際狀態文字。
- action collector 對非連續同 actionId 事件不能保持原始事件順序。
- `verify-combat-vfx-direction.mjs` 目前 exit code 1。
- 測試出現 unexpected fallback warning 時仍返回成功。

---

## 3. P0：修正 fallback impact 漏播

### 3.1 現況

`mapImpactsToCues()` 在 impact 多於 Cue 時建立：

```ts
originalIndex: effectiveCues.length + newIdx
```

但 `CombatFXEngine.playPresetConfig()` 只會回呼 Preset 真正存在的 Cue index。成功播放完成後，`CombatActionPlayer.playAction()` 沒有派發 `dispatchedItems` 以外的真實 presentation。

結果：例如 2 個真實 impact、1 個 Cue，只會顯示第一段。

### 3.2 必須修改

主要檔案：

- `src/ui/fx/CombatActionPlayer.ts`
- 必要時 `src/ui/fx/CombatFXEngine.ts`

必須將「實際 Cue 排程」與「真實 impact 保底派發」設計清楚。允許下列方案之一：

#### 方案 A：Player 排程 runtime fallback

- Preset 播放完成後，取得尚未派發的非 `VISUAL_ONLY` presentation。
- 依 fallback presentation 的時間順序，以同一 playback clock 排程。
- 不得在 action 結束後瞬間一次補跳全部數字。
- 必須保留 per-target `presentationIndex`／`presentationCount`。

#### 方案 B：Engine 接收 resolved runtime cues

- `playPresetConfig()` 改為接受 resolved Cue timeline，其中包含 fallback Cue。
- Engine 對原生與 fallback Cue 使用同一時間軸及 callback。
- 不得把 fallback Cue 寫回 Preset 或污染 Repository。

不論採用哪一方案，都必須保證：

```text
每一筆真實 impact 恰好派發一次
VISUAL_ONLY 可以零次數字呈現
已派發集合不得重複派發
成功、Skip、Preset 不存在、WebGL failure 的結果一致
```

### 3.3 必補測試

至少加入：

1. 2 impacts / 1 cue：兩筆依序呈現且各一次。
2. 4 impacts / 2 cues：四筆依序呈現且各一次。
3. 多目標且各有多段 impact：每個 target 的每段均呈現一次。
4. 成功播放、Skip、Preset missing、WebGL reject 四條路徑呈現集合一致。
5. runtime fallback 發生時 action 標記 degraded，測試必須明確斷言此狀態；不能只印 warning。

---

## 4. P0：建立統一 Impact amount resolver

### 4.1 問題

目前 damage、heal、shield 共用：

```ts
ev.damage || ev.healAmount || 0
```

正式護盾事件使用 `shieldDamage`，因此 `SHIELD_DAMAGE`／`SHIELD_BREAK` 可能得到 `amount = 0`。

### 4.2 必須修改

在 mapping 邊界建立單一純函式，不得在多處自行猜欄位：

```ts
function resolveImpactAmount(
  event: CombatEvent,
  kind: CombatImpactPresentation['kind']
): number {
  switch (kind) {
    case 'DAMAGE':
      return Math.max(0, event.damage ?? 0);
    case 'HEAL':
      return Math.max(0, event.healAmount ?? event.damage ?? 0);
    case 'SHIELD_DAMAGE':
    case 'SHIELD_BREAK':
      return Math.max(0, event.shieldDamage ?? event.damage ?? 0);
    case 'STATUS':
    case 'MISS':
    case 'VISUAL_ONLY':
      return 0;
  }
}
```

注意：

- 使用 `??`，不得使用 `||` 取代合法的 0。
- `SHIELD_BREAK` 可同時有數值與破盾文字。
- `SHIELD_DAMAGE` amount 為 0 時仍可有狀態／視覺呈現，但不得產生 `-0`。
- 不得只靠額外的 `shieldDamage` 欄位繞過錯誤 amount；presentation 的語意必須一致。

### 4.3 活躍 presentation 判定

建立共用 predicate，例如：

```ts
function shouldPresentImpact(item: CombatImpactPresentation): boolean {
  if (item.kind === 'VISUAL_ONLY') return false;
  if (item.kind === 'MISS' || item.kind === 'STATUS' || item.kind === 'SHIELD_BREAK') return true;
  return item.amount > 0;
}
```

Skip、Preset missing、正常播放補償、WebGL failure 必須全部使用同一 predicate，不得各寫一套 filter。

### 4.4 必補測試

- 普通護盾吸收。
- 護盾破裂。
- 護盾吸收後仍有 HP damage。
- Skip 下護盾數字與破盾提示存在。
- WebGL reject 下護盾數字與破盾提示存在。
- amount 為 0 不顯示 `-0`。

---

## 5. P0：分離 Visual Target 與 Logical Impact Target

### 5.1 規格澄清

`targetPolicy` 只控制 3D VFX 播放位置，不得刪除已結算的真實 impact。

正確語意：

| targetPolicy | 3D 主特效播放位置 | 真實數字／狀態呈現 |
|---|---|---|
| `PRIMARY_TARGET` | 只在主目標 | 每個實際 impact target 都保留 |
| `EACH_TARGET` | 每個實際目標 | 每個實際 impact target 都保留 |
| `CASTER` | actor | 敵方／友方真實 impact 仍在原 target 呈現 |

禁止行為：

- 把副目標傷害移到主目標。
- 因副目標沒有 Visual Cue 就丟棄其 presentation。
- 把敵方傷害挪到 caster。
- 為 Visual-only caster Cue 虛構 damage。

### 5.2 建議資料結構

將視覺觸發與邏輯呈現拆開，至少能表達：

```ts
interface CombatImpactPresentation {
  cueIndex: number;
  cueId: string;

  // 真實結算目標；數字、HP、status 必須使用此欄位。
  targetId: string;

  // 3D VFX 實際播放位置；可以是 primary、each target 或 caster。
  visualTargetId?: string;

  amount: number;
  kind: 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'SHIELD_BREAK' | 'STATUS' | 'MISS' | 'VISUAL_ONLY';
  isCrit: boolean;
  isPrimary: boolean;
}
```

如果選用其他結構，仍必須能獨立表達這兩種 target。

### 5.3 修正錯誤測試

目前 `VFXPipelinePhase0Defects.test.ts` 對兩個 AOE 真實 impact 搭配 `PRIMARY_TARGET`，只期待一筆 presentation。這個 assertion 必須改寫：

- 3D visual target 只有 `enemy_main`。
- logical presentations 同時包含 `enemy_main` 與 `enemy_sub`。
- 兩者 damage 總值與原始事件完全一致。

### 5.4 必補測試

- PRIMARY_TARGET + 2 個 AOE 目標。
- EACH_TARGET + 3 個目標。
- CASTER visual + 敵方 damage。
- CASTER visual + caster 自身 buff/status。
- 每種 policy 下，各 target damage sum 均等於原始事件。

---

## 6. P1：修正 final state reconciliation

### 6.1 問題

目前 `reconcileFinalActionState()` 對每個 target 只保留最後一筆事件。若最後事件是 `STATUS_APPLY`，較早的 HP／MP／shield snapshot 會遺失。

### 6.2 必須修改

對每個 target 分別追蹤最後一個具備對應資料的 snapshot：

```ts
interface TargetFinalSnapshot {
  hp?: { current: number; max: number };
  mp?: { current: number; max: number };
  shield?: { current: number; max?: number };
  dead: boolean;
}
```

掃描事件時：

- 有 `targetHp/targetMaxHp` 才更新 hp。
- 有 `targetMp/targetMaxMp` 才更新 mp。
- 有 `shieldRemaining` 才更新 shield。
- `DEATH`、HP <= 0 或正式死亡欄位都能設定 dead。
- 狀態事件不能覆蓋掉已收集的 HP snapshot。
- reconciliation 只改最終 HUD 狀態，不建立 floating DOM、不觸發 hit animation。

### 6.3 必補測試

- HIT 後接 STATUS_APPLY，仍校準 HIT 的 HP。
- MP 消耗後接 HIT，仍校準 MP。
- SHIELD_DAMAGE 後接 STATUS，仍校準 shield。
- 最終死亡樣式正確。
- reconciliation 不建立 `.floating-dmg`。

---

## 7. P1：Status presentation 必須保留正式內容

### 7.1 問題

`CombatStageAdapter` 目前建立 `text: ''` 的 dummy event，導致狀態只能顯示「狀態觸發」。

### 7.2 必須修改

`CombatImpactPresentation` 至少增加：

```ts
text?: string;
statusType?: CombatStatusType;
skillName?: string;
```

由原始 `CombatEvent` mapping 進 presentation，再由主遊戲與 Combat Studio adapter 共用相同 presenter 語意。

不得再建立會遺失語意的 dummy event。優先讓 presenter 直接接收 `CombatImpactPresentation`；若為相容性必須建立 event，也要完整傳遞 type、text、statusType、shield 欄位。

必補測試：

- STATUS_APPLY 顯示真實狀態名稱。
- STATUS_DAMAGE 顯示正確文字但不虛構第二筆傷害。
- 主遊戲與 Combat Studio 的文字語意一致。

---

## 8. P1：修正 action collector 的順序契約

### 8.1 問題

目前 collector 會把後方相同 actionId 的事件塞回先前 action，即使中間已有獨立事件，因而改變可觀察順序。

例如：

```text
A impact 1 → DEATH → A impact 2
```

不得輸出成：

```text
Action[A impact 1, A impact 2] → DEATH
```

### 8.2 必須先定義並實作契約

建議使用連續 action span：

- 相同 actionId 且中間沒有獨立 barrier event，可聚合為一個 CombatAction。
- `DEATH`、`WAVE_START`、`TURN_START`、`END` 等獨立事件為 barrier。
- barrier 後再次出現相同 actionId，建立新的 playback segment，但可保留相同 logical actionId。
- 不修改原始 `CombatEvent`。
- flatten collector 結果後，事件順序必須與輸入一致。

必補 property assertion：

```ts
flatten(collectCombatActions(events)) === events
```

比較時應以物件 identity 或明確 event sequence ID 驗證，不得只比較 event type。

---

## 9. P1：Canonical VFXSequence 必須進入正式 runtime

### 9.1 問題

目前 Repository 可以將 legacy preset 即時轉成 sequence，Engine 也有 `playSequence()`，但正式 Player 仍呼叫 `getPreset()` 與 `playPresetConfig()`。這只是 façade，不是 canonical runtime。

### 9.2 必須修改

最低要求：

1. Repository load 時把 legacy preset migration 成 canonical sequence，並以 sequence 作 resolved SSOT。
2. `CombatActionPlayer` 正式取得 `getSequence(vfxId)`。
3. 主遊戲、Combat Studio、VFX Studio preview 最終都進入 `playSequence()`／共同 evaluator。
4. Legacy preset 只能存在於 migration/import/export adapter 邊界。
5. 不得在每次 `getSequence()` 都臨時從 legacy preset 重新轉換，否則 legacy 仍是權威來源。
6. 新建 sequence 即使完全沒有 legacy trajectory、impact、layers 等欄位，也必須可播放。
7. production code 移除 `as unknown as VFXPreset` fallback。

### 9.3 必補整合測試

建立一個只含 canonical schema 的新 Sequence：

- 不提供任何 legacy-only 欄位。
- 存入 Repository。
- VFX Studio 可載入與預覽。
- Combat Studio 可播放。
- 主遊戲 `CombatActionPlayer` 可播放。
- 三者 Cue 數量、時間、target policy、顏色與 duration 一致。

只測 `sequenceToLegacyPreset()` round trip 不算完成此項。

---

## 10. P1：重做 768px 工作流

### 10.1 驗收現況

`docs/screenshots/vfx_studio_768x900.png` 顯示素材庫、舞台、時間軸、Inspector 仍以完整長面板縱向串接。Inspector 不在首屏工作範圍。

### 10.2 必須修改

在 `<= 900px` 建立明確工作區切換：

```text
[素材] [舞台] [時間軸] [屬性]
```

要求：

- 一次只顯示一個主要編輯面板，或舞台固定、其他面板以 drawer/tab 切換。
- 切換不丟失 selection、timeline cursor、solo/mute/lock 與未保存 draft。
- Play、Pause、Stop、總時長與目前時間保持可達。
- Inspector 不得只能靠捲動數個 viewport 才能操作。
- 觸控目標至少約 40px。
- 不新增第二套手機版 editor state。

### 10.3 桌面版資訊密度

1440px 目前仍有大量雙語標籤與緊密控制器。請至少做到：

- 主要欄位顯示中文短標籤；英文術語放 tooltip 或次要說明。
- 數值、單位與 slider 對齊。
- capability 不適用的 section 完全隱藏。
- 最常調整的 5–8 項置頂，其餘放進進階區。
- 不得再出現調整後 runtime 無差異的控制項。

### 10.4 Layout 測試不得只測無溢位

768px 測試必須額外斷言：

- 存在工作區 tab／drawer 控制。
- 預設最多一個主要側面板可見。
- 切到 Inspector 後相關欄位進入 viewport。
- 切回舞台後 canvas 與播放控制仍可操作。

---

## 11. 型別與診斷清理

### 11.1 CombatImpactKind

目前同時存在：

```ts
'STATUS'
'STATUS_APPLY'
```

請統一語意：

- `CombatEventType.STATUS_APPLY` 是事件來源。
- presentation kind 統一使用 `'STATUS'`。
- 從 `CombatImpactKind` 移除重複的 `'STATUS_APPLY'`，除非能提出並測試兩者不同的 renderer 行為。

### 11.2 Unexpected fallback 必須失敗

驗證腳本與測試必須區分：

- 明確安排且有 assertion 的 degraded/fallback：允許。
- 未預期 fallback：測試失敗。

不得只 `console.warn()` 後讓 suite 綠燈。建議在測試環境集中攔截特定 warning，沒有測試明確宣告 `expectDegraded: true` 時直接 throw。

### 11.3 外部資源錯誤

`verify-combat-vfx-direction.mjs` 因外部字型 `ERR_NETWORK_ACCESS_DENIED` 返回 1。

請採用下列其中一種正式解法：

- 測試環境封鎖並明確分類已知外部字型請求，與應用資源錯誤分開；或
- 將必要字型本地化；或
- 測試頁面不載入非必要外部字型。

不得廣泛忽略所有 `Failed to load resource`，本地 JS、CSS、JSON、texture、404 仍必須使腳本失敗。

---

## 12. 完整驗證命令

依序執行：

```powershell
npm run typecheck
npm test
npm run build
npm run test:vfx:layout
npm run test:vfx:soak
npm run test:smoke
npm run check:bundle
node scripts/check-heavy-strike.mjs
node scripts/test-validate-ssot.mjs
node scripts/verify-phase6-combat-debug.mjs
node scripts/verify-combat-vfx-direction.mjs
node scripts/verify-human-interactions.mjs
```

額外必須執行針對性測試：

```powershell
npx vitest run src/systems/combat/VFXPipelinePhase0Defects.test.ts
npx vitest run src/systems/combat/VFXPipelinePhase3Inspector.test.ts
npx vitest run src/systems/combat/VFXPipelinePhase4CanonicalSequence.test.ts
```

全部必須 exit code 0，且不得出現未被測試明確預期的：

- fallback／degraded warning。
- browser console error。
- page error。
- 404。
- unhandled rejection。
- WebGL failure 導致 action 未完成。

---

## 13. 最終 Definition of Done

以下全部勾選後才可提交驗收：

- [ ] 真實 impact 在正常播放、Skip、Preset missing、WebGL failure 下均恰好呈現一次。
- [ ] 2 impacts / 1 cue 不漏播第二段。
- [ ] `SHIELD_DAMAGE` 與 `SHIELD_BREAK` 使用正確 shieldDamage。
- [ ] 所有路徑共用同一 `resolveImpactAmount()` 與 `shouldPresentImpact()`。
- [ ] `PRIMARY_TARGET` 只限制主 3D 特效，不吞 AOE 副目標數字。
- [ ] `EACH_TARGET` 與 `CASTER` 有不同且正確的視覺行為。
- [ ] 每個 logical impact 保留原 target，所有 target 的數值總和守恆。
- [ ] final reconciliation 分別使用最後有效 HP／MP／shield snapshot。
- [ ] reconciliation 不建立跳字或動畫。
- [ ] Status 顯示原始狀態名稱／文字。
- [ ] flatten action collector 結果保持原始事件順序。
- [ ] presentation kind 不再有 `STATUS`／`STATUS_APPLY` 重複語意。
- [ ] CombatActionPlayer 正式使用 canonical sequence runtime。
- [ ] 純 canonical、無 legacy 欄位的新特效可在三個入口一致播放。
- [ ] production code 不以 `as unknown as` 偽造 VFXPreset。
- [ ] 768px 使用 tab／drawer 工作流，不是完整長面板串接。
- [ ] Inspector 可見欄位都有 runtime consumer。
- [ ] unexpected fallback 會令測試失敗。
- [ ] 所有第 12 節命令 exit code 0。

---

## 14. Gemini 完成後回報格式

請嚴格使用：

```markdown
## 修改摘要
- 實際修正內容

## 根因與設計決策
- fallback 漏播根因
- visual target / logical target 的資料模型
- canonical runtime 的正式入口
- 768px 工作流設計

## 修改檔案
- `path/to/file.ts`：修改原因與行為

## 新增或修正測試
- 測試名稱：覆蓋案例

## 驗證結果
- `command`：PASS/FAIL、測試數量或關鍵輸出

## 未完成項目
- 必須如實列出；若存在任一項，不得宣稱 100% 完成
```

---

## 15. 禁止以此類結果宣稱完成

以下皆不算完成：

- 單元測試通過，但仍有 unexpected fallback warning。
- 只確認 HP 最終正確，卻漏掉中途數字或護盾提示。
- PRIMARY_TARGET 測試只斷言主目標存在，沒有斷言副目標真實 impact 被保留。
- 只新增 `playSequence()` 方法，但正式 runtime 沒有呼叫它。
- 只測 canonical/legacy 互轉，沒有從主遊戲實際播放純 canonical sequence。
- 768px 沒有水平 overflow，但仍需長距離垂直捲動才能到 Inspector。
- 驗證腳本因網路、字型或 browser console error 返回非 0。
- 用 type assertion、dummy event 或補 callback 計數掩蓋缺失資料。

本輪返工重點不是增加更多 façade，而是讓「結算事件 → action mapping → canonical timeline → adapter presentation → final reconciliation」真正形成一條不漏資料、可驗證且三端一致的正式管線。
