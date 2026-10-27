import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="pointer-events-auto"
            >
              <div className={`
                flex items-center gap-3 p-4 pr-12 rounded-2xl shadow-2xl border backdrop-blur-xl min-w-[300px] max-w-md relative overflow-hidden group
                ${n.type === 'success' ? 'bg-emerald-50/90 border-emerald-100 text-emerald-800' : 
                  n.type === 'error' ? 'bg-rose-50/90 border-rose-100 text-rose-800' : 
                  n.type === 'warning' ? 'bg-amber-50/90 border-amber-100 text-amber-800' : 
                  'bg-white border-slate-100 text-slate-800'}
              `}>
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  n.type === 'success' ? 'bg-emerald-100/50' : 
                  n.type === 'error' ? 'bg-rose-100/50' : 
                  n.type === 'warning' ? 'bg-amber-100/50' : 
                  'bg-slate-100/50'
                }`}>
                  {n.type === 'success' && <CheckCircle2 size={20} className="text-emerald-600" />}
                  {n.type === 'error' && <AlertCircle size={20} className="text-rose-600" />}
                  {n.type === 'warning' && <AlertCircle size={20} className="text-amber-600" />}
                  {n.type === 'info' && <Info size={20} className="text-blue-600" />}
                </div>

                <div className="flex-1">
                  <p className="text-sm font-bold leading-tight">{n.message}</p>
                </div>

                <button 
                  onClick={() => removeNotification(n.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>

                {/* Progress bar at bottom */}
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 4, ease: 'linear' }}
                  className={`absolute bottom-0 left-0 h-1 opacity-40 ${
                    n.type === 'success' ? 'bg-emerald-500' : 
                    n.type === 'error' ? 'bg-rose-500' : 
                    n.type === 'warning' ? 'bg-amber-500' : 
                    'bg-slate-400'
                  }`}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
