const NS = "http://www.w3.org/2000/svg";
export const effects = {
  plankton: {
    title: "A CLEAN TURN",
    duration: 1050,
    jump: 0,
    spin: 0,
    powder: 8,
    color: "#dff5fa",
  },
  tooclever: {
    title: "THE POPULAR LINE",
    duration: 1200,
    jump: 0,
    spin: 0,
    powder: 12,
    color: "#c9e8ed",
  },
  schooler: {
    title: "NICE CARVE",
    duration: 1450,
    jump: 8,
    spin: 0,
    powder: 22,
    color: "#d6f1ff",
  },
  rare: {
    title: "FRESH POWDER",
    duration: 1750,
    jump: 32,
    spin: 0,
    powder: 36,
    color: "#91e0d5",
  },
  deepcut: {
    title: "OFF-PISTE!",
    duration: 2150,
    jump: 62,
    spin: 0,
    powder: 52,
    color: "#c4adf3",
  },
  krillion: {
    title: "FIRST TRACKS!",
    duration: 2650,
    jump: 100,
    spin: 360,
    powder: 80,
    color: "#f4c766",
  },
  miss: {
    title: "NEXT TURN. NEW LINE.",
    duration: 500,
    jump: 0,
    spin: 0,
    powder: 0,
    color: "#b6c6c8",
  },
};

export function createDescent() {
  const svg = document.getElementById("mountain"),
    panel = svg.closest(".mountain-panel");
  const path = document.getElementById("run-path"),
    trail = document.getElementById("ski-trail");
  const skier = document.getElementById("skier"),
    motion = document.getElementById("skier-motion"),
    art = document.getElementById("skier-art"),
    shadow = document.getElementById("ski-shadow");
  const particles = document.getElementById("snow-particles"),
    callout = document.getElementById("descent-callout");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    length = path.getTotalLength();
  trail.style.strokeDasharray = String(length);
  let position = 0,
    score = 0,
    frame = 0,
    calloutTimer = 0,
    camera = null,
    lastTier = "";
  const snow = [];
  function clear() {
    cancelAnimationFrame(frame);
    for (const p of snow) p.node.remove();
    snow.length = 0;
    camera?.cancel();
    camera = null;
  }
  function pose(progress, height = 0, spin = 0, lean = 0) {
    const point = path.getPointAtLength(progress * length),
      ahead = path.getPointAtLength(Math.min(length, progress * length + 4));
    const facing = ahead.x < point.x ? -1 : 1;
    height = Math.min(height, Math.max(0, point.y - 140));
    skier.setAttribute("transform", `translate(${point.x} ${point.y})`);
    motion.setAttribute(
      "transform",
      `translate(0 ${-height}) rotate(${spin + lean})`,
    );
    art.setAttribute("transform", `scale(${facing} 1)`);
    shadow.setAttribute("opacity", String(1 - Math.min(0.65, height / 160)));
    shadow.setAttribute("rx", String(27 + height * 0.14));
    trail.style.strokeDashoffset = String(length * (1 - progress));
    return point;
  }
  function flake(point, color, burst = false, star = false) {
    const node = document.createElementNS(NS, star ? "path" : "circle");
    const size = star ? 4 + Math.random() * 3 : 1.5 + Math.random() * 3;
    if (star)
      node.setAttribute(
        "d",
        `M0 ${-size} ${size * 0.35} ${-size * 0.35} ${size} 0 ${size * 0.35} ${size * 0.35} 0 ${size} ${-size * 0.35} ${size * 0.35} ${-size} 0 ${-size * 0.35} ${-size * 0.35}Z`,
      );
    else node.setAttribute("r", String(size));
    node.setAttribute("fill", color);
    particles.appendChild(node);
    snow.push({
      node,
      x: point.x,
      y: point.y + 4,
      vx: (Math.random() - 0.5) * (burst ? 160 : 70),
      vy: -25 - Math.random() * (burst ? 130 : 65),
      age: 0,
      life: 550 + Math.random() * 800,
      spin: Math.random() * 360,
    });
  }
  function showCallout(profile, tier, metres) {
    clearTimeout(calloutTimer);
    callout.hidden = false;
    callout.dataset.tier = tier;
    document.getElementById("descent-title").textContent = profile.title;
    document.getElementById("descent-distance").textContent = metres
      ? `+${metres.toLocaleString()}m`
      : "";
    calloutTimer = setTimeout(() => {
      callout.hidden = true;
    }, profile.duration + 1200);
  }
  function setScore(next, { tier = null, celebrate = false } = {}) {
    if (next === score && !celebrate) return;
    const previousScore = score,
      target = Math.min(1, Math.max(0, next / 700));
    clear();
    score = next;
    if (!celebrate) {
      position = target;
      pose(position);
      return;
    }
    const profile = effects[tier] ?? effects.miss;
    lastTier = tier;
    panel.dataset.effect = tier;
    panel.dataset.lastTier = tier;
    const from = position,
      metres = (next - previousScore) * 10;
    showCallout(profile, tier, metres);
    if (reduced.matches) {
      position = target;
      pose(position);
      return;
    }
    if (profile.jump >= 32)
      camera = svg.animate(
        [
          { transform: "scale(1)" },
          { transform: `scale(${tier === "krillion" ? 1.035 : 1.018})` },
          { transform: "scale(1)" },
        ],
        { duration: profile.duration, easing: "ease-in-out" },
      );
    const start = performance.now();
    let previous = start,
      emitted = 0,
      landed = false;
    const update = (now) => {
      const elapsed = now - start,
        t = Math.min(1, elapsed / profile.duration),
        dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      position = from + (target - from) * eased;
      const airborne = Math.max(0, Math.min(1, (t - 0.2) / 0.65));
      const jump = Math.sin(Math.PI * airborne) * profile.jump;
      const spin = profile.spin * (airborne * airborne * (3 - 2 * airborne));
      const lean =
        tier === "miss"
          ? Math.sin(t * Math.PI * 6) * 10
          : Math.sin(t * Math.PI * 2) * (profile.jump ? 12 : 8);
      const point = pose(position, jump, spin, lean);
      const wanted = Math.floor(t * profile.powder * 0.45);
      while (emitted < wanted && snow.length < 140) {
        flake(point, Math.random() > 0.3 ? "#ffffff" : profile.color);
        emitted++;
      }
      if (t === 1 && !landed) {
        landed = true;
        pose(target);
        for (let i = 0; i < profile.powder * 0.7; i++)
          flake(
            point,
            i % 3 === 0 ? profile.color : "#fff",
            true,
            tier === "krillion" && i % 5 === 0,
          );
      }
      for (let i = snow.length - 1; i >= 0; i--) {
        const p = snow[i];
        p.age += dt * 1000;
        if (p.age >= p.life) {
          p.node.remove();
          snow.splice(i, 1);
          continue;
        }
        p.vy += 95 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.node.setAttribute(
          "transform",
          `translate(${p.x} ${p.y}) rotate(${p.spin + p.age * 0.05})`,
        );
        p.node.setAttribute(
          "opacity",
          String(Math.pow(1 - p.age / p.life, 0.7)),
        );
      }
      if (t < 1 || snow.length) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
  }
  function reset(next = 0) {
    clear();
    clearTimeout(calloutTimer);
    callout.hidden = true;
    delete panel.dataset.effect;
    delete panel.dataset.lastTier;
    lastTier = "";
    score = next;
    position = next / 700;
    pose(position);
  }
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      clear();
      position = score / 700;
      pose(position);
    }
  });
  reset();
  return {
    setScore,
    reset,
    get lastTier() {
      return lastTier;
    },
  };
}
