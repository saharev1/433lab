# 4:33 Lab

Сайт проекта 4:33 — статический фронтенд + backend API (авторизация, медиа, лайки, комментарии, избранное).

## Структура

```
├── frontend/            # статика сайта
│   ├── assets/          # изображения (bg.png, logo-vedma.svg, logo433.png)
│   ├── index.html
│   ├── styles.css
│   ├── app.js           # навигация и анимации экранов
│   └── api.js           # клиент API (auth, лайки, комментарии, избранное)
├── backend/             # API: Node.js + Express + SQLite
│   ├── server.js        # маршруты /api/*
│   ├── db.js            # схема БД и seed админа
│   └── Dockerfile
├── nginx/
│   ├── default.conf     # конфиг web-контейнера (статика + прокси /api/, /media/)
│   └── 433lab.conf      # референс: внешний прокси на хосте (443 → :6060)
├── docs/
│   └── claude_plan.md   # план backend-разработки
├── Dockerfile           # web-образ: nginx + frontend
├── docker-compose.yml   # web (:6060) + backend (:3000) + volumes media/dbdata
└── AGENTS.md            # протокол координации AI-агентов (не перемещать из корня)
```

## Запуск

```bash
docker compose up -d --build
```

Сайт — на порту 6060. Переменные окружения бэкенда (задать в проде):
`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (дефолт: `admin@433lab.local` / `admin433`).

Файлы медиа хранятся в volume `media` (`/media/Photos`, `/media/Videos`), база SQLite — в volume `dbdata`.
