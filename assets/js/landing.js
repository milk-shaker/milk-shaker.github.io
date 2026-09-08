/*  Landing page behaviour: the signup confirmation, the attention nudge
    on the primary CTAs, and the popup.

    Deliberately dependency-free and defensive: every hook is optional,
    so this same file can load on the About and legal pages without
    throwing when their elements are absent.  */
(function () {
  'use strict';

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- the nudge -------------------------------------------------------
     Cleared on a timer rather than on animationend: that event is not
     reliably observable headless, and an unfired event would leave the
     class stuck for good. */
  var NUDGE_MS = 1700; /* 0.15s delay + two 0.72s passes, plus slack */

  function nudge(el) {
    if (!el || reduced) return;
    el.classList.add('is-nudging');
    window.setTimeout(function () { el.classList.remove('is-nudging'); }, NUDGE_MS);
  }




  /* --- offer countdown ---------------------------------------------------
     One date constant drives the banner on every page. The markup ships
     with "Limited time" already in it, so with JavaScript off the strip
     still reads correctly and only the day count is missing.

     Change OFFER_ENDS and nothing else. After it passes, the banner
     removes itself rather than counting into the negative. */
  var OFFER_ENDS = new Date('2026-10-14T23:59:59-04:00');

  /*  floor, not ceil: rounding up told people they had 31 days left
      when 30 days and 8 hours remained. A countdown on an offer should
      never claim more time than there is. */
  function phrase(ms) {
    var days = Math.floor(ms / 86400000);
    if (days > 1) return days + ' days left';
    var hours = Math.floor(ms / 3600000);
    if (hours > 1) return hours + ' hours left';
    return 'Closing today';
  }

  var ticker = document.getElementById('lpTicker');
  var track = ticker && ticker.querySelector('.lp-ticker-track');

  if (ticker && track) {
    var msLeft = OFFER_ENDS.getTime() - Date.now();

    if (msLeft <= 0) {
      ticker.remove();
      ticker = null;
    } else {
      /*  Every run has to say the same thing. The countdown used to be
          written into the first run only, which made the two runs
          different widths, so translating by half the track no longer
          landed on a matching frame and the loop visibly jumped. */
      var text = phrase(msLeft);
      Array.prototype.forEach.call(track.querySelectorAll('[data-countdown]'), function (el) {
        el.textContent = text;
      });

      layoutTicker();
      window.addEventListener('resize', debounce(layoutTicker, 200));
    }
  }

  /*  Repeat the run until the track is at least one run wider than the
      window, so there is always something entering as something leaves,
      then loop by exactly one run's width. Below that threshold a
      marquee runs out of content and shows a gap on wide screens. */
  function layoutTicker() {
    if (!track) return;

    var runs = track.querySelectorAll('.lp-ticker-run');
    var first = runs[0];
    if (!first) return;

    var runWidth = first.getBoundingClientRect().width;
    if (!runWidth) return;

    var needed = Math.ceil((window.innerWidth + runWidth) / runWidth) + 1;

    for (var i = runs.length; i < needed; i++) {
      var copy = first.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      /*  Duplicated ids would be invalid, and the copies are decorative. */
      Array.prototype.forEach.call(copy.querySelectorAll('[id]'), function (el) {
        el.removeAttribute('id');
      });
      track.appendChild(copy);
    }

    track.style.setProperty('--lp-run', runWidth + 'px');
    /*  Constant speed regardless of how wide a run turns out to be. */
    track.style.setProperty('--lp-dur', (runWidth / 55).toFixed(2) + 's');
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      window.clearTimeout(t);
      t = window.setTimeout(fn, wait);
    };
  }

  /*  The clock on the early access page. Same constant, fuller wording,
      and the markup already carries the date so it reads correctly with
      no JavaScript at all. */
  var clock = document.getElementById('lpClock');

  if (clock) {
    var left = OFFER_ENDS.getTime() - Date.now();
    clock.textContent = left <= 0
      ? 'This offer has closed.'
      : phrase(left) + ' to join';
  }

  /* --- LaunchList iframe title ------------------------------------------
     Their widget injects an <iframe> with no title attribute, which
     leaves screen readers announcing an unlabelled frame. We cannot
     change what they inject, so name it as it arrives. */
  var widgets = document.querySelectorAll('.launchlist-widget');

  if (widgets.length && 'MutationObserver' in window) {
    Array.prototype.forEach.call(widgets, function (holder) {
      var label = function () {
        var frame = holder.querySelector('iframe:not([title])');
        if (frame) frame.setAttribute('title', 'Join the MilkShaker list');
        return !!frame;
      };
      if (label()) return;
      var obs = new MutationObserver(function () {
        if (label()) obs.disconnect();
      });
      obs.observe(holder, { childList: true });
    });
  }

  /* --- the menu ---------------------------------------------------------
     Same contract as the popup: Esc and the scrim close it, Tab is
     trapped inside while it is open, focus returns to the button that
     opened it, and the page behind cannot scroll. */
  var menu = document.getElementById('lpMenu');
  var menuBtn = document.getElementById('lpMenuBtn');

  if (menu && menuBtn) {
    var menuFocusable = function () {
      return menu.querySelectorAll('a[href], button:not([disabled]):not([tabindex="-1"])');
    };

    var closeMenu = function () {
      if (menu.hidden) return;
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.classList.remove('has-menu');
      menuBtn.focus();
    };

    var openMenu = function () {
      if (!menu.hidden) return;
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.classList.add('has-menu');
      var first = menuFocusable()[0];
      if (first) first.focus();
    };

    menuBtn.addEventListener('click', function () {
      if (menu.hidden) { openMenu(); } else { closeMenu(); }
    });

    Array.prototype.forEach.call(menu.querySelectorAll('[data-menu-close]'), function (el) {
      el.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (menu.hidden) return;

      if (event.key === 'Escape') { closeMenu(); return; }
      if (event.key !== 'Tab') return;

      var items = menuFocusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });
  }

  /* --- popup -----------------------------------------------------------
     Opens on a timer, per request. The reference build triggers on
     scroll depth instead, because a timed interstitial can land
     mid-read and Google counts intrusive interstitials against mobile
     ranking. To switch, replace the setTimeout below with a scroll
     handler that fires once past ~20% of the scrollable height.

     Dismissal is remembered for the browser session, so closing it once
     keeps it closed until the tab is gone. */
  var modal = document.getElementById('lpModal');

  if (modal) {
    var DELAY_MS = 6000;
    var KEY = 'ms-modal-dismissed';
    var lastFocus = null;
    var timer = null;

    function dismissed() {
      try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
    }

    function remember() {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* private mode */ }
    }

    function focusable() {
      /* iframe included: with the form supplied by LaunchList it is the
         only focusable thing in the panel besides the close button. */
      return modal.querySelectorAll(
        'button:not([disabled]):not([tabindex="-1"]), a[href], iframe, input:not([type="hidden"]):not([tabindex="-1"])'
      );
    }

    function close() {
      if (modal.hidden) return;
      modal.hidden = true;
      document.documentElement.classList.remove('has-modal');
      remember();
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function open() {
      if (!modal.hidden || dismissed()) return;
      /* not over an open menu */
      if (menu && !menu.hidden) return;
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.documentElement.classList.add('has-modal');

      var first = focusable()[0];
      if (first) first.focus();

      /* after the panel's own entrance animation, not competing with it */
      window.setTimeout(function () {
        nudge(document.getElementById('lpModalCta'));
      }, 750);
    }

    if (!dismissed()) timer = window.setTimeout(open, DELAY_MS);

    Array.prototype.forEach.call(modal.querySelectorAll('[data-modal-close]'), function (el) {
      el.addEventListener('click', close);
    });

    /* Following the CTA counts as dealt with, so the popup should not
       reappear on the page they land on. The link also carries
       data-modal-close, so the panel shuts on the way out. */
    var cta = modal.querySelector('#lpModalCta');
    if (cta) cta.addEventListener('click', remember);

    document.addEventListener('keydown', function (event) {
      if (modal.hidden) return;

      if (event.key === 'Escape') { close(); return; }
      if (event.key !== 'Tab') return;

      /* trap Tab inside the panel while it is open */
      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    });

    /* If someone reaches the signup panel on their own, the popup has
       nothing left to offer and cancelling it is politer than firing it
       over the form they are already filling in. */
    var join = document.getElementById('join');
    if (join && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        if (timer) window.clearTimeout(timer);
        remember();
        obs.disconnect();
      }, { threshold: 0.35 }).observe(join);
    }
  }

  /* --- 07 quotes carousel ------------------------------------------------
     The track is a scroll-snap strip in the markup and scrolls without
     any of this. What gets added here is the dot row and the rotation,
     which is why the nav container ships empty and hidden: no
     JavaScript, no inert buttons.

     The highlighted quote is the middle one on screen. Everything else
     is dimmed by CSS, so this has to keep .is-current on whichever quote
     is centred, whether the rotation put it there or a swipe did.

     Continuous, with a copy of the six on each side. Copies after mean
     stepping past the sixth quote moves forward into a duplicate of the
     first rather than rewinding; copies before mean the first quote has
     something to its left and can sit in the middle at all. Once a step
     leaves the middle set, the track is shifted a whole set with no
     animation: the quote on screen is identical either side of the
     shift, so it cannot be seen. */
  var quotes = document.getElementById('lpQuotes');
  var qTrack = document.getElementById('lpQuotesTrack');
  var qNav = document.getElementById('lpQuotesNav');

  if (quotes && qTrack && qNav) {
    var QUOTE_MS = 5000;
    var qTimer = null;
    var qDots = [];

    var real = [].slice.call(qTrack.querySelectorAll('.lp-quotes-slide'));
    var COUNT = real.length;

    /*  Hidden from assistive tech and from the tab order: the same six
        quotes read three times is noise, and the originals are there. */
    var clone = function (slide) {
      var copy = slide.cloneNode(true);
      copy.classList.add('is-clone');
      copy.setAttribute('aria-hidden', 'true');
      copy.removeAttribute('role');
      copy.removeAttribute('aria-roledescription');
      copy.removeAttribute('aria-label');
      return copy;
    };

    real.forEach(function (slide) { qTrack.appendChild(clone(slide)); });
    for (var c = COUNT - 1; c >= 0; c--) {
      qTrack.insertBefore(clone(real[c]), qTrack.firstChild);
    }

    var slides = [].slice.call(qTrack.querySelectorAll('.lp-quotes-slide'));
    var BASE = COUNT;              /* index of the first real slide */

    var at = 0;                    /* real index, 0 to COUNT-1 */
    var driving = false;
    var settle = null;

    /*  Distance from a slide's centre to the track's centre. Centre
        rather than left edge, because the middle slide is the subject. */
    var deltaTo = function (k) {
      var sr = slides[k].getBoundingClientRect();
      var tr = qTrack.getBoundingClientRect();
      return (sr.left + sr.right) / 2 - (tr.left + tr.right) / 2;
    };

    var nearestRaw = function () {
      var best = 0, dist = Infinity;
      slides.forEach(function (_, k) {
        var d = Math.abs(deltaTo(k));
        if (d < dist - 1) { dist = d; best = k; }
      });
      return best;
    };

    var setWidth = function () {
      return slides[COUNT].getBoundingClientRect().left -
             slides[0].getBoundingClientRect().left;
    };

    var mark = function (k) {
      var n = ((k % COUNT) + COUNT) % COUNT;
      qDots.forEach(function (dot, i) {
        dot.setAttribute('aria-current', i === n ? 'true' : 'false');
      });
      slides.forEach(function (sl, i) {
        sl.classList.toggle('is-current', (i % COUNT) === n);
      });
    };

    /*  scrollTo with options is ignored wholesale by browsers without
        scroll-behavior, which would leave the carousel stuck, so fall
        back to assigning scrollLeft. */
    var smooth = 'scrollBehavior' in document.documentElement.style;

    var scrollToSlide = function (k, animate) {
      var left = qTrack.scrollLeft + deltaTo(k);
      if (smooth && animate && !reduced) {
        qTrack.scrollTo({ left: left, behavior: 'smooth' });
      } else {
        qTrack.scrollLeft = left;
      }
    };

    var hold = function (ms) {
      driving = true;
      if (settle) window.clearTimeout(settle);
      settle = window.setTimeout(function () { driving = false; }, ms);
    };

    /*  Bring the track back into the middle set if a step or a swipe has
        left it. Relative, by exactly one set width, so whatever
        sub-pixel phase the track is in is preserved: an absolute target
        gets rounded and lands about a pixel out, which is a visible
        twitch at the one moment that has to be seamless. */
    var recentre = function (slideIndex) {
      if (slideIndex >= BASE && slideIndex < BASE + COUNT) return slideIndex;
      var shift = slideIndex < BASE ? setWidth() : -setWidth();
      qTrack.scrollLeft = qTrack.scrollLeft - shift;
      return slideIndex + (slideIndex < BASE ? COUNT : -COUNT);
    };

    var goTo = function (realIndex) {
      at = ((realIndex % COUNT) + COUNT) % COUNT;
      hold(800);
      scrollToSlide(BASE + at, true);
      mark(at);
    };

    /*  One step forward. When that step leaves the middle set the shift
        happens after the scroll has landed, so the movement itself is
        always forward and always one slide. */
    var advance = function () {
      var target = BASE + at + 1;
      at = (at + 1) % COUNT;
      hold(1200);
      scrollToSlide(target, true);
      mark(at);

      if (target >= BASE + COUNT) {
        window.setTimeout(function () { recentre(target); }, reduced ? 0 : 640);
      }
    };

    var stop = function () {
      if (qTimer) { window.clearInterval(qTimer); qTimer = null; }
    };

    var start = function () {
      stop();
      if (reduced || COUNT < 2) return;
      qTimer = window.setInterval(advance, QUOTE_MS);
    };

    var buildDots = function () {
      qNav.textContent = '';
      qDots = [];

      var list = document.createElement('ul');
      list.className = 'lp-quotes-dots';

      real.forEach(function (_, k) {
        var li = document.createElement('li');
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'lp-quotes-dot';
        dot.setAttribute('aria-label', 'Show quote ' + (k + 1) + ' of ' + COUNT);
        dot.addEventListener('click', function () {
          goTo(k);
          /*  Restart rather than kill the timer: with no pause control, a
              tap must not end the rotation for good. It buys another full
              interval on the quote you picked. */
          start();
        });
        li.appendChild(dot);
        list.appendChild(li);
        qDots.push(dot);
      });

      qNav.appendChild(list);
      qNav.hidden = false;
    };

    /*  Hovering or tabbing into the quotes means someone is reading one. */
    quotes.addEventListener('mouseenter', stop);
    quotes.addEventListener('mouseleave', start);
    quotes.addEventListener('focusin', stop);
    quotes.addEventListener('focusout', function (e) {
      if (!quotes.contains(e.relatedTarget)) start();
    });

    /*  Autoplay gets out of the way for the length of a drag. Touch never
        fires mouseenter, so without this the timer would advance
        mid-swipe and fight whoever is scrolling. */
    qTrack.addEventListener('pointerdown', stop);
    qTrack.addEventListener('pointerup', start);
    qTrack.addEventListener('pointercancel', start);

    /*  A swipe decides where the rotation carries on from, and the quote
        swiped to gets a full interval before it moves on. */
    qTrack.addEventListener('scroll', debounce(function () {
      if (driving) return;
      var landed = recentre(nearestRaw());
      at = ((landed - BASE) % COUNT + COUNT) % COUNT;
      mark(at);
      start();
    }, 120));

    /*  Slide widths change with the breakpoint, so the resting offsets do
        too. Re-seat on the current quote rather than leaving the track
        parked between two. */
    window.addEventListener('resize', debounce(function () {
      scrollToSlide(BASE + at, false);
      mark(at);
    }, 150));

    buildDots();
    /*  Start on the first real quote, which is a set in from the left.
        is-live is what lets the dimming apply: without the class every
        quote stays at full strength, so a browser that never runs this
        shows six readable quotes rather than five faded ones. */
    qTrack.classList.add('is-live');
    scrollToSlide(BASE, false);
    mark(0);
    start();
  }

  /* --- scroll reveal ----------------------------------------------------
     Sections fade up the first time they come into view.

     The hidden state lives behind .has-reveal on <html>, set here rather
     than written into the markup, so that a browser this script never
     reaches renders every section normally instead of a blank page. It
     is set before observing, and only when there is something to do the
     revealing with. */
  var revealable = document.querySelectorAll('.lp-reveal, .lp-reveal--stagger');

  if (revealable.length && 'IntersectionObserver' in window && !reduced) {
    document.documentElement.classList.add('has-reveal');

    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-visible');
        revealer.unobserve(el);
        /*  Drop will-change once it has arrived: holding it on every
            section is a standing cost for a one-off animation. 1500ms
            covers the 1.05s travel plus the 0.3s last stagger step, with
            a little slack. */
        window.setTimeout(function () { el.classList.add('is-settled'); }, 1500);
      });
    }, {
      /*  Fires a little before the section reaches the viewport floor,
          so the movement is mostly over by the time it is properly in
          view. The first pass used -12% and 0.08, which on a phone meant
          a tall section was already well on screen before it started,
          and you watched it animate rather than finding it settled.

          Threshold 0 with a negative bottom margin, rather than a
          fraction of the element: a section taller than the viewport
          cannot reach 8% visible at the moment it enters, so a
          proportional threshold delays exactly the sections that need
          the most warning. */
      rootMargin: '0px 0px -8% 0px',
      threshold: 0
    });

    Array.prototype.forEach.call(revealable, function (el) { revealer.observe(el); });

    /*  Anything already on screen at load should not animate in: it was
        there before the visitor could scroll. Observing covers this on
        its own because the callback fires immediately for intersecting
        elements, which is why the class is added rather than removed. */
  }

  /* --- nudge in-page CTAs as they scroll into view --------------------- */
  var pending = [].slice.call(document.querySelectorAll('.lp-btn--nudge'))
    .filter(function (el) { return !modal || !modal.contains(el); });

  if (pending.length && 'IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        nudge(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    pending.forEach(function (el) { io.observe(el); });
  }
})();
