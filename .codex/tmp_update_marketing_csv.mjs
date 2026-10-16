import fs from 'node:fs/promises';
import { Workbook } from '@oai/artifact-tool';

const fbPath = 'D:/Channel/Believers Sword/Leads/facebook_groups.csv';
const redditPath = 'D:/Channel/Believers Sword/Leads/reddit_groups.csv';
const updates = new Map([
  ['784469168858283', '2026-09-20 posted/visible'],
  ['1818886388776371', '2026-09-20 posted/visible'],
  ['1706952533789161', '2026-09-20 submitted - user-confirmed, outcome not visible in search'],
  ['2701873479991333', '2026-09-20 submitted - user-confirmed, outcome not visible in search'],
  ['786730948746620', '2026-09-20 posted/visible'],
]);
const csv = await fs.readFile(fbPath, 'utf8');
const wb = await Workbook.fromCSV(csv, { sheetName: 'Facebook' });
const sh = wb.worksheets.getItem('Facebook');
const vals = sh.getUsedRange(true).values;
const changed = [];
for (let i = 1; i < vals.length; i++) {
  const url = String(vals[i][1] ?? '');
  const match = [...updates.keys()].find(id => url.includes(id));
  if (match) {
    sh.getCell(i, 2).values = [[updates.get(match)]];
    changed.push(i + 1);
  }
}
if (changed.length !== 5) throw new Error(`Expected 5 updated rows, found ${changed.length}`);
wb.recalculate();
const check = await wb.inspect({kind:'table',range:'Facebook!A800:C804',include:'values,formulas',tableMaxRows:10,tableMaxCols:3,maxChars:5000});
const out = sh.getUsedRange(true).values;
const esc = v => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? '"'+s.replaceAll('"','""')+'"' : s; };
await fs.writeFile(fbPath, out.map(r=>r.slice(0,3).map(esc).join(',')).join('\r\n')+'\r\n', 'utf8');
const rtxt = await fs.readFile(redditPath,'utf8');
const rwb = await Workbook.fromCSV(rtxt,{sheetName:'Reddit'});
const rvals = rwb.worksheets.getItem('Reddit').getUsedRange(true).values;
console.log(JSON.stringify({changed,facebookRows:out.length,facebookCols:Math.max(...out.map(r=>r.length)),facebookBlankGroup:out.slice(1).filter(r=>!r[0]).length,facebookBlankLink:out.slice(1).filter(r=>!r[1]).length,redditRows:rvals.length,redditCols:Math.max(...rvals.map(r=>r.length)),redditBlankGroup:rvals.slice(1).filter(r=>!r[0]).length,redditBlankLink:rvals.slice(1).filter(r=>!r[1]).length,inspect:check.ndjson}));
