// Global namespace
window.VPT = window.VPT || {};

/** Общие нотационные утилиты */
VPT.NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
VPT.NAME_TO_SEMITONE = Object.fromEntries(VPT.NOTE_NAMES.map((n,i)=>[n,i]));

VPT.noteToMidiSafe = function(note){
  const raw = String(note);
  const s = raw.trim().replace(/♯/g, "#").replace(/♭/g, "b");
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(s);
  if(!m){ console.warn("PARSE_FAIL", {raw, s}); return 60; }
  let name = m[1].toUpperCase();
  const acc = m[2];
  const oct = parseInt(m[3],10);
  const flats = { Cb:"B", Db:"C#", Eb:"D#", Fb:"E", Gb:"F#", Ab:"G#", Bb:"A#" };
  if(acc==="b"){ name = flats[name+"b"] || (name+"b"); }
  else if(acc==="#"){ name = name+"#"; }
  const idx = VPT.NAME_TO_SEMITONE[name];
  if(idx===undefined){ console.warn("SEMITONE_FAIL", {name, raw}); return 60; }
  return idx + (oct + 1) * 12;
};
VPT.midiToNote = function(m){
  const name = VPT.NOTE_NAMES[((m%12)+12)%12];
  const oct = Math.floor(m/12)-1;
  return name + oct;
};

VPT.MAJOR_STEPS = [0,2,4,5,7,9,11];
VPT.degMajor = function(n){
  const within = ((n-1)%7+7)%7;
  const octs = Math.floor((n-1)/7);
  return VPT.MAJOR_STEPS[within] + 12*octs;
};

/** строчные длительности → секунды / биты (зависит от текущего BPM в Tone.Transport) */
VPT.durToSeconds = function(s){
  const str = String(s);
  if(str.includes("*")){ const [b,k]=str.split("*"); return Tone.Time(b).toSeconds()*parseFloat(k); }
  return Tone.Time(str).toSeconds();
};
VPT.durToBeats = function(s){
  const str = String(s);
  const mult = str.includes('*') ? parseFloat(str.split('*')[1]) : 1;
  const base = str.split('*')[0];
  const map = { '16n':0.25,'8n':0.5,'4n':1,'2n':2,'1n':4 };
  return (map[base] ?? 1) * mult;
};

