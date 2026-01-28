import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Wallet, Receipt, RotateCcw, Landmark, ArrowUpCircle, ArrowDownCircle, 
  Banknote, History, Search, Filter, ChevronRight, ChevronLeft, Calendar, ArrowUpDown, User, Hash, FileSpreadsheet, PlusCircle, RefreshCw, Building2
} from 'lucide-react';
import { Invoice, Expense, User as UserType, TreasuryLog, Branch } from '../types';
import { supabase } from '../supabaseClient';
import { copyToClipboard } from './Layout';
import * as XLSX from 'xlsx';

interface TreasuryProps {
  invoices: Invoice[];
  expenses: Expense[];
  branches?: Branch[];
  onShowToast: (m: string, t: 'success' | 'error') => void;
  user: UserType;
}

type TreasuryLogWithUser = TreasuryLog & { creator_username?: string };

const Treasury: React.FC<TreasuryProps> = ({ invoices, expenses, branches = [], onShowToast, user }) => {
  const [logs, setLogs] = useState([] as TreasuryLogWithUser[]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(50);
  
  const isHQ = useMemo(() => ['admin', 'it_support', 'general_manager'].includes(user.role), [user.role]);
  const [branchFilter, setBranchFilter] = useState(isHQ ? '' : (user.branchId || ''));

  const fetchTreasuryData = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from('treasury_logs')
        .select(`*, users:created_by (username)`)
        .order('timestamp', { ascending: false });
      
      if (logsData) {
        const mappedLogs = logsData.map(l => ({
          id: l.id, 
          branchId: l.branch_id, 
          type: l.type, 
          source: l.source, 
          referenceId: l.reference_id, 
          amount: Number(l.amount), 
          notes: l.notes, 
          createdBy: l.created_by, 
          timestamp: l.timestamp, 
          creator_username: l.users?.username || '---'
        }));
        setLogs(mappedLogs);
      }
    } catch (err) { 
      console.error("Treasury fetch error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    fetchTreasuryData(); 
  }, []);

  // حساب الرصيد الكلي للفرع المختار (من كافة السجلات التاريخية للفرع)
  const currentBranchBalance = useMemo(() => {
    const branchSpecificLogs = branchFilter 
      ? logs.filter(l => l.branchId === branchFilter)
      : logs; // إذا لم يتم اختيار فرع (للمدير)، يعرض إجمالي الشركة
    
    return branchSpecificLogs.reduce((acc, l) => l.type === 'in' ? acc + l.amount : acc - l.amount, 0);
  }, [logs, branchFilter]);

  const [activeTab, setActiveTab] = useState('daily' as 'daily' | 'monthly' | 'yearly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' } as { key: string, direction: 'asc' | 'desc' });

  const dateDisplayLabel = useMemo(() => {
    if (activeTab === 'daily') return selectedDate.toLocaleDateString('ar-EG');
    if (activeTab === 'monthly') return selectedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    return selectedDate.getFullYear().toString();
  }, [activeTab, selectedDate]);

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
    setVisibleCount(50);
  };

  const filteredLogs = useMemo(() => {
    let list = logs.filter(log => {
      // 1. فلتر الفرع
      const matchesBranch = branchFilter === '' ? true : (log.branchId === branchFilter);
      if (!matchesBranch) return false;

      // 2. فلتر التاريخ
      const logDate = new Date(log.timestamp);
      const matchesDate = activeTab === 'daily' 
        ? logDate.toLocaleDateString('ar-EG') === selectedDate.toLocaleDateString('ar-EG') 
        : activeTab === 'monthly'
          ? logDate.getMonth() === selectedDate.getMonth() && logDate.getFullYear() === selectedDate.getFullYear()
          : logDate.getFullYear() === selectedDate.getFullYear();

      if (!matchesDate) return false;

      // 3. فلتر البحث
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (log.notes || '').toLowerCase().includes(term) ||
        (log.creator_username || '').toLowerCase().includes(term) ||
        log.id.toLowerCase().includes(term) ||
        log.referenceId.toLowerCase().includes(term);

      return matchesSearch;
    });

    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [logs, branchFilter, activeTab, selectedDate, searchTerm, sortConfig]);

  const displayList = useMemo(() => filteredLogs.slice(0, visibleCount), [filteredLogs, visibleCount]);

  const exportExcel = () => {
    const data = filteredLogs.map(l => ({
      "المعرف": l.id,
      "النوع": l.type === 'in' ? 'إيراد / إيداع' : 'مصروف / سحب',
      "المصدر": l.source,
      "القيمة": l.amount,
      "البيان": l.notes,
      "المسؤول": l.creator_username,
      "التاريخ": new Date(l.timestamp).toLocaleString('ar-EG')
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "سجل الخزينة");
    XLSX.utils.book_append_sheet(wb, ws, "Treasury_Log.xlsx");
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden">
            <Landmark size={120} className="absolute -bottom-6 -left-6 text-white/5 rotate-12"/>
            <div className="relative z-10">
               <p className="text-[10px] font-black text-indigo-300 uppercase mb-2">رصيد الخزينة الفعلي (السيولة)</p>
               <h3 className="text-4xl font-black">{currentBranchBalance.toLocaleString()} <span className="text-lg text-white/50">ج.م</span></h3>
               {branchFilter && <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-2"><Building2 size={14}/> {branches.find(b=>b.id===branchFilter)?.name}</p>}
            </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">حركة الفترة المحددة</p>
                  <h4 className="text-xl font-black text-slate-800">{filteredLogs.length} عملية</h4>
               </div>
               <div className="flex gap-2">
                  <button onClick={exportExcel} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"><FileSpreadsheet size={20}/></button>
                  <button onClick={fetchTreasuryData} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><RefreshCw size={20} className={loading ? "animate-spin" : ""}/></button>
               </div>
            </div>
            <div className="flex gap-4">
               <div className="flex-1 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-[9px] font-black text-emerald-400 uppercase flex items-center gap-1"><ArrowUpCircle size={12}/> وارد (إيراد)</p>
                  <p className="text-lg font-black text-emerald-700">{filteredLogs.filter(l=>l.type==='in').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p>
               </div>
               <div className="flex-1 p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-[9px] font-black text-rose-400 uppercase flex items-center gap-1"><ArrowDownCircle size={12}/> صادر (مصروف)</p>
                  <p className="text-lg font-black text-rose-700">{filteredLogs.filter(l=>l.type==='out').reduce((a,b)=>a+b.amount,0).toLocaleString()}</p>
               </div>
            </div>
         </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center gap-6">
         <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
            {['daily', 'monthly', 'yearly'].map(t => (
               <button key={t} onClick={() => setActiveTab(t as any)} className={`flex-1 min-w-[80px] px-6 py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>{t === 'daily' ? 'يومي' : t === 'monthly' ? 'شهري' : 'سنوي'}</button>
            ))}
         </div>
         <div className="flex items-center justify-between lg:justify-center gap-4 bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100 flex-1 w-full lg:w-auto">
            <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white rounded-lg text-indigo-600"><ChevronRight size={20}/></button>
            <span className="text-[11px] font-black text-slate-700 min-w-[120px] text-center">{dateDisplayLabel}</span>
            <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white rounded-lg text-indigo-600"><ChevronLeft size={20}/></button>
         </div>
         {isHQ && (
            <div className="w-full lg:w-auto min-w-[200px]">
               <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs outline-none" value={branchFilter} onChange={e=>setBranchFilter(e.target.value)}>
                  <option value="">كافة الفروع (الخزينة العامة)</option>
                  {branches.filter(b=>!b.isDeleted).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
               </select>
            </div>
         )}
         <div className="relative flex-1 w-full lg:w-auto">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input type="text" placeholder="بحث في السجلات..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
         <div className="overflow-x-auto">
            <table className="w-full text-right text-[11px] font-bold">
               <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                  <tr>
                     <th className="px-8 py-5">المعرف</th>
                     <th className="px-8 py-5">النوع</th>
                     <th className="px-8 py-5">التوقيت</th>
                     <th className="px-8 py-5">البيان والتفاصيل</th>
                     <th className="px-8 py-5 text-center">المبلغ</th>
                     <th className="px-8 py-5 text-left">المسؤول</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                  {displayList.map(log => (
                     <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-4 font-mono text-indigo-600 cursor-pointer hover:underline" onClick={()=>copyToClipboard(log.id, onShowToast)}>#{log.id.slice(0,8)}</td>
                        <td className="px-8 py-4">
                           <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${log.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {log.type === 'in' ? 'إيداع / إيراد' : 'سحب / مصروف'}
                           </span>
                        </td>
                        <td className="px-8 py-4 text-slate-400 font-mono text-[9px]">{new Date(log.timestamp).toLocaleTimeString('ar-EG')}</td>
                        <td className="px-8 py-4 max-w-xs truncate" title={log.notes || ''}>
                           <div className="flex flex-col">
                              <span>{log.notes || '---'}</span>
                              <span className="text-[8px] text-slate-400 uppercase mt-0.5">{log.source} {log.referenceId ? `(Ref: ${log.referenceId})` : ''}</span>
                           </div>
                        </td>
                        <td className={`px-8 py-4 text-center font-black ${log.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.amount.toLocaleString()}</td>
                        <td className="px-8 py-4 text-left">
                           <div className="flex items-center gap-2 justify-end">
                              <span>{log.creator_username || '---'}</span>
                              <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-black text-slate-500">{(log.creator_username || '?')[0]}</div>
                           </div>
                        </td>
                     </tr>
                  ))}
                  {displayList.length === 0 && (
                     <tr><td colSpan={6} className="py-24 text-center text-slate-300 italic opacity-50 font-black uppercase tracking-widest">لا توجد حركات مالية مسجلة</td></tr>
                  )}
               </tbody>
            </table>
            {visibleCount < filteredLogs.length && (
               <div className="p-6 bg-slate-50 flex justify-center border-t">
                  <button onClick={() => setVisibleCount(prev => prev + 50)} className="px-10 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><PlusCircle size={18}/> عرض المزيد</button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Treasury;