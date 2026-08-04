(function (root) {
  'use strict';

  var advertisingPoints = [
    ['Статус «Стажёр»', '1 балл'],
    ['Статус «Партнёр»', '3 балла'],
    ['Растяжка с офисным номером на продающемся объекте', '3 балла'],
    ['Растяжка с рабочим номером агента на продающемся объекте', '2 балла'],
    ['Растяжка с рабочим номером агента на другом объекте', '1 балл'],
    ['Эксклюзивный договор', '5 баллов'],
    ['Возмездный договор', '2 балла'],
    ['Работа в офисе: по 1 баллу за неделю', 'от 1 до 4 баллов'],
    ['Новый агент прошёл обучение', '10 баллов'],
    ['Первый задаток приведённого агента', '10 баллов'],
    ['Наставничество до третьего задатка стажёра', '3 балла'],
    ['Посещение собрания в офисе', '+1 / −1 балл'],
    ['Задаток с участием одного агента', '5 баллов'],
    ['Задаток с участием двух агентов', '3 балла'],
    ['Задаток с участием трёх агентов', '2 балла'],
    ['Задаток с участием четырёх агентов', '1 балл'],
    ['Лучший агент офиса по итогам месяца', '5 баллов'],
    ['Член Совета офиса', '5 баллов']
  ];

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value) {
    return Math.round(Number(value) || 0).toLocaleString('ru-RU') + ' ₽';
  }

  function getPolicy() {
    return root.MOTIVATION_POLICY_2026 || null;
  }

  function packageTransition(packageItem) {
    if (packageItem.id === 'newcomer') {
      return 'Начало работы в статусе стажёра.';
    }
    if (packageItem.id === 'standard') {
      return 'Базовый пакет после перехода в партнёры.';
    }
    return packageItem.performanceLevel + '-й уровень за полугодие или непрерывный стаж от '
      + Math.round(packageItem.tenureMonths / 12) + ' ' + (packageItem.tenureMonths === 12 ? 'года' : 'лет') + '.';
  }

  function eligibleBenefits(packageItem) {
    var policy = getPolicy();
    var engine = root.BenefitEngine;
    var highestQuarter;
    var result;

    if (!policy || !engine || typeof engine.calculateBenefits !== 'function') {
      return [];
    }

    highestQuarter = policy.quarterLevels[policy.quarterLevels.length - 1];
    result = engine.calculateBenefits({
      decision: { effectivePackage: packageItem.id },
      quarterDeposits: policy.partnershipQuarterDeposits,
      quarterlyCommission: highestQuarter.threshold,
      previousMonthDeposits: policy.individualAdvertisingLimit / policy.individualAdvertisingRate,
      halfYearLevel: 7,
      officePlanCompleted: true,
      agentParticipated: true,
      travelQuarterPartnershipConfirmed: true,
      mountainSeaCost: 1,
      travelCost: 1,
      corporateCost: 1
    });

    return result.items.filter(function (item) {
      return item.available;
    });
  }

  function payerLabel(item) {
    if (item.payer === 'agent') {
      return 'оплачивает агент';
    }
    if (item.id === 'leadGeneration' && item.amountStatus === 'external-schedule') {
      return 'за счёт офиса; объём по действующей бонусной сетке';
    }
    return 'оплачивает офис';
  }

  function renderPackageCards() {
    var policy = getPolicy();
    if (!policy) {
      return '';
    }

    return '<div class="instruction-package-grid">' + policy.packages.map(function (packageItem) {
      var benefits = eligibleBenefits(packageItem);
      return '<article class="instruction-package-card">'
        + '<h4><span>' + escapeHtml(packageItem.label) + '</span><span>'
        + escapeHtml(packageItem.floorRate) + '–' + escapeHtml(packageItem.maxRate) + '%</span></h4>'
        + '<p><b>' + (packageItem.status === 'trainee' ? 'Стажёр.' : 'Партнёр.') + '</b> '
        + escapeHtml(packageTransition(packageItem)) + '</p>'
        + '<ul>' + benefits.map(function (item) {
          return '<li>' + escapeHtml(item.label) + ' — ' + escapeHtml(payerLabel(item)) + '.</li>';
        }).join('') + '</ul>'
        + '</article>';
    }).join('') + '</div>';
  }

  function renderLevelDetails() {
    var policy = getPolicy();
    if (!policy) {
      return '';
    }

    return '<details class="instruction-inner-details">'
      + '<summary>Пороговые значения личных уровней</summary>'
      + '<div class="instruction-inner-details__content">'
      + '<p>Квартальный уровень определяется по заработанной агентом комиссии; полугодовой — по сумме за два квартала. Значения берутся из действующей конфигурации калькулятора.</p>'
      + '<h4>Квартал и стипендия следующего квартала</h4>'
      + '<div class="instruction-level-grid">' + policy.quarterLevels.map(function (item) {
        return '<div><span>Уровень ' + item.level + ' — от ' + money(item.threshold) + '</span><b>'
          + (item.stipendMonthly ? money(item.stipendMonthly) + ' в месяц' : 'без стипендии') + '</b></div>';
      }).join('') + '</div>'
      + '<h4>Полугодие</h4>'
      + '<div class="instruction-level-grid">' + policy.halfYearLevels.map(function (item) {
        return '<div><span>Уровень ' + item.level + '</span><b>от ' + money(item.threshold) + '</b></div>';
      }).join('') + '</div>'
      + '</div></details>';
  }

  function renderDocuments() {
    var config = root.DOMIAN_SITE_CONFIG || {};
    var documents = config.DOCUMENTS || {};
    var items = [documents.advertising, documents.motivation2026].filter(Boolean);

    return '<section class="instruction-documents"><h3>Оригиналы действующих документов</h3>'
      + '<p>Откройте первоисточник, если требуется полная формулировка правила или подтверждающие приложения.</p>'
      + '<div class="instruction-doc-links">' + items.map(function (item) {
        return '<a class="instruction-doc-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">'
          + escapeHtml(item.label) + '</a>';
      }).join('') + '</div></section>';
  }

  function renderAdvertisingPoints() {
    return '<details class="instruction-inner-details">'
      + '<summary>Полная сетка начисления баллов</summary>'
      + '<div class="instruction-inner-details__content">'
      + '<div class="instruction-point-grid">' + advertisingPoints.map(function (item) {
        return '<div><span>' + escapeHtml(item[0]) + '</span><b>' + escapeHtml(item[1]) + '</b></div>';
      }).join('') + '</div>'
      + '<p><small>Для ежедневной работы документ уточняет: стажёр работает в офисе не менее 4 часов, партнёр — не менее 2 часов. Если в задатке участвуют агенты разных офисов, применяется порядок работы с другим агентством.</small></p>'
      + '</div></details>';
  }

  function renderAdvertisingGuide() {
    var config = root.DOMIAN_SITE_CONFIG || {};
    var pointRubles = Number(config.ADVERTISING_POINT_RUBLES) || 350;
    return '<section class="instruction-block">'
      + '<h3>Как получить и использовать рекламные возможности</h3>'
      + '<div class="instruction-grid">'
      + '<div><h4>Кто участвует</h4><ul>'
      + '<li>Программа доступна только агентам с зарегистрированным в CRM рабочим номером.</li>'
      + '<li>Баллы стажёра получает администратор или лид-менеджер офиса и использует для лидогенерации под объекты стажёра.</li>'
      + '<li>Партнёр выбирает площадки; размещение на Авито, Циан, ДомКлик и других сервисах идёт через кабинет компании.</li>'
      + '</ul></div>'
      + '<div><h4>Период и подтверждение</h4><ul>'
      + '<li>Действия текущего месяца дают баллы для рекламы в следующем месяце.</li>'
      + '<li>Администратор или руководитель фиксирует статус, посещаемость, договоры, задатки и фотоотчёты. Агент передаёт подтверждения за прошлый месяц не позднее первого числа; опоздавшие данные переходят на следующий месяц.</li>'
      + '<li>До 3-го числа общая таблица баллов публикуется в группе офиса. Затем агент письменно сообщает администратору или руководителю, на каких площадках распределить возможности.</li>'
      + '<li>Для офисов Орлова администратор до 5-го числа направляет утверждённую форму в Технический отдел; далее размещения начисляются через кабинет агента.</li>'
      + '</ul></div>'
      + '</div>'
      + '<div class="instruction-note"><h4>Фото растяжки</h4><p>На фото должны быть видны растяжка и признаки, позволяющие определить объект; вместе с фото передаётся адрес или ориентир. Фото окна или забора без понятного местоположения не принимается. Для личной растяжки используется рабочий номер, зарегистрированный в CRM; стоимость самой растяжки не компенсируется.</p></div>'
      + '<div class="instruction-note"><h4>Денежный эквивалент</h4><p>Действующее значение по уточнению собственника: <b>1 балл = ' + money(pointRubles) + '</b>. Калькулятор показывает это правило справочно и не ведёт отдельный расчёт рекламных баллов.</p></div>'
      + renderAdvertisingPoints()
      + '</section>';
  }

  function renderCareer() {
    var policy = getPolicy();
    var threshold = policy ? money(policy.partnershipQuarterDeposits) : '250 000 ₽';
    return '<details class="section-instructions">'
      + '<summary>Как пользоваться разделом и действующими правилами</summary>'
      + '<div class="section-instructions__content">'
      + '<p class="section-instructions__lead">Раздел «Карьера» хранит отдельные профили сотрудников и подбирает действующий пакет по двум основаниям: подтверждённому результату за полугодие и непрерывному стажу. Итог можно сохранить и затем вручную выбрать у агента в A4.</p>'
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Порядок работы</h3><ol>'
      + '<li>Нажмите «Новый» или выберите сохранённый профиль слева.</li>'
      + '<li>Укажите имя, статус, дату начала непрерывной работы и, для партнёра, дату перехода в партнёры. Договорный минимум и комментарий заполняйте только при необходимости.</li>'
      + '<li>Задайте дату оценки, прошлый пакет по результатам, подтвердите или не подтвердите полугодие и выберите достигнутый уровень.</li>'
      + '<li>Для мотиваций внесите задатки и заработок за квартал, задатки прошлого месяца, участие в акциях и фактическую стоимость программ.</li>'
      + '<li>Проверьте автоматический пакет, минимальный процент, доступность и плательщика мотиваций; затем нажмите «Сохранить пакет и мотивации».</li>'
      + '</ol></section>'
      + '<section class="instruction-block"><h3>Стажёр и партнёр</h3><p><b>Стажёр</b> работает в пакете «Новичок»: результативный пакет и партнёрские бонусы к нему ещё не применяются. <b>Партнёр</b> начинает со «Стандарта» и может перейти выше по результату или стажу.</p>'
      + '<p>Для любых партнёрских бонусов требуется не менее <b>' + threshold + ' задатков за квартал</b>. Этот порог влияет на мотивации, но не отменяет гарантированный минимальный процент пакета.</p></section>'
      + '</div>'
      + '<section class="instruction-block"><h3>Пакеты, проценты и мотивации</h3>' + renderPackageCards() + '</section>'
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Как меняется пакет и процент</h3><ul>'
      + '<li>Повышение возможно по подтверждённому уровню за полугодие или при достижении стажевого порога; калькулятор выбирает более высокий результат.</li>'
      + '<li>Если результат ниже текущего результативного пакета, он снижается не более чем на одну ступень (5%) за полугодие.</li>'
      + '<li>Пакет и минимальный процент, достигнутые по стажу, гарантированы и из-за снижения результата не понижаются.</li>'
      + '<li>Фактический процент сделки может быть выше минимума пакета по действующей шкале; договорный минимум также имеет приоритет, если он выше.</li>'
      + '</ul></section>'
      + '<section class="instruction-block"><h3>Уровни и рефералы</h3><p>На странице используются личные квартальные и полугодовые показатели. Годовой бизнес-уровень собственника здесь не определяется.</p>'
      + '<p>Реферальная выплата в этом разделе не рассчитывается. В A4 и ведомости признак приведённого агента добавляет 2,5% от комиссионного вознаграждения компании по его сделке. По документу право действует, пока пригласивший сотрудник работает в компании и подтверждает партнёрство; программа не относится к HR.</p></section>'
      + '</div>'
      + renderLevelDetails()
      + '<section class="instruction-note"><h3>Что считается автоматически</h3><p>После ввода данных калькулятор сам определяет стаж, пакет по стажу, пакет по результату, итоговый пакет, гарантированный минимум процента, квартальный уровень, доступные мотивации и расходы офиса/агента. Профили сохраняются отдельно и не перезаписывают месяцы A4.</p></section>'
      + renderDocuments()
      + '</div></details>';
  }

  function renderMotivation() {
    var policy = getPolicy();
    var threshold = policy ? money(policy.partnershipQuarterDeposits) : '250 000 ₽';
    return '<details class="section-instructions">'
      + '<summary>Как пользоваться разделом и действующими правилами</summary>'
      + '<div class="section-instructions__content">'
      + '<p class="section-instructions__lead">«Мотивация 2026» показывает экономику офиса с учётом карьерного пакета агента: выплату агенту, мотивации за счёт офиса и агента, роялти, долю общих расходов и остаток офису. Базовая и расширенная модели дополняют друг друга, а не заменяют одна другую.</p>'
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Что вводить</h3><ol>'
      + '<li>Выберите месяц расчёта и внесите постоянные расходы офиса.</li>'
      + '<li>Добавьте агента, выберите пакет и введите каждую сделку либо общую комиссию и количество сделок.</li>'
      + '<li>В «Условиях получения мотиваций» укажите задатки и результат за квартал, результат за полугодие, задатки прошлого месяца, выполнение плана и участие агента.</li>'
      + '<li>В дополнительных параметрах при необходимости задайте договорный минимум и фактическую стоимость поездок/корпоративов.</li>'
      + '</ol></section>'
      + '<section class="instruction-block"><h3>Задатки и сделки — не одно и то же</h3><ul>'
      + '<li><b>По задаткам</b> проверяется порог партнёрских бонусов ' + threshold + ' за квартал и рассчитывается реклама «Индивидуального» пакета — 3% от задатков прошлого месяца, максимум 15 000 ₽.</li>'
      + '<li><b>По сделкам и комиссии</b> определяется выплата агенту; результат квартала задаёт личный уровень и стипендию следующего квартала, а сумма двух кварталов — полугодовой уровень и право на «Путешествуй».</li>'
      + '<li>Рекламные баллы по отдельному документу этот калькулятор не начисляет и в рубли не переводит.</li>'
      + '</ul></section>'
      + '</div>'
      + '<section class="instruction-block"><h3>Пакеты и плательщики</h3>' + renderPackageCards() + '</section>'
      + renderLevelDetails()
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Периоды результата</h3><ul>'
      + '<li><b>Квартал:</b> заработок агента задаёт уровень и ежемесячную стипендию в следующем квартале; задатки подтверждают право партнёра на бонусы.</li>'
      + '<li><b>Полугодие:</b> два квартала суммируются; уровень влияет на пакет по результату и право на «Путешествуй» с 4-го уровня при остальных выполненных условиях.</li>'
      + '<li><b>Год:</b> документ отдельно предусматривает личный годовой итог и бизнес-уровни офиса. Эта страница бизнес-уровень не присваивает; блок «Прогноз» — условная финансовая проекция, а не подтверждение годового уровня.</li>'
      + '</ul></section>'
      + '<section class="instruction-block"><h3>Как читать результат</h3><ul>'
      + '<li>«Агенту» — выплата по применённому проценту; минимум задаёт пакет, но шкала сделки может дать больше.</li>'
      + '<li>«Мотивации офиса» уменьшают прибыль офиса; расходы, которые оплачивает агент, показываются отдельно и прибыль офиса не уменьшают.</li>'
      + '<li>«Остаток офису» учитывает выплату агенту, реферал, мотивации офиса, роялти и распределённую долю расходов.</li>'
      + '<li>Сравнение пакетов использует одинаковые сделки и расходы, поэтому показывает влияние именно пакета.</li>'
      + '</ul></section>'
      + '</div>'
      + '<section class="instruction-note"><h3>Условия программ</h3><p>Стипендия доступна пакетам «Стандарт» и «Расширенный» с 3-го квартального уровня. «Горы/Море» требует выполненного плана офиса и участия агента. «Путешествуй» требует 4-го полугодового уровня и подтверждённого партнёрства перед поездкой. Для всех партнёрских мотиваций сохраняется порог ' + threshold + ' задатков за квартал. Реферальная выплата включается отдельным признаком «Приведённый агент». Бизнес-уровни и поездка «Бизнес Тур» на этой странице не рассчитываются.</p></section>'
      + renderAdvertisingGuide()
      + renderDocuments()
      + '</div></details>';
  }

  function renderLedger() {
    return '<details class="section-instructions">'
      + '<summary>Как пользоваться разделом и действующими правилами</summary>'
      + '<div class="section-instructions__content">'
      + '<p class="section-instructions__lead">Табличный режим — это ведомость сделок по агентам для собственника или руководителя, которому привычнее Excel: все исходные данные, расчёты по каждому агенту и итог офиса видны на одном экране.</p>'
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Как заполнить ведомость</h3><ol>'
      + '<li>В верхних карточках внесите названия и суммы расходов офиса, а также личные сделки собственника.</li>'
      + '<li>Нажмите «+ Агент», укажите имя и карьерный пакет. Признак «Есть реферал» включайте только при действующем праве на выплату.</li>'
      + '<li>Откройте «Дополнительные условия», чтобы внести квартальную и полугодовую комиссию, задатки, условия поездок и их стоимость.</li>'
      + '<li>Нажмите «+ Сделка» и заполните сумму комиссии по сделке, при необходимости ручной процент, признак новостройки с одним агентом и комментарий.</li>'
      + '</ol></section>'
      + '<section class="instruction-block"><h3>Что вводится, а что считается</h3><p><b>Белые поля</b> предназначены для ввода. <b>Серые ячейки</b> — расчётные: процент, выплата агенту, реферал, мотивации, роялти, доля расходов и остаток офису; редактировать их не нужно.</p>'
      + '<p>Процент берётся из общей шкалы с учётом минимума пакета и ручного процента сделки, если он разрешён. Реферал считается при включённом признаке. Роялти и постоянные расходы распределяются между агентами так, чтобы их сумма совпадала с итогом офиса.</p></section>'
      + '</div>'
      + '<div class="instruction-grid">'
      + '<section class="instruction-block"><h3>Итоги офиса</h3><ul>'
      + '<li>В строках агента видны комиссия, выплата, реферал, мотивации офиса и агента, роялти, расходы и вклад агента.</li>'
      + '<li>Личные сделки собственника учитываются отдельно. Сводка показывает оборот и результат офиса как без собственника, так и с его сделками.</li>'
      + '<li>Мотивации, оплачиваемые офисом, уменьшают итог; суммы за счёт агента отображаются отдельно.</li>'
      + '<li>Для «Индивидуального» пакета реклама считается как 3% задатков прошлого месяца с лимитом 15 000 ₽. Остальная рекламная поддержка идёт по внешней бонусной сетке и здесь не переводится в деньги.</li>'
      + '</ul></section>'
      + '<section class="instruction-block"><h3>Сохранение, загрузка и очистка</h3><ul>'
      + '<li>Изменения автоматически сохраняются в отдельный черновик ведомости в этом браузере и восстанавливаются при следующем открытии.</li>'
      + '<li>«Загрузить из A4» переносит сохранённый снимок основного калькулятора. Если ведомость уже заполнена, замена ручных правок требует подтверждения.</li>'
      + '<li>«Очистить» после подтверждения сбрасывает всю ведомость и удаляет только её сохранённый черновик. Сохранённые месяцы A4 и карьерные профили не удаляются.</li>'
      + '</ul></section>'
      + '</div>'
      + '<section class="instruction-note"><h3>Практический совет</h3><p>Сначала заполните все сделки одного агента, затем его дополнительные условия. После этого переходите к следующему агенту и сверяйте строку «Итого» — так проще заметить пропущенную сделку или неверно выбранный пакет.</p></section>'
      + renderDocuments()
      + '</div></details>';
  }

  function shouldRender(context) {
    if (context !== 'motivation') {
      return true;
    }
    return Boolean(root.location && /(?:\?|&)mode=motivation2026(?:&|$)/.test(root.location.search || ''));
  }

  function renderContext(context) {
    if (context === 'career') {
      return renderCareer();
    }
    if (context === 'motivation') {
      return renderMotivation();
    }
    if (context === 'ledger') {
      return renderLedger();
    }
    return '';
  }

  function init() {
    var placeholders = document.querySelectorAll('[data-section-instructions]');
    Array.prototype.forEach.call(placeholders, function (placeholder) {
      var context = placeholder.getAttribute('data-section-instructions');
      var html;
      if (!shouldRender(context)) {
        return;
      }
      html = renderContext(context);
      if (!html) {
        return;
      }
      placeholder.innerHTML = html;
      placeholder.hidden = false;
      placeholder.setAttribute('data-section-instructions-ready', 'true');
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
}(typeof window !== 'undefined' ? window : globalThis));
