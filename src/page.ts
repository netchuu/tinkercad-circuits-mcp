// Functions that run inside the Tinkercad Circuits editor page (via page.evaluate).
//
// Tinkercad keeps the whole circuit in a JavaScript model (window.circuit_editor.data).
// Changes made between root.rec() and root.stopRec() are recorded, synced to the
// server and become part of the saved design, exactly like edits made with the mouse.
//
// Each function is serialised on its own, so it must not use anything from this module.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const circuit_editor: any;
declare const Circuits: any;

export interface BuildArgs {
  arduino: boolean;
  parts: { ref: string; did: number; at?: string; pin?: string; angle?: number; free?: { x: number; y: number }; props: [string, string | number, string | undefined][] }[];
  wires: { from: string; to: string; color?: string }[];
}

export interface BuildResult {
  placed: Record<string, { angle: number; holes: Record<string, string | null> }>;
  errors: string[];
}

export function pageBuild(args: BuildArgs): BuildResult {
  const BBX = 870, BBY = 0;              // breadboard origin in editor units (10 units = one hole)
  const UNO_X = 544.785, UNO_Y = -43.818; // where Tinkercad drops the Uno in a new circuit
  const ROW_Y: Record<string, number> = { j: -55, i: -45, h: -35, g: -25, f: -15, e: 15, d: 25, c: 35, b: 45, a: 55 };
  const RAIL_Y: Record<string, number> = { "T-": -95, "T+": -85, "B-": 85, "B+": 95 };
  const WIRE_COLORS = ["blue", "green", "orange", "yellow", "purple", "turquoise", "pink", "brown"];

  const d = circuit_editor.data, root = circuit_editor.root;
  const out: BuildResult = { placed: {}, errors: [] };
  const devices = (): any[] => [...d.devices.values()];

  root.rec();
  try {
    let uno = devices().find((x) => x.name2terminal.get("D13"));
    if (args.arduino && !uno) {
      uno = d.createDeviceInstance(132521);
      const C0 = uno.breadboard().pos().constructor;
      uno.breadboard().setPos(new C0(UNO_X, UNO_Y));
    }
    if (!args.arduino && uno) { uno.remove(); uno = undefined; }

    // the board was emptied by pageClear() in a separate edit (see editor.ts)
    const bb = d.createDeviceInstance(111211);
    const C = bb.breadboard().pos().constructor;
    bb.breadboard().setPos(new C(BBX, BBY));
    const holes: any[] = bb.terminals.values();

    const colX = (col: number) => BBX - 145 + 10 * (col - 1);
    const holePos = (name: string): [number, number] => {
      let m = /^(\d+)([a-j])$/.exec(name);
      if (m) return [colX(+m[1]), BBY + ROW_Y[m[2]]];
      m = /^([TB][+-])(\d*)$/.exec(name);
      if (m) return [colX(m[2] ? +m[2] : 1), BBY + RAIL_Y[m[1]]];
      throw new Error(`not a hole: ${name}`);
    };
    const holeName = (x: number, y: number): string | null => {
      const col = Math.round((x - (BBX - 145)) / 10) + 1;
      const dy = y - BBY;
      for (const [k, v] of Object.entries(ROW_Y)) if (Math.abs(v - dy) < 0.5) return `${col}${k}`;
      for (const [k, v] of Object.entries(RAIL_Y)) if (Math.abs(v - dy) < 0.5) return `${k}${col}`;
      return null;
    };
    const holeAt = (x: number, y: number) => holes.find((t) => { const p = t.getBreadboardPos(); return Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1; });
    // a part's leg sitting in a hole is a zero-length "insert" wire in Tinkercad's model
    const addWire = (a: any, b: any, insert: boolean) => {
      const w = new Circuits.BendableWireData(d.root, a, b, insert ? { insert: true } : {});
      d.wires.add(w);
      return w;
    };

    const byRef: Record<string, { dev: any; pins: Record<string, any> }> = {};
    for (const p of args.parts) {
      const dev = d.createDeviceInstance(p.did);
      try { dev.setName(p.ref); } catch (e) { out.errors.push(`${p.ref}: could not set the part name (${e})`); }
      if (String(dev.name()) !== p.ref) out.errors.push(`${p.ref}: Tinkercad kept the name "${dev.name()}"`);
      for (const [name, value, prefix] of p.props) {
        try { dev.setProperty(name, null, value, prefix); } catch (e) { out.errors.push(`${p.ref}: property ${name}: ${e}`); }
      }
      const view = dev.breadboard();
      const pins: Record<string, any> = {};
      for (const k of dev.name2terminal.keys()) pins[k] = dev.name2terminal.get(k);
      byRef[p.ref] = { dev, pins };

      if (p.free) {
        view.setAngle(p.angle ?? 0);
        view.setPos(new C(p.free.x, p.free.y));
        out.placed[p.ref] = { angle: p.angle ?? 0, holes: {} };
        continue;
      }

      // try each rotation until every leg lands in a hole
      const [ax, ay] = holePos(p.at!);
      let done = false;
      for (const angle of p.angle !== undefined ? [p.angle] : [0, 90, 180, 270]) {
        view.setAngle(angle);
        view.setPos(new C(0, 0));
        const rel: Record<string, [number, number]> = {};
        for (const k of Object.keys(pins)) { const q = pins[k].getBreadboardPos(); rel[k] = [q.x, q.y]; }
        const px = ax - rel[p.pin!][0], py = ay - rel[p.pin!][1];
        const legs: Record<string, any> = {};
        let fits = true;
        for (const k of Object.keys(rel)) {
          const hole = holeAt(rel[k][0] + px, rel[k][1] + py);
          if (!hole) { fits = false; break; }
          legs[k] = hole;
        }
        if (!fits) continue;
        view.setPos(new C(px, py));
        const names: Record<string, string | null> = {};
        for (const k of Object.keys(legs)) {
          addWire(pins[k], legs[k], true);
          const q = legs[k].getBreadboardPos();
          names[k] = holeName(q.x, q.y);
        }
        out.placed[p.ref] = { angle, holes: names };
        done = true;
        break;
      }
      if (!done) out.errors.push(`${p.ref}: no rotation puts every leg in a hole when pin ${p.pin} is at ${p.at}`);
    }

    // resolve "uno.D13", "12e", "T-5", "led1.anode"; part pins resolve to the hole under them
    const terminal = (end: string): any => {
      let m = /^uno\.(\w+)$/.exec(end);
      if (m) {
        if (!uno) throw new Error(`no Arduino for ${end}`);
        const t = uno.name2terminal.get(m[1]);
        if (!t) throw new Error(`Uno has no pin ${m[1]}`);
        return t;
      }
      m = /^([A-Za-z_]\w*)\.(.+)$/.exec(end);
      if (m) {
        const part = byRef[m[1]];
        if (!part) throw new Error(`no part ${m[1]}`);
        const pin = part.pins[m[2]];
        if (!pin) throw new Error(`${m[1]} has no pin ${m[2]}`);
        if (out.placed[m[1]] && Object.keys(out.placed[m[1]].holes).length) {
          const q = pin.getBreadboardPos();
          return holeAt(q.x, q.y) ?? pin;
        }
        return pin;
      }
      const [x, y] = holePos(end);
      const t = holeAt(x, y);
      if (!t) throw new Error(`no hole ${end}`);
      return t;
    };

    // wires that leave the Uno are routed at right angles around the breadboard
    const unoTerms = new Set(uno ? uno.terminals.values() : []);
    const xy = (t: any): [number, number] => { const p = t.getBreadboardPos(); return [p.x, p.y]; };
    let top = 0, bottom = 0, left = 0, right = 0, next = 0;
    for (const w of args.wires) {
      try {
        const a = terminal(w.from), b = terminal(w.to);
        const wire = addWire(a, b, false);
        const ends = `${w.from} ${w.to}`;
        const ground = /(^|[ .])GND\d?( |$)/.test(ends) || /(^| )[TB]-\d*( |$)/.test(ends);
        const power = /\.(5V|3V3|VIN)( |$)/.test(ends) || /(^| )[TB]\+\d*( |$)/.test(ends);
        wire.color(w.color ?? (ground ? "black" : power ? "red" : WIRE_COLORS[next++ % WIRE_COLORS.length]));

        const aUno = unoTerms.has(a), bUno = unoTerms.has(b);
        if (aUno === bUno) continue;
        const [sx, sy] = xy(aUno ? a : b), [ex, ey] = xy(aUno ? b : a);
        const laneTop = -185 - 5 * top, laneBottom = 125 + 5 * bottom;
        const fromTopHeader = sy < 0, toTopHalf = ey < BBY;
        let pts: [number, number][];
        if (fromTopHeader && toTopHalf) { pts = [[sx, laneTop], [ex, laneTop]]; top++; }
        else if (fromTopHeader) { const rx = BBX + 172 + 5 * right++; pts = [[sx, laneTop], [rx, laneTop], [rx, laneBottom], [ex, laneBottom]]; top++; bottom++; }
        else if (!toTopHalf) { pts = [[sx, laneBottom], [ex, laneBottom]]; bottom++; }
        else { const lx = BBX - 172 - 5 * left++; pts = [[sx, laneBottom], [lx, laneBottom], [lx, laneTop], [ex, laneTop]]; top++; bottom++; }
        if (!aUno) pts.reverse();
        pts.forEach((q, i) => wire.addPoint(new C(q[0], q[1]), i + 1));
      } catch (e: any) {
        out.errors.push(`wire ${w.from} -> ${w.to}: ${e?.message ?? e}`);
      }
    }
  } finally {
    root.stopRec();
  }
  return out;
}

