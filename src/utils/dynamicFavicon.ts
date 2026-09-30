/**
 * Dynamic Favicon Generator
 * Updates the browser favicon with a progress ring or timer indicator
 */

let originalFaviconHref: string | null = null;

export function updateDynamicFavicon(isRunning: boolean, timeStr?: string) {
  if (typeof document === 'undefined') return;

  const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) return;

  if (!originalFaviconHref) {
    originalFaviconHref = link.href;
  }

  if (!isRunning) {
    link.href = originalFaviconHref;
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Draw background circle
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, 2 * Math.PI);
  ctx.fillStyle = '#1E1F22';
  ctx.fill();

  // Draw focus ring
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, 2 * Math.PI);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#6366F1';
  ctx.stroke();

  // Draw active dot in center
  ctx.beginPath();
  ctx.arc(32, 32, 12, 0, 2 * Math.PI);
  ctx.fillStyle = '#A5B4FC';
  ctx.fill();

  link.href = canvas.toDataURL('image/png');
}
