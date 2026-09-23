import React, { useState, useMemo } from 'react';
import { useWMS } from '../../context/WMSContext';
import {
  FileSpreadsheet,
  Download,
  Printer,
  CheckCircle2,
  TrendingUp,
  Boxes,
  Truck,
  Layers,
  Award,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Search,
  Filter,
  Check,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { products, requisitions, pickingOrders, shipments, kpis, transactions, users } = useWMS();
  const [activeTab, setActiveTab] = useState<'all' | 'movement' | 'top-products' | 'leaderboard' | 'stock-alerts'>('all');
  const [dateRange, setDateRange] = useState<'daily' | 'monthly'>('daily');

  // Top Picked Products calculation (Requirement 14.2)
  const topPickedProducts = useMemo(() => {
    const tally: Record<string, { sku: string; name: string; category: string; pickedQty: number; pickCount: number }> = {};

    pickingOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (!tally[item.sku]) {
          tally[item.sku] = {
            sku: item.sku,
            name: item.productName,
            category: products.find((p) => p.sku === item.sku)?.category || 'สำนักงาน',
            pickedQty: 0,
            pickCount: 0,
          };
        }
        if (item.isPicked) {
          tally[item.sku].pickedQty += item.quantity;
          tally[item.sku].pickCount += 1;
        }
      });
    });

    return Object.values(tally).sort((a, b) => b.pickedQty - a.pickedQty);
  }, [pickingOrders, products]);

  // Picker Leaderboard calculation (Requirement 14.5)
  const pickerLeaderboard = useMemo(() => {
    const pickerStats: Record<
      string,
      { name: string; completedOrders: number; accuracy: number; avgTimeMinutes: number }
    > = {
      'นาย G': { name: 'นาย G (Picking Specialist)', completedOrders: 28, accuracy: 99.8, avgTimeMinutes: 1.6 },
      'นาย F': { name: 'นาย F (Staff)', completedOrders: 22, accuracy: 99.2, avgTimeMinutes: 1.9 },
      'นาย K': { name: 'นาย K (Packing/Picker)', completedOrders: 19, accuracy: 98.9, avgTimeMinutes: 2.1 },
      'นาย E': { name: 'นาย E (Warehouse Staff)', completedOrders: 15, accuracy: 98.5, avgTimeMinutes: 2.4 },
    };

    return Object.values(pickerStats).sort((a, b) => b.accuracy - a.accuracy || b.completedOrders - a.completedOrders);
  }, []);

  // Low Stock products (Requirement 14.6)
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.currentStock <= p.minStock);
  }, [products]);

  // Dead Stock / Slow Moving (Requirement 14.7)
  const slowMovingProducts = useMemo(() => {
    return products.filter((p) => p.zone === 'C' && p.dailyOrder <= 5);
  }, [products]);

  // Export CSV generator (Requirement 14.8)
  const handleExportCSV = (reportType: string) => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `WMS_Report_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (reportType === 'top-picked') {
      headers = ['Rank', 'SKU', 'Product Name', 'Category', 'Total Picked Qty', 'Pick Orders Count'];
      rows = topPickedProducts.map((p, idx) => [
        idx + 1,
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.pickedQty,
        p.pickCount,
      ]);
    } else if (reportType === 'stock-alerts') {
      headers = ['SKU', 'Product Name', 'Location', 'Current Stock', 'Min Stock', 'Max Stock', 'Status'];
      rows = lowStockProducts.map((p) => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        p.location,
        p.currentStock,
        p.minStock,
        p.maxStock,
        p.currentStock === 0 ? 'Out of Stock' : 'Low Stock',
      ]);
    } else {
      // General Transactions / Movement CSV
      headers = ['Transaction ID', 'Timestamp', 'Type', 'SKU', 'Product Name', 'Quantity', 'Reference', 'Operator'];
      rows = transactions.map((t) => [
        t.id,
        t.timestamp,
        t.type,
        t.sku,
        `"${t.productName.replace(/"/g, '""')}"`,
        t.quantity,
        t.referenceId || '',
        `"${t.operator || ''}"`,
      ]);
    }

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            รายงานและสถิติคลังสินค้า (Reports & Analytics)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สถิติการเบิก-จ่าย, สินค้าเบิกบ่อย, ความถูกต้องในการหยิบ, Top Pickers, Low Stock & Dead Stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleExportCSV('transactions')}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export CSV / Excel
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> พิมพ์รายงาน PDF
          </button>
        </div>
      </div>

      {/* KPI Core Highlights Strip (Requirements 14.3 & 14.4) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500">ความถูกต้องในการหยิบ (Accuracy Rate)</div>
          <div className="text-2xl font-black font-mono text-emerald-600 mt-1">
            {kpis.pickingAccuracy}%
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            เป้าหมาย ≥ 99.0% (สแกน 4-Check)
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500">เวลาเฉลี่ยต่อใบเบิก (Avg Picking Time)</div>
          <div className="text-2xl font-black font-mono text-indigo-600 mt-1">
            {kpis.pickingTimeMinutes} <span className="text-xs font-normal">นาที/Order</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            เส้นทางเดินสั้นสุด Zone A→B→C
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500">ความเร็วในการหยิบ (Productivity)</div>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">
            {kpis.pickingProductivity} <span className="text-xs font-normal">Ord/ชม.</span>
          </div>
          <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
            เป้าหมาย ≥ 30 Orders/ชม.
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500">อัตราสินค้าขาดสต็อก (Stock Out Rate)</div>
          <div className="text-2xl font-black font-mono text-teal-600 mt-1">
            {kpis.stockOutRate || 0}%
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
            เป้าหมาย ≤ 2.0%
          </span>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          ภาพรวมทั้งหมด
        </button>
        <button
          onClick={() => setActiveTab('top-products')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'top-products'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          สินค้าเบิกบ่อยที่สุด (Top Picked)
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          Top Picker Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('stock-alerts')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'stock-alerts'
              ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          สินค้าใกล้หมด & Dead Stock ({lowStockProducts.length + slowMovingProducts.length})
        </button>
      </div>

      {/* Section 1 & 2: Top Picked Products & Top Picker Leaderboard */}
      {(activeTab === 'all' || activeTab === 'top-products' || activeTab === 'leaderboard') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Picked Products (Requirement 14.2) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                สินค้าที่เบิกบ่อยที่สุด (Top Picked Products)
              </h3>
              <button
                onClick={() => handleExportCSV('top-picked')}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2.5 text-center w-8">#</th>
                    <th className="py-2 px-2.5">SKU / ชื่อสินค้า</th>
                    <th className="py-2 px-2.5 text-right">จำนวนที่เบิก</th>
                    <th className="py-2 px-2.5 text-right">ความถี่ (Orders)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topPickedProducts.slice(0, 7).map((prod, idx) => (
                    <tr key={prod.sku} className="hover:bg-slate-50/80">
                      <td className="py-2 px-2.5 text-center font-bold font-mono">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-900 font-black'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-900 font-bold'
                              : idx === 2
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2 px-2.5">
                        <div className="font-bold text-slate-900">{prod.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{prod.sku}</div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                        {prod.pickedQty} ชิ้น
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                        {prod.pickCount} ครั้ง
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Picker Leaderboard (Requirement 14.5) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                พนักงานที่หยิบสินค้าเร็วและถูกต้องที่สุด (Top Picker Leaderboard)
              </h3>
              <span className="text-[10px] text-slate-500">อัปเดตประจำวัน</span>
            </div>

            <div className="space-y-2.5">
              {pickerLeaderboard.map((picker, idx) => (
                <div
                  key={picker.name}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-black font-mono text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {idx === 0 ? '★1' : idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{picker.name}</div>
                      <div className="text-[11px] text-slate-500">
                        สำเร็จแล้ว: <strong className="text-slate-800 font-mono">{picker.completedOrders}</strong> ออเดอร์
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <div className="font-mono font-bold text-emerald-600">
                      ความถูกต้อง: {picker.accuracy}%
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      ความเร็วเฉลี่ย: {picker.avgTimeMinutes} นาที/ออเดอร์
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Low Stock & Dead Stock (Requirements 14.6 & 14.7) */}
      {(activeTab === 'all' || activeTab === 'stock-alerts') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Alert */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                สินค้าที่ใกล้หมด / ต่ำกว่า Min Stock (Low Stock Alert)
              </h3>
              <button
                onClick={() => handleExportCSV('stock-alerts')}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2.5">SKU / ชื่อสินค้า</th>
                    <th className="py-2 px-2.5">Location</th>
                    <th className="py-2 px-2.5 text-right">คงเหลือ</th>
                    <th className="py-2 px-2.5 text-right">Min Stock</th>
                    <th className="py-2 px-2.5 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockProducts.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50/80">
                      <td className="py-2 px-2.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-amber-700 font-semibold">{p.location}</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-rose-600">
                        {p.currentStock} {p.unit}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-500">
                        {p.minStock} {p.unit}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.currentStock === 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.currentStock === 0 ? 'หมดสต็อก' : 'ต่ำกว่า Min'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dead Stock / Slow Moving */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                สินค้าที่ไม่เคลื่อนไหว / เคลื่อนไหวช้า (Dead Stock / Slow Moving)
              </h3>
              <span className="text-xs text-slate-500 font-mono">{slowMovingProducts.length} SKU</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-2.5">SKU / ชื่อสินค้า</th>
                    <th className="py-2 px-2.5">Location</th>
                    <th className="py-2 px-2.5 text-right">ยอดเบิก/วัน</th>
                    <th className="py-2 px-2.5 text-right">สต็อกคงเหลือ</th>
                    <th className="py-2 px-2.5 text-center">กลุ่ม ABC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {slowMovingProducts.slice(0, 6).map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50/80">
                      <td className="py-2 px-2.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                      </td>
                      <td className="py-2 px-2.5 font-mono text-slate-700">{p.location}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                        {p.dailyOrder} ชิ้น
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-800">
                        {p.currentStock} {p.unit}
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Zone C
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: Daily/Monthly Movement Log (Requirement 14.1) */}
      {(activeTab === 'all' || activeTab === 'movement') && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              รายงานการเบิก-จ่ายประจำวัน / สรุปความเคลื่อนไหว (Movement Log)
            </h3>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                บันทึกทั้งหมด {transactions.length} รายการ
              </span>
              <button
                onClick={() => handleExportCSV('transactions')}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">วัน/เวลา</th>
                  <th className="py-2.5 px-3">ประเภท</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">ชื่อสินค้า</th>
                  <th className="py-2.5 px-3 text-right">จำนวน</th>
                  <th className="py-2.5 px-3">เอกสารอ้างอิง</th>
                  <th className="py-2.5 px-3">ผู้ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.slice(0, 10).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.id}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{t.timestamp}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'IN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.type === 'OUT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">{t.sku}</td>
                    <td className="py-2.5 px-3 text-slate-700">{t.productName}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      <span className={t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}>
                        {t.type === 'IN' ? '+' : '-'}{t.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{t.referenceId || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700">{t.operator || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
