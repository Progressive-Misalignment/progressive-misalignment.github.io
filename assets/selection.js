/* Replay saved benign-prompt selections. Scores and batches are never simulated. */
(() => {
  const root = document.querySelector('#selection-demo');
  const data = window.SELECTION_DATA;
  if (!root || !data) return;
  const $ = selector => root.querySelector(selector);
  const state = {model: 'qwen', mode: 'off', round: 0, phase: 0};
  const go = $('.selection-go');
  const rows = $('.selection-table tbody');
  const chosenList = $('.selection-chosen');
  const models = {qwen: 'Qwen3 14B', phi: 'Phi-4 14B'};
  const modes = {off: 'Off-policy', on: 'On-policy'};
  const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3)}`;
  const percent = value => `${(100 * value).toFixed(1)}%`;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderTrajectory(completed) {
    const key = `${state.model}-${state.mode}`;
    const stop = data.paper[key].step;
    const series = ['sorrybench', 'strongreject'].map(benchmark => ({
      benchmark,
      name: benchmark === 'sorrybench' ? 'SORRY-Bench compliance' : 'StrongREJECT harmfulness',
      color: benchmark === 'sorrybench' ? '#2e6b46' : '#b56828',
      points: [{step: 0, ...data.baseline[state.model][benchmark]},
        ...data.trajectories[key][benchmark].filter(point => point.step > 0 && point.step <= completed)]
    }));
    const label = `${models[state.model]} · ${modes[state.mode]}`;
    $('.selection-progress').textContent = `${completed} / ${stop} updates`;
    $('.selection-outcome-label').textContent = label;
    const sorry = series[0].points.at(-1), strong = series[1].points.at(-1);
    const tooltip = el('div', 'tip selection-tooltip');
    tooltip.id = 'selection-chart-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;

    const ns = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, parent, text) {
      const node = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, value);
      if (text !== undefined) node.textContent = text;
      if (parent) parent.append(node);
      return node;
    }
    const svg = svgEl('svg', {viewBox: '0 0 470 270', role: 'img', 'aria-label': `${label}: training history through ${completed} updates`, 'aria-describedby': 'selection-chart-desc', 'data-completed-step': completed, 'data-stop-step': stop, 'data-scope': 'batches'});
    svgEl('desc', {id: 'selection-chart-desc'}, svg,
      `SORRY-Bench compliance ${percent(sorry.value)}; StrongREJECT harmfulness ${strong.value.toFixed(3)}. Step 0 uses the paper’s full-benchmark baseline; later points show development scores through the selected ${stop}-update checkpoint.`);
    const x = step => 43 + step / stop * 408;
    const y = value => 226 - value * 208;
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      svgEl('line', {x1: x(0), x2: x(stop), y1: y(value), y2: y(value), stroke: '#e3e7e0', 'stroke-dasharray': '2 4'}, svg);
      svgEl('text', {x: 34, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#697169'}, svg, value.toFixed(2));
    }
    for (let step = 0; step <= stop; step += 20) {
      svgEl('text', {x: x(step), y: 244, 'text-anchor': 'middle', 'font-size': 11, fill: '#697169'}, svg, step);
    }
    svgEl('text', {x: 247, y: 264, 'text-anchor': 'middle', 'font-size': 12, fill: '#4e584f'}, svg, 'Training updates · 20 per batch');
    svgEl('line', {x1: x(completed), x2: x(completed), y1: 18, y2: 226, stroke: '#9db09a', 'stroke-dasharray': '4 4'}, svg);
    function accessiblePoint(node, benchmark, name, point) {
      const format = benchmark === 'sorrybench' ? percent : value => value.toFixed(3);
      const fullCount = benchmark === 'sorrybench' ? 440 : 313;
      const scope = point.step === 0 ? `Paper · all ${fullCount} questions`
        : `${benchmark === 'sorrybench' ? 88 : 63} development questions`;
      const paper = point.step === stop ? data.paper[key][benchmark] : null;
      const step = point.step === 0 ? 'Base model · 0 updates' : `${point.step} updates`;
      const score = `${format(point.value)} ± ${format(point.sd)}`;
      const reference = paper ? `Paper · all ${fullCount} questions: ${format(paper.value)}` : '';
      node.setAttribute('class', 'selection-chart-point');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', `${step}: ${name} ${score}; ${scope}, mean ± SD over 3 samples at temperature 1. ${reference}`);
      node.setAttribute('data-benchmark', benchmark);
      node.setAttribute('data-step', point.step);
      function show() {
        tooltip.replaceChildren(el('div', 'tip-title', name), el('div', '', step),
          el('strong', '', score), el('div', '', `${scope} · mean ± SD over 3 samples at temperature 1`),
          ...(reference ? [el('div', 'selection-tooltip-reference', reference)] : []));
        tooltip.hidden = false;
        const box = $('.selection-outcome'), bounds = box.getBoundingClientRect(), anchor = node.getBoundingClientRect();
        const left = anchor.left + anchor.width / 2 - bounds.left - tooltip.offsetWidth / 2;
        const above = anchor.top - bounds.top - tooltip.offsetHeight - 8;
        const top = above >= 8 ? above : anchor.bottom - bounds.top + 8;
        tooltip.style.left = `${Math.max(8, Math.min(box.clientWidth - tooltip.offsetWidth - 8, left))}px`;
        tooltip.style.top = `${Math.max(8, Math.min(box.clientHeight - tooltip.offsetHeight - 8, top))}px`;
      }
      node.addEventListener('pointerenter', show);
      node.addEventListener('pointerleave', () => { if (document.activeElement !== node) tooltip.hidden = true; });
      node.addEventListener('focus', show);
      node.addEventListener('blur', () => { tooltip.hidden = true; });
      node.addEventListener('click', show);
      node.addEventListener('keydown', event => { if (event.key === 'Escape') tooltip.hidden = true; });
    }
    series.forEach(({benchmark, name, color, points}) => {
      svgEl('polyline', {points: points.map(p => `${x(p.step)},${y(p.value)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round'}, svg);
      points.forEach(point => {
        const cx = x(point.step);
        const cy = y(point.value);
        const group = svgEl('g', {}, svg);
        const node = svgEl('circle', {cx, cy, r: point.step === completed || point.step === 0 ? 5 : 3.5, fill: color, stroke: '#fff', 'stroke-width': 1}, group);
        node.setAttribute('class', 'selection-point-mark');
        const top = y(Math.min(1, point.value + point.sd)), bottom = y(Math.max(0, point.value - point.sd));
        svgEl('path', {d: `M${cx},${top}V${bottom}M${cx - 3},${top}H${cx + 3}M${cx - 3},${bottom}H${cx + 3}`, stroke: color, 'stroke-width': 1.2, fill: 'none', 'pointer-events': 'none'}, group);
        svgEl('circle', {cx, cy, r: 10, fill: 'transparent'}, group);
        accessiblePoint(group, benchmark, name, point);
      });
    });
    $('.selection-plot').replaceChildren(svg, tooltip);
  }

  function render() {
    const rounds = data.runs[`${state.model}-${state.mode}`];
    state.round = Math.min(state.round, rounds.length - 1);
    const round = rounds[state.round];
    const scored = state.phase >= 1;
    const selected = state.phase >= 2;
    const trained = state.phase === 3;
    const candidates = [...round.candidates];
    if (scored) candidates.sort((a, b) => b.score - a.score);
    const batch = candidates.filter(c => c.order !== null).sort((a, b) => a.order - b.order);
    const lo = Math.min(0, ...candidates.map(c => c.score));
    const hi = Math.max(0, ...candidates.map(c => c.score));
    const span = hi - lo || 1;
    const zero = -lo / span * 100;
    const fragments = document.createDocumentFragment();
    candidates.forEach((candidate, index) => {
      const prompt = data.prompts[candidate.id];
      const picked = selected && candidate.order !== null;
      const tr = el('tr', picked ? 'is-selected' : '');
      tr.dataset.promptId = candidate.id;
      const promptCell = el('td', 'selection-prompt');
      const meta = el('span', 'selection-prompt-meta', `${scored ? `#${index + 1} · ` : ''}${prompt.category}`);
      if (picked) meta.append(el('span', 'selection-picked', '✓ Selected'));
      promptCell.append(meta, el('span', 'selection-prompt-text', prompt.text));
      const scoreCell = el('td', 'selection-score');
      const track = el('span', 'selection-bar');
      track.setAttribute('aria-hidden', 'true');
      const axis = el('span', 'selection-zero');
      axis.style.left = `${zero}%`;
      const fill = el('span', `selection-fill${candidate.score < 0 ? ' is-negative' : ''}`);
      fill.style.left = `${Math.min(zero, (candidate.score - lo) / span * 100)}%`;
      fill.style.setProperty('--score-width', `${Math.abs(candidate.score) / span * 100}%`);
      track.append(axis, fill);
      const value = el('span', 'selection-score-value', scored ? signed(candidate.score) : '—');
      if (scored) value.title = `Recorded score: ${candidate.score}`;
      scoreCell.append(track, value);
      tr.append(promptCell, scoreCell);
      fragments.append(tr);
    });
    rows.replaceChildren(fragments);
    $('.selection-table-wrap').scrollTop = 0;
    root.classList.toggle('is-scored', scored);
    root.classList.toggle('is-trained', trained);
    root.querySelectorAll('[data-selection-control]').forEach(group => {
      group.querySelectorAll('button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.value === state[group.dataset.selectionControl]));
      });
    });
    root.querySelectorAll('.selection-steps li').forEach((item, index) => {
      const step = Math.min(state.phase, 2);
      item.classList.toggle('is-done', index < state.phase);
      if (index === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    $('.selection-bank-note').textContent = `Round ${round.number}: 60 shortlisted from ${round.screened.toLocaleString()} screened prompts.`;
    $('.selection-batch-count').textContent = selected ? '20 / 20' : '0 / 20';
    $('.selection-empty').hidden = selected;
    chosenList.hidden = !selected;
    chosenList.replaceChildren(...(selected ? batch.map(candidate => el('li', '', data.prompts[candidate.id].text)) : []));
    chosenList.scrollTop = 0;
    go.textContent = ['Score & rank', 'Select 20 prompts', 'Self-distill ↻', state.round < rounds.length - 1 ? 'Next round →' : 'Replay from round 1 ↻'][state.phase];
    renderTrajectory((round.number - (trained ? 0 : 1)) * 20);
  }

  root.querySelectorAll('[data-selection-control] button').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.closest('[data-selection-control]').dataset.selectionControl;
      if (state[key] === button.dataset.value) return;
      state[key] = button.dataset.value;
      state.round = 0;
      state.phase = 0;
      render();
    });
  });
  go.addEventListener('click', () => {
    if (state.phase < 3) state.phase++;
    else { state.round = (state.round + 1) % data.runs[`${state.model}-${state.mode}`].length; state.phase = 0; }
    render();
  });
  $('.selection-reset').addEventListener('click', () => { state.phase = 0; render(); });
  render();
  root.hidden = false;
  document.querySelector('.selection-fallback').hidden = true;
})();
