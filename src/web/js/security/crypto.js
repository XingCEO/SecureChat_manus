// AES-256 端到端加密模組
class CryptoManager {
    constructor() {
        this.keyPairs = new Map(); // 存儲會話密鑰對
        this.publicKeys = new Map(); // 存儲其他用戶的公鑰
        this.privateKey = null; // 當前用戶的私鑰
        this.publicKey = null; // 當前用戶的公鑰
        this.isInitialized = false;
    }

    // 初始化加密管理器
    async initialize() {
        try {
            // 生成或恢復密鑰對
            await this.generateOrRestoreKeyPair();
            
            // 初始化會話密鑰
            await this.initializeSessionKeys();
            
            this.isInitialized = true;
            console.log('加密管理器初始化成功');
            return true;
        } catch (error) {
            console.error('加密管理器初始化失敗:', error);
            return false;
        }
    }

    // 生成或恢復RSA密鑰對
    async generateOrRestoreKeyPair() {
        try {
            // 嘗試從安全存儲中恢復密鑰對
            const storedKeyPair = await secureStorage.getItem('user_keypair');
            
            if (storedKeyPair) {
                // 恢復密鑰對
                this.privateKey = await crypto.subtle.importKey(
                    'jwk',
                    storedKeyPair.privateKey,
                    {
                        name: 'RSA-OAEP',
                        hash: 'SHA-256'
                    },
                    true,
                    ['decrypt']
                );

                this.publicKey = await crypto.subtle.importKey(
                    'jwk',
                    storedKeyPair.publicKey,
                    {
                        name: 'RSA-OAEP',
                        hash: 'SHA-256'
                    },
                    true,
                    ['encrypt']
                );
                
                console.log('密鑰對恢復成功');
            } else {
                // 生成新的密鑰對
                const keyPair = await crypto.subtle.generateKey(
                    {
                        name: 'RSA-OAEP',
                        modulusLength: 2048,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: 'SHA-256'
                    },
                    true,
                    ['encrypt', 'decrypt']
                );

                this.privateKey = keyPair.privateKey;
                this.publicKey = keyPair.publicKey;

                // 導出並存儲密鑰對
                const privateKeyJwk = await crypto.subtle.exportKey('jwk', this.privateKey);
                const publicKeyJwk = await crypto.subtle.exportKey('jwk', this.publicKey);

                await secureStorage.setItem('user_keypair', {
                    privateKey: privateKeyJwk,
                    publicKey: publicKeyJwk
                });

                console.log('新密鑰對生成成功');
            }
        } catch (error) {
            console.error('密鑰對生成/恢復失敗:', error);
            throw error;
        }
    }

    // 初始化會話密鑰
    async initializeSessionKeys() {
        try {
            const storedSessionKeys = await secureStorage.getItem('session_keys') || {};
            
            for (const [conversationId, keyData] of Object.entries(storedSessionKeys)) {
                const sessionKey = await crypto.subtle.importKey(
                    'jwk',
                    keyData,
                    { name: 'AES-GCM' },
                    true,
                    ['encrypt', 'decrypt']
                );
                
                this.keyPairs.set(conversationId, sessionKey);
            }
            
            console.log(`恢復了 ${this.keyPairs.size} 個會話密鑰`);
        } catch (error) {
            console.error('會話密鑰初始化失敗:', error);
        }
    }

    // 為對話生成會話密鑰
    async generateSessionKey(conversationId) {
        try {
            const sessionKey = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            this.keyPairs.set(conversationId, sessionKey);

            // 存儲會話密鑰
            const keyJwk = await crypto.subtle.exportKey('jwk', sessionKey);
            const storedSessionKeys = await secureStorage.getItem('session_keys') || {};
            storedSessionKeys[conversationId] = keyJwk;
            await secureStorage.setItem('session_keys', storedSessionKeys);

            console.log(`為對話 ${conversationId} 生成會話密鑰`);
            return sessionKey;
        } catch (error) {
            console.error('生成會話密鑰失敗:', error);
            throw error;
        }
    }

