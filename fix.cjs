const fs = require('fs');
const file = 'src/services/aiService.ts';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(/gemini-3-flash-preview/g, 'gemini-2.5-flash');
fs.writeFileSync(file, data);
console.log('Done');
