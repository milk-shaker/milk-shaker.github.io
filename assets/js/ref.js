/*  Referral code persistence.

    A LaunchList referral link lands on the site root carrying the
    referrer's code in the query string, but the form is on
    /early-access.html. Clicking through to it dropped the code, so every
    referred signup was arriving unattributed and nobody's discount moved.

    How LaunchList actually reads the code, which is what this has to fit
    around:

      - widget.js takes the PARENT page's whole query string and appends
        it to the iframe src it creates.
      - The form inside that iframe then appends its own query string to
        its form action, which is what posts the code back to them.

    So the code has to be in the page URL by the time widget.js runs, not
    just remembered somewhere. That is why this file is a blocking script
    in <head>: widget.js is deferred, so anything loaded normally in the
    head executes first, and replaceState below rewrites the URL in time
    for it to be read. Deferring this file, or moving it to the end of
    the body, would put it after widget.js and silently do nothing.

    Session-scoped on purpose: sessionStorage, so it lasts as long as the
    tab and does not attribute a signup next week to a link clicked
    today.  */
(function () {
  'use strict';

  /*  "ref" is the parameter LaunchList's own links use. The others cost
      nothing and are only forwarded if a link actually carries them. */
  var KEYS = ['ref', 'referral', 'via'];
  var STORE = 'ms-ref';

  /*  Pulls only the referral pairs out of a query string and returns them
      re-encoded. Deliberately not the whole query string: forwarding
      everything would drag page-specific params onto pages they mean
      nothing to. */
  function refPairs(search) {
    var found = [];
    if (!search) return '';
    var parts = search.replace(/^\?/, '').split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq < 1) continue;
      var key = decodeURIComponent(parts[i].slice(0, eq));
      var val = parts[i].slice(eq + 1);
      if (!val) continue;
      if (KEYS.indexOf(key.toLowerCase()) === -1) continue;
      found.push(encodeURIComponent(key) + '=' + val);
    }
    return found.join('&');
  }

  var inUrl = refPairs(window.location.search);
  var stored = '';

  try { stored = window.sessionStorage.getItem(STORE) || ''; } catch (e) { /* private mode */ }

  /*  A code in the URL always wins: someone following a second person's
      link should be attributed to that second person. */
  if (inUrl && inUrl !== stored) {
    try { window.sessionStorage.setItem(STORE, inUrl); } catch (e) { /* private mode */ }
    stored = inUrl;
  }

  if (!stored) return;

  /*  Put it back in the URL when the page was reached without it. This is
      the step the widget depends on, so it has to happen here rather than
      on DOMContentLoaded. */
  if (!inUrl) {
    var search = window.location.search
      ? window.location.search + '&' + stored
      : '?' + stored;
    try {
      window.history.replaceState(null, '', window.location.pathname + search + window.location.hash);
    } catch (e) { /* replaceState unavailable; the click handler still carries it */ }
  }

  /*  Carried at click time rather than by rewriting hrefs up front,
      because the resource articles inject their CTAs when a topic is
      opened. Anything that exists by the time it is clicked is covered,
      whenever it appeared. */
  document.addEventListener('click', function (event) {
    var el = event.target;
    var link = el && el.closest ? el.closest('a[href]') : null;
    if (!link) return;

    /*  Leave new tabs and downloads alone: they are not this session. */
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    var href = link.getAttribute('href') || '';
    if (/^(mailto:|tel:|sms:|javascript:|#)/i.test(href)) return;

    var url;
    try { url = new URL(link.href, window.location.href); } catch (e) { return; }
    if (url.origin !== window.location.origin) return;
    if (refPairs(url.search)) return;

    url.search = url.search ? url.search + '&' + stored : '?' + stored;
    link.setAttribute('href', url.pathname + url.search + url.hash);
  }, true);
})();
