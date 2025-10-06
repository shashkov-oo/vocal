// app.js — быстрые настройки (режимы на главной), аккордеон плейлистов, инфо-модалка, старт/пауза/стоп, скорость ×0.8/1.0/1.2, метры из паттернов
(function () {
  const els = {
    svg: document.getElementById("svg"),

    // Транспорт
    btnPrev: document.getElementById("btnPrev"),
    btnPlayPause: document.getElementById("btnPlayPause"),
    btnStop: document.getElementById("btnStop"),
    btnNext: document.getElementById("btnNext"),

    // Быстрые скорости
    btnSpeed08: document.getElementById("btnSpeed08"),
    btnSpeed10: document.getElementById("btnSpeed10"),
    btnSpeed12: document.getElementById("btnSpeed12"),

    // Квик-контролы (режим, ноты, направление)
    qcRunMode: document.getElementById("qcRunMode"),
    qcSingleWrap: document.getElementById("qcSingleWrap"),
    qcRangeWrap: document.getElementById("qcRangeWrap"),
    qcStartNote: document.getElementById("qcStartNote"),
    qcLowerNote: document.getElementById("qcLowerNote"),
    qcUpperNote: document.getElementById("qcUpperNote"),
    qcDirection: document.getElementById("qcDirection"),
    btnNoteUp: document.getElementById("btnNoteUp"),
    btnNoteDown: document.getElementById("btnNoteDown"),

    // Аккордеон и списки
    playlistAccordion: document.getElementById("playlistAccordion"),
    exerciseList_pl1: document.getElementById("exerciseList_pl1"),
    exerciseList_pl2: document.getElementById("exerciseList_pl2"),
    exerciseList_pl3: document.getElementById("exerciseList_pl3"),

    // Модалка описаний
    descModal: document.getElementById("descModal"),
    descText: document.getElementById("descText"),
    btnCloseDesc: document.getElementById("btnCloseDesc"),

    // Модалка расширенных настроек
    btnSettings: document.getElementById("btnSettings"),
    settingsModal: document.getElementById("settingsModal"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),

    // Расширенные контролы
    noteDur: document.getElementById("noteDur"),
    breathMs: document.getElementById("breathMs"),
    playPrelude: document.getElementById("playPrelude"),
    preludeRootMs: document.getElementById("preludeRootMs"),
    triadMs: document.getElementById("triadMs"),
  };

  const DEFAULT_NOTE_DURATION = "8n";

  let currentIndex = 0;      // индекс внутри общего массива VPT.PATTERNS
  let currentGroup = "pl1";  // открытая секция плейлиста
  let isPlaying = false;
  let isPaused = false;
  let speedMul = 1.0;

  let lastMidis = [];
  let lastBeats = [];

  // Безопасные заглушки
  window.VPT = window.VPT || {};
  if (!VPT.examples) {
    VPT.examples = {
      async play(id) { console.warn(`examples/${id}.mp3: плеер примеров ещё не подключён`); },
      stop() {},
      isPlaying() { return false; }
    };
  }

  // ---------- Нотные утилиты ----------
  function fillNoteSelect(sel, def) {
    const items = [];
    for (let o = 2; o <= 6; o++) for (const n of VPT.NOTE_NAMES) items.push(`${n}${o}`);
    sel.innerHTML = "";
    for (const n of items) {
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    }
    sel.value = items.includes(def) ? def : "A2";
  }

  function midiUpDownNoteSelect(sel, delta){
    const midi = VPT.noteToMidiSafe(sel.value || "A2");
    const next = midi + delta;
    sel.value = VPT.midiToNote(next);
    // выровнять на ближайшее присутствующее значение в списке
    if (![...sel.options].some(o => o.value === sel.value)) {
      // если нет точного — подберём соседний
      const opts = [...sel.options].map(o=>VPT.noteToMidiSafe(o.value));
      let closest = opts[0], minDiff = Math.abs(opts[0]-next);
      for (const m of opts) {
        const d = Math.abs(m-next); if (d<minDiff){ minDiff=d; closest=m; }
      }
      sel.value = VPT.midiToNote(closest);
    }
  }

  // ---------- Группы плейлистов ----------
  function inRange(id, a,b){ const x = parseInt(id,10); return Number.isFinite(x) && x>=a && x<=b; }
  function buildGroups() {
    const pl1 = []; // 1–13
    const pl2 = []; // 15–26
    const pl3 = []; // 27–30
    (VPT.PATTERNS || []).forEach((p, idx) => {
      if (inRange(p.id, 1, 13)) pl1.push({p, idx});
      else if (inRange(p.id, 15, 26)) pl2.push({p, idx});
      else if (inRange(p.id, 27, 30)) pl3.push({p, idx});
    });
    return { pl1, pl2, pl3 };
  }

  function renderExerciseRow(container, obj, globalIdx) {
    const row = document.createElement("div");
    row.className = "exercise-item";
    row.dataset.id = obj.id;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = String(obj.id).slice(0, 2);

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = obj.name;

    const info = document.createElement("button");
    info.className = "info";
    info.type = "button";
    info.textContent = "ℹ";
    info.title = "Описание упражнения";
    info.addEventListener("click", async (e) => {
      e.stopPropagation();
      const desc = await loadDescription(obj.id, obj.desc);
      openDescModal(desc || "—");
    });

    const example = document.createElement("button");
    example.className = "example";
    example.type = "button";
    example.textContent = "▶ пример";
    example.title = "Эталон (из папки examples)";
    example.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (VPT.examples.isPlaying(obj.id)) {
        VPT.examples.stop();
        example.textContent = "▶ пример";
        return;
      }
      if (isPlaying || isPaused) stop();
      VPT.examples.stop();
      container.querySelectorAll(".example").forEach(btn => btn.textContent = "▶ пример");
      await VPT.examples.play(obj.id);
      example.textContent = "⏹ пример";
    });

    row.appendChild(avatar);
    row.appendChild(title);
    row.appendChild(info);
    row.appendChild(example);
    row.addEventListener("click", () => selectIndex(globalIdx));

    container.appendChild(row);
  }

  function renderPlaylists() {
    const { pl1, pl2, pl3 } = buildGroups();
    els.exerciseList_pl1.innerHTML = "";
    els.exerciseList_pl2.innerHTML = "";
    els.exerciseList_pl3.innerHTML = "";

    pl1.forEach(({p, idx}) => renderExerciseRow(els.exerciseList_pl1, p, idx));
    pl2.forEach(({p, idx}) => renderExerciseRow(els.exerciseList_pl2, p, idx));
    pl3.forEach(({p, idx}) => renderExerciseRow(els.exerciseList_pl3, p, idx));

    highlightActive();
  }

  function setAccordionHandlers(){
    els.playlistAccordion.querySelectorAll(".pl-header").forEach(h => {
      h.addEventListener("click", () => {
        const sec = h.parentElement;
        const id = sec.getAttribute("data-id");
        // закрыть все
        els.playlistAccordion.querySelectorAll(".pl-section").forEach(s => s.classList.remove("open"));
        // открыть выбранный
        sec.classList.add("open");
        currentGroup = id;
      });
    });
  }

  function highlightActive() {
    const allLists = [els.exerciseList_pl1, els.exerciseList_pl2, els.exerciseList_pl3];
    allLists.forEach(list => {
      list.querySelectorAll(".exercise-item").forEach((row) => row.classList.remove("active"));
    });
    const pat = patternByIndex(currentIndex)?.obj;
    if (!pat) return;
    const id = String(pat.id);
    const containers = [els.exerciseList_pl1, els.exerciseList_pl2, els.exerciseList_pl3];
    containers.forEach(c => {
      if (!c) return;
      const row = [...c.querySelectorAll(".exercise-item")].find(r => r.dataset.id === id);
      if (row) row.classList.add("active");
    });
  }

  // ---------- Описание (модалка) ----------
  async function loadDescription(id, fallback) {
    try {
      const resp = await fetch(`./examples/${id}.mp3.txt`, { cache: "no-store" });
      if (!resp.ok) throw new Error("no txt");
      const text = await resp.text();
      return (text.trim() || fallback || "—");
    } catch {
      return (fallback || "—");
    }
  }
  function openDescModal(text){
    els.descText.textContent = text || "—";
    els.descModal.classList.remove("hidden");
    els.descModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeDescModal(){
    els.descModal.classList.add("hidden");
    els.descModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  // ---------- Helpers для паттернов/рендера ----------
  function patternByIndex(i) {
    const list = VPT.PATTERNS || [];
    if (!list.length) return null;
    const idx = Math.max(0, Math.min(i, list.length - 1));
    return { obj: list[idx], idx };
  }

  function drawFromSteps(steps) {
    lastMidis = steps.map(s => s.midi);
    lastBeats = steps.map(s => s.beats);
    VPT.drawGraph(lastMidis, lastBeats);
  }

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
    const s = VPT.audio.get();
    if (s && s.releaseAll) { try { s.releaseAll(); } catch(e){} }
  }

  // ---------- выбор упражнения ----------
  function selectIndex(i) {
    if (isPlaying || isPaused) stop();
    VPT.examples.stop();
    // вернуть текст "пример" всем кнопкам
    document.querySelectorAll(".example").forEach(btn => btn.textContent = "▶ пример");

    const res = patternByIndex(i);
    if (!res) return;

    currentIndex = res.idx;
    highlightActive();

    // предпросмотр: строим шаги по текущим квик-настройкам
    previewWithCurrentSettings();
  }

  function previewWithCurrentSettings() {
    const pat = patternByIndex(currentIndex)?.obj;
    if (!pat) return;

    const mode = els.qcRunMode.value;             // 'single' | 'range'
    const dir  = els.qcDirection.value;           // 'up' | 'down' | 'updown'
    const defaultDur = els.noteDur.value || DEFAULT_NOTE_DURATION;

    const startMidi  = VPT.noteToMidiSafe(els.qcStartNote.value || "A2");
    const lower      = VPT.noteToMidiSafe(els.qcLowerNote.value || "A2");
    const upper      = VPT.noteToMidiSafe(els.qcUpperNote.value || "A4");

    let steps = [];
    if (mode === "single") {
      steps = VPT.buildStepsForRoot(startMidi, defaultDur, pat);
      steps = injectMicroPauses(steps, pat.microPause, pat.bpm);
    } else {
      const maxOff = VPT.patternMaxOffsetSemitones(pat);
      const rootsAsc = [];
      for (let r = lower; r + maxOff <= upper; r += 1) rootsAsc.push(r);
      if (!rootsAsc.length) rootsAsc.push(Math.max(lower, upper - maxOff));
      let roots = rootsAsc.slice();
      if (dir === 'down') roots = rootsAsc.slice().reverse();
      if (dir === 'updown') { const down = rootsAsc.slice(0, -1).reverse(); roots = rootsAsc.concat(down); }

      for (const root of roots) {
        const st = VPT.buildStepsForRoot(root, defaultDur, pat);
        steps = steps.concat(injectMicroPauses(st, pat.microPause, pat.bpm));
      }
    }

    drawFromSteps(steps);
    if (steps.length) {
      const firstSound = steps.find(s => !s.rest) || steps[0];
      VPT.setGuideNote(firstSound.midi);
      VPT.drawGraph(lastMidis, lastBeats);
    }
  }

  // ---------- воспроизведение ----------
  async function startFreshScheduleAndPlay() {
    const pat = patternByIndex(currentIndex)?.obj;
    if (!pat) return;

    // стопаем другие источники
    VPT.examples.stop();
    document.querySelectorAll(".example").forEach(btn => btn.textContent = "▶ пример");

    try {
      await VPT.audio.ensure();
      await Tone.start();
    } catch(e) { console.error("Audio load error", e); }

    applyTransportBpmAndMeter(pat);
    clearSchedulesAndStop();

    const mode       = els.qcRunMode.value;          // 'single' | 'range'
    const direction  = els.qcDirection.value;        // 'up' | 'down' | 'updown'
    const defaultDur = els.noteDur.value || DEFAULT_NOTE_DURATION;

    const startMidi  = VPT.noteToMidiSafe(els.qcStartNote.value || "A2");
    const lower      = VPT.noteToMidiSafe(els.qcLowerNote.value || "A2");
    const upper      = VPT.noteToMidiSafe(els.qcUpperNote.value || "A4");
    const breathSec  = Math.max(0, (parseInt(els.breathMs.value || "0", 10) || 0) / 1000);

    // прелюдия (из паттерна + overrides из «Расширенных», если нужно)
    const prePat = pat.prelude || {};
    const preludeEnabled = !!(els.playPrelude?.checked ?? prePat.enabled);
    const preludeMode    = prePat.mode || 'root_triad';
    const preRootSec     = Math.max(0.1, ((parseInt(els.preludeRootMs?.value ?? prePat.rootMs ?? 350,10)) / 1000));
    const preTriadSec    = Math.max(0.1, ((parseInt(els.triadMs?.value ?? prePat.triadMs ?? 600,10)) / 1000));

    const schedulePrelude = (whenSec, rootMidi, velocity=0.8)=>{
      const s = VPT.audio.get(); const N = (m)=>VPT.midiToNote(m);
      const playNote = (m, dur, t0)=> {
        Tone.Transport.schedule((t)=>{ try{ s.triggerAttackRelease(N(m), dur, t, velocity); }catch(_){} }, `+${t0}`); return t0 + dur;
      };
      const playTriad = (m12, dur, t0)=> {
        const triad = [m12, m12+4, m12+7];
        Tone.Transport.schedule((t)=>{ try{ triad.forEach(n=>s.triggerAttackRelease(N(n), dur, t, velocity*0.95)); }catch(_){} }, `+${t0}`); return t0 + dur;
      };
      let t = whenSec;
      if (preludeMode === 'dom5_tonic_triad') { t = playNote(rootMidi+19, preRootSec, t); t = playNote(rootMidi+12, preRootSec, t); t = playTriad(rootMidi+12, preTriadSec, t); }
      else { t = playNote(rootMidi, preRootSec, t); t = playTriad(rootMidi, preTriadSec, t); }
      return t;
    };

    if (mode === "single") {
      const baseSteps = VPT.buildStepsForRoot(startMidi, defaultDur, pat);
      const steps = injectMicroPauses(baseSteps, pat.microPause, pat.bpm);
      drawFromSteps(steps);

      let when = 0;
      if (preludeEnabled) when = schedulePrelude(when, startMidi);

      for (const st of steps) {
        const dur = (st.durSec != null) ? st.durSec : VPT.durToSeconds(st.durStr);
        if (!st.rest) {
          Tone.Transport.schedule(() => { VPT.setGuideNote(st.midi); VPT.drawGraph(lastMidis, lastBeats); }, `+${when}`);
          Tone.Transport.schedule((t) => { VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9); }, `+${when}`);
        }
        when += dur;
      }
      Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
      Tone.Transport.start();
      setPlayUiStatePlaying();
      return;
    }

    // режим диапазона
    const maxOff = VPT.patternMaxOffsetSemitones(pat);
    const rootsAsc = [];
    for (let r = lower; r + maxOff <= upper; r += 1) rootsAsc.push(r);
    if (!rootsAsc.length) rootsAsc.push(Math.max(lower, upper - maxOff));

    let roots = rootsAsc.slice();
    if (direction === 'down') roots = rootsAsc.slice().reverse();
    if (direction === 'updown') { const down = rootsAsc.slice(0, -1).reverse(); roots = rootsAsc.concat(down); }

    let when = 0;
    for (let idx = 0; idx < roots.length; idx++) {
      const root = roots[idx];
      const baseSteps = VPT.buildStepsForRoot(root, defaultDur, pat);
      const steps = injectMicroPauses(baseSteps, pat.microPause, pat.bpm);

      if (preludeEnabled) when = schedulePrelude(when, root);

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
          Tone.Transport.schedule(() => { VPT.setGuideNote(st.midi); VPT.drawGraph(lastMidis, lastBeats); }, `+${when}`);
          Tone.Transport.schedule((t) => { VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9); }, `+${when}`);
        }
        when += dur;
      }

      if (breathSec > 0 && idx < roots.length - 1) when += breathSec;
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
    Tone.Transport.start();
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

  function applyModeVisibility(){
    const mode = els.qcRunMode.value;
    els.qcSingleWrap.style.display = (mode === 'single') ? '' : 'none';
    els.qcRangeWrap.style.display  = (mode === 'range') ? '' : 'none';
  }

  // ---------- init ----------
  fillNoteSelect(els.qcStartNote, "A2");
  fillNoteSelect(els.qcLowerNote, "A2");
  fillNoteSelect(els.qcUpperNote, "A4");
  applyModeVisibility();

  renderPlaylists();
  setAccordionHandlers();

  // Выберем первое упражнение из первой группы по умолчанию (id 1–13)
  const firstIdx = (VPT.PATTERNS || []).findIndex(p => inRange(p.id,1,13));
  selectIndex(firstIdx >= 0 ? firstIdx : 0);

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

  // Квик-настройки
  els.qcRunMode.addEventListener("change", () => {
    applyModeVisibility();
    if (!isPlaying && !isPaused) previewWithCurrentSettings();
  });
  [els.qcStartNote, els.qcLowerNote, els.qcUpperNote, els.qcDirection].forEach(ctrl => {
    ctrl.addEventListener("change", () => { if (!isPlaying && !isPaused) previewWithCurrentSettings(); });
  });
  els.btnNoteUp.addEventListener("click", () => { midiUpDownNoteSelect(els.qcStartNote, +1); if(!isPlaying&&!isPaused) previewWithCurrentSettings(); });
  els.btnNoteDown.addEventListener("click", () => { midiUpDownNoteSelect(els.qcStartNote, -1); if(!isPlaying&&!isPaused) previewWithCurrentSettings(); });

  // Модалка описаний
  els.btnCloseDesc.addEventListener("click", closeDescModal);
  els.descModal.addEventListener("click", (e)=>{ if (e.target===els.descModal) closeDescModal(); });

  // Модалка расширенных настроек
  els.btnSettings.addEventListener("click", () => {
    els.settingsModal.classList.remove("hidden");
    els.settingsModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  });
  function closeSettingsModal(){
    els.settingsModal.classList.add("hidden");
    els.settingsModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (!isPlaying && !isPaused) previewWithCurrentSettings();
  }
  els.btnCloseSettings.addEventListener("click", closeSettingsModal);
  els.settingsModal.addEventListener("click", (e) => { if (e.target === els.settingsModal) closeSettingsModal(); });

  // Ресайз = обновление предпросмотра, если не идёт проигрывание
  window.addEventListener('resize', () => { if (!isPlaying && !isPaused) previewWithCurrentSettings(); });
})();