/**
 * Removes every wire and every part except the Arduino. Runs as its own recorded
 * edit so the old part names are released before the new parts claim them.
 */
export function pageClear(): number {
  const d = circuit_editor.data, root = circuit_editor.root;
  let removed = 0;
  root.rec();
  try {
    [...d.wires.values()].forEach((w: any) => { try { w.remove(); } catch { /* already gone */ } });
    [...d.devices.values()].forEach((x: any) => { if (!x.name2terminal.get("D13")) { x.remove(); removed++; } });
  } finally {
    root.stopRec();
  }
  return removed;
}

/** Writes the Arduino sketch. Runs as its own recorded edit, separate from the build. */
export function pageSetCode(code: string): boolean {
  const d = circuit_editor.data, root = circuit_editor.root;
  const uno = [...d.devices.values()].find((x: any) => x.name2terminal.get("D13"));
  if (!uno) throw new Error("this circuit has no Arduino");
  root.rec();
  try {
    const id = uno.getCodeId();
    const prop = JSON.parse(JSON.stringify(uno.properties.get(id)));
    prop.value = code;
    uno.properties.put(id, prop); // replacing the entry (not mutating it) is what gets saved
  } finally {
    root.stopRec();
  }
  return uno.getCode() === code;
}

export interface ReadResult {
  arduino: boolean;
  code: string | null;
  parts: { ref: string; did: number; holes: Record<string, string | null>; props: Record<string, unknown> }[];
  wires: { from: string; to: string; color: string }[];
}

