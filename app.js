/**
 * NPS Predictor & Optimizer - Core Application Script
 * Encompasses math utilities, DOM bindings, state management,
 * interactive SVG charts, LocalStorage persistence, and AI advisor engine.
 */

// ==========================================
// 1. MATH UTILITIES & CONSTANTS
// ==========================================

const Mg = {
  equity: { optimistic: 0.14, realistic: 0.10, pessimistic: 0.06 },
  corporateBonds: { optimistic: 0.10, realistic: 0.08, pessimistic: 0.05 },
  governmentBonds: { optimistic: 0.08, realistic: 0.07, pessimistic: 0.05 }
};

const R1 = 0.4;  // Mandatory 40% annuity reinvestment
const EF = 0.06; // Annuity expected return rate (6% p.a.)

// Weighted return calculator
function calcWeightedRate(equityPct, corpBondsPct, govBondsPct, scenario = "realistic") {
  const e = equityPct / 100;
  const c = corpBondsPct / 100;
  const g = govBondsPct / 100;
  return (
    e * Mg.equity[scenario] +
    c * Mg.corporateBonds[scenario] +
    g * Mg.governmentBonds[scenario]
  );
}

// Compound interest calculator
function compoundInterest(currentBalance, monthlyContribution, annualRate, years) {
  const m = annualRate / 12;
  const g = years * 12;
  
  const fvLumpSum = currentBalance * Math.pow(1 + annualRate, years);
  if (annualRate <= 0) {
    return currentBalance + (monthlyContribution * g);
  }
  
  const fvMonthly = monthlyContribution * ((Math.pow(1 + m, g) - 1) / m) * (1 + m);
  return fvLumpSum + fvMonthly;
}

// Split corpus into lump sum and annuity pension
function splitCorpus(corpus) {
  const annuityAmount = corpus * R1;
  const annualPension = annuityAmount * EF;
  const monthlyPension = annualPension / 12;
  const lumpSum = corpus * (1 - R1);
  return { annuityAmount, annualPension, monthlyPension, lumpSum };
}

// Goal planner math: calculates required monthly contribution to hit a target pension
function solveRequiredContribution(targetPension, inputs) {
  const { currentBalance, employerContribution, equityPct, corpBondsPct, govBondsPct, yearsToRetirement } = inputs;
  const requiredCorpus = (targetPension * 12) / EF / R1;
  
  const rate = calcWeightedRate(equityPct, corpBondsPct, govBondsPct, "realistic");
  const m = rate / 12;
  const g = yearsToRetirement * 12;
  
  const fvLumpSum = currentBalance * Math.pow(1 + rate, yearsToRetirement);
  const shortfall = requiredCorpus - fvLumpSum;
  
  if (shortfall <= 0) {
    return { requiredMonthly: 0, requiredCorpus, shortfall: 0 };
  }
  
  const compoundFactor = ((Math.pow(1 + m, g) - 1) / m) * (1 + m);
  const totalRequiredMonthly = shortfall / compoundFactor;
  const requiredMonthly = Math.max(0, totalRequiredMonthly - employerContribution);
  
  return { requiredMonthly, requiredCorpus, shortfall };
}

// Calculate year-by-year projections
function getProjections(inputs) {
  const { currentBalance, monthlyContribution, employerContribution, equityPct, corpBondsPct, govBondsPct, yearsToRetirement, currentAge } = inputs;
  const timeline = [];
  const totalMonthly = monthlyContribution + employerContribution;
  const rate = calcWeightedRate(equityPct, corpBondsPct, govBondsPct, "realistic");
  
  for (let year = 0; year <= yearsToRetirement; year++) {
    const corpus = compoundInterest(currentBalance, totalMonthly, rate, year);
    const { monthlyPension } = splitCorpus(corpus);
    const totalContributed = currentBalance + (totalMonthly * 12 * year);
    timeline.push({ year, age: currentAge + year, corpus, monthlyPension, totalContributed });
  }
  return timeline;
}

// Run Monte Carlo simulation (1,000 trials)
function runMonteCarlo(inputs, trials = 1000) {
  const results = [];
  const totalMonthly = inputs.monthlyContribution + inputs.employerContribution;
  const baseRate = calcWeightedRate(inputs.equityPct, inputs.corpBondsPct, inputs.govBondsPct, "realistic");
  
  for (let n = 0; n < trials; n++) {
    const rateDeviation = (Math.random() - 0.5) * 0.06; // Variation of -3% to +3%
    const trialRate = baseRate + rateDeviation;
    const finalCorpus = compoundInterest(inputs.currentBalance, totalMonthly, trialRate, inputs.yearsToRetirement);
    results.push(finalCorpus);
  }
  
  results.sort((a, b) => a - b);
  return {
    pessimistic: results[Math.floor(trials * 0.05)],
    realistic: results[Math.floor(trials * 0.50)],
    optimistic: results[Math.floor(trials * 0.95)]
  };
}


// ==========================================
// 2. STATE MANAGEMENT & DOM INITIALIZATION
// ==========================================

const state = {
  age: 30,
  retirementAge: 60,
  salary: 50000,
  currentBalance: 0,
  monthlyContribution: 5000,
  employerContribution: 5000,
  targetPension: 50000,
  riskProfile: "moderate", // conservative, moderate, aggressive, custom
  equityPct: 50,
  corpBondsPct: 30,
  govBondsPct: 20
};

let savedPlans = [];

