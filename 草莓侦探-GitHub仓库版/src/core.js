export const TOTAL_ROUNDS = 20;
export const SIGNAL_ROUNDS = 10;
export const OBSERVATION_MS = 8_000;
export const EXPERIMENT_DPRIME_MIN = 0.5;
export const EXPERIMENT_DPRIME_MAX = 3;
export const DEFAULT_EXPERIMENT_DPRIME = 2;
export const NORMAL_STRAWBERRY_MEAN = 0.42;
export const STIMULUS_SD = 0.12;

const DARKEST_PROBABILITY_POINTS = [
  [0.5, 0.30],
  [1.5, 0.65],
  [2.5, 0.93],
  [3.0, 0.97],
];

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function normalRandom(mean, sd, random = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return clamp(mean + sd * z);
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function signalStrawberryMean(targetDPrime = DEFAULT_EXPERIMENT_DPRIME) {
  if (!Number.isFinite(targetDPrime)) throw new TypeError("targetDPrime must be a finite number");
  const safeDPrime = clamp(targetDPrime, EXPERIMENT_DPRIME_MIN, EXPERIMENT_DPRIME_MAX);
  return NORMAL_STRAWBERRY_MEAN + safeDPrime * STIMULUS_SD;
}

export function targetBadIsDarkestProbability(targetDPrime = DEFAULT_EXPERIMENT_DPRIME) {
  if (!Number.isFinite(targetDPrime)) throw new TypeError("targetDPrime must be a finite number");
  const safeDPrime = clamp(targetDPrime, EXPERIMENT_DPRIME_MIN, EXPERIMENT_DPRIME_MAX);
  for (let index = 1; index < DARKEST_PROBABILITY_POINTS.length; index += 1) {
    const [rightDPrime, rightProbability] = DARKEST_PROBABILITY_POINTS[index];
    const [leftDPrime, leftProbability] = DARKEST_PROBABILITY_POINTS[index - 1];
    if (safeDPrime <= rightDPrime) {
      const progress = (safeDPrime - leftDPrime) / (rightDPrime - leftDPrime);
      return leftProbability + progress * (rightProbability - leftProbability);
    }
  }
  return DARKEST_PROBABILITY_POINTS.at(-1)[1];
}

export function generateExperiment(random = Math.random, targetDPrime = DEFAULT_EXPERIMENT_DPRIME) {
  const safeDPrime = clamp(targetDPrime, EXPERIMENT_DPRIME_MIN, EXPERIMENT_DPRIME_MAX);
  const signalMean = signalStrawberryMean(safeDPrime);
  const darkestProbability = targetBadIsDarkestProbability(safeDPrime);
  const darkestMargin = 0.025 + ((safeDPrime - EXPERIMENT_DPRIME_MIN) / (EXPERIMENT_DPRIME_MAX - EXPERIMENT_DPRIME_MIN)) * 0.095;
  const schedule = shuffle([
    ...Array(SIGNAL_ROUNDS).fill(true),
    ...Array(TOTAL_ROUNDS - SIGNAL_ROUNDS).fill(false),
  ], random);

  return schedule.map((signalPresent, index) => {
    const badIndex = signalPresent ? Math.floor(random() * 12) : null;
    const strawberries = Array.from({ length: 12 }, () => normalRandom(NORMAL_STRAWBERRY_MEAN, STIMULUS_SD, random));
    if (signalPresent) {
      const maxNormalDepth = Math.max(...strawberries.filter((_, strawberryIndex) => strawberryIndex !== badIndex));
      const sampledBadDepth = normalRandom(signalMean, STIMULUS_SD, random);
      const shouldBeDarkest = random() < darkestProbability;
      strawberries[badIndex] = shouldBeDarkest
        ? clamp(Math.max(sampledBadDepth, maxNormalDepth + darkestMargin))
        : clamp(Math.min(sampledBadDepth, maxNormalDepth - 0.012));
    }
    return {
      round: index + 1,
      signalPresent,
      targetDPrime: safeDPrime,
      strawberries,
      badIndex,
      userResponse: null,
      outcome: null,
    };
  });
}

export function classifyOutcome(signalPresent, userResponse) {
  if (signalPresent && userResponse) return "Hit";
  if (signalPresent && !userResponse) return "Miss";
  if (!signalPresent && userResponse) return "False Alarm";
  return "Correct Rejection";
}

export function inverseNormalCDF(p) {
  if (p <= 0 || p >= 1) throw new RangeError("p must be between 0 and 1");
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425;
  const high = 1 - low;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > high) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function normalCDF(x) {
  if (!Number.isFinite(x)) return x === Infinity ? 1 : x === -Infinity ? 0 : NaN;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * z);
  const coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const polynomial = (((((coefficients[4] * t + coefficients[3]) * t) + coefficients[2]) * t + coefficients[1]) * t + coefficients[0]) * t;
  const erf = sign * (1 - polynomial * Math.exp(-(z ** 2)));
  return clamp(0.5 * (1 + erf));
}

export function calculateLabMetrics(dPrime, c) {
  if (!Number.isFinite(dPrime) || !Number.isFinite(c)) throw new TypeError("dPrime and c must be finite numbers");
  const criterion = c + dPrime / 2;
  const hitRate = normalCDF(dPrime / 2 - c);
  const falseAlarmRate = normalCDF(-dPrime / 2 - c);
  const missRate = 1 - hitRate;
  const correctRejectionRate = 1 - falseAlarmRate;
  return {
    dPrime,
    c,
    criterion,
    hitRate,
    falseAlarmRate,
    missRate,
    correctRejectionRate,
    accuracy: 0.5 * (hitRate + correctRejectionRate),
    beta: Math.exp(dPrime * c),
  };
}

export function calculateMetrics(records) {
  const H = records.filter((r) => r.outcome === "Hit").length;
  const M = records.filter((r) => r.outcome === "Miss").length;
  const FA = records.filter((r) => r.outcome === "False Alarm").length;
  const CR = records.filter((r) => r.outcome === "Correct Rejection").length;
  const signalTotal = H + M;
  const noiseTotal = FA + CR;
  const accuracy = (H + CR) / records.length;
  const hitRate = H / signalTotal;
  const missRate = M / signalTotal;
  const falseAlarmRate = FA / noiseTotal;
  const correctRejectionRate = CR / noiseTotal;
  const correctedHR = (H + 0.5) / (signalTotal + 1);
  const correctedFAR = (FA + 0.5) / (noiseTotal + 1);
  const zHR = inverseNormalCDF(correctedHR);
  const zFAR = inverseNormalCDF(correctedFAR);
  return {
    H, M, FA, CR,
    accuracy, hitRate, missRate, falseAlarmRate, correctRejectionRate,
    correctedHR, correctedFAR,
    dPrime: zHR - zFAR,
    c: -0.5 * (zHR + zFAR),
  };
}