/** Описание паттернов (поддержка пер-нотных dur и repeat) */
VPT.PATTERNS = [
  { id:"1",  name:"1 трель (губами бр)",              type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"Следите за тем, чтобы пальцы оставались на щеках. Губы должны двигаться легко и равномерно, не слишком быстро Когда губы работают быстро, они напрягаются Чувствуете, как резонансные ощущения переходят в затылочную часть головы Вы также ощущаете связанные звукоизвлечения при движении от грудного голоса к головному Думайте не о нотах, а о треле, которую делают губы Теперь ваша очередь Начинают басы Теперь теноры Теперь меццо и альто Меццо-сопрано и альто" }, //150 bpm
  { id:"2",  name:"2 трель (языком р)",               type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"2 3:30" }, 
  { id:"3",  name:"3 трель (губами бр) скачки",       type:"semitone", data:[0,7,4,12,7,4,0,7,4,12,7,4,0], desc:"3 7:20" },
  { id:"4",  name:"4 трель (языком р) скачки",        type:"semitone", data:[0,7,4,12,7,4,0,7,4,12,7,4,0], desc:"4 10:10" },
  { id:"5",  name:"5 ней-ней-ней-ней",                type:"degree",   data:[1,3,5,8,8,8,8,5,3,1], desc:"5 12:52" },
  { id:"6",  name:"6 ней-ней-ней-ней",                type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"6 15:10" },
  { id:"7",  name:"7 ма-ма-ма-ма плаксиво",           type:"degree",   data:[1,3,5,8,8,8,8,5,3,1], desc:"7 17:53" },
  { id:"8",  name:"8 ма-ма-ма-ма",                    type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"8 20:36" },
  { id:"9",  name:"9 о-о-о-о-о-о-о-о-о",              type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"9 23:35" },
  { id:"10", name:"10 а-а-а-ааааааааа-а-а-а-а",        type:"degree",   data:[ {d:1},{d:3},{d:5},{d:8, dur:"1n"},{d:5},{d:3},{d:1} ], desc:"10 e" },
  { id:"11", name:"11 и-и-и-и-и",                      type:"semitone", data:[0,7,4,12,7,4,0,7,4,12,7,4,0], desc:"11 d 32 min" },
  { id:"15", name:"15 у-ы закрытый рот",               type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"15 35:40" },
  { id:"17", name:"17 хм-м-м-м закрытый рот",          type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"17 43:17" },
  { id:"18", name:"18 хм-м-м-м закрытый рот длинный пик", type:"semitone", data:[{d:0},{d:4},{d:7},{d:12},{d:16},{d:19, dur:"1n"},{d:17},{d:14},{d:11},{d:7},{d:5},{d:2},{d:0}], desc:"18 46:40" },
  { id:"19", name:"19 м-м-м-м закрытый рот",           type:"semitone", data:[0,7,4,12,7,4,0,7,4,12,7,4,0], desc:"19 50:46" },
  { id:"20", name:"20 м-м-м-м-мммммааааа-а-а-а",       type:"degree",   data:[1,3,5,8,5,3,1], desc:"20 53:56" },
  { id:"21", name:"21 о-о-о вниз/вверх, длинный пик",  type:"degree",   data:[{d:8},{d:5},{d:3},{d:1},{d:3},{d:5},{d:8},{d:5},{d:3},{d:1},{d:3},{d:5},{d:8, dur:"1n"},{d:5},{d:3},{d:1}], desc:"21 56:45" },
  { id:"22", name:"22 а-а-а-а",                         type:"semitone", data:[0,7,4,12,7,4,0,7,4,12,7,4,0], desc:"22 1:01:30" },
  { id:"23", name:"23 о-о-о-о-а?",                      type:"degree",   data:[{d:1},{d:3},{d:5},{d:8, dur:"1n"},{d:5},{d:3},{d:1}], desc:"23 1:02:32" },
  { id:"24", name:"24 и-и-и-иииии-ууууу-ааааа-а-а-а",  type:"degree",   data:[{d:1},{d:3},{d:5},{d:8, dur:"1n"},{d:8, dur:"1n"},{d:8, dur:"1n"},{d:5},{d:3},{d:1}], desc:"24 1:03:25" },
  { id:"25", name:"25 о-а колебания +- полтона",       type:"semitone", data:[{d:5, dur:"1n"},{d:4, dur:"1n"},{d:3, dur:"1n"},{d:2, dur:"1n"},{d:1, dur:"1n"}], desc:"25 1:04:48" },
  { id:"26", name:"26 а",                               type:"semitone", data:[0,4,7,12,16,19,17,14,11,7,5,2,0], desc:"26 1:05:06" }
];

VPT.patternLabel = function(p){
  if(p.type==="degree"){
    return p.data.map(d=>{
      const v = (typeof d==='number') ? d : (d.d ?? d.v);
      const mark = v>7 ? (((v-1)%7)+1)+"↑" : v;
      const rpt = (typeof d==='object' && d.repeat>1) ? `×${d.repeat}` : "";
      return `${mark}${rpt}`;
    }).join(" – ");
  }
  return p.data.map(s=>{
    const v=(typeof s==='number')?s:(s.s??s.v);
    return v>=0?`+${v}`:`${v}`;
  }).join("  ");
};

/** Разворачиваем data в массив шагов с конкретной длительностью */
VPT.expandPatternSteps = function(pattern, defaultDurStr){
  const steps = [];
  for(const item of pattern.data){
    if(typeof item === 'number'){
      steps.push({ kind: pattern.type, v: item, dur: defaultDurStr });
    } else {
      const val = (item.d ?? item.s ?? item.v);
      const repeat = Math.max(1, item.repeat || 1);
      const dur = item.dur || defaultDurStr;
      for(let i=0;i<repeat;i++){
        steps.push({ kind: pattern.type, v: val, dur });
      }
    }
  }
  return steps;
};

/** Ступень/полутон -> абсолютный MIDI */
VPT.toMidiFromStep = function(baseMidi, step){
  if(step.kind === 'degree') return baseMidi + VPT.degMajor(step.v);
  return baseMidi + step.v;
};

/** Построить шаги для конкретного корня */
VPT.buildStepsForRoot = function(rootMidi, defaultDurStr, pattern){
  const steps = VPT.expandPatternSteps(pattern, defaultDurStr).map(st => ({
    midi: VPT.toMidiFromStep(rootMidi, st),
    durStr: st.dur,
    beats: VPT.durToBeats(st.dur)
  }));
  return steps;
};

/** Максимальное отклонение вверх в полутонов для данного паттерна */
VPT.patternMaxOffsetSemitones = function(pattern){
  const rel = VPT.expandPatternSteps(pattern, "8n");
  const offs = rel.map(st => st.kind==='degree' ? VPT.degMajor(st.v) : st.v);
  return Math.max(...offs);
};
