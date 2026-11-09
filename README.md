# Sonex Studio Pro (v2.0)

> **Next-Gen AI Subtitler & Social Media Video Studio**  
> Generate, customize, fine-tune, and burn stylized captions into short-form videos instantaneously in your browser.

![Sonex Studio Banner](public/logo.png)

---

## ⚡ What is Sonex Studio Pro?

Sonex Studio Pro is a high-performance web workstation designed specifically for short-form video creators (TikTok, Instagram Reels, YouTube Shorts, CapCut, Premiere Pro). 

It combines **in-browser 16kHz mono audio extraction**, **Groq LPU™-accelerated OpenAI Whisper speech recognition**, an **interactive visual timeline scrubber**, a **comprehensive subtitle editing suite**, **viral styling presets**, and **in-browser FFmpeg WebAssembly video hard-sub burning**.

---

## 🚀 Key Features & Upgrades

### 1. 🎙️ High-Speed AI Speech Recognition
- **Groq LPU™ Powered**: Sub-second transcription response time using Whisper models.
- **Model Options**: 
  - `whisper-large-v3` (Pro Max): Maximum multilingual vocabulary and punctuation accuracy.
  - `whisper-large-v3-turbo` (Pro Turbo): Ultra-responsive inference.
- **Client-Side Audio Extraction**: Browser-native Web Audio API (`AudioContext`) extracts and decodes video audio tracks into lightweight 16kHz mono WAV, bypassing the 25MB API limit for 4K/heavy files and saving 95%+ network bandwidth.
- **Custom Glossary & Prompt**: Inject brand names, creator tags, slang, or technical terms to boost Whisper recognition accuracy.
- **Multi-language Support**: Auto-detect, English, Chinese (中文), Japanese, Korean, Spanish, French, German, Indonesian, Vietnamese, etc.

### 2. ✂️ Professional Subtitle Editor & Timeline
- **Visual Timeline Scrubber**: Interactive duration timeline with color-coded subtitle blocks and live playhead synchronization.
- **Split Subtitle (✂️)**: Split long sentences into two balanced timed segments at the midpoint.
- **Merge Subtitles (🔗)**: Seamlessly combine a caption block with the following block.
- **Timestamp Fine-Tuning**: Quick `[-0.1s]` / `[+0.1s]` buttons for start and end times per block.
- **Global Time Offset**: Shift all subtitle timestamps by `+/- 0.1s`, `0.2s`, `0.5s` or custom values to fix out-of-sync audio.
- **Undo / Redo (Ctrl+Z / Ctrl+Y)**: Full state history tracking up to 30 steps.
- **Batch Find & Replace (Ctrl+F)**: Search and batch replace misrecognized words or names across all subtitles with case sensitivity.
- **Viral Shorts Optimization**: Automatically warns when a caption exceeds optimal line limits (~42 characters) to avoid awkward multi-line wrapping in CapCut.

### 3. 🎨 Subtitle Style & Presets Studio
- **Viral Presets**:
  - `TikTok Bold Yellow` (High contrast yellow with thick dark outline)
  - `Reels Dark Box` (Clean white text in modern translucent pill box)
  - `Clean White Pro` (Classic crisp white with smooth shadow)
  - `Cyberpunk Neon` (Electric cyan glow for tech & gaming content)
  - `Cinema Warm` (Warm off-white for cinematic storytelling)
  - `Flame High-Energy` (Vibrant orange for reaction and high-energy content)
- **Custom Style Parameters**:
  - Font Size: Small, Medium, Large, Extra Large
  - Vertical Placement Slider (20% to 92%) with indicator for TikTok/Reels UI safe zones
  - Text color & background box opacity
  - Outline thickness & color
  - Bold weight & UPPERCASE toggles
- **Interactive Phone Mockup**: Real-time 9:16 vertical preview showing how subtitles render against mobile UI elements.

### 4. 🎬 In-Browser Video Hard-Sub Burner (FFmpeg WASM)
- Burns stylized subtitles directly onto MP4 video frames without leaving the browser.
- Uses bundled WebAssembly core (`@ffmpeg/ffmpeg`) with CJK Unicode font support.
- Custom ASS subtitle filter generation matching your exact selected style preset and position.
- Real-time progress bar with stage feedback and automatic MP4 download.

### 5. 📥 Multi-Format Import & Export
- **Export Options**:
  - `.SRT` (SubRip Subtitles, standard for CapCut, Premiere, DaVinci, Final Cut Pro)
  - `.VTT` (WebVTT for HTML5 video players)
  - `.TXT` (Plain text script without timestamps)
  - `.JSON` (Structured JSON for developers)
  - One-click copy transcript to clipboard
- **Import Option**:
  - Load existing `.srt` or `.vtt` files directly into Sonex without re-running AI transcription.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause Video |
| `←` / `→` | Seek Backward / Forward 2 Seconds |
| `[` / `]` | Jump to Previous / Next Subtitle Block |
| `Ctrl + Z` | Undo Subtitle Edit |
| `Ctrl + Y` | Redo Subtitle Edit |
| `Ctrl + F` | Open Batch Find & Replace |
| `?` | Show Shortcuts Cheat Sheet |

---

## 🛠️ Tech Stack

- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Speech-to-Text**: Groq Cloud (OpenAI Whisper Large v3 / Turbo)
- **Audio Processing**: Web Audio API (`AudioContext`)
- **Video Processing**: `@ffmpeg/ffmpeg` 0.12 (WebAssembly single-threaded)
- **Local Storage**: `localforage` (IndexedDB persistence)
- **PWA**: `vite-plugin-pwa`

---

## 📦 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/sonex.git
cd sonex
npm install
```

### 2. Development Server
```bash
npm run dev
```

### 3. Production Build
```bash
npm run build
```

---

## 📄 License

MIT License &copy; 2026 Sonex. Built for high-speed creative workflows.
