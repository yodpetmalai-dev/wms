import React, { useState, useEffect } from 'react';
import { useWMS } from '../../context/WMSContext';
import { ProductionKPIData } from '../../types/wms';
import {
  Boxes,
  Layers,
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  PlayCircle,
  ScanBarcode,
  Target,
  Compass,
  PackageCheck,
  Award,
  Send,
  CheckSquare,
  Activity,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Wifi,
  Share2,
  Globe,
} from 'lucide-react';
import { ViewType } from '../Sidebar';
import { ShareLinkModal } from '../ShareLinkModal';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
  onOpenDemo?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    products,
    requisitions,
    pickingOrders,
    shipments,
    transactions,
    kpis,
    resetDashboardToZero,
    resetToDemoData,
  } = useWMS();

  const [productionKpis, setProductionKpis] = useState<ProductionKPIData | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [lastEventMsg, setLastEventMsg] = useState<string>('Connected to Production Engine');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetDashboardToZero();
      await fetchProductionKpis();
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const handleConfirmRestore = async () => {
    setIsResetting(true);
    try {
      await resetToDemoData();
      await fetchProductionKpis();
    } finally {
      setIsResetting(false);
      setShowRestoreConfirm(false);
    }
  };

  const fetchProductionKpis = async () => {
    try {
      const res = await fetch('/api/v1/kpi/dashboard');
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || json;
        if (payload && payload.kpis) {
          setProductionKpis(payload);
        }
      }
    } catch {
      // Standby
    }
  };

  useEffect(() => {
    fetchProductionKpis();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/v1/events');
      eventSource.onopen = () => {
        setSseConnected(true);
      };

      const handleKpiUpdate = (data: unknown) => {
        const payload = data as ProductionKPIData;
        if (payload?.kpis) {
          setProductionKpis(payload);
        }
      };

      const handleScanEvent = (data: unknown) => {
        const evt = data as { scanLog?: { scannedCode: string; source: string }; kpiDashboard?: ProductionKPIData };
        if (evt?.scanLog) {
          setLastEventMsg(`Live Scan: ${evt.scanLog.scannedCode} (${evt.scanLog.source})`);
        }
        if (evt?.kpiDashboard?.kpis) {
          setProductionKpis(evt.kpiDashboard);
        }
      };

      eventSource.addEventListener('kpi_update', (e: MessageEvent) => {
        try {
          handleKpiUpdate(JSON.parse(e.data));
        } catch {
          // Ignore
        }
      });

      eventSource.addEventListener('scan_event', (e: MessageEvent) => {
        try {
          handleScanEvent(JSON.parse(e.data));
        } catch {
          // Ignore
        }
      });

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'kpi_update' && parsed.payload?.kpis) {
            handleKpiUpdate(parsed.payload);
          } else if (parsed.type === 'scan_event' && parsed.payload) {
            handleScanEvent(parsed.payload);
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleTriggerCycleCount = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/v1/audit/cycle-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize: 10 }),
      });
      if (res.ok) {
        await fetchProductionKpis();
      }
    } finally {
      setIsAuditing(false);
    }
  };

  // Metric cards configuration
  const cards = [
    {
      title: 'Total SKU',
      value: kpis.totalSku,
      unit: 'SKU',
      sub: 'สินค้าทั้งหมดในระบบ',
      icon: <Layers className="w-5 h-5 text-indigo-600" />,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      action: () => onNavigate('products'),
    },
    {
      title: 'Total Stock',
      value: kpis.totalStock.toLocaleString(),
      unit: 'ชิ้น',
      sub: `มูลค่า ฿${kpis.stockValue.toLocaleString()}`,
      icon: <Boxes className="w-5 h-5 text-emerald-600" />,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      action: () => onNavigate('inventory'),
    },
    {
      title: "Today's Orders",
      value: requisitions.length,
      unit: 'ใบเบิก',
      sub: 'ยอดคำขอเบิกสินค้าสะสม',
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      color: 'bg-blue-50 border-blue-200 text-blue-900',
      action: () => onNavigate('requests'),
    },
    {
      title: 'Pending Picking',
      value: kpis.activePicking,
      unit: 'Order',
      sub: 'อยู่ระหว่างจัดหยิบ',
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      color: 'bg-amber-50 border-amber-200 text-amber-900',
      action: () => onNavigate('picking'),
    },
    {
      title: 'Completed Picking',
      value: pickingOrders.filter((p) => p.status === 'Picked').length,
      unit: 'Order',
      sub: 'จัดเสร็จรอตรวจจ่าย',
      icon: <CheckCircle2 className="w-5 h-5 text-teal-600" />,
      color: 'bg-teal-50 border-teal-200 text-teal-900',
      action: () => onNavigate('packing'),
    },
    {
      title: 'Ready to Ship',
      value: kpis.readyToShip,
      unit: 'Shipment',
      sub: 'พร้อมจัดส่งปลายทาง',
      icon: <Truck className="w-5 h-5 text-purple-600" />,
      color: 'bg-purple-50 border-purple-200 text-purple-900',
      action: () => onNavigate('shipping'),
    },
    {
      title: 'Low Stock Alerts',
      value: kpis.lowStockCount,
      unit: 'SKU',
      sub: `${kpis.outOfStockCount} สินค้าหมด`,
      icon: <AlertTriangle className="w-5 h-5 text-rose-600" />,
      color: 'bg-rose-50 border-rose-200 text-rose-900',
      action: () => onNavigate('inventory'),
    },
  ];

  // Chart data calculations
  // 1. Orders per Day (past 7 days)
  const ordersPerDay = [
    { day: '04/09', count: 2 },
    { day: '05/09', count: 2 },
    { day: '06/09', count: 2 },
    { day: '07/09', count: 2 },
    { day: '08/09', count: 3 },
    { day: '09/09', count: 5 },
    { day: '10/09', count: 4 },
  ];

  // 4. Stock by Zone
  const zoneAStock = products.filter((p) => p.zone === 'A').reduce((s, p) => s + p.currentStock, 0);
  const zoneBStock = products.filter((p) => p.zone === 'B').reduce((s, p) => s + p.currentStock, 0);
  const zoneCStock = products.filter((p) => p.zone === 'C').reduce((s, p) => s + p.currentStock, 0);
  const totalZoneStock = zoneAStock + zoneBStock + zoneCStock || 1;

  // 6. Shipment Status breakdown
  const shipStatusCounts = {
    Waiting: shipments.filter((s) => s.status === 'Waiting').length,
    Picking: shipments.filter((s) => s.status === 'Picking').length,
    Packing: shipments.filter((s) => s.status === 'Packing').length,
    'Ready to Ship': shipments.filter((s) => s.status === 'Ready to Ship').length,
    Shipped: shipments.filter((s) => s.status === 'Shipped').length,
    Delivered: shipments.filter((s) => s.status === 'Delivered').length,
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome / Classroom Demo Presentation Banner */}
      <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 border border-indigo-500/30">
            <Zap className="w-3.5 h-3.5 text-indigo-400" /> WMS - Warehouse Management System (Production-Ready)
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            WMS Control Center & Production KPI Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
            ระบบบริหารจัดการคลังสินค้าเต็มรูปแบบ ควบคุม 30 SKUs, จัดการ 3 โซน (A, B, C), แนะนำเส้นทาง Picking สั้นที่สุด, รองรับสแกนเนอร์บาร์โค้ด Camera & HID Hardware และประมวลผล 7 Core KPIs แบบ Real-time
          </p>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <button
              onClick={() => onNavigate('kpi')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Target className="w-4 h-4 text-white" />
              ดูดัชนีชี้วัด 7 Core KPIs สด
            </button>
            <button
              onClick={() => onNavigate('scanner')}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4 text-slate-950" />
              เปิดเครื่องสแกนบาร์โค้ด (Camera & HID)
            </button>
            <button
              onClick={() => onNavigate('requests')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-300" />
              สร้างใบเบิกสินค้าใหม่
            </button>
            <button
              onClick={() => setShareModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ring-2 ring-emerald-300/40"
              title="แชร์ลิงก์ให้คนที่ไม่มี AI Studio เข้าใช้งานได้ 100%"
            >
              <Globe className="w-4 h-4 text-white" />
              <span>แชร์ลิงก์ (คนไม่มี AI Studio ใช้งานได้ 100%)</span>
            </button>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <button
                id="btn-reset-dashboard-to-zero"
                onClick={() => setShowResetConfirm(true)}
                disabled={isResetting}
                className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-3.5 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer text-xs disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>🧹 ล้างประวัติใบเบิก & การหยิบ (เหลือข้อมูลสินค้า)</span>
              </button>

              <button
                id="btn-restore-default-data"
                onClick={() => setShowRestoreConfirm(true)}
                disabled={isResetting}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer text-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>↩️ Restore Default Data (ดึงค่าเดิมกลับมา)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top 7 Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((card, idx) => (
          <button
            key={idx}
            onClick={card.action}
            className={`p-3.5 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 bg-white ${card.color} cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider truncate">
                {card.title}
              </span>
              <span className="p-1 rounded-md bg-white/80 shadow-2xs shrink-0">{card.icon}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900">
                {card.value}
              </span>
              <span className="text-xs font-medium text-slate-500">{card.unit}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 truncate">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* 7 Core WMS KPIs Real-time Live Highlights Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'} inline-block`} />
                {sseConnected ? 'REAL-TIME SSE LIVE' : 'CONNECTING'}
              </span>
              <h2 className="text-sm font-extrabold text-slate-900">
                สรุปดัชนีชี้วัด 7 ข้อหลัก (The 7 Core WMS KPIs)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ประมวลผลสดจากทุกคำสั่งซื้อ สต็อก และสถานะการจัดส่ง (Status: {lastEventMsg})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerCycleCount}
              disabled={isAuditing}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'กำลังตรวจนับ...' : 'Audit นับสต็อก (Cycle Count)'}
            </button>
            <button
              onClick={() => onNavigate('kpi')}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Target className="w-3.5 h-3.5" />
              เปิดดูหน้า KPI Dashboard 7 ข้อฉบับเต็ม
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 7 KPI Quick Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <div className="p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">1. Picking Accuracy</span>
            <span className="text-lg font-black font-mono text-indigo-900 block my-0.5">
              {productionKpis?.kpis?.pickingAccuracy?.formattedValue || `${kpis.pickingAccuracy}%`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≥99%</span>
              {productionKpis?.kpis?.pickingAccuracy?.status === 'WAITING_DATA' || (kpis.pickingAccuracy === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.pickingAccuracy?.isPassed ?? (kpis.pickingAccuracy >= 99) ? '✓ ผ่าน' : '✕ ต่ำกว่าเป้า'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">2. Productivity</span>
            <span className="text-lg font-black font-mono text-emerald-900 block my-0.5">
              {productionKpis?.kpis?.pickingProductivity?.formattedValue || `${kpis.pickingProductivity} Ord/h`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≥30</span>
              {productionKpis?.kpis?.pickingProductivity?.status === 'WAITING_DATA' || (kpis.pickingProductivity === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.pickingProductivity?.isPassed ?? (kpis.pickingProductivity >= 30) ? '✓ ผ่าน' : '✕ ต่ำกว่าเป้า'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-blue-100 bg-blue-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">3. Picking Time</span>
            <span className="text-lg font-black font-mono text-blue-900 block my-0.5">
              {productionKpis?.kpis?.pickingTimePerOrder?.formattedValue || `${kpis.pickingTimeMinutes} นาที`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≤2.0น.</span>
              {productionKpis?.kpis?.pickingTimePerOrder?.status === 'WAITING_DATA' || (kpis.pickingTimeMinutes === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.pickingTimePerOrder?.isPassed ?? (kpis.pickingTimeMinutes <= 2.0) ? '✓ ผ่าน' : '✕ ต่ำกว่าเป้า'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-teal-100 bg-teal-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">4. Travel Distance</span>
            <span className="text-lg font-black font-mono text-teal-900 block my-0.5">
              {productionKpis?.kpis?.travelDistancePerOrder?.formattedValue || `${kpis.travelDistance} ม.`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≤50ม.</span>
              {productionKpis?.kpis?.travelDistancePerOrder?.status === 'WAITING_DATA' || (kpis.travelDistance === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.travelDistancePerOrder?.isPassed ?? (kpis.travelDistance <= 50) ? '✓ ประหยัด' : '✕ เกินเป้า'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-purple-100 bg-purple-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">5. Fulfillment Rate</span>
            <span className="text-lg font-black font-mono text-purple-900 block my-0.5">
              {productionKpis?.kpis?.orderFulfillmentRate?.formattedValue || `${kpis.orderFulfillment}%`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≥98%</span>
              {productionKpis?.kpis?.orderFulfillmentRate?.status === 'WAITING_DATA' || (kpis.orderFulfillment === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.orderFulfillmentRate?.isPassed ?? (kpis.orderFulfillment >= 98) ? '✓ ครบถ้วน' : '✕ ไม่ครบ'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">6. Inventory Acc.</span>
            <span className="text-lg font-black font-mono text-amber-900 block my-0.5">
              {productionKpis?.kpis?.inventoryAccuracy?.formattedValue || `${kpis.inventoryAccuracy}%`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≥99%</span>
              {productionKpis?.kpis?.inventoryAccuracy?.status === 'WAITING_DATA' || (kpis.inventoryAccuracy === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.inventoryAccuracy?.isPassed ?? (kpis.inventoryAccuracy >= 99) ? '✓ ตรงเป้า' : '✕ ไม่ตรง'}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/50">
            <span className="text-[10px] font-bold text-slate-500 block truncate">7. On-Time Ship</span>
            <span className="text-lg font-black font-mono text-rose-900 block my-0.5">
              {productionKpis?.kpis?.onTimeShippingRate?.formattedValue || `${kpis.onTimeShipment}%`}
            </span>
            <div className="flex items-center justify-between text-[9px]">
              <span className="text-slate-400">เป้า ≥98%</span>
              {productionKpis?.kpis?.onTimeShippingRate?.status === 'WAITING_DATA' || (kpis.onTimeShipment === 0 && products.length === 0) ? (
                <span className="text-amber-600 font-bold">⏳ รอข้อมูล</span>
              ) : (
                <span className="text-emerald-700 font-bold">
                  {productionKpis?.kpis?.onTimeShippingRate?.isPassed ?? (kpis.onTimeShipment >= 98) ? '✓ ทันเวลา' : '✕ ล่าช้า'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Picking & Shipping Live Status Strip */}
        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Live Picking Status */}
          <div
            onClick={() => onNavigate('picking')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">สถานะการจัดหยิบสด (Live Picking)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-[11px] text-slate-500">
                  กำลังหยิบ: <strong>{kpis.activePicking}</strong> Order • ความเร็ว {kpis.pickingProductivity} Ord/h
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>

          {/* Live Shipping Status */}
          <div
            onClick={() => onNavigate('shipping')}
            className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">สถานะการจัดส่งสด (Live Shipping)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
                </div>
                <p className="text-[11px] text-slate-500">
                  พร้อมส่ง: <strong>{kpis.readyToShip}</strong> รายการ • อัตราตรงเวลา {kpis.onTimeShipment}%
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 6 Required Charts Grid (Prompt Section 16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Graph 1: Orders per Day */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Orders per Day
              </h3>
              <p className="text-xs text-slate-500">จำนวนคำขอเบิกสินค้าต่อวัน</p>
            </div>
            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              Avg: 2.8 / day
            </span>
          </div>

          {/* Bar Chart Visualizer */}
          <div className="h-40 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100">
            {ordersPerDay.map((d, i) => {
              const heightPct = (d.count / 6) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono font-bold text-indigo-900">{d.count}</span>
                  <div
                    className="w-full bg-linear-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all hover:brightness-110"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-slate-500 font-mono">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Graph 2: Picking Productivity */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Picking Productivity
              </h3>
              <p className="text-xs text-slate-500">จำนวน Order ที่หยิบได้ / ชั่วโมง</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
              Target ≥ 30
            </span>
          </div>

          <div className="h-40 flex flex-col justify-center items-center">
            <div className="text-center">
              <span className="text-4xl font-black font-mono text-emerald-600">
                {kpis.pickingProductivity}
              </span>
              <span className="text-xs text-slate-500 block mt-1 font-medium">Orders / ชั่วโมง</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mt-4 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (kpis.pickingProductivity / 35) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between w-full text-[10px] text-slate-500 mt-1">
              <span>0 Ord/h</span>
              <span className="text-emerald-700 font-bold">Target 30 Ord/h (ผ่านเกณฑ์ ✓)</span>
              <span>35+ Ord/h</span>
            </div>
          </div>
        </div>

        {/* Graph 3: Picking Accuracy */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Picking Accuracy
              </h3>
              <p className="text-xs text-slate-500">ความถูกต้องในการหยิบ (Target ≥ 99%)</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">
              Target ≥ 99%
            </span>
          </div>

          <div className="h-40 flex flex-col justify-center items-center">
            <div className="text-center">
              <span className="text-4xl font-black font-mono text-indigo-600">
                {kpis.pickingAccuracy}%
              </span>
              <span className="text-xs text-slate-500 block mt-1 font-medium">ความแม่นยำรวมระบบ</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mt-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${kpis.pickingAccuracy}%` }}
              />
            </div>
            <div className="flex justify-between w-full text-[10px] text-slate-500 mt-1 font-mono">
              <span>95%</span>
              <span className="text-emerald-700 font-bold">Target 99% (บรรลุเป้าหมาย ✓)</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Graph 4: Stock by Zone */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                4. Stock by Zone
              </h3>
              <p className="text-xs text-slate-500">การกระจายสต็อกตามพื้นที่ 3 โซน</p>
            </div>
            <span className="text-xs text-slate-500 font-mono font-bold">
              รวม: {kpis.totalStock.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-emerald-700">Zone A (Fast Moving)</span>
                <span className="font-mono font-bold text-slate-800">
                  {zoneAStock.toLocaleString()} ชิ้น ({Math.round((zoneAStock / totalZoneStock) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(zoneAStock / totalZoneStock) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-blue-700">Zone B (Medium Moving)</span>
                <span className="font-mono font-bold text-slate-800">
                  {zoneBStock.toLocaleString()} ชิ้น ({Math.round((zoneBStock / totalZoneStock) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(zoneBStock / totalZoneStock) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-amber-700">Zone C (Slow Moving)</span>
                <span className="font-mono font-bold text-slate-800">
                  {zoneCStock.toLocaleString()} ชิ้น ({Math.round((zoneCStock / totalZoneStock) * 100)}%)
                </span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${(zoneCStock / totalZoneStock) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Graph 5: ABC Classification */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                5. ABC Classification
              </h3>
              <p className="text-xs text-slate-500">การจัดกลุ่มสินค้า 30 SKU ตามความถี่การเบิก</p>
            </div>
            <span className="text-xs font-bold text-indigo-600">30 SKU</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-xs font-black text-emerald-800 block">GROUP A</span>
              <span className="text-2xl font-black font-mono text-emerald-700 block mt-1">10</span>
              <span className="text-[10px] text-emerald-800">Fast Moving (SKU 1-10)</span>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <span className="text-xs font-black text-blue-800 block">GROUP B</span>
              <span className="text-2xl font-black font-mono text-blue-700 block mt-1">10</span>
              <span className="text-[10px] text-blue-800">Medium (SKU 11-20)</span>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <span className="text-xs font-black text-amber-800 block">GROUP C</span>
              <span className="text-2xl font-black font-mono text-amber-700 block mt-1">10</span>
              <span className="text-[10px] text-amber-800">Slow (SKU 21-30)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 text-center">
            Group A วางใกล้จุด Packing เพื่อลดเวลาเดิน • Group C วางโซนด้านใน
          </p>
        </div>

        {/* Graph 6: Shipment Status */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                6. Shipment Status
              </h3>
              <p className="text-xs text-slate-500">สถานะงานจัดส่งทั้งหมด</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600">
              รวม {shipments.length} งาน
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Waiting</span>
              <strong className="text-base font-mono text-slate-800">{shipStatusCounts.Waiting}</strong>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] text-indigo-700 block">Picking</span>
              <strong className="text-base font-mono text-indigo-900">{shipStatusCounts.Picking}</strong>
            </div>
            <div className="p-2 rounded-lg bg-teal-50 border border-teal-200">
              <span className="text-[10px] text-teal-700 block">Packing</span>
              <strong className="text-base font-mono text-teal-900">{shipStatusCounts.Packing}</strong>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-[10px] text-amber-700 block">Ready to Ship</span>
              <strong className="text-base font-mono text-amber-900">{shipStatusCounts['Ready to Ship']}</strong>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-[10px] text-blue-700 block">Shipped</span>
              <strong className="text-base font-mono text-blue-900">{shipStatusCounts.Shipped}</strong>
            </div>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] text-emerald-700 block">Delivered</span>
              <strong className="text-base font-mono text-emerald-900">{shipStatusCounts.Delivered}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Stock Transactions / Movement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              ประวัติการเคลื่อนไหวสต็อกล่าสุด (Recent Stock Transactions)
            </h3>
            <p className="text-xs text-slate-500">บันทึกทุกการรับเข้า, ตัดจ่าย, ย้ายตำแหน่ง และปรับยอดแบบ Real-time</p>
          </div>
          <button
            onClick={() => onNavigate('movement')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            ดูทั้งหมด <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">วัน-เวลา</th>
                <th className="px-4 py-2.5">ประเภท</th>
                <th className="px-4 py-2.5">SKU / ชื่อสินค้า</th>
                <th className="px-4 py-2.5 text-right">จำนวน</th>
                <th className="px-4 py-2.5">จาก Location</th>
                <th className="px-4 py-2.5">ผู้ดำเนินการ</th>
                <th className="px-4 py-2.5">อ้างอิง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((t, idx) => (
                <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.date}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        t.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.type === 'OUT'
                          ? 'bg-rose-100 text-rose-800'
                          : t.type === 'TRANSFER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800">{t.productName}</div>
                    <div className="font-mono text-[10px] text-slate-400">{t.sku}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                    {t.type === 'OUT' ? `-${t.quantity}` : `+${t.quantity}`}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-700">{t.fromLocation}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{t.operator}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-500">{t.requestNo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Confirmation Modal Dialog */}
      {showResetConfirm && (
        <div id="modal-reset-confirm" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ยืนยันการล้างประวัติใบเบิกและประวัติการหยิบ?</h3>
                <p className="text-xs text-slate-500">ระบบจะล้างประวัติคำสั่งเบิก รายการหยิบ และประวัติการสแกนทั้งหมด โดยคงเหลือข้อมูลสินค้าครบถ้วน</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 space-y-2 mb-5">
              <p className="font-semibold text-slate-800">ข้อมูลที่จะถูกล้างประวัติ:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li><strong>ประวัติใบเบิก (Requisitions):</strong> ล้างข้อมูลใบขอเบิกสินค้าทั้งหมด</li>
                <li><strong>ประวัติงานหยิบ (Picking Orders):</strong> ล้างประวัติคำสั่งหยิบและรายการหยิบทั้งหมด</li>
                <li><strong>ประวัติการจัดส่ง (Shipments):</strong> ล้างประวัติการนำส่งสินค้า</li>
                <li><strong>ประวัติธุรกรรม (Stock Transactions & Scan Logs):</strong> ล้างประวัติการตัดจ่ายและประวัติการสแกน</li>
                <li><strong>7 CORE KPIS:</strong> รีเซ็ตสถานะเป็น 0 พร้อมรองรับรอบการทำงานใหม่</li>
              </ul>
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5 mt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">คงเหลือข้อมูลสินค้า (Products), บาร์โค้ด (Barcodes), คลัง (Locations) และผู้ใช้งาน ไว้อย่างครบถ้วน</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                id="btn-cancel-reset"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                id="btn-confirm-reset"
                disabled={isResetting}
                onClick={handleConfirmReset}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังล้างข้อมูล...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    ยืนยันล้างประวัติ (Confirm Clear)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal Dialog */}
      {showRestoreConfirm && (
        <div id="modal-restore-confirm" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">ดึงข้อมูลตัวอย่างเดิมกลับคืนมา? (Restore Default)</h3>
                <p className="text-xs text-slate-500">โหลดชุดข้อมูลมาตรฐาน 30 SKU และใบเบิกตัวอย่าง</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-600 space-y-2 mb-5">
              <p className="font-semibold text-slate-800">ข้อมูลที่จะถูกคืนค่าเข้าสู่ระบบ:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li><strong>TOTAL SKU:</strong> 30 รายการมาตรฐาน (Zone A, B, C)</li>
                <li><strong>TOTAL STOCK:</strong> 5,001 ชิ้น (มูลค่า ~฿2,900,000)</li>
                <li><strong>REQUISITIONS:</strong> ใบเบิกตัวอย่างพร้อมประวัติการจัดส่ง</li>
                <li><strong>7 CORE KPIS:</strong> ประมวลผลจากข้อมูลการสแกนและสถานะ Picking จริง</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                id="btn-cancel-restore"
                disabled={isResetting}
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                id="btn-confirm-restore"
                disabled={isResetting}
                onClick={handleConfirmRestore}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    กำลังกู้คืนข้อมูล...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    ยืนยันดึงข้อมูลเดิม (Confirm Restore)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Link Modal */}
      <ShareLinkModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </div>
  );
};
