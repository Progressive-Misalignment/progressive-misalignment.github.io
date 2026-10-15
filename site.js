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
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activateTab(tabs[next], true); }
  });
});
function revealHashPanel() {
  const match = tabs.find(tab => '#' + tab.getAttribute('aria-controls') === location.hash);
  if (match) { activateTab(match); document.getElementById(match.getAttribute('aria-controls')).scrollIntoView(); }
}
revealHashPanel();
window.addEventListener('hashchange', revealHashPanel);
const links = [...document.querySelectorAll('.contents a')];
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      links.forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
  }, {rootMargin: '-10% 0px -65% 0px'});
  links.forEach(link => observer.observe(document.querySelector(link.hash)));
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
