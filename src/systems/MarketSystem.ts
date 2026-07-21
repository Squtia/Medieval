import { MapNode, NodeLevel, TradeGood, WeatherType, TerrainType } from '../models/types';
import { Random } from '../core/Random';

export const TRADE_GOODS: TradeGood[] = [
  { id: 'tg_wheat', name: '小麥', description: '基礎糧食，平原多產。', basePrice: 10, type: 'FOOD', icon: '🌾' },
  { id: 'tg_meat', name: '獸肉', description: '高營養食物，森林與荒野多產。', basePrice: 20, type: 'FOOD', icon: '🥩' },
  { id: 'tg_timber', name: '木材', description: '基礎建材，森林特產。', basePrice: 15, type: 'MATERIAL', icon: '🌲' },
  { id: 'tg_stone', name: '石材', description: '進階建材，山地特產。', basePrice: 20, type: 'MATERIAL', icon: '🧱' },
  { id: 'tg_iron', name: '鐵礦石', description: '金屬材料，火山與雪山常見。', basePrice: 30, type: 'MATERIAL', icon: '⛓️' },
  { id: 'tg_spice', name: '香料', description: '沙漠地帶的昂貴特產。', basePrice: 100, type: 'LUXURY', icon: '🧂' },
  { id: 'tg_silk', name: '絲綢', description: '首都與大城市才有的奢侈品。', basePrice: 150, type: 'LUXURY', icon: '🧵' },
  { id: 'tg_ice_crystal', name: '冰晶', description: '雪山獨有的魔法素材。', basePrice: 80, type: 'SPECIALTY', icon: '❄️' },
  { id: 'tg_obsidian', name: '黑曜石', description: '火山深處出產的堅硬礦石。', basePrice: 90, type: 'SPECIALTY', icon: '💎' }
];

export class MarketSystem {
  /**
   * 初始化節點市場資料
   */
  public static initMarket(node: MapNode, currentDay: number): void {
    // 只有村莊以上有市場
    if (node.nodeLevel < NodeLevel.VILLAGE) return;

    node.marketData = {
      lastUpdateDay: currentDay,
      goods: []
    };
    
    // OPT-05: 地形特產必定出現，其餘隨機補充至 3~5 種
    const TERRAIN_SPECIALTY: Partial<Record<string, string[]>> = {
      PLAINS:        ['tg_wheat'],
      FOREST:        ['tg_timber', 'tg_meat'],
      SNOW_MOUNTAIN: ['tg_ice_crystal', 'tg_stone'],
      VOLCANO:       ['tg_obsidian', 'tg_iron'],
      DESERT:        ['tg_spice']
    };

    const specialtyIds = TERRAIN_SPECIALTY[node.terrain] ?? [];
    const specialtyGoods = specialtyIds
      .map(id => TRADE_GOODS.find(g => g.id === id))
      .filter(Boolean) as typeof TRADE_GOODS;

    const numGoods = Random.int(3, 5);
    const otherGoods = TRADE_GOODS.filter(g => !specialtyIds.includes(g.id));
    const shuffled = [...otherGoods].sort(() => 0.5 - Random.next());
    const extras = shuffled.slice(0, Math.max(0, numGoods - specialtyGoods.length));
    const selected = [...specialtyGoods, ...extras];

    for (const good of selected) {
      let multiplier = 1.0;
      
      // 地形特產半價（原產地優惠）
      if (node.terrain === TerrainType.DESERT && good.id === 'tg_spice') multiplier = 0.5;
      if (node.terrain === TerrainType.SNOW_MOUNTAIN && good.id === 'tg_ice_crystal') multiplier = 0.5;
      if (node.terrain === TerrainType.VOLCANO && good.id === 'tg_obsidian') multiplier = 0.5;
      if (node.terrain === TerrainType.FOREST && good.id === 'tg_timber') multiplier = 0.5;
      if (node.terrain === TerrainType.PLAINS && good.id === 'tg_wheat') multiplier = 0.5;
      if (node.terrain === TerrainType.SNOW_MOUNTAIN && good.id === 'tg_stone') multiplier = 0.5;
      if (node.terrain === TerrainType.VOLCANO && good.id === 'tg_iron') multiplier = 0.6;
      if (node.terrain === TerrainType.FOREST && good.id === 'tg_meat') multiplier = 0.6;

      const baseValue = good.basePrice * multiplier;
      const fluctuation = 0.8 + Random.next() * 0.4; // 0.8 ~ 1.2
      const finalPrice = Math.max(1, Math.floor(baseValue * fluctuation));

      node.marketData.goods.push({
        goodId: good.id,
        buyPrice: Math.floor(finalPrice * 1.2), // 買入價較貴
        sellPrice: finalPrice,                  // 賣出價較低
        stock: Random.int(0, 49) + 10 * node.nodeLevel // 依據等級決定庫存
      });
    }
  }

  /**
   * 更新市場價格 (受天氣與繁榮度影響)
   */
  public static updateMarkets(nodes: MapNode[], currentDay: number): void {
    for (const node of nodes) {
      if (node.nodeLevel < NodeLevel.VILLAGE) {
        node.marketData = undefined;
        continue;
      }
      
      if (!node.marketData) {
        this.initMarket(node, currentDay);
      } else {
        // 每 7 天更新一次物價
        if (currentDay - node.marketData.lastUpdateDay >= 7) {
          node.marketData.lastUpdateDay = currentDay;
          
          for (const item of node.marketData.goods) {
            const goodRef = TRADE_GOODS.find(g => g.id === item.goodId);
            if (!goodRef) continue;

            let modifier = 1.0;

            // 繁榮度影響: 繁榮度越高，奢侈品需求越高(價格漲)，但基礎物資穩定
            if (node.prosperity > 300 && goodRef.type === 'LUXURY') {
              modifier *= 1.2;
            }

            // 天氣影響
            if (node.currentWeather === WeatherType.RAIN && goodRef.type === 'FOOD') modifier *= 0.9; // 雨天豐收
            if (node.currentWeather === WeatherType.SNOW && goodRef.type === 'FOOD') modifier *= 1.5; // 暴雪缺糧
            if (node.currentWeather === WeatherType.SANDSTORM && goodRef.type === 'MATERIAL') modifier *= 1.3; // 沙暴缺建材
            
            const fluctuation = 0.8 + Random.next() * 0.4;
            const newBase = goodRef.basePrice * modifier * fluctuation;
            
            item.buyPrice = Math.max(1, Math.floor(newBase * 1.2));
            item.sellPrice = Math.max(1, Math.floor(newBase));
            
            // 補充庫存
            item.stock += Random.int(0, 19);
          }
        }
      }
    }
  }
}
