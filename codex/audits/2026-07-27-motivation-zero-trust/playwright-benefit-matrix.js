async (page) => {
  const card = page.locator('.agent-card').first();
  const packages = [
    'newcomer',
    'standard',
    'extended',
    'advanced',
    'premium',
    'premiumPlus',
    'individual'
  ];
  const deposits = [249999, 250000, 250001];
  const booleans = [false, true];
  const halfYears = [1599999, 1600000, 1600001];
  const mismatches = [];
  const coverage = [];

  const expectedPayer = {
    standard: { mountainSea: 'Офис', travel: 'Офис', corporate: 'Офис' },
    extended: { mountainSea: 'Офис', travel: 'Офис', corporate: 'Офис' },
    advanced: { mountainSea: 'Офис', travel: 'Офис', corporate: 'Офис' },
    premium: { mountainSea: 'Офис', travel: 'Агент', corporate: 'Офис' },
    premiumPlus: { mountainSea: 'Агент', travel: 'Агент', corporate: 'Офис' },
    individual: { mountainSea: 'Агент', travel: 'Агент', corporate: 'Агент' }
  };

  async function setChecked(selector, value) {
    const input = card.locator(selector);
    if (value) {
      await input.check();
    } else {
      await input.uncheck();
    }
  }

  async function itemState(label) {
    const item = card.locator('.package-benefit-list li').filter({ hasText: label });
    const lines = (await item.innerText()).trim().split('\n');
    const payerLine = lines[1] || '';
    return {
      available: !payerLine.startsWith('Недоступно'),
      payer: payerLine.startsWith('Оплачивает офис')
        ? 'Офис'
        : (payerLine.startsWith('Оплачивает агент') ? 'Агент' : 'Нет права')
    };
  }

  await card.locator('[data-agent-field="quarterlyCommission"]').fill('600000');
  await card.locator('[data-agent-field="quarterlyCommission"]').press('Tab');

  for (const packageId of packages) {
    await card.locator('[data-agent-field="careerPackageId"]').selectOption(packageId);

    for (const deposit of deposits) {
      const depositInput = card.locator('[data-agent-field="quarterlyDeposits"]');
      await depositInput.fill(String(deposit));
      await depositInput.press('Tab');

      for (const plan of booleans) {
        await setChecked('[data-agent-field="careerOfficePlanCompleted"]', plan);

        for (const participated of booleans) {
          await setChecked('[data-agent-field="careerAgentParticipated"]', participated);

          for (const travelConfirmed of booleans) {
            await setChecked(
              '[data-agent-field="travelQuarterPartnershipConfirmed"]',
              travelConfirmed
            );

            for (const halfYear of halfYears) {
              const halfYearInput = card.locator('[data-agent-field="halfYearCommission"]');
              await halfYearInput.fill(String(halfYear));
              await halfYearInput.press('Tab');

              const partnership = packageId !== 'newcomer' && deposit >= 250000;
              const expected = {
                leadGeneration: {
                  available: packageId === 'newcomer' || partnership,
                  payer: packageId === 'newcomer' || partnership ? 'Офис' : 'Нет права'
                },
                stipend: {
                  available: partnership
                    && (packageId === 'standard' || packageId === 'extended'),
                  payer: partnership
                    && (packageId === 'standard' || packageId === 'extended')
                    ? 'Офис'
                    : 'Нет права'
                },
                mountainSea: {
                  available: partnership && plan && participated,
                  payer: partnership && plan && participated
                    ? expectedPayer[packageId].mountainSea
                    : 'Нет права'
                },
                travel: {
                  available: partnership && halfYear >= 1600000 && travelConfirmed,
                  payer: partnership && halfYear >= 1600000 && travelConfirmed
                    ? expectedPayer[packageId].travel
                    : 'Нет права'
                },
                corporate: {
                  available: partnership,
                  payer: partnership ? expectedPayer[packageId].corporate : 'Нет права'
                }
              };
              const actual = {
                leadGeneration: await itemState(
                  packageId === 'individual' ? 'Индивидуальная реклама' : 'Лидогенерация'
                ),
                stipend: await itemState('Стипендия'),
                mountainSea: await itemState('Горы / Море'),
                travel: await itemState('Путешествуй с Домиан'),
                corporate: await itemState('Корпоративы')
              };
              const key = {
                packageId,
                deposit,
                plan,
                participated,
                travelConfirmed,
                halfYear
              };

              for (const benefitId of Object.keys(expected)) {
                if (
                  actual[benefitId].available !== expected[benefitId].available
                  || actual[benefitId].payer !== expected[benefitId].payer
                ) {
                  mismatches.push({
                    ...key,
                    benefitId,
                    expected: expected[benefitId],
                    actual: actual[benefitId]
                  });
                }
              }
              coverage.push(key);
            }
          }
        }
      }
    }
  }

  return {
    testedCombinations: coverage.length,
    testedBenefitAssertions: coverage.length * 5,
    mismatches
  };
}
