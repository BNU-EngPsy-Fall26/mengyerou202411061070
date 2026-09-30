import assert from "node:assert/strict";
import {
  TOTAL_ROUNDS,
  SIGNAL_ROUNDS,
  OBSERVATION_MS,
  DEFAULT_EXPERIMENT_DPRIME,
  signalStrawberryMean,
  targetBadIsDarkestProbability,
  generateExperiment,
  classifyOutcome,
  calculateMetrics,
  normalCDF,
  calculateLabMetrics,
} from "./src/core.js";

const almostEqual = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be close to ${expected}`);

assert.equal(TOTAL_ROUNDS, 20);
assert.equal(SIGNAL_ROUNDS, 10);
assert.equal(OBSERVATION_MS, 8_000);
assert.equal(DEFAULT_EXPERIMENT_DPRIME, 2);

for (let i = 0; i < 250; i += 1) {
  const trials = generateExperiment();
  assert.equal(trials.length, 20);
  assert.equal(trials.filter((t) => t.signalPresent).length, 10);
  assert.equal(trials.filter((t) => !t.signalPresent).length, 10);
  trials.forEach((trial) => {
    assert.equal(trial.strawberries.length, 12);
    assert.ok(trial.strawberries.every((x) => x >= 0 && x <= 1));
    assert.equal(trial.signalPresent, trial.badIndex !== null);
  });
}

almostEqual(signalStrawberryMean(0.5), 0.48);
almostEqual(signalStrawberryMean(2), 0.66);
almostEqual(signalStrawberryMean(3), 0.78);
assert.ok(signalStrawberryMean(0.5) < signalStrawberryMean(3));
almostEqual(targetBadIsDarkestProbability(0.5), 0.30);
almostEqual(targetBadIsDarkestProbability(1.5), 0.65);
almostEqual(targetBadIsDarkestProbability(2.5), 0.93);
almostEqual(targetBadIsDarkestProbability(3), 0.97);

for (const targetDPrime of [0.5, 1.5, 3]) {
  const trials = generateExperiment(Math.random, targetDPrime);
  assert.equal(trials.filter((t) => t.signalPresent).length, 10);
  assert.ok(trials.every((t) => t.targetDPrime === targetDPrime));
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

for (const targetDPrime of [0.5, 1.5, 2.5, 3]) {
  const random = seededRandom(20260930 + targetDPrime * 100);
  let signalTrials = 0;
  let badIsDarkest = 0;
  for (let experiment = 0; experiment < 1000; experiment += 1) {
    for (const trial of generateExperiment(random, targetDPrime)) {
      if (!trial.signalPresent) continue;
      signalTrials += 1;
      const badDepth = trial.strawberries[trial.badIndex];
      const deepestNormal = Math.max(...trial.strawberries.filter((_, index) => index !== trial.badIndex));
      if (badDepth > deepestNormal) badIsDarkest += 1;
    }
  }
  almostEqual(badIsDarkest / signalTrials, targetBadIsDarkestProbability(targetDPrime), 0.02);
}

assert.equal(classifyOutcome(true, true), "Hit");
assert.equal(classifyOutcome(true, false), "Miss");
assert.equal(classifyOutcome(false, true), "False Alarm");
assert.equal(classifyOutcome(false, false), "Correct Rejection");

const extremesAllCorrect = [
  ...Array.from({ length: 10 }, (_, i) => ({ round: i + 1, outcome: "Hit" })),
  ...Array.from({ length: 10 }, (_, i) => ({ round: i + 11, outcome: "Correct Rejection" })),
];
const perfect = calculateMetrics(extremesAllCorrect);
assert.equal(perfect.accuracy, 1);
assert.equal(perfect.hitRate, 1);
assert.equal(perfect.falseAlarmRate, 0);
assert.ok(Number.isFinite(perfect.dPrime));
assert.ok(Number.isFinite(perfect.c));

const balanced = [
  ...Array(6).fill({ outcome: "Hit" }),
  ...Array(4).fill({ outcome: "Miss" }),
  ...Array(2).fill({ outcome: "False Alarm" }),
  ...Array(8).fill({ outcome: "Correct Rejection" }),
];
const metrics = calculateMetrics(balanced);
assert.equal(metrics.H + metrics.M + metrics.FA + metrics.CR, 20);
assert.equal(metrics.accuracy, 14 / 20);
assert.equal(metrics.hitRate, 6 / 10);
assert.equal(metrics.falseAlarmRate, 2 / 10);

almostEqual(normalCDF(0), 0.5, 1e-8);

const labOrigin = calculateLabMetrics(0, 0);
almostEqual(labOrigin.hitRate, 0.5, 1e-8);
almostEqual(labOrigin.falseAlarmRate, 0.5, 1e-8);

const labSeparated = calculateLabMetrics(2, 0);
assert.ok(labSeparated.hitRate > labOrigin.hitRate);
assert.ok(labSeparated.falseAlarmRate < labOrigin.falseAlarmRate);

const labLiberal = calculateLabMetrics(1.5, -0.8);
const labConservative = calculateLabMetrics(1.5, 0.8);
assert.ok(labConservative.hitRate < labLiberal.hitRate);
assert.ok(labConservative.falseAlarmRate < labLiberal.falseAlarmRate);

for (let dPrime = 0; dPrime <= 4; dPrime += 0.25) {
  for (let c = -2; c <= 2; c += 0.25) {
    const lab = calculateLabMetrics(dPrime, c);
    [lab.hitRate, lab.falseAlarmRate, lab.missRate, lab.correctRejectionRate, lab.accuracy].forEach((rate) => assert.ok(rate >= 0 && rate <= 1));
    almostEqual(lab.hitRate + lab.missRate, 1);
    almostEqual(lab.falseAlarmRate + lab.correctRejectionRate, 1);
  }
}
console.log("Core tests passed");
