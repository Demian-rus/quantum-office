# Updates and file safety

## Состояние 24.11.2026
Windows x64 Setup NSIS и Portable реализованы, PR #157 merged; CI main проверил установку, обычный перезапуск, переустановку и Portable. Версия 0.4.0; приложения пока обновляются вручную новым установщиком поверх старого при закрытом приложении и после проверенной резервной копии. Не удалять пользовательский каталог %APPDATA%/com.quantumoffice.desktop; банк и черновики хранятся отдельно от бинарников. Portable требует установленный WebView2. Не считать подписанный автообновляемый релиз готовым: проверка обновлений, подпись, каналы stable/test, резервная копия и миграция/rollback — дальнейший отдельный этап. Pages сейчас не настроен, автономный HTML и Windows-артефакты берутся из CI.
Историческая запись ниже сохранена для контекста; её утверждение о будущем desktop installer больше не актуально.

During development, GitHub Pages serves the preview from main after CI; offline index.html is also available.
A separate desktop installation and signed auto-updater are future milestones. Tauri must use verified signed artifacts, a protected signing key, and migration/rollback tests. Never place user documents inside the application install directory. Preview and local file:// browser storage do not share origins.
