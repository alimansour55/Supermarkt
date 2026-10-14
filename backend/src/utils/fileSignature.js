/**
 * Magic-byte sniffing for uploads. multer's fileFilter only sees the client-supplied
 * name and mimetype, so a renamed file would otherwise pass as an image.
 */
const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

const SIGNATURES = [
  { kind: 'image', test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) }, // jpeg
  { kind: 'image', test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }, // png
  { kind: 'image', test: (b) => startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a')) },
  { kind: 'image', test: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8) },
  { kind: 'video', test: (b) => startsWith(b, ascii('ftyp'), 4) }, // mp4 / mov
  { kind: 'video', test: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) }, // webm / mkv
  { kind: 'video', test: (b) => startsWith(b, [0x00, 0x00, 0x01, 0xba]) || startsWith(b, [0x00, 0x00, 0x01, 0xb3]) }, // mpeg
];

/** 'image' | 'video' | null, from the file's first bytes. */
export function sniffMediaKind(buffer) {
  if (!buffer || buffer.length < 12) return null;
  return SIGNATURES.find((s) => s.test(buffer))?.kind ?? null;
}

/** True when the bytes are the kind of media the declared mimetype claims. */
export function matchesDeclaredMedia(file) {
  const declared = file?.mimetype?.split('/')[0];
  return Boolean(declared) && sniffMediaKind(file?.buffer) === declared;
}
