const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldNav = `{[
              { id: 'home', label: 'Assistant', icon: Sparkles },
              { id: 'explore', label: 'Explore', icon: Compass },
              { id: 'watchlist', label: 'Watchlist', icon: Clock },
              { id: 'history', label: 'History', icon: History },
              { id: 'stats', label: 'Insights', icon: LayoutDashboard },
              { id: 'settings', label: 'Settings', icon: Settings },
            ]`;
const newNav = `{[
              { id: 'home', label: 'Home' },
              { id: 'tv', label: 'TV Shows' },
              { id: 'movie', label: 'Movies' },
              { id: 'upcoming', label: 'New & Popular' },
              { id: 'watchlist', label: 'My List' },
            ]`;

code = code.replace(oldNav, newNav);

const oldNavClassRegex = /className=\{`flex items-center gap-2 px-5 py-2.5 rounded-xl text-\[11px\] font-black uppercase tracking-widest transition-all duration-300 font-display \$\{[\s\S]*?\}\`\}/;
const newNavClass = `className={\`flex items-center gap-2 px-4 py-2 text-[14px] font-medium transition-all duration-300 \${
                  activeTab === tab.id 
                    ? 'text-white' 
                    : 'text-zinc-300 hover:text-zinc-400'
                }\`}`;
                
code = code.replace(oldNavClassRegex, newNavClass);
code = code.replace(/<tab\.icon className="w-4 h-4" \/>/g, "");

fs.writeFileSync('src/App.tsx', code);
