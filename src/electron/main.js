// Electron 主程序
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

class SecureChatElectron {
    constructor() {
        this.mainWindow = null;
        this.isQuitting = false;
        this.encryptionKey = null;
        this.windowState = {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined,
            isMaximized: false
        };
    }

    // 初始化應用
    async initialize() {
        try {
            // 設置應用事件監聽器
            this.setupAppEvents();
            
            // 設置IPC處理器
            this.setupIpcHandlers();
            
            // 設置安全策略
            this.setupSecurity();
            
            console.log('Electron應用初始化完成');
        } catch (error) {
            console.error('Electron應用初始化失敗:', error);
        }
    }

    // 設置應用事件
    setupAppEvents() {
        // 應用準備就緒
        app.whenReady().then(() => {
            this.createMainWindow();
            this.createApplicationMenu();
            
            // macOS 特殊處理
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createMainWindow();
                }
            });
        });

        // 所有窗口關閉
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        // 應用退出前
        app.on('before-quit', () => {
            this.isQuitting = true;
            this.saveWindowState();
        });

        // 證書錯誤處理
        app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
            // 在生產環境中應該更嚴格地驗證證書
            event.preventDefault();
            callback(true);
        });
    }

    // 創建主窗口
    createMainWindow() {
        try {
            // 加載窗口狀態
            this.loadWindowState();

            // 創建瀏覽器窗口
            this.mainWindow = new BrowserWindow({
                width: this.windowState.width,
                height: this.windowState.height,
                x: this.windowState.x,
                y: this.windowState.y,
                minWidth: 800,
                minHeight: 600,
                show: false,
                icon: path.join(__dirname, '../web/icons/icon-256.png'),
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    enableRemoteModule: false,
                    preload: path.join(__dirname, 'preload.js'),
                    webSecurity: true,
                    allowRunningInsecureContent: false,
                    experimentalFeatures: false
                },
                titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
                frame: true,
                backgroundColor: '#ffffff'
            });

            // 如果之前是最大化狀態，恢復最大化
            if (this.windowState.isMaximized) {
                this.mainWindow.maximize();
            }

            // 加載應用頁面
            const startUrl = path.join(__dirname, '../web/index.html');
            this.mainWindow.loadFile(startUrl);

            // 窗口事件處理
            this.setupWindowEvents();

            // 開發環境下打開DevTools
            if (process.env.NODE_ENV === 'development') {
                this.mainWindow.webContents.openDevTools();
            }

            // 窗口準備好後顯示
            this.mainWindow.once('ready-to-show', () => {
                this.mainWindow.show();
                
                // 聚焦窗口
                if (process.platform === 'darwin') {
                    app.dock.show();
                }
            });

            console.log('主窗口創建成功');
        } catch (error) {
            console.error('創建主窗口失敗:', error);
        }
    }

    // 設置窗口事件
    setupWindowEvents() {
        // 窗口關閉
        this.mainWindow.on('close', (event) => {
            if (!this.isQuitting && process.platform === 'darwin') {
                event.preventDefault();
                this.mainWindow.hide();
                app.dock.hide();
            } else {
                this.saveWindowState();
            }
        });

        // 窗口最大化/還原
        this.mainWindow.on('maximize', () => {
            this.windowState.isMaximized = true;
        });

        this.mainWindow.on('unmaximize', () => {
            this.windowState.isMaximized = false;
        });

        // 窗口大小和位置變化
        this.mainWindow.on('resize', () => {
            if (!this.mainWindow.isMaximized()) {
                const bounds = this.mainWindow.getBounds();
                this.windowState.width = bounds.width;
                this.windowState.height = bounds.height;
            }
        });

        this.mainWindow.on('move', () => {
            if (!this.mainWindow.isMaximized()) {
                const bounds = this.mainWindow.getBounds();
                this.windowState.x = bounds.x;
                this.windowState.y = bounds.y;
            }
        });

        // 外部鏈接處理
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });

        // 導航處理
        this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
            const parsedUrl = new URL(navigationUrl);
            
            // 只允許本地文件和HTTPS鏈接
            if (parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'https:') {
                event.preventDefault();
            }
        });
    }

    // 設置IPC處理器
    setupIpcHandlers() {
        // 獲取應用版本
        ipcMain.handle('get-app-version', () => {
            return app.getVersion();
        });

        // 獲取應用路徑
        ipcMain.handle('get-app-path', (event, name) => {
            return app.getPath(name);
        });

        // 顯示保存對話框
        ipcMain.handle('show-save-dialog', async (event, options) => {
            const result = await dialog.showSaveDialog(this.mainWindow, options);
            return result;
        });

        // 顯示打開對話框
        ipcMain.handle('show-open-dialog', async (event, options) => {
            const result = await dialog.showOpenDialog(this.mainWindow, options);
            return result;
        });

        // 顯示消息框
        ipcMain.handle('show-message-box', async (event, options) => {
            const result = await dialog.showMessageBox(this.mainWindow, options);
            return result;
        });

        // 寫入文件
        ipcMain.handle('write-file', async (event, filePath, data, options = {}) => {
            try {
                await fs.promises.writeFile(filePath, data, options);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 讀取文件
        ipcMain.handle('read-file', async (event, filePath, options = {}) => {
            try {
                const data = await fs.promises.readFile(filePath, options);
                return { success: true, data };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 加密數據
        ipcMain.handle('encrypt-data', (event, data, password) => {
            try {
                const cipher = crypto.createCipher('aes-256-cbc', password);
                let encrypted = cipher.update(data, 'utf8', 'hex');
                encrypted += cipher.final('hex');
                return { success: true, encrypted };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 解密數據
        ipcMain.handle('decrypt-data', (event, encryptedData, password) => {
            try {
                const decipher = crypto.createDecipher('aes-256-cbc', password);
                let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return { success: true, decrypted };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // 應用退出
        ipcMain.handle('app-quit', () => {
            app.quit();
        });

        // 應用重啟
        ipcMain.handle('app-restart', () => {
            app.relaunch();
            app.quit();
        });

        // 最小化窗口
        ipcMain.handle('window-minimize', () => {
            this.mainWindow.minimize();
        });

        // 最大化/還原窗口
        ipcMain.handle('window-toggle-maximize', () => {
            if (this.mainWindow.isMaximized()) {
                this.mainWindow.unmaximize();
            } else {
                this.mainWindow.maximize();
            }
        });

        // 關閉窗口
        ipcMain.handle('window-close', () => {
            this.mainWindow.close();
        });

        // 設置窗口標題
        ipcMain.handle('set-window-title', (event, title) => {
            this.mainWindow.setTitle(title);
        });

        // 緊急銷毀
        ipcMain.handle('emergency-destroy', async () => {
            try {
                // 清除所有用戶數據
                const userDataPath = app.getPath('userData');
                await this.clearDirectory(userDataPath);
                
                // 立即退出
                app.exit(0);
            } catch (error) {
                console.error('緊急銷毀失敗:', error);
                app.exit(1);
            }
        });
    }

    // 設置安全策略
    setupSecurity() {
        // 設置內容安全策略
        app.on('web-contents-created', (event, contents) => {
            contents.on('new-window', (event, navigationUrl) => {
                event.preventDefault();
                shell.openExternal(navigationUrl);
            });

            contents.on('will-attach-webview', (event, webPreferences, params) => {
                // 禁用webview
                event.preventDefault();
            });

            contents.on('will-navigate', (event, navigationUrl) => {
                const parsedUrl = new URL(navigationUrl);
                
                if (parsedUrl.origin !== 'file://') {
                    event.preventDefault();
                }
            });
        });

        // 禁用不安全的功能
        app.on('web-contents-created', (event, contents) => {
            contents.on('context-menu', (event, params) => {
                // 在生產環境中可以禁用右鍵菜單
                if (process.env.NODE_ENV === 'production') {
                    event.preventDefault();
                }
            });
        });
    }

    // 創建應用菜單
    createApplicationMenu() {
        const template = [
            {
                label: '文件',
                submenu: [
                    {
                        label: '新建聊天',
                        accelerator: 'CmdOrCtrl+N',
                        click: () => {
                            this.mainWindow.webContents.send('menu-new-chat');
                        }
                    },
                    {
                        label: '導入數據',
                        click: async () => {
                            const result = await dialog.showOpenDialog(this.mainWindow, {
                                properties: ['openFile'],
                                filters: [
                                    { name: '備份文件', extensions: ['backup', 'json'] }
                                ]
                            });
                            
                            if (!result.canceled) {
                                this.mainWindow.webContents.send('menu-import-data', result.filePaths[0]);
                            }
                        }
                    },
                    {
                        label: '導出數據',
                        click: async () => {
                            const result = await dialog.showSaveDialog(this.mainWindow, {
                                defaultPath: `SecureChat-backup-${new Date().toISOString().split('T')[0]}.backup`,
                                filters: [
                                    { name: '備份文件', extensions: ['backup'] }
                                ]
                            });
                            
                            if (!result.canceled) {
                                this.mainWindow.webContents.send('menu-export-data', result.filePath);
                            }
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '退出',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => {
                            app.quit();
                        }
                    }
                ]
            },
            {
                label: '編輯',
                submenu: [
                    { role: 'undo', label: '撤銷' },
                    { role: 'redo', label: '重做' },
                    { type: 'separator' },
                    { role: 'cut', label: '剪切' },
                    { role: 'copy', label: '複製' },
                    { role: 'paste', label: '粘貼' },
                    { role: 'selectall', label: '全選' }
                ]
            },
            {
                label: '視圖',
                submenu: [
                    { role: 'reload', label: '重新加載' },
                    { role: 'forceReload', label: '強制重新加載' },
                    { role: 'toggleDevTools', label: '開發者工具' },
                    { type: 'separator' },
                    { role: 'resetZoom', label: '實際大小' },
                    { role: 'zoomIn', label: '放大' },
                    { role: 'zoomOut', label: '縮小' },
                    { type: 'separator' },
                    { role: 'togglefullscreen', label: '全屏' }
                ]
            },
            {
                label: '安全',
                submenu: [
                    {
                        label: '鎖定應用',
                        accelerator: 'CmdOrCtrl+L',
                        click: () => {
                            this.mainWindow.webContents.send('menu-lock-app');
                        }
                    },
                    {
                        label: '緊急銷毀',
                        accelerator: 'CmdOrCtrl+Shift+D',
                        click: async () => {
                            const result = await dialog.showMessageBox(this.mainWindow, {
                                type: 'warning',
                                buttons: ['取消', '確認銷毀'],
                                defaultId: 0,
                                title: '緊急銷毀',
                                message: '這將永久刪除所有數據，確定要繼續嗎？'
                            });
                            
                            if (result.response === 1) {
                                this.mainWindow.webContents.send('menu-emergency-destroy');
                            }
                        }
                    },
                    { type: 'separator' },
                    {
                        label: '偽裝模式',
                        submenu: [
                            {
                                label: '計算器模式',
                                click: () => {
                                    this.mainWindow.webContents.send('menu-disguise-mode', 'calculator');
                                }
                            },
                            {
                                label: '筆記本模式',
                                click: () => {
                                    this.mainWindow.webContents.send('menu-disguise-mode', 'notes');
                                }
                            }
                        ]
                    }
                ]
            },
            {
                label: '幫助',
                submenu: [
                    {
                        label: '關於',
                        click: () => {
                            dialog.showMessageBox(this.mainWindow, {
                                type: 'info',
                                title: '關於 SecureChat',
                                message: 'SecureChat',
                                detail: `版本: ${app.getVersion()}\n跨平台安全聊天系統\n端到端加密通信`
                            });
                        }
                    }
                ]
            }
        ];

        // macOS 特殊處理
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    { role: 'about', label: `關於 ${app.getName()}` },
                    { type: 'separator' },
                    { role: 'services', label: '服務' },
                    { type: 'separator' },
                    { role: 'hide', label: `隱藏 ${app.getName()}` },
                    { role: 'hideothers', label: '隱藏其他' },
                    { role: 'unhide', label: '顯示全部' },
                    { type: 'separator' },
                    { role: 'quit', label: `退出 ${app.getName()}` }
                ]
            });
        }

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    // 保存窗口狀態
    saveWindowState() {
        try {
            const configPath = path.join(app.getPath('userData'), 'window-state.json');
            fs.writeFileSync(configPath, JSON.stringify(this.windowState, null, 2));
        } catch (error) {
            console.error('保存窗口狀態失敗:', error);
        }
    }

    // 加載窗口狀態
    loadWindowState() {
        try {
            const configPath = path.join(app.getPath('userData'), 'window-state.json');
            if (fs.existsSync(configPath)) {
                const savedState = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this.windowState = { ...this.windowState, ...savedState };
            }
        } catch (error) {
            console.error('加載窗口狀態失敗:', error);
        }
    }

    // 清除目錄
    async clearDirectory(dirPath) {
        try {
            const files = await fs.promises.readdir(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stat = await fs.promises.stat(filePath);
                
                if (stat.isDirectory()) {
                    await this.clearDirectory(filePath);
                    await fs.promises.rmdir(filePath);
                } else {
                    await fs.promises.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('清除目錄失敗:', error);
        }
    }
}

// 創建應用實例
const secureChatApp = new SecureChatElectron();

// 初始化應用
secureChatApp.initialize();

// 導出應用實例
module.exports = secureChatApp;

