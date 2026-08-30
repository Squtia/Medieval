import { describe, it, expect } from 'vitest';
import { renderUniversalIcon, renderUniversalPortrait } from './IconSpriteHelper';

describe('IconSpriteHelper - ?flip Modifier Tests', () => {
  it('renders standard icon without transform scaleX(-1)', () => {
    const html = renderUniversalIcon('weapons:GREATSWORD', 40);
    expect(html).toContain('universal-icon-sprite');
    expect(html).not.toContain('transform: scaleX(-1);');
  });

  it('renders flipped icon with transform scaleX(-1) when ?flip suffix is present', () => {
    const html = renderUniversalIcon('weapons:GREATSWORD?flip', 40);
    expect(html).toContain('universal-icon-sprite');
    expect(html).toContain('transform: scaleX(-1);');
  });

  it('renders emoji fallback with transform scaleX(-1) when ?flip is appended', () => {
    const html = renderUniversalIcon('👺?flip', 40);
    expect(html).toContain('👺');
    expect(html).toContain('transform: scaleX(-1);');
  });

  it('renders portrait with transform scaleX(-1) when ?flip is appended', () => {
    const standardHtml = renderUniversalPortrait('guardian_m_0', 44);
    const flippedHtml = renderUniversalPortrait('guardian_m_0?flip', 44);

    expect(standardHtml).not.toContain('transform: scaleX(-1);');
    expect(flippedHtml).toContain('transform: scaleX(-1);');
  });
});
