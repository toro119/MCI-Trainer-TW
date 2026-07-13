const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true }));

const rooms = new Map();
const templates = [
 {age:28,sex:'男',walk:false,breath:true,afterAirway:false,rr:34,pulse:false,command:false,note:'右大腿開放性骨折，股動脈大量出血',mechanism:'車體夾擊',signs:'皮膚濕冷、橈動脈摸不到'},
 {age:45,sex:'女',walk:true,breath:true,afterAirway:false,rr:22,pulse:true,command:true,note:'額頭撕裂傷及多處擦傷，可自行行走',mechanism:'車內碰撞',signs:'意識清楚、情緒焦慮'},
 {age:61,sex:'男',walk:false,breath:false,afterAirway:false,rr:0,pulse:false,command:false,note:'無呼吸，開放呼吸道後仍無呼吸',mechanism:'拋出車外',signs:'無反應'},
 {age:34,sex:'女',walk:false,breath:true,afterAirway:false,rr:24,pulse:true,command:true,note:'骨盆疼痛且無法站立，疑似骨盆骨折',mechanism:'車體擠壓',signs:'生命徵象暫時穩定'},
 {age:52,sex:'男',walk:false,breath:true,afterAirway:false,rr:29,pulse:false,command:true,note:'胸部鈍傷，疑似張力性氣胸',mechanism:'方向盤撞擊',signs:'呼吸急促、橈動脈摸不到'},
 {age:31,sex:'女',walk:false,breath:true,afterAirway:false,rr:20,pulse:true,command:true,note:'左小腿明顯變形，疑似閉鎖性骨折',mechanism:'跌落',signs:'末梢循環尚可'},
 {age:19,sex:'男',walk:true,breath:true,afterAirway:false,rr:18,pulse:true,command:true,note:'雙手玻璃割傷，少量出血',mechanism:'玻璃碎裂',signs:'可自行走動'},
 {age:73,sex:'男',walk:false,breath:true,afterAirway:false,rr:26,pulse:true,command:false,note:'頭部外傷，意識混亂，無法遵從命令',mechanism:'頭部撞擊',signs:'反應遲鈍'},
 {age:40,sex:'女',walk:false,breath:false,afterAirway:true,rr:12,pulse:true,command:false,note:'原無呼吸，開放呼吸道後恢復呼吸',mechanism:'吸入性嗆傷',signs:'意識不清'},
 {age:56,sex:'女',walk:false,breath:true,afterAirway:false,rr:36,pulse:true,command:true,note:'胸部疼痛，呼吸速率36次／分',mechanism:'胸部擠壓',signs:'呼吸窘迫'},
 {age:8,sex:'男童',walk:true,breath:true,afterAirway:false,rr:24,pulse:true,command:true,note:'膝部擦傷與手臂挫傷',mechanism:'座椅跌落',signs:'哭泣但可行走'},
 {age:67,sex:'女',walk:false,breath:true,afterAirway:false,rr:28,pulse:true,command:true,note:'右髖部疼痛，疑似股骨頸骨折',mechanism:'跌落地面',signs:'無法站立'}
];
function makePatients(count){ return Array.from({length:count},(_,i)=>({...templates[i%templates.length],id:'T'+String(i+1).padStart(3,'0'),primaryResult:null,primaryBy:'',secondaryResult:null,secondaryBy:'',transported:false,lockedBy:null})); }
function hospitals(){ return [
 {name:'林口長庚',capacity:{red:3,yellow:5,green:8}},
 {name:'部立桃園醫院',capacity:{red:2,yellow:4,green:6}},
 {name:'聯新國際醫院',capacity:{red:2,yellow:4,green:6}},
 {name:'桃園榮民總醫院',capacity:{red:1,yellow:3,green:5}}
]; }
function scenario(type,count){ const x={
 '遊覽車翻覆':['快速道路交流道附近',`遊覽車失控翻覆，部分乘客受困，現場約${count}名傷患。`,'車體不穩、玻璃碎片、油料外洩、後方來車'],
 '工廠爆炸':['工業區化學工廠',`工廠爆炸伴隨局部火勢，現場約${count}名傷患。`,'二次爆炸、化學外洩、火勢延燒、建物坍塌'],
 '大型火災':['集合住宅或商場',`建築物大型火災，現場約${count}名傷患。`,'濃煙、高溫、坍塌、逃生動線壅塞'],
 '地震災害':['市區建物倒塌現場',`地震造成建物局部倒塌，現場約${count}名傷患。`,'餘震、建物不穩、瓦斯外洩、電線掉落'],
 '化學災害':['槽車或化學品倉儲區',`化學品外洩造成多人暴露，現場約${count}名傷患。`,'有毒氣體、風向變化、污染擴散、二次暴露']
 }[type]||['事故現場',`大量傷病患事件，約${count}名傷患。`,'危害尚待確認']; return {location:x[0],brief:x[1],hazards:x[2]}; }
