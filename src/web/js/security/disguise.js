// 偽裝功能控制模組
class DisguiseManager {
    constructor() {
        this.currentMode = 'normal';
        this.availableModes = ['normal', 'calculator', 'notes'];
        this.isActive = false;
        this.decoyDataLoaded = false;
        this.originalTitle = document.title;
        this.originalFavicon = null;
        this.modeSettings = {
            normal: {
                title: '安全聊天系統',
                favicon: 'icons/icon-192.png',
                description: '端到端加密聊天應用'
            },
            calculator: {
                title: '計算器',
                favicon: 'icons/calc-icon.png',
                description: '科學計算器應用'
            },
            notes: {
                title: '筆記本',
                favicon: 'icons/notes-icon.png',
                description: '個人筆記應用'
            }
        };
    }

    // 初始化偽裝管理器
    async initialize() {
        try {
            // 檢測當前模式
            await this.detectCurrentMode();
            
            // 加載偽裝設置
            await this.loadDisguiseSettings();
            
            // 設置模式切換監聽器
            this.setupModeListeners();
            
            // 檢查是否需要自動啟動偽裝模式
            await this.checkAutoDisguise();
            
            console.log('偽裝管理器初始化成功');
            return true;
        } catch (error) {
            console.error('偽裝管理器初始化失敗:', error);
            return false;
        }
    }

    // 檢測當前模式
    async detectCurrentMode() {
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('calc.html')) {
            this.currentMode = 'calculator';
        } else if (currentPath.includes('notes.html')) {
            this.currentMode = 'notes';
        } else {
            this.currentMode = 'normal';
        }
        
