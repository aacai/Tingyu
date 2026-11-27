import huanyinCode from './presets/huanyin.js?raw';
import hywCode from './presets/hyw.js?raw';
import ikunCode from './presets/ikun.js?raw';
import qdyCode from './presets/qdy.js?raw';
import qingliangCode from './presets/qingliang.js?raw';
import jiexiangCode from './presets/jiexiang.js?raw';
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
    {
        id: 'builtin-ikun',
        name: 'ikun音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/ikun/latest.js',
        code: ikunCode,
    },
    {
        id: 'builtin-qdy',
        name: '全豆要聚合音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/qdy/latest.js',
        code: qdyCode,
    },
    {
        id: 'builtin-qingliang',
        name: '轻量音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/qingliang/latest.js',
        code: qingliangCode,
    },
    {
        id: 'builtin-jiexiang',
        name: '杰翔聚合音源',
        importUrl: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/jiexiang/latest.js',
        code: jiexiangCode,
    },
];

export const presetScript = (preset: LxPreset): Omit<LxScript, 'capabilities'> => ({
    ...parseLxScript(preset.code),
    id: preset.id,
    importUrl: preset.importUrl,
});
