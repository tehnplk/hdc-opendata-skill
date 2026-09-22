# HDC Open Data Skill

Skill สำหรับ [Claude Code](https://claude.com/claude-code) ดึงรายงานจาก **HDC / MOPH Open Data API** (`opendata.moph.go.th`)
ประมาณ 970 รายงาน 50+ หมวด เช่น คัดกรองความดัน เบาหวาน ANC EPI ทันตกรรม KPI ตัวชี้วัด

สั่งเป็นภาษาไทยในหน้าต่าง Claude Code ได้เลย เช่น

> ขอรายงานคัดกรองเบาหวาน ปีงบ 2568 พิษณุโลก

> อุบัติเหตุทางถนน แยกรายอำเภอ ทำเป็น dashboard ให้หน่อย

API เป็นของสาธารณะ **ไม่ต้องใช้ token ไม่ต้องต่อฐานข้อมูล** และไม่ต้องลง dependency เพิ่มแม้แต่ตัวเดียว

---

## 1. ติดตั้ง Node.js

Skill นี้ใช้ Node.js เป็นตัวรัน ต้องเป็น **เวอร์ชัน 18 ขึ้นไป**

### Windows

1. เข้า <https://nodejs.org> กดปุ่ม **LTS** เพื่อโหลดตัวติดตั้ง (`.msi`)
2. เปิดไฟล์ที่โหลดมา กด Next ไปเรื่อยๆ จนจบ ไม่ต้องเปลี่ยนค่าอะไร
3. **ปิด Command Prompt / PowerShell ที่เปิดค้างไว้ทั้งหมด แล้วเปิดใหม่** (ไม่ปิดเปิดใหม่ จะยังหาคำสั่ง `node` ไม่เจอ)

### macOS / Linux

โหลดตัวติดตั้งจาก <https://nodejs.org> เหมือนกัน หรือถ้ามี Homebrew อยู่แล้ว

```bash
brew install node
```

### ตรวจสอบว่าติดตั้งสำเร็จ

เปิด Command Prompt (Windows) หรือ Terminal (Mac) แล้วพิมพ์

```bash
node -v
```

ต้องขึ้นเลขเวอร์ชันเช่น `v20.11.0` — ถ้าเลขตัวแรกน้อยกว่า 18 ให้ติดตั้งใหม่จาก nodejs.org
ถ้าขึ้นว่า `'node' is not recognized` แปลว่ายังไม่ได้ปิด-เปิดหน้าต่างคำสั่งใหม่ หรือติดตั้งไม่สำเร็จ

---

## 2. ติดตั้ง Skill

เปิด Command Prompt / Terminal แล้วสั่ง

```bash
npx skills add tehnplk/hdc-opendata-skill
```

ครั้งแรกจะถามว่า `Ok to proceed? (y)` ให้ตอบ `y` แล้วเลือกตามที่ถาม

- **เลือก agent** → `claude-code`
- **เลือกที่ติดตั้ง** → `Global` ถ้าอยากใช้ได้ทุกโปรเจกต์ (แนะนำ) หรือ `Project` ถ้าเอาเฉพาะโฟลเดอร์ปัจจุบัน

ไม่อยากตอบคำถามทีละข้อ สั่งรวดเดียวได้

```bash
npx skills add tehnplk/hdc-opendata-skill -a claude-code -g -y
```

### ตรวจสอบว่าติดตั้งสำเร็จ

```bash
# Windows
dir %USERPROFILE%\.claude\skills\hdc-opendata

# macOS / Linux
ls ~/.claude/skills/hdc-opendata
```

ต้องเห็นไฟล์ `SKILL.md` กับโฟลเดอร์ `scripts` และ `data`

จากนั้น **ปิด Claude Code แล้วเปิดใหม่** (ไม่เปิดใหม่ skill จะยังไม่ถูกโหลด) แล้วลองพิมพ์

> รายการรายงานแพทย์แผนไทย

ถ้า Claude ตอบกลับมาเป็นรายชื่อรายงาน = ใช้งานได้แล้ว

### ถ้า skill ไม่ขึ้น

บางเวอร์ชันของตัวติดตั้งจะวางไฟล์ไว้ที่ `.agents/skills/` แทน ทำให้ Claude Code มองไม่เห็น
เช็คด้วย `ls ~/.agents/skills/hdc-opendata` ถ้าเจอที่นั่น ให้ก๊อปโฟลเดอร์ทั้งอันไปไว้ที่ `~/.claude/skills/` แล้วเปิด Claude Code ใหม่

### วิธีติดตั้งแบบไม่ใช้ npx

เครื่องที่สั่ง `npx` ไม่ได้ ให้ทำมือ

1. โหลด ZIP จาก <https://github.com/tehnplk/hdc-opendata-skill/archive/refs/heads/main.zip>
2. แตกไฟล์ออกมา
3. ก๊อปโฟลเดอร์ `.claude/skills/hdc-opendata` ทั้งอัน ไปวางที่
   - Windows: `%USERPROFILE%\.claude\skills\`
   - macOS / Linux: `~/.claude/skills/`
4. ปิด Claude Code แล้วเปิดใหม่

---

## อัปเดตเป็นเวอร์ชันใหม่

```bash
npx skills add tehnplk/hdc-opendata-skill -a claude-code -g -y
```

สั่งซ้ำได้เลย ตัวติดตั้งจะทับของเดิมให้

## ถอนการติดตั้ง

ลบโฟลเดอร์ `~/.claude/skills/hdc-opendata` ทิ้ง แล้วเปิด Claude Code ใหม่

---

## ข้อควรรู้ก่อนใช้

- **ตารางแปลงรหัสเป็นชื่อมีเฉพาะจังหวัดพิษณุโลก** (`data/areacode.csv`, `data/hospcode.csv`)
  จังหวัดอื่นยังดึงรายงานได้ครบทุกอย่าง แค่แสดงเป็นรหัสแทนชื่อตำบล/หน่วยบริการ
  อยากได้ชื่อของจังหวัดตัวเอง ดูวิธีดัมพ์จาก HOSxP ท้ายไฟล์ `SKILL.md`
- **API ดึงได้ทีละจังหวัด** อยากได้ทั้งประเทศต้องวนทีละจังหวัด ใช้เวลานาน
- **`b_year` คือปีงบประมาณ** (ต.ค.–ก.ย.) ไม่ใช่ปีปฏิทิน
- **ไฟล์ที่ skill สร้าง (HTML / xlsx / csv) จะอยู่ในโฟลเดอร์ `artifacts/`** ของโปรเจกต์ที่กำลังเปิดอยู่
- บางรายงานหยุดประมวลผลกลางปี ดูคอลัมน์ `date_com` ประกอบก่อนเอาตัวเลขไปใช้

## License

MIT
