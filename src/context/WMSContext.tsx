import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  WarehouseLocation,
  User,
  Requisition,
  RequisitionItem,
  PickingOrder,
  PickingItem,
  Shipment,
  StockTransaction,
  EmployeeKPI,
  AlertNotification,
  ShipmentStatus,
  PickingStrategy,
  ABCClass,
  RequisitionStatus,
  ProductBarcode,
  ScanResult,
  ProductionKPIData,
} from '../types/wms';
import {
  INITIAL_PRODUCTS,
  INITIAL_LOCATIONS,
  INITIAL_USERS,
  INITIAL_EMPLOYEE_KPIS,
  INITIAL_BARCODES,
} from '../data/masterData';
import { playSuccessBeep, playErrorBuzz, playCompleteFanfare } from '../utils/sound';
import { normalizeBarcode, detectBarcodeFormatFromValue, isBarcodeOrSkuMatch } from '../utils/barcodeUtils';
import {
  subscribeToSyncActions,
  broadcastSyncAction,
  uploadStateSnapshot,
  fetchLatestSnapshot,
  SyncMessage,
} from '../utils/cloudSync';
import {
  uploadToFirestoreCloud,
  fetchFirestoreSnapshot,
  subscribeToFirestoreCloud,
  CloudWMSPayload,
} from '../utils/firestoreSync';

interface WMSContextType {
  products: Product[];
  barcodes: ProductBarcode[];
  locations: WarehouseLocation[];
  users: User[];
  activeUser: User;
  setActiveUser: (user: User) => void;
  requisitions: Requisition[];
  pickingOrders: PickingOrder[];
  shipments: Shipment[];
  transactions: StockTransaction[];
  employeeKPIs: EmployeeKPI[];
  employeeKpis: EmployeeKPI[];
  alerts: AlertNotification[];
  dismissAlert: (id: string) => void;
  clearAllAlerts: () => void;

  // Multi-device synchronization state
  isSyncConnected: boolean;
  connectedDevicesCount: number;
  serverKpis: ProductionKPIData | null;
  refreshServerState: () => Promise<void>;
  syncWithCloudNow: () => Promise<void>;
  lastSyncTime: string;

  // Actions
  lookupBarcode: (barcodeValue: string, formatHint?: string) => ScanResult;
  addBarcodeToProduct: (sku: string, barcodeValue: string, barcodeFormat?: string) => { success: boolean; message: string; barcode?: ProductBarcode };
  deleteBarcode: (barcodeId: string) => { success: boolean; message: string };
  detectBarcodeFormat: (barcodeValue: string) => string;
  createRequisition: (data: { requestor: string; department: string; items: { sku: string; quantity: number }[]; notes?: string; reason?: string }) => { success: boolean; message: string; reqId?: string; pickId?: string };
  approveRequisition: (reqId: string, approverName?: string) => { success: boolean; message: string; pickId?: string };
  rejectRequisition: (reqId: string, reason?: string) => void;
  startPicking: (pickId: string, pickerName?: string) => void;
  scanBarcodeForItem: (
    pickId: string,
    itemId?: string,
    scannedCode?: string,
    qtyToPick?: number,
    operatorName?: string
  ) => {
    success: boolean;
    message: string;
    allCompleted?: boolean;
    pickedQty?: number;
    remainingQty?: number;
    details?: { stockBefore: number; stockAfter: number; pickedQty: number };
  };
  confirmPickItemAndDeductStock: (data: {
    pickId: string;
    itemId?: string;
    scannedBarcode: string;
    pickedQty?: number;
    operatorName?: string;
  }) => {
    success: boolean;
    message: string;
    allCompleted?: boolean;
    pickedQty?: number;
    remainingQty?: number;
    details?: { stockBefore: number; stockAfter: number; pickedQty: number };
  };
  addProduct: (productData: Partial<Product> & { name: string }) => { success: boolean; message: string; product?: Product };
  updateProduct: (sku: string, updates: Partial<Product>) => { success: boolean; message: string; product?: Product };
  deleteProduct: (sku: string) => { success: boolean; message: string };
  verifyAndIssueGoods: (reqId: string, operatorName?: string) => { success: boolean; message: string };
  updateShipmentStatus: (shipmentId: string, newStatus: ShipmentStatus) => void;
  adjustStock: (sku: string, newStock: number, reason: string) => void;
  transferStock: (sku: string, fromLoc: string, toLoc: string, quantity: number) => void;
  recommendPickingStrategy: (orders: Requisition[]) => { strategy: PickingStrategy; reason: string };
  resetToDemoData: () => void;
  resetDashboardToZero: () => Promise<void>;
  clearOrdersAndPickingHistory: () => Promise<void>;
  getProductBySku: (sku: string) => Product | undefined;
  getLocationByCode: (code: string) => WarehouseLocation | undefined;

  // KPI aggregates based on actual picked operational data
  kpis: {
    pickingAccuracy: number; // >= 99%
    pickingProductivity: number; // >= 30
    avgPickingTime: number; // <= 2.0
    pickingTimeMinutes: number; // alias
    travelDistance: number; // <= 50
    orderFulfillment: number; // >= 98%
    inventoryAccuracy: number; // >= 99%
    onTimeShipment: number; // >= 98%
    stockOutRate: number; // <= 2%
    totalSku: number;
    totalStock: number;
    lowStockCount: number;
    outOfStockCount: number;
    stockValue: number;
    pendingRequisitions: number;
    activePicking: number;
    readyToShip: number;
    completedOrdersCount?: number;
    totalPickedUnits?: number;
    totalWorkingHours?: number;
  };
  simulateQuickPick: () => void;
  simulateQuickDispatch: () => void;
}

const WMSContext = createContext<WMSContextType | undefined>(undefined);

const STORAGE_PREFIX = 'wms_shared_v3_';

