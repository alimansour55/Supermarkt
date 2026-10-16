#!/usr/bin/env node
/**
 * MarketPlus shop agent — runs on the shop's cashier PC and keeps the website in sync
 * with a cashier program that has no internet features of its own.
 *
 * It can read stock/prices from:
 *   - folder  : a folder where the cashier program saves CSV/Excel exports
 *   - mssql   : a SQL Server database (most Egyptian desktop POS systems)   → needs `npm install mssql`
 *   - odbc    : any ODBC source, e.g. MS Access .mdb/.accdb                 → needs `npm install odbc`
 * and it can save new online orders as files for the cashier program to import.
 *
 * Works offline: everything to send is queued on disk and sent when the internet is back.
 * Updates itself from the store's server. Needs Node.js 18 or newer. No other installs
 * unless you use the mssql/odbc sources.
 *
 *   node shop-agent.mjs            run forever (use install-windows.ps1 to start with Windows)
 *   node shop-agent.mjs --once     one round, then exit
 *   node shop-agent.mjs --test     check the settings and the connection to the store
 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const AGENT_VERSION = '1.0.0';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = process.env.SHOP_AGENT_CONFIG || path.join(HERE, 'config.json');
const DATA_DIR = process.env.SHOP_AGENT_DATA || path.join(HERE, 'agent-data');
const QUEUE_DIR = path.join(DATA_DIR, 'queue');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_FILE = path.join(DATA_DIR, 'agent.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const BATCH = 5000;

// ── small helpers ─────────────────────────────────────────────────────────────

function log(level, message) {
  const line = `${new Date().toISOString()} [${level}] ${message}`;
  console.log(line);
  try {
    if (fss.existsSync(LOG_FILE) && fss.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fss.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    }
    fss.appendFileSync(LOG_FILE, `${line}\n`);
  } catch { /* logging must never stop the agent */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (value) => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function writeJson(file, value) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2));
  await fs.rename(tmp, file);
}

async function loadConfig() {
  const cfg = await readJson(CONFIG_FILE, null);
  if (!cfg) throw new Error(`Settings file not found or not valid JSON: ${CONFIG_FILE} (copy config.example.json to config.json)`);
  if (!cfg.apiUrl || !cfg.apiKey) throw new Error('config.json needs "apiUrl" and "apiKey"');
  cfg.apiUrl = cfg.apiUrl.replace(/\/+$/, '');
  if (!/\/integrations\/v1$/.test(cfg.apiUrl)) cfg.apiUrl = `${cfg.apiUrl}/api/integrations/v1`.replace('/api/api/', '/api/');
  cfg.intervalSeconds = Math.max(30, Number(cfg.intervalSeconds) || 120);
  return cfg;
}

