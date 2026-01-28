import React, { useState, useMemo } from 'react';
import { 
  History, Search, ArrowUpCircle, ArrowDownCircle, Banknote, RefreshCw, 
  ShoppingBag, Receipt, RotateCcw, Clock, Calendar, ArrowUpDown, Tag, Percent, Filter, ShieldAlert, Eye, User, Fingerprint, X, FileSpreadsheet, CreditCard, PlusCircle
} from 'lucide-react';
import { ActivityLog, Invoice, User as UserType, AuditLog } from '../types';
import * as XLSX from 'xlsx';
import { copyToClipboard } from './Layout';

interface DailyLogsProps {
  logs: ActivityLog[];
  invoices: Invoice[];
  auditLogs: AuditLog[];
  onRefresh: () => void;
  user: UserType;
}

const DailyLogs = ({ logs, invoices, auditLogs, onRefresh, user }: DailyLogsProps) => {
  const [activeTab, setActiveTab] = useState('activity' as 'activity' | 'sales' | 'security');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all' as string);
  const [dateFilter, setDateFilter] = useState('' as string); 
  const [selectedAudit, setSelectedAudit] = useState(null as AuditLog | null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' } as { key: string, direction: 'asc' | 'desc' } | null);

  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setVisibleCount(50);
  };

  const filteredLogs = useMemo(() => {
    let list = logs.filter(l => {
      const matchesSearch = (l.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             l.id.toLowerCase().includes(searchTerm.toLowerCase())); 
      const matchesType = (typeFilter === 'all' || l.type === typeFilter);
      const logDateStr = new Date(l.timestamp).toISOString().split('T')[0];
      return matchesSearch && matchesType && (!dateFilter || logDateStr === dateFilter);
    });
    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [logs, searchTerm, sortConfig, typeFilter, dateFilter]);

  const filteredAudit = useMemo(() => {
    return auditLogs.filter(a => {
      const matchesSearch = a.username.toLowerCase().includes(searchTerm.toLowerCase()) || a.details.toLowerCase().includes(searchTerm.toLowerCase());
      const logDateStr = new Date(a.timestamp).toISOString().split('T')[0];
      return matchesSearch && (!dateFilter || logDateStr === dateFilter);
    });
  }, [auditLogs, searchTerm, dateFilter]);

  const filteredSales = useMemo(() => {
    let list = invoices.filter(i => {
      if (i.isDeleted) return false;
      const logDateStr = new Date(i.timestamp).toISOString().split('T')[0];
      return (i.id.toLowerCase().includes(searchTerm.toLowerCase()) || i.customerName?.toLowerCase().includes(searchTerm.toLowerCase())) && (!dateFilter || logDateStr === dateFilter);
    });
    if (sortConfig) {
      list.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [invoices, searchTerm, sortConfig, dateFilter]);

  const displayList = useMemo(() => {
    const fullList = activeTab === 'security' ? filteredAudit : activeTab === 'activity' ? filteredLogs : filteredSales;
    return fullList.slice(0, visibleCount);
  }, [activeTab, filteredAudit, filteredLogs, filteredSales, visibleCount]);

  const typeConfig: Record<string, { icon: any, color: string, label: string }> = {
    'sale': { icon: <ShoppingBag size={14}/>, color: 'text-emerald-600 bg-emerald-50', label: 'مبيعات' },
    'expense': { icon: <Receipt size={14}/>, color: 'text-rose-600 bg-rose-50', label: 'مصروفات' },
    'return': { icon: <RotateCcw size={14}/>, color: 'text-orange-600 bg-orange-50', label: 'مرتجع' },
    'payment': { icon: <Banknote size={14}/>, color: 'text-indigo-600 bg-indigo-50', label: 'رواتب' },
    'purchase': { icon: <ArrowUpCircle size={14}/>, color: 'text-blue-600 bg-blue-50', label: 'توريد' },
    'supplier_payment': { icon: <CreditCard size={14}/>, color: 'text-violet-600 bg-violet-50', label: 'سداد مورد' }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full xl:auto overflow-x-auto scrollbar-hide">
          {['activity', 'sales', 'security'].map(tab => (
             (tab !== 'security' || isAdmin) && (
               <button key={tab} onClick={() => { setActiveTab(tab as any); setVisibleCount(50); }} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}>{tab === 'activity' ? 'سجل النشاط العام' : tab === 'sales' ? 'جدول المبيعات' : 'الرقابة الأمنية'}</button>
             )
          ))}
        </div>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end">
           <input type="date" className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-[10px] font-black" value={dateFilter} onChange={e=>{setDateFilter(e.target.value); setVisibleCount(50);}} />
           <div className="relative min-w-[200px] flex-1 xl:flex-none">
             <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
             <input type="text" placeholder="بحث..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold outline-none shadow-inner" value={searchTerm} onChange={e=>{setSearchTerm(e.target.value); setVisibleCount(50);}}/>
           </div>
           <button onClick={onRefresh} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><RefreshCw size={18}/></button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[450px]">
        <div className="overflow-x-auto">
           <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                 {activeTab === 'security' ? (
                   <tr><th className="px-8 py-5">الإجراء</th><th className="px-8 py-5">الموظف</th><th className="px-8 py-5">البيان</th><th className="px-8 py-5 text-center">التوقيت</th><th className="px-8 py-5 text-left">التفاصيل</th></tr>
                 ) : activeTab === 'activity' ? (
                   <tr><th className="px-8 py-5">النوع</th><th className="px-8 py-5">العملية</th><th className="px-8 py-5">المسؤول</th><th className="px-8 py-5 text-center">التوقيت</th><th className="px-8 py-5 text-left">المبلغ</th></tr>
                 ) : (
                   <tr><th className="px-8 py-5">رقم الفاتورة</th><th className="px-8 py-5">التوقيت</th><th className="px-8 py-5 text-center">الإجمالي</th><th className="px-8 py-5 text-center">الخصم</th><th className="px-8 py-5 text-left">الصافي</th></tr>
                 )}
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {displayList.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                       {activeTab === 'security' ? (
                          <>
                             <td className="px-8 py-4"><span className="px-2 py-1 bg-rose-50 text-rose-600 rounded text-[8px]">{item.actionType}</span></td>
                             <td className="px-8 py-4">{item.username}</td>
                             <td className="px-8 py-4 text-slate-700 max-w-xs truncate">{item.details}</td>
                             <td className="px-8 py-4 text-center text-[9px] text-slate-400">{new Date(item.timestamp).toLocaleString('ar-EG')}</td>
                             <td className="px-8 py-4 text-left"><button onClick={()=>setSelectedAudit(item)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-800 hover:text-white"><Eye size={14}/></button></td>
                          </>
                       ) : activeTab === 'activity' ? (
                          <>
                             <td className="px-8 py-4"><div className={`px-3 py-1 rounded-lg w-fit ${typeConfig[item.type]?.color || 'bg-slate-50'} text-[9px] font-black`}>{typeConfig[item.type]?.label || item.type}</div></td>
                             <td className="px-8 py-4"><p className="text-xs">{item.details}</p><span className="text-[8px] text-slate-300">#{item.id}</span></td>
                             <td className="px-8 py-4 text-slate-500">{item.user}</td>
                             <td className="px-8 py-4 text-center font-mono text-[9px] text-slate-400">{item.time}</td>
                             <td className="px-8 py-4 text-left font-black text-slate-900">{item.amount?.toLocaleString()} ج.م</td>
                          </>
                       ) : (
                          <>
                             <td className="px-8 py-4 text-indigo-600">#{item.id.slice(-6)}</td>
                             <td className="px-8 py-4 text-slate-400 font-mono text-[9px]">{item.time}</td>
                             <td className="px-8 py-4 text-center">{item.totalBeforeDiscount?.toLocaleString()}</td>
                             <td className="px-8 py-4 text-center text-rose-500">-{item.discountValue?.toLocaleString()}</td>
                             <td className="px-8 py-4 text-left font-black text-emerald-600">{item.netTotal?.toLocaleString()} ج.م</td>
                          </>
                       )}
                    </tr>
                 ))}
              </tbody>
           </table>
           {visibleCount < (activeTab === 'security' ? filteredAudit.length : activeTab === 'activity' ? filteredLogs.length : filteredSales.length) && (
              <div className="p-6 bg-slate-50 flex justify-center border-t">
                 <button onClick={() => setVisibleCount(prev => prev + 50)} className="px-10 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><PlusCircle size={18}/> عرض المزيد</button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default DailyLogs;