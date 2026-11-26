import { describe, expect, it } from 'vitest';
import { gdDurationMs, pickGdCandidate } from '@/services/onlineMusic/gdmusicTransport';

// test/unit/onlineMusic/gdmusicProvider.test.ts

describe('GD 音乐台候选匹配', () => {
    it('accepts a recording with matching title and artist', () => {
        expect(pickGdCandidate([
            { id: 1, name: '晴天', artist: '周杰伦', source: 'netease' },
        ], '晴天', ['周杰伦'])?.id).toBe(1);
    });

    it('rejects a cover with a different artist', () => {
        expect(pickGdCandidate([
            { id: 2, name: '晴天', artist: '其他歌手', source: 'netease' },
        ], '晴天', ['周杰伦'])).toBeNull();
    });

    it('derives duration from bitrate and file size when the catalog omits it', () => {
        expect(gdDurationMs('320000', 9_600_000)).toBe(240000);
        expect(gdDurationMs(undefined, 9_600_000)).toBe(0);
    });
});
