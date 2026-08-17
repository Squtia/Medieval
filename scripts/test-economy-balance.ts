import { EventBus } from '../src/core/EventBus';
import { GameEventType } from '../src/core/GameEvents';
import { GameState, initGameState } from '../src/core/GameState';
import { createSeededRandom, Random } from '../src/core/Random';
import { GameDifficulty } from '../src/models/WorldGeneration';
import { NodeLevel, WorkerJob, getNodeMaxFacilityLevel } from '../src/models/types';
import { BountySystem } from '../src/systems/BountySystem';
import { MapNodeSystem } from '../src/systems/map/MapNodeSystem';
import { TavernSystem } from '../src/systems/TavernSystem';

type FacilityType = 'farmland' | 'lumberMill' | 'quarry' | 'huntingGround';
type BuildingType = 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense';

interface EconomySnapshot {
  day: number;
  gold: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
  population: number;
  prosperity: number;
  nodeLevel: NodeLevel;
  adventurers: number;
  highestHeroLevel: number;
}

interface EconomyReport {
  difficulty: GameDifficulty;
  snapshots: EconomySnapshot[];
  minimumGold: number;
  minimumFood: number;
  firstFoodDepletionDay: number | null;
  firstDebtDay: number | null;
  bankruptcyDay: number | null;
  starvationDay: number | null;
  milestoneDays: Partial<Record<NodeLevel, number>>;
}

const facilityProperty: Record<FacilityType, string> = {
  farmland: 'farmlandLevel',
  lumberMill: 'lumberMillLevel',
  quarry: 'quarryLevel',
  huntingGround: 'huntingGroundLevel'
};

const baseGuardRequirement: Record<NodeLevel, number> = {
  [NodeLevel.WILDERNESS]: 0,
  [NodeLevel.CAMP]: 2,
  [NodeLevel.VILLAGE]: 5,
  [NodeLevel.TOWN]: 15,
  [NodeLevel.CAPITAL]: 40
};

function getPlayerNode() {
  const node = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  if (!node) throw new Error('經濟模擬找不到玩家據點。');
  return node;
}

function assignBalancedWorkers(): void {
  const territory = GameState.myTerritory;
  const population = territory.population;
  const node = getPlayerNode();
  const requiredGuards = Math.min(
    population,
    baseGuardRequirement[node.nodeLevel] + Math.floor(population * 0.1)
  );
  const productivePopulation = Math.max(0, population - requiredGuards);
  const highSecurityMultiplier = requiredGuards > 0 || population < 10 ? 1.2 : 0.7;
  const dailyConsumption = population + GameState.adventurers.length + requiredGuards;
  const desiredFarmers = Math.min(
    productivePopulation,
    Math.ceil(dailyConsumption / (3 * territory.getFacilityMultiplier('farmland') * highSecurityMultiplier))
  );
  const remaining = Math.max(0, productivePopulation - desiredFarmers);
  const woodcutters = Math.ceil(remaining * 0.55);
  const miners = Math.floor(remaining * 0.35);
  const hunters = Math.max(0, remaining - woodcutters - miners);

  territory.workers = {
    [WorkerJob.UNASSIGNED]: 0,
    [WorkerJob.FARMER]: desiredFarmers,
    [WorkerJob.HUNTER]: hunters,
    [WorkerJob.WOODCUTTER]: woodcutters,
    [WorkerJob.MINER]: miners,
    [WorkerJob.INFANTRY]: requiredGuards,
    [WorkerJob.ARCHER]: 0,
    [WorkerJob.CAVALRY]: 0
  };
}

function tryUpgradeOneFacility(): boolean {
  const territory = GameState.myTerritory;
  const node = getPlayerNode();
  const maxLevel = getNodeMaxFacilityLevel(node.nodeLevel);
  const priorities: FacilityType[] = ['farmland', 'lumberMill', 'quarry', 'huntingGround'];

  for (const type of priorities) {
    const currentLevel = territory.getFacilityLevel(type);
    const nextLevel = currentLevel + 1;
    if (nextLevel > maxLevel) continue;
    const cost = territory.getFacilityUpgradeCost(type, nextLevel);
    if (
      territory.gold >= cost.gold &&
      territory.wood >= cost.wood &&
      territory.stone >= cost.stone &&
      territory.iron >= cost.iron
    ) {
      territory.gold -= cost.gold;
      territory.wood -= cost.wood;
      territory.stone -= cost.stone;
      territory.iron -= cost.iron;
      (territory as any)[facilityProperty[type]] = nextLevel;
      return true;
    }
  }
  return false;
}

function tryUpgradeOneBuilding(): boolean {
  const territory = GameState.myTerritory;
  const node = getPlayerNode();
  if (node.nodeLevel < NodeLevel.CAMP) return false;

  const priorities: BuildingType[] = ['tavern', 'defense', 'weapon', 'armor', 'forge'];
  for (const type of priorities) {
    if (territory.upgradeBuilding(type, node.nodeLevel)) return true;
  }
  return false;
}

function tryRecruitOneAdventurer(difficulty: GameDifficulty): void {
  const territory = GameState.myTerritory;
  const rosterTarget = difficulty === GameDifficulty.HARD ? 2 : 3;
  if (GameState.adventurers.length >= rosterTarget || territory.tavernGuests.length === 0) return;

  const guest = territory.tavernGuests[0];
  const price = Math.floor(500 * (guest.adventurer.trait.recruitmentModifier ?? 1));
  const reserve = difficulty === GameDifficulty.HARD ? 200 : 500;
  if (territory.gold < price + reserve) return;

  territory.gold -= price;
  guest.adventurer.locationNodeId = territory.currentCountryId;
  GameState.adventurers.push(guest.adventurer);
  territory.tavernGuests.shift();
}

