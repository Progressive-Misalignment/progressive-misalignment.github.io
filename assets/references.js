/* Paper references in Experimental Setup: hover, keyboard focus, or tap. */
(() => {
  for (const trigger of document.querySelectorAll('.dataset-reference')) {
    const card = document.getElementById(trigger.getAttribute('popovertarget'));
    if (!card || !card.showPopover) continue;
    let closeTimer;
    const isOpen = () => card.matches(':popover-open');

    function position() {
      if (!isOpen()) return;
      const anchor = trigger.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > innerHeight) { card.hidePopover(); return; }
      const width = card.offsetWidth, height = card.offsetHeight;
      const left = Math.max(12, Math.min(innerWidth - width - 12, anchor.left));
      const top = anchor.bottom + height + 8 <= innerHeight - 12
        ? anchor.bottom + 8 : anchor.top - height - 8;
      Object.assign(card.style, {
        inset: 'auto', margin: '0', left: `${left}px`,
        top: `${Math.max(12, Math.min(innerHeight - height - 12, top))}px`
      });
    }
    function open() {
      clearTimeout(closeTimer);
      if (!isOpen()) card.showPopover();
      position();
    }
    function scheduleClose() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (isOpen() && !trigger.matches(':hover') && !card.matches(':hover') &&
            document.activeElement !== trigger && !card.contains(document.activeElement)) card.hidePopover();
      }, 180);
    }

    trigger.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') open(); });
    trigger.addEventListener('focus', open);
    trigger.addEventListener('click', event => { event.preventDefault(); open(); });
    trigger.addEventListener('pointerleave', scheduleClose);
    card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    card.addEventListener('pointerleave', scheduleClose);
    card.addEventListener('beforetoggle', event => trigger.setAttribute('aria-expanded', String(event.newState === 'open')));
    document.addEventListener('focusin', event => {
      if (isOpen() && event.target !== trigger && !card.contains(event.target)) card.hidePopover();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isOpen()) {
        if (card.contains(document.activeElement)) trigger.focus({preventScroll: true});
        card.hidePopover();
        event.preventDefault();
      }
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
  }
})();
