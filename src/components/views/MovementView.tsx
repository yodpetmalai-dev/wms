import React, { useState } from 'react';
import { useWMS } from '../../context/WMSContext';
import { TransactionType } from '../../types/wms';
import { History, Search, Download, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Sliders } from 'lucide-react';

export const MovementView: React.FC = () => {
  const { transactions } = useWMS();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const filtered = transactions.filter((t) => {
    const matchQ =
      t.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.operator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.requestNo && t.requestNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchType = typeFilter === 'ALL' || t.type === typeFilter;
    return matchQ && matchType;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'SKU', 'Product Name', 'Quantity', 'From Loc', 'To Loc', 'Operator', 'Reference', 'Reason'];
    const rows = filtered.map((t) => [
      `"${t.date}"`,
      t.type,
      t.sku,
      `"${t.productName}"`,
      t.quantity,
      t.fromLocation,
      t.toLocation,
      `"${t.operator}"`,
      t.requestNo || '-',
      `"${t.reason || '-'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WMS_Stock_Movement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            ประวัติการเคลื่อนไหวสินค้าคงคลัง (Stock Movement & Audit Log)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกทุกธุรกรรมรับเข้า (IN), ตัดจ่าย (OUT), ย้ายพิกัด (TRANSFER) และปรับยอด (ADJUSTMENT)
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" /> ส่งออกประวัติ CSV
        </button>
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
              placeholder="ค้นหา SKU, ชื่อสินค้า, ผู้ดำเนินการ, เลขที่ใบเบิก..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">ทุกประเภทการเคลื่อนไหว</option>
            <option value="IN">รับเข้าคลัง (IN)</option>
            <option value="OUT">ตัดจ่ายสินค้า (OUT)</option>
            <option value="TRANSFER">ย้ายตำแหน่ง (TRANSFER)</option>
            <option value="ADJUSTMENT">ปรับยอดสต็อก (ADJUSTMENT)</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">วัน-เวลา</th>
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">ชื่อสินค้า</th>
                <th className="px-4 py-3 text-right">จำนวน</th>
                <th className="px-4 py-3">จาก Location</th>
                <th className="px-4 py-3">ไปยัง Location</th>
                <th className="px-4 py-3">ผู้ดำเนินการ</th>
                <th className="px-4 py-3">เลขอ้างอิง / เหตุผล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t, idx) => (
                <tr key={`${t.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-500">{t.date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        t.type === 'IN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.type === 'OUT'
                          ? 'bg-rose-100 text-rose-800'
                          : t.type === 'TRANSFER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{t.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.productName}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-sm">
                    <span
                      className={
                        t.type === 'OUT'
                          ? 'text-rose-600'
                          : t.type === 'IN'
                          ? 'text-emerald-600'
                          : 'text-slate-900'
                      }
                    >
                      {t.type === 'OUT' ? `-${t.quantity}` : `+${t.quantity}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{t.fromLocation}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{t.toLocation}</td>
                  <td className="px-4 py-3 text-slate-800 font-medium">{t.operator}</td>
                  <td className="px-4 py-3 text-slate-500">
                    <span className="font-mono text-slate-700">{t.requestNo || '-'}</span>
                    {t.reason && <span className="block text-[10px] text-slate-400">{t.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
