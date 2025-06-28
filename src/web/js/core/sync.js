// 跨設備同步模組
class SyncManager {
    constructor() {
        this.isEnabled = true;
        this.syncInterval = null;
        this.lastSyncTime = 0;
        this.syncFrequency = 30000; // 30秒同步一次
        this.deviceId = null;
        this.conflictResolver = new ConflictResolver();
        this.syncQueue = [];
        this.isSyncing = false;
    }

    // 初始化同步管理器
    async initialize() {
        try {
            // 生成或獲取設備ID
            this.deviceId = await this.getOrCreateDeviceId();
            
            // 註冊設備
            await this.registerDevice();
            
            // 開始定期同步
            this.startPeriodicSync();
            
            // 監聽網路狀態變化
            this.setupNetworkListeners();
            
            // 監聽數據變化
            this.setupDataChangeListeners();
            
            return true;
        } catch (error) {
            console.error('同步管理器初始化失敗:', error);
            return false;
        }
    }

    // 生成或獲取設備ID
    async getOrCreateDeviceId() {
        let deviceId = await secureStorage.getItem('device_id');
        
        if (!deviceId) {
            // 生成新的設備ID
            deviceId = this.generateDeviceId();
            await secureStorage.setItem('device_id', deviceId);
        }
        
        return deviceId;
    }

    // 生成設備ID
    generateDeviceId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        const platform = this.getPlatformInfo();
        return `${platform}-${timestamp}-${random}`;
    }

    // 獲取平台信息
    getPlatformInfo() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('electron')) {
            return 'desktop';
        } else if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
            return 'mobile';
        } else {
            return 'web';
        }
    }

    // 註冊設備
    async registerDevice() {
        try {
            const deviceInfo = {
                deviceId: this.deviceId,
                platform: this.getPlatformInfo(),
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            };

            const response = await fetch(`${authManager.serverUrl}/api/devices/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authManager.getAuthHeader()
                },
                body: JSON.stringify(deviceInfo)
            });

            if (response.ok) {
                await secureStorage.setDeviceInfo(deviceInfo);
                console.log('設備註冊成功');
                return true;
            } else {
                throw new Error('設備註冊失敗');
            }
        } catch (error) {
            console.error('設備註冊失敗:', error);
            return false;
        }
    }

    // 開始定期同步
    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (this.isEnabled && authManager.isAuth()) {
                await this.performSync();
            }
        }, this.syncFrequency);
    }

    // 停止定期同步
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // 執行同步
    async performSync() {
        if (this.isSyncing) {
            return;
        }

        this.isSyncing = true;
        
        try {
            console.log('開始同步數據...');
            
            // 1. 同步對話列表
            await this.syncConversations();
            
            // 2. 同步消息
            await this.syncMessages();
            
            // 3. 同步用戶設置
            await this.syncSettings();
            
            // 4. 處理同步隊列
            await this.processSyncQueue();
            
            this.lastSyncTime = Date.now();
            console.log('數據同步完成');
            
            // 觸發同步完成事件
            this.emit('sync_completed');
            
        } catch (error) {
            console.error('數據同步失敗:', error);
            this.emit('sync_failed', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // 同步對話列表
    async syncConversations() {
        try {
            const response = await fetch(`${authManager.serverUrl}/api/conversations`, {
                headers: authManager.getAuthHeader()
            });

            if (response.ok) {
                const serverConversations = await response.json();
                const localConversations = await secureStorage.getAllChats();
                
                // 合併和解決衝突
                const mergedConversations = await this.conflictResolver.resolveConversationConflicts(
                    localConversations,
                    serverConversations
                );
                
                // 更新本地數據
                for (const [chatId, chatData] of Object.entries(mergedConversations)) {
                    await secureStorage.setChatData(chatId, chatData);
                }
                
                return true;
            }
        } catch (error) {
            console.error('同步對話列表失敗:', error);
            return false;
        }
    }

    // 同步消息
    async syncMessages() {
        try {
            const localChats = await secureStorage.getAllChats();
            
            for (const [chatId, chatData] of Object.entries(localChats)) {
                const lastSyncTime = chatData.lastSync || 0;
                
                const response = await fetch(
                    `${authManager.serverUrl}/api/conversations/${chatId}/messages?since=${lastSyncTime}`,
                    { headers: authManager.getAuthHeader() }
                );

                if (response.ok) {
                    const newMessages = await response.json();
                    
                    if (newMessages.length > 0) {
                        // 合併新消息
                        chatData.messages = chatData.messages || [];
                        chatData.messages = [...chatData.messages, ...newMessages];
                        chatData.lastSync = Date.now();
                        
                        await secureStorage.setChatData(chatId, chatData);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('同步消息失敗:', error);
            return false;
        }
    }

    // 同步設置
    async syncSettings() {
        try {
            const response = await fetch(`${authManager.serverUrl}/api/user/settings`, {
                headers: authManager.getAuthHeader()
            });

            if (response.ok) {
                const serverSettings = await response.json();
                const localSettings = await secureStorage.getSettings();
                
                // 合併設置
                const mergedSettings = { ...localSettings, ...serverSettings };
                await secureStorage.setSettings(mergedSettings);
                
                return true;
            }
        } catch (error) {
            console.error('同步設置失敗:', error);
            return false;
        }
    }

    // 處理同步隊列
    async processSyncQueue() {
        while (this.syncQueue.length > 0) {
            const item = this.syncQueue.shift();
            
            try {
                await this.uploadChange(item);
            } catch (error) {
                console.error('上傳變更失敗:', error);
                // 重新加入隊列
                this.syncQueue.unshift(item);
                break;
            }
        }
    }

    // 上傳變更到服務器
    async uploadChange(change) {
        const { type, data, timestamp } = change;
        
        switch (type) {
            case 'message':
                return await this.uploadMessage(data);
            case 'conversation':
                return await this.uploadConversation(data);
            case 'settings':
                return await this.uploadSettings(data);
            default:
                console.warn('未知的變更類型:', type);
        }
    }

    // 上傳消息
    async uploadMessage(messageData) {
        const response = await fetch(`${authManager.serverUrl}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authManager.getAuthHeader()
            },
            body: JSON.stringify(messageData)
        });

        return response.ok;
    }

    // 上傳對話
    async uploadConversation(conversationData) {
        const response = await fetch(`${authManager.serverUrl}/api/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authManager.getAuthHeader()
            },
            body: JSON.stringify(conversationData)
        });

        return response.ok;
    }

    // 上傳設置
    async uploadSettings(settingsData) {
        const response = await fetch(`${authManager.serverUrl}/api/user/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...authManager.getAuthHeader()
            },
            body: JSON.stringify(settingsData)
        });

        return response.ok;
    }

    // 添加變更到同步隊列
    queueChange(type, data) {
        this.syncQueue.push({
            type,
            data,
            timestamp: Date.now(),
            deviceId: this.deviceId
        });
    }

    // 設置數據變化監聽器
    setupDataChangeListeners() {
        // 監聽消息變化
        wsManager.on('message', (messageData) => {
            this.queueChange('message', messageData);
        });
        
        // 監聽對話變化
        wsManager.on('conversation_updated', (conversationData) => {
            this.queueChange('conversation', conversationData);
        });
    }

    // 設置網路狀態監聽器
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('網路連接恢復，開始同步...');
            this.performSync();
        });

        window.addEventListener('offline', () => {
            console.log('網路連接斷開，暫停同步');
        });
    }

    // 強制同步
    async forceSync() {
        await this.performSync();
    }

    // 獲取同步狀態
    getSyncStatus() {
        return {
            isEnabled: this.isEnabled,
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime,
            queueLength: this.syncQueue.length,
            deviceId: this.deviceId
        };
    }

    // 啟用/禁用同步
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (enabled) {
            this.startPeriodicSync();
        } else {
            this.stopPeriodicSync();
        }
    }

    // 事件發射器
    emit(event, data) {
        // 這裡可以集成到全局事件系統
        console.log(`同步事件: ${event}`, data);
    }
}

