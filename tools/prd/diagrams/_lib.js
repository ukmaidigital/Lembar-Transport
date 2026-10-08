/* Tiny dependency-free SVG diagram helper used by the PRD diagram sources.
 * Boxes are placed by hand (explicit x/y); connectors, arrowheads, labels,
 * swimlanes and legends are generated so every diagram shares one look. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const TONES = {
    customer: { stroke: '#2a78d6', fill: '#e3effb', text: '#1c5cab' },
    driver:   { stroke: '#eb6834', fill: '#fdeae2', text: '#b4421a' },
    admin:    { stroke: '#1baf7a', fill: '#dff5ec', text: '#0f7a55' },
    system:   { stroke: '#64748b', fill: '#f1f5f9', text: '#334155' },
    data:     { stroke: '#475569', fill: '#f8fafc', text: '#1e293b' },
    external: { stroke: '#94a3b8', fill: '#ffffff', text: '#475569', dashed: true },
    good:     { stroke: '#0ca30c', fill: '#e6f6e6', text: '#0a6b0a' },
    warning:  { stroke: '#d99a00', fill: '#fff4d6', text: '#7a5200' },
    serious:  { stroke: '#ec835a', fill: '#fdeee6', text: '#9a3f1b' },
    critical: { stroke: '#d03b3b', fill: '#fbe5e5', text: '#9b2222' },
    ink:      { stroke: '#0f172a', fill: '#ffffff', text: '#0f172a' },
    plain:    { stroke: '#cbd5e1', fill: '#ffffff', text: '#0f172a' },
  };
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, String(v));
    if (parent) parent.appendChild(n);
    return n;
  };
  const txt = (parent, x, y, s, o = {}) => {
    const t = el('text', { x, y, 'font-size': o.size || 12.5, 'font-weight': o.weight || 400, fill: o.color || '#0f172a',
      'text-anchor': o.anchor || 'start', 'dominant-baseline': o.baseline || 'auto', 'font-style': o.italic ? 'italic' : undefined,
      'letter-spacing': o.spacing, transform: o.transform }, parent);
    t.textContent = s;
    return t;
  };

  function Diagram(svg) {
    const defs = el('defs', {}, svg);
    const boxes = {};
    const markers = {};
    const layerBack = el('g', { class: 'back' }, svg);
    const layerEdges = el('g', { class: 'edges' }, svg);
    const layerBoxes = el('g', { class: 'boxes' }, svg);
    const layerLabels = el('g', { class: 'labels' }, svg);

    const marker = (color) => {
      const id = 'arr-' + color.replace('#', '');
      if (!markers[id]) {
        const m = el('marker', { id, markerWidth: 10, markerHeight: 10, refX: 8.5, refY: 5, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
        el('path', { d: 'M0,0.5 L9,5 L0,9.5 z', fill: color }, m);
        markers[id] = true;
      }
      return `url(#${id})`;
    };

    const api = {};
    api.TONES = TONES;

    api.lane = ({ x, y, w, h, label, tone = 'system', labelWidth = 120 }) => {
      const t = TONES[tone];
      el('rect', { x, y, width: w, height: h, fill: t.fill, stroke: t.stroke, 'stroke-width': 1, rx: 8, opacity: 0.55 }, layerBack);
      el('rect', { x, y, width: labelWidth, height: h, fill: t.stroke, rx: 8, opacity: 0.12 }, layerBack);
      const lines = String(label).split('\n');
      const cy = y + h / 2 - ((lines.length - 1) * 16) / 2;
      lines.forEach((ln, i) => txt(layerBack, x + labelWidth / 2, cy + i * 16, ln, { size: 13, weight: 700, color: t.text, anchor: 'middle', baseline: 'middle' }));
      return { x: x + labelWidth, y, w: w - labelWidth, h };
    };

    api.group = ({ x, y, w, h, title, tone = 'system', dashed = false, titleSize = 14 }) => {
      const t = TONES[tone];
      el('rect', { x, y, width: w, height: h, rx: 14, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.5, 'stroke-dasharray': dashed ? '6 5' : undefined, opacity: 0.9 }, layerBack);
      if (title) txt(layerBack, x + 16, y + 24, title, { size: titleSize, weight: 700, color: t.text });
      return { x, y, w, h };
    };

    api.box = ({ id, x, y, w, h, title, lines = [], tone = 'system', shape = 'rect', dashed, titleSize = 14, lineSize = 12, align = 'center', titleWeight = 700, pad = 12, mono = false }) => {
      const t = TONES[tone];
      const g = el('g', { class: 'box' }, layerBoxes);
      const dash = dashed ?? t.dashed ? '6 5' : undefined;
      if (shape === 'pill') el('rect', { x, y, width: w, height: h, rx: h / 2, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75, 'stroke-dasharray': dash }, g);
      else if (shape === 'diamond') el('polygon', { points: `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75 }, g);
      else if (shape === 'cylinder') {
        const ry = Math.min(12, h / 6);
        el('path', { d: `M${x},${y + ry} a${w / 2},${ry} 0 0 1 ${w},0 v${h - 2 * ry} a${w / 2},${ry} 0 0 1 -${w},0 z`, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75 }, g);
        el('ellipse', { cx: x + w / 2, cy: y + ry, rx: w / 2, ry, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75 }, g);
      } else if (shape === 'doc') {
        const f = 10;
        el('path', { d: `M${x},${y} h${w - f} l${f},${f} v${h - f} h-${w} z`, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75 }, g);
        el('path', { d: `M${x + w - f},${y} v${f} h${f}`, fill: 'none', stroke: t.stroke, 'stroke-width': 1.5 }, g);
      } else el('rect', { x, y, width: w, height: h, rx: 10, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.75, 'stroke-dasharray': dash }, g);

      const total = (title ? titleSize * 1.25 : 0) + lines.length * lineSize * 1.45;
      const topOffset = shape === 'cylinder' ? Math.min(12, h / 6) : 0;
      let cy = y + topOffset + (h - topOffset - total) / 2;
      const ax = align === 'left' ? x + pad : x + w / 2;
      const anchor = align === 'left' ? 'start' : 'middle';
      if (title) {
        cy += titleSize;
        String(title).split('\n').forEach((ln, i) => txt(g, ax, cy + i * titleSize * 1.2, ln, { size: titleSize, weight: titleWeight, color: t.text, anchor }));
        cy += (String(title).split('\n').length - 1) * titleSize * 1.2 + titleSize * 0.35;
      }
      lines.forEach((ln) => { cy += lineSize * 1.45; txt(g, ax, cy, ln, { size: lineSize, color: '#334155', anchor, weight: mono ? 500 : 400 }); });
      boxes[id || title] = { x, y, w, h, shape };
      return boxes[id || title];
    };

    api.anchor = (id, side, t = 0.5) => {
      const b = boxes[id];
      if (!b) throw new Error('unknown box ' + id);
      if (side === 'l') return { x: b.x, y: b.y + b.h * t };
      if (side === 'r') return { x: b.x + b.w, y: b.y + b.h * t };
      if (side === 't') return { x: b.x + b.w * t, y: b.y };
      return { x: b.x + b.w * t, y: b.y + b.h };
    };

    api.edge = ({ from, to, fromSide = 'r', toSide = 'l', fromT = 0.5, toT = 0.5, label, label2, color = '#475569', dashed = false, width = 1.75, via, midX, midY, at = 0.5, labelDy = -6, arrow = true, start, end }) => {
      const p1 = start || api.anchor(from, fromSide, fromT);
      const p2 = end || api.anchor(to, toSide, toT);
      let pts = [p1];
      if (via) pts = pts.concat(via);
      else {
        const hv = (s) => s === 'l' || s === 'r';
        if (hv(fromSide) && hv(toSide)) {
          if (Math.abs(p1.y - p2.y) > 1) { const mx = midX ?? (p1.x + p2.x) / 2; pts.push({ x: mx, y: p1.y }, { x: mx, y: p2.y }); }
        } else if (!hv(fromSide) && !hv(toSide)) {
          if (Math.abs(p1.x - p2.x) > 1) { const my = midY ?? (p1.y + p2.y) / 2; pts.push({ x: p1.x, y: my }, { x: p2.x, y: my }); }
        } else if (hv(fromSide)) pts.push({ x: p2.x, y: p1.y });
        else pts.push({ x: p1.x, y: p2.y });
      }
      pts.push(p2);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ');
      const path = el('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-dasharray': dashed ? '6 5' : undefined, 'marker-end': arrow ? marker(color) : undefined, 'stroke-linejoin': 'round' }, layerEdges);
      if (label) {
        const L = path.getTotalLength();
        const p = path.getPointAtLength(L * at);
        const g = el('g', {}, layerLabels);
        const lines = [label].concat(label2 ? [label2] : []);
        const texts = lines.map((ln, i) => txt(g, p.x, p.y + labelDy + i * 14, ln, { size: 11.5, weight: 600, color: '#334155', anchor: 'middle' }));
        const bb = g.getBBox();
        const bg = el('rect', { x: bb.x - 5, y: bb.y - 2, width: bb.width + 10, height: bb.height + 4, rx: 4, fill: '#ffffff', 'fill-opacity': 0.95 });
        g.insertBefore(bg, texts[0]);
      }
      return path;
    };

    api.text = (x, y, s, o = {}) => txt(layerLabels, x, y, s, o);

    api.legend = ({ x, y, items, columns = items.length, colWidth = 170, title }) => {
      const g = el('g', {}, layerLabels);
      let cx = x, cy = y;
      if (title) { txt(g, x, y, title, { size: 11.5, weight: 700, color: '#64748b' }); cy += 18; }
      items.forEach((it, i) => {
        const col = i % columns, row = Math.floor(i / columns);
        const ix = x + col * colWidth, iy = cy + row * 22;
        if (it.tone) {
          const t = TONES[it.tone];
          el('rect', { x: ix, y: iy - 10, width: 18, height: 14, rx: 3, fill: t.fill, stroke: t.stroke, 'stroke-width': 1.5, 'stroke-dasharray': it.dashed || t.dashed ? '4 3' : undefined }, g);
        } else if (it.line) {
          el('line', { x1: ix, y1: iy - 3, x2: ix + 18, y2: iy - 3, stroke: it.line, 'stroke-width': 2, 'stroke-dasharray': it.dashed ? '5 4' : undefined }, g);
        }
        txt(g, ix + 26, iy, it.label, { size: 11.5, color: '#334155' });
      });
      return g;
    };

    api.note = ({ x, y, w, text, size = 11.5 }) => {
      const g = el('g', {}, layerLabels);
      const lines = Array.isArray(text) ? text : [text];
      const h = lines.length * size * 1.5 + 16;
      el('rect', { x, y, width: w, height: h, rx: 6, fill: '#fffbeb', stroke: '#f3d27a', 'stroke-width': 1 }, g);
      lines.forEach((ln, i) => txt(g, x + 10, y + 12 + (i + 1) * size * 1.5 - size * 0.4, ln, { size, color: '#5b4300' }));
      return { x, y, w, h };
    };

    return api;
  }
  window.Diagram = Diagram;
  window.svgEl = el;
})();
