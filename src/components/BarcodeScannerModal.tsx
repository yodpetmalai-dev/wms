import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Sparkles,
  Search,
  ScanBarcode,
  Keyboard,
} from 'lucide-react';
import { useWMS } from '../context/WMSContext';
import { BarcodeView } from './BarcodeView';
import { CameraBarcodeScanner } from './CameraBarcodeScanner';
import { soundManager } from '../utils/soundUtils';
import { normalizeBarcode, isBarcodeOrSkuMatch } from '../utils/barcodeUtils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedSku?: string;
  expectedQty?: number;
  pickOrderId?: string;
  pickItemId?: string;
  title?: string;
  onScanSuccess?: (sku: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  expectedSku,
  expectedQty,
  pickOrderId,
  pickItemId,
  title = 'สแกนบาร์โค้ดสินค้า (Barcode Scanner)',
  onScanSuccess,
}) => {
  const { products, barcodes, lookupBarcode, getProductBySku, scanBarcodeForItem } = useWMS();
  const [manualCode, setManualCode] = useState('');
  const [scannedResult, setScannedResult] = useState<{
    code: string;
    format?: string;
    isMatch?: boolean;
    message: string;
    product?: ReturnType<typeof getProductBySku>;
  } | null>(null);

  const targetProduct = expectedSku ? getProductBySku(expectedSku) : undefined;

  useEffect(() => {
    if (!isOpen) {
      setScannedResult(null);
      setManualCode('');
    }
  }, [isOpen]);

  const processScanCode = (code: string, explicitFormat?: string) => {
    const rawClean = code.trim();
    const clean = normalizeBarcode(rawClean) || rawClean.toUpperCase();
    if (!clean) return;

    const lookupRes = lookupBarcode(clean);
    const product = lookupRes.product || getProductBySku(clean);
    const detectedFormat = explicitFormat || lookupRes.barcodeFormat;

    if (expectedSku) {
      const isMatch = isBarcodeOrSkuMatch(
        clean,
        { sku: expectedSku, barcode: targetProduct?.barcode, name: targetProduct?.name },
        barcodes
      );

      if (isMatch) {
        soundManager.playSuccessBeep();
        let pickResult: ReturnType<typeof scanBarcodeForItem> | undefined;
        // Only run scanBarcodeForItem directly if no onScanSuccess handler is provided to avoid double-call
        if (pickOrderId && pickItemId && !onScanSuccess) {
          pickResult = scanBarcodeForItem(pickOrderId, pickItemId, clean, expectedQty);
        }
        setScannedResult({
          code: clean,
          format: detectedFormat,
          isMatch: true,
          message: pickResult?.message || `✓ Barcode ถูกต้อง (${detectedFormat})`,
          product: targetProduct || product,
        });
        if (onScanSuccess) {
          setTimeout(() => {
            onScanSuccess(clean);
          }, 400);
        }
      } else {
        soundManager.playErrorBuzz();
        setScannedResult({
          code: clean,
          format: detectedFormat,
          isMatch: false,
          message: `⚠ Barcode (${detectedFormat}) ไม่ตรงกับรายการที่กำลังหยิบ (ต้องการ: ${expectedSku}, สแกนได้: ${clean})`,
          product,
        });
      }
    } else {
      // General scanner mode
      if (product) {
        soundManager.playSuccessBeep();
        setScannedResult({
          code: clean,
          format: detectedFormat,
          isMatch: true,
          message: `✓ ตรวจสอบสินค้าเรียบร้อย (${detectedFormat})`,
          product,
        });
        if (onScanSuccess) {
          onScanSuccess(product.sku);
        }
      } else {
        soundManager.playErrorBuzz();
        setScannedResult({
          code: clean,
          format: detectedFormat,
          isMatch: false,
          message: `✕ ไม่พบรหัสสินค้า SKU จาก Barcode: ${clean} (${detectedFormat}) ในฐานข้อมูล`,
        });
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processScanCode(manualCode.trim());
      setManualCode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">
                กล้องสดวิดีโอ & ระบบถอดรหัสบาร์โค้ด Real-time
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expected Item Highlight if in Picking context */}
        {targetProduct && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-900 mb-1">
              <span>🎯 สินค้าที่ต้องหยิบ (Target SKU)</span>
              <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono font-bold">
                {targetProduct.sku}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{targetProduct.name}</p>
                <p className="text-xs text-slate-600">
                  Location: <span className="font-bold text-amber-800 font-mono">{targetProduct.location}</span> (Zone {targetProduct.zone})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">จำนวนที่ต้องหยิบ</span>
                <p className="text-base font-black text-emerald-600 font-mono">
                  {expectedQty || 1} <span className="text-xs font-normal text-slate-600">{targetProduct.unit}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Video Camera & Real Barcode Scanner */}
        <div className="p-3 bg-slate-950">
          <CameraBarcodeScanner
            isActive={isOpen}
            onScan={processScanCode}
            expectedSku={expectedSku}
          />
        </div>

        {/* Scan Status Feedback Banner */}
        {scannedResult && (
          <div
            className={`p-4 border-b transition-all duration-300 ${
              scannedResult.isMatch
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2.5 font-bold text-xs sm:text-sm">
              {scannedResult.isMatch ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{scannedResult.message}</span>
            </div>

            {/* If product found, display the 7 required warehouse specs */}
            {scannedResult.product && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs bg-white/80 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">1. รหัสสินค้า (SKU):</span>
                  <span className="font-mono font-bold text-slate-900 ml-1">
                    {scannedResult.product.sku}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">2. ชื่อสินค้า:</span>
                  <span className="font-bold text-slate-900 ml-1 truncate block">
                    {scannedResult.product.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">3. Stock ปัจจุบัน:</span>
                  <span className="font-bold text-blue-700 ml-1">
                    {scannedResult.product.currentStock} {scannedResult.product.unit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">4. Location:</span>
                  <span className="font-mono font-bold text-amber-700 ml-1">
                    {scannedResult.product.location}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">5. Zone:</span>
                  <span className="font-bold text-slate-800 ml-1">
                    Zone {scannedResult.product.zone} ({scannedResult.product.abc}-Fast)
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">6. จำนวนที่ต้องหยิบ:</span>
                  <span className="font-bold text-emerald-700 ml-1">
                    {expectedQty || 1} {scannedResult.product.unit}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">7. จำนวนที่ต้องจ่าย:</span>
                    <span className="font-bold text-indigo-700 ml-1">
                      {expectedQty || 1} {scannedResult.product.unit}
                    </span>
                  </div>
                  <BarcodeView
                    value={scannedResult.product.barcode}
                    height={24}
                    width={130}
                    showText={false}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Fallback Manual Input & Fast Demo Controls */}
        <div className="p-4 bg-slate-50 space-y-3">
          {/* Direct Manual SKU / Barcode Input Fallback (Requirement 4) */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-indigo-600" />
                คีย์บอร์ดพิมพ์รหัสด้วยตนเอง (Manual Fallback Input):
              </span>
              <span className="text-[10px] text-slate-400">กด Enter หรือ ตรวจสอบ</span>
            </div>
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="พิมพ์ SKU เช่น PEN-BL-001 หรือสแกน..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800 placeholder:text-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-xs"
              >
                ตรวจสอบ
              </button>
            </form>
          </div>

          {/* Quick Barcode Select Buttons */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                เลือกสแกนรหัสสินค้า (Quick Barcode Select):
              </span>
              <span className="text-[10px] text-slate-400">ตรวจสอบทันที</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {expectedSku ? (
                <>
                  <button
                    type="button"
                    onClick={() => processScanCode(expectedSku)}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> สแกนตรง ({expectedSku})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const wrongSku = products.find((p) => p.sku !== expectedSku)?.sku || 'PEN-RD-002';
                      processScanCode(wrongSku);
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-500 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> สแกนผิด (ทดสอบ Error)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => processScanCode(products[0]?.sku || 'PEN-BL-001')}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 active:scale-95 transition-all truncate text-left cursor-pointer"
                  >
                    สแกน {products[0]?.sku || 'PEN-BL-001'}
                  </button>
                  <button
                    type="button"
                    onClick={() => processScanCode(products[10]?.sku || 'PAP-A4-011')}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 active:scale-95 transition-all truncate text-left cursor-pointer"
                  >
                    สแกน {products[10]?.sku || 'PAP-A4-011'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>เสียง Beep เมื่อสแกนถูก / เสียง Buzz เมื่อสแกนผิด</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
