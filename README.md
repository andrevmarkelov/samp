# Los Santos Role Play (LSRP)

open.mp сервер. Игровой код — TypeScript в `resources/src`. Папку `resources/dist` не трогай: она собирается сама.

Полная документация: [docs/docs.md](docs/docs.md).

Выкладка на VPS: [docs/deploy.md](docs/deploy.md). Пайплайн: [deploy.yml](deploy.yml).

## Где писать

```
resources/src/
  index.ts                 подключает модули
  shared/                  название сервера, цвета, MySQL, хелперы
  modules/
    database/              подключение MySQL
    auth/                  регистрация и авторизация (диалоги)
    persist/               сохранение HP и денег, медленное падение здоровья
    spawn/                 класс, обычный спавн, больница после смерти
    hospital/              интерьер больницы, койки
    cityhall/              паспорт, инвайт
    miner/                 шахта
    gps/ afk/ payday/ worldtime/ zones/
    hud/                   логотип textdraw «Los Santos RP»
    session/               лог входа / выхода
    chat/                  локальный чат
    commands/              /help /mn /me /do /try /todo /b /s /w /stats /pass /hospital /gps /leaders /r
    admin/                 /alogin и админ-команды
    org/                   организации (армия), ворота
    mapping/               maps/*.txt
```

Новая система = новая папка в `modules`, затем импорт в `src/index.ts`.

Новая команда = файл в `modules/commands` по образцу `me.ts` (`registerCommand`), затем `import "./имя"` в `modules/commands/index.ts`.

Маппинг: клади `.txt` с `CreateDynamicObject` / `CreateObject` в папку `maps` в корне сервера и перезапусти. Сейчас: `jail.txt`, `hospital.txt`, `mine.txt`, `army.txt`. Ворота армии в коде (`org/gates.ts`), в `army.txt` их не дублировать.

Обычный чат — 20 м, `/w` шёпот — 5 м, `/s` крик — 60 м. В чате и пузырём над головой. Дальние игроки не видят. Лимит 128 символов.

После смерти игрок оживает в одной больнице, случайно на одной из нескольких точек. Первый вход и без организации — `DEFAULT_SPAWN` в `modules/spawn/point.ts`. Интерьер пока `0`.

При входе в правом верхнем углу — логотип **Los Santos RP** (`modules/hud/index.ts`).

`gamemodes/lsrp.amx` — заглушка Pawn, логика в TS.

Название в `shared/brand.ts` должно совпадать с `config.json` (`name` и `game.mode`).

## Аккаунт

Ник берётся из SA-MP имени: формат `Name_Surname` (например `John_Doe`).

- Нет аккаунта: правила (принять / отказаться) → почта → пароль → повтор пароля → дата рождения (`ДД.ММ.ГГГГ`, от 16 лет) → пол (мужской / женский) → скин → подтверждение. Отказ от правил — кик. Текст правил: `resources/src/modules/auth/rules.ts`.
- Есть аккаунт: только пароль. Три ошибки — кик.

Пароль в базе хранится как scrypt-хэш, не открытым текстом. Пол — `users.gender` (`male` / `female`). Деньги — `users.money`, донат-счёт — `users.donate`, здоровье — `users.health` (колонки добавляются сами, если их ещё нет). Новому персонажу — 100 HP. При входе полоска восстанавливается из БД. Раз в 15 минут −1 HP, не ниже 20. После смерти в больнице снова 100. Сохранение: выход, раз в 3 минуты, больница. До входа игрок в спеке, чат и команды закрыты.

Таблица `users` создаётся сама при старте. Схема также лежит в `sql/schema.sql`.

## MySQL

Скопируй `.env.example` в `.env` и пропиши доступ к базе. На старте сервер делает `SELECT 1`.

```powershell
copy .env.example .env
```

Драйвер — `mysql2` (чистый JS, без Prisma). Запросы не ставь в игровой тик: логин, сохранение персонажа, инвентарь — по событию.

## Команды

Из корня `D:\OSPanel\home\samp\public`:

```powershell
npm run build      # собрать JS
npm run dev        # сборка при каждом сохранении
npm run typecheck  # проверка типов
npm start          # запустить omp-server.exe
```

После `build` **перезапусти сервер**. Hot-reload пока нет: окно сервера закрыл → `npm start` → зашёл на `127.0.0.1:7777`.

Удобный цикл: в одном терминале `npm run dev`, сервер перезапускаешь вручную после правок.
