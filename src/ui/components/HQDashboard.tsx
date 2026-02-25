import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { defineQuery, addEntity, addComponent, removeEntity } from 'bitecs';
import { GameWorld } from '../../core/ecs/world';
import { Company, Executive, ExecutiveRole, HumanResources, Building, Position } from '../../core/ecs/components';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import './HQDashboard.css';

interface HQDashboardProps {
  world: GameWorld;
  onClose: () => void;
  onUpdate?: () => void;
}

type MgmtTab = 'executives' | 'policies' | 'directives' | 'workforce';

export function HQDashboard({ world, onClose, onUpdate }: HQDashboardProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MgmtTab>('executives');
  
  // Find player company ID
  const playerCompanyId = useMemo(() => {
    // We already know world.playerEntityId controls the Company ID generally.
    return world.playerEntityId;
  }, [world]);

  const [activeDirective, setActiveDirective] = useState<string | null>(() => {
     if (!playerCompanyId) return null;
     const current = Company.strategicDirective[playerCompanyId];
     if (current === 1) return 'quality';
     if (current === 2) return 'aggression';
     if (current === 3) return 'efficiency';
     return null;
  });

  const [activePolicies, setActivePolicies] = useState<number>(() => {
    if (!playerCompanyId) return 0;
    return Company.activePolicies[playerCompanyId] || 0;
  });

  // Query all executives
  const execQuery = defineQuery([Executive]);
  const allExecs = execQuery(world.ecsWorld);

  // Parse existing player executives
  const hiredExecs = useMemo(() => {
    const map = new Map<number, number>(); // <Role, EntityID>
    if (!playerCompanyId) return map;

    for (const id of allExecs) {
      if (Company.companyId[id] === playerCompanyId) {
        map.set(Executive.role[id], id);
      }
    }
    return map;
  }, [world, allExecs, playerCompanyId]);

  const ROLES = [
    {
      roleNum: ExecutiveRole.COO,
      title: 'COO',
      desc: 'Chief Operating Officer',
      perk: t('hq.perk_coo'),
      cost: 450000,
      skills: { mfg: 90, ret: 60, randD: 30, mktg: 40 }
    },
    {
      roleNum: ExecutiveRole.CTO,
      title: 'CTO',
      desc: 'Chief Technical Officer',
      perk: t('hq.perk_cto'),
      cost: 550000,
      skills: { mfg: 50, ret: 20, randD: 95, mktg: 30 }
    },
    {
      roleNum: ExecutiveRole.CMO,
      title: 'CMO',
      desc: 'Chief Marketing Officer',
      perk: t('hq.perk_cmo'),
      cost: 400000,
      skills: { mfg: 20, ret: 70, randD: 20, mktg: 90 }
    },
    {
      roleNum: ExecutiveRole.CFO,
      title: 'CFO',
      desc: 'Chief Financial Officer',
      perk: t('hq.perk_cfo'),
      cost: 500000,
      skills: { mfg: 40, ret: 40, randD: 40, mktg: 40 }
    },
    {
      roleNum: ExecutiveRole.CHRO,
      title: 'CHRO',
      desc: 'Chief Human Resources Officer',
      perk: t('hq.perk_chro'),
      cost: 350000,
      skills: { mfg: 40, ret: 60, randD: 40, mktg: 50 } 
    }
  ];

  const handleDirectiveSelect = (id: string) => {
    setActiveDirective(id);
    if (!playerCompanyId) return;

    // Map string IDs to component values
    const directiveMap: Record<string, number> = {
      'quality': 1,
      'aggression': 2,
      'efficiency': 3
    };

    Company.strategicDirective[playerCompanyId] = directiveMap[id] || 0;
    
    if (onUpdate) onUpdate();
    
    window.dispatchEvent(new CustomEvent('notification', { 
        detail: { message: t('hq.directives.updated'), type: 'success' } 
    }));
  };

  const handlePolicyToggle = (bitmask: number) => {
    if (!playerCompanyId) return;
    
    const currentFlags = Company.activePolicies[playerCompanyId] || 0;
    // Toggle the specific bit
    const newFlags = currentFlags ^ bitmask;
    
    Company.activePolicies[playerCompanyId] = newFlags;
    setActivePolicies(newFlags);

    if (onUpdate) onUpdate();
    
    // Quick translation mapping logic based on bit
    let noticeStr = 'hq.policies.updated';
    window.dispatchEvent(new CustomEvent('notification', { 
        detail: { message: t(noticeStr), type: 'info' } 
    }));
  };

  const handleHire = (roleInfo: typeof ROLES[0]) => {
    if (!playerCompanyId) return;
    
    if (world.cash < roleInfo.cost * 100) {
        window.dispatchEvent(new CustomEvent('notification', { 
          detail: { message: t('finance.insufficient_funds'), type: 'error' } 
        }));
        return;
    }

    world.cash -= roleInfo.cost * 100;

    const execId = addEntity(world.ecsWorld);
    addComponent(world.ecsWorld, Executive, execId);
    addComponent(world.ecsWorld, Company, execId);

    Company.companyId[execId] = playerCompanyId;
    Executive.role[execId] = roleInfo.roleNum;
    Executive.expertiseManufacturing[execId] = roleInfo.skills.mfg;
    Executive.expertiseRetailing[execId] = roleInfo.skills.ret;
    Executive.expertiseRD[execId] = roleInfo.skills.randD;
    Executive.expertiseMarketing[execId] = roleInfo.skills.mktg;
    Executive.salary[execId] = roleInfo.cost * 100;
    Executive.loyalty[execId] = 80;

    if (onUpdate) onUpdate();

    window.dispatchEvent(new CustomEvent('notification', { 
        detail: { message: t('hq.hired_success', { title: roleInfo.title }), type: 'success' } 
    }));
  };

  const handleFire = (roleNum: number) => {
    const execId = hiredExecs.get(roleNum);
    if (execId) {
        removeEntity(world.ecsWorld, execId);
        if (onUpdate) onUpdate();
        window.dispatchEvent(new CustomEvent('notification', { 
            detail: { message: t('hq.executive_let_go'), type: 'info' } 
        }));
    }
  };

  // Workforce analytics data
  const workforceMetrics = useMemo(() => {
    if (!world) return { pieData: [], barData: [], totals: { employees: 0, salary: 0, benefits: 0, training: 0 }, activeNodes: 0 };
    const hrQuery = defineQuery([HumanResources, Building]);
    const entities = hrQuery(world.ecsWorld);
    
    let totals = { employees: 0, salary: 0, benefits: 0, training: 0 };
    let splitting = { mfg: 0, ret: 0, rAndD: 0, office: 0 };
    let moraleSum = { mfg: 0, ret: 0, rAndD: 0, office: 0 };
    let counts = { mfg: 0, ret: 0, rAndD: 0, office: 0 };
    const myCities = new Set<number>();

    entities.forEach(id => {
      if (Company.companyId[id] !== playerCompanyId) return;

      const hc = HumanResources.headcount[id] || 0;
      totals.employees += hc;
      totals.salary += (HumanResources.salary[id] || 0) * hc;
      totals.benefits += (HumanResources.benefits[id] || 0) * hc;
      totals.training += HumanResources.trainingBudget[id] || 0;

      const type = Building.buildingTypeId[id];
      const m = HumanResources.morale[id] || 0;

      // Extract Position.cityId to track active cities
      // We assume Building has Position if it has HumanResources, which is typical for world map entities
      const cityId = Position.cityId[id];
      if (cityId > 0 && Building.isOperational[id] === 1) {
         myCities.add(cityId);
      }

      if (type < 10) { splitting.mfg += hc; moraleSum.mfg += m * hc; counts.mfg += hc; }
      else if (type < 20) { splitting.ret += hc; moraleSum.ret += m * hc; counts.ret += hc; }
      else { splitting.office += hc; moraleSum.office += m * hc; counts.office += hc; }
    });

    const pieData = [
      { name: 'Manufacturing', value: splitting.mfg, color: '#e94560' },
      { name: 'Retail', value: splitting.ret, color: '#70a1ff' },
      { name: 'Office/Mgmt', value: Math.max(1, splitting.office), color: '#ffa502' } // Ensure at least 1 for display empty state
    ].filter(d => d.value > 0);

    const barData = [
      { name: 'Mfg', morale: splitting.mfg > 0 ? moraleSum.mfg / splitting.mfg : 0 },
      { name: 'Retail', morale: splitting.ret > 0 ? moraleSum.ret / splitting.ret : 0 },
      { name: 'Office', morale: splitting.office > 0 ? moraleSum.office / splitting.office : 0 }
    ].filter(d => d.morale > 0);

    return { pieData, barData, totals, activeNodes: myCities.size };
  }, [world, world.tick, playerCompanyId]);

  return (
    <div className="hq-dashboard-overlay">
      <div className="hq-dashboard">
        <div className="dashboard-header hq-header-custom">
          <div className="hq-title-group">
            <span className="hq-icon">🏢</span>
            <div>
              <h2>{t('menu.internal_management')}</h2>
              <div className="hq-subtitle">Global Headquarters • {t('hq.org.hq_level')} 1</div>
            </div>
          </div>
          <button className="premium-icon-btn close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="hq-tabs-container">
          <button className={`hq-tab ${activeTab === 'executives' ? 'active' : ''}`} onClick={() => setActiveTab('executives')}>
            {t('hq.tabs.executives')}
          </button>
          <button className={`hq-tab ${activeTab === 'policies' ? 'active' : ''}`} onClick={() => setActiveTab('policies')}>
            {t('hq.tabs.policies')}
          </button>
          <button className={`hq-tab ${activeTab === 'directives' ? 'active' : ''}`} onClick={() => setActiveTab('directives')}>
            {t('hq.tabs.directives')}
          </button>
          <button className={`hq-tab ${activeTab === 'workforce' ? 'active' : ''}`} onClick={() => setActiveTab('workforce')}>
            {t('hq.tabs.workforce')}
          </button>
        </div>

        <div className="hq-content">
          {activeTab === 'executives' && (
            <div className="tab-pane animate-fadeIn">
              <p className="section-desc">{t('hq.recruit_desc')}</p>
              <div className="executive-grid">
                {ROLES.map(role => {
                  const entityId = hiredExecs.get(role.roleNum);
                  const isHired = entityId !== undefined;
                  const loyalty = isHired ? Executive.loyalty[entityId] : 0;
                  
                  return (
                    <div key={role.roleNum} className={`executive-card ${isHired ? 'hired' : ''}`}>
                      <div className="exec-header">
                         <div>
                           <h3 className="exec-role">{role.title}</h3>
                           <div className="exec-title">{role.desc}</div>
                         </div>
                         <div className="exec-status">{isHired ? t('hq.active') : t('hq.vacant')}</div>
                      </div>
                      
                      <div className="exec-perks">✨ {role.perk}</div>

                      {isHired && (
                        <div className="exec-meta-stats">
                          <div className="meta-stat">
                            <label>Loyalty</label>
                            <div className="meta-bar-bg"><div className="meta-bar-fill" style={{ width: `${loyalty}%`, background: '#10b981' }}></div></div>
                          </div>
                          <div className="meta-stat">
                            <label>Experience</label>
                            <div className="meta-bar-bg"><div className="meta-bar-fill" style={{ width: `65%`, background: '#3b82f6' }}></div></div>
                          </div>
                        </div>
                      )}

                      {!isHired && (
                        <div className="exec-stats">
                          <div className="exec-stat-row">
                            <span className="exec-stat-label">{t('hq.signing_bonus')}</span>
                            <span className="exec-stat-value">${(role.cost).toLocaleString()}</span>
                          </div>
                          <div className="exec-stat-row">
                            <span className="exec-stat-label">{t('hq.salary_monthly')}</span>
                            <span className="exec-stat-value">${(role.cost * 0.1).toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      <div className="exec-action">
                        {isHired ? (
                          <button className="btn-fire" onClick={() => handleFire(role.roleNum)}>{t('hq.fire_executive')}</button>
                        ) : (
                          <button className="btn-hire" onClick={() => handleHire(role)}>{t('hq.hire_candidate')}</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'directives' && (
            <div className="tab-pane animate-fadeIn">
              <p className="section-desc">{t('hq.directives.desc')}</p>
              <div className="directives-grid">
                <DirectiveCard 
                  id="quality"
                  title={t('hq.directives.quality_focus')}
                  desc={t('hq.directives.quality_desc')}
                  icon="💎"
                  active={activeDirective === 'quality'}
                  onSelect={() => handleDirectiveSelect('quality')}
                  t={t}
                />
                <DirectiveCard 
                  id="aggression"
                  title={t('hq.directives.aggression_focus')}
                  desc={t('hq.directives.aggression_desc')}
                  icon="🔥"
                  active={activeDirective === 'aggression'}
                  onSelect={() => handleDirectiveSelect('aggression')}
                  t={t}
                />
                <DirectiveCard 
                  id="efficiency"
                  title={t('hq.directives.efficiency_focus')}
                  desc={t('hq.directives.efficiency_desc')}
                  icon="⚙️"
                  active={activeDirective === 'efficiency'}
                  onSelect={() => handleDirectiveSelect('efficiency')}
                  t={t}
                />
              </div>
            </div>
          )}

          {activeTab === 'policies' && (
            <div className="tab-pane animate-fadeIn">
              <div className="policies-grid">
                <PolicyCard 
                  title={t('hq.policies.training_program')}
                  desc={t('hq.policies.training_desc')}
                  cost="$1,000,000"
                  icon="🎓"
                  active={(activePolicies & 1) === 1}
                  onToggle={() => handlePolicyToggle(1)}
                  t={t}
                />
                <PolicyCard 
                  title={t('hq.policies.automation')}
                  desc={t('hq.policies.automation_desc')}
                  cost="$2,500,000"
                  icon="🤖"
                  active={(activePolicies & 2) === 2}
                  onToggle={() => handlePolicyToggle(2)}
                  t={t}
                />
                <PolicyCard 
                  title={t('hq.policies.benefits')}
                  desc={t('hq.policies.benefits_desc')}
                  cost="$500,000"
                  icon="🏖️"
                  active={(activePolicies & 4) === 4}
                  onToggle={() => handlePolicyToggle(4)}
                  t={t}
                />
              </div>
            </div>
          )}

          {activeTab === 'workforce' && (
            <div className="tab-pane animate-fadeIn">
              <div className="workforce-layout">
                <div className="workforce-sidebar">
                  <div className="wf-kpi-card glass-panel">
                    <span className="wf-label">{t('hq.org.total_employees')}</span>
                    <span className="wf-value">{workforceMetrics.totals.employees.toLocaleString()}</span>
                  </div>
                  <div className="wf-kpi-card glass-panel">
                    <span className="wf-label">{t('hq.workforce.salary_expense')}</span>
                    <span className="wf-value text-red">-${(workforceMetrics.totals.salary / 100).toLocaleString()}</span>
                  </div>
                  <div className="wf-kpi-card glass-panel">
                    <span className="wf-label">{t('hq.workforce.training_investment')}</span>
                    <span className="wf-value text-blue">${(workforceMetrics.totals.training / 100).toLocaleString()}</span>
                  </div>
                  
                  {/* Global Footprint */}
                  <div className="global-footprint glass-panel">
                    <h4 className="wf-label mb-3">Global Footprint</h4>
                    <div className="city-dots-grid">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={`city-dot ${i < workforceMetrics.activeNodes ? 'active' : ''}`} title={`Region ${i+1}`}></div>
                      ))}
                    </div>
                    <div className="footprint-meta">Covering {workforceMetrics.activeNodes}/8 Global Nodes</div>
                  </div>
                </div>

                <div className="workforce-charts">
                  <div className="wf-chart-box glass-panel">
                    <h3>{t('hq.org.department_split')}</h3>
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={workforceMetrics.pieData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            animationBegin={0}
                            animationDuration={800}
                          >
                            {workforceMetrics.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number | string | undefined) => (typeof value === 'number' ? value.toLocaleString() : value)} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="wf-chart-box glass-panel">
                    <h3>{t('hq.workforce.morale_breakdown')}</h3>
                    <div style={{ height: '240px' }}>
                      <ResponsiveContainer>
                        <BarChart data={workforceMetrics.barData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                          <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(value: number | string | undefined) => [`${Math.floor(Number(value) || 0)}/100`, 'Morale']} />
                          <Bar dataKey="morale" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DirectiveCard({ title, desc, icon, active, onSelect, t }: any) {
  return (
    <div className={`directive-card ${active ? 'active' : ''}`} onClick={onSelect}>
      <div className="directive-icon">{icon}</div>
      <div className="directive-info">
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      {active && <div className="active-badge">{t('hq.directives.active')}</div>}
    </div>
  );
}

function PolicyCard({ title, desc, cost, icon, active, onToggle, t }: any) {
  return (
    <div className={`policy-card ${active ? 'active' : ''}`}>
      <div className="policy-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="policy-footer">
        <span className="policy-cost">{cost}/yr</span>
        <button className="btn-policy" onClick={onToggle}>
          {active ? t('hq.policies.active') : t('hq.policies.activate')}
        </button>
      </div>
    </div>
  );
}