// DOM Elements
const el = {
  ageSlider: document.getElementById("input-age"),
  ageDisplay: document.getElementById("display-age"),
  retireAgeSlider: document.getElementById("input-retire-age"),
  retireAgeDisplay: document.getElementById("display-retire-age"),
  
  salaryInput: document.getElementById("input-salary"),
  balanceInput: document.getElementById("input-balance"),
  monthlyContribInput: document.getElementById("input-monthly-contrib"),
  employerContribInput: document.getElementById("input-employer-contrib"),
  targetPensionInput: document.getElementById("input-target-pension"),
  
  riskConservative: document.getElementById("risk-conservative"),
  riskModerate: document.getElementById("risk-moderate"),
  riskAggressive: document.getElementById("risk-aggressive"),
  
  allocTotalText: document.getElementById("allocation-total"),
  equitySlider: document.getElementById("alloc-equity"),
  equityDisplay: document.getElementById("display-alloc-equity"),
  corpSlider: document.getElementById("alloc-corp"),
  corpDisplay: document.getElementById("display-alloc-corp"),
  govSlider: document.getElementById("alloc-gov"),
  govDisplay: document.getElementById("display-alloc-gov"),
  
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabPanels: document.querySelectorAll(".content-panel"),
  
  // Metrics
  metricCorpus: document.getElementById("metric-corpus"),
  metricPension: document.getElementById("metric-pension"),
  metricLumpSum: document.getElementById("metric-lumpsum"),
  metricAnnuity: document.getElementById("metric-annuity"),
  
  // Charts
  projectionChart: document.getElementById("projection-chart"),
  allocationDonut: document.getElementById("allocation-donut"),
  monteCarloChart: document.getElementById("monte-carlo-chart"),
  chartTooltip: document.getElementById("chart-tooltip"),
  
  // Donut values
  donutEquityVal: document.getElementById("donut-equity-val"),
  donutCorpVal: document.getElementById("donut-corp-val"),
  donutGovVal: document.getElementById("donut-gov-val"),
  
  // Monte Carlo displays
  monteOptimistic: document.getElementById("monte-optimistic"),
  monteRealistic: document.getElementById("monte-realistic"),
  montePessimistic: document.getElementById("monte-pessimistic"),
  
  // Goal Planner
  goalStatusText: document.getElementById("goal-status-text"),
  goalBadge: document.getElementById("goal-badge"),
  goalCurrentPension: document.getElementById("goal-current-pension"),
  goalTargetPension: document.getElementById("goal-target-pension"),
  goalShortfall: document.getElementById("goal-shortfall"),
  goalShortfallCard: document.getElementById("goal-shortfall-card"),
  goalActionBox: document.getElementById("goal-action-box"),
  goalRequiredContrib: document.getElementById("goal-required-contrib"),
  
  // AI Advisor Coach
  coachBubble: document.getElementById("coach-bubble-msg"),
  coachTipsGrid: document.getElementById("coach-tips-grid"),
  
  // Saved Plans
  savedPlansCount: document.getElementById("saved-plans-count"),
  savePlanNameInput: document.getElementById("save-plan-name"),
  savePlanSubmit: document.getElementById("save-plan-submit"),
  quickSaveBtn: document.getElementById("quick-save-btn"),
  plansList: document.getElementById("plans-list")
};

// Formatter functions
function formatCurrency(val) {
  if (val >= 10000000) {
    return "₹" + (val / 10000000).toFixed(2) + " Cr";
  } else if (val >= 100000) {
    return "₹" + (val / 100000).toFixed(2) + " Lk";
  } else {
    return "₹" + Math.round(val).toLocaleString("en-IN");
  }
}

function formatRawCurrency(val) {
  return "₹" + Math.round(val).toLocaleString("en-IN");
}

// Initial Sync
function init() {
  // Load saved plans
  try {
    const plansJson = localStorage.getItem("nps_saved_plans");
    savedPlans = plansJson ? JSON.parse(plansJson) : [];
  } catch (e) {
    savedPlans = [];
  }
  updateSavedPlansCount();

  // Setup Event Listeners
  bindEvents();
  
  // Sync state values to inputs
  syncStateToInputs();
  
  // Calculate and Render
  updateCalculations();
}

// Bind all UI interaction events
function bindEvents() {
  // Tabs switching
  el.tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      
      el.tabBtns.forEach(b => b.classList.remove("active"));
      el.tabPanels.forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");
      
      // Re-render graphs to scale correctly in the newly active container
      updateCalculations();
    });
  });

  // Numeric text inputs
  const inputsList = [
    { el: el.salaryInput, key: "salary" },
    { el: el.balanceInput, key: "currentBalance" },
    { el: el.monthlyContribInput, key: "monthlyContribution" },
    { el: el.employerContribInput, key: "employerContribution" },
    { el: el.targetPensionInput, key: "targetPension" }
  ];

  inputsList.forEach(item => {
    item.el.addEventListener("input", (e) => {
      state[item.key] = parseFloat(e.target.value) || 0;
      updateCalculations();
    });
  });

  // Range inputs (sliders)
  el.ageSlider.addEventListener("input", (e) => {
    state.age = parseInt(e.target.value);
    el.ageDisplay.textContent = state.age + " Yrs";
    
    // Ensure age is always less than retirement age
    if (state.age >= state.retirementAge) {
      state.retirementAge = state.age + 1;
      el.retireAgeSlider.value = state.retirementAge;
      el.retireAgeDisplay.textContent = state.retirementAge + " Yrs";
    }
    
    updateCalculations();
  });

  el.retireAgeSlider.addEventListener("input", (e) => {
    state.retirementAge = parseInt(e.target.value);
    
    // Ensure retirement age is always greater than age
    if (state.retirementAge <= state.age) {
      state.age = state.retirementAge - 1;
      el.ageSlider.value = state.age;
      el.ageDisplay.textContent = state.age + " Yrs";
    }
    
    el.retireAgeDisplay.textContent = state.retirementAge + " Yrs";
    updateCalculations();
  });

  // Risk profile buttons
  const profiles = {
    conservative: { equity: 25, corp: 35, gov: 40 },
    moderate: { equity: 50, corp: 30, gov: 20 },
    aggressive: { equity: 75, corp: 15, gov: 10 }
  };

  [el.riskConservative, el.riskModerate, el.riskAggressive].forEach(btn => {
    btn.addEventListener("click", () => {
      const profile = btn.getAttribute("data-profile");
      setRiskProfile(profile, profiles[profile]);
    });
  });

  // Custom allocation sliders balancer
  el.equitySlider.addEventListener("input", (e) => {
    state.equityPct = parseInt(e.target.value);
    balanceAllocations("equity");
  });

  el.corpSlider.addEventListener("input", (e) => {
    state.corpBondsPct = parseInt(e.target.value);
    balanceAllocations("corp");
  });

  el.govSlider.addEventListener("input", (e) => {
    state.govBondsPct = parseInt(e.target.value);
    balanceAllocations("gov");
  });

  // Saved plan actions
  el.savePlanSubmit.addEventListener("click", saveCurrentPlan);
  el.quickSaveBtn.addEventListener("click", () => {
    // Switch to saved plan tab and focus name input
    const savedTabBtn = document.querySelector('[data-tab="saved"]');
    savedTabBtn.click();
    el.savePlanNameInput.focus();
  });
}

