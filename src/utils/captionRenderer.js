/**
 * Unified Canvas Subtitle Renderer
 * Used identically by:
 * 1. Live video player preview overlay (<canvas>)
 * 2. WebCodecs export in Web Worker (OffscreenCanvas)
 * 3. MediaRecorder captureStream export fallback
 *
 * Guarantees 100% WYSIWYG rendering accuracy across all export pipelines.
 */

// Synthesize word timestamps if caption only has sentence-level timing
export function getCaptionWords(caption) {
  if (caption.words && Array.isArray(caption.words) && caption.words.length > 0) {
    return caption.words;
  }

  const rawText = caption.text || '';
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const duration = Math.max(0.1, caption.endTime - caption.startTime);
  const timePerWord = duration / words.length;

  return words.map((w, idx) => ({
    word: w,
    start: caption.startTime + idx * timePerWord,
    end: caption.startTime + (idx + 1) * timePerWord,
  }));
}

/**
 * Split words into balanced lines that fit within maxCanvasWidth
 */
function layoutLines(ctx, words, maxCanvasWidth, isUppercase) {
  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;
  const spaceWidth = ctx.measureText(' ').width;

  for (const item of words) {
    const wordText = isUppercase ? item.word.toUpperCase() : item.word;
    const wordWidth = ctx.measureText(wordText).width;

    if (currentLine.length > 0 && currentLineWidth + spaceWidth + wordWidth > maxCanvasWidth) {
      lines.push(currentLine);
      currentLine = [item];
      currentLineWidth = wordWidth;
    } else {
      currentLine.push(item);
      currentLineWidth += (currentLine.length === 1 ? 0 : spaceWidth) + wordWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Draw rounded rectangle helper (cross-browser / worker compatible)
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }
}

/**
 * Render platform UI safe zones for TikTok / Reels / Shorts
 */
export function drawSafeZones(ctx, width, height, platform = 'tiktok') {
  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
  ctx.lineWidth = Math.max(2, height * 0.002);
  ctx.setLineDash([8, 8]);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';

  // Top header zone (search, tabs) ~14%
  const topH = height * 0.14;
  ctx.fillRect(0, 0, width, topH);
  ctx.strokeRect(0, 0, width, topH);

  // Bottom caption & audio info ~22%
  const bottomH = height * 0.22;
  ctx.fillRect(0, height - bottomH, width, bottomH);
  ctx.strokeRect(0, height - bottomH, width, bottomH);

  // Right interaction zone (avatar, like, comment, share) ~18% width, middle right
  const rightW = width * 0.18;
  const rightTop = topH;
  const rightH = height - topH - bottomH;
  ctx.fillRect(width - rightW, rightTop, rightW, rightH);
  ctx.strokeRect(width - rightW, rightTop, rightW, rightH);

  // Label text
  ctx.font = `600 ${Math.round(height * 0.016)}px sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  const platformLabel =
    platform === 'reels' ? 'Instagram Reels Safe Zone' :
    platform === 'shorts' ? 'YouTube Shorts Safe Zone' :
    'TikTok / Reels Safe Zone';
  ctx.fillText(platformLabel, width * 0.5, height - bottomH + 28);
  ctx.restore();
}

/**
 * Main draw function: renders subtitle onto the given 2D context
 */
export function drawCaptionFrame(ctx, caption, currentTime, styleConfig, options = {}) {
  const {
    width = 1080,
    height = 1920,
    showSafeZones = false,
    safeZonePlatform = 'tiktok',
  } = options;

  if (showSafeZones) {
    drawSafeZones(ctx, width, height, safeZonePlatform);
  }

  if (!caption || !caption.text) return;

  // Base scale calculation: standardizes rendering relative to 1080px base
  const scale = height / 1080;

  const fontSizes = {
    sm: 36,
    md: 46,
    lg: 58,
    xl: 72,
    '2xl': 90,
  };
  const baseSize = typeof styleConfig.fontSize === 'number'
    ? styleConfig.fontSize
    : (fontSizes[styleConfig.fontSize] || 58);
  const fontSize = Math.round(baseSize * scale);

  const fontFamily = styleConfig.fontFamily || 'Impact, sans-serif';
  const fontWeight = styleConfig.isBold ? '900' : '600';
  const isUppercase = Boolean(styleConfig.isUppercase);

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const words = getCaptionWords(caption);
  const maxLineWidth = width * 0.86;
  const spaceWidth = ctx.measureText(' ').width;
  const lineHeight = fontSize * 1.25;

  const lines = layoutLines(ctx, words, maxLineWidth, isUppercase);
  const totalBlockHeight = lines.length * lineHeight;

  // Vertical placement (percentage from top)
  const vPosPercent = (styleConfig.verticalPosition ?? 82) / 100;
  const blockCenterY = height * vPosPercent;
  const blockStartY = blockCenterY - totalBlockHeight / 2 + lineHeight / 2;

  // Global fade-in calculation if animation === 'fade'
  let globalAlpha = 1;
  if (styleConfig.animation === 'fade') {
    const fadeInDuration = 0.15;
    const elapsed = currentTime - caption.startTime;
    if (elapsed < fadeInDuration) {
      globalAlpha = Math.max(0, Math.min(1, elapsed / fadeInDuration));
    }
  }
  ctx.globalAlpha = globalAlpha;

  const outlineThickness = (styleConfig.outlineThickness || 0) * scale * 1.5;
  const hasOutline = outlineThickness > 0 && styleConfig.outlineColor && styleConfig.outlineColor !== 'transparent';
  const hasBg = styleConfig.bgOpacity > 0 && styleConfig.bgColor && styleConfig.bgColor !== 'transparent';

  // Render line by line
  lines.forEach((lineWords, lineIdx) => {
    const lineY = blockStartY + lineIdx * lineHeight;

    // Calculate line width
    let lineWidth = 0;
    lineWords.forEach((item, idx) => {
      const text = isUppercase ? item.word.toUpperCase() : item.word;
      lineWidth += ctx.measureText(text).width;
      if (idx < lineWords.length - 1) lineWidth += spaceWidth;
    });

    const lineStartX = (width - lineWidth) / 2;

    // 1. Draw Background Box / Pill if enabled
    if (hasBg) {
      ctx.save();
      const paddingX = fontSize * 0.35;
      const paddingY = fontSize * 0.18;
      const rectX = lineStartX - paddingX;
      const rectY = lineY - lineHeight / 2 - paddingY;
      const rectW = lineWidth + paddingX * 2;
      const rectH = lineHeight + paddingY * 2;
      const radius = Math.min(rectH / 2, 16 * scale);

      ctx.fillStyle = styleConfig.bgColor;
      ctx.globalAlpha = (styleConfig.bgOpacity ?? 0.8) * globalAlpha;
      drawRoundedRect(ctx, rectX, rectY, rectW, rectH, radius);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw words
    let currentX = lineStartX;

    lineWords.forEach((item) => {
      const text = isUppercase ? item.word.toUpperCase() : item.word;
      const wordMetrics = ctx.measureText(text);
      const wordW = wordMetrics.width;

      const isWordActive =
        currentTime >= item.start &&
        (item.end ? currentTime <= item.end : currentTime <= item.start + 0.35);

      // Animation parameters
      let wordScale = 1;
      let wordOffsetY = 0;

      if (isWordActive && styleConfig.animation === 'bounce') {
        const wordDur = Math.max(0.1, item.end - item.start);
        const progress = Math.max(0, Math.min(1, (currentTime - item.start) / wordDur));
        // Sine bounce curve
        const bounceAmount = Math.sin(progress * Math.PI);
        wordScale = 1 + bounceAmount * 0.16;
        wordOffsetY = -bounceAmount * 6 * scale;
      }

      ctx.save();

      // Transform around word center if scaling
      if (wordScale !== 1) {
        const centerX = currentX + wordW / 2;
        const centerY = lineY + wordOffsetY;
        ctx.translate(centerX, centerY);
        ctx.scale(wordScale, wordScale);
        ctx.translate(-centerX, -centerY);
      } else if (wordOffsetY !== 0) {
        ctx.translate(0, wordOffsetY);
      }

      // Configure Shadow
      if (styleConfig.shadowBlur > 0 || styleConfig.shadowOffsetX !== 0 || styleConfig.shadowOffsetY !== 0) {
        ctx.shadowColor = styleConfig.shadowColor || 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = (styleConfig.shadowBlur || 4) * scale;
        ctx.shadowOffsetX = (styleConfig.shadowOffsetX || 0) * scale;
        ctx.shadowOffsetY = (styleConfig.shadowOffsetY || 3) * scale;
      }

      // Configure Outline Stroke
      if (hasOutline) {
        ctx.strokeStyle = styleConfig.outlineColor;
        ctx.lineWidth = outlineThickness;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeText(text, currentX, lineY);
      }

      // Fill Text with active / inactive color
      const fillColor = isWordActive
        ? (styleConfig.activeWordColor || '#FFFFFF')
        : (styleConfig.textColor || '#FFFFFF');

      ctx.fillStyle = fillColor;
      ctx.fillText(text, currentX, lineY);

      ctx.restore();

      currentX += wordW + spaceWidth;
    });
  });

  ctx.restore();
}
