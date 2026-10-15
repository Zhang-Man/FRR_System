import { useState, useRef, useEffect } from 'react';
import type { UserRole } from '@/types';
import { RoleBadge } from './RoleBadge';
import { useNavigate } from 'react-router';

interface HeaderProps {
  currentRole: UserRole;
  currentUser: { name: string; role: UserRole; avatar: string };
  onLogout?: () => void;
}

export function Header({ currentRole, currentUser, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b border-[#e5e5ea]"
      style={{
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255,255,255,0.85)',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0066cc] flex items-center justify-center flex-shrink-0">
            <img src="/images/logo.jpg" alt="logo" className="w-7 h-7 rounded-lg object-cover" />
          </div>
          <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight">网络故障报修系统</span>
        </div>

        <div className="flex items-center gap-2.5">
          {currentRole === 'admin' ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#e5e5ea] text-[14px] font-medium text-[#1d1d1f] hover:border-[#0066cc] transition-all cursor-pointer"
              >
                <img src={currentUser.avatar} alt={currentUser.name} className="w-6 h-6 rounded-full object-cover" />
                <span className="hidden sm:inline">{currentUser.name}</span>
                <svg className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#e5e5ea] min-w-[200px] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#f5f5f7]">
                    <div className="text-[14px] font-semibold text-[#1d1d1f]">{currentUser.name}</div>
                    <RoleBadge role={currentUser.role} />
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/admin/users'); }}
                    className="w-full text-left px-4 py-3 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    用户管理
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/admin/categories'); }}
                    className="w-full text-left px-4 py-3 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    分类管理
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/admin/stats'); }}
                    className="w-full text-left px-4 py-3 text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer flex items-center gap-2"
                  >
                    数据统计
                  </button>
                  <div className="border-t border-[#f5f5f7]">
                    <button
                      onClick={() => { setMenuOpen(false); onLogout?.(); }}
                      className="w-full text-left px-4 py-3 text-[14px] text-[#ff3b30] hover:bg-[#fff0f0] transition-colors cursor-pointer flex items-center gap-2"
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              <span className="text-[14px] font-medium text-[#1d1d1f] hidden sm:inline">{currentUser.name}</span>
              <RoleBadge role={currentUser.role} />
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-[13px] text-[#86868b] hover:text-[#ff3b30] transition-colors cursor-pointer ml-1"
                >
                  退出
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
