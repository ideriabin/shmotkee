import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/global.css';
import App from './app/App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

// Fade out the inline splash once the app has mounted. requestAnimationFrame
// gives Svelte a tick to paint the first frame so the cross-fade is to
// something, not from-burgundy-to-blank.
const splash = document.getElementById('splash');
if (splash) {
  requestAnimationFrame(() => {
    splash.classList.add('fade');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Safety: remove after a generous timeout even if transitionend never fires.
    setTimeout(() => splash.remove(), 1200);
  });
}

// Dev-only fixture seeder. Call `window.__seedFixtures()` from devtools or
// Playwright to populate the library with synthetic items for visual testing.
if (import.meta.env.DEV) {
  (window as unknown as { __seedFixtures: () => Promise<void> }).__seedFixtures = async () => {
    const { createItem } = await import('./db/items');
    const { db } = await import('./db/schema');
    await db.items.clear();
    await db.savedOutfits.clear();
    await db.sessions.clear();

    type Fix = {
      name: string;
      slot:
        | 'top'
        | 'bottom'
        | 'outerwear'
        | 'shoes'
        | 'accessories'
        | 'full_body'
        | 'other';
      shape: 'tee' | 'pants' | 'coat' | 'shoes' | 'bag' | 'dress' | 'sunglasses' | 'cardigan';
      tint: string;
      z?: number;
    };

    const fixtures: Fix[] = [
      { name: 'белая майка', slot: 'top', shape: 'tee', tint: '#F2EFEC' },
      { name: 'чёрный лонгслив', slot: 'top', shape: 'tee', tint: '#0E0B0C' },
      { name: 'тёмно-зелёный гольф', slot: 'top', shape: 'tee', tint: '#0F2C24' },
      { name: 'кардиган-чёрный', slot: 'top', shape: 'cardigan', tint: '#161114', z: 1 },
      { name: 'кардиган-серый', slot: 'top', shape: 'cardigan', tint: '#3A3338', z: 1 },
      { name: 'кожаные брюки', slot: 'bottom', shape: 'pants', tint: '#0A0708' },
      { name: 'чёрный пинстрайп', slot: 'bottom', shape: 'pants', tint: '#161217' },
      { name: 'винил-низ', slot: 'bottom', shape: 'pants', tint: '#1A0F12' },
      { name: 'пальто-длинное', slot: 'outerwear', shape: 'coat', tint: '#1B1416' },
      { name: 'мех-куртка', slot: 'outerwear', shape: 'coat', tint: '#28201E' },
      { name: 'платье-сетка', slot: 'full_body', shape: 'dress', tint: '#0F0B0C' },
      { name: 'красные туфли', slot: 'shoes', shape: 'shoes', tint: '#8A1C2A' },
      { name: 'чёрные ботинки', slot: 'shoes', shape: 'shoes', tint: '#0B0809' },
      { name: 'кеды белые', slot: 'shoes', shape: 'shoes', tint: '#EDEAE6' },
      { name: 'очки-кошки', slot: 'accessories', shape: 'sunglasses', tint: '#0D0809' },
      { name: 'сумка-белая', slot: 'accessories', shape: 'bag', tint: '#E9E5E1' },
    ];

    for (const f of fixtures) {
      const blob = await makeSyntheticBlob(f.shape, f.tint);
      const thumb = await makeSyntheticBlob(f.shape, f.tint, 320);
      await createItem({
        name: f.name,
        slot: f.slot,
        blob,
        thumbnail: thumb,
        zPriority: f.z ?? 0,
      });
    }
    console.info('seeded', fixtures.length, 'classified items');
  };

  // Dump variant — all items unclassified, to test the triage flows.
  (window as unknown as { __seedDump: () => Promise<void> }).__seedDump = async () => {
    const { createItem } = await import('./db/items');
    const { db } = await import('./db/schema');
    await db.items.clear();
    await db.savedOutfits.clear();
    await db.sessions.clear();

    const shapes: { name: string; shape: string; tint: string }[] = [
      { name: 'белая майка', shape: 'tee', tint: '#F2EFEC' },
      { name: 'чёрный лонгслив', shape: 'tee', tint: '#0E0B0C' },
      { name: 'тёмно-зелёный гольф', shape: 'tee', tint: '#0F2C24' },
      { name: 'кардиган чёрный', shape: 'cardigan', tint: '#161114' },
      { name: 'кардиган серый', shape: 'cardigan', tint: '#3A3338' },
      { name: 'кожаные брюки', shape: 'pants', tint: '#0A0708' },
      { name: 'чёрный пинстрайп', shape: 'pants', tint: '#161217' },
      { name: 'винил-низ', shape: 'pants', tint: '#1A0F12' },
      { name: 'пальто длинное', shape: 'coat', tint: '#1B1416' },
      { name: 'мех-куртка', shape: 'coat', tint: '#28201E' },
      { name: 'платье-сетка', shape: 'dress', tint: '#0F0B0C' },
      { name: 'красные туфли', shape: 'shoes', tint: '#8A1C2A' },
      { name: 'чёрные ботинки', shape: 'shoes', tint: '#0B0809' },
      { name: 'кеды белые', shape: 'shoes', tint: '#EDEAE6' },
      { name: 'очки-кошки', shape: 'sunglasses', tint: '#0D0809' },
      { name: 'сумка белая', shape: 'bag', tint: '#E9E5E1' },
    ];

    for (const f of shapes) {
      const blob = await makeSyntheticBlob(f.shape, f.tint);
      const thumb = await makeSyntheticBlob(f.shape, f.tint, 320);
      await createItem({
        name: f.name,
        slot: null,
        blob,
        thumbnail: thumb,
      });
    }
    console.info('dumped', shapes.length, 'unclassified items');
  };
}

