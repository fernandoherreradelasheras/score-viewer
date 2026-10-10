// Pixel size of a JPEG or PNG file, read from its header (no dependencies).

import { open } from 'node:fs/promises';

export async function imageSize(file) {
  const fh = await open(file, 'r');
  try {
    const head = Buffer.alloc(32);
    await fh.read(head, 0, 32, 0);
    // PNG: the IHDR chunk comes first.
    if (head.readUInt32BE(0) === 0x89504e47) {
      return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
    }
    if (head[0] !== 0xff || head[1] !== 0xd8) return null;
    // JPEG: walk the segments up to a start-of-frame marker.
    let pos = 2;
    const seg = Buffer.alloc(9);
    for (;;) {
      const { bytesRead } = await fh.read(seg, 0, 9, pos);
      if (bytesRead < 9 || seg[0] !== 0xff) return null;
      const marker = seg[1];
      if (marker === 0xff) { pos += 1; continue; }            // fill byte
      const len = seg.readUInt16BE(2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) return { w: seg.readUInt16BE(7), h: seg.readUInt16BE(5) };
      pos += 2 + len;
    }
  } finally {
    await fh.close();
  }
}
