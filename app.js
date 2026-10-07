(function () {
  "use strict";

  const STORAGE_KEY = "investment-calculator-v1";

  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /**
   * Future value of principal with compound interest plus ordinary annuity (PMT).
   * FV = P(1+r/n)^(nt) + PMT * (((1+r/n)^(nt) - 1) / (r/n)) when rate > 0
   * When rate = 0: FV = P + PMT * n * t
   * PMT is monthly; contributions are applied monthly (end of period).
   * For non-monthly compounding, PMT is still monthly deposit total per compound period.
   */
  function calculateInvestment(principal, annualRatePercent, monthlyContribution, years, compoundsPerYear) {
    const P = Number(principal) || 0;
    const r = (Number(annualRatePercent) || 0) / 100;
    const PMT = Number(monthlyContribution) || 0;
    const t = Number(years) || 0;
    const n = Number(compoundsPerYear) || 12;

    const totalMonths = Math.round(t * 12);
    const totalContributions = P + PMT * totalMonths;

    let futureValue;
    if (r === 0) {
      futureValue = totalContributions;
    } else {
      // Use monthly contribution model with period rate matching compounding.
      // Standard approach: compound n times/year; monthly deposits accumulate
      // within each year. Equivalent closed form for monthly deposits with
      // monthly compounding (n=12): use r/12 and PMT as given.
      // For other n, treat each month's deposit and compound at rate r/n
      // by simulating monthly steps with effective growth.
      futureValue = compoundWithMonthlyDeposits(P, r, PMT, totalMonths, n);
    }

    const totalInterest = futureValue - totalContributions;

    return {
      futureValue,
      totalContributions,
      totalInterest,
      years: t,
      monthlyContribution: PMT,
      principal: P,
      rate: r,
      n,
    };
  }

  /**
   * Month-by-month simulation so monthly contributions work with any compounding
   * frequency. Interest is applied n times per year (at compound boundaries).
   * Between compound events, deposits still accumulate to the balance.
   */
  function compoundWithMonthlyDeposits(P, r, PMT, totalMonths, n) {
    if (r === 0) {
      return P + PMT * totalMonths;
    }

    // Closed form when compounding monthly (matches required formula exactly)
    if (n === 12) {
      const i = r / 12;
      const nt = totalMonths;
      const growth = Math.pow(1 + i, nt);
      return P * growth + PMT * ((growth - 1) / i);
    }

    // Closed form for annual rate with n compounds, but PMT monthly:
    // Convert monthly deposits into equivalent end-of-period deposits per compound period,
    // then use the standard formula. For accuracy across frequencies we simulate.
    let balance = P;
    const periodsPerYear = n;
    const monthsPerPeriod = 12 / periodsPerYear;
    const periodRate = r / periodsPerYear;

    // If monthsPerPeriod is not integer (e.g. daily), fall back to daily-ish sim
    if (!Number.isInteger(monthsPerPeriod) || monthsPerPeriod < 1) {
      // Daily compounding approximation: apply daily rate each day, deposit monthly
      const days = Math.round(totalMonths * (365 / 12));
      const dailyRate = r / 365;
      let monthCounter = 0;
      let dayInMonth = 0;
      const daysPerMonth = 365 / 12;
      for (let d = 0; d < days; d++) {
        balance *= 1 + dailyRate;
        dayInMonth += 1;
        if (dayInMonth >= daysPerMonth - 1e-9) {
          balance += PMT;
          dayInMonth -= daysPerMonth;
          monthCounter += 1;
          if (monthCounter >= totalMonths) break;
        }
      }
      return balance;
    }

    for (let m = 0; m < totalMonths; m++) {
      balance += PMT;
      // Apply compound interest at the end of each compound period
      if ((m + 1) % monthsPerPeriod === 0) {
        balance *= 1 + periodRate;
      }
    }
    return balance;
  }

  /**
   * Year-by-year breakdown using the same monthly simulation / closed form.
   */
  function yearByYearBreakdown(principal, annualRatePercent, monthlyContribution, years, compoundsPerYear) {
    const P = Number(principal) || 0;
    const r = (Number(annualRatePercent) || 0) / 100;
    const PMT = Number(monthlyContribution) || 0;
    const t = Math.floor(Number(years) || 0);
    const n = Number(compoundsPerYear) || 12;
    const rows = [];

    let balance = P;
    let contribSoFar = P;

    for (let year = 1; year <= t; year++) {
      const startBalance = balance;
      const yearContrib = PMT * 12;
      contribSoFar += yearContrib;

      if (r === 0) {
        balance += yearContrib;
      } else if (n === 12) {
        const i = r / 12;
        const growth = Math.pow(1 + i, 12);
        // Grow existing balance for 12 months, then add annuity of 12 payments
        balance = startBalance * growth + PMT * ((growth - 1) / i);
      } else {
        balance = compoundWithMonthlyDeposits(startBalance, r, PMT, 12, n);
      }

      const interestThisYear = balance - startBalance - yearContrib;
      rows.push({
        year,
        endBalance: balance,
        contributions: contribSoFar,
        interestCumulative: balance - contribSoFar,
        interestThisYear,
      });
    }

    return rows;
  }

  function readInputs(ids) {
    return {
      principal: parseFloat(document.getElementById(ids.principal).value) || 0,
      rate: parseFloat(document.getElementById(ids.rate).value) || 0,
      contribution: parseFloat(document.getElementById(ids.contribution).value) || 0,
      years: parseFloat(document.getElementById(ids.years).value) || 0,
      compounding: parseInt(document.getElementById(ids.compounding).value, 10) || 12,
    };
  }

  function writeInputs(ids, data) {
    if (!data) return;
    const map = {
      principal: ids.principal,
      rate: ids.rate,
      contribution: ids.contribution,
      years: ids.years,
      compounding: ids.compounding,
    };
    Object.keys(map).forEach(function (key) {
      if (data[key] != null) {
        const el = document.getElementById(map[key]);
        if (el) el.value = data[key];
      }
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore quota / private mode errors
    }
  }

  function collectAllState() {
    return {
      single: readInputs({
        principal: "principal",
        rate: "rate",
        contribution: "contribution",
        years: "years",
        compounding: "compounding",
      }),
      a: readInputs({
        principal: "a-principal",
        rate: "a-rate",
        contribution: "a-contribution",
        years: "a-years",
        compounding: "a-compounding",
      }),
      b: readInputs({
        principal: "b-principal",
        rate: "b-rate",
        contribution: "b-contribution",
        years: "b-years",
        compounding: "b-compounding",
      }),
      activeTab: document.querySelector(".tab.active")
        ? document.querySelector(".tab.active").dataset.panel
        : "panel-single",
      breakdownOpen:
        document.getElementById("toggle-breakdown").getAttribute("aria-expanded") !== "false",
    };
  }

  function persist() {
    saveState(collectAllState());
  }

  function renderSingle() {
    const inputs = readInputs({
      principal: "principal",
      rate: "rate",
      contribution: "contribution",
      years: "years",
      compounding: "compounding",
    });

    const result = calculateInvestment(
      inputs.principal,
      inputs.rate,
      inputs.contribution,
      inputs.years,
      inputs.compounding
    );

    document.getElementById("fv").textContent = usd.format(result.futureValue);
    document.getElementById("total-contrib").textContent = usd.format(result.totalContributions);
    document.getElementById("total-interest").textContent = usd.format(result.totalInterest);

    const rows = yearByYearBreakdown(
      inputs.principal,
      inputs.rate,
      inputs.contribution,
      inputs.years,
      inputs.compounding
    );

    const tbody = document.getElementById("breakdown-body");
    tbody.innerHTML = "";
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        row.year +
        "</td>" +
        "<td>" +
        usd.format(row.endBalance) +
        "</td>" +
        "<td>" +
        usd.format(row.contributions) +
        "</td>" +
        "<td>" +
        usd.format(row.interestCumulative) +
        "</td>";
      tbody.appendChild(tr);
    });

    persist();
  }

  function renderCompare() {
    const a = readInputs({
      principal: "a-principal",
      rate: "a-rate",
      contribution: "a-contribution",
      years: "a-years",
      compounding: "a-compounding",
    });
    const b = readInputs({
      principal: "b-principal",
      rate: "b-rate",
      contribution: "b-contribution",
      years: "b-years",
      compounding: "b-compounding",
    });

    const ra = calculateInvestment(a.principal, a.rate, a.contribution, a.years, a.compounding);
    const rb = calculateInvestment(b.principal, b.rate, b.contribution, b.years, b.compounding);

    document.getElementById("a-fv").textContent = usd.format(ra.futureValue);
    document.getElementById("a-total-contrib").textContent = usd.format(ra.totalContributions);
    document.getElementById("a-total-interest").textContent = usd.format(ra.totalInterest);

    document.getElementById("b-fv").textContent = usd.format(rb.futureValue);
    document.getElementById("b-total-contrib").textContent = usd.format(rb.totalContributions);
    document.getElementById("b-total-interest").textContent = usd.format(rb.totalInterest);

    const diff = Math.abs(ra.futureValue - rb.futureValue);
    const winner = ra.futureValue >= rb.futureValue ? "A" : "B";
    const same = Math.abs(ra.futureValue - rb.futureValue) < 0.005;
    const el = document.getElementById("compare-diff");
    if (same) {
      el.innerHTML = "Both scenarios end with the same future value.";
    } else {
      el.innerHTML =
        "Scenario " +
        winner +
        " finishes ahead by <strong>" +
        usd.format(diff) +
        "</strong>.";
    }

    persist();
  }

  function switchTab(panelId) {
    document.querySelectorAll(".tab").forEach(function (tab) {
      const active = tab.dataset.panel === panelId;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll(".panel").forEach(function (panel) {
      const active = panel.id === panelId;
      panel.classList.toggle("active", active);
      if (active) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
    persist();
  }

  function restore() {
    const state = loadState();
    if (!state) return;

    writeInputs(
      {
        principal: "principal",
        rate: "rate",
        contribution: "contribution",
        years: "years",
        compounding: "compounding",
      },
      state.single
    );
    writeInputs(
      {
        principal: "a-principal",
        rate: "a-rate",
        contribution: "a-contribution",
        years: "a-years",
        compounding: "a-compounding",
      },
      state.a
    );
    writeInputs(
      {
        principal: "b-principal",
        rate: "b-rate",
        contribution: "b-contribution",
        years: "b-years",
        compounding: "b-compounding",
      },
      state.b
    );

    if (state.activeTab) {
      switchTab(state.activeTab);
    }

    const toggle = document.getElementById("toggle-breakdown");
    if (state.breakdownOpen === false) {
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  // Tabs
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchTab(tab.dataset.panel);
    });
  });

  // Breakdown collapse
  document.getElementById("toggle-breakdown").addEventListener("click", function () {
    const expanded = this.getAttribute("aria-expanded") !== "false";
    this.setAttribute("aria-expanded", expanded ? "false" : "true");
    persist();
  });

  // Forms
  document.getElementById("form-single").addEventListener("submit", function (e) {
    e.preventDefault();
    renderSingle();
  });

  document.getElementById("form-compare").addEventListener("submit", function (e) {
    e.preventDefault();
    renderCompare();
  });

  // Live recalculate on input change (debounced lightly via input event)
  ["principal", "rate", "contribution", "years", "compounding"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", renderSingle);
    document.getElementById(id).addEventListener("input", renderSingle);
  });

  ["a-principal", "a-rate", "a-contribution", "a-years", "a-compounding",
   "b-principal", "b-rate", "b-contribution", "b-years", "b-compounding"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", renderCompare);
    document.getElementById(id).addEventListener("input", renderCompare);
  });

  restore();
  renderSingle();
  renderCompare();
})();
