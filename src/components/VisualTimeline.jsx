import { useRef } from 'react';
import { formatDisplayTime } from '../utils/timeUtils';

export default function VisualTimeline({
  captions,
  currentTime,
  duration,
  onSeek,
  onSelectCaption,
}) {
  const trackRef = useRef(null);

  if (!duration || duration <= 0) return null;

  const handleTrackClick = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = percentage * duration;
    onSeek(targetTime);
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-3.5 space-y-2 select-none">
      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-zinc-300">Timeline Scrubber</span>
          <span>({captions.length} blocks)</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <span>{formatDisplayTime(currentTime)}</span>
          <span>/</span>
          <span>{formatDisplayTime(duration)}</span>
        </div>
      </div>

      {/* Interactive Track Area */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-12 bg-zinc-950 rounded-xl border border-zinc-850 cursor-pointer overflow-hidden group shadow-inner"
      >
        {/* Subtitle Block Markers */}
        {captions.map((cap) => {
          const leftPercent = (cap.startTime / duration) * 100;
          const widthPercent = Math.max(0.5, ((cap.endTime - cap.startTime) / duration) * 100);
          const isActive = currentTime >= cap.startTime && currentTime <= cap.endTime;

          return (
            <div
              key={cap.id}
              onClick={(e) => {
                e.stopPropagation();
                onSeek(cap.startTime);
                onSelectCaption?.(cap.id);
              }}
              className={`absolute top-2 bottom-2 rounded px-1 flex items-center transition-all cursor-pointer truncate text-[9px] font-mono border ${
                isActive
                  ? 'bg-emerald-500/80 text-black border-emerald-300 z-10 shadow-lg shadow-emerald-500/30 font-bold scale-y-105'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/60'
              }`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                minWidth: '6px',
              }}
              title={`#${cap.id} [${cap.startStr} - ${cap.endStr}]: ${cap.text}`}
            >
              <span className="truncate opacity-80">{cap.text}</span>
            </div>
          );
        })}

        {/* Playhead Indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 pointer-events-none transition-all duration-75 flex flex-col items-center"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="w-2.5 h-2.5 bg-rose-500 rotate-45 -mt-1 shadow-md shadow-rose-500/50" />
        </div>
      </div>
    </div>
  );
}
