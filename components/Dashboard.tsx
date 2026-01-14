
import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, OrderEntry } from '../types';

interface DashboardProps {
  orders: Order[];
  onUpdateStatus: (id: string) => void;
}

const OrderCard: React.FC<{ order: Order; onClick: () => void }> = ({ order, onClick }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - order.createdAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalQty = order.entries.reduce((sum, e) => sum + e.quantity, 0);
  const isLargeOrder = totalQty > 3;
  const isOld = elapsed > 600;

  // Cores dinâmicas baseadas no status e urgência
  const statusColors = {
    [OrderStatus.PREPARING]: isOld ? 'bg-red-50 border-red-600' : 'bg-white border-slate-200',
    [OrderStatus.READY]: 'bg-green-50 border-green-600',
    [OrderStatus.FINALIZING]: 'bg-slate-100 border-slate-400',
    [OrderStatus.FINISHED]: 'bg-white border-slate-200'
  };

  return (
    <div 
      onClick={onClick}
      className={`relative cursor-pointer select-none overflow-hidden rounded-[32px] border-4 shadow-xl transition-all active:scale-95 flex flex-col h-full ${statusColors[order.status]}`}
    >
      {/* Cabeçalho do Card */}
      <div className={`p-5 flex justify-between items-center border-b-2 ${order.status === OrderStatus.READY ? 'bg-green-600 text-white' : 'bg-slate-50 text-slate-800'}`}>
        <div className="flex items-center gap-3">
            <span className="text-3xl font-black">#{order.comanda}</span>
            {isLargeOrder && <span className="bg-[#b71c1c] text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">MUITO ITEM</span>}
        </div>
        <span className={`font-mono text-xl font-black ${order.status === OrderStatus.READY ? 'text-white' : (isOld ? 'text-red-600' : 'text-[#C5A021]')}`}>
          <i className="fa-regular fa-clock mr-1"></i> {formatTime(elapsed)}
        </span>
      </div>

      <div className="p-5 flex-1 space-y-4 overflow-y-auto custom-scrollbar">
        {order.entries.map((entry, eIdx) => (
          <div 
            key={entry.id} 
            className={`rounded-2xl border-2 p-4 transition-all ${entry.quantity > 1 ? 'bg-gradient-to-br from-[#E53935] to-[#b71c1c] text-white border-[#8d1616] shadow-lg scale-[1.02]' : 'bg-slate-50 border-slate-100 text-slate-800'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.quantity > 1 ? 'bg-white text-[#E53935]' : 'bg-slate-200 text-[#E53935]'}`}>
                  <i className={`${entry.item.icon} text-xl`}></i>
                </div>
                <h3 className="text-xl font-black uppercase leading-tight">{entry.item.name}</h3>
              </div>
              <div className={`px-3 py-1 rounded-xl text-2xl font-black border-2 ${entry.quantity > 1 ? 'bg-white text-[#b71c1c] border-white' : 'bg-[#E53935] text-white border-[#E53935]'}`}>
                {entry.quantity}x
              </div>
            </div>

            <div className="space-y-3">
              {entry.configs.map((cfg, cIdx) => (
                <div key={cIdx} className={`p-3 rounded-xl border ${entry.quantity > 1 ? 'bg-black/10 border-white/20' : 'bg-white border-slate-200'}`}>
                  {entry.quantity > 1 && <span className="text-[10px] font-black uppercase opacity-60 block mb-1">Item #{cIdx + 1}:</span>}
                  
                  {cfg.cheese && (
                    <div className="flex items-center gap-2 mb-1">
                      <i className="fa-solid fa-cheese text-orange-400 text-xs"></i>
                      <span className={`text-[11px] font-black uppercase ${entry.quantity > 1 ? 'text-white' : 'text-orange-600'}`}>Queijo: {cfg.cheese}</span>
                    </div>
                  )}

                  {cfg.selectedAddOns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {cfg.selectedAddOns.map(add => (
                        <span key={add.id} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${entry.quantity > 1 ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                          {add.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {cfg.observation && (
                    <div className={`mt-2 pt-2 border-t text-[11px] font-bold uppercase italic ${entry.quantity > 1 ? 'border-white/10 text-white/90' : 'border-slate-100 text-[#E53935]'}`}>
                      "{cfg.observation}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {order.status === OrderStatus.FINALIZING && (
        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10">
          <div className="w-16 h-16 border-8 border-slate-100 border-t-[#E53935] rounded-full animate-spin mb-4"></div>
          <p className="text-2xl font-black text-slate-900 uppercase tracking-widest">Finalizando...</p>
        </div>
      )}

      {/* Rodapé do Card com Status */}
      <div className={`py-5 px-4 text-center font-black uppercase text-2xl tracking-tighter shadow-inner ${order.status === OrderStatus.READY ? 'bg-green-100 text-green-700' : 'bg-slate-900 text-white'}`}>
        {order.status === OrderStatus.PREPARING ? (
            <span className="flex items-center justify-center gap-2">
                <i className="fa-solid fa-spinner animate-spin-slow text-sm"></i> {order.status}
            </span>
        ) : order.status}
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ orders, onUpdateStatus }) => {
  return (
    <div className="flex-1 overflow-y-auto px-2 custom-scrollbar pb-10">
      {orders.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-200 opacity-50">
           <i className="fa-solid fa-utensils text-[180px] mb-8"></i>
           <p className="text-5xl font-black uppercase tracking-tighter">Cozinha Vazia</p>
           <p className="text-xl font-bold uppercase mt-2">Aguardando novos pedidos da chapa</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
          {orders.sort((a, b) => a.createdAt - b.createdAt).map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onClick={() => onUpdateStatus(order.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
