import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from './ui';
import { NoSaleReport } from '../types';
import { useState } from 'react';
import { useNotification } from './Notification';

const noSaleSchema = z.object({
  clientVisits: z.number().min(0, 'Required'),
  followUps: z.number().min(0, 'Required'),
  remarks: z.string().optional(),
  salespersonName: z.string().min(1, 'Required'),
  date: z.string().min(1, 'Required'),
});

export const NoSaleForm = ({ salesperson, onSubmit }: { salesperson: any, onSubmit: (data: NoSaleReport) => void }) => {
  const { showNotification } = useNotification();
  const getIstDateString = () => {
    return new Date().toLocaleString("en-GB", { 
        timeZone: "Asia/Kolkata", 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    }).replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+:\d+)/, '$3-$2-$1 $4');
  };

  const { register, handleSubmit } = useForm<NoSaleReport>({
    resolver: zodResolver(noSaleSchema as any),
    defaultValues: {
      salespersonName: salesperson.name,
      date: getIstDateString(),
      clientVisits: 0,
      followUps: 0
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onError = () => {
    showNotification('Please fill the required fields correctly.', 'error');
  };

  const onSubmitHandler = async (data: NoSaleReport) => {
    setIsSubmitting(true);
    const dataWithTimestamp = {
      ...data,
      date: getIstDateString()
    };
    try {
      await onSubmit(dataWithTimestamp);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full p-3 md:p-4 glass-input text-slate-800 placeholder:text-slate-400 outline-none text-sm md:text-base";
  const labelClass = "block text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 md:mb-2";

  return (
    <form onSubmit={handleSubmit(onSubmitHandler, onError)} className="space-y-6 md:space-y-8 luxury-card p-6 md:p-10 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h3 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Activity Log</h3>
        <p className="text-slate-500 mt-1 md:mt-2 font-medium text-sm">Record visits and follow-ups resulting in no sale.</p>
      </div>
      
      <input type="hidden" {...register('salespersonName')} />
      <input type="hidden" {...register('date')} />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>Client Visits</label>
          <input {...register('clientVisits', { valueAsNumber: true })} type="number" className={inputClass} placeholder="0" />
        </div>
        <div>
          <label className={labelClass}>Follow-ups</label>
          <input {...register('followUps', { valueAsNumber: true })} type="number" className={inputClass} placeholder="0" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Remarks</label>
        <textarea {...register('remarks')} className={inputClass} rows={3} placeholder="Add any relevant notes or reasons..." />
      </div>

      <Button type="submit" className="w-full h-16 text-lg rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-slate-900/20" disabled={isSubmitting}>
        {isSubmitting ? 'Syncing...' : 'Log Activity'}
      </Button>
    </form>
  );
};
