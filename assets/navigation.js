// Section links work without JavaScript; enhance them with position and a mobile menu.
(() => {
  const contents = document.querySelector('.contents');
  const toggle = contents.querySelector('.contents-toggle');
  const currentLabel = contents.querySelector('.contents-current');
  const links = [...contents.querySelectorAll('a[href^="#"]')];
  const sections = links.map(link => document.querySelector(link.hash));
  const compact = matchMedia('(max-width: 1359px)');

  function closeMenu() {
    contents.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => {
    const open = contents.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (!contents.contains(event.target)) closeMenu();
  });
  contents.addEventListener('keydown', event => {
    if (event.key === 'Escape' && contents.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });
  compact.addEventListener('change', closeMenu);

  let queued = false;
  function updateCurrentSection() {
    let current = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= 96) current = index;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = links.length - 1;
    }
    links.forEach((link, index) => {
      if (index === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    currentLabel.textContent = links[current].childNodes[0].textContent.trim();
    queued = false;
  }
  function queueUpdate() {
    if (!queued) { queued = true; requestAnimationFrame(updateCurrentSection); }
  }
  window.addEventListener('scroll', queueUpdate, {passive: true});
  window.addEventListener('resize', queueUpdate);
  window.addEventListener('hashchange', queueUpdate);
  window.addEventListener('load', queueUpdate);
  document.fonts.ready.then(queueUpdate);
  updateCurrentSection();
})();