// Sync slider handles and text displays to current State variables
function syncStateToInputs() {
  el.ageSlider.value = state.age;
  el.ageDisplay.textContent = state.age + " Yrs";
  
  el.retireAgeSlider.value = state.retirementAge;
  el.retireAgeDisplay.textContent = state.retirementAge + " Yrs";
  
  el.salaryInput.value = state.salary;
  el.balanceInput.value = state.currentBalance;
  el.monthlyContribInput.value = state.monthlyContribution;
  el.employerContribInput.value = state.employerContribution;
  el.targetPensionInput.value = state.targetPension;
  
  updateAllocationSliders();
  updateRiskProfileButtons();
}

function updateAllocationSliders() {
  el.equitySlider.value = state.equityPct;
  el.equityDisplay.textContent = state.equityPct + "%";
  
  el.corpSlider.value = state.corpBondsPct;
  el.corpDisplay.textContent = state.corpBondsPct + "%";
  
  el.govSlider.value = state.govBondsPct;
  el.govDisplay.textContent = state.govBondsPct + "%";
}

function updateRiskProfileButtons() {
  [el.riskConservative, el.riskModerate, el.riskAggressive].forEach(btn => {
    const profile = btn.getAttribute("data-profile");
    if (state.riskProfile === profile) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function setRiskProfile(profile, allocations) {
  state.riskProfile = profile;
  state.equityPct = allocations.equity;
  state.corpBondsPct = allocations.corp;
  state.govBondsPct = allocations.gov;
  
  updateAllocationSliders();
  updateRiskProfileButtons();
  updateCalculations();
}

/**
 * allocation balancer: guarantees the sum of allocations is always 100%
 * @param {string} changed - Which slider was changed ("equity", "corp", "gov")
 */
function balanceAllocations(changed) {
  state.riskProfile = "custom";
  updateRiskProfileButtons();

  const total = state.equityPct + state.corpBondsPct + state.govBondsPct;
  
  if (total !== 100) {
    const remaining = 100 - state[changed === "equity" ? "equityPct" : changed === "corp" ? "corpBondsPct" : "govBondsPct"];
    
    // Distribute remaining among other two
    if (changed === "equity") {
      const sumOthers = state.corpBondsPct + state.govBondsPct;
      if (sumOthers > 0) {
        state.corpBondsPct = Math.round((state.corpBondsPct / sumOthers) * remaining);
        state.govBondsPct = remaining - state.corpBondsPct;
      } else {
        state.corpBondsPct = Math.round(remaining / 2);
        state.govBondsPct = remaining - state.corpBondsPct;
      }
    } else if (changed === "corp") {
      const sumOthers = state.equityPct + state.govBondsPct;
      if (sumOthers > 0) {
        state.equityPct = Math.round((state.equityPct / sumOthers) * remaining);
        state.govBondsPct = remaining - state.equityPct;
      } else {
        state.equityPct = Math.round(remaining / 2);
        state.govBondsPct = remaining - state.equityPct;
      }
    } else { // gov
      const sumOthers = state.equityPct + state.corpBondsPct;
      if (sumOthers > 0) {
        state.equityPct = Math.round((state.equityPct / sumOthers) * remaining);
        state.corpBondsPct = remaining - state.equityPct;
      } else {
        state.equityPct = Math.round(remaining / 2);
        state.corpBondsPct = remaining - state.equityPct;
      }
    }
  }

  // Constrain limits
  state.equityPct = Math.max(0, Math.min(100, state.equityPct));
  state.corpBondsPct = Math.max(0, Math.min(100, state.corpBondsPct));
  state.govBondsPct = Math.max(0, Math.min(100, state.govBondsPct));

  // Sync to display UI
  updateAllocationSliders();
  updateCalculations();
}


// ==========================================
// 3. CORE CALCULATIONS & GRAPH RENDERING
// ==========================================

function updateCalculations() {
  const sumAllocations = state.equityPct + state.corpBondsPct + state.govBondsPct;
  
  if (sumAllocations !== 100) {
    el.allocTotalText.textContent = `Total: ${sumAllocations}% (Must be 100%)`;
    el.allocTotalText.className = "allocation-total error";
    return;
  } else {
    el.allocTotalText.textContent = "Total: 100%";
    el.allocTotalText.className = "allocation-total success";
  }

  const yearsToRetirement = state.retirementAge - state.age;
  const inputs = {
    currentBalance: state.currentBalance,
    monthlyContribution: state.monthlyContribution,
    employerContribution: state.employerContribution,
    equityPct: state.equityPct,
    corpBondsPct: state.corpBondsPct,
    govBondsPct: state.govBondsPct,
    yearsToRetirement,
    currentAge: state.age
  };

  // 1. Projections
  const rate = calcWeightedRate(state.equityPct, state.corpBondsPct, state.govBondsPct, "realistic");
  const totalMonthly = state.monthlyContribution + state.employerContribution;
  
  const finalCorpus = compoundInterest(state.currentBalance, totalMonthly, rate, yearsToRetirement);
  const metrics = splitCorpus(finalCorpus);

  // Render main metrics
  el.metricCorpus.textContent = formatCurrency(finalCorpus);
  el.metricPension.textContent = formatRawCurrency(metrics.monthlyPension) + " /mo";
  el.metricLumpSum.textContent = formatCurrency(metrics.lumpSum);
  el.metricAnnuity.textContent = formatCurrency(metrics.annuityAmount);

  // Donut values
  el.donutEquityVal.textContent = state.equityPct + "%";
  el.donutCorpVal.textContent = state.corpBondsPct + "%";
  el.donutGovVal.textContent = state.govBondsPct + "%";

  // 2. Timeline calculations
  const timeline = getProjections(inputs);
  
  // Render SVG projection chart
  drawProjectionChart(timeline);

  // Render SVG asset class donut
  drawDonutChart();

  // 3. Monte Carlo Simulation (Run on-demand or tab active)
  const mc = runMonteCarlo(inputs);
  const mcOptimisticSplit = splitCorpus(mc.optimistic);
  const mcRealisticSplit = splitCorpus(mc.realistic);
  const mcPessimisticSplit = splitCorpus(mc.pessimistic);

  el.monteOptimistic.textContent = formatCurrency(mc.optimistic);
  el.monteRealistic.textContent = formatCurrency(mc.realistic);
  el.montePessimistic.textContent = formatCurrency(mc.pessimistic);
  
  drawMonteCarloChart(inputs, mc);

  // 4. Goal Planner
  const goal = solveRequiredContribution(state.targetPension, inputs);
  el.goalCurrentPension.textContent = formatRawCurrency(metrics.monthlyPension) + " /mo";
  el.goalTargetPension.textContent = formatRawCurrency(state.targetPension) + " /mo";
  
  if (metrics.monthlyPension >= state.targetPension) {
    el.goalBadge.textContent = "On Track";
    el.goalBadge.className = "goal-status-badge on-track";
    el.goalStatusText.textContent = "Great news! Your projected NPS corpus will fully cover your target retirement pension.";
    el.goalShortfall.textContent = "₹0 /mo";
    el.goalShortfallCard.style.display = "none";
    el.goalActionBox.style.display = "none";
  } else {
    el.goalBadge.textContent = "Shortfall";
    el.goalBadge.className = "goal-status-badge shortfall";
    el.goalStatusText.textContent = "Your current savings rate is projected to fall short of your retirement monthly pension target.";
    
    const monthlyShortfall = state.targetPension - metrics.monthlyPension;
    el.goalShortfall.textContent = formatRawCurrency(monthlyShortfall) + " /mo";
    el.goalShortfallCard.style.display = "flex";
    
    el.goalActionBox.style.display = "flex";
    el.goalRequiredContrib.textContent = formatRawCurrency(goal.requiredMonthly) + " /mo";
  }

  // 5. AI Advisor Coach recommendations
  renderAiCoachTips(finalCorpus, metrics, goal);
}

// Draw dynamic Year-by-Year SVG accumulation line graph
function drawProjectionChart(timeline) {
  const svg = el.projectionChart;
  svg.innerHTML = ""; // Clear SVG

  const svgWidth = svg.clientWidth || 750;
  const svgHeight = svg.clientHeight || 380;
  
  const margin = { top: 25, right: 30, bottom: 40, left: 75 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  if (timeline.length === 0) return;

  const maxCorpus = Math.max(...timeline.map(d => d.corpus));
  const maxVal = maxCorpus * 1.05; // 5% buffer on top

  // 1. Grid Lines & Axis Labels
  const gridTicks = 5;
  for (let i = 0; i <= gridTicks; i++) {
    const ratio = i / gridTicks;
    const y = margin.top + chartHeight - ratio * chartHeight;
    const val = ratio * maxVal;
    
    // Grid line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", margin.left);
    line.setAttribute("y1", y);
    line.setAttribute("x2", margin.left + chartWidth);
    line.setAttribute("y2", y);
    line.setAttribute("class", "chart-grid-line");
    svg.appendChild(line);

    // Label Text
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", margin.left - 12);
    text.setAttribute("y", y + 4);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("class", "chart-axis-text");
    
    if (val >= 10000000) {
      text.textContent = `₹${(val / 10000000).toFixed(1)} Cr`;
    } else {
      text.textContent = `₹${(val / 100000).toFixed(0)} L`;
    }
    svg.appendChild(text);
  }

  // Draw X Axis Ticks (Age timeline)
  const totalPoints = timeline.length;
  const tickStep = Math.max(1, Math.floor(totalPoints / 6));
  for (let i = 0; i < totalPoints; i += tickStep) {
    const ratio = i / (totalPoints - 1);
    const x = margin.left + ratio * chartWidth;
    
    // Axis Tick label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", margin.top + chartHeight + 22);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "chart-axis-text");
    text.textContent = `Age ${timeline[i].age}`;
    svg.appendChild(text);
  }

  // Draw end-age label explicitly if missed
  if ((totalPoints - 1) % tickStep !== 0) {
    const x = margin.left + chartWidth;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", margin.top + chartHeight + 22);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "chart-axis-text");
    text.textContent = `Age ${timeline[totalPoints - 1].age}`;
    svg.appendChild(text);
  }

  // 2. Gradients Definitions
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  
  const linearGrad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  linearGrad.setAttribute("id", "corpus-gradient");
  linearGrad.setAttribute("x1", "0");
  linearGrad.setAttribute("y1", "0");
  linearGrad.setAttribute("x2", "0");
  linearGrad.setAttribute("y2", "1");

  const stops = [
    { offset: "0%", color: "hsl(var(--primary))", opacity: "0.4" },
    { offset: "100%", color: "hsl(var(--primary))", opacity: "0.0" }
  ];
  stops.forEach(s => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", s.offset);
    stop.setAttribute("stop-color", s.color);
    stop.setAttribute("stop-opacity", s.opacity);
    linearGrad.appendChild(stop);
  });
  defs.appendChild(linearGrad);
  svg.appendChild(defs);

  // 3. Generate Paths Points
  let corpusPoints = "";
  let contributedPoints = "";
  let areaPoints = `M ${margin.left} ${margin.top + chartHeight} `;

  timeline.forEach((pt, idx) => {
    const ratio = idx / (totalPoints - 1);
    const x = margin.left + ratio * chartWidth;
    const yCorpus = margin.top + chartHeight - (pt.corpus / maxVal) * chartHeight;
    const yContrib = margin.top + chartHeight - (pt.totalContributed / maxVal) * chartHeight;
    
    corpusPoints += `${idx === 0 ? "M" : "L"} ${x} ${yCorpus} `;
    contributedPoints += `${idx === 0 ? "M" : "L"} ${x} ${yContrib} `;
    areaPoints += `L ${x} ${yCorpus} `;
  });
  areaPoints += `L ${margin.left + chartWidth} ${margin.top + chartHeight} Z`;

  // Draw Area under Corpus line
  const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  areaPath.setAttribute("d", areaPoints);
  areaPath.setAttribute("class", "chart-area-corpus");
  svg.appendChild(areaPath);

  // Draw Contributed line
  const contribLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  contribLine.setAttribute("d", contributedPoints);
  contribLine.setAttribute("class", "chart-line-contributed");
  svg.appendChild(contribLine);

  // Draw Corpus line
  const corpusLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  corpusLine.setAttribute("d", corpusPoints);
  corpusLine.setAttribute("class", "chart-line-corpus");
  svg.appendChild(corpusLine);

  // 4. Interactive Overlay for Hover Inspections
  const hoverLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hoverLine.setAttribute("y1", margin.top);
  hoverLine.setAttribute("y2", margin.top + chartHeight);
  hoverLine.setAttribute("class", "chart-interactive-line");
  hoverLine.style.display = "none";
  svg.appendChild(hoverLine);

  const hoverDotCorpus = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hoverDotCorpus.setAttribute("class", "chart-interactive-dot");
  hoverDotCorpus.style.display = "none";
  svg.appendChild(hoverDotCorpus);

  // Hover bars triggers
  timeline.forEach((pt, idx) => {
    const ratio = idx / (totalPoints - 1);
    const x = margin.left + ratio * chartWidth;
    
    const barWidth = chartWidth / (totalPoints - 1 || 1);
    const triggerX = x - barWidth / 2;

    const triggerRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    triggerRect.setAttribute("x", triggerX);
    triggerRect.setAttribute("y", margin.top);
    triggerRect.setAttribute("width", barWidth);
    triggerRect.setAttribute("height", chartHeight);
    triggerRect.setAttribute("class", "chart-interactive-bar");
    
    triggerRect.addEventListener("mousemove", (e) => {
      // Calculate dot position
      const yCorpus = margin.top + chartHeight - (pt.corpus / maxVal) * chartHeight;
      
      hoverLine.setAttribute("x1", x);
      hoverLine.setAttribute("x2", x);
      hoverLine.style.display = "block";
      
      hoverDotCorpus.setAttribute("cx", x);
      hoverDotCorpus.setAttribute("cy", yCorpus);
      hoverDotCorpus.style.display = "block";

      // Calculate tooltip position
      const rect = svg.getBoundingClientRect();
      const tooltipX = x + rect.left + window.scrollX + 15;
      const tooltipY = yCorpus + rect.top + window.scrollY - 60;
      
      el.chartTooltip.style.left = tooltipX + "px";
      el.chartTooltip.style.top = tooltipY + "px";
      el.chartTooltip.style.display = "block";
      
      el.chartTooltip.innerHTML = `
        <div class="chart-tooltip-title">Age ${pt.age} (Year ${pt.year})</div>
        <div class="chart-tooltip-item corpus">
          <span>Corpus:</span> <strong>${formatRawCurrency(pt.corpus)}</strong>
        </div>
        <div class="chart-tooltip-item contributed">
          <span>Contributed:</span> <strong>${formatRawCurrency(pt.totalContributed)}</strong>
        </div>
        <div class="chart-tooltip-item" style="color: hsl(var(--secondary)); border-top: 1px solid rgba(255,255,255,0.06); padding-top:0.2rem; margin-top:0.2rem;">
          <span>Pension:</span> <strong>${formatRawCurrency(pt.monthlyPension)}/mo</strong>
        </div>
      `;
    });

    triggerRect.addEventListener("mouseleave", () => {
      hoverLine.style.display = "none";
      hoverDotCorpus.style.display = "none";
      el.chartTooltip.style.display = "none";
    });

    svg.appendChild(triggerRect);
  });
}

// Draw portfolio asset allocation SVG Donut Chart
function drawDonutChart() {
  const svg = el.allocationDonut;
  svg.innerHTML = ""; // Clear SVG
  
  const cx = 70;
  const cy = 70;
  const r = 50;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * r; // 314.159

  // Calculate sector lengths
  const equityStroke = (state.equityPct / 100) * circ;
  const corpStroke = (state.corpBondsPct / 100) * circ;
  const govStroke = (state.govBondsPct / 100) * circ;

  let dashOffset = 0;

  // 1. Draw Equity Segment
  if (state.equityPct > 0) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "hsl(var(--primary-hover))");
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("stroke-dasharray", `${equityStroke} ${circ - equityStroke}`);
    circle.setAttribute("stroke-dashoffset", dashOffset);
    circle.setAttribute("transform", "rotate(-90 70 70)");
    circle.setAttribute("class", "donut-ring");
    svg.appendChild(circle);
    dashOffset -= equityStroke;
  }

  // 2. Draw Corporate Segment
  if (state.corpBondsPct > 0) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "hsl(var(--secondary))");
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("stroke-dasharray", `${corpStroke} ${circ - corpStroke}`);
    circle.setAttribute("stroke-dashoffset", dashOffset);
    circle.setAttribute("transform", "rotate(-90 70 70)");
    circle.setAttribute("class", "donut-ring");
    svg.appendChild(circle);
    dashOffset -= corpStroke;
  }

  // 3. Draw Government Segment
  if (state.govBondsPct > 0) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", r);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "hsl(var(--amber))");
    circle.setAttribute("stroke-width", strokeWidth);
    circle.setAttribute("stroke-dasharray", `${govStroke} ${circ - govStroke}`);
    circle.setAttribute("stroke-dashoffset", dashOffset);
    circle.setAttribute("transform", "rotate(-90 70 70)");
    circle.setAttribute("class", "donut-ring");
    svg.appendChild(circle);
  }

  // 4. Center Label Text
  const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelGroup.setAttribute("text-anchor", "middle");
  
  const labelTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelTitle.setAttribute("x", cx);
  labelTitle.setAttribute("y", cy - 2);
  labelTitle.setAttribute("fill", "hsl(var(--text-muted))");
  labelTitle.setAttribute("font-size", "10px");
  labelTitle.setAttribute("font-family", "var(--font-sans)");
  labelTitle.setAttribute("font-weight", "600");
  labelTitle.textContent = "PORTFOLIO";
  labelGroup.appendChild(labelTitle);

  const labelProfile = document.createElementNS("http://www.w3.org/2000/svg", "text");
  labelProfile.setAttribute("x", cx);
  labelProfile.setAttribute("y", cy + 13);
  labelProfile.setAttribute("fill", "white");
  labelProfile.setAttribute("font-size", "12px");
  labelProfile.setAttribute("font-family", "var(--font-display)");
  labelProfile.setAttribute("font-weight", "800");
  labelProfile.textContent = state.riskProfile.toUpperCase();
  labelGroup.appendChild(labelProfile);
  
  svg.appendChild(labelGroup);
}

