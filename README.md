# Vocal Pattern Trainer — GitHub Pages

Статический сайт с пианино (Tone.Sampler), офлайн-кешем через Service Worker и локальными сэмплами Salamander.

## Как запустить локально
1. Распакуй архив. В консоли перейди в папку `docs/`.
2. Запусти локальный сервер:
   - Windows (Anaconda/PowerShell):
     ```powershell
     py -m http.server 8000
     ```
     и открой `http://127.0.0.1:8000/`
   - Linux/macOS:
     ```bash
     python3 -m http.server 8000
     ```

> Нельзя открывать `index.html` как `file://` — браузер не даст грузить mp3 и SW не заведётся.

## Сэмплы (обязательно)
В папке `docs/salamander/` должны лежать mp3. Скачай их скриптом:
- Linux/macOS:
  ```bash
  bash scripts/get_salamander.sh
  ```
- Windows PowerShell:
  ```powershell
  ./scripts/get_salamander.ps1
  ```

Проверка: в браузере открой `http://127.0.0.1:8000/salamander/C4.mp3` — файл должен скачаться/проиграться.

## GitHub Pages
1. Создай репозиторий и положи всю папку `docs/` в корень репо.
2. В GitHub: **Settings → Pages → Branch: `main` → Folder: `/docs` → Save**.
3. Через минуту сайт будет доступен по адресу: `https://<user>.github.io/<repo>/`

## Обновления
При изменении файлов обновляй версию кеша в `sw.js` (например, `vocal-trainer-v2`), чтобы у клиентов обновился офлайн-контент.
