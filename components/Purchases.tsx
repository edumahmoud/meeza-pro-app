
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Truck, Plus, Trash2, Save, X, UserPlus, 
  ArrowRight, Landmark, Banknote, History, ChevronRight, 
  ChevronLeft, FileText, Smartphone, TrendingDown, Receipt, 
  ArrowUpDown, DownloadCloud, FileSpreadsheet, PackagePlus, Calculator, CreditCard,
  Users, Hash, ShieldCheck, ClipboardList, Building2, AlertCircle, AlertTriangle, RefreshCw, CheckCircle2,
  Box, Barcode, Wallet, ArrowUpRight, ArrowDownLeft, Filter, Calendar, Edit3, EyeOff, RotateCcw, Package, Eraser, Layers, DollarSign, Check, Eye, PlusCircle
} from 'lucide-react';
import { Product, PurchaseRecord, PurchaseItem, Supplier, User as UserType, SupplierPayment, Branch, PurchaseReturnRecord } from '../types';
import * as XLSX from 'xlsx';
import { copyToClipboard } from './Layout';
import { usePurchaseData } from '../hooks/usePurchaseData';

interface PurchasesProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  branches?: Branch[];
  onAddSupplier: (name: string, phone?: string, tax?: string, comm?: string) => Promise<any>;
  onDeleteSupplier: (id: string, reason: string, user: UserType) => Promise<void>;
  onAddPurchase: (record: PurchaseRecord) => Promise<void>;
  onAddProduct: (n: string, d: string, w: number, r: number, s: number, user: UserType) => Promise<any>;
  onAddSupplierPayment: (sId: string, amt: number, pId: string | null, notes: string, user: UserType) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  user: UserType;
}

