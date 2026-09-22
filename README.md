# HDC Open Data Skill

Skill สำหรับ [Claude Code](https://claude.com/claude-code) และ Codex ดึงรายงานจาก **HDC / MOPH Open Data API** (`opendata.moph.go.th`)
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

## 2. ติดตั้ง Skill แบบ global

ดาวน์โหลด [ZIP ของโปรเจกต์](https://github.com/tehnplk/hdc-opendata-skill/archive/refs/heads/main.zip) แล้วแตกไฟล์ เปิด Terminal ในโฟลเดอร์ที่มี `install.mjs` จากนั้นรัน

```bash
node install.mjs -g
```

ตัวติดตั้งของโปรเจกต์จะคัดลอก skill ลง **ทั้ง 3 ตำแหน่งในโฟลเดอร์ผู้ใช้** เพื่อใช้ได้ทุกโปรเจกต์:

| สำหรับ | Windows | macOS / Linux |
| --- | --- | --- |
| Claude Code | `%USERPROFILE%\.claude\skills\hdc-opendata` | `~/.claude/skills/hdc-opendata` |
| Agents | `%USERPROFILE%\.agents\skills\hdc-opendata` | `~/.agents/skills/hdc-opendata` |
| Codex | `%USERPROFILE%\.codex\skills\hdc-opendata` | `~/.codex/skills/hdc-opendata` |

ใช้ชื่อ `.agents` (มี s) ตัวติดตั้งไม่คัดลอกโฟลเดอร์ `artifacts` ไปด้วย ไฟล์รายงานต้องอยู่ใน `artifacts/` ของ workspace ที่ใช้งาน

### ตรวจสอบว่าติดตั้งสำเร็จ

ตัวติดตั้งต้องแสดง `ติดตั้งแล้ว` ครบ 3 พาธ แต่ละพาธต้องมี `SKILL.md`, `scripts` และ `data`

```powershell
# Windows PowerShell
Get-Item "$env:USERPROFILE/.claude/skills/hdc-opendata/SKILL.md", "$env:USERPROFILE/.agents/skills/hdc-opendata/SKILL.md", "$env:USERPROFILE/.codex/skills/hdc-opendata/SKILL.md"
```

```bash
# macOS / Linux
ls ~/.claude/skills/hdc-opendata/SKILL.md ~/.agents/skills/hdc-opendata/SKILL.md ~/.codex/skills/hdc-opendata/SKILL.md
```

จากนั้นเปิด Claude Code หรือ Codex ใหม่ แล้วลองสั่ง “รายการรายงานแพทย์แผนไทย”

### ติดตั้งเฉพาะโปรเจกต์

เปิด Terminal ใน workspace ปลายทาง แล้วเรียก `install.mjs` ด้วยพาธเต็มโดยไม่ใส่ `-g`:

```bash
node "<พาธโฟลเดอร์ที่แตก ZIP>/install.mjs"
```

โหมดนี้ติดตั้งเฉพาะ `<workspace>/.claude/skills/hdc-opendata` ตามพฤติกรรมเดิม

### ใช้ตัวติดตั้ง Skills CLI

```bash
npx skills add tehnplk/hdc-opendata-skill --skill hdc-opendata -a claude-code codex -g -y
```

คำสั่งนี้ใช้ตัวติดตั้งภายนอก ซึ่งเป็นผู้เลือกตำแหน่งและวิธีเชื่อมโยง skill หากต้องการให้มีไฟล์ครบทั้ง 3 ตำแหน่งตามตาราง ให้ใช้ `node install.mjs -g` ด้านบน

## อัปเดตเป็นเวอร์ชันใหม่

ดาวน์โหลด ZIP ล่าสุดแล้วรันจากโฟลเดอร์ที่แตกไฟล์:

```bash
node install.mjs -g --force
```

จะคัดลอกไฟล์รุ่นใหม่ทับทั้ง 3 ตำแหน่ง หากไม่ใส่ `--force` แล้วพบ skill เดิม ตัวติดตั้งจะหยุดก่อนเริ่มคัดลอก

## ถอนการติดตั้ง

ลบเฉพาะโฟลเดอร์ `hdc-opendata` ในแต่ละตำแหน่งตามตาราง แล้วเปิด Claude Code หรือ Codex ใหม่

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
