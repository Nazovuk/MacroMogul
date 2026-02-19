# 05 — Corporate Finance

This document covers the entire financial simulation: stock market, shares, bonds, loans, mergers & acquisitions, dividends, banking, and insurance.

---

## 1. Company Financial State

Every company (player + AI) maintains:

```json
{
  "companyId": 1,
  "name": "Player Corp",
  "cash": 50000000,
  "totalAssets": 120000000,
  "totalLiabilities": 30000000,
  "equity": 90000000,
  "sharesOutstanding": 1000000,
  "sharePrice": 90.0,
  "eps": 4.50,
  "peRatio": 20.0,
  "marketCap": 90000000,
  "creditRating": "A",
  "monthlyRevenue": 5000000,
  "monthlyCosts": 3500000,
  "monthlyProfit": 1500000,
  "dividendPerShare": 0.50,
  "loans": [],
  "bonds": []
}
```

---

## 2. Stock Market

### 2.1 Stock Price Calculation

```
Each month:
  intrinsic_value = eps * base_pe_multiple
  
  base_pe_multiple is modified by:
    - economic_state: expansion → ×1.2, contraction → ×0.8
    - industry_trend: growing → ×1.1, declining → ×0.9
    - central_bank_policy: loose → ×1.15, tight → ×0.85
    - company_momentum: revenue_growth_rate * 5
  
  market_sentiment = random_walk(-0.05, 0.05) + news_impact
  
  share_price = intrinsic_value * (1 + market_sentiment)
  share_price = max(share_price, 0.01)
  
  // Automatic reverse stock split if price < $1.00
  if share_price < 1.0:
    ratio = ceil(1.0 / share_price)
    shares_outstanding /= ratio
    share_price *= ratio
```

### 2.2 Issuing New Shares

```
issueShares(company, quantity):
  if quantity > company.sharesOutstanding * 0.5:
    warn("Issuing too many shares may dilute EPS significantly")
  
  proceeds = quantity * current_share_price * 0.95  // 5% underwriting fee
  company.cash += proceeds
  company.sharesOutstanding += quantity
  company.eps = company.annualProfit / company.sharesOutstanding
  
  // Risk: if player's ownership drops below 50%, they lose control
  player_ownership = player_shares / company.sharesOutstanding
```

### 2.3 Stock Buyback

```
buybackShares(company, quantity):
  cost = quantity * current_share_price
  if cost > company.cash:
    reject("Insufficient funds")
  
  company.cash -= cost
  company.sharesOutstanding -= quantity
  company.eps = company.annualProfit / company.sharesOutstanding  // EPS improves
```

### 2.4 Dividends

```
payDividend(company, amount_per_share):
  total_payout = amount_per_share * company.sharesOutstanding
  if total_payout > company.cash:
    reject("Insufficient cash")
  
  company.cash -= total_payout
  // Dividend yield attracts investors → positive sentiment
  // Special dividends (one-time large payouts) also supported
```

### 2.5 Stock Splits

```
stockSplit(company, ratio):  // e.g., ratio = 2 means 2-for-1
  company.sharesOutstanding *= ratio
  company.sharePrice /= ratio
  // No change in market cap or EPS (just cosmetic)
```

### 2.6 Trading Other Companies' Stocks

```
Players can:
  - Buy shares of any publicly traded company
  - Sell shares they own
  - View company reports (balance sheet, income statement)
  - Analyze EPS, P/E, market cap
  
Investment portfolio tracked as:
  player.portfolio = [
    { companyId, sharesOwned, avgPurchasePrice }
  ]
```

### 2.7 Global Stock Market

- A separate "global" exchange with large-cap stocks (not in any game city)
- Higher liquidity, larger companies
- Provides diversification opportunity

---

## 3. Mergers & Acquisitions

### Ownership Thresholds

| Ownership % | Capability |
|-------------|-----------|
| < 20% | No influence |
| 20–49% | Board seat, can view financials |
| 50–74% | Can trade stocks on their behalf |
| 75%+ | Can initiate **merger** |

### Merger Process

```
merge(acquirer, target):
  requires: acquirer owns >= 75% of target shares
  
  1. All target's buildings → acquirer.buildings
  2. All target's employees → acquirer.employees
  3. All target's tech/R&D progress → acquirer
  4. Target ceases to exist as separate entity
  5. Acquirer's market cap adjusts to reflect combined value
```

### Hostile Takeover

- Buy shares on open market until crossing 75% threshold
- Target AI may implement "poison pill": issuing new shares to dilute acquirer

### Acquiring Bankrupt Companies

