import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Isolate all Electron operations: never access a real printer or production orders.
  await page.addInitScript(() => {
    const orders: any[] = [];
    const prints: any[] = [];
    const now = Date.now();
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const week = { id: `${localDate(start)}_a_${localDate(end)}`, start: localDate(start), end: localDate(end) };
    const previousStart = new Date(start); previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(end); previousEnd.setDate(previousEnd.getDate() - 7);
    const oldWeek = { id: `${localDate(previousStart)}_a_${localDate(previousEnd)}`, start: localDate(previousStart), end: localDate(previousEnd) };
    const record = { week: week.id, orderId: 'test-order', entryId: 'test-entry', comanda: '007', productId: '22', productName: 'Pastel Frito', quantity: 4, addedAt: now,
      orderCreatedAt: now - 600000, orderStatus: 'FINALIZADO', finishedAt: now, readyAt: now - 1000, status: 'VÁLIDO',
      configs: ['Carne', 'Queijo', 'Pizza', 'Frango c/ Catupiry'].map(flavor => ({ selectedAddOns: [], observation: '', flavor })) };
    (window as any).__fixture = { orders, prints, cancellations: 0, record, saves: 0 };
    window.electronAPI = {
      ordersList: async () => structuredClone(orders),
      ordersImport: async () => structuredClone(orders),
      ordersSave: async (order: any) => {
        (window as any).__fixture.saves++;
        await new Promise(resolve => setTimeout(resolve, 150));
        if ((window as any).__fixture.failSave) throw new Error('Servidor indisponível');
        const index = orders.findIndex(value => value.id === order.id);
        if (index >= 0) orders[index] = structuredClone(order); else orders.push(structuredClone(order));
        return order;
      },
      ordersStatus: async () => ({ ok: true }),
      printReceipt: async (payload: any) => { prints.push(payload); },
      reportsWeeks: async () => [week, oldWeek],
      reportsWeek: async (id: string) => ({ week: id === week.id ? week : oldWeek, records: id === week.id ? [structuredClone(record)] : [] }),
      reportsCancel: async ({ reason }: any) => {
        (window as any).__fixture.cancellations++;
        Object.assign(record, { status: 'CANCELADO', cancelledAt: Date.now(), cancellationReason: reason || 'Não informado' });
        return { week, records: [structuredClone(record)] };
      },
      reportsOpenFolder: async () => {},
      getNetworkConfig: async () => ({ mode: 'local', port: 37842, serverIp: '', localIps: [] }),
      getAppVersion: async () => '1.0.20'
    } as any;
  });
  await page.goto('/');
});

async function openComanda(page: Page, value = '123') {
  const field = page.getByPlaceholder('BIPE OU DIGITE A COMANDA...');
  await field.fill(value);
  await field.press('Enter');
}

