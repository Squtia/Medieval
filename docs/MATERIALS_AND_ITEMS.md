# 道具、素材與特產權威手冊 (Materials & Items Handbook)

本文件為《中世紀傭兵團經營 RPG》全遊戲道具、素材、特產物資與附魔石之**唯一權威規範**。所有系統、事件、鍛造所、裝備改造所、商店與戰利品掉落所使用之素材，**必須 100% 登記於本文件與 `src/data/materials.json`**。

---

## 🗺️ 1. 跑商與地圖特產物資 (Trade Goods)

專用於領地貿易、地圖特產與城鎮市場。

| 素材 ID | 繁體中文名稱 | 圖標代碼 | 類型 | 產地 / 取得途徑 | 基礎價值 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tg_wheat` | 小麥 | `icons_materials:icons_materials_0` | 糧食 | 平原特產、村莊購買 | 10 金 |
| `tg_cotton` | 棉麻 | `icons_materials:icons_materials_1` | 紡織 | 平原特產、農田生產 | 4 金 |
| `tg_meat` | 獸肉 | `icons_materials:icons_materials_2` | 糧食 | 森林/荒野特產、獵場生產 | 5 金 |
| `tg_hide` | 生皮 | `icons_materials:icons_materials_3` | 原料 | 森林狩獵特產、獵場生產 | 5 金 |
| `tg_timber` | 原木 | `icons_materials:icons_materials_4` | 建築/基礎素材 | 森林特產、伐木場生產 | 4 金 |
| `tg_stone` | 石材 | `icons_materials:icons_materials_5` | 建築/基礎素材 | 山地特產、採石場生產 | 6 金 |
| `tg_iron` | 鐵礦石 | `icons_materials:icons_materials_6` | 金屬/鍛造素材 | 火山/雪山特產、礦坑生產 | 8 金 |
| `tg_spice` | 香料 | `icons_materials:icons_materials_7` | 奢侈品 | 沙漠特產、商隊貿易 | 25 金 |
| `tg_silk` | 絲綢 | `icons_materials:icons_materials_8` | 奢侈品 | 首都與大都市特產 | 35 金 |
| `tg_ice_crystal` | 冰晶 | `icons_materials:icons_materials_9` | 魔法/鍛造素材 | 雪山特產 | 18 金 |
| `tg_obsidian` | 黑曜石 | `icons_materials:icons_materials_10` | 高階/鍛造素材 | 火山深處特產 | 20 金 |
| `tg_wool` | 羊毛 | `icons_materials:icons_materials_11` | 紡織 | 平原牧場特產 | 6 金 |
| `tg_herbs` | 草藥 | `icons_materials:icons_materials_12` | 藥劑 | 森林與沼澤特產 | 12 金 |
| `tg_salt` | 海鹽 | `icons_materials:icons_materials_13` | 調味/防腐 | 沿海城鎮特產 | 8 金 |

---

## ⚒️ 2. 鍛造素材與怪物戰利品 (Crafting Materials)

專用於鍛造所武器裝備製作、T4 變異武器重鑄、防具強化與改造所詞條洗鍊。

| 素材 ID | 繁體中文名稱 | 圖標代碼 | 素材階級 | 主要掉落/來源 | 鍛造用途 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mat_iron_ingot` | 鐵錠 | `icons_materials:icons_materials_14` | T1 | 精鍊鐵礦石 / 強盜山寨討伐 | 基礎武器/裝備鍛造 |
| `mat_gold_ingot` | 金錠 | `icons_materials:icons_materials_15` | T2 | 精鍊黃金 / 貴族城堡戰利品 | 高級飾品與裝備 |
| `mat_hard_leather` | 硬化皮革 | `icons_materials:icons_materials_16` | T2/T3 | 巨型野獸/狼王戰利品 | 鍛造 T4 複合強弓與皮甲 |
| `mat_magic_wood` | 精靈木 | `icons_materials:icons_materials_17` | T2/T3 | 枯木精靈/深林巢穴戰利品 | 法杖與弓箭類高級木材 |
| `mat_magic_steel` | 融煉魔鋼 | `icons_materials:icons_materials_18` | T3/T4 | 哥布林王/魔化礦山戰利品 | **魔劍士專用**：重鑄 T4 雙劍 |
| `mat_lich_ash` | 死靈骨灰 | `icons_materials:icons_materials_19` | T3/T4 | 不死族巫妖/古墓戰利品 | **死靈法師專用**：重鑄 T4 戰鐮 |
| `mat_spirit_crystal` | 精靈水晶 | `icons_materials:icons_materials_20` | T3/T4 | 元素精靈/泉水巢穴戰利品 | **精靈使專用**：重鑄 T4 魔法弓 |
| `mat_rune_metal` | 符文金屬 | `icons_materials:icons_materials_21` | T3/T4 | 符文石巨人/古遺跡戰利品 | **符文騎士專用**：重鑄 T4 符文盾 |
| `mat_phantom_gem` | 幻影寶石 | `icons_materials:icons_materials_22` | T3/T4 | 幻影蜘蛛/迷幻森林戰利品 | **詭術師專用**：重鑄 T4 魔法戒指 |
| `mat_holy_steel` | 熔煉神鋼 | `icons_materials:icons_materials_23` | T3/T4 | 審判教團/神聖巢穴戰利品 | **異端拷問官專用**：重鑄 T4 戰鎚 |
| `mat_meteoric_ore` | 隕鐵礦石 | `icons_materials:icons_materials_24` | T3/T4 | 隕石坑地形/火山深處戰利品 | 鍛造 T4 隕鐵巨劍 |
| `mat_mana_core` | 魔力核心 | `icons_materials:icons_materials_25` | T3/T4 | 大魔導士/元素巨像戰利品 | 鍛造 T4 賢者法杖 |
| `mat_venom_gland` | 毒腺 | `icons_materials:icons_materials_26` | T2/T3 | 毒蜥/毒蛛戰利品 | 鍛造 T4 毒牙雙刃與塗毒 |
| `mat_holy_water` | 聖水 | `icons_materials:icons_materials_27` | T2/T3 | 教會/聖所戰利品 | 鍛造 T4 恩典聖典 |

