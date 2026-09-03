
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Order, OrderStatus, View, MenuItem, AddOn, PrinterConfig, OrderItemConfig, OrderEntry } from './types';
import { MENU_ITEMS, SALTY_ADDONS, SWEET_ADDONS, CHEESE_OPTIONS } from './constants';
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
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(() => {
    const saved = localStorage.getItem('araujo_printer');
    const parsed = saved ? JSON.parse(saved) : {};
    return {
      name: parsed.name || 'POS-80',
      mode: parsed.mode === 'network' ? 'network' : 'usb',
      printerIp: parsed.printerIp || '192.168.15.217',
      printerPort: Number(parsed.printerPort || 9100)
    };
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
      if (e.key === 'F1') {
        e.preventDefault();
        setView('REPORTS');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setView('SETTINGS');
      } else if (e.key === 'Escape') {
        setView('DASHBOARD');
        setActiveComanda(null);
        setIsComandaInvalid(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      setView('WIZARD');
    }
  };

  const createOrder = async (item: MenuItem, quantity: number, configs: OrderItemConfig[]) => {
    const newEntry: OrderEntry = {
      id: Math.random().toString(36).substr(2, 9),
      item,
      quantity,
      configs,
      addedAt: Date.now()
    };

    const existingOrder = orders.find(o => o.comanda === activeComanda && o.status !== OrderStatus.FINISHED);
    const orderToSave: Order = existingOrder ? {
      ...existingOrder,
      entries: [...existingOrder.entries, newEntry],
      status: OrderStatus.PREPARING
    } : {
      id: Math.random().toString(36).substr(2, 9),
      comanda: activeComanda || '000',
      entries: [newEntry],
      status: OrderStatus.PREPARING,
      createdAt: Date.now()
    };

    setOrders(prev => [...prev.filter(order => order.id !== orderToSave.id), orderToSave]);
    try {
      await window.electronAPI?.ordersSave(orderToSave);
      PrinterService.printOrder(orderToSave, printerConfig, Boolean(existingOrder));
    } catch (error) {
      alert(error instanceof Error
        ? `O pedido apareceu nesta tela, mas não foi sincronizado: ${error.message}`
        : 'O pedido apareceu nesta tela, mas não foi sincronizado.');
    }

    setView('DASHBOARD');
    setActiveComanda(null);
    setIsComandaInvalid(false);
  };

  const updateOrderStatus = async (id: string) => {
    const current = orders.find(order => order.id === id);
    if (!current) return;

    if (current.status === OrderStatus.PREPARING) {
      const changes = { status: OrderStatus.READY, readyAt: Date.now() };
      setOrders(prev => prev.map(order => order.id === id ? { ...order, ...changes } : order));
      try {
        await window.electronAPI?.ordersStatus({ id, changes });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível sincronizar o status.');
      }
      return;
    }

    if (current.status === OrderStatus.READY) {
      const finalizingChanges = { status: OrderStatus.FINALIZING };
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
          <button onClick={() => setView('DASHBOARD')} className={`px-8 py-3 rounded-xl font-black uppercase transition-all shadow-sm border-b-4 ${view === 'DASHBOARD' ? 'bg-[#C5A021] text-white border-[#9e801a]' : 'bg-white text-slate-400 border-slate-200'}`}>
            <i className="fa-solid fa-desktop mr-2"></i> Painel
          </button>
          <button onClick={() => setView('REPORTS')} className={`px-8 py-3 rounded-xl font-black uppercase transition-all shadow-sm border-b-4 ${view === 'REPORTS' ? 'bg-[#C5A021] text-white border-[#9e801a]' : 'bg-white text-slate-400 border-slate-200'}`}>
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
            <Dashboard orders={orders.filter(o => o.status !== OrderStatus.FINISHED)} onUpdateStatus={updateOrderStatus} />
          </div>
        )}
        {view === 'WIZARD' && (
          <OrderWizard comanda={activeComanda || '000'} onCancel={() => { setView('DASHBOARD'); setActiveComanda(null); setIsComandaInvalid(false); }} onFinish={createOrder} />
        )}
        {view === 'REPORTS' && <Reports orders={orders} onClose={() => setView('DASHBOARD')} />}
        {view === 'SETTINGS' && <Settings config={printerConfig} onSave={setPrinterConfig} onClose={() => setView('DASHBOARD')} />}
      </main>
    </div>
    <div id="print-area" className="print-only"></div>
    </>
  );
};

export default App;
