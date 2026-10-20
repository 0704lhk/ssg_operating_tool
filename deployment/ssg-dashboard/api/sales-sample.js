import fs from 'node:fs';
const payload=JSON.parse(fs.readFileSync(new URL('../shared/sales-sample.json',import.meta.url),'utf8'));
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end(JSON.stringify({message:'GET only'}));return;}
  res.end(JSON.stringify(payload));
}
