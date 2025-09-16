// graph.js — устойчивый график + две накладки: Guide (оранжевая) и Live (зелёная)

(function () {
  const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

  function midiToNote(m) {
    const mm = Math.round(m);
    const name = NOTE_NAMES[((mm % 12) + 12) % 12];
    const oct = Math.floor(mm / 12) - 1;
    return name + oct;
  }
  function noteNameToMidi(name) {
    if (typeof name === "number") return (Number.isFinite(name) ? name|0 : 57);
    const s = String(name || "").trim().replace("♯","#").replace("♭","b");
    const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(s);
    if (!m) return 57;
    let nn = m[1].toUpperCase() + (m[2] || "");
    const flats = { "Cb":"B","Db":"C#","Eb":"D#","Fb":"E","Gb":"F#","Ab":"G#","Bb":"A#" };
    if (nn.endsWith("b")) nn = flats[nn] || nn;
    const idx = NOTE_NAMES.indexOf(nn);
    if (idx < 0) return 57;
    return idx + (parseInt(m[3],10)+1)*12;
  }

  // freq -> midi & cents
  function freqToMidi(f) {
    if (!Number.isFinite(f) || f <= 0) return null;
    const m = 69 + 12 * Math.log2(f / 440);
    const mRound = Math.round(m);
    const cents = Math.round((m - mRound) * 100);
    return { midi: m, midiRound: mRound, cents };
  }

  const VPT = (window.VPT = window.VPT || {});
  VPT.NOTE_NAMES = NOTE_NAMES;
  VPT.noteNameToMidi = noteNameToMidi;
  VPT.noteToMidiSafe = noteNameToMidi;
  VPT.midiToNote = midiToNote;

  const els = {
    svg: document.getElementById("svg"),
    noteList: document.getElementById("noteList"),
  };

  // оформление
  const GUTTER = 64;
  const MIN_CONTENT_W = 600;
  const HEIGHT = 260;
  const GRID = "#334155";
  const PATH = "#38bdf8";

  // состояние последней полной отрисовки графика (нужно, чтобы быстро рисовать оверлеи)
  let scale = {
    minMidi: null, maxMidi: null, width: 0, height: HEIGHT, gutter: GUTTER,
  };
  let lastMidis = [];
  let lastBeats = [];

  // состояния оверлеев
  let guideMidi = null;         // фиксированная «целевая» линия (оранжевая)
  let liveHz = null;            // текущая частота (из питч-тракера)
  let liveMidiCache = null;     // кеш перерасчета частоты

  VPT.setGuideNote = function (note) {
    guideMidi = (note == null || note === "")
      ? null
      : (typeof note === "number" ? note : noteNameToMidi(note));
    paintOverlays(); // перерисуем только оверлеи
  };

  // Подавай сюда частоту (Гц) — зелёная линия появится/обновится
  VPT.setLivePitch = function (hzOrNull) {
    liveHz = (Number.isFinite(hzOrNull) && hzOrNull > 0) ? hzOrNull : null;
    paintOverlays(); // только оверлеи
  };

  // Главный рендер графика
  VPT.drawGraph = function drawGraph(midiSeq, beatDurations, opts = {}) {
    const svg = els.svg;
    if (!svg) return;

    // запомним «последний график»
    lastMidis = Array.isArray(midiSeq) ? midiSeq.filter(Number.isFinite) : [];
    lastBeats = (Array.isArray(beatDurations) && beatDurations.length === lastMidis.length)
      ? beatDurations.map(b => (Number.isFinite(b) ? Math.max(0.0001,b) : 0.5))
      : lastMidis.map(() => 0.5);

    const pxPerBeat = Number.isFinite(opts.pxPerBeat) ? opts.pxPerBeat : 80;
    const totalBeats = lastBeats.reduce((a,b)=>a+b, 0) || 4;
    const contentW = Math.max(MIN_CONTENT_W, Math.ceil(totalBeats * pxPerBeat));
    const width = GUTTER + contentW;

    svg.setAttribute("width", String(width));
    svg.setAttribute("viewBox", `0 0 ${width} ${HEIGHT}`);
    svg.innerHTML = "";

    // если данных нет — только фон
    if (!lastMidis.length) {
      baseBg(svg, width);
      scale = { minMidi: 57, maxMidi: 69, width, height: HEIGHT, gutter: GUTTER };
      paintOverlays();
      return;
    }

    // диапазон по Y — учитываем guide/live (чтобы всегда были видны)
    const yPool = lastMidis.slice();
    if (Number.isFinite(guideMidi)) yPool.push(guideMidi);
    if (Number.isFinite(liveHz)) {
      const fm = freqToMidi(liveHz);
      if (fm) yPool.push(fm.midi);
    }
    const minMidi = Math.min(...yPool);
    const maxMidi = Math.max(...yPool);

    baseBg(svg, width);

    // горизонтальные линии и подписи
    const uniq = [...new Set(yPool.map(v => Math.round(v)))].sort((a,b)=>b-a);
    const yForMidi = makeY(minMidi, maxMidi);
    for (const m of uniq) {
      const y = yForMidi(m);
      line(svg, GUTTER, width, y, y, GRID, "4 6"); // grid
      text(svg, GUTTER-10, y+4, "#94a3b8", 11, "end", midiToNote(m));
    }

    // кривая паттерна
    let x = GUTTER;
    let d = `M${x},${yForMidi(lastMidis[0])}`;
    for (let i = 0; i < lastMidis.length; i++) {
      const w = lastBeats[i] * pxPerBeat;
      const y = yForMidi(lastMidis[i]);
      d += ` L${(x + w).toFixed(2)},${y.toFixed(2)}`;
      x += w;
      if (i < lastMidis.length - 1) {
        const yNext = yForMidi(lastMidis[i+1]);
        d += ` L${x.toFixed(2)},${yNext.toFixed(2)}`;
      }
    }
    path(svg, d, PATH, 3);

    // сохранить масштаб для оверлеев
    scale = { minMidi, maxMidi, width, height: HEIGHT, gutter: GUTTER };

    // оверлеи
    paintOverlays();
    // список нот (если нужен)
    if (els.noteList) els.noteList.textContent = lastMidis.map(m => midiToNote(m)).join(" · ");
  };

  // ---------- внутренние утилиты рендера ----------
  function baseBg(svg, width) {
    rect(svg, 0,0, width, HEIGHT, "#0f172a");
    line(svg, GUTTER, GUTTER, 0, HEIGHT, GRID);
  }
  function makeY(minMidi, maxMidi) {
    const pad = 10;
    const usable = HEIGHT - pad*2;
    const denom = Math.max(1, (maxMidi - minMidi));
    return (m) => {
      const norm = (m - minMidi) / denom;
      return HEIGHT - (norm * usable + pad);
    };
  }
  function rect(svg, x,y,w,h, fill) {
    const el = document.createElementNS("http://www.w3.org/2000/svg","rect");
    el.setAttribute("x",x); el.setAttribute("y",y);
    el.setAttribute("width",w); el.setAttribute("height",h);
    el.setAttribute("fill", fill); svg.appendChild(el);
  }
  function line(svg, x1,x2,y1,y2, stroke, dash) {
    const el = document.createElementNS("http://www.w3.org/2000/svg","line");
    el.setAttribute("x1",x1); el.setAttribute("x2",x2);
    el.setAttribute("y1",y1); el.setAttribute("y2",y2);
    el.setAttribute("stroke", stroke);
    if (dash) el.setAttribute("stroke-dasharray", dash);
    svg.appendChild(el);
  }
  function text(svg, x,y, fill, fs, anchor, content) {
    const el = document.createElementNS("http://www.w3.org/2000/svg","text");
    el.setAttribute("x", x); el.setAttribute("y", y);
    el.setAttribute("fill", fill); el.setAttribute("font-size", String(fs));
    el.setAttribute("text-anchor", anchor);
    el.textContent = content;
    svg.appendChild(el);
  }
  function path(svg, d, stroke, sw) {
    const el = document.createElementNS("http://www.w3.org/2000/svg","path");
    el.setAttribute("d", d.trim());
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", String(sw));
    svg.appendChild(el);
  }

  // ---------- оверлеи (рисуем поверх без очистки основного графика) ----------
  function paintOverlays() {
    const svg = els.svg;
    if (!svg || scale.minMidi == null) return;

    // удалить старый слой
    const old = svg.querySelector("#vpt-overlays");
    if (old) old.remove();

    const yFor = makeY(scale.minMidi, scale.maxMidi);
    const layer = document.createElementNS("http://www.w3.org/2000/svg","g");
    layer.setAttribute("id","vpt-overlays");

    // Guide (оранжевая)
    if (Number.isFinite(guideMidi)) {
      const yG = yFor(guideMidi);
      line(layer, scale.gutter, scale.width, yG, yG, "#f59e0b", "6 6");
      text(layer, scale.gutter - 10, yG - 6, "#f59e0b", 11, "end", `Guide: ${midiToNote(guideMidi)}`);
    }

    // Live (зелёная) — из частоты
    if (Number.isFinite(liveHz)) {
      const fm = freqToMidi(liveHz);
      if (fm) {
        liveMidiCache = fm;
        const yL = yFor(fm.midi);
        line(layer, scale.gutter, scale.width, yL, yL, "#10b981", "3 3");
        const label = `Live: ${midiToNote(fm.midiRound)} (${fm.cents >= 0 ? "+" : ""}${fm.cents}¢)`;
        text(layer, scale.gutter - 10, yL - 6, "#10b981", 11, "end", label);
      }
    }

    svg.appendChild(layer);
  }
})();
