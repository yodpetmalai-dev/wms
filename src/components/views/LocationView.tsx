import React, { useState } from 'react';
import { useWMS } from '../../context/WMSContext';
import { WarehouseLocation, ABCClass } from '../../types/wms';
import { WarehouseMap } from '../WarehouseMap';
import { MapPin, Search, Layers, Box, CheckCircle2 } from 'lucide-react';

export const LocationView: React.FC = () => {
  const { locations, getProductBySku } = useWMS();
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightLoc, setHighlightLoc] = useState<string | undefined>(undefined);

  const filteredLocations = locations.filter((loc) => {
    const matchZ = selectedZone === 'ALL' || loc.zone === selectedZone;
    const matchQ =
      loc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.assignedSku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchZ && matchQ;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            การจัดการผังและตำแหน่งจัดเก็บสินค้า (Warehouse Location Management)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แบ่งตามหลัก ABC: Zone A ใกล้จุดส่งออก (10-35m) → Zone B (40-60m) → Zone C ด้านในสุด (70-95m)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">รวม 30 ตำแหน่งจัดเก็บ (100% Assigned)</span>
        </div>
      </div>

      {/* 2D Interactive Warehouse Floor Map */}
      <WarehouseMap
        highlightLocation={highlightLoc}
        onSelectLocation={(loc) => setHighlightLoc(loc.code)}
      />

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[300px]">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา Location (เช่น A-01-01), SKU ที่ผูกไว้..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">ทุกโซน (Zone A, B, C)</option>
            <option value="A">Zone A: Fast Moving (10 ตำแหน่ง)</option>
            <option value="B">Zone B: Medium Moving (10 ตำแหน่ง)</option>
            <option value="C">Zone C: Slow Moving (10 ตำแหน่ง)</option>
          </select>
        </div>
      </div>

      {/* Location Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Location Code</th>
                <th className="px-4 py-3">โซน / ประเภท</th>
                <th className="px-4 py-3">พิกัดจัดเก็บ</th>
                <th className="px-4 py-3">ระยะห่างจากจุด Packing</th>
                <th className="px-4 py-3">SKU ที่กำหนด</th>
                <th className="px-4 py-3">ชื่อสินค้า</th>
                <th className="px-4 py-3 text-right">สต็อก / ความจุ</th>
                <th className="px-4 py-3">อัตราการใช้งาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLocations.map((loc) => {
                const prod = getProductBySku(loc.assignedSku);
                const current = prod?.currentStock || 0;
                const utilPct = Math.min(100, Math.round((current / loc.maxCapacity) * 100));

                return (
                  <tr
                    key={loc.code}
                    onMouseEnter={() => setHighlightLoc(loc.code)}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      highlightLoc === loc.code ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 text-sm">
                      {loc.code}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          loc.zone === 'A'
                            ? 'bg-emerald-100 text-emerald-800'
                            : loc.zone === 'B'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Zone {loc.zone} ({loc.zone === 'A' ? 'Fast' : loc.zone === 'B' ? 'Medium' : 'Slow'})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono">
                      Aisle {loc.aisle} • Rack {loc.rack} • Shelf {loc.shelf}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {loc.distanceFromPacking} เมตร
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {loc.assignedSku}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {prod?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <strong className="text-slate-900">{current}</strong>
                      <span className="text-slate-400"> / {loc.maxCapacity} {prod?.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            utilPct > 80
                              ? 'bg-amber-500'
                              : utilPct > 50
                              ? 'bg-indigo-600'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                        {utilPct}% Used
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
