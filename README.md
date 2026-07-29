# Dom2

Статическое веб-приложение с калькуляторами Domian. Единственный production-источник находится в каталоге [`pub/domian-calculator-a4/`](pub/domian-calculator-a4/).

## Локальный запуск

Нужен Node.js 24 или новее.

```powershell
npm run serve
```

После запуска приложение доступно по адресу <http://127.0.0.1:4173/>.

## Проверки

```powershell
npm run check
```

Команда проверяет синтаксис всех production-JS, запускает обязательные unit-тесты и проверяет относительные ссылки и ресурсы во всех production-HTML.

Два диагностических теста, фиксирующих известные проблемы бизнес-логики из аудита 2026-07-27, запускаются отдельно:

```powershell
npm run test:known-failures
```

Они намеренно не входят в обязательный CI: очистка репозитория не меняет расчёты и не подменяет ожидаемые значения ради PASS. Контекст сохранён в [`docs/audits/`](docs/audits/).

## Публикация

GitHub Actions запускает тесты для pull request и push. После успешных тестов ветки `main` workflow Pages публикует только содержимое `pub/domian-calculator-a4/` как корень сайта.

- Production: <https://lesauteur.github.io/Dom2/>
- Калькулятор мотивации: <https://lesauteur.github.io/Dom2/motivation-calculator.html>

Данные приложения в `localStorage` остаются только в конкретном браузере пользователя. GitHub Pages и репозиторий их не получают.
