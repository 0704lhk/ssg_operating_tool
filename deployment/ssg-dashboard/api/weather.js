import {createWeatherService} from '../server/weather.js';
const weather=createWeatherService();
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end(JSON.stringify({message:'GET only'}));return;}const url=new URL(req.url,'http://localhost');res.end(JSON.stringify(await weather({selectedSample:url.searchParams.get('mode')==='sample'})));}
