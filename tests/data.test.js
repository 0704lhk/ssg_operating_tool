import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { STANDARD_COLUMNS, REPORT_COLUMNS, parseWorkbook, mergeRows, filterRows, summarize, groupByStore, calculateRow, createReport } from '../src/data.js';

const base = path.resolve('A_매출비교');
const names = ['01_영업실적.xlsx','02_온라인실적.xlsx','03_팝업실적.xlsx'];
const expectedColumns = ['record_id','기준주','점포','브랜드','장르','채널','매출_만원','목표_만원','비용_만원','상태','출처','기준일'];
const aliases = [expectedColumns, ['레코드ID','주차','점포명','브랜드명','카테고리','유통채널','실적(만원)','목표매출(만원)','집행비용(만원)','진행상태','근거자료','확인일'], ['기록번호','주간기준일','영업점','행사브랜드','상품군','판매채널','매출액_만원','목표액_만원','사용비용_만원','진행현황','자료출처','기준일자']];
const buffers = names.map(name => fs.readFileSync(path.join(base,name)));
const parsed = buffers.map((buffer,i) => parseWorkbook(buffer,names[i]).rows);
const rows = parsed.flat();
const original = buffers.flatMap((buffer,fileIndex) => {
  const workbook = XLSX.read(buffer,{type:'buffer'});
  const grid = XLSX.utils.sheet_to_json(workbook.Sheets['원본'],{header:1,raw:true});
  return grid.slice(1).filter(row=>row.some(v=>v!==undefined&&v!=='')).map(row=>Object.fromEntries(expectedColumns.map((column,j)=>[column,row[grid[0].indexOf(aliases[fileIndex][j])]])));
});
const totals = input => input.reduce((total,row)=>({count:total.count+1,sales:total.sales+row['매출_만원'],target:total.target+row['목표_만원'],cost:total.cost+row['비용_만원']}),{count:0,sales:0,target:0,cost:0});
const workbookBytes = grid => {const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(grid),'원본');return XLSX.write(workbook,{type:'buffer',bookType:'xlsx'});};
const sourceGrid = () => XLSX.utils.sheet_to_json(XLSX.read(buffers[0],{type:'buffer'}).Sheets['원본'],{header:1,raw:true});

test('three independent alias mappings preserve every amount, text field and all 480 unique IDs',()=>{
  assert.deepEqual([...STANDARD_COLUMNS],expectedColumns);
  assert.equal(rows.length,480);assert.equal(new Set(rows.map(row=>row.record_id)).size,480);
  parsed.forEach((input,i)=>{assert.equal(input.length,160);assert.deepEqual([...new Set(input.map(row=>row['채널']))],[['영업','온라인','팝업'][i]]);});
  rows.forEach((row,i)=>{for(const column of expectedColumns.filter(column=>!['기준주','기준일'].includes(column)))assert.equal(row[column],original[i][column],`${i}: ${column}`);for(const key of ['기준주','기준일']) assert.match(row[key],/^2026-\d\d-\d\d$/);});
  rows.forEach((row,i)=>{assert.equal(row._sourceFile,names[Math.floor(i/160)]);assert.equal(row._sourceSheet,'원본');assert.equal(row._sourceRow,i%160+2);});
  assert.deepEqual(totals(original),{count:480,sales:385287,target:386120,cost:230910});
  const actual=summarize(rows);for(const [key,value] of Object.entries(totals(original)))assert.equal(actual[key],value);
  assert.equal(actual.rate,385287/386120);assert.equal(actual.delta,-833);assert.equal(actual.net,154377);
});

test('record ID deduplication, atomic conflict and same-brand different-ID behavior',()=>{
  const before=JSON.stringify(rows);
  const repeated=mergeRows(rows,parsed[0]);assert.equal(repeated.duplicateCount,160);assert.equal(repeated.rows.length,480);assert.deepEqual(totals(repeated.rows),totals(rows));
  const extra={...rows[0],record_id:'VERIFIER-NEW-ID'};
  assert.equal(mergeRows(rows,[extra]).rows.length,481);
  assert.throws(()=>mergeRows(rows,[extra,{...rows[1],'매출_만원':99999}]),/충돌/);
  assert.equal(JSON.stringify(rows),before);
});

test('invalid files fail atomically: supplied missing column, ambiguous header, blank ID, invalid date/number, count and channel',()=>{
  assert.throws(()=>parseWorkbook(fs.readFileSync(path.join(base,'05_오류_열누락.xlsx')),'05_오류_열누락.xlsx'));
  const missing=sourceGrid();const targetColumn=missing[0].indexOf('목표_만원');missing.forEach(row=>row.splice(targetColumn,1));assert.throws(()=>parseWorkbook(workbookBytes(missing),'01_열누락사본.xlsx'),/목표_만원.*누락/);
  const mutations=[grid=>{grid[0].push('레코드ID');grid.slice(1).forEach(row=>row.push(row[0]));},grid=>{grid[1][0]='';},grid=>{grid[1][1]='2026-02-30';},grid=>{grid[1][6]='숫자 아님';},grid=>{grid.pop();},grid=>{grid[1][5]='온라인';}];
  const before=JSON.stringify(rows);
  mutations.forEach((mutate,i)=>{const grid=sourceGrid();mutate(grid);assert.throws(()=>parseWorkbook(workbookBytes(grid),'01_영업실적.xlsx'),`mutation ${i}`);});
  assert.equal(JSON.stringify(rows),before);
});

