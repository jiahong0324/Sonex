import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ feedback, onClose }) {
  if (!feedback || !feedback.msg) return null;

  const isSuccess = feedback.type === 'success';

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-md animate-fade-in">
      <div
        className={`px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3 transition-all ${
          isSuccess
            ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50'
            : 'bg-rose-950/80 text-rose-200 border-rose-500/40 shadow-rose-950/50'
        }`}
      >
        <div className="mt-0.5 flex-shrink-0">
          {isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
        </div>
        <div className="flex-1 text-xs sm:text-sm font-medium leading-snug break-words">
          {feedback.msg}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
