import { NAME_DATA } from '../data/NameData';
import { Random } from '../core/Random';

export class NameGenerator {
  /**
   * 隨機生成一個帶有姓氏與名字的全名
   */
  public static generateFullName(): string {
    const isMale = Random.next() > 0.5;
    const firstNames = isMale ? NAME_DATA.maleFirstNames : NAME_DATA.femaleFirstNames;
    const fn = Random.pick(firstNames);
    
    // 有機率產生帶有稱號的名字 (例如：亞拉里克·疤面)，或一般貴族/平民姓氏 (例如：伊萊亞斯·鐵木)
    const hasTitle = Random.next() > 0.7;
    
    if (hasTitle) {
      const title = Random.pick(NAME_DATA.titles);
      return `${fn}·${title}`;
    } else {
      const ln = Random.pick(NAME_DATA.surnames);
      return `${fn}·${ln}`;
    }
  }
}