// Draw Monte Carlo probability distribution chart
function drawMonteCarloChart(inputs, mc) {
  const svg = el.monteCarloChart;
  svg.innerHTML = ""; // Clear SVG

  const svgWidth = svg.clientWidth || 750;
  const svgHeight = svg.clientHeight || 350;
  
  const margin = { top: 25, right: 30, bottom: 40, left: 75 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const years = inputs.yearsToRetirement;
  
  // Create yearly timelines for all three scenarios
  const timelineOpt = [];
  const timelineReal = [];
  const timelinePess = [];

  const rateOpt = calcWeightedRate(state.equityPct, state.corpBondsPct, state.govBondsPct, "optimistic");
  const rateReal = calcWeightedRate(state.equityPct, state.corpBondsPct, state.govBondsPct, "realistic");
  const ratePess = calcWeightedRate(state.equityPct, state.corpBondsPct, state.govBondsPct, "pessimistic");
  const totalMonthly = inputs.monthlyContribution + inputs.employerContribution;

  for (let yr = 0; yr <= years; yr++) {
    timelineOpt.push(compoundInterest(inputs.currentBalance, totalMonthly, rateOpt, yr));
    timelineReal.push(compoundInterest(inputs.currentBalance, totalMonthly, rateReal, yr));
    timelinePess.push(compoundInterest(inputs.currentBalance, totalMonthly, ratePess, yr));
  }

  const maxVal = mc.optimistic * 1.05;

  // Draw Grid Lines & Labels
  const gridTicks = 5;
  for (let i = 0; i <= gridTicks; i++) {
    const ratio = i / gridTicks;
    const y = margin.top + chartHeight - ratio * chartHeight;
    const val = ratio * maxVal;
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", margin.left);
    line.setAttribute("y1", y);
    line.setAttribute("x2", margin.left + chartWidth);
    line.setAttribute("y2", y);
    line.setAttribute("class", "chart-grid-line");
    svg.appendChild(line);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", margin.left - 12);
    text.setAttribute("y", y + 4);
    text.setAttribute("text-anchor", "end");
    text.setAttribute("class", "chart-axis-text");
    
    if (val >= 10000000) {
      text.textContent = `₹${(val / 10000000).toFixed(1)} Cr`;
    } else {
      text.textContent = `₹${(val / 100000).toFixed(0)} L`;
    }
    svg.appendChild(text);
  }

  // Draw X Ticks
  const step = Math.max(1, Math.floor(years / 6));
  for (let i = 0; i <= years; i += step) {
    const ratio = i / years;
    const x = margin.left + ratio * chartWidth;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", margin.top + chartHeight + 22);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "chart-axis-text");
    text.textContent = `Age ${inputs.currentAge + i}`;
    svg.appendChild(text);
  }

  if (years % step !== 0) {
    const x = margin.left + chartWidth;
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x);
    text.setAttribute("y", margin.top + chartHeight + 22);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "chart-axis-text");
    text.textContent = `Age ${inputs.currentAge + years}`;
    svg.appendChild(text);
  }

  // Gradients Definitions
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const fillGrad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  fillGrad.setAttribute("id", "monte-carlo-gradient");
  fillGrad.setAttribute("x1", "0");
  fillGrad.setAttribute("y1", "0");
  fillGrad.setAttribute("x2", "0");
  fillGrad.setAttribute("y2", "1");
  
  const stops = [
    { offset: "0%", color: "hsl(var(--emerald))", opacity: "0.2" },
    { offset: "100%", color: "hsl(var(--rose))", opacity: "0.05" }
  ];
  stops.forEach(s => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", s.offset);
    stop.setAttribute("stop-color", s.color);
    stop.setAttribute("stop-opacity", s.opacity);
    fillGrad.appendChild(stop);
  });
  defs.appendChild(fillGrad);
  svg.appendChild(defs);

  // Generate paths
  let optPoints = "";
  let realPoints = "";
  let pessPoints = "";
  let bandPoints = `M ${margin.left} ${margin.top + chartHeight} `;

  for (let idx = 0; idx <= years; idx++) {
    const ratio = idx / years;
    const x = margin.left + ratio * chartWidth;
    const yOpt = margin.top + chartHeight - (timelineOpt[idx] / maxVal) * chartHeight;
    const yReal = margin.top + chartHeight - (timelineReal[idx] / maxVal) * chartHeight;
    const yPess = margin.top + chartHeight - (timelinePess[idx] / maxVal) * chartHeight;
    
    optPoints += `${idx === 0 ? "M" : "L"} ${x} ${yOpt} `;
    realPoints += `${idx === 0 ? "M" : "L"} ${x} ${yReal} `;
    pessPoints += `${idx === 0 ? "M" : "L"} ${x} ${yPess} `;
    
    if (idx === 0) {
      bandPoints = `M ${x} ${yPess} `;
    } else {
      bandPoints += `L ${x} ${yPess} `;
    }
  }

  // Draw boundary back for area
  for (let idx = years; idx >= 0; idx--) {
    const ratio = idx / years;
    const x = margin.left + ratio * chartWidth;
    const yOpt = margin.top + chartHeight - (timelineOpt[idx] / maxVal) * chartHeight;
    bandPoints += `L ${x} ${yOpt} `;
  }
  bandPoints += "Z";

  // Render Area Band
  const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  areaPath.setAttribute("d", bandPoints);
  areaPath.setAttribute("class", "chart-area-monte-carlo");
  svg.appendChild(areaPath);

  // Render Pessimistic Line (Rose)
  const pessPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pessPath.setAttribute("d", pessPoints);
  pessPath.setAttribute("class", "chart-line-pessimistic");
  svg.appendChild(pessPath);

  // Render Realistic Line (Indigo)
  const realPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  realPath.setAttribute("d", realPoints);
  realPath.setAttribute("class", "chart-line-corpus");
  svg.appendChild(realPath);

  // Render Optimistic Line (Emerald)
  const optPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  optPath.setAttribute("d", optPoints);
  optPath.setAttribute("class", "chart-line-optimistic");
  svg.appendChild(optPath);
}


