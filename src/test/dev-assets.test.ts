import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('standalone application assets', () => {
  it('keeps a downloaded image beside every provenance pointer', () => {
    const pointers = readdirSync(resolve(root, 'src/assets')).filter(p => p.endsWith('.asset.json'));
    expect(pointers.length).toBeGreaterThan(0);
    for (const pointer of pointers) {
      const local = resolve(root, 'src/assets', pointer.replace(/\.asset\.json$/, ''));
      expect(existsSync(local), pointer).toBe(true);
      const bytes = readFileSync(local);
      expect([...bytes.subarray(0, 8)], pointer).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });

  it('resolves every mapped sprite and charter background to a local file', () => {
    for (const file of ['src/game/render/steam-art.ts', 'src/game/render/building-sprites.ts', 'src/routes/index.tsx']) {
      const text = source(file);
      const paths = [...text.matchAll(/from ['"](@\/assets\/[^'"]+)['"]/g)].map(m => m[1]);
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path?.endsWith('.asset.json')).toBe(false);
        expect(existsSync(resolve(root, 'src', path?.slice(2) ?? ''))).toBe(true);
      }
    }
  });

  it('has no platform runtime packages or image proxy', () => {
    const pkg = JSON.parse(source('package.json'));
    const packages = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(packages.filter(p => p.startsWith('@lovable.dev/'))).toEqual([]);
    expect(source('vite.config.ts')).not.toMatch(/lovable|__l5e/i);
  });

  it('loads fonts from downloaded files rather than a font host', () => {
    const cssPath = 'src/assets/fonts.css';
    const css = source(cssPath);
    const paths = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
    expect(paths).toHaveLength(7);
    for (const path of paths) {
      expect(path).not.toMatch(/^https?:/);
      expect(existsSync(resolve(root, dirname(cssPath), path ?? ''))).toBe(true);
    }
    expect(source('src/routes/__root.tsx')).not.toMatch(/fonts\.googleapis/);
  });
});
