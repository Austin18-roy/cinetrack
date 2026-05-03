import React, { useEffect, useState } from "react";
import { Play } from "lucide-react";

export function Intro() {
  const [show, setShow] = useState(true);
  
  useEffect(() => {
    // Hide after animation completes
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, []);
  
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-black flex justify-center items-center z-[99999] pointer-events-none">
      <div className="flex flex-col items-center">
        <h1 
          className="text-6xl md:text-8xl font-black text-primary tracking-[0.2em] relative"
          style={{ animation: 'boom 2.2s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
        >
          BINGE
        </h1>
      </div>
      <style>{`
        @keyframes boom {
          0% {
            transform: scale(0.8);
            opacity: 0;
            text-shadow: 0 0 0 rgba(255,59,48,0);
          }
          40% {
            transform: scale(1.1);
            opacity: 1;
            text-shadow: 0 0 40px rgba(255,59,48,1);
          }
          80% {
            transform: scale(1.2);
            text-shadow: 0 0 80px rgba(255,59,48,0.8);
            opacity: 1;
          }
          100% {
            transform: scale(3);
            opacity: 0;
            text-shadow: 0 0 120px rgba(255,59,48,0);
          }
        }
      `}</style>
    </div>
  );
}
