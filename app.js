// Собираем UI, режимы, проигрывание и график
(function(){
    const els = {
      lowerNote: document.getElementById('lowerNote'),
      startNote: document.getElementById('startNote'),
      upperNote: document.getElementById('upperNote'),
      runMode:   document.getElementById('runMode'),
      bpm:       document.getElementById('bpm'),
      noteDur:   document.getElementById('noteDur'),
      svg:       document.getElementById('svg'),
      noteList:  document.getElementById('noteList'),
      btnPlay:   document.getElementById('btnPlay'),
      btnStop:   document.getElementById('btnStop'),
      patternSelect: document.getElementById('patternSelect'),
      patternDesc:   document.getElementById('patternDesc'),
      patternMode:   document.getElementById('patternMode'),
      soundStatus:   document.getElementById('soundStatus'),
    };
  
    // ==== UI helpers ====
    function fillNoteSelect(sel, defaultVal){
      const items=[];
      for(let o=2;o<=6;o++){ for(const n of VPT.NOTE_NAMES){ items.push(`${n}${o}`); } }
      sel.innerHTML='';
      for(const n of items){ const opt=document.createElement('option'); opt.value=n; opt.textContent=n; sel.appendChild(opt); }
      sel.value = defaultVal;
    }
    function fillPatterns(){
      for(const p of VPT.PATTERNS){
        const opt = document.createElement('option');
        opt.value = p.id; opt.textContent = p.name;
        els.patternSelect.appendChild(opt);
      }
      els.patternSelect.value = VPT.PATTERNS[VPT.PATTERNS.length-1].id; // X по умолчанию
      updatePatternMeta();
    }
    function updatePatternMeta(){
      const p = VPT.PATTERNS.find(x => x.id === els.patternSelect.value);
      els.patternDesc.textContent = p.desc || '';
      els.patternMode.textContent = (p.type === "semitone") ? "Semitone offsets" : "Diatonic degrees";
    }
  
    fillNoteSelect(els.lowerNote, 'A2');
    fillNoteSelect(els.startNote, 'A2');
    fillNoteSelect(els.upperNote, 'G4');
    fillPatterns();
  
    // Начальная отрисовка для стартовой
    function renderForRoot(rootMidi){
      const pattern = VPT.PATTERNS.find(p=>p.id===els.patternSelect.value);
      const steps = VPT.buildStepsForRoot(rootMidi, els.noteDur.value, pattern);
      VPT.drawGraph(steps, els.svg);
      els.noteList.textContent = steps.map(s=>VPT.midiToNote(s.midi)).join(' · ');
    }
    renderForRoot(VPT.noteToMidiSafe(els.startNote.value));
  
    // ====== события UI ======
    els.startNote.addEventListener('change', ()=> renderForRoot(VPT.noteToMidiSafe(els.startNote.value)));
    els.noteDur.addEventListener('change',  ()=> renderForRoot(VPT.noteToMidiSafe(els.startNote.value)));
    els.patternSelect.addEventListener('change', ()=> { updatePatternMeta(); renderForRoot(VPT.noteToMidiSafe(els.startNote.value)); });
  
    // ====== проигрывание ======
    els.btnPlay.addEventListener('click', async ()=>{
      els.btnPlay.disabled = true; els.btnStop.disabled = false;
  
      // загрузка/старт аудио
      try{
        els.soundStatus.textContent = "Загрузка пианино…";
        await VPT.audio.ensure();
        await Tone.start();
        els.soundStatus.textContent = "Готово";
      }catch(e){
        els.soundStatus.textContent = "Ошибка загрузки";
        console.error(e);
      }
  
      // фикс «первая быстрее»: ставим BPM до любых Time(...).toSeconds()
      Tone.Transport.bpm.value = parseInt(els.bpm.value || '90', 10);
  
      const mode = els.runMode.value; // 'single' | 'range'
      const pattern = VPT.PATTERNS.find(p=>p.id===els.patternSelect.value);
      const defaultDur = els.noteDur.value;
  
      // остановим всё, что могло висеть
      VPT.audio.stop();
  
      if(mode === 'single'){
        const root = VPT.noteToMidiSafe(els.startNote.value);
        const steps = VPT.buildStepsForRoot(root, defaultDur, pattern);
  
        // сразу показать текущий вариант
        VPT.drawGraph(steps, els.svg);
        els.noteList.textContent = steps.map(s=>VPT.midiToNote(s.midi)).join(' · ');
  
        let when = 0;
        for(const st of steps){
          const dur = VPT.durToSeconds(st.durStr);
          Tone.Transport.schedule(t=>{
            VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
          }, `+${when}`);
          when += dur;
        }
        Tone.Transport.scheduleOnce(()=> { VPT.audio.stop(); els.btnStop.disabled=true; els.btnPlay.disabled=false; }, `+${when+0.08}`);
        Tone.Transport.start();
        return;
      }
  
      // режим диапазона
      const lower = VPT.noteToMidiSafe(els.lowerNote.value);
      const upper = VPT.noteToMidiSafe(els.upperNote.value);
      const maxOff = VPT.patternMaxOffsetSemitones(pattern);
  
      const roots = [];
      for(let root=lower; root + maxOff <= upper; root += 1) roots.push(root);
      if(!roots.length){ roots.push(Math.max(lower, upper - maxOff)); }
  
      let when = 0;
      for(const root of roots){
        const steps = VPT.buildStepsForRoot(root, defaultDur, pattern);
  
        // динамически обновляем график/список ровно перед началом текущего «шага»
        const renderAt = when;
        Tone.Transport.schedule(()=>{
          VPT.drawGraph(steps, els.svg);
          els.noteList.textContent = steps.map(s=>VPT.midiToNote(s.midi)).join(' · ');
        }, `+${renderAt}`);
  
        for(const st of steps){
          const dur = VPT.durToSeconds(st.durStr);
          Tone.Transport.schedule(t=>{
            VPT.audio.get().triggerAttackRelease(VPT.midiToNote(st.midi), dur, t, 0.9);
          }, `+${when}`);
          when += dur;
        }
      }
  
      Tone.Transport.scheduleOnce(()=> { VPT.audio.stop(); els.btnStop.disabled=true; els.btnPlay.disabled=false; }, `+${when+0.08}`);
      Tone.Transport.start();
    });
  
    els.btnStop.addEventListener('click', ()=>{
      VPT.audio.stop();
      els.btnStop.disabled = true; els.btnPlay.disabled = false;
    });
  })();
  