// ==========================================
// 4. AI COACH RECOMMENDATIONS ENGINE
// ==========================================

function renderAiCoachTips(corpus, metrics, goal) {
  const tips = [];
  const savingsRate = state.monthlyContribution / (state.salary || 1);
  const employeeContribRatio = state.monthlyContribution / ((state.monthlyContribution + state.employerContribution) || 1);

  // Recommendation 1: Savings rate advice
  if (savingsRate < 0.10) {
    tips.push({
      title: "Boost Personal Contribution Rate",
      desc: `Your personal savings rate is only ${(savingsRate * 100).toFixed(0)}% of your salary. Financial advisors suggest setting aside at least 10%–15% for long-term retirement to optimize compounding.`,
      icon: "arrow-up-circle",
      color: "amber"
    });
  } else {
    tips.push({
      title: "Optimal Savings Rate Maintained",
      desc: `Excellent! You are investing ${(savingsRate * 100).toFixed(0)}% of your monthly salary in your pension. Keeping this level up ensures a strong wealth building pace.`,
      icon: "check-circle",
      color: "emerald"
    });
  }

  // Recommendation 2: Age vs Equity Allocation advice
  if (state.age < 35 && state.equityPct < 60) {
    tips.push({
      title: "Under-allocated to Growth Assets (Equity)",
      desc: `Since you are young (${state.age} yrs), you can tolerate short-term volatility for massive long-term compound growth. Consider shifting allocations to 65%–75% Equity to build a larger corpus.`,
      icon: "trending-up",
      color: "indigo"
    });
  } else if (state.age > 50 && state.equityPct > 45) {
    tips.push({
      title: "High Equity Exposure Risk",
      desc: `As you approach your retirement age (${state.retirementAge} yrs), preserving capital is essential. Reduce your Equity exposure down towards 25%–35% to shield your nest egg from market drops.`,
      icon: "shield-alert",
      color: "rose"
    });
  } else {
    tips.push({
      title: "Balanced Asset Allocation Strategy",
      desc: `Your current Equity allocation of ${state.equityPct}% is well-aligned with your risk profile. This allocation strikes a healthy balance between capital appreciation and risk mitigation.`,
      icon: "sliders",
      color: "emerald"
    });
  }

  // Recommendation 3: Tax Benefit section 80CCD
  tips.push({
    title: "Maximize Additional Section 80CCD(1B) Deductions",
    desc: "NPS is unique in offering an exclusive tax deduction of up to ₹50,000 under Section 80CCD(1B) on your personal contributions. This is over and above the general ₹1.5 Lakh limit under Section 80C.",
    icon: "sparkles",
    color: "indigo"
  });

  // Recommendation 4: Shortfall specific suggestion
  if (metrics.monthlyPension < state.targetPension) {
    const monthlyAdd = Math.round(goal.requiredMonthly);
    tips.push({
      title: "Bridge Your Pension Gap",
      desc: `To meet your desired monthly pension of ${formatRawCurrency(state.targetPension)}, increase your personal monthly NPS contribution by ${formatRawCurrency(monthlyAdd)} immediately.`,
      icon: "info",
      color: "amber"
    });
  }

  // Render to DOM
  el.coachTipsGrid.innerHTML = "";
  tips.forEach(tip => {
    const card = document.createElement("div");
    card.className = "coach-tip-card";
    card.innerHTML = `
      <div class="coach-tip-icon ${tip.color}">
        <i data-lucide="${tip.icon}"></i>
      </div>
      <div>
        <h4 class="coach-tip-title">${tip.title}</h4>
        <p class="coach-tip-desc">${tip.desc}</p>
      </div>
    `;
    el.coachTipsGrid.appendChild(card);
  });

  // Update advisor coach speech bubble message
  if (metrics.monthlyPension >= state.targetPension) {
    el.coachBubble.innerHTML = `Hello! Based on my review, your retirement projection is looking exceptionally strong. You will accumulate <strong>${formatCurrency(corpus)}</strong> by age ${state.retirementAge}, generating a monthly pension of <strong>${formatRawCurrency(metrics.monthlyPension)}</strong> which exceeds your goal. Keep going!`;
  } else {
    const deficit = state.targetPension - metrics.monthlyPension;
    el.coachBubble.innerHTML = `Hello! You have a pension gap of <strong>${formatRawCurrency(deficit)}/mo</strong>. However, by adjusting your monthly contributions slightly upward or optimizing your asset class mix, you can easily get back on track. Take a look at the custom actions below!`;
  }

  // Call lucide trigger to paint new icons
  lucide.createIcons();
}


