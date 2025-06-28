// Electron 預加載腳本 - 安全橋接
const { contextBridge, ipcRenderer } = require('electron');

// 安全的API暴露
contextBridge.exposeInMainWorld('electronAPI', {
    // 應用信息
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
    
    // 文件操作
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    writeFile: (filePath, data, options) => ipcRenderer.invoke('write-file', filePath, data, options),
    readFile: (filePath, options) => ipcRenderer.invoke('read-file', filePath, options),
    
    // 加密操作
    encryptData: (data, password) => ipcRenderer.invoke('encrypt-data', data, password),
    decryptData: (encryptedData, password) => ipcRenderer.invoke('decrypt-data', encryptedData, password),
    
    // 窗口控制
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowToggleMaximize: () => ipcRenderer.invoke('window-toggle-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    setWindowTitle: (title) => ipcRenderer.invoke('set-window-title', title),
    
    // 應用控制
    appQuit: () => ipcRenderer.invoke('app-quit'),
    appRestart: () => ipcRenderer.invoke('app-restart'),
    emergencyDestroy: () => ipcRenderer.invoke('emergency-destroy'),
    
    // 事件監聽
    onMenuAction: (callback) => {
        const validChannels = [
            'menu-new-chat',
            'menu-import-data',
            'menu-export-data',
            'menu-lock-app',
            'menu-emergency-destroy',
            'menu-disguise-mode'
        ];
        
        validChannels.forEach(channel => {
            ipcRenderer.on(channel, (event, ...args) => {
                callback(channel, ...args);
            });
        });
    },
    
    // 移除事件監聽
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// 平台檢測
contextBridge.exposeInMainWorld('platform', {
    isElectron: true,
    isDesktop: true,
    isMobile: false,
    isWeb: false,
    platform: process.platform,
    arch: process.arch
});

// 安全工具
contextBridge.exposeInMainWorld('securityAPI', {
    // 生成隨機字符串
    generateRandomString: (length = 32) => {
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    },
    
    // 哈希計算
    calculateHash: (data, algorithm = 'sha256') => {
        const crypto = require('crypto');
        return crypto.createHash(algorithm).update(data).digest('hex');
    },
    
    // 安全比較
    secureCompare: (a, b) => {
        const crypto = require('crypto');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }
});

// 開發工具（僅在開發環境）
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('devAPI', {
        openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
        reloadApp: () => ipcRenderer.invoke('reload-app'),
        clearCache: () => ipcRenderer.invoke('clear-cache')
    });
}

console.log('Electron預加載腳本已載入');