// 衝突解決器
class ConflictResolver {
    // 解決對話衝突
    async resolveConversationConflicts(local, server) {
        const merged = { ...local };
        
        for (const [id, serverData] of Object.entries(server)) {
            if (!merged[id]) {
                // 服務器有，本地沒有 - 添加
                merged[id] = serverData;
            } else {
                // 兩邊都有 - 合併
                merged[id] = this.mergeConversationData(merged[id], serverData);
            }
        }
        
        return merged;
    }

    // 合併對話數據
    mergeConversationData(local, server) {
        // 使用最新的時間戳作為準則
        const localTime = local.lastModified || 0;
        const serverTime = server.lastModified || 0;
        
        if (serverTime > localTime) {
            return { ...local, ...server };
        } else {
            return local;
        }
    }

    // 解決消息衝突
    resolveMessageConflicts(localMessages, serverMessages) {
        const merged = [...localMessages];
        const localIds = new Set(localMessages.map(m => m.id));
        
        // 添加本地沒有的服務器消息
        for (const serverMessage of serverMessages) {
            if (!localIds.has(serverMessage.id)) {
                merged.push(serverMessage);
            }
        }
        
        // 按時間戳排序
        return merged.sort((a, b) => a.timestamp - b.timestamp);
    }
}

// 創建全局實例
window.syncManager = new SyncManager();