async function makeSyntheticBlob(
  shape: string,
  tint: string,
  size = 800,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  drawShape(ctx, shape, tint, size);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png',
    );
  });
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  tint: string,
  size: number,
) {
  ctx.fillStyle = tint;
  ctx.strokeStyle = mix(tint, '#000', 0.5);
  ctx.lineWidth = size * 0.01;
  const s = size;
  ctx.save();
  switch (shape) {
    case 'tee': {
      // T-shirt silhouette
      ctx.beginPath();
      ctx.moveTo(s * 0.25, s * 0.25);
      ctx.lineTo(s * 0.4, s * 0.18);
      ctx.bezierCurveTo(s * 0.45, s * 0.32, s * 0.55, s * 0.32, s * 0.6, s * 0.18);
      ctx.lineTo(s * 0.75, s * 0.25);
      ctx.lineTo(s * 0.85, s * 0.45);
      ctx.lineTo(s * 0.78, s * 0.5);
      ctx.lineTo(s * 0.75, s * 0.85);
      ctx.lineTo(s * 0.25, s * 0.85);
      ctx.lineTo(s * 0.22, s * 0.5);
      ctx.lineTo(s * 0.15, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'cardigan': {
      ctx.beginPath();
      ctx.moveTo(s * 0.2, s * 0.2);
      ctx.lineTo(s * 0.4, s * 0.18);
      ctx.lineTo(s * 0.5, s * 0.32);
      ctx.lineTo(s * 0.6, s * 0.18);
      ctx.lineTo(s * 0.8, s * 0.2);
      ctx.lineTo(s * 0.88, s * 0.5);
      ctx.lineTo(s * 0.8, s * 0.55);
      ctx.lineTo(s * 0.78, s * 0.9);
      ctx.lineTo(s * 0.22, s * 0.9);
      ctx.lineTo(s * 0.2, s * 0.55);
      ctx.lineTo(s * 0.12, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // center opening
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.32);
      ctx.lineTo(s * 0.5, s * 0.9);
      ctx.stroke();
      break;
    }
    case 'pants': {
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.1);
      ctx.lineTo(s * 0.7, s * 0.1);
      ctx.lineTo(s * 0.72, s * 0.4);
      ctx.lineTo(s * 0.62, s * 0.95);
      ctx.lineTo(s * 0.52, s * 0.95);
      ctx.lineTo(s * 0.5, s * 0.45);
      ctx.lineTo(s * 0.48, s * 0.95);
      ctx.lineTo(s * 0.38, s * 0.95);
      ctx.lineTo(s * 0.28, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'coat': {
      ctx.beginPath();
      ctx.moveTo(s * 0.18, s * 0.18);
      ctx.lineTo(s * 0.4, s * 0.12);
      ctx.lineTo(s * 0.5, s * 0.22);
      ctx.lineTo(s * 0.6, s * 0.12);
      ctx.lineTo(s * 0.82, s * 0.18);
      ctx.lineTo(s * 0.92, s * 0.45);
      ctx.lineTo(s * 0.85, s * 0.5);
      ctx.lineTo(s * 0.85, s * 0.92);
      ctx.lineTo(s * 0.15, s * 0.92);
      ctx.lineTo(s * 0.15, s * 0.5);
      ctx.lineTo(s * 0.08, s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'dress': {
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.15);
      ctx.lineTo(s * 0.42, s * 0.1);
      ctx.bezierCurveTo(s * 0.46, s * 0.25, s * 0.54, s * 0.25, s * 0.58, s * 0.1);
      ctx.lineTo(s * 0.7, s * 0.15);
      ctx.lineTo(s * 0.66, s * 0.5);
      ctx.lineTo(s * 0.9, s * 0.95);
      ctx.lineTo(s * 0.1, s * 0.95);
      ctx.lineTo(s * 0.34, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'shoes': {
      ctx.beginPath();
      ctx.moveTo(s * 0.15, s * 0.55);
      ctx.lineTo(s * 0.78, s * 0.5);
      ctx.bezierCurveTo(s * 0.92, s * 0.5, s * 0.92, s * 0.7, s * 0.78, s * 0.7);
      ctx.lineTo(s * 0.15, s * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // heel
      ctx.fillRect(s * 0.6, s * 0.7, s * 0.04, s * 0.2);
      break;
    }
    case 'bag': {
      ctx.beginPath();
      ctx.moveTo(s * 0.25, s * 0.4);
      ctx.lineTo(s * 0.75, s * 0.4);
      ctx.lineTo(s * 0.78, s * 0.85);
      ctx.lineTo(s * 0.22, s * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // handle
      ctx.beginPath();
      ctx.arc(s * 0.5, s * 0.4, s * 0.12, Math.PI, 0, false);
      ctx.stroke();
      break;
    }
    case 'sunglasses': {
      ctx.beginPath();
      ctx.ellipse(s * 0.32, s * 0.5, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(s * 0.68, s * 0.5, s * 0.15, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.47, s * 0.5);
      ctx.lineTo(s * 0.53, s * 0.5);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r * (1 - t) + pb.r * t);
  const g = Math.round(pa.g * (1 - t) + pb.g * t);
  const bl = Math.round(pa.b * (1 - t) + pb.b * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/);
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

export default app;
