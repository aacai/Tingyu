import huanyinCode from './presets/huanyin.js?raw';
import hywCode from './presets/hyw.js?raw';
import { parseLxScript, type LxScript } from './contract';

// src/services/lxSource/presets.ts
// 内置经过沙箱验证的 LX 音源预设；安装时仍走同一套风险确认与能力探测流程。

export interface LxPreset {
    id: string;
    name: string;
    importUrl: string;
    code: string;
}

export const LX_PRESETS: readonly LxPreset[] = [
    {
        id: 'builtin-huanyin',
        name: '幻音音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/huanyin/latest.js',
        code: huanyinCode,
    },
    {
        id: 'builtin-hyw',
        name: 'HYW 音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/hyw/latest.js',
        code: hywCode,
    },
];

export const presetScript = (preset: LxPreset): Omit<LxScript, 'capabilities'> => ({
    ...parseLxScript(preset.code),
    id: preset.id,
    importUrl: preset.importUrl,
});
