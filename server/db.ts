import fs from 'fs';
import path from 'path';
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
  ProductBarcode,
  AlertNotification,
  ShipmentStatus,
  RequisitionStatus,
  ABCClass,
} from '../src/types/wms';
import {
  INITIAL_PRODUCTS,
  INITIAL_LOCATIONS,
  INITIAL_USERS,
  INITIAL_EMPLOYEE_KPIS,
  INITIAL_BARCODES,
} from '../src/data/masterData';
import { toValidEan13, isBarcodeOrSkuMatch } from '../src/utils/barcodeUtils';

const PERSISTENCE_FILE = path.join(process.cwd(), '.wms_state_store.json');

export interface ScanLog {
  id: string;
  timestamp: string;
  timeMs: number;
  scannedCode: string;
  expectedSku?: string;
  isMatch: boolean;
  orderId?: string;
  itemId?: string;
  operator: string;
  source: 'camera' | 'hid_hardware' | 'manual';
  productSku?: string;
  productName?: string;
}

export interface CycleCountAudit {
  id: string;
  auditDate: string;
  totalSampled: number;
  totalMatched: number;
  accuracyRate: number;
  auditor: string;
  notes: string;
}

export interface WorkShiftLog {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftDate: string;
  hoursWorked: number;
  ordersCompleted: number;
}

export interface DatabaseState {
  version: number;
  lastUpdatedMs: number;
  products: Product[];
  barcodes: ProductBarcode[];
  locations: WarehouseLocation[];
  users: User[];
  requisitions: Requisition[];
  pickingOrders: PickingOrder[];
  shipments: Shipment[];
  transactions: StockTransaction[];
  employeeKPIs: EmployeeKPI[];
  scanLogs: ScanLog[];
  cycleCountAudits: CycleCountAudit[];
  shiftLogs: WorkShiftLog[];
  alerts: AlertNotification[];
}

// Coordinate-based distance calculator for Locations (Zone A, B, C)
export function calculateLocationDistance(locA: WarehouseLocation, locB: WarehouseLocation): number {
  // Euclidean distance scaled to warehouse meters (width: 80m, depth: 40m)
  const dx = ((locA.posX - locB.posX) * 0.8);
  const dy = ((locA.posY - locB.posY) * 0.4);
  const straightDist = Math.sqrt(dx * dx + dy * dy);
  // Add aisle-traversal zigzag factor (~1.25x)
  return Math.max(3, Math.round(straightDist * 1.25));
}

// Distance from Packing Station (assumed at posX: 10, posY: 50)
export function calculateDistanceToPacking(loc: WarehouseLocation): number {
  const packingLoc: WarehouseLocation = {
    code: 'PACKING-DOCK',
    zone: 'A',
    zoneName: 'Packing Area',
    aisle: '00',
    rack: '00',
    shelf: '00',
    assignedSku: '',
    maxCapacity: 0,
    distanceFromPacking: 0,
    posX: 10,
    posY: 50,
  };
  return calculateLocationDistance(loc, packingLoc);
}

// In-Memory Database Instance with Production Seeding & Multi-Device State Management
class ProductionWMSDatabase {
  private state: DatabaseState;

  constructor() {
    const persisted = this.loadFromFile();
    if (persisted && Array.isArray(persisted.products) && persisted.products.length > 0) {
      this.state = persisted;
    } else {
      this.state = this.seedDatabase();
      this.saveToFile();
    }
  }

