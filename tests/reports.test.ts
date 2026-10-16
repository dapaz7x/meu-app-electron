import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Order, OrderStatus, ReportRecord } from '../types';
import { reportStats, bakeryDate } from '../services/reportData';
const require = createRequire(import.meta.url);
const { createReportStore, weekFor } = require('../reports.cjs');

const monday = Date.parse('2026-09-28T09:00:00-03:00');
const sunday = Date.parse('2026-09-27T23:59:00-03:00');
const config = { selectedAddOns: [], flavor: 'Carne', observation: 'Pra viagem' };
function order(id = 'comanda-1', timestamp = monday, quantity = 4): Order {
  return { id, comanda: '123', status: OrderStatus.PREPARING, createdAt: timestamp,
    entries: [{ id: `entry-${id}`, item: { id: '22', name: 'Pastel Frito', category: 'PASTEL', icon: 'fa-utensils' }, quantity, addedAt: timestamp,
      configs: Array.from({ length: quantity }, () => structuredClone(config)) }] };
}

function tempStore(t: { after: (fn: () => void) => void }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gestor-report-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, store: createReportStore(directory, () => monday) };
}

test('observação geral é preservada por lançamento mesmo após mudar a comanda e reiniciar', t => {
  const { directory, store } = tempStore(t);
  const original = order();
  original.observation = 'Para viagem';
  original.entries[0].orderObservation = 'Para viagem';
  store.sync([original]);
  original.observation = 'Servir na mesa';
  original.entries.push({ ...structuredClone(original.entries[0]), id: 'acrescimo', orderObservation: 'Servir na mesa' });
  store.sync([original]);
  const records = createReportStore(directory).readWeek(weekFor(monday).id).records;
  assert.equal(records.find((record: ReportRecord) => record.entryId === original.entries[0].id).orderObservation, 'Para viagem');
  assert.equal(records.find((record: ReportRecord) => record.entryId === 'acrescimo').orderObservation, 'Servir na mesa');
  assert.equal(records[0].configs[0].observation, 'Pra viagem');
});

test('semanas vão de segunda a domingo no fuso da padaria, inclusive na virada do ano', () => {
  assert.equal(weekFor(sunday).id, '2026-09-21_a_2026-09-27');
  assert.equal(weekFor(monday).id, '2026-09-28_a_2026-10-04');
  assert.equal(weekFor(Date.parse('2027-01-01T01:00:00-03:00')).id, '2026-12-28_a_2027-01-03');
  assert.equal(bakeryDate(Date.parse('2026-09-28T02:30:00Z')), '2026-09-27');
});

test('importa pedidos existentes uma vez, persiste em TXT e recupera após reabrir', t => {
  const { directory, store } = tempStore(t);
  const orders = [order()];
  store.sync(orders);
  const file = path.join(directory, `${weekFor(monday).id}.txt`);
  const original = fs.readFileSync(file, 'utf8');
  store.sync(orders);
  store.sync(orders);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  const reopened = createReportStore(directory, () => monday);
  reopened.sync(orders);
  const report = reopened.readWeek(weekFor(monday).id);
  assert.equal(report.records.length, 1);
  assert.equal(reportStats(report.records).validQuantity, 4);
  assert.equal(fs.readFileSync(file, 'utf8'), original);
});

test('cancelamento é idempotente, acrescenta histórico e não volta a válido com importação antiga', t => {
  const { directory, store } = tempStore(t);
  const orders = [order()];
  store.sync(orders);
  const file = path.join(directory, `${weekFor(monday).id}.txt`);
  const original = fs.readFileSync(file, 'utf8');
  const payload = { orderId: orders[0].id, entryId: orders[0].entries[0].id, reason: 'Teste de impressora' };
  store.cancel(payload);
  const cancelledFile = fs.readFileSync(file, 'utf8');
  assert.ok(cancelledFile.startsWith(original));
  assert.match(cancelledFile, /CANCELAMENTO/);
  assert.match(cancelledFile, /Teste de impressora/);
  store.cancel(payload);
  assert.equal(fs.readFileSync(file, 'utf8'), cancelledFile);
  const reopened = createReportStore(directory, () => monday);
  reopened.sync(orders);
  const result = reopened.readWeek(weekFor(monday).id);
  assert.equal(result.records[0].status, 'CANCELADO');
  assert.equal(result.records[0].cancelledAt, monday);
  assert.equal(reportStats(result.records).validQuantity, 0);
  assert.equal(reportStats(result.records).cancelledQuantity, 4);
  assert.equal(reportStats(result.records).products.length, 0);
  assert.equal(reportStats(result.records).orderCount, 0);
  assert.equal(orders[0].status, OrderStatus.PREPARING);
});

