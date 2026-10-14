import { describe, expect, it } from 'vitest';
import { matchesDeclaredMedia, sniffMediaKind } from '../src/utils/fileSignature.js';

const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

describe('sniffMediaKind', () => {
  it.each([
    ['jpeg', pad([0xff, 0xd8, 0xff, 0xe0]), 'image'],
    ['png', pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image'],
    ['gif', pad([...Buffer.from('GIF89a')]), 'image'],
    ['webp', pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]), 'image'],
    ['mp4', pad([0, 0, 0, 0x18, ...Buffer.from('ftypmp42')]), 'video'],
    ['webm', pad([0x1a, 0x45, 0xdf, 0xa3]), 'video'],
    ['html', pad([...Buffer.from('<html><script>')]), null],
    ['too short', Buffer.from([0xff, 0xd8]), null],
  ])('%s', (_name, buffer, kind) => {
    expect(sniffMediaKind(buffer)).toBe(kind);
  });
});

describe('matchesDeclaredMedia', () => {
  const jpeg = pad([0xff, 0xd8, 0xff, 0xe0]);

  it('accepts bytes that match the declared type', () => {
    expect(matchesDeclaredMedia({ mimetype: 'image/jpeg', buffer: jpeg })).toBe(true);
  });

  it('rejects a script renamed to .png', () => {
    expect(matchesDeclaredMedia({ mimetype: 'image/png', buffer: pad([...Buffer.from('<?php echo 1;')]) })).toBe(false);
  });

  it('rejects an image declared as video', () => {
    expect(matchesDeclaredMedia({ mimetype: 'video/mp4', buffer: jpeg })).toBe(false);
  });
});