async function api(cfg, method, route, { json, body, headers = {}, raw = false } = {}) {
  const res = await fetch(`${cfg.apiUrl}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'User-Agent': `MarketPlus-ShopAgent/${AGENT_VERSION}`,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
    signal: AbortSignal.timeout(120000),
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Errors worth retrying later (no internet, server down) vs. errors in what we sent. */
const isTemporary = (err) => !err.status || err.status >= 500 || err.status === 429;

// ── offline queue ─────────────────────────────────────────────────────────────

async function enqueue(job) {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.json`;
  await writeJson(path.join(QUEUE_DIR, name), job);
}

async function flushQueue(cfg) {
  await fs.mkdir(QUEUE_DIR, { recursive: true });
  const files = (await fs.readdir(QUEUE_DIR)).filter((f) => f.endsWith('.json')).sort();
  for (const file of files) {
    const full = path.join(QUEUE_DIR, file);
    const job = await readJson(full, null);
    if (!job) { await fs.rm(full, { force: true }); continue; }
    try {
      if (job.kind === 'file') {
        const content = Buffer.from(job.base64, 'base64');
        const result = await api(cfg, 'POST', `/files?filename=${encodeURIComponent(job.filename)}`, {
          body: content,
          headers: { 'Content-Type': 'application/octet-stream', 'Idempotency-Key': job.key },
        });
        log('info', `Sent file ${job.filename}: ${summary(result?.data)}`);
      } else {
        const result = await api(cfg, job.method, job.route, { json: job.json, headers: { 'Idempotency-Key': job.key } });
        log('info', `Sent ${job.label}: ${summary(result?.data)}`);
      }
      await fs.rm(full, { force: true });
    } catch (err) {
      if (isTemporary(err)) {
        log('warn', `Store not reachable (${err.message}) — ${files.length} update(s) waiting, will retry`);
        return false;
      }
      log('error', `Store refused ${job.label || job.filename}: ${err.message} — dropped`);
      await fs.rm(full, { force: true });
    }
  }
  return true;
}

function summary(d) {
  if (!d) return 'ok';
  return `${d.updated ?? 0} updated, ${d.unchanged ?? 0} unchanged, ${d.unmatched?.length ?? 0} unknown codes, ${d.failed?.length ?? 0} errors`;
}

// ── sources ───────────────────────────────────────────────────────────────────

/** Folder: send every new or changed export file once. */
async function readFolder(cfg, state) {
  const src = cfg.source;
  const dir = path.resolve(HERE, src.path || '.');
  const pattern = new RegExp(`^${(src.pattern || '*.csv').split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');
  let names;
  try { names = await fs.readdir(dir); } catch { throw new Error(`Cannot open folder ${dir}`); }
  state.files ||= {};
  let queued = 0;
  for (const name of names.filter((n) => pattern.test(n)).sort()) {
    const full = path.join(dir, name);
    const stat = await fs.stat(full);
    if (!stat.isFile()) continue;
    // Skip files still being written (changed in the last 10 seconds).
    if (Date.now() - stat.mtimeMs < 10000) continue;
    const content = await fs.readFile(full);
    const hash = sha(content);
    if (state.files[name] === hash) continue;
    await enqueue({ kind: 'file', filename: name, base64: content.toString('base64'), key: `file:${hash}` });
    state.files[name] = hash;
    queued += 1;
  }
  return queued;
}

async function loadDriver(name) {
  try {
    return (await import(name)).default ?? (await import(name));
  } catch {
    throw new Error(`The "${name}" package is needed for this source. Open a terminal in ${HERE} and run: npm install ${name}`);
  }
}

async function runQueries(cfg) {
  const src = cfg.source;
  const queries = { stock: src.stockQuery, prices: src.priceQuery };
  const out = {};
  if (src.type === 'mssql') {
    const sql = await loadDriver('mssql');
    const pool = await sql.connect(src.connectionString);
    try {
      for (const [k, q] of Object.entries(queries)) if (q) out[k] = (await pool.request().query(q)).recordset;
    } finally {
      await pool.close();
    }
  } else if (src.type === 'odbc') {
    const odbc = await loadDriver('odbc');
    const conn = await odbc.connect(src.connectionString);
    try {
      for (const [k, q] of Object.entries(queries)) if (q) out[k] = [...(await conn.query(q))];
    } finally {
      await conn.close();
    }
  } else {
    throw new Error(`Unknown source type "${src.type}" — use folder, mssql or odbc`);
  }
  return out;
}

/** Column names are matched loosely so a query can say "Barcode", "qty", "Branch"… */
function pick(row, names) {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((key) => key.toLowerCase() === n);
    if (k !== undefined && row[k] !== null && row[k] !== undefined && row[k] !== '') return row[k];
  }
  return undefined;
}

async function readDatabase(cfg, state) {
  const { stock = [], prices = [] } = await runQueries(cfg);
  const stockItems = stock.map((r) => ({
    code: String(pick(r, ['code', 'barcode', 'sku', 'itemcode', 'item_code']) ?? '').trim(),
    quantity: Number(pick(r, ['quantity', 'qty', 'stock', 'onhand', 'balance']) ?? 0),
    location: pick(r, ['location', 'branch', 'store', 'warehouse']) ?? undefined,
  })).filter((i) => i.code);
  const priceItems = prices.map((r) => ({
    code: String(pick(r, ['code', 'barcode', 'sku', 'itemcode', 'item_code']) ?? '').trim(),
    price: pick(r, ['price', 'saleprice', 'sale_price', 'retail']),
    costPrice: pick(r, ['cost', 'costprice', 'cost_price', 'purchaseprice']),
  })).filter((i) => i.code);

  let queued = 0;
  for (const [label, route, items] of [['stock', '/stock', stockItems], ['prices', '/prices', priceItems]]) {
    if (!items.length) continue;
    // Only send when something changed since the last send.
    const hash = sha(items);
    if (state[`last_${label}`] === hash) continue;
    for (let i = 0; i < items.length; i += BATCH) {
      const chunk = items.slice(i, i + BATCH);
      await enqueue({ method: 'PUT', route, json: { items: chunk }, label: `${label} (${chunk.length} items)`, key: `${label}:${sha(chunk)}` });
      queued += 1;
    }
    state[`last_${label}`] = hash;
  }
  return queued;
}

// ── online orders → files for the cashier program ─────────────────────────────

function orderToCsv(order) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = 'order_number,barcode,sku,name,quantity,unit_price,line_total,customer,phone,address,payment,total';
  const addr = [order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(' - ');
  const lines = order.items.filter((i) => i.fulfilledBy === 'store').map((i) => [
    order.number, i.barcode, i.sku, i.nameAr || i.name, i.quantity, i.unitPrice, i.lineTotal,
    order.customer.name, order.customer.phone, addr, order.paymentMethod, order.total,
  ].map(esc).join(','));
  return `﻿${[head, ...lines].join('\r\n')}\r\n`;
}

async function exportOrders(cfg, state) {
  const o = cfg.orders;
  if (!o?.exportFolder) return 0;
  const dir = path.resolve(HERE, o.exportFolder);
  await fs.mkdir(dir, { recursive: true });
  state.exportedOrders ||= [];
  const done = new Set(state.exportedOrders);
  let written = 0;
  let cursor = state.ordersCursor || '';
  for (let page = 0; page < 20; page += 1) {
    const q = new URLSearchParams({ unacknowledged: 'true', limit: '100', ...(cursor ? { cursor } : {}) });
    const res = await api(cfg, 'GET', `/orders?${q}`);
    for (const order of res.data || []) {
      if (done.has(order.id) || order.status === 'cancelled') continue;
      const statuses = o.statuses || ['pending', 'preparing'];
      if (!statuses.includes(order.status)) continue;
      const file = path.join(dir, `order-${order.number}.${o.format === 'json' ? 'json' : 'csv'}`);
      await fs.writeFile(file, o.format === 'json' ? JSON.stringify(order, null, 2) : orderToCsv(order));
      done.add(order.id);
      written += 1;
      if (o.acknowledge) {
        await api(cfg, 'POST', `/orders/${order.id}/acknowledge`, { json: { externalReference: path.basename(file) } });
      }
      log('info', `Saved online order #${order.number} → ${file}`);
    }
    cursor = res.nextCursor || cursor;
    if (!res.hasMore) break;
  }
  state.ordersCursor = cursor;
  state.exportedOrders = [...done].slice(-5000);
  return written;
}

