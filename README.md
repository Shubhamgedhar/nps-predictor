# NPS Predictor & Retirement Optimizer

A visually stunning, high-performance standalone web application that helps National Pension System (NPS) subscribers in India simulate, analyze, and optimize their retirement outcomes. Designed with premium dark-glass aesthetics, interactive graphics, and advanced statistical modeling, it empowers users with actionable wealth-building advice and goal gap analysis.

Live preview link (original AI agent prototype): https://nps-predictor.base44.app/

---

## 🌟 Key Features

1. **Interactive Timeline Projections**: A responsive vector line chart detailing your corpus build-up, total personal contributions, and corresponding estimated pension outcomes year-by-year from your current age to retirement.
2. **Dynamic Asset Allocator**: Interactive sliders allowing custom allocation weights among Equities (E), Corporate Debt (C), and Government Securities (G) with a smart balancer that maintains a strict 100% allocation.
3. **Monte Carlo Risk Simulation**: Standard calculators assume linear returns. This engine runs 1,000 randomized market trials (simulating ±3% volatility deviations) to compute the **Realistic (50th)**, **Optimistic (95th)**, and **Pessimistic (5th percentile)** paths to test corpus confidence.
4. **Target Retirement Goal Solver**: Input your desired monthly pension, and the planner immediately runs back-calculations to determine your shortfall and the exact additional monthly contribution needed to bridge the gap.
5. **NPS AI Coach**: A personalized automated advisor providing recommendations on savings rates, portfolio rebalancing warnings (based on age-appropriate risk profiles), and highlighting tax savings under Section 80CCD(1B).
6. **Scenario Comparisons (Saved Plans)**: Save different planning configurations locally (stored in LocalStorage) to compare outcomes (e.g. *Conservative Allocation* vs. *High Contribution Target*).

---

## 📊 Mathematical Engine & Formulas

### 1. Weighted Rate of Return ($R_w$)
The portfolio return rate is determined by the asset class weights multiplied by their expected returns in a given market scenario (optimistic, realistic, or pessimistic):
$$R_w = w_{equity} \cdot R_{equity} + w_{corp} \cdot R_{corp} + w_{gov} \cdot R_{gov}$$

*Expected Returns Matrix:*
| Asset Class | Pessimistic | Realistic | Optimistic |
| :--- | :---: | :---: | :---: |
| **Equity (E)** | 6.0% | 10.0% | 14.0% |
| **Corporate Bonds (C)** | 5.0% | 8.0% | 10.0% |
| **Government Securities (G)** | 5.0% | 7.0% | 8.0% |

---

### 2. Future Value Accumulation ($FV$)
Future value compound calculations are calculated monthly. The formula combines the growth of your current balance ($PV$) and a monthly ordinary annuity ($PMT$):
$$FV = PV \cdot (1 + R_w)^t + PMT \cdot \left[ \frac{(1 + m)^g - 1}{m} \right] \cdot (1 + m)$$

Where:
* $t$ = Years to retirement
* $m = \frac{R_w}{12}$ (monthly rate of return)
* $g = t \cdot 12$ (total months of accumulation)
* $PMT$ = Your Monthly Contribution + Employer Contribution

---

### 3. Pension Distribution
At retirement, Indian NPS rules mandate that at least 40% of the corpus must be used to purchase an annuity, and up to 60% can be withdrawn tax-free as a lump sum:
* **Annuity Purchased**: $\text{Corpus} \times 40\%$
* **Tax-Free Lump Sum**: $\text{Corpus} \times 60\%$
* **Estimated Monthly Pension**: $\frac{\text{Annuity} \times 6\% \text{ (yield)}}{12 \text{ months}}$

---

### 4. Goal Planner Solver
To achieve a target pension, the program computes the required corpus ($C_{req}$):
$$C_{req} = \frac{\text{Target Pension} \times 12}{6\% \text{ (yield)} \times 40\% \text{ (annuity ratio)}}$$

The shortfall is $S = C_{req} - PV \cdot (1 + R_w)^t$. If $S > 0$, the required monthly deposit ($PMT_{req}$) is solved as:
$$PMT_{req} = \frac{S}{\left[ \frac{(1 + m)^g - 1}{m} \right] \cdot (1 + m)} - \text{Employer Contribution}$$

---

## 🛠️ Tech Stack & Architecture

- **Structure**: Semantic HTML5 markup
- **Styling**: Bespoke Vanilla CSS3 (featuring HSL color tokens, dark glassmorphism, responsive grid layouts, and custom range sliders)
- **Logic**: Vanilla ES6 JavaScript (No compilation needed)
- **Charts**: Custom-generated interactive SVG layers with tooltip event listeners
- **Icons**: Lucide Icons CDN
- **Data Persistence**: Offline capability using HTML5 LocalStorage

---

## 🚀 How to Run Locally

Since this application is built with vanilla files, **no dependencies or build steps are required**. 

### Method A: Single-click Execution
Simply double-click the `index.html` file in your explorer to open the dashboard directly in any modern browser.

### Method B: Local Server (Recommended for responsiveness)
If you want to run a local development server, run one of the following commands in the project directory:

**Using Python:**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Using Node.js (if installed):**
```bash
npm install -g serve
serve .
```

---

## 📤 Publishing to GitHub

To add this project to your GitHub:

1. Create a new empty repository on your GitHub account called `nps-predictor`.
2. Open your terminal in the project directory and execute:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - NPS Predictor & Optimizer release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nps-predictor.git
   git push -u origin main
   ```
3. To host the dashboard for free on GitHub Pages:
   - Go to your repository settings on GitHub.
   - Click on **Pages** in the sidebar.
   - Under **Build and deployment**, set the source to **Deploy from a branch** and select `main` (root).
   - Click **Save**. Within minutes, your site will be live at `https://YOUR_USERNAME.github.io/nps-predictor/`!
