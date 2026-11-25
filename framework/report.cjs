'use strict';
const {fs,path,atomic,writeJSON}=require('./core.cjs');
const {pngPath}=require('./dataset.cjs');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=value=>value===null?'—':(value*100).toFixed(1)+'%';
function table(title,groups){
  const rows=Object.entries(groups).map(([name,g])=>'<tr><th>'+escape(name)+'</th><td>'+g.correct+' / '+g.total+
    '</td><td>'+percent(g.accuracy)+'</td><td>'+percent(g.coverage)+'</td><td>'+percent(g.style)+'</td><td>'+percent(g.change)+'</td></tr>').join('');
  return '<h2>'+title+'</h2><div class="scroll"><table><thead><tr><th>Group</th><th>Correct</th><th>Accuracy</th><th>Coverage</th><th>Restyled pair</th><th>Edited pair</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
async function writeReport(out,dataset,r){
  const misses=r.results.filter(x=>!x.correct).slice(0,6),cards=[];
  for(const row of misses){
    const image=(await fs.readFile(pngPath(dataset,row.id))).toString('base64');
    cards.push('<article><img alt="'+escape(row.variant)+' evaluation image" src="data:image/png;base64,'+image+'"><div><small>'+escape(row.family+' / '+row.variant)+'</small><h3>'+escape(row.prompt)+'</h3><p>Model <b>'+escape(row.raw??row.error??row.status)+'</b> · Verified <b>'+escape(row.expected)+'</b></p></div></article>');
  }
  const gates=r.checks.map(c=>'<li>'+escape(c.metric)+' ≥ '+percent(c.min)+' · '+percent(c.actual)+' observed · '+(c.passed?'pass':'fail')+'</li>').join('');
  const body='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visual Task Factory · Benchmark report</title><style>body{font:16px/1.55 system-ui,sans-serif;color:#252234;background:#f7f6fa;margin:0}main{max-width:1020px;margin:auto;padding:36px 20px 64px}h1{font-size:clamp(32px,5vw,54px);letter-spacing:-.055em;line-height:1.1;margin:12px 0}h2{margin-top:30px;font-size:21px}h3{font-size:17px;line-height:1.4}small,code{color:#665c7c;overflow-wrap:anywhere}.stats{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.stats span,article,.scroll{border:1px solid #dfdbe7;border-radius:10px;background:white}.stats span{padding:12px 18px}.stats b{display:block;font-size:24px}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:9px 12px;border-bottom:1px solid #e6e2ed;white-space:nowrap}thead{background:#eeebf7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}article{overflow:hidden}article img{width:100%;display:block}article div{padding:12px 15px}article p{overflow-wrap:anywhere}</style><main><small>VISUAL TASK FACTORY</small><h1>Benchmark report</h1><p>'+escape(r.suite)+' · '+escape(r.adapter.model)+' · <b>'+escape(r.status)+'</b></p><div class="stats"><span>Answer accuracy<b>'+percent(r.overall.accuracy)+'</b></span><span>Answered<b>'+r.overall.responded+' / '+r.overall.total+'</b></span><span>Restyled pairs<b>'+r.overall.styleCorrect+' / '+r.overall.pairs+'</b></span><span>Edited pairs<b>'+r.overall.changeCorrect+' / '+r.overall.pairs+'</b></span></div>'+table('By skill',r.byFamily)+table('By difficulty',r.byDifficulty)+table('By question',r.byQuestion)+table('By image variant',r.byVariant)+'<p>Pair scores require correct responses to both the original and the corresponding variant. Unavailable responses score zero against the planned image total.</p><h2>Quality gates</h2><ul>'+ (gates||'<li>No accuracy thresholds configured.</li>')+'</ul><h2>Failure examples</h2>'+(cards.length?'<div class="grid">'+cards.join('')+'</div>':'<p>All responses matched the verified answers.</p>')+'<p>Dataset fingerprint <code>'+escape(r.dataset)+'</code></p></main></html>';
  await atomic(path.join(out,'report.html'),body);
  await writeJSON(path.join(out,'report.json'),r);
}
module.exports={writeReport,percent};
