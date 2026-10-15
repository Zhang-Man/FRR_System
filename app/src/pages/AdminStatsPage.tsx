import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { FilterBar } from '@/components/FilterBar';
import { HandlerRanking } from '@/components/HandlerRanking';
import { TicketStats } from '@/components/TicketStats';
import api from '@/api';
import type { TicketStatus, RankingData, CategoryStatData, TrendData } from '@/types';

export function AdminStatsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ranking' | 'stats'>('ranking');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');

  const [rankings, setRankings] = useState<RankingData[] | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStatData[] | null>(null);
  const [trendData, setTrendData] = useState<TrendData[] | null>(null);
  const [trendView, setTrendView] = useState<'month' | 'week'>('month');
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorRankings, setErrorRankings] = useState(false);
  const [errorStats, setErrorStats] = useState(false);

  const dateParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (appliedStart) p.start_date = appliedStart;
    if (appliedEnd) p.end_date = appliedEnd;
    return p;
  }, [appliedStart, appliedEnd]);

  const fetchRankings = useCallback(async () => {
    setLoadingRankings(true);
    setErrorRankings(false);
    try {
      const res = await api.stats.rankings(dateParams());
      setRankings(res.data);
    } catch {
      setErrorRankings(true);
    } finally { setLoadingRankings(false); }
  }, [dateParams]);

  const fetchCategoryStats = useCallback(async () => {
    const res = await api.stats.categories(dateParams());
    setCategoryStats(res.data);
  }, [dateParams]);

  const fetchTrendData = useCallback(async (view: 'month' | 'week') => {
    const res = await api.stats.trends({ ...dateParams(), view });
    setTrendData(res.data);
  }, [dateParams]);

  const fetchAllStats = useCallback(async () => {
    setLoadingStats(true);
    setErrorStats(false);
    try {
      await Promise.all([fetchCategoryStats(), fetchTrendData(trendView)]);
    } catch {
      setErrorStats(true);
    } finally { setLoadingStats(false); }
  }, [fetchCategoryStats, fetchTrendData, trendView]);

  useEffect(() => {
    const doFetch = async () => {
      setLoadingRankings(true);
      setErrorRankings(false);
      try {
        const res = await api.stats.rankings(dateParams());
        setRankings(res.data);
      } catch {
        setErrorRankings(true);
      } finally { setLoadingRankings(false); }
    };
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'stats' && categoryStats === null && trendData === null) {
      fetchAllStats();
    }
  }, [activeTab, categoryStats, trendData, fetchAllStats]);

  const handleApplyFilter = () => {
    setAppliedStart(filterStart);
    setAppliedEnd(filterEnd);
    setRankings(null);
    setCategoryStats(null);
    setTrendData(null);
    fetchRankings();
    if (activeTab === 'stats') fetchAllStats();
  };

  const handleTrendViewChange = (view: 'month' | 'week') => {
    setTrendView(view);
    setTrendData(null);
    fetchTrendData(view);
  };

  const loadingSpinner = (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#0066cc] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const errorDisplay = (
    <div className="bg-white rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[16px] font-medium text-[#86868b]">数据加载失败</p>
      <p className="text-[13px] text-[#d2d2d7] mt-1">请检查网络连接后重试</p>
    </div>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin')} className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>数据统计</h2>
      </div>

      <FilterBar
        startDate={filterStart}
        endDate={filterEnd}
        status={filterStatus}
        onStartChange={setFilterStart}
        onEndChange={setFilterEnd}
        onStatusChange={setFilterStatus}
        onApply={handleApplyFilter}
      />

      <div className="flex gap-1 bg-[#f5f5f7] rounded-full p-1 mb-6 w-fit">
        <button onClick={() => setActiveTab('ranking')} className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#86868b]'}`}>处理人排名</button>
        <button onClick={() => setActiveTab('stats')} className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${activeTab === 'stats' ? 'bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-[#86868b]'}`}>工单统计</button>
      </div>

      {activeTab === 'ranking' ? (
        loadingRankings ? loadingSpinner :
        errorRankings ? errorDisplay :
        rankings ? <HandlerRanking data={rankings} /> : null
      ) : (
        loadingStats ? loadingSpinner :
        errorStats ? errorDisplay :
        (categoryStats && trendData) ? (
          <TicketStats
            categoryStats={categoryStats}
            trendData={trendData}
            trendView={trendView}
            onTrendViewChange={handleTrendViewChange}
          />
        ) : null
      )}
    </div>
  );
}
