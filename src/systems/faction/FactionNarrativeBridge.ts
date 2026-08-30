import { FactionProfile } from '../../models/FactionProfile';
import { MapNode } from '../../models/types';
import { CampaignStepResult } from './FactionCampaignSystem';

export interface NarrativeInterpolationContext {
  targetNode?: MapNode;
  controllingFaction?: FactionProfile;
  playerRankTitle?: string;
  isWarZone?: boolean;
}

export class FactionNarrativeBridge {
  /**
   * 將重大戰略戰役事件轉譯為酒館流動傳聞與歷史日誌
   */
  public static translateCampaignToRumors(stepResults: CampaignStepResult[]): string[] {
    const rumors: string[] = [];

    for (const res of stepResults) {
      switch (res.event) {
        case 'ARRIVED_AT_TARGET':
          rumors.push(`🍻 [酒館傳聞] 旅人驚恐地低語：「戰火點燃了！大軍昨夜已將要塞團團包圍，據說投石機的轟鳴響徹雲霄...」`);
          break;
        case 'CITY_FALLEN':
          rumors.push(`📜 [大陸捷報] 吟遊詩人傳唱著新的史詩：「城門已破！古老的城旗被斬落，這片土地迎來了新的統治者！」`);
          break;
        case 'SIEGE_REPELLED':
          rumors.push(`🍻 [酒館傳聞] 醉醺醺的傭兵大笑：「那幫不可一世的侵略者踢到了鐵板，在城垛守軍的箭雨下狼狽退兵了！」`);
          break;
        case 'RAID_COMPLETED':
          rumors.push(`🐎 [商旅快訊] 逃難的商隊傳來消息：「邊境村落遭到洗劫，近期的糧價恐怕要翻倍飆漲了...」`);
          break;
        default:
          break;
      }
    }

    return rumors;
  }

  /**
   * 故事工坊動態文字插值器 (免除創作者手寫多套分支的文本負擔)
   */
  public static interpolateStoryText(rawText: string, context: NarrativeInterpolationContext): string {
    let result = rawText;

    if (context.targetNode) {
      result = result.replace(/\{NODE_NAME\}/g, context.targetNode.name);
    }

    if (context.controllingFaction) {
      result = result.replace(/\{NODE_OCCUPIER\}/g, context.controllingFaction.factionName);
      const mainLeader = context.controllingFaction.champions?.[0]?.name || context.controllingFaction.factionName;
      result = result.replace(/\{NODE_RULER_NAME\}/g, mainLeader);
    } else {
      result = result.replace(/\{NODE_OCCUPIER\}/g, '當前領主');
      result = result.replace(/\{NODE_RULER_NAME\}/g, '領地統治者');
    }

    if (context.playerRankTitle) {
      result = result.replace(/\{PLAYER_TITLE\}/g, context.playerRankTitle);
    }

    // 戰況氛圍文字自適應插值
    const warAtmosphere = context.isWarZone
      ? '城內戒備森嚴，全副武裝的衛兵在要塞城垛上來回巡邏，空氣中瀰漫著硝煙味。'
      : '城內市集繁華熙攘，四處洋溢著吟遊詩人的歌聲與商旅的叫賣聲。';
    result = result.replace(/\{WAR_ATMOSPHERE\}/g, warAtmosphere);

    return result;
  }

  /**
   * 故事工坊三大沙盒狀態條件判定 (供劇情節點條件使用)
   */
  public static checkSandboxCondition(
    conditionType: 'IS_NODE_CONTROLLED_BY' | 'IS_FACTION_AT_WAR' | 'IS_FACTION_STARVING',
    params: { nodeId?: string; factionId?: string },
    factions: FactionProfile[],
    nodes: MapNode[]
  ): boolean {
    const factionMap = new Map<string, FactionProfile>(factions.map(f => [f.id, f]));
    const nodeMap = new Map<string, MapNode>(nodes.map(n => [n.id, n]));

    if (conditionType === 'IS_NODE_CONTROLLED_BY' && params.nodeId && params.factionId) {
      const node = nodeMap.get(params.nodeId);
      return node?.ownerFactionId === params.factionId;
    }

    if (conditionType === 'IS_FACTION_AT_WAR' && params.factionId) {
      const faction = factionMap.get(params.factionId);
      return (faction?.atWarWith || []).length > 0;
    }

    if (conditionType === 'IS_FACTION_STARVING' && params.factionId) {
      const faction = factionMap.get(params.factionId);
      return (faction?.economy.grainDays ?? 100) <= 0;
    }

    return true;
  }
}
