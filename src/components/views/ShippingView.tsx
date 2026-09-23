import React, { useState } from 'react';
import { useWMS } from '../../context/WMSContext';
import { Shipment, ShipmentStatus } from '../../types/wms';
import { BarcodeView } from '../BarcodeView';
import {
  Truck,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  ArrowRight,
  Package,
  MapPin,
  ExternalLink,
  Barcode,
  Send,
  Bell,
  Check,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundUtils';

export const ShippingView: React.FC = () => {
  const { shipments, updateShipmentStatus, kpis, simulateQuickDispatch } = useWMS();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [shippingLabelModal, setShippingLabelModal] = useState<Shipment | null>(null);

  // Requirement 12: Barcode Dispatch Scanning
  const [scanInput, setScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    message: string;
    type: 'success' | 'error';
    details?: string;
  } | null>(null);

  const stagesList: { key: string; label: string; count: number; color: string }[] = [
    { key: 'ALL', label: 'ทั้งหมด (All)', count: shipments.length, color: 'border-slate-300' },
    { key: 'Waiting', label: '1. Waiting', count: shipments.filter((s) => s.status === 'Waiting').length, color: 'border-slate-300' },
    { key: 'Picking', label: '2. Picking', count: shipments.filter((s) => s.status === 'Picking').length, color: 'border-blue-300' },
    { key: 'Packing', label: '3. Packing', count: shipments.filter((s) => s.status === 'Packing').length, color: 'border-indigo-300' },
    { key: 'Ready to Ship', label: '4. Ready to Ship', count: shipments.filter((s) => s.status === 'Ready to Ship').length, color: 'border-amber-300' },
    { key: 'Shipped', label: '5. Shipped', count: shipments.filter((s) => s.status === 'Shipped').length, color: 'border-purple-300' },
    { key: 'Delivered', label: '6. Delivered', count: shipments.filter((s) => s.status === 'Delivered').length, color: 'border-emerald-300' },
  ];

  const filteredShipments = shipments.filter((s) => {
    const matchQ =
      (s.id && s.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.requestNo && s.requestNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.recipient && s.recipient.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.trackingNumber && s.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchS = statusFilter === 'ALL' || s.status === statusFilter;
    return Boolean(matchQ && matchS);
  });

  // Requirement 12: Scan Barcode on Requisition or Shipping Label to verify and dispatch
  const handleScanDispatchBarcode = (barcode: string) => {
    const clean = barcode.trim().toUpperCase();
    if (!clean) return;

    // Find shipment by ID, requestNo, DO-requestNo, or trackingNumber
    const target = shipments.find(
      (s) =>
        (s.id && s.id.toUpperCase() === clean) ||
        (s.requestNo && s.requestNo.toUpperCase() === clean) ||
        (s.requestNo && `DO-${s.requestNo}`.toUpperCase() === clean) ||
        (s.trackingNumber && s.trackingNumber.toUpperCase() === clean)
    );

    if (target) {
      soundManager.playSuccessBeep();

      if (target.status === 'Delivered') {
        setScanFeedback({
          message: `พัสดุ ${target.id} (${target.requestNo}) ส่งมอบเรียบร้อยแล้วก่อนหน้านี้`,
          type: 'success',
          details: `ผู้รับ: ${target.recipient} (${target.department})`,
        });
        return;
      }

      // Advance to Shipped or Delivered
      const nextStatus: ShipmentStatus = target.status === 'Shipped' ? 'Delivered' : 'Shipped';
      updateShipmentStatus(target.id, nextStatus);

      if (nextStatus === 'Delivered') {
        confetti({ particleCount: 80, spread: 70 });
      }

      setScanFeedback({
        message:
          nextStatus === 'Shipped'
            ? `✓ สแกนสำเร็จ: ขึ้นรถจัดส่งสินค้าเรียบร้อย (สถานะ: Shipped)`
            : `✓ สแกนสำเร็จ: มอบสินค้าให้ผู้รับเรียบร้อยแล้ว (สถานะ: Delivered)`,
        type: 'success',
        details: `ส่งการแจ้งเตือนไปยัง ${target.recipient} (${target.department}) — ใบเบิก ${target.requestNo}`,
      });
      setScanInput('');
    } else {
      soundManager.playErrorBuzz();
      setScanFeedback({
        message: `⚠ ไม่พบใบเบิกหรือเลข Tracking: "${barcode}"`,
        type: 'error',
        details: 'กรุณาสแกน Barcode บนใบส่งของ (DO-REQ-xxxx) หรือใบเบิก (REQ-xxxx)',
      });
    }
  };

  const handleAdvanceStatus = (shipment: Shipment) => {
    let nextStatus: ShipmentStatus | null = null;
    if (shipment.status === 'Waiting') nextStatus = 'Picking';
    else if (shipment.status === 'Picking') nextStatus = 'Packing';
    else if (shipment.status === 'Packing') nextStatus = 'Ready to Ship';
    else if (shipment.status === 'Ready to Ship') nextStatus = 'Shipped';
    else if (shipment.status === 'Shipped') nextStatus = 'Delivered';

    if (nextStatus) {
      updateShipmentStatus(shipment.id, nextStatus);
      if (nextStatus === 'Delivered') {
        confetti({ particleCount: 70, spread: 60 });
      }
    }
  };

  const getStatusBadge = (st: ShipmentStatus) => {
    switch (st) {
      case 'Waiting':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Waiting</span>;
      case 'Picking':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Picking</span>;
      case 'Packing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Packing</span>;
      case 'Ready to Ship':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">Ready to Ship</span>;
      case 'Shipped':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Shipped</span>;
      case 'Delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Delivered ✓</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-600" />
              ระบบการจ่ายสินค้าและจัดส่ง (Shipping & Dispatch Validation)
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              REAL-TIME DISPATCH
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            สแกน Barcode ใบเบิก / Shipping Label เพื่อยืนยันจ่ายสินค้าและขึ้นรถ • แจ้งเตือนผู้เบิกทันที
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 block font-mono">On-Time SLA</span>
            <span className="text-sm font-black font-mono text-emerald-600">{kpis.onTimeShipment}%</span>
          </div>
          <button
            onClick={simulateQuickDispatch}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Truck className="w-3.5 h-3.5" />
            ปล่อยรถส่งสินค้า (Dispatch All)
          </button>
        </div>
      </div>

      {/* Requirement 12: Barcode Dispatch Scanning Station */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center gap-1.5">
            <Barcode className="w-4 h-4" /> BARCODE DISPATCH SCANNER
          </span>
          <span className="text-[11px] text-slate-400">
            สแกน Barcode ใบเบิก หรือ ป้าย Shipping Label เพื่อยืนยันการขึ้นรถ / มอบให้ผู้รับ
          </span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="สแกน Barcode เช่น DO-REQ-0001 หรือ REQ-0001 หรือ Tracking No..."
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scanInput) {
                handleScanDispatchBarcode(scanInput);
              }
            }}
            className="flex-1 bg-slate-800 text-white placeholder-slate-400 px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-mono focus:outline-hidden focus:border-indigo-400"
          />
          <button
            onClick={() => {
              if (scanInput) handleScanDispatchBarcode(scanInput);
            }}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            ยืนยันการขึ้นรถ / จ่ายสินค้า
          </button>
        </div>

        {/* Quick Simulation Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
          <span>จำลองสแกน:</span>
          {shipments.slice(0, 4).map((s) => (
            <button
              key={s.id}
              onClick={() => handleScanDispatchBarcode(`DO-${s.requestNo}`)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded font-mono cursor-pointer"
            >
              DO-{s.requestNo} ({s.status})
            </button>
          ))}
        </div>

        {/* Feedback Message */}
        {scanFeedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
              scanFeedback.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-600 text-emerald-200'
                : 'bg-rose-950/80 border border-rose-600 text-rose-200'
            }`}
          >
            {scanFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="block font-bold">{scanFeedback.message}</strong>
              {scanFeedback.details && (
                <span className="text-[11px] text-slate-300 block mt-0.5 flex items-center gap-1">
                  <Bell className="w-3 h-3 text-amber-400 inline" /> {scanFeedback.details}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6-Stage Real-Time Pipeline Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {stagesList.map((stg) => {
          const isSelected = statusFilter === stg.key;
          return (
            <button
              key={stg.key}
              onClick={() => setStatusFilter(stg.key)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
              }`}
            >
              <span className={`text-[10px] font-bold block truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                {stg.label}
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-xl font-black font-mono ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                  {stg.count}
                </span>
                <span className={`text-[10px] ${isSelected ? 'text-emerald-300 font-bold' : 'text-slate-400'}`}>
                  {isSelected ? 'กำลังดู' : 'เลือก'}
                </span>
              </div>
            </button>
          );
        })}
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
              placeholder="ค้นหาเลขที่จัดส่ง, Tracking, ผู้รับ, ใบเบิก..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">ทุกสถานะการจัดส่ง</option>
            <option value="Waiting">Waiting</option>
            <option value="Picking">Picking</option>
            <option value="Packing">Packing</option>
            <option value="Ready to Ship">Ready to Ship</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">เลขที่งานส่ง (Shipment No)</th>
                <th className="px-4 py-3">อ้างอิงใบเบิก</th>
                <th className="px-4 py-3">ผู้รับปลายทาง</th>
                <th className="px-4 py-3">สถานที่จัดส่ง</th>
                <th className="px-4 py-3">บริษัทขนส่ง / Tracking</th>
                <th className="px-4 py-3">รอบเวลาจัดส่ง</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredShipments.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{s.id}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{s.requestNo}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{s.recipient}</div>
                    <div className="text-[10px] text-slate-400">{s.department}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{s.destination}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{s.carrier}</div>
                    <div className="text-[10px] font-mono text-slate-400">{s.trackingNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono">{s.scheduledTime}</td>
                  <td className="px-4 py-3">{getStatusBadge(s.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setShippingLabelModal(s)}
                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                        title="ดูป้าย Shipping Label"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {s.status !== 'Delivered' && (
                        <button
                          onClick={() => handleAdvanceStatus(s)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>{s.status === 'Ready to Ship' ? 'ขึ้นรถ' : 'ถัดไป'}</span>{' '}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping Label Print Modal */}
      {shippingLabelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                ป้ายจัดส่งพัสดุ (Shipping Label)
              </h3>
              <button
                onClick={() => setShippingLabelModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-4 p-4 border-2 border-dashed border-slate-400 rounded-xl bg-slate-50 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-start border-b border-slate-300 pb-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    DELIVERY ORDER
                  </div>
                  <div className="font-mono font-black text-sm text-slate-900">
                    DO-{shippingLabelModal.requestNo}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Shipment No.</span>
                  <span className="font-mono font-bold text-indigo-700">{shippingLabelModal.id}</span>
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">ผู้รับ (DELIVERY TO):</div>
                <div className="font-bold text-slate-900 text-sm">{shippingLabelModal.recipient}</div>
                <div className="text-slate-600 text-[11px]">แผนก: {shippingLabelModal.department}</div>
                <div className="text-slate-600 text-[11px]">สถานที่: {shippingLabelModal.destination}</div>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 flex flex-col items-center justify-center">
                <BarcodeView value={`DO-${shippingLabelModal.requestNo}`} height={42} width={220} showText={true} />
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                <span>ขนส่ง: <strong className="text-slate-800">{shippingLabelModal.carrier}</strong></span>
                <span>Tracking: <strong className="text-slate-800 font-mono">{shippingLabelModal.trackingNumber}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShippingLabelModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> สั่งพิมพ์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