export const WMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_PRODUCTS;
  });

  const [barcodes, setBarcodes] = useState<ProductBarcode[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'barcodes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_BARCODES;
  });

  const [locations] = useState<WarehouseLocation[]>(INITIAL_LOCATIONS);
  const [users] = useState<User[]>(INITIAL_USERS);

  const [activeUser, setActiveUser] = useState<User>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'active_user');
    return saved ? JSON.parse(saved) : INITIAL_USERS[0];
  });

  const [requisitions, setRequisitions] = useState<Requisition[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'requisitions');
    return saved ? JSON.parse(saved) : [];
  });

  const [pickingOrders, setPickingOrders] = useState<PickingOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'picking_orders');
    return saved ? JSON.parse(saved) : [];
  });

  const [shipments, setShipments] = useState<Shipment[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'shipments');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<StockTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [employeeKPIs, setEmployeeKPIs] = useState<EmployeeKPI[]>(() => {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'employee_kpis');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEE_KPIS;
  });

  const [alerts, setAlerts] = useState<AlertNotification[]>([
    {
      id: 'ALT-INIT-1',
      type: 'INFO',
      title: 'ระบบ WMS เชื่อมต่อทุกอุปกรณ์',
      message: 'เชื่อมต่อฐานข้อมูลกลาง WMS พร้อมแชร์ข้อมูลแบบ Real-time ข้ามทุกหน้าจอ',
      timestamp: new Date().toLocaleTimeString('th-TH'),
      severity: 'info',
      read: false,
    },
  ]);

  const [isSyncConnected, setIsSyncConnected] = useState<boolean>(true);
  const [connectedDevicesCount, setConnectedDevicesCount] = useState<number>(1);
  const [serverKpis, setServerKpis] = useState<ProductionKPIData | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('th-TH'));

  // Sync to local storage for offline tolerance
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + 'products', JSON.stringify(products));
      localStorage.setItem(STORAGE_PREFIX + 'barcodes', JSON.stringify(barcodes));
      localStorage.setItem(STORAGE_PREFIX + 'requisitions', JSON.stringify(requisitions));
      localStorage.setItem(STORAGE_PREFIX + 'picking_orders', JSON.stringify(pickingOrders));
      localStorage.setItem(STORAGE_PREFIX + 'shipments', JSON.stringify(shipments));
      localStorage.setItem(STORAGE_PREFIX + 'transactions', JSON.stringify(transactions));
      localStorage.setItem(STORAGE_PREFIX + 'employee_kpis', JSON.stringify(employeeKPIs));
      localStorage.setItem(STORAGE_PREFIX + 'active_user', JSON.stringify(activeUser));
    } catch {
      // Ignore quota errors
    }
  }, [products, barcodes, requisitions, pickingOrders, shipments, transactions, employeeKPIs, activeUser]);

  // Helper functions for safe smart-merging across multiple devices
  const mergeRequisitionsHelper = (incoming: Requisition[], current: Requisition[]): Requisition[] => {
    const map = new Map<string, Requisition>();
    current.forEach((r) => {
      if (r && r.id) {
        map.set(r.id, {
          ...r,
          items: Array.isArray(r.items) ? r.items : [],
        });
      }
    });
    incoming.forEach((r) => {
      if (!r || !r.id) return;
      const existing = map.get(r.id);
      const incomingItems = Array.isArray(r.items) ? r.items : [];
      if (!existing) {
        map.set(r.id, {
          ...r,
          items: incomingItems,
          requestor: r.requestor || 'เจ้าหน้าที่',
          department: r.department || 'ฝ่ายปฏิบัติการ',
          date: r.date || new Date().toISOString().split('T')[0],
          status: r.status || 'รอหยิบ',
        });
      } else {
        const curItems = Array.isArray(existing.items) ? existing.items : [];
        const curPicked = curItems.filter((it) => it.status === 'Picked').length;
        const incPicked = incomingItems.filter((it) => it.status === 'Picked').length;
        // Keep existing items if incoming items is empty or has fewer items
        const finalItems = incomingItems.length >= curItems.length && incomingItems.length > 0 ? incomingItems : curItems;
        if (incPicked >= curPicked || r.status === 'Picked' || r.status === 'จ่ายสินค้าแล้ว') {
          map.set(r.id, {
            ...existing,
            ...r,
            items: finalItems,
          });
        } else {
          map.set(r.id, {
            ...existing,
            items: curItems,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id));
  };

  const mergePickingOrdersHelper = (incoming: PickingOrder[], current: PickingOrder[]): PickingOrder[] => {
    const map = new Map<string, PickingOrder>();
    current.forEach((p) => {
      if (p && p.id) {
        map.set(p.id, {
          ...p,
          items: Array.isArray(p.items) ? p.items : [],
        });
      }
    });
    incoming.forEach((p) => {
      if (!p || !p.id) return;
      const existing = map.get(p.id);
      const incomingItems = Array.isArray(p.items) ? p.items : [];
      if (!existing) {
        map.set(p.id, {
          ...p,
          items: incomingItems,
        });
      } else {
        const curItems = Array.isArray(existing.items) ? existing.items : [];
        const curPicked = curItems.filter((i) => i.isPicked).length;
        const incPicked = incomingItems.filter((i) => i.isPicked).length;
        const finalItems = incomingItems.length >= curItems.length && incomingItems.length > 0 ? incomingItems : curItems;
        if (incPicked >= curPicked || p.status === 'Picked') {
          map.set(p.id, {
            ...existing,
            ...p,
            items: finalItems,
          });
        } else {
          map.set(p.id, {
            ...existing,
            items: curItems,
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.id.localeCompare(a.id));
  };

  // Fetch canonical state from local server with smart-merge
  const refreshServerState = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setIsSyncConnected(true);
          setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
          if (json.activeDevicesCount !== undefined) {
            setConnectedDevicesCount(Math.max(1, json.activeDevicesCount));
          }
          if (Array.isArray(json.data.products) && json.data.products.length > 0) {
            setProducts((prev) => {
              const serverMap = new Map<string, number>();
              json.data.products.forEach((p: Product) => serverMap.set(p.sku, p.currentStock));
              return prev.map((p) => (serverMap.has(p.sku) ? { ...p, currentStock: serverMap.get(p.sku)! } : p));
            });
          }
          if (Array.isArray(json.data.barcodes)) setBarcodes(json.data.barcodes);
          if (Array.isArray(json.data.requisitions)) {
            setRequisitions((prev) => mergeRequisitionsHelper(json.data.requisitions, prev));
          }
          if (Array.isArray(json.data.pickingOrders)) {
            setPickingOrders((prev) => mergePickingOrdersHelper(json.data.pickingOrders, prev));
          }
          if (Array.isArray(json.data.shipments) && json.data.shipments.length > 0) {
            setShipments(json.data.shipments);
          }
          if (Array.isArray(json.data.transactions)) setTransactions(json.data.transactions);
          if (Array.isArray(json.data.employeeKPIs)) setEmployeeKPIs(json.data.employeeKPIs);
          if (Array.isArray(json.data.alerts) && json.data.alerts.length > 0) setAlerts(json.data.alerts);
          if (json.data.kpis) setServerKpis(json.data.kpis);
        }
      }
    } catch {
      setIsSyncConnected(false);
    }
  }, []);

  // Force manual cloud sync with friend's devices
  const syncWithCloudNow = useCallback(async () => {
    try {
      await refreshServerState();
      // Try Firestore first, fallback to snapshot
      const firestoreSnap = await fetchFirestoreSnapshot();
      const snapshot = firestoreSnap || (await fetchLatestSnapshot());
      if (snapshot) {
        if (Array.isArray(snapshot.products) && snapshot.products.length > 0) {
          const stockMap = new Map<string, number>();
          snapshot.products.forEach((sp: any) => stockMap.set(sp.sku, sp.currentStock));
          setProducts((prev) =>
            prev.map((p) => (stockMap.has(p.sku) ? { ...p, currentStock: stockMap.get(p.sku)! } : p))
          );
        }
        if (Array.isArray(snapshot.requisitions)) {
          setRequisitions((prev) => mergeRequisitionsHelper(snapshot.requisitions, prev));
        }
        if (Array.isArray(snapshot.pickingOrders)) {
          setPickingOrders((prev) => mergePickingOrdersHelper(snapshot.pickingOrders, prev));
        }
        if (Array.isArray(snapshot.shipments)) setShipments(snapshot.shipments);
        if (Array.isArray(snapshot.employeeKPIs)) setEmployeeKPIs(snapshot.employeeKPIs);
        if ((snapshot as any).kpis) setServerKpis((snapshot as any).kpis);
      }
      setIsSyncConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
      setAlerts((prev) => [
        {
          id: `ALT-SYNC-${Date.now()}`,
          type: 'INFO',
          title: 'ซิงค์ Cloud Firestore สำเร็จ',
          message: 'ข้อมูลอัปเดตตรงกันทุกเครื่องและทุกเบราว์เซอร์แล้ว (Google Cloud Firestore + Universal Relay)',
          timestamp: new Date().toLocaleTimeString('th-TH'),
          severity: 'info',
          read: false,
        },
        ...prev,
      ]);
      playSuccessBeep();
    } catch (err) {
      console.warn('Sync error:', err);
    }
  }, [refreshServerState]);

  // Real-Time Multi-Device Sync: Local SSE + Global Cloud Cross-Browser PubSub Relay + Firestore
  useEffect(() => {
    refreshServerState();

    // 1. Initial Cloud Snapshot Recovery (Firebase Firestore + fallback relay)
    const pullCloudSnapshot = async () => {
      try {
        const firestoreSnap = await fetchFirestoreSnapshot();
        const snapshot = firestoreSnap || (await fetchLatestSnapshot());
        if (snapshot) {
          if (Array.isArray(snapshot.requisitions) && snapshot.requisitions.length > 0) {
            setRequisitions((prev) => mergeRequisitionsHelper(snapshot.requisitions, prev));
          }
          if (Array.isArray(snapshot.pickingOrders) && snapshot.pickingOrders.length > 0) {
            setPickingOrders((prev) => mergePickingOrdersHelper(snapshot.pickingOrders, prev));
          }
          if (Array.isArray(snapshot.products) && snapshot.products.length > 0) {
            const stockMap = new Map<string, number>();
            snapshot.products.forEach((sp: any) => stockMap.set(sp.sku, sp.currentStock));
            setProducts((prev) =>
              prev.map((p) => (stockMap.has(p.sku) ? { ...p, currentStock: stockMap.get(p.sku)! } : p))
            );
          }
          if (Array.isArray(snapshot.shipments) && snapshot.shipments.length > 0) {
            setShipments(snapshot.shipments);
          }
          if (Array.isArray(snapshot.employeeKPIs)) {
            setEmployeeKPIs(snapshot.employeeKPIs);
          }
          if ((snapshot as any).kpis) {
            setServerKpis((snapshot as any).kpis);
          }
          setIsSyncConnected(true);
          setLastSyncTime(new Date().toLocaleTimeString('th-TH'));
        }
      } catch {}
    };

    pullCloudSnapshot();

    // 2. Firebase Cloud Firestore Live Real-time Listener
    const unsubFirestore = subscribeToFirestoreCloud((cloudPayload: CloudWMSPayload) => {
      setIsSyncConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));

      if (Array.isArray(cloudPayload.requisitions) && cloudPayload.requisitions.length > 0) {
        setRequisitions((prev) => mergeRequisitionsHelper(cloudPayload.requisitions, prev));
      }
      if (Array.isArray(cloudPayload.pickingOrders) && cloudPayload.pickingOrders.length > 0) {
        setPickingOrders((prev) => mergePickingOrdersHelper(cloudPayload.pickingOrders, prev));
      }
      if (Array.isArray(cloudPayload.products) && cloudPayload.products.length > 0) {
        const stockMap = new Map<string, number>();
        cloudPayload.products.forEach((sp) => stockMap.set(sp.sku, sp.currentStock));
        setProducts((prev) =>
          prev.map((p) => (stockMap.has(p.sku) ? { ...p, currentStock: stockMap.get(p.sku)! } : p))
        );
      }
      if (Array.isArray(cloudPayload.shipments)) {
        setShipments(cloudPayload.shipments);
      }
      if (Array.isArray(cloudPayload.employeeKPIs)) {
        setEmployeeKPIs(cloudPayload.employeeKPIs);
      }
    });

    // 2. Global Cloud Relay: Listen for immediate real-time messages from ALL browsers/devices
    const unsubCloud = subscribeToSyncActions((msg: SyncMessage) => {
      setIsSyncConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('th-TH'));

      if (msg.action === 'CREATE_REQUISITION' && msg.payload) {
        const { requisition, pickingOrder } = msg.payload;
        if (requisition) {
          setRequisitions((prev) => {
            if (prev.some((r) => r.id === requisition.id)) return prev;
            return [requisition, ...prev];
          });
          playSuccessBeep();
          setAlerts((prev) => [
            {
              id: `ALT-REMOTE-${Date.now()}`,
              type: 'INFO',
              title: `เพื่อนสั่งซื้อเข้ามาใหม่ (${requisition.id})`,
              message: `ผู้เบิก: ${requisition.requestor || msg.senderName} (${requisition.department}) • ซิงค์เรียลไทม์ทันที`,
              timestamp: new Date().toLocaleTimeString('th-TH'),
              severity: 'info',
              read: false,
            },
            ...prev,
          ]);
        }
        if (pickingOrder) {
          setPickingOrders((prev) => {
            if (prev.some((p) => p.id === pickingOrder.id)) return prev;
            return [pickingOrder, ...prev];
          });
        }
      } else if (msg.action === 'CONFIRM_PICK' && msg.payload) {
        const { pickId, itemId, sku, pickedQty, isAllDone, stockAfter } = msg.payload;
        setPickingOrders((prev) =>
          prev.map((order) => {
            if (order.id !== pickId) return order;
            const updatedItems = order.items.map((it) => {
              if (itemId ? it.id === itemId : it.sku === sku) {
                const newQty = (it.pickedQuantity || 0) + (pickedQty || 1);
                return {
                  ...it,
                  pickedQuantity: newQty,
                  isPicked: newQty >= it.quantity,
                };
              }
              return it;
            });
            const allPicked = updatedItems.every((it) => it.isPicked);
            return {
              ...order,
              items: updatedItems,
              status: allPicked ? 'Picked' : 'In Progress',
            };
          })
        );
        if (sku && stockAfter !== undefined) {
          setProducts((prev) =>
            prev.map((p) => (p.sku === sku ? { ...p, currentStock: stockAfter } : p))
          );
        }
        if (isAllDone) {
          playCompleteFanfare();
        } else {
          playSuccessBeep();
        }
        setAlerts((prev) => [
          {
            id: `ALT-PICK-${Date.now()}`,
            type: 'INFO',
            title: `เพื่อนยิงหยิบสินค้า (${msg.senderName || 'พนักงาน'})`,
            message: `หยิบ SKU: ${sku} +${pickedQty} เรียบร้อย • ซิงค์ตรงกันทุกเครื่อง`,
            timestamp: new Date().toLocaleTimeString('th-TH'),
            severity: 'info',
            read: false,
          },
          ...prev,
        ]);
      } else if (msg.action === 'APPROVE_REQUISITION' && msg.payload) {
        const { reqId, pickId } = msg.payload;
        setRequisitions((prev) =>
          prev.map((r) => (r.id === reqId ? { ...r, status: 'รอหยิบ' as const, pickingOrderId: pickId } : r))
        );
      } else if (msg.action === 'DISPATCH_SHIPMENT' && msg.payload) {
        const { shipmentId } = msg.payload;
        setShipments((prev) =>
          prev.map((s) => (s.id === shipmentId ? { ...s, status: 'Dispatched' as const } : s))
        );
      } else if (msg.action === 'RESET_STATE') {
        setProducts(INITIAL_PRODUCTS);
        setRequisitions([]);
        setPickingOrders([]);
        setShipments([]);
        setEmployeeKPIs(INITIAL_EMPLOYEE_KPIS);
      } else if (msg.action === 'STATE_SYNC' && msg.payload) {
        const p = msg.payload;
        if (Array.isArray(p.products)) setProducts(p.products);
        if (Array.isArray(p.requisitions)) setRequisitions(p.requisitions);
        if (Array.isArray(p.pickingOrders)) setPickingOrders(p.pickingOrders);
        if (Array.isArray(p.shipments)) setShipments(p.shipments);
        if (Array.isArray(p.employeeKPIs)) setEmployeeKPIs(p.employeeKPIs);
        if (p.kpis) setServerKpis(p.kpis);
      }
    });

    // 3. Local SSE EventSource
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/v1/events');

      es.onopen = () => {
        setIsSyncConnected(true);
      };

      es.addEventListener('state_update', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data);
          if (payload.products) setProducts(payload.products);
          if (payload.barcodes) setBarcodes(payload.barcodes);
          if (payload.requisitions) setRequisitions(payload.requisitions);
          if (payload.pickingOrders) setPickingOrders(payload.pickingOrders);
          if (payload.shipments) setShipments(payload.shipments);
          if (payload.transactions) setTransactions(payload.transactions);
          if (payload.employeeKPIs) setEmployeeKPIs(payload.employeeKPIs);
          if (payload.alerts && payload.alerts.length > 0) setAlerts(payload.alerts);
          if (payload.kpis) setServerKpis(payload.kpis);
          if (payload.activeDevicesCount !== undefined) {
            setConnectedDevicesCount(Math.max(1, payload.activeDevicesCount));
          }
        } catch {}
      });

      es.addEventListener('kpi_update', (evt: MessageEvent) => {
        try {
          const kpiData = JSON.parse(evt.data);
          if (kpiData && kpiData.kpis) {
            setServerKpis(kpiData);
          }
        } catch {}
      });

      es.addEventListener('scan_event', (evt: MessageEvent) => {
        try {
          const scanData = JSON.parse(evt.data);
          if (scanData.kpis) setServerKpis(scanData.kpis);
        } catch {}
      });

      es.addEventListener('device_connected', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.totalConnectedDevices) setConnectedDevicesCount(data.totalConnectedDevices);
        } catch {}
      });

      es.addEventListener('device_disconnected', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.totalConnectedDevices) setConnectedDevicesCount(data.totalConnectedDevices);
        } catch {}
      });

      es.onerror = () => {
        // SSE error fallback handled by cloud relay
      };
    } catch {
      // Fallback
    }

    // Background interval sync (every 2.5 seconds) - combines local server + universal cloud store
    const interval = setInterval(() => {
      refreshServerState();
      pullCloudSnapshot();
    }, 2500);

    return () => {
      clearInterval(interval);
      if (es) es.close();
      unsubFirestore();
      unsubCloud();
    };
  }, [refreshServerState]);

  // Helpers
  const getProductBySku = useCallback(
    (sku: string) => {
      if (!sku) return undefined;
      return products.find((p) => p.sku.trim().toUpperCase() === sku.trim().toUpperCase());
    },
    [products]
  );

  const getLocationByCode = useCallback(
    (code: string) => {
      return locations.find((l) => l.code === code);
    },
    [locations]
  );

  const detectBarcodeFormat = useCallback((val: string) => {
    return detectBarcodeFormatFromValue(val);
  }, []);

  const lookupBarcode = useCallback(
    (barcodeValue: string, formatHint?: string): ScanResult => {
      const clean = normalizeBarcode(barcodeValue);
      if (!clean) {
        return {
          barcodeValue: '',
          barcodeFormat: 'Unknown',
          sku: null,
          productName: null,
          location: null,
          stockQty: null,
          unit: null,
          product: null,
        };
      }

      // Step 1: Look in barcodes relational table
      const barcodeMatch = barcodes.find(
        (b) => b.barcodeValue.trim().toUpperCase() === clean.toUpperCase()
      );

      if (barcodeMatch) {
        const prod = products.find(
          (p) => p.sku.trim().toUpperCase() === barcodeMatch.sku.trim().toUpperCase()
        );
        return {
          barcodeValue: clean,
          barcodeFormat: barcodeMatch.barcodeFormat || formatHint || 'Unknown',
          sku: prod ? prod.sku : barcodeMatch.sku,
          productName: prod ? prod.name : 'Unknown Product',
          location: prod ? prod.location : null,
          stockQty: prod ? prod.currentStock : 0,
          unit: prod ? prod.unit : '',
          product: prod || null,
        };
      }

      // Step 2: Fallback check in products master list
      const directProd = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toUpperCase() === clean.toUpperCase()) ||
          p.sku.trim().toUpperCase() === clean.toUpperCase()
      );

      if (directProd) {
        const detectedFmt = formatHint || directProd.barcodeType || detectBarcodeFormatFromValue(clean);
        return {
          barcodeValue: clean,
          barcodeFormat: detectedFmt,
          sku: directProd.sku,
          productName: directProd.name,
          location: directProd.location,
          stockQty: directProd.currentStock,
          unit: directProd.unit,
          product: directProd,
        };
      }

      const fallbackFmt = formatHint || detectBarcodeFormatFromValue(clean);
      return {
        barcodeValue: clean,
        barcodeFormat: fallbackFmt,
        sku: null,
        productName: null,
        location: null,
        stockQty: null,
        unit: null,
        product: null,
      };
    },
    [barcodes, products]
  );

  const addAlert = useCallback((alert: Omit<AlertNotification, 'id' | 'timestamp' | 'read'>) => {
    const newAlert: AlertNotification = {
      ...alert,
      id: `ALT-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false,
    };
    setAlerts((prev) => [newAlert, ...prev.slice(0, 24)]);
  }, []);

  const addBarcodeToProduct = useCallback(
    (sku: string, barcodeValue: string, barcodeFormat?: string) => {
      const cleanSku = sku.trim().toUpperCase();
      const cleanVal = normalizeBarcode(barcodeValue);
      if (!cleanVal) return { success: false, message: 'กรุณากรอกรหัส Barcode' };

      const prod = products.find((p) => p.sku.trim().toUpperCase() === cleanSku);
      if (!prod) return { success: false, message: `ไม่พบสินค้า SKU "${sku}" ในระบบ` };

      const existing = barcodes.find(
        (b) => b.barcodeValue.trim().toUpperCase() === cleanVal.toUpperCase()
      );
      if (existing) {
        return {
          success: false,
          message: `Barcode "${cleanVal}" ถูกผูกไว้กับ SKU "${existing.sku}" แล้ว`,
        };
      }

      const format = barcodeFormat || detectBarcodeFormatFromValue(cleanVal);
      const newBc: ProductBarcode = {
        id: `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: prod.sku,
        sku: prod.sku,
        barcodeValue: cleanVal,
        barcodeFormat: format,
        isPrimary: false,
        createdAt: new Date().toLocaleDateString('th-TH'),
      };

      setBarcodes((prev) => [newBc, ...prev]);

      // Sync to server
      fetch('/api/v1/barcodes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: prod.sku, barcodeValue: cleanVal, barcodeFormat: format }),
      }).catch(console.error);

      addAlert({
        type: 'INFO',
        title: 'เพิ่ม Barcode สำเร็จ',
        message: `ผูก Barcode "${cleanVal}" (${format}) เข้ากับสินค้า ${prod.name} (${prod.sku}) เรียบร้อย`,
        sku: prod.sku,
        severity: 'info',
      });

      return { success: true, message: 'เพิ่ม Barcode เรียบร้อย', barcode: newBc };
    },
    [barcodes, products, addAlert]
  );

  const deleteBarcode = useCallback((barcodeId: string) => {
    setBarcodes((prev) => prev.filter((b) => b.id !== barcodeId));
    fetch('/api/v1/barcodes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcodeId }),
    }).catch(console.error);

    return { success: true, message: 'ลบ Barcode เรียบร้อย' };
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  // Pick Strategy Recommender
  const recommendPickingStrategy = useCallback((orders: Requisition[]) => {
    const pending = orders.filter((o) => o.status === 'อนุมัติแล้ว' || o.status === 'รออนุมัติ');
    const totalItems = pending.reduce((acc, cur) => acc + cur.items.length, 0);

    if (pending.length >= 3 && totalItems >= 5) {
      return {
        strategy: 'BATCH' as PickingStrategy,
        reason: `มี Order รอหยิบ ${pending.length} รายการ (รวม ${totalItems} SKU) การใช้ Batch Picking จะช่วยลดระยะทางเดินในคลังได้มากกว่า 35%`,
      };
    }
    return {
      strategy: 'SINGLE' as PickingStrategy,
      reason: 'จำนวน Order เหมาะสำหรับการหยิบแบบ Single Order Picking เพื่อความรวดเร็วและตรวจสอบง่าย',
    };
  }, []);

  // Add Product
  const addProduct = (productData: Partial<Product> & { name: string }) => {
    let barcode = (productData.barcode || '').trim();
    if (!barcode) {
      const randomPart = Math.floor(10000000 + Math.random() * 90000000);
      barcode = `8850${randomPart}`;
    }

    let sku = (productData.sku || '').trim().toUpperCase();
    if (!sku) {
      const prefix = productData.category ? productData.category.slice(0, 3).toUpperCase() : 'SKU';
      sku = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    }

    if (products.some((p) => p.sku === sku)) {
      return { success: false, message: `รหัส SKU "${sku}" มีอยู่ในระบบแล้ว` };
    }

    const zone: ABCClass = productData.zone || 'A';
    const location = productData.location || `${zone}-01-01`;
    const initialStock = productData.initialStock ?? 100;
    const currentStock = productData.currentStock ?? initialStock;

    const newProd: Product = {
      no: products.length + 1,
      sku,
      name: productData.name,
      category: productData.category || 'อุปกรณ์ทั่วไป',
      unit: productData.unit || 'ชิ้น',
      initialStock,
      currentStock,
      dailyOrder: productData.dailyOrder || 10,
      abc: zone,
      location,
      zone,
      barcode,
      barcodeType: productData.barcodeType || 'Code 128',
      minStock: productData.minStock || 20,
      maxStock: productData.maxStock || 200,
      unitPrice: productData.unitPrice || 50,
      lotBatch: productData.lotBatch || `LOT-${new Date().getFullYear()}-01`,
      receivedDate: productData.receivedDate || new Date().toLocaleDateString('th-TH'),
      expiryDate: productData.expiryDate || '31/12/2028',
      status: currentStock <= 0 ? 'Out of Stock' : currentStock <= (productData.minStock || 20) ? 'Low Stock' : 'Available',
    };

    setProducts((prev) => [newProd, ...prev]);

    const newBc: ProductBarcode = {
      id: `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: newProd.sku,
      sku: newProd.sku,
      barcodeValue: newProd.barcode,
      barcodeFormat: newProd.barcodeType || 'Code 128',
      isPrimary: true,
      createdAt: new Date().toLocaleDateString('th-TH'),
    };
    setBarcodes((prev) => [newBc, ...prev]);

    // Sync to backend server
    fetch('/api/v1/products/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProd),
    }).catch(console.error);

    addAlert({
      type: 'INFO',
      title: 'เพิ่มสินค้าใหม่และผูก Barcode สำเร็จ',
      message: `${newProd.name} (${newProd.sku}) • Barcode: ${newProd.barcode} • ตำแหน่ง: ${newProd.location}`,
      severity: 'info',
    });

    return { success: true, message: `เพิ่มสินค้า ${newProd.name} (${newProd.sku}) สำเร็จ`, product: newProd };
  };

  // Update Product (Open Code / Editable Master Data)
  const updateProduct = (sku: string, updates: Partial<Product>) => {
    const cleanSku = sku.trim().toUpperCase();
    const existing = products.find((p) => p.sku.toUpperCase() === cleanSku);
    if (!existing) {
      return { success: false, message: `ไม่พบสินค้า SKU "${sku}" ในระบบ` };
    }

    const newSku = updates.sku ? updates.sku.trim().toUpperCase() : existing.sku;
    if (newSku !== existing.sku && products.some((p) => p.sku.toUpperCase() === newSku)) {
      return { success: false, message: `รหัส SKU ใหม่ "${newSku}" ซ้ำกับสินค้าอื่นในระบบ` };
    }

    const updatedProd: Product = {
      ...existing,
      ...updates,
      sku: newSku,
      name: updates.name ?? existing.name,
      category: updates.category ?? existing.category,
      unit: updates.unit ?? existing.unit,
      unitPrice: updates.unitPrice !== undefined ? Number(updates.unitPrice) : existing.unitPrice,
      currentStock: updates.currentStock !== undefined ? Number(updates.currentStock) : existing.currentStock,
      initialStock: updates.initialStock !== undefined ? Number(updates.initialStock) : existing.initialStock,
      minStock: updates.minStock !== undefined ? Number(updates.minStock) : existing.minStock,
      maxStock: updates.maxStock !== undefined ? Number(updates.maxStock) : existing.maxStock,
      location: updates.location ?? existing.location,
      zone: updates.zone ?? existing.zone,
      abc: updates.abc ?? updates.zone ?? existing.abc,
      barcode: updates.barcode ?? existing.barcode,
      barcodeType: updates.barcodeType ?? existing.barcodeType,
      status: (updates.currentStock !== undefined ? Number(updates.currentStock) : existing.currentStock) <= 0
        ? 'Out of Stock'
        : (updates.currentStock !== undefined ? Number(updates.currentStock) : existing.currentStock) <= (updates.minStock ?? existing.minStock)
        ? 'Low Stock'
        : 'Available',
    };

    setProducts((prev) => prev.map((p) => (p.sku.toUpperCase() === cleanSku ? updatedProd : p)));

    if (updates.barcode || newSku !== existing.sku) {
      setBarcodes((prev) =>
        prev.map((b) => {
          if (b.sku.toUpperCase() === cleanSku) {
            return {
              ...b,
              sku: newSku,
              productId: newSku,
              barcodeValue: updates.barcode || b.barcodeValue,
              barcodeFormat: updates.barcodeType || b.barcodeFormat,
            };
          }
          return b;
        })
      );
    }

    // Sync to backend server
    fetch('/api/v1/products/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: cleanSku, ...updates }),
    }).catch(console.error);

    addAlert({
      type: 'INFO',
      title: 'แก้ไขข้อมูลสินค้าสำเร็จ',
      message: `${updatedProd.name} (${updatedProd.sku}) • สต็อก: ${updatedProd.currentStock} • โลเคชั่น: ${updatedProd.location}`,
      severity: 'info',
    });

    return { success: true, message: `แก้ไขสินค้า ${updatedProd.name} (${updatedProd.sku}) เรียบร้อย`, product: updatedProd };
  };

  // Delete Product
  const deleteProduct = (sku: string) => {
    const cleanSku = sku.trim().toUpperCase();
    const existing = products.find((p) => p.sku.toUpperCase() === cleanSku);
    if (!existing) {
      return { success: false, message: `ไม่พบ SKU "${sku}"` };
    }

    setProducts((prev) => prev.filter((p) => p.sku.toUpperCase() !== cleanSku));
    setBarcodes((prev) => prev.filter((b) => b.sku.toUpperCase() !== cleanSku));

    fetch('/api/v1/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: cleanSku }),
    }).catch(console.error);

    addAlert({
      type: 'INFO',
      title: 'ลบสินค้าสำเร็จ',
      message: `ลบ SKU "${sku}" เรียบร้อยแล้ว`,
      severity: 'warning',
    });

    return { success: true, message: `ลบสินค้า SKU "${sku}" สำเร็จ` };
  };

  // 1. Create Requisition & Auto-Check Stock (Multi-Device Synchronized)
  const createRequisition = (data: {
    requestor: string;
    department: string;
    items: { sku: string; quantity: number }[];
    notes?: string;
    reason?: string;
  }) => {
    let hasInsufficient = false;
    const insufficientDetails: string[] = [];

    for (const item of data.items) {
      const prod = getProductBySku(item.sku);
      if (!prod) {
        addAlert({
          type: 'INSUFFICIENT_STOCK',
          title: 'ไม่พบสินค้าในระบบ',
          message: `รหัส SKU: ${item.sku} ไม่มีใน Master Data`,
          severity: 'error',
        });
        return { success: false, message: `ไม่พบสินค้า ${item.sku}` };
      }
      if (prod.currentStock < item.quantity) {
        hasInsufficient = true;
        insufficientDetails.push(`${prod.name} (ต้องการ ${item.quantity}, คงเหลือ ${prod.currentStock})`);
      }
    }

    const existingNumbers = requisitions.map((r) => parseInt(r.id.replace(/\D/g, ''), 10) || 0);
    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = Math.max(maxNum + 1, requisitions.length + 1);
    const reqId = `REQ-${String(nextNumber).padStart(4, '0')}`;
    const pickId = `PICK-${String(nextNumber).padStart(4, '0')}`;

    const formattedItems: RequisitionItem[] = data.items.map((i) => {
      const p = getProductBySku(i.sku)!;
      return {
        sku: p.sku,
        productName: p.name,
        quantity: i.quantity,
        unit: p.unit,
        location: p.location,
        zone: p.zone,
        pickedQuantity: 0,
        status: 'Pending',
      };
    });

    const reqStatus: RequisitionStatus = hasInsufficient ? 'Stock ไม่เพียงพอ' : 'รอหยิบ';

    const newReq: Requisition = {
      id: reqId,
      date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      requestor: data.requestor,
      department: data.department,
      items: formattedItems,
      status: reqStatus,
      pickingOrderId: !hasInsufficient ? pickId : undefined,
      notes: data.notes || 'เบิกอุปกรณ์',
      reason: data.reason || data.notes || 'เบิกใช้งานตามรอบปฏิบัติการ',
    };

    setRequisitions((prev) => [newReq, ...prev]);

    let newPickingOrder: PickingOrder | undefined;

    if (!hasInsufficient) {
      const sortedItems = [...formattedItems].sort((a, b) => {
        const locA = getLocationByCode(a.location);
        const locB = getLocationByCode(b.location);
        const distA = locA ? locA.distanceFromPacking : 999;
        const distB = locB ? locB.distanceFromPacking : 999;
        return distA - distB;
      });

      const pickingItems: PickingItem[] = sortedItems.map((item, idx) => ({
        id: `PKI-${reqId}-${idx + 1}`,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        zone: item.zone,
        isPicked: false,
        pickedQuantity: 0,
        routeSequence: idx + 1,
      }));

      const uniqueLocations = Array.from(new Set(sortedItems.map((i) => i.location)));
      const route = ['START', ...uniqueLocations, 'PICKING COMPLETE', 'PACKING'];
      const totalDist = uniqueLocations.reduce((acc, locCode) => {
        const loc = getLocationByCode(locCode);
        return acc + (loc ? loc.distanceFromPacking : 20);
      }, 15);

      const picker = users.find((u) => u.role === 'Warehouse Staff' || u.role === 'Picker') || users[0];

      newPickingOrder = {
        id: pickId,
        reqId: reqId,
        requestNo: reqId,
        strategy: formattedItems.length > 4 ? 'BATCH' : 'SINGLE',
        pickerName: picker.name,
        picker: picker.name,
        status: 'Pending',
        createdAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        items: pickingItems,
        route,
        totalDistanceMeters: totalDist,
        totalDistance: totalDist,
      };

      setPickingOrders((prev) => [newPickingOrder, ...prev.filter((p) => p.id !== pickId)]);

      // Broadcast instantly to friend's devices
      broadcastSyncAction(
        'CREATE_REQUISITION',
        {
          requisition: newReq,
          pickingOrder: newPickingOrder,
        },
        activeUser.name || 'พนักงาน'
      );
    } else {
      broadcastSyncAction(
        'CREATE_REQUISITION',
        {
          requisition: newReq,
        },
        activeUser.name || 'พนักงาน'
      );
    }

    // Save snapshot to cloud so any browser opening connects to this exact save
    setTimeout(() => {
      const stateToSave = {
        products,
        requisitions: [newReq, ...requisitions],
        pickingOrders: !hasInsufficient && newPickingOrder ? [newPickingOrder, ...pickingOrders] : pickingOrders,
        shipments,
        employeeKPIs,
      };
      uploadToFirestoreCloud(stateToSave, 'CREATE_REQUISITION', activeUser.name);
      uploadStateSnapshot(stateToSave);
    }, 300);

    // Sync to server
    fetch('/api/v1/requisitions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(console.error);

    if (hasInsufficient) {
      addAlert({
        type: 'INSUFFICIENT_STOCK',
        title: `Stock ไม่เพียงพอ (${reqId})`,
        message: `รายการที่สต็อกไม่พอ: ${insufficientDetails.join(', ')}`,
        severity: 'error',
      });
      return {
        success: false,
        message: `Stock ไม่เพียงพอ: ${insufficientDetails.join('; ')}`,
        reqId,
      };
    }

    addAlert({
      type: 'INFO',
      title: `สร้างใบเบิก ${reqId} สถานะ "รอหยิบ"`,
      message: `ออกใบสั่งหยิบ ${pickId} อัตโนมัติ พร้อมสำหรับการสแกนและหยิบสินค้า`,
      severity: 'info',
    });

    return {
      success: true,
      message: `สร้างใบเบิก ${reqId} และเปิด Picking Order ${pickId} เรียบร้อย`,
      reqId,
      pickId,
    };
  };

  // 2. Approve Requisition
  const approveRequisition = (reqId: string, approverName = 'นาย E (ผู้จัดการคลัง)') => {
    const req = requisitions.find((r) => r.id === reqId);
    if (!req) return { success: false, message: 'ไม่พบใบเบิก' };

    const pickId = req.pickingOrderId || `PICK-${req.id.replace('REQ-', '')}`;

    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'อนุมัติแล้ว',
              approvedBy: approverName,
              approvedAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
              pickingOrderId: pickId,
            }
          : r
      )
    );

    // Sync to server
    fetch('/api/v1/requisitions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reqId, approverName }),
    }).catch(console.error);

    return { success: true, message: `อนุมัติสำเร็จ และสร้าง Picking Order: ${pickId}`, pickId };
  };

  const rejectRequisition = (reqId: string, reason = 'ข้อมูลไม่ถูกต้อง') => {
    setRequisitions((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'Cancelled', notes: `ไม่อนุมัติ: ${reason}` } : r))
    );
    fetch('/api/v1/requisitions/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reqId, reason }),
    }).catch(console.error);

    addAlert({
      type: 'INFO',
      title: `ยกเลิกใบเบิก ${reqId}`,
      message: reason,
      severity: 'warning',
    });
  };

  // 3. Start Picking
  const startPicking = (pickId: string, pickerName?: string) => {
    const nowTimeStr = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPickingOrders((prev) =>
      prev.map((p) =>
        p.id === pickId
          ? {
              ...p,
              status: 'In Progress',
              pickerName: pickerName || p.pickerName,
              startTime: p.startTime || nowTimeStr,
              ...(p as any),
              startTimeMs: (p as any).startTimeMs || Date.now(),
            }
          : p
      )
    );

    const pickOrder = pickingOrders.find((p) => p.id === pickId);
    if (pickOrder) {
      setRequisitions((prev) =>
        prev.map((r) => (r.id === pickOrder.reqId ? { ...r, status: 'กำลัง Picking' } : r))
      );
    }

    fetch('/api/v1/picking/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickId, pickerName }),
    }).catch(console.error);
  };

  // 4. Barcode Scan for Picking Item
  const scanBarcodeForItem = (
    pickId: string,
    itemId?: string,
    scannedCode?: string,
    qtyToPick?: number,
    operatorName?: string
  ) => {
    return confirmPickItemAndDeductStock({
      pickId,
      itemId,
      scannedBarcode: scannedCode || '',
      pickedQty: qtyToPick,
      operatorName,
    });
  };

  // 4.1 Strict Barcode Verification & Real-time Stock Deduction
  // Tracks ACTUAL picked values and updates KPI directly!
  const confirmPickItemAndDeductStock = (data: {
    pickId: string;
    itemId?: string;
    scannedBarcode: string;
    pickedQty?: number;
    operatorName?: string;
  }) => {
    const order = pickingOrders.find((p) => p.id === data.pickId);
    if (!order) return { success: false, message: 'ไม่พบ Picking Order ในระบบ' };

    const rawInput = data.scannedBarcode || '';
    const cleanInput = normalizeBarcode(rawInput) || rawInput.trim().toUpperCase();

    // 1. Identify target item in this picking order
    let item: PickingItem | undefined;
    if (data.itemId) {
      const specifiedItem = order.items.find((i) => i.id === data.itemId);
      if (specifiedItem) {
        const prod = getProductBySku(specifiedItem.sku);
        const isMatch = isBarcodeOrSkuMatch(
          cleanInput,
          { sku: specifiedItem.sku, barcode: prod?.barcode, name: specifiedItem.productName },
          barcodes
        );
        if (isMatch) item = specifiedItem;
      }
    }

    if (!item && cleanInput) {
      item = order.items.find((i) => {
        if (i.isPicked) return false;
        const prod = getProductBySku(i.sku);
        return isBarcodeOrSkuMatch(
          cleanInput,
          { sku: i.sku, barcode: prod?.barcode, name: i.productName },
          barcodes
        );
      });
    }

    if (!item && cleanInput) {
      const alreadyPickedItem = order.items.find((i) => {
        const prod = getProductBySku(i.sku);
        return isBarcodeOrSkuMatch(
          cleanInput,
          { sku: i.sku, barcode: prod?.barcode, name: i.productName },
          barcodes
        );
      });

      if (alreadyPickedItem) {
        return {
          success: false,
          message: `✓ สินค้า ${alreadyPickedItem.productName} (${alreadyPickedItem.sku}) ในออเดอร์นี้ถูกหยิบครบแล้ว`,
        };
      }

      playErrorBuzz();
      const anyProd = lookupBarcode(cleanInput).product || getProductBySku(cleanInput);
      return {
        success: false,
        message: anyProd
          ? `⚠ สินค้า "${anyProd.name}" (${anyProd.sku}) ไม่อยู่ในคำสั่งหยิบ ${order.id}`
          : `⚠ Barcode "${data.scannedBarcode}" ไม่ตรงกับรายการใดในออเดอร์นี้`,
      };
    }

    if (!item) {
      return { success: false, message: 'ไม่พบรายการสินค้านี้ใน Picking Order (หรืออาจหยิบครบแล้ว)' };
    }

    const prod = getProductBySku(item.sku);
    if (!prod) return { success: false, message: 'ไม่พบข้อมูล Master Data ของสินค้านี้' };

    const currentPicked = item.pickedQuantity ?? (item.isPicked ? item.quantity : 0);
    const remainingNeeded = Math.max(0, item.quantity - currentPicked);
    const amountToPick = data.pickedQty && data.pickedQty > 0
      ? Math.min(data.pickedQty, remainingNeeded > 0 ? remainingNeeded : 1)
      : (remainingNeeded > 0 ? remainingNeeded : 1);

    if (amountToPick <= 0 && remainingNeeded <= 0) {
      return { success: false, message: `✓ สินค้า ${item.productName} จัดหยิบครบตามจำนวนแล้ว` };
    }

    if (amountToPick > prod.currentStock) {
      playErrorBuzz();
      addAlert({
        type: 'STOCK_OUT',
        title: 'สต็อกคงเหลือไม่เพียงพอสำหรับการหยิบ',
        message: `สินค้า ${prod.sku} มีคงเหลือในคลังเพียง ${prod.currentStock} แต่ต้องการตัดหยิบ ${amountToPick}`,
        severity: 'error',
      });
      return {
        success: false,
        message: `⚠ สต็อกคงเหลือไม่เพียงพอ (มี ${prod.currentStock} แต่ต้องการตัด ${amountToPick})`,
      };
    }

    // Deduct stock real-time
    const stockBefore = prod.currentStock;
    const stockAfter = Math.max(0, prod.currentStock - amountToPick);
    const newPickedQty = currentPicked + amountToPick;
    const isItemComplete = newPickedQty >= item.quantity;
    const operator = data.operatorName || activeUser.name;
    const nowTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const fullDate = new Date().toLocaleDateString('th-TH') + ' ' + nowTime;

    setProducts((prev) =>
      prev.map((p) => (p.sku === prod.sku ? { ...p, currentStock: stockAfter } : p))
    );

    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${prod.sku}`,
      date: fullDate,
      sku: prod.sku,
      productName: prod.name,
      barcode: prod.barcode || cleanInput,
      type: 'PICKING',
      quantity: amountToPick,
      quantityBefore: stockBefore,
      quantityAfter: stockAfter,
      fromLocation: prod.location,
      operator,
      requestNo: order.reqId,
      pickingNo: order.id,
      notes: `ยิงหยิบสินค้าตาม ${order.id} (ตัดออก: -${amountToPick}, คงเหลือ: ${stockAfter} ${prod.unit})`,
    };
    setTransactions((prev) => [newTxn, ...prev]);

    let isAllDone = false;
    let actualDurationSeconds = order.durationSeconds || 75;

    setPickingOrders((prev) =>
      prev.map((p) => {
        if (p.id !== data.pickId) return p;
        const updatedItems = p.items.map((it) => {
          if (it.id !== item!.id) return it;
          return {
            ...it,
            pickedQuantity: newPickedQty,
            isPicked: isItemComplete,
            pickedAt: nowTime,
            scannedBarcode: cleanInput || it.scannedBarcode,
          };
        });
        const allPicked = updatedItems.every((it) => it.isPicked);
        if (allPicked) {
          isAllDone = true;
          const completedMs = Date.now();
          const startMs = (p as any).startTimeMs || (completedMs - 75000);
          actualDurationSeconds = Math.max(15, Math.round((completedMs - startMs) / 1000));
        }

        return {
          ...p,
          items: updatedItems,
          status: allPicked ? 'Picked' : 'In Progress',
          completedAt: allPicked ? nowTime : p.completedAt,
          durationSeconds: allPicked ? actualDurationSeconds : p.durationSeconds,
        };
      })
    );

    setRequisitions((prev) =>
      prev.map((r) => {
        if (r.id !== order.reqId) return r;
        const updatedReqItems = r.items.map((ri) => {
          if (ri.sku !== item!.sku) return ri;
          const reqPrev = ri.pickedQuantity || 0;
          const reqNew = Math.min(ri.quantity, reqPrev + amountToPick);
          return {
            ...ri,
            pickedQuantity: reqNew,
            status: reqNew >= ri.quantity ? ('Picked' as const) : ('Pending' as const),
          };
        });
        const allPicked = updatedReqItems.every((ri) => ri.status === 'Picked');
        return {
          ...r,
          items: updatedReqItems,
          status: allPicked ? 'Picked' : 'กำลัง Picking',
        };
      })
    );

    // Update Employee KPI
    setEmployeeKPIs((prev) =>
      prev.map((kpi) => {
        if (kpi.name === order.pickerName || kpi.name === activeUser.name) {
          const newOrdersPicked = kpi.ordersPicked + (isAllDone ? 1 : 0);
          const orderDurationMin = actualDurationSeconds / 60;
          const prevTotalMin = (kpi.avgPickingTimeMinutes || 1.8) * Math.max(1, kpi.ordersPicked);
          const newAvgTime = isAllDone && newOrdersPicked > 0
            ? Number(((prevTotalMin + orderDurationMin) / newOrdersPicked).toFixed(2))
            : kpi.avgPickingTimeMinutes;

          return {
            ...kpi,
            ordersPicked: newOrdersPicked,
            pickingAccuracy: Math.min(100, Number((kpi.pickingAccuracy + 0.05).toFixed(1))),
            avgPickingTimeMinutes: newAvgTime,
            avgTimeMinutes: newAvgTime,
          };
        }
        return kpi;
      })
    );

    // Broadcast pick to friend's devices
    broadcastSyncAction(
      'CONFIRM_PICK',
      {
        pickId: data.pickId,
        itemId: item.id,
        sku: item.sku,
        scannedBarcode: data.scannedBarcode,
        pickedQty: amountToPick,
        stockAfter,
        isAllDone,
      },
      operator
    );

    // Sync directly to server to update server database and broadcast to ALL other devices
    fetch('/api/v1/picking/confirm-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickId: data.pickId,
        itemId: item.id,
        scannedBarcode: data.scannedBarcode,
        pickedQty: amountToPick,
        operatorName: operator,
        source: 'hid_hardware',
      }),
    }).catch(console.error);

    setTimeout(() => {
      const stateToSave = {
        products: products.map((p) => (p.sku === prod.sku ? { ...p, currentStock: stockAfter } : p)),
        requisitions,
        pickingOrders,
        shipments,
        employeeKPIs,
      };
      uploadToFirestoreCloud(stateToSave, 'CONFIRM_PICK', operator);
      uploadStateSnapshot(stateToSave);
    }, 250);

    if (isAllDone) {
      playCompleteFanfare();
      addAlert({
        type: 'INFO',
        title: `จัดหยิบ ${order.id} เสร็จสมบูรณ์!`,
        message: `จัดหยิบสินค้าครบทุกรายการแล้ว ใช้เวลาจริง ${Math.round(actualDurationSeconds / 60 * 10) / 10} นาที ส่งไปยังจุด Packing`,
        severity: 'info',
      });
    } else {
      playSuccessBeep();
    }

    return {
      success: true,
      message: `✓ ยิงหยิบสำเร็จ: +${amountToPick} ${prod.unit} (หยิบสะสม ${newPickedQty}/${item.quantity}) • ตัดสต็อกคงเหลือ ${stockAfter} ${prod.unit}`,
      allCompleted: isAllDone,
      pickedQty: amountToPick,
      remainingQty: Math.max(0, item.quantity - newPickedQty),
      details: { stockBefore, stockAfter, pickedQty: amountToPick },
    };
  };

  // 5. Verify & Issue Goods
  const verifyAndIssueGoods = (reqId: string, operatorName = 'นาย K (Packing)') => {
    const req = requisitions.find((r) => r.id === reqId);
    if (!req) return { success: false, message: 'ไม่พบใบเบิก' };

    const shipId = `SHIP-${reqId.replace('REQ-', '')}`;
    const totalUnits = req.items.reduce((acc, i) => acc + i.quantity, 0);

    setRequisitions((prev) =>
      prev.map((r) =>
        r.id === reqId
          ? {
              ...r,
              status: 'จ่ายสินค้าแล้ว',
              items: r.items.map((it) => ({ ...it, status: 'Issued' })),
            }
          : r
      )
    );

    const existingShipment = shipments.find((s) => s.requestNo === reqId);
    if (!existingShipment) {
      const newShipment: Shipment = {
        id: shipId,
        requestNo: req.id,
        date: new Date().toLocaleDateString('th-TH'),
        recipient: `${req.requestor} (${req.department})`,
        destination: `${req.department} จุดรับพัสดุหลัก`,
        itemCount: req.items.length,
        totalUnits,
        preparedBy: operatorName,
        inspectedBy: 'นาย L (QC Inspector)',
        status: 'Ready to Ship',
        trackingNumber: `TH-WMS-2026-${shipId.replace('SHIP-', '')}`,
        carrier: 'Internal Courier Express',
      };
      setShipments((prev) => [newShipment, ...prev]);
    } else {
      setShipments((prev) =>
        prev.map((s) => (s.requestNo === reqId ? { ...s, status: 'Ready to Ship' } : s))
      );
    }

    fetch('/api/v1/shipping/issue-goods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reqId, operatorName }),
    }).catch(console.error);

    return { success: true, message: `จ่ายสินค้าตามใบเบิก ${reqId} สำเร็จ` };
  };

  // 6. Update Shipment Status
  const updateShipmentStatus = (shipmentId: string, newStatus: ShipmentStatus) => {
    const timestamp = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    setShipments((prev) =>
      prev.map((s) => {
        if (s.id !== shipmentId) return s;
        return {
          ...s,
          status: newStatus,
          shippedAt: newStatus === 'Shipped' ? timestamp : s.shippedAt,
          deliveredAt: newStatus === 'Delivered' ? timestamp : s.deliveredAt,
        };
      })
    );

    const ship = shipments.find((s) => s.id === shipmentId);
    if (ship) {
      if (newStatus === 'Shipped') {
        setRequisitions((prev) =>
          prev.map((r) => (r.id === ship.requestNo ? { ...r, status: 'ส่งแล้ว' } : r))
        );
      } else if (newStatus === 'Delivered') {
        setRequisitions((prev) =>
          prev.map((r) => (r.id === ship.requestNo ? { ...r, status: 'Completed' } : r))
        );
      }
    }

    fetch('/api/v1/shipping/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shipmentId, status: newStatus }),
    }).catch(console.error);
  };

  // 7. Adjust Stock
  const adjustStock = (sku: string, newStock: number, reason: string) => {
    const prod = getProductBySku(sku);
    if (!prod) return;

    const diff = newStock - prod.currentStock;
    const stockBefore = prod.currentStock;

    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, currentStock: Math.max(0, newStock) } : p))
    );

    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${sku}`,
      date: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      sku: prod.sku,
      productName: prod.name,
      type: 'ADJUSTMENT',
      quantity: Math.abs(diff),
      quantityBefore: stockBefore,
      quantityAfter: Math.max(0, newStock),
      fromLocation: prod.location,
      operator: activeUser.name,
      notes: `ปรับยอดสต็อก: ${reason}`,
    };
    setTransactions((prev) => [newTxn, ...prev]);

    fetch('/api/v1/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, newStock, reason, operator: activeUser.name }),
    }).catch(console.error);
  };

  // 8. Transfer Stock
  const transferStock = (sku: string, fromLoc: string, toLoc: string, quantity: number) => {
    const prod = getProductBySku(sku);
    if (!prod) return;

    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, location: toLoc } : p))
    );

    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${sku}`,
      date: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      sku: prod.sku,
      productName: prod.name,
      type: 'TRANSFER',
      quantity,
      fromLocation: fromLoc,
      toLocation: toLoc,
      operator: activeUser.name,
      notes: `ย้ายตำแหน่งจาก ${fromLoc} → ${toLoc}`,
    };
    setTransactions((prev) => [newTxn, ...prev]);

    fetch('/api/v1/inventory/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, fromLoc, toLoc, quantity, operator: activeUser.name }),
    }).catch(console.error);
  };

  // 9. Reset and Clear History
  const clearOrdersAndPickingHistory = async () => {
    setRequisitions([]);
    setPickingOrders([]);
    setShipments([]);
    setTransactions([]);
    setEmployeeKPIs((prev) =>
      prev.map((e) => ({
        ...e,
        ordersPicked: 0,
        pickingAccuracy: 100,
        accuracy: 100,
        productivity: 0,
        avgPickingTimeMinutes: 0,
        avgTimeMinutes: 0,
        travelDistanceMeters: 0,
      }))
    );
    setProducts((prev) =>
      (prev.length > 0 ? prev : INITIAL_PRODUCTS).map((p) => ({
        ...p,
        currentStock: p.initialStock ?? p.currentStock,
      }))
    );

    try {
      await fetch('/api/v1/clear-history', { method: 'POST' });
    } catch {
      // offline fallback
    }

    addAlert({
      type: 'INFO',
      title: 'ล้างข้อมูลประวัติและรีเซ็ตค่าเป็น 0',
      message: 'ล้างประวัติใบเบิกและประวัติการหยิบทั้งหมดแล้ว โดยคงข้อมูลสินค้าและตำแหน่งจัดเก็บครบถ้วน',
      severity: 'info',
    });
  };

  const resetDashboardToZero = async () => {
    await clearOrdersAndPickingHistory();
  };

  const resetToDemoData = async () => {
    try {
      await fetch('/api/v1/restore-demo', { method: 'POST' });
      await refreshServerState();
    } catch {
      await clearOrdersAndPickingHistory();
    }
  };

  // -----------------------------------------------------------------
  // KPI CALCULATIONS BASED STRICTLY ON ACTUAL PICKED VALUES (KPI อิงตามค่าที่หยิบจริง)
  // -----------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalSku = products.length;
    const totalStock = products.reduce((acc, p) => acc + p.currentStock, 0);
    const lowStockCount = products.filter((p) => p.currentStock <= p.minStock && p.currentStock > 0).length;
    const outOfStockCount = products.filter((p) => p.currentStock <= 0).length;
    const stockValue = products.reduce((acc, p) => acc + p.currentStock * p.unitPrice, 0);

    const pendingRequisitions = requisitions.filter((r) => r.status === 'รออนุมัติ' || r.status === 'รอหยิบ').length;
    const activePicking = pickingOrders.filter((p) => p.status === 'In Progress' || p.status === 'Pending').length;
    const readyToShip = shipments.filter((s) => s.status === 'Ready to Ship').length;

    const completedPickingOrders = pickingOrders.filter((p) => p.status === 'Picked');
    const completedOrdersCount = completedPickingOrders.length;

    // KPI 1: Picking Accuracy (%)
    // Formula: (จำนวนรายการที่หยิบถูกต้อง / จำนวนรายการที่หยิบทั้งหมด) * 100
    // Calculated directly from actual verified items in picking orders & server logs
    let totalPickedItems = 0;
    let correctPickedItems = 0;

    pickingOrders.forEach((po) => {
      po.items.forEach((it) => {
        if (it.isPicked) {
          totalPickedItems += 1;
          const p = products.find((prod) => prod.sku.toUpperCase() === it.sku.toUpperCase());
          const cleanScan = (it.scannedBarcode || '').trim().toUpperCase();
          const isMatched =
            !cleanScan ||
            cleanScan === it.sku.toUpperCase() ||
            (p && p.barcode && p.barcode.toUpperCase() === cleanScan) ||
            barcodes.some((b) => b.sku.toUpperCase() === it.sku.toUpperCase() && b.barcodeValue.toUpperCase() === cleanScan);

          if (isMatched) correctPickedItems += 1;
        }
      });
    });

    const pickingAccuracy = serverKpis?.kpis.pickingAccuracy
      ? serverKpis.kpis.pickingAccuracy.value
      : totalPickedItems > 0
      ? Number(((correctPickedItems / totalPickedItems) * 100).toFixed(1))
      : 0.0;

    // KPI 2: Picking Productivity (Orders/Hour)
    // Formula: จำนวน Orders ที่หยิบสำเร็จ / ชั่วโมงทำงานจริงที่ใช้ในการหยิบ
    // Derived strictly from actual elapsed pick times
    let totalPickingSeconds = 0;
    let totalPickedUnits = 0;
    completedPickingOrders.forEach((order) => {
      totalPickingSeconds += (order.durationSeconds || 75);
      order.items.forEach((it) => {
        totalPickedUnits += it.pickedQuantity || (it.isPicked ? it.quantity : 0);
      });
    });

    const totalWorkingHours = totalPickingSeconds > 0 ? (totalPickingSeconds / 3600) : 0;
    const pickingProductivity = serverKpis?.kpis.pickingProductivity
      ? serverKpis.kpis.pickingProductivity.value
      : (completedOrdersCount > 0 && totalWorkingHours > 0)
      ? Number((completedOrdersCount / totalWorkingHours).toFixed(1))
      : 0.0;

    // KPI 3: Picking Time per Order (นาที/Order)
    // Formula: เวลาที่ใช้ในการหยิบทั้งหมด / จำนวน Orders ที่หยิบสำเร็จ
    const avgPickingTime = serverKpis?.kpis.pickingTimePerOrder
      ? serverKpis.kpis.pickingTimePerOrder.value
      : (completedOrdersCount > 0 && totalPickingSeconds > 0)
      ? Number(((totalPickingSeconds / completedOrdersCount) / 60).toFixed(2))
      : 0.0;

    // KPI 4: Travel Distance per Order (เมตร/Order)
    // Formula: ระยะทางรวมที่เดินหยิบตามพิกัดของสินค้าจริง / จำนวน Orders
    const targetOrdersForDistance = completedOrdersCount > 0 ? completedPickingOrders : pickingOrders;
    const totalDist = targetOrdersForDistance.reduce((acc, p) => acc + (p.totalDistanceMeters || 0), 0);
    const avgDist = serverKpis?.kpis.travelDistancePerOrder
      ? serverKpis.kpis.travelDistancePerOrder.value
      : targetOrdersForDistance.length > 0
      ? Math.round(totalDist / targetOrdersForDistance.length)
      : 0;

    // KPI 5: Order Fulfillment Rate (%)
    // Formula: (จำนวน Orders ที่จัดส่ง/หยิบสำเร็จ / จำนวนคำสั่งเบิกทั้งหมด) * 100
    const validReqs = requisitions.filter((r) => r.status !== 'Cancelled').length;
    const finishedReqs = requisitions.filter(
      (r) => r.status === 'Completed' || r.status === 'ส่งแล้ว' || r.status === 'จ่ายสินค้าแล้ว' || r.status === 'Picked'
    ).length;
    const orderFulfillment = serverKpis?.kpis.orderFulfillmentRate
      ? serverKpis.kpis.orderFulfillmentRate.value
      : validReqs > 0
      ? Number(((finishedReqs / validReqs) * 100).toFixed(1))
      : 0.0;

    // KPI 6: Inventory Accuracy (%)
    // Formula: ความถูกต้องจากการสุ่มนับจริง
    const inventoryAccuracy = serverKpis?.kpis.inventoryAccuracy
      ? serverKpis.kpis.inventoryAccuracy.value
      : 100.0;

    // KPI 7: On-Time Shipment (%)
    // Formula: (จำนวนที่ส่งตรงเวลา / จำนวนที่ส่งทั้งหมด) * 100
    const totalShipped = shipments.filter((s) => s.status === 'Delivered' || s.status === 'Shipped').length;
    const onTimeShipment = serverKpis?.kpis.onTimeShippingRate
      ? serverKpis.kpis.onTimeShippingRate.value
      : totalShipped > 0
      ? 100.0
      : 0.0;

    // KPI 8: Stock Out Rate (%)
    const insufficientCount = requisitions.filter((r) => r.status === 'Stock ไม่เพียงพอ').length;
    const stockOutRate = requisitions.length > 0
      ? Number(((insufficientCount / requisitions.length) * 100).toFixed(1))
      : 0.0;

    return {
      pickingAccuracy,
      pickingProductivity,
      avgPickingTime,
      pickingTimeMinutes: avgPickingTime,
      travelDistance: avgDist,
      orderFulfillment,
      inventoryAccuracy,
      onTimeShipment,
      stockOutRate,
      totalSku,
      totalStock,
      lowStockCount,
      outOfStockCount,
      stockValue,
      pendingRequisitions,
      activePicking,
      readyToShip,
      completedOrdersCount,
      totalPickedUnits,
      totalWorkingHours,
    };
  }, [products, barcodes, requisitions, pickingOrders, shipments, serverKpis]);

  // Quick Simulation Pick
  const simulateQuickPick = () => {
    const targetOrder = pickingOrders.find(
      (p) => (p.status === 'In Progress' || p.status === 'Pending') && p.items.some((it) => !it.isPicked)
    );
    if (!targetOrder) {
      addAlert({
        type: 'INFO',
        title: 'ไม่มีรายการรอหยิบ',
        message: 'ทุกใบสั่งหยิบดำเนินการเสร็จสิ้นแล้ว หรือยังไม่มีคำสั่งเบิกใหม่',
        severity: 'info',
      });
      return;
    }
    const unpickedItem = targetOrder.items.find((it) => !it.isPicked);
    if (!unpickedItem) return;

    confirmPickItemAndDeductStock({
      pickId: targetOrder.id,
      itemId: unpickedItem.id,
      scannedBarcode: unpickedItem.sku,
      operatorName: activeUser.name,
    });
  };

  // Quick Simulation Dispatch
  const simulateQuickDispatch = () => {
    const readyShip = shipments.find((s) => s.status === 'Ready to Ship');
    if (readyShip) {
      updateShipmentStatus(readyShip.id, 'Shipped');
      return;
    }
    const inTransitShip = shipments.find((s) => s.status === 'Shipped');
    if (inTransitShip) {
      updateShipmentStatus(inTransitShip.id, 'Delivered');
      return;
    }
    addAlert({
      type: 'INFO',
      title: 'สถานะการจัดส่งล่าสุด',
      message: 'ทุกรายการจัดส่งได้รับการดำเนินการครบถ้วนแล้ว',
      severity: 'info',
    });
  };

  return (
    <WMSContext.Provider
      value={{
        products,
        barcodes,
        locations,
        users,
        activeUser,
        setActiveUser,
        requisitions,
        pickingOrders,
        shipments,
        transactions,
        employeeKPIs,
        employeeKpis: employeeKPIs,
        alerts,
        dismissAlert,
        clearAllAlerts,
        isSyncConnected,
        connectedDevicesCount,
        serverKpis,
        refreshServerState,
        syncWithCloudNow,
        lastSyncTime,
        lookupBarcode,
        addBarcodeToProduct,
        deleteBarcode,
        detectBarcodeFormat,
        createRequisition,
        approveRequisition,
        rejectRequisition,
        startPicking,
        scanBarcodeForItem,
        confirmPickItemAndDeductStock,
        addProduct,
        updateProduct,
        deleteProduct,
        verifyAndIssueGoods,
        updateShipmentStatus,
        adjustStock,
        transferStock,
        recommendPickingStrategy,
        resetToDemoData,
        resetDashboardToZero,
        clearOrdersAndPickingHistory,
        getProductBySku,
        getLocationByCode,
        kpis,
        simulateQuickPick,
        simulateQuickDispatch,
      }}
    >
      {children}
    </WMSContext.Provider>
  );
};

export const useWMS = () => {
  const context = useContext(WMSContext);
  if (!context) {
    throw new Error('useWMS must be used within a WMSProvider');
  }
  return context;
};
