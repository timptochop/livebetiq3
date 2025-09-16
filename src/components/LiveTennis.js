import React, { useEffect, useMemo, useRef, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

/* ================= helpers ================= */
const FINISHED_SET = new Set([
  'finished','cancelled','retired','abandoned','postponed','walk over',
]);
const isFinishedLike = (s) => FINISHED_SET.has(String(s||'').toLowerCase());
const isUpcoming     = (s) => String(s||'').toLowerCase()==='not started';
const isLive         = (s) => !!s && !isUpcoming(s) && !isFinishedLike(s);

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim(); if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players){
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1),num(a.s2),num(a.s3),num(a.s4),num(a.s5)];
  const sB = [num(b.s1),num(b.s2),num(b.s3),num(b.s4),num(b.s5)];
  let k = 0; for (let i=0;i<5;i++) if (sA[i]!==null || sB[i]!==null) k=i+1;
  return k || null;
}

function setFromStatus(status){
  const s = String(status||'');
  const m = s.match(/set\s*(\d+)/i) || s.match(/(\d)(?:st|nd|rd|th)?\s*set/i) || s.match(/\bs(\d)\b/i);
  return m ? parseInt(m[1],10) : null;
}

function parseSetGame(status){
  const s = String(status||'');
  const setM  = s.match(/set\s*(\d+)/i) || s.match(/(\d)(?:st|nd|rd|th)?\s*set/i) || s.match(/\bs(\d)\b/i);
  const gameM = s.match(/game\s*(\d+)/i) || s.match(/\bg(\d+)\b/i);
  return {
    set:  setM  ? parseInt(setM[1],10)  : null,
    game: gameM ? parseInt(gameM[1],10) : null
  };
}

