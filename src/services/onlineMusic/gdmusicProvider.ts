import type { UnifiedSong } from '../../types';
import type { OnlineMusicProvider, ProviderAudioSource } from '../../types/onlineMusic';
import { OnlineProviderError } from '../../types/onlineMusic';
import { createProviderSongMetadata } from '../../utils/songMetadata';
import { proxyNativeRemoteAudioUrl } from '../nativeRemoteAudio';
import { resolveGdAudio, searchGdMusic, type GdSearchItem } from './gdmusicTransport';

// src/services/onlineMusic/gdmusicProvider.ts
// 只提供搜索 + 播放地址的备用音源；歌词、歌单、账号等仍由原平台负责。

const ID = 'gdmusic';
const capabilities = {
    search: true, playback: true, lyrics: false, auth: false, userLibrary: false,
    playlists: false, albums: false, artists: false, recommendations: false,
    mutations: false, wordByWordLyrics: false,
};

const providerDataFor = (source: string, id: string | number) => ({ gdSource: source, gdId: String(id) });

export const normalizeGdSong = (raw: GdSearchItem): UnifiedSong => {
    const source = typeof raw.source === 'string' && raw.source ? raw.source : 'netease';
    const mediaId = `${source}:${raw.id}`;
    return {
        id: mediaId,
        name: String(raw.name || ''),
        artists: Array.isArray(raw.artist)
            ? raw.artist.map((artist, index) => ({
                id: `${source}:${index}`,
                name: typeof artist === 'string' ? artist : String((artist as { name?: unknown } | null)?.name || ''),
            }))
            : [{ id: `${source}:artist`, name: typeof raw.artist === 'string' ? raw.artist : '' }],
        album: { id: `${source}:album`, name: '' },
        durationMs: 0,
        sourceRef: { kind: 'online', providerId: ID, mediaId, providerData: providerDataFor(source, raw.id) },
    };
};

const detailFromId = (id: string | number): { source: string; gdId: string } => {
    const raw = String(id);
    const separator = raw.indexOf(':');
    return separator > 0
        ? { source: raw.slice(0, separator), gdId: raw.slice(separator + 1) }
        : { source: 'netease', gdId: raw };
};

export const gdmusicProvider: OnlineMusicProvider = {
    id: ID,
    displayName: 'GD 音乐台',
    shortName: 'GD',
    getAvailability: () => ({ configured: true }),
    capabilities,
    normalizeSong: raw => normalizeGdSong(raw as GdSearchItem),
    songMetadata: { getSongMetadata: createProviderSongMetadata },
    search: {
        async searchSongs(query, limit, offset, signal) {
            if (!query.trim()) return { items: [], hasMore: false, nextOffset: offset };
            const items = (await searchGdMusic(query, signal)).slice(offset, offset + limit).map(normalizeGdSong);
            return { items, hasMore: false, nextOffset: offset + items.length };
        },
    },
    playback: {
        async getSongDetail(id) {
            const detail = detailFromId(id);
            return {
                id: String(id),
                name: '',
                artists: [],
                album: { id: '', name: '' },
                durationMs: 0,
                sourceRef: {
                    kind: 'online', providerId: ID, mediaId: String(id),
                    providerData: providerDataFor(detail.source, detail.gdId),
                },
            };
        },
        async getAudioSource(song, quality): Promise<ProviderAudioSource | null> {
            const ref = song.sourceRef;
            if (ref?.kind !== 'online' || ref.providerId !== ID) {
                throw new OnlineProviderError('unsupported', 'Song does not belong to GD Music', ID);
            }
            const result = await resolveGdAudio(song, quality);
            if (!result) return null;
            return {
                url: await proxyNativeRemoteAudioUrl(result.url),
                fetchedAt: Date.now(),
                quality,
                qualityVerified: false,
            };
        },
    },
};
