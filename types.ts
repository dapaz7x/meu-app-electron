
export enum OrderStatus {
  PREPARING = 'EM PREPARO',
  READY = 'PRONTO',
  FINALIZING = 'FINALIZANDO...',
  FINISHED = 'FINALIZADO'
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'LANCHE' | 'BURGER' | 'TAPIOCA' | 'CREPIOCA';
  icon: string;
}

export interface AddOn {
  id: string;
  name: string;
  type: 'SALGADO' | 'DOCE';
}

export interface OrderItemConfig {
  selectedAddOns: AddOn[];
  cheese?: string;
  observation: string;
}

export interface OrderEntry {
  id: string;
  item: MenuItem;
  quantity: number;
  configs: OrderItemConfig[];
  addedAt: number;
}

export interface Order {
  id: string;
  comanda: string;
  entries: OrderEntry[];
  status: OrderStatus;
  createdAt: number;
  readyAt?: number;
  finishedAt?: number;
}

export type View = 'DASHBOARD' | 'WIZARD' | 'REPORTS' | 'SETTINGS';

export interface PrinterConfig {
  name: string;
}

declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (payload: { printerName: string; rawData: string }) => Promise<void>;
      openPrintLog: () => Promise<void>;
    };
  }
}