const Purchases: React.FC<PurchasesProps> = ({ 
  products, suppliers, purchases, payments, branches = [],
  onAddSupplier, onDeleteSupplier, onAddPurchase, onAddProduct, onAddSupplierPayment, onShowToast, askConfirmation, user 
}) => {
  const { purchaseReturns, addPurchaseReturn } = usePurchaseData();

  type ViewState = 'list' | 'add_purchase' | 'add_supplier' | 'supplier_profile';
  
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers' | 'returns'>('purchases');
  const [profileTab, setProfileTab] = useState<'invoices' | 'returns' | 'payments'>('invoices'); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNewProductMode, setIsNewProductMode] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof PurchaseRecord | string, direction: 'asc' | 'desc' } | null>({ key: 'timestamp', direction: 'desc' });
  const [visibleCount, setVisibleCount] = useState(50);

  // Purchases List Search
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');

  // Supplier Profile States
  const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<PurchaseRecord | null>(null);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState(''); 
  const [viewingInvoice, setViewingInvoice] = useState<PurchaseRecord | null>(null); 
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false); 
  const [invoiceToReturn, setInvoiceToReturn] = useState<PurchaseRecord | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'debt_deduction'>('debt_deduction');
  const [isMoneyReceived, setIsMoneyReceived] = useState(false);

  const [statementRange, setStatementRange] = useState({ start: '', end: '' });
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'cash' | 'paid' | 'outstanding' | 'credit'>('all');

  const isHQ = ['admin', 'it_support', 'general_manager'].includes(user.role);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setVisibleCount(50);
  };

  const filteredPurchases = useMemo(() => {
    let list = purchases.filter(p => !p.isDeleted && (isHQ ? true : p.branchId === user.branchId));
    
    if (purchaseSearchTerm) {
      const term = purchaseSearchTerm.toLowerCase();
      list = list.filter(p => 
        (p.supplierName && p.supplierName.toLowerCase().includes(term)) ||
        (p.supplierInvoiceNo && p.supplierInvoiceNo.toLowerCase().includes(term)) ||
        p.id.toLowerCase().includes(term)
      );
    }

    if (sortConfig) {
      list.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof PurchaseRecord];
        let valB: any = b[sortConfig.key as keyof PurchaseRecord];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [purchases, user.branchId, isHQ, sortConfig, purchaseSearchTerm]);

  const displayPurchases = useMemo(() => filteredPurchases.slice(0, visibleCount), [filteredPurchases, visibleCount]);

  const filteredReturns = useMemo(() => {
    let list = purchaseReturns.filter(r => (isHQ ? true : r.branchId === user.branchId));
    return list.sort((a,b) => b.timestamp - a.timestamp);
  }, [purchaseReturns, isHQ, user.branchId]);

  const visibleSuppliers = useMemo(() => {
    return suppliers.filter(s => !s.isDeleted);
  }, [suppliers]);

  // Form States
  const [supForm, setSupForm] = useState({ name: '', phone: '', tax: '', comm: '' });
  const [purForm, setPurForm] = useState({
    supplierId: '', supplierInvoiceNo: '', items: [] as PurchaseItem[], paidAmount: 0, paymentStatus: 'cash' as 'cash' | 'credit', notes: ''
  });
  const [newProdForm, setNewProdForm] = useState({ name: '', wholesale: 0, retail: 0, quantity: 1 });
  const [itemSearch, setItemSearch] = useState('');

  // Derived Data for Profile
  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [suppliers, selectedSupplierId]);
  
  const supplierInvoices = useMemo(() => {
    let list = purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted);
    
    if (invoiceSearchTerm) {
      const term = invoiceSearchTerm.toLowerCase();
      list = list.filter(i => 
        (i.supplierInvoiceNo || '').toLowerCase().includes(term) || 
        i.id.includes(term) || i.items.some(item => item.name.toLowerCase().includes(term))
      );
    }
    if (invoiceFilter === 'cash') list = list.filter(i => i.paymentStatus === 'cash');
    if (invoiceFilter === 'credit') list = list.filter(i => i.paymentStatus === 'credit');
    if (invoiceFilter === 'paid') list = list.filter(i => i.remainingAmount <= 0);
    if (invoiceFilter === 'outstanding') list = list.filter(i => i.remainingAmount > 0);
    return list.sort((a,b) => b.timestamp - a.timestamp);
  }, [purchases, selectedSupplierId, invoiceFilter, invoiceSearchTerm]);

  const supplierReturnsList = useMemo(() => {
    return purchaseReturns.filter(r => r.supplierId === selectedSupplierId).sort((a,b) => b.timestamp - a.timestamp);
  }, [purchaseReturns, selectedSupplierId]);

  const supplierPaymentsHistory = useMemo(() => payments.filter(p => p.supplierId === selectedSupplierId), [payments, selectedSupplierId]);
  const unpaidInvoices = useMemo(() => purchases.filter(p => p.supplierId === selectedSupplierId && !p.isDeleted && p.remainingAmount > 0 && p.paymentStatus === 'credit'), [purchases, selectedSupplierId]);

  // Handlers
  const handleAddSupplierSubmit = async () => {
    if (!supForm.name || isSubmitting) return onShowToast("اسم المورد مطلوب", "error");
    setIsSubmitting(true);
    try {
      await onAddSupplier(supForm.name, supForm.phone, supForm.tax, supForm.comm);
      onShowToast("تم إضافة المورد بنجاح", "success");
      setViewState('list');
      setSupForm({ name: '', phone: '', tax: '', comm: '' });
    } catch (e) { onShowToast("فشل إضافة المورد", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateProductInline = async () => { 
    if (!newProdForm.name.trim() || isSubmitting) return onShowToast("اسم الصنف مطلوب", "error");
    setIsSubmitting(true);
    try {
      const data = await onAddProduct(newProdForm.name.trim(), '', newProdForm.wholesale, newProdForm.retail, 0, user);
      if (data && data.id) {
        addItemToPurchase(data, newProdForm.quantity);
        setIsNewProductMode(false);
        setNewProdForm({ name: '', wholesale: 0, retail: 0, quantity: 1 });
        onShowToast("تم تعريف الصنف الجديد بنجاح", "success");
      }
    } catch (e) { onShowToast("فشل تعريف الصنف", "error"); }
    finally { setIsSubmitting(false); }
  };

  const unifiedSearchResults = useMemo(() => { 
    if (!itemSearch) return [];
    const seenCodes = new Set();
    const uniqueList: Product[] = [];
    products.forEach(p => {
       if (!p.isDeleted && (p.name.includes(itemSearch) || p.code.includes(itemSearch))) {
          if (!seenCodes.has(p.code)) { seenCodes.add(p.code); uniqueList.push(p); }
       }
    });
    return uniqueList.slice(0, 8);
  }, [products, itemSearch]);

  const addItemToPurchase = (p: Product, qty: number = 1) => {
    if (!p || !p.id) return;
    setPurForm(prev => {
      if (prev.items.find(i => i.productId === p.id)) return prev;
      return {
        ...prev,
        items: [...prev.items, { productId: p.id, name: p.name, quantity: qty, costPrice: Number(p.wholesalePrice || 0), retailPrice: Number(p.retailPrice || 0), subtotal: Number(p.wholesalePrice || 0) * qty }]
      };
    });
    setItemSearch('');
  };

  const removeItemFromPurchase = (productId: string) => {
    setPurForm(prev => ({ ...prev, items: prev.items.filter(item => item.productId !== productId) }));
  };

  const handleAddPurchaseSubmit = async () => {
    if (!purForm.supplierId || purForm.items.length === 0 || isSubmitting) return onShowToast("أكمل بيانات التوريد", "error");
    setIsSubmitting(true);
    const totalAmount = purForm.items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0);
    const supplier = suppliers.find(s => s.id === purForm.supplierId);
    const record: PurchaseRecord = {
      id: crypto.randomUUID(), supplierId: purForm.supplierId, supplierName: supplier?.name || '', supplierInvoiceNo: purForm.supplierInvoiceNo, items: purForm.items, totalAmount, paidAmount: Number(purForm.paidAmount || 0), remainingAmount: totalAmount - Number(purForm.paidAmount || 0), paymentStatus: purForm.paymentStatus, date: new Date().toLocaleDateString('ar-EG'), time: new Date().toLocaleTimeString('ar-EG'), timestamp: Date.now(), createdBy: user.id, branchId: user.branchId, notes: purForm.notes
    };
    try {
      await onAddPurchase(record);
      onShowToast("تم تسجيل التوريد بنجاح", "success");
      setViewState('list');
      setPurForm({ supplierId: '', supplierInvoiceNo: '', items: [], paidAmount: 0, paymentStatus: 'cash', notes: '' });
    } catch (e: any) { onShowToast(e.message || "فشل تسجيل التوريد", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handlePayDebt = async () => {
    if (!selectedSupplierId || paymentAmount <= 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const invoiceId = selectedInvoiceToPay ? selectedInvoiceToPay.id : null;
      const note = selectedInvoiceToPay ? `سداد جزء من فاتورة رقم ${selectedInvoiceToPay.supplierInvoiceNo || '#' + selectedInvoiceToPay.id.slice(0,6)}` : "سداد دفعة من الحساب العام";
      await onAddSupplierPayment(selectedSupplierId, paymentAmount, invoiceId, note, user);
      onShowToast("تم تسجيل الدفعة وخصمها من الخزينة بنجاح", "success");
      setIsPayDebtOpen(false);
      setPaymentAmount(0);
      setSelectedInvoiceToPay(null);
    } catch (e: any) { onShowToast(e.message || "فشل السداد", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplierId || isSubmitting) return;
    if (selectedSupplier?.totalDebt !== 0) return onShowToast("لا يمكن حذف المورد لوجود مديونية معلقة.", "error");
    askConfirmation("حذف المورد", "هل أنت متأكد من حذف هذا المورد نهائياً؟", async () => {
      setIsSubmitting(true);
      try {
        await onDeleteSupplier(selectedSupplierId, "طلب حذف من المستخدم", user);
        onShowToast("تم حذف المورد بنجاح", "success");
        setViewState('list');
      } catch (e: any) { onShowToast(e.message || "فشل الحذف", "error"); }
      finally { setIsSubmitting(false); }
    });
  };

  const handleOpenReturnModal = (inv: PurchaseRecord) => {
    setInvoiceToReturn(inv);
    const initial: Record<string, number> = {};
    inv.items.forEach(i => initial[i.productId] = 0);
    setReturnItemsState(initial);
    setRefundMethod(inv.paymentStatus === 'cash' ? 'cash' : 'debt_deduction'); 
    setIsMoneyReceived(false);
    setIsReturnModalOpen(true);
  };

  const calculateReturnTotal = () => {
    if (!invoiceToReturn) return 0;
    let total = 0;
    invoiceToReturn.items.forEach(item => { total += (returnItemsState[item.productId] || 0) * (item.costPrice || 0); });
    return total;
  };

  const handleSubmitReturn = async () => {
    if (!invoiceToReturn || !selectedSupplierId || isSubmitting) return;
    const totalRefund = calculateReturnTotal();
    if (totalRefund <= 0) return onShowToast("يرجى تحديد كميات للإرجاع", "error");
    setIsSubmitting(true);
    try {
        const returnItems: PurchaseItem[] = invoiceToReturn.items.filter(i => (returnItemsState[i.productId] || 0) > 0).map(i => ({ ...i, quantity: returnItemsState[i.productId], subtotal: returnItemsState[i.productId] * (i.costPrice || 0) }));
        const returnRecord: PurchaseReturnRecord = { id: crypto.randomUUID(), originalPurchaseId: invoiceToReturn.id, supplierId: selectedSupplierId, items: returnItems, totalRefund, refundMethod, isMoneyReceived: refundMethod === 'cash' ? isMoneyReceived : false, date: new Date().toLocaleDateString('ar-EG'), time: new Date().toLocaleTimeString('ar-EG'), timestamp: Date.now(), createdBy: user.id, branchId: user.branchId, notes: `مرتجع من فاتورة #${invoiceToReturn.supplierInvoiceNo}` };
        await addPurchaseReturn(returnRecord, user);
        onShowToast("تم تنفيذ المرتجع بنجاح", "success");
        setIsReturnModalOpen(false);
        setInvoiceToReturn(null);
    } catch (e: any) { onShowToast(e.message || "فشل تنفيذ المرتجع", "error"); }
    finally { setIsSubmitting(false); }
  };

  if (viewState === 'add_supplier') { 
    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
           <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><UserPlus size={24} className="text-indigo-600"/> إضافة مورد جديد</h3>
           <button onClick={() => setViewState('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><X size={20}/></button>
        </div>
        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm max-w-3xl mx-auto space-y-6">
           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">اسم المورد</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={supForm.name} onChange={e=>setSupForm({...supForm, name: e.target.value})} placeholder="الاسم التجاري..." /></div>
           <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">رقم الهاتف</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={supForm.phone} onChange={e=>setSupForm({...supForm, phone: e.target.value})} /></div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">الرقم الضريبي</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={supForm.tax} onChange={e=>setSupForm({...supForm, tax: e.target.value})} /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">السجل التجاري</label><input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-sm" value={supForm.comm} onChange={e=>setSupForm({...supForm, comm: e.target.value})} /></div>
           </div>
           <div className="pt-6 border-t flex justify-end gap-3">
              <button onClick={() => setViewState('list')} className="px-8 py-3 bg-white border rounded-xl text-xs font-black text-slate-500">إلغاء</button>
              <button onClick={handleAddSupplierSubmit} disabled={isSubmitting} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50">
                {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'حفظ المورد'}
              </button>
           </div>
        </div>
      </div>
    ); 
  }

  if (viewState === 'add_purchase') { 
    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex items-center justify-between">
           <h3 className="font-black text-lg text-slate-800 flex items-center gap-2"><Truck size={24} className="text-emerald-600"/> تسجيل فاتورة توريد</h3>
           <button onClick={() => setViewState('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                 <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-slate-800">إضافة أصناف للفاتورة</h4>
                    <button onClick={() => setIsNewProductMode(!isNewProductMode)} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg hover:bg-indigo-100 transition-all">
                       {isNewProductMode ? 'إلغاء الإضافة السريعة' : 'صنف جديد غير موجود؟'}
                    </button>
                 </div>
                 {isNewProductMode ? (
                    <div className="grid grid-cols-5 gap-3 animate-in slide-in-from-top-2 bg-slate-50 p-4 rounded-2xl">
                       <input type="text" placeholder="اسم الصنف الجديد..." className="col-span-2 p-3 bg-white border rounded-xl text-xs font-black" value={newProdForm.name} onChange={e=>setNewProdForm({...newProdForm, name: e.target.value})} />
                       <input type="number" placeholder="الجملة" className="p-3 bg-white border rounded-xl text-xs font-black" value={newProdForm.wholesale || ''} onChange={e=>setNewProdForm({...newProdForm, wholesale: Number(e.target.value)})} />
                       <input type="number" placeholder="التجزئة" className="p-3 bg-white border rounded-xl text-xs font-black" value={newProdForm.retail || ''} onChange={e=>setNewProdForm({...newProdForm, retail: Number(e.target.value)})} />
                       <input type="number" placeholder="الكمية" className="p-3 bg-white border rounded-xl text-xs font-black" value={newProdForm.quantity} onChange={e=>setNewProdForm({...newProdForm, quantity: Number(e.target.value)})} />
                       <button onClick={handleCreateProductInline} disabled={isSubmitting} className="col-span-5 p-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg">
                          {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={16}/> : 'إضافة للقائمة'}
                       </button>
                    </div>
                 ) : (
                    <div className="relative">
                       <input type="text" className="w-full p-4 bg-slate-50 border-none rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500/10" placeholder="ابحث باسم الصنف أو الكود..." value={itemSearch} onChange={e=>setItemSearch(e.target.value)} />
                       {unifiedSearchResults.length > 0 && (
                         <div className="absolute top-full left-0 right-0 bg-white border rounded-2xl shadow-2xl mt-2 z-20 overflow-hidden divide-y max-h-60 overflow-y-auto">
                            {unifiedSearchResults.map(p => (
                              <button key={p.id} onClick={()=>addItemToPurchase(p)} className="w-full p-4 text-right hover:bg-indigo-50 flex justify-between items-center group">
                                 <div><span className="font-black text-xs text-slate-800">{p.name}</span><span className="mr-3 text-[9px] px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-400">#{p.code}</span></div>
                                 <Plus size={16} className="text-emerald-500 opacity-0 group-hover:opacity-100"/>
                              </button>
                            ))}
                         </div>
                       )}
                    </div>
                 )}
              </div>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[300px]">
                 <table className="w-full text-right text-[10px]">
                    <thead className="bg-slate-50 border-b text-slate-500"><tr><th className="p-4">الصنف</th><th className="p-4 text-center">الكمية</th><th className="p-4 text-center">التكلفة</th><th className="p-4 text-left">الإجمالي</th><th className="p-4 w-10"></th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                       {purForm.items.map((item, idx) => (
                         <tr key={item.productId} className="hover:bg-slate-50/30">
                            <td className="p-4 font-black">{item.name}</td>
                            <td className="p-4 text-center"><input type="number" className="w-20 p-2 bg-slate-50 border rounded-xl text-center font-black" value={item.quantity} onChange={e => { const next = [...purForm.items]; next[idx].quantity = Number(e.target.value); next[idx].subtotal = next[idx].quantity * (next[idx].costPrice || 0); setPurForm({...purForm, items: next}); }} /></td>
                            <td className="p-4 text-center"><input type="number" className="w-24 p-2 bg-slate-50 border rounded-xl text-center font-black" value={item.costPrice} onChange={e => { const next = [...purForm.items]; next[idx].costPrice = Number(e.target.value); next[idx].subtotal = next[idx].quantity * (next[idx].costPrice || 0); setPurForm({...purForm, items: next}); }} /></td>
                            <td className="p-4 text-left font-black text-indigo-600">{(item.subtotal || 0).toLocaleString()}</td>
                            <td className="p-4"><button onClick={()=>removeItemFromPurchase(item.productId)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button></td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                 <h4 className="font-black text-sm border-b pb-4">بيانات الفاتورة</h4>
                 <div className="space-y-3">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400">المورد</label><select className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs" value={purForm.supplierId} onChange={e=>setPurForm({...purForm, supplierId: e.target.value})}><option value="">اختر المورد...</option>{visibleSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400">رقم الفاتورة الورقية</label><input type="text" className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs" value={purForm.supplierInvoiceNo} onChange={e=>setPurForm({...purForm, supplierInvoiceNo: e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-400">طريقة السداد</label><select className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs" value={purForm.paymentStatus} onChange={e=>setPurForm({...purForm, paymentStatus: e.target.value as any})}><option value="cash">نقدي (سداد كامل)</option><option value="credit">آجل (ذمم)</option></select></div>
                    {purForm.paymentStatus === 'credit' && (
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400">المبلغ المدفوع مقدماً</label><input type="number" className="w-full p-3 bg-slate-50 border rounded-xl font-black text-xs" value={purForm.paidAmount} onChange={e=>setPurForm({...purForm, paidAmount: Number(e.target.value)})} /></div>
                    )}
                 </div>
              </div>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white text-center space-y-4 shadow-xl">
                 <h2 className="text-4xl font-black">{purForm.items.reduce((a,b)=>a+(Number(b.subtotal)||0), 0).toLocaleString()} <span className="text-lg text-slate-500">ج.م</span></h2>
                 <button onClick={handleAddPurchaseSubmit} disabled={isSubmitting || purForm.items.length === 0} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-lg hover:bg-emerald-600 disabled:opacity-50 mt-4">
                    {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={20}/> : 'اعتماد الفاتورة'}
                 </button>
              </div>
           </div>
        </div>
      </div>
    ); 
  }

  if (viewState === 'supplier_profile' && selectedSupplier) {
    return (
      <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
         <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
               <div className="flex items-center gap-6">
                  <button onClick={() => setViewState('list')} className="p-3 bg-slate-100 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><ArrowRight size={24}/></button>
                  <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-lg">{selectedSupplier.name[0]}</div>
                  <div><h2 className="text-2xl font-black text-slate-800">{selectedSupplier.name}</h2><p className="text-slate-400 font-bold text-xs mt-1 flex items-center gap-2"><Smartphone size={14}/> {selectedSupplier.phone || 'غير مسجل'}</p></div>
               </div>
               <div className="flex gap-4 items-center">
                  <div className={`text-center px-6 py-2 rounded-2xl border ${selectedSupplier.totalDebt > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                     <p className={`text-xl font-black ${selectedSupplier.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{Math.abs(selectedSupplier.totalDebt).toLocaleString()} ج.م</p>
                  </div>
                  <button onClick={handleDeleteSupplier} disabled={isSubmitting} className={`p-4 rounded-2xl transition-all shadow-sm ${selectedSupplier.totalDebt !== 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-100'}`}>
                    {isSubmitting ? <RefreshCw className="animate-spin" size={20}/> : <Trash2 size={20}/>}
                  </button>
               </div>
            </div>
         </div>
         {/* باقي واجهة البروفايل مع أزرار سداد الدفعات والمرتجع */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
               <div className="p-6 border-b bg-slate-50/50 flex flex-col gap-4">
                  <div className="flex bg-slate-200 p-1 rounded-xl w-fit">
                    {['invoices', 'returns', 'payments'].map(tab => (
                      <button key={tab} onClick={() => setProfileTab(tab as any)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${profileTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{tab === 'invoices' ? 'الفواتير' : tab === 'returns' ? 'المرتجعات' : 'المدفوعات'}</button>
                    ))}
                  </div>
               </div>
               <div className="overflow-x-auto">
                  {profileTab === 'invoices' ? (
                     <table className="w-full text-right text-[10px]">
                        <thead className="bg-slate-50 text-slate-400 font-black border-b"><tr><th className="p-4">التاريخ</th><th className="p-4">رقم الفاتورة</th><th className="p-4 text-center">الإجمالي</th><th className="p-4 text-center">المتبقي</th><th className="p-4 text-left">إجراءات</th></tr></thead>
                        <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                           {supplierInvoices.slice(0, 50).map(inv => (
                              <tr key={inv.id} className="hover:bg-slate-50/50">
                                 <td className="p-4">{inv.date}</td>
                                 <td className="p-4 text-indigo-600">#{inv.supplierInvoiceNo || inv.id.slice(0,6)}</td>
                                 <td className="p-4 text-center">{inv.totalAmount.toLocaleString()}</td>
                                 <td className={`p-4 text-center ${inv.remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{inv.remainingAmount.toLocaleString()}</td>
                                 <td className="p-4 text-left"><div className="flex justify-end gap-2"><button onClick={() => setViewingInvoice(inv)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white"><Eye size={14}/></button><button onClick={() => handleOpenReturnModal(inv)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-600 hover:text-white"><RotateCcw size={14}/></button></div></td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  ) : null}
               </div>
            </div>
            <div className="space-y-6">
               <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                  <button onClick={() => { setIsPayDebtOpen(true); setSelectedInvoiceToPay(null); }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><DollarSign size={16}/> سداد دفعات / مديونية</button>
               </div>
            </div>
         </div>

         {isPayDebtOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
               <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in overflow-hidden flex flex-col">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                     <h3 className="font-black text-sm">سداد دفعة للمورد</h3>
                     <button onClick={() => setIsPayDebtOpen(false)}><X size={24}/></button>
                  </div>
                  <div className="p-8 space-y-4">
                     <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-center"><p className="text-2xl font-black text-rose-600">{unpaidInvoices.reduce((a,b)=>a+b.remainingAmount, 0).toLocaleString()} ج.م</p></div>
                     <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-lg text-center" value={paymentAmount || ''} onChange={e=>setPaymentAmount(Number(e.target.value))} placeholder="0.00" />
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex gap-3">
                     <button onClick={() => setIsPayDebtOpen(false)} className="flex-1 py-4 bg-white border rounded-xl text-xs font-black">إلغاء</button>
                     <button onClick={handlePayDebt} disabled={isSubmitting || paymentAmount <= 0} className="flex-[2] py-4 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg">
                       {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'تأكيد السداد'}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    );
  }

  return ( 
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto">
          <button onClick={() => {setActiveTab('purchases'); setVisibleCount(50);}} className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'purchases' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>سجل التوريدات</button>
          <button onClick={() => setActiveTab('suppliers')} className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>الموردين</button>
          <button onClick={() => setActiveTab('returns')} className={`flex-1 py-3 px-6 rounded-xl text-[10px] font-black transition-all ${activeTab === 'returns' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>المرتجعات</button>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setViewState('add_supplier')} className="px-6 py-3 bg-white border border-slate-200 text-slate-800 font-black rounded-xl text-[10px] flex items-center gap-2"><UserPlus size={16}/> مورد جديد</button>
          <button onClick={() => setViewState('add_purchase')} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"><Truck size={16}/> إضافة توريد</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {activeTab === 'purchases' && (
          <>
             <div className="p-4 border-b bg-slate-50 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                   <input type="text" placeholder="بحث..." className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" value={purchaseSearchTerm} onChange={e => {setPurchaseSearchTerm(e.target.value); setVisibleCount(50);}} />
                </div>
             </div>
             <table className="w-full text-right text-[11px] font-bold">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] border-b">
                <tr><th className="px-8 py-5">رقم السند</th><th className="px-8 py-5">المورد</th><th className="px-8 py-5 text-center">رقم الفاتورة</th><th className="px-8 py-5 text-center">القيمة</th><th className="px-8 py-5 text-left">التوقيت</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-8 py-4 text-indigo-600 font-black">#{p.id.slice(-6)}</td>
                    <td className="px-8 py-4">{p.supplierName}</td>
                    <td className="px-8 py-4 text-center text-slate-400">#{p.supplierInvoiceNo}</td>
                    <td className="px-8 py-4 text-center font-black">{p.totalAmount.toLocaleString()} ج.م</td>
                    <td className="px-8 py-4 text-left text-slate-400">{p.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleCount < filteredPurchases.length && (
               <div className="p-6 bg-slate-50 flex justify-center border-t">
                  <button onClick={() => setVisibleCount(prev => prev + 50)} className="px-10 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-xs flex items-center gap-2 hover:bg-indigo-600 hover:text-white transition-all"><PlusCircle size={18}/> عرض المزيد</button>
               </div>
            )}
          </>
        )}
        {/* باقي التابات الموردين والمرتجعات... */}
      </div>
    </div>
  );
};

export default Purchases;
