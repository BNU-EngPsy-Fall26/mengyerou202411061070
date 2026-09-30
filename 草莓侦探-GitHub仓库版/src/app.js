import {
  TOTAL_ROUNDS,
  OBSERVATION_MS,
  DEFAULT_EXPERIMENT_DPRIME,
  generateExperiment,
  classifyOutcome,
  calculateMetrics,
  calculateLabMetrics,
  clamp,
} from "./core.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  phase: "intro",
  trials: [],
  currentIndex: 0,
  experimentStartedAt: null,
  experimentEndedAt: null,
  remainingMs: OBSERVATION_MS,
  lastTickAt: null,
  timerId: null,
  responseLocked: false,
  targetDPrime: DEFAULT_EXPERIMENT_DPRIME,
};

const labState = { dPrime: 1.5, c: 0, mode: "signal" };
const labPresets = {
  overlap: { dPrime: 0.4, c: 0 },
  easy: { dPrime: 2.5, c: 0 },
  liberal: { dPrime: 1.5, c: -0.8 },
  conservative: { dPrime: 1.5, c: 0.8 },
};

const screens = {
  intro: $("#intro-screen"),
  experiment: $("#experiment-screen"),
  results: $("#results-screen"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, element]) => element.classList.toggle("is-active", key === name));
  screens[name].focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function strawberryMarkup(depth, index) {
  const lightness = 66 - (40 * depth);
  const seedShift = (index % 3) * 2;
  return `<div class="strawberry" data-index="${index}" aria-label="草莓 ${index + 1}，颜色深度 ${depth.toFixed(2)}">
    <svg viewBox="0 0 84 98" aria-hidden="true">
      <path d="M18 23C10 12 22 5 34 17C32 5 45 2 43 18C54 6 67 11 61 23C51 20 30 20 18 23Z" fill="#3e8a5a"/>
      <path d="M12 29C12 14 72 14 72 29C72 61 51 88 42 94C32 87 12 61 12 29Z" fill="hsl(0 75% ${lightness}%)" stroke="rgba(107,29,38,.26)" stroke-width="1.5"/>
      <g fill="#ffd992" opacity=".92">
        <ellipse cx="29" cy="38" rx="1.6" ry="2.5" transform="rotate(-16 29 38)"/>
        <ellipse cx="50" cy="36" rx="1.6" ry="2.5" transform="rotate(14 50 36)"/>
        <ellipse cx="22" cy="53" rx="1.5" ry="2.4" transform="rotate(-15 22 53)"/>
        <ellipse cx="41" cy="53" rx="1.5" ry="2.4"/>
        <ellipse cx="59" cy="52" rx="1.5" ry="2.4" transform="rotate(15 59 52)"/>
        <ellipse cx="32" cy="68" rx="1.4" ry="2.3" transform="rotate(-9 32 68)"/>
        <ellipse cx="50" cy="68" rx="1.4" ry="2.3" transform="rotate(9 50 68)"/>
        <ellipse cx="42" cy="80" rx="1.3" ry="2.2"/>
      </g>
      <path d="M24 ${31 + seedShift}C32 25 52 24 62 31" fill="none" stroke="rgba(255,255,255,.17)" stroke-width="3" stroke-linecap="round"/>
    </svg>
  </div>`;
}

function renderPlate(target, trial) {
  target.innerHTML = trial.strawberries.map((depth, index) => strawberryMarkup(depth, index)).join("");
}

function renderDemo() {
  const trial = { strawberries: [0.36, 0.45, 0.58, 0.38, 0.53, 0.41, 0.72, 0.48, 0.34, 0.61, 0.44, 0.51] };
  renderPlate($("#demo-plate"), trial);
}

function setPhase(phase) {
  state.phase = phase;
  const labels = { observing: "观察中", answering: "等待判断", feedback: "本轮结果" };
  $("#phase-pill").textContent = labels[phase] || "";
  $("#observe-panel").hidden = phase !== "observing";
  $("#answer-panel").hidden = !["answering", "feedback"].includes(phase);
}

function announce(message) {
  $("#live-region").textContent = message;
}

