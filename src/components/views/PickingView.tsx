import React, { useState, useEffect, useRef } from 'react';
import { useWMS } from '../../context/WMSContext';
import {
  CheckSquare,
  Search,
  Camera,
  Play,
  CheckCircle2,
  Navigation,
  MapPin,
  Sparkles,
  Layers,
  ArrowRight,
  Route,
  Clock,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Barcode,
  Package,
  Plus,
  Minus,
  Check,
  Info,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { WarehouseMap } from '../WarehouseMap';
import { normalizeBarcode, isBarcodeOrSkuMatch } from '../../utils/barcodeUtils';
import { soundManager } from '../../utils/soundUtils';
import confetti from 'canvas-confetti';

interface PickingViewProps {
  initialOrderId?: string;
  onNavigateToPacking?: () => void;
  onNavigateToRequisitions?: (reqId?: string) => void;
}

export const PickingView: React.FC<PickingViewProps> = ({
  initialOrderId,
  onNavigateToPacking,
  onNavigateToRequisitions,
}) => {
  const {
    pickingOrders,
    startPicking,
    confirmPickItemAndDeductStock,
    getProductBySku,
    activeUser,
    setActiveUser,
    users,
    kpis,
    barcodes,
    lookupBarcode,
  } = useWMS();

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    initialOrderId || pickingOrders[0]?.id || 'PICK-0001'
  );
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [strategyTab, setStrategyTab] = useState<'single' | 'batch'>('single');

  // Interactive Verification & Stock Deduction states (Requirements 6, 7, 8, 9, 10)
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [pickQtyInput, setPickQtyInput] = useState<number>(1);
  const [autoPickOnScan, setAutoPickOnScan] = useState<boolean>(true);
  const [scanPickMode, setScanPickMode] = useState<'FULL' | 'INCREMENT'>('FULL');
  const [verificationState, setVerificationState] = useState<'IDLE' | 'MATCHED' | 'MISMATCH' | 'SUCCESS'>('IDLE');
  const [verificationMessage, setVerificationMessage] = useState<string>('');
  const [lastDeduction, setLastDeduction] = useState<{
    stockBefore: number;
    stockAfter: number;
    pickedQty: number;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Requirement: นับเวลาในการหยิบ (Live Picking Stopwatch)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Sync when navigated from scanner with a specific order ID
  useEffect(() => {
    if (initialOrderId && initialOrderId !== selectedOrderId) {
      setSelectedOrderId(initialOrderId);
      setActiveItemIndex(0);
    }
  }, [initialOrderId, selectedOrderId]);

  const selectedOrder = pickingOrders.find((p) => p.id === selectedOrderId);
  const currentItem = selectedOrder?.items[activeItemIndex] || selectedOrder?.items[0];
  const targetProduct = currentItem ? getProductBySku(currentItem.sku) : undefined;

  // Track live picking duration in seconds
  useEffect(() => {
    if (!selectedOrder) {
      setElapsedSeconds(0);
      return;
    }

    if (selectedOrder.status === 'Picked') {
      setElapsedSeconds(selectedOrder.durationSeconds || 0);
      return;
    }

    if (selectedOrder.status === 'Pending') {
      setElapsedSeconds(0);
      return;
    }

    // Status is 'In Progress' - count live seconds
    const startMs =
      (selectedOrder as any).startTimeMs ||
      (selectedOrder.startTime ? Date.parse(selectedOrder.startTime) : null) ||
      Date.now();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startMs) / 1000));
      setElapsedSeconds(diff);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [
    selectedOrder?.id,
    selectedOrder?.status,
    (selectedOrder as any)?.startTimeMs,
    selectedOrder?.startTime,
    selectedOrder?.durationSeconds,
  ]);

  const formatPickingTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Reset state when switching items
  useEffect(() => {
    if (currentItem) {
      const alreadyPicked = currentItem.pickedQuantity ?? (currentItem.isPicked ? currentItem.quantity : 0);
      const remaining = Math.max(0, currentItem.quantity - alreadyPicked);
      setScannedCode('');
      setManualInput('');
      setPickQtyInput(remaining > 0 ? remaining : 1);
      setVerificationState(currentItem.isPicked ? 'SUCCESS' : 'IDLE');
      setVerificationMessage(currentItem.isPicked ? '✓ สินค้ารายการนี้หยิบครบและตัดสต็อกเรียบร้อยแล้ว' : '');
      setLastDeduction(null);
    }
  }, [selectedOrderId, activeItemIndex, currentItem?.id]);

  // Hardware Barcode Scanner (HID Keyboard Emulation Mode) for Mobile/Tablet/PDA
  useEffect(() => {
    let keyBuffer = '';
    let lastKeyTimestamp = 0;
    let autoFlushTimer: number | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const now = Date.now();
      const timeDiff = now - lastKeyTimestamp;
      lastKeyTimestamp = now;

      const isTerminator =
        e.key === 'Enter' ||
        e.key === 'Tab' ||
        e.code === 'Enter' ||
        e.code === 'NumpadEnter' ||
        e.keyCode === 13 ||
        e.keyCode === 9;

      if (isTerminator) {
        if (autoFlushTimer) {
          window.clearTimeout(autoFlushTimer);
          autoFlushTimer = null;
        }

        if (keyBuffer.length >= 2) {
          const barcode = normalizeBarcode(keyBuffer);
          keyBuffer = '';
          handleScanItemCode(barcode);
          if (isInput) e.preventDefault();
        }
        keyBuffer = '';
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 400 && !isInput) {
          keyBuffer = '';
        }
        keyBuffer += e.key;

        if (autoFlushTimer) {
          window.clearTimeout(autoFlushTimer);
        }

        // Auto-flush for scanner without suffix Enter
        autoFlushTimer = window.setTimeout(() => {
          if (keyBuffer.length >= 4 && timeDiff < 80) {
            const barcode = normalizeBarcode(keyBuffer);
            keyBuffer = '';
            handleScanItemCode(barcode);
          }
        }, 120);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (autoFlushTimer) window.clearTimeout(autoFlushTimer);
    };
  }, [selectedOrder, currentItem, activeItemIndex]);

  const handleStartPick = (orderId: string) => {
    const pickerUser = users.find((u) => u.name === 'นาย G' || u.role === 'Warehouse Staff') || users[0];
    setActiveUser(pickerUser);
    startPicking(orderId, pickerUser.name);
    setActiveItemIndex(0);
  };

  // Requirement 6, 9 & 10: Verify Scanned Barcode & Immediate Pick/Deduct
  const handleScanItemCode = (scanned: string) => {
    if (!selectedOrder) return;
    const rawScanned = scanned || '';
    const clean = normalizeBarcode(rawScanned) || rawScanned.trim().toUpperCase();
    if (!clean) return;

    // 1. Identify target item in this order
    // A) First check if the currently highlighted item matches
    let itemToPick = currentItem;
    let targetIndex = activeItemIndex;

    const currentProd = itemToPick ? getProductBySku(itemToPick.sku) : undefined;
    const isCurrentMatch = itemToPick && isBarcodeOrSkuMatch(
      clean,
      { sku: itemToPick.sku, barcode: currentProd?.barcode, name: itemToPick.productName },
      barcodes
    );

    // B) If current item doesn't match, search among any unpicked item in this order
    if (!isCurrentMatch) {
      const altIndex = selectedOrder.items.findIndex((it) => {
        if (it.isPicked) return false;
        const p = getProductBySku(it.sku);
        return isBarcodeOrSkuMatch(
          clean,
          { sku: it.sku, barcode: p?.barcode, name: it.productName },
          barcodes
        );
      });

      if (altIndex !== -1) {
        itemToPick = selectedOrder.items[altIndex];
        targetIndex = altIndex;
        setActiveItemIndex(altIndex);
      } else {
        // C) Check if it matches an item that was ALREADY picked
        const alreadyPicked = selectedOrder.items.find((it) => {
          const p = getProductBySku(it.sku);
          return isBarcodeOrSkuMatch(
            clean,
            { sku: it.sku, barcode: p?.barcode, name: it.productName },
            barcodes
          );
        });

        if (alreadyPicked) {
          soundManager.playSuccessBeep();
          setVerificationState('SUCCESS');
          setVerificationMessage(`✓ สินค้า ${alreadyPicked.productName} (${alreadyPicked.sku}) ในออเดอร์นี้ถูกหยิบครบแล้ว`);
          return;
        }

        // D) Check if it belongs to any product in warehouse
        const anyProd = lookupBarcode(clean).product || getProductBySku(clean);
        soundManager.playErrorBuzz();
        setVerificationState('MISMATCH');
        if (anyProd) {
          setVerificationMessage(`⚠ สินค้า "${anyProd.name}" (${anyProd.sku}) ไม่อยู่ในใบสั่งหยิบ ${selectedOrder.id}`);
        } else {
          setVerificationMessage(`⚠ ไม่พบบาร์โค้ด "${scanned}" ในระบบคลังสินค้า`);
        }
        return;
      }
    }

    if (!itemToPick) {
      soundManager.playErrorBuzz();
      setVerificationState('MISMATCH');
      setVerificationMessage(`⚠ ไม่พบสินค้า Barcode: "${scanned}" ในรายการคำสั่งหยิบนี้`);
      return;
    }

    const prod = getProductBySku(itemToPick.sku);

    // MATCH SUCCESSFUL!
    setScannedCode(scanned);

    if (autoPickOnScan) {
      // Direct Pick & Stock Deduction upon scanning
      const alreadyPicked = itemToPick.pickedQuantity ?? (itemToPick.isPicked ? itemToPick.quantity : 0);
      const remainingNeeded = Math.max(0, itemToPick.quantity - alreadyPicked);
      const qtyToPick = scanPickMode === 'INCREMENT' ? 1 : (remainingNeeded > 0 ? remainingNeeded : 1);

      const result = confirmPickItemAndDeductStock({
        pickId: selectedOrder.id,
        itemId: itemToPick.id,
        scannedBarcode: scanned,
        pickedQty: qtyToPick,
        operatorName: activeUser.name,
      });

      if (result.success) {
        setVerificationState('SUCCESS');
        setVerificationMessage(result.message);
        if (result.details) {
          setLastDeduction(result.details);
        }

        if (result.allCompleted) {
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        } else if (result.remainingQty === 0) {
          // If this item is now completely picked, move to the next unpicked item automatically
          setTimeout(() => {
            const nextIdx = selectedOrder.items.findIndex((it, idx) => idx !== targetIndex && !it.isPicked);
            if (nextIdx !== -1) {
              setActiveItemIndex(nextIdx);
            }
          }, 850);
        }
      } else {
        setVerificationState('MISMATCH');
        setVerificationMessage(result.message);
      }
    } else {
      // Manual confirmation mode: require pressing confirm button
      soundManager.playSuccessBeep();
      const alreadyPicked = itemToPick.pickedQuantity ?? (itemToPick.isPicked ? itemToPick.quantity : 0);
      const remaining = Math.max(0, itemToPick.quantity - alreadyPicked);
      setPickQtyInput(remaining > 0 ? remaining : 1);
      setVerificationState('MATCHED');
      setVerificationMessage('✓ Barcode ถูกต้อง สามารถกดปุ่มยืนยันเพื่อตัดสต็อกได้');
    }
  };

  // Requirement 10: Confirm Pick & Deduct Stock Real-time
  const handleConfirmPick = () => {
    if (!selectedOrder || !currentItem || !targetProduct) return;
    const code = scannedCode || targetProduct.barcode || currentItem.sku;

    const result = confirmPickItemAndDeductStock({
      pickId: selectedOrder.id,
      itemId: currentItem.id,
      scannedBarcode: code,
      pickedQty: pickQtyInput,
      operatorName: activeUser.name,
    });

    if (result.success) {
      setVerificationState('SUCCESS');
      setVerificationMessage(result.message);
      if (result.details) {
        setLastDeduction(result.details);
      }

      if (result.allCompleted) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } else if (result.remainingQty === 0) {
        // Automatically suggest moving to next unpicked item
        setTimeout(() => {
          const nextIndex = selectedOrder.items.findIndex((it, idx) => idx > activeItemIndex && !it.isPicked);
          if (nextIndex !== -1) {
            setActiveItemIndex(nextIndex);
          }
        }, 850);
      }
    } else {
      setVerificationState('MISMATCH');
      setVerificationMessage(result.message);
    }
  };

  // One-Click Pick & Deduct All Items in Order (Quick Fulfillment / Testing)
  const handlePickAllItems = () => {
    if (!selectedOrder) return;
    const unpicked = selectedOrder.items.filter((it) => !it.isPicked);
    if (unpicked.length === 0) {
      alert('ออเดอร์นี้จัดหยิบครบทุกชิ้นเรียบร้อยแล้ว');
      return;
    }

    unpicked.forEach((item) => {
      const prod = getProductBySku(item.sku);
      const code = prod?.barcode || item.sku;
      const alreadyPicked = item.pickedQuantity ?? 0;
      const needed = Math.max(0, item.quantity - alreadyPicked);
      confirmPickItemAndDeductStock({
        pickId: selectedOrder.id,
        itemId: item.id,
        scannedBarcode: code,
        pickedQty: needed > 0 ? needed : 1,
        operatorName: activeUser.name,
      });
    });

    soundManager.playSuccessBeep();
    confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    setVerificationState('SUCCESS');
    setVerificationMessage(`✓ หยิบครบทุกรายการในออเดอร์ ${selectedOrder.id} และตัดสต็อกเรียบร้อยแล้ว!`);
  };

  const nextUnpickedItem = selectedOrder?.items.find((it, idx) => idx !== activeItemIndex && !it.isPicked);

  return (
    <div className="space-y-6">
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
            {onNavigateToRequisitions && selectedOrder?.reqId && (
              <button
                type="button"
                onClick={() => onNavigateToRequisitions(selectedOrder.reqId)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                📄 ดูใบเบิก {selectedOrder.reqId}
              </button>
            )}
            {selectedOrder?.status === 'Picked' && onNavigateToPacking && (
              <button
                type="button"
                onClick={onNavigateToPacking}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                ไปหน้าแพ็กสินค้า (Packing Screen) ➔
              </button>
            )}
          </div>
        </div>

        {/* 3 Step Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => onNavigateToRequisitions && onNavigateToRequisitions(selectedOrder?.reqId)}
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 group-hover:bg-indigo-600 group-hover:text-white text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 transition-colors">
              1
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium block">ขั้นตอนที่ 1</span>
                <span className="text-[10px] text-indigo-400 font-bold group-hover:underline flex items-center gap-0.5">
                  กลับไปใบเบิก <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <span className="font-semibold text-slate-200 block truncate">
                {selectedOrder ? `ใบเบิก: ${selectedOrder.reqId}` : 'จัดการใบเบิกสินค้า'}
              </span>
            </div>
          </button>

          <div className="bg-indigo-600/30 border-2 border-indigo-400/90 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white font-black flex items-center justify-center text-xs shrink-0">
              2
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-indigo-300 font-bold block">ขั้นตอนที่ 2 (กำลังทำ)</span>
              <span className="font-bold text-white block truncate">
                ยิงบาร์โค้ดหยิบสินค้า & ตัดสต็อก Real-time
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToPacking && onNavigateToPacking()}
            className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-700 group-hover:bg-emerald-600 group-hover:text-white text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 transition-colors">
              3
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium block">ขั้นตอนที่ 3</span>
                <span className="text-[10px] text-emerald-400 font-bold group-hover:underline flex items-center gap-0.5">
                  ไปแพ็กสินค้า <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              <span className="font-semibold text-slate-200 block truncate">บรรจุหีบห่อ & จัดส่ง</span>
            </div>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-600" />
              ระบบจัดหยิบสินค้า & ยืนยันด้วย Barcode (Picking & Barcode Validation)
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              REAL-TIME STOCK
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            แนะนำ Location อัตโนมัติ • ตรวจสอบ 4 จุดก่อนหยิบ • ตัด Stock ทันทีพร้อมบันทึก Transaction
          </p>
        </div>

        {/* Picking Strategy Switcher */}
        <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
          <button
            onClick={() => setStrategyTab('single')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              strategyTab === 'single'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Single Order Picking
          </button>
          <button
            onClick={() => setStrategyTab('batch')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              strategyTab === 'batch'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Batch Picking (รวมออเดอร์)
          </button>
        </div>
      </div>

      {/* Live Picking Performance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>ความถูกต้อง (Accuracy)</span>
            <span className="text-[10px] text-emerald-700 font-bold">เป้า ≥99%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-indigo-900">{kpis.pickingAccuracy}%</span>
            <span className="text-[10px] text-emerald-600 font-bold">✓ ผ่านเกณฑ์</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>ความเร็ว (Productivity)</span>
            <span className="text-[10px] text-emerald-700 font-bold">เป้า ≥30 Ord/h</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-emerald-900">{kpis.pickingProductivity}</span>
            <span className="text-xs text-slate-500 font-mono">Orders/ชม.</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>เวลาต่อบิล (Avg Time)</span>
            <span className="text-[10px] text-emerald-700 font-bold">เป้า ≤2.0น.</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-blue-900">{kpis.pickingTimeMinutes}</span>
            <span className="text-xs text-slate-500">นาที/Order</span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Stock Out Rate</span>
            <span className="text-[10px] text-emerald-700 font-bold">เป้า ≤2%</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black font-mono text-teal-900">{kpis.stockOutRate || 0}%</span>
            <span className="text-xs text-slate-500">อัตราสินค้าขาด</span>
          </div>
        </div>
      </div>

      {/* Main Picking Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Orders List (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              รายการใบสั่งหยิบ (Picking Orders)
            </h3>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {pickingOrders.map((order) => {
                const isSelected = order.id === selectedOrderId;
                const pickedCount = order.items.filter((i) => i.isPicked).length;

                return (
                  <button
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setActiveItemIndex(0);
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-slate-900">{order.id}</span>
                        {order.status === 'In Progress' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                            <Clock className="w-2.5 h-2.5" /> LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {order.durationSeconds ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            ⏱ {Math.floor(order.durationSeconds / 60)}:{String(order.durationSeconds % 60).padStart(2, '0')}
                          </span>
                        ) : null}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.status === 'Picked'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1">
                      ใบเบิกเลขที่: <span className="font-mono font-medium text-slate-700">{order.reqId}</span> • ผู้หยิบ: {order.pickerName}
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-500">
                        หยิบแล้ว: <strong className="text-slate-800 font-mono">{pickedCount} / {order.items.length}</strong>
                      </span>
                      <span className="font-mono text-indigo-600 font-semibold">
                        ระยะทาง: {order.totalDistanceMeters}m
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Active Order Details, Mobile Handheld Terminal & Map (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedOrder ? (
            <>
              {/* Top Order Overview Banner (Requirement 5) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-extrabold text-base text-slate-900">
                      Picking No. {selectedOrder.id}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigateToRequisitions && onNavigateToRequisitions(selectedOrder.reqId)}
                      className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      ใบเบิก: {selectedOrder.reqId} ↗
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ผู้จัดหยิบ: <span className="font-semibold text-slate-800">{selectedOrder.pickerName}</span> • กลยุทธ์: {selectedOrder.strategy}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedOrder.status === 'Pending' && (
                    <button
                      onClick={() => handleStartPick(selectedOrder.id)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> เริ่มจัดหยิบสินค้า (Start Picking)
                    </button>
                  )}

                  {!selectedOrder.items.every((i) => i.isPicked) && (
                    <button
                      type="button"
                      onClick={handlePickAllItems}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                      title="กดเพื่อหยิบสินค้าทุกรายการและตัดสต็อกอัตโนมัติ"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" /> หยิบครบทุกชิ้นทันที (Auto-Pick All)
                    </button>
                  )}

                  {selectedOrder.status === 'Picked' && onNavigateToPacking && (
                    <button
                      onClick={onNavigateToPacking}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> ส่งไปยังโต๊ะ Packing & ออกใบส่งของ
                    </button>
                  )}
                </div>
              </div>

              {/* Requirement 2: นับเวลาในการหยิบ (Live Picking Stopwatch & KPI Benchmark Card) */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  selectedOrder.status === 'In Progress'
                    ? 'bg-linear-to-r from-slate-950 via-indigo-950 to-slate-900 text-white border-indigo-500/50 shadow-md'
                    : selectedOrder.status === 'Picked'
                    ? 'bg-linear-to-r from-slate-950 via-emerald-950 to-slate-900 text-white border-emerald-500/50 shadow-md'
                    : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Digital Clock Display */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`flex items-center justify-center w-13 h-13 rounded-xl border shadow-inner ${
                        selectedOrder.status === 'In Progress'
                          ? 'bg-indigo-900/60 border-indigo-400/40'
                          : selectedOrder.status === 'Picked'
                          ? 'bg-emerald-900/60 border-emerald-400/40'
                          : 'bg-slate-100 border-slate-200'
                      }`}
                    >
                      <Clock
                        className={`w-6 h-6 ${
                          selectedOrder.status === 'In Progress'
                            ? 'text-amber-400 animate-spin'
                            : selectedOrder.status === 'Picked'
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                        style={selectedOrder.status === 'In Progress' ? { animationDuration: '4s' } : undefined}
                      />
                    </div>

                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                          selectedOrder.status === 'Pending' ? 'text-slate-800' : 'text-white'
                        }`}>
                          {formatPickingTimer(elapsedSeconds)}
                        </span>
                        <span className={`text-xs font-mono ${
                          selectedOrder.status === 'Pending' ? 'text-slate-500' : 'text-slate-300'
                        }`}>
                          ({elapsedSeconds} วินาที)
                        </span>

                        {selectedOrder.status === 'In Progress' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping"></span>
                            กำลังนับเวลาหยิบจริง (LIVE TIMER)
                          </span>
                        )}
                        {selectedOrder.status === 'Picked' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            จัดหยิบเสร็จสมบูรณ์ (บันทึกเวลาแล้ว)
                          </span>
                        )}
                        {selectedOrder.status === 'Pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            รอเริ่มจับเวลา
                          </span>
                        )}
                      </div>

                      <div className={`text-xs mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 ${
                        selectedOrder.status === 'Pending' ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        <span>เริ่มนับเวลา: <strong className="font-mono">{selectedOrder.startTime || 'ยังไม่เริ่ม'}</strong></span>
                        {selectedOrder.completedAt && (
                          <span>เสร็จสิ้นเมื่อ: <strong className="font-mono text-emerald-300">{selectedOrder.completedAt}</strong></span>
                        )}
                        <span>เกณฑ์ KPI ต่อบิล: <strong className="text-emerald-400">≤ 2.00 นาที (120 วินาที)</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Benchmark Progress Meter */}
                  <div className={`min-w-[220px] flex-1 max-w-xs p-3 rounded-lg border ${
                    selectedOrder.status === 'Pending'
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-white/5 border-white/10 text-white'
                  }`}>
                    <div className="flex justify-between items-center text-[11px] mb-1.5">
                      <span className="font-semibold">ความเร็วเทียบเกณฑ์ KPI</span>
                      <span
                        className={`font-bold ${
                          selectedOrder.status === 'Pending'
                            ? 'text-slate-500'
                            : elapsedSeconds <= 120
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {selectedOrder.status === 'Pending'
                          ? 'รอเริ่มจัดหยิบ'
                          : elapsedSeconds <= 120
                          ? '⚡ อยู่ในเกณฑ์มาตรฐาน'
                          : '⏱ เกินเป้าหมาย 2 นาที'}
                      </span>
                    </div>

                    <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${
                          selectedOrder.status === 'Pending'
                            ? 'bg-slate-400'
                            : elapsedSeconds <= 90
                            ? 'bg-emerald-400'
                            : elapsedSeconds <= 120
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        style={{
                          width: `${
                            selectedOrder.status === 'Pending'
                              ? 0
                              : Math.min(100, Math.max(6, (elapsedSeconds / 120) * 100))
                          }%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span>0s</span>
                      <span>60s (1น.)</span>
                      <span>120s (เป้า KPI)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items Quick Strip Selector */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    รายการที่ต้องหยิบในออเดอร์นี้ (แตะเพื่อสลับรายการ):
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    หยิบแล้ว{' '}
                    <strong className="text-emerald-700">
                      {selectedOrder.items.filter((i) => i.isPicked).length}
                    </strong>{' '}
                    / {selectedOrder.items.length} รายการ
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {selectedOrder.items.map((item, idx) => {
                    const isCurrent = idx === activeItemIndex;
                    const picked = item.pickedQuantity ?? (item.isPicked ? item.quantity : 0);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveItemIndex(idx)}
                        className={`px-3 py-2 rounded-xl text-left text-xs whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                          item.isPicked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            : isCurrent
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-bold ring-2 ring-indigo-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-4 h-4 rounded-full text-[10px] inline-flex items-center justify-center font-black ${
                            item.isPicked
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? 'bg-white text-indigo-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {item.isPicked ? '✓' : idx + 1}
                          </span>
                          <span className="font-mono text-[11px]">{item.sku}</span>
                          <span className="text-[10px] opacity-80">★ {item.location}</span>
                        </div>
                        <div className="text-[10px] opacity-90 mt-0.5 truncate max-w-[130px]">
                          {item.productName} ({picked}/{item.quantity})
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Handheld Terminal Card (Requirements 6, 7, 8, 9, 10) */}
              {currentItem ? (
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-700 space-y-4 relative overflow-hidden">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Barcode className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">
                        SMART PICKING TERMINAL
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      รายการที่ {activeItemIndex + 1} จาก {selectedOrder.items.length}
                    </div>
                  </div>

                  {/* Next Location Walking Guide */}
                  {nextUnpickedItem && !currentItem.isPicked && (
                    <div className="flex items-center justify-between bg-amber-500/15 border border-amber-400/40 rounded-xl px-3.5 py-2 text-xs text-amber-200">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300 flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5" /> พิกัดถัดไปตามแผนที่:
                        </span>
                        <span className="font-mono font-black text-amber-100 bg-amber-900/60 px-2 py-0.5 rounded border border-amber-500/40">
                          {nextUnpickedItem.location} (Zone {nextUnpickedItem.zone})
                        </span>
                        <span className="text-slate-300 truncate max-w-xs">{nextUnpickedItem.productName}</span>
                      </div>
                      <span className="text-[11px] text-amber-400 font-mono">ประหยัดระยะทางเดิน</span>
                    </div>
                  )}

                  {/* Location & Product Display (Requirement 5 & 8) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Big Location Highlight (Requirement 8) */}
                    <div className="md:col-span-5 bg-slate-950/80 rounded-xl p-4 border border-amber-500/30 text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                        ★ แนะนำ LOCATION ให้ไปหยิบสินค้า
                      </span>
                      <div className="text-3xl sm:text-4xl font-black font-mono text-amber-300 tracking-wider">
                        {currentItem.location}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-1">
                        Zone {currentItem.zone} ({currentItem.zone === 'A' ? 'Fast' : currentItem.zone === 'B' ? 'Medium' : 'Slow'} Moving)
                      </span>
                    </div>

                    {/* Product & Quantity details (Requirement 5 & 8) */}
                    <div className="md:col-span-7 space-y-2 bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">SKU:</span>
                        <span className="font-mono font-bold text-white text-sm">{currentItem.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Barcode สินค้า:</span>
                        <span className="font-mono font-semibold text-emerald-300">{targetProduct?.barcode || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ชื่อสินค้า:</span>
                        <span className="font-semibold text-slate-100">{currentItem.productName}</span>
                      </div>
                      {(() => {
                        const currentPicked = currentItem.pickedQuantity ?? (currentItem.isPicked ? currentItem.quantity : 0);
                        const remaining = Math.max(0, currentItem.quantity - currentPicked);
                        const progressPct = Math.min(100, Math.round((currentPicked / currentItem.quantity) * 100));
                        return (
                          <div className="space-y-1.5 pt-2 border-t border-slate-700">
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="bg-slate-900/80 p-1.5 rounded">
                                <span className="text-[10px] text-slate-400 block">ต้องหยิบ</span>
                                <strong className="text-sm font-mono text-white">{currentItem.quantity} {currentItem.unit}</strong>
                              </div>
                              <div className="bg-slate-900/80 p-1.5 rounded border border-emerald-500/30">
                                <span className="text-[10px] text-emerald-300 block font-semibold">หยิบแล้ว</span>
                                <strong className="text-sm font-mono text-emerald-400">
                                  {currentPicked} {currentItem.unit}
                                </strong>
                              </div>
                              <div className="bg-slate-900/80 p-1.5 rounded border border-amber-500/30">
                                <span className="text-[10px] text-amber-300 block font-semibold">คงเหลือที่ต้องหยิบ</span>
                                <strong className="text-sm font-mono text-amber-400">
                                  {remaining} {currentItem.unit}
                                </strong>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                      <div className="text-[11px] text-slate-400 flex justify-between pt-1">
                        <span>สต็อกคงเหลือในระบบ:</span>
                        <span className="font-mono font-bold text-indigo-300">
                          {targetProduct?.currentStock ?? 0} {currentItem.unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Pick & Deduct on Scan Toggle Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoPickOnScan}
                        onChange={(e) => setAutoPickOnScan(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900 cursor-pointer"
                      />
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        ยิงบาร์โค้ดแล้วหยิบ & ตัด Stock ทันที (Auto Pick & Deduct on Scan)
                      </span>
                    </label>

                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-400 mr-1">โหมดการหยิบ:</span>
                      <button
                        type="button"
                        onClick={() => setScanPickMode('FULL')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                          scanPickMode === 'FULL'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ยิงครั้งเดียวหยิบครบ
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanPickMode('INCREMENT')}
                        className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                          scanPickMode === 'INCREMENT'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ยิงทีละ 1 ชิ้น (+1)
                      </button>
                    </div>
                  </div>

                  {/* Verification & Scanning Banner (Requirements 6, 7, 9) */}
                  {verificationState === 'MATCHED' && (
                    <div className="bg-emerald-950/80 border border-emerald-500/60 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>✓ Barcode ถูกต้อง สามารถหยิบสินค้าได้</span>
                      </div>

                      {/* 4 Checks Status (Requirement 9) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
                        <div className="bg-emerald-900/30 p-2 rounded border border-emerald-600/30">
                          <span className="text-emerald-400 font-bold">1. Barcode:</span> ถูกต้อง
                        </div>
                        <div className="bg-emerald-900/30 p-2 rounded border border-emerald-600/30">
                          <span className="text-emerald-400 font-bold">2. SKU:</span> ถูกต้อง ({currentItem.sku})
                        </div>
                        <div className="bg-emerald-900/30 p-2 rounded border border-emerald-600/30">
                          <span className="text-emerald-400 font-bold">3. Location:</span> ถูกต้อง ({currentItem.location})
                        </div>
                        <div className="bg-emerald-900/30 p-2 rounded border border-emerald-600/30">
                          <span className="text-emerald-400 font-bold">4. สต็อก:</span> เพียงพอ ({targetProduct?.currentStock} ชิ้น)
                        </div>
                      </div>

                      {/* Quantity Input and Confirm Button (Requirements 6 & 10) */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                          <span className="text-xs text-slate-400">จำนวนที่หยิบ:</span>
                          <button
                            type="button"
                            onClick={() => setPickQtyInput((q) => Math.max(1, q - 1))}
                            className="p-1 hover:bg-slate-800 rounded text-slate-300"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            value={pickQtyInput}
                            onChange={(e) => setPickQtyInput(Math.max(1, Number(e.target.value)))}
                            className="w-14 bg-slate-800 text-center font-mono font-bold text-white text-sm py-1 rounded border border-slate-600 focus:outline-hidden"
                            min={1}
                            max={targetProduct?.currentStock || currentItem.quantity}
                          />
                          <button
                            type="button"
                            onClick={() => setPickQtyInput((q) => Math.min(targetProduct?.currentStock || 999, q + 1))}
                            className="p-1 hover:bg-slate-800 rounded text-slate-300"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs text-slate-400">{currentItem.unit}</span>
                        </div>

                        <button
                          onClick={handleConfirmPick}
                          className="w-full sm:w-auto flex-1 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm rounded-xl tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                          <Check className="w-4 h-4 stroke-[3]" /> ยืนยันการหยิบ & ตัด Stock ทันที
                        </button>
                      </div>
                    </div>
                  )}

                  {verificationState === 'MISMATCH' && (
                    <div className="bg-rose-950/80 border border-rose-500/60 p-4 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-rose-300 text-sm font-bold">
                          {verificationMessage || '⚠ Barcode ไม่ตรงกับรายการที่กำลังหยิบ'}
                        </strong>
                        <p className="text-xs text-rose-200 mt-1">
                          ระบบความปลอดภัย: ไม่อนุญาตให้ยืนยันการหยิบจนกว่าจะสแกน Barcode สินค้าที่ถูกต้อง
                        </p>
                      </div>
                    </div>
                  )}

                  {verificationState === 'SUCCESS' && (
                    <div className="bg-emerald-950/70 border border-emerald-500/50 p-4 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-emerald-300 font-bold text-xs">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> หยิบและตัดสต็อกเรียบร้อยแล้ว (Real-time Stock Deducted)
                        </span>
                        <span className="font-mono text-emerald-400">STATUS: PICKED</span>
                      </div>
                      {lastDeduction && (
                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-emerald-800/40 text-xs font-mono text-slate-300 flex items-center justify-between">
                          <span>ก่อนหยิบ: <strong className="text-white">{lastDeduction.stockBefore}</strong></span>
                          <span>ตัดหยิบ: <strong className="text-amber-400">-{lastDeduction.pickedQty}</strong></span>
                          <span>คงเหลือหลังหยิบ: <strong className="text-emerald-400">{lastDeduction.stockAfter}</strong> {currentItem.unit}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Barcode Input / HID Receiver Box */}
                  {!currentItem.isPicked && (
                    <div className="space-y-3 pt-1">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            ref={barcodeInputRef}
                            type="text"
                            placeholder="สแกน Barcode หรือพิมพ์ SKU แล้วกด Enter..."
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleScanItemCode(manualInput);
                                setManualInput('');
                              }
                            }}
                            className="w-full bg-slate-800/90 text-white placeholder-slate-400 px-4 py-2.5 rounded-xl border border-slate-600 focus:outline-hidden focus:border-indigo-400 text-xs font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (manualInput) {
                              handleScanItemCode(manualInput);
                              setManualInput('');
                            }
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
                        >
                          ตรวจสอบ
                        </button>
                      </div>

                      {/* Quick Action Simulation Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleScanItemCode(targetProduct?.barcode || currentItem.sku)}
                          className="py-3 px-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <Zap className="w-4 h-4 fill-current" /> ยิงหยิบชิ้นนี้ทันที ({currentItem.quantity} {currentItem.unit})
                        </button>

                        <button
                          type="button"
                          onClick={() => setScannerOpen(true)}
                          className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                        >
                          <Camera className="w-4 h-4" /> เปิดกล้องสแกน Barcode
                        </button>

                        <button
                          type="button"
                          onClick={() => handleScanItemCode('PEN-WRONG-999')}
                          className="py-3 px-3 bg-rose-950/80 hover:bg-rose-900 text-rose-300 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-800/50"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400" /> ทดสอบสแกนผิด
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Order Complete Celebration Banner */}
                  {selectedOrder.items.every((it) => it.isPicked) && (
                    <div className="bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl p-4 text-center space-y-2">
                      <div className="text-emerald-300 font-black text-base flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        🎉 จัดหยิบสินค้าครบทุกชิ้นเรียบร้อยแล้ว! (All Items Picked)
                      </div>
                      <p className="text-xs text-slate-300">
                        สต็อกถูกตัดออกจากระบบทันทีแล้ว สามารถส่งต่อไปยังขั้นตอนบรรจุหีบห่อ (Packing)
                      </p>
                      {onNavigateToPacking && (
                        <button
                          type="button"
                          onClick={onNavigateToPacking}
                          className="mt-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg inline-flex items-center gap-2 cursor-pointer transition-all active:scale-98"
                        >
                          ขั้นตอนถัดไป: ไปหน้าแพ็กสินค้า & พิมพ์ใบปะหน้า ➔
                        </button>
                      )}
                    </div>
                  )}

                  {/* Progress Dots */}
                  <div className="flex justify-center gap-2 pt-3 border-t border-slate-800">
                    {selectedOrder.items.map((it, idx) => (
                      <button
                        key={it.id}
                        onClick={() => setActiveItemIndex(idx)}
                        className={`w-3.5 h-3.5 rounded-full transition-all cursor-pointer ${
                          it.isPicked
                            ? 'bg-emerald-500 ring-2 ring-emerald-300'
                            : idx === activeItemIndex
                            ? 'bg-amber-400 ring-2 ring-amber-200 scale-125'
                            : 'bg-slate-700 hover:bg-slate-600'
                        }`}
                        title={`${it.productName} (${it.location})`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-100 rounded-xl text-slate-500 text-xs">
                  ไม่มีรายการสินค้าในใบสั่งหยิบนี้
                </div>
              )}

              {/* Items Checklist within Order (Requirement 5) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    ลำดับรายการหยิบตามเส้นทางเดินที่สั้นที่สุด (Picking List & Route)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ระยะทางรวม: <strong className="text-slate-800">{selectedOrder.totalDistanceMeters} เมตร</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">ลำดับ</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">ชื่อสินค้า</th>
                        <th className="py-2.5 px-3">Location แนะนำ</th>
                        <th className="py-2.5 px-3 text-right">ต้องหยิบ</th>
                        <th className="py-2.5 px-3 text-right">หยิบแล้ว</th>
                        <th className="py-2.5 px-3 text-right">คงเหลือ</th>
                        <th className="py-2.5 px-3 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((item, idx) => {
                        const isCurrent = idx === activeItemIndex;
                        const picked = item.pickedQuantity ?? (item.isPicked ? item.quantity : 0);
                        const remaining = Math.max(0, item.quantity - picked);

                        return (
                          <tr
                            key={item.id}
                            onClick={() => setActiveItemIndex(idx)}
                            className={`cursor-pointer transition-colors ${
                              item.isPicked
                                ? 'bg-emerald-50/50 hover:bg-emerald-50'
                                : isCurrent
                                ? 'bg-amber-50 font-medium'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono">
                              <span
                                className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                                  item.isPicked
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {item.isPicked ? '✓' : idx + 1}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{item.sku}</td>
                            <td className="py-2.5 px-3 text-slate-800">{item.productName}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                              ★ {item.location} <span className="text-[10px] text-slate-400 font-normal">(Z-{item.zone})</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                              {picked}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-600 font-semibold">
                              {remaining}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.isPicked ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  ✓ หยิบครบแล้ว
                                </span>
                              ) : picked > 0 ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                  กำลังหยิบ ({picked}/{item.quantity})
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  รอหยิบ
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2D Warehouse Floor Map with Current Route */}
              <WarehouseMap
                activeRoute={selectedOrder.route}
                highlightLocation={currentItem?.location}
              />

              {/* Barcode Scanner Modal */}
              <BarcodeScannerModal
                isOpen={scannerOpen}
                onClose={() => setScannerOpen(false)}
                expectedSku={currentItem?.sku}
                expectedQty={currentItem?.quantity}
                onScanSuccess={(code) => {
                  setScannerOpen(false);
                  handleScanItemCode(code);
                }}
              />
            </>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              เลือกใบสั่งหยิบจากรายการด้านซ้ายเพื่อดูรายละเอียด
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
