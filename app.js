const bagSizeInput = document.getElementById("bagSize");
const runCountInput = document.getElementById("runCount");
const runOnceButton = document.getElementById("runOnce");
const runManyButton = document.getElementById("runMany");
const resetGraphButton = document.getElementById("resetGraph");
const fairDieButton = document.getElementById("fairDieButton");
const skewedDieButton = document.getElementById("skewedDieButton");
const themeToggleButton = document.getElementById("themeToggle");
const probabilityInputs = [
  document.getElementById("p1"),
  document.getElementById("p2"),
  document.getElementById("p3"),
  document.getElementById("p4"),
  document.getElementById("p5"),
  document.getElementById("p6"),
];
const probabilityNotice = document.getElementById("probabilityNotice");
const diceMeanValue = document.getElementById("diceMeanValue");
const diceStdDevValue = document.getElementById("diceStdDevValue");
const histogramMeanValue = document.getElementById("histogramMeanValue");
const exactMeanValue = document.getElementById("exactMeanValue");
const normalMeanValue = document.getElementById("normalMeanValue");
const histogramStdValue = document.getElementById("histogramStdValue");
const exactStdValue = document.getElementById("exactStdValue");
const normalStdValue = document.getElementById("normalStdValue");
const cltCaption = document.getElementById("cltCaption");
const canvas = document.getElementById("histogram");
const ctx = canvas.getContext("2d");

const state = {
  bagSize: 1,
  runCount: 10,
  totals: [],
};

function getTheme() {
  return document.body.dataset.theme || "dark";
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  const isLight = theme === "light";
  themeToggleButton.textContent = isLight ? "Dark mode" : "Normal mode";
  themeToggleButton.setAttribute("aria-pressed", String(isLight));
  saveThemePreference(theme);
}

function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

function loadThemePreference() {
  try {
    return window.localStorage.getItem("clt-theme");
  } catch {
    return null;
  }
}

function saveThemePreference(theme) {
  try {
    window.localStorage.setItem("clt-theme", theme);
  } catch {
    // Ignore storage failures.
  }
}

