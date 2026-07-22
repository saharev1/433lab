const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const db = require('./db');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, 'media');

const PHOTOS_DIR = path.join(MEDIA_DIR, 'Photos');
const VIDEOS_DIR = path.join(MEDIA_DIR, 'Videos');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const app = express();
app.use(express.json());

// Uploaded files are served under /media/* (nginx proxies this path here)
app.use('/media', express.static(MEDIA_DIR));

// ---------- helpers ----------

function signToken(user) {
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function auth(required = true) {
    return (req, res, next) => {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) {
            if (!required) return next();
            return res.status(401).json({ error: 'Требуется авторизация' });
        }
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
            if (!req.user) throw new Error('user gone');
            next();
        } catch (e) {
            if (!required) return next();
            res.status(401).json({ error: 'Недействительный токен' });
        }
    };
}

function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    next();
}

function normalizeTags(raw) {
    return String(raw || '')
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean)
        .join(',');
}

function mediaTypeOf(mimetype) {
    if (mimetype.startsWith('image/')) return 'photo';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    return null;
}

function mediaWithMeta(row, userId) {
    const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE media_id = ?').get(row.id).c;
    const commentCount = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE media_id = ?').get(row.id).c;
    const likedByMe = userId
        ? !!db.prepare('SELECT 1 FROM likes WHERE media_id = ? AND user_id = ?').get(row.id, userId)
        : false;
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        section: row.section,
        type: row.type,
        url: row.url,
        textContent: row.text_content || '',
        tags: row.tags ? row.tags.split(',') : [],
        createdAt: row.created_at,
        likeCount,
        commentCount,
        likedByMe
    };
}

// ---------- upload ----------

const storage = multer.diskStorage({
    destination(req, file, cb) {
        // Per spec, files live strictly under /media/Photos or /media/Videos
        const type = mediaTypeOf(file.mimetype);
        cb(null, type === 'photo' ? PHOTOS_DIR : VIDEOS_DIR);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase().slice(0, 10) || '';
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (!mediaTypeOf(file.mimetype)) {
            return cb(new Error('Разрешены только фото, видео и аудио'));
        }
        cb(null, true);
    }
});

// ---------- auth routes ----------

app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Укажите имя, почту и пароль' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        return res.status(409).json({ error: 'Пользователь с такой почтой уже существует' });
    }
    const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name.trim(), email.trim(), bcrypt.hashSync(password, 10));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Укажите почту и пароль' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Неверная почта или пароль' });
    }
    res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', auth(), (req, res) => {
    res.json({ user: publicUser(req.user) });
});

// ---------- media routes ----------

app.post('/api/media/upload', auth(), adminOnly, upload.single('file'), (req, res) => {
    const { section, title, description, tags } = req.body || {};
    const textContent = String((req.body || {}).text_content || '').trim();
    if (!section || !title) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Укажите раздел и название' });
    }
    if (!req.file && !textContent) {
        return res.status(400).json({ error: 'Добавьте файл или текст публикации' });
    }
    // type='text' — текстовый пост (с картинкой-обложкой, если приложена);
    // иначе обычное медиа (фото/видео/аудио).
    let type, filename = '', url = '';
    if (req.file) {
        const fileType = mediaTypeOf(req.file.mimetype);
        const subdir = fileType === 'photo' ? 'Photos' : 'Videos';
        filename = req.file.filename;
        url = `/media/${subdir}/${filename}`;
        type = (textContent && fileType === 'photo') ? 'text' : fileType;
    } else {
        type = 'text';
    }
    const info = db.prepare(
        'INSERT INTO media (title, description, section, type, filename, url, tags, text_content, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(title.trim(), (description || '').trim(), section.trim(), type, filename, url, normalizeTags(tags), textContent, req.user.id);
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ media: mediaWithMeta(row, req.user.id) });
});

// Поиск по названию, описанию и тегам (регистронезависимый, в т.ч. кириллица)
app.get('/api/search', auth(false), (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ media: [] });
    const rows = db.prepare('SELECT * FROM media ORDER BY created_at DESC').all();
    const found = rows.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.tags || '').toLowerCase().includes(q));
    res.json({ media: found.map(r => mediaWithMeta(r, req.user ? req.user.id : null)) });
});

