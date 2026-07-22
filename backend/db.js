const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    section      TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'text')),
    filename     TEXT NOT NULL DEFAULT '',
    url          TEXT NOT NULL DEFAULT '',
    tags         TEXT NOT NULL DEFAULT '',
    text_content TEXT NOT NULL DEFAULT '',
    uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_section ON media(section);

CREATE TABLE IF NOT EXISTS likes (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, media_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_media ON comments(media_id);
`);

// Миграция для баз, созданных до появления тегов
let mediaCols = db.prepare('PRAGMA table_info(media)').all();
if (!mediaCols.some(c => c.name === 'tags')) {
    db.exec("ALTER TABLE media ADD COLUMN tags TEXT NOT NULL DEFAULT ''");
    console.log('[db] migrated: added media.tags column');
    mediaCols = db.prepare('PRAGMA table_info(media)').all();
}

// Миграция для текстовых постов: старый CHECK(type IN photo/video/audio) не пускает
// type='text', а SQLite не умеет менять CHECK через ALTER TABLE — пересобираем таблицу
// (сохраняя данные и внешние ключи) один раз, по отсутствию колонки text_content.
if (!mediaCols.some(c => c.name === 'text_content')) {
    db.pragma('foreign_keys = OFF');
    db.exec('BEGIN');
    try {
        db.exec(`
            CREATE TABLE media_new (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT NOT NULL,
                description  TEXT NOT NULL DEFAULT '',
                section      TEXT NOT NULL,
                type         TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'text')),
                filename     TEXT NOT NULL DEFAULT '',
                url          TEXT NOT NULL DEFAULT '',
                tags         TEXT NOT NULL DEFAULT '',
                text_content TEXT NOT NULL DEFAULT '',
                uploaded_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO media_new (id, title, description, section, type, filename, url, tags, uploaded_by, created_at)
                SELECT id, title, description, section, type, filename, url, tags, uploaded_by, created_at FROM media;
            DROP TABLE media;
            ALTER TABLE media_new RENAME TO media;
            CREATE INDEX IF NOT EXISTS idx_media_section ON media(section);
        `);
        db.exec('COMMIT');
        console.log('[db] migrated: rebuilt media table with text_content + text type');
    } catch (e) {
        db.exec('ROLLBACK');
        db.pragma('foreign_keys = ON');
        throw e;
    }
    db.pragma('foreign_keys = ON');
}

function seedAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@433lab.local';
    const password = process.env.ADMIN_PASSWORD || 'admin433';
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!existing) {
        db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
            .run('Admin', email, bcrypt.hashSync(password, 10), 'admin');
        console.log(`[db] seeded admin account: ${email}`);
    }
}
seedAdmin();

module.exports = db;
