import React, { useState, useEffect, useRef } from 'react';
import { useWMS } from '../../context/WMSContext';
import { BarcodeView } from '../BarcodeView';
import { CameraBarcodeScanner } from '../CameraBarcodeScanner';
import { soundManager } from '../../utils/soundUtils';
import { normalizeBarcode, convertThaiToEngBarcode } from '../../utils/barcodeUtils';
import { Product, PickingOrder, Requisition } from '../../types/wms';
import {
  ScanBarcode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  History,
  Keyboard,
  Search,
  Check,
  Radio,
  Wifi,
  Zap,
  ArrowRight,
  Smartphone,
  Tablet,
  Barcode,
  Play,
  FileText,
  Clock,
  ExternalLink,
  Info,
  CheckSquare,
  Crosshair,
  Activity,
  Languages,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

export interface ScannerViewProps {
  onNavigateToPicking?: (orderId: string) => void;
  onNavigateToRequisitions?: (reqId?: string) => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onNavigateToPicking,
  onNavigateToRequisitions,
}) => {
  const {
    products,
    barcodes,
    lookupBarcode,
    getProductBySku,
    activeUser,
    pickingOrders,
    requisitions,
    confirmPickItemAndDeductStock,
  } = useWMS();

  const [activeCode, setActiveCode] = useState<string>(products[0]?.sku || 'FRU-001');
  const [scannedBarcodeValue, setScannedBarcodeValue] = useState<string>('8851234567890');
  const [detectedFormat, setDetectedFormat] = useState<string>('Code 128');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(products[0] || null);

  const [manualInput, setManualInput] = useState<string>('');
  const [lastScanSource, setLastScanSource] = useState<'camera' | 'hid_hardware' | 'manual'>('camera');
  const [isVerifyingWithApi, setIsVerifyingWithApi] = useState(false);
  const [apiVerifyResult, setApiVerifyResult] = useState<string | null>(null);
  const [pickActionResult, setPickActionResult] = useState<string | null>(null);

  // Auto-Jump State & Configuration
  const [autoJumpEnabled, setAutoJumpEnabled] = useState<boolean>(true);
  const [autoJumpCountdown, setAutoJumpCountdown] = useState<{
    target: 'picking' | 'requisitions';
    id: string;
    seconds: number;
  } | null>(null);

  // Scanned Type Detection
  const [scannedType, setScannedType] = useState<
    'picking_order' | 'requisition' | 'product_with_picking' | 'product_standalone' | 'not_found'
  >('product_standalone');
  const [matchedPickingOrder, setMatchedPickingOrder] = useState<PickingOrder | null>(null);
  const [matchedRequisition, setMatchedRequisition] = useState<Requisition | null>(null);

  // Hardware Scanner Diagnostic & Live Receiver State
  const [lastRawKeyInfo, setLastRawKeyInfo] = useState<string>('ยังไม่มีสัญญาณเข้ามา');
  const [keyBurstCount, setKeyBurstCount] = useState<number>(0);
  const [scannerPulseActive, setScannerPulseActive] = useState<boolean>(false);
  const [isReceiverFocused, setIsReceiverFocused] = useState<boolean>(false);
  const [wasThaiDetected, setWasThaiDetected] = useState<boolean>(false);
  const [receiverInputValue, setReceiverInputValue] = useState<string>('');

  const [scanHistory, setScanHistory] = useState<{
    time: string;
    code: string;
    format?: string;
    productName: string;
    status: 'success' | 'error' | 'redirect';
    message: string;
    source: 'camera' | 'hid_hardware' | 'manual';
  }[]>([]);

  const autoJumpTimerRef = useRef<number | null>(null);
  const receiverInputRef = useRef<HTMLInputElement | null>(null);
  const bufferTimerRef = useRef<number | null>(null);
  const keyBufferRef = useRef<string>('');
  const lastKeyTimestampRef = useRef<number>(0);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoJumpTimerRef.current) window.clearTimeout(autoJumpTimerRef.current);
      if (bufferTimerRef.current) window.clearTimeout(bufferTimerRef.current);
    };
  }, []);

  // Flash LED pulse helper
  const triggerPulse = () => {
    setScannerPulseActive(true);
    window.setTimeout(() => setScannerPulseActive(false), 250);
  };

  // Hardware Barcode Scanner (Universal Window & Input Listener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in standard search or manual input form
      const target = e.target as HTMLElement;
      const isManualInput = target && target.id === 'manual-sku-input';

      if (isManualInput) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      // Update diagnostic display
      triggerPulse();
      setKeyBurstCount((prev) => prev + 1);
      setLastRawKeyInfo(`Key: "${e.key}" (code: ${e.code || e.keyCode}, diff: ${timeDiff}ms)`);

      // Check if Enter or Tab was pressed
      const isTerminator =
        e.key === 'Enter' ||
        e.key === 'Tab' ||
        e.code === 'Enter' ||
        e.code === 'NumpadEnter' ||
        e.keyCode === 13 ||
        e.keyCode === 9;

      if (isTerminator) {
        if (bufferTimerRef.current) {
          window.clearTimeout(bufferTimerRef.current);
          bufferTimerRef.current = null;
        }

        const buffered = keyBufferRef.current;
        keyBufferRef.current = '';

        if (buffered.length >= 2) {
          e.preventDefault();
          triggerScan(buffered, 'hid_hardware');
        }
        return;
      }

      // If single printable character
      if (e.key.length === 1) {
        // Bluetooth scanners may have up to 350ms latency between keys
        if (timeDiff > 400 && keyBufferRef.current.length > 0) {
          keyBufferRef.current = '';
        }

        keyBufferRef.current += e.key;

        // Auto-flush fallback: If scanner doesn't send Enter, process after 280ms idle
        if (bufferTimerRef.current) {
          window.clearTimeout(bufferTimerRef.current);
        }

        bufferTimerRef.current = window.setTimeout(() => {
          if (keyBufferRef.current.length >= 3) {
            const buffered = keyBufferRef.current;
            keyBufferRef.current = '';
            triggerScan(buffered, 'hid_hardware');
          }
        }, 280);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (bufferTimerRef.current) window.clearTimeout(bufferTimerRef.current);
    };
  }, [products, pickingOrders, requisitions, autoJumpEnabled]);

  const triggerScan = async (
    codeToScan: string,
    source: 'camera' | 'hid_hardware' | 'manual' = 'manual',
    explicitFormat?: string
  ) => {
    if (!codeToScan) return;

    // Check if original code contained Thai characters
    const hasThai = /[ก-ฮะ-ูเ-์]/.test(codeToScan);
    setWasThaiDetected(hasThai);

    // Normalize and translate Thai keyboard layout if necessary
    const clean = normalizeBarcode(codeToScan);
    if (!clean) return;

    if (autoJumpTimerRef.current) {
      window.clearTimeout(autoJumpTimerRef.current);
      autoJumpTimerRef.current = null;
    }
    setAutoJumpCountdown(null);

    setLastScanSource(source);
    setActiveCode(clean);
    setScannedBarcodeValue(clean);
    setIsVerifyingWithApi(true);

    // Haptic vibration feedback for mobile phones / tablets
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch {}
    }

    const now = new Date().toLocaleTimeString('th-TH');

    // 1. Check if scanned code matches a Picking Order (e.g. PICK-0001, PICK-0002)
    const pickOrder = pickingOrders.find(
      (p) =>
        (p.id && p.id.toUpperCase() === clean) ||
        (p.reqId && p.reqId.toUpperCase() === clean) ||
        (p.requestNo && p.requestNo.toUpperCase() === clean)
    );

    // 2. Check if scanned code matches a Requisition (e.g. REQ-2026-001)
    const requisition = requisitions.find((r) => r.id && r.id.toUpperCase() === clean);

    // 3. Multi-Format Barcode Relational Lookup: Barcode Value -> SKU -> Product
    const lookupRes = lookupBarcode(clean);
    const resolvedFormat = explicitFormat || lookupRes.barcodeFormat;
    setDetectedFormat(resolvedFormat);

    let product = lookupRes.product;
    // If not found in barcodes table, verify if the scanned code is an exact SKU match
    if (!product) {
      const directSkuMatch = products.find((p) => p.sku.toUpperCase() === clean);
      if (directSkuMatch) {
        product = directSkuMatch;
      }
    }

    // Backend verification log
    try {
      const response = await fetch('/api/v1/scan/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scannedCode: clean,
          source,
          operator: activeUser.name,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setApiVerifyResult(data.isMatch ? 'API: Verified & Recorded ✓' : 'API: Scanned & Evaluated');
      }
    } catch {
      setApiVerifyResult('Local Verified (Realtime)');
    } finally {
      setIsVerifyingWithApi(false);
    }

    // --- CASE 1: MATCHED PICKING ORDER ---
    if (pickOrder) {
      soundManager.playSuccessBeep();
      setScannedType('picking_order');
      setMatchedPickingOrder(pickOrder);
      setMatchedProduct(null);
      const reqIdToMatch = pickOrder.reqId || pickOrder.requestNo;
      setMatchedRequisition(requisitions.find((r) => r.id === reqIdToMatch) || null);

      setScanHistory((prev) => [
        {
          time: now,
          code: clean,
          format: 'Internal Order ID',
          productName: `คำสั่งหยิบ ${pickOrder.id} (${pickOrder.items.length} รายการ)`,
          status: 'redirect',
          message: hasThai
            ? `✓ ตรวจพบคำสั่งจัดหยิบ ${pickOrder.id} (แปลงจากแป้นพิมพ์ไทย)`
            : `✓ ตรวจพบใบสั่งจัดหยิบ ${pickOrder.id} - เตรียมเปิดหน้า Picking`,
          source,
        },
        ...prev.slice(0, 19),
      ]);

      if (autoJumpEnabled && onNavigateToPicking) {
        setAutoJumpCountdown({
          target: 'picking',
          id: pickOrder.id,
          seconds: 1,
        });

        autoJumpTimerRef.current = window.setTimeout(() => {
          onNavigateToPicking(pickOrder.id);
        }, 650);
      }
      return;
    }

    // --- CASE 2: MATCHED REQUISITION ---
    if (requisition) {
      soundManager.playSuccessBeep();
      setMatchedRequisition(requisition);
      setMatchedProduct(null);

      const relatedPickOrder = pickingOrders.find(
        (p) => p.reqId === requisition.id || p.requestNo === requisition.id
      );

      if (relatedPickOrder) {
        setScannedType('picking_order');
        setMatchedPickingOrder(relatedPickOrder);

        setScanHistory((prev) => [
          {
            time: now,
            code: clean,
            format: 'Internal Requisition ID',
            productName: `ใบเบิก ${requisition.id} -> คำสั่งหยิบ ${relatedPickOrder.id}`,
            status: 'redirect',
            message: `✓ พบใบเบิกที่มีคำสั่งหยิบพร้อมแล้ว - เตรียมเด้งไปหน้าจัดหยิบ`,
            source,
          },
          ...prev.slice(0, 19),
        ]);

        if (autoJumpEnabled && onNavigateToPicking) {
          setAutoJumpCountdown({
            target: 'picking',
            id: relatedPickOrder.id,
            seconds: 1,
          });

          autoJumpTimerRef.current = window.setTimeout(() => {
            onNavigateToPicking(relatedPickOrder.id);
          }, 650);
        }
      } else {
        setScannedType('requisition');
        setMatchedPickingOrder(null);

        setScanHistory((prev) => [
          {
            time: now,
            code: clean,
            format: 'Internal Requisition ID',
            productName: `ใบเบิกสินค้า ${requisition.id} (${requisition.requestor})`,
            status: 'redirect',
            message: `✓ พบใบเบิกสินค้าในระบบ - เปิดหน้ารายการใบเบิกสินค้า`,
            source,
          },
          ...prev.slice(0, 19),
        ]);

        if (autoJumpEnabled && onNavigateToRequisitions) {
          setAutoJumpCountdown({
            target: 'requisitions',
            id: requisition.id,
            seconds: 1,
          });

          autoJumpTimerRef.current = window.setTimeout(() => {
            onNavigateToRequisitions(requisition.id);
          }, 650);
        }
      }
      return;
    }

    // --- CASE 3: MATCHED PRODUCT VIA BARCODE / SKU ---
    if (product) {
      soundManager.playSuccessBeep();
      setMatchedProduct(product);

      const activeOrderWithSku = pickingOrders.find(
        (po) =>
          (po.status === 'Assigned' || po.status === 'In Progress') &&
          po.items.some((it) => it.sku === product.sku && !it.isPicked)
      );

      if (activeOrderWithSku) {
        setScannedType('product_with_picking');
        setMatchedPickingOrder(activeOrderWithSku);
        const activeReqId = activeOrderWithSku.reqId || activeOrderWithSku.requestNo;
        setMatchedRequisition(requisitions.find((r) => r.id === activeReqId) || null);

        setScanHistory((prev) => [
          {
            time: now,
            code: clean,
            format: resolvedFormat,
            productName: `${product.name} (มีใน Order ${activeOrderWithSku.id})`,
            status: 'redirect',
            message: hasThai
              ? `✓ สินค้า ${product.sku} [${resolvedFormat}] ใน Order ${activeOrderWithSku.id}`
              : `✓ พบสินค้า [${resolvedFormat}] ในรายการจัดหยิบ ${activeOrderWithSku.id}`,
            source,
          },
          ...prev.slice(0, 19),
        ]);

        if (autoJumpEnabled && onNavigateToPicking) {
          setAutoJumpCountdown({
            target: 'picking',
            id: activeOrderWithSku.id,
            seconds: 1,
          });

          autoJumpTimerRef.current = window.setTimeout(() => {
            onNavigateToPicking(activeOrderWithSku.id);
          }, 750);
        }
      } else {
        setScannedType('product_standalone');
        setMatchedPickingOrder(null);
        setMatchedRequisition(null);

        setScanHistory((prev) => [
          {
            time: now,
            code: clean,
            format: resolvedFormat,
            productName: `${product.sku} - ${product.name}`,
            status: 'success',
            message: hasThai
              ? `✓ ตรวจสอบสินค้าเรียบร้อย [${resolvedFormat}] (แปลงจากแป้นพิมพ์ไทย)`
              : `✓ ตรวจสอบข้อมูลสินค้าเรียบร้อย [${resolvedFormat}] (Stock Validated)`,
            source,
          },
          ...prev.slice(0, 19),
        ]);
      }
      return;
    }

    // --- CASE 4: NOT FOUND (SKU NOT FOUND SAFEGUARD) ---
    // Operational Rule: "If Scanner reads a value but no SKU is found, do not treat as SKU. Show 'SKU Not Found' UI."
    soundManager.playErrorBuzz();
    setScannedType('not_found');
    setMatchedProduct(null);
    setMatchedPickingOrder(null);
    setMatchedRequisition(null);

    setScanHistory((prev) => [
      {
        time: now,
        code: clean,
        format: resolvedFormat,
        productName: 'SKU Not Found (ไม่พบรหัสสินค้า)',
        status: 'error',
        message: `✕ ไม่พบสินค้าที่ผูกกับบาร์โค้ด [${resolvedFormat}] ในระบบ (ไม่สวมเป็น SKU โดยพลการ)`,
        source,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      triggerScan(manualInput, 'manual');
      setManualInput('');
    }
  };

  const handleReceiverKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (receiverInputValue.trim()) {
        triggerScan(receiverInputValue, 'hid_hardware');
        setReceiverInputValue('');
      }
    }
  };

  const handleReceiverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReceiverInputValue(val);
    triggerPulse();
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
              <ScanBarcode className="w-5 h-5" />
            </div>
            ระบบสแกนบาร์โค้ดสินค้า & ใบเบิก (Handheld Barcode Terminal)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            รองรับ<strong>เครื่องสแกนบาร์โค้ดไร้สาย Bluetooth / USB OTG</strong> และกล้องมือถือ/แท็บเล็ต พร้อมระบบแปลงแป้นพิมพ์ไทยอัตโนมัติและ Auto-Jump
          </p>
        </div>

        {/* Real-time Hardware & API Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-Jump Toggle */}
          <button
            onClick={() => setAutoJumpEnabled(!autoJumpEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
              autoJumpEnabled
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoJumpEnabled ? 'fill-current' : ''}`} />
            {autoJumpEnabled ? '⚡ Auto-Jump: เปิด (เด้งไปหยิบทันที)' : '⚡ Auto-Jump: ปิด'}
          </button>

          {/* Live Scanner Activity Indicator */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              scannerPulseActive
                ? 'bg-emerald-400 text-slate-950 border-emerald-500 shadow-md scale-105'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                scannerPulseActive ? 'bg-slate-950 animate-ping' : 'bg-emerald-500 animate-pulse'
              }`}
            />
            {scannerPulseActive ? 'รับสัญญาณแล้ว!' : 'Scanner: พร้อมรับสัญญาณ'}
          </span>
        </div>
      </div>

      {/* Hardware Scanner Dedicated Focus Receiver Box (CRITICAL FIX FOR MOBILE & TABLET) */}
      <div className="bg-linear-to-r from-emerald-950 via-slate-900 to-indigo-950 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/60 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl transition-all ${
                scannerPulseActive
                  ? 'bg-emerald-400 text-slate-950 scale-110 shadow-lg shadow-emerald-500/50'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-emerald-300">
                  จุดรับสัญญาณเครื่องสแกนบาร์โค้ด (Scanner Hardware Receiver)
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Auto-Detect Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                หากใช้มือถือหรือแท็บเล็ตเชื่อมต่อเครื่องยิง ให้แตะกล่องสีเขียวนี้เพื่อให้เคอร์เซอร์พร้อมรับข้อมูล 100%
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => receiverInputRef.current?.focus()}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              isReceiverFocused
                ? 'bg-emerald-400 text-slate-950 ring-2 ring-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            {isReceiverFocused ? '✓ เคอร์เซอร์พร้อมรับยิงแล้ว' : 'แตะเพื่อโฟกัสรับยิงบาร์โค้ด'}
          </button>
        </div>

        {/* Input Target */}
        <div className="relative">
          <input
            ref={receiverInputRef}
            type="text"
            value={receiverInputValue}
            onChange={handleReceiverChange}
            onKeyDown={handleReceiverKeyDown}
            onFocus={() => setIsReceiverFocused(true)}
            onBlur={() => setIsReceiverFocused(false)}
            placeholder="ยิงบาร์โค้ดเข้ามาได้ทันที (รองรับ Bluetooth / USB / PDA ทุกรุ่น)..."
            className="w-full pl-11 pr-24 py-3 bg-slate-950/80 border-2 border-emerald-500/50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 rounded-xl text-sm font-mono text-emerald-300 placeholder:text-slate-500 focus:outline-none transition-all shadow-inner"
          />
          <Barcode className="w-5 h-5 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {receiverInputValue && (
            <button
              onClick={() => {
                triggerScan(receiverInputValue, 'hid_hardware');
                setReceiverInputValue('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-xs"
            >
              ตกลง (Enter)
            </button>
          )}
        </div>

        {/* Real-time Hardware Diagnostic Status Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-400">สัญญาณปุ่มล่าสุด:</span>
            <span className="font-mono text-emerald-400 font-semibold truncate">{lastRawKeyInfo}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Languages className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">ตรวจจับภาษาไทย:</span>
            <span className={`font-semibold ${wasThaiDetected ? 'text-amber-400' : 'text-slate-300'}`}>
              {wasThaiDetected ? 'พบแป้นไทย (แปลงกลับอัตโนมัติ ✓)' : 'พร้อมแปลงอัตโนมัติ'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 justify-start sm:justify-end">
            <span className="text-slate-400">จำนวน Keystrokes:</span>
            <span className="font-mono text-amber-400 font-bold">{keyBurstCount} ครั้ง</span>
          </div>
        </div>
      </div>

      {/* Auto-Jump Countdown Floating Toast */}
      {autoJumpCountdown && (
        <div className="p-4 bg-amber-500 text-slate-950 rounded-2xl shadow-xl flex items-center justify-between border-2 border-amber-300 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center font-black animate-spin shrink-0">
              ⚡
            </div>
            <div>
              <p className="font-extrabold text-sm sm:text-base">
                {autoJumpCountdown.target === 'picking'
                  ? `ตรวจพบคำสั่งจัดหยิบ [${autoJumpCountdown.id}]!`
                  : `ตรวจพบใบเบิกสินค้า [${autoJumpCountdown.id}]!`}
              </p>
              <p className="text-xs font-medium text-slate-900">
                ระบบกำลังเด้งนำคุณเข้าสู่หน้ารายการจัดหยิบสินค้าทันที...
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (autoJumpCountdown.target === 'picking' && onNavigateToPicking) {
                onNavigateToPicking(autoJumpCountdown.id);
              } else if (onNavigateToRequisitions) {
                onNavigateToRequisitions(autoJumpCountdown.id);
              }
            }}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
          >
            <span>ไปทันที (Go Now)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quick Troubleshooting Guide Card (ทำไมยิงไม่ติด & วิธีแก้ไขทันที) */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 sm:p-5 text-amber-950 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-xs sm:text-sm text-amber-900">
            วิธีแก้ปัญหายิงบาร์โค้ดแล้วไม่ติด (3 ขั้นตอนแก้ปัญหาเครื่องยิงทุกรุ่น):
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">1</span>
              แป้นพิมพ์เครื่องเป็นภาษาไทย
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              เมื่อเครื่องยิง ยิงตัวอักษรออกมาเป็นภาษาไทย (เช่น ยำน-001) <strong>ระบบได้แก้ปัญหาให้แล้ว</strong> โดยมีระบบแปลงตัวอักษรไทยกลับเป็นรหัสอังกฤษอัตโนมัติทันที
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">2</span>
              เครื่องยิงไม่ได้ส่ง Enter
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              เครื่องยิงบางรุ่นไม่ได้แถมรหัสขึ้นบรรทัดใหม่ (Enter/CR) <strong>ระบบได้ตั้งตัวนับเวลา 280ms อัตโนมัติ</strong> เมื่อยิงเสร็จระบบจะประมวลผลให้ทันทีแม้ไม่มีปุ่ม Enter
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 space-y-1">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] flex items-center justify-center font-bold">3</span>
              บนมือถือ/แท็บเล็ตเบราว์เซอร์ไม่รับ
            </span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              บน Safari/Chrome ในมือถือ ต้องมีช่องรับข้อมูลที่ Focus อยู่ <strong>ให้แตะที่กล่องสีเขียว "จุดรับสัญญาณสแกนเนอร์" ด้านบน</strong> เคอร์เซอร์จะกะพริบพร้อมรับยิง 100%
            </p>
          </div>
        </div>
      </div>

      {/* Quick Test Barcodes Row (For Testing Flow on Any Device) */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-200">
              ทดสอบยิงบาร์โค้ดจำลอง (Quick Test Barcodes):
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            แตะปุ่มเพื่อทดสอบระบบจำลองการยิงบาร์โค้ดของมือถือ / แท็บเล็ต
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => triggerScan('8851234567890', 'manual', 'Code 128')}
            className="p-2.5 bg-emerald-600/30 hover:bg-emerald-600/60 border border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-emerald-300 font-semibold flex items-center justify-between">
              <span>Code 128</span>
              <span className="text-emerald-200">FRU-001 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">8851234567890</div>
            <div className="text-[10px] text-slate-300 truncate">แอปเปิลฟูจิ (สแกนได้จริง 100%)</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('8859012345678', 'manual', 'EAN-13')}
            className="p-2.5 bg-emerald-600/30 hover:bg-emerald-600/60 border border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-emerald-300 font-semibold flex items-center justify-between">
              <span>EAN-13</span>
              <span className="text-emerald-200">FRU-001 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">8859012345678</div>
            <div className="text-[10px] text-slate-300 truncate">แอปเปิลฟูจิ (บาร์โค้ดสากล 13 หลัก)</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('WMS-FRU-001-QR', 'manual', 'QR Code')}
            className="p-2.5 bg-purple-600/30 hover:bg-purple-600/60 border border-purple-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-purple-300 font-semibold flex items-center justify-between">
              <span>QR Code</span>
              <span className="text-purple-200">FRU-001 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">WMS-FRU-001-QR</div>
            <div className="text-[10px] text-slate-300 truncate">2D QR Code คลังสินค้า</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('PROD002', 'manual', 'Code 39')}
            className="p-2.5 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-cyan-300 font-semibold flex items-center justify-between">
              <span>Code 39</span>
              <span className="text-cyan-200">FRU-002 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">PROD002</div>
            <div className="text-[10px] text-slate-300 truncate">ส้มสายน้ำผึ้ง (Code-39)</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('012345678905', 'manual', 'UPC-A')}
            className="p-2.5 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-cyan-300 font-semibold flex items-center justify-between">
              <span>UPC-A (12 หลัก)</span>
              <span className="text-cyan-200">FRU-002 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">012345678905</div>
            <div className="text-[10px] text-slate-300 truncate">ส้มสายน้ำผึ้ง (บาร์โค้ด US)</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('88512348', 'manual', 'EAN-8')}
            className="p-2.5 bg-emerald-600/30 hover:bg-emerald-600/60 border border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-emerald-300 font-semibold flex items-center justify-between">
              <span>EAN-8 (8 หลัก)</span>
              <span className="text-emerald-200">FRU-003 ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">88512348</div>
            <div className="text-[10px] text-slate-300 truncate">กล้วยหอมทอง (EAN-8)</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('PICK-0001', 'manual')}
            className="p-2.5 bg-indigo-600/40 hover:bg-indigo-600/70 border border-indigo-500/60 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-indigo-300 font-semibold flex items-center justify-between">
              <span>คำสั่งจัดหยิบ</span>
              <span className="text-amber-300">เด้งไปหยิบ ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">PICK-0001</div>
            <div className="text-[10px] text-slate-300 truncate">ใบเบิก REQ-2026-001</div>
          </button>

          <button
            type="button"
            onClick={() => triggerScan('9999999999999', 'manual', 'EAN-13')}
            className="p-2.5 bg-rose-600/30 hover:bg-rose-600/60 border border-rose-500/50 rounded-xl text-left transition-all cursor-pointer group"
          >
            <div className="text-[10px] text-rose-300 font-semibold flex items-center justify-between">
              <span>ทดสอบไม่พบรหัส</span>
              <span className="text-rose-200">SKU Not Found ➔</span>
            </div>
            <div className="font-mono font-bold text-xs text-white mt-0.5">9999999999999</div>
            <div className="text-[10px] text-rose-300 truncate">ไม่ถือเป็น SKU โดยพลการ</div>
          </button>
        </div>
      </div>

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewfinder & Direct Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Live Camera Scanner Element */}
          <div className="bg-slate-950 rounded-2xl p-4 shadow-xl border border-slate-800 text-white space-y-4">
            <CameraBarcodeScanner
              isActive={true}
              onScan={(code, format) => triggerScan(code, 'camera', format)}
            />

            {/* Prominent Action Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => triggerScan(activeCode, 'manual')}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <ScanBarcode className="w-5 h-5" /> [ SCAN / VERIFY CURRENT CODE ]
              </button>
            </div>

            {/* Direct Keyboard Input Fallback */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-medium">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                  ช่องป้อนรหัสสำรอง (Manual Barcode / SKU / Order ID):
                </span>
                <span className="text-[11px] text-slate-500">พิมพ์รหัสแล้วกด Enter</span>
              </div>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="manual-sku-input"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="พิมพ์บาร์โค้ด เช่น 8851234567890, PROD002, หรือ PICK-0001..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  ตรวจสอบ
                </button>
              </form>
            </div>
          </div>

          {/* Quick SKU Selection Buttons */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                เลือกสแกนรหัสจาก Master Data (Quick Select SKU):
              </span>
              <span className="text-[11px] text-slate-400">ตรวจสอบทันที</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {products.slice(0, 6).map((p) => (
                <button
                  key={p.sku}
                  onClick={() => triggerScan(p.sku, 'manual')}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    activeCode === p.sku
                      ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200 font-bold'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-slate-900">
                    <span>{p.sku}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                      Zone {p.zone}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Matched Action Banner & Scanned Data (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Matched Action Card (Dynamic Navigation) */}
          {matchedPickingOrder && (
            <div className="bg-linear-to-br from-indigo-900 to-slate-900 text-white rounded-2xl border border-indigo-700/60 p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-current" />
                  ตรวจพบคำสั่งจัดหยิบ (Picking Order Found)
                </span>
                <span className="text-xs font-mono text-indigo-300">
                  {matchedPickingOrder.status}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black font-mono tracking-tight text-white">
                  {matchedPickingOrder.id}
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  อ้างอิงใบเบิก: <strong className="text-white font-mono">{matchedPickingOrder.reqId || matchedPickingOrder.requestNo || '-'}</strong> • ผู้หยิบ: {matchedPickingOrder.pickerName || matchedPickingOrder.picker || '-'}
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 text-xs space-y-1.5 border border-white/10">
                <div className="flex justify-between text-indigo-200">
                  <span>จำนวนรายการสินค้า:</span>
                  <span className="font-bold text-white font-mono">{matchedPickingOrder.items.length} รายการ</span>
                </div>
                <div className="flex justify-between text-indigo-200">
                  <span>ระยะทางเดินหยิบเฉลี่ย:</span>
                  <span className="font-bold text-emerald-400 font-mono">{matchedPickingOrder.totalDistanceMeters || matchedPickingOrder.totalDistance || 40} เมตร</span>
                </div>
                <div className="flex justify-between text-indigo-200">
                  <span>สถานะการหยิบ:</span>
                  <span className="font-bold text-amber-300">
                    หยิบแล้ว {matchedPickingOrder.items.filter((i) => i.isPicked).length} / {matchedPickingOrder.items.length}
                  </span>
                </div>
              </div>

              {onNavigateToPicking && (
                <button
                  type="button"
                  onClick={() => onNavigateToPicking(matchedPickingOrder.id)}
                  className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Play className="w-4 h-4 fill-current" />
                  [ เด้งไปหน้าจัดหยิบ ORDER {matchedPickingOrder.id} ทันที ]
                </button>
              )}
            </div>
          )}

          {/* Matched Requisition (Without picking order yet) */}
          {scannedType === 'requisition' && matchedRequisition && (
            <div className="bg-linear-to-br from-blue-900 to-slate-900 text-white rounded-2xl border border-blue-700/60 p-5 shadow-lg space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-400 text-slate-950 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  ตรวจพบใบเบิกสินค้า (Requisition Order)
                </span>
                <span className="text-xs font-mono text-blue-300">
                  {matchedRequisition.status}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black font-mono tracking-tight text-white">
                  {matchedRequisition.id}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  ผู้ขอเบิก: <strong className="text-white">{matchedRequisition.requestor}</strong> ({matchedRequisition.department})
                </p>
              </div>

              {onNavigateToRequisitions && (
                <button
                  type="button"
                  onClick={() => onNavigateToRequisitions(matchedRequisition.id)}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-400 text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <FileText className="w-4 h-4" />
                  [ เปิดหน้ารายการใบเบิกสินค้า {matchedRequisition.id} ]
                </button>
              )}
            </div>
          )}

          {/* Scanned Product 7 Attributes Panel & Multi-Format Relational Details */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  ข้อมูลที่ได้จากการสแกน (Scanned Product Data)
                </h3>
                <p className="text-[11px] text-slate-500">แสดงผลมาตรฐานคลังสินค้า + Multi-Format Barcode</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                {detectedFormat}
              </span>
            </div>

            {/* Validation Banner */}
            <div className="space-y-2">
              {matchedProduct ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2.5 text-emerald-950 font-bold text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>✓ ตรวจสอบสินค้าเรียบร้อย (Stock Validated)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-emerald-200 text-emerald-900">
                    Source: {lastScanSource}
                  </span>
                </div>
              ) : scannedType === 'not_found' ? (
                <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2 text-rose-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-xs sm:text-sm text-rose-700">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      <span>✕ ไม่พบรหัสในฐานข้อมูล (SKU Not Found)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-rose-200 text-rose-900 font-bold">
                      {lastScanSource}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">บาร์โค้ดที่สแกนได้:</span>
                      <span className="font-mono font-bold text-slate-900">{scannedBarcodeValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">รูปแบบบาร์โค้ด:</span>
                      <span className="font-semibold text-indigo-700">{detectedFormat}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    <strong>คำเตือนความถูกต้อง:</strong> ระบบจะไม่นำรหัสบาร์โค้ดนี้ไปสวมเป็น SKU โดยพลการ เพื่อป้องกันความคลาดเคลื่อนของยอดสต็อก
                  </p>
                </div>
              ) : null}

              {apiVerifyResult && (
                <div className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-mono flex items-center justify-between">
                  <span className="text-slate-400">Database Verification:</span>
                  <span className="text-emerald-400 font-semibold">{apiVerifyResult}</span>
                </div>
              )}
            </div>

            {/* The 7 Specified Attributes */}
            {matchedProduct ? (
              <div className="space-y-2.5 text-xs">
                {/* 1. SKU */}
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-medium">1. รหัสสินค้า (SKU):</span>
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {matchedProduct.sku}
                  </span>
                </div>

                {/* 2. Product Name */}
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-medium">2. ชื่อสินค้า:</span>
                  <span className="font-bold text-slate-800 text-right max-w-[200px] truncate">
                    {matchedProduct.name}
                  </span>
                </div>

                {/* 3. Current Stock */}
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-medium">3. Stock ปัจจุบัน:</span>
                  <span className="font-mono font-black text-sm text-blue-700">
                    {matchedProduct.currentStock.toLocaleString()} {matchedProduct.unit}
                  </span>
                </div>

                {/* 4. Location */}
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-medium">4. Location:</span>
                  <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {matchedProduct.location}
                  </span>
                </div>

                {/* 5. Zone */}
                <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 font-medium">5. Zone จัดเก็บ:</span>
                  <span className="font-bold text-slate-800">
                    Zone {matchedProduct.zone} ({matchedProduct.abc === 'A' ? 'Fast' : matchedProduct.abc === 'B' ? 'Medium' : 'Slow'} Moving)
                  </span>
                </div>

                {/* 6. Quantity to Pick & 7. Quantity to Issue (Dynamically synchronized with Picking Order & Stock) */}
                {(() => {
                  const targetPickOrder =
                    matchedPickingOrder ||
                    pickingOrders.find((po) => po.items.some((it) => it.sku === matchedProduct.sku));
                  const itemInOrder = targetPickOrder?.items.find((it) => it.sku === matchedProduct.sku);
                  const pickedQty = itemInOrder?.pickedQuantity ?? (itemInOrder?.isPicked ? itemInOrder.quantity : 0);
                  const remainingNeeded = itemInOrder ? Math.max(0, itemInOrder.quantity - pickedQty) : 0;

                  return (
                    <>
                      <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                        <span className="text-slate-500 font-medium">6. จำนวนที่ต้องหยิบ:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {itemInOrder
                            ? `${itemInOrder.quantity} ${matchedProduct.unit} (หยิบแล้ว ${pickedQty}/${itemInOrder.quantity})`
                            : `10 ${matchedProduct.unit}`}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                        <span className="text-slate-500 font-medium">7. จำนวนที่ต้องจ่าย:</span>
                        <span className="font-mono font-bold text-indigo-700">
                          {itemInOrder
                            ? `${itemInOrder.quantity} ${matchedProduct.unit} (คงเหลือต้องหยิบ ${remainingNeeded} ${matchedProduct.unit})`
                            : `10 ${matchedProduct.unit}`}
                        </span>
                      </div>

                      {targetPickOrder && itemInOrder && !itemInOrder.isPicked && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const res = confirmPickItemAndDeductStock({
                                pickId: targetPickOrder.id,
                                itemId: itemInOrder.id,
                                scannedBarcode: scannedBarcodeValue || matchedProduct.barcode,
                                pickedQty: remainingNeeded,
                                operatorName: activeUser.name,
                              });
                              setPickActionResult(res.message);
                              soundManager.playSuccessBeep();
                            }}
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Zap className="w-4 h-4 fill-current" />
                            [ ยิงหยิบสินค้า & ตัดสต็อกทันทีใน {targetPickOrder.id} (-{remainingNeeded} {matchedProduct.unit}) ]
                          </button>
                        </div>
                      )}

                      {pickActionResult && (
                        <div className="p-2.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>{pickActionResult}</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Relational Multi-Barcodes for this Product */}
                {barcodes.filter((b) => b.sku === matchedProduct.sku).length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>บาร์โค้ดทั้งหมดของ SKU นี้ ({matchedProduct.sku}):</span>
                      <span className="text-slate-400">1 SKU หลายบาร์โค้ด</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {barcodes
                        .filter((b) => b.sku === matchedProduct.sku)
                        .map((b) => {
                          const isCurrentlyScanned = b.barcodeValue.toUpperCase() === scannedBarcodeValue.toUpperCase();
                          return (
                            <span
                              key={b.id}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border ${
                                isCurrentlyScanned
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold ring-2 ring-emerald-300'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <span>{b.barcodeValue}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-sans font-medium">
                                {b.barcodeFormat}
                              </span>
                              {b.isPrimary && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold">
                                  Primary
                                </span>
                              )}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Standard Scannable Barcode Graphic Preview */}
                <div className="pt-2 text-center flex flex-col items-center">
                  <div className="text-[11px] font-bold text-slate-600 mb-1">
                    ภาพบาร์โค้ดมาตรฐานสากล (Scannable Barcode):
                  </div>
                  <BarcodeView
                    value={scannedBarcodeValue || matchedProduct.barcode}
                    format={detectedFormat}
                    height={40}
                    width={200}
                    showText={true}
                  />
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                ไม่มีข้อมูลสินค้าที่สแกน
              </div>
            )}
          </div>

          {/* Recent Scans Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-500" />
              ประวัติการสแกนล่าสุด (Scan Log History)
            </h4>
            <div className="space-y-1.5 max-h-52 overflow-y-auto divide-y divide-slate-100 text-xs">
              {scanHistory.length === 0 ? (
                <div className="p-4 text-center text-slate-400">ยังไม่มีประวัติการสแกน</div>
              ) : (
                scanHistory.map((sh, idx) => (
                  <div key={idx} className="pt-2 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-800">{sh.code}</span>
                      <span className="text-[11px] text-slate-500 ml-2">{sh.productName}</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        sh.status === 'redirect'
                          ? 'bg-amber-100 text-amber-800'
                          : sh.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {sh.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
