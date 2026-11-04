# Dungeon World: Directional Attack (Owlbear Rodeo Extension)

## ลำดับการเล่น
1. **DM** กดไอคอนส่วนขยาย → ใส่ชื่อมอนสเตอร์, เลือกเป้าหมาย, เลือก STR/DEX สำหรับป้องกัน
   คลิกลูกศร 8 ทิศ: ครั้งที่ 1 = ทิศจริง, 2 = ทิศหลอก, 3 = ยกเลิก → กด **ทอยโจมตี**
2. ผู้เล่นที่ถูกโจมตีจะมีหน้าต่างเด้งขึ้นเอง (คนอื่นเห็นแค่แจ้งเตือน) → ใส่ **WIS modifier** แล้วทอย 2d6
   - **6-** ไม่ได้ข้อมูลอะไร
   - **7-9** ทิศจริง + ทิศหลอกกะพริบแสงสุ่มปนกัน แยกไม่ออก
   - **10+** ทิศจริงเรืองสีแดงชัดเจน
3. ผู้เล่นทอย **ป้องกัน** (STR/DEX ตามที่ DM เลือก) — ทุกกรณีทอยเสมอ (ปรับได้ใน `src/main.js`)
4. ระบบเฉลย: ทิศจริง (แดง) ทิศหลอก (เหลือง) และผลทอย attack ของ DM
5. DM กด **จบการโจมตี** เพื่อล้างสถานะ

## ติดตั้ง / ปล่อยขึ้น GitHub Pages
```bash
npm install
npm run dev      # ทดสอบ: ใส่ http://localhost:5173/manifest.json ใน Owlbear
```
1. push ขึ้น GitHub (branch `main`) → Settings → Pages → Source: **GitHub Actions**
2. ใน Owlbear Rodeo: Profile → Extensions → Add Custom Extension → ใส่
   `https://<ชื่อผู้ใช้>.github.io/<ชื่อ repo>/manifest.json`

## หมายเหตุ
- ความลับของ DM (ทิศจริง/หลอก/ผลทอย) เก็บใน localStorage ของเครื่อง DM และเปิดเผยทีละขั้นเท่านั้น
  **DM ต้องออนไลน์** ระหว่างการโจมตี เพราะเครื่อง DM เป็นกรรมการ (`src/background.js`)
- ถ้าไอคอน/หน้าต่างไม่โหลดบน GitHub Pages แบบโฟลเดอร์ย่อย ให้ลองโฮสต์ที่ Vercel/Netlify/Cloudflare Pages แทน
