import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = '搜索工单号、报修人、位置...' }: SearchBarProps) {
  return (
    <div className="relative mb-6">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868b]">
        <Search className="w-4.5 h-4.5" />
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-11 pr-10 rounded-full bg-white border border-[#e5e5ea] text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#e5e5ea] flex items-center justify-center text-[#86868b] hover:bg-[#d2d2d7] transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
