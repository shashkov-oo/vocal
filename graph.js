window.VPT = window.VPT || {};

VPT.drawGraph = function(steps, svgEl){
  if(!steps.length){ svgEl.innerHTML=''; return; }

  const gutter=64, pxPerBeat=80, height=260;
  const totalBeats = steps.reduce((a,s)=>a + (s.beats||0.5), 0);
  const contentW = Math.max(600, Math.max(1,totalBeats) * pxPerBeat);
  const width = gutter + contentW;

  const midis = steps.map(s=>s.midi);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);

  function yForMidi(m){
    const pad=10, usable=height-pad*2;
    const norm=(m-minMidi)/Math.max(1,(maxMidi-minMidi));
    return height-(norm*usable+pad);
  }

  svgEl.setAttribute('width', width);
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.innerHTML = '';

  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('x','0'); bg.setAttribute('y','0');
  bg.setAttribute('width',width); bg.setAttribute('height',height);
  bg.setAttribute('fill','#0f172a'); svgEl.appendChild(bg);

  const sep=document.createElementNS('http://www.w3.org/2000/svg','line');
  sep.setAttribute('x1',gutter); sep.setAttribute('x2',gutter);
  sep.setAttribute('y1',0); sep.setAttribute('y2',height);
  sep.setAttribute('stroke','#334155'); sep.setAttribute('stroke-width','1');
  svgEl.appendChild(sep);

  const uniq=[...new Set(midis)].sort((a,b)=>b-a);
  for(const m of uniq){
    const y=yForMidi(m);
    const gl=document.createElementNS('http://www.w3.org/2000/svg','line');
    gl.setAttribute('x1',gutter); gl.setAttribute('x2',width);
    gl.setAttribute('y1',y); gl.setAttribute('y2',y);
    gl.setAttribute('class','gridline'); svgEl.appendChild(gl);
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x',gutter-10); label.setAttribute('y',y+4);
    label.setAttribute('fill','#94a3b8'); label.setAttribute('font-size','11');
    label.setAttribute('text-anchor','end'); label.textContent=VPT.midiToNote(m);
    svgEl.appendChild(label);
  }

  let x=gutter; let d=`M${x},${yForMidi(steps[0].midi)}`;
  for(let i=0;i<steps.length;i++){
    const w=(steps[i].beats||0.5)*pxPerBeat;
    const y=yForMidi(steps[i].midi);
    d+=`L${x+w},${y}`; x+=w;
    if(i<steps.length-1){ d+=`L${x},${yForMidi(steps[i+1].midi)}`; }
  }
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',d.trim());
  path.setAttribute('fill','none');
  path.setAttribute('stroke','#38bdf8');
  path.setAttribute('stroke-width','3');
  svgEl.appendChild(path);
};
