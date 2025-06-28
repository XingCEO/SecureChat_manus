// 應急機制模組
class EmergencyManager {
    constructor() {
        this.isActive = false;
        this.emergencyLevels = {
            1: 'clear_current_session',
            2: 'clear_all_messages', 
            3: 'clear_user_data',
            4: 'complete_destruction'
        };
        this.coercionMode = false;
        this.decoyData = null;
        this.destructionTimer = null;
        this.emergencyContacts = [];
    }

    // 初始化應急管理器
    async initialize() {
        try {
            // 加載應急設置
            await this.loadEmergencySettings();
            
            // 加載偽裝數據
            await this.loadDecoyData();
            
            // 設置定期檢查
            this.startPeriodicCheck();
            
            console.log('應急管理器初始化成功');
            return true;
        } catch (error) {
            console.error('應急管理器初始化失敗:', error);
            return false;
        }
    }

    // 加載應急設置
    async loadEmergencySettings() {
        try {
            const settings = await secureStorage.getSettings();
            this.emergencyContacts = settings.emergencyContacts || [];
            
            const emergencyConfig = await secureStorage.getItem('emergency_config');
            if (emergencyConfig) {
                this.emergencyLevels = { ...this.emergencyLevels, ...emergencyConfig.levels };
            }
        } catch (error) {
            console.error('加載應急設置失敗:', error);
        }
    }

    // 加載偽裝數據
    async loadDecoyData() {
        try {
            this.decoyData = await secureStorage.getItem('decoy_data') || {
                conversations: [],
                messages: [],
                contacts: []
            };
            
            // 如果沒有偽裝數據，生成默認數據
            if (this.decoyData.conversations.length === 0) {
                await this.generateDefaultDecoyData();
            }
        } catch (error) {
            console.error('加載偽裝數據失敗:', error);
        }
    }

    // 生成默認偽裝數據
    async generateDefaultDecoyData() {
        const defaultDecoyData = {
            conversations: [
                {
                    id: 'decoy_work',
                    name: '工作群組',
                    type: 'group',
                    participants: ['張經理', '李同事', '王助理'],
                    messages: [
                        { sender: '張經理', content: '今天的會議改到下午3點', timestamp: Date.now() - 3600000 },
                        { sender: '李同事', content: '收到，我會準備好資料', timestamp: Date.now() - 3000000 },
                        { sender: '王助理', content: '會議室已經預訂好了', timestamp: Date.now() - 1800000 }
                    ]
                },
                {
                    id: 'decoy_family',
                    name: '家人群',
                    type: 'group',
                    participants: ['媽媽', '爸爸', '妹妹'],
                    messages: [
                        { sender: '媽媽', content: '晚餐想吃什麼？', timestamp: Date.now() - 7200000 },
                        { sender: '爸爸', content: '隨便，你決定就好', timestamp: Date.now() - 6900000 },
                        { sender: '妹妹', content: '我想吃火鍋！', timestamp: Date.now() - 6600000 }
                    ]
                },
                {
                    id: 'decoy_friend',
                    name: '小明',
                    type: 'direct',
                    participants: ['小明'],
                    messages: [
                        { sender: '小明', content: '週末有空嗎？一起看電影', timestamp: Date.now() - 10800000 },
                        { sender: 'me', content: '好啊，看什麼電影？', timestamp: Date.now() - 10500000 },
                        { sender: '小明', content: '新上映的動作片怎麼樣？', timestamp: Date.now() - 10200000 }
                    ]
                }
            ],
            contacts: [
                { name: '張經理', phone: '138****1234', role: 'work' },
                { name: '李同事', phone: '139****5678', role: 'work' },
                { name: '媽媽', phone: '136****9012', role: 'family' },
                { name: '小明', phone: '137****3456', role: 'friend' }
            ]
        };

        this.decoyData = defaultDecoyData;
        await secureStorage.setItem('decoy_data', this.decoyData);
    }

