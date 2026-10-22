import { test, TestContext } from 'node:test';
import assert from 'node:assert/strict';
import PrinterService from '../services/printerService';
import { emptyConfig, repeatConfig } from '../services/orderSelection';
import { Order, OrderStatus, PrinterConfig } from '../types';

function mockGlobal(t: TestContext, name: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  });
}

const printer: PrinterConfig = { mode: 'network', name: 'CHAPA', printerIp: '192.168.50.217', printerPort: 9100 };
const order: Order = { id: 'test', comanda: '123', status: OrderStatus.PREPARING, createdAt: 1, observation: 'Para viagem',
  entries: [{ id: 'entry', addedAt: 1, item: { id: 'kids', name: 'Kids', category: 'BURGER', icon: '' }, quantity: 4,
    configs: repeatConfig({ ...emptyConfig(), selectedAddOns: [{ id: 'bacon', name: 'Bacon', type: 'SALGADO' }] }, 4) }] };

test('cupom RAW agrupa quatro iguais e preserva observações individuais dos pedidos antigos', t => {
  const payloads: any[] = [];
  mockGlobal(t, 'window', { electronAPI: { printReceipt: async (payload: any) => { payloads.push(payload); } } });
  PrinterService.printOrder(order, printer);
  const receipt = Buffer.from(payloads[0].rawData, 'base64').toString('ascii');
  assert.match(receipt, /4X KIDS/);
  assert.equal(receipt.match(/BACON/g)?.length, 1);
  assert.equal(receipt.match(/PARA VIAGEM/g)?.length, 1);
  assert.equal(receipt.match(/OBSERVACAO DA COMANDA/g)?.length, 1);
  const legacy = structuredClone(order);
  delete legacy.observation;
  legacy.entries[0].configs[0].observation = 'Sem cebola';
  legacy.entries[0].configs[1].observation = 'Bem passado';
  PrinterService.printOrder(legacy, { ...printer, mode: 'usb' }, true);
  const legacyReceipt = Buffer.from(payloads[1].rawData, 'base64').toString('ascii');
  assert.match(legacyReceipt, /OBS: SEM CEBOLA/);
  assert.match(legacyReceipt, /OBS: BEM PASSADO/);
  assert.match(legacyReceipt, /NOVO PEDIDO/);
  assert.equal(payloads[1].printerMode, 'usb');
});

test('impressão pelo navegador mostra observação única como texto, inclusive sinais HTML', t => {
  const element = { className: '', innerHTML: '', remove() {} };
  mockGlobal(t, 'window', { print() {} });
  mockGlobal(t, 'document', { createElement: () => element, body: { appendChild() {} } });
  PrinterService.printOrder({ ...order, observation: '<img src=x> & mesa 2' }, printer);
  assert.equal(element.innerHTML.match(/OBSERVAÇÃO DA COMANDA/g)?.length, 1);
  assert.match(element.innerHTML, /&lt;IMG SRC=X&gt; &amp; MESA 2/);
  assert.doesNotMatch(element.innerHTML, /<IMG/);
});

test('itens livres imprimem nome e quantidade por USB e escapam o nome no cupom HTML', t => {
  const freeOrder: Order = { ...order, entries: [{ id: 'free-entry', addedAt: 1,
    item: { id: 'livre-test', name: 'Quiche <tomate> & queijo', category: 'LIVRE', icon: '' },
    quantity: 2, configs: repeatConfig(emptyConfig(), 2) }] };
  const payloads: any[] = [];
  mockGlobal(t, 'window', { electronAPI: { printReceipt: async (payload: any) => { payloads.push(payload); } } });
  PrinterService.printOrder(freeOrder, { ...printer, mode: 'usb' });
  assert.equal(payloads[0].printerMode, 'usb');
  assert.match(Buffer.from(payloads[0].rawData, 'base64').toString('ascii'), /2X QUICHE <TOMATE> & QUEIJO/);

  const element = { className: '', innerHTML: '', remove() {} };
  (globalThis as any).window = { print() {} };
  mockGlobal(t, 'document', { createElement: () => element, body: { appendChild() {} } });
  PrinterService.printOrder(freeOrder, printer);
  assert.match(element.innerHTML, /Quiche &lt;tomate&gt; &amp; queijo/);
  assert.doesNotMatch(element.innerHTML, /<tomate>/);
});
