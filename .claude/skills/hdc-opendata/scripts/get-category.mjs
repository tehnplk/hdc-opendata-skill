#!/usr/bin/env node
// GET /category + /report/{cat_id} -> รายการหมวด/รายงาน + data/reports.csv
//   node get-category.mjs                  ลิสต์หมวดทั้งหมด
//   node get-category.mjs <cat_id>         ลิสต์รายงานในหมวด
//   node get-category.mjs search <คำ>...   ค้น data/reports.csv (AND ทุกคำ)
//   node get-category.mjs build            สร้าง data/reports.csv ใหม่ (~30s)
//   node get-category.mjs url <table>      URL รายงานบน HDC
import { writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
const API = 'https://opendata.moph.go.th/api';
const INDEX = new URL('../data/reports.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();   // ยุบขึ้นบรรทัดใหม่ในชื่อรายงาน ไม่งั้น 1 รายงานกลายเป็น 2 แถวใน csv
const q = s => `"${s.replaceAll('"', '""')}"`;

// UA header: default node UA โดน Cloudflare 403 / ยิงรัวโดน 429 -> backoff
async function api(path) {
  for (let a = 0; ; a++) {
    const r = await fetch(API + path, { headers: { 'User-Agent': 'curl/8' } });
    if (r.ok) return r.json();
    if (r.status !== 429 || a === 5) throw new Error(`HTTP ${r.status} ${path}`);
    await sleep(2 ** a * 1000);
  }
}

async function build() {
  const rows = new Set();
  for (const c of await api('/category')) {
    for (const r of await api(`/report/${c.cat_id}`))
      if (r.source_table) rows.add([r.source_table, strip(r.report_name), c.category_name].map(q).join(','));
    await sleep(400);
  }
  writeFileSync(INDEX, ['source_table,report_name,category', ...[...rows].sort()].join('\n'), 'utf8');
  console.error(`${rows.size} rows -> ${INDEX}`);
}

// URL รายงานต้นทางบน HDC — ประกอบจาก cat_id + id
// เปลี่ยนเซิร์ฟเวอร์ได้ด้วย env: HDC_BASE=https://hdc.moph.go.th/xxx node get-category.mjs url <table>
const BASE = process.env.HDC_BASE || 'https://hdc.moph.go.th/plk';
const hdcUrl = (cat_id, id) =>
  `${BASE}/reports/report.php?source=pformated/format1.php&cat_id=${cat_id}&id=${id}`;

const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'build') await build();
else if (cmd === 'search') {
  if (!existsSync(INDEX)) await build();
  const lines = readFileSync(INDEX, 'utf8').split('\n').slice(1);
  const hits = lines.filter(l => a.every(t => l.includes(t)));
  console.log(hits.join('\n') || 'not found');
  const age = Math.round((Date.now() - statSync(INDEX).mtimeMs) / 86400000);
  console.error(`\n${hits.length} hits · index ${lines.length} รายงาน (build ${age} วันก่อน — เก่า/ไม่เจอที่ควรเจอ ให้รัน build)`);
} else if (cmd === 'url') {
  const [table] = a;
  // หาหมวดของตารางจาก index ก่อน แล้วยิงแค่หมวดนั้น (ไม่ต้องไล่ 52 หมวด)
  const cats = new Set(readFileSync(INDEX, 'utf8').split('\n')
    .filter(l => l.startsWith(`"${table}",`))
    .map(l => l.slice(l.lastIndexOf(',"') + 2, -1)));
  if (!cats.size) throw new Error(`ไม่พบ ${table} ใน data/reports.csv`);
  const all = await api('/category'), out = new Set();   // API คืน record ซ้ำได้ -> dedupe
  for (const name of cats) {
    const c = all.find(v => v.category_name === name);
    for (const r of await api(`/report/${c.cat_id}`))
      if (r.source_table === table) out.add(`${hdcUrl(c.cat_id, r.id)}\t${strip(r.report_name)}`);
  }
  console.log([...out].join('\n'));
} else if (cmd) for (const r of await api(`/report/${cmd}`)) console.log(`${r.source_table}\t${strip(r.report_name)}`);
else {
  const cats = await api('/category');
  for (const c of cats) console.log(`${c.cat_id}\t${c.report_total}\t${c.category_name}`);
  console.error(`\n${cats.length} หมวด · ${cats.reduce((s, c) => s + +c.report_total, 0)} รายงาน (สดจาก API)`);
}