function startExperiment() {
  clearTimer();
  state.trials = generateExperiment(Math.random, state.targetDPrime);
  state.currentIndex = 0;
  state.experimentStartedAt = new Date().toISOString();
  state.experimentEndedAt = null;
  state.responseLocked = false;
  showScreen("experiment");
  beginRound();
  return { status: "started", totalRounds: TOTAL_ROUNDS, observationSeconds: OBSERVATION_MS / 1000, targetDPrime: state.targetDPrime };
}

function renderExperimentDifficulty(value) {
  state.targetDPrime = clamp(Number(value), 0.5, 3);
  $("#experiment-dprime-slider").value = String(state.targetDPrime);
  $("#experiment-dprime-value").textContent = fixed(state.targetDPrime);
  const explanation = state.targetDPrime < 1
    ? "当前为高难度：坏草莓与正常草莓的颜色分布高度重叠。"
    : state.targetDPrime < 2
      ? "当前为较高难度：两类颜色有差异，但仍容易混淆。"
      : state.targetDPrime < 2.75
        ? "当前为中等难度：两类颜色具有较明显的区分度。"
        : "当前为低难度：坏草莓通常更容易从正常草莓中区分出来。";
  $("#difficulty-explanation").textContent = explanation;
}

function beginRound() {
  state.responseLocked = false;
  state.remainingMs = OBSERVATION_MS;
  $("#round-number").textContent = String(state.currentIndex + 1);
  $("#inline-feedback").hidden = true;
  $("#inline-feedback").removeAttribute("data-outcome");
  $$('[data-answer]').forEach((button) => {
    button.disabled = false;
    button.classList.remove("is-selected");
  });
  renderPlate($("#trial-plate"), state.trials[state.currentIndex]);
  setPhase("observing");
  state.lastTickAt = performance.now();
  state.timerId = window.setInterval(tick, 50);
  announce(`第 ${state.currentIndex + 1} 轮开始，请观察八秒。`);
}

function tick() {
  if (document.hidden || state.phase !== "observing") {
    state.lastTickAt = performance.now();
    return;
  }
  const now = performance.now();
  state.remainingMs -= now - state.lastTickAt;
  state.lastTickAt = now;
  if (state.remainingMs <= 0) {
    state.remainingMs = 0;
    clearTimer();
    setPhase("answering");
    $("#answer-panel").querySelector("button").focus();
    announce("观察结束。请判断刚才是否有坏草莓。");
    return;
  }
}

function clearTimer() {
  if (state.timerId !== null) window.clearInterval(state.timerId);
  state.timerId = null;
}

function submitAnswer(userResponse) {
  if (state.phase !== "answering" || state.responseLocked) throw new Error("当前不能提交答案");
  if (typeof userResponse !== "boolean") throw new TypeError("答案必须是布尔值");
  state.responseLocked = true;
  const trial = state.trials[state.currentIndex];
  trial.userResponse = userResponse;
  trial.outcome = classifyOutcome(trial.signalPresent, userResponse);
  renderFeedback(trial);
  setPhase("feedback");
  $("#next-button").focus();
  announce(`本轮结果：${outcomeCopy[trial.outcome].title}。`);
  return { round: trial.round, outcome: trial.outcome, signalPresent: trial.signalPresent };
}

const outcomeCopy = {
  Hit: { title: "击中 Hit", message: "眼力在线！这盘确实藏着坏草莓。" },
  Miss: { title: "漏报 Miss", message: "它悄悄躲过去了——这盘其实有坏草莓。" },
  "False Alarm": { title: "虚报 False Alarm", message: "警报拉早啦！这盘草莓其实都很正常。" },
  "Correct Rejection": { title: "正确拒绝 Correct Rejection", message: "判断漂亮！这盘草莓确实全部正常。" },
};

function renderFeedback(trial) {
  const copy = outcomeCopy[trial.outcome];
  $("#outcome-title").textContent = copy.title;
  $("#outcome-message").textContent = copy.message;
  $("#inline-feedback").dataset.outcome = trial.outcome;
  $("#inline-feedback").hidden = false;
  $$('[data-answer]').forEach((button) => {
    button.disabled = true;
    button.classList.toggle("is-selected", (button.dataset.answer === "true") === trial.userResponse);
  });
  $("#next-button").innerHTML = state.currentIndex === TOTAL_ROUNDS - 1 ? "查看实验结果 <span aria-hidden=\"true\">→</span>" : "下一轮 <span aria-hidden=\"true\">→</span>";
}

