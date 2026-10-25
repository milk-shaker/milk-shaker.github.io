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
  var heroPoster = document.querySelector('.p1-poster');

  if (hero) {
    var mobileHeroSource = hero.getAttribute('data-mobile-src');
    var desktopHeroSource = hero.getAttribute('data-desktop-src');
    var selectedHeroSource = window.matchMedia('(max-width: 767px)').matches
      ? mobileHeroSource
      : desktopHeroSource;
    if (selectedHeroSource) hero.src = selectedHeroSource;
  }

  if (hero && heroPoster) {
    hero.addEventListener('playing', function () {
      heroPoster.hidden = true;
    }, { once: true });
    if (!hero.paused && hero.readyState >= 2) heroPoster.hidden = true;
  }

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
      ENTRANCES
      Two routes to the same effect.

      On a pointer device the values are written every frame from the
      scroll position, so a band's travel tracks the wheel and
      reverses when you scroll back up.

      On a touch device that costs too much: phones deliver scroll in
      bursts, and during momentum scrolling they stop delivering it at
      all, so per-frame writes land late and read as stutter. There a
      class goes on when the band arrives and the browser animates it
      on the compositor, which keeps up with the finger.

      Either way the hidden state is applied by this script and never
      by the stylesheet, and a watchdog clears it if the mechanism
      that is meant to lift it never reports in. A band that is
      invisible because an observer stayed silent is worse than no
      animation at all.
      ------------------------------------------------------------ */
  var bands = document.querySelectorAll('[data-reveal]');
  var heroPanel = document.querySelector('.p1');
  var heroCopy = document.querySelector('.p1-copy');
  var topBar = document.querySelector('.ms-nav');
  var navFades = topBar && !topBar.classList.contains('ms-nav--page');
  var touch = window.matchMedia('(hover: none), (max-width: 760px)').matches;

  if ((bands.length || heroCopy) && !still) {
    var clamp01 = function (n) { return n < 0 ? 0 : (n > 1 ? 1 : n); };

    Array.prototype.forEach.call(bands, function (el) { el.classList.add('js-fade'); });

    if (touch) {
      /*  ---- touch: the browser animates between two states ---- */
      document.documentElement.classList.add('js-anim');

      var LIFT = 46;
      var hide = function (el) {
        el.style.opacity = '0';
        el.style.transform = 'translate3d(0,' + LIFT + 'px,0)';
      };
      var show = function (el) {
        el.style.opacity = '';
        el.style.transform = '';
      };
      var inView = function (el) {
        var r = el.getBoundingClientRect();
        return r.top < window.innerHeight * 0.9 && r.bottom > window.innerHeight * 0.1;
      };

      Array.prototype.forEach.call(bands, function (el) {
        if (!inView(el)) hide(el);
      });

      var heard = false;

      if ('IntersectionObserver' in window) {
        var arrive = new IntersectionObserver(function (entries) {
          heard = true;
          entries.forEach(function (entry) {
            if (entry.isIntersecting) show(entry.target);
            else hide(entry.target);
          });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        Array.prototype.forEach.call(bands, function (el) { arrive.observe(el); });
      }

      /*  If nothing came back, the observer is not running here. Show
          everything and leave it shown. */
      window.setTimeout(function () {
        if (heard) return;
        Array.prototype.forEach.call(bands, show);
      }, 1400);

      /*  The hero's exit is one threshold rather than a per-frame
          value, for the same reason: halfway down the first panel. */
      if (heroPanel && (heroCopy || navFades)) {
        var gone = null;
        var checkHero = function () {
          var h = heroPanel.getBoundingClientRect();
          /*  Earlier than the halfway mark the pointer version uses: the
              copy has to clear the fixed bar before it reaches it. */
          var past = -h.top > h.height * 0.28;
          if (past === gone) return;
          gone = past;
          if (heroCopy) heroCopy.classList.toggle('is-gone', past);
          if (navFades) topBar.classList.toggle('is-gone', past);
        };

        var heroRaf = null;
        window.addEventListener('scroll', function () {
          if (heroRaf == null) heroRaf = requestAnimationFrame(function () {
            heroRaf = null;
            checkHero();
          });
        }, { passive: true });
        window.addEventListener('resize', checkHero, { passive: true });
        checkHero();
      }
    } else {
      /*  ---- pointer: tied to the scroll position ---- */
      var paintFades = function () {
        var vh = window.innerHeight;
        /*  A zero-height viewport (a hidden tab, a pane being resized)
            would drive everything to the same end value. Leave the last
            frame standing instead. */
        if (!vh) return;

        Array.prototype.forEach.call(bands, function (el) {
          var r = el.getBoundingClientRect();

          var rising = clamp01((vh - r.top - vh * 0.12) / (vh * 0.55));
          var leaving = clamp01((r.bottom - vh * 0.06) / (vh * 0.42));
          var v = Math.min(rising, leaving);

          /*  Movement is the effect; the dimming only takes the first
              and last of the travel off. */
          var ease = 1 - Math.pow(1 - v, 2);

          el.style.opacity = clamp01(v * 2.4).toFixed(3);
          el.style.transform = 'translate3d(0,' + ((1 - ease) * 68).toFixed(1) + 'px,0)';
        });

        if (heroPanel && heroCopy) {
          var hr = heroPanel.getBoundingClientRect();
          var p = clamp01(-hr.top / Math.max(1, hr.height));

          heroCopy.style.opacity = clamp01((1 - p) * 1.9).toFixed(3);
          heroCopy.style.transform = 'translate3d(0,' + (p * 130).toFixed(1) + 'px,0)';

          if (navFades) {
            /*  Carried along by the fixed bar until halfway down the
                panel, then gone -- and not clickable once invisible. */
            var np = clamp01(p / 0.5);
            topBar.style.opacity = clamp01((1 - np) * 1.8).toFixed(3);
            topBar.style.transform = 'translate3d(0,' + (np * -38).toFixed(1) + 'px,0)';
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
      window.addEventListener('load', onFadeScroll);
      paintFades();
    }
  }
})();
