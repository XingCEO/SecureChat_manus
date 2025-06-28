# SecureChat 部署配置

## 環境變數配置

### 生產環境
```bash
# 服務器配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 資料庫配置 (Supabase)
DATABASE_URL=postgresql://username:password@db.supabase.co:5432/postgres
DB_SSL=true

# JWT配置
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h

# 加密配置
ENCRYPTION_KEY=your-32-character-encryption-key
SALT_ROUNDS=12

# WebSocket配置
WS_PORT=3001
WS_CORS_ORIGIN=https://your-domain.com

# 文件上傳配置
MAX_FILE_SIZE=10485760
UPLOAD_PATH=/tmp/uploads

# 郵件配置 (可選)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 推送通知配置
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@gmail.com

# 安全配置
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### 開發環境
```bash
NODE_ENV=development
PORT=3000
HOST=localhost
DATABASE_URL=postgresql://localhost:5432/securechat_dev
JWT_SECRET=dev-secret-key
ENCRYPTION_KEY=dev-encryption-key-32-characters
WS_PORT=3001
WS_CORS_ORIGIN=http://localhost:3000
```

## 部署平台配置

### Netlify (前端)
```toml
# netlify.toml
[build]
  publish = "src/web"
  command = "echo 'Static site ready'"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self' data:;"

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.onrender.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Render (後端)
```yaml
# render.yaml
services:
  - type: web
    name: securechat-api
    env: node
    plan: free
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        fromDatabase:
          name: securechat-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: ENCRYPTION_KEY
        generateValue: true

databases:
  - name: securechat-db
    plan: free
    databaseName: securechat
    user: securechat_user
```

### Supabase (資料庫)
```sql
-- 在 Supabase SQL 編輯器中執行
-- 創建資料庫表
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用戶表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    secondary_password_hash VARCHAR(255),
    public_key TEXT,
    private_key_encrypted TEXT,
    threat_profile JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- 設備表
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(100),
    device_type VARCHAR(50),
    fingerprint TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_trusted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 對話表
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    type VARCHAR(50) DEFAULT 'private',
    participants UUID[] NOT NULL,
    encryption_key_encrypted TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    content_encrypted TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false
);

-- 威脅日誌表
CREATE TABLE threat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    threat_type VARCHAR(100) NOT NULL,
    threat_level INTEGER NOT NULL,
    details JSONB NOT NULL,
    location_data JSONB,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 偽裝數據表
CREATE TABLE decoy_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    data_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    scenario VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 創建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_conversations_participants ON conversations USING GIN(participants);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_threat_logs_user_id ON threat_logs(user_id);
CREATE INDEX idx_threat_logs_created_at ON threat_logs(created_at);

-- 啟用 RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE decoy_data ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
```

## Docker 配置

### Dockerfile
```dockerfile
# 多階段構建
FROM node:18-alpine AS builder

WORKDIR /app

# 複製 package.json
COPY package*.json ./
COPY server/package*.json ./server/

# 安裝依賴
RUN npm ci --only=production
RUN cd server && npm ci --only=production

# 複製源代碼
COPY . .

# 構建應用
RUN npm run build

# 生產階段
FROM node:18-alpine AS production

WORKDIR /app

# 創建非 root 用戶
RUN addgroup -g 1001 -S nodejs
RUN adduser -S securechat -u 1001

# 複製構建產物
COPY --from=builder --chown=securechat:nodejs /app/dist ./dist
COPY --from=builder --chown=securechat:nodejs /app/server ./server
COPY --from=builder --chown=securechat:nodejs /app/package*.json ./

# 安裝生產依賴
RUN npm ci --only=production && npm cache clean --force

# 切換到非 root 用戶
USER securechat

# 暴露端口
EXPOSE 3000

# 健康檢查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node server/health-check.js

# 啟動應用
CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    networks:
      - securechat-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=securechat
      - POSTGRES_USER=securechat
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/database.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - securechat-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - securechat-network

volumes:
  postgres_data:
  redis_data:

networks:
  securechat-network:
    driver: bridge
```

## 部署檢查清單

### 部署前檢查
- [ ] 所有環境變數已配置
- [ ] 資料庫連接測試通過
- [ ] SSL 證書已配置
- [ ] 域名 DNS 已設置
- [ ] 防火牆規則已配置
- [ ] 備份策略已制定

### 安全檢查
- [ ] 所有密鑰已更新為生產環境密鑰
- [ ] CORS 設置正確
- [ ] 速率限制已啟用
- [ ] 日誌記錄已配置
- [ ] 監控系統已設置
- [ ] 錯誤追蹤已啟用

### 性能檢查
- [ ] 靜態資源已壓縮
- [ ] CDN 已配置
- [ ] 緩存策略已實施
- [ ] 資料庫索引已優化
- [ ] 負載測試已完成

