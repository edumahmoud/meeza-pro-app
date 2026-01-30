import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Truck, Plus, X, ArrowRight, RefreshCw, 
  CheckCircle2, PackagePlus, Eye, ReceiptText, Calendar, Hash, ShoppingBag, PlusCircle, Tag, Package, RotateCcw, Trash2, LayoutList, History, AlertTriangle, Box, Landmark, Star, FileText, UserCheck, Save, Sparkles, PackageSearch, Lock, ListOrdered, DollarSign
} from 'lucide-react';
import { Product, PurchaseRecord, PurchaseItem, Supplier, User as UserType, Branch, PurchaseReturnRecord } from '../types';

interface PurchasesProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  purchaseReturns?: PurchaseReturnRecord[];
  branches?: Branch[];
  onAddPurchase: (record: PurchaseRecord) => Promise<void>;
  onAddProduct: (name: string, desc: string, wholesale: number, retail: number, stock: number, user: UserType) => Promise<any>;
  onAddPurchaseReturn: (record: PurchaseReturnRecord, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
  canManageSuppliers?: boolean;
}

const Purchases = ({ 
  products, suppliers = [], purchases = [], purchaseReturns = [], branches = [],
  onAddPurchase, onAddProduct, onAddPurchaseReturn, onShowToast, askConfirmation, user, canManageSuppliers = true
}: PurchasesProps) => {
  const [activeTab, setActiveTab] = useState('list' as 'list' | 'add_purchase' | 'returns');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState({ name: '', wholesale: 0, retail: 0, quantity: 1 });
  const [newProductsInfo, setNewProductsInfo] = useState<Record<string, {name: string, wholesale: number, retail: number}>>({});

  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierName: '',
    supplierInvoiceNo: '',
    items: [] as PurchaseItem[],
    paidAmount: 0,
    notes: '',
    branchId: user.branchId || null
  });

  const [detailedPurchase, setDetailedPurchase] = useState(null as PurchaseRecord | null);

  // Return logic inside list
  const [returningPurchase, setReturningPurchase] = useState(null as PurchaseRecord | null);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'debt_deduction'>('debt_deduction');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [showItemResults, setShowItemResults] = useState(false);
  const [pendingItem, setPendingItem] = useState({
    product: null as Product | null,
    quantity: 1,
    costPrice: 0,
    retailPrice: 0
  });

  const [supSearch, setSupSearch] = useState('');
  const [showSupResults, setShowSupResults] = useState(false);
  const supRef = useRef<HTMLDivElement>(null);
  const itemSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supRef.current && !supRef.current.contains(e.target as Node)) setShowSupResults(false);
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) setShowItemResults(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (!supSearch.trim()) return suppliers.filter(s => !s.isDeleted).slice(0, 5);
    return suppliers.filter(s => !s.isDeleted && s.name.toLowerCase().includes(supSearch.toLowerCase())).slice(0, 10);
  }, [suppliers, supSearch]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return [];
    const term = itemSearch.toLowerCase();
    return products.filter(p => !p.isDeleted && (p.name.toLowerCase().includes(term) || p.code.includes(term))).slice(0, 7);
  }, [products, itemSearch]);

  const filteredPurchases = useMemo(() => {
    const list = purchases.filter(p => !p.isDeleted);
    if (!searchTerm) return list;
    return list.filter(p => p.supplierName.includes(searchTerm) || p.id.includes(searchTerm));
  }, [purchases, searchTerm]);

  const totalAmount = useMemo(() => purchaseForm.items.reduce((acc, it) => acc + it.subtotal, 0), [purchaseForm.items]);

  const handleStartReturn = (p: PurchaseRecord) => {
    setReturningPurchase(p);
    const initialQtys: Record<string, number> = {};
    p.items.forEach(it => initialQtys[it.productId] = 0);
    setReturnQtys(initialQtys);
    setIsReturnModalOpen(true);
  };

  const handleFinalizeReturn = async () => {
    if (!returningPurchase) return;
    const itemsToReturn = returningPurchase.items
      .filter(it => returnQtys[it.productId] > 0)
      .map(it => ({ ...it, quantity: returnQtys[it.productId], subtotal: returnQtys[it.productId] * it.costPrice }));

    if (itemsToReturn.length === 0) return onShowToast("حدد كمية صنف واحد على الأقل", "error");

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
    } catch (e) { onShowToast("فشل تنفيذ المرتجع", "error"); } finally { setIsSubmitting(false); }
  };

  const handleQuickAddProduct = () => {
    if (!quickProduct.name || !quickProduct.retail) return onShowToast("الاسم وسعر البيع مطلوبان", "error");
    const isDuplicate = products.find(p => !p.isDeleted && p.name.trim().toLowerCase() === quickProduct.name.trim().toLowerCase());
    if (isDuplicate) return onShowToast("هذا الصنف مسجل مسبقاً في المخزن", "error");
    const tempId = `temp-${Date.now()}`;
    setNewProductsInfo(prev => ({ ...prev, [tempId]: { name: quickProduct.name, wholesale: quickProduct.wholesale, retail: quickProduct.retail } }));
    setPurchaseForm(prev => ({ ...prev, items: [...prev.items, { productId: tempId, name: quickProduct.name, quantity: quickProduct.quantity, costPrice: quickProduct.wholesale, retailPrice: quickProduct.retail, subtotal: quickProduct.quantity * quickProduct.wholesale }] }));
    onShowToast("تمت إضافة الصنف للفاتورة مؤقتاً", "success");
    setIsQuickAddOpen(false);
    setQuickProduct({ name: '', wholesale: 0, retail: 0, quantity: 1 });
    setItemSearch('');
    setShowItemResults(false);
  };

  const addItemToPurchase = () => {
    if (!pendingItem.product) return;
    if (pendingItem.quantity <= 0) return onShowToast("خطأ: لا يمكن توريد كمية صفر", "error");
    setPurchaseForm(prev => ({ ...prev, items: [...prev.items, { productId: pendingItem.product!.id, name: pendingItem.product!.name, quantity: pendingItem.quantity, costPrice: pendingItem.costPrice, retailPrice: pendingItem.retailPrice, subtotal: pendingItem.quantity * pendingItem.costPrice }] }));
    setPendingItem({ product: null, quantity: 1, costPrice: 0, retailPrice: 0 });
    setItemSearch('');
  };

  const finalizePurchase = async () => {
    if (!purchaseForm.supplierId) return onShowToast("يجب اختيار المورد أولاً", "error");
    if (purchaseForm.items.length === 0) return onShowToast("الفاتورة فارغة", "error");
    
    setIsSubmitting(true);
    try {
      const processedItems = [];
      for (const item of purchaseForm.items) {
        let finalId = item.productId;
        if (finalId.startsWith('temp-')) {
          const info = newProductsInfo[finalId];
          const added = await onAddProduct(info.name, "مورد حديثاً عبر فاتورة توريد", info.wholesale, info.retail, 0, user);
          finalId = added.id;
        }
        processedItems.push({ ...item, productId: finalId });
      }
      
      const purchaseRecord: PurchaseRecord = { 
        id: crypto.randomUUID(), 
        supplierId: purchaseForm.supplierId, 
        supplierName: purchaseForm.supplierName, 
        supplierInvoiceNo: purchaseForm.supplierInvoiceNo || '', 
        items: processedItems, 
        totalAmount, 
        paidAmount: purchaseForm.paidAmount || 0, 
        remainingAmount: Math.max(0, totalAmount - (purchaseForm.paidAmount || 0)), 
        paymentStatus: (purchaseForm.paidAmount || 0) >= totalAmount ? 'cash' : 'credit', 
        date: new Date().toLocaleDateString('ar-EG'), 
        time: new Date().toLocaleTimeString('ar-EG'), 
        timestamp: Date.now(), 
        createdBy: user.id, 
        branchId: user.branchId || null, 
        notes: purchaseForm.notes || '' 
      };

      await onAddPurchase(purchaseRecord);
      
      onShowToast("تم اعتماد التوريد بنجاح وتحديث الأرصدة", "success");
      setActiveTab('list');
      setPurchaseForm({ supplierId: '', supplierName: '', supplierInvoiceNo: '', items: [], paidAmount: 0, notes: '', branchId: user.branchId || null });
      setNewProductsInfo({});
      setSupSearch('');
    } catch (e: any) { 
      // تعديل هام: إظهار الخطأ الحقيقي القادم من قاعدة البيانات لتبين سبب الفشل
      onShowToast(e.message || "فشل في حفظ الفاتورة - خطأ في البيانات", "error"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide shadow-inner">
          <button onClick={() => setActiveTab('list')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500'}`}><LayoutList size={14}/> السجل</button>
          <button onClick={() => setActiveTab('add_purchase')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'add_purchase' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><PlusCircle size={14}/> توريد جديد</button>
          <button onClick={() => setActiveTab('returns')} className={`flex-1 min-w-[120px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'returns' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-50'}`}><RotateCcw size={14}/> المرتجعات</button>
        </div>
        {activeTab === 'list' && (
          <div className="relative flex-1 w-full max-sm:max-w-none max-w-sm">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
            <input type="text" placeholder="ابحث برقم الفاتورة أو المورد..." className="w-full pr-10 pl-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none shadow-inner" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          </div>
        )}
      </div>

      {activeTab === 'add_purchase' ? (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-bottom-4">
           <div className="lg:col-span-3 space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-8">
                    <div className="relative" ref={supRef}>
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block mr-1">المورد المستهدف</label>
                       <div className="relative">
                          <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={18}/>
                          <input type="text" className={`w-full pr-12 pl-4 py-4 bg-slate-50 border-2 rounded-2xl font-black text-sm outline-none transition-all ${purchaseForm.supplierId ? 'border-indigo-600 bg-indigo-50' : 'border-transparent focus:bg-white'}`} placeholder="ابحث عن مورد..." value={purchaseForm.supplierId ? purchaseForm.supplierName : supSearch} onChange={(e) => {setSupSearch(e.target.value); setShowSupResults(true);}} onFocus={() => setShowSupResults(true)} />
                          {purchaseForm.supplierId && (
                            <button onClick={()=>{setPurchaseForm({...purchaseForm, supplierId:'', supplierName:''}); setSupSearch('');}} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500"><X size={18}/></button>
                          )}
                       </div>
                       {showSupResults && !purchaseForm.supplierId && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border z-[100] overflow-hidden divide-y divide-slate-100">
                            {filteredSuppliers.map(s => (
                              <button key={s.id} onClick={()=>{setPurchaseForm({...purchaseForm, supplierId:s.id, supplierName:s.name}); setShowSupResults(false);}} className="w-full p-4 text-right hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                                 <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">{s.name[0]}</div>
                                 <span className="font-black text-xs text-slate-700">{s.name}</span>
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block mr-1">رقم فاتورة المورد الورقية</label>
                       <div className="relative"><FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" className="w-full pr-12 pl-4 py-4 bg-slate-50 border-none rounded-2xl font-black text-sm outline-none shadow-inner" placeholder="رقم السند..." value={purchaseForm.supplierInvoiceNo} onChange={e=>setPurchaseForm({...purchaseForm, supplierInvoiceNo: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="relative" ref={itemSearchRef}>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block mr-1">إضافة الأصناف للمشتريات</label>
                    <div className="relative">
                       <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input type="text" placeholder="ابحث باسم المنتج أو الباركود..." className="w-full pr-12 pl-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl font-black text-sm outline-none transition-all shadow-inner" value={itemSearch} onChange={e=>{setItemSearch(e.target.value); setShowItemResults(true);}} onFocus={()=>setShowItemResults(true)}/>
                       {showItemResults && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border z-[100] overflow-hidden divide-y divide-slate-100">
                           {filteredItems.map(p => (
                             <button key={p.id} onClick={()=>{setPendingItem({...pendingItem, product:p, costPrice:p.wholesalePrice, retailPrice:p.retailPrice}); setShowItemResults(false); setItemSearch(p.name);}} className="w-full p-4 text-right hover:bg-indigo-50 flex justify-between items-center transition-colors group">
                                <div className="flex items-center gap-3"><div className="w-9 h-9 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white rounded-xl flex items-center justify-center transition-colors"><Package size={16}/></div><span className="font-black text-xs text-slate-700">{p.name}</span></div>
                                <div className="text-left"><span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">تكلفة: {p.wholesalePrice} ج.م</span></div>
                             </button>
                           ))}
                           <button onClick={()=>{setQuickProduct({...quickProduct, name: itemSearch}); setIsQuickAddOpen(true);}} className={`w-full p-5 text-right transition-all flex items-center gap-4 border-t-4 border-indigo-50 ${itemSearch.trim().length > 0 ? 'bg-indigo-600 text-white hover:bg-slate-900' : 'bg-slate-50 text-slate-300 pointer-events-none'}`}><div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ${itemSearch.trim().length > 0 ? 'bg-white/20' : 'bg-slate-200'}`}><PlusCircle size={24}/></div><div className="flex-1"><p className="font-black text-xs uppercase tracking-tight">صنف جديد غير مسجل؟</p><p className="text-[9px] font-bold opacity-70 leading-tight">تعريف وإضافته للمخزن والفاتورة</p></div></button>
                        </div>
                       )}
                    </div>
                    {pendingItem.product && (
                       <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 p-6 rounded-[2rem] shadow-2xl border border-white/5 animate-in zoom-in-95">
                          <div className="space-y-1"><label className="text-[9px] font-black text-indigo-300 uppercase mr-1">سعر التكلفة (الوحدة)</label><input type="number" className="w-full p-3.5 bg-white/10 text-white border border-white/10 rounded-xl font-black text-sm outline-none" value={pendingItem.costPrice || ''} onChange={e=>setPendingItem({...pendingItem, costPrice: Number(e.target.value)})} /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-indigo-300 uppercase mr-1">الكمية الموردة</label><input type="number" className="w-full p-3.5 bg-white text-slate-900 border-2 border-indigo-500 rounded-xl font-black text-sm outline-none" value={pendingItem.quantity || ''} onChange={e=>setPendingItem({...pendingItem, quantity: Number(e.target.value)})} autoFocus /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-emerald-400 uppercase mr-1">سعر البيع المقترح</label><input type="number" className="w-full p-3.5 bg-white/10 text-white border border-white/10 rounded-xl font-black text-sm outline-none" value={pendingItem.retailPrice || ''} onChange={e=>setPendingItem({...pendingItem, retailPrice: Number(e.target.value)})} /></div>
                          <button onClick={addItemToPurchase} className="mt-5 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-xl h-12 hover:bg-indigo-700 transition-all">تثبيت في الفاتورة</button>
                       </div>
                    )}
                 </div>
                 <div className="overflow-x-auto pt-4">
                    <table className="w-full text-right text-xs">
                       <thead className="text-slate-400 font-black border-b pb-2">
                          <tr><th className="px-4 py-2">الصنف</th><th className="px-4 py-2 text-center">الكمية</th><th className="px-4 py-2 text-center">سعر التكلفة</th><th className="px-4 py-2 text-left">الإجمالي</th><th className="px-4 py-2 text-left w-10"></th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 font-bold">
                          {purchaseForm.items.map((it, idx) => (
                             <tr key={idx} className="hover:bg-slate-50"><td className="px-4 py-4">{it.name}</td><td className="px-4 py-4 text-center">{it.quantity}</td><td className="px-4 py-4 text-center">{it.costPrice.toLocaleString()}</td><td className="px-4 py-4 text-left">{it.subtotal.toLocaleString()}</td><td className="px-4 py-4 text-left"><button onClick={() => setPurchaseForm({...purchaseForm, items: purchaseForm.items.filter((_, i) => i !== idx)})} className="text-rose-500 hover:scale-110 transition-transform"><Trash2 size={16}/></button></td></tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                 <div className="flex items-center gap-3 border-b pb-4"><ReceiptText className="text-indigo-600" size={20}/><h4 className="font-black text-sm text-slate-800">خلاصة السداد والذمم</h4></div>
                 <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold text-slate-400"><span>إجمالي قيمة التوريد</span><span>{totalAmount.toLocaleString()} ج.م</span></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">المبلغ المسدد نقداً</label><input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xl outline-none" value={purchaseForm.paidAmount || ''} onChange={e=>setPurchaseForm({...purchaseForm, paidAmount: Number(e.target.value)})} placeholder="200" /></div>
                    <div className="flex justify-between text-lg font-black text-rose-600 border-t pt-4"><span>المتبقي (ذمة آجل)</span><span>{(totalAmount - (purchaseForm.paidAmount || 0)).toLocaleString()} ج.م</span></div>
                 </div>
                 <button onClick={finalizePurchase} disabled={isSubmitting || purchaseForm.items.length === 0} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                    {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20}/>} اعتماد التوريد النهائي
                 </button>
              </div>
           </div>
        </div>
      ) : activeTab === 'list' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
           <div className="overflow-x-auto"><table className="w-full text-right text-[11px] font-bold"><thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b"><tr><th className="px-8 py-5">رقم السند</th><th className="px-8 py-5">المورد</th><th className="px-8 py-5 text-center">الإجمالي</th><th className="px-8 py-5 text-center">المتبقي</th><th className="px-8 py-5 text-left">إدارة</th></tr></thead><tbody className="divide-y divide-slate-50">
              {filteredPurchases.map(p => (
                 <tr key={p.id} className="hover:bg-slate-50 transition-all group">
                    <td className="px-8 py-4 text-indigo-600 font-mono">#{p.id.slice(-6)}</td>
                    <td className="px-8 py-4">{p.supplierName}</td>
                    <td className="px-8 py-4 text-center">{p.totalAmount.toLocaleString()}</td>
                    <td className="px-8 py-4 text-center text-rose-600">{p.remainingAmount.toLocaleString()}</td>
                    <td className="px-8 py-4 text-left">
                       <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100">
                          {canManageSuppliers && <button onClick={()=>handleStartReturn(p)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all" title="إرجاع أصناف"><RotateCcw size={14}/></button>}
                          <button onClick={() => setDetailedPurchase(p)} className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition-all"><Eye size={14}/></button>
                       </div>
                    </td>
                 </tr>
              ))}
           </tbody></table></div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
           {!canManageSuppliers ? (
             <div className="bg-white p-12 rounded-[3rem] border border-slate-200 text-center space-y-6">
                <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner"><Lock size={48}/></div>
                <h3 className="text-xl font-black text-slate-800">صلاحية وصول محدودة</h3>
             </div>
           ) : (
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                <div className="p-8 bg-slate-50/50 border-b flex items-center gap-3"><RotateCcw className="text-rose-600" size={20}/><h4 className="font-black text-sm">سجل مرتجعات التوريد</h4></div>
                <div className="overflow-x-auto">
                   <table className="w-full text-right text-[11px] font-bold"><thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b"><tr><th className="px-8 py-5">رقم المرتجع</th><th className="px-8 py-5 text-center">القيمة المستردة</th><th className="px-8 py-5 text-center">طريقة الرد</th><th className="px-8 py-5 text-left">الأصناف</th></tr></thead><tbody className="divide-y divide-slate-50">
                         {purchaseReturns.map(ret => (
                            <tr key={ret.id} className="hover:bg-rose-50/20 transition-all">
                               <td className="px-8 py-4 text-rose-600 font-mono">#{ret.id.slice(-6)}</td>
                               <td className="px-8 py-4 text-center font-black text-rose-600">{ret.totalRefund.toLocaleString()} ج.م</td>
                               <td className="px-8 py-4 text-center"><span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${ret.refundMethod === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{ret.refundMethod === 'cash' ? 'نقدي' : 'خصم مديونية'}</span></td>
                               <td className="px-8 py-4 text-left text-[9px] text-slate-300 truncate max-w-xs">{ret.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}</td>
                            </tr>
                         ))}
                      </tbody></table>
                </div>
             </div>
           )}
        </div>
      )}

      {/* Quick Add Product Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-indigo-600 text-white flex justify-between items-center"><h3 className="font-black text-sm">تعريف صنف جديد وتوريده</h3><button onClick={() => setIsQuickAddOpen(false)}><X size={24}/></button></div>
              <div className="p-8 space-y-5 text-right">
                 <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">اسم الصنف الجديد</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-xl font-black outline-none shadow-inner" value={quickProduct.name} onChange={e=>setQuickProduct({...quickProduct, name: e.target.value})} /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">سعر التكلفة</label><input type="number" className="w-full p-4 bg-slate-50 border rounded-xl font-black outline-none" value={quickProduct.wholesale || ''} onChange={e=>setQuickProduct({...quickProduct, wholesale: Number(e.target.value)})} /></div>
                    <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase">سعر البيع</label><input type="number" className="w-full p-4 bg-slate-50 border rounded-xl font-black outline-none" value={quickProduct.retail || ''} onChange={e=>setQuickProduct({...quickProduct, retail: Number(e.target.value)})} /></div>
                 </div>
                 <div className="space-y-1.5"><label className="text-[11px] font-black text-indigo-600 uppercase">الكمية الموردة الآن</label><input type="number" className="w-full p-5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl font-black text-xl text-center outline-none" value={quickProduct.quantity || ''} onChange={e=>setQuickProduct({...quickProduct, quantity: Number(e.target.value)})} /></div>
                 <button onClick={handleQuickAddProduct} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black mt-4 shadow-xl flex items-center justify-center gap-3"><PlusCircle size={20}/> إضافة الصنف</button>
              </div>
           </div>
        </div>
      )}

      {/* Detailed Purchase Items Modal */}
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
                 <div className="p-4 bg-white rounded-2xl border border-slate-100 text-center"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">إجمالي الفاتورة</p><p className="text-lg font-black text-slate-800">{(detailedPurchase.totalAmount || 0).toLocaleString()} ج.م</p></div>
                 <div className="p-4 bg-white rounded-2xl border border-emerald-100 text-center"><p className="text-[9px] font-black text-emerald-500 uppercase mb-1">المبلغ المسدد</p><p className="text-lg font-black text-emerald-600">{(detailedPurchase.paidAmount || 0).toLocaleString()} ج.م</p></div>
                 <div className={`p-4 bg-white rounded-2xl border text-center ${detailedPurchase.remainingAmount > 0 ? 'border-rose-100' : 'border-slate-100'}`}><p className={`text-[9px] font-black uppercase mb-1 ${detailedPurchase.remainingAmount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>المبلغ المتبقي</p><p className={`text-lg font-black ${detailedPurchase.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{(detailedPurchase.remainingAmount || 0).toLocaleString()} ج.م</p></div>
              </div>

              <div className="p-8 max-h-[40vh] overflow-y-auto scrollbar-hide">
                 <table className="w-full text-right text-xs">
                    <thead className="text-slate-400 font-black uppercase text-[9px] border-b pb-4">
                       <tr><th className="px-4">الصنف</th><th className="px-4 text-center">الكمية</th><th className="px-4 text-center">سعر التكلفة</th><th className="px-4 text-left">الإجمالي</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold">
                       {detailedPurchase.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-4 flex items-center gap-3"><div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-indigo-400"><Package size={14}/></div>{it.name}</td>
                            <td className="px-4 text-center">{it.quantity}</td>
                            <td className="px-4 text-center text-slate-400">{(it.costPrice || 0).toLocaleString()}</td>
                            <td className="px-4 text-left text-indigo-600 font-black">{(it.subtotal || 0).toLocaleString()}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
              
              <div className="p-8 bg-slate-50 border-t flex justify-end">
                 <button onClick={()=>setDetailedPurchase(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-black rounded-xl text-xs hover:bg-slate-100 transition-all">إغلاق</button>
              </div>
           </div>
        </div>
      )}

      {/* Return Process Modal */}
      {isReturnModalOpen && returningPurchase && (
           <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[7000] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className="p-6 bg-rose-600 text-white flex justify-between items-center"><h3 className="font-black text-sm flex items-center gap-2"><RotateCcw size={18}/> تنفيذ مرتجع مشتريات للمورد</h3><button onClick={() => setIsReturnModalOpen(false)}><X size={24}/></button></div>
                 <div className="p-8 space-y-6 text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">حدد الكميات المراد إرجاعها من الفاتورة #{returningPurchase.id.slice(-6)}</p>
                    <div className="max-h-[35vh] overflow-y-auto border rounded-2xl scrollbar-hide">
                       <table className="w-full text-right text-xs font-bold"><thead className="bg-slate-50 text-[9px] uppercase text-slate-400 border-b"><tr><th className="p-4">الصنف</th><th className="p-4 text-center">المورد</th><th className="p-4 text-center">المرتجع</th><th className="p-4 text-left">قيمة الرد</th></tr></thead><tbody className="divide-y divide-slate-100">
                             {returningPurchase.items.map(it => (
                               <tr key={it.productId} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4">{it.name}</td>
                                  <td className="p-4 text-center text-slate-400">{it.quantity}</td>
                                  <td className="p-4"><input type="number" min="0" max={it.quantity} className="w-16 p-2 bg-slate-100 border-none rounded-lg text-center font-black" value={returnQtys[it.productId] || 0} onChange={e => setReturnQtys({...returnQtys, [it.productId]: Math.min(it.quantity, Math.max(0, Number(e.target.value)))})} /></td>
                                  <td className="p-4 text-left text-rose-600">{((returnQtys[it.productId] || 0) * it.costPrice).toLocaleString()}</td>
                               </tr>
                             ))}
                          </tbody></table>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <div className="space-y-3"><label className="text-[10px] font-black text-slate-400 uppercase">طريقة استرداد القيمة</label><div className="flex gap-3"><button onClick={()=>setRefundMethod('debt_deduction')} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${refundMethod === 'debt_deduction' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-transparent text-slate-400'}`}>خصم مديونية</button><button onClick={()=>setRefundMethod('cash')} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${refundMethod === 'cash' ? 'bg-emerald-50 border-emerald-600 text-emerald-600' : 'bg-white border-transparent text-slate-400'}`}>استرداد نقدي</button></div></div>
                       <div className="text-left flex flex-col justify-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي مبلغ المرتجع</p><h4 className="text-2xl font-black text-rose-600">{returningPurchase.items.reduce((a,b)=>a + ((returnQtys[b.productId]||0)*b.costPrice), 0).toLocaleString()} <span className="text-sm">ج.م</span></h4></div>
                    </div>
                    <button onClick={handleFinalizeReturn} disabled={isSubmitting} className="w-full py-5 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-rose-700 transition-all flex items-center justify-center gap-3">
                       {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20}/>} اعتماد سند المرتجع
                    </button>
                 </div>
              </div>
           </div>
         )}
    </div>
  );
};

export default Purchases;