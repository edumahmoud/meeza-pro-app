
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, LogIn, AlertCircle, Info, DatabaseZap } from 'lucide-react';
import { User as UserType, UserRole } from '../types';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLogin: (user: UserType) => void;
  onIncrementDay?: (userId: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin, onIncrementDay }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSystemEmpty, setIsSystemEmpty] = useState(false);

  // معرف الأدمن الثابت للنظام
  const SYSTEM_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

  useEffect(() => {
    checkUsersExist();
  }, []);

  const checkUsersExist = async () => {
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
    setIsSystemEmpty(count === 0);
  };

  const initializeAdmin = async () => {
    setIsLoading(true);
    try {
      // التأكد من وجود رتبة admin أولاً
      await supabase.from('app_roles').upsert([{ 
        role_key: 'admin', 
        role_name: 'مدير النظام', 
        seniority: 100, 
        is_system: true 
      }]);

      const { error: insertError } = await supabase.from('users').insert([{
        id: SYSTEM_ADMIN_ID,
        username: 'admin',
        password: 'admin_pos_2025',
        full_name: 'مدير النظام الافتراضي',
        role: 'admin',
        salary: 0,
        is_deleted: false
      }]);

      if (insertError) throw insertError;
      
      setIsSystemEmpty(false);
      setError('تمت تهيئة حساب المدير بنجاح. يمكنك الدخول الآن.');
    } catch (err: any) {
      setError('فشل في تهيئة النظام: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error: supabaseError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.trim())
        .single();

      if (supabaseError || !data) {
          throw new Error('بيانات الدخول غير صحيحة أو الحساب غير موجود');
      }

      if (data.is_deleted) throw new Error('عفواً، هذا الحساب معطل حالياً');
      if (data.password !== password) throw new Error('كلمة المرور غير صحيحة');

      if (onIncrementDay && data.role !== 'admin') {
        await onIncrementDay(data.id);
      }

      onLogin({
        id: data.id,
        username: data.username,
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        role: data.role as UserRole,
        salary: Number(data.salary || 0),
        branchId: data.branch_id,
        hasPerformanceTracking: data.has_performance_tracking || false,
        createdAt: new Date(data.created_at).getTime(),
        daysWorkedAccumulated: data.days_worked_accumulated || 0,
        totalDaysWorked: data.total_days_worked || 0
      });
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-['Cairo']" dir="rtl">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-indigo-600 p-10 text-center text-white relative">
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-inner">
            <ShieldCheck size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-black mb-2">ميزة POS</h1>
          <p className="text-indigo-100 text-sm font-bold opacity-80">نظام الإدارة المتكامل للسحابة</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-black border animate-in ${error.includes('بنجاح') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          
          {isSystemEmpty ? (
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center space-y-4">
               <DatabaseZap size={32} className="text-indigo-600 mx-auto animate-pulse" />
               <p className="text-xs font-black text-indigo-900">قاعدة البيانات فارغة تماماً. هل أنت المالك؟</p>
               <button 
                type="button"
                onClick={initializeAdmin}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] shadow-lg hover:bg-indigo-700 transition-all"
               >
                 تفعيل حساب المدير الأول (Seed Admin)
               </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-1">اسم المستخدم</label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold transition-all text-sm"
                    placeholder="admin"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase mr-1">كلمة المرور</label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold transition-all text-sm"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <LogIn size={20} />}
                دخول للنظام
              </button>
            </>
          )}

          <div className="text-center pt-4">
            <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-2">
              <Info size={12} />
              تحقق من اتصالك بالسحابة لضمان الدخول
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
