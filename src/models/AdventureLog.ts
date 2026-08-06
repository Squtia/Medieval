export type SegmentType = 'TEXT' | 'COMBAT_LINK';

export interface AdventureLogSegment {
  type: SegmentType;
  content: string; // 若為 TEXT，就是敘事段落；若為 COMBAT_LINK，則是戰報 ID
}

export interface AdventureLogEntry {
  id: string;              // 唯一識別碼
  day: number;             // 發生在第幾天
  squadLeaderName: string; // 隊長名稱
  nodeName: string;        // 探險地點
  segments: AdventureLogSegment[]; // 文字段落或戰鬥按鈕
}
