import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace standard tailwind hardcoded colors to semantic theme colors
content = content.replace(/bg-zinc-950/g, 'bg-background');
content = content.replace(/bg-zinc-900/g, 'bg-card');
content = content.replace(/bg-zinc-800/g, 'bg-muted');
content = content.replace(/bg-zinc-500/g, 'bg-muted');

content = content.replace(/text-zinc-100/g, 'text-foreground');
content = content.replace(/text-zinc-400|text-zinc-500/g, 'text-muted-foreground');

content = content.replace(/border-white\/10|border-white\/5|border-zinc-500\/20/g, 'border-border');

content = content.replace(/bg-\[\#0a0a0a\]/g, 'bg-background');
content = content.replace(/bg-\[\#1a1a1a\]/g, 'bg-card');
content = content.replace(/bg-\[\#050505\]/g, 'bg-background');

// Also update amber-specific colors that might be brand-based
content = content.replace(/text-amber-500/g, 'text-primary');
content = content.replace(/bg-amber-500/g, 'bg-primary');
content = content.replace(/text-brand-amber/g, 'text-primary');
content = content.replace(/bg-brand-amber/g, 'bg-primary');
content = content.replace(/border-brand-amber/g, 'border-primary');
content = content.replace(/ring-brand-amber/g, 'ring-primary');
content = content.replace(/shadow-brand-amber/g, 'shadow-primary');

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('Colors replaced in App.tsx');
