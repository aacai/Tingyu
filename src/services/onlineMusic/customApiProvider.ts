import type { SongResult } from '../../types';
import type { OnlineMusicProvider, ProviderAudioSource } from '../../types/onlineMusic';
import { OnlineProviderError } from '../../types/onlineMusic';
import { proxyNativeRemoteAudioUrl } from '../nativeRemoteAudio';
import { readFallbackConfig, type CustomApiConfig } from './fallbackConfig';

// src/services/onlineMusic/customApiProvider.ts
// 用户导入的 JSON 解析接口；只解析播放地址，歌曲目录和歌词仍由原平台负责。

const ID = 'customApi';
const capabilities = {
    search: false, playback: true, lyrics: false, auth: false, userLibrary: false,
    playlists: false, albums: false, artists: false, recommendations: false,
    mutations: false, wordByWordLyrics: false,
};

const valueAtPath = (data: unknown, path: string): unknown => {
    let current: unknown = data;
    for (const key of path.split('.').filter(Boolean)) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
};

const fill = (template: string, values: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

const audioValues = (song: SongResult, bitrate: string) => {
    const ref = song.sourceRef;
    return {
        songId: ref?.kind === 'online' ? ref.mediaId : String(song.id),
        id: ref?.kind === 'online' ? ref.mediaId : String(song.id),
        name: song.name,
        artist: song.artists.map(artist => artist.name).filter(Boolean).join(' '),
        album: song.album?.name || '',
        quality: bitrate,
        br: bitrate,
    };
};

export const resolveCustomApiAudio = async (config: CustomApiConfig, song: SongResult, quality: string): Promise<string | null> => {
    const bitrate = config.qualityMapping?.[quality] ?? (quality === 'standard' ? '128' : quality === 'high' ? '320' : '999');
    const values = audioValues(song, bitrate);
    const params = Object.fromEntries(Object.entries(config.params).map(([key, template]) => [key, fill(template, values)]));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const url = new URL(fill(config.apiUrl, values));
        if (config.method === 'GET') {
            for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        }
        const response = await fetch(url.href, {
            method: config.method,
            ...(config.method === 'POST' ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            } : {}),
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`自定义 API HTTP ${response.status}`);
        const raw = await response.json();
        const urlValue = valueAtPath(raw, config.responseUrlPath || 'url');
        return typeof urlValue === 'string' && /^https?:\/\//i.test(urlValue) ? urlValue : null;
    } finally {
        clearTimeout(timer);
    }
};

export const customApiProvider: OnlineMusicProvider = {
    id: ID,
    displayName: '自定义 API',
    shortName: '自定义',
    getAvailability: () => (readFallbackConfig().customApi ? { configured: true } : { configured: false, reason: 'not-configured' }),
    capabilities,
    normalizeSong: raw => {
        const source = raw as { id?: string | number; name?: string; artists?: Array<{ name?: string }> };
        return {
            id: String(source.id ?? ''),
            name: String(source.name ?? ''),
            artists: (source.artists ?? []).map((artist, index) => ({ id: index, name: String(artist?.name ?? '') })),
            album: { id: '', name: '' },
            durationMs: 0,
            sourceRef: { kind: 'online', providerId: ID, mediaId: String(source.id ?? '') },
        };
    },
    playback: {
        async getSongDetail() { return null; },
        async getAudioSource(song, quality): Promise<ProviderAudioSource | null> {
            const config = readFallbackConfig().customApi;
            if (!config) throw new OnlineProviderError('unavailable', '尚未配置自定义 API', ID);
            const url = await resolveCustomApiAudio(config, song, quality);
            if (!url) return null;
            return { url: await proxyNativeRemoteAudioUrl(url), fetchedAt: Date.now(), quality, qualityVerified: false };
        },
    },
};
