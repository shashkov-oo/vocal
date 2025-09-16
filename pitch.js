// pitch.js — CREPE (ml5) c автопоиском рабочей модели, кнопкой #btnPitch,
// выводом в #liveNote и зелёной линией на графике (VPT.setLivePitch)

(function () {
  const btn = document.getElementById("btnPitch");
  const out = document.getElementById("liveNote");

  let audioCtx = null;
  let stream = null;
  let detector = null;
  let raf = 0;
  let on = false;

  // Порядок важен: сначала официальный GitHub CDN с моделями,
  // затем два «зеркала» из npm-пакета (иногда у них меняется содержимое/кэш).
  const MODEL_BASES = [
    "https://cdn.jsdelivr.net/gh/ml5js/ml5-data-and-models/models/pitch-detection/crepe",
    "https://unpkg.com/ml5@0.12.2/dist/models/pitch-detection/crepe",
    "https://cdn.jsdelivr.net/npm/ml5@0.12.2/dist/models/pitch-detection/crepe",
  ];

  const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const midiName = (m) => `${NOTE_NAMES[((m%12)+12)%12]}${Math.floor(m/12)-1}`;

  function freqToMidiCents(freq) {
    if (!Number.isFinite(freq) || freq <= 0) return null;
    const m = 69 + 12 * Math.log2(freq / 440);
    const mr = Math.round(m);
    const cents = Math.round((m - mr) * 100);
    return { midi: m, round: mr, cents };
  }

  function ui(state) {
    on = state;
    if (btn) btn.textContent = state ? "⏹ Выключить" : "🎤 Включить питч-трекер";
  }
  function write(s) { if (out) out.textContent = s; }
  function setLive(f0) {
    if (window.VPT && typeof VPT.setLivePitch === "function") VPT.setLivePitch(f0);
  }

  function loop() {
    if (!on || !detector) return;
    detector.getPitch((err, f) => {
      if (!on) return;
      if (err) { raf = requestAnimationFrame(loop); return; }
      if (Number.isFinite(f) && f > 0) {
        const fm = freqToMidiCents(f);
        if (fm) {
          write(`${midiName(fm.round)} · ${f.toFixed(1)} Hz · ${fm.cents >= 0 ? "+" : ""}${fm.cents}¢`);
        } else {
          write("—");
        }
        setLive(f);
      } else {
        write("—");
        setLive(null);
      }
      raf = requestAnimationFrame(loop);
    });
  }

  // Загружаем детектор, перебирая кандидаты моделей
  async function createDetectorWithFallback(ctx, micStream) {
    let lastErr = null;
    for (const base of MODEL_BASES) {
      try {
        // ВАЖНО: base БЕЗ завершающего "/", ml5 сам добавляет "/model.json"
        await new Promise((resolve, reject) => {
          const d = ml5.pitchDetection(base, ctx, micStream, (e) => e ? reject(e) : resolve());
          // если дошли до resolve — вернём d наружу
          if (!eGuarded(d)) resolve(d);
        });
        // ml5 конструктора не возвращает инстанс напрямую — достанем из замыкания
        // поэтому повторим вызов, но теперь уже синхронно вернём объект:
        return await new Promise((resolve, reject) => {
          const d2 = ml5.pitchDetection(base, ctx, micStream, (e) => e ? reject(e) : resolve(d2));
        });
      } catch (e) {
        lastErr = e;
        // пробуем следующую базу
      }
    }
    throw lastErr || new Error("Не удалось загрузить модель CREPE");
  }

  // страховка от странного поведения некоторых сборок ml5,
  // когда d может быть undefined на самой первой инициализации
  function eGuarded(x){ return x && typeof x.getPitch === "function"; }

  async function start() {
    if (on) return;
    try {
      // Микрофон
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
          channelCount: 1, sampleRate: 44100
        }
      });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();

      // Детектор с fallback по URL модели
      detector = await createDetectorWithFallback(audioCtx, stream);

      ui(true); write("…"); loop();
    } catch (e) {
      console.error("Pitch start error:", e);
      alert("Не удалось включить питч-трекер. Проверьте доступ к микрофону (https/localhost) и обновите страницу с очисткой кэша.");
      stop();
    }
  }

  function stop() {
    on = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (detector && detector.model && detector.model.dispose) { try { detector.model.dispose(); } catch (_) {} }
    detector = null;
    if (stream) { try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} stream = null; }
    if (audioCtx) { try { audioCtx.close(); } catch (_) {} audioCtx = null; }
    setLive(null); write(""); ui(false);
  }

  if (btn) btn.addEventListener("click", () => on ? stop() : start());

  // экспорт для дебага
  window.PitchTracker = { start, stop, get running() { return on; } };
})();
