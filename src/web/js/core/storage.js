// 本地加密儲存模組
class SecureStorage {
    constructor() {
        this.storageKey = 'securechat_data';
        this.encryptionKey = null;
        this.isInitialized = false;
    }

    // 初始化加密密鑰
    async initialize(password) {
        try {
            // 使用密碼生成加密密鑰
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            
            this.encryptionKey = await crypto.subtle.importKey(
                'raw',
                hashBuffer,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
            
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('儲存初始化失敗:', error);
            return false;
        }
    }

    // 加密數據
    async encrypt(data) {
        if (!this.isInitialized) {
            throw new Error('儲存未初始化');
        }

        try {
            const encoder = new TextEncoder();
            const encodedData = encoder.encode(JSON.stringify(data));
            
            // 生成隨機IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                encodedData
            );

            // 將IV和加密數據合併
            const result = new Uint8Array(iv.length + encryptedData.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encryptedData), iv.length);

            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('數據加密失敗:', error);
            throw error;
        }
    }

    // 解密數據
    async decrypt(encryptedData) {
        if (!this.isInitialized) {
            throw new Error('儲存未初始化');
        }

        try {
            const data = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // 提取IV和加密數據
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);

            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                this.encryptionKey,
                encrypted
            );

            const decoder = new TextDecoder();
            const jsonString = decoder.decode(decryptedData);
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('數據解密失敗:', error);
            throw error;
        }
    }

    // 安全存儲數據
    async setItem(key, value) {
        try {
            const existingData = await this.getAllData();
            existingData[key] = value;
            
            const encryptedData = await this.encrypt(existingData);
            localStorage.setItem(this.storageKey, encryptedData);
            
            return true;
        } catch (error) {
            console.error('存儲數據失敗:', error);
            return false;
        }
    }

    // 安全獲取數據
    async getItem(key) {
        try {
            const allData = await this.getAllData();
            return allData[key] || null;
        } catch (error) {
            console.error('獲取數據失敗:', error);
            return null;
        }
    }

    // 獲取所有數據
    async getAllData() {
        try {
            const encryptedData = localStorage.getItem(this.storageKey);
            if (!encryptedData) {
                return {};
            }
            
            return await this.decrypt(encryptedData);
        } catch (error) {
            console.error('獲取所有數據失敗:', error);
            return {};
        }
    }

    // 刪除數據
    async removeItem(key) {
        try {
            const existingData = await this.getAllData();
            delete existingData[key];
            
            const encryptedData = await this.encrypt(existingData);
            localStorage.setItem(this.storageKey, encryptedData);
            
            return true;
        } catch (error) {
            console.error('刪除數據失敗:', error);
            return false;
        }
    }

    // 清除所有數據
    async clear() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('清除數據失敗:', error);
            return false;
        }
    }

    // 存儲用戶信息
    async setUserData(userData) {
        return await this.setItem('user', userData);
    }

    // 獲取用戶信息
    async getUserData() {
        return await this.getItem('user');
    }

    // 存儲聊天記錄
    async setChatData(chatId, chatData) {
        const chats = await this.getItem('chats') || {};
        chats[chatId] = chatData;
        return await this.setItem('chats', chats);
    }

    // 獲取聊天記錄
    async getChatData(chatId) {
        const chats = await this.getItem('chats') || {};
        return chats[chatId] || null;
    }

    // 獲取所有聊天記錄
    async getAllChats() {
        return await this.getItem('chats') || {};
    }

    // 存儲設置
    async setSettings(settings) {
        return await this.setItem('settings', settings);
    }

    // 獲取設置
    async getSettings() {
        const defaultSettings = {
            threatDetection: true,
            autoDestroy: 24,
            disguiseMode: 'normal',
            notifications: true,
            soundEnabled: true
        };
        
        const settings = await this.getItem('settings');
        return { ...defaultSettings, ...settings };
    }

    // 存儲設備信息
    async setDeviceInfo(deviceInfo) {
        return await this.setItem('device', deviceInfo);
    }

    // 獲取設備信息
    async getDeviceInfo() {
        return await this.getItem('device');
    }

    // 檢查儲存是否可用
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    // 獲取儲存使用情況
    getStorageUsage() {
        if (!this.isAvailable()) {
            return { used: 0, total: 0, percentage: 0 };
        }

        try {
            let used = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage[key].length + key.length;
                }
            }

            // 估算總容量（通常為5-10MB）
            const total = 5 * 1024 * 1024; // 5MB
            const percentage = (used / total) * 100;

            return {
                used: used,
                total: total,
                percentage: Math.round(percentage * 100) / 100
            };
        } catch (error) {
            return { used: 0, total: 0, percentage: 0 };
        }
    }
}

// 創建全局實例
window.secureStorage = new SecureStorage();

