import type { AudioQualityPreference } from '../../types/onlineMusic';

// src/services/onlineMusic/gdmusicTransport.ts
// GD 音乐台原始 HTTP 协议只在这里出现；上层 provider 只消费归一化后的候选与直链。

const GD_API = 'https://music-api.gdstudio.xyz/api.php';
const SEARCH_SOURCES = ['joox', 'tidal', 'netease'] as const;
const REQUEST_TIMEOUT_MS = 6000;

export interface GdSearchItem {
    id: string | number;
    name?: string;
    artist?: unknown;
    source?: string;
}

export interface GdAudioResult {
    url: string;
    br?: string | number;
    size?: number;
    source?: string;
}

export const gdQualityBitrate = (quality: AudioQualityPreference): string => {
    if (quality === 'standard') return '128';
    if (quality === 'high') return '320';
    return '999';
};

export const gdDurationMs = (bitrate: string | number | undefined, size: number | undefined): number => {
    const br = Number(bitrate);
    const bytes = Number(size);
    if (!Number.isFinite(br) || br <= 0 || !Number.isFinite(bytes) || bytes <= 0) return 0;
    return Math.round((bytes * 8 * 1000) / br);
};

const normalizeText = (value: unknown): string => String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[（(【[].*?[)）】\]]/g, '')
    .replace(/[\s\-—_·・'"‘’“”!！?？.,，。&＆+]/g, '');

const artistText = (value: unknown): string => {
    if (Array.isArray(value)) {
        return value.map(item => (typeof item === 'string' ? item : (item as { name?: unknown } | null)?.name ?? '')).join(' ');
    }
    return typeof value === 'string' ? value : '';
};

/** 严格匹配歌名与歌手，宁可失败也不把同名翻唱当成原曲。 */
export const pickGdCandidate = (items: GdSearchItem[], name: string, artists: string[]): GdSearchItem | null => {
    const wantedName = normalizeText(name);
    if (!wantedName) return null;
    const wantedArtists = artists.map(normalizeText).filter(Boolean);
    let best: GdSearchItem | null = null;
    let bestScore = 0;
    for (const item of items) {
        if (!item || item.id === undefined || item.id === null || item.id === '') continue;
        const candidateName = normalizeText(item.name);
        if (!candidateName || !(candidateName.includes(wantedName) || wantedName.includes(candidateName))) continue;
        const candidateArtist = normalizeText(artistText(item.artist));
        let score = 2;
        if (wantedArtists.length) {
            if (!candidateArtist || !wantedArtists.some(artist => candidateArtist.includes(artist) || artist.includes(candidateArtist))) continue;
            score = 3;
        }
        if (score > bestScore) {
            best = item;
            bestScore = score;
        }
    }
    return best;
};

const fetchJson = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`GD 音乐台 HTTP ${response.status}`);
        return await response.json() as T;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', forwardAbort);
    }
};

export const searchGdMusic = async (query: string, signal?: AbortSignal): Promise<GdSearchItem[]> => {
    const url = `${GD_API}?types=search&source=netease&name=${encodeURIComponent(query)}&count=20&pages=1`;
    const data = await fetchJson<unknown>(url, signal);
    return Array.isArray(data) ? data as GdSearchItem[] : [];
};

export const resolveGdAudio = async (
    song: { name: string; artists: Array<{ name: string }>; providerData?: Record<string, unknown> },
    quality: AudioQualityPreference,
    signal?: AbortSignal,
): Promise<GdAudioResult | null> => {
    const query = `${song.name} ${song.artists.map(artist => artist.name).filter(Boolean).join(' ')}`.trim();
    if (query.length < 2) return null;
    const bitrate = gdQualityBitrate(quality);
    for (const source of SEARCH_SOURCES) {
        if (signal?.aborted) return null;
        try {
            const items = await searchGdMusicForSource(query, source, signal);
            const matched = pickGdCandidate(items, song.name, song.artists.map(artist => artist.name));
            if (!matched) continue;
            const trackSource = matched.source || source;
            const url = `${GD_API}?types=url&source=${encodeURIComponent(trackSource)}&id=${encodeURIComponent(String(matched.id))}&br=${bitrate}`;
            const result = await fetchJson<GdAudioResult>(url, signal);
            if (typeof result?.url === 'string' && /^https?:\/\//i.test(result.url)) {
                return { ...result, source: trackSource };
            }
        } catch {
            // 换下一个上游来源，不让单个音源的失败中断整条回退链。
        }
    }
    return null;
};

const searchGdMusicForSource = async (query: string, source: string, signal?: AbortSignal): Promise<GdSearchItem[]> => {
    const url = `${GD_API}?types=search&source=${encodeURIComponent(source)}&name=${encodeURIComponent(query)}&count=5&pages=1`;
    const data = await fetchJson<unknown>(url, signal);
    return Array.isArray(data) ? data as GdSearchItem[] : [];
};
