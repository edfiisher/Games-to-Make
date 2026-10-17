// The feet stay on the skis while a two-bone rig bends each knee and elbow.
// Coordinates are in the mountain's SVG space; no images or animation library.
const degrees = Math.PI / 180;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const point = (x, y) => ({ x, y });
const xy = (p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
function joint(from, to, upper, lower, bend) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const reach = clamp(
    distance,
    Math.abs(upper - lower) + 0.01,
    upper + lower - 0.01,
  );
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along)) * bend;
  return point(
    from.x + (dx * along - dy * across) / distance,
    from.y + (dy * along + dx * across) / distance,
  );
}

export function createSkier(root) {
  const ids = [
    "ski-back",
    "ski-front",
    "boot-back",
    "boot-front",
    "leg-back-thigh",
    "leg-back-calf",
    "leg-front-thigh",
    "leg-front-calf",
    "arm-back-upper",
    "arm-back-lower",
    "arm-front-upper",
    "arm-front-lower",
    "pole-back",
    "pole-front",
    "basket-back",
    "basket-front",
    "hand-back",
    "hand-front",
    "skier-body",
    "skier-head",
    "skier-goggles",
  ];
  const parts = Object.fromEntries(
    ids.map((id) => [id, root.querySelector(`#${id}`)]),
  );
  const line = (id, from, to) =>
    parts[id].setAttribute("d", `M${xy(from)} ${xy(to)}`);
  const transform = (id, value) => parts[id].setAttribute("transform", value);

  return {
    pose({
      phase = 0,
      edge = 0,
      bearing = 25,
      energy = 0,
      tuck = 0,
      landing = 0,
      airborne = false,
      backwards = false,
      still = false,
    } = {}) {
      const cycle = still ? 0 : Math.sin(phase);
      // Quiet weight changes at rest; deeper outside-leg flexion while carving.
      const bank = edge * (0.18 + energy * 0.82);
      const compression =
        (still ? 0 : (1 - Math.cos(phase * 2)) * 0.6) +
        Math.abs(bank) * 2.5 +
        tuck * 9 +
        landing * 10;
      const hip = point(bank * 11 - 2, -40 + compression);
      const bodyAngle = -bank * 13 - tuck * 8 + landing * 5;
      const radians = bodyAngle * degrees;
      const bodyPoint = (x, y) =>
        point(
          hip.x + x * Math.cos(radians) - y * Math.sin(radians),
          hip.y + x * Math.sin(radians) + y * Math.cos(radians),
        );
      transform(
        "skier-body",
        `translate(${xy(hip)}) rotate(${bodyAngle.toFixed(2)})`,
      );
      transform(
        "skier-head",
        `translate(${(2 - bank * 2).toFixed(2)} -34) rotate(${(bank * 8 + tuck * 5).toFixed(2)})`,
      );
      parts["skier-goggles"].setAttribute("opacity", backwards ? "0" : "1");

      for (const [side, sign] of [
        ["back", -1],
        ["front", 1],
      ]) {
        const skiAngle = bearing + bank * 7 + (airborne ? sign * tuck * 7 : 0);
        const foot = point(
          sign * (12 + Math.abs(bank) * 2),
          sign * 3 + (airborne ? sign * tuck * 3 : 0),
        );
        const skiRadians = skiAngle * degrees;
        const ankle = point(
          foot.x - Math.cos(skiRadians) + 7 * Math.sin(skiRadians),
          foot.y - Math.sin(skiRadians) - 7 * Math.cos(skiRadians),
        );
        const thigh = bodyPoint(sign * 7, 0);
        const knee = joint(thigh, ankle, 22, 23, -1);
        line(`leg-${side}-thigh`, thigh, knee);
        line(`leg-${side}-calf`, knee, ankle);
        const skiTransform = `translate(${xy(foot)}) rotate(${skiAngle.toFixed(2)})`;
        transform(`ski-${side}`, skiTransform);
        transform(`boot-${side}`, skiTransform);

        // Opposite arm leads each turn. The pole tip plants before its release.
        const plant = Math.sin(phase + (sign < 0 ? Math.PI : 0));
        const shoulder = bodyPoint(sign * 11, -25);
        const hand = point(
          shoulder.x + sign * (14 + tuck * 7),
          shoulder.y + 23 + plant * (1 + energy * 5) - tuck * 8,
        );
        const elbow = joint(shoulder, hand, 17, 18, -sign);
        line(`arm-${side}-upper`, shoulder, elbow);
        line(`arm-${side}-lower`, elbow, hand);
        transform(
          `hand-${side}`,
          `translate(${xy(hand)}) rotate(${(sign * 8 - plant * 12).toFixed(2)})`,
        );
        const tip = point(
          hand.x + sign * (10 + tuck * 9) - cycle * energy * 9,
          airborne
            ? hand.y + 32 - tuck * 14
            : 8 + sign * 3 - Math.max(0, plant) * energy * 13,
        );
        line(`pole-${side}`, hand, tip);
        line(
          `basket-${side}`,
          point(tip.x - 3, tip.y - 2),
          point(tip.x + 3, tip.y),
        );
      }
    },
  };
}
