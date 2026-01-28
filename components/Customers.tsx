import React, { useState, useMemo } from 'react';
import { Search, Users, UserPlus, TrendingUp, Star, Receipt, UserCheck, Activity, X, ArrowUpDown, Calendar, Hash, ShoppingBag, UserCircle, ChevronLeft, ChevronRight, LayoutList, RotateCcw, ArrowRight, Smartphone, Save, RefreshCw, MessageSquare, ClipboardList } from 'lucide-react';
import { Invoice, ReturnRecord, Customer } from '../types';

interface CustomersProps {
  invoices: Invoice[];
  returns: ReturnRecord[];
  registeredCustomers: Customer[];
  onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'isDeleted'>) => Promise<any>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

const Customers = ({ invoices, returns, registeredCustomers = [], onAddCustomer, onDeleteCustomer, onShowToast }: CustomersProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(null as string | null);
  const [transSortConfig, setTransSortConfig] = useState({ key: 'timestamp', direction: 'desc' } as { key: string, direction: 'asc' | 'desc' });
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', email: '', notes: '', category: 'potential' as 'potential' | 'regular' | 'vip' });

  // دمج العملاء المسجلين مع العملاء من الفواتير
  const customerList = useMemo(() => {
    const map = new Map<string, { 
      phone: string, 
      name: string, 
      totalSpending: number, 
      lastVisit: string, 
      invoiceCount: number, 
      visitsCount: number, 
      visitDates: Set<string>,
      notes?: string,
      type: 'potential' | 'active',
      category: string
    }>();

    // 1. إضافة العملاء المسجلين أولاً (كعملاء محتملين افتراضياً)
    registeredCustomers.forEach(c => {
      map.set(c.phone, {
        phone: c.phone,
        name: c.name,
        totalSpending: 0,
        lastVisit: 'لم يزر بعد',
        invoiceCount: 0,
        visitsCount: 0,
        visitDates: new Set<string>(),
        notes: c.notes,
        type: 'potential',
        category: c.category || 'potential'
      });
    });
    
    // 2. تحديث البيانات من سجل الفواتير
    invoices.filter(inv => !inv.isDeleted && inv.customerPhone).forEach(inv => {
      const phone = inv.customerPhone!;
      const existing = map.get(phone);
      
      const current = existing || { 
        phone, 
        name: inv.customerName || 'بدون اسم', 
        totalSpending: 0, 
        lastVisit: inv.date, 
        invoiceCount: 0, 
        visitsCount: 0, 
        visitDates: new Set<string>(),
        type: 'active',
        category: 'regular'
      };
      
      current.totalSpending += inv.netTotal;
      current.invoiceCount += 1;
      current.visitDates.add(inv.date);
      current.visitsCount = current.visitDates.size;
      current.type = 'active'; // إذا اشترى فهو نشط
      
      if (current.lastVisit === 'لم يزر بعد' || new Date(inv.timestamp) > new Date(current.lastVisit)) {
        current.lastVisit = inv.date;
      }
      map.set(phone, current);
    });

    return Array.from(map.values()).filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    ).sort((a,b) => {
        if (a.type === b.type) return b.totalSpending - a.totalSpending;
        return a.type === 'active' ? -1 : 1; // النشطين أولاً
    });
  }, [invoices, registeredCustomers, searchTerm]);

  const stats = useMemo(() => ({
    total: customerList.length,
    active: customerList.filter(c => c.type === 'active').length,
    potential: customerList.filter(c => c.type === 'potential').length,
    totalSpending: customerList.reduce((acc, c) => acc + c.totalSpending, 0)
  }), [customerList]);

  const selectedCustomer = useMemo(() => 
    customerList.find(c => c.phone === selectedCustomerPhone), 
    [customerList, selectedCustomerPhone]
  );

  const customerTransactions = useMemo(() => {
    if (!selectedCustomerPhone) return [];
    return invoices
      .filter(inv => !inv.isDeleted && inv.customerPhone === selectedCustomerPhone)
      .sort((a: any, b: any) => {
        const valA = a[transSortConfig.key];
        const valB = b[transSortConfig.key];
        return transSortConfig.direction === 'asc' ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
      });
  }, [invoices, selectedCustomerPhone, transSortConfig]);

  const customerReturnsStats = useMemo(() => {
    if (!selectedCustomerPhone) return { count: 0, value: 0 };
    const customerInvoiceIds = new Set(invoices.filter(inv => inv.customerPhone === selectedCustomerPhone).map(i => i.id));
    const relevantReturns = returns.filter(r => customerInvoiceIds.has(r.invoiceId));
    return {
      count: relevantReturns.length,
      value: relevantReturns.reduce((acc, r) => acc + r.totalRefund, 0)
    };
  }, [returns, invoices, selectedCustomerPhone]);

  const handleAddNewCustomer = async () => {
    if (!newCustomerForm.name || !newCustomerForm.phone) return onShowToast("الاسم والهاتف مطلوبان", "error");
    setIsSubmitting(true);
    try {
      await onAddCustomer(newCustomerForm);
      onShowToast("تم تسجيل العميل بنجاح", "success");
      setIsAddModalOpen(false);
      setNewCustomerForm({ name: '', phone: '', email: '', notes: '', category: 'potential' });
    } catch (e) {
      onShowToast("فشل تسجيل العميل - ربما الهاتف مسجل مسبقاً", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* 1. Header & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><Users size={32}/></div>
           <div><h2 className="text-2xl font-black text-slate-800">قاعدة بيانات العملاء</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إدارة العلاقات والعملاء المحتملين</p></div>
        </div>
        <button onClick={() => setIsAddModalOpen(true)} className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl text-xs flex items-center gap-3 shadow-xl hover:bg-black transition-all">
           <UserPlus size={18}/> تسجيل عميل جديد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي العملاء</p>
           <h3 className="text-xl font-black text-slate-800">{stats.total} عميل</h3>
        </div>
        <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
           <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">عملاء نشطون</p>
           <h3 className="text-xl font-black text-emerald-700">{stats.active} مشترك</h3>
        </div>
        <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 shadow-sm">
           <p className="text-[10px] font-black text-amber-600 uppercase mb-1">عملاء محتملون</p>
           <h3 className="text-xl font-black text-amber-700">{stats.potential} مسجل</h3>
        </div>
        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm">
           <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">قيمة المبيعات</p>
           <h3 className="text-xl font-black text-indigo-700">{stats.totalSpending.toLocaleString()} ج.م</h3>
        </div>
      </div>

      {/* 2. Search Controls */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="بحث بالاسم أو رقم الهاتف..." className="w-full pr-14 pl-4 py-4 bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-600 rounded-2xl outline-none font-bold text-sm transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-[10px] text-slate-400 font-black uppercase border-b">
              <tr>
                <th className="px-8 py-5">العميل</th>
                <th className="px-8 py-5">رقم الهاتف</th>
                <th className="px-8 py-5 text-center">النوع</th>
                <th className="px-8 py-5 text-center">إجمالي المشتريات</th>
                <th className="px-8 py-5">آخر عملية</th>
                <th className="px-8 py-5 text-left">إدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-bold">
              {customerList.map((c, i) => (
                <tr key={i} className="hover:bg-indigo-50/30 transition-all group cursor-pointer" onClick={() => setSelectedCustomerPhone(c.phone)}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-xl flex items-center justify-center font-black shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">{(c.name || '?')[0]}</div>
                      <div>
                         <span className="font-black text-slate-800 text-xs">{c.name || '---'}</span>
                         {c.notes && <p className="text-[8px] text-slate-400 font-bold max-w-[150px] truncate">{c.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4 font-mono text-slate-500 text-xs">{c.phone}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${c.type === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {c.type === 'active' ? 'عميل نشط' : 'عميل محتمل'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-center font-black text-indigo-600">{c.totalSpending.toLocaleString()} ج.م</td>
                  <td className="px-8 py-5 text-slate-400 text-[10px] font-bold">{c.lastVisit}</td>
                  <td className="px-8 py-5 text-left">
                    <button className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                      <ChevronLeft size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-3"><UserPlus size={18}/> تسجيل عميل جديد في النظام</h3>
                 <button onClick={() => setIsAddModalOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-5 text-right">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم العميل بالكامل</label>
                    <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all" value={newCustomerForm.name} onChange={e=>setNewCustomerForm({...newCustomerForm, name: e.target.value})} placeholder="الاسم الشخصي أو التجاري..." />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم الهاتف</label>
                       <div className="relative">
                          <Smartphone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                          <input type="text" className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={newCustomerForm.phone} onChange={e=>setNewCustomerForm({...newCustomerForm, phone: e.target.value})} placeholder="012XXXXXXXX" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase mr-1">التصنيف الأولي</label>
                       <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={newCustomerForm.category} onChange={e=>setNewCustomerForm({...newCustomerForm, category: e.target.value as any})}>
                          <option value="potential">عميل محتمل (مهتم)</option>
                          <option value="regular">عميل عادي</option>
                          <option value="vip">عميل VIP</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1">البريد الإلكتروني (اختياري)</label>
                    <input type="email" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={newCustomerForm.email} onChange={e=>setNewCustomerForm({...newCustomerForm, email: e.target.value})} />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase mr-1">ملاحظات إدارية عن العميل</label>
                    <textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs h-24 resize-none" value={newCustomerForm.notes} onChange={e=>setNewCustomerForm({...newCustomerForm, notes: e.target.value})} placeholder="اكتب اهتمامات العميل أو أي تفاصيل هامة..." />
                 </div>
                 <button onClick={handleAddNewCustomer} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} اعتماد وحفظ بيانات العميل
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* 5. Customer Profile Drawer/Modal (Existing functionality enhanced) */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-50 z-[2000] overflow-y-auto animate-in slide-in-from-bottom-10">
           <div className="max-w-7xl mx-auto p-8 space-y-8">
              <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-200">
                 <div className="flex items-center gap-6">
                    <button onClick={() => setSelectedCustomerPhone(null)} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><ArrowRight size={24}/></button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-indigo-200">{(selectedCustomer.name || '?')[0]}</div>
                        <div>
                           <h1 className="text-3xl font-black text-slate-800">{selectedCustomer.name || '---'}</h1>
                           <div className="flex gap-4 mt-1">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Smartphone size={12}/> {selectedCustomer.phone}</p>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${selectedCustomer.type === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{selectedCustomer.type === 'active' ? 'مشترك فعلي' : 'مسجل / محتمل'}</span>
                           </div>
                        </div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">إجمالي الفواتير</p>
                          <h3 className="text-3xl font-black text-slate-800">{selectedCustomer.invoiceCount}</h3>
                       </div>
                       <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                          <p className="text-[10px] font-black text-indigo-200 uppercase mb-2 relative z-10">إجمالي المدفوعات</p>
                          <h3 className="text-3xl font-black relative z-10">{selectedCustomer.totalSpending.toLocaleString()} ج.م</h3>
                       </div>
                       <div className="bg-white p-8 rounded-[2.5rem] border border-rose-100 shadow-sm">
                          <p className="text-[10px] font-black text-rose-400 uppercase mb-2">المرتجعات</p>
                          <h3 className="text-3xl font-black text-rose-600">{customerReturnsStats.value.toLocaleString()} ج.م</h3>
                       </div>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                       <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                          <h4 className="font-black text-lg text-slate-800 flex items-center gap-3"><LayoutList size={24} className="text-indigo-600"/> سجل المشتريات التاريخي</h4>
                       </div>
                       {customerTransactions.length > 0 ? (
                         <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                               <tr>
                                  <th className="px-8 py-6">التاريخ والوقت</th>
                                  <th className="px-8 py-6">رقم الفاتورة</th>
                                  <th className="px-8 py-6 text-center">قيمة الفاتورة</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                               {customerTransactions.map(inv => (
                                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                                     <td className="px-8 py-5 text-slate-400 font-mono">{inv.date} | {inv.time}</td>
                                     <td className="px-8 py-5 text-indigo-600 font-mono">#{inv.id.slice(-6)}</td>
                                     <td className="px-8 py-5 text-center text-emerald-600">{inv.netTotal.toLocaleString()} ج.م</td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                       ) : (
                         <div className="py-20 text-center opacity-30 italic font-black text-slate-400 uppercase">لا توجد حركات بيع مسجلة لهذا العميل حتى الآن</div>
                       )}
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-xl min-h-[300px]">
                       <h4 className="font-black text-sm flex items-center gap-3 border-b border-white/10 pb-4 mb-6"><ClipboardList className="text-indigo-400" size={20}/> ملاحظات ومركز اهتمام العميل</h4>
                       <div className="bg-white/5 p-6 rounded-2xl border border-white/10 italic text-sm text-slate-300 leading-relaxed min-h-[150px]">
                          {selectedCustomer.notes || "لا توجد ملاحظات إدارية مسجلة عن هذا العميل."}
                       </div>
                       <div className="mt-8 space-y-4">
                          <p className="text-[10px] font-black text-indigo-400 uppercase">بيانات التواصل المباشر</p>
                          <button onClick={() => window.open(`tel:${selectedCustomer.phone}`)} className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-all border border-white/5">
                             <div className="p-2 bg-indigo-600 rounded-xl"><Smartphone size={16}/></div>
                             <span className="text-xs font-black">{selectedCustomer.phone}</span>
                          </button>
                          <button onClick={() => window.open(`https://wa.me/${selectedCustomer.phone}`)} className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-all border border-white/5">
                             <div className="p-2 bg-emerald-600 rounded-xl"><MessageSquare size={16}/></div>
                             <span className="text-xs font-black">مراسلة واتساب</span>
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Customers;