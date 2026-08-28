
import React, { useState, useEffect, useRef } from 'react';
import { MenuItem, AddOn, OrderStatus, OrderItemConfig } from '../types';
import { MENU_ITEMS, SALTY_ADDONS, SWEET_ADDONS, CHEESE_OPTIONS } from '../constants';

interface OrderWizardProps {
  comanda: string;
  onCancel: () => void;
  onFinish: (item: MenuItem, quantity: number, configs: OrderItemConfig[]) => void;
}

type WizardStep = 'SELECT_ITEM' | 'ADDONS' | 'OBS';

const OrderWizard: React.FC<OrderWizardProps> = ({ comanda, onCancel, onFinish }) => {
  const [step, setStep] = useState<WizardStep>('SELECT_ITEM');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number>(0);
  const [accumulatedConfigs, setAccumulatedConfigs] = useState<OrderItemConfig[]>([]);

  // Current unit transient state
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([]);
  const [selectedCheese, setSelectedCheese] = useState<string>('Nenhum');
  const [observation, setObservation] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step, currentUnitIndex]);

  const handleItemSelect = (item: MenuItem) => {
    setSelectedItem(item);
    setStep('ADDONS');
  };

  const toggleAddOn = (addon: AddOn) => {
    setSelectedAddOns(prev => 
      prev.find(a => a.id === addon.id) 
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const handleNextUnit = () => {
    const newConfig: OrderItemConfig = {
      selectedAddOns,
      cheese: selectedCheese !== 'Nenhum' ? selectedCheese : undefined,
      observation
    };
    
    const newAccumulated = [...accumulatedConfigs, newConfig];
    
    if (currentUnitIndex + 1 < quantity) {
      setAccumulatedConfigs(newAccumulated);
      setCurrentUnitIndex(prev => prev + 1);
      // Reset state for next unit
      setSelectedAddOns([]);
      setSelectedCheese('Nenhum');
      setObservation('');
      setStep('ADDONS');
    } else {
      // Finalized all units
      if (selectedItem) {
        onFinish(selectedItem, quantity, newAccumulated);
      }
    }
  };

  const currentAddonsList = selectedItem?.category === 'TAPIOCA' || selectedItem?.category === 'CREPIOCA' 
    ? [...SALTY_ADDONS, ...SWEET_ADDONS] 
    : SALTY_ADDONS;

  const isBurger = selectedItem?.category === 'BURGER';

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="bg-white border-b-2 border-slate-100 flex items-stretch h-20 shadow-sm">
        <button onClick={onCancel} className="bg-slate-900 text-white px-10 font-black uppercase flex items-center gap-3">
            <i className="fa-solid fa-chevron-left"></i> CANCELAR
        </button>
        <div className="flex-1 flex items-center px-12 gap-10">
            <div className={`flex items-center gap-3 font-black text-xl transition-all ${step === 'SELECT_ITEM' ? 'text-[#E53935]' : 'text-slate-200'}`}>
                <span className={`w-10 h-10 rounded-full border-4 flex items-center justify-center text-base ${step === 'SELECT_ITEM' ? 'border-[#E53935]' : 'border-slate-100'}`}>1</span>
                ITEM
            </div>
            <i className="fa-solid fa-chevron-right text-slate-100"></i>
            <div className={`flex items-center gap-3 font-black text-xl transition-all ${step === 'ADDONS' ? 'text-[#E53935]' : 'text-slate-200'}`}>
                <span className={`w-10 h-10 rounded-full border-4 flex items-center justify-center text-base ${step === 'ADDONS' ? 'border-[#E53935]' : 'border-slate-100'}`}>2</span>
                EXTRAS
            </div>
            <i className="fa-solid fa-chevron-right text-slate-100"></i>
            <div className={`flex items-center gap-3 font-black text-xl transition-all ${step === 'OBS' ? 'text-[#E53935]' : 'text-slate-200'}`}>
                <span className={`w-10 h-10 rounded-full border-4 flex items-center justify-center text-base ${step === 'OBS' ? 'border-[#E53935]' : 'border-slate-100'}`}>3</span>
                NOTAS
            </div>
        </div>
        {quantity > 1 && step !== 'SELECT_ITEM' && (
          <div className="px-10 bg-[#C5A021] text-white flex items-center font-black uppercase text-xl border-l-4 border-white">
             ITEM {currentUnitIndex + 1} de {quantity}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 scroll-smooth">
        {step === 'SELECT_ITEM' && (
          <div className="max-w-7xl mx-auto flex flex-col">
            <div className="mb-10 flex items-center justify-between bg-slate-50 p-6 rounded-2xl border-2 border-slate-100">
               <span className="text-2xl font-black uppercase text-slate-700">Quantidade:</span>
               <div className="flex items-center gap-4">
                  <button onClick={() => setQuantity(prev => Math.max(1, prev - 1))} className="w-16 h-16 bg-white border-4 border-slate-200 rounded-xl text-3xl font-black text-slate-600 active:scale-90 transition">-</button>
                  <span className="text-5xl font-black text-[#E53935] w-20 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(prev => Math.min(10, prev + 1))} className="w-16 h-16 bg-white border-4 border-slate-200 rounded-xl text-3xl font-black text-slate-600 active:scale-90 transition">+</button>
               </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {MENU_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleItemSelect(item)}
                  className="group bg-white rounded-2xl shadow-sm hover:shadow-xl p-6 flex flex-col items-center text-center border-4 border-slate-50 hover:border-[#E53935] active:scale-95 transition-all"
                >
                  <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-red-50 group-hover:text-[#E53935] transition-all mb-6">
                     <i className={`${item.icon} text-5xl`}></i>
                  </div>
                  <span className="text-xl font-black uppercase text-slate-800 tracking-tight leading-tight">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'ADDONS' && (
          <div className="max-w-6xl mx-auto">
            <h2 className="text-4xl font-black mb-10 uppercase text-slate-900 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#C5A021] rounded-full flex items-center justify-center text-white">
                    <i className="fa-solid fa-plus text-xl"></i>
                </div> 
                Adicionais {quantity > 1 ? `(Unidade ${currentUnitIndex + 1})` : ''}
            </h2>
            
            {isBurger && (
              <div className="mb-12 bg-slate-50 p-8 rounded-3xl border-2 border-slate-100 shadow-inner">
                <p className="text-2xl font-black mb-6 uppercase text-slate-800">Escolha o Queijo:</p>
                <div className="flex gap-4">
                  {CHEESE_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedCheese(c)}
                      className={`flex-1 py-6 rounded-2xl text-2xl font-black transition-all border-4 ${selectedCheese === c ? 'bg-[#E53935] border-[#E53935] text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {currentAddonsList.map(addon => {
                const isSelected = selectedAddOns.find(a => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    onClick={() => toggleAddOn(addon)}
                    className={`p-8 rounded-2xl border-4 text-xl font-black uppercase transition-all text-center flex items-center justify-center ${isSelected ? 'border-[#C5A021] bg-[#C5A021] text-white shadow-lg' : 'border-slate-50 bg-white text-slate-700 shadow-sm'}`}
                  >
                    {addon.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'OBS' && (
          <div className="max-w-4xl mx-auto flex flex-col h-full">
            <h2 className="text-4xl font-black mb-10 uppercase text-slate-900">
               Observações {quantity > 1 ? `(Unidade ${currentUnitIndex + 1})` : ''}
            </h2>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Sem cebola, bem passado..."
              className="flex-1 w-full p-10 text-3xl border-4 border-slate-50 rounded-3xl focus:outline-none focus:border-[#E53935] min-h-[400px] shadow-inner bg-slate-50 uppercase font-bold"
            />
            
            <div className="mt-10 flex flex-wrap gap-3">
                {['SEM CEBOLA', 'BEM PASSADO', 'SEM TOMATE', 'VIAGEM', 'POUCO SAL'].map(s => (
                    <button 
                        key={s} 
                        onClick={() => setObservation(prev => prev ? `${prev}, ${s}` : s)}
                        className="bg-slate-100 px-6 py-3 rounded-full font-black text-sm text-slate-600 hover:bg-[#C5A021] hover:text-white transition-all uppercase"
                    >
                        + {s}
                    </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-8 border-t-4 border-slate-50 flex gap-6 shadow-2xl">
        <div className="flex-1 flex items-center">
            {selectedItem && (
                <div className="flex items-center gap-6 border-l-8 border-[#E53935] pl-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-[#E53935]">
                        <i className={`${selectedItem.icon} text-2xl`}></i>
                    </div>
                    <div>
                        <p className="text-xs font-black text-slate-300 uppercase">Seleção atual:</p>
                        <p className="text-3xl font-black uppercase text-slate-800 tracking-tight">
                           {quantity}x {selectedItem.name}
                        </p>
                    </div>
                </div>
            )}
        </div>

        {step === 'ADDONS' && (
          <button 
            onClick={() => setStep('OBS')}
            className="bg-[#E53935] text-white px-20 py-6 rounded-2xl text-2xl font-black uppercase shadow-xl hover:bg-red-700 active:scale-95 transition-all flex items-center gap-4"
          >
            PRÓXIMO <i className="fa-solid fa-arrow-right"></i>
          </button>
        )}

        {step === 'OBS' && (
          <button 
            onClick={handleNextUnit}
            className={`px-24 py-6 rounded-2xl text-3xl font-black uppercase shadow-xl active:scale-95 transition-all flex items-center gap-4 ${currentUnitIndex + 1 < quantity ? 'bg-[#E53935] text-white hover:bg-red-700' : 'bg-[#C5A021] text-white hover:bg-[#a6861a]'}`}
          >
            {currentUnitIndex + 1 < quantity ? (
                <>PROX. UNIDADE <i className="fa-solid fa-arrow-right"></i></>
            ) : (
                <>CONFIRMAR TUDO <i className="fa-solid fa-check-double"></i></>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default OrderWizard;