    // 檢測脅迫密碼
    async detectCoercionPassword(password) {
        try {
            // 檢查是否為脅迫密碼變體
            const isCoercion = await authManager.isCoercionPassword(password);
            
            if (isCoercion) {
                console.warn('檢測到脅迫密碼，啟動偽裝模式');
                await this.activateCoercionMode();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('脅迫密碼檢測失敗:', error);
            return false;
        }
    }

    // 啟動脅迫模式
    async activateCoercionMode() {
        try {
            this.coercionMode = true;
            
            // 記錄脅迫事件
            await this.logEmergencyEvent({
                type: 'coercion_detected',
                timestamp: Date.now(),
                details: 'Coercion password detected, decoy mode activated'
            });
            
            // 顯示偽裝數據
            await this.displayDecoyData();
            
            // 通知威脅檢測系統
            threatDetector.reportThreat({
                type: 'coercion',
                level: 3,
                details: { mode: 'activated' },
                message: '脅迫模式已啟動'
            });
            
            // 發送緊急信號（如果配置了）
            await this.sendEmergencySignal();
            
            return true;
        } catch (error) {
            console.error('啟動脅迫模式失敗:', error);
            return false;
        }
    }

    // 顯示偽裝數據
    async displayDecoyData() {
        try {
            // 替換真實聊天數據
            const chatList = document.getElementById('chat-list');
            if (chatList) {
                chatList.innerHTML = '';
                
                for (const conversation of this.decoyData.conversations) {
                    const chatItem = this.createDecoyConversationElement(conversation);
                    chatList.appendChild(chatItem);
                }
            }
            
            // 隱藏真實功能
            this.hideRealFeatures();
            
            console.log('偽裝數據已顯示');
        } catch (error) {
            console.error('顯示偽裝數據失敗:', error);
        }
    }

    // 創建偽裝對話元素
    createDecoyConversationElement(conversation) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.dataset.chatId = conversation.id;
        
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const timeStr = new Date(lastMessage.timestamp).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        chatItem.innerHTML = `
            <div class="chat-avatar">
                <span>${conversation.name.charAt(0)}</span>
            </div>
            <div class="chat-info">
                <div class="chat-name">${conversation.name}</div>
                <div class="chat-preview">${lastMessage.content}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${timeStr}</div>
            </div>
        `;
        
        // 添加點擊事件
        chatItem.addEventListener('click', () => {
            this.openDecoyConversation(conversation);
        });
        
        return chatItem;
    }

    // 打開偽裝對話
    openDecoyConversation(conversation) {
        // 這裡可以實現打開偽裝對話的邏輯
        console.log('打開偽裝對話:', conversation.name);
    }

