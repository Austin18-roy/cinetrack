const fs = require('fs');
let content = fs.readFileSync('src/services/aiService.ts', 'utf8');

content = content.replace(/ai-verdict-v3-/g, 'ai-verdict-v4-');
// And make the fallback itself more specific!
content = content.replace(/pros\.push\("Highly praised by audiences for its compelling execution"\);/g, 'pros.push("The cinematic execution is highly praised by broader audiences");');
content = content.replace(/pros\.push\("Strong emotional storytelling and character depth"\);/g, 'pros.push("Deeply emotional storytelling with complex character arcs");');

fs.writeFileSync('src/services/aiService.ts', content);
console.log("Success");