    // 獲取對話的會話密鑰
    async getSessionKey(conversationId) {
        if (this.keyPairs.has(conversationId)) {
            return this.keyPairs.get(conversationId);
        }

        // 如果沒有會話密鑰，生成一個新的
        return await this.generateSessionKey(conversationId);
    }

    // 加密消息
    async encryptMessage(conversationId, message) {
        try {
            if (!this.isInitialized) {
                throw new Error('加密管理器未初始化');
            }

            const sessionKey = await this.getSessionKey(conversationId);
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(message));

            // 生成隨機IV
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // 加密數據
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                sessionKey,
                data
            );

            // 組合IV和加密數據
            const result = new Uint8Array(iv.length + encryptedData.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encryptedData), iv.length);

            // 轉換為Base64
            const encryptedMessage = btoa(String.fromCharCode(...result));

            return {
                encrypted: true,
                content: encryptedMessage,
                algorithm: 'AES-GCM-256',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('消息加密失敗:', error);
            throw error;
        }
    }

    // 解密消息
    async decryptMessage(conversationId, encryptedMessage) {
        try {
            if (!this.isInitialized) {
                throw new Error('加密管理器未初始化');
            }

            const sessionKey = await this.getSessionKey(conversationId);
            
            // 從Base64解碼
            const encryptedData = new Uint8Array(
                atob(encryptedMessage.content).split('').map(char => char.charCodeAt(0))
            );

            // 提取IV和加密數據
            const iv = encryptedData.slice(0, 12);
            const data = encryptedData.slice(12);

            // 解密數據
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                sessionKey,
                data
            );

            // 解碼消息
            const decoder = new TextDecoder();
            const messageJson = decoder.decode(decryptedData);
            const message = JSON.parse(messageJson);

            return {
                ...message,
                decrypted: true
            };
        } catch (error) {
            console.error('消息解密失敗:', error);
            throw error;
        }
    }

    // 加密文件
    async encryptFile(conversationId, file) {
        try {
            const sessionKey = await this.getSessionKey(conversationId);
            const fileData = await this.fileToArrayBuffer(file);

            // 生成隨機IV
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // 加密文件數據
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                sessionKey,
                fileData
            );

            // 組合IV和加密數據
            const result = new Uint8Array(iv.length + encryptedData.byteLength);
            result.set(iv);
            result.set(new Uint8Array(encryptedData), iv.length);

            return {
                encryptedData: result,
                originalName: file.name,
                originalSize: file.size,
                mimeType: file.type,
                algorithm: 'AES-GCM-256'
            };
        } catch (error) {
            console.error('文件加密失敗:', error);
            throw error;
        }
    }

    // 解密文件
    async decryptFile(conversationId, encryptedFileData) {
        try {
            const sessionKey = await this.getSessionKey(conversationId);
            
            // 提取IV和加密數據
            const iv = encryptedFileData.encryptedData.slice(0, 12);
            const data = encryptedFileData.encryptedData.slice(12);

            // 解密文件數據
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                sessionKey,
                data
            );

            // 創建Blob對象
            const blob = new Blob([decryptedData], { type: encryptedFileData.mimeType });
            
            return {
                blob: blob,
                name: encryptedFileData.originalName,
                size: encryptedFileData.originalSize,
                type: encryptedFileData.mimeType
            };
        } catch (error) {
            console.error('文件解密失敗:', error);
            throw error;
        }
    }

    // 文件轉ArrayBuffer
    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // 導出公鑰
    async exportPublicKey() {
        try {
            if (!this.publicKey) {
                throw new Error('公鑰不存在');
            }

            const publicKeyJwk = await crypto.subtle.exportKey('jwk', this.publicKey);
            return JSON.stringify(publicKeyJwk);
        } catch (error) {
            console.error('導出公鑰失敗:', error);
            throw error;
        }
    }

    // 導入其他用戶的公鑰
    async importPublicKey(userId, publicKeyString) {
        try {
            const publicKeyJwk = JSON.parse(publicKeyString);
            const publicKey = await crypto.subtle.importKey(
                'jwk',
                publicKeyJwk,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-256'
                },
                true,
                ['encrypt']
            );

            this.publicKeys.set(userId, publicKey);
            
            // 存儲公鑰
            const storedPublicKeys = await secureStorage.getItem('public_keys') || {};
            storedPublicKeys[userId] = publicKeyJwk;
            await secureStorage.setItem('public_keys', storedPublicKeys);

            console.log(`導入用戶 ${userId} 的公鑰成功`);
            return true;
        } catch (error) {
            console.error('導入公鑰失敗:', error);
            return false;
        }
    }

    // 使用RSA加密會話密鑰
    async encryptSessionKeyForUser(conversationId, userId) {
        try {
            const sessionKey = await this.getSessionKey(conversationId);
            const userPublicKey = this.publicKeys.get(userId);

            if (!userPublicKey) {
                throw new Error(`用戶 ${userId} 的公鑰不存在`);
            }

            // 導出會話密鑰
            const sessionKeyJwk = await crypto.subtle.exportKey('jwk', sessionKey);
            const sessionKeyString = JSON.stringify(sessionKeyJwk);

            // 使用RSA加密會話密鑰
            const encoder = new TextEncoder();
            const data = encoder.encode(sessionKeyString);

            const encryptedSessionKey = await crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                userPublicKey,
                data
            );

            return btoa(String.fromCharCode(...new Uint8Array(encryptedSessionKey)));
        } catch (error) {
            console.error('加密會話密鑰失敗:', error);
            throw error;
        }
    }

    // 解密接收到的會話密鑰
    async decryptSessionKey(conversationId, encryptedSessionKey) {
        try {
            if (!this.privateKey) {
                throw new Error('私鑰不存在');
            }

            // 從Base64解碼
            const encryptedData = new Uint8Array(
                atob(encryptedSessionKey).split('').map(char => char.charCodeAt(0))
            );

            // 使用RSA解密
            const decryptedData = await crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                this.privateKey,
                encryptedData
            );

            // 解碼會話密鑰
            const decoder = new TextDecoder();
            const sessionKeyString = decoder.decode(decryptedData);
            const sessionKeyJwk = JSON.parse(sessionKeyString);

            // 導入會話密鑰
            const sessionKey = await crypto.subtle.importKey(
                'jwk',
                sessionKeyJwk,
                { name: 'AES-GCM' },
                true,
                ['encrypt', 'decrypt']
            );

            // 存儲會話密鑰
            this.keyPairs.set(conversationId, sessionKey);
            
            const storedSessionKeys = await secureStorage.getItem('session_keys') || {};
            storedSessionKeys[conversationId] = sessionKeyJwk;
            await secureStorage.setItem('session_keys', storedSessionKeys);

            console.log(`成功解密並存儲對話 ${conversationId} 的會話密鑰`);
            return true;
        } catch (error) {
            console.error('解密會話密鑰失敗:', error);
            return false;
        }
    }

    // 生成安全隨機密碼
    generateSecurePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        
        return Array.from(array, byte => charset[byte % charset.length]).join('');
    }

    // 生成哈希
    async generateHash(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 驗證消息完整性
    async verifyMessageIntegrity(message, expectedHash) {
        const messageHash = await this.generateHash(JSON.stringify(message));
        return messageHash === expectedHash;
    }

    // 清除所有密鑰（應急銷毀）
    async clearAllKeys() {
        try {
            this.keyPairs.clear();
            this.publicKeys.clear();
            this.privateKey = null;
            this.publicKey = null;
            
            await secureStorage.removeItem('user_keypair');
            await secureStorage.removeItem('session_keys');
            await secureStorage.removeItem('public_keys');
            
            this.isInitialized = false;
            console.log('所有加密密鑰已清除');
            return true;
        } catch (error) {
            console.error('清除密鑰失敗:', error);
            return false;
        }
    }

    // 獲取加密狀態
    getEncryptionStatus() {
        return {
            isInitialized: this.isInitialized,
            hasPrivateKey: this.privateKey !== null,
            hasPublicKey: this.publicKey !== null,
            sessionKeyCount: this.keyPairs.size,
            publicKeyCount: this.publicKeys.size
        };
    }
}

// 創建全局實例
window.cryptoManager = new CryptoManager();

