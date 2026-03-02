-- Migration 023: Ticket Participants Table
-- 工单参与者表 - P2协作机制核心
-- 参考: Service PRD P2 Section 3 (Collaboration & Timeline)

-- ============================================================
-- 1. ticket_participants 表
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- 参与者角色
    role TEXT DEFAULT 'mentioned' CHECK(role IN ('owner', 'assignee', 'mentioned', 'follower')),
    -- owner: 工单创建者
    -- assignee: 当前处理人
    -- mentioned: 被@提及加入
    -- follower: 手动邀请(静默关注)
    
    -- 加入方式
    added_by INTEGER,           -- 邀请人ID (系统自动时为空)
    join_method TEXT DEFAULT 'mention' CHECK(join_method IN ('mention', 'invite', 'auto')),
    -- mention: 通过@提及加入
    -- invite: 手动邀请(静默邀请)
    -- auto: 系统自动(创建者/处理人)
    
    -- 通知偏好
    notify_level TEXT DEFAULT 'all' CHECK(notify_level IN ('all', 'mentions_only', 'none')),
    
    -- 时间戳
    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at TEXT,
    
    UNIQUE(ticket_id, user_id),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (added_by) REFERENCES users(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_participants_ticket ON ticket_participants(ticket_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON ticket_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_role ON ticket_participants(role);

-- ============================================================
-- 2. 用户@提及频率统计 (用于排序)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_mention_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,           -- 发起@的用户
    mentioned_user_id INTEGER NOT NULL, -- 被@的用户
    mention_count INTEGER DEFAULT 1,    -- 累计次数
    last_mention_at TEXT,               -- 最后一次@时间
    
    UNIQUE(user_id, mentioned_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_mention_stats_user ON user_mention_stats(user_id, mention_count DESC);

-- ============================================================
-- 3. 用户邀请频率统计 (用于选择成员下拉框记忆)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_invite_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,           -- 发起邀请的用户
    invited_user_id INTEGER NOT NULL,   -- 被邀请的用户
    invite_count INTEGER DEFAULT 1,     -- 累计次数
    last_invite_at TEXT,                -- 最后一次邀请时间
    
    UNIQUE(user_id, invited_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (invited_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invite_stats_user ON user_invite_stats(user_id, invite_count DESC);
