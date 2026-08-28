
import { MenuItem, AddOn } from './types';

export const MENU_ITEMS: MenuItem[] = [
  // LANCHES NA CHAPA
  { id: '1', name: 'Ovos Mexidos', category: 'LANCHE', icon: 'fa-solid fa-egg' },
  { id: '2', name: 'Omelete Araújo', category: 'LANCHE', icon: 'fa-solid fa-stroopwafel' },
  { id: '3', name: 'Macarrão na Chapa', category: 'LANCHE', icon: 'fa-solid fa-plate-wheat' },
  { id: '4', name: 'Pão com Pernil', category: 'LANCHE', icon: 'fa-solid fa-bread-slice' },
  { id: '5', name: 'Pão c/ Queijo na Chapa', category: 'LANCHE', icon: 'fa-solid fa-cheese' },
  { id: '6', name: 'Pão com Manteiga', category: 'LANCHE', icon: 'fa-solid fa-bread-slice' },
  { id: '7', name: 'Pão com Linguiça', category: 'LANCHE', icon: 'fa-solid fa-hotdog' },
  { id: '8', name: 'Pão c/ Ovo e Queijo Minas', category: 'LANCHE', icon: 'fa-solid fa-egg' },
  { id: '9', name: 'Pão com Ovo', category: 'LANCHE', icon: 'fa-solid fa-egg' },
  { id: '10', name: 'Misto Quente', category: 'LANCHE', icon: 'fa-solid fa-bread-slice' },
  { id: '11', name: 'Misto c/ Ovo', category: 'LANCHE', icon: 'fa-solid fa-egg' },
  { id: '12', name: 'Misto c/ Ovo e Bacon', category: 'LANCHE', icon: 'fa-solid fa-bacon' },
  { id: '13', name: 'Tapioca', category: 'TAPIOCA', icon: 'fa-solid fa-moon' },
  { id: '14', name: 'Crepioca', category: 'CREPIOCA', icon: 'fa-solid fa-circle-dot' },
  // HAMBÚRGUERES
  { id: '15', name: 'Tradicional Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '16', name: 'Kids Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '17', name: 'Picante Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '18', name: 'Egg Bacon Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '19', name: 'X Burguer Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '20', name: 'Duplo Cheddar Araújo', category: 'BURGER', icon: 'fa-solid fa-burger' },
  { id: '21', name: 'Batata Frita', category: 'LANCHE', icon: 'fa-solid fa-bowl-food' },
];

export const SALTY_ADDONS: AddOn[] = [
  { id: 's1', name: 'Frango', type: 'SALGADO' },
  { id: 's2', name: 'Bacon', type: 'SALGADO' },
  { id: 's3', name: 'Peito de peru', type: 'SALGADO' },
  { id: 's4', name: 'Pernil', type: 'SALGADO' },
  { id: 's5', name: 'Linguiça', type: 'SALGADO' },
  { id: 's6', name: 'Mortadela comum', type: 'SALGADO' },
  { id: 's7', name: 'Mortadela defumada', type: 'SALGADO' },
  { id: 's8', name: 'Ovo', type: 'SALGADO' },
  { id: 's9', name: 'Pimentão', type: 'SALGADO' },
  { id: 's10', name: 'Cebola', type: 'SALGADO' },
  { id: 's11', name: 'Tomate', type: 'SALGADO' },
  { id: 's12', name: 'Cenoura', type: 'SALGADO' },
  { id: 's13', name: 'Palmito', type: 'SALGADO' },
  { id: 's14', name: 'Azeitona', type: 'SALGADO' },
  { id: 's15', name: 'Catupiry', type: 'SALGADO' },
  { id: 's16', name: 'Cheddar', type: 'SALGADO' },
  { id: 's17', name: 'Milho', type: 'SALGADO' },
  { id: 's18', name: 'Mussarela', type: 'SALGADO' },
  { id: 's19', name: 'Queijo Minas', type: 'SALGADO' },
];

export const SWEET_ADDONS: AddOn[] = [
  { id: 'd1', name: 'Morango', type: 'DOCE' },
  { id: 'd2', name: 'Chocolate', type: 'DOCE' },
  { id: 'd3', name: 'Uva', type: 'DOCE' },
  { id: 'd4', name: 'Nutella', type: 'DOCE' },
  { id: 'd5', name: 'Confete', type: 'DOCE' },
  { id: 'd6', name: 'Doce de leite', type: 'DOCE' },
  { id: 'd7', name: 'Banana', type: 'DOCE' },
  { id: 'd8', name: 'Mel', type: 'DOCE' },
];

export const CHEESE_OPTIONS = ['Catupiry', 'Cheddar', 'Nenhum'];
