import React, { useState, useMemo } from 'react';
import { useWMS } from '../../context/WMSContext';
import { Product } from '../../types/wms';
import { BarcodeView } from '../BarcodeView';
import { openPrintTab, downloadPrintableHtml } from '../../utils/printBarcodes';
import {
  Layers,
  Search,
  Printer,
  Grid,
  List,
  Download,
  Barcode,
  Sparkles,
  CheckCircle2,
  Filter,
  CheckSquare,
  Square,
  Copy,
  Tag,
  SlidersHorizontal,
  X,
  MapPin,
  TrendingUp,
  ExternalLink,
  FileDown,
  Check,
  Plus,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useWMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Add Product Modal states (Requirement 1 & 13)
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    sku: '',
    name: '',
    barcode: '',
    barcodeType: 'Code 128' as any,
    unit: 'ชิ้น',
    category: 'เครื่องเขียน',
    location: 'A-01-01',
    zone: 'A' as const,
    initialStock: 100,
    minStock: 20,
    maxStock: 250,
    unitPrice: 45,
    lotBatch: `LOT-${new Date().getFullYear()}-01`,
    receivedDate: new Date().toLocaleDateString('th-TH'),
    expiryDate: '31/12/2028',
    status: 'Available' as const,
  });

  // Checkbox selections for batch actions
  const [selectedSkuList, setSelectedSkuList] = useState<string[]>(products.map((p) => p.sku));

  // Print modal states
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [singlePrintProduct, setSinglePrintProduct] = useState<Product | null>(null);
  const [labelTemplate, setLabelTemplate] = useState<'a4-standard' | 'shelf-tag' | 'compact-thermal'>('a4-standard');
  const [labelCopies, setLabelCopies] = useState<number>(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);
  const [printScope, setPrintScope] = useState<'all' | 'zone-a' | 'zone-b' | 'zone-c' | 'custom'>('all');
  const [directPrintUrl, setDirectPrintUrl] = useState<string | null>(null);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Edit Product Modal states (Editable Master Data)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<string>('');
  const [editProductForm, setEditProductForm] = useState<Partial<Product>>({});
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

  const handleOpenEditProduct = (prod: Product) => {
    setEditingSku(prod.sku);
    setEditProductForm({
      sku: prod.sku,
      name: prod.name,
      barcode: prod.barcode,
      barcodeType: prod.barcodeType,
      category: prod.category,
      unit: prod.unit,
      location: prod.location,
      zone: prod.zone,
      currentStock: prod.currentStock,
      initialStock: prod.initialStock,
      minStock: prod.minStock,
      maxStock: prod.maxStock,
      unitPrice: prod.unitPrice,
      lotBatch: prod.lotBatch,
      expiryDate: prod.expiryDate,
    });
    setEditFeedback(null);
    setEditModalOpen(true);
  };

  const handleSaveEditProduct = () => {
    if (!editingSku || !editProductForm.name) {
      setEditFeedback('กรุณากรอกชื่อสินค้า');
      return;
    }

    const result = updateProduct(editingSku, editProductForm);
    if (result.success) {
      setEditFeedback(result.message);
      setTimeout(() => {
        setEditModalOpen(false);
        setEditFeedback(null);
      }, 1000);
    } else {
      setEditFeedback(result.message);
    }
  };

  const handleDeleteProduct = (sku: string, name: string) => {
    if (confirm(`คุณต้องการลบสินค้า "${name}" (${sku}) ออกจากระบบ WMS ใช่หรือไม่?`)) {
      const res = deleteProduct(sku);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchQ =
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase());
      const matchZ = selectedZone === 'ALL' || p.zone === selectedZone;
      const matchC = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchQ && matchZ && matchC;
    });
  }, [products, searchQuery, selectedZone, selectedCategory]);

  // ABC Analysis summary stats
  const zoneAProducts = useMemo(() => products.filter((p) => p.zone === 'A'), [products]);
  const zoneBProducts = useMemo(() => products.filter((p) => p.zone === 'B'), [products]);
  const zoneCProducts = useMemo(() => products.filter((p) => p.zone === 'C'), [products]);

  // Toggle single selection
  const toggleSelectSku = (sku: string) => {
    setSelectedSkuList((prev) =>
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    );
  };

  // Toggle select all filtered
  const toggleSelectAll = () => {
    const allFilteredSkus = filteredProducts.map((p) => p.sku);
    const isAllSelected = allFilteredSkus.every((sku) => selectedSkuList.includes(sku));

    if (isAllSelected) {
      setSelectedSkuList((prev) => prev.filter((s) => !allFilteredSkus.includes(s)));
    } else {
      setSelectedSkuList((prev) => Array.from(new Set([...prev, ...allFilteredSkus])));
    }
  };

  // Calculate items to print based on modal options
  const itemsToPrint = useMemo(() => {
    if (singlePrintProduct) return [singlePrintProduct];

    if (printScope === 'zone-a') return zoneAProducts;
    if (printScope === 'zone-b') return zoneBProducts;
    if (printScope === 'zone-c') return zoneCProducts;
    if (printScope === 'custom') return products.filter((p) => selectedSkuList.includes(p.sku));
    return products; // 'all' (all 30 SKUs)
  }, [singlePrintProduct, printScope, zoneAProducts, zoneBProducts, zoneCProducts, selectedSkuList, products]);

  // Open in new tab for reliable printing (bypasses iframe sandbox restrictions)
  const handleOpenPrintTab = () => {
    try {
      const url = openPrintTab(
        itemsToPrint,
        {
          template: labelTemplate,
          copies: labelCopies,
          showLocation,
          showPrice,
          showCategory,
        },
        singlePrintProduct ? `ป้ายบาร์โค้ด_${singlePrintProduct.sku}` : `ใบพิมพ์สติ๊กเกอร์บาร์โค้ด_${itemsToPrint.length}_SKU`
      );
      setDirectPrintUrl(url);
      setPrintFeedback('เปิดหน้าเอกสารสำหรับพิมพ์ในแท็บใหม่แล้ว (หากเบราว์เซอร์บล็อกหน้าต่างป๊อปอัป ให้คลิกลิงก์ด้านล่างเพื่อเปิดโดยตรง)');
    } catch {
      handleDownloadPrintFile();
    }
  };

  // Direct download of standalone printable HTML
  const handleDownloadPrintFile = () => {
    downloadPrintableHtml(
      itemsToPrint,
      {
        template: labelTemplate,
        copies: labelCopies,
        showLocation,
        showPrice,
        showCategory,
      },
      singlePrintProduct ? `ป้ายบาร์โค้ด_${singlePrintProduct.sku}` : `ใบพิมพ์สติ๊กเกอร์บาร์โค้ด_${itemsToPrint.length}_SKU`
    );
    setPrintFeedback('ดาวน์โหลดไฟล์เอกสารสติ๊กเกอร์บาร์โค้ด (HTML / PDF Ready) สำเร็จแล้ว สามารถเปิดไฟล์เพื่อพิมพ์ลงเครื่องพิมพ์จริงได้ทันที');
  };

  // Handle browser printing with automatic iframe-safe fallback
  const handleTriggerPrint = () => {
    // Generate blob URL first so direct link is immediately accessible
    try {
      const url = openPrintTab(
        itemsToPrint,
        {
          template: labelTemplate,
          copies: labelCopies,
          showLocation,
          showPrice,
          showCategory,
        },
        singlePrintProduct ? `ป้ายบาร์โค้ด_${singlePrintProduct.sku}` : `ใบพิมพ์สติ๊กเกอร์บาร์โค้ด_${itemsToPrint.length}_SKU`
      );
      setDirectPrintUrl(url);
    } catch (e) {
      console.warn('Could not generate print tab', e);
    }

    try {
      window.print();
    } catch (err) {
      console.warn('window.print blocked by iframe sandbox, falling back to new tab/download', err);
      handleDownloadPrintFile();
    }
  };

  // Quick download all 30 SKUs printable sheet directly from top bar
  const handleQuickDownloadAll30 = () => {
    downloadPrintableHtml(
      products,
      {
        template: 'a4-standard',
        copies: 1,
        showLocation: true,
        showPrice: true,
        showCategory: true,
      },
      'WMS_30_SKU_Barcode_Stickers_Master'
    );
  };

  // Quick open all 30 SKUs print tab directly
  const handleQuickOpenPrintTab30 = () => {
    openPrintTab(
      products,
      {
        template: 'a4-standard',
        copies: 1,
        showLocation: true,
        showPrice: true,
        showCategory: true,
      },
      'WMS_30_SKU_Barcode_Stickers_Master'
    );
  };

  // Export 30 SKUs to CSV
  const handleExportCSV = () => {
    const headers = ['No', 'SKU', 'Product Name', 'Category', 'Unit', 'Price', 'Daily Order', 'ABC Zone', 'Location', 'Barcode', 'Stock'];
    const rows = products.map((p) => [
      p.no,
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.unit,
      p.unitPrice,
      p.dailyOrder,
      p.zone,
      p.location,
      `'${p.barcode}`,
      p.currentStock,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `WMS_30_SKU_Master_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with ABC Master Catalog Stats */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  มาสเตอร์ข้อมูลสินค้าและบาร์โค้ด (Master Product & Barcode Catalog)
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  ระบบบริหารจัดการสินค้าคงคลัง 30 SKUs แบ่งกลุ่ม ABC Analysis ตามโซนจัดเก็บ
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="export-catalog-csv-btn"
              onClick={handleExportCSV}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ส่งออกข้อมูลสินค้า 30 รายการเป็นไฟล์ CSV"
            >
              <Download className="w-4 h-4" /> ส่งออก CSV
            </button>

            <button
              id="quick-download-print-file-btn"
              onClick={handleQuickDownloadAll30}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="ดาวน์โหลดไฟล์สติ๊กเกอร์บาร์โค้ดพร้อมพิมพ์ A4 ครบ 30 SKU เปิดพิมพ์ได้ทันทีทุกอุปกรณ์"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>ดาวน์โหลดไฟล์พิมพ์ (30 SKU)</span>
            </button>

            <button
              id="quick-open-print-tab-btn"
              onClick={handleQuickOpenPrintTab30}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="เปิดหน้าพิมพ์สติ๊กเกอร์บาร์โค้ดครบ 30 SKU ในแท็บใหม่โดยไม่ติดบล็อกของ iFrame"
            >
              <ExternalLink className="w-4 h-4 text-indigo-300" />
              <span>เปิดพิมพ์ในแท็บใหม่</span>
            </button>

            <button
              onClick={() => {
                setAddProductModalOpen(true);
                setAddFeedback(null);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้าใหม่ (Add Product)</span>
            </button>

            <button
              id="print-all-30-barcodes-btn"
              onClick={() => {
                setSinglePrintProduct(null);
                setPrintScope('all');
                setPrintModalOpen(true);
                setDirectPrintUrl(null);
                setPrintFeedback(null);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>สถานีพิมพ์สติ๊กเกอร์ (ตั้งค่า)</span>
            </button>
          </div>
        </div>

        {/* ABC Analysis 3 Equal Groups Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          {/* Zone A */}
          <div
            onClick={() => setSelectedZone(selectedZone === 'A' ? 'ALL' : 'A')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedZone === 'A'
                ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-300'
                : 'bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black font-mono bg-emerald-600 text-white">
                Zone A (Fast-moving)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800">
                {zoneAProducts.length} SKUs ({zoneAProducts[0]?.sku || 'PEN-BL-001'}...)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 line-clamp-1">
              ปากกาลูกลื่น, ปากกาเจล, ปากกาเคมี, กระดาษถ่ายเอกสาร A4 80g
            </p>
            <div className="mt-2 text-[11px] text-emerald-700 font-medium flex items-center justify-between">
              <span>ยอดเบิกเฉลี่ย: 28 - 80 ชิ้น/วัน</span>
              <span className="font-mono font-bold">เชลฟ์ A-01 ถึง A-04</span>
            </div>
          </div>

          {/* Zone B */}
          <div
            onClick={() => setSelectedZone(selectedZone === 'B' ? 'ALL' : 'B')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedZone === 'B'
                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-300'
                : 'bg-blue-50/30 border-blue-200 hover:bg-blue-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black font-mono bg-blue-600 text-white">
                Zone B (Medium-moving)
              </span>
              <span className="text-xs font-mono font-bold text-blue-800">
                {zoneBProducts.length} SKUs ({zoneBProducts[0]?.sku || 'PAP-A4-011'}...)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 line-clamp-1">
              กระดาษ A4 70g, กระดาษ A3/A5, สมุดโน้ต, แฟ้มเอกสาร, กล่องเก็บเอกสาร
            </p>
            <div className="mt-2 text-[11px] text-blue-700 font-medium flex items-center justify-between">
              <span>ยอดเบิกเฉลี่ย: 10 - 25 ชิ้น/วัน</span>
              <span className="font-mono font-bold">เชลฟ์ B-01 ถึง B-04</span>
            </div>
          </div>

          {/* Zone C */}
          <div
            onClick={() => setSelectedZone(selectedZone === 'C' ? 'ALL' : 'C')}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedZone === 'C'
                ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300'
                : 'bg-amber-50/30 border-amber-200 hover:bg-amber-50/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black font-mono bg-amber-600 text-white">
                Zone C (Slow-moving)
              </span>
              <span className="text-xs font-mono font-bold text-amber-800">
                {zoneCProducts.length} SKUs ({zoneCProducts[0]?.sku || 'BOX-M-021'}...)
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 line-clamp-1">
              กล่องใหญ่, เทปใส, เทปกาว 2 หน้า, ลวดเย็บกระดาษ, คลิปหนีบกระดาษ
            </p>
            <div className="mt-2 text-[11px] text-amber-700 font-medium flex items-center justify-between">
              <span>ยอดเบิกเฉลี่ย: 2 - 12 ชิ้น/วัน</span>
              <span className="font-mono font-bold">เชลฟ์ C-01 ถึง C-04</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar & Display Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา SKU (เช่น PEN-BL-001), ชื่อสินค้า, บาร์โค้ด, Location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Zone Selector */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold"
          >
            <option value="ALL">กลุ่ม ABC: ทั้งหมด (30 SKUs)</option>
            <option value="A">Zone A: Fast Moving (A01 - A10)</option>
            <option value="B">Zone B: Medium Moving (B01 - B10)</option>
            <option value="C">Zone C: Slow Moving (C01 - C10)</option>
          </select>

          {/* Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">หมวดหมู่สินค้า: ทั้งหมด</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* Batch selected count & action */}
          {selectedSkuList.length > 0 && (
            <button
              onClick={() => {
                setSinglePrintProduct(null);
                setPrintScope('custom');
                setPrintModalOpen(true);
              }}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์รายการที่เลือก ({selectedSkuList.length})
            </button>
          )}

          {/* Table / Grid Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <List className="w-3.5 h-3.5" /> ตาราง
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> การ์ดบาร์โค้ด
            </button>
          </div>
        </div>
      </div>

      {/* 3. Products List: Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-500 hover:text-slate-900 cursor-pointer"
                      title="เลือก/ยกเลิกทั้งหมด"
                    >
                      {filteredProducts.every((p) => selectedSkuList.includes(p.sku)) ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 w-12 text-center">No</th>
                  <th className="px-3 py-3 w-20">SKU</th>
                  <th className="px-3.5 py-3">ชื่อสินค้า (Product Name)</th>
                  <th className="px-3 py-3">หมวดหมู่</th>
                  <th className="px-3 py-3">หน่วย</th>
                  <th className="px-3 py-3 text-right">ราคา</th>
                  <th className="px-3 py-3 text-right">ยอด/วัน</th>
                  <th className="px-3 py-3 text-center">กลุ่ม ABC</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3 text-center">ภาพบาร์โค้ด (EAN-13)</th>
                  <th className="px-3 py-3 text-center">จัดการ / พิมพ์</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const isChecked = selectedSkuList.includes(p.sku);
                  return (
                    <tr
                      key={p.sku}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectSku(p.sku)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-400 font-bold text-center">
                        {p.no}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {p.sku}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          สต็อกคงคลัง: <span className="font-mono text-emerald-600 font-bold">{p.currentStock} {p.unit}</span> (Min: {p.minStock} / Max: {p.maxStock})
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{p.category}</td>
                      <td className="px-3 py-3 text-slate-600">{p.unit}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">
                        ฿{p.unitPrice.toFixed(0)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                        {p.dailyOrder}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono inline-block ${
                            p.abc === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.abc === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Zone {p.zone}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {p.location}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <BarcodeView value={p.barcode} height={24} width={130} showText={false} />
                          <span className="text-[10px] font-mono text-slate-500 mt-0.5 font-semibold">
                            {p.barcode}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditProduct(p)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไขข้อมูลสินค้า / แก้ไขรหัส SKU (Open Code)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSinglePrintProduct(p);
                              setPrintModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="พิมพ์ป้ายสินค้านี้"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.sku, p.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบสินค้านี้ออกจากระบบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
            <span>แสดงสินค้า {filteredProducts.length} จากทั้งหมด {products.length} SKUs</span>
            <span>เลือกอยู่: {selectedSkuList.length} รายการ</span>
          </div>
        </div>
      )}

      {/* 4. Products List: Grid View (Barcode Cards) */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.sku}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 font-bold block">
                      No. {p.no} • {p.category}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight mt-0.5">{p.name}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono shrink-0 ${
                      p.abc === 'A'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.abc === 'B'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Zone {p.zone}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1 my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">รหัส SKU:</span>
                    <span className="font-mono font-bold text-slate-800">{p.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-mono font-bold text-indigo-700">{p.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ราคาปลีก:</span>
                    <span className="font-mono font-bold text-slate-800">฿{p.unitPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">สต็อกคงคลัง:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {p.currentStock} {p.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barcode Graphic */}
              <div className="text-center pt-2 border-t border-slate-100 flex flex-col items-center">
                <BarcodeView value={p.barcode} height={32} width={160} showText={true} />
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEditProduct(p)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                    title="แก้ไขข้อมูลสินค้า / SKU"
                  >
                    <Pencil className="w-3.5 h-3.5" /> แก้ไข
                  </button>
                  <button
                    onClick={() => {
                      setSinglePrintProduct(p);
                      setPrintModalOpen(true);
                    }}
                    className="text-[11px] text-slate-600 hover:text-indigo-600 font-semibold flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                    title="พิมพ์ป้ายสติ๊กเกอร์"
                  >
                    <Printer className="w-3.5 h-3.5" /> พิมพ์
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.sku, p.name)}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer px-2 py-1 rounded hover:bg-rose-50 transition-colors"
                    title="ลบสินค้านี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> ลบ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. Barcode Label Print Station Modal */}
      {printModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-5 sm:p-6 border border-slate-200 my-auto max-h-[95vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:p-0">
            
            {/* Modal Header (Hidden on actual print) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-200 gap-3 no-print">
              <div>
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    {singlePrintProduct
                      ? `พิมพ์ป้ายบาร์โค้ด: ${singlePrintProduct.name} (${singlePrintProduct.sku})`
                      : `สถานีพิมพ์สติ๊กเกอร์บาร์โค้ด (Barcode Printing Station - ${itemsToPrint.length} SKUs)`}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกรูปแบบป้ายที่ต้องการพิมพ์: สติ๊กเกอร์ A4, ป้ายหน้าชั้นวาง (Shelf Tag) หรือ ป้ายความร้อน (Thermal Label)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="modal-download-file-btn"
                  onClick={handleDownloadPrintFile}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="ดาวน์โหลดไฟล์สติ๊กเกอร์ A4 / Thermal นำไปเปิดพิมพ์ได้ทุกเครื่อง"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" />
                  <span>ดาวน์โหลดไฟล์พิมพ์</span>
                </button>

                <button
                  id="modal-open-tab-btn"
                  onClick={handleOpenPrintTab}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="เปิดหน้าพิมพ์ในแท็บใหม่เพื่อหลีกเลี่ยงการโดน iFrame บล็อกหน้าต่างพิมพ์"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-300" />
                  <span>เปิดหน้าพิมพ์ในแท็บใหม่</span>
                </button>

                <button
                  id="modal-print-execute-btn"
                  onClick={handleTriggerPrint}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  title="สั่งพิมพ์ผ่านเบราว์เซอร์ทันที"
                >
                  <Printer className="w-4 h-4" /> สั่งพิมพ์ทันที
                </button>

                <button
                  onClick={() => setPrintModalOpen(false)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Print Help Banner & Feedback */}
            <div className="no-print mt-3 mb-1 space-y-2">
              {printFeedback && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{printFeedback}</span>
                </div>
              )}

              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold">💡 เคล็ดลับการพิมพ์:</span>{' '}
                  หากเบราว์เซอร์บล็อกหน้าต่างพิมพ์ในโหมดแสดงตัวอย่าง (Preview Frame) ให้คลิก{' '}
                  <strong className="text-indigo-900 font-bold">"เปิดหน้าพิมพ์ในแท็บใหม่"</strong> หรือ{' '}
                  <strong className="text-emerald-900 font-bold">"ดาวน์โหลดไฟล์พิมพ์"</strong>{' '}
                  เพื่อสั่งพิมพ์ออกเครื่องพิมพ์สติ๊กเกอร์จริง หรือบันทึกเป็น PDF ได้ทันที 100%
                </div>
                {directPrintUrl && (
                  <a
                    href={directPrintUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold inline-flex items-center gap-1 text-[11px] shadow-2xs"
                  >
                    <ExternalLink className="w-3 h-3" /> เปิดแท็บพิมพ์
                  </a>
                )}
              </div>
            </div>

            {/* Print Customization Controls (Hidden on actual print) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3 border-b border-slate-200 bg-slate-50/70 -mx-5 sm:-mx-6 px-5 sm:px-6 no-print text-xs">
              {/* Template Style */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">รูปแบบสติ๊กเกอร์:</label>
                <select
                  value={labelTemplate}
                  onChange={(e) => setLabelTemplate(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value="a4-standard">สติ๊กเกอร์ A4 (ตาราง 3 คอลัมน์)</option>
                  <option value="shelf-tag">ป้ายหน้าชั้นวาง (Shelf Tag เด่นชัด)</option>
                  <option value="compact-thermal">ป้ายความร้อนเดี่ยว (Compact 50x30mm)</option>
                </select>
              </div>

              {/* Print Scope (if not single product) */}
              {!singlePrintProduct && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ขอบเขตสินค้า:</label>
                  <select
                    value={printScope}
                    onChange={(e) => setPrintScope(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
                  >
                    <option value="all">ทั้งหมด 30 SKUs (ครบ Zone A, B, C)</option>
                    <option value="zone-a">เฉพาะ Zone A (Fast Moving - 10 SKUs)</option>
                    <option value="zone-b">เฉพาะ Zone B (Medium Moving - 10 SKUs)</option>
                    <option value="zone-c">เฉพาะ Zone C (Slow Moving - 10 SKUs)</option>
                    <option value="custom">รายการที่เลือก ({selectedSkuList.length} SKUs)</option>
                  </select>
                </div>
              )}

              {/* Copies per SKU */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">จำนวนดวงต่อ SKU:</label>
                <select
                  value={labelCopies}
                  onChange={(e) => setLabelCopies(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium"
                >
                  <option value={1}>1 ดวง / รายการ (รวม {itemsToPrint.length * 1} ดวง)</option>
                  <option value={2}>2 ดวง / รายการ (รวม {itemsToPrint.length * 2} ดวง)</option>
                  <option value={3}>3 ดวง / รายการ (รวม {itemsToPrint.length * 3} ดวง)</option>
                  <option value={4}>4 ดวง / รายการ (รวม {itemsToPrint.length * 4} ดวง)</option>
                </select>
              </div>

              {/* Toggle Details */}
              <div className="flex flex-col justify-center gap-1.5">
                <span className="font-bold text-slate-700">ตัวเลือกการแสดงผล:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLocation}
                      onChange={(e) => setShowLocation(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Location
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    ราคาปลีก
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCutLines}
                      onChange={(e) => setShowCutLines(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    เส้นประตัด
                  </label>
                </div>
              </div>
            </div>

            {/* Printable Area / Preview Sheet */}
            <div className="flex-1 overflow-y-auto mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200 print:bg-white print:border-none print:p-0 print:overflow-visible printable-sheet-container">
              
              {/* Sheet Header for Printed Document */}
              <div className="mb-4 pb-2 border-b-2 border-slate-900 flex justify-between items-end">
                <div>
                  <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">
                    Warehouse Barcode Label Sheet (มาสเตอร์บาร์โค้ดสินค้าคลัง)
                  </h2>
                  <p className="text-[10px] text-slate-600">
                    พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH')} | จำนวนสติ๊กเกอร์: {itemsToPrint.length * labelCopies} ดวง | ระบบ WMS Simulation
                  </p>
                </div>
                <div className="text-right font-mono text-[10px] font-bold text-slate-800">
                  ABC CLASSIFICATION: 30 SKUS
                </div>
              </div>

              {/* Grid of Labels */}
              <div
                className={`grid gap-3 ${
                  labelTemplate === 'shelf-tag'
                    ? 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
                    : labelTemplate === 'compact-thermal'
                    ? 'grid-cols-2 sm:grid-cols-4 print:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-3 print:grid-cols-3'
                }`}
              >
                {itemsToPrint.flatMap((p) =>
                  Array.from({ length: labelCopies }).map((_, copyIdx) => (
                    <div
                      key={`${p.sku}-copy-${copyIdx}`}
                      className={`bg-white p-3 rounded-lg flex flex-col justify-between text-center print-page-break transition-all ${
                        showCutLines ? 'border-2 border-dashed border-slate-300' : 'border border-slate-200'
                      } ${labelTemplate === 'shelf-tag' ? 'p-4 min-h-[140px]' : 'min-h-[120px]'}`}
                    >
                      {/* Top Header of sticker */}
                      <div className="w-full flex justify-between items-center text-[10px] font-mono text-slate-500 pb-1 border-b border-slate-100">
                        <span className="font-bold text-slate-900 bg-slate-100 px-1 rounded">{p.sku}</span>
                        {showCategory && <span className="truncate max-w-[120px]">{p.category}</span>}
                        <span
                          className={`font-black px-1.5 py-0.2 rounded text-[9px] ${
                            p.abc === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.abc === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Zone {p.zone}
                        </span>
                      </div>

                      {/* Product Name & Location */}
                      <div className="py-1">
                        <p className="font-bold text-xs text-slate-900 line-clamp-2 leading-tight">
                          {p.name}
                        </p>
                        
                        <div className="flex items-center justify-center gap-3 mt-1 text-[11px]">
                          {showLocation && (
                            <span className="font-mono font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                              LOC: {p.location}
                            </span>
                          )}
                          {showPrice && (
                            <span className="font-mono font-bold text-slate-800">
                              ฿{p.unitPrice.toFixed(0)}/{p.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Vector Barcode Graphic */}
                      <div className="pt-1 flex flex-col items-center">
                        <BarcodeView
                          value={p.barcode}
                          height={labelTemplate === 'shelf-tag' ? 36 : 28}
                          width={labelTemplate === 'shelf-tag' ? 190 : 150}
                          showText={true}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Footer Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-200 mt-3 no-print gap-3">
              <span className="text-xs text-slate-500">
                พร้อมพิมพ์สติ๊กเกอร์ทั้งหมด <strong className="text-slate-900">{itemsToPrint.length * labelCopies} ดวง</strong> (จาก {itemsToPrint.length} SKUs)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPrintModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  onClick={handleDownloadPrintFile}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <FileDown className="w-4 h-4 text-emerald-600" /> ดาวน์โหลดไฟล์พิมพ์
                </button>
                <button
                  onClick={handleOpenPrintTab}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-300" /> เปิดหน้าพิมพ์ในแท็บใหม่
                </button>
                <button
                  onClick={handleTriggerPrint}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Printer className="w-4 h-4" /> สั่งพิมพ์ทันที
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal (Requirement 1 & 13) */}
      {addProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 my-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  เพิ่มข้อมูลสินค้าใหม่ (Product Master Registration)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  สินค้าทุกรายการต้องมี Barcode ประจำตัวในระบบ พร้อมข้อมูลควบคุมสต็อก
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addFeedback && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {addFeedback}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProductForm.name) {
                  alert('กรุณากรอกชื่อสินค้า');
                  return;
                }
                const result = addProduct({
                  ...newProductForm,
                  sku: newProductForm.sku || undefined,
                  barcode: newProductForm.barcode || undefined,
                });
                if (result.success) {
                  setAddFeedback(result.message);
                  setTimeout(() => {
                    setAddProductModalOpen(false);
                    setAddFeedback(null);
                  }, 1200);
                }
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* SKU */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    รหัสสินค้า (SKU) <span className="text-slate-400 font-normal">(เว้นว่างเพื่อสร้างอัตโนมัติ)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น PEN-BL-031"
                    value={newProductForm.sku}
                    onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs uppercase"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">
                    ชื่อสินค้า (Product Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ปากกาหมึกเจลสีเขียว 0.5 มม."
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Barcode & Format */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">Barcode ประจำตัว</label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomSuffix = Math.floor(100000000000 + Math.random() * 900000000000);
                        setNewProductForm({ ...newProductForm, barcode: `885${randomSuffix.toString().slice(0, 9)}` });
                      }}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      สุ่มสร้าง EAN-13
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="เว้นว่างเพื่อให้ระบบสร้างให้อัตโนมัติ"
                    value={newProductForm.barcode}
                    onChange={(e) => setNewProductForm({ ...newProductForm, barcode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>

                {/* Barcode Type */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">ประเภทรหัส (Barcode Format)</label>
                  <select
                    value={newProductForm.barcodeType}
                    onChange={(e) => setNewProductForm({ ...newProductForm, barcodeType: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Code 128">Code 128</option>
                    <option value="EAN-13">EAN-13</option>
                    <option value="Code 39">Code 39</option>
                    <option value="UPC">UPC</option>
                    <option value="QR Code">QR Code</option>
                    <option value="Internal">Barcode ภายในระบบ</option>
                  </select>
                </div>

                {/* Category & Unit */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">หมวดหมู่สินค้า</label>
                  <input
                    type="text"
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">หน่วยนับ</label>
                  <select
                    value={newProductForm.unit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="ด้าม">ด้าม</option>
                    <option value="ชิ้น">ชิ้น</option>
                    <option value="กล่อง">กล่อง</option>
                    <option value="รีม">รีม</option>
                    <option value="แพ็ค">แพ็ค</option>
                    <option value="พาเลท">พาเลท</option>
                  </select>
                </div>

                {/* Location & Zone */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Location จัดเก็บ (เช่น A-01-01)</label>
                  <input
                    type="text"
                    value={newProductForm.location}
                    onChange={(e) => {
                      const loc = e.target.value.toUpperCase();
                      const z = loc.startsWith('A') ? 'A' : loc.startsWith('B') ? 'B' : 'C';
                      setNewProductForm({ ...newProductForm, location: loc, zone: z });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs uppercase"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">ราคาต่อหน่วย (บาท)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.unitPrice}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unitPrice: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Initial Stock & Min/Max */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">จำนวนรับเข้าเริ่มต้น (Initial Stock)</label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.initialStock}
                    onChange={(e) => setNewProductForm({ ...newProductForm, initialStock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Min Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={newProductForm.minStock}
                      onChange={(e) => setNewProductForm({ ...newProductForm, minStock: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Max Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={newProductForm.maxStock}
                      onChange={(e) => setNewProductForm({ ...newProductForm, maxStock: Number(e.target.value) })}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Lot, Received Date, Expiry */}
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Lot / Batch No.</label>
                  <input
                    type="text"
                    value={newProductForm.lotBatch}
                    onChange={(e) => setNewProductForm({ ...newProductForm, lotBatch: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">วันหมดอายุ (Expiry Date)</label>
                  <input
                    type="text"
                    value={newProductForm.expiryDate}
                    onChange={(e) => setNewProductForm({ ...newProductForm, expiryDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Requirement 1 Policy Note */}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>นโยบายบาร์โค้ด WMS:</strong> สินค้าทุกชิ้นในระบบต้องมี Barcode ประจำตัว หากไม่ระบุ ระบบจะสร้าง Barcode ภายในให้โดยอัตโนมัติ เพื่อรองรับการสแกนด้วยเครื่องอ่าน Barcode ทุกประเภท
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  บันทึกสินค้าใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Edit Product Modal (Open Code & Master Data Editing) */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    แก้ไขข้อมูลสินค้า (Edit SKU: {editingSku})
                  </h3>
                  <p className="text-xs text-slate-500">
                    แก้ไขรายละเอียดสินค้า รหัส SKU บาร์โค้ด โลเคชั่น และสต็อกคงคลัง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {editFeedback && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  editFeedback.includes('สำเร็จ')
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {editFeedback.includes('สำเร็จ') ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{editFeedback}</span>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {/* Product Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  ชื่อสินค้า (Product Name) *
                </label>
                <input
                  type="text"
                  value={editProductForm.name || ''}
                  onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* SKU & Barcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    รหัสสินค้า (SKU Code)
                  </label>
                  <input
                    type="text"
                    value={editProductForm.sku || ''}
                    onChange={(e) => setEditProductForm({ ...editProductForm, sku: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold bg-slate-50 text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    รหัสบาร์โค้ด (Barcode)
                  </label>
                  <input
                    type="text"
                    value={editProductForm.barcode || ''}
                    onChange={(e) => setEditProductForm({ ...editProductForm, barcode: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    หมวดหมู่ (Category)
                  </label>
                  <input
                    type="text"
                    value={editProductForm.category || ''}
                    onChange={(e) => setEditProductForm({ ...editProductForm, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    หน่วยนับ (Unit)
                  </label>
                  <input
                    type="text"
                    value={editProductForm.unit || ''}
                    onChange={(e) => setEditProductForm({ ...editProductForm, unit: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Location & Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Location เชลฟ์ (เช่น A-01-01)
                  </label>
                  <input
                    type="text"
                    value={editProductForm.location || ''}
                    onChange={(e) => setEditProductForm({ ...editProductForm, location: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-indigo-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Zone (กลุ่ม ABC)
                  </label>
                  <select
                    value={editProductForm.zone || 'A'}
                    onChange={(e) => setEditProductForm({ ...editProductForm, zone: e.target.value as any, abc: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    <option value="A">Zone A (Fast-moving)</option>
                    <option value="B">Zone B (Medium-moving)</option>
                    <option value="C">Zone C (Slow-moving)</option>
                  </select>
                </div>
              </div>

              {/* Current Stock & Unit Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    สต็อกคงคลังปัจจุบัน (Current Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editProductForm.currentStock ?? 0}
                    onChange={(e) => setEditProductForm({ ...editProductForm, currentStock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ราคาต่อหน่วย (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editProductForm.unitPrice ?? 0}
                    onChange={(e) => setEditProductForm({ ...editProductForm, unitPrice: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Min & Max Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    จุดสั่งซื้อขั้นต่ำ (Min Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editProductForm.minStock ?? 0}
                    onChange={(e) => setEditProductForm({ ...editProductForm, minStock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ความจุสต็อกสูงสุด (Max Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editProductForm.maxStock ?? 0}
                    onChange={(e) => setEditProductForm({ ...editProductForm, maxStock: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Barcode Preview */}
              {editProductForm.barcode && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    ภาพตัวอย่างบาร์โค้ด
                  </span>
                  <div className="flex justify-center">
                    <BarcodeView value={editProductForm.barcode} height={32} width={180} showText={true} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEditProduct}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
