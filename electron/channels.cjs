const METHODS = [
  'abortVideoExportFile', 'appendVideoExportChunk', 'bodianRequest', 'cancelAutomixModelDownload',
  'cancelTranscodeFallback', 'checkForUpdates', 'chooseCacheDirectory', 'chooseModelsDirectory',
  'chooseVideoExportPath', 'clearAudioCache', 'clearCoverCache', 'clearLocalCoverAssets',
  'clearStageState', 'closeRemoteControl', 'closeWindow', 'completeStageExternalPlayRequest',
  'completeStagePlayerControlRequest', 'completeStagePlayerQueueRequest', 'consumeWindowPlaybackHandoff',
  'debugGetState', 'debugOpenLogs', 'debugRendererMemory', 'debugReportRendererMemory',
  'debugSetState', 'debugWriteRuntimeLines', 'diagMark', 'downloadAutomixModel', 'downloadUpdate',
  'fetchLyricProxy', 'finishVideoExportFile', 'generateTheme', 'getAudioCache', 'getAudioCacheStats',
  'getAudioCacheUsage', 'getAutomixModelsPresent', 'getAutomixModelStatus', 'getCacheDirectory',
  'getCoverCache', 'getCoverCacheUsage', 'getDiscordPresenceStatus', 'getKugouApiStatus',
  'getLoginDiagnostics', 'getLyricApiStatus', 'getMainWindowAlwaysOnTop',
  'getMainWindowClickThroughEnabled', 'getNeteaseApiStatus', 'getNeteasePort',
  'getObsBrowserSourceStatus', 'getPlaybackSyncBridgeStatus', 'getQqApiStatus', 'getQqPort',
  'getRemoteControlAlwaysOnTop', 'getRemoteControlSnapshot', 'getRemoteControlWindowSettings',
  'getSettings', 'getStageStatus', 'getUpdateStatus', 'getVoiceInputPauseStatus',
  'getWindowTransparentMode', 'hasAudioCache', 'hasLocalCoverAsset', 'installAutomixModel',
  'isWindowFullscreen', 'isWindowMaximized', 'kugouRequest', 'markUpdateSeen', 'minimizeWindow',
  'onAutomixModelProgress', 'onDebugMemorySample', 'onDiscordPresenceStatusChanged',
  'onLyricApiStatusChanged', 'onMainWindowClickThroughChanged', 'onNeteaseApiStatusChanged',
  'onObsBrowserSourceStatusChanged', 'onPlaybackSyncBridgeStatusChanged', 'onQqApiStatusChanged',
  'onRemoteControlCommand', 'onRemoteControlSnapshot', 'onRemoteControlWindowSettingsChanged',
  'onStageExternalPlayRequest', 'onStagePlayerControlRequest', 'onStagePlayerQueueRequest',
  'onStageSessionCleared', 'onStageSessionUpdated', 'onTaskbarControl', 'onUpdateStatusChanged',
  'onVoiceInputStateChanged', 'onWallpaperEntryRequested', 'onWallpaperInputMonitorRequested',
  'onWallpaperModeChanged', 'onWallpaperTransparentRefused', 'onWindowFullscreenChanged',
  'onWindowPlaybackHandoffRequested', 'openExternalUrl', 'openRemoteControl', 'openUpdateReleasePage',
  'openVideoExportFile', 'prepareVideoExportWindow', 'publishDiscordPresenceSnapshot',
  'publishLyricApiData', 'publishObsBrowserSourceAudio', 'publishObsBrowserSourceClock',
  'publishObsBrowserSourceConfig', 'publishRemoteControlSnapshot', 'publishStagePlayerSnapshot',
  'quitAndInstallUpdate', 'quitApp', 'regenerateObsBrowserSourceToken', 'regenerateStageToken',
  'removeAllAutomixModels', 'removeCoverCache', 'removeLocalCoverAsset', 'reportDevicePixelRatio',
  'requestTranscodeFallback', 'resetCacheDirectory', 'resetModelsDirectory', 'restartNeteaseApi',
  'restoreVideoExportWindow', 'runBeatThis', 'runLoginSelfCheck', 'saveAudioCache', 'saveCoverCache',
  'saveLocalCoverAsset', 'saveSettings', 'scanForAutomixModels', 'segmentLyrics',
  'sendRemoteControlCommand', 'separateStems', 'setAppLocale', 'setLyricApiEnabled',
  'setMainWindowAlwaysOnTop', 'setMainWindowClickThroughEnabled',
  'setMainWindowClickThroughUnlockHover', 'setNativeTheme', 'setObsBrowserSourceEnabled',
  'setPlaybackDisplaySleepBlockingActive', 'setRemoteControlAlwaysOnTop', 'setStageEnabled',
  'setWindowTransparentMode', 'submitWindowPlaybackHandoff', 'testAiConnection',
  'toggleFullscreenWindow', 'toggleMaximizeWindow', 'toggleRemoteControl', 'updateTaskbarControls',
];

const toChannel = (name) => name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);

// electron/channels.cjs
// 桌面桥的最小契约：上层 UI 只认方法名，主进程统一做无副作用兜底，真实能力再逐项覆盖。

module.exports = { METHODS, toChannel };
