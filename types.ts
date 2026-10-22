
export enum OrderStatus {
  PREPARING = 'EM PREPARO',
  READY = 'PRONTO',
  FINALIZING = 'FINALIZANDO...',
  FINISHED = 'FINALIZADO'
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'LANCHE' | 'BURGER' | 'TAPIOCA' | 'CREPIOCA' | 'PASTEL' | 'LIVRE';
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
  /** Observação da comanda no momento deste lançamento, preservada no histórico. */
  orderObservation?: string;
}

export type OrderDraftEntry = Pick<OrderEntry, 'item' | 'quantity' | 'configs'>;

export interface Order {
  id: string;
  comanda: string;
  entries: OrderEntry[];
  observation?: string;
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

export interface NetworkDiagnostics {
  ok: boolean;
  mode: 'local' | 'host' | 'client';
  localIps: string[];
  port: number;
  serverIp: string;
  serverListening?: boolean;
  peerConnected?: boolean;
  peerIp?: string;
  lastPeerSeenAt?: number;
  latencyMs?: number;
  message: string;
}

export interface SaveNetworkConfigResult extends NetworkConfig {
  connectionOk: boolean;
  connectionError: string;
}

export interface ReportWeek {
  id: string;
  start: string;
  end: string;
}

export interface ReportRecord {
  week: string;
  orderId: string;
  entryId: string;
  comanda: string;
  productId: string;
  productName: string;
  quantity: number;
  configs: OrderItemConfig[];
  orderObservation?: string;
  addedAt: number;
  orderCreatedAt: number;
  orderStatus: OrderStatus;
  readyAt: number | null;
  finishedAt: number | null;
  status: 'VÁLIDO' | 'CANCELADO';
  cancelledAt?: number;
  cancellationReason?: string;
}

export interface WeeklyReport {
  week: ReportWeek;
  records: ReportRecord[];
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
      saveNetworkConfig: (config: NetworkConfig) => Promise<SaveNetworkConfigResult>;
      checkNetworkLink: () => Promise<NetworkDiagnostics>;
      ordersList: () => Promise<Order[]>;
      ordersSave: (order: Order) => Promise<Order>;
      ordersImport: (orders: Order[]) => Promise<Order[]>;
      ordersStatus: (payload: { id: string; changes: Partial<Order> }) => Promise<{ ok: boolean }>;
      reportsWeeks: () => Promise<ReportWeek[]>;
      reportsWeek: (week: string) => Promise<WeeklyReport>;
      reportsCancel: (payload: { orderId: string; entryId: string; reason: string }) => Promise<WeeklyReport>;
      reportsOpenFolder: () => Promise<void>;
      getAppVersion: () => Promise<string>;
    };
  }
}
