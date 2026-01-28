
import React, { useState, useMemo } from 'react';
import { 
  UserPlus, Search, Phone, Landmark, DollarSign, Eye, X, 
  Trash2, RefreshCw, CheckCircle2, History, ArrowRight,
  TrendingUp, Wallet, CreditCard, Building2, UserCheck, Scale, FileText, ClipboardList, AlertCircle, Receipt, Filter, DownloadCloud, FileSpreadsheet, Tag, ChevronDown, Activity, ShieldCheck, Lock, Building, ShieldAlert, Info, ListOrdered, ShoppingBag, RotateCcw, Package, CreditCardIcon
} from 'lucide-react';
import { Supplier, PurchaseRecord, SupplierPayment, User as UserType, ProceduralAction, PurchaseReturnRecord } from '../types';
import * as XLSX from 'xlsx';

interface SuppliersProps {
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  purchaseReturns?: PurchaseReturnRecord[];
  onAddSupplier: (name: string, phone?: string, tax?: string, comm?: string) => Promise<any>;
  onDeleteSupplier: (id: string, reason: string, user: UserType) => Promise<void>;
  onAddSupplierPayment: (sId: string, amt: number, pId: string | null, notes: string, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
  checkPermission: (user: { role: string, username: string }, action: ProceduralAction) => boolean;
  quickSettlePurchase?: (pId: string, supplierId: string, amount: number, user: UserType) => Promise<void>;
}

const Suppliers = ({ 
  suppliers = [], purchases = [], payments = [], purchaseReturns = [], onAddSupplier, onDeleteSupplier, onAddSupplierPayment, onShowToast, askConfirmation, user, checkPermission, quickSettlePurchase
}: SuppliersProps) => {
  const [viewMode, setViewMode] = useState('list' as 'list' | 'add' | 'profile');
  const [selectedSupplierId, setSelectedSupplierId] = useState(null as string | null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, notes: '', purchaseId: null as string | null });
  const [newSup, setNewSup] = useState({ name: '', phone: '', tax: '', comm: '' });
  
  // TABS for Profile
  const [profileTab, setProfileTab] = useState('purchases' as 'purchases' | 'payments' | 'returns');
  const [invoiceFilter, setInvoiceFilter] = useState('all' as 'all' | 'cash' | 'paying' | 'settled' | 'debt');
  const [detailedPurchase, setDetailedPurchase] = useState(null as PurchaseRecord | null);

