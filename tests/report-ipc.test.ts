import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = fs.readFileSync(path.join(import.meta.dirname, '..', 'main.js'), 'utf8');

function computer(directory: string, mode: string, remote?: any) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'rede.json'), JSON.stringify({ mode, serverIp: '192.168.50.135', port: 37842 }));
  const handlers = new Map<string, Function>();
  const context = vm.createContext({
    console, Buffer, URL, AbortSignal, setTimeout, clearTimeout, setInterval, clearInterval,
    __dirname: path.join(import.meta.dirname, '..'), process,
    require: (id: string) => {
      if (id === 'electron') return {
        app: { getPath: () => directory, getVersion: () => '1.0.20', whenReady: () => ({ then: () => {} }), on: () => {} },
        ipcMain: { handle: (name: string, callback: Function) => handlers.set(name, callback) },
        shell: { openPath: async () => '' }, dialog: {}, BrowserWindow: class {}
      };
      if (id === 'electron-updater') return { autoUpdater: { on: () => {} } };
      if (id === 'net') return { isIP: () => 4, createConnection: () => { throw new Error('Real sockets prohibited in this test'); } };
      if (id === 'http') return { createServer: () => { throw new Error('Real server prohibited in this test'); } };
      if (id === 'child_process') return { execFile: () => { throw new Error('Real printing prohibited in this test'); } };
      if (id === './reports.cjs') return require('../reports.cjs');
      return require(id);
    },
    fetch: async (url: string, options: any = {}) => {
      if (!remote) throw new Error('Unexpected remote request');
      const request = Object.assign(new EventEmitter(), { method: options.method || 'GET', url: new URL(url).pathname + new URL(url).search, socket: { remoteAddress: '192.168.50.136' } });
      let status: number;
      let body: any;
      const response = { writeHead: (value: number) => { status = value; }, end: (value: string) => { body = JSON.parse(value); } };
      const running = remote.handleOrderRequest(request, response);
      if (options.body) request.emit('data', options.body);
      request.emit('end');
      await running;
      return { ok: status! >= 200 && status! < 300, status: status!, json: async () => body };
    }
  });
  vm.runInContext(source, context);
  return { context, call: (name: string, payload?: any) => handlers.get(name)!(null, payload) };
}

test('principal e secundário usam os mesmos TXT/cancelamentos sem reimprimir ou alterar a comanda', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gestor-ipc-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const host = computer(path.join(directory, 'host'), 'host');
  const client = computer(path.join(directory, 'client'), 'client', host.context);
  const timestamp = Date.now();
  const order = { id: 'order-1', comanda: '123', status: 'EM PREPARO', createdAt: timestamp, entries: [{ id: 'entry-1', item: { id: '22', name: 'Pastel Frito' }, quantity: 2, configs: [], addedAt: timestamp }] };
  const notedOrder = { ...order, observation: 'Embalar separados', entries: order.entries.map(entry => ({ ...entry, orderObservation: 'Embalar separados' })) };
  await client.call('orders-save', notedOrder);
  const weeks = await client.call('reports-weeks');
  const report = await client.call('reports-week', weeks[0].id);
  assert.equal(report.records.length, 1);
  assert.equal(report.records[0].quantity, 2);
  assert.equal(report.records[0].orderObservation, 'Embalar separados');
  assert.equal((await host.call('orders-list'))[0].observation, 'Embalar separados');
  const before = fs.readFileSync(path.join(directory, 'host', 'pedidos.json'), 'utf8');
  const cancel = { orderId: order.id, entryId: 'entry-1', reason: 'Teste do sistema' };
  await client.call('reports-cancel', cancel);
  const cancelled = await host.call('reports-week', weeks[0].id);
  assert.equal(cancelled.records[0].status, 'CANCELADO');
  assert.equal(cancelled.records[0].cancellationReason, 'Teste do sistema');
  assert.equal(fs.readFileSync(path.join(directory, 'host', 'pedidos.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(directory, 'client', 'relatorios')), false);
  const restarted = computer(path.join(directory, 'host'), 'host');
  const afterRestart = await restarted.call('reports-week', weeks[0].id);
  assert.equal(afterRestart.records[0].status, 'CANCELADO');
  await assert.rejects(client.call('reports-open-folder'), /PC principal/);
});
