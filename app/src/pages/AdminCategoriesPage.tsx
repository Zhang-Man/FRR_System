import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Category } from '@/types';

interface AdminCategoriesPageProps {
  categories: Category[];
  onAdd: (name: string) => void;
  onDelete: (id: string, name: string) => void;
}

export function AdminCategoriesPage({ categories, onAdd, onDelete }: AdminCategoriesPageProps) {
  const navigate = useNavigate();
  const [newName, setNewName] = useState('');
  const [result, setResult] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName('');
    setResult('添加成功');
    setTimeout(() => setResult(''), 2000);
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>分类管理</h2>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent mb-6">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="输入故障类型名称"
            maxLength={50}
            className="flex-1 h-11 px-4 rounded-lg bg-white border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250"
          />
          <button
            onClick={handleAdd}
            className="h-11 px-6 rounded-full bg-[#0066cc] text-white text-[14px] font-medium flex items-center gap-2 shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
        {result && <p className="text-[13px] text-[#34c759] mt-3 font-medium">{result}</p>}
      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[16px] font-medium text-[#86868b]">暂无分类</p>
          </div>
        ) : (
          categories.map((cat, i) => (
            <div
              key={cat.id}
              className={`flex items-center px-5 py-4 gap-4 hover:bg-[#f5f5f7] transition-colors ${i < categories.length - 1 ? 'border-b border-[#f5f5f7]' : ''}`}
            >
              <span className="text-[15px] text-[#1d1d1f] flex-1 font-medium">{cat.name}</span>
              {cat.ticket_count !== undefined && (
                <span className="text-[13px] text-[#86868b]">{cat.ticket_count} 条工单</span>
              )}
              <button
                onClick={() => onDelete(String(cat.id), cat.name)}
                className="w-8 h-8 rounded-full bg-[#fff0f0] flex items-center justify-center text-[#ff3b30] hover:bg-[#ffe0e0] transition-colors cursor-pointer flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
