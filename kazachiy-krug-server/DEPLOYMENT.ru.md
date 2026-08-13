# Перенос backend на VPS

## Где должна находиться база данных

Для первого запуска PostgreSQL лучше создать **на том же VPS**, но в отдельном Docker-контейнере. Backend обращается к ней по внутренней Docker-сети по имени `postgres`; порт базы не публикуется в интернет. Данные находятся не внутри временного контейнера, а в постоянном томе `postgres_data`.

Это проще и дешевле отдельного сервера БД. Когда нагрузка или требования к отказоустойчивости вырастут, PostgreSQL можно перенести в управляемую БД, поменяв только `DATABASE_URL`.

Не следует создавать новую пустую схему вручную через веб-панель хостинга. Compose создаст саму базу, а `prisma migrate deploy` создаст таблицы по версиям миграций.

## Схема для трёх сайтов

Три сайта могут использовать один backend:

```text
site-1.ru -----------\
site-2.ru ------------> https://api.example.ru -> Nginx/Caddy -> 127.0.0.1:3000
admin.example.ru ----/                                  |
                                                        +-> PostgreSQL (private)
                                                        +-> uploads_data
```

В `CORS_ORIGINS` перечисляются **точные** адреса всех трёх сайтов через запятую:

```dotenv
CORS_ORIGINS=https://site-1.ru,https://site-2.ru,https://admin.example.ru
```

Админка не должна получать особый доступ только из-за своего домена. Для неё нужны серверные роли (`admin`, `moderator`), проверяемые backend на каждом административном запросе. CORS не является авторизацией.

## Что подготовить до покупки VPS

1. Определить домены frontend, админки и API.
2. Сделать полноценную аутентификацию: подтверждение телефона, access/refresh tokens и выход со всех устройств.
3. Добавить роли и отдельные защищённые `/admin/*` методы. Не давать frontend прямой доступ к PostgreSQL.
4. Решить, переносятся ли существующие данные. Сейчас часть fallback-данных находится в памяти/исходниках и не заменяет production-БД.
5. Проверить, какие файлы из текущего `uploads/` действительно нужны, и подготовить их перенос.
6. Подготовить политику резервного копирования и проверить тестовое восстановление.

## Рекомендуемый VPS

Для начального запуска одного backend, PostgreSQL и reverse proxy обычно достаточно Linux VPS с 2 vCPU, 4 GB RAM и 40–80 GB SSD. Конкретный размер зависит от количества медиа и одновременных Socket.IO/WebRTC-сессий. Выбирайте Ubuntu 24.04 LTS или другую поддерживаемую LTS-систему, ежедневные snapshots и возможность увеличить диск.

## Первичная настройка VPS

1. Создать отдельного пользователя с `sudo`, вход только по SSH-ключу; запретить парольный SSH и root-login.
2. Обновить систему и установить Docker Engine с Compose plugin из официального репозитория Docker.
3. В firewall открыть только `22/tcp`, `80/tcp` и `443/tcp`. Порты `3000` и `5432` не открывать.
4. Направить DNS-запись API-домена на IP VPS.
5. Установить Nginx или Caddy, выпустить TLS-сертификат и проксировать HTTP и WebSocket на `127.0.0.1:3000`.

Пример существенной части Nginx-конфигурации:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Первый запуск

В каталоге `kazachiy-krug-server` создать `.env`, который не отправляется в Git:

```dotenv
POSTGRES_PASSWORD=<длинный случайный пароль>
CORS_ORIGINS=https://site-1.ru,https://site-2.ru,https://admin.example.ru
TRUST_PROXY=true
BACKEND_PORT=3000
```

Затем выполнить:

```bash
docker compose build backend
docker compose up -d postgres
docker compose run --rm backend npm run migrate:deploy
docker compose up -d backend
curl --fail http://127.0.0.1:3000/health/live
curl --fail http://127.0.0.1:3000/health/ready
```

Seed-команды нельзя автоматически выполнять при каждом production-релизе: они могут создать демонстрационные или повторные данные. Если нужна начальная административная учётная запись, следует сделать отдельную идемпотентную команду bootstrap и запускать её один раз.

## Перенос существующей PostgreSQL

Если текущая БД содержит необходимые данные:

```bash
# На исходной машине
pg_dump --format=custom --no-owner --file=messenger.dump "$DATABASE_URL"

# После безопасной передачи messenger.dump на VPS
docker compose exec -T postgres pg_restore \
  --username=postgres --dbname=kazachiy_krug --clean --if-exists \
  < messenger.dump
docker compose run --rm backend npm run migrate:deploy
```

Перед импортом остановить запись в старую систему либо включить короткое окно обслуживания, иначе последние сообщения могут потеряться. Версии PostgreSQL для dump/restore должны быть совместимы. Сначала обязательно проверить восстановление на тестовой копии.

Файлы загружаются отдельно в том `uploads_data`. Для долгосрочной эксплуатации лучше перейти на S3-совместимое хранилище: тогда файлы не привязаны к одному VPS.

## Обновления и откат

Обычный релиз:

```bash
git pull --ff-only
docker compose build backend
docker compose run --rm backend npm run migrate:deploy
docker compose up -d backend
docker compose ps
docker compose logs --tail=200 backend
```

Перед миграцией сделать backup. Не каждая миграция БД обратима, поэтому откат — это не только запуск старого Docker-образа, но иногда и восстановление дампа.

## Резервные копии и наблюдение

- Ежедневно сохранять `pg_dump`, копии медиа и секретов вне VPS.
- Хранить несколько дневных и недельных копий и регулярно проверять восстановление.
- Следить за `/health/ready`, свободным диском, RAM, CPU, ошибками приложения и сроком TLS-сертификата.
- Настроить ротацию Docker/Nginx-логов, чтобы они не заполнили диск.
- Не считать snapshot VPS единственной резервной копией.

## Что менять во frontend

Production-сборкам каждого сайта нужно передавать один публичный API-адрес:

```dotenv
VITE_API_URL=https://api.example.ru
VITE_SOCKET_URL=https://api.example.ru
```

Не помещать пароль БД, JWT secret или другие серверные секреты в переменные `VITE_*`: они попадают в JavaScript пользователя. Frontend и админку можно размещать отдельно как статические сборки; обращаться к PostgreSQL они должны только через backend