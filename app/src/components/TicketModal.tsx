import { X } from 'lucide-react';
import { useMemo } from 'react';
import type { Ticket, UserRole } from '@/types';

interface TicketModalProps {
  ticket: Ticket;
  userRole: UserRole;
  onClose: () => void;
  onResolve: () => void;
}

export function TicketModal({ ticket, userRole, onClose, onResolve }: TicketModalProps) {
  const isResolved = ticket.status === 'resolved';
  const isProcessing = ticket.status === 'processing';
  const statusLabel = isResolved ? '已解决' : isProcessing ? '处理中' : '待处理';

  const detailItems = useMemo(() => [
    { label: '工单号', value: `#${ticket.id}`, mono: true },
    { label: '报修人', value: ticket.reporter_name + (ticket.reporter_id ? ` (${ticket.reporter_id})` : '') },
    { label: '联系电话', value: ticket.contact },
    { label: '所在位置', value: ticket.location },
    { label: '故障类型', value: ticket.category },
    { label: '提交时间', value: ticket.created_at },
    { label: '状态', value: statusLabel },
    ...(ticket.assignee_name ? [{ label: '处理人', value: ticket.assignee_name + (ticket.assignee_id ? ` (${ticket.assignee_id})` : '') }] : []),
    ...(isResolved && ticket.collaborators && ticket.collaborators.length > 0
      ? [{ label: '协作者', value: ticket.collaborators.map(c => c.user_name + (c.user_id ? ` (${c.user_id})` : '')).join('、') }]
      : []),
    ...(isResolved
      ? [
          { label: '解决时间', value: ticket.completed_at || '' },
        ]
      : []),
  ], [ticket.id, ticket.reporter_name, ticket.reporter_id, ticket.contact, ticket.location, ticket.category, ticket.created_at, ticket.assignee_name, ticket.assignee_id, ticket.completed_at, ticket.collaborators, statusLabel, isResolved]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl w-full max-w-[560px] max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5ea]">
          <h2 className="text-[20px] font-bold text-[#1d1d1f]" style={{ letterSpacing: '-0.03em' }}>工单详情</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#86868b] hover:bg-[#e5e5ea] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-3">
            {detailItems.map(item => (
              <div key={item.label} className="flex items-start gap-3">
                <span className="w-[100px] flex-shrink-0 text-[13px] font-medium text-[#86868b] pt-0.5">{item.label}</span>
                <span className={`text-[14px] text-[#1d1d1f] ${'mono' in item && item.mono ? 'font-mono' : ''}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <span className="text-[13px] font-medium text-[#86868b]">故障描述</span>
            <div className="mt-2 p-4 rounded-lg bg-[#f5f5f7] text-[14px] text-[#1d1d1f] leading-relaxed">
              {ticket.description}
            </div>
          </div>

          {isResolved && ticket.solution && (
            <div className="mt-5">
              <span className="text-[13px] font-medium text-[#86868b]">处理方案</span>
              <div className="mt-2 p-4 rounded-lg bg-[#f0fff5] text-[14px] text-[#1d1d1f] leading-relaxed border border-[#e8f5e9]">
                {ticket.solution}
              </div>
            </div>
          )}
        </div>

        {!isResolved && isProcessing && userRole === 'handler' && (
          <div className="px-6 py-4 border-t border-[#e5e5ea]">
            <button
              onClick={onResolve}
              className="w-full h-12 rounded-full bg-[#34c759] text-white text-[15px] font-medium shadow-[0_2px_8px_rgba(52,199,89,0.3)] hover:bg-[#2db84e] active:scale-[0.98] transition-all duration-250 cursor-pointer"
            >
              标记为已解决
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
