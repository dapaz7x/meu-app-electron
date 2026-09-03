
import React, { useEffect, useState } from 'react';
import { NetworkConfig, PrinterConfig } from '../types';
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

  useEffect(() => {
    window.electronAPI?.getNetworkConfig()
      .then(setNetwork)
      .catch(error => setMessage(error instanceof Error ? error.message : 'Não foi possível ler a rede.'));
  }, []);

  const printerValues: PrinterConfig = { name, mode: printerMode, printerIp, printerPort };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const savedNetwork = await window.electronAPI?.saveNetworkConfig(network);
      if (savedNetwork) setNetwork(savedNetwork);
      onSave(printerValues);
      setMessage('Configurações gravadas e conexão validada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gravar as configurações.');
    } finally {
      setSaving(false);
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

  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-8">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white p-7 flex justify-between items-center">
            <h2 className="text-3xl font-black uppercase tracking-tight">Ajustes do Sistema</h2>
            <button onClick={onClose} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition">
              <i className="fa-solid fa-times text-2xl"></i>
            </button>
        </div>

        <div className="p-8 space-y-7 overflow-y-auto custom-scrollbar">
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
            </div> : <div className="grid grid-cols-[1fr_180px] gap-3">
              <input value={printerIp} onChange={e => setPrinterIp(e.target.value)} className="px-6 py-5 border-4 border-slate-100 rounded-2xl text-xl font-black focus:outline-none focus:border-[#E53935]" placeholder="192.168.50.217" />
              <input type="number" value={printerPort} onChange={e => setPrinterPort(Number(e.target.value))} className="px-6 py-5 border-4 border-slate-100 rounded-2xl text-xl font-black focus:outline-none focus:border-[#E53935]" placeholder="9100" />
            </div>}
          </div>

          <div className="border-t-4 border-slate-100 pt-6 space-y-4">
            <div>
              <h3 className="font-black uppercase text-xl text-slate-900">Compartilhar pedidos entre computadores</h3>
              <p className="text-sm font-bold text-slate-500">Escolha somente um PC principal. Os demais devem ser secundários.</p>
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
               {saving ? 'Validando...' : 'Gravar Configurações'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
