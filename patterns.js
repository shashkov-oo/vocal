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
  const map = { '16n':0.25,'8n':0.5,'4n':1,'2n':2,'1n':4, '3n':3 };
  return (map[base] ?? 1) * mult;
};

/** Описание паттернов (поддержка пер-нотных dur и repeat) + прелюдии */
VPT.PATTERNS = [
  { id:"1",  name:"пассаж губами", bpm:150, type:"semitone",
    noteDuration:"8n",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}]
  },
  { id:"2",  name:"трель (языком р)", bpm:120, type:"semitone",
    noteDuration:"8n",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}]
  },
  { id:"3",  name:"пассаж губами", bpm:150, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    noteDuration:"8n",
    data:[0,7,4,12,7,4,{d:0, dur:"2n"}]
  },
  { id:"4",  name:"трель языком", bpm:120, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    noteDuration:"8n",
    data:[0,7,4,12,7,4,{d:0, dur:"2n"}]
  },
  { id:"5",  name:"nay", bpm:120, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    noteDuration:"8n",
    data:[1,3,5,8,8,8,8,5,3,{d:1, dur:"2n"}], desc:"5 12:52"
  },
  { id:"6",  name:"nay", bpm:100, type:"semitone",
    prelude:{ enabled:true, mode:'playSecond', rootMs:350, triadMs:600 },
    noteDuration:"8n",
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"6 15:10"
  },
  { id:"7",  name:"mum \\ guh \\ go \\ gee \\ koo", bpm:100, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[1,3,5,8,8,8,8,5,3,{d:1, dur:"2n"}], desc:"7 17:53"
  },
  { id:"8",  name:"mum \\ guh \\ go \\ gee \\ koo", bpm:130, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"8 20:36"
  },
  { id:"9",  name:"oo \\ oh \\ uh \\ ee \\ ah", bpm:130, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"9 23:35"
  },
  { id:"10", name:"oo \\ oh \\ uh \\ ee \\ ah", bpm:90, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[ 1,3,5,{d:8, dur:"2n"},5,3,{d:1, dur:"2n"} ], desc:"10 e"
  },
  { id:"11", name:"oo \\ oh \\ uh \\ ee \\ ah", bpm:110, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,7,4,12,7,4,0,7,4,12,7,4,{d:0, dur:"2n"}], desc:"11 d 32 min"
  },
  { id:"12", name:"wee \\ gee", bpm:110, type:"semitone",
    noteDuration:"4n",
    prelude:{ enabled:true, mode:'playSecond', rootMs:350, triadMs:600 },
    data:[8,5,3,{d:1, dur:"2n"}], desc:"11 d 32 min"
  },
  { id:"13", name:"wee \\ gee", bpm:110, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"11 d 32 min"
  },
  
  { id:"14", name:"mm", bpm:90, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,12], desc:"у-ы"
  },
  { id:"15", name:"mm-m mm-m mm-m mm-m m", bpm:90, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    microPause:{ every:3, ms:100 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"15 35:40"
  },
  { id:"16", name:"mmm mmm mmm mmm m", bpm:90, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    microPause:{ every:3, ms:100 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"15 35:40"
  },
  { id:"17", name:"mm", bpm:110, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"17 43:17"
  },
  { id:"18", name:"mm ", bpm:110, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,{d:19, dur:"1n"},17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"18 46:40"
  },
  { id:"19", name:"mm", bpm:110, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,7,4,12,7,4,0,7,4,12,7,4,{d:0, dur:"2n"}], desc:"19 50:46"
  },
  { id:"20", name:"mm oo \\ oh \\ uh \\ ee \\ ah", bpm:90, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[1,3,5,{d:8, dur:"1n"},5,3,{d:1, dur:"2n"} ], desc:"10 e"
  },
  { id:"21", name:"oo \\ oh \\ uh \\ ee \\ ah", bpm:120, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[8,5,3,1,3,5,8,5,3,1,3,5,{d:8, dur:"2n"},5,3,{d:1, dur:"2n"}], desc:"21 56:45"
  },
  { id:"22", name:"oo \\ oh \\ uh \\ ee \\ ah", bpm:120, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,7,4,12,7,4,0,7,4,12,7,4,{d:0, dur:"2n"}], desc:"22 1:01:30"
  },
  { id:"23", name:"oo oh \\ uh ah \\ ee ay \\ oh ah", bpm:80, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[1,3,5,{d:8, dur:"1n"},5,3,{d:1, dur:"2n"}], desc:"23 1:02:32"
  },
  { id:"24", name:"oo oh ah \\ ee oo uh \\ oo (foot) uh ah", bpm:90, type:"degree",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[1,3,5,{d:8, dur:"2n"},{d:8, dur:"2n"},{d:8, dur:"2n"},5,3,{d:1, dur:"2n"}], desc:"24 1:03:25"
  },
  { id:"25", name:"oo uh \\ oo oh \\ ee ay", bpm:90, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[{d:5, dur:"2n"},{d:4, dur:"2n"},{d:3, dur:"2n"},{d:2, dur:"2n"},{d:1, dur:"2n"}], desc:"25 1:04:48"
  },
  { id:"26", name:"ah \\ ay \\ ee \\ oh \\ a (eat) \\ oo \\ oo (foot)", bpm:120, type:"semitone",
    prelude:{ enabled:true, mode:'root_triad', rootMs:350, triadMs:600 },
    data:[0,4,7,12,16,19,17,14,11,7,5,2,{d:0, dur:"2n"}], desc:"26 1:05:06"
  }
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
  // Новое: если у упражнения указана общая длительность,
  // она перекрывает внешнее значение defaultDurStr из UI
  const baseDur = pattern && pattern.noteDuration ? pattern.noteDuration : defaultDurStr;

  const steps = [];
  for (const item of pattern.data) {
    if (typeof item === 'number') {
      steps.push({ kind: pattern.type, v: item, dur: baseDur });
    } else {
      const val    = (item.d ?? item.s ?? item.v);
      const repeat = Math.max(1, item.repeat || 1);
      // Персональная длительность конкретной ноты по-прежнему главнее
      const dur = item.dur || baseDur;
      for (let i = 0; i < repeat; i++) {
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
