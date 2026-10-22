
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Order, OrderStatus, View, PrinterConfig, OrderDraftEntry, OrderEntry } from './types';
import Dashboard from './components/Dashboard';
import OrderWizard from './components/OrderWizard';
import Reports from './components/Reports';
import Settings from './components/Settings';
import PrinterService from './services/printerService';

const App: React.FC = () => {
  const [view, setView] = useState<View>('DASHBOARD');
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('araujo_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeComanda, setActiveComanda] = useState<string | null>(null);
  const [isComandaInvalid, setIsComandaInvalid] = useState(false);
  const [draftObservation, setDraftObservation] = useState('');
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    const saved = localStorage.getItem('araujo_printer');
    const parsed = saved ? JSON.parse(saved) : {};
    const savedPrinterIp = String(parsed.printerIp || '').trim();
    return {
      name: parsed.name || 'POS-80',
      mode: parsed.mode === 'network' ? 'network' : 'usb',
      printerIp: !savedPrinterIp || savedPrinterIp === '192.168.15.217' ? '192.168.50.217' : savedPrinterIp,
      printerPort: Number(parsed.printerPort || 9100)
    };
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const draftDirty = useRef(false);
  const draftSaving = useRef(false);
  const onDraftChange = useCallback((dirty: boolean) => { draftDirty.current = dirty; }, []);
  const onSavingChange = useCallback((saving: boolean) => { draftSaving.current = saving; }, []);
  const navigate = useCallback((next: View) => {
    if (draftSaving.current) return;
    if (view === 'WIZARD' && draftDirty.current && !window.confirm('Sair sem enviar os itens desta comanda?')) return;
    setView(next);
    setActiveComanda(null);
    setIsComandaInvalid(false);
  }, [view]);

  useEffect(() => {
    localStorage.setItem('araujo_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!window.electronAPI?.ordersList) return;
    let active = true;

    const initializeOrders = async () => {
      try {
        const localOrders = (() => {
          try {
            const saved = JSON.parse(localStorage.getItem('araujo_orders') || '[]');
            return Array.isArray(saved) ? saved : [];
          } catch {
            return [];
          }
        })();
        if (localOrders.length) await window.electronAPI!.ordersImport(localOrders);
        const sharedOrders = await window.electronAPI!.ordersList();
        if (active) setOrders(sharedOrders);
      } catch (error) {
        console.error('Não foi possível carregar os pedidos compartilhados:', error);
      }
    };

    initializeOrders();
    const interval = window.setInterval(async () => {
      try {
        const sharedOrders = await window.electronAPI!.ordersList();
        if (active) setOrders(sharedOrders);
      } catch (error) {
        console.error('Falha temporária na sincronização:', error);
      }
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('araujo_printer', JSON.stringify(printerConfig));
  }, [printerConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'F1') {
        e.preventDefault();
        navigate('REPORTS');
      } else if (e.ctrlKey && e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        navigate('SETTINGS');
      } else if (e.key === 'Escape') {
        navigate('DASHBOARD');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (view === 'DASHBOARD' && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [view]);

  const handleComandaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value === '') {
      setActiveComanda(null);
      setIsComandaInvalid(false);
      return;
    }
    const numValue = parseInt(value, 10);
    if (numValue > 999) {
      setIsComandaInvalid(true);
      setActiveComanda(value);
    } else {
      setIsComandaInvalid(false);
      setActiveComanda(value);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeComanda && !isComandaInvalid) {
      setDraftObservation(orders.find(order => order.comanda === activeComanda && order.status !== OrderStatus.FINISHED)?.observation || '');
      setView('WIZARD');
    }
  };

  const createOrder = async (entries: OrderDraftEntry[], observation: string) => {
    const addedAt = Date.now();
    const newEntries: OrderEntry[] = entries.map(entry => ({
      ...entry, id: crypto.randomUUID(), addedAt, orderObservation: observation
    }));

    let sourceOrders = orders;
    try {
      const sharedOrders = await window.electronAPI?.ordersList();
      if (Array.isArray(sharedOrders)) sourceOrders = sharedOrders;
    } catch (error) {
      console.error('Não foi possível atualizar os pedidos antes de salvar:', error);
    }

    const existingOrder = sourceOrders.find(o => o.comanda === activeComanda && o.status !== OrderStatus.FINISHED);
    const orderToSave: Order = existingOrder ? {
      ...existingOrder,
      entries: [...existingOrder.entries, ...newEntries],
      observation,
      status: OrderStatus.PREPARING,
      finalizingAt: undefined,
      finishedAt: undefined
    } : {
      id: Math.random().toString(36).substr(2, 9),
      comanda: activeComanda || '000',
      entries: newEntries,
      observation,
      status: OrderStatus.PREPARING,
      createdAt: Date.now()
    };

    try {
      await window.electronAPI?.ordersSave(orderToSave);
    } catch (error) {
      throw new Error(error instanceof Error
        ? `Não foi possível salvar: ${error.message}. Seus itens continuam aqui.`
        : 'Não foi possível salvar. Seus itens continuam aqui.');
    }

    setOrders([...sourceOrders.filter(order => order.id !== orderToSave.id), orderToSave]);
    // Um cupom por lançamento, contendo somente os produtos novos.
    PrinterService.printOrder({ ...orderToSave, entries: newEntries }, printerConfig, Boolean(existingOrder));

    setView('DASHBOARD');
    setActiveComanda(null);
    setIsComandaInvalid(false);
  };

  const updateOrderStatus = async (id: string) => {
    const current = orders.find(order => order.id === id);
    if (!current) return;

    if (current.status === OrderStatus.PREPARING) {
      const changes = { status: OrderStatus.READY, readyAt: Date.now(), finalizingAt: undefined };
      setOrders(prev => prev.map(order => order.id === id ? { ...order, ...changes } : order));
      try {
        await window.electronAPI?.ordersStatus({ id, changes });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível sincronizar o status.');
      }
      return;
    }

    if (current.status === OrderStatus.READY) {
      const finalizingChanges = { status: OrderStatus.FINALIZING, finalizingAt: Date.now() };
      setOrders(prev => prev.map(order => order.id === id ? { ...order, ...finalizingChanges } : order));
      try {
        await window.electronAPI?.ordersStatus({ id, changes: finalizingChanges });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível sincronizar o status.');
        return;
      }

      window.setTimeout(async () => {
        const finishedChanges = { status: OrderStatus.FINISHED, finishedAt: Date.now() };
        setOrders(prev => prev.map(order => order.id === id ? { ...order, ...finishedChanges } : order));
        try {
          await window.electronAPI?.ordersStatus({ id, changes: finishedChanges });
        } catch (error) {
          console.error('Não foi possível concluir o pedido compartilhado:', error);
        }
      }, 3000);
    }
  };

  return (
    <>
    <div className="no-print h-screen flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white text-slate-800 p-4 flex justify-between items-center border-b-4 border-[#C5A021] shadow-md z-50">
        <div className="flex items-center gap-4">
          <div className="bg-[#E53935] w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-3">
            <i className="fa-solid fa-fire-burner text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">Padaria Araújo <span className="text-[#E53935] block text-sm tracking-widest">Gestão de Chapa</span></h1>
          </div>
        </div>
        
        {activeComanda && view === 'WIZARD' && (
          <div className="bg-gradient-to-r from-[#E53935] to-[#b71c1c] text-white px-10 py-3 rounded-2xl font-black text-2xl border-4 border-white shadow-2xl flex items-center gap-4 animate-pulse">
            <i className="fa-solid fa-id-card"></i> COMANDA: {activeComanda}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => navigate('DASHBOARD')} className={`px-8 py-3 rounded-xl font-black uppercase transition-all shadow-sm border-b-4 ${view === 'DASHBOARD' ? 'bg-[#C5A021] text-white border-[#9e801a]' : 'bg-white text-slate-400 border-slate-200'}`}>
            <i className="fa-solid fa-desktop mr-2"></i> Painel
          </button>
          <button onClick={() => navigate('REPORTS')} className={`px-8 py-3 rounded-xl font-black uppercase transition-all shadow-sm border-b-4 ${view === 'REPORTS' ? 'bg-[#C5A021] text-white border-[#9e801a]' : 'bg-white text-slate-400 border-slate-200'}`}>
            <i className="fa-solid fa-chart-simple mr-2"></i> Dados
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'DASHBOARD' && (
          <div className="h-full flex flex-col p-6">
            <form onSubmit={handleBarcodeSubmit} className="mb-10 flex justify-center">
              <div className="relative w-full max-w-3xl">
                <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
                  <i className={`fa-solid fa-barcode text-4xl transition-colors ${isComandaInvalid ? 'text-red-500' : 'text-[#C5A021]'}`}></i>
                </div>
                <input 
                  ref={barcodeInputRef} 
                  type="text" 
                  value={activeComanda || ''} 
                  onChange={handleComandaChange} 
                  placeholder="BIPE OU DIGITE A COMANDA..." 
                  className={`block w-full pl-24 pr-10 py-8 border-4 rounded-[32px] text-5xl font-black focus:outline-none transition-all uppercase shadow-2xl ${isComandaInvalid ? 'border-red-500 bg-red-50 text-red-900' : 'border-white bg-white focus:border-[#E53935] text-slate-900'} placeholder:text-slate-200`} 
                />
                <div className="absolute inset-y-0 right-10 flex items-center">
                  {isComandaInvalid ? 
                    <span className="text-sm font-black text-white bg-red-600 px-6 py-2 rounded-full uppercase shadow-lg">Número Inválido (Max 999)</span> : 
                    <span className="text-xs font-black text-white bg-[#C5A021] px-4 py-2 rounded-full uppercase shadow-md tracking-tighter">Aguardando Leitura</span>
                  }
                </div>
              </div>
            </form>
            <p className="text-center text-sm font-bold text-slate-500 -mt-6 mb-4">Abra a comanda e pressione F2 para digitar itens livres, mesmo sem internet.</p>
            <Dashboard orders={orders.filter(o => o.status !== OrderStatus.FINISHED)} onUpdateStatus={updateOrderStatus} />
          </div>
        )}
        {view === 'WIZARD' && (
          <OrderWizard comanda={activeComanda || '000'} initialObservation={draftObservation} onCancel={() => navigate('DASHBOARD')}
            onDraftChange={onDraftChange} onSavingChange={onSavingChange} onFinish={createOrder} />
        )}
        {view === 'REPORTS' && <Reports onClose={() => setView('DASHBOARD')} />}
        {view === 'SETTINGS' && <Settings config={printerConfig} onSave={setPrinterConfig} onClose={() => setView('DASHBOARD')} />}
      </main>
    </div>
    <div id="print-area" className="print-only"></div>
    </>
  );
};

export default App;