// ── self update ───────────────────────────────────────────────────────────────

async function heartbeat(cfg) {
  const res = await api(cfg, 'POST', '/agent/heartbeat', { json: { version: AGENT_VERSION, hostname: os.hostname() } });
  return res?.data || {};
}

async function selfUpdate(cfg, latest) {
  const res = await api(cfg, 'GET', '/agent/download', { raw: true });
  if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
  const code = await res.text();
  if (!code.includes(`AGENT_VERSION = '${latest}'`)) throw new Error('downloaded file is not the expected version');
  const self = fileURLToPath(import.meta.url);
  await fs.copyFile(self, `${self}.bak`);
  await fs.writeFile(`${self}.new`, code);
  await fs.rename(`${self}.new`, self);
  log('info', `Updated to version ${latest} — restarting`);
  process.exit(0); // run-agent.cmd starts it again
}

// ── main loop ─────────────────────────────────────────────────────────────────

async function round(cfg) {
  const state = await readJson(STATE_FILE, {});
  try {
    const hb = await heartbeat(cfg);
    if (hb.updateAvailable && cfg.autoUpdate !== false && hb.latestVersion) {
      try { await selfUpdate(cfg, hb.latestVersion); } catch (err) { log('warn', `Update skipped: ${err.message}`); }
    }
  } catch (err) {
    if (!isTemporary(err)) throw err; // bad key etc. — stop and say so
    log('warn', `Store not reachable: ${err.message}`);
  }

  try {
    const type = cfg.source?.type;
    let queued = 0;
    if (type === 'folder') queued = await readFolder(cfg, state);
    else if (type) queued = await readDatabase(cfg, state);
    if (queued) log('info', `${queued} update(s) ready to send`);
  } catch (err) {
    log('error', `Reading the cashier data failed: ${err.message}`);
  }
  await writeJson(STATE_FILE, state);

  await flushQueue(cfg);

  try {
    await exportOrders(cfg, state);
    await writeJson(STATE_FILE, state);
  } catch (err) {
    log(isTemporary(err) ? 'warn' : 'error', `Online orders: ${err.message}`);
  }
}

async function selfTest(cfg) {
  log('info', `Agent ${AGENT_VERSION} — testing ${cfg.apiUrl}`);
  const ping = await api(cfg, 'GET', '/ping');
  log('info', `Connected as "${ping.data.connection}" — permissions: ${ping.data.scopes.join(', ')}${ping.data.testMode ? ' (TEST MODE: nothing is saved)' : ''}`);
  if (cfg.source?.type === 'folder') {
    const dir = path.resolve(HERE, cfg.source.path || '.');
    const names = await fs.readdir(dir);
    log('info', `Folder ${dir} is readable — ${names.length} file(s)`);
  } else if (cfg.source?.type) {
    const { stock = [], prices = [] } = await runQueries(cfg);
    log('info', `Database OK — stock query returned ${stock.length} row(s), price query ${prices.length}`);
    if (stock[0]) log('info', `First stock row: ${JSON.stringify(stock[0])}`);
  }
  log('info', 'All good.');
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const args = new Set(process.argv.slice(2));
  const cfg = await loadConfig();
  if (args.has('--test')) return selfTest(cfg);
  log('info', `MarketPlus shop agent ${AGENT_VERSION} started (every ${cfg.intervalSeconds}s)`);
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await round(cfg);
    } catch (err) {
      log('error', err.message);
      if (err.status === 401 || err.status === 403) {
        log('error', 'The store rejected the key — check apiKey in config.json, or whether the connection is paused. Retrying in 10 minutes.');
        // eslint-disable-next-line no-await-in-loop
        await sleep(10 * 60 * 1000);
      }
    }
    if (args.has('--once')) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(cfg.intervalSeconds * 1000);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    log('error', err.message);
    process.exit(1);
  });
}
