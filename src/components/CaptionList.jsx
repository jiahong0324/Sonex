import { useState, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  Scissors,
  Link2,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  Clock,
  Sparkles,
  AlertTriangle,
  Check,
  X,
  Edit3,
} from 'lucide-react';
import { secondsToTimeStr } from '../utils/timeUtils';

export default function CaptionList({
  captions,
  setCaptions,
  currentTime,
  onSeek,
  onOpenFindReplace,
  autoScrollEnabled,
  setAutoScrollEnabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showFeedback,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [timeOffset, setTimeOffset] = useState('');
  const [showShiftControls, setShowShiftControls] = useState(false);

  const listContainerRef = useRef(null);
  const lastActiveIdRef = useRef(null);

  // Auto-scroll to active caption block
  useEffect(() => {
    if (!autoScrollEnabled || editingId) return;

    const active = captions.find(
      (cap) => currentTime >= cap.startTime && currentTime <= cap.endTime
    );

    if (active && active.id !== lastActiveIdRef.current) {
      lastActiveIdRef.current = active.id;
      const element = document.getElementById(`cap-card-${active.id}`);
      if (element && listContainerRef.current) {
        const container = listContainerRef.current;
        const elemTop = element.offsetTop;
        const elemHeight = element.offsetHeight;
        const contHeight = container.clientHeight;
        const currentScroll = container.scrollTop;

        if (elemTop < currentScroll || elemTop + elemHeight > currentScroll + contHeight) {
          container.scrollTo({
            top: Math.max(0, elemTop - contHeight / 2 + elemHeight / 2),
            behavior: 'smooth',
          });
        }
      }
    } else if (!active) {
      lastActiveIdRef.current = null;
    }
  }, [currentTime, captions, autoScrollEnabled, editingId]);

  // Edit Handlers
  const handleStartEdit = (cap) => {
    setEditingId(cap.id);
    setEditText(cap.text);
  };

  const handleSaveEdit = (id) => {
    if (!editText.trim()) {
      showFeedback('error', 'Caption text cannot be empty.');
      return;
    }
    setCaptions((prev) =>
      prev.map((cap) => (cap.id === id ? { ...cap, text: editText.trim() } : cap))
    );
    setEditingId(null);
    showFeedback('success', 'Caption updated.');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Split Caption Block into Two
  const handleSplitCaption = (id) => {
    const index = captions.findIndex((c) => c.id === id);
    if (index === -1) return;

    const target = captions[index];
    const duration = target.endTime - target.startTime;
    if (duration < 0.4) {
      showFeedback('error', 'Subtitle block duration is too short to split.');
      return;
    }

    const midTime = target.startTime + duration / 2;
    const text = target.text.trim();

    // Try splitting by space or punctuation if possible
    let part1 = text;
    let part2 = text;
    const words = text.split(/\s+/);
    if (words.length > 1) {
      const midWord = Math.ceil(words.length / 2);
      part1 = words.slice(0, midWord).join(' ');
      part2 = words.slice(midWord).join(' ');
    } else if (text.length > 4) {
      const midChar = Math.ceil(text.length / 2);
      part1 = text.substring(0, midChar);
      part2 = text.substring(midChar);
    }

    const firstBlock = {
      ...target,
      endTime: midTime,
      endStr: secondsToTimeStr(midTime),
      text: part1,
    };

    const secondBlock = {
      id: Date.now(),
      startTime: midTime,
      endTime: target.endTime,
      startStr: secondsToTimeStr(midTime),
      endStr: target.endStr,
      text: part2,
    };

    const updated = [...captions];
    updated.splice(index, 1, firstBlock, secondBlock);

    // Re-index IDs cleanly
    const reindexed = updated.map((c, i) => ({ ...c, id: i + 1 }));
    setCaptions(reindexed);
    showFeedback('success', `Split block #${target.id} into two segments.`);
  };

  // Merge with Next Caption Block
  const handleMergeNext = (id) => {
    const index = captions.findIndex((c) => c.id === id);
    if (index === -1 || index === captions.length - 1) {
      showFeedback('error', 'Cannot merge the last subtitle block.');
      return;
    }

    const current = captions[index];
    const next = captions[index + 1];

    const mergedBlock = {
      ...current,
      endTime: next.endTime,
      endStr: next.endStr,
      text: `${current.text} ${next.text}`.trim(),
    };

    const updated = [...captions];
    updated.splice(index, 2, mergedBlock);

    const reindexed = updated.map((c, i) => ({ ...c, id: i + 1 }));
    setCaptions(reindexed);
    showFeedback('success', `Merged block #${current.id} and #${next.id}.`);
  };

  // Delete Caption Block
  const handleDeleteCaption = (id) => {
    const updated = captions.filter((c) => c.id !== id);
    const reindexed = updated.map((c, i) => ({ ...c, id: i + 1 }));
    setCaptions(reindexed);
    showFeedback('success', `Deleted caption block.`);
  };

  // Fine-tune timing for single caption
  const handleAdjustTiming = (id, field, delta) => {
    setCaptions((prev) =>
      prev.map((cap) => {
        if (cap.id !== id) return cap;

        let newStart = cap.startTime;
        let newEnd = cap.endTime;

        if (field === 'start') {
          newStart = Math.max(0, cap.startTime + delta);
          if (newStart >= newEnd) newStart = newEnd - 0.1;
        } else if (field === 'end') {
          newEnd = Math.max(newStart + 0.1, cap.endTime + delta);
        }

        return {
          ...cap,
          startTime: newStart,
          endTime: newEnd,
          startStr: secondsToTimeStr(newStart),
          endStr: secondsToTimeStr(newEnd),
        };
      })
    );
  };

  // Add new caption block at current playhead
  const handleAddCaptionAtPlayhead = () => {
    const newStart = currentTime;
    const newEnd = currentTime + 2.0;

    const newBlock = {
      id: Date.now(),
      startTime: newStart,
      endTime: newEnd,
      startStr: secondsToTimeStr(newStart),
      endStr: secondsToTimeStr(newEnd),
      text: 'New Subtitle',
    };

    const updated = [...captions, newBlock].sort((a, b) => a.startTime - b.startTime);
    const reindexed = updated.map((c, i) => ({ ...c, id: i + 1 }));
    setCaptions(reindexed);
    showFeedback('success', `Added new block at ${secondsToTimeStr(newStart)}.`);
  };

  // Global Time Shift
  const handleApplyShift = (overrideVal) => {
    const shift = parseFloat(overrideVal !== undefined ? overrideVal : timeOffset);
    if (isNaN(shift) || shift === 0) return;

    const updated = captions.map((cap) => {
      const newStart = Math.max(0, cap.startTime + shift);
      const newEnd = Math.max(0, cap.endTime + shift);
      return {
        ...cap,
        startTime: newStart,
        endTime: newEnd,
        startStr: secondsToTimeStr(newStart),
        endStr: secondsToTimeStr(newEnd),
      };
    });

    setCaptions(updated);
    setTimeOffset('');
    showFeedback('success', `Shifted all timestamps by ${shift > 0 ? '+' : ''}${shift}s.`);
  };

  const filteredCaptions = captions.filter((cap) =>
    cap.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex flex-col h-full space-y-3.5">
      {/* Top Toolbar: Search, Find/Replace, Undo/Redo, Sync */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search subtitle text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-zinc-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Batch Find & Replace Button */}
          <button
            type="button"
            onClick={onOpenFindReplace}
            className="px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
            title="Batch Find & Replace (Ctrl+F)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Replace</span>
          </button>
        </div>

        {/* Undo / Redo & Add Block */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-xl border border-zinc-800 text-xs transition-all ${
              canUndo
                ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-200'
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-xl border border-zinc-800 text-xs transition-all ${
              canRedo
                ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-200'
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Global Time Shift Toggle */}
          <button
            type="button"
            onClick={() => setShowShiftControls(!showShiftControls)}
            className={`p-1.5 rounded-xl border text-xs transition-all ${
              showShiftControls
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
            title="Global Timestamp Shift"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* Add block */}
          <button
            type="button"
            onClick={handleAddCaptionAtPlayhead}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
            title="Insert new block at current time"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>

      {/* Global Timestamp Shift Drawer */}
      {showShiftControls && (
        <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold">
            <span>Global Time Offset (Fix Audio Sync)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplyShift(-0.5)}
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300"
              >
                -0.5s
              </button>
              <button
                type="button"
                onClick={() => handleApplyShift(-0.2)}
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300"
              >
                -0.2s
              </button>
              <button
                type="button"
                onClick={() => handleApplyShift(0.2)}
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300"
              >
                +0.2s
              </button>
              <button
                type="button"
                onClick={() => handleApplyShift(0.5)}
                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300"
              >
                +0.5s
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              placeholder="e.g. -1.2 or 0.3"
              value={timeOffset}
              onChange={(e) => setTimeOffset(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
            <button
              type="button"
              onClick={() => handleApplyShift()}
              className="bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold px-3 py-1 rounded-lg transition-all"
            >
              Apply Shift
            </button>
          </div>
        </div>
      )}

      {/* Subtitles Status Bar */}
      <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-850 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-300">
            Captions ({filteredCaptions.length})
          </span>
          {searchQuery && (
            <span className="text-[11px] text-emerald-400">
              Matches: {filteredCaptions.length}
            </span>
          )}
        </div>

        {/* Auto Sync Toggle */}
        <button
          type="button"
          onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
          className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
            autoScrollEnabled
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-zinc-950 text-zinc-500 border-zinc-800'
          }`}
          title="Toggle Auto-Scroll to current caption during video playback"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              autoScrollEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span>{autoScrollEnabled ? 'Auto-Sync ON' : 'Auto-Sync OFF'}</span>
        </button>
      </div>

      {/* Scrollable Subtitle Block Cards */}
      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar min-h-[300px]"
      >
        {filteredCaptions.map((cap, index) => {
          const isActive = currentTime >= cap.startTime && currentTime <= cap.endTime;
          const isEditing = editingId === cap.id;
          const isTooLong = cap.text.length > 42;

          return (
            <div
              key={cap.id}
              id={`cap-card-${cap.id}`}
              onClick={() => {
                if (!isEditing) onSeek(cap.startTime);
              }}
              className={`p-3.5 rounded-2xl transition-all border cursor-pointer group ${
                isActive
                  ? 'bg-emerald-500/[0.08] border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.005]'
                  : 'bg-zinc-950/70 hover:bg-zinc-900/60 border-zinc-850 hover:border-zinc-700'
              }`}
            >
              {/* Header: ID, Timestamps, Fine-tune & Actions */}
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-bold">
                    #{cap.id}
                  </span>
                  <span
                    className={`font-mono text-xs font-semibold ${
                      isActive ? 'text-emerald-400' : 'text-zinc-300'
                    }`}
                  >
                    {cap.startStr} &rarr; {cap.endStr}
                  </span>
                </div>

                {/* Block Operation Tools */}
                <div
                  className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Fine-tune start time */}
                  <div className="hidden sm:flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => handleAdjustTiming(cap.id, 'start', -0.1)}
                      className="px-1 hover:text-emerald-400"
                      title="Start -0.1s"
                    >
                      -
                    </button>
                    <span className="px-0.5 text-zinc-500">In</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustTiming(cap.id, 'start', 0.1)}
                      className="px-1 hover:text-emerald-400"
                      title="Start +0.1s"
                    >
                      +
                    </button>
                  </div>

                  {/* Split Button */}
                  <button
                    type="button"
                    onClick={() => handleSplitCaption(cap.id)}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                    title="Split into two segments"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>

                  {/* Merge with next */}
                  {index < filteredCaptions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleMergeNext(cap.id)}
                      className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Merge with next block"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Edit Text */}
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cap)}
                      className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Edit text"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cap.id)}
                        className="p-1 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors"
                        title="Save text"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCaption(cap.id)}
                    className="p-1 rounded-lg hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Delete block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Text Body */}
              {isEditing ? (
                <div onClick={(e) => e.stopPropagation()} className="space-y-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-medium h-20"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2.5 py-1 text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(cap.id)}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={`text-sm leading-relaxed ${
                    isActive ? 'text-white font-bold' : 'text-zinc-200'
                  }`}
                >
                  {cap.text}
                </p>
              )}

              {/* Length Warning */}
              {!isEditing && isTooLong && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400/90 font-medium">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>Length ({cap.text.length} chars) exceeds short video optimal limit. Consider splitting.</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty States */}
        {captions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center py-16 text-center text-zinc-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-400">No Captions Generated Yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Upload a video in the Studio or AI Transcribe tab to automatically create subtitles.
              </p>
            </div>
          </div>
        )}

        {captions.length > 0 && filteredCaptions.length === 0 && (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No captions match "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
}
