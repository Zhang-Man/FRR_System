import { User, MapPin, Clock } from 'lucide-react';
import type { Ticket, UserRole } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
  userRole: UserRole;
  onClick: () => void;
  onResolve: () => void;
  onClaim?: () => void;
  showClaim?: boolean;
}

export function TicketCard({ ticket, userRole, onClick, onResolve, onClaim, showClaim }: TicketCardProps) {
  const isResolved = ticket.status === 'resolved';
  const isProcessing = ticket.status === 'processing';

  const statusLabel = isResolved ? '已解决' : isProcessing ? '处理中' : '待处理';
  const statusStyle = isResolved
    ? 'bg-[#e8f5e9] text-[#2e7d32]'
    : isProcessing
      ? 'bg-[#f0f7ff] text-[#0066cc]'
      : 'bg-[#fff8f0] text-[#ff9500]';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-[#e5e5ea] hover:-translate-y-[1px] transition-all duration-250 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#f0f7ff] text-[#0066cc] text-[13px] font-medium font-mono">
            #{ticket.id}
          </span>
          <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
            {ticket.category} — {ticket.location}
          </h3>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[13px] font-medium flex-shrink-0 ml-2 ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[13px] text-[#86868b] flex-wrap">
        <span className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          {ticket.reporter_name}
          {ticket.reporter_id && <span className="text-[#d2d2d7]">({ticket.reporter_id})</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {ticket.location}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {ticket.created_at}
        </span>
      </div>

      {ticket.assignee_name && (
        <div className="mt-2 text-[13px] text-[#86868b]">
          处理人：{ticket.assignee_name}
          {ticket.assignee_id && <span className="text-[#d2d2d7]"> ({ticket.assignee_id})</span>}
          {isResolved && ticket.collaborators && ticket.collaborators.length > 0 && (
            <span> + {ticket.collaborators.map(c => c.user_name).join('、')}</span>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-3">
        {showClaim && ticket.status === 'pending' && (
          <button
            onClick={e => { e.stopPropagation(); onClaim?.(); }}
            className="px-4 py-2 rounded-full bg-[#0066cc] text-white text-[13px] font-medium shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer"
          >
            认领工单
          </button>
        )}
        {!isResolved && isProcessing && userRole === 'handler' && (
          <button
            onClick={e => { e.stopPropagation(); onResolve(); }}
            className="px-4 py-2 rounded-full bg-[#34c759] text-white text-[13px] font-medium shadow-[0_2px_8px_rgba(52,199,89,0.3)] hover:bg-[#2db84e] active:scale-[0.98] transition-all duration-250 cursor-pointer"
          >
            完成处理
          </button>
        )}
      </div>
    </div>
  );
}
