/**
 * Excel-compatible 1900 date system for bounded spreadsheet dates.
 * Stored cell values are decimal serial strings; display lives in cell.style.format.
 * Excel's historical phantom serial 60 is preserved when importing but never generated
 * from a Gregorian calendar date.
 */
const DAY_MS=86400000;
const EPOCH=Date.UTC(1899,11,31);
const MAX_SERIAL=2958465; // 9999-12-31 in Excel's 1900 system

const whole=n=>typeof n==='number'&&Number.isInteger(n);
export function dateSerial(year,month,day,normalize=false){
 if(![year,month,day].every(whole)||year<1900||year>9999)throw RangeError('Invalid date');
 if(!normalize&&(month<1||month>12||day<1||day>31))throw RangeError('Invalid date');
 if(normalize&&(Math.abs(month)>1200||Math.abs(day)>10000))throw RangeError('Invalid date');
 const d=new Date(Date.UTC(year,month-1,day));
 if(!normalize&&(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day))throw RangeError('Invalid date');
 if(d.getUTCFullYear()<1900||d.getUTCFullYear()>9999)throw RangeError('Invalid date');
 const days=Math.round((d.getTime()-EPOCH)/DAY_MS);
 const serial=days+(days>=60?1:0);
 if(serial<1||serial>MAX_SERIAL)throw RangeError('Invalid date');
 return serial;
}
export function serialDateParts(serial){
 if(!Number.isFinite(serial)||serial<1||Math.floor(serial)>MAX_SERIAL)throw RangeError('Invalid date serial');
 const days=Math.floor(serial);
 if(days===60)return {year:1900,month:2,day:29,phantom:true}; // Excel 1900 compatibility only
 const d=new Date(EPOCH+(days>=61?days-1:days)*DAY_MS);
 return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
}
export function timeSerial(hours,minutes,seconds=0){
 if(![hours,minutes,seconds].every(whole)||hours<0||hours>23||minutes<0||minutes>59||seconds<0||seconds>59)throw RangeError('Invalid time');
 return (hours*3600+minutes*60+seconds)/86400;
}
export function serialTimeParts(value){
 if(!Number.isFinite(value)||value<0)throw RangeError('Invalid time serial');
 const seconds=((Math.round((value-Math.floor(value))*86400)%86400)+86400)%86400;
 return {hours:Math.floor(seconds/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
const pad=n=>String(n).padStart(2,'0');
export function formatTemporal(serial,kind){
 const n=Number(serial);
 if(!Number.isFinite(n))return '#VALUE!';
 try{
  if(kind==='duration'){
   if(n<0||n>MAX_SERIAL)return '#NUM!';
   const minutes=Math.round(n*1440);
   return String(Math.floor(minutes/60))+':'+pad(minutes%60);
  }
  if(kind==='time'){
   const t=serialTimeParts(n);return pad(t.hours)+':'+pad(t.minutes);
  }
  const d=serialDateParts(n);
  const date=pad(d.day)+'.'+pad(d.month)+'.'+String(d.year).padStart(4,'0');
  if(kind==='date')return date;
  if(kind==='datetime'){
   const t=serialTimeParts(n);
   return date+' '+pad(t.hours)+':'+pad(t.minutes);
  }
  return String(n);
 }catch{return '#NUM!';}
}
/** Only unambiguous ISO or Russian calendar dates and clock times are auto-recognized. */
export function parseTemporalInput(input){
 const s=String(input).trim();let m;
 m=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
 if(m){
  try{const day=dateSerial(+m[1],+m[2],+m[3]);return m[4]===undefined?
   {value:String(day),format:'date'}:{value:String(day+timeSerial(+m[4],+m[5],+(m[6]||0))),format:'datetime'};}catch{return null;}
 }
 m=/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
 if(m){
  try{const day=dateSerial(+m[3],+m[2],+m[1]);return m[4]===undefined?
   {value:String(day),format:'date'}:{value:String(day+timeSerial(+m[4],+m[5],+(m[6]||0))),format:'datetime'};}catch{return null;}
 }
 m=/^\[(\d{1,6})\]:([0-5]\d)$/.exec(s);
 if(m)return {value:String((+m[1]*60+ +m[2])/1440),format:'duration'};
 m=/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/.exec(s);
 if(m&&+m[1]<=23){
  try{return {value:String(timeSerial(+m[1],+m[2],+(m[3]||0))),format:'time'};}catch{return null;}
 }
 return null;
}