function parseDateTime(d,t){
  const ds=String(d||'').trim(), ts=String(t||'').trim();
  if (!ds) return null;
  const [dd,mm,yyyy]=ds.split('.').map(Number);
  const [HH=0,MM=0] = ts.includes(':') ? ts.split(':').map(Number) : [0,0];
  const dt = new Date(yyyy||1970,(mm||1)-1,dd||1,HH,MM,0,0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function minutesUntil(dt, now=new Date()){
  if (!dt) return null;
  const ms = dt.getTime()-now.getTime();
  return ms<=0 ? 0 : Math.round(ms/60000);
}

/* badge colors */
const COLORS = {
  SAFE:  '#1fdd73',   // 🟢
  RISKY: '#ff9900',   // 🟠
  AVOID: '#e53935',   // 🔴
  SET:   '#7e6bd6',   // 🟣
  SOON_BG: '#ffffff', // ⚪
  SOON_FG: '#121416',
  DEFAULT: '#5a5f68'
};

/* tiny UI atoms */
const Dot = ({ on }) => (
  <span style={{
    width:10,height:10,borderRadius:999,display:'inline-block',
    background:on?COLORS.SAFE:'#e24d4d',
    boxShadow:on?'0 0 10px rgba(31,221,115,.7)':'0 0 8px rgba(226,77,77,.5)'
  }}/>
);

const Badge = ({ kind, text, title }) => {
  const upper = String(text||'').toUpperCase();
  let bg=COLORS.DEFAULT, fg='#fff';
  if (kind==='SAFE')   bg=COLORS.SAFE;
  else if(kind==='RISKY') bg=COLORS.RISKY;
  else if(kind==='AVOID') bg=COLORS.AVOID;
  else if(kind==='SET')   bg=COLORS.SET;
  else if(kind==='SOON'){ bg=COLORS.SOON_BG; fg=COLORS.SOON_FG; }

  return (
    <div title={title||''} style={{
      background:bg,color:fg,borderRadius:16,padding:'6px 12px',
      fontWeight:900,fontSize:13,letterSpacing:.3,
      boxShadow:'0 8px 18px rgba(0,0,0,0.28)', minWidth:64, textAlign:'center'
    }}>
      {upper}
    </div>
  );
};

/* ================= component ================= */
export default function LiveTennis({ onLiveCount=()=>{} }){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(false);
  const notifiedRef = useRef(new Set());

  const playNotification=()=>{ new Audio('/notify.mp3').play().catch(()=>{}); };

  const load=async()=>{
    setLoading(true);
    try{
      const data=await fetchTennisLive();
      setRows(Array.isArray(data)?data:[]);
    }catch(e){
      console.warn('[LiveTennis] fetch failed:', e?.message||e);
      setRows([]);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); const t=setInterval(load, 15000); return ()=>clearInterval(t); },[]);

  const normalized=useMemo(()=>rows.map((m)=>{
    const players = Array.isArray(m.players) ? m.players :
                    (Array.isArray(m.player) ? m.player : []);
    const p1 = players[0]||{}, p2=players[1]||{};
    const name1=p1.name||p1['@name']||'', name2=p2.name||p2['@name']||'';
    const date=m.date||m['@date']||'', time=m.time||m['@time']||'';
    const dt=parseDateTime(date,time);
    const status=m.status||m['@status']||'';

    const live=isLive(status);
    const setByStatus=setFromStatus(status);
    const setByScores=currentSetFromScores(players);
    const setNum = setByStatus || setByScores || (isUpcoming(status)?1:null);

    // AI
    const ai = analyzeMatch({ match:m, setNum });
    let label = ai?.label ?? null;   // 'SAFE' | 'RISKY' | 'AVOID' | null
    let pick  = ai?.pick  ?? null;
    let reason= ai?.reason?? '';

    // Κανόνας: αν είναι LIVE αλλά δεν έχουμε AI label => δείξε SET X (μοβ)
    // Αν είναι UPCOMING => STARTS SOON με λεπτά
    let badgeKind, badgeText;
    if (live) {
      if (label==='SAFE' || label==='RISKY' || label==='AVOID'){
        badgeKind=label; badgeText=label;
      } else {
        badgeKind='SET'; badgeText=`SET ${setNum || 1}`;
      }
    } else if (isUpcoming(status)) {
      const mins = minutesUntil(dt);
      badgeKind='SOON';
      badgeText = (mins===0 || mins===null) ? 'STARTS SOON' : `STARTS IN ${mins} MIN`;
      label = 'SOON'; // για sorting
    } else {
      // όχι live / όχι upcoming -> κράτα raw
      badgeKind='SET'; badgeText=setNum?`SET ${setNum}`:'SOON';
    }

    return {
      id: m.id || m['@id'] || `${date}-${time}-${name1}-${name2}`,
      name1,name2,date,time,dt,status,live,setNum,
      categoryName: m.categoryName || m['@category'] || m.category || '',
      aiLabel: label, pick, reason,
      badgeKind, badgeText
    };
  }),[rows]);

  // Sorting: SAFE → RISKY → AVOID → live SET(3→2→1) → STARTS SOON (by time)
  const weight=(x)=>{
    if (x.aiLabel==='SAFE')  return 0;
    if (x.aiLabel==='RISKY') return 1;
    if (x.aiLabel==='AVOID') return 2;
    if (x.live)              return 3 - (x.setNum||0)/10; // μεγαλύτερο set “λιγότερο βάρος”
    return 4; // upcoming
  };

  const list=useMemo(()=>{
    const keep = normalized.filter(m=>!isFinishedLike(m.status));
    return keep.sort((a,b)=>{
      const wa=weight(a), wb=weight(b);
      if (wa!==wb) return wa-wb;
      // tie-break: live -> μεγαλύτερο set πρώτα
      if (a.live && b.live && a.setNum!==b.setNum) return (b.setNum||0)-(a.setNum||0);
      // upcoming -> κοντινότερη ώρα
      const ta=a.dt?.getTime()??Infinity, tb=b.dt?.getTime()??Infinity;
      return ta-tb;
    });
  },[normalized]);

  // live counter + SAFE notifications
  useEffect(()=>{
    onLiveCount(list.reduce((n,m)=>n+(m.live?1:0),0));
    list.forEach(m=>{
      if (m.aiLabel==='SAFE' && !notifiedRef.current.has(m.id)){
        playNotification();
        notifiedRef.current.add(m.id);
      }
    });
  },[list,onLiveCount]);

  /* ================= render ================= */
  const titleStyle={fontSize:16,fontWeight:800,color:'#f2f6f9',lineHeight:1.12};
  const metaStyle ={marginTop:6,fontSize:12,color:'#c7d1dc',lineHeight:1.35};
  const tipStyle  ={marginTop:6,fontSize:13,fontWeight:700,color:COLORS.SAFE};

  return (
    <div style={{ background:'#0a0c0e', minHeight:'100vh' }}>
      <div style={{ maxWidth:1100, margin:'12px auto 40px', padding:'0 14px' }}>
        {list.map(m=>(
          <div key={m.id} style={{
            borderRadius:18, background:'#121416', border:'1px solid #1d2126',
            boxShadow:'0 14px 28px rgba(0,0,0,0.45)', padding:14, marginBottom:10
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Dot on={m.live}/>
                <div>
                  <div style={titleStyle}>
                    {m.name1} <span style={{ color:'#96a5b4', fontWeight:600 }}>vs</span> {m.name2}
                  </div>
                  <div style={metaStyle}>
                    {m.badgeKind==='SOON' ? '' : `${m.badgeText} • `}{m.date} {m.time} • {m.categoryName}
                  </div>
                  {['SAFE','RISKY'].includes(m.aiLabel) && m.pick && (
                    <div style={tipStyle}>TIP: {m.pick}</div>
                  )}
                </div>
              </div>
              <Badge kind={m.badgeKind} text={m.badgeText} title={m.reason}/>
            </div>
          </div>
        ))}

        {list.length===0 && !loading && (
          <div style={{
            marginTop:12, padding:'14px 16px', borderRadius:12,
            background:'#121416', border:'1px solid #22272c', color:'#c7d1dc', fontSize:13
          }}>
            Δεν βρέθηκαν αγώνες (live ή upcoming).
          </div>
        )}
      </div>
    </div>
  );
}