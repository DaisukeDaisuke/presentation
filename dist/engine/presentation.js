/* Shared engine: text and deck-specific content stay in each presentation's HTML. */
class DeckSlide extends HTMLElement {}
class DeckFragment extends HTMLElement {}
class DeckCommand extends HTMLElement {
  connectedCallback() {
    if (this.bound) return;
    this.bound = true;
    this.addEventListener('click', (event) => {
      if (!event.target.closest('button')) return;
      const deck = this.closest('presentation-deck') || document.querySelector('presentation-deck');
      if (!deck || event.target.closest('button').disabled) return;
      deck.command(this.getAttribute('command'), this.getAttribute('to'));
    });
  }
}
class PresentationDeck extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.slides = [...this.querySelectorAll('deck-slide')];
    this.byId = new Map(this.slides.map(slide => [slide.id, slide]));
    this.roots = this.slides.filter(slide => slide.parentElement === this);
    this.progress = new Map();
    this.runningAnimations = [];
    this.panels = new Map(this.slides.map(slide => [slide, slide.querySelector(':scope > .slide-body')]));
    this.fragmentGroups = new Map(this.slides.map(slide => {
      const groups = new Map();
      [...this.panels.get(slide).querySelectorAll('deck-fragment')].forEach((fragment, index) => {
        const step = Number(fragment.getAttribute('step')) || index + 1;
        if (!groups.has(step)) groups.set(step, []);
        groups.get(step).push(fragment);
      });
      return [slide, [...groups].sort(([a], [b]) => a - b).map(([, fragments]) => fragments)];
    }));
    this.dialog = document.getElementById('deck-map');
    this.controller = new AbortController();
    const options = { signal: this.controller.signal };
    document.addEventListener('keydown', event => this.keydown(event), options);
    window.addEventListener('hashchange', () => this.restore(), options);
    window.addEventListener('resize', () => this.fit(), options);
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const id = this.hashId(link.hash);
      if (!this.byId.has(id)) return;
      event.preventDefault();
      this.go(id);
      this.closeMap();
    }, options);
    this.dialog?.addEventListener('click', event => {
      if (event.target === this.dialog) {
        const box = this.dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.closeMap();
      }
    }, options);
    this.setAttribute('ready', '');
    this.fit();
    this.restore(false);
  }
  disconnectedCallback() {
    this.controller?.abort();
    this.runningAnimations?.forEach(animation => animation.cancel());
    this.ready = false;
  }
  hashId(hash) {
    try { return decodeURIComponent(hash.replace(/^#/, '').split('/')[0]); } catch { return ''; }
  }
  fit() {
    if (!document.body.classList.contains('talk')) return;
    this.style.setProperty('--deck-scale', Math.min((innerWidth - 20) / 1280, (innerHeight - 72) / 720));
  }
  restore(focus = true) {
    const id = this.hashId(location.hash);
    const step = Number(location.hash.split('/')[1]) || 0;
    this.go(this.byId.has(id) ? id : this.roots[0]?.id, { history: false, focus, step });
  }
  destination(direction, from = this.current) {
    if (!from) return null;
    if (from.hasAttribute(direction)) return this.byId.get(from.getAttribute(direction)) || null;
    if (direction === 'up') return from.parentElement.matches('deck-slide') ? from.parentElement : null;
    if (direction === 'down') return from.querySelector(':scope > deck-slide');
    const siblings = [...from.parentElement.children].filter(element => element.matches('deck-slide'));
    return siblings[siblings.indexOf(from) + (direction === 'left' ? -1 : 1)] || null;
  }
  go(id, { history: addHistory = true, focus = true, step, forward = false } = {}) {
    const next = this.byId.get(id);
    if (!next) return false;
    const changed = next !== this.current;
    const previousStep = changed ? 0 : this.step;
    this.runningAnimations.forEach(animation => animation.cancel());
    this.runningAnimations = [];
    this.current = next;
    const groups = this.fragmentGroups.get(next) || [];
    const requestedStep = step ?? this.progress.get(id) ?? 0;
    this.step = Math.max(0, Math.min(groups.length, Math.trunc(requestedStep) || 0));
    this.progress.set(id, this.step);
    groups.forEach((fragments, index) => fragments.forEach(fragment => {
      const pending = index >= this.step;
      fragment.toggleAttribute('data-pending', pending);
      fragment.inert = pending;
      fragment.setAttribute('aria-hidden', String(pending));
    }));
    for (const [slide, panel] of this.panels) {
      if (panel) panel.hidden = slide !== next;
      slide.toggleAttribute('active', slide === next);
    }
    let root = next;
    while (root.parentElement.matches('deck-slide')) root = root.parentElement;
    document.querySelectorAll('.chapter-nav a').forEach(link => {
      if (link.hash === '#' + root.id) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    document.querySelectorAll('deck-command').forEach(control => {
      const rawCommand = control.getAttribute('command');
      const direction = rawCommand === 'next' ? 'right' : rawCommand === 'previous' ? 'left' : rawCommand;
      if (['left', 'right', 'up', 'down'].includes(direction)) {
        const target = this.destination(direction);
        const button = control.querySelector('button');
        const fragmentMove = direction === 'right' ? this.step < groups.length : direction === 'left' && this.step > 0;
        if (button) button.disabled = !target && !fragmentMove;
      }
    });
    const count = document.querySelector('[data-page-number]');
    if (count) count.textContent = String(this.roots.indexOf(root) + 1).padStart(2, '0');
    const slideCount = document.querySelector('[data-slide-number]');
    if (slideCount) slideCount.textContent = String(this.slides.indexOf(next) + 1);
    const stepCount = document.querySelector('[data-step-number]');
    if (stepCount) stepCount.textContent = String(this.step);
    const stepTotal = document.querySelector('[data-step-total]');
    if (stepTotal) stepTotal.textContent = String(groups.length);
    const depth = next !== root;
    document.querySelector('[data-branch-marker]')?.toggleAttribute('hidden', !depth);
    const panel = this.panels.get(next);
    if (changed) {
      if (panel) panel.scrollTop = 0;
      window.scrollTo(0, 0);
      if (focus) panel?.focus({ preventScroll: true });
    }
    if (forward && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const targets = changed ? [panel] : groups.slice(previousStep, this.step).flat();
      this.runningAnimations = targets.filter(Boolean).map(element => element.animate(
        [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' }
      ));
    }
    const hash = '#' + encodeURIComponent(id) + (this.step ? '/' + this.step : '');
    if (addHistory && location.hash !== hash) history.pushState(null, '', hash);
    else if (!addHistory && location.hash !== hash) history.replaceState(null, '', hash);
    this.dispatchEvent(new CustomEvent('slidechange', { detail: { id, root: root.id, step: this.step, steps: groups.length }, bubbles: true }));
    return true;
  }
  closeMap() {
    if (!this.dialog?.open) return;
    this.dialog.close();
    this.panels.get(this.current)?.focus({ preventScroll: true });
  }
  command(name, to) {
    if (name === 'next') name = 'right';
    if (name === 'previous') name = 'left';
    if (['left', 'right', 'up', 'down'].includes(name)) {
      const groups = this.fragmentGroups.get(this.current) || [];
      if (name === 'right' && this.step < groups.length) {
        this.go(this.current.id, { step: this.step + 1, focus: false, forward: true });
        return;
      }
      if (name === 'left' && this.step > 0) {
        this.go(this.current.id, { step: this.step - 1, focus: false });
        return;
      }
      const target = this.destination(name);
      if (target) this.go(target.id, {
        step: name === 'left' ? this.fragmentGroups.get(target).length : name === 'right' ? 0 : undefined,
        forward: name === 'right' || name === 'down'
      });
    } else if (name === 'goto') this.go(to);
    else if (name === 'home') this.go(this.roots[0].id, { step: 0 });
    else if (name === 'end') this.go(this.roots.at(-1).id, { step: 0 });
    else if (name === 'overview') this.dialog?.showModal();
    else if (name === 'close') this.closeMap();
    else if (name === 'fullscreen') {
      if (!document.fullscreenElement && !document.documentElement.requestFullscreen) {
        document.querySelector('[data-fullscreen-error]')?.removeAttribute('hidden');
        return;
      }
      const task = document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.();
      task?.catch(() => { document.querySelector('[data-fullscreen-error]')?.removeAttribute('hidden'); });
    }
  }
  keydown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    if (this.dialog?.open) return; // Native dialog handles focus and Escape.
    if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-deck-keys="off"], audio, video')) return;
    const commands = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end', PageDown: 'right', PageUp: 'left', m: 'overview', M: 'overview', f: 'fullscreen', F: 'fullscreen' };
    const command = commands[event.key];
    if (!command || event.repeat) return;
    event.preventDefault();
    this.command(command);
  }
}
customElements.define('deck-slide', DeckSlide);
customElements.define('deck-fragment', DeckFragment);
customElements.define('deck-command', DeckCommand);
customElements.define('presentation-deck', PresentationDeck);
