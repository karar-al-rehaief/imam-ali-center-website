(() => {
  const TZ = "America/New_York";
  const IAC_EMAIL = "iacdmv@gmail.com";
  const toast = document.getElementById("site-toast");
  let toastTimer;

  document.querySelectorAll("[data-home-top]").forEach((link) => link.addEventListener("click", (event) => {
    if (location.pathname !== "/" && location.pathname !== "/index.html") return;
    event.preventDefault();
    if (location.hash || location.search) history.replaceState(null, "", "/");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }));

  const announce = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3800);
  };

  // A small set of sourced traditions rotates by the center's local calendar day.
  const wisdom = [
    {
      text: "Know your imam. Whoever knows his imam is as if he is with al-Qa’im in his pavilion.",
      source: "https://al-islam.org/sw/node/39145",
      label: "Al-Ghayba, ch. 25",
    },
    {
      text: "He will fill the earth with justice just as it was filled with tyranny.",
      source: "https://al-islam.org/al-imam-al-mahdi-just-leader-humanity-ibrahim-amini/chapter-14-signs-appearance-zuhur-mahdi",
      label: "Signs of the Appearance, ch. 14",
    },
    {
      text: "Mahdi is from my family and will fight for my tradition, just as I fought for the Qur’an.",
      source: "https://al-islam.org/al-imam-al-mahdi-just-leader-humanity-ibrahim-amini/chapter-14-signs-appearance-zuhur-mahdi",
      label: "Signs of the Appearance, ch. 14",
    },
  ];

  const dateParts = (date = new Date(), timeZone = TZ) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    return Object.fromEntries(parts.filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  };

  const localDayKey = (date = new Date()) => {
    const p = dateParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  };

  const showDailyWisdom = () => {
    const textEl = document.getElementById("hadith-text");
    const sourceEl = document.getElementById("hadith-source");
    if (!textEl || !sourceEl) return;
    const key = localDayKey();
    const day = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
    const item = wisdom[((day % wisdom.length) + wisdom.length) % wisdom.length];
    textEl.textContent = `“${item.text}”`;
    textEl.href = item.source;
    sourceEl.href = item.source;
    sourceEl.textContent = item.label;
    sourceEl.setAttribute("aria-label", `Source: ${item.label}`);
  };

  // Turn a Springfield wall-clock time into a UTC instant without relying on the visitor's timezone.
  const zonedTimeToUtc = (year, month, day, hour, minute, second = 0, timeZone = TZ) => {
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    let guess = target;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    for (let i = 0; i < 3; i += 1) {
      const values = Object.fromEntries(fmt.formatToParts(new Date(guess)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
      const represented = Date.UTC(+values.year, +values.month - 1, +values.day, +values.hour, +values.minute, +values.second);
      const correction = target - represented;
      guess += correction;
      if (!correction) break;
    }
    return new Date(guess);
  };

  const timeInZone = (date, timeZone = TZ) => new Intl.DateTimeFormat("en-US", {
    timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date);

  const dateInZone = (date, opts = {}) => new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "long", month: "long", day: "numeric", ...opts,
  }).format(date);

  let prayerInstants = [];
  let prayerRefreshTimer;
  const prayerFallback = "Prayer times could not be loaded right now. Please use the IAC app or contact the Center for current information.";

  const updateNextPrayer = () => {
    const nameEls = [document.getElementById("next-prayer-name"), document.getElementById("prayer-page-next-name")].filter(Boolean);
    const countdownEls = [document.getElementById("next-prayer-countdown"), document.getElementById("prayer-page-next-countdown")].filter(Boolean);
    if (!nameEls.length || !countdownEls.length) return;
    const now = new Date();
    const next = prayerInstants.find((item) => item.at > now);
    document.querySelectorAll(".prayer-row").forEach((row) => row.classList.remove("is-next"));
    if (!next) {
      nameEls.forEach((el) => { el.textContent = prayerInstants.length ? "Tomorrow" : "Times unavailable"; });
      countdownEls.forEach((el) => { el.textContent = prayerInstants.length ? "Check tomorrow’s times" : "—"; });
      return;
    }
    const totalSeconds = Math.max(0, Math.floor((next.at - now) / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    nameEls.forEach((el) => { el.textContent = next.isTomorrow ? `${next.name} tomorrow` : next.name; });
    countdownEls.forEach((el) => { el.textContent = `${hours}:${minutes}:${seconds}`; });
    const row = next.isTomorrow ? null : [...document.querySelectorAll(".prayer-row")].find((el) => el.dataset.prayer === next.name);
    row?.classList.add("is-next");
  };

  const parsePrayerClock = (clock) => {
    const match = String(clock).match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (/PM/i.test(clock) && hour < 12) hour += 12;
    if (/AM/i.test(clock) && hour === 12) hour = 0;
    return { hour, minute };
  };

  const localTehranTimings = (year, month, day) => {
    const radians = (value) => value * Math.PI / 180;
    const degrees = (value) => value * 180 / Math.PI;
    const normalize = (value) => ((value % 360) + 360) % 360;
    const julianDay = Date.UTC(year, month - 1, day, 12) / 86400000 + 2440587.5;
    const century = (julianDay - 2451545) / 36525;
    const longitudeMean = normalize(280.46646 + century * (36000.76983 + century * 0.0003032));
    const anomaly = 357.52911 + century * (35999.05029 - 0.0001537 * century);
    const eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
    const center = Math.sin(radians(anomaly)) * (1.914602 - century * (0.004817 + 0.000014 * century))
      + Math.sin(radians(2 * anomaly)) * (0.019993 - 0.000101 * century)
      + Math.sin(radians(3 * anomaly)) * 0.000289;
    const omega = 125.04 - 1934.136 * century;
    const solarLongitude = longitudeMean + center - 0.00569 - 0.00478 * Math.sin(radians(omega));
    const obliquityMean = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60;
    const obliquity = obliquityMean + 0.00256 * Math.cos(radians(omega));
    const declination = Math.asin(Math.sin(radians(obliquity)) * Math.sin(radians(solarLongitude)));
    const y = Math.tan(radians(obliquity) / 2) ** 2;
    const equationOfTime = 4 * degrees(
      y * Math.sin(2 * radians(longitudeMean))
      - 2 * eccentricity * Math.sin(radians(anomaly))
      + 4 * eccentricity * y * Math.sin(radians(anomaly)) * Math.cos(2 * radians(longitudeMean))
      - 0.5 * y * y * Math.sin(4 * radians(longitudeMean))
      - 1.25 * eccentricity * eccentricity * Math.sin(2 * radians(anomaly)),
    );
    const latitude = radians(38.7893);
    const longitude = -77.1872;
    const wallNoon = zonedTimeToUtc(year, month, day, 12, 0);
    const timezoneOffsetMinutes = (Date.UTC(year, month - 1, day, 12) - wallNoon.getTime()) / 60000;
    const solarNoon = 720 + timezoneOffsetMinutes - 4 * longitude - equationOfTime;
    const hourAngle = (altitude) => {
      const cosine = (Math.sin(radians(altitude)) - Math.sin(latitude) * Math.sin(declination))
        / (Math.cos(latitude) * Math.cos(declination));
      return Math.acos(Math.min(1, Math.max(-1, cosine))) * 180 / Math.PI;
    };
    const asrAltitude = degrees(Math.atan(1 / (1 + Math.tan(Math.abs(latitude - declination)))));
    const clock = (minutes) => {
      const rounded = ((Math.round(minutes) % 1440) + 1440) % 1440;
      return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
    };
    return [
      ["Fajr", clock(solarNoon - hourAngle(-17.7) * 4)],
      ["Sunrise", clock(solarNoon - hourAngle(-0.833) * 4)],
      ["Dhuhr", clock(solarNoon + 2)],
      ["Asr", clock(solarNoon + hourAngle(asrAltitude) * 4)],
      ["Maghrib", clock(solarNoon + hourAngle(-4.5) * 4)],
      ["Isha", clock(solarNoon + hourAngle(-14) * 4)],
    ];
  };

  const loadPrayerTimes = async () => {
    const list = document.getElementById("prayer-list");
    const note = document.getElementById("prayer-note");
    const dateEl = document.getElementById("prayer-date");
    if (!list && !document.getElementById("next-prayer-name") && !document.getElementById("prayer-page-next-name")) return;
    const now = new Date();
    const p = dateParts(now);
    const apiDate = `${p.day}-${p.month}-${p.year}`;
    if (dateEl) dateEl.textContent = dateInZone(now, { weekday: undefined, year: undefined });
    const presentTimings = (entries, noteText) => {
      if (list) list.replaceChildren(...entries.map(([name, value]) => {
        const row = document.createElement("div");
        row.className = "prayer-row";
        row.dataset.prayer = name;
        const label = document.createElement("span");
        label.textContent = name;
        const time = document.createElement("strong");
        time.textContent = value ? timeInZone((() => {
          const parts = parsePrayerClock(value);
          return parts ? zonedTimeToUtc(+p.year, +p.month, +p.day, parts.hour, parts.minute) : now;
        })()) : "—";
        row.append(label, time);
        return row;
      }));
      const makeInstants = (prayerEntries, dateParts, isTomorrow = false) => prayerEntries.filter(([name]) => name !== "Sunrise").map(([name, value]) => {
        const parts = parsePrayerClock(value);
        return parts ? { name, at: zonedTimeToUtc(+dateParts.year, +dateParts.month, +dateParts.day, parts.hour, parts.minute), isTomorrow } : null;
      }).filter(Boolean).sort((a, b) => a.at - b.at);
      const tomorrowUtc = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + 1, 12));
      const tomorrow = dateParts(tomorrowUtc, "UTC");
      prayerInstants = [
        ...makeInstants(entries, p),
        ...makeInstants(localTehranTimings(+tomorrow.year, +tomorrow.month, +tomorrow.day), tomorrow, true),
      ].sort((a, b) => a.at - b.at);
      if (note) note.textContent = noteText;
      updateNextPrayer();
      clearTimeout(prayerRefreshTimer);
      const nextDayStart = zonedTimeToUtc(+p.year, +p.month, +p.day + 1, 0, 2);
      prayerRefreshTimer = setTimeout(loadPrayerTimes, Math.max(30_000, nextDayStart - new Date()));
    };
    const endpoint = `https://api.aladhan.com/v1/timingsByCity/${apiDate}?city=Springfield&state=Virginia&country=United%20States&method=7&school=0`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Prayer API returned ${response.status}`);
      const payload = await response.json();
      if (payload.code !== 200 || !payload.data?.timings) throw new Error("Prayer times were unavailable");
      const timings = payload.data.timings;
      const entries = [
        ["Fajr", timings.Fajr], ["Sunrise", timings.Sunrise], ["Dhuhr", timings.Dhuhr],
        ["Asr", timings.Asr], ["Maghrib", timings.Maghrib], ["Isha", timings.Isha],
      ];
      presentTimings(entries, "Provider: AlAdhan. Calculated for Springfield with the University of Tehran method (method 7). These astronomical times are separate from IAC congregation and iqamah announcements.");
    } catch (error) {
      console.warn("Could not load prayer times:", error);
      try {
        presentTimings(localTehranTimings(+p.year, +p.month, +p.day), "AlAdhan is temporarily unavailable. Times are calculated locally for Springfield using the University of Tehran method 7 parameters (Fajr 17.7°, Maghrib 4.5°, Isha 14°), shown in America/New_York time. These are separate from IAC congregation and iqamah announcements.");
        clearTimeout(prayerRefreshTimer);
        prayerRefreshTimer = setTimeout(loadPrayerTimes, 15 * 60 * 1000);
      } catch (fallbackError) {
        console.warn("Could not calculate fallback prayer times:", fallbackError);
        if (list) list.innerHTML = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]
          .map((name) => `<div class="prayer-row"><span>${name}</span><strong>—</strong></div>`).join("");
        prayerInstants = [];
        if (note) note.textContent = prayerFallback;
        updateNextPrayer();
      }
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Five curated Facebook crowd photos, refreshed every Monday in Springfield local time.
  const photoLibrary = [
  {
    "kicker": "A place to belong",
    "title": "Community\nfirst.",
    "description": "A welcoming home for faith, learning, and service in Northern Virginia.",
    "primary": [
      "Find a program",
      "/#programs"
    ],
    "secondary": [
      "Get to know IAC",
      "/about/"
    ],
    "image": "/assets/fb-community-portrait.jpg",
    "position": "center 60%",
    "mobilePosition": "center 60%",
    "alt": "The IAC community gathered for a celebration",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=7828989470459847"
  },
  {
    "kicker": "Gather in remembrance",
    "title": "Faith in\ncommunity.",
    "description": "Come together for prayer, supplication, celebration, and care for one another.",
    "primary": [
      "See the weekly schedule",
      "/#programs"
    ],
    "secondary": [
      "Plan your visit",
      "/#contact"
    ],
    "image": "/assets/fb-community-celebration.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Families and community members attending an IAC program",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=7828987857126675"
  },
  {
    "kicker": "Learning for every age",
    "title": "Grow in\nknowledge.",
    "description": "Explore classes, youth activities, and opportunities to learn at every stage of life.",
    "primary": [
      "Explore education",
      "/#education"
    ],
    "secondary": [
      "Meet our community",
      "/staff/"
    ],
    "image": "/assets/fb-family-celebration.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Families celebrating together at Imam Ali Center",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=7702972973061498"
  },
  {
    "kicker": "A place to belong",
    "title": "Community\nfirst.",
    "description": "A welcoming home for faith, learning, and service in Northern Virginia.",
    "primary": [
      "Find a program",
      "/#programs"
    ],
    "secondary": [
      "Get to know IAC",
      "/about/"
    ],
    "image": "/assets/fb-community-tables.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Community members gathered around tables at IAC",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=7702971909728271"
  },
  {
    "kicker": "Gather in remembrance",
    "title": "Faith in\ncommunity.",
    "description": "Come together for prayer, supplication, celebration, and care for one another.",
    "primary": [
      "See the weekly schedule",
      "/#programs"
    ],
    "secondary": [
      "Plan your visit",
      "/#contact"
    ],
    "image": "/assets/fb-community-program.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "A full community gathering at Imam Ali Center",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=7702971269728335"
  },
  {
    "kicker": "Learning for every age",
    "title": "Grow in\nknowledge.",
    "description": "Explore classes, youth activities, and opportunities to learn at every stage of life.",
    "primary": [
      "Explore education",
      "/#education"
    ],
    "secondary": [
      "Meet our community",
      "/staff/"
    ],
    "image": "/assets/fb-eid-congregation.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "The IAC congregation gathered for Eid Takbeeraat",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=3337634279595411"
  },
  {
    "kicker": "A place to belong",
    "title": "Community\nfirst.",
    "description": "A welcoming home for faith, learning, and service in Northern Virginia.",
    "primary": [
      "Find a program",
      "/#programs"
    ],
    "secondary": [
      "Get to know IAC",
      "/about/"
    ],
    "image": "/assets/fb-eid-families.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Families gathering for Eid at Imam Ali Center",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=3337635346261971"
  },
  {
    "kicker": "Gather in remembrance",
    "title": "Faith in\ncommunity.",
    "description": "Come together for prayer, supplication, celebration, and care for one another.",
    "primary": [
      "See the weekly schedule",
      "/#programs"
    ],
    "secondary": [
      "Plan your visit",
      "/#contact"
    ],
    "image": "/assets/fb-eid-community.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Children and families together at the IAC Eid gathering",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=3337635382928634"
  },
  {
    "kicker": "Learning for every age",
    "title": "Grow in\nknowledge.",
    "description": "Explore classes, youth activities, and opportunities to learn at every stage of life.",
    "primary": [
      "Explore education",
      "/#education"
    ],
    "secondary": [
      "Meet our community",
      "/staff/"
    ],
    "image": "/assets/fb-eid-prayer.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "The community preparing for Eid prayer at IAC",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=3337635682928604"
  },
  {
    "kicker": "A place to belong",
    "title": "Community\nfirst.",
    "description": "A welcoming home for faith, learning, and service in Northern Virginia.",
    "primary": [
      "Find a program",
      "/#programs"
    ],
    "secondary": [
      "Get to know IAC",
      "/about/"
    ],
    "image": "/assets/fb-eid-standing.jpg",
    "position": "center 78%",
    "mobilePosition": "center 78%",
    "alt": "Families standing together in Eid prayer at Imam Ali Center",
    "portrait": false,
    "source": "https://www.facebook.com/photo/?fbid=3337633739595465"
  }
];
  const slides = window.IACPhotos.weeklyPhotos(photoLibrary);
  const heroImage = document.querySelector(".hero-image");
  const heroEnabled = Boolean(heroImage && document.getElementById("hero-kicker") && document.getElementById("hero-title"));
  const dots = document.getElementById("hero-dots");
  let activeSlide = 0;
  let heroTimer;
  let heroPaused=false, photoGeneration=0;
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const paintHero = (index) => {
    activeSlide = (index + slides.length) % slides.length;
    const slide = slides[activeSlide];
    document.getElementById("hero-kicker").textContent = slide.kicker;
    const titleNode = document.getElementById("hero-title");
    { titleNode.textContent = ""; const lines=slide.title.replace(/<br\s*\/?>/g,"\n").replace(/<\/?em>/g,"").split("\n");lines.forEach((line,i)=>{if(i)titleNode.append(document.createElement("br"));const node=document.createElement(i?"em":"span");node.textContent=line;titleNode.append(node);}); }
    document.getElementById("hero-description").textContent = slide.description;
    const primary = document.getElementById("hero-primary");
    primary.href = slide.primary[1];
    primary.textContent = `${slide.primary[0]} →`;
    const secondary = document.getElementById("hero-secondary");
    secondary.href = slide.secondary[1];
    secondary.textContent = slide.secondary[0];
    const generation=++photoGeneration;
    const current=heroImage.querySelector('.hero-frame');
    if(!current || current.querySelector('img')?.getAttribute('src')!==slide.image){
      const frame=document.createElement('div');frame.className='hero-frame'+(slide.portrait?' is-portrait':'');
      frame.style.setProperty('--photo',`url("${slide.image.replace(/["\\]/g,'')} ")`);
      const photo=new Image();photo.alt=slide.alt||'Imam Ali Center community · '+slide.kicker;
      photo.style.objectPosition=window.innerWidth<600?slide.mobilePosition:slide.position;
      photo.onload=()=>{if(generation!==photoGeneration)return;frame.append(photo);heroImage.append(frame);requestAnimationFrame(()=>frame.classList.add('is-visible'));setTimeout(()=>{if(generation!==photoGeneration)return;heroImage.querySelectorAll('.hero-frame').forEach(old=>{if(old!==frame)old.remove();});},reducedMotion.matches?0:1000);};
      photo.src=slide.image;
    }
    const copy=document.querySelector('.hero-copy');
    if(!reducedMotion.matches){copy?.getAnimations().forEach(animation=>animation.cancel());copy?.animate([{opacity:.55},{opacity:1}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});}
    const nextPhoto=new Image();nextPhoto.src=slides[(activeSlide+1)%slides.length].image;
    document.getElementById("hero-count").textContent = `${String(activeSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    dots?.querySelectorAll("button").forEach((button, i) => {
      button.classList.toggle("is-active", i === activeSlide);
      button.setAttribute("aria-current", i === activeSlide ? "true" : "false");
    });
  };
  if (dots) {
    slides.forEach((slide, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hero-dot";
      button.setAttribute("aria-label", `Show slide ${i + 1}: ${slide.kicker}`);
      button.addEventListener("click", () => { paintHero(i); resetHeroTimer(); });
      dots.append(button);
    });
  }
  const resetHeroTimer = () => {
    clearInterval(heroTimer);
    if (heroEnabled && !heroPaused && !document.hidden && !reducedMotion.matches) {
      heroTimer = setInterval(() => paintHero(activeSlide + 1), 7200);
    }
  };
  document.querySelector("[data-hero-next]")?.addEventListener("click", () => { paintHero(activeSlide + 1); resetHeroTimer(); });
  document.querySelector("[data-hero-prev]")?.addEventListener("click", () => { paintHero(activeSlide - 1); resetHeroTimer(); });
  if (heroEnabled) paintHero(0);
  resetHeroTimer();
  document.querySelector('[data-hero-pause]')?.addEventListener('click',event=>{heroPaused=!heroPaused;event.currentTarget.textContent=heroPaused?'▶':'Ⅱ';event.currentTarget.setAttribute('aria-label',heroPaused?'Play photo carousel':'Pause photo carousel');resetHeroTimer();});
  document.addEventListener('visibilitychange',resetHeroTimer);
  reducedMotion.addEventListener('change',resetHeroTimer);

  // Refined, once-only reveals: visible by default and immediate for reduced motion.
  if(!reducedMotion.matches && 'IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -24px 0px'});
    const reveal=()=>document.querySelectorAll('.section-heading,.education-card,.service-card,.schedule-card,.about-copy,.about-image,.prayer-feature,.page-hero,.content-card,.scholar-card,.expert-profile-card,.page-section-heading').forEach(node=>{
      if(node.hasAttribute('data-reveal'))return;
      node.setAttribute('data-reveal','');node.style.setProperty('--reveal-delay',`${Math.min(Array.from(node.parentElement.children).indexOf(node),3)*70}ms`);observer.observe(node);
    });
    reveal();new MutationObserver(reveal).observe(document.querySelector('main'),{childList:true,subtree:true});
    reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)document.querySelectorAll('[data-reveal]').forEach(node=>node.classList.add('is-revealed'));});
  }

  // Mobile navigation and the dismissible app prompt.
  const menuToggle = document.querySelector("[data-menu-toggle]");
  const nav = document.getElementById("primary-nav");
  const navGroups = [...document.querySelectorAll(".nav-group")];
  const hoverNavigation = window.matchMedia("(hover: hover) and (pointer: fine)");
  let suppressNextFocusOpen = null;
  let lastNavigationInput = "pointer";
  let pointerOpenGroup = null;
  document.addEventListener("pointerdown", () => { lastNavigationInput = "pointer"; });
  document.addEventListener("keydown", () => { lastNavigationInput = "keyboard"; pointerOpenGroup = null; }, true);
  const setMenu = (open) => {
    menuToggle?.setAttribute("aria-expanded", String(open));
    menuToggle?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    nav?.classList.toggle("is-open", open);
  };
  menuToggle?.addEventListener("click", () => setMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  navGroups.forEach((group) => {
    const summary = group.querySelector("summary");
    group.addEventListener("pointerenter", (event) => {
      if (hoverNavigation.matches && event.pointerType !== "touch") {
        lastNavigationInput = "pointer";
        pointerOpenGroup = group;
        navGroups.forEach((other) => { if (other !== group) other.open = false; });
        group.open = true;
      }
    });
    group.addEventListener("pointerleave", () => {
      if (hoverNavigation.matches && pointerOpenGroup === group) {
        group.open = false;
        pointerOpenGroup = null;
      }
    });
    group.addEventListener("focusin", () => {
      if (suppressNextFocusOpen === group) { suppressNextFocusOpen = null; return; }
      if (hoverNavigation.matches && lastNavigationInput === "keyboard") {
        navGroups.forEach((other) => { if (other !== group) other.open = false; });
        group.open = true;
      }
    });
    group.addEventListener("focusout", (event) => {
      if (hoverNavigation.matches && !group.contains(event.relatedTarget)) group.open = false;
    });
    summary?.addEventListener("click", (event) => {
      if (hoverNavigation.matches && group.open && !event.target.closest("a")) event.preventDefault();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const focusedGroup = navGroups.find((group) => group.contains(document.activeElement));
    const mobileWasOpen = nav?.classList.contains("is-open");
    navGroups.forEach((group) => { group.open = false; });
    setMenu(false);
    if (mobileWasOpen) menuToggle?.focus();
    else if (focusedGroup) {
      suppressNextFocusOpen = focusedGroup;
      focusedGroup.querySelector("summary")?.focus();
      setTimeout(() => { suppressNextFocusOpen = null; }, 0);
    }
  });
  document.addEventListener("click", (event) => {
    if (!nav?.contains(event.target)) navGroups.forEach((group) => { group.open = false; });
    if (nav?.classList.contains("is-open") && !nav.contains(event.target) && !menuToggle?.contains(event.target)) setMenu(false);
  });
  const appBanner = document.getElementById("app-banner");
  if (appBanner && sessionStorage.getItem("iac-app-banner-dismissed") === "yes") appBanner.classList.add("is-dismissed");
  document.querySelector("[data-dismiss-app]")?.addEventListener("click", () => {
    appBanner?.classList.add("is-dismissed");
    sessionStorage.setItem("iac-app-banner-dismissed", "yes");
  });

  // Program tabs, with the seasonal categories filterable on touch or keyboard.
  const tabs = [...document.querySelectorAll("[data-program-tab]")];
  const panels = { weekly: document.getElementById("weekly-panel"), special: document.getElementById("special-panel") };
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    const chosen = tab.dataset.programTab;
    tabs.forEach((button) => {
      const active = button === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    Object.entries(panels).forEach(([key, panel]) => {
      panel?.classList.toggle("is-active", key === chosen);
      if (panel) panel.hidden = key !== chosen;
    });
  }));
  document.querySelectorAll("[data-category-filter]").forEach((button) => button.addEventListener("click", () => {
    const category = button.dataset.categoryFilter;
    document.querySelectorAll("[data-category-filter]").forEach((pill) => {
      const active = pill === button;
      pill.classList.toggle("is-active", active);
      pill.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll(".special-card[data-category]").forEach((card) => {
      card.hidden = category !== "all" && card.dataset.category !== category;
    });
  }));

  // Calendar downloads use floating local times and weekly recurrence, with no invented end time.
  const icsEscape = (value) => String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const eventData = {
    tawassul: { title: "Dua Tawassul", day: 2, time: "19:00", description: "Brother Jaafar Al-Sadeq" },
    kumayl: { title: "Dua Kumayl", day: 4, time: "19:00", description: "Qari Moqset Moqami" },
    jumah: { title: "Friday Prayer", day: 5, time: "13:10", description: "Sheikh Mustafa Akhound" },
    "quran-circle": { title: "Qur’an Circle", day: 5, time: "18:00", description: "Qari Dr. Komail Sheikhzada" },
  };
  const nextWeekday = (weekday, eventTime) => {
    const nowParts = dateParts();
    const localNow = new Date();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const current = dayNames.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(localNow));
    let add = (weekday - current + 7) % 7;
    const [hour, minute] = eventTime.split(":").map(Number);
    const nowZonedHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(localNow));
    const nowZonedMinute = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, minute: "2-digit" }).format(localNow));
    if (add === 0 && (nowZonedHour > hour || (nowZonedHour === hour && nowZonedMinute >= minute))) add = 7;
    const asUtcDate = new Date(Date.UTC(+nowParts.year, +nowParts.month - 1, +nowParts.day + add));
    const next = dateParts(asUtcDate, "UTC");
    return { year: Number(next.year), month: Number(next.month), day: Number(next.day) };
  };
  document.querySelectorAll("[data-calendar]").forEach((button) => button.addEventListener("click", () => {
    const item = eventData[button.dataset.calendar];
    if (!item) return;
    const start = nextWeekday(item.day, item.time);
    const [hour, minute] = item.time.split(":").map(Number);
    const stamp = `${start.year}${String(start.month).padStart(2, "0")}${String(start.day).padStart(2, "0")}T${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}00`;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Imam Ali Center//Community Schedule//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      `UID:${button.dataset.calendar}-${stamp}@imamalicenter.org`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;TZID=America/New_York:${stamp}`, "RRULE:FREQ=WEEKLY", `SUMMARY:${icsEscape(item.title)}`,
      `DESCRIPTION:${icsEscape(`${item.description}. Check the IAC events page for schedule updates.`)}`,
      "LOCATION:Imam Ali Center\\, 7900 Backlick Rd\\, Springfield\\, VA 22150", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${button.dataset.calendar}.ics`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
    announce(`${item.title} calendar file downloaded. Check the IAC calendar before attending.`);
  }));

  // The channel remains the source of truth for recent videos; carousel buttons scroll the cards.
  const mediaTrack = document.getElementById("media-track");
  const shortIds = ['x-co99Vj_UM','1wY5CqqUIGI','80O_4Qu7654','oNcQLqPF8YU','CGKjZriJ6TU','ubd6bAabFo0','p1zi8KkY3KA'];
  let latestShorts=shortIds;
  function paintShorts(ids=latestShorts) {
    latestShorts=ids;
    if (!mediaTrack || ids.length<4) return;
    const day = Math.floor(Date.parse(localDayKey()+"T00:00:00Z")/86400000);
    mediaTrack.innerHTML = Array.from({length:ids.length},(_,i)=>`<article class="short-card"><iframe src="https://www.youtube-nocookie.com/embed/${ids[(day+i)%ids.length]}" title="Imam Ali Center Short ${i+1}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></article>`).join("");
  }
  const videoLibrary=document.getElementById("video-library");
  const renderVideoLibrary=(ids)=>{
    if(!videoLibrary)return;
    videoLibrary.innerHTML=ids.map((id,i)=>`<article class="short-card"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Imam Ali Center video ${i+1}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></article>`).join("");
  };
  paintShorts();renderVideoLibrary(shortIds);
  const loadSiteContent = () => fetch("/api/content").then(response=>{if(!response.ok)throw Error();return response.json();}).then(content=>{
    document.querySelectorAll('[data-booking]').forEach(button=>{
      const link=content.bookings?.[button.dataset.booking];
      if(typeof link!=='string')return;
      try{const url=new URL(link);if(url.protocol!=='https:'||url.hostname!=='koalendar.com'||!/^\/e\/[^/]+\/?$/.test(url.pathname)||url.username||url.password||url.search||url.hash)return;
      button.href=url.href;button.target='_blank';button.rel='noopener noreferrer';button.setAttribute('aria-label',`Book an appointment on Koalendar, external`);button.innerHTML='Book an appointment <span aria-hidden="true">↗</span>';}catch{}
    });
    if (heroEnabled && Array.isArray(content.slides) && content.slides.length) {
      slides.splice(0,slides.length,...window.IACPhotos.weeklyPhotos(content.slides));
      if(dots){dots.replaceChildren();slides.forEach((slide,i)=>{const b=document.createElement("button");b.type="button";b.className="hero-dot";b.setAttribute("aria-label",`Show slide ${i+1}: ${slide.kicker}`);b.addEventListener("click",()=>{paintHero(i);resetHeroTimer();});dots.append(b);});}
      paintHero(Math.min(activeSlide,slides.length-1));resetHeroTimer();
    }
    document.querySelectorAll(".education-grid .education-card > img, .education-grid .education-photo").forEach((image,i)=>{if(content.education?.[i]){image.src=content.education[i].image;image.alt=content.education[i].alt;}});
    if(Array.isArray(content.shorts)&&content.shorts.every(id=>/^[a-zA-Z0-9_-]{11}$/.test(id))){paintShorts(content.shorts);renderVideoLibrary(content.shorts);}
  }).catch(()=>{});
  loadSiteContent();
  let currentPhotoWeek=window.IACPhotos.photoWeek();
  const refreshPhotoWeek=()=>{const week=window.IACPhotos.photoWeek();if(week!==currentPhotoWeek){currentPhotoWeek=week;loadSiteContent();}};
  if(heroEnabled){setInterval(refreshPhotoWeek,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPhotoWeek();});}
  const moveShorts=direction=>{
    if(!mediaTrack)return;
    const first=mediaTrack.querySelector('.short-card');if(!first)return;
    const max=mediaTrack.scrollWidth-mediaTrack.clientWidth;
    const gap=parseFloat(getComputedStyle(mediaTrack).columnGap)||16;
    const step=first.getBoundingClientRect().width+gap;
    let next=mediaTrack.scrollLeft+direction*step;
    if(direction>0&&mediaTrack.scrollLeft>=max-3)next=0;
    if(direction<0&&mediaTrack.scrollLeft<=3)next=max;
    mediaTrack.scrollTo({left:Math.max(0,Math.min(max,next)),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  };
  document.querySelector('[data-media-left]')?.addEventListener('click',()=>moveShorts(-1));
  document.querySelector('[data-media-right]')?.addEventListener('click',()=>moveShorts(1));
  mediaTrack?.addEventListener('keydown',event=>{if(event.target!==mediaTrack)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();moveShorts(event.key==='ArrowRight'?1:-1);}});
  if(mediaTrack)mediaTrack.tabIndex=0;

  const requestForm=document.querySelector('[data-service-request]');
  if(requestForm){
    fetch('/api/service-delivery').then(r=>r.json()).then(data=>{if(data.mode==='email')document.querySelector('[data-delivery-note]').textContent='Your request and any documents are emailed directly to iacdmv@gmail.com. The website does not save the contents in its request database.';}).catch(()=>{});
    const service=requestForm.elements.service;
    const options={marriage:['Nikah ceremony','Pre-marital counseling','Marriage documentation','Other'],divorce:['Counseling & mediation','Religious divorce guidance','Certificate inquiry','Other'],funeral:['Funeral arrangements','Memorial & Fatiha gathering','Bereavement support','Other'],consultation:['Religious & family guidance','Medical guidance','Mental health & wellbeing','Real estate','Legal guidance','Tax & financial guidance','Other'],'rent-a-hall':['Ghadeer Hall (Main)','Small Hall','Not sure yet'],membership:['Joining','Renewal','Membership question'],'religious-question':[]};
    const labels={marriage:'Marriage & Nikah',divorce:'Divorce guidance',funeral:'Funeral & bereavement',consultation:'Consultation','rent-a-hall':'Hall rental',membership:'Membership','religious-question':'Ask a religious question'};
    const requestAppearance=JSON.parse(document.getElementById('request-appearance').textContent);
    const selected=new URLSearchParams(location.search).get('service');if(Object.hasOwn(options,selected))service.value=selected;
    const centerCallLinks=Array.from(document.querySelectorAll('a[href="tel:+15714443578"]')).map(link=>({link,html:link.innerHTML}));
    function updateService(){
      const key=service.value,fields=requestForm.querySelector('[data-request-fields]');
      const hallRental=key==='rent-a-hall';
      for(const {link,html} of centerCallLinks){
        link.href=hallRental?'tel:+15714262893':'tel:+15714443578';
        link.innerHTML=hallRental?html.replaceAll('(571) 444-3578','(571) 426-2893'):html;
      }
      document.getElementById('request-contact').innerHTML=hallRental
        ? 'For hall rental assistance, call <a href="tel:+15714262893">(571) 426-2893</a>.'
        : 'For immediate funeral assistance, call <a href="tel:+15714443578">(571) 444-3578</a>.';
      const appearance=requestAppearance[key]||requestAppearance.default;
      const hero=document.querySelector('.interior-hero-service-request');
      hero.style.setProperty('--interior-image',`url('${appearance.image}')`);
      hero.style.setProperty('--request-image-position',appearance.position);
      document.getElementById('request-page-title').textContent=appearance.heading;
      document.getElementById('request-page-lead').textContent=appearance.lead;
      document.getElementById('request-page-eyebrow').textContent=appearance.eyebrow;
      document.getElementById('request-page-breadcrumb').textContent=appearance.heading;
      document.title=`${appearance.heading} | Imam Ali Center`;
      document.getElementById('request-heading').textContent=labels[key]||'Request a service';
      const back=document.getElementById('request-back');back.href=key==='religious-question'?'/consultation/':Object.hasOwn(options,key)?`/${key}/`:'/contact/';back.textContent=key?`Back to ${labels[key]}`:'Contact IAC';
      fields.innerHTML=options[key]?.length?`<label>${key==='rent-a-hall'?'Preferred hall':'Type of support'}<select name="topic" required><option value="">Choose an option</option>${options[key].map(value=>`<option>${value}</option>`).join('')}</select></label>`:'';
      if(['marriage','consultation','rent-a-hall'].includes(key))fields.insertAdjacentHTML('beforeend','<label>Preferred date (optional)<input name="date" type="date"></label>');
      if(['consultation','religious-question'].includes(key))fields.insertAdjacentHTML('beforeend','<label>Preferred professional or scholar (optional)<input name="professional" maxlength="120"></label>');
      requestForm.elements.message.required=key==='religious-question';requestForm.elements.message.closest('label').firstChild.textContent=key==='religious-question'?'Your question':'Brief message (optional)';
      delete requestForm.dataset.requestId;
    }
    let questionnaire=null;
    const escapeField=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
    const questionContainer=document.createElement('div');questionContainer.className='request-questionnaire';requestForm.querySelector('[data-request-fields]').after(questionContainer);
    function showQuestions(){
      const key=service.value,config=questionnaire?.[key];
      const current=Object.fromEntries(Array.from(questionContainer.querySelectorAll('input:not([type="file"]),select,textarea')).map(input=>[input.name,input.value]));
      if(!config||config.detailTopics&&!config.detailTopics.includes(requestForm.elements.topic?.value)){questionContainer.innerHTML='';return;}
      questionContainer.innerHTML=config.questions.map(q=>{
        const required=q.required?' required':'',name=escapeField(q.name),label=escapeField(q.label),max=q.max||254;
        let input;
        if(q.type==='file')input=`<input name="document:${name}" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple><small>Optional · PDF, JPG, PNG, or WebP. Up to 2 files here, 5 MB each; 10 files and 10 MB total per request.</small>`;
        else if(q.type==='select')input=`<select name="${name}"${required}><option value="">Choose an option</option>${q.options.map(v=>`<option>${escapeField(v)}</option>`).join('')}</select>`;
        else if(q.type==='textarea')input=`<textarea name="${name}" rows="3" maxlength="${max}"${required}></textarea>`;
        else input=`<input name="${name}" type="${q.type||'text'}" ${q.type==='number'?`min="${q.min||0}" max="${q.maxValue||10000}"`:`maxlength="${max}"`}${required}>`;
        return `${q.section?`<h3>${escapeField(q.section)}</h3>`:''}<label data-question="${name}">${label}${q.required?' <span aria-hidden="true">*</span>':''}${input}${q.help?`<small>${escapeField(q.help)}</small>`:''}</label>`;
      }).join('');
      Object.entries(current).forEach(([name,value])=>{const input=requestForm.elements.namedItem(name);if(input&&!(input instanceof RadioNodeList))input.value=value;});
      refreshConditionalQuestions();
    }
    function refreshConditionalQuestions(){
      const config=questionnaire?.[service.value];for(const q of config?.questions||[]){if(!q.showIf)continue;const label=questionContainer.querySelector(`[data-question="${q.name}"]`);if(!label)continue;const shown=requestForm.elements.namedItem(q.showIf.field)?.value===q.showIf.value;label.hidden=!shown;label.querySelectorAll('input,select,textarea').forEach(input=>{input.disabled=!shown;});}
    }
    questionContainer.addEventListener('change',refreshConditionalQuestions);
    const previousUpdateService=updateService;
    updateService=function(){questionContainer.innerHTML='';previousUpdateService();const config=questionnaire?.[service.value];if(config?.detailTopics&&requestForm.elements.topic)requestForm.elements.topic.value=config.detailTopics[0];showQuestions();if(['marriage','divorce'].includes(service.value))requestForm.elements.topic?.addEventListener('change',showQuestions);if(service.value==='rent-a-hall')requestForm.elements.date?.closest('label').remove();};
    fetch('/service-form-config.json?v=21').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{questionnaire=data;updateService();}).catch(()=>{requestForm.querySelector('.form-feedback').textContent='Detailed questions could not load. Refresh the page before submitting, or call IAC.';requestForm.querySelector('[type="submit"]').disabled=true;});

    service.addEventListener('change',()=>updateService());updateService();
    document.querySelector('[data-another-request]').addEventListener('click',()=>{requestForm.reset();service.value=selected&&Object.hasOwn(options,selected)?selected:'';updateService();requestForm.hidden=false;document.querySelector('.request-success').hidden=true;requestForm.dispatchEvent(new Event('refresh-captcha'));service.focus();});
  }

  // General contact and newsletter inquiries still prepare an email.
  const openEmail = (subject, lines, feedback) => {
    const mailto = `mailto:${IAC_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = mailto;
    if (feedback) feedback.textContent = "Your email app should open with the message ready. Please send it there to reach the Center.";
  };
  document.getElementById("scholar-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    openEmail("Scholar consultation inquiry", [
      `Question: ${data.get("question")}`, `Phone: ${data.get("phone")}`,
      `Preferred scholar: ${data.get("scholar") || "No preference"}`,
    ], form.querySelector(".form-feedback"));
  });
  document.getElementById("contact-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    openEmail("Volunteer and program inquiry", [
      `Name: ${data.get("first")} ${data.get("last")}`, `Email: ${data.get("email")}`,
      "", `How I would like to help: ${data.get("message")}`,
    ], form.querySelector(".form-feedback"));
  });
  document.getElementById("newsletter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    openEmail("Newsletter signup request", [`Please add ${data.get("email")} to the IAC weekly newsletter.`], form.querySelector(".form-feedback"));
  });

  document.querySelectorAll("[data-inquiry]").forEach(form=>form.addEventListener("submit",event=>{
    event.preventDefault();
    openEmail(form.dataset.inquiry,[...new FormData(form)].filter(([key])=>key!=="captcha").map(([key,value])=>`${key}: ${value}`),form.querySelector(".form-feedback"));
  }));

  // One-use verification is checked by the server before preparing any public inquiry.
  const verifiedForms=new WeakSet();
  document.querySelectorAll("form:not([data-admin-form]):not([data-square-form])").forEach(form=>{
    const box=document.createElement("div");box.className="captcha-field";
    box.innerHTML='<span>Spam protection</span><div><img alt="Verification code: enter the five characters shown"><button type="button">New image</button></div><label>Enter the five characters<input name="captcha" autocomplete="off" autocapitalize="characters" maxlength="5" required></label><p class="captcha-status" role="status">Loading verification…</p><p class="small-note">If you cannot read the image, request a new one or call (571) 444-3578 for help.</p>';
    if(form.id==='newsletter-form'){
      box.classList.add('captcha-inline');
      box.innerHTML='<div><img alt="Verification code: enter the five characters shown"><button type="button" aria-label="Get a new verification image" title="Get a new code">↻</button></div><label><span class="sr-only">Enter the five verification characters</span><input name="captcha" placeholder="Code" aria-label="Verification code" autocomplete="off" autocapitalize="characters" maxlength="5" required></label><p class="captcha-status" role="status">Loading verification…</p>';
    }
    const submit=form.querySelector('[type="submit"]');if(submit)form.insertBefore(box,submit);else form.append(box);
    let challenge=null,loading=false;const note=box.querySelector('.captcha-status');
    async function refresh(){if(loading)return;loading=true;challenge=null;note.classList.remove('is-error');note.textContent='Loading verification…';try{const response=await fetch('/api/captcha');const data=await response.json();if(!response.ok)throw Error(data.error);challenge=data.id;box.querySelector('img').src=data.image;box.querySelector('input').value='';note.textContent='Codes expire after five minutes.';}catch(e){note.classList.add('is-error');note.textContent=e.message||'Verification is unavailable. Please call the Center.';}finally{loading=false;}}
    box.querySelector('button').addEventListener('click',refresh);form.addEventListener('refresh-captcha',refresh);refresh();
    form.addEventListener('submit',async event=>{
      if(verifiedForms.has(form)){verifiedForms.delete(form);return;}
      event.preventDefault();event.stopImmediatePropagation();
      if(!challenge){note.classList.add('is-error');note.textContent='Please wait for verification to load or request a new image.';return;}
      if(form.dataset.verifying)return;form.dataset.verifying='true';
      if(form.hasAttribute('data-service-request')){
        const button=form.querySelector('[type="submit"]'),feedback=form.querySelector('.form-feedback');button.disabled=true;feedback.textContent='Sending your request…';
        try{
          const raw=new FormData(form),fields={},uploads=[];let total=0;
          for(const [key,value] of raw){
            if(value instanceof File){if(!value.size)continue;total+=value.size;uploads.push([key,value]);if(value.size>5*1024*1024)throw Error('Each document must be 5 MB or smaller.');}
            else if(!['service','captcha','consent'].includes(key))fields[key]=value;
          }
          if(uploads.length>10||total>10*1024*1024)throw Error('Upload up to 10 files, with a combined size of 10 MB or less.');
          const counts={};for(const [key] of uploads){counts[key]=(counts[key]||0)+1;if(counts[key]>2)throw Error('Upload at most two files for each document question.');}
          form.dataset.requestId ||= crypto.randomUUID();
          const payload={id:form.dataset.requestId,service:form.elements.service.value,fields,consent:form.elements.consent.checked,captchaId:challenge,captchaAnswer:box.querySelector('input').value};
          const body=new FormData();body.append('request',JSON.stringify(payload));for(const [key,file] of uploads)body.append(key,file);
          const response=await fetch('/api/service-requests',{method:'POST',body});
          const data=await response.json();if(!response.ok)throw Error(data.error||'Your request could not be sent. Please call the Center.');
          form.hidden=true;const success=document.querySelector('.request-success');success.hidden=false;success.querySelector('[data-delivery-success]').textContent=data.delivery==='email'?'Your request and any attachments have been sent to iacdmv@gmail.com. IAC will use the contact details you provided to follow up.':'Your request has been saved for IAC to review in the admin inbox. IAC will use your contact details to follow up.';success.querySelector('[data-request-reference]').textContent=`Your reference: ${data.reference}`;success.focus();challenge=null;
        }catch(e){await refresh();feedback.textContent=e.message||'Your request could not be sent. Please try again or call the Center.';}
        finally{button.disabled=false;delete form.dataset.verifying;}return;
      }
      try{note.textContent='Checking code…';const response=await fetch('/api/captcha/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:challenge,answer:box.querySelector('input').value})});const data=await response.json();if(!response.ok)throw Error(data.error);note.textContent='Verified. Your email is ready to prepare.';verifiedForms.add(form);form.requestSubmit();challenge=null;}
      catch(e){await refresh();note.classList.add('is-error');note.textContent=e.message;}finally{delete form.dataset.verifying;}
    },true);
  });

  const hijriCalendar = document.getElementById("hijri-calendar-grid");
  if (hijriCalendar) {
    let calendarEpoch=null,calendarTick=performance.now(),calendarClockSource='device';
    const calendarNow=()=>calendarEpoch===null?new Date():new Date(calendarEpoch+performance.now()-calendarTick);
    const calendarDayKey=()=>localDayKey(calendarNow());
    let calendarCursor = (() => {
      const parts = dateParts();
      return { year: Number(parts.year), month: Number(parts.month) };
    })();
    let calendarRender=0,calendarLastDay=calendarDayKey();
    const syncCalendarClock=async()=>{
      try{const response=await fetch('/api/site-time',{cache:'no-store',signal:AbortSignal.timeout(5000)});const data=await response.json();if(!response.ok||!Number.isFinite(data.epochMs)||data.timeZone!==TZ)throw Error('Clock unavailable');calendarEpoch=data.epochMs;calendarTick=performance.now();calendarClockSource='server';}catch{calendarClockSource=calendarEpoch===null?'device':'server';}
    };
    const renderHijriCalendar = async () => {
      const renderId=++calendarRender;
      const heading = document.getElementById("hijri-month-label");
      const status = document.getElementById("hijri-calendar-status");
      if (!heading || !status) return;
      const { year, month } = calendarCursor;
      heading.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: TZ }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
      status.textContent = "Loading calculated dates…";
      hijriCalendar.replaceChildren();
      const endpoint = `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=Springfield&state=Virginia&country=United%20States&method=7&school=0`;
      let days;
      let sourceNote;
      try {
        const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Calendar request returned ${response.status}`);
        const payload = await response.json();
        if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Calendar dates unavailable");
        const expectedLength=new Date(Date.UTC(year,month,0)).getUTCDate();
        if(payload.data.length!==expectedLength||payload.data.some((entry,index)=>entry.date?.gregorian?.date!==`${String(index+1).padStart(2,'0')}-${String(month).padStart(2,'0')}-${year}`))throw Error('Calendar dates do not match the requested month');
        days = payload.data.map((entry) => ({
          gregorian: {
            day: entry.date.gregorian.day,
            date: entry.date.gregorian.date,
            weekday: entry.date.gregorian.weekday.en,
          },
          hijri: {
            day: entry.date.hijri.day,
            month: entry.date.hijri.month.en,
            date: entry.date.hijri.date,
          },
        }));
        sourceNote = "Dates calculated by AlAdhan for Springfield. Local moon sighting and IAC announcements determine observance.";
      } catch (error) {
        console.warn("Could not load Hijri calendar:", error);
        try {
          const islamicDate = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
            timeZone: "UTC", day: "numeric", month: "long", year: "numeric", weekday: "long",
          });
          const monthLength = new Date(Date.UTC(year, month, 0)).getUTCDate();
          days = Array.from({ length: monthLength }, (_, index) => {
            const day = index + 1;
            const date = new Date(Date.UTC(year, month - 1, day, 12));
            const parts = Object.fromEntries(islamicDate.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
            return {
              gregorian: { day: String(day), date: `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`, weekday: parts.weekday },
              hijri: { day: parts.day, month: parts.month, date: `${parts.day}-${parts.month}-${parts.year}` },
            };
          });
          sourceNote = "AlAdhan is temporarily unavailable. Dates are shown using the browser’s calculated Umm al-Qura calendar; local moon sighting and IAC announcements determine observance.";
        } catch (fallbackError) {
          console.warn("Could not calculate Hijri calendar fallback:", fallbackError);
          status.textContent = "Calculated dates are unavailable right now. Please try again, and follow IAC announcements for local observance.";
          return;
        }
      }
      if(renderId!==calendarRender)return;
      const today=calendarDayKey();
      const todayText=new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(calendarNow());
      const todayLabel=document.getElementById('calendar-today-label');
      if(todayLabel)todayLabel.textContent=`Today: ${todayText} · Springfield, Virginia${calendarClockSource==='device'?' · Using your device clock while the site clock is unavailable.':''}`;
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const headerCells = weekdays.map((day) => {
        const el = document.createElement("div");
        el.className = "calendar-weekday";
        el.textContent = day;
        return el;
      });
      const firstDateParts = days[0]?.gregorian?.date?.split("-").map(Number);
      const offset = firstDateParts ? new Date(Date.UTC(firstDateParts[2], firstDateParts[1] - 1, firstDateParts[0])).getUTCDay() : 0;
      const blanks = Array.from({ length: offset }, () => {
        const el = document.createElement("div");
        el.className = "calendar-day is-empty";
        el.setAttribute("aria-hidden", "true");
        return el;
      });
      const dayCells = days.map((entry) => {
        const cell = document.createElement("article");
        cell.className = "calendar-day";
        const solar = document.createElement("strong");
        solar.textContent = String(Number(entry.gregorian.day));
        const lunar = document.createElement("span");
        lunar.textContent = `${entry.hijri.day} ${entry.hijri.month}`;
        const weekday = document.createElement("small");
        weekday.textContent = entry.gregorian.weekday;
        cell.append(solar, lunar, weekday);
        const [dayNumber,monthNumber,yearNumber]=entry.gregorian.date.split('-').map(Number);
        const cellKey=`${yearNumber}-${String(monthNumber).padStart(2,'0')}-${String(dayNumber).padStart(2,'0')}`;
        cell.setAttribute('aria-label',`${entry.gregorian.weekday}, ${monthNumber}/${dayNumber}/${yearNumber}; calculated Hijri date ${entry.hijri.day} ${entry.hijri.month}${cellKey===today?'; Today in Springfield':''}`);
        if(cellKey===today){cell.classList.add('is-today');cell.setAttribute('aria-current','date');const badge=document.createElement('span');badge.className='calendar-today-badge';badge.textContent='Today';cell.append(badge);}
        if (Number(entry.hijri.day) === 1) cell.classList.add("is-hijri-month-start");
        return cell;
      });
      hijriCalendar.replaceChildren(...headerCells, ...blanks, ...dayCells);
      status.textContent = sourceNote;
    };
    document.querySelector("[data-hijri-prev]")?.addEventListener("click", () => {
      calendarCursor.month -= 1;
      if (calendarCursor.month < 1) { calendarCursor.month = 12; calendarCursor.year -= 1; }
      renderHijriCalendar();
    });
    document.querySelector("[data-hijri-next]")?.addEventListener("click", () => {
      calendarCursor.month += 1;
      if (calendarCursor.month > 12) { calendarCursor.month = 1; calendarCursor.year += 1; }
      renderHijriCalendar();
    });
    document.querySelector('[data-hijri-today]')?.addEventListener('click',async()=>{await syncCalendarClock();const parts=dateParts(calendarNow());calendarCursor={year:Number(parts.year),month:Number(parts.month)};renderHijriCalendar();});
    const refreshCalendarDay=async()=>{await syncCalendarClock();const today=calendarDayKey();if(today!==calendarLastDay){const oldMonth=calendarLastDay.slice(0,7),shownMonth=`${calendarCursor.year}-${String(calendarCursor.month).padStart(2,'0')}`;if(shownMonth===oldMonth){const parts=dateParts(calendarNow());calendarCursor={year:Number(parts.year),month:Number(parts.month)};}calendarLastDay=today;renderHijriCalendar();}};
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCalendarDay();});
    setInterval(refreshCalendarDay,60000);
    syncCalendarClock().then(()=>{const parts=dateParts(calendarNow());calendarCursor={year:Number(parts.year),month:Number(parts.month)};calendarLastDay=calendarDayKey();renderHijriCalendar();});
  }
  showDailyWisdom();
  loadPrayerTimes();
  setInterval(updateNextPrayer, 1000);
  let lastFeatureDay=localDayKey();
  setInterval(()=>{const today=localDayKey();if(today!==lastFeatureDay){lastFeatureDay=today;showDailyWisdom();paintShorts();loadPrayerTimes();}},30000);
})();
