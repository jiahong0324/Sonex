/**
 * Unified Canvas Subtitle Renderer
 * Used identically by:
 * 1. Live video player preview overlay (<canvas>)
 * 2. WebCodecs export in Web Worker (OffscreenCanvas)
 * 3. MediaRecorder captureStream export fallback
 *
 * Guarantees 100% WYSIWYG rendering accuracy across all export pipelines.
 */

const CJK_REGEX = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/;
const PUNCTUATION_REGEX = /[，。？！,.?!；;:"'“”‘’]/;

export function isCJK(str) {
  return CJK_REGEX.test(str);
}

/**
 * Break a text string into atomic wrapping tokens:
 * - CJK characters are individual tokens (each character can break)
 * - Latin/numeric words stay together as atomic tokens (e.g. "Sonex", "100%")
 */
function tokenizeString(text) {
  if (!text) return [];
  const regex = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]|([a-zA-Z0-9_]+|[^\s\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]+)/g;
  return text.match(regex) || [];
}

/**
 * Synthesize word/character timestamps from caption
 * Handles pure English, pure CJK (Chinese/Japanese/Korean), and mixed text
 */
export function getCaptionWords(caption) {
  const duration = Math.max(0.1, caption.endTime - caption.startTime);

  // If words array is provided from Whisper
  if (caption.words && Array.isArray(caption.words) && caption.words.length > 0) {
    const refined = [];
    for (const item of caption.words) {
      const text = item.word || '';
      // If item contains CJK characters, split into individual characters for fine-grained wrapping and animation
      if (isCJK(text) && text.length > 1) {
        const tokens = tokenizeString(text);
        const itemDur = Math.max(0.05, (item.end || item.start + 0.3) - item.start);
        const timePerToken = itemDur / tokens.length;
        tokens.forEach((tok, idx) => {
          refined.push({
            word: tok,
            start: item.start + idx * timePerToken,
            end: item.start + (idx + 1) * timePerToken,
          });
        });
      } else {
        refined.push(item);
      }
    }
    return refined;
  }

  // If words array is not provided, tokenize the text cleanly
  const rawText = caption.text || '';
  const tokens = tokenizeString(rawText);
  if (tokens.length === 0) return [];

  const timePerToken = duration / tokens.length;
  return tokens.map((tok, idx) => ({
    word: tok,
    start: caption.startTime + idx * timePerToken,
    end: caption.startTime + (idx + 1) * timePerToken,
  }));
}

/**
 * Calculate typographic spacing between two consecutive tokens
 */
function getSpacingBetween(tokenA, tokenB, spaceWidth) {
  if (!tokenA || !tokenB) return 0;
  const textA = tokenA.word || '';
  const textB = tokenB.word || '';

  // No space before punctuation
  if (PUNCTUATION_REGEX.test(textB)) return 0;

  const aIsCJK = isCJK(textA);
  const bIsCJK = isCJK(textB);

  // Between two CJK characters: NO space (standard Asian typography)
  if (aIsCJK && bIsCJK) return 0;

  // Between two Latin words: standard full space
  if (!aIsCJK && !bIsCJK) return spaceWidth;

  // Between CJK and Latin: subtle breathing space
  return spaceWidth * 0.35;
}

/**
 * Split tokens into lines that fit within maxCanvasWidth without overflowing
 */
