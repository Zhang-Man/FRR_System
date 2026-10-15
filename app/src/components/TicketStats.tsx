import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import type { CategoryStatData, TrendData } from '@/types';

interface TicketStatsProps {
  categoryStats: CategoryStatData[];
  trendData: TrendData[];
  trendView: 'month' | 'week';
  onTrendViewChange: (view: 'month' | 'week') => void;
}

const PIE_COLORS = ['#0066cc', '#34c759', '#ff9500', '#af52de', '#5ac8fa', '#ff3b30', '#ffcc02', '#5856d6', '#0a84ff', '#8e8e93'];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white rounded-lg border border-[#e5e5ea] px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <p className="text-[12px] font-medium text-[#1d1d1f] mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-[12px] text-[#86868b]">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }} />
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export function TicketStats({ categoryStats, trendData, trendView, onTrendViewChange }: TicketStatsProps) {
  const nonEmptyStats = categoryStats.filter(c => c.count > 0);
  const barData = nonEmptyStats.map(c => ({ name: c.category, 数量: c.count }));

  if (categoryStats.length === 0 && trendData.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-[16px] font-medium text-[#86868b]">暂无工单统计数据</p>
        <p className="text-[13px] text-[#d2d2d7] mt-1">当前日期范围内没有工单数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {nonEmptyStats.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">故障分类占比</h3>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="w-full lg:w-1/2" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={nonEmptyStats} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="count" nameKey="category">
                    {nonEmptyStats.map((cat, i) => (
                      <Cell key={cat.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {nonEmptyStats.map((cat, i) => (
                <div key={cat.category} className="flex items-center gap-2 text-[13px]">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-[#1d1d1f] font-medium truncate">{cat.category}</span>
                  <span className="text-[#86868b] ml-auto flex-shrink-0">{cat.count} ({cat.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-[16px] font-semibold text-[#1d1d1f] mb-4">各分类工单数量</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#86868b' }} axisLine={{ stroke: '#e5e5ea' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="数量" fill="#0066cc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {trendData.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-[#1d1d1f]">时间趋势</h3>
            <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-0.5">
              <button onClick={() => onTrendViewChange('month')} className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${trendView === 'month' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>按月</button>
              <button onClick={() => onTrendViewChange('week')} className={`px-3 py-1 rounded-full text-[12px] font-medium transition-all cursor-pointer ${trendView === 'week' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-[#86868b]'}`}>按周</button>
            </div>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#86868b' }} axisLine={{ stroke: '#e5e5ea' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#86868b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="total" name="工单总量" stroke="#0066cc" strokeWidth={2} dot={{ r: 3, fill: '#0066cc' }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="resolved" name="已解决" stroke="#34c759" strokeWidth={2} dot={{ r: 3, fill: '#34c759' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {categoryStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <h3 className="px-5 py-4 text-[16px] font-semibold text-[#1d1d1f] border-b border-[#f5f5f7]">分类明细</h3>
          <div className="hidden sm:flex px-5 py-3 text-[12px] font-semibold text-[#86868b] border-b border-[#f5f5f7] gap-2">
            <span className="flex-[2] min-w-0">故障分类</span>
            <span className="flex-1 min-w-0 text-center">数量</span>
            <span className="flex-1 min-w-0 text-center">占比</span>
            <span className="flex-1 min-w-0 text-center">待处理</span>
            <span className="flex-1 min-w-0 text-center">处理中</span>
            <span className="flex-1 min-w-0 text-center">已解决</span>
          </div>
          {categoryStats.map((cat, i) => (
            <div key={cat.category} className={`flex flex-col sm:flex-row sm:items-center px-5 py-3 gap-1 sm:gap-2 hover:bg-[#f5f5f7] transition-colors text-[14px] ${i < categoryStats.length - 1 ? 'border-b border-[#f5f5f7]' : ''}`}>
              <span className="font-medium text-[#1d1d1f] sm:flex-[2] sm:min-w-0 truncate">{cat.category}</span>
              <div className="flex sm:hidden gap-3 text-[12px] text-[#86868b]">
                <span>数量 {cat.count}</span><span>占比 {cat.percentage}%</span>
                <span>待处理 {cat.pending}</span><span>处理中 {cat.processing}</span><span>已解决 {cat.resolved}</span>
              </div>
              <span className="hidden sm:block flex-1 min-w-0 text-center text-[#1d1d1f] font-medium">{cat.count}</span>
              <span className="hidden sm:block flex-1 min-w-0 text-center text-[#86868b]">{cat.percentage}%</span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#ff9500] font-medium">{cat.pending}</span></span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#af52de] font-medium">{cat.processing}</span></span>
              <span className="hidden sm:block flex-1 min-w-0 text-center"><span className="text-[#34c759] font-medium">{cat.resolved}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
