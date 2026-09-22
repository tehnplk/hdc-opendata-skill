import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const inside = (root, target) => {
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')));
};
// ตรวจพาธจริงด้วย เพื่อไม่ให้ symlink/junction พาผลลัพธ์ออกนอก workspace
const physical = path => existsSync(path)
  ? realpathSync(path)
  : join(physical(dirname(path)), relative(dirname(path), path));

export function outputPath(name) {
  const workspace = realpathSync(resolve(process.env.HDC_WORKSPACE || process.cwd()));
  const skill = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  if (inside(skill, workspace)) throw new Error('ต้องรันจาก workspace หรือกำหนด HDC_WORKSPACE เป็นพาธ workspace ห้ามสร้าง artifacts ใน skill');
  const root = join(workspace, 'artifacts');
  const out = resolve(workspace, /[\\/]/.test(name) ? name : join('artifacts', name));
  if (out === root || !inside(root, out) || !inside(root, physical(out))) {
    throw new Error('ไฟล์ผลลัพธ์ต้องอยู่ภายใน workspace/artifacts เท่านั้น');
  }
  return out;
}

export const parseRows = text => {
  const rows = JSON.parse(text.replace(/^\uFEFF+/, ''));
  if (!Array.isArray(rows) || !rows.length || rows.some(r => !r || typeof r !== 'object' || Array.isArray(r))) {
    throw new Error('ข้อมูลต้องเป็นอาร์เรย์ของแถวที่ไม่ว่าง — เช็ค stderr ของ get-data.mjs ก่อน');
  }
  return rows;
};
