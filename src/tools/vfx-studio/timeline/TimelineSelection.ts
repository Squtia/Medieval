/**
 * 🎯 TimelineSelection
 * 時間軸選取狀態管理模組 (Timeline Selection State Manager)
 * 負責管理當前被選取的 Cue、Clip 或 Track，並向外觸發 Inspector 連動事件
 */
export type SelectedTrackInfo = { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null;

export class TimelineSelection {
  private selectedCueIndex: number | null = null;
  private selectedClipIndex: number | null = null;
  private selectedTrack: SelectedTrackInfo = null;

  private onSelectCueCallback?: (cueIndex: number | null) => void;
  private onSelectTrackCallback?: (trackInfo: SelectedTrackInfo) => void;

  public getSelectedCueIndex(): number | null {
    return this.selectedCueIndex;
  }

  public getSelectedClipIndex(): number | null {
    return this.selectedClipIndex;
  }

  public getSelectedTrack(): SelectedTrackInfo {
    return this.selectedTrack;
  }

  public selectCue(index: number | null): void {
    this.selectedCueIndex = index;
    if (index !== null) {
      this.selectedClipIndex = null;
      this.selectedTrack = { type: 'CUE', index };
    }
    this.onSelectCueCallback?.(index);
    if (this.selectedTrack) {
      this.onSelectTrackCallback?.(this.selectedTrack);
    }
  }

  public selectTrack(trackInfo: SelectedTrackInfo): void {
    this.selectedTrack = trackInfo;
    if (trackInfo?.type !== 'CUE') {
      this.selectedCueIndex = null;
    }
    this.onSelectTrackCallback?.(trackInfo);
  }

  public selectClip(index: number | null): void {
    this.selectedClipIndex = index;
    if (index !== null) {
      this.selectedCueIndex = null;
    }
  }

  public onSelectCue(cb: (cueIndex: number | null) => void): void {
    this.onSelectCueCallback = cb;
  }

  public onSelectTrack(cb: (trackInfo: SelectedTrackInfo) => void): void {
    this.onSelectTrackCallback = cb;
  }

  public clearSelection(): void {
    this.selectedCueIndex = null;
    this.selectedClipIndex = null;
    this.selectedTrack = null;
    this.onSelectCueCallback?.(null);
    this.onSelectTrackCallback?.(null);
  }
}
