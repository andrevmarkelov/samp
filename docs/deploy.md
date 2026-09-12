# Деплой LSRP на сервер

Как вынести сервер с локального OSPanel на VPS/выделенную машину: что нужно, как собрать мод, что копировать, как обновить.

Локальная разработка — [README.md](../README.md). Устройство мода — [docs.md](docs.md).

Пайплайн: [deploy.yml](../deploy.yml) в корне (сборка, typecheck, выкладка по SSH).

Сейчас дерево собрано под **Windows** (`omp-server.exe`, `*.dll`). На Linux те же файлы мода, но бинарники open.mp нужны **linux-сборки**, не `.exe`.

---

## Что должно быть на сервере

| Нужно | Зачем |
|---|---|
| open.mp (под ОС сервера) | `omp-server` / `omp-server.exe`, `libnode`, папка `components/` |
| **Node.js 18+** | сборка TS и `npm ci` в `resources/` |
| **MySQL 8** | таблица `users` |
| UDP **7777** (и TCP 7777, если включён artwork) | клиент SA-MP / open.mp |
| База `lsrp` и пользователь MySQL **не root без пароля** | `.env` |

omp-node крутит уже собранный `resources/dist/index.js`. Исходники `.ts` на проде для запуска не нужны, если собрал заранее.

`mysql2` и `@omp-node/core` **не бандлятся** в JS (`packages=external`). На сервере обязателен `resources/node_modules` после `npm ci`.

---

## Сборка мода

Из корня репозитория (локально или на сервере):

```powershell
cd resources
npm ci
cd ..
npm run typecheck
npm run build
```

Результат: `resources/dist/index.js` (и `.map`). Папка `dist/` в git **не лежит** — без `build` сервер поднимет пустой/старый мод.

После любой правки TS: снова `npm run build`, затем **рестарт** `omp-server`. Hot-reload нет.

---

## Что копировать на сервер

### Нужно

```
config.json
bans.json                 (можно пустой [])
gamemodes/lsrp.amx
components/               (DLL/SO под ОС сервера)
maps/
sql/schema.sql            (эталон, таблица ещё создаётся сама)
resources/omp-node.json
resources/package.json
resources/package-lock.json
resources/dist/           (после npm run build)
package.json              (скрипт start; на Linux см. ниже)
```

Плюс бинарники open.mp под ОС: `omp-server.exe` + `libnode.dll` (Windows) или `omp-server` + `libnode.so` (Linux).

`.env` **создай на сервере**, не копируй домашний.

### Не копировать

| Путь | Почему |
|---|---|
| `.env` | пароль БД с твоей машины |
| `.git/` | не нужен для запуска |
| `log.txt`, `*.log` | мусор |
| `resources/src/` | не нужен, если собрал `dist` у себя |
| `resources/node_modules/` | не тащи с Windows на Linux |
| `node_modules/` в корне | его нет / не нужен |

Если деплой через `git pull` на сервере — копировать ничего не надо: клонируй репо, собери там, поставь runtime-зависимости.

---

## Первый запуск на сервере

### 1. MySQL

```sql
CREATE DATABASE lsrp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lsrp'@'127.0.0.1' IDENTIFIED BY 'СИЛЬНЫЙ_ПАРОЛЬ';
GRANT ALL ON lsrp.* TO 'lsrp'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Таблица `users` создаётся при старте мода. Схему можно заранее накатить из `sql/schema.sql`.

### 2. `.env` в корне сервера (рядом с `omp-server`)

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=lsrp
MYSQL_PASSWORD=СИЛЬНЫЙ_ПАРОЛЬ
MYSQL_DATABASE=lsrp
```

Если MySQL на другом хосте — пиши его, не `127.0.0.1`. С машины сервера пользователь должен иметь право коннекта.

### 3. Зависимости Node (на сервере)

```powershell
cd resources
npm ci --omit=dev
```

`--omit=dev` ставит только `mysql2` и `@omp-node/core`. Если собираешь мод **на этом же сервере**, ставь полный `npm ci` (нужны esbuild и typescript).

Не копируй `node_modules` с Windows на Linux.

### 4. `config.json` на проде

Перед открытием игрокам:

- `rcon.password` — не `changeme1`; RCON лучше оставить `enable: false`
- `network.public_addr` — белый IP или домен, если за NAT
- `announce` — `true` только если нужен мастерлист
- `password` — пароль на вход, если сервер закрытый
- `name` / `game.mode` — как в `resources/src/shared/brand.ts` (после смены бренда — пересборка)

Порт: `network.port` (по умолчанию 7777). В файрволе: **UDP 7777**. TCP 7777 — для artwork, если `artwork.enable: true`.

### 5. Старт

Windows (как локально):

