import React, { useEffect, useRef, useState } from 'react';
import { MenuItem, OrderDraftEntry, OrderItemConfig } from '../types';
import { MENU_ITEMS, SALTY_ADDONS, SWEET_ADDONS, CHEESE_OPTIONS, PASTEL_FLAVORS } from '../constants';
import { byName, changeFlavorCount, configDescription, copyConfig, DraftLine, emptyConfig, groupConfigs, MAX_QUANTITY, repeatConfig, resizeLine, searchText } from '../services/orderSelection';

interface OrderWizardProps {
  comanda: string;
  initialObservation?: string;
  onCancel: () => void;
  onDraftChange: (dirty: boolean) => void;
  onSavingChange: (saving: boolean) => void;
  onFinish: (entries: OrderDraftEntry[], observation: string) => void | Promise<void>;
}

function QuantityControl({ name, value, onChange, max = MAX_QUANTITY }: {
  name: string; value: number; onChange: (value: number) => void; max?: number;
}) {
  return <div className="flex items-center justify-center gap-2">
    <button type="button" aria-label={`Diminuir ${name}`} disabled={value === 0} onClick={() => onChange(value - 1)} className="w-11 h-11 rounded-xl bg-slate-100 text-2xl font-black disabled:opacity-30">−</button>
    <input aria-label={`Quantidade de ${name}`} type="number" inputMode="numeric" min={0} max={max} value={value}
      onFocus={event => event.target.select()} onChange={event => onChange(Number(event.target.value))}
      className="w-14 h-11 rounded-xl border-2 border-slate-200 text-center text-2xl font-black text-[#b71c1c] focus:outline-none focus:border-[#E53935]" />
    <button type="button" aria-label={`Aumentar ${name}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="w-11 h-11 rounded-xl bg-[#E53935] text-white text-2xl font-black disabled:opacity-30">+</button>
  </div>;
}

function ProductDetails({ line, onChange, onClose }: { line: DraftLine; onChange: (line: DraftLine) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [unitIndex, setUnitIndex] = useState(0);
  const isPastel = line.item.category === 'PASTEL';
  const index = Math.min(unitIndex, line.quantity - 1);
  const config = line.configs[line.individual ? index : 0] || emptyConfig();
  const remaining = line.configs.filter(unit => !unit.flavor).length;
  const addons = byName(line.item.category === 'TAPIOCA' || line.item.category === 'CREPIOCA' ? [...SALTY_ADDONS, ...SWEET_ADDONS] : SALTY_ADDONS);

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  function updateConfig(changes: Partial<OrderItemConfig>) {
    const next = { ...config, ...changes, observation: '' };
    onChange({ ...line, configs: line.individual ? line.configs.map((unit, current) => current === index ? copyConfig(next) : unit) : repeatConfig(next, line.quantity) });
  }

  function changeMode(individual: boolean) {
    if (individual === line.individual) return;
    if (!individual && groupConfigs(line.configs).length > 1 && !window.confirm('Aplicar os adicionais da unidade selecionada a todas as unidades?')) return;
    onChange({ ...line, individual, configs: individual ? line.configs : repeatConfig(config, line.quantity) });
  }

  return <dialog ref={dialog} aria-labelledby="details-title" onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}
    className="rounded-3xl p-0 w-[min(900px,95vw)] max-h-[90vh] shadow-2xl backdrop:bg-slate-950/70">
    <div className="flex flex-col max-h-[90vh]">
      <div className="p-5 border-b-2 border-slate-100 flex justify-between items-center gap-3">
        <div><h2 id="details-title" className="text-2xl font-black text-slate-900">{line.quantity}× {line.item.name}</h2>
          <p className="text-slate-500 font-bold">{isPastel ? 'Distribua a quantidade entre os sabores.' : 'Adicionais opcionais, aplicados de uma vez.'}</p></div>
        <button autoFocus onClick={onClose} aria-label="Fechar detalhes" className="w-12 h-12 rounded-xl bg-slate-100 text-2xl font-black">×</button>
      </div>
      <div className="p-5 overflow-y-auto custom-scrollbar">
        {isPastel ? <>
          <p role="status" className={`font-black mb-4 ${remaining ? 'text-[#b71c1c]' : 'text-green-700'}`}>
            {remaining ? `Falta escolher ${remaining} ${remaining === 1 ? 'sabor' : 'sabores'}.` : `${line.quantity} pastéis com sabor escolhido.`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...PASTEL_FLAVORS].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(flavor => {
              const count = line.configs.filter(unit => unit.flavor === flavor).length;
              return <div key={flavor} className={`p-4 rounded-2xl border-2 ${count ? 'bg-amber-50 border-[#C5A021]' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between gap-2 mb-3"><span className="font-black">{flavor}</span>
                  <button aria-label={`Todos de ${flavor}`} onClick={() => onChange({ ...line, configs: repeatConfig({ ...emptyConfig(), flavor }, line.quantity) })}
                    className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-black">Todos</button></div>
                <div className="flex items-center justify-center gap-4">
                  <button aria-label={`Diminuir sabor ${flavor}`} disabled={!count} onClick={() => onChange(changeFlavorCount(line, flavor, -1))} className="w-11 h-11 bg-white border-2 border-slate-200 rounded-xl text-2xl font-black disabled:opacity-30">−</button>
                  <span aria-label={`Quantidade do sabor ${flavor}`} className="w-10 text-center text-2xl font-black">{count}</span>
                  <button aria-label={`Aumentar sabor ${flavor}`} disabled={!remaining} onClick={() => onChange(changeFlavorCount(line, flavor, 1))} className="w-11 h-11 bg-[#E53935] text-white rounded-xl text-2xl font-black disabled:opacity-30">+</button>
                </div>
              </div>;
            })}
          </div>
        </> : <>
          {line.quantity > 1 && <div className="mb-5">
            <div className="flex gap-2">
              <button aria-pressed={!line.individual} onClick={() => changeMode(false)} className={`flex-1 p-3 rounded-xl font-black ${!line.individual ? 'bg-[#C5A021] text-white' : 'bg-slate-100'}`}>Todos iguais</button>
              <button aria-pressed={line.individual} onClick={() => changeMode(true)} className={`flex-1 p-3 rounded-xl font-black ${line.individual ? 'bg-[#C5A021] text-white' : 'bg-slate-100'}`}>Adicionais diferentes</button>
            </div>
            <p className="text-sm text-slate-500 mt-2">{line.individual ? 'Escolha a unidade que precisa de adicionais diferentes.' : `O que escolher vale para as ${line.quantity} unidades.`}</p>
          </div>}
          {line.individual && <div role="tablist" aria-label="Unidades do produto" className="flex gap-2 overflow-x-auto pb-3 mb-3">
            {line.configs.map((_, current) => <button key={current} role="tab" aria-selected={current === index} onClick={() => setUnitIndex(current)}
              className={`px-4 py-3 rounded-xl whitespace-nowrap font-black ${current === index ? 'bg-[#E53935] text-white' : 'bg-slate-100'}`}>Unidade {current + 1}</button>)}
          </div>}
          {line.item.category === 'BURGER' && <div className="mb-5">
            <h3 className="font-black uppercase mb-3">Queijo</h3>
            <div className="flex gap-3">{CHEESE_OPTIONS.map(cheese => <button key={cheese} aria-pressed={(config.cheese || 'Nenhum') === cheese}
              onClick={() => updateConfig({ cheese: cheese === 'Nenhum' ? undefined : cheese })}
              className={`flex-1 p-3 rounded-xl border-2 font-black ${(config.cheese || 'Nenhum') === cheese ? 'bg-[#E53935] text-white border-[#E53935]' : 'border-slate-200'}`}>{cheese}</button>)}</div>
          </div>}
          <h3 className="font-black uppercase mb-3">Adicionais</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Lista de adicionais">{addons.map(addon => {
            const selected = config.selectedAddOns.some(value => value.id === addon.id);
            return <button key={addon.id} aria-pressed={selected} onClick={() => updateConfig({ selectedAddOns: selected ? config.selectedAddOns.filter(value => value.id !== addon.id) : [...config.selectedAddOns, addon] })}
              className={`p-4 rounded-xl border-2 font-bold ${selected ? 'bg-[#C5A021] text-white border-[#C5A021]' : 'border-slate-100'}`}>{addon.name}</button>;
          })}</div>
        </>}
      </div>
      <div className="p-4 border-t-2 border-slate-100 flex justify-end"><button onClick={onClose} className="bg-[#C5A021] text-white rounded-xl px-8 py-4 font-black">Concluir detalhes</button></div>
    </div>
  </dialog>;
}

