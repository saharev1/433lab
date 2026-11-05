/* 433lab — «игрушки» Леонида в разделе МЫСЛИТЬ: полка карточек и страница-в-странице */
(function () {
    'use strict';

    // Новая игрушка = папка во frontend/toys/<id>/ + обложка toys/covers/<id>.jpg + строка здесь
    const TOYS = [
        {
            id: 'print-defects',
            url: 'toys/print-defects/',
            cover: 'toys/covers/print-defects.jpg',
            title: 'Оттиск',
            desc: 'Симулятор дефектов печати: загрузите макет и посмотрите, что с ним сделает типография'
        },
        {
            id: 'aristotle',
            url: 'toys/aristotle/',
            cover: 'toys/covers/aristotle.jpg',
            title: 'Категории Аристотеля',
            desc: 'Десять вопросов, которые раскладывают любой объект на части: от сути до того, что он испытывает'
        },
        {
            id: 'typography',
            url: 'typography/',
            cover: 'toys/covers/typography.jpg',
            title: 'Типографика',
            desc: 'Интерактивный курс: от точки росчерка до целой полосы, 11 тренажёров'
        }
    ];

    const SCREEN = 'screen-ideas';
    const BACK_ICON = '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" />' +
        '<path d="M4 9h10.5A5.5 5.5 0 0 1 20 14.5v0A5.5 5.5 0 0 1 14.5 20H11" /></svg>';

    let overlay = null;
    let openToy = null;
    let originCard = null;
    let historyLenAtOpen = 0;

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    }

    function findToy(id) {
        return TOYS.find(t => t.id === id) || null;
    }

    function renderShelf() {
        const shelf = document.getElementById('toy-shelf');
        if (!shelf) return;
        shelf.innerHTML = TOYS.map((t, i) =>
            '<a class="toy-card" href="#' + SCREEN + '/' + esc(t.id) + '" data-toy="' + esc(t.id) + '">' +
                '<div class="toy-cover"><img src="' + esc(t.cover) + '" alt="" loading="lazy"></div>' +
                '<div class="toy-meta">' +
                    '<span class="toy-num">' + String(i + 1).padStart(2, '0') + '</span>' +
                    '<span class="toy-title">' + esc(t.title) + '</span>' +
                    '<span class="toy-open">открыть&nbsp;→</span>' +
                '</div>' +
                '<div class="toy-desc">' + esc(t.desc) + '</div>' +
            '</a>').join('');
    }

    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.className = 'toy-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML =
            '<div class="toy-bar">' +
                '<button class="back-btn toy-close" aria-label="Назад">' + BACK_ICON + '</button>' +
                '<div class="toy-bar-title"></div>' +
                '<a class="toy-bar-ext" target="_blank" rel="noopener" title="Открыть в новой вкладке">' +
                    '<span>Отдельно</span> ↗</a>' +
            '</div>' +
            '<div class="toy-stage"><img class="toy-placeholder" alt=""></div>';
        document.body.appendChild(overlay);

        overlay.querySelector('.toy-close').addEventListener('click', requestClose);
    }

    // iframe каждый раз новый: смена src у живого iframe добавляет записи в общую
    // историю вкладки, и «назад» листал бы страницу внутри вместо закрытия окна
    function mountFrame(toy) {
        const frame = document.createElement('iframe');
        frame.className = 'toy-frame';
        frame.title = toy.title;
        // без allow-same-origin: страница внутри не видит localStorage сайта (токен входа)
        frame.setAttribute('sandbox',
            'allow-scripts allow-downloads allow-forms allow-popups allow-popups-to-escape-sandbox');
        frame.addEventListener('load', () => {
            if (openToy === toy) overlay.classList.add('loaded');
        });
        frame.src = toy.url;
        overlay.querySelector('.toy-stage').appendChild(frame);
    }

    function unmountFrame() {
        const frame = overlay && overlay.querySelector('.toy-frame');
        if (frame) frame.remove();
    }

    // clip-path карточки относительно окна — из неё «вырастает» страница
    function insetFrom(el) {
        if (!el) return 'inset(50% 50% 50% 50% round 6px)';
        const r = el.getBoundingClientRect();
        const w = window.innerWidth, h = window.innerHeight;
        return 'inset(' + Math.max(0, r.top) + 'px ' + Math.max(0, w - r.right) + 'px ' +
            Math.max(0, h - r.bottom) + 'px ' + Math.max(0, r.left) + 'px round 6px)';
    }

    function open(toy, card, animate) {
        if (!overlay) buildOverlay();
        openToy = toy;
        originCard = card ? card.querySelector('.toy-cover') : null;

        overlay.querySelector('.toy-bar-title').textContent = toy.title;
        overlay.querySelector('.toy-bar-ext').href = toy.url;
        overlay.querySelector('.toy-placeholder').src = toy.cover;
        overlay.classList.remove('loaded', 'closing');
        unmountFrame();
        mountFrame(toy);

        overlay.style.transition = 'none';
        overlay.style.clipPath = animate ? insetFrom(originCard) : 'inset(0 0 0 0)';
        overlay.classList.add('open');
        void overlay.offsetWidth;
        overlay.style.transition = '';
        overlay.style.clipPath = 'inset(0 0 0 0 round 0px)';

        if (animate) overlay.querySelector('.toy-close').focus({ preventScroll: true });
        if (typeof window.ym === 'function') {
            window.ym(110962976, 'hit', location.href, { title: toy.title });
        }
    }

    function close() {
        if (!openToy) return;
        openToy = null;
        overlay.style.clipPath = insetFrom(originCard);
        overlay.classList.add('closing');
        setTimeout(() => {
            if (openToy) return; // успели открыть заново
            overlay.classList.remove('open', 'closing', 'loaded');
            unmountFrame();
        }, 550);
    }

    // Открытие кладёт запись в историю (pushOpen), чтобы «назад» на телефоне закрывал окно
    function pushOpen(toy) {
        history.pushState({ toy: toy.id }, '', '#' + SCREEN + '/' + toy.id);
        historyLenAtOpen = history.length;
    }

    // Кнопка в шапке и Esc. Если игрушка не добавляла своих записей (якоря внутри
    // iframe попадают в общую историю вкладки), снимаем нашу запись через back().
    // Иначе back() ушёл бы листать якоря — закрываем сразу и только подменяем адрес.
    function requestClose() {
        if (history.state && history.state.toy && history.length === historyLenAtOpen) {
            history.back();
        } else {
            close();
            history.replaceState(null, '', '#' + SCREEN);
        }
    }

    document.addEventListener('click', (e) => {
        const card = e.target.closest('.toy-card');
        // cmd/ctrl-клик — штатно в новую вкладку (там сработает прямая ссылка)
        if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const toy = findToy(card.dataset.toy);
        if (!toy || openToy) return;
        pushOpen(toy);
        open(toy, card, true);
    });

    window.addEventListener('popstate', (e) => {
        const id = e.state && e.state.toy;
        if (openToy && openToy.id !== id) close();
        if (!openToy && id && findToy(id)) {
            // «вперёд» обратно в игрушку
            historyLenAtOpen = history.length;
            open(findToy(id), document.querySelector('.toy-card[data-toy="' + id + '"]'), true);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && openToy) requestClose();
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderShelf();
        // Прямая ссылка вида #screen-ideas/print-defects: app.js уже открыл экран,
        // кладём под игрушку запись истории, чтобы «назад» вёл в МЫСЛИТЬ
        const m = location.hash.match(/^#screen-ideas\/([\w-]+)$/);
        const toy = m && findToy(m[1]);
        if (toy) {
            history.replaceState(null, '', '#' + SCREEN);
            pushOpen(toy);
            open(toy, null, false);
        }
    });
})();