function captureSnapshot(day: number): EconomySnapshot {
  const territory = GameState.myTerritory;
  const node = getPlayerNode();
  return {
    day,
    gold: territory.gold,
    food: territory.food,
    wood: territory.wood,
    stone: territory.stone,
    iron: territory.iron,
    population: territory.population,
    prosperity: node.prosperity,
    nodeLevel: node.nodeLevel,
    adventurers: GameState.adventurers.length,
    highestHeroLevel: Math.max(...GameState.adventurers.map(adventurer => adventurer.level))
  };
}

function simulateDifficulty(difficulty: GameDifficulty): EconomyReport {
  Random.setSource(createSeededRandom(`economy-${difficulty}-v1`));
  initGameState({ difficulty, seed: `economy-world-${difficulty}` });
  GameState.totalDays = 0;
  GameState.currentDay = 1;

  const report: EconomyReport = {
    difficulty,
    snapshots: [],
    minimumGold: GameState.myTerritory.gold,
    minimumFood: GameState.myTerritory.food,
    firstFoodDepletionDay: null,
    firstDebtDay: null,
    bankruptcyDay: null,
    starvationDay: null,
    milestoneDays: { [NodeLevel.WILDERNESS]: 1 }
  };
  let consecutiveDebtDays = 0;

  for (let day = 1; day <= 360; day += 1) {
    GameState.totalDays = day;
    GameState.currentDay = ((day - 1) % 30) + 1;
    assignBalancedWorkers();

    EventBus.getInstance().publish({
      type: GameEventType.DAY_PASSED,
      payload: { daysPassed: 1, currentTimestamp: day }
    });
    if (day % 7 === 0) GameState.system.resolvePayday();

    BountySystem.processDailyTick(GameState);
    BountySystem.claimAllCompletedBounties(GameState);
    BountySystem.autoDispatchAllBounties(GameState);

    tryUpgradeOneFacility();
    tryUpgradeOneBuilding();
    TavernSystem.updateTavernGuests(GameState.myTerritory);
    tryRecruitOneAdventurer(difficulty);
    MapNodeSystem.simulateProsperity(GameState.mapSystem.getNodes());

    const territory = GameState.myTerritory;
    const node = getPlayerNode();
    if (report.milestoneDays[node.nodeLevel] === undefined) report.milestoneDays[node.nodeLevel] = day;
    report.minimumGold = Math.min(report.minimumGold, territory.gold);
    report.minimumFood = Math.min(report.minimumFood, territory.food);
    if (territory.food <= 0 && report.firstFoodDepletionDay === null) report.firstFoodDepletionDay = day;
    if (territory.gold < 0) {
      consecutiveDebtDays += 1;
      if (report.firstDebtDay === null) report.firstDebtDay = day;
      if (consecutiveDebtDays >= 14 && report.bankruptcyDay === null) report.bankruptcyDay = day;
    } else {
      consecutiveDebtDays = 0;
    }
    if (territory.population <= 0 && territory.food <= 0 && report.starvationDay === null) {
      report.starvationDay = day;
    }
    if (day === 30 || day === 180 || day === 360) report.snapshots.push(captureSnapshot(day));
  }

  return report;
}

function printReport(report: EconomyReport): void {
  console.log(`\n=== ${report.difficulty === GameDifficulty.NORMAL ? '普通' : '困難'}難度：平衡型自動策略 ===`);
  console.table(report.snapshots.map(snapshot => ({
    天數: snapshot.day,
    金幣: snapshot.gold,
    糧食: snapshot.food,
    木材: snapshot.wood,
    石材: snapshot.stone,
    鐵礦: snapshot.iron,
    人口: snapshot.population,
    繁榮: snapshot.prosperity,
    據點: NodeLevel[snapshot.nodeLevel],
    傭兵: snapshot.adventurers,
    最高等級: snapshot.highestHeroLevel
  })));
  console.log({
    minimumGold: report.minimumGold,
    minimumFood: report.minimumFood,
    firstFoodDepletionDay: report.firstFoodDepletionDay,
    firstDebtDay: report.firstDebtDay,
    bankruptcyDay: report.bankruptcyDay,
    starvationDay: report.starvationDay,
    milestoneDays: report.milestoneDays
  });
}

(globalThis as any).window = globalThis;
const nativeMathRandom = Math.random;
const nativeConsoleLog = console.log;
Math.random = () => Random.next();

try {
  console.log = () => undefined;
  const reports = [
    simulateDifficulty(GameDifficulty.NORMAL),
    simulateDifficulty(GameDifficulty.HARD)
  ];
  console.log = nativeConsoleLog;

  for (const report of reports) {
    if (report.snapshots.length !== 3 || report.snapshots.some(snapshot => !Number.isFinite(snapshot.gold) || snapshot.population < 0)) {
      throw new Error(`${report.difficulty} 經濟模擬產生無效結果。`);
    }
    printReport(report);
  }
  console.log('\n經濟模擬完成。這是固定策略的基準線，不代表真人玩家的最佳路線。');
} finally {
  console.log = nativeConsoleLog;
  Math.random = nativeMathRandom;
  Random.reset();
}
