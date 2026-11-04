import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { KEY, SECRET, NAMES, compass, getState, setState, roll2d6, esc } from "./shared.js";

const app = document.getElementById("app");
const asPlayer = new URLSearchParams(location.search).get("view") === "player";
const secret = () => JSON.parse(localStorage.getItem(SECRET) || "null");
const pick = { real: null, fakes: new Set() }; // ทิศที่ DM เลือก
const HINT = {
  none: "คุณไม่รู้สึกถึงอะไรเลย…",
  glow: "แสงวาบขึ้นหลายทิศ — ไม่รู้ว่าทางไหนคือของจริง",
  clear: "ชัดเจน! การโจมตีมาจากทิศที่เรืองสีแดง",
};

const ROLL = 1800; // เวลาที่เต๋ากลิ้ง (ms) — ปรับได้
const BEAT = 1500; // จังหวะเว้นให้ลุ้นก่อนเฉลยขั้นต่อไป (ms) — ปรับได้

// นาฬิกาต่อเครื่อง: เริ่มนับเมื่อเครื่องนั้นเห็นการทอยครั้งใหม่ (ทุกคนจึงเห็นเต๋ากลิ้งพร้อมกัน)
const t0 = {};
let booted = false, timer, tick, redraw = () => {};
const age = (k) => {
  if (!(k in t0)) t0[k] = booted ? Date.now() : -1e12; // เปิดหน้าต่างทีหลัง = ข้ามแอนิเมชัน
  return Date.now() - t0[k];
};

OBR.onReady(async () => {
  const [me, role] = await Promise.all([OBR.player.getId(), OBR.player.getRole()]);
  let state = await getState();
  redraw = () => (role === "GM" && !asPlayer && !state ? drawGM(me) : drawPlayer(state, me, role));
  OBR.room.onMetadataChange((m) => {
    const next = m[KEY] || null;
    if (JSON.stringify(next) !== JSON.stringify(state)) { state = next; redraw(); }
  });
  redraw();
});

/* ---------------- หน้าต่างโจมตี (ทุกคนเห็น) ---------------- */
const beat = (t) => `<p class="beat">${t}<i>.</i><i>.</i><i>.</i></p>`;

function rollHTML(label, r, ph) {
  const rolling = ph === "roll";
  const dice = r.dice
    .map((v) => `<span class="die ${rolling ? "tumble" : ph === "land" ? "land" : ""}">${rolling ? "?" : v}</span>`)
    .join("");
  return `<div class="roll"><span class="lbl">${label}</span>${dice}<span class="op">${r.mod < 0 ? "−" : "+"}${Math.abs(r.mod)}</span>` +
    `<b class="tot ${ph === "land" ? "land" : ""}">${rolling ? "…" : "= " + r.total}</b></div>`;
}

