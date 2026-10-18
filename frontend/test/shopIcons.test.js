import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EMOJI_TO_SHOP_ICON, SHOP_ICON_NAMES, isShopIconName, looksLikeEmoji, productPlaceholderIcon, resolveShopIcon,
} from '../src/utils/shopIconKeys.js';

const componentSource = readFileSync(new URL('../src/components/ui/ShopIcon.jsx', import.meta.url), 'utf8');

test('icon names are unique and every one is drawn by ShopIcon', () => {
  assert.equal(new Set(SHOP_ICON_NAMES).size, SHOP_ICON_NAMES.length);
  for (const name of SHOP_ICON_NAMES) {
    assert.match(componentSource, new RegExp(`\\b${name}: [A-Z]`), `ShopIcon has no drawing for "${name}"`);
  }
});

test('every old emoji maps to a real icon name', () => {
  for (const [emoji, name] of Object.entries(EMOJI_TO_SHOP_ICON)) {
    assert.ok(isShopIconName(name), `${emoji} → ${name} is not an icon name`);
  }
});

test('resolveShopIcon keeps names, maps emoji, ignores plain text', () => {
  assert.equal(resolveShopIcon('truck'), 'truck');
  assert.equal(resolveShopIcon('🚚'), 'truck');
  assert.equal(resolveShopIcon('🛡'), 'shield'); // saved without the variation selector
  assert.equal(resolveShopIcon('↩️'), 'returns');
  assert.equal(resolveShopIcon('🦄'), '');
  assert.equal(resolveShopIcon('🦄', 'star'), 'star');
  assert.equal(resolveShopIcon('1000+'), '');
  assert.equal(resolveShopIcon(''), '');
  assert.equal(resolveShopIcon(undefined, 'gift'), 'gift');
});

test('looksLikeEmoji tells emoji apart from numbers and words', () => {
  assert.equal(looksLikeEmoji('🔥'), true);
  assert.equal(looksLikeEmoji('✓'), true);
  assert.equal(looksLikeEmoji('24h'), false);
  assert.equal(looksLikeEmoji('50K+'), false);
  assert.equal(looksLikeEmoji('truck'), false);
});

test('product placeholders map catalog emoji and default to a parcel', () => {
  assert.equal(productPlaceholderIcon('🥛'), 'milk');
  assert.equal(productPlaceholderIcon('🧹'), 'clean');
  assert.equal(productPlaceholderIcon('🛍️'), 'package');
  assert.equal(productPlaceholderIcon('🛒'), 'package');
  assert.equal(productPlaceholderIcon(''), 'package');
  assert.equal(productPlaceholderIcon('🦄'), 'package');
  assert.equal(productPlaceholderIcon('https://x/y.jpg'), 'package');
});
