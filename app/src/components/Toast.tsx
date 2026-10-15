import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import type { ToastState } from '@/types';

interface ToastProps {
  toast: ToastState;
}

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const colorMap = {
  success: 'text-[#34c759]',
  error: 'text-[#ff3b30]',
  info: 'text-[#0066cc]',
};

export function Toast({ toast }: ToastProps) {
  if (!toast.visible) return null;

  const Icon = iconMap[toast.type];

  return (
    <div className="fixed top-20 right-6 z-[200] animate-slideIn">
      <div className="bg-white rounded-xl px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#e5e5ea] flex items-center gap-3 min-w-[240px]">
        <Icon className={`w-5 h-5 ${colorMap[toast.type]} flex-shrink-0`} />
        <span className="text-[14px] font-medium text-[#1d1d1f]">{toast.message}</span>
      </div>
    </div>
  );
}
