import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Pattern: setSelectedItem(x); setIsDetailModalOpen(true);
content = content.replace(/setSelectedItem\(([^)]+)\);\s*setIsDetailModalOpen\(true\);/g, 'handleSelectItem($1);');

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('App.tsx updated');
