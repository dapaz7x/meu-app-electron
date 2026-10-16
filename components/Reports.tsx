import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ReportRecord, ReportWeek, WeeklyReport } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { bakeryDate, reportStats } from '../services/reportData';
import { groupConfigs, configDescription } from '../services/orderSelection';

const shortDate = (value: string) => value.split('-').reverse().join('/');
const dateTime = (value: number) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const Reports: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [weeks, setWeeks] = useState<ReportWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [todayOnly, setTodayOnly] = useState(false);
  const [filter, setFilter] = useState('TODOS');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [cancelling, setCancelling] = useState<ReportRecord | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const cancelBusy = useRef(false);
  const PAGE_SIZE = 30;

  useEffect(() => {
    let active = true;
    if (!window.electronAPI?.reportsWeeks) {
      setError('Abra o aplicativo instalado para acessar os relatórios persistentes em TXT.');
      setLoading(false);
      return;
    }
    window.electronAPI.reportsWeeks().then(result => {
      if (!active) return;
      setWeeks(result);
      setSelectedWeek(current => current || result[0]?.id || '');
    }).catch(cause => { if (active) { setError(String(cause.message || cause)); setLoading(false); } });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!selectedWeek || !window.electronAPI?.reportsWeek) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setReport(null);
    setLoading(true);
    const load = async () => {
      try {
        const result = await window.electronAPI!.reportsWeek(selectedWeek);
        if (active) { setReport(result); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o relatório.');
      } finally {
        if (active) { setLoading(false); timer = setTimeout(load, 10000); }
      }
    };
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [selectedWeek, refresh]);

  useEffect(() => { setPage(0); }, [selectedWeek, todayOnly, filter, search]);

  const records = useMemo(() => (report?.records || []).filter(record => !todayOnly || bakeryDate(record.addedAt) === bakeryDate(Date.now())), [report, todayOnly]);
  const stats = useMemo(() => reportStats(records), [records]);
  const visible = records.filter(record => (filter === 'TODOS' || record.status === filter)
    && normalize(`${record.productName} ${record.comanda} ${record.configs.map(config => config.flavor || '').join(' ')}`).includes(normalize(search)));
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const chartData = stats.products.slice(0, 10);

  const confirmCancellation = async () => {
    if (!cancelling || !window.electronAPI?.reportsCancel || cancelBusy.current) return;
    cancelBusy.current = true;
    setSaving(true);
    try {
      await window.electronAPI.reportsCancel({ orderId: cancelling.orderId, entryId: cancelling.entryId, reason });
      setCancelling(null);
      setRefresh(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar.');
    } finally {
      cancelBusy.current = false;
      setSaving(false);
    }
  };

  const openFolder = async () => {
    try { await window.electronAPI?.reportsOpenFolder(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a pasta.'); }
  };

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col p-6 lg:p-10 overflow-y-auto">
      <div className="flex justify-between gap-4 items-center mb-6 border-b-4 border-slate-50 pb-6">
        <div><h2 className="text-3xl lg:text-4xl font-black uppercase text-slate-900 tracking-tight">Performance de Vendas</h2><p className="text-[#C5A021] font-black uppercase mt-2">{todayOnly ? `Hoje • ${shortDate(bakeryDate(Date.now()))}` : report ? `${shortDate(report.week.start)} a ${shortDate(report.week.end)}` : 'Relatório semanal'}</p></div>
        <button aria-label="Fechar relatórios" onClick={onClose} className="bg-slate-900 text-white w-14 h-14 rounded-full text-2xl shrink-0"><i className="fa-solid fa-times"></i></button>
      </div>
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <label className="font-black">Semana <select aria-label="Semana do relatório" value={selectedWeek} onChange={event => { setSelectedWeek(event.target.value); setTodayOnly(false); }} className="ml-2 p-3 rounded-xl border-2 border-slate-200 bg-white">{weeks.map(week => <option key={week.id} value={week.id}>{shortDate(week.start)} a {shortDate(week.end)}</option>)}</select></label>
        <button onClick={() => setTodayOnly(false)} className={`p-3 rounded-xl font-black ${!todayOnly ? 'bg-[#C5A021] text-white' : 'bg-slate-100'}`}>Semana inteira</button>
        <button onClick={() => { const today = bakeryDate(Date.now()); const current = weeks.find(week => week.start <= today && week.end >= today); if (current) setSelectedWeek(current.id); setTodayOnly(true); }} className={`p-3 rounded-xl font-black ${todayOnly ? 'bg-[#C5A021] text-white' : 'bg-slate-100'}`}>Hoje</button>
        <button onClick={() => setRefresh(value => value + 1)} className="p-3 rounded-xl bg-slate-100 font-black">Atualizar</button>
        <button onClick={openFolder} className="p-3 rounded-xl border-2 border-slate-200 font-black"><i className="fa-solid fa-folder-open mr-2"></i>Pasta dos TXT</button>
      </div>
      {error && <p role="alert" className="p-4 mb-4 rounded-xl bg-red-50 text-red-800 font-bold">{error}</p>}
      {loading && <p className="p-4 font-bold">Carregando relatório…</p>}
      {report && !loading && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-4">
          {[['Total vendido • unidades válidas', stats.validQuantity, 'border-[#C5A021]'], ['Unidades canceladas', stats.cancelledQuantity, 'border-[#E53935]'], ['Produtos vendidos • tipos', stats.products.length, 'border-slate-900']].map(([label, value, color]) => (
            <div key={label} className={`bg-slate-50 p-6 rounded-3xl border-b-8 ${color}`}><p className="text-xs font-black uppercase text-slate-500 mb-3">{label}</p><p className="text-5xl font-black text-slate-900">{value}</p></div>
          ))}
        </div>
        <p className="text-sm text-slate-500 font-bold mb-6">{stats.orderCount} comandas com itens válidos • {stats.finishedCount} finalizadas • Tempo médio até finalizar: {stats.averageMinutes.toFixed(1)} min. Relatório de quantidades, sem valores em R$.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
          <div className="bg-slate-50 rounded-3xl p-5 min-w-0"><h3 className="font-black uppercase text-xl mb-4">Top itens da chapa</h3>{chartData.length ? <div style={{ height: 320 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="name" type="category" width={145} tick={{ fontSize: 11, fontWeight: 'bold' }} /><Tooltip /><Bar dataKey="count" name="Unidades válidas" radius={[0, 8, 8, 0]} barSize={22}>{chartData.map((product, index) => <Cell key={product.id} fill={index % 2 === 0 ? '#E53935' : '#C5A021'} />)}</Bar></BarChart></ResponsiveContainer></div> : <p className="text-slate-500 py-8">Nenhum item válido neste período.</p>}</div>
          <div className="border-2 border-slate-100 rounded-3xl p-5"><h3 className="font-black uppercase text-xl mb-4">Quantidade por produto</h3><div className="max-h-80 overflow-y-auto"><table className="w-full text-left"><thead><tr className="border-b-2"><th className="pb-3">Produto</th><th className="pb-3 text-right">Válidos</th><th className="pb-3 text-right">Participação</th></tr></thead><tbody>{stats.products.map(product => <tr key={product.id} className="border-b border-slate-100"><td className="py-3 font-bold">{product.name}</td><td className="text-right">{product.count}</td><td className="text-right">{(product.count / stats.validQuantity * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></div>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4"><h3 className="font-black uppercase text-2xl">Histórico de lançamentos</h3><div className="flex flex-wrap gap-3"><input aria-label="Pesquisar lançamentos" placeholder="Produto, sabor ou comanda" value={search} onChange={event => setSearch(event.target.value)} className="p-3 rounded-xl border-2 border-slate-200" /><select aria-label="Status do lançamento" value={filter} onChange={event => setFilter(event.target.value)} className="p-3 rounded-xl border-2 border-slate-200"><option value="TODOS">Válidos e cancelados</option><option value="VÁLIDO">Somente válidos</option><option value="CANCELADO">Somente cancelados</option></select></div></div>
        <div className="space-y-3">{visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(record => (
          <div key={JSON.stringify([record.orderId, record.entryId])} className={`p-5 rounded-2xl border-2 flex flex-wrap justify-between items-start gap-4 ${record.status === 'CANCELADO' ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
            <div className="flex-1 min-w-0"><p className="font-black text-lg">{record.quantity}× {record.productName} <span className="text-slate-500">• Comanda {record.comanda}</span></p><p className="text-sm text-slate-500 mt-1">{dateTime(record.addedAt)}</p><div className="mt-2 space-y-1">{groupConfigs(record.configs).map(({ config, quantity }, index) => <p key={index} className="text-sm break-words">{quantity}× {configDescription(config) || 'Sem adicionais'}</p>)}{record.orderObservation && <p className="text-sm font-bold whitespace-pre-wrap break-words">Observação da comanda: {record.orderObservation}</p>}</div>{record.status === 'CANCELADO' && <p className="text-sm text-red-800 mt-2">Cancelado em {dateTime(record.cancelledAt!)} • Motivo: {record.cancellationReason}</p>}</div>
            <div className="flex flex-col gap-3 items-end"><span className={`px-3 py-1 rounded-lg text-xs font-black ${record.status === 'CANCELADO' ? 'bg-red-200 text-red-900' : 'bg-emerald-100 text-emerald-900'}`}>{record.status}</span>{record.status === 'VÁLIDO' && <button onClick={() => { setCancelling(record); setReason(''); }} className="px-4 py-3 border-2 border-red-200 text-red-700 font-black rounded-xl">Cancelar lançamento</button>}</div>
          </div>
        ))}{visible.length === 0 && <p className="p-6 bg-slate-50 rounded-2xl text-slate-500">Nenhum lançamento encontrado.</p>}</div>
        <div className="flex items-center justify-center gap-4 mt-5"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="p-3 font-bold disabled:opacity-30">Anterior</button><span>Página {currentPage + 1} de {pageCount} • {visible.length} lançamentos</span><button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} className="p-3 font-bold disabled:opacity-30">Próxima</button></div>
      </>}
      {cancelling && <div className="fixed inset-0 bg-slate-950/70 z-[100] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><div className="bg-white p-7 rounded-3xl max-w-lg w-full shadow-2xl"><h3 id="cancel-title" className="text-2xl font-black mb-4">Cancelar este lançamento?</h3><p className="font-bold mb-2">{cancelling.quantity}× {cancelling.productName} • Comanda {cancelling.comanda}</p><p className="text-slate-600 mb-5">Todas as {cancelling.quantity} unidades deste lançamento sairão das estatísticas. O histórico será mantido. Este cancelamento é apenas do relatório; não altera o preparo nem imprime outro cupom.</p><label htmlFor="cancel-reason" className="font-bold block mb-2">Motivo (opcional)</label><input id="cancel-reason" maxLength={200} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ex.: teste de impressora" className="w-full p-3 border-2 border-slate-200 rounded-xl" /><div className="flex flex-wrap gap-2 mt-3">{['Teste de impressora', 'Teste do sistema'].map(value => <button key={value} disabled={saving} onClick={() => setReason(value)} className="p-2 bg-slate-100 rounded-lg text-sm font-bold">{value}</button>)}</div>{error && <p role="alert" className="text-red-700 mt-3">{error}</p>}<div className="flex gap-3 mt-6"><button disabled={saving} onClick={() => setCancelling(null)} className="flex-1 p-4 bg-slate-100 rounded-xl font-black">Voltar</button><button disabled={saving} onClick={confirmCancellation} className="flex-1 p-4 bg-[#E53935] text-white rounded-xl font-black disabled:opacity-50">{saving ? 'Cancelando…' : 'Confirmar cancelamento'}</button></div></div></div>}
    </div>
  );
};

export default Reports;
