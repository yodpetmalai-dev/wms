import { Product } from '../types/wms';
import { generateBarcodeSvgString } from '../components/BarcodeView';
import { toValidEan13, formatEan13Display } from './barcodeUtils';

export interface PrintOptions {
  template: 'a4-standard' | 'shelf-tag' | 'compact-thermal';
  copies: number;
  showLocation: boolean;
  showPrice: boolean;
  showCategory: boolean;
}

// Generate self-contained standard scannable SVG strictly in EAN-13 format
function generateSvgHtml(value: string, width = 160, height = 34): string {
  return generateBarcodeSvgString(value, width, height, false, 'EAN-13', true);
}

// Generate complete standalone printable HTML document
export function generatePrintableHtml(
  products: Product[],
  options: PrintOptions,
  title = 'WMS EAN-13 Product Barcode Labels'
): string {
  const { template, copies, showLocation, showPrice, showCategory } = options;

  // Build duplicated items based on copies
  const allItems: Product[] = [];
  products.forEach((p) => {
    for (let c = 0; c < copies; c++) {
      allItems.push(p);
    }
  });

  const zoneColors: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    B: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    C: { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  };

  const labelsHtml = allItems
    .map((p, idx) => {
      const zColor = zoneColors[p.zone] || { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' };
      const ean13Code = toValidEan13(p.barcode || p.sku);
      const ean13Formatted = formatEan13Display(ean13Code);
      const barcodeSvg = generateSvgHtml(ean13Code, template === 'shelf-tag' ? 180 : 150, template === 'shelf-tag' ? 38 : 30);

      if (template === 'shelf-tag') {
        return `
          <div class="label-item shelf-tag">
            <div class="label-header">
              <span class="badge" style="background:${zColor.bg};color:${zColor.text};border:1px solid ${zColor.border};">Zone ${p.zone}</span>
              <span class="sku">${p.sku}</span>
              ${showLocation ? `<span class="location-badge">LOC: ${p.location}</span>` : ''}
              <span class="badge" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;font-size:9px;margin-left:auto;">EAN-13</span>
            </div>
            <div class="product-name">${p.name}</div>
            <div class="meta-row">
              ${showCategory ? `<span class="category">${p.category}</span>` : ''}
              ${showPrice ? `<span class="price">฿${p.unitPrice.toFixed(0)} / ${p.unit}</span>` : ''}
            </div>
            <div class="barcode-box">
              ${barcodeSvg}
              <div class="barcode-text" style="font-family:'JetBrains Mono',monospace;letter-spacing:1px;font-weight:700;">${ean13Formatted}</div>
            </div>
          </div>
        `;
      }

      if (template === 'compact-thermal') {
        return `
          <div class="label-item compact-thermal">
            <div class="label-header">
              <span class="sku">${p.sku}</span>
              <span class="badge" style="background:${zColor.bg};color:${zColor.text};">Z-${p.zone}</span>
              ${showLocation ? `<span class="location-badge">${p.location}</span>` : ''}
            </div>
            <div class="product-name compact">${p.name}</div>
            <div class="barcode-box">
              ${barcodeSvg}
              <div class="barcode-text" style="font-family:'JetBrains Mono',monospace;letter-spacing:0.8px;font-weight:700;">${ean13Formatted}</div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;margin-top:2px;">
              <span style="color:#64748b;font-weight:600;">EAN-13</span>
              ${showPrice ? `<span style="font-weight:700;color:#0f172a;">฿${p.unitPrice.toFixed(0)}/${p.unit}</span>` : ''}
            </div>
          </div>
        `;
      }

      // Default: A4 Standard sticker
      return `
        <div class="label-item a4-sticker">
          <div class="label-header">
            <span class="badge" style="background:${zColor.bg};color:${zColor.text};border:1px solid ${zColor.border};">Z-${p.zone}</span>
            <span class="sku">${p.sku}</span>
            ${showLocation ? `<span class="location-badge">${p.location}</span>` : ''}
            <span class="badge" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;font-size:9px;margin-left:auto;">EAN-13</span>
          </div>
          <div class="product-name">${p.name}</div>
          <div class="meta-row">
            ${showCategory ? `<span class="category">${p.category}</span>` : ''}
            ${showPrice ? `<span class="price">฿${p.unitPrice.toFixed(0)}/${p.unit}</span>` : ''}
          </div>
          <div class="barcode-box">
            ${barcodeSvg}
            <div class="barcode-text" style="font-family:'JetBrains Mono',monospace;letter-spacing:1px;font-weight:700;">${ean13Formatted}</div>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Sarabun:wght@400;600;700&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Sarabun', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Print Action Bar (Hidden on print) */
    .action-bar {
      position: sticky;
      top: 0;
      z-index: 999;
      background: #1e1b4b;
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .action-bar h1 {
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-bar .info {
      font-size: 12px;
      opacity: 0.85;
    }
    .action-btn {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: #4338ca;
      transform: translateY(-1px);
    }
    .action-btn-secondary {
      background: #334155;
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-left: 8px;
    }
    .action-btn-secondary:hover {
      background: #475569;
    }

    /* Container */
    .print-sheet {
      max-width: 210mm;
      margin: 20px auto;
      background: white;
      padding: 12mm 10mm;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      border-radius: 8px;
    }

    /* Template: A4 Standard Grid (3 columns) */
    .grid-a4 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm 5mm;
    }
    .label-item {
      background: white;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .a4-sticker {
      min-height: 48mm;
    }

    /* Shelf Tag (2 columns, larger font & borders) */
    .grid-shelf {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8mm 6mm;
    }
    .shelf-tag {
      min-height: 55mm;
      border: 2px solid #334155;
      padding: 10px 12px;
    }

    /* Compact Thermal Label */
    .grid-thermal {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4mm;
    }
    .compact-thermal {
      width: 50mm;
      min-height: 30mm;
      border: 1px solid #94a3b8;
      padding: 6px 8px;
    }

    .label-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 4px;
    }
    .sku {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      font-size: 13px;
      color: #0f172a;
    }
    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      font-family: monospace;
    }
    .location-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 1px 4px;
      border-radius: 4px;
    }
    .product-name {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.3;
      margin-bottom: 4px;
      height: 2.6em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .product-name.compact {
      font-size: 11px;
      height: auto;
      margin-bottom: 2px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .price {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #0f172a;
    }
    .price-center {
      text-align: center;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 11px;
      margin-top: 2px;
    }
    .barcode-box {
      text-align: center;
      margin-top: auto;
      padding-top: 4px;
    }
    .barcode-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 1px;
      margin-top: 2px;
    }

    /* Print Styles */
    @media print {
      body {
        background: white !important;
      }
      .no-print, .action-bar {
        display: none !important;
      }
      .print-sheet {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: none !important;
        width: 100% !important;
      }
      .label-item {
        border: 1px dashed #94a3b8;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      @page {
        size: A4 portrait;
        margin: 8mm 6mm;
      }
    }
  </style>
</head>
<body>

  <!-- Floating Print Controls -->
  <div class="action-bar no-print">
    <div>
      <h1>🖨️ ${title}</h1>
      <div class="info">จำนวนสินค้า: ${products.length} SKUs | รวมสติ๊กเกอร์ทั้งหมด ${allItems.length} ดวง (รูปแบบ: ${template})</div>
    </div>
    <div>
      <button class="action-btn" onclick="window.print()">
        🖨️ สั่งพิมพ์ (Print / Save as PDF)
      </button>
      <button class="action-btn-secondary" onclick="window.close()">
        ✕ ปิดหน้านี้
      </button>
    </div>
  </div>

  <!-- Sticker Sheet Body -->
  <div class="print-sheet">
    <div class="${template === 'shelf-tag' ? 'grid-shelf' : template === 'compact-thermal' ? 'grid-thermal' : 'grid-a4'}">
      ${labelsHtml}
    </div>
  </div>

  <script>
    // Auto-trigger print when opened in a top-level tab
    window.onload = function() {
      setTimeout(function() {
        try {
          window.print();
        } catch(e) {
          console.log('Auto print prevented by browser', e);
        }
      }, 500);
    };
  </script>
</body>
</html>`;
}

// Open print page in a new window/tab safely via Blob URL
export function openPrintTab(products: Product[], options: PrintOptions, title?: string) {
  const html = generatePrintableHtml(products, options, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  
  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) {
    // Popup was blocked, provide fallback download or direct link
    downloadPrintableHtml(products, options, title);
  }
  return blobUrl;
}

// Download printable HTML file directly to user device
export function downloadPrintableHtml(products: Product[], options: PrintOptions, title?: string) {
  const html = generatePrintableHtml(products, options, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `WMS_Barcode_Stickers_${products.length}SKU_${new Date().toISOString().slice(0, 10)}.html`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
