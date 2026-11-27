const { contextBridge, ipcRenderer } = require('electron');
const { METHODS, toChannel } = require('./channels.cjs');

// electron/preload.cjs
// 只暴露白名单方法；桌面高级能力在主进程有安全空值兜底，Web 逻辑不会因缺方法崩溃。

const bridge = {
  platform: ipcRenderer.sendSync('get-platform'),
  isLinuxX11: ipcRenderer.sendSync('get-is-linux-x11'),
  webUtils: { getPathForFile: file => String(file?.path || '') },
};

for (const name of METHODS) {
  if (name.startsWith('on')) {
    bridge[name] = () => () => {};
  } else {
    bridge[name] = (...args) => ipcRenderer.invoke(toChannel(name), ...args);
  }
}

contextBridge.exposeInMainWorld('electron', bridge);
