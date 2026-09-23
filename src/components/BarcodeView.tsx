import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { toValidEan13, formatEan13Display } from '../utils/barcodeUtils';

export interface BarcodeViewProps {
  value: string;
  format?: string;
  className?: string;
  height?: number;
  width?: number;
  showText?: boolean;
  forceEan13?: boolean;
}

/**
 * Generate standard-compliant SVG string for QR Code synchronously
 */
export function generateQrSvgString(value: string, size = 120): string {
  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const margin = 2;
    const total = count + margin * 2;
    const cellSize = size / total;
    let rects = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          const x = (c + margin) * cellSize;
          const y = (r + margin) * cellSize;
          rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#0f172a" />`;
        }
      }
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff;display:block;margin:0 auto;">${rects}</svg>`;
  } catch (err) {
    console.warn('QR code generation failed:', err);
    return `<div style="padding:8px;font-size:11px;color:#dc2626;">QR Code Error</div>`;
  }
}

/**
 * Determine best barcode format for JsBarcode
 */
export function resolveJsBarcodeFormat(value: string, requestedFormat?: string): string {
  const cleanVal = (value || '').trim();
  const fmt = (requestedFormat || '').toUpperCase().replace(/[-_ ]/g, '');

  if (fmt === 'EAN13' || fmt === 'EAN') {
    return 'EAN13';
  } else if (fmt === 'EAN8') {
    if (/^\d{7,8}$/.test(cleanVal)) return 'EAN8';
  } else if (fmt === 'UPCA' || fmt === 'UPC') {
    if (/^\d{11,12}$/.test(cleanVal)) return 'UPC';
  } else if (fmt === 'CODE39') {
    if (/^[0-9A-Z\-.$/+% ]+$/i.test(cleanVal)) return 'CODE39';
  } else if (fmt === 'ITF') {
    if (/^\d+$/.test(cleanVal) && cleanVal.length % 2 === 0) return 'ITF';
  }

  // Auto-detect based on value structure if no valid format specified
  if (/^\d{13}$/.test(cleanVal)) {
    return 'EAN13';
  }
  if (/^\d{8}$/.test(cleanVal)) {
    return 'EAN8';
  }
  if (/^\d{12}$/.test(cleanVal)) {
    return 'EAN13'; // Transform to EAN-13
  }

  return 'CODE128';
}

/**
 * Generate standard-compliant SVG string for 1D or 2D barcodes
 * Defaults to strictly generating standard EAN-13 barcodes for warehouse products
 */
