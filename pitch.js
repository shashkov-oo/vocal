// pitch.js — real-time питч через ml5 (CREPE), без явного TFJS

(function () {
    const els = {
      btnPitch: document.getElementById("btnPitch"),
      liveNote: document.getElementById("liveNote"),
    };
  
    const NOTE_NAMES = (window.VPT && VPT.NOTE_NAMES) || [
      "C","C#","D","D#","E","F","F#","G","G#","A","A#","B"
    ];
  
    function hzToMidi(hz){ return 69 + 12 * Math.log2(hz / 440); }
    function midiToNote(m){
      const mm = Math.round(m);
      const name = NOTE_NAMES[((mm % 12)+12)%12];
      const oct  = Math.floor(mm/12) - 1;
      return name + oct;
    }
  
    // сглаживание: медиана последних N измерений
    const BUF = []; const N = 5;
    function smooth(hz){
      BUF.push(hz); if (BUF.length > N) BUF.shift();
      const s = [...BUF].sort((a,b)=>a-b);
      return s[Math.floor(s.length/2)];
    }
  
    // ВАЖНО: берём модель из того же релиза ml5
    const MODEL_URL = "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models@main/models/pitch-detection/crepe";
  
  
    let micStream = null, audioCtx = null, detector = null, running = false;
  
    function ensureMl5(){
      return !!(window.ml5 && typeof ml5.pitchDetection === "function");
    }
  
    async function startPitch(){
      if (running) return;
      if (!ensureMl5()) {
        console.error("ml5 not ready:", window.ml5);
        throw new Error("ml5.pitchDetection недоступен. Проверь версию/порядок скриптов.");
      }
  
      // 1) доступ к микрофону (нужно https/localhost)
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
      // 2) отдельный AudioContext (чтобы не конфликтовать с Tone.js)
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // На iOS иногда нужен resume()
      try { await audioCtx.resume(); } catch(_) {}
  
      // 3) инициализация детектора (колбэком — без await/Promise)
      ml5.pitchDetection(MODEL_URL, audioCtx, micStream, (err, model) => {
        if (err || !model) {
          console.error("ml5 model error:", err);
          alert("Не удалось загрузить модель питч-трекера.");
          cleanup();
          return;
        }
        detector = model;
        running = true;
        els.liveNote.textContent = "…";
        loop();
      });
    }
  
    function loop(){
      if (!running || !detector) return;
      detector.getPitch((err, freq) => {
        if (err) { requestAnimationFrame(loop); return; }
  
        if (freq && Number.isFinite(freq)) {
          const f = smooth(freq);
          const midi  = hzToMidi(f);
          const cents = Math.round((midi - Math.round(midi)) * 100);
          els.liveNote.textContent =
            `${midiToNote(midi)} • ${f.toFixed(1)} Hz • ${cents>=0?`+${cents}`:cents}¢`;
        } else {
          els.liveNote.textContent = "…";
        }
        requestAnimationFrame(loop);
      });
    }
  
    function cleanup(){
      try { if (audioCtx) audioCtx.close(); } catch(_) {}
      audioCtx = null;
      if (micStream) {
        try { micStream.getTracks().forEach(t => t.stop()); } catch(_) {}
        micStream = null;
      }
      detector = null; running = false; BUF.length = 0;
      els.liveNote.textContent = "…";
    }
  
    els.btnPitch.addEventListener("click", async () => {
      if (!running) {
        els.btnPitch.disabled = true;
        els.btnPitch.textContent = "⏳ Включаем…";
        try {
          await startPitch();
          els.btnPitch.textContent = "⏹ Выключить";
        } catch (e) {
          console.error(e);
          alert("Не удалось включить питч-трекер. Проверьте доступ к микрофону и что страница открыта по https/localhost.");
          els.btnPitch.textContent = "🎤 Включить питч-трекер";
        } finally {
          els.btnPitch.disabled = false;
        }
      } else {
        cleanup();
        els.btnPitch.textContent = "🎤 Включить питч-трекер";
      }
    });
  
    window.addEventListener("beforeunload", cleanup);
  })();
  