import { NAME_DATA } from '../data/NameData';

export class NameGenerator {
  /**
   * 隨機生成一個帶有姓氏與名字的全名
   */
  public static generateFullName(): string {
    const isMale = Math.random() > 0.5;
    const firstNames = isMale ? NAME_DATA.maleFirstNames : NAME_DATA.femaleFirstNames;
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    
    // 有機率產生帶有稱號的名字 (例如：亞拉里克·疤面)，或一般貴族/平民姓氏 (例如：伊萊亞斯·鐵木)
    const hasTitle = Math.random() > 0.7;
    
    if (hasTitle) {
      const title = NAME_DATA.titles[Math.floor(Math.random() * NAME_DATA.titles.length)];
      return `${fn}·${title}`;
    } else {
      const ln = NAME_DATA.surnames[Math.floor(Math.random() * NAME_DATA.surnames.length)];
      return `${fn}·${ln}`;
    }
  }
}
