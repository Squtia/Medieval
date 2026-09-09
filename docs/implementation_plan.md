# 🎆 特效工房彈道視覺效果、Shader 全面升級與圖層空間軌跡修復計畫

## 背景與目標

特效工房 (VFX Studio) 目前面臨兩大核心問題：
1. **視覺品質與材質缺陷**：天雷、冰槍、隕石、地刺等元素特效大量使用 `MeshBasicMaterial` + `AdditiveBlending`，缺乏專屬 Shader 與質感；且部分材質未關閉 `depthWrite` 導致透明穿透挖空或前後圖層順序紊亂。
2. **子圖層空間軌跡斷點（如：風暴狂雷變 A>B 直線雷射）**：在複合技能（例如巨力重劈）中切換子圖層為「風暴狂雷」時，由於素材選取回退邏輯未正確映射 `trajectory: "VERTICAL_DROP"`，導致 `spatialMode` 被錯誤硬塞為 `'A_TO_B'`，落雷起點誤拉至施術者胸口，退化為水平雷射。

本次實作將同時徹底修復圖層空間模式推導、圖層渲染遮擋與排序機制，並為核心元素撰寫次世代 GLSL Shader 與動態彈道。

---

## 🔍 問題診斷與架構分析

### 1. ⚡ 子圖層空間模式推導斷點（A>B 直線雷射病灶）
- **斷點檔案**：[`src/tools/vfx-studio/timeline/TimelineInteraction.ts:L706-L713`](file:///d:/tryagent/Medieval/src/tools/vfx-studio/timeline/TimelineInteraction.ts#L706-L713)
  - 切換素材時使用 `spatialMode: targetPreset.spatialMode || 'A_TO_B'`。
  - 「風暴狂雷」等預設只有 `trajectory: "VERTICAL_DROP"`，未定義 `spatialMode`（為 `undefined`），觸發 fallback 被硬塞成 `'A_TO_B'`。
  - 同時漏掉了 `trajectory: targetPreset.trajectory` 的拷貝。
- **渲染斷點**：[`src/ui/fx/CombatFXEngine.ts:L491-498`](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L491-L498) 與 [`L961`](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L961)
  - 檢測到 `track.spatialMode === 'A_TO_B'`，判定為橫向穿透，強制將起點設為 `casterPos`（施術者 A），導致垂直落雷變成從 A 射向 B 的直線雷射。
  - `playPresetWorld` 調度時直傳父技能的 `startPos`（A 點），未針對 `VERTICAL_DROP` 做天頂校準。

### 2. 🪟 圖層遮擋、Z-Buffer 挖空與排序問題
- **深度寫入衝突**：在 [`MeshLayerRenderer.createFresnelShaderMaterial`](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts#L106-L143) 等材質中，雖然開啟了 `transparent: true`，但未關閉 `depthWrite: false`。半透明幾何體將深度寫入 Z-Buffer，導致後方同深度或穿插的粒子、法陣被 Depth Test 扣除／切除。
- **缺乏 `renderOrder` 明確分層**：多軌道在相同或鄰近深度缺乏明確的繪製先後順序（地面法陣 ➔ 主彈道 ➔ 拖尾 ➔ 受擊爆散），易導致圖層跳動。

### 3. 🎨 核心元素 Shader 質感低落
- **天雷 (`DIELECTRIC_LIGHTNING`)**：每幀重新建立 `TubeGeometry`，無 GLSL Shader，無分支電弧，像單調藍色水管。
- **冰槍 (`FRESNEL_ICE`)**：低多邊形錐體，無冰霜晶瑩流動與折射，飛行無冰晶寒氣拖尾。
- **火焰/隕石 (`VOLUMETRIC_FIRE`)**：頂點只有 sin/cos 位移，無真正 Simplex Noise 與黑體輻射（White Hot → Yellow → Orange → Red → Smoke）溫度場。
- **地刺 (`EARTH_SHATTER`)**：純色錐體，無岩石碎裂紋理與破土彈性回彈。

---

## 🛠️ Proposed Changes

### 階段 1：圖層空間軌跡與深度遮擋防線修復

#### [MODIFY] [`src/tools/vfx-studio/timeline/TimelineInteraction.ts`](file:///d:/tryagent/Medieval/src/tools/vfx-studio/timeline/TimelineInteraction.ts)
- **修正素材切換之空間模式解析**：
  - 引入 `resolvePresetSpatialMode(preset)` 輔助函式：
    - 若 `preset.spatialMode` 存在則使用；
    - 否則若 `preset.trajectory === 'VERTICAL_DROP'` ➔ 映射為 `'VERTICAL_SKY_TO_B'`；
    - 否則若 `preset.trajectory === 'DIAGONAL_DROP'` ➔ 映射為 `'DIAGONAL_SKY_TO_B'`；
    - 否則若為原地類（`AT_TARGET` / `MELEE_SWEEP` / `GROUND_BURST`）➔ 映射為 `'AT_TARGET'`；
    - 僅在真正屬於彈道類時才 fallback 為 `'A_TO_B'`。
  - 同步拷貝 `trajectory: targetPreset.trajectory`，避免軌跡遺失。

#### [MODIFY] [`src/ui/fx/CombatFXEngine.ts`](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts)
- **強化落雷天頂起點決策**：
  - 在 `shader === 'DIELECTRIC_LIGHTNING'` 的起點推導中，若 `track.preset?.trajectory === 'VERTICAL_DROP'` 或圖層 trajectory 為 `VERTICAL_DROP`，嚴格強制 `lightningStart = new THREE.Vector3(targetPos.x, targetPos.y + 380, targetPos.z)`。
  - 在 `playPresetWorld` 中，若子圖層的 Preset 屬於 `VERTICAL_DROP`，將調度起點校準為目標天頂，消除 A>B 橫向直射。
- **統一 `renderOrder` 排序**：
  - 地面法陣/地裂：`renderOrder = 1`
  - 主彈道/冰晶/落雷：`renderOrder = 5`
  - 拖尾/光環：`renderOrder = 8`
  - 爆散粒子/衝擊波：`renderOrder = 10`

---

### 階段 2：GLSL Shader 核心庫與材質升級

#### [MODIFY] [`src/ui/fx/renderers/MeshLayerRenderer.ts`](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts)
- **全域半透明材質深度規範**：所有自定義 ShaderMaterial 嚴格宣告 `transparent: true`, `depthWrite: false`, `depthTest: true`（或特殊不遮擋場景 `depthTest: false`）。
- **新增 4 大專屬 GLSL ShaderMaterial**：
  1. `createProceduralLightningShader()`：3D 程式化電弧 Shader，帶核心白熾與冷藍邊緣電離輝光、高頻隨機脈動。
  2. `createAdvancedIceShaderMaterial()`：晶瑩菲涅爾冰霜 Shader，含時間驅動的冰晶折射流動與內部微光散射。
  3. `createVolumetricBlackbodyFlameMaterial()`：真正 3D Simplex Noise 驅動的黑體輻射火焰 Shader，具備白熾芯到暗紅焦黑的完整溫度色階。
  4. `createRockCragShaderMaterial()`：破土尖岩 Shader，多層 Noise 疊加模擬粗糙岩石表面與高光裂隙。

- **幾何體與動畫升級**：
  - `updateLightningTube`：加入 2~3 條動態隨機分支電弧與地面電離環。
  - `updateFresnelIce`：幾何體細分提升，新增旋轉冰環多重折射與拖尾寒氣。
  - `updateEarthShatter`：岩石幾何加入超調彈性破土（Overshoot Easing）與碎裂傾角。

---

### 階段 3：驗證與自動化測試防線

#### [NEW] [`src/ui/fx/VFXSpatialLayering.test.ts`](file:///d:/tryagent/Medieval/src/ui/fx/VFXSpatialLayering.test.ts)
- 測試 1：切換「風暴狂雷」作為次生圖層時，`spatialMode` 正確對應為天降模式，絕不退化為 `A_TO_B`。
- 測試 2：落雷 Shader 求值時起點必定來自高空天頂（`y >= targetPos.y + 300`），而非施術者胸口。
- 測試 3：所有新增 Shader 材質的 `depthWrite` 嚴格為 `false`，確保無 Z-Buffer 透明裁切缺陷。

---

## 驗證計畫

### 自動化測試
```bash
npx vitest run src/ui/fx/VFXSpatialLayering.test.ts
npx vitest run src/tools/vfx-studio/VFXConsistency.test.ts
npm test
```

### 手動與畫面驗證
1. 開啟特效工房（`tools/vfx-studio.html`）。
2. 載入「巨力重劈」，新增子圖層並切換為「風暴狂雷」。
3. 播放並拖曳時間軸：
   - 觀察落雷是否自受擊目標正上方天頂垂直劈落。
   - 確認不再出現從左側施術者拉往右側目標的直線雷射。
   - 檢查重疊處是否無黑框挖空現象。
