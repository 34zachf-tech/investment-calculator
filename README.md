# Investment Calculator

Hypothetical compound-interest calculator with monthly contributions, year-by-year breakdown, and side-by-side scenario comparison. No build step or frameworks.

## Open

Open `index.html` in a browser, or from this folder run `python -m http.server` and visit `http://localhost:8000`.

## How to use

1. **Single scenario** - Enter starting principal, annual interest rate (%), monthly contribution, years, and compounding frequency (defaults to monthly). Results show future value, total contributions, and interest earned, plus an expandable year-by-year table.
2. **Compare scenarios** - Switch to the Compare tab and edit Scenario A and Scenario B to see which finishes ahead (for example, a higher rate versus a higher contribution).
3. Inputs are saved in `localStorage` and restored on reload.

## Formula

With rate `r` (decimal), compounding `n` times per year, principal `P`, monthly payment `PMT`, and `t` years:

- When `r > 0` and monthly compounding (`n = 12`):  
  `FV = P(1+r/n)^(nt) + PMT * (((1+r/n)^(nt) - 1) / (r/n))`
- When `r = 0`: `FV = P + PMT * 12 * t`

Other compounding frequencies use an equivalent month-based simulation so monthly deposits still apply correctly.

## Files

| File | Role |
|------|------|
| `index.html` | Page structure and forms |
| `styles.css` | Dark theme styles |
| `app.js` | Calculations, UI updates, persistence |

This tool is for illustration only and is not financial advice.
