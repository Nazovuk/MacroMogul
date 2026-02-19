export const getEconomicCycle = (tick: number) => {
  // Period: ~60 months (5 years) = 54,000 ticks
  const phase = Math.sin(tick / 8000);
  return {
    phase,
    isRecession: phase < -0.7,
    isBoom: phase > 0.7,
    valuationMultiple: 1.0 + (phase * 0.4), // 0.6x to 1.4x
    oilPriceBase: 70 + (phase * 30),        // $40 to $100 range
  };
};
