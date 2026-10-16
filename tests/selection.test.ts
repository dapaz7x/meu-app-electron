import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byName, changeFlavorCount, emptyConfig, groupConfigs, repeatConfig, resizeLine } from '../services/orderSelection';
import { MENU_ITEMS, SALTY_ADDONS, SWEET_ADDONS } from '../constants';

test('ordena uma cópia com acentos e produtos novos sem mudar IDs ou dados originais', () => {
  const original = [{ id: 'z', name: 'Zebra' }, { id: 'a', name: 'Água' }, { id: 'b', name: 'Bolo' }];
  const snapshot = structuredClone(original);
  assert.deepEqual(byName(original).map(item => item.id), ['a', 'b', 'z']);
  assert.deepEqual(original, snapshot);
  const imported = JSON.parse('[{"id":"new","name":"Abacaxi"}]');
  assert.equal(byName([...original, ...imported])[0].id, 'new');
  for (const values of [MENU_ITEMS, SALTY_ADDONS, [...SALTY_ADDONS, ...SWEET_ADDONS]]) {
    const sorted = byName<{ id: string; name: string }>(values);
    assert.equal(sorted.length, values.length);
    assert.deepEqual(new Set(sorted.map(item => item.id)), new Set(values.map(item => item.id)));
  }
});

test('quatro iguais mantêm quatro configurações independentes compatíveis com a impressão', () => {
  const base = { ...emptyConfig(), selectedAddOns: [{ id: 's2', name: 'Bacon', type: 'SALGADO' as const }], observation: 'Sem cebola', cheese: 'Cheddar' };
  const units = repeatConfig(base, 4);
  assert.equal(units.length, 4);
  units.forEach(unit => assert.deepEqual(unit, base));
  units[1].observation = 'Bem passado';
  units[1].selectedAddOns[0].name = 'Outro';
  assert.equal(units[0].observation, 'Sem cebola');
  assert.equal(units[2].selectedAddOns[0].name, 'Bacon');
  assert.equal(base.selectedAddOns[0].name, 'Bacon');
});

test('ajustar quantidade mantém adicionais e limita valores sem criar unidades fracionadas', () => {
  const item = MENU_ITEMS.find(item => item.category === 'BURGER')!;
  const line = { item, quantity: 1, configs: [{ ...emptyConfig(), selectedAddOns: [SALTY_ADDONS[0]] }], individual: false };
  const four = resizeLine(line, 4);
  assert.equal(four.configs.length, 4);
  assert.equal(four.configs[3].selectedAddOns[0].id, SALTY_ADDONS[0].id);
  four.configs[2].selectedAddOns.length = 0;
  assert.equal(four.configs[0].selectedAddOns.length, 1);
  assert.equal(resizeLine(line, 2.8).quantity, 2);
  assert.equal(resizeLine(line, 1000).quantity, 99);
  assert.equal(resizeLine(line, NaN).quantity, 1);
  assert.deepEqual(resizeLine(line, -1).configs, []);
});

test('sabores mistos conservam as quantidades ao acrescentar, reduzir e trocar sabores', () => {
  const item = MENU_ITEMS.find(item => item.category === 'PASTEL')!;
  let line = { item, quantity: 4, configs: repeatConfig(emptyConfig(), 4), individual: false };
  line = changeFlavorCount(changeFlavorCount(line, 'Carne', 1), 'Carne', 1);
  line = changeFlavorCount(changeFlavorCount(line, 'Queijo', 1), 'Pizza', 1);
  assert.deepEqual(line.configs.map(config => config.flavor), ['Carne', 'Carne', 'Queijo', 'Pizza']);
  assert.deepEqual(changeFlavorCount(line, 'Alho Poró', 1), line);
  line = changeFlavorCount(changeFlavorCount(line, 'Carne', -1), 'Alho Poró', 1);
  assert.deepEqual(line.configs.map(config => config.flavor), ['Carne', 'Alho Poró', 'Queijo', 'Pizza']);
  const five = resizeLine(line, 5);
  assert.equal(five.configs[4].flavor, undefined);
  assert.deepEqual(resizeLine(five, 4).configs, line.configs);
});

test('agrupa detalhes iguais sem misturar sabores, queijos ou observações antigas diferentes', () => {
  const base = { ...emptyConfig(), flavor: 'Carne', selectedAddOns: [SALTY_ADDONS[0], SALTY_ADDONS[1]] };
  const reversed = { ...base, selectedAddOns: [...base.selectedAddOns].reverse() };
  const configs = [base, reversed, { ...base, observation: 'Sem sal' }, { ...base, cheese: 'Cheddar' }, { ...base, flavor: 'Queijo' }];
  const before = structuredClone(configs);
  assert.deepEqual(groupConfigs(configs).map(group => group.quantity), [2, 1, 1, 1]);
  assert.deepEqual(configs, before);
});
