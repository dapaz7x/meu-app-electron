import { OrderDraftEntry, OrderItemConfig } from '../types';

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

// Sort a copy: IDs, the source catalog and historical orders stay unchanged.
export function byName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => collator.compare(a.name, b.name));
}

export function emptyConfig(): OrderItemConfig {
  return { selectedAddOns: [], observation: '' };
}

export function copyConfig(config: OrderItemConfig): OrderItemConfig {
  return { ...config, selectedAddOns: config.selectedAddOns.map(addOn => ({ ...addOn })) };
}

export function repeatConfig(config: OrderItemConfig, quantity: number): OrderItemConfig[] {
  return Array.from({ length: quantity }, () => copyConfig(config));
}

export const MAX_QUANTITY = 99;
export interface DraftLine extends OrderDraftEntry { individual: boolean }

export function resizeLine(line: DraftLine, quantity: number): DraftLine {
  const value = Number.isFinite(quantity) ? Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(quantity))) : line.quantity;
  const sameFlavor = line.configs.length > 0 && line.configs.every(config => config.flavor === line.configs[0].flavor);
  const common = !line.individual && (line.item.category !== 'PASTEL' || sameFlavor);
  const configs = common ? repeatConfig(line.configs[0] || emptyConfig(), value)
    : Array.from({ length: value }, (_, index) => copyConfig(line.configs[index] || emptyConfig()));
  return { ...line, quantity: value, configs };
}

export function changeFlavorCount(line: DraftLine, flavor: string, delta: 1 | -1): DraftLine {
  const configs = line.configs.map(copyConfig);
  const index = delta > 0 ? configs.findIndex(config => !config.flavor)
    : configs.map(config => config.flavor).lastIndexOf(flavor);
  if (index >= 0) configs[index].flavor = delta > 0 ? flavor : undefined;
  return { ...line, configs };
}

export function groupConfigs(configs: readonly OrderItemConfig[]): Array<{ config: OrderItemConfig; quantity: number }> {
  const groups = new Map<string, { config: OrderItemConfig; quantity: number }>();
  for (const config of configs) {
    const key = JSON.stringify([config.flavor || '', config.cheese || '', config.observation || '',
      config.selectedAddOns.map(addon => `${addon.id}:${addon.name}`).sort()]);
    const group = groups.get(key);
    if (group) group.quantity++;
    else groups.set(key, { config, quantity: 1 });
  }
  return [...groups.values()];
}

export function hasDetails(config: OrderItemConfig): boolean {
  return Boolean(config.flavor || config.cheese || config.observation || config.selectedAddOns.length);
}

export function configDescription(config: OrderItemConfig): string {
  return [config.flavor, config.cheese && `Queijo: ${config.cheese}`,
    config.selectedAddOns.map(addon => addon.name).join(', '), config.observation].filter(Boolean).join(' • ');
}

export function searchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}
