import type { StudyChartData } from './visuals.mjs';
export function StudyChart({ chart, colors }: { chart: StudyChartData; colors: string[] }) {
  let min = Math.min(0, ...chart.series.flatMap(s => s.values)), max = Math.max(0, ...chart.series.flatMap(s => s.values));
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.12; if (min < 0) min -= pad; if (max > 0) max += pad;
  const Y = (v: number) => 300 - (v - min) / (max - min) * 240;
  const step = 590 / chart.labels.length, X = (i: number) => 70 + step * (i + 0.5);
  const number = (n: number) => Number(n.toPrecision(4)).toString();
  return <>
    <div style={{ overflowX: 'auto' }}><svg viewBox="0 0 720 400" role="img" aria-label={`${chart.xLabel}と${chart.yLabel}の${chart.type === 'bar' ? '棒' : '折れ線'}グラフ`} style={{ width: '100%', minWidth: 520, display: 'block', fontFamily: 'sans-serif', background: '#fff', color: '#243649', borderRadius: 8 }}>
      <text x="70" y="25" fontSize="17">{chart.yLabel}</text>
      {Array.from({ length: 5 }, (_, i) => {
        const v = min + (max - min) * i / 4;
        return <g key={i}><path d={`M70,${Y(v)}H660`} stroke="#dde4e9" /><text x="60" y={Y(v) + 5} fontSize="14" textAnchor="end">{number(v)}</text></g>;
      })}
      <path d={`M70,60V300 M70,${Y(0)}H660`} fill="none" stroke="#566574" strokeWidth="2" />
      {chart.labels.map((label, i) => <text key={i} x={X(i)} y="335" fontSize="15" textAnchor="middle">{label}</text>)}
      <text x="365" y="380" fontSize="18" textAnchor="middle">{chart.xLabel}</text>
      {chart.series.map((series, si) => {
        const color = colors[si];
        return <g key={si} fill={color} stroke={color}>
          {chart.type === 'line' && <path d={series.values.map((v, i) => `${i ? 'L' : 'M'}${X(i)},${Y(v)}`).join(' ')} strokeWidth="3" strokeDasharray={si === 1 ? '8 4' : undefined} fill="none" />}
          {series.values.map((v, i) => {
            const w = step * 0.7 / chart.series.length, x = X(i) - step * 0.35 + w * si;
            return <g key={i}><title>{`${series.name}・${chart.labels[i]}：${v}`}</title>
              {chart.type === 'bar' ? <rect x={x} y={Math.min(Y(0), Y(v))} width={w * 0.92} height={Math.abs(Y(v) - Y(0))} /> : <circle cx={X(i)} cy={Y(v)} r={5} />}
              <text x={chart.type === 'bar' ? x + w * 0.46 : X(i)} y={Y(v) + (v < 0 ? 20 : -10)} stroke="none" fontSize="14" textAnchor="middle">{number(v)}</text>
            </g>;
          })}
        </g>;
      })}
    </svg></div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>{chart.series.map((s, i) => <strong key={i} style={{ color: colors[i] }}>■ {s.name}</strong>)}</div>
    {chart.basis === 'example' && <small>数値は仕組みを理解するための説明用の例です。実測データではありません。</small>}
    <details style={{ marginTop: 10 }}><summary>グラフの数値を見る</summary><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr><th>{chart.xLabel}</th>{chart.series.map((s, i) => <th key={i}>{s.name}</th>)}</tr></thead><tbody>{chart.labels.map((label, i) => <tr key={i}><th>{label}</th>{chart.series.map((s, j) => <td key={j} style={{ textAlign: 'center' }}>{s.values[i]}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}
