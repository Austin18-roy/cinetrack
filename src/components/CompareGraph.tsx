import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

export function CompareGraph({ 
  movieA, 
  movieB, 
  scoresA, 
  scoresB 
}: { 
  movieA: string; 
  movieB: string; 
  scoresA: any; 
  scoresB: any; 
}) {
  const chartData = [
    { subject: 'Thrill', A: scoresA.thrill || 5, B: scoresB.thrill || 5 },
    { subject: 'Story', A: scoresA.story || 5, B: scoresB.story || 5 },
    { subject: 'Emotion', A: scoresA.emotion || 5, B: scoresB.emotion || 5 },
    { subject: 'Pacing', A: scoresA.pacing || 5, B: scoresB.pacing || 5 },
    { subject: 'Intensity', A: scoresA.intensity || 5, B: scoresB.intensity || 5 }
  ];

  return (
    <div className="w-full h-[300px] flex justify-center items-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="rgba(255,255,255,0.2)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} max={10} tick={false} axisLine={false} />
          <Radar name={movieA} dataKey="A" stroke="#ffbf00" fill="#ffbf00" fillOpacity={0.4} />
          <Radar name={movieB} dataKey="B" stroke="#00f0ff" fill="#00f0ff" fillOpacity={0.4} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
