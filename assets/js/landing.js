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

  /* The banner scrolls, so WCAG 2.2.2 wants a way to stop it. */
  var tickerPause = document.getElementById('lpTickerPause');

  if (ticker && tickerPause) {
    tickerPause.addEventListener('click', function () {
      var paused = ticker.classList.toggle('is-paused');
      tickerPause.setAttribute('aria-label',
        paused ? 'Resume the scrolling banner' : 'Pause the scrolling banner');
      tickerPause.innerHTML = paused ? '&#9654;' : '&#10073;&#10073;';
    });
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
     any of this. What gets added here is the dot row, the pause control
     and the autoplay, which is why the nav container ships empty and
     hidden: no JavaScript, no inert buttons.

     Pages, not slides. Three slides are visible at once on a desktop and
     one on a phone, so a dot per slide would leave four of six dots
     doing nothing at the wide end. Page count is measured from the
     track's own geometry and recomputed on resize. */
  var quotes = document.getElementById('lpQuotes');
  var qTrack = document.getElementById('lpQuotesTrack');
  var qNav = document.getElementById('lpQuotesNav');

  if (quotes && qTrack && qNav) {
    var QUOTE_MS = 6000;
    var qTimer = null;
    var qStopped = reduced;   /* reduced motion: never starts */
    var qDots = [];
    var qPages = 1;

    var pageCount = function () {
      /*  Round rather than ceil: a fractional last page from sub-pixel
          widths would otherwise add a dot that scrolls nowhere. */
      return Math.max(1, Math.round(qTrack.scrollWidth / qTrack.clientWidth));
    };

    var currentPage = function () {
      if (qTrack.clientWidth === 0) return 0;
      var p = Math.round(qTrack.scrollLeft / qTrack.clientWidth);
      return Math.min(Math.max(p, 0), qPages - 1);
    };

    /*  Takes the page rather than always reading it back off scrollLeft.
        Anything that drives the scroll knows where it is going, and
        smooth scrolling means scrollLeft has not arrived yet at the
        moment it is asked. The no-argument form is for manual swipes,
        where the scroll event is the only thing that knows. */
    var mark = function (page) {
      var at = typeof page === 'number' ? page : currentPage();
      qDots.forEach(function (dot, k) {
        dot.setAttribute('aria-current', k === at ? 'true' : 'false');
      });
    };

    /*  scrollTo with options is ignored wholesale by browsers without
        scroll-behavior, which would leave the carousel stuck on page one,
        so fall back to assigning scrollLeft. */
    var smooth = 'scrollBehavior' in document.documentElement.style;

    var goTo = function (page) {
      var left = page * qTrack.clientWidth;
      if (smooth) {
        qTrack.scrollTo({ left: left, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        qTrack.scrollLeft = left;
      }
      mark(page);
    };

    var pauseBtn = document.createElement('button');
    pauseBtn.type = 'button';
    pauseBtn.className = 'lp-quotes-pause';

    var setPauseLabel = function () {
      pauseBtn.setAttribute('aria-label',
        qStopped ? 'Play the rotating quotes' : 'Pause the rotating quotes');
      pauseBtn.innerHTML = qStopped ? '&#9654;' : '&#10073;&#10073;';
    };

    var stop = function () {
      if (qTimer) { window.clearInterval(qTimer); qTimer = null; }
    };

    var start = function () {
      stop();
      if (qStopped || qPages < 2) return;
      qTimer = window.setInterval(function () {
        goTo((currentPage() + 1) % qPages);
      }, QUOTE_MS);
    };

    var buildDots = function () {
      qPages = pageCount();
      qNav.textContent = '';
      qDots = [];

      /*  One page means nothing to page through, so the whole control row
          stays out of the accessibility tree rather than showing a single
          dot and a pause button for a strip that cannot move. */
      if (qPages < 2) {
        qNav.hidden = true;
        stop();
        return;
      }

      setPauseLabel();
      qNav.appendChild(pauseBtn);

      var list = document.createElement('ul');
      list.className = 'lp-quotes-dots';

      for (var k = 0; k < qPages; k++) {
        (function (page) {
          var li = document.createElement('li');
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'lp-quotes-dot';
          dot.setAttribute('aria-label', 'Show quotes ' + (page + 1) + ' of ' + qPages);
          dot.addEventListener('click', function () {
            goTo(page);
            /*  Clicking a dot is a choice about what to read. Kill the
                autoplay rather than yanking the slide away a moment
                later, and reflect that in the control. */
            qStopped = true;
            setPauseLabel();
            stop();
          });
          li.appendChild(dot);
          list.appendChild(li);
          qDots.push(dot);
        })(k);
      }

      qNav.appendChild(list);
      qNav.hidden = false;
      mark();
      start();
    };

    pauseBtn.addEventListener('click', function () {
      qStopped = !qStopped;
      setPauseLabel();
      if (qStopped) { stop(); } else { start(); }
    });

    /*  Hovering or tabbing into the quotes means someone is reading one.
        This does not touch qStopped, so an explicit pause is not undone
        by the pointer leaving. */
    quotes.addEventListener('mouseenter', stop);
    quotes.addEventListener('mouseleave', start);
    quotes.addEventListener('focusin', stop);
    quotes.addEventListener('focusout', function (e) {
      if (!quotes.contains(e.relatedTarget)) start();
    });

    qTrack.addEventListener('scroll', debounce(mark, 90));
    window.addEventListener('resize', debounce(buildDots, 150));

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
