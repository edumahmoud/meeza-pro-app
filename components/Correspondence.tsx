
import React, { useState, useMemo } from 'react';
import { 
  Mail, Send, Search, Users, ShieldCheck, Briefcase, Clock, Calendar, 
  MessageSquare, UserCircle, Bell, ArrowRight, X, Power, UserPlus, 
  CheckCircle2, AlertTriangle, Filter, ChevronLeft, Plus, Smartphone, Reply, 
  User as UserIcon, Building2, Fingerprint, Trash2, Eraser, Archive, RotateCcw, Box, Star, RefreshCw, BellRing, Inbox, ClipboardCheck, CornerUpLeft, FileText, ListChecks,
  UserCheck, BadgeCheck
} from 'lucide-react';
import { Correspondence, User, LeaveRequest, UserRole } from '../types';

interface CorrespondenceProps {
  user: User;
  users: User[]; 
  messages: any[]; 
  leaveRequests: LeaveRequest[];
  roles: any[];
  onSendMessage: (msg: Omit<Correspondence, 'id' | 'timestamp' | 'isRead'>, secondaryId?: string) => Promise<void>;
  onAddLeaveRequest: (req: Omit<LeaveRequest, 'id' | 'timestamp' | 'status'>) => Promise<void>;
  onMarkAsRead: (id: string) => Promise<void>;
  onUpdateMessageStatus: (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => Promise<void>;
  onDeleteMessagePermanent: (id: string) => Promise<void>;
  onClearBox: (type: 'inbox' | 'sent') => Promise<void>;
  onUpdateLeaveMeta: (id: string, updates: { isArchived?: boolean, isDeleted?: boolean }) => Promise<void>;
  onDeleteLeavePermanent: (id: string) => Promise<void>;
  onClearLeaves: (userId: string) => Promise<void>;
  onShowToast: (m: string, t: 'success' | 'error') => void;
  askConfirmation: (title: string, message: string, onConfirm: () => void, variant?: 'danger' | 'warning' | 'info') => void;
  onUpdateLeaveStatus?: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onEmptyTrash?: () => Promise<void>;
  checkPermission: (user: any, action: any) => boolean;
}

const CorrespondenceView: React.FC<CorrespondenceProps> = ({ 
  user, users, messages, leaveRequests, roles, 
  onSendMessage, onAddLeaveRequest, onMarkAsRead, 
  onUpdateMessageStatus, onDeleteMessagePermanent, onClearBox, 
  onUpdateLeaveMeta, onDeleteLeavePermanent, onClearLeaves, onShowToast,
  askConfirmation, onUpdateLeaveStatus, onEmptyTrash, checkPermission
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'requests' | 'myLeaves' | 'sent' | 'archive' | 'trash'>('inbox');
  const [isNewMsgOpen, setIsNewMsgOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<any | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');

  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [msgForm, setMsgForm] = useState({ subject: '', content: '', isBroadcast: false });
  const [leaveForm, setLeaveForm] = useState({ type: 'normal' as 'normal' | 'emergency', startDate: '', endDate: '', reason: '', targetRole: '' });

  const canApprove = useMemo(() => checkPermission(user, 'approve_leaves'), [user, checkPermission]);

  const filteredInbox = useMemo(() => {
    return messages.filter(m => 
      m.senderId !== user.id && 
      (m.receiverId === user.id || m.receiverRole === user.role || m.receiverRole === 'all' || m.isBroadcast) &&
      !m.isArchived && !m.isDeleted
    ).map(m => ({ ...m, itemType: 'message' }));
  }, [messages, user]);

  const incomingRequests = useMemo(() => {
    if (!canApprove) return [];
    return leaveRequests.filter(l => {
      const isPending = l.status === 'pending' && !l.isArchived && !l.isDeleted && l.userId !== user.id;
      if (!isPending) return false;
      if (user.role !== 'admin' && user.branchId) {
        const requester = users.find(u => u.id === l.userId);
        return requester?.branchId === user.branchId;
      }
      return true;
    }).map(l => ({ ...l, itemType: 'leave' }));
  }, [leaveRequests, user, canApprove, users]);

  const myLeaves = useMemo(() => {
    return leaveRequests.filter(l => l.userId === user.id && !l.isDeleted).map(l => ({ ...l, itemType: 'leave' }));
  }, [leaveRequests, user.id]);

  const trashItems = useMemo(() => {
    const msgs = messages.filter(m => m.isDeleted && (m.senderId === user.id || m.receiverId === user.id)).map(m => ({ ...m, itemType: 'message' }));
    const leaves = leaveRequests.filter(l => l.userId === user.id && l.isDeleted).map(l => ({ ...l, itemType: 'leave' }));
    return [...msgs, ...leaves].sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, leaveRequests, user]);

  const handleSendMessage = async () => {
    if (!msgForm.isBroadcast && selectedRecipients.length === 0) return onShowToast("حدد مستلم واحد على الأقل", "error");
    if (!msgForm.subject || !msgForm.content) return onShowToast("أكمل بيانات الرسالة", "error");

    setIsSubmitting(true);
    try {
      if (msgForm.isBroadcast) {
        await onSendMessage({ senderId: user.id, senderName: user.fullName, senderRole: user.role, receiverRole: 'all', subject: msgForm.subject, content: msgForm.content, isBroadcast: true });
      } else {
        for (const recipient of selectedRecipients) {
          await onSendMessage({ senderId: user.id, senderName: user.fullName, senderRole: user.role, receiverRole: recipient.role, receiverId: recipient.id, subject: msgForm.subject, content: msgForm.content, isBroadcast: false });
        }
      }
      onShowToast("تم الإرسال بنجاح", "success");
      setIsNewMsgOpen(false);
      setMsgForm({ subject: '', content: '', isBroadcast: false });
      setSelectedRecipients([]);
    } catch (e: any) { onShowToast(`خطأ في الإرسال`, "error"); } 
    finally { setIsSubmitting(false); }
  };

  const handleLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) return onShowToast("يرجى إكمال بيانات الإجازة", "error");
    setIsSubmitting(true);
    try {
      await onAddLeaveRequest({ userId: user.id, userName: user.fullName, userRole: user.role, startDate: leaveForm.startDate, endDate: leaveForm.endDate, reason: leaveForm.reason, type: leaveForm.type, targetRole: leaveForm.targetRole || undefined });
      onShowToast("تم تقديم طلب الإجازة", "success");
      setIsLeaveOpen(false);
      setLeaveForm({ type: 'normal', startDate: '', endDate: '', reason: '', targetRole: '' });
    } catch (e) { onShowToast("فشل التقديم", "error"); }
    finally { setIsSubmitting(false); }
  };

  const currentList = useMemo(() => {
    switch(activeTab) {
      case 'inbox': return [...filteredInbox].sort((a,b) => b.timestamp - a.timestamp);
      case 'requests': return [...incomingRequests].sort((a,b) => b.timestamp - a.timestamp);
      case 'myLeaves': return [...myLeaves].sort((a,b) => b.timestamp - a.timestamp);
      case 'sent': return messages.filter(m => m.senderId === user.id && !m.isArchived && !m.isDeleted).map(m => ({ ...m, itemType: 'message' }));
      case 'archive': return [...messages.filter(m => m.isArchived && !m.isDeleted && (m.senderId === user.id || m.receiverId === user.id)), ...leaveRequests.filter(l => l.userId === user.id && l.isArchived)].sort((a, b) => b.timestamp - a.timestamp);
      case 'trash': return trashItems;
      default: return [];
    }
  }, [activeTab, filteredInbox, incomingRequests, myLeaves, messages, leaveRequests, trashItems, user.id]);

  const userOptions = useMemo(() => {
    if (!userSearchTerm) return [];
    return users.filter(u => u.id !== user.id && !u.isDeleted && (u.fullName.includes(userSearchTerm) || u.username.includes(userSearchTerm))).slice(0, 5);
  }, [users, userSearchTerm, user.id]);

  return (
    <div className="space-y-8 animate-in font-['Cairo'] pb-12 select-text" dir="rtl">
      {/* Header Actions */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 relative z-10">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
          <button onClick={() => setActiveTab('inbox')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'inbox' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Inbox size={14}/> الوارد</button>
          {canApprove && (
            <button onClick={() => setActiveTab('requests')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'requests' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>
              <ClipboardCheck size={14}/> مراجعة الطلبات {incomingRequests.length > 0 && <span className="px-1.5 bg-rose-500 text-white rounded text-[8px] animate-bounce">{incomingRequests.length}</span>}
            </button>
          )}
          <button onClick={() => setActiveTab('myLeaves')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'myLeaves' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}><ListChecks size={14}/> طلباتي</button>
          <button onClick={() => setActiveTab('sent')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'sent' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Send size={14}/> المرسلة</button>
          <button onClick={() => setActiveTab('archive')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'archive' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}><Archive size={14}/> الأرشيف</button>
          <button onClick={() => setActiveTab('trash')} className={`flex-1 min-w-[100px] py-3 px-6 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'trash' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}><Trash2 size={14}/> السلة</button>
        </div>
        <div className="flex gap-3 shrink-0">
           <button onClick={() => setIsLeaveOpen(true)} className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-black rounded-xl text-[10px] flex items-center gap-2 hover:bg-indigo-50 shadow-sm transition-all"><Plus size={16}/> طلب إجازة</button>
           <button onClick={() => setIsNewMsgOpen(true)} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl text-[10px] flex items-center gap-2 shadow-lg hover:bg-indigo-700 transition-all"><Send size={16}/> مراسلة جديدة</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="divide-y divide-slate-50">
           {currentList.map(item => {
             const isMsg = (item as any).itemType === 'message';
             const d = item as any;
             const statusColor = d.status === 'approved' ? 'text-emerald-500' : d.status === 'rejected' ? 'text-rose-500' : 'text-amber-500';
             return (
               <div key={d.id} className={`p-6 flex items-center gap-6 group hover:bg-slate-50/50 transition-all ${isMsg && !d.isRead && activeTab === 'inbox' ? 'bg-indigo-50/30 border-r-4 border-indigo-600' : ''}`}>
                  <div onClick={() => { if(isMsg) { setSelectedMsg(d); if(activeTab === 'inbox') onMarkAsRead(d.id); } else { setSelectedLeave(d); } }} className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 shadow-inner cursor-pointer ${isMsg ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                    {isMsg ? (activeTab === 'sent' ? <Send size={20}/> : (d.senderName?.[0] || 'M')) : <BellRing size={20} className="text-amber-500"/>}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { if(isMsg) { setSelectedMsg(d); if(activeTab === 'inbox') onMarkAsRead(d.id); } else { setSelectedLeave(d); } }}>
                     <h4 className="font-black text-slate-800 text-xs truncate">{isMsg ? d.subject : `إجازة: ${d.userName}`} {!isMsg && <span className={`mr-2 text-[8px] font-black uppercase ${statusColor}`}>[{d.status}]</span>}</h4>
                     <p className="text-[10px] text-slate-400 font-bold truncate">{isMsg ? `من: ${d.senderName}` : `الفترة: ${d.startDate} إلى ${d.endDate}`}</p>
                  </div>
                  <div className="text-left shrink-0 flex items-center gap-6">
                     <p className="hidden sm:block text-[9px] font-black text-slate-300">{new Date(d.timestamp).toLocaleDateString('ar-EG')}</p>
                     {activeTab === 'requests' && !isMsg ? (
                       <div className="flex gap-2">
                          <button onClick={async (e) => { e.stopPropagation(); if(onUpdateLeaveStatus) await onUpdateLeaveStatus(d.id, 'approved'); }} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><CheckCircle2 size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedLeave(d); }} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"><X size={14}/></button>
                       </div>
                     ) : null}
                  </div>
               </div>
             );
           })}
           {currentList.length === 0 && (
             <div className="py-32 text-center text-slate-300">
                <Box size={48} className="mx-auto mb-4 opacity-20"/>
                <p className="text-xs font-black uppercase tracking-widest">لا توجد سجلات متاحة في هذا القسم</p>
             </div>
           )}
        </div>
      </div>

      {/* New Message Modal - HIGH Z-INDEX */}
      {isNewMsgOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-2"><Send size={16}/> إنشاء مراسلة جديدة</h3>
                 <button onClick={() => setIsNewMsgOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-4">
                 <div className="flex items-center gap-2 mb-2">
                   <button onClick={() => setMsgForm({...msgForm, isBroadcast: !msgForm.isBroadcast})} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${msgForm.isBroadcast ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>إرسال للجميع (Broadcast)</button>
                 </div>
                 {!msgForm.isBroadcast && (
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase">المستلمون</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                         {selectedRecipients.map(r => (
                           <span key={r.id} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black flex items-center gap-2">
                              {r.fullName}
                              <X size={10} className="cursor-pointer" onClick={() => setSelectedRecipients(prev => prev.filter(p => p.id !== r.id))}/>
                           </span>
                         ))}
                      </div>
                      <div className="relative">
                         <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                         <input type="text" placeholder="بحث عن موظف..." className="w-full pr-9 pl-4 py-3 bg-slate-50 border rounded-xl font-bold text-xs" value={userSearchTerm} onChange={e=>setUserSearchTerm(e.target.value)} onFocus={()=>setShowUserDropdown(true)}/>
                         {showUserDropdown && userOptions.length > 0 && (
                           <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-20 overflow-hidden divide-y">
                              {userOptions.map(u => (
                                <button key={u.id} onClick={() => { setSelectedRecipients(prev => [...prev, u]); setUserSearchTerm(''); setShowUserDropdown(false); }} className="w-full p-3 text-right hover:bg-slate-50 flex items-center gap-3">
                                   <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-black text-[10px]">{u.fullName[0]}</div>
                                   <div><p className="text-xs font-black">{u.fullName}</p><p className="text-[9px] text-slate-400 uppercase">{u.role}</p></div>
                                </button>
                              ))}
                           </div>
                         )}
                      </div>
                   </div>
                 )}
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">موضوع الرسالة</label><input type="text" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={msgForm.subject} onChange={e=>setMsgForm({...msgForm, subject:e.target.value})} /></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">المحتوى</label><textarea className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs h-32 resize-none" value={msgForm.content} onChange={e=>setMsgForm({...msgForm, content:e.target.value})} /></div>
                 <button onClick={handleSendMessage} disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all mt-4">
                    {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'إرسال الرسالة الآن'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Leave Request Modal - HIGH Z-INDEX */}
      {isLeaveOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in">
              <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm flex items-center gap-2"><Calendar size={16}/> تقديم طلب إجازة</h3>
                 <button onClick={() => setIsLeaveOpen(false)}><X size={24}/></button>
              </div>
              <div className="p-8 space-y-4">
                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setLeaveForm({...leaveForm, type: 'normal'})} className={`p-4 rounded-xl text-[10px] font-black border-2 transition-all ${leaveForm.type === 'normal' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 border-transparent text-slate-400'}`}>إجازة اعتيادية</button>
                    <button onClick={() => setLeaveForm({...leaveForm, type: 'emergency'})} className={`p-4 rounded-xl text-[10px] font-black border-2 transition-all ${leaveForm.type === 'emergency' ? 'bg-rose-50 border-rose-500 text-rose-600' : 'bg-slate-50 border-transparent text-slate-400'}`}>إجازة مرضية / طارئة</button>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">تاريخ البدء</label><input type="date" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.startDate} onChange={e=>setLeaveForm({...leaveForm, startDate:e.target.value})} /></div>
                    <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">تاريخ العودة</label><input type="date" className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs" value={leaveForm.endDate} onChange={e=>setLeaveForm({...leaveForm, endDate:e.target.value})} /></div>
                 </div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase">السبب / التفاصيل</label><textarea className="w-full p-3.5 bg-slate-50 border rounded-xl font-black text-xs h-24 resize-none" value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm, reason:e.target.value})} /></div>
                 <button onClick={handleLeaveSubmit} disabled={isSubmitting} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-emerald-700 transition-all mt-4">
                    {isSubmitting ? <RefreshCw className="animate-spin mx-auto" size={18}/> : 'تقديم الطلب للمراجعة'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Detail Viewer Modal */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[3100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 space-y-6">
                 <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100">{selectedMsg.senderName[0]}</div>
                       <div>
                          <h2 className="text-xl font-black text-slate-800">{selectedMsg.subject}</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">من: {selectedMsg.senderName} ({selectedMsg.senderRole})</p>
                       </div>
                    </div>
                    <button onClick={() => setSelectedMsg(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24}/></button>
                 </div>
                 <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 min-h-[150px]">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed whitespace-pre-line">{selectedMsg.content}</p>
                 </div>
                 <div className="flex justify-between items-center text-[10px] font-black text-slate-300">
                    <span>{new Date(selectedMsg.timestamp).toLocaleString('ar-EG')}</span>
                    <div className="flex gap-3">
                       <button onClick={() => { onUpdateMessageStatus(selectedMsg.id, { isDeleted: true }); setSelectedMsg(null); }} className="text-rose-400 hover:text-rose-600">نقل للسلة</button>
                       <button onClick={() => { onUpdateMessageStatus(selectedMsg.id, { isArchived: true }); setSelectedMsg(null); }} className="text-indigo-400 hover:text-indigo-600">أرشفة</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Leave Detail / Action Modal */}
      {selectedLeave && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[3100] flex items-center justify-center p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 space-y-6">
                 <div className="flex justify-between items-center border-b pb-4">
                    <h3 className="font-black text-sm text-slate-800">تفاصيل طلب الإجازة</h3>
                    <button onClick={() => { setSelectedLeave(null); setRejectionNote(''); }}><X size={24}/></button>
                 </div>
                 <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                       <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center"><UserIcon size={20}/></div>
                       <div><p className="text-[10px] font-black text-slate-400">الموظف</p><p className="text-xs font-black">{selectedLeave.userName}</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">من تاريخ</p>
                          <p className="text-xs font-black">{selectedLeave.startDate}</p>
                       </div>
                       <div className="p-4 bg-slate-50 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">إلى تاريخ</p>
                          <p className="text-xs font-black">{selectedLeave.endDate}</p>
                       </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                       <p className="text-[10px] font-black text-slate-400 mb-1">السبب المذكور</p>
                       <p className="text-xs font-bold text-slate-600">{selectedLeave.reason}</p>
                    </div>
                 </div>

                 {selectedLeave.status === 'pending' && canApprove && selectedLeave.userId !== user.id ? (
                   <div className="pt-6 border-t space-y-3">
                      <div className="flex gap-3">
                         <button onClick={async () => { if(onUpdateLeaveStatus) await onUpdateLeaveStatus(selectedLeave.id, 'approved'); setSelectedLeave(null); }} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-emerald-700 transition-all">موافقة</button>
                         <button onClick={async () => { if(onUpdateLeaveStatus) await onUpdateLeaveStatus(selectedLeave.id, 'rejected'); setSelectedLeave(null); }} className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-rose-700 transition-all">رفض</button>
                      </div>
                   </div>
                 ) : (
                    <div className="pt-4 text-center">
                       <span className={`px-6 py-2 rounded-xl text-xs font-black uppercase ${selectedLeave.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : selectedLeave.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>الحالة: {selectedLeave.status}</span>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CorrespondenceView;
