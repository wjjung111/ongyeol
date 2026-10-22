/* Independent condominium calculator. No writes to existing app data.
 * Threshold: Inheritance/Gift Tax Act Enforcement Decree 49(6) -> Income Tax Act 99.
 * NTS 2026 calculation guide pp.4-5: income basis excludes individual adjustments.
 */
(function(root){
  'use strict';
  const G=root.CondoStandardIndices;
  const LIMIT=1000000000;
  function num(v){return v===''||v==null?NaN:Number(v);}
  function positive(v){return Number.isFinite(num(v))&&num(v)>0;}
  function floor1000(v){return Math.floor((v+1e-7)/1000)*1000;}
  function yearOf(date){return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date?+date.slice(0,4):NaN;}
  function decision(total){return {institutions:total<=LIMIT?1:2,gap:LIMIT-total,near:Math.abs(LIMIT-total)<10000000};}
  function landValue(lands){
    const errors=[];let total=0,weighted=0,area=0;
    if(!lands.length)errors.push('대지권 정보를 입력하세요.');
    for(const l of lands){
      const a=l.method==='ratio'?num(l.parcelArea)*num(l.numerator)/num(l.denominator):num(l.area);
      if(!positive(l.price)||!positive(a))errors.push('대지권 면적과 공시지가는 0보다 커야 합니다.');
      if(l.method==='ratio'&&(!positive(l.parcelArea)||!positive(l.numerator)||!positive(l.denominator)||num(l.numerator)>num(l.denominator)))errors.push('대지권 비율의 분자·분모·필지면적을 확인하세요.');
      if(positive(l.parcelArea)&&a>num(l.parcelArea))errors.push('대지권 면적이 전체 필지면적보다 큽니다.');
      total+=a*num(l.price);weighted+=num(l.parcelArea)*num(l.price);area+=num(l.parcelArea);
    }
    return {errors,total:Math.round(total),locationPrice:area>0?weighted/area:(lands.length===1?num(lands[0].price):NaN)};
  }
  function calculate(input){
    const errors=[], year=yearOf(input.date);
    if(![2025,2026].includes(year))errors.push('지원 평가기준일은 2025~2026년입니다. 다른 연도는 해당 고시를 확인하세요.');
    if(!['manual','official','housing'].includes(input.mode)){errors.push('호별 고시 여부를 먼저 선택하세요.');return {errors};}
    if(input.mode==='official'||input.mode==='housing'){
      if(!positive(input.officialTotal))errors.push('호별 토지·건물 일괄가격을 입력하세요.');
      if(!input.officialConfirmed)errors.push('평가기준일에 적용되는 해당 호의 고시가격인지 확인하세요.');
      if(errors.length)return {errors};
      const total=num(input.officialTotal);return {errors:[],year,total,official:true,...decision(total)};
    }
    const land=landValue(input.lands||[]);errors.push(...land.errors);
    if(!input.priceConfirmed)errors.push('공시지가의 적용 시점과 금액을 확인하세요.');
    if(!input.rowsConfirmed)errors.push('전유·공용면적 및 구조·용도 매핑을 확인하세요.');
    if(!positive(input.built)||num(input.built)>year||!Number.isInteger(num(input.built)))errors.push('신축연도를 확인하세요.');
    if(input.remodel!==''&&input.remodel!=null&&(!positive(input.remodel)||!Number.isInteger(num(input.remodel))||num(input.remodel)<=num(input.built)||num(input.remodel)>year))errors.push('대수선 연도는 신축연도 이후, 평가기준일 연도 이하여야 합니다.');
    if(!(input.rows||[]).length)errors.push('전유·공용부분을 입력하세요.');
    const loc=G.locIdx(year,land.locationPrice);
    if(!loc)errors.push('위치지수 산정에 필요한 공시지가·전체 필지면적을 확인하세요.');
    let building=0,sjBuilding=0,totalArea=0;const lines=[];
    for(const r of input.rows||[]){
      const area=num(r.area),s=G.STRUCT.find(x=>x[0]===num(r.structNo)),u=num(r.useIndex),group=num(r.group);
      if(!positive(area)||!s||!positive(u)||![1,2,3,4].includes(group))errors.push('각 부분의 면적·구조·용도지수·내용연수를 확인하세요.');
      const rr=G.residual(year,num(input.built),group,0),si=s?G.structIdx(year,s[0])/100:NaN;
      const unit=loc?floor1000(G.BASE[year]*si*(u/100)*(loc.idx/100)*rr):NaN;
      // Supplementary inheritance basis is separate, never used for the 1bn threshold.
      const adj=num(r.adjustment),sjrr=G.residual(year,num(input.built),group,num(input.remodel)||0);
      if(!positive(adj))errors.push('상속·증여용 조정률은 0보다 커야 합니다.');
      const sjUnit=loc?floor1000(G.BASE[year]*si*(u/100)*(loc.idx/100)*sjrr*adj):NaN;
      const value=Math.round(unit*area),sjValue=Math.round(sjUnit*area);
      building+=value;sjBuilding+=sjValue;totalArea+=area;
      lines.push({...r,unit,value,sjUnit,sjValue,rr,si});
    }
    if(errors.length)return {errors:[...new Set(errors)]};
    const total=building+land.total;
    return {errors:[],year,base:G.BASE[year],loc,lines,totalArea,building,land:land.total,total,sjTotal:input.sjConfirmed?sjBuilding+land.total:null,...decision(total)};
  }
  function registerRows(rows,year){
    const primary=rows.find(r=>/전유/.test(r.exposPubuseGbCdNm||''));
    const main=primary?[primary.mainPurpsCdNm,primary.etcPurps].filter(Boolean).join(' '):'';
    return rows.map(r=>{
      const label=[r.mainPurpsCdNm,r.etcPurps].filter(Boolean).join(' '),text=r.strctCdNm||r.etcStrct||'';
      const common=!/전유/.test(r.exposPubuseGbCdNm||'');
      const mapped=common?G.mapUse(main,Number(primary?.area)||0):G.mapUse(label,Number(r.area)||0);
      const sNo=/프리케스트|프리캐스트/.test(text)?4:G.mapStructure(text)[0];
      return {label:(common?'공용':'전유')+' · '+(r.flrNoNm||'')+' '+label,area:String(r.area||''),structNo:sNo,group:G.structGroup(sNo,text),useIndex:G.useIdx(year,mapped.use),adjustment:1};
    });
  }
  root.CondoStandardPrice={calculate,landValue,registerRows,decision,yearOf,floor1000};
})(typeof window!=='undefined'?window:globalThis);
