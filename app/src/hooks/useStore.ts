import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Ticket, User, ToastState, TicketStatus, Category, Stats } from '@/types';
import { initialTickets, categories as mockCategories, users } from '@/data/mockData';
import api from '@/api';
import { USE_MOCK } from '@/config';

const AUTH_KEY = 'frr_auth';
const EXPIRY_DAYS = 7;

interface AuthData {
  user: Record<string, unknown>;
  token: string;
  timestamp: number;
}

function saveAuth(userData: object, token: string) {
  const data: AuthData = { user: { ...userData }, token, timestamp: Date.now() };
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadAuth(): AuthData | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AuthData;
    const ageMs = Date.now() - data.timestamp;
    if (ageMs > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

function clearAuth() {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ }
}

function formatDateTime(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
}

function formatDateStr(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function useStore() {
  const [tickets, setTickets] = useState<Ticket[]>(USE_MOCK ? initialTickets : []);
  const [categories, setCategories] = useState<Category[]>(USE_MOCK ? mockCategories : []);
  const [userList, setUserList] = useState<User[]>(USE_MOCK ? users : []);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '', type: 'success' });
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [solutionModalOpen, setSolutionModalOpen] = useState(false);
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ visible: true, message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const getErrorMsg = (e: unknown, fallback: string) => {
    const err = e as { response?: { data?: { error?: string } } };
    return err?.response?.data?.error || fallback;
  };

  const fetchTickets = useCallback(async () => {
    if (USE_MOCK) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterStart) params.start_date = filterStart;
      if (filterEnd) params.end_date = filterEnd;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get<Ticket[]>('/tickets', { params });
      setTickets(res.data);
    } catch (e) {
      showToast(getErrorMsg(e, '加载工单失败'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStart, filterEnd, filterStatus, showToast]);

  const fetchCategories = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const res = await api.get<Category[]>('/categories');
      setCategories(res.data);
    } catch (e) {
      showToast(getErrorMsg(e, '加载分类失败'), 'error');
    }
  }, [showToast]);

  const fetchUsers = useCallback(async () => {
    if (USE_MOCK) return;
    try {
      const res = await api.get<User[]>('/users');
      setUserList(res.data);
    } catch (e) {
      showToast(getErrorMsg(e, '加载用户失败'), 'error');
    }
  }, [showToast]);

  const addTicket = useCallback(async (ticketData: { contact: string; location: string; category: string; description: string }) => {
    if (USE_MOCK) {
      const newTicket: Ticket = {
        id: Date.now(),
        reporter_id: currentUser?.user_id || '',
        reporter_name: currentUser?.name || '',
        contact: ticketData.contact,
        location: ticketData.location,
        category: ticketData.category,
        description: ticketData.description,
        status: 'pending',
        created_at: formatDateTime(new Date()),
      };
      setTickets(prev => [newTicket, ...prev]);
      showToast('工单提交成功');
      return;
    }
    try {
      await api.post('/tickets', ticketData);
      showToast('工单提交成功');
      fetchTickets();
    } catch (e) {
      showToast(getErrorMsg(e, '提交失败'), 'error');
    }
  }, [currentUser, showToast, fetchTickets]);

  const resolveTicket = useCallback(async (ticketId: number, solution: string, collaboratorIds: string[] = []) => {
    if (USE_MOCK) {
      const completedAt = formatDateTime(new Date());
      setTickets(prev => prev.map(t =>
        t.id === ticketId ? { ...t, status: 'resolved' as const, solution, completed_at: completedAt } : t
      ));
      setSolutionModalOpen(false);
      setDetailModalOpen(false);
      showToast('工单已标记为已解决');
      return;
    }
    try {
      await api.put(`/tickets/${ticketId}/complete`, { solution, collaborator_ids: collaboratorIds });
      setSolutionModalOpen(false);
      setDetailModalOpen(false);
      showToast('工单已标记为已解决');
      fetchTickets();
    } catch (e) {
      showToast(getErrorMsg(e, '处理失败'), 'error');
    }
  }, [showToast, fetchTickets]);

  const claimTicket = useCallback(async (ticketId: number) => {
    if (USE_MOCK) {
      setTickets(prev => prev.map(t =>
        t.id === ticketId
          ? { ...t, status: 'processing' as const, assignee_id: currentUser?.user_id || '', assignee_name: currentUser?.name || '' }
          : t
      ));
      showToast('工单已认领');
      return;
    }
    try {
      await api.put(`/tickets/${ticketId}/claim`);
      showToast('工单已认领');
      fetchTickets();
    } catch (e) {
      showToast(getErrorMsg(e, '认领失败'), 'error');
    }
  }, [currentUser, showToast, fetchTickets]);

  const addCategory = useCallback(async (name: string) => {
    if (USE_MOCK) {
      setCategories(prev => [...prev, { id: Date.now(), name }]);
      showToast('分类添加成功');
      return;
    }
    try {
      await api.post('/categories', { name });
      showToast('分类添加成功');
      fetchCategories();
    } catch (e) {
      showToast(getErrorMsg(e, '添加失败'), 'error');
    }
  }, [showToast, fetchCategories]);

  const deleteCategory = useCallback(async (id: number | string, name: string) => {
    if (!window.confirm(`确定要删除分类 "${name}"？`)) return;
    if (USE_MOCK) {
      setCategories(prev => prev.filter(c => c.id !== id));
      showToast('分类已删除');
      return;
    }
    try {
      await api.delete(`/categories/${id}`);
      showToast('分类已删除');
      fetchCategories();
    } catch (e) {
      showToast(getErrorMsg(e, '删除失败'), 'error');
    }
  }, [showToast, fetchCategories]);

  const importUsers = useCallback(async (userData: { user_id: string; name: string; role: string; phone: string; department: string }[]) => {
    if (USE_MOCK) {
      const now = Date.now();
      const newUsers: User[] = userData.map((u, i) => ({
        id: `import-${now}-${i}`,
        user_id: u.user_id,
        name: u.name,
        role: u.role as User['role'],
        avatar: '/images/avatar1.jpg',
        phone: u.phone,
        department: u.department,
      }));
      setUserList(prev => [...newUsers, ...prev]);
      showToast(`成功导入 ${userData.length} 人`);
      return;
    }
    try {
      const res = await api.post<{ imported: number; errors: string[] }>('/users/import', { users: userData });
      let msg = `成功导入 ${res.data.imported} 人`;
      if (res.data.errors.length > 0) msg += `，${res.data.errors.length} 条失败`;
      showToast(msg);
      fetchUsers();
    } catch (e) {
      showToast(getErrorMsg(e, '导入失败'), 'error');
    }
  }, [showToast, fetchUsers]);

  const deleteUser = useCallback(async (id: string) => {
    if (!window.confirm('确定要删除该用户吗？')) return;
    if (USE_MOCK) {
      setUserList(prev => prev.filter(u => u.id !== id));
      showToast('用户已删除');
      return;
    }
    try {
      await api.delete(`/users/${id}`);
      showToast('用户已删除');
      fetchUsers();
    } catch (e) {
      showToast(getErrorMsg(e, '删除失败'), 'error');
    }
  }, [showToast, fetchUsers]);

  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return sortedTickets;
    const lowerQ = q.toLowerCase();
    return sortedTickets.filter(t =>
      String(t.id).includes(lowerQ) ||
      t.reporter_name.toLowerCase().includes(lowerQ) ||
      t.location.toLowerCase().includes(lowerQ) ||
      t.category.toLowerCase().includes(lowerQ)
    );
  }, [sortedTickets, searchQuery]);

  const pagedTickets = useMemo(
    () => filteredTickets.slice((page - 1) * pageSize, page * pageSize),
    [filteredTickets, page]
  );

  const todayStr = useMemo(() => formatDateStr(new Date()), []);

  const stats: Stats = useMemo(() => {
    const today = formatDateStr(new Date());
    const result: Stats = { total: tickets.length, pending: 0, processing: 0, resolved: 0, today: 0 };
    for (const t of tickets) {
      if (t.status === 'pending') result.pending++;
      else if (t.status === 'processing') result.processing++;
      else if (t.status === 'resolved') result.resolved++;
      if (t.created_at.startsWith(today)) result.today++;
    }
    return result;
  }, [tickets, todayStr]);

  const exportToCSV = useCallback(async () => {
    if (USE_MOCK) {
      const headers = ['ID', '报修人', '报修人工号', '电话', '位置', '故障类型', '描述', '提交时间', '状态', '处理人', '协作者', '接单人工号', '处理方案'];
      const statusMap: Record<string, string> = { resolved: '已解决', processing: '处理中', pending: '待处理' };
      const rows = sortedTickets.map(t => [
        String(t.id), t.reporter_name, t.reporter_id || '-', t.contact, t.location, t.category,
        t.description, t.created_at, statusMap[t.status],
        t.assignee_name || '', (t.collaborators || []).map(c => c.user_name).join('、'),
        t.assignee_id || '-', t.solution || '',
      ]);
      const csvContent = '\uFEFF' + [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `工单记录_${formatDateStr(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('CSV 导出成功');
      return;
    }
    try {
      const params: Record<string, string> = {};
      if (filterStart) params.start_date = filterStart;
      if (filterEnd) params.end_date = filterEnd;
      const res = await api.get('/tickets/export', { params, responseType: 'blob' });
      const blob = res.data as unknown as Blob;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `工单记录_${formatDateStr(new Date())}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast('CSV 导出成功');
    } catch (e) {
      showToast(getErrorMsg(e, '导出失败'), 'error');
    }
  }, [sortedTickets, filterStart, filterEnd, showToast]);

  const initialLoadDone = useRef(false);

  const login = useCallback((userData: { user_id: string; name: string; role: string; avatar?: string; phone?: string; department?: string }, token: string) => {
    setCurrentUser({
      id: userData.user_id,
      user_id: userData.user_id,
      name: userData.name,
      role: userData.role as User['role'],
      avatar: userData.avatar || '/images/avatar1.jpg',
      phone: userData.phone,
      department: userData.department,
    });
    sessionStorage.setItem('token', token);
    saveAuth(userData, token);
    initialLoadDone.current = false;
    setSearchQuery('');
    setFilterStart('');
    setFilterEnd('');
    setFilterStatus('');
    setPage(1);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setTickets(USE_MOCK ? initialTickets : []);
    setCategories(USE_MOCK ? mockCategories : []);
    setUserList(USE_MOCK ? users : []);
    initialLoadDone.current = false;
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('role');
    clearAuth();
  }, []);

  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    const auth = loadAuth();
    if (auth) {
      const u = auth.user as Record<string, string>;
      setCurrentUser({
        id: u.user_id || u.id || '',
        user_id: u.user_id,
        name: u.name || '',
        role: (u.role || 'submitter') as User['role'],
        avatar: u.avatar || '/images/avatar1.jpg',
        phone: u.phone,
        department: u.department,
      });
      sessionStorage.setItem('token', auth.token);
    }
    setInitDone(true);
  }, []);

  useEffect(() => {
    if (!USE_MOCK && currentUser && !initialLoadDone.current) {
      initialLoadDone.current = true;
      const promises = [fetchTickets(), fetchCategories()];
      if (currentUser.role === 'admin') promises.push(fetchUsers());
      Promise.all(promises).catch(() => {});
    }
  }, [currentUser, fetchTickets, fetchCategories, fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  return {
    tickets, categories, userList, currentUser, searchQuery, toast,
    selectedTicket, detailModalOpen, solutionModalOpen,
    filteredTickets, pagedTickets, stats, loading,
    page, pageSize,
    filterStart, filterEnd, filterStatus,
    setSearchQuery, setSelectedTicket,
    setDetailModalOpen, setSolutionModalOpen,
    setFilterStart, setFilterEnd, setFilterStatus, setPage,
    addTicket, resolveTicket, claimTicket,
    addCategory, deleteCategory,
    importUsers, deleteUser,
    exportToCSV, showToast,
    login, logout, fetchTickets, fetchCategories, fetchUsers,
    initDone,
  };
}
