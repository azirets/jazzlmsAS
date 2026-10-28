const crypto = require('node:crypto');
const base = 'http://localhost:8080';
const secret = 'jazzlms-super-secret-key-for-teaching-purposes-only-32b';
const courseId = '549c8b45-1a46-426c-b597-630722cf7319';
const route = `/api/courses/${courseId}/questions`;
async function login(username,password){const r=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});if(!r.ok)throw new Error(`login ${username}: ${r.status}`);return r.json()}
async function request(url, token, method='GET', headers={}){const h={accept:'application/json',...headers};if(token!==null)h.authorization=token.startsWith("Bearer ")||token.startsWith("bearer ")||token.startsWith("Basic ")?token:`Bearer ${token}`;const r=await fetch(url,{method,headers:h});return r.status}
(async()=>{
 const admin=await login('admin','admin123'); const instructor=await login('instructor','instructor123');
 const username=`aziret_sec_${Date.now()}`; const password='TemporaryPass123!';
 const reg=await fetch(`${base}/api/auth/register`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({firstName:'Aziret',lastName:'Security',email:`${username}@example.test`,username,password})}); if(!reg.ok)throw new Error(`temp learner register: ${reg.status}`); const learner=await reg.json();
 const roles={learner:learner.token,instructor:instructor.token,admin:admin.token};
 const cases=[
  ['GET users','/api/users',{learner:403,instructor:200,admin:200}],
  ['GET settings','/api/settings',{learner:403,instructor:403,admin:200}],
  ['GET branches','/api/branches',{learner:403,instructor:200,admin:200}],
  ['GET courses','/api/courses',{learner:200,instructor:200,admin:200}],
  ['GET deleted courses','/api/courses/deleted',{learner:403,instructor:403,admin:200}],
  ['GET course questions',route,{learner:403,instructor:200,admin:200}],
  ['GET notifications','/api/notifications',{learner:403,instructor:403,admin:200}],
  ['GET analytics timeline',`/api/analytics/timeline?userId=${learner.user.id}&size=1`,{learner:403,instructor:200,admin:200}],
  ['GET gamification settings','/api/gamification/settings',{learner:403,instructor:403,admin:200}],
  ['GET gamification me','/api/gamification/me',{learner:200,instructor:200,admin:200}],
  ['GET certificate templates','/api/certificates/templates',{learner:403,instructor:200,admin:200}],
 ];
 const matrix=[]; for(const [name,path,expected] of cases){const row={check:name};for(const role of Object.keys(roles)){const status=await request(`${base}${path}`,roles[role]);row[role]=`${status}${status===expected[role]?' PASS':' EXPECT '+expected[role]}`;}matrix.push(row)}
 const jwtParts=admin.token.split('.');const payload=JSON.parse(Buffer.from(jwtParts[1],'base64url').toString());payload.iat=Math.floor(Date.now()/1000)-7200;payload.exp=Math.floor(Date.now()/1000)-3600;const p=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',secret).update(`${jwtParts[0]}.${p}`).digest('base64url');const expired=`${jwtParts[0]}.${p}.${sig}`;
 const tokenCases={basic:await request(`${base}/api/users`,null,'GET',{authorization:'Basic YWRtaW46YWRtaW4='}),lowercaseBearer:await request(`${base}/api/users`,`bearer ${admin.token}`),expiredSigned:await request(`${base}/api/users`,expired)};
 await new Promise(r=>setTimeout(r,100));const burst=await Promise.all(Array.from({length:60},()=>request(`${base}/api/courses`,admin.token)));const counts=burst.reduce((a,s)=>(a[s]=(a[s]||0)+1,a),{});
 await new Promise(r=>setTimeout(r,2500));const cleanup=await request(`${base}/api/users/${learner.user.id}`,admin.token,'DELETE');
 const direct=[];for(const port of [8081,8082,8083,8084,8085]){for(const path of ['/actuator/health','/swagger-ui/index.html']){const r=await fetch(`http://localhost:${port}${path}`);direct.push({port,path,status:r.status});}}
 console.log(JSON.stringify({matrix,tokenCases,rateLimit60RequestStatuses:counts,temporaryLearnerCleanup:cleanup,directServiceHealthAndSwagger:direct},null,2));
})().catch(e=>{console.error(`${e.name}: ${e.message}`);process.exit(1)});
