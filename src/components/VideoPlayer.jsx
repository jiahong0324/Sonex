import { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Gauge,
  Upload,
} from 'lucide-react';
import { createSmoothOutline } from '../utils/styles';
import { formatDisplayTime } from '../utils/timeUtils';
import { getWrappedText } from '../utils/srtParser';

export default function VideoPlayer({
  videoRef,
  videoUrl,
  captions,
  currentTime,
  setCurrentTime,
  styleConfig,
  videoAspectRatio,
  setVideoAspectRatio,
  onFileSelect,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCssFullscreen, setIsCssFullscreen] = useState(false);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync play/pause state from video events
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  const handleSeek = (delta) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
  };

  const handleRateChange = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  // Fullscreen support preserving subtitle layer
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);

      if (document.fullscreenElement === videoRef.current) {
        if (document.exitFullscreen) {
          document
            .exitFullscreen()
            .then(() => {
              if (containerRef.current?.requestFullscreen) {
                containerRef.current.requestFullscreen().catch(() => setIsCssFullscreen(true));
              } else {
                setIsCssFullscreen(true);
              }
            })
            .catch(() => {});
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [videoRef]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsCssFullscreen(false);
    } else if (isCssFullscreen) {
      setIsCssFullscreen(false);
    } else if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {
        setIsCssFullscreen(true);
      });
    } else {
      setIsCssFullscreen(!isCssFullscreen);
    }
  };

  // Determine current active caption
  const activeCaption = captions.find(
    (cap) => currentTime >= cap.startTime && currentTime <= cap.endTime
  );

  // Compute subtitle text style based on styleConfig
  const isFsMode = isFullscreen || isCssFullscreen;

  const getFontSizeClass = (size) => {
    if (isFsMode) {
      switch (size) {
        case 'sm':
          return 'text-2xl';
        case 'md':
          return 'text-3xl';
        case 'lg':
          return 'text-4xl';
        case 'xl':
          return 'text-5xl';
        default:
          return 'text-4xl';
      }
    }
    switch (size) {
      case 'sm':
        return 'text-sm sm:text-base';
      case 'md':
        return 'text-base sm:text-lg';
      case 'lg':
        return 'text-lg sm:text-xl md:text-2xl';
      case 'xl':
        return 'text-xl sm:text-2xl md:text-3xl';
      default:
        return 'text-xl';
    }
  };

  const smoothOutline = createSmoothOutline(
    isFsMode ? styleConfig.outlineThickness * 1.5 : styleConfig.outlineThickness,
    styleConfig.outlineColor
  );

  return (
    <div className="space-y-3">
      {/* Media Player Container */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl flex flex-col justify-center items-center group select-none ${
          isFsMode
            ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none bg-black'
            : 'h-[50vh] min-h-[300px] max-h-[640px]'
        }`}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              webkit-playsinline="true"
              controlsList="nofullscreen"
              className="h-full w-auto object-contain max-w-full cursor-pointer"
              onClick={togglePlay}
              onPlay={handlePlay}
              onPause={handlePause}
              onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              onLoadedMetadata={(e) => {
                const { videoWidth, videoHeight, duration: vidDuration } = e.target;
                if (videoWidth && videoHeight) {
                  setVideoAspectRatio(`${videoWidth}/${videoHeight}`);
                }
                setDuration(vidDuration || 0);
              }}
            />

            {/* Custom Subtitle Overlay */}
            {showSubtitles && activeCaption && (
              <div
                className="absolute inset-0 pointer-events-none flex justify-center"
                style={{
                  aspectRatio: videoAspectRatio || '16/9',
                  height: '100%',
                  maxWidth: '100%',
                }}
              >
                <div
                  className="absolute left-4 right-4 text-center transition-all duration-75 px-4"
                  style={{
                    top: `${styleConfig.verticalPosition || 82}%`,
                    transform: 'translateY(-50%)',
                  }}
                >
                  <span
                    className={`inline-block font-sans break-words whitespace-pre-wrap leading-[1.4] transition-all ${
                      styleConfig.isBold ? 'font-black' : 'font-medium'
                    } ${styleConfig.isUppercase ? 'uppercase' : ''} ${getFontSizeClass(
                      styleConfig.fontSize
                    )}`}
                    style={{
                      color: styleConfig.textColor || '#ffffff',
                      textShadow: smoothOutline,
                      backgroundColor:
                        styleConfig.bgOpacity > 0
                          ? `${styleConfig.bgColor}${Math.round(styleConfig.bgOpacity * 255)
                              .toString(16)
                              .padStart(2, '0')}`
                          : 'transparent',
                      padding: styleConfig.bgOpacity > 0 ? '6px 16px' : '0',
                      borderRadius: styleConfig.bgOpacity > 0 ? '10px' : '0',
                    }}
                  >
                    {getWrappedText(activeCaption.text)}
                  </span>
                </div>
              </div>
            )}

            {/* Floating Quick Action Overlay Buttons (Top Right) */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-90 hover:opacity-100 transition-opacity z-20">
              {/* Toggle Subtitles On/Off */}
              <button
                type="button"
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={`p-2 rounded-xl backdrop-blur-md transition-all text-xs font-semibold flex items-center gap-1 ${
                  showSubtitles
                    ? 'bg-black/60 text-emerald-400 border border-emerald-500/30 hover:bg-black/80'
                    : 'bg-black/60 text-zinc-400 border border-zinc-700 hover:text-white'
                }`}
                title={showSubtitles ? 'Hide Subtitles' : 'Show Subtitles'}
              >
                {showSubtitles ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              {/* Speed Controller */}
              <button
                type="button"
                onClick={handleRateChange}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white border border-zinc-800 backdrop-blur-md transition-all text-xs font-mono font-bold flex items-center gap-1"
                title="Playback Speed"
              >
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span>{playbackRate}x</span>
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white border border-zinc-800 backdrop-blur-md transition-all"
                title="Fullscreen (Preserves Subtitles)"
              >
                {isFsMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>

            {/* Bottom Player Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex items-center justify-between gap-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSeek(-2)}
                  className="text-zinc-300 hover:text-white p-1 transition-colors"
                  title="Rewind 2 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleSeek(2)}
                  className="text-zinc-300 hover:text-white p-1 transition-colors"
                  title="Forward 2 seconds"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <span className="text-xs font-mono text-zinc-300">
                  {formatDisplayTime(currentTime)} / {formatDisplayTime(duration)}
                </span>
              </div>

              {/* Aspect Ratio Badge */}
              <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded-lg border border-zinc-800">
                {videoAspectRatio || '16:9'}
              </div>
            </div>
          </>
        ) : (
          /* Empty State / Upload Dropzone in Player */
          <div
            className="p-8 text-center cursor-pointer hover:scale-[1.01] transition-transform"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-xl shadow-emerald-500/5">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Select or Drop a Video to Begin
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Supports MP4, MOV, and WebM format. Extract speech, edit captions, and burn subtitles
              instantly.
            </p>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
          }}
          accept="video/mp4, video/quicktime, video/webm"
          className="hidden"
        />
      </div>
    </div>
  );
}
