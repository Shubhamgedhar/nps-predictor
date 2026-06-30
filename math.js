/**
 * NPS Predictor Math Engine
 * Contains all interest compounding, asset allocation weighting,
 * annuity calculations, Monte Carlo simulations, and target solvers.
 */

// Asset Return Rates (Optimistic, Realistic, Pessimistic)
export const Mg = {
  equity: {
    optimistic: 0.14,
    realistic: 0.10,
    pessimistic: 0.06
  },
  corporateBonds: {
    optimistic: 0.10,
    realistic: 0.08,
    pessimistic: 0.05
  },
  governmentBonds: {
    optimistic: 0.08,
    realistic: 0.07,
    pessimistic: 0.05
  }
};

// Global Constants
export const R1 = 0.4;  // Minimum 40% annuity requirement
export const EF = 0.06; // Annuity yield (6% rate)

/**
 * Calculates weighted average return rate based on asset allocation
 * @param {number} equityPct 
 * @param {number} corpBondsPct 
 * @param {number} govBondsPct 
 * @param {string} scenario ("realistic", "optimistic", "pessimistic")
 * @returns {number} Weighted return rate
 */
export const Am = (equityPct, corpBondsPct, govBondsPct, scenario = "realistic") => {
  const e = equityPct / 100;
  const c = corpBondsPct / 100;
  const g = govBondsPct / 100;
  
  return (
    e * Mg.equity[scenario] +
    c * Mg.corporateBonds[scenario] +
    g * Mg.governmentBonds[scenario]
  );
};

/**
 * Compounding Interest Formula (Future Value)
 * Handles both initial lump sum compound and monthly annuity payments.
 * @param {number} currentBalance (PV)
 * @param {number} monthlyContribution (PMT)
 * @param {number} annualRate (r)
 * @param {number} years (t)
 * @returns {number} Future Value (FV)
 */
export const cP = (currentBalance, monthlyContribution, annualRate, years) => {
  const m = annualRate / 12;
  const g = years * 12;
  
  // Future Value of Current Balance
  const fvLumpSum = currentBalance * Math.pow(1 + annualRate, years);
  
  if (annualRate <= 0) {
    return currentBalance + (monthlyContribution * g);
  }
  
  // Future Value of Monthly Contributions (Ordinary Annuity compounded monthly)
  // Formula: PMT * [((1 + m)^g - 1) / m] * (1 + m) (since contributions are at the start/during the month)
  const fvMonthly = monthlyContribution * ((Math.pow(1 + m, g) - 1) / m) * (1 + m);
  
  return fvLumpSum + fvMonthly;
};

/**
 * Calculates annuity pension distribution and lump sum payout from total corpus
 * @param {number} corpus 
 * @returns {object} { annuityAmount, monthlyPension, annualPension, lumpSum }
 */
export const Ni = (corpus) => {
  const annuityAmount = corpus * R1;
  const annualPension = annuityAmount * EF;
  const monthlyPension = annualPension / 12;
  const lumpSum = corpus * (1 - R1);
  
  return {
    annuityAmount,
    annualPension,
    monthlyPension,
    lumpSum
  };
};

/**
 * Solves for required monthly contribution to hit a target monthly pension
 * @param {number} targetPension 
 * @param {object} inputs 
 * @returns {object} { requiredMonthly, requiredCorpus, shortfall }
 */
export const TF = (targetPension, inputs) => {
  const {
    currentBalance = 0,
    employerContribution = 0,
    equityPct,
    corpBondsPct,
    govBondsPct,
    yearsToRetirement
  } = inputs;

  // targetPension is monthly. Required corpus 'd' to yield this pension is:
  // monthlyPension = (corpus * R1 * EF) / 12 => corpus = monthlyPension * 12 / EF / R1
  const requiredCorpus = (targetPension * 12) / EF / R1;
  
  const h = Am(equityPct, corpBondsPct, govBondsPct, "realistic");
  const m = h / 12;
  const g = yearsToRetirement * 12;
  
  // Growth of current balance
  const fvLumpSum = currentBalance * Math.pow(1 + h, yearsToRetirement);
  const shortfall = requiredCorpus - fvLumpSum;
  
  if (shortfall <= 0) {
    return {
      requiredMonthly: 0,
      requiredCorpus,
      shortfall: 0
    };
  }

  // Back-calculate PMT (v) needed to accumulate the shortfall
  // shortfall = v * [((1+m)^g - 1)/m] * (1+m)
  const compoundFactor = ((Math.pow(1 + m, g) - 1) / m) * (1 + m);
  const totalRequiredMonthly = shortfall / compoundFactor;
  
  // Deduct employer contribution to get the employee's required monthly contribution
  const requiredMonthly = Math.max(0, totalRequiredMonthly - employerContribution);
  
  return {
    requiredMonthly,
    requiredCorpus,
    shortfall
  };
};

/**
 * Calculates year-by-year projections for graphs
 * @param {object} inputs 
 * @returns {Array} Year list with corpus, pension, and contribution data
 */
export const CF = (inputs) => {
  const {
    currentBalance = 0,
    monthlyContribution = 0,
    employerContribution = 0,
    equityPct,
    corpBondsPct,
    govBondsPct,
    yearsToRetirement,
    currentAge
  } = inputs;
  
  const timeline = [];
  const totalMonthly = monthlyContribution + employerContribution;
  const rate = Am(equityPct, corpBondsPct, govBondsPct, "realistic");
  
  for (let year = 0; year <= yearsToRetirement; year++) {
    const corpus = cP(currentBalance, totalMonthly, rate, year);
    const { monthlyPension } = Ni(corpus);
    const totalContributed = currentBalance + (totalMonthly * 12 * year);
    
    timeline.push({
      year,
      age: currentAge + year,
      corpus,
      monthlyPension,
      totalContributed
    });
  }
  
  return timeline;
};

/**
 * Runs a Monte Carlo simulation of 1000 trials
 * @param {object} inputs 
 * @param {number} trials (default 1000)
 * @returns {object} { pessimistic, realistic, optimistic, all }
 */
export const jQ = (inputs, trials = 1000) => {
  const results = [];
  const totalMonthly = (inputs.monthlyContribution || 0) + (inputs.employerContribution || 0);
  const baseRate = Am(inputs.equityPct, inputs.corpBondsPct, inputs.govBondsPct, "realistic");
  
  for (let n = 0; n < trials; n++) {
    // Generate a randomized return deviation of -3% to +3%
    const rateDeviation = (Math.random() - 0.5) * 0.06;
    const trialRate = baseRate + rateDeviation;
    
    const finalCorpus = cP(
      inputs.currentBalance || 0,
      totalMonthly,
      trialRate,
      inputs.yearsToRetirement
    );
    
    results.push(finalCorpus);
  }
  
  // Sort from lowest corpus to highest corpus
  results.sort((a, b) => a - b);
  
  return {
    pessimistic: results[Math.floor(trials * 0.05)], // 5th percentile
    realistic: results[Math.floor(trials * 0.50)],   // 50th percentile
    optimistic: results[Math.floor(trials * 0.95)],  // 95th percentile
    all: results
  };
};