test('calculations use weighted totals and null zero-target rate including positive sales',()=>{
  const example=rows.find(row=>row['매출_만원']===470&&row['목표_만원']===380&&row['비용_만원']===254);
  assert.ok(example);const calculated=calculateRow(example);assert.equal(calculated.delta,90);assert.equal(calculated.net,216);assert.equal(calculated.rate,470/380);
  for(const sales of [0,125]){const zero={...rows[0],'매출_만원':sales,'목표_만원':0};assert.equal(calculateRow(zero).rate,null);assert.equal(summarize([zero]).rate,null);}
  assert.equal(summarize([]).count,0);
});

test('all filter combinations use exact source selection and grouped totals',()=>{
  const stores=[[],['예제A점'],['예제A점','예제C점']];const channels=['','영업','온라인','팝업'];const weeks=['',...new Set(rows.map(row=>row['기준주']))];
  for(const selectedStores of stores)for(const channel of channels)for(const week of weeks){const filters={stores:selectedStores,channel,week};const independent=rows.filter(row=>(!selectedStores.length||selectedStores.includes(row['점포']))&&(!channel||row['채널']===channel)&&(!week||row['기준주']===week));const filtered=filterRows(rows,filters);assert.deepEqual(filtered.map(row=>row.record_id),independent.map(row=>row.record_id));const actual=summarize(filtered);for(const [key,value] of Object.entries(totals(independent)))assert.equal(actual[key],value);const grouped=groupByStore(filtered);for(const key of ['count','sales','target','cost'])assert.equal(grouped.reduce((sum,group)=>sum+group[key],0),actual[key]);}
  assert.equal(filterRows(rows,{stores:['존재하지 않는 점포'],channel:'',week:''}).length,0);
});

test('report obeys real 16-column template, typed ratio, ID notes, blank zero-target cells and metadata',()=>{
  const template=XLSX.read(fs.readFileSync(path.join(base,'04_보고양식.xlsx')),{type:'buffer'});
  const headers=XLSX.utils.sheet_to_json(template.Sheets['보고'],{header:1})[0];assert.deepEqual([...REPORT_COLUMNS],headers);
  const filters={stores:['예제A점','예제B점'],channel:'영업',week:rows[0]['기준주']};const selected=filterRows(rows,filters);const notes={[selected[1].record_id]:'Verifier ID별 메모'};
  const report=XLSX.read(createReport(selected,notes,filters),{type:'array',cellStyles:true});
  assert.ok(report.Sheets['보고조건']);const sheet=report.Sheets['보고'];const actual=XLSX.utils.sheet_to_json(sheet,{defval:null});assert.deepEqual(XLSX.utils.sheet_to_json(sheet,{header:1})[0],headers);assert.deepEqual(actual.map(row=>row.record_id),selected.map(row=>row.record_id));
  assert.deepEqual(totals(actual),totals(selected));assert.equal(actual.find(row=>row.record_id===selected[1].record_id)['메모'],notes[selected[1].record_id]);
  selected.forEach((row,index)=>{const cell=sheet[`J${index+2}`];if(row['목표_만원']===0){assert.equal(cell?.v,undefined);assert.equal(cell?.f,undefined);}else{assert.equal(cell.t,'n');assert.equal(cell.v,row['매출_만원']/row['목표_만원']);assert.match(cell.z,/%/);}});
  const conditionText=JSON.stringify(XLSX.utils.sheet_to_json(report.Sheets['보고조건'],{header:1}));for(const required of ['예제A점','예제B점','영업',filters.week,'교육용','만원','기준일'])assert.ok(conditionText.includes(required),`metadata ${required}`);
  const provenance=XLSX.utils.sheet_to_json(report.Sheets['입력출처']);assert.equal(provenance.length,selected.length);assert.equal(provenance[0]['입력 파일'],selected[0]._sourceFile);assert.equal(provenance[0]['원본 행'],selected[0]._sourceRow);
  const positiveZero={...selected[0],'매출_만원':123,'목표_만원':0};const zeroReport=XLSX.read(createReport([positiveZero],{},filters),{type:'array'});assert.equal(zeroReport.Sheets['보고'].J2?.v,undefined);assert.equal(zeroReport.Sheets['보고'].J2?.f,undefined);assert.equal(zeroReport.Sheets['보고조건'].B18?.v,undefined);assert.equal(zeroReport.Sheets['보고조건'].B18?.f,undefined);
});
