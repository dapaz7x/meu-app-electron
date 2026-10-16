import { OrderStatus, ReportRecord } from '../types';

const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });

export function bakeryDate(timestamp: number): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function reportStats(records: ReportRecord[]) {
  const valid = records.filter(record => record.status === 'VÁLIDO');
  const cancelled = records.filter(record => record.status === 'CANCELADO');
  const products = new Map<string, { id: string; name: string; count: number }>();
  const orders = new Map<string, ReportRecord>();
  for (const record of valid) {
    const product = products.get(record.productId) || { id: record.productId, name: record.productName, count: 0 };
    product.count += record.quantity;
    products.set(product.id, product);
    orders.set(record.orderId, record);
  }
  const finished = [...orders.values()].filter(record => record.orderStatus === OrderStatus.FINISHED && record.finishedAt);
  return {
    validQuantity: valid.reduce((sum, record) => sum + record.quantity, 0),
    cancelledQuantity: cancelled.reduce((sum, record) => sum + record.quantity, 0),
    products: [...products.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR')),
    orderCount: orders.size,
    finishedCount: finished.length,
    averageMinutes: finished.length ? finished.reduce((sum, record) => sum + Math.max(0, record.finishedAt! - record.orderCreatedAt) / 60000, 0) / finished.length : 0
  };
}
