import React, { useState, useEffect } from 'react';
import { useWMS } from '../../context/WMSContext';
import {
  TrendingUp,
  Target,
  Award,
  CheckCircle2,
  Clock,
  Compass,
  PackageCheck,
  Boxes,
  Truck,
  Users,
  PlayCircle,
  ArrowRight,
  Sparkles,
  Layers,
  AlertCircle,
  RefreshCw,
  Zap,
  Activity,
  CheckSquare,
  Send,
  Navigation,
  CheckCircle,
} from 'lucide-react';

export const KPIView: React.FC = () => {
  const {
    kpis,
    employeeKpis,
    pickingOrders,
    shipments,
    requisitions,
    simulateQuickPick,
    simulateQuickDispatch,
    updateShipmentStatus,
  } = useWMS();

  const [activeTab, setActiveTab] = useState<'all' | '7kpis' | 'picking' | 'shipping' | 'staff'>('all');
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);
  const [lastSseEvent, setLastSseEvent] = useState<string>('Connected to Production Stream');

  // Live timer tick & SSE Real-time Stream
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveSeconds((prev) => prev + 1);
    }, 1000);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/v1/events');
      eventSource.onopen = () => {
        setSseConnected(true);
      };
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'SCAN_VERIFIED') {
            setLastSseEvent(`Live Scan: ${parsed.data.code} (${parsed.data.source})`);
          } else if (parsed.type === 'CYCLE_COUNT_COMPLETED') {
            setLastSseEvent(`Cycle Count: ${parsed.data.accuracy}% Accuracy`);
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
      clearInterval(timer);
      if (eventSource) eventSource.close();
    };
  }, []);

  // Format active picking stats
  const activeOrders = pickingOrders.filter((p) => p.status === 'In Progress' || p.status === 'Pending');
  const completedOrders = pickingOrders.filter((p) => p.status === 'Picked');
  const totalPickingOrders = pickingOrders.length || 1;
  const pickingCompletionPct = Math.round((completedOrders.length / totalPickingOrders) * 100);

  // 6-stage shipping status calculation
  const shippingStages = [
    {
      key: 'Waiting',
      title: '1. Waiting',
      th: 'รออนุมัติ / จัดสรร',
      count: shipments.filter((s) => s.status === 'Waiting').length,
      color: 'bg-slate-100 text-slate-700 border-slate-300',
      badge: 'bg-slate-200 text-slate-800',
    },
    {
      key: 'Picking',
      title: '2. Picking',
      th: 'กำลังจัดหยิบในคลัง',
      count: shipments.filter((s) => s.status === 'Picking').length,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800',
    },
    {
      key: 'Packing',
      title: '3. Packing',
      th: 'ตรวจนับ & บรรจุหีบห่อ',
      count: shipments.filter((s) => s.status === 'Packing').length,
      color: 'bg-teal-50 text-teal-700 border-teal-200',
      badge: 'bg-teal-100 text-teal-800',
    },
    {
      key: 'Ready to Ship',
      title: '4. Ready to Ship',
      th: 'รอขึ้นรถที่ Shipping Dock',
      count: shipments.filter((s) => s.status === 'Ready to Ship').length,
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      badge: 'bg-amber-100 text-amber-800',
    },
    {
      key: 'Shipped',
      title: '5. Shipped',
      th: 'ปล่อยรถ & กำลังขนส่ง',
      count: shipments.filter((s) => s.status === 'Shipped').length,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      key: 'Delivered',
      title: '6. Delivered',
      th: 'ส่งมอบปลายทางสำเร็จ',
      count: shipments.filter((s) => s.status === 'Delivered').length,
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
    },
  ];

  const kpiCards = [
    {
      no: 1,
      title: 'Picking Accuracy',
      thTitle: 'ความถูกต้องในการหยิบสินค้า',
      formula: '(จำนวนสินค้าที่หยิบถูกต้อง / จำนวนสินค้าที่หยิบทั้งหมด) × 100',
      value: `${kpis.pickingAccuracy}%`,
      numericValue: kpis.pickingAccuracy,
      target: '≥ 99.0%',
      targetNum: 99.0,
      isPassed: kpis.pickingAccuracy >= 99,
      unit: '%',
      trend: '+0.4% เทียบกับสัปดาห์ก่อน',
      icon: <Target className="w-5 h-5 text-indigo-600" />,
      color: 'border-indigo-200 bg-indigo-50/40',
      accentColor: 'bg-indigo-600',
      desc: 'ลดความผิดพลาดในการจ่ายผิดชนิดหรือหยิบสลับ SKU ผ่านการสแกนบาร์โค้ด',
      realtimeNote: 'ตรวจสอบผ่าน Barcode Verification 100%',
    },
    {
      no: 2,
      title: 'Picking Productivity',
      thTitle: 'ประสิทธิภาพการจัดหยิบสินค้า',
      formula: 'จำนวน Orders ที่หยิบได้ / จำนวนชั่วโมงทำงาน',
      value: `${kpis.pickingProductivity} Ord/h`,
      numericValue: kpis.pickingProductivity,
      target: '≥ 30 Orders / ชม.',
      targetNum: 30,
      isPassed: kpis.pickingProductivity >= 30,
      unit: 'Ord/h',
      trend: '+3.5 Orders จากมาตรฐาน',
      icon: <Award className="w-5 h-5 text-emerald-600" />,
      color: 'border-emerald-200 bg-emerald-50/40',
      accentColor: 'bg-emerald-600',
      desc: 'ความเร็วในการหยิบตามมาตรฐานคลังสินค้าอัตโนมัติ รองรับทั้ง Single & Batch',
      realtimeNote: `ปัจจุบันหยิบได้ ${kpis.pickingProductivity} คำสั่งซื้อ/ชม.`,
    },
    {
      no: 3,
      title: 'Picking Time per Order',
      thTitle: 'เวลาเฉลี่ยในการจัดหยิบต่อ Order',
      formula: 'เวลาทั้งหมดในการหยิบ / จำนวน Orders',
      value: `${kpis.pickingTimeMinutes} นาที`,
      numericValue: kpis.pickingTimeMinutes,
      target: '≤ 2.0 นาที / Order',
      targetNum: 2.0,
      isPassed: kpis.pickingTimeMinutes <= 2,
      isLowerBetter: true,
      unit: 'นาที',
      trend: 'เร็วขึ้น 15% จากการจัดวางโซน A',
      icon: <Clock className="w-5 h-5 text-blue-600" />,
      color: 'border-blue-200 bg-blue-50/40',
      accentColor: 'bg-blue-600',
      desc: 'เวลาเร็วขึ้นเนื่องจากจัดสินค้า Fast-Moving (Zone A) ไว้ใกล้จุด Packing',
      realtimeNote: 'Lead Time จัดหยิบเฉลี่ย 1.7 นาที/บิล',
    },
    {
      no: 4,
      title: 'Travel Distance',
      thTitle: 'ระยะทางเดินเฉลี่ยในการหยิบ',
      formula: 'ระยะทางเดินทั้งหมด / จำนวน Orders',
      value: `${kpis.travelDistance} ม.`,
      numericValue: kpis.travelDistance,
      target: '≤ 50 เมตร / Order',
      targetNum: 50,
      isPassed: kpis.travelDistance <= 50,
      isLowerBetter: true,
      unit: 'เมตร',
      trend: 'ลดระยะทางได้ 38% ด้วย Shortest Path',
      icon: <Compass className="w-5 h-5 text-teal-600" />,
      color: 'border-teal-200 bg-teal-50/40',
      accentColor: 'bg-teal-600',
      desc: 'คำนวณ Shortest Path Routing จัดลำดับจุดหยิบก่อน-หลังอย่างมีประสิทธิภาพ',
      realtimeNote: 'ระยะทางจริงเฉลี่ย 44 เมตร/Order',
    },
    {
      no: 5,
      title: 'Order Fulfillment Rate',
      thTitle: 'อัตราการจ่ายสินค้าได้ครบตามคำขอ',
      formula: '(จำนวน Order ที่จ่ายได้ครบ / จำนวน Order ทั้งหมด) × 100',
      value: `${kpis.orderFulfillment}%`,
      numericValue: kpis.orderFulfillment,
      target: '≥ 98.0%',
      targetNum: 98.0,
      isPassed: kpis.orderFulfillment >= 98,
      unit: '%',
      trend: 'ไม่มี Backorder ตกค้าง',
      icon: <PackageCheck className="w-5 h-5 text-purple-600" />,
      color: 'border-purple-200 bg-purple-50/40',
      accentColor: 'bg-purple-600',
      desc: 'สินค้าไม่ขาดสต็อก สามารถจ่ายให้ผู้เบิกได้ครบถ้วนตามรายการคำขอเบิก',
      realtimeNote: 'จ่ายสินค้าสำเร็จสมบูรณ์ตามกำหนด',
    },
    {
      no: 6,
      title: 'Inventory Accuracy',
      thTitle: 'ความถูกต้องของสต็อกคงคลัง',
      formula: '(จำนวนรายการที่นับตรง / จำนวนรายการทั้งหมด) × 100',
      value: `${kpis.inventoryAccuracy}%`,
      numericValue: kpis.inventoryAccuracy,
      target: '≥ 99.0%',
      targetNum: 99.0,
      isPassed: kpis.inventoryAccuracy >= 99,
      unit: '%',
      trend: 'Cycle Count ตรงกันทั้ง 30 SKU',
      icon: <Boxes className="w-5 h-5 text-amber-600" />,
      color: 'border-amber-200 bg-amber-50/40',
      accentColor: 'bg-amber-600',
      desc: 'ยอดในระบบตรงกับการตรวจนับจริง บันทึก Stock Transaction อัตโนมัติทุกครั้ง',
      realtimeNote: 'นับสต็อกแบบ Real-time ไม่มีความคลาดเคลื่อน',
    },
    {
      no: 7,
      title: 'On-Time Shipment',
      thTitle: 'อัตราการส่งสินค้าตรงเวลา',
      formula: '(จำนวนการส่งที่ตรงเวลา / การส่งทั้งหมด) × 100',
      value: `${kpis.onTimeShipment}%`,
      numericValue: kpis.onTimeShipment,
      target: '≥ 98.0%',
      targetNum: 98.0,
      isPassed: kpis.onTimeShipment >= 98,
      unit: '%',
      trend: 'ส่งมอบตามรอบเวลา SLA 100%',
      icon: <Truck className="w-5 h-5 text-rose-600" />,
      color: 'border-rose-200 bg-rose-50/40',
      accentColor: 'bg-rose-600',
      desc: 'ส่งมอบถึงผู้เบิกภายในรอบเวลาที่กำหนด พร้อมระบบ Tracking Number พัสดุ',
      realtimeNote: 'ควบคุมการปล่อยรถส่งตรงเวลา',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Real-time Live Control Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                REAL-TIME LIVE
              </span>
              <span className="text-xs text-slate-300 font-mono">
                กำลังคำนวณและประมวลผลข้อมูลสด • ประมวลผล {liveSeconds}s
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              WMS KPI Dashboard & Live Performance Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              ดัชนีวัดประสิทธิภาพคลังสินค้า 7 ข้อหลัก พร้อมศูนย์วิเคราะห์ Performance ในการหยิบ (Picking) และการส่ง (Shipping) แบบ Real-time ชัดเจน
            </p>
          </div>

          {/* Production SSE Status & Execution Actions */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-700 text-[11px]">
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span className="font-mono text-slate-300">
                {sseConnected ? 'SSE Live Stream: Connected' : 'SSE: Reconnecting'}
              </span>
            </div>
            <button
              onClick={simulateQuickPick}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="ดำเนินการหยิบสินค้าในคิว 1 คำสั่งซื้อ"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              ดำเนินการหยิบ (Process Pick)
            </button>
            <button
              onClick={simulateQuickDispatch}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="เลื่อนสถานะจัดส่งพัสดุตามขั้นตอน"
            >
              <Send className="w-3.5 h-3.5" />
              อัปเดตส่งสินค้า (Dispatch)
            </button>
          </div>
        </div>

        {/* View Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold mr-1">เลือกมุมมอง:</span>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            ภาพรวมทั้งหมด (All)
          </button>
          <button
            onClick={() => setActiveTab('7kpis')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === '7kpis'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            7 ดัชนีชี้วัดหลัก (7 Core KPIs)
          </button>
          <button
            onClick={() => setActiveTab('picking')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'picking'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Performance การหยิบ (Picking)
            {activeOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'shipping'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Performance การส่ง (Shipping)
            {kpis.readyToShip > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                {kpis.readyToShip}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'staff'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            ผลงานรายบุคคล (Staff KPI)
          </button>
        </div>
      </div>

      {/* SECTION 1: 7 CORE KPI DASHBOARD CARDS */}
      {(activeTab === 'all' || activeTab === '7kpis') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  7 ดัชนีชี้วัดหลักคลังสินค้า (The 7 Core WMS KPIs)
                </h2>
                <p className="text-xs text-slate-500">
                  สูตรคำนวณและเกณฑ์เป้าหมายมาตรฐานอุตสาหกรรม คำนวณแบบ Real-time ทุกธุรกรรม
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> บรรลุเกณฑ์ 7/7 ตัวชี้วัด (100% Pass)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => {
              // Calculate progress bar percentage
              let pct = 0;
              if (kpi.no === 1 || kpi.no === 5 || kpi.no === 6 || kpi.no === 7) {
                // Percentage based (target >= 98 or 99)
                pct = Math.min(100, Math.max(0, kpi.numericValue));
              } else if (kpi.no === 2) {
                // Productivity (target >= 30, max 40)
                pct = Math.min(100, (kpi.numericValue / 40) * 100);
              } else if (kpi.no === 3) {
                // Time per order (target <= 2.0 min, lower is better)
                pct = Math.max(10, Math.min(100, (1 - (kpi.numericValue - 1) / 2) * 100));
              } else if (kpi.no === 4) {
                // Distance (target <= 50m, lower is better)
                pct = Math.max(10, Math.min(100, (1 - (kpi.numericValue - 20) / 50) * 100));
              }

              return (
                <div
                  key={kpi.no}
                  className={`p-5 rounded-2xl border bg-white shadow-2xs flex flex-col justify-between transition-all hover:shadow-md hover:-translate-y-0.5 ${kpi.color}`}
                >
                  <div>
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono font-black text-slate-700 shadow-2xs">
                        KPI #{kpi.no}
                      </span>
                      <span className="p-2 rounded-xl bg-white shadow-2xs border border-slate-100">{kpi.icon}</span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 leading-tight">{kpi.title}</h3>
                    <p className="text-xs text-slate-600 mb-3 font-medium">{kpi.thTitle}</p>

                    {/* Prominent Value Box */}
                    <div className="my-3 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs text-center">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-black font-mono tracking-tight text-slate-900">
                          {kpi.value}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px]">
                        <span className="text-slate-400">เกณฑ์เป้าหมาย:</span>
                        <span className="font-bold text-slate-800 font-mono bg-slate-100 px-1.5 py-0.2 rounded">
                          {kpi.target}
                        </span>
                      </div>

                      {/* Visual Progress Bar Meter */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            kpi.isPassed ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1">
                        <span>Min</span>
                        <span className="text-emerald-700 font-bold">เกณฑ์เป้าหมาย ✓</span>
                        <span>Optimal</span>
                      </div>
                    </div>

                    {/* Formula & Explanatory Description */}
                    <div className="text-[10px] space-y-1.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/50">
                      <div className="text-slate-700 font-mono font-semibold">
                        <span className="text-slate-400 block text-[9px]">สูตรคำนวณ:</span>
                        {kpi.formula}
                      </div>
                      <div className="text-slate-600 text-[10px] leading-relaxed pt-1 border-t border-slate-100">
                        {kpi.desc}
                      </div>
                      <div className="text-indigo-600 font-medium text-[10px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        {kpi.realtimeNote}
                      </div>
                    </div>
                  </div>

                  {/* Footer Status Badge */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500">ผลการประเมิน:</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                        kpi.isPassed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {kpi.isPassed ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> ผ่านเกณฑ์ (Pass)
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> ต่ำกว่าเกณฑ์
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: REAL-TIME PICKING PERFORMANCE LIVE CENTER */}
      {(activeTab === 'all' || activeTab === 'picking') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-linear-to-r from-emerald-50 via-teal-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  Performance ในการจัดหยิบสินค้า (Real-time Picking Performance)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  LIVE PIPELINE
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ติดตามขั้นตอนการหยิบสินค้า, อัตราความเร็วต่อชั่วโมง, ระยะทางเดิน และใบสั่งหยิบที่กำลังดำเนินการ
              </p>
            </div>

            <button
              onClick={simulateQuickPick}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              บันทึกการจัดหยิบคิวถัดไป (Execute Pick Queue)
            </button>
          </div>

          {/* 3-Stage Picking Pipeline Overview */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              ขั้นตอนการหยิบสินค้าสด (Picking Stages Pipeline)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Stage 1: Pending */}
              <div className="p-4 rounded-xl border bg-white shadow-2xs border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">1. รอหยิบ (Pending Pick)</span>
                  <span className="text-2xl font-black font-mono text-slate-900">
                    {pickingOrders.filter((p) => p.status === 'Pending').length}
                  </span>
                  <span className="text-xs text-slate-400 font-medium block">คำสั่งซื้อในคิว</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Stage 2: In Progress */}
              <div className="p-4 rounded-xl border bg-indigo-50/50 shadow-2xs border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase block">2. กำลังหยิบ (In Progress)</span>
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping inline-block" />
                  </div>
                  <span className="text-2xl font-black font-mono text-indigo-900">
                    {pickingOrders.filter((p) => p.status === 'In Progress').length}
                  </span>
                  <span className="text-xs text-indigo-600 font-medium block">พนักงานกำลังเดินสแกน</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
              </div>

              {/* Stage 3: Picked */}
              <div className="p-4 rounded-xl border bg-emerald-50/50 shadow-2xs border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase block">3. หยิบเสร็จ (Picked & Staged)</span>
                  <span className="text-2xl font-black font-mono text-emerald-900">
                    {pickingOrders.filter((p) => p.status === 'Picked').length}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium block">พร้อมส่งเข้าจุดตรวจจ่าย</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Picking Performance Metrics & Active Live Orders */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Col: Real-time Velocity & Optimization Stats */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ตัวชี้วัดความเร็วและระยะทางเดิน
              </h3>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">ความเร็วหยิบปัจจุบัน:</span>
                  <span className="text-base font-black font-mono text-emerald-600">
                    {kpis.pickingProductivity} Orders / ชม.
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, (kpis.pickingProductivity / 35) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>มาตรฐาน 30 Ord/h</span>
                  <span className="text-emerald-700 font-bold">เกินเป้าหมาย +10%</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">ระยะทางเดินเฉลี่ย:</span>
                  <span className="text-base font-black font-mono text-indigo-600">
                    {kpis.travelDistance} เมตร / Order
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  ประหยัดระยะทางได้ <strong>38%</strong> ด้วยอัลกอริทึม Shortest Path Routing และการจัดวาง Zone A ใกล้จุดแพ็คเกจ
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">เวลาต่อ Order:</span>
                  <span className="font-mono font-bold text-slate-800">{kpis.pickingTimeMinutes} นาที/บิล</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-linear-to-br from-indigo-900 to-slate-900 text-white shadow-2xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
                    Smart Route Optimizer
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ระบบคำนวณและเรียงลำดับจุดหยิบตามพิกัด Shelf (A-01-01 → A-01-03) อัตโนมัติ ป้องกันการเดินวนซ้ำในคลัง
                </p>
              </div>
            </div>

            {/* Right 2 Cols: Live Active Orders List with Item Progress */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  ใบสั่งหยิบที่กำลังดำเนินการแบบ Real-time (Active Picking Orders)
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  ความคืบหน้ารวม: {pickingCompletionPct}%
                </span>
              </div>

              <div className="space-y-3">
                {pickingOrders.slice(0, 4).map((order) => {
                  const pickedCount = order.items.filter((it) => it.isPicked).length;
                  const totalCount = order.items.length;
                  const orderPct = Math.round((pickedCount / totalCount) * 100);

                  return (
                    <div
                      key={order.id}
                      className={`p-4 rounded-xl border transition-all ${
                        order.status === 'In Progress'
                          ? 'border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-200'
                          : order.status === 'Picked'
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-slate-900">{order.id}</span>
                          <span className="text-xs text-slate-500 font-mono">({order.reqId})</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {order.strategy} Picking
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">
                            พนักงาน: <strong>{order.pickerName}</strong>
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              order.status === 'In Progress'
                                ? 'bg-indigo-100 text-indigo-800'
                                : order.status === 'Picked'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </div>

                      {/* Items and progress */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600 font-medium">
                            หยิบแล้ว {pickedCount} จาก {totalCount} รายการ
                          </span>
                          <span className="font-mono font-bold text-slate-900">{orderPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              order.status === 'Picked' ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${orderPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Items Chips */}
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                        {order.items.map((it) => (
                          <span
                            key={it.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono ${
                              it.isPicked
                                ? 'bg-emerald-100 text-emerald-800 font-bold'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {it.isPicked ? '✓' : '○'} {it.location}: {it.sku} ({it.quantity} {it.unit})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: REAL-TIME SHIPPING PERFORMANCE LIVE CENTER */}
      {(activeTab === 'all' || activeTab === 'shipping') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Header */}
          <div className="p-5 bg-linear-to-r from-purple-50 via-indigo-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Truck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-slate-900">
                  Performance ในการจัดส่งสินค้า (Real-time Shipping Performance)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                  6-STAGE DISPATCH PIPELINE
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ติดตาม 6 สถานะการจัดส่งแบบ Real-time, อัตรา On-Time Dispatch SLA และข้อมูลการส่งมอบพัสดุ
              </p>
            </div>

            <button
              onClick={simulateQuickDispatch}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              ปล่อยรถจัดส่งตามรอบ (Dispatch to Carrier)
            </button>
          </div>

          {/* 6-Stage Real-time Shipping Pipeline Cards */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              สถานะการจัดส่ง 6 ขั้นตอนแบบ Real-time (6-Stage Pipeline)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {shippingStages.map((stg) => (
                <div
                  key={stg.key}
                  className={`p-3.5 rounded-xl border bg-white shadow-2xs transition-all hover:shadow-md ${stg.color}`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                    {stg.title}
                  </span>
                  <span className="text-2xl font-black font-mono my-1 block">{stg.count}</span>
                  <span className="text-[10px] block opacity-80 truncate">{stg.th}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Metrics & Real-time Tracking Feed */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Col: SLA & Fleet Stats */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ตัวชี้วัดคุณภาพการจัดส่ง (Shipping SLAs)
              </h3>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">อัตราส่งตรงเวลา (On-Time):</span>
                  <span className="text-base font-black font-mono text-emerald-600">
                    {kpis.onTimeShipment}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${kpis.onTimeShipment}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>เป้าหมาย ≥ 98%</span>
                  <span className="text-emerald-700 font-bold">บรรลุเกณฑ์ SLA ✓</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Lead Time รวมเฉลี่ย:</span>
                  <span className="text-base font-black font-mono text-indigo-600">42 นาที</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  คำนวณตั้งแต่เวลาอนุมัติใบเบิก → จัดหยิบ → บรรจุหีบห่อ → ขึ้นรถจัดส่งปลายทาง
                </p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">ความถูกต้อง 5 ขั้นตอน:</span>
                  <span className="font-bold text-emerald-700 font-mono">100% Pass</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-white shadow-2xs">
                <div className="flex items-center gap-2 mb-1.5">
                  <Truck className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold uppercase tracking-wide text-purple-300">
                    ยานพาหนะและช่องทางขนส่ง
                  </span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 mt-2">
                  <li className="flex justify-between">
                    <span>• WMS Internal Fleet (รถขนส่งภายใน):</span>
                    <strong className="text-white font-mono">2 คัน พร้อมใช้งาน</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>• Kerry Express / Flash:</span>
                    <strong className="text-white font-mono">รับพัสดุรอบ 15:00</strong>
                  </li>
                  <li className="flex justify-between">
                    <span>• Grab / Messenger ด่วน:</span>
                    <strong className="text-white font-mono">Standby สำหรับบิลด่วน</strong>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right 2 Cols: Live Shipments Table */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-purple-600" />
                  รายการจัดส่งพัสดุล่าสุดแบบ Real-time (Active Shipments Feed)
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  ทั้งหมด {shipments.length} รายการ
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">รหัสจัดส่ง</th>
                      <th className="px-3.5 py-2.5">ผู้รับ & ปลายทาง</th>
                      <th className="px-3.5 py-2.5">ขนส่ง / Carrier</th>
                      <th className="px-3.5 py-2.5">Tracking Number</th>
                      <th className="px-3.5 py-2.5">สถานะ Real-time</th>
                      <th className="px-3.5 py-2.5 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {shipments.slice(0, 6).map((ship) => (
                      <tr key={ship.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">
                          {ship.id}
                          <span className="text-[10px] text-slate-400 block font-normal">{ship.requestNo}</span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-slate-800 truncate max-w-[140px]">
                            {ship.recipient}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {ship.destination}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 font-medium">{ship.carrier}</td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-indigo-600 font-bold">
                          {ship.trackingNumber}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                              ship.status === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ship.status === 'Shipped'
                                ? 'bg-blue-100 text-blue-800'
                                : ship.status === 'Ready to Ship'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ship.status === 'Shipped' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping inline-block" />
                            )}
                            {ship.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {ship.status === 'Ready to Ship' && (
                            <button
                              onClick={() => updateShipmentStatus(ship.id, 'Shipped')}
                              className="px-2 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer"
                            >
                              ปล่อยรถ (Ship)
                            </button>
                          )}
                          {ship.status === 'Shipped' && (
                            <button
                              onClick={() => updateShipmentStatus(ship.id, 'Delivered')}
                              className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors cursor-pointer"
                            >
                              ส่งมอบสำเร็จ
                            </button>
                          )}
                          {ship.status === 'Delivered' && (
                            <span className="text-[10px] text-emerald-700 font-bold">✓ สำเร็จ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: KPI BY EMPLOYEE TABLE (SECTION 15) */}
      {(activeTab === 'all' || activeTab === 'staff') && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                ดัชนีประสิทธิภาพรายบุคคล (KPI by Employee - Section 15)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              ประเมินผลพนักงานคลัง (Picker & Packing Staff 8 รายการ)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">พนักงาน</th>
                  <th className="px-4 py-3">ตำแหน่ง / บทบาท</th>
                  <th className="px-4 py-3 text-right">จำนวนคำสั่งที่หยิบ (Orders)</th>
                  <th className="px-4 py-3 text-right">Picking Accuracy</th>
                  <th className="px-4 py-3 text-right">Productivity (Orders/ชม.)</th>
                  <th className="px-4 py-3 text-right">เวลาเฉลี่ย (นาที/Order)</th>
                  <th className="px-4 py-3 text-right">ระยะทางเดิน (เมตร)</th>
                  <th className="px-4 py-3 text-center">ระดับผลงาน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeKpis.map((emp) => {
                  const accuracyVal = emp.accuracy ?? emp.pickingAccuracy ?? 99.0;
                  const prodVal = emp.productivity ?? 30;
                  const timeVal = emp.avgTimeMinutes ?? emp.avgPickingTimeMinutes ?? 1.8;
                  const isTop = accuracyVal >= 99 && prodVal >= 30;

                  return (
                    <tr key={emp.employeeId || emp.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{emp.employeeName || emp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">ID: {emp.employeeId || 'USR'}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{emp.role}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {emp.ordersPicked}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                        {accuracyVal}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-indigo-600">
                        {prodVal}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {timeVal} นาที
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {emp.travelDistanceMeters} ม.
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isTop
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {isTop ? 'ดีเยี่ยม (Grade A)' : 'มาตรฐาน (Grade B)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
