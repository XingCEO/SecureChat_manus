// WebSocket 即時通訊模組
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.serverUrl = 'ws://localhost:3000';
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.heartbeatInterval = null;
        this.connectionTimeout = null;
    }

    // 設置服務器URL
    setServerUrl(url) {
        this.serverUrl = url.replace('http', 'ws');
    }

    // 連接到服務器
    async connect(token) {
        try {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                return true;
            }

            this.socket = new WebSocket(this.serverUrl);

            // 設置連接超時
            this.connectionTimeout = setTimeout(() => {
                if (this.socket.readyState === WebSocket.CONNECTING) {
                    this.socket.close();
                    this.handleConnectionError(new Error('連接超時'));
                }
            }, 10000);

            return new Promise((resolve, reject) => {
                this.socket.onopen = () => {
                    clearTimeout(this.connectionTimeout);
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // 發送認證信息
                    this.send('authenticate', { token });
                    
                    // 開始心跳檢測
                    this.startHeartbeat();
                    
                    // 處理消息隊列
                    this.processMessageQueue();
                    
                    this.emit('connected');
                    resolve(true);
                };

                this.socket.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.socket.onclose = (event) => {
                    this.handleDisconnection(event);
                };

                this.socket.onerror = (error) => {
                    clearTimeout(this.connectionTimeout);
                    this.handleConnectionError(error);
                    reject(error);
                };
            });
        } catch (error) {
            console.error('WebSocket 連接失敗:', error);
            throw error;
        }
    }

    // 處理消息
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            const { type, payload } = data;

            switch (type) {
                case 'authenticated':
                    console.log('WebSocket 認證成功');
                    break;
                case 'new_message':
                    this.emit('message', payload);
                    break;
                case 'user_typing':
                    this.emit('typing', payload);
                    break;
                case 'user_online':
                    this.emit('user_online', payload);
                    break;
                case 'user_offline':
                    this.emit('user_offline', payload);
                    break;
                case 'conversation_updated':
                    this.emit('conversation_updated', payload);
                    break;
                case 'threat_warning':
                    this.emit('threat_warning', payload);
                    break;
                case 'emergency_alert':
                    this.emit('emergency_alert', payload);
                    break;
                case 'pong':
                    // 心跳響應
                    break;
                case 'error':
                    console.error('服務器錯誤:', payload);
                    this.emit('error', payload);
                    break;
                default:
                    console.log('未知消息類型:', type, payload);
            }
        } catch (error) {
            console.error('處理消息失敗:', error);
        }
    }

    // 發送消息
    send(type, payload = {}) {
        const message = { type, payload, timestamp: Date.now() };

        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            try {
                this.socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('發送消息失敗:', error);
                this.messageQueue.push(message);
                return false;
            }
        } else {
            // 將消息加入隊列，等待連接恢復
            this.messageQueue.push(message);
            return false;
        }
    }

    // 處理消息隊列
    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            try {
                this.socket.send(JSON.stringify(message));
            } catch (error) {
                console.error('處理隊列消息失敗:', error);
                this.messageQueue.unshift(message);
                break;
            }
        }
    }

    // 發送聊天消息
    sendMessage(conversationId, content, encrypted = false) {
        return this.send('send_message', {
            conversationId,
            content,
            encrypted
        });
    }

    // 加入對話房間
    joinConversation(conversationId) {
        return this.send('join_conversation', conversationId);
    }

    // 離開對話房間
    leaveConversation(conversationId) {
        return this.send('leave_conversation', conversationId);
    }

    // 發送打字狀態
    sendTyping(conversationId, isTyping) {
        return this.send('typing', {
            conversationId,
            isTyping
        });
    }

    // 發送威脅檢測事件
    reportThreat(threatData) {
        return this.send('threat_detected', threatData);
    }

    // 發送應急銷毀請求
    requestEmergencyDestroy(level, password) {
        return this.send('emergency_destroy', {
            level,
            password
        });
    }

    // 處理斷開連接
    handleDisconnection(event) {
        this.isConnected = false;
        this.stopHeartbeat();
        
        console.log('WebSocket 連接已斷開:', event.code, event.reason);
        this.emit('disconnected', { code: event.code, reason: event.reason });

        // 嘗試重新連接
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.attemptReconnect();
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        } else {
            this.emit('connection_failed');
        }
    }

    // 處理連接錯誤
    handleConnectionError(error) {
        console.error('WebSocket 連接錯誤:', error);
        this.isConnected = false;
        this.emit('connection_error', error);
    }

    // 嘗試重新連接
    async attemptReconnect() {
        if (this.isConnected) {
            return;
        }

        this.reconnectAttempts++;
        console.log(`嘗試重新連接... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        try {
            const token = authManager.token;
            if (token) {
                await this.connect(token);
                this.emit('reconnected');
            }
        } catch (error) {
            console.error('重新連接失敗:', error);
            this.handleDisconnection({ code: 1006, reason: '重新連接失敗' });
        }
    }

    // 開始心跳檢測
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.send('ping');
            }
        }, 30000); // 每30秒發送一次心跳
    }

    // 停止心跳檢測
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // 斷開連接
    disconnect() {
        if (this.socket) {
            this.stopHeartbeat();
            this.socket.close(1000, '用戶主動斷開');
            this.socket = null;
        }
        this.isConnected = false;
        this.messageQueue = [];
    }

    // 事件監聽
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    // 移除事件監聽
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // 觸發事件
    emit(event, data = null) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`事件處理器錯誤 (${event}):`, error);
                }
            });
        }
    }

    // 獲取連接狀態
    getConnectionState() {
        if (!this.socket) {
            return 'disconnected';
        }

        switch (this.socket.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
                return 'closing';
            case WebSocket.CLOSED:
                return 'closed';
            default:
                return 'unknown';
        }
    }

    // 獲取連接統計
    getConnectionStats() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            queuedMessages: this.messageQueue.length,
            state: this.getConnectionState()
        };
    }
}

// 創建全局實例
window.wsManager = new WebSocketManager();