  const canManageSuppliers = useMemo(() => checkPermission(user, 'manage_suppliers'), [user, checkPermission]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => !s.isDeleted && (s.name.includes(searchTerm) || (s.phone && s.phone.includes(searchTerm))));
  }, [suppliers, searchTerm]);

  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);

  const supplierPurchases = useMemo(() => {
    let list = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted);
    
    switch (invoiceFilter) {
      case 'cash': 
        return list.filter(p => p.paymentStatus === 'cash');
      case 'paying': 
        return list.filter(p => p.paidAmount > 0 && p.remainingAmount > 0);
      case 'settled': 
        // أي فاتورة رصيدها صفر هي مسددة (سواء كانت كاش من البداية أو آجل وتم سداده)
        return list.filter(p => p.remainingAmount === 0);
      case 'debt': 
        return list.filter(p => p.paidAmount === 0 && p.remainingAmount > 0);
      default: 
        return list;
    }
  }, [purchases, selectedSupplierId, invoiceFilter]);

  const supplierPayments = useMemo(() => payments.filter(p => p.supplierId === selectedSupplierId), [payments, selectedSupplierId]);
  const supplierReturns = useMemo(() => purchaseReturns.filter(r => r.supplierId === selectedSupplierId), [purchaseReturns, selectedSupplierId]);

  const unpaidPurchases = useMemo(() => {
    return purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted && p.remainingAmount > 0);
  }, [purchases, selectedSupplierId]);

  const handleQuickSettle = async (purchase: PurchaseRecord) => {
    if (!quickSettlePurchase) return;
    askConfirmation(
      "تسوية فاتورة",
      `هل تود سداد كامل المتبقي (${purchase.remainingAmount} ج.م) لهذه الفاتورة الآن؟`,
      async () => {
        try {
          setIsSubmitting(true);
          await quickSettlePurchase(purchase.id, purchase.supplierId, purchase.remainingAmount, user);
          onShowToast("تمت تسوية الفاتورة بنجاح", "success");
        } catch (e) {
          onShowToast("فشل تنفيذ التسوية", "error");
        } finally {
          setIsSubmitting(false);
        }
      },
      'info'
    );
  };

  const handleDeleteSupplier = () => {
    if (!selectedSupplier) return;
    if (selectedSupplier.totalDebt > 0) {
      onShowToast(`لا يمكن حذف المورد لوجود مديونية مستحقة بقيمة (${selectedSupplier.totalDebt.toLocaleString()} ج.م). يرجى تصفية الحساب أولاً.`, "error");
      return;
    }

    askConfirmation(
      "حذف المورد نهائياً",
      `هل أنت متأكد من حذف المورد "${selectedSupplier.name}"؟`,
      async () => {
        try {
          setIsSubmitting(true);
          await onDeleteSupplier(selectedSupplier.id, "حذف يدوي", user);
          onShowToast("تم حذف المورد بنجاح", "success");
          setViewMode('list');
          setSelectedSupplierId(null);
        } catch (e: any) { onShowToast(e.message || "فشل حذف المورد", "error"); } finally { setIsSubmitting(false); }
      },
      'danger'
    );
  };

  const getInvoiceBadge = (p: PurchaseRecord) => {
    if (p.remainingAmount === 0) {
      if (p.paymentStatus === 'cash') 
        return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase">كاش</span>;
      return <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase">خالصة / مسددة</span>;
    }
    if (p.paidAmount > 0) 
      return <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase">قيد السداد</span>;
    return <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase">آجلة (دين)</span>;
  };

  const handleAddPayment = async () => {
    if (!selectedSupplierId || !paymentForm.amount) return onShowToast("حدد المبلغ", "error");
    setIsSubmitting(true);
    try {
      await onAddSupplierPayment(selectedSupplierId, paymentForm.amount, paymentForm.purchaseId, paymentForm.notes, user);
      onShowToast("تم السداد بنجاح", "success");
      setIsPaymentModalOpen(false);
      setPaymentForm({ amount: 0, notes: '', purchaseId: null });
    } catch (e: any) { onShowToast("فشل السداد", "error"); } finally { setIsSubmitting(false); }
  };

  const handleAddSupplier = async () => {
    if (!newSup.name) return onShowToast("اسم المورد مطلوب", "error");
    setIsSubmitting(true);
    try {
      await onAddSupplier(newSup.name, newSup.phone, newSup.tax, newSup.comm);
      onShowToast("تم إضافة المورد بنجاح", "success");
      setNewSup({ name: '', phone: '', tax: '', comm: '' });
      setViewMode('list');
    } catch (e: any) {
      onShowToast("فشل إضافة المورد", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (viewMode === 'profile' && selectedSupplier) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
         {/* Supplier Profile Header */}
         <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="flex items-center gap-6">
               <button onClick={() => setViewMode('list')} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-900 group transition-all shadow-sm"><ArrowRight size={24} className="group-hover:text-white"/></button>
               <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-indigo-100">{(selectedSupplier.name || '?')[0]}</div>
               <div>
                  <h2 className="text-3xl font-black text-slate-800">{selectedSupplier.name}</h2>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg"><Phone size={14} className="text-indigo-500"/> {selectedSupplier.phone || 'بدون هاتف'}</p>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${selectedSupplier.totalDebt > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{selectedSupplier.totalDebt > 0 ? 'نشط - مدين' : 'خالص الذمة'}</span>
                  </div>
               </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
               <button onClick={() => setIsPaymentModalOpen(true)} className="flex-1 lg:flex-none px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl text-[10px] flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all active:scale-95"><DollarSign size={18}/> سداد مديونية</button>
               <button onClick={handleDeleteSupplier} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm" title="حذف المورد نهائياً"><Trash2 size={20}/></button>
            </div>
         </div>

         {/* Stats Summary */}
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
               <Landmark size={100} className="absolute -bottom-4 -left-4 text-white/10 rotate-12 transition-transform group-hover:scale-110"/>
               <p className="text-[10px] font-black opacity-60 uppercase mb-1">إجمالي المسحوبات</p>
               <h3 className="text-3xl font-black">{selectedSupplier.totalSupplied.toLocaleString()} ج.م</h3>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي المدفوعات</p>
               <h3 className="text-3xl font-black text-emerald-600">{selectedSupplier.totalPaid.toLocaleString()} ج.م</h3>
            </div>
            <div className={`p-8 rounded-[2.5rem] border shadow-sm text-center ${selectedSupplier.totalDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
               <p className={`text-[10px] font-black uppercase mb-1 ${selectedSupplier.totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>المديونية الحالية</p>
               <h3 className={`text-3xl font-black ${selectedSupplier.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{selectedSupplier.totalDebt.toLocaleString()} ج.م</h3>
            </div>
         </div>

         {/* Detailed View Area with TABS */}
         <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto">
                  <button onClick={()=>setProfileTab('purchases')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'purchases' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><ShoppingBag size={14}/> سجل التوريد</button>
                  <button onClick={()=>setProfileTab('payments')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'payments' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><DollarSign size={14}/> سجل المدفوعات</button>
                  <button onClick={()=>setProfileTab('returns')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'returns' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><RotateCcw size={14}/> المرتجعات</button>
               </div>
               
               {profileTab === 'purchases' && (
                 <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-inner overflow-x-auto">
                    {[
                      {id: 'all', label: 'الكل'}, 
                      {id: 'cash', label: 'كاش'}, 
                      {id: 'debt', label: 'آجل'}, 
                      {id: 'paying', label: 'قيد السداد'}, 
                      {id: 'settled', label: 'مسددة بالكامل'}
                    ].map(f => (
                      <button key={f.id} onClick={()=>setInvoiceFilter(f.id as any)} className={`px-4 py-2 rounded-lg text-[8px] font-black transition-all ${invoiceFilter === f.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>{f.label}</button>
                    ))}
                 </div>
               )}
            </div>

            <div className="overflow-x-auto">
               {profileTab === 'purchases' && (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                      <tr><th className="px-8 py-6">رقم السند</th><th className="px-8 py-6 text-center">الحالة</th><th className="px-8 py-6 text-center">إجمالي القيمة</th><th className="px-8 py-6 text-center">المسدد</th><th className="px-8 py-6 text-center text-rose-600">المتبقي</th><th className="px-8 py-6 text-left">إدارة</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {supplierPurchases.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-5"><p className="text-indigo-600 font-mono font-black">#{p.id.slice(-6)}</p><p className="text-[8px] text-slate-300 uppercase mt-0.5">{p.date}</p></td>
                            <td className="px-8 py-5 text-center">{getInvoiceBadge(p)}</td>
                            <td className="px-8 py-5 text-center font-black">{p.totalAmount.toLocaleString()}</td>
                            <td className="px-8 py-5 text-center text-emerald-600">{p.paidAmount.toLocaleString()}</td>
                            <td className={`px-8 py-5 text-center ${p.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{p.remainingAmount.toLocaleString()}</td>
                            <td className="px-8 py-5 text-left flex items-center justify-end gap-2">
                               <button onClick={()=>setDetailedPurchase(p)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all" title="تفاصيل الأصناف والمبالغ"><Eye size={14}/></button>
                               {p.remainingAmount > 0 && <button onClick={()=>handleQuickSettle(p)} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100">تسوية</button>}
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
               )}

               {profileTab === 'payments' && (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                      <tr><th className="px-8 py-6">معرف العملية</th><th className="px-8 py-6">التاريخ والوقت</th><th className="px-8 py-6 text-center">المبلغ المسدد</th><th className="px-8 py-6">البيان / الملاحظات</th><th className="px-8 py-6 text-left">المرجع</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {supplierPayments.map(pay => (
                          <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 font-mono text-slate-400 text-[10px]">#{pay.id.slice(0, 8)}</td>
                            <td className="px-8 py-5">{pay.date} <span className="text-[9px] opacity-40 mr-1">{pay.time}</span></td>
                            <td className="px-8 py-5 text-center text-emerald-600 font-black text-sm">{pay.amount.toLocaleString()} ج.م</td>
                            <td className="px-8 py-5 text-slate-500 text-[10px] max-w-xs truncate">{pay.notes || '---'}</td>
                            <td className="px-8 py-5 text-left text-indigo-400 font-mono text-[10px]">{pay.purchaseId ? `#${pay.purchaseId.slice(-6)}` : 'دفعة حساب'}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
               )}

               {profileTab === 'returns' && (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                      <tr><th className="px-8 py-6">رقم المرتجع</th><th className="px-8 py-6">التاريخ</th><th className="px-8 py-6 text-center">قيمة المرتجع</th><th className="px-8 py-6 text-center">طريقة الرد</th><th className="px-8 py-6 text-left">الأصناف</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {supplierReturns.map(ret => (
                          <tr key={ret.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 text-rose-600 font-mono font-black">#{ret.id.slice(-6)}</td>
                            <td className="px-8 py-5">{ret.date}</td>
                            <td className="px-8 py-5 text-center text-rose-600 font-black">{ret.totalRefund.toLocaleString()} ج.م</td>
                            <td className="px-8 py-5 text-center">
                               <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${ret.refundMethod === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                  {ret.refundMethod === 'cash' ? 'استرداد نقدي' : 'خصم من المديونية'}
                               </span>
                            </td>
                            <td className="px-8 py-5 text-left text-[9px] text-slate-400 max-w-xs truncate">{ret.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
               )}

               {((profileTab === 'purchases' && supplierPurchases.length === 0) || (profileTab === 'payments' && supplierPayments.length === 0) || (profileTab === 'returns' && supplierReturns.length === 0)) && (
                  <div className="py-32 text-center">
                    <div className="opacity-10 mb-4 flex justify-center"><History size={64}/></div>
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">لا توجد سجلات متاحة حالياً</p>
                  </div>
               )}
            </div>
         </div>

         {/* Purchase Items Modal - UPDATED TO SHOW TOTALS */}
         {detailedPurchase && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[6000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-white/10 rounded-2xl"><ListOrdered size={24} className="text-indigo-400"/></div>
                       <div><h3 className="font-black text-sm">تفاصيل فاتورة التوريد</h3><p className="text-[10px] opacity-60 uppercase font-mono tracking-widest">SND-#{detailedPurchase.id.slice(-8)}</p></div>
                    </div>
                    <button onClick={()=>setDetailedPurchase(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
                 </div>
                 
                 <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4 border-b bg-slate-50">
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase mb-1">إجمالي الفاتورة</p>
                       <p className="text-lg font-black text-slate-800">{detailedPurchase.totalAmount.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></p>
                    </div>
                    <div className="p-4 bg-white rounded-2xl border border-emerald-100 text-center">
                       <p className="text-[9px] font-black text-emerald-500 uppercase mb-1">المبلغ المسدد</p>
                       <p className="text-lg font-black text-emerald-600">{detailedPurchase.paidAmount.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></p>
                    </div>
                    <div className={`p-4 bg-white rounded-2xl border text-center ${detailedPurchase.remainingAmount > 0 ? 'border-rose-100' : 'border-slate-100'}`}>
                       <p className={`text-[9px] font-black uppercase mb-1 ${detailedPurchase.remainingAmount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>المبلغ المتبقي</p>
                       <p className={`text-lg font-black ${detailedPurchase.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{detailedPurchase.remainingAmount.toLocaleString()} <span className="text-[10px] opacity-40">ج.م</span></p>
                    </div>
                 </div>

                 <div className="p-8 max-h-[40vh] overflow-y-auto scrollbar-hide">
                    <table className="w-full text-right text-xs">
                       <thead className="text-slate-400 font-black uppercase text-[9px] border-b pb-4 block">
                          <tr className="flex justify-between w-full">
                             <th className="flex-1 text-right">الصنف</th>
                             <th className="w-20 text-center">الكمية</th>
                             <th className="w-24 text-center">سعر التكلفة</th>
                             <th className="w-24 text-left">الإجمالي</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 font-bold block">
                          {detailedPurchase.items.map((it, idx) => (
                             <tr key={idx} className="flex justify-between w-full py-4 items-center">
                                <td className="flex-1 flex items-center gap-3">
                                   <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-indigo-400"><Package size={14}/></div>
                                   <span className="text-slate-700">{it.name}</span>
                                </td>
                                <td className="w-20 text-center">{it.quantity}</td>
                                <td className="w-24 text-center text-slate-400">{it.costPrice.toLocaleString()}</td>
                                <td className="w-24 text-left text-indigo-600 font-black">{it.subtotal.toLocaleString()}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 
                 <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                       <div className="bg-white px-5 py-3 rounded-xl border border-slate-200 flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${detailedPurchase.remainingAmount === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                          <span className="text-[10px] font-black uppercase text-slate-600">حالة السداد: {detailedPurchase.remainingAmount === 0 ? 'خالصة تماماً' : 'مديونية معلقة'}</span>
                       </div>
                    </div>
                    <div className="flex gap-3">
                        {detailedPurchase.remainingAmount > 0 && (
                           <button onClick={() => { handleQuickSettle(detailedPurchase); setDetailedPurchase(null); }} className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 hover:bg-emerald-700 transition-all"><DollarSign size={16}/> تسوية الفاتورة الآن</button>
                        )}
                        <button onClick={()=>setDetailedPurchase(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-xl text-xs hover:bg-slate-100 transition-all shadow-sm">إغلاق المعاينة</button>
                    </div>
                 </div>
              </div>
           </div>
         )}

         {/* Payment Modal */}
         {isPaymentModalOpen && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3"><DollarSign size={20}/><h3 className="font-black text-sm uppercase">سداد مديونية مورد</h3></div>
                    <button onClick={() => setIsPaymentModalOpen(false)}><X size={24}/></button>
                 </div>
                 <div className="p-8 space-y-6 text-right">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase">سداد فاتورة محددة</label>
                       <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs outline-none" value={paymentForm.purchaseId || ''} onChange={e=> {
                         const val = e.target.value;
                         const p = unpaidPurchases.find(x=>x.id === val);
                         setPaymentForm({...paymentForm, purchaseId: val || null, amount: p ? p.remainingAmount : 0});
                       }}>
                          <option value="">دفع لحساب المورد العام</option>
                          {unpaidPurchases.map(p => <option key={p.id} value={p.id}>سند #{p.id.slice(-6)} - متبقي {p.remainingAmount} ج.م</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المراد دفعه</label><input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-600 rounded-2xl font-black text-xl outline-none" value={paymentForm.amount || ''} onChange={e=>setPaymentForm({...paymentForm, amount: Number(e.target.value)})} /></div>
                       <div className="p-4 bg-rose-50 rounded-2xl flex flex-col justify-center"><p className="text-[10px] font-black text-rose-400">إجمالي المديونية</p><p className="text-xl font-black text-rose-700">{selectedSupplier.totalDebt.toLocaleString()}</p></div>
                    </div>
                    <textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs h-20 resize-none" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="بيان العملية..." />
                    <button onClick={handleAddPayment} disabled={isSubmitting || !paymentForm.amount} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3">
                       {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} اعتماد السداد
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
           <div><h2 className="text-2xl font-black text-slate-800">قائمة الموردين</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إدارة الديون والحركات المالية للتوريد</p></div>
        </div>
        {canManageSuppliers && (
          <button onClick={() => setViewMode('add')} className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl text-[11px] flex items-center gap-3 shadow-xl hover:bg-indigo-700 transition-all active:scale-95">
             <UserPlus size={18}/> مورد جديد
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm"><div className="relative w-full"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="بحث بالاسم أو الهاتف..." className="w-full pr-14 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {filteredSuppliers.map(s => (
               <div key={s.id} onClick={() => {setSelectedSupplierId(s.id); setViewMode('profile'); setProfileTab('purchases');}} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">{(s.name || '?')[0]}</div>
                     <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${s.totalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{s.totalDebt > 0 ? 'مدين' : 'خالص'}</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-1">{s.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6"><Phone size={12} className="inline ml-1"/> {s.phone || '---'}</p>
                  <div className="grid grid-cols-2 gap-2 pt-6 border-t border-slate-50">
                     <div><p className="text-[8px] font-black text-slate-400 uppercase">المشتريات</p><p className="text-sm font-black text-slate-700">{s.totalSupplied.toLocaleString()}</p></div>
                     <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase">المديونية</p><p className={`text-sm font-black ${s.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{s.totalDebt.toLocaleString()}</p></div>
                  </div>
               </div>
         ))}
      </div>

      {viewMode === 'add' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-2"><UserPlus size={18}/> تسجيل مورد جديد</h3>
                 <button onClick={() => setViewMode('list')} className="p-1 hover:bg-white/10 rounded-lg transition-transform hover:rotate-90"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-4 text-right">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم المورد</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.name} onChange={e=>setNewSup({...newSup, name: e.target.value})} placeholder="أدخل اسم الشركة الموردة..." /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">الهاتف</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.phone} onChange={e=>setNewSup({...newSup, phone: e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">الرقم الضريبي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.tax} onChange={e=>setNewSup({...newSup, tax: e.target.value})} /></div>
                 </div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">السجل التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none shadow-inner" value={newSup.comm} onChange={e=>setNewSup({...newSup, comm: e.target.value})} /></div>
                 <button onClick={handleAddSupplier} disabled={isSubmitting} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all mt-4 flex items-center justify-center gap-3">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} حفظ المورد في النظام
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
