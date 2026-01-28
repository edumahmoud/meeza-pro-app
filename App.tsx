
import React, { useState, useEffect, useCallback } from 'react';
import { ViewType, User as UserType } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Inventory from './components/Inventory';
import Returns from './components/Returns';
import Expenses from './components/Expenses';
import Reports from './components/Reports';
import Archive from './components/Archive';
import RecycleBin from './components/RecycleBin';
import Customers from './components/Customers';
import Purchases from './components/Purchases'; 
import Suppliers from './components/Suppliers';
import Staff from './components/Staff';
import Treasury from './components/Treasury';
import Login from './components/Login';
import UserProfile from './components/UserProfile';
import ITControl from './components/itControl'; 
import DailyLogs from './components/DailyLogs';
import CorrespondenceView from './components/Correspondence';
import ConfirmModal from './components/ConfirmModal';
import { useInventory } from './hooks/useInventory';
import { useSalesData } from './hooks/useSalesData';
import { usePurchaseData } from './hooks/usePurchaseData';
import { useStaffData } from './hooks/useStaffData';
import { useSystemSettings } from './hooks/useSystemSettings';
import { useReturnData } from './hooks/useReturnData';
import { useArchiveData } from './hooks/useArchiveData';
import { useActivityLogs } from './hooks/useActivityLogs';
import { useAuditLogs } from './hooks/useAuditLogs';
import { useShiftData } from './hooks/useShiftData';
import { useCorrespondence } from './hooks/useCorrespondence';
import { useCustomerData } from './hooks/useCustomerData';
import { ShieldAlert } from 'lucide-react';

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  variant: 'danger' | 'warning' | 'info';
}

