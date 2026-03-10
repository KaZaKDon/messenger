diff --git a/README.md b/README.md
index d613fd8367429a0913ab3b49d8996e8c1e14ab5f..7e4037a742ebb8772a353a7c7c04f5af2829bb21 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,14 @@
 # messenger
-messenger
+
+Monorepo:
+- `kazachiy-krug` — frontend (React + Vite)
+- `kazachiy-krug-server` — backend (Express + Socket.IO + Prisma)
+
+## Realtime media foundation (Этап 1)
+
+Для подготовки голосовых сообщений и аудио/видео звонков добавлена базовая модель БД:
+- `Message.type` — тип сообщения (`text|media|service`)
+- `MessageAttachment` — вложения сообщений (audio/video/image/file + metadata)
+- `CallSession` — сессии звонков (audio/video, status lifecycle, duration)
+
+Это этап подготовки контрактов и хранения. Реальные voice notes и WebRTC signaling добавляются на следующих этапах.
