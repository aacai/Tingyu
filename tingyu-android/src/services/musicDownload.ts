import type { SongResult } from '../types';
import { toPlayableAudioUrl } from '../utils/appPlaybackHelpers';
import { sanitizeDownloadFileName } from '../utils/downloadFileName';
import { isCapacitorAndroid } from '../platform/runtime';
import { getTingyuPlayback } from '../platform/tingyuPlayback';
import { useAudioSettingsStore } from '../stores/useAudioSettingsStore';
import { omni } from './onlineMusic/omni';

// src/services/musicDownload.ts
// 走 Omni 完整换源链取到可播放直链，再交给原生写入公共 Music/听屿，不落地任何凭据。

interface DownloadResult {
    uri: string;
    displayName: string;
    relativePath: string;
}

export async function downloadSongToMusic(song: SongResult): Promise<DownloadResult> {
    if (!isCapacitorAndroid()) throw new Error('仅 Android 支持下载到音乐目录');
    if (song.sourceRef?.kind !== 'online') throw new Error('本地歌曲无需下载');
    const quality = useAudioSettingsStore.getState().audioQuality;
    const source = await omni.getAudioSource(song, quality);
    const url = toPlayableAudioUrl(source?.url);
    if (!url) throw new Error('未找到可下载的音频地址');
    const artists = song.artists.map(artist => artist.name).filter(Boolean).join(' ');
    const fileName = sanitizeDownloadFileName(artists ? `${song.name} - ${artists}` : song.name, '听屿歌曲');
    return getTingyuPlayback<{ downloadToMusic(data: { url: string; fileName: string }): Promise<DownloadResult> }>()
        .downloadToMusic({ url, fileName });
}
