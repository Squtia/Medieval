/**
 * [已廢棄 - DEPRECATED]
 * 舊版強盜勒索與純數值侵襲機制已徹底廢除。
 * 所有領地威脅與突發事件 100% 統一由 NarrativeSystem (故事工坊) 與 TerritoryDefenseModalController 接管。
 */
export class ExtortionModalController {
  private static instance: ExtortionModalController;
  public static getInstance(): ExtortionModalController {
    if (!ExtortionModalController.instance) {
      ExtortionModalController.instance = new ExtortionModalController();
    }
    return ExtortionModalController.instance;
  }
  public show() {
    console.warn('[ExtortionModalController] 舊版勒索事件已廢除，請使用故事工坊事件！');
  }
  public hide() {}
}
