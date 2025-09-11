window.VPT = window.VPT || {};

VPT.drawGraph = function(steps, svgEl) {
  if (!steps || !steps.length) { svgEl.innerHTML = ""; return; }

  // Геометрия
  const height = 260;
  const gutterY = 10;
  const yUsable = height - gutterY * 2;
  const leftGutter = 64;              // левое поле под подписи нот

  // общая длительность в «долях» (beats), нужна и для масштаба X, и для вертикальных линий
  const totalBeats = steps.reduce((a, s) => a + (s.beats || 0.5), 0);

  // Ширина контейнера — делаем график без горизонтального скролла
  const containerW = svgEl.parentElement.getBoundingClientRect().width || 900;
  const width = Math.max(containerW, 300);   // минимальная ширина, если контейнер очень узкий
  const xUsable = Math.max(1, width - leftGutter);
  const pxPerBeat = xUsable / Math.max(0.001, totalBeats);

  // Ноты по Y
  const midis = steps.map(s => s.midi);
  const minMidi = Math.min(...midis);
  const maxMidi = Math.max(...midis);
  const yForMidi = (m) => {
    const norm = (m - minMidi) / Math.max(1, (maxMidi - minMidi));
    return height - (norm * yUsable + gutterY);
  };

  // Подготовка SVG
  svgEl.setAttribute('width', width);
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.innerHTML = '';

  // Фон
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
  bg.setAttribute('width', width); bg.setAttribute('height', height);
  bg.setAttribute('fill', '#0f172a'); svgEl.appendChild(bg);

  // Разделитель слева
  const sep = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  sep.setAttribute('x1', leftGutter); sep.setAttribute('x2', leftGutter);
  sep.setAttribute('y1', 0); sep.setAttribute('y2', height);
  sep.setAttribute('stroke', '#334155'); sep.setAttribute('stroke-width', '1');
  svgEl.appendChild(sep);

  // Горизонтальные линии + подписи нот (уникальные высоты)
  const uniqMidis = [...new Set(midis)].sort((a, b) => b - a);
  for (const m of uniqMidis) {
    const y = yForMidi(m);
    const gl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gl.setAttribute('x1', leftGutter); gl.setAttribute('x2', width);
    gl.setAttribute('y1', y); gl.setAttribute('y2', y);
    gl.setAttribute('stroke', '#334155'); gl.setAttribute('stroke-dasharray', '4 6');
    svgEl.appendChild(gl);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', leftGutter - 10); label.setAttribute('y', y + 4);
    label.setAttribute('fill', '#94a3b8'); label.setAttribute('font-size', '11');
    label.setAttribute('text-anchor', 'end');
    label.textContent = VPT.midiToNote(m); svgEl.appendChild(label);
  }

  // Вертикальные линии долей/тактов по X
  // Считаем целые биты и ставим сетку с подписями 1,2,3...
  const beatCount = Math.max(1, Math.ceil(totalBeats));
  for (let b = 0; b <= beatCount; b++) {
    const x = leftGutter + b * pxPerBeat;
    const vl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vl.setAttribute('x1', x); vl.setAttribute('x2', x);
    vl.setAttribute('y1', 0); vl.setAttribute('y2', height);
    vl.setAttribute('stroke', '#1f2a3a'); vl.setAttribute('stroke-dasharray', '2 8');
    svgEl.appendChild(vl);

    if (b > 0) {
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', x + 4); txt.setAttribute('y', 14);
      txt.setAttribute('fill', '#94a3b8'); txt.setAttribute('font-size', '10');
      txt.textContent = String(b); svgEl.appendChild(txt);
    }
  }

  // Линия мелодии (прямоугольными участками по длительностям)
  let x = leftGutter;
  let d = `M${x},${yForMidi(steps[0].midi)}`;
  for (let i = 0; i < steps.length; i++) {
    const w = (steps[i].beats || 0.5) * pxPerBeat;
    const y = yForMidi(steps[i].midi);
    d += `L${x + w},${y}`;  // горизонтальный отрезок (длительность ноты)
    x += w;
    if (i < steps.length - 1) {
      d += `L${x},${yForMidi(steps[i + 1].midi)}`; // вертикальный переход к следующей ноте
    }
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d.trim());
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#38bdf8');
  path.setAttribute('stroke-width', '3');
  svgEl.appendChild(path);
};
