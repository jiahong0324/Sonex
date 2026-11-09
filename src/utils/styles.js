// Subtitle styling presets and CSS/FFmpeg generators

export const STYLE_PRESETS = [
  {
    id: 'tiktok-yellow',
    name: 'TikTok Bold Yellow',
    tag: 'Trending',
    textColor: '#FFE600',
    bgColor: '#000000',
    bgOpacity: 0,
    outlineColor: '#000000',
    outlineThickness: 2.8,
    isBold: true,
    shadow: 2,
    previewBg: 'bg-zinc-900',
  },
  {
    id: 'reels-box',
    name: 'Reels Dark Box',
    tag: 'Clean',
    textColor: '#FFFFFF',
    bgColor: '#09090B',
    bgOpacity: 0.75,
    outlineColor: '#000000',
    outlineThickness: 0,
    isBold: true,
    shadow: 0,
    previewBg: 'bg-zinc-900',
  },
  {
    id: 'minimal-clean',
    name: 'Clean White Pro',
    tag: 'Classic',
    textColor: '#FFFFFF',
    bgColor: '#000000',
    bgOpacity: 0,
    outlineColor: '#000000',
    outlineThickness: 2.2,
    isBold: true,
    shadow: 1.5,
    previewBg: 'bg-zinc-900',
  },
  {
    id: 'neon-cyan',
    name: 'Cyberpunk Neon',
    tag: 'Futuristic',
    textColor: '#00F2FE',
    bgColor: '#000000',
    bgOpacity: 0.3,
    outlineColor: '#050515',
    outlineThickness: 2.5,
    isBold: true,
    shadow: 3,
    previewBg: 'bg-zinc-950',
  },
  {
    id: 'cinema-classic',
    name: 'Cinema Warm',
    tag: 'Film',
    textColor: '#FDFCF7',
    bgColor: '#000000',
    bgOpacity: 0,
    outlineColor: '#1A1A1A',
    outlineThickness: 1.6,
    isBold: false,
    shadow: 2,
    previewBg: 'bg-zinc-900',
  },
  {
    id: 'flame-orange',
    name: 'Flame High-Energy',
    tag: 'Viral',
    textColor: '#FF7A00',
    bgColor: '#000000',
    bgOpacity: 0,
    outlineColor: '#000000',
    outlineThickness: 2.6,
    isBold: true,
    shadow: 2,
    previewBg: 'bg-zinc-900',
  }
];

export const DEFAULT_STYLE = {
  presetId: 'tiktok-yellow',
  fontSize: 'lg', // sm, md, lg, xl
  verticalPosition: 82, // percentage from top (82% = bottom third, perfect for Reels/TikTok)
  textColor: '#FFE600',
  bgColor: '#000000',
  bgOpacity: 0,
  outlineColor: '#000000',
  outlineThickness: 2.8,
  isBold: true,
  isUppercase: false,
};

/**
 * Creates CSS text-shadow string for realistic smooth outline
 */
export function createSmoothOutline(thickness, color) {
  if (thickness <= 0) return 'none';
  const steps = 36;
  const arr = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i * 2 * Math.PI) / steps;
    const x = (thickness * Math.cos(theta)).toFixed(2);
    const y = (thickness * Math.sin(theta)).toFixed(2);
    arr.push(`${x}px ${y}px 1.2px ${color}`);
  }
  return arr.join(', ');
}

/**
 * Convert Hex Color (#RRGGBB) to FFmpeg ASS color format (&H00BBGGRR&)
 */
export function hexToAssColor(hex, opacity = 1) {
  if (!hex || hex === 'none') return '&H00000000';
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  
  // Alpha in ASS is inverse: 00 = fully opaque, FF = fully transparent
  const alphaVal = Math.round((1 - opacity) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `&H${alphaVal}${b}${g}${r}&`;
}

/**
 * Generate FFmpeg subtitles filter string
 */
export function generateFFmpegSubStyle(styleConfig) {
  const fontSizes = {
    sm: 18,
    md: 22,
    lg: 26,
    xl: 32
  };
  const size = fontSizes[styleConfig.fontSize] || 24;
  const primaryColor = hexToAssColor(styleConfig.textColor, 1);
  const outlineColor = hexToAssColor(styleConfig.outlineColor, 1);
  
  const backColor = styleConfig.bgOpacity > 0 
    ? hexToAssColor(styleConfig.bgColor, styleConfig.bgOpacity)
    : '&HFF000000'; // transparent

  const outline = styleConfig.outlineThickness || 0;
  const bold = styleConfig.isBold ? 1 : 0;
  
  // Vertical margin in ASS (Alignment=2 is bottom centered)
  // verticalPosition is % from top, so margin from bottom is roughly (100 - verticalPosition)
  const marginV = Math.round(Math.max(20, (100 - (styleConfig.verticalPosition || 82)) * 6.5));

  // ASS style options
  const styleStr = [
    `PrimaryColour=${primaryColor}`,
    `OutlineColour=${outlineColor}`,
    `Outline=${outline}`,
    `BackColour=${backColor}`,
    `Shadow=${styleConfig.bgOpacity > 0 ? 0 : 2}`,
    `MarginV=${marginV}`,
    `Alignment=2`,
    `FontSize=${size}`,
    `Bold=${bold}`
  ].join(',');

  return styleStr;
}
