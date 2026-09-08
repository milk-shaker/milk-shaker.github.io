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

    Held for two days, in localStorage with a timestamp rather than in
    sessionStorage, so closing the tab and coming back tomorrow still
    credits the referrer. The timestamp is what stops it running
    forever: a stored code past its window is discarded on read, so a
    signup next month is not attributed to a link clicked today.  */
(function () {
  'use strict';

  /*  "ref" is the parameter LaunchList's own links use. The others cost
      nothing and are only forwarded if a link actually carries them. */
  var KEYS = ['ref', 'referral', 'via'];
  var STORE = 'ms-ref';
  var MAX_AGE = 2 * 24 * 60 * 60 * 1000;   /* two days */

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

  /*  Stored as code and timestamp together. Anything unparseable or past
      its window is treated as absent and cleared, so a stale entry from
      an older version of this file cannot linger. */
  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem(STORE); } catch (e) { return ''; }
    if (!raw) return '';
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { saved = null; }
    if (!saved || !saved.code || !saved.at || (Date.now() - saved.at) > MAX_AGE) {
      try { window.localStorage.removeItem(STORE); } catch (e) { /* private mode */ }
      return '';
    }
    return saved.code;
  }

  function save(code) {
    try {
      window.localStorage.setItem(STORE, JSON.stringify({ code: code, at: Date.now() }));
    } catch (e) { /* private mode, or storage full */ }
  }

  var inUrl = refPairs(window.location.search);
  var stored = load();

  /*  A code in the URL always wins: someone following a second person's
      link should be attributed to that second person. Re-saving also
      restarts the two days, which is the right call for someone who has
      just clicked a fresh link. */
  if (inUrl) {
    save(inUrl);
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
