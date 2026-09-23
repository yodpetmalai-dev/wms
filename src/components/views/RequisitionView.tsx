import React, { useState, useEffect } from 'react';
import { useWMS } from '../../context/WMSContext';
import { Requisition, RequisitionStatus } from '../../types/wms';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  PackageCheck,
  AlertTriangle,
  User,
  Building,
  ArrowRight,
  Barcode,
  Layers,
  Info,
  Zap,
  ShoppingBag,
  Sparkles,
  Check,
} from 'lucide-react';

interface RequisitionViewProps {
  onNavigateToPicking?: (pickId: string) => void;
  initialReqId?: string;
  autoOpenCreate?: boolean;
  onCloseAutoCreate?: () => void;
}

export interface RequisitionPreset {
  id: string;
  name: string;
  description: string;
  department: string;
  reason: string;
  badge: string;
  items: { sku: string; quantity: number }[];
}

const PRESET_TEMPLATES: RequisitionPreset[] = [
  {
    id: 'stationery',
    name: 'ชุดเครื่องเขียนสำนักงาน',
    description: 'ปากกาน้ำเงิน, ปากกาแดง, เทปใส',
    department: 'ฝ่ายธุรการ',
    reason: 'เบิกอุปกรณ์สำนักงานประจำสัปดาห์',
    badge: 'เครื่องเขียน',
    items: [
      { sku: 'PEN-BL-001', quantity: 10 },
      { sku: 'PEN-RD-002', quantity: 5 },
      { sku: 'TAP-CLR-023', quantity: 3 },
    ],
  },
  {
    id: 'express_order',
    name: 'ชุดผลไม้และของสดเกรดส่งออก',
    description: 'มะพร้าวน้ำหอม, มะม่วงน้ำดอกไม้',
    department: 'ฝ่ายขาย & จัดส่ง',
    reason: 'จัดเตรียมสินค้าตามคำสั่งซื้อลูกค้าด่วนรอบบ่าย',
    badge: 'สินค้าขายดี',
    items: [
      { sku: 'FRU-001', quantity: 6 },
      { sku: 'FRU-002', quantity: 8 },
    ],
  },
  {
    id: 'maintenance',
    name: 'ชุดจัดเก็บเอกสารและพัสดุ',
    description: 'กล่องเอกสาร, แฟ้ม A4, เทปกาว',
    department: 'ฝ่ายวิศวกรรม/ซ่อมบำรุง',
    reason: 'เบิกใช้จัดระเบียบงานบำรุงรักษาประจำเดือน',
    badge: 'จัดเก็บพัสดุ',
    items: [
      { sku: 'BOX-S-020', quantity: 4 },
      { sku: 'FIL-A4-017', quantity: 6 },
      { sku: 'TAP-DCT-025', quantity: 2 },
    ],
  },
];

