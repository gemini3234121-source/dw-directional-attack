import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { KEY, SECRET, NAMES, compass, getState, setState, roll2d6, esc } from "./shared.js";

const app = document.getElementById("app");
const asPlayer = new URLSearchParams(location.search).get("view") === "player";
const secret = () => JSON.parse(localStorage.getItem(SECRET) || "null");
const pick = { real: null, fakes: new Set() }; // ทิศที่ผู้โจมตีเลือก (ตอนเริ่มโจมตี)
const defend = { id: null, dir: null }; // ทิศที่ผู้ป้องกันเลือก — ส่งเข้า state พร้อมการทอยป้องกัน
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
  // ไม่มีการโจมตี → ทั้ง DM และผู้เล่นเห็นแผงเริ่มการโจมตี (ผู้เล่นโจมตีได้เฉพาะ DM)
  redraw = () => (!asPlayer && !state ? drawStart(me, role) : drawPlayer(state, me, role));
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
  const mine = s.targetId === me, gm = role === "GM", isAtk = s.attackerId === me;

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
  const aPh = s.reveal ? ph(ad, ROLL + BEAT) : null; // เต๋าผู้โจมตีกลิ้งหลังเต๋าป้องกันหยุด
  const revealOn = !!s.reveal && after(ad, 2 * ROLL + 2 * BEAT); // เฉลยทิศหลังเต๋าผู้โจมตีหยุด

  // ช่วงที่ผู้ป้องกันต้องเลือกทิศ: รู้ผล WIS แล้ว แต่ยังไม่ได้ทอยป้องกัน
  const choosing = mine && hintOn && !s.defense;

  const sec = secret(), st = {};
  if (sec?.id === s.id) { sec.fakes.forEach((d) => (st[d] = "fake")); st[sec.real] = "real"; } // ผู้โจมตี (เครื่องที่ถือความลับ) เห็นความจริงเสมอ
  else {
    if (hintOn && s.hint.kind === "glow") s.hint.dirs.forEach((d) => (st[d] = "glow"));
    if (hintOn && s.hint.kind === "clear") st[s.hint.dirs[0]] = "real";
    if (revealOn) { s.reveal.fakes.forEach((d) => (st[d] = "fake")); st[s.reveal.real] = "real"; }
  }

  // ทิศป้องกันที่เลือก: ถ้าทอยแล้วใช้ค่าใน state, ถ้ายังอยู่ระหว่างเลือกใช้ค่าในเครื่อง
  const chosen = s.choice ?? (choosing && defend.id === s.id ? defend.dir : null);
  if (chosen != null) st[chosen] = ((st[chosen] || "") + " pick").trim();

  let h = `<h2>⚔️ ${esc(s.attacker)} → ${esc(s.targetName)}</h2>` + compass(st, choosing);
  let ask = null;

  if (!s.perception) {
    if (mine) ask = "WIS"; else h += `<p class="muted">รอ ${esc(s.targetName)} ทอย WIS…</p>`;
  } else {
    h += rollHTML("WIS", s.perception, pPh);
    if (pPh === "land" || pPh === "done") h += hintOn ? `<p class="hint">${HINT[s.hint.kind]}</p>` : beat("กำลังรับรู้");
  }

  if (hintOn && !s.defense) {
    if (mine) {
      ask = s.defStat;
      h += `<p class="muted">🛡️ เลือกทิศที่จะป้องกัน (คลิกลูกศร) ก่อนทอย ${s.defStat}</p>`;
    } else h += `<p class="muted">รอ ${esc(s.targetName)} เลือกทิศป้องกันและทอย ${s.defStat}…</p>`;
  }
  if (s.defense) {
    if (s.choice != null) h += `<p class="muted">🛡️ ป้องกันทิศ: <b>${NAMES[s.choice]}</b></p>`;
    h += rollHTML(s.defStat, s.defense, dPh);
    if (!s.reveal) h += `<p class="muted">รอ ${esc(s.attacker)}…</p>`;
    else if (aPh === "wait") { if (dPh !== "roll") h += beat(`${esc(s.attacker)} กำลังทอย`); }
    else h += rollHTML("โจมตี", s.reveal.atk, aPh);
  }
  if (revealOn) {
    h += `<p>ทิศจริง: <b class="r">${NAMES[s.reveal.real]}</b> · ทิศหลอก: <b class="y">${s.reveal.fakes.map((d) => NAMES[d]).join(", ") || "-"}</b></p>`;
    if (s.choice != null) {
      h += s.choice === s.reveal.real
        ? `<p class="g">🛡️ ป้องกันถูกทิศ!</p>`
        : s.reveal.fakes.includes(s.choice)
          ? `<p class="r">💥 ติดกับ — ป้องกันไปทิศหลอก</p>`
          : `<p class="r">💥 ป้องกันผิดทิศ</p>`;
    }
  }

  if (ask) h += `<label>${ask} modifier <input id="mod" type="number" value="0"></label><button id="go" ${choosing && chosen == null ? "disabled" : ""}>ทอย ${ask}</button>`;
  if (gm || isAtk) h += `<button id="clear">จบการโจมตี</button>`;
  h += `<button id="close" class="ghost">ปิดหน้าต่าง</button>`;
  app.innerHTML = h;

  app.querySelector("#close").onclick = () => { OBR.popover.close("dw-attack"); OBR.action.close(); };
  const clr = app.querySelector("#clear");
  if (clr) clr.onclick = () => { localStorage.removeItem(SECRET); setState(null); };

  if (choosing) {
    // เลือกทิศแบบไม่วาดหน้าใหม่ — กันค่า modifier ที่พิมพ์ไว้ถูกรีเซ็ต
    const cp = app.querySelector(".compass");
    cp.onclick = (e) => {
      const b = e.target.closest("[data-dir]");
      if (!b) return;
      defend.id = s.id; defend.dir = +b.dataset.dir;
      cp.querySelectorAll(".dir").forEach((x) => x.classList.toggle("pick", x === b));
      app.querySelector("#go").disabled = false;
    };
  }

  app.querySelector("#go")?.addEventListener("click", async () => {
    const cur = await getState();
    if (!cur || cur.id !== s.id) return;
    if (cur.perception && cur.hint && !cur.defense && (defend.id !== cur.id || defend.dir === null)) return; // ต้องเลือกทิศป้องกันก่อน
    const r = roll2d6(+app.querySelector("#mod").value || 0);
    if (!cur.perception) cur.perception = r;
    else if (cur.hint && !cur.defense) { cur.choice = defend.dir; cur.defense = r; }
    else return;
    await setState(cur);
  });

  if (waits.length) timer = setTimeout(redraw, Math.min(...waits) + 30);
  if (app.querySelector(".tumble")) {
    tick = setInterval(() => app.querySelectorAll(".tumble").forEach((e) => (e.textContent = 1 + Math.floor(Math.random() * 6))), 70);
  }
  booted = true;
}

