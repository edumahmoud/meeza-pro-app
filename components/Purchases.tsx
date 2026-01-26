import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, Truck, Plus, Trash2, Save, X, UserPlus, 
  ArrowRight, Landmark, Banknote, History, ChevronRight, 
  ChevronLeft, FileText, Smartphone, TrendingDown, Receipt, 
  ArrowUpDown, DownloadCloud, FileSpreadsheet, PackagePlus, Calculator, CreditCard,
  Users, Hash, ShieldCheck, ClipboardList, Building2, AlertCircle, AlertTriangle, RefreshCw, CheckCircle2,
  Box, Barcode, Wallet, ArrowUpRight, ArrowDownLeft, Filter, Calendar, Edit3, EyeOff, RotateCcw, Package, Eraser, Layers, DollarSign, Check, Eye, PlusCircle, Minus, ShoppingCart
} from 'lucide-react';
import { Product, PurchaseRecord, PurchaseItem, Supplier, User as UserType, SupplierPayment, Branch, PurchaseReturnRecord } from '../types';
import * as XLSX from 'xlsx';
import { copyToClipboard } from './Layout';

interface PurchasesProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  purchaseReturns: PurchaseReturnRecord[];
  branches?: Branch[];
  onAddSupplier: (name: string, phone?: string, tax?: string, comm?: string) => Promise<any>;
  onDeleteSupplier: (id: string, reason: string, user: UserType) => Promise<void>;
  onAddPurchase: (record: PurchaseRecord) => Promise<void>;
  onAddProduct: (n: string, d: string, w: number, r: number, s: number, user: UserType) => Promise<any>;
  onAddSupplierPayment: (sId: string, amt: number, pId: string | null, notes: string, user: UserType) => Promise<void>;
  onAddPurchaseReturn: (record: PurchaseReturnRecord, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
}

