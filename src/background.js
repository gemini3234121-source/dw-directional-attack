import OBR from "@owlbear-rodeo/sdk";
import { KEY, SECRET, shuffle, setState } from "./shared.js";

// DM client = กรรมการ: ดูผลทอยของผู้เล่น แล้วเปิดเผยข้อมูลทีละขั้นตามความลับที่เก็บไว้
async function referee(s) {
  const sec = JSON.parse(localStorage.getItem(SECRET) || "null");
  if (!s || !sec || sec.id !== s.id) return;
  if (s.perception && !s.hint) {
    const t = s.perception.total;
    const hint =
      t >= 10 ? { kind: "clear", dirs: [sec.real] }
      : t >= 7 ? { kind: "glow", dirs: shuffle([sec.real, ...sec.fakes]) }
      : { kind: "none", dirs: [] };
    await setState({ ...s, hint });
  } else if (s.defense && !s.reveal) {
    await setState({ ...s, reveal: { real: sec.real, fakes: sec.fakes, atk: sec.atk } });
  }
}

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  let seen = null;

  const react = async (s) => {
    if (!s) { seen = null; OBR.popover.close("dw-attack"); return; }
    if (s.id !== seen) {
      seen = s.id;
      // เปิดให้ "ทุกคน" ในห้องเห็นการโจมตีแบบเรียลไทม์ (เป้าหมายเท่านั้นที่ทอยได้)
      // disableClickAway เปิดให้ทุกคน: หน้าต่างต้องไม่หายเองเมื่อผู้เล่นคลิกแผนที่ ไม่งั้นจะพลาดเต๋า/เฉลยที่ตามมา
      // (ปิดได้ด้วยปุ่ม "ปิดหน้าต่าง" หรือเมื่อ DM กด "จบการโจมตี")
      if (!s.reveal) {
        OBR.popover.open({
          id: "dw-attack",
          url: new URL("index.html?view=player", location.href).href,
          width: 360,
          height: 660,
          disableClickAway: true,
        });
      }
    }
    if (role === "GM") await referee(s);
  };

  react((await OBR.room.getMetadata())[KEY]);
  OBR.room.onMetadataChange((m) => react(m[KEY]));
});
