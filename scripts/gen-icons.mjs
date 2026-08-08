/**
 * PWA 아이콘(PNG) 생성기.
 *
 * 외부 이미지 라이브러리 없이 zlib 만으로 PNG 를 직접 쓴다.
 * 아이콘을 바꾸고 싶을 때만 실행하면 된다: `node scripts/gen-icons.mjs`
 * 산출물(public/icon-*.png)은 저장소에 커밋한다 — 빌드 단계에 의존하지 않게.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [0x0e, 0x14, 0x20]; // 딥 네이비
const BALL = [0xfb, 0xc4, 0x00]; // 1~10 구간 색
const GLOW = [0x2a, 0x18, 0x2c]; // 사인 번짐

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** 안티에일리어싱을 위한 커버리지: 픽셀 중심과 원 경계 사이 거리로 부드럽게 섞는다. */
function coverage(distance, radius) {
  const edge = 1.2;
  if (distance <= radius - edge) return 1;
  if (distance >= radius + edge) return 0;
  return (radius + edge - distance) / (edge * 2);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function renderIcon(size) {
  const center = size / 2;
  const ballRadius = size * 0.3;
  const glowRadius = size * 0.46;
  const rows = [];

  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 배경 + 은근한 사인 번짐
      const glow = Math.max(0, 1 - distance / glowRadius) * 0.85;
      let r = mix(BG[0], GLOW[0], glow);
      let g = mix(BG[1], GLOW[1], glow);
      let b = mix(BG[2], GLOW[2], glow);

      // 금색 공
      const ball = coverage(distance, ballRadius);
      if (ball > 0) {
        // 위쪽이 밝고 아래쪽이 어두운 아주 얕은 셰이딩
        const shade = 1 - (dy / ballRadius) * 0.16;
        r = mix(r, Math.min(255, Math.round(BALL[0] * shade)), ball);
        g = mix(g, Math.min(255, Math.round(BALL[1] * shade)), ball);
        b = mix(b, Math.min(255, Math.round(BALL[2] * shade)), ball);
      }

      const offset = 1 + x * 3;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log(`wrote ${file}`);
}
