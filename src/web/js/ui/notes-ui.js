// 筆記本功能模組
class NotesUI {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.isEditing = false;
        this.searchQuery = '';
        this.sortBy = 'modified'; // 'modified', 'created', 'title'
        this.viewMode = 'list'; // 'list', 'grid'
        this.selectedNotes = new Set();
        this.isInitialized = false;
        this.hiddenSequence = '';
        this.hiddenTrigger = 'secure123'; // 隱藏入口密碼
    }

    // 初始化筆記本
    async initialize() {
        try {
            this.setupElements();
            this.setupEventListeners();
            await this.loadNotes();
            this.renderNotesList();
            this.updateUI();
            
            this.isInitialized = true;
            console.log('筆記本初始化成功');
            return true;
        } catch (error) {
            console.error('筆記本初始化失敗:', error);
            return false;
        }
    }

    // 設置DOM元素
    setupElements() {
        this.notesList = document.getElementById('notes-list');
        this.noteEditor = document.getElementById('note-editor');
        this.noteTitle = document.getElementById('note-title');
        this.noteContent = document.getElementById('note-content');
        this.searchInput = document.getElementById('search-input');
        this.sortSelect = document.getElementById('sort-select');
        this.viewToggle = document.getElementById('view-toggle');
        this.noteCount = document.getElementById('note-count');
        this.passwordModal = document.getElementById('password-modal');
        this.hiddenPasswordInput = document.getElementById('hidden-password');
        this.loadingOverlay = document.getElementById('loading-overlay');
    }

    // 設置事件監聽器
    setupEventListeners() {
        // 新建筆記按鈕
        document.getElementById('new-note-btn').addEventListener('click', () => {
            this.createNewNote();
        });

        // 保存按鈕
        document.getElementById('save-btn').addEventListener('click', () => {
            this.saveCurrentNote();
        });

        // 刪除按鈕
        document.getElementById('delete-btn').addEventListener('click', () => {
            this.deleteCurrentNote();
        });

        // 搜索輸入
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.filterAndRenderNotes();
        });

        // 排序選擇
        this.sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.renderNotesList();
        });

        // 視圖切換
        this.viewToggle.addEventListener('click', () => {
            this.toggleViewMode();
        });

        // 筆記標題輸入
        this.noteTitle.addEventListener('input', () => {
            this.markAsModified();
        });

        // 筆記內容輸入
        this.noteContent.addEventListener('input', () => {
            this.markAsModified();
            this.checkHiddenSequence(this.noteContent.value);
        });

        // 筆記列表點擊
        this.notesList.addEventListener('click', (e) => {
            const noteItem = e.target.closest('.note-item');
            if (noteItem) {
                const noteId = noteItem.dataset.noteId;
                this.selectNote(noteId);
            }
        });

        // 鍵盤快捷鍵
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 密碼對話框
        document.getElementById('confirm-password').addEventListener('click', () => {
            this.verifyHiddenPassword();
        });

        document.getElementById('cancel-password').addEventListener('click', () => {
            this.hidePasswordModal();
        });

        // 自動保存
        setInterval(() => {
            if (this.isEditing && this.currentNote) {
                this.autoSave();
            }
        }, 30000); // 每30秒自動保存
    }

    // 創建新筆記
    createNewNote() {
        const newNote = {
            id: this.generateNoteId(),
            title: '新筆記',
            content: '',
            created: Date.now(),
            modified: Date.now(),
            tags: [],
            category: 'general',
            isPinned: false,
            isEncrypted: false
        };

        this.notes.unshift(newNote);
        this.selectNote(newNote.id);
        this.renderNotesList();
        this.updateUI();

        // 聚焦到標題輸入框
        this.noteTitle.focus();
        this.noteTitle.select();
    }

    // 生成筆記ID
    generateNoteId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // 選擇筆記
    selectNote(noteId) {
        // 保存當前筆記
        if (this.currentNote && this.isEditing) {
            this.saveCurrentNote();
        }

        // 查找並選擇新筆記
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            this.currentNote = note;
            this.loadNoteToEditor(note);
            this.updateNoteSelection();
            this.isEditing = false;
        }
    }

    // 加載筆記到編輯器
    loadNoteToEditor(note) {
        this.noteTitle.value = note.title;
        this.noteContent.value = note.content;
        
        // 更新編輯器狀態
        this.noteEditor.classList.remove('hidden');
        
        // 更新按鈕狀態
        this.updateEditorButtons();
    }

    // 更新筆記選擇狀態
    updateNoteSelection() {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.noteId === this.currentNote?.id);
        });
    }

    // 標記為已修改
    markAsModified() {
        if (this.currentNote) {
            this.isEditing = true;
            this.currentNote.modified = Date.now();
            this.updateEditorButtons();
        }
    }

    // 保存當前筆記
    async saveCurrentNote() {
        if (!this.currentNote) return;

        try {
            // 更新筆記內容
            this.currentNote.title = this.noteTitle.value || '無標題';
            this.currentNote.content = this.noteContent.value;
            this.currentNote.modified = Date.now();

            // 保存到存儲
            await this.saveNotes();
            
            // 更新UI
            this.renderNotesList();
            this.isEditing = false;
            this.updateEditorButtons();

            // 顯示保存成功提示
            this.showToast('筆記已保存');
            
            console.log('筆記保存成功:', this.currentNote.id);
        } catch (error) {
            console.error('保存筆記失敗:', error);
            this.showToast('保存失敗', 'error');
        }
    }

    // 自動保存
    async autoSave() {
        if (this.currentNote && this.isEditing) {
            await this.saveCurrentNote();
            console.log('自動保存完成');
        }
    }

    // 刪除當前筆記
    async deleteCurrentNote() {
        if (!this.currentNote) return;

        if (confirm('確定要刪除這篇筆記嗎？')) {
            try {
                // 從數組中移除
                this.notes = this.notes.filter(n => n.id !== this.currentNote.id);
                
                // 保存更改
                await this.saveNotes();
                
                // 清空編輯器
                this.currentNote = null;
                this.noteEditor.classList.add('hidden');
                
                // 更新UI
                this.renderNotesList();
                this.updateUI();
                
                this.showToast('筆記已刪除');
            } catch (error) {
                console.error('刪除筆記失敗:', error);
                this.showToast('刪除失敗', 'error');
            }
        }
    }

    // 渲染筆記列表
    renderNotesList() {
        if (!this.notesList) return;

        // 過濾和排序筆記
        let filteredNotes = this.filterNotes();
        filteredNotes = this.sortNotes(filteredNotes);

        // 清空列表
        this.notesList.innerHTML = '';

        // 渲染筆記項目
        filteredNotes.forEach(note => {
            const noteElement = this.createNoteElement(note);
            this.notesList.appendChild(noteElement);
        });

        // 更新計數
        this.updateNoteCount(filteredNotes.length);
    }

    // 創建筆記元素
    createNoteElement(note) {
        const noteItem = document.createElement('div');
        noteItem.className = 'note-item';
        noteItem.dataset.noteId = note.id;

        const preview = this.getContentPreview(note.content);
        const modifiedDate = new Date(note.modified).toLocaleDateString('zh-TW');

        noteItem.innerHTML = `
            <div class="note-header">
                <h3 class="note-title">${this.escapeHtml(note.title)}</h3>
                <div class="note-meta">
                    <span class="note-date">${modifiedDate}</span>
                    ${note.isPinned ? '<span class="pin-icon">📌</span>' : ''}
                    ${note.isEncrypted ? '<span class="encrypt-icon">🔒</span>' : ''}
                </div>
            </div>
            <div class="note-preview">${this.escapeHtml(preview)}</div>
            <div class="note-tags">
                ${note.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
        `;

        return noteItem;
    }

    // 獲取內容預覽
    getContentPreview(content, maxLength = 100) {
        if (!content) return '無內容';
        return content.length > maxLength ? 
            content.substring(0, maxLength) + '...' : 
            content;
    }

    // 過濾筆記
    filterNotes() {
        if (!this.searchQuery) return this.notes;

        const query = this.searchQuery.toLowerCase();
        return this.notes.filter(note => 
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query) ||
            note.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }

    // 排序筆記
    sortNotes(notes) {
        return notes.sort((a, b) => {
            // 置頂筆記優先
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;

            switch (this.sortBy) {
                case 'created':
                    return b.created - a.created;
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'modified':
                default:
                    return b.modified - a.modified;
            }
        });
    }

    // 過濾並渲染筆記
    filterAndRenderNotes() {
        this.renderNotesList();
    }

    // 切換視圖模式
    toggleViewMode() {
        this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
        this.notesList.classList.toggle('grid-view', this.viewMode === 'grid');
        
        // 更新按鈕圖標
        const icon = this.viewToggle.querySelector('svg');
        if (icon) {
            // 這裡可以更新圖標
        }
    }

    // 更新編輯器按鈕
    updateEditorButtons() {
        const saveBtn = document.getElementById('save-btn');
        const deleteBtn = document.getElementById('delete-btn');
        
        if (saveBtn) {
            saveBtn.disabled = !this.isEditing;
            saveBtn.classList.toggle('modified', this.isEditing);
        }
        
        if (deleteBtn) {
            deleteBtn.disabled = !this.currentNote;
        }
    }

    // 更新UI
    updateUI() {
        // 更新筆記計數
        this.updateNoteCount(this.notes.length);
        
        // 更新編輯器按鈕
        this.updateEditorButtons();
        
        // 如果沒有筆記，顯示空狀態
        if (this.notes.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
        }
    }

    // 更新筆記計數
    updateNoteCount(count) {
        if (this.noteCount) {
            this.noteCount.textContent = `${count} 篇筆記`;
        }
    }

    // 顯示空狀態
    showEmptyState() {
        if (this.notesList) {
            this.notesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>還沒有筆記</h3>
                    <p>點擊「新建筆記」開始記錄您的想法</p>
                </div>
            `;
        }
    }

    // 隱藏空狀態
    hideEmptyState() {
        const emptyState = this.notesList?.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    }

    // 處理鍵盤快捷鍵
    handleKeyboardShortcuts(event) {
        // Ctrl+N: 新建筆記
        if (event.ctrlKey && event.key === 'n') {
            event.preventDefault();
            this.createNewNote();
        }
        
        // Ctrl+S: 保存筆記
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            this.saveCurrentNote();
        }
        
        // Ctrl+F: 搜索
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            this.searchInput.focus();
        }
        
        // Delete: 刪除筆記
        if (event.key === 'Delete' && this.currentNote && !this.isInputFocused()) {
            event.preventDefault();
            this.deleteCurrentNote();
        }
    }

    // 檢查輸入框是否聚焦
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }

    // 檢查隱藏序列
    checkHiddenSequence(content) {
        // 檢查內容中是否包含隱藏觸發詞
        if (content.toLowerCase().includes(this.hiddenTrigger)) {
            this.showHiddenEntrance();
        }
    }

    // 顯示隱藏入口
    showHiddenEntrance() {
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
                this.showToast('密碼錯誤', 'error');
                this.hiddenPasswordInput.value = '';
            }
        } catch (error) {
            console.error('密碼驗證失敗:', error);
            this.hideLoading();
            this.showToast('驗證失敗', 'error');
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

    // 顯示提示消息
    showToast(message, type = 'success') {
        // 創建提示元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加到頁面
        document.body.appendChild(toast);
        
        // 顯示動畫
        setTimeout(() => toast.classList.add('show'), 100);
        
        // 自動隱藏
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 轉義HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 保存筆記到存儲
    async saveNotes() {
        try {
            await secureStorage.setItem('notes_data', this.notes);
            return true;
        } catch (error) {
            console.error('保存筆記失敗:', error);
            throw error;
        }
    }

    // 從存儲加載筆記
    async loadNotes() {
        try {
            const savedNotes = await secureStorage.getItem('notes_data');
            if (savedNotes && Array.isArray(savedNotes)) {
                this.notes = savedNotes;
            } else {
                // 創建示例筆記
                this.notes = this.createSampleNotes();
                await this.saveNotes();
            }
            
            console.log(`加載了 ${this.notes.length} 篇筆記`);
        } catch (error) {
            console.error('加載筆記失敗:', error);
            this.notes = this.createSampleNotes();
        }
    }

    // 創建示例筆記
    createSampleNotes() {
        const now = Date.now();
        return [
            {
                id: 'sample1',
                title: '歡迎使用筆記本',
                content: '這是您的第一篇筆記。您可以在這裡記錄任何想法、計劃或重要信息。\n\n功能特點：\n- 自動保存\n- 搜索功能\n- 標籤分類\n- 安全加密',
                created: now - 86400000,
                modified: now - 86400000,
                tags: ['歡迎', '教程'],
                category: 'general',
                isPinned: true,
                isEncrypted: false
            },
            {
                id: 'sample2',
                title: '工作計劃',
                content: '本週工作安排：\n1. 完成項目報告\n2. 參加團隊會議\n3. 準備演示文稿\n4. 代碼審查',
                created: now - 43200000,
                modified: now - 43200000,
                tags: ['工作', '計劃'],
                category: 'work',
                isPinned: false,
                isEncrypted: false
            }
        ];
    }

    // 獲取筆記本狀態
    getNotesStatus() {
        return {
            totalNotes: this.notes.length,
            currentNote: this.currentNote?.id || null,
            isEditing: this.isEditing,
            searchQuery: this.searchQuery,
            sortBy: this.sortBy,
            viewMode: this.viewMode
        };
    }
}

// 創建全局實例
window.notesUI = new NotesUI();

