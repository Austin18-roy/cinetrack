import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export function MoodGraph({ scores }: { scores: { thrill: number; story: number; emotion: number; pacing: number; intensity: number } }) {
  const chartData = [
    { subject: 'Thrill', value: scores.thrill },
    { subject: 'Story', value: scores.story },
    { subject: 'Emotion', value: scores.emotion },
    { subject: 'Pacing', value: scores.pacing },
    { subject: 'Intensity', value: scores.intensity }
  ];

  return (
    <div className="w-full h-[250px] flex justify-center items-center">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="rgba(255,255,255,0.2)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }} />
          <PolarRadiusAxis angle={30} domain={[0, 10]} max={10} tick={false} axisLine={false} />
          <Radar name="Mood" dataKey="value" stroke="#ffbf00" fill="#ffbf00" fillOpacity={0.4} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
