import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import type { Category } from '@/types';

const formSchema = z.object({
  contact: z.string().min(1, '请填写此项'),
  location: z.string().min(1, '请填写此项'),
  category: z.string().min(1, '请填写此项'),
  description: z.string().min(1, '请填写此项'),
});

type FormData = z.infer<typeof formSchema>;

interface RepairFormProps {
  categories: Category[];
  onSubmit: (ticket: FormData) => void;
}

export function RepairForm({ categories, onSubmit }: RepairFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    defaultValues: { contact: '', location: '', category: '', description: '' },
  });

  const onValid = (data: FormData) => {
    onSubmit({
      contact: data.contact.trim(),
      location: data.location.trim(),
      category: data.category,
      description: data.description.trim(),
    });
    reset();
  };

  const baseInputClass = 'w-full h-11 px-4 rounded-lg bg-white border text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250';
  const inputErrorClass = 'border-[#ff3b30]';
  const inputNormalClass = 'border-[#e5e5ea]';
  const selectClass = 'w-full h-11 px-4 rounded-lg bg-white border text-[14px] text-[#1d1d1f] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 appearance-none cursor-pointer';
  const labelClass = 'block text-[13px] font-medium text-[#1d1d1f] mb-2';
  const errorClass = 'text-[12px] text-[#ff3b30] mt-1.5';

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-transparent mb-8">
      <h2 className="text-[20px] font-bold text-[#1d1d1f] mb-5" style={{ letterSpacing: '-0.03em' }}>提交报修</h2>
      <form onSubmit={handleSubmit(onValid)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>联系电话</label>
            <input
              type="tel"
              {...register('contact')}
              className={`${baseInputClass} ${errors.contact ? inputErrorClass : inputNormalClass}`}
              placeholder="请输入电话号码"
            />
            {errors.contact && <p className={errorClass}>{errors.contact.message}</p>}
          </div>
          <div>
            <label className={labelClass}>所在位置</label>
            <input
              type="text"
              {...register('location')}
              className={`${baseInputClass} ${errors.location ? inputErrorClass : inputNormalClass}`}
              placeholder="例如：办公楼A 305办公室"
            />
            {errors.location && <p className={errorClass}>{errors.location.message}</p>}
          </div>
          <div>
            <label className={labelClass}>故障类型</label>
            <select
              {...register('category')}
              className={`${selectClass} ${errors.category ? inputErrorClass : inputNormalClass}`}
            >
              <option value="">请选择故障类型</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {errors.category && <p className={errorClass}>{errors.category.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>故障描述</label>
            <textarea
              {...register('description')}
              rows={4}
              className={`w-full px-4 py-3 rounded-lg bg-white border text-[14px] text-[#1d1d1f] placeholder:text-[#d2d2d7] focus:outline-none focus:border-[#0066cc] focus:shadow-[0_0_0_4px_rgba(0,102,204,0.1)] transition-all duration-250 resize-none ${errors.description ? inputErrorClass : inputNormalClass}`}
              placeholder="请详细描述故障现象"
            />
            {errors.description && <p className={errorClass}>{errors.description.message}</p>}
          </div>
        </div>
        <button
          type="submit"
          className="mt-5 w-full h-12 rounded-full bg-[#0066cc] text-white text-[15px] font-medium flex items-center justify-center gap-2 shadow-[0_2px_8px_rgba(0,102,204,0.3)] hover:bg-[#0055aa] active:scale-[0.98] transition-all duration-250 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          提交报修
        </button>
      </form>
    </div>
  );
}
