import { useMemo, useState } from 'react';
import type { RankingData, RankingSortKey } from '@/types';

interface HandlerRankingProps {
  data: RankingData[];
}

function medalStyle(rank: number) {
  if (rank === 1) return { border: 'border-[#f5a623]', bg: 'bg-[#fffbf0]', shadow: 'shadow-[0_2px_12px_rgba(245,166,35,0.2)]' };
  if (rank === 2) return { border: 'border-[#a0a0a5]', bg: 'bg-[#f8f8fa]', shadow: 'shadow-[0_2px_12px_rgba(160,160,165,0.2)]' };
  if (rank === 3) return { border: 'border-[#cd7f32]', bg: 'bg-[#fdf6f0]', shadow: 'shadow-[0_2px_12px_rgba(205,127,50,0.2)]' };
  return { border: 'border-transparent', bg: 'bg-white', shadow: '' };
}

const MEDAL_MAP: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatTime(minutes: number) {
  if (minutes <= 0) return '-';
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

export function HandlerRanking({ data }: HandlerRankingProps) {
  const [sortKey, setSortKey] = useState<RankingSortKey>('resolved_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const getVal = (item: RankingData, key: RankingSortKey) => {
        if (key === 'total_participation') return item.resolved_count + item.collaboration_count;
        return item[key];
      };
      const val = sortDir === 'desc' ? getVal(b, sortKey) - getVal(a, sortKey) : getVal(a, sortKey) - getVal(b, sortKey);
      return val;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: RankingSortKey) => {
    if (key === sortKey) setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortArrow = (key: RankingSortKey) => {
    if (key !== sortKey) return '';
    return sortDir === 'desc' ? ' ▲' : ' ▼';
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-[16px] font-medium text-[#86868b]">暂无处理人数据</p>
        <p className="text-[13px] text-[#d2d2d7] mt-1">暂无处理人的工单记录</p>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden sm:flex items-center px-4 py-3 mb-2 text-[12px] font-semibold text-[#86868b]">
        <span className="w-10 flex-shrink-0" />
        <span className="flex-[2] min-w-0">姓名</span>
        <button onClick={() => handleSort('claimed_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'claimed_count' ? 'text-[#0066cc]' : ''}`}>认领数{sortArrow('claimed_count')}</button>
        <button onClick={() => handleSort('collaboration_count')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'collaboration_count' ? 'text-[#0066cc]' : ''}`}>协作数{sortArrow('collaboration_count')}</button>
        <button onClick={() => handleSort('total_participation')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'total_participation' ? 'text-[#0066cc]' : ''}`}>总参与{sortArrow('total_participation')}</button>
        <button onClick={() => handleSort('avg_process_time')} className={`flex-1 min-w-0 text-left cursor-pointer hover:text-[#1d1d1f] transition-colors ${sortKey === 'avg_process_time' ? 'text-[#0066cc]' : ''}`}>平均处理时长{sortArrow('avg_process_time')}</button>
      </div>

      <div className="space-y-2">
        {sorted.map((item, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const style = medalStyle(rank);
          const totalParticipation = item.resolved_count + item.collaboration_count;

          return (
            <div key={item.user_id} className={`rounded-xl py-3 px-4 border ${style.border} ${style.bg} ${style.shadow} transition-all duration-250`}>
              <div className="flex items-center gap-3">
                {isTop3 ? (
                  <span className="text-2xl flex-shrink-0 w-10 text-center">{MEDAL_MAP[rank]}</span>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center flex-shrink-0">
                    <span className="text-[14px] font-bold text-[#0066cc]">{rank}</span>
                  </div>
                )}
                <span className="text-[15px] font-semibold text-[#1d1d1f] flex-[2] min-w-0 truncate">{item.name}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.claimed_count}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{item.collaboration_count}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{totalParticipation}</span>
                <span className="hidden sm:block flex-1 min-w-0 text-[14px] font-medium text-[#1d1d1f]">{formatTime(item.avg_process_time)}</span>
                <div className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#86868b]">
                  <span>认领 {item.claimed_count}</span><span>协作 {item.collaboration_count}</span>
                  <span>总参与 {totalParticipation}</span><span>平均 {formatTime(item.avg_process_time)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
