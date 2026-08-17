import { BUILTIN_STORIES } from '../data/StoryData';
import { NarrativeStory } from '../models/Narrative';
import projectStories from '../data/custom_stories.json';

const TEST_STORAGE_KEY = 'MEDIEVAL_STORY_TEST_PAYLOAD';

function cloneStories(stories: NarrativeStory[]): NarrativeStory[] {
  return JSON.parse(JSON.stringify(stories));
}

export class NarrativeContentStore {
  static getPublishedStories(): NarrativeStory[] {
    if (import.meta.env.DEV && typeof location !== 'undefined' && typeof localStorage !== 'undefined') {
      const token = new URLSearchParams(location.search).get('storyTest');
      if (token) {
        try {
          const payload = JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) ?? 'null');
          if (payload?.token === token && Array.isArray(payload.stories)) return cloneStories(payload.stories);
        } catch {
          console.warn('[NarrativeContentStore] 故事測試資料無法解析，改用專案內容。');
        }
      }
    }
    const sourceStories = projectStories as NarrativeStory[];
    return cloneStories(sourceStories.length > 0 ? sourceStories : BUILTIN_STORIES);
  }
}