  private saveToFile(): void {
    try {
      fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(this.state), 'utf-8');
    } catch {}
  }

  private loadFromFile(): DatabaseState | null {
    try {
      if (fs.existsSync(PERSISTENCE_FILE)) {
        const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  private seedDatabase(): DatabaseState {
    const products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) as Product[];
    const locations = JSON.parse(JSON.stringify(INITIAL_LOCATIONS)) as WarehouseLocation[];
    const users = JSON.parse(JSON.stringify(INITIAL_USERS)) as User[];
    const employeeKPIs = JSON.parse(JSON.stringify(INITIAL_EMPLOYEE_KPIS)) as EmployeeKPI[];
    const barcodes = JSON.parse(JSON.stringify(INITIAL_BARCODES)) as ProductBarcode[];

    // Fresh operational datasets
    const requisitions: Requisition[] = [];
    const pickingOrders: PickingOrder[] = [];
    const shipments: Shipment[] = [];
    const scanLogs: ScanLog[] = [];
    const cycleCountAudits: CycleCountAudit[] = [];
    const shiftLogs: WorkShiftLog[] = [];
    const transactions: StockTransaction[] = [];
    const alerts: AlertNotification[] = [
      {
        id: 'ALT-INIT-1',
        type: 'INFO',
        title: 'ระบบ WMS เชื่อมต่อพร้อมทำงาน',
        message: 'ระบบฐานข้อมูลกลาง WMS พร้อมเชื่อมโยงข้อมูลทุกอุปกรณ์ Real-time',
        timestamp: new Date().toLocaleTimeString('th-TH'),
        severity: 'info',
        read: false,
      },
    ];

    return {
      version: 1,
      lastUpdatedMs: Date.now(),
      products,
      barcodes,
      locations,
      users,
      requisitions,
      pickingOrders,
      shipments,
      transactions,
      employeeKPIs,
      scanLogs,
      cycleCountAudits,
      shiftLogs,
      alerts,
    };
  }

  public getVersion(): number {
    return this.state.version;
  }

  private touch(): void {
    this.state.version += 1;
    this.state.lastUpdatedMs = Date.now();
    this.saveToFile();
  }

  public getState(): DatabaseState {
    return this.state;
  }

  /**
   * Merge a cloud snapshot into this database (idempotent).
   * Only ADDS requisitions / picking orders / shipments / stock that are missing,
   * so it is safe to run at startup and from any device push without clobbering live data.
   */
  public mergeCloudSnapshot(snapshot: any): {
    restored: boolean;
    counts: { requisitions?: number; pickingOrders?: number; shipments?: number; stock?: number };
  } {
    const counts = { requisitions: 0, pickingOrders: 0, shipments: 0, stock: 0 };
    if (!snapshot || typeof snapshot !== 'object') {
      return { restored: false, counts };
    }

    const snapReq = Array.isArray(snapshot.requisitions) ? snapshot.requisitions : [];
    const snapPick = Array.isArray(snapshot.pickingOrders) ? snapshot.pickingOrders : [];
    const snapShip = Array.isArray(snapshot.shipments) ? snapshot.shipments : [];
    const snapStock = Array.isArray(snapshot.products) ? snapshot.products : [];

    const reqIds = new Set(this.state.requisitions.map((r) => r.id));
    snapReq.forEach((r: any) => {
      if (r && r.id && !reqIds.has(r.id)) {
        this.state.requisitions.push({
          ...r,
          items: Array.isArray(r.items) ? r.items : [],
          requestor: r.requestor || 'เจ้าหน้าที่',
          department: r.department || 'ฝ่ายปฏิบัติการ',
          date: r.date || new Date().toISOString().split('T')[0],
          status: r.status || 'รอหยิบ',
        } as Requisition);
        counts.requisitions++;
      }
    });

    const pickIds = new Set(this.state.pickingOrders.map((p) => p.id));
    snapPick.forEach((p: any) => {
      if (p && p.id && !pickIds.has(p.id)) {
        this.state.pickingOrders.push({
          ...p,
          items: Array.isArray(p.items) ? p.items : [],
        } as PickingOrder);
        counts.pickingOrders++;
      }
    });

    const shipIds = new Set(this.state.shipments.map((s) => s.id));
    snapShip.forEach((s: any) => {
      if (s && s.id && !shipIds.has(s.id)) {
        this.state.shipments.push({ ...s } as Shipment);
        counts.shipments++;
      }
    });

    const cloudNewer = (snapshot.lastUpdatedMs || 0) > (this.state.lastUpdatedMs || 0);
    snapStock.forEach((sp: any) => {
      if (!sp || !sp.sku || typeof sp.currentStock !== 'number') return;
      const prod = this.state.products.find((p) => p.sku === sp.sku);
      if (!prod) return;
      const untouched = prod.currentStock === prod.initialStock;
      if (cloudNewer || untouched) {
        prod.currentStock = Math.max(0, sp.currentStock);
        counts.stock++;
      }
    });

    if (counts.requisitions || counts.pickingOrders || counts.shipments || counts.stock) {
      const cloudTs = snapshot.lastUpdatedMs || 0;
      if (cloudTs > this.state.lastUpdatedMs) {
        this.state.lastUpdatedMs = cloudTs;
      }
      this.state.lastUpdatedMs = Math.max(this.state.lastUpdatedMs, Date.now());
      this.state.version = (this.state.version || 0) + 1;
      this.saveToFile();
      return { restored: true, counts };
    }
    return { restored: false, counts };
  }

  public getProducts(): Product[] {
    return this.state.products;
  }

  public getBarcodes(): ProductBarcode[] {
    return this.state.barcodes;
  }

  public getLocations(): WarehouseLocation[] {
    return this.state.locations;
  }

  public getUsers(): User[] {
    return this.state.users;
  }

  public getProductBySkuOrBarcode(code: string): Product | undefined {
    if (!code) return undefined;
    const clean = code.trim().toUpperCase();
    const barcodeEntry = this.state.barcodes.find(
      (b) => b.barcodeValue.trim().toUpperCase() === clean
    );
    if (barcodeEntry) {
      const prod = this.state.products.find(
        (p) => p.sku.toUpperCase() === barcodeEntry.sku.toUpperCase()
      );
      if (prod) return prod;
    }
    const direct = this.state.products.find(
      (p) => p.sku.toUpperCase() === clean || (p.barcode && p.barcode.toUpperCase() === clean)
    );
    if (direct) return direct;

    // Robust variant matching so printed EAN-13 / UPC / normalized labels resolve correctly
    return this.state.products.find((p) =>
      isBarcodeOrSkuMatch(clean, { sku: p.sku, barcode: p.barcode, name: p.name }, this.state.barcodes)
    );
  }

  public getLocationByCode(code: string): WarehouseLocation | undefined {
    return this.state.locations.find((l) => l.code === code);
  }

  public getPickingOrders(): PickingOrder[] {
    return this.state.pickingOrders;
  }

  public getPickingOrderById(id: string): PickingOrder | undefined {
    return this.state.pickingOrders.find((p) => p.id === id);
  }

  public getRequisitions(): Requisition[] {
    return this.state.requisitions;
  }

  public getRequisitionById(id: string): Requisition | undefined {
    return this.state.requisitions.find((r) => r.id === id);
  }

  public getShipments(): Shipment[] {
    return this.state.shipments;
  }

  public getScanLogs(): ScanLog[] {
    return this.state.scanLogs;
  }

  public getCycleCountAudits(): CycleCountAudit[] {
    return this.state.cycleCountAudits;
  }

  public getShiftLogs(): WorkShiftLog[] {
    return this.state.shiftLogs;
  }

  public getAlerts(): AlertNotification[] {
    return this.state.alerts;
  }

  public addAlert(alert: Omit<AlertNotification, 'id' | 'timestamp' | 'read'>): AlertNotification {
    const newAlert: AlertNotification = {
      ...alert,
      id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    this.state.alerts.unshift(newAlert);
    if (this.state.alerts.length > 50) {
      this.state.alerts.pop();
    }
    this.touch();
    return newAlert;
  }

  public addScanLog(log: Omit<ScanLog, 'id' | 'timestamp' | 'timeMs'>): ScanLog {
    const newLog: ScanLog = {
      ...log,
      id: `SCAN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      timeMs: Date.now(),
    };
    this.state.scanLogs.unshift(newLog);
    if (this.state.scanLogs.length > 300) {
      this.state.scanLogs.pop();
    }
    this.touch();
    return newLog;
  }

  // 1. Create Requisition & Auto-Check Stock (Multi-Device Shared)
  public createRequisition(data: {
    requestor: string;
    department: string;
    items: { sku: string; quantity: number }[];
    notes?: string;
    reason?: string;
  }): {
    success: boolean;
    message: string;
    reqId?: string;
    pickId?: string;
    requisition?: Requisition;
    pickingOrder?: PickingOrder;
  } {
    let hasInsufficient = false;
    const insufficientDetails: string[] = [];

    for (const item of data.items) {
      let prod = this.state.products.find((p) => p.sku.toUpperCase() === item.sku.toUpperCase());
      if (!prod) {
        // Auto-register custom or template SKU
        prod = {
          no: this.state.products.length + 1,
          sku: item.sku.toUpperCase(),
          name: item.sku,
          category: 'อุปกรณ์และพัสดุทั่วไป',
          unit: 'ชิ้น',
          initialStock: 100,
          currentStock: 100,
          dailyOrder: 10,
          abc: 'B',
          location: 'B-01-01',
          zone: 'B',
          barcode: item.sku,
          barcodeType: 'Code 128',
          minStock: 20,
          maxStock: 200,
          unitPrice: 50,
          lotBatch: 'LOT-AUTO-01',
          receivedDate: new Date().toLocaleDateString('th-TH'),
          expiryDate: '31/12/2030',
          status: 'Available',
        };
        this.state.products.push(prod);
      }
      if (prod.currentStock < item.quantity) {
        hasInsufficient = true;
        insufficientDetails.push(`${prod.name} (ต้องการ ${item.quantity}, สต็อกมี ${prod.currentStock})`);
      }
    }

    const nextNum = this.state.requisitions.length + 1;
    const reqId = `REQ-${String(nextNum).padStart(4, '0')}`;
    const pickId = `PICK-${String(nextNum).padStart(4, '0')}`;

    const formattedItems: RequisitionItem[] = data.items.map((i) => {
      const p = this.state.products.find((prod) => prod.sku.toUpperCase() === i.sku.toUpperCase())!;
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
      notes: data.notes || 'เบิกอุปกรณ์และสินค้า',
      reason: data.reason || data.notes || 'เบิกใช้งานตามรอบปฏิบัติการ',
    };

    this.state.requisitions.unshift(newReq);

    let newPickingOrder: PickingOrder | undefined = undefined;

    if (!hasInsufficient) {
      // Sort items by proximity to packing
      const sortedItems = [...formattedItems].sort((a, b) => {
        const locA = this.getLocationByCode(a.location);
        const locB = this.getLocationByCode(b.location);
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
        const loc = this.getLocationByCode(locCode);
        return acc + (loc ? loc.distanceFromPacking : 20);
      }, 15);

      const picker = this.state.users.find((u) => u.role === 'Warehouse Staff' || u.role === 'Picker') || this.state.users[0];

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

      this.state.pickingOrders.unshift(newPickingOrder);
    }

    this.addAlert({
      type: hasInsufficient ? 'INSUFFICIENT_STOCK' : 'INFO',
      title: hasInsufficient ? `Stock ไม่พอ (${reqId})` : `สร้างใบเบิก ${reqId} รอหยิบ`,
      message: hasInsufficient
        ? `รายการสต็อกไม่พอ: ${insufficientDetails.join(', ')}`
        : `สร้างใบเบิก ${reqId} พร้อมออกใบสั่งหยิบ ${pickId} เรียบร้อย`,
      severity: hasInsufficient ? 'error' : 'info',
    });

    this.touch();

    return {
      success: true,
      message: hasInsufficient
        ? `บันทึกใบเบิกสถานะ "Stock ไม่เพียงพอ": ${insufficientDetails.join('; ')}`
        : `สร้างใบเบิก ${reqId} และเปิดใบสั่งหยิบ ${pickId} สำเร็จ`,
      reqId,
      pickId: newPickingOrder ? pickId : undefined,
      requisition: newReq,
      pickingOrder: newPickingOrder,
    };
  }

  // 2. Approve Requisition & Generate Picking Order
  public approveRequisition(reqId: string, approverName = 'นาย E (หัวหน้าคลัง)'): {
    success: boolean;
    message: string;
    pickId?: string;
    pickingOrder?: PickingOrder;
  } {
    const req = this.getRequisitionById(reqId);
    if (!req) return { success: false, message: 'ไม่พบใบเบิกในระบบ' };

    const pickId = `PICK-${req.id.replace('REQ-', '')}`;

    req.status = 'อนุมัติแล้ว';
    req.approvedBy = approverName;
    req.approvedAt = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    req.pickingOrderId = pickId;

    let pickingOrder = this.getPickingOrderById(pickId);
    if (!pickingOrder) {
      const sortedItems = [...req.items].sort((a, b) => {
        const locA = this.getLocationByCode(a.location);
        const locB = this.getLocationByCode(b.location);
        return (locA?.distanceFromPacking || 999) - (locB?.distanceFromPacking || 999);
      });

      const pickingItems: PickingItem[] = sortedItems.map((item, idx) => ({
        id: `PKI-${req.id}-${idx + 1}`,
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
        const loc = this.getLocationByCode(locCode);
        return acc + (loc ? loc.distanceFromPacking : 20);
      }, 15);

      const picker = this.state.users.find((u) => u.role === 'Warehouse Staff' || u.role === 'Picker') || this.state.users[0];

      pickingOrder = {
        id: pickId,
        reqId: req.id,
        requestNo: req.id,
        strategy: req.items.length > 4 ? 'BATCH' : 'SINGLE',
        pickerName: picker.name,
        picker: picker.name,
        status: 'Pending',
        createdAt: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        items: pickingItems,
        route,
        totalDistanceMeters: totalDist,
        totalDistance: totalDist,
      };

      this.state.pickingOrders.unshift(pickingOrder);
    }

    this.addAlert({
      type: 'INFO',
      title: `อนุมัติใบเบิก ${reqId}`,
      message: `อนุมัติโดย ${approverName} สร้างใบสั่งหยิบ ${pickId}`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `อนุมัติใบเบิก ${reqId} เรียบร้อย`, pickId, pickingOrder };
  }

  // 3. Reject Requisition
  public rejectRequisition(reqId: string, reason = 'เหตุผลภายใน'): boolean {
    const req = this.getRequisitionById(reqId);
    if (!req) return false;
    req.status = 'Cancelled';
    req.notes = `${req.notes || ''} (ปฏิเสธ: ${reason})`.trim();
    this.addAlert({
      type: 'INFO',
      title: `ปฏิเสธใบเบิก ${reqId}`,
      message: `เหตุผล: ${reason}`,
      severity: 'warning',
    });
    this.touch();
    return true;
  }

  // 4. Start Picking (records startTime & real timestamp)
  public startPicking(pickId: string, pickerName = 'นาย G (Picker)'): { success: boolean; message: string; order?: PickingOrder } {
    const order = this.getPickingOrderById(pickId);
    if (!order) return { success: false, message: 'ไม่พบใบสั่งหยิบ' };

    const now = new Date();
    order.status = 'In Progress';
    order.pickerName = pickerName;
    order.picker = pickerName;
    order.startTime = now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    (order as any).startTimeMs = Date.now();

    const req = this.getRequisitionById(order.reqId);
    if (req && req.status !== 'Picked') {
      req.status = 'กำลัง Picking';
    }

    this.addAlert({
      type: 'INFO',
      title: `เริ่มดำเนินการหยิบ ${pickId}`,
      message: `พนักงานหยิบ: ${pickerName} เริ่มเวลา ${order.startTime}`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `เริ่มหยิบ ${pickId} เรียบร้อย`, order };
  }

  // 5. Real-Time Barcode Verification & Actual Pick Deduction
  // Strictly records ACTUAL picked items, actual times, actual scan matches/mismatches
  public confirmPickItemAndDeductStock(params: {
    pickId: string;
    itemId?: string;
    scannedBarcode: string;
    pickedQty?: number;
    operatorName?: string;
    source?: 'camera' | 'hid_hardware' | 'manual';
  }): {
    success: boolean;
    isMatch: boolean;
    message: string;
    allCompleted?: boolean;
    pickedQty?: number;
    remainingQty?: number;
    details?: { stockBefore: number; stockAfter: number; pickedQty: number };
    updatedOrder?: PickingOrder;
    log?: ScanLog;
  } {
    const { pickId, itemId, scannedBarcode, pickedQty = 1, operatorName = 'Warehouse Operator', source = 'hid_hardware' } = params;
    const cleanCode = (scannedBarcode || '').trim().toUpperCase();

    const order = this.getPickingOrderById(pickId);
    if (!order) {
      return { success: false, isMatch: false, message: `ไม่พบใบสั่งหยิบ ${pickId}` };
    }

    // Locate target item in order
    let targetItem: PickingItem | undefined = undefined;
    if (itemId) {
      targetItem = order.items.find((it) => it.id === itemId);
    }
    if (!targetItem) {
      // Find matching item by SKU or barcode in order
      targetItem = order.items.find((it) => {
        if (it.isPicked) return false;
        const prod = this.state.products.find((p) => p.sku.toUpperCase() === it.sku.toUpperCase());
        return isBarcodeOrSkuMatch(
          cleanCode,
          { sku: it.sku, barcode: prod?.barcode, name: it.productName },
          this.state.barcodes
        );
      });
    }

    if (!targetItem) {
      // Barcode does not match any unpicked item in this order
      const anyProd = this.getProductBySkuOrBarcode(cleanCode);
      const log = this.addScanLog({
        scannedCode: cleanCode,
        isMatch: false,
        orderId: pickId,
        itemId,
        operator: operatorName,
        source,
        productSku: anyProd?.sku,
        productName: anyProd?.name,
      });

      return {
        success: false,
        isMatch: false,
        message: anyProd
          ? `✕ สินค้า ${anyProd.name} (${anyProd.sku}) ไม่อยู่ในใบสั่งหยิบ ${pickId}`
          : `✕ ไม่พบรหัสบาร์โค้ด "${cleanCode}" ในระบบ WMS`,
        log,
      };
    }

    const prod = this.state.products.find((p) => p.sku.toUpperCase() === targetItem!.sku.toUpperCase());
    if (!prod) {
      return { success: false, isMatch: false, message: `ไม่พบสินค้า SKU ${targetItem.sku} ใน Master Data` };
    }

    // Verify barcode matches expected item using GS1 EAN-13 aware matcher
    const isMatched = isBarcodeOrSkuMatch(
      cleanCode,
      { sku: targetItem.sku, barcode: prod.barcode, name: targetItem.productName },
      this.state.barcodes
    );

    if (!isMatched) {
      const log = this.addScanLog({
        scannedCode: cleanCode,
        expectedSku: targetItem.sku,
        isMatch: false,
        orderId: pickId,
        itemId: targetItem.id,
        operator: operatorName,
        source,
        productSku: prod.sku,
        productName: prod.name,
      });

      return {
        success: false,
        isMatch: false,
        message: `✕ บาร์โค้ด "${cleanCode}" ไม่ตรงกับรายการที่ต้องหยิบ (ต้องเป็น SKU: ${targetItem.sku})`,
        log,
      };
    }

    // Calculate pick amount and deduct stock
    const alreadyPicked = targetItem.pickedQuantity ?? (targetItem.isPicked ? targetItem.quantity : 0);
    const remainingNeeded = Math.max(0, targetItem.quantity - alreadyPicked);
    const amountToPick = Math.min(remainingNeeded, Math.max(1, pickedQty));
    const newPickedQty = alreadyPicked + amountToPick;
    const isItemComplete = newPickedQty >= targetItem.quantity;

    const stockBefore = prod.currentStock;
    const stockAfter = Math.max(0, stockBefore - amountToPick);
    prod.currentStock = stockAfter;

    // Update picking item
    const nowTimeStr = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH');
    targetItem.pickedQuantity = newPickedQty;
    targetItem.isPicked = isItemComplete;
    targetItem.pickedAt = nowTimeStr;
    targetItem.scannedBarcode = cleanCode;

    // Record StockTransaction for actual pick
    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${prod.sku}-${Math.random().toString(36).slice(2, 6)}`,
      date: nowTimeStr,
      sku: prod.sku,
      productName: prod.name,
      barcode: cleanCode,
      type: 'PICKING',
      quantity: amountToPick,
      quantityBefore: stockBefore,
      quantityAfter: stockAfter,
      fromLocation: prod.location,
      operator: operatorName,
      requestNo: order.reqId,
      pickingNo: order.id,
      notes: `ยิงหยิบจริงตาม ${order.id} (ตัดออก -${amountToPick}, คงเหลือ ${stockAfter} ${prod.unit})`,
    };
    this.state.transactions.unshift(newTxn);

    // Update Requisition item
    const req = this.getRequisitionById(order.reqId);
    if (req) {
      const rItem = req.items.find((ri) => ri.sku.toUpperCase() === targetItem!.sku.toUpperCase());
      if (rItem) {
        rItem.pickedQuantity = Math.min(rItem.quantity, (rItem.pickedQuantity || 0) + amountToPick);
        rItem.status = rItem.pickedQuantity >= rItem.quantity ? 'Picked' : 'Pending';
      }
    }

    // Check if entire picking order is now complete
    const allPicked = order.items.every((it) => it.isPicked);
    if (allPicked) {
      order.status = 'Picked';
      order.completedAt = nowTimeStr;
      const completedMs = Date.now();
      const startMs = (order as any).startTimeMs || (order as any).createdAtMs || (completedMs - 75000);
      const actualDuration = Math.max(15, Math.round((completedMs - startMs) / 1000));
      order.durationSeconds = actualDuration;

      if (req) {
        req.status = 'Picked';
      }

      this.addAlert({
        type: 'INFO',
        title: `จัดหยิบ ${order.id} เสร็จสมบูรณ์!`,
        message: `หยิบครบทุกรายการแล้ว ใช้เวลาจริง ${Math.round(actualDuration / 60 * 10) / 10} นาที ส่งต่อไปยังจุด Packing`,
        severity: 'info',
      });
    } else if (order.status === 'Pending') {
      order.status = 'In Progress';
      order.startTime = nowTimeStr;
      (order as any).startTimeMs = Date.now();
    }

    // Update Employee KPI for the picker with actual order count & accuracy
    const pickerKpi = this.state.employeeKPIs.find(
      (k) => k.name === order.pickerName || k.name === operatorName
    );
    if (pickerKpi) {
      if (allPicked) {
        pickerKpi.ordersPicked += 1;
        if (order.durationSeconds) {
          const prevTotalMin = (pickerKpi.avgPickingTimeMinutes || 1.8) * Math.max(1, pickerKpi.ordersPicked - 1);
          const currentOrderMin = order.durationSeconds / 60;
          pickerKpi.avgPickingTimeMinutes = Number(((prevTotalMin + currentOrderMin) / pickerKpi.ordersPicked).toFixed(2));
          pickerKpi.avgTimeMinutes = pickerKpi.avgPickingTimeMinutes;
        }
      }
      pickerKpi.pickingAccuracy = Math.min(100, Number((pickerKpi.pickingAccuracy + 0.05).toFixed(1)));
    }

    // Log scan
    const log = this.addScanLog({
      scannedCode: cleanCode,
      expectedSku: targetItem.sku,
      isMatch: true,
      orderId: pickId,
      itemId: targetItem.id,
      operator: operatorName,
      source,
      productSku: prod.sku,
      productName: prod.name,
    });

    this.touch();

    return {
      success: true,
      isMatch: true,
      message: `✓ ยิงหยิบสำเร็จ: +${amountToPick} ${prod.unit} (หยิบสะสม ${newPickedQty}/${targetItem.quantity}) • ตัดสต็อกคงเหลือ ${stockAfter} ${prod.unit}`,
      allCompleted: allPicked,
      pickedQty: amountToPick,
      remainingQty: Math.max(0, targetItem.quantity - newPickedQty),
      details: { stockBefore, stockAfter, pickedQty: amountToPick },
      updatedOrder: order,
      log,
    };
  }

  // 6. Verify & Issue Goods (Move from Packing to Ready to Ship)
  public verifyAndIssueGoods(reqId: string, operatorName = 'นาย K (Packing)'): {
    success: boolean;
    message: string;
    shipment?: Shipment;
  } {
    const req = this.getRequisitionById(reqId);
    if (!req) return { success: false, message: 'ไม่พบใบเบิกในระบบ' };

    req.status = 'จ่ายสินค้าแล้ว';
    req.items.forEach((it) => {
      it.status = 'Issued';
    });

    const shipId = `SHIP-${reqId.replace('REQ-', '')}`;
    const totalUnits = req.items.reduce((acc, i) => acc + i.quantity, 0);

    let shipment = this.state.shipments.find((s) => s.requestNo === reqId);
    if (!shipment) {
      shipment = {
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
      this.state.shipments.unshift(shipment);
    } else {
      shipment.status = 'Ready to Ship';
    }

    this.addAlert({
      type: 'INFO',
      title: `จ่ายสินค้าสำหรับ ${reqId} เรียบร้อย`,
      message: `บรรจุเสร็จสิ้น ${req.items.length} รายการ (${totalUnits} ชิ้น) สถานะเป็น Ready to Ship`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `จ่ายสินค้าตามใบเบิก ${reqId} สำเร็จ`, shipment };
  }

  // 7. Update Shipment Status (Ready to Ship -> Shipped -> Delivered)
  public updateShipmentStatus(shipmentId: string, newStatus: ShipmentStatus): {
    success: boolean;
    message: string;
    shipment?: Shipment;
  } {
    const shipment = this.state.shipments.find((s) => s.id === shipmentId);
    if (!shipment) return { success: false, message: 'ไม่พบพัสดุจัดส่ง' };

    const timestamp = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    shipment.status = newStatus;
    if (newStatus === 'Shipped') {
      shipment.shippedAt = timestamp;
      const req = this.getRequisitionById(shipment.requestNo);
      if (req) req.status = 'ส่งแล้ว';
    } else if (newStatus === 'Delivered') {
      shipment.deliveredAt = timestamp;
      const req = this.getRequisitionById(shipment.requestNo);
      if (req) req.status = 'Completed';
    }

    this.addAlert({
      type: 'INFO',
      title: `อัปเดตสถานะจัดส่ง ${shipmentId}`,
      message: `เปลี่ยนสถานะเป็น "${newStatus}" ปลายทาง: ${shipment.destination}`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `อัปเดตสถานะจัดส่ง ${shipmentId} เป็น ${newStatus} สำเร็จ`, shipment };
  }

  // 8. Adjust Stock
  public adjustStock(sku: string, newStock: number, reason: string, operator = 'Supervisor'): boolean {
    const prod = this.state.products.find((p) => p.sku.toUpperCase() === sku.toUpperCase());
    if (!prod) return false;

    const diff = newStock - prod.currentStock;
    const stockBefore = prod.currentStock;
    prod.currentStock = Math.max(0, newStock);

    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${sku}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      sku: prod.sku,
      productName: prod.name,
      type: 'ADJUSTMENT',
      quantity: Math.abs(diff),
      quantityBefore: stockBefore,
      quantityAfter: prod.currentStock,
      fromLocation: prod.location,
      operator,
      notes: `ปรับยอด (${diff > 0 ? '+' : ''}${diff}): ${reason}`,
    };
    this.state.transactions.unshift(newTxn);

    this.addAlert({
      type: 'INFO',
      title: `ปรับยอดสต็อก ${prod.sku}`,
      message: `จาก ${stockBefore} → ${newStock} (${reason})`,
      severity: 'info',
    });

    this.touch();
    return true;
  }

  // 9. Transfer Stock
  public transferStock(sku: string, fromLoc: string, toLoc: string, quantity: number, operator = 'Supervisor'): boolean {
    const prod = this.state.products.find((p) => p.sku.toUpperCase() === sku.toUpperCase());
    if (!prod) return false;

    prod.location = toLoc;

    const newTxn: StockTransaction = {
      id: `TXN-${Date.now()}-${sku}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH'),
      sku: prod.sku,
      productName: prod.name,
      type: 'TRANSFER',
      quantity,
      fromLocation: fromLoc,
      toLocation: toLoc,
      operator,
      notes: `ย้ายตำแหน่งจัดเก็บจาก ${fromLoc} ไปยัง ${toLoc}`,
    };
    this.state.transactions.unshift(newTxn);

    this.addAlert({
      type: 'INFO',
      title: `ย้ายตำแหน่งสินค้า ${prod.sku}`,
      message: `จาก ${fromLoc} → ${toLoc} จำนวน ${quantity} ${prod.unit}`,
      severity: 'info',
    });

    this.touch();
    return true;
  }

  // 10. Add Product
  public addProduct(productData: Partial<Product> & { name: string }): {
    success: boolean;
    message: string;
    product?: Product;
  } {
    let barcode = (productData.barcode || '').trim();
    if (!barcode) {
      barcode = `8850${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    let sku = (productData.sku || '').trim().toUpperCase();
    if (!sku) {
      const prefix = productData.category ? productData.category.slice(0, 3).toUpperCase() : 'SKU';
      sku = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
    }

    if (this.state.products.some((p) => p.sku.toUpperCase() === sku)) {
      return { success: false, message: `รหัส SKU "${sku}" มีอยู่ในระบบแล้ว` };
    }

    const zone: ABCClass = productData.zone || 'A';
    const location = productData.location || `${zone}-01-01`;
    const initialStock = productData.initialStock ?? 100;
    const currentStock = productData.currentStock ?? initialStock;

    const newProd: Product = {
      no: this.state.products.length + 1,
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

    this.state.products.unshift(newProd);

    const newBc: ProductBarcode = {
      id: `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: newProd.sku,
      sku: newProd.sku,
      barcodeValue: newProd.barcode,
      barcodeFormat: newProd.barcodeType || 'Code 128',
      isPrimary: true,
      createdAt: new Date().toLocaleDateString('th-TH'),
    };
    this.state.barcodes.unshift(newBc);

    this.addAlert({
      type: 'INFO',
      title: 'เพิ่มสินค้าใหม่และผูก Barcode สำเร็จ',
      message: `${newProd.name} (${newProd.sku}) • Barcode: ${newProd.barcode} • โลเคชั่น: ${newProd.location}`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `เพิ่มสินค้า ${newProd.name} (${newProd.sku}) สำเร็จ`, product: newProd };
  }

  // 10.1 Update Existing Product (Open Code / Editable Master Data)
  public updateProduct(sku: string, updates: Partial<Product>): {
    success: boolean;
    message: string;
    product?: Product;
  } {
    const cleanSku = sku.trim().toUpperCase();
    const prodIndex = this.state.products.findIndex((p) => p.sku.toUpperCase() === cleanSku);
    if (prodIndex === -1) {
      return { success: false, message: `ไม่พบสินค้า SKU "${sku}" ในระบบ` };
    }

    const currentProd = this.state.products[prodIndex];
    const newSku = updates.sku ? updates.sku.trim().toUpperCase() : currentProd.sku;

    // Check if new SKU conflicts with existing (if changed)
    if (newSku !== currentProd.sku && this.state.products.some((p) => p.sku.toUpperCase() === newSku)) {
      return { success: false, message: `รหัส SKU ใหม่ "${newSku}" ซ้ำกับสินค้าอื่นในระบบ` };
    }

    const updatedProd: Product = {
      ...currentProd,
      ...updates,
      sku: newSku,
      name: updates.name ?? currentProd.name,
      category: updates.category ?? currentProd.category,
      unit: updates.unit ?? currentProd.unit,
      unitPrice: updates.unitPrice !== undefined ? Number(updates.unitPrice) : currentProd.unitPrice,
      currentStock: updates.currentStock !== undefined ? Number(updates.currentStock) : currentProd.currentStock,
      initialStock: updates.initialStock !== undefined ? Number(updates.initialStock) : currentProd.initialStock,
      minStock: updates.minStock !== undefined ? Number(updates.minStock) : currentProd.minStock,
      maxStock: updates.maxStock !== undefined ? Number(updates.maxStock) : currentProd.maxStock,
      location: updates.location ?? currentProd.location,
      zone: updates.zone ?? currentProd.zone,
      abc: updates.abc ?? updates.zone ?? currentProd.abc,
      barcode: updates.barcode ?? currentProd.barcode,
      barcodeType: updates.barcodeType ?? currentProd.barcodeType,
      status: (updates.currentStock !== undefined ? Number(updates.currentStock) : currentProd.currentStock) <= 0
        ? 'Out of Stock'
        : (updates.currentStock !== undefined ? Number(updates.currentStock) : currentProd.currentStock) <= (updates.minStock ?? currentProd.minStock)
        ? 'Low Stock'
        : 'Available',
    };

    this.state.products[prodIndex] = updatedProd;

    // Also update primary barcode mapping if SKU or barcode changed
    const bcIndex = this.state.barcodes.findIndex((b) => b.sku.toUpperCase() === currentProd.sku);
    if (bcIndex !== -1) {
      this.state.barcodes[bcIndex].sku = newSku;
      this.state.barcodes[bcIndex].productId = newSku;
      if (updates.barcode) {
        this.state.barcodes[bcIndex].barcodeValue = updates.barcode;
      }
      if (updates.barcodeType) {
        this.state.barcodes[bcIndex].barcodeFormat = updates.barcodeType;
      }
    }

    this.addAlert({
      type: 'INFO',
      title: 'แก้ไขข้อมูลสินค้าสำเร็จ',
      message: `${updatedProd.name} (${updatedProd.sku}) • สต็อก: ${updatedProd.currentStock} • โลเคชั่น: ${updatedProd.location}`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: `แก้ไขสินค้า ${updatedProd.name} (${updatedProd.sku}) เรียบร้อย`, product: updatedProd };
  }

  // 10.2 Delete Product
  public deleteProduct(sku: string): { success: boolean; message: string } {
    const cleanSku = sku.trim().toUpperCase();
    const prevLen = this.state.products.length;
    this.state.products = this.state.products.filter((p) => p.sku.toUpperCase() !== cleanSku);
    this.state.barcodes = this.state.barcodes.filter((b) => b.sku.toUpperCase() !== cleanSku);

    if (this.state.products.length !== prevLen) {
      this.addAlert({
        type: 'INFO',
        title: 'ลบสินค้าออกจากระบบ',
        message: `ลบ SKU "${sku}" เรียบร้อยแล้ว`,
        severity: 'warning',
      });
      this.touch();
      return { success: true, message: `ลบสินค้า SKU "${sku}" สำเร็จ` };
    }
    return { success: false, message: `ไม่พบ SKU "${sku}"` };
  }

  // 11. Add Barcode To Product
  public addBarcodeToProduct(sku: string, barcodeValue: string, barcodeFormat?: string): {
    success: boolean;
    message: string;
    barcode?: ProductBarcode;
  } {
    const cleanSku = sku.trim().toUpperCase();
    const cleanVal = barcodeValue.trim();
    if (!cleanVal) return { success: false, message: 'กรุณากรอกรหัส Barcode' };

    const prod = this.state.products.find((p) => p.sku.toUpperCase() === cleanSku);
    if (!prod) return { success: false, message: `ไม่พบสินค้า SKU "${sku}" ในระบบ` };

    const existing = this.state.barcodes.find((b) => b.barcodeValue.toUpperCase() === cleanVal.toUpperCase());
    if (existing) {
      return { success: false, message: `Barcode "${cleanVal}" ถูกผูกไว้กับ SKU "${existing.sku}" แล้ว` };
    }

    const newBc: ProductBarcode = {
      id: `BC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.sku,
      sku: prod.sku,
      barcodeValue: cleanVal,
      barcodeFormat: barcodeFormat || 'Code 128',
      isPrimary: false,
      createdAt: new Date().toLocaleDateString('th-TH'),
    };

    this.state.barcodes.unshift(newBc);

    this.addAlert({
      type: 'INFO',
      title: 'เพิ่ม Barcode สำเร็จ',
      message: `ผูก Barcode "${cleanVal}" เข้ากับสินค้า ${prod.name} (${prod.sku}) เรียบร้อย`,
      severity: 'info',
    });

    this.touch();
    return { success: true, message: 'เพิ่ม Barcode เรียบร้อย', barcode: newBc };
  }

  // 12. Delete Barcode
  public deleteBarcode(barcodeId: string): boolean {
    const prevLen = this.state.barcodes.length;
    this.state.barcodes = this.state.barcodes.filter((b) => b.id !== barcodeId);
    if (this.state.barcodes.length !== prevLen) {
      this.touch();
      return true;
    }
    return false;
  }

  // 13. Cycle Count Audit
  public recordCycleCountAudit(audit: Omit<CycleCountAudit, 'id' | 'auditDate' | 'accuracyRate'>): CycleCountAudit {
    const accuracyRate = audit.totalSampled > 0
      ? Number(((audit.totalMatched / audit.totalSampled) * 100).toFixed(2))
      : 100;
    const newAudit: CycleCountAudit = {
      ...audit,
      id: `AUD-${Date.now()}`,
      auditDate: new Date().toLocaleDateString('th-TH'),
      accuracyRate,
    };
    this.state.cycleCountAudits.unshift(newAudit);
    this.touch();
    return newAudit;
  }

  // 14. Clear Operational History, Preserve Products & Barcodes
  public clearTransactionsAndResetToZero(): void {
    this.state.scanLogs = [];
    this.state.pickingOrders = [];
    this.state.requisitions = [];
    this.state.shipments = [];
    this.state.cycleCountAudits = [];
    this.state.shiftLogs = [];
    this.state.transactions = [];
    this.state.alerts = [
      {
        id: `ALT-${Date.now()}`,
        type: 'INFO',
        title: 'ล้างข้อมูลประวัติการทำรายการเรียบร้อย',
        message: 'รีเซ็ตข้อมูลใบเบิก การหยิบ และจัดส่งเป็น 0 โดยคงข้อมูลสินค้าและตำแหน่งจัดเก็บ Master Data ครบถ้วน',
        timestamp: new Date().toLocaleTimeString('th-TH'),
        severity: 'info',
        read: false,
      },
    ];

    // Reset stock to initial stock
    this.state.products = this.state.products.map((p) => ({
      ...p,
      currentStock: p.initialStock ?? p.currentStock,
    }));

    // Reset Employee KPIs
    this.state.employeeKPIs = this.state.employeeKPIs.map((e) => ({
      ...e,
      ordersPicked: 0,
      pickingAccuracy: 100,
      accuracy: 100,
      productivity: 0,
      avgPickingTimeMinutes: 0,
      avgTimeMinutes: 0,
      travelDistanceMeters: 0,
    }));

    this.touch();
  }

  public clearOrdersAndHistoryPreserveProducts(): void {
    this.clearTransactionsAndResetToZero();
  }

  public resetToDemo(): void {
    this.state = this.seedDatabase();
    this.touch();
  }

  // Barcode Verification Helper
  public verifyAndRecordScan(params: {
    scannedCode: string;
    expectedSku?: string;
    orderId?: string;
    itemId?: string;
    operator?: string;
    source: 'camera' | 'hid_hardware' | 'manual';
  }) {
    if (params.orderId) {
      return this.confirmPickItemAndDeductStock({
        pickId: params.orderId,
        itemId: params.itemId,
        scannedBarcode: params.scannedCode,
        operatorName: params.operator,
        source: params.source,
      });
    }

    const cleanCode = (params.scannedCode || '').trim().toUpperCase();
    const product = this.getProductBySkuOrBarcode(cleanCode);
    const isMatch = !!product;
    const message = isMatch
      ? `✓ ตรวจพบสินค้าในระบบ: ${product.name} (SKU: ${product.sku}) • โลเคชั่น: ${product.location} • คงเหลือ: ${product.currentStock} ${product.unit}`
      : `✕ ไม่พบรหัสสินค้า "${cleanCode}" ในระบบ WMS`;

    const log = this.addScanLog({
      scannedCode: cleanCode,
      expectedSku: params.expectedSku,
      isMatch,
      orderId: params.orderId,
      itemId: params.itemId,
      operator: params.operator || 'Warehouse Operator',
      source: params.source,
      productSku: product?.sku,
      productName: product?.name,
    });

    return {
      success: isMatch,
      isMatch,
      message,
      product,
      log,
    };
  }
}

export const db = new ProductionWMSDatabase();