```
when company.cash < 0 AND company.totalLiabilities > company.totalAssets:
  company enters bankruptcy
  assets auctioned to highest bidder
  player can bid on individual buildings or entire company
```

---

## 4. Loans

```json
{
  "loanId": 1,
  "principal": 5000000,
  "interestRate": 0.05,
  "termMonths": 60,
  "monthlyPayment": 94000,
  "remainingBalance": 4500000,
  "lender": "bank_npc"  // or a player-owned bank
}
```

### Loan Availability

```
max_loan_amount = company.totalAssets * credit_multiplier[creditRating]
  where credit_multiplier = { AAA: 0.8, AA: 0.7, A: 0.6, BBB: 0.5, BB: 0.3, B: 0.2 }

interest_rate = centralBank.interestRate + risk_premium[creditRating]
  where risk_premium = { AAA: 0.005, AA: 0.01, A: 0.015, BBB: 0.025, BB: 0.04, B: 0.06 }
```

---

## 5. Bonds

```json
{
  "bondId": 1,
  "issuer": "companyId or cityId or sovereignId",
  "type": "corporate",  // "corporate" | "municipal" | "sovereign"
  "faceValue": 1000,
  "couponRate": 0.04,
  "maturityMonths": 120,
  "riskGrade": "A",
  "currentPrice": 980
}
```

### Bond Mechanics

```
issueBond(company, faceValue, couponRate, term):
  company.cash += faceValue * 0.98  // 2% issuance fee
  company.bonds.push(new bond)
  
  each month:
    coupon_payment = faceValue * couponRate / 12
    company.cash -= coupon_payment
    bondholder.cash += coupon_payment
  
  at maturity:
    company.cash -= faceValue  // repay principal

Bond prices fluctuate with:
  - Interest rate changes (inverse relationship)
  - Issuer credit rating changes
  - Market sentiment
```

---

## 6. Banking (DLC Feature)

Player-owned banks operate as:

```
Bank entity:
  deposits: $ amount from NPC/AI depositors
  loans_outstanding: $ lent to companies
  capital_requirement: deposits * reserve_ratio (e.g., 10%)
  
  revenue = interest_earned_on_loans - interest_paid_on_deposits
  
  risk: if too many borrowers default → bank becomes insolvent
  regulatory_check: capital_held >= capital_requirement
```

---

## 7. Insurance (DLC Feature)

```
Insurance company:
  policies_sold: [{ premium, coverage, risk_category }]
  claims_reserve: sum(expected_claims)
  investment_portfolio: premiums invested in stocks/bonds
  
  revenue = premium_income + investment_returns - claims_paid
  
  risk: catastrophic event → large claim payouts
  profit: leverage float (invest premiums before claims arise)
```

---

## 8. Financial Statements

Every company generates monthly:

### Income Statement
```
Revenue
  - Product Sales
  - Rental Income
  - Ad Revenue
  - Investment Income
  - Dividends Received
(-) Cost of Goods Sold
(-) Operating Expenses (wages, upkeep, freight)
(-) Interest Expense
(-) Tax
= Net Income
```

### Balance Sheet
```
Assets:
  Cash
  Inventory (valued at cost)
  Buildings (book value)
  Land
  Investments (portfolio market value)
  R&D (capitalized)

Liabilities:
  Loans Outstanding
  Bonds Outstanding
  Accounts Payable

Equity:
  Share Capital
  Retained Earnings
```

---

---

## 10. Monetization & In-Game Economy

MacroMogul supports a persistent premium layer for business-to-user (B2U) transactions.

| Feature | Type | Logic |
|---------|------|-------|
| **Premium Scenarios** | DLC | Unlocks specific maps/rules via Cloud entitlement. |
| **Golden Tokens** | Virtual Currency | Can be exchanged for instant "Innovation Boosts" (Optional). |
| **Premium Themes** | Cosmetic | Custom UI skins (e.g., Cyberpunk, Retro 90s). |

### Monetization Safety
- Real-money transactions are handled outside the core simulation loop.
- In-game logic treats "Premium Credits" as a separate asset class that cannot be "lost" due to in-game bankruptcy.

---

## 11. Acceptance Criteria

- [ ] Stock prices update monthly based on fundamentals + sentiment
- [ ] Localization (EN/TR) works across all financial reports
- [ ] Users can log in/out via Supabase Auth
- [ ] Cloud-sync enables resuming save states across browser/desktop
- [ ] Monetization store displays items and processes test transactions
- [ ] Banking and insurance mechanics follow Basel-III capital ratios
