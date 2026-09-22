#!/usr/bin/env node
// ติดตั้ง skill — node install.mjs [add] [-g] [--force]
//   ไม่ใส่อะไร  -> ./.claude/skills/hdc-opendata (เฉพาะโปรเจกต์นี้)
//   -g          -> ~/.claude, ~/.agents และ ~/.codex (ทุกโปรเจกต์)
import { cpSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'hdc-opendata';
const src = join(dirname(fileURLToPath(import.meta.url)), '.claude', 'skills', NAME);
const a = process.argv.slice(2).filter(x => x !== 'add');          // รับ verb 'add' ไว้เฉยๆ ให้พิมพ์ตามสัญชาตญาณได้
const global = a.includes('-g') || a.includes('--global');
const roots = global ? ['.claude', '.agents', '.codex'] : ['.claude'];
const destinations = roots.map(root => join(global ? homedir() : process.cwd(), root, 'skills', NAME));

const die = m => { console.error(m); process.exit(1); };   // stack trace ใส่หน้าคนติดตั้งไม่มีประโยชน์
if (!existsSync(src)) die(`ไม่พบตัว skill ที่ ${src} — แพ็กเกจเสียหาย`);
// ตรวจทุกปลายทางก่อนเริ่มคัดลอก เพื่อไม่ให้ติดตั้งเพียงบางแห่งเมื่อพบของเดิม
for (const dest of destinations) {
  const entry = lstatSync(dest, { throwIfNoEntry: false });
  if (entry?.isSymbolicLink()) die(`ปลายทางเป็นลิงก์: ${dest} — กรุณาตรวจตำแหน่งติดตั้งก่อน`);
  if (entry && realpathSync(dest) === realpathSync(src)) die(`ปลายทางตรงกับโฟลเดอร์ต้นฉบับ: ${dest}`);
  if (entry && !a.includes('--force'))
    die(`มีอยู่แล้วที่ ${dest}\n  อัปเดตทับด้วย: node install.mjs${global ? ' -g' : ''} --force`);
}

for (const dest of destinations) {
  cpSync(src, dest, {
    recursive: true,
    filter: path => !['artifacts', 'node_modules', '.git'].includes(path.split(/[\\/]/).at(-1)),
  });
  console.log(`ติดตั้งแล้ว -> ${dest}`);
}
console.log(`เปิด Claude Code หรือ Codex ใหม่ แล้วลองสั่ง: "รายการรายงานแพทย์แผนไทย"
ต้องมี node >= 18 (fetch) ไม่ต้องลง dependency อะไรเพิ่ม`);
