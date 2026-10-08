import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decorations } from '../../src/library/bookshelf-design';
import { decorationAssets, decorationColor } from './bookshelf-decor';

describe('published decoration pack', () => {
  it('covers every saved editor identifier with local images and attributable sources', () => {
    const provenance = JSON.parse(
      readFileSync(
        new URL('../public/assets/decorations/sources.json', import.meta.url),
        'utf8',
      ),
    );
    expect(Object.keys(decorationAssets).sort()).toEqual(
      decorations.map(([id]) => id).sort(),
    );
    let bytes = 0;
    for (const [id, asset] of Object.entries(decorationAssets)) {
      expect(asset.naturalColor).toMatch(/^#[a-f0-9]{6}$/);
      for (const path of [asset.src, asset.mask, asset.thumbnail]) {
        expect(path).toMatch(
          /^\/assets\/decorations\/[a-z-]+(?:\.mask|\.thumb)?\.webp$/,
        );
        const image = readFileSync(
          new URL(`../public${path}`, import.meta.url),
        );
        expect(image.toString('ascii', 0, 4)).toBe('RIFF');
        expect(image.toString('ascii', 8, 12)).toBe('WEBP');
        if (path === asset.src)
          expect(createHash('sha256').update(image).digest('hex')).toBe(
            provenance.assets[id].renderSha256,
          );
        bytes += image.length;
      }
      for (const source of provenance.assets[id].sources) {
        expect(source.license).toBe('CC0-1.0');
        expect(source.url).toMatch(/^https:\/\/polyhaven.com\/a\/[\w]+$/);
        expect(Object.keys(source.authors).length).toBeGreaterThan(0);
      }
    }
    expect(bytes).toBeLessThan(5 * 1024 * 1024);
  });

  it('keeps legacy default colors on original materials and retains chosen colors', () => {
    expect(decorationColor('fern', '#72865b')).toBe(
      decorationAssets.fern.naturalColor,
    );
    expect(decorationColor('vase', '#b18a60')).toBe(
      decorationAssets.vase.naturalColor,
    );
    expect(decorationColor('vase', '#b83347')).toBe('#b83347');
  });
});
