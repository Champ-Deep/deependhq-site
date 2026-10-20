/**
 * Activity Terrain, adapted from Kokonut UI by @dorianbaffier.
 * MIT. https://kokonutui.com/r/activity-terrain.json
 * Retains projection, face geometry and polygon hit testing. Replaces demo
 * data, springs and Tailwind with the real log and a finite sleeping wave.
 */
import { useEffect, useRef, useState } from 'react';
const GAP = 0.18;
function project(pose, x, y, z) {
  const cos = Math.cos(pose.yaw);
  const sin = Math.sin(pose.yaw);
  const xr = x * cos - z * sin;
  const zr = x * sin + z * cos;
  return [
    pose.cx + xr * pose.scale,
    pose.cy + (zr * Math.cos(pose.pitch) - y * Math.sin(pose.pitch)) * pose.scale
  ];
}
function visibleFaces(pose, x0, z0, h) {
  const x1 = x0 + 1 - GAP;
  const z1 = z0 + 1 - GAP;
  const p = (x, y, z) => project(pose, x, y, z);
  const faces = [];
  const sin = Math.sin(pose.yaw);
  const cos = Math.cos(pose.yaw);
  if (h > 0.02 && pose.pitch > 0.01) {
    if (cos > 0) {
      faces.push({
        points: [p(x0, 0, z1), p(x1, 0, z1), p(x1, h, z1), p(x0, h, z1)],
        tone: 0.22
      });
    } else {
      faces.push({
        points: [p(x0, 0, z0), p(x1, 0, z0), p(x1, h, z0), p(x0, h, z0)],
        tone: 0.22
      });
    }
    if (sin > 1e-3) {
      faces.push({
        points: [p(x1, 0, z0), p(x1, 0, z1), p(x1, h, z1), p(x1, h, z0)],
        tone: 0.38
      });
    } else if (sin < -1e-3) {
      faces.push({
        points: [p(x0, 0, z0), p(x0, 0, z1), p(x0, h, z1), p(x0, h, z0)],
        tone: 0.38
      });
    }
  }
  faces.push({
    points: [p(x0, h, z0), p(x1, h, z0), p(x1, h, z1), p(x0, h, z1)],
    tone: 0
  });
  return faces;
}
function inside(points, x, y) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}
function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
}

const KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
const dateAt = (start, i) => new Date(Date.parse(start) + i * 864e5).toISOString().slice(0, 10);