function log(room,text){ room.logs.unshift({time:new Date().toLocaleTimeString('zh-TW',{hour12:false}),text}); }
function state(room){ return {roomCode:room.roomCode,scenario:room.scenario,patients:room.patients,resources:room.resources,hospitals:room.hospitals,transportLogs:room.transportLogs,logs:room.logs.slice(0,200),members:room.members.map(({socketId,...m})=>m)}; }
function currentRoom(socket){ return rooms.get(socket.data.roomCode); }
function emitState(room){ io.to(room.roomCode).emit('state',state(room)); }

io.on('connection',socket=>{
 socket.on('createRoom',(p,cb)=>{ let code; do code=String(Math.floor(100000+Math.random()*900000)); while(rooms.has(code)); const count=Number(p.patientCount)||12; const sc={name:p.scenarioName||'大量傷病患演練',type:p.scenarioType||'遊覽車翻覆',...scenario(p.scenarioType||'遊覽車翻覆',count)}; const room={roomCode:code,scenario:sc,patients:makePatients(count),resources:[],hospitals:hospitals(),transportLogs:[],logs:[],members:[]}; rooms.set(code,room); socket.join(code); Object.assign(socket.data,{roomCode:code,name:p.name||'教官',role:'instructor'}); room.members.push({socketId:socket.id,name:socket.data.name,role:'instructor'}); log(room,`${socket.data.name}建立演練房間`); cb({ok:true,state:state(room)}); emitState(room); });
 socket.on('joinRoom',(p,cb)=>{ const room=rooms.get(String(p.roomCode||'')); if(!room)return cb({ok:false,message:'找不到房間'}); socket.join(room.roomCode); Object.assign(socket.data,{roomCode:room.roomCode,name:p.name||'未具名',role:p.role}); room.members.push({socketId:socket.id,name:socket.data.name,role:p.role}); log(room,`${socket.data.name}以${p.role}加入`); cb({ok:true,state:state(room)}); emitState(room); });
 socket.on('establishCommand',(p)=>{ const room=currentRoom(socket); if(!room)return; log(room,`${socket.data.name}建立現場指揮｜安全：${p.safety}`); if(p.report)log(room,`初報：${p.report}`); emitState(room); });
 socket.on('dispatchAmbulances',(p,cb)=>{ const room=currentRoom(socket); if(!room)return cb({ok:false}); const stations=['平鎮','中壢','龍岡','大溪','八德','楊梅','埔心','幼獅']; let added=0,attempts=0; while(added<Number(p.count||1)&&attempts<200){attempts++;const name=stations[Math.floor(Math.random()*stations.length)]+(Math.random()<.5?'91':'92');if(!room.resources.some(r=>r.name===name)){room.resources.push({type:'ambulance',name,status:'到達現場'});added++;}} log(room,`加派${added}台救護車並立即到場`); cb({ok:true,added}); emitState(room); });
 socket.on('dispatchFire',(p,cb)=>{ const room=currentRoom(socket); if(!room)return cb({ok:false}); const stations=['平鎮','中壢','龍岡','大溪','八德','楊梅','埔心','幼獅']; const specs=[['11','攻擊車',p.fire11],['16','攻擊車',p.fire16],['61','水庫車',p.fire61],['75','救助器材車',p.fire75],['213','雲梯車',p.fire213],['51','化學車',p.fire51]]; const summary=[]; for(const [code,type,count] of specs){let n=0;for(let i=0;i<Number(count||0);i++){const base=stations[Math.floor(Math.random()*stations.length)]+code;let name=base,seq=2;while(room.resources.some(r=>r.name===name))name=base+'-'+seq++;room.resources.push({type:'fire',name,status:'到達現場',vehicleType:type});n++;}if(n)summary.push(`${code}${type}×${n}`);} if(!summary.length)return cb({ok:false,message:'請輸入消防車數量'}); log(room,`派遣消防車：${summary.join('、')}，全部到場`); cb({ok:true}); emitState(room); });
 socket.on('addUtility',(p)=>{ const room=currentRoom(socket); if(!room)return; if(!room.resources.some(r=>r.name===p.name))room.resources.push({type:'utility',name:p.name,status:'到達現場'}); log(room,`${p.name}到達現場`); emitState(room); });
 socket.on('lockPatient',({patientId},cb)=>{ const room=currentRoom(socket); if(!room)return cb({ok:false}); const p=room.patients.find(x=>x.id===patientId); if(!p)return cb({ok:false}); if(p.lockedBy&&p.lockedBy!==socket.id)return cb({ok:false,message:'此傷患正由其他人操作'}); p.lockedBy=socket.id; cb({ok:true}); emitState(room); });
 socket.on('submitPrimary',({patientId,result},cb)=>{ const room=currentRoom(socket); const p=room?.patients.find(x=>x.id===patientId); if(!p||p.primaryResult)return cb({ok:false,message:'此傷患已完成一次檢傷'}); p.primaryResult=result;p.primaryBy=socket.data.name;p.lockedBy=null;log(room,`${p.id}一次檢傷：${result}`);cb({ok:true});emitState(room); });
 socket.on('submitSecondary',({patientId,result},cb)=>{ const room=currentRoom(socket); const p=room?.patients.find(x=>x.id===patientId); if(!p||!p.primaryResult)return cb({ok:false,message:'尚未完成一次檢傷'}); p.secondaryResult=result;p.secondaryBy=socket.data.name;p.lockedBy=null;log(room,`${p.id}二次檢傷：${result}`);cb({ok:true});emitState(room); });
 socket.on('requestMoreAmbulances',()=>{ const room=currentRoom(socket); if(!room)return; log(room,`${socket.data.name}回報：救護車不足，請指揮官加派`); io.to(room.roomCode).emit('alert',{targetRole:'commander',message:'後送官回報：救護車不足，請加派支援。'}); emitState(room); });
 socket.on('transport',(p,cb)=>{ const room=currentRoom(socket); if(!room)return cb({ok:false,message:'房間不存在'}); const ps=(p.patientIds||[]).map(id=>room.patients.find(x=>x.id===id)).filter(Boolean); if(!ps.length||ps.length>3)return cb({ok:false,message:'每車需載送1至3人'}); const colors=ps.map(x=>x.secondaryResult||x.primaryResult); if(colors.some(c=>!c||c==='black'))return cb({ok:false,message:'傷患尚未完成檢傷或不可後送'}); const red=colors.filter(c=>c==='red').length,yellow=colors.filter(c=>c==='yellow').length; if(red>1||yellow>1||(red&&yellow))return cb({ok:false,message:'紅黃不可同車，紅或黃每車最多1人'}); const amb=room.resources.find(r=>r.type==='ambulance'&&r.name===p.ambulance); if(!amb||amb.status!=='到達現場')return cb({ok:false,message:'救護車目前不可使用'}); const h=room.hospitals.find(x=>x.name===p.hospital); if(!h)return cb({ok:false,message:'找不到醫院'}); for(const patient of ps){const c=patient.secondaryResult||patient.primaryResult;if((h.capacity[c]||0)<=0)return cb({ok:false,message:`${h.name}${c}容量不足`});} ps.forEach(patient=>{const c=patient.secondaryResult||patient.primaryResult;h.capacity[c]--;patient.transported=true;patient.transportAmbulance=amb.name;patient.transportHospital=h.name;}); amb.status='送醫中';amb.destination=h.name;room.transportLogs.unshift({time:new Date().toLocaleTimeString('zh-TW',{hour12:false}),patientIds:ps.map(x=>x.id),ambulance:amb.name,hospital:h.name,status:'送醫中'});log(room,`${amb.name}後送${ps.map(x=>x.id).join('、')}至${h.name}`);cb({ok:true});emitState(room); });
 socket.on('disconnect',()=>{ const room=currentRoom(socket); if(!room)return; room.members=room.members.filter(m=>m.socketId!==socket.id); room.patients.forEach(p=>{if(p.lockedBy===socket.id)p.lockedBy=null;}); emitState(room); });
});
const PORT=process.env.PORT||3000;server.listen(PORT,'0.0.0.0',()=>console.log(`MCI Trainer TW on ${PORT}`));
