-- 安全聊天系統資料庫架構

-- 用戶表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- 用戶設備表
CREATE TABLE IF NOT EXISTS user_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(100),
    device_type VARCHAR(50), -- 'web', 'desktop', 'mobile'
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_trusted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 對話表
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(20) DEFAULT 'direct', -- 'direct', 'group'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 對話參與者表
CREATE TABLE IF NOT EXISTS conversation_participants (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
    UNIQUE(conversation_id, user_id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT false,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 威脅日誌表
CREATE TABLE IF NOT EXISTS threat_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    threat_type VARCHAR(50) NOT NULL, -- 'location', 'time', 'behavior', 'network', 'emergency_destroy'
    threat_level INTEGER NOT NULL, -- 1-4
    details JSONB,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    action_taken VARCHAR(100)
);

-- 偽裝數據表
CREATE TABLE IF NOT EXISTS decoy_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL, -- 'conversation', 'message', 'contact'
    fake_content JSONB NOT NULL,
    scenario VARCHAR(50), -- 'work', 'personal', 'study'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用戶設置表
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    threat_detection_enabled BOOLEAN DEFAULT true,
    auto_destroy_hours INTEGER DEFAULT 24,
    disguise_mode VARCHAR(20) DEFAULT 'normal', -- 'normal', 'calculator', 'notes'
    emergency_contacts TEXT[], -- 緊急聯絡人列表
    settings_data JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 會話密鑰表（用於端到端加密）
CREATE TABLE IF NOT EXISTS session_keys (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    key_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(conversation_id, user_id, key_version)
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_threat_logs_user_id ON threat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_threat_logs_detected_at ON threat_logs(detected_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);

-- 插入一些測試用的偽裝數據
INSERT INTO decoy_data (user_id, data_type, fake_content, scenario) VALUES
(1, 'conversation', '{"name": "工作群組", "messages": ["今天的會議改到下午3點", "記得準備月報", "週五有團建活動"]}', 'work'),
(1, 'conversation', '{"name": "家人群", "messages": ["晚餐吃什麼？", "媽媽做的湯很好喝", "週末回家吃飯"]}', 'personal'),
(1, 'conversation', '{"name": "學習小組", "messages": ["明天考試加油", "筆記已經整理好了", "圖書館見面討論"]}', 'study');

-- 創建觸發器以自動更新 updated_at 欄位
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

