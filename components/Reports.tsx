
import React from 'react';
import { Order, OrderStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReportsProps {
  orders: Order[];
  onClose: () => void;
}

const Reports: React.FC<ReportsProps> = ({ orders, onClose }) => {
  const today = new Date().setHours(0,0,0,0);
  const todaysOrders = orders.filter(o => o.createdAt >= today);

  const total = todaysOrders.length;
  
  // Fix: Iterate over entries within each order to count items correctly
  const itemCounts = todaysOrders.reduce((acc, curr) => {
    curr.entries.forEach(entry => {
      acc[entry.item.name] = (acc[entry.item.name] || 0) + entry.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(itemCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const avgPreparationTime = todaysOrders
    .filter(o => o.finishedAt)
    .reduce((acc, curr) => acc + ((curr.finishedAt! - curr.createdAt) / 1000 / 60), 0) / (todaysOrders.filter(o => o.finishedAt).length || 1);

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col p-10 overflow-y-auto">
      <div className="flex justify-between items-center mb-16 border-b-4 border-slate-50 pb-8">
        <div>
          <h2 className="text-5xl font-black uppercase text-slate-900 tracking-tighter">Performance de Vendas</h2>
          <p className="text-[#C5A021] font-black uppercase text-xl mt-2">{new Date().toLocaleDateString()}</p>
        </div>
        <button onClick={onClose} className="bg-slate-900 text-white w-20 h-20 rounded-full text-3xl flex items-center justify-center shadow-2xl active:scale-90 transition-all">
          <i className="fa-solid fa-times"></i>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
        <div className="bg-slate-50 p-10 rounded-[40px] shadow-sm border-b-8 border-[#E53935]">
           <p className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Volume Total</p>
           <p className="text-7xl font-black text-slate-900">{total}</p>
        </div>
        <div className="bg-slate-50 p-10 rounded-[40px] shadow-sm border-b-8 border-[#C5A021]">
           <p className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Média de Preparo</p>
           <p className="text-7xl font-black text-slate-900">{avgPreparationTime.toFixed(1)}<span className="text-3xl font-bold ml-2">min</span></p>
        </div>
        <div className="bg-slate-50 p-10 rounded-[40px] shadow-sm border-b-8 border-slate-900">
           <p className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">Finalizados</p>
           <p className="text-7xl font-black text-slate-900">{todaysOrders.filter(o => o.status === OrderStatus.FINISHED).length}</p>
        </div>
      </div>

      <div className="bg-slate-50 p-12 rounded-[40px] shadow-sm flex-1 min-h-[500px]">
        <h3 className="text-3xl font-black mb-12 uppercase text-slate-900 tracking-tight">Top Itens da Chapa</h3>
        <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 14, fontWeight: '900', fill: '#1e293b' }} />
                <Tooltip cursor={{fill: 'rgba(229, 57, 53, 0.05)'}} />
                <Bar dataKey="count" fill="#E53935" radius={[0, 20, 20, 0]} barSize={40}>
                   {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#E53935' : '#C5A021'} />
                  ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Reports;