function advance() {
  if (state.phase !== "feedback") return;
  if (state.currentIndex < TOTAL_ROUNDS - 1) {
    state.currentIndex += 1;
    beginRound();
    return;
  }
  state.experimentEndedAt = new Date().toISOString();
  renderResults();
  state.phase = "results";
  showScreen("results");
  announce("实验完成，结果分析已生成。");
}

function pct(value) { return `${(value * 100).toFixed(1)}%`; }
function fixed(value) { return value.toFixed(2); }

function renderResults() {
  const metrics = calculateMetrics(state.trials);
  $("#metric-accuracy").textContent = pct(metrics.accuracy);
  $("#metric-hit-rate").textContent = pct(metrics.hitRate);
  $("#metric-fa-rate").textContent = pct(metrics.falseAlarmRate);
  $("#metric-dprime").textContent = fixed(metrics.dPrime);
  $("#metric-miss-rate").textContent = pct(metrics.missRate);
  $("#metric-cr-rate").textContent = pct(metrics.correctRejectionRate);
  $("#metric-c").textContent = fixed(metrics.c);
  $("#count-hit").textContent = metrics.H;
  $("#count-miss").textContent = metrics.M;
  $("#count-fa").textContent = metrics.FA;
  $("#count-cr").textContent = metrics.CR;
  const elapsedSeconds = Math.max(0, Math.round((new Date(state.experimentEndedAt) - new Date(state.experimentStartedAt)) / 1000));
  $("#elapsed-time").textContent = `${Math.floor(elapsedSeconds / 60)} 分 ${elapsedSeconds % 60} 秒`;
  $("#results-summary").textContent = buildSummary(metrics);
  renderInterpretation(metrics);
  renderChart(metrics);
}

function sensitivityText(dPrime) {
  if (dPrime >= 2) return "较清晰";
  if (dPrime >= 1) return "有一定区分度";
  if (dPrime >= 0) return "重叠较明显";
  return "本次样本中未形成稳定区分";
}

function buildSummary(m) {
  const bias = Math.abs(m.c) < 0.2 ? "判断标准较为居中" : m.c > 0 ? "判断相对保守" : "判断相对宽松";
  return `你在 20 轮中答对了 ${m.H + m.CR} 轮。根据击中与虚报的组合，本次对信号和噪声的区分${sensitivityText(m.dPrime)}，${bias}。`;
}

function renderInterpretation(m) {
  const accuracyCopy = `本次答对 ${m.H + m.CR} / 20 轮。正确率同时受区分能力和回答倾向影响，因此不能单独说明敏感性。`;
  let dCopy = `d′ = ${fixed(m.dPrime)}，表示本次数据中对“有信号”和“只有噪声”的区分${sensitivityText(m.dPrime)}。`;
  if (m.hitRate >= .7 && m.falseAlarmRate >= .5) dCopy += " 击中率虽高，虚报率也偏高，这更像是经常回答“有”，不等于敏感性一定很高。";
  if (m.hitRate <= .5 && m.falseAlarmRate <= .3) dCopy += " 击中与虚报都偏低，可能与较保守的判断标准有关。";
  const biasCopy = Math.abs(m.c) < .2
    ? `c = ${fixed(m.c)}，在经典模型下接近居中：本次没有明显偏向“有”或“没有”。`
    : m.c > 0
      ? `c = ${fixed(m.c)}，为正值：本次相对保守，倾向在更确定时才回答“有坏草莓”。`
      : `c = ${fixed(m.c)}，为负值：本次相对宽松，较容易把可疑线索报告为“有坏草莓”。`;
  $("#interpretation").innerHTML = [
    ["01", "先看正确率", accuracyCopy],
    ["02", "再看区分能力", dCopy],
    ["03", "最后看判断倾向", biasCopy],
  ].map(([n, title, text]) => `<div class="interpretation-block"><span>${n}</span><h4>${title}</h4><p>${text}</p></div>`).join("");
}

