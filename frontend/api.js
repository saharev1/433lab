/* 433lab — клиент API: авторизация, медиа, лайки, комментарии, избранное */
(function () {
    'use strict';

    const TOKEN_KEY = '433_token';
    const USER_KEY = '433_user';

    const HEART_PATH = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';

    // Разделы, контент которых загружается с сервера
    const MEDIA_SECTIONS = {
        'screen-listen-tales': 'track',
        'screen-listen-music': 'track',
        'screen-listen-poems': 'track',
        'screen-watch-clips': 'video',
        'screen-watch-docs': 'video',
        'screen-watch-vids': 'video',
        'screen-watch-photo': 'photo',
        'screen-watch-pics': 'photo'
    };

    const SECTION_TITLES = {
        'listen-tales': 'Слушать / Сказки',
        'listen-music': 'Слушать / Музыка',
        'listen-poems': 'Слушать / Стихи',
        'watch-clips': 'Смотреть / Клипы',
        'watch-docs': 'Смотреть / Докфильм',
        'watch-vids': 'Смотреть / Ролики',
        'watch-photo': 'Смотреть / Фото',
        'watch-pics': 'Смотреть / Картинки'
    };

    // ---------- состояние ----------

    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
    }
    function setAuth(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        updateAuthUI();
    }
    function clearAuth() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        updateAuthUI();
    }

    // ---------- запросы ----------

    async function api(path, options = {}) {
        const headers = Object.assign({}, options.headers);
        if (!(options.body instanceof FormData) && options.body) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        const token = getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(path, Object.assign({}, options, { headers }));
        let data = {};
        try { data = await res.json(); } catch (e) { /* пустой ответ */ }
        if (!res.ok) {
            if (res.status === 401 && token) clearAuth();
            throw new Error(data.error || 'Ошибка сервера (' + res.status + ')');
        }
        return data;
    }

    // ---------- рендер медиа ----------

    function heartBtn(item) {
        return '<button class="icon-btn js-like' + (item.likedByMe ? ' liked' : '') + '" data-id="' + item.id + '">' +
            '<svg viewBox="0 0 24 24" style="transform: scaleY(-1);"><path d="' + HEART_PATH + '"></path></svg>' +
            '<span class="like-count">' + (item.likeCount || '') + '</span></button>';
    }

    function commentBtn(item) {
        return '<button class="icon-btn js-comments-toggle" data-id="' + item.id + '">' +
            '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>' +
            '<span class="like-count">' + (item.commentCount || '') + '</span></button>';
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function commentsBlock(item) {
        return '<div class="comments-block hidden" data-id="' + item.id + '">' +
            '<div class="comments-list"></div>' +
            '<div class="comment-form">' +
            '<input type="text" class="comment-input" placeholder="Комментарий..." maxlength="2000">' +
            '<button class="comment-send js-comment-send" data-id="' + item.id + '">→</button>' +
            '</div></div>';
    }

    function renderTrack(item) {
        return '<div class="track-item" data-media-id="' + item.id + '">' +
            '<div class="track-title">' + esc(item.title) + '</div>' +
            '<div class="track-desc">' + esc(item.description) + '</div>' +
            (item.type === 'audio' || item.type === 'video'
                ? '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>' : '') +
            '<div class="track-controls">' + heartBtn(item) + commentBtn(item) + '</div>' +
            commentsBlock(item) + '</div>';
    }

    function renderVideo(item) {
        return '<div class="video-item" data-media-id="' + item.id + '">' +
            '<div class="video-thumb video-thumb-player">' +
            (item.type === 'video'
                ? '<video controls preload="metadata" src="' + esc(item.url) + '#t=0.001"></video>'
                : '<img src="' + esc(item.url) + '" alt="">') +
            '</div>' +
            '<div class="video-info"><div class="video-title">' + esc(item.title) + '</div>' +
            '<div class="video-actions">' + heartBtn(item) + commentBtn(item) + '</div></div>' +
            commentsBlock(item) + '</div>';
    }

    function renderPhoto(item) {
        return '<div class="photo-item photo-item-real" data-media-id="' + item.id + '" ' +
            'style="background-image:url(\'' + esc(item.url) + '\')">' +
            '<div class="photo-actions">' + heartBtn(item) + '</div>' +
            '</div>';
    }

    async function loadSection(screenId) {
        const kind = MEDIA_SECTIONS[screenId];
        if (!kind) return;
        const screen = document.getElementById(screenId);
        if (!screen) return;
        const section = screenId.replace(/^screen-/, '');
        let data;
        try {
            data = await api('/api/media/' + section);
        } catch (e) {
            return; // бэкенд недоступен — оставляем статический контент
        }
        if (!data.media || !data.media.length) return;

        const container = screen.querySelector('.track-list, .video-list, .photo-grid, .cards-grid');
        if (!container) return;
        const render = kind === 'track' ? renderTrack : kind === 'video' ? renderVideo : renderPhoto;
        container.innerHTML = data.media.map(render).join('');
    }

    // ---------- избранное ----------

    async function loadFavorites() {
        const list = document.getElementById('favorites-list');
        if (!list) return;
        if (!getToken()) {
            list.innerHTML = '<div class="empty-note">Войдите, чтобы видеть избранное</div>';
            return;
        }
        let data;
        try {
            data = await api('/api/user/favorites');
        } catch (e) {
            list.innerHTML = '<div class="empty-note">' + esc(e.message) + '</div>';
            return;
        }
        if (!data.media.length) {
            list.innerHTML = '<div class="empty-note">Пока пусто — лайкните что-нибудь</div>';
            return;
        }
        list.innerHTML = data.media.map(item =>
            '<div class="track-item" data-media-id="' + item.id + '">' +
            '<div class="track-title">' + esc(item.title) + '</div>' +
            '<div class="track-desc">' + esc(SECTION_TITLES[item.section] || item.section) + '</div>' +
            (item.type === 'photo'
                ? '<img class="fav-photo" src="' + esc(item.url) + '" alt="">'
                : '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>') +
            '<div class="track-controls">' + heartBtn(item) + '</div>' +
            '</div>').join('');
    }

    // ---------- лайки и комментарии (делегирование) ----------

    document.addEventListener('click', async (e) => {
        const likeBtn = e.target.closest('.js-like');
        if (likeBtn) {
            e.stopPropagation();
            if (!getToken()) { alert('Войдите, чтобы ставить лайки'); return; }
            try {
                const data = await api('/api/media/' + likeBtn.dataset.id + '/like', { method: 'POST' });
                likeBtn.classList.toggle('liked', data.liked);
                const cnt = likeBtn.querySelector('.like-count');
                if (cnt) cnt.textContent = data.likeCount || '';
            } catch (err) { alert(err.message); }
            return;
        }

        const cToggle = e.target.closest('.js-comments-toggle');
        if (cToggle) {
            e.stopPropagation();
            const holder = cToggle.closest('[data-media-id]');
            const block = holder && holder.querySelector('.comments-block');
            if (!block) return;
            block.classList.toggle('hidden');
            if (!block.classList.contains('hidden')) {
                try {
                    const data = await api('/api/media/' + cToggle.dataset.id + '/comments');
                    block.querySelector('.comments-list').innerHTML = data.comments.length
                        ? data.comments.map(c => '<div class="comment-item"><b>' + esc(c.author) + ':</b> ' + esc(c.text) + '</div>').join('')
                        : '<div class="empty-note">Комментариев пока нет</div>';
                } catch (err) { /* ignore */ }
            }
            return;
        }

        const sendBtn = e.target.closest('.js-comment-send');
        if (sendBtn) {
            e.stopPropagation();
            if (!getToken()) { alert('Войдите, чтобы комментировать'); return; }
            const block = sendBtn.closest('.comments-block');
            const input = block.querySelector('.comment-input');
            const text = input.value.trim();
            if (!text) return;
            try {
                const data = await api('/api/media/' + sendBtn.dataset.id + '/comment', {
                    method: 'POST', body: { text }
                });
                input.value = '';
                const list = block.querySelector('.comments-list');
                const note = list.querySelector('.empty-note');
                if (note) note.remove();
                list.insertAdjacentHTML('beforeend',
                    '<div class="comment-item"><b>' + esc(data.comment.author) + ':</b> ' + esc(data.comment.text) + '</div>');
            } catch (err) { alert(err.message); }
        }
    });

    // ---------- авторизация: формы ----------

    function wireAuthForms() {
        const loginBtn = document.getElementById('login-submit');
        if (loginBtn) loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const status = document.getElementById('login-status');
            try {
                const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
                setAuth(data.token, data.user);
                status.textContent = 'Добро пожаловать, ' + data.user.name + '!';
                status.classList.remove('error');
                setTimeout(() => window.goBack && window.goBack(), 600);
            } catch (err) {
                status.textContent = err.message;
                status.classList.add('error');
            }
        });

        const regBtn = document.getElementById('register-submit');
        if (regBtn) regBtn.addEventListener('click', async () => {
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const status = document.getElementById('register-status');
            try {
                const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
                setAuth(data.token, data.user);
                status.textContent = 'Аккаунт создан!';
                status.classList.remove('error');
                setTimeout(() => window.goBack && window.goBack(), 600);
            } catch (err) {
                status.textContent = err.message;
                status.classList.add('error');
            }
        });
    }

    // ---------- админ: загрузка ----------

    function wireAdminForm() {
        const btn = document.getElementById('upload-submit');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const status = document.getElementById('upload-status');
            const fileInput = document.getElementById('upload-file');
            const fd = new FormData();
            fd.append('section', document.getElementById('upload-section').value);
            fd.append('title', document.getElementById('upload-title').value.trim());
            fd.append('description', document.getElementById('upload-desc').value.trim());
            if (!fileInput.files.length) { status.textContent = 'Выберите файл'; status.classList.add('error'); return; }
            fd.append('file', fileInput.files[0]);
            status.textContent = 'Загрузка...';
            status.classList.remove('error');
            try {
                await api('/api/media/upload', { method: 'POST', body: fd });
                status.textContent = 'Загружено!';
                fileInput.value = '';
                document.getElementById('upload-title').value = '';
                document.getElementById('upload-desc').value = '';
            } catch (err) {
                status.textContent = err.message;
                status.classList.add('error');
            }
        });
    }

    // ---------- меню: состояние входа ----------

    function updateAuthUI() {
        const user = getUser();
        const authed = !!(user && getToken());
        document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !authed));
        document.querySelectorAll('.admin-only').forEach(el =>
            el.classList.toggle('hidden', !(authed && user.role === 'admin')));

        const loginItem = document.getElementById('menu-login-item');
        if (loginItem) {
            if (authed) {
                loginItem.textContent = 'ВЫЙТИ';
                loginItem.removeAttribute('data-target');
                loginItem.classList.add('js-logout');
            } else {
                loginItem.textContent = 'ВОЙТИ';
                loginItem.setAttribute('data-target', 'screen-login');
                loginItem.classList.remove('js-logout');
            }
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.js-logout')) {
            clearAuth();
        }
    });

    // ---------- динамическая загрузка при навигации ----------

    document.addEventListener('click', (e) => {
        const nav = e.target.closest('[data-target]');
        if (!nav) return;
        const targetId = nav.getAttribute('data-target');
        if (!targetId) return;
        if (MEDIA_SECTIONS[targetId]) loadSection(targetId);
        if (targetId === 'screen-favorites') loadFavorites();
    });

    // ---------- init ----------

    document.addEventListener('DOMContentLoaded', () => {
        wireAuthForms();
        wireAdminForm();
        updateAuthUI();
        // проверяем валидность сохранённого токена
        if (getToken()) {
            api('/api/auth/me').then(d => {
                localStorage.setItem(USER_KEY, JSON.stringify(d.user));
                updateAuthUI();
            }).catch(() => {});
        }
    });
})();
