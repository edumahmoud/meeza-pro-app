import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle2, RefreshCw, X, 
  ReceiptText, DollarSign, Percent, History, UserCircle, Smartphone, 
  FileText, StickyNote, Printer, Camera, Package, Wallet, Banknote, ShoppingBag, DownloadCloud, Share2, Star, UserCheck, Tag
} from 'lucide-react';
import { Product, Invoice, User as UserType, Shift, SystemSettings, SaleItem, Branch } from '../types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Html5Qrcode } from 'html5-qrcode';
import { copyToClipboard } from './Layout';

interface SalesProps {
  products: Product[];
  invoices: Invoice[];
  activeShift: Shift | null;
  branches: Branch[];
  onOpenShift: (balance: number) => Promise<void>;
  onCloseShift: (balance: number, notes: string) => Promise<void>;
  onSaveInvoice: (invoice: Invoice) => Promise<void>;
  onDeductStock: (id: string, qty: number) => Promise<void>;
  onShowToast: (message: string, type: 'success' | 'error') => void;
  user: UserType;
  settings: SystemSettings;
  canSell: boolean;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
}

const Sales = ({ 
  products, invoices, activeShift, branches, onOpenShift, onCloseShift, onSaveInvoice, onDeductStock, onShowToast, user, settings, canSell, askConfirmation
}: SalesProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([] as SaleItem[]);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState('fixed' as 'fixed' | 'percentage');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null as Invoice | null);

  const searchInputRef = useRef(null as HTMLInputElement | null);
  const scannerRef = useRef<any>(null);
  const searchContainerRef = useRef(null as HTMLDivElement | null);
  const invoiceRef = useRef(null as HTMLDivElement | null);

  const isAdmin = ['admin', 'it_support', 'general_manager'].includes(user.role);

  const shiftStats = useMemo(() => {
    if (!activeShift) return { totalSales: 0, count: 0, drawer: 0 };
    const shiftInvoices = invoices.filter(inv => inv.shiftId === activeShift.id && !inv.isDeleted);
    const totalSales = shiftInvoices.reduce((acc, inv) => acc + (inv.netTotal || 0), 0);
    const count = shiftInvoices.length;
    const drawer = (activeShift.openingBalance || 0) + totalSales;
    return { totalSales, count, drawer };
  }, [invoices, activeShift]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return products.filter(p => {
      if (p.isDeleted) return false;
      const matchesBranch = isAdmin ? true : (p.branchId === user.branchId);
      const name = p.name || '';
      const code = p.code || '';
      const matchesSearch = name.toLowerCase().includes(term) || code.includes(term);
      return matchesBranch && matchesSearch;
    }).slice(0, 20); 
  }, [products, searchTerm, user.branchId, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isScannerOpen) {
      try {
        const Html5QrcodeClass = (Html5Qrcode as any).Html5Qrcode || Html5Qrcode;
        const scanner = new Html5QrcodeClass("reader");
        scannerRef.current = scanner;
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleBarcodeScanned(decodedText);
            stopScanner();
          },
          () => {}
        ).catch((err: any) => {
            console.error("Scanner error:", err);
        });
      } catch (e) {
        console.error("Scanner Setup Error:", e);
      }
    }
    return () => { stopScanner(); };
  }, [isScannerOpen]);

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setIsScannerOpen(false);
      }).catch((err: any) => console.error(err));
    }
  };

  const handleBarcodeScanned = (code: string) => {
    const product = products.find(p => {
      const matchesBranch = isAdmin ? true : (p.branchId === user.branchId);
      return p.code === code && !p.isDeleted && matchesBranch;
    });

    if (product) {
      addToCart(product);
      onShowToast(`تمت إضافة: ${product.name}`, "success");
      setSearchTerm('');
    } else {
      onShowToast("المنتج غير موجود", "error");
    }
  };

  const addToCart = (product: Product) => {
    if (!canSell) return onShowToast("لا تملك صلاحية البيع", "error");
    const sellPrice = product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.retailPrice;
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty + 1 > product.stock) {
        onShowToast(`الكمية المتاحة ${product.stock} فقط`, "error");
        return prev;
      }
      if (existing) {
        return prev.map(item => item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
          : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: sellPrice,
        subtotal: sellPrice,
        wholesalePriceAtSale: product.wholesalePrice
      }];
    });
    setSearchTerm('');
    setShowSearchResults(false);
  };

  const updateCartQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty > product.stock) {
           onShowToast(`الرصيد المتاح ${product.stock} فقط`, "error");
           return item;
        }
        return { ...item, quantity: newQty, subtotal: newQty * item.unitPrice };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const totalBeforeDiscount = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const calculatedDiscount = discountType === 'percentage' 
    ? (totalBeforeDiscount * (discountValue / 100)) 
    : discountValue;
  const netTotal = Math.max(0, totalBeforeDiscount - calculatedDiscount);

  const handleCheckout = async () => {
    if (!activeShift) return onShowToast("يرجى فتح وردية للبدء", "error");
    if (cart.length === 0) return onShowToast("السلة فارغة", "error");
    setIsCheckoutLoading(true);
    const now = new Date();
    const invoice: Invoice = {
      id: crypto.randomUUID(),
      items: cart,
      totalBeforeDiscount,
      discountValue: calculatedDiscount,
      discountType: discountType,
      netTotal,
      date: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG'),
      timestamp: now.getTime(),
      customerName: customerName || 'عميل نقدي',
      customerPhone: customerPhone || '',
      notes: invoiceNotes,
      status: 'completed',
      createdBy: user.id,
      creatorUsername: user.username,
      branchId: user.branchId, 
      shiftId: activeShift.id
    };
    try {
      await onSaveInvoice(invoice);
      onShowToast("تم إتمام المبيعات بنجاح", "success");
      setCart([]);
      setDiscountValue(0);
      setCustomerName('');
      setCustomerPhone('');
      setInvoiceNotes('');
    } catch (error: any) {
      onShowToast(error.message || "خطأ في معالجة الطلب", "error");
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  if (!activeShift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in">
        <div className="p-12 bg-white rounded-[3.5rem] shadow-2xl text-center space-y-6 max-w-md border border-slate-100">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner"><ShoppingCart size={48} className="animate-bounce"/></div>
          <h3 className="text-2xl font-black text-slate-800">نقطة البيع مغلقة</h3>
          <p className="text-sm text-slate-400 font-bold leading-relaxed">لبدء العمليات، يجب فتح وردية جديدة في الفرع.</p>
          <button onClick={() => onOpenShift(0)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">فتح وردية مبيعات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 font-['Cairo']" dir="rtl">
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Banknote size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">مبيعات الوردية</p><h4 className="text-lg font-black text-slate-800">{(shiftStats.totalSales || 0).toLocaleString()}</h4></div>
         </div>
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><ReceiptText size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">عدد الفواتير</p><h4 className="text-lg font-black text-slate-800">{shiftStats.count}</h4></div>
         </div>
         <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Wallet size={20}/></div>
            <div><p className="text-[9px] font-black text-slate-400 uppercase">الدرج المتوقع</p><h4 className="text-lg font-black text-slate-800">{(shiftStats.drawer || 0).toLocaleString()}</h4></div>
         </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0">
         <div className="w-full xl:w-[40%] flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden order-2 xl:order-1">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
               <div className="flex items-center gap-2">
                  <div className="bg-indigo-600 text-white p-1.5 rounded-lg"><ShoppingCart size={16}/></div>
                  <div><h3 className="font-black text-slate-800 text-xs">سلة المشتريات ({cart.length})</h3></div>
               </div>
               <button onClick={() => setCart([])} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide bg-slate-50/30">
               {cart.map(item => (
                 <div key={item.productId} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <div className="flex-1 min-w-0">
                       <h5 className="text-[11px] font-black text-slate-800 truncate">{item.name}</h5>
                       <p className="text-[9px] font-bold text-slate-400">{(item.unitPrice || 0).toLocaleString()} ج.م</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="flex items-center bg-slate-100 rounded-lg">
                          <button onClick={() => updateCartQty(item.productId, -1)} className="p-2 hover:bg-white rounded-md"><Minus size={12}/></button>
                          <span className="w-8 text-center text-xs font-black">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.productId, 1)} className="p-2 hover:bg-white rounded-md"><Plus size={12}/></button>
                       </div>
                       <span className="text-[11px] font-black text-indigo-600 min-w-[60px] text-left">{(item.subtotal || 0).toLocaleString()}</span>
                    </div>
                 </div>
               ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-100 space-y-3 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
               <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-800">الإجمالي النهائي</span>
                  <span className="text-2xl font-black text-indigo-600">{netTotal.toLocaleString()} <span className="text-[10px] text-slate-400">ج.م</span></span>
               </div>
               <button onClick={handleCheckout} disabled={isCheckoutLoading || cart.length === 0} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isCheckoutLoading ? <RefreshCw className="animate-spin" size={14}/> : <CheckCircle2 size={14}/>} إتمام العملية
               </button>
            </div>
         </div>
         <div className="w-full xl:w-[60%] flex flex-col gap-4 order-1 xl:order-2 min-h-0">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm shrink-0 space-y-4">
               <div className="flex gap-3">
                  <div className="relative flex-1" ref={searchContainerRef}>
                     <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                     <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="ابحث باسم المنتج أو الباركود..." 
                        className="w-full pr-12 pl-4 py-4 bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600 border-2 rounded-2xl outline-none font-bold text-sm transition-all"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setShowSearchResults(true); }}
                     />
                     {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-80 overflow-y-auto z-[100] divide-y">
                           {searchResults.map(p => (
                              <div key={p.id} onClick={() => addToCart(p)} className="flex items-center justify-between p-4 hover:bg-indigo-50 cursor-pointer transition-colors group">
                                 <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                       {p.offerPrice ? <Percent size={18} className="text-rose-600" /> : <Package size={18}/>}
                                    </div>
                                    <div><h5 className="text-sm font-black text-slate-800">{p.name || '---'}</h5><p className="text-[10px] text-slate-400 font-mono">#{p.code || '---'}</p></div>
                                 </div>
                                 <p className="text-sm font-black text-indigo-600">{p.offerPrice || p.retailPrice} ج.م</p>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
                  <button onClick={() => setIsScannerOpen(true)} className="px-5 bg-slate-800 text-white rounded-2xl flex items-center justify-center hover:bg-black transition-all"><Camera size={20}/></button>
               </div>
            </div>
            {isScannerOpen && (
               <div className="fixed inset-0 bg-black z-[5000] flex flex-col items-center justify-center">
                  <div id="reader" className="w-full max-w-lg aspect-square overflow-hidden rounded-3xl bg-slate-900 shadow-2xl"></div>
                  <button onClick={stopScanner} className="mt-8 px-12 py-4 bg-white text-rose-600 font-black rounded-2xl shadow-xl">إغلاق الكاميرا</button>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default Sales;