import { createSkier } from "./skier.js";

const NS = "http://www.w3.org/2000/svg";
export const effects = {
  plankton: {
    title: "COMMON",
    duration: 1050,
    jump: 0,
    spin: 0,
    powder: 8,
    color: "#dff5fa",
  },
  tooclever: {
    title: "POPULAR ALTERNATIVE",
    duration: 1200,
    jump: 0,
    spin: 0,
    powder: 12,
    color: "#c9e8ed",
  },
  schooler: {
    title: "UNCOMMON",
    duration: 1450,
    jump: 8,
    spin: 0,
    powder: 22,
    color: "#d6f1ff",
  },
  rare: {
    title: "RARE",
    duration: 1750,
    jump: 32,
    spin: 0,
    powder: 36,
    color: "#91e0d5",
  },
  deepcut: {
    title: "VERY RARE",
    duration: 2150,
    jump: 62,
    spin: 0,
    powder: 52,
    color: "#c4adf3",
  },
  krillion: {
    title: "STANDOUT",
    duration: 2650,
    jump: 100,
    spin: 360,
    powder: 80,
    color: "#f4c766",
  },
  miss: {
    title: "NO SCORE",
    duration: 500,
    jump: 0,
    spin: 0,
    powder: 0,
    color: "#b6c6c8",
  },
};

