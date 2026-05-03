const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function DetailModal({')) {
    start = i;
    break;
  }
}

let braceCount = 0;
let end = -1;
for (let i = start; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') braceCount++;
    if (line[j] === '}') braceCount--;
  }
  if (braceCount === 0 && start !== -1) {
    end = i;
    break;
  }
}
fs.writeFileSync('modal.txt', lines.slice(start, end + 1).join('\n'));
console.log('done, lines:', start + 1, 'to', end + 1);