function getCanvasPalette() {
  if (getTheme() === "light") {
    return {
      bgTop: "rgba(255,255,255,0.88)",
      bgBottom: "rgba(241,245,249,0.96)",
      axes: "rgba(15,23,42,0.22)",
      text: "rgba(15,23,42,0.92)",
      mutedText: "rgba(71,85,105,0.95)",
      barTop: "rgba(14,165,233,0.95)",
      barBottom: "rgba(59,130,246,0.62)",
      exact: "#fbbf24",
      normal: "#ef4444",
      legendText: "rgba(15,23,42,0.92)",
    };
  }

  return {
    bgTop: "rgba(255,255,255,0.06)",
    bgBottom: "rgba(255,255,255,0.02)",
    axes: "rgba(255,255,255,0.18)",
    text: "rgba(255,255,255,0.8)",
    mutedText: "rgba(166,178,211,0.95)",
    barTop: "rgba(125,211,252,0.95)",
    barBottom: "rgba(59,130,246,0.55)",
    exact: "#fbbf24",
    normal: "#ef4444",
    legendText: "rgba(238,242,255,0.92)",
  };
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampFloat(value, min, fallback) {
  const normalized = String(value).trim().replace(/,/g, ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

function getProbabilityRawValue(input) {
  const raw = input.dataset.rawValue;
  if (raw !== undefined) {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return clampFloat(input.value, 0, 0);
}

function setProbabilityRawValue(input, value) {
  input.dataset.rawValue = String(value);
}

function formatProbabilityValue(value) {
  if (!Number.isFinite(value)) return "0";
  const truncated = Math.trunc(value * 100) / 100;
  return truncated.toFixed(2);
}

function formatProbabilityInputs() {
  probabilityInputs.forEach((input) => {
    const parsed = getProbabilityRawValue(input);
    setProbabilityRawValue(input, parsed);
    input.value = formatProbabilityValue(parsed);
  });
}

function getProbabilities() {
  const raw = probabilityInputs.map((input) => getProbabilityRawValue(input));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return Array(6).fill(1 / 6);
  return raw.map((value) => value / sum);
}

function getProbabilitySum() {
  return probabilityInputs.reduce((sum, input) => sum + getProbabilityRawValue(input), 0);
}

function isProbabilitySumValid() {
  return Math.abs(getProbabilitySum() - 100) <= 0.0001;
}

function updateProbabilityNotice() {
  const sum = getProbabilitySum();
  const valid = isProbabilitySumValid();
  probabilityNotice.textContent = valid
    ? `Probability sum: ${sum.toFixed(6).replace(/\.?0+$/, "")}%`
    : `Probability sum: ${sum.toFixed(6).replace(/\.?0+$/, "")}% - must equal 100%`;
  probabilityNotice.classList.toggle("notice-ok", valid);
  probabilityNotice.classList.toggle("notice-error", !valid);
  runOnceButton.disabled = !valid;
  runManyButton.disabled = !valid;
  renderDiceSdCaption();
}

function renderDiceSdCaption() {
  if (!isProbabilitySumValid()) {
    diceMeanValue.textContent = "-";
    diceStdDevValue.textContent = "-";
    return;
  }

  const probabilities = getProbabilities();
  const stats = computeMeanAndVariance(probabilities);
  const sigma = Math.sqrt(stats.variance);
  diceMeanValue.textContent = formatSd(stats.mean);
  diceStdDevValue.textContent = formatSd(sigma);
}

function sampleFace() {
  const probabilities = getProbabilities();
  const roll = Math.random();
  let cumulative = 0;

  for (let i = 0; i < probabilities.length; i += 1) {
    cumulative += probabilities[i];
    if (roll <= cumulative) {
      return i + 1;
    }
  }

  return 6;
}

function runProcess() {
  let total = 0;

  for (let i = 0; i < state.bagSize; i += 1) {
    total += sampleFace();
  }

  return total;
}

function getExactSumDistribution(probabilities, diceCount) {
  let distribution = [1];

  for (let die = 0; die < diceCount; die += 1) {
    const next = Array.from({ length: distribution.length + 5 }, () => 0);
    for (let sumIndex = 0; sumIndex < distribution.length; sumIndex += 1) {
      const currentProbability = distribution[sumIndex];
      if (currentProbability === 0) continue;
      for (let face = 1; face <= 6; face += 1) {
        next[sumIndex + face - 1] += currentProbability * probabilities[face - 1];
      }
    }
    distribution = next;
  }

  return distribution;
}

function normalPdf(x, mean, stdDev) {
  const z = (x - mean) / stdDev;
  return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
}

function setBagSize(value) {
  const next = clampInt(value, 1, 1000, 1);
  const changed = next !== state.bagSize;
  state.bagSize = next;
  bagSizeInput.value = String(state.bagSize);
  if (changed && state.totals.length > 0) {
    state.totals = [];
  }
  drawHistogram();
}

function setRunCount(value) {
  state.runCount = clampInt(value, 1, 10000, 10);
  runCountInput.value = String(state.runCount);
}

function addOneTotal() {
  if (!isProbabilitySumValid()) return;
  state.totals.push(runProcess());
  drawHistogram();
}

function addManyTotals() {
  if (!isProbabilitySumValid()) return;

  for (let i = 0; i < state.runCount; i += 1) {
    state.totals.push(runProcess());
  }

  drawHistogram();
}

function resetGraph() {
  state.totals = [];
  drawHistogram();
}

function setFairDie() {
  probabilityInputs.forEach((input) => {
    setProbabilityRawValue(input, 100 / 6);
    input.value = formatProbabilityValue(100 / 6);
  });
  if (state.totals.length > 0) {
    state.totals = [];
  }
  updateProbabilityNotice();
  drawHistogram();
}

function setSkewedDie() {
  const skewedProbabilities = [2, 3, 5, 10, 20, 60];
  probabilityInputs.forEach((input, index) => {
    setProbabilityRawValue(input, skewedProbabilities[index]);
    input.value = formatProbabilityValue(skewedProbabilities[index]);
  });
  if (state.totals.length > 0) {
    state.totals = [];
  }
  updateProbabilityNotice();
  drawHistogram();
}

function computeMeanAndVariance(probabilities) {
  const mean = probabilities.reduce((sum, probability, index) => sum + probability * (index + 1), 0);
  const variance = probabilities.reduce((sum, probability, index) => {
    const face = index + 1;
    return sum + probability * (face - mean) ** 2;
  }, 0);
  return { mean, variance };
}

function computeStandardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatSd(value) {
  if (!Number.isFinite(value)) return "0";
  return Number.parseFloat(value.toFixed(4)).toString();
}

function renderCltCaption() {
  cltCaption.innerHTML =
    "<strong>Sampling convergence (blue &rarr; yellow): repeating the experiment many times reveals the expected distribution of the sum.</strong> For a given number D of dice in the bag, the blue histogram approaches the yellow expected distribution as the number of rolls R increases.<br /><br /><strong>Central Limit Theorem (yellow &rarr; red): adding more independent dice makes the expected distribution increasingly bell-shaped.</strong> If the dice are independent and identically distributed (iid), then as the number of dice D increases, the distribution of the total becomes increasingly close to a normal distribution, with mean D &times; μ and standard deviation &radic;D &times; σ, where μ and σ are the mean and standard deviation of a single die.";
}

function drawAxes(width, height, padding) {
  const palette = getCanvasPalette();
  ctx.save();
  ctx.strokeStyle = palette.axes;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();
  ctx.restore();
}

function formatTickValue(value) {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return value.toLocaleString();
}

function drawHistogram() {
  const width = canvas.width;
  const height = canvas.height;
  const padding = 64;
  const palette = getCanvasPalette();
  const probabilitiesValid = isProbabilitySumValid();
  const probabilities = probabilitiesValid ? getProbabilities() : null;
  const faceStats = probabilities ? computeMeanAndVariance(probabilities) : null;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  drawAxes(width, height, padding);

  if (state.totals.length === 0) {
    if (faceStats) {
      const mean = state.bagSize * faceStats.mean;
      const standardDeviation = Math.sqrt(state.bagSize * faceStats.variance);
      histogramMeanValue.textContent = "-";
      exactMeanValue.textContent = formatSd(mean);
      normalMeanValue.textContent = formatSd(mean);
      histogramStdValue.textContent = "-";
      exactStdValue.textContent = formatSd(standardDeviation);
      normalStdValue.textContent = formatSd(standardDeviation);
    } else {
      histogramMeanValue.textContent = "-";
      exactMeanValue.textContent = "-";
      normalMeanValue.textContent = "-";
      histogramStdValue.textContent = "-";
      exactStdValue.textContent = "-";
      normalStdValue.textContent = "-";
    }
    ctx.fillStyle = palette.text;
    ctx.font = '600 28px "Trebuchet MS", sans-serif';
    ctx.fillText("No totals yet", padding, height / 2 - 8);
    ctx.fillStyle = palette.mutedText;
    ctx.font = '400 18px "Trebuchet MS", sans-serif';
    ctx.fillText("Use Run once or Run R times to populate the histogram.", padding, height / 2 + 24);
    renderDiceSdCaption();
    renderCltCaption();
    return;
  }

  const s = state.bagSize;
  const minTotal = s;
  const maxTotal = s * 6;
  const binCount = maxTotal - minTotal + 1;
  const bins = Array.from({ length: binCount }, () => 0);

  for (const total of state.totals) {
    if (total >= minTotal && total <= maxTotal) {
      bins[total - minTotal] += 1;
    }
  }

  const maxCount = Math.max(1, ...bins);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const barWidth = plotWidth / binCount;
  const exactDistribution = getExactSumDistribution(probabilities, s);
  const mean = s * faceStats.mean;
  const histogramMean = state.totals.reduce((sum, total) => sum + total, 0) / state.totals.length;
  const exactVariance = exactDistribution.reduce((sum, probability, index) => {
    const total = minTotal + index;
    return sum + probability * (total - mean) ** 2;
  }, 0);
  const exactStdDev = Math.sqrt(exactVariance);
  const normalStdDev = Math.sqrt(s * faceStats.variance);
  const histogramStdDev = computeStandardDeviation(state.totals);
  const exactMaxCount = exactDistribution.reduce((max, probability) => Math.max(max, probability * state.totals.length), 0);
  const normalMaxCount = normalStdDev > 0
    ? normalPdf(mean, mean, normalStdDev) * state.totals.length
    : 0;
  const scaleCount = Math.max(maxCount, exactMaxCount, normalMaxCount);

  for (let i = 0; i < bins.length; i += 1) {
    const count = bins[i];
    const barHeight = (count / scaleCount) * (plotHeight - 34);
    const x = padding + i * barWidth + 1;
    const y = height - padding - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
    gradient.addColorStop(0, palette.barTop);
    gradient.addColorStop(1, palette.barBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, Math.max(1, barWidth - 2), barHeight);
  }

  ctx.save();
  ctx.font = '400 13px "Trebuchet MS", sans-serif';
  const maxTickLabelWidth = ctx.measureText(formatTickValue(maxTotal)).width;
  const tickStep = Math.max(1, Math.ceil((maxTickLabelWidth + 20) / barWidth));
  const tickY = height - padding;
  ctx.strokeStyle = palette.axes;
  ctx.fillStyle = palette.mutedText;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < binCount; i += tickStep) {
    const value = minTotal + i;
    const x = padding + (i + 0.5) * barWidth;
    ctx.beginPath();
    ctx.moveTo(x, tickY);
    ctx.lineTo(x, tickY + 6);
    ctx.stroke();
    ctx.fillText(formatTickValue(value), x, tickY + 10);
  }

  const lastIndex = binCount - 1;
  if ((lastIndex % tickStep) !== 0) {
    const x = padding + (lastIndex + 0.5) * barWidth;
    ctx.beginPath();
    ctx.moveTo(x, tickY);
    ctx.lineTo(x, tickY + 6);
    ctx.stroke();
    ctx.fillText(formatTickValue(maxTotal), x, tickY + 10);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = palette.exact;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < binCount; i += 1) {
    const pmf = exactDistribution[i] || 0;
    const yCount = pmf * state.totals.length;
    const y = height - padding - (yCount / scaleCount) * (plotHeight - 34);
    const xLeft = padding + i * barWidth;
    const xRight = padding + (i + 1) * barWidth;

    if (i === 0) {
      ctx.moveTo(xLeft, y);
    } else {
      ctx.lineTo(xLeft, y);
    }
    ctx.lineTo(xRight, y);
  }
  ctx.stroke();
  ctx.restore();

  if (normalStdDev > 0) {
    ctx.save();
    ctx.strokeStyle = palette.normal;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let total = minTotal; total <= maxTotal; total += 0.1) {
      const yCount = normalPdf(total, mean, normalStdDev) * state.totals.length;
      const x = padding + ((total - minTotal) / (maxTotal - minTotal)) * plotWidth;
      const y = height - padding - (yCount / scaleCount) * (plotHeight - 34);
      if (total === minTotal) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = palette.text;
  ctx.font = '600 18px "Trebuchet MS", sans-serif';
  ctx.fillText(`D = ${s}, R = ${state.totals.length}`, padding, 30);
  ctx.fillStyle = palette.mutedText;
  ctx.font = '400 15px "Trebuchet MS", sans-serif';
  ctx.fillText(`Each bar is a total from D dice, counted across R runs.`, padding, 52);
  ctx.restore();

  ctx.save();
  const legend = [
    ["Histogram", palette.barTop],
    ["Expected distribution", palette.exact],
    ["Normal approximation", palette.normal],
  ];
  ctx.font = '600 14px "Trebuchet MS", sans-serif';
  const legendX = width - padding - 280;
  const legendY = 34;
  legend.forEach(([label, color], index) => {
    const y = legendY + index * 24;
    ctx.fillStyle = color;
    ctx.fillRect(legendX, y - 9, 18, 4);
    ctx.fillStyle = palette.legendText;
    ctx.fillText(label, legendX + 28, y - 1);
  });
  ctx.restore();

  renderDiceSdCaption();
  histogramMeanValue.textContent = formatSd(histogramMean);
  exactMeanValue.textContent = formatSd(mean);
  normalMeanValue.textContent = formatSd(mean);
  histogramStdValue.textContent = formatSd(histogramStdDev);
  exactStdValue.textContent = formatSd(exactStdDev);
  normalStdValue.textContent = formatSd(normalStdDev);
  renderCltCaption();
}

runOnceButton.addEventListener("click", addOneTotal);
runManyButton.addEventListener("click", addManyTotals);
resetGraphButton.addEventListener("click", resetGraph);
fairDieButton.addEventListener("click", setFairDie);
skewedDieButton.addEventListener("click", setSkewedDie);
themeToggleButton.addEventListener("click", toggleTheme);

bagSizeInput.addEventListener("change", () => {
  setBagSize(bagSizeInput.value);
});

runCountInput.addEventListener("change", () => {
  setRunCount(runCountInput.value);
});

probabilityInputs.forEach((input) => {
  input.addEventListener("input", () => {
    setProbabilityRawValue(input, clampFloat(input.value, 0, 0));
    updateProbabilityNotice();
    if (state.totals.length > 0) {
      state.totals = [];
    }
    drawHistogram();
  });
  input.addEventListener("blur", () => {
    const parsed = clampFloat(input.value, 0, 0);
    setProbabilityRawValue(input, parsed);
    input.value = formatProbabilityValue(parsed);
    updateProbabilityNotice();
    drawHistogram();
  });
});

setBagSize(state.bagSize);
setRunCount(state.runCount);
probabilityInputs.forEach((input) => {
  setProbabilityRawValue(input, clampFloat(input.value, 0, 0));
});
updateProbabilityNotice();
setTheme(loadThemePreference() || "dark");
formatProbabilityInputs();
drawHistogram();