// ==========================================
// 5. LOCAL STORAGE SAVED PLANS MANAGEMENT
// ==========================================

function updateSavedPlansCount() {
  el.savedPlansCount.textContent = savedPlans.length;
}

function saveCurrentPlan() {
  let name = el.savePlanNameInput.value.trim();
  if (!name) {
    // Generate a default name if blank
    name = `Plan - Age ${state.age} (${state.riskProfile})`;
  }

  const newPlan = {
    id: Date.now().toString(),
    name,
    timestamp: new Date().toLocaleDateString("en-IN", { hour: '2-digit', minute: '2-digit' }),
    data: { ...state }
  };

  savedPlans.push(newPlan);
  localStorage.setItem("nps_saved_plans", JSON.stringify(savedPlans));
  
  el.savePlanNameInput.value = "";
  updateSavedPlansCount();
  renderSavedPlansList();
}

function deletePlan(id) {
  savedPlans = savedPlans.filter(p => p.id !== id);
  localStorage.setItem("nps_saved_plans", JSON.stringify(savedPlans));
  updateSavedPlansCount();
  renderSavedPlansList();
}

function loadPlan(id) {
  const plan = savedPlans.find(p => p.id === id);
  if (!plan) return;

  // Copy values back to state
  Object.assign(state, plan.data);

  // Sync to inputs UI
  syncStateToInputs();
  
  // Calculate
  updateCalculations();

  // Switch to Summary Tab
  const summaryTabBtn = document.querySelector('[data-tab="summary"]');
  summaryTabBtn.click();
}

