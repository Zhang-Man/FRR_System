import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '@/api';

interface HandlerOption {
  user_id: string;
  user_name: string;
}

interface SolutionModalProps {
  onClose: () => void;
  onConfirm: (solution: string, collaboratorIds: string[]) => void;
  currentUserId?: string;
}

export function SolutionModal({ onClose, onConfirm, currentUserId }: SolutionModalProps) {
  const [solution, setSolution] = useState('');
  const [handlers, setHandlers] = useState<HandlerOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.handlers.list().then(res => {
      setHandlers(res.data.filter(s => s.user_id !== currentUserId));
    }).catch(() => {
      setHandlers([]);
    });
  }, [currentUserId]);

  const handleConfirm = () => {
    if (!solution.trim()) return;
    onConfirm(solution.trim(), selectedIds);
  };

  const toggleHandler = (userId: string) => {
    setSelectedIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : prev.length < 2
          ? [...prev, userId]
          : prev
    );
  };

  const filteredHandlers = handlers.filter(s =>
    s.user_name.includes(searchTerm) || s.user_id.includes(searchTerm)
  );

  const isMax = selectedIds.length >= 2;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-[480px] shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>填写处理方案</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
            协作者 <span className="text-[#86868b] font-normal">(可选最多 2 人)</span>
          </label>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedIds.map(uid => {
                const s = handlers.find(st => st.user_id === uid);
                return s ? (
                  <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0f7ff] text-[#0066cc] text-[13px] font-medium">
                    {s.user_name}
                    <button
                      onClick={() => toggleHandler(uid)}
                      className="ml-0.5 text-[#0066cc] hover:text-[#ff3b30] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索处理人姓名或工号..."
            className="w-full px-3 py-2 rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] transition-all duration-250 mb-2"
          />

          {searchTerm && (
            <div className="max-h-[120px] overflow-y-auto rounded-lg border border-[#e5e5ea] mb-3">
              {filteredHandlers.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[#d2d2d7]">无匹配结果</div>
              ) : (
                filteredHandlers.map(s => {
                  const isSelected = selectedIds.includes(s.user_id);
                  return (
                    <button
                      key={s.user_id}
                      onClick={() => toggleHandler(s.user_id)}
                      disabled={!isSelected && isMax}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#f0f7ff] text-[#0066cc]'
                          : isMax
                            ? 'text-[#d2d2d7] cursor-not-allowed'
                            : 'text-[#1d1d1f] hover:bg-[#f5f5f7]'
                      }`}
                    >
                      {s.user_name} <span className="text-[#d2d2d7]">({s.user_id})</span>
                      {isSelected && <span className="float-right text-[#34c759]">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}

          <label className="block text-[13px] font-medium text-[#1d1d1f] mb-2">
            处理方案 <span className="text-[#ff3b30]">*</span>
          </label>
          <textarea
            value={solution}
            onChange={e => setSolution(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 rounded-lg bg-white border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 resize-none"
            placeholder="请描述故障原因及处理过程，例如：
- 故障原因分析
- 采取的处理措施
- 使用的工具/设备
- 后续建议"
          />
        </div>

        <div className="px-6 py-4 border-t border-[#e5e5ea] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-full bg-white border border-[#e5e5ea] text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!solution.trim()}
            className={`flex-1 h-11 rounded-full text-[14px] font-medium transition-all duration-250 cursor-pointer ${
              solution.trim()
                ? 'bg-[#0066cc] text-white shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa]'
                : 'bg-[#e5e5ea] text-[#d2d2d7] cursor-not-allowed'
            }`}
          >
            确认解决
          </button>
        </div>
      </div>
    </div>
  );
}
