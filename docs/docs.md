# LSRP — документация

**Los Santos Role Play.** Игровой сервер [open.mp](https://open.mp), логика на **TypeScript** через **omp-node**. Клиент: SA-MP 0.3.7 или open.mp. Локально: `127.0.0.1:7777`.

Краткий старт — [README.md](../README.md). Выкладка на сервер — [deploy.md](deploy.md). Пайплайн деплоя — [deploy.yml](../deploy.yml) в корне. Здесь: архитектура, структура файлов, модули, база, команды, конфиг, потоки событий и результаты проверки кода.

`npm run typecheck` на момент этой документации проходит без ошибок.

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
9. [Конфиг open.mp](#конфиг-openmp)
10. [Сборка и запуск](#сборка-и-запуск)
11. [Куда что править](#куда-что-править)
12. [Проверка проекта](#проверка-проекта)

---

## Как устроен запуск

`npm start` из корня запускает `omp-server.exe`. Он читает `config.json` и поднимает **два независимых слоя**:

| Слой | Что грузит | Роль |
|---|---|---|
| Pawn | `gamemodes/lsrp.amx` (`pawn.main_scripts`: `lsrp 1`) | Пустышка ~304 байта. Нужна компоненту `Pawn.dll`. Логики нет. |
| Node | `resources/` → `resources/omp-node.json` → `dist/index.js` | Весь мод: логин, чат, HP, больница, HUD, карты. |

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

Сервер исполняет уже собранный JS. После правок исходников: `npm run build`, затем **рестарт** `omp-server.exe`. Hot-reload нет.

Цикл разработки: в одном терминале `npm run dev` (watch), сервер перезапускаешь вручную.

Ctrl+C иногда роняет встроенный Node в omp-node — это особенность рантайма, не бага мода. Если консоль зависла: закрыть окно и снова `npm start`.

Кириллица в консоли Windows часто кракозябрами; в `log.txt` текст нормальный.

---

## Дерево проекта

Корень `D:\OSPanel\home\samp\public` — рабочая директория `omp-server.exe` (`process.cwd()`). Отсюда читаются `.env`, `maps/`, `config.json`.

```
public/
  omp-server.exe                 бинарь open.mp
  libnode.dll                    Node для omp-node
  config.json                    настройки сервера
  bans.json                      IP-баны движка (сейчас [])
  .env / .env.example            доступ к MySQL (.env в .gitignore)
  package.json                   npm run build / dev / typecheck / start
  deploy.yml                     сборка и выкладка (GitHub Actions)
  README.md                      краткий старт
  docs/
    docs.md                      эта документация
    deploy.md                    как выкатить на VPS
  maps/                          карты: CreateObject / CreateDynamicObject
    jail.txt                     интерьер тюрьмы (координаты в небе)
  sql/schema.sql                 эталон таблицы users
  gamemodes/lsrp.amx             заглушка Pawn — не удалять, пока в config есть lsrp
  components/                    DLL: Pawn.dll, omp-node.dll, Objects.dll, …
  resources/
    omp-node.json                { "name": "lsrp", "entry": "dist/index.js" }
    package.json                 esbuild, tsc, mysql2, @omp-node/core
    tsconfig.json                strict, moduleResolution: bundler
    src/                         исходники (править здесь)
    dist/                        сборка (не править, в .gitignore)
    node_modules/
```

Папки `scriptfiles/` и `models/` текущему коду не нужны. `models/` понадобится для кастомных `.dff`/`.txd` (`config.json` → `artwork.models_path`).

**Не удалять:** `components/`, `omp-server.exe`, `libnode.dll`, `config.json`, `resources/`, `maps/`, `sql/`, `bans.json`, `gamemodes/lsrp.amx`.

---

## Исходники мода

Все правки — в `resources/src/`. Новая система: папка в `modules/`, импорт и запись в массив в `src/index.ts`.

```
resources/src/
  index.ts                       старт модулей по порядку
  shared/
    brand.ts                     SERVER_NAME, SERVER_TAG (= config.json)
    colors.ts                    цвета чата (RGBA как 0xRRGGBBAA)
    database.ts                  пул mysql2, парсер .env, query / execute
    nearby.ts                    локальный чат, радиусы, лимит 128
    player.ts                    id, имя, isPlayerActive
  modules/
    types.ts                     GameModule { name, start }
    database/                    SELECT 1 при старте
    persist/                     сейв HP/денег, урон в память, −1 HP / 15 мин
    auth/
      index.ts                   события connect / class / dialog
      flow.ts                    шаги логина и регистрации
      dialogs.ts                 показ диалогов, kickLater
      rules.ts                   текст правил регистрации
      repository.ts              SQL users + миграции колонок
      session.ts                 аккаунт в памяти, HP/деньги на игроке
      password.ts                scrypt
      validation.ts              ник, почта, пароль, дата рождения
      gender.ts                  male / female, подписи
      skins.ts                   списки скинов по полу
    spawn/
      index.ts                   Class, смерть → больница, F4
      point.ts                   DEFAULT_SPAWN, HOSPITAL_SPAWNS
    hud/                         логотип textdraw
    session/                     лог connect/disconnect (не путать с auth/session)
    chat/
      index.ts                   обычный чат
      talk.ts                    пузырь + анимация разговора
    commands/
      index.ts                   импорт команд + bind
      registry.ts                registerCommand / handleCommand
      help.ts me.ts do.ts try.ts todo.ts b.ts s.ts w.ts stats.ts
    mapping/
      index.ts                   чтение maps/*.txt
      pawn-map.ts                парсер CreateObject / материалы
```

Сборка: `esbuild` bundler, ESM, `packages=external` (mysql2 и `@omp-node/core` не бандлятся). Target ES2018.

---

## Порядок модулей

В `src/index.ts` порядок **важен**:

1. `database` — пул MySQL. Если нет — лог, дальше модули всё равно стартуют.
2. **`persist` до `auth`** — на disconnect сначала `queueSave` (HP/деньги), потом `endAuth` стирает сессию.
3. `auth` — таблица `users`, диалоги, сессия.
4. `spawn` — класс, обычный спавн, больница.
5. `hud` — логотип.
6. `session` — строки в лог.
7. `chat` — локальный чат.
8. `commands` — `/help` и остальные.
9. `mapping` — объекты из `maps/`.

События open.mp вызываются у всех подписчиков. Порядок регистрации = порядок `start()`.

---

## Модули

### database

`shared/database.ts` читает `.env` из **корня сервера**, не из `resources/`. Если переменная уже есть в окружении — файл её не перезаписывает.

Пул `mysql2`: `connectionLimit: 10`, `charset: utf8mb4`, `dateStrings: true` (даты как строки, без сдвига таймзоны).

Если `SELECT 1` падает — пул закрывается, `isDatabaseReady() === false`. Игрока на входе кикнет «База данных недоступна».

`closeDatabase()` в коде есть, на стопе сервера **не вызывается**.

### persist (`modules/persist/index.ts`)

Сохранение персонажа, не логин.

- `queueSave` — живые HP и деньги → память аккаунта → `UPDATE users SET health, money`.
- Выход с сервера — сразу.
- Раз в 3 минуты — все авторизованные (на случай краша).
- Раз в 15 минут −1 HP, пол **20**.
- Урон (`playerTakeDamage`) сразу в память; через 50 мс сверка с полоской.
- В спеке и при смерти **0 в БД не пишется** (`readLiveHealth` берёт запасное значение из аккаунта).

Константы в `modules/auth/session.ts`:

| Константа | Значение | Смысл |
|---|---|---|
| `MAX_HEALTH` | 100 | потолок HP |
| `MIN_HEALTH` | 20 | пол при естественном падении |
| `HOSPITAL_HEALTH` | 100 | после смерти |
| `STARTING_HEALTH` | 100 | новый персонаж |
| `HEALTH_DECAY_AMOUNT` | 1 | сколько снимать |
| `HEALTH_DECAY_MS` | 15 мин | как часто |
| `VITALS_SAVE_MS` | 3 мин | автосейв |

Деньги в мире читаются только в состояниях on-foot / driver / passenger. В спеке/смерти пишется последнее известное.

### auth

Ник **только с клиента** SA-MP. Формат `Name_Surname` (латиница, `John_Doe`), 5–24 символа. Регулярка: `^[A-Z][a-z]+_[A-Z][a-z]+$`.

**Нет аккаунта:** правила сервера (принять / отказаться) → почта → пароль (6–32, без пробелов) → повтор → дата `ДД.ММ.ГГГГ` (16–80 лет) → пол → скин → подтверждение. «Отказаться» на правилах — кик. «Назад» с почты снова открывает правила. Дальше «Назад» по шагам; с правил — кик «Ты не принял правила сервера.»

Текст правил: `modules/auth/rules.ts`.

**Есть аккаунт:** пароль. 3 ошибки — кик. Отмена диалога — кик.

До входа: спек, камера на точку спавна (`prepareAuthView`), чат глушится (`return false`), команды глотаются без ответа.

Пароль в БД: `scrypt:salt:key` (Node `crypto.scrypt`, ключ 32 байта, salt 16). Проверка `timingSafeEqual`. Почта в нижний регистр, уникальна вместе с ником.

Сессия: `Map<слот, Account>`. После каждого `await` к БД проверяется, что это всё ещё тот же id и ник (`isSamePlayer`).

Диалог авторизации: id **1** (`AUTH_DIALOG_ID`). Статистика: id **2**.

`ensureUsersTable` при старте: `CREATE TABLE IF NOT EXISTS` + `ALTER` для колонок `gender`, `money`, `donate`, `health`, если их нет на старой базе.

### spawn

Один `Class` (скин `DEFAULT_SPAWN_SKIN`, точка `DEFAULT_SPAWN`) с командой `255` (`NO_TEAM`). Если всех поставить в team 0, PvP не работает.

- Первый вход и без организации: `DEFAULT_SPAWN` в `point.ts`.
- Смерть: случайная точка из `HOSPITAL_SPAWNS`. Интерьер пока `0`. HP = 100, сразу в БД, сообщение «Ты очнулся в больнице.»
- F4 / class: если уже в мире и не wasted — `setSpawnInfo` на текущие XYZ, респавн, HP из аккаунта (не лечение до 100).
- `playerRequestSpawn` без аккаунта — отказ.
- Неавторизованный `playerSpawn` — снова спек и диалог.

**Координаты больницы:** `resources/src/modules/spawn/point.ts` → `HOSPITAL_SPAWNS` (`x, y, z, angle, interior, world`). Сейчас All Saints, Jefferson, 4 точки снаружи.

`writeSpawnInfo` вызывает `setSpawnInfo` и **не ставит interior/world** (натив SA-MP их не принимает). Для больницы после спавна вызывается `placeAt`. Для F4 interior/world из текущей позиции в `setSpawnInfo` тоже не попадают — пока все точки `interior: 0`, это незаметно.

### hud

Глобальные textdraw в правом верхнем углу: «LS» + «RP» + «Los Santos» + preview-модель 19066. Показ через 250 мс после connect, скрытие на disconnect.

Это не Pawno-скрипт: те же числа, API `new TextDraw(...)`. Правки — `modules/hud/index.ts`. Файл `.txt` из редактора Pawno сервер сам не грузит.

### chat

Обычный текст — **20 м**, тот же virtual world и interior. Пузырь над головой и анимация (`PED/IDLE_CHAT` или gangs, не в машине). Движок может нарисовать пузырь дальше 20 м; **в чат** дальние не получают.

Лимит **128** символов. `return false` глушит глобальный чат SA-MP.

`config.json` → `game.use_chat_radius: false` — радиус движка выключен, работает свой `sendNearby`.

Анимация снимается по таймеру (1.5–7 с от длины текста). На disconnect таймер чистится.

### commands

Новая команда: файл в `modules/commands/` + `import "./имя"` в `index.ts`. Неавторизованным обработчик не вызывается (тишина, без подсказки).

`playerCommandText` всегда возвращает `true` — Pawn команды не видит.

См. [таблицу команд](#команды-игрока).

### mapping

При старте читает `maps/*.txt`. Поддерживается:

- `CreateObject` / `CreateDynamicObject` (первые 7 аргументов: model, x, y, z, rx, ry, rz)
- `SetObjectMaterial` / `SetDynamicObjectMaterial`
- `SetObjectMaterialText` / `SetDynamicObjectMaterialText`
- строки `new …;` и `//` пропускаются
- `name = CreateDynamicObject(...)` — объект создаётся

**Не применяется:** streamer-аргументы VW, interior, stream distance. Объекты в мире 0, draw distance 300. Битый файл не валит остальные карты.

Сейчас: `maps/jail.txt` — интерьер в небе (~`-96, 2444, 1178`). Без телепорта туда игроки его не видят; отдельного входа в тюрьму в моде нет.

### session (лог)

Только строки в консоль/`log.txt`: подключился / отключился. Не путать с `auth/session.ts` (аккаунт в памяти).

---

## База данных

Драйвер `mysql2`, без ORM и без Prisma (нативный engine Prisma плохо живёт с esbuild + omp-node). Плейсхолдеры `?`, запросы не в игровом тике.

Таблица создаётся при старте. Эталон: `sql/schema.sql`.

| Колонка | Тип | Смысл |
|---|---|---|
| `id` | INT UNSIGNED AI | PK |
| `name` | VARCHAR(24) UNIQUE | ник с клиента |
| `email` | VARCHAR(255) UNIQUE | нижний регистр |
| `password_hash` | VARCHAR(255) | `scrypt:salt:key` |
| `gender` | ENUM male/female | пол |
| `skin` | SMALLINT UNSIGNED | модель |
| `level` | SMALLINT UNSIGNED, default 1 | сейчас всегда 1 |
| `money` | INT, default 0 | наличные; новый персонаж **500** |
| `donate` | INT UNSIGNED, default 0 | донат-счёт, сейчас 0 |
| `health` | FLOAT, default 100 | HP, новый персонаж **100** |
| `birth_date` | DATE | из регистрации |
| `created_at` | DATETIME | регистрация |

`.env.example`:

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=lsrp
```

На OSPanel хост часто имя сервиса (`MySQL-8.2`), не `127.0.0.1`. Базу `lsrp` нужно создать заранее (сервер таблицу создаст, саму БД — нет).

### Как должны жить HP и деньги

1. Регистрация: 100 HP, $500.
2. Вход: полоска и кэш из БД, не дефолт движка.
3. Урон / падение — HP в памяти; выход пишет в БД.
4. Перезаход — то же HP, что при выходе.
5. Раз в 15 мин −1 HP, не ниже 20.
6. Смерть: в БД не пишется 0. Больница → 100 HP в мир и в БД.
7. Деньги тем же `queueSave`. Экономики (работы, магазины) ещё нет.

---

## Потоки событий

### Подключение и вход

```
playerConnect
  → spectating on (сразу)
  → HUD: логотип через 250 мс
  → beginAuth через 500 мс
       ник не RP / нет БД → kick
       есть users.name → диалог пароля
       нет → правила → почта → … → INSERT → spawnIntoWorld
  → toggleSpectating(false) + spawn через 80 мс
playerSpawn (первый)
  → team 255, скин, applyWallet, applyHealth, «на спавне»
```

### Смерть

```
playerDeath
  → pickHospitalSpawn + setSpawnInfo
playerSpawn
  → placeAt(hospital), HP 100, queueSave, «очнулся в больнице»
```

### Выход

```
playerDisconnect (persist)  → queueSave HP/money
playerDisconnect (auth)     → clearPending + clearAccount
playerDisconnect (spawn)    → сброс hospital / first-spawn флагов
playerDisconnect (chat/hud) → таймеры анимации, скрыть логотип
```

---

## Команды игрока

Радиусы: обычный чат /me /do /try /todo /b — **20 м**; `/s` — **60 м**; `/w` — **5 м**. Лимит текста 128.

| Команда | Что делает |
|---|---|
| `/help` | список зарегистрированных команд |
| `/me [действие]` | `* Имя действие` |
| `/do [текст]` | обстановка + `(( Имя ))` |
| `/try [действие]` | 50/50 удачно/неудачно; «попытался/попыталась» по полу |
| `/todo реплика*действие` | `«реплика», — сказал(а) Имя, действие.` |
| `/b [текст]` | OOC рядом |
| `/s [текст]` | крик + пузырь 60 м |
| `/w [текст]` | шёпот + пузырь 5 м |
| `/stats` | диалог: имя, пол, уровень, скин, ДР, почта, деньги, донат, HP |

Неизвестная команда — сообщение в чат. До логина команды молча игнорируются.

---

## Конфиг open.mp

Важное из `config.json`:

| Ключ | Сейчас | Зачем |
|---|---|---|
| `name` / `game.mode` | Los Santos Role Play / LSRP | совпадать с `shared/brand.ts` |
| `network.port` | 7777 | клиент |
| `max_players` | 50 | слоты |
| `node.resources` | `["resources"]` | папка omp-node |
| `pawn.main_scripts` | `["lsrp 1"]` | заглушка AMX |
| `artwork.models_path` | `models` | кастомные модели позже |
| `game.use_chat_radius` | `false` | свой локальный чат |
| `rcon.enable` | `false` | RCON выключен |
| `rcon.password` | `changeme1` | смени, если включишь |
| `logging.file` | `log.txt` | лог |
| `announce` | `true` | мастерлист SA-MP |
| `network.allow_037_clients` | `true` | клиенты 0.3.7 |

`bans.json` — IP-баны движка. Свой бан в MySQL не сделан.

---

## Сборка и запуск

Из корня сервера:

```powershell
copy .env.example .env     # один раз, прописать MySQL
npm run build              # esbuild → resources/dist/index.js
npm run dev                # то же в watch
npm run typecheck          # tsc --noEmit
npm start                  # omp-server.exe
```

Клиент: `127.0.0.1:7777`, ник `Name_Surname`.

После `build` **перезапусти сервер**. `dist/` в git не коммитится. Прод и пайплайн: [deploy.md](deploy.md), [deploy.yml](../deploy.yml).

---

## Куда что править

| Задача | Файл |
|---|---|
| Точки больницы / обычный спавн | `modules/spawn/point.ts` |
| HP min/max, интервал падения, сейв | `modules/auth/session.ts` |
| Логика сейва и −HP | `modules/persist/index.ts` |
| Логика логина/регистрации | `modules/auth/flow.ts` |
| Тексты диалогов | `modules/auth/dialogs.ts` |
| Правила сервера (окно регистрации) | `modules/auth/rules.ts` |
| Скины регистрации | `modules/auth/skins.ts` |
| Правила ника/пароля/возраста | `modules/auth/validation.ts` |
| Логотип | `modules/hud/index.ts` |
| Новая команда | `modules/commands/*.ts` + `commands/index.ts` |
| Карта | `maps/*.txt` + рестарт |
| Название сервера | `shared/brand.ts` + `config.json` |
| Схема БД | `sql/schema.sql` и миграции в `auth/repository.ts` |
| Цвета чата | `shared/colors.ts` |

---

## Проверка проекта

Просмотрены все 37 файлов `resources/src/**/*.ts`, `config.json`, `sql/schema.sql`, маппинг, конфиг npm. Компилятор: чисто.

### Что сделано нормально

- Запросы параметризованы (`?`), SQL-инъекции из ника/почты/пароля нет.
- Пароли не хранятся открытым текстом; проверка с постоянным временем.
- После `await` проверяется, что слот всё ещё тот же игрок.
- До логина нельзя писать в чат и выполнять команды.
- 3 попытки пароля, кик.
- Ник жёстко RP-формат, не из диалога (нельзя зарегистрировать чужой ник другим именем клиента).
- Уникальность почты и ника на уровне БД + обработка `ER_DUP_ENTRY`.
- HP 0 при смерти в БД не пишется; больница лечит явно.
- `persist` подписан на disconnect раньше `auth` — сейв успевает до очистки сессии.
- Карта с ошибкой не валит остальные.
- `.env` в `.gitignore`.
- TypeScript `strict`.

### Ошибки и дыры (по серьёзности)

**1. RCON-пароль по умолчанию в `config.json`**

RCON выключен (`enable: false`), но пароль `changeme1`. Если кто-то включит RCON и забудет сменить — полный контроль над сервером. Перед продакшеном сменить и не светить в репозитории.

**2. Сервер в мастерлисте (`announce: true`)**

Локальный/тестовый сервер может попасть в публичный список. Для закрытой разработки лучше `false` или пароль на вход (`password` в конфиге).

**3. Карты без VW/interior**

Парсер берёт только model + координаты. Аргументы streamer после rz отбрасываются. Тюрьма висит в небе в мире 0; отдельного входа нет. Если позже понадобятся интерьеры/миры — дописать `setVirtualWorld` / `setInterior` у `ObjectMp` или аналог streamer.

**4. `setSpawnInfo` не знает interior/world**

`SpawnPoint` хранит `interior` и `world`, но `writeSpawnInfo` их не применяет. Больница спасается `placeAt` после спавна. F4 в будущем интерьере может выкинуть на те же XYZ в interior 0.

**5. `/stats` показывает почту и кэш денег из памяти**

Почта в диалоге — лишняя утечка, если кто-то смотрит в монитор. Деньги берутся из `account.money`, а HP — из живой полоски. Если деньги в мире изменились, а автосейв ещё не прошёл (до 3 мин), в статах может быть старое число.

**6. Цвет-коды в чате**

Текст `/me`, `/b`, обычный чат не фильтрует `{RRGGBB}`. Игрок может перекрашивать чужие строки. Имеет смысл вырезать `{` / `}` или паттерн `{[0-9A-Fa-f]{6}}`.

**7. Нет антифлуда**

Чат и команды без кулдауна. Можно спамить локальный чат и диалоги (проверка почты бьёт в БД). Для 50 слотов пока терпимо, для паблика — нет.

**8. Пароль в памяти на время регистрации**

В `Pending` поле `password` лежит открытым текстом до подтверждения. На disconnect чистится. Для игрового сервера нормально; в логи не пишется.

**9. Ошибка `ensureUsersTable` глотается**

Если `CREATE`/`ALTER` упал, в логе строка, сервер «готов». Игроки начнут логиниться и получат ошибку позже. Лучше не стартовать auth без успешной миграции.

**10. `closeDatabase` и `resourceStop` нет**

Пул MySQL и `setInterval` (сейв, −HP) не снимаются. При штатном рестарте процесс умирает целиком — на практике ок. При hot-reload (если появится) будут двойные таймеры и висящие соединения.

**11. Гонка регистрации**

`INSERT` уже прошёл, игрок вышел до `setAccount` — строка в БД есть, следующий вход будет логином. Это ожидаемо. Два клиента с одной почтой: второй получит «почта занята» или `ER_DUP_ENTRY`.

**12. `normalizeHealth`: HP ≤ 0 превращается в 100**

Битая строка в БД (0, NULL, мусор) лечит персонажа до 100 при входе. Нижняя граница 20 при логине **не** применяется: если в БД 15 — войдёт с 15, падение HP его не тронет, пока не станет > 20.

**13. Урон в `playerTakeDamage`**

Сразу пишется `getHealth() - amount`. Если движок уже вычел урон, значение занижается до сверки через 50 мс. Кратковременно статы/сейв могут увидеть чужое HP; через 50 мс обычно выравнивается. На disconnect в эти 50 мс теоретически можно записать чуть меньше.

**14. Команды до логина — тишина**

Игрок не понимает, что `/help` не работает, потому что нет аккаунта. Мелочь UX.

**15. Нет админ-бана в БД**

Только `bans.json` (IP). Смена IP — снова вход. Админки, варнов, ACL нет.

**16. Слабый пароль**

Достаточно 6 символов без пробелов, без цифр/регистра. Для RP-сервера часто так и делают; для паблика мало.

**17. Пустой пароль MySQL в примере**

`.env.example` с `root` без пароля — нормально для OSPanel. На VPS так оставлять нельзя.

### Не баги, а ещё не сделано

Нет: админка, транспорт, дома, инвентарь, работы, голод как шкала, сохранение брони, смена уровня/доната в игре, `/pm` `/report`, вход в тюрьму, hot-reload.

`level` и `donate` в БД и `/stats` есть, игровые системы их не меняют.

### Итог проверки

Каркас (логин, локальный чат, HP, больница, HUD, карты) собирается и по коду согласован. Критичных дыр уровня «обойти логин» или «SQL-инъекция» нет. Перед открытым сервером закрыть: RCON-пароль, `announce`, цвет-коды в чате, антифлуд, VW/interior у карт, не светить почту в `/stats`.
