// 多重密碼驗證模組
class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.token = null;
        this.refreshToken = null;
        this.primaryPassword = null;
        this.secondaryPassword = null;
        this.emergencyPassword = null;
        this.serverUrl = 'http://localhost:3000';
    }

    // 設置服務器URL
    setServerUrl(url) {
        this.serverUrl = url;
    }

    // 用戶註冊
    async register(userData) {
        try {
            const response = await fetch(`${this.serverUrl}/api/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                this.isAuthenticated = true;
                
                // 初始化安全儲存
                await secureStorage.initialize(userData.password);
                await secureStorage.setUserData(data.user);
                
                // 存儲密碼哈希（用於本地驗證）
                await this.storePasswordHashes(userData.password, userData.secondaryPassword);
                
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('註冊失敗:', error);
            return { success: false, error: '網路連接失敗' };
        }
    }

    // 用戶登錄
    async login(username, password, secondaryPassword = null) {
        try {
            const response = await fetch(`${this.serverUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                this.isAuthenticated = true;
                this.primaryPassword = password;
                this.secondaryPassword = secondaryPassword;
                
                // 初始化安全儲存
                await secureStorage.initialize(password);
                await secureStorage.setUserData(data.user);
                
                // 驗證二級密碼（如果提供）
                if (secondaryPassword) {
                    const isValidSecondary = await this.verifySecondaryPassword(secondaryPassword);
                    if (!isValidSecondary) {
                        return { success: false, error: '二級密碼錯誤' };
                    }
                }
                
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('登錄失敗:', error);
            return { success: false, error: '網路連接失敗' };
        }
    }

    // 存儲密碼哈希
    async storePasswordHashes(primary, secondary, emergency = null) {
        try {
            const primaryHash = await this.hashPassword(primary);
            const secondaryHash = secondary ? await this.hashPassword(secondary) : null;
            const emergencyHash = emergency ? await this.hashPassword(emergency) : null;

            const passwordData = {
                primary: primaryHash,
                secondary: secondaryHash,
                emergency: emergencyHash,
                timestamp: Date.now()
            };

            await secureStorage.setItem('password_hashes', passwordData);
            return true;
        } catch (error) {
            console.error('存儲密碼哈希失敗:', error);
            return false;
        }
    }

    // 生成密碼哈希
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 驗證主密碼
    async verifyPrimaryPassword(password) {
        try {
            const passwordData = await secureStorage.getItem('password_hashes');
            if (!passwordData || !passwordData.primary) {
                return false;
            }

            const inputHash = await this.hashPassword(password);
            return inputHash === passwordData.primary;
        } catch (error) {
            console.error('驗證主密碼失敗:', error);
            return false;
        }
    }

    // 驗證二級密碼
    async verifySecondaryPassword(password) {
        try {
            const passwordData = await secureStorage.getItem('password_hashes');
            if (!passwordData || !passwordData.secondary) {
                return false;
            }

            const inputHash = await this.hashPassword(password);
            return inputHash === passwordData.secondary;
        } catch (error) {
            console.error('驗證二級密碼失敗:', error);
            return false;
        }
    }

    // 驗證應急密碼
    async verifyEmergencyPassword(password) {
        try {
            const passwordData = await secureStorage.getItem('password_hashes');
            if (!passwordData || !passwordData.emergency) {
                return false;
            }

            const inputHash = await this.hashPassword(password);
            return inputHash === passwordData.emergency;
        } catch (error) {
            console.error('驗證應急密碼失敗:', error);
            return false;
        }
    }

    // 檢查是否為脅迫密碼
    async isCoercionPassword(password) {
        // 脅迫密碼是主密碼的變體（例如在末尾添加特定字符）
        const coercionVariants = [
            password + '!',
            password + '0',
            password + '.',
            password.slice(0, -1) // 去掉最後一個字符
        ];

        for (const variant of coercionVariants) {
            if (await this.verifyPrimaryPassword(variant)) {
                return true;
            }
        }

        return false;
    }

    // 獲取認證頭
    getAuthHeader() {
        if (!this.token) {
            return null;
        }
        return { 'Authorization': `Bearer ${this.token}` };
    }

    // 刷新令牌
    async refreshAuthToken() {
        try {
            if (!this.refreshToken) {
                throw new Error('沒有刷新令牌');
            }

            const response = await fetch(`${this.serverUrl}/api/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                return true;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('刷新令牌失敗:', error);
            await this.logout();
            return false;
        }
    }

    // 檢查令牌是否有效
    isTokenValid() {
        if (!this.token) {
            return false;
        }

        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            const currentTime = Date.now() / 1000;
            return payload.exp > currentTime;
        } catch (error) {
            return false;
        }
    }

    // 自動刷新令牌
    startTokenRefresh() {
        setInterval(async () => {
            if (this.isAuthenticated && !this.isTokenValid()) {
                await this.refreshAuthToken();
            }
        }, 5 * 60 * 1000); // 每5分鐘檢查一次
    }

    // 登出
    async logout() {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.token = null;
        this.refreshToken = null;
        this.primaryPassword = null;
        this.secondaryPassword = null;
        this.emergencyPassword = null;

        // 清除本地存儲（可選）
        // await secureStorage.clear();
    }

    // 更改密碼
    async changePassword(oldPassword, newPassword, secondaryPassword = null) {
        try {
            // 驗證舊密碼
            const isValidOld = await this.verifyPrimaryPassword(oldPassword);
            if (!isValidOld) {
                return { success: false, error: '舊密碼錯誤' };
            }

            // 調用服務器API更改密碼
            const response = await fetch(`${this.serverUrl}/api/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword,
                    secondaryPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                // 更新本地密碼哈希
                await this.storePasswordHashes(newPassword, secondaryPassword);
                this.primaryPassword = newPassword;
                this.secondaryPassword = secondaryPassword;
                
                // 重新初始化安全儲存
                await secureStorage.initialize(newPassword);
                
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('更改密碼失敗:', error);
            return { success: false, error: '網路連接失敗' };
        }
    }

    // 設置應急密碼
    async setEmergencyPassword(password) {
        try {
            const passwordData = await secureStorage.getItem('password_hashes') || {};
            passwordData.emergency = await this.hashPassword(password);
            passwordData.timestamp = Date.now();
            
            await secureStorage.setItem('password_hashes', passwordData);
            this.emergencyPassword = password;
            
            return true;
        } catch (error) {
            console.error('設置應急密碼失敗:', error);
            return false;
        }
    }

    // 獲取當前用戶信息
    getCurrentUser() {
        return this.currentUser;
    }

    // 檢查是否已認證
    isAuth() {
        return this.isAuthenticated && this.isTokenValid();
    }

    // 檢查是否有二級權限
    hasSecondaryAccess() {
        return this.secondaryPassword !== null;
    }
}

// 創建全局實例
window.authManager = new AuthManager();

