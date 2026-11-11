(() => {
  const CONFIG_URL = "data/config.json";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let config = null;
  let musicStarted = false;

  async function init() {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    resetScrollTop();

    // Back/forward cache can restore old scroll — force top again
    window.addEventListener("pageshow", () => {
      if (!document.body.classList.contains("is-open")) {
        resetScrollTop();
      }
    });

    config = await loadConfig();
    applyConfig(config);
    bindUI(config);
    startCountdown(config);
    observeReveals();
    initEffects();
  }

  function resetScrollTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  async function loadConfig() {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) throw new Error("Could not load config.json");
    return res.json();
  }

  function applyConfig(cfg) {
    document.title = cfg.site.title;

    const groom = cfg.couple.groom.shortName;
    const bride = cfg.couple.bride.shortName;
    $("#splash-monogram").innerHTML = `
      <span class="splash__name" data-part="groom">${groom}</span>
      <span class="splash__amp">&</span>
      <span class="splash__name" data-part="bride">${bride}</span>
    `;
    const splashBrand = $("#splash-brand");
    if (splashBrand) {
      splashBrand.textContent = cfg.site.splashBrand || "Amora";
    }
    const splashTagline = $("#splash-tagline");
    if (splashTagline) {
      splashTagline.textContent =
        cfg.site.splashTagline || "A Celebration of Love";
    }
    const splashKicker = $("#splash-kicker");
    if (splashKicker) {
      splashKicker.textContent = cfg.site.splashKicker || "With grateful hearts,";
    }
    const inviteLabel =
      cfg.site.inviteLabel ||
      "invite you to celebrate the beginning of their forever.";
    $("#splash-label").textContent = inviteLabel;
    $("#open-invite").textContent = cfg.site.openButton;

    $("#nav-brand").textContent = `${groom} & ${bride}`;
    $("#hero-image").src = cfg.heroImage;
    $("#hero-image").alt = `${cfg.couple.groom.name} and ${cfg.couple.bride.name}`;

    const wedding = cfg.events[cfg.countdownTarget] || cfg.events.wedding;
    const weddingDateEl = $("#wedding-date");
    if (weddingDateEl) {
      weddingDateEl.innerHTML = String(wedding.displayDate).replace(
        /(\d+)/g,
        '<span class="wedding-date__num">$1</span>'
      );
    }

    renderNav(cfg.nav);
    renderCouple(cfg.couple);
    renderEvents(cfg.events);
    renderGallery(cfg.gallery);
    renderInviteCard(cfg);

    const footerEyebrow = $("#footer-eyebrow");
    if (footerEyebrow) {
      footerEyebrow.textContent = cfg.site.footerEyebrow || "Until we celebrate together";
    }
    $("#footer-names").textContent = `${cfg.couple.groom.shortName} & ${cfg.couple.bride.shortName}`;
    const footerBlessing = $("#footer-blessing");
    if (footerBlessing) {
      footerBlessing.textContent = cfg.site.footerBlessing || "";
    }
    const footerSignoff = $("#footer-signoff");
    if (footerSignoff) {
      footerSignoff.textContent = cfg.site.footerSignoff || "With love,";
    }
    const footerBrand = $("#footer-brand");
    if (footerBrand) {
      footerBrand.textContent = cfg.site.footerBrand || cfg.site.splashBrand || "Amora";
    }
    const footerTag = $("#footer-tag");
    if (footerTag) {
      footerTag.textContent = cfg.site.footerTagline || "A story written in love";
    }

    const audio = $("#bg-music");
    audio.src = cfg.music.src;
    audio.loop = cfg.music.loop !== false;
    initLyrics(cfg.lyrics || [], audio);
  }

  let lyricsTracks = [];
  let lyricsIndex = -1;
  let lyricsRaf = 0;

  function initLyrics(tracks, audio) {
    lyricsTracks = tracks
      .slice()
      .sort((a, b) => a.start - b.start);
    lyricsIndex = -1;

    const box = $("#lyrics");
    const line = $("#lyrics-line");
    const meta = $("#lyrics-meta");
    if (!box || !line || !audio) return;

    const hide = () => {
      box.hidden = true;
      box.classList.remove("is-visible", "is-instrumental");
      line.textContent = "";
      meta.textContent = "";
      lyricsIndex = -1;
    };

    const showLine = (entry, index) => {
      lyricsIndex = index;
      line.textContent = entry.text || "";
      meta.textContent = "";
      box.hidden = false;
      box.classList.remove("is-instrumental");
      // Retrigger fade animation
      box.classList.remove("is-visible");
      void box.offsetWidth;
      box.classList.add("is-visible");
    };

    const sync = () => {
      if (audio.paused) {
        hide();
        return;
      }
      const t = audio.currentTime;
      let idx = -1;
      for (let i = 0; i < lyricsTracks.length; i++) {
        const row = lyricsTracks[i];
        // Skip instrumental-only stretches — subtitles only while singing
        if (row.type === "instrumental") continue;
        if (t >= row.start && t < row.end) {
          idx = i;
          break;
        }
      }
      if (idx === -1) {
        hide();
        return;
      }
      if (idx !== lyricsIndex) showLine(lyricsTracks[idx], idx);
    };

    const loop = () => {
      sync();
      lyricsRaf = requestAnimationFrame(loop);
    };

    audio.addEventListener("play", () => {
      cancelAnimationFrame(lyricsRaf);
      lyricsRaf = requestAnimationFrame(loop);
    });
    audio.addEventListener("pause", () => {
      cancelAnimationFrame(lyricsRaf);
      hide();
    });
    audio.addEventListener("ended", hide);
    audio.addEventListener("seeked", sync);
  }

  function renderNav(items) {
    const list = $("#nav-list");
    list.innerHTML = items
      .map(
        (item) =>
          `<li><a href="#${item.id}" data-nav="${item.id}">${item.label}</a></li>`
      )
      .join("");
  }

  function renderCouple(couple) {
    const grid = $("#couple-grid");
    grid.innerHTML = [couple.bride, couple.groom]
      .map((person) => {
        const sibs = person.siblings || [];
        let siblings = "";
        if (sibs.length === 1) {
          const relation = sibs[0].relation || "Sibling";
          siblings = `<li>${relation}: ${sibs[0].name}</li>`;
        } else if (sibs.length > 1) {
          siblings = `<li>Siblings: ${sibs.map((s) => s.name).join(", ")}</li>`;
        }
        const addr = person.address?.line || "";
        const bio = person.bio
          ? `<p class="person__bio">${person.bio}</p>`
          : "";
        const meta = siblings
          ? `<ul class="person__meta">${siblings}</ul>`
          : "";
        return `
          <article class="person">
            <p class="person__role">${person.role}</p>
            <h3 class="person__name">${person.displayName || person.name}</h3>
            ${bio}
            ${meta}
            ${addr ? `<p class="person__address">${addr}</p>` : ""}
          </article>
        `;
      })
      .join("");
  }

  function renderEvents(events) {
    const days = [
      {
        key: "engagement-day",
        label: "Engagement Day",
        keys: ["engagement", "engagementReception"],
      },
      {
        key: "wedding-day",
        label: "Wedding Day",
        keys: ["wedding", "reception"],
      },
    ];

    const grid = $("#events-grid");
    grid.className = "events-timeline";
    grid.innerHTML = days
      .map((day) => {
        const items = day.keys.map((k) => events[k]).filter(Boolean);
        if (!items.length) return "";
        const date = items[0].displayDate;
        const stops = items
          .map(
            (e) => `
            <li class="event-stop">
              <div class="event-stop__time">
                <span class="event-stop__clock">${e.displayTime}</span>
              </div>
              <div class="event-stop__dot" aria-hidden="true"></div>
              <div class="event-stop__body">
                <h3 class="event-stop__title">${e.title}</h3>
                <p class="event-stop__venue">${e.venue}</p>
                <a class="event-stop__map" href="${e.mapUrl}" target="_blank" rel="noopener">View on Map</a>
              </div>
            </li>
          `
          )
          .join("");

        return `
          <article class="event-day" data-day="${day.key}">
            <header class="event-day__header">
              <p class="event-day__label">${day.label}</p>
              <h3 class="event-day__date">${date}</h3>
            </header>
            <ol class="event-day__stops">
              ${stops}
            </ol>
          </article>
        `;
      })
      .join("");
  }

  function prefetchGalleryImages(items) {
    if (!items?.length) return;
    items.forEach((item) => {
      if (!item.src) return;
      // Browser preload hint
      if (!document.head.querySelector(`link[data-gallery-preload="${item.src}"]`)) {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = item.src;
        link.dataset.galleryPreload = item.src;
        document.head.appendChild(link);
      }
      // Warm HTTP cache + decode into memory early
      const warm = new Image();
      warm.decoding = "async";
      warm.src = item.src;
      if (warm.decode) warm.decode().catch(() => {});
    });
  }

  function renderGallery(items) {
    prefetchGalleryImages(items);

    const grid = $("#gallery-grid");
    grid.innerHTML = items
      .map((item, index) => {
        const style = item.style === "cutout" ? "cutout" : "photo";
        const layout = item.layout || "portrait";
        const span = item.span || (style === "cutout" ? "duo" : "lead");
        const delay = `${index * 0.08}s`;

        if (style === "cutout") {
          return `
            <figure
              class="gallery-item gallery-item--cutout gallery-item--${layout} gallery-item--${span}"
              data-gallery-motion
            >
              <span class="gallery-item__glow" aria-hidden="true"></span>
              <div class="gallery-item__cutout-stage">
                <img
                  src="${item.src}"
                  alt="${item.alt || ""}"
                  decoding="async"
                  fetchpriority="high"
                />
              </div>
              <span class="gallery-item__fg" aria-hidden="true"></span>
              <span class="gallery-item__sheen" aria-hidden="true"></span>
              <span class="gallery-item__foot-fade" aria-hidden="true"></span>
            </figure>
          `;
        }

        return `
          <figure
            class="gallery-item gallery-item--photo gallery-item--${layout} gallery-item--${span}"
            data-gallery-motion
            style="transition-delay:${delay}"
          >
            <div class="gallery-item__frame">
              <div class="gallery-item__camera">
                <img
                  src="${item.src}"
                  alt="${item.alt || ""}"
                  decoding="async"
                  fetchpriority="high"
                />
              </div>
              <span class="gallery-item__fade" aria-hidden="true"></span>
            </div>
          </figure>
        `;
      })
      .join("");

    initGalleryMotion();
  }

  function initGalleryMotion() {
    const items = $$("[data-gallery-motion]");
    if (!items.length) return;

    const markReady = (item) => {
      const img = item.querySelector("img");
      if (!img) {
        item.classList.add("is-ready");
        return;
      }
      const done = () => {
        item.classList.add("is-ready");
        tryReveal(item);
      };
      const prepare = () => {
        // Don't block reveal on decode — load is enough; decode in background
        done();
        if (img.decode) img.decode().catch(() => {});
      };
      if (img.complete && img.naturalWidth > 0) {
        prepare();
      } else {
        img.addEventListener("load", prepare, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    };

    const tryReveal = (item) => {
      if (
        item.classList.contains("is-ready") &&
        item.classList.contains("is-near") &&
        !item.classList.contains("is-in-view") &&
        !item.classList.contains("is-revealing")
      ) {
        item.classList.add("is-revealing");
        requestAnimationFrame(() => {
          item.classList.add("is-in-view");
        });
      }
    };

    items.forEach(markReady);

    if ("IntersectionObserver" in window) {
      // Begin fade ~1 viewport before the item is on screen
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const item = entry.target;
            if (entry.isIntersecting) {
              item.classList.add("is-near");
              tryReveal(item);
            }
          });
        },
        { threshold: 0.01, rootMargin: "0px 0px 100% 0px" }
      );
      items.forEach((item) => io.observe(item));
    } else {
      items.forEach((item) => {
        item.classList.add("is-near");
        tryReveal(item);
      });
    }

    let ticking = false;
    const updateParallax = () => {
      const vh = window.innerHeight || 1;
      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const progress = (mid - vh / 2) / vh;
        const clamped = Math.max(-1, Math.min(1, progress));
        item.style.setProperty("--parallax", clamped.toFixed(3));
        const enter = Math.max(
          0,
          Math.min(1, (vh * 0.92 - rect.top) / (vh * 0.55))
        );
        item.style.setProperty("--enter", enter.toFixed(3));
      });
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
  }

  function renderInviteCard(cfg) {
    const g = cfg.couple.groom.shortName;
    const b = cfg.couple.bride.shortName;
    const wedding = cfg.events.wedding;
    $("#invite-seal").textContent = `${g[0]}&${b[0]}`;
    $("#invite-front-names").textContent = `${g} & ${b}`;
    $("#invite-back-names").textContent = `${g} & ${b}`;
    $("#invite-back-text").innerHTML = `
      Request the pleasure of your company<br />
      as they begin their forever<br /><br />
      ${wedding.displayDate}<br />
      ${wedding.displayTime}<br />
      ${wedding.venue}
    `;
  }

  function bindUI(cfg) {
    const openBtn = $("#open-invite");
    openBtn.addEventListener("click", () => openInvitation(true));

    $("#music-toggle").addEventListener("click", toggleMusic);

    const card = $("#invite-card");
    const scene = card?.closest(".invite-scene");
    const toggleCard = () => {
      const opening = !card.classList.contains("is-open");
      card.classList.toggle("is-open", opening);
      scene?.classList.toggle("is-open", opening);
      scene?.classList.add("is-flipping");
      card.setAttribute("aria-expanded", String(opening));
      if (opening && typeof spawnSparkBurst === "function") {
        const rect = card.getBoundingClientRect();
        spawnSparkBurst(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
      }
      window.setTimeout(() => scene?.classList.remove("is-flipping"), 1400);
    };
    card.addEventListener("click", toggleCard);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCard();
      }
    });

    const header = $("#site-header");
    const navToggle = $("#nav-toggle");
    navToggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-nav-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    $("#nav-list").addEventListener("click", (e) => {
      if (e.target.matches("a")) {
        header.classList.remove("is-nav-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });

    window.addEventListener("scroll", highlightNav, { passive: true });
  }

  function openInvitation(startMusic) {
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-open");
    $("#splash").classList.add("is-hidden");
    $("#splash").setAttribute("aria-hidden", "true");
    // Always land at the top of the invitation, even after back/forward
    resetScrollTop();
    requestAnimationFrame(resetScrollTop);
    if (startMusic) ensureMusicPlaying();
    startHeartRain();
    // Warm gallery again once the invite is open
    if (config?.gallery) prefetchGalleryImages(config.gallery);
  }

  function initEffects() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target.closest("input, textarea, select")) return;
        spawnSparkBurst(e.clientX, e.clientY);
      },
      { passive: true }
    );

    setInterval(() => {
      if (document.body.classList.contains("is-open")) return;
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight * 0.7;
      spawnSparkles(x, y, 4, 0.55);
    }, 2200);
  }

  function spawnSparkBurst(x, y) {
    // Immediate burst, then a lighter afterglow (~50% of prior intensity)
    spawnSparkles(x, y, 8, 0.5);
    setTimeout(() => spawnSparkles(x, y, 5, 0.48), 220);
    setTimeout(() => spawnSparkles(x, y, 4, 0.42), 480);
    setTimeout(() => spawnSparkles(x, y, 2, 0.35), 780);
  }

  function spawnSparkles(x, y, count = 12, strength = 1) {
    const layer = $("#fx-layer");
    if (!layer) return;

    for (let i = 0; i < count; i++) {
      const spark = document.createElement("span");
      spark.className = "sparkle";
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.55;
      const dist = (28 + Math.random() * 70) * strength;
      const size = (7 + Math.random() * 11) * (0.75 + strength * 0.35);
      const life = 0.85 + Math.random() * 0.45; // ~0.85–1.3s visible
      spark.style.left = `${x + (Math.random() - 0.5) * 10}px`;
      spark.style.top = `${y + (Math.random() - 0.5) * 10}px`;
      spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      spark.style.setProperty("--dy", `${Math.sin(angle) * dist - 12}px`);
      spark.style.setProperty("--size", `${size}px`);
      spark.style.setProperty("--delay", `${Math.random() * 120}ms`);
      spark.style.setProperty("--life", `${life}s`);
      spark.style.setProperty("--rot", `${Math.random() * 180}deg`);
      layer.appendChild(spark);
      spark.addEventListener("animationend", () => spark.remove());
    }
  }

  let heartRainStarted = false;
  let petals = [];
  let heartRaf = 0;
  let windPhase = 0;
  let scrollMotion = {
    lastY: window.scrollY,
    lastT: performance.now(),
    velocity: 0,
    boost: 0,
  };
  const FLOWER_GLYPHS = ["❀", "❁", "✾", "✿", "🌸", "💮"];

  function startHeartRain() {
    if (heartRainStarted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    heartRainStarted = true;

    const layer = $("#fx-layer");
    scrollMotion.lastY = window.scrollY;
    scrollMotion.lastT = performance.now();

    window.addEventListener(
      "scroll",
      () => {
        const now = performance.now();
        const y = window.scrollY;
        const dt = Math.max(0.008, (now - scrollMotion.lastT) / 1000);
        const raw = (y - scrollMotion.lastY) / dt;
        scrollMotion.velocity = scrollMotion.velocity * 0.35 + raw * 0.65;
        scrollMotion.lastY = y;
        scrollMotion.lastT = now;
      },
      { passive: true }
    );

    const fallX = () => {
      const w = window.innerWidth;
      const pad = 16;
      // Keep petals inside the viewport so they don't cause sideways scroll
      if (w >= 900) {
        const center = w * 0.5;
        const spread = Math.min(w * 0.38, w / 2 - pad);
        return Math.max(pad, Math.min(w - pad, center + (Math.random() - 0.5) * 2 * spread));
      }
      return pad + Math.random() * Math.max(24, w - pad * 2);
    };

    const maxPetals = () => (window.innerWidth >= 900 ? 44 : 34);

    const spawnPetal = (kind) => {
      if (!document.body.classList.contains("is-open")) return;
      if (petals.length > maxPetals()) return;

      const isFlower = kind === "flower";
      const size = isFlower
        ? 8 + Math.random() * 12
        : 9 + Math.random() * 14;
      const fallSpeed = 40 + size * 5 + Math.random() * 18;
      const swayAmp = 12 + Math.random() * 16;
      const swayFreq = 0.25 + Math.random() * 0.45;
      const spinSpeed = (Math.random() - 0.5) * (isFlower ? 40 + size : 26 + size);

      const el = document.createElement("span");
      el.className = isFlower ? "falling-flower" : "falling-heart";
      if (isFlower) {
        el.textContent =
          FLOWER_GLYPHS[Math.floor(Math.random() * FLOWER_GLYPHS.length)];
      } else {
        el.textContent = Math.random() > 0.5 ? "♥" : "♡";
      }
      el.style.fontSize = `${size}px`;
      el.style.opacity = String(
        isFlower ? 0.26 + Math.random() * 0.34 : 0.22 + Math.random() * 0.34
      );

      const x = fallX();
      const petal = {
        el,
        x,
        y: -30 - Math.random() * 90,
        size,
        fallSpeed,
        swayAmp,
        swayFreq,
        swayOffset: Math.random() * Math.PI * 2,
        spin: Math.random() * 360,
        spinSpeed,
        baseX: x,
        vy: 0,
        windBias: isFlower ? 0.95 : 0.75,
      };
      layer.appendChild(el);
      petals.push(petal);
    };

    for (let i = 0; i < 14; i++) {
      setTimeout(() => spawnPetal(i % 2 ? "flower" : "heart"), i * 160);
    }
    setInterval(() => spawnPetal("heart"), 720);
    setInterval(() => spawnPetal("flower"), 520);

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      windPhase += dt;

      if (now - scrollMotion.lastT > 80) {
        scrollMotion.velocity *= 0.88;
      }

      const targetBoost = Math.max(
        -520,
        Math.min(720, scrollMotion.velocity * 0.55)
      );
      scrollMotion.boost +=
        (targetBoost - scrollMotion.boost) * Math.min(1, dt * 8);

      const wind =
        Math.sin(windPhase * 0.35) * 22 +
        Math.sin(windPhase * 0.9 + 1.2) * 10;
      const scrollGust = scrollMotion.boost * 0.025;

      petals = petals.filter((p) => {
        const mass = 0.55 + p.size / 40;
        const react = p.windBias / mass;

        const scrollForce = scrollMotion.boost * 0.9 * react;
        p.vy += (scrollForce - p.vy) * Math.min(1, dt * 6);
        p.vy *= 0.965;

        p.y += (p.fallSpeed + p.vy) * dt;

        const sway =
          Math.sin(windPhase * p.swayFreq + p.swayOffset) * p.swayAmp;
        const windFactor = (0.55 + (30 - p.size) / 50) * p.windBias;
        p.x =
          p.baseX + sway + wind * windFactor * 0.35 + scrollGust * windFactor;
        p.baseX +=
          (wind * 0.08 * 60 + scrollGust * 0.35) * dt * windFactor;

        // Clamp so particles never widen the page
        const maxX = window.innerWidth - 8;
        p.baseX = Math.max(8, Math.min(maxX, p.baseX));
        p.x = Math.max(-12, Math.min(window.innerWidth + 12, p.x));

        const spinBoost = 1 + Math.min(2.2, Math.abs(p.vy) / 220);
        p.spin += p.spinSpeed * spinBoost * dt;

        p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.spin}deg)`;

        if (p.y < -120) {
          p.y = window.innerHeight + 20 + Math.random() * 40;
          p.baseX = fallX();
          p.x = p.baseX;
          p.vy *= 0.3;
        }

        if (p.y > window.innerHeight + 60) {
          p.el.remove();
          return false;
        }
        return true;
      });

      heartRaf = requestAnimationFrame(tick);
    };
    heartRaf = requestAnimationFrame(tick);
  }

  const MUSIC_ICON_ON = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.6"/>
    </svg>`;

  const MUSIC_ICON_MUTED = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18V6l12-2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.6"/>
      <circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.6"/>
      <path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;

  function setMusicIcon(playing) {
    const btn = $("#music-toggle");
    if (!btn) return;
    btn.innerHTML = playing ? MUSIC_ICON_ON : MUSIC_ICON_MUTED;
    btn.classList.toggle("is-playing", playing);
    btn.setAttribute("aria-pressed", String(playing));
    btn.setAttribute(
      "aria-label",
      playing ? "Mute background music" : "Unmute background music"
    );
    btn.title = playing ? "Mute" : "Unmute";
  }

  function ensureMusicPlaying() {
    const audio = $("#bg-music");
    audio.loop = true;
    const play = audio.play();
    if (play && typeof play.then === "function") {
      play
        .then(() => {
          musicStarted = true;
          setMusicIcon(true);
        })
        .catch(() => {
          musicStarted = false;
          setMusicIcon(false);
        });
    }
  }

  function toggleMusic() {
    const audio = $("#bg-music");
    if (!audio.src) return;

    if (audio.paused) {
      ensureMusicPlaying();
    } else {
      audio.pause();
      setMusicIcon(false);
    }
  }

  function startCountdown(cfg) {
    const key = cfg.countdownTarget || "wedding";
    const target = new Date(cfg.events[key].datetime).getTime();
    const nodes = {
      days: $('[data-unit="days"]'),
      hours: $('[data-unit="hours"]'),
      minutes: $('[data-unit="minutes"]'),
      seconds: $('[data-unit="seconds"]'),
    };

    const tick = () => {
      const now = Date.now();
      let diff = Math.max(0, target - now);
      const days = Math.floor(diff / 86400000);
      diff -= days * 86400000;
      const hours = Math.floor(diff / 3600000);
      diff -= hours * 3600000;
      const minutes = Math.floor(diff / 60000);
      diff -= minutes * 60000;
      const seconds = Math.floor(diff / 1000);

      nodes.days.textContent = String(days).padStart(2, "0");
      nodes.hours.textContent = String(hours).padStart(2, "0");
      nodes.minutes.textContent = String(minutes).padStart(2, "0");
      nodes.seconds.textContent = String(seconds).padStart(2, "0");
    };

    tick();
    setInterval(tick, 1000);
  }

  function observeReveals() {
    const els = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    // Trigger as soon as a section peeks into view (tall sections
    // used to wait until ~middle of the phone before appearing).
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.01,
        rootMargin: "0px 0px 28% 0px",
      }
    );
    els.forEach((el) => io.observe(el));
  }

  function highlightNav() {
    const links = $$("#nav-list a");
    const sections = links
      .map((a) => document.getElementById(a.dataset.nav))
      .filter(Boolean);
    let current = sections[0]?.id;
    const y = window.scrollY + 120;
    for (const section of sections) {
      if (section.offsetTop <= y) current = section.id;
    }
    links.forEach((a) => {
      a.classList.toggle("is-active", a.dataset.nav === current);
    });
  }

  init().catch((err) => {
    console.error(err);
    document.body.innerHTML =
      "<p style='padding:2rem;font-family:sans-serif'>Could not load invitation data. Please check data/config.json.</p>";
  });
})();