function renderChart(metrics) {
  const width = 560;
  const height = 260;
  const left = 42;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const xMin = -5;
  const xMax = 5;
  const mapX = (x) => left + ((x - xMin) / (xMax - xMin)) * plotW;
  const mapY = (density) => top + plotH - density * plotH * 2.25;
  const bellPath = (mean) => {
    const pts = Array.from({ length: 100 }, (_, i) => {
      const x = xMin + (i / 99) * (xMax - xMin);
      const y = Math.exp(-0.5 * ((x - mean) ** 2)) / Math.sqrt(2 * Math.PI);
      return `${i ? "L" : "M"}${mapX(x).toFixed(1)},${mapY(y).toFixed(1)}`;
    });
    return pts.join(" ");
  };
  const displayD = metrics.dPrime;
  const criterionX = clamp((displayD / 2) + metrics.c, xMin + .4, xMax - .4);
  const distributionsOverlap = Math.abs(displayD) < .005;
  const signalDash = distributionsOverlap ? "stroke-dasharray=\"8 6\"" : "";
  const distributionLabels = distributionsOverlap
    ? `<text x="${mapX(0)}" y="${top + 50}" text-anchor="middle" fill="#43584a" font-size="11" font-weight="700">噪声与信号（d′ = 0，完全重合）</text>`
    : `<text x="${mapX(0)}" y="${top + 50}" text-anchor="middle" fill="#2e6747" font-size="11">噪声</text>
       <text x="${mapX(displayD)}" y="${top + 50}" text-anchor="middle" fill="#a72a3a" font-size="11">信号</text>`;
  $("#sdt-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="正常草莓与坏草莓的主观可疑程度分布${distributionsOverlap ? "完全重合" : "有重叠"}，判断标准线位于 ${criterionX.toFixed(2)}">
    <line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" stroke="#bdb6ac" />
    <path d="${bellPath(0)}" fill="none" stroke="#397a54" stroke-width="4" stroke-linecap="round"/>
    <path d="${bellPath(displayD)}" fill="none" stroke="#d83c49" stroke-width="4" stroke-linecap="round" ${signalDash}/>
    <line x1="${mapX(criterionX)}" y1="${top + 8}" x2="${mapX(criterionX)}" y2="${top + plotH}" stroke="#e0a82f" stroke-width="3" stroke-dasharray="6 6"/>
    <text x="${mapX(criterionX)}" y="${top}" text-anchor="middle" fill="#8a6519" font-size="12" font-weight="700">c = ${fixed(metrics.c)}</text>
    <text x="${left + plotW / 2}" y="${height - 8}" text-anchor="middle" fill="#6b6f68" font-size="12">主观感知到的可疑程度 →</text>
    ${distributionLabels}
  </svg>`;
}

function density(x, mean) {
  return Math.exp(-0.5 * ((x - mean) ** 2)) / Math.sqrt(2 * Math.PI);
}

function renderLabChart(metrics) {
  const width = 840;
  const height = 390;
  const left = 66;
  const right = 26;
  const top = 34;
  const bottom = 82;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const xMin = -4.2;
  const xMax = 8.2;
  const yMax = 0.43;
  const mapX = (x) => left + ((x - xMin) / (xMax - xMin)) * plotW;
  const mapY = (y) => top + plotH - (y / yMax) * plotH;
  const sample = (mean, start = xMin, end = xMax, count = 180) => Array.from({ length: count }, (_, i) => {
    const x = start + (i / (count - 1)) * (end - start);
    return { x, y: density(x, mean) };
  });
  const linePath = (mean) => sample(mean).map((point, index) => `${index ? "L" : "M"}${mapX(point.x).toFixed(1)},${mapY(point.y).toFixed(1)}`).join(" ");
  const areaPath = (mean, start, end) => {
    const safeStart = clamp(start, xMin, xMax);
    const safeEnd = clamp(end, xMin, xMax);
    if (safeEnd <= safeStart) return "";
    const points = sample(mean, safeStart, safeEnd, 90);
    const curve = points.map((point) => `L${mapX(point.x).toFixed(1)},${mapY(point.y).toFixed(1)}`).join(" ");
    return `M${mapX(safeStart).toFixed(1)},${mapY(0).toFixed(1)} ${curve} L${mapX(safeEnd).toFixed(1)},${mapY(0).toFixed(1)} Z`;
  };
  const criterionX = metrics.criterion;
  const criterionPx = mapX(criterionX);
  const modeIsSignal = labState.mode === "signal";
  const mean = modeIsSignal ? metrics.dPrime : 0;
  const leftColor = modeIsSignal ? "#d79b49" : "#6d9ab0";
  const rightColor = modeIsSignal ? "#5b9c72" : "#c75a68";
  const leftLabel = modeIsSignal ? "漏报" : "正确拒绝";
  const rightLabel = modeIsSignal ? "击中" : "虚报";
  const overlapDash = metrics.dPrime === 0 ? "stroke-dasharray=\"8 6\"" : "";

  $("#lab-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="噪声分布均值为零，信号分布均值为 ${fixed(metrics.dPrime)}，判断标准位于 ${fixed(metrics.criterion)}">
    <defs><clipPath id="lab-plot-clip"><rect x="${left}" y="${top}" width="${plotW}" height="${plotH}"/></clipPath></defs>
    <g clip-path="url(#lab-plot-clip)">
      <path d="${areaPath(mean, xMin, criterionX)}" fill="${leftColor}" fill-opacity=".27"/>
      <path d="${areaPath(mean, criterionX, xMax)}" fill="${rightColor}" fill-opacity=".27"/>
      <path d="${linePath(0)}" fill="none" stroke="#397a54" stroke-width="4" stroke-linecap="round"/>
      <path d="${linePath(metrics.dPrime)}" fill="none" stroke="#d83c49" stroke-width="4" stroke-linecap="round" ${overlapDash}/>
    </g>
    <line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" stroke="#bdb6ac"/>
    <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="#bdb6ac"/>
    <line x1="${criterionPx}" y1="${top}" x2="${criterionPx}" y2="${top + plotH}" stroke="#e0a82f" stroke-width="3" stroke-dasharray="7 6"/>
    <rect x="${clamp(criterionPx - 58, left, width - right - 116)}" y="${top - 26}" width="116" height="23" rx="11.5" fill="#fff2c9"/>
    <text x="${clamp(criterionPx, left + 58, width - right - 58)}" y="${top - 10}" text-anchor="middle" fill="#7a5a16" font-size="12" font-weight="800">criterion ${fixed(metrics.criterion)}</text>
    <text x="${mapX(0)}" y="${mapY(yMax) + 40}" text-anchor="middle" fill="#2e6747" font-size="12" font-weight="800">噪声 μ = 0</text>
    <text x="${mapX(metrics.dPrime)}" y="${mapY(yMax) + 59}" text-anchor="middle" fill="#a72a3a" font-size="12" font-weight="800">信号 μ = ${fixed(metrics.dPrime)}</text>
    <text x="${(left + criterionPx) / 2}" y="${top + plotH + 28}" text-anchor="middle" fill="#556058" font-size="12" font-weight="700">回答：没有坏草莓</text>
    <text x="${(criterionPx + width - right) / 2}" y="${top + plotH + 28}" text-anchor="middle" fill="#556058" font-size="12" font-weight="700">回答：有坏草莓</text>
    <text x="${left + plotW / 2}" y="${height - 10}" text-anchor="middle" fill="#6b6f68" font-size="12">主观感知到的可疑程度</text>
    <text x="18" y="${top + plotH / 2}" text-anchor="middle" fill="#6b6f68" font-size="12" transform="rotate(-90 18 ${top + plotH / 2})">相对概率密度</text>
  </svg>`;
  $("#lab-area-legend").innerHTML = `<i style="background:${leftColor}"></i>${leftLabel}<i style="background:${rightColor};margin-left:8px"></i>${rightLabel}`;
}

function renderLabExplanation(metrics) {
  const dText = metrics.dPrime < 0.5
    ? "两类分布高度重叠，仅凭可疑程度很难区分信号和噪声。"
    : metrics.dPrime < 1.5
      ? "两类分布存在一定差异，但仍有较多重叠。"
      : metrics.dPrime < 2.5
        ? "信号与噪声已经具有较明显的区分度。"
        : "两类分布分离明显，区分信号和噪声相对容易。";
  const cText = metrics.c < -0.2
    ? "当前判断比较宽松：击中率通常更高，但虚报率也会提高。"
    : metrics.c <= 0.2
      ? "当前判断标准接近两条分布的中点。"
      : "当前判断比较保守：虚报率通常更低，但漏报可能增加。";
  $("#lab-dprime-insight").textContent = dText;
  $("#lab-c-insight").textContent = cText;
  const showWarning = metrics.hitRate >= 0.8 && metrics.falseAlarmRate >= 0.5;
  $("#lab-warning").hidden = !showWarning;
  $("#lab-warning").textContent = showWarning ? "高击中率不一定代表高敏感性，也可能是因为判断标准比较宽松。" : "";
}

function renderLab() {
  const metrics = calculateLabMetrics(labState.dPrime, labState.c);
  $("#dprime-slider").value = String(labState.dPrime);
  $("#criterion-slider").value = String(labState.c);
  $("#dprime-value").textContent = fixed(labState.dPrime);
  $("#criterion-value").textContent = fixed(labState.c);
  $("#lab-hit-rate").textContent = pct(metrics.hitRate);
  $("#lab-fa-rate").textContent = pct(metrics.falseAlarmRate);
  $("#lab-miss-rate").textContent = pct(metrics.missRate);
  $("#lab-cr-rate").textContent = pct(metrics.correctRejectionRate);
  $("#lab-accuracy").textContent = pct(metrics.accuracy);
  $("#lab-criterion").textContent = fixed(metrics.criterion);
  $("#lab-beta").textContent = fixed(metrics.beta);
  $$('[data-lab-mode]').forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.labMode === labState.mode)));
  renderLabChart(metrics);
  renderLabExplanation(metrics);
}

