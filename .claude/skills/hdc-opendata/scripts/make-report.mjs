#!/usr/bin/env node
// JSON จาก get-data.mjs -> report.html (ตาราง + กราฟแท่ง Chart.js) แล้วเปิดใน Chrome
//   node scripts/get-data.mjs s_ht_screen | node scripts/make-report.mjs s_ht_screen "คัดกรองความดัน ปีงบ 2569"
//   node scripts/make-report.mjs s_ht_screen data.json out.html "ชื่อรายงาน"   (ชื่อไฟล์เปล่า -> artifacts/)
//   node scripts/make-report.mjs --check              (--no-open = ไม่เปิด Chrome)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { outputPath, parseRows } from './output-path.mjs';
import { execFile } from 'node:child_process';
import assert from 'node:assert';
import { labels } from './get-schema.mjs';

// ตารางชื่อจาก data/*.csv (ดัมพ์จาก HOSxP — ดู SKILL.md) ไม่มีไฟล์ก็ยังทำงานได้ แค่โชว์เป็นรหัส
const lookup = name => {
  const f = new URL(`../data/${name}.csv`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const m = new Map();
  if (existsSync(f)) for (const l of readFileSync(f, 'utf8').split('\n').slice(1)) {
    const c = [...l.matchAll(/"((?:[^"]|"")*)"/g)].map(x => x[1].replaceAll('""', '"'));
    if (c.length) m.set(c[0], c.slice(1));                               // "code","f1","f2"... -> code -> [f1,f2...]
  }
  return m;
};
const AREA = lookup('areacode'), HOSP = lookup('hospcode');              // areacode: code -> [อำเภอ, ตำบล]
const hospName = c => HOSP.get(String(c))?.[0] ?? c;
// areacode 8 หลัก = จังหวัด2+อำเภอ2+ตำบล2+หมู่2 -> "อ.x ต.y ม.z" (หมู่อ่านจากรหัสตรงๆ ไม่ต้อง lookup)
const areaName = c => {
  const s = String(c);
  if (!/^\d{8}$/.test(s)) return c;                                      // HDC มีรหัสเสียปนมา -> โชว์ดิบ อย่ากลบ
  const r = AREA.get(s.slice(0, 6)) ?? AREA.get(s.slice(0, 4) + '00');
  if (!r) return c;
  const [amp, tmb] = r, moo = +s.slice(6, 8);
  return [amp && 'อ.' + amp, tmb && 'ต.' + tmb, moo && 'ม.' + moo].filter(Boolean).join(' ');
};
const amphoeName = c => AREA.get(String(c).slice(0, 4) + '00')?.[0] ?? c;

// คอลัมน์ตัวเลข = มี number จริงอย่างน้อย 1 แถว และไม่มีแถวไหนเป็น string (กัน ip/yymm ที่ null ล้วน กับ b_year ที่เป็น "2568")
const numCols = rows => Object.keys(rows[0] ?? {}).filter(k =>
  rows.some(r => typeof r[k] === 'number') && rows.every(r => r[k] == null || typeof r[k] === 'number'));

// ข้อมูลดิบเป็นราย hospcode -> รวมเป็นรายอำเภอด้วย areacode 4 หลักแรก (จังหวัด 2 + อำเภอ 2)
const byAmphoe = (rows, cols) => {
  const g = {};
  for (const r of rows) {
    const k = (/^\d{8}$/.test(String(r.areacode)) ? String(r.areacode).slice(0, 4) : 'ไม่ทราบอำเภอ');
    g[k] ??= Object.fromEntries(cols.map(c => [c, 0]));
    for (const c of cols) g[k][c] += r[c] || 0;
  }
  return g;
};

// </script> ที่หลุดมากับข้อมูลจะปิด tag กลางคัน -> หนี < ทุกตัว
const embed = v => JSON.stringify(v).replaceAll('<', '\\u003c');

