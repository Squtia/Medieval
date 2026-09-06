import fs from 'fs';
import path from 'path';

// 1. Patch BasicAttackVfxRepository.test.ts
const repoTestFile = path.resolve('src/systems/combat/BasicAttackVfxRepository.test.ts');
let repoTestContent = fs.readFileSync(repoTestFile, 'utf8');

const mockBlock = `
// 標準 Node 環境 localStorage Mock 實作
const testStorage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => testStorage.has(key) ? testStorage.get(key)! : null),
  setItem: vi.fn((key: string, val: string) => { testStorage.set(key, String(val)); }),
  removeItem: vi.fn((key: string) => { testStorage.delete(key); }),
  clear: vi.fn(() => { testStorage.clear(); }),
  get length() { return testStorage.size; },
  key: vi.fn((idx: number) => Array.from(testStorage.keys())[idx] ?? null)
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});
`;

if (!repoTestContent.includes('localStorageMock')) {
  repoTestContent = repoTestContent.replace(
    /describe\('BasicAttackVfxRepository/,
    mockBlock + "\ndescribe('BasicAttackVfxRepository"
  );
  fs.writeFileSync(repoTestFile, repoTestContent, 'utf8');
  console.log('Successfully patched BasicAttackVfxRepository.test.ts');
} else {
  console.log('Already patched');
}