export function createDescent() {
  const svg = document.getElementById("mountain"),
    panel = svg.closest(".mountain-panel"),
    path = document.getElementById("run-path"),
    trail = document.getElementById("ski-trail"),
    skier = document.getElementById("skier"),
    motion = document.getElementById("skier-motion"),
    art = document.getElementById("skier-art"),
    shadow = document.getElementById("ski-shadow"),
    particles = document.getElementById("snow-particles"),
    callout = document.getElementById("descent-callout"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    rig = createSkier(art),
    length = path.getTotalLength();
  trail.style.strokeDasharray = String(length);
  let position = 0,
    score = 0,
    frame = 0,
    calloutTimer = 0,
    action = null,
    lastTier = "",
    previous = 0,
    lastDraw = 0,
    phase = 0,
    edge = 0,
    bearing = 25,
    energy = 0,
    inView = true;
  const snow = [];
  const clamp = (x, min = 0, max = 1) => Math.max(min, Math.min(max, x));
  const smooth = (x) => x * x * (3 - 2 * x);
  const pointAt = (progress) => path.getPointAtLength(clamp(progress) * length);

  function clear() {
    action = null;
    for (const p of snow) p.node.remove();
    snow.length = 0;
  }
  function pose({ height = 0, spin = 0, tuck = 0, landing = 0 } = {}) {
    const point = pointAt(position);
    height = Math.min(height, Math.max(0, point.y - 120));
    skier.setAttribute("transform", `translate(${point.x} ${point.y})`);
    motion.setAttribute(
      "transform",
      `translate(0 ${-height}) rotate(${edge * 3})`,
    );
    // A jump rotates around the skier's vertical axis, rather than cartwheeling.
    const yaw = Math.cos((spin * Math.PI) / 180);
    art.setAttribute("transform", `scale(${yaw} 1)`);
    rig.pose({
      phase,
      edge,
      bearing,
      energy,
      tuck,
      landing,
      airborne: height > 1,
      backwards: yaw < 0,
      still: reduced.matches,
    });
    shadow.setAttribute(
      "opacity",
      String(0.16 * (1 - Math.min(0.7, height / 130))),
    );
    shadow.setAttribute("rx", String(31 - Math.min(12, height * 0.1)));
    trail.style.strokeDashoffset = String(length * (1 - position));
    return point;
  }
  function flake(point, color, burst = false, star = false) {
    const node = document.createElementNS(NS, star ? "path" : "circle"),
      size = star ? 3 + Math.random() * 2 : 1 + Math.random() * 2;
    if (star)
      node.setAttribute(
        "d",
        `M0 ${-size} ${size * 0.3} ${-size * 0.3} ${size} 0 ${size * 0.3} ${size * 0.3} 0 ${size} ${-size * 0.3} ${size * 0.3} ${-size} 0 ${-size * 0.3} ${-size * 0.3}Z`,
      );
    else node.setAttribute("r", String(size));
    node.setAttribute("fill", color);
    particles.appendChild(node);
    snow.push({
      node,
      x: point.x - edge * 12,
      y: point.y + 4,
      vx: -edge * 35 + (Math.random() - 0.5) * (burst ? 110 : 50),
      vy: -15 - Math.random() * (burst ? 80 : 35),
      age: 0,
      life: 450 + Math.random() * 650,
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
  function animateSnow(dt) {
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
        `translate(${p.x} ${p.y}) rotate(${p.spin + p.age * 0.04})`,
      );
      p.node.setAttribute("opacity", String(Math.pow(1 - p.age / p.life, 0.7)));
    }
  }
  function update(now) {
    frame = 0;
    if (reduced.matches) {
      settleMotion();
      return;
    }
    if (document.hidden || !inView) return;
    // The idle stance runs at 30fps. Travel and landings use the display rate.
    if (!action && !snow.length && now - lastDraw < 1000 / 30) {
      wake();
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - (previous || now)) / 1000));
    previous = lastDraw = now;
    const blend = 1 - Math.exp(-dt * 11);
    energy += ((action ? 1 : 0) - energy) * blend;
    phase += dt * (1.65 + energy * 5.8);
    let height = 0,
      spin = 0,
      tuck = 0,
      landing = 0;
    if (action) {
      const { profile, from, target, start } = action,
        t = clamp((now - start) / profile.duration),
        eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      position = from + (target - from) * eased;
      const before = pointAt(position - 0.012),
        after = pointAt(position + 0.012),
        heading =
          (after.x - before.x) /
          Math.max(1, Math.hypot(after.x - before.x, after.y - before.y));
      bearing +=
        ((Math.atan2(after.y - before.y, after.x - before.x) * 180) / Math.PI -
          bearing) *
        blend;
      edge += (heading * 0.75 + Math.sin(phase) * 0.25 - edge) * blend;
      if (profile.jump) {
        const flight = clamp((t - 0.18) / 0.58),
          lift = Math.sin(Math.PI * flight);
        height = lift * profile.jump;
        spin = profile.spin * smooth(flight);
        const anticipation =
          t < 0.18 ? Math.sin((t / 0.18) * Math.PI) * 0.4 : 0;
        tuck = lift * 0.9 + anticipation;
        const impact = clamp((t - 0.76) / 0.24);
        landing =
          Math.max(0, Math.sin(impact * Math.PI * 3)) * Math.exp(-impact * 4);
      } else {
        landing = Math.sin(t * Math.PI) * 0.12;
      }
      const point = pose({ height, spin, tuck, landing });
      // Snow comes off a loaded edge or landing, never from skis in mid-air.
      if (height < 2 && t > 0.06 && t < 0.96) {
        action.powder += dt * profile.powder * 1.4;
        while (action.powder >= 1 && snow.length < 140) {
          flake(point, Math.random() > 0.25 ? "#fffdf5" : profile.color);
          action.powder--;
        }
      }
      if (t >= 0.76 && !action.landed && profile.jump) {
        action.landed = true;
        for (let i = 0; i < profile.powder * 0.65 && snow.length < 140; i++)
          flake(
            point,
            i % 3 === 0 ? profile.color : "#fffdf5",
            true,
            lastTier === "krillion" && i % 6 === 0,
          );
      }
      if (t === 1) {
        position = target;
        action = null;
      }
    } else {
      edge += (Math.sin(phase) * 0.14 - edge) * blend;
      pose();
    }
    animateSnow(dt);
    wake();
  }
  function wake() {
    if (reduced.matches) {
      settleMotion();
      return;
    }
    if (!frame && !document.hidden && inView)
      frame = requestAnimationFrame(update);
  }
  function setScore(next, { tier = null, celebrate = false } = {}) {
    if (next === score && !celebrate) return;
    const previousScore = score,
      target = clamp(next / 700);
    clear();
    score = next;
    if (!celebrate) {
      position = target;
      pose();
      wake();
      return;
    }
    const profile = effects[tier] ?? effects.miss;
    lastTier = tier;
    panel.dataset.effect = tier;
    panel.dataset.lastTier = tier;
    showCallout(profile, tier, (next - previousScore) * 10);
    if (reduced.matches) {
      position = target;
      edge = energy = 0;
      pose();
      return;
    }
    action = {
      profile,
      from: position,
      target,
      start: performance.now(),
      powder: 0,
      landed: false,
    };
    wake();
  }
  function reset(next = 0) {
    clear();
    clearTimeout(calloutTimer);
    callout.hidden = true;
    delete panel.dataset.effect;
    delete panel.dataset.lastTier;
    lastTier = "";
    score = next;
    position = clamp(next / 700);
    edge = energy = phase = 0;
    bearing = 25;
    pose();
    wake();
  }
  function suspend() {
    cancelAnimationFrame(frame);
    frame = previous = lastDraw = 0;
  }
  function settleMotion() {
    suspend();
    clear();
    position = clamp(score / 700);
    edge = energy = phase = 0;
    pose();
  }
  reduced.addEventListener("change", () => {
    reduced.matches ? settleMotion() : wake();
  });
  document.addEventListener("visibilitychange", () => {
    document.hidden ? suspend() : wake();
  });
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    inView ? wake() : suspend();
  });
  observer.observe(svg);
  reset();
  return {
    setScore,
    reset,
    get lastTier() {
      return lastTier;
    },
  };
}
