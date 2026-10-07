// Run from the repository root: node mobile/scripts/generate-brand-assets.cjs
// Uses the existing website sharp dependency; no mobile runtime dependency.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('../../node_modules/sharp');
const root = path.resolve(__dirname, '../..');
const size = 1024;
const navy = '#173452';
const light = '#F6F7F8';

async function main() {
  const source = await fs.readFile(path.join(root, 'public/favicon.svg'), 'utf8');
  const mark = source.match(/<path\b[^>]*\/>/)?.[0];
  assert(mark && source.includes('viewBox="0 0 64 64"'), 'Review the canonical favicon before regenerating.');
  const svg = (body, viewBox = '0 0 64 64') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${body}</svg>`);
  const { data, info } = await sharp(svg(mark)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = size, minY = size, maxX = 0, maxY = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (data[(y * size + x) * info.channels + 3]) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  const width = (maxX - minX + 1) / 16, height = (maxY - minY + 1) / 16;
  const centerX = (minX + maxX + 1) / 32, centerY = (minY + maxY + 1) / 32;
  const centered = scale => `<g transform="translate(512 512) scale(${scale}) translate(${-centerX} ${-centerY})">${mark}</g>`;
  // Entire painted bounding box fits inside the 66/108 safe circle, with a margin.
  const adaptiveScale = 600 / Math.hypot(width, height);
  const foreground = await sharp(svg(centered(adaptiveScale), '0 0 1024 1024')).png().toBuffer();
  const icon = await sharp(svg(`<rect width="1024" height="1024" fill="${navy}"/>${centered(640 / width)}`, '0 0 1024 1024')).removeAlpha().png().toBuffer();
  const background = await sharp({ create: { width: size, height: size, channels: 3, background: navy } }).png().toBuffer();
  const assets = path.join(root, 'mobile/assets/images');
  await fs.writeFile(path.join(assets, 'icon.png'), icon);
  await fs.writeFile(path.join(assets, 'android-icon-foreground.png'), foreground);
  await fs.writeFile(path.join(assets, 'android-icon-background.png'), background);
  await fs.writeFile(path.join(assets, 'android-icon-monochrome.png'), foreground);
  await sharp(Buffer.from(source)).resize(64, 64).png().toFile(path.join(assets, 'favicon.png'));

  const raw = await sharp(foreground).ensureAlpha().raw().toBuffer();
  let painted = 0, maxRadius = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const offset = (y * size + x) * 4;
    if (!raw[offset + 3]) continue;
    painted++;
    maxRadius = Math.max(maxRadius, Math.hypot(x + 0.5 - 512, y + 0.5 - 512));
    if (raw[offset + 3] === 255) assert.deepEqual([...raw.subarray(offset, offset + 3)], [246, 247, 248]);
  }
  assert(painted > 0 && maxRadius < size * 33 / 108, 'Mark must fit the adaptive safe circle.');
  const out = path.join(root, 'output/branding-audit');
  await fs.mkdir(out, { recursive: true });
  const combined = await sharp(background).composite([{ input: foreground }]).png().toBuffer();
  const masks = [
    '<circle cx="512" cy="512" r="341.333" fill="white"/>',
    '<rect x="170.667" y="170.667" width="682.666" height="682.666" rx="170" fill="white"/>',
    '<path d="M512 170.667 C805 170.667 853.333 219 853.333 512 C853.333 805 805 853.333 512 853.333 C219 853.333 170.667 805 170.667 512 C170.667 219 219 170.667 512 170.667Z" fill="white"/>',
  ];
  const previews = [icon];
  for (const mask of masks) previews.push(await sharp(combined).composite([{ input: svg(mask, '0 0 1024 1024'), blend: 'dest-in' }]).png().toBuffer());
  previews.push(foreground);
  await sharp({ create: { width: 1200, height: 240, channels: 4, background: '#b5bec8' } }).composite(await Promise.all(previews.map(async (input, i) => ({ input: await sharp(input).resize(220, 220).png().toBuffer(), left: i * 240 + 10, top: 10 })))).png().toFile(path.join(out, 'folio-icons.png'));
  const report = { source: 'public/favicon.svg', geometry: 'Original path and stroke attributes; uniform scale and centering only', size, navy, light, paintedPixels: painted, maximumMarkRadius: maxRadius, safeRadius: size * 33 / 108, masks: ['circle', 'rounded square', 'squircle'], preview: 'output/branding-audit/folio-icons.png' };
  await fs.writeFile(path.join(out, 'icon-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
