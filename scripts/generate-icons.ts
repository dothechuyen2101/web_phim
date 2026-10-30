/**
 * Tạo icon PWA / favicon từ logo của web (biểu tượng lucide "clapperboard" trên nền gradient):
 *   npx tsx scripts/generate-icons.ts
 * Dùng sharp — đã có sẵn trong node_modules vì Next cài kèm.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const GLYPH =
  '<path d="m12.296 3.464 3.02 3.956"/><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/>' +
  '<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m6.18 5.276 3.1 3.899"/>';

/** radius: bo góc theo tỉ lệ cạnh · glyph: tỉ lệ biểu tượng so với cạnh · background=false: chỉ biểu tượng màu trắng */
function svg(size: number, { radius = 0.22, glyph = 0.56, background = true } = {}) {
  const box = size * glyph;
  const offset = (size - box) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb547"/><stop offset="1" stop-color="#ff6a5c"/></linearGradient></defs>
  ${background ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)"/>` : ""}
  <g transform="translate(${offset} ${offset}) scale(${box / 24})" fill="none" stroke="${background ? "#1d1102" : "#ffffff"}"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>
</svg>`;
}

const png = (size: number, options?: Parameters<typeof svg>[1]) => sharp(Buffer.from(svg(size, options))).png().toBuffer();

/** File .ico chứa sẵn ảnh PNG (mọi trình duyệt hiện nay đều đọc được). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // color planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

async function main() {
  mkdirSync("public/icons", { recursive: true });
  writeFileSync("public/icons/icon-192.png", await png(192));
  writeFileSync("public/icons/icon-512.png", await png(512));
  // maskable: nền tràn viền, biểu tượng nằm gọn trong vùng an toàn (hình tròn 80% ở giữa) vì Android tự cắt theo hình dạng của máy
  writeFileSync("public/icons/maskable-512.png", await png(512, { radius: 0, glyph: 0.46 }));
  // badge: icon nhỏ trên thanh trạng thái Android — chỉ dùng kênh alpha nên vẽ biểu tượng trắng trên nền trong suốt
  writeFileSync("public/icons/badge-96.png", await png(96, { background: false, glyph: 0.84 }));
  // iOS tự bo góc icon màn hình chính
  writeFileSync("src/app/apple-icon.png", await png(180, { radius: 0 }));
  writeFileSync("src/app/favicon.ico", ico([{ size: 32, data: await png(32) }, { size: 48, data: await png(48) }]));
  console.log("Đã tạo icon trong public/icons, src/app/apple-icon.png và src/app/favicon.ico");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
