import { useCallback, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router';
import './App.css';
import { FileDown } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { Header } from '@/components/Header';
import { StatsGrid } from '@/components/StatsGrid';
import { SearchBar } from '@/components/SearchBar';
import { RepairForm } from '@/components/RepairForm';
import { TicketCard } from '@/components/TicketCard';
import { TicketModal } from '@/components/TicketModal';
import { SolutionModal } from '@/components/SolutionModal';
import { Toast } from '@/components/Toast';
import { FilterBar } from '@/components/FilterBar';
import { Pagination } from '@/components/Pagination';
import { LoginPage } from '@/pages/LoginPage';
import type { UserRole } from '@/types';

const AdminCategoriesPage = lazy(() => import('@/pages/AdminCategoriesPage').then(m => ({ default: m.AdminCategoriesPage })));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminStatsPage = lazy(() => import('@/pages/AdminStatsPage').then(m => ({ default: m.AdminStatsPage })));

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function App() {
  const store = useStore();
  const navigate = useNavigate();

  const handleLogin = useCallback((userData: { user_id: string; name: string; role: string; phone?: string; department?: string }, _token: string) => {
    store.login(userData, _token);
    const roleRoutes: Record<string, string> = { submitter: '/submitter', handler: '/handler', admin: '/admin' };
    navigate(roleRoutes[userData.role] || '/');
  }, [store, navigate]);

  const handleLogout = useCallback(() => {
    store.logout();
    navigate('/login');
  }, [store, navigate]);

  const headerUser = useMemo(() => ({
    name: store.currentUser?.name ?? '',
    role: (store.currentUser?.role ?? 'submitter') as UserRole,
    avatar: store.currentUser?.avatar ?? '',
  }), [store.currentUser?.name, store.currentUser?.role, store.currentUser?.avatar]);

  if (!store.initDone) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store.currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const currentUser = store.currentUser;
  const currentRole = currentUser.role as UserRole;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/admin/users"
          element={
            <Suspense fallback={<PageLoading />}>
              <Header
                currentRole="admin"
                currentUser={headerUser}
                onLogout={handleLogout}
              />
              <AdminUsersPage
                users={store.userList}
                onImport={store.importUsers}
                onDelete={store.deleteUser}
                currentUserId={currentUser.user_id || currentUser.id}
              />
            </Suspense>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <Suspense fallback={<PageLoading />}>
              <Header
                currentRole="admin"
                currentUser={headerUser}
                onLogout={handleLogout}
              />
              <AdminCategoriesPage
                categories={store.categories}
                onAdd={store.addCategory}
                onDelete={store.deleteCategory}
              />
            </Suspense>
          }
        />
        <Route
          path="/admin/stats"
          element={
            <Suspense fallback={<PageLoading />}>
              <Header
                currentRole="admin"
                currentUser={headerUser}
                onLogout={handleLogout}
              />
              <AdminStatsPage />
            </Suspense>
          }
        />
        <Route
          path="/*"
          element={
            <>
              <Header
                currentRole={currentRole}
                currentUser={headerUser}
                onLogout={handleLogout}
              />
              <main className="max-w-[1200px] mx-auto px-6 py-8">
                {currentRole === 'admin' && <StatsGrid stats={store.stats} />}

                {currentRole === 'submitter' && (
                  <RepairForm
                    categories={store.categories}
                    onSubmit={store.addTicket}
                  />
                )}

                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>
                      {currentRole === 'submitter' ? '我的工单' : '工单列表'}
                    </h2>
                    <p className="text-[13px] text-[#86868b] mt-1">
                      共 {store.filteredTickets.length} 条记录
                    </p>
                  </div>
                  {currentRole === 'admin' && (
                    <button
                      onClick={store.exportToCSV}
                      className="h-10 px-5 rounded-full bg-white border border-[#e5e5ea] text-[#0066cc] text-[13px] font-medium flex items-center gap-2 hover:bg-[#f0f7ff] hover:border-[#0066cc] transition-all duration-250 cursor-pointer"
                    >
                      <FileDown className="w-4 h-4" />
                      导出记录
                    </button>
                  )}
                </div>

                {currentRole === 'admin' && (
                  <FilterBar
                    startDate={store.filterStart}
                    endDate={store.filterEnd}
                    status={store.filterStatus}
                    onStartChange={store.setFilterStart}
                    onEndChange={store.setFilterEnd}
                    onStatusChange={store.setFilterStatus}
                    onApply={() => { store.setPage(1); store.fetchTickets(); }}
                  />
                )}

                <SearchBar value={store.searchQuery} onChange={store.setSearchQuery} />

                <div className="space-y-3">
                  {store.filteredTickets.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-[16px] font-medium text-[#86868b]">暂无工单记录</p>
                      <p className="text-[13px] text-[#d2d2d7] mt-1">您可以切换角色查看不同数据</p>
                    </div>
                  ) : (
                    store.pagedTickets.map((ticket, index) => (
                      <div
                        key={ticket.id}
                        className="animate-fadeInUp"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TicketCard
                          ticket={ticket}
                          userRole={currentRole}
                          onClick={() => {
                            store.setSelectedTicket(ticket);
                            store.setDetailModalOpen(true);
                          }}
                          onResolve={() => {
                            store.setSelectedTicket(ticket);
                            store.setSolutionModalOpen(true);
                          }}
                          onClaim={() => store.claimTicket(ticket.id)}
                          showClaim={currentRole === 'handler'}
                        />
                      </div>
                    ))
                  )}
                </div>

                <Pagination
                  current={store.page}
                  total={store.filteredTickets.length}
                  pageSize={store.pageSize}
                  onChange={store.setPage}
                />
              </main>

              {store.detailModalOpen && store.selectedTicket ? (
                <TicketModal
                  ticket={store.selectedTicket}
                  userRole={currentRole}
                  onClose={() => { store.setDetailModalOpen(false); store.setSelectedTicket(null); }}
                  onResolve={() => { store.setDetailModalOpen(false); store.setSolutionModalOpen(true); }}
                />
              ) : null}

              {store.solutionModalOpen && store.selectedTicket ? (
                <SolutionModal
                  onClose={() => { store.setSolutionModalOpen(false); store.setSelectedTicket(null); }}
                  onConfirm={(solution, collaboratorIds) => {
                    if (store.selectedTicket) {
                      store.resolveTicket(store.selectedTicket.id, solution, collaboratorIds);
                      store.setSelectedTicket(null);
                    }
                  }}
                  currentUserId={store.currentUser?.user_id}
                />
              ) : null}

              <Toast toast={store.toast} />
            </>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
