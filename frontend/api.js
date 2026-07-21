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

    // Экраны, находимые поиском по названию раздела
    const SCREEN_NAMES = {
        'screen-listen': 'Слушать',
        'screen-listen-tales': 'Слушать / Сказки',
        'screen-listen-music': 'Слушать / Музыка',
        'screen-listen-poems': 'Слушать / Стихи',
        'screen-watch': 'Смотреть',
        'screen-watch-clips': 'Смотреть / Клипы',
        'screen-watch-docs': 'Смотреть / Докфильм',
        'screen-watch-vids': 'Смотреть / Ролики',
        'screen-watch-works': 'Смотреть / Работы',
        'screen-watch-photo': 'Смотреть / Фото',
        'screen-watch-pics': 'Смотреть / Картинки',
        'screen-read': 'Читать',
        'screen-read-poems': 'Читать / Стихи',
        'screen-read-prose': 'Читать / Проза',
        'screen-read-scripts': 'Читать / Сценарии',
        'screen-learn': 'Учить',
        'screen-learn-guides': 'Учить / Гайды',
        'screen-ideas': 'Идеи',
        'screen-author-bio': 'Об авторе',
        'screen-favorites': 'Избранные'
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

    // Кэш данных медиа для форм редактирования
    const mediaCache = {};

    function isAdmin() {
        const u = getUser();
        return !!(u && getToken() && u.role === 'admin');
    }

    function adminBtns(item) {
        if (!isAdmin()) return '';
        return '<button class="icon-btn js-edit" data-id="' + item.id + '" title="Редактировать">' +
            '<svg viewBox="0 0 24 24"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>' +
            '<button class="icon-btn js-delete" data-id="' + item.id + '" title="Удалить">' +
            '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline>' +
            '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>';
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
        mediaCache[item.id] = item;
        return '<div class="track-item" data-media-id="' + item.id + '">' +
            '<div class="track-title">' + esc(item.title) + '</div>' +
            '<div class="track-desc">' + esc(item.description) + '</div>' +
            (item.type === 'audio' || item.type === 'video'
                ? '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>' : '') +
            '<div class="track-controls">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div>' +
            commentsBlock(item) + '</div>';
    }

    function renderVideo(item) {
        mediaCache[item.id] = item;
        return '<div class="video-item" data-media-id="' + item.id + '">' +
            '<div class="video-thumb video-thumb-player">' +
            (item.type === 'video'
                ? '<video controls preload="metadata" src="' + esc(item.url) + '#t=0.001"></video>'
                : '<img src="' + esc(item.url) + '" alt="">') +
            '</div>' +
            '<div class="video-info"><div class="video-title">' + esc(item.title) + '</div>' +
            '<div class="video-actions">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div></div>' +
            commentsBlock(item) + '</div>';
    }

    function renderPhoto(item) {
        mediaCache[item.id] = item;
        return '<div class="photo-item photo-item-real" data-media-id="' + item.id + '" ' +
            'data-full="' + esc(item.url) + '" title="Открыть в полном размере" ' +
            'style="background-image:url(\'' + esc(item.url) + '\')">' +
            '<div class="photo-actions">' + heartBtn(item) + adminBtns(item) + '</div>' +
            '</div>';
    }

    // ---------- админ: редактирование и удаление ----------

    function sectionOptions(selected) {
        return Object.keys(SECTION_TITLES).map(key =>
            '<option value="' + key + '"' + (key === selected ? ' selected' : '') + '>' +
            SECTION_TITLES[key] + '</option>').join('');
    }

    function closeEditForm() {
        document.querySelectorAll('.edit-block').forEach(el => el.remove());
    }

    function openEditForm(holder, item) {
        closeEditForm();
        const form = document.createElement('div');
        form.className = 'edit-block';
        form.innerHTML =
            '<input type="text" class="comment-input edit-title" value="' + esc(item.title) + '" placeholder="Название">' +
            '<input type="text" class="comment-input edit-desc" value="' + esc(item.description) + '" placeholder="Описание">' +
            '<input type="text" class="comment-input edit-tags" value="' + esc((item.tags || []).join(', ')) + '" placeholder="Теги через запятую">' +
            '<select class="comment-input edit-section">' + sectionOptions(item.section) + '</select>' +
            '<div class="edit-actions">' +
            '<button class="comment-send js-edit-save" data-id="' + item.id + '">Сохранить</button>' +
            '<button class="comment-send edit-cancel js-edit-cancel">Отмена</button>' +
            '</div>';
        holder.appendChild(form);
    }

    async function saveEdit(saveBtn) {
        const form = saveBtn.closest('.edit-block');
        const id = saveBtn.dataset.id;
        const body = {
            title: form.querySelector('.edit-title').value,
            description: form.querySelector('.edit-desc').value,
            tags: form.querySelector('.edit-tags').value,
            section: form.querySelector('.edit-section').value
        };
        const data = await api('/api/media/' + id, { method: 'PATCH', body });
        mediaCache[id] = data.media;
        const holder = form.closest('[data-media-id]');
        closeEditForm();
        const titleEl = holder.querySelector('.track-title, .video-title');
        if (titleEl) titleEl.textContent = data.media.title;
        const descEl = holder.querySelector('.track-desc');
        if (descEl) descEl.textContent = data.media.description;
        // если раздел сменился — убираем элемент из текущего списка
        const screen = holder.closest('.screen');
        if (screen && screen.id !== 'screen-favorites' &&
            screen.id.replace(/^screen-/, '') !== data.media.section) {
            holder.remove();
        }
    }

    async function deleteMedia(delBtn) {
        const id = delBtn.dataset.id;
        const item = mediaCache[id];
        if (!confirm('Удалить «' + (item ? item.title : '#' + id) + '»? Файл будет удалён с сервера.')) return;
        await api('/api/media/' + id, { method: 'DELETE' });
        const holder = delBtn.closest('[data-media-id]');
        if (holder) holder.remove();
        delete mediaCache[id];
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
        const container = screen.querySelector('.track-list, .video-list, .photo-grid, .cards-grid');
        if (!container) return;
        // Сервер ответил — убираем прототипные плитки-заглушки в любом случае,
        // иначе их (без кнопки удаления) невозможно убрать из пустого раздела.
        if (!data.media || !data.media.length) {
            container.innerHTML = '<div class="empty-note">Пока пусто</div>';
            return;
        }
        const render = kind === 'track' ? renderTrack : kind === 'video' ? renderVideo : renderPhoto;
        container.innerHTML = data.media.map(render).join('');
    }

    // ---------- поиск ----------

    function renderSearchItem(item) {
        mediaCache[item.id] = item;
        const sectionName = SECTION_TITLES[item.section] || item.section;
        return '<div class="track-item" data-media-id="' + item.id + '">' +
            '<div class="track-title">' + esc(item.title) + '</div>' +
            (item.description ? '<div class="track-desc">' + esc(item.description) + '</div>' : '') +
            '<div class="search-item-meta">' +
            '<span class="search-section-link" data-target="screen-' + esc(item.section) + '">' + esc(sectionName) + '</span>' +
            (item.tags && item.tags.length
                ? '<span class="search-tags">' + item.tags.map(t => '#' + esc(t)).join(' ') + '</span>' : '') +
            '</div>' +
            (item.type === 'photo'
                ? '<img class="fav-photo" src="' + esc(item.url) + '" data-full="' + esc(item.url) + '" title="Открыть в полном размере" alt="">'
                : item.type === 'video'
                    ? '<div class="video-thumb video-thumb-player"><video controls preload="metadata" src="' + esc(item.url) + '#t=0.001"></video></div>'
                    : '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>') +
            '<div class="track-controls">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div>' +
            commentsBlock(item) + '</div>';
    }

    let searchSeq = 0;

    async function performSearch(query) {
        const q = String(query || '').trim();
        const secBox = document.getElementById('search-sections');
        const resBox = document.getElementById('search-results');
        if (!secBox || !resBox) return;
        const input = document.getElementById('search-screen-input');
        if (input && input.value.trim() !== q) input.value = q;
        if (!q) { secBox.innerHTML = ''; resBox.innerHTML = ''; return; }
        const ql = q.toLowerCase();

        // совпадения по названиям разделов
        const sections = Object.keys(SCREEN_NAMES).filter(id =>
            document.getElementById(id) &&
            (id !== 'screen-favorites' || getToken()) &&
            SCREEN_NAMES[id].toLowerCase().includes(ql));
        secBox.innerHTML = sections.map(id =>
            '<div class="submenu-item search-section-item" data-target="' + id + '">' +
            esc(SCREEN_NAMES[id]) + '</div>').join('');

        // совпадения по постам (название/описание/теги)
        const seq = ++searchSeq;
        resBox.innerHTML = '<div class="empty-note">Поиск...</div>';
        let data;
        try {
            data = await api('/api/search?q=' + encodeURIComponent(q));
        } catch (e) {
            if (seq === searchSeq) resBox.innerHTML = '<div class="empty-note">' + esc(e.message) + '</div>';
            return;
        }
        if (seq !== searchSeq) return; // пришёл более свежий запрос
        resBox.innerHTML = data.media.length
            ? data.media.map(renderSearchItem).join('')
            : (sections.length ? '' : '<div class="empty-note">Ничего не найдено</div>');
    }

    // Enter в любой строке поиска → экран результатов
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const input = e.target.closest('.search-input');
        if (!input) return;
        const q = input.value.trim();
        if (!q) return;
        if (window.navigateTo) window.navigateTo('screen-search');
        performSearch(q);
    });

    // Живой поиск при наборе на экране поиска
    let searchDebounce;
    document.addEventListener('input', (e) => {
        if (e.target.id !== 'search-screen-input') return;
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => performSearch(e.target.value), 350);
    });

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
                ? '<img class="fav-photo" src="' + esc(item.url) + '" data-full="' + esc(item.url) + '" title="Открыть в полном размере" alt="">'
                : '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>') +
            '<div class="track-controls">' + heartBtn(item) + '</div>' +
            '</div>').join('');
    }

    // ---------- лайтбокс: просмотр фото в полном размере ----------

    function openLightbox(url) {
        let box = document.getElementById('lightbox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'lightbox';
            box.className = 'lightbox';
            box.innerHTML = '<button class="lightbox-close" aria-label="Закрыть">&times;</button>' +
                '<img class="lightbox-img" alt="">';
            document.body.appendChild(box);
        }
        box.querySelector('.lightbox-img').src = url;
        box.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const box = document.getElementById('lightbox');
        if (!box) return;
        box.classList.remove('open');
        box.querySelector('.lightbox-img').src = '';
        document.body.style.overflow = '';
    }

    // Открытие по клику на фото (но не по кнопкам лайка/удаления внутри плитки)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.lightbox-close') || e.target.id === 'lightbox') {
            closeLightbox();
            return;
        }
        const full = e.target.closest('[data-full]');
        if (full && !e.target.closest('.icon-btn') && !e.target.closest('button')) {
            e.preventDefault();
            openLightbox(full.dataset.full);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

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
            return;
        }

        const editBtn = e.target.closest('.js-edit');
        if (editBtn) {
            e.stopPropagation();
            const holder = editBtn.closest('[data-media-id]');
            const item = mediaCache[editBtn.dataset.id];
            if (holder && item) openEditForm(holder, item);
            return;
        }

        const saveBtn = e.target.closest('.js-edit-save');
        if (saveBtn) {
            e.stopPropagation();
            try { await saveEdit(saveBtn); } catch (err) { alert(err.message); }
            return;
        }

        if (e.target.closest('.js-edit-cancel')) {
            e.stopPropagation();
            closeEditForm();
            return;
        }

        const delBtn = e.target.closest('.js-delete');
        if (delBtn) {
            e.stopPropagation();
            try { await deleteMedia(delBtn); } catch (err) { alert(err.message); }
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
            fd.append('tags', document.getElementById('upload-tags').value.trim());
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
                document.getElementById('upload-tags').value = '';
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
        // при перезагрузке app.js восстанавливает экран из хэша — подгружаем его контент
        const restoredId = window.location.hash.slice(1);
        if (restoredId) {
            if (MEDIA_SECTIONS[restoredId]) loadSection(restoredId);
            if (restoredId === 'screen-favorites') loadFavorites();
        }
        // проверяем валидность сохранённого токена
        if (getToken()) {
            api('/api/auth/me').then(d => {
                localStorage.setItem(USER_KEY, JSON.stringify(d.user));
                updateAuthUI();
            }).catch(() => {});
        }
    });
})();
