import { afterEach, describe, expect, it, vi } from 'vitest';
import { askJson } from './ai.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('standalone reports', () => {
  it('makes no network request without an optional Gemini key', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await askJson('system', 'metrics')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses the direct Gemini endpoint and returns its JSON', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key'); vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-flash');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"headline":"Stable freight"}' }] } }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await askJson('system', 'metrics')).toEqual({ headline: 'Stable freight' });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns control to built-in feedback without contacting another provider on failure', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetcher); vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await askJson('system', 'metrics')).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects invalid AI JSON for the report fallback', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'invalid JSON' }] } }] }))));
    expect(await askJson('system', 'metrics')).toBeNull();
  });
});
