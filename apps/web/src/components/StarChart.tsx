import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useI18n } from '../i18n';

export default function StarChart({ data }: { data: Array<{ captured_on: string; stars: number }> }) {
  const { t } = useI18n();
  if (data.length < 2) {
    return <p className="text-sm text-muted">{t('chart.notEnough')}</p>;
  }

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <XAxis dataKey="captured_on" tick={{ fontSize: 10, fill: '#8b949e' }} tickFormatter={(d) => d.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: '#8b949e' }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
          />
          <Line type="monotone" dataKey="stars" stroke="#2f81f7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
