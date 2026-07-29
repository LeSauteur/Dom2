async (page) => {
  const out = [];
  const agents = () => page.locator('.agent-card');
  const expenses = () => page.locator('.expense-row');
  const first = () => agents().first();
  const deals = () => first().locator('[data-agent-deal-index]');
  const add = async (name, expected, actual) => out.push({
    name, expected, actual,
    status: JSON.stringify(expected) === JSON.stringify(actual) ? 'PASS' : 'FAIL'
  });

  await page.goto('http://127.0.0.1:4173/motivation-calculator.html');
  await page.waitForURL(/mode=motivation2026/);
  await add('redirect', true, /mode=motivation2026/.test(page.url()));
  await add('no table-mode button', 0, await page.locator('[data-action="open-table-mode"]').count());

  let n = await expenses().count();
  await page.locator('[data-action="add-expense"]').click();
  await add('add expense single', n + 1, await expenses().count());
  n = await expenses().count();
  await page.locator('[data-action="add-expense"]').click();
  await page.waitForTimeout(650);
  await page.locator('[data-action="add-expense"]').click();
  await add('add expense repeated deliberately', n + 2, await expenses().count());
  n = await expenses().count();
  await page.locator('[data-action="add-expense"]').dblclick();
  await add('add expense double', n + 1, await expenses().count());

  let name = expenses().first().locator('[data-expense-field="name"]');
  let amount = expenses().first().locator('[data-expense-field="amount"]');
  await name.fill('Проверочный расход');
  await amount.fill('123456');
  await amount.press('Tab');
  n = await expenses().count();
  await page.locator('[data-action="remove-expense"]').last().click();
  await add('remove expense single', n - 1, await expenses().count());
  await add('remove expense preserves neighbor', ['Проверочный расход', '123 456'], [
    await name.inputValue(), await amount.inputValue()
  ]);
  n = await expenses().count();
  await page.locator('[data-action="remove-expense"]').last().dblclick();
  await add('remove expense double', n - 1, await expenses().count());

  n = await agents().count();
  await page.locator('#addAgentBtn').click();
  await add('add agent top single', n + 1, await agents().count());
  n = await agents().count();
  await page.locator('#addAgentBottomBtn').click();
  await add('add agent bottom single', n + 1, await agents().count());
  n = await agents().count();
  await page.locator('#addAgentBtn').dblclick();
  await add('add agent double', n + 1, await agents().count());

  let agentName = first().locator('[data-agent-field="name"]');
  let deal = first().locator('[data-deal-index="0"]');
  await agentName.fill('Сохраняемый агент');
  await deal.fill('234567');
  await deal.press('Tab');
  n = await deals().count();
  await first().locator('[data-action="add-deal"]').click();
  await add('add deal single', n + 1, await deals().count());
  n = await deals().count();
  await first().locator('[data-action="add-deal"]').dblclick();
  await add('add deal double', n + 1, await deals().count());
  await add('add deal preserves agent', ['Сохраняемый агент', '234 567'], [
    await agentName.inputValue(), await deal.inputValue()
  ]);
  n = await deals().count();
  await first().locator('[data-action="remove-deal"]').last().click();
  await add('remove deal single', n - 1, await deals().count());
  n = await deals().count();
  await first().locator('[data-action="remove-deal"]').last().dblclick();
  await add('remove deal double', n - 1, await deals().count());

  n = await agents().count();
  await agents().last().locator('[data-action="remove-agent"]').click();
  await add('remove agent single', n - 1, await agents().count());
  await add('remove agent preserves first', ['Сохраняемый агент', '234 567'], [
    await agentName.inputValue(), await deal.inputValue()
  ]);
  n = await agents().count();
  await agents().last().locator('[data-action="remove-agent"]').dblclick();
  await add('remove agent double', n - 1, await agents().count());

  return {
    pass: out.filter(x => x.status === 'PASS').length,
    fail: out.filter(x => x.status === 'FAIL').length,
    results: out
  };
}
