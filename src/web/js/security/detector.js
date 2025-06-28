// 威脅檢測系統
class ThreatDetector {
    constructor() {
        this.isEnabled = true;
        this.detectionRules = {
            location: {
                maxSpeed: 50, // km/h
                enabled: true
            },
            time: {
                normalHours: { start: 6, end: 23 },
                enabled: true
            },
            behavior: {
                maxTypingDeviation: 30, // 百分比
                enabled: true
            },
            network: {
                enabled: true,
                trackChanges: true
            }
        };
        
        this.userProfile = {
            typingPattern: null,
            normalLocations: [],
            usageHours: [],
            networkFingerprint: null
        };
        
        this.currentSession = {
            startTime: Date.now(),
            location: null,
            networkInfo: null,
            typingMetrics: {
                keystrokes: [],
                avgSpeed: 0,
                rhythm: []
            }
        };
        
        this.threatHistory = [];
        this.watchInterval = null;
        this.locationWatcher = null;
    }

    // 初始化威脅檢測
    async initialize() {
        try {
            // 加載用戶配置文件
            await this.loadUserProfile();
            
            // 開始監控
            this.startMonitoring();
            
            // 初始化位置監控
            await this.initializeLocationMonitoring();
            
            // 初始化網路監控
            await this.initializeNetworkMonitoring();
            
            // 初始化行為監控
            this.initializeBehaviorMonitoring();
            
            console.log('威脅檢測系統初始化成功');
            return true;
        } catch (error) {
            console.error('威脅檢測系統初始化失敗:', error);
            return false;
        }
    }

    // 加載用戶配置文件
    async loadUserProfile() {
        try {
            const profile = await secureStorage.getItem('user_profile');
            if (profile) {
                this.userProfile = { ...this.userProfile, ...profile };
            }
            
            const rules = await secureStorage.getItem('detection_rules');
            if (rules) {
                this.detectionRules = { ...this.detectionRules, ...rules };
            }
        } catch (error) {
            console.error('加載用戶配置文件失敗:', error);
        }
    }

    // 保存用戶配置文件
    async saveUserProfile() {
        try {
            await secureStorage.setItem('user_profile', this.userProfile);
            await secureStorage.setItem('detection_rules', this.detectionRules);
        } catch (error) {
            console.error('保存用戶配置文件失敗:', error);
        }
    }

