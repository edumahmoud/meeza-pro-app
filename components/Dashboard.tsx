import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Package, Gem, RotateCcw, Landmark, AlertTriangle, ShoppingCart, Users, Award, ZapOff, ChevronUp, ChevronDown, Wallet, AreaChart as ChartIcon, Coins, ArrowUpRight, ArrowDownRight, BarChart3, Building2, ChevronRight, ChevronLeft, Calendar, PieChart as PieIcon, BarChart as BarIcon
} from 'lucide-react';
import { Invoice, ReturnRecord, Expense, Product, SupplierPayment, User as UserType, StaffPayment, PurchaseRecord, Supplier, Branch } from '../types';
import { SummaryStats } from '../hooks/useSalesData';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';

interface DashboardProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  expenses: Expense[];
  products: Product[];
  staffPayments: StaffPayment[]; 
  user: UserType;
  summaryStats: SummaryStats | null;
  branches?: Branch[];
  suppliers?: Supplier[];
  onProductClick?: (product: Product) => void;
}

const Dashboard = ({ invoices, returns, expenses, products, staffPayments, user, branches = [] }: DashboardProps) => {
  const [activeTab, setActiveTab] = useState('daily' as 'daily' | 'monthly' | 'yearly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);
  const [branchFilter, setBranchFilter] = useState(isAdmin ? '' : (user.branchId || ''));

  const formattedSelectedDate = selectedDate.toLocaleDateString('ar-EG');
  
  const dateDisplayLabel = useMemo(() => {
    if (activeTab === 'daily') return formattedSelectedDate;
    if (activeTab === 'monthly') return selectedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    return selectedDate.toLocaleDateString('ar-EG', { year: 'numeric' });
  }, [activeTab, selectedDate, formattedSelectedDate]);

  const changePeriod = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (activeTab === 'daily') newDate.setDate(selectedDate.getDate() + delta);
    else if (activeTab === 'monthly') newDate.setMonth(selectedDate.getMonth() + delta);
    else newDate.setFullYear(selectedDate.getFullYear() + delta);
    setSelectedDate(newDate);
  };

  const filteredData = useMemo(() => {
    const checkTimeMatch = (itemTimestamp: number, itemDate: string) => {
      const d = new Date(itemTimestamp);
      if (activeTab === 'daily') return itemDate === formattedSelectedDate;
      if (activeTab === 'monthly') return (d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear());
      return (d.getFullYear() === selectedDate.getFullYear());
    };

    const checkBranchMatch = (itemBranchId?: string) => {
      if (!isAdmin) return itemBranchId === user.branchId;
      return !branchFilter || itemBranchId === branchFilter;
    };

    const filteredInvoices = invoices.filter(i => !i.isDeleted && checkTimeMatch(i.timestamp, i.date) && checkBranchMatch(i.branchId));
    const filteredExpenses = expenses.filter(e => checkTimeMatch(e.timestamp, e.date) && checkBranchMatch(e.branchId));
    const filteredReturns = returns.filter(r => !r.isDeleted && checkTimeMatch(r.timestamp, r.date) && checkBranchMatch(r.branchId));
    const branchProducts = products.filter(p => !p.isDeleted && (isAdmin && !branchFilter ? true : p.branchId === (branchFilter || user.branchId)));
    
    return { filteredInvoices, filteredExpenses, filteredReturns, branchProducts };
  }, [invoices, expenses, returns, products, user.branchId, isAdmin, branchFilter, activeTab, selectedDate, formattedSelectedDate]);

  const displayStats = useMemo(() => {
    const revenue = filteredData.filteredInvoices.reduce((a, b) => a + b.netTotal, 0);
    const costOfGoods = filteredData.filteredInvoices.reduce((acc, inv) => {
      return acc + inv.items.reduce((sum, item) => sum + (item.quantity * item.wholesalePriceAtSale), 0);
    }, 0);
    
    const expensesTotal = filteredData.filteredExpenses.reduce((a, b) => a + b.amount, 0);
    const returnsValue = filteredData.filteredReturns.reduce((a, b) => a + b.totalRefund, 0);
    const inventoryValue = filteredData.branchProducts.reduce((a, b) => a + (b.stock * b.wholesalePrice), 0);
    const netProfit = (revenue - costOfGoods) - expensesTotal - returnsValue;

    return {
      revenue,
      costOfGoods,
      expenses: expensesTotal,
      returnsValue,
      inventoryValue,
      netProfit,
      lowStockCount: filteredData.branchProducts.filter(p => p.stock <= p.lowStockThreshold).length,
      pieData: [
        { name: 'صافي الربح', value: Math.max(0, netProfit), color: '#10b981' },
        { name: 'المصاريف', value: expensesTotal, color: '#f59e0b' },
        { name: 'المرتجعات', value: returnsValue, color: '#ef4444' }
      ]
    };
  }, [filteredData]);

  const productPerformance = useMemo(() => {
    const stats: Record<string, { name: string; count: number; revenue: number }> = {};
    filteredData.filteredInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!stats[item.productId]) {
          stats[item.productId] = { name: item.name, count: 0, revenue: 0 };
        }
        stats[item.productId].count += item.quantity;
        stats[item.productId].revenue += item.subtotal;
      });
    });

    const sorted = Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    return {
      bestSelling: sorted.slice(0, 5),
      leastSelling: sorted.filter(i => i.count > 0).slice(-5).reverse()
    };
  }, [filteredData.filteredInvoices]);

  const salesChartData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    
    if (activeTab === 'daily') {
      filteredData.filteredInvoices.forEach(inv => {
        const hour = inv.time.split(':')[0] + (inv.time.includes('م') ? ' م' : ' ص');
        dataMap[hour] = (dataMap[hour] || 0) + inv.netTotal;
      });
      return Object.entries(dataMap).map(([name, sales]) => ({ name, sales }));
    } else {
      filteredData.filteredInvoices.forEach(inv => {
        const key = activeTab === 'monthly' ? new Date(inv.timestamp).getDate().toString() : (new Date(inv.timestamp).getMonth() + 1).toString();
        dataMap[key] = (dataMap[key] || 0) + inv.netTotal;
      });
      return Object.entries(dataMap)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([name, sales]) => ({ 
          name: activeTab === 'monthly' ? name : `شهر ${name}`, 
          sales 
        }));
    }
  }, [filteredData.filteredInvoices, activeTab]);

  return (
    <div className="space-y-8 animate-in font-['Cairo'] select-text pb-10" dir="rtl">
      
      {/* 1. Dashboard Filters Bar */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl flex-1 overflow-x-auto shrink-0">
            {['daily', 'monthly', 'yearly'].map(tab => (
              <button 
                key={tab} 
                onClick={() => { setActiveTab(tab as any); setSelectedDate(new Date()); }} 
                className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-[10px] font-black transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                {tab === 'daily' ? 'يومي' : tab === 'monthly' ? 'شهري' : 'سنوي'}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100 min-w-[240px]">
               <Building2 size={16} className="text-indigo-600 mr-2"/>
               <select 
                 className="bg-transparent border-none outline-none font-black text-[11px] w-full cursor-pointer" 
                 value={branchFilter} 
                 onChange={e => setBranchFilter(e.target.value)}
               >
                 <option value="">كافة الفروع (الشركة ككل)</option>
                 {branches.filter(b => !b.isDeleted).map(b => (
                   <option key={b.id} value={b.id}>{b.name}</option>
                 ))}
               </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 bg-indigo-600 px-6 py-2.5 rounded-xl text-white shadow-lg flex-1">
             <button onClick={() => changePeriod(-1)} className="p-1 hover:bg-white/10 rounded-lg transition-all"><ChevronRight size={22}/></button>
             <div className="flex flex-col items-center">
                <span className="text-[12px] font-black text-center min-w-[120px]">{dateDisplayLabel}</span>
                <span className="text-[8px] font-bold opacity-60 uppercase">فترة العرض الحالية</span>
             </div>
             <button onClick={() => changePeriod(1)} className="p-1 hover:bg-white/10 rounded-lg transition-all"><ChevronLeft size={22}/></button>
          </div>
        </div>
      </div>

      {/* 2. Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100 text-white relative overflow-hidden">
          <Coins size={80} className="absolute -bottom-4 -left-4 opacity-10 rotate-12" />
          <div className="p-2 bg-white/20 rounded-xl w-fit mb-3"><ShoppingCart size={20} /></div>
          <p className="text-indigo-100 text-[9px] font-black uppercase mb-1">إيرادات الفترة</p>
          <h3 className="text-xl font-black">{displayStats.revenue.toLocaleString()} ج.م</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-3"><TrendingUp size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">صافي الربح التقديري</p>
          <h3 className="text-lg font-black text-emerald-600">{displayStats.netProfit.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl w-fit mb-3"><RotateCcw size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">المرتجعات</p>
          <h3 className="text-lg font-black text-rose-600">{displayStats.returnsValue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl w-fit mb-3"><TrendingDown size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">المصاريف</p>
          <h3 className="text-lg font-black text-slate-800">{displayStats.expenses.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl w-fit mb-3"><Package size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">قيمة الأصول المخزنية</p>
          <h3 className="text-lg font-black text-slate-800">{displayStats.inventoryValue.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl w-fit mb-3"><AlertTriangle size={20} /></div>
          <p className="text-slate-400 text-[9px] font-black uppercase mb-1">النواقص الحالية</p>
          <h3 className="text-lg font-black text-rose-600">{displayStats.lowStockCount}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5 h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
               <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2"><BarChart3 size={14}/> تحليل المبيعات</p>
                  <h2 className="text-2xl font-black text-white">منحنى نمو الإيرادات</h2>
               </div>
               <div className="px-4 py-1.5 bg-white/5 rounded-xl border border-white/10 text-white/40 text-[9px] font-bold">نمط {activeTab === 'daily' ? 'ساعي' : activeTab === 'monthly' ? 'يومي' : 'شهري'}</div>
            </div>
            <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData}>
                     <defs>
                        <linearGradient id="colorSalesChart" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                     <YAxis hide />
                     <Tooltip 
                        contentStyle={{backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', fontFamily: 'Cairo'}} 
                        itemStyle={{color: '#818cf8', fontWeight: 'bold'}}
                     />
                     <Area type="monotone" dataKey="sales" stroke="#6366f1" fill="url(#colorSalesChart)" strokeWidth={3} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-[400px] flex flex-col">
            <div className="mb-6">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2"><PieIcon size={14}/> الهيكل المالي</p>
               <h2 className="text-xl font-black text-slate-800">توزيع السيولة</h2>
            </div>
            <div className="flex-1 min-h-0 relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={displayStats.pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {displayStats.pieData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Pie>
                     <Tooltip />
                     <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
                  <p className="text-[8px] font-black text-slate-400 uppercase">صافي الأرباح</p>
                  <p className="text-sm font-black text-emerald-600">{displayStats.netProfit.toLocaleString()}</p>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-[450px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2"><BarIcon size={14}/> قوة المخزون</p>
                  <h2 className="text-xl font-black text-slate-800">الأصناف الأعلى دخلاً (Revenue)</h2>
               </div>
            </div>
            <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productPerformance.bestSelling} layout="vertical" margin={{ left: 40 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} width={100} />
                     <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontFamily: 'Cairo'}} />
                     <Bar dataKey="revenue" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-4 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-[450px] flex flex-col">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                 <ZapOff size={18} className="text-rose-500"/> أصناف راكدة
              </h4>
              <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">الأقل مبيعاً</span>
           </div>
           <div className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
              {productPerformance.leastSelling.map((item, idx) => (
                 <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/30 rounded-2xl border border-rose-50 hover:bg-rose-50 transition-colors">
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 flex items-center justify-center bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black"><ArrowDownRight size={12}/></span>
                       <p className="text-[11px] font-black text-slate-700 truncate max-w-[120px]">{item.name}</p>
                    </div>
                    <div className="text-left">
                       <p className="text-[11px] font-black text-rose-600">{item.count} <span className="text-[9px]">قطعة</span></p>
                    </div>
                 </div>
              ))}
              {productPerformance.leastSelling.length === 0 && <p className="text-center text-[10px] text-slate-300 py-10">البيانات ممتازة، لا توجد أصناف راكدة</p>}
           </div>
         </div>
      </div>
    </div>
  );
};

export default Dashboard;