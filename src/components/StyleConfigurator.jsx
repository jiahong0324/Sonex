import { STYLE_PRESETS, createSmoothOutline } from '../utils/styles';
import { Palette, Check, Sparkles, Sliders } from 'lucide-react';

export default function StyleConfigurator({ styleConfig, setStyleConfig, showFeedback }) {
  const handleSelectPreset = (preset) => {
    setStyleConfig((prev) => ({
      ...prev,
      presetId: preset.id,
      textColor: preset.textColor,
      bgColor: preset.bgColor,
      bgOpacity: preset.bgOpacity,
      outlineColor: preset.outlineColor,
      outlineThickness: preset.outlineThickness,
      isBold: preset.isBold,
    }));
    showFeedback('success', `Applied preset: ${preset.name}`);
  };

  const smoothOutline = createSmoothOutline(
    styleConfig.outlineThickness,
    styleConfig.outlineColor
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Subtitle Style & Presets Studio</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Customize subtitle appearance for TikTok, Instagram Reels, and YouTube Shorts. Styles apply in real time to the video player and video export.
        </p>
      </div>

      {/* Preset Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Popular Viral Presets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STYLE_PRESETS.map((preset) => {
            const isSelected = styleConfig.presetId === preset.id;
            const outline = createSmoothOutline(preset.outlineThickness, preset.outlineColor);

            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-32 ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{preset.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-semibold">
                      {preset.tag}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Mini Preview Box */}
                <div className="bg-black/70 rounded-xl p-2.5 text-center flex items-center justify-center border border-zinc-800/80">
                  <span
                    className={`text-sm ${preset.isBold ? 'font-black' : 'font-semibold'} leading-tight`}
                    style={{
                      color: preset.textColor,
                      textShadow: outline,
                      backgroundColor:
                        preset.bgOpacity > 0
                          ? `${preset.bgColor}${Math.round(preset.bgOpacity * 255)
                              .toString(16)
                              .padStart(2, '0')}`
                          : 'transparent',
                      padding: preset.bgOpacity > 0 ? '3px 8px' : '0',
                      borderRadius: preset.bgOpacity > 0 ? '6px' : '0',
                    }}
                  >
                    Sample Viral Caption
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Preview & Detailed Customization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Custom Fine-Tuning Controls */}
        <div className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Custom Style Tweaks</span>
          </div>

          {/* Font Size Selector */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 font-semibold">Font Size</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'sm', label: 'Small' },
                { id: 'md', label: 'Medium' },
                { id: 'lg', label: 'Large (Default)' },
                { id: 'xl', label: 'Extra Large' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleConfig((p) => ({ ...p, fontSize: s.id }))}
                  className={`py-2 text-xs rounded-xl border font-bold transition-all ${
                    styleConfig.fontSize === s.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Vertical Position Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-zinc-400 font-semibold">
                Vertical Placement: {styleConfig.verticalPosition}%
              </label>
              <span className="text-emerald-400 font-mono text-[11px]">
                {styleConfig.verticalPosition >= 78 && styleConfig.verticalPosition <= 86
                  ? 'Recommended (Shorts/Reels Safe Zone)'
                  : `${styleConfig.verticalPosition}% from top`}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="92"
              step="1"
              value={styleConfig.verticalPosition}
              onChange={(e) =>
                setStyleConfig((p) => ({ ...p, verticalPosition: parseInt(e.target.value, 10) }))
              }
              className="w-full accent-emerald-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>Top (20%)</span>
              <span>Center (50%)</span>
              <span className="text-emerald-400 font-bold">Reels Safe (82%)</span>
              <span>Bottom (92%)</span>
            </div>
          </div>

          {/* Colors & Outline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Text Color */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-semibold">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styleConfig.textColor}
                  onChange={(e) => setStyleConfig((p) => ({ ...p, textColor: e.target.value }))}
                  className="w-8 h-8 rounded-lg border border-zinc-700 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={styleConfig.textColor}
                  onChange={(e) => setStyleConfig((p) => ({ ...p, textColor: e.target.value }))}
                  className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
                <div className="flex gap-1">
                  {['#FFE600', '#FFFFFF', '#00F2FE', '#FF6B00'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setStyleConfig((p) => ({ ...p, textColor: col }))}
                      className="w-5 h-5 rounded-md border border-zinc-700"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Outline Color & Thickness */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-semibold">
                Outline Thickness: {styleConfig.outlineThickness}px
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.2"
                  value={styleConfig.outlineThickness}
                  onChange={(e) =>
                    setStyleConfig((p) => ({
                      ...p,
                      outlineThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="flex-1 accent-emerald-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
                />
                <input
                  type="color"
                  value={styleConfig.outlineColor}
                  onChange={(e) =>
                    setStyleConfig((p) => ({ ...p, outlineColor: e.target.value }))
                  }
                  className="w-7 h-7 rounded-lg border border-zinc-700 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            {/* Background Box & Opacity */}
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-semibold">
                Box Background Opacity: {Math.round(styleConfig.bgOpacity * 100)}%
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={styleConfig.bgOpacity}
                  onChange={(e) =>
                    setStyleConfig((p) => ({
                      ...p,
                      bgOpacity: parseFloat(e.target.value),
                    }))
                  }
                  className="flex-1 accent-emerald-500 bg-zinc-950 h-2 rounded-lg cursor-pointer"
                />
                <input
                  type="color"
                  value={styleConfig.bgColor}
                  onChange={(e) => setStyleConfig((p) => ({ ...p, bgColor: e.target.value }))}
                  className="w-7 h-7 rounded-lg border border-zinc-700 bg-transparent cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleConfig.isBold}
                    onChange={(e) =>
                      setStyleConfig((p) => ({ ...p, isBold: e.target.checked }))
                    }
                    className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Bold Weight</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleConfig.isUppercase}
                    onChange={(e) =>
                      setStyleConfig((p) => ({ ...p, isUppercase: e.target.checked }))
                    }
                    className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>UPPERCASE</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Subtitle Phone Mockup Preview */}
        <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Phone Preview</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">9:16 Short Video Mockup</span>
          </div>

          {/* 9:16 Mockup Frame */}
          <div className="w-full max-w-[240px] aspect-[9/16] bg-zinc-950 border-2 border-zinc-800 rounded-3xl mx-auto relative overflow-hidden shadow-2xl flex flex-col justify-between p-3 select-none">
            {/* Mock social UI icons */}
            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Following</span>
              <span className="text-white font-bold">For You</span>
              <span>Search</span>
            </div>

            {/* Subtitle positioned at vertical % */}
            <div
              className="absolute left-2 right-2 text-center pointer-events-none transition-all duration-100"
              style={{
                top: `${styleConfig.verticalPosition}%`,
                transform: 'translateY(-50%)',
              }}
            >
              <span
                className={`inline-block leading-[1.3] break-words whitespace-pre-wrap ${
                  styleConfig.isBold ? 'font-black' : 'font-medium'
                } ${styleConfig.isUppercase ? 'uppercase' : ''} ${
                  styleConfig.fontSize === 'sm'
                    ? 'text-xs'
                    : styleConfig.fontSize === 'md'
                    ? 'text-sm'
                    : styleConfig.fontSize === 'lg'
                    ? 'text-base'
                    : 'text-lg'
                }`}
                style={{
                  color: styleConfig.textColor,
                  textShadow: smoothOutline,
                  backgroundColor:
                    styleConfig.bgOpacity > 0
                      ? `${styleConfig.bgColor}${Math.round(styleConfig.bgOpacity * 255)
                          .toString(16)
                          .padStart(2, '0')}`
                      : 'transparent',
                  padding: styleConfig.bgOpacity > 0 ? '4px 10px' : '0',
                  borderRadius: styleConfig.bgOpacity > 0 ? '8px' : '0',
                }}
              >
                THIS IS HOW YOUR CAPTIONS LOOK
              </span>
            </div>

            {/* Mock right sidebar buttons */}
            <div className="self-end space-y-2 text-[10px] text-zinc-400 text-center">
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center">❤️</div>
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center">💬</div>
              <div className="w-7 h-7 rounded-full bg-zinc-800/80 flex items-center justify-center">↗️</div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 text-center">
            Adjusting the vertical placement slider moves subtitles above the comment and share buttons.
          </p>
        </div>
      </div>
    </div>
  );
}
