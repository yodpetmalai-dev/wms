export type ABCClass = 'A' | 'B' | 'C';

export type BarcodeFormat =
  | 'Code 128'
  | 'Code 39'
  | 'EAN-13'
  | 'EAN-8'
  | 'UPC'
  | 'UPC-A'
  | 'UPC-E'
  | 'QR Code'
  | 'Data Matrix'
  | 'ITF'
  | 'Internal'
  | string;

export interface ProductBarcode {
  id: string;
  productId: string; // references Product.id or Product.sku
  sku: string;
  barcodeValue: string;
  barcodeFormat: string; // 'Code 128' | 'Code 39' | 'EAN-13' | 'EAN-8' | 'UPC-A' | 'UPC-E' | 'QR Code' | 'Internal'
  isPrimary?: boolean;
  createdAt?: string;
}

export interface ScanResult {
  barcodeValue: string;
  barcodeFormat: string;
  sku: string | null;
  productName: string | null;
  location?: string | null;
  stockQty?: number | null;
  unit?: string | null;
  product?: Product | null;
}

export type ProductStatus = 'Available' | 'Low Stock' | 'Out of Stock' | 'Reserved' | 'Expired';

export interface Product {
  no: number;
  sku: string;
  name: string;
  category?: string;
  unit: string;
  initialStock: number;
  currentStock: number;
  dailyOrder: number;
  abc: ABCClass;
  location: string;
  zone: ABCClass;
  barcode: string;
  barcodeType?: BarcodeFormat;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  lotBatch?: string;
  receivedDate?: string;
  expiryDate?: string;
  status?: ProductStatus;
  imageUrl?: string;
}

export interface WarehouseLocation {
  code: string;
  zone: ABCClass;
  zoneName: string;
  aisle: string;
  rack: string;
  shelf: string;
  assignedSku: string;
  maxCapacity: number;
  distanceFromPacking: number; // in meters for routing optimization
  posX: number; // for 2D map visualization (0-100%)
  posY: number;
}

export type UserRole =
  | 'Admin'
  | 'Warehouse Manager'
  | 'Warehouse Staff'
  | 'Requester'
  | 'ผู้เบิกสินค้า'
  | 'Warehouse Operator'
  | 'Picker'
  | 'Packing'
  | 'Warehouse Supervisor';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
  avatarColor: string;
}

export type RequisitionStatus =
  | 'รออนุมัติ'
  | 'อนุมัติแล้ว'
  | 'รอหยิบ'
  | 'Stock ไม่เพียงพอ'
  | 'กำลัง Picking'
  | 'Picked'
  | 'จ่ายสินค้าแล้ว'
  | 'ส่งแล้ว'
  | 'Completed'
  | 'Cancelled';

export interface RequisitionItem {
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  location: string;
  zone: ABCClass;
  pickedQuantity: number;
  status: 'Pending' | 'Picked' | 'Issued';
}

export interface Requisition {
  id: string; // REQ-xxxx
  date: string;
  requestor: string;
  department: string;
  items: RequisitionItem[];
  status: RequisitionStatus;
  approvedBy?: string;
  approvedAt?: string;
  pickingOrderId?: string;
  shipmentId?: string;
  notes?: string;
  reason?: string; // เหตุผลในการเบิก (Requirement 4)
}

export type PickingStrategy = 'SINGLE' | 'BATCH';

export interface PickingItem {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  unit: string;
  location: string;
  zone: ABCClass;
  isPicked: boolean;
  pickedQuantity?: number;
  pickedAt?: string;
  scannedBarcode?: string;
  routeSequence: number;
}

export interface PickingOrder {
  id: string; // PICK-xxxx
  reqId: string;
  requestNo?: string; // alias for reqId
  batchReqIds?: string[];
  strategy: PickingStrategy;
  pickerName: string;
  picker?: string; // alias for pickerName
  status: 'Pending' | 'In Progress' | 'Picked' | 'Cancelled';
  createdAt: string;
  startTime?: string;
  startTimeMs?: number;
  completedAt?: string;
  completedAtMs?: number;
  items: PickingItem[];
  route: string[]; // sequence of locations: START -> A-01-01 -> A-01-03 -> COMPLETE -> PACKING
  totalDistanceMeters: number;
  totalDistance?: number; // alias
  durationSeconds?: number;
}

