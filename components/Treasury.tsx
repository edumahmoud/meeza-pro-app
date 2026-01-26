
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

const Treasury: React.FC<TreasuryProps> = ({ invoices, expenses, branches = [], onShowToast, user }) => {
  const [logs, setLogs] = useState<(TreasuryLog & { creator_username?: string })[]>([]);
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

  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

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
          ? (logDate.getMonth() === selectedDate.getMonth() && logDate.getFullYear() === selectedDate.getFullYear()) 
          : logDate.getFullYear() === selectedDate.getFullYear();
      
      // 3. فلتر البحث
      const matchesSearch = log.referenceId.toLowerCase().includes(searchTerm.toLowerCase()) || (log.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesDate && matchesSearch;
    });

    // الترتيب
    list.sort((a: any, b: any) => {
      let valA = a[sortConfig.key]; 
      let valB = b[sortConfig.key];
      if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [logs, activeTab, selectedDate, searchTerm, sortConfig, branchFilter]);

  const displayList = useMemo(() => filteredLogs.slice(0, visibleCount), [filteredLogs, visibleCount]);

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* هيدر الرصيد مع اختيار الفرع */}
      <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">
           <div className="space-y-2 text-center lg:text-right">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center justify-center lg:justify-start gap-2">
                <Wallet size={14}/> رصيد {branchFilter ? (branches.find(b => b.id === branchFilter)?.name) : 'كافة الفروع'}
              </p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                {currentBranchBalance.toLocaleString()} <span className="text-xl font-bold text-white/30">ج.م</span>
              </h2>
           </div>

           <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
              {isHQ && (
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 w-full md:w-[280px]">
                   <Building2 size={18} className="text-indigo-400"/>
                   <select 
                     className="bg-transparent border-none outline-none font-black text-xs text-white w-full cursor-pointer appearance-none" 
                     value={branchFilter} 
                     onChange={e => { setBranchFilter(e.target.value); setVisibleCount(50); }}
                   >
                     <option value="" className="text-slate-800">إجمالي الشركة (كافة الفروع)</option>
                     {branches.filter(b => !b.isDeleted).map(b => (
                       <option key={b.id} value={b.id} className="text-slate-800">{b.name}</option>
                     ))}
                   </select>
                </div>
              )}
              
              <button onClick={fetchTreasuryData} className="p-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10 shrink-0">
                <RefreshCw size={24} className={loading ? 'animate-spin' : ''}/>
              </button>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b bg-slate-50/50 flex flex-col xl:flex-row gap-6 justify-between items-center">
           <div className="flex items-center gap-3 font-black text-sm text-slate-800">
              <History size={18} className="text-indigo-600"/> سجل العمليات النقدية ({filteredLogs.length})
           </div>
           
           <div className="flex flex-wrap gap-4 items-center justify-center">
              {/* تابات الفترة الزمنية */}
              <div className="flex bg-slate-200 p-1 rounded-xl">
                {['daily', 'monthly', 'yearly'].map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); setVisibleCount(50); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}</button>
                ))}
              </div>

              {/* محرك البحث داخل الخزنة */}
              <div className="relative min-w-[200px]">
                 <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14}/>
                 <input 
                   type="text" 
                   placeholder="بحث برقم المرجع أو البيان..." 
                   className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>

              {/* تحكم التاريخ */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                 <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-slate-100 rounded-lg text-indigo-600"><ChevronRight size={16}/></button>
                 <span className="text-[10px] font-black text-slate-700 min-w-[80px] text-center">{dateDisplayLabel}</span>
                 <button onClick={() => changePeriod(1)} className="p-1 hover:bg-slate-100 rounded-lg text-indigo-600"><ChevronLeft size={16}/></button>
              </div>
           </div>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                 <tr>
                    <th className="px-8 py-5">الحالة</th>
                    <th className="px-8 py-5">نوع العملية</th>
                    <th className="px-8 py-5">كود المرجع</th>
                    <th className="px-8 py-5">الموظف</th>
                    <th className="px-8 py-5 text-center">التوقيت</th>
                    <th className="px-8 py-5 text-left">المبلغ</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {displayList.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-all group">
                       <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${log.type === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                             {log.type === 'in' ? 'دخل' : 'صرف'}
                          </span>
                       </td>
                       <td className="px-8 py-4">
                          <p className="text-slate-700">{log.source}</p>
                          <p className="text-[8px] text-slate-400 font-bold max-w-[150px] truncate">{log.notes || '-'}</p>
                       </td>
                       <td className="px-8 py-4 text-indigo-600 font-mono cursor-pointer hover:underline" onClick={() => copyToClipboard(log.referenceId, onShowToast)}>
                          #{log.referenceId.slice(-6)}
                       </td>
                       <td className="px-8 py-4 text-slate-500">{log.creator_username}</td>
                       <td className="px-8 py-4 text-center text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('ar-EG')}
                       </td>
                       <td className={`px-8 py-4 text-left text-sm font-black ${log.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {log.type === 'in' ? '+' : '-'}{log.amount.toLocaleString()} ج.م
                       </td>
                    </tr>
                 ))}
                 {displayList.length === 0 && !loading && (
                   <tr>
                     <td colSpan={6} className="py-20 text-center text-slate-300 italic font-bold">لا توجد حركات نقدية مسجلة لهذا النطاق</td>
                   </tr>
                 )}
              </tbody>
           </table>
           
           {visibleCount < filteredLogs.length && (
              <div className="p-6 bg-slate-50 flex justify-center border-t">
                 <button 
                   onClick={() => setVisibleCount(prev => prev + 50)} 
                   className="px-10 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                 >
                    <PlusCircle size={18}/> عرض المزيد من السجلات
                 </button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Treasury;
