# Los Santos Role Play (LSRP)

Игровой RP-сервер на **[open.mp](https://open.mp)**. Логика мода — **TypeScript** через **omp-node** (Node.js). Клиент: SA-MP 0.3.7 / open.mp.

| Что | |
|---|---|
| Стек | open.mp, omp-node, TypeScript, esbuild, MySQL (`mysql2`) |
| Код | `resources/src/` → сборка в `resources/dist/` (не править вручную) |
| Данные | MySQL, настройки в `.env` |
| Документация | [docs.md](docs/docs.md) · [docs_v2.md](docs/docs_v2.md) · [docs_v3.md](docs/docs_v3.md) |
| Деплой | [deploy.md](docs/deploy.md) · [deploy.yml](deploy.yml) |

## Структура

```
.
├── omp-server.exe
├── config.json
├── .env                 # из .env.example
├── maps/                # объекты карты
├── sql/                 # эталон схемы (таблицы создаются при старте)
├── gamemodes/lsrp.amx   # заглушка Pawn
├── docs/                # документация
└── resources/
    ├── src/             # исходники мода
    │   ├── index.ts     # порядок модулей
    │   ├── shared/      # бренд, цвета, БД, хелперы
    │   └── modules/     # auth, houses, businesses, vehicles,
    │                    # jobs, anticheat, org, chat, commands, …
    ├── dist/            # сборка JS (gitignore)
    └── tests/           # unit-тесты (Vitest)
```

- Новый модуль — папка в `modules/` + импорт в `src/index.ts`.
- Новая команда — файл в `modules/commands/` + `import` в `commands/index.ts`.
- Геймплей, регистрация, команды — в `docs/`.

## Запуск

1. Установи **Node.js** и **MySQL** (например OSPanel).
2. Создай **пустую** базу. SQL вручную импортировать не нужно — при старте сервер создаст таблицы и стартовые данные сам.
3. Скопируй `.env.example` → `.env` и пропиши доступ к БД.
4. Установи зависимости, собери и запусти:

```powershell
cd resources
npm install
cd ..
npm run build
npm start
```

Клиент: `127.0.0.1:7777`, ник вида `Name_Surname`. После каждого `build` сервер нужно **перезапустить** (hot-reload нет).

| Команда | Где | Назначение |
|---|---|---|
| `npm run build` | корень | собрать `resources/dist` |
| `npm run dev` | корень | watch-сборка |
| `npm run typecheck` | корень | проверка типов |
| `npm start` | корень | запуск `omp-server.exe` |
| `npm test` | `resources/` | unit-тесты |

Удобный цикл: в одном терминале `npm run dev`, сервер перезапускаешь вручную после правок.