export default function Terrain({ d, k, rows, start, end, peak }) {
  const canvasRef = useRef(null);
  const engine = useRef(null);
  const latest = rows.findLastIndex(Boolean);
  const [selected, setSelected] = useState(latest);
  const [flat, setFlat] = useState(false);
  const [forced, setForced] = useState(false);
  const active = rows[selected];
  const choose = (i) => { setSelected(i); engine.current?.select(i); };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const max = Math.max(1, ...d);
    const offset = (new Date(start).getUTCDay() + 6) % 7;
    const cells = d.map((count, index) => ({ index, col: Math.floor((index + offset) / 7), row: (index + offset) % 7, height: count / max * 4.2 }));
    const weeks = cells.at(-1).col + 1;
    const mobile = matchMedia('(max-width: 767px)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0, height = 0, raf = 0, began = 0, progress = 0;
    let onScreen = false, visible = false, isFlat = false, userFlat = false;
    let yaw = 18 * Math.PI / 180, selectedIndex = latest, faces = [], drag = null;
    let palette = {};
    function readPalette() {
      const cs = getComputedStyle(canvas);
      palette = Object.fromEntries(['build', 'think', 'win', 'card-2', 'text', 'line-2'].map(n => [n, cs.getPropertyValue('--' + n).trim()]));
    }
    function draw() {
      if (!width) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const lift = isFlat ? 0 : progress;
      const pose = { yaw: isFlat ? 0 : yaw * lift, pitch: 56 * Math.PI / 180 * lift, scale: 1, cx: 0, cy: 0 };
      const corners = [];
      for (const x of [-weeks / 2, weeks / 2]) for (const z of [-3.5, 3.5]) for (const y of [0, 4.2 * lift]) corners.push(project(pose, x, y, z));
      const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      pose.scale = Math.min((width - 32) / (maxX - minX), (height - 40) / Math.max(1, maxY - minY));
      pose.cx = width / 2 - (minX + maxX) / 2 * pose.scale;
      pose.cy = height / 2 - (minY + maxY) / 2 * pose.scale;
      const ordered = [...cells].sort((a,b) => (a.col-b.col) * Math.sin(pose.yaw) + (a.row-b.row) * Math.cos(pose.yaw));
      faces = [];
      for (const cell of ordered) {
        const wave = Math.min(1, Math.max(0, lift * 1.7 - cell.col / weeks * 0.7));
        const h = cell.height * (1 - (1 - wave) ** 3);
        const color = rows[cell.index] ? palette[{ green: 'build', blue: 'think', gold: 'win' }[k[cell.index]] || 'text'] : palette['card-2'];
        const polygons = visibleFaces(pose, cell.col - weeks / 2, cell.row - 3.5, h);
        for (const face of polygons) {
          polygon(ctx, face.points);
          ctx.fillStyle = color;
          ctx.fill();
          if (face.tone) { ctx.fillStyle = `rgba(0,0,0,${face.tone})`; ctx.fill(); }
          ctx.strokeStyle = selectedIndex === cell.index ? palette.text : color;
          ctx.lineWidth = selectedIndex === cell.index ? 2 : 0.4;
          ctx.stroke();
          faces.push({ index: cell.index, points: face.points });
        }
      }
      canvas.dataset.loaded = 'true';
      canvas.dataset.view = isFlat ? 'flat' : 'terrain';
      canvas.dataset.progress = String(progress);
    }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      if (!began) began = now - progress * 700;
      progress = Math.min(1, (now - began) / 700);
      draw();
      if (progress < 1 && !isFlat) raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }
    function mode() {
      const force = mobile.matches || reduced.matches;
      setForced(force);
      isFlat = force || userFlat;
      setFlat(isFlat);
      progress = isFlat ? 1 : 0;
      began = 0;
      draw(); wake();
    }
    function visibility() {
      visible = onScreen && !document.hidden;
      canvas.dataset.sleeping = String(!visible);
      if (visible) wake();
      else { cancelAnimationFrame(raf); raf = 0; began = 0; }
    }
    function resize() {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      draw();
    }
    function repaint() { readPalette(); draw(); }
    function hit(event) {
      const box = canvas.getBoundingClientRect();
      return faces.findLast(f => inside(f.points, event.clientX - box.left, event.clientY - box.top))?.index;
    }
    function select(index) { selectedIndex = index; setSelected(index); draw(); }
    function down(event) {
      if (event.button !== 0 || event.pointerType === 'touch' || isFlat) return;
      drag = { x: event.clientX, yaw, moved: false };
      canvas.setPointerCapture(event.pointerId);
    }
    function move(event) {
      if (drag) {
        const dx = event.clientX - drag.x;
        if (Math.abs(dx) > 5) drag.moved = true;
        if (drag.moved) { yaw = Math.max(-0.66, Math.min(0.66, drag.yaw + dx * 0.0056)); draw(); }
      } else if (event.pointerType === 'mouse') {
        const index = hit(event); if (index !== undefined) select(index);
      }
    }
    function up(event) {
      const moved = drag?.moved; drag = null;
      if (event.type === 'pointercancel' || moved) return;
      const index = hit(event);
      if (index !== undefined) { select(index); if (rows[index]) location.href = `journey.html#day-${rows[index][0]}`; }
    }
    function key(event) {
      const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (delta) { event.preventDefault(); select(Math.max(0, Math.min(d.length - 1, selectedIndex + delta))); }
      if (event.key === 'Enter' && rows[selectedIndex]) location.href = `journey.html#day-${rows[selectedIndex][0]}`;
    }
    engine.current = { select, view(value) { userFlat = value; mode(); } };
    // Read-only geometry proves real hit targets without synthetic fake clicks.
    canvas.terrainState = () => ({ flat: isFlat, visible, progress, selected: selectedIndex, raf: !!raf, faces: faces.map(f => ({...f})), heights: cells.map(c => c.height), palette: {...palette}, yaw });
    readPalette(); mode(); resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; visibility(); }); io.observe(canvas);
    const mo = new MutationObserver(repaint); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme', 'class', 'style'] });
    mobile.addEventListener('change', mode); reduced.addEventListener('change', mode);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect();
      mobile.removeEventListener('change', mode); reduced.removeEventListener('change', mode);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('keydown', key);
      delete canvas.terrainState; engine.current = null;
    };
  }, [d, k, rows, start, latest]);

  return <figure className="trn-root">
    <figcaption className="trn-heading"><span>The public log, in relief</span><b>Latest: {peak}</b></figcaption>
    <p className="trn-range">{start} to {end}. One tower per day.</p>
    {!forced && <button className="trn-view" type="button" aria-pressed={flat} onClick={() => engine.current?.view(!flat)}>{flat ? 'Show terrain' : 'Show flat view'}</button>}
    <canvas ref={canvasRef} className="trn-canvas" tabIndex={0} role="img" aria-label="Activity terrain. Arrow keys select a day. Enter opens its log entry. Or choose a day below." />
    <p className="trn-legend">Building · thinking · a real outcome. Height: recorded commits, otherwise 1 per entry. Gaps: 0.</p>
    <label className="trn-label" htmlFor="trn-day">Explore a day</label>
    <select id="trn-day" className="trn-select" value={selected} onChange={e => choose(Number(e.target.value))} onFocus={() => engine.current?.select(selected)}>
      {d.map((_, i) => <option key={i} value={i}>{dateAt(start, i)} · {rows[i] ? `day ${rows[i][0]}, ${KIND[k[i]] || 'logged'}` : 'no entry'}</option>)}
    </select>
    <div className="trn-readout" aria-live="polite"><p><b>{dateAt(start, selected)} · {active ? `day ${active[0]} · ${KIND[k[selected]] || 'logged'}` : 'no entry'}</b></p><p>{active ? active[1] : 'No activity has been invented for this gap.'}</p></div>
    {active ? <a className="trn-open" href={`journey.html#day-${active[0]}`}>Open day {active[0]} →</a> : <a className="trn-open" href="journey.html">Browse the whole log →</a>}
    <details className="trn-data"><summary>Activity data table</summary><div className="trn-table-wrap"><table><caption>Actual log activity. Zero commits can still have an entry.</caption><thead><tr><th scope="col">Date</th><th scope="col">Height</th><th scope="col">Kind and entry</th></tr></thead><tbody>{d.map((n,i) => <tr key={i}><th scope="row">{dateAt(start,i)}</th><td>{n}</td><td>{rows[i] ? <a href={`journey.html#day-${rows[i][0]}`}>day {rows[i][0]} · {KIND[k[i]] || 'logged'}</a> : 'no entry'}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
