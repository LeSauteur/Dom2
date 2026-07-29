async (page) => {
  const out = [];
  const first = () => page.locator('.agent-card').first();
  const add = async (name, expected, actual) => out.push({
    name, expected, actual,
    status: JSON.stringify(expected) === JSON.stringify(actual) ? 'PASS' : 'FAIL'
  });
  const accept = () => page.once('dialog', dialog => dialog.accept());
  const dismiss = () => page.once('dialog', dialog => dialog.dismiss());

  await page.goto('http://127.0.0.1:4173/motivation-calculator.html');
  await page.waitForURL(/mode=motivation2026/);
  let name = first().locator('[data-agent-field="name"]');
  let deal = first().locator('[data-deal-index="0"]');
  await name.fill('Сохраняемый агент');
  await deal.fill('234567');
  await deal.press('Tab');

  let toggle = first().locator('[data-action="toggle-agent-collapse"]').first();
  await toggle.click();
  await add('collapse hides body', true, await first().locator('[data-agent-body]').isHidden());
  await add('collapse shows summary', true, await first().locator('[data-agent-collapsed-summary]').isVisible());
  await add('collapse keeps name', true, (await first().innerText()).includes('Сохраняемый агент'));
  await first().locator('[data-action="toggle-agent-collapse"]').first().click();
  await add('expand shows body', true, await first().locator('[data-agent-body]').isVisible());
  await add('expand keeps deal', '234 567', await first().locator('[data-deal-index="0"]').inputValue());

  const details = first().locator('details.package-conditions');
  await details.locator('summary').click();
  await add('package details closes', false, await details.getAttribute('open') !== null);
  await details.locator('summary').click();
  await add('package details opens', true, await details.getAttribute('open') !== null);
  await add('details keeps deal', '234 567', await first().locator('[data-deal-index="0"]').inputValue());

  for (const key of ['expenses', 'agents', 'ownerDeals']) {
    let c = page.locator(`[data-action="collapse-section"][data-section-key="${key}"]`);
    await c.click();
    let e = page.locator(`[data-action="expand-section"][data-section-key="${key}"]`);
    await add(`collapse section ${key}`, true, await e.isVisible());
    await e.click();
    await add(`expand section ${key}`, true, await c.isVisible());
  }

  let save = page.locator('[data-action="save-draft"]').first();
  await save.click();
  await add('save success message', true, /Сохранено/.test(await page.locator('#draftSaveStatus').innerText()));
  await save.click();
  await save.dblclick();
  await page.reload();
  await add('save reload name', 'Сохраняемый агент', await first().locator('[data-agent-field="name"]').inputValue());
  await add('save reload deal', '234 567', await first().locator('[data-deal-index="0"]').inputValue());

  dismiss();
  await page.locator('[data-action="clear-all"]').click();
  await add('dismiss clear keeps form', 'Сохраняемый агент', await first().locator('[data-agent-field="name"]').inputValue());
  accept();
  await page.locator('[data-action="clear-all"]').click();
  await add('accept clear empties name', '', await first().locator('[data-agent-field="name"]').inputValue());
  await page.reload();
  await add('clear persists on reload', '', await first().locator('[data-agent-field="name"]').inputValue());

  await first().locator('[data-agent-field="name"]').fill('Не заменять');
  dismiss();
  await page.locator('[data-action="restore-example"]').click();
  await add('dismiss example keeps form', 'Не заменять', await first().locator('[data-agent-field="name"]').inputValue());
  accept();
  await page.locator('[data-action="restore-example"]').click();
  await add('accept example fills data', true, await page.locator('.agent-card').count() > 1);
  await add('example success message', true, /Пример сохранён/.test(await page.locator('#draftSaveStatus').innerText()));

  dismiss();
  await page.locator('[data-action="hard-reset"]').click();
  await add('dismiss hard reset keeps data', true, await page.locator('.agent-card').count() > 1);
  let step = 0;
  page.on('dialog', async dialog => {
    step += 1;
    if (step === 1) await dialog.accept();
    else await dialog.accept('НЕ УДАЛЯТЬ');
  });
  await page.locator('[data-action="hard-reset"]').click();
  await add('wrong reset phrase keeps data', true, await page.locator('.agent-card').count() > 1);
  page.removeAllListeners('dialog');

  step = 0;
  page.on('dialog', async dialog => {
    step += 1;
    if (step === 1) await dialog.accept();
    else await dialog.accept('УДАЛИТЬ');
  });
  await page.locator('[data-action="hard-reset"]').click();
  await add('confirmed reset one agent', 1, await page.locator('.agent-card').count());
  await add('confirmed reset blank name', '', await first().locator('[data-agent-field="name"]').inputValue());
  page.removeAllListeners('dialog');

  return {
    pass: out.filter(x => x.status === 'PASS').length,
    fail: out.filter(x => x.status === 'FAIL').length,
    results: out
  };
}
