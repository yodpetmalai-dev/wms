import React, { useState, useMemo } from 'react';
import { useWMS } from '../../context/WMSContext';
import { Product, ABCClass } from '../../types/wms';
import {
  Boxes,
  Search,
  Filter,
  Download,
  SlidersHorizontal,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MoveRight,
  Plus,
} from 'lucide-react';
import { BarcodeView } from '../BarcodeView';

export const InventoryView: React.FC = () => {
  const { products, adjustStock, transferStock, locations } = useWMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof Product>('no');
  const [sortAsc, setSortAsc] = useState(true);

  // Modal states
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [newStockValue, setNewStockValue] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('ตรวจนับ Cycle Count ประจำสัปดาห์');

  const [transferModalProduct, setTransferModalProduct] = useState<Product | null>(null);
  const [targetLocation, setTargetLocation] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number>(10);

  // Metrics
  const totalSku = products.length;
  const totalStock = products.reduce((acc, p) => acc + p.currentStock, 0);
  const lowStock = products.filter((p) => p.currentStock <= p.minStock && p.currentStock > 0);
  const outOfStock = products.filter((p) => p.currentStock <= 0);
  const stockValue = products.reduce((acc, p) => acc + p.currentStock * p.unitPrice, 0);

  const fastMovingCount = products.filter((p) => p.abc === 'A').length;
  const mediumMovingCount = products.filter((p) => p.abc === 'B').length;
  const slowMovingCount = products.filter((p) => p.abc === 'C').length;

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchQuery =
          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.barcode.toLowerCase().includes(searchQuery.toLowerCase());

        const matchZone = selectedZone === 'ALL' || p.zone === selectedZone;

        let matchStatus = true;
        if (selectedStatus === 'LOW') matchStatus = p.currentStock <= p.minStock && p.currentStock > 0;
        if (selectedStatus === 'OUT') matchStatus = p.currentStock <= 0;
        if (selectedStatus === 'NORMAL') matchStatus = p.currentStock > p.minStock;

        return matchQuery && matchZone && matchStatus;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [products, searchQuery, selectedZone, selectedStatus, sortField, sortAsc]);

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportCSV = () => {
    const headers = ['No', 'SKU', 'Product Name', 'Unit', 'Stock', 'Min Stock', 'Max Stock', 'Daily Order', 'ABC', 'Location', 'Zone', 'Price'];
    const rows = filteredProducts.map((p) => [
      p.no,
      p.sku,
      `"${p.name}"`,
      p.unit,
      p.currentStock,
      p.minStock,
      p.maxStock,
      p.dailyOrder,
      p.abc,
      p.location,
      p.zone,
      p.unitPrice,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WMS_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustModalProduct) {
      adjustStock(adjustModalProduct.sku, newStockValue, adjustReason);
      setAdjustModalProduct(null);
    }
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferModalProduct && targetLocation) {
      transferStock(transferModalProduct.sku, transferModalProduct.location, targetLocation, transferQty);
      setTransferModalProduct(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top 8 Summary Cards (Prompt Section 12) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Total SKU</span>
          <span className="text-xl font-black font-mono text-slate-900">{totalSku}</span>
          <span className="text-[10px] text-slate-400 block">รายการสินค้า</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Stock</span>
          <span className="text-xl font-black font-mono text-emerald-600">{totalStock.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 block">ชิ้นทั้งหมด</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Low Stock</span>
          <span className="text-xl font-black font-mono text-amber-600">{lowStock.length}</span>
          <span className="text-[10px] text-slate-400 block">ต้องสั่งเพิ่ม</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Out of Stock</span>
          <span className="text-xl font-black font-mono text-rose-600">{outOfStock.length}</span>
          <span className="text-[10px] text-slate-400 block">สินค้าหมด</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">Stock Value</span>
          <span className="text-lg font-black font-mono text-indigo-600">฿{stockValue.toLocaleString()}</span>
          <span className="text-[10px] text-slate-400 block">มูลค่ารวม</span>
        </div>
        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] text-emerald-800 font-bold uppercase block">Fast Moving</span>
          <span className="text-xl font-black font-mono text-emerald-700">{fastMovingCount} SKU</span>
          <span className="text-[10px] text-emerald-700 block">Group A (Zone A)</span>
        </div>
        <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 shadow-2xs">
          <span className="text-[10px] text-blue-800 font-bold uppercase block">Medium Moving</span>
          <span className="text-xl font-black font-mono text-blue-700">{mediumMovingCount} SKU</span>
          <span className="text-[10px] text-blue-700 block">Group B (Zone B)</span>
        </div>
        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] text-amber-800 font-bold uppercase block">Slow Moving</span>
          <span className="text-xl font-black font-mono text-amber-700">{slowMovingCount} SKU</span>
          <span className="text-[10px] text-amber-700 block">Group C (Zone C)</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา SKU, ชื่อสินค้า, Barcode, Location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Zone Filter */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">ทุก Zone (A, B, C)</option>
            <option value="A">Zone A (Fast Moving)</option>
            <option value="B">Zone B (Medium Moving)</option>
            <option value="C">Zone C (Slow Moving)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">สถานะ Stock ทั้งหมด</option>
            <option value="NORMAL">ปกติ (In Stock)</option>
            <option value="LOW">ใกล้หมด (Low Stock)</option>
            <option value="OUT">หมดสต็อก (Out of Stock)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Inventory Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th
                  onClick={() => handleSort('no')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none"
                >
                  <div className="flex items-center gap-1">No <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th
                  onClick={() => handleSort('sku')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none"
                >
                  <div className="flex items-center gap-1">SKU / Barcode <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none"
                >
                  <div className="flex items-center gap-1">ชื่อสินค้า <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3">หน่วย</th>
                <th
                  onClick={() => handleSort('currentStock')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none text-right"
                >
                  <div className="flex items-center justify-end gap-1">Stock คงเหลือ <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3 text-right">Daily Order</th>
                <th
                  onClick={() => handleSort('abc')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none"
                >
                  <div className="flex items-center gap-1">ABC <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th
                  onClick={() => handleSort('location')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 select-none"
                >
                  <div className="flex items-center gap-1">Location <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-4 py-3">สถานะสต็อก</th>
                <th className="px-4 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLow = p.currentStock <= p.minStock && p.currentStock > 0;
                const isOut = p.currentStock <= 0;

                return (
                  <tr key={p.sku} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 font-bold">{p.no}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900">{p.sku}</div>
                      <div className="text-[10px] text-slate-400 font-mono">BC: {p.barcode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-[10px] text-slate-400">ราคา: ฿{p.unitPrice} / {p.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.unit}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono font-bold text-sm ${
                          isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                        }`}
                      >
                        {p.currentStock.toLocaleString()}
                      </span>
                      <div className="text-[10px] text-slate-400">Min: {p.minStock}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">{p.dailyOrder}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                          p.abc === 'A'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.abc === 'B'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Group {p.abc}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {p.location}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Zone {p.zone}</span>
                    </td>
                    <td className="px-4 py-3">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <AlertTriangle className="w-3 h-3" /> สินค้าหมด
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> สต็อกต่ำ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> ปกติ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setAdjustModalProduct(p);
                            setNewStockValue(p.currentStock);
                          }}
                          title="ปรับยอดสต็อก"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium"
                        >
                          ปรับสต็อก
                        </button>
                        <button
                          onClick={() => {
                            setTransferModalProduct(p);
                            setTargetLocation('');
                            setTransferQty(Math.min(10, p.currentStock));
                          }}
                          title="ย้ายตำแหน่งจัดเก็บ"
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-medium"
                        >
                          ย้าย Loc
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">
              ปรับยอดสต็อกคงคลัง (Stock Adjustment)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {adjustModalProduct.name} ({adjustModalProduct.sku})
            </p>

            <form onSubmit={handleConfirmAdjust} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-slate-600 block mb-1">สต็อกปัจจุบัน:</label>
                <div className="p-2 bg-slate-100 rounded font-mono font-bold text-slate-800">
                  {adjustModalProduct.currentStock} {adjustModalProduct.unit}
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">ยอดสต็อกใหม่:</label>
                <input
                  type="number"
                  min="0"
                  value={newStockValue}
                  onChange={(e) => setNewStockValue(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded font-mono text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">สาเหตุการปรับยอด:</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                >
                  บันทึกการปรับยอด
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Location Modal */}
      {transferModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">
              ย้ายตำแหน่งจัดเก็บสินค้า (Location Transfer)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {transferModalProduct.name} ({transferModalProduct.sku})
            </p>

            <form onSubmit={handleConfirmTransfer} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-1">จาก Location:</label>
                  <div className="p-2 bg-slate-100 rounded font-mono font-bold text-slate-800">
                    {transferModalProduct.location} (Zone {transferModalProduct.zone})
                  </div>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">ไปยัง Location ใหม่:</label>
                  <select
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  >
                    <option value="">-- เลือก Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.code} value={loc.code}>
                        {loc.code} ({loc.zoneName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">จำนวนที่ย้าย ({transferModalProduct.unit}):</label>
                <input
                  type="number"
                  min="1"
                  max={transferModalProduct.currentStock}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded font-mono text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferModalProduct(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
                >
                  ยืนยันการย้าย Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
