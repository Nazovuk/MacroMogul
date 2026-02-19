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
  CityEconomicData,
  Position
} from '../../core/ecs/components';
import './FinancialDashboard.css';

interface FinancialDashboardProps {
  world: GameWorld;
  onClose: () => void;
}

interface Loan {
  id: number;
  amount: number;
  interestRate: number;
  monthlyPayment: number;
  remainingMonths: number;
  totalRemaining: number;
}

export function FinancialDashboard({ world, onClose }: FinancialDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'loans' | 'cashflow'>('overview');
  const [loanAmount, setLoanAmount] = useState(1000000);
  const [loans, setLoans] = useState<Loan[]>([]);
  const creditRating = 50;

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
      if (Company.companyId[id] === 1 && Building.isOperational[id] === 1) {
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
      if (Company.companyId[id] === 1) {
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
            totalInventoryValue += amount * product.basePrice;
          }
        }
      }
    });

    const companyQuery = defineQuery([Company]);
    const companies = companyQuery(world.ecsWorld);
    let playerCompanyId = 0;
    for(const eid of companies) {
        if (Company.companyId[eid] === world.playerEntityId) {
            playerCompanyId = eid;
            break;
        }
    }
    
    // Use actual Company component data for financial metrics
    const monthlyRevenue = playerCompanyId ? (Company.revenueLastMonth[playerCompanyId] || 0) : 0;
    const accumulatedExpenses = playerCompanyId ? (Company.expensesLastMonth[playerCompanyId] || 0) : 0;
    const netIncomeLastMonth = playerCompanyId ? (Company.netIncomeLastMonth[playerCompanyId] || 0) : 0;

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
      netIncome: netIncomeLastMonth,
      netIncomeLastMonth,
      totalInventoryValue,
      totalBuildingValue,
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
    const baseAmount = 10000000;
    const ratingMultiplier = creditRating / 50;
    return Math.floor(baseAmount * ratingMultiplier);
  }, [creditRating]);

  const interestRate = useMemo(() => {
    return 15 - (creditRating / 10);
  }, [creditRating]);

  const handleTakeLoan = () => {
    const newLoan: Loan = {
      id: Date.now(),
      amount: loanAmount,
      interestRate,
      monthlyPayment: Math.floor(loanAmount * (interestRate / 100) / 12) + Math.floor(loanAmount / 24),
      remainingMonths: 24,
      totalRemaining: loanAmount
    };
    
    setLoans(prev => [...prev, newLoan]);
    world.cash += loanAmount;
  };

  return (
    <div className="financial-dashboard-overlay">
      <div className="financial-dashboard">
        <div className="dashboard-header">
          <h2>💰 {t('finance.comprehensive_view')}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
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
                      <div className="rating-fill" style={{ width: `${creditRating}%` }}></div>
                    </div>
                    <span className="rating-value">{creditRating}/100</span>
                  </div>
                </div>
              </div>

              {/* Macro Economic Impact Analysis */}
              {financialData.macroData && (
                <div className="macro-insight-section">
                  <h3>📊 {t('finance.macro_insight') || 'Macro Economic Impact'}</h3>
                  <div className="macro-top-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Interest Rate</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgInterestRate > 8 ? '#ef4444' : '#f1f5f9' }}>
                        {financialData.macroData.avgInterestRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>GDP Growth</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgGdpGrowth < 0 ? '#ef4444' : '#10b981' }}>
                        {financialData.macroData.avgGdpGrowth.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Inflation</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: financialData.macroData.avgInflationRate > 5 ? '#ef4444' : '#f1f5f9' }}>
                        {financialData.macroData.avgInflationRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="macro-mini-card" style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>Tax Rate</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f1f5f9' }}>
                        {financialData.macroData.avgTaxRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="macro-breakdown">
                    <div className="macro-stat net-income">
                      <span className="macro-label">{t('finance.reported_net_income') || 'Reported Net Income'}</span>
                      <span className={`macro-value ${financialData.netIncomeLastMonth >= 0 ? 'positive' : 'negative'}`}>
                        ${(financialData.netIncomeLastMonth / 100).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="macro-impact-divider" style={{ textAlign: 'center', margin: '10px 0', opacity: 0.5 }}>▼ Impact of Erosion & Taxes</div>
                    
                    <div className="macro-impact-list">
                      <div className="macro-impact-item">
                        <div className="impact-header">
                          <span className="impact-icon">📈</span>
                          <span className="impact-name">{t('finance.inflation_impact') || 'Inflation Impact'}</span>
                          <span className="impact-rate">({financialData.macroData.avgInflationRate.toFixed(2)}%)</span>
                        </div>
                        <span className="impact-value negative">
                          -${(financialData.macroData.inflationImpact / 100).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="macro-impact-item">
                        <div className="impact-header">
                          <span className="impact-icon">🏛️</span>
                          <span className="impact-name">{t('finance.tax_impact') || 'Tax Impact'}</span>
                          <span className="impact-rate">({financialData.macroData.avgTaxRate.toFixed(1)}%)</span>
                        </div>
                        <span className="impact-value negative">
                          -${(financialData.macroData.taxImpact / 100).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="macro-impact-divider" style={{ textAlign: 'center', margin: '10px 0', opacity: 0.5 }}>▼</div>
                    
                    <div className="macro-stat operational-profit">
                      <span className="macro-label">{t('finance.operational_profit') || 'Operational Profit'}</span>
                      <span className={`macro-value ${financialData.macroData.operationalProfit >= 0 ? 'positive' : 'negative'}`}>
                        ${(financialData.macroData.operationalProfit / 100).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="macro-insight-footer">
                    <div className="insight-text">
                      {financialData.macroData.avgGdpGrowth < 0 ? (
                        <span className="warning">🚨 {t('finance.recession_warning') || 'ECONOMY IN RECESSION: Demand Falling'}</span>
                      ) : financialData.macroData.avgInterestRate > 8 ? (
                        <span className="warning">⚠️ {t('finance.high_rates_warning') || 'High interest rates: Consider paying down debt'}</span>
                      ) : financialData.macroData.inflationImpact > financialData.netIncomeLastMonth * 0.1 ? (
                        <span className="warning">⚠️ {t('finance.high_inflation_warning') || 'High inflation significantly impacting profits'}</span>
                      ) : (
                        <span className="good">✓ {t('finance.macro_healthy') || 'Macro conditions favorable'}</span>
                      )}
                    </div>
                    <div className="impact-percentage" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {t('finance.macro_impact') || 'Macro Impact'}: {((financialData.macroData.inflationImpact + financialData.macroData.taxImpact) / Math.max(1, Math.abs(financialData.netIncomeLastMonth)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'loans' && (
            <div className="loans-tab">
              <div className="loan-calculator">
                <h3>{t('finance.apply_for_loan')}</h3>
                <div className="loan-input">
                  <label>{t('finance.loan_amount')}: ${(loanAmount / 100).toLocaleString()}</label>
                  <input
                    type="range"
                    min="100000"
                    max={maxLoanAmount}
                    step="10000"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(parseInt(e.target.value))}
                  />
                </div>
                <div className="loan-details">
                  <p>{t('finance.interest_rate')}: <strong>{interestRate.toFixed(1)}%</strong></p>
                  <p>{t('finance.monthly_payment')}: <strong>${Math.floor(loanAmount * (interestRate / 100) / 12 + loanAmount / 24).toLocaleString()}</strong></p>
                  <p>Term: 24 months</p>
                </div>
                <button className="take-loan-btn" onClick={handleTakeLoan}>
                  {t('finance.take_loan')}
                </button>
              </div>

              <div className="active-loans">
                <h3>{t('finance.active_loans')} ({loans.length})</h3>
                {loans.length === 0 ? (
                  <div className="no-loans">{t('finance.no_active_loans')}</div>
                ) : (
                  loans.map(loan => (
                    <div key={loan.id} className="loan-card">
                      <span>${(loan.amount / 100).toLocaleString()} at {loan.interestRate.toFixed(1)}% APR</span>
                      <span>{loan.remainingMonths} months remaining</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div className="cashflow-tab">
              <h3>{t('finance.monthly_cash_flow')}</h3>
              <div className="cashflow-statement">
                <div className="cf-row revenue">
                  <span>{t('finance.sales_revenue')}</span>
                  <span className="positive">+${(financialData.monthlyRevenue / 100).toLocaleString()}</span>
                </div>
                <div className="cf-row">
                  <span>{t('finance.total_expenses')}</span>
                  <span className="negative">-${(financialData.accumulatedExpenses / 100).toLocaleString()}</span>
                </div>
                <div className="cf-row">
                  <span>{t('finance.projected_maintenance')}</span>
                  <span className="negative">-${(financialData.totalMonthlyMaintenance / 100).toLocaleString()}</span>
                </div>
                <div className="cf-row">
                  <span>{t('finance.payroll_training')}</span>
                  <span className="negative">-${(financialData.totalMonthlyPayroll / 100).toLocaleString()}</span>
                </div>
                <div className="cf-row total">
                  <span>{t('finance.net_income_last_month')}</span>
                  <span className={financialData.netIncomeLastMonth >= 0 ? 'positive' : 'negative'}>
                    ${(financialData.netIncomeLastMonth / 100).toLocaleString()}
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