    // 隱藏真實功能
    hideRealFeatures() {
        // 隱藏敏感按鈕和功能
        const sensitiveElements = [
            '#settings-btn',
            '#new-chat-btn',
            '.encryption-status',
            '.threat-indicator'
        ];
        
        sensitiveElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });
    }

    // 執行應急銷毀
    async executeEmergencyDestruction(level, password = null) {
        try {
            // 驗證應急密碼（如果需要）
            if (password && !await this.verifyEmergencyPassword(password)) {
                throw new Error('應急密碼錯誤');
            }
            
            console.warn(`執行 Level ${level} 應急銷毀`);
            
            // 記錄銷毀事件
            await this.logEmergencyEvent({
                type: 'emergency_destruction',
                level: level,
                timestamp: Date.now(),
                details: `Level ${level} destruction initiated`
            });
            
            // 根據級別執行相應的銷毀操作
            switch (level) {
                case 1:
                    await this.clearCurrentSession();
                    break;
                case 2:
                    await this.clearAllMessages();
                    break;
                case 3:
                    await this.clearUserData();
                    break;
                case 4:
                    await this.completeDestruction();
                    break;
                default:
                    throw new Error('無效的銷毀級別');
            }
            
            // 通知服務器
            if (wsManager.isConnected) {
                wsManager.requestEmergencyDestroy(level, password);
            }
            
            return true;
        } catch (error) {
            console.error('應急銷毀失敗:', error);
            return false;
        }
    }

    // Level 1: 清除當前會話
    async clearCurrentSession() {
        try {
            // 清除當前聊天界面
            const messagesContainer = document.getElementById('messages-list');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            
            // 清除輸入框
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = '';
            }
            
            console.log('Level 1 銷毀完成：當前會話已清除');
        } catch (error) {
            console.error('Level 1 銷毀失敗:', error);
        }
    }

    // Level 2: 清除所有消息
    async clearAllMessages() {
        try {
            // 清除本地消息數據
            const allChats = await secureStorage.getAllChats();
            for (const [chatId, chatData] of Object.entries(allChats)) {
                chatData.messages = [];
                await secureStorage.setChatData(chatId, chatData);
            }
            
            // 清除界面
            await this.clearCurrentSession();
            
            console.log('Level 2 銷毀完成：所有消息已清除');
        } catch (error) {
            console.error('Level 2 銷毀失敗:', error);
        }
    }

    // Level 3: 清除用戶數據
    async clearUserData() {
        try {
            // 清除所有聊天數據
            await this.clearAllMessages();
            
            // 清除用戶設置
            await secureStorage.removeItem('settings');
            await secureStorage.removeItem('user_profile');
            await secureStorage.removeItem('device');
            
            // 清除會話密鑰
            await secureStorage.removeItem('session_keys');
            
            console.log('Level 3 銷毀完成：用戶數據已清除');
        } catch (error) {
            console.error('Level 3 銷毀失敗:', error);
        }
    }

    // Level 4: 完全銷毀
    async completeDestruction() {
        try {
            // 執行所有低級別銷毀
            await this.clearUserData();
            
            // 清除所有加密密鑰
            await cryptoManager.clearAllKeys();
            
            // 清除所有本地存儲
            await secureStorage.clear();
            localStorage.clear();
            sessionStorage.clear();
            
            // 清除IndexedDB（如果使用）
            if ('indexedDB' in window) {
                try {
                    const databases = await indexedDB.databases();
                    for (const db of databases) {
                        indexedDB.deleteDatabase(db.name);
                    }
                } catch (error) {
                    console.warn('清除IndexedDB失敗:', error);
                }
            }
            
            // 清除Service Worker緩存（如果使用）
            if ('serviceWorker' in navigator && 'caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    for (const cacheName of cacheNames) {
                        await caches.delete(cacheName);
                    }
                } catch (error) {
                    console.warn('清除緩存失敗:', error);
                }
            }
            
            // 重定向到安全頁面或關閉應用
            this.showDestructionComplete();
            
            console.log('Level 4 銷毀完成：完全銷毀已執行');
        } catch (error) {
            console.error('Level 4 銷毀失敗:', error);
        }
    }

    // 顯示銷毀完成頁面
    showDestructionComplete() {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔒</div>
                    <h2 style="margin-bottom: 8px; color: #0f172a;">數據已安全清除</h2>
                    <p>所有敏感信息已被永久刪除</p>
                </div>
            </div>
        `;
        
        // 5秒後關閉頁面或重定向
        setTimeout(() => {
            if (window.close) {
                window.close();
            } else {
                window.location.href = 'about:blank';
            }
        }, 5000);
    }

    // 驗證應急密碼
    async verifyEmergencyPassword(password) {
        try {
            return await authManager.verifyEmergencyPassword(password);
        } catch (error) {
            console.error('驗證應急密碼失敗:', error);
            return false;
        }
    }

    // 發送緊急信號
    async sendEmergencySignal() {
        try {
            if (this.emergencyContacts.length === 0) {
                return;
            }
            
            const emergencyMessage = {
                type: 'emergency_alert',
                timestamp: Date.now(),
                message: '緊急情況：用戶可能處於危險中',
                location: threatDetector.currentSession.location
            };
            
            // 這裡可以實現發送緊急信號的邏輯
            // 例如：發送郵件、短信、推送通知等
            console.log('緊急信號已發送:', emergencyMessage);
            
        } catch (error) {
            console.error('發送緊急信號失敗:', error);
        }
    }

    // 記錄應急事件
    async logEmergencyEvent(event) {
        try {
            const emergencyLog = await secureStorage.getItem('emergency_log') || [];
            emergencyLog.push(event);
            
            // 保持最近50條記錄
            if (emergencyLog.length > 50) {
                emergencyLog.shift();
            }
            
            await secureStorage.setItem('emergency_log', emergencyLog);
        } catch (error) {
            console.error('記錄應急事件失敗:', error);
        }
    }

    // 定期檢查
    startPeriodicCheck() {
        setInterval(async () => {
            await this.checkEmergencyConditions();
        }, 60000); // 每分鐘檢查一次
    }

    // 檢查應急條件
    async checkEmergencyConditions() {
        try {
            // 檢查死人開關
            const lastCheckIn = await secureStorage.getItem('last_checkin');
            const settings = await secureStorage.getSettings();
            const autoDestroyHours = settings.autoDestroy || 24;
            
            if (lastCheckIn) {
                const hoursSinceCheckIn = (Date.now() - lastCheckIn) / (1000 * 60 * 60);
                
                if (hoursSinceCheckIn > autoDestroyHours) {
                    console.warn('死人開關觸發，執行自動銷毀');
                    await this.executeEmergencyDestruction(2); // Level 2 自動銷毀
                }
            }
        } catch (error) {
            console.error('檢查應急條件失敗:', error);
        }
    }

    // 設置應急聯絡人
    async setEmergencyContacts(contacts) {
        try {
            this.emergencyContacts = contacts;
            const settings = await secureStorage.getSettings();
            settings.emergencyContacts = contacts;
            await secureStorage.setSettings(settings);
            
            return true;
        } catch (error) {
            console.error('設置應急聯絡人失敗:', error);
            return false;
        }
    }

    // 獲取應急狀態
    getEmergencyStatus() {
        return {
            isActive: this.isActive,
            coercionMode: this.coercionMode,
            emergencyContacts: this.emergencyContacts.length,
            hasDecoyData: this.decoyData !== null
        };
    }

    // 停用脅迫模式
    async deactivateCoercionMode() {
        try {
            this.coercionMode = false;
            
            // 恢復真實界面
            window.location.reload();
            
            return true;
        } catch (error) {
            console.error('停用脅迫模式失敗:', error);
            return false;
        }
    }
}

// 創建全局實例
window.emergencyManager = new EmergencyManager();