const Purchases: React.FC<PurchasesProps> = ({ 
  products, suppliers = [], purchases = [], payments = [], purchaseReturns = [], branches = [],
  onAddSupplier, onDeleteSupplier, onAddPurchase, onAddProduct, onAddSupplierPayment, onAddPurchaseReturn, onShowToast, askConfirmation, user
}) => {
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers' | 'payments' | 'returns'>('purchases');
  const [viewMode, setViewMode] = useState<'list' | 'add_purchase' | 'add_supplier' | 'process_return'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Purchase Form State
  const [purchaseForm, setPurchaseForm] = useState<{
    supplierId: string;
    supplierInvoiceNo: string;
    items: PurchaseItem[];
    paidAmount: number;
    paymentStatus: 'cash' | 'credit';
    notes: string;
  }>({
    supplierId: '',
    supplierInvoiceNo: '',
    items: [],
    paidAmount: 0,
    paymentStatus: 'cash',
    notes: ''
  });

  const [itemSearch, setItemSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Supplier Profile State
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<Supplier | null>(null);

  // Return Process State
  const [returnInvoiceId, setReturnInvoiceId] = useState('');
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState<PurchaseRecord | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnMethod, setReturnMethod] = useState<'cash' | 'debt_deduction'>('debt_deduction');

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ supplierId: '', amount: 0, notes: '', purchaseId: '' });

  // Fix: Added missing state for adding a new supplier
  const [newSup, setNewSup] = useState({ name: '', phone: '' });

  // Calculations
  const purchaseTotal = useMemo(() => purchaseForm.items.reduce((acc, item) => acc + item.subtotal, 0), [purchaseForm.items]);
  const purchaseRemaining = useMemo(() => Math.max(0, purchaseTotal - purchaseForm.paidAmount), [purchaseTotal, purchaseForm.paidAmount]);

  const filteredSuppliers = useMemo(() => 
    (suppliers || []).filter(s => !s.isDeleted && (s.name.includes(searchTerm) || s.phone?.includes(searchTerm))), 
    [suppliers, searchTerm]
  );

  const filteredPurchases = useMemo(() => 
    (purchases || []).filter(p => !p.isDeleted && (p.supplierName.includes(searchTerm) || p.id.includes(searchTerm))), 
    [purchases, searchTerm]
  );

  const stats = useMemo(() => {
    const totalDebt = (suppliers || []).reduce((a, b) => a + (b.totalDebt || 0), 0);
    const totalSupplied = (suppliers || []).reduce((a, b) => a + (b.totalSupplied || 0), 0);
    return { totalDebt, totalSupplied };
  }, [suppliers]);

  // Handlers for Add Purchase
  const addProductToPurchase = (p: Product) => {
    if (purchaseForm.items.some(item => item.productId === p.id)) {
      return onShowToast("الصنف مضاف بالفعل", "error");
    }
    const newItem: PurchaseItem = {
      productId: p.id,
      name: p.name,
      quantity: 1,
      costPrice: p.wholesalePrice,
      retailPrice: p.retailPrice,
      subtotal: p.wholesalePrice
    };
    setPurchaseForm(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setItemSearch('');
    setShowProductDropdown(false);
  };

  const updatePurchaseItem = (index: number, updates: Partial<PurchaseItem>) => {
    const newItems = [...purchaseForm.items];
    newItems[index] = { ...newItems[index], ...updates };
    if (updates.quantity !== undefined || updates.costPrice !== undefined) {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].costPrice;
    }
    setPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleFinalizePurchase = async () => {
    if (!purchaseForm.supplierId || purchaseForm.items.length === 0 || isSubmitting) {
      return onShowToast("يرجى اختيار مورد وإضافة أصناف", "error");
    }

    setIsSubmitting(true);
    try {
      const supplier = suppliers.find(s => s.id === purchaseForm.supplierId);
      const record: PurchaseRecord = {
        id: crypto.randomUUID(),
        supplierId: purchaseForm.supplierId,
        supplierName: supplier?.name || '---',
        supplierInvoiceNo: purchaseForm.supplierInvoiceNo,
        items: purchaseForm.items,
        totalAmount: purchaseTotal,
        paidAmount: purchaseForm.paidAmount,
        remainingAmount: purchaseRemaining,
        paymentStatus: purchaseForm.paymentStatus,
        date: new Date().toLocaleDateString('ar-EG'),
        time: new Date().toLocaleTimeString('ar-EG'),
        timestamp: Date.now(),
        createdBy: user.id,
        branchId: user.branchId
      };

      await onAddPurchase(record);
      onShowToast("تم تسجيل فاتورة التوريد وتحديث المخزن بنجاح", "success");
      setViewMode('list');
      setPurchaseForm({ supplierId: '', supplierInvoiceNo: '', items: [], paidAmount: 0, paymentStatus: 'cash', notes: '' });
    } catch (e) {
      onShowToast("فشل تسجيل عملية التوريد", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchPurchaseForReturn = () => {
    const p = purchases.find(pur => pur.id === returnInvoiceId || pur.id.slice(-6) === returnInvoiceId);
    if (p) {
      setSelectedPurchaseForReturn(p);
      const qtys: Record<string, number> = {};
      p.items.forEach(it => qtys[it.productId] = 0);
      setReturnQuantities(qtys);
    } else {
      onShowToast("لم يتم العثور على فاتورة التوريد", "error");
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.supplierId || paymentForm.amount <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddSupplierPayment(paymentForm.supplierId, paymentForm.amount, paymentForm.purchaseId || null, paymentForm.notes, user);
      onShowToast("تم تسجيل الدفعة بنجاح", "success");
      setIsPaymentModalOpen(false);
      setPaymentForm({ supplierId: '', amount: 0, notes: '', purchaseId: '' });
    } catch (e: any) {
      onShowToast(e.message || "فشل تسجيل الدفعة", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (viewMode === 'add_purchase') {
      return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 select-text pb-12">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={() => setViewMode('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><ArrowRight size={24}/></button>
                <div>
                   <h3 className="text-2xl font-black text-slate-800">إنشاء فاتورة توريد جديدة</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase">إدخال بضاعة للمخزن وتحديث الحسابات</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                   <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase mr-1">المورد المستهدف</label>
                         <select className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={purchaseForm.supplierId} onChange={e=>setPurchaseForm({...purchaseForm, supplierId: e.target.value})}>
                            <option value="">-- اختر المورد من القائمة --</option>
                            {suppliers.filter(s=>!s.isDeleted).map(s => <option key={s.id} value={s.id}>{s.name} (مديونية: {s.totalDebt})</option>)}
                         </select>
                      </div>
                      <div className="flex-1 space-y-1.5">
                         <label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم فاتورة المورد</label>
                         <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm outline-none" value={purchaseForm.supplierInvoiceNo} onChange={e=>setPurchaseForm({...purchaseForm, supplierInvoiceNo: e.target.value})} placeholder="اختياري..." />
                      </div>
                   </div>

                   <div className="relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase mr-1 mb-2 block">إضافة أصناف للفاتورة</label>
                      <div className="relative">
                         <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                         <input 
                           type="text" 
                           placeholder="ابحث عن صنف بالاسم أو الباركود..." 
                           className="w-full pr-12 pl-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                           value={itemSearch}
                           onChange={e => {setItemSearch(e.target.value); setShowProductDropdown(true);}}
                           onFocus={() => setShowProductDropdown(true)}
                         />
                      </div>
                      {showProductDropdown && itemSearch && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 max-h-60 overflow-y-auto divide-y">
                           {products.filter(p => !p.isDeleted && (p.name.includes(itemSearch) || p.code.includes(itemSearch))).map(p => (
                             <div key={p.id} onClick={() => addProductToPurchase(p)} className="p-4 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors">
                                <div><p className="font-black text-xs">{p.name}</p><p className="text-[9px] text-slate-400 font-mono">#{p.code}</p></div>
                                <p className="text-[10px] font-black text-indigo-600">{p.wholesalePrice} ج.م</p>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>

                   <div className="overflow-hidden border rounded-3xl">
                      <table className="w-full text-right text-xs">
                         <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px]">
                            <tr><th className="px-6 py-4">الصنف</th><th className="px-6 py-4 text-center">الكمية</th><th className="px-6 py-4 text-center">سعر الشراء</th><th className="px-6 py-4 text-center">سعر البيع</th><th className="px-6 py-4 text-left">الإجمالي</th></tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 font-bold">
                            {purchaseForm.items.map((it, idx) => (
                               <tr key={it.productId} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-4">{it.name}</td>
                                  <td className="px-6 py-4">
                                     <input type="number" className="w-16 p-2 bg-white border rounded-lg text-center" value={it.quantity} onChange={e=>updatePurchaseItem(idx, {quantity: Number(e.target.value)})} />
                                  </td>
                                  <td className="px-6 py-4">
                                     <input type="number" className="w-20 p-2 bg-white border rounded-lg text-center" value={it.costPrice} onChange={e=>updatePurchaseItem(idx, {costPrice: Number(e.target.value)})} />
                                  </td>
                                  <td className="px-6 py-4">
                                     <input type="number" className="w-20 p-2 bg-white border rounded-lg text-center" value={it.retailPrice} onChange={e=>updatePurchaseItem(idx, {retailPrice: Number(e.target.value)})} />
                                  </td>
                                  <td className="px-6 py-4 text-left text-indigo-600">{it.subtotal.toLocaleString()}</td>
                               </tr>
                            ))}
                            {purchaseForm.items.length === 0 && (
                               <tr><td colSpan={5} className="py-12 text-center text-slate-300 italic">قم بإضافة أصناف لبدء الفاتورة</td></tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                   <h4 className="font-black text-sm border-b pb-4">ملخص العملية المالية</h4>
                   <div className="space-y-4">
                      <div className="flex justify-between text-slate-400 font-bold text-xs"><span>إجمالي البضاعة:</span><span>{purchaseTotal.toLocaleString()} ج.م</span></div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المدفوع حالياً</label>
                         <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xl text-center outline-none focus:ring-4 focus:ring-emerald-500/5" value={purchaseForm.paidAmount || ''} onChange={e=>setPurchaseForm({...purchaseForm, paidAmount: Number(e.target.value)})} />
                      </div>
                      <div className="pt-4 border-t border-dashed space-y-2">
                         <div className="flex justify-between font-black text-rose-600"><span>المتبقي (مديونية):</span><span>{purchaseRemaining.toLocaleString()} ج.م</span></div>
                         <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={()=>setPurchaseForm({...purchaseForm, paymentStatus:'cash'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${purchaseForm.paymentStatus==='cash' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>كاش / مسددة</button>
                            <button onClick={()=>setPurchaseForm({...purchaseForm, paymentStatus:'credit'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${purchaseForm.paymentStatus==='credit' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500'}`}>آجل / مديونية</button>
                         </div>
                      </div>
                      <button 
                        onClick={handleFinalizePurchase}
                        disabled={isSubmitting}
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                         {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} اعتماد الفاتورة وتحديث المخزن
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      );
    }

    if (selectedSupplierProfile) {
      const s = selectedSupplierProfile;
      const supPurchases = purchases.filter(p => p.supplierId === s.id && !p.isDeleted);
      const supPayments = payments.filter(p => p.supplierId === s.id);
      
      const unpaidInvoices = supPurchases.filter(p => p.remainingAmount > 0);

      return (
        <div className="space-y-8 animate-in slide-in-from-right-4 select-text pb-12">
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button onClick={() => setSelectedSupplierProfile(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"><ArrowRight size={24}/></button>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{s.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">كشف الحساب المالي للمورد</p>
                </div>
             </div>
             <div className="flex gap-3">
                <button onClick={() => { setPaymentForm({...paymentForm, supplierId: s.id}); setIsPaymentModalOpen(true); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><DollarSign size={16}/> سداد مديونية</button>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-40">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Truck size={24}/></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي التوريدات</p><h4 className="text-xl font-black">{s.totalSupplied.toLocaleString()} ج.م</h4></div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-40">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><Check size={24}/></div>
                <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي المدفوع</p><h4 className="text-xl font-black text-emerald-600">{s.totalPaid.toLocaleString()} ج.م</h4></div>
             </div>
             <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between h-40 shadow-xl relative overflow-hidden group">
                <Landmark size={100} className="absolute -bottom-4 -left-4 text-white/5 rotate-12 transition-transform group-hover:scale-110"/>
                <div className="relative z-10 w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center"><Wallet size={24}/></div>
                <div className="relative z-10">
                   <p className="text-[10px] font-black text-slate-500 uppercase mb-1">المديونية الحالية</p>
                   <h4 className="text-2xl font-black text-rose-400">{s.totalDebt.toLocaleString()} <span className="text-xs opacity-50">ج.م</span></h4>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-6 bg-slate-50/50 border-b flex justify-between items-center"><h4 className="font-black text-sm text-slate-800 flex items-center gap-2"><History size={18} className="text-indigo-600"/> كشف حساب المعاملات</h4></div>
                <table className="w-full text-right text-[11px] font-bold">
                   <thead className="bg-slate-50 text-slate-400 border-b">
                      <tr><th className="px-8 py-5">النوع</th><th className="px-8 py-5">البيان</th><th className="px-8 py-5 text-center">التاريخ</th><th className="px-8 py-5 text-left">القيمة</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {[...supPurchases.map(p=>({...p, type:'purch'})), ...supPayments.map(p=>({...p, type:'pay'}))]
                       .sort((a:any, b:any)=>b.timestamp - a.timestamp)
                       .map((item:any, idx) => (
                         <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${item.type === 'purch' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>{item.type === 'purch' ? 'توريد' : 'سداد'}</span></td>
                            <td className="px-8 py-4 text-slate-700">{item.type === 'purch' ? `فاتورة توريد #${item.id.slice(-6)}` : (item.notes || 'سداد مديونية')}</td>
                            <td className="px-8 py-4 text-center text-slate-400 font-mono">{item.date}</td>
                            <td className={`px-8 py-4 text-left font-black ${item.type === 'pay' ? 'text-emerald-600' : 'text-slate-800'}`}>{item.totalAmount || item.amount} ج.م</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                <h4 className="font-black text-sm flex items-center gap-2 border-b pb-4"><Receipt size={20} className="text-rose-600"/> فواتير غير مسددة بالكامل</h4>
                <div className="space-y-3 overflow-y-auto max-h-[400px] scrollbar-hide">
                   {unpaidInvoices.map(p => (
                      <div key={p.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-600 transition-all cursor-pointer group" onClick={() => { setPaymentForm({ supplierId: s.id, amount: p.remainingAmount, notes: `سداد فاتورة #${p.id.slice(-6)}`, purchaseId: p.id }); setIsPaymentModalOpen(true); }}>
                         <div className="flex justify-between items-center mb-2"><span className="text-xs font-black text-indigo-600">#{p.id.slice(-6)}</span><span className="text-[9px] text-slate-400 font-bold">{p.date}</span></div>
                         <div className="flex justify-between items-end"><p className="text-[10px] text-slate-500">المتبقي للدفع:</p><p className="text-sm font-black text-rose-600">{p.remainingAmount.toLocaleString()} ج.م</p></div>
                         <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-all"><span className="px-3 py-1 bg-indigo-600 text-white text-[8px] font-black rounded-lg">سداد الآن</span></div>
                      </div>
                   ))}
                   {unpaidInvoices.length === 0 && <div className="py-20 text-center text-slate-300 italic">كل الفواتير مسددة تماماً</div>}
                </div>
             </div>
          </div>
        </div>
      );
    }

    if (viewMode === 'add_supplier') {
      return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-bottom-4">
           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8">
              <div className="flex items-center justify-between border-b pb-6">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24}/></div>
                    <h3 className="text-2xl font-black text-slate-800">تسجيل مورد جديد</h3>
                 </div>
                 {/* Fix: Added missing state reset on cancel */}
                 <button onClick={() => { setViewMode('list'); setNewSup({ name: '', phone: '' }); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24}/></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم الشركة / المورد</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newSup.name} onChange={e=>setNewSup({...newSup, name: e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase mr-1">رقم التواصل</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={newSup.phone} onChange={e=>setNewSup({...newSup, phone: e.target.value})} /></div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-4">
                 {/* Fix: Added missing state reset on cancel */}
                 <button onClick={() => { setViewMode('list'); setNewSup({ name: '', phone: '' }); }} className="px-8 py-4 bg-white border border-slate-200 text-slate-500 font-black rounded-2xl text-xs">إلغاء</button>
                 {/* Fix: Added missing state reset after successful addition */}
                 <button onClick={async () => { if(!newSup.name) return; await onAddSupplier(newSup.name, newSup.phone); setViewMode('list'); setNewSup({ name: '', phone: '' }); }} className="px-12 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl flex items-center gap-3">اعتماد المورد</button>
              </div>
           </div>
        </div>
      );
    }

    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
            <button onClick={() => setActiveTab('purchases')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'purchases' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Truck size={14}/> المشتريات</button>
            <button onClick={() => setActiveTab('suppliers')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Users size={14}/> الموردين</button>
          </div>
          <div className="flex gap-3 shrink-0">
             {activeTab === 'purchases' && <button onClick={() => setViewMode('add_purchase')} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-black transition-all"><Plus size={16}/> فاتورة توريد</button>}
             {activeTab === 'suppliers' && <button onClick={() => setViewMode('add_supplier')} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"><UserPlus size={16}/> إضافة مورد</button>}
          </div>
        </div>

        {activeTab === 'suppliers' && (
           <div className="space-y-8 animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="p-5 bg-indigo-50 text-indigo-600 rounded-3xl"><Landmark size={32}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">إجمالي مديونية الموردين</p><h3 className="text-3xl font-black text-rose-600">{stats.totalDebt.toLocaleString()} ج.م</h3></div>
                 </div>
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
                    <div className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl"><Truck size={32}/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">إجمالي بضاعة موردة</p><h3 className="text-3xl font-black text-slate-800">{stats.totalSupplied.toLocaleString()} ج.م</h3></div>
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                 <div className="relative"><Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="بحث عن مورد..." className="w-full pr-14 pl-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm shadow-inner" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} /></div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                 <table className="w-full text-right text-[11px] font-bold">
                    <thead className="bg-slate-50 text-slate-400 border-b">
                       <tr><th className="px-8 py-5">المورد</th><th className="px-8 py-5">رقم الهاتف</th><th className="px-8 py-5 text-center">المديونية</th><th className="px-8 py-5 text-left">إدارة</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {filteredSuppliers.map(s => (
                         <tr key={s.id} className="hover:bg-slate-50 group transition-colors">
                            <td className="px-8 py-4 flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">{s.name[0]}</div><span>{s.name}</span></td>
                            <td className="px-8 py-4 text-slate-500 font-mono">{s.phone || '---'}</td>
                            <td className="px-8 py-4 text-center text-rose-600 font-black">{s.totalDebt.toLocaleString()} ج.م</td>
                            <td className="px-8 py-4 text-left"><div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => setSelectedSupplierProfile(s)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shadow-sm"><Eye size={14}/></button><button onClick={() => askConfirmation("حذف المورد", "سيتم حذف بيانات المورد نهائياً. لا يمكن الحذف في حال وجود مديونية.", () => onDeleteSupplier(s.id, "إداري", user))} className="p-2 bg-rose-50 text-rose-600 rounded-lg shadow-sm"><Trash2 size={14}/></button></div></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'purchases' && (
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
              <table className="w-full text-right text-[11px] font-bold">
                 <thead className="bg-slate-50 text-slate-400 border-b">
                    <tr><th className="px-8 py-5">رقم السند</th><th className="px-8 py-5">المورد</th><th className="px-8 py-5 text-center">الإجمالي</th><th className="px-8 py-5 text-center">المدفوع</th><th className="px-8 py-5 text-center">المتبقي</th><th className="px-8 py-5 text-left">التاريخ</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                         <td className="px-8 py-4 text-indigo-600 font-mono">#{p.id.slice(-6)}</td>
                         <td className="px-8 py-4">{p.supplierName}</td>
                         <td className="px-8 py-4 text-center font-black">{p.totalAmount.toLocaleString()}</td>
                         <td className="px-8 py-4 text-center text-emerald-600">{p.paidAmount.toLocaleString()}</td>
                         <td className="px-8 py-4 text-center text-rose-600">{p.remainingAmount.toLocaleString()}</td>
                         <td className="px-8 py-4 text-left text-slate-400 font-mono text-[9px]">{p.date}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm">تسجيل سداد مديونية</h3>
                 <button onClick={() => setIsPaymentModalOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-10 space-y-6 text-right">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المراد سداده (ج.م)</label>
                    <input type="number" className="w-full p-5 bg-slate-50 border rounded-3xl font-black text-3xl text-center outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" value={paymentForm.amount || ''} onChange={e=>setPaymentForm({...paymentForm, amount: Number(e.target.value)})} placeholder="0.00" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase">ملاحظات إضافية</label>
                    <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xs" value={paymentForm.notes} onChange={e=>setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="مثال: سداد نقدي، تحويل بنكي..." />
                 </div>
                 {paymentForm.purchaseId && (
                   <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm"><Receipt size={18}/></div>
                      <div><p className="text-[9px] font-black text-indigo-400 uppercase">تخصيص السداد للفاتورة</p><p className="text-xs font-black text-indigo-900">#{paymentForm.purchaseId.slice(-6)}</p></div>
                   </div>
                 )}
                 <button onClick={handleAddPayment} disabled={isSubmitting || paymentForm.amount <= 0} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>} تأكيد السداد وخصم الخزينة
                 </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};

export default Purchases;