export function generateBarcodeSvgString(
  value: string,
  width = 160,
  height = 36,
  showText = true,
  format?: string,
  forceEan13 = true
): string {
  const rawClean = (value || '').trim();
  if (!rawClean) return '';

  const isExplicitQr =
    !forceEan13 &&
    ((format || '').toLowerCase().includes('qr') ||
      rawClean.toUpperCase().startsWith('QR:') ||
      rawClean.toUpperCase().includes('-QR'));

  if (isExplicitQr) {
    const qrSvg = generateQrSvgString(rawClean, Math.min(width, 140));
    return `
      <div style="text-align:center;padding:4px;background:#ffffff;">
        ${qrSvg}
        ${showText ? `<div style="font-family:monospace;font-size:10px;font-weight:700;color:#1e293b;margin-top:2px;">${rawClean}</div>` : ''}
      </div>
    `;
  }

  // Requirement: สินค้าทุกตัวพิมพ์เป็นบาร์โค้ด EAN-13 เท่านั้น
  const effectiveVal = forceEan13 || (format && format.toUpperCase().includes('EAN-13'))
    ? toValidEan13(rawClean)
    : rawClean;
  const effectiveFormat = (forceEan13 || effectiveVal.length === 13) ? 'EAN13' : resolveJsBarcodeFormat(effectiveVal, format);

  if (typeof document !== 'undefined') {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      try {
        JsBarcode(svg, effectiveVal, {
          format: effectiveFormat,
          width: 1.5,
          height: height,
          displayValue: false,
          margin: 4,
          background: '#ffffff',
          lineColor: '#0f172a',
        });
      } catch (err) {
        // If specific checksum failed, try EAN13 with calculated check digit
        const validEan = toValidEan13(effectiveVal);
        JsBarcode(svg, validEan, {
          format: 'EAN13',
          width: 1.5,
          height: height,
          displayValue: false,
          margin: 4,
          background: '#ffffff',
          lineColor: '#0f172a',
        });
      }

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svg);
      const displayDigits = effectiveVal.length === 13 ? formatEan13Display(effectiveVal) : effectiveVal;

      return `
        <div style="text-align:center;padding:2px;background:#ffffff;">
          ${svgString}
          ${showText ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#0f172a;letter-spacing:1px;margin-top:2px;">${displayDigits}</div>` : ''}
        </div>
      `;
    } catch (e) {
      console.warn('generateBarcodeSvgString error:', e);
    }
  }

  return `<div style="font-family:monospace;font-weight:bold;text-align:center;">${effectiveVal}</div>`;
}

/**
 * Legacy compatibility export
 */
export function generateBarcodeBars(value: string) {
  const bars: { width: number; isSpace: boolean }[] = [];
  bars.push({ width: 2, isSpace: false });
  bars.push({ width: 2, isSpace: true });
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    bars.push({ width: (code % 3) + 1, isSpace: false });
    bars.push({ width: ((code >> 1) % 2) + 1, isSpace: true });
  }
  bars.push({ width: 2, isSpace: false });
  return bars;
}

/**
 * Primary Real Barcode Component (Render Standard Scannable EAN-13 SVG)
 */
export const BarcodeView: React.FC<BarcodeViewProps> = ({
  value,
  format = 'EAN-13',
  className = '',
  height = 42,
  width = 180,
  showText = true,
  forceEan13 = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderError, setRenderError] = useState(false);

  const rawVal = (value || '').trim();
  const effectiveVal = forceEan13 || format === 'EAN-13' ? toValidEan13(rawVal) : rawVal;

  const isQr =
    !forceEan13 &&
    ((format || '').toLowerCase().includes('qr') ||
      rawVal.toUpperCase().startsWith('QR:') ||
      rawVal.toUpperCase().includes('-QR'));

  useEffect(() => {
    if (isQr || !svgRef.current || !effectiveVal) return;

    setRenderError(false);
    const jsFormat = (forceEan13 || effectiveVal.length === 13)
      ? 'EAN13'
      : resolveJsBarcodeFormat(effectiveVal, format);

    try {
      JsBarcode(svgRef.current, effectiveVal, {
        format: jsFormat,
        width: Math.max(1.2, Math.min(2.0, (width - 16) / Math.max(effectiveVal.length * 10, 50))),
        height: height,
        displayValue: false,
        margin: 4,
        background: '#ffffff',
        lineColor: '#0f172a',
      });
    } catch (err) {
      try {
        // Ensure valid EAN-13 fallback
        const ean13 = toValidEan13(effectiveVal);
        if (svgRef.current) {
          JsBarcode(svgRef.current, ean13, {
            format: 'EAN13',
            width: Math.max(1.2, Math.min(2.0, (width - 16) / Math.max(ean13.length * 10, 50))),
            height: height,
            displayValue: false,
            margin: 4,
            background: '#ffffff',
            lineColor: '#0f172a',
          });
        }
      } catch (fallbackErr) {
        console.warn('Barcode render error:', fallbackErr);
        setRenderError(true);
      }
    }
  }, [effectiveVal, format, height, width, isQr, forceEan13]);

  if (!rawVal) {
    return <span className="text-slate-400 text-xs italic">ไม่มีข้อมูลบาร์โค้ด</span>;
  }

  if (isQr) {
    return (
      <div className={`inline-flex flex-col items-center justify-center p-1 bg-white rounded border border-slate-200 ${className}`}>
        <div dangerouslySetInnerHTML={{ __html: generateQrSvgString(rawVal, Math.min(width, 120)) }} />
        {showText && (
          <span className="font-mono text-[10px] text-slate-700 font-semibold mt-1 max-w-[120px] truncate">
            {rawVal}
          </span>
        )}
      </div>
    );
  }

  const displayDigits = effectiveVal.length === 13 ? formatEan13Display(effectiveVal) : effectiveVal;

  return (
    <div className={`inline-flex flex-col items-center justify-center bg-white rounded p-1 border border-slate-200/80 shadow-xs ${className}`}>
      <svg ref={svgRef} className="block max-w-full" />
      {showText && (
        <span className="font-mono text-[11px] font-bold text-slate-900 tracking-wider mt-0.5 select-all">
          {displayDigits}
        </span>
      )}
      {renderError && (
        <span className="text-[10px] text-red-500 font-semibold">ข้อผิดพลาดในการแสดงผลบาร์โค้ด</span>
      )}
    </div>
  );
};

