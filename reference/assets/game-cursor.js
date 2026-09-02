(function () {
  var CURSOR_ASSET = '/assets/ui/game-cursor-4k.png';
  var HOTSPOT_X = 19;
  var HOTSPOT_Y = 16;
  var finePointer = window.matchMedia('(pointer: fine)');

  if (!finePointer.matches || !document.body) return;

  var cursor = document.createElement('div');
  cursor.id = 'game-cursor';
  cursor.setAttribute('aria-hidden', 'true');

  var image = document.createElement('img');
  image.src = CURSOR_ASSET;
  image.alt = '';
  image.width = 64;
  image.height = 64;
  image.draggable = false;
  image.decoding = 'async';
  cursor.appendChild(image);
  document.body.appendChild(cursor);
  document.documentElement.classList.add('game-cursor-ready');

  function visible(next) {
    cursor.classList.toggle('is-visible', next && finePointer.matches);
  }

  function pressed(next) {
    cursor.classList.toggle('is-pressed', next && finePointer.matches);
  }

  function move(event) {
    if (!finePointer.matches || event.pointerType !== 'mouse') return;
    cursor.style.left = Math.round(event.clientX - HOTSPOT_X) + 'px';
    cursor.style.top = Math.round(event.clientY - HOTSPOT_Y) + 'px';
    visible(true);
  }

  function down(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    move(event);
    pressed(true);
  }

  function leave() {
    visible(false);
    pressed(false);
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointerleave', leave);
  window.addEventListener('pointerup', function () { pressed(false); });
  window.addEventListener('pointercancel', function () { pressed(false); });
  window.addEventListener('blur', function () { pressed(false); });
  finePointer.addEventListener && finePointer.addEventListener('change', function () {
    if (!finePointer.matches) leave();
  });
}());
