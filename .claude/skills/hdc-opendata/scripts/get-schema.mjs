#!/usr/bin/env node
// GET /report_schema/{table} -> นิยามคอลัมน์ (ทั้งอ่านเอง และใช้เป็นหัวตารางตอนนำเสนอ)
//   node get-schema.mjs s_ht_screen_pop_age
//   import { labels } from './get-schema.mjs'   -> { คอลัมน์: คำอธิบายไทย }
import { pathToFileURL } from 'node:url';
const API = 'https://opendata.moph.go.th/api';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// UA header: default node UA โดน Cloudflare 403 / ยิงรัวโดน 429 -> backoff
async function api(path) {
  for (let a = 0; ; a++) {
    const r = await fetch(API + path, { headers: { 'User-Agent': 'curl/8' } });
    if (r.ok) return r.json();
    if (r.status !== 429 || a === 5) throw new Error(`HTTP ${r.status} ${path}`);
    await sleep(2 ** a * 1000);
  }
}

export const schema = table => api(`/report_schema/${table}`);

// คอลัมน์ -> คำอธิบาย สำหรับทำหัวตาราง  คอลัมน์ที่ comment ว่างคงชื่อรหัสไว้ (อย่ากลบด้วยค่าว่าง)
// พังก็ไม่ล้ม: คืน {} แล้วใช้ชื่อคอลัมน์ดิบแทน ดีกว่าทำรายงานไม่ออกเพราะเน็ตสะดุด
export async function labels(table) {
  try {
    return Object.fromEntries((await schema(table)).map(c => [c.COLUMN_NAME, c.COLUMN_COMMENT?.trim() || c.COLUMN_NAME]));
  } catch (e) {
    console.error(`  ! ดึง schema ${table} ไม่ได้ (${e.message}) — หัวตารางจะเป็นชื่อคอลัมน์ดิบ`);
    return {};
  }
}

// พิมพ์เฉพาะตอนรันตรง ไม่ใช่ตอนถูก import
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const table = process.argv[2];
  if (!table) throw new Error('usage: node get-schema.mjs <table>');
  for (const c of await schema(table))
    console.log(`${c.COLUMN_NAME}\t${c.COLUMN_TYPE}\t${c.COLUMN_COMMENT}`);
}
