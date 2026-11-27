import { expect, it } from 'vitest';
import vm from 'node:vm';
import { LX_PRESETS, presetScript } from '@/services/lxSource/presets';

// test/unit/services/lxPresets.test.ts
// 内置音源必须在隔离运行时里成功初始化并声明 musicUrl 能力，否则递归换源不会使用它。

type InitPayload = { sources?: Record<string, { actions?: string[] }> } | null;

const initialize = (code: string): InitPayload => {
    let inited: InitPayload = null;
    const sandbox: Record<string, unknown> = { console, setTimeout, clearTimeout };
    sandbox.globalThis = sandbox;
    sandbox.lx = {
        version: '2.0.0', env: 'mobile', currentScriptInfo: {},
        EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
        on: () => Promise.resolve(),
        send: (_name: string, data: typeof inited) => { inited = data; return Promise.resolve(); },
        request: (_url: string, _options: unknown, callback: (error: Error | null, response: unknown) => void) => {
            callback(null, { statusCode: 200, body: { code: 0, url: 'https://audio.example.com/test.mp3' } });
            return () => {};
        },
        utils: { buffer: { from: () => new Uint8Array(), bufToString: () => '' }, crypto: {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { timeout: 8000 });
    return inited;
};

it('bundled presets expose stable metadata and raw HTTPS import URLs', () => {
    expect(LX_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of LX_PRESETS) {
        const script = presetScript(preset);
        expect(script.id).toBe(preset.id);
        expect(script.name.length).toBeGreaterThan(0);
        expect(script.code.length).toBeGreaterThan(0);
        expect(preset.importUrl).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
    }
});

it('bundled presets initialize with musicUrl actions', () => {
    for (const preset of LX_PRESETS) {
        const inited = initialize(preset.code);
        const sources = Object.values(inited?.sources ?? {}) as Array<{ actions?: string[] }>;
        expect(sources.length, `${preset.name} declared no sources`).toBeGreaterThan(0);
        expect(sources.some(source => source.actions?.includes('musicUrl')), `${preset.name} has no musicUrl`).toBe(true);
    }
});
