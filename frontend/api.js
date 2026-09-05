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
        'screen-watch-pics': 'photo',
        'screen-read-poems': 'text',
        'screen-read-prose': 'text',
        'screen-read-scripts': 'text',
        'screen-read-tales': 'text',
        'screen-read-thoughts': 'text',
        'screen-read-articles': 'text',
        'screen-learn-guides': 'text',
        'screen-learn-articles': 'text',
        'screen-ideas': 'text'
    };

    const SECTION_TITLES = {
        'listen-tales': 'Слушать / Сказки',
        'listen-music': 'Слушать / Музыка',
        'listen-poems': 'Слушать / Стихи',
        'watch-clips': 'Смотреть / Клипы',
        'watch-docs': 'Смотреть / Докфильм',
        'watch-vids': 'Смотреть / Ролики',
        'watch-photo': 'Смотреть / Фото',
        'watch-pics': 'Смотреть / Картинки',
        'read-poems': 'Читать / Стихи',
        'read-prose': 'Читать / Проза',
        'read-scripts': 'Читать / Сценарии',
        'read-tales': 'Читать / Сказки',
        'read-thoughts': 'Читать / Мысли',
        'read-articles': 'Читать / Статьи',
        'learn-guides': 'Учить / Гайды',
        'learn-articles': 'Учить / Статьи',
        'ideas': 'Идеи'
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
        'screen-read-tales': 'Читать / Сказки',
        'screen-read-thoughts': 'Читать / Мысли',
        'screen-read-articles': 'Читать / Статьи',
        'screen-learn': 'Учить',
        'screen-learn-guides': 'Учить / Гайды',
        'screen-learn-articles': 'Учить / Статьи',
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

    // ---------- статьи с разметкой: чистка и редактор ----------

    // Текст статьи выводится на страницу как разметка, а не как экранированный текст,
    // поэтому перед вставкой он обязательно проходит чистку: остаются только теги
    // и атрибуты из этих списков, всё остальное (скрипты, обработчики, iframe) срезается.
    const HTML_TAGS = ['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
        'ol', 'ul', 'li', 'a', 'img', 'span', 'div'];
    const HTML_ATTRS = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

    function sanitizeHtml(html) {
        if (window.DOMPurify) {
            return DOMPurify.sanitize(String(html == null ? '' : html), {
                ALLOWED_TAGS: HTML_TAGS,
                ALLOWED_ATTR: HTML_ATTRS
            });
        }
        // библиотека чистки не загрузилась — выводим как обычный текст, но не как разметку
        return esc(html);
    }

    function htmlToText(html) {
        const d = document.createElement('div');
        d.innerHTML = sanitizeHtml(html);
        return d.textContent || '';
    }

    // Старый пост, написанный обычным текстом, при открытии в редакторе разбиваем на абзацы
    function plainToHtml(text) {
        const parts = String(text || '').split(/\n{2,}/).filter(p => p.trim());
        if (!parts.length) return '';
        return parts.map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
    }

    // Quill пропускает в картинках только абсолютные http/https/data-адреса, а всё
    // остальное заменяет заглушкой '//:0'. Наши иллюстрации лежат по относительному
    // пути /media/Photos/..., поэтому такие адреса разрешаем явно; всё прочее
    // по-прежнему проходит штатную проверку библиотеки.
    if (window.Quill) {
        const ImageBlot = Quill.import('formats/image');
        const baseSanitize = ImageBlot.sanitize;
        ImageBlot.sanitize = function (url) {
            const u = String(url == null ? '' : url);
            return /^\/(?!\/)/.test(u) ? u : baseSanitize.call(this, u);
        };
    }

    const EDITOR_TOOLBAR = [
        [{ header: [2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link', 'image'],
        ['clean']
    ];

    async function uploadInlineImage(file) {
        const fd = new FormData();
        fd.append('file', file);
        const data = await api('/api/upload/inline', { method: 'POST', body: fd });
        return data.url;
    }

    function insertImageAt(quill, url, index) {
        quill.insertEmbed(index, 'image', url, 'user');
        quill.setSelection(index + 1, 0, 'silent');
    }

    // Позиция в тексте под курсором мыши — чтобы перетащенная картинка вставала туда,
    // куда её бросили, а не в конец статьи
    function indexAtPoint(quill, x, y) {
        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(x, y);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
            }
        }
        if (range && quill.root.contains(range.startContainer)) {
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const r = quill.getSelection();
            if (r) return r.index;
        }
        return Math.max(0, quill.getLength() - 1);
    }

    // Картинки, брошенные мышью или вставленные из буфера, отправляем на сервер и
    // подставляем ссылку. Иначе Quill вклеил бы их в текст как base64 — статья на
    // несколько мегабайт прямо в базе.
    function wireEditorImages(quill) {
        async function place(files, index) {
            for (const file of files) {
                if (!/^image\//.test(file.type)) continue;
                try {
                    insertImageAt(quill, await uploadInlineImage(file), index);
                    index += 1;
                } catch (err) { alert(err.message); }
            }
        }
        quill.root.addEventListener('drop', (e) => {
            const files = e.dataTransfer ? Array.from(e.dataTransfer.files || []) : [];
            if (!files.some(f => /^image\//.test(f.type))) return;
            e.preventDefault();
            e.stopPropagation();
            place(files, indexAtPoint(quill, e.clientX, e.clientY));
        }, true);
        quill.root.addEventListener('paste', (e) => {
            const files = e.clipboardData ? Array.from(e.clipboardData.files || []) : [];
            if (!files.some(f => /^image\//.test(f.type))) return;
            e.preventDefault();
            e.stopPropagation();
            const sel = quill.getSelection();
            place(files, sel ? sel.index : Math.max(0, quill.getLength() - 1));
        }, true);
    }

    function pickImage(quill) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            try {
                const sel = quill.getSelection(true);
                insertImageAt(quill, await uploadInlineImage(file),
                    sel ? sel.index : Math.max(0, quill.getLength() - 1));
            } catch (err) { alert(err.message); }
        });
        input.click();
    }

    // Создаёт редактор внутри holder. Возвращает null, если библиотека не загрузилась —
    // вызывающий код тогда остаётся на обычной textarea, и публикация всё равно работает.
    function createEditor(holder, initialHtml) {
        if (!window.Quill) return null;
        const area = document.createElement('div');
        area.className = 'rich-editor';
        holder.appendChild(area);
        let quill;
        quill = new Quill(area, {
            theme: 'snow',
            placeholder: 'Текст публикации — заголовки, списки, картинки прямо в тексте',
            modules: {
                toolbar: {
                    container: EDITOR_TOOLBAR,
                    handlers: { image: function () { pickImage(quill); } }
                }
            }
        });
        const start = sanitizeHtml(initialHtml || '');
        if (start) quill.clipboard.dangerouslyPasteHTML(start, 'silent');
        wireEditorImages(quill);
        return quill;
    }

    function editorIsEmpty(quill) {
        return !quill.getText().trim() && !quill.root.querySelector('img');
    }

    // Именно getSemanticHTML, а не root.innerHTML: внутри редактора маркированный
    // список хранится как <ol><li data-list="bullet"> со служебными <span class="ql-ui">,
    // и вне редактора это превратилось бы в нумерованный список. Семантический вывод
    // даёт нормальные <ul>/<ol> без служебной разметки.
    //
    // Но он же заменяет КАЖДЫЙ пробел на неразрывный — с таким текстом строка не
    // переносится и абзац уезжает за край экрана. Одиночные неразрывные пробелы
    // возвращаем обычными; цепочки из двух и более оставляем — это уже осознанный
    // отступ, набранный автором.
    function editorHtml(quill) {
        if (editorIsEmpty(quill)) return '';
        return quill.getSemanticHTML().replace(/(?:&nbsp;)+/g, m => (m.length === 6 ? ' ' : m));
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

    const TEXT_FOLD = 600; // длиннее — сворачиваем под «Читать полностью»

    // Тело публикации. Старые посты хранятся обычным текстом (textFormat='plain')
    // и выводятся с экранированием, новые — размеченные, после чистки sanitizeHtml.
    function articleBody(item, forceFold) {
        const raw = item.textContent || item.description || '';
        const isHtml = item.textFormat === 'html';
        const long = (isHtml ? htmlToText(raw) : raw).length > TEXT_FOLD;
        const folded = forceFold || long;
        const cls = 'article-text' + (isHtml ? ' article-html' : '') + (folded ? ' article-text-fold' : '');
        return {
            long,
            html: '<div class="' + cls + '">' + (isHtml ? sanitizeHtml(raw) : esc(raw)) + '</div>'
        };
    }

    function tagsRow(item) {
        return item.tags && item.tags.length
            ? '<div class="article-tags">' + item.tags.map(t => '#' + esc(t)).join(' ') + '</div>' : '';
    }

    function renderText(item) {
        mediaCache[item.id] = item;
        const body = articleBody(item);
        return '<div class="article-item" data-media-id="' + item.id + '">' +
            (item.url
                ? '<img class="article-cover" src="' + esc(item.url) + '" data-full="' + esc(item.url) +
                  '" title="Открыть в полном размере" alt="">' : '') +
            '<div class="article-title">' + esc(item.title) + '</div>' +
            body.html +
            (body.long ? '<button class="article-more js-text-toggle">Читать полностью</button>' : '') +
            tagsRow(item) +
            '<div class="article-controls">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div>' +
            commentsBlock(item) + '</div>';
    }

    // ---------- документы (PDF) ----------

    function formatSize(bytes) {
        const n = Number(bytes) || 0;
        if (!n) return '';
        if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' КБ';
        return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' МБ';
    }

    // Имя, под которым файл сохранится у посетителя: берём из названия публикации,
    // потому что на диске он лежит под техническим именем вида 1725000000-a1b2.pdf
    function docFileName(item) {
        const base = String(item.title || 'document').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'document';
        return /\.pdf$/i.test(base) ? base : base + '.pdf';
    }

    const DOC_ICON = '<svg class="doc-icon" viewBox="0 0 24 24">' +
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
        '<polyline points="14 2 14 8 20 8"></polyline></svg>';

    function docLink(item) {
        const size = formatSize(item.fileSize);
        return '<a class="doc-main" href="' + esc(item.url) + '" download="' + esc(docFileName(item)) + '">' +
            DOC_ICON + '<span class="doc-lines">' +
            '<span class="doc-name">' + esc(item.title) + '</span>' +
            '<span class="doc-meta">PDF' + (size ? ' · ' + size : '') + ' · скачать</span>' +
            '</span></a>';
    }

    function renderDoc(item) {
        mediaCache[item.id] = item;
        const hasNote = !!(item.textContent || item.description);
        return '<div class="article-item doc-item" data-media-id="' + item.id + '">' +
            '<div class="article-title">' + esc(item.title) + '</div>' +
            docLink(item) +
            (hasNote ? articleBody(item).html : '') +
            tagsRow(item) +
            '<div class="article-controls">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div>' +
            commentsBlock(item) + '</div>';
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
        // у документа правится пояснение к файлу, у текстового поста — сама статья
        const hasBody = item.type === 'text' || item.type === 'doc';
        form.innerHTML =
            '<input type="text" class="comment-input edit-title" value="' + esc(item.title) + '" placeholder="Название">' +
            '<input type="text" class="comment-input edit-desc" value="' + esc(item.description) + '" placeholder="Описание">' +
            (hasBody ? '<div class="edit-text-holder"></div>' : '') +
            '<input type="text" class="comment-input edit-tags" value="' + esc((item.tags || []).join(', ')) + '" placeholder="Теги через запятую">' +
            '<select class="comment-input edit-section">' + sectionOptions(item.section) + '</select>' +
            '<div class="edit-actions">' +
            '<button class="comment-send js-edit-save" data-id="' + item.id + '">Сохранить</button>' +
            '<button class="comment-send edit-cancel js-edit-cancel">Отмена</button>' +
            '</div>';
        holder.appendChild(form);
        if (!hasBody) return;
        const box = form.querySelector('.edit-text-holder');
        const raw = item.textContent || '';
        const quill = createEditor(box, item.textFormat === 'html' ? raw : plainToHtml(raw));
        if (quill) {
            form.quillEditor = quill;
        } else {
            // редактор недоступен — правим текстом, как раньше
            const ta = document.createElement('textarea');
            ta.className = 'comment-input edit-text';
            ta.rows = 6;
            ta.placeholder = 'Текст публикации';
            ta.value = item.textFormat === 'html' ? htmlToText(raw) : raw;
            box.appendChild(ta);
        }
    }

    async function saveEdit(saveBtn) {
        const form = saveBtn.closest('.edit-block');
        const id = saveBtn.dataset.id;
        const textEl = form.querySelector('.edit-text');
        const body = {
            title: form.querySelector('.edit-title').value,
            description: form.querySelector('.edit-desc').value,
            tags: form.querySelector('.edit-tags').value,
            section: form.querySelector('.edit-section').value
        };
        if (form.quillEditor) {
            body.text_content = editorHtml(form.quillEditor);
            body.text_format = 'html';
        } else if (textEl) {
            body.text_content = textEl.value;
            body.text_format = 'plain';
        }
        const data = await api('/api/media/' + id, { method: 'PATCH', body });
        mediaCache[id] = data.media;
        const holder = form.closest('[data-media-id]');
        closeEditForm();
        const titleEl = holder.querySelector('.track-title, .video-title, .article-title');
        if (titleEl) titleEl.textContent = data.media.title;
        const descEl = holder.querySelector('.track-desc');
        if (descEl) descEl.textContent = data.media.description;
        const textBody = holder.querySelector('.article-text');
        if (textBody) {
            const raw = data.media.textContent || data.media.description || '';
            if (data.media.textFormat === 'html') {
                textBody.classList.add('article-html');
                textBody.innerHTML = sanitizeHtml(raw);
            } else {
                textBody.classList.remove('article-html');
                textBody.textContent = raw;
            }
        }
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
        const container = screen.querySelector('.track-list, .video-list, .photo-grid, .cards-grid, .article-list');
        if (!container) return;
        // Сервер ответил — убираем прототипные плитки-заглушки в любом случае,
        // иначе их (без кнопки удаления) невозможно убрать из пустого раздела.
        if (!data.media || !data.media.length) {
            container.innerHTML = '<div class="empty-note">Пока пусто</div>';
            return;
        }
        const render = kind === 'track' ? renderTrack
            : kind === 'video' ? renderVideo
                : kind === 'text' ? renderText : renderPhoto;
        // PDF рисуется карточкой со скачиванием в любом разделе, куда его положили
        container.innerHTML = data.media
            .map(item => (item.type === 'doc' ? renderDoc(item) : render(item))).join('');
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
            searchMediaBlock(item) +
            '<div class="track-controls">' + heartBtn(item) + commentBtn(item) + adminBtns(item) + '</div>' +
            commentsBlock(item) + '</div>';
    }

    function searchMediaBlock(item) {
        if (item.type === 'photo') {
            return '<img class="fav-photo" src="' + esc(item.url) + '" data-full="' + esc(item.url) +
                '" title="Открыть в полном размере" alt="">';
        }
        if (item.type === 'video') {
            return '<div class="video-thumb video-thumb-player"><video controls preload="metadata" src="' +
                esc(item.url) + '#t=0.001"></video></div>';
        }
        if (item.type === 'doc') {
            return docLink(item);
        }
        if (item.type === 'text') {
            return (item.url
                ? '<img class="article-cover" src="' + esc(item.url) + '" data-full="' + esc(item.url) +
                  '" title="Открыть в полном размере" alt="">' : '') +
                articleBody(item, true).html;
        }
        return '<audio class="media-audio" controls preload="none" src="' + esc(item.url) + '"></audio>';
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
            searchMediaBlock(item) +
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

    // «Читать полностью» — разворачивание длинного текста
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('.js-text-toggle');
        if (!toggle) return;
        e.stopPropagation();
        const body = toggle.closest('.article-item').querySelector('.article-text');
        if (!body) return;
        const folded = body.classList.toggle('article-text-fold');
        toggle.textContent = folded ? 'Читать полностью' : 'Свернуть';
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

    let uploadQuill = null;

    function wireAdminForm() {
        const btn = document.getElementById('upload-submit');
        if (!btn) return;
        const textEl = document.getElementById('upload-text');
        // Подменяем простое поле визуальным редактором. Если Quill не загрузился,
        // textarea остаётся на месте и форма работает как раньше.
        if (textEl && window.Quill) {
            const box = document.createElement('div');
            box.className = 'form-editor';
            textEl.parentNode.insertBefore(box, textEl);
            uploadQuill = createEditor(box, '');
            if (uploadQuill) textEl.classList.add('hidden');
            else box.remove();
        }
        btn.addEventListener('click', async () => {
            const status = document.getElementById('upload-status');
            const fileInput = document.getElementById('upload-file');
            const text = uploadQuill ? editorHtml(uploadQuill) : (textEl ? textEl.value.trim() : '');
            const fd = new FormData();
            fd.append('section', document.getElementById('upload-section').value);
            fd.append('title', document.getElementById('upload-title').value.trim());
            fd.append('description', document.getElementById('upload-desc').value.trim());
            fd.append('tags', document.getElementById('upload-tags').value.trim());
            fd.append('text_content', text);
            fd.append('text_format', uploadQuill ? 'html' : 'plain');
            // файл нужен для медиа, но не для текстового поста — достаточно текста
            if (!fileInput.files.length && !text) {
                status.textContent = 'Выберите файл или введите текст публикации';
                status.classList.add('error');
                return;
            }
            if (fileInput.files.length) fd.append('file', fileInput.files[0]);
            status.textContent = 'Загрузка...';
            status.classList.remove('error');
            try {
                await api('/api/media/upload', { method: 'POST', body: fd });
                status.textContent = 'Загружено!';
                fileInput.value = '';
                document.getElementById('upload-title').value = '';
                document.getElementById('upload-desc').value = '';
                document.getElementById('upload-tags').value = '';
                if (uploadQuill) uploadQuill.setText('');
                else if (textEl) textEl.value = '';
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
