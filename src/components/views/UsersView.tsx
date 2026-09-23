import React from 'react';
import { useWMS } from '../../context/WMSContext';
import { User, ShieldCheck, CheckCircle2, UserCheck, Sparkles } from 'lucide-react';

export const UsersView: React.FC = () => {
  const { users, activeUser, setActiveUser } = useWMS();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            รายชื่อผู้ใช้งานระบบ 15 คน (15 System Users & Warehouse Personnel)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            แบ่งตามบทบาท: ผู้เบิก (นาย A-F), เจ้าหน้าที่จัดหยิบ (นาย G-J), เจ้าหน้าที่บรรจุหีบห่อ (นาย K-L), หัวหน้าคลัง (นาย M-N) และผู้ดูแลระบบ (นาย O)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">
            ผู้ใช้งานปัจจุบัน: <strong className="text-indigo-600">{activeUser.name}</strong> ({activeUser.role})
          </span>
        </div>
      </div>

      {/* Permissions Notice Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-start gap-3 shadow-2xs">
        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="text-xs text-emerald-900 space-y-1">
          <div className="flex items-center gap-2 font-bold text-emerald-950">
            <span>มอบสิทธิ์ในการดำเนินงานกับทุกคนที่มีลิงก์ 100% (Universal Operational Authorization)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-extrabold">
              Full Operational Access
            </span>
          </div>
          <p className="text-emerald-800 leading-relaxed">
            ผู้ใช้งานทุกคนที่เปิดผ่านลิงก์สาธารณะนี้ (ทั้งบนมือถือ, แท็บเล็ต, คอมพิวเตอร์) ได้รับสิทธิ์ในการดำเนินงานคลังสินค้าทุกขั้นตอนอย่างเท่าเทียม: สร้างใบเบิก, อนุมัติใบเบิก, สแกนหยิบสินค้า, บรรจุหีบห่อ, จัดส่ง และควบคุมสต็อก สามารถกด "สลับมาเป็นผู้ใช้นี้" เพื่อสวมบทบาทและบันทึกประวัติการทำงานในชื่อเจ้าหน้าที่แต่ละคนได้ทันที
          </p>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {users.map((u) => {
          const isActive = u.id === activeUser.id;

          return (
            <div
              key={u.id}
              className={`p-4 rounded-xl border bg-white shadow-2xs transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/20'
                  : 'border-slate-200 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-xs"
                    style={{ backgroundColor: u.avatarColor }}
                  >
                    {u.name.replace('นาย ', '')}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isActive ? 'ใช้งานอยู่ (Active)' : 'Online'}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{u.name}</h3>
                <p className="text-xs font-semibold text-indigo-600">{u.role}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{u.department}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{u.email}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setActiveUser(u)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isActive ? '✓ กำลังใช้งาน' : 'สลับมาเป็นผู้ใช้นี้'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
