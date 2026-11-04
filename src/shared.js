import OBR from "@owlbear-rodeo/sdk";

export const KEY = "com.dw-directional/state"; // ข้อมูลสาธารณะ (ผู้เล่นเห็นได้)
export const SECRET = "dw-directional-secret"; // ความลับของ DM (เก็บในเครื่อง DM เท่านั้น)

// ทิศ 0..7 วนตามเข็มนาฬิกาเริ่มจากบน
export const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
export const NAMES = ["บน", "บนขวา", "ขวา", "ล่างขวา", "ล่าง", "ล่างซ้าย", "ซ้าย", "บนซ้าย"];
const CELL = [[1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [1, 1]];

export const TIER_TH = { strong: "10+ สำเร็จเต็มที่", weak: "7-9 สำเร็จบางส่วน", miss: "6- พลาด" };
export const tier = (t) => (t >= 10 ? "strong" : t >= 7 ? "weak" : "miss");

export const roll2d6 = (mod = 0) => {
  const dice = [0, 0].map(() => 1 + Math.floor(Math.random() * 6));
  return { dice, mod, total: dice[0] + dice[1] + mod };
};
export const rollText = (r) =>
  `🎲 ${r.dice.join("+")} ${r.mod < 0 ? "−" : "+"} ${Math.abs(r.mod)} = <b>${r.total}</b> (${TIER_TH[tier(r.total)]})`;

export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const getState = async () => (await OBR.room.getMetadata())[KEY] || null;
export const setState = (s) => OBR.room.setMetadata({ [KEY]: s });

// st: { ทิศ: "real" | "fake" | "glow" }  — glow จะกะพริบด้วยจังหวะสุ่ม แยกจริง/หลอกไม่ออก
export function compass(st = {}, clickable = false) {
  const cells = ARROWS.map(
    (a, i) =>
      `<button class="dir ${st[i] || ""}" data-dir="${i}" ${clickable ? "" : "disabled"} title="${NAMES[i]}"
        style="grid-area:${CELL[i][0]}/${CELL[i][1]};--d:-${(Math.random() * 2).toFixed(2)}s;--s:${(0.35 + Math.random() * 0.9).toFixed(2)}s">${a}</button>`
  ).join("");
  return `<div class="compass">${cells}<div class="me">🧍</div></div>`;
}
