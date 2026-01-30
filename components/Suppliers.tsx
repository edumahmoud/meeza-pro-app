import { useState, useMemo } from 'react';
import { 
  UserPlus, Search, Phone, Landmark, DollarSign, Eye, X, 
  Trash2, RefreshCw, CheckCircle2, History, ArrowRight,
  TrendingUp, Wallet, CreditCard, Building2, UserCheck, Scale, FileText, ClipboardList, AlertCircle, Receipt, Filter, DownloadCloud, FileSpreadsheet, Tag, ChevronDown, Activity, ShieldCheck, Lock, Building, ShieldAlert, Info, ListOrdered, ShoppingBag, RotateCcw, Package, CreditCardIcon, Save
} from 'lucide-react';
import { Supplier, PurchaseRecord, SupplierPayment, User as UserType, ProceduralAction, PurchaseReturnRecord, PurchaseItem } from '../types';

interface SuppliersProps {
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  purchaseReturns?: PurchaseReturnRecord[];
  onAddSupplier: (name: string, phone?: string, tax?: string, comm?: string) => Promise<any>;
  onDeleteSupplier: (id: string, reason: string, user: UserType) => Promise<void>;
  onDeletePurchase?: (id: string, reason: string, user: UserType) => Promise<void>;
  onAddSupplierPayment: (sId: string, amt: number, pId: string | null, notes: string, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
  checkPermission: (user: { role: string, username: string }, action: ProceduralAction) => boolean;
  quickSettlePurchase?: (pId: string, supplierId: string, amount: number, user: UserType) => Promise<void>;
  onAddPurchaseReturn?: (record: PurchaseReturnRecord, user: UserType) => Promise<void>;
}

const Suppliers = ({ 
  suppliers = [], purchases = [], payments = [], purchaseReturns = [], onAddSupplier, onDeleteSupplier, onDeletePurchase, onAddSupplierPayment, onShowToast, askConfirmation, user, checkPermission, quickSettlePurchase, onAddPurchaseReturn
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
  const [invoiceFilter, setInvoiceFilter] = useState('all' as 'all' | 'cash' | 'debt' | 'paying' | 'settled');
  const [detailedPurchase, setDetailedPurchase] = useState(null as PurchaseRecord | null);

  // Return Process State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returningPurchase, setReturningPurchase] = useState(null as PurchaseRecord | null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'debt_deduction'>('debt_deduction');

  const canManageSuppliers = useMemo(() => checkPermission(user, 'manage_suppliers'), [user, checkPermission]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => !s.isDeleted && (s.name.includes(searchTerm) || (s.phone && s.phone.includes(searchTerm))));
  }, [suppliers, searchTerm]);

  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);

  const liveStats = useMemo(() => {
    if (!selectedSupplierId) return { totalSupplied: 0, totalPaid: 0, totalDebt: 0 };
    const supplierInvs = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted);
    const supplierRets = (purchaseReturns || []).filter(r => r.supplierId === selectedSupplierId);

    const totalSupplied = supplierInvs.reduce((acc, p) => acc + Number(p.totalAmount), 0);
    const totalReturns = supplierRets.reduce((acc, r) => acc + Number(r.totalRefund), 0);
    const currentDebt = supplierInvs.reduce((acc, p) => acc + Math.max(0, Number(p.totalAmount) - Number(p.paidAmount)), 0);
    const totalPaid = (totalSupplied - totalReturns) - currentDebt;

    return {
      totalSupplied: totalSupplied - totalReturns,
      totalPaid: Math.max(0, totalPaid),
      totalDebt: currentDebt > 0.01 ? currentDebt : 0
    };
  }, [purchases, purchaseReturns, selectedSupplierId]);

  const supplierPurchases = useMemo(() => {
    let list = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted);
    switch (invoiceFilter) {
      case 'cash': 
        return list.filter(p => p.paymentStatus === 'cash');
      case 'debt': 
        return list.filter(p => Number(p.paidAmount) === 0 && Number(p.remainingAmount) > 0.1);
      case 'paying': 
        return list.filter(p => Number(p.paidAmount) > 0 && Number(p.remainingAmount) > 0.1 && p.paymentStatus !== 'cash');
      case 'settled': 
        return list.filter(p => Number(p.remainingAmount) <= 0.1 && p.paymentStatus !== 'cash'); 
      default: 
        return list;
    }
  }, [purchases, selectedSupplierId, invoiceFilter]);

  const supplierPaymentsMap = useMemo(() => payments.filter(p => p.supplierId === selectedSupplierId), [payments, selectedSupplierId]);
  const supplierReturnsMap = useMemo(() => (purchaseReturns || []).filter(r => r.supplierId === selectedSupplierId), [purchaseReturns, selectedSupplierId]);

  const handleStartReturn = (p: PurchaseRecord) => {
    setReturningPurchase(p);
    const initialQtys: Record<string, number> = {};
    p.items.forEach(it => initialQtys[it.productId] = 0);
    setReturnQtys(initialQtys);
    setIsReturnModalOpen(true);
    setDetailedPurchase(null);
  };

  const handleFinalizeReturn = async () => {
    if (!returningPurchase || !onAddPurchaseReturn) return;
    const itemsToReturn = returningPurchase.items
      .filter(it => returnQtys[it.productId] > 0)
      .map(it => ({ ...it, quantity: returnQtys[it.productId], subtotal: returnQtys[it.productId] * it.costPrice }));

    if (itemsToReturn.length === 0) return onShowToast("يرجى تحديد كمية صنف واحد على الأقل", "error");

    setIsSubmitting(true);
    try {
      await onAddPurchaseReturn({
        id: crypto.randomUUID(),
        originalPurchaseId: returningPurchase.id,
        supplierId: returningPurchase.supplierId,
        items: itemsToReturn,
        totalRefund: itemsToReturn.reduce((a, b) => a + b.subtotal, 0),
        refundMethod,
        isMoneyReceived: refundMethod === 'cash',
        date: new Date().toLocaleDateString('ar-EG'),
        time: new Date().toLocaleTimeString('ar-EG'),
        timestamp: Date.now(),
        createdBy: user.id,
        branchId: user.branchId || null,
        notes: `مرتجع مشتريات للفاتورة #${returningPurchase.id.slice(-6)}`
      }, user);
      onShowToast("تم تنفيذ المرتجع بنجاح", "success");
      setIsReturnModalOpen(false);
      setReturningPurchase(null);
    } catch (e) { onShowToast("فشل تنفيذ المرتجع", "error"); } finally { setIsSubmitting(false); }
  };

  const handleDeletePurchase = (p: PurchaseRecord) => {
    if (!onDeletePurchase) return;
    askConfirmation(
      "حذف فاتورة توريد",
      `هل تود حذف الفاتورة #${p.id.slice(-6)}؟ سيتم أرشفتها من سجلات المورد وتعديل الأرصدة.`,
      async () => {
        try {
          setIsSubmitting(true);
          await onDeletePurchase(p.id, "إلغاء يدوي من ملف المورد", user);
          onShowToast("تم حذف الفاتورة بنجاح", "success");
        } catch (e) { onShowToast("فشل الحذف", "error"); } finally { setIsSubmitting(false); }
      }
    );
  };

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
        } catch (e) { onShowToast("فشل تنفيذ التسوية", "error"); } finally { setIsSubmitting(false); }
      },
      'info'
    );
  };

  const getInvoiceBadge = (p: PurchaseRecord) => {
    if (Number(p.remainingAmount) <= 0.1) {
      if (p.paymentStatus === 'cash') return <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 text-[8px] font-black uppercase">كاش</span>;
      return <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black uppercase">خالصة</span>;
    }
    if (Number(p.paidAmount) > 0) return <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase">قيد السداد</span>;
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
    } catch (e: any) { onShowToast("فشل إضافة المورد", "error"); } finally { setIsSubmitting(false); }
  };

  if (viewMode === 'profile' && selectedSupplier) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
         <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="flex items-center gap-6">
               <button onClick={() => setViewMode('list')} className="p-4 bg-slate-100 rounded-2xl hover:bg-slate-900 group transition-all shadow-sm"><ArrowRight size={24} className="group-hover:text-white"/></button>
               <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-indigo-100">{(selectedSupplier.name || '?')[0]}</div>
               <div>
                  <h2 className="text-3xl font-black text-slate-800">{selectedSupplier.name}</h2>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg"><Phone size={14} className="text-indigo-500"/> {selectedSupplier.phone || 'بدون هاتف'}</p>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${liveStats.totalDebt > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{liveStats.totalDebt > 0 ? 'نشط - مدين' : 'خالص الذمة'}</span>
                  </div>
               </div>
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
               <button onClick={() => setIsPaymentModalOpen(true)} className="flex-1 lg:flex-none px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl text-[10px] flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-700 transition-all active:scale-95"><DollarSign size={18}/> سداد مديونية</button>
               <button onClick={() => askConfirmation("حذف المورد", "سيتم تجميد حساب المورد وأرشفة كافة بياناته.", () => onDeleteSupplier(selectedSupplier.id, "حذف يدوي", user))} className="p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
               <Landmark size={100} className="absolute -bottom-4 -left-4 text-white/10 rotate-12 transition-transform group-hover:scale-110"/>
               <p className="text-[10px] font-black opacity-60 uppercase mb-1">إجمالي المسحوبات (الصافي)</p>
               <h3 className="text-3xl font-black">{liveStats.totalSupplied.toLocaleString()} ج.م</h3>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي المدفوعات</p>
               <h3 className="text-3xl font-black text-emerald-600">{liveStats.totalPaid.toLocaleString()} ج.م</h3>
            </div>
            <div className={`p-8 rounded-[2.5rem] border shadow-sm text-center flex flex-col justify-center ${liveStats.totalDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
               <p className={`text-[10px] font-black uppercase mb-1 ${liveStats.totalDebt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>المديونية الحالية</p>
               <h3 className={`text-3xl font-black ${liveStats.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{liveStats.totalDebt.toLocaleString()} ج.م</h3>
            </div>
         </div>

         <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
            <div className="p-8 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto scrollbar-hide">
                  <button onClick={()=>setProfileTab('purchases')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'purchases' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><ShoppingBag size={14}/> سجل التوريد</button>
                  <button onClick={()=>setProfileTab('payments')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'payments' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><DollarSign size={14}/> سجل المدفوعات</button>
                  <button onClick={()=>setProfileTab('returns')} className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${profileTab === 'returns' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><RotateCcw size={14}/> المرتجعات</button>
               </div>
               {profileTab === 'purchases' && (
                 <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-inner overflow-x-auto scrollbar-hide">
                    {[
                        {id: 'all', label: 'الكل'}, 
                        {id: 'cash', label: 'كاش'}, 
                        {id: 'debt', label: 'آجلة'}, 
                        {id: 'paying', label: 'قيد السداد'}, 
                        {id: 'settled', label: 'مسددة'}
                    ].map(f => (
                      <button key={f.id} onClick={()=>setInvoiceFilter(f.id as any)} className={`px-4 py-2 rounded-lg text-[8px] font-black transition-all whitespace-nowrap ${invoiceFilter === f.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>{f.label}</button>
                    ))}
                 </div>
               )}
            </div>

            <div className="overflow-x-auto">
               {profileTab === 'purchases' && (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                      <tr><th className="px-8 py-6">رقم السند</th><th className="px-8 py-6 text-center">الحالة</th><th className="px-8 py-6 text-center">إجمالي القيمة</th><th className="px-8 py-6 text-center text-rose-600">المتبقي</th><th className="px-8 py-6 text-left">إدارة</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {supplierPurchases.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-5"><p className="text-indigo-600 font-mono font-black">#{p.id.slice(-6)}</p><p className="text-[8px] text-slate-300 uppercase mt-0.5">{p.date}</p></td>
                            <td className="px-8 py-5 text-center">{getInvoiceBadge(p)}</td>
                            <td className="px-8 py-5 text-center font-black">{p.totalAmount.toLocaleString()}</td>
                            <td className={`px-8 py-5 text-center ${Number(p.remainingAmount) > 0.1 ? 'text-rose-600' : 'text-slate-300'}`}>{Number(p.remainingAmount).toLocaleString()}</td>
                            <td className="px-8 py-5 text-left">
                               <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                   <button onClick={()=>setDetailedPurchase(p)} className="p-2 bg-white border border-slate-200 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-600 hover:text-white transition-all" title="معاينة"><Eye size={14}/></button>
                                   {canManageSuppliers && (
                                       <>
                                          <button onClick={()=>handleStartReturn(p)} className="p-2 bg-white border border-slate-200 text-rose-600 rounded-lg shadow-sm hover:bg-rose-600 hover:text-white transition-all" title="مرتجع"><RotateCcw size={14}/></button>
                                          <button onClick={()=>handleDeletePurchase(p)} className="p-2 bg-white border border-slate-200 text-slate-400 rounded-lg shadow-sm hover:bg-rose-600 hover:text-white transition-all" title="حذف"><Trash2 size={14}/></button>
                                       </>
                                   )}
                               </div>
                            </td>
                          </tr>
                      ))}
                      {supplierPurchases.length === 0 && (
                          <tr><td colSpan={5} className="py-20 text-center text-slate-300 italic">لا توجد فواتير تطابق التصفية المختارة</td></tr>
                      )}
                    </tbody>
                  </table>
               )}
               {profileTab === 'payments' && (
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] border-b">
                      <tr><th className="px-8 py-6">معرف العملية</th><th className="px-8 py-6">التاريخ والوقت</th><th className="px-8 py-6 text-center">المبلغ المسدد</th><th className="px-8 py-6 text-left">المرجع</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                      {supplierPaymentsMap.map(pay => (
                          <tr key={pay.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 font-mono text-slate-400 text-[10px]">#{pay.id.slice(0, 8)}</td>
                            <td className="px-8 py-5">{pay.date} <span className="text-[9px] opacity-40 mr-1">{pay.time}</span></td>
                            <td className="px-8 py-5 text-center text-emerald-600 font-black text-sm">{pay.amount.toLocaleString()} ج.م</td>
                            <td className="px-8 py-5 text-left text-indigo-400 font-mono text-[10px]">{pay.purchaseId ? `#${pay.purchaseId.slice(-6)}` : 'دفعة حساب عامة'}</td>
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
                      {supplierReturnsMap.map(ret => (
                          <tr key={ret.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 text-rose-600 font-mono font-black">#{ret.id.slice(-6)}</td>
                            <td className="px-8 py-5">{ret.date}</td>
                            <td className="px-8 py-5 text-center text-rose-600 font-black">{ret.totalRefund.toLocaleString()} ج.م</td>
                            <td className="px-8 py-5 text-center">
                               <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${ret.refundMethod === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>{ret.refundMethod === 'cash' ? 'نقدي' : 'خصم مديونية'}</span>
                            </td>
                            <td className="px-8 py-5 text-left text-[9px] text-slate-400 max-w-xs truncate">{ret.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}</td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
               )}
            </div>
         </div>

         {/* Detailed Purchase Items Modal */}
         {detailedPurchase && (
           <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[6000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="p-3 bg-white/10 rounded-2xl"><ListOrdered size={24} className="text-indigo-400"/></div>
                       <div><h3 className="font-black text-sm">تفاصيل فاتورة التوريد</h3><p className="text-[10px] opacity-60 font-mono tracking-widest uppercase">#{detailedPurchase.id.slice(-8)}</p></div>
                    </div>
                    <button onClick={()=>setDetailedPurchase(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24}/></button>
                 </div>
                 
                 <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-4 border-b bg-slate-50">
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">إجمالي الفاتورة</p><p className="text-lg font-black text-slate-800">{(detailedPurchase.totalAmount || 0).toLocaleString()} ج.م</p></div>
                    <div className="p-4 bg-white rounded-2xl border border-emerald-100 text-center"><p className="text-[9px] font-black text-emerald-500 uppercase mb-1">المبلغ المسدد</p><p className="text-lg font-black text-emerald-600">{(detailedPurchase.paidAmount || 0).toLocaleString()} ج.م</p></div>
                    <div className={`p-4 bg-white rounded-2xl border text-center ${Number(detailedPurchase.remainingAmount) > 0.1 ? 'border-rose-100' : 'border-slate-100'}`}><p className={`text-[9px] font-black uppercase mb-1 ${Number(detailedPurchase.remainingAmount) > 0.1 ? 'text-rose-500' : 'text-slate-400'}`}>المبلغ المتبقي</p><p className={`text-lg font-black ${Number(detailedPurchase.remainingAmount) > 0.1 ? 'text-rose-600' : 'text-slate-400'}`}>{(detailedPurchase.remainingAmount || 0).toLocaleString()} ج.م</p></div>
                 </div>

                 <div className="p-8 max-h-[40vh] overflow-y-auto scrollbar-hide">
                    <table className="w-full text-right text-xs">
                       <thead className="text-slate-400 font-black uppercase text-[9px] border-b pb-4">
                          <tr><th className="px-4">الصنف</th><th className="px-4 text-center">الكمية</th><th className="px-4 text-center">سعر التكلفة</th><th className="px-4 text-left">الإجمالي</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 font-bold">
                          {detailedPurchase.items.map((it, idx) => (
                             <tr key={idx} className="hover:bg-slate-50"><td className="px-4 py-4 flex items-center gap-3"><div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-indigo-400"><Package size={14}/></div>{it.name}</td><td className="px-4 text-center">{it.quantity}</td><td className="px-4 text-center text-slate-400">{(it.costPrice || 0).toLocaleString()}</td><td className="px-4 text-left text-indigo-600 font-black">{(it.subtotal || 0).toLocaleString()}</td></tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 
                 <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-3">
                        {canManageSuppliers && <button onClick={()=>handleStartReturn(detailedPurchase)} className="px-8 py-3 bg-rose-600 text-white font-black rounded-xl text-xs shadow-lg hover:bg-rose-700 transition-all flex items-center gap-2"><RotateCcw size={16}/> تنفيذ مرتجع</button>}
                        {Number(detailedPurchase.remainingAmount) > 0.1 && <button onClick={() => { handleQuickSettle(detailedPurchase); setDetailedPurchase(null); }} className="px-8 py-3 bg-emerald-600 text-white font-black rounded-xl text-xs shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-all"><DollarSign size={16}/> تسوية المتبقي</button>}
                    </div>
                    <button onClick={()=>setDetailedPurchase(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-xl text-xs hover:bg-slate-100 transition-all">إغلاق</button>
                 </div>
              </div>
           </div>
         )}

         {/* Return Items Modal */}
         {isReturnModalOpen && returningPurchase && (
           <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[7000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
                    <h3 className="font-black text-sm flex items-center gap-2"><RotateCcw size={18}/> تنفيذ مرتجع مشتريات للمورد</h3>
                    <button onClick={() => setIsReturnModalOpen(false)}><X size={24}/></button>
                 </div>
                 <div className="p-8 space-y-6 text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">حدد الكميات المراد إرجاعها من الفاتورة #{returningPurchase.id.slice(-6)}</p>
                    <div className="max-h-[35vh] overflow-y-auto border rounded-2xl scrollbar-hide">
                       <table className="w-full text-right text-xs font-bold">
                          <thead className="bg-slate-50 text-[9px] uppercase text-slate-400 border-b">
                             <tr><th className="p-4">الصنف</th><th className="p-4 text-center">الكمية</th><th className="p-4 text-center">المرتجع</th><th className="p-4 text-left">قيمة الرد</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                             {returningPurchase.items.map(it => (
                               <tr key={it.productId} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4">{it.name}</td>
                                  <td className="p-4 text-center text-slate-400">{it.quantity}</td>
                                  <td className="p-4"><input type="number" min="0" max={it.quantity} className="w-16 p-2 bg-slate-100 border-none rounded-lg text-center font-black" value={returnQtys[it.productId] || 0} onChange={e => setReturnQtys({...returnQtys, [it.productId]: Math.min(it.quantity, Math.max(0, Number(e.target.value)))})} /></td>
                                  <td className="p-4 text-left text-rose-600">{((returnQtys[it.productId] || 0) * it.costPrice).toLocaleString()}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase">طريقة استرداد القيمة</label>
                          <div className="flex gap-3">
                             <button onClick={()=>setRefundMethod('debt_deduction')} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${refundMethod === 'debt_deduction' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-transparent text-slate-400'}`}>خصم مديونية</button>
                             <button onClick={()=>setRefundMethod('cash')} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${refundMethod === 'cash' ? 'bg-emerald-50 border-emerald-600 text-emerald-600' : 'bg-white border-transparent text-slate-400'}`}>استرداد نقدي</button>
                          </div>
                       </div>
                       <div className="text-left flex flex-col justify-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي مبلغ المرتجع</p>
                          <h4 className="text-2xl font-black text-rose-600">{returningPurchase.items.reduce((a,b)=>a + ((returnQtys[b.productId]||0)*b.costPrice), 0).toLocaleString()} <span className="text-sm">ج.م</span></h4>
                       </div>
                    </div>

                    <button onClick={handleFinalizeReturn} disabled={isSubmitting} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3">
                       {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20}/>} اعتماد سند المرتجع
                    </button>
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
                         const p = supplierPurchases.find(x=>x.id === val);
                         setPaymentForm({...paymentForm, purchaseId: val || null, amount: p ? Number(p.remainingAmount) : 0});
                       }}>
                          <option value="">دفع لحساب المورد العام</option>
                          {supplierPurchases.filter(p=>Number(p.remainingAmount)>0.1).map(p => <option key={p.id} value={p.id}>سند #{p.id.slice(-6)} - متبقي {Number(p.remainingAmount).toLocaleString()} ج.م</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المراد دفعه</label><input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-emerald-600 rounded-2xl font-black text-xl outline-none" value={paymentForm.amount || ''} onChange={e=>setPaymentForm({...paymentForm, amount: Number(e.target.value)})} /></div>
                       <div className="p-4 bg-rose-50 rounded-2xl flex flex-col justify-center"><p className="text-[10px] font-black text-rose-400">إجمالي المديونية</p><p className="text-xl font-black text-rose-700">{liveStats.totalDebt.toLocaleString()}</p></div>
                    </div>
                    <textarea className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-xs h-20 resize-none" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="ملاحظات العملية..." />
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
         {filteredSuppliers.map(s => {
               const supplierDebt = purchases.filter(p => p.supplierId === s.id && !p.isDeleted).reduce((acc, p) => acc + Math.max(0, Number(p.totalAmount) - Number(p.paidAmount)), 0);
               return (
                 <div key={s.id} onClick={() => {setSelectedSupplierId(s.id); setViewMode('profile'); setProfileTab('purchases');}} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:border-indigo-600 transition-all group cursor-pointer relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                       <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">{(s.name || '?')[0]}</div>
                       <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${supplierDebt > 0.1 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{supplierDebt > 0.1 ? 'مدين' : 'خالص'}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-1">{s.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6"><Phone size={12} className="inline ml-1"/> {s.phone || '---'}</p>
                    <div className="grid grid-cols-2 gap-2 pt-6 border-t border-slate-50">
                       <div><p className="text-[8px] font-black text-slate-400 uppercase">الصافي المورد</p><p className="text-sm font-black text-slate-700">{(Number(s.totalSupplied)).toLocaleString()}</p></div>
                       <div className="text-left"><p className="text-[8px] font-black text-slate-400 uppercase">المديونية</p><p className={`text-sm font-black ${supplierDebt > 0.1 ? 'text-rose-600' : 'text-emerald-600'}`}>{supplierDebt.toLocaleString()}</p></div>
                    </div>
                 </div>
               );
         })}
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