export const RequisitionView: React.FC<RequisitionViewProps> = ({
  onNavigateToPicking,
  initialReqId,
  autoOpenCreate,
  onCloseAutoCreate,
}) => {
  const { requisitions, products, users, createRequisition, approveRequisition, activeUser, clearOrdersAndPickingHistory } =
    useWMS();

  const [searchQuery, setSearchQuery] = useState(initialReqId || '');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);

  useEffect(() => {
    if (initialReqId) {
      setSearchQuery(initialReqId);
      const found = requisitions.find((r) => r.id === initialReqId);
      if (found) setSelectedReq(found);
    }
  }, [initialReqId, requisitions]);

  // Modal State for New Requisition (Requirement 3 & 4)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [requestorName, setRequestorName] = useState(activeUser?.name || users[0]?.name || 'สมชาย มั่นคง');
  const [department, setDepartment] = useState(activeUser?.department || 'ฝ่ายปฏิบัติการ');
  const [reason, setReason] = useState('เบิกใช้งานประจำสัปดาห์สำหรับไซต์งานและออฟฟิศ');
  const [autoJumpToPick, setAutoJumpToPick] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [itemsList, setItemsList] = useState<{ sku: string; quantity: number }[]>([
    { sku: products[0]?.sku || 'PEN-BL-001', quantity: 10 },
    { sku: products[1]?.sku || 'PEN-RD-002', quantity: 5 },
  ]);

  // Listen to autoOpenCreate prop
  useEffect(() => {
    if (autoOpenCreate) {
      setCreateModalOpen(true);
      if (onCloseAutoCreate) onCloseAutoCreate();
    }
  }, [autoOpenCreate, onCloseAutoCreate]);

  // Sync with active user if changed
  useEffect(() => {
    if (activeUser?.name) {
      setRequestorName(activeUser.name);
      if (activeUser.department) {
        setDepartment(activeUser.department);
      }
    }
  }, [activeUser]);

  const previewReqId = `REQ-${String(requisitions.length + 1).padStart(4, '0')}`;
  const currentDateStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }) + ' ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  // Calculate overall stock sufficiency for creation modal
  const allItemsSufficient = itemsList.every((item) => {
    const p = products.find((prod) => prod.sku === item.sku);
    return p ? p.currentStock >= item.quantity : false;
  });

  const filteredRequisitions = requisitions.filter((r) => {
    const matchQ =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.requestor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchS =
      statusFilter === 'ALL' ||
      r.status === statusFilter ||
      (statusFilter === 'ReadyToPick' && r.status === 'รอหยิบ') ||
      (statusFilter === 'Insufficient' && r.status === 'Stock ไม่เพียงพอ') ||
      (statusFilter === 'Picking' && r.status === 'กำลัง Picking') ||
      (statusFilter === 'Issued' && r.status === 'จ่ายสินค้าแล้ว') ||
      (statusFilter === 'Delivered' && (r.status === 'ส่งแล้ว' || r.status === 'Completed'));
    return matchQ && matchS;
  });

  const handleApplyPreset = (preset: RequisitionPreset) => {
    // Check which items exist in products, adjust if necessary
    const validItems = preset.items
      .map((it) => {
        const exists = products.some((p) => p.sku === it.sku);
        return exists ? it : null;
      })
      .filter((it): it is { sku: string; quantity: number } => it !== null);

    const finalItems = validItems.length > 0 ? validItems : [{ sku: products[0]?.sku || 'PEN-BL-001', quantity: 5 }];
    setItemsList(finalItems);
    setDepartment(preset.department);
    setReason(preset.reason);
    setModalError(null);
    setCreateModalOpen(true);
  };

  const handleInstantCreatePreset = (preset: RequisitionPreset) => {
    const validItems = preset.items
      .map((it) => {
        const exists = products.some((p) => p.sku === it.sku);
        return exists ? it : null;
      })
      .filter((it): it is { sku: string; quantity: number } => it !== null);

    const finalItems = validItems.length > 0 ? validItems : [{ sku: products[0]?.sku || 'PEN-BL-001', quantity: 5 }];

    const res = createRequisition({
      requestor: activeUser?.name || 'สมชาย มั่นคง',
      department: preset.department,
      notes: preset.reason,
      reason: preset.reason,
      items: finalItems,
    });

    if (res.success && res.pickId && onNavigateToPicking) {
      setTimeout(() => {
        onNavigateToPicking(res.pickId!);
      }, 400);
    }
  };

  const handleQuickAddProduct = (prodSku: string) => {
    setModalError(null);
    setItemsList((prev) => {
      const existingIdx = prev.findIndex((it) => it.sku === prodSku);
      if (existingIdx !== -1) {
        return prev.map((it, idx) => (idx === existingIdx ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, { sku: prodSku, quantity: 1 }];
    });
  };

  const handleAddItemRow = () => {
    setModalError(null);
    const nextProd = products.find((p) => !itemsList.some((it) => it.sku === p.sku)) || products[0];
    setItemsList((prev) => [...prev, { sku: nextProd?.sku || 'PEN-BL-001', quantity: 1 }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setModalError(null);
    setItemsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuantityIncrement = (idx: number, delta: number) => {
    setModalError(null);
    setItemsList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    );
  };

  const handleItemChange = (idx: number, field: 'sku' | 'quantity', val: any) => {
    setModalError(null);
    setItemsList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemsList.length === 0) {
      setModalError('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    if (!department.trim()) {
      setModalError('กรุณาระบุชื่อแผนกที่ขอเบิก');
      return;
    }

    if (!reason.trim()) {
      setModalError('กรุณาระบุวัตถุประสงค์ในการเบิก');
      return;
    }

    const res = createRequisition({
      requestor: requestorName,
      department,
      notes: reason,
      reason,
      items: itemsList,
    });

    if (res.success) {
      setModalError(null);
      setCreateModalOpen(false);
      setItemsList([{ sku: products[0]?.sku || 'PEN-BL-001', quantity: 10 }]);
      if (autoJumpToPick && res.pickId && onNavigateToPicking) {
        // Automatically jump straight to picking screen
        setTimeout(() => {
          onNavigateToPicking(res.pickId!);
        }, 400);
      }
    } else {
      setCreateModalOpen(false);
    }
  };

  const getStatusBadge = (status: RequisitionStatus | string) => {
    switch (status) {
      case 'รอหยิบ':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> รอหยิบ
          </span>
        );
      case 'Stock ไม่เพียงพอ':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Stock ไม่เพียงพอ
          </span>
        );
      case 'กำลัง Picking':
      case 'Picking':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" /> กำลังหยิบ
          </span>
        );
      case 'Picked':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
            หยิบเสร็จแล้ว
          </span>
        );
      case 'จ่ายสินค้าแล้ว':
      case 'Issued':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
            จ่ายสินค้าแล้ว
          </span>
        );
      case 'ส่งแล้ว':
      case 'Delivered':
      case 'Completed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ส่งสำเร็จ
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* End-to-End Fulfillment Stepper Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              กระบวนการจ่ายสินค้าแบบครบวงจร (Fulfillment Flow)
            </span>
            <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
              1. ออกใบเบิก ➔ 2. ยิงหยิบสินค้าด้วย Barcode ➔ 3. ตรวจนับ & แพ็กส่ง
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToPicking && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToPicking(
                    requisitions.find((r) => r.status === 'รอหยิบ')?.pickingOrderId || 'PICK-0001'
                  )
                }
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                เปิดหน้าจอจัดหยิบ (Picking Screen) ➔
              </button>
            )}
          </div>
        </div>

        {/* 3 Step Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-indigo-600/30 border-2 border-indigo-400/90 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white font-black flex items-center justify-center text-xs shrink-0">
              1
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-indigo-300 font-bold block">ขั้นตอนที่ 1 (กำลังทำ)</span>
              <span className="font-bold text-white block truncate">สร้างใบเบิก & ตรวจสต็อก Real-time</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToPicking && onNavigateToPicking('PICK-0001')}
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 group-hover:bg-emerald-600 group-hover:text-white text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 transition-colors">
              2
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium block">ขั้นตอนที่ 2</span>
                <span className="text-[10px] text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
                  ข้ามไปหยิบ <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <span className="font-semibold text-slate-200 block truncate">ยิงบาร์โค้ดหยิบตาม Location & แผนที่</span>
            </div>
          </button>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-500 font-bold flex items-center justify-center text-xs shrink-0">
              3
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 font-medium block">ขั้นตอนที่ 3</span>
              <span className="font-semibold text-slate-400 block truncate">บรรจุหีบห่อ & ส่งมอบลูกค้า</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header & Quick Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            การจัดการใบเบิกสินค้า (Requisition Management)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สร้างใบเบิก ตรวจสอบสต็อกคงเหลือ Real-time และระบบจะสร้าง Picking List ให้อัตโนมัติเมื่อสถานะ "รอหยิบ"
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('คุณต้องการล้างประวัติใบเบิกและประวัติการหยิบทั้งหมดใช่หรือไม่? (ข้อมูลสินค้า Master Data จะยังคงอยู่ครบถ้วน)')) {
                clearOrdersAndPickingHistory();
              }
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 active:scale-98 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="ล้างประวัติข้อมูลใบเบิกหยิบและประวัติการหยิบ เหลือไว้แต่ข้อมูลสินค้า"
          >
            <span>🧹 ล้างประวัติใบเบิก & งานหยิบ</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> สร้างใบเบิกสินค้าใหม่ (Create Requisition)
          </button>
        </div>
      </div>

      {/* One-Click Quick Templates Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            ปุ่มเบิกด่วน 1-Click (Quick Requisition Presets):
          </span>
          <span className="text-[11px] text-slate-400">กดเลือกชุดรายการเพื่อสร้างใบเบิกได้ทันที</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESET_TEMPLATES.map((preset) => (
            <div
              key={preset.id}
              className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300 rounded-xl flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                    {preset.badge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {preset.items.length} รายการ
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-900 group-hover:text-indigo-900">{preset.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{preset.description}</p>
                <div className="text-[10px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-200/60">
                  แผนก: {preset.department}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/50">
                <button
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="flex-1 py-1.5 px-2 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                >
                  <span>ปรับแต่ง</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleInstantCreatePreset(preset)}
                  title="สร้างใบเบิกทันทีโดยไม่ต้องกรอกฟอร์ม"
                  className="py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Zap className="w-3 h-3 fill-current text-amber-300" />
                  <span>เบิกด่วน 1-Tap</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขที่ใบเบิก (REQ-XXXX), ผู้เบิก, แผนก..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="ReadyToPick">รอหยิบ (Stock พอ & สร้าง Picking แล้ว)</option>
            <option value="Insufficient">Stock ไม่เพียงพอ</option>
            <option value="Picking">กำลังหยิบ (Picking)</option>
            <option value="Picked">หยิบเสร็จ (Picked)</option>
            <option value="Issued">จ่ายสินค้าแล้ว (Issued)</option>
            <option value="Delivered">ส่งสำเร็จ (Delivered)</option>
          </select>
        </div>
      </div>

      {/* Requisition Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">เลขที่ใบเบิก</th>
                <th className="px-4 py-3">วันที่ขอเบิก</th>
                <th className="px-4 py-3">ผู้เบิก (แผนก)</th>
                <th className="px-4 py-3">วัตถุประสงค์</th>
                <th className="px-4 py-3">รายการสินค้า</th>
                <th className="px-4 py-3 text-right">จำนวนรวม</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-center">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequisitions.map((req) => {
                const totalItems = req.items.reduce((acc, it) => acc + it.quantity, 0);

                return (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{req.id}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{req.date}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{req.requestor}</div>
                      <div className="text-[10px] text-slate-400">{req.department}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {req.reason || req.notes || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700 max-w-xs truncate">
                        {req.items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
                      </div>
                      <span className="text-[10px] text-slate-400">{req.items.length} รายการ</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {totalItems} ชิ้น
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(req.status)}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedReq(req)}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium cursor-pointer"
                        >
                          ดูรายละเอียด
                        </button>
                        {req.status === 'รอหยิบ' && req.pickingOrderId && onNavigateToPicking && (
                          <button
                            onClick={() => onNavigateToPicking(req.pickingOrderId!)}
                            className="px-2.5 py-1 text-white bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            ไปหน้าจัดหยิบ <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRequisitions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm text-slate-700">ไม่มีข้อมูลใบเบิกสินค้าในระบบ</p>
                    <p className="text-xs text-slate-400 mt-1">ประวัติใบเบิกถูกล้างเรียบร้อยแล้ว หรือยังไม่มีคำสั่งเบิกใหม่ คุณสามารถกดปุ่ม "สร้างใบเบิกสินค้าใหม่" ด้านบนได้ทันที</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  รายละเอียดใบเบิก {selectedReq.id}
                </h3>
                <p className="text-xs text-slate-500">
                  วันที่ขอเบิก: {selectedReq.date} • สถานะ: {selectedReq.status}
                </p>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-3 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg">
                <div>
                  <span className="text-slate-500">ผู้เบิก:</span>
                  <p className="font-semibold text-slate-800">{selectedReq.requestor}</p>
                </div>
                <div>
                  <span className="text-slate-500">แผนก:</span>
                  <p className="font-semibold text-slate-800">{selectedReq.department}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">วัตถุประสงค์ในการเบิก:</span>
                  <p className="font-medium text-slate-800">{selectedReq.reason || selectedReq.notes || '-'}</p>
                </div>
                {selectedReq.pickingOrderId && (
                  <div className="col-span-2 bg-indigo-50 p-2 rounded border border-indigo-200 text-indigo-900 font-mono">
                    Picking List อัตโนมัติ: <strong>{selectedReq.pickingOrderId}</strong>
                  </div>
                )}
              </div>

              <div className="font-bold text-slate-800 pt-2">รายการสินค้าที่ขอเบิก:</div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedReq.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-2 border border-slate-200 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{it.productName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        SKU: {it.sku} • Location: {it.location} (Zone {it.zone})
                      </div>
                    </div>
                    <div className="font-mono font-bold text-indigo-700 text-sm">
                      {it.quantity} {it.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg cursor-pointer"
              >
                ปิด
              </button>
              {selectedReq.status === 'รอหยิบ' && selectedReq.pickingOrderId && onNavigateToPicking && (
                <button
                  onClick={() => {
                    const pickId = selectedReq.pickingOrderId!;
                    setSelectedReq(null);
                    onNavigateToPicking(pickId);
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  เปิด Picking List <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Requisition Modal (Mobile-Optimized with Sticky Footer & Stepper Controls) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/70 p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    สร้างใบเบิกสินค้า (Requisition Creation)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    เลขที่ <span className="font-mono font-bold text-indigo-600">{previewReqId}</span> • ตรวจสอบสต็อก Real-time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="create-requisition-form" onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs overscroll-contain">
              {/* Validation Error Banner if any */}
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{modalError}</span>
                </div>
              )}

              {/* Header Info Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 block">เลขที่ใบเบิก:</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">{previewReqId}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">วันที่เบิก:</span>
                  <span className="font-mono font-semibold text-slate-800">{currentDateStr}</span>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">ผู้ขอเบิก (ชื่อ-นามสกุล):</label>
                  <select
                    value={requestorName}
                    onChange={(e) => {
                      const selected = users.find((u) => u.name === e.target.value);
                      setRequestorName(e.target.value);
                      if (selected) setDepartment(selected.department);
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">แผนก:</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="เช่น ฝ่ายธุรการ, ฝ่ายผลิต"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-700 block mb-1 font-semibold">วัตถุประสงค์ในการเบิก:</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="เช่น เบิกใช้งานประจำสัปดาห์, เติมสต็อกสาขา..."
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    required
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">รายการสินค้าที่ต้องการเบิก:</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> เพิ่มรายการสินค้า
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
                  {itemsList.map((item, idx) => {
                    const prod = products.find((p) => p.sku === item.sku);
                    const isInsufficient = prod && prod.currentStock < item.quantity;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-colors ${
                          isInsufficient ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex-1">
                          <select
                            value={item.sku}
                            onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-1 focus:ring-indigo-500"
                          >
                            {products.map((p) => (
                              <option key={p.sku} value={p.sku}>
                                {p.sku} - {p.name} (คงเหลือ: {p.currentStock} {p.unit})
                              </option>
                            ))}
                          </select>

                          {prod && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1 font-mono">
                              <span>Barcode: <strong className="text-slate-700">{prod.barcode}</strong></span>
                              <span>
                                สต็อกคงเหลือ:{' '}
                                <strong className={isInsufficient ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                                  {prod.currentStock} {prod.unit}
                                </strong>
                              </span>
                            </div>
                          )}

                          {isInsufficient && (
                            <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              สต็อกไม่พอ (ต้องการ {item.quantity}, ขาด {item.quantity - (prod?.currentStock || 0)})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-600 font-medium">จำนวน:</span>
                            {/* Touch-Friendly Stepper for Mobile */}
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleQuantityIncrement(idx, -1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-sm font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(idx, 'quantity', Math.max(1, Number(e.target.value)))
                                }
                                className="w-12 h-8 text-center text-xs font-bold text-slate-900 border-x border-slate-200 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleQuantityIncrement(idx, 1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-sm font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {prod?.unit || 'ชิ้น'}
                            </span>
                          </div>

                          {itemsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer text-xs"
                              title="ลบรายการ"
                            >
                              ✕ ลบ
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Add from Catalog Drawer */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                    แคตตาล็อกสินค้าในคลัง (แตะ + เพื่อเพิ่ม):
                  </span>
                  <div className="relative w-36 sm:w-44">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาสินค้า..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1">
                  {products
                    .filter((p) =>
                      catalogSearch
                        ? p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                          p.sku.toLowerCase().includes(catalogSearch.toLowerCase())
                        : true
                    )
                    .map((p) => {
                      const isAdded = itemsList.some((it) => it.sku === p.sku);
                      return (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => handleQuickAddProduct(p.sku)}
                          className={`p-2 rounded-lg border text-left text-[11px] transition-all cursor-pointer ${
                            isAdded
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex justify-between">
                            <span>{p.sku}</span>
                            <span className="text-emerald-700 font-bold">{p.currentStock} {p.unit}</span>
                          </div>
                          <div className="text-[10px] text-indigo-600 font-bold mt-1 flex items-center gap-0.5">
                            <Plus className="w-3 h-3" /> เพิ่มเข้ารายการ
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Real-time Status Prediction Indicator */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  allItemsSufficient
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                {allItemsSufficient ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">สต็อกสินค้าเพียงพอทุกรายการ (พร้อมหยิบ)</strong>
                      <span className="text-[11px] text-emerald-800">
                        ระบบจะกำหนดสถานะเป็น <strong>"รอหยิบ"</strong> และสร้าง Picking List ให้อัตโนมัติทันที
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">สินค้าบางรายการมีสต็อกไม่เพียงพอ</strong>
                      <span className="text-[11px] text-rose-800">
                        ระบบจะบันทึกสถานะเป็น <strong>"Stock ไม่เพียงพอ"</strong>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Fast Auto Jump to Picking Option */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoJumpToPick}
                  onChange={(e) => setAutoJumpToPick(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-indigo-900">
                  ⚡ นำทางไปยังหน้าจอจัดหยิบ (Picking Screen) ทันทีหลังบันทึกเสร็จสิ้น
                </span>
              </label>
            </form>

            {/* Sticky Modal Footer (Guaranteed Visible on all screen sizes) */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer font-semibold text-xs active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="create-requisition-form"
                className={`flex-1 sm:flex-none px-5 py-2.5 text-white font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 text-xs flex items-center justify-center gap-1.5 ${
                  allItemsSufficient
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {allItemsSufficient ? 'บันทึกใบเบิก (สถานะ: รอหยิบ)' : 'บันทึกใบเบิก (สต็อกไม่พอ)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button (FAB) for Instant Requisition Creation */}
      <div className="fixed bottom-20 right-4 sm:hidden z-30">
        <button
          type="button"
          onClick={() => {
            setModalError(null);
            setCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-full shadow-xl active:scale-95 cursor-pointer ring-4 ring-indigo-200/60"
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs">สร้างใบเบิก</span>
        </button>
      </div>
    </div>
  );
};
