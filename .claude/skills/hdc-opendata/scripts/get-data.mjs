#!/usr/bin/env node
// POST /report_data -> ข้อมูลในรายงาน (วน offset ให้จนครบ)
//   node get-data.mjs s_ht_screen_pop_age              > data.json   # default: ปีงบปัจจุบัน + พิษณุโลก
//   node get-data.mjs s_ht_screen_pop_age 2568 พิษณุโลก > data.json
//   node get-data.mjs s_ht_screen_pop_age 2568 65 csv   > data.csv
//   node get-data.mjs --check
import assert from 'node:assert';
const API = 'https://opendata.moph.go.th/api';
const PAGE = 10000;                                  // เพดานของ API
const sleep = ms => new Promise(r => setTimeout(r, ms));

// รหัสจังหวัด มท. (ตรงกับ enum ใน swagger, 77 จังหวัด)
const PROV = { 10:'กรุงเทพมหานคร',11:'สมุทรปราการ',12:'นนทบุรี',13:'ปทุมธานี',14:'พระนครศรีอยุธยา',15:'อ่างทอง',16:'ลพบุรี',17:'สิงห์บุรี',18:'ชัยนาท',19:'สระบุรี',
  20:'ชลบุรี',21:'ระยอง',22:'จันทบุรี',23:'ตราด',24:'ฉะเชิงเทรา',25:'ปราจีนบุรี',26:'นครนายก',27:'สระแก้ว',
  30:'นครราชสีมา',31:'บุรีรัมย์',32:'สุรินทร์',33:'ศรีสะเกษ',34:'อุบลราชธานี',35:'ยโสธร',36:'ชัยภูมิ',37:'อำนาจเจริญ',38:'บึงกาฬ',39:'หนองบัวลำภู',
  40:'ขอนแก่น',41:'อุดรธานี',42:'เลย',43:'หนองคาย',44:'มหาสารคาม',45:'ร้อยเอ็ด',46:'กาฬสินธุ์',47:'สกลนคร',48:'นครพนม',49:'มุกดาหาร',
  50:'เชียงใหม่',51:'ลำพูน',52:'ลำปาง',53:'อุตรดิตถ์',54:'แพร่',55:'น่าน',56:'พะเยา',57:'เชียงราย',58:'แม่ฮ่องสอน',
  60:'นครสวรรค์',61:'อุทัยธานี',62:'กำแพงเพชร',63:'ตาก',64:'สุโขทัย',65:'พิษณุโลก',66:'พิจิตร',67:'เพชรบูรณ์',
  70:'ราชบุรี',71:'กาญจนบุรี',72:'สุพรรณบุรี',73:'นครปฐม',74:'สมุทรสาคร',75:'สมุทรสงคราม',76:'เพชรบุรี',77:'ประจวบคีรีขันธ์',
  80:'นครศรีธรรมราช',81:'กระบี่',82:'พังงา',83:'ภูเก็ต',84:'สุราษฎร์ธานี',85:'ระนอง',86:'ชุมพร',
  90:'สงขลา',91:'สตูล',92:'ตรัง',93:'พัทลุง',94:'ปัตตานี',95:'ยะลา',96:'นราธิวาส' };

const provCode = s => {
  if (PROV[s]) return +s;
  const hit = Object.entries(PROV).filter(([, n]) => n.includes(s));
  if (hit.length !== 1) throw new Error(`จังหวัด "${s}" ${hit.length ? 'กำกวม: ' + hit.map(h => h.join('=')).join(', ') : 'ไม่พบ'}`);
  return +hit[0][0];
};

// UA header: default node UA โดน Cloudflare 403 / ยิงรัวโดน 429 -> backoff
async function api(body) {
  for (let a = 0; ; a++) {
    const r = await fetch(`${API}/report_data`, {
      method: 'POST',
      headers: { 'User-Agent': 'curl/8', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (r.ok) return JSON.parse(text);
    // API มี error message ที่ใช้ได้จริง: 404 "ไม่พบตาราง 'x'" / 400 "year must be >= 2560"
    if (r.status !== 429 || a === 5) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    await sleep(2 ** a * 1000);
  }
}

// แปลงเป็น csv เองแทนการขอ type:"csv" จาก API (API คืน text ดิบ ต่อหน้าไม่ได้ + ไม่มี total)
const toCsv = rows => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = v => v == null ? '' : /[",\r\n]/.test(v) ? `"${String(v).replaceAll('"', '""')}"` : v;
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
};

// ปีงบประมาณไทยเริ่ม 1 ต.ค. -> ต.ค.เป็นต้นไปนับเป็นปีถัดไป (getMonth() 9 = ต.ค.)
const fy = d => d.getFullYear() + 543 + (d.getMonth() >= 9 ? 1 : 0);

const arg = process.argv.slice(2);
const type = ['json', 'csv'].includes(arg.at(-1)) ? arg.pop() : 'json';   // pop ก่อน -> ข้าม year/prov ไปสั่ง csv เลยได้
const [table, year = fy(new Date()), prov = 65] = arg;                    // default: ปีงบปัจจุบัน + พิษณุโลก
if (table === '--check') {
  assert.equal(provCode('พิษณุโลก'), 65);
  assert.equal(provCode('65'), 65);
  assert.throws(() => provCode('เชียง'));            // เชียงใหม่/เชียงราย
  assert.equal(Object.keys(PROV).length, 77);
  assert.equal(toCsv([]), '');
  assert.equal(toCsv([{ a: 1, b: null, c: 'x,y' }]), 'a,b,c\n1,,"x,y"');
  assert.equal(toCsv([{ a: 'x\r\ny' }]), 'a\n"x\r\ny"');            // CR ต้องคร่อมด้วย ไม่งั้นแถวขาดกลางคัน
  assert.equal(toCsv([{ a: 'พูดว่า "ฮา"' }]), 'a\n"พูดว่า ""ฮา"""');
  assert.equal(fy(new Date(2026, 8, 30)), 2569);     // 30 ก.ย. = วันสุดท้ายของปีงบเดิม
  assert.equal(fy(new Date(2026, 9, 1)), 2570);      // 1 ต.ค. = ขึ้นปีงบใหม่
  console.log('ok');
} else {
  if (!table) throw new Error('usage: node get-data.mjs <table> [ปีงบ] [จังหวัด] [json|csv]   (default: ปีงบปัจจุบัน + พิษณุโลก)');
  const province = provCode(prov), out = [];
  let total = 0;
  for (let offset = 0; ; offset += PAGE) {
    const res = await api({ tableName: table, year: +year, province, type: 'json', limit: PAGE, offset });
    total = +res.total;                              // API คืน total เป็น string
    out.push(...res.data);
    console.error(`  ${table} ${PROV[province]} ${year} +${res.data.length} (${out.length}/${total})`);
    if (out.length >= total || !res.data.length) break;   // !length กันลูปไม่รู้จบถ้า total เพี้ยน
    await sleep(400);
  }
  if (!total) console.error('  ! ไม่มีข้อมูล — เช็คปีงบ/จังหวัด หรือรายงานนี้ยังไม่เปิดผ่าน API');
  else if (out.length !== total) console.error(`  ! ได้ ${out.length} แถว แต่ API บอก total=${total}`);
  // BOM หน้าไฟล์ csv: ไม่มีแล้ว Excel อ่านไทยเป็นขยะ (ดู SKILL.md) — json ไม่ใส่ เดี๋ยว JSON.parse พัง
  console.log(type === 'csv' ? '\ufeff' + toCsv(out) : JSON.stringify(out));
}