const html = (rows, title, lab = {}) => {
  const cols = numCols(rows);
  // ส่งชื่อไปเฉพาะรหัสที่มีในข้อมูลจริง ไม่ยัดทั้งตาราง lookup ลง HTML
  const nm = { area: {}, hosp: {}, amphoe: {} };
  for (const r of rows) {
    if (r.areacode != null) { nm.area[r.areacode] = areaName(r.areacode); nm.amphoe[String(r.areacode).slice(0, 4)] = amphoeName(r.areacode); }
    if (r.hospcode != null) nm.hosp[r.hospcode] = hospName(r.hospcode);
  }
  return `<!doctype html><html lang="th"><meta charset="utf-8"><title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
:root{color-scheme:light;--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--series-1:#2a78d6;--line:#e3e2dd}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;--surface-1:#1a1a19;--text-primary:#fff;--text-secondary:#c3c2b7;--series-1:#3987e5;--line:#33332f}}
body{margin:0;padding:24px;background:var(--surface-1);color:var(--text-primary);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
h1{font-size:18px;margin:0 0 2px}p.sub{color:var(--text-secondary);margin:0 0 20px}
.wrap{max-width:1100px;margin:0 auto}
canvas{max-height:300px}
.bar{display:flex;gap:10px;align-items:center;margin:24px 0 8px}
input,select{font:inherit;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface-1);color:inherit}
input{flex:1}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:4px 8px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
th{position:sticky;top:0;background:var(--surface-1);cursor:pointer;color:var(--text-secondary);font-weight:600}
td.n{text-align:right}
.scroll{max-height:60vh;overflow:auto;border:1px solid var(--line);border-radius:8px}
</style>
<div class=wrap>
<h1>${title}</h1><p class=sub id=sub></p>
<div class=bar><label>กราฟรายอำเภอ: <select id=m></select></label></div>
<canvas id=c></canvas>
<div class=bar><input id=q placeholder="กรองทุกคอลัมน์…"><span id=n></span></div>
<div class=scroll><table><thead id=h></thead><tbody id=b></tbody></table></div>
</div>
<script>
const rows=${embed(rows)}, cols=${embed(cols)}, nm=${embed(nm)}, lab=${embed(lab)};
const agg=${embed(byAmphoe(rows, cols))};
const $=s=>document.querySelector(s), keys=Object.keys(rows[0]||{});
const css=v=>getComputedStyle(document.body).getPropertyValue(v).trim();
$('#sub').textContent=rows.length.toLocaleString()+' แถว · '+Object.keys(agg).length+' กลุ่มพื้นที่ · '+keys.length+' คอลัมน์';

// --- กราฟ: ซีรีส์เดียว -> ไม่ต้องมี legend (หัวข้อบอกอยู่แล้ว) ---
$('#m').innerHTML=cols.map(c=>'<option value=\"'+c+'\"></option>').join('');
[...$('#m').options].forEach((o,i)=>o.textContent=lab[cols[i]]||cols[i]);   // ชื่อคอลัมน์จาก schema
let chart;
const draw=()=>{
  const c=$('#m').value, labels=Object.keys(agg).sort((a,b)=>agg[b][c]-agg[a][c]);
  chart?.destroy();
  chart=new Chart($('#c'),{type:'bar',
    data:{labels:labels.map(l=>nm.amphoe[l]??l),datasets:[{data:labels.map(l=>agg[l][c]),backgroundColor:css('--series-1'),borderRadius:4,borderSkipped:false}]},
    options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>(lab[c]||c)+': '+x.parsed.y.toLocaleString()}}},
      scales:{x:{grid:{display:false},ticks:{color:css('--text-secondary')}},
              y:{beginAtZero:true,border:{display:false},grid:{color:css('--line')},ticks:{color:css('--text-secondary')}}}}});
};
$('#m').onchange=draw; matchMedia('(prefers-color-scheme:dark)').onchange=draw; draw();

// --- ตาราง: คลิกหัวคอลัมน์เพื่อเรียง, ช่องบนกรองทุกคอลัมน์ ---
let sortKey=keys[0], dir=1;
$('#h').innerHTML='<tr>'+keys.map(k=>'<th data-k="'+k+'"></th>').join('')+'</tr>';
[...$('#h').querySelectorAll('th')].forEach((th,i)=>{th.textContent=lab[keys[i]]||keys[i]; th.title=keys[i];});   // ชื่อดิบอยู่ใน tooltip
$('#h').onclick=e=>{const k=e.target.dataset.k; if(!k)return; dir=k===sortKey?-dir:1; sortKey=k; render();};
$('#q').oninput=render;
function render(){
  const q=$('#q').value.trim();
  const v=(q?rows.filter(r=>keys.some(k=>String(r[k]??'').includes(q))):rows.slice())
    .sort((a,b)=>(a[sortKey]>b[sortKey]?1:a[sortKey]<b[sortKey]?-1:0)*dir);
  $('#n').textContent=v.length.toLocaleString()+' / '+rows.length.toLocaleString()+' แถว';
  const f=document.createDocumentFragment();
  for(const r of v){const tr=document.createElement('tr');
    for(const k of keys){const td=document.createElement('td');
      const x=r[k], n=k==='areacode'?nm.area[x]:k==='hospcode'?nm.hosp[x]:null;
      if(n!=null&&n!==x){td.textContent=n; td.title=x;}                        // โชว์ชื่อ รหัสอยู่ใน tooltip
      else td.textContent=typeof x==='number'?x.toLocaleString():(x??'');
      if(typeof x==='number')td.className='n'; tr.append(td);}
    f.append(tr);}
  $('#b').replaceChildren(f);
}
render();
</script>`;
};