function renderSavedPlansList() {
  const list = el.plansList;
  list.innerHTML = "";

  if (savedPlans.length === 0) {
    list.innerHTML = `
      <div class="no-plans-msg">
        <i data-lucide="folder-open" style="width: 24px; height: 24px; margin-bottom: 0.5rem; display: block; margin-left:auto; margin-right:auto; color: hsl(var(--text-muted));"></i>
        No saved configurations yet. Enter a name above to store your retirement scenario!
      </div>
    `;
    lucide.createIcons();
    return;
  }

  savedPlans.forEach(plan => {
    const item = document.createElement("div");
    item.className = "plan-item";
    item.innerHTML = `
      <div class="plan-info-main">
        <div class="plan-name-label">${plan.name}</div>
        <div class="plan-metadata">
          <span>Age: ${plan.data.age} → ${plan.data.retirementAge}</span>
          <span>Contrib: ${formatRawCurrency(plan.data.monthlyContribution)}/mo</span>
          <span>Risk: ${plan.data.riskProfile}</span>
          <span>Saved: ${plan.timestamp}</span>
        </div>
      </div>
      <div class="plan-actions">
        <button class="btn-icon load-btn" data-id="${plan.id}" title="Load Plan">
          <i data-lucide="folder-open" style="width:16px; height:16px;"></i>
        </button>
        <button class="btn-icon delete delete-btn" data-id="${plan.id}" title="Delete Plan">
          <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
        </button>
      </div>
    `;
    
    // Bind buttons
    item.querySelector(".load-btn").addEventListener("click", () => loadPlan(plan.id));
    item.querySelector(".delete-btn").addEventListener("click", () => deletePlan(plan.id));
    
    list.appendChild(item);
  });

  lucide.createIcons();
}


// ==========================================
// 6. STARTUP INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  init();
  renderSavedPlansList();
  
  // Resize chart handler to keep charts responsive
  window.addEventListener("resize", () => {
    const activeTab = document.querySelector(".tab-btn.active").getAttribute("data-tab");
    if (activeTab === "summary" || activeTab === "montecarlo") {
      updateCalculations();
    }
  });
});
