/* Replay saved benign-prompt selections. Scores and batches are never simulated. */
(() => {
  const root = document.querySelector('#selection-demo');
  const data = window.SELECTION_DATA;
  if (!root || !data) return;
  const $ = selector => root.querySelector(selector);
  const state = {model: 'qwen', mode: 'off', round: 0, phase: 0};
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
    $('.selection-results-label').textContent = `${models[state.model]} · ${modes[state.mode]} · “Excellent”`;
    root.querySelectorAll('[data-result]').forEach(output => {
      const result = data.results[state.model][output.dataset.result];
      output.textContent = `${percent(result.initial)} → ${percent(result[state.mode])}`;
    });
  }

  root.querySelectorAll('[data-selection-control] button').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.closest('[data-selection-control]').dataset.selectionControl;
      if (state[key] === button.dataset.value) return;
      state[key] = button.dataset.value;
      state.phase = 0;
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
