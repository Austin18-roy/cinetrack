const fs = require('fs');
let content = fs.readFileSync('src/services/aiService.ts', 'utf8');

// remove GEMINI_RATE_LIMIT_MS logic entirely
content = content.replace(/const now = Date.now\(\);\n  if \(now - lastGeminiCall < GEMINI_RATE_LIMIT_MS\) \{[\s\S]*?lastGeminiCall = Date\.now\(\);\n/, '');

// Clean up unused variables
content = content.replace(/let lastGeminiCall = 0;\nconst GEMINI_RATE_LIMIT_MS = 2000;\n/, '');

// Clean up fallback error logging string bloat since it returns fallback anyway
const errStr = /    let errorMessage = "AI engine failed to connect\."[\s\S]*?return fallback\(\);\n  \}/;
content = content.replace(errStr, 'return fallback();\n  }');

fs.writeFileSync('src/services/aiService.ts', content);
console.log("Success");
