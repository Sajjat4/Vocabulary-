import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function PermissionModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white/[0.04] border border-red-500/25 rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-3xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-6">
          <MicOff size={32} className="text-red-400" />
        </div>
        
        <h2 className="text-2xl font-sans font-extrabold text-white mb-3">Microphone Blocked</h2>
        <p className="text-white/70 text-sm mb-6 leading-relaxed font-semibold">
          Your browser has blocked microphone access for this site. Zoya cannot hear you until you allow it.
        </p>
        
        <div className="bg-black/45 border border-white/10 rounded-2xl p-4 text-left w-full mb-8 shadow-inner">
          <p className="text-sm text-white/95 font-extrabold mb-2">How to fix this:</p>
          <ol className="text-xs text-white/70 list-decimal pl-4 space-y-2 font-semibold">
            <li>Click the <strong>lock icon (🔒)</strong> or <strong>tune icon (⚙️)</strong> next to the URL bar at the top of your browser.</li>
            <li>Find <strong>Microphone</strong> and change it to <strong>Allow</strong>.</li>
            <li>Refresh this page.</li>
          </ol>
        </div>
        
        <div className="flex flex-col w-full gap-3">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-white text-black font-extrabold rounded-2xl hover:bg-gray-200 transition-all cursor-pointer active:scale-95"
          >
            I've allowed it, Refresh Page
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/5 text-white/80 font-extrabold rounded-2xl hover:bg-white/10 transition-all cursor-pointer active:scale-95 border border-white/10"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