function layoutLines(ctx, tokens, maxCanvasWidth, isUppercase, spaceWidth) {
  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const item = tokens[i];
    const wordText = isUppercase ? item.word.toUpperCase() : item.word;
    const wordWidth = ctx.measureText(wordText).width;

    const prevItem = currentLine[currentLine.length - 1];
    const spacing = prevItem ? getSpacingBetween(prevItem, item, spaceWidth) : 0;

    // Check if adding this token overflows maxCanvasWidth
    if (currentLine.length > 0 && currentLineWidth + spacing + wordWidth > maxCanvasWidth) {
      lines.push(currentLine);
      currentLine = [{ ...item, spacingBefore: 0 }];
      currentLineWidth = wordWidth;
    } else {
      currentLine.push({ ...item, spacingBefore: spacing });
      currentLineWidth += spacing + wordWidth;
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

  // Base scale calculation: standardizes rendering relative to minimum dimension (screen width for vertical video)
  const baseDimension = Math.min(width, height);
  const scale = baseDimension / 1080;

  const fontSizes = {
    sm: 32,
    md: 38,
    lg: 46, // Standard viral size (clear, bold, fits ~14-16 chars per line comfortably)
    xl: 56,
    '2xl': 68,
  };
  const baseSize = typeof styleConfig.fontSize === 'number'
    ? styleConfig.fontSize
    : (fontSizes[styleConfig.fontSize] || 46);
  let fontSize = Math.round(baseSize * scale);

  const fontFamily = styleConfig.fontFamily || 'Impact, sans-serif';
  const fontWeight = styleConfig.isBold ? '900' : '600';
  const isUppercase = Boolean(styleConfig.isUppercase);

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const tokens = getCaptionWords(caption);
  // Maximum width: 82% of screen width (guarantees 9% margin on left and right)
  const maxLineWidth = width * 0.82;
  let spaceWidth = ctx.measureText(' ').width;

  // Initial layout calculation
  let lines = layoutLines(ctx, tokens, maxLineWidth, isUppercase, spaceWidth);

  // Dynamic Safety Shrink: if any line still exceeds maxLineWidth, gently reduce font size
  let maxMeasuredWidth = 0;
  lines.forEach((line) => {
    let lw = 0;
    line.forEach((item) => {
      const text = isUppercase ? item.word.toUpperCase() : item.word;
      lw += (item.spacingBefore || 0) + ctx.measureText(text).width;
    });
    if (lw > maxMeasuredWidth) maxMeasuredWidth = lw;
  });

  if (maxMeasuredWidth > maxLineWidth && maxMeasuredWidth > 0) {
    const shrinkFactor = Math.max(0.75, (maxLineWidth / maxMeasuredWidth) * 0.95);
    fontSize = Math.round(fontSize * shrinkFactor);
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    spaceWidth = ctx.measureText(' ').width;
    lines = layoutLines(ctx, tokens, maxLineWidth, isUppercase, spaceWidth);
  }

  const lineHeight = fontSize * 1.25;
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

  const outlineThickness = (styleConfig.outlineThickness || 0) * scale * 1.4;
  const hasOutline = outlineThickness > 0 && styleConfig.outlineColor && styleConfig.outlineColor !== 'transparent';
  const hasBg = styleConfig.bgOpacity > 0 && styleConfig.bgColor && styleConfig.bgColor !== 'transparent';

  // Render line by line
  lines.forEach((lineTokens, lineIdx) => {
    const lineY = blockStartY + lineIdx * lineHeight;

    // Calculate exact line width
    let lineWidth = 0;
    lineTokens.forEach((item) => {
      const text = isUppercase ? item.word.toUpperCase() : item.word;
      lineWidth += (item.spacingBefore || 0) + ctx.measureText(text).width;
    });

    // Ensure lineStartX is always safely within screen boundaries
    const lineStartX = Math.max(width * 0.05, (width - lineWidth) / 2);

    // 1. Draw Background Box / Pill if enabled
    if (hasBg) {
      ctx.save();
      const paddingX = fontSize * 0.35;
      const paddingY = fontSize * 0.16;
      const rectX = lineStartX - paddingX;
      const rectY = lineY - lineHeight / 2 - paddingY;
      const rectW = lineWidth + paddingX * 2;
      const rectH = lineHeight + paddingY * 2;
      const radius = Math.min(rectH / 2, 12 * scale);

      ctx.fillStyle = styleConfig.bgColor;
      ctx.globalAlpha = (styleConfig.bgOpacity ?? 0.8) * globalAlpha;
      drawRoundedRect(ctx, rectX, rectY, rectW, rectH, radius);
      ctx.fill();
      ctx.restore();
    }

    // 2. Draw tokens / words
    let currentX = lineStartX;

    lineTokens.forEach((item) => {
      const text = isUppercase ? item.word.toUpperCase() : item.word;
      const wordMetrics = ctx.measureText(text);
      const wordW = wordMetrics.width;
      const spacingBefore = item.spacingBefore || 0;

      currentX += spacingBefore;

      const isWordActive =
        currentTime >= item.start &&
        (item.end ? currentTime <= item.end : currentTime <= item.start + 0.35);

      // Animation parameters
      let wordScale = 1;
      let wordOffsetY = 0;

      if (isWordActive && styleConfig.animation === 'bounce') {
        const wordDur = Math.max(0.08, item.end - item.start);
        const progress = Math.max(0, Math.min(1, (currentTime - item.start) / wordDur));
        const bounceAmount = Math.sin(progress * Math.PI);
        wordScale = 1 + bounceAmount * 0.16;
        wordOffsetY = -bounceAmount * 5 * scale;
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

      currentX += wordW;
    });
  });

  ctx.restore();
}
