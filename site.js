'use strict';
const tablist = document.querySelector('.experiment-tabs');
const tabs = [...tablist.querySelectorAll('[role="tab"]')];
function activateTab(tab, moveFocus = false) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  if (moveFocus) tab.focus();
}
tablist.hidden = false;
activateTab(tabs[0]);
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => {
    activateTab(tab);
    history.replaceState(null, '', '#' + tab.getAttribute('aria-controls'));
  });
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      activateTab(tabs[next], true);
      history.replaceState(null, '', '#' + tabs[next].getAttribute('aria-controls'));
    }
  });
});
function revealHashPanel() {
  const match = tabs.find(tab => '#' + tab.getAttribute('aria-controls') === location.hash);
  if (match) { activateTab(match); document.getElementById(match.getAttribute('aria-controls')).scrollIntoView(); }
}
revealHashPanel();
window.addEventListener('hashchange', revealHashPanel);
const links = [...document.querySelectorAll('.contents a')];
const sections = links.map(link => document.querySelector(link.hash));
let scrollPending = false;
function updateContents() {
  const threshold = Math.min(window.innerHeight * .3, 180);
  let current = sections[0];
  sections.forEach(section => {
    if (section.getBoundingClientRect().top <= threshold) current = section;
  });
  links.forEach(link => {
    if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scrollPending = false;
}
window.addEventListener('scroll', () => {
  if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateContents); }
}, {passive: true});
updateContents();

// The ordinary figure link remains a PDF fallback when JavaScript is unavailable.
const viewer = document.getElementById('figure-viewer');
if (typeof viewer.showModal === 'function') {
  const viewerImage = document.getElementById('viewer-image');
  const viewerCanvas = viewer.querySelector('.viewer-canvas');
  const zoomButton = document.getElementById('viewer-zoom');
  let figureTrigger;
  const resetZoom = () => {
    viewerCanvas.classList.remove('is-zoomed');
    zoomButton.setAttribute('aria-pressed', 'false');
    zoomButton.textContent = 'Zoom in';
    viewerCanvas.scrollTo(0, 0);
  };
  document.querySelectorAll('.figure-open').forEach(link => {
    link.dataset.viewer = 'true';
    link.setAttribute('aria-haspopup', 'dialog');
    link.setAttribute('aria-label', 'Enlarge figure: ' + link.dataset.title);
    link.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      figureTrigger = link;
      const original = link.querySelector('img');
      viewerImage.src = original.currentSrc || original.src;
      viewerImage.alt = original.alt;
      document.getElementById('viewer-title').textContent = link.dataset.title;
      document.getElementById('viewer-pdf').href = link.href;
      resetZoom();
      viewer.showModal();
      document.body.classList.add('viewer-open');
      document.getElementById('viewer-close').focus();
    });
  });
  zoomButton.addEventListener('click', () => {
    const zoomed = viewerCanvas.classList.toggle('is-zoomed');
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.textContent = zoomed ? 'Fit figure' : 'Zoom in';
    viewerCanvas.scrollTo(0, 0);
  });
  document.getElementById('viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...viewer.querySelectorAll('button, a[href], [tabindex="0"]')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  });
  viewer.addEventListener('click', event => {
    const bounds = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) viewer.close();
  });
  viewer.addEventListener('close', () => {
    document.body.classList.remove('viewer-open');
    resetZoom();
    figureTrigger?.focus({preventScroll: true});
  });
}
const copyButton = document.getElementById('copy-citation');
copyButton.hidden = false;
let noticeTimer;
copyButton.addEventListener('click', async () => {
  const citation = document.getElementById('citation-text');
  const status = document.getElementById('status');
  try {
    await navigator.clipboard.writeText(citation.textContent);
    status.textContent = 'BibTeX copied';
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(citation);
    selection.removeAllRanges(); selection.addRange(range);
    citation.focus();
    status.textContent = 'Citation selected. Press Ctrl+C or ⌘C to copy.';
  }
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { status.textContent = ''; }, 5000);
});
