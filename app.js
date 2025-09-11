// app.js — новый UI-флоу: список-треки, описание, график, нижний транспорт
(function(){
  const els = {
    // списки/блоки
    exerciseList: document.getElementById("exerciseList"),
    exerciseDesc: document.getElementById("exerciseDesc"),
    svg:          document.getElementById("svg"),

    // транспорт
    btnPrev:      document.getElementById("btnPrev"),
    btnPlayStop:  document.getElementById("btnPlayStop"),
    btnNext:      document.getElementById("btnNext"),

    // модалка настроек
    btnSettings:      document.getElementById("btnSettings"),
    settingsModal:    document.getElementById("settingsModal"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),
    bpm:        document.getElementById("bpm"),
    runMode:    document.getElementById("runMode"),
    startNote:  document.getElementById("startNote"),
    lowerNote:  document.getElementById("lowerNote"),
    upperNote:  document.getElementById("upperNote"),
    noteDur:    document.getElementById("noteDur"),
  };

  let currentIndex = 0;          // индекс выбранного упражнения
  let isPlaying = false;

  // ---------- helpers ----------
  function fillNoteSelect(sel, def){
    const items = [];
    for(let o=2;o<=6;o++){
      for(const n of VPT.NOTE_NAMES){ items.push(`${n}${o}`); }
    }
    sel.innerHTML = "";
    for(const n of items){
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      sel.appendChild(opt);
    }
    sel.value = def;
  }

  function patternByIndex(i){
    const list = VPT.PATTERNS;
    if(!list.length) return null;
    const clamp = Math.max(0, Math.min(i, list.length-1));
    return { obj: list[clamp], idx: clamp };
  }

  function renderExerciseList(){
    els.exerciseList.innerHTML = "";
    VPT.PATTERNS.forEach((p, idx) => {
      const row = document.createElement("div");
      row.className = "exercise-item";
      row.dataset.id = p.id;

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      // инициал — цифра/буква id
      avatar.textContent = String(p.id).slice(0,2);

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = p.name;

      const example = document.createElement("button");
      example.className = "example";
      example.type = "button";
      example.textContent = "▶ пример";
      example.title = "Эталон (заглушка)";
      example.addEventListener("click", (e)=> {
        e.stopPropagation();
        // заглушка — подключим в следующей итерации examples/{id}.mp3
        console.log("play example:", p.id);
      });

      row.appendChild(avatar);
      row.appendChild(title);
      row.appendChild(example);

      row.addEventListener("click", ()=> selectIndex(idx));
      els.exerciseList.appendChild(row);
    });
    highlightActive();
  }

  function highlightActive(){
    [...els.exerciseList.children].forEach((row, idx)=>{
      row.classList.toggle("active", idx === currentIndex);
    });
  }

  function selectIndex(i){
    const res = patternByIndex(i);
    if(!res) return;
    currentIndex = res.idx;
    highlightActive();
    // описание пока пустое (по просьбе) — оставим тире, либо покажем desc если он есть
    const desc = res.obj.desc ? String(res.obj.desc) : "—";
    els.exerciseDesc.textContent = desc;

    // превью графика от стартовой ноты (или A2, если модалка ещё не открывалась)
    const root = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const steps = VPT.buildStepsForRoot(root, els.noteDur.value, res.obj);
    VPT.drawGraph(steps, els.svg);
  }

  function updatePreview(){
    selectIndex(currentIndex);
  }

  // ---------- транспорт ----------
  async function play(){
    const pat = patternByIndex(currentIndex)?.obj;
    if(!pat) return;

    // визуал
    els.btnPlayStop.textContent = "⏹";
    els.btnPlayStop.classList.add("stop");
    isPlaying = true;

    // аудио
    try{
      await VPT.audio.ensure();
      await Tone.start();
    }catch(e){ console.error("Audio load error", e); }

    // фикс первой скорости — BPM до расчётов!
    Tone.Transport.bpm.value = parseInt(els.bpm.value || '90', 10);
    VPT.audio.stop();

    const mode       = els.runMode.value;   // 'single' | 'range'
    const defaultDur = els.noteDur.value;
    const startMidi  = VPT.noteToMidiSafe(els.startNote.value || "A2");
    const lower      = VPT.noteToMidiSafe(els.lowerNote.value || "A2");
    const upper      = VPT.noteToMidiSafe(els.upperNote.value || "G4");

    if(mode === "single"){
      const steps = VPT.buildStepsForRoot(startMidi, defaultDur, pat);
      VPT.drawGraph(steps, els.svg);
      let when = 0;
      for(const st of steps){
        const dur = VPT.durToSeconds(st.durStr);
        Tone.Transport.schedule(t=>{
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);
        when += dur;
      }
      Tone.Transport.scheduleOnce(()=> stop(), `+${when+0.08}`);
      Tone.Transport.start();
      return;
    }

    // range mode — шаг 1 полутон, не выходим за upper
    const maxOff = VPT.patternMaxOffsetSemitones(pat);
    const roots = [];
    for(let r = lower; r + maxOff <= upper; r += 1) roots.push(r);
    if(!roots.length) roots.push(Math.max(lower, upper - maxOff));

    let when = 0;
    for(const root of roots){
      const steps = VPT.buildStepsForRoot(root, defaultDur, pat);
      // перерисовываем график перед каждым подвариантом
      Tone.Transport.schedule(()=>{ VPT.drawGraph(steps, els.svg); }, `+${when}`);
      for(const st of steps){
        const dur = VPT.durToSeconds(st.durStr);
        Tone.Transport.schedule(t=>{
          VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
        }, `+${when}`);
        when += dur;
      }
    }
    Tone.Transport.scheduleOnce(()=> stop(), `+${when+0.08}`);
    Tone.Transport.start();
  }

  function stop(){
    VPT.audio.stop();
    els.btnPlayStop.textContent = "▶️";
    els.btnPlayStop.classList.remove("stop");
    isPlaying = false;
  }

  function next(){
    const total = VPT.PATTERNS.length;
    if(!total) return;
    const wasPlaying = isPlaying;
    if(wasPlaying) stop();
    selectIndex((currentIndex + 1) % total);
    if(wasPlaying) play();
  }

  function prev(){
    const total = VPT.PATTERNS.length;
    if(!total) return;
    const wasPlaying = isPlaying;
    if(wasPlaying) stop();
    selectIndex((currentIndex - 1 + total) % total);
    if(wasPlaying) play();
  }

  // ---------- init ----------
  fillNoteSelect(els.startNote, "A2");
  fillNoteSelect(els.lowerNote, "A2");
  fillNoteSelect(els.upperNote, "G4");

  renderExerciseList();
  selectIndex(0); // выбрать первое

  // события
  els.btnPlayStop.addEventListener("click", ()=> isPlaying ? stop() : play());
  els.btnNext.addEventListener("click", next);
  els.btnPrev.addEventListener("click", prev);

  // модалка
  els.btnSettings.addEventListener("click", ()=>{
    els.settingsModal.classList.remove("hidden");
    els.settingsModal.setAttribute("aria-hidden","false");
  });
  els.btnCloseSettings.addEventListener("click", ()=>{
    els.settingsModal.classList.add("hidden");
    els.settingsModal.setAttribute("aria-hidden","true");
    // при закрытии обновим превью (на случай, что поменяли длительность и т.п.)
    if(!isPlaying) updatePreview();
  });

  // если меняют настройки — обновлять превью на лету, когда не играем
  [els.bpm, els.runMode, els.startNote, els.lowerNote, els.upperNote, els.noteDur].forEach(ctrl=>{
    ctrl.addEventListener("change", ()=> { if(!isPlaying) updatePreview(); });
  });
})();
