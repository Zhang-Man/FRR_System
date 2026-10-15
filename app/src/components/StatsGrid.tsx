import { ClipboardList, Clock, CheckCircle2, TrendingUp, Wrench } from 'lucide-react';
import type { Stats } from '@/types';

interface StatsGridProps {
  stats: Stats;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statItems = [
    { label: '总工单数', value: stats.total, icon: ClipboardList, color: 'text-[#0066cc]', bgColor: 'bg-[#f0f7ff]' },
    { label: '待处理', value: stats.pending, icon: Clock, color: 'text-[#ff9500]', bgColor: 'bg-[#fff8f0]' },
    { label: '处理中', value: stats.processing, icon: Wrench, color: 'text-[#af52de]', bgColor: 'bg-[#f8f0ff]' },
    { label: '已解决', value: stats.resolved, icon: CheckCircle2, color: 'text-[#34c759]', bgColor: 'bg-[#f0fff5]' },
    { label: '今日新增', value: stats.today, icon: TrendingUp, color: 'text-[#ff9500]', bgColor: 'bg-[#fff8f0]' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {statItems.map(item => (
        <div
          key={item.label}
          className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-[#e5e5ea] hover:-translate-y-[1px] transition-all duration-250"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
          </div>
          <div className="text-[28px] font-bold text-[#1d1d1f] leading-tight" style={{ letterSpacing: '-0.03em' }}>
            {item.value}
          </div>
          <div className="text-[13px] text-[#86868b] mt-1 font-medium">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
