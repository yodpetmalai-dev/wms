import React, { useState } from 'react';
import { useWMS } from '../context/WMSContext';
import { WarehouseLocation, ABCClass } from '../types/wms';
import { Navigation, MapPin, Package, CheckCircle2, ArrowRight } from 'lucide-react';

interface WarehouseMapProps {
  activeRoute?: string[];
  highlightLocation?: string;
  onSelectLocation?: (loc: WarehouseLocation) => void;
  compact?: boolean;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({
  activeRoute = [],
  highlightLocation,
  onSelectLocation,
  compact = false,
}) => {
  const { locations, getProductBySku } = useWMS();
  const [selectedLoc, setSelectedLoc] = useState<WarehouseLocation | null>(null);

  const handleLocationClick = (loc: WarehouseLocation) => {
    setSelectedLoc(loc);
    if (onSelectLocation) onSelectLocation(loc);
  };

  const getZoneColor = (zone: ABCClass) => {
    switch (zone) {
      case 'A':
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          accent: '#10B981',
        };
      case 'B':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-800',
          badge: 'bg-blue-100 text-blue-800 border-blue-300',
          accent: '#3B82F6',
        };
      case 'C':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800',
          badge: 'bg-amber-100 text-amber-800 border-amber-300',
          accent: '#F59E0B',
        };
    }
  };

  const zoneALocations = locations.filter((l) => l.zone === 'A');
  const zoneBLocations = locations.filter((l) => l.zone === 'B');
  const zoneCLocations = locations.filter((l) => l.zone === 'C');

  // Calculate route sequence map: e.g. { 'A-01-01': 1, 'A-01-03': 2 }
  const routeSequenceMap: Record<string, number> = {};
  activeRoute.forEach((loc, idx) => {
    if (loc !== 'START' && loc !== 'PICKING COMPLETE' && loc !== 'PACKING') {
      routeSequenceMap[loc] = idx;
    }
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Navigation className="w-4 h-4 text-indigo-600" />
            ผังคลังสินค้าแบบ 2 มิติ (Warehouse 2D Layout Map)
          </h3>
          <p className="text-xs text-slate-500">
            แบ่งตาม ABC Classification: Zone A (Fast) ใกล้ทางออก → Zone B (Medium) → Zone C (Slow) ด้านในสุด
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Zone A (Fast)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Zone B (Medium)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Zone C (Slow)</span>
          </span>
        </div>
      </div>

      {/* Picking Route Banner if Active */}
      {activeRoute.length > 0 && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2.5 flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-1.5 font-semibold">
            <MapPin className="w-4 h-4 text-indigo-600 animate-bounce" />
            <span>เส้นทางจัดหยิบที่แนะนำ (Optimized Picking Route):</span>
          </div>
          <div className="flex items-center gap-1 font-mono font-medium overflow-x-auto py-0.5">
            {activeRoute.map((step, idx) => (
              <React.Fragment key={idx}>
                <span
                  className={`px-2 py-0.5 rounded ${
                    step === highlightLocation
                      ? 'bg-amber-500 text-white font-bold ring-2 ring-amber-300'
                      : step === 'START' || step === 'PACKING' || step === 'PICKING COMPLETE'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-indigo-200 text-indigo-900'
                  }`}
                >
                  {step}
                </span>
                {idx < activeRoute.length - 1 && <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Main Floor Grid Visualizer */}
      <div className="p-4 bg-slate-100/70 overflow-x-auto">
        <div className="min-w-[720px] grid grid-cols-12 gap-3 relative">
          {/* Packing & Dispatching Area (Left) */}
          <div className="col-span-2 flex flex-col gap-3">
            <div className="h-full bg-linear-to-b from-indigo-100 to-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl p-3 flex flex-col items-center justify-center text-center">
              <Package className="w-8 h-8 text-indigo-600 mb-1" />
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                PACKING & DISPATCH
              </span>
              <span className="text-[11px] text-indigo-700 font-medium">จุดตรวจนับและจ่ายของ</span>
              <span className="text-[10px] text-indigo-600 mt-2 bg-indigo-200/70 px-2 py-0.5 rounded">
                Distance: 0 m
              </span>
            </div>
          </div>

          {/* ZONE A: Fast Moving (10 locations) */}
          <div className="col-span-3 bg-white/90 border border-emerald-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                ZONE A (Fast Moving)
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-medium">
                10 SKUs (1-10)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {zoneALocations.map((loc) => {
                const prod = getProductBySku(loc.assignedSku);
                const isHighlighted = loc.code === highlightLocation;
                const routeSeq = routeSequenceMap[loc.code];

                return (
                  <button
                    key={loc.code}
                    onClick={() => handleLocationClick(loc)}
                    type="button"
                    className={`p-2 rounded-lg border text-left transition-all relative ${
                      isHighlighted
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 scale-102 z-10'
                        : routeSeq
                        ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                        : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {routeSeq !== undefined && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                        #{routeSeq}
                      </span>
                    )}
                    <div className="font-mono text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>{loc.code}</span>
                      <span className="text-[10px] text-emerald-700">{loc.distanceFromPacking}m</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">{loc.assignedSku}</div>
                    <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1">
                      <span>Stock:</span>
                      <span className="font-semibold text-slate-800">{prod?.currentStock || 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ZONE B: Medium Moving (10 locations) */}
          <div className="col-span-3 bg-white/90 border border-blue-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                ZONE B (Medium Moving)
              </span>
              <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-medium">
                10 SKUs (11-20)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {zoneBLocations.map((loc) => {
                const prod = getProductBySku(loc.assignedSku);
                const isHighlighted = loc.code === highlightLocation;
                const routeSeq = routeSequenceMap[loc.code];

                return (
                  <button
                    key={loc.code}
                    onClick={() => handleLocationClick(loc)}
                    type="button"
                    className={`p-2 rounded-lg border text-left transition-all relative ${
                      isHighlighted
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 scale-102 z-10'
                        : routeSeq
                        ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                        : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    {routeSeq !== undefined && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                        #{routeSeq}
                      </span>
                    )}
                    <div className="font-mono text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>{loc.code}</span>
                      <span className="text-[10px] text-blue-700">{loc.distanceFromPacking}m</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">{loc.assignedSku}</div>
                    <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1">
                      <span>Stock:</span>
                      <span className="font-semibold text-slate-800">{prod?.currentStock || 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ZONE C: Slow Moving (10 locations) */}
          <div className="col-span-4 bg-white/90 border border-amber-200 rounded-xl p-3 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                ZONE C (Slow Moving - Deep Warehouse)
              </span>
              <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                10 SKUs (21-30)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {zoneCLocations.map((loc) => {
                const prod = getProductBySku(loc.assignedSku);
                const isHighlighted = loc.code === highlightLocation;
                const routeSeq = routeSequenceMap[loc.code];

                return (
                  <button
                    key={loc.code}
                    onClick={() => handleLocationClick(loc)}
                    type="button"
                    className={`p-2 rounded-lg border text-left transition-all relative ${
                      isHighlighted
                        ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-400 scale-102 z-10'
                        : routeSeq
                        ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                        : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {routeSeq !== undefined && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                        #{routeSeq}
                      </span>
                    )}
                    <div className="font-mono text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>{loc.code}</span>
                      <span className="text-[10px] text-amber-700">{loc.distanceFromPacking}m</span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">{loc.assignedSku}</div>
                    <div className="text-[10px] text-slate-500 flex justify-between items-center mt-1">
                      <span>Stock:</span>
                      <span className="font-semibold text-slate-800">{prod?.currentStock || 0}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Location Card Modal / Details */}
      {selectedLoc && !compact && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {(() => {
            const prod = getProductBySku(selectedLoc.assignedSku);
            return (
              <>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 text-white rounded-lg font-mono font-bold text-sm">
                    {selectedLoc.code}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      {prod?.name || 'ไม่มีข้อมูลสินค้า'} ({selectedLoc.assignedSku})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {selectedLoc.zoneName} • ช่องจัดเก็บ Aisle {selectedLoc.aisle}, Rack {selectedLoc.rack}, ชั้น {selectedLoc.shelf} • ระยะห่างจุดจ่าย {selectedLoc.distanceFromPacking} เมตร
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-500 block text-[10px]">คงเหลือ / ความจุ</span>
                    <span className="font-bold text-emerald-600 font-mono">
                      {prod?.currentStock || 0} / {selectedLoc.maxCapacity} {prod?.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedLoc(null)}
                    className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium"
                  >
                    ปิด
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