        console.log('當前偽裝模式:', this.currentMode);
    }

    // 加載偽裝設置
    async loadDisguiseSettings() {
        try {
            const settings = await secureStorage.getSettings();
            if (settings.disguiseMode) {
                this.currentMode = settings.disguiseMode;
            }
            
            // 應用當前模式的設置
            await this.applyModeSettings(this.currentMode);
        } catch (error) {
            console.error('加載偽裝設置失敗:', error);
        }
    }

    // 應用模式設置
    async applyModeSettings(mode) {
        const settings = this.modeSettings[mode];
        if (!settings) return;

        // 更新頁面標題
        document.title = settings.title;
        
        // 更新favicon
        this.updateFavicon(settings.favicon);
        
        // 更新meta描述
        this.updateMetaDescription(settings.description);
        
        // 更新manifest
        await this.updateManifest(mode);
    }

    // 更新favicon
    updateFavicon(iconPath) {
        try {
            // 移除現有的favicon
            const existingFavicon = document.querySelector('link[rel="icon"]');
            if (existingFavicon) {
                existingFavicon.remove();
            }
            
            // 添加新的favicon
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.type = 'image/png';
            favicon.href = iconPath;
            document.head.appendChild(favicon);
        } catch (error) {
            console.error('更新favicon失敗:', error);
        }
    }

    // 更新meta描述
    updateMetaDescription(description) {
        try {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = description;
        } catch (error) {
            console.error('更新meta描述失敗:', error);
        }
    }

    // 更新manifest
    async updateManifest(mode) {
        try {
            const manifestData = {
                normal: {
                    name: '安全聊天',
                    short_name: 'SecureChat',
                    description: '端到端加密聊天應用',
                    start_url: '/index.html',
                    icons: [
                        {
                            src: 'icons/icon-192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        }
                    ]
                },
                calculator: {
                    name: '計算器',
                    short_name: 'Calculator',
                    description: '科學計算器應用',
                    start_url: '/calc.html',
                    icons: [
                        {
                            src: 'icons/calc-icon.png',
                            sizes: '192x192',
                            type: 'image/png'
                        }
                    ]
                },
                notes: {
                    name: '筆記本',
                    short_name: 'Notes',
                    description: '個人筆記應用',
                    start_url: '/notes.html',
                    icons: [
                        {
                            src: 'icons/notes-icon.png',
                            sizes: '192x192',
                            type: 'image/png'
                        }
                    ]
                }
            };

            const manifest = manifestData[mode];
            if (manifest) {
                // 更新manifest link
                let manifestLink = document.querySelector('link[rel="manifest"]');
                if (!manifestLink) {
                    manifestLink = document.createElement('link');
                    manifestLink.rel = 'manifest';
                    document.head.appendChild(manifestLink);
                }
                
                // 創建動態manifest
                const manifestBlob = new Blob([JSON.stringify(manifest)], {
                    type: 'application/json'
                });
                const manifestUrl = URL.createObjectURL(manifestBlob);
                manifestLink.href = manifestUrl;
            }
        } catch (error) {
            console.error('更新manifest失敗:', error);
        }
    }

    // 設置模式切換監聽器
    setupModeListeners() {
        // 監聽模式切換按鈕
        document.addEventListener('click', (e) => {
            const modeBtn = e.target.closest('[data-mode]');
            if (modeBtn) {
                const mode = modeBtn.dataset.mode;
                this.switchMode(mode);
            }
        });

        // 監聽鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D 切換偽裝模式
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleDisguiseMode();
            }
        });
    }

    // 切換模式
    async switchMode(mode) {
        if (!this.availableModes.includes(mode)) {
            console.warn('無效的偽裝模式:', mode);
            return false;
        }

        try {
            console.log(`切換到偽裝模式: ${mode}`);
            
            // 保存當前模式設置
            const settings = await secureStorage.getSettings();
            settings.disguiseMode = mode;
            await secureStorage.setSettings(settings);
            
            // 應用新模式設置
            await this.applyModeSettings(mode);
            
            // 根據模式跳轉頁面
            switch (mode) {
                case 'normal':
                    if (!window.location.pathname.includes('index.html')) {
                        window.location.href = 'index.html';
                    }
                    break;
                case 'calculator':
                    if (!window.location.pathname.includes('calc.html')) {
                        window.location.href = 'calc.html';
                    }
                    break;
                case 'notes':
                    if (!window.location.pathname.includes('notes.html')) {
                        window.location.href = 'notes.html';
                    }
                    break;
            }
            
            this.currentMode = mode;
            return true;
        } catch (error) {
            console.error('切換偽裝模式失敗:', error);
            return false;
        }
    }

    // 切換偽裝模式（循環）
    async toggleDisguiseMode() {
        const currentIndex = this.availableModes.indexOf(this.currentMode);
        const nextIndex = (currentIndex + 1) % this.availableModes.length;
        const nextMode = this.availableModes[nextIndex];
        
        await this.switchMode(nextMode);
    }

    // 啟動偽裝模式
    async activateDisguise(mode = 'calculator') {
        try {
            this.isActive = true;
            
            // 隱藏真實功能
            await this.hideRealFeatures();
            
            // 顯示偽裝界面
            await this.showDisguiseInterface(mode);
            
            // 加載偽裝數據
            await this.loadDecoyData();
            
            console.log('偽裝模式已啟動:', mode);
            return true;
        } catch (error) {
            console.error('啟動偽裝模式失敗:', error);
            return false;
        }
    }

    // 停用偽裝模式
    async deactivateDisguise() {
        try {
            this.isActive = false;
            
            // 恢復真實功能
            await this.showRealFeatures();
            
            // 隱藏偽裝界面
            await this.hideDisguiseInterface();
            
            // 恢復原始設置
            await this.restoreOriginalSettings();
            
            console.log('偽裝模式已停用');
            return true;
        } catch (error) {
            console.error('停用偽裝模式失敗:', error);
            return false;
        }
    }

    // 隱藏真實功能
    async hideRealFeatures() {
        const sensitiveSelectors = [
            '.encryption-status',
            '.threat-indicator',
            '#new-chat-btn',
            '.security-settings',
            '.emergency-controls'
        ];

        sensitiveSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                element.dataset.hiddenByDisguise = 'true';
            });
        });
    }

    // 顯示真實功能
    async showRealFeatures() {
        const hiddenElements = document.querySelectorAll('[data-hidden-by-disguise="true"]');
        hiddenElements.forEach(element => {
            element.style.display = '';
            delete element.dataset.hiddenByDisguise;
        });
    }

    // 顯示偽裝界面
    async showDisguiseInterface(mode) {
        // 根據模式顯示相應的偽裝界面
        switch (mode) {
            case 'calculator':
                await this.showCalculatorInterface();
                break;
            case 'notes':
                await this.showNotesInterface();
                break;
        }
    }

    // 隱藏偽裝界面
    async hideDisguiseInterface() {
        const disguiseElements = document.querySelectorAll('[data-disguise-element="true"]');
        disguiseElements.forEach(element => {
            element.remove();
        });
    }

    // 顯示計算器界面
    async showCalculatorInterface() {
        // 如果不在計算器頁面，則跳轉
        if (!window.location.pathname.includes('calc.html')) {
            window.location.href = 'calc.html';
            return;
        }
        
        // 確保計算器功能正常工作
        if (window.calculatorUI && !window.calculatorUI.isInitialized) {
            window.calculatorUI.initialize();
        }
    }

    // 顯示筆記界面
    async showNotesInterface() {
        // 如果不在筆記頁面，則跳轉
        if (!window.location.pathname.includes('notes.html')) {
            window.location.href = 'notes.html';
            return;
        }
        
        // 確保筆記功能正常工作
        if (window.notesUI && !window.notesUI.isInitialized) {
            window.notesUI.initialize();
        }
    }

    // 加載偽裝數據
    async loadDecoyData() {
        if (this.decoyDataLoaded) return;

        try {
            // 從應急管理器獲取偽裝數據
            if (window.emergencyManager) {
                await window.emergencyManager.loadDecoyData();
                this.decoyDataLoaded = true;
            }
        } catch (error) {
            console.error('加載偽裝數據失敗:', error);
        }
    }

    // 恢復原始設置
    async restoreOriginalSettings() {
        try {
            // 恢復原始標題
            document.title = this.originalTitle;
            
            // 恢復原始favicon
            if (this.originalFavicon) {
                this.updateFavicon(this.originalFavicon);
            }
            
            // 恢復正常模式設置
            await this.applyModeSettings('normal');
        } catch (error) {
            console.error('恢復原始設置失敗:', error);
        }
    }

    // 檢查自動偽裝
    async checkAutoDisguise() {
        try {
            // 檢查是否有威脅觸發自動偽裝
            if (window.threatDetector) {
                const threatStats = window.threatDetector.getThreatStats();
                if (threatStats.recent24h > 5) {
                    console.log('檢測到多次威脅，自動啟動偽裝模式');
                    await this.activateDisguise('calculator');
                }
            }
            
            // 檢查是否在脅迫模式
            if (window.emergencyManager && window.emergencyManager.coercionMode) {
                await this.activateDisguise('calculator');
            }
        } catch (error) {
            console.error('檢查自動偽裝失敗:', error);
        }
    }

    // 創建偽裝快捷方式
    async createDisguiseShortcuts() {
        try {
            // 為每種偽裝模式創建桌面快捷方式
            const shortcuts = [
                {
                    name: '計算器',
                    url: window.location.origin + '/calc.html',
                    icon: 'icons/calc-icon.png'
                },
                {
                    name: '筆記本',
                    url: window.location.origin + '/notes.html',
                    icon: 'icons/notes-icon.png'
                }
            ];

            // 這裡可以實現創建快捷方式的邏輯
            console.log('偽裝快捷方式已準備:', shortcuts);
            
            return shortcuts;
        } catch (error) {
            console.error('創建偽裝快捷方式失敗:', error);
            return [];
        }
    }

    // 檢測偽裝模式有效性
    validateDisguiseMode(mode) {
        const validModes = ['normal', 'calculator', 'notes'];
        return validModes.includes(mode);
    }

    // 獲取偽裝狀態
    getDisguiseStatus() {
        return {
            currentMode: this.currentMode,
            isActive: this.isActive,
            availableModes: this.availableModes,
            decoyDataLoaded: this.decoyDataLoaded
        };
    }

    // 設置偽裝觸發條件
    async setDisguiseTriggers(triggers) {
        try {
            const settings = await secureStorage.getSettings();
            settings.disguiseTriggers = triggers;
            await secureStorage.setSettings(settings);
            
            console.log('偽裝觸發條件已設置:', triggers);
            return true;
        } catch (error) {
            console.error('設置偽裝觸發條件失敗:', error);
            return false;
        }
    }

    // 緊急偽裝（快速切換）
    async emergencyDisguise() {
        try {
            // 立即切換到計算器模式
            await this.switchMode('calculator');
            
            // 清除瀏覽器歷史記錄
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '計算器', '/calc.html');
            }
            
            console.log('緊急偽裝已啟動');
            return true;
        } catch (error) {
            console.error('緊急偽裝失敗:', error);
            return false;
        }
    }
}

// 創建全局實例
window.disguiseManager = new DisguiseManager();

