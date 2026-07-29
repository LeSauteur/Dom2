async (page) => {
  const results = [];
  const waitForUi = () => page.waitForTimeout(650);
  const agents = () => page.locator('.agent-card');
  const expenses = () => page.locator('.expense-row');
  const firstAgent = () => agents().first();
  const deals = () => firstAgent().locator('[data-agent-deal-index]');

  async function record(name, expected, actual) {
    results.push({
      name,
      expected,
      actual,
      status: JSON.stringify(expected) === JSON.stringify(actual) ? 'PASS' : 'FAIL'
    });
  }

  async function acceptNextConfirm() {
    page.once('dialog', async (dialog) => dialog.accept());
  }

  async function dismissNextDialog() {
    page.once('dialog', async (dialog) => dialog.dismiss());
  }

  await page.goto('http://127.0.0.1:4173/motivation-calculator.html');
  await page.waitForURL(/index\.html\?mode=motivation2026/);

  await record('redirect opens motivation mode', true, /mode=motivation2026/.test(page.url()));
  await record('table mode button hidden/removed', 0, await page.locator('[data-action="open-table-mode"]').count());

  const initialExpenseCount = await expenses().count();
  await page.locator('[data-action="add-expense"]').click();
  await record('add expense single click adds one', initialExpenseCount + 1, await expenses().count());

  const afterSingleExpense = await expenses().count();
  await page.locator('[data-action="add-expense"]').click();
  await waitForUi();
  await page.locator('[data-action="add-expense"]').click();
  await record('add expense two deliberate clicks add two', afterSingleExpense + 2, await expenses().count());

  const beforeDoubleExpense = await expenses().count();
  await page.locator('[data-action="add-expense"]').dblclick();
  await record('add expense fast double click adds only one', beforeDoubleExpense + 1, await expenses().count());

  const firstExpenseName = expenses().first().locator('[data-expense-field="name"]');
  const firstExpenseAmount = expenses().first().locator('[data-expense-field="amount"]');
  await firstExpenseName.fill('Проверочный расход');
  await firstExpenseAmount.fill('123456');
  await firstExpenseAmount.press('Tab');
  const beforeRemoveExpense = await expenses().count();
  await page.locator('[data-action="remove-expense"]').last().click();
  await record('remove expense single click removes one', beforeRemoveExpense - 1, await expenses().count());
  await record(
    'removing another expense preserves first expense',
    ['Проверочный расход', '123 456'],
    [await firstExpenseName.inputValue(), await firstExpenseAmount.inputValue()]
  );

  const beforeDoubleRemoveExpense = await expenses().count();
  await page.locator('[data-action="remove-expense"]').last().dblclick();
  await record('remove expense fast double click removes only one', beforeDoubleRemoveExpense - 1, await expenses().count());

  const initialAgentCount = await agents().count();
  await page.locator('#addAgentBtn').click();
  await record('top add-agent button single click adds one', initialAgentCount + 1, await agents().count());

  const beforeBottomAdd = await agents().count();
  await page.locator('#addAgentBottomBtn').click();
  await record('bottom add-agent button single click adds one', beforeBottomAdd + 1, await agents().count());

  const beforeDoubleAgent = await agents().count();
  await page.locator('#addAgentBtn').dblclick();
  await record('add agent fast double click adds only one', beforeDoubleAgent + 1, await agents().count());

  const firstName = firstAgent().locator('[data-agent-field="name"]');
  const firstDeal = firstAgent().locator('[data-deal-index="0"]');
  await firstName.fill('Сохраняемый агент');
  await firstDeal.fill('234567');
  await firstDeal.press('Tab');

  const beforeAddDeal = await deals().count();
  await firstAgent().locator('[data-action="add-deal"]').click();
  await record('add deal single click adds one', beforeAddDeal + 1, await deals().count());

  const beforeDoubleDeal = await deals().count();
  await firstAgent().locator('[data-action="add-deal"]').dblclick();
  await record('add deal fast double click adds only one', beforeDoubleDeal + 1, await deals().count());
  await record(
    'adding deal preserves name and first deal',
    ['Сохраняемый агент', '234 567'],
    [await firstName.inputValue(), await firstDeal.inputValue()]
  );

  const beforeRemoveDeal = await deals().count();
  await firstAgent().locator('[data-action="remove-deal"]').last().click();
  await record('remove deal single click removes one', beforeRemoveDeal - 1, await deals().count());

  const beforeDoubleRemoveDeal = await deals().count();
  await firstAgent().locator('[data-action="remove-deal"]').last().dblclick();
  await record('remove deal fast double click removes only one', beforeDoubleRemoveDeal - 1, await deals().count());

  const beforeSingleRemoveAgent = await agents().count();
  await agents().last().locator('[data-action="remove-agent"]').click();
  await record('remove agent single click removes one', beforeSingleRemoveAgent - 1, await agents().count());
  await record(
    'removing another agent preserves first agent',
    ['Сохраняемый агент', '234 567'],
    [await firstName.inputValue(), await firstDeal.inputValue()]
  );

  const beforeDoubleRemoveAgent = await agents().count();
  await agents().last().locator('[data-action="remove-agent"]').dblclick();
  await record('remove agent fast double click removes only one', beforeDoubleRemoveAgent - 1, await agents().count());

  const collapseButton = firstAgent().locator('[data-action="toggle-agent-collapse"]').first();
  await collapseButton.click();
  await record('collapse agent hides body', true, await firstAgent().locator('[data-agent-body]').isHidden());
  await record('collapse agent shows summary', true, await firstAgent().locator('[data-agent-collapsed-summary]').isVisible());
  await record('collapse agent preserves name in summary', true, (await firstAgent().innerText()).includes('Сохраняемый агент'));
  await firstAgent().locator('[data-action="toggle-agent-collapse"]').first().click();
  await record('expand agent shows body', true, await firstAgent().locator('[data-agent-body]').isVisible());
  await record('expand agent preserves deal', '234 567', await firstAgent().locator('[data-deal-index="0"]').inputValue());

  const packageDetails = firstAgent().locator('details.package-conditions');
  await packageDetails.locator('summary').click();
  await record('package details closes', false, await packageDetails.getAttribute('open') !== null);
  await packageDetails.locator('summary').click();
  await record('package details opens', true, await packageDetails.getAttribute('open') !== null);
  await record('details toggle preserves deal', '234 567', await firstAgent().locator('[data-deal-index="0"]').inputValue());

  for (const sectionKey of ['expenses', 'agents', 'ownerDeals']) {
    const collapse = page.locator('[data-action="collapse-section"][data-section-key="' + sectionKey + '"]');
    await collapse.click();
    const expand = page.locator('[data-action="expand-section"][data-section-key="' + sectionKey + '"]');
    await record('collapse section ' + sectionKey, true, await expand.isVisible());
    await expand.click();
    await record('expand section ' + sectionKey, true, await collapse.isVisible());
  }
  await record('section toggles preserve first agent name', 'Сохраняемый агент', await firstName.inputValue());

  const saveButton = page.locator('[data-action="save-draft"]').first();
  await saveButton.click();
  await record('save reports success', true, /Сохранено/.test(await page.locator('#draftSaveStatus').innerText()));
  await saveButton.click();
  await saveButton.dblclick();
  await page.reload();
  await record('save and reload preserve name', 'Сохраняемый агент', await firstAgent().locator('[data-agent-field="name"]').inputValue());
  await record('save and reload preserve deal', '234 567', await firstAgent().locator('[data-deal-index="0"]').inputValue());

  await dismissNextDialog();
  await page.locator('[data-action="clear-all"]').click();
  await record('dismiss clear keeps name', 'Сохраняемый агент', await firstAgent().locator('[data-agent-field="name"]').inputValue());

  await acceptNextConfirm();
  await page.locator('[data-action="clear-all"]').click();
  await record('accept clear empties name', '', await firstAgent().locator('[data-agent-field="name"]').inputValue());
  await record('accept clear leaves one blank deal', 1, await deals().count());
  await page.reload();
  await record('cleared form stays clear after reload', '', await firstAgent().locator('[data-agent-field="name"]').inputValue());

  await firstAgent().locator('[data-agent-field="name"]').fill('Не заменять');
  await dismissNextDialog();
  await page.locator('[data-action="restore-example"]').click();
  await record('dismiss restore-example keeps form', 'Не заменять', await firstAgent().locator('[data-agent-field="name"]').inputValue());

  await acceptNextConfirm();
  await page.locator('[data-action="restore-example"]').click();
  await record('accept restore-example creates filled example', true, (await agents().count()) > 1);
  await record('restore-example reports success', true, /Пример сохранён/.test(await page.locator('#draftSaveStatus').innerText()));

  await dismissNextDialog();
  await page.locator('[data-action="hard-reset"]').click();
  await record('dismiss hard reset keeps example', true, (await agents().count()) > 1);

  let dialogStep = 0;
  page.on('dialog', async (dialog) => {
    dialogStep += 1;
    if (dialogStep === 1) {
      await dialog.accept();
    } else {
      await dialog.accept('НЕ УДАЛЯТЬ');
    }
  });
  await page.locator('[data-action="hard-reset"]').click();
  await record('wrong hard-reset phrase keeps example', true, (await agents().count()) > 1);
  page.removeAllListeners('dialog');

  dialogStep = 0;
  page.on('dialog', async (dialog) => {
    dialogStep += 1;
    if (dialogStep === 1) {
      await dialog.accept();
    } else {
      await dialog.accept('УДАЛИТЬ');
    }
  });
  await page.locator('[data-action="hard-reset"]').click();
  await record('confirmed hard reset leaves one blank agent', 1, await agents().count());
  await record('confirmed hard reset empties name', '', await firstAgent().locator('[data-agent-field="name"]').inputValue());
  page.removeAllListeners('dialog');

  return {
    url: page.url(),
    pass: results.filter((item) => item.status === 'PASS').length,
    fail: results.filter((item) => item.status === 'FAIL').length,
    results
  };
}