const App: React.FC = () => {
  const [user, setUser] = useState(null as UserType | null);
  const [currentView, setView] = useState('dashboard' as ViewType);
  const [toast, setToast] = useState(null as { message: string; type: 'success' | 'error' } | null);
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);

  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  } as ConfirmState);
  
  const inventory = useInventory();
  const salesData = useSalesData();
  const purchaseData = usePurchaseData();
  const staffData = useStaffData();
  const returnData = useReturnData();
  const archiveData = useArchiveData();
  const sys = useSystemSettings();
  const logsData = useActivityLogs();
  const audit = useAuditLogs(); 
  const corr = useCorrespondence(user);
  const customers = useCustomerData();
  const { activeShift, openShift, closeShift } = useShiftData(user);

  useEffect(() => {
    const saved = localStorage.getItem('meeza_pos_user');
    if (saved) setUser(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!inventory.loading && !sys.loading) setHasInitialLoaded(true);
  }, [inventory.loading, sys.loading]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const askConfirmation = useCallback((title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmState({ isOpen: true, title, message, onConfirm, variant });
  }, []);

  if (!user) return <Login onLogin={setUser} onIncrementDay={staffData.incrementUserDay} />;

  const renderContent = () => {
    if (!sys.checkPermission(user, currentView as any)) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
           <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center shadow-inner"><ShieldAlert size={48}/></div>
           <h3 className="text-xl font-black text-slate-800">صلاحية وصول محدودة</h3>
           <p className="text-sm text-slate-400 font-bold max-w-xs">يرجى مراجعة الإدارة لتعديل مصفوفة الوصول الخاصة بك.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard invoices={salesData.invoices} returns={returnData.returns} expenses={salesData.expenses} products={inventory.products} staffPayments={staffData.staffPayments} user={user} summaryStats={salesData.summaryStats} suppliers={purchaseData.suppliers} />;
      case 'sales':
        return <Sales products={inventory.products} invoices={salesData.invoices} activeShift={activeShift} branches={staffData.branches} onOpenShift={openShift} onCloseShift={closeShift} onSaveInvoice={salesData.saveInvoice} onDeductStock={inventory.deductStock} onShowToast={showToast} askConfirmation={askConfirmation} user={user} settings={sys.settings} canSell={sys.checkPermission(user, 'sell')} />;
      case 'inventory':
        return <Inventory products={inventory.products} branches={staffData.branches} onUpdateProduct={inventory.updateProduct} onDeleteProduct={inventory.deleteProduct} onShowToast={showToast} askConfirmation={askConfirmation} user={user} canDelete={sys.checkPermission(user, 'delete_product')} onProductClick={() => {}} />;
      case 'returns':
        return <Returns invoices={salesData.invoices} returns={returnData.returns} onAddReturn={returnData.addReturn} onDeleteReturn={() => {}} onRestockItem={inventory.deductStock} onShowToast={showToast} user={user} canReturn={sys.checkPermission(user, 'process_return')} />;
      case 'expenses':
        return <Expenses expenses={salesData.expenses} onAddExpense={salesData.addExpense} onDeleteExpense={salesData.deleteExpense} onShowToast={showToast} user={user} />;
      case 'archive':
        return <Archive invoices={salesData.invoices} branches={staffData.branches} settings={sys.settings} onDeleteInvoice={salesData.deleteInvoice} onShowToast={showToast} askConfirmation={askConfirmation} user={user} canDelete={sys.checkPermission(user, 'delete_invoice')} />;
      case 'staff':
        return <Staff currentUser={user} users={staffData.users} branches={staffData.branches} staffPayments={staffData.staffPayments} leaveRequests={staffData.leaveRequests} invoices={salesData.invoices} expenses={salesData.expenses} returns={returnData.returns} products={inventory.products} roles={sys.roles} settings={sys.settings} onUpdateSettings={sys.updateSettings} onAddUser={staffData.addUser} onUpdateUser={staffData.updateUser} onTransferEmployee={staffData.onTransferEmployee} onUpdateBranch={staffData.updateBranch} onDeleteUser={staffData.deleteUser} onDeleteUserPermanent={staffData.deleteUserPermanent} onDeleteBranch={staffData.deleteBranch} onUpdateUserRole={staffData.updateUserRole} onAddStaffPayment={staffData.addStaffPayment} onResetPassword={staffData.resetUserPassword} onUpdateLeaveStatus={staffData.updateLeaveStatus} onShowToast={showToast} askConfirmation={askConfirmation} onAddBranch={staffData.addBranch} onAddRole={sys.addRole} onDeleteRole={sys.deleteRole} checkPermission={sys.checkPermission} />;
      case 'userProfile':
        return <UserProfile user={user} staffPayments={staffData.staffPayments} invoices={salesData.invoices} branches={staffData.branches} roles={sys.roles} onShowToast={showToast} onUpdateCurrentUser={(updates) => setUser(prev => prev ? {...prev, ...updates} : null)} onAddLeaveRequest={staffData.addLeaveRequest} checkPermission={sys.checkPermission} />;
      case 'treasury':
        return <Treasury invoices={salesData.invoices} expenses={salesData.expenses} branches={staffData.branches} onShowToast={showToast} user={user} />;
      case 'dailyLogs':
        return <DailyLogs logs={logsData.logs} invoices={salesData.invoices} auditLogs={audit.auditLogs} onRefresh={logsData.refresh} user={user} />;
      case 'correspondence':
        return <CorrespondenceView user={user} users={staffData.users} messages={corr.messages} leaveRequests={staffData.leaveRequests} roles={sys.roles} onSendMessage={corr.sendMessage} onAddLeaveRequest={staffData.addLeaveRequest} onShowToast={showToast} askConfirmation={askConfirmation} onUpdateLeaveStatus={staffData.updateLeaveStatus} checkPermission={sys.checkPermission} onMarkAsRead={corr.markAsRead} onUpdateMessageStatus={corr.updateMessageStatus} onDeleteMessagePermanent={corr.deleteMessagePermanent} onClearBox={corr.clearBox} onUpdateLeaveMeta={staffData.updateLeaveMeta} onDeleteLeavePermanent={staffData.deleteLeaveRequestPermanent} onClearLeaves={staffData.clearUserLeaves} />;
      case 'itControl':
        return <ITControl settings={sys.settings} overrides={sys.overrides} roles={sys.roles} onUpdateSettings={sys.updateSettings} onAddOverride={sys.addOverride} onRemoveOverride={sys.removeOverride} onAddRole={sys.addRole} onDeleteRole={sys.deleteRole} onShowToast={showToast} user={user} />;
      case 'reports':
        return <Reports invoices={salesData.invoices} returns={returnData.returns} expenses={salesData.expenses} purchases={purchaseData.purchases} supplierPayments={purchaseData.payments} branches={staffData.branches} user={user} />;
      case 'recycleBin':
        return <RecycleBin archiveRecords={archiveData.archive} onShowToast={showToast} user={user} />;
      case 'customers':
        return <Customers invoices={salesData.invoices} returns={returnData.returns} registeredCustomers={customers.customers} onAddCustomer={customers.addCustomer} onDeleteCustomer={customers.deleteCustomer} onShowToast={showToast} />;
      case 'purchases':
        return (
          <Purchases 
            products={inventory.products} 
            suppliers={purchaseData.suppliers} 
            purchases={purchaseData.purchases} 
            purchaseReturns={purchaseData.purchaseReturns}
            branches={staffData.branches} 
            onAddPurchase={purchaseData.addPurchase} 
            onAddProduct={inventory.addProduct}
            onAddPurchaseReturn={purchaseData.addPurchaseReturn}
            onShowToast={showToast} 
            askConfirmation={askConfirmation} 
            user={user} 
          />
        );
      case 'suppliers':
        return (
          <Suppliers 
            suppliers={purchaseData.suppliers} 
            purchases={purchaseData.purchases} 
            payments={purchaseData.payments} 
            purchaseReturns={purchaseData.purchaseReturns}
            onAddSupplier={purchaseData.addSupplier} 
            onDeleteSupplier={purchaseData.deleteSupplier} 
            onAddSupplierPayment={purchaseData.addSupplierPayment} 
            onShowToast={showToast} 
            askConfirmation={askConfirmation} 
            user={user} 
            checkPermission={sys.checkPermission} 
            quickSettlePurchase={purchaseData.quickSettlePurchase} 
          />
        );
      default:
        return <Dashboard invoices={salesData.invoices} returns={returnData.returns} expenses={salesData.expenses} products={inventory.products} staffPayments={staffData.staffPayments} user={user} summaryStats={salesData.summaryStats} suppliers={purchaseData.suppliers} />;
    }
  };

  return (
    <>
      <Layout currentView={currentView} setView={setView} products={inventory.products} leaveRequests={staffData.leaveRequests} messages={corr.messages} onReset={() => {}} onRestore={() => {}} toast={toast} onCloseToast={() => setToast(null)} user={user} onLogout={() => { setUser(null); localStorage.removeItem('meeza_pos_user'); }} settings={sys.settings} users={staffData.users} roles={sys.roles} branches={staffData.branches} checkPermission={sys.checkPermission}>
        {renderContent()}
      </Layout>
      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </>
  );
};

export default App;
