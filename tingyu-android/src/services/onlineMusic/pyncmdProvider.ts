import type { SongResult } from '../../types';
import type { OnlineMusicProvider, ProviderAudioSource } from '../../types/onlineMusic';
import { OnlineProviderError } from '../../types/onlineMusic';
import { proxyNativeRemoteAudioUrl } from '../nativeRemoteAudio';
import { readFallbackConfig } from './fallbackConfig';

// src/services/onlineMusic/pyncmdProvider.ts
// pyncmd 需要外部 UnblockNeteaseMusic 兼容服务；本模块只发数据请求并读取播放地址。

const ID = 'pyncmd';
const capabilities = {
    search: false, playback: true, lyrics: false, auth: false, userLibrary: false,
    playlists: false, albums: false, artists: false, recommendations: false,
    mutations: false, wordByWordLyrics: false,
};

const audioUrlFrom = (payload: unknown): string | null => {
    const candidates = [
        (payload as { data?: { data?: { url?: unknown } } })?.data?.data?.url,
        (payload as { data?: { url?: unknown } })?.data?.url,
        (payload as { url?: unknown })?.url,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) return candidate;
    }
    return null;
};

export const resolvePyncmdAudio = async (baseUrl: string, song: SongResult): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: song.sourceRef?.kind === 'online' ? song.sourceRef.mediaId : String(song.id),
                songData: {
                    name: song.name,
                    artists: song.artists.map(artist => ({ name: artist.name })),
                    album: song.album?.name || '',
                },
                platforms: ['pyncmd'],
            }),
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`pyncmd 服务 HTTP ${response.status}`);
        return audioUrlFrom(await response.json());
    } finally {
        clearTimeout(timer);
    }
};

export const pyncmdProvider: OnlineMusicProvider = {
    id: ID,
    displayName: 'pyncmd',
    shortName: 'pyncmd',
    getAvailability: () => (readFallbackConfig().unblockBaseUrl ? { configured: true } : { configured: false, reason: 'not-configured' }),
    capabilities,
    normalizeSong: raw => {
        const source = raw as { id?: string | number; name?: string };
        return {
            id: String(source.id ?? ''),
            name: String(source.name ?? ''),
            artists: [],
            album: { id: '', name: '' },
            durationMs: 0,
            sourceRef: { kind: 'online', providerId: ID, mediaId: String(source.id ?? '') },
        };
    },
    playback: {
        async getSongDetail() { return null; },
        async getAudioSource(song, quality): Promise<ProviderAudioSource | null> {
            const baseUrl = readFallbackConfig().unblockBaseUrl;
            if (!baseUrl) throw new OnlineProviderError('unavailable', '尚未配置 pyncmd 服务地址', ID);
            const url = await resolvePyncmdAudio(baseUrl, song);
            if (!url) return null;
            return { url: await proxyNativeRemoteAudioUrl(url), fetchedAt: Date.now(), quality, qualityVerified: false };
        },
    },
};
