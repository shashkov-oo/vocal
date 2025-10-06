// app.js — список-треки, описание, график, нижний транспорт + примеры + дыхание + прелюдии + микропаузи + метр + направления + быстрый темп
(function () {
  const els = {
    exerciseList: document.getElementById("exerciseList"),
    exerciseDesc: document.getElementById("exerciseDesc"),
    svg: document.getElementById("svg"),

    btnPrev: document.getElementById("btnPrev"),
    btnPlayPause: document.getElementById("btnPlayPause"),
    btnStop: document.getElementById("btnStop"),
    btnNext: document.getElementById("btnNext"),

    // quick speed
    btnSpeed08: document.getElementById("btnSpeed08"),
    btnSpeed10: document.getElementById("btnSpeed10"),
    btnSpeed12: document.getElementById("btnSpeed12"),

    // settings modal
    btnSettings: document.getElementById("btnSettings"),
    settingsModal: document.getElementById("settingsModal"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),

    // controls
    runMode: document.getElementById("runMode"),      // 'single' | 'range'
    direction: document.getElementById("direction"),  // 'up' | 'down' | 'updown'
    startNote: document.getElementById("startNote"),
    lowerNote: document.getElementById("lowerNote"),
    upperNote: document.getElementById("upperNote"),
    noteDur: document.getElementById("noteDur"),
    breathMs: document.getElementById("breathMs"),
  };

  const DEFAULT_NOTE_DURATION = "8n";

  let currentIndex = 0;
  let isPlaying = false; // идёт воспроизведение (Transport.started)
  let isPaused = false;  // стоит на паузе (Transport.paused)
  let speedMul = 1.0;    // множитель BPM (0.8 / 1.0 / 1.2)

  // для перерисовки графика мгновенно при смещении guide
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
        if (isPlaying || isPaused) stop();
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

  // Вставляет "тихие" шаги-паузы после каждой N-й звучащей ноты.
  function injectMicroPauses(steps, rule, bpm) {
    if (!rule || !rule.every || !rule.ms) return steps;
    const every = Math.max(1, rule.every|0);
    const gapSec = Math.max(0, rule.ms) / 1000;
    const secPerBeat = 60 / (parseFloat(bpm) || 90);

    const out = [];
    let countNotes = 0;
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      out.push(st);
      countNotes++;

      if (countNotes % every === 0 && gapSec > 0) {
        out.push({
          midi: st.midi,
          durStr: null,
          durSec: gapSec,
          beats: gapSec / secPerBeat,
          rest: true
        });
      }
    }
    return out;
  }

  function selectIndex(i) {
    if (isPlaying || isPaused) stop(); // полная остановка при переключении
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    const res = patternByIndex(i);
    if (!res) return;

    currentIndex = res.idx;
    highlightActive();

    loadDescription(res.obj.id, res.obj.desc);

    const root = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const baseSteps = VPT.buildStepsForRoot(root, els.noteDur.value, res.obj);
    const steps = injectMicroPauses(baseSteps, res.obj.microPause, res.obj.bpm);

    drawFromSteps(steps);
    if (steps.length) {
      const firstSound = steps.find(s => !s.rest) || steps[0];
      VPT.setGuideNote(firstSound.midi);
      VPT.drawGraph(lastMidis, lastBeats);
    }
  }

  function updatePreview() { selectIndex(currentIndex); }

  // ---- прелюдия: варианты входа перед блоком ----
  function schedulePrelude(whenSec, rootMidi, rootSec, triadSec, mode='root_triad', velocity=0.8) {
    const s = VPT.audio.get();
    const N = (m)=>VPT.midiToNote(m);

    const playNote = (m, dur, t0)=> {
      Tone.Transport.schedule((t)=>{ try{ s.triggerAttackRelease(N(m), dur, t, velocity); }catch(_){} }, `+${t0}`);
      return t0 + dur;
    };
    const playTriad = (m12, dur, t0)=> {
      const triad = [m12, m12+4, m12+7];
      Tone.Transport.schedule((t)=>{ try{ triad.forEach(n=>s.triggerAttackRelease(N(n), dur, t, velocity*0.95)); }catch(_){} }, `+${t0}`);
      return t0 + dur;
    };

    let t = whenSec;
    if (mode === 'dom5_tonic_triad') {
      t = playNote(rootMidi+19, rootSec, t);
      t = playNote(rootMidi+12, rootSec, t);
      t = playTriad(rootMidi+12, triadSec, t);
    } else {
      t = playNote(rootMidi, rootSec, t);
      t = playTriad(rootMidi, triadSec, t);
    }
    return t;
  }

  function parseMeter(pat){
    const m = pat && pat.meter ? String(pat.meter) : (VPT.DEFAULT_METER || "3/4");
    const [num, den] = m.split('/').map(v=>parseInt(v,10));
    const valid = Number.isFinite(num) && Number.isFinite(den) && num>0 && den>0;
    return valid ? [num,den] : [3,4];
  }

  function applyTransportBpmAndMeter(pat){
    const bpm = parseInt(pat?.bpm || 90, 10);
    Tone.Transport.bpm.value = Math.max(20, Math.min(300, bpm * speedMul));
    const [num,den] = parseMeter(pat);
    Tone.Transport.timeSignature = [num,den];
  }

  function clearSchedulesAndStop(){
    Tone.Transport.stop();
    Tone.Transport.cancel();
    try { Tone.Transport.position = 0; } catch(e){}
    if (VPT.audio.get() && VPT.audio.get().releaseAll) { try { VPT.audio.get().releaseAll(); } catch(e){} }
  }

  // ---------- воспроизведение ----------
  async function startFreshScheduleAndPlay() {
    const patObj = patternByIndex(currentIndex)?.obj;
    if (!patObj) return;

    // стопаем все чужие источники
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    try {
      await VPT.audio.ensure();
      await Tone.start();
    } catch(e) { console.error("Audio load error", e); }

    applyTransportBpmAndMeter(patObj);
    clearSchedulesAndStop();

    const mode       = els.runMode.value;          // 'single' | 'range'
    const direction  = els.direction.value;        // 'up' | 'down' | 'updown'
    const defaultDur = els.noteDur.value;
    const startMidi  = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const lower      = VPT.noteToMidiSafe(els.lowerNote.value || "A2");
    const upper      = VPT.noteToMidiSafe(els.upperNote.value || "A4");
    const breathSec  = Math.max(0, (parseInt(els.breathMs.value || "0", 10) || 0) / 1000);

    // параметры прелюдии из упражнения
    const pre = patObj.prelude || {};
    const preludeEnabled = !!pre.enabled;
    const preludeMode    = pre.mode || 'root_triad';
    const preRootSec     = Math.max(0.1, ((pre.rootMs ?? 350) / 1000));
    const preTriadSec    = Math.max(0.1, ((pre.triadMs ?? 600) / 1000));

    if (mode === "single") {
      const baseSteps = VPT.buildStepsForRoot(startMidi, defaultDur, patObj);
      const steps = injectMicroPauses(baseSteps, patObj.microPause, patObj.bpm);
      drawFromSteps(steps);

      let when = 0;
      if (preludeEnabled) {
        when = schedulePrelude(when, startMidi, preRootSec, preTriadSec, preludeMode);
      }

      for (const st of steps) {
        const dur = (st.durSec != null) ? st.durSec : VPT.durToSeconds(st.durStr);
        if (!st.rest) {
          Tone.Transport.schedule(() => {
            VPT.setGuideNote(st.midi);
            VPT.drawGraph(lastMidis, lastBeats);
          }, `+${when}`);

          Tone.Transport.schedule((t) => {
            VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
          }, `+${when}`);
        }
        when += dur;
      }

      Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
      Tone.Transport.start();
      setPlayUiStatePlaying();
      return;
    }

    // режим "диапазон": шаг в 1 полутон
    const maxOff = VPT.patternMaxOffsetSemitones(patObj);
    const rootsAsc = [];
    for (let r = lower; r + maxOff <= upper; r += 1) rootsAsc.push(r);
    if (!rootsAsc.length) rootsAsc.push(Math.max(lower, upper - maxOff));

    let roots = rootsAsc.slice();
    if (direction === 'down') roots = rootsAsc.slice().reverse();
    if (direction === 'updown') {
      const down = rootsAsc.slice(0, -1).reverse(); // без повтора вершины
      roots = rootsAsc.concat(down);
    }

    let when = 0;
    for (let idx = 0; idx < roots.length; idx++) {
      const root = roots[idx];
      const baseSteps = VPT.buildStepsForRoot(root, defaultDur, patObj);
      const steps = injectMicroPauses(baseSteps, patObj.microPause, patObj.bpm);

      if (preludeEnabled) {
        when = schedulePrelude(when, root, preRootSec, preTriadSec, preludeMode);
      }

      Tone.Transport.schedule(() => { 
        drawFromSteps(steps);
        if (steps.length) {
          const firstSound = steps.find(s => !s.rest) || steps[0];
          VPT.setGuideNote(firstSound.midi);
          VPT.drawGraph(lastMidis, lastBeats);
        }
      }, `+${when}`);

      for (const st of steps) {
        const dur = (st.durSec != null) ? st.durSec : VPT.durToSeconds(st.durStr);
        if (!st.rest) {
          Tone.Transport.schedule(() => {
            VPT.setGuideNote(st.midi);
            VPT.drawGraph(lastMidis, lastBeats);
          }, `+${when}`);

          Tone.Transport.schedule((t) => {
            VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
          }, `+${when}`);
        }
        when += dur;
      }

      if (breathSec > 0 && idx < roots.length - 1) {
        when += breathSec;
      }
    }

    Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
    Tone.Transport.start();
    setPlayUiStatePlaying();
  }

  function pausePlayback(){
    if (!isPlaying) return;
    Tone.Transport.pause();
    isPaused = true;
    isPlaying = false;
    setPlayUiStatePaused();
  }

  function resumePlayback(){
    if (!isPaused) return;
    Tone.Transport.start(); // продолжить с текущей позиции
    isPaused = false;
    isPlaying = true;
    setPlayUiStatePlaying();
  }

  function stop(){
    clearSchedulesAndStop();
    isPlaying = false;
    isPaused = false;
    setPlayUiStateStopped();
  }

  function next() {
    const total = (VPT.PATTERNS || []).length;
    if (!total) return;
    if (isPlaying || isPaused) stop();
    VPT.examples.stop();
    selectIndex((currentIndex + 1) % total);
  }

  function prev() {
    const total = (VPT.PATTERNS || []).length;
    if (!total) return;
    if (isPlaying || isPaused) stop();
    VPT.examples.stop();
    selectIndex((currentIndex - 1 + total) % total);
  }

  // ---------- UI state ----------
  function setPlayUiStatePlaying(){
    els.btnPlayPause.textContent = "⏸";
    els.btnPlayPause.classList.remove("paused");
    els.btnPlayPause.classList.add("playing");
    isPlaying = true;
    isPaused = false;
  }
  function setPlayUiStatePaused(){
    els.btnPlayPause.textContent = "▶️";
    els.btnPlayPause.classList.remove("playing");
    els.btnPlayPause.classList.add("paused");
  }
  function setPlayUiStateStopped(){
    els.btnPlayPause.textContent = "▶️";
    els.btnPlayPause.classList.remove("playing");
    els.btnPlayPause.classList.add("paused");
  }

  function setSpeedUi(activeId){
    [els.btnSpeed08, els.btnSpeed10, els.btnSpeed12].forEach(b=>b.classList.remove("active"));
    if (activeId) document.getElementById(activeId).classList.add("active");
  }

  // ---------- init ----------
  fillNoteSelect(els.startNote, "A2");
  fillNoteSelect(els.lowerNote, "A2");
  fillNoteSelect(els.upperNote, "A4");
  renderExerciseList();
  selectIndex(0);

  // Транспорт
  els.btnPlayPause.addEventListener("click", () => {
    if (isPlaying) { pausePlayback(); return; }
    if (isPaused)  { resumePlayback(); return; }
    startFreshScheduleAndPlay();
  });
  els.btnStop.addEventListener("click", stop);
  els.btnNext.addEventListener("click", next);
  els.btnPrev.addEventListener("click", prev);

  // Быстрая скорость
  els.btnSpeed08.addEventListener("click", () => {
    speedMul = 0.8; setSpeedUi("btnSpeed08");
    const pat = patternByIndex(currentIndex)?.obj;
    if (pat) Tone.Transport.bpm.value = (parseInt(pat.bpm||90,10))*speedMul;
  });
  els.btnSpeed10.addEventListener("click", () => {
    speedMul = 1.0; setSpeedUi("btnSpeed10");
    const pat = patternByIndex(currentIndex)?.obj;
    if (pat) Tone.Transport.bpm.value = (parseInt(pat.bpm||90,10))*speedMul;
  });
  els.btnSpeed12.addEventListener("click", () => {
    speedMul = 1.2; setSpeedUi("btnSpeed12");
    const pat = patternByIndex(currentIndex)?.obj;
    if (pat) Tone.Transport.bpm.value = (parseInt(pat.bpm||90,10))*speedMul;
  });

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
    if (!isPlaying && !isPaused) updatePreview();
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

  // обновляем предпросмотр только когда не играем/не на паузе
  [els.runMode, els.direction, els.startNote, els.lowerNote, els.upperNote, els.noteDur, els.breathMs]
    .forEach(ctrl => ctrl.addEventListener("change", () => { if (!isPlaying && !isPaused) updatePreview(); }));

  // пересчёт ширины на ресайз
  window.addEventListener('resize', () => { if (!isPlaying && !isPaused) updatePreview(); });
})();
