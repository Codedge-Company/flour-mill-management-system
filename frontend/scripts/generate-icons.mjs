// run from /frontend:  npm i -D sharp  &&  node scripts/generate-icons.mjs
import sharp from 'sharp';
const src = 'src/assets/icons/icon.png';
const out = 'src/assets/icons';
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) {
  await sharp(src).resize(s, s, { fit: 'cover' }).png().toFile(`${out}/icon-${s}x${s}.png`);
}
// iOS wants a square, fully opaque 180px icon
await sharp(src).resize(180, 180, { fit: 'cover' }).flatten({ background: '#ffffff' }).png().toFile(`${out}/apple-touch-icon.png`);
console.log('icons done');
