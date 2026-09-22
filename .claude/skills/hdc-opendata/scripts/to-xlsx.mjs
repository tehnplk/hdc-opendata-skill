#!/usr/bin/env node
// JSON จาก get-data.mjs -> .xlsx  (zero dependency: ZIP + OOXML เขียนเอง ใช้ได้ทุกเครื่องที่มี node)
//   node scripts/get-data.mjs s_ht_screen | node scripts/to-xlsx.mjs ht.xlsx
//   node scripts/to-xlsx.mjs data.json ht.xlsx        (ชื่อไฟล์เปล่า -> artifacts/)
//   node scripts/to-xlsx.mjs --check
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { outputPath, parseRows } from './output-path.mjs';
import { deflateRawSync } from 'node:zlib';
import assert from 'node:assert';
import { labels } from './get-schema.mjs';

// zlib.crc32 มีเฉพาะ node >= 22 — เครื่อง รพ. อาจเป็น node เก่า ทำเองสั้นกว่าเขียน branch เช็คเวอร์ชัน
const TBL = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1; return c;
});
const crc32 = b => { let c = ~0; for (const x of b) c = TBL[(c ^ x) & 255] ^ c >>> 8; return ~c >>> 0; };

const zip = files => {
  const parts = [], cen = [];
  let off = 0;
  for (const [name, body] of files) {
    const n = Buffer.from(name), buf = Buffer.from(body), c = deflateRawSync(buf), crc = crc32(buf);
    const h = Buffer.alloc(30);                                   // local file header
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(c.length, 18); h.writeUInt32LE(buf.length, 22);
    h.writeUInt16LE(n.length, 26);
    const d = Buffer.alloc(46);                                   // central directory header
    d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt16LE(8, 10);
    d.writeUInt32LE(crc, 16); d.writeUInt32LE(c.length, 20); d.writeUInt32LE(buf.length, 24);
    d.writeUInt16LE(n.length, 28); d.writeUInt32LE(off, 42);
    parts.push(h, n, c); cen.push(d, n);
    off += 30 + n.length + c.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22);          // end of central directory
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
};

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');                  // control char ทำให้ Excel ฟ้องไฟล์เสีย
const colRef = i => { let s = ''; for (i++; i; i = (i - 1) / 26 | 0) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };

// string อยู่เป็น inlineStr เสมอ -> hospcode "07574" ไม่โดน Excel ตัด 0 นำหน้า (เหตุผลหลักที่ต้องทำ xlsx)
const cell = (v, ref) => v == null || v === '' ? ''
  : typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>`
    : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;

const sheet = (rows, lab = {}) => {
  const keys = Object.keys(rows[0] ?? {});
  const r = [`<row r="1">${keys.map((k, i) => cell(lab[k] ?? k, colRef(i) + 1)).join('')}</row>`];   // หัวตาราง = คำอธิบายจาก schema ถ้ามี
  rows.forEach((row, n) => r.push(`<row r="${n + 2}">${keys.map((k, i) => cell(row[k], colRef(i) + (n + 2))).join('')}</row>`));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${r.join('')}</sheetData></worksheet>`;
};

const sheetName = name => String(name).replace(/[\x00-\x1F\\/?:*\[\]]/g, '_').slice(0, 31).replace(/^'+|'+$/g, '') || 'data';
const attr = value => esc(value).replaceAll('"', '&quot;');

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xlsx = (rows, name = 'data', lab = {}) => zip([
  ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
  ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
  ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets><sheet name="${attr(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
  ['xl/worksheets/sheet1.xml', sheet(rows, lab)],
]);

const argv = process.argv.slice(2);
if (argv[0] === '--check') {
  assert.equal(crc32(Buffer.from('abc')), 0x352441c2);                   // ตรงกับ zlib.crc32
  assert.equal(colRef(0) + colRef(25) + colRef(26) + colRef(701), 'AZAAZZ');
  assert.equal(cell(null, 'A1'), '');                                    // null -> ไม่เขียน cell
  assert.equal(cell(7, 'A1'), '<c r="A1"><v>7</v></c>');
  assert.ok(cell('07574', 'A1').includes('t="inlineStr"'));              // รหัสต้องเป็นข้อความ ไม่งั้น 0 หาย
  assert.ok(cell('a&b<c', 'A1').includes('a&amp;b&lt;c'));
  assert.ok(sheet([{ target: 1 }], { target: 'เป้าหมาย' }).includes('เป้าหมาย'));   // หัวตาราง = คำอธิบายจาก schema
  assert.ok(sheet([{ target: 1 }]).includes('>target<'));                          // ไม่มี schema -> ชื่อคอลัมน์ดิบ
  const b = xlsx([{ hospcode: '07574', target: 64 }]);
  assert.equal(b.readUInt32LE(0), 0x04034b50);                           // ขึ้นต้น PK\3\4
  assert.equal(b.readUInt32LE(b.length - 22), 0x06054b50);               // ปิดท้ายด้วย EOCD
  assert.equal(b.readUInt16LE(b.length - 12), 5);                        // 5 ไฟล์ใน zip
  console.log('ok');
} else {
  const arg = argv.filter(a => a !== '--no-open');
  const src = arg.find(a => a.endsWith('.json'));
  const table = arg.find(a => /^s_\w+$/.test(a));                  // ใส่ชื่อตาราง -> หัวตารางเป็นคำอธิบายจาก schema
  const o = arg.find(a => a.endsWith('.xlsx')) ?? 'data.xlsx';
  const out = outputPath(o);       // ชื่อไฟล์เปล่าๆ ลง artifacts/ เสมอ
  const rows = parseRows(readFileSync(src ?? 0, 'utf8'));
  if (!rows.length) throw new Error('ไม่มีข้อมูล — เช็ค stderr ของ get-data.mjs ก่อน');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, xlsx(rows, arg.find(a => a !== table && !/\.(json|xlsx)$/.test(a)) ?? 'data', table ? await labels(table) : {}));
  console.error(`  ${rows.length} แถว -> ${out}`);
}
