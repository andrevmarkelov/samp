# LSRP — документация

**Los Santos Role Play.** Игровой сервер [open.mp](https://open.mp), логика на **TypeScript** через **omp-node**. Клиент: SA-MP 0.3.7 или open.mp. Локально: `127.0.0.1:7777`.

Краткий старт — [README.md](../README.md). Выкладка — [deploy.md](deploy.md). Шаблон пайплайна — [deploy.yml](../deploy.yml) (сейчас закомментирован). Здесь: архитектура, модули, база, команды, конфиг и результаты проверки перед публикацией.

`npm run typecheck` на момент этой документации проходит без ошибок.

Тексты игроку в чате и диалогах — **русский UTF-8**. Кодировку для клиента 0.3.7 обрабатывает DLL/компонент.

---

## Оглавление

1. [Как устроен запуск](#как-устроен-запуск)
2. [Дерево проекта](#дерево-проекта)
3. [Исходники мода](#исходники-мода)
4. [Порядок модулей](#порядок-модулей)
5. [Модули](#модули)
6. [База данных](#база-данных)
7. [Потоки событий](#потоки-событий)
8. [Команды игрока](#команды-игрока)
9. [Админка](#админка)
10. [Организации](#организации)
11. [Конфиг open.mp](#конфиг-openmp)
12. [Сборка и запуск](#сборка-и-запуск)
13. [Куда что править](#куда-что-править)
14. [Проверка проекта](#проверка-проекта)

---

## Как устроен запуск

`npm start` из корня запускает `omp-server.exe`. Он читает `config.json` и поднимает **два независимых слоя**:

| Слой | Что грузит | Роль |
|---|---|---|
| Pawn | `gamemodes/lsrp.amx` (`pawn.main_scripts`: `lsrp 1`) | Пустышка. Нужна компоненту `Pawn.dll`. Логики нет. |
| Node | `resources/` → `resources/omp-node.json` → `dist/index.js` | Весь мод. |

```
omp-server.exe
  ├─ Pawn.dll      → gamemodes/lsrp.amx          (заглушка)
  └─ omp-node.dll  → resources/omp-node.json
                       └─ dist/index.js         (сборка TypeScript)
```

**AMX TypeScript не видит и не собирает.** Сборка мода отдельно:

```
resources/src/*.ts  →  npm run build (esbuild)  →  resources/dist/index.js
```

Сервер исполняет уже собранный JS. После правок: `npm run build`, затем **рестарт** `omp-server.exe`. Hot-reload нет.

Цикл разработки: в одном терминале `npm run dev` (watch), сервер перезапускаешь вручную.

Ctrl+C иногда роняет встроенный Node в omp-node — особенность рантайма. Если консоль зависла: закрыть окно и снова `npm start`.

Кириллица в консоли Windows часто кракозябрами; в `log.txt` текст нормальный.

---

## Дерево проекта

Корень репозитория — рабочая директория `omp-server.exe` (`process.cwd()`). Отсюда читаются `.env`, `maps/`, `config.json`.

```
public/
  omp-server.exe                 бинарь open.mp (Windows)
  libnode.dll                    Node для omp-node
  config.json                    настройки сервера (в git)
  bans.json                      IP-баны движка
  .env / .env.example            MySQL (.env в .gitignore)
  package.json                   npm run build / dev / typecheck / start
  deploy.yml                     шаблон GitHub Actions (закомментирован)
  README.md
  docs/
    docs.md                      эта документация
    deploy.md                    выкладка на VPS
  maps/                          CreateObject / CreateDynamicObject
    jail.txt                     интерьер тюрьмы (в небе)
    hospital.txt
    mine.txt
    army.txt                     объекты армии; ворота gates в коде, не дублировать
  sql/schema.sql                 эталон таблицы users
  gamemodes/lsrp.amx             заглушка Pawn
  components/                    DLL open.mp
  resources/
    omp-node.json                { "name": "lsrp", "entry": "dist/index.js" }
    package.json
    tsconfig.json                strict
    src/
    dist/                        сборка (gitignore)
```

**Не удалять:** `components/`, `omp-server.exe`, `libnode.dll`, `config.json`, `resources/`, `maps/`, `sql/`, `bans.json`, `gamemodes/lsrp.amx`.

---

## Исходники мода

Все правки — в `resources/src/`. Новая система: папка в `modules/`, импорт и запись в массив в `src/index.ts`.

```
resources/src/
  index.ts
  shared/
    brand.ts                     SERVER_NAME, SERVER_TAG
    colors.ts
    database.ts                  пул mysql2, .env из cwd
    nearby.ts                    локальный чат, sanitizeChatText
    player.ts                    id, имя, kickSamePlayer
  modules/
    types.ts
    database/                    SELECT 1
    persist/                     сейв HP; деньги только из account.money
    auth/                        логин, сессия, scrypt, миграции
    spawn/                       класс, больница после смерти, HQ при первом спавне
    hospital/                    интерьер, койки /hospital
    cityhall/                    паспорт, инвайт
    miner/                       шахта
    gps/
    afk/
    payday/                      час :00, exp, зарплата органа
    worldtime/                   реальное локальное время
    zones/
    hud/                         textdraw «Los Santos RP»
    session/                     лог connect (не auth/session)
    chat/                        IC чат + анимация
    commands/                    игровые команды
    admin/                       /alogin и права 1–7
    org/                         каталог, армия, ворота, внешний вид
    mapping/                     maps/*.txt
```

Сборка: `esbuild`, ESM, `packages=external` (mysql2 и `@omp-node/core` не бандлятся). Target ES2018.

---

## Порядок модулей

В `src/index.ts` порядок **важен**:

1. `database`
2. **`persist` до `auth`** — на disconnect сначала сейв, потом очистка сессии
3. `auth`
4. `spawn`
5. `hospital`, `cityhall`, `miner`, `gps`, `afk`, `payday`, `worldtime`, `zones`
6. `hud`, `session`, `chat`, `commands`
7. `admin`, `org`
8. `mapping`

События open.mp вызываются у всех подписчиков. Порядок регистрации = порядок `start()`.

---

## Модули

### database / persist

`.env` читается из **корня сервера**. Пул mysql2: `connectionLimit: 10`, `utf8mb4`, `dateStrings: true`.

`queueSave` пишет в БД **HP с полоски** и **деньги из памяти аккаунта**, не `player.getMoney()`. Клиентский кэш денег при сейве выравнивается с аккаунтом (трейнер не сохраняется). Экономика (шахта, payday) должна сначала `patchAccount({ money })`, потом `giveMoney`.

Выход — сразу. Раз в 3 минуты — все авторизованные. Раз в 15 минут −1 HP, пол 20, если не `hospitalized`.

Урон: в память сразу, сверка через 50 мс. В спеке/смерти 0 HP в БД не пишется.

`closeDatabase()` на стопе сервера не вызывается.

### auth

Ник только с клиента: `Name_Surname`, 5–24, `^[A-Z][a-z]+_[A-Z][a-z]+$`.

Нет аккаунта: правила → почта → пароль 6–32 → повтор → ДР 16–80 лет → пол → скин → подтверждение.

Есть аккаунт: пароль, 3 ошибки — кик. Отмена диалога — кик.

До входа: спек, чат и команды закрыты.

Пароль: `scrypt:salt:key`. Сессия: `Map<слот, Account>`. На **connect и disconnect** сессия сбрасывается (слот не наследует чужой аккаунт). После `await` — `isSamePlayer`.

Диалоги: auth **1**, stats **2**, pass **3**, меню **4**, rules **5**, invite **6**, GPS **7**, шахта **8–10**, alogin **11**, makeleader **12**. Не занимать эти id новыми окнами без проверки.

### spawn

Один `Class`, team `255`. Смерть → случайная точка больницы, `hospitalized`, HP 20. Первый спавн сессии с органом — телепорт на HQ, дальше нет. F4 не лечит.

### hud

Один глобальный textdraw: `Los_Santos_RP` (на экране «Los Santos RP»), позиция 545, 4, цвет `0x0099FFFF`. `modules/hud/index.ts`.

### chat

IC **20 м**, VW + interior. Формат `Name_Surname[ID]: text`. У членов органа цвет nametag. `{` в тексте вырезается. Лимит 128. `game.use_chat_radius: false`.

### mapping

`maps/*.txt`: CreateObject / CreateDynamicObject, материалы, текст. VW/interior streamer **не** применяются (мир 0, draw 300). `army.txt` — здания; ворота армии создаются в `org/gates.ts`, в txt их не дублировать.

### hospital

Вход с улицы, койки только если `hospitalized`. Лечение +10 / 4.5 с, пока игрок в радиусе койки. Встал — лечение остановилось. Выход на улицу до лечения запрещён.

### cityhall

Паспорт, инвайт (одноразово, `invited_by IS NULL`).

### miner

Смена, руда, выплата у точки найма. GPS и шахта делят один чекпоинт.

### payday

В `:00`: +exp всем онлайн; зарплата органа по рангу; без органа зарплаты нет; AFK не платится (нет `playerUpdate` ~8 с или долгий простой).

### worldtime

Часы сервера = локальные `Date`, раз в минуту + на connect/spawn.

### afk

Пауза клиента и простой.

---

## База данных

Драйвер `mysql2`, плейсхолдеры `?`. Эталон: `sql/schema.sql`. Таблица и недостающие колонки — при старте (`ensureUsersTable`).

| Колонка | Смысл |
|---|---|
| `id` | PK |
| `name` | ник клиента, UNIQUE |
| `email` | нижний регистр, UNIQUE |
| `password_hash` | scrypt |
| `gender` | male / female |
| `skin` | гражданский скин |
| `level` / `exp` | payday |
| `money` | наличные; новый персонаж **500** |
| `donate` | счёт, системы нет |
| `health` | HP, новый **100** |
| `passport` | мэрия |
| `hospitalized` | нужно лечь на койку |
| `invited_by` | ник пригласившего |
| `register_ip` / `last_ip` | |
| `admin_level` | 0–7 |
| `admin_password_hash` | scrypt, NULL = задать при `/alogin` или после `/makeadmin` |
| `org_id` / `org_rank` | 0 = гражданский; ранг 1–10 |
| `birth_date` / `created_at` | |

Базу `lsrp` создать заранее. На VPS — отдельный пользователь, не `root` без пароля.

---

## Потоки событий

### Подключение

```
playerConnect
  → сброс auth/admin/spawn/hospital слота
  → spectating
  → HUD через 250 мс
  → beginAuth через 500 мс
playerSpawn (первый)
  → wallet/HP из аккаунта, HQ органа если есть
```

### Смерть

```
playerDeath → hospitalized, HP 20
playerSpawn → больница, сообщение про /hospital
```

### Выход

```
persist queueSave → auth clear → spawn/hospital/admin/chat cleanup
```

---

## Команды игрока

Радиусы: чат /me /do /try /todo /b /r-пузырь — **20 м**; `/s` — **60 м**; `/w` — **5 м**.

| Команда | Что делает |
|---|---|
| `/help` | список игровых команд |
| `/mn` | меню |
| `/me` `/do` `/try` `/todo` | RP |
| `/b` | OOC рядом; после `/alogin`: `Administrator` |
| `/s` `/w` | крик / шёпот, в строке `[ID]` |
| `/stats` | диалог персонажа (в т.ч. почта) |
| `/pass` | паспорт рядом |
| `/hospital` | занять койку |
| `/gps` | метки |
| `/leaders` | лидеры (ранг 10) онлайн |
| `/r` | рация органа |

Неизвестная команда — сообщение. До логина — тишина.

---

## Админка

Права в БД: `admin_level`. Команды работают только после **`/alogin`** и если уровень достаточен. Иначе **тишина** (как неизвестная админ-команда). `/ahelp` показывает команды **только до своего уровня**.

Клик по карте: телепорт (и машина, если за рулём) для любого, кто в `/alogin`.

| Уровень | Команды |
|---|---|
| 1 | `/a`, `/ahelp`, `/admins`, `/slap [id]`, телепорт по карте |
| 2 | `/kick [id] [prichina]` — кик видят все; себя можно |
| 3 | `/ao [text]` — всем `Administrator Name[ID]:` |
| 4 | `/sethp [id] [0–100]`; чужому с активным `/alogin` нельзя; `/ban [id] [dni] [prichina]`; `/unban [Nick_Name]`; `/tpint [id]` |
| 5 | `/makeleader [id]` — список органов или снять; нужен паспорт; ранг 10; без телепорта |
| 6 | — |
| 7 | `/makeadmin [id] [0–7]` — сброс пароля админки, цель задаёт новый через диалог |

`/makeadmin 0` снимает админку. Повторная выдача снова сбрасывает пароль.

---

## Организации

Каталог в коде: `modules/org/catalog.ts`. Сейчас **армия id 1** (`army.ts`): цвет `0x9c7a4bff`, спавн HQ, 10 рангов/скинов/окладов (1500…9000).

Ворота: два объекта 19912, клавиша C пешком / сигнал в машине, только армия, автозакрытие ~5 с.

Ранги 1–9 выдаются только правкой БД: игровой команды кроме лидерки нет.

---

## Конфиг open.mp

| Ключ | Зачем |
|---|---|
| `name` / `game.mode` | как `shared/brand.ts` |
| `network.port` | 7777 |
| `max_players` | 50 |
| `node.resources` | `["resources"]` |
| `pawn.main_scripts` | `["lsrp 1"]` |
| `game.use_chat_radius` | `false` |
| `rcon.enable` | оставить `false`; пароль задать **до** включения, не коммитить |
| `announce` | мастерлист; для закрытого теста — `false` или `password` |
| `network.allow_037_clients` | `true` |

`bans.json` — только IP движка. Бан аккаунта: `users.banned_until` (**DATETIME** конца бана, не число дней) и `users.ban_reason`.

---

## Сборка и запуск

```powershell
copy .env.example .env
npm run build
npm run typecheck
npm start
```

Клиент: `127.0.0.1:7777`, ник `Name_Surname`. После `build` **рестарт**. `dist/` в git нет. Прод: [deploy.md](deploy.md).

---

## Куда что править

| Задача | Файл |
|---|---|
| Спавн / больничные точки | `modules/spawn/point.ts` |
| HP, интервалы сейва | `modules/auth/session.ts`, `persist` |
| Логин | `modules/auth/flow.ts` |
| Правила | `modules/auth/rules.ts` |
| Логотип | `modules/hud/index.ts` |
| Игровая команда | `modules/commands/*.ts` + `index.ts` |
| Админ-команда | `modules/admin/*.ts` + `catalog.ts` + `admin/index.ts` |
| Орган | новый файл + `org/catalog.ts` |
| Карта | `maps/*.txt` |
| Название | `brand.ts` + `config.json` |
| Схема | `sql/schema.sql` + `auth/repository.ts` |

---

## Проверка проекта

Просмотрены исходники `resources/src`, `config.json`, `sql/schema.sql`, `.gitignore`, деплой-доки. TypeScript `strict`, typecheck чистый.

### Что в порядке

- SQL с `?`, инъекции из ника/почты нет.
- Пароли игрока и админки — scrypt, не в логах.
- Команды и чат до логина закрыты.
- Админ-команды требуют `/alogin` + уровень.
- Сессия аккаунта сбрасывается на connect.
- Отложенный kick сверяет слот и ник (не кикает нового на том же id).
- Деньги в БД не берутся с клиента.
- Койка лечит только лежащего `hospitalized` в радиусе.
- `{` в IC/OOC/RP/админ-чате вырезается.
- `.env` и `dist/` не в git.

### Исправлено перед выкладкой

- Сейв денег с `getMoney()` (чит) → только `account.money`.
- Наследование сессии на слоте при connect.
- Kick по чужому слоту после 120 мс.
- Лечение с койки на улице.
- Цвет-коды в чате.
- Тестовый Sultan у вокзала убран.
- Из `config.json` убран захардкоженный RCON-пароль `changeme1` (RCON выключен, пароль пустой — задай свой, если включишь).

### Остаётся (не дыры логина, но знать)

- Нет антифлуда чата/команд.
- `/kick` 2-го уровня кикает любого, в том числе 7-го.
- `/alogin`: 3 ошибки — кик; после перезахода счётчик попыток снова 3 (на процесс — по `account.id`).
- Пароль игрока 6 символов без сложности.
- Карты без VW/interior; `setSpawnInfo` их не ставит (больница через `placeAt`).
- `/stats` показывает почту себе; деньги в статах из памяти аккаунта (это нормально после правки сейва).
- Несколько лидеров одного органа возможны: `/makeleader` не снимает предыдущего.
- Ранги 1–9 органа не выдаются игрой.
- Payday пропускает «AFK» при свёрнутом клиенте (~8 с без update).
- Ошибка миграции `users` логируется, сервер всё равно «стартует».
- Интервалы и пул MySQL на `resourceStop` не чистятся.
- Пароль регистрации в памяти `Pending` до подтверждения.
- Первый `/alogin` без хеша задаёт пароль админки — так задумано после `/makeadmin`; опасно, если `admin_level` выставить руками в SQL.
- `announce: true` — сервер может попасть в мастерлист.

### Не сделано в моде

Транспорт как система, дома, инвентарь, `/pm` `/report`, снятие/повышение рангов 1–9, hot-reload.

### Итог

Обойти логин, выполнить админ-команду без `/alogin` или проинъектить SQL штатным клиентом по коду нельзя. Деньги трейнером в БД больше не пишутся. Перед открытым пабликом: свой RCON (если нужен), пароль входа или `announce`, антифлуд, не светить `.env`.
