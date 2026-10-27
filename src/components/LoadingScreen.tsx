import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, PieChart, Database } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen premium-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
        {/* Soft background glow */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-emerald-200/30 blur-3xl rounded-full scale-110"
        />
        
        {/* Sales Icons Animation */}
        <div className="relative z-10 flex gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100"
          >
            <BarChart3 size={40} className="text-emerald-600" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-slate-900 p-6 rounded-2xl shadow-xl border border-slate-800"
          >
            <TrendingUp size={40} className="text-emerald-400" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100"
          >
            <PieChart size={40} className="text-blue-600" />
          </motion.div>
        </div>

        {/* Floating Data Nodes */}
        <motion.div 
          animate={{ 
            y: [0, -15, 0],
            rotate: [0, 10, 0]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-6 -right-6 bg-amber-500 p-3 rounded-xl shadow-lg shadow-amber-200 z-20"
        >
          <Database size={20} className="text-white" />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-4"
      >
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
          Syncing Sales Dashboard...
        </h2>
        <div className="flex flex-col items-center gap-1 text-slate-500 font-medium tracking-wide">
          <p className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Compiling
            </motion.span>
            <span className="text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 rounded-lg">Performance Metrics</span>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              for your session.
            </motion.span>
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">
            Analyzing Target vs Achievement
          </p>
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="mt-12 w-64 h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
        <motion.div 
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-400"
        />
      </div>

      <p className="mt-8 text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">
        Internal Sales Portal v2.0
      </p>
    </div>
  );
};
