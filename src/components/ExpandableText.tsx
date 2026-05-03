import React, { useState } from 'react';

export function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!text) return null;

  const isLong = text.length > 250;
  
  return (
    <div className="description">
      <p className="text-zinc-300 leading-relaxed text-sm md:text-base">
        {expanded || !isLong ? text : text.slice(0, 250) + "..."}
      </p>
      
      {isLong && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-primary font-bold text-sm mt-2 hover:underline focus:outline-none"
        >
          {expanded ? "Show Less" : "Read More"}
        </button>
      )}
    </div>
  );
}
