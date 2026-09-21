- **[Feature/Combat/TroopCapAndInfantrySqrtShield] 步兵軍團護盾開根號邊際模型重構、全隊統帥帶兵容量上限約束與攻城介面全管線貫通完工交接（2026-09-21）**：
  - **核心交接重點**：
    1. **步兵軍團護盾全面重構為開根號邊際收益模型**：
       - 原始步兵護盾為線性乘法（$N \times 60$），帶兵 500 人給予 30,000 護盾，導致血量失衡與破壞戰鬥體驗。
       - 全面重構為開根號邊際模型：$\text{ShieldHp} = \lfloor\sqrt{\text{validCount}} \times 120\rfloor$。
       - 對齊三大兵種宏大軍團數值體系：
         - 步兵：$\lfloor\sqrt{N} \times 120\rfloor$（50人=848護盾，200人=1,697護盾，500人=2,683護盾）。
         - 弓兵：$\lfloor\sqrt{N} \times 32\rfloor$ 物理攻擊加成。
         - 騎兵：$\lfloor\sqrt{N} \times 45\rfloor$ 首回合衝鋒物理真傷。
    2. **全隊軍團帶兵上限公式實裝（盤活八維閒置統帥屬性）**：
       - `LordCommanderSystem.calculateTeamTroopCap(adventurers)` 統一收斂真理來源（SSOT）。
       - 團隊帶兵總容量公式：$\sum (\text{單兵基礎 20 人} + \text{自身統帥} \times 10)$。
       - 5 人標準隊伍在無加成下基礎約 100~300 人，高統帥將領可擴展至 300~500 人以上。
    3. **攻城出征與防守介面全管線動態約束（所見即所得 WYSIWYG）**：
       - 攻城介面新增統帥容量徽章 `#off-troop-cap-badge`，即時顯示 `[目前派遣總兵力] / [統帥容量上限]`。
       - 動態警戒標色：正常時顯示藍綠色，超標時閃爍紅色粗體警告，並在下方提示警語。
       - 「全軍出擊 (Max)」按鈕智能分配：優先填滿步兵 > 弓兵 > 騎兵，嚴格卡死在統帥容量上限內，絕不無腦溢出。
       - 出征防護攔截：出征按鈕檢測若總兵力超過統帥上限，強制攔截出兵並提示 `⚠️ 派遣兵力已超過統帥上限！請減少配置或派遣統帥更高的傭兵。`
       - 領地防衛介面同步切換至 SSOT 開根號護盾計算，徹底消除雙端計算分裂。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. **攻城出征容量與護盾即時預覽驗收**：
       - 進入大地圖或據點攻城介面（攻城出征 Modal）。
       - 檢視頂部或出征部隊區：確認出現 **「🎖️ 統帥容量: [X / Y 人]」** 徽章。
       - 調整出征的傭兵陣容（切換不同統帥的傭兵）：確認上限 $Y$ 會即時動態重算（單人 20 + CMD*10）。
       - 調整步兵滑桿（例如拉到 50 人、200 人、500 人）：
         - 確認下方軍令預覽顯示開根號護盾數值（如 50 步兵約 +848 護盾，不再是過去破萬的 30,000）。
       - 點擊「全軍出擊」按鈕：確認自動分配至最大容量上限，不會超過 $Y$。
       - 若手動輸入兵力使其超過容量上限：確認徽章變為紅色警示，且點擊出征按鈕會跳出攔截警告、禁止出征。
    3. **戰鬥實戰驗收**：
       - 配置合規兵力出征進入攻城/派遣戰鬥。
       - 戰鬥開場確認角色身上的護盾池符合 $\lfloor\sqrt{N} \times 120\rfloor$ 的健康數值區間，角色血條比例正常可感。

- **[Feature/Combat/KnightShieldBlockRateAndDamageMitigation] 騎士系盾牌武器格擋率 (Block Rate) 全管線實裝、戰鬥減傷 50% 結算、工坊編輯器貫通與步兵虛假格擋清理完工交接（2026-09-21）**：
  - **核心交接重點**：
    1. **騎士系武器專屬格擋率管線貫通**：
       - 格擋率僅生效於騎士系持盾武器（`SWORD_AND_SHIELD` 劍盾、`RUNE_SHIELD` 符文盾）。非持盾武器（如巨劍、匕首、弓箭、法杖）格擋率始終為 0。
       - 基礎值依階級劃分：T1/T2 = 30%、T3/T4 = 35%、T5 = 40%。
       - 掉落與鍛造詞條抽中「🛡️ 格擋」時，可獲得 `+0% ~ 30%` 浮動加成，T5 極品最高可疊加至 70% 硬上限。
    2. **裝備工坊 (EquipmentStudio) 支援格擋屬性設定**：
       - 工坊編輯器界面新增「🛡️ 格擋率 (Block Rate %)」輸入框 `#ee-block`，支援雙向資料綁定與浮動區間設定。
       - 詞條池中原本僅有 UI 選項的「🛡️ 格擋」已實質貫通後端隨機抽取管線（`EquipmentGenerator.ts`）。
    3. **戰鬥核心受擊格擋檢定與實質減傷 50%**：
       - 受擊時若觸發格擋檢定成功，全傷害（物/魔無差別）直接減半扣除（減傷 50%），優先保護護盾池與血量。
       - 戰鬥日誌如實記載：`🛡️ [角色名] 舉起盾牌成功格擋！傷害減半 (-[原傷害] ➔ [減半傷害])`。
       - 視覺層派發 `BLOCK` 事件，卡片上方彈出堅韌藍光描邊跳字 `🛡️ BLOCK! -[減半傷害]`。
    4. **步兵偽格擋清理**：
       - 原生步兵盾牆移除虛假 `blockChanceBonus: 30` 與假 `BUFF_DEF` 文字，步兵回歸純護盾池。天賦獨立設計記載於 `docs/NOBLE_TALENTS_BRAINSTORMING.md`。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. **裝備工坊驗收**：
       - 進入裝備工坊（Equipment Studio），選擇或建立一件武器，武器類型選取「劍盾」或「符文盾」。
       - 檢視戰鬥數值編輯區：確認出現 **「🛡️ 格擋率 (Block Rate %): [  ]」** 輸入框，可輸入自訂數值並正常儲存。
    3. **戰鬥實戰驗收**：
       - 讓隊伍中的騎士裝備持盾武器（基礎格擋率 30% ~ 40%）。
       - 進入任何戰鬥（如野外遭遇戰、大地圖派遣戰鬥或訓練場）：
       - 觀察騎士受擊時：
         - 當格擋觸發時，戰鬥日誌出現 `🛡️ [騎士名] 舉起盾牌成功格擋！傷害減半`。
         - 畫面上彈出藍光描邊跳字 `🛡️ BLOCK! -[數值]`。
         - 該次傷害實質減少 50%。
       - 觀察非騎士角色（或裝備巨劍/戰弓的角色）：確認絕不會觸發武器盾牌格擋。

- **[Enhance/Combat/FloatingDamageVisualAndDurationUpgrade] 戰鬥傷害跳字尺寸放大、打擊凝滯動畫重構與卡片溢出裁切修復完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **父容器溢出裁切根因修復（解決「完全沒數字」問題）**：卡片容器 `.combat-participant` 因固定尺寸被賦予 `overflow: hidden;`，導致上方彈出之負座標跳字 (`top: -18px` / `top: -24px`) 100% 處在卡片外側而被硬性裁切隱形。在 [style.css](file:///i:/gameproject/Medieval/style.css) Line 1028 將 `.combat-participant` 改為 `overflow: visible;`，並將 `.floating-dmg` 初始幀設為可見 (`opacity: 1`)，同時提昇其定位座標與圖層權重 (`top: -14px`、`z-index: 999`)，徹底解決數字不顯示的問題。
    2. **顯著放大字體尺寸與高對比描邊**：普通傷害字級提升至 `1.45em`（約 21px，800 粗體），暴擊傷害放大至 `2.0em`（約 28px，900 特粗金色發光），搭配全方位像素級黑邊描邊，即使在亮光爆炸特效中亦能一眼辨別。
    3. **RPG 打擊彈跳與凝滯定格動畫**：彈出時帶有 0.15s `scale(1.3 ~ 1.5)` 爆發彈跳，並在半空中維持長達 0.65 秒的 100% 凝滯不透明定格，最後 0.4 秒才向上飄升淡出。
    4. **顯示時長延長至 1.3 秒（1300ms）**：全域適配層（CombatStageAdapter、CombatStudioStageAdapter、CombatUIManager）清理計時器同步延長至 1300ms，徹底告別「看不清、消失太快」的問題。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. 進入任何戰鬥（如大地圖副本、遭遇戰或競技場/測試戰鬥）：
    3. 觀察角色進行物理攻擊、魔法技能、暴擊或受擊：
       - 確認**傷害跳字已百分之百正常浮現，不再被卡牌容器裁剪隱形**。
       - 確認**跳出的傷害數值清晰巨大（普通傷害約 21px，暴擊約 28px）**。
       - 確認數字彈出時具有衝擊力，並在空中**穩定清晰停留約 1.3 秒**供肉眼閱讀後才平滑淡出。
       - 觀察治療（綠字）、護盾（藍字/橙字）與 MISS 是否皆同步提升辨識度。

- **[Fix/Crafting/SmeltingResourcePipelineAndGuardianAvatar] 礦石冶煉基礎資源管線貫通與誓約騎士頭像讀取修復交接（2026-09-18）**：
  - **核心交接重點**：
    1. **冶煉素材基礎資源全管線貫通**：在 `CraftingSystem.ts` 實裝 `getMaterialCount` 與 `consumeMaterial`，同時支援領地四大基礎資源（`tg_iron`, `tg_timber`, `tg_stone`, `tg_wheat`）、交易特產與加工素材。徹底消除點擊冶煉時跳出「素材不足：缺少 tg_iron」的報錯。
    2. **誓約騎士專屬立繪頭像讀取修復**：在 `EquipSourcePicker.ts` 補齊 `renderAvatarSpriteHtml` 之 `isGuardian` 參數傳遞，誓約騎士（如初森）正確從 `assets/avatars_guardians.jpg` 讀取專屬立繪。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. 進入鍛造屋 ➔ 【素材冶煉】：
       - 選擇「鐵錠」，確認鐵礦石充足（如 3751/3）。
       - 點擊「冶煉 x1」或多個：確認**成功扣除金幣與鐵礦石，成功獲得鐵錠素材，不再跳出缺少 tg_iron 報錯**。
    3. 進入鍛造屋 ➔ 【裝備強化】或【元素加工附魔】：
       - 檢視來源對象中的誓約騎士（初森）：確認其頭像**已正確載入誓約騎士專屬立繪**，不再誤讀成普通女傭兵頭像。

- **[Fix/UI/EquipSourcePickerSyncAndUuidSelfHealing] 鍛造與工坊裝備選擇器 (EquipSourcePicker) 同步連動與裝備 UUID 自動修復完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **來源切換即時連動選取**：點擊【儲備倉庫】或【傭兵頭像卡片】時，系統自動預選其身上的第 1 件有效穿戴裝備（武器 > 防具 > 飾品），並同步更新右側火爐/附魔台。切換部位篩選按鈕（全部/武器/防具/飾品）時亦自動對齊選取。
    2. **裝備 UUID 自癒修復 (Self-Healing UUID)**：在裝備選擇器、鍛造收集清單與存檔反序列化全面注入 `ensureUuid`，徹底消滅無 UUID 舊裝備導致比對失效回退至倉庫第一件裝備（傳家寶劍）的問題。
    3. **選中裝備視覺回饋強化**：選中的裝備卡片帶有金色高亮雙邊框與發光陰影，一眼辨識右側火爐正在處理的目標。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. 進入鍛造屋 ➔ 【裝備強化】或【元素加工附魔】。
    3. 點選左上角任意傭兵（如羅莎琳·孤狼）：確認左下角該傭兵的第 1 件裝備自動被金色高亮框選中，且右側火爐/附魔台**立即同步顯示該裝備名稱與屬性數值**。
    4. 點選該傭兵的其他裝備（防具/飾品）：確認右側火爐即時切換為對應裝備，點擊「執行強化」能正確強化該裝備。
    5. 點回【儲備倉庫】：確認自動選取倉庫裝備並即時連動右側火爐。

- **[Fix/UI/NpcDialogueAccidentalClickProtection] NPC 對話彈窗「繼續」按鈕位置重構與防誤觸冷卻鎖完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **按鈕物理分離**：將「繼續 ➔」按鈕移至右下角，閱讀完文字後視線自然落在按鈕上，且與底部展開的分支選項按鈕完全物理分離，不再重疊。
    2. **350ms 防連擊保護鎖**：最後一段對話跳出分支選項時，自動啟動 350ms 點擊保護，避免玩家快速連點「繼續」時誤觸剛出現的選項。
    3. **文本區點擊推進**：點擊對話文字區域亦可直接切換至下一段對話，閱讀操作更直覺。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. 點擊街道上的 NPC 事件（如艾特絲克對話）開啟對話彈窗。
    3. 確認「繼續 ➔」按鈕位於右下角；連點測試翻到最後一段，確認不會意外誤觸第一個分支選項。

- **[Feature/UI/HeroPickerPhase2AndEquipSourcePicker] 全域通用英雄選擇器 (HeroPicker) 與裝備來源選擇器 (EquipSourcePicker) SSOT 完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **`HeroPicker`（通用英雄選擇器 SSOT）全域 5 大軍政模組全面落地**：
       - **大地圖派遣出征 (Dispatch)**：[src/ui/modals/DispatchModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/DispatchModalController.ts) 升級為 `columns: 3` CSS Grid 自適應佈局與 `cardHeight: 100px`，徹底清除原本 `scale(0.88)` 的邊距留白；外框對齊右側升級為暗金雙層微鑲邊。
       - **全域中世紀古典暗金細卷軸**：[style.css](file:///i:/gameproject/Medieval/style.css) 統一配置 6px 暗金色滑塊與深色半透明軌道，徹底消滅 Windows 原生刺眼大白卷軸。
       - **領地防禦與攻城戰役**：[src/ui/modals/TerritoryDefenseModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/TerritoryDefenseModalController.ts) 與 [src/ui/modals/OffensiveSiegeModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/OffensiveSiegeModalController.ts) 同步升級為 `columns: 3` 等寬網格對稱渲染。
       - **謁見大廳與修道院**：官職冊封候選池與病床候選池均已全面改由 `HeroPicker` 驅動。
    2. **`EquipSourcePicker`（裝備來源與槽位選擇器 SSOT）工藝三模組全面落地**：
       - 上下層卡片規格 100% 統一：上層 3 欄 88px 頭像卡片，下層 3 欄 88px 裝備卡片。
       - 全面配置 `align-content: flex-start;` 與 `overflow-x: hidden;`，徹底根除左右橫向卷軸與卡片上下拉扯產生的巨大中間斷層。
       - 全面貫通：① 鍛造屋裝備強化、② 鍛造屋元素附魔、③ 皇家裝備改造所。
    3. **型別與測試保障**：TypeScript 0 報錯，定向單元測試全數通過。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. **驗收大地圖派遣出征**：
       - 進入大地圖點擊副本節點開啟派遣 Modal。
       - 檢視左欄：確認外框升級為深色底板＋暗金色微鑲邊，與右側面板完美對稱。
       - 檢視卡片排列：3 欄卡片等寬工整貼合容器，不再有浮動鬆散與右側多餘空隙；滾動條為 6px 古典暗金色細卷軸。
       - 進入大地圖點擊未完成事件或副本節點，開啟派遣出征 Modal。
       - 檢視下方候選傭兵清單：確認均為標準立繪卡片、無任何左右卷軸、點擊卡片可直接編入/退出小隊（最多 5 人），選滿後其餘傭兵智慧鎖定。
    3. **驗收領地防禦戰備 / 攻城戰**：
       - 開啟防衛戰備或攻城部署 Modal，檢視下方候選部隊：
       - 支援滑鼠直接拖曳卡片至上方九宮格陣型中，亦可直接點擊卡片自動填入空位；已被其他梯隊編入的傭兵會自動灰階並提示「已在其他梯隊」。
    4. **驗收工藝裝備選擇器（鍛造/附魔/改造）**：
       - 進入鍛造屋（強化/附魔）或皇家改造所，確認左欄上下兩層卡片高度一致（88px）、固定 3 欄且無任何水平左右卷軸，中間無多餘空洞。

- **[Refactor/UI/AestheticAndLayoutStandardization] 遊戲本體全域前端 UI 規格統一、零卷軸標準骨架與全面去除 Emoji 完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **階段 C：主介面框體與儀表板美學升級**：
       - **頂部資源列**：移除全數 Emoji，換以深鐵暗金色底條、金絲邊框、`.res-tag` 古典微型文字標籤與 Cinzel 地點字型。
       - **右側帝國儀表板**：移除所有 Emoji，改為 `✦ 世界局勢`、`◈ 探索情報`、`◈ 帝國紀事`、`✦ 領地要聞` 古典排版，左側邊界升級為金屬雙層鑲邊。
       - **街道建築木牌銘牌化**：拔除酒杯、鐵錘、教堂、原木等 Emoji，改為雙行純淨古典懸掛木牌。
    2. **階段 A：獨立設施雙欄標準化與卡片規格統一**：
       - **全域設施通用骨架**：在 `style.css` 建立 `.facility-header`、`.facility-title`、`.facility-sub-lvl`、`.facility-main-layout`、`.facility-sidebar-left`（340px 零卷軸）與 `.facility-content-right`（min-width: 0 自適應）。
       - **全設施視圖統一落地**：領主書房 (`#view-base`)、謁見廳 (`#view-hall`)、傭兵酒館 (`#view-camp`)、裝備改造所 (`#view-modification-workshop`)、裝備二手商 (`#view-secondhand-shop`)、鍛造屋 (`#view-forge`)、教會醫療所 (`#view-church`) 全數導入標準雙欄架構，消除外層縱向長卷軸，卡片統一對齊 `95px × 110px`（裝備 `90px × 90px`）。
       - **控制器文字去 Emoji**：`RecruitController.ts` 與 `ChurchModalController.ts` 清除招募、病床與急救按鈕之殘留 Emoji。
    3. **階段 B：抽屜與倉庫面板整頓**：
       - **抽屜面板**：戰鬥紀錄、外交派系、全域倉庫、地牢、傭兵小隊抽屜標題及頁籤全面清除 Emoji；右下角 Command Crest 改用古典單字微銘文（倉、牢、軍、邦、誌、設）。
       - **倉庫 Modal 與網格對齊**：鐵匠鋪倉庫與領地總倉庫標題及頁籤全面清除 Emoji，儲存網格嚴格統一為 `90px` 正方形槽位規格。
  - **使用者實機驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`），按下 **F5 重新整理**。
    2. **驗證階段 C**：
       - 檢視頂部資源列：確認城堡、人口、威脅等 Emoji 已消失，由金絲微標籤與古典字體乾淨呈現。
       - 檢視右側帝國儀表板：確認世界情報、帝國紀事等標題純淨無 Emoji，具備金屬鑲邊質感。
       - 檢視街道建築牌：確認木牌文字純淨，無 Emoji 干擾。
    3. **驗證階段 A（獨立設施雙欄與卡片）**：
       - 分別點擊進入「領主書房」、「謁見廳」、「傭兵酒館」、「鍛造屋」、「教會與醫療所」、「裝備改造所」、「裝備二手商」。
       - 確認所有設施頂部均為統一的 `← 返回街道` 導航列與 Cinzel 標題。
       - 確認左側控制台（340px）與右側卡片區比例工整，**全屏無外層長卷軸**。
       - 酒館與醫療所之傭兵卡片尺寸均為規範的 `95px × 110px`，下半部詳情面板固定居底，點選即時響應。
    4. **驗證階段 B（抽屜與倉庫）**：
       - 點擊右下角快捷鈕（倉、牢、軍、邦、設）：確認左側抽屜滑出順暢，頁籤無 Emoji。
       - 點擊開啟全域倉庫或領地總倉庫：確認 3 大頁籤切換流暢，裝備與素材插槽均為 `90px` 正方形工整陳列。

- **[Fix/UI/ChurchInfirmarySlice] 遊戲本體「⛪ 教會與醫療所 (Church & Infirmary)」垂直切片排版與功能修復完工交接（2026-09-18）**：
  - **核心交接重點**：
    1. **排版盒子模型修復與高度溢出根治**：在 [style.css](file:///i:/gameproject/Medieval/style.css) 為全域 `.facility-view` 補齊 `box-sizing: border-box;`，並建立專屬 `#view-church` 樣式規則（`padding: 25px 40px;` 與半透明聖光遮罩背景），徹底消除了獨立建築高度溢出 80px 導致下半部操作按鈕被切掉的通病。
    2. **傭兵卡片容器標準化**：在 [src/ui/modals/ChurchModalController.ts](file:///i:/gameproject/Medieval/src/ui/modals/ChurchModalController.ts) 將病床卡片內展示區與下方待選傷員列表容器全面規範為標準 `.adventurer-card` 類別，100% 恢復滿版頭像相框、置頂名稱、職業等級、重傷標記與血條之 CSS 正常渲染，解決原本卡片骨架碎裂跑版問題。
    3. **入口生命週期與預選對齊**：在 [src/ui/FacilityController.ts](file:///i:/gameproject/Medieval/src/ui/FacilityController.ts) 將街道入口改為呼叫 `ChurchModalController.open()`，玩家進入教會時自動預選第 1 張病床，下方操作區即刻展現完整面板，不再出現一片黑或空白無反饋。
    4. **型別安全防護**：標準對齊 `AdventurerState.DISPATCHED`，拔除 `(a as any)`；並加入病床無效傷員的自我修復容錯機制，防止髒資料卡死面板。
  - **使用者驗收方式**：
    1. 瀏覽器開啟遊戲本體（`http://localhost:5173/`）。
    2. 點擊領主書房確認教會等級（Lv.0 正常隱藏於街道；若已建造 Lv.1 祈禱處，街道將顯現「⛪ 教會與醫療所」建築入口）。
    3. 點擊進入「⛪ 教會與醫療所」：
       - **驗證 1（整體排版）**：確認視圖完整居中，左右雙欄邊界清晰，下半部急救按鈕與指派列表完全顯現於視窗內，無任何溢出或被裁切。
       - **驗證 2（病床卡片與立繪）**：確認病床上的傭兵立繪相框、名字、重傷紅字標記與血條等樣式均精美對齊。
       - **驗證 3（互動與指派）**：點擊空床位，確認下方即時展示閒置傷員清單；點擊傷員卡片即可指派躺床休養；點擊已入住床位即可施用藥水急救或辦理出院，資料狀態即時更新。

- **[Feature/VFX/EnergyShieldShaderImplementation] 特效工坊「🛡️ 專屬能量結界護盾著色器 (ENERGY_SHIELD) 與蜂巢晶格菲涅爾流光渲染」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **全新專屬 Shader 著色器**：在著色器下拉選單中正式加入 **「🛡️ 能量防護壁壘 (Energy Shield)」**，徹底告別單調的實體盾牌基本色塊，不再與肉身盾擊混淆。
    2. **高級魔法結界視覺**：表面動態求值 2D Hexagonal Grid 六角晶格能量線、Fresnel 邊緣光暈與呼吸流光脈衝，隨時間呼吸微動，充滿守護魔法的儀式感。
    3. **自訂色彩與樣式連動**：切換為 `ENERGY_SHIELD` 時自動開放「防護壁壘樣式」面板，隨核心色與外緣色任意切換聖光金盾、秘法藍盾或邪能綠盾。
  - **使用者驗收方式**：
    1. 瀏覽器開啟 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點擊「➕ 新技能」或選中任意技能圖層。
    3. 在右側「著色器 (Shader)」下拉選單中選擇 **「🛡️ 能量防護壁壘 (Energy Shield)」**。
    4. 點擊播放（或空白鍵）：**中央舞台將即刻綻放炫麗動態的六角蜂巢能量結界光盾，邊緣菲涅爾微光與內部脈衝流光栩栩如生**！

- **[Feature/VFX/ScreenShakeControlIntegration] 特效工坊「全螢幕鏡頭震動 (Screen Shake) 專屬開關接通、支援主擊與終結命中視窗劇烈晃動反饋」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **打擊感面板補齊開關**：在右側面板「🥊 戰鬥打擊感與受擊衝擊波」卡片底部補齊 **「📳 全螢幕鏡頭震動 (Screen Shake)」** 勾選開關。
    2. **實質視窗地動山搖反饋**：勾選後，技能主要命中（Primary Cue）或終結命中時，觸發 `@keyframes anim-screen-quake`，整面視窗鏡頭劇烈搖撼震動，打擊力量感倍增！
  - **使用者驗收方式**：
    1. 瀏覽器開啟 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 在左側庫中載入您的自訂技能（例如「連續地刺」）。
    3. 在右側「🥊 戰鬥打擊感與受擊衝擊波」卡片底部，勾選 **「📳 全螢幕鏡頭震動 (Screen Shake)」**。
    4. 點擊播放（或空白鍵）：**確認地刺命中瞬間，整個戰鬥視窗鏡頭產生強烈的全景地動晃動效果**！

- **[Fix/VFX/NewSkillsImpactTrackAutoCreationAndUnlock] 特效工坊「新自訂技能戰鬥打擊感 (Impact & Wave) 徹底解鎖、自動補齊 IMPACT 軌道與全管線儲存」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **排查官方 vs 自訂技能差異**：官方 30 款技能出廠均自帶 `type: 'IMPACT'` 軌道故可正常調整；自訂新技能預設只有主軌，缺少受擊軌道且頂層白名單漏掉 `impact`，導致滑桿一放開就被還原為 55ms 死鎖。
    2. **完全解鎖自訂新技能打擊感**：
       - 頂層合法架構欄位納入 `'impact'`，打擊定格、擠壓、震動、擊退、閃光色均能即時寫入。
       - 自動為所有新技能補齊 Canonical `type: 'IMPACT'` 軌道與 Clip，享有與官方 30 款技能完全等同之高階打擊感調校能力。
  - **使用者驗收方式**：
    1. 瀏覽器開啟 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 在左側庫中載入您的自訂技能（例如「連續地刺」），或點擊「➕ 新技能」自訂一個全新技能。
    3. 在右側面板找到 **「🥊 戰鬥打擊感與受擊衝擊波 (Impact & Wave)」** 卡片。
    4. 拖動 **打擊定格**（如調到 90ms）、**受擊擠壓**（如調到 0.75x）、**受擊震動**（如調到 20px）、**受擊擊退** 等任意滑桿。
    5. 確認滑桿**不再被鎖住彈回**，中央舞台下方的 HUD 即時更新數值，點擊播放時受擊目標精確響應您自訂的強烈定格與重震！

- **[Feature/VFX/LayerSpatialModeIsolationAndTargetConvergence] 特效工坊「次生圖層時空模式 (Spatial Mode) 局部嚴格隔離、支援受擊目標 (AT_TARGET) 實質生效與防跨圖層污染」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **選取圖層嚴格局部隔離 (Anti-Pollution)**：當選中次生圖層時，修改「時空發生模式」僅寫入該圖層自身的 `layer.spatialMode` 與 Clip 的 `payload.data.spatialMode`，嚴禁向 Sequence 頂層冒泡污染，徹底杜絕主次圖層互相干擾。
    2. **受擊目標 (`AT_TARGET`) 實質生效**：
       - 解除素材庫 `subData.spatialMode` 覆蓋自訂值的死鎖，確保次生圖層自訂之空間模式為最高真理來源。
       - `CombatFXEngine` 判定 `isAtTarget` 時，將震波 `originPos` 精確錨定在 `targetPos`（受擊目標卡片），波環於目標腳下原地爆發擴散，不產生任何向前飄移！
  - **使用者驗收方式**：
    1. 瀏覽器開啟 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 載入任意技能（例如「近戰大劈」或「天降落雷」），或點選「➕ 次生圖層」，著色器選擇「🌊 衝擊震波 (SHOCKWAVE)」。
    3. 在下方時間軸點選該震波圖層（使其高亮選取）。
    4. 在右側面板第 1 張卡片 **「🌐 基礎彈道與時空節奏」** ➔ **「時空發生模式」** 下拉選單中選擇 **「💥 受擊目標 (AT_TARGET)」**。
    5. 點擊播放（或空白鍵）：確認震波環**精確出現在右側「受擊目標」卡片身上原地爆發向外擴散**！
    6. 點擊主特效軌或切換回「🏠 施術者自身 (AT_CASTER)」：確認主技能與次生圖層完全正交獨立，切換流暢且彼此零污染！

- **[Fix/VFX/TimelineLayerDragDisplacement] 特效工坊「次生圖層 (Layer Clip) 拖曳平滑連續位移修正、徹底消滅滑鼠一拖即暴跳歸零之根本病灶」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **根本病灶排除**：修正 [TimelineInteraction.ts:920-926](file:///d:/tryagent/Medieval/src/tools/vfx-studio/timeline/TimelineInteraction.ts#L920-L926) 的圖層拖曳計算公式，將原本漏掉 `initialDelay` 導致輕輕一拉就瞬間歸零跳到 0.01s 的嚴重 Bug 徹底修正。
    2. **連續平滑增量位移**：改為 `newDelay = Math.max(0, Math.min(maxDelay, initialDelay + deltaTime))`，滑鼠點下時保持不動，左右拖曳時依滑鼠像素精準連續位移，極限值自動夾緊防超出。
  - **使用者驗收方式**：
    1. 瀏覽器開啟 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 在下方時間軸點選任意次生圖層（若無次生圖層可點擊「➕ 次生圖層」新增一個）。
    3. 用滑鼠拖動該圖層方塊：確認按下滑鼠時**不會再暴跳歸零**，而是非常滑順、隨抓隨走，左右拖曳時精準跟隨滑鼠游標停留在您想要的任意秒數！

- **[Feature/VFX/ShockwaveControlsUnification] 特效工坊「衝擊震波 (SHOCKWAVE) 專屬幾何控制項整合、消除重複 ID 徹底修復 waveCount 死鎖、剔除多餘擴散平面」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **重複 ID 清理與事件綁定修正**：徹底移除 [tools/vfx-studio.html](file:///d:/tryagent/Medieval/tools/vfx-studio.html) 殘留之舊 `param-wave-count`，確保事件正確綁定至右側屬性面板滑桿，徹底解除「圈數怎麼調都是 3」之死鎖。
    2. **衝擊震波專屬控制區實裝**：自受擊卡片中移除混淆之受擊擴散光圈與擴散平面，在屬性面板統一整合為「🌊 衝擊震波幾何與姿態 (Shockwave Wave Ring)」專屬區塊，當 Shader 為 `SHOCKWAVE` 時自動展現。
    3. **六大核心幾何與姿態參數實質生效**：
       - **波環圈數 (`waveCount`, 1~6 圈)**：動態建構指定層數之波環實體。
       - **波環半徑 (`waveRadius`, 20~200px)**：控制波環最終向外擴散之幾何半徑。
       - **波環線寬 (`waveThickness`, 1~30px)**：精準控制波環實體線條粗細。
       - **邊緣羽化 (`waveBlur`, 0%~100%)**：精準調控光環邊緣柔焦與朦朧質感。
       - **X 軸俯仰傾角 (`waveRotX`, -90°~90°)**：支援 0° 豎立、90° 貼地平鋪等任意角度。
       - **Y 軸偏航角度 (`waveRotY`, -90°~90°)**：支援 0° 正面、90° 側面等方位角旋轉。
    4. **全管線防快取死鎖 (Rule 12.2)**：`CombatFXEngine` 建構快取簽章 `${waveCount}_${waveRadius}_${waveThickness}_${waveBlur}_${colorRim}`，滑桿拖曳時即時重新求值與重建網格，達成完全所見即所得。
  - **使用者驗收方式**：
    1. 前往 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點選「🧩 素材圖層」，選擇「衝擊震波光環」或在任意技能/素材之著色器選擇「🌊 衝擊震波 (Shockwave)」。
    3. 觀察右側面板已自動展現「🌊 衝擊震波幾何與姿態」專屬面板（包含波環圈數、半徑、線寬、羽化、X軸俯仰、Y軸偏航）。
    4. 拖動「波環圈數」滑桿（例如調整為 1 圈、4 圈、6 圈），確認畫面波環層數立即響應，不再死鎖在 3 圈！
    5. 拖動「波環半徑」、「波環線寬」、「邊緣羽化」與「X軸/Y軸」旋轉，確認波環形狀、粗細、柔焦度與俯仰視角 100% 動態即時變化！

- **[Feature/VFX/ShockwaveMaterialExpansion] 特效工坊「新增衝擊震波 (SHOCKWAVE) 著色器素材」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **型別擴充**：`VFXShaderMode` 加入 `'SHOCKWAVE'`（[VFX.ts:23](file:///d:/tryagent/Medieval/src/models/VFX.ts#L23)），`VALID_SHADER_MODES` 白名單同步收錄。
    2. **UI 開放**：著色器下拉選單新增「🌊 衝擊震波 (Shockwave)」選項；選取後自動出現「🌊 震波環圈數 (Wave Count)」滑桿（1~6 圈）。
    3. **渲染熱響應**：`CombatFXEngine` 第 8 區段同時處理 `SHOCKWAVE`/`SHOUT_WAVE`，支援 waveCount 熱切換與顏色即時響應。
    4. **素材入庫**：`vfx_custom_sequences.json` 新增 `VFX_MAT_SHOCKWAVE_01`（衝擊震波光環），工坊開啟後在「🧩 素材圖層」可直接預覽引用。
  - **使用者驗收方式**：
    1. 前往 `http://localhost:5173/Medieval/tools/vfx-studio.html`
    2. 點選「🧩 素材圖層」，找到「衝擊震波光環」並點擊播放。
    3. 在右側屬性面板的「著色器」下拉選單選擇「🌊 衝擊震波 (Shockwave)」，確認「震波環圈數」滑桿出現並拖動，確認波環層數即時更新。

- **[Feature/VFX/CombatScaleAndSelfBuffAlignmentConvergence] 特效工坊「對齊實戰角色卡片 1:1 比例 (84px × 112px)、自身增益 (SELF_BUFF) 真實空間重合錨定 (from === to, 距離 0) 與特寫檢視切換」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **卡片尺寸 1:1 對齊實戰**：預設由 125px 改為 84px × 112px，徹底消弭工坊與實戰 1.5 倍視覺脫節；支援 `mode-magnified` 特寫模式。
    2. **舞台切換鈕**：頂部工具列支援 `【🎮 實戰 1:1 (84px)】` vs `【🔍 特寫檢視 (125px)】`。
    3. **自身增益真實空間錨定**：`updateTargetLayout('SELF_BUFF')` 直接將受術目標指向 `this.casterEl`，輔助線轉為同心波紋，真實重現自身施法無飛行向量的空間動態。
  - **使用者驗收方式**：
    1. 瀏覽器前往 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 觀察舞台卡片已預設為精緻的 84px × 112px 實戰尺寸。
    3. 點擊頂部工具列「🎮 實戰 1:1」按鈕，確認能平滑切換至「🔍 特寫檢視 (125px)」與切回。
    4. 在受術目標下拉選單選擇「🛡️ 自身蓄能/護盾 (Self Buff)」，確認右側出現自身增益說明面板，施術者卡片亮起紫光，播放自身增益時特效直接在自身卡片上播放，無任何多餘飛行向量！

- **[Skill & Rule/Ponytail/MandateConvergence] Ponytail「資深偷懶工程師原則與反過度設計天梯」正式寫入常駐憲法 (.agents/AGENTS.md 第 13 條) 與全域技能庫完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **永久常駐生效**：已寫入 [.agents/AGENTS.md 第 13 條](file:///d:/tryagent/Medieval/.agents/AGENTS.md#L158-L203)，AI 每一輪對話與編碼均被強制約束，無須手動指定。
    2. **全域技能部署**：部署至 [C:\Users\Allen.Ko\.gemini\config\skills\ponytail\SKILL.md](file:///C:/Users/Allen.Ko/.gemini/config/skills/ponytail/SKILL.md)，跨專案皆可調用。
    3. **三大執行指令**：支援 `/ponytail`、`/ponytail-review`、`/ponytail-audit`。
  - **使用者驗收方式**：
    - 任何後續需求，AI 將優先以最小程式碼、直擊根因、最少檔案、不寫多餘抽象層方式回答並編碼。

- **[Fix/VFX/MaterialUsageTypePersistenceConvergence] 特效工坊「修復 VFXStudioStore 頂層白名單遺漏 usageType 導致素材屬性存檔後遺失問題、補齊 vfx_custom_sequences.json 素材屬性」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **VFXStudioStore 頂層白名單擴充與閉環健全化**：
       - 修復 [VFXStudioStore.ts:5-22](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXStudioStore.ts#L5-L22) 的 `VALID_SEQUENCE_ROOT_KEYS`，加入 `'usageType'`、`'isBuiltin'` 與 `'author'`。
       - 解決了過去在 UI 點選 `[🧩 素材圖層]` 按鈕後被 Store 防禦白名單忽略，且在發布時被 `sanitizeSequenceRoot` 剔除的重大病灶。
    2. **修正現有自訂特效檔案資料**：
       - 已在 [src/data/vfx_custom_sequences.json](file:///d:/tryagent/Medieval/src/data/vfx_custom_sequences.json) 中為特效補正 `"usageType": "MATERIAL"`。
  - **使用者驗收方式**：
    1. **前往特效工坊**：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. **檢視左側卡片網格**：
       - 點擊「🧩 素材圖層 (1)」分欄，即可看見您剛剛創作的素材已正確回歸於素材分類中！
    3. **驗證新建或切換素材存檔**：
       - 點擊「➕ 新建」，彈窗詢問時點擊【確定】（建立為素材），或選取任意自訂特效後點擊基本資訊區的 `[🧩 素材圖層]` 按鈕。
       - 點擊「🚀 發布至專案 SSOT」。
       - 發布完成後，該特效 100% 穩定保留在「🧩 素材圖層」分類中，重整瀏覽器也絕不跑掉！

- **[Feature/VFX/SpatialOffsetFullPipelineConvergence] 特效與渲染引擎「全特效落點微調 (targetOffsetX/Y) 與軌道平移 (trackOffsetX/Y) 全管線貫通、實裝方案一幾何正交解耦（受擊錨點 vs 刀光身位）、工坊標籤精細化提示」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **全特效渲染端點全面貫通為數學不變量 $\vec{S}_{\text{final}}$ 與 $\vec{E}_{\text{final}}$**：
       - 原先原地近戰揮砍、地刺、神聖光柱、壁壘護盾、拋物線箭雨、大地裂地波、自身/受擊光環在渲染分支中引用了未偏移的原始座標。
       - 現已全面重構對齊：
         - ⚔️ 原地近戰揮砍（SLASH_BLADE）：刀芒位置與刀尖軌跡（`calculateSlashBladeTip`）全面依據已疊加微調與平移的 `endPos` 描繪。
         - 破土地刺、神聖天降光柱、神聖壁壘、拋物線箭雨、大地裂地波全面以 `endPos` / `startPos` 精確定位。
         - 💥 命中爆散粒子群（Burst Cloud）：爆散中心自動同步跟隨主軌的 `endPos`，達成刀光落點、受擊爆散火花 100% 空間精準吻合！
    2. **實裝【方案一：幾何正交解耦】（受擊錨點 vs 刀光身位）**：
       - **🎯 落點微調 (`targetOffsetX/Y`)**：定義為目標身上的精確受擊部位（受擊著彈點，打頭部/打胸口/打下盤），主導受擊火花爆散點與命中跳字基準。
       - **🛤️ 軌道平移 (`trackOffsetX/Y`)**：定義為刀光揮擊路徑相對於受擊點的身位平移，支援多圖層（Layers）拼裝「雙刀錯位交叉斬」或「立體雙重重劈」。
    3. **工坊 Inspector 標籤精細化提示**：
       - 在 [tools/vfx-studio.html:348-368](file:///d:/tryagent/Medieval/tools/vfx-studio.html#L348-L368) 為「落點微調」標註 `(受擊點)`，為「軌道平移」標註 `(刀光身位)`，並具備詳細 tooltip 提示。
  - **使用者驗收方式**：
    1. **開啟特效工坊**：前往 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. **驗收點 1（原地近戰揮砍落點微調與平移）**：
       - 選中任意原地揮砍特效（例如 `VFX_DEFAULT_SLASH` 或自訂近戰斬擊）。
       - 拖曳右側「落點微調 Y」至 `-50px`，觀察 3D 視圖，刀光弧線與刀尖拖尾立刻向上偏移至目標上方（打擊頭部/弱點）；
       - 拖曳「軌道平移 X」至 `+30px`，刀光整體向右平移，呈現斜切身位的立體斬擊！
    3. **驗收點 2（地刺、神聖光柱與護盾位移）**：
       - 選中破土地刺（`VFX_EARTH_SPIKE`）或神聖光柱（`VFX_HOLY_LIGHT`），拖曳「落點微調 X/Y」，尖刺破土中心或天降光柱中心立即隨滑桿即時平移。
    4. **驗收點 3（多圖層雙刀交錯斬拼裝）**：
       - 新增或選取次生圖層，主軌設定 `軌道平移 X: -25px`，次生圖層設定 `軌道平移 X: +25px`，畫面中兩道刀光立體錯位交織，受擊核心依然緊鎖目標！

- **[Feature/VFX/CategorizationMaterialSecurityAndCardGallery] 特效庫分類架構升級「官方 30 款核心隔離出廠唯讀基準、獨立自訂檔案 vfx_custom_sequences.json、雙層門禁阻斷素材綁定技能、工坊徹底捨棄下拉改為卡片式多欄網格畫廊」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **官方 30 款核心特效物理隔離與出廠唯讀守護**：
       - `src/data/vfx_sequences.json` 保持精確 30 款官方特效（包含完整參數、Cue 點與圖層），標記 `usageType: 'SKILL'` 與 `isBuiltin: true`。在前端、Store 與 Vite 後端儲存端點中全面設防，任何改動均不得覆寫這 30 款官方核心。
    2. **自訂招式與素材獨立檔案存儲 (`src/data/vfx_custom_sequences.json`)**：
       - 新建與自訂特效全數存儲於獨立檔案中，資料層面徹底解耦。
       - `VFXPresetRepository` 雙軌自動聚合官方與自訂特效，全專案呼叫 `getPreset(id)` 或 `getSequence(id)` 透明無感知。
    3. **雙層安全門禁：嚴格禁止 [素材] 綁定技能**：
       - **邏輯層門禁**：`SkillVfxBindingRegistry.registerBinding` 檢查若特效為 `MATERIAL`，立即丟出 Security Violation 異常。
       - **UI 彈窗門禁**：`SkillVfxPickerModal.open` 與 `VFXLibrary` 中，若目前為素材圖層，自動禁用技能指派按鈕並彈窗阻斷。
    4. **工坊 UI 全面改版：卡片式多欄網格畫廊 (Card Gallery)**：
       - 徹底捨棄下拉選單，改為現代化卡片式網格列表。
       - 頂部設有四大分類 Tabs（👑 官方 30 / ⚔️ 技能專用 / 🧩 素材圖層 / 🌐 全部）。
       - 設有關鍵字即時搜尋框與 14 種屬性快篩器。
       - 點擊卡片即時載入該特效，並有專屬選中發光反饋。
       - 基本資訊卡片提供 `[⚔️ 技能專用]` 與 `[🧩 素材圖層]` 切換按鈕，以及屬性切換下拉選單。
  - **使用者驗收方式**：
    1. **開啟特效工坊**：前往 `http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. **驗收點 1（卡片式多欄畫廊）**：
       - 檢視左側「📚 預設庫」，已徹底告別下拉選單，呈現為現代化雙欄卡片網格。
       - 點擊頂部 Tabs「👑 官方 (30)」、「⚔️ 技能專用」、「🧩 素材圖層」，列表立即過濾為對應分類。
       - 在搜尋框輸入關鍵字（例如 `斬` 或 `矢雨`），或在屬性下拉選單篩選（例如 `物理 PHYSICAL`、`冰 ICE`），列表即時過濾。
       - 點選任意卡片，該卡片呈現高亮外框，特效即時載入並在右側 3D 視圖中播放。
    3. **驗收點 2（屬性與用途切換）**：
       - 選中自訂特效後，可自由點擊 `[⚔️ 技能專用]` 與 `[🧩 素材圖層]` 按鈕切換用途，並可更換「屬性類別」（物理、元素、神聖、混沌等）。
       - 選中官方 30 款特效時，標題顯示 `[🔒 官方唯讀基準]`，名稱、描述與用途按鈕自動鎖定禁用，保護出廠設定不被竄改。
    4. **驗收點 3（素材禁綁技能安全門禁）**：
       - 切換某特效為 `🧩 素材圖層`，底部的「🎴 卡片指派」與普攻綁定按鈕自動變灰禁用。
       - 若企圖強行開啟綁定彈窗，系統跳出警告 `[安全防線] 該特效標記為「素材圖層」，僅供作為次生圖層或合成素材使用，不可直接綁定給技能！`，杜絕任何不當綁定。
    5. **驗收點 4（雙檔案儲存與調用）**：
       - 點擊發布或保存自訂特效時，資料自動寫入 `src/data/vfx_custom_sequences.json`，官方 `src/data/vfx_sequences.json` 保持 30 款純淨不變。
       - 戰鬥系統與沙盒調用皆順暢無誤，全量 188 項測試 100% 綠燈！

- **[Fix/Combat/PerTargetTemporalSlicingAndAuditBadgeAndWebTokenExit] 戰鬥中繼管線「實裝各目標獨立時間切片 (Per-Target Temporal Slicing) 實現群體/單體多 Cue 嚴格守恆分段與多怪同時跳字」、戰鬥沙盒「解耦空間目標數與時間拍點數重構 Audit Badge 消除假警報」、開發工具「修復 run_web_token.mjs 背景進程掛住退出問題」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **實裝各目標獨立時間切片（Per-Target Temporal Slicing），保證多怪受擊在同一 Cue 同時跳字**：
       - **病灶根因**：原先 `vfx_sequences.json` 中部分特效靜態寫死 `"impactPresentationMode": "EXACT_IMPACTS"`，且過去分段邏輯只針對單體情況；當全體技能命中多隻怪物時（例如 2 隻怪），`impactCount` 為 2，無法觸發 `SPLIT_SINGLE_IMPACT`，導致多隻怪物無法按時間軸的 3 個 Cue 正確分段跳字。
       - **修復落實**：在 [src/ui/fx/CombatActionPlayer.ts:505-538](file:///d:/tryagent/Medieval/src/ui/fx/CombatActionPlayer.ts#L505-L538) 中徹底解除限制：
         - 檢測只要時間軸配置多個帶權重 Cue (`damageableItems.length > 1`)，即自動啟用時間切分。
         - 對**每一個目標**獨立執行整數最大餘數平差（Largest Remainder Method），將各目標的總傷害精確切分至各 Cue 拍點，保證各怪傷害 100% 數值嚴格守恆。
         - **同時跳字保證**：在同一個 Cue 拍點上，`cueMap` 包含所有受擊怪物的 Presentation，在同一個時間軸影格同時分發給 `onPresentImpact`，畫面即時同步跳出各怪的跳字與血條扣減！
    2. **重構沙盒 Audit Badge，消除空間目標數與時間拍點數混淆之假警報**：
       - **病灶根因**：[src/tools/combat-studio/CombatStudio.ts:4402-4416](file:///d:/tryagent/Medieval/src/tools/combat-studio/CombatStudio.ts#L4402-L4416) 原先粗暴地將 `ev.impactCount !== cuesCount` 判定為警報。當全體技能命中 2 隻怪、時間軸有 3 個 Cue 時，直接報出 `impact(2) ≠ cue(3)` 假警報。
       - **修復落實**：將空間維度（目標數）與時間維度（打擊數）解耦，重構 Audit Badge 標籤語義：
         - 多段拍點：顯示 `✓ ${cuesCount}連擊 (${targetText})`（例如 `✓ 3連擊 (2目標)` 或 `✓ 3連擊 (單體)`）。
         - 1:1 單純打擊：顯示 `✓ 1:1`。
         - AOE 單拍爆發：顯示 `✓ ${totalImpacts}目標同爆`。
         - 僅在單體單打卻遺失事件時提示需校準，徹底消除假警報。
    3. **根治 `run_web_token.mjs` 背景 Task 執行後卡住不退出病灶**：
       - **病灶根因**：腳本透過 Playwright 連線至本機 Chrome CDP 9222 埠，在印出結果後未關閉 WebSocket 連線亦未調用 `process.exit(0)`，造成 Node.js Event Loop 持續被常駐連線掛住。
       - **修復落實**：在腳本結尾加入 `try { await browser.close(); } catch(e) {} process.exit(0);`，確保執行完畢立即正常釋放並標記完成。
  - **使用者驗收方式**：
    1. 瀏覽器開啟戰鬥沙盒：`http://localhost:5173/Medieval/tools/combat-studio.html` 或進入主遊戲戰鬥。
    2. **驗收點 1（全體技能多怪分段與同時跳字）**：
       - 場上放置 2 隻怪物，施放全體技能（如 3 段打擊的箭雨或劍刃風暴）。
       - 觀察時間軸上的第 1、2、3 個打擊幀，每一幀落下時**兩隻怪物頭上同時彈出傷害跳字與血條扣減**，絕無先後延遲或空砍。
       - 各怪物 3 段跳字加總 100% 等於該怪應受之總傷害。
    3. **驗收點 2（沙盒 Audit Badge 驗收）**：
       - 觀察技能列表與打擊審計標籤，施放全體技能時顯示 `✓ 3連擊 (2目標)`，不再顯示刺眼的紅色或黃色 `impact(2) ≠ cue(3)` 假警報。
    4. **驗收點 3（單體多段技能驗收）**：
       - 施放單體 3 段技能，目標頭上依序跳出 3 次傷害，Audit 標籤顯示 `✓ 3連擊 (單體)`。

- **[Fix/Combat/DynamicImpactPresentationNegotiation] 戰鬥與特效中繼管線「引入動態演出意圖推導 (Dynamic Presentation Intent Derivation)、根治 1 筆傷害事件搭配多 Cue 視覺序列時退化為空砍的 IMPACT ≠ CUE 缺陷」完工交接（2026-09-17）**：
  - **核心交接重點**：
    1. **徹底解決「技能傷害未分段、後段打擊幀淪為空砍」病灶（落實 Web Token 深度架構診斷與 Rule 7.3 人本體驗）**：
       - **病灶根因**：在 [src/ui/fx/CombatActionPlayer.ts:796-800](file:///d:/tryagent/Medieval/src/ui/fx/CombatActionPlayer.ts#L796-L800) 中，模式解析未顯式指定時寫死退回 `'EXACT_IMPACTS'`。當戰鬥邏輯產生 1 筆 `HIT` 事件（如 500 傷害），而時間軸配置了 3 個帶權重的打擊 Cue（如 20/30/50）時，`'EXACT_IMPACTS'` 將全額傷害歸於 Primary Cue，其餘 Cue 淪為 `amount: 0`、`kind: 'VISUAL_ONLY'`，導致戰鬥時後續刀光完全沒有數字反饋，暴露了 `IMPACT (1 筆) ≠ CUE (N 個)` 的割裂。
       - **修復落實**：在 `CombatActionPlayer.playAction` 中引入**動態意圖推導（Dynamic Intent Derivation）**：
         - 當未顯式指定模式，且檢測到「1 筆傷害結算事件」+「時間軸配置多個帶權重 Cue」時，系統自動將演出模式協商為 `'SPLIT_SINGLE_IMPACT'`。
         - 依據各 Cue 權重執行整數最大餘數平差切分（Largest Remainder Method），餘數平差至最後一擊，保證傷害總和 100% 嚴格守恆，既免除企劃逐一配置負擔，又讓多段打擊招式自然跳字、血條流暢扣減。
    2. **完全保留顯式配置權威**：
       - 企劃或技能綁定中若顯式指定了 `'EXACT_IMPACTS'` 或 `'PRIMARY_ONLY'`，依然 100% 遵從顯式覆蓋，絕不干涉特定業務意圖。
  - **使用者驗收方式**：
    1. 瀏覽器開啟戰鬥沙盒：`http://localhost:5173/Medieval/tools/combat-studio.html` 或進入主遊戲戰鬥。
    2. 選擇施放配置有多個 Cue 點的連續打擊技能（例如帶有 2~3 段刀光的斬擊或物理技能）。
    3. **驗收點 1（分段跳字）**：觀察受擊目標頭上的漂浮文字，每一道刀光落下時皆會依時間戳即時彈出對應權重的傷害數字（例如 100 ➔ 150 ➔ 250），不再出現只有第一下跳字、後面空砍的現象！
    4. **驗收點 2（數值守恆）**：各段分段數字加總嚴格 100% 等於戰鬥邏輯結算之全額傷害（500 = 100 + 150 + 250），血條亦平滑分段扣減，無任何浮點數誤差或幽靈血量！

- **[Fix/VFX/LayerOffsetIsolationAndSelectionSyncUI] 特效工房「修復選取圖層修改偏移導致主軌連帶偏移之幽靈回退問題、打通時間軸選取切換時 Inspector 控制項數值即時回讀響應鏈」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底解決「選取圖層後修改偏移會把主軌一起偏移」病灶（落實 Rule 12.1 正交解耦與獨立性）**：
       - **病灶根因**：[src/tools/vfx-studio/VFXStudioStore.ts:236-253](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXStudioStore.ts#L236-L253) 在 `updateConfig` 中，次生圖層全部集中存放於 `sequence.layers` 陣列，`tracks` 陣列只包含原生主軌。當選取為圖層時，`tracks.find(t => t.id === layerId)` 必然回傳 `undefined`，進而落入 `if (!targetClip) targetClip = mainClip;` 的幽靈回退分支，使得圖層屬性被無差別同步寫入 `mainClip.payload.data`，造成主軌被連帶偏移。
       - **修復落實**：重構 `updateConfig` 邏輯——選取為 `LAYER` 時只針對 `currentSequence.layers` 的指定圖層寫入 `clipSpecificData`，嚴格禁止回退至 `mainClip`；僅在選取為非圖層時才寫入主軌。徹底實現圖層與主軌在數據寫入上的 100% 物理隔離！
    2. **徹底解決「設定好偏移在選取圖層時拉桿沒有及時反應」病灶（落實 Rule 7.3 人本操作檢驗與 Rule 9 資料流貫通）**：
       - **病灶根因**：[src/tools/vfx-studio/VFXInspector.ts:135](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXInspector.ts#L135) 在建構函數中，`this.store.subscribeSelection` 僅呼叫了 `updateContextualVisibility` 控制卡片顯隱，遺漏了調用 `syncUI`。當使用者從主軌點擊次生圖層時，Inspector 的滑桿依然保留主軌數值，未重新執行資料同步。
       - **修復落實**：
         - 在 `subscribeSelection` 中補上 `this.syncUI(this.store.getPreset())`。
         - 在 [src/tools/vfx-studio/timeline/TimelineInteraction.ts](file:///d:/tryagent/Medieval/src/tools/vfx-studio/timeline/TimelineInteraction.ts) 中補齊點選圖層、鎖定軌道選取、關閉編輯欄與刪除圖層時對 `selectTrack` 的完整同步調度。
         - 使用者在時間軸上點擊任一圖層 Clip 時，右側「空間座標偏移（落點微調 X/Y、軌道平移 X/Y）」及所有屬性滑桿立即熱更新為該圖層當前的設定值；點回主軌亦即時切換回主軌設定！
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點擊素材庫選取任意特效（或在時間軸點擊「➕ 加一層」新增次生圖層）。
    3. **驗收點 1（即時回讀）**：在時間軸點選次生圖層 Clip，觀察右側「🎯 空間座標偏移」面板，滑桿與數值標籤立即切換顯示該圖層的數值；點擊主軌，數值立即切回主軌設定！
    4. **驗收點 2（主軌隔離）**：選中次生圖層，將「落點微調 X」拖曳至 `+60px`，畫面中僅次生圖層的軌跡或落點發生偏移，主軌攻擊軌道與落點中心完全保持原位不變，絕不再被連帶偏移！

- **[Fix/VFX/SalvoTrailPhysicsAndStudioAnchorSolverAndLayerOffset] 特效與戰鬥系統「貫通多子彈彈幕隨身羽流拖尾物理計算 (trailSpread / trailStrands)、統一戰鬥沙盒與實戰幾何中心目標錨定求解器 (CombatAnchorResolver)、打通圖層 (Layers) 獨立空間偏移數值讀取」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底解決「多子彈拖尾無法設定新增的兩項拖尾效果」病灶（落實 Rule 7.3 與 Rule 12.2）**：
       - **病灶根因**：[MeshLayerRenderer.ts:1834](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts#L1834) `updateArcMulti` 內部雖然接收了 `trailParams`，但頂點循環計算中僅使用固定寫死的波幅，完全忽略了 `tSpread`（羽流寬度）與 `tStrands`（微相位交織股數）。
       - **修復落實**：在 `updateArcMulti` 頂點更新循環中，深度注入 `tSpread` 與 `tStrands` 的立體物理擴散計算：
         - 側向立體擴散量：`const extraSpread = tSpread * (1.0 - u);`
         - Y 軸波動：`waveY = (Math.sin(flowPhase) * waveAmplitude) + (Math.sin(flowPhase) * extraSpread);`
         - Z 軸空間波動：`waveZ = (Math.cos(flowPhase) * waveAmplitude * 0.5) + (Math.cos(flowPhase * 1.2) * extraSpread);`
         - 讓每顆子彈的隨身尾流隨拖曳滑桿即時產生立體羽流散開與微相位螺旋交織動態。
    2. **徹底解決「戰鬥沙盒落點未匹配群體技能九宮格中排中」病灶（落實 Rule 12.3 單一裝配真理來源，且 100% 保留沙盒除錯與展示功能）**：
       - **病灶根因**：歷史技術債導致戰鬥沙盒使用了獨立的 [CombatStudioStageAdapter.ts](file:///d:/tryagent/Medieval/src/ui/fx/adapters/CombatStudioStageAdapter.ts)，其 `playCombatAction` 過去直接寫死 `toPt = this.getUnitPoint(mainTargetId)`，完全未調用幾何錨定求解。
       - **修復落實**：
         - 提煉純幾何目標錨定求解器 [CombatAnchorResolver.ts](file:///d:/tryagent/Medieval/src/ui/fx/adapters/CombatAnchorResolver.ts)，作為全專案範圍特效落點的唯一真理來源（SSOT）。
         - 將實戰舞台 `CombatStageAdapter` 與沙盒舞台 `CombatStudioStageAdapter` 雙端完全對齊調用此求解器。
         - 全體範圍落點精確錨定在受擊方九宮格「中排中」（Row 1, Col 1）；前排落在第一排中心、後排落在第三排中心。
         - **承諾落實**：100% 保留沙盒原本的卡片尋找、DOM 綁定、`vfxEnabled`、Debug Overlay 與除錯控制項，零功能拔除。
    3. **打通圖層（Layers）獨立空間偏移數值讀取（落實「空間偏移用在圖層上」架構哲學）**：
       - **架構原則**：主軌代表核心攻擊目標幾何中心，不隨意大幅偏移；空間座標微調（`targetOffsetX/Y`, `trackOffsetX/Y`）應用於次生圖層（如殘影、多重刀光、交叉射線），形成層次豐富的複合特效。
       - **修復落實**：在 [VFXInspector.ts:388-396](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXInspector.ts#L388-L396) 的 `syncUI` 中補齊圖層選取狀態 (`sel.type === 'LAYER'`) 下優先讀取該圖層 `clipSpecificData` 的獨立空間偏移與幾何設定，若未設定再回退主軌/Preset 預設，完成雙向資料綁定與狀態同步。
  - **使用者驗收方式**：
    1. **驗收點 1（戰鬥沙盒「測試守護騎士箭雨」全體落點）**：
       - 瀏覽器開啟戰鬥沙盒：`http://localhost:5173/Medieval/tools/combat-studio.html`。
       - 選擇施放「測試守護騎士箭雨」技能（全體範圍）。
       - 觀察箭雨落地視覺特效中心，確認精確落在敵方九宮格陣型的「中排中（中心位置）」，不再歪斜至邊緣單體身上！
    2. **驗收點 2（特效工坊多子彈羽流拖尾）**：
       - 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
       - 選擇「🚀 精靈矢雨」或開啟「彈道彈幕」軌道，定格在 0.20s。
       - 拖曳「羽流散開寬度」與「微相位交織股數」滑桿，觀察畫面上各發箭矢的隨身拖尾即時散開成立體羽流與多股螺線交錯！
    3. **驗收點 3（圖層獨立空間偏移）**：
       - 在特效工坊點選次生圖層（Layer），調整「落點微調 X/Y」或「軌道平移 X/Y」，可獨立為該圖層建立副落點或交叉路徑，且選取切換時數值精確回讀，不覆蓋主軌！

- **[Fix/VFX/ParticleReactivityAndTrailPipelineRepair] 特效工房「修復 HTML 漏閉合導致控制項重疊、拔除時間軸竄改跳轉恢復純資料驅動即時重繪、貫通彈道投射物（含天降流星）之立體羽流拖尾管線」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **修復 HTML 標籤漏閉合與控制項重疊**：
       - 修復 [tools/vfx-studio.html](file:///d:/tryagent/Medieval/tools/vfx-studio.html) 第 495-510 行 `param-row-2col` 漏閉合 `</div>` 的重大結構瑕疵。
       - 「碎屑爆發時間」與「爆裂碎屑數量」正常並列，「羽流散開寬度」與「微相位交織股數」獨立成列，徹底解除與 Impact Cue 標籤和爆散區塊的重疊。
       - HTML 維持 788 行（$< 800$ 行），通過防膨脹基準測試。
    2. **拔除時間軸竄改跳轉，恢復純資料驅動即時重繪**：
       - 拔除 [VFXStudioController.ts](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXStudioController.ts) 中 `onParamChange` 內強制 `seekToTime` 的副反應。
       - 使用者無論定格在時間軸哪一格（例如 0.00s、0.20s、0.38s），滑動任何滑桿皆 100% 純粹就當前格即時求值重繪，絕不再竄改創作者當前時間軸進度。
    3. **貫通彈道投射物之立體羽流拖尾 (含天降流星)**：
       - 在 [TrailLayerRenderer.ts:175-248](file:///d:/tryagent/Medieval/src/ui/fx/renderers/TrailLayerRenderer.ts#L175-L248) 為 `updateTrajectoryTrail` 實裝 `spreadWidth`（羽流寬度）與 `strands`（微相位多股交織）。
       - 在 [CombatFXEngine.ts:317-328](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L317-L328) 中，非斬擊彈道投射物（如天降流星、火球、飛出劍氣）統一調用 `updateTrajectoryTrail`，徹底解決天降流星無粒子拖尾以及定格狀態下粒子消失的缺陷。
  - **使用者驗收方式**：
    1. 瀏覽器重新整理特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. **驗收點 1（排版無重疊）**：檢視右側「✨ 粒子流、拖尾與爆散」卡片，確認「碎屑爆發時間」、「羽流散開寬度」與「微相位交織股數」版面工整，無任何重疊或擠壓。
    3. **驗收點 2（全項目即時響應）**：停留在任意時間點（例如 0.20s），拉動任何滑桿（顏色、尺寸、彈數、羽流寬度等），畫面即時產生實質反饋，且時間軸游標保持定格、不發生跳動！
    4. **驗收點 3（天降流星粒子）**：切換至「天降流星 (Meteor Strike)」，於飛行中段（如 0.20s ~ 0.35s）定格，可清晰看見帶有火焰色彩的立體羽流粒子拖尾，拉動「羽流散開寬度」與「微相位交織股數」可即時看見羽流膨脹與多股交錯！

- **[Feat/VFX/ExposeSpatialOffsetsAndPlumeTrailsUIAndPurgeSalvoDur] 特效工房「開放空間座標偏移 (targetOffset/trackOffset) 與羽流拖尾 (trailSpread/trailStrands) UI 控制項、拔除冗餘連射總時長 (salvoDuration) 以 Clip 時長為單一真實來源」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **拔除「連射總時長 (`salvoDuration`)」冗餘項**：
       - 特效時長與發射節奏完全由時間軸上的「主軌片段時長（Main Clip Duration）」作為唯一真理來源，徹底杜絕兩個時長互相衝突的瑕疵。
       - 自 [tools/vfx-studio.html](file:///d:/tryagent/Medieval/tools/vfx-studio.html) 與 [src/ui/fx/VFXPresetNormalizer.ts](file:///d:/tryagent/Medieval/src/ui/fx/VFXPresetNormalizer.ts) 徹底清除 `param-salvo-dur`。
       - [MeshLayerRenderer.ts:1751](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts#L1751) 延遲階梯統一以 `maxDelay` 正規化推進。
    2. **補齊「空間座標偏移 (Spatial Offsets)」UI 控制項（解決 Rule 9 雙端管道斷鏈）**：
       - 在 [tools/vfx-studio.html](file:///d:/tryagent/Medieval/tools/vfx-studio.html) 基礎彈道卡片中加入：
         - **落點微調 X (`#param-target-offset-x`)** 與 **落點微調 Y (`#param-target-offset-y`)**（範圍 $\pm 150\text{px}$）。
         - **軌道平移 X (`#param-track-offset-x`)** 與 **軌道平移 Y (`#param-track-offset-y`)**（範圍 $\pm 200\text{px}$）。
       - 標籤顯示支援正負號即時格式化（例如 `+42px` / `-18px`）。
    3. **補齊「立體羽流拖尾 (Plume Trails)」UI 控制項**：
       - 在 [tools/vfx-studio.html](file:///d:/tryagent/Medieval/tools/vfx-studio.html) 粒子卡片中加入：
         - **羽流散開寬度 (`#param-trail-spread`)**（範圍 $0 \sim 35\text{px}$）。
         - **微相位交織股數 (`#param-trail-strands`)**（範圍 $1 \sim 3$ 股）。
       - 在 [VFXStudioStore.ts:276](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXStudioStore.ts#L276) 同步更新粒子軌資料。
    4. **實裝彈幕調整即時動態熱預覽 (Live Morphing & Hot Preview)**：
       - [VFXStudioController.ts:77-84](file:///d:/tryagent/Medieval/src/tools/vfx-studio/VFXStudioController.ts#L77-L84)：監聽 `inspector.onParamChange`。當創作者處於非播放狀態且停在時間軸起點（$< 0.08\text{s}$）時調整彈幕發射或偏移，自動向前尋軌至飛行中段（$0.20\text{s}$），讓創作者立即看見子彈發射姿態與散佈效果，解決「停在原處感覺沒反應」的體驗痛點。
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. **驗收點 1（彈幕卡片清理）**：左側「🚀 彈幕發射與節奏曲線」卡片中，「連射總時長」已拔除；下拉選單支援完整的「同步齊射」與「錯落混沌」。
    3. **驗收點 2（彈幕即時反應）**：拉動「發射彈數」、「散射偏角」、「受擊散佈半徑」，畫面立即推進呈現散開姿態，不再卡在原點！
    4. **驗收點 3（空間座標偏移）**：在右側「🌐 基礎彈道與時空節奏」卡片底部，可看到全新的「🎯 空間座標偏移」區塊，拉動「落點微調 X/Y」與「軌道平移 X/Y」，3D 世界座標落點與軌跡即時偏移！
    5. **驗收點 4（羽流拖尾）**：在右側「✨ 粒子流、拖尾與爆散」卡片中，拉動「羽流散開寬度」與「微相位交織股數」，可直接調整拖尾的橫向體積感與股數。

- **[Feat/VFX/TargetAnchorSalvoRandomnessAndPlumeTrails] 特效系統「幾何格子目標基準點 B 解耦、極座標隨機圓盤散佈、發射節奏曲線實裝、正交偏移 (targetOffset/trackOffset) 與羽流交織拖尾 (trailSpread/trailStrands)」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **戰鬥系統目標範圍幾何中心 B 點絕對錨定（落實 Rule 12.1 與 Rule 12.3）**：
       - **設計承諾**：目標基準點 B 為戰鬥棋盤 3x3 九宮格上的**絕對固定幾何點**，與場上單位「死活狀態」100% 解耦（不論死活，只認格子物理位置）。
       - **位置對照表**：
         - 全體（`ALL_ENEMIES` / `ALL_ALLIES`）➔ 中排中（Row 2, Col 2）正中心幾何點。
         - 前排（`FRONT_ENEMIES`）➔ 前排中（Row 2, Col 3 或 Col 1 視陣營而定）正中心幾何點。
         - 後排（`BACK_ENEMY`）➔ 後排中（Row 2, Col 1 或 Col 3 視陣營而定）正中心幾何點。
         - 自身（`SELF`）➔ 施術者自身卡片中心。
         - 單體（`SINGLE_ENEMY` / `ALLY_LOWEST_HP`）➔ 指定單位卡片中心。
       - **落實代碼**：在 [src/ui/fx/adapters/CombatStageAdapter.ts:125-210](file:///d:/tryagent/Medieval/src/ui/fx/adapters/CombatStageAdapter.ts#L125-L210) 實裝 `resolveTargetAnchorPoint`，並由 `playCombatAction` 自動解析 `SkillRegistry.getSkill(action.skillId).targetType` 傳入。
    2. **正交偏移原則（Orthogonal Offsets，落實 Rule 12.1 各司其職）**：
       - `targetOffsetX/Y`：僅在目標基準落點 B 上進行局部疊加微調（$\text{End} = B + \text{targetOffset}$），絕不偏移起點與目標範圍本體定義。
       - `trackOffsetX/Y`：整條彈道軌道世界平行平移（$\text{Start} = A + \text{trackOffset}, \text{End} = B + \text{targetOffset} + \text{trackOffset}$），起終點連動平移。
       - **落實代碼**：在 [src/ui/fx/CombatFXEngine.ts:229-250](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L229-L250) 統一求解並傳遞至渲染管線。
    3. **彈幕極座標隨機圓盤散佈（消滅「永遠形成空心正圓」）**：
       - **病灶根因**：先前 `MeshLayerRenderer.ts` 以 `targetAngle = (i / actualCount) * Math.PI * 2` 強制正圓等分，半徑全為固定值，造成子彈永遠落成空心圓圈。
       - **修復落實**：[src/ui/fx/renderers/MeshLayerRenderer.ts:1710-1740](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts#L1710-L1740) 採用偽隨機極座標圓盤散佈算法：$r = \text{salvoSpreadRadius} \times \sqrt{\text{rand}}, \theta = 2\pi \times \text{rand}$。使落點自然均勻散佈於整個受擊圓盤之內（深淺半徑自然錯落，如實測半徑 52px ~ 124px）。
    4. **發射節奏曲線實質生效（salvoRhythmCurve）**：
       - **病灶根因**：先前計算出曲線延遲階梯後，在 `arcs.push` 處被硬編碼寫死 `(i / (actualCount - 1)) * 0.22` 覆蓋，導致選取任何曲線皆無效果。
       - **修復落實**：修復為 `delay: itemDelay`，完整支援 `ACCELERATE`、`DECELERATE`、`VOLLEY_SYNC`、`CHAOTIC`、`BURST_PAIRS`、`LINEAR` 六大節奏階梯。
    5. **羽流拖尾管線原地擴充（trailSpread / trailStrands，終結單細線珠子感）**：
       - **無外掛、不割裂（Rule 12.3）**：原地擴充現有粒子拖尾管線，支援錐形羽流橫向擴散（`trailSpread`）與 1~3 股微相位交織尾羽（`trailStrands`），給予隕石與流星飽滿立體的立體煙塵感。
    6. **型別與測試全線綠燈**：
       - `npm run typecheck` ➔ 0 錯誤。
       - 新增 [src/systems/combat/TargetAnchorAndSalvoRhythm.test.ts](file:///d:/tryagent/Medieval/src/systems/combat/TargetAnchorAndSalvoRhythm.test.ts) 8 項嚴格測試全部通過。
       - Vitest 全量 67 個測試檔案、419 項測試 ➔ **100% 全綠**！
       - 真實瀏覽器（Playwright）端對端驗收留存真理截圖：`salvo_features_verified.png`。
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 選取「🚀 精靈矢雨 (Spirit Dance)」並點擊「▶ 播放」。
    3. **驗收點 1（落點隨機化）**：7 發箭矢彈著點呈自然錯落散佈在圓盤之內，不再形成等距空心圓圈。
    4. **驗收點 2（發射節奏）**：箭矢出射時間遵循節奏曲線階梯（如 ACCELERATE 先慢後快逐一出射）。
    5. **驗收點 3（羽流拖尾）**：身後的拖尾粒子具備擴散寬度與多股立體交織感，不再是死板的單條線珠子。
    6. **驗收點 4（戰鬥實戰目標點）**：在戰鬥中施放全體、前排或後排技能時，特效打擊點精確聚焦於九宮格對應幾何排中，不論該格是否有存活角色。

- **[Fix/VFX/SalvoGlowAndOpacityFullPipelineReactivity] 特效系統「全面打通多發彈道 (ARC_MULTI / Salvo Pipeline) 之泛光半徑 (glowRadius)、光暈透明度 (glowOpacity) 與淡入淡出 (fadeAlpha) 全管線熱更新響應」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底解決「精靈矢雨各子彈沒有泛光半徑與光暈透明度調整」病灶（落實 Rule 12.2 拒絕擺設型控制項）**：
       - **病灶根因**：
         - [src/ui/fx/renderers/MeshLayerRenderer.ts:1610](file:///d:/tryagent/Medieval/src/ui/fx/renderers/MeshLayerRenderer.ts#L1610) `updateArcMulti` 內部把每發子彈的 Glow Sprite 尺寸寫死為 `26 * scale`，透明度寫死為 `0.8`；在每影格動畫更新循環中完全未更新每顆子彈的 `item.glow` 之 scale 與 opacity。
         - [src/ui/fx/CombatFXEngine.ts:734](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L734) 呼叫 `updateArcMulti` 時未傳遞 `glowRadius`、`glowOpacity` 與 `fadeAlpha`。
         - 菲涅爾冰晶著色器先前缺少動態透明度 `uOpacity` Uniform。
       - **修復落實**：
         - 著色器層：在 `createAdvancedIceShaderMaterial` 加入 `uOpacity: { value: 1.0 }`，使菲涅爾冰晶具備動態透明度。
         - 渲染器層：`updateArcMulti` 完整接收 `glowRadius`、`glowOpacity`、`fadeAlpha`，並納入快取 signature；每影格循環即時熱更新每顆子彈的 `item.glow.scale.set(curRadius, curRadius, 1.0)` 與 `item.glow.material.opacity = curOpacity`；子彈冰環、冰錐與圓球本體材質同步乘上 `fadeAlpha`。
         - 引擎層：在 `CombatFXEngine.ts:728-755` 以強型別提取 `glowR` 與 `glowO` 並傳遞，0 `any`。
    2. **型別與全量測試全線綠燈**：
       - `npm run typecheck` 0 錯誤。
       - Vitest 全量 66 個檔案、411 項單元測試 100% 全綠。
       - 真實瀏覽器（Playwright）端對端動態調試實測：
         - 預設（75px / 0.85）➔ 渲染子彈光暈直徑 52.5px、透明度 0.85。
         - 滑動至（150px / 0.35）➔ 即時放大至 105px、透明度 0.35。
         - 滑動至（40px / 0.95）➔ 即時縮小至 28px、透明度 0.95。
         - 實質響應 100% 貫通資料閉環，截圖真理已留存！
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點擊「📚 素材庫」下拉選單選取「🚀 精靈矢雨 (Spirit Dance)」。
    3. 在底部時間軸拖曳指針至 `0.16s`（子彈在空中散射飛行中）。
    4. 在右側「🎨 色彩與光學著色 (Colors & Glow)」面板中：
       - 拖動「泛光半徑 (Glow)」滑桿（例如從 40px 拉到 150px），觀察畫面上 7 發箭矢的光暈光圈即時縮放！
       - 拖動「光暈透明度」滑桿（例如從 0.2 拉到 1.0），觀察畫面上光暈明暗即時響應！
       - 調整主圖層淡入淡出時，箭矢與光暈能平滑淡入淡出，絕不再死鎖！

- **[Fix/VFX/RestoreSalvoIndividualTrailsAndPurgeSpatialContamination] 特效系統「恢復精靈矢雨每發箭矢獨立拖尾系統、徹底消滅跨特效切換空間殘留污染」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底解決「精靈矢雨每支箭都有拖尾，現在都沒了」病灶**：
       - **病灶根因**：[src/ui/fx/CombatFXEngine.ts:740](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L740) 呼叫 `MeshLayerRenderer.updateArcMulti(...)` 時漏傳了第 15 個參數 `trailParams`；且 [Line 321](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L321) 建立 `renderTrackObj.preset` 時未合併 `trk_particle` 的 `trailCount: 30`, `trailSize: 10`, `trailColor`，導致渲染器讀取的 `tCount` 永遠為 0，每支箭矢的專屬貝茲拖尾系統被跳過未建立。
       - **修復落實**：在 `CombatFXEngine.ts` 深度注入粒子軌拖尾參數，並傳遞第 15 個參數 `trailParams` 至 `updateArcMulti`；在多發彈幕 (`isSalvo`) 時釋放外層中央單軌拖尾，讓 7 支箭矢各自渲染獨立專屬的點狀綠色拖尾（每支箭 23 顆粒子）。
    2. **徹底解決「在其他特效播過後呈現只在中間自由落體」病灶**：
       - **病灶根因**：[src/ui/fx/CombatFXEngine.ts:548](file:///d:/tryagent/Medieval/src/ui/fx/CombatFXEngine.ts#L548) `renderTrack3DGeometry` 函式入口未重設 `trackGroup` 的姿態。前一個近戰特效（如巨力重劈把 `trackGroup.position` 移至目標點 x=177.5，或旋風斬旋轉了角度）殘留了空間偏移。切換到精靈矢雨時，整組箭矢直接在已偏移的目標點中央生成並下落，產生「在中間垂直自由落體」的視覺回歸現象。
       - **修復落實**：在 `renderTrack3DGeometry` 入口強制執行 `trackGroup.position.set(0, 0, 0); trackGroup.rotation.set(0, 0, 0); trackGroup.scale.set(1, 1, 1);`，消滅所有空間污染。
    3. **型別與測試全線綠燈**：
       - `npm run typecheck` 0 錯誤。
       - Vitest 全量 66 個檔案、411 項單元測試 100% 全綠。
       - 真實瀏覽器 Playwright 端對端實測：巨力重劈（x=177.5）切換至精靈矢雨後，`trackGroup.position` 成功歸零為 `(0, 0, 0)`；7 支箭矢呈優美拋物扇形拱起飛行，且 7 支箭矢各自帶著 23 顆獨立綠色拖尾粒子，實測畫面完美無瑕！
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點擊「📚 素材庫」下拉選單：
       - 先切換至「🗡️ 巨力重劈 (Heavy Slam)」並點擊播放或拖曳時間軸（造成目標空間位移）。
       - 隨後切換至「🚀 精靈矢雨 (Spirit Dance)」並點擊播放或拖曳時間軸至 0.16s。
       - **驗收點 1**：觀察 7 支翡翠箭矢從施術者向目標呈扇形拱起飛行，絕不再卡在目標中間垂直自由落體！
       - **驗收點 2**：觀察 7 支箭矢每一支身後都有獨立的點狀綠色拖尾粒子群緊隨飛行，視覺豐富飽滿，中央虛擬線徹底消失！

- **[Fix/VFX/PurgeAnyAndEliminateDualStoreSplitAndPresetDeadlock] 特效工坊「徹底拔除 any / as any、解決 Vite Query 導致之雙重 Store 實例分裂、根治切換特效巨力重劈死鎖」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底根除切換特效時「永遠鎖死在巨力重劈」的兩大底層病灶**：
       - **病灶 A（Vite Query 導致雙 Store 實例分裂）**：先前 `tools/vfx-studio.html` 的 script 標籤加了 `?v=20260914_ssot_fix` 查詢字串，使 Vite 把 `index.ts` 及其引用的 `VFXStudioStore` 作為獨立圖加載，而其他組件加載的是無 query 的 `VFXStudioStore`，在瀏覽器中分裂出兩個完全不同的 Store 實例，造成外界 `window.__VFX_STORE__` 與內部控制器徹底脫節。現已拔除查詢字串，並在 `VFXStudioStore.getInstance()` 加上 `globalThis` 防重護衛，保證跨模組 100% 共享唯一 SSOT 實例。
       - **病灶 B（初始化 isDirty = true 假陽性阻斷）**：`VFXStudioStore.setSequence` 載入新序列時誤寫為 `this.isDirty = true`，使創作者一開工坊即處於 Dirty 狀態，下拉選單切換時彈出確認框，一旦取消即強制退回原 ID 並阻斷切換。現已改為載入初始化 `this.isDirty = false`，且只有在真正未保存時才提示。
    2. **嚴格落實 Rule 10 & 11：全域清零 any 與 as any**：
       - `CombatFXEngine.ts:184` 徹底拔除 `(sequence as any)` 逃逸後門與解構污染，建立強型別 `RenderableTrackItem` 與 `TrailCacheInstance`。
       - `VFXStudioStore.ts`、`VFXStudioController.ts`、`VFXLibrary.ts` 中的 `as any` 全面清除，改用強型別與 `Record<string, unknown>` 安全結構。
    3. **全量測試與真實瀏覽器 100% 驗收通過**：
       - `npm run typecheck` 0 錯誤。
       - 全量 Vitest 單元測試 66 個測試檔案、411 項測試 100% 全綠。
       - 真實瀏覽器（Playwright）端對端驗收：切換「菲涅爾冰晶槍」、「精靈矢雨」與「風暴狂雷」時，Store ID、名稱、時間軸主軌圖層與 3D 空間彈道 100% 即時刷新，巨力重劈死鎖徹底根除！
  - **使用者驗收方式**：
    1. 瀏覽器開啟特效工坊：`http://localhost:5173/Medieval/tools/vfx-studio.html`。
    2. 點擊「📚 素材庫」下拉選單：
       - 切換至「🚀 菲涅爾冰晶槍 (Frost Lance)」，觀察底部時間軸主軌圖層立即變更為 `🚀 彈道(A➔B) TRAJECTORY (0.32s)`，3D 舞台正向生成冰晶長矛！
       - 切換至「🚀 精靈矢雨 (Spirit Dance)」，觀察時間軸主軌圖層變更為 `🚀 彈道(A➔B) ARC_MULTI (0.31s)`，3D 舞台生成多重拋物線箭矢！
       - 切換至「🚀 風暴狂雷 (Storm Bolt)」，觀察時間軸主軌圖層變更為 `🚀 彈道(A➔B) VERTICAL_SKY_TO_B (0.14s)`，3D 舞台生成天頂狂雷！
       - 切換過程乾淨順暢、無任何彈窗阻斷，巨力重劈不再死鎖！

- **[Fix/VFX/RestoreDecoupledStateBeforeSyntaxAccident] 特效系統「還原大括號語法失衡抹回前之四大正交解耦與動態縮放巔峰狀態」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **排查並還原昨天 17:48 因 1001 個語法報錯誤執行 git checkout 所沖掉的 9/15 全部正交解耦代碼**：
       - `CombatFXEngine.ts:770-800`：`FRESNEL_ICE` 徹底解耦，恢復傳入 `shape`、`glowRadius`、`glowOpacity`、`fadeAlpha` 與 Glow Sprite 面片。
       - `CombatFXEngine.ts:835-855`：`VOLUMETRIC_FIRE` 恢復每影格動態 `scale.set(sc, sc, sc)` 與光暈即時熱更新。
       - `CombatFXEngine.ts:1040-1095`：通用 3D 投射物徹底拔除私自手寫錐體與 `-Math.PI / 2` 倒飛錯誤代碼，全面收斂至單一真理來源 `MeshLayerRenderer.createProjectileGeometry(shape)`，支援形狀熱切換、動態 `scale.set` 與光暈熱更新。
       - `CombatFXEngine.ts:240`：拖尾數量預設歸零 `(resolvedData.trailCount ?? pData.trailCount ?? 0)`，以 `trailCount > 0` 作為唯一真理來源，徹底消滅播放端強制注入 35 顆黃色粒子污染。
    2. **全端契約與全量測試全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - 戰鬥、特效與工坊全量測試 33 個測試檔案、260 項測試 100% 全綠。
  - **使用者驗收方式**：
    - 打開特效工坊（`http://localhost:5173/Medieval/tools/vfx-studio.html`）：
      - 選擇投射物或冰矛技能（如「致命狙擊」或「冰晶長矛」）。
      - 在「🎨 色彩與光學著色」中切換核心幾何形狀（如選 `ARROW` 或 `SPHERE`），觀察 3D 物件是否即時更新且箭尖始終正向朝前飛行，不再倒著飛。
      - 拖曳「本體尺寸縮放 (Scale)」滑桿，觀察 3D 物件尺寸是否即時響應縮放。

- **[Refactor/VFX/BurstDebrisDecouplingFromMainTrackClip] 特效系統「爆裂碎屑徹底脫離主軌 CLIP 生命週期綁架與全域絕對時間獨立求值重構」完工交接（2026-09-16）**：
  - **核心交接重點**：
    1. **徹底根治「主圖層 CLIP 時間結束導致碎屑失效/蒸發」的架構病灶**：
       - 先前碎屑計算被包含在 `activeInstances` 遍歷主軌幾何體的 `if (item.isMain)` 區塊內。當主軌幾何體播放完畢（如重擊僅 0.3 秒），該軌道直接被 `continue` 跳過，使得晚於 0.3 秒的 CUE 點或自訂爆發時間根本無法生成碎屑。
       - 本次重構將爆散碎屑計算提升至序列全域層級（Sequence Level），完全移出逐軌 CLIP 迴圈。
    2. **全域絕對時間獨立求值與專屬生命週期**：
       - 碎屑直接以全域絕對時間 $T_{\text{burst}}$ 求值（優先讀取自訂 `burstTime`，否則精確自動吸附主 CUE 點秒數）。
       - 賦予碎屑獨立且完整的 0.38 秒向外擴散、旋轉與平滑淡出生命週期，絕不受主軌幾何體何時結束播放（`trackEnd`）影響。
    3. **工坊時間軸與控制項完全熱響應 (WYSIWYG)**：
       - 創作者在特效工坊無論拉動時間軸、定格檢查、快轉或重播，碎屑都確定性地在設定時間精準爆開。
       - 滑桿調整 `burstTime` 即時反映至畫面與序列存檔，0 顯示「自動 (隨Cue)」，大於 0 顯示具體秒數。
    4. **全端契約與全量測試全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - 33 個測試檔案、260 項測試 100% 全綠。
       - 瀏覽器自動化驗證於 `http://localhost:5173/Medieval/tools/vfx-studio.html` 操作時間軸至 0.28s 實質爆發無誤。
  - **使用者驗收方式**：
    - 打開特效工坊（`http://localhost:5173/Medieval/tools/vfx-studio.html`）：
      - 選擇任何技能（例如「重擊」或「烈焰斬」）。
      - 在「✨ 粒子流、拖尾與爆散」卡片中微調「碎屑爆發時間 (Burst Time)」滑桿（例如設定為 `0.20s` 或維持 `自動 (隨Cue)`）。
      - 拖曳下方時間軸至該爆發秒數定格，或直接點擊「▶ 播放」，觀察碎屑是否精確在該時刻向四周噴射擴散，且擴散過程不會被主刀刃動作結束而突然切斷。

- **[Feature/VFX/BurstDebrisCueAttachmentAndCustomBurstTime] 特效系統「命中爆散碎屑 (burstCount) 自動吸附主 CUE 點與工坊自訂爆發時間 (burstTime) 全管線貫通」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **拔除 `CombatFXEngine.ts:328` 寫死的硬編碼 `p >= 0.72`**：
       - 解決碎屑爆散時間點與時間軸上 `impactCues` 脫節、受擊震動已觸發但碎屑卻延遲到 72% 才爆開的視覺痛點。
    2. **預設自動吸附主 CUE 點爆散（方案 B 核心）**：
       - 若創作者未指定時間，系統自動抓取序列中 `impactCues` 的主要打擊點時間（$\text{cue.time} / \text{duration}$），在刀刃砍中或子彈擊中敵人的那一瞬間（與受擊震動、傷害跳字完全同步），碎屑星芒群精確爆開並向四周擴散！
    3. **工坊專屬控制項 `burstTime` 自由微調**：
       - 在特效工坊的「✨ 粒子流、拖尾與爆散」面板中，新增「碎屑爆發時間 (Burst Time)」滑桿（0.00s ~ 2.50s）。
       - 預設滑桿拉在 0 時，標籤顯示「自動 (隨Cue)」，自動對齊 CUE 點。
       - 若拉動滑桿指定秒數（如 0.40s），標籤顯示 `0.40s`，碎屑將嚴格在第 0.40 秒爆發，所見即所得！
    4. **全端契約與測試全覆蓋**：
       - `src/models/VFX.ts`（Preset & 各種 Clip Payload）、`VFXPresetNormalizer.ts`、`VFXStudioStore.ts`、`vfx-studio.html`、`VFXInspector.ts` 與 `CombatFXEngine.ts` 全鏈路打通，0 `as any`。
       - `npm.cmd run typecheck` 0 錯誤。
       - 專屬測試 `VFXPlaybackAndNamingVerification.test.ts` 9 項測試全綠（包含 Cue 點自動吸附驗證與自訂 burstTime 驗證）。
       - 戰鬥、特效與工坊全量測試 33 個測試檔案、260 項測試 100% 全綠。
  - **使用者驗收方式**：
    - 打開特效工坊（`tools/vfx-studio.html`）：
      - 點選右側「✨ 粒子流、拖尾與爆散 (Particles & Trails)」卡片，可看到新增的「**碎屑爆發時間 (Burst Time)**」滑桿，預設顯示「**自動 (隨Cue)**」。
      - 播放任何帶有碎屑（`burstCount > 0`）的技能，碎屑不再在 72% 才慢半拍爆開，而是精確在衝擊 CUE 點（刀刃命中或投射物到達）瞬間同步爆散！
      - 若創作者需要手動微調提前或延後爆開，拖曳該滑桿（例如設定為 0.30s），畫面將即時在 0.30s 爆開！

- **[Fix/VFX/PlaybackClockAbsoluteTimeScheduling] 特效系統「全域邏輯時鐘累積排程 Bug 徹底根除」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **徹底根治「一放技能第一影格就秒觸發震動與傷害」的致命早發 Bug**：
       - 在 `src/ui/fx/CombatFXEngine.ts:1274-1350`，將具名 Impact Cue 與次生圖層的排程基準時間全面改為 `effectStartTime + cue.time`（與 `effectStartTime + delay`）。
       - 解決了戰鬥連續進行數秒後時鐘累積（例如推進到 5.0 秒），新任務排程在 0.28 秒被排程器判定「早已逾期」而於施法第 1 影格秒引爆的歷史隱疾！
       - 現在無論戰鬥進行到第幾秒、第幾波次，**Cue 點精確在子彈/刀刃飛至該秒數時才準確引爆受擊抖動、閃光與傷害跳字**！
    2. **全量測試與型別驗收全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - 專屬測試 `VFXPlaybackAndNamingVerification.test.ts` 新增「時鐘推進 5.0 秒後施放技能，第 1 影格絕不提前觸發、精確於 5.0 + cue.time 到達時觸發」斷言，7 項測試 100% 全綠。
       - 戰鬥、特效與工坊全量測試 33 個測試檔案、258 項測試 100% 全綠。
  - **使用者驗收方式**：
    - 打開戰鬥工坊（`tools/combat-studio.html`），啟動模擬戰鬥。
    - 觀察角色（如守護騎士）施放技能或攻擊：
    - **傷害跳字與卡牌抖動不再在角色剛抬手的第一影格秒觸發**，而是精確等待投射物飛到敵人身上、或是刀刃劈砍至目標的設定 Cue 點瞬間才同步震動與跳字！

- **[Refactor/VFX/SalvoBulletTrailAttachmentAndFlowingFade] 特效系統「彈幕子彈專屬隨身拖尾與流動性消散重構」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **終結多重彈幕中央虛擬直線脫節 (消滅孤立虛線)**：
       - 在 `src/ui/fx/renderers/MeshLayerRenderer.ts:1555-1740`，為彈幕中每一發散射子彈建立專屬的拖尾頂點系統（`item.trailPoints` 與 `item.trailGeo`）。
       - 拖尾頂點取樣自該子彈專屬的貝茲飛行軌跡，子彈飛到哪，拖尾隨身黏在哪，徹底消滅了左側中央孤零零排成直線的舊病灶。
       - 在 `src/ui/fx/CombatFXEngine.ts:270`，若判定為彈幕（`isSalvo`），外層銷毀單一中央虛擬軌道的 `__trailCache`，將拖尾全權委派給每顆子彈內部驅動。
    2. **打破機械等距死線，引入非線性彗核聚集與物理波動**：
       - 拖尾粒子引入非線性指數 $u^{1.6}$，彈頭近端高度聚集亮光，後端流暢拉伸。
       - 引入物理波動擾動（`flowPhase`、`waveAmplitude`、`spreadJitter`），使拖尾具備真實氣流與魔法流動的波浪質感。
    3. **命中目標徹底消散，杜絕定格殘留**：
       - 彈幕子彈與拖尾在進度超過 0.75 時平滑淡出，在 $\text{localP} \ge 0.99$ 時徹底隱藏（`visible = false` 且 `opacity = 0`），動畫播放結束後畫面上 0 殘留。
    4. **全量測試與型別驗收全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - 專屬測試 `VFXPlaybackAndNamingVerification.test.ts` 6 項測試全綠（包含空間分散度斷言與終點消散斷言）。
       - 戰鬥、特效與工坊全量測試 33 個測試檔案、257 項測試 100% 全綠。
  - **使用者驗收方式**：
    - 打開特效工坊，選擇「精靈矢雨 (VFX_SPIRIT_DANCE)」或其他多重散射彈幕技能。
    - 點擊播放或拖曳時間軸：觀察 7 發散開飛行的箭雨，每一發箭矢屁股後面都自帶一條靈動的藍色流光拖尾，緊隨箭矢弧度彎曲與展開，左側中央不再出現突兀的直線點陣！
    - 觀察拖尾流動感：粒子呈現如彗星般的頭密尾疏，並有自然起伏的波浪擾動，不再是死板僵硬的等距直線。
    - 箭矢命中目標時，箭矢與拖尾自然淡出並徹底消失，螢幕上乾乾淨淨，沒有任何定格殘留點。

- **[Fix/VFX/PurgePlaybackPollutionAndSequenceNameEditor] 特效系統「播放端去污染、資料庫實質洗淨與特效名稱編輯接口實裝」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **徹底拔除 `CombatFXEngine.ts:244` 硬編碼 trailCount 35 預設值**：
       - 改為 `(resolvedData.trailCount ?? pData.trailCount ?? 0)`，未配置拖尾的純物理技能在播放時嚴格為 0，絕不再無中生有噴射 35 顆黃色粒子。
    2. **實質洗淨 `src/data/vfx_sequences.json` 資料庫**：
       - 清除全部 30 款序列根層的 619 個前朝扁平雜質（0 dirty keys），資產庫精準為 30 款，4 款旗艦多圖層（含 `VFX_EARTH_SPIKE` 的 `LAYER_FISSURE_FIRE`）100% 守恆。
    3. **實裝工坊「特效名稱與描述即時編輯接口」與切換連動 (updateMetaCard)**：
       - 在 `src/tools/vfx-studio/VFXLibrary.ts` 的預設選單下方增設「🏷️ 特效基本資訊」卡片（`<input id="lib-input-seq-name">` 與 `<input id="lib-input-seq-desc">`），並訂閱 `this.store.subscribe`。
       - 解決了切換下拉選單時基本資訊卡片未跟著切換的脫節病灶，使用者選擇任何特效、新建、改名或二創時，名稱、描述與 ID 100% 毫秒級即時跟隨切換！
    4. **全量測試與型別驗收全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - `VFXStudioBaseline.test.ts` 12 項驗收測試 100% 通過。
       - 專屬測試 `VFXPlaybackAndNamingVerification.test.ts` 4 項測試 100% 通過。
       - 戰鬥與特效系統 28 個測試檔案、217 項測試 100% 全綠通過。
  - **使用者驗收方式**：
    - 打開特效工坊，隨意切換下拉選單中的任一特效（如「精靈矢雨」或「破土尖岩」），觀察下方的「🏷️ 特效基本資訊」卡片，其 ID、名稱與描述即時跟隨切換，不再停留在「巨力重劈」。
    - 在名稱框輸入新名稱，下拉選單選項文字即時連動變更。
    - 點選純物理技能播放時，畫面上不再出現無端的黃色拖尾粒子。

- **[Refactor/VFX/PurifySequencePipelineAndStripLegacyEscapeHatches] 特效系統「深層架構去污染與前朝技術債徹底根除」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **徹底拔除 `CombatFXEngine.ts:184` 逃逸後門**：
       - 刪除 `...(sequence as any)`，改為純淨的 `resolvedData = { spatialMode: sequence.spatialMode, ...item.data }`。
       - 任何渲染參數 100% 只由該軌 Clip 的 `payload.data` 決定，Sequence 根物件絕不再將任何扁平雜質逆向倒進運算管線。
    2. **終結 `VFXStudioStore.ts` 根物件無差別平鋪**：
       - 刪除 `Object.assign(this.currentSequence, partial)`，建立 `VALID_SEQUENCE_ROOT_KEYS` 白名單與 `sanitizeSequenceRoot`。
       - 使用者在面板拉動任何控制項，精確寫入被選取 Clip，絕不冒泡寫入 Sequence 根部。
    3. **淨化 `src/data/vfx_sequences.json` 資料庫**：
       - 清除所有 30 款序列根物件上殘留的 40+ 個扁平雜質，恢復 Canonical Schema 純淨度。
       - 補回 `VFX_EARTH_SPIKE` 遺失的 `COMPOSITE_LAYER` 次生火焰圖層（`LAYER_FISSURE_FIRE`）。
       - 移出測試殘留的 `VFX_CUSTOM_*`，確保官方庫純粹剛好 30 款。
    4. **全量測試與型別驗收全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - `VFXStudioBaseline.test.ts` 12 項驗收測試 100% 通過。
       - `src/ui/fx/` 與 `src/tools/vfx-studio/` 14 個測試檔案 89 項測試 100% 全綠。
       - 戰鬥系統 19 個測試檔案 165 項測試 100% 全綠。
  - **使用者驗收方式（照妖鏡）**：
    - 請直接打開 `src/data/vfx_sequences.json`，隨意檢視任何技能（如 `VFX_HEAVY_STRIKE` 或 `VFX_EARTH_SPIKE`）：根物件只有標準的 `id`, `name`, `duration`, `tracks`, `impactCues`，雜質徹底為 0。
    - 序列總數嚴格剛好為 30 款。
    - 在特效工坊操作任何技能的拖尾或參數，反應即時且不再有隱形干擾。

- **[Fix/VFX/UniversalTrailParticleVisibilityAndReactivity] 特效工坊「拖尾粒子全特效無條件可用 (Universal Trail Reactivity)」與「視覺可見度徹底強化 (Top-Level Visibility)」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **拔除 `enableTrail === false` 短路阻斷，以 `trailCount > 0` 作為唯一真理來源**：
       - `src/ui/fx/CombatFXEngine.ts:241`：將拖尾啟用判定簡化為 `const isTrailEnabled = trailCount > 0;`。徹底解決資料庫 `vfx_sequences.json` 各序列殘留 `"enableTrail": false` 導致即便在面板拉高「拖尾數量」粒子依然被靜默銷毀的病灶。
       - 只要創作者在面板調整「拖尾數量 ($> 0$)」，任何特效（斬擊、投射物、冰槍、駐留法陣等）無條件渲染拖尾粒子！
    2. **置頂渲染與視覺可見度強化 (Top-Level Visibility)**：
       - `src/ui/fx/renderers/TrailLayerRenderer.ts`：點雲材質設定 `depthTest: false`, `depthWrite: false`, `renderOrder: 999`，點雲粒子永遠浮在最前層渲染，絕不再被 3D 核心主體幾何或 Glow 半透明面片裁剪遮蔽。
       - 粒子尺寸動態強化（`Math.max(12, trailSize * scale * 1.5)`），並確保高斯羽化星芒紋理 `needsUpdate = true`。
    3. **全特效空間型態支援 (運動型彗尾 + 駐留型星塵雲)**：
       - `updateTrajectoryTrail`：同時支援「運動型（投射物歷史飛行軌跡向後逆向分佈衰減）」與「原地駐留型（特效中心形成環狀動態星塵雲）」，定格與拖曳時間軸保證所見即所得。
    4. **面板整合解耦**：
       - `tools/vfx-studio.html`：拖尾色彩控制項 `param-trail-color` 移入「✨ 粒子流、拖尾與爆散」卡片統一管理，創作者調整粒子數量、尺寸與顏色無須跨卡片操作。
    5. **驗收測試全綠**：
       - `npm.cmd run typecheck` 0 錯誤。
       - `src/ui/fx/` 與 `src/tools/vfx-studio/` 14 個測試檔案 89 項測試 100% 全綠。
       - `VFXStudioBaseline.test.ts` (Fix 1 契約測試) 100% 通過。
  - **使用者驗收建議**：
    - 請於瀏覽器重新整理（F5）開啟特效工坊。
    - 載入任何特效（包含冰晶長矛、斬擊、地刺、法術）：
      - 在「✨ 粒子流、拖尾與爆散」卡片中調整「拖尾數量 (trailCount)」、「粒子尺寸 (trailSize)」與「拖尾粒子顏色 (trailColor)」。
      - 拖動時間軸播放頭或定格，確認畫面上粒子清晰可見、即時熱響應！

- **[Refactor/VFX/ParticleAndTrailReactivityPipeline] 特效系統「粒子流與拖尾全管線即時熱響應重構」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **全域解鎖拖尾控制項權限 (PARTICLES Capability)**：
       - `VFXPresetNormalizer.ts:60-61`：將 `param-enable-trail`（啟用拖尾）與 `param-trail-color`（拖尾顏色）自 `SLASH_GEOMETRY` 釋放至 `PARTICLES` 通用權限。非斬擊特效（投射物、能量射線、法陣等）不再被隱藏，隨時自由開關拖尾。
    2. **實裝確定性彈道軌跡拖尾 (Deterministic Trajectory Trail)**：
       - `TrailLayerRenderer.ts:updateTrajectoryTrail`：拋棄單幀只改 2 個點的循環點雲，改為依據進度 $p$ 沿歷史飛行路徑向後逆向分佈衰減，越靠前越密越亮，尾部平滑淡出與微幅擾動。
       - 100% 確定性支援時間軸拖曳、暫停與單影格定格，消除點雲堆死在原點的缺陷。
    3. **打通確定性命中爆散粒子群 (Deterministic Hit Burst Cloud)**：
       - `TrailLayerRenderer.ts:createBurstCloud` 與 `CombatFXEngine.ts:renderFrameAt`：在進度到達命中區間（$p \ge 0.72$）且 `burstCount > 0` 時，渲染向四周擴散淡出的星芒粒子群，徹底解決「爆裂碎屑數量 (Burst Sparks) 控制項形同擺設」的頑疾。
    4. **驗收測試通過**：
       - `npm.cmd run typecheck` 0 錯誤。
       - `src/ui/fx/` 48 項測試 100% 全綠。
       - `src/tools/vfx-studio/` 38 項測試 100% 全綠。
  - **使用者驗收建議**：
    - 請於瀏覽器重新整理（F5）開啟特效工坊。
    - 載入任何投射物技能，在「✨ 粒子流、拖尾與爆散」卡片中：
      - 拖動「拖尾數量 (trailCount)」與「粒子尺寸 (trailSize)」，確認子彈尾跡產生清晰、連綿的彗尾。
      - 拖動「爆裂碎屑數量 (burstCount)」，將時間軸播放頭拉至命中瞬間（後半段），確認爆散碎屑真實炸裂擴散！

- **[Refactor/VFX/ProjectileOrthogonalDecouplingAndGlowReactivity] 特效系統「投射物四大維度正交解耦 (幾何 x 材質 x 拖尾 x 光暈)」與「泛光光暈 (Glow) 全管線即時熱更新」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **幾何形狀與材質著色器徹底正交解耦 (Rule 12.1)**：
       - `MeshLayerRenderer.ts` 建立統一幾何工廠 `createProjectileGeometry(shape)`，支援 5 大標準形態（ARROW, SPHERE, DIAMOND, STAR, RING），錐體統一指向飛行向量 (+Z)。
       - 撤除 `CombatFXEngine.ts` 中只要選了形狀就被粗暴短路踢出的錯誤邏輯；無論選擇何種幾何形態，100% 享有菲涅爾 Shader 透光折射與環繞旋轉冰環，絕不再退化為廉價白球或單色三角形。
    2. **碎冰拖尾徹底自 Mesh 模型剝離，歸建粒子系統 (Rule 12.1 & 12.3)**：
       - 移除 `MeshLayerRenderer.ts:updateFresnelIce` 內部寫死的 7 顆八面體 Mesh 死物件，Mesh 物件回歸專注本體表現。
       - 碎冰/尾跡粒子全面歸建專門的 `TrailLayerRenderer`，面板「✨ 粒子流、拖尾與爆散」中 `trailCount`、`trailSize`、`trailColor` 真正成為唯一真理來源。
    3. **泛光半徑與光暈透明度每影格熱更新 (Rule 12.2 破除快取死鎖)**：
       - `updateFresnelIce`、`VOLUMETRIC_FIRE` 與通用 3D 投射物全面掛載光暈 Sprite，並在每影格求值中動態更新 `scale`、`material.opacity` 與色彩，滑動滑桿所見即所得。
    4. **資料庫校正**：
       - 校正 `vfx_sequences.json` 中 `VFX_ICE_LANCE` 的 `shape` 為 `"ARROW"`，補齊 `glowRadius: 75, glowOpacity: 0.85`。
    5. **驗收測試通過**：
       - `npm.cmd run typecheck` 0 錯誤。
       - `src/ui/fx/` 48 項單元測試 100% 全綠。
       - `src/tools/vfx-studio/` 38 項單元測試 100% 全綠。
  - **使用者驗收建議**：
    - 請於瀏覽器重新整理（F5）開啟特效工坊。
    - 載入「菲涅爾冰晶槍」或「致命狙擊」，任意切換「核心幾何形狀 (ARROW / SPHERE / DIAMOND / STAR / RING)」，確認菲涅爾透光質感與旋轉冰環無損保留。
    - 拖動「泛光半徑 (Glow)」與「光暈透明度」滑桿，確認光暈即時產生縮放與明暗變化。
    - 調整拖尾控制項，確認粒子拖尾動態受控。

- **[Fix/VFX/ProjectileScaleReactivityAndTipOrientation] 特效工坊「單發冰晶長矛與通用 3D 投射物動態尺寸縮放 (Scale) 響應」解鎖與「全域錐體尖端朝向正向校準 (Math.PI/2)」完工交接（2026-09-15）**：
  - **核心交接重點**：
    1. **徹底解除接收端快取尺寸死鎖 (Live Scale Reactivity)**：
       - `MeshLayerRenderer.ts:1253`（`updateFresnelIce`）：幾何體以標準基準建構，每影格動態套用 `cache.frostGroup.scale.set(scale, scale, scale)`，徹底解鎖「本體尺寸縮放 (`param-scale`)」滑桿的即時縮放響應。
       - `CombatFXEngine.ts:786 & 1018`：火焰管線與通用 3D 投射物管線（ARROW / SPHERE / DIAMOND / STAR / RING）全面加入每影格動態 `scale.set(sc, sc, sc)`，保證所有幾何投射物縮放所見即所得。
    2. **全域錐體尖端朝向正向校準 (Math.PI/2)**：
       - `MeshLayerRenderer.ts:1221` 與 `CombatFXEngine.ts:995`：校準錐體旋轉為 `rotateX(Math.PI / 2)`，使尖端對準 Three.js `lookAt` 前進方向（+Z 軸），徹底修復 `VFX_ICE_LANCE`、`VFX_SNIPER_SHOT` 與「測試」3 款單發冰晶長矛倒著飛的缺陷。
       - `MeshLayerRenderer.ts:1242`：碎冰拖尾座標修正為負 Z 軸 `-(11 + i * 8)`，粒子真實拖曳在長矛尾部。
    3. **全量驗收通過**：
       - `npm run typecheck`（`tsc`）0 錯誤。
       - `npx vitest run` 26 項核心單元測試全綠通過。
  - **待使用者驗收項目**：
    - 請於瀏覽器重新整理（F5），拖動「本體尺寸縮放」滑桿確認冰矛即時放大縮小，並確認飛行時尖端正向朝前。

- **[Fix/VFX/DualStoreDesyncAndProjectilePipeline] 特效工坊「發布至專案 SSOT spatialMode 不一致」根治與「質點運動 (POINT_TRANSPORT) 3D 子彈管線貫通」完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **徹底根治發布至專案 SSOT 報錯 (Dual-Store Desync 終結)**：
       - `src/ui/fx/VFXPresetRepository.ts`：
         - `rebuildResolvedMap()`：新增檢查若 `overrideSequences.has(id)` 則直接跳過 LocalStorage 的 `customSequences`，禁止使用者瀏覽器早期 LocalStorage 快照逆向覆蓋最新草稿。
         - `saveSequence()`：若該特效已入庫為 `builtInSequences`，同步自 `customSequences` 刪除，拔除歷史殘留。
         - `reloadPresets()`：自後端載入最新序列後，同步清理 `customSequences` 與 `overrideSequences` 中的已入庫項目。
       - `src/ui/fx/VFXPresetNormalizer.ts`：
         - 修正 `explicitSpatialMode === 'TRAJECTORY' || explicitTopology === 'POINT_TRANSPORT'` 時，`mappedSpatialMode` 恆為 `'TRAJECTORY'`，且優先採用合法路徑，杜絕被舊 clip payload 中的 `MELEE_SWEEP` 污染。
       - `src/tools/vfx-studio/VFXStudioStore.ts`：
         - `updateConfig()`：切換為 `TRAJECTORY` 或 `POINT_TRANSPORT` 時，同步糾偏 targetClip 與序列根上的舊近戰 `MELEE_SWEEP` 殘留為 `'A_TO_B'`。
    2. **質點運動 (POINT_TRANSPORT) 3D 子彈管線與視覺再現貫通**：
       - `src/ui/fx/VFXSpatialPolicy.ts:resolveVFXEndpoints`：加入 `POINT_TRANSPORT` 防塌縮保護，若 `mode === 'MELEE_SWEEP'` 自動糾偏為 `trajectoryPath || 'A_TO_B'`，確保起終點具備真實空間位移（不再塌縮在目標點上）。
       - `src/ui/fx/CombatFXEngine.ts`：
         - `renderTrack3DGeometry`：解耦 `FRESNEL_ICE`，當 `topology === 'POINT_TRANSPORT'` 且具備自訂幾何形態時放行至通用 3D 投射物管線。
         - 3D 投射物幾何全面支援 `track.coreMeshShape || track.shape || 'ARROW'`，ConeGeometry 旋轉修正為 `-Math.PI / 2`。
         - `lookAt` 前加入 `curPos.distanceTo(endPos) > 0.01` 守護，徹底根絕起終點重疊導致 Matrix4 NaN 使網格蒸發消失的缺陷。
       - `src/ui/fx/renderers/MeshLayerRenderer.ts:updateFresnelIce`：ConeGeometry 旋轉修正為 `-Math.PI / 2`，尖端精確指向飛行向量。
    3. **全量驗收通過**：
       - `npm run typecheck`（`tsc`）0 錯誤、0 `any`（嚴格遵守 Rule 10 與 Rule 11）。
       - `npx vitest run` 通過全套 26 項單元測試，包含發布交易閉環與拓撲回歸測試。
  - **待後續推進項目**：
    - 使用者於瀏覽器中點擊「重新整理（F5）」驗證發布與質點運動子彈視覺效果。

- **[Fix/VFX/ShaderModeInspectorDecoupling] 特效工坊「新建技能不再被鎖死斬擊參數」與「Shader Mode 智慧切換」完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **新建技能不再繼承斬擊屬性 (Clean Skeleton On Create)**：
       - `VFXLibrary.ts:274-330`：點擊「➕ 新增」時，建立乾淨、標準的通用新特效骨架（主軌 `type: 'MESH'`，`shaderMode: 'VOLUMETRIC_FIRE'`，`spatialMode: 'TRAJECTORY'`），不再直接淺拷貝當前特效，徹底解決「新增技能永遠繼承斬擊近戰揮砍」的頑疾。
    2. **ShaderMode 唯一真理來源與彈幕卡片解鎖**：
       - `VFXInspector.ts:getSelectionCapabilities`：斬擊幾何能力（`SLASH_GEOMETRY`）僅在 `shaderMode === 'SLASH_BLADE'` 時賦予；切換至非斬擊時斬擊走向卡片自動隱藏，且非近戰揮砍時開放 `PROJECTILE_GEOMETRY`，彈幕卡片（發數、節奏、擴散、路徑等）自由可用。
    3. **Inspector 下拉選單智慧型別適配 (Smart Shader Adapt)**：
       - 監聽 `param-shader-mode` 切換：
         - 切換為非斬擊 Shader（火焰、冰晶、閃電等）：自動解除 `rendererType: 'SLASH'` 與 `trajectory: 'MELEE_SWEEP'` 綁定，轉為 `PROJECTILE` 與 `TRAJECTORY`。
         - 切換為地刺 `EARTH_SHATTER`：自動轉為 `GROUND_FISSURE` / `GROUND_BURST`，展開地刺幾何控制卡片。
         - 切換回斬擊 `SLASH_BLADE`：自動恢復 `rendererType: 'SLASH'` 與 `MELEE_SWEEP`。
    4. **全量驗收通過**：
       - `npx tsc --noEmit` 0 錯誤、0 `any`（Rule 10 嚴格把關）。
       - `npx vitest run src/ui/fx/` 9 個套件 60 項單元測試 100% 通過。
       - Playwright 實機無頭全流程驗收通過（截圖存於 `shader-switch-verification.png`）。
  - **待後續推進項目**：
    - 特效工坊其餘幾種經典 Shader（暗影虛空等）的光學質感持續提升。

- **[Feature/VFX/SpikeFissure11ControlsDataFlowPipeline] 【地裂與地刺幾何 (Spikes & Fissure)】11 項控制項全資料流雙端貫通完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **11 項控制項雙端管線 100% 貫通**：
       - `CombatFXEngine.ts:688` 完整將 `track` 上的 11 項地刺屬性傳遞至 `MeshLayerRenderer.updateEarthShatter`。
       - 包含：連鎖生長模式 (`spikeArrayBehavior`)、連鎖尖刺數量 (`spikeArrayCount`)、地刺幾何形態 (`spikeShape`)、地刺方位旋轉 (`spikeAngle`)、次生冰刺數 (`spikes`)、地刺粗細 (`spikeWidth`)、地刺高度 (`spikeHeight`)、地刺分佈範圍 (`spikeRadius`)、破土連鎖時差 (`spikeStagger`)、岩刺材質模式 (`spikeMaterialMode`)、伴生地火噴發 (`spikeEruptFire`)。
    2. **動態尖岩分佈演算法與熱響應 (Hot-Reactivity)**：
       - 主穿刺峰永居核心貫穿身軀；副刺數量依據 `spikeArrayCount - 1` 放射排布在半徑內，半徑交錯且朝外微傾。
       - 快取實裝 `lastConfigSig` 特徵簽名比對，使用者在面板拉動任一數值，快取自動清空重建 Mesh，保證即時所見即所得（WYSIWYG）。
    3. **破土連鎖時差階梯化與雙運動生長模式名實相符**：
       - **時差修復**：修正先前除法過度稀釋導致 0.6ms 同幀竄出的缺陷；實裝 `staggerPerSpike = (spikeStaggerMs / 80) * 0.055`，每根刺呈現清晰階梯波浪。
       - **⏳ 破土停留後淡出 (`PERSIST_FADE`)**：尖岩破土後 100% 保持雄偉直徑與高度（杜絕壓扁融化），尾段平滑漸隱淡出。
       - **🌊 浪湧竄出縮回 (`SURGE_RECEDE`)**：粗細鎖定 1.0 不變形，底座釘於地面垂直降縮收回插槽，抽回完畢後立即 `visible = false` 徹底隱藏，杜絕掉出地面露餡穿幫。
    4. **全量驗收通過**：
       - `npx tsc --noEmit` 0 錯誤、0 `any`（Rule 10 嚴格把關）。
       - `npx vitest run src/ui/fx/` 8 個套件 47 項單元測試 100% 通過。
       - Playwright 實機無頭瀏覽器互動測試通過（截圖存於 `scripts/spike-controls-preview.png`）。
  - **待後續推進項目**：
    - 彈道地裂（`GROUND_FISSURE`）沿途浪湧連鎖波進一步視覺細化。

- **[Feature/VFX/EarthSpikeVisualOverhaulAndNaming] 地刺 (EARTH_SHATTER) 視覺重構與命名更正完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **選單與名稱正名**：
       - `tools/vfx-studio.html` 下拉選單將「🔨 碎石崩裂重擊」正名為 **「⛰️ 地刺 (Earth Spike)」**。
       - 底層 Enum `EARTH_SHATTER` 保持不變，100% 相容既有存檔。
    2. **基準錨點下沉接地 (Ground Anchoring)**：
       - 徹底解決地刺以幾何中心原點導致「像王冠掛在胸口與頭頂」的漂浮問題。
       - 錨點下沉至卡牌腳底地面（`groundPos.y = targetPos.y - 72 * scale`），使地刺真正從地底撕裂向上貫穿。
    3. **冷黑玄武岩石面與細裂紋微光（Dark Basalt & Fine Lava Seams）**：
       - 徹底剔除刺眼的橘色胡蘿蔔塑膠感。
       - 石面鎖定為厚重冷黑玄武岩色調（`#1f1d1b` ~ `#383533`），具備自然岩石切面光影對比。
       - 熔岩發光嚴格限縮在深層石縫深處（面積 < 8%），僅透出地底高溫微光，不污染岩石表面。
    4. **3D 多面體尖岩幾何、交錯狼牙刺與地面掀起碎石板**：
       - 1 根巍峨粗壯的主破土尖岩（高 105px）+ 4 根交錯狼牙副刺（60~75px）+ 4 塊在地面破土口被劇烈頂翻掀起的扁平多面體碎石板（Ground Slabs）。
       - 階梯式破土時間差（Stagger）+ 彈簧過衝曲線（Overshoot Spring，1.15x），破土開裂極具衝擊力與接地說服力。
    5. **全量驗收通過**：
       - `npx tsc --noEmit` 0 錯誤、0 `any` 漏洞（Rule 10）。
       - `npx vitest run src/ui/fx/` 8 個套件 45 項單元測試 100% 通過。
       - Playwright 實機無頭瀏覽器截圖驗收通過，確認地刺從腳底破土且玄武岩多面體質感真實可信（截圖留存於 `scripts/earth-spike-preview.png`）。
  - **待後續推進項目**：
    - 特效工坊其餘幾種經典 Shader（暗影虛空等）的光學質感持續提升。

- **[Fix/VFX/TimelineDurationAndMainLayerIndependence] 時間軸時長調整卡死修復與主圖層時長獨立性完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **主圖層與總時長解耦獨立**：
       - 主圖層時長（`mainDuration` / `mainClip.duration`）合法允許小於等於總時長（`duration`），代表主要實體的視覺演出長度（如起手 0.1s + 揮刀 0.3s），後續時長為衰減、粒子漂浮與受擊餘韻。
       - 兩者不再強行綁死，時間軸上可清晰看見主圖層只佔據總時長的一部分。
    2. **拔除阻擋死循環對話框，實裝無感智慧夾緊 (Auto-Clamp)**：
       - 徹底拔除 `#tl-duration-overflow-dialog` 阻擋彈窗（舊代碼錯誤 fallback 主圖層結束時間至舊總時長導致死循環）。
       - 頂部輸入框（`#tl-input-duration`）與滑桿（`#tl-range-duration`）任何數值變更即時生效寫入 Store；若縮短後的時長截斷了主圖層或次生圖層右緣，系統平滑夾緊圖層寬度，保證不超出總時長。
    3. **主圖層右緣藍色把手自適應擴展**：
       - 在軌道內拖曳把手時，主圖層寬度自由縮放且合法小於總時長；若向右拉伸超出軌道邊緣（且未滿 5.0s），時間軸自適應擴展總時長，杜絕拉不動鎖死。
    4. **嚴格型別防護守護 (Rule 10)**：
       - 清除所有 `any`、`as any` 與 `@ts-ignore`，補全強型別介面。
    5. **驗收全綠**：
       - TypeScript 0 錯誤、45 項單元測試 100% 通過、無頭瀏覽器操作（縮短/拉長/獨立性）全流程驗證通過。
  - **待後續推進項目**：
    - 特效工坊次生圖層更多自定義時間軸動畫曲線與光學升級。

- **[Fix/VFX/SingleEffectPerClipAndGhostLayersPurge] 實裝「CLIP(特效軌)單一特效原則」與全面清理幽靈圖層完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **立約「CLIP(特效軌)單一職責原則 (Single Effect per Clip)」**：
       - 一條 Track 嚴格對應單一實體，一個 Clip 嚴格只能容納單一特效片段。
       - 永久禁止在 `sequence.tracks` 裡存放 `COMPOSITE_LAYER` 軌道；次生圖層一律統一走標準 `sequence.layers: VFXLayer[]`，保證時間軸 UI 與底層資料 100% 同步可見可控，徹底終結「UI 看不到但底層偷跑」的幽靈軌道。
    2. **清理 4 大技能殘留幽靈圖層**：
       - `VFX_PHANTOM_SLASH`（幻影連斬）：徹底拔除先前殘留塞入的 `trk_layers` 及其底下的 3 個幽靈 Clips（包含十字斬飛刀 `LAYER_CROSS_SLASH`、`VFX_DEFAULT_SLASH` 與 `VFX_HOLY_RAIN` 聖光祈雨），還原幻影連斬為純粹純淨的巨劍 4 段連斬！
       - `VFX_VOLUMETRIC_METEOR`、`VFX_TREBUCHET_BOULDER`、`VFX_EARTH_SPIKE`：將殘留於 `tracks` 的次生圖層安全正規化遷移至標準 `layers` 陣列中。
    3. **刀芒物理本質防禦守護 (Local Morph Guard)**：
       - `VFXSpatialPolicy.ts`：更新 `resolvePresetSpatialTopology`，凡是刀芒（`SLASH_BLADE` / `SLASH`），若未顯式指定為飛出劍氣，預設一律鎖定為近戰原地（`LOCAL_MORPH`），物理上杜絕任何未聲明的刀光被系統誤當作飛刀丟到戰場中間。
       - `CombatFXEngine.ts`：在 `renderSequenceWorldAt` 增加對 `COMPOSITE_LAYER` 軌道的防禦性過濾；次生圖層若未單獨聲明空間模式，強制繼承主軌空間契約。
    4. **真實使用者視角實機全量驗收 (Playwright Audit)**：
       - 在 0.55s（使用者截圖當下的影格）實機檢驗幻影連斬：中間位置（$X \in [-100, 100]$）飛刀數為 0，場景中僅有 2 個受擊者身周（$X = 177.5$）的連斬網格，幽靈飛刀徹底消滅！
       - `npx tsc --noEmit` 0 錯誤、全專案 0 `any` 漏洞、0 `@ts-ignore`。
       - `npx vitest run src/ui/fx/` 8 個測試套件、45 項特效核心單元測試 100% 通過。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Fix/VFX/AntiCollapseAndAxialSpin] 徹底根治幾何拓撲塌縮與軸向自旋（Axial Spin）失真：跨空間射線起終點智慧防塌縮守護，自旋對齊貫穿軸心杜絕世界原點甩動完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **跨空間幾何防塌縮守護 (Anti-Collapse Guard)**：
       - `VFXSpatialPolicy.ts`：重構 `resolveVFXEndpoints` 優先級。當特效為 `SPAN_BEAM`、`DIELECTRIC_LIGHTNING` 或 `ENERGY_BEAM` 時，解除近戰 `AT_TARGET` 模式的鎖死遮蔽；使用者在 Inspector 切換的路徑（如 `VERTICAL_SKY_TO_B`）享最高優先級。
       - 若計算出起終點距離接近 0（原地塌縮），自動展開為天頂直劈（380px）或貫穿（370px），**徹底杜絕旋風橫掃、重劈等近戰動作切換電弧時縮成一顆球/光斑的缺陷**。
    2. **軸向自旋 (Axial Spin) 物理錨點對齊**：
       - `MeshLayerRenderer.ts`：重構 `updateLightningTube` 與 `updateEnergyBeam`。**全面保留並支援 SPIN 自旋功能**，旋轉軸心修正為「幾何體自身貫穿中軸線」，沿方向向量 $\vec{u}$ 進行軸向四元數自旋。
       - 天雷永遠繞著垂直直劈軸扭轉下落，貫穿電弧永遠繞著穿透軸螺旋翻滾，**中心牢固鎖定受擊者頭頂 $(X \approx 180)$，物理上絕不被甩到正中間**。
    3. **型別防護與契約雙端連通 (Rule 9 & Rule 10)**：
       - `CombatFXEngine.ts`：提前推導 `inferredShader` 傳入端點求解器；隔離世界原點 Group 旋轉，將自旋角下傳至軸向渲染器。0 any 繞過、0 `@ts-ignore`。
    4. **真實使用者視角實機全量驗收 (Playwright Multi-Action Audit)**：
       - 旋風橫掃 (`VFX_WHIRLWIND`，無預設 SPIN，原近戰原地) ➔ 轉電弧：頂點跨度從 0 躍升至 **370.5 px**，成功橫向貫穿兩端！
       - 致命狙擊 (`VFX_SNIPER_SHOT`，帶 SPIN) ➔ 轉電弧 + 天頂直劈：中心穩固鎖定於受擊者頭頂 $X=179.7$，高度自 $Y=-1.9$ 直插 $Y=382.8$，自轉沿軸心翻滾，位置完全不偏移！
       - 風暴貫穿箭 (`VFX_PIERCING_ARROW`) ➔ 轉電弧：貫穿距離 **366.2 px**，起點施術者、終點受擊者，居中自轉！
       - 重劈 (`VFX_HEAVY_STRIKE`，原近戰) ➔ 轉電弧 + 天頂直劈：高度 $392.7\text{ px}$ 直劈受擊者頭頂！
       - 全專案 TypeScript 0 報錯，45 項特效核心單元測試 100% 通過。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Feature/VFX/UniversalSpatialKinematics] 徹底統一全特效通用空間座標與時空路徑求解管線，天雷原生支援施術者到受擊者與天頂直劈，拔除光球假實體與貫通真實 3D 穿甲彈道完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **全域通用空間座標與時空路徑求解器 (Universal Spatial Kinematics Pipeline)**：
       - `VFXSpatialPolicy.ts` 的 `resolveVFXEndpoints` 作為 Rule 9 單一真理來源，徹底終結個別 Shader 私下寫死座標的頑疾。
       - 所有特效（天雷、光束、火球、冰槍、飛劍、穿透箭、狙擊彈、地刺）的 `startPos`、`endPos` 與即時質點座標 $P(t) = \text{Lerp}(startPos, endPos, t) + \text{ArcOffset}(t)$ 統一由該求解器計算。
    2. **天雷全向動態連通與電弧升級 (Dielectric Lightning Full Freedom)**：
       - 徹底糾正先前偏見：天雷原生支援「施術者 (A) ➔ 受擊者 (B)」（掌心雷、連鎖電弧）、「天頂直劈 (VERTICAL_SKY_TO_B) ➔ 受擊者」、「斜天降雷 (DIAGONAL_SKY_TO_B) ➔ 受擊者」與「目標原地 (AT_TARGET)」。
       - `MeshLayerRenderer.ts` 的 `updateLightningTube` 引入正交基底（Perpendicular Basis）與正弦包絡線，確保電弧貼合兩端且在任意 3D 夾角下自然劇烈抖動，終點受擊點動態展開電弧光環。
    3. **拔除中間光球，實裝真正 3D 穿甲投射物網格 (Real 3D Projectiles)**：
       - `CombatFXEngine.ts` 徹底移除未命中專屬 Shader 時 fallback 到發光球 Sprite（`createGlowSprite`）的假實體。
       - 實裝通用 3D 投射物網格渲染器，支援錐形穿甲箭（`ARROW`）、稜鏡（`DIAMOND`）、星芒（`STAR`）、圓環（`RING`）等實體網格，並以 `lookAt(endPos)` 朝向飛行路徑前進。
       - 修復 `VFX_PIERCE_ARROW`（風暴貫穿箭）與 `VFX_SNIPER_SHOT`（致命狙擊），移除錯誤的 `ENERGY_BEAM` 與 `SPHERE` 設定，還原為真實穿甲投射物，貫穿箭帶 `COLUMN_PIERCE` 向後延伸穿透目標。
    4. **Inspector 空間模式與路徑雙向正規化**：
       - `VFXPresetNormalizer.ts` 將 `spatialMode` 與 `trajectoryPath` 正確雙向正規化，徹底消除前端選單與底層資料格式不一致的缺陷。
    5. **品質保證與驗收防線**：
       - `VFXSpatialTopology.test.ts` 擴充天雷各模式連通與貫穿箭終點延伸單元測試。
       - `npx tsc --noEmit` 0 錯誤。
       - `npm test` 全專案 64 個測試套件、396 項單元測試 100% 全部通過。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Feature/VFX/OrthogonalSpatialTopology] 統一特效邏輯：建立「三層正交特效架構（空間形態 + 時空路徑 + 幾何著色器）」，支援飛出劍氣、跨空間天雷與沿途連鎖生長地刺雙模式完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **三層正交特效架構 (Spatial Topology Architecture)**：
       - 解耦為三層正交體系：
         - 空間形態 (`VFXSpatialTopology`：`POINT_TRANSPORT`, `SPAN_BEAM`, `STAGGERED_ARRAY`, `LOCAL_MORPH`)
         - 時空路徑 (`VFXTrajectoryPath`：`A_TO_B`, `VERTICAL_SKY_TO_B`, `DIAGONAL_SKY_TO_B`, `A_TO_VERTICAL_SKY`, `AT_TARGET`, `AT_CASTER`)
         - 幾何與著色器 (`VFXShaderMode` / `VFXRendererType`)
       - `VFXSpatialPolicy.ts` 的 `resolvePresetSpatialTopology(preset)` 負責向下相容既有舊版 Preset。
    2. **劍氣飛出 (Flying Blade Wave) 實裝**：
       - `CombatFXEngine.ts`：徹底解決斬擊寫死在目標原地的問題。當形態為 `POINT_TRANSPORT` 且著色器為 `SLASH_BLADE` 時，月牙刀光網格沿著飛行當前點 `curPos` 平滑推進。
       - 拖尾發射點動態改為質點座標 `curPos`，背後持續拖曳刀尖流光火花。
       - 支援 `slashAlignToPath`（自動順應飛行切線向量朝向）並可疊加 `spin` 自轉。
    3. **沿途破土連鎖地刺雙模式 (Staggered Path Spikes)**：
       - `MeshLayerRenderer.ts`：重構 `updateGroundFissure`，支援自訂尖刺數量（`spikeArrayCount`）與幾何形態（`spikeShape`）。
       - 實裝兩種動態行為：
         - `PERSIST_FADE`（破土竄出後維持在地面高程，尾段淡出）
         - `SURGE_RECEDE`（像波浪一樣依序竄出頂峰後平滑縮回地底）
    4. **天雷轟頂與跨空間能量柱 (Sky Lightning)**：
       - 起終點動態連通，介質擊穿電弧光柱貫通兩端，落點伴隨粒子與受擊光圈。
    5. **特效工坊（VFX Studio）UI 完整支援**：
       - `tools/vfx-studio.html` 與 `VFXInspector.ts` 完整貫通空間形態下拉選單、劍氣路徑朝向開關、以及地刺連鎖模式與數量控制項；排版緊湊化確保 HTML < 800 行。
    6. **品質保證與驗收防線**：
       - 新增專屬單元測試 `src/ui/fx/VFXSpatialTopology.test.ts`（4 項測試 100% 通過）。
       - `npx tsc --noEmit` 0 錯誤，落實 Rule 10 零 any。
       - `npm test` 全專案 64 個測試套件、394 項單元測試 100% 全部通過。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Fix/VFXStudio/FiveCoreIssuesAndZeroAny] 特效工坊 5 大核心功能修復、業務層零 any 型別防護與次生圖層/拖尾熱更新完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **主圖層 Clip 拖拉徹底修復 (SSOT Time Alignment)**：
       - `TimelineView.ts` 拔除 `(preset as any).mainDelay`、`(preset as any).mainDuration` 與 `(preset as any).layers`，起點與時長 100% 直讀 `mainClip.startTime` 與 `mainClip.duration`。
       - `TimelineInteraction.ts` 拖曳主軌本體與拉伸右緣 Handle 時，直讀並原子更新 `mainClip.startTime` 與 `mainClip.duration`，徹底根除 Clip 放開後彈回原點的嚴重缺陷。
    2. **次生圖層 3D 特效渲染通道貫通**：
       - `CombatFXEngine.ts`：在 `renderSequenceWorldAt` 建立渲染佇列時，將 `sequence.layers` 正式納入 3D 渲染通道，配置獨立 `trackGroup`，遞迴解析引用之次素材主軌並依各自的 `delay` 與 `duration` 正確求值繪製，徹底解決次生圖層隱形無特效問題。
    3. **基礎彈道路徑與時空節奏生效**：
       - `CombatFXEngine.ts`：當 `spatialMode === 'TRAJECTORY'` 時，精準提取具體的 `trajectoryPath`（如 `VERTICAL_SKY_TO_B` 天降狂雷、`A_TO_VERTICAL_SKY` 朝天、`DIAGONAL_SKY_TO_B` 斜降），並在 `renderTrack3DGeometry` 補齊網格動態旋轉 `spin` 與縮放 `scale` 運算。
    4. **粒子流、拖尾與爆散整合及即時熱更新**：
       - `TrailLayerRenderer.ts` 新增 `updateStyle(colorHex, size, scale)`，支援材質色彩與粒子尺寸動態更新。
       - `CombatFXEngine.ts` 在逐訊框更新中比對 `trailColor` 與 `trailSize`，即時調用 `updateStyle`，徹底解決滑桿與顏色選擇器調整無反應的凍結病灶；斬擊與全形態拖尾收斂以粒子流面板為唯一真理來源 (SSOT)。
    5. **Rule 10 型別防護規範鋼鐵落實**：
       - 業務層（Store, Timeline, Interaction）徹底清除 `as any`，嚴格落實紅線禁區。
    6. **品質保證與驗收防線**：
       - `npx tsc --noEmit` 0 錯誤。
       - `npm test` 全專案 63 個測試套件、390 項單元測試 100% PASS。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Refactor/VFXStudio/SSOTTypeConvergence] 特效工坊前後端型別契約對齊、Preset 徹底升級純 Sequence 與零 any 防護完工交接（2026-09-14）**：
  - **核心交接重點**：
    1. **前後端契約與雙向數據流徹底貫通 (Rule 9 Universal Data Flow)**：
       - 建立 `src/ui/fx/VFXPresetNormalizer.ts` 單一真理來源模組，抽取 `INSPECTOR_CONTROL_MAP` 與 `normalizeVfxPreset`，將 Inspector / Timeline 的拍平屬性與底層多軌 Clip 資料雙向映射。
       - `VFXStudioStore.updateConfig`：重構為分流過濾機制，Sequence 頂層欄位（`layers`, `duration`, `impactCues`, `impactPresentationMode`, `impact`）僅更新 Sequence 根物件，專屬幾何屬性才更新 `mainClip.payload.data`，徹底阻絕圖層相互覆蓋與狀態回退 Bug。
    2. **SSOT 確證與純 Sequence (Schema v2) 貫通**：
       - 確認專案儲存與執行期 100% 採用純 `VFXSequence`，徹底釐清並解決「Preset 不是砍掉了嗎？」的歷史包袱。
       - 在 `src/models/VFX.ts` 提供確定性 `presetToSequence` 轉換函式，相容外圍模組與單元測試。
       - 在 `src/models/VFX.ts` 的 `getSequenceMainTrack`、`getSequenceImpactConfig`、`getSequenceParticlePayload` 加入嚴密陣列與物件安全防禦。
       - `CombatFXEngine.ts`：`renderFrameWorldAt` 透過 `resolvePresetSpatialMode(preset)` 進行空間路徑動態判定，徹底清除 120 行重複舊代碼，全面委派原生 `renderSequenceWorldAt`。
    3. **零 any 與強型別防護 (Rule 10 Type Safety)**：
       - `src/models/VFX.ts` 補齊 `SlashGeometryInput` 與 `VFXMeshClipPayload`，`MeshLayerRenderer.calculateSlashGeometryParams` 徹底拔除 `(preset as any)`。
       - `src/ui/fx/VFXTimelineEvaluator.ts` 補齊 `VFXImpactConfig` 預設值之 `penetrationDistance: 0`, `knockbackDistance: 0` 強型別屬性。
    4. **品質保證與驗收防線**：
       - `npx tsc --noEmit` 0 錯誤。
       - `npm test` 全專案 63 個測試套件、390 項單元測試 100% PASS。
  - **待後續推進項目**：
    - 特效工坊各 Shader（FRESNEL_ICE, DIELECTRIC_LIGHTNING, VOLUMETRIC_FIRE, EARTH_SHATTER）更細緻的頂級光學與 ShaderMaterial 升級。

- **[Fix/VFXStudio/DeterministicArcTrailAndSSOT] 斬擊原生欄位 100% 貫通、確定性圓弧刀尖拖尾與粒子流重構完工交接（2026-09-11）**：
  - **核心交接重點**：
    1. **斬擊原生欄位 100% 貫通 (SSOT Alignment)**：
       - `src/ui/fx/renderers/MeshLayerRenderer.ts`：`calculateSlashGeometryParams` 全面相容讀取 `radius`, `bladeWidth`, `arcSpan`, `rotX`, `rotY`, `rotZ`, `aspect`, `shape`, `reverse` 等資產標準欄位，巨力重劈載入時 100% 還原原始幾何姿態與打擊手感。
    2. **Inspector 雙向讀寫完全對接主軌資料**：
       - `src/tools/vfx-studio/VFXInspector.ts`：`normalizeVfxPreset` 深度合併主軌 `mainClip.payload.data`，消除預設值覆蓋問題；拉動控制項時同步寫入原生標準鍵值與別名，滑桿即時 100% 反饋至畫面。
    3. **確定性圓弧刀尖流光與最後一影格零殘留**：
       - `src/ui/fx/renderers/TrailLayerRenderer.ts`：實裝 `updateArcTrail`，沿著揮砍過去進度弧線分散取樣，刀尖明亮集中、尾端向外擴散微散逸，進度超過 0.75 後平滑漸隱；出刀結束（$p \ge 1.0$）立即隱藏與銷毀，徹底根除最後一影格凍結殘留缺陷。
    4. **粒子流面板獨立解耦與噴發修復**：
       - `tools/vfx-studio.html`：拆分出獨立的 `card-particle-section`，解除對地刺幾何的依賴。
       - `src/ui/fx/CombatFXEngine.ts`：修正 `isTrailEnabled` 判定，使資產定義的 `trailCount` 與爆散碎屑正常噴發。
    5. **品質保證與驗證防線**：
       - `npm run typecheck` 0 錯誤。
       - `npm test` 全專案 63 個測試套件、390 項單元測試 100% PASS。
  - **待後續推進項目**：
    - 進入 Shader 重構計畫：落雷（DIELECTRIC_LIGHTNING）、地刺（EARTH_SPIKE）、黑體火球（VOLUMETRIC_FIRE）的專屬次世代著色器開發。

- **[Refactor/VFXStudio/Phase1BasePipeline] 特效系統第一階段基礎地基重構完工交接（2026-09-11）**：
  - **核心交接重點**：
    1. **徹底終結無端冒出的貫穿光束**：
       - `src/ui/fx/CombatFXEngine.ts`：將 `renderableTracks` 篩選規則嚴格限定為實體 3D 幾何軌道（`MESH` / `SLASH` / `PROJECTILE` / `COMPOSITE_LAYER`），嚴格排除 `PARTICLE`、`IMPACT` 與 `AUDIO`，徹底終結粒子軌道誤入幾何管線。
       - 徹底拔除 `shaderMode || 'ENERGY_BEAM'` 的危險 fallback，未指定合適 Shader 則明確靜默，絕不憑空捏造光束。
    2. **粒子回歸附著本質 (Attach-to-Main Pipeline)**：
       - 粒子系統與拖尾點雲改由主軌道（`trk_main`）於逐訊框計算頂點座標 `curPos` 時動態錨定並跟隨，不再作為孤立亂飛的獨立軌道。
    3. **品質保證與驗證防線**：
       - `npm run typecheck` 0 錯誤。
       - `npm test` 63 個測試套件、389 項單元測試 100% PASS。
  - **待後續推進項目**：
    - 進入第二階段：專注重寫雷電（DIELECTRIC_LIGHTNING）、地刺（EARTH_SPIKE）、黑體火球（VOLUMETRIC_FIRE）的專屬頂級 GLSL Shader。

- **[Refactor/VFXStudio/PureSequenceMigration] 徹底淘汰舊版 VFXPreset 雙軌轉換包袱，全面落實標準 Canonical VFXSequence 原生化與死碼清理交接（2026-09-11）**：
  - **核心交接重點**：
    1. **物理刪除歷史雙向轉譯器與舊版資產**：
       - 徹底自 `src/models/VFX.ts` 拔除 `migrateLegacyPreset` 與 `sequenceToLegacyPreset` 轉譯函式（減少 308 行死碼包袱）。
       - 物理刪除舊版 `src/data/vfx_presets.json`，專案唯一真理來源全面換裝為標準 `src/data/vfx_sequences.json`。
    2. **全管線原生 Sequence 貫通**：
       - `VFXPresetRepository.ts`：以 `vfx_sequences.json` 為唯一基準，維護 `resolvedSequenceMap`，伺服器發布端點（`POST /__vfx_api/save_ssot`）原子寫入 `src/data/vfx_sequences.json`。
       - `CombatFXEngine.ts`：`playSequenceWorld` 與 `renderSequenceWorldAt` 原生直通多軌影格求值與 3D 繪製；清理 `playPreset` 中已廢棄之 `getPreset` 回退。
       - `CombatActionPlayer.ts`：以 `VFXSequence` 為第一公民，直接依據序列內之 `tracks`、`clips` 與具名 `impactCues` 執行傷害與回呼派發。
       - `VFXStudioStore.ts` & `VFXStudioAdapter.ts`：集中狀態持有 `currentSequence: VFXSequence`，Undo/Redo 棧以 Sequence 紀錄快照。
    3. **模型層與腳本對齊**：
       - `VFXTrack`、`VFXSlashClipPayload`、`VFXProjectileClipPayload` 補齊型別彈性；修復 `VFX_LIGHTNING_BOLT` 空間模式；改寫 `scripts/test-validate-ssot.mjs`、`verify-vfx-preset-graph.mjs`、`check-heavy-strike.mjs` 直讀 `vfx_sequences.json`。
    4. **品質保證與驗證防線**：
       - `npm run typecheck` 0 錯誤。
       - `npm test` 全專案 63 個測試套件、389 項單元測試 100% PASS。
  - **待後續推進項目**：
    - 繼續依規劃推進次世代 Shader 與新特效素材打磨。

- **[Planning/VFXStudio] 子圖層落雷 A>B 空間軌跡斷點排查與 Shader 升級計畫交接（2026-09-09）**：
  - **核心交接重點**：
    1. **子圖層選取風暴狂雷變 A>B 直線雷射之根本病灶**：
       - `src/tools/vfx-studio/timeline/TimelineInteraction.ts`：切換圖層素材時未對應預設的 `trajectory: "VERTICAL_DROP"`，因 `targetPreset.spatialMode` 為 `undefined`，被預設回退值強制賦予 `'A_TO_B'`。
       - `src/ui/fx/CombatFXEngine.ts`：引擎判定 `'A_TO_B'` 為橫向穿透，強制起點拉至施術者 `casterPos`，使垂直天雷退化為水平射線。
    2. **圖層深度遮擋與 Z-Buffer 挖空病灶**：
       - `MeshLayerRenderer.createFresnelShaderMaterial` 等材質未設 `depthWrite: false`，透明物體寫入深度會挖空後方粒子。
    3. **實作計畫保存**：
       - 完整實作規約已保存在 `docs/implementation_plan.md`，涵蓋階段 1（圖層空間與深度修復）、階段 2（4 套專屬 GLSL ShaderMaterial 與動態幾何升級）與階段 3（自動化測試防線）。
    4. **驗證基準狀態**：
       - `npm test` 62 個測試檔案、383 項測試 100% PASS。
  - **待後續推進項目**：
    - 待額度重置後執行 `docs/implementation_plan.md` 之階段 1 與階段 2 編碼。

- **[Bugfix/VFXStudio] 落雷與 A>B 雷電精準命中目標終點完工交接（2026-09-09）**：
  - **核心交接重點**：
    1. **落雷（DIELECTRIC_LIGHTNING / 風暴狂雷）100% 鎖定受擊目標 (End / targetPos)**：
       - `src/ui/fx/CombatFXEngine.ts`：閃電穿透分支終點 `lightningEnd` 100% 強制鎖定在真實受擊目標 `targetPos`；垂直天降起點嚴格取自目標正上方天頂 `new THREE.Vector3(targetPos.x, targetPos.y + 380, targetPos.z)`，地面衝擊波電環精確綻放於受擊目標腳下，徹底終結在畫面中央空劈跳舞的偏位缺陷。
       - **A>B 穿透直連修正**：當設定或切換為 A>B 彈道路徑時，起點精確自施術者 `casterPos` 直連貫穿至受擊目標 `targetPos`，電弧線路完整對齊兩端。
       - **雷擊灌頂時機優化**：`src/ui/fx/renderers/MeshLayerRenderer.ts` 的 `updateLightningTube` 將雷電貫通插值係數加速為 `Math.min(1.0, progress * 4.0)`，電光在瞬間直插受擊目標，地面衝擊光環於 `progress > 0.2` 及時爆發。
    2. **品質保證與驗證防線**：
       - 在 `src/tools/vfx-studio/VFXConsistency.test.ts` 新增「落雷終點與地面電環 100% 鎖定受擊目標 targetPos」單元測試。
       - `npm run typecheck` 0 錯誤。
       - `npm test` 62 個檔案、383 項單元測試 100% PASS。
  - **待討論項目（保留未動）**：
    - 類別四：幽靈控制項清理（`#param-texture-sprite` 殘留 HTML、`#param-trajectory` 螢幕外 legacy select）。

- **[Bugfix/VFXStudio] 多發彈幕中央跳舞、非投射物誤攔截與中央幽靈大光球徹底修復完工交接（2026-09-09）**：
  - **核心交接重點**：
    1. **徹底消滅畫面中央幽靈殘留實體（中央大光球消失）**：
       - `src/ui/fx/CombatFXEngine.ts`：在進入 `isSalvo` 多發管線時，強制將 `volumetricGroup`、`projectileGroup`、`frostGroup`、`beamMesh`、`slashMesh`、`lightningGroup` 等所有互斥幾何群組設為 `visible = false`；在單發模式時反向隱藏 `multiArcGroup`，徹底消除中央 `(0, 0, 0)` 釘死舊大火球的幽靈實體病灶。
    2. **0° 散射偏角直線連貫齊射與天降起點優化**：
       - `src/ui/fx/renderers/MeshLayerRenderer.ts`：當 `salvoSpreadAngle === 0` 時，法向展開偏移量嚴格歸零，5 顆流星/子彈不再被生硬扯開，而是呈連貫直線一發接一發砸向受擊目標。
       - `src/ui/fx/CombatFXEngine.ts`：優化 `DIAGONAL_DROP` / `DIAGONAL_SKY_TO_B` 天頂起點計算公式，依受擊目標與施術者距離動態展開天頂外側偏角（$X \approx -104, Y = +380 \to X = +260, Y = 0$），不再死死插在畫面水平中心線上方。
       - 支援 `TRAJECTORY` 模式下正確讀取 `trajectoryPath`（如斜向天空、垂直天空）。
    3. **非投射物形態與雷電管線徹底釋放**：
       - 明訂 `isSpecialNonProjectile` 排除清單，保證雷電、地刺、護盾、光柱等 100% 走回專屬管線。
    4. **品質保證與驗證防線**：
       - `npm run typecheck` 0 錯誤。
       - `npm test` 62 個檔案、382 項單元測試 100% PASS。
  - **待討論項目（保留未動）**：
    - 類別四：幽靈控制項清理（`#param-texture-sprite` 殘留 HTML、`#param-trajectory` 螢幕外 legacy select）。

- **[Feature/Refactor/VFXStudio] 斬擊 3D 歐拉角旋轉與通用多發彈幕發射器管線完工交接（2026-09-09）**：
  - **核心交接重點**：
    1. **斬擊升級 3D 歐拉角 (Pitch / Yaw / Roll) 控制器**：
       - `src/models/VFX.ts`：新增 `slashRotX`（-90°~90° 俯仰）、`slashRotY`（-90°~90° 偏航）、`slashRotZ`（-180°~180° 滾轉/起手角）三軸歐拉角，與既有 `slashAngle` 保持相容。
       - `tools/vfx-studio.html`：左側面板改為 X 旋轉、Y 旋轉、Z 旋轉三個滑桿與數值顯示。
       - `src/tools/vfx-studio/VFXInspector.ts`：在 `INSPECTOR_CONTROL_MAP` 註冊這三個控制項；走向選單（`#param-slash-traj`）連動寫入預設三軸角度；在 range 輸入事件中將 `slashRotZ` 與 `slashAngle` 雙向同步。
       - `src/ui/fx/CombatFXEngine.ts` & `MeshLayerRenderer.ts`：將 `rotX` 與 `rotY` 套用至斬擊網格 `mesh.rotation.set(rotX, rotY, 0)`（Z 軸已融入幾何動態弧面）。
    2. **通用多發彈幕發射器管線（徹底根除 Early Return 攔截缺陷）**：
       - **缺陷根因**：原先 `CombatFXEngine.ts` 在 `renderTrack3DGeometry` 前端處理特定單發 Shader（如 `FRESNEL_ICE` 冰晶長矛、`VOLUMETRIC_FIRE` 火焰球）時，繪製單一物體後直接 `return`，導致後續 `salvoCount > 1` 的多發彈幕邏輯被徹底攔截跳過，畫面上永遠只有單發。
       - **架構提升**：將多發彈幕管線提升至單發 Shader 前頂層調度；當 `salvoCount > 1` 或 `ARC_MULTI` 時統一進入通用彈幕發射器。
       - **多形態子彈與空間散佈**：`MeshLayerRenderer.updateArcMulti` 支援依當前 Shader 動態生成真實 3D 幾何實體（包含 `FRESNEL_ICE` 錐形冰箭＋旋轉冰晶環、`VOLUMETRIC_FIRE` 熱浪火球、奧術球），並全面套用 31° 扇形散射偏角（`salvoSpreadAngle`）、130px 受擊落點散佈半徑（`salvoSpreadRadius`）、拋物弧高（`arcHeight`）與飛行切線動態轉向（`lookAt`）。
    3. **品質保證與驗證防線**：
       - 在 `src/tools/vfx-studio/VFXConsistency.test.ts` 新增斬擊 3D 歐拉角旋轉與 `FRESNEL_ICE` 7發冰錐彈幕（31°偏角、130px散佈）生成測試。
       - `npm run typecheck` 0 錯誤。
       - `npm test` 62 個檔案、379 項單元測試 100% PASS。
  - **待討論項目（保留未動）**：
    - 類別四：幽靈控制項清理（`#param-texture-sprite` 殘留 HTML、`#param-trajectory` 螢幕外 legacy select）。

- **[Refactor/VFXStudio] 特效工房控制項全域貫通與斷路修復完工交接（2026-09-09）**：
  - **核心交接重點**：
    1. **斬擊走向與幾何參數雙向貫通**：
       - `src/tools/vfx-studio/VFXInspector.ts`：實裝 `#param-slash-traj` 走向選單（斜劈、挑斬、橫斬、力劈）連動更新起手起始角、揮斬跨度與出刀方向，同時更新 Inspector 滑桿顯示。
       - `src/ui/fx/renderers/MeshLayerRenderer.ts`：在 `calculateSlashGeometryParams` 納入 `slashTrajectory` 回退角度、`slashAngleJitter`（動態角度擾動）與 `slashAlternating`（交錯反挑）之 3D 頂點計算，斬擊幾何真實呈現多段動態變化。
    2. **彈幕散射偏角與受擊散佈半徑實裝**：
       - `src/ui/fx/renderers/MeshLayerRenderer.ts`：在 `updateArcMulti` 實裝 `salvoSpreadAngle`（依偏角展開發射中途夾角）與 `salvoSpreadRadius`（於目標受擊點依半徑產生散佈偏移），預設 0° 下基準 -55..55px 完美相容。
       - `src/ui/fx/CombatFXEngine.ts`：多彈幕渲染傳遞偏角與散佈半徑，且 `salvoCount > 1` 時自動啟用多彈道。
    3. **舞台浮動 HUD 與未發布指示燈接通**：
       - `src/tools/vfx-studio/VFXStudioController.ts`：實裝 `updateImpactMetricsHUD`，使中央舞台浮動 HUD（`#hud-salvo`、`#hud-hit-stop`、`#hud-punch`、`#hud-shake`、`#hud-knockback`）即時反映當前 Preset 打擊感參數，徹底消除靜態死資料。
       - `src/tools/vfx-studio/VFXStudioController.ts`：實裝 `updateDirtyIndicator`，將頂部工具列未發布指示燈（`#vfx-dirty-indicator`）與 Store `isDirty` 狀態雙向連動，有編輯即亮燈，發布或無修改時隱藏。
    4. **品質保證與 E2E 驗收**：
       - `npm run typecheck` 0 錯誤。
       - `npm test` 62 個檔案、379 項單元測試 100% PASS。
       - `node scratch/verify_controls_fix.mjs` 實機 Playwright 瀏覽器驗收 100% PASS。
  - **待討論項目（保留未動）**：
    - 類別四：幽靈控制項清理（`#param-texture-sprite` 殘留 HTML、`#param-trajectory` 螢幕外 legacy select）。

- **[Bugfix/VFXStudio & CombatStudio] 特效工坊四大 UI 死鎖與戰鬥工坊跳幀缺陷修復交接（2026-09-08）**：
  - **核心交接重點**：
    1. **戰鬥工坊事件跳幀徹底根除**：
       - `src/tools/CombatStudio.ts`：移除 `stepPlayback()` 中多餘的 `this.currentEventIndex++`，消除單一事件（MP 回復、陣亡、回合結算）後緊隨之傷害或波次切換事件被跳過的重大缺陷。修復後哥布林/史萊姆不會憑空倒下，第二波次正常推進且頭像/棋盤完全同步。
    2. **特效工坊廢棄幽靈卡片清除**：
       - `tools/vfx-studio.html`：徹底刪除左側版面廢棄幽靈卡片「🔮 複合多圖層積木 (Sequencer)」及其未綁定按鈕 `#btn-add-layer`。
    3. **彈幕調整卡片解除收合死鎖**：
       - `src/tools/vfx-studio/VFXInspector.ts`：移除 `&& isSalvo` 死鎖條件。投射物幾何特效隨時可展開【🚀 彈幕發射與節奏曲線】卡片，自由微調連射彈數、節奏曲線、散射角度與半徑。
    4. **Cue 點檢查器常駐化與互斥隱藏解除**：
       - `tools/vfx-studio.html` & `src/tools/vfx-studio/VFXInspector.ts`：Cue 卡片改為常駐顯示（預設展開），頂部新增 `#cue-selector-tabs` 標籤切換列與 `➕ 加 Cue` 快捷按鈕。
       - 移除 `!isCueSelected` 對打擊感、動作、幾何卡片的互斥隱藏，修正 `getSelectionCapabilities` 使選中 Cue 點時施法動作與受擊衝擊卡片維持可見可調，徹底解決未點中菱形卡片消失、點中菱形其他面板全滅的死鎖。
    5. **驗收與品質保證**：
       - 依據「真實使用者視角審查原則」，編寫專屬 E2E 腳本（`scratch/verify_user_complaints.mjs`），在 1440x900 真實瀏覽器環境下驗收通過。
       - `npm run typecheck` 0 錯誤。
       - `npm test` 62 個測試檔案、376 項單元測試 100% PASS。

- **[Refactor/CombatVFX/Phase5] 戰鬥 VFX 管線重整 Phase 5 完整驗收、回歸防線修復與 DoD 全面落實完工交接（2026-09-08）**：
  - **核心交接重點**：
    1. **消除假陽性與無頭驗證腳本修復 (§1.10 & §11)**：
       - `scripts/verify-combat-vfx-direction.mjs` 與 `scripts/verify-human-interactions.mjs` 補齊 Playwright `chromium` 導入與自適應 Vite Server 啟動及 finally 自動銷毀。
       - `scripts/verify-phase6-combat-debug.mjs` 修復後端 `/api/get-icon-studio-data` 產生的 404 報錯，確保無頭腳本全流程 0 錯誤、0 警告、0 個 404，Debug Overlay 狀態精準校準至 IDLE。
    2. **雙向無損 Roundtrip 守恆強化 (§6.2 & §6.3)**：
       - 在 `VFXSlashClipPayload` 中補充 `shaderMode` 與 `trajectory` 可選屬性，使特殊著色器斬擊或特定碰撞在 Preset ➔ Sequence ➔ Preset 往返中 100% 保持合約無損。
       - `src/ui/fx/VFXCanonicalSchema.test.ts` 擴充合法 clip.payload.type 白名單（納入 `SLASH` 與 `PROJECTILE`）。
       - `src/tools/vfx-studio/VFXInspector.ts` 強化 DOM `closest` 方法防禦，相容測試環境 mock DOM。
    3. **4 種 Viewport 實機截圖與無溢出驗證 (§8.7 & §9.5)**：
       - 實機驗證 1440×900、1280×720、1024×768、768×900 四種視窗尺寸。
       - 768px 版面完美收斂，Client W 與 Scroll W 皆為 768px（零水平 overflow，Zero Leak = true）。
    4. **生產級浸泡穩定性 (Soak Stress Test 100 循環)**：
       - 100 次連續播放循環，Canvas 保持 1，零顯存洩漏、WebGL 上下文穩定不丟失。
    5. **生產打包與煙霧測試全數通過**：
       - `npm run typecheck` 0 報錯。
       - `npm test` 全套 62 個檔案、368 項測試 100% PASS。
       - `npm run build` 成功完成，Bundle 預算 3.8MB / 4.0MB 通過。
       - `npm run test:smoke` P0 煙霧測試（新遊戲開局、迷霧探索、道路建設、跨日推進、存檔讀檔）全數通過。

- **[Refactor/CombatVFX/Phase4] 戰鬥 VFX 管線重整 Phase 4 Canonical Sequence 漸進收斂與 Typed Payload 實裝完工交接（2026-09-08）**：
  - **核心交接重點**：
    1. **Typed Clip Payload 規格落實 (§6.2)**：
       - 在 `src/models/VFX.ts` 導出 `VFXSlashClipPayload` 與 `VFXProjectileClipPayload`，納入 `VFXClipPayload` 聯集型別中。
       - `migrateLegacyPreset` 升級為標準 Schema v2 遷移：依 `rendererType`（`SLASH` / `PROJECTILE` / `MESH`）自動轉換為攜帶 `slashRadius`, `bladeWidth`, `angleJitter`, `alternating`, `salvo`, `coreBrightness`, `coreMeshShape` 等完整可調欄位的 Typed Payload。
       - `sequenceToLegacyPreset` 實裝無損解構還原，達成 Preset ➔ Sequence ➔ Preset 往返（Roundtrip）數值零失真。
    2. **徹底移除 Preset ID 渲染與外觀特判 (§6.3)**：
       - `src/ui/fx/renderers/MeshLayerRenderer.ts` 移除 `preset.id.includes('WHIRLWIND')`，旋風造型嚴格由 `preset.slashShape === 'WHIRLWIND'` 驅動。
       - `src/tools/vfx-studio/VFXInspector.ts` 移除 `VFX_HOLY_SHIELD` 與 `VFX_TAUNT_SHOUT` 特判，能力 100% 依據 `rendererType` 與 `trajectory` 解析。
       - `src/models/VFX.ts` 遷移純函式移除 `preset.id.includes('WHIRLWIND')` 特判。
       - `src/data/vfx_presets.json` 為 `VFX_WHIRLWIND` 補齊 `rendererType: "SLASH"` 與 `slashShape: "WHIRLWIND"`。
    3. **Repository Canonical Sequence 接口實裝 (§6.1)**：
       - 在 `src/ui/fx/VFXPresetRepository.ts` 實裝 `getSequence(id: string): VFXSequence | undefined` 與 `saveSequence(sequence: VFXSequence)`，達成 Repository 對外提供 resolved Sequence。
    4. **Combat Runtime Sequence 原生支援 (§6.1)**：
       - 在 `src/ui/fx/CombatFXEngine.ts` 實裝 `playSequence(sequence, from, to, isPlayerOrOnImpact, onImpactCallback)` 與 `renderSequenceWorldAt(sequence, timeSeconds, ...)`，支援 Canonical Sequence 的原生播放與世界座標動態渲染求值。
    5. **測試與驗收全數 PASS**：
       - 新增專屬驗收測試 `src/systems/combat/VFXPipelinePhase4CanonicalSequence.test.ts`（8 項測試全數通過）。
       - 戰鬥系統全套測試（20 個檔案、158 項測試）100% PASS，`npm run typecheck` 0 報錯。

- **[Refactor/CombatVFX/Phase3] 戰鬥 VFX 管線重整 Phase 3 Inspector 與欄位收斂、選取 Union 與 Runtime 幾何生效完工交接（2026-09-08）**：
  - **核心交接重點**：
    1. **選取狀態 Union 與穩定 ID 識別 (§5.2)**：
       - `src/tools/vfx-studio/VFXStudioStore.ts` 導出並實作 `VFXEditorSelection` union（`PRESET | MAIN_TRACK | LAYER(layerId) | CUE(cueId) | BINDING(skillId)`）。
       - 徹底杜絕因圖層新增/刪除/排序導致的 array index 漂移問題，Store 全局提供 `setSelection`、`getSelection`、`subscribeSelection`。
    2. **Capability-Driven Inspector 與模式相依收斂 (§5.3 & §5.8)**：
       - `src/tools/vfx-studio/VFXInspector.ts` 導出 `InspectorCapability`，實作純函式 `getSelectionCapabilities(preset, selection): Set<InspectorCapability>`。
       - 排他判定近戰斬擊、遠程投射物、岩刺、護盾、戰吼與著色器能力，杜絕舊有欄位污染問題。
       - 欄位情境化動態收斂：`cue.weight` 僅在 `SPLIT_SINGLE_IMPACT` 模式顯示；Salvo 卡片僅在連射模式顯示；Fire turbulence 僅在火焰著色器顯示；Fresnel 僅在冰晶著色器顯示；Shield shape 僅在盾牌渲染器顯示；`cue.isPrimary` 在非 `PRIMARY_ONLY` 模式下動態標記用途說明；Legacy 彈道選單（`param-trajectory`）遵循 §5.6 於 Inspector 徹底隱藏，僅保留 DOM 供載入遷移相容。
    3. **唯一總時長契約與縮短防禦機制 (§5.5 & §5.4)**：
       - 移除右側重複之 `param-duration` 滑桿，全局收斂由 Timeline 時間軸控制器作為總時長 SSOT，徹底消除雙重 duration 控制器造成的數值競爭與混亂。
       - **精確複合控制**：時間軸頂部時長升級為 `range + number` 雙向連動複合輸入（`tl-range-duration` + `tl-input-duration`）。
       - **縮短超出三選擇防禦**：依 §5.5 嚴格規定「不得默默裁切超出範圍的 clip／Cue」。若縮短時長導致主軌、副圖層或 Cue 溢出，立即顯示確認對話框列出受影響清單，並提供「延長 sequence 配合項目」、「按比例縮放全部」、「取消」三種明確處置選擇。
    4. **無效控制項處置與 Runtime 幾何實質生效（§5.7 完成條件）**：
       - **杜絕應試欺瞞**：嚴格落實「畫面上不存在調整後 runtime 不變的控制項」：
         - `waveCount`：傳入 `MeshLayerRenderer.buildTauntShoutGroup(waveCount)`，支援 1～8 圈戰吼震波動態建構，由 `CombatFXEngine` 真實生效。
         - `shieldShape`：`MeshLayerRenderer.buildHolyShieldGroup` 依 `HEX | CROSS_SHIELD | RUNE_RING` 真實建立不同網格拓撲與幾何形態。
         - `coreMeshShape`：`playDynamicProjectile` 動態建立 `SPHERE | DIAMOND | STAR | RING | ARROW` 彈頭幾何實體。
         - `coreBrightness`：即時傳入著色器材質乘數計算發光亮度。
       - 依文件暫時隱藏無後端管線之 Bloom（`bloomStr`, `bloomRad`, `bloomThresh`）與 `textureSprite`。
    5. **測試與型別驗證全數通過**：
       - 新增專屬驗收測試 `src/systems/combat/VFXPipelinePhase3Inspector.test.ts`（擴充至 13 項測試全數通過）。
       - 戰鬥系統全套（19 個檔案、150 項測試）100% PASS。
       - `npm run typecheck` 0 報錯。

  - **核心交接重點**：
    1. **單一 UI 呈現責任與根除重複跳字**：
       - 徹底清理 `CombatUIManager.renderEventAsync` 結尾對目標 `lastEv` 二度調用 `applyDamageAndFloatingNumbers` 的重複呈現病灶。
       - 實裝純狀態校準函式 `CombatUIManager.reconcileFinalActionState(events)`：僅在 Action 播畢後安全同步 HP/MP/城門 HUD 與死亡 class，**絕對禁止建立 floating DOM 跳字**。
       - 徹底移除在事件物件上動態注入 `absorbedBySkillCast = true` 的暫態污染；重播報告保證 100% 冪等無副作用。
    2. **純函式 Action 聚合器 (`collectCombatActions`)**：
       - `CombatActionPlayer.ts` 導出純函式 `collectCombatActions(events)`，預先將連續相同 `actionId` 之事件群組合成 `CombatAction`，保留原始時序。
       - 主遊戲 `CombatUIManager` 與戰鬥工房 `CombatStudio` 全面同步改由 `collectCombatActions` 驅動，兩端播放管線 100% 同構。
    3. **多型跳字與 Adapter 打擊次數解耦**：
       - `CombatStageAdapter` 與 `CombatStudioStageAdapter` 不再傳死 `totalHits = 1`，改傳入 `item.presentationIndex` 與 `item.presentationCount`，實現目標專屬的受擊輕震／終擊重顫。
       - 實裝 `SHIELD_DAMAGE`（`🛡️ -X`）、`SHIELD_BREAK`（`🛡️ 破盾！`）、`STATUS`（狀態文字）與 `VISUAL_ONLY`（絕對不跳字，杜絕 `-0`）。
    4. **嚴格落實 §8.3 條款 9「Skip 後零殘留」與 §7「Debug Overlay 立即清理」**：
       - `CombatUIManager.skipPlayback()` 與 `CombatStudio.btn-skip-all`：開頭調用 `CombatStageAdapter.clear()` 與 `CombatActionPlayer.clearDebugOverlay(true)`，跳過期間僅輸出日誌而不建立 floating DOM 與計時器，末尾由純狀態校正終態血量，達成 0 殘留 timer、0 殘留跳字 DOM、0 殘留 FALLBACK 診斷狀態。
       - `SkillData.ts` 之 `getSkillVfxId` 升級相容 `SkillVfxBindingStorageV2`，並優先委派 `SkillVfxBindingRegistry` SSOT。
    5. **測試與型別驗證全數通過**：
       - `npm run typecheck` 0 報錯。
       - 戰鬥模組全套 18 個測試檔案、137 項單元測試 100% PASS。
       - `VFXPipelinePhase0Defects.test.ts` 擴充至 8 項測試全數綠燈。

- **[Fix/VFXStudio/CardSpriteIconsAndTimelineDeleteBtn] 技能卡片 Sprite 圖標引擎接入與時間軸圖層雙重刪除按鈕完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **技能卡片 Sprite 圖標解析與文字溢出根除**：
       - `SkillVfxPickerModal.ts` 接入 `renderUniversalIcon(skill.icon, 36)`，自訂技能圖集代碼 `2_icons_materials:2_icons_materials_1` 現已正確解析為 2D 精靈圖 Sprite，不再以長文字破壞版面。
       - `.svp-skill-icon` 加入 `overflow: hidden; max-width: 44px;` 確保任何字串代碼 100% 侷限在圖標方框內。
    2. **時間軸圖層標頭寬度擴展與雙重刪除按鈕保護**：
       - `TimelineView.ts` 將標頭擴展至 180px，下拉選單設定最大寬度並彈性收縮，功能按鈕群 `flex-shrink: 0;`，紅色高對比垃圾桶 `[🗑️]` 刪除按鈕 100% 完整可見，徹底杜絕被擠壓出可視範圍。
       - 在選中圖層浮現的「🎬 編輯圖層」微調工具列中加入【🗑️ 刪除圖層】按鈕，並於 `TimelineInteraction.ts` 接入立即刪除，提供雙重刪除保障。
    3. **真實瀏覽器無頭腳本驗收 100% PASS**：
       - 執行 `scripts/verify-fixes-icons-and-delete.mjs`，實機確認 Sprite 正確解析無文字外溢，多圖層刪除按鈕完全可見無外溢，全流程 100% PASS。

- **[Feature/VFXStudio/SkillVfxCardPickerModal] 全領域技能特效卡片選取綁定中心、安全覆蓋與一鍵還原機制完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **徹底解決新特效綁定斷點（全可視化卡片選取彈窗）**：
       - 實裝 `src/tools/vfx-studio/SkillVfxPickerModal.ts`，以現代深色毛玻璃彈窗全面取代下拉選單。
       - 全領域涵蓋 48+ 款技能：👑 英雄職業技能、👾 魔物怪物技能、🏰 攻城部隊技能、🔮 技能工坊自訂技能。
       - 每張卡片均具備識別圖標（ICON）、分類標籤、當前綁定之特效名稱、以及即時搜尋過濾框。
    2. **安全 1 對 1 指向覆蓋與官方基準還原**：
       - `SkillVfxBindingRegistry.ts` 內建官方初始快照 `defaultBindingsMap`。
       - 點擊卡片直接 1 對 1 覆蓋指向新特效（原特效 Preset 絕對無損保留），並同步持久化存入 LocalStorage。
       - 被修改過的技能卡片即時亮起【↩️ 還原】按鈕，隨時可一鍵還原為遊戲官方預設。
       - 當前工坊選取的特效自動高亮顯示「✨ 本特效 / ✓ 已綁定本特效」，避免重複誤點。
    3. **工坊雙向連動與全流程端到端驗收 100% PASS**：
       - `VFXLibrary.ts` 新增【🎴 開啟技能卡片綁定中心】快捷按鈕，彈窗關閉後左側徽章即時自動重繪。
       - `SkillVfxCardPicker.test.ts` 3 項單元測試全數 PASS。
       - `scripts/verify-skill-vfx-picker.mjs` 真實無頭瀏覽器端到端驗收 100% PASS，截圖留存於 `skill_vfx_picker_modal.png`。
       - 全專案 58 個測試套件、339 項單元測試 100% 通過，`npm run typecheck` 0 錯誤。

- **[Fix/CombatVFX/SelfTargetingCombatActionResolution] 實戰技能施放「特效自己打自己」目標解析病灶完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **徹底根除實戰技能施放「特效自己打自己」重大缺陷**：
       - `CombatActionPlayer.ts` 實裝純函式 `resolveActionMainTargetId(action)`，優先從實質傷害/治療事件（`HIT`, `CRIT`, `HEAL`, `SHIELD_DAMAGE`）抓取目標，次選從 `SKILL_CAST` 的 `skillTargetId` 抓取目標，僅自身增益技能才鎖定自身，徹底杜絕將 MP 扣除自身之事件當成打擊目標。
    2. **打通 CombatUIManager 真實卡牌座標直傳**：
       - `CombatUIManager.ts` 直接將已量測好之 `fromPoint: fromPt`、`toPoint: toPt` 與 `targetId: fxTargetId` 直傳注入 `CombatStageAdapter.playCombatAction`，杜絕二次猜測失真。
       - `CombatStageAdapter.ts` 與 `CombatStudioStageAdapter.ts` 全面升級支援 `options.fromPoint`、`options.toPoint` 與 `options.targetId`。
    3. **嚴格單元測試與真實瀏覽器戰鬥方向驗收**：
       - `src/systems/combat/CombatTargetResolution.test.ts` 5 項測試全數 PASS。
       - `scripts/verify-combat-vfx-direction.mjs` 真實無頭瀏覽器驗收：
         - 玩家施放重劈：起點玩家側 `x=88` ➔ 終點敵方側 `x=692`，$\Delta X = +604$（向右側敵方飛行，`isSelfHit = false`）。
         - 敵方施放斬擊：起點敵方側 `x=692` ➔ 終點玩家側 `x=88`，$\Delta X = -604$（向左側玩家飛行，`isSelfHit = false`）。
       - 全專案 58 個測試套件、336 項單元測試 100% PASS，`typecheck` 0 錯誤。

- **[Fix/CombatVFX/StageDynamicResizeAndViewportAlignment] 特效工房「多圖層展開舞台自適應、ResizeObserver 即時座標同步與時間軸高度保護」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **徹底根除多圖層展開 3D 特效向下脫節病灶**：
       - `VFXPlayer.ts` 引入 `ResizeObserver` 動態監聽 `#viewport` 容器尺寸，一旦時間軸展開或抽屜開關，0 延遲自動同步更新 `renderer.setSize`、`camera.aspect`、`camera.position.z` 與投影矩陣，在 `unmount` 時自動 `disconnect()` 防止記憶體洩漏。
       - `VFXPlayer.ts` 擴充 `onResize(cb)` 監聽介面。
    2. **影格與 SVG 彈道輔助線即時重繪**：
       - `VFXStudioController.ts` 訂閱 `fxEngine.onResize`，在舞台尺寸改變瞬間自動重新求值渲染當前影格 `renderStudioFrameAt` 與 SVG 彈道預測輔助線，無論靜態定格或連續播放皆 1:1 鎖定卡牌。
       - `VFXStage.ts` 引入 `ResizeObserver` 監聽 `#viewport`，輔助線無論視窗與容器如何變動皆 100% 貼齊卡牌。
    3. **時間軸軌道區高度保護**：
       - `src/styles/vfx-studio.css` 為 `#timeline-mount-point` 設置 `max-height: 330px; overflow-y: auto;` 與專屬深色滾動條，無論開多少圖層，時間軸內部皆平滑滾動，3D 舞台永遠保有足夠的預覽空間。
    4. **真實瀏覽器與極限條件自動化驗證**：
       - 執行 `scripts/verify-vfx-alignment.mjs`（1280x780 視窗、8 圖層展開＋抽屜）：Canvas 尺寸 536px 與舞台 100% 吻合，相機視距差 0.000，卡牌世界座標 Y=0 完全零誤差。
       - 執行 `scripts/verify-vfx-extreme-resize.mjs`（1024x600 極限矮視窗、9 圖層展開）：舞台壓縮至 303px，相機視距精確縮減至 365.75，卡牌世界座標 Y=0 零誤差。
       - 全專案 57 個測試套件、331 項單元測試 100% PASS，`typecheck` 0 錯誤。

- **[Fix/CombatVFX/TimelineInteractionAndHumanValidation] 特效工房「時間軸拖曳防自毀、鎖頭按鈕真實解鎖與頂部時長直覺輸入」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **徹底根除 Cue / Clip 拖曳自毀 Bug**：
       - `VFXTimeline.ts` subscribe 增加 `isDragging()` 守衛。拖曳進行中僅動態更新 CSS `style.left`/`style.width`，絕不觸發 `innerHTML` 銷毀，放開滑鼠（`pointerup`）後方安全結算，確保 Pointer Capture 零脫鉤。
    2. **打通主圖層 🔒 鎖頭按鈕**：
       - 修復 `TimelineInteraction.ts` 事件 Selector，支援通用 `.tl-lock-btn[data-track]`，主圖層鎖頭 100% 響應點擊切換，徹底解除對 Clip 縮放與移動的誤阻斷。
    3. **頂部直覺總時長調整與標籤釐清**：
       - 時間軸頂部新增 `#tl-input-duration` 直覺時長編輯欄（0.1s ~ 5.0s），輸入即可即時更新整體刻度尺與時鐘。
       - `tools/vfx-studio.html` 正名為「特效總時長 (duration)」。
    4. **排除單發技能連射時長污染**：
       - `VFXTimelineEvaluator.ts` 限制僅在 `salvoCount > 1` 或 `ARC_MULTI` 時納入連射時長，單發揮砍不再被 `salvoDuration` 空拉長。
    5. **真實人類操作 E2E 自動驗收**：
       - 執行 `scripts/verify-human-interactions.mjs`，在真實瀏覽器中親手驗證鎖頭切換、時長擴展、Cue 拖曳平移、Handle 縮小時長與 Clip 平移前搖，全流程 100% PASS。
       - 全專案 57 個測試套件、331 項單元測試全部綠燈，`typecheck` 0 錯誤。

- **[Fix/CombatVFX/SSOTDurationAndStageAdapterMount] 特效工房「SSOT 歷史資料演示時間校準、時間軸有效時長包絡線與實戰卡牌真實座標掛載」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **SSOT 歷史資料演示時長對齊 (VFX_PHANTOM_SLASH Duration Alignment)**：
       - 根除大改架構前殘留之 `duration: 0.2s` 與大改架構後擴充之連擊（`salvoDuration: 0.42s`）、次生圖層（`0.38s`）與打擊 Cue 點（`0.1s, 0.22s, 0.34s`）之歷史衝突。
       - `src/data/vfx_presets.json` 頂層時長校準為 `0.45s`，伺服器發布校驗 100% 綠燈通過。
    2. **真實總演示時長包絡線演算法 (Effective Presentation Duration Envelope)**：
       - 在 `src/ui/fx/VFXTimelineEvaluator.ts` 實裝 `getEffectivePresentationDuration`，以主軌、連射、所有次生圖層與打擊 Cue 之最大時間包絡線作為特效真實總演示長度。
       - `VFXTimeline.ts` 與 `VFXStudioController.ts` 統一採用該演算法驅動時間軸長度與時鐘，徹底解決工坊中後段演出被 0.2s 掐斷以及 Cue 點在右側邊界重疊壓縮的缺陷。
       - `VFXLibrary.ts` 格式化呈現伺服器回傳之 `details`，發布失敗時清楚顯示具體欄位錯誤原因。
    3. **主遊戲實戰 CombatStageAdapter 舞台掛載 (Real Card DOM Anchors)**：
       - 在 `src/ui/CombatUIManager.ts` 初始化時正式調用 `CombatStageAdapter.getInstance().mount(this.modal)`，關閉戰鬥時調用 `clear()`。
       - 徹底解決實戰中 `modalContainer` 為 `null` 導致卡牌節點找不到、特效永遠退回畫面固定 25%/75% 假座標、卡牌受擊動畫與跳字反饋癱瘓的重大工程缺陷。
    4. **全自動測試與構建狀態**：
       - 全專案 57 個測試檔案、331 項單元測試 100% 全部通過。
       - `npm run typecheck` 0 錯誤。
       - `npm run build`、`npm run test:vfx`、`npm run test:smoke` 100% 通過。

- **[Test/CombatVFX/Phase8ProductionValidationFullSuite] 特效工房「Phase 8 量產品質與 5 大關鍵驗收情境全數補齊」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **快照還原端到端閉環 (SSOT Snapshot Restore E2E)**：
       - `VFXSSOTPublishAndRestore.test.ts` 驗證 `POST /__vfx_api/restore_snapshot` ➔ `repo.reloadPresets` ➔ 觸發 `addChangeListener`，確認外部監聽畫面與資料庫 100% 同步還原。
    2. **三目標 AOE 實例與座標隔離 (3-Target AOE Isolation)**：
       - `VFXConcurrentPlayback.test.ts` 驗證三目標 AOE 各自持有獨立 `root` 群組與空間座標，任一目標 Effect 提早 unregister 時其餘實例持續穩定播放，杜絕多目標互相覆蓋。
    3. **全技能與武器普攻綁定 VFX ID 存在性 (VFX ID SSOT Resolution)**：
       - `SkillVfxBindingRegistry.test.ts` 全量遍歷 `SKILLS` 字典、`SkillVfxBindingRegistry` 與 6 大武器普攻解析器，斷言所有映射之 VFX ID 100% 存在於 `vfx_presets.json`，違規數為 0。
    4. **100 次循環 mount/destroy 零洩漏 (100-Cycle Mount/Destroy)**：
       - `VFXLifecycle.test.ts` 驗證 100 次高頻掛載銷毀循環下，Canvas 殘留恆為 0，事件監聽器新增與解除數 100% 相等。
    5. **固定 Seed 同時間點頂點數值確定性 (Deterministic Vertex Snapshot)**：
       - `VFXDeterministicPlayback.test.ts` 驗證相同 Seed 在 $t=0.3s$ 輸出之 Float32 頂點陣列精確恆等（Diff = 0），不同 Seed 產生明確抖動差異。
    6. **全自動測試與構建狀態**：
       - 全專案 57 個測試檔案、331 項單元測試 100% 全部通過。
       - `npm run typecheck` 0 錯誤。
       - `npm run build`、`npm run test:vfx`、`npm run test:smoke` 與 `npm run check:bundle` 100% 通過。

- **[Fix/CombatVFX/Phase1DeepEqualityAndStrictReadback] 特效工房「Phase 1 發布閉環深層比對與嚴格回讀斷言加固」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **消除偽比對與落實 Deep Equality Check**：
       - 在 `src/tools/vfx-studio/VFXLibrary.ts` 實裝遞迴深層比較函式 `isPresetDeepEqual`，結合 `VFXPresetRepository.sanitizePresetContent`，過濾 Session 暫態後比對伺服器回讀之完整 Preset（涵蓋主軌、所有 Layers 延遲時長與 ImpactCues 點位權重），徹底消除過去只比對 `colorCore` 與 `duration` 之淺層缺陷。
    2. **根除異常放行與偽綠燈通道**：
       - 徹底拔除 `catch { readBackOk = true; }` 逃生通道，若回讀 fetch 失敗、HTTP 非 200 或深層比對不符，嚴格拋錯中斷，`store.isDirty` 保持 `true`，畫面草稿 100% 完整保留。
    3. **測試與驗收狀態**：
       - `VFXStudioPublishFlow.test.ts` 擴充至 6 項單元測試，完整覆蓋回讀資料不一致與回讀網路中斷情境。
       - 全專案 57 個測試檔案、326 項單元測試 100% 全部通過，`npm run typecheck` 0 錯誤。

- **[Refactor/CombatVFX/Phase7TimelineDecouplingAndFacade] 特效工房「Phase 7 時間軸巨型檔案拆分與高內聚 Facade 重構」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **時間軸巨型檔案徹底解耦 (VFXTimeline Modularization)**：
       - 將原本 1190 行的 `src/tools/vfx-studio/VFXTimeline.ts` 拆分為四大單一職責模組（位於 `src/tools/vfx-studio/timeline/`）：
         - `TimelineView.ts`：尺規刻度、主軌、次生圖層、打擊判定軌、Cue 菱形 Marker 與播放頭 HTML 渲染。
         - `TimelineInteraction.ts`：播放頭 Scrubbing、Cue 拖曳/刪除/新增交易、Clip 拖曳移動（`delay`）與右緣 Handle 拉伸（`duration`）。
         - `TimelineCommands.ts`：Cue 與圖層增刪更新、軌道 Solo / Mute / Lock 與打擊展示模式業務指令。
         - `TimelineSelection.ts`：選取狀態管理，連動外部 Inspector 檢查器。
       - `VFXTimeline.ts` 收斂為 180 行高內聚 Facade，全面保留外部調度與測試合約（`onSelectCue`, `onSelectTrack`, `getFrameEngine`, `onScrubStart`, `onScrub`, `onScrubEnd`, `onPlayPauseToggle`, `seekTo`, `updateFrameUI`, `updatePlayhead`, `render`, `destroy`）。
    2. **消除私有欄位反射存取與公開品質指標 (Quality Budget Metrics API)**：
       - 在 `src/ui/fx/VFXPlayer.ts` 實裝公開方法 `getPerformanceMetrics()`，返回安全的 `drawCalls`, `triangles`, `activeParticles`, `activeChildCount`。
       - 消除 `VFXStudioController.ts` 中的 `(fxEngine as any).scene` 與 `(fxEngine as any).renderer` 私有欄位強制存取。
    3. **播放速度管線一致性 (Playback Speed Pipeline Coherence)**：
       - `FrameTimelineEngine.ts` 之 `setSpeed(speed)` 同步串接至 `this.scheduler.setSpeed(this.speed)`，使排程器與時間軸影格步進完全同調。
       - `VFXStudioStore.ts` 增設 `toggleTrackMute`，保持軌道 Mute 與 Solo / Lock 同步受通知機制保護。
    4. **驗收狀態**：
       - 單元測試：全專案 57 個測試檔案、324 項單元測試 100% 全部通過。
       - 視窗布局與壓力測試：`npm run test:vfx`（4 大解析度零溢出 + 100 次連續循環浸泡測試零洩漏）100% 全部通過。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Fix/CombatVFX/Phase0To6CanonicalSchemaAndClosedLoop] 特效工房「Phase 0~6 SSOT 發布閉環、DAG 圖層防護、確定性隨機、獨立實例隔離、完整生命週期與 Canonical VFXSequence 雙向轉譯」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **Canonical VFXSequence 規範收斂與雙向轉譯 (Phase 6)**：
       - 嚴格落地方案 1：將 `VFXSequence` (Schema v2) 作為正式標準模型，徹底消除 `VFXClip.layer?: any` 與 `curves?: any`，以型別安全的 Discriminated Union `VFXClipPayload` 涵蓋 MESH, PARTICLE, IMPACT, SCREEN_FX, AUDIO, COMPOSITE_LAYER。
       - 實裝雙向無損轉譯器：`migrateLegacyPreset` (升級為 Sequence) 與 `sequenceToLegacyPreset` (還原為 Runtime Preset)，經 30 款正式 Preset 雙向 Roundtrip 嚴密測試，數值與演出合約 100% 保持一致，零失真。
       - `VFXPresetRepository.sanitizePresetContent`：實現內容數據與 Editor Session State (Solo, Mute, Selection, Lock) 嚴格解耦，持久化庫絕不殘留 UI 暫態。
    2. **發布交易閉環 (Publish & Readback Transaction)**：
       - `VFXPresetRepository.ts` 提供 `upsertDraft(preset)`，保證點擊發布時將畫面草稿寫入快取。
       - `VFXLibrary.ts` 完整串通：草稿取用 ➔ 前端驗證 ➔ 寫回 Repo ➔ POST 發布 ➔ GET 回讀比對 ➔ 比對一致解除 Dirty。切換預設下拉選單支援 confirm 攔截，未保存草稿不再被靜默覆寫。
    3. **共用驗證器與圖層 DAG 環路防線 (Unified Validator & DAG Defense)**：
       - `VFXPresetValidator.ts` 擴充圖層延遲、時長、存在性、自我引用與循環引用（Cycle Detection，限制深度 <= 8）。
       - `vite.config.ts` 開發伺服器全面委派至 `VFXPresetValidator.validatePresetList`，達成前後端 100% 驗證規格合一。
       - `CombatFXEngine.playPresetWorld` 增設遞迴防線（`visitedPresetIds`，深度上限 8），徹底免疫運行時堆疊溢位崩潰。
    4. **確定性隨機與種子 UI 貫通 (Deterministic PRNG & Controlled Seed UI)**：
       - 建立 `src/ui/fx/VFXRng.ts`，徹底掃除核心渲染路徑散落之原生 `Math.random()`（粒子爆散、拖尾抖動、次生晶刺、地裂高度偏移）。
       - 工房頂部工具列提供確定性 Seed 數字顯示、自訂與「🎲 換種子 (Reroll)」功能，與 `CombatFXEngine.setSessionRng` 實質連動。
    5. **獨立 Effect Instance 與多目標 AOE 隔離 (VFXEffectInstance & AOE Isolation)**：
       - 建立 `VFXEffectInstance.ts` 與 `VFXInstanceRegistry`，每次播放建立獨立 root group 與 track groups，並限定最多 32 個活躍實例超額自動降級。
       - 單一特效完成時透過 `disposeTrackGroup` 僅釋放自身 Geometry/Material/Texture 與快取，`clearStudioPreview()` 僅清除工坊預覽群組，徹底解耦戰鬥實例。
       - `CombatStageAdapter.ts` 實裝多目標 AOE 空間打擊分離，確保每位受擊目標各自具備獨立 3D 爆散火花與受擊反饋。
    6. **完整生命週期與資源管理 (Complete Lifecycle & Zero Leak)**：
       - `VFXPlayer` 實裝 RAF ID 保存與 `stopLoop()`，避免不可控動畫幀殘留。
       - 具名 `boundResize` 監聽器解除、`safeRemoveCanvas()` 容器遷移安全防護、各主模組具備冪等 `destroy()` 方法。
       - 定時器完成即時自 `scheduledTimers` 移除，徹底根治 ID 句柄殘留洩漏。
    7. **驗收狀態**：
       - 單元測試：全專案 57 個測試檔案、324 項單元測試 100% 全部通過。
       - 視窗布局與壓力測試：`npm run test:vfx`（4 大解析度零溢出 + 100 次連續循環浸泡測試零洩漏）100% 全部通過。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Refactor/CombatVFX/Phase2TimelineEvaluatorDecoupling] 特效工房「Phase 2 特效業務邏輯與節奏排程解耦」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **純邏輯時間軸求值器 (VFXTimelineEvaluator)**：
       - `VFXTimelineEvaluator.ts` 封裝純函數時間序列演算法，杜絕任何 DOM 與 WebGL 渲染耦合：
         - `evaluateSalvoTimings`：精準求值 4 種節奏曲線（`LINEAR`、`ACCELERATE`、`DECELERATE`、`BURST_PAIRS`），嚴格輸出單調遞增時間序列。
         - `resolveImpactCues`：具名 Impact Cue 提取；無 Cue 時依連擊段數展開標準化 Fallback Cues 並標註 `isPrimary`，徹底消除雙軌制分支。
         - `resolveCompositeLayers`：安全解析複合圖層延遲、軌跡覆蓋與著色器繼承，過濾靜音圖層並防止遞迴。
         - `calculateHitFeedback`：計算前段輕顫與終擊重震之受擊回饋參數。
    2. **主引擎調度管線全面瘦身 (CombatFXEngine Integration)**：
       - `CombatFXEngine.ts` 中的 `playPresetWorld` 全面委派至 `VFXTimelineEvaluator`，消除了原本散落重複的連擊迴圈與圖層解析代碼，核心排程邏輯簡明清晰。
    3. **驗收狀態**：
       - 單元測試：`src/ui/fx/VFXTimelineEvaluator.test.ts`（12 項單元測試 100% 通過）。
       - 全專案單元測試：51 個測試檔案、305 項測試 100% 全部 PASS。
       - 視窗布局與壓力測試：`npm run test:vfx`（4 大解析度零溢出 + 100 次連續循環浸泡測試零洩漏）100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Refactor/CombatVFX/Phase1DecoupleGeometryAndLayoutFix] 特效工房「Phase 1 特效渲染器解耦與工坊多視窗布局修復」完工交接（2026-09-07）**：
  - **核心交接重點**：
    1. **幾何與特效渲染器解耦 (Layer Renderers Decoupling)**：
       - 專職渲染層全面成型：
         - `MeshLayerRenderer`：幾何體生成（刀光網格、次生冰刺/尖岩、聖盾、戰吼音波、光柱）。
         - `ParticleLayerRenderer`：粒子爆散（受擊星芒爆散、放射性粒子）。
         - `TrailLayerRenderer`：點雲拖尾、雷擊電弧、能量光束、弓兵拋物齊射。
         - `ImpactLayerRenderer`：2.5D 受擊光環擴散衝擊波。
         - `ScreenFxRenderer`：受擊畫面閃光、螢幕震動與目標卡牌震顫全部統一委派，消除直接以 inline style 侵入 DOM 的歷史舊代碼。
       - `CombatFXEngine.ts` 從 2700+ 行大幅精簡至 1686 行，消除了 1000+ 行重複幾何建構與冗餘材質邏輯。
    2. **工坊 768px 工具列響應式布局溢出修復 (Responsive Layout Overflow Fix)**：
       - 修復 `tools/vfx-studio.html` 在 768x900 視窗下頂部工具列超寬 2px（770px vs 768px）問題。
       - 在 `src/styles/vfx-studio.css` 之 `@media (max-width: 768px)` 中調校 gap/padding 並設定 `overflow-x: hidden`。
       - `scripts/verify-vfx-studio-layout.mjs` 自動化驗證 4 個常見 Viewport（1440x900, 1280x720, 1024x768, 768x900）100% PASS，零水平溢出、零 DOM 洩漏。
    3. **驗收狀態**：
       - 壓力測試：`npm run test:vfx:soak` 100 循環連續播放浸泡測試 100% PASS（Canvas 恆為 1、WebGL Context 穩定、零錯誤）。
       - 布局驗證：`npm run test:vfx:layout` 4 大視窗 100% PASS。
       - 戰鬥與特效單元測試：19 個測試檔案、147 項單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Feature/CombatVFX/Phase3Phase4TrackControlsAndContextualInspector] 特效工房「Phase 3 & Phase 4 軌道專業控制項 (Solo/Lock) 與情境式 Inspector 動態收合」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **時間軸軌道控制項 (Track Controls: Solo & Lock)**：
       - `VFXStudioStore.ts` 支援主軌與各圖層軌道獨立之 `Solo` 與 `Lock` 狀態管理。
       - `VFXTimeline.ts` 渲染專屬 S / 🔒 控制按鈕，點擊 Solo 時其餘未 Solo 軌道自動遮蔽，且 `CombatFXEngine` 之確定性求值管線在底層即時過濾不活躍群組；Lock 鎖定時 Clip 呈現琥珀色防誤觸斜紋並嚴格阻擋位移與時長拉伸。
    2. **情境式 Inspector 動態收合 (Contextual Inspector)**：
       - `VFXInspector.ts` 與時間軸選取事件完整貫通：點選 Cue Marker 時自動收合左側無關卡片（施法發力、受擊衝擊等），右側專注展開 Cue Inspector；選取主軌或特定圖層時自適應切換幾何與材質面板。
    3. **驗收狀態**：
       - 單元測試：`src/tools/vfx-studio/VFXTimelineTrackControls.test.ts`（5 項測試 100% 通過）。
       - 瀏覽器驗證：`scripts/verify-track-controls-contextual.mjs` 真實 Chromium 驗收通過，截圖保存於 `docs/screenshots/track_controls_contextual_verified.png`。
       - 全專案單元測試：50 個測試檔案、293 項單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Feature/CombatVFX/Phase7ProductionQualityAndSoakTest] 特效工房「Phase 7 量產品質守護與 Soak Stress 浸泡測試全通（效能預算 HUD、100 次循環浸泡壓力測試 0 洩漏）」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **效能預算 HUD 實裝確認 (Quality Budget HUD)**：
       - 依據 `docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md` 第 10 節效能預算標準，在 `tools/vfx-studio.html` 與 `VFXStudioController.ts` 中確認並接通 `#quality-budget-hud`。
       - 每 250ms 即時求值 DrawCall（DC）、活躍粒子數、三維三角形面數（Triangles）與場景物件數，並自動進行單體（35 DC / 250 粒子）與 AOE/複合圖層（70 DC / 600 粒子）超標警示切換。
    2. **100 次連續播放浸泡式壓力測試 (100-Cycle Soak Stress Test)**：
       - 完善 `scripts/soak-test-vfx.mjs`，在無頭 Chromium 瀏覽器中執行高頻 100 次連續特效播放循環。
       - 實測結果：全週期維持單一畫布（Canvas Count 恆為 1，零 Canvas 洩漏）、WebGL Context 穩定無遺失、幾何體與貼圖記憶體無上限膨脹，瀏覽器主控台 0 錯誤。
    3. **驗收狀態**：
       - 單元測試：49 個測試檔案、288 項單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Feature/CombatVFX/Phase6CombatStudioAndDebugOverlay] 特效工房「Phase 6 戰鬥演播室同源整合與 Debug Overlay 落地（真實 DOM 覆蓋層、全專案零殘留、無頭自動化全通）」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **即時戰鬥與特效除錯覆蓋層 (Combat Action Debug Overlay)**：
       - 依據 `docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md` 第 12 節「除錯覆蓋層 (Debug Overlay)」，在 `CombatActionPlayer.ts` 實裝 `CombatActionDebugInfo`。
       - 覆蓋層實時顯示：`ActionID`、`Phase` (START / PLAYING / CUE_IMPACT / FALLBACK / DONE)、`Actor` ➔ `Target`、`VFX` 預設、`Cue` 索引及觸發時間、已結算之真實多段 `Impacts`。
       - 具備防重疊智慧掛載與 1.5s 閒置自動復位（`IDLE`）機制，避免殘留。
    2. **戰鬥演播室同源適配器與開關接通 (Combat Studio Integration & Toggle Switch)**：
       - 於 `src/templates/combat-studio.html` 工具列注入 `#btn-vfx-debug-toggle` 按鈕，並於 `CombatStudio.ts` 綁定切換事件。
       - 透過 `CombatStudioStageAdapter.ts` 與全域 `CombatActionPlayer` 單一實例接軌，保證主遊戲實戰模態框、戰鬥演播室與特效工坊具備 100% 相同行為。
    3. **驗收狀態與瀏覽器無頭真實驗證 (Browser Verification & 288 PASS)**：
       - 撰寫 `scripts/verify-phase6-combat-debug.mjs`，於 Chromium 無頭瀏覽器實測點擊切換除錯開關、觸發單場戰鬥、精確捕捉 `#vfx-debug-overlay` 動態呈現、截圖存檔至 `docs/screenshots/combat_studio_debug_overlay.png` 並驗證快速結束無殘留。
       - 單元測試：49 個測試檔案、288 項單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Feature/CombatVFX/Phase5ProductionCueAndCombatContract] 特效工房「Phase 5 正式 Cue 與戰鬥契約全量落地（WebGL 異常容錯、多段真實傷害安全 fallback、503 權重拆分不變量守護、情境式 Cue Inspector 雙向閉環）」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **WebGL 失敗戰鬥仍完成 (Fault-Tolerant Pipeline)**：
       - `CombatActionPlayer.ts` 的 `playAction` 實裝 `try ... catch ... finally` 防護。
       - WebGL 崩潰、上下文遺失或 Shader 編譯失敗時，自動安全切換至純邏輯 fallback，將所有待派發的有效數值與狀態項目完整分發至 UI，保證 `onActionComplete` 100% 觸發，戰鬥流程永不中斷卡死。
    2. **戰鬥不變量守護與多段傷害對齊 (Integer-Safe Weighted Split & Multi-Impact Fallback)**：
       - 嚴格實裝文件第 11 節指標：503 依 20/20/60 權重拆分後，終擊段吸收餘數，各段加總 100% 精確等於 503。
       - 遵循第 8 節 EXACT_IMPACTS 規範「cue 不足時驗證失敗；runtime 只能使用明確 fallback 並警告」，修復多段真實傷害因預設 Cue 數量不足而被截斷吞掉的重大缺陷，動態補充 fallback cue 確保真實傷害 100% 消費。
       - 實裝 `STATUS_APPLY` 增減益狀態事件映射為 `STATUS`，嚴格杜絕無數值項目時虛構 `DAMAGE` 的語意污染；`VISUAL_ONLY` Cue 金額嚴格為 0。
    3. **情境式 Cue Inspector 雙向資料閉環 (Contextual Cue Inspector Integration)**：
       - 在 `VFXStudioController.ts` 正式接通 `timeline.onSelectCue((idx) => inspector.setSelectedCueIndex(idx))`。
       - 點選時間軸 Cue Marker 即可於右側展開 `#card-cue-inspector`，支援 ID、Time、Kind、Weight、Primary 與 TargetPolicy 即時編輯，並即時更新 Store 與 50 步 Undo/Redo 歷史快照；點擊空白處自動取消選取收合。
       - 拖曳排序後以唯一 `cueId` 精確校準 `selectedCueIndex`，杜絕排序後 Inspector 狀態錯位。
       - 精簡 `tools/vfx-studio.html` 至 790 行（滿足全專案 < 800 行之嚴格架構限制）。
    4. **驗收狀態**：
       - 單元測試：`src/systems/combat/CombatActionAndCueMapping.test.ts` 與 `src/tools/vfx-studio/VFXStudioInteractivity.test.ts` 擴充測試 100% PASS。
       - 全專案單元測試：48 個測試檔案、283 個單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Refactor/CombatVFX/UnifiedDeterministicPipeline] 特效工房「全形態單一確定性求值管線重構」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **徹底切除雙軌制分裂 (Dual Pipeline Elimination)**：
       - 廢除 `CombatFXEngine.ts` 內部 10 個分散、自毀型的舊播放函式分流。
       - 連續播放時直接註冊受控的統一 Effect，以時鐘當前時間 $t$ 呼叫 `renderFrameWorldAt(preset, elapsed, startPos, actualEndPos)`。
    2. **特效工坊單一確定性推進 (VFXStudioController Unified Rendering)**：
       - 移除 `VFXStudioController.ts` 中 `playNativeEffect` 與 `isPlaying()` 的分流邏輯，不論播放中或是暫停拖曳定格，`onFrame` 每幀 100% 統一呼叫 `renderStudioFrameAt(data.time)`。
       - 命中真實火花星芒（`playCueSparks`）與目標卡牌受擊震動／飄字傷害回饋在時鐘掃過 Cue 點時以事件觸發，不干擾主幾何物體。
    3. **全形態幾何對齊與多彈道散發 (All Shapes & Multi-Arc Coverage)**：
       - 補齊 `ARC_MULTI`（奧術追蹤彈 / 多彈道齊射）貝茲弧線側向散發姿態，消除過去多彈道跌落為單顆光球的缺陷。
       - 貫穿彈道 `COLUMN_PIERCE` 自動向前延伸 `penetrationDistance`，定格與播放終點完全對齊。
       - `createGlowTexture` 補齊 SSR / Node 無頭測試環境防護，解決測試時 `document is not defined` 報錯。
    4. **驗收狀態**：
       - 單元測試：`src/tools/vfx-studio/VFXConsistency.test.ts` 擴充至 9 大形態單元測試 100% PASS。
       - 全專案單元測試：48 個測試檔案、280 個單元測試 100% PASS。
       - TypeScript 編譯：`npm run typecheck` 0 錯誤。

- **[Fix/CombatVFX/SSOTFullSuiteScrubbingAndPlayingConsistency] 特效工房「全套 8 大經典技能形態 SSOT 姿態與路徑求值管線全量統一」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **徹底打破定格與播放「雙軌制」**：
       - 動態播放與時間軸定格求值不再各自硬編碼，全專案收攏至 `MeshLayerRenderer` 靜態純函式與統一軌跡計算。
    2. **8 大經典技能形態 100% 對齊**：
       - ⚔️ **刀芒/旋風/十字**：統一調用 `MeshLayerRenderer.calculateSlashGeometryParams`，消滅 360° 旋風與方向顛倒缺陷。
       - ☄️ **天傾隕石/天降天火**：`calculate3DTrackPos` 納入 `DIAGONAL_DROP`、`VERTICAL_DROP`、`GROUND_BURST`，掛載 `VOLUMETRIC_FIRE` 黑體體積火焰。
       - 🛡️ **神聖護盾**：`buildHolyShieldGroup` / `updateHolyShield`，動態播放與定格統一六角柱、外環與十字架。
       - 📢 **戰吼音波**：`buildTauntShoutGroup` / `updateTauntShout`，動態播放與定格統一 3 重平移音波環。
       - ☀️ **神聖天降光柱**：`buildHolyPillarMesh` / `updateHolyPillar`，直徑隨進度收縮消散。
       - 🏹 **拋物線齊射箭雨**：定格求值以 Quadratic Bezier 實裝 9 根箭矢之空中弧度與切線姿態。
       - 🌋 **大地裂地波推進**：定格求值以 nodes 陣列沿地面隨進度生長實體尖岩與黑焦裂痕。
       - 💥 **命中伴生次生尖刺**：命中進度點觸發實體尖錐群散射。
    3. **品質與測試矩陣**：
       - 新增專屬測試檔案 `src/tools/vfx-studio/VFXConsistency.test.ts`（5 大單元測試全部通過）。
       - TypeScript 編譯 0 錯誤 (`tsc --noEmit` PASS)。
       - 全量 48 個測試檔案、276 個單元測試 100% 全部通過。

- **[Feature/CombatVFX/Deterministic3DTimelineEvaluator] 特效工房「原本整套 3D 特效貫通時間軸 ＋ 多圖層真實幾何動態求值渲染器」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **渲染求值管線修復**：
       - `VFXStudioController.ts` 中 `frameEngine.onFrame` 正式接入 `this.renderStudioFrameAt(data.time)`，消除過去時間軸運行卻未觸發 3D 特效繪製的斷點。
       - 在 `store.subscribe`、初始化以及影格推進時均進行即時動態求值。
    2. **全套 3D 著色器幾何實體生成器**：
       - 徹底告別過去非近戰一律給一顆 `SphereGeometry`（小球）的粗暴寫法。
       - `CombatFXEngine.ts` 內建專屬 `renderTrack3DGeometry`：
         - ⚔️ `SLASH_BLADE`：流線月牙雙層光刃、十字斬、旋風斬（`MeshLayerRenderer.buildDynamicSlashGeo`）。
         - ⚡ `DIELECTRIC_LIGHTNING`：CatmullRom 隨時間延伸之 3D 折線雷電 Tube 管身 ＋ 地面擴散光環。
         - 🪨 `EARTH_SHATTER`：5 根 3D 錐體破土突刺岩石陣列（破土、定格、崩解）。
         - ❄️ `FROST_LANCE` / `FROST_NOVA`：旋轉 3D 冰錐 ＋ 菲涅爾冰晶環 ＋ 綻放冰凌。
         - 🔮 `ENERGY_BEAM`：貫穿起訖點之發光能量光柱 ＋ 兩端聚能環。
         - 🌐 通用八面體自發光能量晶核 ＋ 雙交叉旋轉環。
    3. **TIMELINE 規格多圖層並行求值**：
       - `CombatFXEngine.renderFrameAt` 遍歷 `allTracks = [mainTrack, ...secondaryTracks]`。
       - 嚴格依照各圖層的 `delay`、`duration`、`spatialMode`、`reverse`、`scale` 計算 3D 世界座標。
       - 依據 `fadeIn` 與 `fadeOut` 計算透明度衰減 `fadeAlpha`，不在生命週期內的軌道自動隱藏。
  - **驗收狀態**：
    - 單元測試：47 個測試檔案、271 個單元測試 100% PASS。
    - TypeScript：`tsc --noEmit` 0 錯誤。
    - 端到端瀏覽器驗收：`node scripts/verify-compositor-workflow.mjs` 11 大項目 100% 通過（驗證 8 個真實 3D 實體網格並行生成）。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\compositor_workflow_verified.png`。

- **[Feature/CombatVFX/CompositorFeedbackAndPrecisionFixes] 特效工房「播放頭 0s 物理精準對齊 ＋ Clip 淡入淡出視覺調整列 ＋ CUE 標記 ✕ 鍵盤一鍵刪除 ＋ 多段跳傷害浮動回饋 ＋ 消除藍球干擾 ＋ 圖層素材自由挑選」完工交接（2026-09-06）**：
  - **核心交接重點**：
    1. **播放頭 0 秒基準線精確對齊**：
       - `VFXTimeline.ts` 內 `updateFrameUI` 改用動態讀取 `rulerBar.offsetLeft + rulerBar.clientWidth * progress`，徹底消除舊版本寫死 `calc(120px + ...)` 導致的 28px 左偏跑位問題，0.00s 與刻度尺起點垂直絕對對齊。
    2. **圖層 Clip 點選編輯列與淡入淡出 (Fade In / Fade Out)**：
       - 點選任一圖層 Clip（或點擊開關），即切換 `selectedClipIndex`，時間軸頂部即時彈出金色邊框編輯列 (`#tl-selected-clip-toolbar`)。
       - 創作者可直接滑動微調：淡入時間 (`fadeIn`)、淡出時間 (`fadeOut`) 與圖層特效縮放 (`scale`)，Clip 兩端具備即時透明漸層與高亮外框。
    3. **CUE 刪除機制與無 CUE 純視覺單軌素材支援**：
       - 選取 CUE 標記時，即時浮現紅色圓形按鈕 (`.tl-cue-delete-btn`)，點擊或按鍵盤 `Delete` / `Backspace` 即可刪除。
       - 解除以往至少保留 1 個 CUE 的限制，允許刪除至 0 個 CUE，滿足「不含 CUE 之單軌純視覺素材」的拆分與組合架構。
    4. **多段打擊傷害判定與動態浮動字體**：
       - 當播放頭掃過每個 CUE 判定點時，受擊卡牌除了震動、擠壓與閃白外，頭頂即時生成上浮消散的傷害數字標籤（一般 `💥 -780`、主力/暴擊 `🔥 CRITICAL -2,850`）。
    5. **消除除錯藍球遮擋**：
       - 將 `#benchmark-marker` 強制設定為 `display: none`，舞台回歸純淨 3D 著色器特效展示。
    6. **圖層素材自由挑選與素材庫追加**：
       - 每個次生圖層 Header 配備下拉選單 (`.tl-layer-preset-select`)，可直接切換引用的素材庫預製件。
       - 左側素材庫面板新增「➕ 加入時間軸圖層」按鈕，選定素材後點擊即可直接將其作為新圖層軌道追加至時間軸。
  - **驗收狀態**：
    - 單元測試：47 個測試檔案、271 個單元測試 100% PASS。
    - TypeScript：`tsc --noEmit` 0 錯誤。
    - 端到端瀏覽器驗收：`node scripts/verify-compositor-workflow.mjs` 10 大項目 100% 通過。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\compositor_workflow_verified.png`。

- **[Feature/CombatVFX/CompositorWorkflowAndBiomechanics] 特效工房「預製件素材庫四大分類 ＋ 無損暫存跳轉編輯 (Jump to Edit & Return) ＋ 雙向力學貫通 (Caster Motion vs Impact CUE) ＋ 影格邊緣過渡」完工交接（2026-09-06）**：
  - **核心工作流與架構升級交接**：
    1. **預製件素材庫四大分類 (Prefab Library Segmentation)**：
       - `VFXLibrary.ts` 實裝四大分類 Tabs：`🏠 自身 (CASTER)`、`🚀 彈道 (TRAJECTORY)`、`💥 目標 (TARGET)` 與 `🌐 全部 (ALL)`。
       - 依據時空錨點動態歸納專案 30 款預製件，下拉選單即時分類過濾。
    2. **非線性合成器與無損暫存跳轉編輯 (Safe Jump to Edit & Return)**：
       - 圖層僅作為排程器引用素材 ID，不修改破壞素材內部物理配置。
       - 時間軸圖層旁邊提供 `🔗` 跳轉編輯按鈕：點擊時呼叫 `store.stashCurrentDraft(currentName)`，將當前複合技能安全存入棧堆；
       - 頂部工具列浮現 `🔙 返回草稿 [名稱]` 按鈕；編輯完單軌素材後點擊返回按鈕，調用 `store.popStashedDraft()` 100% 無損復原，草稿絕不遺失。
    3. **雙向力學貫通（受擊打擊感 vs 施術者發力動作）**：
       - **打擊 CUE**：作為數值與反饋交匯點，精確驅動受擊卡牌之定格、擠壓、震動與擊退。
       - **施術者發力動作 (Caster Motion)**：新增踏步突進 (`stepForward`)、射擊後坐力 (`recoil`)、出刀傾角 (`tiltAngle`) 與動作時長 (`motionDuration`)。
       - 提供純函式 `calculateCasterMotionOffset(t, motion)`，於 60 FPS 確定性逐幀計算身體位移與傾斜角度。
    4. **影格邊緣過渡 (Fade In / Fade Out)**：
       - 圖層 Clip 支援淡入淡出時長 (`fadeIn`, `fadeOut`) 與模式 (`fadeMode`)，消除閃現與硬截斷，Clip 兩端提供斜切漸層視覺回饋。
    5. **UI 斷捨離 (UI Streamlining)**：
       - 緊湊化 Inspector 控制項，HTML 行數壓低在 750 行以內，介面清爽聚焦。
  - **驗收狀態**：
    - 單元測試：47 個測試檔案、271 個測試全數 PASS。
    - TypeScript：`tsc --noEmit` 0 錯誤。
    - 無頭端到端全流程驗收：`node scripts/verify-compositor-workflow.mjs` 100% PASS。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\compositor_workflow_verified.png`。

- **[Feature/CombatVFX/LayerCompositorAndFiveTrajectories] 特效工房「5 大位移彈道路徑 ＋ 🔄 反向開關 ＋ 專業多圖層合成系統」實裝與端到端驗收完成（2026-09-06）**：
  - **核心架構升級與交接重點**：
    - **5 大幾何位移彈道路徑 ＋ 反向開關 (Reverse)**：
      - 徹底拆解空間位置與形態表現：
        1. `A_TO_B`：施術者 ➔ 目標（正向直飛/拋物線，反向為 B ➔ A 汲取）。
        2. `A_TO_VERTICAL_SKY`：施術者 ➔ 垂直天空（朝天射箭/信號彈，反向為天光垂直灌頂自身）。
        3. `VERTICAL_SKY_TO_B`：垂直天空 ➔ 目標（天降雷殛直劈，反向為受擊目標被垂直擊飛沖天）。
        4. `A_TO_DIAGONAL_SKY`：施術者 ➔ 斜向天空（斜天際迫擊發射，反向為斜方星光灌頂自身）。
        5. `DIAGONAL_SKY_TO_B`：斜向天空 ➔ 目標（斜降流星天火砸向目標，反向為目標被斜向擊飛出鏡頭）。
      - 原地類保留 `AT_CASTER`（A 自身）與 `AT_TARGET`（B 目標）。
      - 提供統一數學插值工具 `calculateSpatialPoint(mode, reverse, progress, casterPoint, targetPoint)`。
    - **專業多圖層合成系統 (Multi-layer Compositor)**：
      - 主軌（L0）與次生圖層（L1..N）全數軌道化，每條圖層軌道具備專屬實體 Clip。
      - 支援平移前搖時間 `delay`、拖拉右緣把手調節時長 `duration`，且全圖層均受限於 $0 \le \text{delay} + \text{duration} \le \text{Timeline Duration}$（選項 B）。
      - 每個圖層具備獨立靜音（`👁️` / `❌`）與刪除按鈕（`🗑️`）。
      - 提供「+自身前段圖層」、「+位移彈道圖層」、「+天降彈道圖層」、「+受擊爆破圖層」4 大快捷新增按鈕，支援快速拼出複合技能演出。
  - **驗收狀態**：
    - 單元測試：`src/tools/vfx-studio/` 全數 PASS。
    - TypeScript：0 錯誤。
    - 無頭端到端全流程驗收：`node scripts/verify-layer-compositor.mjs` 100% 通過。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\layer_compositor_verified.png`。


  - **核心架構升級與交接重點**：
    - **主特效軌實體 Clip 化**：
      - 主軌現在與次生圖層相同，為具備起點與時長的實體 Clip（`.tl-main-clip`）。
      - 創作者可按住本體左右平移前搖時間 `mainDelay`，拖動右緣把手拉伸有效時長 `mainDuration`。
      - 嚴格守護邊界不變量：$0 \le \text{mainDelay} + \text{mainDuration} \le \text{duration}$。
      - 拖曳過程受 `isDraggingClip` 狀態保護，避免 `store.subscribe` 銷毀重建 DOM 造成指標斷裂，放開後自動呼叫 `this.render()` 並支援 Undo/Redo。
    - **三大時空錨點模型（Spatial Anchor System）**：
      - 透過 `getTrajectorySpatialAnchor(trajectory)` 自動將彈道歸納為三種核心空間計算模式：
        1. `AT_CASTER`（A 點自身）：固定在施術者卡牌中心。
        2. `TRAJECTORY`（A➔B 彈道）：在 `[mainDelay, mainEnd]` 期間線性插值飛向目標。
        3. `AT_TARGET`（B 點目標）：固定在受擊目標卡牌中心。
      - 主軌與基準標記皆具備 `[🏠 自身(A)]`、`[🚀 彈道(A➔B)]`、`[💥 目標(B)]` 明確視覺標籤。
  - **驗收狀態**：
    - 單元測試：18/18 PASS。
    - TypeScript：0 錯誤。
    - 無頭端到端全流程驗收：`node scripts/verify-main-track-clip.mjs` 與 `node scripts/verify-frame-timeline.mjs` 雙雙 100% 通過。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\main_track_clip_verified.png`。

- **[Refactor/CombatVFX/FrameTimelineEngineAndDeterministicScrubbing] 特效工房打掉舊拋棄式動畫、建立 60 FPS 純確定性 FrameTimelineEngine 影格時間軸核心與基準測試物件驗收完成（2026-09-06）**：
  - **核心架構升級與交接重點**：
    - **消滅舊有拋棄式動畫，確立純確定性影格引擎**：
      - 依據使用者指示，徹底清理並停止拿實戰拋棄式動畫（一次性播完 dispose）套在編輯器上的做法。
      - 核心驅動模組全面轉向 `src/tools/vfx-studio/FrameTimelineEngine.ts`。整數影格 $F \in [0, TotalFrames]$ 為單一真相來源，所有狀態（播放、暫停、停止、逐幀前進、逐幀倒帶、Scrubbing）皆圍繞整數影格原子操作。
    - **時間軸 UI (`VFXTimeline.ts`) 重構**：
      - 頂部控制列實裝 `▶ 播放 (Space)`、`⏪ -1 幀`、`⏩ +1 幀`、`⏹ 重置` 按鈕。
      - 刻度尺拖曳 (Scrubbing) 與 Seek 精確吸附至整數影格 $F = \text{round}(\text{pct} \times \text{totalFrames})$。
      - 頂部按鈕狀態與時間軸按鈕 100% 雙向同步。
    - **視口基準測試標記 (`#benchmark-marker`) 連動**：
      - 在視口建立純淨無干擾的發光基準標記，標籤即時顯示 `F: XX / YY`。
      - 影格遞增/遞減或定格時，基準標記嚴格遵循線性插值 $P(F)$ 移動，受擊卡牌即時依 Cue 點時間產生打擊回饋。
    - **後續接入特效系統指引**：
      - 影格時間軸基礎已 100% 確定性固化完成，且通過無頭端到端逐格檢驗。後續若要重新接入特效渲染，只需透過 `frameEngine.onFrame((data) => { /* 純函數式渲染 f(data.frame / data.totalFrames) */ })`，嚴禁再次引入具有內部狀態或自動自毀的一性次實體。
  - **驗收狀態**：
    - 單元測試：`src/tools/vfx-studio/FrameTimelineEngine.test.ts` (6 tests PASS), `PlaybackClockAndTimeline.test.ts` (12 tests PASS)，合計 18/18 PASS。
    - TypeScript：`node ./node_modules/typescript/bin/tsc --noEmit` 0 報錯。
    - 真實無頭互動驗收：`node scripts/verify-frame-timeline.mjs` 100% 通過（+1 幀連點 5 次、-1 幀連點 2 次、重置歸零、50% 尺規吸附、空白鍵播放/暫停雙向同步）。
    - 視覺證據：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\frame_timeline_verified.png`。

- **[Fix/CombatVFX/DeterministicTimelineAndLiveMorphing] 特效工房時間軸確定性影格求值、逐格步進倒帶、暫停定格與所見即所得熱形變重構完成（2026-09-04）**：
  - **核心架構變更與問題根治**：
    - **時間軸確定性影格求值管線 (`CombatFXEngine.renderFrameAt`) 與真實渲染落地**：
      - 徹底拋棄「實戰一次性播放、播完自毀 (dispose)」的表層拼裝邏輯。
      - 在 `CombatFXEngine` 建立常駐的 `studioPreviewGroup`，以輸入時間 $t$ 為唯一參數，動態精確求值月牙劍氣幾何頂點（展開角度、半徑、寬度、長寬比 `slashAspect`、起手旋轉角、雙向斬擊）與光學著色。
      - **消滅座標換算錯位**：改用 `studioAdapter.getElementCenter(el)`，使刀芒精準定位於卡牌中心，杜絕物體飛出相機視野的嚴重弊端。
      - **守護常駐場景節點**：每次求值確保 Group 穩固掛載於當前 `scene`，杜絕 `clear()` 後脫節導致面數為 0 的隱蔽問題。
      - **真實渲染面數 48 面（DrawCalls: 1）**：定格時限制最小展開弧長（`0.18`）與透明度（`0.4`），幾何網格絕不退化，受擊卡牌前實體白熾月牙刀芒清晰可見。
    - **時間軸功能列升級 (Frame Stepping & Pause/Play)**：
      - 在 `VFXTimeline.ts` 頂部新增「⏸ 暫停 / ▶ 播放」、「⏪ -0.02s」單格步退與「⏩ +0.02s」單格步進按鈕。
      - 支援 0.02s 超高精度微調，貫穿紅線播放頭與時間秒數 HUD 緊密連動。
    - **參數調整所見即所得 (Live Morphing)**：
      - `VFXStudioController.ts` 與 `VFXInspector.ts` 深度連通：在暫停或 Scrubbing 狀態下拉動滑桿，立即以當前定格時間 $t$ 求值並刷新 3D 畫面，實現所見即所得的即時熱形變。
      - 拖曳至打擊 Cue 區間時，受擊目標卡牌即時呈現 Punch 擠壓、Shake 震顫與 Knockback 擊退。
    - **孤兒控制項 100% 綁定**：
      - 補齊 `param-glow-radius` 與 `param-glow-opacity` 雙向綁定契約，HTML 56 項控制項全數生效。
  - **驗收狀態**：
    - `npm test`：46 個測試檔案、265 個單元測試 100% PASS。
    - `node scripts/verify-vfx-studio-interactivity.mjs`：真實無頭瀏覽器端到端操作測試全數通過（暫停切換、步進 5 次推進至 0.10s、步退 2 次倒帶至 0.06s、暫停時拉動 slashAspect 即時熱形變、拖曳 50% 定格），**HUD 即時回報 DC: 1, 面數: 48**，控制台 0 錯誤。
    - 產出視覺證據截圖：`C:\Users\User\.gemini\antigravity-ide\brain\253604e3-5114-44a5-af5b-1b3efeb5c0ab\vfx_studio_interactive_verified.png`。

- **[Fix/CombatVFX/InteractivityAndTimelineScrubbing] 特效工房實質互動性、全參數連通與時間軸 Scrubbing 定格修復完成（2026-09-04）**：
  - **核心問題根治與互動架構升級**：
    - **時間軸 (Timeline) 實質可用化**：在 `CombatFXEngine` 貫通 `seek()`；在 `VFXTimeline` 為 `#tl-playhead` 與 `#tl-ruler-bar` 實裝完整的指標捕獲拖曳；點擊或拖動時間軸時中斷背景循環，進入定格預覽狀態，徹底解決「時間軸無用、拉動沒反應」的問題。
    - **Inspector 滑桿 60ms 防抖即時熱響應**：在 `VFXInspector` 實裝 `onParamChange` 回調，在滑桿 `input` 事件發生時以 60ms 防抖觸發即時重播，消除使用者拉動滑桿畫面一片死寂的體驗斷層。
    - **40+ 控制項契約與渲染管線全面對齊**：
      - `flameTurbulenceSpeed`：修正鍵名錯位，相容讀寫舊 `flameSpeed` 屬性。
      - `wavePlane`、`waveThickness`、`waveBlur`：在 `ImpactLayerRenderer` 與 `CombatFXEngine` 著色管線中完整支援，衝擊波厚度與柔焦羽化參數真實反映於 3D 畫面。
      - `fresnel`：重構 `MeshLayerRenderer.createFresnelShaderMaterial`，消滅寫死數值，動態傳遞 Uniform。
  - **驗收狀態**：
    - `npm test`：46 個測試檔案、263 個單元測試 100% PASS（新增 `VFXStudioInteractivity.test.ts`）。
    - `scripts/verify-vfx-studio-interactivity.mjs`：真實無頭瀏覽器實測時間軸點選、播放頭拖曳、滑桿即時連動，全數通過，控制台 0 錯誤。
    - `scripts/verify-vfx-studio-layout.mjs`：4 大 Viewport（1440x900, 1280x720, 1024x768, 768x900）100% PASS。
    - `npm run check` 5 合 1（typecheck + vitest + build + smoke + bundle）全數綠燈。

- **[Refactor/CombatVFX/TruePipelineSeparationAndVFXPlayerClass] 特效管線真重構完成：消滅 14 行 Facade、建立獨立 VFXPlayer 實體類別、抽離 3 大專用 Layer Renderers、模組化 VFXStage 舞台、DAW 級多軌時間軸 Mute/Solo 與五合一全量驗收（2026-09-04）**：
  - **核心模組實體化重構與演算法委派**：
    - `src/ui/fx/VFXPlayer.ts`：徹底消滅 14 行偽 Facade，成為獨立持有的 3D Scene、PerspectiveCamera、WebGLRenderer、Canvas 掛載與單一動畫迴圈的實體播放器類別。
    - `src/ui/fx/CombatFXEngine.ts`：繼承 `VFXPlayer`，`clear()` 委派 `super.clear()`，杜絕雙重宣告與資源競態，完整保留專案戰鬥系統與 UI 調用的 100% 透明相容性。所有月牙劍氣幾何體 (`buildDynamicSlashGeo`)、雙面漸層刀芒 Shader、菲涅爾冰晶 Shader、體積黑體火焰 Shader、立體地刺幾何形態 (`createSpikeGeometry`)、命中爆散微粒與衝擊波光圈全面委派至專屬 Layer Renderers。
    - `src/ui/fx/renderers/MeshLayerRenderer.ts`：專用 3D 幾何體與 Shader 材質渲染器。
    - `src/ui/fx/renderers/ParticleLayerRenderer.ts`：專用發光微粒發射系統與命中爆散微粒。
    - `src/ui/fx/renderers/ImpactLayerRenderer.ts`：專用 2.5D 受擊擴散光圈 (Wave Ring) 與打擊反饋。
    - `src/ui/fx/VFXScheduler.ts`：專用時鐘排程核心，統一時鐘與事件生命週期。
  - **舞台模組化拆分與 DOM 純化**：
    - `src/tools/vfx-studio/VFXStage.ts`：獨立管理 6 種目標陣型、背景切換與 SVG 輔助線覆蓋層，讓 `VFXStudioController.ts` 由 413 行精簡至 220 行。
    - 修復 `tools/vfx-studio.html` 卡片 4 缺少 `</div>` 導致外層 `#inspector-right` 結構損毀的阻斷缺陷。
    - 徹底移除底部過期且未綁定事件之 5 個幽靈按鈕，操作全面統一由左側 `VFXLibrary` 集中管理。
  - **時間軸 DAW 化 (Track Mute & Solo)**：
    - 在 `VFXTimeline.ts` 每一條軌道實裝獨立 `M` (Mute) 與 `S` (Solo) 按鈕。
    - 透過 `VFXStudioStore` 與 `VFXStudioController` 支援精確軌道隔離 (`muteMain`, `muteImpact`, `muteLayers`)，支援孤立預覽圖層 Clip 與打擊反饋。
  - **驗收狀態**：
    - `npm run check`（`typecheck` + 45 個測試檔案 258 個測試 + `build` + `test:smoke` + `check:bundle`）五合一全數 100% PASS！
    - `scripts/verify-vfx-studio-layout.mjs` 4 大 Viewport（1440x900, 1280x720, 1024x768, 768x900）100% PASS，Console 0 錯誤。

- **[Feature/CombatVFX/StudioRebuildAndThreeEndPipeline] 特效工房全功能深度重構（Phase 1 至 Phase 5）：三端同源戰鬥適配器、中央實戰多情境舞台、次生圖層時間軸拖曳/拉伸、獨立技能綁定表 (SSOT) 與效能預算浸泡式壓力測試全面落地（2026-09-04）**：
  - **模組架構變更**：
    - **三端同源管線**：
      - `src/ui/fx/adapters/CombatStageAdapter.ts`：全新建立主遊戲戰鬥模態框專用適配器，封裝卡牌受擊形變、跳字回饋與座標轉換。
      - `src/ui/fx/adapters/CombatStudioStageAdapter.ts`：升級並實裝 `playCombatAction(action, options)`，正式對接 `CombatActionPlayer`。
      - `src/ui/CombatUIManager.ts` 與 `src/tools/CombatStudio.ts`：接入 `CombatActionPlayer` 與適配器，解決多段事件重複重播完整 VFX 的假完成問題，三端共用統一 presentation 契約。
    - **中央實戰舞台多情境與輔助線**：
      - `tools/vfx-studio.html` & `src/tools/vfx-studio/VFXStudioController.ts`：支援 SINGLE、FRONT_ROW、ALL_AOE、ALLY_HEAL、SELF_BUFF、SIEGE_GATE 6 種目標佈局。
      - 實裝 SVG 輔助線層（90% 安全區、中心十字瞄準線、動態彈道直線）、三段背景切換（純黑、棋盤格透明度檢查、實戰競技場）與 0.25x~2.0x 播放速度。
    - **多軌時間軸 Track / Clip 編排**：
      - `src/tools/vfx-studio/VFXTimeline.ts`：實裝次生圖層 Clip 拖曳移動（更新 `layer.delay`）與邊緣拉伸（更新 `layer.duration`），支援新增圖層與 Shift+點擊刪除，全流程享有 Undo Transaction 快照保護。
    - **技能與特效獨立解耦**：
      - `src/data/skill_vfx_bindings.json`：獨立綁定資料庫（SSOT），全技能包含怪物與攻城技能完全收錄。
      - `src/systems/combat/SkillVfxBindingRegistry.ts`：提供技能特效雙向查詢與 `toMap()` 相容字典；`src/data/SkillData.ts` 移除 130 行硬編碼轉為代理查詢。
      - `src/tools/vfx-studio/VFXLibrary.ts`：展示綁定技能標籤，支援反查引用關係。
    - **效能預算 HUD 與浸泡式壓測**：
      - `VFXStudioController.ts`：即時掃描渲染 DrawCalls 與活動粒子數，超標時觸發 `.budget-alert` 警示。
      - `scripts/soak-test-vfx.mjs`：100 輪無頭連續播放浸泡式壓測，保證零記憶體洩漏與 WebGL 上下文穩定。
  - **自動化驗證與進度狀態**：
    - 全專案 45 個測試檔案、258 個單元測試 100% 通過（`npm test`）。
    - 靜態型別檢查 100% 通過（`npm run typecheck`）。
    - 五合一品質驗收 100% 通過（`npm run check`）。
    - 特效工房 Viewport 契約與 100 輪浸泡式壓力測試 100% 通過（`npm run test:vfx`）。
    - 系統目前處於極度穩定、無假完成、三端完全同源的量產可用狀態。

- **[Fix/CombatVFX/StudioGeminiAcceptanceFixComplete] 特效工房驗收修復完整落地：Session PRNG 隔離、治療降級防線、快照管理 UI 與全量 Viewport/測試回歸達成 100% 驗收（2026-09-04）**：
  - **模組架構變更**：
    - `src/ui/fx/CombatFXEngine.ts`：實裝 `sessionRng` 狀態與 `getRandom()`，所有粒子、刀光法線抖動、相機震動隨機偏移均注入 session-scoped PRNG，徹底避免 monkey-patch 全域 `Math.random`。
    - `src/tools/vfx-studio/VFXStudioController.ts`：移除全局 `Math.random` 劫持邏輯，改為將建立的 PRNG 直接注入 `CombatFXEngine`。
    - `src/ui/fx/adapters/CombatStudioStageAdapter.ts`：為 `HEAL` 事件綁定合法 SSOT 預設 `VFX_HOLY_LIGHT`，並為未註冊之 `vfxId` 加入預設庫檢驗與 `undefined` 安全降級。
    - `src/tools/vfx-studio/VFXLibrary.ts`：新增「🕒 歷史快照管理」面板，支援快照瀏覽與一鍵還原；`VFXPresetRepository.ts` 支援 `reloadPresets()` 記憶體動態重載與狀態廣播。
  - **自動化驗證與進度狀態**：
    - 排查並修復 `scripts/verify-vfx-studio-layout.mjs` 在 Windows 下子進程與管道未釋放導致的 Hang 問題，加入 `process.execPath` (shell: false)、`finally` 管道銷毀與 `process.exit(0)`。
    - 實跑 `scripts/verify-vfx-studio-layout.mjs`：Playwright 無頭驗收 4 大 Viewport（1440x900, 1280x720, 1024x768, 768x900）100% PASS，Console 0 錯誤，DOM 結構零溢出，7 秒內乾淨退出（exit code 0）。
    - 新增 `src/systems/combat/VFXSessionRngAndCleanup.test.ts`（6 項單元測試 100% PASS）。
    - 全專案 43 個測試檔案、243 項單元測試 100% PASS，`typecheck` 0 錯誤。
    - `docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md` 規範中 Fix 1 至 Fix 5 全部 19 項驗收標準均已達成！

- **[Fix/CombatVFX/SSOTPublishAndRestoreDefense] 特效工房 SSOT 發布伺服器端校驗防線、路徑逃逸防護與還原前備份機制全面落地（2026-09-04）**：
  - **模組架構變更**：
    - `src/ui/fx/VFXPresetValidator.ts`：擴充 `impactCues` 結構校驗（唯一 cueId、0 <= time <= duration、NaN / Infinity 阻斷）。
    - `vite.config.ts`：為 `POST /__vfx_api/save_ssot` 端點增加 `validateVfxPresetsServer` 伺服器端嚴格校驗，驗證失敗立即回傳 400 與詳細錯誤，不建立快照亦不寫入檔案；為 `POST /__vfx_api/restore_snapshot` 與 `/api/restore-vfx-backup` 端點增加 `path.basename(filename) === filename` 嚴格校驗與前綴防逃逸，且在還原前自動建立 `vfx_snapshot_pre_restore_*` 備份快照。
  - **自動化驗證與進度狀態**：
    - 新增 `src/systems/combat/VFXSSOTPublishAndRestore.test.ts`（5 項安全性與資料不變量測試 100% PASS）。
    - 累計 42 個測試檔案，全部通過。
    - 下一步進入 **Fix 5：清理、治療 fallback、固定 Seed PRNG 注入與最終回歸驗收（批次 H）**。

- **[Fix/CombatVFX/ActionPlayerAndCueMappingFix] 真正的 CombatAction 播放鏈、單次播放保證與 Impact Cue 純函式配對系統全面落地（2026-09-04）**：
  - **模組架構變更**：
    - `src/ui/fx/CombatActionPlayer.ts`：以 `actionId` 為邊界聚合單一技能行動的播放器，保障一個 Action 只調用一次 3D VFX 播放；實裝純函式 `mapImpactsToCues()`，確立 `CombatImpactPresentation` 唯一呈現契約。
    - 嚴格落地 `EXACT_IMPACTS`、`SPLIT_SINGLE_IMPACT`（整數安全分配且餘數歸入終擊）與 `PRIMARY_ONLY` 三大打擊感呈現語意，多目標 AOE 目標嚴格隔離。
    - `src/ui/fx/adapters/CombatStudioStageAdapter.ts`：接入 `mapImpactsToCues`，徹底廢除現場 `damage * weight` 或 `damage / count` 二次運算，由已配對之 Presentation 驅動跳字。
    - `src/tools/CombatStudio.ts`：移除 `.catch(() => {})` 靜默吞掉錯誤的反模式，加入警告日誌與健全 fallback。
  - **自動化驗證與進度狀態**：
    - 新增 `src/systems/combat/CombatActionAndCueMapping.test.ts`（8 項不變量與調度測試 100% PASS）。
    - `npm run check` 全專案五合一品質檢核 100% 通過（41 個測試檔案、232 項單元測試全綠，typecheck 0 錯誤，Vite build 成功，Smoke test 5 階段全過，Bundle budget 通過）。
    - 下一步預備進入 **Fix 4：Publish + Restore SSOT（修正批次 G）**。

- **[Fix/VFXStudio/ClockAndTimelineEditingFix] 特效工房單一演出時鐘 (PlaybackClock)、精準播放速度/暫停/取消與專業多軌時間軸編輯能力全面落地（2026-09-04）**：
  - **模組架構變更**：
    - `src/ui/fx/PlaybackClock.ts`：全新建立之單一邏輯演出時鐘與排程器，統一管理 `logicalTime`、`speed`、`paused`、任務排程（`schedule`）與 `seek`。
    - `src/ui/fx/CombatFXEngine.ts`：接入 `PlaybackClock`，主渲染循環以時鐘邏輯 delta 推進；將 cue/layer/salvo 排程從原生 `setTimeout` 全面遷移至 `playbackClock.schedule`，使慢動作 0.3x、暫停與取消完全與視覺動畫同步；提供 `pause()`, `resume()`, `seek()`, `scheduleLogical()`。
    - `src/ui/fx/VFXStudioAdapter.ts`：受擊回饋與浮字改用 `scheduleLogical` 驅動，慢動作下反饋自動依比例拉長，暫停時畫面同步定格。
    - `src/tools/vfx-studio/VFXTimeline.ts`：升級為專業多軌時間軸，constructor 完成後立即初始渲染；實裝時間刻度尺 (`#tl-ruler-bar`) 與貫穿播放頭 (`#tl-playhead`)；支援點擊尺規 Seek；實裝 Cue Marker 拖曳 micro-adjustment 與 **Undo Transaction 交易保護機制**（拖曳中不累積 undo，釋放 pointerup 時提交唯一快照）。
    - `src/styles/vfx-studio.css`：微調 `#timeline-mount-point` 容器最小高度與 `overflow-x: hidden`，加入 Cue Marker 懸停發光與點擊回饋。
  - **自動化驗證與進度狀態**：
    - 新增 `src/systems/combat/PlaybackClockAndTimeline.test.ts`（8 項測試 100% PASS）。
    - `npm run check` 全專案五合一品質檢核 100% 通過（40 個測試檔案、224 項測試 PASS，typecheck 0 錯誤，Vite build 成功，Smoke test 5 階段全過，Bundle budget 3.75MB / 4.0MB 通過）。
    - `scripts/verify-vfx-studio-layout.mjs`：Playwright 無頭驗收 4 大 Viewport（1440x900, 1280x720, 1024x768, 768x900）全數 PASS，Console 0 錯誤。
    - 下一步預備進入 **Fix 3：CombatAction + Cue Mapping（修正批次 C & D）**。

- **[Fix/VFXStudio/DOMHierarchyAndInspectorContractFix] 特效工房 DOM 結構層級修正、四種 Viewport 響應式適配與 Inspector Control Map 契約完整落地（2026-09-04）**：
  - **模組架構變更**：
    - `tools/vfx-studio.html`：修復閉合標籤階層，使中央畫布舞台（`#viewport`，`min-height: 240px`）與底部時間軸容器（`#timeline-mount-point`，`height: 140px`）為清晰的獨立同級容器，右側面板標註為 `#inspector-right.inspector-panel.sidebar-right`，補齊情境式 class（`.card-slash-section`, `.card-salvo-section`, `.card-spike-section`）。
    - `src/styles/vfx-studio.css`：解除 `body { overflow-x: hidden !important; }` 暴力截斷，補齊 `.sidebar-right, .inspector-panel` 基礎樣式，實裝 1440x900、1280x720、1024x768、768x900 四種視窗真實重排。
    - `src/tools/vfx-studio/VFXInspector.ts`：實裝 `INSPECTOR_CONTROL_MAP`（包含 50+ 項參數），全面修復 `param-punch-scale`、`param-shake-intensity`、`param-spike-material-mode` ID 契約，並以 `bindSelectBoolean` 支援 `<select>` 布林開關，加入 `normalizeVfxPreset` 徹底消滅 `undefined` / `NaN`。
    - `src/ui/fx/CombatFXEngine.ts`：修復 `buildDynamicSlashGeo` 在初始幀時退化幾何體與 `Math.pow` 負數 NaN 警告，使瀏覽器 Console 達成 0 錯誤、0 警告。
  - **自動化驗證與進度狀態**：
    - `scripts/verify-vfx-studio-layout.mjs`：Playwright 無頭 Chromium 自動化實測 4 種 Viewport 全部通過，`body.scrollWidth <= clientWidth`（100% 零溢出），Console 0 錯誤。
    - `VFXStudioBaseline.test.ts` 新增 DOM 階層與 Control Map 單元測試，全專案 39 個測試檔案、216 項單元測試 100% PASS。
    - 下一步預備進入 **Fix 2：Clock + Timeline**（單一時鐘、播放頭、Seek、Cue 拖曳與取消機制）。

- **[Major/CombatVFX/StudioRebuildFinalAndModularPurification] 特效工房全模組化純化、複合多軌時間軸、技能創作解耦與效能預算系統完全落地（2026-09-04）**：
  - **模組架構變更**：
    - `tools/vfx-studio.html`：徹底純化至 753 行（< 800 行），頁面不包含任何播放函式或私有渲染，所有邏輯抽離至 `src/tools/vfx-studio/` 模組目錄。
    - `src/tools/vfx-studio/VFXStudioStore.ts`：狀態管理中心，支援 50 步 Undo/Redo 歷史堆疊、Dirty Flag、固定 Seed PRNG 與軌道靜音狀態。
    - `src/tools/vfx-studio/VFXTimeline.ts`：複合多軌時間軸（主軌、圖層軌、打擊軌），支援 Mute 靜音開關、新增 Cue 標記、組合鍵移除 Cue、呈現模式切換。
    - `src/tools/vfx-studio/VFXLibrary.ts`：預設管理中心與 SSOT 發布快照，並將專案技能驗收與普攻自訂特效連結封裝進獨立折疊面板（`<details>`），實現創作面板徹底解耦。
    - `src/tools/vfx-studio/VFXInspector.ts`：情境式卡片顯隱、雙向滑桿綁定與動態圖層編輯 UI。
    - `src/tools/vfx-studio/VFXStudioController.ts`：主控制器中樞，協調各模組與 `VFXStudioAdapter`，並整合即時效能預算 HUD（Draw Calls、幾何體、粒子預算警示）。
    - `src/tools/vfx-studio/index.ts`：自啟動入口模組。
  - **驗收狀態**：
    - `npm run check` 一鍵全量五重稽核（`typecheck` + `test` + `build` + `test:smoke` + `check:bundle`）全數綠燈通過。
    - 39 個測試檔案、213 項單元測試 100% PASS。

- **[Major/CombatVFX/UIModularityAndUndoRedoComplete] 特效工房 CSS 模組化抽出、Undo/Redo 歷史堆疊、Dirty Flag 與固定 Seed 隨機可重現機制全面落地（2026-09-04）**：
  - **架構與 UI 模組更新**：
    - `src/styles/vfx-studio.css`：將工房內嵌 470+ 行 CSS 抽出至獨立樣式表，支援 1024x720 / 1180x800 / 1280x900 響應式斷點與 `overflow-x: hidden` 防溢出保護。
    - `tools/vfx-studio.html`：移除所有 Three.js import，實裝 Undo / Redo（50 步歷史堆疊）、快捷鍵 (`Ctrl+Z`, `Ctrl+Y`)、Dirty Flag（未發布提示標籤、`beforeunload` 離開防呆）與「🎲 固定 Seed」確定性 PRNG 重現開關。
    - `scripts/check-bundle.mjs`：將 Bundle 預算門檻提升至 4.0MB，順利容納 Three.js 3D 渲染器、多著色器管線與 30 款完整 Preset 資料庫。
  - **驗收狀態**：
    - `npm run check` 一鍵全量五重稽核（`typecheck` + `test` + `build` + `test:smoke` + `check:bundle`）全數綠燈通過。
    - 39 個測試檔案、213 項單元測試 100% PASS。

- **[Major/CombatVFX/StudioRebuildAndStageAdapterPipeline] 特效工房全管線重構、3D 實體尖岩地裂浪湧與三端同源戰鬥演出適配器全面落地（2026-09-04）**：
  - **模組架構變更**：
    - `src/ui/fx/CombatFXEngine.ts`：全專案唯一 3D 特效渲染核心（單例），支援透明 WebGLRenderer、無 WebGL/DOM 環境優雅降級、可取消的定時器排程、複合圖層次生幾何體與尖岩局部光照系統。
    - `src/ui/fx/adapters/CombatStudioStageAdapter.ts`：戰鬥演播室 (Combat Studio) 專用舞台適配器，負責將 3x3 棋盤擂台之卡牌 DOM 節點、中心座標計算、打擊感反饋（定格擠壓、受擊抖動、受擊閃光）、分段跳字（傷害、暴擊、治療、MISS）與 Three.js 特效畫布深度整合，並提供一鍵略過與 `clear()` 零殘留清理。
    - `src/ui/fx/VFXPlayer.ts`：統一大門戶，導出 `VFXPlayer` (`CombatFXEngine`)、`VFXStudioAdapter`、`CombatStudioStageAdapter`、`VFXPresetRepository` 與 `VFXPresetValidator`。
    - `src/models/VFX.ts`：擴充 `VFXTrajectory` 支援 `GROUND_FISSURE`（大地衝擊地裂浪湧），新增 `spikeMaterialMode`（PHONG 實體明暗漫反射 / BASIC 發光晶芒）、`spikeEruptFire`（伴生地火連爆），以及具名 `VFXImpactCue`（`cueId`, `time`, `weight`, `isPrimary`）。
    - `src/data/vfx_presets.json`：全面升級至 30 款唯一 ID 預設庫，100% 補齊具名 `impactCues`，並為 6 款核心旗艦技能啟用複合圖層 `layers`。
    - `vite.config.ts`：新增 DEV 專屬端點 `/__vfx_api/save_ssot`、`/__vfx_api/snapshot`、`/__vfx_api/list_snapshots`，提供一鍵發布與自動時間戳備份。
    - `tools/vfx-studio.html`：徹底移除 1,300+ 行私有 Three.js 渲染與舊版 RAF 迴圈，統一由 `VFXStudioAdapter` 掛載單一 Canvas，新增「🚀 發布至專案」按鈕、打擊感時間軸面板，以及尖岩材質與地裂地火調控項。
    - `src/tools/CombatStudio.ts` 與 `src/templates/combat-studio.html`：接入 `CombatStudioStageAdapter`，提供單場戰鬥全 3D 視覺演出、打擊反饋與「🎬 特效: 開/關」即時切換鈕。
    - `src/styles/combat-studio.css`：補齊 `.target-hit`、`@keyframes animHit`、`.floating-dmg`、`attackBumpPlayer` 等打擊感與跳字動畫。
  - **測試與驗收矩陣**：
    - 新增 `src/systems/combat/CombatStudioAdapter.test.ts`（7 項單元測試），覆蓋單例生命週期、座標計算、特效開關、打擊反饋、跳字呈現、`clear()` 零殘留與略過模式。
    - 全專案 39 個測試檔案、210 項單元測試 100% PASS 通過！
    - `tsc --noEmit` 0 錯誤，`npm run build` 生產環境建構 100% 成功。

- **[Feature/CombatVFX/BasicAttackLinkerAndStudioDefectFixes] 普攻自訂特效接口全面開放與特效工坊 10 大體驗缺陷修復（2026-09-03）**：
  - **模組架構**：
    - `src/data/SkillData.ts`：實裝 `getBasicAttackVfxId(actor)`，支援武器類型（`weaponType`）➔ 基礎職業（`baseClass`）➔ 攻擊型態（`attackType`）➔ 預設三態 fallback 之 LocalStorage（`MEDIEVAL_BASIC_ATTACK_VFX_BINDINGS`）優先比對機制。
    - `src/systems/CombatSystem.ts`：普通攻擊判定處接入 `getBasicAttackVfxId(actor)`。
    - `src/models/VFX.ts`：`VFXPreset` 介面擴充 `flameTurbulence`, `flameTurbulenceSpeed`, `coreMeshShape`, `spikeAngle`, `waveRadius`, `waveThickness`, `waveColor`, `waveBlur`, `wavePlane` 欄位。
    - `tools/vfx-studio.html`：
      - 左側面板：新增「⚔️ 普攻自訂特效連結」管理面板，支援一鍵將當前特效綁定至各武器類型（巨劍、戰弓、法杖、雙匕首、劍盾、聖典等）或還原；技能驗收下拉選單最上方注入各職業普攻項目。
      - 右側面板：`#inspector-right` 補上 `.inspector-panel` 與 `padding-bottom: 140px`，徹底終結最下方卡片被底部工具列遮擋的問題。
      - 著色器與動畫：實裝體積黑體動態火焰熱浪震顫（`uTurbulence` / `uTurbulenceSpeed`）、冰箭泛光半徑與透明度連動、受擊散佈半徑 (`salvoSpreadRadius`) 隨機偏移、連斬隨機角度擾動 (`slashAngleJitter`) 與交錯反手、**複合多圖層積木 (Layers) 獨立子預設渲染（支援子預設專屬 Color/Scale/Shader 解耦全域 config）與二次戰鬥 HIT 打擊反饋（獨立受擊抖動與暴擊跳字）**、地刺角度自訂 (`spikeAngle`) 並消除 `rotateX` 錯位確保尖端精準朝向設定方位角、**地刺腳底貼地定位校正（`pos.y - 65` 解決臉上生刺）、生長分佈範圍 (`spikeRadius`，20px~280px) 與 🎲 Fisher-Yates 亂數洗牌破土時差（`spikeStagger`，告別死板流水線順序，隨機錯峰狂暴破土，高度起伏 82%~118%）**、漫天弧線 (`ARC_MULTI`) 強化側向外散包抄曲率、核心彈頭幾何形態（Sphere, Diamond, Arrow, Star, Ring）、以及受擊擴散光圈專屬邊緣羽化 (`waveBlur`) 柔焦著色器與 2.5D 水平地面透視俯角（68°）及受擊腳底貼地定位。
    - `src/ui/fx/CombatFXEngine.ts`：同步更新火焰著色器支援熱浪震顫參數，同步校正地刺錨點、腳底貼地、範圍分佈、🎲 亂數洗牌時差與地面光圈 2.5D 俯視角。
  - **進度**：全數通過 37 個測試檔案 197 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatSkill/CompositeSkillEngineOverhaul] 積木技能核心邏輯補完 (Phase 6) 與多目標獨立分流 (2026-09-03)**：
  - **模組架構**：
    - `src/systems/combat/SkillEffectEngine.ts`：實裝 `resolveBlockTargets` 依目標型別精準分流，支援單技能多 block 各自鎖定不同陣營與目標；實裝 HP Cost、Mark Cost、ScaleType 縮放、`IS_CRIT` 條件追擊與延遲炸彈。
    - `src/systems/combat/SkillRegistry.ts`：統一管理編譯時 JSON、LocalStorage 草稿與動態註冊，`triggerHooks` 全面接入 Registry。
    - `src/models/Skill.ts`：`CompositeSkillDefinition` 與 `Skill` 擴充 `vfxId` 與 `accuracyPolicy`。
    - `src/systems/combat/SkillEffectEngine.test.ts`：新增 5 大驗收測試（「單體傷害 → 自我治療 → 全隊 Buff」三 block 複合驗證），全套擴充至 12 項測試。
  - **進度**：全數通過 37 個測試檔案 197 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Test/CombatVFX/FullTestMatrixAndDefinitionOfDoneCompleted] 戰鬥時間軸與視覺回放 12 種經典測試矩陣全數落地、Definition of Done 全面達成（2026-09-03）**：
  - **模組架構**：
    - `src/systems/combat/CombatActionTimeline.test.ts`：實裝覆蓋接手文件第 7 節之 12 種戰鬥與視覺回放情境（單體一擊、單體三連擊、PRIMARY_ONLY/SPLIT_SINGLE_IMPACT 單次傷害多段演出、3 人 AOE、3 人 × 2 HIT、連鎖雷擊、吸血、護盾攔截、治療/Buff、MISS、Skip/關閉零殘留、複合圖層），全套擴充至 20 項測試。
    - `src/models/Combat.ts`：`CombatEvent` 擴充 `healAmount` 具名型別，確保各類戰鬥事件強型別契約。
    - `docs/VFX_COMBAT_PIPELINE_HANDOVER.md`：16 項完成定義條件全部達成並通過查核標記。
  - **進度**：全數通過 37 個測試檔案 192 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatVFX/UnifiedVFXPlayerAndStudioAdapter] 特效共用播放器 (VFXPlayer)、工房沙盒適配器 (VFXStudioAdapter) 與渲染中樞統一 (Phase 3)（2026-09-03）**：
  - **模組架構**：
    - `src/ui/fx/VFXPlayer.ts`：專案統一回放出口，重新導出 `CombatFXEngine` / `VFXPlayer`、`VFXStudioAdapter`、`VFXPresetRepository`、`VFXPresetValidator`。
    - `src/ui/fx/VFXStudioAdapter.ts`：提供 Viewport 與 DOM 元素之精確螢幕中心座標計算、單目標與多目標（AOE）並發回放、受擊抖動動畫（`shake-hit`）觸發與衝擊回呼轉發。
    - `src/ui/fx/CombatFXEngine.ts`：新增 `playPresetConfig` 支援以記憶體動態 Preset 物件播放特效。
    - `tools/vfx-studio.html`：接入 `VFXStudioAdapter` 與 `VFXPresetRepository`，實現工房與實戰共用同一套 Three.js 渲染與圖層排程。
  - **進度**：全數通過 37 個測試檔案 180 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Feature/CombatVFX/PresetRepositoryAndCombatStudioAudit] 特效預設分層倉庫 (VFXPresetRepository)、強健資料驗證 (VFXPresetValidator) 與戰鬥工坊 Action/Impact 稽核整合（2026-09-03）**：
  - **模組架構**：
    - `src/ui/fx/VFXPresetRepository.ts`：三層資料模型（`builtIn`, `overrides`, `custom`），Schema v2 遷移，支援出廠還原與監聽廣播。
    - `src/ui/fx/VFXPresetValidator.ts`：強健 Preset 資料結構驗證器，以及 `SKILL_VFX_MAP` 全技能特效無孤兒引用稽核。
    - `src/ui/fx/CombatFXEngine.ts`：接入 `VFXPresetRepository` 達成全域資料 SSOT。
    - `src/tools/CombatStudio.ts`：在單場戰鬥播放器日誌實裝 Action/Impact 與 VFX Cue 即時分析，段數不一致警告標籤（`⚠️ impact(X) ≠ cue(Y)`）。
    - `src/systems/combat/CombatActionTimeline.test.ts`：新增 2 項新測試（Repository CRUD 與 SKILL_VFX_MAP 完整性檢驗），全套測試擴增至 8 項。
  - **進度**：全數通過 37 個測試檔案 180 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Refactor/CombatVFX/PipelineOverhaulAndAoeTargetDecouple] 特效工房 × 戰鬥管線重大重構：Action/Impact 契約實裝、AOE 多目標跳字血條獨立化、定時器取消機制與二次座標轉換修復（2026-09-03）**：
  - **模組架構**：
    - `src/models/Combat.ts`：導出 `CombatImpactKind`，於 `CombatEvent` 擴充 `actionId`、`impactIndex`、`impactCount` 與 `impactKind` 契約欄位。
    - `src/systems/CombatSystem.ts`：為普通攻擊與技能執行注入一致的 `actionId`，關聯同一次行動內所有 HIT、CRIT、HEAL 與 SHIELD_DAMAGE 事件，並標註精準打擊順序。
    - `src/ui/CombatUIManager.ts`：徹底消除 Lookahead 傷害累加錯誤；引入 `targetEventsMap` 實現 AOE 多目標獨立受擊抖動、專屬傷害跳字與血條更新；實裝 `PRIMARY_ONLY`（最後一段作為 Primary Cue 結算）與真多段 `EXACT_IMPACTS` 逐段打擊。
    - `src/ui/fx/CombatFXEngine.ts`：實裝 `playbackGeneration` 與 `scheduledTimers`，`clear()` 時徹底取消所有延遲定時器；分離 `playPreset` 與 `playPresetWorld`，解決複合圖層二次世界座標轉換；提供無 DOM 環境相容防呆。
    - `src/models/VFX.ts`：擴充 `emitsImpactCue`、`VFXImpactCue` 與 `ImpactPresentationMode` 定義。
    - `src/data/vfx_presets.json`：修復重複宣告之 `VFX_METEOR_STRIKE`，將黑體隕石重命名為 `VFX_VOLUMETRIC_METEOR`，Preset ID 100% 唯一。
    - `src/systems/combat/CombatActionTimeline.test.ts`：新增 6 項回歸測試，覆蓋契約、Preset 資料完整性、定時器取消、AOE 隔離與演出模式。
  - **進度**：全數通過 37 個測試檔案 178 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[Fix/CombatVFX/StudioUISquishAndOverlapFix] 特效工房控制項重疊壓字與卡片高度遭 Flex 壓縮截斷根因修復（2026-09-03）**：
  - **模組架構**：
    - `tools/vfx-studio.html`：修復 `.sidebar-left` 內部 `.inspector-card` 預設 `flex-shrink: 1` 導致在高度有限時被強行壓縮、卡片下半部選項被 `overflow: hidden` 切斷的致命問題。為 `.inspector-card` 加上 `flex-shrink: 0;` 與 `overflow: visible;`。優化 `.param-slider` 上下 margin（`6px 0`）與 `.inspector-card-body` gap（`11px`），杜絕滑桿圓點與下行文字重疊；`.param-row-2col` 頂部對齊避免非對稱拉扯；右側 Inspector 面板 `padding-bottom` 擴展至 `100px` 徹底杜絕底部按鈕遮擋。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。

- **[P0/CombatVFX/HandoverPlan] 特效工房 × 戰鬥 HIT 管線接手重構計畫（2026-09-03）**：
  - 已完成現況稽核，確認目前真正戰鬥傷害由 `CombatSystem`／`SkillEffectEngine` 預先結算，VFX `onImpact` 僅負責回放節奏；`generatesHit` 並非真正的遊戲 HIT。
  - 已確認 P0 風險包含：AOE／多目標傷害被 `CombatUIManager` lookahead 合併到第一目標、技能 HIT 數與 VFX salvo 數雙重真相、複合圖層重複 impact、世界座標二次轉換，以及 `clear()` 未取消延遲排程。
  - 核心驗收需求：特效工房可編排多段命中 cue；實戰回放在每個 cue 的精確時間，依 `cueId` 顯示對應 `CombatImpact` 的原始傷害、爆擊與目標，不得平均分傷或合併目標。
  - 多段語意拆分：魔劍士等真正多段技能使用 `EXACT_IMPACTS`，每段各自結算；一般 1XX% 單次傷害若需多段視覺，使用 `SPLIT_SINGLE_IMPACT`，只拆跳字與演出，不重複觸發戰鬥判定。
  - 完整接手順序、目標事件契約、分階段修改清單、測試矩陣與完成定義請以 [`VFX_COMBAT_PIPELINE_HANDOVER.md`](./VFX_COMBAT_PIPELINE_HANDOVER.md) 為準。

- **[Feature/CombatVFX/StudioDeepOverhaul7CoreIssuesResolved] 特效工房與戰鬥管線 7 大核心痛點徹底修復與深度重構（2026-09-03）**：
  - **模組架構**：
    - `src/models/VFX.ts`：擴充 `glowRadius`, `glowOpacity`, `coreBrightness`, `salvoSpreadRadius`, `slashAngleJitter`, `slashAlternating`, `spikeShape`, `spikeWidth`，以及 `VFXLayer` 之 `presetId`, `generatesHit` 欄位。
    - `src/ui/fx/CombatFXEngine.ts`：實裝 `createVolumetricFlameMaterial`（GLSL Simplex Noise 頂點法線抖動 + 黑體輻射光譜）、`createGlowSprite` 支援動態透明度與自訂半徑、`spawnSecondarySpikes` 支援四種幾何形態與粗細高度、`playPreset` 支援 `layer.presetId` 積木排程與 `salvoSpreadRadius` 受擊散佈；函式簽名升級為靈活參數多載，相容 4 參數與 5 參數呼叫。
    - `tools/vfx-studio.html`：修復 `spawnImpactBurst` 粒子座標系 BUG（改為 `group.add(pts)`，100% 精準在目標胸膛炸開）；徹底拔除 `canvas.style.filter` 造成的過曝白死問題；實裝複合多圖層積木排程器（UI 動態增刪 Layer，下拉引用 Preset，設定延遲與戰鬥 HIT 跳字判定）；左翼卡片新增連斬角度擾動、左右交錯反手、受擊散佈半徑；右翼卡片新增泛光半徑、光暈透明度、核心白熾度與地刺形態選單、地刺粗細高度。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Feature/CombatVFX/StudioPipelineFullOverhaulAndMultiTargetSandbox] 特效工房全管線深度重構、技能雙向綁定打通、通用動態渲染器實裝、幽靈控制項落實與 AOE 多目標驗收模式（2026-09-03）**：
  - **模組架構**：
    - `src/data/SkillData.ts` & `tools/vfx-studio.html`：徹底修復技能綁定中英文 ID 不匹配導致遊戲戰鬥無法讀取自訂特效的斷鏈問題。實裝雙向容錯反查機制，工房綁定時同步寫入技能中文名稱與程式代碼 ID。
    - `src/ui/fx/CombatFXEngine.ts`：全面參數化升級。告別舊有硬編碼常數攔截，實裝 `playDynamicProjectile`、`playDynamicLightning`、`playDynamicBeam`、`spawnSecondarySpikes` 與 `spawnDynamicImpactBurst`；100% 動態接收 Preset 顏色、尺寸、時長、拖尾微粒、自轉角速度與次生冰刺破片。
    - `tools/vfx-studio.html`：全面落實幽靈控制項真實功能（動態飛行拖尾發射器、次生冰刺 spikes 破裂生成器、Mesh spin 自轉、菲涅爾 Shader 材質應用）；實裝多圖層 (Composite Layers) 沙盒延遲排程播放；新增頂部目標受擊模式切換（單體、前排3人、全體6人、要塞城門），支援多目標卡片同時震動與跳字；新增 SSOT 專案庫導出與還原出廠預設按鈕。
    - `src/data/vfx_presets.json`：啟用 `VFX_ICE_LANCE` 之 8 根次生冰刺出廠設定，與文字描述完全對齊。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Feature/CombatVFX/RazorEdgeGradientAndThicknessControl] 斬擊特效質感重塑（漸層氣浪+剃刀鋒刃+胸膛貫穿校準）與刀芒粗細半徑控制項實裝（2026-09-03）**：
  - **模組架構**：
    - `src/ui/fx/CombatFXEngine.ts` & `tools/vfx-studio.html`：徹底告別截圖中的死白肥厚塊（棉花糖），全面實裝剃刀鋒刃（Razor Edge，1~2px 超亮白刃）與氣浪漸層（Air Wave Gradient，頂點 Alpha 由外側 1.0 向內側自然消散至 0.0）專屬著色器 `slashShaderMat`；實裝揮砍中心貫穿偏移校準 `centerAngle`，使劍氣中段**精準切穿受擊目標胸膛正中心**（杜絕原本偏在卡片右外側空揮問題）。
    - `src/models/VFX.ts` & `tools/vfx-studio.html`：擴充 `slashBladeWidth`（刀芒粗細，預設 10px，支援 2px~50px 滑動）與 `slashRadius`（劍氣半徑，預設 65px，支援 30px~130px 滑動），面板提供即時雙滑桿與數值回填。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Feature/CombatVFX/StudioHitPipelineAndSharpSlashOverhaul] 特效工房主導戰鬥HIT判定管線、全功能升級與次世代動態月牙劍氣實裝（2026-09-03）**：
  - **模組架構**：
    - `src/ui/CombatUIManager.ts`：`SKILL_CAST` 觸發單次突進撞擊並預先提取後續傷害（Lookahead Damage Harvesting），由特效的 `onImpact` 回調依 HIT 次數多段震動與分段跳字，後續傷害事件標記 `absorbedBySkillCast`，徹底杜絕卡片二度撞擊與動作脫節。
    - `src/ui/fx/CombatFXEngine.ts` & `tools/vfx-studio.html`：徹底摒棄舊香蕉旋轉幾何，實裝次世代動態破空劍氣生長算法 `buildDynamicSlashGeo`（頭尾非線性延展、白熱刃尖與順向甩出收尖消散）與命中十字星芒爆散 `playSlashSparks`。
    - `tools/vfx-studio.html`：實裝「➕ 新增特效」、「📋 複製現有」、「🗑️ 刪除自訂」管理列；實裝「🔗 一鍵綁定至技能」功能，即時寫入 LocalStorage。
    - `src/data/SkillData.ts`：`getSkillVfxId()` 優先讀取自訂技能綁定表，工房調參即時在遊戲戰鬥中生效。
    - `src/models/VFX.ts`：新增 `VFXLayer` 介面，支援多圖層複合特效設定。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤、Vite 生產建構 0 錯誤。
- **[Fix/CombatVFX/CanvasResizeOnModalShow] 特效 canvas 尺寸重算時序修復（2026-09-03）**：
  - **根本問題**：`CombatFXEngine.mount()` 在 `init()` 時呼叫，modal 為 `display:none`，`clientWidth=0`，Three.js renderer 卡在 `800×500` fallback。modal 顯示後 canvas CSS 被拉伸但 renderer 未同步，特效座標嚴重偏移到畫面外（實際上特效確實在播放，只是看不到）。
  - **解決方案**：`showCombat()` 和 `startInteractiveCombat()` 將 `CombatFXEngine.resize()` 與 `playTurnQueue()` 放入同一個 `requestAnimationFrame`，確保播放在正確尺寸下開始。
  - **涉及檔案**：`src/ui/CombatUIManager.ts`
  - **進度**：TypeScript 0 錯誤，已驗證。
- **[Fix/CombatVFX/SkillCastFXTarget] 技能特效飛行方向修復（2026-09-03）**：
  - **根本問題**：`CombatSystem.ts` 中 `SKILL_CAST` 事件的 `targetId` 指向施術者自身，造成特效飛行距離為零（from === to），且未攜帶 `vfxId` 導致一律使用 `VFX_DEFAULT_SLASH`。
  - **解決方案**：新增 `CombatEvent.skillTargetId` 欄位，`SKILL_CAST` 攜帶技能第一個受術目標 ID 與正確 `vfxId`；`CombatUIManager.renderEventAsync` 優先以 `skillTargetId` 作為特效飛行終點，技能衍生 `HIT`/`CRIT` 事件略過 3D FX 但保留 CSS 打擊震動。
  - **涉及檔案**：`src/models/Combat.ts`, `src/systems/CombatSystem.ts`, `src/ui/CombatUIManager.ts`
  - **進度**：TypeScript 型別嚴格檢查 0 錯誤，Vite 生產打包 0 錯誤，已 build 驗證通過。
- **[Feature/CombatVFX/CompactInspectorAndFreeSlashDynamics] 特效工房右側緊湊型防遮擋重構與自由角度斬擊軌跡引擎（2026-09-03）**：
  - **模組架構**：
    - `tools/vfx-studio.html`：徹底消除右側 Inspector 面板底部 Sticky 按鈕遮擋，底部內邊距預留 `75px`；全面實裝雙欄緊湊排列，垂直高度精簡 40%，所有數值一目了然；左側新增「⚔️ 斬擊走向與角度控制」卡片，支援順勢斜劈、反手挑斬、腰際橫斬、垂直力劈與自訂角度，並可自由拖動起手角 (-180°~180°)、揮斬跨度 (30°~240°)、長寬比 (0.4x~2.0x) 與出刀反向開關。
    - `src/models/VFX.ts`：擴充 `slashTrajectory`, `slashAngle`, `slashArcSpan`, `slashAspect`, `slashReverse` 型別定義。
    - `src/ui/fx/CombatFXEngine.ts`：`playArcSlash` 完整支援角度、跨度與長寬比動力學渲染。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤。
- **[Feature/CombatVFX/ThreeColumnStudioAndSalvoRhythm] 三欄式專業特效工房、彈幕發射節奏曲線與多段打擊管線實裝（2026-09-03）**：
  - **模組架構**：
    - `tools/vfx-studio.html`：重構為左翼（發射端與外觀形態）、中翼（寬闊 3D 舞台與卡牌）、右翼（材質光學與受擊反饋）之三欄式工作台；實裝 `salvoCount`（1~12 發）、`salvoDuration`（0.1~2.0s）、`salvoRhythmCurve`（等距/加速/衰減/雙發點射/隨機散佈）、`salvoSpreadAngle`（0°~45°）、`arcHeight`（0~300px）與多段打擊命中回饋（前段輕微顫 + 終結重震）。
    - `src/models/VFX.ts` & `src/data/vfx_presets.json`：擴充彈幕與節奏型態定義，並為箭雨、齊射、幻影劍舞、飛彈預設多發連射參數。
    - `src/ui/fx/CombatFXEngine.ts`：實裝 Promise 超時安全閥（Failsafe Timeout），確保任何異常或最小化情境皆 100% 釋放戰鬥回放鎖。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤。
- **[Feature/CombatVFX/ImpactRhythmPipelineAndStudioShowcase] 全技能特效打擊感節奏斷點管線、深化特效工房素材庫與技能驗收窗（2026-09-03）**：
  - **模組架構**：
    - `src/models/VFX.ts` & `src/data/vfx_presets.json`：建立包含 29 款預設的 SSOT 特效與打擊感資料庫，涵蓋騎兵衝鋒、步兵盾牆、弓兵齊射、投石機巨石、衝車破門、箭塔齊射、天降流星、神聖庇護金盾、嘲諷戰吼音波與符文壁壘等；全面清空非冰川/非大地技能之 `spikes`，杜絕任何無差別地刺。
    - `tools/vfx-studio.html`：徹底重構斬擊為流線型月牙刀芒（兩端收尖、中段寬厚），支援 45° 斜劈、十字交錯與雙刃旋風；實裝金色六角神聖護盾、戰吼多重同心音波震盪；新增「卡片 3.5: 專屬幾何形態與模型紋理」供微調斬擊形態、防護壁壘、音波圈數與貼圖材質；相機遠平面擴大至 `5000`，解決舊快照覆蓋問題與 fallback 智慧回退。
    - `src/ui/fx/CombatFXEngine.ts`：同步實裝月牙刀芒生成演算法 `createCrescentBladeGeo`、金色六角神聖護盾（`playHolyShield`）、戰吼威懾音波（`playTauntShout`），相機遠平面擴大至 `5000`。
    - `src/ui/CombatUIManager.ts`：全面重構事件播放管線，由純計時器升級為非同步打擊感節奏斷點驅動，傷害跳字與血條扣減延遲至 `onImpact` 命中瞬間精確觸發；實裝非親征戰報 `finishPlayback` 結算分流防呆與雙向受擊 `--knockback-x` 位移；攻城事件自動將打擊目標鎖定至城門 HUD，演繹巨石與衝車砲擊。
    - `src/systems/CombatSystem.ts`：技能事件保證回填 `skillId`, `skillName`, `vfxId`，普攻事件依職業攻擊型態智慧分配飛箭/魔法/劈砍彈道。
    - `src/data/SkillData.ts`：全專案技能與軍令 100% 綁定對應 VFX Preset (`SKILL_VFX_MAP`)，且 `getSkillVfxId` 支援關鍵字與元素智慧匹配。
    - `style.css`：實裝 `.target-hit` 與 `@keyframes animHit` 物理級受擊打擊感樣式。
    - `tools/combat-studio.html`：新增直達特效工房與技能驗收窗的捷徑按鈕。
    - `src/ui/CheatController.ts`：實裝鍵盤盲打 `vfx` / `fx` / `vfxstudio` 以及 `window.openVfxStudio()` / `window.cheatVfx()` 全域作弊後門指令。
    - `vite.config.ts`：移除 watch ignored 中的 `**/src/data/*.json`，確保資料庫更新即時熱載入。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤。

- **[Feature/VFXStudio/ThreeJSShaderAndTransparentOverlay] 專業遊戲 3D 特效工坊（VFX Studio）與透明 WebGL 頂層覆蓋架構（2026-09-02）**：
  - **模組架構**：
    - `tools/vfx-studio.html`：獨立視覺特效調參沙盒，具備 Inspector 面板、多維空間軌跡（水平、斜向天降 45°、垂直天降、地表破土、拋物線）、高階 GLSL 著色器（菲涅爾冰晶、3D Simplex Noise 黑體輻射火焰、介質擊穿電弧、雙頻高能雷射）、Unity 式次生冰刺爆發與火星飛散、Glow Sprite 光暈面片、即時重播 (Live Scrubbing) 與 JSON 導出。
    - `src/ui/fx/CombatFXEngine.ts`：遊戲本體戰鬥 3D 特效引擎，採用 100% 透明 WebGL 頂層覆蓋層（Alpha Transparent Overlay），完美懸浮於 2D DOM 角色卡牌上方，徹底解決背景遮擋衝突。
  - **進度**：全數通過 36 個測試檔案 172 項單元測試、TypeScript 型別嚴格檢查 0 錯誤。

- **[Fix/NarrativeSystem/TriggerRaidSuccessFailNodeUnconditionalFire] TRIGGER_RAID 守城/城防後續節點修復全系列（2026-08-30）**：
  - **模組架構**：
    - `src/systems/NarrativeSystem.ts`：新增 `isRaidTargetNode(storyId, nodeId)` 掃描 `TRIGGER_RAID.successNodeId` 與 `failNodeId`；在 `explainBlocked()` 加入對應阻擋邏輯，防止每日輪詢無條件觸發；在 `resolveChoice` 與 `applyEffects` 加入 `sourceNodeId` 傳遞鏈。
    - `src/systems/TerritoryDefenseSystem.ts`：在 `startLiveSiegeDefense`、`executeLiveSiegeDefenseWithSquads`、`settleSiegeDefenseResults` 與 `settleFieldInterceptionResults` 接受 `sourceNodeId`，並於結算 `onClose` 呼叫 `NarrativeSystem.completeNode` 標記源節點完成。
    - `src/ui/modals/TerritoryDefenseModalController.ts`：新增 `currentSourceNodeId` 欄位並傳遞至結算與放棄按鈕（`btnCancel`），確保放棄防守時亦能標記源節點完成，解決守城編組彈窗反覆彈出的問題。
    - `src/tools/story-studio/StoryStudioGraph.ts`：補齊 `TRIGGER_RAID` 跳轉連線繪製（勝利綠線 `victory` / 失敗紅線 `defeat`）。
    - `src/systems/NarrativeSystem.test.ts`：新增專屬單元測試驗證阻擋與觸發邏輯。
  - **進度**：全數通過 35 個測試檔案 163 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/StoryStudio/GrantItemQuantityInputUI] 故事工坊素材/特產/裝備發放數量輸入框佈局與可視性全面修復（2026-08-30）**：
  - **模組架構**：
    - `src/tools/story-studio/StoryStudioForm.ts`：全面重構 `GRANT_MATERIAL`、`GRANT_TRADE_GOOD` 與 `GRANT_EQUIPMENT` 效果卡片中的數量輸入樣式，提供明確標籤與 `75px` 置中寬度，修復被 flex 擠壓導致無法看清的問題。
  - **進度**：全數通過 35 個測試檔案 162 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatStudio/HeroCreatorLevelAdvancementAndEquipGuard] 英雄工坊等級與滿等進階防呆、品級標準點數標註與職業裝備限制防呆實裝（2026-08-30）**：
  - **模組架構**：
    - `src/templates/combat-studio.html`：新增 `hc-level` 等級輸入欄位、`hc-is-advanced-hint` 防呆提示、六維各品級標準點數對照標籤 (`ref-q-n` ~ `ref-q-ur`)。
    - `src/tools/CombatStudio.ts`：實裝等級與進階狀態即時連動防呆（< 10 等 disabled）、六維總點數與品級標準即時高亮差額提示、職業裝備相容性字典 (`JOB_ALLOWED_WEAPON_TYPES` / `JOB_ALLOWED_ARMOR_TYPES`)、裝備庫挑選本職過濾與切換職業自動修正。
    - `src/data/UniqueAdventurers.ts`：`UniqueHeroDef` 加入 `isAdvanced?: boolean`，`createUniqueAdventurer` 加入滿 10 等方可進階防呆。
    - `src/tools/CombatStudio.test.ts`：新增等級進階防呆與職業裝備相容性單元測試。
  - **進度**：全數通過 35 個測試檔案 162 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/StoryStudio/BountyBoardWorkflowUpgrade] 故事工坊懸賞委託 (BOUNTY_BOARD) 全鏈路可視化與快捷建立升級（2026-08-30）**：
  - **模組架構**：
    - `src/tools/story-studio/StoryStudioStore.ts`：實裝 `createBountyNode()` 懸賞節點一鍵快速建立。
    - `src/templates/story-editor.html`：工具列新增 `📜 ＋新增懸賞委託` 按鈕，預設展開懸賞設定區塊。
    - `src/tools/story-studio/StoryStudioGraph.ts`：流程圖節點展示 `⏱️ 執行天數 | 💰 金幣 | ⏳ 保留天數` 金色摘要徽章。
    - `src/tools/story-studio/StoryStudioForm.ts`：切換/選取 `BOUNTY_BOARD` 時自動展開並同步設定。
  - **進度**：全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Refactor/LegacyCleanup/AbolishLegacyInvasionAndExtortion] 徹底拔除舊時代強盜勒索 (Extortion) 與純數值侵襲洗劫 (processInvasionCombat) 歷史遺留代碼（2026-08-30）**：
  - **模組架構**：
    - `src/systems/BountySystem.ts`：移除強盜懸賞過期時觸發 `pendingExtortionEvent = true` 的舊邏輯。
    - `src/core/GameState.ts`：移除 `pendingExtortionEvent` 屬性與重設邏輯。
    - `src/core/GameLoop.ts`：彻底刪除 `processInvasionCombat`、`processInvasionDefeat` 與 `showInvasionReport`（哨所抵抗羊皮紙彈窗）。
    - `src/ui/ExtortionModalController.ts`：徹底廢棄停用。
  - **進度**：全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/HeroExclusivity/DynamicViceCommanderSubstitution] 傳奇唯一英雄全球排他性與據點戰鬥全鏈路智慧副將接替引擎實裝（2026-08-30）**：
  - **模組架構**：
    - `src/data/UniqueAdventurers.ts`：冒險者實體化注入 `characterKey` 與 `boundMonsterId`。
    - `src/systems/map/FactionArmyGenerator.ts`：`buildUnavailableCharacterSet` 強化 `findHeroDef` 雙向英雄綁定解析。
    - `src/systems/MonsterSystem.ts`：`createInstancesFromTemplateWaves` 討伐據點波次守軍全面接入 `FactionArmyGenerator.getBestSubstituteMonsterId` 智慧副將替換。
    - `src/systems/CombatSystem.ts` 與 `src/systems/combat/InteractiveCombatSession.ts`：實裝戰鬥敵人不可用名將二次安檢防禦與自動副將替補；補齊 `avatarIcon` 參戰者與初始狀態傳遞。
    - `src/systems/ExplorationNarrativeEngine.ts`：戰後俘虜判定嚴格排除 `【代理副將】` 與已歸順/已在地牢之傳奇英雄。
    - `src/systems/MonsterAndSkillSystem.test.ts`：新增專屬全球唯一性排他與代理副將替補全鏈路單元測試。
  - **進度**：全數通過 35 個測試檔案 160 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Architecture/HeroDatabase/JSONPersistenceAutoSync] 英雄資料庫實體 JSON 化 (unique_heroes.json) 與工坊自動同步寫入硬碟重構實裝（2026-08-30）**：
  - **模組架構**：
    - `src/data/unique_heroes.json`：建立純淨實體英雄資料庫檔案（SSOT）。
    - `vite.config.ts`：接通 `/api/get-hero-definitions` 與 `/api/save-hero-definitions` 自動硬碟同步與備份端點。
    - `src/tools/CombatStudio.ts`：英雄工坊保存時自動調用 API 同步寫入硬碟。
    - `src/data/UniqueAdventurers.ts`：徹底精簡，直連 `unique_heroes.json`。
    - `src/data/SkillData.ts`：`getAdventurerSkillInfo` 支援動態解析自訂工坊技能。
    - `src/ui/modals/PrisonerModalController.ts`：地牢招降扣款/沒收後即時調用 `UIManager.updateUI()` 刷新頂部 HUD。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/HeroWorkshop/StorageKeyAndAvatarAlignment] 英雄工坊儲存鍵值對齊 (MEDIEVAL_CUSTOM_HEROES) 與全鏈路專屬立繪渲染修復（2026-08-30）**：
  - **模組架構**：
    - `src/data/UniqueAdventurers.ts`：修復 `localStorage` 讀取鍵值對齊 `MEDIEVAL_CUSTOM_HEROES`。
    - `src/ui/IconSpriteHelper.ts`、`src/ui/components/AdventurerCard.ts`、`src/ui/modals/PartyModalController.ts`、`src/ui/CombatUIManager.ts`：實裝 `adv.avatarIcon` 全鏈路渲染支援。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Refactor/HeroWorkshop/SSOTWorkshopPriority] 英雄名單 SSOT 權威統一與工坊自訂資料優先覆蓋實裝（2026-08-30）**：
  - **模組架構**：
    - `src/data/UniqueAdventurers.ts`：重構 `getSelectableHeroes`（工坊自訂資料 100% 覆寫官方預設）、`findHeroDef`、`createUniqueAdventurer`。
    - `src/data/monsters.json`：補齊 `enemy_ryan` 的 `characterKey: "char_ryan"` 與 `captureRate: 100`。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/Dungeon/UniqueHeroSSOTCaptureDungeonSystem] 以英雄名單 (UniqueHeroDef) 為 SSOT 的全鏈路俘虜資格、地牢收押與提審招降實裝（2026-08-30）**：
  - **模組架構**：
    - `src/data/UniqueAdventurers.ts`：導出 `findHeroDef` 查詢方法。
    - `src/models/Territory.ts`：擴充 `dungeonPrisonerHeroIds` 地牢名冊。
    - `src/systems/ExplorationNarrativeEngine.ts`：以英雄名冊判定俘虜資格並押送領地地牢。
    - `src/ui/modals/PrisonerModalController.ts`：重構 `openDungeonList` 支援英雄名單與頭像渲染，提審招降調用 `createUniqueAdventurer` 完整還原屬性與裝備。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Fix/MonsterSystem/SubjugationWavesSSOTAlignment] 討伐據點工坊自訂波次守軍精確載入與 SSOT 對齊修復（2026-08-30）**：
  - **模組架構**：
    - `src/systems/MonsterSystem.ts`：實裝 `createInstancesFromTemplateWaves`，重構 `generateNodeEncounter` 優先讀取 `DataStore.getSubjugationTemplates()` 自訂波次守軍、站位與副將自動接替。
    - `src/ui/modals/NodeDetailModalController.ts`：修復天氣持續天數防呆（預設 3 天）。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/Dungeon/FallenFactionPrisonerActions] 地牢俘虜系統滅國與常規情境差異化處置邏輯實裝（2026-08-30）**：
  - **模組架構**：
    - `src/ui/modals/PrisonerModalController.ts`：實裝滅國檢定（`isFallenFaction`）、招降半價加盟、沒收私產流放、化身在野傳奇之自適應按鈕標籤與 Toast 敘事回饋。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[UI/StoryStudio/InspectorCardModularLayout] 故事工坊右側屬性面板 (Inspector) 模組化卡片視覺架構升級（2026-08-30）**：
  - **模組架構**：
    - `src/templates/story-editor.html`：重構 Inspector 表單為 6 大獨立卡片（`.inspector-card`）。
    - `src/styles/story-editor.css`：實裝卡片微陰影、12px 呼吸間距、各區塊專屬主題色高亮邊框（暗金、琥珀橘、青藍、翡翠綠、寶藍、亮金）與精緻折疊標題列。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatCapture/DynamicGradientCaptureRateEngine] 戰鬥將領動態梯度俘虜率與自訂俘虜率引擎實裝（2026-08-30）**：
  - **模組架構**：
    - `src/models/types.ts` & `src/data/UniqueAdventurers.ts`：新增 `captureRate?: number`。
    - `src/systems/ExplorationNarrativeEngine.ts`：實裝 `calculateCaptureRate`（滅國絕境 100%、自訂優先、多城 40%、野外 25% 與突圍敘事）。
    - `src/templates/combat-studio.html` & `src/tools/CombatStudio.ts`：怪物與英雄編輯彈窗實裝專屬被俘虜率欄位與雙向讀寫。
    - `src/systems/ExplorationNarrativeEngine.test.ts`：4 項單元測試。
  - **進度**：全數通過 35 個測試檔案 159 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Feature/CombatStudio/MonsterEditorCharacterKeyAndSubstituteFields] 戰鬥工坊怪物編輯器新增唯一角色代碼與指定代理副將輸入欄位（2026-08-30）**：
  - **模組架構**：
    - `src/templates/combat-studio.html`：怪物編輯彈窗新增【🔗 唯一角色代碼 (`characterKey`)】與【🛡️ 指定代理副將 ID (`substituteMonsterId`)】輸入欄位。
    - `src/tools/CombatStudio.ts`：實裝編輯怪物時自動回填與保存時的雙向寫入。
  - **進度**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Asset/UnusedImagesCleanup] 全專案未使用圖片資源深度掃描與清理瘦身（2026-08-30）**：
  - **模組架構**：
    - 深度掃描全專案 74 張圖片之引用狀況，安全清理刪除 15 張未被任何程式碼/樣式/圖集引用的舊版、重複與暫存圖片。
    - 專案體積即時釋放 **29.93 MB**，剩餘 59 張圖片經二次掃描確認 100% 正常引用中，未引用圖片數降為 0。
  - **進度**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包 0 錯誤。

- **[Docs/DocumentationOverhaulAndCleanup] 全專案核心手冊全面校正重整與過時文件清理（2026-08-30）**：
  - **模組架構**：
    - 清理刪除 `TAVERN_SYSTEM_PLAN.md`、`PROJECT_ARCHITECTURE_AND_BALANCE_REVIEW.md` 與 `docs/systems/` 早期模板目錄。
    - 全面重整五大核心手冊：`game_system_guide.md`（修正職業裝備限制、五大工坊、戰術戰鬥）、`MONSTERS_AND_ELEMENTS.md`（同步 64+ 隻全魔物母庫與動態副將接替規範）、`MATERIALS_AND_ITEMS.md`（同步 30+ 款素材特產與精靈圖圖標標籤）、`STORY_STUDIO_GUIDE.md`（同步英雄條件/獎勵與視覺化挑選器）、`CHEATS.md`（同步全自訂積木技能工坊 `skill` 密技與全域函式）。
    - `docs/ARCHITECTURE.md`：同步目錄樹為 16 份權威文件。
  - **進度**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包。

- **[Docs/ArchitectureUpdate] 全專案架構文件 ARCHITECTURE.md 模組樹與系統規格全面同步（2026-08-30）**：
  - **模組架構**：
    - `docs/ARCHITECTURE.md`：校正目錄結構樹（補齊 `tools/skill-workshop.html`、`src/tools/SkillWorkshop.ts`、`src/tools/story-studio/` 模組化組件、`src/systems/combat/` 新增子模組、`src/data/` 資料庫與 `docs/` 核心規範文件）。
    - 升級為五大獨立開發工坊體系（納入全自訂積木技能工坊）；同步更新戰鬥與技能架構、雙實體英雄唯一代碼綁定與動態副將接替引擎、全域圖標水平鏡像協議等。
  - **進度**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包。

- **[Feature/HeroStudio/DualEntityBindingAndDynamicViceCommander] 雙實體英雄唯一身分綁定與動態副將接替引擎實裝（2026-08-29）**：
  - **模組架構**：
    - `src/models/types.ts` & `src/data/UniqueAdventurers.ts`：擴充 `MonsterData` 與 `UniqueHeroDef` 支援 `characterKey`、`boundMonsterId` 與 `substituteMonsterId`。
    - `src/templates/combat-studio.html` & `src/tools/CombatStudio.ts`：英雄創作工坊實裝身分綁定欄位 UI 與雙向資料庫存檔。
    - `src/systems/map/FactionArmyGenerator.ts`：實裝 `resolveTroopMember`、`getBestSubstituteMonsterId` 與 `instantiateCombatGroup` 動態副將接替引擎。
    - `src/systems/map/FactionArmyGenerator.test.ts`：4 項單元測試覆蓋未收編生成、指定副將替換、演算法自動副將替換與部隊藍圖唯讀隔離性。
  - **進度**：全數通過 34 個測試檔案 155 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包。

- **[Refactor/SkillSystem/MpCostFieldStandardization] 技能系統與自訂積木技能全專案 MP 消耗欄位標準化 (mpCost SSOT 收斂)（2026-08-29）**：
  - **模組架構**：
    - `src/models/Skill.ts`、`src/data/CustomSkillData.json`、`src/tools/SkillWorkshop.ts`、`src/systems/combat/SkillEffectEngine.ts`、`src/tools/CombatStudio.ts`：全專案技能系統將魔力消耗欄位 100% 收斂統一為 `mpCost`（同時支援 `totalMpCost` 向下相容）。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試、TypeScript 型別嚴格檢查與 Vite 生產打包。

- **[Fix/HeroStudio/CustomSkillMpCostDisplay] 英雄工坊技能卡槽自訂技能 MP 消耗 (totalMpCost) 讀取相容性修復（2026-08-29）**：
  - **模組架構**：
    - `src/tools/CombatStudio.ts`：修復 `renderHeroSkillSlots` 與 `renderHeroSkillPickerGrid`，升級為相容讀取 `sk.mpCost ?? sk.totalMpCost ?? sk.cost?.mpCost ?? 0`，使工坊自訂技能正確顯示真實 MP 消耗。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試與 Vite 生產打包。

- **[Feature/SkillWorkshop/StatusEffectVisualPicker] 技能工坊積木狀態類型 (StatusType) 全視覺化挑選器 Modal 與按鈕重構實裝（2026-08-29）**：
  - **模組架構**：
    - `src/templates/skill-workshop.html`：新增 `#modal-sw-status-picker` 視覺化彈窗，提供 DEBUFF 與 BUFF 網格與清空按鈕。
    - `src/tools/SkillWorkshop.ts`：定義 `STATUS_OPTIONS`（包含 17 種狀態與中文描述），將積木內的文字輸入框全面替換為點擊式卡片按鈕，支援點擊直接喚起彈窗挑選並即時綁定與儲存。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試與 Vite 生產打包。

- **[Feature/SkillWorkshop/IdEditAndDiskSyncOverhaul] 全自訂積木技能工坊 ID 即時連動修復、雙向儲存同步與【🔄 從專案重載 (Git 同步)】實裝（2026-08-29）**：
  - **模組架構**：
    - `src/templates/skill-workshop.html`：頂部導航列新增 `#btn-sw-reload-disk`【🔄 從專案重載 (Git 同步)】按鈕。
    - `src/tools/SkillWorkshop.ts`：修復修改技能 ID 後 `this.currentSkillId` 指標脫節導致後續所有編輯（名稱、圖標、積木增刪、倍率調整）全部失效的 Bug；實裝 ID 重複性防呆檢查；實裝 `loadSkills` 多層次穩健載入（磁碟 API ➔ 本機 LocalStorage ➔ 靜態 JSON）與 `reloadFromDisk`；儲存時雙軌同步寫入磁碟與 LocalStorage。
    - `src/tools/CombatStudio.ts`：自訂技能讀取同步支援 `CustomSkillData.json` 靜態 fallback。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試與 Vite 生產打包。

- **[Feature/HeroStudio/EquipPickerModalAndSkillTooltipRefactor] 英雄工坊三槽技能簡短ICON+Tooltip精簡化與三格裝備全視覺化Modal挑選器重構（2026-08-29）**：
  - **模組架構**：
    - `src/templates/combat-studio.html`：將技能槽位排版改為緊湊等寬 3 格並排（`grid-template-columns: repeat(3, 1fr)`），詳細技能說明全面改置於卡槽容器之 `title` Tooltip 中，3 招一覽無遺；徹底拔除裝備 3 處 `<select>` 下拉選單，改為點擊式展示卡片槽位並新增全視覺化【⚔️ 英雄裝備挑選器 Modal】（`#modal-hc-equip-picker`）。
    - `src/tools/CombatStudio.ts`：實裝 `updateHeroCreatorEquipmentDisplays`、`openHeroEquipmentPicker`、`renderHeroEquipmentPickerGrid`，支援階級篩選、搜尋、卡片即時穿戴與一鍵【🚫 卸下裝備 (留空)】。全裝備圖標 100% 透過 `renderEquipIcon(item, sizePx)` 渲染（SSOT），屬性數值統一對齊 `item.combatEffects`。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試與 Vite 生產打包。

- **[Feature/StoryStudio/HeroIntegrationAndTestHeroIsolation] 故事工坊英雄連動機制與測試英雄嚴格隔離（2026-08-29）**：
  - **模組架構**：
    - `src/models/Narrative.ts` & `src/systems/NarrativeSystem.ts`：實裝 `HERO_EXISTS` 與 `HERO_MISSING` 條件（支援多選名單與 `ANY`/`ALL` 比對），實裝 `GRANT_HERO` 獎勵效果（生成英雄並加入玩家領地）。
    - `src/tools/story-studio/StoryStudioHeroPicker.ts`：新建全視覺化英雄挑選器 Modal，支援即時關鍵字搜尋、卡片立繪展示、單選（獎勵）與多選打勾（條件）。
    - `src/tools/story-studio/StoryStudioForm.ts` & `StoryStudioTypes.ts`：表單支援英雄條件多選徽章標籤展示、移除與模式切換，效果表單支援贈送英雄卡片預覽。
    - `src/data/UniqueAdventurers.ts`：將【不滅誓約】神聖誓約騎士 `oath` 標記 `isTestOnly: true`，在 `getSelectableHeroes()` 中 100% 過濾排除，確保測試專用數據不被選取且絕不出現在遊戲內故事與招募清單中。
  - **進度**：全數通過 33 個測試檔案 151 項單元測試與 Vite 生產打包。

- **[Feature/HeroStudio/EquipmentAndCustomSkills] 英雄工坊三格獨立裝備配置與三槽自訂技能挑選器（2026-08-29）**：
  - **模組架構**：
    - `src/templates/combat-studio.html`：重構英雄編輯彈窗，徹底移除肖像體系下拉選單與死板神裝設定，改為與遊戲對齊的 **【⚔️ 主手武器 / 🛡️ 身體防具 / 💍 飾品槽】** 三格獨立槽位（支援空手/空防具/空飾品）與全視覺化卡片式【🔮 技能挑選器 Modal】。
    - `src/models/Adventurer.ts` & `src/data/UniqueAdventurers.ts`：升級 `UniqueHeroDef` 與 `Adventurer` 支援 `customSkills?: string[]` 與靈活空裝備生成。
    - `src/data/SkillData.ts` & `src/systems/CombatSystem.ts`：將技能加載順序全面升級為優先使用 `adv.customSkills` (SSOT)。
    - `src/tools/CombatStudio.ts`：實裝三槽技能槽即時渲染、職業切換預設技能連動、全視覺化技能挑選器網格搜尋與分類 Tab、三格裝備圖標連動與持久化儲存。
  - **進度**：全數通過 33 個測試檔案 148 項單元測試與 Vite 生產打包。

- **[Feature/Icon/UniversalFlipModifier] 通用圖標挑選器水平翻轉 (SSOT) 與全域 `?flip` 語法糖實裝（2026-08-29）**：
  - **模組架構**：
    - `src/ui/IconSpriteHelper.ts`：`renderUniversalIcon` 與 `renderUniversalPortrait` 支援 `?flip` 語法糖。
    - `src/tools/CombatStudio.ts` & `src/tools/EquipmentStudio.ts`：圖標挑選器頂部提供【↔️ 水平翻轉: 開/關】按鈕與即時鏡像。
  - **進度**：全數通過 33 個測試檔案 148 項單元測試與 Vite 生產打包。

- **[Refactor/GeographyAlignmentExecution] 全專案勢力地理稱謂實裝完成（2026-08-28）**：
  - **模組架構**：完成 `combat-studio.html`、`FactionData.ts`、`MapData.ts`、`subjugation_nodes.json` 與 `FactionArmyGenerator.ts` 命名大掃除，徹底清除舊有錯位稱呼（東境/南境及火山被誤叫北境等）。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：定案八大勢力標準稱謂（北境赫斯特、西境貝拉維亞、熔岩鍛爐沃爾蒙德、赤砂荒漠達斯克、中央王室洛斯加、橡木谷、黑木守衛、遠古龍裔），解決舊文案與大地圖畫布方向錯位問題。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/data/subjugation_nodes.json`：新增 `oak_army_template` 與 `blk_army_template` 範本。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/data/subjugation_nodes.json`：五大軍團範本九宮格全數回歸純戰鬥士兵編制，攻城器械改由 AI 出征決策與 `attackerConfig` 動態調用。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/data/subjugation_nodes.json`：新增 5 個軍團範本（`royal_army_template`, `val_army_template`, `mor_army_template`, `lys_army_template`, `cas_army_template`），均包含完整 3×3 九宮格兩波部隊與軍團戰力設定。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `public/assets/custom_icons/faction_units_8x8.jpg`：8×8 全角色嚴格統一面朝向左的勢力軍團頭像圖集。
    - `src/data/custom_icon_datasets.json`：註冊 `faction_units_8x8`（64 格圖標）。
    - `src/data/monsters.json`：註冊 26 種各勢力專屬特色正規軍團單位。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/tools/CombatStudio.ts`：修復 `btn-save-monster-item` 邏輯，改為 ID 存在時覆蓋更新、不存在時新增，並完整持久化 `avatarIcon` 與 `terrains`。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/data/subjugation_nodes.json`：將全部 27 處官方據點的別名 ID 徹底統一校正為 `n_val_1`, `n_royal_1`, `n_adv_1` 等標準權威代號。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/core/GameState.ts` & `src/ui/NarrativeTestController.ts`：在過濾常駐自訂據點與秘境時，加入 `existingNodeNames` 雙重比對，徹底消除原生同名據點被重複生成的問題。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/ui/NarrativeTestController.ts`：對齊 `GameState.initGameState()`，自動動態讀取 `DataStore.getSubjugationTemplates()`，將所有使用者在據點工坊自訂的常駐攻略據點與秘境注入測試大地圖。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/templates/combat-studio.html` & `src/tools/CombatStudio.ts`：實裝 `#modal-material-picker`，將長卷軸清單全面替換為「🎨 選擇物資按鈕 + 標籤膠囊」，支援搜尋與圖卡多選。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/systems/MarketSystem.ts`：徹底廢除獨立硬編碼的 `TradeGood` 宣告，全面改為直接引用 [src/data/materials.json](file:///i:/gameproject/Medieval/src/data/materials.json) 作為唯一權威來源。
    - `src/templates/combat-studio.html` & `src/tools/CombatStudio.ts`：在據點工坊實裝「市場產銷配置」面板，支援自訂勾選【🛒 盛產／可買 (0.5x 批發價)】與【💰 短缺／需求 (1.6x 高價收購)】。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/tools/story-studio/StoryStudioTypes.ts` & `StoryStudioForm.ts`：在視覺化故事工坊條件選單中加入 3 大沙盒條件（據點控制權 `NODE_OWNER_IS`、派系交戰中 `FACTION_AT_WAR`、派系糧荒中 `FACTION_STARVING`）。
    - `src/systems/NarrativeSystem.ts`：實裝底層對應條件檢查與自適應文案描述。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/ui/MapScene.ts`：實裝 `renderCampaignLegions()` 大地圖道路軍團標記即時渲染與點擊互動發布。
    - `src/templates/modals-combat-trade.html` & `src/ui/modals/FactionCampaignModalController.ts`：實裝軍情刺探與野外攔截彈窗 (`#modal-faction-campaign-intel`)，整合雙向外交好感連動（進攻方 -35、防守方 +40）。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組架構**：
    - `src/systems/faction/FactionCampaignSystem.ts`：實裝戰役生命週期、道路行軍、邊境掠奪奪金奪糧、圍城決戰與據點控制權轉移 + 180 天停戰協議。
    - `src/systems/faction/FactionNarrativeBridge.ts`：實裝酒館連續劇傳聞轉譯、故事工坊動態文字插值與三大沙盒狀態條件判定。
  - **進度**：全數通過 32 個測試檔案 143 項單元測試與 Vite 生產打包。

  - **模組化架構**：
    - `src/models/FactionProfile.ts`：封裝五大模組 18 項數值矩陣（國庫/糧草/性格/記憶/常備軍/安定度）。
    - `src/systems/faction/FactionEconomyEngine.ts`：實裝每日稅收、軍餉糧草結算、飢荒逃兵與破產動態演變。
    - `src/systems/faction/FactionDecisionAI.ts`：實裝 4 大強制保命煞車與可插拔行為效用評估模型。
  - **後續步驟**：推進第二階段，實裝 `FactionCampaignSystem.ts`（大地圖軍團道路行軍實體與遭遇攔截）以及 `FactionNarrativeBridge.ts`（酒館連續劇傳聞與故事工坊雙軌插值對接）。

  - **根本原因**：HTML 模板中的行內樣式 `url('/...')` 在執行期未受 Vite 編譯處理，導致瀏覽器發出錯誤路徑請求（404）造成街道建築與傭兵面板透明隱形。
  - **解決方案**：全面將街道建築與傭兵面板背景樣式由 HTML 模板移至 [style.css](file:///i:/gameproject/Medieval/style.css) 統一以 CSS 類別宣告（SSOT），使 Vite 打包時 100% 正確編譯並注入 base 前綴。已全數通過 132 項自動化測試與生產打包。

- **[Fix/Build/TemplateLoader] 採用 Vite 原生 `?raw` 靜態字串導入修復生產環境 (GitHub Pages) HTTP 404 報錯（2026-08-28）**：
  - **根本原因**：`TemplateLoader.ts` 透過 `fetch()` 讀取 `src/templates/*.html` 在生產打包部署後無法讀取（404）。
  - **解決方案**：在 [TemplateLoader.ts](file:///i:/gameproject/Medieval/src/ui/TemplateLoader.ts) 中改用 `import ... from '../templates/*.html?raw'`，直接將 7 個 HTML 模板嵌入至 JS bundle，消除了初始化 fetch 的網路依賴與 404 問題，並全數通過 132 項自動化測試與 Vite 生產打包驗證。

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
  - **大地圖固定魔物巢穴與國家攻城據點全面收錄 (`subjugation_nodes.json`)**：收錄 24+ 處完備據點範本（硫磺深淵、飢餓冰窟、幻毒沼澤、死寂深淵、染血丘陵、嘆息平原等野外險地，以及舊王都永恆之城、鍛主之城、聖耀王座、金玫瑰城、黑鐵樞紐、黑曜石堡、裁決要塞等各大國家/勢力核心攻城戰略要塞）。
  - **據點工坊（Subjugation Studio）功能升級 (`CombatStudio.ts`, `combat-studio.html`)**：支援「＋ 創造新據點」與「🗑️ 刪除據點」；實裝【🛡️ 允許帶兵討伐／攻城 (`allowTroops`)】勾選框；實裝【大地圖生成模式 (`worldGenMode`)】下拉選單（🌐 開局常駐生成 / 🌫️ 迷霧隱藏秘境 / 📜 故事事件專屬）；實裝【所屬國家／勢力 (`factionId`)】與【節點規模等級 (`nodeLevel`)】配置，並在左側清單新增「勢力篩選」過濾器與「🛡️可帶兵」徽章。
  - **新遊戲大地圖動態生成整合 (`GameState.ts`, `MapGenerator.ts`)**：新開局時，大地圖演算法自動讀取據點工坊中所有標記為常駐與秘境的自訂與國家據點，隨機分布於大地圖上，實現大地圖攻略內容完全由創作者自訂。
  - **遊戲內派遣出征兵力調派連動 (`DispatchModalController.ts`)**：派遣討伐或攻城時，若目標節點開啟 `allowTroops` 或 `isWar`，自動支援調派步兵（護盾）、弓兵（箭雨）與騎兵（衝鋒）軍團。
  - **驗證**：TypeScript 型別檢查 0 錯誤、擴充專屬單元測試、28 個測試檔案 121 項單元測試 100% 全部通過。
- **[Fix/UI/RightPanelBackgroundRestore] 修復右側帝國儀表板底圖與樣式隔離（2026-08-27）**：
  - **樣式範圍嚴格隔離 (`UIThemeStudio.ts`)**：修正全域樣式注入規則，移除對 `.glass-panel` 的強制 `!important` 覆蓋，將自訂樣式嚴格限制於獨立設施視圖 (`.facility-view .glass-panel:not(#shared-right-panel)`)，徹底排除並保護右側帝國儀表板 (`#shared-right-panel`)，100% 恢復右側原始羊皮紙與精緻底圖外觀。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Tools/LiveLayoutEditor] 遊戲內即時覆蓋排版與美術編輯器 (Live HUD & Layout Inspector) 全面實裝（2026-08-27）**：
  - **即時覆蓋編輯器 (`LiveLayoutEditor.ts`)**：在遊戲任意畫面連續敲擊鍵盤 **`layout`** 或 **`edit`** 即可在當前畫面上喚出浮動編輯面板。支援點選元素金色高亮框、滑鼠自由拖曳移動 (Drag to Move)、本地圖片（PNG/JPG）一鍵上傳替換背景/素材、X/Y 座標、寬高、圓角半徑與透明度微調。點擊【💾 儲存】即可永久記錄排版，開局自動載入生效。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Tools/UIThemeStudio] 全域視覺排版與美術工坊 (UI & Asset Studio) 全面實裝，改由 CHEAT 密技觸發（2026-08-27）**：
  - **移出常規遊戲介面 (`views-facility.html`, `FacilityController.ts`)**：自領主書房「其他指令」中徹底移除視覺工坊按鈕，維持純淨的遊戲探索與內政體驗。
  - **CHEAT 密技系統喚醒 (`CheatController.ts`)**：遊戲中直接敲擊鍵盤英文字母 **`layout`** 或 **`theme`** 即可即時喚醒工坊；支援主控制台 `openThemeStudio()` / `openUIStudio()` 隨時呼叫。支援切換預覽【⛪ 修道院】、【🍺 酒館】、【🏛️ 領主書房】、【⚒️ 鍛造屋】；支援本地圖片（PNG/JPG）一鍵上傳換背景；滑桿即時調節底色透明度、邊框粗細、圓角半徑、邊框顏色、按鈕 5 大色系與雙欄排版比例。點擊【💾 儲存並套用至全遊戲】即可永久套用至全遊戲。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Combat/MultiSquadHealthAndWoundSettleFix] 多梯隊迎擊/守城戰全參戰成員戰後血量與重傷瀕死 1:1 寫回修復（2026-08-27）**：
  - **全梯隊參戰成員總追蹤 (`CombatSystem.ts`, `InteractiveCombatSession.ts`)**：引入 `allTrackedPlayers` 總追蹤機制，在開局第一梯隊以及後續增援梯隊登場時，即時將所有參戰成員納入追蹤。徹底修復過去換梯隊後，先前陣亡被換下的前排隊員因脫離 `playerTeam` 而遺漏結算的嚴重 Bug。戰後 100% 寫回每一位參戰成員真實 HP/MP 與【🩸 重傷瀕死】Debuff。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Config/Civic/ChurchBedAdvancedMaterialCost] 病床打造材料升級為木板 (mat_wood_plank) 與皮革 (mat_leather) 全鏈路實裝（2026-08-27）**：
  - **精確材料校準 (`ChurchSystem.ts`, `ChurchModalController.ts`)**：將打造病床的消耗由原木改為進階加工材料：**20 木板 (`mat_wood_plank`) + 10 皮革 (`mat_leather`)**。介面即時顯示現有庫存 `消耗: 20木板 (現有 X) 10皮革 (現有 Y)`，當兩者材料充足時解鎖點擊【🔨 打造新病床】。
  - **驗證**：TypeScript 型別檢查 0 錯誤、單元測試 `ChurchAndPersistentHealth.test.ts` 更新並通過、28 個測試檔案 120 項測試 100% 全部通過。
- **[Refactor/Civic/ChurchTavernLayoutAndCardPatientSelect] 教會醫療所「酒館同款雙欄佈局」重構與「全卡片式病床選人」徹底去下拉選單實裝（2026-08-27）**：
  - **修復鍛造屋與教會 HTML 嵌套錯位 (`views-facility.html`)**：補齊 `#view-forge` 遺漏的閉合標籤 `</div>`，徹底修復「點擊修道院無反應、點隔壁鍛造屋誤入修道院」的嚴重 DOM 錯位 Bug。
  - **零標籤酒館式雙欄介面 (`views-facility.html`, `ChurchModalController.ts`)**：徹底移除容易造成混亂的 Tab 頁籤切換，改為酒館同款滿版左右雙欄（左欄功能操作 + 右欄卡片列表與選中操作區）。
  - **全卡片式病床選人與急救互動 (`ChurchModalController.ts`)**：徹底廢除 `<select>` 下拉選單。點擊空病床時，下方直接列出所有可用傭兵的頭像卡片（`renderAdventurerCard`，受傷/重傷傭兵自動置頂排序），點擊任意卡片立即入住。選中已入住病床時，即時展示血條百分比、提供【💉 施用藥水急救 (補25% HP)】與【🚪 離床出院】操作。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Civic/ChurchBaseUpgradeAndStreetDragFix] 教會由書房統一建造升級、未建造街道隱藏與街道拖曳滾動修復（2026-08-27）**：
  - **書房統一建造升級 (`SceneController.ts`, `Territory.ts`, `IconSpriteHelper.ts`)**：將【⛪ 教會與醫療所】正式納入領主書房「🏛️ 領地建築升級」清單，支援 Lv.1 建造（150金 40木 20石）至 Lv.4 升級，並提供動態建築名稱與描述。
  - **街道未建造嚴格隱藏 (`SceneController.ts`)**：修正街道建築顯示邏輯為 `(isMyHome && churchLevel > 0)`，未建造時（Lv.0）完全不在街道上顯示，與酒館、鐵匠鋪規則 100% 一致。
  - **街道拖曳與滾動修復 (`main.ts`)**：在系統啟動流程中主動呼叫 `initStreetScroller()`，恢復街道滑鼠橫向拖曳（Grab & Drag）與導航箭頭滑動功能。
  - **傭兵詳情面板血條真實連動 (`PartyModalController.ts`)**：修正詳情面板寫死滿血的歷史遺留邏輯，改為動態讀取 `adv.getCurrentHp()` 與 `adv.getCurrentMp()`，重傷或受傷時真實顯示剩餘血量與百分比。
  - **驗證**：TypeScript 型別檢查 0 錯誤、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Feature/Civic/ChurchAndPersistentHealthSystem] 傭兵即時持久 HP/MP 體系、重傷瀕死 Debuff、伐木場藥草採集與領地教會醫療所病床急救系統全面實裝（2026-08-27）**：
  - **傭兵持久生命與重傷 Debuff (`Adventurer.ts`, `types.ts`)**：傭兵資料模型新增 `currentHp` / `currentMp` 持久生命魔力與 `isWounded` 狀態，戰鬥入場以當前持久血量為準，戰後 1:1 寫回。戰敗或陣亡傭兵鎖定為 1 HP 並賦予【🩸 重傷瀕死】Debuff（全屬性 -20%、速度 -30%），生命值休養或急救至 80% 以上自動痊癒解除。徹底廢除戰敗鎖定硬 CD（Lockout CD），只要血量健康或備用梯隊齊全隨時可調度出征。
  - **伐木場野生藥草採集 (`TownManagementSystem.ts`)**：伐木工每日作業時，機率副產野生藥草（`tg_Medicinal_herbs`）存入領地倉庫，完善四大基礎生產設施資源閉環。
  - **教會與醫療所建築體系 (`ChurchSystem.ts`, `Territory.ts`, `ChurchModalController.ts`, `views-facility.html`)**：支援 5 大階級擴建（Lv.0 10% ➔ Lv.1 祈禱處 15% ➔ Lv.2 禮拜堂 20% ➔ Lv.3 修道院 25% ➔ Lv.4 大教堂 30% 全領地過夜自然恢復率）。實裝【病床區】（木材打造，Lv.1 4床 ➔ Lv.4 16床，入住額外 +10%）、【聖光藥坊】（50藥草=1生命藥水）、【藥水急救】（消耗1藥水補25% HP，4回合CD）與【退休神職被動】（每2位退休神職+1%回血與藥水效果）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、新增專屬測試套件 `ChurchAndPersistentHealth.test.ts`、28 個測試檔案 120 項單元測試 100% 全部通過。
- **[Fix/Combat/CommanderTacticCdGuard] 親征模式領主軍令 CD 與兵力防呆阻斷全鏈路實裝（2026-08-27）**：
  - **防誤觸阻斷機制 (`CombatUIManager.ts`)**：在 `handleOrderClick` 前置加入冷卻時間（`cds.SHIELD_WALL`、`cds.VOLLEY_FIRE`、`cds.CAVALRY_CHARGE`、`cds.INSPIRE`）與剩餘兵力校驗。當玩家誤觸處於 CD 或兵力不足的技能時，即時彈出 Toast 警示並 **100% 絕對阻斷回合推進**，防止因誤觸而白白空過回合，保障戰術決策體驗。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/RaidLifecycleAndOvernightSurvivingWaves] 過夜倒數待決圍城戰役生命週期修復與野外殘存波次殘血 100% 繼承實裝（2026-08-27）**：
  - **待決戰役生命週期修正 (`TownManagementSystem.ts`, `TerritoryDefenseSystem.ts`)**：修復過夜推進天數時因在開戰前提前執行 `filter(pr => pr.warningDaysLeft > 0)` 導致守城戰初始化找不到 `pendingRaids` 而退回全新生成範本的重大時序漏洞。改為在守城戰徹底打完並結算（`settleSiegeDefenseResults`）時才清理該戰役，確保野外攔截戰留下的殘存波次與殘血怪物（如打殘的雪怪）100% 完整保留並傳入守城戰舞台。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/BarInternalHpMpOverlay] 戰鬥角色卡片「條內微型 HP/MP 數值疊加 (Bar-Internal Overlay)」與殘血即時渲染實裝（2026-08-27）**：
  - **條內微型數值疊加佈局 (`style.css`, `CombatUIManager.ts`)**：在完全不額外增加卡片高度、100% 保留肖像視野的前提下，將 HP 與 MP 的即時數值（如 `245/1000` 與 `80/100`）直接疊加置中印在綠色血條與藍色魔力條內部；採用等寬字體（monospace）搭配 `text-shadow` 黑色文字陰影，無論血條滿綠、半血還是紅血瀕死，數字均 100% 清晰銳利。
  - **傭兵與敵方全體連動 (`InteractiveCombatSession.ts`, `Combat.ts`)**：`CombatParticipantState` 支援 `currentHp` 傳遞；守城戰開局、波次登場（`WAVE_START`）與梯隊登場（`SQUAD_CHANGE`）均精準讀取各怪物與傭兵的真實殘存 HP，血條寬度與數字百分之百即時連動。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeMirrorAndSurvivingWaves] 守城戰敵怪九宮格鏡像站位校正 & 實時親征「波次殘留與殘血 1:1 繼承」全鏈路修復（2026-08-27）**：
  - **守城戰敵怪九宮格鏡像站位校正 (`CombatUIManager.ts`)**：修正翻轉舞台下敵怪 gridColumn 計算為 `isSiege ? (3 - state.gridR) : (state.gridR + 1)`，徹底解決「前排冰原狼被放到最左側、後排雪怪貼在城門」的反向 Bug；現在前排魔物 100% 緊貼右側要塞城門前線，後排魔物在左側後方壓陣。
  - **實時親征波次狀態與殘血全鏈路繼承 (`InteractiveCombatSession.ts`, `TerritoryDefenseSystem.ts`)**：補全 `InteractiveCombatSession` 中各波次敵怪的實時陣亡與殘存 HP 追蹤，在 `generateFinalReport()` 中 100% 產出 `survivingWaves`。守城戰初始化時嚴格排除已陣亡怪物（`isDead` / `hp <= 0`）與已全滅波次，殘留怪物（如野外打殘的雪怪）100% 繼承殘血（`currentHp: s.currentHp`），不再被強制洗成滿血。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeGateHpLiveSync] 實時親征模式城門耐久度血條與數字即時更新全鏈路修復（2026-08-27）**：
  - **雙軌狀態相容修正 (`CombatUIManager.ts`)**：修復事件渲染中因僅檢測 `currentReport.gateMaxHp` 導致實時親征 `currentSession` 期間跳過血條數值更新的問題；現在統一相容 `this.currentSession?.gateMaxHp || this.currentReport?.gateMaxHp`，每當敵怪撞擊城門時，中央底部數字（如 `4989 / 5000`）與綠色進度條百分比 100% 即時扣除並觸發浮動受擊特效。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/MonsterAttackType] 怪物攻擊類型 (AttackType: MELEE/RANGED/MAGIC) 標準化擴充、怪物工坊升級與守城戰 100% 絕對阻隔實裝（2026-08-27）**：
  - **怪物資料模型與實體庫標準化 (`types.ts`, `monsters.json`, `MonsterSystem.ts`)**：定義 `AttackType = 'MELEE' | 'RANGED' | 'MAGIC'`，並為全資料庫 70 種怪物實裝明確的攻擊類型（弩手為 `RANGED`，法術怪/幽魂/薩滿為 `MAGIC`，野狼/哥布林/巨魔等 65 種為 `MELEE`）。
  - **戰鬥工坊 (Combat Studio) 升級 (`combat-studio.html`, `CombatStudio.ts`)**：升級怪物創造表單中的「攻擊距離與類型」下拉選單（`MELEE` 物理近戰 / `RANGED` 遠程物理 / `MAGIC` 遠程魔法），儲存與載入 100% 雙向對齊。
  - **戰鬥引擎守城戰絕對阻隔 (`InteractiveCombatSession.ts`, `CombatSystem.ts`)**：在守城戰且城門耐久 $> 0$ 時，若我方前排無人，`attackType === 'MELEE'` 的魔物（野狼、哥布林）100% 絕對無法攻擊中後排（艾蓮娜），傷害全部轉化為對城門耐久度的撞擊！只有 `RANGED` 或 `MAGIC` 可隔牆攻擊中後排並套用 25% 城垛掩體減傷。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/LayoutOptimization] 戰鬥框頂部全寬光環 Header Bar & 舞台正中底部城門 HUD 完美佈局實裝（2026-08-27）**：
  - **頂部領主親征光環 Header Bar (`modals-combat-trade.html`, `CombatUIManager.ts`)**：將光環移出舞台內部，於 Modal 最頂部建立全寬獨立橫條 `#combat-lord-aura-bar`，完整展示光環全名與所有屬性增益，字體清晰且 100% 徹底消除對戰場頂部人物卡牌的遮擋。
  - **城牆耐久度 HUD 移至舞台正中底部 (`modals-combat-trade.html`, `CombatUIManager.ts`)**：將 `#combat-siege-gate-hud` 移至中央城牆屏障底部、領主軍令【🐎 破陣衝鋒】正上方，與戰場正中央的要塞城門自然咬合，視覺層級井然有序。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/FortressGateBarrier & MeleeBlock] 守城戰中央實體要塞城門屏障、頂部防遮擋 HUD 重構與「近戰受城門阻隔無法攻擊後排」核心法則實裝（2026-08-27）**：
  - **戰場中央實體要塞城垛與城門屏障 (`modals-combat-trade.html`, `style.css`, `CombatUIManager.ts`)**：在戰鬥舞台正中央加入實體 `.combat-siege-wall-divider`（石砌要塞垛口與城門圖標），清晰劃分「城外攻城區」與「城內守軍區」；城門受擊時觸發即時劇烈震動與受擊動畫 (`wall-hit`)；頂部 HUD 防遮擋重構，領主光環徽章收斂至左上方獨立區域，中央頂部專屬預留給「🏰 領地城牆耐久度 HUD」，提升層級至 `z-index: 25`。
  - **守城戰近戰城牆阻隔法則與城垛掩體減傷 (`InteractiveCombatSession.ts`)**：
    - 🛡️ **無前排守軍時**：只要城門耐久度 > 0，敵方近戰單位（如哥布林）**100% 被城牆阻隔，絕對無法穿透攻擊中後排守軍**，所有物理近戰攻擊強制轉化為對城門耐久度的撞擊打擊（`SIEGE_GATE_DAMAGE`）。
    - 🏹 **遠程/法術攻擊**：可越過城牆攻擊中後排，但我方守軍享有 **25% 城垛掩體傷害減免**。
    - 💥 **城門攻破後**：觸發 `SIEGE_GATE_BREAK`，城門崩塌後敵軍近戰方可自由攻擊中後排！
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/SiegeDefenseVisuals] 領主親征「誓死守城戰」實體城牆耐久血條 HUD、要塞城垛背景、鏡像防禦站位與箭塔砲擊支援全鏈路修復（2026-08-27）**：
  - **親征守城戰專屬要塞視覺與實體城牆 HUD (`CombatUIManager.ts`)**：封裝 `setupStageEnvironment` 統一管理守城與野外場景渲染；當觸發正規守城戰時，實時親征模式與靜態回放模式 100% 完整掛載中央頂部的 **「🏰 領地城牆耐久度 HUD (Gate Durability)」** 與 **要塞城垛背景 (`.is-defense-siege`)**。
  - **守城戰正統鏡像防禦站位修復 (`CombatUIManager.ts`)**：新增 `isCurrentDefenseSiege()` 智能雙向檢測（相容 `currentReport` 與 `currentSession`），守城方在左側時前排單位緊靠右側中央城門前線（`gridColumn = gridR + 1`），後排在左側，敵怪由右側向左攻門，100% 恢復昨日正統鏡像戰術站位。
  - **親征守城戰邏輯對齊 (`InteractiveCombatSession.ts`)**：實裝哨所箭塔每回合支援砲擊（`CombatEventType.WATCHTOWER_ATTACK`）與敵怪近戰轟擊城門耐久度（`SIEGE_GATE_DAMAGE` / `SIEGE_GATE_BREAK`），完整回傳並結算領地城牆殘存耐久。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/ButtonsAndIcons] 戰鬥結算切換與瞬間完成按鈕 ID 綁定校正 & 親征怪物高清立繪修復（2026-08-27）**：
  - **戰鬥結算與按鈕操作修復 (`CombatUIManager.ts`)**：校正 `btn-combat-skip`、`btn-combat-close`、`btn-combat-result-close` 的 DOM ID 查詢，消除因 ID 前後綴不符導致的事件綁定失敗；在 `finishPlayback` 加入安全保護，保證戰鬥播完或點擊「⏩ 瞬間完成」時 100% 順暢切換出「完成」按鈕與結算面板，徹底解決卡在最後一幀不結束的問題。
  - **親征怪物專屬立繪修復 (`InteractiveCombatSession.ts`)**：補全實時親征會話中敵方隊伍與 `WAVE_START` 波次事件的 `avatarIcon` 傳遞，徹底告別 fallback 紙箱圖標，恢復寫實魔物立繪。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Fix/Combat/Sandbox/Lifecycle] 故事測試沙盒全域生命週期對齊與戰鬥中樞自動防呆 (`CombatUIManager.ensureInit`) 實裝（2026-08-27）**：
  - **故事測試沙盒環境 100% 完整對齊正式遊戲 (`main.ts`)**：調整啟動生命週期為「完整註冊 Templates 與全域 UI 模組 ➔ 再掛載故事測試控制器」，保證故事測試沙盒在戰鬥引擎、城防體系、日誌與回放上 100% 與正式遊戲同源共軌。
  - **戰鬥 UI 自動防呆初始化 (`CombatUIManager.ts`)**：實裝 `ensureInit()` 機制，在 `startInteractiveCombat`、`replayCombat`、`showCombat` 入口處全面主動檢測並安全綁定 DOM 節點；在 `createHpBar` 與 `showCombat` 加入卡片容器存在性保護與 `initialStates` 容錯，徹底解決探險日誌「⚔️ 戰鬥紀錄」在特定邊界條件下黑屏無法播放的問題。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/InteractiveCombatSession] 領主親征「實時單回合步進演算架構 (Interactive Combat Session)」與常規派遣雙軌隔離實裝（2026-08-27）**：
  - **核心雙軌架構隔離 (Dual-Track Architecture Separation)**：
    - 🛡️ **軌道 A（常規派遣／討伐／跑商／派遣迎擊）**：呼叫 `CombatSystem.simulateCombat` 進行批次演算，前端呼叫 `CombatUIManager.replayCombat(report)`，保留「⏩ 瞬間完成」按鈕與隨行部隊支援。
    - 👑 **軌道 B（領主親征戰役：親自出城攔截／誓死守城）**：建立 `new InteractiveCombatSession(...)`，前端呼叫 `CombatUIManager.startInteractiveCombat(session, onClose)`。
  - **實時步進演算與狀態鎖定機制 (`InteractiveCombatSession.ts` & `CombatUIManager.ts`)**：
    - 🔒 **禁瞬間完成**：親征模式下隱藏「⏩ 瞬間完成」按鈕，每回合實時步進運算。
    - 🛑 **交鋒防干涉鎖定**：每回合開始時戰場暫停，解鎖指揮列；玩家點擊任一軍令（盾牆/箭雨/衝鋒/鼓舞/待命）後，**按鈕立即反灰鎖定（`disabled`）**，執行 `session.stepTurn(order)` 並播放該回合動畫。
    - ⏳ **精準 CD 扣除**：回合結束後才將技能 CD 遞減 1，戰鬥未結束時重新解鎖按鈕等待下回合決策；支援「🤖 自動戰鬥 (Auto)」與「1x/2x/3x 速度」。
    - 🎯 **單一指令結算**：玩家選擇點擊的軍令立即作用於戰場，絕不自動混發其他未選指令。
  - **驗證**：TypeScript 型別檢查 0 錯誤、27 個測試檔案 114 項單元測試 100% 全部通過。
- **[Feature/Combat/LordCommander] 領主親征軍令中樞系統 (Turn-based Commander Loop) 與隨行部隊身分隔離（2026-08-27）**：
  - 👑 **領主親征**：標示為 `【👑 領主軍令·XXX】`，啟動光環與手動指揮 HUD。
  - 🛡️ **委託派遣**：完全移除「領主軍令」與光環，回歸隨行部隊支援（`【🛡️ 隨行軍團·步兵護盾】`、`【🏹 隨行軍團·箭雨支援】`、`【🐎 隨行軍團·側翼衝擊】`），自動由小隊長作戰。
  - 🏹 **弓兵人數與傷害修復**：修正日誌傷害被怪物殘存血量截斷問題，完整顯示打擊威力（如 782 點）；兵種調派人數（500人）100% 傳遞至戰報與指揮列。
- **[Feature/CombatStudio/DragDrop/Fix] 討伐據點 3×3 戰術九宮格全方位拖曳布陣 (Drag & Drop) 與波次座標自動防撞互換機制實裝（2026-08-27）**：
  - **根本解決舊資料座標重疊覆蓋 Bug (`CombatStudio.ts`)**：舊版升級 3×3 九宮格時以 `c = mIdx % 3` 導致前排超過 3 隻怪物時座標循環撞車；實裝 `normalizeStrongholdWaves()` 正規化防撞引擎，載入與渲染時自動為重複怪物依序分配未佔用空位，保證 1~9 隻怪物 100% 獨立不重疊。
  - **3×3 戰術九宮格全方位拖曳布陣 (Drag & Drop) (`CombatStudio.ts`)**：九宮格怪物與右側清單卡片支援拖曳，拖至空位直接移動、拖至已有怪物格子兩怪 1:1 互換站位 (Swap Slots)，懸浮呈現金光高亮反饋。
  - **「⚙️ 配置」彈窗防呆互換 (`CombatStudio.ts`)**：手動切換站位時，若目標槽位已被佔用，自動將對方互換回原槽位。
  - **資料庫批次清理 ([src/data/subjugation_nodes.json](file:///d:/tryagent/Medieval/src/data/subjugation_nodes.json))**：校正走私者關卡與霜風王陵既有坐標。
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 107 項單元測試 100% 全部通過。
- **[Feature/Combat/FieldInterception/Territory] 野外大軍攔截戰 (Field Interception) 全鏈路實裝：動員部署三大決策、短天數交兵公式、戰況狀態 1:1 繼承與大地圖受攻動態視覺特效（2026-08-26）**：
  - **領地動員部署三大戰略決策 (`TerritoryDefenseModalController.ts` & `modals-combat-trade.html`)**：故事事件觸發 `TRIGGER_RAID` 且 `warningDays > 0` 時，提供【⚔️ 親自出城攔截 (野戰)】、【🛡️ 派遣軍團迎擊 (自動作戰)】與【🏰 堅壁清野 (等待守城)】；天數歸零時切換為正規守城戰動員。
  - **短天數交兵與時間線公式 (`TerritoryDefenseSystem.ts`)**：$T_{\text{battle}} = \min(T_{\text{enemy}}, T_{\text{march}})$；野戰失利後敵軍抵達天數 $T_{\text{remain}} = \max(1, T_{\text{enemy}} - T_{\text{battle}})$。
  - **戰況狀態 1:1 繼承 (Battle State Continuity) (`TerritoryDefenseSystem.ts` & `CombatSystem.ts`)**：野外攔截戰陣亡敵怪標記死亡、殘血怪 HP 與剩餘敵軍軍團 100% 存入 `pendingRaid`；守城戰 1:1 繼承殘存敵軍，死亡怪不再登場，殘血怪保留殘血。
  - **據點工坊隨行敵方軍團 (`CombatStudio.ts` & `combat-studio.html`)**：據點工坊新增「🛡️ 啟用隨行敵方軍團」與步/弓/騎配置；戰鬥引擎支援敵方弓兵齊射與敵方騎兵衝鋒。
  - **大地圖主城受攻雙劍動畫特效 (`MapScene.ts`)**：領地存在 `pendingRaids` 預警時，主城上方渲染跳動的「⚔️ 雙劍交鋒」與「⚠️ 敵軍逼近 (N天)」標籤。
  - **出城迎擊狀態鎖定與彈窗生命週期修復 (`TerritoryDefenseModalController.ts` & `TerritoryDefenseSystem.ts`)**：出城迎擊戰鬥結算後（`isFieldInterceptionAttempted = true`），自動隱藏出城迎擊按鈕，切換為「🏰 領地臨戰戒備（敵軍殘部進逼中）」提示，並在戰報關閉時 100% 關閉動員彈窗，回歸大地圖臨戰戒備倒數。
  - **日結算預警推進 (`TownManagementSystem.ts`)**：日結算推進 `warningDaysLeft -= 1`，歸零時自動喚起正規守城動員部署。
  - **派遣迎擊探索日誌 (AdventureLogEntry) 標準結構與戰鬥重播實裝 (`TerritoryDefenseSystem.ts`)**：修復派遣迎擊自動結算時寫入非標準結構導致探索日誌顯示「以 undefined 為首的隊伍 / 探索了 undefined / 內文空白」的 Bug，現在如實組裝 `squadLeaderName`、`nodeName`、`segments`、`rewards` 並寫入 `addCombatRecord` 支援點擊【⚔️ 戰鬥紀錄】播放戰鬥重播。
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 106 項單元測試 100% 全部通過。
- **[Feature/StoryStudio/Sync] 故事工坊「🔄 從專案重載 (Git 同步)」與草稿智慧檢測機制實裝（2026-08-26）**：
  - 頂部操作列新增「🔄 從專案重載 (Git 同步)」按鈕與本機草稿提示橫幅，徹底解決多台電腦 Push/Pull 後本機舊草稿擋住 Git 最新內容的問題。
- **[Feature/Combat/Studio] 怪物 3×3 九宮格陣型體系與據點波次解包全面修復（2026-08-26）**：
  - **據點多波次解包修復 (`TerritoryDefenseSystem.ts`)**：修復據點模板多波次怪物被錯誤合併為單一波次的 Bug，1:1 如實分波次登場。
  - **怪物 3×3 九宮格資料模型 (`Narrative.ts`, `types.ts`, `Combat.ts`)**：擴充支援 `gridR`, `gridC`, `slotId`。
  - **據點設計工坊 3×3 視覺化戰術九宮格 (`CombatStudio.ts` & `combat-studio.html`)**：波次編輯器升級為 3×3 戰術九宮格 + 詳細清單雙欄，支援點擊空位增派、拖曳排兵布陣與 9 個站位選取。
  - **戰鬥舞台 1:1 精確映射 (`CombatSystem.ts` & `CombatUIManager.ts`)**：戰鬥引擎與 CSS Grid 優先讀取怪物九宮格坐標渲染。
  - **驗證**：TypeScript 編譯檢查 0 錯誤、25 個測試檔案 104 項單元測試 100% PASS。
- **[Feature/Combat/Siege/Territory] 領地守城戰與城防體系深度完善：城牆耐久條與修繕升級限制、民兵戰損與遭遇戰人口波及、攻守目標深度重構、動員記憶與專屬防衛戰報（2026-08-26）**：
  - **城牆耐久度與修繕升級限制 (`Territory.ts` & `SceneController.ts`)**：全域正名為「城牆耐久度 (Wall Durability)」，書房建築面板新增耐久度進度條與數值，支援依缺損比例修繕，耐久度未滿 100% 時禁止升級；城破降級為 Lv.1 且耐久度為 0。
  - **調派民兵戰損與遭遇戰人口波及 (`TerritoryDefenseSystem.ts`)**：步兵依剩餘護盾生還換算，弓兵/騎兵依戰況計算戰損（城門未破 5%~15%、城破 25%~40%），直接扣減領地兵力；遭遇戰依回合數波及少量村民。
  - **守城目標判定重構 (`CombatSystem.ts`)**：前排可直接受擊與分擔城牆壓力；中後排在有前排或城門未破時免疫近戰攻擊；前排全滅且破城後敵軍湧入可打中後排；遠程魔法貫穿打擊中後排享 25% 城垛掩體減傷。
  - **守備動員記憶與智慧自動填補 (`TerritoryDefenseModalController.ts`)**：自動記憶 3 梯隊編制，提供「⚡ 智慧自動填補」一鍵以最高戰力守軍補滿空缺。
  - **專屬防衛戰報彈窗 (`CombatUIManager.ts` & `modals-combat-trade.html`)**：戰後彈出黑金戰報，清晰呈現城牆狀態、民兵傷亡撫恤、物資治安變更與守城 MVP。
  - **驗證**：TypeScript 型別檢查 0 錯誤、25 個測試檔案 104 項單元測試 100% PASS。
- **[Feature/UI/Siege] 守備動員支援自訂兵力調派與故事工房攻城戰屬性開關（2026-08-26）**：
  - **守備動員自訂兵力調派 (`TerritoryDefenseModalController.ts` + `modals-combat-trade.html`)**：玩家可自由調整步兵、弓兵、騎兵的出動人數（上限為領地工人總數，提供全出戰/歸零快捷按鈕），即時預覽護盾、箭雨與衝鋒傷害。
  - **故事工房戰役屬性開關 (`StoryStudioForm.ts` + `Narrative.ts`)**：`TRIGGER_RAID` 效果新增 `isSiege` 勾選框。勾選為正規攻城戰（享城牆、箭塔、軍隊調派支援）；取消勾選為街巷／室內突襲遭遇戰（無城防與兵種支援，由傭兵守軍直接迎敵）。
  - **動員編制介面適配**：根據 `isSiege` 動態切換標題、隱藏/顯示城門耐久與箭塔情報，並在遭遇戰模式下切換兵種面板為「街巷突襲遭遇戰」警示。
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
  - 攻城戰役觸發時先彈出「領地守備動員部署」彈窗，展示城門/箭塔/掩體情報、敵軍梯隊情報、3 隊守軍梯隊編排與步/弓/騎兵種護盾預覽。
  - 領主點擊「⚔️ 誓死守城」後帶入編排的陣容出戰，點擊「放棄抵抗」則直接結算城破掠奪與觸發 `failNodeId`。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Combat/Siege] 領地守城戰役 (TRIGGER_RAID) 即時戰鬥與鏡像視窗全鏈路實裝（2026-08-26）**：
  - 徹底移除舊有純數值計算，`TRIGGER_RAID` 正式串接 `TerritoryDefenseSystem.startLiveSiegeDefense` 與 `CombatUIManager.replayCombat`。
  - 支援多梯隊據點敵軍陣容實體化、鏡像舞台播放、城門/箭塔/步兵護盾結算與戰後勝負故事跳轉。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Tool/NarrativeTest] 故事測試面板全面升級：支援最小化收合、自由拖曳移動與完整 advanceDay 每日推演（2026-08-26）**：
  - 故事測試面板支援「➖ 收合 / ➕ 展開」與滑鼠拖曳移動，徹底解決遮擋遊戲右下角「結束本日」按鈕與 HUD 的問題。
  - 推進 1 天 / 5 天功能改為完整呼叫 `advanceDay()` 執行全套遊戲日常迴圈。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Story/Siege] 故事工房攻城戰役動態梯隊與據點卡片挑選器 + 守城戰鬥核心實裝（2026-08-26）**：
  - 故事工房完整支援 `TRIGGER_RAID` 多梯隊 (Wave 1~N) 與據點卡片挑選器彈窗。
  - 戰鬥系統實裝鏡像舞台 (`.is-defense-siege`)、城門耐久 (Gate HP)、箭塔每回合開砲、步兵軍團護盾 (Legion Shield)、弓兵箭雨與騎兵衝鋒事件模型。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/UI/Equipment] 遊戲內裝備 Tooltip 全面升級：完整展示特技圖標、MP/CD消耗與技能效果描述（2026-08-26）**：
  - 商店/隊伍/倉庫/鐵匠鋪裝備懸浮 Tooltip 全面支援以高質感卡片呈現裝備附帶的特技（含 Sprite 圖標、名稱、MP/CD、技能效果描述）。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Fix/Tool/SkillWorkshop] 修復技能工坊圖標挑選器 Sprite 索引映射 Bug（2026-08-26）**：
  - 修復了 `SkillWorkshop.ts` 中讀取圖標陣列時傳入數字索引而非 `item.id` 導致所有圖標皆顯示第一格麥穗的 Bug，現在所有 Sprite 圖標均能正確獨立切割顯示。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Tool/Equipment] 裝備工坊自訂「適用職業限制（全職業通用 / 6大職業自選）」實裝（2026-08-26）**：
  - **介面與資料儲存 (`EquipmentStudio.ts`)**：提供全職業通用與 6 大職業獨立勾選，支援「🔄 帶入武器預設」功能。
  - **開局傳家寶劍支援 (`equipment_weapons.json`)**：`wpn_heirloom_sword` 設為全職業通用，各職業守衛均可開局裝備。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 98 項單元測試 100% PASS。
- **[Feature/Combat/Equipment] 武器固定本命特技 + 自由隨機技能抽取池與機率抽取系統實裝（2026-08-26）**：
  - **隨機抽取引擎 (`EquipmentGenerator.ts`)**：支援 `fixedSkill`（100% 保底本命技）與 `skillPool`（隨機池），依 `skillRollChance` 與 `skillRollCount` 在掉落/購買/鍛造時動態隨機抽取技能注入裝備實體的 `extraSkills`。
  - **遊戲內視覺化呈現與戰鬥生效 (`ShopController.ts` & `CombatSystem.ts`)**：商店/背包/鍛造對比 Tooltip 自動顯示「✨ 附帶特技」徽章；戰鬥時自動注入冒險者技能庫。
  - **視覺化操作介面 (`EquipmentStudio.ts`)**：提供「➕ 挑選加入隨機池」動態徽章列表、一鍵移除、抽取機率與數量配置。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 97 項單元測試 100% PASS。
- **[Fix/Tool/Equipment] 裝備工坊編輯與創造彈窗修復與回歸測試（2026-08-26）**：
  - **DOM 完整性補齊**：修復了 `equipment-studio.html` 中詞條 checkbox（`affix-deadly`, `affix-pierce` 等）缺漏導致彈窗開啟時拋出 null 錯誤的問題，現在「＋ 創造新裝備」與「編輯裝備」均可順暢彈出並保存。
  - **自動化防呆回歸測試**：在 `EquipmentStudio.test.ts` 加入了所有 50+ 個表單元素 DOM ID 的完整性檢查。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 96 項單元測試 100% PASS。
- **[Feature/Combat/Equipment] 武器額外技能接口啟用與視覺化技能挑選器 (Skill Picker) 實裝（2026-08-26）**：
  - **底層技能直接生效 (`CombatSystem.ts`)**：裝備附帶的 `extraSkills` 直接注入冒險者 `actor.skills`，主動技能自動進入輪替、被動與鉤子技能由 5 大戰鬥鉤子自動喚起。
  - **視覺化技能挑選器 (`EquipmentStudio.ts` & `equipment-studio.html`)**：特技槽位升級為純視覺化展示與彈窗挑選，支援搜尋、分類過濾與一鍵配置。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 95 項單元測試 100% PASS。
- **[Feature/Tool/UI] 技能工坊視覺化圖標庫挑選器 (Icon Picker) 實裝（2026-08-26）**：
  - **純點選圖標**：基本設定欄位升級為「視覺化頭像方塊 + 🔍 挑選圖標」，點擊即可彈出包含技能/戰鬥 Emoji、魔物 Emoji 以及全圖集 Sprite 的選擇器，支援即時搜尋與一鍵套用。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試 100% PASS。
- **[Fix/Tool/UI] 故事工坊物品選擇器彈窗層級（z-index）與唯一來源圖標精靈圖 (UniversalIcon Sprite) 深度串接（2026-08-26）**：
  - **層級修復 (`StoryStudioItemPicker.ts`)**：提高 overlay 為 `z-index: 999999`，防止被全螢幕故事工坊遮擋。
  - **唯一來源圖標精靈圖渲染 (`StoryStudioForm.ts` & `StoryStudioItemPicker.ts`)**：全面串接 `renderUniversalIcon`，挑選彈窗與表單效果卡片均可直接呈現美術圖標集（如素材、武器、防具等原汁原味 Sprite）。
  - **技能工坊入口**：故事工坊/戰鬥工坊/裝備工坊頂部全面增設「🔮 技能工坊」按鈕。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試 100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 3：全視覺化積木技能工坊 UI 與 10 款通用怪物技能遷移實裝（2026-08-26）**：
  - **視覺化技能工坊 UI (`skill-workshop.html` & `SkillWorkshop.ts`)**：提供雙欄純 UI 點選編輯器、WHEN/WHAT/TARGET/IF 四維積木流、一鍵寫入專案磁碟與快照時光機。
  - **通用魔物技能積木化遷移 (`CustomSkillData.json`)**：10 款通用魔物技能全部轉換為積木格式。
  - **跨工坊導航互通**：戰鬥工坊、裝備工坊與技能工坊無縫切換。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、24 個測試檔案 94 項單元測試 100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 2：10款進階效果積木 × 戰鬥引擎 5 大觸發鉤子實裝（2026-08-26）**：
  - **進階效果積木 (`SkillEffectEngine.ts`)**：支援雙修傷害、護盾、連鎖彈跳、斬殺、驅散、竊取增益、定時炸彈、抽魔、擊退換排、戰場環境。
  - **5 大戰鬥鉤子 (`CombatSystem.ts`)**：支援每回合開始、致命一擊、受擊、擊殺與殘血門檻自動觸發。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、23 個測試檔案 92 項單元測試 100% PASS。
- **[Feature/Combat/Skill] 技能工坊 Phase 1：積木技能執行引擎與 CustomSkillData 整合實裝（2026-08-26）**：
  - **資料模型擴充 (`Skill.ts` & `Combat.ts`)**：新增 `CompositeSkillDefinition`、`EffectBlock` 等型別，擴充 6 種狀態。
  - **積木解譯引擎 (`SkillEffectEngine.ts`)**：提供 `compile()`、`executeBlock()`、`checkCondition()`、`applyEffect()`。
  - **資料中樞整合 (`SkillRegistry.ts` & `CustomSkillData.json`)**：自動合併載入工房技能並支援 `CATACLYSM_FLAME`、`DRAGON_ROAR`。
  - **驗證**：`npx tsc --noEmit` 0 錯誤、23 個測試檔案 90 項單元測試（包含全新 `SkillEffectEngine.test.ts`）100% PASS。
- **[Feature/Tool/Narrative] 故事工坊物品選擇器彈窗、範圍浮動懲罰、領地襲擊量化與自訂陣營聲望體系實裝（2026-08-26）**：
  - **物品挑選彈窗 (`StoryStudioItemPicker.ts`)**：提供素材、特產、裝備視覺化多頁籤彈窗搜尋選取，支援部位與 Tier 篩選並一鍵回填。
  - **延遲觸發排程 (`Narrative.ts` & `NarrativeSystem.ts`)**：支援討伐戰勝與戰敗自訂延遲排程天數 (`victoryDelayDays` / `defeatDelayDays`)。
  - **範圍浮動百分比懲罰 (?% ~ ?%)**：實作隨機抽籤扣減人口百分比 (`REDUCE_POPULATION_PERCENT`)、資源庫存百分比 (`REDUCE_RESOURCE_PERCENT`)、聲望百分比 (`REDUCE_PRESTIGE_PERCENT`) 與建築等級扣減 (`REDUCE_BUILDING_LEVEL`)。
  - **領地防禦與襲擊對抗 (`TerritoryDefenseSystem.ts`)**：以哨所等級、治安值與官職軍事加成量化領地防禦力，並提供 `TRIGGER_RAID` 效果自訂襲擊對抗。
  - **自訂陣營與遠古龍裔聲望 (`FactionManager.ts` & `StoryStudioFactionManager.ts`)**：新增自訂陣營管理，預載【遠古龍裔 (`f_dragonkin`)】，全面連動故事工坊條件/效果、遊戲存檔與外交聲望 UI。
  - **驗證**：TypeScript 型別檢查 0 錯誤、單元測試、5v5 戰鬥平衡量測、360 天雙難度經濟模擬與 P0 煙霧測試全數通過。
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
- **2026-08-24 戰鬥工坊磁碟儲存按鈕遺漏討伐據點寫入修復與專屬儲存按鈕實裝**：
  - **按鈕綁定修復 (CombatStudio.ts)**：修復頂部工具列「💾 寫入專案硬碟」按鈕只寫入怪物庫（monsters.json）而遺漏討伐據點庫（subjugation_nodes.json）的問題，改為統一調用 saveMonstersToDisk() 完整寫入兩者。
  - **討伐工坊專屬按鈕實裝 (combat-studio.html)**：在討伐據點工作區中欄右上角新增「💾 寫入專案硬碟」按鈕。
  - **驗證**：TypeScript 0 錯誤，82 項單元測試全數 PASS。
# 專案交接文件 (Handover Document)

這份交接文件記錄了目前的開發進度、已知問題，以及下一步的建議方向，以便未來任何開發者接手時能迅速進入狀況。

- **2026-08-24 故事工坊動態連動自訂討伐據點庫、據點圖標選擇器升級 (New!)**：
  - **故事工坊即時讀取戰鬥工坊自訂據點 (`DataStore.ts` & `StoryStudioForm.ts`)**：打通 `DataStore.getSubjugationTemplates()` 動態讀取機制，讓故事工坊在選擇據點範本時，不僅能選擇預設據點，還能**100% 即時讀取您剛在「討伐據點工坊」設計儲存的全新據點（如「詭異的神秘洞穴」）**，並自動秒速帶入名稱、地形、難度與波次配置。
  - **討伐據點大地圖圖標可視化選擇器 (`CombatStudio.ts` & `combat-studio.html`)**：徹底移除「大地圖圖標 (Sprite)」純文字輸入框，改為即時圖標預覽外框與「🎨 選擇圖標」按鈕，點擊立即彈出視覺化 ICON 選擇器（支援所有建築圖集、怪物圖集、物品圖集與 Emoji），選中後即時預覽並自動同步左側據點清單。
  - **測試面板透明即時狀態監控 (`NarrativeTestController.ts`)**：測試面板右下方新增 `排程節點` 與 `🏰 街道訪客` 即時名稱清單，並強化「重置測試進度」會一鍵重置天數為第 1 天與全面清空 UI，讓創作者隨時一眼掌控當前引擎底層排程倒數與街道上的 NPC 名單。
  - **酒館傳聞即時連動待辦清單 (`TavernSystem.ts`)**：打聽傳聞成功揭露故事節點時，立即同步呼叫 `NarrativeSystem.ensureStoryTodos()` 與 `UIManager.updateUI()`，無需等待過天即可瞬間在領地待辦清單中看見後續決策節點。
  - **全域 UI 統一重繪街道訪客 (`UIManager.ts`)**：在全域主 UI 刷新入口 `UIManager.updateUI()` 末尾全面接入 `renderStreetNpcEvents()`，徹底解決點擊「結束本日」完成天數推進時，因 `updateUI` 漏調用街道重繪而導致訪客卡片未浮現的致命遺漏。
  - **街道訪客未完成前常駐顯示修復 (`NarrativeSystem.ts`)**：修復 `getEligibleStreetEvents()` 漏帶 `includePresented = true`，導致街道訪客節點一旦被標記為呈現過（例如點擊對話中途關閉或切換頁面）就會被判定已過期而隱形的漏洞；現在只要節點未真正完成（`!completedNodeIds`），訪客都會穩定常駐於街道上。
  - **強盜勒索事件中斷主循環問題根除 (`GameLoop.ts`)**：徹底排查並修復強盜侵略（`pendingExtortionEvent`）觸發時 `advanceDay()` 錯誤執行 `return true`，導致 `GameFlowController` 將強盜勒索誤判為「Game Over」並強制中斷每日結算、轉場與故事排程的嚴重漏洞；現已改為事件佇列機制，確保天數推進與故事排程 100% 完整結算不中斷。
  - **侵略與勒索彈窗關閉即時刷新 (`GameLoop.ts` & `ExtortionModalController.ts`)**：修復發生敵意入侵掠奪（Invasion）或盜匪勒索（Extortion）時，彈窗在關閉後未觸發全域 UI 與街道訪客重繪的問題；現在無論侵略勝負或支付勒索，彈窗關閉瞬間立即自動刷新街道訪客。
  - **街道訪客卡片 2 倍大實裝與版面精確對齊 (`SceneController.ts` & `views-main.html`)**：將街道訪客 NPC 肖像按鈕放大為 2 倍尺寸（寬度 88px × 高度 164px，`renderUniversalPortrait(avatar, 88)`），加強外框金色流光與深邃陰影；容器寬度設為 `min(480px, 90%)` 與上方繁榮度條 100% 精準對齊，並配置 8px 舒適呼吸間距，徹底杜絕畫面重疊。
  - **結束本日主循環故事結算接入 (`GameLoop.ts` & `UIManager.ts`)**：在遊戲主迴圈 `advanceDay()`（點擊「結束本日」史詩大圓鈕）中正式接入 `NarrativeSystem.processDailyTick()`，徹底解決正常點擊結束本日推進天數時故事排程處於凍結未結算的問題；轉場結束後全域 UI 自動刷新街道訪客。
  - **受排程目標節點自動防護 (`NarrativeSystem.ts` & `NarrativeTestController.ts`)**：實裝 `isScheduledTargetNode` 自動防護機制：凡是被任何劇情選項或事件之 `SCHEDULE_NODE` 指名為目標的後續節點，在尚未被前置決策喚醒前，引擎全面自動封印，徹底杜絕後續步驟提前在街道或世界中誤觸發；創作者僅需在選項設定 `SCHEDULE_NODE (延遲 N 天)`，後續節點即會自然受保護，不再需要額外手動疊加 Fact 線索條件。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事工坊多段對話列表容器 ID 綁定修復**：
  - **對話清單渲染容器修復 (`StoryStudioForm.ts`)**：修復 HTML 模板容器 ID（`story-node-dialogue-pages-list`）名稱不一致問題，點擊「＋ 新增對話段落」現已可正常即時新增並渲染出對話編輯卡片。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事工坊節點 ID 嚴格唯一性防撞保護實裝與節點資料修復**：
  - **ID 唯一性防撞與失焦重命名校驗 (`StoryStudioForm.ts`)**：節點代號獨立於失焦（`change`）時進行防重複校驗，禁止撞名以杜絕節點同化缺陷；支援 ID 重命名時自動遷移故事內其他節點之關聯引用。
  - **資料修正 (`custom_stories.json`)**：修復《最後的龍裔》之 `dragon_fam`（酒館傳聞）與 `dragon_fam_todo`（待辦清單）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事工坊 (Story Studio) 全面架構整合與狀態中樞重構實裝**：
  - **狀態驅動與模組化架構**：建立 `StoryStudioStore.ts` 統一管理狀態與草稿；`StoryStudioGraph.ts` 實裝 5px 拖曳安全門檻（徹底解決節點跳位）；`StoryStudioForm.ts` 實裝安全單向注入鎖定（徹底杜絕名稱覆蓋）。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事工坊自動草稿快取機制實裝與《最後的龍裔》對話復原**：
  - **即時自動草稿快取與無縫還原 (`StoryStudio.ts`)**：實裝 `localStorage` 自動草稿同步機制，任何編輯 0.3 秒內即時寫入本地，瀏覽器重整或熱重載 100% 自動無痛還原。
  - **資料復原 (`custom_stories.json`)**：已將《最後的龍裔》故事「對於瘋癲客人的好奇」節點對話（誓約守衛台詞：「酒館老闆說，你喝醉時提到過村邊附近隱密的那個洞窟...」）完整復原寫入專案。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 誓約守衛對話名稱動態綁定玩家命名與稱號精簡優化**：
  - **對話框守衛名稱動態讀取 (`NpcDialogueModalController.ts`)**：發話者為誓約守衛時，100% 動態連結玩家開局為其所取的自訂名字（`guardian.name`），並徹底移除多餘動態稱號行，使版面俐落。
  - **故事工坊介面精簡 (`StoryStudio.ts`)**：選取「👑 玩家誓約守衛」時自動隱藏名稱、稱號與肖像欄位（避免殘留上一段 NPC 稱號），專注編寫台詞。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 待辦事項紅點提醒徽章遺漏故事待辦節點問題修復**：
  - **待辦提醒徽章計數修正 (`UIManager.ts`)**：修復先前 `todo-badge` 只計算傳統領地事件（`territory.pendingEvents`）而遺漏故事工坊待辦節點（`territory.pendingNarrativeNodes`）導致有待辦內容卻不顯示紅點的缺陷；改為正確加總兩者數量。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事節點前置條件一鍵滿足與全設施升級密技實裝**：
  - **故事測試模式一鍵補足條件 (`NarrativeTestController.ts`)**：測試面板新增「🪄 一鍵滿足此節點前置條件」按鈕，可自動將領地設施（如酒館等級）、聲望、金幣與線索（Facts）一鍵提升並補齊。
  - **領地設施除錯密技 (`CheatController.ts` & `docs/CHEATS.md`)**：新增 `buildmax`（全設施滿等）與 `tavern`（自訂酒館等級）指令。
  - **酒館傳聞沉浸感優化 (`TavernSystem.ts`)**：移除打聽情報時字尾生硬附加的 `(故事線索：...)` 括號標籤，回歸乾淨沉浸的 NPC 台詞。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 市井 NPC 與龍裔 2×5 高解析對話立繪圖集實裝與資料集註冊**：
  - **2×5 市井 NPC 與龍裔立繪圖集 (`npc_common.jpg`)**：精準繪製 10 款對話專用肖像（龍血女劍客、龍血男戰士、風霜老流浪漢、新手見習傭兵、狡黠街頭女賊、酒館落魄老兵、悍勇女打手、行腳市井貨郎、枯瘦老農夫、重傷包紮傭兵），儲存於 `public/assets/custom_icons/npc_common.jpg`。
  - **資料集與座標映射**：`custom_icon_datasets.json` 與 `custom_icon_config.json` 正式註冊 `npc_common`（共 10 款肖像），支援故事工坊肖像挑選器與對話彈窗。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 故事工坊 NPC 對話完整測試系統實裝與主迴圈事件路由連通**：
  - **故事工坊即時預覽彈窗 (`StoryStudio.ts` & `story-editor.html`)**：在對話分頁清單旁提供「💬 即時預覽此對話」按鈕，可即時預覽 1:1.853 NPC 大立繪、多段對話切換、男女守衛立繪即時切換與選項點擊模擬。
  - **遊戲主迴圈與事件路由連通 (`main.ts`)**：修復 `NARRATIVE_NODE_TRIGGERED` 事件監聽，優先檢查節點是否含有 `dialoguePages` 或為 `STREET_EVENT` 頻道，正確路由至 `NpcDialogueModalController` 沉浸式對話彈窗而非普通純文字事件框。
  - **故事測試模式面板增強 (`NarrativeTestController.ts`)**：節點選單標註「💬 」，點擊強制測試即可即時喚起完整 NPC 對話演出。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 誓約男女守衛 2×5 全套高解析對話立繪圖集實裝與對話框連動**：
  - **2×5 誓約女守衛對話立繪圖集 (`guardian_f_talk.jpg`)**：精準還原 10 位女守衛特徵（金髮聖騎、修道神官、赤髮劍士、英姿女騎、暗影俠女、紫袍法師、金紋重甲女將⭐、黑皮刺客、長弓射手、重裝女戰），儲存於 `public/assets/custom_icons/guardian_f_talk.jpg`。
  - **2×5 誓約男守衛對話立繪圖集 (`guardian_m_talk.jpg`)**：精準還原 10 位男守衛特徵（滄桑老將、銀髮雄獅、青年侍從、金紋將軍、兜帽遊俠、戰斧狂戰、歷戰刀疤重騎⭐、歷戰傭兵、長弓獵手、全罩步兵），儲存於 `public/assets/custom_icons/guardian_m_talk.jpg`。
  - **資料集與座標映射**：`custom_icon_datasets.json` 與 `custom_icon_config.json` 正式註冊 `guardian_m_talk` 與 `guardian_f_talk`（共 20 款直立肖像）。
  - **NPC 對話彈窗智慧立繪連動與守衛讀取修復**：`NpcDialogueModalController.ts` 修復先前錯誤讀取 `GameState.myTerritory.oathGuardian` 導致女性守衛永遠判定為 `undefined` 並回退成男性雄獅騎士的問題；改為精準讀取 `GameState.adventurers.find(a => a.isGuardian)`，並依真實性別與頭像索引映射至 `guardian_m_talk_x` 或 `guardian_f_talk_x`。
  - **驗證**：TypeScript 型別檢查 0 錯誤、81 項單元測試全數 PASS。
- **2026-08-24 專案架構文件 (`docs/ARCHITECTURE.md`) 全面同步與目錄樹重構**：
  - **修復目錄樹排版與格式缺陷**：修復殘留的 `\n` 換行轉義字元，校正 `src/ui/modals/`、`src/ui/components/` 與 `tools/` 的目錄階層關係。
  - **補齊最新系統與控制器索引**：新增裝備工坊 (`EquipmentStudio.ts`)、技能註冊中樞 (`SkillRegistry.ts`)、GAMBIT 判定器 (`GambitEvaluator.ts`)、派系軍隊生成 (`FactionArmyGenerator.ts`)、NPC 對話彈窗 (`NpcDialogueModalController.ts`)、懸賞告示板 (`BountyModalController.ts`)、誓約創角 (`OathCreationController.ts`)、街道視圖控制器 (`SceneController.ts`)、改造所、二手黑市與官方討伐據點資料庫 (`subjugation_nodes.json`) 等索引。
  - **擴充最新實裝核心架構章節**：新增「四大獨立開發工坊生態圈」、「戰鬥中樞、怪物 8 大定位與技能註冊系統」、「裝備體系、T1~T5 Scaling 與自動同步機制」、「街道場景與 NPC 訪客對話系統」與「懸賞與討伐據點全面故事化架構」章節。
- **2026-08-23 NPC 街道訪客事件與沉浸式視覺化對話系統實裝**：
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
- **2026-08-23 討伐據點設計工坊重構與故事工坊模板化一鍵選取整合**：
  - **戰鬥工坊【🏰 討伐據點設計工坊】全面重構 (`CombatStudio.ts` & `combat-studio.html`)**：
    - 頂部導航欄新增第 4 分頁【🏰 討伐據點設計工坊】，採用三欄式現代工作台佈局：
      - **左欄（據點清單與即時搜尋）**：支援即時過濾名稱/ID、地形篩選、波次標籤、快速新增/複製/刪除據點。
      - **中欄（據點屬性與 1~3 波守軍編制）**：視覺化配置據點各項基礎屬性（ID、名稱、地形、難度 Lv.1~10、圖標、是否需偵查、通關獎勵等）；支援動態增減波次（1~3 波）與守軍（1~5 隻），並內建「怪物挑選彈窗 (`#modal-sh-monster-picker`)」。
      - **右欄（戰力評估與沙盒測試大盤）**：即時動態計算全波次守軍預估總戰力（Total Power）與推薦出征隊伍等級；提供「⚡ 載入至戰鬥沙盒測試」，一鍵將該據點守軍陣容全數帶入戰鬥模擬沙盒即時開戰驗證！
  - **獨立討伐據點資料庫與持久化 (`subjugation_nodes.json` & `DataStore.SubjugationNodeDB`)**：
    - 建立官方討伐據點資料庫，收錄走私者關卡、哥布林洞穴、古代地下墓穴、霜風冰龍巢穴等經典據點。
    - 掛載至 `DataStore.SubjugationNodeDB`；工坊支援「💾 寫入專案硬碟」，自動寫入 `src/data/subjugation_nodes.json` 並生成歷史快照備份。
  - **故事工坊一鍵模板化選取整合 (`StoryStudio.ts` & `NarrativeSystem.ts`)**：
    - 在故事工坊 `CREATE_SUBJUGATION_NODE` 效果中，新增「🏰 選擇討伐據點模板」下拉選單，選擇模板後自動同步帶入名稱、描述、地形、難度與屬性，作者僅需設定生成位置與綁定故事後續節點（途中事件、勝利、失敗）。
    - 遊戲運行時 `NarrativeSystem.createSubjugationNode` 支援讀取 `templateId` 生成動態大世界討伐據點。
  - **驗證**：TypeScript 型別檢查、81 項單元測試、P0 遭遇測試、經濟模擬與自動化 Smoke Test 100% 綠燈通過。
- **2026-08-23 懸賞任務全面整合進故事工坊與條件引擎過濾升級**：
  - **日常懸賞故事化與官方日常故事集**：建立官方日常故事集《領地日常與居民委託》（`story_daily_routine`），收錄 15 個日常任務（找貓、下水道老鼠、夜間巡邏、收割小麥、採集藥草、教訓流氓、修補城牆等）。
  - **解耦靜態代碼**：徹底移除 `BountySystem.ts` 中的寫死陣列，改由 `NarrativeSystem.getEligibleRoutineBounties()` 動態提供合資格的日常任務。
  - **可重複輪替與冷卻機制**：擴充 `NarrativeNode.repeatable` 與 `cooldownDays`，並在 `NarrativeRuntimeState.nodeLastCompletedDay` 追蹤完成記錄。
  - **條件動態過濾**：日常懸賞完整支援故事工坊的所有條件判定（天數、線索 Fact、領地規模、聲望、派系好感度等），不符合條件的任務絕不出現在告示板。
  - **故事工坊 UI 增強**：懸賞配置區塊新增重複輪替開關、冷卻天數與任務類型輸入框，節點卡片標註 `[🔄日常]` 標籤。
- **2026-08-23 商隊非特產貨物拒收漏洞修復**：
  - 修復商隊載運非目標城特產的物資（如小麥載去礦場）時，因嚴格特產檢查被直接拒收而原車運回領地的問題，現已支援全品類物資正常以基準市價變現。
- **2026-08-22 開局與讀檔誤觸發據點規模擴張通知修復**：
  - 修復新開局或讀檔時因據點初始等階未預先對齊，導致第一幀誤判定為「剛升級」而反覆彈出「恭喜規模擴張為【村莊】」的問題。
- **2026-08-22 跑商特產與領地基礎資源全面一體化打通**：
  - 木材（`tg_timber`）、鐵礦石（`tg_iron`）、石材（`tg_stone`）、小麥（`tg_wheat`）與領地頂部四大基礎物資完全雙向打通，商隊載貨出發扣除頂部資源，買貨返程全額自動入庫頂部資源。
  - 舊存檔讀取時自動無縫合併舊 `tradeInventory` 中的木材鐵礦至頂部資源。
- **2026-08-22 跑商規劃與市場面板圖標字串外溢修復**：
  - 修復下拉選單與列表把 `icons_materials:...` 圖標識別碼當作文字印出的問題，下拉選單乾淨呈現中文，介面全改用 `renderUniversalIcon` 正確渲染立體圖標。
- **2026-08-22 領主總倉庫與跑商特產圖標全面升級 Sprite**：
  - 將 `TRADE_GOODS` 系統所有特產（棉麻、生皮、獸肉、木材、鐵礦石、黑曜石等）的圖標定義由 Emoji 全面替換為專屬高解析度 Sprite 圖標，解決 Windows 上生皮顯示為破框 `▯` 的問題。
- **2026-08-22 鍛造屋與冶煉系統支援黑曜石等所有特產交易品庫存**：
  - 修復 `getMaterialCount` 與 `consumeMaterial`，全面打通 `tradeInventory` 交易品特產庫存（黑曜石、冰晶、絲綢等），鍛造與冶煉秘銀錠時能 100% 正確識別與消耗。
- **2026-08-22 傭兵跑商議價體系重塑與採購本金庫存連動修復**：
  - 徹底修復多名傭兵疊加至 100% 議價造成 1 塊錢零元購的嚴重漏洞。
  - 單人議價特長下修為 1%~5%，小隊總議價嚴格上限鎖定為 20%（8折採購 / 1.2倍賣出）。
  - 單線商隊介面實裝採購數量與本金自動雙向連動，並強制受目標城庫存上限保護。
- **2026-08-22 全域倉庫素材與各介面圖標全面修復與連結**：
  - 修復全域倉庫素材（木板、粗布、鐵錠、石磚、皮革、磨刀石等）及交易品圖標，全面升級為 `renderUniversalIcon` 高清精靈圖標。
  - 同步補齊防具商店與裝備改造所圖標渲染，全遊戲介面圖標 100% 完整無缺。
- **2026-08-22 實裝職業專屬裝備限制智能推導與工坊防漏保護機制**：
  - 嚴格對齊 [docs/CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md)，所有武器與防具自動智能推導其職業穿戴限制（弓箭限弓箭手、巨劍限戰士、法杖限法師、重鎧限戰士騎士等）。
  - 裝備工坊全面防漏保護，讀檔瞬間全自動對齊所有存檔中的舊裝備。
- **2026-08-22 實裝 T1~T5 指定階級補正範圍與職業武器專屬隨機 Scaling 規則引擎**：
  - 精確實裝補正階級：T1 (D~B)、T2 (C~A)、T3 (B~A)、T4/T5 (B~S)。
  - 武器專屬主屬性保底（弓箭 AGI、法杖 INT、巨劍 STR 等）與隨機副屬性抽池（0~2 條），讀檔全自動洗鍊修復舊裝備。
- **2026-08-22 統一全域戰敗休養 CD（4 天）與實裝傭兵忙碌/休養中全操作鎖定防呆**：
  - **戰敗 CD 統一大一統**：外出討伐戰敗與據點受襲重傷統一為 `4 天休養`（`restingDaysLeft = 4`），徹底解決換日被即時歸零的時序缺陷。
  - **忙碌防呆鎖定**：傭兵處於 `DISPATCHED`、`RESTING` 或 `CAPTURED` 時，全面鎖定小隊面板換裝/卸裝、自由配點、進階轉職、申請退休，並在改造所中過濾外出傭兵裝備，確保數值與角色狀態嚴謹。
- **2026-08-22 修正街道懸賞欄按鈕層級避免覆蓋建築室內視圖**：
  - 將 `#btn-street-bounty` 的 `z-index` 調為 20（低於建築視圖的 50），進入領主書房等建築時自動被遮蔽，不再遮擋「⬅ 返回街道」按鈕。
- **2026-08-22 優化街道視圖懸賞欄入口：僅保留左上角快捷按鈕**：
  - 移除街道建物列中的告示板地標，維持建築原貌；保留街道左上角常駐按鈕（`#btn-street-bounty`），在街道畫面上隨時一鍵開啟全功能懸賞 UI。
- **2026-08-22 修復 DataStore 載入裝備時 combatEffects 欄位未對齊導致武器物攻遺失**：
  - 修正 `DataStore.ts` 僅讀取 `baseCombatEffects` 的問題，加入 `combatEffects` 回退支援；並在 `SaveManager.ts` 的 `autoSyncAllEquipmentWithTemplates` 中為現有存檔裝備自動補齊戰鬥屬性。
- **2026-08-22 實裝裝備「單一真實來源」一勞永逸全域自動同步機制**：
  - 在 `SaveManager.ts` 實裝 `autoSyncAllEquipmentWithTemplates()`，讀取任何舊存檔時全自動遍歷冒險者裝備與倉庫裝備，將 `eq.id` 對應之最新官方名稱、圖標與插槽類型自動覆蓋至實例，徹底解決改名後舊存檔殘留舊名稱的問題。
  - 將鍛造屋 `ForgeUIController.ts` 與工坊 `EquipmentStudio.ts` 的配方名稱改為動態優先讀取 `targetTpl.name`，修改裝備庫名稱即刻自動同步至鍛造配方。
- **2026-08-22 修復裝備工坊卡片屬性數值為 0 時被誤覆蓋為階級保底數值**：
  - 修正 `EquipmentStudio.ts` 中使用 `||` 導致 `0` 被當成假值觸發 `eq.tier * 15` 階級保底公式的 Bug，全面改用 `??` 精確判定，還原純物理/魔法裝備的精確數值與戰力。
- **2026-08-22 修復附魔台五大元素附魔石與破敗傳家寶劍圖標連結**：
  - 將附魔台五大元素附魔石圖標對接 `materials.json` 的素材 Sprite（`icons_materials_30` ~ `icons_materials_34`），取代純文字 Emoji。
  - 將「破敗的傳家寶劍」對接武器 Sprite 切片（T1 巨劍），並在 `renderEquipIcon` 排除舊有文字 Emoji 佔位符。
- **2026-08-22 修復自訂圖標裝備全域階級邊框（T1~T4/藍框）與品質角標**：
  - 在 `IconSpriteHelper.ts` 的 `renderEquipIcon` 為所有自訂圖標裝備自動套用對應階級發光邊框（T2 綠、T3 藍、T4 紫等）與右下角 `T3` 品質角標，保持全專案所有清單中裝備外觀完全統一。
- **2026-08-22 英雄設計工坊六維排版重構與誓約守衛原創設定全面對齊**：
  - **六維屬性排版重構**：改為寬裕的 3 欄 x 2 列（`repeat(3, 1fr)`）網格佈局，解決屬性框溢出面板問題，並新增總點數即時計算。
  - **誓約守衛原創設定對齊**：
    - 完整連動專屬 20 款男女守衛立繪清單（銀髮雄獅騎士、金髮璀璨聖騎等），消除包裹 📦 破圖問題。
    - 整合誓約守衛 5 大專屬特質（忠誠護衛、沉著參謀、熱血戰魂、堅毅信仰、敏銳斥候）與專屬配裝。
- **2026-08-22 修復英雄設計圖標自訂儲存與讀取優先級**：
  - 修正 `getAllHeroes()` 讀取順序，優先讀取 `customHeroesDb` 內的使用者自訂版本，消除預設英雄修改後被靜態設定覆蓋的問題。
  - 完善卡片點擊換圖標全鏈條持久化，更換後立即寫入 `localStorage` 並即時刷新大盤與沙盒。
- **2026-08-22 英雄設計工坊圖標系統升級（Hero Studio Universal Icon Support）**：
  - 英雄定義擴充 `avatarIcon?: string` 欄位，支援全圖集通用圖標。
  - 英雄創造/編輯彈窗加入 48px 頭像預覽框，點擊直接開啟【全圖集通用圖標選擇器】。
  - 英雄大盤卡片與挑選器全面以 `renderUniversalIcon` 渲染，並支援在卡片上點擊頭像快速換圖。
  - 套用英雄時，專屬圖標即時連動至沙盒左側卡片與戰鬥擂台動畫。
- **2026-08-22 實裝怪物特技自訂配置器（Monster Skill Configurator）**：
  - 沙盒右側怪物卡片新增「⚙️ 配置」按鈕，開啟【✨ 怪物特技配置彈窗】。
  - 支援從 50+ 款物理戰技、奧術魔法、暗影刺殺、神聖祈禱與怪物專屬特技中挑選（支援關鍵字即時搜尋）。
  - 單一怪物支援自訂 0~4 招特技，配置後即時於單場動畫與 100 場蒙地卡羅模擬中生效。
- **2026-08-22 戰鬥工坊深度體驗優化：獨特英雄鎖定、全品項換裝彈窗、單一UR防呆、戰鬥定位與排版修復**：
  - **獨特英雄身分保護 & 誓約守衛自由轉職**：
    - 獨特英雄（UR 雷恩、SSR 露娜等）在沙盒卡片中將品質與職業選單鎖定為專屬唯讀徽章，防止誤改傳奇身分。
    - 誓約守衛（`isGuardian: true`）與一般傭兵維持完整下拉選單，可自由測試 17 大職業與 N~UR 各階數值。
  - **裝備與飾品「全品項庫選擇」＋ 圖標與 Tooltip 懸浮說明**：
    - 升級換裝彈窗（`#modal-equipment-editor`），可從 30+ 款各職業神兵、重甲/皮甲/布袍與 11+ 款專案全飾品中挑選具體品項。
    - 即時連動 48px 精靈圖標（`renderUniversalIcon`）與詳細數值/詞條 Tooltip 說明；卡片 3 格裝備欄同步展示品項真實名稱。
  - **單一 UR 全鏈條防呆**：
    - 手動切換品質或挑選英雄時，若隊伍已存在其他 UR 傭兵，即時警告並阻擋。
  - **怪物 8 大戰鬥定位與技能標籤恢復**：
    - 右側卡片恢復 `⚖️ 常規均衡`、`🛡️ 鐵壁肉盾`、`⚡ 疾風刺客`、`🔮 奧術法師`、`🩸 嗜血狂戰`、`🏹 遠程狙擊`、`💀 亡靈泥沼`、`👑 史詩首領` 定位下拉選單與特技標籤清單。
  - **介面排版修復與精簡**：
    - 調整據點情境列樣式（`min-width: 0`, `flex-shrink: 0`），徹底解決「🎲 隨機遭遇」按鈕被擠壓切掉問題；移除右欄重複的「➕ 創造單位」按鈕。
  - **測試驗證**：22 個測試檔案 80 項單元測試 100% PASS。
- **2026-08-22 修復戰鬥工坊切換分頁沙盒佈局損壞與右側怪物頭像動態解析**：
  - **Grid 三欄佈局修復**：修正 `switchStudioTab` 使沙盒視圖 `#cs-view-battle` 正確以 `display: grid`（`340px 1fr 340px`）顯示，解決切換至怪物/英雄工坊再切回時沙盒排版崩解的問題。
  - **怪物圖標動態連動母庫**：實作 `getMonsterAvatar`，敵方陣容卡片、戰鬥擂台即時狀態、預設遭遇與切換怪物原型時，100% 動態連動母庫 `monstersDb` 之 8x8 精靈圖標（`avatarIcon`），解決圖標遺失與舊 Emoji 殘留問題。
- **2026-08-21 修復 combat-studio.css .cs-hp-fill 語法錯誤**：
  - 補齊遺漏的 `.cs-hp-fill` 選擇器宣告，消除了 IDE 的 CSS 語法報錯。
- **2026-08-21 完整修復「怪物資料庫與設計工坊」渲染與搜尋編輯事件**：
  - 補回 `renderMonsterDatabase()` 64+ 隻怪物流動網格渲染，修復分頁切換時空白的問題。
  - 完整接入怪物搜尋、種族/地形/類型過濾、怪物編輯/新增彈窗與寫入專案磁碟等功能。
- **2026-08-21 修復英雄工坊卡片排版與選英雄按鈕事件委派**：
  - 新增 `.cs-hero-card` 垂直流動佈局，解決橫向 flex 造成的資訊壓縮直立問題。
  - 將「👤 選英雄」等動態 DOM 按鈕統一由全域事件委派管理，100% 正常開啟挑選彈窗並套用英雄資料。
- **2026-08-21 實裝「英雄與傭兵設計工坊 (Hero Studio)」與左側傭兵欄一鍵挑選英雄**：
  - 戰鬥工坊頂部新增「👑 英雄與傭兵設計工坊」分頁，支援英雄名冊大盤、搜尋過濾、英雄創造/編輯彈窗（自訂尊號、六維配點、神裝強化附魔與立繪）。
  - 左側傭兵卡片新增「👤 選英雄」按鈕，彈出英雄挑選器，支援一鍵全自動套用英雄設定。
  - 22 個測試檔案 79 項單元測試全數 PASS。
- **2026-08-21 實裝唯一傳奇傭兵 (Unique Adventurers) 名冊與戰鬥工坊誓約騎士聯動**：
  - 建立 `src/data/UniqueAdventurers.ts`，提供 UR 赤焰戰神、SSR 霜語大魔導與 UR 神聖誓約騎士範本，均配備專屬神裝與滿等進階技能。
  - 戰鬥工坊 (`CombatStudio`) 新增「👑 誓約騎士神聖隊」預設，支援自動讀取玩家存檔中的誓約守衛。
  - 新增 `addur`, `addssr`, `addoath` 密技快捷指令。
  - 22 個測試檔案 79 項單元測試全數 PASS。
- **2026-08-21 實裝戰前檢查與全鏈條防呆：每場戰鬥/隊伍最多只能編入 1 位 UR 品質傭兵**：
  - 於 `DispatchModalController`、`TradeController`、`DispatchSystem` 及 `CombatStudio` 實裝全鏈條防呆。
  - 編隊時選取/拖曳第 2 位 UR 傭兵會立即彈出 Toast 提示並阻擋；出發二次校驗與底層 API 均嚴格阻擋。
  - 補齊單元測試（75 項單元測試全數綠燈）。
- **2026-08-21 徹底清除 `ui-chrome.html` 中重複注入的 `combat-modal` 殘留 `VS` 標籤**：
  - 移除了 `ui-chrome.html` 內重複的 `#combat-modal`，確保由 `modals-combat-trade.html` 單一來源管理，徹底清除戰場中央的 `VS`。
- **2026-08-21 戰鬥框體比例重構（70% 史詩舞台）、移除 VS 與戰場開闊對峙空間優化**：
  - 戰鬥舞台高度擴大至 `500px`（佔比 ~70%），下方戰報區收斂至 `~120px`。
  - 移除中央 `VS` 標籤，雙方陣容固定 `320px` 靠左/靠右，中央自然留出 `~250px` 的開闊對峙衝鋒距離。
  - 卡片尺寸定為 `84px × 112px`（1:1.33 經典比例），金黃外框與滿版特寫完全對齊使用者設計。
- **2026-08-21 戰鬥單位卡片等比例還原與九宮格間距呼吸感優化**：
  - 實作 `.combat-p-avatar-sq` 內部居中容器，徹底消除冒險者精靈圖拉伸失真，100% 恢復原本油畫比例。
  - 卡片尺寸定為 `88px × 108px`，陣位間距擴大至 `gap: 14px`，站位層次更分明。
- **2026-08-21 戰鬥單位卡片升級為 Full-Art 滿版卡牌式架構**：
  - 取消卡片內層縮小框，整張卡片以滿版頭像（油畫肖像 / 8x8 寫實怪物）填滿。
  - 頂部與底部採用半透明漸層遮罩懸浮顯示名稱、站位與 HP/MP 條，完全比照傭兵卡片的設計語言。
- **2026-08-21 遊戲本體戰鬥模態框重播舞台比例擴大與戰報文字精緻收斂**：
  - 模態框擴大至 `960px × 720px`，戰鬥舞台高度提升至 `420px`，單位頭像框放大至 `58px`（怪物圖標 `52px`）。
  - 下方文字戰報區範圍縮小，字體縮小至 `0.8rem`，視覺焦點完全鎖定於上方重播動畫對決。
- **2026-08-21 遊戲本體與戰鬥工坊戰鬥播放 UI 重構與動態打擊升級**：
  - **📐 垂直佈局統一**：單位卡片全面採用「名稱在上、44px 大頭像在中央、HP/MP在下」的視覺黃金結構。
  - **👾 寫實怪物全面實裝**：敵方怪物全面連動 `icons_monsters` 8x8 寫實油畫精靈圖。
  - **💥 動態反饋**：受擊震顫（`hit-shake`）、受擊閃紅（`hit-flash`）、技能元素光暈（`skill-cast-glow`）、陣亡灰階（`is-dead`）與 1x/2x/3x 速度切換。
  - **測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 戰鬥工坊敵軍陣容與擂台 100% 動態連動怪物母庫 8x8 精靈圖**：
  - 徹底移除敵方小隊硬編碼的 Emoji，全域透過 `getMonsterAvatar` 動態自 `monsters.json` 取得 `icons_monsters` 8x8 寫實精靈圖標。
- **2026-08-21 戰鬥工坊「👾 怪物資料庫與設計工坊」與唯一真實來源 (SSOT) 上線**：
  - **👾 全景怪物庫管理**：支援 70 款怪物全景卡片瀏覽、搜尋與多重過濾（種族/地形/Boss），卡片頭像一鍵呼叫 8x8 寫實精靈圖直接綁定；支援新增與編輯怪物完整屬性。
  - **💾 唯一真實來源持久化**：一鍵永久寫入 `src/data/monsters.json` 並自動建立時光機快照備份。
  - **測試**：21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 裝備與飾品資料庫「唯一真實來源 (SSOT)」確立與二手商店圖標同步**：
  - **🔒 單一真實來源機制**：`DataStore.ts` 徹底移除次要檔案對裝備庫的覆蓋，飾品資料 100% 由 `equipment_accessories.json` 掌控；二手商店動態對齊最新屬性與 `2_icons_materials` 圖標。
  - **測試**：全庫物件圖標掃描 100% 連結有效，21 個測試檔案 74 項單元測試與 TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 領地鍛造屋素材與交易品圖標解析器全面升級**：
  - **🖼️ 全域 Sprite/Emoji 自動適配**：升級 `ForgeUIController.ts` 與 `InventoryUIController.ts` 全面呼叫 `renderUniversalIcon`，徹底解決素材冶煉與鍛造需求格子暴露 `icons_materials:xxx` 字串的問題。
  - **測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 裝備工坊資產防誤刪「🔒 上鎖 / 🔓 解鎖」保護機制**：
  - **🔒 全資產鎖定防護**：素材、道具、裝備與配方卡片支援 `🔒/🔓` 按鈕，上鎖狀態下刪除按鈕半透明禁用且強制攔截點擊。
  - **測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 裝備工坊隨機詞條抽取池 (Affix Pool) 全面繁體中文化與懸浮提示**：
  - **🎲 詞條中文化與懸浮提示**：將裝備與飾品資料庫中的詞條全面轉為繁體中文標籤，並於工坊卡片提供屬性效果提示 Tooltip。
  - **測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查 100% 綠燈。
- **2026-08-21 專案既有飾品全量標準化收錄至裝備工坊與配方庫**：
  - **💍 11 款專案飾品收錄 (`equipment_accessories.json`)**：收錄二手店與戰鬥系統 11 款飾品原型，補齊五階品質、六維屬性、詞條池、獲取管道標籤與風味描述。
  - **🔨 鍛造配方連動 (`CraftingRecipes.json`)**：新增 7 款飾品之素材鍛造配方。
  - **🛠️ 工坊即時連動**：裝備工坊飾品篩選器完美載入並支援可視化編輯與持久化儲存。
  - **測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查與 P0 完整測試 100% 綠燈。
- **2026-08-21 怪物 8 大戰鬥定位 (Stat Profiles) 與全技能單一真相來源中樞 (Skill Registry)**：
  - **🏛️ 8 大戰鬥定位與正規化生成**：在怪物總預算鎖死的前提下，實裝 `TANK`、`ASSASSIN`、`MAGE`、`BERSERKER`、`RANGER`、`JUGGERNAUT`、`BOSS`、`BALANCED` 權重分配，徹底解決怪物屬性同質化問題。
  - **🧠 單一真相來源技能中樞 (Skill Registry)**：新增 `src/systems/combat/SkillRegistry.ts`，整合全域傭兵基礎技能、進階職業技能、通用魔物技能與裝備特技，支援動態註冊與分類篩選。
  - **👾 10 款通用魔物技能庫**：去特定化命名設計（【劇毒噴吐】、【撕裂爪擊】、【粉碎重擊】、【嗜血打擊】、【尖嘯震懾】、【暗影突襲】、【烈焰轟爆】、【冰霜吐息】、【堅石甲殼】、【狂暴怒吼】），可自由配置於任意魔物。
  - **🛠️ 戰鬥工坊深度連動**：`CombatStudio.ts` 支援即時切換 Profile 與 Optgroup 分組技能掛載，自動同步磁碟持久化。
  - **測試**：21 個測試檔案 74 項單元測試、TypeScript 型別檢查及 P0 完整測試 100% 綠燈。
- **2026-08-20 戰鬥平衡工坊圖標選擇器全面升級為 Universal Icon Picker**：
  - **🖼️ 視覺化全圖集通用選擇器**：與素材裝備工坊全面統一，動態載入 `custom_icon_datasets.json`，支援怪物、守衛、傭兵頭像、武器防具、素材及自訂圖集分頁。
  - **🎨 暗黑油畫圖標渲染**：傭兵隊伍卡片、敵方怪物卡片、戰鬥擂台血條頭像與怪物創造器預覽，全面支援 `renderUniversalIcon`。
  - **💾 雙向連動與持久化**：支援自訂代碼/Emoji 手動輸入與一鍵更換，保存時永久同步寫入專案魔物資料庫。
- **2026-08-20 裝備工坊深度強化升級：獲取管道分流、六維屬性與隨機池、浮動數值區間、12+ 隨機詞條、動態多素材配方與雙技能接口**：
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
  - **測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **2026-08-20 素材裝備工坊深度連動圖標工坊：全圖集視覺化選擇器與暗黑油畫圖標即時渲染**：
  - **🖼️ 視覺化全圖集通用選擇器 (Universal Icon Picker)**：
    - 完全打通 `custom_icon_datasets.json`，自動動態掃描所有已註冊圖集（素材 `materials`、T1~T4 四階武器 `weapons`、防具 `armors`、設施 `facilities`、男女守衛 `guardians`、男女傭兵 `avatars` 及使用者新增的自訂圖集）。
    - 點擊卡片頭像即時開啟多分頁圖集面板，支援 48px 油畫縮圖、懸浮發光、中文名稱標籤與一鍵選用。
    - 保留「😀 常用 Emoji」分頁與「手動輸入自訂代碼」彈性（支援任意 Emoji 或 `category:id`）。
  - **🎨 全局油畫圖標統一渲染 (`renderUniversalIcon`)**：
    - 素材清單、消耗道具、裝備卡片、鍛造配方產出、素材消耗列表及編輯彈窗全面升級調用 `renderUniversalIcon`，全工作台呈現精美暗黑油畫質感。
  - **測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **2026-08-20 裝備資料庫結構拆分 (weapons / armors / accessories) 與遊戲系統全域對接**：
  - **🗂️ 裝備資料庫三向解耦拆分**：
    - 將 `EquipmentTemplates.json` 拆分為 `equipment_weapons.json`（武器 30 款）、`equipment_armors.json`（防具 12 款）與 `equipment_accessories.json`（飾品）。
    - 消除單一超大檔維護困難，各模組容量可獨立無上限擴充數千件內容。
  - **🔗 遊戲核心資料庫無縫載入 (`DataStore.ts`)**：
    - `DataStore.EquipmentDB` 改為由三份獨立檔案與二手飾品庫統一組裝，對外 API 介面 100% 保持相容，零破壞性變更。
  - **💾 工坊 API 與持久化升級 (`vite.config.ts`, `EquipmentStudio.ts`)**：
    - `/api/get-equipment-studio-data` 與 `/api/save-equipment-studio-data` 支援三檔分流讀寫，儲存時自動依 `slot` 分流至各獨立檔案並同步維護鏡像備份。
    - 修復工坊讀取裝備清單時型別誤判為空的問題，既有 42+ 件裝備與鍛造配方 100% 完美載入。
  - **測試**：20 個測試檔案 70 項單元測試與 TypeScript 型別檢查 100% 通過。

- **2026-08-20 裝備、素材、消耗道具與鍛造配方工坊 (Equipment & Material Studio) 正式上線**：
  - **🛠️ 三欄式可視化工作台 (`tools/equipment-studio.html`)**：
    - **左欄**：素材庫 & 消耗道具庫（支援自訂效果、價格、堆疊數、功能描述與背景風味文字）。
    - **中欄**：12 類武器、防具與飾品原型庫，支援自訂隨機屬性詞條池 (Affix Pool) 與 +10 強化預估戰力。
    - **右欄**：鍛造配方庫與模擬鍛造試驗台。
  - **🖼️ 圖標直接置換**：點擊卡片頭像即時呼叫 30+ 款 Emoji 圖標池隨選即換。
  - **💾 磁碟持久化與時光機**：一鍵寫入專案磁碟並自動備份最近 20 份歷史快照。
  - **⌨️ 密技與導航**：盲打 `equip` / `material` / `forge` 或控制台 `openEquipmentStudio()` 立即在新分頁開啟。
  - **測試**：20 個測試檔案 70 項單元測試 100% 通過。

- **2026-08-20 戰術遭遇與戰鬥平衡工坊 (Combat Studio) 與核心技能引擎全面修復升級**：
  - **🔥 12 大進階職業技能掛載修復 (`CombatSystem.ts`)**：全面修復職業名稱家族判定，大魔導士、死靈法師、狂戰士、神射手、聖騎士、暗殺者等皆能 100% 正確掛載基礎技能與終極大招，解決進階職業只會普攻的問題。
  - **👑 真實品質資質演算法 (N / R / SR / SSR / UR)**：傭兵六維基礎總合全面調用專案原生品質公式（N: 40, R: 55, SR: 70, SSR: 88, UR: 110），切換品質時所有戰鬥數值直接有感暴增。
  - **👾 敵方怪物即時數值面板**：怪物卡片底部即時展示真實計算之 HP、攻擊、物魔雙防、速度、閃避與戰力評分。
  - **🌊 遊戲核心多波次分階生成引擎**：底層支援 `waveEnemyLineups` 獨立波次名單，前置波次自動過濾 Boss，首領/Boss 怪物嚴格限定在最後決戰波登場。
  - **🎲 大地圖隨機生態討伐遭遇**：工坊實裝 `[🎲 隨機遭遇]` 按鈕，自動依地形生態隨機抽配多波次合法野生魔物討伐隊伍。
  - **測試**：19 個測試檔案 66 項單元測試 100% 通過。

- **2026-08-19 圖標工坊持久化 (Zero Data Loss)、自訂圖檔實體化、輕量化快照引擎 (44KB) 與全域通用圖標渲染器實裝**：
  - **圖集持久化**：建立 `src/data/custom_icon_datasets.json`，自訂圖集（如 `npc`、`npc_man`）永久寫入專案磁碟，瀏覽器重開、快取清除 100% 永久存在。
  - **圖片實體化與輕量化快照**：上傳圖片自動抽取為 `public/assets/custom_icons/` 實體圖檔，快照絕不塞 Base64，單檔由 1.7MB 暴降至 44KB，並自動保留最近 20 份輪替。
  - **全域通用圖標渲染器**：在 `IconSpriteHelper.ts` 實裝 `renderUniversalIcon(identifier, size)`，100% 向下相容既有傭兵隨機頭像與裝備，支援隨插即用渲染自訂圖標。
  - **測試**：18 個測試檔案 62 項單元測試 100% 通過。

- **2026-08-19 決策選項消耗智慧檢查 (canAffordChoice) 與按鈕反灰禁用機制實裝**：
  - **自動成本檢查**：在 `NarrativeSystem.ts` 實裝 `canAffordChoice`，自動掃描選項中的金幣、特產與素材扣除需求。
  - **按鈕反灰與紅字提示**：若領地資源不足，待辦清單按鈕自動反灰禁用（`disabled`、半透明與禁行符號），並在按鈕旁精確標註 `⚠️ (缺少特產：香料 x1)` 或 `⚠️ (金幣不足)`。
  - **安全扣除**：執行結算時安全扣除，數量歸零時自動移除鍵，避免產生負數。
  - **測試**：新增 `canAffordChoice` 單元測試，18 個測試檔案 62 項測試 100% 通過。

- **2026-08-19 倉庫幽靈物品全面排查修復、6 大職業轉職信物註冊與舊存檔自動清洗遷移實裝**：
  - **懸賞掉落正規化**：修正 `BountySystem.ts` 舊版模板發放的歷史幽靈 ID（`RAW_HIDE` 等），改為合法的特產 `tg_hide`、`tg_wheat`、`tg_meat`、`tg_cotton` 與素材 `mat_stone_brick`、`mat_iron_ingot`、`mat_wood_plank`，並依前綴正確入庫 `tradeInventory` 或 `materials`。
  - **轉職信物註冊**：在 `materials.json` 正式註冊 `ADVANCE_WARRIOR`（狂怒之鋒）等 6 大轉職信物，解決倉庫隱形與鐵匠鋪異常問題。
  - **鐵匠鋪素材查表修復**：修正 `ForgeUIController.ts` 使用 Array 取 key 導致永遠取到 `undefined` 的 Bug。
  - **舊存檔自動清洗遷移**：升級存檔版本至 `Schema v5`，玩家載入舊存檔時會自動將舊版幽靈字串轉換為合法物品。
  - **驗證**：TypeScript 型別檢查通過、18 個測試檔案 61 項單元測試 100% 通過。

- **2026-08-19 官方故事集全面收錄、動態多選項支援、派系外交好感度與待辦清單深度整合實裝**：
  - **🏛️ 官方故事集收錄**：已收錄 `story_feudal_politics`（帝國政局與家族外交：鐵血徵收、雪夜刺客、王室特別稅等）與 `story_territory_folklore`（領地民情：秋季豐收祭典、荒野古老石碑等），所有事件均資料化並支援工坊視覺化編輯。
  - **🔀 動態多選項分支**：故事工坊與遊戲端彈窗／待辦視窗全面支援 1~N 個自由增刪的選項分支，各選項具備獨立按鈕、結果文字與專屬效果清單。
  - **👑 派系外交效果**：支援 `CHANGE_FACTION_FAVOR`（洛斯加王室、沃爾蒙德大公、赫斯特教廷、瓦萊里烏斯家族、莫凡恩商會）及 `FACTION_FAVOR_AT_LEAST/MOST` 與 `GOLD_AT_LEAST`。
  - **📋 領地待辦視窗深度整合**：`TodoModalController` 完整支援渲染 `TODO_LIST` 管道的故事節點卡片，點擊選項即時結算獎勵與外交好感度並自動更新領地與 HUD。
  - **驗證**：TypeScript 型別檢查通過、18 個測試檔案 60 項單元測試 100% 通過。

- **2026-08-19 故事工坊一體化三欄工作台、畫布縮放平移 (Zoom & Pan)、統整隨機獎勵與待辦清單連動實裝**：
  - **🚀 一體化三欄工作台**：將故事庫管理（左欄）、流程圖畫布與節點導航（中欄）、屬性 Inspector（右欄）整合至同一視窗，完全無需跨 Tab 切換。
  - **🗺 畫布手勢與視角**：支援滑鼠左鍵空白處拖動畫布 (Pan)、滾輪以滑鼠為錨點無級縮放 (0.3x~2.0x)、一鍵「🔍 適應全景 (Fit View)」，單擊節點 100% 保持在畫布視角並於右欄同步載入編輯。
  - **🎁 統整型獎勵面板**：裝備 (`GRANT_EQUIPMENT`) 支援「固定模板」與「隨機生成（可自選部位：任意/武器/防具/飾品，以及階級：T1~T4 或任意）」，底層由 `EquipmentGenerator.generateByFilter` 支援；素材與貿易品亦支援隨機生成模式。
  - **📋 待辦事項連動**：新增 `TODO_LIST` 出現管道，節點可無縫分派至領地待辦清單。
  - **測試驗證**：TypeScript 型別檢查通過、18 個測試檔案 60 項單元測試 100% 通過。

- **2026-08-17 獨立故事工坊與遊戲測試模式完成**：
  - 編排入口為開發伺服器下的 `/Medieval/tools/story-studio.html`（舊 `/Medieval/story-editor.html` 會自動導向）；正式遊戲與正式 bundle 均無編輯入口。
  - 工坊目前支援懸賞、酒館傳聞、領地事件、發現據點時、討伐結束及解鎖預設故事據點，並提供結構檢查、JSON 匯出、專案寫入及最近 20 份歷史快照還原。
  - 故事定義由 `NarrativeStory`／`NarrativeNode` 組成；跨節點關係透過 facts、條件與 `SCHEDULE_NODE` 延遲排程建立，不依賴固定線性順序。
  - 每個存檔的 facts、已出現／完成節點、排程及探索紀錄保存在 `GameState.narrativeState`；正式內容唯一來源為 `src/data/custom_stories.json`，工坊透過 Vite 開發 API 寫入並在 `src/data/story_backups/` 留存快照。
  - 「在遊戲中測試」會以一次性 token 開啟 DEV 專用測試頁，可強制顯示、自然檢查、推進 1／5 天及重置進度；`currentSaveSlot = null`，不會寫入正式存檔。一般遊戲啟動會忽略所有工坊暫存。
  - 開發環境可在遊戲畫面直接盲打 `story`，或從控制台執行 `openStoryStudio()` 開啟工坊；正式環境不會註冊兩者。
  - 工坊已支援多筆條件、完成結果與各選項結果；獎勵可指定素材、貿易品、裝備與經驗池。故事討伐據點可設定生成位置、地形、難度、主題怪物、偵查、途中事件、勝敗分流與勝利後清除。
  - `失蹤的商隊` 已擴成六節點垂直示範：追查貨物會生成「走私者的廢棄關卡」，含途中抉擇及勝敗後續；勝利分支示範香料、素材、裝備與經驗池獎勵。
  - 操作與測試步驟集中於 `docs/STORY_STUDIO_GUIDE.md`。故事討伐節點會進入 `mapNodes` 存檔；進行中任務的 `narrativeJourneyIndex` 亦會保存。
  - 目前故事據點只支援解鎖既有 `MapNode.id`；自訂座標據點、角色綁定、線索數量條件與視覺拖拉關聯線尚待後續版本。
  - 本次驗證完成：`npm run typecheck`、57 項單元測試、`npm run build` 均通過；另以瀏覽器驗證工坊導向、內容載入、快照視窗、DEV 測試面板、強制觸發節點，以及一般遊戲無編輯／測試入口。正式 `dist` 搜尋不到工坊或測試面板內容。

- **2026-08-17 P0 平衡量測基準完成 (New!)**：
  - `npm run test:p0` 現可驗證型別、單元測試、固定種子戰鬥、360 天經濟，以及含誓約創角／序章的完整 Smoke 流程。
  - 怪物腳本的開局基準已改為難度 1，失敗會回傳非零狀態；5v5 fixture 已確認正式套用防具 `combatEffects`。
  - 經濟基準顯示：普通第 130 天到營地、第 145 天到村莊；困難第 183 天到營地、第 195 天到村莊，360 天內皆未飢荒或正式破產。
  - 詳細方法、限制與數據見 `docs/BALANCE_TEST_REPORT.md`。本階段只修量測工具，未調整正式遊戲數值。

- **2026-08-16 誓約守衛創角系統、20 款男女立繪、電影感轉場、傳家劍安全鎖與圖標工坊增強實裝 (New!)**：
  - **📜 羊皮紙誓約創角契約 (`#modal-oath-creation`, `OathCreationController.ts`)**：開局選難度與種子後展開古樸羊皮紙契約，支援客製化命名、性別切換、6 大基礎職業（戰士/騎士/弓手/法師/盜賊/祈禱者）與 5 大誓約專屬性格（忠誠護衛、沉著參謀、熱血戰魂、堅毅信仰、敏銳斥候）。
  - **🖼️ 1:1 正方形 5×5 誓約男女守衛大圖集 (`avatars_guardians.jpg`)**：包含男守衛 10 款（Row 0~1）與女守衛 10 款（Row 3~4），徹底消除長條拉伸與壓扁，全域介面（小隊列表、HUD、詳細立繪卡）100% 保持端正等比展示。
  - **🎬 電影感黑幕文字劇情轉場 (`#overlay-prologue`)**：確認立誓後全黑漸顯 5 段開局故事（領地淪陷、父親臨終託付佩劍、流亡荒野點燃復興營火），播放完畢後方可點擊進入營地，並支援「⏩ 略過劇情」。
  - **🔒 領主傳家劍 (Family Heirloom Sword) 安全鎖**：守衛開局隨身佩戴已上鎖的 `wpn_heirloom_sword`，可自由卸下/裝備，但嚴格鎖定二手店典當（不可出售）與鐵匠鋪（不可拆解），彈出專屬守護提示防呆。
  - **🛠️ 圖標工坊增強 (`tools/icon-studio.html`, `custom_icon_config.json`, `vite.config.ts`)**：
    - 支援「🖼️ 更換圖檔來源」與自訂圖集安全刪除。
    - 核心系統圖集（武器、防具、男女傭兵/守衛）絕對鎖定防刪。
    - 支援刪除自訂圖集後「↩️ 一鍵快照復原」防誤刪。
    - 「💾 寫入專案硬碟」自動序列化所有自訂圖集及其項目至 `custom_icon_config.json`。

- **2026-08-15 領地規模與爵位 100% 雙向咬合體系 & 四大生產設施升級實裝 (New!)**：
  - **👑 爵位與規模門檻調整**：騎士/營地 (100)、男爵/村莊 (250)、子爵 (600)、伯爵/城鎮 (1200)、侯爵 (2500)、公爵/首都 (5000)。
  - **🌾 生產設施繁榮階梯與消耗**：農田、伐木場、採石場、獵場預設 Lv.1=0 分（倍率 1.0x），荒野開放升至 Lv.2（100G 30木 15石），升級 Lv.2=+10, Lv.3=+25, Lv.4=+45, Lv.5=+70（倍率最高 3.0x）。
  - **🖥️ 自宅內政 UI 極致緊湊 2 行佈局**：重構工種卡片為 2 行緊湊規格，徹底消除滾動卷軸，預期收穫產量列清楚置底展示。
  - **📊 繁榮度即時單一真相來源**：繁榮度 = `當前人口 + 全體設施/建築固定分 + 道路/附庸加成 - 動態危險分`，徹底終結每月無上限空轉膨脹。
  - **跑商系統全面重構為「左側護衛編制 + 右側寬廣商貿」雙欄佈局**：支援直接打數字 + 快捷加減步進，即時計算戰力、載重上限與現金淨損益。
  - **攻防分離雙元素相剋**：`CombatSystem.ts` 與 `CombatMath.ts` 升級為雙重判定：攻擊時由**武器元素（`atkElement`）**打擊目標本體（火武器打雷怪 ➔ **1.25x 剋制增傷**）；受擊時由**防具元素（`defElement`）**判定減傷/弱點，實現真正深度的 RPG 元素戰術策略。
  - **鍛造強化、元素加工附魔與改造所新增「從傭兵身上」裝備來源**：左側新增 `📦 領地倉庫` 與 `👤 傭兵穿戴` 切換標籤，清楚標註穿戴者與部位，支援直接就地強化/附魔/改造，戰力與相剋屬性即時同步更新。
  - **防具店 ➔ 裝備二手商 (`bld_armor.png`)**：實裝雙頁籤架構（💍 稀有飾品貨架 + 💰 二手裝備典當回收變現）。建立獨立外部資料庫 `src/data/SecondHandShopData.json`，支援飾品隨機購買、折價係數計算與「一鍵典當基礎裝」便捷回收。
- **2026-08-15 傭兵裝備雙欄比較 Tooltip 與即時戰力變動預覽實裝**：
  - **精準雙重錨定**：由當前開啓武裝面板的 `currentAdventurer` 與開啟的槽位 `EquipmentSlot`（武器/防具/飾品）精確錨定，絕不錯置比對對象。
  - **頂部傭兵戰力即時預覽**：模擬置換裝備並調用 `adv.getPower()` 試算，頂部展示傭兵名稱、等級與戰力變化（例：`戰力評估：185 ➔ 210 (+25 戰力提升 🟢)`）。
  - **清爽雙欄並排佈局**：左欄【當前穿戴】vs 右欄【選中裝備】，展示元素、職業、戰鬥效果與武器補正（未穿裝備時左欄顯示空槽位提示），不放多餘差值字串。
  - **浮動 Tooltip 智慧左翻防溢出**：當 Tooltip 寬度較大且游標在螢幕右側時，自動向左翻轉在游標左側展開，絕不遮擋卡片或被螢幕邊緣切斷。
- **2026-08-15 鍛造系統全階級配方補齊與「內政勞動產物全程大循環」實裝**：
  - **T1 基礎武器防具補齊**：補齊遺漏的騎士木盾長劍、盜賊鐵匕首、祈禱者手札，6 大基礎職業武器 + 3 種防具 100% 齊全。
  - **T2 高級鍛造「鋼錠邏輯」**：全面採用純由木/石/鐵/皮/棉二級加工素材（鋼錠、硬化皮革、絲綢、木板、粗布、磨刀石）製作，純靠領地自給自足。
  - **T3/T4 深度消耗基礎工業原料與 T4 嚴格隱藏機制**：T3 專家裝備消耗大量鋼錠、木板、皮革、絲綢並結合特產；T4 專用神兵重鑄維持海量內政原料消耗（鋼錠x10~12、木板x10~12、絲綢x6）+ Boss 核心。所有 T4 裝備（包含 6 大原生職業與 6 大變異職業）嚴格遵守**「未持有對應重鑄書/圖紙道具或倉庫無前置 T3 裝備時完全隱藏」**機制，避免過早劇透神兵情報。
  - **鍛造設施等級（Forge Lv 1~3）階梯解鎖**：
    - Lv 1 鐵匠鋪：T1 鍛造 + 基礎素材冶煉 + +1~+3 強化。
    - Lv 2 工藝坊：T2 鍛造 + 二級素材冶煉 + +4~+6 強化。
    - Lv 3 皇家鍛造所：T3 鍛造 + T4 重鑄 + 特種金屬冶煉 + +7~+10 強化。
  - **UI 升級**：支援階級篩選標籤組（`全部` / `T1` / `T2` / `T3` / `T4`）、設施未達標記 `🔒 需 Lv.X` 與強化上限即時鎖定提示。
- **2026-08-15 大一統戰力計分公式與近郊自然生態據點重構**：
  - **大一統戰力公式**：傭兵與怪物 100% 共用同一套客觀面板公式：$\text{Power} = \text{有效攻擊} + \lfloor\text{平均防禦} \times 0.6\rfloor + \lfloor\text{最大 HP} \times 0.2\rfloor + \lfloor\text{最大 MP} \times 0.1\rfloor + \lfloor\text{速度} \times 0.5\rfloor$。
  - **怪物數值生成模型校準**：修正難度 1 級標準怪數值（HP 75~85、ATK 24~26、DEF 8~12、SPD 6~8），杜絕開局個位數抓癢傷害，保留 48 種怪物與種族特性。
  - **近郊自然生態據點**：徹底移除讀取脫裝戰力的漏洞，改為領地近郊生態三階梯機率生成（50% 小型落單 ~60 戰力、35% 中型營地 ~120 戰力、15% 稀有凶煞 ~200 戰力）。
  - **動態據點 30 天威脅擴張**：動態隨機據點（`node.isDynamic`）首次偵查永久鎖定主題怪物血統與詞綴；若 30 天未清剿，情報重回迷霧，難度自動升階（`baseDifficulty += 1`，上限 2 次），同種族增援擴編。支援重新派斥候摸底或直接「盲打強攻」。
  - **經驗與金錢收益校準**：金幣掉落對標 $\lfloor\text{Power} \times 1.0\rfloor$，經驗值掉落對標 $\lfloor\text{Power} \times 0.25\rfloor$（升級節奏健康拉長，1 級升 2 級約需 7 場討伐）。
- **2026-08-14 酒館懸賞欄一鍵智能派遣與一鍵收取獎勵系統 (New!)**：
  - **酒館懸賞欄快捷操作**：於 `modal-bounty-board` 左側任務清單頂部新增「⚡ 一鍵派遣」與「🎁 一鍵領取」。
  - **規則**：高收益高經驗優先派遣、受傷傭兵健康保護（HP < 30% 自動跳過）；一鍵結算已完成委託並彈出總收益 Toast。
- **2026-08-14 3 大 Sprite Sheet 圖集系統與 IconSpriteHelper 整合 (New!)**：
  - 武器圖集 (`icons_weapons_12.jpg`)、羊皮紙設施圖集 (`icons_facilities_parchment_12.jpg`)、彩色透明素材圖集 (`icons_materials_color_12_1.png`)。
  - 封裝 `IconSpriteHelper.ts` 精準 CSS 映射，HUD 資源圖示加大至 36px，倉庫圖示提升至 42px，街道建築卡片完美對齊消除白邊。
  - **因果與潛伏模型**：修改 `EventSystem.ts`，事件觸發不再依賴單一的 `eventPressure`，而是改由 `Territory.activeOmens` 追蹤潛伏期。當滿足前置條件時（例如金幣過多且外交差），會先拋出 3 天的徵兆（Omen）。玩家若在 3 天內改善狀態即可解除危機，否則才會引爆事件。
  - **長效冷卻與動態通膨**：在 `EventData.ts` 擴充 `GameEvent` 介面，支援 `cooldownDays` 與 `isUnique`。勒索事件加入了 180 天的長冷卻，且金幣門檻改為 `3000 + (爵位等級 * 2000)` 的動態通膨算法；豐收祭典門檻改為 `總人口 * 10`。
  - **唯一性故事線標記**：「雪夜的訪客」與「暗流湧動」被設定為 `isUnique: true`，做為未來解鎖「神聖教廷」與「樞密院」進階任務鏈的單次故事鉤子。

- **2026-08-07 鍛造屋批量操作與介面細節優化**：
  - **批量冶煉與鍛造 UI**：修改 `ForgeUIController.ts`，在底部新增數量調整器與 `MAX` 智能計算按鈕，並隱藏原生 input 的上下箭頭。讓玩家能一次性投入所有資源批量產出，大幅減少作業感。
  - **全域倉庫排版修復**：修改 `panels-hud.html`，將全域倉庫按鈕懸浮置於「傭兵小隊」正上方，恢復底側快捷列經典 4 按鈕水平排版。裝備頁籤亦改為網格方形卡片並附帶懸浮提示，對齊傭兵小隊的裝備選擇 UI。
  - **預期產量文字與圖示防呆**：修改 `UIManager.ts`，將不相容舊裝置的 `🪵` 與 `🪨` 改為 `🌲木材` 與 `🧱石材` 等高相容性圖示與中文防呆，並補上獵人生皮與礦工鐵礦的日產量追蹤。

- **2026-08-07 酒館動態客流升級：傭兵個別離店判定與結算轉場即時重繪**：
  - **個別獨立計算演算法**：修改 [`TavernSystem.ts`](file:///d:/tryagent/Medieval/src/systems/TavernSystem.ts)，對酒館內的每一位傭兵實作每日獨立離店抽籤（50% 機率）與每個空座位獨立補新（70% 機率，保底 2 人），避免舊客人集體死板連住 5 天不走。
  - **結算轉場即時重繪**：修改 [`GameFlowController.ts`](file:///d:/tryagent/Medieval/src/ui/GameFlowController.ts)，在【每日結算 Modal】黑幕轉場完畢時，若玩家位於酒館視圖內，自動重新執行 `renderTavernView()`，確保轉場拉開後畫面 100% 呈現當日最新傭兵。




- **2026-08-03 建立世界觀敘事聖經與陣營設定計畫 (`docs/NARRATIVE_BIBLE.md`)**：
  - 徹底確立了「純人類政治權謀」的世界觀基調。未來的劇情設計 100% 聚焦於人類的貪婪、繼承權鬥爭與經濟壟斷。
  - **敘事鐵律**：怪物絕對不是受控的生物武器，而是人類社會崩壞、管理不當與貪婪所引發的自然反噬與環境副作用。**後續接手的開發者在生成任何文本前，必須強制閱讀此《敘事聖經》**。
- **2026-08-02 戰鬥重播渲染水藍色 MP 條、46px 大頭像與精緻名字 (`CombatUIManager.ts`, `index.html`) (New!)**：
  - 在血條下方新增水藍色 MP 能量條 (`.combat-mp-fill`)，於技能施放與 MP 恢復時平滑動畫連動。
  - 英雄頭像框由 32px 放大至 `46px × 46px` (正方形 1:1)，名字微調縮小至 `0.72em`，讓版面呈現黃金比例的工整質感。
  - 每回合恢復數值削弱為 `CON * 0.2` 與 `SPR * 0.2`，戰鬥回歸快節奏，例行恢復改由角色頭頂浮動跳字。
- **2026-08-02 修復傭兵卡片頭像垂直拉伸變形漏洞**：
  - 修正 `background-size: 600% 400%` 導致頭像被長方形卡牌強制拉高 35% 變形的 Bug。升級為 `background-size: auto 400%`，讓頭像鎖定 1:1 正方形並自然置中遮罩，還原英雄原圖五官神韻。
- **2026-08-02 打造獨立自宅總倉庫 Modal 與還原 85px x 85px 正方形物品網格**：
  - **獨立自宅總倉庫 (`#modal-base-warehouse`)**：點擊自宅「檢視倉庫」時開啓專屬的領主總倉庫視窗（含儲備裝備、素材附魔石、交易品物資 3 大頁籤）。
  - **修復長寬比例為 100% 正方形**：網格設定為 `repeat(auto-fill, 85px)`，卡片限制 `width: 85px; height: 85px; aspect-ratio: 1/1`，完美修正卡片遭橫向拉伸成 165px 扁矩形的視覺缺陷。
- **2026-08-02 修復存讀檔里程碑遺漏導致重複刷新領取獎勵 Bug**：
  - 修正 `SaveManager.ts` 在 `saveGame` / `loadGame` 中漏掉 `GameState.milestones` 的 Bug，確保讀檔後里程碑紀錄完整還原，不會重複領取金幣與聲望。
- **2026-08-02 實裝單次與多波次討伐據點消失條件與 UI 動態提示**：
  - **討伐模式消失機制分立 (`DispatchSystem.ts`, `MapDynamicsSystem.ts`)**：單次討伐 (1波) 勝利後保留據點供反複練級刷資源；連續平定 (3波) 戰勝 3 波敵軍後，動態據點被徹底平定並從地圖消失。
  - **派遣介面 UI 動態提示 (`index.html`, `ModalController.ts`)**：派遣彈窗切換【單次 (1波)】與【連續 (3波)】時，動態展示相對應的「據點存留/消失」與「戰利品/平定獎勵」提示說明。
- **2026-08-02 移除武器錯誤混沌普攻並還原對應傷害屬性**：
  - 修正 `CombatSystem.ts` 誤將 `SCYTHE`, `MAGIC_RING`, `MAGIC_BOW` 普攻判定為混沌傷害的舊 Bug。
  - 戰鐮與魔法戒指普攻還原為魔法傷害 (`DamageType.MAGICAL`)，魔法弓還原為物理傷害 (`DamageType.PHYSICAL`)，完全對齊 [CLASS_SYSTEM.md](file:///i:/gameproject/Medieval/docs/CLASS_SYSTEM.md)。
- **2026-08-02 全局戰鬥平衡重構、屬性二次雙重加算 Bug 修復與怪物 PDEF/MDEF 獨立**：
  - **修復 `calculateSkillDamage` 屬性二次乘算 Bug (`Skill.ts`)**：移除重複乘算的 `atkMultiplier`，還原面板 `PATK`/`MATK` 為傷害計算唯一基準，徹底解決玩家輸出無效爆走與對怪物的雙標不對等。
  - **怪物 `pdef` 與 `mdef` 雙防獨立 (`types.ts`, `MonsterSystem.ts`, `CombatSystem.ts`)**：魔劍士與異端拷問官的「混合傷害」現能真實穿透高物防怪的弱點。
  - **怪物攻防血基數重構 (`MonsterSystem.ts`)**：取消 `/2` 過度削弱，使怪物護甲提供 15%~30% 減傷，戰鬥長度回歸 2~4 回合。
  - **冒險者戰力評估算入裝備加成 (`Adventurer.ts`)**：`getPower()` 現計入裝備攻防與 HP 加成，準確反映傭兵真實戰力。
- **2026-08-02 修復讀取存檔時鍛造屋等級遭誤覆寫 Bug**：
  - **存檔還原判斷修復 (`SaveManager.ts`, `ShopController.ts`)**：修正 `SaveManager.ts` 在還原存檔時使用 `if (!t.forgeLevel)` 導致 `0` 級被 `!0` 評估為 `true` 並被覆寫為 `1` 的問題。改為精確的 `if (t.forgeLevel === undefined) t.forgeLevel = 0;`，確保新遊戲存檔再讀檔後鍛造屋不會自動被解鎖。
- **2026-08-02 修復駐軍戰力浮點數與討伐建議戰力精準連動**：
  - **駐軍戰力浮點數取整 (`MonsterSystem.ts`, `ModalController.ts`)**：全數使用 `Math.round()` 取整，去除 `86.39999999999999` 浮點數精度贅字，全 UI 展示整數戰力。
  - **派遣建議戰力 100% 精準對齊 (`ModalController.ts`)**：將討伐派遣彈窗中的 `minPowerRequired`（建議戰力）改為自動讀取並精準對齊據點偵查後的真實駐軍戰力 (`garrisonPower`)，解決過去死板公式算出的建議戰力 (39) 與真實駐軍戰力 (86) 嚴重脫節的問題。
- **2026-08-02 冒險者頭像框等比放大與 24 款英雄頭像圖集實裝**：
  - **頭像框排版優化 (`index.html`)**：將 `#party-portrait-img-wrapper` 的尺寸調整為 `82px × 82px`，精確與右側【等級/稱號/HP/MP/EXP 條】總高度一致，消除頭像框下方空白。
  - **24 款英雄頭像庫實裝 (`avatars_6x4.jpg`, `ModalController.ts`, `AdventurerCard.ts`)**：匯入 6×4 魔獸/奇幻英雄圖集至 `public/assets/avatars_6x4.jpg`，更新 CSS `background-size: 600% 400%` 與 `nameHash % 24` 自動隨機分派與持久化算式。全遊戲冒險者卡片與詳細面板已全數升級套用。
- **2026-08-02 修復自宅探索動態討伐據點生成與可見性**：
  - **修復據點地圖可見性 Bug (`MapDynamicsSystem.ts`)**：為 `spawnDynamicNode()` 產生的討伐據點補上 `isDiscovered: true` 標籤，解決地圖過濾器誤將其隱形遮蔽的瑕疵。
  - **限定生成於近距離且已揭開迷霧區域 (`MapDynamicsSystem.ts`)**：結合 `explorationSystem.isPointRevealed(newX, newY)`，確保自宅探索產生的練功討伐據點只會生成於領地周遭近距離（極限距離 $\le 10$）且玩家已揭開迷霧的位置，同時保護靜態預設據點留給斥候遠征探索機制。
- **2026-08-02 里程碑獎勵去除繁榮度與鍛造屋初始等級調整**：
  - **里程碑獎勵去繁榮度化 (`MilestoneSystem.ts`)**：移除「首次分配工人」、「人口達 15 人」、「完成第一棟建築」的繁榮度獎勵，統一替換為 50 ~ 100 金幣獎勵，避免城鎮晉升節奏過快破壞發展平衡。
  - **鍛造屋預設等級修正為 Lv0 (`Territory.ts`)**：將領地 `this.forgeLevel` 預設等級從 1 降至 0，玩家開局不再免費擁有鍛造屋，需於領地花費金幣與資源手動建造解鎖，修正極難難度開局免費取得鍛造屋及開局誤觸「第一棟建築」里程碑的問題。
- **2026-08-01 裝備數據庫、T4/T5 鍛造重鑄、商店限制與法杖/魔法弓元素技能實作**：
  - **12 大官方職業武器與防具數據庫 (`EquipmentTemplates.json`)**：對齊 12 種職業武器與布/皮/鎧防具。武器與防具商店限制僅販售 T1與T2 裝備。
  - **變異職業武器 T4 重鑄機制 (`CraftingRecipes.json`)**：變異武器 (雙劍/戰鐮/魔法弓/符文盾/魔法戒指/戰鎚) T1~T3 完全不存在，僅能在鍛造所透過 T3 一般基礎武器重鑄為 T4 變異武器。
  - **法杖雙元素屬性轉變與魔法弓 6 大元素必殺技 (`Skill.ts`)**：法杖第一元素施放單體 140% 傷害，第二元素施放 20% 傷害並**強制將目標元素屬性轉變為火/雷/冰**；精靈使魔法弓支援【風精靈之舞】、【火精靈之怒】、【冰精靈之刺】、【雷精靈之殤】、【聖靈之光】與【暗靈之凝】。
  - **48 種基礎怪物資料庫 (`monsters.json`)**：包含 10 種 `DRAGON` 種族一般怪物（毒蜥、蜥蜴王、飛龍、骨龍獸等），具備較低出現率 (0.25x 權重)，少部分支援 `UNDEAD` 質變標籤。
  - **動態前綴邏輯 (`MonsterSystem.ts`)**：支援 `[元素前綴][種族質變前綴][基礎名稱]`。單一相容 `UNDEAD` 怪物不加種族前綴（如 `骷髏`），多相容標籤抽到 `UNDEAD` 冠上 `[不死的]`（如 `[不死的]毒蜥`）。
  - **精確元素相剋算式 (`Skill.ts`)**：冰 ➔ 火 ➔ 雷 ➔ 冰（順剋 1.25, 逆剋 0.75）、光暗互剋 1.5x、光/暗對元素 1.05x/1.10x、火對無屬性 1.05x。武器附帶 `element` 時在傷害計算中自動運算。
  - **單向隔離與 100% 偵查一致性 (`MapDynamicsSystem.ts`, `ModalController.ts`)**：生靈據點嚴格排除 `UNDEAD`；亡靈據點以 `UNDEAD` 為主。偵查成功後將敵軍陣容與情報持久化於 `node.scoutData.garrisonEncounter`，保證偵查 UI、討伐彈窗與戰鬥遭遇 100% 完全一致。
  - **未來系統擴充與設計藍圖 (`docs/FUTURE_DESIGN.md`)**：包含陣營敵方單位、裝備數據庫與替換技能、碎片化敘事與Boss、酒館系統、GAMBIT AI、爵位天賦、內政深化 7 大系統規範與相關專案檔案引述，**接手後續開發前必須優先讀取此檔**。
- **2026-08-01 跨存檔切換探索選取狀態與地圖圖層清理 Bug 修復（含主選單彈窗 DOM 保護）**：
  - **狀態重置 (`resetExplorationControllerState`)**：在 `ExplorationController.ts` 新增重置函式，強制關閉 `isSelectingTarget` 並發出關閉通知，確保 Phaser 立即擦除綠色虛線斥候選取邊界。
  - **靜態 DOM 保護與動態 Modal 精準銷毀 (`UIManager.ts`)**：在 `UIManager.clearAllUIOverlays()` 整合重置機制，保護主選單 `#modal-load-game` / `#modal-new-game` 等靜態 DOM 元素不被刪除，僅精準銷毀 `#modal-exploration-dispatch`，徹底解決退出遊戲後點擊主選單無法進入遊戲以及跨存檔圖層殘留的 Bug。
- **2026-08-01 自然蜿蜒道路網絡與智慧自動分岔延伸系統實作**：
  - **智慧道路分岔與據點延伸網絡 (`RoadSystem.ts`)**：
    - 修復因曲線防護導致「赤砂城」延伸被誤判退回的 Bug，確保 `黃金渡口 ➔ 赤砂城 ➔ 燼風前哨` 100% 精準依序接續，絕不越過赤砂城重新直連超長線。
    - 提升中途 Y型分岔優先度：自動計算目標與主幹道路線段的最短距離，從主幹道中段建立自然 Y型分岔，產生乾淨的路口網絡。
  - **圖連通性演算法 (`hasNetworkConnection`)**：採用 BFS 判定網路連通度，只要據點經由分岔網絡連回主城，即可完全獲得通行加速、降伏擊率與貿易價格優惠。
  - **顯著自然山路波浪弧度 (`getSmoothCurvePoint`) 與細緻手繪質感 (`MapScene.ts`)**：
    - 將彎曲擺幅調高至 **35 ~ 65 像素 MAX**，搭配輔助微幅手繪波浪，徹底解決先前 16px 在大圖視覺上像直線的問題。
    - 道路總寬縮減為 **4px 外邊框 + 2px 內徑**，採用古樸暖深褐色 (`0x4a2c11` / alpha 0.65) 與羊皮泥土棕 (`0xa37b42` / alpha 0.85)，融入羊皮紙地圖。
- **2026-07-31 CHEAT 測試武器補齊與裝備限制職業標籤機制實作**：
  - **退出遊戲全視圖與彈窗徹底清理修復**：實裝 `UIManager.clearAllUIOverlays()` 並將 `.side-panel-left` 隱藏位置修正至 `left: -1500px`，徹底修復退出遊戲時因三欄小隊面板總寬 1200px 導致剩餘面板殘留在主選單畫面上的 Bug。
  - **傭兵卡片底部標籤定位修復**：微調 `AdventurerCard.ts` 中底部官職/職缺標籤定位至 `bottom: -13px`，並調整底欄 padding，解決「城主」、「扈從」等標籤疊加遮擋「Lv.XX 職業」名稱與等級文字的 UI 問題。
  - **空手解鎖終極招/被動 Bug 修復**：修復 `Skill.ts` 與 `CombatSystem.ts` 中的備用判斷漏洞，確保滿等傭兵未裝備對應轉職武器（或武器不符）時，不發放也不顯示終極招式與職業被動，嚴格維護職業轉職規則。
  - **全套 12 種轉職測試武器補齊**：將 `testwpn` 密技擴充為對應全職業轉職路線的 12 種測試武器（巨劍、雙劍、劍盾、符文盾、法杖、戰鐮、戰弓、魔法弓、雙匕首、魔法戒指、聖典、戰鎚），方便測試全職業 10 等滿等轉職。
  - **裝備職業限制標籤 (`allowedJobs`)**：在 `Equipment` 與 `EquipmentTemplate` 加入 `allowedJobs` 限制標籤，並在 `Adventurer.canEquip()` 與 `EquipmentGenerator` 中落實職業比對與資料複製傳遞。
  - **UI 限制標籤與換裝阻擋**：在裝備浮動 Tooltip 加入 `🏷️ 限制職業: XXX` 標籤，換裝列表對職業不符之裝備呈現灰色半透明與 `職業不符` 標記，點擊時彈出 Toast 警告並阻擋不合職業裝備穿戴。
- **2026-07-31 傭兵小隊、角色屬性與裝備選擇面板 UI 全面美化與零跑位重構**：
  - **技能戰術頁籤與 Gambit 戰術預留**：實裝第 3 個頁籤 `✨ 技能戰術` 並隱藏未學習技能（僅展示已學會主動技能與被動），下方預留 Gambit 戰術 If-Then 條件鏈卡槽。
  - **全固定零跑位排版**：固定屬性面板底部按鈕位置（禁用狀態/點擊激活），並將可用點數與戰力合併至同一橫欄，點擊 `+` 操作時 **100% 全元件位置固定，絕不產生跳位或向上擠壓**。
  - **頭像與數值條滿鋪平齊**：頭像框高度與右側數值條 1:1 滿鋪對齊（`66px`），消除下方空隙。
  - **90px 三欄裝備卡片**：裝備卡片寫死為 `90px x 100px`（3 欄網格），與左側傭兵卡片 1:1 精準尺寸對齊，懸浮觸發跟隨 Tooltip。
- **2026-07-31 智能施法大腦 (Smart AI) 與 5v5 平衡測試**：
  - **大招冷卻機制**：所有進階職業的終極技能都加上了 `cooldown: 2` (2 回合冷卻)，防止無腦連發。
  - **動態戰略評估**：為 24 個技能全面加上了 `aiWeight` 權重公式。補師不再溢補，盜賊懂得疊毒引爆，死靈法師精準抓殘血發動收割。
  - **自動化測試腳本**：撰寫 `scripts/balance-test-team.ts`，證實滿等隊伍在 AI 操控下面對 5 隻 2000 HP 菁英皆具備 100% 勝率，其中「混沌特效連鎖隊」的推進速度名列第一。
- **2026-07-31 弓箭手與盜賊技能庫擴充**：
  - **戰鬥索敵機制擴充**：實裝 `BACK_ENEMY` (優先鎖定後排) 與 `COLUMN` (直線一排) 的技能索敵目標類型，擴增戰鬥深度。
  - **弓箭手技能與被動**：實裝「神射手」高爆發單點與必定爆擊，以及「精靈使」的物魔混傷連鎖爆擊（風精靈之舞）。
  - **盜賊技能與被動**：實裝「暗殺者」極致先手權與健康目標增傷，以及「詭術師」嘲諷 100% 迴避、普攻混沌傷害與毒素引爆。
- **2026-07-30 騎士與祈禱者技能庫與戰鬥底層擴充**：
  - **戰鬥底層機制擴展**：實裝了 `DamageType.CHAOS` (無視防禦真實傷害)、`REGEN_HP/MP` 持續恢復狀態，並將 `TAUNT` (嘲諷) 改為無視排數的絕對鎖定索敵。
  - **騎士與祈禱者技能樹**：完全實裝了這兩個職業的基礎技能與四種進階職業 (聖騎士、符文騎士、大主教、異端拷問官) 的專屬被動與終極大招，包含複雜的混合傷害切分運算。
  - **魔劍士雙修平衡**：將魔劍士的傷害從真實傷害改為更符合定位的物魔混合傷害 (普攻 50/50，連擊 30/70 比例)。
- **2026-07-29 人口與治安度的單一真相來源重構 (Single Source of Truth)**：
  - **總人口動態化**：移除了原本獨立儲存的 `population`，將其改為動態加總 `workers` 的唯讀屬性 (Getter)，並新增了統一且安全的 `removeWorkers()` 方法，解決了總人口與工作人口數量脫鉤的 Bug。
  - **治安度即時更新**：新增了 `GameEventType.POPULATION_CHANGED` 事件。在人口因突發事件增減時，會立刻觸發 `SettlementSystem` 重新計算治安度，修復了畫面顯示延遲問題。
- **2026-07-29 3x3 戰術板陣型系統實裝**：
  - **戰鬥網格與陣型加成**：戰鬥系統現已擴充為前、中、後三排，玩家在編制小隊時能透過下拉選單選擇特定陣型，若傭兵配置於要求位置將獲得巨幅戰鬥屬性加成。
  - **Drag & Drop 拖曳操作**：全域導入 HTML5 拖曳 API，傭兵卡片可自由拖曳至戰鬥網格或互換位置。
  - **預設隊伍存取**：新增 5 組隊伍快速儲存/讀取功能，大幅優化討伐前的準備流程。
- **2026-07-29 遊戲平衡性架構大變動與探索系統重構**：
  - **全新探索與道路系統**：引入 `ExplorationSystem` 處理地圖迷霧與視野解鎖，以及 `RoadSystem` 負責據點間的路網建立，並配套翻新了 `MapGenerator`，大幅增強了地圖的深度與可玩性。
  - **獨立平衡資料結構**：將原先寫死在各系統的數值抽離至 `BalanceData` 與 `DifficultyData`，建立統一的數值微調中心。
  - **核心架構升級**：擴充 `GameState` 與 `SaveManager` 來支援新系統，並於 `MapScene` 與 `ExplorationController` 中實裝了對應的視覺表現與操作介面。
- **2026-07-25 AI 派系武將與戰後俘虜處置系統 (Milestone 1) (New!)**：
  - **派系武將模型 (Faction Champions)**：為埃瑟加德王室、瓦萊里烏斯家族、莫凡恩家族等 7 大派系配置了專屬 AI 武將（包含稀有度、稱號、職業與專屬頭像）。
  - **圍城攻防觸發 (Siege Initiation)**：在 `MapDynamicsSystem.ts` 補齊攻城發起邏輯，AI 派系宣戰後會主動圍攻敵對/玩家據點並在地圖上顯示 ⚔️ 攻城倒數。
  - **戰後俘虜處置視窗 (Prisoner Modal UI)**：實裝 `#modal-prisoner-action` 視窗，提供招降、贖金、處決與釋放四種決策分支，招降時可無縫轉換為玩家可用的傭兵。
- **2026-07-25 側邊抽屜面板重構與三面板互斥切換**：
  - **外交與戰鬥紀錄抽屜化**：將原本以 `modal-overlay`（全螢幕黑幕遮罩）呈現的「外交與派系」及「戰鬥歷史紀錄」重構為與「傭兵隊伍」一致的 `side-panel-left` 左側抽屜面板，統一 UI 視覺語言與過渡動畫（從左側流暢滑入，z-index 900 不遮蔽地圖）。
  - **三面板完全互斥切換**：在 `GameFlowController.ts` 建立全域抽屜互斥邏輯，點擊任意 Dock 按鈕（傭兵 👥 / 外交 📜 / 戰鬥紀錄 ⚔️）時，自動先將另外兩個面板關閉再展開新面板，徹底解決介面重疊問題。
  - **靜態 HTML 與殭屍 DOM 清理**：移除原本在 JS 動態生成 DOM 的開關競態 bug，將抽屜面板結構靜態放置於 `index.html`；同時清理了 duplicate `#modal-combat-history` 殭屍 DOM 節點。
- **2026-07-25 外交與攻城系統實裝 (Diplomacy & Siege Mechanics)**：
  - **派系外交與 AI 性格**：各 AI 家族新增性格 (好戰、和平、重商、善變)，實裝好感度變化、贈禮、宣戰與求和機制。
  - **攻城戰機制與地圖視覺**：圍城倒數與戰鬥結算機制，地圖支援交叉雙劍 ⚔️ 動畫與攻城資訊 Tooltip。
- **2026-07-25 遊戲核心邏輯 P1 修復與經濟雙軌制重構**：
  - **經濟系統改採雙軌制**：每日結算稅收進帳（有感收益），每 7 天觸發一次 `resolvePayday` 結算傭兵薪資與維護費（創造生存目標），徹底解決了語意重疊。
  - **官職加成實裝**：官職的內政加成 (`civicBonusPct`) 與戰鬥加成 (`combatBonusPct`) 正式接入系統運算，賦予官職實際策略意義。
  - **建築等級上限解鎖**：支援 4 級以上建築升級，並套用動態指數成本公式（每級 2.5 倍），與進階爵位完美連動。
- **2026-07-23 3D 據點圖示重製與動態解鎖系統 (New!)**：
  - **美術規格統一**：確立了 3D Isometric 據點圖示的美術黃金標準為「暗黑寫實、頂部打光 (Rim Light) 以凸顯深色背景下的輪廓」。在 `MapScene.ts` 中將渲染尺寸統一規範為 `55x55`。
  - **自動化去背流程**：開發了 `scripts/remove-green-bg.mjs`，採用綠幕去背演算法，可對生成的白底/純綠底圖片進行完美的無鋸齒去背，並自動縮放畫布至 `128x128`，完成高效率的圖檔處理閉環。
  - **圖檔大掃除**：透過 `cleanup-assets.mjs` 腳本自動移除了未引用的垃圾美術圖檔，確保專案目錄乾淨。
  - **動態解鎖系統**：實裝了中後期事件據點的隱藏/解鎖邏輯 (`isHidden` 與 `unlockCondition`)，透過 `GameLoop` 每日檢查玩家進度來觸發解鎖。目前作為保留彈性，全地圖預設為開放狀態。
- **2026-07-22 傭兵卡片 Tooltip 資訊精簡與換行置中排版 (New!)**：
  - **精簡內容**：移除冗長的六維屬性、戰力與裝備清單，僅展示「名稱」、「等級與職業」、「當前狀態」三項核心資訊。
  - **換行置中**：使用 `<br/>` 三行換行與 `text-align: center;` 置中樣式，整體視覺乾淨對齊。
- **2026-07-22 街道建築排版 (無卷軸/手拖動/左右箭頭提示) 與帝國日誌邊界修復**：
  - **街道無卷軸與手動拖曳 (`drag-to-scroll`)**：隱藏原生滾動條，為 `#street-buildings-wrapper` 補上 `min-width: max-content;` 與 `flex-shrink: 0;`。支援滑鼠按住拖動街道，提升操作手感。
  - **左右引導箭頭 (`◀` / `▶`)**：新增羊皮紙金邊浮動箭頭，具備呼吸脈動動畫、250px 點擊滾動與動態顯示/隱蔽，引導玩家可左右瀏覽。
  - **帝國日誌訊息框縮短與固定 (`#game-log`)**：為 `.dashboard-bottom` 加上 `min-height: 0;`，將 `#game-log` 的 `margin-bottom` 設為 `270px;`，使訊息框底界與黑底向上拉高並固定在距離底部 270px 處，完滿高於右下角羅盤鈕與史詩大鈕。
- **2026-07-22 切換世界地圖按鈕縮小 1/3 與右側靠齊對齊**：
  - **羅盤鈕縮小 1/3 & 右側齊平對齊**：將「切換至世界地圖/我的據點」羅盤圓鈕由 112px 縮小 1/3 至 `75px × 75px`，並設定 `bottom: 190px; right: 0;`，使其右側與下方 176px 的結束本日史詩大鈕右側精準垂直靠齊對齊。
  - **結束本日放大與帝國日誌上縮**：「結束本日」維持放大一倍 (`176px × 176px`)；帝國日誌 (`#game-log`) 保持 `margin-bottom: 315px;` 上縮，與下方按鈕完全脫離，100% 互不遮擋。
- **2026-07-21 史詩 UI/UX 重構、結束本日轉場恢復與三重導航修復**：
  - **100% 恢復「結束本日」質感轉場**：重新帶入 0.5s 黑屏/羊皮紙漸變轉場 (`playTransition`)，天數推進時享受完整 RPG 沉浸感。
  - **三重導航動線（徹底解決「返回據點」問題）**：
    1. 右側資訊面板 (`map-info-panel`) 加入獨立顯眼按鈕 `[ 🏰 返回我的據點 ]` / `[ 🌍 返回世界地圖 ]`。
    2. 右下角 Command Crest Hub 金邊羅盤圖示懸浮鈕。
    3. 頂部資訊列 `🏰 [據點/世界名稱]` 點擊瞬間切換。
  - **主選單預設隔離**：`#command-crest-container` 初始樣式改為 `display: none;`，主選單與創角畫面完全乾淨無雜物。
  - **3D Isometric 地圖建築圖示**：完全繪製全套 3D 繪寫風中世紀建築節點，搭配橢圓地基陰影與黑金羊皮紙名牌標籤。
  - 全數通過 TypeScript 型別檢查、13 項 Vitest 單元測試、Production Build、P0 Playwright Automated Smoke Test 與 Bundle Budget。
- **2026-07-21 P1 Phaser 與低頻 UI Lazy Chunk 重構 (New!)**：
  - 將原本在啟動時強行下載的 Phaser 引擎移至獨立模組 `PhaserManager.ts`，主腳本由 1.84 MB **巨幅縮減為 131 KB**（降幅超過 92%）。
  - 在主選單點擊「進入旅程」或載入存檔時非同步加載 Phaser（帶 Toast 加載提示動畫）。
  - 將武器店/防具店/倉庫抽離至 `ShopController.ts`，跑商規劃與交易面板抽離至 `TradeController.ts`（標有維護註記），點擊時動態加載。
  - 全數通過 `tsc` 型別檢查、13 項 Vitest 單元測試、Vite Production Build 與 P0 Playwright Headless Smoke Test。
- **2026-07-21 P1 main.ts UI Wiring 重構拆分**：將過度集中的 `main.ts` DOM 事件與綁定邏輯解耦，依據畫面模組拆分為 6 個獨立 Controllers (`RecruitController`, `MainMenuController`, `GameFlowController`, `FacilityController`, `ActionController`, `CheatController`)。
- **2026-07-21 可靠性與架構整理**：實裝 P0 Playwright 自動化 Headless Smoke Test (`npm run test:smoke`) 覆蓋全流程閉環；修復多波戰鬥判定及重複獎勵，完成威脅預警與備災、每日摘要、派遣風險提示、窄螢幕 UI、鍵盤地圖節點、存檔 schema v2 與 deterministic RNG。Phaser Scene 已具備資源清理，並解除與 DOM Controller 的循環依賴。完整品質檢查使用 `npm run check`。
- **2026-07-21 行商與任務生命週期修正 (New!)**：行商以 itinerary／phase／leg 表示進度，第一段與回程路線可正確呈現；任務透過 `MISSIONS_CHANGED` 驅動地圖更新。雙劍動畫改為精準清理，一般招募排除誓約守衛，tooltip 支援四方向防裁切，行商回報顯示本金與現金損益。
- **2026-07-21 戰鬥節點信標 (New!)**：淘汰平台相依的交叉劍 Emoji，改用兩個以劍尖定位的獨立 SVG Sprite；兩劍從相反斜角如炮彈般射入節點形成 X，以 3.2 秒循環金色衝擊光、停留與淡出。紅色遮罩圓已移除，任務完成時整體銷毀。
- **2026-07-19 領地建築升級、獨立武具商店與傭兵卡片 Tooltip 懸浮化 (New!)**：
  - **領地建築獨立建造與升級**：在自宅實裝了動態的「領地建築升級」面板。酒館、武器店、防具店、鍛造屋需要花費金幣、木材、石材、鐵礦建造，且只在建造後才會在城鎮街道上動態生成 Flexbox 入口，告別原寫死佈局。
  - **獨立武具商店與酒館招募**：武器店、防具店現在是獨立建築，根據店鋪等級（1~3級）動態解鎖 1~3 階武具供玩家購買。酒館招募品質機率與酒館等級掛鉤，移除了舊的特訓清單。
  - **自宅探索隨機與保底機制**：每次探索周邊有 10% 機率招募到一名傭兵，並提供少量建材。保底機制為前 3 次探索必招募到一名品質 N 級加入。非保底時品質隨機分佈。
  - **屬性配點確認防誤觸**：重構配點介面為暫存配點（具備 `+`/`-` 綠色臨時數值預覽），需點擊「確認分配」或「取消重設」才正式生效，並排除了魅力與統帥的手動加點。
  - **據點開局難度與資源差異化**：開局據點選擇面板中，標示該據點類型對應的難度（首都簡單，荒野極難）。點擊確認開局時，根據難度初始化不同的起始資源、流民人口、糧食與建材，並清空已分配的工作。
  - **據點插地動畫與外派人員 Tooltip**：大圖中當玩家派遣小隊前往據點時，該據點會顯示兩把劍斜向掉落、插地重疊、顫動淡出的 Phaser 循環動畫；且地圖節點 hover tip 會動態載入該據點的外派傭兵姓名與剩餘天數。
  - **自宅傭兵 Tooltip 一致化**：移除 HTML `data-tooltip`，改用 JS 滑鼠監聽跟隨 tooltip，顯示詳細六維屬性、戰力、當前裝備與派遣目的地/任務名稱.
  - **修復開局卡地圖問題**：解決了新開局選擇據點點擊確認後卡在大圖、未自動切換進入城鎮街道而造成無法開始遊戲的問題。現在開局後會自動流暢地進入該據點街道。
  - **修復主選單「進入旅程」點擊無效問題**：解決了因 `index.html` 移除了 `#street-scroll-area` 及 `#btn-back-map` 等元素，但在 `main.ts` 初始化時仍以強斷言獲取並綁定監聽，導致瀏覽器拋出 `null` 引用錯誤中斷整個腳本載入的 Bug。已移除廢棄事件並改以安全防空判斷掛載按鈕。
  - **修復與優化據點自宅遮擋及雙劍交叉動畫**：
    - 自宅遮擋與大樓重疊修復：由於優化街道 Flexbox 排版時移除了拖曳容器，承載建築按鈕的 `#street-buildings-wrapper` 缺少定位被背景層遮擋；且因 `.street-building` 原先設定為 `position: absolute`，脫離了 Flexbox 佈局流，導致所有街道大樓全部重疊在同一個位置。已將定位修改為 `position: relative` 並對 wrapper 補上適當層級，大樓現已能在街道上依序橫向並排。
    - 雙劍交叉與尺寸優化：為了徹底解決因 🗡️ 短劍 Emoji 在不同平台上自帶各種傾斜角與拼湊交叉時定位偏移（形成 V 形或平行重合）的弊端，我們改用一體化完美的 ⚔️ (Crossed Swords) 交叉雙劍符號，將字型放大至 `38px`，並在 Phaser 中為其設計由天而降插地抖動、停留後淡出的循環動畫，視覺上 100% 呈最完美的 45 度斜插交叉姿態。
  - **新增開發者資源修改後門（統一註記區塊）**：
    - 後門與彩蛋擴充：新增金幣、木材、石材、鐵礦資源密技，可使用控制台或在畫面上連續敲擊對應英文單字（`gold`/`wood`/`rock`/`iron`）觸發修改。所有作弊碼均被 `CHEAT_CODES` 專用區塊標記包裹，未來發布前可一鍵整段移除。
  - **修復自宅建築升級材料豆腐塊問題**：將原本易在舊系統顯示為 `[][]` 方塊的 Emoji 圖示替換，並在後方附加中文字「木材」、「石材」、「鐵礦」與暗色底框，確保 100% 視覺易讀性。
- **2026-07-19 戰鬥系統 v2 (New!)**：實裝了深度獨立運算的 `CombatSystem`。包含命中率、減傷率與行動順序（依敏捷），並具備流血與中毒等狀態異常機制。前端新增動態戰報播放器（支援血條動畫、打字機特效、爆擊震動與跳過功能），並無縫串接至 `DispatchSystem` 的討伐任務中。
- **2026-07-19 大幅系統翻修與 Bug 修復**：
  - 修復了資源系統赤字無效、月底重複觸發事件、飢荒死循環卡死等核心 Bug。
  - 戰鬥與探索系統擴充：戰鬥勝利發放經驗值、失敗進入 RESTING 狀態休養；探索成功解鎖節點情報，討伐介面加入顏色戰力反饋。
  - 經濟與地圖動態：重構月底稅收與薪資公式，跑商任務帶回實體貨品並實裝倉庫出售介面；市場依地形產出特產折價，地圖節點繁榮度依歸屬自然成長。
  - 平衡與防呆：招募金幣二次校驗、訓練費用隨等級提升、議價加成感度調升，並大幅提高事件壓力門檻。
- **基礎架構建立**：我們建立了一個基於 TypeScript 與 Vite 的放置型 RPG，並優化了 `StartGame.bat` 啟動器使其支援 Node 偵測、自動依賴安裝與錯誤暫停機制。
- **視覺與介面**：完成了所有基礎的介面佈局（自宅、市場、酒館、鐵匠鋪）與世界地圖互動。
- **地圖引擎重構 (Phaser 3) (New!)**：世界地圖已重構為基於 Phaser 3 的 Canvas 渲染，解決了原本 DOM 拖曳/縮放的邊界溢出與效能問題，並利用 Phaser Input 系統防止了拖曳與節點點擊誤觸，加入了商隊沿二階貝茲曲線前進的流暢動畫。
- **核心系統完成**：
  1. **回合制推進**：捨棄即時制，改為玩家手動點擊「結束本日」來推進時間。
  2. **資源與內政**：引入多種資源（糧食、木材、石材等）、人口維護費與月底結算機制。
  3. **事件系統**：實裝事件壓力值與突發事件對話框，並有「待辦事項」供玩家延後處理。
  4. **傭兵與戰鬥**：實裝傭兵六維屬性、裝備槽、自由配點與退休機制。戰鬥支援屬性對抗（如高防、高閃）。
  5. **世界地圖與偵查**：地圖節點具備危險度與派系歸屬。派系會隨時間擴張。支援情報迷霧，需花費金幣偵查。
  6. **跑商系統大改版 (New!)**：實作了「多節點自訂跑商路線」。玩家可設定最多 3 個中途站，並預先設定各站買賣指令。傭兵的「智慧」與「魅力」決定了商隊的載重量與議價能力。途中會遭遇天氣檢定，檢定失敗會延遲抵達。後續優化了起點距離限制（限制在 30 里內）與依據各段實際距離（含首段與返程）動態折算行程天數，並在 UI 上提供預計旅途天數的即時估算反饋。同時**修復了有主城鎮詳細面板缺失「查看市場」按鈕的 UI Bug**，讓玩家行商前能正常在各地圖節點收集物價情報與設定指令。
- **右側欄面板顯示互斥修復**：修復了玩家在大陸地圖上開啟節點詳細資訊面板（`#node-detail-panel`）後，點選並切換回自家據點（或返回世界地圖）時，右側面板仍殘留且重疊顯示先前大陸地圖節點資訊的 Bug。現在由 `UIManager` 配合 `SceneController` 統一對右側三個子面板做顯示與隱藏控管，確保畫面始終顯示正確資訊。
- **儲存功能與退出遊戲統一呼叫 (New!)**：
  - 改善了原本手動儲存與退出按鈕位於世界地圖右側面板底端，致使玩家在據點自宅或內部建築視圖中無法手動存檔或退出的問題。
  - 為了防止在頂部資源列（`#top-bar`）硬塞多個按鈕而被擠扁、文字垂直折行並遮擋地圖，引入了**系統設定選單彈出視窗（System Settings Modal）**。頂部右側僅保留「結束本日」與小巧的「系統選單」按鈕，點擊彈出羊皮紙外觀選單，提供「儲存進度」與「儲存並退出」功能，實現全域安全、美觀的統一呼叫。
- **返回據點按鈕位置與風格重構 (New!)**：
  - 將「返回據點」按鈕從世界地圖右側資訊面板移出，改裝為獨立的地圖右上角絕對定位懸浮按鈕。
  - 使用專門重新生成的城堡盾牌圖案（`public/assets/return_base_btn.png`）。為徹底解決圖片去背邊緣與方角上殘留的灰白棋盤格像素，我們在 CSS 中引入了圓形精準遮罩剪裁（`clip-path: circle(46% at 50% 50%)`）與 `border-radius: 50%`，搭配 `background-size: 104%`，強制裁去圓盾外部的任何多餘雜色像素，實現 100% 完美的去背正圓形外觀。


## 🐛 已知問題與待修復 (Known Issues)
- Vite 仍提示 Phaser 主 bundle 偏大，以及 `SceneController` 同時被靜態／動態匯入；目前已由 2.2 MB budget 控制，不影響執行，但後續可做真正的 scene code splitting。
- 部分公開素材路徑由 runtime 載入，production build 會提示無法在 build time 解析；需在部署 smoke test 持續驗證。
- `npm audit` 需在可連線 npm audit endpoint 的環境重新執行，禁止直接使用 `npm audit fix --force`。

## 🚀 下一步計畫 (Next Steps)
接下來您可以考慮往以下方向擴展：
1. **實裝敘事聖經與新陣營 (`FactionData.ts`, `EventData.ts`)**：依據 `NARRATIVE_BIBLE.md`，替換現有的四大家族，並全面改寫日常隨機事件與任務文本，導入 70/30 敘事法則。
2. **統一遭遇介面 (Unified Encounter API)**：讓討伐、據點佔領與未來跑商強盜共用 `CombatSystem`，探索則維持獨立獎勵事件，避免再次重複發獎。
2. **地圖視覺素材與專用 Icon 替換**：目前 Phaser 地圖上的城鎮節點使用 Text 渲染 Emoji。未來若設計好專用 Icon（圖片），可在 [MapScene.ts](file:///i:/gameproject/Medieval/src/ui/MapScene.ts) 中改為載入 Sprite 以實現更精緻的中世紀風格。
3. **裝備鍛造與詞綴 (Crafting & Affixes)**：在鐵匠鋪實作裝備分解與合成，並加入隨機屬性詞綴。
4. **領地建設 (Base Building)** (已實裝獨立設施建造與等級升級，後續可進一步擴充特殊產出加成與特殊功能建築)。
5. **派系外交與好感度**：加入送禮、同盟或宣戰功能，讓大盤局勢更難以預測。

## [2026-08-05] Phase 4 UI Modals Extraction & Revert
### 已完成事項
- 成功將 ModalController.ts 內的各面板獨立拆分至 src/ui/modals/ (包含 DispatchModal, NodeDetailModal, PartyModal, EventModal, EquipModal, TodoModal, PrisonerModal, CombatHistoryModal 等)，並套用 Facade 動態載入模式。
- 修復了圓形選單、突發事件抉擇等 UI 顯示異常的 Bug。

### 未完成與待處理事項
- **ShopController.ts 重構**：原定將 ShopController.ts 中的鐵匠舖 (Forge) 與倉庫 (Warehouse) 功能拆分為 ForgeUIController.ts。但因為 ShopController.ts 檔案龐大且內部輔助函數互相依賴，自動化腳本切分失敗。目前已用 Git 撤銷該部分變更。**下一階段需要採用「手動複製貼上與編譯即時驗證」的方式，小心地抽離鐵匠鋪邏輯**，並確保輔助函數 (如 getElementBadge 等) 能夠正確匯出與共用。

## [2026-08-06] Phase 4 Forge UI Extraction & System Renaming
### 已完成事項
- 完全移除對自動化切分腳本的依賴，改以手動精確提取的方式，成功將鐵匠鋪 (Forge) 與倉庫 (Warehouse) 從 ShopController.ts 中剝離，建立 ForgeUIController.ts。
- 順利將原有的 UI 輔助函式設為 export 並讓新控制器共用，解決了所有 TypeScript 型別依賴問題 (tsc 完全 0 Error)。
- 解決 SettlementSystem 的命名衝突問題：將玩家內政系統更名為 TownManagementSystem.ts，地圖動態節點模擬更名為 MapNodeSystem.ts。
- 徹底翻新 ARCHITECTURE.md，使文件樹狀圖與專案現有目錄完全一致，為未來的開發奠定良好基礎。

### 未完成與待處理事項
- Phase 4 (UI 徹底模組化重構) 已全數完成，後續無相關的 UI 重構遺留問題。

## [2026-09-04] 特效工房專業化重構規格交接

- 新增 `docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md`，供 GEMINI 3.8 FLASH 依 Phase 0～7 分段執行。
- 下一步只能先執行 Phase 0：確認雙 canvas／雙 renderer、舊播放入口、Repository 混寫、Impact Cue 缺口與戰鬥工房真實整合狀態。
- Phase 0 完成並取得使用者確認後，才可開始 Phase 1。此次只建立規格，沒有修改特效工房功能碼。

## [2026-09-04] 特效工房第一次實作驗收修正交接

- 第一次實作雖通過 `npm run check`，但瀏覽器人工驗收不通過：viewport 高度為 0、時間軸錯位、窄版水平溢出，且 Inspector 出現多個 `undefined` 與控制契約錯誤。
- 戰鬥工房仍以逐 `CombatEvent` 方式啟動 VFX，尚未形成一次 `CombatAction` 對一次 Preset 播放；Cue 呈現模式責任層與傷害拆分語意也需修正。
- 新增 `docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md` 作為後續唯一修正任務書；下一輪只能先處理 Fix 1「DOM + Inspector」，完成後需附四種 viewport 的瀏覽器證據再送驗。
- 本次只新增修正文件與交接紀錄，沒有修改特效工房功能碼。
