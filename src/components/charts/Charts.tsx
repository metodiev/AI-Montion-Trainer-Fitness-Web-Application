import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DayStat, WeekStat } from '@/services/StatisticsService';

const axisStyle = { fill: '#64748b', fontSize: 10, fontWeight: 600 } as const;

const tooltipStyle = {
  background: '#0b0f18',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,
  fontSize: 12,
  color: '#e2e8f0',
  boxShadow: '0 20px 50px -20px rgba(0,0,0,0.9)',
} as const;

export function WeeklyXpChart({ data }: { data: DayStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8ff4d" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#c8ff4d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
        <YAxis tickLine={false} axisLine={false} tick={axisStyle} width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
          cursor={{ stroke: 'rgba(200,255,77,0.25)' }}
          formatter={(value) => [`${Number(value)} XP`, 'Earned']}
        />
        <Area
          type="monotone"
          dataKey="xp"
          stroke="#c8ff4d"
          strokeWidth={2.4}
          fill="url(#xpFill)"
          activeDot={{ r: 4, fill: '#c8ff4d', stroke: '#05070c', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TechniqueTrendChart({ data }: { data: WeekStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={axisStyle}
          width={48}
          tickFormatter={(value) => `${Number(value)}%`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
          formatter={(value) => [`${Number(value)}%`, 'Technique']}
        />
        <Line
          type="monotone"
          dataKey="averageScore"
          stroke="#a78bfa"
          strokeWidth={2.4}
          dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeeklyLoadChart({ data }: { data: DayStat[] }) {
  const max = Math.max(1, ...data.map((day) => day.minutes));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
        <YAxis tickLine={false} axisLine={false} tick={axisStyle} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          formatter={(value) => [`${Number(value)} min`, 'Training']}
        />
        <Bar dataKey="minutes" radius={[6, 6, 6, 6]} maxBarSize={38}>
          {data.map((entry) => (
            <Cell
              key={entry.dateKey}
              fill={entry.minutes >= max * 0.66 ? '#34d399' : entry.minutes > 0 ? '#38bdf8' : 'rgba(255,255,255,0.08)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
