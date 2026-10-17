import type { StudyVisual, Graph } from './visuals.mjs';
import { curveFormula, graphData } from './visuals.mjs';
import { MathText } from './MathText';
import { StudyChart } from './StudyChart';

export function studyPalette(ink: string) {
  const dark = /^#[a-f\d]{6}$/i.test(ink) && parseInt(ink.slice(1, 3), 16) > 150;
  return dark ? { input: '#8fbeff', operation: '#ffc181', result: '#8ed6ae', plain: ink, example: '#8fbeff', warning: '#ffc181', summary: '#8ed6ae', neutral: ink }
    : { input: '#215a9c', operation: '#a24b15', result: '#256348', plain: ink, example: '#215a9c', warning: '#a24b15', summary: '#256348', neutral: ink };
}
function Plot({ graph, colors }: { graph: Graph; colors: string[] }) {
  const data = graphData(graph);
  if (!data) return <p>この範囲には描ける値がありません。</p>;
  const X = (x: number) => 64 + (x - graph.xMin) / (graph.xMax - graph.xMin) * 600;
  const Y = (y: number) => 286 - (y - data.min) / (data.max - data.min) * 254;
  const number = (n: number) => Number(n.toPrecision(3)).toString();
  return <>
    <div style={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}><svg viewBox="0 0 700 330" role="img" aria-label={graph.curves.map(curveFormula).join('、')} style={{ display: 'block', width: '100%', minWidth: 520, height: 'auto', fontFamily: 'sans-serif' }}>
      <title>{graph.curves.map(curveFormula).join('、')}</title>
      {Array.from({ length: 5 }, (_, i) => {
        const x = graph.xMin + (graph.xMax - graph.xMin) * i / 4, y = data.min + (data.max - data.min) * i / 4;
        return <g key={i} fill={colors[3]} fontSize="14"><path d={`M${X(x)},32V286 M64,${Y(y)}H664`} fill="none" stroke="currentColor" opacity="0.12" />
          <text x={X(x)} y="312" textAnchor="middle">{number(x)}</text><text x="55" y={Y(y) + 5} textAnchor="end">{number(y)}</text></g>;
      })}
      <path d={`M64,${Y(Math.max(data.min, Math.min(data.max, 0)))}H664 M${X(Math.max(graph.xMin, Math.min(graph.xMax, 0)))},32V286`} stroke={colors[3]} fill="none" opacity="0.5" />
      <text x="680" y="310" fill={colors[3]}>x</text><text x="46" y="20" fill={colors[3]}>y</text>
      {data.curves.map((curve, index) => {
        let move = true;
        const d = curve.points.map(point => {
          if (point.y === null) { move = true; return ''; }
          const command = `${move ? 'M' : 'L'}${X(point.x).toFixed(2)},${Y(point.y).toFixed(2)}`; move = false; return command;
        }).join(' ');
        return <path key={index} d={d} fill="none" stroke={colors[index]} strokeWidth="3" strokeDasharray={index === 1 ? '8 4' : undefined} />;
      })}
    </svg></div>
    {data.curves.some(curve => curve.points.some(point => point.y === null)) && <small>定義域外や、表示範囲を大きく超える値は省略しています。</small>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>{graph.curves.map((curve, i) => <div key={i} style={{ color: colors[i] }}><strong>{i === 1 ? '┄' : '━'} <MathText text={curveFormula(curve)} formula /></strong>{!/[=＝^]|\\/.test(curve.label) && <div style={{ fontSize: '0.82em' }}><MathText text={curve.label} /></div>}</div>)}</div>
  </>;
}
export function StudyFigure({ visual, ink, background }: { visual: StudyVisual; ink: string; background: string }) {
  const palette = studyPalette(ink);
  return <figure style={{ margin: '22px 0 30px', padding: 'clamp(12px, 2vw, 24px)', border: `${visual.kind === 'formula' ? 3 : 1}px solid ${palette.result}`, borderRadius: 12, background, color: ink }}>
    <div style={{ color: palette.result, fontSize: '0.78em', fontWeight: 800, marginBottom: 6 }}>{visual.supplement ? '補足図解・' : ''}{({ graph: 'グラフで見る', chart: '数値をグラフで比べる', flow: '流れ・関係で見る', comparison: '概念・具体例を比べる', formula: '覚えておきたい公式', illustration: '挿絵で理解する' })[visual.kind]}</div>
    <h3 style={{ fontSize: '1.1em', margin: '0 0 18px' }}><MathText text={visual.title} /></h3>
    {visual.kind === 'illustration' && visual.imageUrl && <img src={visual.imageUrl} alt={`${visual.title}。${visual.caption}`} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8, background: '#fff' }} />}
    {visual.kind === 'graph' && visual.graph && <Plot graph={visual.graph} colors={[palette.input, palette.operation, palette.result, ink]} />}
    {visual.kind === 'chart' && visual.chart && <StudyChart chart={visual.chart} colors={['#215a9c', '#a24b15', '#256348']} />}
    {visual.kind === 'comparison' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 14 }}>{visual.nodes.map((node, i) => {
      const color = [palette.input, palette.operation, palette.result][i % 3];
      return <div key={i} style={{ border: `2px solid ${color}`, borderRadius: 14, padding: 18 }}>
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${color}`, color, display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 12 }}>{i + 1}</div>
        <strong style={{ color }}><MathText text={node.label} /></strong>
        <div style={{ marginTop: 12, fontSize: '0.92em' }}><MathText text={node.detail} /></div>
      </div>;
    })}</div>}
    {visual.kind === 'flow' && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch', maxWidth: 520, margin: '0 auto' }}>{visual.nodes.map((node, i) => <div key={i}>
      {i > 0 && <div aria-hidden style={{ textAlign: 'center', color: palette.result }}>↓</div>}
      <div style={{ padding: '12px 16px', border: `2px solid ${[palette.input, palette.operation, palette.result][i % 3]}`, borderRadius: 8 }}>
        <strong style={{ color: [palette.input, palette.operation, palette.result][i % 3] }}>{i + 1}. <MathText text={node.label} /></strong><div style={{ fontSize: '0.9em', marginTop: 4 }}><MathText text={node.detail} /></div>
      </div>
    </div>)}</div>}
    {visual.kind === 'formula' && <div style={{ display: 'grid', gap: 18 }}>{visual.terms.map((term, i) => <div key={i} style={{ borderTop: i ? '1px solid currentColor' : undefined, paddingTop: i ? 16 : 0 }}>
      <div className="study-math-scroll" style={{ fontSize: '1.25em', fontWeight: 700, lineHeight: 1.8, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' }}><MathText text={term.text} formula /></div>
      {term.meaning && <div style={{ marginTop: 8, fontSize: '0.9em', lineHeight: 1.8 }}><MathText text={term.meaning} /></div>}
    </div>)}</div>}
    <figcaption style={{ fontSize: '0.9em', lineHeight: 1.8, marginTop: 16 }}><MathText text={visual.caption} /></figcaption>
  </figure>;
}
