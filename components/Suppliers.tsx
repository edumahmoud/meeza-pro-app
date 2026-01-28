import React, { useState, useMemo } from 'react';
import { 
  UserPlus, Search, Phone, Landmark, DollarSign, Eye, X, 
  Trash2, RefreshCw, CheckCircle2, History, ArrowRight,
  TrendingUp, Wallet, CreditCard, Building2, UserCheck, Scale, FileText, ClipboardList, AlertCircle, Receipt, Filter, DownloadCloud, FileSpreadsheet, Tag, ChevronDown, Activity
} from 'lucide-react';
import { Supplier, PurchaseRecord, SupplierPayment, User as UserType } from '../types';
import * as XLSX from 'xlsx';

interface SuppliersProps {
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  onAddSupplier: (name: string, phone?: string, tax?: string, comm?: string) => Promise<any>;
  onDeleteSupplier: (id: string, reason: string, user: UserType) => Promise<void>;
  onAddSupplierPayment: (sId: string, amt: number, pId: string | null, notes: string, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
}

const Suppliers = ({ 
  suppliers = [], purchases = [], payments = [], onAddSupplier, onDeleteSupplier, onAddSupplierPayment, onShowToast, askConfirmation, user 
}: SuppliersProps) => {
  const [viewMode, setViewMode] = useState('list' as 'list' | 'add' | 'profile');
  const [selectedSupplierId, setSelectedSupplierId] = useState(null as string | null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, notes: '', purchaseId: null as string | null });
  const [newSup, setNewSup] = useState({ name: '', phone: '', tax: '', comm: '' });
  const [invoiceFilter, setInvoiceFilter] = useState('all' as 'all' | 'paid' | 'unpaid');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => !s.isDeleted && (s.name.includes(searchTerm) || (s.phone && s.phone.includes(searchTerm))));
  }, [suppliers, searchTerm]);

  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);

  const supplierPurchases = useMemo(() => {
    let list = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted);
    if (invoiceFilter === 'paid') return list.filter(p => p.remainingAmount <= 0);
    if (invoiceFilter === 'unpaid') return list.filter(p => p.remainingAmount > 0);
    return list;
  }, [purchases, selectedSupplierId, invoiceFilter]);

  const unpaidPurchases = useMemo(() => {
    return purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted && p.remainingAmount > 0);
  }, [purchases, selectedSupplierId]);

  const supplierPayments = useMemo(() => payments.filter(p => p.supplierId === selectedSupplierId), [payments, selectedSupplierId]);

  const handleAddSupplier = async () => {
    if (!newSup.name.trim()) return onShowToast("اسم المورد مطلوب", "error");
    setIsSubmitting(true);
    try {
      await onAddSupplier(newSup.name, newSup.phone, newSup.tax, newSup.comm);
      onShowToast("تم تسجيل المورد بنجاح في النظام", "success");
      setNewSup({ name: '', phone: '', tax: '', comm: '' });
      setViewMode('list');
    } catch (e) { onShowToast("فشل تسجيل المورد - ربما الاسم مكرر", "error"); } finally { setIsSubmitting(false); }
  };

  const handleAddPayment = async () => {
    if (!selectedSupplierId || !paymentForm.amount) return onShowToast("حدد المبلغ المراد سداده", "error");
    setIsSubmitting(true);
    try {
      await onAddSupplierPayment(selectedSupplierId, paymentForm.amount, paymentForm.purchaseId, paymentForm.notes, user);
      onShowToast("تم تسجيل عملية السداد وتحديث المديونية بنجاح", "success");
      setIsPaymentModalOpen(false);
      setPaymentForm({ amount: 0, notes: '', purchaseId: null });
    } catch (e) { onShowToast("فشل السداد - تأكد من الاتصال بالسحابة", "error"); } finally { setIsSubmitting(false); }
  };

  const handleExportStatement = () => {
    if (!selectedSupplier) return;
    const wb = XLSX.utils.book_new();
    const invData = supplierPurchases.map(p => ({ "السند": p.id.slice(-6), "فاتورة المورد": p.supplierInvoiceNo || '---', "التاريخ": p.date, "الإجمالي": p.totalAmount, "المسدد": p.paidAmount, "المتبقي": p.remainingAmount }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invData), "سجل التوريدات");
    const payData = supplierPayments.map(p => ({ "المعرف": p.id.slice(0, 8), "التاريخ": p.date || '---', "المبلغ": p.amount, "البيان": p.notes || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payData), "سجل المدفوعات");
    XLSX.writeFile(wb, `SOA_${selectedSupplier.name}.xlsx`);
    onShowToast("تم تصدير كشف الحساب بنجاح", "success");
  };

  const getSupplierStatus = (sup: Supplier) => {
    if (sup.totalDebt <= 0) return { label: 'حسابه خالص', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    if (sup.totalPaid > 0 && sup.totalDebt > 0) return { label: 'جاري التسديد', color: 'bg-amber-50 text-amber-600 border-amber-100' };
    return { label: 'عليه مديونية', color: 'bg-rose-50 text-rose-600 border-rose-100' };
  };

  if (viewMode === 'profile' && selectedSupplier) {
    const status = getSupplierStatus(selectedSupplier);
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
         <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6">
            <div className="flex items-center gap-4">
               <button onClick={() => setViewMode('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-900 group transition-all shadow-sm"><ArrowRight size={24} className="group-hover:text-white"/></button>
               <div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-100">{(selectedSupplier.name || '?')[0]}</div>
               <div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedSupplier.name}</h2>
                  <div className="flex gap-3 mt-1 items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Phone size={12}/> {selectedSupplier.phone || 'بدون هاتف'}</p>
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${status.color}`}>{status.label}</span>
                  </div>
               </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
               <button onClick={handleExportStatement} className="flex-1 lg:flex-none px-6 py-4 bg-white border-2 border-slate-100 text-slate-600 font-black rounded-2xl text-[10px] flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all shadow-sm"><FileSpreadsheet size={18}/> كشف حساب شامل</button>
               <button onClick={() => setIsPaymentModalOpen(true)} className="flex-1 lg:flex-none px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl text-[10px] flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all active:scale-95"><DollarSign size={18}/> سداد مديونية</button>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center text-center relative overflow-hidden group">
               <TrendingUp size={80} className="absolute -bottom-4 -left-4 text-slate-50 opacity-10 group-hover:scale-110 transition-transform"/>
               <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي المشتريات المعتمدة</p>
               <h3 className="text-3xl font-black text-slate-800">{selectedSupplier.totalSupplied.toLocaleString()} ج.م</h3>
            </div>
            <div className={`p-8 rounded-[2.5rem] border shadow-sm flex flex-col justify-center text-center transition-colors ${selectedSupplier.totalDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
               <AlertCircle size={32} className={`mx-auto mb-4 ${selectedSupplier.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}/>
               <p className={`text-[10px] font-black uppercase mb-1 ${selectedSupplier.totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>المديونية الحالية (آجل)</p>
               <h3 className={`text-3xl font-black ${selectedSupplier.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedSupplier.totalDebt.toLocaleString()} ج.م</h3>
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
            <div className="p-6 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-3 font-black text-xs text-slate-800"><History size={18} className="text-indigo-600"/> أرشيف التوريد المعتمد لهذا المورد</div>
               <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-inner">
                  <button onClick={()=>setInvoiceFilter('all')} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${invoiceFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>الكل</button>
                  <button onClick={()=>setInvoiceFilter('paid')} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${invoiceFilter === 'paid' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400'}`}>المسددة</button>
                  <button onClick={()=>setInvoiceFilter('unpaid')} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${invoiceFilter === 'unpaid' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400'}`}>المدينة (آجل)</button>
               </div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-right text-xs"><thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b"><tr><th className="px-8 py-4">رقم السند</th><th className="px-8 py-4 text-center">رقم الفاتورة</th><th className="px-8 py-4 text-center">الإجمالي</th><th className="px-8 py-4 text-center">المسدد</th><th className="px-8 py-4 text-center">المتبقي</th><th className="px-8 py-4 text-left">التاريخ</th></tr></thead><tbody className="divide-y divide-slate-50 font-bold text-slate-700">
               {supplierPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-8 py-4 text-indigo-600 font-mono">#{p.id.slice(-6)}</td>
                     <td className="px-8 py-4 text-center text-slate-400">{p.supplierInvoiceNo || '---'}</td>
                     <td className="px-8 py-4 text-center">{p.totalAmount.toLocaleString()}</td>
                     <td className="px-8 py-4 text-center text-emerald-600">{p.paidAmount.toLocaleString()}</td>
                     <td className={`px-8 py-4 text-center ${p.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{p.remainingAmount.toLocaleString()}</td>
                     <td className="px-8 py-4 text-left text-slate-400 font-mono">{p.date}</td>
                  </tr>
               ))}
               {supplierPurchases.length === 0 && <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic">لا توجد فواتير مطابقة للفلتر</td></tr>}
            </tbody></table></div>
         </div>

         {/* Debt Payment Modal */}
         {isPaymentModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 border-4 border-emerald-50">
                 <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><DollarSign size={20}/></div><h3 className="font-black text-sm uppercase">معالجة سداد مديونية مورد</h3></div>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={24}/></button>
                 </div>
                 <div className="p-8 space-y-6 text-right overflow-y-auto max-h-[80vh] scrollbar-hide">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-1">تحديد الفاتورة المستهدفة بالسداد (اختياري)</label>
                       <div className="border rounded-2xl overflow-hidden shadow-inner bg-slate-50 max-h-40 overflow-y-auto divide-y divide-slate-200/50">
                          {unpaidPurchases.map(p => (
                             <div key={p.id} onClick={() => setPaymentForm({...paymentForm, purchaseId: p.id, amount: p.remainingAmount})} className={`p-4 cursor-pointer hover:bg-emerald-50 transition-all flex justify-between items-center ${paymentForm.purchaseId === p.id ? 'bg-emerald-50 border-r-4 border-emerald-500' : ''}`}>
                                <div><p className="font-black text-xs text-slate-700">سند #{p.id.slice(-6)} ({p.date})</p><p className="text-[9px] text-slate-400">فاتورة المورد: {p.supplierInvoiceNo || '---'}</p></div>
                                <div className="text-left font-black text-rose-600 text-xs">{p.remainingAmount.toLocaleString()} ج.م</div>
                             </div>
                          ))}
                          {unpaidPurchases.length === 0 && <div className="p-10 text-center text-slate-300 italic font-bold">لا يوجد فواتير مدينة معلقة</div>}
                       </div>
                       {paymentForm.purchaseId && <button onClick={()=>setPaymentForm({...paymentForm, purchaseId: null, amount: 0})} className="text-[10px] font-black text-rose-500 hover:underline flex items-center gap-1"><X size={12}/> إلغاء اختيار الفاتورة والدفع للحساب العام</button>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المراد دفعه</label><input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-600 rounded-2xl font-black text-xl outline-none transition-all shadow-inner" value={paymentForm.amount || ''} onChange={e=>setPaymentForm({...paymentForm, amount: Number(e.target.value)})} placeholder="0.00" /></div>
                       <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col justify-center"><p className="text-[10px] font-black text-rose-400 uppercase">رصيد المديونية الكلي</p><p className="text-xl font-black text-rose-700">{selectedSupplier.totalDebt.toLocaleString()} ج.م</p></div>
                    </div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">بيان العملية (اختياري)</label><textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs h-20 resize-none outline-none focus:ring-4 focus:ring-emerald-500/5" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="رقم الشيك، اسم المحصل، تفاصيل التحويل..." /></div>
                    
                    <button onClick={handleAddPayment} disabled={isSubmitting || !paymentForm.amount} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                       {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} تأكيد سداد المبلغ وتحديث الخزينة
                    </button>
                 </div>
              </div>
           </div>
         )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in pb-12 select-text font-['Cairo']" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg"><UserCheck size={32}/></div>
           <div><h2 className="text-2xl font-black text-slate-800">سجل الموردين</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إدارة الديون والتوريدات المعتمدة</p></div>
        </div>
        <button onClick={() => setViewMode('add')} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl text-[11px] flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
           <UserPlus size={18}/> إضافة مورد جديد
        </button>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm"><div className="relative w-full"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="بحث عن مورد بالاسم أو الهاتف..." className="w-full pr-14 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredSuppliers.map(s => {
            const status = getSupplierStatus(s);
            return (
               <div key={s.id} onClick={() => {setSelectedSupplierId(s.id); setViewMode('profile');}} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">{(s.name || '?')[0]}</div>
                     <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase border ${status.color}`}>{status.label}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-1">{s.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6"><Phone size={12} className="inline ml-1"/> {s.phone || '---'}</p>
                  <div className="grid grid-cols-2 gap-2 pt-6 border-t border-slate-50">
                     <div><p className="text-[8px] font-black text-slate-400 uppercase">إجمالي التوريدات</p><p className="text-sm font-black text-slate-700">{s.totalSupplied.toLocaleString()}</p></div>
                     <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase">المديونية</p><p className={`text-sm font-black ${s.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{s.totalDebt.toLocaleString()}</p></div>
                  </div>
               </div>
            );
         })}
      </div>

      {/* Add Supplier Modal */}
      {viewMode === 'add' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-2"><UserPlus size={18}/> تسجيل بيانات مورد جديد</h3>
                 <button onClick={() => setViewMode('list')} className="p-1 hover:bg-white/10 rounded-lg transition-transform hover:rotate-90"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-4 text-right">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم الشركة / المورد</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.name} onChange={e=>setNewSup({...newSup, name: e.target.value})} placeholder="أدخل اسم المورد..." /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم الهاتف</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.phone} onChange={e=>setNewSup({...newSup, phone: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">الرقم الضريبي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.tax} onChange={e=>setNewSup({...newSup, tax: e.target.value})} /></div>
                 </div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">السجل التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.comm} onChange={e=>setNewSup({...newSup, comm: e.target.value})} /></div>
                 <button onClick={handleAddSupplier} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all mt-4 flex items-center justify-center gap-3">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} اعتماد وحفظ المورد في السجل
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;