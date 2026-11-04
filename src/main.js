import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { KEY, SECRET, NAMES, compass, getState, setState, roll2d6, rollText, esc } from "./shared.js";

const app = document.getElementById("app");
const asPlayer = new URLSearchParams(location.search).get("view") === "player";
const secret = () => JSON.parse(localStorage.getItem(SECRET) || "null");
const pick = { real: null, fakes: new Set() }; // ทิศที่ DM เลือก
const HINT = {
  none: "คุณไม่รู้สึกถึงอะไรเลย…",
  glow: "แสงวาบขึ้นหลายทิศ — ไม่รู้ว่าทางไหนคือของจริง",
  clear: "ชัดเจน! การโจมตีมาจากทิศที่เรืองสีแดง",
};

OBR.onReady(async () => {
  const [me, role] = await Promise.all([OBR.player.getId(), OBR.player.getRole()]);
  let state = await getState();
  const draw = () => (role === "GM" && !asPlayer ? drawGM(state, me) : drawPlayer(state, me));
  OBR.room.onMetadataChange((m) => {
    const next = m[KEY] || null;
    if (JSON.stringify(next) !== JSON.stringify(state)) { state = next; draw(); }
  });
  draw();
});

/* ---------------- ผู้เล่น ---------------- */
function drawPlayer(s, me) {
  if (!s || s.targetId !== me) { app.innerHTML = `<p class="muted">ยังไม่มีการโจมตีที่เล็งมาที่คุณ</p>`; return; }
  const st = {};
  if (s.hint?.kind === "glow") s.hint.dirs.forEach((d) => (st[d] = "glow"));
  if (s.hint?.kind === "clear") st[s.hint.dirs[0]] = "real";
  if (s.reveal) { s.reveal.fakes.forEach((d) => (st[d] = "fake")); st[s.reveal.real] = "real"; }

  let h = `<h2>⚔️ ${esc(s.monster)} โจมตี!</h2>` + compass(st);
  let ask = null;
  if (!s.perception) ask = "WIS";
  else h += `<p>🧠 WIS ${rollText(s.perception)}</p>`;
  if (s.perception && !s.hint) h += `<p class="muted">กำลังรับรู้…</p>`;
  if (s.hint) h += `<p class="hint">${HINT[s.hint.kind]}</p>`;
  if (s.hint && !s.defense) ask = s.defStat;
  if (s.defense) h += `<p>🛡️ ${s.defStat} ${rollText(s.defense)}</p>`;
  if (s.defense && !s.reveal) h += `<p class="muted">รอ DM เฉลย…</p>`;
  if (s.reveal) {
    h += `<p class="big">DM attack ${rollText(s.reveal.atk)}</p>` +
      `<p>ทิศจริง: <b class="r">${NAMES[s.reveal.real]}</b> · ทิศหลอก: <b class="y">${s.reveal.fakes.map((d) => NAMES[d]).join(", ") || "-"}</b></p>` +
      `<button id="close">ปิด</button>`;
  }
  if (ask) h += `<label>${ask} modifier <input id="mod" type="number" value="0"></label><button id="go">ทอย ${ask}</button>`;
  app.innerHTML = h;

  app.querySelector("#close")?.addEventListener("click", () => OBR.popover.close("dw-attack"));
  app.querySelector("#go")?.addEventListener("click", async () => {
    const cur = await getState();
    if (!cur || cur.id !== s.id) return;
    const r = roll2d6(+app.querySelector("#mod").value || 0);
    if (!cur.perception) cur.perception = r;
    else if (cur.hint && !cur.defense) cur.defense = r;
    else return;
    await setState(cur);
  });
}

/* ---------------- DM ---------------- */
const cycle = (d) => {
  if (pick.real === d) { pick.real = null; pick.fakes.add(d); } // จริง → หลอก
  else if (pick.fakes.has(d)) pick.fakes.delete(d); // หลอก → ว่าง
  else pick.real = d; // ว่าง → จริง
};

async function drawGM(s, me) {
  if (s) {
    const sec = secret(), st = {};
    if (sec?.id === s.id) { sec.fakes.forEach((d) => (st[d] = "fake")); st[sec.real] = "real"; }
    const step = !s.perception ? `รอ ${esc(s.targetName)} ทอย WIS` : !s.hint ? "กำลังตัดสินผล…" : !s.defense ? `รอทอยป้องกัน (${s.defStat})` : "เฉลยแล้ว";
    app.innerHTML =
      `<h2>⚔️ ${esc(s.monster)} → ${esc(s.targetName)}</h2><p>สถานะ: <b>${step}</b></p>` + compass(st) +
      (s.perception ? `<p>🧠 WIS ${rollText(s.perception)}</p>` : "") +
      (s.defense ? `<p>🛡️ ${s.defStat} ${rollText(s.defense)}</p>` : "") +
      (sec ? `<p>DM attack ${rollText(sec.atk)}</p>` : "") +
      `<button id="clear">จบการโจมตี</button>`;
    app.querySelector("#clear").onclick = () => { localStorage.removeItem(SECRET); setState(null); };
    return;
  }

  const players = [
    { id: me, name: (await OBR.player.getName()) + " (GM)" },
    ...(await OBR.party.getPlayers()).filter((p) => p.role !== "GM"),
  ];
  app.innerHTML = `
    <h2>เริ่มการโจมตี</h2>
    <label>มอนสเตอร์ <input id="mon" value="มอนสเตอร์"></label>
    <label>เป้าหมาย <select id="tgt">${players.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <label>ป้องกันด้วย <select id="def"><option>STR</option><option>DEX</option></select></label>
    <label>DM attack modifier <input id="amod" type="number" value="0"></label>
    <p class="muted">คลิกลูกศร: ครั้งที่ 1 = <b class="r">ทิศจริง</b> · 2 = <b class="y">ทิศหลอก</b> · 3 = ยกเลิก</p>
    <div id="cmp"></div>
    <button id="start">ทอยโจมตี</button>`;

  const cmp = app.querySelector("#cmp");
  const paint = () => {
    const st = {};
    pick.fakes.forEach((d) => (st[d] = "fake"));
    if (pick.real !== null) st[pick.real] = "real";
    cmp.innerHTML = compass(st, true);
  };
  cmp.onclick = (e) => {
    const b = e.target.closest("[data-dir]");
    if (b) { cycle(+b.dataset.dir); paint(); }
  };
  paint();

  app.querySelector("#start").onclick = async () => {
    if (pick.real === null) return OBR.notification.show("ต้องเลือกทิศจริงก่อน (คลิกลูกศร 1 ครั้ง)", "ERROR");
    const t = players.find((p) => p.id === app.querySelector("#tgt").value);
    const id = Date.now().toString(36);
    localStorage.setItem(SECRET, JSON.stringify({
      id, real: pick.real, fakes: [...pick.fakes], atk: roll2d6(+app.querySelector("#amod").value || 0),
    }));
    await setState({
      id, monster: app.querySelector("#mon").value || "มอนสเตอร์",
      targetId: t.id, targetName: t.name, defStat: app.querySelector("#def").value,
    });
    pick.real = null; pick.fakes.clear();
  };
}
