import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Pagination } from '@/components/Pagination';
import type { User, UserRole } from '@/types';

interface AdminUsersPageProps {
  users: User[];
  onImport: (users: { user_id: string; name: string; role: string; phone: string; department: string }[]) => void;
  onDelete: (id: string) => void;
  currentUserId?: string;
}

interface UserRow {
  user_id: string;
  name: string;
  role: UserRole;
  phone: string;
  department: string;
}

const PAGE_SIZE = 15;
const inputClass = 'w-full h-10 px-3 rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250';
const selectClass = 'w-full h-10 px-3 rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 appearance-none cursor-pointer';

const roleLabel = (role: UserRole) =>
  role === 'submitter' ? '提交人' : role === 'handler' ? '处理人' : '管理员';

const roleColorClass = (role: UserRole) =>
  role === 'submitter' ? 'bg-[#f0f7ff] text-[#0066cc]' :
  role === 'handler' ? 'bg-[#f5f0ff] text-[#af52de]' :
  'bg-[#fff0f0] text-[#ff3b30]';

export function AdminUsersPage({ users, onImport, onDelete, currentUserId }: AdminUsersPageProps) {
  const navigate = useNavigate();
  const [userList, setUserList] = useState<UserRow[]>([{ user_id: '', name: '', role: 'submitter', phone: '', department: '' }]);
  const [importResult, setImportResult] = useState('');
  const [page, setPage] = useState(1);

  const pagedUsers = useMemo(() => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [users, page]);

  const addRow = () => setUserList(prev => [...prev, { user_id: '', name: '', role: 'submitter', phone: '', department: '' }]);
  const removeRow = (i: number) => setUserList(prev => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof UserRow, value: string) =>
    setUserList(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  const handleImport = () => {
    const valid = userList.filter(u => u.user_id.trim() && u.name.trim());
    if (valid.length === 0) { setImportResult('请先填写数据'); return; }
    onImport(valid);
    setUserList([{ user_id: '', name: '', role: 'submitter', phone: '', department: '' }]);
    setImportResult('导入成功');
    setPage(1);
    setTimeout(() => setImportResult(''), 3000);
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>用户管理</h2>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent mb-6">
        <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-1">导入用户</h3>
        <p className="text-[13px] text-[#86868b] mb-5">输入用户信息（支持批量导入）</p>

        <div className="space-y-2 mb-5">
          {userList.map((u, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 sm:p-0 bg-[#fafafa] sm:bg-transparent rounded-lg sm:rounded-none border border-[#f0f0f0] sm:border-0">
              <div className="flex gap-2 flex-1 flex-wrap">
                <div className="flex-[2] min-w-[80px]">
                  <input type="text" placeholder="工号" value={u.user_id}
                    onChange={e => updateRow(i, 'user_id', e.target.value)} className={inputClass} />
                </div>
                <div className="flex-[1.5] min-w-[60px]">
                  <input type="text" placeholder="姓名" value={u.name}
                    onChange={e => updateRow(i, 'name', e.target.value)} className={inputClass} />
                </div>
                <div className="flex-[2] min-w-[70px]">
                  <select value={u.role} onChange={e => updateRow(i, 'role', e.target.value as UserRole)} className={selectClass}>
                    <option value="submitter">提交人</option>
                    <option value="handler">处理人</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div className="flex-[2] min-w-[80px]">
                  <input type="text" placeholder="电话" value={u.phone}
                    onChange={e => updateRow(i, 'phone', e.target.value)} className={inputClass} />
                </div>
                <div className="flex-[3] min-w-[80px]">
                  <input type="text" placeholder="部门/班级" value={u.department}
                    onChange={e => updateRow(i, 'department', e.target.value)} className={inputClass} />
                </div>
              </div>
              <button onClick={() => removeRow(i)}
                className="self-end sm:self-center w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#ffe0e0] hover:text-[#ff3b30] transition-colors cursor-pointer flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={addRow} className="h-9 px-4 rounded-full bg-white border border-[#e5e5ea] text-[13px] font-medium text-[#1d1d1f] flex items-center gap-1.5 hover:bg-[#f5f5f7] transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5" />添加行
          </button>
          <button onClick={handleImport} className="h-9 px-5 rounded-full bg-[#0066cc] text-white text-[13px] font-medium flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />确认导入
          </button>
          {importResult && <span className="text-[13px] text-[#34c759] font-medium">{importResult}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent overflow-hidden">
        <h3 className="px-4 sm:px-5 py-4 text-[16px] font-semibold text-[#1d1d1f] border-b border-[#f5f5f7]">
          所有用户 ({users.length})
        </h3>

        {users.length === 0 ? (
          <div className="p-12 text-center"><p className="text-[16px] font-medium text-[#86868b]">暂无数据</p></div>
        ) : (
          <>
            <div className="hidden sm:flex px-5 py-3 text-[12px] font-semibold text-[#86868b] border-b border-[#f5f5f7] gap-2">
              <span className="flex-[2] min-w-0">用户ID</span>
              <span className="flex-[1.5] min-w-0">姓名</span>
              <span className="flex-[2] min-w-0">角色</span>
              <span className="flex-[2] min-w-0">电话</span>
              <span className="flex-[3] min-w-0">部门/班级</span>
              <span className="w-10 flex-shrink-0" />
            </div>

            {pagedUsers.map((u, i) => (
              <div key={u.id}
                className={`flex flex-col sm:flex-row sm:items-center px-4 sm:px-5 py-3 sm:py-3 gap-1 sm:gap-2 hover:bg-[#f5f5f7] transition-colors text-[14px] ${i < pagedUsers.length - 1 ? 'border-b border-[#f5f5f7]' : ''}`}>
                <div className="flex sm:hidden items-center gap-2 mb-1">
                  <span className="font-medium text-[#1d1d1f] text-[15px]">{u.name}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${roleColorClass(u.role)}`}>{roleLabel(u.role)}</span>
                </div>
                <span className="sm:hidden text-[13px] text-[#86868b]">ID: {u.user_id || u.id}{u.phone ? ` · ${u.phone}` : ''}</span>
                {u.department && <span className="sm:hidden text-[13px] text-[#86868b]">{u.department}</span>}

                <span className="hidden sm:block flex-[2] min-w-0 font-medium text-[#1d1d1f] truncate">{u.user_id || u.id}</span>
                <span className="hidden sm:block flex-[1.5] min-w-0 text-[#1d1d1f] truncate">{u.name}</span>
                <span className="hidden sm:block flex-[2] min-w-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium ${roleColorClass(u.role)}`}>{roleLabel(u.role)}</span>
                </span>
                <span className="hidden sm:block flex-[2] min-w-0 text-[#86868b] text-[13px] truncate">{u.phone || '-'}</span>
                <span className="hidden sm:block flex-[3] min-w-0 text-[#86868b] text-[13px] truncate">{u.department || '-'}</span>

                <div className="sm:w-10 sm:flex sm:justify-end flex-shrink-0 self-end sm:self-auto mt-1 sm:mt-0">
                  <button onClick={() => onDelete(String(u.id))}
                    disabled={u.user_id === currentUserId || u.id === currentUserId}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 ${
                      (u.user_id === currentUserId || u.id === currentUserId)
                        ? 'bg-[#f5f5f7] text-[#d2d2d7] cursor-not-allowed'
                        : 'bg-[#fff0f0] text-[#ff3b30] hover:bg-[#ffe0e0]'
                    }`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <Pagination current={page} total={users.length} pageSize={PAGE_SIZE} onChange={(p) => { setPage(p); }} />
    </div>
  );
}
