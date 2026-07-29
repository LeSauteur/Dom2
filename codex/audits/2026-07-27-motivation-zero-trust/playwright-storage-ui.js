async (page) => {
  const observations = [];

  async function currentAgent() {
    const card = page.locator('.agent-card').first();
    return {
      name: await card.locator('[data-agent-field="name"]').inputValue(),
      deal: await card.locator('[data-deal-index="0"]').inputValue()
    };
  }

  async function setMonth(value) {
    const month = page.locator('#selectedMonthInput');
    await month.fill(value);
    await month.press('Tab');
  }

  async function setAgent(name, deal) {
    const card = page.locator('.agent-card').first();
    await card.locator('[data-agent-field="name"]').fill(name);
    await card.locator('[data-deal-index="0"]').fill(String(deal));
    await card.locator('[data-deal-index="0"]').press('Tab');
  }

  await setMonth('2026-01');
  await setAgent('Январь', 100000);
  await page.getByRole('button', { name: /Сохранить/ }).first().click();

  await setMonth('2026-02');
  observations.push({ stage: 'february-initial', value: await currentAgent() });
  await setAgent('Февраль', 200000);
  await page.getByRole('button', { name: /Сохранить/ }).first().click();

  await setMonth('2026-01');
  observations.push({ stage: 'january-restored', value: await currentAgent() });
  await page.reload();
  observations.push({ stage: 'january-after-reload', value: await currentAgent() });

  await page.getByRole('link', { name: 'Мотивация 2026' }).first().click();
  observations.push({
    stage: 'motivation-opened',
    url: page.url(),
    value: await currentAgent()
  });
  await page.getByRole('link', { name: 'Калькулятор' }).first().click();
  observations.push({
    stage: 'a4-returned',
    url: page.url(),
    value: await currentAgent()
  });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Очистить текущую форму' }).click();
  observations.push({ stage: 'january-cleared', value: await currentAgent() });
  await setMonth('2026-02');
  observations.push({ stage: 'february-preserved', value: await currentAgent() });

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Удалить все сохранённые данные' }).click();
  await page.waitForLoadState('domcontentloaded');
  observations.push({ stage: 'after-hard-reset', value: await currentAgent() });
  await setMonth('2026-01');
  observations.push({ stage: 'january-after-hard-reset', value: await currentAgent() });

  return observations;
}
