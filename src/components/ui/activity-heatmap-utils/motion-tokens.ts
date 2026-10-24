export const motionTokens = {
  ease: { enter: [0.22, 1, 0.36, 1], standard: [0.2, 0, 0, 1] },
  blur: { soft: 4, subtle: 2 },
  spring: {
    morph: { type: "spring" as const, stiffness: 280, damping: 30 },
    snappy: { type: "spring" as const, stiffness: 400, damping: 35 },
  },
  duration: { fast: 0.18 },
};