const OrderWizard: React.FC<OrderWizardProps> = ({ comanda, initialObservation = '', onCancel, onFinish, onDraftChange, onSavingChange }) => {
  const [lines, setLines] = useState<Record<string, DraftLine>>({});
  const [observation, setObservation] = useState(initialObservation);
  const [search, setSearch] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const selected = byName(Object.values(lines).filter(line => line.quantity > 0).map(line => ({ ...line, name: line.item.name })));
  const total = selected.reduce((sum, line) => sum + line.quantity, 0);
  const dirty = total > 0 || observation !== initialObservation;
  const items = byName(MENU_ITEMS).filter(item => (!selectedOnly || lines[item.id]?.quantity > 0)
    && searchText(item.name).includes(searchText(search.trim())));

  useEffect(() => { onDraftChange(dirty); }, [dirty, onDraftChange]);
  useEffect(() => () => { onDraftChange(false); onSavingChange(false); }, [onDraftChange, onSavingChange]);

  function lineFor(item: MenuItem): DraftLine {
    return lines[item.id] || { item, quantity: 0, configs: [], individual: false };
  }
  function updateLine(line: DraftLine) {
    setLines(current => ({ ...current, [line.item.id]: line }));
    setError('');
  }
  function openDetails(item: MenuItem) {
    if (!lines[item.id]?.quantity) updateLine(resizeLine(lineFor(item), 1));
    setDetailsId(item.id);
  }

  async function finish() {
    if (!total || submitting.current) return;
    const missing = selected.find(line => line.item.category === 'PASTEL' && line.configs.some(config => !config.flavor));
    if (missing) {
      setDetailsId(missing.item.id);
      setError('Escolha os sabores dos pastéis antes de enviar.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    onSavingChange(true);
    setError('');
    try {
      await onFinish(selected.map(({ item, quantity, configs }) => ({ item, quantity, configs: configs.map(copyConfig) })), observation.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar. Seus itens continuam aqui.');
    } finally {
      submitting.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  }

  return <div className="h-full flex flex-col bg-slate-50">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-b-2 border-slate-100 p-4">
      <button disabled={saving} onClick={onCancel} className="px-5 py-3 bg-slate-900 text-white rounded-xl font-black disabled:opacity-40">Voltar ao painel</button>
      <p className="font-black text-slate-600">Comanda {comanda} • Selecione os produtos e envie juntos</p>
    </div>
    <fieldset disabled={saving} className="flex-1 min-h-0 min-w-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0 lg:overflow-y-auto p-4 custom-scrollbar">
        <div className="flex gap-3 mb-4 items-center sticky top-0 bg-slate-50 py-2 z-10">
          <div className="relative flex-1"><input aria-label="Buscar produto" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto…"
            className="w-full p-3 pr-12 rounded-xl border-2 border-slate-200 focus:outline-none focus:border-[#E53935]" />
            {search && <button aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-1 top-1 w-10 h-10 font-black text-xl">×</button>}
          </div>
          <button aria-pressed={selectedOnly} onClick={() => setSelectedOnly(value => !value)} className={`px-4 py-3 rounded-xl font-black text-sm border-2 ${selectedOnly ? 'bg-amber-50 border-[#C5A021]' : 'bg-white border-slate-200'}`}>Selecionados ({selected.length})</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {items.map(item => {
            const line = lineFor(item);
            const missingFlavor = item.category === 'PASTEL' && line.configs.some(config => !config.flavor);
            const details = groupConfigs(line.configs).map(group => {
              const description = configDescription(group.config);
              return description && `${group.quantity}× ${description}`;
            }).filter(Boolean).join('; ');
            return <article key={item.id} aria-label={item.name} className={`bg-white rounded-2xl border-2 p-3 flex flex-col shadow-sm ${line.quantity ? 'border-[#C5A021] bg-amber-50' : 'border-slate-200'}`}>
              <button aria-label={`Adicionar ${item.name}`} onClick={() => updateLine(resizeLine(line, line.quantity + 1))} className="flex flex-col items-center justify-center gap-2 flex-1 min-h-24 mb-3">
                <i aria-hidden="true" className={`${item.icon} text-2xl text-[#E53935]`}></i><span data-product-name className="font-black text-center text-slate-800 leading-tight">{item.name}</span>
              </button>
              <QuantityControl name={item.name} value={line.quantity} onChange={value => updateLine(resizeLine(line, value))} />
              <button aria-label={`${item.category === 'PASTEL' ? 'Sabores' : 'Adicionais'} de ${item.name}`} onClick={() => openDetails(item)}
                className={`mt-3 p-2 rounded-lg font-bold text-sm ${missingFlavor ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>
                {item.category === 'PASTEL' ? missingFlavor ? 'Escolher sabores' : 'Sabores' : item.category === 'BURGER' ? 'Adicionais / queijo' : 'Adicionais'}
              </button>
              {details && <p className="mt-2 text-xs text-slate-600 break-words">{details}</p>}
            </article>;
          })}
        </div>
        {!items.length && <p className="p-6 text-center text-slate-500 font-bold">Nenhum produto encontrado.</p>}
      </div>
      <aside aria-label="Resumo da comanda" className="lg:w-80 xl:w-96 shrink-0 bg-white border-t-2 lg:border-t-0 lg:border-l-2 border-slate-200 p-4 flex flex-col gap-3 lg:overflow-y-auto custom-scrollbar">
        <div><h2 className="font-black text-xl">Resumo • Comanda {comanda}</h2><p aria-live="polite" className="text-slate-500">{total} {total === 1 ? 'unidade selecionada' : 'unidades selecionadas'}</p></div>
        <div className="space-y-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar">
          {!selected.length && <p className="text-slate-400 py-3">Use + abaixo do produto ou toque no nome para adicionar.</p>}
          {selected.map(line => <div key={line.item.id} className="flex items-start gap-2 border-b border-slate-100 pb-3">
            <button onClick={() => openDetails(line.item)} className="flex-1 text-left"><span className="font-black">{line.quantity}× {line.item.name}</span>
              <span className="block text-xs text-slate-500 mt-1">{line.item.category === 'PASTEL' && line.configs.some(config => !config.flavor) ? 'Falta escolher sabores' : 'Toque para ajustar os detalhes'}</span></button>
            <button aria-label={`Remover ${line.item.name}`} onClick={() => updateLine(resizeLine(line, 0))} className="w-10 h-10 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 text-2xl">×</button>
          </div>)}
        </div>
        <div><label htmlFor="order-observation" className="block font-black mb-2">Observação da comanda</label>
          <textarea id="order-observation" value={observation} maxLength={500} onChange={event => setObservation(event.target.value)} placeholder="Ex.: para viagem; 1 Kids sem cebola…"
            className="w-full h-24 p-3 border-2 border-slate-200 rounded-xl resize-none focus:outline-none focus:border-[#E53935]" />
          <p className="text-xs text-slate-500">Vale para toda a comanda e sai uma vez no cupom. Para exceções, indique o produto.</p>
          <button onClick={() => setObservation(value => /para viagem/i.test(value) ? value : `${value.trim()}${value.trim() ? '; ' : ''}Para viagem`.slice(0, 500))}
            className="mt-2 px-3 py-2 rounded-lg bg-amber-50 text-sm font-black text-slate-700">+ Para viagem</button>
        </div>
        <div className="mt-auto">
          {error && <p role="alert" className="mb-3 font-bold text-red-700">{error}</p>}
          <button disabled={saving || !total} onClick={finish} className="w-full py-5 px-3 rounded-2xl bg-[#C5A021] text-white font-black text-xl shadow-md disabled:opacity-40">
            {saving ? 'Enviando…' : `Enviar ${total} ${total === 1 ? 'item' : 'itens'} para a chapa`}
          </button>
        </div>
      </aside>
    </fieldset>
    {detailsId && lines[detailsId]?.quantity > 0 && <ProductDetails key={detailsId} line={lines[detailsId]} onChange={updateLine} onClose={() => setDetailsId(null)} />}
  </div>;
};

export default OrderWizard;
