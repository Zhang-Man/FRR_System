import { Search } from 'lucide-react';
import type { TicketStatus } from '@/types';

interface FilterBarProps {
  startDate: string;
  endDate: string;
  status: TicketStatus | '';
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onStatusChange: (v: TicketStatus | '') => void;
  onApply: () => void;
}

export function FilterBar({ startDate, endDate, status, onStartChange, onEndChange, onStatusChange, onApply }: FilterBarProps) {
  const inputClass = 'h-10 px-4 min-w-[140px] rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250';
  const selectClass = 'h-10 px-4 pr-9 min-w-[130px] rounded-lg bg-white border border-[#e5e5ea] text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 appearance-none cursor-pointer bg-no-repeat';

  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#86868b]">开始日期</label>
          <input type="date" value={startDate} onChange={e => onStartChange(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#86868b]">结束日期</label>
          <input type="date" value={endDate} onChange={e => onEndChange(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[#86868b]">状态</label>
          <select value={status} onChange={e => onStatusChange(e.target.value as TicketStatus | '')} className={selectClass} style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2386868b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundPosition: 'right 12px center' }}>
            <option value="">全部</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
          </select>
        </div>
        <button
          onClick={onApply}
          className="h-10 px-5 rounded-full bg-[#0066cc] text-white text-[13px] font-medium flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          筛选
        </button>
      </div>
    </div>
  );
}
