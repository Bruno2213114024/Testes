/* ═══════════════════════════════════════════════════════════
   PORTFOLIO SCRIPT
   - Header scroll behavior
   - Mobile menu
   - Smooth scroll
   - Scroll reveal animations
   - Skill bar animations
   - Live energy widget (animated)
   - Mini chart (Canvas)
   - Uptime counter
   - Form validation
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── Utility ─── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ─── Header scroll behavior ─── */
(function initHeader() {
  const header = $('#header');
  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── Mobile menu ─── */
(function initMobileMenu() {
  const hamburger = $('#hamburger');
  const navLinks  = $('#navLinks');

  const toggle = (open) => {
    hamburger.classList.toggle('open', open);
    navLinks.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };

  hamburger.addEventListener('click', () => {
    toggle(!navLinks.classList.contains('open'));
  });

  // Close on link click
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false);
  });
})();

/* ─── Active nav link on scroll ─── */
(function initActiveNav() {
  const sections = $$('section[id]');
  const links    = $$('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(link => {
          const href = link.getAttribute('href');
          link.style.color = (href === `#${id}`)
            ? 'var(--text-primary)'
            : '';
        });
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));
})();

/* ─── Scroll reveal ─── */
(function initScrollReveal() {
  // Attach reveal class to elements
  const targets = [
    '.about-grid', '.stat-card',
    '.skill-group', '.project-card',
    '.timeline-item', '.contact-grid'
  ];

  targets.forEach(sel => {
    $$(sel).forEach((el, i) => {
      el.classList.add('reveal');
      // Stagger siblings
      const siblings = [...el.parentElement.children];
      const idx = siblings.indexOf(el);
      if (idx > 0) el.classList.add(`reveal-delay-${Math.min(idx, 3)}`);
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  $$('.reveal').forEach(el => observer.observe(el));
})();

/* ─── Skill bars ─── */
(function initSkillBars() {
  const fills = $$('.skill-fill');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const width = entry.target.dataset.width;
        entry.target.style.width = `${width}%`;
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  fills.forEach(el => observer.observe(el));
})();

/* ─── Live energy widget ─── */
(function initEnergyWidget() {
  // Seed values
  const base = {
    voltage: 220.4,
    current: 14.2,
    power:   3.12,
    saving:  23.7
  };

  // Slight random drift to simulate live readings
  const drift = (val, range) => +(val + (Math.random() - 0.5) * range).toFixed(1);

  const elVoltage = $('#metricVoltage');
  const elCurrent = $('#metricCurrent');
  const elPower   = $('#metricPower');
  const elSaving  = $('#metricSaving');

  if (!elVoltage) return;

  let prev = { ...base };

  const update = () => {
    const v = drift(prev.voltage, 2);
    const a = drift(prev.current, 0.8);
    const p = +( (v * a) / 1000 ).toFixed(2);
    const s = drift(prev.saving, 0.3);

    animateValue(elVoltage, parseFloat(elVoltage.textContent), v, 800);
    animateValue(elCurrent, parseFloat(elCurrent.textContent), a, 800);
    animateValue(elPower,   parseFloat(elPower.textContent),   p, 800, 2);
    animateValue(elSaving,  parseFloat(elSaving.textContent),  s, 800, 1);

    prev = { voltage: v, current: a, power: p, saving: s };

    // Push to chart
    pushChartValue(p);
  };

  setInterval(update, 2200);

  // Animate number counting
  function animateValue(el, from, to, duration, decimals = 1) {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = (from + (to - from) * ease).toFixed(decimals);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
})();

/* ─── Mini canvas chart ─── */
(function initMiniChart() {
  const canvas = $('#miniChart');
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width  = canvas.offsetWidth  || 280;
  const H      = canvas.height = 72;

  // Initial data
  const data = Array.from({ length: 20 }, () => 3 + Math.random() * 0.8);

  const draw = () => {
    ctx.clearRect(0, 0, W, H);

    const min  = Math.min(...data) - 0.3;
    const max  = Math.max(...data) + 0.3;
    const norm = (v) => H - ((v - min) / (max - min)) * H * 0.85 - H * 0.05;

    const step = W / (data.length - 1);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 212, 255, 0)');

    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = norm(v);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = (i - 1) * step;
        const py = norm(data[i - 1]);
        const cpx = px + step * 0.5;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
    });
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = norm(v);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = (i - 1) * step;
        const py = norm(data[i - 1]);
        const cpx = px + step * 0.5;
        ctx.bezierCurveTo(cpx, py, cpx, y, x, y);
      }
    });
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Dot at last point
    const lastX = (data.length - 1) * step;
    const lastY = norm(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00D4FF';
    ctx.fill();
  };

  draw();

  // Expose to widget updater
  window.pushChartValue = (val) => {
    data.push(val);
    if (data.length > 22) data.shift();
    draw();
  };
})();

/* ─── Uptime counter ─── */
(function initUptime() {
  const el = $('#widgetUptime');
  if (!el) return;

  const start = Date.now();

  const format = (ms) => {
    const s = Math.floor(ms / 1000) % 60;
    const m = Math.floor(ms / 60000) % 60;
    const h = Math.floor(ms / 3600000);
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  };

  setInterval(() => {
    el.textContent = format(Date.now() - start);
  }, 1000);
})();

/* ─── Contact form validation ─── */
(function initForm() {
  const form      = $('#contactForm');
  if (!form) return;

  const submitBtn = $('#submitBtn');
  const successEl = $('#formSuccess');

  const rules = {
    name:    { el: $('#name'),    err: $('#nameError'),    min: 2,  msg: 'Informe seu nome (mín. 2 caracteres).' },
    email:   { el: $('#email'),   err: $('#emailError'),   type: 'email', msg: 'E-mail inválido.' },
    message: { el: $('#message'), err: $('#messageError'), min: 10, msg: 'Mensagem muito curta (mín. 10 caracteres).' },
  };

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const validate = (key) => {
    const { el, err, min, type, msg } = rules[key];
    const val = el.value.trim();
    let ok = true;

    if (type === 'email') ok = validateEmail(val);
    else if (min)         ok = val.length >= min;

    el.classList.toggle('error', !ok);
    err.textContent = ok ? '' : msg;
    return ok;
  };

  // Live validation on blur
  Object.keys(rules).forEach(key => {
    rules[key].el.addEventListener('blur', () => validate(key));
    rules[key].el.addEventListener('input', () => {
      if (rules[key].el.classList.contains('error')) validate(key);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const allOk = Object.keys(rules).map(validate).every(Boolean);
    if (!allOk) return;

    // Simulate async submit
    submitBtn.textContent = 'Enviando…';
    submitBtn.disabled = true;

    setTimeout(() => {
      form.reset();
      submitBtn.textContent = 'Enviar mensagem';
      submitBtn.disabled = false;
      successEl.hidden = false;

      setTimeout(() => { successEl.hidden = true; }, 6000);
    }, 1200);
  });
})();

/* ─── Smooth scroll for anchor links ─── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