test('acréscimo na semana nova usa addedAt sem mover nem sobrescrever semana anterior', t => {
  const { directory, store } = tempStore(t);
  const previous = order('old', sunday, 1);
  store.sync([previous]);
  const oldFile = path.join(directory, `${weekFor(sunday).id}.txt`);
  const oldText = fs.readFileSync(oldFile, 'utf8');
  previous.entries.push({ ...order('new', monday, 2).entries[0] });
  store.sync([previous]);
  assert.equal(fs.readFileSync(oldFile, 'utf8'), oldText);
  assert.equal(reportStats(store.readWeek(weekFor(sunday).id).records).validQuantity, 1);
  assert.equal(reportStats(store.readWeek(weekFor(monday).id).records).validQuantity, 2);
  assert.equal(store.listWeeks().length, 2);
  // Cancelling last week's entry now is recorded in the original week.
  store.cancel({ orderId: previous.id, entryId: previous.entries[0].id });
  assert.equal(reportStats(store.readWeek(weekFor(sunday).id).records).cancelledQuantity, 1);
  assert.equal(reportStats(store.readWeek(weekFor(monday).id).records).validQuantity, 2);
});

test('andamento preserva cancelamento e os indicadores contam somente comandas com itens válidos', t => {
  const { store } = tempStore(t);
  const first = order('first', monday, 2);
  const second = order('second', monday, 3);
  store.sync([first, second]);
  store.cancel({ orderId: first.id, entryId: first.entries[0].id, reason: 'Teste' });
  for (const value of [first, second]) { value.status = OrderStatus.FINISHED; value.finishedAt = monday + 600000; }
  store.sync([first, second]);
  const stats = reportStats(store.readWeek(weekFor(monday).id).records);
  assert.equal(stats.validQuantity, 3);
  assert.equal(stats.cancelledQuantity, 2);
  assert.equal(stats.finishedCount, 1);
  assert.equal(stats.averageMinutes, 10);
  assert.deepEqual(stats.products, [{ id: '22', name: 'Pastel Frito', count: 3 }]);
});

test('dados fora do relatório e entradas sem ID não criam lançamentos falsos', t => {
  const { store } = tempStore(t);
  store.sync([null, { id: 'invalid', entries: [{ quantity: 1 }] }, order()]);
  assert.equal(store.readWeek(weekFor(monday).id).records.length, 1);
  assert.throws(() => store.cancel({ orderId: 'missing', entryId: 'missing' }), /não encontrado/);
  assert.throws(() => store.readWeek('../../pedidos'), /Semana inválida/);
});

test('arquivo incompleto é preservado e reportado, sem sobrescrever ou mostrar totais parciais', t => {
  const { directory, store } = tempStore(t);
  store.sync([order()]);
  const file = path.join(directory, `${weekFor(monday).id}.txt`);
  fs.appendFileSync(file, '{"version":1');
  const before = fs.readFileSync(file, 'utf8');
  const reopened = createReportStore(directory, () => monday);
  assert.throws(() => reopened.sync([order('another')]), /arquivo foi preservado/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('ranking soma quantidades por ID, excluindo todos os cancelados', () => {
  const record = { orderId: '1', productId: '1', productName: 'Produto', quantity: 4, status: 'VÁLIDO' } as ReportRecord;
  const stats = reportStats([record, { ...record, quantity: 2 }, { ...record, productId: '2', quantity: 99, status: 'CANCELADO' }]);
  assert.equal(stats.validQuantity, 6);
  assert.equal(stats.cancelledQuantity, 99);
  assert.equal(stats.products.length, 1);
  assert.equal(stats.products[0].count, 6);
});