export function pageRead(): ReadResult {
  const ROW_Y: Record<string, number> = { j: -55, i: -45, h: -35, g: -25, f: -15, e: 15, d: 25, c: 35, b: 45, a: 55 };
  const RAIL_Y: Record<string, number> = { "T-": -95, "T+": -85, "B-": 85, "B+": 95 };
  const d = circuit_editor.data;
  const devs: any[] = [...d.devices.values()];
  const uno = devs.find((x) => x.name2terminal.get("D13"));
  const bb = devs.find((x) => String(x.did()) === "111211");
  const origin = bb ? bb.breadboard().getPos() : null;

  const holeName = (t: any): string | null => {
    if (!origin) return null;
    const p = t.getBreadboardPos();
    const col = Math.round((p.x - (origin.x - 145)) / 10) + 1;
    const dy = p.y - origin.y;
    for (const [k, v] of Object.entries(ROW_Y)) if (Math.abs(v - dy) < 0.5) return `${col}${k}`;
    for (const [k, v] of Object.entries(RAIL_Y)) if (Math.abs(v - dy) < 0.5) return `${k}${col}`;
    return null;
  };
  const pinName = (dev: any, t: any): string => {
    for (const k of dev.name2terminal.keys()) if (dev.name2terminal.get(k) === t) return k;
    return "?";
  };
  const owner = new Map<any, any>();
  devs.forEach((dev) => dev.terminals.values().forEach((t: any) => owner.set(t, dev)));
  const label = (t: any): string => {
    const dev = owner.get(t);
    if (!dev) return "?";
    if (dev === uno) return `uno.${pinName(dev, t)}`;
    if (dev === bb) return holeName(t) ?? "?";
    return `${dev.name()}.${pinName(dev, t)}`;
  };

  const parts = devs.filter((x) => x !== uno && x !== bb).map((dev) => {
    const holes: Record<string, string | null> = {};
    for (const k of dev.name2terminal.keys()) holes[k] = holeName(dev.name2terminal.get(k));
    const props: Record<string, unknown> = {};
    for (const p of Object.values(dev.jsonify().properties ?? {}) as any[]) {
      if (p.unit !== "code") props[p.name] = p.prefix ? `${p.value}${p.prefix}` : p.value;
    }
    return { ref: String(dev.name()), did: Number(dev.did()), holes, props };
  });

  const wires = [...d.wires.values()].filter((w: any) => !w.insert()).map((w: any) => ({
    from: label(w.begin()), to: label(w.end()), color: String(w.color()),
  }));

  let code: string | null = null;
  if (uno) code = String(uno.getCode()).replace(/\/\/BLOCK_CODE_XML:[\s\S]*$/, "");
  return { arduino: !!uno, code, parts, wires };
}

