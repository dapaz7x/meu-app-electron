
export enum OrderStatus {
  PREPARING = 'EM PREPARO',
  READY = 'PRONTO',
  FINALIZING = 'FINALIZANDO...',
  FINISHED = 'FINALIZADO'
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'LANCHE' | 'BURGER' | 'TAPIOCA' | 'CREPIOCA' | 'PASTEL';
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
  flavor?: string;
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
  finalizingAt?: number;
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

export interface NetworkDiagnostic {
  mode: 'local' | 'host' | 'client';
  localIps: string[];
  port: number;
  serverIp: string;
  serverListening: boolean;
  peerReachable: boolean | null;
  responseMs?: number;
  version?: string;
  error?: string;
  checkedAt: number;
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
      diagnoseNetwork: () => Promise<NetworkDiagnostic>;
      ordersList: () => Promise<Order[]>;
      ordersSave: (order: Order) => Promise<Order>;
      ordersImport: (orders: Order[]) => Promise<Order[]>;
      ordersStatus: (payload: { id: string; changes: Partial<Order> }) => Promise<{ ok: boolean }>;
      getAppVersion: () => Promise<string>;
    };
  }
}
