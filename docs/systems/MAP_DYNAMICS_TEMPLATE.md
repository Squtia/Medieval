# 地圖動態系統架構 (Map Dynamics System)

地圖系統原本集中於單一肥大檔案 `MapDynamicsSystem.ts`。為落實模組化並提高可維護性，目前該檔案已轉型為**外觀模式 (Facade Pattern)**，將實際的業務邏輯委派給 `src/systems/map/` 資料夾下的多個專責模組。

## 📁 模組化結構

- `src/systems/MapDynamicsSystem.ts`: 負責對外接口的 Facade。
- `src/systems/map/FactionSystem.ts`: 負責處理所有「派系 (Faction)」相關的邏輯。例如派系好感度增減、宣戰/停戰、擴張領土與攻城戰判定。
- `src/systems/map/SettlementSystem.ts`: 負責處理「據點/村落 (Settlement)」的發展。例如繁榮度的自然增長與減少、玩家手動投資、升級/降級、以及建國遷徙。
- `src/systems/map/MapEventSystem.ts`: 負責處理「地圖事件 (Events)」。包含天氣輪替、派遣斥候與情報過期、解鎖新據點，以及動態生成野怪巢穴。
- `src/systems/map/MapUtils.ts`: 存放地圖座標計算（如距離公式）等純函式工具。

---

## 🛠️ 新增或修改功能的指南

如果您需要新增地圖相關功能，請依據其性質，寫在對應的模組中，**絕對避免**再度將大量邏輯塞回 `MapDynamicsSystem.ts`。

### 1. 新增派系互動事件？
👉 **修改目標**：`FactionSystem.ts` 中的 `processAIFactionsInteractions`。
**情境範例**：若想加入「商業同盟」機制，讓具有特定特性的派系能互相簽訂貿易協定，請在 `FactionSystem` 增加一個處理同盟邏輯的 Hook，並讓 Facade 負責呼叫它。

### 2. 更改據點升降級或繁榮度公式？
👉 **修改目標**：`SettlementSystem.ts` 中的 `simulateProsperity`。
**情境範例**：如果希望「遇到瘟疫事件時繁榮度下降 50%」，請實作在 `SettlementSystem`，並透過 EventBus 發送狀態通知，或在事件發生時直接操作 `MapNode` 屬性。

### 3. 加入新的天氣或隨機迷霧事件？
👉 **修改目標**：`MapEventSystem.ts` 中的 `updateWeather` 或 `spawnDynamicNode`。
**情境範例**：若要新增「血月」天氣，先至 `WeatherType` 新增 Enum，然後在 `updateWeather` 寫入觸發機率。如果是要生成新的資源點，修改 `spawnDynamicNode` 中的 `feature` 賦值邏輯。

## ⚠️ 開發注意事項

1. **Facade 職責**：`MapDynamicsSystem.ts` 僅負責持有 `mapNodes` 與 `factions` 的參照，並在外部呼叫（如 `simulateMapDynamics`）時，將這些陣列傳入子模組中處理。不要在 Facade 中寫實作。
2. **事件驅動 (EventBus)**：地圖系統有許多更新會影響 UI（如繁榮度變更、攻城開始），更新數據後務必透過 `EventBus.getInstance().publish(...)` 發布事件，讓 UI (React/Phaser) 自動響應。
3. **無狀態模組**：`FactionSystem`、`SettlementSystem`、`MapEventSystem` 目前皆以 Static Methods (靜態方法) 實作。這保證了它們只是純粹的邏輯處理器，不持有狀態（狀態依然由 GameState / MapDynamicsSystem 統一保管）。
