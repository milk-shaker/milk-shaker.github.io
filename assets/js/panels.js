/*  Shared by the landing page and /coming-soon-early-access.html.

    Every block guards on the element it drives, so each page runs only
    the parts it actually has: the hero video and the relief wash on
    both, the panel 2 zoom and the cup reveal only where those exist.  */

(function () {
  'use strict';

  var root = document.documentElement;
  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  var hero = document.querySelector('.p1-video');

  if (hero && still) {
    /*  A looping hero is exactly what a reduced-motion preference is
        asking about, so hold it on its first frame rather than play
        it. autoplay is left in the markup so it still runs with no
        JS; the poster is what shows here. */
    hero.removeAttribute('autoplay');
    hero.pause();
  } else if (hero) {
    /*  The attribute alone is not always enough. Safari wants the
        muted property set, not just the attribute, before it will
        honour autoplay -- and iOS refuses autoplay altogether in Low
        Power Mode. So ask directly, swallow the rejection, and try
        once more on the first touch, which is a gesture iOS accepts.
        If none of that works the poster is still sitting there. */
    hero.muted = true;
    var tryPlay = function () {
      var p = hero.play();
      if (p && p.catch) p.catch(function () {});
    };
    tryPlay();
    var onFirstTouch = function () {
      if (hero.paused) tryPlay();
      document.removeEventListener('touchstart', onFirstTouch);
      document.removeEventListener('pointerdown', onFirstTouch);
    };
    document.addEventListener('touchstart', onFirstTouch, { passive: true });
    document.addEventListener('pointerdown', onFirstTouch, { passive: true });
  }

  /*  ------------------------------------------------------------
      The relief wash. Target is where the pointer is; current eases
      toward it. The low factor is the point of the whole thing:
      relief arrives slowly, it does not snap. Coarse pointer or
      reduced motion keeps the static glow the CSS parked.
      ------------------------------------------------------------ */
  var relief = document.getElementById('csRelief');
  if (relief && fine && !still) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var tx = vw * 0.5, ty = vh * 0.42;
    var cx = tx, cy = ty;
    var rraf = null;

    window.addEventListener('resize', function () {
      vw = window.innerWidth; vh = window.innerHeight;
    }, { passive: true });

    var loop = function () {
      cx += (tx - cx) * 0.055;
      cy += (ty - cy) * 0.055;
      relief.style.setProperty('--mx', cx.toFixed(1) + 'px');
      relief.style.setProperty('--my', cy.toFixed(1) + 'px');
      rraf = (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4)
        ? requestAnimationFrame(loop) : null;
    };
    var nudge = function () { if (rraf == null) rraf = requestAnimationFrame(loop); };

    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY; nudge();
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      tx = vw * 0.5; ty = vh * 0.42; nudge();
    });
  }

  /*  ------------------------------------------------------------
      PANEL 2 ZOOM
      Progress through the runway drives one scale and one radius.
      The runway is (section height - pin height), which is exactly
      the distance the pin stays stuck for, so progress hits 1 the
      moment the pin is about to release.
      ------------------------------------------------------------ */
  var p2 = document.getElementById('p2');
  if (p2 && !still) {
    var MIN = 0.58;
    var zraf = null;

    var paint = function () {
      zraf = null;
      var box = p2.getBoundingClientRect();
      var runway = p2.offsetHeight - window.innerHeight;
      if (runway <= 0) return;

      /*  -box.top is how far into the section the scroll has come. */
      var p = (-box.top) / runway;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);

      /*  Ease out, so it opens quickly and settles rather than
          arriving at full size all at once at the end. */
      var e = 1 - Math.pow(1 - p, 2.2);

      root.style.setProperty('--z', (MIN + (1 - MIN) * e).toFixed(4));
      root.style.setProperty('--zr', (30 * (1 - e)).toFixed(1) + 'px');
      /*  The line under the product comes up over the last third. */
      var o = (e - 0.45) / 0.4;
      root.style.setProperty('--zo', (o < 0 ? 0 : (o > 1 ? 1 : o)).toFixed(3));
    };

    var onScroll = function () { if (zraf == null) zraf = requestAnimationFrame(paint); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /*  ------------------------------------------------------------
      THE CUP REVEAL
      One class on the stage drives the fabric, the insert and the
      marker. Pointer opens it on enter; keyboard opens it on focus;
      touch toggles it on click, so it is not hover-only.
      ------------------------------------------------------------ */
  var stage = document.getElementById('stage');
  var callout = document.getElementById('callout');
  var hint = document.getElementById('p2Hint');

  if (stage && callout) {
    var COPY = {
      l: '<strong>Clinically-proven therapy, automated for you</strong>Gentle massaging modules within ' +
         'internal pockets rest against your breast and provide inflammation and pain relief allowing milk ' +
         'to flow more freely&mdash;while you nurse, pump, or carry on with your day.',
      r: '<strong>Portable and intentionally hands-free</strong>Wireless, rechargeable, nursing bra design ' +
         'built for mobility and your busy life. The removable modules lift out, can charge while the bra ' +
         'is in the wash, and you have another week of use.',
      sl: '<strong>Shoulder straps</strong>Adjustable for comfort and removable for convenient nursing.',
      sr: '<strong>Shoulder straps</strong>Adjustable for comfort and removable for convenient nursing.'
    };
    var pinned = null;

    var SIDES = ['l', 'r', 'sl', 'sr'];

    var show = function (side) {
      SIDES.forEach(function (s) {
        stage.classList.toggle('is-' + s, side === s);
      });
      if (side) {
        callout.innerHTML = COPY[side];
        callout.classList.add('is-on');
      } else {
        callout.classList.remove('is-on');
      }
    };

    Array.prototype.forEach.call(stage.querySelectorAll('.hot'), function (btn) {
      var side = btn.getAttribute('data-side');

      btn.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        show(side);
      });
      btn.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'touch') return;
        if (!pinned) show(null);
      });
      btn.addEventListener('focus', function () { show(side); });
      btn.addEventListener('blur', function () { if (!pinned) show(null); });

      /*  Tap, or a deliberate click: hold it open until the next tap
          somewhere else. */
      btn.addEventListener('click', function () {
        pinned = (pinned === side) ? null : side;
        show(pinned);
      });
    });

    document.addEventListener('click', function (e) {
      if (pinned && !e.target.closest('.hot')) { pinned = null; show(null); }
    });

    if (hint && !fine) hint.textContent = 'Tap around the MilkShaker bra to see features';

    /*  Reserve exactly the tallest copy at this width. Hardcoding it
        per breakpoint went wrong the moment the copy changed -- at
        375px the longest one wanted 249px against the 195px the
        clamp gave it, and the tile ran off the bottom of the card.
        Measuring means it survives both a reword and any viewport.
        The callout is opacity 0, not display none, so it lays out
        and reports a real height without ever being seen. */
    var slot = stage.parentNode.querySelector('.p2-slot');

    var sizeSlot = function () {
      if (!slot) return;
      var keep = callout.innerHTML;
      var tallest = 0;
      SIDES.forEach(function (side) {
        callout.innerHTML = COPY[side];
        if (callout.offsetHeight > tallest) tallest = callout.offsetHeight;
      });
      callout.innerHTML = keep;
      if (tallest) slot.style.minHeight = tallest + 'px';
    };

    /*  After fonts, because the display face changes the line count. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sizeSlot);
    } else {
      sizeSlot();
    }

    var slotTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(slotTimer);
      slotTimer = setTimeout(sizeSlot, 150);
    }, { passive: true });
  }

  /*  ------------------------------------------------------------
      SCROLL-LINKED FADES
      Each [data-reveal] band fades in as it rises into view and back
      out as it leaves, in both directions, tied to scroll position
      rather than to a one-shot trigger -- so scrolling back up plays
      it again, the way the reference site does.

      The hero does the same on its own terms: the wordmark sinks and
      fades out by the bottom of the first panel, and the top bar is
      gone by the middle of it.

      Values are written straight onto the elements each frame, so
      there is no CSS transition fighting the scroll position.
      ------------------------------------------------------------ */
  var bands = document.querySelectorAll('[data-reveal]');
  var heroPanel = document.querySelector('.p1');
  var heroCopy = document.querySelector('.p1-copy');
  var topBar = document.querySelector('.ms-nav');
  var navFades = topBar && !topBar.classList.contains('ms-nav--page');

  if ((bands.length || heroCopy) && !still) {
    Array.prototype.forEach.call(bands, function (el) { el.classList.add('js-fade'); });

    var clamp01 = function (n) { return n < 0 ? 0 : (n > 1 ? 1 : n); };

    var paintFades = function () {
      var vh = window.innerHeight || 1;

      Array.prototype.forEach.call(bands, function (el) {
        var r = el.getBoundingClientRect();

        /*  Up to full strength over the last 55% of the viewport as the
            band rises, and back down again as it climbs out of the top.
            Whichever of the two is further along wins. */
        var rising = clamp01((vh - r.top - vh * 0.12) / (vh * 0.55));
        var leaving = clamp01((r.bottom - vh * 0.06) / (vh * 0.42));
        var v = Math.min(rising, leaving);

        el.style.opacity = v.toFixed(3);
        el.style.transform = 'translateY(' + ((1 - v) * 26).toFixed(1) + 'px)';
      });

      if (heroPanel && heroCopy) {
        var hr = heroPanel.getBoundingClientRect();
        var p = clamp01(-hr.top / Math.max(1, hr.height));

        /*  Sinks and fades, finishing exactly at the panel's bottom. */
        heroCopy.style.opacity = (1 - p).toFixed(3);
        heroCopy.style.transform = 'translateY(' + (p * 90).toFixed(1) + 'px)';

        if (navFades) {
          /*  Gone by the middle of the panel, and not clickable once it
              is invisible. */
          var np = clamp01(p / 0.5);
          topBar.style.opacity = (1 - np).toFixed(3);
          topBar.style.pointerEvents = np > 0.92 ? 'none' : '';
        }
      }
    };

    var fadeRaf = null;
    var onFadeScroll = function () {
      if (fadeRaf == null) fadeRaf = requestAnimationFrame(function () {
        fadeRaf = null;
        paintFades();
      });
    };

    window.addEventListener('scroll', onFadeScroll, { passive: true });
    window.addEventListener('resize', onFadeScroll, { passive: true });
    paintFades();
  }
})();
