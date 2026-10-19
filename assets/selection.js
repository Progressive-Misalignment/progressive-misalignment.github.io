/* Replay saved benign-prompt selections. Scores and batches are never simulated. */
(() => {
  const root = document.querySelector('#selection-demo');
  const data = window.SELECTION_DATA;
  if (!root || !data) return;
  const $ = selector => root.querySelector(selector);
  const state = {model: 'qwen', mode: 'off', view: 'paper', round: 0, phase: 0};
  const roundSelect = $('.selection-round');
  const go = $('.selection-go');
  const rows = $('.selection-table tbody');
  const chosenList = $('.selection-chosen');
  const models = {qwen: 'Qwen3 14B', phi: 'Phi-4 14B'};
  const modes = {off: 'Off-policy', on: 'On-policy'};
  const signed = value => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3)}`;
  const percent = value => `${(100 * value).toFixed(1)}%`;

  for (let i = 0; i < 10; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i + 1} / 10`;
    roundSelect.append(option);
  }
  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderTrajectory(completed) {
    const key = `${state.model}-${state.mode}`;
    const paper = data.paper[key], baseline = data.baseline[state.model];
    const paperView = state.view === 'paper';
    const series = ['sorrybench', 'strongreject'].map(benchmark => ({
      benchmark,
      name: benchmark === 'sorrybench' ? 'SORRY-Bench compliance' : 'StrongREJECT harmfulness',
      color: benchmark === 'sorrybench' ? '#2e6b46' : '#b56828',
      points: paperView
        ? [{step: 0, ...baseline[benchmark]}, {step: paper.step, ...paper[benchmark]}]
        : data.trajectories[key][benchmark].filter(point => point.step <= completed)
    }));
    const label = `${models[state.model]} · ${modes[state.mode]}`;
    $('.selection-progress').textContent = paperView ? `Checkpoint: ${paper.step} updates` : `${completed} / 200 updates`;
    $('.selection-outcome-label').textContent = `${label} · ${paperView ? 'full benchmarks' : 'development subsets'}`;
    const sorry = series[0].points.at(-1), strong = series[1].points.at(-1);
    $('.selection-sorry-value').textContent = sorry ? percent(sorry.value) : '—';
    $('.selection-strong-value').textContent = strong ? strong.value.toFixed(3) : '—';
    $('.selection-sorry-note').textContent = paperView
      ? `Initial: ${percent(baseline.sorrybench.value)} · selected at ${paper.step} updates`
      : (sorry ? `88 dev questions · ${completed} updates` : 'First measurement: 20 updates');
    $('.selection-strong-note').textContent = paperView
      ? `Initial: ${baseline.strongreject.value.toFixed(3)} · selected at ${paper.step} updates`
      : (strong ? `63 dev questions · ${completed} updates` : 'First measurement: 20 updates');
    $('.selection-measurement-note').textContent = paperView
      ? 'Paper results on all 440 SORRY-Bench and 313 StrongREJECT questions. Bars compare the initial model with the selected checkpoint; they stay fixed during replay. Mean ± SD over 3 temperature-1 samples.'
      : `Measured after every batch on development subsets: 88 SORRY-Bench and 63 StrongREJECT questions. Mean ± SD over 3 temperature-1 samples. The paper reports the selected ${paper.step}-update checkpoint on the full benchmarks; later batches can decline.`;

    const ns = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs, parent, text) {
      const node = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, value);
      if (text !== undefined) node.textContent = text;
      if (parent) parent.append(node);
      return node;
    }
    const svg = svgEl('svg', {viewBox: '0 0 470 270', role: 'img', 'aria-labelledby': 'selection-chart-title selection-chart-desc', 'data-completed-step': completed, 'data-scope': state.view});
    svgEl('title', {id: 'selection-chart-title'}, svg, `${label}: ${paperView ? 'reported paper results' : `development scores through ${completed} updates`}`);
    svgEl('desc', {id: 'selection-chart-desc'}, svg,
      sorry ? `SORRY-Bench compliance ${percent(sorry.value)}; StrongREJECT harmfulness ${strong.value.toFixed(3)}. ${paperView ? 'Full-benchmark paper checkpoint.' : 'Development subsets, not full-benchmark paper scores.'}` : 'Complete the first batch to reveal its measured development scores.');
    const x = step => 43 + step / 200 * 408;
    const y = value => 226 - value * 208;
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      svgEl('line', {x1: x(0), x2: x(200), y1: y(value), y2: y(value), stroke: '#e3e7e0', 'stroke-dasharray': '2 4'}, svg);
      svgEl('text', {x: 34, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#697169'}, svg, value.toFixed(2));
    }
    if (paperView) {
      svgEl('text', {x: 145, y: 247, 'text-anchor': 'middle', 'font-size': 12, fill: '#4e584f'}, svg, 'Initial model');
      svgEl('text', {x: 350, y: 247, 'text-anchor': 'middle', 'font-size': 12, fill: '#4e584f'}, svg, 'Paper checkpoint');
      svgEl('text', {x: 350, y: 264, 'text-anchor': 'middle', 'font-size': 11, fill: '#697169'}, svg, `${paper.step} updates`);
    } else {
      for (let step = 0; step <= 200; step += 40) {
        svgEl('text', {x: x(step), y: 244, 'text-anchor': 'middle', 'font-size': 11, fill: '#697169'}, svg, step);
      }
      svgEl('text', {x: 247, y: 264, 'text-anchor': 'middle', 'font-size': 12, fill: '#4e584f'}, svg, 'Training updates · 20 per batch');
      svgEl('line', {x1: x(completed), x2: x(completed), y1: 18, y2: 226, stroke: '#9db09a', 'stroke-dasharray': '4 4'}, svg);
      if (!completed) svgEl('text', {x: 247, y: 120, 'text-anchor': 'middle', 'font-size': 12, fill: '#697169'}, svg, 'Self-distill to reveal the first batch.');
    }
    function accessiblePoint(node, benchmark, point, text) {
      node.setAttribute('class', 'selection-chart-point');
      node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', text);
      node.setAttribute('data-benchmark', benchmark);
      node.setAttribute('data-step', point.step);
      svgEl('title', {}, node, text);
    }
    series.forEach(({benchmark, name, color, points}, index) => {
      if (!paperView) svgEl('polyline', {points: points.map(p => `${x(p.step)},${y(p.value)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round'}, svg);
      points.forEach(point => {
        const cx = paperView ? (point.step ? 350 : 145) + (index ? 26 : -26) : x(point.step);
        const cy = y(point.value);
        let node;
        if (paperView) {
          node = svgEl('rect', {x: cx - 20, y: cy, width: 40, height: y(0) - cy, rx: 2, fill: color, 'fill-opacity': point.step ? 1 : 0.4}, svg);
          svgEl('text', {x: cx, y: y(Math.min(1, point.value + point.sd)) - 8, 'text-anchor': 'middle', 'font-size': 12, fill: color}, svg, point.value.toFixed(2));
        } else {
          node = index
            ? svgEl('path', {d: `M${cx},${cy - 5}L${cx + 5},${cy}L${cx},${cy + 5}L${cx - 5},${cy}Z`, fill: color, stroke: '#fff', 'stroke-width': 1}, svg)
            : svgEl('circle', {cx, cy, r: point.step === completed ? 5 : 3.5, fill: color, stroke: '#fff', 'stroke-width': 1}, svg);
        }
        const top = y(Math.min(1, point.value + point.sd)), bottom = y(Math.max(0, point.value - point.sd));
        svgEl('path', {d: `M${cx},${top}V${bottom}M${cx - 3},${top}H${cx + 3}M${cx - 3},${bottom}H${cx + 3}`, stroke: paperView ? '#343a35' : color, 'stroke-width': 1.2, fill: 'none', 'pointer-events': 'none'}, svg);
        accessiblePoint(node, benchmark, point, `${point.step} updates: ${name} ${point.value.toFixed(3)} ± ${point.sd.toFixed(3)} (${paperView ? 'full benchmark' : 'development subset'}, 3 samples at temperature 1)`);
      });
    });
    $('.selection-plot').replaceChildren(svg);
  }

  function render() {
    const round = data.runs[`${state.model}-${state.mode}`][state.round];
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
    roundSelect.value = state.round;
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
    $('.selection-scale-note').textContent = scored
      ? `Score bars share a scale within this round (${signed(lo)} to ${signed(hi)}). Scroll to explore all 60 prompts.`
      : 'Reveal the recorded scores, then rank the shortlist.';
    $('.selection-batch-count').textContent = selected ? '20 / 20' : '0 / 20';
    $('.selection-empty').hidden = selected;
    chosenList.hidden = !selected;
    chosenList.replaceChildren(...(selected ? batch.map(candidate => el('li', '', data.prompts[candidate.id].text)) : []));
    chosenList.scrollTop = 0;
    $('.selection-batch-note').textContent = selected
      ? `Recorded order · cluster cap ${round.clusterCap} across rounds; at most ${round.categoryCap} per category in this batch.`
      : 'Only benign prompts enter the training batch.';
    const messages = [
      `Start with the saved shortlist for round ${round.number}.`,
      'Higher scores predict a larger increase in preference for harmful answers.',
      '20 prompts selected with the recorded diversity constraint. The cue stays “Excellent”.',
      `Round ${round.number} complete: ${round.number * 20} updates in the saved run. ${round.number < 10 ? 'Continue to rescore prompts with the updated model.' : 'All 200 updates used benign prompts.'}`
    ];
    $('.selection-status').textContent = messages[state.phase];
    go.textContent = ['Score & rank', 'Select 20 prompts', 'Self-distill ↻', state.round < 9 ? 'Next round →' : 'Replay from round 1 ↻'][state.phase];
    renderTrajectory((round.number - (trained ? 0 : 1)) * 20);
  }

  root.querySelectorAll('[data-selection-control] button').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.closest('[data-selection-control]').dataset.selectionControl;
      if (state[key] === button.dataset.value) return;
      state[key] = button.dataset.value;
      if (key !== 'view') state.phase = 0;
      render();
    });
  });
  roundSelect.addEventListener('change', () => {
    state.round = Number(roundSelect.value);
    state.phase = 0;
    render();
  });
  go.addEventListener('click', () => {
    if (state.phase < 3) state.phase++;
    else { state.round = (state.round + 1) % 10; state.phase = 0; }
    render();
  });
  $('.selection-reset').addEventListener('click', () => { state.phase = 0; render(); });
  render();
  root.hidden = false;
  document.querySelector('.selection-fallback').hidden = true;
})();