export type TransactionType =
  | 'IN'
  | 'OUT'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'PICKING'
  | 'REQUISITION_ISSUE'
  | 'PUT_AWAY'
  | 'CYCLE_COUNT';

export interface StockTransaction {
  id: string; // TXN-xxxx
  date: string;
  sku: string;
  productName: string;
  barcode?: string;
  type: TransactionType;
  quantity: number;
  quantityBefore?: number;
  quantityAfter?: number;
  fromLocation: string;
  toLocation?: string;
  operator: string;
  requestNo?: string;
  pickingNo?: string;
  notes?: string;
}

export type ShipmentStatus =
  | 'Waiting'
  | 'Picking'
  | 'Packing'
  | 'Ready to Ship'
  | 'Shipped'
  | 'Delivered';

export interface Shipment {
  id: string; // SHIP-xxxx
  requestNo: string;
  date: string;
  recipient: string;
  destination: string;
  itemCount: number;
  totalUnits: number;
  preparedBy: string;
  inspectedBy: string;
  status: ShipmentStatus;
  trackingNumber: string;
  carrier: string;
  shippedAt?: string;
  deliveredAt?: string;
}

export interface AlertNotification {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'BARCODE_MISMATCH' | 'INSUFFICIENT_STOCK' | 'LONG_PICKING' | 'SHIPMENT_DELAY' | 'INFO';
  title: string;
  message: string;
  sku?: string;
  location?: string;
  timestamp: string;
  severity: 'warning' | 'error' | 'info';
  read: boolean;
}

export interface EmployeeKPI {
  employeeId?: string;
  name: string;
  employeeName?: string;
  role: UserRole;
  ordersPicked: number;
  pickingAccuracy: number; // percentage
  accuracy?: number;
  productivity?: number;
  avgPickingTimeMinutes: number; // minutes
  avgTimeMinutes?: number;
  travelDistanceMeters: number; // meters/order
}

export interface ScanLogItem {
  id: string;
  timestamp: string;
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

export interface ProductionCoreKPI {
  id: string;
  title: string;
  thTitle: string;
  formula: string;
  value: number;
  formattedValue: string;
  unit: string;
  target: number;
  targetLabel: string;
  isPassed: boolean;
  status?: 'PASS' | 'FAIL' | 'PENDING' | 'WAITING_DATA';
  trend: string;
  [key: string]: unknown;
}

export interface ProductionKPIData {
  timestamp: string;
  calculatedAtMs: number;
  kpis: {
    pickingAccuracy: ProductionCoreKPI & { totalCorrectScans: number; totalScans: number };
    pickingProductivity: ProductionCoreKPI & { completedOrdersCount: number; totalWorkingHours: number; actualPickedUnits?: number; itemsPerHour?: number };
    pickingTimePerOrder: ProductionCoreKPI & { totalPickingDurationMinutes: number; completedOrdersCount: number };
    travelDistancePerOrder: ProductionCoreKPI & { totalTravelDistanceMeters: number; totalOrdersEvaluated: number };
    orderFulfillmentRate: ProductionCoreKPI & { fulfilledOrdersCount: number; totalOrdersCount: number };
    inventoryAccuracy: ProductionCoreKPI & { matchedSkuCount: number; totalSampledSkuCount: number };
    onTimeShippingRate: ProductionCoreKPI & { onTimeOrdersCount: number; totalShippedOrdersCount: number };
  };
  summary: {
    totalSku: number;
    totalStockUnits: number;
    totalStockValue: number;
    pendingRequisitions: number;
    activePickingOrders: number;
    readyToShipCount: number;
    lowStockAlerts: number;
    outOfStockAlerts: number;
  };
}