function setLabValues(dPrime, c) {
  labState.dPrime = clamp(Number(dPrime), 0, 4);
  labState.c = clamp(Number(c), -2, 2);
  renderLab();
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const tools = [
    {
      name: "start_strawberry_experiment",
      title: "开始草莓侦探实验",
      description: "按开始页当前选择的目标 d′，重置并开始一场 20 轮草莓信号检测实验。每轮仍需等待页面完成 8 秒观察阶段。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => startExperiment(),
    },
    {
      name: "answer_current_strawberry_trial",
      title: "回答当前轮",
      description: "在当前轮观察结束后，提交是否存在坏草莓的判断。",
      inputSchema: { type: "object", properties: { hasBadStrawberry: { type: "boolean" } }, required: ["hasBadStrawberry"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (!input || typeof input.hasBadStrawberry !== "boolean") throw new TypeError("hasBadStrawberry 必须是布尔值");
        return submitAnswer(input.hasBadStrawberry);
      },
    },
  ];
  tools.forEach((tool) => {
    try { void Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch { /* optional browser API */ }
  });
}

$("#start-button").addEventListener("click", startExperiment);
$("#restart-button").addEventListener("click", startExperiment);
$("#experiment-dprime-slider").addEventListener("input", (event) => renderExperimentDifficulty(event.target.value));
$("#next-button").addEventListener("click", advance);
$$('[data-answer]').forEach((button) => button.addEventListener("click", () => submitAnswer(button.dataset.answer === "true")));
$("#dprime-slider").addEventListener("input", (event) => setLabValues(event.target.value, labState.c));
$("#criterion-slider").addEventListener("input", (event) => setLabValues(labState.dPrime, event.target.value));
$("#lab-reset").addEventListener("click", () => setLabValues(1.5, 0));
$$('[data-lab-preset]').forEach((button) => button.addEventListener("click", () => {
  const preset = labPresets[button.dataset.labPreset];
  setLabValues(preset.dPrime, preset.c);
}));
$$('[data-lab-mode]').forEach((button) => button.addEventListener("click", () => {
  labState.mode = button.dataset.labMode;
  renderLab();
}));
document.addEventListener("visibilitychange", () => { if (!document.hidden && state.phase === "observing") state.lastTickAt = performance.now(); });

renderDemo();
renderExperimentDifficulty(DEFAULT_EXPERIMENT_DPRIME);
renderLab();
registerWebMCP();
