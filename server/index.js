const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 中間件配置
app.use(helmet());
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());

// PostgreSQL 連接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/securechat',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT 密鑰
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 用戶認證中間件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API 路由

// 用戶註冊
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // 檢查用戶是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用戶名或郵箱已存在' });
    }
    
    // 加密密碼
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // 創建用戶
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, username, email',
      [username, hashedPassword, email]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('註冊錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 用戶登錄
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查找用戶
    const result = await pool.query(
      'SELECT id, username, password_hash, email FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }
    
    const user = result.rows[0];
    
    // 驗證密碼
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }
    
    // 生成 JWT
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    console.error('登錄錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 獲取對話列表
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.type, c.created_at, 
              m.content as last_message, m.created_at as last_message_time
       FROM conversations c
       LEFT JOIN messages m ON m.id = (
         SELECT id FROM messages 
         WHERE conversation_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1
       )
       WHERE c.id IN (
         SELECT conversation_id FROM conversation_participants 
         WHERE user_id = $1
       )
       ORDER BY COALESCE(m.created_at, c.created_at) DESC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('獲取對話列表錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 獲取對話消息
app.get('/api/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    // 檢查用戶是否有權限訪問此對話
    const participantCheck = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.user.userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: '無權限訪問此對話' });
    }
    
    const result = await pool.query(
      `SELECT m.id, m.content, m.created_at, u.username as sender_username
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('獲取消息錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// 創建新對話
app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { name, participants } = req.body;
    
    // 創建對話
    const conversationResult = await pool.query(
      'INSERT INTO conversations (name, type, created_at) VALUES ($1, $2, NOW()) RETURNING id',
      [name, participants.length > 2 ? 'group' : 'direct']
    );
    
    const conversationId = conversationResult.rows[0].id;
    
    // 添加參與者（包括創建者）
    const allParticipants = [...participants, req.user.userId];
    for (const userId of allParticipants) {
      await pool.query(
        'INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [conversationId, userId]
      );
    }
    
    res.json({ id: conversationId, name, type: participants.length > 2 ? 'group' : 'direct' });
  } catch (error) {
    console.error('創建對話錯誤:', error);
    res.status(500).json({ error: '服務器錯誤' });
  }
});

// Socket.IO 連接處理
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`用戶 ${socket.user.username} 已連接`);
  
  // 加入用戶房間
  socket.join(`user_${socket.user.userId}`);
  
  // 處理加入對話房間
  socket.on('join_conversation', async (conversationId) => {
    try {
      // 檢查用戶是否有權限加入此對話
      const participantCheck = await pool.query(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, socket.user.userId]
      );
      
      if (participantCheck.rows.length > 0) {
        socket.join(`conversation_${conversationId}`);
        console.log(`用戶 ${socket.user.username} 加入對話 ${conversationId}`);
      }
    } catch (error) {
      console.error('加入對話錯誤:', error);
    }
  });
  
  // 處理發送消息
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, content, encrypted } = data;
      
      // 檢查用戶是否有權限發送消息到此對話
      const participantCheck = await pool.query(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, socket.user.userId]
      );
      
      if (participantCheck.rows.length === 0) {
        return socket.emit('error', { message: '無權限發送消息到此對話' });
      }
      
      // 保存消息到資料庫
      const result = await pool.query(
        'INSERT INTO messages (conversation_id, sender_id, content, encrypted, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, created_at',
        [conversationId, socket.user.userId, content, encrypted || false]
      );
      
      const message = {
        id: result.rows[0].id,
        conversationId,
        senderId: socket.user.userId,
        senderUsername: socket.user.username,
        content,
        encrypted,
        createdAt: result.rows[0].created_at
      };
      
      // 廣播消息到對話房間
      io.to(`conversation_${conversationId}`).emit('new_message', message);
      
    } catch (error) {
      console.error('發送消息錯誤:', error);
      socket.emit('error', { message: '發送消息失敗' });
    }
  });
  
  // 處理威脅檢測事件
  socket.on('threat_detected', async (data) => {
    try {
      const { type, level, details } = data;
      
      // 記錄威脅日誌
      await pool.query(
        'INSERT INTO threat_logs (user_id, threat_type, threat_level, details, detected_at) VALUES ($1, $2, $3, $4, NOW())',
        [socket.user.userId, type, level, JSON.stringify(details)]
      );
      
      console.log(`威脅檢測: 用戶 ${socket.user.username}, 類型: ${type}, 級別: ${level}`);
      
      // 根據威脅級別執行相應操作
      if (level >= 3) {
        // 高級威脅，通知用戶並準備應急措施
        socket.emit('high_threat_warning', { type, level, details });
      }
      
    } catch (error) {
      console.error('威脅檢測處理錯誤:', error);
    }
  });
  
  // 處理應急銷毀請求
  socket.on('emergency_destroy', async (data) => {
    try {
      const { level, password } = data;
      
      // 這裡應該驗證應急密碼
      // 根據級別執行不同的銷毀操作
      
      console.log(`應急銷毀請求: 用戶 ${socket.user.username}, 級別: ${level}`);
      
      // 記錄銷毀事件
      await pool.query(
        'INSERT INTO threat_logs (user_id, threat_type, threat_level, details, detected_at) VALUES ($1, $2, $3, $4, NOW())',
        [socket.user.userId, 'emergency_destroy', level, JSON.stringify({ triggered_by_user: true })]
      );
      
      socket.emit('destroy_confirmed', { level });
      
    } catch (error) {
      console.error('應急銷毀處理錯誤:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`用戶 ${socket.user.username} 已斷開連接`);
  });
});

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`安全聊天服務器運行在端口 ${PORT}`);
});

module.exports = app;

