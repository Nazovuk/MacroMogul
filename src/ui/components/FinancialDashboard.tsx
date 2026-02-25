import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import {
  Building,
  Maintenance,
  HumanResources,
  Inventory,
  Company,
  Finances,
  CityEconomicData,
  Position,
  Executive,
  MarketingOffice, 
  ResearchCenter
} from '../../core/ecs/components';
import { 
  issueLoan, 
  getFinancialSummary, 
  prepayLoan,
  issueCorporateBond
} from '../../core/ecs/systems/FinancialSystem';
import './FinancialDashboard.css';

interface FinancialDashboardProps {
  world: GameWorld;
  onClose: () => void;
  onUpdate?: () => void;
}

export function FinancialDashboard({ world, onClose, onUpdate }: FinancialDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'cashflow'>('overview');
  const [financeSubTab, setFinanceSubTab] = useState<'loans' | 'bonds'>('loans');
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [bondAmount, setBondAmount] = useState(5000000);
  
  // Get live financial data from ECS
  const playerCid = world.playerEntityId;
  const currentFinances = playerCid ? {
    rating: Finances.creditRating[playerCid] || 50,
    limit: Finances.creditLimit[playerCid] || 10000000,
    debt: Finances.debt[playerCid] || 0,
    interestRate: Finances.interestRate[playerCid] || 500,
  } : { rating: 50, limit: 10000000, debt: 0, interestRate: 500 };

  const summary = useMemo(() => playerCid ? getFinancialSummary(world.playerEntityId) : null, [world, activeTab, financeSubTab, world.tick]);
  const activeLoans = summary?.loans || [];
  const activeBonds = summary?.bonds || [];

  const financialData = useMemo(() => {
    const maintenanceQuery = defineQuery([Building, Maintenance]);
    const buildings = maintenanceQuery(world.ecsWorld);
    let totalMonthlyMaintenance = 0;
    
    buildings.forEach(id => {
      if (Building.isOperational[id] === 1) {
        totalMonthlyMaintenance += Maintenance.monthlyCost[id] || 0;
      }
    });

    const hrQuery = defineQuery([Building, HumanResources, Company]);
    const hrEntities = hrQuery(world.ecsWorld);
    let totalMonthlyPayroll = 0;
    
    hrEntities.forEach(id => {
      if (Company.companyId[id] === world.playerEntityId && Building.isOperational[id] === 1) {
        const headcount = HumanResources.headcount[id] || 0;
        const salary = HumanResources.salary[id] || 0;
        const trainingBudget = HumanResources.trainingBudget[id] || 0;
        totalMonthlyPayroll += (salary * headcount) + trainingBudget;
      }
    });

    const inventoryQuery = defineQuery([Building, Inventory, Company]);
    const inventoryEntities = inventoryQuery(world.ecsWorld);
    let totalInventoryValue = 0;
    let totalBuildingValue = 0;
    
    inventoryEntities.forEach(id => {
      if (Company.companyId[id] === world.playerEntityId) {
        const buildingTypeId = Building.buildingTypeId[id];
        const buildingData = world.dataStore.getBuilding(buildingTypeId);
        if (buildingData) {
          totalBuildingValue += buildingData.baseCost * Building.level[id];
        }
        
        const amount = Inventory.currentAmount[id] || 0;
        const productId = Inventory.productId[id];
        if (productId && amount > 0) {
          const product = world.dataStore.getProduct(productId);
          if (product) {
            totalInventoryValue += amount * (product.basePrice || 0);
          }
        }
      }
    });

    // Calculate Executive Pay
    const execQuery = defineQuery([Company, Executive]);
    const execEntities = execQuery(world.ecsWorld);
    let totalExecutivePay = 0;
    execEntities.forEach(id => {
       if (Company.companyId[id] === world.playerEntityId) { 
           totalExecutivePay += Executive.salary[id] || 0;
       }
    });

    // Calculate Marketing Spend
    const marketQuery = defineQuery([Company, MarketingOffice, Building]);
    const marketEntities = marketQuery(world.ecsWorld);
    let totalMarketingSpend = 0;
    marketEntities.forEach(id => {
       if (Company.companyId[id] === world.playerEntityId && Building.isOperational[id] === 1) {
           const type = MarketingOffice.campaignType[id] || 0;
           const costs = [1.0, 0.6, 2.0, 0.3, 1.5]; // Must match CAMPAIGN_PROFILES cost factors
           const costMult = costs[type] || 1.0;
           totalMarketingSpend += Math.floor((MarketingOffice.spending[id] || 0) * costMult);
       }
    });

    // Calculate R&D Spend
    const rdQuery = defineQuery([Company, ResearchCenter, Building]);
    const rdEntities = rdQuery(world.ecsWorld);
    let totalRDSpend = 0;
    rdEntities.forEach(id => {
       if (Company.companyId[id] === world.playerEntityId && Building.isOperational[id] === 1 && ResearchCenter.researchingProductId[id] > 0) {
           // We'll estimate R&D cost based on an average tier to save deep lookups
           totalRDSpend += 1500000; // Average Advanced R&D per month ($15K)
       }
    });

    const companyQuery = defineQuery([Company]);
    const companies = companyQuery(world.ecsWorld);
    let playerCompanyEntity = 0;
    for(const eid of companies) {
        if (Company.companyId[eid] === world.playerEntityId) {
            playerCompanyEntity = eid;
            break;
        }
    }
    
    // Use actual Company component data for financial metrics
    const monthlyRevenue = playerCompanyEntity ? (Company.revenueLastMonth[playerCompanyEntity] || 0) : 0;
    const accumulatedExpenses = playerCompanyEntity ? (Company.expensesLastMonth[playerCompanyEntity] || 0) : 0;
    const netIncomeLastMonth = playerCompanyEntity ? (Company.netIncomeLastMonth[playerCompanyEntity] || 0) : 0;

    // Calculate Macro Economic Impact
    const cityQuery = defineQuery([CityEconomicData, Position]);
    const cities = cityQuery(world.ecsWorld);
    let avgInflationRate = 2.5; 
    let avgTaxRate = 25;
    let avgInterestRate = 5.0;
    let avgGdpGrowth = 2.0;
    
    if (cities.length > 0) {
      let totalInflation = 0;
      let totalTax = 0;
      let totalInterest = 0;
      let totalGdp = 0;
      cities.forEach(cityId => {
        totalInflation += CityEconomicData.inflationRate[cityId] || 250;
        totalTax += CityEconomicData.taxRate[cityId] || 25;
        totalInterest += CityEconomicData.interestRate[cityId] || 500;
        totalGdp += CityEconomicData.gdpGrowthRate[cityId] || 200;
      });
      avgInflationRate = (totalInflation / cities.length) / 100;
      avgTaxRate = totalTax / cities.length;
      avgInterestRate = (totalInterest / cities.length) / 100;
      avgGdpGrowth = (totalGdp / cities.length) / 100;
    }

    // Calculate macro impacts on net income
    const inflationImpact = Math.abs(netIncomeLastMonth * (avgInflationRate / 100));
    const taxImpact = Math.abs(netIncomeLastMonth * (avgTaxRate / 100));
    const operationalProfit = netIncomeLastMonth - inflationImpact - taxImpact;

    return {
      cash: world.cash,
      totalMonthlyMaintenance,
      totalMonthlyPayroll,
      monthlyRevenue,
      accumulatedExpenses,
      netIncome: netIncomeLastMonth, // Using the actual snapshot
      netIncomeLastMonth,
      totalInventoryValue,
      totalBuildingValue,
      totalExecutivePay,
      totalMarketingSpend,
      totalRDSpend,
      totalAssets: world.cash + totalInventoryValue + totalBuildingValue,
      macroData: {
        avgInflationRate,
        avgTaxRate,
        avgInterestRate,
        avgGdpGrowth,
        inflationImpact,
        taxImpact,
        operationalProfit
      }
    };
  }, [world]);

  const maxLoanAmount = useMemo(() => {
    return Math.max(0, currentFinances.limit - currentFinances.debt);
  }, [currentFinances.limit, currentFinances.debt]);

  const projectedInterestRate = useMemo(() => {
    // This is a UI projection, the actual rate is calculated in issueLoan
    return (currentFinances.interestRate + (100 + (100 - currentFinances.rating) * 14)) / 100;
  }, [currentFinances.rating, currentFinances.interestRate]);

  const handleTakeLoan = () => {
    if (!playerCid) return;

    const loan = issueLoan(world, playerCid, loanAmount, 24);
    
    if (loan) {
      if (onUpdate) onUpdate();
      
      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: t('finance.loan_approved', { amount: `$${(loanAmount/100).toLocaleString()}`, rate: (loan.interestRate/100).toFixed(2) }), type: 'success' } 
      }));
    } else {
      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: t('finance.loan_rejected'), type: 'error' } 
      }));
    }
  };

  const currentMarketCap = playerCid ? (Company.marketCap[playerCid] || 0) : 0;
  
  const maxBondAmount = useMemo(() => {
    return Math.max(0, (currentMarketCap * 0.5) - currentFinances.debt);
  }, [currentMarketCap, currentFinances.debt]);

  const handleIssueBond = () => {
    if (!playerCid) return;

    // Issue at standard 5-year (60 months) with projected interest rate
    // Note: Bond issue requires rating >= 60 and won't exceed 50% debt-to-market-cap
    const bond = issueCorporateBond(world, playerCid, bondAmount, projectedInterestRate * 100, 60);

    if (bond) {
      if (onUpdate) onUpdate();

      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: t('finance.bond_issued', { amount: `$${(bondAmount/100).toLocaleString()}`, rating: bond.bondRating }), type: 'success' } 
      }));
    } else {
      window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: t('finance.bond_rejected'), type: 'error' } 
      }));
    }
  };


  const handlePrepay = (loanId: number, amount: number) => {
    if (!playerCid) return;
    if (prepayLoan(playerCid, loanId, amount)) {
      if (onUpdate) onUpdate();
    }
  };

  return (
    <div className="financial-dashboard-overlay">
      <div className="financial-dashboard">
        <div className="dashboard-header">
          <h2>📊 {t('finance.income_statement')}</h2>
          <button 
            className="premium-icon-btn" 
            onClick={onClose}
            style={{ '--btn-color': '#ef4444' } as React.CSSProperties}
          >
            ✕
            <div className="btn-glow"></div>
          </button>
        </div>

        <div className="dashboard-tabs">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            {t('menu.overview')}
          </button>
          <button className={activeTab === 'loans' ? 'active' : ''} onClick={() => setActiveTab('loans')}>
            {t('finance.credit_status')}
          </button>
          <button className={activeTab === 'cashflow' ? 'active' : ''} onClick={() => setActiveTab('cashflow')}>
            {t('stats.cash_flow')}
          </button>
        </div>

        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="finance-cards">
                <div className="finance-card primary">
                  <span className="card-label">{t('finance.cash_on_hand')}</span>
                  <span className="card-value">${(financialData.cash / 100).toLocaleString()}</span>
                </div>
                <div className="finance-card">
                  <span className="card-label">{t('finance.total_assets')}</span>
                  <span className="card-value">${(financialData.totalAssets / 100).toLocaleString()}</span>
                </div>
                <div className="finance-card">
                  <span className="card-label">{t('finance.monthly_revenue')}</span>
                  <span className={`card-value ${financialData.monthlyRevenue >= 0 ? 'positive' : 'negative'}`}>
                    ${(financialData.monthlyRevenue / 100).toLocaleString()}
                  </span>
                </div>
                <div className="finance-card">
                  <span className="card-label">{t('finance.net_income_last_month')}</span>
                  <span className={`card-value ${financialData.netIncomeLastMonth >= 0 ? 'positive' : 'negative'}`}>
                    ${(financialData.netIncomeLastMonth / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="credit-section">
                <h3>{t('finance.credit_status')}</h3>
                <div className="credit-rating">
                  <div className="rating-display">
                    <span className="rating-label">{t('finance.credit_rating')}</span>
                    <div className="rating-bar">
                      <div className="rating-fill" style={{ width: `${currentFinances.rating}%` }}></div>
                    </div>
                    <span className="rating-value">{currentFinances.rating}/100</span>
                  </div>
                  <div className="limit-display" style={{ marginTop: '10px', fontSize: '0.9rem', opacity: 0.8 }}>
                    <span>{t('finance.credit_limit')}: </span>
                    <strong style={{ color: '#00d9a5' }}>${(currentFinances.limit / 100).toLocaleString()}</strong>
                    <span style={{ marginLeft: '15px' }}>{t('finance.debt')}: </span>
                    <strong style={{ color: '#ef4444' }}>${(currentFinances.debt / 100).toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Macro Economic Impact Analysis */}
              {financialData.macroData && (
                <div className="macro-insight-section">
                  <h3>📊 {t('finance.macro_insight')}</h3>
                  <div className="macro-top-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{t('finance.interest_rate')}</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgInterestRate > 8 ? '#ef4444' : '#f1f5f9' }}>
                        {financialData.macroData.avgInterestRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{t('stats.gdp_growth')}</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgGdpGrowth < 0 ? '#ef4444' : '#10b981' }}>
                        {financialData.macroData.avgGdpGrowth.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{t('stats.inflation')}</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgInflationRate > 5 ? '#ef4444' : '#f1f5f9' }}>
                        {financialData.macroData.avgInflationRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{t('stats.tax_rate')}</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f1f5f9' }}>
                        {financialData.macroData.avgTaxRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="macro-breakdown">
                    <div className="macro-stat net-income">
                      <span className="macro-label">{t('finance.reported_net_income')}</span>
                      <span className={`macro-value ${financialData.netIncomeLastMonth >= 0 ? 'positive' : 'negative'}`}>
                        ${(financialData.netIncomeLastMonth / 100).toLocaleString()}
                      </span>
                    </div>

                    <div className="macro-impact-divider" style={{ textAlign: 'center', margin: '15px 0', opacity: 0.5 }}>▼ {t('finance.erosion_impact_divider')}</div>

                    <div className="macro-impact-list">
                      <div className="macro-impact-item">
                        <div className="impact-header">
                          <span className="impact-icon">📈</span>
                          <span className="impact-name">{t('finance.inflation_impact')}</span>
                          <span className="impact-rate">({financialData.macroData.avgInflationRate.toFixed(2)}%)</span>
                        </div>
                        <span className="impact-value negative">
                          -${(financialData.macroData.inflationImpact / 100).toLocaleString()}
                        </span>
                      </div>
                      <div className="macro-impact-item">
                        <div className="impact-header">
                          <span className="impact-icon">🏛️</span>
                          <span className="impact-name">{t('finance.tax_erosion')}</span>
                          <span className="impact-rate">({financialData.macroData.avgTaxRate.toFixed(2)}%)</span>
                        </div>
                        <span className="impact-value negative">
                          -${(financialData.macroData.taxImpact / 100).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="macro-impact-divider" style={{ textAlign: 'center', margin: '10px 0', opacity: 0.5 }}>▼</div>

                    <div className="macro-stat operational-profit">
                      <span className="macro-label">{t('finance.operational_profit')}</span>
                      <span className={`macro-value ${financialData.macroData.operationalProfit >= 0 ? 'positive' : 'negative'}`}>
                        ${(financialData.macroData.operationalProfit / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="macro-insight-footer">
                    <div className="insight-text">
                      {financialData.macroData.avgGdpGrowth < 0 ? (
                        <span className="warning">🚨 {t('finance.recession_warning')}</span>
                      ) : financialData.macroData.avgInterestRate > 8 ? (
                        <span className="warning">⚠️ {t('finance.high_rates_warning')}</span>
                      ) : financialData.macroData.inflationImpact > financialData.netIncomeLastMonth * 0.1 ? (
                        <span className="warning">⚠️ {t('finance.high_inflation_warning')}</span>
                      ) : (
                        <span className="good">✓ {t('finance.macro_healthy')}</span>
                      )}
                    </div>
                    <div className="impact-percentage" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {t('finance.macro_impact')}: {((financialData.macroData.inflationImpact + financialData.macroData.taxImpact) / Math.max(1, Math.abs(financialData.netIncomeLastMonth)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'loans' && (
            <div className="loans-tab animate-fadeIn">
              <div className="sub-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button 
                  className={`sub-tab-btn ${financeSubTab === 'loans' ? 'active' : ''}`}
                  onClick={() => setFinanceSubTab('loans')}
                  style={{ padding: '8px 16px', background: financeSubTab === 'loans' ? 'rgba(0, d9, 165, 0.2)' : 'rgba(255,255,255,0.05)', border: financeSubTab === 'loans' ? '1px solid #00d9a5' : '1px solid transparent', borderRadius: '8px', color: financeSubTab === 'loans' ? '#00d9a5' : '#f1f5f9', cursor: 'pointer' }}
                >
                  Bank Loans
                </button>
                <button 
                  className={`sub-tab-btn ${financeSubTab === 'bonds' ? 'active' : ''}`}
                  onClick={() => setFinanceSubTab('bonds')}
                  style={{ padding: '8px 16px', background: financeSubTab === 'bonds' ? 'rgba(0, d9, 165, 0.2)' : 'rgba(255,255,255,0.05)', border: financeSubTab === 'bonds' ? '1px solid #00d9a5' : '1px solid transparent', borderRadius: '8px', color: financeSubTab === 'bonds' ? '#00d9a5' : '#f1f5f9', cursor: 'pointer' }}
                >
                  Corporate Bonds
                </button>
              </div>

              {financeSubTab === 'loans' && (
                <>
                  <div className="loan-calculator">
                    <h3>{t('finance.apply_for_loan')}</h3>
                    <div className="loan-input">
                      <label>{t('finance.loan_amount')}: ${(loanAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</label>
                      <input
                        type="range"
                        min="100000"
                        max={maxLoanAmount > 100000 ? maxLoanAmount : 100000}
                        step="10000"
                        value={loanAmount}
                        onChange={(e) => {
                           const val = parseInt(e.target.value);
                           setLoanAmount(val);
                        }}
                        disabled={maxLoanAmount <= 0}
                      />
                    </div>
                    <div className="loan-details">
                      <p>{t('finance.interest_rate')}: <strong>{projectedInterestRate.toFixed(2)}%</strong></p>
                      <p>{t('finance.monthly_payment')}: <strong>${(Math.floor(loanAmount * (projectedInterestRate / 100) / 12 + loanAmount / 24) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                      <p>{t('finance.loan_term')}: 24 {t('finance.months')}</p>
                    </div>
                    <button className="take-loan-btn" onClick={handleTakeLoan} disabled={maxLoanAmount <= 0 || currentFinances.rating < 30}>
                      {maxLoanAmount <= 0 ? "Credit Limit Reached" : t('finance.take_loan')}
                    </button>
                  </div>

                  <div className="active-loans">
                    <h3>{t('finance.active_loans')} ({activeLoans.length})</h3>
                    {activeLoans.length === 0 ? (
                      <div className="no-loans">{t('finance.no_active_loans')}</div>
                    ) : (
                      activeLoans.map(loan => (
                        <div key={loan.id} className="loan-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                          <div className="loan-info">
                            <div style={{ fontWeight: '700', color: '#f1f5f9' }}>${(loan.remaining / 100).toLocaleString()} {t('finance.remaining')}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{(loan.interestRate / 100).toFixed(1)}% APR • ${ (loan.monthlyPayment/100).toFixed(2) }/{t('finance.mo', { defaultValue: 'mo' })}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{loan.monthsRemaining} {t('finance.months')} {t('finance.remaining')}</div>
                          </div>
                          <button 
                            className="prepay-btn" 
                            onClick={() => handlePrepay(loan.id, loan.remaining)}
                            style={{ padding: '8px 16px', background: 'rgba(0,217,165,0.1)', border: '1px solid #00d9a5', borderRadius: '8px', color: '#00d9a5', cursor: 'pointer' }}
                          >
                            {t('finance.repay_full')}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {financeSubTab === 'bonds' && (
                <>
                  <div className="loan-calculator">
                    <h3>Issue Corporate Bonds</h3>
                    <div className="loan-input">
                      <label>Bond Issue Size: ${(bondAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</label>
                      <input
                        type="range"
                        min="1000000"
                        max={maxBondAmount > 1000000 ? maxBondAmount : 1000000}
                        step="500000"
                        value={bondAmount}
                        onChange={(e) => {
                           const val = parseInt(e.target.value);
                           setBondAmount(val);
                        }}
                        disabled={currentFinances.rating < 60 || maxBondAmount <= 0}
                      />
                    </div>
                    <div className="loan-details">
                      <p>Coupon Rate: <strong>{projectedInterestRate.toFixed(2)}%</strong> (Annual yield paid monthly)</p>
                      <p>Expected Issue Price: <strong>{(Math.floor(bondAmount * (1.0 - (100 - currentFinances.rating) * 0.002)) / 100).toLocaleString()}</strong> (Discounted for Risk)</p>
                      <p>Maturity: 60 Months (5 Years) — Principal repaid at end</p>
                    </div>
                    <button className="take-loan-btn" onClick={handleIssueBond} disabled={currentFinances.rating < 60 || maxBondAmount <= 0}>
                      {currentFinances.rating < 60 ? "Credit Rating Too Low (Req: 60+)" : maxBondAmount <= 0 ? "Debt Limit Reached" : "Issue Corporate Bonds"}
                    </button>
                  </div>

                  <div className="active-loans">
                    <h3>Active Corporate Bonds ({activeBonds.length})</h3>
                    {activeBonds.length === 0 ? (
                      <div className="no-loans">No active bonds issued.</div>
                    ) : (
                      activeBonds.map(bond => (
                        <div key={bond.id} className="loan-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: '4px solid #8b5cf6' }}>
                          <div className="loan-info">
                            <div style={{ fontWeight: '700', color: '#f1f5f9' }}>${(bond.faceValue / 100).toLocaleString()} Face Value</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{(bond.couponRate / 100).toFixed(1)}% Coupon • {bond.bondRating} Rated • Raised ${(bond.issuePrice/100).toLocaleString()}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{bond.monthsRemaining} Months to Maturity</div>
                          </div>
                          <div className="bond-status" style={{ fontSize: '0.8rem', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                            Interest Only
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div className="cashflow-tab animate-fadeIn">
              <div className="cashflow-header">
                <h3>{t('finance.monthly_cash_flow')}</h3>
                <p>{t('finance.income_statement_subtitle', { defaultValue: 'Comprehensive Income Statement (P&L)' })}</p>
              </div>
              
              <div className="cashflow-statement">
                {/* REVENUE SECTION */}
                <div className="cf-section-title">{t('finance.gross_revenue', { defaultValue: 'Gross Revenue' })}</div>
                <div className="cf-row revenue">
                  <span>{t('finance.sales_revenue')}</span>
                  <span className="positive">+${(financialData.monthlyRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                
                <div className="cf-divider"></div>
                
                {/* OPERATING EXPENSES SECTION */}
                <div className="cf-section-title">{t('finance.operating_expenses_opex', { defaultValue: 'Operating Expenses (OPEX)' })}</div>
                <div className="cf-row op-expense">
                  <span>{t('finance.facility_maintenance_rent', { defaultValue: 'Facility Maintenance & Rent' })}</span>
                  <span className="negative">-${(financialData.totalMonthlyMaintenance / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="cf-row op-expense">
                  <span>{t('finance.payroll_training', { defaultValue: 'Employee Payroll & Training' })}</span>
                  <span className="negative">-${(financialData.totalMonthlyPayroll / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="cf-row op-expense">
                  <span>{t('finance.executive_compensation', { defaultValue: 'Executive Compensation' })}</span>
                  <span className="negative">-${(financialData.totalExecutivePay / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="cf-row op-expense">
                  <span>{t('finance.marketing_advertising', { defaultValue: 'Marketing & Advertising' })}</span>
                  <span className="negative">-${(financialData.totalMarketingSpend / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="cf-row op-expense">
                  <span>{t('finance.rd_expenses_short', { defaultValue: 'Research & Development (R&D)' })}</span>
                  <span className="negative">-${(financialData.totalRDSpend / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {/* Estimate unclassified costs like Logistics, Shrinkage, Hiring Costs */}
                {(() => {
                    const classifiedExpenses = financialData.totalMonthlyMaintenance + financialData.totalMonthlyPayroll + financialData.totalExecutivePay + financialData.totalMarketingSpend + financialData.totalRDSpend;
                    const unclassified = financialData.accumulatedExpenses - classifiedExpenses;
                    if (unclassified > 0) {
                        return (
                          <div className="cf-row op-expense">
                            <span>{t('finance.logistics_shrinkage_misc', { defaultValue: 'Logistics, Shrinkage & Misc' })}</span>
                            <span className="negative">-${(unclassified / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )
                    }
                    return null;
                })()}
                
                <div className="cf-total-row">
                  <span>{t('finance.total_expenses')}</span>
                  <span className="negative">-${(financialData.accumulatedExpenses / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="cf-divider bold"></div>

                {/* NET INCOME */}
                <div className="cf-row final-net">
                  <span>{t('finance.net_income_last_month')}</span>
                  <span className={financialData.netIncomeLastMonth >= 0 ? 'positive' : 'negative'}>
                    ${(financialData.netIncomeLastMonth / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
