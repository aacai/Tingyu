import { assertLxImportPermit, useLxSourceStore } from '../../stores/useLxSourceStore';
import { checkLxScript } from './management';
import { LX_PRESETS, presetScript } from './presets';

// src/services/lxSource/presetInstall.ts
// 一次确认后安装全部内置预设，并开启脚本接力；失败不会留下半安装的禁用脚本。

export async function installBuiltinLxPresets(): Promise<boolean> {
    const state = useLxSourceStore.getState();
    const permit = await state.requestImport();
    if (!permit) return false;
    try {
        assertLxImportPermit(permit);
        for (const preset of LX_PRESETS) {
            const script = presetScript(preset);
            const result = await checkLxScript(script, permit);
            assertLxImportPermit(permit);
            useLxSourceStore.getState().save({ ...script, capabilities: result.capabilities }, permit);
        }
        const store = useLxSourceStore.getState();
        store.setPolicy({ scriptFallback: true, scriptOrder: LX_PRESETS.slice(1).map(preset => preset.id) });
        store.activate(LX_PRESETS[0].id);
        return true;
    } finally {
        useLxSourceStore.getState().revokeImport(permit);
    }
}