/* ---------------- แผงเริ่มการโจมตี (DM โจมตีผู้เล่น / ผู้เล่นโจมตี DM) ---------------- */
const cycle = (d) => {
  if (pick.real === d) { pick.real = null; pick.fakes.add(d); } // จริง → หลอก
  else if (pick.fakes.has(d)) pick.fakes.delete(d); // หลอก → ว่าง
  else pick.real = d; // ว่าง → จริง
};

async function drawStart(me, role) {
  const gm = role === "GM";
  const myName = await OBR.player.getName();
  const party = await OBR.party.getPlayers();
  const targets = gm
    ? [{ id: me, name: myName + " (GM)" }, ...party.filter((p) => p.role !== "GM")]
    : party.filter((p) => p.role === "GM").map((p) => ({ id: p.id, name: p.name + " (DM)" })); // ผู้เล่นโจมตีได้เฉพาะ DM

  if (!targets.length) {
    app.innerHTML = `<h2>โจมตี DM</h2><p class="muted">ยังไม่พบ DM ในห้อง</p>`;
    return;
  }

  app.innerHTML = `
    <h2>${gm ? "เริ่มการโจมตี" : "โจมตี DM"}</h2>
    <label>${gm ? "มอนสเตอร์" : "ผู้โจมตี"} <input id="mon" value="${esc(gm ? "มอนสเตอร์" : myName)}"></label>
    <label>เป้าหมาย <select id="tgt">${targets.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <label>ป้องกันด้วย <select id="def"><option>STR</option><option>DEX</option></select></label>
    <label>${gm ? "DM attack" : "Attack"} modifier <input id="amod" type="number" value="0"></label>
    <p class="muted">คลิกลูกศร: ครั้งที่ 1 = <b class="r">ทิศจริง</b> · 2 = <b class="y">ทิศหลอก</b> · 3 = ยกเลิก</p>
    <p class="muted">ฝ่ายป้องกันต้องเลือกทิศที่จะป้องกันก่อนทอย</p>
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
    const t = targets.find((p) => p.id === app.querySelector("#tgt").value);
    const id = Date.now().toString(36);
    // ความลับเก็บในเครื่องของ "ผู้โจมตี" — เครื่องนี้จะเป็นกรรมการของการโจมตีครั้งนี้
    localStorage.setItem(SECRET, JSON.stringify({
      id, real: pick.real, fakes: [...pick.fakes], atk: roll2d6(+app.querySelector("#amod").value || 0),
    }));
    await setState({
      id, attacker: app.querySelector("#mon").value || (gm ? "มอนสเตอร์" : myName), attackerId: me,
      targetId: t.id, targetName: t.name, defStat: app.querySelector("#def").value,
    });
    pick.real = null; pick.fakes.clear();
    OBR.action.close(); // ปิดแผงเพื่อให้เห็นหน้าต่างโจมตีที่เด้งขึ้น
  };
}