app.get('/api/media/:section', auth(false), (req, res) => {
    const rows = db.prepare('SELECT * FROM media WHERE section = ? ORDER BY created_at DESC')
        .all(req.params.section);
    res.json({ media: rows.map(r => mediaWithMeta(r, req.user ? req.user.id : null)) });
});

app.patch('/api/media/:id', auth(), adminOnly, (req, res) => {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено' });
    const { title, description, section, tags, text_content } = req.body || {};
    const newTitle = title !== undefined ? String(title).trim() : row.title;
    if (!newTitle) return res.status(400).json({ error: 'Название не может быть пустым' });
    const newDesc = description !== undefined ? String(description).trim() : row.description;
    const newSection = section !== undefined && String(section).trim() ? String(section).trim() : row.section;
    const newTags = tags !== undefined ? normalizeTags(tags) : row.tags;
    const newText = text_content !== undefined ? String(text_content).trim() : row.text_content;
    db.prepare('UPDATE media SET title = ?, description = ?, section = ?, tags = ?, text_content = ? WHERE id = ?')
        .run(newTitle, newDesc, newSection, newTags, newText, row.id);
    const updated = db.prepare('SELECT * FROM media WHERE id = ?').get(row.id);
    res.json({ media: mediaWithMeta(updated, req.user.id) });
});

app.delete('/api/media/:id', auth(), adminOnly, (req, res) => {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено' });
    db.prepare('DELETE FROM media WHERE id = ?').run(row.id);
    // текстовые посты могут быть без файла; каталог определяем по url
    if (row.filename) {
        const dir = row.url.includes('/Photos/') ? PHOTOS_DIR : VIDEOS_DIR;
        fs.unlink(path.join(dir, row.filename), () => {});
    }
    res.json({ ok: true });
});

// ---------- likes / comments / favorites ----------

app.post('/api/media/:id/like', auth(), (req, res) => {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено' });
    const existing = db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND media_id = ?')
        .get(req.user.id, row.id);
    if (existing) {
        db.prepare('DELETE FROM likes WHERE user_id = ? AND media_id = ?').run(req.user.id, row.id);
    } else {
        db.prepare('INSERT INTO likes (user_id, media_id) VALUES (?, ?)').run(req.user.id, row.id);
    }
    const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE media_id = ?').get(row.id).c;
    res.json({ liked: !existing, likeCount });
});

app.get('/api/media/:id/comments', (req, res) => {
    const rows = db.prepare(`
        SELECT c.id, c.text, c.created_at, u.name AS author
        FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.media_id = ? ORDER BY c.created_at ASC
    `).all(req.params.id);
    res.json({ comments: rows.map(r => ({ id: r.id, text: r.text, author: r.author, createdAt: r.created_at })) });
});

app.post('/api/media/:id/comment', auth(), (req, res) => {
    const row = db.prepare('SELECT id FROM media WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено' });
    const text = ((req.body || {}).text || '').trim();
    if (!text) return res.status(400).json({ error: 'Комментарий пуст' });
    if (text.length > 2000) return res.status(400).json({ error: 'Комментарий слишком длинный' });
    const info = db.prepare('INSERT INTO comments (user_id, media_id, text) VALUES (?, ?, ?)')
        .run(req.user.id, row.id, text);
    res.status(201).json({
        comment: { id: info.lastInsertRowid, text, author: req.user.name, createdAt: new Date().toISOString() }
    });
});

app.get('/api/user/favorites', auth(), (req, res) => {
    const rows = db.prepare(`
        SELECT m.* FROM media m
        JOIN likes l ON l.media_id = m.id
        WHERE l.user_id = ? ORDER BY l.created_at DESC
    `).all(req.user.id);
    res.json({ media: rows.map(r => mediaWithMeta(r, req.user.id)) });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- errors ----------

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Ошибка загрузки: ${err.message}` });
    }
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
    console.log(`433lab backend listening on :${PORT}`);
});
