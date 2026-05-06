const fs = require('fs');
const file = 'src/services/aiService.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(/gemini-2\.5-flash/g, 'gemini-1.5-flash');
// Also update the cache version so it regenerates properly.
data = data.replace(/ai-verdict-v9-/g, 'ai-verdict-v10-');

fs.writeFileSync(file, data);
console.log('Done');
