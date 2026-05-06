const fs = require('fs');
const file = 'src/services/aiService.ts';
let data = fs.readFileSync(file, 'utf8');

// replace generic cache keys with a new version
data = data.replace(/ai-verdict-v4-/g, 'ai-verdict-v5-');
data = data.replace(/ai-nlp-/g, 'ai-nlp-v2-');
data = data.replace(/ai-explain-/g, 'ai-explain-v2-');
data = data.replace(/dna-/g, 'dna-v2-');
data = data.replace(/pacing-heat-/g, 'pacing-heat-v2-');
data = data.replace(/rewatch-/g, 'rewatch-v2-');
data = data.replace(/binge-break-/g, 'binge-break-v2-');

fs.writeFileSync(file, data);
console.log('Done');
