import { useState, type FormEvent } from 'react';
import { t } from '@/i18n';
import api from '@/api';
import { users as mockUsers } from '@/data/mockData';
import { USE_MOCK } from '@/config';

interface LoginPageProps {
  onLogin: (user: { user_id: string; name: string; role: string; phone?: string; department?: string }, token: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId.trim()) {
      setError(t('enterId'));
      return;
    }
    setLoading(true);

    if (USE_MOCK) {
      const matched = mockUsers.find(u => u.user_id === userId.trim() || u.id === userId.trim());
      if (matched) {
        const userData = {
          user_id: matched.user_id || matched.id,
          name: matched.name,
          role: matched.role,
          avatar: matched.avatar,
          phone: matched.phone,
          department: matched.department,
        };
        onLogin(userData, 'mock-token');
      sessionStorage.setItem('token', 'mock-token');
      } else {
        setError('用户不存在，请尝试：u-1（李明/提交人）、u-2（王芳/处理人）、u-3（张伟/管理员）');
      }
      setLoading(false);
      return;
    }

    try {
      const res = await api.post<{ user: { user_id: string; name: string; role: string; phone?: string; department?: string }; token: string }>('/auth/login', { user_id: userId.trim() });
      sessionStorage.setItem('token', res.data.token);
      sessionStorage.setItem('user', JSON.stringify(res.data.user));
      sessionStorage.setItem('role', res.data.user.role);
      onLogin(res.data.user, res.data.token);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err?.response?.data?.error || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-transparent">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0066cc] flex items-center justify-center mx-auto mb-4 shadow-[0_4px_12px_rgba(0,102,204,0.3)]">
            <img src="/images/logo.jpg" alt="logo" className="w-10 h-10 rounded-xl object-cover" />
          </div>
          <h1 className="text-[22px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>
            {t('appTitle')}
          </h1>
          <p className="text-[13px] text-[#86868b] mt-2">{t('loginDesc')}</p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-5">
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder={t('loginPlaceholder')}
              autoFocus
              className="w-full h-12 px-4 rounded-xl bg-white border border-[#e5e5ea] text-[16px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250"
            />
          </div>

          {error && (
            <p className="text-[13px] text-[#ff3b30] mb-4 text-center leading-relaxed">{error}</p>
          )}

          <p className="text-[12px] text-[#d2d2d7] text-center mb-5">{t('loginHint')}</p>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full bg-[#0066cc] text-white text-[15px] font-medium shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? t('loginValidating') : t('loginBtn')}
          </button>
        </form>
      </div>
    </div>
  );
}
