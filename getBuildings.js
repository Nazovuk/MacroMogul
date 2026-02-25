const fs = require('fs');
const scenarios = JSON.parse(fs.readFileSync('src/core/data/scenarios.json', 'utf8'));
const buildings = new Set();
scenarios.forEach(s => {
  s.buildings.split('\n').forEach(line => {
    if (line.trim()) {
      const parts = line.split(',');
      if (parts.length > 2) {
        buildings.add(parts[1]);
      }
    }
  });
});
const bObj = {};
buildings.forEach(b => bObj[b] = b);
console.log(JSON.stringify(bObj, null, 2));
