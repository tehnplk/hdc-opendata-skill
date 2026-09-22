#!/usr/bin/env node
// ติดตั้ง skill ลง .claude/skills/  —  npx hdc-opendata-skill [add] [-g]
//   ไม่ใส่อะไร  -> ./.claude/skills/hdc-opendata (เฉพาะโปรเจกต์นี้)
//   -g          -> ~/.claude/skills/hdc-opendata (ทุกโปรเจกต์)
import { cpSync, existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'hdc-opendata';
const src = join(dirname(fileURLToPath(import.meta.url)), '.claude', 'skills', NAME);
const a = process.argv.slice(2).filter(x => x !== 'add');          // รับ verb 'add' ไว้เฉยๆ ให้พิมพ์ตามสัญชาตญาณได้
const global = a.includes('-g') || a.includes('--global');
const dest = join(global ? homedir() : process.cwd(), '.claude', 'skills', NAME);

const die = m => { console.error(m); process.exit(1); };   // stack trace ใส่หน้าคนติดตั้งไม่มีประโยชน์
if (!existsSync(src)) die(`ไม่พบตัว skill ที่ ${src} — แพ็กเกจเสียหาย`);
if (existsSync(dest) && !a.includes('--force'))
  die(`มีอยู่แล้วที่ ${dest}\n  อัปเดตทับด้วย: npx hdc-opendata-skill${global ? ' -g' : ''} --force`);

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`ติดตั้งแล้ว -> ${dest}
เปิด Claude Code ใหม่ แล้วลองสั่ง: "รายการรายงานแพทย์แผนไทย"
ต้องมี node >= 18 (fetch) ไม่ต้องลง dependency อะไรเพิ่ม`);
