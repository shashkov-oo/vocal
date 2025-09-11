// app.js — новый UI-флоу: список-треки, описание, график, нижний транспорт
(function () {
  // ---------- DOM ----------
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
    bpm: document.getElementById("bpm"),
    runMode: document.getElementById("runMode"),
    startNote: document.getElementById("startNote"),
    lowerNote: document.getElementById("lowerNote"),
    upperNote: document.getElementById("upperNote"),
    noteDur: document.getElementById("noteDur"),
  };

  // ---------- state ----------
  let currentIndex = 0; // индекс выбранного упражнения
  let isPlaying = false;

  // ---------- safety: examples stub (если не добавил в audio.js блок VPT.examples) ----------
  window.VPT = window.VPT || {};
  if (!VPT.examples) {
    VPT.examples = {
      async play(id) { console.warn(`examples/${id}.mp3: плеер примеров ещё не подключён`); },
      stop() { /* no-op */ },
      isPlaying() { return false; }
    };
  }

  // ---------- helpers ----------
  function fillNoteSelect(sel, def) {
    const items = [];
    for (let o = 2; o <= 6; o++) {
      for (const n of VPT.NOTE_NAMES) items.push(`${n}${o}`);
    }
    sel.innerHTML = "";
    for (const n of items) {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
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

      // клик по "пример" — не выбирает упражнение, только играет/стопает пример
      example.addEventListener("click", async (e) => {
        e.stopPropagation();

        // если уже играет этот пример — стоп
        if (VPT.examples.isPlaying(p.id)) {
          VPT.examples.stop();
          example.textContent = "▶ пример";
          return;
        }

        // перед запуском примера — стоп основного воспроизведения и других примеров
        if (isPlaying) stop();
        VPT.examples.stop();
        // сброс подписей у остальных кнопок "пример"
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
    // пытаемся подтянуть examples/<id>.txt ; если нет — показываем desc из patterns
    try {
      const resp = await fetch(`./examples/${id}.mp3.txt`, { cache: "no-store" });
      if (!resp.ok) throw new Error("no txt");
      const text = await resp.text();
      els.exerciseDesc.textContent = (text.trim() || fallback || "—");
    } catch {
      els.exerciseDesc.textContent = fallback || "—";
    }
  }

  function selectIndex(i) {
    const res = patternByIndex(i);
    if (!res) return;

    // при переключении — стоп примера и сброс подписей
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    currentIndex = res.idx;
    highlightActive();

    // описание
    loadDescription(res.obj.id, res.obj.desc);

    // превью графика от стартовой ноты (если модалка ещё не открывалась — A2)
    const root = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const steps = VPT.buildStepsForRoot(root, els.noteDur.value, res.obj);
    VPT.drawGraph(steps, els.svg);
  }

  function updatePreview() {
    // перерисовать график/описание для текущего
    selectIndex(currentIndex);
  }

  // ---------- транспорт ----------
  async function play() {
    const patObj = patternByIndex(currentIndex)?.obj;
    if (!patObj) return;

    // стоп примера перед запуском основного проигрывания
    VPT.examples.stop();
    [...els.exerciseList.querySelectorAll(".example")].forEach(btn => btn.textContent = "▶ пример");

    // UI
    els.btnPlayStop.textContent = "⏹";
    els.btnPlayStop.classList.add("stop");
    isPlaying = true;

    // audio init
    try {
      await VPT.audio.ensure();
      await Tone.start();
    } catch (e) {
      console.error("Audio load error", e);
    }

    // фикс первой скорости — BPM до расчётов
    Tone.Transport.bpm.value = parseInt(els.bpm.value || "90", 10);
    VPT.audio.stop();

    const mode = els.runMode.value;         // 'single' | 'range'
    const defaultDur = els.noteDur.value;
    const startMidi = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const lower = VPT.noteToMidiSafe(els.lowerNote.value || "A2");
    const upper = VPT.noteToMidiSafe(els.upperNote.value || "G4");

    if (mode === "single") {
      // один прогон от стартовой
      const steps = VPT.buildStepsForRoot(startMidi, defaultDur, patObj);
      VPT.drawGraph(steps, els.svg);

      let when = 0;
      for (const st of steps) {
        const dur = VPT.durToSeconds(st.durStr);
        Tone.Transport.schedule((t) => {
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);
        when += dur;
      }
      Tone.Transport.scheduleOnce(() => stop(), `+${when + 0.08}`);
      Tone.Transport.start();
      return;
    }

    // режим "диапазон": шаг 1 полутон, верх паттерна не превышает upper
    const maxOff = VPT.patternMaxOffsetSemitones(patObj);
    const roots = [];
    for (let r = lower; r + maxOff <= upper; r += 1) roots.push(r);
    if (!roots.length) roots.push(Math.max(lower, upper - maxOff));

    let when = 0;
    for (const root of roots) {
      const steps = VPT.buildStepsForRoot(root, defaultDur, patObj);

      // обновляем график перед исполнением текущего шага
      Tone.Transport.schedule(() => { VPT.drawGraph(steps, els.svg); }, `+${when}`);

      for (const st of steps) {
        const dur = VPT.durToSeconds(st.durStr);
        Tone.Transport.schedule((t) => {
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);
        when += dur;
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
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    selectIndex((currentIndex + 1) % total);
    if (wasPlaying) play();
  }

  function prev() {
    const total = (VPT.PATTERNS || []).length;
    if (!total) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();
    selectIndex((currentIndex - 1 + total) % total);
    if (wasPlaying) play();
  }

  // ---------- init ----------
  fillNoteSelect(els.startNote, "A2");
  fillNoteSelect(els.lowerNote, "A2");
  fillNoteSelect(els.upperNote, "G4");

  renderExerciseList();
  selectIndex(0); // выбрать первое

  // события транспорта
  els.btnPlayStop.addEventListener("click", () => (isPlaying ? stop() : play()));
  els.btnNext.addEventListener("click", next);
  els.btnPrev.addEventListener("click", prev);

  // модалка
  els.btnSettings.addEventListener("click", () => {
    els.settingsModal.classList.remove("hidden");
    els.settingsModal.setAttribute("aria-hidden", "false");
  });
  els.btnCloseSettings.addEventListener("click", () => {
    els.settingsModal.classList.add("hidden");
    els.settingsModal.setAttribute("aria-hidden", "true");
    if (!isPlaying) updatePreview(); // обновим превью после изменения настроек
  });

  // лайв-обновление превью при изменении настроек (если не играет)
  [els.bpm, els.runMode, els.startNote, els.lowerNote, els.upperNote, els.noteDur].forEach(ctrl => {
    ctrl.addEventListener("change", () => { if (!isPlaying) updatePreview(); });
  });
})();
