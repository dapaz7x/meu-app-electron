
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
  mode: 'usb' | 'network';
  printerIp: string;
  printerPort: number;
}

export interface NetworkConfig {
  mode: 'local' | 'host' | 'client';
  serverIp: string;
  port: number;
  localIps?: string[];
}

declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (payload: {
        printerName: string;
        printerMode: 'usb' | 'network';
        printerIp: string;
        printerPort: number;
        rawData: string;
      }) => Promise<void>;
      openPrintLog: () => Promise<void>;
      checkNetworkPrinter: (payload: { printerIp: string; printerPort: number }) => Promise<{ reachable: boolean }>;
      getNetworkConfig: () => Promise<NetworkConfig>;
      saveNetworkConfig: (config: NetworkConfig) => Promise<NetworkConfig>;
      ordersList: () => Promise<Order[]>;
      ordersSave: (order: Order) => Promise<Order>;
      ordersImport: (orders: Order[]) => Promise<Order[]>;
      ordersStatus: (payload: { id: string; changes: Partial<Order> }) => Promise<{ ok: boolean }>;
      getAppVersion: () => Promise<string>;
    };
  }
}