    // 開始監控
    startMonitoring() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
        }

        this.watchInterval = setInterval(() => {
            this.performThreatCheck();
        }, 5000); // 每5秒檢查一次
    }

    // 停止監控
    stopMonitoring() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
        
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
            this.locationWatcher = null;
        }
    }

    // 初始化位置監控
    async initializeLocationMonitoring() {
        if (!this.detectionRules.location.enabled) {
            return;
        }

        if ('geolocation' in navigator) {
            try {
                // 獲取當前位置
                const position = await this.getCurrentPosition();
                this.currentSession.location = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: Date.now(),
                    accuracy: position.coords.accuracy
                };

                // 開始監控位置變化
                this.locationWatcher = navigator.geolocation.watchPosition(
                    (position) => {
                        this.handleLocationUpdate(position);
                    },
                    (error) => {
                        console.warn('位置監控錯誤:', error);
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 60000
                    }
                );
            } catch (error) {
                console.warn('位置監控初始化失敗:', error);
            }
        }
    }

    // 獲取當前位置
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    // 處理位置更新
    handleLocationUpdate(position) {
        const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
        };

        if (this.currentSession.location) {
            // 計算移動速度
            const distance = this.calculateDistance(
                this.currentSession.location,
                newLocation
            );
            
            const timeDiff = (newLocation.timestamp - this.currentSession.location.timestamp) / 1000 / 3600; // 小時
            const speed = distance / timeDiff; // km/h

            // 檢查異常移動
            if (speed > this.detectionRules.location.maxSpeed) {
                this.reportThreat({
                    type: 'location',
                    level: 2,
                    details: {
                        speed: speed,
                        maxSpeed: this.detectionRules.location.maxSpeed,
                        distance: distance,
                        timeDiff: timeDiff
                    },
                    message: `檢測到異常移動速度: ${speed.toFixed(1)} km/h`
                });
            }
        }

        this.currentSession.location = newLocation;
    }

    // 計算兩點間距離（使用Haversine公式）
    calculateDistance(pos1, pos2) {
        const R = 6371; // 地球半徑（公里）
        const dLat = this.toRadians(pos2.latitude - pos1.latitude);
        const dLon = this.toRadians(pos2.longitude - pos1.longitude);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(pos1.latitude)) * Math.cos(this.toRadians(pos2.latitude)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // 角度轉弧度
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // 初始化網路監控
    async initializeNetworkMonitoring() {
        if (!this.detectionRules.network.enabled) {
            return;
        }

        try {
            // 獲取網路信息
            const networkInfo = await this.getNetworkInfo();
            this.currentSession.networkInfo = networkInfo;
            
            // 檢查網路變化
            if (this.userProfile.networkFingerprint) {
                const similarity = this.compareNetworkFingerprints(
                    this.userProfile.networkFingerprint,
                    networkInfo
                );
                
                if (similarity < 0.7) { // 相似度低於70%
                    this.reportThreat({
                        type: 'network',
                        level: 1,
                        details: {
                            similarity: similarity,
                            currentNetwork: networkInfo,
                            expectedNetwork: this.userProfile.networkFingerprint
                        },
                        message: '檢測到網路環境變化'
                    });
                }
            } else {
                // 首次使用，記錄網路指紋
                this.userProfile.networkFingerprint = networkInfo;
                await this.saveUserProfile();
            }
        } catch (error) {
            console.warn('網路監控初始化失敗:', error);
        }
    }

    // 獲取網路信息
    async getNetworkInfo() {
        const info = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            timestamp: Date.now()
        };

        // 獲取連接信息（如果可用）
        if ('connection' in navigator) {
            info.connection = {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }

        // 獲取時區信息
        info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        return info;
    }

    // 比較網路指紋
    compareNetworkFingerprints(fp1, fp2) {
        let matches = 0;
        let total = 0;

        const keys = ['userAgent', 'language', 'platform', 'timezone'];
        
        for (const key of keys) {
            total++;
            if (fp1[key] === fp2[key]) {
                matches++;
            }
        }

        return matches / total;
    }

    // 初始化行為監控
    initializeBehaviorMonitoring() {
        if (!this.detectionRules.behavior.enabled) {
            return;
        }

        // 監控鍵盤輸入
        document.addEventListener('keydown', (event) => {
            this.recordKeystroke(event);
        });

        document.addEventListener('keyup', (event) => {
            this.recordKeyRelease(event);
        });
    }

    // 記錄按鍵
    recordKeystroke(event) {
        const keystroke = {
            key: event.key,
            timestamp: Date.now(),
            type: 'down'
        };

        this.currentSession.typingMetrics.keystrokes.push(keystroke);
        
        // 保持最近1000次按鍵記錄
        if (this.currentSession.typingMetrics.keystrokes.length > 1000) {
            this.currentSession.typingMetrics.keystrokes.shift();
        }

        // 定期分析打字模式
        if (this.currentSession.typingMetrics.keystrokes.length % 50 === 0) {
            this.analyzeTypingPattern();
        }
    }

    // 記錄按鍵釋放
    recordKeyRelease(event) {
        const keystroke = {
            key: event.key,
            timestamp: Date.now(),
            type: 'up'
        };

        this.currentSession.typingMetrics.keystrokes.push(keystroke);
    }

    // 分析打字模式
    analyzeTypingPattern() {
        const keystrokes = this.currentSession.typingMetrics.keystrokes;
        if (keystrokes.length < 20) return;

        // 計算打字速度
        const recentKeystrokes = keystrokes.slice(-20);
        const timeSpan = recentKeystrokes[recentKeystrokes.length - 1].timestamp - recentKeystrokes[0].timestamp;
        const currentSpeed = (recentKeystrokes.length / timeSpan) * 1000 * 60; // 每分鐘按鍵數

        // 計算節奏模式
        const intervals = [];
        for (let i = 1; i < recentKeystrokes.length; i++) {
            intervals.push(recentKeystrokes[i].timestamp - recentKeystrokes[i - 1].timestamp);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const rhythm = intervals.map(interval => interval / avgInterval);

        // 與用戶配置文件比較
        if (this.userProfile.typingPattern) {
            const speedDeviation = Math.abs(currentSpeed - this.userProfile.typingPattern.avgSpeed) / this.userProfile.typingPattern.avgSpeed * 100;
            
            if (speedDeviation > this.detectionRules.behavior.maxTypingDeviation) {
                this.reportThreat({
                    type: 'behavior',
                    level: 1,
                    details: {
                        currentSpeed: currentSpeed,
                        expectedSpeed: this.userProfile.typingPattern.avgSpeed,
                        deviation: speedDeviation
                    },
                    message: `檢測到打字習慣異常，速度偏差: ${speedDeviation.toFixed(1)}%`
                });
            }
        } else {
            // 建立用戶打字模式
            this.userProfile.typingPattern = {
                avgSpeed: currentSpeed,
                rhythm: rhythm,
                samples: 1
            };
        }

        // 更新當前會話指標
        this.currentSession.typingMetrics.avgSpeed = currentSpeed;
        this.currentSession.typingMetrics.rhythm = rhythm;
    }

    // 檢查使用時間
    checkUsageTime() {
        if (!this.detectionRules.time.enabled) {
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const { start, end } = this.detectionRules.time.normalHours;

        if (currentHour < start || currentHour > end) {
            this.reportThreat({
                type: 'time',
                level: 1,
                details: {
                    currentHour: currentHour,
                    normalHours: this.detectionRules.time.normalHours
                },
                message: `非正常使用時段: ${currentHour}:00`
            });
        }
    }

    // 執行威脅檢查
    performThreatCheck() {
        if (!this.isEnabled) {
            return;
        }

        // 檢查使用時間
        this.checkUsageTime();
        
        // 檢查會話持續時間
        this.checkSessionDuration();
        
        // 檢查死人開關
        this.checkDeadManSwitch();
    }

    // 檢查會話持續時間
    checkSessionDuration() {
        const sessionDuration = Date.now() - this.currentSession.startTime;
        const hours = sessionDuration / (1000 * 60 * 60);

        // 如果會話超過12小時，發出警告
        if (hours > 12) {
            this.reportThreat({
                type: 'session',
                level: 1,
                details: {
                    duration: hours
                },
                message: `會話持續時間過長: ${hours.toFixed(1)} 小時`
            });
        }
    }

    // 檢查死人開關
    async checkDeadManSwitch() {
        try {
            const lastCheckIn = await secureStorage.getItem('last_checkin');
            const autoDestroyHours = (await secureStorage.getSettings()).autoDestroy || 24;
            
            if (lastCheckIn) {
                const hoursSinceCheckIn = (Date.now() - lastCheckIn) / (1000 * 60 * 60);
                
                if (hoursSinceCheckIn > autoDestroyHours) {
                    this.reportThreat({
                        type: 'deadman',
                        level: 4,
                        details: {
                            hoursSinceCheckIn: hoursSinceCheckIn,
                            autoDestroyHours: autoDestroyHours
                        },
                        message: `死人開關觸發: ${hoursSinceCheckIn.toFixed(1)} 小時未檢入`
                    });
                }
            }
        } catch (error) {
            console.error('檢查死人開關失敗:', error);
        }
    }

    // 用戶檢入（重置死人開關）
    async userCheckIn() {
        try {
            await secureStorage.setItem('last_checkin', Date.now());
            console.log('用戶檢入成功');
            return true;
        } catch (error) {
            console.error('用戶檢入失敗:', error);
            return false;
        }
    }

    // 報告威脅
    reportThreat(threat) {
        threat.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        threat.timestamp = Date.now();
        
        this.threatHistory.push(threat);
        
        // 保持最近100條威脅記錄
        if (this.threatHistory.length > 100) {
            this.threatHistory.shift();
        }

        console.warn('威脅檢測:', threat);

        // 觸發威脅事件
        this.emit('threat_detected', threat);

        // 發送到服務器
        if (wsManager.isConnected) {
            wsManager.reportThreat(threat);
        }

        // 根據威脅級別執行相應操作
        this.handleThreatLevel(threat);
    }

    // 處理威脅級別
    async handleThreatLevel(threat) {
        switch (threat.level) {
            case 1:
                // 低級威脅 - 記錄
                break;
            case 2:
                // 中級威脅 - 警告用戶
                this.emit('threat_warning', threat);
                break;
            case 3:
                // 高級威脅 - 強制警告
                this.emit('high_threat_warning', threat);
                break;
            case 4:
                // 極高威脅 - 觸發應急措施
                this.emit('emergency_threat', threat);
                await this.triggerEmergencyProtocol(threat);
                break;
        }
    }

    // 觸發應急協議
    async triggerEmergencyProtocol(threat) {
        console.error('觸發應急協議:', threat);
        
        // 可以在這裡實現自動銷毀邏輯
        // 例如：清除敏感數據、顯示假數據等
        
        this.emit('emergency_protocol_triggered', threat);
    }

    // 獲取威脅歷史
    getThreatHistory(limit = 50) {
        return this.threatHistory.slice(-limit);
    }

    // 獲取威脅統計
    getThreatStats() {
        const stats = {
            total: this.threatHistory.length,
            byType: {},
            byLevel: {},
            recent24h: 0
        };

        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        for (const threat of this.threatHistory) {
            // 按類型統計
            stats.byType[threat.type] = (stats.byType[threat.type] || 0) + 1;
            
            // 按級別統計
            stats.byLevel[threat.level] = (stats.byLevel[threat.level] || 0) + 1;
            
            // 最近24小時
            if (threat.timestamp > oneDayAgo) {
                stats.recent24h++;
            }
        }

        return stats;
    }

    // 更新檢測規則
    async updateDetectionRules(newRules) {
        this.detectionRules = { ...this.detectionRules, ...newRules };
        await this.saveUserProfile();
    }

    // 啟用/禁用威脅檢測
    setEnabled(enabled) {
        this.isEnabled = enabled;
        
        if (enabled) {
            this.startMonitoring();
        } else {
            this.stopMonitoring();
        }
    }

    // 事件發射器
    emit(event, data) {
        // 這裡可以集成到全局事件系統
        const customEvent = new CustomEvent(`threat_${event}`, { detail: data });
        document.dispatchEvent(customEvent);
    }

    // 清理威脅檢測器
    cleanup() {
        this.stopMonitoring();
        this.threatHistory = [];
        this.userProfile = {
            typingPattern: null,
            normalLocations: [],
            usageHours: [],
            networkFingerprint: null
        };
    }
}

// 創建全局實例
window.threatDetector = new ThreatDetector();

