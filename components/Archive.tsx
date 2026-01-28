import React, { useState, useMemo, useRef } from 'react';
import { Search, Eye, X, Trash2, Receipt, ChevronLeft, ChevronRight, RefreshCw, Archive as ArchiveIcon, FileText } from 'lucide-react';
import { Invoice, User as UserType, Branch, SystemSettings, ReturnRecord } from '../types';
import { copyToClipboard } from './Layout';

interface ArchiveProps {
  invoices: Invoice[];
  returns?: ReturnRecord[];
  branches: Branch[];
  settings: SystemSettings;
  onDeleteInvoice: (id: string, reason: string, user: UserType) => Promise<void>;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  canDelete: boolean;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Archive = ({ invoices, branches, settings, onDeleteInvoice, onShowToast, user, canDelete, askConfirmation }: ArchiveProps) => {
  const [activeTab, setActiveTab] = useState('daily' as 'daily' | 'monthly' | 'yearly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [confirmDelete, setConfirmDelete] = useState(null as {id: string, reason: string} | null);
  const [selectedInvoice, setSelectedInvoice] = useState(null as Invoice | null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' } as { key: string, direction: 'asc' | 'desc' } | null);

  const formattedSelectedDate = selectedDate.toLocaleDateString('ar-EG');
  const dateDisplayLabel = useMemo(() => {
    if (activeTab === 'daily') return formattedSelectedDate;
    if (activeTab === 'monthly') return selectedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    return selectedDate.getFullYear().toString();
  }, [activeTab, selectedDate, formattedSelectedDate]);

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
    setVisibleCount(50);
  };

  const filtered = useMemo(() => {
    let list = invoices.filter(inv => {
      if (inv.isDeleted) return false;
      const d = new Date(inv.timestamp);
      const matchesTime = activeTab === 'daily' ? inv.date === formattedSelectedDate : activeTab === 'monthly' ? (d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()) : (d.getFullYear() === selectedDate.getFullYear());
      return matchesTime;
    });
    const isHQ = ['admin', 'general_manager', 'it_support'].includes(user.role);
    if (!isHQ) list = list.filter(inv => inv.branchId === user.branchId);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(inv => inv.id.toLowerCase().includes(term) || inv.customerName?.toLowerCase().includes(term));
    }
    return list;
  }, [invoices, search, user.role, user.branchId, activeTab, formattedSelectedDate, selectedDate]);

  const displayList = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleDeleteFinal = async () => {
    if (!confirmDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteInvoice(confirmDelete.id, confirmDelete.reason, user);
      setConfirmDelete(null);
      onShowToast?.("تم الإلغاء بنجاح", "success");
    } catch (e) { onShowToast?.("فشل الإلغاء", "error"); }
    finally { setIsDeleting(false); }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ArchiveIcon size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي الفواتير</p><h3 className="text-xl font-black">{filtered.length} عملية</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><FileText size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">إجمالي الإيراد</p><h3 className="text-xl font-black">{filtered.reduce((a,b)=>a+b.netTotal, 0).toLocaleString()} ج.م</h3></div>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Receipt size={24}/></div>
           <div><p className="text-slate-400 text-[9px] font-black uppercase mb-1">أعلى قيمة فاتورة</p><h3 className="text-xl font-black">{Math.max(0, ...filtered.map(f=>f.netTotal)).toLocaleString()}</h3></div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full xl:max-w-md overflow-x-auto">
          {['daily', 'monthly', 'yearly'].map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); setVisibleCount(50); }} className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}>{tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}</button>
          ))}
        </div>
        <div className="flex items-center justify-between lg:justify-center gap-4 bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 flex-1">
           <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white rounded-lg text-indigo-600"><ChevronRight size={20}/></button>
           <span className="text-[11px] font-black text-slate-700 min-w-[120px] text-center">{dateDisplayLabel}</span>
           <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white rounded-lg text-indigo-600"><ChevronLeft size={20}/></button>
        </div>
        <div className="relative flex-1 w-full xl:max-w-md"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="بحث..." className="w-full pr-14 pl-4 py-3.5 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm shadow-inner" value={search} onChange={(e) => {setSearch(e.target.value); setVisibleCount(50);}} /></div>
      </div>
      
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-[10px] min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px] border-b">
              <tr><th className="px-6 py-5">رقم السند</th><th className="px-6 py-5">العميل</th><th className="px-6 py-5">ملخص الأصناف</th><th className="px-6 py-5 text-center">الإجمالي</th><th className="px-6 py-5 text-center">الخصم</th><th className="px-6 py-5 text-center font-black">الصافي النهائي</th><th className="px-6 py-5 text-left">إدارة</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {displayList.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4 font-black text-indigo-600">#{inv.id.slice(-6)}</td>
                    <td className="px-6 py-4">{inv.customerName || 'عميل نقدي'}<p className="text-[8px] text-slate-400">{inv.customerPhone || '---'}</p></td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{inv.items.map(it => `${it.name} (x${it.quantity})`).join('، ')}</td>
                    <td className="px-6 py-4 text-center text-slate-500">{(inv.totalBeforeDiscount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center text-rose-500">-{(inv.discountValue || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-center font-black text-emerald-600 text-xs">{(inv.netTotal || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-left">
                       <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100">
                          <button onClick={() => setSelectedInvoice(inv)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"><Eye size={14} /></button>
                          {canDelete && <button onClick={() => setConfirmDelete({id: inv.id, reason: ''})} className="p-2 bg-rose-50 text-rose-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={14} /></button>}
                       </div>
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

export default Archive;