---

## 🔮 3. 五大元素附魔石 (Enchanting Stones)

專用於鐵匠鋪為武器或防具附加屬性元素（火/冰/雷/暗/聖）。

| 素材 ID | 繁體中文名稱 | 圖標代碼 | 元素屬性 | 主要掉落/來源 | 附魔效果 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mat_enchant_fire` | 熾火精魄石 | `icons_materials:icons_materials_28` | 🔥 `FIRE` | 火山巢穴 / 熔岩蜥首領 | 武器附加火屬性攻擊 / 防具附加火防禦 |
| `mat_enchant_ice` | 極寒冰魄石 | `icons_materials:icons_materials_29` | ❄️ `ICE` | 雪山之巔 / 冰原狼群討伐 | 武器附加冰屬性攻擊 / 防具附加冰防禦 |
| `mat_enchant_thunder` | 迅雷閃電石 | `icons_materials:icons_materials_30` | ⚡ `LIGHTNING` | 荒野雷暴遺跡 / 迅雷飛龍 | 武器附加雷屬性攻擊 / 防具附加雷防禦 |
| `mat_enchant_dark` | 暗蝕魔晶石 | `icons_materials:icons_materials_31` | 🌑 `DARK` | 亡靈墓穴 / 死靈騎士戰利品 | 武器附加暗屬性攻擊 / 防具附加暗防禦 |
| `mat_enchant_holy` | 聖光祈願石 | `icons_materials:icons_materials_32` | ☀️ `HOLY` | 神聖大教堂 / 異端裁判所 | 武器附加聖屬性攻擊 / 防具附加聖防禦 |

---

## 🔒 4. 素材新增與維護規範

1. **嚴禁代碼私自創設**：若未來增加新系統需要新素材，必須先更新本文件與 `src/data/materials.json`，通過團隊稽核後方可寫入業務代碼。
2. **圖示規範 (Universal Icon System)**：全素材一律使用 `icons_materials:icons_materials_X` 圖集標識符，支援透過全圖集圖標工坊 (`icon-studio.html`) 或裝備工坊 (`equipment-studio.html`) 進行視覺化檢視與設定。
