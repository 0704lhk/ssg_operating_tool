import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as XLSX_NS from 'xlsx';
const XLSX = XLSX_NS.default || XLSX_NS;
XLSX.set_fs(fs);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'results');
const baseline = JSON.parse(fs.readFileSync(path.join(output,'verification-baseline.json')));
const independentRows = JSON.parse(fs.readFileSync(path.join(output,'verification-expected-rows.json')));
const originalHashes = JSON.parse(fs.readFileSync(path.join(output,'original-hashes.json')));
const checks = [];
function check(name, run) {run(); checks.push({name, status:'passed'});}
function hashCheck() {
 for (const [relative, hash] of Object.entries(originalHashes)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex'), hash, relative);
}
check('A~E 원본 18개 SHA256 보존',hashCheck);
await build({entryPoints:[path.join(root,'운영대시보드/src/sales-data.js')],bundle:true,platform:'node',format:'cjs',outfile:path.join(output,'verification-data-module.cjs')});
const require = createRequire(import.meta.url);
const data = require(path.join(output,'verification-data-module.cjs'));
const read = name => fs.readFileSync(path.join(root,'A_매출비교',name));
const files = baseline.files.map(f => ({name:f.file, ...data.parseWorkbook(read(f.file), f.file)}));
let rows = [];
for (const f of files) rows = data.appendRecords(rows,f.records);
check('파일별 160행 · 통합 480행 · 전역 ID 480개',()=>{
 assert.deepEqual(files.map(f=>f.records.length),[160,160,160]);assert.equal(rows.length,480);assert.equal(new Set(rows.map(r=>r.record_id)).size,480);
});
check('별칭·열 순서·값·12개 필드·파일 및 행 출처 독립 Python 대조',()=>{
 for(let i=0;i<rows.length;i++) {
  const expected=independentRows[i], actual=rows[i];
  for(const field of data.REQUIRED) assert.equal(actual[field],['기준주','기준일'].includes(field)?expected[field].slice(0,10):expected[field],`${i} ${field}`);
  assert.equal(actual.__sourceFile,expected._file);assert.equal(actual.__row,expected._row);
 }
});
check('전체 매출·목표·비용 합계 및 합계 달성률',()=>{
 const s=data.summarize(rows);assert.equal(s.revenue,baseline.sales);assert.equal(s.target,baseline.target);assert.equal(s.rate,baseline.achievement);assert.equal(rows.reduce((n,r)=>n+r.비용_만원,0),baseline.cost);
 assert.equal(s.stores.reduce((n,s)=>n+s.value,0),s.revenue);
});
const template=data.readTemplate(read('04_보고양식.xlsx'));
check('실제 04 양식의 16개 헤더와 순서',()=>assert.deepEqual(template,baseline.reportHeaders));
const reportMatrix = (subset,memos={}) => XLSX.utils.sheet_to_json(data.buildReport(subset,template,memos).Sheets.보고,{header:1,defval:null,raw:true});
let filterCaseCount=0;
function verifyFilter(filters) {
 const expected=rows.filter(r=>Object.entries(filters).every(([key,value])=>Array.isArray(value)?!value.length||value.includes(r[key]):!value||r[key]===value));
 const actual=data.filterRows(rows,filters);assert.deepEqual(actual.map(r=>r.record_id),expected.map(r=>r.record_id));
 const s=data.summarize(actual);assert.equal(s.revenue,expected.reduce((n,r)=>n+r.매출_만원,0));assert.equal(s.target,expected.reduce((n,r)=>n+r.목표_만원,0));
 assert.equal(s.rate,s.target===0?null:s.revenue/s.target);
 const storeTotals=new Map();for(const r of expected)storeTotals.set(r.점포,(storeTotals.get(r.점포)||0)+r.매출_만원);
 assert.deepEqual(Object.fromEntries(s.stores.map(s=>[s.name,s.value])),Object.fromEntries(storeTotals));
 assert.deepEqual(reportMatrix(actual).slice(1).map(r=>r[0]),expected.map(r=>r.record_id));filterCaseCount++;
}
check('5개 필터 각각 모든 값·복수 조합·빈 결과·다중 선택의 지표/차트/보고 동일 집합',()=>{
 const fields=['점포','채널','기준주','브랜드','장르'];
 verifyFilter({});
 for(const field of fields)for(const value of new Set(rows.map(r=>r[field])))verifyFilter({[field]:value});
 for(const r of rows.filter((_,i)=>i%23===0)){verifyFilter({점포:r.점포,채널:r.채널});verifyFilter(Object.fromEntries(fields.map(k=>[k,r[k]])));}
 verifyFilter({점포:'존재하지 않는 점포'});verifyFilter({채널:['영업','팝업'],점포:[rows[0].점포]});verifyFilter({브랜드:[]});
});
check('기존 파일 재업로드·파일 간·입력 내 중복 ID 거부 후 480행 보존',()=>{
 const before=JSON.stringify(rows);
 assert.throws(()=>data.appendRecords(rows,files[0].records),/중복 record_id/);
 assert.throws(()=>data.appendRecords(files[0].records,[{...files[1].records[0],record_id:files[0].records[0].record_id}]),/중복 record_id/);
 assert.throws(()=>data.appendRecords([], [rows[0],rows[0]]),/중복 record_id/);
 assert.equal(JSON.stringify(rows),before);assert.equal(rows.length,480);
});
function alteredBuffer(change) {const w=XLSX.read(read('01_영업실적.xlsx'),{type:'buffer'});change(w.Sheets.원본,w);return XLSX.write(w,{type:'buffer',bookType:'xlsx'});}
check('파일 내부 중복 ID 및 열 위치 변경 별칭 검사',()=>{
 assert.throws(()=>data.parseWorkbook(alteredBuffer(s=>{s.A3.v=s.A2.v;}),'01_영업실적.xlsx'),/원본 3행.*중복 record_id/);
 const w=XLSX.read(read('02_온라인실적.xlsx'),{type:'buffer'});const matrix=XLSX.utils.sheet_to_json(w.Sheets.원본,{header:1,raw:true});
 w.Sheets.원본=XLSX.utils.aoa_to_sheet(matrix.map(r=>[...r].reverse()));
 const parsed=data.parseWorkbook(XLSX.write(w,{type:'buffer',bookType:'xlsx'}),'02_온라인실적.xlsx');
 assert.deepEqual(parsed.records,files[1].records);
});
check('05 목표 열 누락·파일 채널 불일치·알 수 없는 채널은 행 오류 및 정상 데이터 보존',()=>{
 const before=JSON.stringify(rows);
 assert.throws(()=>data.parseWorkbook(read('05_오류_열누락.xlsx'),'05_오류_열누락.xlsx'),/필수 열 누락: 목표_만원/);
 assert.throws(()=>data.parseWorkbook(alteredBuffer(s=>{s.F2.v='온라인';}),'01_영업실적.xlsx'),/원본 2행.*파일명과 채널 불일치/);
 assert.throws(()=>data.parseWorkbook(alteredBuffer(s=>{s.F2.v='알수없음';}),'01_영업실적.xlsx'),/원본 2행.*알 수 없는 채널/);
 assert.equal(JSON.stringify(rows),before);
});
const memoID=rows[1].record_id;const memos={[memoID]:'검사 메모 · record_id 연결', [rows[2].record_id]:'=1+1'};
check('행별 목표차이·달성률·비용차감·출처·메모와 0 목표 공란',()=>{
 const matrix=reportMatrix(rows,memos);assert.deepEqual(matrix[0],template);
 for(let i=0;i<rows.length;i++){
  const source=rows[i], r=matrix[i+1];
  assert.equal(r[8],source.매출_만원-source.목표_만원);assert.equal(r[9],source.목표_만원===0?null:source.매출_만원/source.목표_만원);
  assert.equal(r[11],source.매출_만원-source.비용_만원);assert.equal(r[14],source.출처);assert.equal(r[13],memos[source.record_id]||'');
 }
 assert.equal(data.summarize(rows.filter(r=>r.목표_만원===0)).rate,null);assert.equal(data.summarize([]).rate,null);
 const sheet=data.buildReport(rows,template,memos).Sheets.보고;assert.equal(sheet.N4.t,'s');assert.equal(sheet.N4.f,undefined);
});
const exportPath=path.join(output,'매출비교_검사보고.xlsx');
const filteredPath=path.join(output,'매출비교_필터검사보고.xlsx');
check('새 XLSX 파일 실제 저장·재열기·숫자형·메모·0 목표 공란·필터 보고',()=>{
 XLSX.writeFile(data.buildReport(rows,template,memos),exportPath);
 const reopened=XLSX.readFile(exportPath);const sheet=reopened.Sheets.보고;
 const values=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});assert.equal(values.length,481);assert.deepEqual(values[0],template);
 assert.equal(values[2][13],memos[memoID]);assert.equal(sheet.G3.t,'n');assert.equal(values[1][9],null);
 const filters={채널:'온라인',점포:rows[0].점포}; const selected=data.filterRows(rows,filters);
 XLSX.writeFile(data.buildReport(selected,template,memos),filteredPath);
 const filtered=XLSX.utils.sheet_to_json(XLSX.readFile(filteredPath).Sheets.보고,{header:1,raw:true,defval:null});assert.deepEqual(filtered.slice(1).map(r=>r[0]),selected.map(r=>r.record_id));assert.equal(selected.length,40);
});
check('보고서 저장 후 A~E 원본 SHA256 재검사',hashCheck);
const result={verifiedAt:new Date().toISOString(),checks,filterCaseCount,totals:{rows:rows.length,sales:baseline.sales,target:baseline.target,cost:baseline.cost,rate:baseline.achievement},reports:[exportPath,filteredPath],originalFilesUnchanged:Object.keys(originalHashes).length,limitations:['브라우저 화면·페이지 이동·새로고침 메모 영속성·브라우저 다운로드는 parent 담당 별도 검사'],issues:[]};
fs.writeFileSync(path.join(output,'verification-results.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(output,'verification-summary.md'),`# 매출 앱 독립 검사\n\n${checks.map(c=>`- PASS: ${c.name}`).join('\n')}\n\n필터 ${filterCaseCount}개 조합 검사. 총 480행, 매출 385,287만원, 목표 386,120만원, 비용 230,910만원, 달성률 99.7842639594%.\n\nA~E 원본 ${Object.keys(originalHashes).length}개 SHA256 동일. 전체/필터 XLSX 저장 후 재열기 통과.\n\n브라우저 검사는 통합 담당이 별도 수행합니다.\n`);
console.log(JSON.stringify(result,null,2));
