// 計算器功能模組
class CalculatorUI {
    constructor() {
        this.display = null;
        this.expression = null;
        this.result = null;
        this.currentInput = '0';
        this.previousInput = '';
        this.operator = null;
        this.waitingForOperand = false;
        this.history = [];
        this.isScientificMode = false;
        this.memory = 0;
        this.lastResult = 0;
        this.hiddenSequence = '';
        this.hiddenTrigger = '123456'; // 隱藏入口密碼
    }

    // 初始化計算器
    initialize() {
        try {
            this.setupElements();
            this.setupEventListeners();
            this.loadHistory();
            this.updateDisplay();
            
            console.log('計算器初始化成功');
            return true;
        } catch (error) {
            console.error('計算器初始化失敗:', error);
            return false;
        }
    }

    // 設置DOM元素
    setupElements() {
        this.display = document.getElementById('calc-result');
        this.expression = document.getElementById('calc-expression');
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.scientificPanel = document.getElementById('scientific-panel');
        this.passwordModal = document.getElementById('password-modal');
        this.hiddenPasswordInput = document.getElementById('hidden-password');
        this.entranceHint = document.getElementById('entrance-hint');
        this.loadingOverlay = document.getElementById('loading-overlay');
    }

    // 設置事件監聽器
    setupEventListeners() {
        // 數字按鈕
        document.querySelectorAll('.calc-btn.number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const number = e.target.dataset.number;
                if (number !== undefined) {
                    this.inputNumber(number);
                    this.checkHiddenSequence(number);
                }
            });
        });

        // 運算符按鈕
        document.querySelectorAll('.calc-btn.operator').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.inputOperator(action);
            });
        });

        // 功能按鈕
        document.querySelectorAll('.calc-btn.function').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.executeFunction(action);
            });
        });

        // 等號按鈕（支持長按）
        const equalsBtn = document.querySelector('.calc-btn.equals');
        let longPressTimer = null;
        
        equalsBtn.addEventListener('mousedown', () => {
            longPressTimer = setTimeout(() => {
                this.showHiddenEntrance();
            }, 3000);
        });
        
        equalsBtn.addEventListener('mouseup', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
        
        equalsBtn.addEventListener('click', () => {
            this.calculate();
        });

        // 小數點按鈕
        document.querySelector('[data-action="decimal"]').addEventListener('click', () => {
            this.inputDecimal();
        });

        // 歷史記錄按鈕
        document.getElementById('history-btn').addEventListener('click', () => {
            this.toggleHistory();
        });

        // 清除歷史記錄
        document.getElementById('clear-history').addEventListener('click', () => {
            this.clearHistory();
        });

        // 設置按鈕
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.toggleScientific();
        });

        // 密碼對話框
        document.getElementById('confirm-password').addEventListener('click', () => {
            this.verifyHiddenPassword();
        });

        document.getElementById('cancel-password').addEventListener('click', () => {
            this.hidePasswordModal();
        });

        // 鍵盤支持
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // 歷史記錄項目點擊
        this.historyList.addEventListener('click', (e) => {
            const historyItem = e.target.closest('.history-item');
            if (historyItem) {
                const result = historyItem.querySelector('.history-result').textContent;
                this.currentInput = result;
                this.updateDisplay();
                this.toggleHistory();
            }
        });

        // 偽裝模式切換
        document.querySelectorAll('.disguise-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchDisguiseMode(mode);
            });
        });
    }

    // 輸入數字
    inputNumber(number) {
        if (this.waitingForOperand) {
            this.currentInput = number;
            this.waitingForOperand = false;
        } else {
            this.currentInput = this.currentInput === '0' ? number : this.currentInput + number;
        }
        this.updateDisplay();
    }

    // 輸入運算符
    inputOperator(operator) {
        const inputValue = parseFloat(this.currentInput);

        if (this.previousInput === '') {
            this.previousInput = inputValue;
        } else if (this.operator) {
            const currentValue = this.previousInput || 0;
            const newValue = this.performCalculation(currentValue, inputValue, this.operator);

            this.currentInput = String(newValue);
            this.previousInput = newValue;
        }

        this.waitingForOperand = true;
        this.operator = operator;
        this.updateExpression();
        this.updateDisplay();
    }

    // 輸入小數點
    inputDecimal() {
        if (this.waitingForOperand) {
            this.currentInput = '0.';
            this.waitingForOperand = false;
        } else if (this.currentInput.indexOf('.') === -1) {
            this.currentInput += '.';
        }
        this.updateDisplay();
    }

    // 執行計算
    calculate() {
        const inputValue = parseFloat(this.currentInput);

        if (this.previousInput !== '' && this.operator) {
            const currentValue = this.previousInput || 0;
            const newValue = this.performCalculation(currentValue, inputValue, this.operator);

            // 添加到歷史記錄
            this.addToHistory(
                `${currentValue} ${this.getOperatorSymbol(this.operator)} ${inputValue}`,
                newValue
            );

            this.currentInput = String(newValue);
            this.lastResult = newValue;
            this.previousInput = '';
            this.operator = null;
            this.waitingForOperand = true;
        }

        this.updateExpression();
        this.updateDisplay();
    }

    // 執行具體計算
    performCalculation(firstOperand, secondOperand, operator) {
        try {
            switch (operator) {
                case 'add':
                    return firstOperand + secondOperand;
                case 'subtract':
                    return firstOperand - secondOperand;
                case 'multiply':
                    return firstOperand * secondOperand;
                case 'divide':
                    if (secondOperand === 0) {
                        throw new Error('除數不能為零');
                    }
                    return firstOperand / secondOperand;
                default:
                    return secondOperand;
            }
        } catch (error) {
            this.showError(error.message);
            return 0;
        }
    }

    // 執行功能操作
    executeFunction(action) {
        const inputValue = parseFloat(this.currentInput);

        try {
            switch (action) {
                case 'clear':
                    this.clear();
                    break;
                case 'clear-entry':
                    this.clearEntry();
                    break;
                case 'backspace':
                    this.backspace();
                    break;
                case 'percent':
                    this.currentInput = String(inputValue / 100);
                    break;
                case 'sqrt':
                    if (inputValue < 0) {
                        throw new Error('負數不能開平方根');
                    }
                    this.currentInput = String(Math.sqrt(inputValue));
                    break;
                case 'power':
                    this.currentInput = String(Math.pow(inputValue, 2));
                    break;
                case 'factorial':
                    this.currentInput = String(this.factorial(inputValue));
                    break;
                case 'sin':
                    this.currentInput = String(Math.sin(this.toRadians(inputValue)));
                    break;
                case 'cos':
                    this.currentInput = String(Math.cos(this.toRadians(inputValue)));
                    break;
                case 'tan':
                    this.currentInput = String(Math.tan(this.toRadians(inputValue)));
                    break;
                case 'log':
                    if (inputValue <= 0) {
                        throw new Error('對數的真數必須大於零');
                    }
                    this.currentInput = String(Math.log10(inputValue));
                    break;
                case 'ln':
                    if (inputValue <= 0) {
                        throw new Error('自然對數的真數必須大於零');
                    }
                    this.currentInput = String(Math.log(inputValue));
                    break;
                case 'pi':
                    this.currentInput = String(Math.PI);
                    break;
                case 'e':
                    this.currentInput = String(Math.E);
                    break;
                default:
                    console.warn('未知的功能操作:', action);
            }
            
            this.updateDisplay();
        } catch (error) {
            this.showError(error.message);
        }
    }

    // 清除所有
    clear() {
        this.currentInput = '0';
        this.previousInput = '';
        this.operator = null;
        this.waitingForOperand = false;
        this.updateExpression();
        this.updateDisplay();
    }

    // 清除當前輸入
    clearEntry() {
        this.currentInput = '0';
        this.updateDisplay();
    }

    // 退格
    backspace() {
        if (this.currentInput.length > 1) {
            this.currentInput = this.currentInput.slice(0, -1);
        } else {
            this.currentInput = '0';
        }
        this.updateDisplay();
    }

    // 計算階乘
    factorial(n) {
        if (n < 0 || !Number.isInteger(n)) {
            throw new Error('階乘只能計算非負整數');
        }
        if (n > 170) {
            throw new Error('數字太大，無法計算階乘');
        }
        
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    // 角度轉弧度
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // 更新顯示
    updateDisplay() {
        if (this.display) {
            // 格式化數字顯示
            const formattedNumber = this.formatNumber(this.currentInput);
            this.display.textContent = formattedNumber;
        }
    }

    // 更新表達式顯示
    updateExpression() {
        if (this.expression) {
            if (this.previousInput && this.operator) {
                const operatorSymbol = this.getOperatorSymbol(this.operator);
                this.expression.textContent = `${this.formatNumber(this.previousInput)} ${operatorSymbol}`;
            } else {
                this.expression.textContent = '';
            }
        }
    }

    // 格式化數字
    formatNumber(number) {
        const num = parseFloat(number);
        if (isNaN(num)) return '0';
        
        // 處理非常大或非常小的數字
        if (Math.abs(num) > 1e15 || (Math.abs(num) < 1e-6 && num !== 0)) {
            return num.toExponential(6);
        }
        
        // 限制小數位數
        if (num % 1 !== 0) {
            return parseFloat(num.toFixed(10)).toString();
        }
        
        return num.toString();
    }

    // 獲取運算符符號
    getOperatorSymbol(operator) {
        const symbols = {
            'add': '+',
            'subtract': '−',
            'multiply': '×',
            'divide': '÷'
        };
        return symbols[operator] || operator;
    }

    // 顯示錯誤
    showError(message) {
        this.display.textContent = '錯誤';
        this.display.parentElement.classList.add('error');
        
        setTimeout(() => {
            this.display.parentElement.classList.remove('error');
            this.clear();
        }, 2000);
        
        console.error('計算錯誤:', message);
    }

    // 添加到歷史記錄
    addToHistory(expression, result) {
        const historyItem = {
            expression: expression,
            result: this.formatNumber(result),
            timestamp: Date.now()
        };
        
        this.history.unshift(historyItem);
        
        // 限制歷史記錄數量
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
        
        this.saveHistory();
        this.renderHistory();
    }

    // 渲染歷史記錄
    renderHistory() {
        if (!this.historyList) return;
        
        this.historyList.innerHTML = '';
        
        this.history.forEach(item => {
            const historyElement = document.createElement('div');
            historyElement.className = 'history-item';
            historyElement.innerHTML = `
                <div class="history-expression">${item.expression}</div>
                <div class="history-result">${item.result}</div>
                <div class="history-time">${new Date(item.timestamp).toLocaleString('zh-TW')}</div>
            `;
            this.historyList.appendChild(historyElement);
        });
    }

    // 切換歷史記錄面板
    toggleHistory() {
        if (this.historyPanel) {
            this.historyPanel.classList.toggle('active');
        }
    }

    // 清除歷史記錄
    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
    }

    // 保存歷史記錄
    saveHistory() {
        try {
            localStorage.setItem('calc_history', JSON.stringify(this.history));
        } catch (error) {
            console.warn('保存歷史記錄失敗:', error);
        }
    }

    // 加載歷史記錄
    loadHistory() {
        try {
            const saved = localStorage.getItem('calc_history');
            if (saved) {
                this.history = JSON.parse(saved);
                this.renderHistory();
            }
        } catch (error) {
            console.warn('加載歷史記錄失敗:', error);
            this.history = [];
        }
    }

    // 切換科學計算器模式
    toggleScientific() {
        this.isScientificMode = !this.isScientificMode;
        if (this.scientificPanel) {
            this.scientificPanel.classList.toggle('active', this.isScientificMode);
        }
    }

    // 鍵盤支持
    handleKeyboard(event) {
        const key = event.key;
        
        // 防止默認行為
        if (/[0-9+\-*/.=]/.test(key) || key === 'Enter' || key === 'Backspace' || key === 'Escape') {
            event.preventDefault();
        }
        
        if (/[0-9]/.test(key)) {
            this.inputNumber(key);
            this.checkHiddenSequence(key);
        } else if (key === '+') {
            this.inputOperator('add');
        } else if (key === '-') {
            this.inputOperator('subtract');
        } else if (key === '*') {
            this.inputOperator('multiply');
        } else if (key === '/') {
            this.inputOperator('divide');
        } else if (key === '.' || key === ',') {
            this.inputDecimal();
        } else if (key === '=' || key === 'Enter') {
            this.calculate();
        } else if (key === 'Backspace') {
            this.backspace();
        } else if (key === 'Escape') {
            this.clear();
        }
    }

    // 檢查隱藏序列
    checkHiddenSequence(digit) {
        this.hiddenSequence += digit;
        
        // 保持序列長度
        if (this.hiddenSequence.length > this.hiddenTrigger.length) {
            this.hiddenSequence = this.hiddenSequence.slice(-this.hiddenTrigger.length);
        }
        
        // 檢查是否匹配
        if (this.hiddenSequence === this.hiddenTrigger) {
            this.showHiddenEntrance();
            this.hiddenSequence = '';
        }
    }

    // 顯示隱藏入口
    showHiddenEntrance() {
        if (this.entranceHint) {
            this.entranceHint.classList.add('show');
            setTimeout(() => {
                this.entranceHint.classList.remove('show');
            }, 3000);
        }
        
        // 顯示密碼輸入對話框
        this.showPasswordModal();
    }

    // 顯示密碼對話框
    showPasswordModal() {
        if (this.passwordModal) {
            this.passwordModal.classList.add('active');
            this.hiddenPasswordInput.focus();
        }
    }

    // 隱藏密碼對話框
    hidePasswordModal() {
        if (this.passwordModal) {
            this.passwordModal.classList.remove('active');
            this.hiddenPasswordInput.value = '';
        }
    }

    // 驗證隱藏密碼
    async verifyHiddenPassword() {
        const password = this.hiddenPasswordInput.value;
        
        if (!password) {
            return;
        }
        
        this.showLoading();
        
        try {
            // 檢查是否為脅迫密碼
            const isCoercion = await emergencyManager.detectCoercionPassword(password);
            if (isCoercion) {
                this.hideLoading();
                this.hidePasswordModal();
                return;
            }
            
            // 驗證正常密碼
            const isValid = await authManager.verifyPrimaryPassword(password) || 
                           await authManager.verifySecondaryPassword(password);
            
            if (isValid) {
                // 密碼正確，切換到聊天界面
                this.hideLoading();
                this.hidePasswordModal();
                window.location.href = 'index.html';
            } else {
                // 密碼錯誤
                this.hideLoading();
                this.showError('密碼錯誤');
                this.hiddenPasswordInput.value = '';
            }
        } catch (error) {
            console.error('密碼驗證失敗:', error);
            this.hideLoading();
            this.showError('驗證失敗');
        }
    }

    // 顯示加載狀態
    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('active');
        }
    }

    // 隱藏加載狀態
    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.remove('active');
        }
    }

    // 切換偽裝模式
    switchDisguiseMode(mode) {
        // 更新按鈕狀態
        document.querySelectorAll('.disguise-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // 執行模式切換
        switch (mode) {
            case 'normal':
                window.location.href = 'index.html';
                break;
            case 'calculator':
                // 當前就是計算器模式
                break;
            case 'notes':
                window.location.href = 'notes.html';
                break;
        }
    }

    // 獲取計算器狀態
    getCalculatorState() {
        return {
            currentInput: this.currentInput,
            previousInput: this.previousInput,
            operator: this.operator,
            waitingForOperand: this.waitingForOperand,
            isScientificMode: this.isScientificMode,
            historyCount: this.history.length
        };
    }
}

// 創建全局實例
window.calculatorUI = new CalculatorUI();

