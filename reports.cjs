const fs = require('node:fs');
const path = require('node:path');

// Calendar dates always follow the bakery's timezone, even on a differently configured PC.
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
});

function dateKey(timestamp) {
  const parts = Object.fromEntries(dateFormatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekFor(timestamp) {
  const start = new Date(`${dateKey(timestamp)}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  return { id: `${from}_a_${to}`, start: from, end: to };
}

const recordKey = (orderId, entryId) => JSON.stringify([orderId, entryId]);

function createReportStore(directory, now = Date.now) {
  const records = new Map();
  let loaded = false;

  function apply(event) {
    const key = recordKey(event.orderId, event.entryId);
    if (event.kind === 'LANÇAMENTO') {
      if (!records.has(key)) records.set(key, { ...structuredClone(event.record), status: 'VÁLIDO' });
    } else if (event.kind === 'CANCELAMENTO') {
      const record = records.get(key);
      if (!record) throw new Error('Cancelamento sem lançamento original.');
      if (record.status !== 'CANCELADO') {
        Object.assign(record, { status: 'CANCELADO', cancelledAt: event.at, cancellationReason: event.reason });
      }
    } else if (event.kind === 'ANDAMENTO') {
      const record = records.get(key);
      if (!record) throw new Error('Andamento sem lançamento original.');
      Object.assign(record, event.changes);
    } else throw new Error('Evento de relatório desconhecido.');
  }

  function load() {
    if (loaded) return;
    fs.mkdirSync(directory, { recursive: true });
    records.clear();
    const files = fs.readdirSync(directory).filter(file => /^\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.txt$/.test(file)).sort();
    for (const file of files) {
      const lines = fs.readFileSync(path.join(directory, file), 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (!line || line.startsWith('#')) continue;
        try {
          const event = JSON.parse(line);
          if (event.version !== 1 || !event.orderId || !event.entryId || !Number.isFinite(event.at)) throw new Error('Evento inválido.');
          if (event.kind === 'LANÇAMENTO' && (!event.record || event.record.week !== file.slice(0, -4)
            || event.record.orderId !== event.orderId || event.record.entryId !== event.entryId
            || !Number.isInteger(event.record.quantity) || event.record.quantity < 1)) throw new Error('Lançamento inválido.');
          apply(event);
        } catch {
          throw new Error(`Não foi possível ler ${file}, linha ${index + 1}. O arquivo foi preservado; confira-o antes de continuar.`);
        }
      }
    }
    loaded = true;
  }

  function append(week, events) {
    if (!events.length) return;
    if (!/^\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('Semana inválida.');
    const file = path.join(directory, `${week}.txt`);
    const header = !fs.existsSync(file) || fs.statSync(file).size === 0
      ? `# Gestor de Chapa — Padaria Araújo\n# Semana: ${week}\n# Histórico permanente: uma linha JSON por evento. CANCELAMENTO preserva o LANÇAMENTO original.\n`
      : '';
    const descriptor = fs.openSync(file, 'a');
    try {
      fs.writeFileSync(descriptor, header + events.map(event => JSON.stringify(event)).join('\n') + '\n', 'utf8');
      fs.fsyncSync(descriptor);
    } catch (error) {
      // Reload before any retry: a write may have completed even if flush failed.
      loaded = false;
      throw error;
    } finally {
      fs.closeSync(descriptor);
    }
    events.forEach(apply);
  }

  function sync(orders) {
    load();
    const pending = new Map();
    const seen = new Set();
    for (const order of orders) {
      if (!order?.id || !Array.isArray(order.entries)) continue;
      for (const entry of order.entries) {
        if (!entry?.id || !entry.item?.id || !entry.item?.name || !Number.isInteger(entry.quantity) || entry.quantity < 1) continue;
        const key = recordKey(order.id, entry.id);
        if (seen.has(key)) continue;
        seen.add(key);
        const previous = records.get(key);
        const addedAt = Number(entry.addedAt || order.createdAt);
        if (!Number.isFinite(addedAt) || !Number.isFinite(new Date(addedAt).getTime())) continue;
        const week = previous?.week || weekFor(addedAt).id;
        const changes = {
          orderStatus: order.status,
          readyAt: order.readyAt || null,
          finishedAt: order.finishedAt || null
        };
        let event;
        if (!previous) {
          event = {
            version: 1, kind: 'LANÇAMENTO', at: now(), orderId: order.id, entryId: entry.id,
            record: {
              week, orderId: order.id, entryId: entry.id, comanda: order.comanda,
              productId: entry.item.id, productName: entry.item.name, quantity: entry.quantity,
              configs: entry.configs || [], orderObservation: entry.orderObservation ?? order.observation ?? '',
              addedAt, orderCreatedAt: order.createdAt, ...changes
            }
          };
        } else if (Object.entries(changes).some(([field, value]) => previous[field] !== value)) {
          event = { version: 1, kind: 'ANDAMENTO', at: now(), orderId: order.id, entryId: entry.id, changes };
        }
        if (event) {
          if (!pending.has(week)) pending.set(week, []);
          pending.get(week).push(event);
        }
      }
    }
    for (const [week, events] of pending) append(week, events);
  }

  function listWeeks() {
    load();
    return [...new Set([weekFor(now()).id, ...[...records.values()].map(record => record.week)])]
      .sort().reverse().map(id => ({ id, start: id.slice(0, 10), end: id.slice(13) }));
  }

  function readWeek(week) {
    load();
    if (!/^\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('Semana inválida.');
    return {
      week: { id: week, start: week.slice(0, 10), end: week.slice(13) },
      records: structuredClone([...records.values()].filter(record => record.week === week).sort((a, b) => b.addedAt - a.addedAt))
    };
  }

  function cancel({ orderId, entryId, reason = '' }) {
    load();
    if (typeof orderId !== 'string' || typeof entryId !== 'string' || typeof reason !== 'string' || reason.length > 200) throw new Error('Cancelamento inválido.');
    const record = records.get(recordKey(orderId, entryId));
    if (!record) throw new Error('Lançamento não encontrado. Atualize o relatório.');
    if (record.status !== 'CANCELADO') append(record.week, [{
      version: 1, kind: 'CANCELAMENTO', at: now(), orderId, entryId,
      reason: reason.trim() || 'Não informado',
      productName: record.productName, quantity: record.quantity, status: 'CANCELADO'
    }]);
    return readWeek(record.week);
  }

  return { sync, listWeeks, readWeek, cancel };
}

module.exports = { createReportStore, weekFor, dateKey };
