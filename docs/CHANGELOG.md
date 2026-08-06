# 遊戲更新日誌 (Changelog)\n\n## [2026-08-05] UI 架構模組化與事件系統準備\n\n### Refactoring (UI)\n\n- **[UI/Modal] 徹底拆解 ModalController (Phase 4 完工)**\n  - 將原本高達上千行的 ModalController.ts 徹底解耦。\n  - 抽離 NodeDetailModalController、DispatchModalController、EventModalController、TodoModalController、CombatHistoryModalController、PrisonerModalController。\n  - 原有 ModalController.ts 全面改為輕量級的 Facade 入口 (動態載入對應模組)。\n\n### Systems\n\n- **[System/Event] 探險事件系統支援 (Phase 1 完工)**\n  - 新增 NarrativeData.ts 定義隨機文本池。\n  - 擴充 EventSystem.ts，支援透過 GAME_EVENT_TRIGGERED 派發動態事件，並無縫整合至剛抽離的 EventModalController 中。\n

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