```powershell
npm start
```

или `omp-server.exe` из корня.

Linux: бинарь обычно `./omp-server` (права `chmod +x`). Скрипт `npm start` в корне заточен под `.exe` — на Linux запускай бинарь напрямую.

В логе должны быть `MySQL подключен`, `таблица users готова`, `LSRP готов`. Клиент: `IP:7777`, ник `Name_Surname`.

---

## Обновление мода (уже стоит)

1. Остановить `omp-server`.
2. Залить новые файлы (или `git pull`).
3. Собрать, если менялся TypeScript:

   ```powershell
   npm run build
   ```

4. Если менялись `resources/package.json` / lock — снова `cd resources && npm ci --omit=dev`.
5. Если менялись карты — залить `maps/*.txt`.
6. Запустить сервер.

Игрокам заходить заново. Сессии в памяти не переживают рестарт; HP/деньги к этому моменту должны быть в MySQL (выход и автосейв раз в 3 минуты).

---

## Два рабочих сценария

### A. Собрал дома, залил на сервер

На своей машине:

```powershell
npm run build
```

На сервер: `resources/dist/`, `maps/`, `config.json` (осторожно, не затри прод-настройки), при необходимости `gamemodes/`. На сервере один раз: `cd resources && npm ci --omit=dev`. Рестарт.

`resources/src` на прод можно не класть.

### B. Git на сервере (удобно для обновлений)

```bash
git clone <url> /opt/lsrp
cd /opt/lsrp
# поставить linux-бинари open.mp в этот каталог, если в репо только Windows
cd resources && npm ci && cd ..
npm run build
cd resources && npm ci --omit=dev && cd ..   # можно оставить полный ci
cp .env.example .env                         # прописать пароль
# поправить config.json
./omp-server                                 # или omp-server.exe
```

---

## Windows Server (служба)

Чтобы сервер не падал вместе с сессией RDP, повесь `omp-server.exe` на NSSM / WinSW, **Working directory** = корень проекта (там `.env` и `maps/`).

Пример NSSM:

```text
Path:           D:\lsrp\omp-server.exe
Startup dir:    D:\lsrp
```

Не запускай из другой папки: `.env` и `maps/` читаются из `cwd`.

---

## Linux (systemd)

Файл `/etc/systemd/system/lsrp.service` (путь к каталогу подставь свой):

```ini
[Unit]
Description=LSRP open.mp
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/lsrp
ExecStart=/opt/lsrp/omp-server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lsrp
sudo journalctl -u lsrp -f
```

Лог open.mp ещё пишется в `log.txt` в рабочем каталоге.

---

## GitHub Actions (`deploy.yml`)

Файл в корне: [deploy.yml](../deploy.yml).

Не ставит MySQL и не копирует `.env` / `config.json` — это один раз руками (см. выше). Пайплайн собирает мод и заливает `resources/dist` и `maps/`, затем рестартит службу `lsrp`, если она есть.

Секреты: репозиторий → **Settings → Secrets and variables → Actions**:

| Секрет | Пример |
|---|---|
| `DEPLOY_HOST` | `203.0.113.10` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | приватный ключ целиком |
| `DEPLOY_PATH` | `/opt/lsrp` |

SSH-порт в `deploy.yml` сейчас **22**. Другой порт — поправь `port:` в файле.

Запуск: **Actions → Deploy → Run workflow**, либо тег:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Без `DEPLOY_HOST` job выкладки пропускается, сборка всё равно проходит.

---

## Короткий чеклист

- [ ] MySQL: база, пользователь, пароль
- [ ] `.env` на сервере, не из домашнего ПК
- [ ] `npm run build` → есть `resources/dist/index.js`
- [ ] на сервере `resources/node_modules` через `npm ci --omit=dev` (не копировать с Windows на Linux)
- [ ] `gamemodes/lsrp.amx` и `components/` на месте
- [ ] `config.json`: RCON, announce, public_addr
- [ ] файрвол UDP 7777
- [ ] старт из **корня** проекта
- [ ] в логе MySQL и «LSRP готов»
- [ ] вход с клиента `Name_Surname`

---

## Частые ошибки

| Симптом | Что проверить |
|---|---|
| «База данных недоступна» | `.env`, хост MySQL, пользователь, что сервер стартовали из корня |
| Модули не грузятся / старый код | забыл `npm run build` или не перезапустил процесс |
| `Cannot find package mysql2` | нет `resources/node_modules`, нужен `npm ci --omit=dev` |
| Не стартует на Linux | залит Windows `.exe` / `.dll`; нужны linux-бинари open.mp |
| Игроки не видят сервер | UDP 7777, `public_addr`, `announce` |
| Кик за ник | клиент должен быть `Name_Surname`, латиница |
