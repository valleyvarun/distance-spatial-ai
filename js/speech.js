// Speech bubble over the game. With sound distance on, clicking Mom or the
// boy makes them call out — typed a letter at a time above their head.
const Speech = (() => {
  const LINES = {
    mom: 'Varun, come down and eat your dinner!',
    boy: 'Amma, im coming down...',
  };
  const TYPE_SPEED = 28; // letters per second
  const LINGER = 3.5;    // seconds the finished line stays up before fading

  const bubble = document.getElementById('speech');
  const canvas = document.getElementById('scene');
  let who = null, text = '', start = 0, shown = -1, fadeTimer = null;

  function say(speaker) {
    who = speaker;
    text = LINES[speaker];
    start = performance.now();
    shown = -1;
    clearTimeout(fadeTimer);
    bubble.classList.remove('fading');
    bubble.hidden = false;
    // Replay the pop-in animation
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';
  }

  function hide() {
    who = null;
    clearTimeout(fadeTimer);
    bubble.hidden = true;
    bubble.classList.remove('fading');
  }

  function fadeOut() {
    bubble.classList.add('fading');
    fadeTimer = setTimeout(hide, 400);
  }

  // Keep the tail over the speaker's head as they move, and the bubble
  // inside the picture
  function place() {
    if (!who) return;
    const head = Characters.headTop(who);
    const scale = canvas.clientWidth / View.w;
    const half = bubble.offsetWidth / 2;
    const x = (head.x + View.ox) * scale;
    bubble.style.left = `${Math.max(half + 6, Math.min(canvas.clientWidth - half - 6, x))}px`;
    bubble.style.top = `${(head.y + View.oy) * scale - 14}px`;
  }

  function frame(now) {
    if (who && !Distances.active.sound) hide();
    if (who) {
      // Type out one more letter at a time, with a blinking cursor
      const count = Math.min(text.length, Math.floor(((now - start) / 1000) * TYPE_SPEED));
      if (count !== shown) {
        shown = count;
        bubble.textContent = text.slice(0, count);
        if (count < text.length) {
          const cursor = document.createElement('span');
          cursor.className = 'cursor';
          bubble.append(cursor);
        } else {
          fadeTimer = setTimeout(fadeOut, LINGER * 1000);
        }
      }
      place();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  new ResizeObserver(place).observe(canvas); // move with the picture straight away

  return { say };
})();
