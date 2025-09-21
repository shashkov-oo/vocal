// app.js — список-треки, описание, график, нижний транспорт + примеры + дыхание + прелюдии
(function () {
  const els = {
    exerciseList: document.getElementById("exerciseList"),
    exerciseDesc: document.getElementById("exerciseDesc"),
    svg: document.getElementById("svg"),

    btnPrev: document.getElementById("btnPrev"),
    btnPlayStop: document.getElementById("btnPlayStop"),
    btnNext: document.getElementById("btnNext"),

    // settings modal
    btnSettings: document.getElementById("btnSettings"),
    settingsModal: document.getElementById("settingsModal"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),

    // controls (без глобального BPM)
    runMode: document.getElementById("runMode"),      // 'single' | 'range'
    startNote: document.getElementById("startNote"),
    lowerNote: document.getElementById("lowerNote"),
    upperNote: document.getElementById("upperNote"),
    noteDur: document.getElementById("noteDur"),
    breathMs: document.getElementById("breathMs"),
  };

  let currentIndex = 0;
  let isPlaying = false;

  // для перерисовки графика «мгновенно» при смещении guide
  let lastMidis = [];
  let lastBeats = [];

  // safety: заглушка для примеров (если audio.js ещё не подгрузился)
  window.VPT = window.VPT || {};
  if (!VPT.examples) {
    VPT.examples = {
      async play(id) { console.warn(`examples/${id}.mp3: плеер примеров ещё не подключён`); },
      stop() {},
      isPlaying() { return false; }
    };
  }

  // ---------- helpers ----------
  function fillNoteSelect(sel, def) {
    const items = [];
    for (let o = 2; o <= 6; o++) for (const n of VPT.NOTE_NAMES) items.push(`${n}${o}`);
    sel.innerHTML = "";
    for (const n of items) {
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    }
    sel.value = def;
  }

  function patternByIndex(i) {
    const list = VPT.PATTERNS || [];
    if (!list.length) return null;
    const idx = Math.max(0, Math.min(i, list.length - 1));
    return { obj: list[idx], idx };
  }

  function renderExerciseList() {
    els.exerciseList.innerHTML = "";
    (VPT.PATTERNS || []).forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "exercise-item";
      row.dataset.id = p.id;

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = String(p.id).slice(0, 2);

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = p.name;

      const example = document.createElement("button");
      example.className = "example";
      example.type = "button";
      example.textContent = "▶ пример";
      example.title = "Эталон (из папки examples)";

      example.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (VPT.examples.isPlaying(p.id)) {
          VPT.examples.stop();
          example.textContent = "▶ пример";
          return;
        }
        if (isPlaying) stop();
        VPT.examples.stop();
        [...els.exerciseList.querySelectorAll(".example")].forEach(btn => {
          if (btn !== example) btn.textContent = "▶ пример";
        });
        await VPT.examples.play(p.id);
        example.textContent = "⏹ пример";
      });

      row.appendChild(avatar);
      row.appendChild(title);
      row.appendChild(example);
      row.addEventListener("click", () => selectIndex(idx));
      els.exerciseList.appendChild(row);
    });
    highlightActive();
  }

  function highlightActive() {
    [...els.exerciseList.children].forEach((row, idx) => {
      row.classList.toggle("active", idx === currentIndex);
    });
  }

  async function loadDescription(id, fallback) {
    try {
      const resp = await fetch(`./examples/${id}.mp3.txt`, { cache: "no-store" });
      if (!resp.ok) throw new Error("no txt");
      const text = await resp.text();
      els.exerciseDesc.textContent = (text.trim() || fallback || "—");
    } catch {
      els.exerciseDesc.textContent = fallback || "—";
    }
  }

  function drawFromSteps(steps) {
    lastMidis = steps.map(s => s.midi);
    lastBeats = steps.map(s => s.beats);
    VPT.drawGraph(lastMidis, lastBeats);
  }

  function selectIndex(i) {
    // при переключении всегда стопаем всё
    if (isPlaying) stop();
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    const res = patternByIndex(i);
    if (!res) return;

    currentIndex = res.idx;
    highlightActive();

    loadDescription(res.obj.id, res.obj.desc);

    const root = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const steps = VPT.buildStepsForRoot(root, els.noteDur.value, res.obj);

    drawFromSteps(steps);
    // «оранжевая» линия — на первый шаг паттерна
    if (steps.length) {
      VPT.setGuideNote(steps[0].midi);
      VPT.drawGraph(lastMidis, lastBeats);
    }
  }

  function updatePreview() { selectIndex(currentIndex); }

  // ---- прелюдия: варианты входа перед блоком ----
  // mode: 'root_triad' | 'playSecond'
  function schedulePrelude(whenSec, rootMidi, rootSec, triadSec, mode='root_triad', velocity=0.8) {
    const s = VPT.audio.get();
    const N = (m)=>VPT.midiToNote(m);

    const playNote = (m, dur, t0)=> {
      Tone.Transport.schedule((t)=>{ try{ s.triggerAttackRelease(N(m), dur, t, velocity); }catch(_){} }, `+${t0}`);
      return t0 + dur;
    };
    const playChord = (m12, dur, t0)=> {
      const triad = [m12, m12+4, m12+7, , m12+12];
      Tone.Transport.schedule((t)=>{ try{ triad.forEach(n=>s.triggerAttackRelease(N(n), dur, t, velocity*0.95)); }catch(_){} }, `+${t0}`);
      return t0 + dur;
    };

    let t = whenSec;
    if (mode === 'playSecond') {
      // +19 → +12 → (12,16,19)
      t = playNote(rootMidi+7, rootSec, t);
      t = playNote(rootMidi+0, rootSec, t);
      t = playChord(rootMidi+0, triadSec, t);
    } else {
      // стартовая нота → трезвучие от корня
      t = playNote(rootMidi, rootSec, t);
      t = playChord(rootMidi, triadSec, t);
    }
    return t; // вернуть новое "when"
  }

  // ---------- транспорт ----------
  async function play() {
    const patObj = patternByIndex(currentIndex)?.obj;
    if (!patObj) return;

    // стопаем все чужие источники
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    els.btnPlayStop.textContent = "⏹";
    els.btnPlayStop.classList.add("stop");
    isPlaying = true;

    try {
      await VPT.audio.ensure();
      await Tone.start();
    } catch(e) { console.error("Audio load error", e); }

    // Темп берём из упражнения (fallback 90)
    Tone.Transport.bpm.value = parseInt(patObj.bpm || 90, 10);
    VPT.audio.stop();

    const mode       = els.runMode.value;          // 'single' | 'range'
    const defaultDur = els.noteDur.value;
    const startMidi  = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const lower      = VPT.noteToMidiSafe(els.lowerNote.value || "A2");
    const upper      = VPT.noteToMidiSafe(els.upperNote.value || "A4");
    const breathSec  = Math.max(0, (parseInt(els.breathMs.value || "800", 10) || 0) / 1000);

    // параметры прелюдии из упражнения
    const pre = patObj.prelude || {};
    const preludeEnabled = !!pre.enabled;
    const preludeMode    = pre.mode || 'root_triad';
    const preRootSec     = Math.max(0.1, ((pre.rootMs ?? 350) / 1000));
    const preTriadSec    = Math.max(0.1, ((pre.triadMs ?? 600) / 1000));

    if (mode === "single") {
      const steps = VPT.buildStepsForRoot(startMidi, defaultDur, patObj);
      drawFromSteps(steps);

      let when = 0;

      // прелюдия: перед началом
      if (preludeEnabled) {
        when = schedulePrelude(when, startMidi, preRootSec, preTriadSec, preludeMode);
      }

      for (const st of steps) {
        const dur = VPT.durToSeconds(st.durStr);

        // перед стартом шага двигаем guide и перерисовываем график
        Tone.Transport.schedule(() => {
          VPT.setGuideNote(st.midi);
          VPT.drawGraph(lastMidis, lastBeats);
        }, `+${when}`);

        Tone.Transport.schedule((t) => {
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);

        when += dur;
      }

      Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
      Tone.Transport.start();
      return;
    }

    // режим "диапазон": шаг в 1 полутон, с паузами на вдох между блоками
    const maxOff = VPT.patternMaxOffsetSemitones(patObj);
    const roots = [];
    for (let r = lower; r + maxOff <= upper; r += 1) roots.push(r);
    if (!roots.length) roots.push(Math.max(lower, upper - maxOff));

    let when = 0;
    for (let idx = 0; idx < roots.length; idx++) {
      const root = roots[idx];
      const steps = VPT.buildStepsForRoot(root, defaultDur, patObj);

      // прелюдия перед блоком
      if (preludeEnabled) {
        when = schedulePrelude(when, root, preRootSec, preTriadSec, preludeMode);
      }

      // перерисовываем график под новый блок
      Tone.Transport.schedule(() => { 
        drawFromSteps(steps);
        if (steps.length) {
          VPT.setGuideNote(steps[0].midi);
          VPT.drawGraph(lastMidis, lastBeats);
        }
      }, `+${when}`);

      for (const st of steps) {
        const dur = VPT.durToSeconds(st.durStr);

        // перед каждой нотой двигаем guide
        Tone.Transport.schedule(() => {
          VPT.setGuideNote(st.midi);
          VPT.drawGraph(lastMidis, lastBeats);
        }, `+${when}`);

        Tone.Transport.schedule((t) => {
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);

        when += dur;
      }

      // пауза на вдох (кроме последнего блока)
      if (breathSec > 0 && idx < roots.length - 1) {
        when += breathSec;
      }
    }

    Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
    Tone.Transport.start();
  }

  function stop() {
    VPT.audio.stop();
    els.btnPlayStop.textContent = "▶️";
    els.btnPlayStop.classList.remove("stop");
    isPlaying = false;
  }

  function next() {
    const total = (VPT.PATTERNS || []).length;
    if (!total) return;
    if (isPlaying) stop();
    VPT.examples.stop();
    selectIndex((currentIndex + 1) % total);
  }

  function prev() {
    const total = (VPT.PATTERNS || []).length;
    if (!total) return;
    if (isPlaying) stop();
    VPT.examples.stop();
    selectIndex((currentIndex - 1 + total) % total);
  }

  // ---------- init ----------
  fillNoteSelect(els.startNote, "A2");
  fillNoteSelect(els.lowerNote, "A2");
  fillNoteSelect(els.upperNote, "A4");
  renderExerciseList();
  selectIndex(0);

  els.btnPlayStop.addEventListener("click", () => (isPlaying ? stop() : play()));
  els.btnNext.addEventListener("click", next);
  els.btnPrev.addEventListener("click", prev);

  // модалка
  els.btnSettings.addEventListener("click", () => {
    els.settingsModal.classList.remove("hidden");
    els.settingsModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  });
  function closeSettingsModal(){
    els.settingsModal.classList.add("hidden");
    els.settingsModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (!isPlaying) updatePreview();
  }
  els.btnCloseSettings.addEventListener("click", closeSettingsModal);
  els.settingsModal.addEventListener("click", (e) => {
    if (e.target === els.settingsModal) closeSettingsModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.settingsModal.classList.contains("hidden")) {
      closeSettingsModal();
    }
  });

  // обновляем предпросмотр только когда не играем
  [els.runMode, els.startNote, els.lowerNote, els.upperNote, els.noteDur, els.breathMs]
    .forEach(ctrl => ctrl.addEventListener("change", () => { if (!isPlaying) updatePreview(); }));

  // пересчёт ширины на ресайз (поддерживаем «вмещается без скролла»)
  window.addEventListener('resize', () => { if (!isPlaying) updatePreview(); });
})();
