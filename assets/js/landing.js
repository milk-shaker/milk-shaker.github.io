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

     The cycle is continuous. A second copy of the six quotes is appended
     to the track, so stepping past the sixth scrolls forward into a
     duplicate of the first rather than rewinding to it. Once that scroll
     settles we jump the track back by one full set with no animation.
     The slide on screen is identical either side of the jump, so it is
     invisible, and the rotation only ever moves forward.

     The copies are what make the dots line up as well. With three cards
     visible and only six slides the track ran out of room, so quotes 4,
     5 and 6 all came to rest in the same place and their dots pointed at
     the same view. With twelve there is always somewhere further to
     scroll, so every dot has its own position. */
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
        quotes read twice is noise, and the originals are already there. */
    real.forEach(function (slide) {
      var copy = slide.cloneNode(true);
      copy.classList.add('is-clone');
      copy.setAttribute('aria-hidden', 'true');
      copy.removeAttribute('role');
      copy.removeAttribute('aria-roledescription');
      copy.removeAttribute('aria-label');
      qTrack.appendChild(copy);
    });

    var slides = [].slice.call(qTrack.querySelectorAll('.lp-quotes-slide'));

    /*  Index we intend to be on, kept rather than read back off
        scrollLeft, which cannot express every index while a smooth
        scroll is still travelling. */
    var at = 0;
    var driving = false;
    var settle = null;

    /*  How far slide k sits from the track's left edge, right now.
        Measured off getBoundingClientRect rather than offsetLeft,
        because offsetLeft is rounded to whole pixels: a slide is
        326.656px wide here, so the rounded step alternates 359, 358,
        359 and the sixth slide lands a fraction off the true multiple.
        That fraction is invisible on its own, but it is the difference
        between a reset that lands exactly on the matching slide and one
        that is always slightly out. */
    var deltaTo = function (k) {
      return slides[k].getBoundingClientRect().left -
             qTrack.getBoundingClientRect().left;
    };

    /*  The slide the track is actually resting on, 0 to 11, copies
        included. Not reduced to a real index here: a swipe that ends up
        among the copies has to be told apart from the same quote in the
        first set, or the next automatic step scrolls backwards to reach
        an index it is already past. */
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
    };

    /*  scrollTo with options is ignored wholesale by browsers without
        scroll-behavior, which would leave the carousel stuck, so fall
        back to assigning scrollLeft. */
    var smooth = 'scrollBehavior' in document.documentElement.style;

    var scrollTo = function (k, animate) {
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

    var goTo = function (k) {
      at = k;
      hold(700);
      scrollTo(k, true);
      mark(k);
    };

    /*  Step forward one, and when that step lands on the first copy,
        rewind a whole set instantly so the next step has room again. */
    var advance = function () {
      var next = at + 1;
      at = next % COUNT;
      hold(1100);
      scrollTo(next, true);
      mark(at);

      if (next >= COUNT) {
        window.setTimeout(function () {
          /*  Subtract one whole set from wherever the track has come to
              rest, rather than scrolling to slide 0's own position.
              A slide is a fractional width, so an absolute target gets
              rounded and the content lands about a pixel out, which is
              a visible twitch at the one moment that has to be
              seamless. Moving by exactly the set width keeps whatever
              sub-pixel phase the track is already in. */
          qTrack.scrollLeft = qTrack.scrollLeft - setWidth();
          /*  This lands within about a sixteenth of a pixel rather than
              exactly. Chrome quantises scrollLeft, and a slide here is
              326.656px wide, so a whole set is not a whole number of
              pixels. Turning snapping off across the move was tried and
              made no difference to the residual. */
        }, reduced ? 0 : 620);
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
          /*  Restart rather than kill the timer: with no pause control,
              a tap must not end the rotation for good. It just buys
              another full interval on the quote you picked. */
          start();
        });
        li.appendChild(dot);
        list.appendChild(li);
        qDots.push(dot);
      });

      qNav.appendChild(list);
      qNav.hidden = false;
      mark(at);
      start();
    };

    /*  Hovering or tabbing into the quotes means someone is reading one. */
    quotes.addEventListener('mouseenter', stop);
    quotes.addEventListener('mouseleave', start);
    quotes.addEventListener('focusin', stop);
    quotes.addEventListener('focusout', function (e) {
      if (!quotes.contains(e.relatedTarget)) start();
    });

    /*  Autoplay gets out of the way for the duration of a drag. Touch
        never fires mouseenter, so without this the timer would advance
        mid-swipe and fight whoever is scrolling. */
    qTrack.addEventListener('pointerdown', stop);
    qTrack.addEventListener('pointerup', start);
    qTrack.addEventListener('pointercancel', start);

    /*  A real swipe redefines where we are, and the rotation picks up
        from there rather than from wherever it had got to on its own.
        start() at the end is what gives the quote just swiped to a full
        interval before it moves on, instead of whatever fraction of one
        was left. */
    qTrack.addEventListener('scroll', debounce(function () {
      if (driving) return;

      var raw = nearestRaw();

      /*  Swiped into the copies. Slide back one whole set so there is
          room ahead again; the quote on screen is the same either side
          of the move, so it is not visible. */
      if (raw >= COUNT) {
        qTrack.scrollLeft = qTrack.scrollLeft - setWidth();
        raw = raw - COUNT;
      }

      at = raw;
      mark(at);
      start();
    }, 120));

    /*  Slide widths change with the breakpoint, so the resting offsets
        do too. Re-seat on the current index rather than leaving the
        track parked between two slides. */
    window.addEventListener('resize', debounce(function () {
      scrollTo(at, false);
      mark(at);
    }, 150));

    buildDots();
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
