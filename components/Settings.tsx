
import React, { useState } from 'react';
import { PrinterConfig } from '../types';
import PrinterService from '../services/printerService';

interface SettingsProps {
  config: PrinterConfig;
  onSave: (config: PrinterConfig) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave, onClose }) => {
  const [ip, setIp] = useState(config.ip);
  const [name, setName] = useState(config.name);

  const handleSave = () => {
    onSave({ ip, name });
    onClose();
  };

  const handleTestPrint = () => {
    PrinterService.testPrint({ ip, name });
  };

  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-8">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="bg-slate-900 text-white p-10 flex justify-between items-center">
            <h2 className="text-3xl font-black uppercase tracking-tight">Ajustes do Sistema</h2>
            <button onClick={onClose} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition">
              <i className="fa-solid fa-times text-2xl"></i>
            </button>
        </div>

        <div className="p-12 space-y-10">
          <div className="space-y-4">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Dispositivo de Saída</label>
            <div className="relative">
              <i className="fa-solid fa-print absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-xl"></i>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full pl-14 pr-6 py-6 border-4 border-slate-50 rounded-2xl text-2xl font-black focus:outline-none focus:border-[#E53935] transition-all"
                placeholder="Ex: Impressora Chapa 01"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Endereço de Rede (IP)</label>
            <div className="relative">
              <i className="fa-solid fa-network-wired absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 text-xl"></i>
              <input 
                type="text" 
                value={ip} 
                onChange={e => setIp(e.target.value)}
                className="w-full pl-14 pr-6 py-6 border-4 border-slate-50 rounded-2xl text-2xl font-black focus:outline-none focus:border-[#E53935] transition-all"
                placeholder="192.168.1.100"
              />
            </div>
          </div>

          <div className="pt-6 grid grid-cols-1 gap-4">
             <button 
                onClick={handleTestPrint}
                className="py-6 border-4 border-slate-900 text-slate-900 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase text-xl"
             >
               Emitir Teste
             </button>
             <button 
                onClick={handleSave}
                className="py-6 bg-[#E53935] text-white font-black rounded-2xl hover:bg-red-700 transition-all uppercase text-xl shadow-xl shadow-red-100"
             >
               Gravar Configurações
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