const argv = process.argv.slice(2);
if (argv[0] === '--check') {
  const r = [{ a: 1, b: 'x', c: null, areacode: '65010101' }, { a: 2, b: 'y', c: null, areacode: '65020101' }];
  assert.deepEqual(numCols(r), ['a']);                                    // b เป็น string, c เป็น null ล้วน
  assert.deepEqual(numCols([{ n: 1 }, { n: null }]), ['n']);              // null ปนได้ ถ้ามีเลขจริง
  assert.deepEqual(numCols([]), []);
  assert.deepEqual(byAmphoe(r, ['a']), { 6501: { a: 1 }, 6502: { a: 2 } });
  assert.deepEqual(byAmphoe([{ hospcode: '07574', a: 5 }], ['a']), { 'ไม่ทราบอำเภอ': { a: 5 } });
  assert.equal(embed(['</script>']), '["\\u003c/script>"]');              // ปิด tag กลางคันไม่ได้
  assert.ok(html([{ areacode: '65010101', target: 1 }], 'x').includes('<canvas'));
  assert.equal(areaName('65010101'), 'อ.เมืองพิษณุโลก ต.ในเมือง ม.1');     // ครบ 3 ระดับ
  assert.equal(areaName('65010100'), 'อ.เมืองพิษณุโลก ต.ในเมือง');         // หมู่ 00 -> ตัดทิ้ง
  assert.equal(areaName('65010000'), 'อ.เมืองพิษณุโลก');                   // ระดับอำเภอ ไม่ซ้ำเป็น ต.เมืองพิษณุโลก
  assert.equal(areaName('6501010-'), '6501010-');                        // รหัสเสียจาก HDC -> ไม่กลบ
  assert.equal(amphoeName('6501'), 'เมืองพิษณุโลก');
  assert.equal(amphoeName('65010101'), 'เมืองพิษณุโลก');                   // -> อำเภอ
  assert.equal(areaName('99999999'), '99999999');                        // ไม่รู้จัก -> คืนรหัสเดิม ไม่พัง
  assert.equal(hospName('07574'), 'โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านยาง');
  console.log('ok');
} else {
  const arg = argv.filter(a => a !== '--no-open');
  const src = arg.find(a => a.endsWith('.json'));
  const table = arg.find(a => /^s_\w+$/.test(a));                  // ใส่ชื่อตาราง -> หัวตารางเป็นคำอธิบายจาก schema
  // ผลลัพธ์ทุกพาธต้องอยู่ภายใน workspace/artifacts
  const o = arg.find(a => a.endsWith('.html')) ?? 'report.html';
  const out = outputPath(o);
  mkdirSync(dirname(out), { recursive: true });
  const title = arg.find(a => a !== table && !/\.(json|html)$/.test(a)) ?? 'HDC report';
  const rows = parseRows(readFileSync(src ?? 0, 'utf8'));                // ไม่ระบุไฟล์ -> อ่าน stdin (fd 0)
  if (!rows.length) throw new Error('ไม่มีข้อมูล — เช็ค stderr ของ get-data.mjs ก่อน');
  writeFileSync(out, html(rows, title, table ? await labels(table) : {}), 'utf8');
  console.error(`  ${rows.length} แถว -> ${out}`);
  if (!argv.includes('--no-open')) {
    const cmd = { win32: ['cmd', ['/c', 'start', '', 'chrome', out]], darwin: ['open', ['-a', 'Google Chrome', out]] }[process.platform]
      ?? ['google-chrome', [out]];
    execFile(...cmd, e => e && console.error(`  ! เปิด Chrome ไม่ได้ (${e.message}) — เปิดเองที่ ${out}`));
  }
  // ห้าม process.exit() ที่นี่: socket ของ fetch(schema) ยังปิดไม่เสร็จ -> libuv assert ตายบน Windows
  // ปล่อยให้ event loop ว่างเองแทน แล้วสั่ง unref ให้ไม่ต้องรอ keep-alive หมดอายุ
  process.exitCode = 0;
}
