import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  current: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
}

export function Pagination({ current, total, pageSize = 20, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const getDisplayPages = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="w-9 h-9 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:border-[#0066cc] hover:text-[#0066cc] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {getDisplayPages().map((p, i) =>
        typeof p === 'string' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-[13px] text-[#d2d2d7]">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-9 h-9 rounded-full text-[13px] font-medium transition-all cursor-pointer ${
              p === current
                ? 'bg-[#0066cc] text-white shadow-[0_2px_8px_rgba(0,102,204,0.3)]'
                : 'bg-white border border-[#e5e5ea] text-[#1d1d1f] hover:border-[#0066cc] hover:text-[#0066cc]'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === totalPages}
        className="w-9 h-9 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:border-[#0066cc] hover:text-[#0066cc] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <span className="ml-3 text-[12px] text-[#86868b]">
        第 {current}/{totalPages} 页，共 {total} 条
      </span>
    </div>
  );
}
