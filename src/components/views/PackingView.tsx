import React, { useState, useEffect } from 'react';
import { useWMS } from '../../context/WMSContext';
import { Requisition, PickingOrder } from '../../types/wms';
import { BarcodeView } from '../BarcodeView';
import {
  PackageCheck,
  CheckCircle2,
  ScanBarcode,
  ArrowRight,
  Boxes,
  Truck,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Printer,
  Barcode,
  Check,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../../utils/soundUtils';
import { normalizeBarcode, isBarcodeOrSkuMatch } from '../../utils/barcodeUtils';

export const PackingView: React.FC = () => {
  const {
    requisitions,
    pickingOrders,
    verifyAndIssueGoods,
    activeUser,
    setActiveUser,
    users,
    getProductBySku,
    barcodes,
  } = useWMS();

  // Picked requisitions waiting for packing / goods issue
  const readyToPackReqs = requisitions.filter(
    (r) => ['Picked', 'Picking', 'Approved'].includes(r.status)
  );

  const [selectedReqId, setSelectedReqId] = useState<string>(
    readyToPackReqs[0]?.id || requisitions[0]?.id || 'REQ-0001'
  );

  const selectedReq = requisitions.find((r) => r.id === selectedReqId);

  // Requirement 11: Double-Check Barcode Scanning state per item
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Packer & Shipping Label Modal state
  const [packerName, setPackerName] = useState('นาย K (เจ้าหน้าที่แพ็คเกจจิ้ง)');
  const [shippingLabelModalOpen, setShippingLabelModalOpen] = useState(false);
  const [packedCompletedTime, setPackedCompletedTime] = useState<string | null>(null);

  // Reset scan state when switching requisition
  useEffect(() => {
    if (selectedReq) {
      // Default to initial scanned counts
      const initial: Record<string, number> = {};
      selectedReq.items.forEach((it) => {
        initial[it.sku] = selectedReq.status === 'Issued' || selectedReq.status === 'Delivered' ? it.quantity : 0;
      });
      setScannedItems(initial);
      setScanMessage(null);
      setPackedCompletedTime(
        selectedReq.status === 'Issued' || selectedReq.status === 'Delivered'
          ? `${selectedReq.date} 14:30 น.`
          : null
      );
    }
  }, [selectedReqId, selectedReq?.status]);

  // Requirement 11: Double-Check Barcode Scan Handler
  const handleScanBarcode = (barcodeOrSku: string) => {
    if (!selectedReq) return;
    const rawClean = barcodeOrSku.trim();
    const clean = normalizeBarcode(rawClean) || rawClean.toUpperCase();
    if (!clean) return;

    // Find product matching this barcode or SKU
    const targetItem = selectedReq.items.find((it) => {
      const prod = getProductBySku(it.sku);
      return isBarcodeOrSkuMatch(
        clean,
        { sku: it.sku, barcode: prod?.barcode, name: it.productName },
        barcodes
      );
    });

    if (targetItem) {
      const currentScanned = scannedItems[targetItem.sku] || 0;
      if (currentScanned >= targetItem.quantity) {
        soundManager.playErrorBuzz();
        setScanMessage({
          text: `⚠ สินค้า SKU: ${targetItem.sku} สแกนครบตามจำนวนที่เบิกแล้ว (${targetItem.quantity} ${targetItem.unit})`,
          type: 'error',
        });
        return;
      }

      soundManager.playSuccessBeep();
      setScannedItems((prev) => ({
        ...prev,
        [targetItem.sku]: (prev[targetItem.sku] || 0) + 1,
      }));
      setScanMessage({
        text: `✓ Double Check สำเร็จ: ${targetItem.productName} (+1)`,
        type: 'success',
      });
    } else {
      soundManager.playErrorBuzz();
      setScanMessage({
        text: `⚠ Barcode '${barcodeOrSku}' ไม่ตรงกับรายการใดในใบเบิก ${selectedReq.id}`,
        type: 'error',
      });
    }
  };

  // Check if all items in this requisition have been double-check scanned
  const isAllDoubleChecked =
    selectedReq?.items.every(
      (it) => (scannedItems[it.sku] || 0) >= it.quantity
    ) || false;

  // Requirement 11: Finalize packing and record packer name, date, time
  const handleFinalizePacking = () => {
    if (!selectedReq) return;
    const nowStr = new Date().toLocaleDateString('th-TH') + ' ' + new Date().toLocaleTimeString('th-TH');
    setPackedCompletedTime(nowStr);

    const packingUser = users.find((u) => u.name === 'นาย K' || u.role === 'Warehouse Staff') || users[0];
    setActiveUser(packingUser);

    const res = verifyAndIssueGoods(selectedReq.id, `${packerName} (${nowStr})`);
    if (res.success) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setShippingLabelModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600" />
            จุดตรวจสอบ Double Check และบรรจุหีบห่อ (Packing Station)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สแกน Barcode สินค้าที่หยิบมาเพื่อ Double Check ก่อนแพ็ค • พิมพ์ Shipping Label • บันทึกผู้แพ็คและเวลา
          </p>
        </div>

        <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-200">
          รอแพ็คตรวจจ่าย: {readyToPackReqs.length} ใบเบิก
        </span>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Queue of Orders ready for packing (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              ใบเบิกที่หยิบเสร็จแล้ว (Ready for Packing)
            </h3>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {requisitions.map((req) => {
                const isSelected = req.id === selectedReqId;

                return (
                  <button
                    key={req.id}
                    onClick={() => setSelectedReqId(req.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-slate-900">{req.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'Issued' || req.status === 'Delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'Picked'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      ผู้เบิก: {req.requestor} ({req.department})
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {req.items.length} รายการสินค้า • วัตถุประสงค์: {req.reason || req.notes || '-'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Double Check Scanning & Packing Action (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedReq ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
              {/* Order Info Bar */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-extrabold text-base text-slate-900">
                      ใบเบิก {selectedReq.id}
                    </h3>
                    <span className="text-xs text-slate-600 font-medium">
                      ({selectedReq.requestor} • {selectedReq.department})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    สถานะ: <strong className="text-teal-700">{selectedReq.status}</strong>
                    {packedCompletedTime && ` • แพ็คสำเร็จเมื่อ: ${packedCompletedTime}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShippingLabelModalOpen(true)}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> ดูป้าย Shipping Label
                  </button>
                </div>
              </div>

              {/* Requirement 11: Double-Check Barcode Scanner Input */}
              {selectedReq.status !== 'Issued' && selectedReq.status !== 'Delivered' && (
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                      <Barcode className="w-4 h-4" /> DOUBLE-CHECK BARCODE SCANNER
                    </span>
                    <span className="text-[10px] text-slate-400">
                      สแกน Barcode สินค้าทุกชิ้นก่อนบรรจุลงกล่อง
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ยิง Barcode สินค้าที่หยิบมา หรือพิมพ์ SKU แล้วกด Enter..."
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && scanInput) {
                          handleScanBarcode(scanInput);
                          setScanInput('');
                        }
                      }}
                      className="flex-1 bg-slate-800 text-white placeholder-slate-400 px-3.5 py-2 rounded-lg border border-slate-700 text-xs font-mono focus:outline-hidden focus:border-indigo-400"
                    />
                    <button
                      onClick={() => {
                        if (scanInput) {
                          handleScanBarcode(scanInput);
                          setScanInput('');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      ตรวจสอบ
                    </button>
                  </div>

                  {/* Quick Barcode Simulation Buttons for this order */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 self-center">จำลองยิงบาร์โค้ด:</span>
                    {selectedReq.items.map((it) => {
                      const prod = getProductBySku(it.sku);
                      return (
                        <button
                          key={it.sku}
                          onClick={() => handleScanBarcode(prod?.barcode || it.sku)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] rounded font-mono cursor-pointer"
                        >
                          +1 {it.sku} ({prod?.barcode})
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Message */}
                  {scanMessage && (
                    <div
                      className={`p-2.5 rounded-lg text-xs font-medium ${
                        scanMessage.type === 'success'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {scanMessage.text}
                    </div>
                  )}
                </div>
              )}

              {/* Items Verification Table (Requirement 11: Double Check Status) */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  รายการสินค้าและผลการ Double Check:
                </h4>

                <div className="space-y-2">
                  {selectedReq.items.map((it, idx) => {
                    const prod = getProductBySku(it.sku);
                    const scanned = scannedItems[it.sku] || 0;
                    const isMatched = scanned >= it.quantity;

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          isMatched ? 'bg-emerald-50/70 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{it.productName}</span>
                            <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                              {it.sku}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Barcode: <strong className="text-slate-700">{prod?.barcode || '-'}</strong> • Location: {it.location} (Zone {it.zone})
                          </p>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[10px] text-slate-400 block">ต้องเบิก / สแกนครบ</span>
                            <span className="font-mono font-bold text-sm text-slate-800">
                              <strong className={isMatched ? 'text-emerald-600' : 'text-amber-600'}>{scanned}</strong> / {it.quantity} {it.unit}
                            </span>
                          </div>

                          <div className="w-24 text-center">
                            {isMatched ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                <Check className="w-3 h-3 stroke-[3]" /> ครบถ้วน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium text-[10px]">
                                รอสแกน ({it.quantity - scanned})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Packer Metadata Input (Requirement 11: บันทึกผู้แพ็ค วันที่ และเวลา) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    ผู้ตรวจนับและบรรจุหีบห่อ (Packer Name):
                  </label>
                  <input
                    type="text"
                    value={packerName}
                    onChange={(e) => setPackerName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-semibold block mb-1">
                    วันที่และเวลาบันทึก:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={packedCompletedTime || 'จะบันทึกอัตโนมัติเมื่อกดยืนยันการแพ็ค'}
                    className="w-full p-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-mono"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-500">
                  {isAllDoubleChecked
                    ? '✓ ผ่านการสแกน Double Check ครบทุกรายการ พร้อมพิมพ์ Shipping Label'
                    : '⚠ กรุณาสแกน Double Check สินค้าให้ครบทุกรายการก่อนยืนยันการแพ็ค'}
                </span>

                <button
                  type="button"
                  disabled={!isAllDoubleChecked || selectedReq.status === 'Issued' || selectedReq.status === 'Delivered'}
                  onClick={handleFinalizePacking}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    isAllDoubleChecked && selectedReq.status !== 'Issued' && selectedReq.status !== 'Delivered'
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <PackageCheck className="w-4 h-4" />
                  {selectedReq.status === 'Issued' || selectedReq.status === 'Delivered'
                    ? 'บรรจุหีบห่อและตัดจ่ายเรียบร้อยแล้ว ✓'
                    : 'ยืนยันการแพ็ค & พิมพ์ป้าย Shipping Label'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              เลือกใบเบิกจากรายการทางด้านซ้ายเพื่อทำการตรวจนับและแพ็คสินค้า
            </div>
          )}
        </div>
      </div>

      {/* Requirement 11: Shipping Label Print Modal */}
      {shippingLabelModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                ป้ายติดกล่องพัสดุ (Shipping Label with Barcode)
              </h3>
              <button
                onClick={() => setShippingLabelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Printable Label Preview */}
            <div className="my-4 p-4 border-2 border-dashed border-slate-400 rounded-xl bg-slate-50 space-y-3 font-sans text-xs">
              {/* Label Header */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    DELIVERY ORDER (DO)
                  </div>
                  <div className="font-mono font-black text-sm text-slate-900">
                    DO-{selectedReq.id}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">อ้างอิงใบเบิก</span>
                  <span className="font-mono font-bold text-indigo-700">{selectedReq.id}</span>
                </div>
              </div>

              {/* Recipient & Destination */}
              <div className="space-y-1 bg-white p-2.5 rounded border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">ผู้รับ (RECIPIENT):</div>
                <div className="font-bold text-slate-900 text-sm">{selectedReq.requestor}</div>
                <div className="text-slate-600 text-[11px]">แผนก: {selectedReq.department}</div>
                <div className="text-slate-600 text-[11px]">วัตถุประสงค์: {selectedReq.reason || selectedReq.notes || '-'}</div>
              </div>

              {/* Items Summary */}
              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">รายการสินค้า (CONTENTS):</div>
                {selectedReq.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-slate-700 truncate max-w-[200px]">{it.productName}</span>
                    <span className="font-mono font-bold text-slate-900">x{it.quantity} {it.unit}</span>
                  </div>
                ))}
              </div>

              {/* Barcode Graphic */}
              <div className="bg-white p-3 rounded border border-slate-200 flex flex-col items-center justify-center">
                <BarcodeView value={`DO-${selectedReq.id}`} height={44} width={220} showText={true} />
              </div>

              {/* Packer Metadata Footer (Requirement 11) */}
              <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-300">
                <span>ผู้แพ็ค: <strong className="text-slate-800">{packerName}</strong></span>
                <span>เวลาแพ็ค: <strong className="text-slate-800">{packedCompletedTime || selectedReq.date}</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShippingLabelModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" /> สั่งพิมพ์ป้ายติดกล่อง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