test('quantidades abaixo dos produtos, observação única e envio de vários produtos sem repetir telas', async ({ page }) => {
  await openComanda(page);
  const names = await page.locator('[data-product-name]').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })));
  await page.getByRole('spinbutton', { name: 'Quantidade de Kids Araújo', exact: true }).fill('4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionais de Kids Araújo', exact: true }).click();
  await expect(page.getByText('O que escolher vale para as 4 unidades.')).toBeVisible();
  const addons = await page.getByLabel('Lista de adicionais').getByRole('button').allTextContents();
  expect(addons).toEqual([...addons].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
  await page.getByRole('button', { name: 'Bacon', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Concluir detalhes' }).click();
  await page.getByRole('spinbutton', { name: 'Quantidade de Batata Frita', exact: true }).fill('2');
  await page.getByLabel('Observação da comanda', { exact: true }).fill('Para viagem; Kids sem cebola');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('button', { name: 'Enviar 6 itens para a chapa', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await page.screenshot({ path: 'test-results/lancamento-1024.png', fullPage: true });
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.screenshot({ path: 'test-results/lancamento-rapido.png', fullPage: true });
  await page.getByRole('button', { name: 'Enviar 6 itens para a chapa', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(1);
  let state = await page.evaluate(() => (window as any).__fixture);
  expect(state.saves).toBe(1);
  expect(state.orders[0].entries).toHaveLength(2);
  const kids = state.orders[0].entries.find((entry: any) => entry.item.name === 'Kids Araújo');
  expect(kids.quantity).toBe(4);
  expect(kids.configs).toHaveLength(4);
  expect(kids.configs.every((config: any) => config.observation === '' && config.selectedAddOns[0].name === 'Bacon')).toBe(true);
  expect(state.orders[0].observation).toBe('Para viagem; Kids sem cebola');
  const firstPrint = Buffer.from(state.prints[0].rawData, 'base64').toString('ascii');
  expect(firstPrint).toContain('4X KIDS ARAUJO');
  expect(firstPrint).toContain('2X BATATA FRITA');
  expect(firstPrint.match(/OBSERVACAO DA COMANDA/g)).toHaveLength(1);
  expect(firstPrint.match(/KIDS SEM CEBOLA/g)).toHaveLength(1);
  expect(firstPrint.match(/ADICIONAIS:/g)).toHaveLength(1);
  expect(firstPrint).not.toContain('[ITEM');
  await expect(page.getByText('Para viagem; Kids sem cebola', { exact: true })).toBeVisible();
  await openComanda(page);
  await expect(page.getByLabel('Observação da comanda', { exact: true })).toHaveValue('Para viagem; Kids sem cebola');
  await page.getByRole('button', { name: 'Adicionar Pão com Ovo', exact: true }).click();
  await page.getByLabel('Observação da comanda', { exact: true }).fill('Servir na mesa');
  await page.getByRole('button', { name: 'Enviar 1 item para a chapa', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(2);
  state = await page.evaluate(() => (window as any).__fixture);
  expect(state.orders[0].entries).toHaveLength(3);
  expect(state.orders[0].observation).toBe('Servir na mesa');
  expect(state.orders[0].entries[0].orderObservation).toBe('Para viagem; Kids sem cebola');
  const addition = Buffer.from(state.prints[1].rawData, 'base64').toString('ascii');
  expect(addition).toContain('NOVO PEDIDO');
  expect(addition).toContain('PAO COM OVO');
  expect(addition).toContain('SERVIR NA MESA');
  expect(addition).not.toContain('KIDS');
  expect(addition).not.toContain('BATATA FRITA');
});

test('quatro Kids sem adicionais entram direto, sem nenhuma tela intermediária', async ({ page }) => {
  await openComanda(page);
  await page.getByRole('button', { name: 'Adicionar Kids Araújo', exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Aumentar Kids Araújo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar 4 itens para a chapa', exact: true }).click({ clickCount: 2 });
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(1);
  const state = await page.evaluate(() => (window as any).__fixture);
  expect(state.saves).toBe(1);
  expect(state.orders[0].entries[0].quantity).toBe(4);
});

test('pastéis distribuem quantidades por sabor e mostram os sabores no painel', async ({ page }) => {
  await openComanda(page);
  await page.getByRole('spinbutton', { name: 'Quantidade de Pastel Frito', exact: true }).fill('4');
  await page.getByRole('button', { name: 'Enviar 4 itens para a chapa', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Falta escolher 4 sabores.');
  const flavors = ['Carne', 'Queijo', 'Pizza', 'Frango c/ Catupiry'];
  for (const flavor of flavors) await page.getByRole('button', { name: `Aumentar sabor ${flavor}`, exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('4 pastéis com sabor escolhido.');
  await expect(page.getByRole('button', { name: 'Aumentar sabor Carne', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/pasteis-sabores.png', fullPage: true });
  await page.getByRole('button', { name: 'Concluir detalhes' }).click();
  await page.getByLabel('Observação da comanda', { exact: true }).fill('Embalar separados');
  await page.getByRole('button', { name: 'Enviar 4 itens para a chapa', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(1);
  const state = await page.evaluate(() => (window as any).__fixture);
  expect(state.orders[0].entries[0].configs.map((config: any) => config.flavor)).toEqual(flavors);
  expect(state.orders[0].entries[0].configs.every((config: any) => config.observation === '')).toBe(true);
  const receipt = Buffer.from(state.prints[0].rawData, 'base64').toString('ascii');
  for (const flavor of flavors) {
    expect(receipt).toContain(`SABOR: ${flavor.toUpperCase()}`);
    await expect(page.getByText(`Sabor: ${flavor}`, { exact: true })).toBeVisible();
  }
});

test('busca sem acentos, revisão, remoção e proteção ao sair do rascunho', async ({ page }) => {
  await openComanda(page);
  await page.getByLabel('Buscar produto').fill('pao com ovo');
  await expect(page.locator('[data-product-name]')).toHaveText(['Pão com Ovo']);
  await page.getByRole('button', { name: 'Adicionar Pão com Ovo', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await page.getByRole('button', { name: 'Selecionados (1)', exact: true }).click();
  await expect(page.locator('[data-product-name]')).toHaveText(['Pão com Ovo']);
  page.once('dialog', dialog => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('spinbutton', { name: 'Quantidade de Pão com Ovo', exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Remover Pão com Ovo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar 0 itens para a chapa', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByPlaceholder('BIPE OU DIGITE A COMANDA...')).toBeVisible();
});

test('adicionais individuais continuam opcionais e Escape fecha apenas os detalhes', async ({ page }) => {
  await openComanda(page);
  await page.getByRole('spinbutton', { name: 'Quantidade de Kids Araújo', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Adicionais de Kids Araújo', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionais diferentes', exact: true }).click();
  await page.getByRole('button', { name: 'Bacon', exact: true }).click();
  await page.getByRole('tab', { name: 'Unidade 2', exact: true }).click();
  await page.getByRole('button', { name: 'Ovo', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Enviar 2 itens para a chapa', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(1);
  const configs = await page.evaluate(() => (window as any).__fixture.orders[0].entries[0].configs);
  expect(configs.map((config: any) => config.selectedAddOns[0].name)).toEqual(['Bacon', 'Ovo']);
});

test('falha ao salvar preserva quantidades e observação para tentar novamente', async ({ page }) => {
  await openComanda(page);
  await page.evaluate(() => { (window as any).__fixture.failSave = true; });
  await page.getByRole('spinbutton', { name: 'Quantidade de Kids Araújo', exact: true }).fill('4');
  await page.getByLabel('Observação da comanda', { exact: true }).fill('Para viagem');
  await page.getByRole('button', { name: 'Enviar 4 itens para a chapa', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Seus itens continuam aqui');
  await expect(page.getByRole('spinbutton', { name: 'Quantidade de Kids Araújo', exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Observação da comanda', { exact: true })).toHaveValue('Para viagem');
  expect(await page.evaluate(() => (window as any).__fixture.prints.length)).toBe(0);
  await page.evaluate(() => { (window as any).__fixture.failSave = false; });
  await page.getByRole('button', { name: 'Enviar 4 itens para a chapa', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__fixture.prints.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__fixture.orders[0].entries.length)).toBe(1);
});

test('relatório semanal distingue válidos/cancelados e confirma cancelamento sem imprimir', async ({ page }) => {
  await page.getByRole('button', { name: /Dados/ }).click();
  await expect(page.getByText('Total vendido • unidades válidas')).toBeVisible();
  await expect(page.getByText('VÁLIDO', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar lançamento' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__fixture.cancellations)).toBe(0);
  await page.getByRole('button', { name: 'Cancelar lançamento' }).click();
  await page.getByRole('button', { name: 'Teste de impressora', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText('CANCELADO', { exact: true })).toBeVisible();
  await expect(page.getByText('Nenhum item válido neste período.')).toBeVisible();
  await expect(page.getByText(/Motivo: Teste de impressora/)).toBeVisible();
  const state = await page.evaluate(() => (window as any).__fixture);
  expect(state.cancellations).toBe(1);
  expect(state.prints).toHaveLength(0);
  await page.getByLabel('Status do lançamento').selectOption('VÁLIDO');
  await expect(page.getByText('Nenhum lançamento encontrado.')).toBeVisible();
  await page.getByLabel('Status do lançamento').selectOption('CANCELADO');
  await page.screenshot({ path: 'test-results/relatorio-cancelado.png', fullPage: true });
  await page.getByRole('button', { name: 'Fechar relatórios' }).click();
  await page.getByRole('button', { name: /Dados/ }).click();
  await expect(page.getByText('CANCELADO', { exact: true })).toBeVisible();
  await page.getByLabel('Semana do relatório').selectOption({ index: 1 });
  await expect(page.getByText('Nenhum lançamento encontrado.')).toBeVisible();
});

test('F2 continua livre e Ctrl+Shift+F12 mantém o administrativo', async ({ page }) => {
  await page.keyboard.press('F2');
  await expect(page.getByText('Painel Administrativo')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+F12');
  await expect(page.getByText('Painel Administrativo')).toBeVisible();
});
