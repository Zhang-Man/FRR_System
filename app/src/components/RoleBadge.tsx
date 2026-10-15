import type { UserRole } from '@/types';

interface RoleBadgeProps {
  role: UserRole;
}

const roleLabels: Record<UserRole, string> = {
  submitter: '提交人',
  handler: '处理人',
  admin: '管理员',
};

const roleColors: Record<UserRole, string> = {
  submitter: 'bg-[#f0f7ff] text-[#0066cc]',
  handler: 'bg-[#f5f0ff] text-[#af52de]',
  admin: 'bg-[#fff0f0] text-[#ff3b30]',
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium ${roleColors[role]}`}>
      {roleLabels[role]}
    </span>
  );
}
