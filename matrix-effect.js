/* matrix-effect.js
   Добавляет медленный, ненавязчивый "дождь" символов на canvas.
   Экспортирует глобальные функции window.startMatrix() и window.stopMatrix().
   Canvas создаётся динамически при вызове startMatrix() и удаляется в stopMatrix().
*/

(function(global){
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let cols = 0;
  let drops = [];
  let lastTime = 0;
  let updateInterval = 90; // ms between frames -> ~11 FPS (медленно)
  const fontSize = 16;
  const charSet = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズヅブプ0123456789@#$%&*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

  function createCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    // use CSS pixels for font-size
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(window.innerWidth / fontSize);
    drops = new Array(cols).fill(0).map(() => ({
      y: Math.floor(Math.random() * 50),
      speed: 0.5 + Math.random() * 1.2, // each column has its own slight speed
      stepCounter: 0
    }));
  }

  function drawFrame(timestamp) {
    if (!ctx || !canvas) return;
    if (!lastTime) lastTime = timestamp;
    const delta = timestamp - lastTime;
    if (delta < updateInterval) {
      rafId = requestAnimationFrame(drawFrame);
      return;
    }
    lastTime = timestamp;

    // fade with slight alpha to create trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px monospace';
    // iterate columns
    for (let i = 0; i < cols; i++) {
      const x = i * fontSize;
      const col = drops[i];
      // choose char
      const ch = charSet.charAt(Math.floor(Math.random() * charSet.length));
      // brighter head
      ctx.fillStyle = 'rgba(180, 255, 200, 0.95)';
      ctx.fillText(ch, x, col.y * fontSize);

      // occasionally draw a fainter char slightly above for depth
      if (Math.random() > 0.8) {
        ctx.fillStyle = 'rgba(0, 200, 120, 0.2)';
        ctx.fillText(ch, x, (col.y - 1) * fontSize);
      }

      // increment y with column speed
      col.y += col.speed;

      // reset with tiny probability to vary
      if (col.y * fontSize > window.innerHeight && Math.random() > 0.985) {
        drops[i].y = 0;
      }
    }

    rafId = requestAnimationFrame(drawFrame);
  }

  function startMatrix() {
    if (canvas) return; // already running
    createCanvas();
    lastTime = 0;
    rafId = requestAnimationFrame(drawFrame);
  }

  function stopMatrix() {
    try {
      if (rafId) cancelAnimationFrame(rafId);
    } catch(e){}
    rafId = null;
    lastTime = 0;
    try {
      if (canvas && canvas.parentNode) {
        window.removeEventListener('resize', resize);
        canvas.parentNode.removeChild(canvas);
      }
    } catch(e){}
    canvas = null;
    ctx = null;
    cols = 0;
    drops = [];
  }

  // expose globally
  global.startMatrix = startMatrix;
  global.stopMatrix = stopMatrix;
})(window);
