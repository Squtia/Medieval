import { MapNode, NodeFeature, NodeLevel, TerrainType, WeatherType } from '../src/models/types';
import { monsterSystem } from '../src/systems/MonsterSystem';
import { MapEventSystem } from '../src/systems/map/MapEventSystem';

function runTests() {
  console.log('🧪 === [開始動態據點威脅擴張與主題鎖定測試] ===\n');

  // 1. 建立動態據點
  const dynamicNode: MapNode = {
    id: 'dyn_test_1',
    name: '未知的怪物巢穴',
    x: 10,
    y: 10,
    population: 0,
    prosperity: 0,
    nodeLevel: NodeLevel.WILDERNESS,
    ownerFactionId: null,
    isPlayerBase: false,
    terrain: TerrainType.FOREST,
    feature: NodeFeature.MONSTER_NEST,
    isScouted: false,
    scoutExpiryDate: null,
    currentWeather: WeatherType.CLEAR,
    weatherDuration: 0,
    isDynamic: true,
    baseDifficulty: 1,
    expansionCount: 0
  };

  // 2. 首次偵查
  console.log('👁️ 1. 執行首次偵查 (Day 1)...');
  MapEventSystem.resolveScout(dynamicNode, 1);
  const initialMonsterId = dynamicNode.establishedBaseMonsterId;
  const initialAffix = dynamicNode.establishedAffix;
  const initialName = dynamicNode.name;
  const initialPower = dynamicNode.scoutData?.garrisonPower || 0;

  console.log(`- 據點定名: ${initialName}`);
  console.log(`- 主題怪物: ${initialMonsterId}`);
  console.log(`- 據點詞綴: ${initialAffix || '無'}`);
  console.log(`- 初次戰力: ${initialPower}, 難度: ${dynamicNode.baseDifficulty}`);

  if (!initialMonsterId || dynamicNode.name.startsWith('未知的') || !dynamicNode.isScouted) {
    throw new Error('❌ 首次偵查定型失敗');
  }
  console.log('✅ 首次偵查成功定型主題與名稱！\n');

  // 3. 第 31 天情報過期，觸發第 1 次擴張
  console.log('⏳ 2. 第 31 天情報過期，觸發威脅擴張...');
  MapEventSystem.checkScoutExpiry([dynamicNode], 31);

  if (dynamicNode.isScouted !== false || dynamicNode.expansionCount !== 1 || dynamicNode.baseDifficulty !== 2) {
    throw new Error(`❌ 擴張判定異常: isScouted=${dynamicNode.isScouted}, expansions=${dynamicNode.expansionCount}, diff=${dynamicNode.baseDifficulty}`);
  }
  console.log(`✅ 據點成功擴張！擴張次數: ${dynamicNode.expansionCount}, 新難度: ${dynamicNode.baseDifficulty}，情報重回迷霧！\n`);

  // 4. 第 2 次偵查 (驗證主題鎖定與難度升級)
  console.log('👁️ 3. 執行第二次偵查 (Day 32)...');
  MapEventSystem.resolveScout(dynamicNode, 32);
  const secondMonsterId = dynamicNode.establishedBaseMonsterId;
  const secondAffix = dynamicNode.establishedAffix;
  const secondPower = dynamicNode.scoutData?.garrisonPower || 0;

  console.log(`- 據點名稱: ${dynamicNode.name} (維持原名)`);
  console.log(`- 主題怪物: ${secondMonsterId} (應與初次 ${initialMonsterId} 相同)`);
  console.log(`- 二次戰力: ${secondPower} (應高於初次 ${initialPower})`);

  if (secondMonsterId !== initialMonsterId) {
    throw new Error(`❌ 主題怪物發生變異！原: ${initialMonsterId}, 現: ${secondMonsterId}`);
  }
  if (secondAffix !== initialAffix) {
    throw new Error(`❌ 據點詞綴發生變異！原: ${initialAffix}, 現: ${secondAffix}`);
  }
  if (secondPower < initialPower) {
    throw new Error(`❌ 增援後戰力未增加！初次: ${initialPower}, 現: ${secondPower}`);
  }
  console.log('✅ 擴張增援成功保持同一主題怪物，戰力正常提升！\n');

  // 5. 連續推進，驗證擴張上限 (最多 2 次)
  console.log('⏳ 4. 測試擴張上限防呆...');
  MapEventSystem.checkScoutExpiry([dynamicNode], 63); // 觸發第 2 次擴張
  console.log(`- 擴張 2 次後: expansionCount=${dynamicNode.expansionCount}, diff=${dynamicNode.baseDifficulty}`);
  if (dynamicNode.expansionCount !== 2 || dynamicNode.baseDifficulty !== 3) {
    throw new Error('❌ 第 2 次擴張失敗');
  }

  MapEventSystem.resolveScout(dynamicNode, 64);
  MapEventSystem.checkScoutExpiry([dynamicNode], 95); // 嘗試第 3 次擴張
  console.log(`- 嘗試第 3 次擴張後: expansionCount=${dynamicNode.expansionCount}, diff=${dynamicNode.baseDifficulty}`);
  if (dynamicNode.expansionCount !== 2 || dynamicNode.baseDifficulty !== 3) {
    throw new Error('❌ 擴張上限防呆失效，超過了 2 次上限');
  }
  console.log('✅ 擴張上限防呆機制運作正常，上限鎖定為 2 次！\n');

  // 6. 驗證固定據點不受影響
  console.log('🏰 5. 驗證大地圖固定據點不觸發擴張...');
  const staticNode: MapNode = {
    id: 'static_node_1',
    name: '遠古遺跡副本',
    x: 20,
    y: 20,
    population: 0,
    prosperity: 0,
    nodeLevel: NodeLevel.DUNGEON,
    ownerFactionId: null,
    isPlayerBase: false,
    terrain: TerrainType.RUINS,
    feature: NodeFeature.DUNGEON,
    isScouted: true,
    scoutExpiryDate: 30,
    currentWeather: WeatherType.CLEAR,
    weatherDuration: 0,
    isDynamic: false,
    baseDifficulty: 5
  };

  MapEventSystem.checkScoutExpiry([staticNode], 31);
  if (staticNode.expansionCount !== undefined || staticNode.baseDifficulty !== 5) {
    throw new Error('❌ 固定據點錯誤觸發了擴張');
  }
  console.log('✅ 大地圖固定據點維持原有標準，不參與隨機擴張！\n');

  console.log('🎉 === [動態據點威脅擴張與主題鎖定全部測試 100% 通過] ===\n');
}

runTests();