function drawPlayer(s, me, role) {
  clearTimeout(timer); clearInterval(tick);
  if (!s) { app.innerHTML = `<p class="muted">ยังไม่มีการโจมตี</p>`; booted = true; return; }
  const mine = s.targetId === me, gm = role === "GM";

  const waits = []; // เวลาที่ต้องวาดหน้าใหม่ (ขั้นตอนถัดไปของการลุ้น)
  const ph = (a, start) => {
    if (a < start) { waits.push(start - a); return "wait"; }
    if (a < start + ROLL) { waits.push(start + ROLL - a); return "roll"; }
    return a < start + ROLL + 700 ? "land" : "done";
  };
  const after = (a, t) => (a >= t ? true : (waits.push(t - a), false));

  const ap = s.perception ? age(s.id + "p") : 0;
  const ad = s.defense ? age(s.id + "d") : 0;
  const pPh = s.perception ? ph(ap, 0) : null;
  const hintOn = !!s.hint && after(ap, ROLL + BEAT); // ทิศโผล่หลังเต๋า WIS หยุด + จังหวะลุ้น
  const dPh = s.defense ? ph(ad, 0) : null;
  const aPh = s.reveal ? ph(ad, ROLL + BEAT) : null; // เต๋า DM กลิ้งหลังเต๋าป้องกันหยุด
  const revealOn = !!s.reveal && after(ad, 2 * ROLL + 2 * BEAT); // เฉลยทิศหลังเต๋า DM หยุด

  const sec = gm ? secret() : null, st = {};
  if (sec?.id === s.id) { sec.fakes.forEach((d) => (st[d] = "fake")); st[sec.real] = "real"; } // GM เห็นความจริงเสมอ
  else {
    if (hintOn && s.hint.kind === "glow") s.hint.dirs.forEach((d) => (st[d] = "glow"));
    if (hintOn && s.hint.kind === "clear") st[s.hint.dirs[0]] = "real";
    if (revealOn) { s.reveal.fakes.forEach((d) => (st[d] = "fake")); st[s.reveal.real] = "real"; }
  }

  let h = `<h2>⚔️ ${esc(s.monster)} → ${esc(s.targetName)}</h2>` + compass(st);
  let ask = null;

  if (!s.perception) {
    if (mine) ask = "WIS"; else h += `<p class="muted">รอ ${esc(s.targetName)} ทอย WIS…</p>`;
  } else {
    h += rollHTML("WIS", s.perception, pPh);
    if (pPh === "land" || pPh === "done") h += hintOn ? `<p class="hint">${HINT[s.hint.kind]}</p>` : beat("กำลังรับรู้");
  }

  if (hintOn && !s.defense) {
    if (mine) ask = s.defStat; else h += `<p class="muted">รอ ${esc(s.targetName)} ทอย ${s.defStat}…</p>`;
  }
  if (s.defense) {
    h += rollHTML(s.defStat, s.defense, dPh);
    if (!s.reveal) h += `<p class="muted">รอ DM…</p>`;
    else if (aPh === "wait") { if (dPh !== "roll") h += beat("DM กำลังทอย"); }
    else h += rollHTML("DM", s.reveal.atk, aPh);
  }
  if (revealOn) {
    h += `<p>ทิศจริง: <b class="r">${NAMES[s.reveal.real]}</b> · ทิศหลอก: <b class="y">${s.reveal.fakes.map((d) => NAMES[d]).join(", ") || "-"}</b></p>`;
  }

  if (ask) h += `<label>${ask} modifier <input id="mod" type="number" value="0"></label><button id="go">ทอย ${ask}</button>`;
  if (gm) h += `<button id="clear">จบการโจมตี</button>`;
  h += `<button id="close" class="ghost">ปิดหน้าต่าง</button>`;
  app.innerHTML = h;

  app.querySelector("#close").onclick = () => { OBR.popover.close("dw-attack"); OBR.action.close(); };
  const clr = app.querySelector("#clear");
  if (clr) clr.onclick = () => { localStorage.removeItem(SECRET); setState(null); };
  app.querySelector("#go")?.addEventListener("click", async () => {
    const cur = await getState();
    if (!cur || cur.id !== s.id) return;
    const r = roll2d6(+app.querySelector("#mod").value || 0);
    if (!cur.perception) cur.perception = r;
    else if (cur.hint && !cur.defense) cur.defense = r;
    else return;
    await setState(cur);
  });

  if (waits.length) timer = setTimeout(redraw, Math.min(...waits) + 30);
  if (app.querySelector(".tumble")) {
    tick = setInterval(() => app.querySelectorAll(".tumble").forEach((e) => (e.textContent = 1 + Math.floor(Math.random() * 6))), 70);
  }
  booted = true;
}

/* ---------------- แผงควบคุม DM ---------------- */
const cycle = (d) => {
  if (pick.real === d) { pick.real = null; pick.fakes.add(d); } // จริง → หลอก
  else if (pick.fakes.has(d)) pick.fakes.delete(d); // หลอก → ว่าง
  else pick.real = d; // ว่าง → จริง
};

async function drawGM(me) {
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
    OBR.action.close(); // ปิดแผง DM เพื่อให้เห็นหน้าต่างโจมตีที่เด้งขึ้น
  };
}
