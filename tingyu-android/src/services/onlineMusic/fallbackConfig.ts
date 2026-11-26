import { registerBridgedApiHost } from '../nativeAndroidBridge';

// src/services/onlineMusic/fallbackConfig.ts
// 自定义 API 与 pyncmd 服务的本地配置；只保存用户主动填写的公网地址，不随同步上传。

const KEY = 'tingyu_fallback_sources_v1';

export interface CustomApiConfig {
    apiUrl: string;
    method: 'GET' | 'POST';
    params: Record<string, string>;
    responseUrlPath: string;
    qualityMapping?: Record<string, string>;
}

export interface FallbackSourceConfig {
    customApi: CustomApiConfig | null;
    unblockBaseUrl: string;
}

export const EMPTY_FALLBACK_CONFIG: FallbackSourceConfig = { customApi: null, unblockBaseUrl: '' };

const publicHttpUrl = (value: unknown): string | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        registerBridgedApiHost(url.hostname);
        return url.href;
    } catch {
        return null;
    }
};

export const normalizeFallbackConfig = (value: unknown): FallbackSourceConfig => {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const api = raw.customApi && typeof raw.customApi === 'object' ? raw.customApi as Record<string, unknown> : null;
    const apiUrl = api ? publicHttpUrl(api.apiUrl) : null;
    const customApi: CustomApiConfig | null = api && apiUrl ? {
        apiUrl,
        method: api.method === 'POST' ? 'POST' : 'GET',
        params: api.params && typeof api.params === 'object'
            ? Object.fromEntries(Object.entries(api.params).filter(([, v]) => typeof v === 'string'))
            : {},
        responseUrlPath: typeof api.responseUrlPath === 'string' ? api.responseUrlPath.trim() : 'url',
        ...(api.qualityMapping && typeof api.qualityMapping === 'object'
            ? { qualityMapping: Object.fromEntries(Object.entries(api.qualityMapping).filter(([, v]) => typeof v === 'string')) }
            : {}),
    } : null;
    return { customApi, unblockBaseUrl: publicHttpUrl(raw.unblockBaseUrl) || '' };
};

export const readFallbackConfig = (): FallbackSourceConfig => {
    try {
        return normalizeFallbackConfig(JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch {
        return EMPTY_FALLBACK_CONFIG;
    }
};

export const writeFallbackConfig = (value: FallbackSourceConfig): boolean => {
    const config = normalizeFallbackConfig(value);
    if ((value.customApi && !config.customApi) || (value.unblockBaseUrl && !config.unblockBaseUrl)) return false;
    localStorage.setItem(KEY, JSON.stringify(config));
    return true;
};
