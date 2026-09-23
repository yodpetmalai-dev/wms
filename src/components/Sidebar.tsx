import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Layers,
  ScanBarcode,
  FileText,
  CheckSquare,
  PackageCheck,
  Truck,
  History,
  MapPin,
  TrendingUp,
  Users,
  FileSpreadsheet,
  Warehouse,
  Menu,
  X,
  Code,
} from 'lucide-react';
import { useWMS } from '../context/WMSContext';

export type ViewType =
  | 'dashboard'
  | 'inventory'
  | 'products'
  | 'scanner'
  | 'requests'
  | 'picking'
  | 'packing'
  | 'shipping'
  | 'movement'
  | 'location'
  | 'kpi'
  | 'users'
  | 'reports'
  | 'code-editor';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onToggle,
}) => {
  const { kpis } = useWMS();

  const menuItems: { id: ViewType; label: string; subLabel: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      subLabel: 'ภาพรวมระบบคลังสินค้า',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      subLabel: 'สต็อกคงคลัง Real-time',
      icon: <Boxes className="w-4 h-4" />,
      badge: kpis.lowStockCount > 0 ? kpis.lowStockCount : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'products',
      label: 'Products / SKU',
      subLabel: 'ข้อมูลสินค้า 30 SKU & Barcode',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'scanner',
      label: 'Barcode Scanner',
      subLabel: 'ระบบสแกนบาร์โค้ดสินค้า',
      icon: <ScanBarcode className="w-4 h-4" />,
    },
    {
      id: 'requests',
      label: 'Request / ใบเบิกสินค้า',
      subLabel: 'อนุมัติและจัดการใบเบิก',
      icon: <FileText className="w-4 h-4" />,
      badge: kpis.pendingRequisitions > 0 ? kpis.pendingRequisitions : undefined,
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      id: 'picking',
      label: 'Picking',
      subLabel: 'การจัดหยิบ & แนะนำ Route',
      icon: <CheckSquare className="w-4 h-4" />,
      badge: kpis.activePicking > 0 ? kpis.activePicking : undefined,
      badgeColor: 'bg-indigo-600 text-white',
    },
    {
      id: 'packing',
      label: 'Packing',
      subLabel: 'ตรวจสอบ & จ่ายสินค้าออก',
      icon: <PackageCheck className="w-4 h-4" />,
    },
    {
      id: 'shipping',
      label: 'Shipping',
      subLabel: 'การจัดส่งสินค้าปลายทาง',
      icon: <Truck className="w-4 h-4" />,
      badge: kpis.readyToShip > 0 ? kpis.readyToShip : undefined,
      badgeColor: 'bg-emerald-600 text-white',
    },
    {
      id: 'movement',
      label: 'Stock Movement',
      subLabel: 'ประวัติการเคลื่อนไหวสินค้า',
      icon: <History className="w-4 h-4" />,
    },
    {
      id: 'location',
      label: 'Location',
      subLabel: 'ผังคลัง 3 Zone (A, B, C)',
      icon: <MapPin className="w-4 h-4" />,
    },
    {
      id: 'kpi',
      label: 'KPI Dashboard',
      subLabel: 'ดัชนีวัดประสิทธิภาพ 7 ข้อ',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      id: 'users',
      label: 'Users',
      subLabel: 'รายชื่อผู้ใช้งานระบบ 15 คน',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'reports',
      label: 'Reports',
      subLabel: 'รายงานและส่งออกข้อมูล',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      id: 'code-editor',
      label: 'Open Code / เเก้ไขโค้ด',
      subLabel: 'Live Code Editor & Files',
      icon: <Code className="w-4 h-4 text-indigo-400" />,
      badgeColor: 'bg-indigo-600 text-white',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-900 text-slate-300 z-50 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo / App Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-linear-to-br from-indigo-500 to-emerald-500 flex items-center justify-center text-white shadow-md">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-tight leading-tight">
                WMS - Warehouse Management System
              </h1>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">
                ระบบบริหารจัดการคลังสินค้า
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            เมนูหลัก (Main Navigation)
          </div>

          {menuItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="truncate">
                    <span className="block leading-tight">{item.label}</span>
                    <span
                      className={`text-[10px] block leading-tight truncate ${
                        isActive ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {item.subLabel}
                    </span>
                  </div>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono shrink-0 ml-1 ${
                      item.badgeColor || 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Cloud Firestore: เชื่อมฐานเดียวกัน</span>
          </div>
          <span className="text-emerald-400 font-mono font-bold shrink-0 ml-2">Live</span>
        </div>
      </aside>
    </>
  );
};