/** Changes properties on one named part, e.g. a knob position or a sensor distance. */
export function pageSetProps(arg: { ref: string; props: [string, string | number, string | undefined][] }): boolean {
  const d = circuit_editor.data, root = circuit_editor.root;
  const dev = [...d.devices.values()].find((x: any) => String(x.name()) === arg.ref);
  if (!dev) return false;
  root.rec();
  try {
    for (const [name, value, prefix] of arg.props) dev.setProperty(name, null, value, prefix);
  } finally {
    root.stopRec();
  }
  return true;
}

/** Screen boxes (CSS pixels) for the named parts, plus the breadboard view ids. */
export function pageLocate(refs: string[]): Record<string, { x: number; y: number; w: number; h: number; id: string } | null> {
  const svg = document.querySelector("#breadboardTab svg");
  const devs: any[] = [...circuit_editor.data.devices.values()];
  const out: Record<string, { x: number; y: number; w: number; h: number; id: string } | null> = {};
  for (const ref of refs) {
    const dev = devs.find((x) => String(x.name()) === ref);
    if (!dev || !svg) { out[ref] = null; continue; }
    const id = dev.breadboard().versions_id;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    svg.querySelectorAll(`[id*="${id}"]`).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    });
    out[ref] = Number.isFinite(x0) ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0, id } : null;
  }
  return out;
}

/** Raw servo horn rotation for each view id (Tinkercad draws it as rotate(-r)). */
export function pageServoRotation(ids: string[]): (number | null)[] {
  const svg = document.querySelector("#breadboardTab svg");
  return ids.map((id) => {
    if (!svg) return null;
    for (const el of Array.from(svg.querySelectorAll(`[id*="${id}"]`))) {
      const horn = el.querySelector(".cgfx__servohorn");
      const m = horn && /rotate\((-?[\d.]+)/.exec(horn.getAttribute("transform") ?? "");
      if (m) return -parseFloat(m[1]);
    }
    return null;
  });
}

/** Average of the brightest colour channel in a 4x4 patch at each point of a screenshot. */
export async function pageSamplePixels(arg: { png: string; points: { x: number; y: number }[] }): Promise<number[]> {
  const img = new Image();
  img.src = `data:image/png;base64,${arg.png}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const scale = img.width / innerWidth;
  return arg.points.map((p) => {
    const px = ctx.getImageData(Math.round(p.x * scale) - 2, Math.round(p.y * scale) - 2, 4, 4).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += Math.max(px[i], px[i + 1], px[i + 2]);
    return sum / (px.length / 4);
  });
}

export function pageSimClock(): string | null {
  const m = /Simulator time: ([\d:]+)/.exec(document.body.innerText);
  return m ? m[1] : null;
}

export function pageSerialText(): string {
  const el = document.querySelector(".js-code_panel__serial__text") as HTMLElement | null;
  return el?.innerText ?? "";
}

/** Edits not yet acknowledged by Tinkercad's server (0 = everything is saved). */
export function pagePendingSaves(): number {
  const doc = circuit_editor?.root?.shareJsDoc;
  return doc && typeof doc.numberPending === "function" ? Number(doc.numberPending()) : 0;
}

export function pageEditorReady(): boolean {
  const w = window as any;
  return !!(w.circuit_editor && w.circuit_editor.circuitEditor && w.circuit_editor.data);
}
