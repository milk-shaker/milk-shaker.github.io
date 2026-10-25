(function () {
  'use strict';

  var video = document.querySelector('.pt-hero-video');
  if (!video) return;

  var mobile = window.matchMedia('(max-width: 767px)');
  var play = function () {
    video.muted = true;
    video.playsInline = true;
    var request = video.play();
    if (request && request.catch) request.catch(function () {});
  };

  var selectSource = function () {
    var path = mobile.matches
      ? video.getAttribute('data-mobile-src')
      : video.getAttribute('data-desktop-src');
    if (!path) return;

    var source = new URL(path, document.baseURI).href;
    if (video.src !== source) {
      video.src = source;
      video.load();
    }
    play();
  };

  selectSource();
  mobile.addEventListener('change', selectSource);
  document.addEventListener('touchstart', play, { once: true, passive: true });
  document.addEventListener('pointerdown', play, { once: true, passive: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && video.paused) play();
  });
})();
