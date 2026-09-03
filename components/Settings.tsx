
import React, { useEffect, useState } from 'react';
import { NetworkConfig, NetworkDiagnostics, PrinterConfig } from '../types';
import PrinterService from '../services/printerService';

interface SettingsProps {
  config: PrinterConfig;
  onSave: (config: PrinterConfig) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave, onClose }) => {
  const [name, setName] = useState(config.name);
  const [printerMode, setPrinterMode] = useState<'usb' | 'network'>(config.mode);
  const [printerIp, setPrinterIp] = useState(config.printerIp);
  const [printerPort, setPrinterPort] = useState(config.printerPort);
  const [network, setNetwork] = useState<NetworkConfig>({ mode: 'local', serverIp: '', port: 37842 });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingNetwork, setCheckingNetwork] = useState(false);
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(null);

  useEffect(() => {
    window.electronAPI?.getNetworkConfig()
      .then(setNetwork)
      .catch(error => setMessage(error instanceof Error ? error.message : 'Não foi possível ler a rede.'));
  }, []);

  const printerValues: PrinterConfig = { name, mode: printerMode, printerIp, printerPort };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    // A impressora é persistida independentemente da comunicação entre os computadores.
    localStorage.setItem('araujo_printer', JSON.stringify(printerValues));
    onSave(printerValues);

    try {
      const savedNetwork = await window.electronAPI?.saveNetworkConfig(network);
      if (savedNetwork) {
        setNetwork(savedNetwork);
        if (savedNetwork.connectionOk === false) {
          setMessage(`Configurações salvas. A impressora foi gravada normalmente, mas a comunicação entre os PCs ainda falhou: ${savedNetwork.connectionError || 'sem resposta do outro computador.'}`);
        } else {
          setMessage('Todas as configurações foram gravadas.');
        }
      } else {
        setMessage('Configuração da impressora gravada.');
      }
    } catch (error) {
      setMessage(`A impressora foi salva. Falha ao gravar a rede dos computadores: ${error instanceof Error ? error.message : 'erro desconhecido.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckComputers = async () => {
    setCheckingNetwork(true);
    setDiagnostics(null);
    try {
      const result = await window.electronAPI?.checkNetworkLink();
      if (result) setDiagnostics(result);
    } catch (error) {
      setDiagnostics({
        ok: false,
        mode: network.mode,
        localIps: network.localIps || [],
        serverIp: network.serverIp,
        port: network.port,
        message: error instanceof Error ? error.message : 'Não foi possível executar o diagnóstico.'
      });
    } finally {
      setCheckingNetwork(false);
    }
  };

  const handleTestPrint = async () => {
    setMessage('');
    try {
      if (printerMode === 'network') {
        await window.electronAPI?.checkNetworkPrinter({ printerIp, printerPort });
      }
      await PrinterService.testPrint(printerValues);
      setMessage('Teste enviado para a impressora.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível testar a impressora.');
    }
  };

  const handleOpenPrintLog = async () => {
    try {
      await window.electronAPI?.openPrintLog();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível abrir o relatório.');
    }
  };

  const modeLabel = diagnostics?.mode === 'host'
    ? 'PC PRINCIPAL'
    : diagnostics?.mode === 'client'
      ? 'PC SECUNDÁRIO'
      : 'SOMENTE ESTE PC';

  return (
    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-8">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        <div className="bg-slate-950 text-white p-7 flex justify-between items-center">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 mb-1">Acesso restrito</div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Painel Administrativo</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition">
            <i className="fa-solid fa-times text-2xl"></i>
          </button>
        </div>

        <div className="p-8 space-y-7 overflow-y-auto custom-scrollbar">
          <div className="rounded-3xl border-4 border-slate-900 p-6 space-y-4 bg-slate-50">
            <div className="flex items-center justify-between gap-5">
              <div>
                <h3 className="font-black uppercase text-xl text-slate-900">Diagnóstico dos computadores</h3>
                <p className="text-sm font-bold text-slate-500">Verifica se o principal e o secundário estão realmente se comunicando pela porta 37842.</p>
              </div>
              <button
                onClick={handleCheckComputers}
                disabled={checkingNetwork}
                className="px-7 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase disabled:opacity-50 whitespace-nowrap"
              >
                {checkingNetwork ? 'Verificando...' : 'Verificar agora'}
              </button>
            </div>

            {diagnostics && (
              <div className={`rounded-2xl border-4 p-5 ${diagnostics.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <i className={`fa-solid ${diagnostics.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'} text-2xl`}></i>
                  <span className="font-black uppercase text-lg">{diagnostics.ok ? 'Comunicação OK' : 'Comunicação com problema'}</span>
                </div>
                <div className="font-bold">Modo: <strong>{modeLabel}</strong></div>
                <div className="font-bold">IP deste PC: <strong>{diagnostics.localIps.join(' / ') || 'não identificado'}</strong></div>
                {diagnostics.mode === 'client' && <div className="font-bold">PC principal: <strong>{diagnostics.serverIp}:{diagnostics.port}</strong></div>}
                {diagnostics.mode === 'host' && <div className="font-bold">Servidor local: <strong>{diagnostics.serverListening ? `ATIVO na porta ${diagnostics.port}` : 'INATIVO'}</strong></div>}
                {diagnostics.mode === 'host' && diagnostics.peerIp && <div className="font-bold">Último PC secundário visto: <strong>{diagnostics.peerIp}</strong></div>}
                {diagnostics.mode === 'host' && diagnostics.lastPeerSeenAt && <div className="font-bold">Último contato: <strong>{new Date(diagnostics.lastPeerSeenAt).toLocaleTimeString('pt-BR')}</strong></div>}
                {diagnostics.latencyMs !== undefined && <div className="font-bold">Tempo de resposta: <strong>{diagnostics.latencyMs} ms</strong></div>}
                <div className="mt-3 p-3 bg-white/70 rounded-xl font-black">{diagnostics.message}</div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tipo de conexão da impressora</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPrinterMode('usb')} className={`p-4 rounded-2xl border-4 font-black uppercase ${printerMode === 'usb' ? 'border-[#E53935] bg-red-50 text-[#E53935]' : 'border-slate-100 text-slate-400'}`}>
                <i className="fa-solid fa-usb mr-2"></i> USB deste PC
              </button>
              <button onClick={() => setPrinterMode('network')} className={`p-4 rounded-2xl border-4 font-black uppercase ${printerMode === 'network' ? 'border-[#E53935] bg-red-50 text-[#E53935]' : 'border-slate-100 text-slate-400'}`}>
                <i className="fa-solid fa-network-wired mr-2"></i> Rede / IP
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">{printerMode === 'usb' ? 'Nome da impressora no Windows' : 'Endereço da impressora'}</label>
            {printerMode === 'usb' ? <div className="relative">
              <i className="fa-solid fa-print absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-xl"></i>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-14 pr-6 py-6 border-4 border-slate-50 rounded-2xl text-2xl font-black focus:outline-none focus:border-[#E53935] transition-all"
                placeholder="Ex: Impressora Chapa 01"
              />
            </div> : <>
              <div className="grid grid-cols-[1fr_180px] gap-3">
                <input value={printerIp} onChange={e => setPrinterIp(e.target.value)} className="px-6 py-5 border-4 border-slate-100 rounded-2xl text-xl font-black focus:outline-none focus:border-[#E53935]" placeholder="192.168.50.217" />
                <input type="number" value={printerPort} onChange={e => setPrinterPort(Number(e.target.value))} className="px-6 py-5 border-4 border-slate-100 rounded-2xl text-xl font-black focus:outline-none focus:border-[#E53935]" placeholder="9100" />
              </div>
              <div className="rounded-xl bg-red-50 border-2 border-red-100 p-4 text-red-900 font-bold text-sm">
                Padrão da chapa: <strong>192.168.50.217:9100</strong>. Os dois computadores podem imprimir diretamente nesse mesmo endereço.
              </div>
            </>}
          </div>

          <div className="border-t-4 border-slate-100 pt-6 space-y-4">
            <div>
              <h3 className="font-black uppercase text-xl text-slate-900">Compartilhar pedidos entre computadores</h3>
              <p className="text-sm font-bold text-slate-500">Escolha somente um PC principal. O outro deve ser secundário.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ['local', 'Somente este PC'],
                ['host', 'PC principal'],
                ['client', 'PC secundário']
              ] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setNetwork(current => ({ ...current, mode }))} className={`p-4 rounded-xl border-4 font-black uppercase text-sm ${network.mode === mode ? 'border-[#C5A021] bg-amber-50 text-slate-900' : 'border-slate-100 text-slate-400'}`}>
                  {label}
                </button>
              ))}
            </div>
            {network.mode === 'host' && (
              <div className="rounded-xl bg-emerald-50 border-2 border-emerald-200 p-4 text-emerald-800 font-bold">
                IP deste PC: <strong>{network.localIps?.join(' ou ') || 'será exibido após salvar'}</strong> — porta {network.port}
              </div>
            )}
            {network.mode === 'client' && (
              <div className="grid grid-cols-[1fr_180px] gap-3">
                <input value={network.serverIp} onChange={e => setNetwork(current => ({ ...current, serverIp: e.target.value }))} className="px-6 py-4 border-4 border-slate-100 rounded-xl text-xl font-black focus:outline-none focus:border-[#C5A021]" placeholder="IP do PC principal" />
                <input type="number" value={network.port} onChange={e => setNetwork(current => ({ ...current, port: Number(e.target.value) }))} className="px-6 py-4 border-4 border-slate-100 rounded-xl text-xl font-black focus:outline-none focus:border-[#C5A021]" />
              </div>
            )}
          </div>

          {message && <div className="rounded-xl bg-blue-50 border-2 border-blue-200 p-4 text-blue-900 font-black">{message}</div>}

          <div className="pt-2 grid grid-cols-3 gap-4">
            <button
              onClick={handleTestPrint}
              className="py-5 border-4 border-slate-900 text-slate-900 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-base"
            >
              Emitir Teste
            </button>
            <button
              onClick={handleOpenPrintLog}
              className="py-5 border-4 border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-base"
            >
              Abrir Relatório de Impressão
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="py-5 bg-[#E53935] text-white font-black rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-all uppercase text-base shadow-xl shadow-red-100"
            >
              {saving ? 'Gravando...' : 'Gravar Configurações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
