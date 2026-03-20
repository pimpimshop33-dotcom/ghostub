// ── GHOSTUB Micro-interactions ────────────────────────────
// Auto-init au DOMContentLoaded — aucune dépendance externe

const GhostMicro = (() => {

  // ── 1. RIPPLE sur tous les boutons / nav-items ──────────
  function initRipple() {
    document.addEventListener('pointerdown', e => {
      const target = e.target.closest(
        'button, .nav-item, .ghost-envelope, .cond-btn, .type-btn, .dur-btn, .radius-btn, .filter-btn, .emoji-opt, .report-reason'
      );
      if (!target) return;

      const cs = getComputedStyle(target);
      if (cs.position === 'static') target.style.position = 'relative';
      target.style.overflow = 'hidden';

      const rect   = target.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.className = 'ghost-ripple';
      Object.assign(ripple.style, {
        width:    `${size}px`,
        height:   `${size}px`,
        left:     `${x}px`,
        top:      `${y}px`,
      });
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }, { passive: true });
  }

  // ── 2. CURSOR GLOW (desktop uniquement) ────────────────
  function initCursorGlow() {
    if (window.matchMedia('(hover: none)').matches) return; // pas sur mobile

    const glow = document.createElement('div');
    glow.id = 'cursorGlow';
    Object.assign(glow.style, {
      position:      'fixed',
      width:         '320px',
      height:        '320px',
      borderRadius:  '50%',
      pointerEvents: 'none',
      zIndex:        '0',
      background:    'radial-gradient(circle, rgba(168,180,255,0.06) 0%, transparent 70%)',
      transform:     'translate(-50%, -50%)',
      transition:    'opacity 0.3s',
      opacity:       '0',
    });
    document.body.appendChild(glow);

    let raf;
    document.addEventListener('mousemove', e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        glow.style.left    = `${e.clientX}px`;
        glow.style.top     = `${e.clientY}px`;
        glow.style.opacity = '1';
      });
    }, { passive: true });

    document.addEventListener('mouseleave', () => { glow.style.opacity = '0'; });
  }

  // ── 3. BOUNCE nav-item au tap ───────────────────────────
  function initNavBounce() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('pointerdown', () => {
        item.style.transform = 'scale(0.85)';
      }, { passive: true });
      item.addEventListener('pointerup',    () => { item.style.transform = ''; }, { passive: true });
      item.addEventListener('pointerleave', () => { item.style.transform = ''; }, { passive: true });
    });
  }

  // ── 4. COMPTEURS animés (stat-num) ──────────────────────
  function animateCounter(el, target, duration = 800) {
    const start    = parseInt(el.textContent) || 0;
    const range    = target - start;
    if (range === 0) return;
    const startTs  = performance.now();
    const ease     = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut

    const step = ts => {
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      el.textContent = Math.round(start + range * ease(progress));
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  }

  // Observer les .stat-num et .empreinte-num pour animer au scroll
  function initCounterObserver() {
    const selector = '.stat-num, .empreinte-num, .empreinte-pill-num';
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el  = entry.target;
        const val = parseInt(el.textContent);
        if (!isNaN(val) && val > 0) {
          el.textContent = '0';
          animateCounter(el, val);
        }
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    document.querySelectorAll(selector).forEach(el => observer.observe(el));
  }

  // Ré-observer quand les stats changent (MutationObserver léger)
  function watchStatUpdates() {
    const targets = ['statDeposited','statDiscovered','statResonances','statFavorites','statFirstReader'];
    targets.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      new MutationObserver(mutations => {
        mutations.forEach(m => {
          const val = parseInt(m.target.textContent);
          if (!isNaN(val) && val > 0) {
            m.target.textContent = '0';
            animateCounter(m.target, val, 600);
          }
        });
      }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  // ── 5. STAGGER d'entrée sur la ghost-list ───────────────
  function initListStagger() {
    const list = document.getElementById('ghostList');
    if (!list) return;

    const observer = new MutationObserver(() => {
      const items = list.querySelectorAll('.ghost-envelope:not([data-staggered])');
      items.forEach((item, i) => {
        item.setAttribute('data-staggered', '1');
        item.style.opacity    = '0';
        item.style.transform  = 'translateY(14px)';
        item.style.transition = `opacity 0.32s ease ${i * 55}ms, transform 0.32s ease ${i * 55}ms`;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          item.style.opacity   = '1';
          item.style.transform = 'translateY(0)';
        }));
      });
    });

    observer.observe(list, { childList: true });
  }

  // ── 6. PRESS SCALE sur ghost-envelope ──────────────────
  function initEnvelopePress() {
    document.addEventListener('pointerdown', e => {
      const env = e.target.closest('.ghost-envelope');
      if (!env) return;
      env.style.transition = 'transform 0.12s ease';
      env.style.transform  = 'scale(0.972)';
    }, { passive: true });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
      document.addEventListener(evt, e => {
        const env = e.target.closest('.ghost-envelope');
        if (!env) return;
        env.style.transition = 'transform 0.25s cubic-bezier(0.25,0.8,0.25,1)';
        env.style.transform  = '';
      }, { passive: true });
    });
  }

  // ── 7. FOCUS GLOW sur les inputs ───────────────────────
  function initInputGlow() {
    document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
      input.addEventListener('focus', () => {
        input.style.boxShadow = '0 0 0 3px rgba(168,180,255,0.15), 0 0 20px rgba(168,180,255,0.08)';
      });
      input.addEventListener('blur', () => {
        input.style.boxShadow = '';
      });
    });

    // Observer les inputs ajoutés dynamiquement
    new MutationObserver(() => {
      document.querySelectorAll('.form-input:not([data-glow]), .form-textarea:not([data-glow])').forEach(input => {
        input.setAttribute('data-glow', '1');
        input.addEventListener('focus', () => {
          input.style.boxShadow = '0 0 0 3px rgba(168,180,255,0.15), 0 0 20px rgba(168,180,255,0.08)';
        });
        input.addEventListener('blur', () => { input.style.boxShadow = ''; });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── 8. TOAST HAPTIC ─────────────────────────────────────
  // Patch le toast existant pour vibrer à l'apparition
  function initToastHaptic() {
    const toast = document.getElementById('discoveryToast');
    if (!toast) return;
    const mo = new MutationObserver(() => {
      if (toast.classList.contains('show')) {
        if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
      }
    });
    mo.observe(toast, { attributes: true, attributeFilter: ['class'] });
  }

  // ── 9. RADAR DOT — pulse au hover ───────────────────────
  function initRadarDotHover() {
    const radarDots = document.getElementById('radarDots');
    if (!radarDots) return;
    radarDots.addEventListener('pointerover', e => {
      const dot = e.target.closest('.ghost-dot');
      if (!dot) return;
      dot.style.transform = 'translate(-50%, -50%) scale(1.5)';
      dot.style.zIndex    = '10';
    });
    radarDots.addEventListener('pointerout', e => {
      const dot = e.target.closest('.ghost-dot');
      if (!dot) return;
      dot.style.transform = '';
      dot.style.zIndex    = '';
    });
  }

  // ── INIT GLOBAL ─────────────────────────────────────────
  function init() {
    initRipple();
    initCursorGlow();
    initNavBounce();
    initCounterObserver();
    watchStatUpdates();
    initListStagger();
    initEnvelopePress();
    initInputGlow();
    initToastHaptic();
    initRadarDotHover();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { animateCounter };

})();

export default GhostMicro;

// ── ONBOARDING STARFIELD ────────────────────────────────────
(function initObStars() {
  const tryInit = () => {
    const canvas = document.getElementById('obStars');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let stars = [];
    let raf;

    function resize() {
      const parent = canvas.parentElement;
      canvas.width  = parent.offsetWidth  || 390;
      canvas.height = parent.offsetHeight || 680;
      buildStars();
    }

    function buildStars() {
      const n = Math.floor((canvas.width * canvas.height) / 3000);
      stars = Array.from({ length: n }, () => ({
        x:    Math.random() * canvas.width,
        y:    Math.random() * canvas.height,
        r:    Math.random() * 1.2 + 0.3,
        a:    Math.random(),
        da:   (Math.random() * 0.004 + 0.001) * (Math.random() < 0.5 ? 1 : -1),
        vy:   -(Math.random() * 0.15 + 0.05),
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.a += s.da;
        if (s.a > 1) { s.a = 1; s.da *= -1; }
        if (s.a < 0) { s.a = 0; s.da *= -1; }
        s.y += s.vy;
        if (s.y < -2) s.y = canvas.height + 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,180,255,${(s.a * 0.5).toFixed(2)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    // Stopper quand l'onboarding n'est plus visible
    const screen = document.getElementById('screenOnboard');
    const mo = new MutationObserver(() => {
      if (screen.classList.contains('active')) {
        resize();
        if (!raf) draw();
      } else {
        cancelAnimationFrame(raf);
        raf = null;
      }
    });
    if (screen) mo.observe(screen, { attributes: true, attributeFilter: ['class'] });

    window.addEventListener('resize', resize, { passive: true });
    resize();
    draw();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
