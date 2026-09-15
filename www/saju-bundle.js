/* 자동 생성 번들 — 수정하지 말고 build-bundle.js 를 다시 돌리세요 */
(function(){
"use strict";
var __mods = {};
function require(p){
  var k = String(p).replace(/^\.\//,'').replace(/\.js$/,'');
  if (!(k in __mods)) throw new Error('모듈 없음: '+k);
  return __mods[k];
}

/* ===== saju-rules.js ===== */
__mods["saju-rules"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-rules.js — 명리 해석 규칙 엔진
   출처: 정해 만세력 사주강의 9~20강, 나무위키 사주팔자/신살
   원칙
   1) 유파가 갈리는 지점은 임의로 하나를 고르지 않고 opts로 분기
   2) 모든 판정은 evidence(근거)를 함께 반환 — AI 해석 레이어 입력용
   3) 계산은 전부 결정론적. 같은 입력 → 항상 같은 출력
   ============================================================= */

const G = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const J = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const G_KR = ['갑','을','병','정','무','기','경','신','임','계'];
const J_KR = ['자','축','인','묘','진','사','오','미','신','유','술','해'];

// 오행: 0목 1화 2토 3금 4수
const OH = ['목','화','토','금','수'];
const G_OH = [0,0,1,1,2,2,3,3,4,4];
const J_OH = [4,2,0,0,2,1,1,2,3,3,2,4];
const G_YIN = [0,1,0,1,0,1,0,1,0,1];          // 0=양 1=음
// 지지 음양 — 지장간 본기(用) 기준. 실무 만세력 표준이며 적천수 부처장의
// "일지 십성은 지장간 본기로 판정한다"와도 맞는다.
// 체(體) 기준과는 子午巳亥 네 글자가 반대다: 巳=丙(양), 午=丁(음), 亥=壬(양), 子=癸(음).
// 체 기준을 쓰는 유파도 있어 J_YIN_CHE로 함께 노출한다.
const J_YIN     = [1,1,0,1,0,0,1,1,0,1,0,0];  // 用(본기) 기준 — 기본값
const J_YIN_CHE = [0,1,0,1,0,1,0,1,0,1,0,1];  // 體 기준

const SAENG = i => (i + 1) % 5;                // 생하는 대상
const GEUK  = i => (i + 2) % 5;                // 극하는 대상

/* ---------- 십성 (9강·10강) ----------
   일간 대비 오행관계 × 음양동이 */
const SIPSEONG = ['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
const SIPSEONG_GROUP = { 비견:'비겁', 겁재:'비겁', 식신:'식상', 상관:'식상',
  편재:'재성', 정재:'재성', 편관:'관성', 정관:'관성', 편인:'인성', 정인:'인성' };
const GROUPS = ['비겁','식상','재성','관성','인성'];

/* 용희기구한 체인 — [희신, 기신, 구신, 한신] (정해 만세력 15강 표)
   이 표가 여러 파일에 흩어져 있으면 한쪽만 고쳤을 때 조용히 어긋난다.
   운세·영역·궁합이 전부 여기를 참조한다. */
const YONGSIN_CHAIN = {
  비겁:['인성','관성','재성','식상'], 식상:['재성','인성','비겁','관성'],
  재성:['식상','비겁','인성','관성'], 관성:['재성','식상','비겁','인성'],
  인성:['비겁','재성','관성','식상'],
};
const 희신 = g => YONGSIN_CHAIN[g] && YONGSIN_CHAIN[g][0];
const 기신 = g => YONGSIN_CHAIN[g] && YONGSIN_CHAIN[g][1];
/** 용신 그룹 기준으로 어떤 그룹이 어떤 등급인지 */
function unRank(yongsin, group) {
  if (!yongsin || !YONGSIN_CHAIN[yongsin]) return '—';
  if (group === yongsin) return '용신운';
  const c = YONGSIN_CHAIN[yongsin];
  return group === c[0] ? '희신운' : group === c[1] ? '기신운'
       : group === c[2] ? '구신운' : group === c[3] ? '한신운' : '—';
}

function sipseong(dayGan, targetOh, targetYin) {
  const me = G_OH[dayGan], meYin = G_YIN[dayGan];
  const same = meYin === targetYin;
  if (targetOh === me)           return same ? '비견' : '겁재';
  if (targetOh === SAENG(me))    return same ? '식신' : '상관';
  if (targetOh === GEUK(me))     return same ? '편재' : '정재';
  if (GEUK(targetOh) === me)     return same ? '편관' : '정관';
  if (SAENG(targetOh) === me)    return same ? '편인' : '정인';
}
const sipseongOfGan = (d, g) => sipseong(d, G_OH[g], G_YIN[g]);
const sipseongOfJi  = (d, j) => sipseong(d, J_OH[j], J_YIN[j]);

// 십성 → 일간 기준 그룹 오행 인덱스
function groupOh(dayGan, group) {
  const me = G_OH[dayGan];
  return { 비겁: me, 식상: SAENG(me), 재성: GEUK(me),
           관성: (me + 3) % 5, 인성: (me + 4) % 5 }[group];
}

/* ---------- 지장간 (11강) ----------
   월률분야: [천간, 일수] — 월지 적용이 원칙, 한국에선 전 지지에 통용
   인원용사: 월지 외 지지용 (사왕지·해수만 구성이 다름) */
const JIJANGGAN_WOLRYUL = {
  0:  [[8,10],[9,20]],                     // 子 壬10 癸20
  1:  [[9,9],[7,3],[5,18]],                // 丑 癸9 辛3 己18
  2:  [[4,7],[2,7],[0,16]],                // 寅 戊7 丙7 甲16
  3:  [[0,10],[1,20]],                     // 卯 甲10 乙20
  4:  [[1,9],[9,3],[4,18]],                // 辰 乙9 癸3 戊18
  5:  [[4,7],[6,7],[2,16]],                // 巳 戊7 庚7 丙16
  6:  [[2,10],[5,10],[3,10]],              // 午 丙10 己10 丁10
  7:  [[3,9],[1,3],[5,18]],                // 未 丁9 乙3 己18
  8:  [[4,7],[8,7],[6,16]],                // 申 戊7 壬7 庚16
  9:  [[6,10],[7,20]],                     // 酉 庚10 辛20
  10: [[7,9],[3,3],[4,18]],                // 戌 辛9 丁3 戊18
  11: [[4,7],[0,7],[8,16]],                // 亥 戊7 甲7 壬16
};
const JIJANGGAN_INWON = {
  0:[9], 1:[9,7,5], 2:[4,2,0], 3:[1], 4:[1,9,4], 5:[4,6,2],
  6:[5,3], 7:[3,1,5], 8:[4,8,6], 9:[7], 10:[7,3,4], 11:[0,8],
};
/** 지지의 지장간 [초기, 중기, 본기] (본기가 마지막) */
function jijanggan(ji, mode = 'wolryul') {
  if (mode === 'inwon') return JIJANGGAN_INWON[ji].slice();
  return JIJANGGAN_WOLRYUL[ji].map(x => x[0]);
}
const bongi = ji => { const a = JIJANGGAN_WOLRYUL[ji]; return a[a.length - 1][0]; };

/* ---------- 천간합충 (12강) ---------- */
const CHEONGAN_HAP = [[0,5,2],[1,6,3],[2,7,4],[3,8,0],[4,9,1]]; // [간1,간2,합화오행]
const CHEONGAN_CHUNG = [[0,6],[1,7],[2,8],[3,9]];               // 갑경 을신 병임 정계

/* ---------- 지지합충 (13강) ---------- */
const YUKHAP = [[0,1,2],[2,11,0],[3,10,1],[4,9,3],[5,8,4],[6,7,1]];
// 子丑토 寅亥목 卯戌화 辰酉금 巳申수 午未화
const SAMHAP = [[11,3,7,0],[2,6,10,1],[5,9,1,3],[8,0,4,4]]; // [생,왕,고,합화오행]
const BANGHAP = [[2,3,4,0],[5,6,7,1],[8,9,10,3],[11,0,1,4]];
const JIJI_CHUNG = [[2,8],[5,11],[0,6],[3,9],[4,10],[1,7]];
const AMHAP = [[2,1,2],[2,7,2],[3,8,3],[5,9,4],[6,11,0],[10,0,1],[4,0,1]];
// 寅丑토 寅未토 卯申금 巳酉수 午亥목 戌子화 辰子화
const AMMYEONGHAP = [[8,6],[4,0],[3,11],[7,5]];  // 임오 무자 정해 신사 (천간idx, 지지idx)

/* ---------- 형해파 (14강) ---------- */
const SAMHYEONG = {
  인사신: { ji: [2,5,8], name: '인사신 삼형(무은지형)', farOk: true },
  축술미: { ji: [1,10,7], name: '축술미 삼형(지세지형)', farOk: true },
};
const SANGHYEONG = { ji: [0,3], name: '자묘 상형(무례지형)', farOk: true };
const JAHYEONG = [4,6,9,11];  // 진진 오오 유유 해해 — 붙어야 성립
const YUKHAE = [[10,9],[8,11],[7,0],[1,6],[2,5],[3,4]];
const YUKPA  = [[9,0],[1,4],[2,11],[3,6],[8,5],[10,7]];

/* ---------- 십이운성 (18강) ----------
   [천간][지지] → 운성명. 양간 순행 / 음간 역행(양생음사) */
const UNSEONG = ['절','태','양','장생','목욕','관대','건록','제왕','쇠','병','사','묘'];
const UNSEONG_START = [8,9,11,0,11,0,2,3,5,6]; // 각 천간의 '절'에 해당하는 지지
function sibiunseong(gan, ji) {
  const dir = G_YIN[gan] === 0 ? 1 : -1;
  const start = UNSEONG_START[gan];
  const step = ((ji - start) * dir % 12 + 12) % 12;
  return UNSEONG[step];
}

/* ---------- 십이신살 (19강) ---------- */
const SINSAL12 = ['겁살','재살','천살','지살','연살','월살','망신살','장성살','반안살','역마살','육해살','화개살'];
// 기준지(일지 또는 연지)가 속한 삼합그룹의 '생지'에서 시작
const SAMHAP_GROUP = ji => SAMHAP.findIndex(s => s.slice(0,3).includes(ji));
function sibisinsal(baseJi, targetJi) {
  const g = SAMHAP_GROUP(baseJi);
  const saeng = SAMHAP[g][0];                  // 지살 위치
  const start = (saeng - 3 + 12) % 12;         // 겁살 = 지살 3칸 앞
  return SINSAL12[((targetJi - start) % 12 + 12) % 12];
}

/* ---------- 일반신살 ---------- */
const CHEONEUL = { 0:[1,7], 4:[1,7], 6:[1,7], 1:[0,8], 5:[0,8],
                   2:[11,9], 3:[11,9], 7:[6,2], 8:[5,3], 9:[5,3] };
const MUNCHANG = [5,6,8,9,8,9,11,0,2,3];
const YANGIN = { 0:3, 2:6, 4:6, 6:9, 8:0 };            // 양간만
const BAEKHO = [[0,4],[1,7],[2,10],[3,1],[4,4],[8,10],[9,1]];  // 갑진 을미 병술 정축 무진 임술 계축
const GWAEGANG = [[4,10],[6,4],[6,10],[8,4]];                  // 무술 경진 경술 임진
/* 홍염살 — 일간 기준. 도화가 끌어당기는 힘이라면 홍염은 스스로 타오르는 쪽이다.
   책마다 편차가 있어 가장 널리 쓰이는 배치를 따른다. */
/* 현침살 — 글자 모양이 바늘처럼 뾰족한 것. 천간 甲·辛, 지지 卯·午·申.
   많을수록 예리하고 예민하며, 칼·바늘·펜을 쓰는 직역과 인연으로 본다. */
const HYEONCHIM_G = [0, 7];        // 甲 辛
const HYEONCHIM_J = [3, 6, 8];     // 卯 午 申
const HONGYEOM = [6,6,2,7,4,4,10,9,0,8];   // 甲午 乙午 丙寅 丁未 戊辰 己辰 庚戌 辛酉 壬子 癸申
const GWIMUN = { 0:9, 9:0, 1:6, 6:1, 2:7, 7:2, 3:8, 8:3, 4:11, 11:4, 5:10, 10:5 };
const WONJIN = { 0:7, 7:0, 1:6, 6:1, 2:9, 9:2, 3:8, 8:3, 4:11, 11:4, 5:10, 10:5 };
const DOHWA  = { 0:0, 1:3, 2:6, 3:9 };   // 삼합그룹idx → 도화 지지 (연살과 동일)
const YEOKMA = { 0:5, 1:8, 2:11, 3:2 };
const HWAGAE = { 0:7, 1:10, 2:1, 3:4 };

/** 공망: 일주 순(旬)에서 빠진 두 지지 */
function gongmang(dayIdx) {
  const sunStart = dayIdx - (dayIdx % 10);
  const sj = sunStart % 12;
  return [(sj + 10) % 12, (sj + 11) % 12];
}

/* ---------- 나이 ----------
   대운 시작 나이는 '절입까지 날수 ÷ 3'으로 나오는 만 나이다.
   화면이나 에이전트가 세는 나이로 비교하면 8명 중 1명꼴로 현재 대운이 한 칸 밀린다.
   그래서 비교는 언제나 이 함수가 내는 만 나이(소수 포함)로 한다. */
/* 조사 — 받침에 따라 갈린다. 코드로 문자열을 이어붙이면 "수이 死", "편재은 잠겨"처럼
   틀린 조사가 그대로 나간다. 변수 뒤에 조사를 붙일 때는 반드시 이 함수를 쓴다.
   josa('수','이가') → '수가' / josa('금','이가') → '금이' */
/* 간지 한자는 읽는 음에 받침이 있는 것과 없는 것이 섞여 있다.
   甲(갑)·寅(인)·申(신)은 받침이 있고, 己(기)·巳(사)·午(오)는 없다.
   코드로는 알 수 없으니 표로 둔다. */
const HANJA_BATCHIM = {
  甲:1, 乙:1, 丙:1, 丁:1, 戊:0, 己:0, 庚:1, 辛:1, 壬:1, 癸:0,
  子:0, 丑:1, 寅:1, 卯:0, 辰:1, 巳:0, 午:0, 未:0, 申:1, 酉:0, 戌:1, 亥:0,
};
function josa(word, pair) {
  const w = String(word);
  const last = w[w.length - 1];
  if (HANJA_BATCHIM[last] !== undefined) return w + (HANJA_BATCHIM[last] ? pair[0] : pair[1]);
  const c = last.charCodeAt(0) - 0xAC00;
  const has = c >= 0 && c < 11172 ? (c % 28) !== 0 : true;  // 판단 불가면 받침 있는 쪽
  return w + (has ? pair[0] : pair[1]);
}

function ageOf(y, m, d, at) {
  const born = Date.UTC(y, (m || 1) - 1, d || 1);
  const now = at ? (at instanceof Date ? at.getTime() : at) : Date.now();
  return Math.round(((now - born) / (365.2425 * 86400000)) * 100) / 100;
}
const ageKor = (y, at) => ((at ? new Date(at) : new Date()).getFullYear() - y + 1);  // 세는 나이(표시용)

/* ---------- 조후 한난조습 (15강) ----------
   15강은 한/난/조/습을 집합으로만 나누는데, 그대로 세면 甲·乙(목)이 丙·丁(화)과
   같은 무게로 온기를 내게 된다. 실제로는 목은 온기로 치지 않아서
   子월 乙일간 사주가 '중화'로 오판됐다. 그래서 집합이 아니라 점수로 둔다.
   온도: 양수가 따뜻함, 음수가 차가움 / 습도: 양수가 건조, 음수가 습함 */
const G_TEMP = [ 0.5, 0.5, 2.0, 1.5, 0.5, -0.5, -1.0, -1.0, -1.5, -1.5 ];
const J_TEMP = [ -2.0, -1.5, 1.0, 0.5, 0.0, 1.5, 2.0, 1.0, -1.0, -1.0, 0.0, -1.5 ];
const G_DRY  = [ 0.0, 0.0, 1.5, 1.0, 1.0, -0.5, 0.0, 0.0, -1.5, -1.5 ];
const J_DRY  = [ -1.5, -1.5, 0.5, 0.0, -1.0, 1.0, 1.5, 1.5, 0.0, 0.0, 1.0, -1.0 ];
/* 월지 계절은 조후를 결정하는 축이라 따로 가산한다 */
const SEASON_TEMP = { 11:-2, 0:-2, 1:-1.5, 2:0.5, 3:1, 4:0.5, 5:1.5, 6:2, 7:1.5, 8:-0.5, 9:-1, 10:-0.5 };
/* 15강의 원래 집합 — 유파 비교용으로 남겨둔다 */
const HAN_G = [5,6,7,8,9], NAN_G = [0,1,2,3,4];
const JO_G  = [2,3,4],     SEUP_G = [5,8,9];
const HAN_J = [8,9,11,0,1], NAN_J = [2,3,5,6,7];
const JO_J  = [5,6,7,10],   SEUP_J = [11,0,1,4];

module.exports = {
  G, J, G_KR, J_KR, OH, G_OH, J_OH, G_YIN, J_YIN, J_YIN_CHE, SAENG, GEUK,
  SIPSEONG, SIPSEONG_GROUP, GROUPS, YONGSIN_CHAIN, 희신, 기신, unRank, sipseong, sipseongOfGan, sipseongOfJi, groupOh,
  JIJANGGAN_WOLRYUL, JIJANGGAN_INWON, jijanggan, bongi,
  CHEONGAN_HAP, CHEONGAN_CHUNG, YUKHAP, SAMHAP, BANGHAP, JIJI_CHUNG, AMHAP, AMMYEONGHAP,
  SAMHYEONG, SANGHYEONG, JAHYEONG, YUKHAE, YUKPA,
  UNSEONG, sibiunseong, SINSAL12, sibisinsal, SAMHAP_GROUP,
  CHEONEUL, MUNCHANG, YANGIN, BAEKHO, GWAEGANG, GWIMUN, WONJIN, DOHWA, YEOKMA, HWAGAE, HONGYEOM, HYEONCHIM_G, HYEONCHIM_J, gongmang,
  HAN_G, NAN_G, JO_G, SEUP_G, HAN_J, NAN_J, JO_J, SEUP_J,
  G_TEMP, J_TEMP, G_DRY, J_DRY, SEASON_TEMP, ageOf, ageKor, josa, HANJA_BATCHIM,
};

return module.exports; })();

/* ===== saju-engine.js ===== */
__mods["saju-engine"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   만세력 엔진 (saju-engine.js)
   - 절기: 태양 겉보기 황경 기준, 1900~2100 사전계산 테이블 (UTC)
   - 한국 표준시 이력 + 서머타임 전 구간 반영 (IANA tzdata)
   - 진태양시: 경도 보정 + 균시차(선택)
   외부 의존성 없음. 브라우저/Node 공용.
   ============================================================= */

const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JI  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const GAN_KR = ['갑','을','병','정','무','기','경','신','임','계'];
const JI_KR  = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const GAN_OH = ['목','목','화','화','토','토','금','금','수','수'];
const GAN_EUMYANG = ['양','음','양','음','양','음','양','음','양','음'];
const JI_OH = ['수','토','목','목','토','화','화','토','금','금','토','수'];

const TERM_NAMES = ['소한','대한','입춘','우수','경칩','춘분','청명','곡우','입하','소만',
                    '망종','하지','소서','대서','입추','처서','백로','추분','한로','상강',
                    '입동','소설','대설','동지'];
// 節(월 경계) = 짝수 인덱스: 소한(0) 입춘(2) 경칩(4) 청명(6) ... 대설(22)
const IS_JEOL = i => i % 2 === 0;

const TERM_BASE_YEAR = 1898, TERM_END_YEAR = 2102;
// 1898~2100년 24절기 UTC 시각 (태양 겉보기황경 기준, base36 · 연초 경과분)
let TERM_DATA = '04qo0l3t11ig1i021yle2fbj2w6o3d783ucu4bmy4t0q5agv5ry869f06qu878637pe486gz8nev94789kuxa1e2ahu4ay7n050h0lde11s71i9k1yv22fky2wg93dgl3umb4bwb4ta55aqa5s7m69oj6r3o78ft7pno86qu8nok94h79l4na1o1ai3tayhk05a40ln8121s1ijd1z4m2fur2wpt3dqf3uvv4c654tjr5b045sha69yc6rdf78pk7pxh870k8nyd94qv9lega1xoaidkayr605jt0lws12bg1isx1zeb2g4c2wzk3e023v5r4cft4ttp5b9s5sr86a806rna78z87q7a87a98o87950m9loba27hainhaz1105tr0m6o12le1j2s1zo82ge52x9e3e9s3vff4cpi4u385bjf5t0n6ahm6rwm798t7qgn87jv8ohl95ac9lxua2hbaix5azaz063k0mgp12v71jct1zxz2go32xj23ejn3vp24cz94ucv5bt55tad6arb6s6g79ii7qqi87tk8ori95jz9m7pa2qxaj6zazkk06dd0mqa13501jmd207s2gxn2xsv3et63vyv4d8t4ump5c2s5tk86b126sgc79sd7r0e883g8p1c95tv9mhha30sajgpazue05j30lw412as1is91zdm2g3m2wyr3dz83v4q4cev4tsi5b8s5spw6a6y6rlx78y57q5y87968o6w94zk9ln2a26haimbaz0405sp0m5v12kg1j221znc2gdh2x8j3e933vel4cop4u2d5bii5szs6agl6rvs797q7qfs87ir8ogr95979lwza2g6aiw9az9t062n0mfj12ub1jbm1zx32gmx2xi73eih3vo64cy34ubx5brz5t9b6aq66s5c79hg7qpe87sl8oqf95j49m6oa2q4aj5zazjr06cd0mpg133z1jli206q2gwr2xrs3esb3vxr4d7y4ulj5c1v5tj06b026sf379r97qz4882a8p0395sp9mgaa2znajfkazt905hx0luz129l1ir21zcd2g2d2wxi3dxy3v3j4cdl4tre5b7i5sow6a5p6rkz78ww7q4z877x8o5v94yb9lm1a258ailbayyw05rq0m4n12jf1j0s1zm92gc32x7b3e7m3vd84cn64u0x5bh15sy96af76ru9796g7qea87hj8of9957z9lvha2ezaiutaz8o06190mef12sy1jak1zvr2glu2xgt3ehc3vmo4cwv4uae5bqo5t7t6aot6s3x79g17qo187r68op395hm9m5ba2okaj4kazi506av0mnt132h1jjw20592gv52xqc3eqo3vwb4d694uk45c055thl6aye6sdp79pq7qxu880w8oyv95re9mf3a2ycajebazrx05gm0ltj12871ipk1zax2g0u2ww03dwf3v1z4cc24tpq5b5y5sn36a446rj478vc7q37876h8o4894wz9lkia23zaijtayxn05q70m3c12ht1ize1zkk2gan2x5m3e653vbk4clq4tzc5bfj5swr6adn6rst794u7qcx87fy8odz956h9luba2dkaitpaz7a06040mcz12rp1j8z1zuc2gk32xf93efh3vl34cuz4u8s5bou5t686an36s2c79ef7qmh87po8onl95ga9m3ya2ndaj3cazh4069s0mmu131e1jiu20412gtz2xoy3epd3vuq4d4u4uie5byp5tfu6awx6sbz79o97qw587zf8ox895px9mdia2wyajcuazqm05f90lsd126y1ioh1z9p2fzp2wuq3dv63v0m4can4tob5b4f5slq6a2k6rhu78tu7q2087508o3294vk9ljda22laiipaywa05p40m2012gt1iy51zjl2g9e2x4l3e4u3vae4cka4txz5be05sv86ac46rr8793d7qbc87em8ocg95599lsva2ceaisaaz6505yr0mbx12qf1j7z1zt62gj72xe53een3vjy4cu34u7l5bnu5t4x6alx6s0y79d47ql487ob8om995ex9m2oa2m1aj22azfr068h0mlg13021jhh202r2gsn2xnr3eo33vtn4d3m4uhf5bxg5tev6avn6say79mx7qv387y48ow595op9mcha2vrajbuazph05ea0lr7125w1in81z8l2fyf2wtl3dtw3uzg4c9h4tn65b3c5skj6a1i6rgk78sr7q0m873w8o1n94ue9lhxa21gaihbayv705nt0m1012fi1ix41zia2g8d2x3a3e3t3v954cja4twv5bd35sua6ab86rqd792g7qai87dm8obl95459lrxa2b7airbaz4x05xq0man12pc1j6o1zs02ght2xcy3ed63viq4csl4u6f5bmf5t3u6akp6s0179c47qk987ng8olf95e39m1sa2l6aj15azet067h0mkg12z21jgf201o2grk2xml3emz3vse4d2h4ug25bwc5tdi6aum6s9o79m07qty87xa8ov495nw9mbha2uyajatazol05d50lq8124p1im71z7c2fxc2wsb3dsr3uy64c894tlx5b225sjd6a096rfj78rl7pzs872v8o0z94tj9lhea20naigsayud05n60m0012eq1ivz1zhc2g712x263e2c3v7w4chr4tvi5bbi5ssu6a9p6row79127q9487cf8oad95369lqwa2afaiqfaz4905wx0ma012oi1j5y1zr22ggz2xbu3ec83vhh4crk4u515bla5t2e6ajh6ryk79au7qiu87m58ok395cv9m0la2k2aj02azdu066j0mjl12y41jfj200p2gqk2xlj3elt3vr84d144uet5buv5tc86at26s8g79kh7qsq87vu8oty95mj9maea2toaj9tazng05ca0lp6123x1il71z6k2fwb2wrf3drm3ux44c704tkn5b0p5shw69yt6rdx78q57py4871g8nzb94s59lfra1zcaif8ayt505lq0lyx12df1iv01zg52g662x113e1i3v6r4cgu4tua5bah5srk6a8i6rnl78zq7q7t87b08o92951q9lpka28yaip3az2r05vk0m8h12n51j4g1zpq2gfi2xak3eas3vga4cq44u3u5bjs5t166ahy6rx9799a7qhh87kn8oir95bf9lzaa2ipaiysazch06590mi712wt1je41zzd2gp62xk63ekg3vpv4czv4udg5btn5tas6aru6s6w79j67qr387ug8osa95l49m8qa2saaj86azm205an0lnt12291ijs1z4v2fuv2wpr3dq63uvi4c5l4tj65azc5sgl69xi6rcq78ot7pwy87018ny494qo9leja1xtaidzayrl05kg0lxd12c41ite1zeq2g4g2wzk3dzo3v574cez4tsq5b8o5sq16a6u6rm478y87q6c879l8o7l950c9lo3a27kainkaz1d05u20m7412lp1j341zoa2ge62x923e9e3veo4cop4u265bie5szi6agl6rvo79807qg087je8ohc95a59lxua2hbaix9azb1063n0mgo12v51jcl1zxp2gnm2xij3eiv3vo94cy84ubv5bry5t9a6aq66s5j79hn7qpx87t28or995ju9m7ra2r1aj76azkr059k0lmd12111ii91z3k2ft92wod3doj3uu34c3x4thn5axo5sey69vv6rb278na7pvc86yp8nwn94pj9ld7a1wsaicqayqm05j70lwb12ar1is81zda2g372wy13dyf3v3n4cdq4tr75b7g5sok6a5l6rkp78wy7q50878c8o6d94z69ln0a26iaimmaz0d05t40m6312km1j1x1zn22gcs2x7p3e7v3vd94cn34u0s5bgs5sy76af16rug796j7qeu87i28og9958y9lwwa2gaaiwhaza606300mfw12uj1jbs1zx02gmo2xhn3ehr3vn44cwz4uak5bqp5t7w6aoy6s4479gh7qoh87ry8opu95ir9m6fa2q1aj5yazjv058g0llm12021ihk1z2m2fsk2wnd3dnr3usy4c2z4tgf5awl5sdr69uq6r9y78m57puc86xl8nvq94of9lcca1vqaibwaypk05ie0lvb12a01irb1zcl2g2b2wxc3dxf3v2v4ccl4tq95b645sng6a486rji78vm7q3u87758o5a94y39llza25iailnayzf05s70m5712js1j141zmb2gc32x6z3e783vch4cmf4tzv5bg05sx36ae56rt7795j7qdj87h08oez957w9lvna2f9aiv9az95061r0mev12tb1jar1zvs2glp2xgi3egu3vm44cw34u9n5bpq5t706anw6s3779fb7qnk87qq8oox95hk9m5ja2ovaj54azir057m0lki11z71igf1z1q2frd2wmg3dmj3us14c1s4tfi5avg5scr69tm6r8t78kz7pt286we8nud94n89laya1ujaiakayof05h40lu9128s1iq81zbd2g192ww33dwe3v1m4cbm4tp15b595smb6a3d6rig78uq7q2s87658o4594wz9lkra24aaikcayy505qu0m3v12ie1izs1zkw2gap2x5k3e5r3vb34ckx4tyj5bej5svw6acq6rs579497qcl87ft8oe1956q9luoa2e2aiu8az7v060o0mdi12s61j9d1zum2gk92xf93efd3vks4cum4u895bob5t5k6amk6s1q79e37qm587pm8onk95gi9m47a2ntaj3qazhl05650lj811xn1if31z032fq02wks3dl53uqd4c0f4tdv5au35sb869s96r7f78jo7pru86v68ntb94m39la0a1tgai9laynb05g30lt0127l1iot1z9z2fzn2wuk3dun3v014c9r4tnf5b3c5skp6a1i6rgv78sz7q1a874k8o2s94vl9ljka232aijaayx105pu0m2s12hd1iym1zjr2g9e2x493e4c3v9l4cjg4twx5bd15su66ab96rqe792s7qau87ed8occ955c9lt3a2craisqaz6o05za0mce12qt1j891zt72gj22xdr3ee13vj64ct44u6l5bmp5t3x6akw6s0779cf7qkq87o08om895ey9m2ya2mcaj2jazg705520lhx11wm1idt1yz22foo2wjp3djp3up44byt4tcg5asc5s9n69qg6r5r78hx7pq586ti8nrm94ki9l8da1ryai81aylv05el0lrn12671ink1z8p2fyh2wtb3dtk3uyq4c8o4tm15b265sj76a096rfb78ro7pzq87378o1994u89li3a21qaihsayvo05oc0m1e12fu1ix71zi72g7z2x2r3e2y3v864ci04tvk5bbk5ssu6a9p6rp279177q9k87ct8ob4953v9lrxa2bdairnaz5b05y60mb012po1j6t1zs02ghk2xcj3eck3vhy4crp4u5c5blc5t2m6ajk6rys79b37qj787mn8oko95dm9m1ea2l2aj12azez053m0lgr11v71icm1yxm2fng2wi73dih3unm4bxn4tb15ar95s8c69pf6r4k78gw7pp086se8nqi94jc9l78a1qrai6waykp05dg0lqg12511imc1z7h2fx62ws03ds33uxd4c734tko5b0l5shy69yr6re578qa7pyn871x8o0794sz9lh0a20haigqayug05na0m0712eu1iw11zh92g6v2x1r3e1t3v734cgu4tuc5bae5srk6a8m6rns79087q8c87bw8o9y952z9lqqa2afaiqdaz4a05wu0m9y12ob1j5q1zqo2ggj2xb83ebi3vgn4cqm4u415bk65t1d6aie6rxo799z7qi987ln8ojx95cq9m0qa2k6aj0eaze2052v0lfp11ua1ibg1ywn2fm82wh63dh73uml4bwa4t9y5apu5s7769o06r3d78fj7pnt86r68npf94ib9l6aa1pwai62ayjv05cn0lpm12451ilf1z6h2fw62wqy3dr33uwa4c654tjj5azo5sgr69xu6rcy78pd7pxf870z8nz294s49lfza1zqaiftaytr05me0lzi12dw1iv91zg52g5w2x0j3e0o3v5s4cfm4tt35b945sqe6a7b6rmq78yy7q7c87ao8o90951t9lpwa29daippaz3e05wa0m9512nt1j4x1zq42gfm2xai3eaf3vfr4cpe4u305bix5t086ah56rwg798r7qh087kh8oim95bl9lzfa2j3aiz5azd1051q0let11ta1iao1yvp2flh2wg73dge3uli4bve4t8q5aow5s5y69n06r2578ej7pmo86q68nob94ha9l57a1otai4xayis05bi0lok12321ike1z5f2fv52wpx3dq03uv74c4w4tie5aya5sfj69wb6rbp78nu7pw886zj8nxx94qr9leva1yeaieqaysg05lc0ly712cv1iu01zf62g4p2wzl3dzj3v4u4cei4ts05b7z5sp56a646rlb78xp7q5u879e8o7h950k9loda284aio5az2405uq0m7u12m71j3l1zoi2gea2x8x3e953ve84co64u1j5bhp5syu6afw6rv3797f7qfo87j28oha95a69ly5a2hoaixwazbo050h0lde11rz1i961yub2fjw2wer3der3uk24btq4t7c5an75s4k69lc6r0q78cv7pl786oj8nmt94fn9l3na1n7ai3fayh805a20ln0121m1iiu1z3y2ftk2woe3dof3utm4c3d4tgs5awv5sdz69v16ra678mm7puq86yb8nwe94pg9ldaa1x0aid1ayr005jl0lwp12b11isf1zdb2g322wxo3dxu3v2w4ccr4tq55b685snf6a4f6rjs78w37q4i877x8o6b94z59ln9a26qain0az0o05ti0m6b12kw1j1z1zn42gcl2x7h3e7e3vcp4cmc4tzy5bfu5sx76ae36rth795r7qe387hl8ofu958t9lwra2gfaiwjazad04z10lc011qg1i7p1ysp2fic2wd23dd63uia4bs64t5j5alp5s2s69jw6qz178bi7pjn86n98nlf94ei9l2ga1m6ai2aayg8058w0lly120c1ihn1z2j2fs72wmt3dmv3ury4c1o4tf45av25scb69t66r8l78kt7pt986wm8nv394nz9lc6a1vqaic5aypw05it0lvo12ab1ire1zci2g1x2wwq3dwj3v1r4cbc4tou5b4r5sm06a2y6ri978uo7q2x876j8o4q94xu9llra25jailmayzl05s90m5d12jr1j141zm02gbq2x6a3e6f3vbf4cl94tyj5beo5svr6acv6rs2794i7qcs87gc8oem957m9lvna2f9aivhaz9b04y30lb211pl1i6u1yrw2fhi2wca3dc93uhg4br34t4k5ake5s1o69ig6qxu78a07pig86lt8nk894d59l1aa1kvai17ayez057v0lks11zf1igl1z1q2fra2wm33dm23ur94c0x4teb5aua5sbd69sc6r7i78jx7ps286vp8ntv94n19laya1usaiawayox05hj0luo12901iqd1zb82g0y2wvi3dvn3v0n4cai4tnt5b3w5sl16a216rhb78tn7q20875g8o3u94ws9lkxa24iaikuayym05rh0m4c12ix1j021zl42gam2x5f3e5b3val4ck64txs5bdn5sv06abu6rr9793h7qbu87f98odj956h9luia2e5aiudaz8804x10la011oj1i5s1yqt2fgf2wb53db73ugb4bq44t3h5ajl5s0o69hs6qwx789e7phj86l58nja94cd9l08a1k0ai03aye2056q0ljv11y91ifm1z0j2fq82wkt3dkw3upw4bzn4td05asz5sa769r46r6i78ir7pr886um8nt294ly9la4a1tnaia0aynq05gn0lth12841ip61zab2fzr2wuk3due3uzn4c974tmq5b2l5sjv6a0s6rg678sk7q0w874i8o2r94vu9ljsa23iaijmayxi05q50m3512hj1iys1zjp2g9c2x3y3e423v934ciy4tw95bce5sth6aam6rpu792c7qam87e98ocj955m9ltla2dbaitgaz7b04vz0l8x11nc1i4j1ypg2ff22w9q3d9q3uev4boj4t205ahw5rz769g16qvg787o7pg586jj8ni194ay9kz5a1irahz4aycw055s0lim11x81ie91yzc2for2wji3djc3uoj4by44tbl5ari5s8p69pp6r4y78he7ppn86tb8nrj94kq9l8pa1skai8paymq05fd0lsg126s1io21z8u2fyg2wsw3dsy3uxu4c7m4tkv5b0z5si369z66reh78qy7pzc872x8o1c94ud9liia225aiigaywa05p30m2012gj1ixn1zin2g832x2r3e2l3v7q4ch94tur5bal5srx6a8r6ro8790i7q9087ch8oax953w9ls1a2boairyaz5s04um0l7j11m31i381yoa2fds2w8i3d8f3udi4bn64t0h5agh5rxk69em6qts786a7pei86i88ngf949n9kxla1hhahxlaybm05490lhd11vq1id21yxv2fnj2wi13di33un04bwq4t9y5apx5s7169ny6r3a78fl7po286rk8nq294j29l7ba1qzai7eayl705e40lqz125k1imm1z7o2fx22wrt3drk3uwr4c684tjq5azj5sgt69xn6rd178pd7pxr871c8nzp94st9lgwa20oaigwayuu05nk0m0k12f01iw71zh42g6o2x193e193v694cg04tta5b9e5sqg6a7l6rms78za7q7i87b78o9f952l9lqla2aeaiqkaz4j04t80l6b11kp1i1z1ymu2fch2w713d713uc24blq4sz35af05rw869d36qsi784q7pd886gm8nf494819kw9a1fvahwaaya205300lfv11uj1ibm1ywq2fm42wgw3dgo3ulu4bvd4t8t5aoo5s5w69mt6r2478ek7pmv86qj8not94i09l60a1puai5zayjz05cm0lpo12411ilb1z642fvq2wq83dqa3uv64c4y4ti75ayb5sfd69wi6rbs78ob7pwp870d8nyr94rv9lfza1zpaifyaytt05mj0lzg12dw1iv11zfy2g5f2x023dzy3v524cen4ts55b805spc6a676rlp78xz7q6i87a08o8j951j9lpqa29daipqaz3i04sc0l5611jq1i0r1yls2fb72w5w3d5r3uaw4bki4sxx5adw5rv269c46qrc783v7pc586fw8ne5947f9kvfa1fbahvhay9j05260lfa11tl1iav1yvl2fl72wfl3dfl3ukf4bu64t7e5anf5s4j69lk6r0w78db7pls86pd8nnw94gz9l58a1oyai5dayj805c50lp1123l1ikn1z5m2fuy2wpl3dpa3uud4c3t4th95ax15sed69v86raq78n37pvm86z88nxo94qs9leya1ypaiezaysw05lp0lyn12d41iu91zf72g4n2wz83dz43v424cdq4tqz5b705so26a576rkf78x17q5b87948o7e950n9looa28jaiopaz2p04rd0l4g11it1i031ykw2faj2w503d503u9x4bjk4swu5acq5rtv69aq6qq4782f7pay86eg8nd194629kuda1e0ahuhay8905170le211so1i9p1yur2fk42weu3dek3ujp4bt54t6l5amd5s3k69kf6qzr78c57pkj86o78nml94fu9l3ya1nuai42ayi205as0lns12251ijc1z452fto2wo53do33usz4c2p4tfw5avz5sd069u46r9c78lw7pu886xz8nwd94pk9ldpa1xjaidtayrs05ki0lxi12bw1it21zdw2g3d2wxv3dxq3v2r4ccb4tpq5b5l5smv6a3q6rj878vh7q41877i8o6194z19lnaa26yaindaz1504q30l2x11hj1hyk1yjl2f8x2w3m3d3d3u8h4bi04sve5aba5rsh699h6qos781a7p9l86db8nbl944u9ksua1crahsxay6z04zn0lcr11r31i8d1yt52fiq2wd33dd23uhv4brk4t4p5akq5s1s69iu6qy578an7pj386mr8nl994ee9l2na1meai2raygm059g0lmd120u1ihx1z2u2fs72wmt3dmj3urk4c104tef5au75sbi69sc6r7v78k87psu86wf8nuz94o39lcca1w2aiceayq805j10lvv12ac1ird1zcb2g1o2wwa3dw33v144cap4to05b405sl36a276rhg78u27q2e87688o4l94xx9llya25waim2az0404oq0l1s11g21hxa1yhz2f7k2w1y3d1w3u6r4bgf4stn5a9m5rqq697o6qn177zf7p7y86bj8na494379krka1baahrsay5n04yl0lbg11q01i701yry2fh82wbu3dbi3ugk4bpy4t3e5aj55s0f69h96qwp78937phl86l98njq94cz9l16a1l2ai1eayfe05860ll611zl1igp1z1i2fqx2wlc3dl53upz4bzl4tcs5ast5s9u69r06r6a78ix7pra86v58ntj94mu9laza1uwaib5ayp605hw0luy129a1iqh1zb92g0q2wv63dv03uzw4c9g4tmq5b2l5sjt6a0p6rg778sj7q15874p8o3c94we9lkqa24eaikvayyn04nm0l0g11f11hw11yh32f6e2w123d0r3u5u4bfa4ssn5a8g5rpn696k6qlx77ye7p6s86ak8n8y942a9kqea1acahqkay4n04xc0laf11or1i5z1yqq2fg92wan3dak3ufc4boz4t235ai35rz369g66qvf787y7pge86k58nio94bx9l07a1k2ai0gayef05780lk711ym1ifq1z0k2fpx2wkf3dk63up54byl4tby5arq5s9069pv6r5e78hp7pqc86tx8nsj94ln9l9za1tpaia5ayo005gw0ltr128a1ipa1za72fzi2wu43dtt3uyu4c8d4tlp5b1m5sis69zu6rf578rr7q03873x8o2994vm9ljoa23maijtayxw04mk0kzn11dy1hv71yfx2f5h2vzt3czr3u4j4be74srd5a7c5rof695g6qks77x87p5r869e8n7y94139kpea195ahplay3g04wd0l9911ns1i4u1yps2ff32w9p3d9d3ued4bnr4t155agv5ry669f06quj786x7pfi86j68nhr94ay9kz8a1j1ahzeaydb05630liz11xe1ieg1yza2fom2wj33div3unr4bxb4taj5aqi5s7l69or6r4178gq7pp586t28nri94kw9l90a1szai96ayn705fu0lsv12731io91z8x2fye2wsq3dsl3uxf4c714tkb5b085shf69yd6rdu78q97pyw872j8o1794ub9liqa22gaiixaywq04ln0kyg11cz1htw1yeu2f412vyn3cy93u3b4bcp4sq45a5w5rn669436qji77vz7p4h86898n6r94039koba18aaholay2n04ve0l8f11mr1i3v1yok2fdx2w883d803ucq4bmb4sze5afe5rwe69dj6qst785g7pdw86hs8nga949o9kxxa1hwahyaaycc05550li511wi1idm1yyc2fno2wi13dhq3umj4bvx4t965aoy5s6769n36r2n78f17pnr86re8nq494j99l7na1rfai7xaylr05ep0lrj12631in11z7z2fx62wrq3drc3uwa4c5o4tiy5ayr5sfw69ww6rc978ov7pxb87188nzo94t39lh8a218aihhayvk04k90kxc11bm1hsu1ydj2f312vxc3cx83u1x4bbj4sol5a4i5rlh692i6qhs77ua7p2s866j8n5593yf9kmsa16nahn4ay1304tz0l6x11le1i2g1ynb2fcm2w743d6r3ubp4bl14syc5ae15rv969c16qrj783v7pch86g58net94829kwga1gbahwsayaq053m0lgi11uy1ibx1ywr2fm12wgh3dg63ul14bui4t7q5ann5s4p69lt6r1378dq7pm486q28noh94hx9l62a1q4ai6dayki05d60lqa124j1ilq1z6d2fvt2wq33dpx3uuo4c4a4thg5axe5sei69vi6rax78nd7pvy86zl8ny894rd9lfra1ziaig0aytv04iu0kvp11a81hr81yc52f1e2vvy3cvk3u0k4b9w4sna5a305rka69166qgo77t47p1o865e8n3y93x89klha15dahlqaxzq04si0l5i11jw1i101ylr2fb42w5h3d573u9y4bjh4swk5acj5rtj69ap6qpz782o7pb586f38ndl94709kv8a1f8ahvjay9l052b0lfc11tm1iar1yvf2fkt2wf43dev3ujn4bt44t6c5am55s3d69ka6qzv78cb7pl286or8nnj94gp9l55a1owai5fayj705c40lov123d1ik81z542fua2wot3doe3ute4c2r4tg45avx5sd569u56r9l78m67puq86yn8nx694qm9leua1yvaif5ayt804hw0kuw11951hq91yaw2f0a2vuk3cud3tz24b8n4slp5a1p5rip68zt6qf477rq7p0886438n2q93w39kkha14gahkxaxyy04rs0l4r11j51i061ykw2fa52w4i3d443u8x4bi94svj5ab85rsi699c6qox781c7pa286dr8ncj945s9ku9a1e5ahuoay8m051j0lee11sv1i9s1yul2fjq2we63ddp3uij4brv4t535akx5s2169j56qyi78b87pjq86nr8nm994fs9l40a1o3ai4dayii05b70lob122j1ijq1z4b2ftr2wny3dnq3usd4c1x4tez5auw5sbx69sz6r8d78kw7ptj86xb8nw194pb9ldqa1xlaie4ays004gy0ktt118b1hpb1ya62eze2vtw3ctg3tyd4b7n4skz5a0m5rhv68yo6qe777qm7oz986318n1p93v29kjga13eahjvaxxv04qq0l3o11i31hz41yjv2f942w3h3d343u7v4bha4sud5aa95rr8698c6qnl780a7p8q86cq8nb9944s9kt2a1d7ahtkay7q050g0ldj11rs1i8x1ytj2fiw2wd33dct3uhi4bqz4t435ajx5s1269i06qxi789y7pio86md8nl594ed9l2ua1moai39ayh405a30lmx121f1iib1z372fsb2wmt3dmb3ur94c0j4tdw5atm5sav69rt6r7a78jt7pse86w98nut94o79lcha1whaicuayqw04fo0ksp11711ho51y8t2ey62vsg3cs73twu4b6d4sje59zc5rga68xe6qco77pc7oxt861q8n0b93tq9ki1a121ahifaxwi04pb0l2c11go1hxs1yih2f7t2w243d1r3u6j4bfv4st25a8s5rpz696u6qmf77yu7p7l86bb8na4943d9krva1bpahs9ay6404z10lbt11qa1i751yrz2fh32wbk3db23ufy4bp94t2i5aia5rzg69gh6qvw788l7ph686l78njr94da9l1ja1lnai1xayg1058o0llp11zw1igz1z1j2fqw2wl33dku3uph4bz24tc45as35s9469q76r5k78i67pqs86un8ntd94mq9lb5a1v3aiblaypj04ee0kra115o1hmm1y7d2ewj2vqx3cqg3tvb4b4m4shx59xm5rew68vq6qbb77nr7owh86088mz093sc9kgta10rahhbaxvb04o70l1311fi1hwf1yh52f692w0k3d023u4s4be44sr85a725ro469586qkl77xc7p5v869x8n8i94239kqea1akahqxay5404xu0lax11p51i6a1yqt2fg42wa83d9w3ueg4bnw4t0x5agr5rxu69ev6que786y7pfq86jk8nid94bo9l07a1k2ai0mayej057h0lka11ys1ifo1z0i2fpl2wk13djh3uoc4bxk4tau5aqi5s7q69on6r4678gq7ppg86tc8ns294li9l9wa1txaiacayoe04d60kq5114h1hli1y662evg2vpq3cpd3tu04b3f4sgf59wb5rd868uc6q9m77mb7out85yu8mxg93r19kfea0zjahfyaxu304mv0kzx11e71hva1yfw2f572vzf3cz23u3q4bd24sq65a5x5rn1693x6qjg77vw7p4o868g8n7c940n9kp9a196ahptay3q04wp0l9i11nz1i4t1ypl2fen2w913d8g3udb4bmj4szs5afi5rwp69dp6qt5785t7pef86if8nh294al9kyya1j2ahzgaydl056c0lje11xm1iep1yz92fok2wip3did3umy4bwh4t9h5apg5s6g69nk6r2x78fl7po686s38nqr94k79l8la1slai93ayn504bz0koz113c1hkd1y532eub2vom3co63tsx4b274sff59v45rcd68t86q8u77la7ou285xu8mwo93pz9keia0yeahezaxsx04lw0kyq11d71hu31yev2f3y2vya3cxr3u2h4bbr4sov5a4n5rlp692s6qi777uy7p3j867n8n6a93zw9ko8a18eahoray2x04vm0l8o11mv1i3z1yoh2fds2w7w3d7k3uc34blk4syj5aef5rvh69ck6qs1784o7pdf86hc8ng6949l9ky4a1i1ahymaycj055f0li811wm1idh1yy72fna2whn3dh43ulx4bv54t8g5ao45s5e69ma6r1w78ef7pn786r38npx94jd9l7va1rwai8eaymf04b90ko5112i1hjf1y422et72vng3cmz3trm4b0z4se059tv5rau68ry6q7977k17osk85wn8mva93ow9kdaa0xiahdyaxs604ky0ky111ca1htd1ydv2f342vx73cws3u1b4bao4sno5a3g5rkj691h6qh177tk7p2d86688n5593yi9kn4a172ahnqay1o04uo0l7i11lz1i2t1ynk2fck2w6w3d683uaz4bk44sxc5acz5ru669b46qqo783c7pc286g38neu948e9kwta1gxahxdaybh05490lh911vj1icl1yx52fme2wgj3dg53uko4bu34t715amx5s3v69kz6r0b78d17plm86po8nod94hx9l6ca1qgai6xayl1049u0kmu11151hi61y2t2es22vma3clu3tqi4azs4scw59sk5r9q68qk6q6477il7ore85v78mu493nh9kc3a0w1ahcqaxqo04jo0kwh11ay1hrs1ycj2f1j2vvv3cv83tzz4b954sma5a1z5rj269026qfg77s67p0s864v8n3k93x89klma15uahmaay0i04t80l6b11ki1i1l1ym22fbb2w5c3d4y3u9g4biv4svt5abp5rsp699t6qp8781w7pal86ek8ndc946t9kvba1fcahvway9w052t0lfp11u21iaz1yvn2fkq2wf03def3uj64bsd4t5m5al95s2j69jf6qz278bk7pke86o88nn394gi9l51a1p0ai5layjk048h0klc10zr1hgn1y1c2eqg2vkp3ck53tot4ay24sb459qw5r7w68p06q4d77h57opp85tu8msh93m59kaia0uqahb4axpc04i20kv5119d1hqg1yax2f072vu93ctv3tyc4b7p4skn5a0g5rhh68yi6qe077qn7ozh863e8n2c93vs9kkfa14dahl0axyx04ru0l4m11j11hzt1yki2f9h2w3s3d343u7w4bh04su95a9w5rr569826qnp780c7p9686d78nc2945n9ku6a1eaahusay8u051n0lej11ss1i9p1yu82fjc2wdh3dd03uhk4bqx4t3x5ajt5s0s69hy6qxb78a37pip86mu8nlk94f89l3pa1nwai4dayik047c0kkc10yk1hfk1y022ep82vjb3ciu3tne4awo4s9r59ph5r6m68nk6q3577fp7ook85sf8mre93kt9k9ja0tjahaaaxo904hb0ku4118l1hpc1ya22eyy2vt73csg3tx44b674sjb59yy5rg468x36qcm77pd7oy386288n1193uq9kj7a13gahjyaxy704qz0l4211ia1hzb1yjs2f8y2w2y3d2g3u6v4bg64st15a8w5rpu69706qmf77z77p7x86c18nav944g9kt0a1d4ahtoay7r050m0ldk11rw1i8u1ytg2fik2wcr3dc63ugt4bpz4t335aip5rzx69gs6qwf788y7phu86lr8nkr94e79l2va1mwai3kayhj046i0kjc10xs1hem1xzc2eod2vin3ci03tmn4avt4s8u59oi5r5i68mj6q1w77en7on985rf8mq593jv9k8ba0snah94axne04g50kt9117g1hoj1y902ey82vs83crt3tw94b5l4sih59ya5rf868w96qbp77oc7ox486138n0193tj9ki7a129ahiyaxwy04px0l2s11h61hxz1yin2f7m2w1u3d163u5v4bez4ss65a7s5rp1695x6qlk77y57p6z86ay8n9v943e9krza1c2ahsoay6q04zm0lcj11qv1i7r1ysc2fhe2wbk3daz3ufk4bou4t1u5aho5ryo69ft6qv6787z7pgk86kq8nje94d29l1ha1lpai25aygd04540ki710we1hdh1xxy2en62vh83cgs3tl94auk4s7k59nb5r4e68ld6q0y77dj7omf85qb8mpa93ip9k7da0rdah82axm004f00krt11691hn01y7p2ewm2vqv3cq43tut4b3v4sh059wl5rds68uq6qac77n17ovv86008myv93sk9kh3a11aahhsaxvx04op0l1n11fu1hws1yh82f6c2w0d3czu3u4a4bdl4sqh5a6d5rnb694i6qjx77ws7p5i869o8n8j94279kqqa1axahrfay5j04yb0lb811pf1i6c1yqs2ffv2w9y3d9e3udy4bn64t095afy5rx569e26qtr786b7pfa86j88nia94br9l0ia1kjai19ayf804470kgz10vd1hc31xwq2elm2vft3cf13tjn4asq4s5t59lg5r2j68jk6pz077bs7oki85op8mni93ha9k5sa0q4ah6naxky04dq0kqt114z1hm01y6d2evi2vpe3cov3tt64b2g4sfa59v35rc168t46q8l77ld7ou685ya8mx993qv9kfja0zpahgdaxug04nd0l0911em1hvf1yfz2f4y2vz23cyb3u2v4bbw4soz5a4j5rlr692n6qic77uz7p3y867z8n71940m9kpba19fahq3ay4504x20l9x11oa1i531ypo2fen2w8s3d833ucm4bls4syq5aeg5rvf69ci6qrw784q7pde86hm8nge94a79kypa1j1ahziayds042j0kfn10tt1hav1xva2ekh2veg3cdy3tic4arm4s4i59k85r1868i76pxp77ac7oj785n78mm893fr9k4ja0omah5eaxjg04ch0kpb113q1hkh1y532etz2vo53cnc3try4b0y4se259tl5rar68rn6q7977jw7oss85ww8mvu93pj9ke7a0ygahf3axta04m60kz411de1hua1yer2f3s2vxs3cx53u1k4bas4sno5a3h5rkf691m6qh077tv7p2k866s8n5l93zb9knua184ahooay2w04vo0l8q11mx1i3x1yoc2fdg2w7g3d6w3ubc4bkk4sxj5ad85rud69bc6qqz783l7pcj86gi8nfk94919kxsa1htahykaycj041k0ked10su1h9l1xua2ej62vde3ccl3th74aq74s3a59iu5qzz68gx6pwg77977ohz85m68ml193et9k3ca0nnah46axif04b80koa112h1hjh1y3x2et12vmz3cmg3tqs4b024scu59sn5r9k68qp6q6477iz7orr85vz8mux93on9kdaa0xhahe3axs704l10kxx11c61ht01ydh2f2h2vwj3cvv3u0e4b9i4sml5a265rje690b6qg177so7p1p865q8n4v93yg9kn8a17caho2ay2204v00l7s11m41i2t1yne2fc92w6e3d5n3ua84bjc4swd5ac25rt469a76qpn782i7pb886fh8neb94859kwoa1h2ahxkaybv040m0kdp10ru1h8t1xt62eia2vc53cbm3tfy4ap74s2259hv5qyu68fx6pvf77867oh185l48mk593ds9k2ja0mpah3gaxhk04ak0knf111s1hij1y332erx2vlz3cl43tpn4ayl4sbn59r65r8d68pa6q4z77ho7oqn85us8mtv93nj9kcaa0wiahd7axrc04ka0kx711bi1hsb1yct2f1q2vvq3cuz3tzd4b8h4slc5a125ri068z66qem77rk7p0b864m8n3i93xc9klwa168ahmray1004tr0l6t11ky1i1x1yma2fbe2w5b3d4q3u934bia4sv65aau5rrw698v6qoh78157pa486e68ndb946w9kvpa1ftahwlayal03zm0kce10qt1h7j1xs52eh02vb53cab3tew4ant4s0v59gd5qxh68ec6ptw776m7ofg85jn8mim93cf9k13a0lgah23axgd04980km8110g1hhd1y1r2eqs2vkp3ck13toc4axj4sab59q25r6y68o26q3g77gb7op285tb8ms993m29kaqa0v1ahboaxpw04iq0kvp119x1hqs1yb62f052vu33ctd3txs4b6w4sjv59zh5rgn68xk6qda77pw7oyx862y8n2393vo9kkia14mahleaxzf04sg0l5911jn1i0c1yky2f9r2w3v3d303u7k4bgl4stl5a985rqa697b6qmt77zn7p8f86co8nbi945c9ktva1e8ahuray92051u0lex11t31ia31yug2fjk2wdf3dcu3uh44bqd4t355aix5rzu69gy6qwf78997pi386ma8nla94ez9l3pa1nxai4mayiq05bo0loj122u1ijm1z432fsz2wn03dm63uqn4bzm4tcn5as55s9c69q86r5y78in7prp86vu8nv094oq9ldja1xqaiehaysk';

function setTermData(str) { TERM_DATA = str; }

/** year의 i번째 절기 UTC 시각(ms) */
function termUTC(year, i) {
  if (year < TERM_BASE_YEAR || year > TERM_END_YEAR) throw new Error('지원 범위(1900~2100) 밖: ' + year);
  const off = ((year - TERM_BASE_YEAR) * 24 + i) * 4;
  const mins = parseInt(TERM_DATA.substr(off, 4), 36);
  return Date.UTC(year, 0, 1) + mins * 60000;
}

/* ---------- 음력 → 양력 변환 ----------
   합삭(朔) 시각 기준으로 월을 나누고, 중기(中氣)가 없는 달을 윤달로 삼는 한국 음력 규칙.
   테이블: 첫 해 정월 서수(5) + 연도별 [정월델타(3) 대소비트(3) 윤달월(1) 월수(1)]
   검증: 1900~2100 설날 및 윤달 목록을 실제 역서와 대조 완료. */
const LUNAR_DATA = '0ev7e0b44ia80ls1g200ky2w500kz2mi50lr11n00ky23b00kz47q40ls12200ky28l00kz4ia20ls1g200ky4kl60ls27900ky21700ky3ob50ls23x00kz12i00ky29520ls2ax00kz5ea70ls2oi00ky2lh00ky57150ls1ue00ky0j900ky4a540lt1ck00ky2p500kz5ua20ls2vm00ky2li60lr10n00ky21j00kz3p250ls25600kz1ck00ky2w930ls1ft00ky4gj70ls23700ky10r00ky21n60ls1v100kz29600kz5ec40ls2as00ky28900ky58z20ls23900ky46j70ls10t00ky23x00kz48a50ls2pe00kz2p000ky5s930ls2mi00ky59180ls23a00ky11y00ky24560ls25100kz1ci00ky2w540ls2w500kz2tm00ky2hi30lr23f00kz47q70ls12i00ky28p00kz4lu50ls1g200ky1et00ky4ej40ls21700ky3or80ls0j100ky12j00kz29560ls2p500kz2oi00ky5d140ls2lh00ky571a0ls21i00ky0ja00ky4a560lt1ck00ky2p500kz5ua50ls2vm00ky2li00ky21i30lr21j00kz3p280ls28q00kz1ck00ky2x550ls1ft00ky1ar00ky46f40ls10r00ky21n00kz47u20ls0oa00ky5ed70lt2as00ky28900ky58z50ls23900ky10t00ky21p30ls23x00kz4a290ls15e00ky2p100kz5sa50ls2mi00ky23900ky46l40ls11y00ky24500kz4a220ls1ci00ky2w560ls2w500kz2tm00ky2hi50lr2hn00kz12200ky25130ls29500kz4lub0ls1g200ky27900ky4ej60ls21700ky0x700ky12350ls12l00kz29500kz5ea20ls2oi00ky5r970ls2lh00ky21900ky43150ls0ja00ky14l00kz2p530ls2w900kz5ua80ls2vm00ky2li00ky21i60lr21j00kz0ye00ky1bp40ls1cl00kz2x500kz2vm30lr1ar00ky46j70ls10r00ky21n00kz47u50ls12i00ky28l00kz4ll40ls28900ky58z80ls23900ky10t00ky23x60ls24500kz14a00ky2at40ls2p100kz2mi00ky59130ls2hh00ky46m70ls11y00ky24500kz4aa50ls1ci00ky2w500kz5ze40ls18q00kx2hj80ls2i300kz12200ky25160ls29500kz1g200ky4h140ls27900ky18r00ky42f30ls0x70';
const LUNAR_BASE_YEAR = 1900;

function lunarYearInfo(y) {
  if (y < LUNAR_BASE_YEAR || y > 2100) throw new Error('음력 지원 범위(1900~2100) 밖: ' + y);
  let ord = parseInt(LUNAR_DATA.substr(0, 5), 36);
  let bits = 0, leapMonth = 0;
  for (let k = LUNAR_BASE_YEAR; k <= y; k++) {
    const off = 5 + (k - LUNAR_BASE_YEAR) * 7;
    const delta = parseInt(LUNAR_DATA.substr(off, 3), 36) - 400;
    bits = parseInt(LUNAR_DATA.substr(off + 3, 3), 36);
    leapMonth = parseInt(LUNAR_DATA.substr(off + 6, 1), 36);
    if (k > LUNAR_BASE_YEAR) ord += delta;
  }
  // 월 시퀀스: 1~12월 순서, 윤달은 해당 월 바로 뒤에 한 번 더
  const seq = [];
  for (let m = 1; m <= 12; m++) {
    seq.push({ month: m, leap: false });
    if (leapMonth === m) seq.push({ month: m, leap: true });
  }
  let cur = ord;
  const months = seq.map((x, i) => {
    const days = ((bits >> i) & 1) ? 30 : 29;
    const o = { ...x, start: cur, days };
    cur += days;
    return o;
  });
  return { months, leapMonth };
}

/** 음력 → 양력 {y,m,d}. isLeap=true면 윤달 */
function lunarToSolar(ly, lm, ld, isLeap = false) {
  const info = lunarYearInfo(ly);
  const hit = info.months.find(m => m.month === lm && !!m.leap === !!isLeap);
  if (!hit) throw new Error(`${ly}년에 ${isLeap ? '윤' : ''}${lm}월이 없습니다` +
    (info.leapMonth ? ` (그 해 윤달은 ${info.leapMonth}월)` : ' (그 해는 윤달이 없습니다)'));
  if (ld < 1 || ld > hit.days) throw new Error(`${ly}년 ${isLeap?'윤':''}${lm}월은 ${hit.days}일까지입니다`);
  const d = new Date((hit.start + ld - 1 - 719163) * 86400000);  // ordinal → epoch
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), 월크기: hit.days };
}

/** 양력 → 음력 */
function solarToLunar(y, m, d) {
  const ord = Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 719163;
  for (const yy of [y, y - 1, y + 1]) {
    let info; try { info = lunarYearInfo(yy); } catch { continue; }
    for (const mo of info.months)
      if (ord >= mo.start && ord < mo.start + mo.days)
        return { y: yy, m: mo.month, d: ord - mo.start + 1, leap: mo.leap };
  }
  return null;
}

/* ---------- 세계 표준시 이력 (IANA tzdata) ----------
   한국 밖 출생자를 위해 28개 지역의 표준시 변경·서머타임 이력을 전부 담았다.
   우크라이나처럼 1930~1990년 모스크바 시간(UTC+3)을 쓰다가 UTC+2로 바뀌고
   서머타임까지 겹치는 곳은 이 이력 없이는 시주가 통째로 어긋난다.
   형식: 지역=[최초offset(3)] 그다음 [시각델타(5) offset(3)] 반복, 1900-01-01 기준 분. */
const TZ_DATA = 'Asia/Seoul=1332kyt013616a80140beiw015o037f0140068l015o04yr0140068l015o04zv014007cl015o03vv01400sio01360cnp014u03wz013607ud014u043n013606p9014u04bf013606x1014u04bf013606x1014u04bf013606x1014u04bf01360a2d0140828w015o04r4014006hc015o04r40140|Europe/Kyiv=0se7mag00sc1x6500u03itf00sc0clh00qo04jc00sc05u000qo010o00u0bpmw00vo05n700u005md00vo05n700u005md00vo05n700u005nh00vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo030w00u00e1k00sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05u000u006hh00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc|Asia/Tokyo=140f4ul015o043s0140069k015o04yw014007cg015o03w0014007cg015o03w00140|Asia/Shanghai=12h0b9k012c5q1x0140059v012c6gzx0140044r012c04q50140075n012c02s5014014ff012c07vh014004ab012c061x01400663012c05md014004pv012c06jp014000tv012cbkd10140043s012c06hc014004r4012c06p4014004jc012c06p4014004r4012c06hc014004r4012c06hc014004r4012c|Asia/Taipei=12cbtj101402hvk012c07a8014004ab012c061x01400663012c05md014004pv012c06jp014004pv012c06jp014004pv012c06jp014004pv012c04p1014007k3012c04nx014006ln012c04nx014006ln012c04nx014005n7012c05nh014005n7012c05md014005n7012c05md014005n7012c05md014005n7012c07j9014003rf012c07i5014003rf012c3wwd014005n7012c05md014005n7012c1699014002u3012c|Asia/Hong_Kong=11o1if1012cbgvh014003c0013602mb014017y8012c04r4014006x1012c043s0140074o012c04r4014005m8012c04r4014006hc012c04r4014006hc012c04r4014006hc012c04yw014006hc012c04r4014006hc012c04bk014006ww012c04bk0140074o012c043s0140074o012c04bk014006ww012c04bk014006ww012c04bk014006ww012c04bk0140074o012c043s0140074o012c043s0140074o012c04bk014006ww012c04bk014006ww012c056o014005m8012c05m8014005m8012c05m8014005u0012c05m8014005m8012c05m8014005m8012c05m8014005m8012c05m8014005m8012c05m8014005u0012c05m8014005m8012c025s0140092o012c05m8014005m8012c05m8014005m8012c0sy8014004yw012c|Asia/Singapore=10j1p0t010o8mzk01182poo011i056o0140148r011ibd9c012c|Asia/Bangkok=1066c8t010o|Asia/Ho_Chi_Minh=10u3joo010o9x1c012c0otc014005a0010o0hs5012c2kzs010o1ern012c4u4w010o|Asia/Manila=12cbj7x014002cb012c1jel014018mj012c2m9h014001nv012c755x014005hn012c3ypx0140024j012c|Asia/Jakarta=10v7iiw01182rlp011i2xu0014013i3011i0tct012c0miz011i4a3s010o|Asia/Kolkata=0xx1vml00y6b6zs00zu06yz00y603d900zu0z6j00y6|Asia/Dubai=0v569fp00vo|Europe/London=0p054p100qo043s00p005u000qo050000p005sw00qo05v400p005l400qo05nc00p005l400qo06ig00p004xs00qo05nc00p005dc00qo061s00p0061s00qo04jc00p006hc00qo04yw00p006hc00qo056o00p0061s00qo056o00p005u000qo05eg00p0069k00qo056o00p0061s00qo056o00p005u000qo05eg00p0061s00qo056o00p0061s00qo056o00p005u000qo05m800p0061s00qo056o00p005u000qo05eg00p0061s00qo056o00p0061s00qo056o00p005u000qo05eg00p0061s00qo06p400p0030w00qo0de800sc030w00qo07cg00sc03w000qo07cg00sc043s00qo074o00sc056o00qo062w00sc037k00qo02lc00p005u000qo05eg00p004yw00qo00v400sc03o800qo02lc00p0043s00qo074o00p004r400qo06hc00p0056o00qo05u000p005eg00qo05u000p005m800qo05u000p005eg00qo056o00p005u000qo05eg00p0061s00qo056o00p0069k00qo056o00p005u000qo05eg00p0061s00qo056o00p0061s00qo056o00p005u000qo05eg00p005eg00qo06p400p004jc00qo06p400p004r400qo06hc00p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06ww00p003gg00qo15p400p004bk00qo06ww00p004bk00qo06ww00p004bk00qo06ww00p004bk00qo06ww00p004jc00qo06p400p004jc00qo06p400p004jc00qo06ww00p004bk00qo06ww00p004bk00qo06ww00p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004yw00qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p0|Europe/Berlin=0qo542o00sc04q500qo062w00sc04r400qo06hc00sc04r400qo6qu800sc0t6000qo04jc00sc05u000qo05m800sc05m800qo05m800sc01ls00u003so00sc01p400qo04jc00sc05fk00qo05l900sc012w00u001ib00sc030w00qo061s00sc056o00qo05u000sc05eg00qo9jy800sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Paris=0p93i4000p01nco00qo03d400p005dc00qo062w00p004q000qo06ig00p004i800qo06q800p0042o00qo07s000p004ds00qo06y000p004ns00qo061s00p0074o00qo043s00p005eg00qo05u000p005m800qo05m800p0061s00qo056o00p005u000qo05eg00p0061s00qo05eg00p0061s00qo056o00p005u000qo05eg00p0061s00qo056o00p005m800qo05m800p005eg00qo061s00p005m800qo05m800p005eg00qo05u000p0061s00qo056o00p005m800qo05m800p005eg00qo05u000p0061s00qo06p400p0031100qo03f700sc0qut00qo04jc00sc05u000qo05m800sc05sw00qo05fk00sc055k00qo9k6000sc05m800qo05u000sc05eg00qo05u000sc05m800qo05m800sc05m800qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Moscow=0t6560t00t70b8b00uv05iw00t704s800wj03b100uv07yj00wj00xm00vo01eu00u00gy000vo011s00xc052800vo00xc00u00b9k00sc2f1h00u0fwfs00vo05n700u005md00vo05n700u005md00vo05n700u005nh00vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05u000u00b8g00sc03gg00u0025s00vo05m800u005m800vo05m800u005m800vo05m800u005m800vo05m800u005u000vo06hc00u004r400vo06hc00u004r400vo06hc00u004r400vo06p400u004jc00vo06p400u004jc00vo06p400u004r400vo06hc00u004r400vo06hc00u004r400vo06p400u004jc00vo06p400u004jc00vo06p400u004jc00vo06p400u004r400vo06hc00u004r400vo06hc00u004r400vo06p400u004jc00vo14eg00u0|Europe/Warsaw=0rc4vqo00qo08c000sc04q500qo062w00sc04r400qo06hc00sc0b9k00u004r400sc0uir00qo5nm500sc0qls00qo04jc00sc05u000qo05m800sc05og00qo06e000sc05qj00qo052d00sc05fk00qo06g800sc04r400qo061s00sc056o00qo05u000sc05eg00qo2ef400sc03o800qo05m800sc05m800qo07k800sc03w000qo05m800sc05m800qo07cg00sc03w000qo07cg00sc03w000qo07cg00sc03w000qo07k800sc03o800qo3x2w00sc05eg00qo05u000sc05m800qo05m800sc05m800qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|America/New_York=0go5pnh00ic06hc00go04r400ic06hc00go04r400ic06p400go05eg00ic04r400go06p400ic04jc00go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04jc00go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04jc00go06p400ic04r400go06hc00ic04r400go044w00ic150o00go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04jc00go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05m800ic05m800go05m800ic05m800go025s00ic092o00go03o800ic07k800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go|America/Chicago=0f05pnh00go06hc00f004r400go06hc00f0074o00go04bk00f004jc00go06p400f005m800go04jc00f006p400go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006p400go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006p400go04jc00f006p400go04r400f006hc00go04r400f004r400go07zs00f004yw00go04r400f006hc00go04r400f006p400go04jc00f006p400go04r400f006hc00go04r400f0044w00go150o00f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006p400go04jc00f006p400go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go05u000f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05u000f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05u000f005eg00go05u000f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05u000f005m800go05m800f005m800go05m800f0025s00go092o00f003o800go07k800f005m800go05u000f005eg00go05u000f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05m800f005m800go05u000f005eg00go05u000f005m800go05m800f005m800go05m800f005m800go05m800f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f003w000go07cg00f0043s00go07cg00f0|America/Denver=0dc5pnh00f006hc00dc04r400f006hc00dc04r400f006p400dc04jc00f001q800dc6hkw00f0150o00dc64l400f005u000dc05eg00f005u000dc05m800f005m800dc05m800f005m800dc05m800f005m800dc05m800f005m800dc05m800f005u000dc05m800f005m800dc05m800f005m800dc025s00f0092o00dc03o800f007k800dc05m800f005u000dc05eg00f005u000dc05m800f005m800dc05m800f005m800dc05m800f005m800dc05m800f005m800dc05m800f005u000dc05eg00f005u000dc05m800f005m800dc05m800f005m800dc05m800f005m800dc04yw00f0069k00dc04yw00f006hc00dc04r400f006hc00dc04r400f006hc00dc04yw00f0069k00dc04yw00f0069k00dc04yw00f006hc00dc04r400f006hc00dc04r400f006hc00dc04yw00f0069k00dc04yw00f0069k00dc04yw00f0069k00dc04yw00f006hc00dc04r400f006hc00dc04r400f006hc00dc04yw00f0069k00dc04yw00f0069k00dc04yw00f006hc00dc04r400f006hc00dc04r400f006hc00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc03w000f007cg00dc043s00f007cg00dc|America/Los_Angeles=0bo5pnh00dc06hc00bo04r400dc06hc00bo6zao00dc150o00bo0rnp00dc091f00bo0exs00dc04jc00bo06p400dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06p400dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06p400dc04jc00bo06p400dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05m800dc05m800bo05m800dc05m800bo025s00dc092o00bo03o800dc07k800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo|America/Toronto=0go5q3100ic061s00go04s800ic06g300go05u500ic04j700go074t00ic03so00go07fs00ic03w000go07cg00ic03w000go074o00ic04bk00go06ww00ic04bk00go06ww00ic04bk00go06ww00ic04jc00go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04jc00go06p400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04jc00go06p400ic1p5400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic06p400go04r400ic06hc00go04r400ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06hc00ic04r400go06p400ic04r400go06hc00ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05m800go05m800ic05u000go05eg00ic05u000go05m800ic05m800go05m800ic05m800go05m800ic05m800go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go04yw00ic069k00go04yw00ic069k00go04yw00ic06hc00go04r400ic06hc00go04r400ic06hc00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go|America/Vancouver=0bo5q3100dc061s00bo7aj400dc150o00bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06p400dc04jc00bo06p400dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06p400dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06hc00dc04r400bo06p400dc04jc00bo06p400dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo05m800dc05u000bo05eg00dc05u000bo05m800dc05m800bo05m800dc05m800bo05m800dc05m800bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo04yw00dc069k00bo04yw00dc069k00bo04yw00dc06hc00bo04r400dc06hc00bo04r400dc06hc00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo03w000dc07cg00bo043s00dc07cg00bo|America/Sao_Paulo=0jt4dt900k05k4v00lo05kk00k005pp00lo05jv00k057wl00lo047400k0072g00lo03qb00k007j900lo03rf00k007j900lo02rv00k03c0500lo040b00k00adh00lo01tf00k007kd00lo02rv00k007kd00lo03p700k007kd00lo03qb00k05j8d00lo043n00k006x100lo03gb00k007t900lo038j00k007s500lo038j00k007zx00lo03o300k007s500lo03o300k007kd00lo03gb00k007zx00lo030r00k007zx00lo03vv00k007cl00lo03vv00k007cl00lo03o300k007cl00lo043n00k0075x00lo04i300k006x100lo043n00k006x100lo04j700k006x100lo043n00k007cl00lo03vv00k007zx00lo038j00k007kd00lo03o300k0082500lo03e300k007cl00lo03vv00k007zx00lo03gb00k0074t00lo03vv00k007kd00lo03o300k007kd00lo03vv00k007cl00lo03vv00k007cl00lo043n00k007cl00lo03o300k007kd00lo03o300k007kd00lo03vv00k007cl00lo03vv00k007cl00lo03vv00k007cl00lo03vv00k007zx00lo038j00k0|Australia/Sydney=15o5bn1017c02k8015o7r9c017c02oo015o05m8017c05m8015o05u0017c05eg015o8n40017c03o8015o07k8017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c043s015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c04yw015o06hc017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c04bk015o06p4017c04jc015o06ww017c04jc015o06ww017c04bk015o06ww017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c043s015o07cg017c03w0015o07cg017c03w0015o07cg017c04r4015o06hc017c04r4015o06hc017c04r4015o06hc017c04r4015o06p4017c04jc015o04r4017c06hc015o06p4017c04r4015o06hc017c04r4015o06hc017c04r4015o06p4017c04jc015o06p4017c04r4015o06hc017c04jc015o06p4017c04yw015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c|Australia/Melbourne=15o5bn1017c02k8015o7r9c017c02oo015o05m8017c05m8015o05u0017c05eg015o8n40017c03o8015o07k8017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c043s015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c043s015o07cg017c03w0015o07cg017c03w0015o07cg017c03w0015o07cg017c04bk015o06p4017c04jc015o06p4017c04r4015o06ww017c04bk015o06ww017c04bk015o06ww017c03w0015o07cg017c03w0015o07cg017c043s015o07cg017c03w0015o07cg017c04jc015o06p4017c04r4015o06hc017c04r4015o06hc017c04r4015o06hc017c04r4015o06p4017c04jc015o04r4017c06hc015o06p4017c04r4015o06hc017c04r4015o06hc017c04r4015o06p4017c04jc015o06p4017c04r4015o06hc017c04jc015o06p4017c04yw015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05u0015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05u0017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c05m8015o05m8017c|Pacific/Auckland=1868pw5019u03o8018606ww019004r4018606hc019004r4018606hc019004r4018606hc019004yw0186069k019004yw0186069k0190069k018604r4019006hc018604r4019006hc018604r4019006hc018604r4019006hc018604r4019006p4018604jc019006p4018604r40190aoco01ao03gg019007k801ao043s019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao043s019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao03w0019007cg01ao043s019007cg01ao03w0019006p401ao04yw0190069k01ao04yw0190069k01ao04yw0190069k01ao056o0190061s01ao056o0190061s01ao056o0190061s01ao056o0190069k01ao04yw0190069k01ao04yw0190069k01ao056o0190061s01ao056o0190061s01ao056o0190069k01ao04yw0190069k01ao04yw0190069k01ao056o0190061s01ao056o0190061s01ao056o0190061s01ao056o0190061s01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao061s019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao061s019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao061s019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005m801ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao05u0019005eg01ao|Africa/Johannesburg=0ri0zmd00sccdxc00u005m800sc05m800u005m800sc|Africa/Cairo=0sh08fc00sccgit00u002ej00sc061x00u004qz00sc063100u006g300sc04th00u006ln00sc04p100u006ln00sc054l00u0064z00sc3lvp00u004fv00sc06jp00u004pv00sc06jp00u004ow00sc06ls00u004ow00sc06ko00u004ow00sc06ko00u004ow00sc06ko00u004ow00sc06ls00u004ow00sc06ko00u004ow00sc06ko00u004q000sc06jk00u004q000sc06ko00u004q000sc06jk00u004q000sc06jk00u004q000sc06jk00u004q000sc06ko00u004q000sc06jk00u004q000sc06jk00u004q000sc06jk00u004q000sc06ko00u004q000sc06jk00u004q000sc06jk00u004q000sc06jk00u004q000sc06ko00u004q000sc06jk00u004q000sc096000u0023k00sc08rk00u002i000sc06ko00u004q000sc06jk00u004q000sc06jk00u004q000sc06jk00u004q000sc06ko00u004q000sc06p400u004kg00sc06jk00u004q000sc06jk00u004q000sc06ko00u004q000sc06jk00u004q000sc06jk00u004q000sc06g800u004qz00sc06hh00u004qz00sc06hh00u004qz00sc06hh00u004qz00sc06p900u004qz00sc06hh00u004qz00sc06hh00u004qz00sc06hh00u004qz00sc06hh00u004qz00sc06p900u004qz00sc06hh00u004qz00sc06hh00u004j700sc06p900u0043n00sc074t00u003vv00sc07cl00u003o300sc07s500u0036b00sc00xh00u000n700sc14u500u001aj00sc013100u001q300sc2osl00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05md00u005m300sc05md00u005m300sc05md00u005m300sc05md00u005tv00sc05el00u005tv00sc05el00u005tv00sc05md00u005m300sc|Africa/Lagos=0pd1py000p00xtx00pd1q1c00pu1ruw00qo|America/Indiana/Indianapolis=0f05pnh00go06hc00f004r400go06hc00f06s4w00go030w00f0044w00go150o00f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006p400go04jc00f006p400go04r400f006hc00go04r400f006hc00go04r400f006hc00go04r400f006hc00go0rfs00f006hc00go3g0g00ic05m800go05m800ic05m800gob3h400ic06hc00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go03w000ic07cg00go043s00ic07cg00go|America/Phoenix=0dc5pnh00f006hc00dc04r400f006hc00dc6zao00f00lbs00dc02t400f005nc00dc72i800f005m800dc|America/Mexico_City=0dz6vzx00dc1pao00f012p700dc054l00f004qz00dc05nh00f0256w00go04bf00f00ggd00go03hf00f00uj100go048300f01t7x00go056j00f0eb2d00go069k00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f005u000go04jc00f005u000go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f004r400go06hc00f004yw00go069k00f004yw00go069k00f004yw00go06hc00f004r400go06hc00f0|Europe/Madrid=0ol0b9k00p05evk00qo05dh00p005m300qo05nh00p01f1n00qo05a500p00ha300qo056t00p005tv00qo05el00p0061s00qo05eg00p0061n00qo056t00p02er700qo03c500p005m300qo00v400sc04s800qo0bf900p004yr00qo0nzc00sc03ql00qo072b00sc056t00qo061n00sc056t00qo061n00sc056t00qo061n00sc056t00qo0t5v00sc04r900qo7ojf00sc05el00qo05tv00sc05el00qo05eb00sc05md00qo05tv00sc05el00qo05u000sc05m800qo05m800sc05m800qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Rome=0qo554l00sc03o300qo05md00sc05n700qo04xx00sc06ib00qo04id00sc06oz00qo056t00sc05m300qo66i500sc0quo00qo04jc00sc05u000qo05m800sc055k00qo062w00sc054g00qo05nc00sc069k00qo04yw00sc069k00qo04jc00sc06p400qo5irk00sc03vv00qo07kd00sc03o800qo07k800sc03o800qo07s000sc03o800qo07k800sc03o800qo07cg00sc03w000qo07k800sc03w000qo07k800sc03o800qo07cg00sc03w000qo07k800sc03o800qo07k800sc03o800qo07cg00sc03w000qo07k800sc03w000qo07cg00sc03w000qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Amsterdam=0pj542t00r704pv00pj063100r704r400pj061s00r705m800pj05u000r705eg00pj05u000r705eg00pj05u000r705eg00pj05l400r7061s00pj07a800r703y800pj05eg00r705u000pj07i000r703qg00pj06vs00r704co00pj06ww00r704bk00pj06z400r704h400pj06sg00r704g000pj06tk00r704ew00pj06uo00r704ds00pj074o00r7043s00pj06y000r704i800pj06rc00r704h400pj06sg00r704g000pj06uo00r704ds00pj073k00r7018g00r802wg00pk06ww00r804bk00pk06y000r804i800pk06tk00sc0rs000qo04jc00sc05u000qo05m800sc05m800qo05m800sc055k00qo9vm800sc05eg00qo05u000sc05m800qo05m800sc05m800qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Stockholm=0qo54i800sc04al00qojvzk00sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Istanbul=0s83d5900sc1qxk00u004pv00sc13bp00u006ib00sc04xx00u005n700sc05dh00u0061n00sc0hzx00u004cj00sc06jp00u004pv00sc4m9p00u002zn00sc01qd00u0092j00sc05xh00u013or00sc07ad00u003rf00sc067h00u0056j00sc061x00u0056j00sc05u500u005eb00sc061x00u005eb00sc061x00u0056j00sc3df900u00ekb00sc064500u004ab00sc2pr100u004r400sc04jc00u006p400sc04ag00u006y000sc04bk00u006ww00sc04r400u0061s00sc056o00u01o2800vo01y000u00c8000sc058w00u004yw00sc05nc00u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005u000sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05eg00u005u000sc05m800u005m800sc05u000u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jh00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04kg00u006o000sc04jc00u006p400sc04r400u006hc00sc04s800u006g800sc04r400u006ww00sc04bk00u0|Asia/Karachi=0wg26w500y6b62g00zu0z6j00y61v5s00xcftid00z005m300xc1rql00z004pv00xc053h00z0066300xc|Asia/Riyadh=0u6es1c00u0|Pacific/Honolulu=07iafol009600nr007i2qbl0096150o007i0j0g008c|Asia/Beirut=0sc6c4d00u006ib00sc04xx00u005n700sc05dh00u0061n00sc061x00u004j700scaj1p00u004pv00sc06jp00u004pv00sc06jp00u004pv00sc06kt00u004pv00sc06jp00u004pv00sc3cwd00u0034300sc06jp00u004pv00sc06jp00u004pv00sc06jp00u004pv00sc06kt00u004pv00sc06jp00u004pv00sc06il00u004pv00sc1qyt00u0056j00sc063100u0056j00sc063100u0056j00sc063100u0056j00sc072l00u0048300sc06d100u004wj00sc063100u0056j00sc063100u0056j00sc064500u004t700sc05el00u005m300sc05md00u005m300sc05md00u005m300sc05u500u005m300sc05md00u005m300sc05md00u005m300sc05md00u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc04jh00u006oz00sc04jh00u006oz00sc04r900u006h700sc04r900u006h700sc04r900u006h700sc04r900u006oz00sc|Asia/Tehran=0upb3kl00uud2x700wi06ko00vo04sd00xc043s00vo030r00uu063100wi03jn00uu05ol00wi05qj00uu3bkl00wi04dn00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu0s4d00wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05l900wi05ob00uu05md00wi05ob00uu05l900wi05ob00uu|Asia/Jerusalem=0sw5mwg00sc70ot00u003rk00sc01g800u00m1c00sc04ns00u006ls00sc04ow00u006ls00sc054g00u0065400sc054g00u0065400sc0hkd00vo034800u001vn00sc05l400u005og00sc054g00u004ow00sc064000u006ww00sc04yw00u005m800sc05eg00u004r400sc08fc00u002t400sc08fc00u002t400sc087k00u003o800sc06hc00u004jc00sc599c00u0030r00sc05u500u0043n00sc1jj100u001ao00sc151s00u003gg00sc074o00u004bf00sc07zx00u003gb00sc06sl00u004nn00sc06hh00u004j700sc07cl00u003vv00sc069p00u004qz00sc06hh00u004yr00sc06hh00u004yr00sc06f900u004t700sc06f900u004lf00sc06n100u004t700sc05zp00u005pf00sc05qt00u005gj00sc05rx00u0058r00sc06f900u004r400sc06ww00u005eg00sc05pk00u0056o00sc05qo00u005xc00sc05b400u005u000sc05rs00u0056o00sc05w800u005w800sc05c800u005og00sc05k000u0058w00sc05zk00u005w800sc05c800u005og00sc05k000u0058w00sc067c00u005og00sc05k000u005go00sc05rs00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc04h400u006rc00sc04h400u006rc00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006jk00sc04ow00u006rc00sc|Europe/Lisbon=0nz3r8w00p01eb400qo047900p003pc00qo071700p0048d00qo071700p0048d00qo071700p0049h00qo071700p0048d00qo071700p00s8o00qo05a000p00ha800qo056o00p005u000qo05eg00p0061s00qo05eg00p0061s00qo056o00p00ha800qo056o00p005m800qo05m800p00h2g00qo05m800p005eg00qo05u000p0061s00qo056o00p005m800qo05m800p005eg00qo05u000p0061s00qo06p400p0030w00qo06z400p005k000qo05nc00p004xs00qo01ao00sc03gg00qo025s00p004bk00qo012w00sc043s00qo01y000p0043s00qo01ao00sc03w000qo01y000p0043s00qo01ao00sc03w000qo01y000p004yw00qo05m800p005md00qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05u000p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05u000p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05u000p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo3a6g00p005m800qo05m800p005u000qo05m800p005m800qo05m800p005u000qo05eg00p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05u000p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05m800p005m800qo05u000p005m800qo05m800p005m800qo0b8g00sc05m800qo05m800sc05m800qo05m800sc05m800qo0cbc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p004jc00qo06p400p004jc00qo06p400p004r400qo06hc00p004r400qo06hc00p004r400qo06hc00p004r400qo06p400p0|Europe/Athens=0rm56sl00sc4zq000u001q300sc2ox100u000pf00sc0h0d00qo04kg00sc05sr00qo05nh00sc2kwg00u003tn00sc70yt00u0071c00sc048800u005m800sc05eg00u005fk00sc05sw00u005el00sc05ua00u005kp00sc05pk00u005jv00sc05mi00u005m800sc05m800u005m800sc05m800u005m800sc05m800u005u000sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005u000sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05m800u005m800sc05u000u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc04jc00u006p400sc04jc00u006p400sc04r400u006hc00sc04r400u006hc00sc04r400u006hc00sc04r400u006p400sc|Europe/Zurich=0qocy0t00sc04r400qo06hc00sc04r400qoc1so00sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Vienna=0qo542o00sc04q500qo062w00sc04r400qo06hc00sc04r400qo0hi000sc04yw00qo64dc00sc0t6000qo04jc00sc05u000qo05m800sc05m800qo05m800sc00b400qo0bbs00sc05fk00qo05l400sc05m800qo061s00sc056o00qo9v6o00sc05eb00qo05md00sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|Europe/Prague=0qo542o00sc04q500qo062w00sc04r400qo06hc00sc04r400qo6qu800sc0t6000qo04jc00sc05u000qo05m800sc05m800qo05m800sc05m800qo06p400sc04q000qo01q800p002lc00qo01q800sc056o00qo061s00sc056o00qo05sw00sc05fk00qo98i000sc05m800qo05u000sc05eg00qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05u000qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05m800sc05m800qo05u000sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo04jc00sc06p400qo04jc00sc06p400qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06hc00qo04r400sc06p400qo|America/Bogota=0gr4nvc00goo91100ic08mz00go|America/Lima=0gf2olx00go97rc00ic02rv00go05gt00ic05m300go05md00ic05m300goec0t00ic02rv00go08hp00ic02rv00go0v1x00ic02rv00go16bh00ic02rv00go|America/Argentina/Buenos_Aires=0hv6d6500ic3bbk00k003qb00ic063100k0049700ic07kd00k003p700ic07kd00k003p700ic07kd00k003p700ic07kd00k003qb00ic07kd00k003p700ic07kd00k003p700ic07kd00k003p700ic07kd00k003qb00ic03rp00k00arn00ic03rp00k00k7n00ic02bh00k00qsb00ic06lx00k05bmr00ic02bh00k002df00ic071h00k0048300ic071h00k0048300ic071h00k0057n00ic05md00k005tv00ic05md00k005m300ic05md00k01chk00lo030r00k04kg500lo02wb00k006x100lo04bf00k0074t00lo043n00k0074t00lo043n00k0074t00lo04bf00k04n0d00lo02df00k006p900lo04j700k0|Asia/Kathmandu=0yh69fk00y6ko1p00yl|Asia/Colombo=0xv1vml00y6b9yg00z007dk00zu0z7s00y6fuhs00zu04r400z02yq800y6|Asia/Yangon=0zo69fp00zu6zq801400xvv00zu';
let _tzCache = null;
function tzTable(zone) {
  if (!_tzCache) {
    _tzCache = {};
    for (const chunk of TZ_DATA.split('|')) {
      const i = chunk.indexOf('=');
      _tzCache[chunk.slice(0, i)] = chunk.slice(i + 1);
    }
  }
  return _tzCache[zone] || null;
}
/** 벽시계 시각(1900-01-01 기준 분)에서 그 지역의 UTC offset(분) */
function tzOffsetAt(zone, wallMin) {
  const raw = tzTable(zone);
  if (!raw) return null;
  let off = parseInt(raw.substr(0, 3), 36) - 900;
  let t = 0, p = 3;
  while (p + 8 <= raw.length) {
    t += parseInt(raw.substr(p, 5), 36);
    if (t > wallMin) break;
    off = parseInt(raw.substr(p + 5, 3), 36) - 900;
    p += 8;
  }
  return off;
}
const TZ_ZONES = () => Object.keys(_tzCache || (tzTable('Asia/Seoul'), _tzCache));

/* ---------- 한국 표준시 이력 (IANA tzdata) ----------
   [전환시각(현지 벽시계 기준 UTC ms), UTC offset 분] */
const KST_HIST = [
  [Date.UTC(1900,0,1,0,0),  507.8667],  // +8:27:52 지방시
  [Date.UTC(1908,3,1,1,0),  510],       // +8:30
  [Date.UTC(1912,0,1,1,0),  540],       // +9:00
  [Date.UTC(1948,5,1,1,0),  600], [Date.UTC(1948,8,13,0,0), 540],
  [Date.UTC(1949,3,3,1,0),  600], [Date.UTC(1949,8,11,0,0), 540],
  [Date.UTC(1950,3,1,1,0),  600], [Date.UTC(1950,8,10,0,0), 540],
  [Date.UTC(1951,4,6,1,0),  600], [Date.UTC(1951,8,9,0,0),  540],
  [Date.UTC(1954,2,21,0,0), 510],
  [Date.UTC(1955,4,5,1,0),  570], [Date.UTC(1955,8,9,0,0),  510],
  [Date.UTC(1956,4,20,1,0), 570], [Date.UTC(1956,8,30,0,0), 510],
  [Date.UTC(1957,4,5,1,0),  570], [Date.UTC(1957,8,22,0,0), 510],
  [Date.UTC(1958,4,4,1,0),  570], [Date.UTC(1958,8,21,0,0), 510],
  [Date.UTC(1959,4,3,1,0),  570], [Date.UTC(1959,8,20,0,0), 510],
  [Date.UTC(1960,4,1,1,0),  570], [Date.UTC(1960,8,18,0,0), 510],
  [Date.UTC(1961,7,10,1,0), 540],
  [Date.UTC(1987,4,10,3,0), 600], [Date.UTC(1987,9,11,3,0), 540],
  [Date.UTC(1988,4,8,3,0),  600], [Date.UTC(1988,9,9,3,0),  540],
];

/** 벽시계(현지 표기) 시각 → UTC ms. 표준시 변경·서머타임 자동 반영.
    zone을 주면 그 지역 이력을, 없으면 한국 이력을 쓴다. */
function localToUTC(y, m, d, hh, mi, ignoreHistory, zone) {
  const wall = Date.UTC(y, m - 1, d, hh, mi);
  if (ignoreHistory) return { utc: wall - 540 * 60000, offset: 540, zone: '(이력 무시)' };
  if (zone && zone !== 'Asia/Seoul') {
    const wallMin = Math.floor((wall - Date.UTC(1900, 0, 1)) / 60000);
    const off = tzOffsetAt(zone, wallMin);
    if (off != null) return { utc: wall - off * 60000, offset: off, zone };
  }
  let offset = 540;
  for (let i = KST_HIST.length - 1; i >= 0; i--) {
    if (wall >= KST_HIST[i][0]) { offset = KST_HIST[i][1]; break; }
  }
  return { utc: wall - offset * 60000, offset, zone: 'Asia/Seoul' };
}

/* ---------- 균시차 (Equation of Time, 분) ---------- */
function equationOfTime(utcMs) {
  const n = (utcMs - Date.UTC(2000,0,1,12,0)) / 86400000;
  const g = (357.529 + 0.98560028 * n) * Math.PI / 180;
  const L = (280.459 + 0.98564736 * n) * Math.PI / 180;
  const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2*g)) * Math.PI / 180;
  const eps = (23.439 - 0.00000036 * n) * Math.PI / 180;
  let ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  let eot = (L - ra) * 180 / Math.PI;
  eot = ((eot + 180) % 360 + 360) % 360 - 180;
  return eot * 4; // 도 → 분
}

/** UTC → 진태양시 기준 시각(ms). mode: 'std'|'lon'|'true' */
function toReckoningTime(utcMs, longitude, mode) {
  if (mode === 'std') return utcMs + (arguments[3] ?? 540) * 60000;   // 그 지역 표준시
  const lonMin = longitude * 4;                             // 경도 1도 = 4분
  if (mode === 'lon') return utcMs + lonMin * 60000;        // 지방 평균태양시
  return utcMs + (lonMin + equationOfTime(utcMs)) * 60000;  // 진태양시
}

/* ---------- 간지 ---------- */
function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
           - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const pillar = idx => ({ idx, gan: idx % 10, ji: idx % 12,
  han: GAN[idx % 10] + JI[idx % 12], kor: GAN_KR[idx % 10] + JI_KR[idx % 12] });

/* ---------- 사주 산출 ---------- */
/**
 * @param {object} o {y,m,d,hh,mi, longitude, timeMode:'std'|'lon'|'true',
 *                    lateNightRule:'next'|'same', gender:'M'|'F', unknownHour:boolean}
 */
function computeSaju(o) {
  const lon = o.longitude ?? 126.9780;           // 기본 서울
  const timeMode = o.timeMode ?? 'lon';
  const lateNightRule = o.lateNightRule ?? 'next';

  const { utc, offset, zone } = localToUTC(o.y, o.m, o.d, o.hh ?? 12, o.mi ?? 0, o.ignoreTZHistory, o.timezone);
  const rec = toReckoningTime(utc, lon, timeMode, offset);
  const R = new Date(rec);
  const [ry, rm, rd, rhh, rmi] =
    [R.getUTCFullYear(), R.getUTCMonth() + 1, R.getUTCDate(), R.getUTCHours(), R.getUTCMinutes()];

  // ---- 절기 좌표: 기준시각이 속한 '절' 구간 찾기
  const recRaw = rec - (timeMode === 'std' ? offset : (lon * 4 + (timeMode === 'true' ? equationOfTime(utc) : 0))) * 60000;
  let termYear = ry, termIdx = -1;
  const scan = [];
  for (const yy of [ry - 1, ry, ry + 1]) {
    if (yy < TERM_BASE_YEAR || yy > TERM_END_YEAR) continue;
    for (let i = 0; i < 24; i++) scan.push([yy, i, termUTC(yy, i)]);
  }
  scan.sort((a, b) => a[2] - b[2]);
  for (let k = scan.length - 1; k >= 0; k--) {
    if (recRaw >= scan[k][2]) { termYear = scan[k][0]; termIdx = scan[k][1]; break; }
  }
  // 직전 '절'(월 경계) 찾기
  let jeolPos = -1;
  for (let k = scan.length - 1; k >= 0; k--) {
    if (recRaw >= scan[k][2] && IS_JEOL(scan[k][1])) { jeolPos = k; break; }
  }
  const curJeol = scan[jeolPos];          // [연, 절기idx, utc]
  const nextJeol = scan.slice(jeolPos + 1).find(s => IS_JEOL(s[1]));
  const prevJeol = scan.slice(0, jeolPos).reverse().find(s => IS_JEOL(s[1]));

  // ---- 연주: 입춘(idx 2) 기준
  const ipchunThisYear = termUTC(ry, 2);
  const solarYear = recRaw >= ipchunThisYear ? ry : ry - 1;
  const yearP = pillar(((solarYear - 4) % 60 + 60) % 60);

  // ---- 월주: 절기 구간 → 월지 (입춘=寅)
  // 절 인덱스 0=소한(丑), 2=입춘(寅), 4=경칩(卯) ...
  const jiFromJeol = { 0:1, 2:2, 4:3, 6:4, 8:5, 10:6, 12:7, 14:8, 16:9, 18:10, 20:11, 22:0 };
  const monthJi = jiFromJeol[curJeol[1]];
  const monthOrder = ((monthJi - 2) % 12 + 12) % 12;             // 寅=0
  const monthGan = (yearP.gan * 2 + 2 + monthOrder) % 10;
  const monthIdx = (() => { for (let i = 0; i < 60; i++) if (i % 10 === monthGan && i % 12 === monthJi) return i; })();
  const monthPillar = pillar(monthIdx);

  // ---- 일주
  let dayShift = 0;
  if (!o.unknownHour && lateNightRule === 'next' && rhh === 23) dayShift = 1;
  const dayIdx = ((jdn(ry, rm, rd) + dayShift + 49) % 60 + 60) % 60;
  const dayP = pillar(dayIdx);

  // ---- 시주
  let hourP = null;
  if (!o.unknownHour) {
    const hourJi = Math.floor(((rhh + 1) % 24) / 2) % 12;
    const hourGan = (dayP.gan * 2 + hourJi) % 10;
    let hIdx; for (let i = 0; i < 60; i++) if (i % 10 === hourGan && i % 12 === hourJi) { hIdx = i; break; }
    hourP = pillar(hIdx);
  }

  // ---- 대운
  const yangYear = yearP.gan % 2 === 0;
  const forward = (yangYear && o.gender === 'M') || (!yangYear && o.gender === 'F');
  const target = forward ? nextJeol[2] : curJeol[2];
  const diffDays = Math.abs(target - recRaw) / 86400000;
  const daeunAge = Math.max(1, Math.round(diffDays / 3 * 10) / 10);
  const daeunSu = Math.max(1, Math.round(diffDays / 3));   // 관례상 정수 대운수
  const daeun = [];
  for (let k = 1; k <= 10; k++) {
    const idx = ((monthPillar.idx + (forward ? k : -k)) % 60 + 60) % 60;
    daeun.push({ start: Math.round((daeunAge + (k - 1) * 10) * 10) / 10, ...pillar(idx) });
  }

  // ---- 절기 경계 근접 경고
  const marginMin = Math.min(Math.abs(recRaw - curJeol[2]), Math.abs(nextJeol[2] - recRaw)) / 60000;

  return {
    input: { ...o, appliedOffsetMin: offset, appliedZone: zone, timeMode },
    reckoned: `${ry}-${String(rm).padStart(2,'0')}-${String(rd).padStart(2,'0')} ${String(rhh).padStart(2,'0')}:${String(rmi).padStart(2,'0')}`,
    shiftMin: Math.round((rec - Date.UTC(o.y, o.m - 1, o.d, o.hh ?? 12, o.mi ?? 0)) / 60000),
    appliedZone: zone, appliedOffsetMin: offset,
    year: yearP, month: monthPillar, day: dayP, hour: hourP,
    solarYear, termName: TERM_NAMES[curJeol[1]],
    daeun: { forward, startAge: daeunAge, daeunSu, list: daeun },
    warn: marginMin < 60 ? `절기(${TERM_NAMES[curJeol[1]]}/${TERM_NAMES[nextJeol[1]]}) 경계 ${Math.round(marginMin)}분 이내 — 출생시각 확인 필요` : null,
  };
}

const API = { setTermData, computeSaju, termUTC, localToUTC, equationOfTime,
             GAN, JI, GAN_KR, JI_KR, GAN_OH, JI_OH, GAN_EUMYANG, TERM_NAMES, pillar, jdn,
             lunarToSolar, solarToLunar, lunarYearInfo, tzOffsetAt, TZ_ZONES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;

return module.exports; })();

/* ===== saju-input.js ===== */
__mods["saju-input"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-input.js — 입력 검증·정규화
   감사에서 2월 31일, 13월, 25시가 전부 통과해 쓰레기 결과를 내던 것을 막는다.
   음력 입력도 여기서 양력으로 바꿔 엔진에 넘긴다.
   ============================================================= */
const E = require('./saju-engine');

/* 주요 출생지 경도 (진태양시 보정용). 한국 외 지역은 표준시 이력이
   한국 것과 다르므로, 지금은 '경도 보정만' 적용하고 그 사실을 경고로 남긴다. */
/* 출생지: 경도(진태양시 보정용) + IANA 타임존(표준시·서머타임 이력).
   타임존이 있어야 그 나라의 서머타임과 표준시 변경이 반영된다. */
const CITIES = {
  // 한국
  서울:[126.978,'Asia/Seoul'], 인천:[126.705,'Asia/Seoul'], 수원:[127.029,'Asia/Seoul'],
  대전:[127.385,'Asia/Seoul'], 대구:[128.601,'Asia/Seoul'], 부산:[129.075,'Asia/Seoul'],
  광주:[126.851,'Asia/Seoul'], 울산:[129.311,'Asia/Seoul'], 제주:[126.531,'Asia/Seoul'],
  춘천:[127.730,'Asia/Seoul'], 전주:[127.148,'Asia/Seoul'], 청주:[127.489,'Asia/Seoul'],
  포항:[129.343,'Asia/Seoul'], 강릉:[128.896,'Asia/Seoul'], 목포:[126.392,'Asia/Seoul'],
  창원:[128.681,'Asia/Seoul'], 천안:[127.114,'Asia/Seoul'], 평양:[125.738,'Asia/Seoul'],
  // 우크라이나
  키이우:[30.523,'Europe/Kyiv'], 키예프:[30.523,'Europe/Kyiv'],
  하르키우:[36.231,'Europe/Kyiv'], 오데사:[30.733,'Europe/Kyiv'],
  르비우:[24.031,'Europe/Kyiv'], 드니프로:[35.045,'Europe/Kyiv'],
  자포리자:[35.139,'Europe/Kyiv'], 미콜라이우:[31.995,'Europe/Kyiv'],
  빈니차:[28.468,'Europe/Kyiv'], 폴타바:[34.551,'Europe/Kyiv'],
  체르니우치:[25.935,'Europe/Kyiv'], 마리우폴:[37.549,'Europe/Kyiv'],
  헤르손:[32.617,'Europe/Kyiv'], 체르니히우:[31.289,'Europe/Kyiv'],
  // 아시아
  도쿄:[139.692,'Asia/Tokyo'], 오사카:[135.502,'Asia/Tokyo'],
  베이징:[116.407,'Asia/Shanghai'], 상하이:[121.474,'Asia/Shanghai'],
  타이베이:[121.565,'Asia/Taipei'], 홍콩:[114.169,'Asia/Hong_Kong'],
  싱가포르:[103.820,'Asia/Singapore'], 방콕:[100.501,'Asia/Bangkok'],
  하노이:[105.834,'Asia/Ho_Chi_Minh'], 호치민:[106.660,'Asia/Ho_Chi_Minh'],
  마닐라:[120.984,'Asia/Manila'], 자카르타:[106.845,'Asia/Jakarta'],
  델리:[77.209,'Asia/Kolkata'], 두바이:[55.271,'Asia/Dubai'],
  // 유럽·미주·기타
  런던:[-0.128,'Europe/London'], 베를린:[13.405,'Europe/Berlin'],
  파리:[2.353,'Europe/Paris'], 바르샤바:[21.012,'Europe/Warsaw'],
  모스크바:[37.618,'Europe/Moscow'],
  뉴욕:[-74.006,'America/New_York'], 시카고:[-87.630,'America/Chicago'],
  덴버:[-104.991,'America/Denver'], 로스앤젤레스:[-118.244,'America/Los_Angeles'],
  토론토:[-79.383,'America/Toronto'], 밴쿠버:[-123.121,'America/Vancouver'],
  상파울루:[-46.633,'America/Sao_Paulo'],
  시드니:[151.209,'Australia/Sydney'], 멜버른:[144.946,'Australia/Melbourne'],
  오클랜드:[174.764,'Pacific/Auckland'],
  샌프란시스코:[-122.419,'America/Los_Angeles'], 시애틀:[-122.332,'America/Los_Angeles'],
  보스턴:[-71.058,'America/New_York'], 마이애미:[-80.191,'America/New_York'],
  휴스턴:[-95.369,'America/Chicago'], 피닉스:[-112.074,'America/Phoenix'],
  인디애나폴리스:[-86.158,'America/Indiana/Indianapolis'],
  멕시코시티:[-99.133,'America/Mexico_City'],
  마드리드:[-3.703,'Europe/Madrid'], 로마:[12.496,'Europe/Rome'],
  암스테르담:[4.904,'Europe/Amsterdam'], 스톡홀름:[18.069,'Europe/Stockholm'],
  이스탄불:[28.979,'Europe/Istanbul'],
  요하네스버그:[28.047,'Africa/Johannesburg'], 프리토리아:[28.188,'Africa/Johannesburg'],
  케이프타운:[18.424,'Africa/Johannesburg'],
  카이로:[31.236,'Africa/Cairo'], 라고스:[3.379,'Africa/Lagos'],
  카라치:[67.010,'Asia/Karachi'], 리야드:[46.675,'Asia/Riyadh'],
  호놀룰루:[-157.858,'Pacific/Honolulu'],
  밀라노:[9.190,'Europe/Rome'], 베이루트:[35.501,'Asia/Beirut'],
  취리히:[8.541,'Europe/Zurich'], 빈:[16.373,'Europe/Vienna'],
  프라하:[14.438,'Europe/Prague'], 아테네:[23.728,'Europe/Athens'],
  리스본:[-9.139,'Europe/Lisbon'], 테헤란:[51.389,'Asia/Tehran'],
  예루살렘:[35.214,'Asia/Jerusalem'], 부에노스아이레스:[-58.382,'America/Argentina/Buenos_Aires'],
  보고타:[-74.073,'America/Bogota'], 리마:[-77.043,'America/Lima'],
  카트만두:[85.324,'Asia/Kathmandu'], 콜롬보:[79.861,'Asia/Colombo'], 양곤:[96.196,'Asia/Yangon'],
};

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * @param {object} raw {y,m,d,hh,mi, calendar:'solar'|'lunar', isLeapMonth,
 *                      city|longitude, timeMode, lateNightRule, unknownHour, gender}
 * @returns {{input:object, warnings:string[], notes:string[]}}
 */
function normalize(raw) {
  const w = [], notes = [];
  const err = m => { const e = new Error(m); e.userMessage = m; throw e; };

  // --- 성별
  let gender = raw.gender;
  if (gender === '남' || gender === 'male' || gender === 'M') gender = 'M';
  else if (gender === '여' || gender === 'female' || gender === 'F') gender = 'F';
  else err('성별(M/F)이 필요합니다. 대운의 순행·역행이 성별로 갈리기 때문입니다.');

  // --- 숫자화
  const num = (v, name) => {
    const n = Number(v);
    if (!Number.isFinite(n)) err(`${name} 값이 올바르지 않습니다: ${v}`);
    return Math.trunc(n);
  };
  let y = num(raw.y, '연도'), m = num(raw.m, '월'), d = num(raw.d, '일');

  // --- 달력 변환
  const cal = raw.calendar === 'lunar' || raw.calendar === '음력' ? 'lunar' : 'solar';
  let lunarInfo = null;
  if (cal === 'lunar') {
    if (m < 1 || m > 12) err(`음력 월은 1~12입니다: ${m}`);
    if (d < 1 || d > 30) err(`음력 일은 1~30입니다: ${d}`);
    let conv;
    try { conv = E.lunarToSolar(y, m, d, !!raw.isLeapMonth); }
    catch (e) { err(e.message); }
    lunarInfo = { 입력: `음력 ${y}-${raw.isLeapMonth ? '윤' : ''}${m}-${d}`,
                  변환: `양력 ${conv.y}-${conv.m}-${conv.d}`, 월크기: conv.월크기 };
    notes.push(`${lunarInfo.입력} → ${lunarInfo.변환}로 변환해 계산했습니다`);
    y = conv.y; m = conv.m; d = conv.d;
    if (!raw.isLeapMonth) {
      const info = E.lunarYearInfo(y);
      if (info.leapMonth === m)
        w.push(`${y}년에는 윤${m}월이 있습니다. 평달로 계산했으니, 윤달 생일이면 다시 확인하세요`);
    }
  }

  // --- 양력 유효성
  if (y < 1900 || y > 2100) err(`지원 범위는 1900~2100년입니다: ${y}`);
  if (m < 1 || m > 12) err(`월은 1~12입니다: ${m}`);
  const dim = daysInMonth(y, m);
  if (d < 1 || d > dim) err(`${y}년 ${m}월은 ${dim}일까지입니다: ${d}일`);

  // --- 시각
  const unknownHour = !!raw.unknownHour || raw.hh == null || raw.hh === '';
  let hh = 12, mi = 0;
  if (!unknownHour) {
    hh = num(raw.hh, '시'); mi = raw.mi == null ? 0 : num(raw.mi, '분');
    if (hh < 0 || hh > 23) err(`시는 0~23입니다: ${hh}`);
    if (mi < 0 || mi > 59) err(`분은 0~59입니다: ${mi}`);
  } else {
    notes.push('출생 시간을 모르므로 시주를 비우고 계산했습니다. ' +
               '시주가 없으면 자식궁·말년운과 일부 신살 판단이 제한됩니다');
  }

  // --- 출생지
  let longitude = raw.longitude, city = raw.city, timezone = raw.timezone;
  if (city != null) {
    if (CITIES[city] == null)
      err(`등록되지 않은 도시입니다: ${city}\n등록된 도시: ${Object.keys(CITIES).join(', ')}`);
    longitude = CITIES[city][0]; timezone = CITIES[city][1];
    if (timezone !== 'Asia/Seoul')
      notes.push(`${city}(${timezone}) 현지 시각 기준으로 계산했습니다. ` +
                 `그 지역의 표준시 변경과 서머타임 이력이 반영됩니다 — 태어난 곳의 시계로 본 시각을 입력하세요`);
  }
  if (longitude == null) { longitude = CITIES.서울[0]; timezone = timezone || 'Asia/Seoul';
    notes.push('출생지 미지정 — 서울 기준으로 보정했습니다'); }
  if (longitude < -180 || longitude > 180) err(`경도 범위를 벗어났습니다: ${longitude}`);

  const timeMode = raw.timeMode || 'lon';
  if (!['std','lon','true'].includes(timeMode)) err(`timeMode는 std|lon|true 중 하나입니다: ${timeMode}`);

  return {
    input: { y, m, d, hh, mi, gender, longitude, timezone: timezone || 'Asia/Seoul', timeMode, unknownHour,
             lateNightRule: raw.lateNightRule || 'next',
             saeunFrom: raw.saeunFrom, saeunYears: raw.saeunYears,
             wolunYear: raw.wolunYear, ilunDate: raw.ilunDate, opts: raw.opts },
    달력: cal === 'lunar' ? lunarInfo : { 입력: `양력 ${y}-${m}-${d}` },
    warnings: w, notes,
  };
}

/** 양력 날짜의 음력 표기 (결과 화면에 같이 보여주기 위함) */
function lunarLabel(y, m, d) {
  const l = E.solarToLunar(y, m, d);
  return l ? `음력 ${l.y}-${l.leap ? '윤' : ''}${l.m}-${l.d}` : null;
}

module.exports = { normalize, CITIES, lunarLabel, daysInMonth };

return module.exports; })();

/* ===== saju-analyze.js ===== */
__mods["saju-analyze"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-analyze.js — 판정 알고리즘
   saju-engine.js(만세력)의 4주 결과를 받아 해석 재료를 산출한다.
   유파가 갈리는 지점은 전부 opts로 노출 — 기본값은 한국 통용 관법.
   ============================================================= */
const R = require('./saju-rules');

const DEFAULTS = {
  jijangganMode: 'wolryul',   // 'wolryul' 한국 통용 | 'inwon' 원칙론
  sinsalBase: 'day',          // 'day' 현대 대세 | 'year' 고법
  hapDistance: 'weighted',    // 'adjacent' 붙어야만 | 'any' 떨어져도 | 'weighted' 절충
  jongThreshold: 0.70,        // 종격 판정 세력 비율
  ilhaengThreshold: 0.80,     // 일행득기격 판정 비율
  // 자리별 배점 (일간은 기준점이라 제외). 합 100.
  // 자리별 배점. 일간(나 자신)도 비겁 세력으로 포함한다 — 제외하면
  // 인비 기대값이 구조적으로 40%에 묶여 신약으로 치우친다.
  weights: { yearGan: 7, monthGan: 10, dayGan: 10, hourGan: 7,
             yearJi: 9, monthJi: 26, dayJi: 19, hourJi: 12 },
  includeDayGan: true,
};

/* ---------- 1. 오행 세력 점수 ----------
   지지는 지장간을 월률분야 일수 비율로 나눠 배분한다. */
function elementPower(saju, opts) {
  const o = { ...DEFAULTS, ...opts }, w = o.weights;
  const score = [0,0,0,0,0];
  const detail = [];
  const addGan = (g, pts, pos) => {
    if (g == null) return;
    score[R.G_OH[g]] += pts;
    detail.push({ pos, char: R.G[g], oh: R.OH[R.G_OH[g]], pts });
  };
  const addJi = (j, pts, pos) => {
    if (j == null) return;
    const parts = R.JIJANGGAN_WOLRYUL[j];
    const total = parts.reduce((a, b) => a + b[1], 0);
    for (const [g, days] of parts) {
      const p = pts * days / total;
      score[R.G_OH[g]] += p;
      detail.push({ pos, char: R.J[j], hidden: R.G[g], oh: R.OH[R.G_OH[g]], pts: Math.round(p*10)/10 });
    }
  };
  addGan(saju.year.gan, w.yearGan, '연간');
  addGan(saju.month.gan, w.monthGan, '월간');
  if (o.includeDayGan) addGan(saju.day.gan, w.dayGan, '일간');
  if (saju.hour) addGan(saju.hour.gan, w.hourGan, '시간');
  addJi(saju.year.ji, w.yearJi, '연지');
  addJi(saju.month.ji, w.monthJi, '월지');
  addJi(saju.day.ji, w.dayJi, '일지');
  if (saju.hour) addJi(saju.hour.ji, w.hourJi, '시지');

  const sum = score.reduce((a,b) => a+b, 0);
  const pct = score.map(v => Math.round(v / sum * 1000) / 10);
  return { score: score.map(v => Math.round(v*10)/10), pct, detail, sum: Math.round(sum*10)/10 };
}

/* 오행 세력 → 십성 그룹 세력 */
function groupPower(dayGan, power) {
  const out = {};
  for (const g of R.GROUPS) out[g] = power.pct[R.groupOh(dayGan, g)];
  return out;
}

/* ---------- 2. 신강/신약 (15강) ---------- */
function strength(saju, power, opts) {
  const d = saju.day.gan;
  const isAlly = ss => ['비겁','인성'].includes(R.SIPSEONG_GROUP[ss]);
  const deukRyeong = isAlly(R.sipseongOfJi(d, saju.month.ji));   // 득령: 월지
  const deukJi     = isAlly(R.sipseongOfJi(d, saju.day.ji));     // 득지: 일지
  // 득세: 월지·일지 외 자리의 인비 개수 2 이상
  const others = [
    R.sipseongOfGan(d, saju.year.gan), R.sipseongOfGan(d, saju.month.gan),
    R.sipseongOfJi(d, saju.year.ji),
  ];
  if (saju.hour) { others.push(R.sipseongOfGan(d, saju.hour.gan), R.sipseongOfJi(d, saju.hour.ji)); }
  const allyCount = others.filter(isAlly).length;
  const deukSe = allyCount >= 2;

  const gp = groupPower(d, power);
  const allyPct = Math.round((gp.비겁 + gp.인성) * 10) / 10;

  // 임계값은 1930~2025년 12만건 시뮬레이션 분포로 캘리브레이션.
  // 인비 세력 중앙값 45.7 / 평균 46.0 기준.
  let verdict, level, neutral = false;
  if (allyPct >= 62)      { verdict = '신강'; level = '태강'; }
  else if (allyPct >= 52) { verdict = '신강'; level = '신강'; }
  else if (allyPct >= 40) { verdict = allyPct >= 46 ? '신강' : '신약'; level = '중화'; neutral = true; }
  else if (allyPct >= 31) { verdict = '신약'; level = '신약'; }
  else                    { verdict = '신약'; level = '태약'; }

  const traditional = (deukRyeong && deukJi) ? '신강'
                    : (!deukRyeong && !deukJi) ? '신약'
                    : (deukSe ? '신강(유파에 따라 신약)' : '신약(유파에 따라 신강)');

  const agree = traditional.startsWith(verdict);
  const confidence = neutral ? '낮음' : agree ? '높음' : '보통';
  return {
    deukRyeong, deukJi, deukSe, allyCount, allyPct, verdict, level, traditional, neutral, confidence,
    caution: neutral ? '인비 세력이 40~52% 중화 구간 — 억부용신의 효용이 낮은 구간이라 조후·격국을 함께 봐야 한다(15강)' : null,
    agree,
    evidence: `월지 ${R.J[saju.month.ji]}=${deukRyeong ? '득령' : '실령'}, ` +
              `일지 ${R.J[saju.day.ji]}=${deukJi ? '득지' : '실지'}, ` +
              `그 외 인비 ${allyCount}개=${deukSe ? '득세' : '실세'}, 인비 세력 ${allyPct}%`,
  };
}

/* ---------- 3. 격국 — 내격 (16강) ----------
   월지 지장간 본기→중기→초기 순으로 투간 확인, 없으면 월지 십성 */
function gyeokguk(saju, power, opts) {
  const o = { ...DEFAULTS, ...opts };
  const d = saju.day.gan, mj = saju.month.ji;
  const parts = R.JIJANGGAN_WOLRYUL[mj].map(x => x[0]);
  const order = [...parts].reverse();                       // 본기, 중기, 초기
  const labels = ['본기', '중기', '초기'];
  const cheongan = [saju.year.gan, saju.month.gan];
  if (saju.hour) cheongan.push(saju.hour.gan);

  let found = null;
  for (let i = 0; i < order.length; i++) {
    if (cheongan.includes(order[i])) {
      found = { gan: order[i], via: labels[i] + ' 투간' };
      break;
    }
  }
  const primary = found
    ? R.sipseongOfGan(d, found.gan)
    : R.sipseongOfJi(d, mj);
  const via = found ? found.via : '투간 없음 → 월지 십성';

  // 정해 만세력식 반론: 특정 그룹 세력이 압도적이면 그쪽 격도 병기
  const gp = groupPower(d, power);
  const top = Object.entries(gp).sort((a,b) => b[1]-a[1])[0];
  const alt = (top[1] >= 50 && R.SIPSEONG_GROUP[primary] !== top[0])
    ? { group: top[0], pct: top[1], note: `${top[0]} 세력 ${top[1]}%로 압도적 — ${top[0]}격으로 보는 관점도 성립` }
    : null;

  // 월지 본기 십성을 그대로 격으로 삼는 유파(삼명통회·자평진전 계열)도 널리 쓰인다.
  // 투간 순서로만 잡으면 본기가 안 드러난 사주에서 결론이 갈리므로 둘 다 낸다.
  const 본기간 = R.bongi(mj);
  const 본기격 = R.sipseongOfGan(d, 본기간) + '격';
  const 갈림 = 본기격 !== primary + '격';
  // 월지 십성에 따른 전통 별칭 (16강)
  const 월지십성 = R.sipseongOfJi(d, mj);
  const 별칭 = 월지십성 === '비견' ? '건록격'
             : (월지십성 === '겁재' && R.G_YIN[d] === 0) ? '양인격' : null;
  return { name: primary + '격', primary, via, alt,
           월지십성, 별칭,
           본기격, 본기글자: R.G[본기간], 유파갈림: 갈림,
           유파: 갈림
             ? `투간 기준으로는 ${primary}격, 월지 본기(${R.G[본기간]}) 기준으로는 ${본기격}입니다. 두 관법이 갈리는 자리입니다`
             : null,
           evidence: `월지 ${R.J[mj]} 지장간 [${parts.map(g=>R.G[g]).join('')}], ${via}` };
}

/* ---------- 4. 용신 (15강) ---------- */
function yongsin(saju, power, str, opts) {
  const o = { ...DEFAULTS, ...opts };
  const d = saju.day.gan;
  const gp = groupPower(d, power);
  const results = [];

  // (a) 종격 / 일행득기격 — 억부보다 먼저 확인
  const sorted = Object.entries(gp).sort((a,b) => b[1]-a[1]);
  const [topGroup, topPct] = sorted[0];
  const hasAlly = gp.비겁 + gp.인성, hasFoe = gp.식상 + gp.재성 + gp.관성;
  if (topPct >= o.jongThreshold * 100) {
    const names = { 비겁:'종왕격', 인성:'종강격', 식상:'종아격', 재성:'종재격', 관성:'종관격' };
    results.push({ type: '종격', name: names[topGroup], group: topGroup,
      evidence: `${topGroup} 세력 ${topPct}% (기준 ${o.jongThreshold*100}% 이상)` });
  }
  const dayOhPct = power.pct[R.G_OH[d]];
  if (dayOhPct >= o.ilhaengThreshold * 100) {
    const names = ['곡직격','염상격','가색격','종혁격','윤하격'];
    results.push({ type: '일행득기격', name: names[R.G_OH[d]], group: '비겁',
      evidence: `일간 오행 ${R.OH[R.G_OH[d]]} 세력 ${dayOhPct}% (기준 ${o.ilhaengThreshold*100}% 이상)` });
  }

  // (b) 억부용신
  let eokbu = null;
  if (str.verdict === '신강') {
    // 인성·비겁 차이가 10%p 이내면 '비등'으로 본다 (정확히 같은 경우만 보면 거의 성립 안 함)
    const gap = gp.인성 - gp.비겁;
    const cause = Math.abs(gap) <= 10 ? '비등' : gap > 0 ? '인성' : '비겁';
    const pick = cause === '인성' ? ['재성','식상']
               : cause === '비겁' ? ['관성','식상']
               : ['식상','재성'];
    eokbu = { group: pick[0], second: pick[1],
      evidence: `신강(${str.allyPct}%) — ${cause === '비등' ? '인성·비겁 비등' : cause + '이 많아 신강'} → ${pick[0]} 1순위` };
  } else {
    const foes = { 관성: gp.관성, 식상: gp.식상, 재성: gp.재성 };
    const cause = Object.entries(foes).sort((a,b) => b[1]-a[1])[0][0];
    const pick = cause === '재성' ? ['비겁','인성'] : ['인성','비겁'];
    eokbu = { group: pick[0], second: pick[1],
      evidence: `신약(${str.allyPct}%) — ${R.josa(cause, '이가')} 많아 신약 → ${pick[0]} 1순위` };
  }
  // 억부용신이 원국에 아예 없으면 취용 불가
  const present = new Set();
  const chars = [[saju.year.gan,'g'],[saju.month.gan,'g'],[saju.day.gan,'g']];
  if (saju.hour) chars.push([saju.hour.gan,'g']);
  for (const [c] of chars) present.add(R.SIPSEONG_GROUP[R.sipseongOfGan(d, c)]);
  for (const j of [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])])
    present.add(R.SIPSEONG_GROUP[R.sipseongOfJi(d, j)]);
  eokbu.available = present.has(eokbu.group) || present.has(eokbu.second);
  if (!eokbu.available) eokbu.evidence += ' — 원국에 없어 취용 불가(종격 검토 대상)';
  results.push({ type: '억부', ...eokbu });

  // (c) 조후용신 — 한난조습 집계 (15강 일반 조후법)
  const johu = climate(saju);

  // (d) 통관용신 — 최강 오행이 생하는 오행
  const strongestOh = power.pct.indexOf(Math.max(...power.pct));
  const tonggwan = R.SAENG(strongestOh);
  results.push({ type: '통관', oh: R.OH[tonggwan],
    evidence: `최강 오행 ${R.OH[strongestOh]}(${power.pct[strongestOh]}%) → 설기처 ${R.OH[tonggwan]}` });

  // 최종 채택: 종격/일행득기 > 억부(취용 가능 시) > 조후
  // 조후가 채택될 때도 십성 그룹을 채워준다. 그룹이 비면 대운·세운·영역운의
  // 용신/기신 판정이 통째로 중립(0점)이 되어 운세가 무의미해진다(실측 2.66%).
  const ohToGroup = ohName => {
    const oh = R.OH.indexOf(ohName);
    if (oh < 0) return null;
    const me = R.G_OH[d];
    if (oh === me) return '비겁';
    if (oh === R.SAENG(me)) return '식상';
    if (oh === R.GEUK(me)) return '재성';
    if (oh === (me + 3) % 5) return '관성';
    if (oh === (me + 4) % 5) return '인성';
    return null;
  };
  const johuPick = () => {
    // 조후가 필요하다고 본 오행이 없으면, 억부 2순위라도 살려 쓴다
    const oh = johu.needed;
    const grp = oh ? ohToGroup(oh) : null;
    if (grp) return { type: '조후', oh, group: grp,
      evidence: johu.evidence + ` → 십성으로는 ${grp}` };
    const alt = eokbu.second || eokbu.group;
    return { type: '억부(차선)', group: alt,
      evidence: `억부 1순위를 원국에서 못 쓰고 조후도 뚜렷하지 않아 ${R.josa(alt, '을를')} 차선으로 잡는다`,
      확신도: '낮음' };
  };
  const primary = results.find(r => r.type === '종격' || r.type === '일행득기격')
    || (eokbu.available ? results.find(r => r.type === '억부') : null)
    || johuPick();

  // 용희기구한 (15강 표)
  const CHAIN = R.YONGSIN_CHAIN;
  const ug = primary.group || null;
  const chain = ug ? { 용신: ug, 희신: CHAIN[ug][0], 기신: CHAIN[ug][1],
                       구신: CHAIN[ug][2], 한신: CHAIN[ug][3] } : null;

  // 억부 ↔ 조후 충돌 점검
  let conflict = null;
  const ugOh = primary.group ? R.groupOh(d, primary.group) : null;
  if (ugOh != null && johu.needed && R.OH[ugOh] !== johu.needed)
    conflict = `억부용신 ${primary.group}(${R.OH[ugOh]})와 조후용신 ${R.josa(johu.needed, '이가')} 다르다 — ` +
               (str.neutral ? '중화 구간이라 조후 우선 검토 권장' : '원국 조열·한랭이 심하면 조후 우선');
  if (str.neutral && primary.type === '억부') primary.confidence = '낮음(중화 구간)';
  return { primary, all: results, johu, chain, conflict };
}

/* 한난조습 집계 — 글자마다 온도·습도 점수를 매겨 자리 가중으로 합한다 */
function climate(saju) {
  const GW = [0.5, 1.5, 2, 1.5];   // 연간 월간 일간 시간
  const JW = [0.5, 3, 2, 2];       // 연지 월지 일지 시지
  const gans = [saju.year.gan, saju.month.gan, saju.day.gan, ...(saju.hour?[saju.hour.gan]:[])];
  const jis  = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  let temp = 0, dry = 0;
  const detail = [];
  gans.forEach((g, i) => {
    temp += R.G_TEMP[g] * GW[i]; dry += R.G_DRY[g] * GW[i];
    detail.push(`${R.G[g]} ${R.G_TEMP[g] > 0 ? '+' : ''}${(R.G_TEMP[g]*GW[i]).toFixed(1)}`);
  });
  jis.forEach((j, i) => {
    temp += R.J_TEMP[j] * JW[i]; dry += R.J_DRY[j] * JW[i];
    detail.push(`${R.J[j]} ${R.J_TEMP[j] > 0 ? '+' : ''}${(R.J_TEMP[j]*JW[i]).toFixed(1)}`);
  });
  // 월지 계절은 조후의 축이라 따로 더한다
  const season = R.SEASON_TEMP[saju.month.ji] || 0;
  temp += season;
  temp = Math.round(temp*10)/10; dry = Math.round(dry*10)/10;

  const tone = temp > 3 ? '조열' : temp < -3 ? '한랭' : '중화';
  const moisture = dry > 3 ? '건조' : dry < -3 ? '습윤' : '중화';
  const needed = temp < -3 ? '화' : temp > 3 ? '수'
               : dry > 3 ? '수' : dry < -3 ? '화' : null;
  return {
    온도: temp, 습도: dry, 계절가산: season, tone, moisture, needed,
    han: temp < 0 ? Math.abs(temp) : 0, nan: temp > 0 ? temp : 0,
    jo: dry > 0 ? dry : 0, seup: dry < 0 ? Math.abs(dry) : 0,
    evidence: `온도 ${temp > 0 ? '+' : ''}${temp} (월지 ${R.J[saju.month.ji]} 계절가산 ${season > 0 ? '+' : ''}${season} 포함), ` +
      `습도 ${dry > 0 ? '+' : ''}${dry} → ${needed ? needed + ' 필요' : '조후는 급하지 않음'}`,
    내역: detail,
  };
}

/* ---------- 5. 합충형해파 ---------- */
function relations(saju, opts) {
  const o = { ...DEFAULTS, ...opts };
  const pos = ['년','월','일','시'];
  const gans = [saju.year.gan, saju.month.gan, saju.day.gan];
  const jis  = [saju.year.ji, saju.month.ji, saju.day.ji];
  if (saju.hour) { gans.push(saju.hour.gan); jis.push(saju.hour.ji); }
  const out = { 천간합:[], 천간충:[], 육합:[], 삼합:[], 반합:[], 방합:[], 충:[], 형:[], 해:[], 파:[], 암합:[] };
  const dist = (a,b) => Math.abs(a-b);
  const strengthOf = dNum => dNum === 1 ? '강' : '약(떨어져 있음)';

  for (let a = 0; a < gans.length; a++) for (let b = a+1; b < gans.length; b++) {
    for (const [x,y,oh] of R.CHEONGAN_HAP)
      if ((gans[a]===x&&gans[b]===y)||(gans[a]===y&&gans[b]===x))
        out.천간합.push({ pos:[pos[a],pos[b]], pair:R.G[gans[a]]+R.G[gans[b]], 합화:R.OH[oh], 거리:dist(a,b) });
    for (const [x,y] of R.CHEONGAN_CHUNG)
      if ((gans[a]===x&&gans[b]===y)||(gans[a]===y&&gans[b]===x))
        out.천간충.push({ pos:[pos[a],pos[b]], pair:R.G[gans[a]]+R.G[gans[b]], 거리:dist(a,b) });
  }
  for (let a = 0; a < jis.length; a++) for (let b = a+1; b < jis.length; b++) {
    const dn = dist(a,b);
    for (const [x,y,oh] of R.YUKHAP)
      if ((jis[a]===x&&jis[b]===y)||(jis[a]===y&&jis[b]===x))
        out.육합.push({ pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]], 합화:R.OH[oh], 거리:dn, 작용:strengthOf(dn) });
    for (const [x,y] of R.JIJI_CHUNG)
      if ((jis[a]===x&&jis[b]===y)||(jis[a]===y&&jis[b]===x))
        out.충.push({ pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]], 거리:dn, 작용:strengthOf(dn) });
    for (const [x,y] of R.YUKHAE)
      if ((jis[a]===x&&jis[b]===y)||(jis[a]===y&&jis[b]===x))
        if (dn === 1) out.해.push({ pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]] });
    for (const [x,y] of R.YUKPA)
      if ((jis[a]===x&&jis[b]===y)||(jis[a]===y&&jis[b]===x))
        out.파.push({ pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]], 거리:dn });
    for (const [x,y,oh] of R.AMHAP)
      if ((jis[a]===x&&jis[b]===y)||(jis[a]===y&&jis[b]===x))
        out.암합.push({ pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]], 합화:R.OH[oh], 거리:dn });
    if (jis[a]===jis[b] && R.JAHYEONG.includes(jis[a]) && dn === 1)
      out.형.push({ type:'병존자형', pos:[pos[a],pos[b]], pair:R.J[jis[a]].repeat(2), 작용:'강(붙어야 성립)' });
    if ((jis[a]===0&&jis[b]===3)||(jis[a]===3&&jis[b]===0))
      out.형.push({ type:R.SANGHYEONG.name, pos:[pos[a],pos[b]], pair:R.J[jis[a]]+R.J[jis[b]], 거리:dn });
  }
  // 삼합·방합·반합 (떨어져 있어도 성립 — 왕지 필수)
  for (const [s,w,g,oh] of R.SAMHAP) {
    const have = [s,w,g].filter(x => jis.includes(x));
    if (have.length === 3) out.삼합.push({ set:[s,w,g].map(x=>R.J[x]).join(''), 합화:R.OH[oh] });
    else if (have.length === 2 && have.includes(w))
      out.반합.push({ set:have.map(x=>R.J[x]).join(''), 합화:R.OH[oh], note:'왕지 포함 반합' });
  }
  for (const [a,b,c,oh] of R.BANGHAP)
    if ([a,b,c].every(x => jis.includes(x)))
      out.방합.push({ set:[a,b,c].map(x=>R.J[x]).join(''), 합화:R.OH[oh] });
  // 삼형
  for (const key of Object.keys(R.SAMHYEONG)) {
    const { ji: set, name } = R.SAMHYEONG[key];
    const have = set.filter(x => jis.includes(x));
    if (have.length === 3) out.형.push({ type:name, set:have.map(x=>R.J[x]).join(''), 완성:true });
    else if (have.length === 2) out.형.push({ type:name.split(' ')[0]+' 육형(2자)', set:have.map(x=>R.J[x]).join(''), 완성:false });
  }
  out.합력순서 = '삼합 > 방합 > 육합 > 반합 > 암합 (13강)';
  return out;
}

/* ---------- 6. 신살 ---------- */
function sinsal(saju, opts) {
  const o = { ...DEFAULTS, ...opts };
  const d = saju.day.gan, base = o.sinsalBase === 'year' ? saju.year.ji : saju.day.ji;
  const pos = ['년','월','일','시'];
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const pillars = [saju.year, saju.month, saju.day, ...(saju.hour?[saju.hour]:[])];
  const found = [];

  jis.forEach((j, i) => found.push({ name: R.sibisinsal(base, j), pos: pos[i], char: R.J[j], kind: '십이신살' }));
  jis.forEach((j, i) => { if ((R.CHEONEUL[d]||[]).includes(j))
    found.push({ name:'천을귀인', pos:pos[i], char:R.J[j], kind:'길신' }); });
  jis.forEach((j, i) => { if (R.MUNCHANG[d] === j)
    found.push({ name:'문창귀인', pos:pos[i], char:R.J[j], kind:'길신' }); });
  jis.forEach((j, i) => { if (R.HONGYEOM[d] === j)
    found.push({ name:'홍염살', pos:pos[i], char:R.J[j], kind:'중립' }); });
  jis.forEach((j, i) => { if (R.YANGIN[d] === j)
    found.push({ name:'양인살', pos:pos[i], char:R.J[j], kind:'흉신', note:'양간에만 적용' }); });

  // 백호·괴강은 일주 성립이 전제 (나무위키 기준)
  const isBaekho = p => R.BAEKHO.some(([g,j]) => p.gan===g && p.ji===j);
  const isGwaegang = p => R.GWAEGANG.some(([g,j]) => p.gan===g && p.ji===j);
  if (isBaekho(saju.day)) pillars.forEach((p,i) => { if (isBaekho(p))
    found.push({ name:'백호살', pos:pos[i], char:R.G[p.gan]+R.J[p.ji], kind:'흉신' }); });
  if (isGwaegang(saju.day)) pillars.forEach((p,i) => { if (isGwaegang(p))
    found.push({ name:'괴강살', pos:pos[i], char:R.G[p.gan]+R.J[p.ji], kind:'흉신' }); });

  // 귀문·원진은 지지 쌍
  for (let a = 0; a < jis.length; a++) for (let b = a+1; b < jis.length; b++) {
    if (R.GWIMUN[jis[a]] === jis[b]) found.push({ name:'귀문관살', pos:[pos[a],pos[b]], char:R.J[jis[a]]+R.J[jis[b]], kind:'흉신' });
    if (R.WONJIN[jis[a]] === jis[b]) found.push({ name:'원진살', pos:[pos[a],pos[b]], char:R.J[jis[a]]+R.J[jis[b]], kind:'흉신' });
  }
  // 현침살은 개수가 의미라 자리마다 세지 않고 몇 개인지로 본다
  const hcG = [saju.year.gan, saju.month.gan, saju.day.gan, ...(saju.hour?[saju.hour.gan]:[])]
    .filter(g => R.HYEONCHIM_G.includes(g));
  const hcJ = jis.filter(j => R.HYEONCHIM_J.includes(j));
  const hcAll = [...hcG.map(g=>R.G[g]), ...hcJ.map(j=>R.J[j])];
  if (hcAll.length >= 3)
    found.push({ name:'현침살', pos:'전체', char:hcAll.join(''), kind:'중립', 개수:hcAll.length });

  const gm = R.gongmang(saju.day.idx);
  jis.forEach((j,i) => { if (gm.includes(j) && i !== 2)
    found.push({ name:'공망', pos:pos[i], char:R.J[j], kind:'중립' }); });

  /* 같은 사실이 여러 줄로 불어나는 것을 정리한다.
     巳戌처럼 원진이면서 귀문인 쌍은 한 줄로 합치고,
     년·월이 같은 글자라 같은 신살이 두 번 잡히면 자리를 묶는다. */
  const merged = [];
  const key = x => x.name + '|' + (x.char || '');
  const posOf = x => Array.isArray(x.pos) ? x.pos.join('') : x.pos;
  // (1) 원진 + 귀문이 같은 자리면 하나로
  const wj = found.filter(x => x.name === '원진살');
  for (const w of wj) {
    const g = found.find(x => x.name === '귀문관살' && posOf(x) === posOf(w) && x.char === w.char);
    if (g) { w.name = '원진·귀문'; g.__drop = true; }
  }
  // (2) 이름·글자가 같으면 자리를 합친다
  const ORDER = { 년:0, 월:1, 일:2, 시:3 };
  const sortPos = ps => [...new Set(ps)].sort((a, b) => (ORDER[a] ?? 9) - (ORDER[b] ?? 9));
  for (const x of found) {
    if (x.__drop) continue;
    const hit = merged.find(m => key(m) === key(x));
    if (hit) {
      hit.pos = sortPos([...(Array.isArray(hit.pos) ? hit.pos : [hit.pos]),
                         ...(Array.isArray(x.pos) ? x.pos : [x.pos])]);
      hit.겹침 = true;
    } else {
      const c = { ...x };
      if (Array.isArray(c.pos)) c.pos = sortPos(c.pos);
      merged.push(c);
    }
  }
  found.length = 0; found.push(...merged);

  return { base: R.J[base], baseType: o.sinsalBase === 'year' ? '연지 기준(고법)' : '일지 기준(현대)',
           gongmang: gm.map(x => R.J[x]).join(''), list: found };
}

/* ---------- 7. 전체 조립 ---------- */
function analyze(saju, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const d = saju.day.gan;
  const power = elementPower(saju, o);
  const str = strength(saju, power, o);
  const gg = gyeokguk(saju, power, o);
  const ys = yongsin(saju, power, str, o);
  const rel = relations(saju, o);
  const ss = sinsal(saju, o);

  const pillars = [['년',saju.year],['월',saju.month],['일',saju.day]];
  if (saju.hour) pillars.push(['시',saju.hour]);
  const chart = pillars.map(([p, x]) => ({
    pos: p, 간: R.G[x.gan], 지: R.J[x.ji],
    간십성: p === '일' ? '일간(나)' : R.sipseongOfGan(d, x.gan),
    지십성: R.sipseongOfJi(d, x.ji),
    지장간: R.jijanggan(x.ji, o.jijangganMode).map(g => R.G[g]).join(''),
    십이운성: R.sibiunseong(d, x.ji),
  }));

  return {
    options: o, chart, power,
    groupPower: groupPower(d, power),
    strength: str, gyeokguk: gg, yongsin: ys, relations: rel, sinsal: ss,
  };
}

module.exports = { analyze, elementPower, groupPower, strength, gyeokguk, yongsin, climate, relations, sinsal, DEFAULTS };

return module.exports; })();

/* ===== saju-deep.js ===== */
__mods["saju-deep"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-deep.js — 심층 분석 레이어
   기존 saju-analyze.js가 못 보던 6가지를 메운다.
     1) 왕상휴수사 — 월령이 오행 강도 자체를 바꾸는 것
     2) 통근(通根)  — 천간이 지지에 뿌리를 두었는가
     3) 합화 반영   — 합이 이루어지면 세력표가 실제로 바뀌어야 함
     4) 격국 성패   — 격 이름이 아니라 그 격이 성립했는지
     5) 육친·궁위   — 배우자·부모·자식 자리
     6) 대운 해석   — 뽑기만 하지 말고 길흉과 합충을 판정
   ============================================================= */
const R = require('./saju-rules');

/* ---------- 1. 왕상휴수사 (旺相休囚死) ----------
   월령 오행 W 기준
     W          = 旺  (제철)
     W가 생함   = 相  (다음 차례)
     W를 생함   = 休  (할 일 끝냄)
     W를 극함   = 囚  (왕한 것을 치려다 갇힘)
     W가 극함   = 死  (왕한 것에 눌림)                */
// 월지에 이미 배점(26)을 줬으므로 계수까지 세게 곱하면 월령이 이중 계산된다.
// 계절 영향은 남기되 완만하게: 旺/死 비 1.60 (기존 2.17)
const WANGSANG = { 旺:1.20, 相:1.10, 休:0.95, 囚:0.85, 死:0.75 };
const SEASON_OH = { 2:0, 3:0, 5:1, 6:1, 8:3, 9:3, 11:4, 0:4, 1:2, 4:2, 7:2, 10:2 };

function wangsangsa(monthJi) {
  const W = SEASON_OH[monthJi];
  const state = [];
  for (let oh = 0; oh < 5; oh++) {
    let s;
    if (oh === W) s = '旺';
    else if (oh === R.SAENG(W)) s = '相';
    else if (R.SAENG(oh) === W) s = '休';
    else if (R.GEUK(oh) === W) s = '囚';
    else s = '死';
    state.push(s);
  }
  return { seasonOh: R.OH[W], state, coef: state.map(s => WANGSANG[s]) };
}

/* ---------- 2. 통근 (通根) ----------
   뿌리 강도 = 지지 지장간에 같은 오행이 있는지 + 12운성 위상
   녹왕근 100 / 생지근 70 / 고지근 40 / 여기근 30      */
const ROOT_BY_UNSEONG = { 건록:100, 제왕:100, 장생:70, 관대:65, 목욕:45, 묘:40, 양:35, 쇠:50, 병:20, 사:15, 절:0, 태:10 };

function tonggeun(gan, jis, posNames) {
  const roots = [];
  jis.forEach((j, i) => {
    if (j == null) return;
    const parts = R.JIJANGGAN_WOLRYUL[j];
    const total = parts.reduce((a, b) => a + b[1], 0);
    // 같은 오행인 지장간은 전부 합산한다. 午는 丙(여기)+丁(본기)이 모두 火라
    // 丙 일간에게 사실상 정근이다 — 하나만 골라 감점하면 제왕지를 약근으로 오판한다.
    const same = [], labels = [];
    let days = 0;
    parts.forEach(([hg, dd], k) => {
      if (R.G_OH[hg] === R.G_OH[gan]) {
        same.push(hg); days += dd;
        labels.push((k === parts.length - 1 ? '본기' : k === 0 ? '여기' : '중기') + R.G[hg]);
      }
    });
    if (same.length) {
      const ratio = days / total;
      const depth = ratio >= 0.5 ? 1.0 : ratio >= 0.3 ? 0.7 : 0.45;
      const us = R.sibiunseong(gan, j);
      const base = ROOT_BY_UNSEONG[us] ?? 30;
      const strength = Math.round(base * depth);
      roots.push({ pos: posNames[i], ji: R.J[j], via: labels.join('+'),
                   unseong: us, 지장간비중: Math.round(ratio*100)+'%', strength });
    }
  });
  const total = roots.reduce((a, b) => a + b.strength, 0);
  return {
    roots, total,
    verdict: total === 0 ? '무근(無根)' : total >= 150 ? '강근' : total >= 70 ? '유근' : '약근',
    note: total === 0 ? '천간이 지지에 뿌리가 없어 겉만 있고 실속이 없다 — 합·종으로 흐르기 쉽다' : null,
  };
}

/* ---------- 3. 합화 반영 세력 ----------
   천간합: 합화 조건(월령이 합화오행을 生·旺하게 하고, 합화오행을 극하는
           천간이 원국에 없을 것)을 충족해야 실제 化한다. 아니면 '합이불화'.
   삼합/방합: 완성 시 구성 지지 세력의 일부를 합화오행으로 이전.            */
function applyHapHwa(saju, basePower, rel, wss) {
  const moved = [];
  const pct = basePower.pct.slice();
  const gans = [saju.year.gan, saju.month.gan, saju.day.gan, ...(saju.hour ? [saju.hour.gan] : [])];

  // (a) 천간합
  const POS = ['년','월','일','시'];
  for (const h of rel.천간합) {
    const ohIdx = R.OH.indexOf(h.합화);
    // 합에 참여한 두 글자는 방해자로 세지 않는다. 자기가 합해서 그 오행이 되는데
    // 자신을 '합화오행을 극하는 천간'으로 카운트하면 모든 합이 불화로 판정된다.
    const 당사자 = new Set(h.pos.map(p => POS.indexOf(p)));
    const blocked = gans.some((g, i) => !당사자.has(i) && R.GEUK(R.G_OH[g]) === ohIdx);
    const seasonOk = ['旺','相'].includes(wss.state[ohIdx]);
    const involvesDay = h.pos.includes('일');
    h.化 = (!blocked && seasonOk) ? '化 성립' : '합이불화(合而不化)';
    h.사유 = blocked ? '합화 오행을 극하는 천간이 (합 당사자 외에) 원국에 있어 化하지 못함'
            : !seasonOk ? `월령에서 ${R.josa(h.합화, '이가')} ${wss.state[ohIdx]} — 化를 뒷받침할 계절이 아님`
            : '월령이 돕고 방해하는 극도 없어 化 성립';
    if (involvesDay) h.주의 = '일간이 낀 합 — 일간이 뿌리가 있으면 化하지 않는 것이 통설';
  }
  // (b) 지지 삼합·방합 완성 시 세력 이전
  const transfer = (setChars, ohName, ratio, label) => {
    const to = R.OH.indexOf(ohName);
    let pool = 0;
    for (const ch of setChars) {
      const j = R.J.indexOf(ch);
      const from = R.J_OH[j];
      if (from === to) continue;
      const take = pct[from] * ratio;
      pct[from] -= take; pool += take;
    }
    if (pool > 0) { pct[to] += pool; moved.push({ label, set: setChars.join(''), to: ohName, amount: Math.round(pool*10)/10 }); }
  };
  for (const s of rel.삼합)  transfer(s.set.split(''), s.합화, 0.55, '삼합');
  for (const b of rel.방합)  transfer(b.set.split(''), b.합화, 0.50, '방합');
  for (const r of rel.반합)  transfer(r.set.split(''), r.합화, 0.30, '반합');

  // (c) 충 — 충 당한 지지는 뿌리 기능이 약화
  const chungPenalty = [];
  for (const c of rel.충) {
    if (c.거리 > 1) continue;                    // 붙어 있을 때만 실질 타격
    for (const ch of c.pair.split('')) {
      const j = R.J.indexOf(ch), oh = R.J_OH[j];
      const cut = pct[oh] * 0.12;
      pct[oh] -= cut;
      chungPenalty.push({ 충: c.pair, 손상오행: R.OH[oh], 감소: Math.round(cut*10)/10 });
    }
  }
  const sum = pct.reduce((a,b)=>a+b,0);
  const norm = pct.map(v => Math.round(v / sum * 1000) / 10);
  return { pct: norm, moved, chungPenalty, changed: moved.length > 0 || chungPenalty.length > 0 };
}

/* ---------- 4. 왕상휴수사를 반영한 최종 세력 ---------- */
function refinedPower(saju, basePower, rel) {
  const wss = wangsangsa(saju.month.ji);
  const hap = applyHapHwa(saju, basePower, rel, wss);
  const weighted = hap.pct.map((v, i) => v * wss.coef[i]);
  const sum = weighted.reduce((a,b)=>a+b,0);
  const final = weighted.map(v => Math.round(v / sum * 1000) / 10);
  return {
    wangsangsa: wss,
    raw: basePower.pct,
    afterHap: hap.pct,
    final,
    hapDetail: hap,
    table: R.OH.map((o,i) => ({
      오행: o, 원국: basePower.pct[i], 합충반영: hap.pct[i],
      월령: wss.state[i], 계수: wss.coef[i], 최종: final[i],
    })),
  };
}

module.exports = { wangsangsa, tonggeun, applyHapHwa, refinedPower, WANGSANG, SEASON_OH, ROOT_BY_UNSEONG };

return module.exports; })();

/* ===== saju-pattern.js ===== */
__mods["saju-pattern"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-pattern.js — 격국 성패 / 십성 조합 / 육친·궁위 / 대운 해석
   근거: 자평진전 성패·상신론, 정해 만세력 10·15·16강
   ============================================================= */
const R = require('./saju-rules');

/* 길신은 順用(생조), 흉신은 逆用(제복). 상관만 순역 병용. */
const GYEOK_RULE = {
  정관격: { 용법:'순용', 상신:['재성','인성'], 파격:['상관','편관'],
    설명:'재성이 관을 생하거나(재생관) 인성이 일간을 받쳐야(관인상생) 격이 선다' },
  편관격: { 용법:'역용', 상신:['식상','인성','비겁'], 파격:['재성'],
    설명:'식신으로 제살하거나 인수로 화살하지 않으면 칠살이 일간을 친다' },
  정재격: { 용법:'순용', 상신:['식상','관성'], 파격:['비겁'],
    설명:'식상이 재를 생하고 관이 비겁을 막아야 재를 지킨다' },
  편재격: { 용법:'순용', 상신:['식상','관성'], 파격:['비겁'],
    설명:'식상생재로 흐르고 관성이 겁재를 제어해야 한다' },
  정인격: { 용법:'순용', 상신:['관성','식상'], 파격:['재성'],
    설명:'관살이 인을 생하면 귀하고, 인이 과하면 식상으로 덜어야 한다' },
  편인격: { 용법:'역용', 상신:['재성','관성'], 파격:['식신'],
    설명:'재성으로 편인을 눌러야 하며 식신을 만나면 도식(倒食)이 된다' },
  식신격: { 용법:'순용', 상신:['재성','편관'], 파격:['편인'],
    설명:'식신생재로 흐르거나 칠살을 제복할 때 격이 산다' },
  상관격: { 용법:'순역 병용', 상신:['인성','재성'], 파격:['정관'],
    설명:'상관패인이 으뜸이고 상관생재가 다음이며, 정관을 보면 깨진다' },
  비견격: { 용법:'순용', 상신:['재성','관성','식상'], 파격:[],
    설명:'건록격에 준한다. 재관이 투출해야 쓸모가 생긴다' },
  겁재격: { 용법:'역용', 상신:['관성'], 파격:['재성'],
    설명:'양인격에 준한다. 관살로 제복해야 하며 제복 없으면 거칠어진다' },
};

/** 십성별 노출 레벨: 2=천간 투출, 1.5=지지(본기), 0.5=지장간에만, 0=없음.
    지장간에만 숨은 글자를 투출한 글자와 동급으로 세면 조합이 과잉 탐지된다. */
function presence(saju) {
  const d = saju.day.gan, lv = {};
  const put = (ss, v) => { lv[ss] = Math.max(lv[ss] || 0, v); };
  const gans = [saju.year.gan, saju.month.gan, ...(saju.hour ? [saju.hour.gan] : [])];
  for (const g of gans) put(R.sipseongOfGan(d, g), 2);
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour ? [saju.hour.ji] : [])];
  for (const j of jis) {
    put(R.sipseongOfJi(d, j), 1.5);
    const parts = R.JIJANGGAN_WOLRYUL[j];
    parts.forEach(([hg], k) => put(R.sipseongOfGan(d, hg), k === parts.length - 1 ? 1.5 : 0.5));
  }
  for (const n of R.SIPSEONG) if (!lv[n]) lv[n] = 0;
  return lv;
}
const LVNAME = v => v >= 2 ? '투출' : v >= 1.5 ? '지지' : v > 0 ? '암장' : '없음';

/** 원국 8자의 십성 목록 (일간 제외) + 지장간 십성 */
function collectSipseong(saju) {
  const d = saju.day.gan;
  const open = [], hidden = [];
  const gans = [['년',saju.year.gan],['월',saju.month.gan]];
  if (saju.hour) gans.push(['시',saju.hour.gan]);
  for (const [p,g] of gans) open.push({ pos:p, layer:'천간', char:R.G[g], ss:R.sipseongOfGan(d,g) });
  const jis = [['년',saju.year.ji],['월',saju.month.ji],['일',saju.day.ji]];
  if (saju.hour) jis.push(['시',saju.hour.ji]);
  for (const [p,j] of jis) {
    open.push({ pos:p, layer:'지지', char:R.J[j], ss:R.sipseongOfJi(d,j) });
    for (const g of R.jijanggan(j)) hidden.push({ pos:p, layer:'지장간', char:R.G[g], ss:R.sipseongOfGan(d,g) });
  }
  return { open, hidden, openNames: open.map(x=>x.ss), allNames: [...open, ...hidden].map(x=>x.ss) };
}

/* ---------- 격국 성패 ---------- */
function gyeokSuccess(saju, gyeokName, gp, str) {
  const rule = GYEOK_RULE[gyeokName];
  if (!rule) return null;
  const lv = presence(saju);
  // 상신·파격 모두 '드러난 것'(천간 투출 또는 지지 본기)만 인정한다.
  // 지장간에 숨은 글자로 격이 깨졌다고 판정하면 성패가 과잉으로 나온다.
  const OPEN = 1.5;
  const groupLv = g => Math.max(...R.SIPSEONG.filter(n => R.SIPSEONG_GROUP[n] === g).map(n => lv[n] || 0));
  const levelOf = x => R.SIPSEONG.includes(x) ? (lv[x] || 0) : groupLv(x);

  const found상신 = rule.상신.filter(g => levelOf(g) >= OPEN);
  const found파격 = rule.파격.filter(g => levelOf(g) >= OPEN);
  const 잠복파격 = rule.파격.filter(g => levelOf(g) > 0 && levelOf(g) < OPEN);
  const groupsOpen = R.GROUPS.filter(g => groupLv(g) >= OPEN);

  const notes = [];
  // 세력 조건 — 재격·정관격은 신강해야 감당한다
  if (['정재격','편재격','정관격'].includes(gyeokName) && str.verdict === '신약')
    notes.push(`${R.josa(gyeokName, '은는')} 일간이 재·관을 감당해야 하는데 신약(${str.allyPct}%) — 신약재다/신약관왕으로 기운다`);
  if (gyeokName === '편관격' && str.verdict === '신약' && !groupsOpen.includes('인성') && !groupsOpen.includes('식상'))
    notes.push('칠살이 왕한데 제복(식상)도 화살(인성)도 없다 — 살중신경(殺重身輕)');

  let verdict, reason;
  if (found상신.length && !found파격.length) { verdict = '성격(成格)'; reason = `상신 ${found상신.join('·')} 확보, 파격 요소 없음`; }
  else if (found상신.length && found파격.length) { verdict = '성중유패(成中有敗)'; reason = `상신 ${R.josa(found상신.join('·'), '은는')} 있으나 ${R.josa(found파격.join('·'), '이가')} 격을 흔든다`; }
  else if (!found상신.length && found파격.length) { verdict = '패격(敗格)'; reason = `상신 없이 ${found파격.join('·')}만 있어 격이 깨졌다`; }
  else { verdict = '격이 뚜렷하지 않음'; reason = '상신도 파격도 드러나지 않아 격의 작용이 흐리다'; }

  if (잠복파격.length) notes.push(`${R.josa(잠복파격.join('·'), '이가')} 지장간에 잠복 — 대운·세운에서 투출하면 그때 격이 흔들린다`);
  return { 격: gyeokName, 용법: rule.용법, 상신후보: rule.상신, 확보한상신: found상신,
           파격요소: found파격, 잠복파격, 판정: verdict, 근거: reason, 원리: rule.설명, 주의: notes };
}

/* ---------- 십성 조합 패턴 ---------- */
function patterns(saju, gp, str) {
  const lv = presence(saju);
  const d = saju.day.gan;
  const out = [];
  // 두 글자가 엮이는 조합은 약한 쪽 레벨이 곧 그 조합의 실효 강도가 된다.
  const add = (name, kind, cond, desc, parts2) => {
    if (!cond) return;
    let force = '뚜렷', min = 2;
    if (parts2 && parts2.length) {
      min = Math.min(...parts2.map(n => lv[n] ?? 0));
      force = min >= 2 ? '뚜렷' : min >= 1.5 ? '보통' : '암시';
    }
    // 양쪽이 다 드러난(투출/지지) 조합만 본조합으로 인정한다.
    // 지장간에만 숨은 글자로 조합을 세면 거의 모든 사주에 전부 걸려 변별력이 사라진다.
    out.push({ name, kind, force, desc, 실효: min >= 1.5,
      구성: parts2 ? parts2.map(n => `${n}(${LVNAME(lv[n])})`).join(' + ') : '세력 조건' });
  };
  const N = { includes: n => (lv[n] ?? 0) > 0 };

  add('식신제살', '길', N.includes('식신') && N.includes('편관'),
      '식신이 칠살을 눌러 흉이 권위로 바뀐다 — 칠살의 추진력을 통제해 쓰는 구조', ['식신','편관']);
  add('상관견관', '흉', N.includes('상관') && N.includes('정관'),
      '상관이 정관을 상하게 한다 — 조직·상사·규범과 부딪히기 쉽다', ['상관','정관']);
  add('상관패인', '길', N.includes('상관') && N.includes('정인'),
      '인수가 상관의 날을 눌러 재능이 품위를 얻는다 — 상관생재보다 격이 높다고 본다', ['상관','정인']);
  add('상관생재', '길', N.includes('상관') && (N.includes('정재')||N.includes('편재')),
      '표현력이 곧바로 수익으로 이어지는 구조', ['상관', lv['정재']>=lv['편재']?'정재':'편재']);
  add('식상생재', '길', N.includes('식신') && (N.includes('정재')||N.includes('편재')),
      '꾸준한 생산이 재물로 안착한다 — 가장 무난한 돈의 흐름', ['식신', lv['정재']>=lv['편재']?'정재':'편재']);
  add('살인상생', '길', N.includes('편관') && (N.includes('정인')||N.includes('편인')),
      '칠살의 압력이 인수를 거쳐 나를 키우는 힘으로 전환된다', ['편관', lv['정인']>=lv['편인']?'정인':'편인']);
  add('관인상생', '길', N.includes('정관') && N.includes('정인'),
      '명예와 학문이 이어져 조직 안에서 신뢰를 얻는 구조', ['정관','정인']);
  add('재생관', '길', (N.includes('정재')||N.includes('편재')) && N.includes('정관'),
      '재물이 지위를 뒷받침한다', [lv['정재']>=lv['편재']?'정재':'편재','정관']);
  add('재생살', '흉', (N.includes('정재')||N.includes('편재')) && N.includes('편관') && str.verdict==='신약',
      '신약한데 재가 칠살을 키운다 — 돈이 오히려 나를 치는 구조');
  add('관살혼잡', '흉', N.includes('정관') && N.includes('편관'),
      '정관과 칠살이 섞여 기준이 둘이 된다 — 거관유살/거살유관으로 하나를 정리해야 한다', ['정관','편관']);
  add('군겁쟁재', '흉', gp.비겁 >= 40 && gp.재성 <= 15,
      `비겁 ${gp.비겁}%에 재성 ${gp.재성}% — 여럿이 적은 재물을 다툰다`);
  add('재다신약', '흉', gp.재성 >= 35 && str.verdict === '신약',
      `재성 ${gp.재성}%인데 신약 — 큰돈이 오가도 내 것이 되기 어렵다`);
  add('모자멸자', '흉', gp.인성 >= 45,
      `인성 ${gp.인성}% — 받쳐주는 힘이 과해 자립이 늦고 외골수가 되기 쉽다`);
  add('탐재괴인', '흉', (N.includes('정재')||N.includes('편재')) && N.includes('정인') && str.verdict==='신약',
      '재가 인수를 깨뜨린다 — 이익을 좇다 명분과 공부를 잃는 구조', [lv['정재']>=lv['편재']?'정재':'편재','정인']);
  add('효신탈식', '흉', N.includes('편인') && N.includes('식신'),
      '편인이 식신을 빼앗는다(도식) — 시작한 일이 중동무이되기 쉽다', ['편인','식신']);
  add('제살태과', '흉', (gp.식상 >= 40) && N.includes('편관') && gp.관성 <= 12,
      '식상이 너무 강해 칠살을 지나치게 눌렀다 — 통제할 대상이 사라져 공허해진다');
  add('살중신경', '흉', gp.관성 >= 35 && str.verdict === '신약',
      `관성 ${gp.관성}%에 신약 — 감당 못 할 책임이 계속 주어진다`);
  add('양인가살', '길', R.YANGIN[d] != null &&
      [saju.year.ji,saju.month.ji,saju.day.ji,...(saju.hour?[saju.hour.ji]:[])].includes(R.YANGIN[d]) && N.includes('편관'),
      '양인의 칼을 칠살이 잡아준다 — 무관·의료·법조처럼 강한 직역에서 힘을 쓴다');
  // 재관쌍미 — 일지 지장간에 재성과 관성이 함께 든 일주(壬午·癸巳).
  // 힐러리 해석에 나온 개념인데 구현이 없었다.
  // 지장간에 재관이 같이 든 일주는 넷이지만, 전통적으로 재관쌍미라 부르는 것은
  // 壬午·癸巳 둘이다. 넓게 잡으면 출현율이 두 배가 되어 변별력이 떨어진다.
  const d2 = saju.day.gan, j2 = saju.day.ji;
  const 쌍미 = (d2 === 8 && j2 === 6) || (d2 === 9 && j2 === 5);   // 壬午, 癸巳
  // 일주 자체로 성립하는 구조라 십성 레벨 조건을 걸지 않는다.
  // 걸면 재·관이 지장간에만 있을 때(그게 이 구조의 정의다) 암시로 빠져버린다.
  add('재관쌍미', '길', 쌍미 && str.verdict !== '신약',
      '일지 안에 재물과 자리가 함께 들었다 — 둘을 한 자리에서 쥐는 형태다. 감당할 힘이 있으면 크게 쓴다');
  add('재관쌍미(신약)', '흉', 쌍미 && str.verdict === '신약',
      '일지에 재와 관이 함께 들었으나 신약하다 — 쥘 것은 많은데 감당할 힘이 모자란다');

  add('신왕무의', '흉', str.level === '태강' && gp.식상 + gp.재성 + gp.관성 <= 20,
      '일간만 왕성하고 쓸 곳(식·재·관)이 없다 — 힘이 갈 데가 없어 헛돈다');
  add('금수상관', '특례', R.G_OH[d] === 3 && [11,0,1].includes(saju.month.ji) && N.includes('상관'),
      '겨울 금일간의 수 상관 — 조후가 급해 火가 있어야 얼지 않는다(자평진전 18장)');
  add('목화상관', '특례', R.G_OH[d] === 0 && [5,6,7].includes(saju.month.ji) && N.includes('상관'),
      '여름 목일간의 화 상관 — 메마르기 쉬워 水가 있어야 산다(자평진전 18장)');

  const rank = { 뚜렷:0, 보통:1, 암시:2 };
  out.sort((a,b) => rank[a.force] - rank[b.force]);
  const main = out.filter(x => x.실효);
  const latent = out.filter(x => !x.실효);
  main.주요 = true;
  return Object.assign(main, { 암시조합: latent });
}

module.exports_presence = presence;

/* ---------- 육친·궁위 ---------- */
const GUNGWI = [
  { 주:'연주', 궁:'조상·부모 뿌리', 시기:'초년 (0~15세)' },
  { 주:'월주', 궁:'부모·형제, 사회적 출발', 시기:'청년 (16~30세)' },
  { 주:'일주', 궁:'나(일간)와 배우자(일지)', 시기:'중년 (31~45세)' },
  { 주:'시주', 궁:'자식·아랫사람, 노후', 시기:'말년 (46세~)' },
];
function yukchin(saju, gender) {
  const d = saju.day.gan;
  const male = gender === 'M';
  const map = male
    ? { 재성:'아내·여자', 편재:'아버지', 관성:'자식', 인성:'어머니', 비겁:'형제·동료', 식상:'장인·처가' }
    : { 관성:'남편·남자', 편재:'아버지', 식상:'자식', 인성:'어머니', 비겁:'형제·자매', 재성:'시댁·재물' };
  const pillars = [['연주',saju.year],['월주',saju.month],['일주',saju.day],...(saju.hour?[['시주',saju.hour]]:[])];
  const rows = pillars.map(([p, x], i) => ({
    ...GUNGWI[i],
    간지: R.G[x.gan] + R.J[x.ji],
    천간십성: p === '일주' ? '일간(나)' : R.sipseongOfGan(d, x.gan),
    지지십성: R.sipseongOfJi(d, x.ji),
    십이운성: R.sibiunseong(d, x.ji),
  }));
  // 배우자궁(일지) 별도 진단
  const spouseSS = R.sipseongOfJi(d, saju.day.ji);
  const spouseStar = male ? ['정재','편재'] : ['정관','편관'];
  const all = collectSipseong(saju).allNames;
  const spouseStarCount = all.filter(n => spouseStar.includes(n)).length;
  return {
    표: rows, 육친배속: map,
    배우자궁: {
      글자: R.J[saju.day.ji], 십성: spouseSS, 십이운성: R.sibiunseong(d, saju.day.ji),
      배우자성: spouseStar.join('/'), 개수: spouseStarCount,
      메모: spouseStarCount === 0 ? '배우자성이 원국에 드러나지 않음 — 지장간·운에서 찾아야 한다'
           : spouseStarCount >= 3 ? '배우자성이 과다 — 인연이 여럿 스치거나 관계가 복잡해지기 쉽다' : null,
    },
  };
}

/* ---------- 대운 해석 ---------- */
function daeunAnalysis(saju, daeun, yongsinGroup, gp) {
  const d = saju.day.gan;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const gans = [saju.year.gan, saju.month.gan, ...(saju.hour?[saju.hour.gan]:[])];
  const CHAIN = R.YONGSIN_CHAIN;
  const chain = yongsinGroup ? CHAIN[yongsinGroup] : null;
  const rank = g => !chain ? '—' : g === yongsinGroup ? '용신운'
    : g === chain[0] ? '희신운' : g === chain[1] ? '기신운' : g === chain[2] ? '구신운' : '한신운';

  return daeun.map(du => {
    const ganSS = R.sipseongOfGan(d, du.gan), jiSS = R.sipseongOfJi(d, du.ji);
    const ganG = R.SIPSEONG_GROUP[ganSS], jiG = R.SIPSEONG_GROUP[jiSS];
    const events = [];
    for (const [x,y] of R.JIJI_CHUNG) {
      if (du.ji === x && jis.includes(y)) events.push(`${R.J[x]}${R.J[y]}충`);
      if (du.ji === y && jis.includes(x)) events.push(`${R.J[y]}${R.J[x]}충`);
    }
    if (du.ji === (R.JIJI_CHUNG.find(p=>p.includes(saju.month.ji))||[]).find(v=>v!==saju.month.ji))
      events.push('제강충(월지를 충) — 판이 바뀌는 시기');
    for (const [x,y,oh] of R.YUKHAP) {
      if (du.ji === x && jis.includes(y)) events.push(`${R.J[x]}${R.J[y]}합→${R.OH[oh]}`);
      if (du.ji === y && jis.includes(x)) events.push(`${R.J[y]}${R.J[x]}합→${R.OH[oh]}`);
    }
    for (const [x,y,oh] of R.CHEONGAN_HAP) {
      if (du.gan === x && gans.includes(y)) events.push(`${R.G[x]}${R.G[y]}합→${R.OH[oh]}`);
      if (du.gan === y && gans.includes(x)) events.push(`${R.G[y]}${R.G[x]}합→${R.OH[oh]}`);
      if ((du.gan === x && d === y) || (du.gan === y && d === x)) events.push('일간과 천간합 — 마음이 묶이는 운');
    }
    const score = { 용신운:2, 희신운:1, 한신운:0, 구신운:-1, 기신운:-2, '—':0 };
    const total = (score[rank(ganG)] || 0) * 0.4 + (score[rank(jiG)] || 0) * 0.6;
    return {
      시작나이: du.start, 간지: du.han,
      천간: { 글자:R.G[du.gan], 십성:ganSS, 평가:rank(ganG) },
      지지: { 글자:R.J[du.ji], 십성:jiSS, 평가:rank(jiG), 십이운성:R.sibiunseong(d, du.ji) },
      원국작용: events,
      종합: total >= 1.2 ? '매우 좋음' : total >= 0.4 ? '좋음' : total > -0.4 ? '보통' : total > -1.2 ? '주의' : '매우 주의',
      점수: Math.round(total*100)/100,
      비고: '지지를 천간보다 6:4로 무겁게 본다 — 대운은 계절(월령)이 바뀌는 것이라 지지가 핵심',
    };
  });
}

/* ---------- 세운(연운) ---------- */
function saeunAnalysis(saju, year, yongsinGroup, daeunPillar) {
  const d = saju.day.gan;
  const idx = ((year - 4) % 60 + 60) % 60;
  const gan = idx % 10, ji = idx % 12;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const gans = [saju.year.gan, saju.month.gan, ...(saju.hour?[saju.hour.gan]:[])];
  const CHAIN = R.YONGSIN_CHAIN;
  const chain = yongsinGroup ? CHAIN[yongsinGroup] : null;
  const rank = g => !chain ? '—' : g === yongsinGroup ? '용신운'
    : g === chain[0] ? '희신운' : g === chain[1] ? '기신운' : g === chain[2] ? '구신운' : '한신운';
  const ganSS = R.sipseongOfGan(d, gan), jiSS = R.sipseongOfJi(d, ji);
  const ev = [];
  for (const [x,y] of R.JIJI_CHUNG) {
    if (ji === x && jis.includes(y)) ev.push(`${R.J[x]}${R.J[y]}충`);
    if (ji === y && jis.includes(x)) ev.push(`${R.J[y]}${R.J[x]}충`);
  }
  for (const [x,y,oh] of R.YUKHAP) {
    if (ji === x && jis.includes(y)) ev.push(`${R.J[x]}${R.J[y]}합→${R.OH[oh]}`);
    if (ji === y && jis.includes(x)) ev.push(`${R.J[y]}${R.J[x]}합→${R.OH[oh]}`);
  }
  for (const [x,y] of R.CHEONGAN_CHUNG) {
    if ((gan === x && d === y) || (gan === y && d === x)) ev.push('일간을 천간충 — 몸과 결정에 부담');
  }
  // 대운과 세운이 동시에 충하면 작용이 커진다
  let 대세운 = null;
  if (daeunPillar) {
    const dj = daeunPillar.ji;
    if (R.JIJI_CHUNG.some(([x,y]) => (x===dj&&y===ji)||(y===dj&&x===ji))) 대세운 = '대운·세운 천충지충 — 변동이 큰 해';
    if (dj === ji) 대세운 = '대운과 세운 지지가 겹침(복음) — 같은 국면이 강하게 반복';
  }
  const score = { 용신운:2, 희신운:1, 한신운:0, 구신운:-1, 기신운:-2, '—':0 };
  const total = (score[rank(R.SIPSEONG_GROUP[ganSS])]||0)*0.4 + (score[rank(R.SIPSEONG_GROUP[jiSS])]||0)*0.6;
  return { 연도: year, 간지: R.G[gan]+R.J[ji],
    천간: { 글자:R.G[gan], 십성:ganSS, 평가:rank(R.SIPSEONG_GROUP[ganSS]) },
    지지: { 글자:R.J[ji], 십성:jiSS, 평가:rank(R.SIPSEONG_GROUP[jiSS]), 십이운성:R.sibiunseong(d, ji) },
    원국작용: ev, 대세운관계: 대세운,
    종합: total >= 1.2 ? '매우 좋음' : total >= 0.4 ? '좋음' : total > -0.4 ? '보통' : total > -1.2 ? '주의' : '매우 주의',
    점수: Math.round(total*100)/100 };
}

module.exports = { GYEOK_RULE, presence, collectSipseong, saeunAnalysis, gyeokSuccess, patterns, yukchin, daeunAnalysis, GUNGWI };

return module.exports; })();

/* ===== saju-advanced.js ===== */
__mods["saju-advanced"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-advanced.js — 궁성론 / 묘고 / 일주론 / 격국 고저
   근거: 적천수 부처장(일지=처궁), 궁성론 통설, 개고(開庫) 간법
   ============================================================= */
const R = require('./saju-rules');

/* ---------- 1. 궁성론 (宮星論) ----------
   궁(宮)=자리, 성(星)=십성. 둘은 다른 층위라 반드시 교차해서 읽는다.
   궁은 "그 사람이 머무는 방", 성은 "그 사람 자체의 존재감". */
const GUNG = [
  { 주:'연주', 궁:'조상궁', 대상:'조상·가문·초년 환경' },
  { 주:'월주', 궁:'부모궁', 대상:'부모·형제·사회적 출발' },
  { 주:'일주', 궁:'배우자궁', 대상:'배우자·중년·가장 가까운 사람' },
  { 주:'시주', 궁:'자식궁', 대상:'자식·아랫사람·말년' },
];

function starOf(gender, kind) {
  const M = gender === 'M';
  return {
    배우자: M ? ['정재','편재'] : ['정관','편관'],
    자식:   M ? ['정관','편관'] : ['식신','상관'],
    부친:   ['편재'],
    모친:   ['정인','편인'],
    형제:   ['비견','겁재'],
  }[kind];
}

/** 어떤 십성이 원국 어디에 있는지 위치 목록 */
function locate(saju, names) {
  const d = saju.day.gan, hits = [];
  const P = ['년','월','일','시'];
  const gs = [saju.year.gan, saju.month.gan, null, saju.hour ? saju.hour.gan : null];
  const js = [saju.year.ji, saju.month.ji, saju.day.ji, saju.hour ? saju.hour.ji : null];
  gs.forEach((g, i) => { if (g != null && names.includes(R.sipseongOfGan(d, g)))
    hits.push({ 자리: P[i] + '간', 글자: R.G[g], 십성: R.sipseongOfGan(d, g), 층: '천간', 무게: 2 }); });
  js.forEach((j, i) => {
    if (j == null) return;
    if (names.includes(R.sipseongOfJi(d, j)))
      hits.push({ 자리: P[i] + '지', 글자: R.J[j], 십성: R.sipseongOfJi(d, j), 층: '지지(본기)', 무게: 1.5 });
    const parts = R.JIJANGGAN_WOLRYUL[j];
    parts.forEach(([hg], k) => {
      if (k === parts.length - 1) return;                 // 본기는 위에서 처리
      if (names.includes(R.sipseongOfGan(d, hg)))
        hits.push({ 자리: P[i] + '지장간', 글자: R.G[hg], 십성: R.sipseongOfGan(d, hg), 층: '암장', 무게: 0.5 });
    });
  });
  return hits;
}

function gungseong(saju, gender) {
  const d = saju.day.gan;
  const P = [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
  const rows = GUNG.slice(0, P.length).map((g, i) => {
    const x = P[i];
    const 궁십성 = i === 2 ? R.sipseongOfJi(d, x.ji) : R.sipseongOfJi(d, x.ji);
    return { ...g, 간지: R.G[x.gan] + R.J[x.ji],
      궁의십성: 궁십성, 천간십성: i === 2 ? '일간(나)' : R.sipseongOfGan(d, x.gan),
      십이운성: R.sibiunseong(d, x.ji) };
  });

  // 궁 × 성 교차 — 배우자를 예로 들면
  const 배우자성 = starOf(gender, '배우자');
  const spouseLoc = locate(saju, 배우자성);
  const inGung = spouseLoc.filter(h => h.자리.startsWith('일'));
  const 자식성 = starOf(gender, '자식');
  const childLoc = locate(saju, 자식성);
  const inChildGung = childLoc.filter(h => h.자리.startsWith('시'));

  const verdict = (성name, loc, inG, 궁name) => {
    if (!loc.length) return { 상태:'무성(無星)',
      해설:`${R.josa(성name, '이가')} 원국 어디에도 드러나지 않는다 — 인연이 늦거나 운에서 들어올 때 비로소 만들어진다` };
    if (inG.length) {
      const open = inG.some(h => h.층 !== '암장');
      return { 상태: open ? '궁성일치(宮星一致)' : '궁 안에 암장',
        해설: open
          ? `${R.josa(성name, '이가')} ${궁name} 자리에 그대로 앉았다 — 대상이 뚜렷하고 관계의 무게가 크다. 궁성론에서 가장 분명한 형태다`
          : `${R.josa(성name, '이가')} ${궁name} 지장간에 숨어 있다 — 있으되 드러나지 않아, 충으로 창고가 열리거나 운에서 투출할 때 선명해진다` };
    }
    return { 상태:'궁성분리(宮星分離)',
      해설:`${R.josa(성name, '은는')} 있으나 ${R.josa(궁name, '이가')} 아닌 ${loc.map(h=>h.자리).join('·')}에 있다 — 대상은 있지만 자리와 어긋나, 인연의 형태가 통상과 다르게 풀리기 쉽다` };
  };

  return {
    궁: rows,
    배우자: { 성: 배우자성.join('/'), 위치: spouseLoc, 개수: spouseLoc.length,
      궁의십성: R.sipseongOfJi(d, saju.day.ji), ...verdict('배우자성', spouseLoc, inGung, '배우자궁(일지)') },
    자식: saju.hour ? { 성: 자식성.join('/'), 위치: childLoc, 개수: childLoc.length,
      궁의십성: R.sipseongOfJi(d, saju.hour.ji), ...verdict('자식성', childLoc, inChildGung, '자식궁(시지)') } : null,
    부친: { 성:'편재', 위치: locate(saju, ['편재']) },
    모친: { 성:'정인/편인', 위치: locate(saju, ['정인','편인']) },
  };
}

/* ---------- 2. 묘고(墓庫) 개고(開庫) ----------
   辰戌丑未는 창고다. 무엇을 담았는지는 중기로 본다.
     辰=수고(癸), 戌=화고(丁), 丑=금고(辛), 未=목고(乙)
   창고는 충을 맞아야 열린다. 재성의 창고가 열리면 재물이 나오고,
   관성의 창고가 열리면 자리가 열린다고 본다. */
const GOJI = { 4:{ 중기:9, 오행:4, 이름:'수고(水庫)' }, 10:{ 중기:3, 오행:1, 이름:'화고(火庫)' },
               1:{ 중기:7, 오행:3, 이름:'금고(金庫)' }, 7:{ 중기:1, 오행:0, 이름:'목고(木庫)' } };

function myogo(saju, extraJi = []) {
  const d = saju.day.gan;
  const P = ['년','월','일','시'];
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, saju.hour ? saju.hour.ji : null];
  const all = [...jis.filter(x => x != null), ...extraJi];
  const out = [];
  jis.forEach((j, i) => {
    if (j == null || !GOJI[j]) return;
    const g = GOJI[j];
    const 담긴십성 = R.sipseongOfGan(d, g.중기);
    const chungPartner = R.JIJI_CHUNG.find(p => p.includes(j));
    const opener = chungPartner ? chungPartner.find(v => v !== j) : null;
    const opened = opener != null && all.includes(opener);
    out.push({
      자리: P[i] + '지', 글자: R.J[j], 창고: g.이름,
      담긴것: `${R.G[g.중기]}(${담긴십성})`,
      여는글자: opener != null ? R.J[opener] : null,
      상태: opened ? '개고(開庫) — 열림' : '폐고(閉庫) — 닫힘',
      해설: opened
        ? `${R.josa(R.J[opener], '이가')} ${R.josa(R.J[j], '을를')} 충해 창고가 열렸다 — 안에 든 ${R.josa(담긴십성, '이가')} 밖으로 나와 실제로 쓰인다`
        : `${R.J[j]} 안의 ${R.josa(담긴십성, '은는')} 잠겨 있다 — ${R.J[opener]} 운이 와서 충할 때 비로소 꺼내 쓴다`,
    });
  });
  return out;
}

/* ---------- 3. 일주론 (60갑자) ----------
   60개를 일일이 적는 대신, 일간·일지의 관계에서 결정론적으로 조립한다.
   (십성 + 십이운성 + 간지 음양 + 일주 신살) */
const ILJI_TONE = {
  비견:'배우자 자리에 나와 같은 기운이 앉았다. 서로 대등하고 편하지만 살갑지는 않고, 같은 것을 두고 겨루기도 한다',
  겁재:'배우자 자리에 경쟁자가 앉았다. 배우자와 힘겨루기가 생기기 쉽고 재물이 새는 자리이기도 하다',
  식신:'배우자 자리가 온화하다. 먹고사는 복이 붙고 배우자가 나를 편하게 해준다',
  상관:'배우자 자리에 표현과 반발의 기운이 있다. 총명하지만 배우자와 말로 부딪히기 쉽다',
  정재:'배우자 자리에 정재가 앉았다. 남자에게는 가장 반듯한 배우자 자리이고, 성실하고 실속 있는 인연이다',
  편재:'배우자 자리에 편재가 앉았다. 활달한 인연이고 재물 감각이 있으나 한곳에 매이지 않으려는 기운도 함께 있다',
  정관:'배우자 자리에 정관이 앉았다. 여자에게는 가장 반듯한 배우자 자리이고, 규범과 명예를 지키는 인연이다',
  편관:'배우자 자리에 칠살이 앉았다. 강한 인연이고 자극이 크다. 잘 쓰면 추진력, 못 쓰면 압박이 된다',
  정인:'배우자 자리에 정인이 앉았다. 배우자가 어머니처럼 돌봐주지만 간섭으로 느껴질 수도 있다',
  편인:'배우자 자리에 편인이 앉았다. 독특한 인연이고 서로 생각이 깊으나 거리가 생기기 쉽다',
};
const UNSEONG_TONE = {
  장생:'뿌리가 갓 내린 자리라 순하고 사람 복이 있다', 목욕:'변화와 기복이 잦고 감정이 풍부하다',
  관대:'자신감이 앞서고 격식을 갖추려 한다', 건록:'제 힘으로 서는 자리라 자립심이 강하다',
  제왕:'가장 왕성한 자리라 주도적이고 기세가 세다', 쇠:'한풀 꺾인 자리라 노련하고 실속을 챙긴다',
  병:'남을 헤아리는 자리라 정이 많고 생각이 많다', 사:'정적인 자리라 사려 깊고 학문에 맞는다',
  묘:'갈무리하는 자리라 모으고 감추는 성향이 있다', 절:'끊어졌다 다시 잇는 자리라 순수하고 기복이 크다',
  태:'막 잉태된 자리라 조심스럽고 보호받으려 한다', 양:'길러지는 자리라 무난하고 물려받는 것이 있다',
};

function iljuron(saju, gender) {
  const d = saju.day.gan, j = saju.day.ji;
  const ss = R.sipseongOfJi(d, j);
  const us = R.sibiunseong(d, j);
  const 간지 = R.G[d] + R.J[j];
  const tags = [];
  if (R.BAEKHO.some(([g,jj]) => g===d && jj===j)) tags.push('백호');
  if (R.GWAEGANG.some(([g,jj]) => g===d && jj===j)) tags.push('괴강');
  if (R.YANGIN[d] === j) tags.push('양인');
  if ((R.CHEONEUL[d]||[]).includes(j)) tags.push('천을귀인');
  if (R.MUNCHANG[d] === j) tags.push('문창귀인');
  if (R.AMMYEONGHAP.some(([g,jj]) => g===d && jj===j)) tags.push('암명합(일지 지장간과 천간합)');
  const 배우자성 = starOf(gender, '배우자');
  const 궁성 = 배우자성.includes(ss) ? '배우자궁에 배우자성이 그대로 앉은 일주' : null;

  return {
    일주: 간지, 일간: R.G[d] + `(${R.OH[R.G_OH[d]]}·${R.G_YIN[d]===0?'양':'음'})`,
    일지십성: ss, 십이운성: us, 일주신살: tags,
    궁성: 궁성,
    해설: [ILJI_TONE[ss], UNSEONG_TONE[us] + ` (${R.josa(간지, '은는')} 일간이 일지에서 ${us})`,
           tags.length ? `일주 자체가 ${tags.join('·')}에 해당한다` : null,
           궁성].filter(Boolean),
  };
}

/* ---------- 4. 격국 고저 (그릇의 크기) ----------
   성패만으로는 "되고 안 되고"만 나온다. 얼마나 큰 그릇인지는
   상신의 힘, 용신의 통근, 청탁(淸濁), 운의 뒷받침으로 본다. */
function gyeokLevel(ctx) {
  const { 성패, strength, 통근, yongsin, relations, groupPower, 대운 } = ctx;
  const pts = [], detail = [];
  const add = (v, s) => { pts.push(v); detail.push((v>0?'+':'') + v + ' ' + s); };

  if (성패) {
    if (성패.판정 === '성격(成格)') add(2, '격이 온전히 성립(성격)');
    else if (성패.판정 === '성중유패(成中有敗)') add(0, '상신은 있으나 파격 요소가 함께 있음');
    else if (성패.판정 === '패격(敗格)') add(-2, '격이 깨짐(패격)');
    else add(-1, '격이 뚜렷하지 않음');
  }
  if (strength.level === '중화') add(1.5, '신강신약이 중화에 가까움 — 무엇이든 감당할 폭이 넓다');
  else if (['태강','태약'].includes(strength.level)) add(-1, `${strength.level} — 한쪽으로 치우쳐 쓰임이 제한된다`);

  const rv = 통근.일간.verdict;
  if (rv === '강근') add(1.5, '일간이 지지에 튼튼히 뿌리내림');
  else if (rv === '유근') add(0.5, '일간에 쓸 만한 뿌리가 있음');
  else if (rv === '무근(無根)') add(-1.5, '일간이 무근 — 자기 힘으로 버틸 바탕이 없다');

  const ug = yongsin.primary.group;
  if (ug) {
    const pct = groupPower[ug];
    if (pct >= 20) add(1.5, `용신 ${R.josa(ug, '이가')} ${pct}%로 충분히 힘이 있다`);
    else if (pct >= 10) add(0.5, `용신 ${R.josa(ug, '이가')} ${pct}% — 있으나 두텁지 않다`);
    else add(-1.5, `용신 ${R.josa(ug, '이가')} ${pct}%에 불과 — 쓸 것이 있어도 힘이 모자란다`);
  }
  const chung = (relations.충||[]).length, hyeong = (relations.형||[]).length;
  if (chung + hyeong === 0) add(1, '원국에 충·형이 없어 맑다(淸)');
  else if (chung + hyeong >= 3) add(-1.5, `충 ${chung} 형 ${hyeong} — 탁하고 흔들림이 많다(濁)`);
  else add(-0.3, `충 ${chung} 형 ${hyeong} — 약간의 탁함`);

  const good = 대운 ? 대운.filter(x => ['매우 좋음','좋음'].includes(x.종합)).length : 0;
  if (대운) {
    if (good >= 6) add(1.5, `대운 10개 중 ${good}개가 용희신 방향 — 운로가 길게 받쳐준다`);
    else if (good >= 4) add(0.5, `대운 ${good}개가 순방향`);
    else add(-1, `대운 중 순방향이 ${good}개뿐 — 운로가 받쳐주지 못한다`);
  }

  const total = pts.reduce((a,b)=>a+b,0);
  // 6000명 실측 분위(10/30/50/70/90% = -2.5 / -0.8 / 0.5 / 1.7 / 3.5)로 자른다.
  // 기존 고정 임계값(6점 이상=상격)은 분포상 도달이 거의 불가능했다.
  const band = total >= 3.5 ? '상격(上格)' : total >= 1.7 ? '중상격' : total >= -0.8 ? '중격'
             : total >= -2.5 ? '중하격' : '하격';
  return { 점수: Math.round(total*10)/10, 등급: band, 항목: detail,
    해설: '격의 고저는 길흉이 아니라 그릇의 크기다. 하격이라도 운이 받쳐주면 제 몫을 하고, ' +
          '상격이라도 운로가 어긋나면 때를 못 만난다. 적천수가 "부귀는 격국에 있으나 성패는 운로에 있다"고 한 뜻이다' };
}

module.exports = { gungseong, myogo, iljuron, gyeokLevel, locate, starOf, GUNG, GOJI };

return module.exports; })();

/* ===== saju-extra.js ===== */
__mods["saju-extra"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-extra.js — 시운 / 절기 날짜 / 격 변화 재분석 / 명궁·태원 / 자식·부모운
   ============================================================= */
const R = require('./saju-rules');
const E = require('./saju-engine');

const CHAIN = R.YONGSIN_CHAIN;   // 단일 정의는 saju-rules.js
const SCORE = { 용신운:2, 희신운:1, 한신운:0, 구신운:-1, 기신운:-2, '—':0 };
const rankFn = ug => { const c = ug ? CHAIN[ug] : null;
  return g => !c ? '—' : g === ug ? '용신운' : g === c[0] ? '희신운'
    : g === c[1] ? '기신운' : g === c[2] ? '구신운' : '한신운'; };

/* ---------- 4. 시운(時運) — 하루 12시진 ---------- */
const SIJIN = ['자(23~01)','축(01~03)','인(03~05)','묘(05~07)','진(07~09)','사(09~11)',
               '오(11~13)','미(13~15)','신(15~17)','유(17~19)','술(19~21)','해(21~23)'];
function siun(saju, dateUTCms, yongsinGroup, gongmang) {
  const d = saju.day.gan;
  const rank = rankFn(yongsinGroup);
  const dt = new Date(dateUTCms);
  const jdn = (y,m,dd) => { const a=Math.floor((14-m)/12), yy=y+4800-a, mm=m+12*a-3;
    return dd+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045; };
  const dayIdx = ((jdn(dt.getUTCFullYear(), dt.getUTCMonth()+1, dt.getUTCDate()) + 49) % 60 + 60) % 60;
  const dayGan = dayIdx % 10;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];

  const rows = [];
  for (let hj = 0; hj < 12; hj++) {
    const hg = (dayGan * 2 + hj) % 10;                   // 일간 기준 시두법
    const ganSS = R.sipseongOfGan(d, hg), jiSS = R.sipseongOfJi(d, hj);
    const ev = [];
    for (const [x,y] of R.JIJI_CHUNG)
      if ((hj===x && jis.includes(y))||(hj===y && jis.includes(x)))
        ev.push(`원국 ${R.josa(R.J[hj===x?y:x], '을를')} 충`);
    for (const [x,y] of R.YUKHAP)
      if ((hj===x && jis.includes(y))||(hj===y && jis.includes(x)))
        ev.push(`원국 ${R.josa(R.J[hj===x?y:x], '과와')} 합`);
    if (gongmang && gongmang.includes(R.J[hj])) ev.push('공망 시간');
    const base = (SCORE[rank(R.SIPSEONG_GROUP[ganSS])]||0)*0.4
               + (SCORE[rank(R.SIPSEONG_GROUP[jiSS])]||0)*0.6;
    const v = Math.max(-2, Math.min(2, (base - ev.filter(e=>e.includes('충')).length*0.4) * 0.45));
    rows.push({ 시진: SIJIN[hj], 간지: R.G[hg]+R.J[hj], 천간십성: ganSS, 지지십성: jiSS,
      작용: ev, 점수: Math.round(v*100)/100,
      평가: v >= 0.55 ? '좋음' : v > -0.25 ? '보통' : '주의' });
  }
  const best = rows.slice().sort((a,b)=>b.점수-a.점수).slice(0,2);
  const worst = rows.slice().sort((a,b)=>a.점수-b.점수)[0];
  return { 날짜: dt.toISOString().slice(0,10), 일진: R.G[dayGan]+R.J[dayIdx%12], 시진별: rows,
    좋은시간: best.map(x=>x.시진).join(', '), 조심할시간: worst.시진,
    안내: '시운은 하루 안의 결이라 흔들림이 가장 작다. 중요한 일의 시각을 고를 때 참고하는 정도로 쓴다' };
}

/* ---------- 5. 월운에 실제 절기 날짜 ---------- */
const JEOL_IDX = [2,4,6,8,10,12,14,16,18,20,22,0];   // 입춘~소한 (節)
function wolunDates(year) {
  const out = [];
  for (let k = 0; k < 12; k++) {
    const ti = JEOL_IDX[k];
    const y = ti === 0 ? year + 1 : year;               // 소한은 이듬해 1월
    const utc = E.termUTC(y, ti);
    const kst = new Date(utc + 9*3600000);
    const nextTi = JEOL_IDX[(k+1) % 12];
    const ny = (k === 11) ? year + 1 : (nextTi === 0 ? year + 1 : year);
    const nUtc = E.termUTC(ny, nextTi);
    const nKst = new Date(nUtc + 9*3600000 - 60000);
    out.push({ 월차: k+1, 절기: E.TERM_NAMES[ti],
      시작: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth()+1).padStart(2,'0')}-${String(kst.getUTCDate()).padStart(2,'0')} ${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}`,
      끝: `${nKst.getUTCFullYear()}-${String(nKst.getUTCMonth()+1).padStart(2,'0')}-${String(nKst.getUTCDate()).padStart(2,'0')}` });
  }
  return out;
}

/* ---------- 6. 대운에서 격이 바뀌면 그 구간을 다시 본다 ---------- */
function gyeokShiftAnalysis(saju, daeunList, groupPower, strength, gyeokSuccessFn) {
  const d = saju.day.gan;
  const monthHidden = R.JIJANGGAN_WOLRYUL[saju.month.ji].map(x => x[0]);
  const out = [];
  daeunList.forEach(du => {
    if (!monthHidden.includes(du.gan)) return;
    const newSS = R.sipseongOfGan(d, du.gan);
    const newGyeok = newSS + '격';
    const 재판정 = gyeokSuccessFn ? gyeokSuccessFn(saju, newGyeok, groupPower, strength) : null;
    out.push({
      구간: `${du.start}~${Math.round((du.start+10)*10)/10}세`, 대운: du.han,
      투출글자: R.G[du.gan], 바뀐격: newGyeok,
      성패: 재판정 ? 재판정.판정 : null,
      상신: 재판정 ? 재판정.확보한상신 : null,
      해설: `대운 천간 ${R.josa(R.G[du.gan], '이가')} 월지 ${R.J[saju.month.ji]}의 지장간을 끌어올려, ` +
            `이 10년만큼은 ${newGyeok}으로 읽는 것이 실제에 가깝다. ` +
            (재판정 ? `그 격은 ${재판정.판정}이며 ${재판정.근거}` : ''),
    });
  });
  return out;
}

/* ---------- 7. 명궁(命宮)·태원(胎元) ----------
   명궁: 월지(寅=1)와 시지(子=1)의 합을 14 또는 26에서 뺀 자리.
         타고난 자리·평생의 거처로 본다.
   태원: 월주 천간 +1, 지지 +3. 잉태된 달의 간지.                    */
function myeonggung(saju) {
  if (!saju.hour) return { 가능: false, 사유: '시주가 없어 명궁을 세울 수 없습니다' };
  const mOrder = ((saju.month.ji - 2) % 12 + 12) % 12 + 1;   // 寅=1
  const hOrder = saju.hour.ji + 1;                            // 子=1
  const sum = mOrder + hOrder;
  const n = sum <= 14 ? 14 - sum : 26 - sum;                  // 1~12
  const ji = (n - 1 + 12) % 12;                               // 子=0 인덱스
  // 명궁 천간: 연간 기준 오호둔(월간 구하는 법과 동일)
  const order = ((ji - 2) % 12 + 12) % 12;
  const gan = (saju.year.gan * 2 + 2 + order) % 10;
  const d = saju.day.gan;
  return { 가능: true, 간지: R.G[gan] + R.J[ji],
    십성: R.sipseongOfJi(d, ji), 십이운성: R.sibiunseong(d, ji),
    해설: `명궁은 타고난 자리이자 평생 머무는 거처로 본다. ${R.J[ji]}에 서며 ` +
          `일간 기준 ${R.sipseongOfJi(d, ji)}에 해당한다. 원국에 없는 오행이 명궁에 들면 ` +
          `그 기운을 빌려 쓴다고 보는 관법이 있다`,
    보충오행: R.OH[R.J_OH[ji]] };
}
function taewon(saju) {
  const g = (saju.month.gan + 1) % 10, j = (saju.month.ji + 3) % 12;
  const d = saju.day.gan;
  return { 간지: R.G[g] + R.J[j], 십성: R.sipseongOfGan(d, g),
    해설: `태원은 잉태된 때의 간지로, 월주 ${R.G[saju.month.gan]}${R.J[saju.month.ji]}에서 ` +
          `천간 하나 지지 셋을 나아가 세운다. 타고나기 이전의 바탕을 보는 자리다` };
}

/* ---------- 8. 자식운·부모운 상세 ---------- */
function childParent(saju, gender, groupPower, sinsalList) {
  const d = saju.day.gan;
  const P = ['년','월','일','시'];
  const pil = [saju.year, saju.month, saju.day, saju.hour].filter(Boolean);
  const starOf = k => ({
    자식: gender === 'M' ? ['정관','편관'] : ['식신','상관'],
    부친: ['편재'], 모친: ['정인','편인'], 형제: ['비견','겁재'],
  })[k];
  const find = names => {
    const hits = [];
    pil.forEach((p, i) => {
      if (names.includes(R.sipseongOfGan(d, p.gan))) hits.push(`${P[i]}간 ${R.G[p.gan]}`);
      if (names.includes(R.sipseongOfJi(d, p.ji)))   hits.push(`${P[i]}지 ${R.J[p.ji]}`);
      const parts = R.JIJANGGAN_WOLRYUL[p.ji];
      parts.forEach(([hg], k) => { if (k < parts.length-1 && names.includes(R.sipseongOfGan(d, hg)))
        hits.push(`${P[i]}지장간 ${R.G[hg]}(암장)`); });
    });
    return hits;
  };

  // 자식
  const cs = starOf('자식'), cLoc = find(cs);
  const cGung = saju.hour ? R.sipseongOfJi(d, saju.hour.ji) : null;
  const cGungHas = saju.hour && cs.includes(cGung);
  const cChung = saju.hour ? [saju.year.ji, saju.month.ji, saju.day.ji]
    .some(j => R.JIJI_CHUNG.some(([x,y]) => (x===saju.hour.ji&&y===j)||(y===saju.hour.ji&&x===j))) : false;
  const 자식 = {
    자식성: cs.join('/'), 위치: cLoc.length ? cLoc : ['원국에 드러나지 않음'],
    자식궁: saju.hour ? `시주 ${R.G[saju.hour.gan]}${R.J[saju.hour.ji]} (${cGung})` : '시주 없음',
    궁성일치: cGungHas,
    해설: !saju.hour ? '출생 시간을 모르면 자식궁을 볼 수 없습니다'
      : cGungHas ? '자식궁에 자식성이 그대로 앉았다 — 자식과의 인연이 뚜렷하고 관계의 무게가 크다'
      : !cLoc.length ? '자식성이 원국에 드러나지 않는다 — 인연이 늦거나 운에서 만들어지는 편이다'
      : `자식성은 ${cLoc.join('·')}에 있으나 자식궁에는 없다 — 자식이 있어도 곁에 두는 형태와는 다를 수 있다`,
    주의: cChung ? '시지가 원국의 다른 지지와 충한다 — 자식 문제에 변동이 잦은 구조다' : null,
  };

  // 부모
  const fLoc = find(starOf('부친')), mLoc = find(starOf('모친'));
  const pGungGan = R.sipseongOfGan(d, saju.month.gan), pGungJi = R.sipseongOfJi(d, saju.month.ji);
  const 부모 = {
    부친성: '편재', 부친위치: fLoc.length ? fLoc : ['원국에 드러나지 않음'],
    모친성: '정인/편인', 모친위치: mLoc.length ? mLoc : ['원국에 드러나지 않음'],
    부모궁: `월주 ${R.G[saju.month.gan]}${R.J[saju.month.ji]} (${pGungGan}/${pGungJi})`,
    해설: `부모궁은 월주다. 여기에 ${R.josa(pGungGan, '과와')} ${R.josa(pGungJi, '이가')} 앉아 있어 ` +
          `성장기의 환경과 부모와의 관계가 그 십성의 결을 띤다. ` +
          (groupPower.인성 >= 40 ? '인성이 40%를 넘어 부모의 관여가 큰 구조다. 자립이 늦어지기 쉽다'
           : groupPower.인성 <= 10 ? '인성이 10% 이하로 얇아, 기대기보다 일찍 스스로 서는 편이다' : ''),
    형제: { 성: '비견/겁재', 세력: groupPower.비겁 + '%',
      해설: groupPower.비겁 >= 40 ? '비겁이 강해 형제·동료의 존재감이 크다. 다만 나눠 갖는 일도 많다'
           : groupPower.비겁 <= 10 ? '비겁이 얇아 형제·동료의 도움보다 혼자 감당하는 쪽이다' : '' },
  };
  return { 자식, 부모 };
}

module.exports = { siun, wolunDates, gyeokShiftAnalysis, myeonggung, taewon, childParent, SIJIN };

return module.exports; })();

/* ===== saju-domain.js ===== */
__mods["saju-domain"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-domain.js — 영역별 운 (재물 / 직업·명예 / 건강 / 애정·결혼 / 학업·문서)
   "이 운이 좋다"가 아니라 "무엇이 좋은가"를 말하기 위한 레이어.
   각 영역은 담당 십성 + 그 십성을 돕거나 깨는 십성의 균형으로 본다.
   ============================================================= */
const R = require('./saju-rules');

/* 영역별 담당 십성: 주(主)=그 영역 자체, 생(生)=키워주는 것, 파(破)=깨는 것 */
const DOMAIN = {
  재물:      { 주:'재성', 생:'식상', 파:'비겁',
    설명:'재성이 재물 자체, 식상이 그것을 만들어내는 힘, 비겁이 나눠 가는 힘이다' },
  '직업·명예': { 주:'관성', 생:'재성', 파:'식상',
    설명:'관성이 자리와 명예, 재성이 그 자리를 받치는 힘, 식상이 규범과 부딪히는 힘이다' },
  '애정·결혼': { 주:null,   생:null,  파:'비겁',
    설명:'남자는 재성, 여자는 관성이 배우자성이다. 비겁이 많으면 경쟁이 붙는다' },
  '학업·문서': { 주:'인성', 생:'관성', 파:'재성',
    설명:'인성이 공부와 문서, 관성이 인성을 생하고, 재성이 인성을 깨뜨린다(탐재괴인)' },
};

// 영역마다 점수가 나오는 범위가 다르다(건강은 감점 요소가 많아 전체가 음수로 치우친다).
// 고정 임계값을 공유하면 전부 '보통'으로 뭉개지므로, 6000명 실측 분위로 영역별 컷을 쓴다.
// 각 배열 = [10%, 30%, 70%, 90%] 지점
const CUT = {
  재물:        [-0.96, -0.48, 0.14, 0.46],
  '직업·명예': [-0.69, -0.30, 0.31, 0.64],
  '애정·결혼': [-0.84, -0.39, 0.25, 0.66],
  '학업·문서': [-0.72, -0.25, 0.48, 0.95],
  건강:        [-1.50, -1.00, -0.30, 0.40],
};
const bandBy = (s, key) => {
  const c = CUT[key] || [-1.0, -0.4, 0.4, 1.0];
  return s >= c[3] ? '매우 좋음' : s >= c[2] ? '좋음' : s >= c[1] ? '보통'
       : s >= c[0] ? '약함' : '매우 약함';
};
const band = s => s >= 1.2 ? '매우 좋음' : s >= 0.4 ? '좋음' : s > -0.4 ? '보통'
               : s > -1.2 ? '약함' : '매우 약함';

/** 원국 기준 영역 강도 */
function natal(ctx) {
  const { saju, groupPower: gp, strength, yongsin, sinsal, gender } = ctx;
  const d = saju.day.gan;
  const out = {};

  for (const [name, def] of Object.entries(DOMAIN)) {
    let 주grp = def.주;
    if (name === '애정·결혼') 주grp = gender === 'M' ? '재성' : '관성';
    const 생grp = name === '애정·결혼' ? (gender === 'M' ? '식상' : '재성') : def.생;
    const main = gp[주grp], sup = gp[생grp], brk = gp[def.파];

    // 신강해야 주성을 감당한다. 신약하면 많아도 못 쓴다.
    const 감당 = strength.verdict === '신강' ? 1 : main >= 35 ? 0.45 : 0.75;
    let v = ((main - 20) / 20) * 0.8 * 감당 + ((sup - 20) / 25) * 0.35 - ((brk - 20) / 25) * 0.3;

    const notes = [];
    if (main < 8) notes.push(`${R.josa(주grp, '이가')} ${main}%로 거의 없다 — 이 영역은 원국이 아니라 운에서 만들어야 한다`);
    if (main >= 35 && strength.verdict === '신약')
      notes.push(`${R.josa(주grp, '이가')} ${main}%로 많은데 신약하다 — 눈앞에 있어도 내 것으로 만들기 어렵다`);
    if (brk >= 38) notes.push(`${R.josa(def.파, '이가')} ${brk}%로 강해 이 영역을 지속적으로 갉는다`);
    if (yongsin.primary.group === 주grp) { v += 0.5; notes.push(`${R.josa(주grp, '이가')} 곧 용신이다 — 이 영역이 인생의 중심축이 된다`); }

    out[name] = { 주성: 주grp, 주성세력: main, 생조: 생grp + ' ' + sup + '%', 방해: def.파 + ' ' + brk + '%',
      점수: Math.round(v*100)/100, 등급: bandBy(v, name), 원리: def.설명, 메모: notes };
  }

  // 애정·결혼은 궁성과 도화/홍염을 추가로 본다
  const 배우자성 = gender === 'M' ? ['정재','편재'] : ['정관','편관'];
  const 일지십성 = R.sipseongOfJi(d, saju.day.ji);
  const 궁성일치 = 배우자성.includes(일지십성);
  const dohwa = (sinsal.list || []).filter(x => ['연살','도화'].includes(x.name)).length;
  const a = out['애정·결혼'];
  if (궁성일치) { a.점수 = Math.round((a.점수 + 0.4) * 100) / 100;
    a.메모.push('배우자궁에 배우자성이 앉았다 — 인연의 대상이 뚜렷하다'); }
  if (dohwa) a.메모.push(`도화(연살) ${dohwa}개 — 사람을 끄는 힘이 있고 이성 인연이 잦다`);
  a.등급 = bandBy(a.점수, '애정·결혼');

  // 건강은 십성이 아니라 균형·충형으로 본다
  const chung = (ctx.relations.충||[]).length, hyeong = (ctx.relations.형||[]).length;
  let hv = 0; const hn = [];
  if (strength.level === '중화') { hv += 0.8; hn.push('강약이 중화에 가까워 기본 체력의 균형이 좋다'); }
  if (strength.level === '태약') { hv -= 0.9; hn.push('태약 — 무리하면 회복이 더디다'); }
  if (strength.level === '태강') { hv -= 0.4; hn.push('태강 — 기운이 뭉쳐 한 번에 터지는 쪽을 조심한다'); }
  if (chung >= 2) { hv -= 0.6; hn.push(`지지 충 ${chung}개 — 충이 걸린 자리의 장기를 주의한다`); }
  if (hyeong >= 1) { hv -= 0.4; hn.push(`형 ${hyeong}개 — 수술·시술과 인연이 생기기 쉽다`); }
  const 결핍 = R.OH.map((o,i)=>[o, ctx.deep.final[i]]).filter(([,p])=>p < 6);
  if (결핍.length) { hv -= 0.3 * 결핍.length;
    hn.push(`${결핍.map(([o,p])=>`${o} ${p}%`).join(', ')} — 오행이 비어 그 계통이 약점이 되기 쉽다`); }
  const ORGAN = { 목:'간·담·근육·눈', 화:'심장·소장·혈압', 토:'비위·소화기', 금:'폐·대장·피부', 수:'신장·방광·생식' };
  out['건강'] = { 점수: Math.round(hv*100)/100, 등급: bandBy(hv, '건강'),
    약한오행: 결핍.map(([o,p]) => ({ 오행:o, 비율:p+'%', 계통:ORGAN[o] })),
    메모: hn, 원리: '건강은 특정 십성이 아니라 오행의 균형, 그리고 충·형이 걸린 자리로 본다',
    주의: '이것은 명리 해석일 뿐 의학적 진단이 아니다. 증상이 있으면 병원에서 확인해야 한다' };

  return out;
}

/** 운(대운·세운)이 각 영역에 주는 영향 */
function byUn(ctx, unPillar, label) {
  const d = ctx.saju.day.gan, gender = ctx.gender;
  const ganSS = R.sipseongOfGan(d, unPillar.gan), jiSS = R.sipseongOfJi(d, unPillar.ji);
  const ganG = R.SIPSEONG_GROUP[ganSS], jiG = R.SIPSEONG_GROUP[jiSS];
  const strong = ctx.strength.verdict === '신강';
  const res = {};
  for (const [name, def] of Object.entries(DOMAIN)) {
    let 주grp = name === '애정·결혼' ? (gender === 'M' ? '재성' : '관성') : def.주;
    const 생grp = name === '애정·결혼' ? (gender === 'M' ? '식상' : '재성') : def.생;
    let v = 0; const why = [];
    for (const [g, w, lb] of [[ganG, 0.4, '천간'], [jiG, 0.6, '지지']]) {
      if (g === 주grp) { const s = strong ? 1.2 : 0.4; v += s*w;
        why.push(`${lb}에 ${R.josa(주grp, '이가')} 들어온다${strong?'':' (신약해 감당이 버겁다)'}`); }
      else if (g === 생grp) { v += 0.7*w; why.push(`${lb}에 ${R.josa(생grp, '이가')} 들어와 ${R.josa(주grp, '을를')} 생한다`); }
      else if (g === def.파) { v -= 0.8*w; why.push(`${lb}에 ${R.josa(def.파, '이가')} 들어와 이 영역을 깎는다`); }
    }
    res[name] = { 점수: Math.round(v*100)/100, 등급: band(v), 사유: why };
  }
  return { 운: label, 간지: R.G[unPillar.gan] + R.J[unPillar.ji], 영역: res };
}

/* ---------- 용신 피상 / 기신 합거 ----------
   운의 좋고 나쁨은 십성만으로 안 끝난다. 용신 자체가 운에서 충극당하면(피상)
   좋은 십성이 와도 못 쓰고, 기신이 합으로 묶이면(합거) 나쁜 것이 잠시 멈춘다. */
function yongsinSafety(ctx, unPillar) {
  const d = ctx.saju.day.gan;
  const ug = ctx.yongsin.primary.group;
  if (!ug) return null;
  const yoOh = R.groupOh(d, ug);
  const events = [];
  const unGanOh = R.G_OH[unPillar.gan], unJiOh = R.J_OH[unPillar.ji];

  if (R.GEUK(unGanOh) === yoOh) events.push({ t:'용신 피상', w:-0.8,
    s:`운의 천간 ${R.G[unPillar.gan]}(${R.OH[unGanOh]})이 용신 ${R.josa(R.OH[yoOh], '을를')} 극한다 — 쓸 것이 상한다` });
  if (R.GEUK(unJiOh) === yoOh) events.push({ t:'용신 피상', w:-1.0,
    s:`운의 지지 ${R.J[unPillar.ji]}(${R.OH[unJiOh]})이 용신 ${R.josa(R.OH[yoOh], '을를')} 극한다 — 뿌리째 흔들린다` });
  if (unGanOh === yoOh || unJiOh === yoOh) events.push({ t:'용신 득세', w:0.6,
    s:`운에서 용신 ${R.josa(R.OH[yoOh], '이가')} 들어와 힘을 얻는다` });

  // 기신이 합으로 묶이는가
  const giOh = R.groupOh(d, R.기신(ug));   // 기신 정의는 saju-rules.js
  const gans = [ctx.saju.year.gan, ctx.saju.month.gan, ctx.saju.hour ? ctx.saju.hour.gan : null].filter(x=>x!=null);
  for (const [x,y,oh] of R.CHEONGAN_HAP) {
    const pair = (unPillar.gan===x && gans.includes(y)) ? y : (unPillar.gan===y && gans.includes(x)) ? x : null;
    if (pair != null && R.G_OH[pair] === giOh)
      events.push({ t:'기신 합거', w:0.7,
        s:`기신 ${R.josa(R.G[pair], '이가')} 운의 ${R.josa(R.G[unPillar.gan], '과와')} 합으로 묶인다 — 그 해악이 잠시 멈춘다` });
  }
  // 천간은 용신인데 지지가 그 용신을 극하는 식으로 상반된 작용이 겹칠 수 있다.
  // 따로 나열하면 모순처럼 읽히므로 묶어서 설명한다.
  const 득세 = events.some(e => e.t === '용신 득세');
  const 피상 = events.some(e => e.t === '용신 피상');
  let 종합 = null;
  if (득세 && 피상) 종합 = `용신 ${R.josa(R.OH[yoOh], '이가')} 한쪽에서는 들어오고 다른 쪽에서는 극을 받는다 — ` +
    '위아래가 엇갈리는 구조라(개두·절각과 같은 형태) 기회는 오지만 온전히 쥐기 어렵다';
  else if (피상) 종합 = `용신 ${R.josa(R.OH[yoOh], '이가')} 상한다 — 좋은 십성이 들어와도 받아 쓸 그릇이 흔들린다`;
  else if (득세) 종합 = `용신 ${R.josa(R.OH[yoOh], '이가')} 힘을 얻는다 — 이 구간에 쓸 것이 제대로 선다`;
  return { 용신오행: R.OH[yoOh], 작용: events, 종합,
           보정: Math.round(events.reduce((a,b)=>a+b.w,0)*100)/100 };
}

/* ---------- 교운기(交運期) ----------
   대운이 바뀌는 전후는 판이 갈리는 구간이라 흔들린다. */
function gyoun(daeunList, age) {
  for (const du of daeunList) {
    const diff = age - du.start;
    if (Math.abs(diff) <= 1)
      return { 해당: true, 대운: du.han, 시점: `${du.start}세`,
        상태: diff < 0 ? '교운 직전' : diff > 0 ? '교운 직후' : '교운 당해',
        해설: '대운이 바뀌는 전후 1년은 앞 운과 뒷 운이 겹쳐 어수선하다. ' +
              '이 구간에는 큰 결정을 몰아서 하지 않는 편이 낫다는 것이 통설이다' };
  }
  return { 해당: false };
}

module.exports = { natal, byUn, yongsinSafety, gyoun, DOMAIN };

return module.exports; })();

/* ===== saju-fortune.js ===== */
__mods["saju-fortune"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-fortune.js — 운세 심화
   근거: 적천수천미(임철초) 개두·절각, 삼명통회 대운 적용,
         정해 만세력 13·14·19·20강, 삼재 통설
   ============================================================= */
const R = require('./saju-rules');

const CHAIN = R.YONGSIN_CHAIN;   // 단일 정의는 saju-rules.js
const SCORE = { 용신운:2, 희신운:1, 한신운:0, 구신운:-1, 기신운:-2, '—':0 };

function rankFn(yongsinGroup) {
  const chain = yongsinGroup ? CHAIN[yongsinGroup] : null;
  return g => !chain ? '—' : g === yongsinGroup ? '용신운'
    : g === chain[0] ? '희신운' : g === chain[1] ? '기신운'
    : g === chain[2] ? '구신운' : '한신운';
}
const clamp = (v, lo=-2, hi=2) => Math.max(lo, Math.min(hi, v));
// 등급 임계값도 진폭에 비례시킨다. 고정 임계값을 쓰면 진폭을 줄인 일운에서
// 최고 등급이 수학적으로 도달 불가능해진다(실측 0.0%).
const gradeAmp = (t, amp = 1) => t >= 1.4*amp ? '매우 좋음' : t >= 0.5*amp ? '좋음'
                 : t > -0.5*amp ? '보통' : t > -1.4*amp ? '주의' : '매우 주의';
const grade = t => gradeAmp(t, 1);
// 기간이 짧을수록 한 칸의 무게가 가볍다. 하루짜리 일진을 10년 대운과 같은 진폭으로
// 매기면 "매우 주의"가 남발된다.
const AMP = { 대운:1.0, 세운:0.85, 월운:0.7, 일운:0.55 };

/* ---------- 개두(蓋頭) · 절각(截脚) ----------
   개두: 운의 천간이 그 지지를 극한다 — 머리가 덮여 지지의 힘이 못 올라온다
   절각: 운의 지지가 그 천간을 극한다 — 다리가 잘려 천간이 뿌리를 못 내린다
   임철초는 용신운이라도 개두·절각이면 발복이 반감된다고 본다. */
function ganjiHarmony(gan, ji) {
  const go = R.G_OH[gan], jo = R.J_OH[ji];
  if (go === jo) return { type:'간지동기(干支同氣)', coef:1.25,
    note:'천간과 지지가 같은 오행 — 10년 내내 한 방향으로 힘이 실린다(甲寅·乙卯 류)' };
  if (R.SAENG(jo) === go) return { type:'지생천(地生天)', coef:1.15,
    note:'지지가 천간을 생한다 — 뿌리가 받쳐주어 천간운이 지지 구간까지 이어진다' };
  if (R.SAENG(go) === jo) return { type:'천생지(天生地)', coef:1.05,
    note:'천간이 지지를 생한다 — 힘이 아래로 흘러 후반이 두터워진다' };
  if (R.GEUK(go) === jo) return { type:'개두(蓋頭)', coef:0.75,
    note:'운의 천간이 제 지지를 극한다 — 좋은 운이어도 절반만 받고, 나쁜 운이면 앞이 더 시끄럽다' };
  if (R.GEUK(jo) === go) return { type:'절각(截脚)', coef:0.75,
    note:'운의 지지가 제 천간을 극한다 — 시작은 그럴듯하나 뒤가 받쳐주지 않는다' };
  return { type:'무관', coef:1.0, note:null };
}

/* ---------- 대운 심화 ---------- */
function daeunDeep(saju, daeunList, yongsinGroup, opts = {}) {
  const d = saju.day.gan;
  const rank = rankFn(yongsinGroup);
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const gans = [saju.year.gan, saju.month.gan, ...(saju.hour?[saju.hour.gan]:[])];
  const monthHidden = R.JIJANGGAN_WOLRYUL[saju.month.ji].map(x => x[0]);

  return daeunList.map(du => {
    const ganSS = R.sipseongOfGan(d, du.gan), jiSS = R.sipseongOfJi(d, du.ji);
    const ganG = R.SIPSEONG_GROUP[ganSS], jiG = R.SIPSEONG_GROUP[jiSS];
    const har = ganjiHarmony(du.gan, du.ji);

    // 천간 10년 주관 예외 (삼명통회)
    const ganRules = [];
    if (gans.includes(du.gan) || saju.day.gan === du.gan) ganRules.push('대운 천간이 원국 천간에 이미 있음');
    if (R.JIJANGGAN_WOLRYUL[du.ji].some(([g]) => g === du.gan)) ganRules.push('대운 천간이 대운 지지에서 투간');
    if (R.G_OH[du.gan] === R.J_OH[du.ji]) ganRules.push('간지가 같은 오행');
    const ganAllTen = ganRules.length > 0;

    // 원국 작용
    const ev = [];
    for (const [x,y] of R.JIJI_CHUNG) {
      if (du.ji===x && jis.includes(y)) ev.push({ t:'충', s:`${R.J[x]}${R.J[y]}충`, w:-1 });
      if (du.ji===y && jis.includes(x)) ev.push({ t:'충', s:`${R.J[y]}${R.J[x]}충`, w:-1 });
    }
    const wolChung = R.JIJI_CHUNG.find(p => p.includes(saju.month.ji) && p.includes(du.ji));
    if (wolChung) ev.push({ t:'제강충', s:'월지를 충한다 — 격의 판 자체가 흔들리는 시기', w:-1.2 });
    for (const [x,y,oh] of R.YUKHAP) {
      if (du.ji===x && jis.includes(y)) ev.push({ t:'합', s:`${R.J[x]}${R.J[y]}합→${R.OH[oh]}`, w:0.5 });
      if (du.ji===y && jis.includes(x)) ev.push({ t:'합', s:`${R.J[y]}${R.J[x]}합→${R.OH[oh]}`, w:0.5 });
    }
    for (const [s,w,g,oh] of R.SAMHAP) {
      const set = [s,w,g];
      if (!set.includes(du.ji)) continue;
      const have = set.filter(x => x !== du.ji && jis.includes(x));
      if (have.length === 2) ev.push({ t:'삼합완성', s:`${set.map(x=>R.J[x]).join('')} 삼합 완성→${R.OH[oh]}`, w:1.0 });
      else if (have.length === 1 && set[1] === (du.ji === w ? du.ji : have[0]))
        ev.push({ t:'반합', s:`${R.J[du.ji]}${R.J[have[0]]} 반합→${R.OH[oh]}`, w:0.4 });
    }
    for (const [x,y,oh] of R.CHEONGAN_HAP) {
      if ((du.gan===x && d===y)||(du.gan===y && d===x))
        ev.push({ t:'일간합', s:`일간과 ${R.G[x]}${R.G[y]}합 — 마음이 묶이거나 묶어두는 10년`, w:0.2 });
      if (du.gan===x && gans.includes(y)) ev.push({ t:'천간합', s:`${R.G[x]}${R.G[y]}합→${R.OH[oh]}`, w:0.3 });
      if (du.gan===y && gans.includes(x)) ev.push({ t:'천간합', s:`${R.G[y]}${R.G[x]}합→${R.OH[oh]}`, w:0.3 });
    }
    for (const [x,y] of R.CHEONGAN_CHUNG) {
      if ((du.gan===x && d===y)||(du.gan===y && d===x))
        ev.push({ t:'일간충', s:'일간을 천간충 — 결정과 건강에 부담이 걸린다', w:-0.8 });
    }
    if (R.WONJIN[du.ji] != null && jis.includes(R.WONJIN[du.ji]))
      ev.push({ t:'원진', s:`${R.J[du.ji]}${R.J[R.WONJIN[du.ji]]} 원진${R.GWIMUN[du.ji]===R.WONJIN[du.ji]?'·귀문':''} 발동`, w:-0.5 });
    const 삼형 = Object.values(R.SAMHYEONG).find(h => h.ji.includes(du.ji) &&
      h.ji.filter(x => x !== du.ji && jis.includes(x)).length >= 2);
    if (삼형) ev.push({ t:'삼형', s:`${삼형.name} 완성`, w:-1.0 });

    // 격국 변화 — 대운 천간이 월지 지장간을 투출시키면 격이 바뀐다
    const gyeokShift = monthHidden.includes(du.gan)
      ? `대운 천간 ${R.josa(R.G[du.gan], '이가')} 월지 지장간을 투출 — 이 10년은 ${R.sipseongOfGan(d, du.gan)}격으로 읽어야 한다`
      : null;

    // 용신 오행이 이 대운에서 뿌리를 얻는가
    const yoOh = yongsinGroup ? R.groupOh(d, yongsinGroup) : null;
    const yongRoot = yoOh != null &&
      R.JIJANGGAN_WOLRYUL[du.ji].some(([g]) => R.G_OH[g] === yoOh)
      ? `용신 ${R.josa(R.OH[yoOh], '이가')} 대운 지지 ${R.J[du.ji]}에 뿌리를 얻는다 — 쓸 힘이 실린다` : null;

    const base = (SCORE[rank(ganG)]||0)*0.4 + (SCORE[rank(jiG)]||0)*0.6;
    const evW = clamp(ev.reduce((a,b) => a + b.w, 0), -2.5, 2.5);
    const total = clamp((base * har.coef + evW * 0.35) * AMP.대운);

    return {
      시작나이: du.start, 끝나이: Math.round((du.start + 10)*10)/10, 간지: du.han,
      전반5년: { 구간:`${du.start}~${Math.round((du.start+5)*10)/10}세`, 주도:R.G[du.gan],
                십성:ganSS, 평가:rank(ganG) },
      후반5년: { 구간:`${Math.round((du.start+5)*10)/10}~${Math.round((du.start+10)*10)/10}세`,
                주도:R.J[du.ji], 십성:jiSS, 평가:rank(jiG), 십이운성:R.sibiunseong(d, du.ji) },
      간지관계: har,
      천간10년주관: ganAllTen ? ganRules.join(' / ') : null,
      원국작용: ev.map(e => e.s),
      격국변화: gyeokShift,
      용신통근: yongRoot,
      종합: gradeAmp(total, AMP.대운), 점수: Math.round(total*100)/100,
    };
  });
}

/* ---------- 삼재 (三災) ----------
   신자진생→인묘진년, 사유축생→해자축년, 인오술생→신유술년, 해묘미생→사오미년
   입춘 기준으로 해가 바뀐다. */
const SAMJAE = { 3:[2,3,4], 2:[11,0,1], 1:[8,9,10], 0:[5,6,7] };  // SAMHAP 그룹 index → 삼재 3년
function samjae(birthYearJi, targetYearJi) {
  const g = R.SAMHAP_GROUP(birthYearJi);
  const set = SAMJAE[g];
  const idx = set.indexOf(targetYearJi);
  if (idx < 0) return null;
  return { 단계: ['들삼재','눌삼재','날삼재'][idx], 해당년지: R.J[targetYearJi],
    설명: ['들어오는 해 — 새 일을 벌이거나 크게 움직이는 것을 삼간다',
           '머무는 해 — 기복이 가장 크게 느껴지는 구간',
           '나가는 해 — 마무리와 정리에 맞고, 끝에 매듭을 짓는다'][idx],
    주의: '삼재는 띠 한 글자로 보는 통속 관법이라, 원국 용신·대운과 어긋나면 그쪽을 우선한다' };
}

/* ---------- 세운(歲運) 정밀 ---------- */
function saeunDeep(saju, year, yongsinGroup, daeunPillar, gongmang) {
  const d = saju.day.gan;
  const rank = rankFn(yongsinGroup);
  const idx = ((year - 4) % 60 + 60) % 60;
  const gan = idx % 10, ji = idx % 12;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const posN = ['년','월','일','시'];
  const ganSS = R.sipseongOfGan(d, gan), jiSS = R.sipseongOfJi(d, ji);
  const har = ganjiHarmony(gan, ji);
  const ev = [];

  jis.forEach((j, i) => {
    for (const [x,y] of R.JIJI_CHUNG)
      if ((ji===x&&j===y)||(ji===y&&j===x)) ev.push({ s:`${posN[i]}지 ${R.josa(R.J[j], '을를')} 충`, w:-1 });
    for (const [x,y,oh] of R.YUKHAP)
      if ((ji===x&&j===y)||(ji===y&&j===x)) ev.push({ s:`${posN[i]}지 ${R.josa(R.J[j], '과와')} 합→${R.OH[oh]}`, w:0.5 });
    // 축오·묘신·진해·사술은 원진이면서 귀문이다. 둘 다 세면 같은 작용을 두 번 깎는다.
    if (R.WONJIN[ji] === j) ev.push({ s:`${posN[i]}지 ${R.josa(R.J[j], '과와')} 원진${R.GWIMUN[ji]===j?'·귀문':''}`, w:-0.5 });
    else if (R.GWIMUN[ji] === j) ev.push({ s:`${posN[i]}지 ${R.josa(R.J[j], '과와')} 귀문`, w:-0.4 });
  });
  for (const [x,y] of R.CHEONGAN_CHUNG)
    if ((gan===x&&d===y)||(gan===y&&d===x)) ev.push({ s:'일간을 천간충(태세를 범함)', w:-1.0 });
  for (const [x,y] of R.CHEONGAN_HAP)
    if ((gan===x&&d===y)||(gan===y&&d===x)) ev.push({ s:'일간과 천간합 — 한 해 마음이 한쪽으로 쏠린다', w:0.2 });
  if (gongmang && gongmang.includes(R.J[ji])) ev.push({ s:'세운 지지가 공망 — 결과가 손에 잘 안 잡히는 해', w:-0.3 });

  let 대세운 = null;
  if (daeunPillar) {
    const dj = daeunPillar.ji, dg = daeunPillar.gan;
    const jiChung = R.JIJI_CHUNG.some(([x,y]) => (x===dj&&y===ji)||(y===dj&&x===ji));
    const ganChung = R.CHEONGAN_CHUNG.some(([x,y]) => (x===dg&&y===gan)||(y===dg&&x===gan));
    if (jiChung && ganChung) 대세운 = { s:'대운을 천충지충(天沖地沖) — 판이 뒤집히는 해', w:-1.2 };
    else if (jiChung) 대세운 = { s:'세운이 대운 지지를 충 — 큰 흐름과 그 해가 어긋난다', w:-0.8 };
    else if (dj === ji && dg === gan) 대세운 = { s:'대운과 세운이 같은 간지(복음伏吟) — 같은 국면이 짙게 반복', w:-0.4 };
    else if (dj === ji) 대세운 = { s:'대운·세운 지지 중복 — 그 기운이 두 배로 작동', w:0.2 };
    if (대세운) ev.push(대세운);
  }
  const sj = samjae(saju.year.ji, ji);
  if (sj) ev.push({ s:`삼재 ${sj.단계}`, w:-0.4 });

  const base = (SCORE[rank(R.SIPSEONG_GROUP[ganSS])]||0)*0.4 + (SCORE[rank(R.SIPSEONG_GROUP[jiSS])]||0)*0.6;
  const evW = clamp(ev.reduce((a,b)=>a+b.w,0), -2.5, 2.5);
  const total = clamp((base * har.coef + evW * 0.35) * AMP.세운);
  return {
    연도: year, 간지: R.G[gan]+R.J[ji],
    천간: { 글자:R.G[gan], 십성:ganSS, 평가:rank(R.SIPSEONG_GROUP[ganSS]) },
    지지: { 글자:R.J[ji], 십성:jiSS, 평가:rank(R.SIPSEONG_GROUP[jiSS]), 십이운성:R.sibiunseong(d, ji) },
    간지관계: har.type, 원국작용: ev.map(e=>e.s), 삼재: sj,
    종합: gradeAmp(total, AMP.세운), 점수: Math.round(total*100)/100,
  };
}

/* ---------- 월운 ----------
   절기 기준. 해당 연간에서 월간을 산출(년상기월법). */
function wolun(saju, year, yongsinGroup) {
  const d = saju.day.gan;
  const rank = rankFn(yongsinGroup);
  const yGan = ((year - 4) % 60 + 60) % 60 % 10;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const out = [];
  const TERMS = ['입춘','경칩','청명','입하','망종','소서','입추','백로','한로','입동','대설','소한'];
  for (let k = 0; k < 12; k++) {
    const mj = (2 + k) % 12;                       // 寅월부터
    const mg = (yGan * 2 + 2 + k) % 10;
    const ganSS = R.sipseongOfGan(d, mg), jiSS = R.sipseongOfJi(d, mj);
    const ev = [];
    jis.forEach(j => {
      for (const [x,y] of R.JIJI_CHUNG) if ((mj===x&&j===y)||(mj===y&&j===x)) ev.push(`${R.J[j]}충`);
      for (const [x,y] of R.YUKHAP) if ((mj===x&&j===y)||(mj===y&&j===x)) ev.push(`${R.J[j]}합`);
    });
    const har = ganjiHarmony(mg, mj);
    const base = (SCORE[rank(R.SIPSEONG_GROUP[ganSS])]||0)*0.35 + (SCORE[rank(R.SIPSEONG_GROUP[jiSS])]||0)*0.65;
    const total = clamp((base * har.coef - ev.filter(e=>e.includes('충')).length * 0.3) * AMP.월운);
    out.push({ 월차: k+1, 절기시작: TERMS[k], 간지: R.G[mg]+R.J[mj],
      천간십성: ganSS, 지지십성: jiSS, 작용: [...new Set(ev)],
      종합: gradeAmp(total, AMP.월운), 점수: Math.round(total*100)/100 });
  }
  return out;
}

/* ---------- 일운(일진) ---------- */
function ilun(saju, dateUTCms, yongsinGroup, gongmang) {
  const d = saju.day.gan;
  const rank = rankFn(yongsinGroup);
  const dt = new Date(dateUTCms);
  const jdn = (y,m,dd) => { const a=Math.floor((14-m)/12), yy=y+4800-a, mm=m+12*a-3;
    return dd+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045; };
  const idx = ((jdn(dt.getUTCFullYear(), dt.getUTCMonth()+1, dt.getUTCDate()) + 49) % 60 + 60) % 60;
  const gan = idx % 10, ji = idx % 12;
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const ganSS = R.sipseongOfGan(d, gan), jiSS = R.sipseongOfJi(d, ji);
  // 작용마다 부호를 준다. 복음처럼 나쁘지 않은 작용까지 일괄 감점하면 흉일로 쏠린다.
  const ev = [];
  for (const [x,y] of R.JIJI_CHUNG)
    if ((ji===x&&saju.day.ji===y)||(ji===y&&saju.day.ji===x))
      ev.push({ s:'일지를 충 — 몸과 자리가 흔들리는 날', w:-0.45 });
  jis.forEach((j,i) => { for (const [x,y] of R.JIJI_CHUNG)
    if ((ji===x&&j===y)||(ji===y&&j===x) && j !== saju.day.ji) ev.push({ s:`${R.J[j]}충`, w:-0.2 }); });
  jis.forEach(j => { for (const [x,y] of R.YUKHAP)
    if ((ji===x&&j===y)||(ji===y&&j===x)) ev.push({ s:`${R.J[j]}합`, w:0.25 }); });
  if (ji === saju.day.ji && gan === d) ev.push({ s:'일주와 같은 간지(복음) — 나를 크게 비추는 날', w:0.15 });
  if (gongmang && gongmang.includes(R.J[ji])) ev.push({ s:'공망일 — 계약·결정은 하루 미루는 편이 낫다', w:-0.3 });
  const har = ganjiHarmony(gan, ji);
  const total = clamp((((SCORE[rank(R.SIPSEONG_GROUP[ganSS])]||0)*0.4 +
                 (SCORE[rank(R.SIPSEONG_GROUP[jiSS])]||0)*0.6) * har.coef
                 + clamp(ev.reduce((a,e)=>a+e.w,0), -1, 1)) * AMP.일운);
  return { 날짜: dt.toISOString().slice(0,10), 일진: R.G[gan]+R.J[ji],
    천간십성: ganSS, 지지십성: jiSS, 십이운성: R.sibiunseong(d, ji),
    작용: [...new Set(ev.map(e=>e.s))], 종합: gradeAmp(total, AMP.일운), 점수: Math.round(total*100)/100 };
}

module.exports = { ganjiHarmony, gradeAmp, AMP, daeunDeep, saeunDeep, wolun, ilun, samjae, rankFn, grade };

return module.exports; })();

/* ===== saju-compat-deep.js ===== */
__mods["saju-compat-deep"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-compat-deep.js — 궁합 심화
   기존 궁합이 일간·일지·연지 3자리만 봤다면, 여기서는 16글자 전부를 교차한다.
   ============================================================= */
const R = require('./saju-rules');
const FT = require('./saju-fortune');

const POS = ['년','월','일','시'];
const pillarsOf = s => [s.year, s.month, s.day, s.hour].filter(Boolean);

/* ---------- 1. 전체 합충 매트릭스 (천간 4×4 + 지지 4×4) ---------- */
function fullMatrix(a, b) {
  const pa = pillarsOf(a.saju), pb = pillarsOf(b.saju);
  const gan = [], ji = [];
  pa.forEach((x, i) => pb.forEach((y, k) => {
    const 일간끼리 = (i === 2 && k === 2);   // 일간·일지는 별도 항목으로 이미 센다
    // 천간
    if (!일간끼리) {
      for (const [p,q,oh] of R.CHEONGAN_HAP)
        if ((x.gan===p&&y.gan===q)||(x.gan===q&&y.gan===p))
          gan.push({ A:`${POS[i]}간 ${R.G[x.gan]}`, B:`${POS[k]}간 ${R.G[y.gan]}`,
                     관계:`천간합→${R.OH[oh]}`, v:0.5 });
      for (const [p,q] of R.CHEONGAN_CHUNG)
        if ((x.gan===p&&y.gan===q)||(x.gan===q&&y.gan===p))
          gan.push({ A:`${POS[i]}간 ${R.G[x.gan]}`, B:`${POS[k]}간 ${R.G[y.gan]}`, 관계:'천간충', v:-0.4 });
    }
    if (일간끼리) return;
    // 지지
    for (const [p,q,oh] of R.YUKHAP)
      if ((x.ji===p&&y.ji===q)||(x.ji===q&&y.ji===p))
        ji.push({ A:`${POS[i]}지 ${R.J[x.ji]}`, B:`${POS[k]}지 ${R.J[y.ji]}`,
                  관계:`육합→${R.OH[oh]}`, v:0.5 });
    for (const [p,q] of R.JIJI_CHUNG)
      if ((x.ji===p&&y.ji===q)||(x.ji===q&&y.ji===p))
        ji.push({ A:`${POS[i]}지 ${R.J[x.ji]}`, B:`${POS[k]}지 ${R.J[y.ji]}`, 관계:'충', v:-0.45 });
    if (R.WONJIN[x.ji] === y.ji)
      ji.push({ A:`${POS[i]}지 ${R.J[x.ji]}`, B:`${POS[k]}지 ${R.J[y.ji]}`,
                관계: R.GWIMUN[x.ji]===y.ji ? '원진·귀문' : '원진', v:-0.4 });
    else if (R.GWIMUN[x.ji] === y.ji)
      ji.push({ A:`${POS[i]}지 ${R.J[x.ji]}`, B:`${POS[k]}지 ${R.J[y.ji]}`, 관계:'귀문', v:-0.3 });
    for (const [p,q] of R.YUKHAE)
      if ((x.ji===p&&y.ji===q)||(x.ji===q&&y.ji===p))
        ji.push({ A:`${POS[i]}지 ${R.J[x.ji]}`, B:`${POS[k]}지 ${R.J[y.ji]}`, 관계:'해', v:-0.2 });
  }));
  // 삼합/방합은 두 사람 지지를 합쳐 완성되는지 본다
  const ja = pa.map(x=>x.ji), jb = pb.map(x=>x.ji), both = [...ja, ...jb];
  const 합국 = [];
  for (const [s,w,g,oh] of R.SAMHAP) {
    const set = [s,w,g];
    if (set.every(x => both.includes(x)) && !set.every(x => ja.includes(x)) && !set.every(x => jb.includes(x)))
      합국.push({ 종류:'삼합', 조합:set.map(x=>R.J[x]).join(''), 합화:R.OH[oh],
        해설:`두 사람 지지를 합쳐야 ${set.map(x=>R.J[x]).join('')} 삼합이 완성된다 — 혼자서는 안 되던 일이 둘이 있으면 된다` });
  }
  for (const [x,y,z,oh] of R.BANGHAP) {
    const set = [x,y,z];
    if (set.every(v => both.includes(v)) && !set.every(v => ja.includes(v)) && !set.every(v => jb.includes(v)))
      합국.push({ 종류:'방합', 조합:set.map(v=>R.J[v]).join(''), 합화:R.OH[oh],
        해설:'두 사람이 만나야 한 계절이 온전해지는 조합이다' });
  }
  const all = [...gan, ...ji];
  const plus = all.filter(x=>x.v>0).length, minus = all.filter(x=>x.v<0).length;
  const raw = all.reduce((s,x)=>s+x.v, 0) + 합국.length * 0.6;
  return { 천간: gan, 지지: ji, 합국,
    요약: `총 ${all.length}건 (합·생 ${plus} / 충·형·원진 ${minus})${합국.length?`, 두 사람이 만나 이루는 합국 ${합국.length}건`:''}`,
    v: Math.max(-1, Math.min(1.2, raw / 3.5)) };
}

/* ---------- 2. 궁위별 궁합 ----------
   같은 자리끼리 비교한다. 연주는 집안, 월주는 가치관·환경, 일주는 본인,
   시주는 자식·노후. 어느 층에서 맞고 어긋나는지가 관계의 성격을 정한다. */
/* 자리의 뜻은 관계에 따라 달라진다.
   남매 사이에 "배우자궁", "자식 양육관"이라고 쓰면 읽는 사람이 당황한다. */
const GUNG_BASE = [
  { 주:'연주', 뜻:'집안·성장 배경', 좋:'집안 분위기와 어른들 사이가 무난하다', 나쁨:'집안 배경과 가치관 차이에서 마찰이 난다' },
  { 주:'월주', 뜻:'사회적 환경·가치관', 좋:'일하는 방식과 생활 리듬이 잘 맞는다', 나쁨:'돈 쓰는 법, 일하는 방식에서 자주 부딪힌다' },
  { 주:'일주', 뜻:'본인·배우자궁', 좋:'속이 잘 맞고 함께 있을 때 편안하다', 나쁨:'가장 가까운 자리에서 부딪혀 체감이 크다' },
  { 주:'시주', 뜻:'자식·노후', 좋:'자식 문제와 미래 계획에서 뜻이 모인다', 나쁨:'자식 양육관과 노후 계획이 엇갈린다' },
];
const GUNG_BY_REL = {
  '형제·자매': {
    연주: { 뜻:'같은 집안·자란 환경', 좋:'같은 집에서 자란 결이 비슷해 말이 통한다', 나쁨:'같은 집에서 자랐어도 받아들인 것이 서로 달랐다' },
    일주: { 뜻:'각자의 본바탕', 좋:'기질이 닮아 서로를 쉽게 알아본다', 나쁨:'가장 가까운 자리에서 부딪혀 비교와 경쟁이 잦다' },
    시주: { 뜻:'말년과 남기는 것', 좋:'나중 일을 두고 뜻이 모인다', 나쁨:'부모 돌봄이나 재산 문제에서 생각이 갈린다' },
  },
  '부모·자식': {
    연주: { 뜻:'집안의 뿌리', 좋:'집안 내력이 순하게 이어진다', 나쁨:'윗대의 방식을 두고 생각이 갈린다' },
    일주: { 뜻:'각자의 본바탕', 좋:'속이 잘 맞아 편하게 지낸다', 나쁨:'가장 가까운 자리에서 부딪혀 잔소리와 반발이 오간다' },
    시주: { 뜻:'뒷날과 돌봄', 좋:'앞날을 두고 뜻이 모인다', 나쁨:'독립과 돌봄의 시점을 두고 생각이 어긋난다' },
  },
  친구: {
    일주: { 뜻:'각자의 본바탕', 좋:'같이 있으면 편하고 말이 잘 통한다', 나쁨:'가까이 지낼수록 결이 어긋나는 면이 드러난다' },
    시주: { 뜻:'오래 볼 수 있는가', 좋:'시간이 지나도 이어질 결이 있다', 나쁨:'시기가 지나면 멀어지기 쉬운 구석이 있다' },
  },
  동업: {
    연주: { 뜻:'배경과 출신', 좋:'서로의 배경이 부딪히지 않는다', 나쁨:'서로 다른 판에서 와서 기준이 어긋난다' },
    일주: { 뜻:'각자의 본바탕', 좋:'일하는 결이 맞아 손발이 맞는다', 나쁨:'가장 가까운 자리에서 부딪혀 주도권 다툼이 생긴다' },
    시주: { 뜻:'마무리와 나눔', 좋:'끝맺음과 배분에서 뜻이 모인다', 나쁨:'정산과 마무리에서 생각이 갈린다' },
  },
  가족: {
    일주: { 뜻:'각자의 본바탕', 좋:'속이 잘 맞아 함께 있을 때 편안하다', 나쁨:'가장 가까운 자리에서 부딪혀 체감이 크다' },
    시주: { 뜻:'말년과 남기는 것', 좋:'나중 일을 두고 뜻이 모인다', 나쁨:'돌봄과 재산 문제에서 생각이 갈린다' },
  },
};
function gungMeanOf(relation) {
  const over = GUNG_BY_REL[relation];
  if (!over) return GUNG_BASE;
  return GUNG_BASE.map(g => over[g.주] ? { ...g, ...over[g.주] } : g);
}
function gungByGung(a, b, relation) {
  const GUNG_MEAN = gungMeanOf(relation);
  const pa = pillarsOf(a.saju), pb = pillarsOf(b.saju);
  const n = Math.min(pa.length, pb.length);
  const rows = [];
  for (let i = 0; i < n; i++) {
    const x = pa[i], y = pb[i], hits = [];
    let v = 0;
    for (const [p,q,oh] of R.CHEONGAN_HAP)
      if ((x.gan===p&&y.gan===q)||(x.gan===q&&y.gan===p)) { hits.push(`천간합→${R.OH[oh]}`); v+=0.5; }
    for (const [p,q] of R.CHEONGAN_CHUNG)
      if ((x.gan===p&&y.gan===q)||(x.gan===q&&y.gan===p)) { hits.push('천간충'); v-=0.4; }
    for (const [p,q,oh] of R.YUKHAP)
      if ((x.ji===p&&y.ji===q)||(x.ji===q&&y.ji===p)) { hits.push(`육합→${R.OH[oh]}`); v+=0.6; }
    for (const [s,w,g] of R.SAMHAP)
      if ([s,w,g].includes(x.ji) && [s,w,g].includes(y.ji) && x.ji!==y.ji) { hits.push('삼합'); v+=0.5; }
    for (const [p,q] of R.JIJI_CHUNG)
      if ((x.ji===p&&y.ji===q)||(x.ji===q&&y.ji===p)) { hits.push('충'); v-=0.5; }
    if (R.WONJIN[x.ji]===y.ji) { hits.push('원진'); v-=0.45; }
    if (x.ji===y.ji) { hits.push('동일 지지'); v+=0.15; }
    const m = GUNG_MEAN[i];
    rows.push({ ...m, A:R.G[x.gan]+R.J[x.ji], B:R.G[y.gan]+R.J[y.ji],
      작용: hits.length?hits:['무관'], 점수: Math.round(v*100)/100,
      해설: v > 0.2 ? m.좋 : v < -0.2 ? m.나쁨 : '이 층에서는 서로 크게 간섭하지 않는다' });
  }
  return rows;
}

/* ---------- 3. 인연 리스크 (도화·홍염·원진 교차) ---------- */
function romanceRisk(a, b) {
  const items = [];
  const chk = (me, other, label) => {
    const d = me.saju.day.gan;
    const jis = pillarsOf(me.saju).map(x=>x.ji);
    const g = R.SAMHAP_GROUP(me.saju.day.ji);
    const dohwa = R.DOHWA[g];
    const otherJis = pillarsOf(other.saju).map(x=>x.ji);
    if (otherJis.includes(dohwa))
      items.push(`${label}: 상대 지지에 ${R.josa(R.J[dohwa], '이가')} 있어 ${label} 쪽 도화를 건드린다 — 강하게 끌리는 요소다`);
    // 배우자성 과다 여부
    const star = me.gender === 'M' ? ['정재','편재'] : ['정관','편관'];
    const cnt = pillarsOf(me.saju).reduce((n, p) => {
      let c = 0;
      if (star.includes(R.sipseongOfGan(d, p.gan))) c++;
      if (star.includes(R.sipseongOfJi(d, p.ji))) c++;
      return n + c;
    }, 0);
    if (cnt >= 3) items.push(`${label}: 배우자성이 ${cnt}개로 많다 — 인연이 여럿 스치기 쉬워 관계 관리가 필요하다`);
  };
  chk(a, b, 'A'); chk(b, a, 'B');
  const ja = pillarsOf(a.saju).map(x=>x.ji), jb = pillarsOf(b.saju).map(x=>x.ji);
  let wonjin = 0;
  ja.forEach(x => jb.forEach(y => { if (R.WONJIN[x] === y) wonjin++; }));
  if (wonjin >= 2) items.push(`두 사람 지지 사이 원진이 ${wonjin}건 — 애증이 반복되는 구조라 거리 조절이 중요하다`);
  return { 항목: items.length ? items : ['특별히 두드러지는 인연 리스크는 없다'],
    v: Math.max(-0.6, -0.2 * Math.max(0, wonjin - 1)) };
}

/* ---------- 4. 결혼 적기 ----------
   배우자성이 운에서 들어오거나, 배우자궁(일지)이 합을 만나는 해를 본다. */
function marriageTiming(person, fromYear, years = 15) {
  const s = person.saju, d = s.day.gan;
  const star = person.gender === 'M' ? ['정재','편재'] : ['정관','편관'];
  const out = [];
  for (let y = fromYear; y < fromYear + years; y++) {
    const idx = ((y - 4) % 60 + 60) % 60;
    const gan = idx % 10, ji = idx % 12;
    const reasons = [];
    if (star.includes(R.sipseongOfGan(d, gan))) reasons.push(`세운 천간 ${R.josa(R.G[gan], '이가')} 배우자성`);
    if (star.includes(R.sipseongOfJi(d, ji)))   reasons.push(`세운 지지 ${R.josa(R.J[ji], '이가')} 배우자성`);
    for (const [p,q,oh] of R.YUKHAP)
      if ((ji===p&&s.day.ji===q)||(ji===q&&s.day.ji===p))
        reasons.push(`배우자궁(일지 ${R.J[s.day.ji]})과 육합 — 배우자 자리가 움직인다`);
    for (const [p,q] of R.CHEONGAN_HAP)
      if ((gan===p&&d===q)||(gan===q&&d===p)) reasons.push('일간과 천간합 — 마음이 한쪽으로 정해진다');
    const age = y - person.birthYear + 1;
    if (reasons.length >= 2)
      out.push({ 연도:y, 나이:age, 간지:R.G[gan]+R.J[ji], 사유:reasons,
        강도: reasons.length >= 3 ? '강' : '보통' });
  }
  return { 후보: out,
    해설: '배우자성이 운에서 들어오거나 배우자궁이 합으로 움직이는 해를 뽑은 것이다. ' +
          '결혼은 본인 선택이고, 여기 없는 해에 하면 안 된다는 뜻이 전혀 아니다' };
}

/* ---------- 5. 관계 유형 분류 ---------- */
function relationType(g, mat) {
  const gap = Math.abs(g.A입장.점수 - g.B입장.점수);
  const ysA = g.용신상보.A가받는것.v, ysB = g.용신상보.B가받는것.v;
  const 합 = mat.천간.filter(x=>x.v>0).length + mat.지지.filter(x=>x.v>0).length;
  const 충 = mat.천간.filter(x=>x.v<0).length + mat.지지.filter(x=>x.v<0).length;

  if (gap >= 18) return { 유형:'일방형(一方形)',
    설명:'한쪽이 확연히 더 얻는 관계다. 얻는 쪽이 그것을 알고 갚아야 오래간다. 모르면 주는 쪽이 먼저 지친다' };
  if (ysA > 0.3 && ysB > 0.3) return { 유형:'상보형(相補形)',
    설명:'서로의 빈 곳을 채운다. 명리에서 가장 좋게 보는 형태로, 함께 있을 때 각자 일이 풀린다' };
  if (합 >= 4 && 충 <= 2) return { 유형:'동조형(同調形)',
    설명:'합이 많아 편안하고 갈등이 적다. 다만 자극이 적어 관계가 정체되면 심심해질 수 있다' };
  if (충 >= 4 && 합 >= 3) return { 유형:'애증형(愛憎形)',
    설명:'합과 충이 함께 많다. 부딪히면서도 못 놓는 관계라 강렬하지만 소모가 크다' };
  if (충 >= 4) return { 유형:'갈등형(葛藤形)',
    설명:'부딪히는 자리가 많다. 서로를 바꾸려 들면 어렵고, 영역을 나누면 의외로 오래간다' };
  return { 유형:'평행형(平行形)',
    설명:'서로 크게 간섭하지 않는다. 편하지만 끌림도 약해, 관계를 이어가려면 의식적인 노력이 필요하다' };
}

module.exports = { fullMatrix, gungByGung, romanceRisk, marriageTiming, relationType };

return module.exports; })();

/* ===== saju-compat.js ===== */
__mods["saju-compat"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-compat.js — 궁합
   구조: 겉궁합(연지) / 속궁합(일주) / 용신 상보 / 십성 / 조후·강약 / 운의 동조
   원칙
     - 궁합은 한 개의 점수가 아니다. 한쪽이 채워지고 한쪽이 빠지는 관계가 흔하므로
       반드시 A입장·B입장을 따로 낸다.
     - 충이 있다고 흉이 아니다. 같은 자리에 합이 함께 있는지를 본다.
     - 띠(연지) 궁합은 여덟 글자 중 한 글자라 비중을 낮게 둔다.
   ============================================================= */
const R = require('./saju-rules');
const FT = require('./saju-fortune');
const D = require('./saju-compat-deep');

// 관계 종류마다 무엇이 중요한지가 다르다. 동업에 배우자궁 비중을 그대로 쓰면 엉뚱한 결과가 난다.
// 매트릭스는 일간끼리·일지끼리 칸을 제외하므로 이중 계산이 아니다.
const PROFILES = {
  연애: { 일간:15, 일지:20, 용신상보:28, 매트릭스:15, 십성:8,  조후강약:9,  연지:5,
         설명:'배우자궁(일지)과 끌림(일간합)을 무겁게 본다' },
  부부: { 일간:14, 일지:22, 용신상보:27, 매트릭스:16, 십성:8,  조후강약:9,  연지:4,
         설명:'생활을 함께하므로 일지와 조후·강약 보완을 더 본다' },
  동업: { 일간:12, 일지:10, 용신상보:34, 매트릭스:18, 십성:14, 조후강약:9,  연지:3,
         설명:'배우자궁은 덜 보고, 서로의 부족한 오행을 채우는지와 재·관 관계를 무겁게 본다' },
  가족: { 일간:12, 일지:12, 용신상보:30, 매트릭스:20, 십성:14, 조후강약:9,  연지:3,
         설명:'끊을 수 없는 관계라 여덟 글자 전체의 충합과 상보를 본다' },
  '형제·자매': { 일간:16, 일지:10, 용신상보:28, 매트릭스:20, 십성:15, 조후강약:8, 연지:3,
         설명:'같은 자리에서 자란 사이라 기질(일간)과 비겁 관계를 무겁게 본다' },
  '부모·자식': { 일간:12, 일지:10, 용신상보:32, 매트릭스:19, 십성:16, 조후강약:8, 연지:3,
         설명:'한쪽이 주고 한쪽이 받는 자리라 인성·식상 관계와 오행 보완을 크게 본다' },
  친구: { 일간:18, 일지:12, 용신상보:29, 매트릭스:18, 십성:12, 조후강약:8,  연지:3,
         설명:'기질이 맞는지(일간)와 함께 있을 때 편한지를 본다' },
};
const W = PROFILES.연애;

/* ---------- 일간 관계 ---------- */
function ilganRel(a, b) {
  const ga = a.saju.day.gan, gb = b.saju.day.gan;
  const hap = R.CHEONGAN_HAP.find(([x,y]) => (x===ga&&y===gb)||(y===ga&&x===gb));
  const chung = R.CHEONGAN_CHUNG.find(([x,y]) => (x===ga&&y===gb)||(y===ga&&x===gb));
  if (hap) return { 관계:`${R.G[ga]}${R.G[gb]} 천간합 → ${R.OH[hap[2]]}`, A:1.0, B:1.0,
    해설:'일간끼리 합한다 — 서로 이유 없이 끌리고 상대에게 마음이 묶인다. 궁합에서 가장 좋게 보는 자리다' };
  if (chung) return { 관계:`${R.G[ga]}${R.G[gb]} 천간충`, A:-0.7, B:-0.7,
    해설:'가치관이 정면으로 부딪힌다. 다만 일지에 합이 있으면 부딪히면서도 붙어 있는 관계가 된다' };
  const oa = R.G_OH[ga], ob = R.G_OH[gb];
  if (ga === gb) return { 관계:'일간 동일', A:0.3, B:0.3,
    해설:'같은 기질이라 말이 잘 통하지만, 같은 약점도 공유해 흔들릴 때 같이 흔들린다' };
  if (oa === ob) return { 관계:'같은 오행(음양 다름)', A:0.4, B:0.4,
    해설:'결이 비슷하면서 음양이 달라 서로를 보완한다' };
  if (R.SAENG(oa) === ob) return { 관계:`${R.OH[oa]}生${R.OH[ob]} — A가 B를 생함`, A:-0.1, B:0.6,
    해설:'A가 B를 키워주는 구조. B는 편안하지만 A는 주는 쪽이라 오래되면 지칠 수 있다' };
  if (R.SAENG(ob) === oa) return { 관계:`${R.OH[ob]}生${R.OH[oa]} — B가 A를 생함`, A:0.6, B:-0.1,
    해설:'B가 A를 키워주는 구조. A는 편안하지만 B가 주는 쪽이다' };
  if (R.GEUK(oa) === ob) return { 관계:`${R.OH[oa]}剋${R.OH[ob]} — A가 B를 극함`, A:0.2, B:-0.5,
    해설:'A가 주도권을 쥔다. B가 눌린다고 느끼면 관계가 오래가기 어렵다' };
  return { 관계:`${R.OH[ob]}剋${R.OH[oa]} — B가 A를 극함`, A:-0.5, B:0.2,
    해설:'B가 주도권을 쥔다. A 쪽에서 답답함이 쌓이기 쉽다' };
}

/* ---------- 일지 관계 (속궁합 핵심) ---------- */
function iljiRel(a, b) {
  const ja = a.saju.day.ji, jb = b.saju.day.ji;
  const hits = [];
  const yuk = R.YUKHAP.find(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb));
  if (yuk) hits.push({ n:`${R.J[ja]}${R.J[jb]} 육합 → ${R.OH[yuk[2]]}`, v:1.0,
    d:'배우자궁끼리 합한다 — 속이 잘 맞고 함께 있을 때 편안하다' });
  for (const [s,w,g,oh] of R.SAMHAP) {
    const set=[s,w,g];
    if (set.includes(ja) && set.includes(jb) && ja!==jb) {
      const hasWang = ja===w || jb===w;
      hits.push({ n:`${R.J[ja]}${R.J[jb]} 삼합${hasWang?'':'(왕지 없음)'} → ${R.OH[oh]}`,
        v: hasWang?0.9:0.5, d:'같은 방향을 보는 조합 — 목표와 취향이 겹친다' });
    }
  }
  for (const [x,y,z,oh] of R.BANGHAP)
    if ([x,y,z].includes(ja) && [x,y,z].includes(jb) && ja!==jb)
      hits.push({ n:`${R.J[ja]}${R.J[jb]} 방합 → ${R.OH[oh]}`, v:0.7, d:'같은 계절의 기운 — 생활 리듬이 비슷하다' });
  if (ja === jb) hits.push({ n:'일지 동일', v:0.3, d:'서로를 잘 이해하지만 같은 자리를 놓고 겹치기도 한다' });
  if (R.JIJI_CHUNG.some(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb)))
    hits.push({ n:`${R.J[ja]}${R.J[jb]} 충`, v:-0.6, d:'배우자궁이 부딪힌다 — 변동이 잦다. 다만 다른 합이 함께 있으면 자극이 성장으로 간다' });
  if (R.WONJIN[ja] === jb) hits.push({ n:`${R.J[ja]}${R.J[jb]} 원진`, v:-0.7,
    d:'만나면 부딪히는데 떨어지면 그리워진다 — 미워하면서 못 놓는 관계' });
  if (R.GWIMUN[ja] === jb) hits.push({ n:`${R.J[ja]}${R.J[jb]} 귀문`, v:-0.6,
    d:'서로에게 예민해진다 — 의심과 집착으로 흐르기 쉬워 거리 조절이 필요하다' });
  if (R.YUKHAE.some(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb)))
    hits.push({ n:`${R.J[ja]}${R.J[jb]} 해`, v:-0.3, d:'사소한 어긋남이 반복된다' });
  if (R.YUKPA.some(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb)))
    hits.push({ n:`${R.J[ja]}${R.J[jb]} 파`, v:-0.25, d:'한 번씩 관계에 금이 가는 일이 생긴다' });
  if ((ja===0&&jb===3)||(ja===3&&jb===0)) hits.push({ n:'자묘 상형', v:-0.5, d:'예의와 선을 놓고 부딪힌다' });
  for (const k of Object.keys(R.SAMHYEONG)) {
    const set = R.SAMHYEONG[k].ji;
    if (set.includes(ja) && set.includes(jb) && ja!==jb)
      hits.push({ n:`${R.J[ja]}${R.J[jb]} ${R.SAMHYEONG[k].name.split(' ')[0]} 형`, v:-0.5, d:'간섭과 집착, 지연이 생기기 쉽다' });
  }
  if (!hits.length) hits.push({ n:'무관', v:0, d:'배우자궁끼리 특별한 작용이 없다 — 서로 간섭도 끌림도 덜하다' });

  const pos = hits.filter(h=>h.v>0), neg = hits.filter(h=>h.v<0);
  let v = hits.reduce((s,h)=>s+h.v, 0);
  let note = null;
  if (pos.length && neg.length) {
    v = v * 0.75 + 0.15;   // 합이 충을 눌러준다
    note = '충·형이 있으나 합이 함께 있다 — 부딪히면서도 붙어 있는 관계로, 충만 있는 경우와 다르게 본다';
  }
  return { 작용: hits.map(h=>({ 관계:h.n, 해설:h.d })), 완충: note, v: Math.max(-1, Math.min(1.2, v)) };
}

/* ---------- 용신 상보 (가장 큰 비중) ---------- */
function yongsinSupply(me, other) {
  const grp = me.yongsin.primary.group;
  if (!grp) return { v:0, 해설:'용신이 십성 그룹으로 확정되지 않아 상보 판정을 보류한다' };
  const yoOh = R.groupOh(me.saju.day.gan, grp);
  const heeOh = R.groupOh(me.saju.day.gan, R.희신(grp));
  const giOh  = R.groupOh(me.saju.day.gan, R.기신(grp));
  const supply = other.deep.final[yoOh] + other.deep.final[heeOh] * 0.5;
  const harm   = other.deep.final[giOh];
  const mine   = me.deep.final[yoOh];
  const net = (supply - harm) / 50;                      // 대략 -1 ~ +1
  const scarce = mine < 15;
  return {
    내용신: `${grp}(${R.OH[yoOh]})`, 내원국보유: mine + '%',
    상대공급: Math.round(supply*10)/10 + '%', 상대기신: Math.round(harm*10)/10 + '%',
    v: Math.max(-1, Math.min(1.2, net + (scarce && supply >= 20 ? 0.3 : 0))),
    해설: scarce && supply >= 20
      ? `내 원국에 ${R.josa(R.OH[yoOh], '이가')} ${mine}%밖에 없는데 상대가 ${Math.round(supply)}%를 채워준다 — 곁에 있으면 일이 풀리는 느낌을 받는 조합이다`
      : supply >= harm + 10 ? `상대가 내 용신 ${R.josa(R.OH[yoOh], '을를')} 넉넉히 가졌다 — 기운을 받는 쪽이다`
      : harm >= supply + 10 ? `상대에게 내 기신 ${R.josa(R.OH[giOh], '이가')} 많다 — 함께 있을수록 내가 눌린다`
      : '용신 공급과 기신이 비슷해 상보 효과가 크지 않다',
  };
}

/* ---------- 십성 관계 ---------- */
function sipseongRel(me, other, gender, relation = '연애') {
  const d = me.saju.day.gan;
  const ss = R.sipseongOfGan(d, other.saju.day.gan);
  const grp = R.SIPSEONG_GROUP[ss];
  // 관계마다 '좋은 십성'이 다르다. 동업에서 상대가 재성이면 이익을 만들지만,
  // 연애에서 재성은 배우자성이라 뜻이 완전히 다르다.
  if (relation === '동업') {
    const map = { 재성:[0.9,'상대가 나에게 재성 — 함께 하면 이익이 만들어지는 조합이다'],
      식상:[0.7,'상대가 내 표현과 생산을 끌어낸다 — 일이 굴러가는 조합이다'],
      관성:[0.4,'상대가 나에게 관성 — 체계와 책임을 지우는 쪽이라 역할이 분명해진다'],
      인성:[0.2,'상대가 나를 받쳐주지만 추진보다 관리에 가깝다'],
      비겁:[-0.4,'상대가 나와 같은 자리다 — 역할이 겹쳐 이익 배분에서 부딪히기 쉽다'] };
    const [v, 해설] = map[grp];
    return { 상대는나에게: ss, v, 해설 };
  }
  if (relation === '친구' || relation === '가족' ||
      relation === '형제·자매' || relation === '부모·자식') {
    const map = { 비겁:[0.8,'같은 자리에 선 사이라 편하고 오래간다'],
      식상:[0.6,'상대 앞에서 말과 표현이 살아난다'], 인성:[0.6,'기대고 배울 수 있는 상대다'],
      재성:[0.3,'상대에게 쓰는 것이 많아지는 관계다'],
      관성:[-0.1,'상대가 나를 잡아주지만 편하지만은 않다'] };
    const [v, 해설] = map[grp];
    return { 상대는나에게: ss, v, 해설 };
  }
  const spouseGrp = gender === 'M' ? '재성' : '관성';
  const strong = me.strength.verdict === '신강';
  let v = 0, 해설;
  if (grp === spouseGrp) {
    v = strong ? 0.9 : 0.2;
    해설 = strong
      ? `상대가 나에게 ${ss} — 배우자성에 해당하고 내가 신강해 충분히 감당한다. 배필로 보는 전형이다`
      : `상대가 나에게 ${ss}(배우자성)이지만 내가 신약해 버거울 수 있다 — 기대면 좋고 끌려가면 힘들다`;
  } else if (grp === '인성') { v = strong ? -0.2 : 0.7;
    해설 = strong ? '상대가 나를 더 키워주려 하는데 나는 이미 충분해 간섭으로 느껴질 수 있다'
                  : '상대가 나를 받쳐주고 채워준다 — 신약한 나에게 기댈 언덕이 된다'; }
  else if (grp === '비겁') { v = strong ? -0.3 : 0.5;
    해설 = strong ? '친구처럼 편하지만 같은 것을 두고 겨루게 된다'
                  : '어깨를 나란히 하며 힘을 보태주는 관계다'; }
  else if (grp === '식상') { v = strong ? 0.6 : -0.2;
    해설 = strong ? '내 기운을 풀어내게 해준다 — 상대 앞에서 표현이 살아난다'
                  : '상대에게 쏟다 보면 내가 소모된다'; }
  else { v = strong ? 0.7 : -0.4;
    해설 = strong ? `상대가 나에게 ${ss} — 나를 잡아주고 자리를 만들어준다`
                  : `상대가 나에게 ${ss}인데 신약해 압박으로 작용한다`; }
  return { 상대는나에게: ss, v, 해설 };
}

/* ---------- 조후·강약 보완 ---------- */
function balanceRel(a, b) {
  const ja = a.yongsin.johu, jb = b.yongsin.johu;
  const items = [];
  let v = 0;
  // 등급(조열/한랭/중화)만 보면 각자 중화 구간이면서 서로 반대편에 있는 조합을 놓친다.
  // 여름 월지와 겨울 월지가 만나는 전형적인 보완이 그렇다. 그래서 온도 수치로 본다.
  const ta = ja.온도 ?? 0, tb = jb.온도 ?? 0;
  const gap = Math.abs(ta - tb), opposite = ta * tb < 0;
  const hot = x => x.tone === '조열', cold = x => x.tone === '한랭';
  if (opposite && gap >= 6) { v += 0.9;
    items.push(`한쪽은 따뜻하고(${ta > 0 ? ta : tb}) 한쪽은 차갑다(${ta > 0 ? tb : ta}) — ` +
      '서로의 기후를 중화시켜 준다. 조후 궁합으로는 최상이다'); }
  else if (opposite && gap >= 3) { v += 0.5;
    items.push('온도가 서로 반대쪽이라 어느 정도 중화가 된다'); }
  else if (hot(ja) && hot(jb)) { v -= 0.5; items.push('둘 다 조열 — 함께 있으면 더 달아오른다. 식혀줄 요소가 밖에 필요하다'); }
  else if (cold(ja) && cold(jb)) { v -= 0.5; items.push('둘 다 한랭 — 서로 데워주지 못해 관계가 식기 쉽다'); }
  else if (Math.abs(ta) >= 3 && Math.abs(tb) >= 3 && !opposite) { v -= 0.4;
    items.push('같은 방향으로 치우쳐 있어 서로를 중화시키지 못한다'); }
  else items.push('조후는 어느 쪽도 치우침이 심하지 않다');

  const la = a.strength.level, lb = b.strength.level;
  const strongA = a.strength.verdict === '신강', strongB = b.strength.verdict === '신강';
  if (strongA !== strongB) { v += 0.5; items.push(`${la} + ${lb} — 한쪽이 밀고 한쪽이 받쳐 역할이 갈린다`); }
  else if (la === '태강' && lb === '태강') { v -= 0.7; items.push('둘 다 태강 — 주도권을 양보하지 않아 정면충돌이 잦다'); }
  else if (la === '태약' && lb === '태약') { v -= 0.6; items.push('둘 다 태약 — 서로 기대려 해서 결정이 미뤄진다'); }
  else items.push(`${la} + ${lb} — 비슷한 무게라 큰 마찰도 큰 보완도 적다`);
  return { v: Math.max(-1, Math.min(1, v)), 항목: items };
}

/* ---------- 연지(겉궁합) ---------- */
function yeonjiRel(a, b, relation) {
  const 혼사 = ['연애','부부'].includes(relation);
  const ja = a.saju.year.ji, jb = b.saju.year.ji;
  if (R.YUKHAP.some(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb)))
    return { v:1.0, 관계:`${R.J[ja]}${R.J[jb]} 육합`, 해설:'띠가 합한다 — 첫인상과 주변 시선이 무난하다' };
  for (const [s,w,g] of R.SAMHAP)
    if ([s,w,g].includes(ja) && [s,w,g].includes(jb) && ja!==jb)
      return { v:0.9, 관계:`${R.J[ja]}${R.J[jb]} 삼합`, 해설:'흔히 말하는 잘 맞는 띠다' };
  if (R.JIJI_CHUNG.some(([x,y]) => (x===ja&&y===jb)||(y===ja&&x===jb)))
    return { v:-0.6, 관계:`${R.J[ja]}${R.J[jb]} 충`,
      해설: 혼사
        ? '띠끼리 충 — 집안 어른들이 꺼리는 조합이지만 여덟 글자 중 한 글자일 뿐이다'
        : '띠끼리 충 — 겉으로 드러나는 결이 서로 반대쪽이다. 여덟 글자 중 한 글자일 뿐이니 크게 볼 것은 아니다' };
  if (R.WONJIN[ja] === jb)
    return { v:-0.7, 관계:`${R.J[ja]}${R.J[jb]} 원진`, 해설:'띠 원진 — 겉으로 드러나는 마찰이 있다' };
  return { v:0, 관계:'무관', 해설:'띠로는 특별한 작용이 없다' };
}

/* ---------- 운의 동조 ---------- */
function unSync(a, b, fromYear, years = 10) {
  const rows = [];
  for (let y = fromYear; y < fromYear + years; y++) {
    const ageA = y - a.birthYear + 1, ageB = y - b.birthYear + 1;
    const duA = a.saju.daeun.list.filter(x => x.start <= ageA).pop() || null;
    const duB = b.saju.daeun.list.filter(x => x.start <= ageB).pop() || null;
    const sa = FT.saeunDeep(a.saju, y, a.yongsin.primary.group, duA, a.gongmang);
    const sb = FT.saeunDeep(b.saju, y, b.yongsin.primary.group, duB, b.gongmang);
    rows.push({ 연도:y, 간지:sa.간지, A:sa.종합, B:sb.종합,
      Apt:sa.점수, Bpt:sb.점수, 합:Math.round((sa.점수+sb.점수)*100)/100 });
  }
  const best = rows.slice().sort((x,y)=>y.합-x.합)[0];
  const worst = rows.slice().sort((x,y)=>x.합-y.합)[0];
  return { 표:rows,
    같이좋은해: `${best.연도} (${best.간지}) — A ${best.A} / B ${best.B}`,
    같이주의할해: `${worst.연도} (${worst.간지}) — A ${worst.A} / B ${worst.B}`,
    해설:'두 사람 세운을 같은 축에 올린 것이다. 한쪽만 좋은 해에는 좋은 쪽이 끌고 가는 편이 낫다' };
}

/* ---------- 종합 ---------- */
function compatibility(a, b, opts = {}) {
  const 관계종류 = opts.relation && PROFILES[opts.relation] ? opts.relation : '연애';
  const WW = PROFILES[관계종류];
  const ilgan = ilganRel(a, b);
  const ilji  = iljiRel(a, b);
  const yeon  = yeonjiRel(a, b, 관계종류);
  const ysA   = yongsinSupply(a, b);
  const ysB   = yongsinSupply(b, a);
  const ssA   = sipseongRel(a, b, a.gender, 관계종류);
  const ssB   = sipseongRel(b, a, b.gender, 관계종류);
  const bal   = balanceRel(a, b);
  const mat   = D.fullMatrix(a, b);
  const gung  = D.gungByGung(a, b, 관계종류);
  const risk  = D.romanceRisk(a, b);

  const to100 = v => Math.round(Math.max(0, Math.min(100, (v + 1) / 2 * 100)));
  const side = (ilganV, ysV, ssV) =>
    Math.round((ilganV*WW.일간 + ilji.v*WW.일지 + ysV*WW.용신상보 + mat.v*WW.매트릭스 +
                ssV*WW.십성 + bal.v*WW.조후강약 + yeon.v*WW.연지 +
                (관계종류==='연애'||관계종류==='부부' ? risk.v*5 : 0)) / 100 * 50 + 50);

  const scoreA = Math.max(0, Math.min(100, side(ilgan.A, ysA.v, ssA.v)));
  const scoreB = Math.max(0, Math.min(100, side(ilgan.B, ysB.v, ssB.v)));
  const total = Math.round((scoreA + scoreB) / 2);
  const gapNote = Math.abs(scoreA - scoreB) >= 15
    ? `두 사람 점수 차가 ${Math.abs(scoreA-scoreB)}점이다 — 한쪽이 더 얻고 한쪽이 더 내주는 관계라, 평균만 보면 실제를 놓친다`
    : null;

  // 원점수는 합·상보가 있으면 가점되는 구조라 자연히 50 위로 치우친다(실측 평균 60.8).
  // 점수를 인위로 깎는 대신, 1.2만 쌍 실측 분포로 백분위를 내고 등급은 그 위에서 매긴다.
  // PCT[i] = (i*5+5) 백분위에 해당하는 원점수.
  const PCT = [42,46,49,50,52,54,55,56,58,59,60,61,63,64,66,67,69,72,75];
  const percentile = s => {
    let p = 2;
    for (let i = 0; i < PCT.length; i++) if (s >= PCT[i]) p = (i+1)*5;
    return Math.min(98, p);
  };
  const band = s => { const p = percentile(s);
    return p >= 90 ? '매우 좋음' : p >= 70 ? '좋음' : p >= 30 ? '보통'
         : p >= 10 ? '노력 필요' : '어려움'; };

  return {
    관계종류: { 종류: 관계종류, 가중치: WW, 설명: WW.설명 },
    총점: total, 백분위: percentile(total), 등급: band(total),
    위치: percentile(total) >= 50 ? `상위 ${100 - percentile(total)}%` : `하위 ${percentile(total)}%`,
    점수해설: `원점수 ${total}점은 무작위 조합 분포에서 ` +
              (percentile(total) >= 50 ? `상위 ${100 - percentile(total)}%` : `하위 ${percentile(total)}%`) + ' 수준이다. ' +
              '궁합 점수는 절대 기준이 없어, 다른 조합들과 견준 상대 위치로 읽는 편이 정확하다.',
    A입장: { 점수: scoreA, 백분위: percentile(scoreA), 등급: band(scoreA) },
    B입장: { 점수: scoreB, 백분위: percentile(scoreB), 등급: band(scoreB) },
    비대칭: gapNote,
    겉궁합: { 항목:'연지(띠)', 가중치:WW.연지, ...yeon },
    속궁합: {
      일간: { 가중치:WW.일간, ...ilgan },
      일지: { 가중치:WW.일지, ...ilji },
    },
    용신상보: { 가중치:WW.용신상보, A가받는것:ysA, B가받는것:ysB },
    십성관계: { 가중치:WW.십성, A기준:ssA, B기준:ssB },
    조후강약: { 가중치:WW.조후강약, ...bal },
    전체매트릭스: { 가중치:WW.매트릭스, ...mat },
    궁위별: gung,
    인연리스크: risk,
    관계유형: null,
    _mat: mat,
    한계: '궁합은 관계의 사용설명서이지 판결문이 아니다. 충이 있다고 못 만날 이유가 되지 않고, ' +
          '합이 많다고 저절로 유지되지도 않는다. 여기 나온 것은 두 사주가 만났을 때 어디서 힘을 얻고 ' +
          '어디서 부딪히기 쉬운지에 대한 경향이다.',
  };
}

/** compatibility 결과에 관계 유형을 채워 반환 */
function compatibilityFull(a, b, opts = {}) {
  const g = compatibility(a, b, opts);
  g.관계유형 = D.relationType(g, g._mat);
  delete g._mat;
  return g;
}

module.exports = { compatibility, compatibilityFull, PROFILES, deep: D, ilganRel, iljiRel, yeonjiRel, yongsinSupply, sipseongRel, balanceRel, unSync, W };

return module.exports; })();

/* ===== saju-full.js ===== */
__mods["saju-full"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-full.js — 전 레이어 통합
   만세력 → 기본 분석 → 심층(왕상휴수사·통근·합화) → 성패·패턴·육친·대운
   ============================================================= */
const E = require('./saju-engine');
const A = require('./saju-analyze');
const D = require('./saju-deep');
const P = require('./saju-pattern');
const FT = require('./saju-fortune');
const C = require('./saju-compat');
const AD = require('./saju-advanced');
const DM = require('./saju-domain');
const IN = require('./saju-input');
const X = require('./saju-extra');
const R = require('./saju-rules');

function groupFromFinal(dayGan, finalPct) {
  const out = {};
  for (const g of R.GROUPS) out[g] = finalPct[R.groupOh(dayGan, g)];
  return out;
}

/** 심층 세력 기준 신강약 재판정.
    심층 세력은 합화·충·월령계수를 거치며 기본 레이어보다 분산이 커지므로
    임계값을 따로 쓴다. 6만건 시뮬레이션 분포(중앙값 43.3, 평균 45.1) 기준. */
function restrength(saju, gpFinal, base) {
  const allyPct = Math.round((gpFinal.비겁 + gpFinal.인성) * 10) / 10;
  let verdict, level, neutral = false;
  if (allyPct >= 62)      { verdict='신강'; level='태강'; }
  else if (allyPct >= 50) { verdict='신강'; level='신강'; }
  else if (allyPct >= 37) { verdict = allyPct >= 43 ? '신강':'신약'; level='중화'; neutral=true; }
  else if (allyPct >= 28) { verdict='신약'; level='신약'; }
  else                    { verdict='신약'; level='태약'; }
  return { ...base, allyPct, verdict, level, neutral,
    shifted: base.verdict !== verdict || base.level !== level,
    기본레이어: `${base.level}(${base.allyPct}%)`,
    심층레이어: `${level}(${allyPct}%)`,
    confidence: neutral ? '낮음' : base.verdict === verdict ? '높음' : '보통' };
}

function fullReading(rawInput) {
  const norm = IN.normalize(rawInput);
  const input = norm.input;
  const saju = E.computeSaju(input);
  const base = A.analyze(saju, input.opts || {});
  const deep = D.refinedPower(saju, base.power, base.relations);
  const gpFinal = groupFromFinal(saju.day.gan, deep.final);
  const str = restrength(saju, gpFinal, base.strength);

  // 심층 세력으로 용신 재산출
  const ys = A.yongsin(saju, { pct: deep.final }, str, input.opts || {});

  // 일간 통근
  const posNames = ['년','월','일','시'];
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const rootDay = D.tonggeun(saju.day.gan, jis, posNames);
  // 전 천간 통근
  const rootAll = [['년',saju.year.gan],['월',saju.month.gan],['일',saju.day.gan],
                   ...(saju.hour?[['시',saju.hour.gan]]:[])]
    .map(([p,g]) => ({ 자리:p, 천간:R.G[g], ...D.tonggeun(g, jis, posNames) }))
    .map(x => ({ 자리:x.자리, 천간:x.천간, 뿌리:x.verdict, 점수:x.total,
                 근거:x.roots.map(r=>`${r.pos}${r.ji}(${r.via}/${r.unseong})`).join(' ') || '없음' }));

  // 일간 무근인데 세력상 신강 → 인성 의존형. 종강격 후보로 따로 짚어준다.
  if (rootDay.verdict === '무근(無根)' && str.verdict === '신강')
    str.특이 = '일간이 지지에 뿌리가 없는데 인성 세력으로 신강하게 나온다 — ' +
               '자기 힘이 아니라 받쳐주는 힘에 기댄 구조라 종강격 여부를 함께 봐야 한다';
  if (rootDay.verdict === '무근(無根)' && str.verdict === '신약')
    str.특이 = '일간이 무근에 신약 — 억부로 버티기보다 세력을 따르는 종격을 우선 검토할 자리';

  const success = P.gyeokSuccess(saju, base.gyeokguk.name, gpFinal, str);
  const pats = P.patterns(saju, gpFinal, str);
  const yc = P.yukchin(saju, input.gender);
  const gongmang = R.gongmang(saju.day.idx).map(x => R.J[x]);
  const du = FT.daeunDeep(saju, saju.daeun.list, ys.primary.group);
  // 세운: 요청 연도 범위(기본 올해부터 10년)
  const y0 = input.saeunFrom || new Date().getFullYear();
  const birthY = input.y;
  const se = [];
  for (let y = y0; y < y0 + (input.saeunYears || 10); y++) {
    const age = Math.floor(R.ageOf(input.y, input.m, input.d, Date.UTC(y, 6, 1)));
    const cur = saju.daeun.list.filter(x => x.start <= age).pop() || null;
    se.push({ 나이: age, ...FT.saeunDeep(saju, y, ys.primary.group, cur, gongmang),
              해당대운: cur ? cur.han : null });
  }
  const wol = FT.wolun(saju, input.wolunYear || y0, ys.primary.group);
  const il  = FT.ilun(saju, input.ilunDate || Date.now(), ys.primary.group, gongmang);

  const ctx0 = { saju, base, deep, groupPower: gpFinal, strength: str, yongsin: ys,
                 통근:{일간:rootDay}, relations: base.relations, sinsal: base.sinsal,
                 gender: input.gender, 성패: success, 대운: du };
  const 궁성 = AD.gungseong(saju, input.gender);
  const 묘고 = AD.myogo(saju);
  const 일주론 = AD.iljuron(saju, input.gender);
  const 고저 = AD.gyeokLevel(ctx0);
  const 영역 = DM.natal(ctx0);
  const 영역운 = du.slice(0, 8).map((x, i) =>
    DM.byUn(ctx0, saju.daeun.list[i], `${x.시작나이}세`));
  const 시운 = X.siun(saju, input.ilunDate || Date.now(), ys.primary.group, gongmang);
  const 월운날짜 = X.wolunDates(input.wolunYear || y0);
  const 격변화 = X.gyeokShiftAnalysis(saju, saju.daeun.list, gpFinal, str,
    (sj, gn, gp2, st2) => P.gyeokSuccess(sj, gn, gp2, st2));
  const 명궁 = X.myeonggung(saju);
  const 태원 = X.taewon(saju);
  const 자식부모 = X.childParent(saju, input.gender, gpFinal, base.sinsal.list);
  wol.forEach((m, i) => { const dd = 월운날짜[i]; if (dd) { m.시작 = dd.시작; m.끝 = dd.끝; } });
  const nowAge = R.ageOf(input.y, input.m, input.d);      // 만 나이(소수)
  // 현재 대운 인덱스를 여기서 한 번만 구하고, 화면·에이전트가 모두 이 값을 쓴다
  const curIdx = Math.max(0, du.findIndex(x => x.시작나이 <= nowAge && nowAge < x.끝나이));
  const 교운 = DM.gyoun(saju.daeun.list, nowAge);
  du.forEach((x, i) => { const sf = DM.yongsinSafety(ctx0, saju.daeun.list[i]);
    if (sf && sf.작용.length) { x.용신안위 = sf.종합 || sf.작용.map(e=>e.s).join(' / '); } });

  return tidyNumbers({ 입력: { ...norm.달력, 양력: `${input.y}-${input.m}-${input.d}` +
             (input.unknownHour ? ' (시간 미상)' : ` ${String(input.hh).padStart(2,'0')}:${String(input.mi).padStart(2,'0')}`),
             음력표기: IN.lunarLabel(input.y, input.m, input.d),
             경고: norm.warnings, 안내: norm.notes,
             출생지: rawInput.city || null, 타임존: input.timezone,
             적용시차: saju.appliedZone ? `${saju.appliedZone} UTC${saju.appliedOffsetMin>=0?'+':''}${(saju.appliedOffsetMin/60).toFixed(1)}h` : null },
           saju, base, deep, groupPower: gpFinal, strength: str, yongsin: ys,
           궁성, 묘고, 일주론, 격국고저: 고저, 영역운세: 영역, 대운영역: 영역운, 교운기: 교운,
           통근: { 일간: rootDay, 전체: rootAll }, 격국: base.gyeokguk, 성패: success,
           패턴: pats, 육친: yc, 대운: du, 세운: se, 월운: wol, 일운: il,
           시운, 격변화, 명궁, 태원, 자식부모, 현재대운: curIdx,
           gongmang, gender: input.gender, birthYear: input.y,
           birth: { y: input.y, m: input.m, d: input.d },
           현재나이: nowAge, 세는나이: R.ageKor(input.y) });
}

/** 결과에 실린 소수를 정리한다.
    0.24000000000000002 같은 값이 화면과 AI 재료에 그대로 실리면 신뢰를 깎는다.
    절기 시각처럼 큰 수는 건드리지 않는다. */
function tidyNumbers(o, seen) {
  seen = seen || new WeakSet();
  if (o === null || typeof o !== 'object') return o;
  if (seen.has(o)) return o;
  seen.add(o);
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'number') {
      if (Number.isFinite(v) && !Number.isInteger(v) && Math.abs(v) < 1e4)
        o[k] = Math.round(v * 1000) / 1000;
    } else if (v && typeof v === 'object') tidyNumbers(v, seen);
  }
  return o;
}

/** 명식 8글자를 직접 받아 분석한다.
    생년월일을 모르거나(자기 사주만 아는 경우) 명식만 대조하고 싶을 때 쓴다.
    날짜가 없으므로 대운 시작 나이는 알 수 없다 — 간지만 계산하고 시작 나이는 인자로 받는다. */
function fromPillars(입력) {
  const { 년, 월, 일, 시, gender, 대운수 = 5 } = 입력;
  const parse = (s, name) => {
    if (!s) return null;
    const g = R.G.indexOf(s[0]), j = R.J.indexOf(s[1]);
    if (g < 0 || j < 0) { const e = new Error(`${name} 간지가 올바르지 않습니다: ${s}`);
      e.userMessage = e.message; throw e; }
    let idx = -1;
    for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === j) { idx = i; break; }
    if (idx < 0) { const e = new Error(`${name} ${R.josa(s, '은는')} 60갑자에 없는 조합입니다`);
      e.userMessage = e.message; throw e; }
    return { idx, gan: g, ji: j, han: R.G[g] + R.J[j], kor: R.G_KR[g] + R.J_KR[j] };
  };
  if (!gender) { const e = new Error('성별이 필요합니다'); e.userMessage = e.message; throw e; }
  const year = parse(년, '연주'), month = parse(월, '월주'),
        day = parse(일, '일주'), hour = parse(시, '시주');
  if (!year || !month || !day) { const e = new Error('연·월·일주는 반드시 필요합니다');
    e.userMessage = e.message; throw e; }

  // 대운: 년간 음양 × 성별로 방향, 월주에서 순/역행
  const yangYear = year.gan % 2 === 0;
  const forward = (yangYear && gender === 'M') || (!yangYear && gender === 'F');
  const list = [];
  for (let k = 1; k <= 10; k++) {
    const idx = ((month.idx + (forward ? k : -k)) % 60 + 60) % 60;
    list.push({ start: 대운수 + (k - 1) * 10, idx, gan: idx % 10, ji: idx % 12,
                han: R.G[idx % 10] + R.J[idx % 12] });
  }
  const saju = { year, month, day, hour,
    daeun: { forward, startAge: 대운수, daeunSu: 대운수, list },
    reckoned: '(명식 직접 입력)', shiftMin: 0, warn: null,
    input: { gender, 명식입력: true } };
  return saju;
}

/** 명식 직접 입력으로 전체 리딩 (날짜 기반과 같은 결과 구조) */
function readingFromPillars(입력) {
  const saju = fromPillars(입력);
  const base = A.analyze(saju, 입력.opts || {});
  const deep = D.refinedPower(saju, base.power, base.relations);
  const gpFinal = groupFromFinal(saju.day.gan, deep.final);
  const str = restrength(saju, gpFinal, base.strength);
  const ys = A.yongsin(saju, { pct: deep.final }, str, 입력.opts || {});
  const posNames = ['년','월','일','시'];
  const jis = [saju.year.ji, saju.month.ji, saju.day.ji, ...(saju.hour?[saju.hour.ji]:[])];
  const rootDay = D.tonggeun(saju.day.gan, jis, posNames);
  const ctx0 = { saju, base, deep, groupPower: gpFinal, strength: str, yongsin: ys,
                 통근:{일간:rootDay}, relations: base.relations, sinsal: base.sinsal,
                 gender: 입력.gender, 성패: null, 대운: [] };
  const success = P.gyeokSuccess(saju, base.gyeokguk.name, gpFinal, str);
  ctx0.성패 = success;
  const pats = P.patterns(saju, gpFinal, str);
  return {
    입력: { 명식: [saju.year, saju.month, saju.day, saju.hour].filter(Boolean)
             .map(p => p.han).join(' '), 방식: '명식 직접 입력',
           안내: ['생년월일이 없어 대운 시작 나이·세운·절기 기준은 계산할 수 없습니다'], 경고: [] },
    saju, base, deep, groupPower: gpFinal, strength: str, yongsin: ys,
    통근: { 일간: rootDay }, 격국: base.gyeokguk, 성패: success, 패턴: pats,
    궁성: AD.gungseong(saju, 입력.gender), 묘고: AD.myogo(saju),
    일주론: AD.iljuron(saju, 입력.gender),
    격국고저: AD.gyeokLevel({ ...ctx0, 대운: null }),
    영역운세: DM.natal(ctx0),
    자식부모: X.childParent(saju, 입력.gender, gpFinal, base.sinsal.list),
    명궁: X.myeonggung(saju), 태원: X.taewon(saju),
    대운: FT.daeunDeep(saju, saju.daeun.list, ys.primary.group),
    gender: 입력.gender,
  };
}

/** 명식으로 보는 궁합. 날짜가 없으므로 운의 동조·결혼 적기는 빼고 관계 구조만 본다. */
function matchFromPillars(A, B, opts = {}) {
  const a = readingFromPillars(A), b = readingFromPillars(B);
  a.gongmang = R.gongmang(a.saju.day.idx).map(x => R.J[x]);
  b.gongmang = R.gongmang(b.saju.day.idx).map(x => R.J[x]);
  const res = C.compatibilityFull(a, b, opts);
  return tidyNumbers({ A: a, B: b, 궁합: res,
    안내: '명식만으로 본 결과입니다. 생년월일이 없어 함께 보는 해와 결혼 적기는 계산하지 않았습니다' });
}

/** 두 사람 궁합 */
function matchmaking(inputA, inputB, opts = {}) {
  const a = fullReading(inputA), b = fullReading(inputB);
  const res = C.compatibilityFull(a, b, opts);
  const sync = C.unSync(a, b, opts.fromYear || new Date().getFullYear(), opts.years || 10);
  const 결혼적기 = { A: C.deep.marriageTiming(a, opts.fromYear || new Date().getFullYear(), opts.years2 || 15),
                     B: C.deep.marriageTiming(b, opts.fromYear || new Date().getFullYear(), opts.years2 || 15) };
  return tidyNumbers({ A: a, B: b, 궁합: res, 운의동조: sync, 결혼적기 });
}

module.exports = { fullReading, readingFromPillars, fromPillars, matchmaking, matchFromPillars, restrength, groupFromFinal };

return module.exports; })();

/* ===== tarot-data.js ===== */
__mods["tarot-data"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   tarot-data.js — 라이더·웨이트·스미스 78장
   그림은 1909년 초판(Pamela Colman Smith)이라 퍼블릭 도메인이다.
   이미지는 Wikimedia Special:FilePath 로 파일명만으로 불러온다.
   ============================================================= */

const TAROT_IMG = name =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=420`;

/* 메이저 아르카나 22 — [번호, 한글, 영문, 파일명, 정방향, 역방향] */
const MAJOR = [
  [0,'바보','The Fool','RWS_Tarot_00_Fool.jpg','시작, 순수, 뛰어듦, 정해지지 않은 가능성','무모함, 준비 부족, 발을 헛디딤'],
  [1,'마법사','The Magician','RWS_Tarot_01_Magician.jpg','의지, 재능을 쓸 때, 수단이 갖춰짐','재능 낭비, 속임수, 빈 말'],
  [2,'여사제','The High Priestess','RWS_Tarot_02_High_Priestess.jpg','직관, 아직 드러나지 않은 것, 침묵의 지혜','비밀이 새어나감, 직관 무시, 겉도는 앎'],
  [3,'여황제','The Empress','RWS_Tarot_03_Empress.jpg','풍요, 돌봄, 결실, 감각적 만족','과보호, 무기력, 결실이 늦어짐'],
  [4,'황제','The Emperor','RWS_Tarot_04_Emperor.jpg','질서, 권위, 구조를 세움, 책임','경직, 통제욕, 권위와의 충돌'],
  [5,'교황','The Hierophant','RWS_Tarot_05_Hierophant.jpg','전통, 배움, 제도 안에서의 인정','형식주의, 관습에 갇힘, 이탈'],
  [6,'연인','The Lovers','RWS_Tarot_06_Lovers.jpg','결합, 선택, 가치가 맞는 상대','망설임, 어긋난 선택, 유혹'],
  [7,'전차','The Chariot','RWS_Tarot_07_Chariot.jpg','추진, 돌파, 상반된 힘을 몰아감','폭주, 방향 상실, 제동 실패'],
  [8,'힘','Strength','RWS_Tarot_08_Strength.jpg','부드러운 통제, 인내, 감정을 다스림','자제력 상실, 자신 없음, 억누름'],
  [9,'은둔자','The Hermit','RWS_Tarot_09_Hermit.jpg','성찰, 혼자 걷는 시간, 안을 비추는 등불','고립, 회피, 지나친 칩거'],
  [10,'운명의 수레바퀴','Wheel of Fortune','RWS_Tarot_10_Wheel_of_Fortune.jpg','전환점, 흐름이 바뀜, 때가 옴','반복되는 패턴, 때를 놓침, 기복'],
  [11,'정의','Justice','RWS_Tarot_11_Justice.jpg','균형, 인과, 공정한 판단','편향, 책임 회피, 기울어진 저울'],
  [12,'매달린 사람','The Hanged Man','RWS_Tarot_12_Hanged_Man.jpg','멈춤, 관점의 전환, 자발적 기다림','헛된 희생, 정체, 놓지 못함'],
  [13,'죽음','Death','RWS_Tarot_13_Death.jpg','끝맺음, 탈바꿈, 다음으로 넘어감','매달림, 변화 거부, 지연된 정리'],
  [14,'절제','Temperance','RWS_Tarot_14_Temperance.jpg','조율, 중용, 섞어서 새로 만듦','불균형, 과잉, 조급함'],
  [15,'악마','The Devil','RWS_Tarot_15_Devil.jpg','집착, 묶인 관계, 물질과 욕망','속박을 끊음, 자각, 해방의 시작'],
  [16,'탑','The Tower','RWS_Tarot_16_Tower.jpg','갑작스러운 붕괴, 드러난 진실, 판이 바뀜','붕괴를 미룸, 내부의 균열, 피해 최소화'],
  [17,'별','The Star','RWS_Tarot_17_Star.jpg','희망, 회복, 조용한 치유','자신감 저하, 기대 상실, 흐려진 방향'],
  [18,'달','The Moon','RWS_Tarot_18_Moon.jpg','불확실, 불안, 드러나지 않은 것','혼란이 걷힘, 오해 해소, 진실 노출'],
  [19,'태양','The Sun','RWS_Tarot_19_Sun.jpg','명료함, 성취, 드러내놓는 기쁨','들뜸, 지연된 성과, 과시'],
  [20,'심판','Judgement','RWS_Tarot_20_Judgement.jpg','부름, 결산, 다시 일어섬','자기 비판, 미룬 결정, 과거에 묶임'],
  [21,'세계','The World','RWS_Tarot_21_World.jpg','완성, 매듭, 한 바퀴를 돎','미완, 마무리 지연, 다음 단계 유예'],
];

/* 마이너 아르카나 — 수트별 성격 */
const SUITS = [
  { key:'Wands', 한글:'완드', 원소:'불', 영역:'일, 의욕, 추진' },
  { key:'Cups',  한글:'컵',   원소:'물', 영역:'감정, 관계, 마음' },
  { key:'Swords',한글:'검',   원소:'공기', 영역:'생각, 갈등, 말' },
  { key:'Pents', 한글:'펜타클', 원소:'흙', 영역:'돈, 몸, 현실' },
];
const RANKS = ['에이스','2','3','4','5','6','7','8','9','10','페이지','나이트','퀸','킹'];

/* 숫자별 기본 뜻 × 수트 영역으로 조합 */
/* 수트 표현과 이어 붙였을 때 한 문장이 되도록 서술형으로 쓴다.
   명사만 나열하면 "추진이 헛돌아 과보호, 감정 소모, 통제"처럼 문장이 깨진다. */
const NUM_MEAN = {
  '에이스':['새로운 것이 시작되고 씨앗이 주어진다','기회를 놓치거나 시작이 자꾸 미뤄진다'],
  '2':['균형을 잡고 두 갈래 앞에 선다','저울이 한쪽으로 기울고 결정을 미룬다'],
  '3':['손을 맞잡고 첫 결실을 본다','엇박자가 나고 결실이 흩어진다'],
  '4':['자리를 잡고 안정을 얻는다','한자리에 굳어 정체된다'],
  '5':['갈등과 결핍을 겪으며 시험을 치른다','갈등에서 빠져나와 회복할 조짐이 보인다'],
  '6':['주고받으며 조화를 이루고 회복한다','관계가 한쪽으로 기울거나 과거에 머문다'],
  '7':['버티며 선택을 앞두고 시험받는다','흔들리거나 스스로를 속이며 포기한다'],
  '8':['빠르게 진행되고 손에 익는다','흐름이 막히고 자꾸 지체된다'],
  '9':['거의 다 와서 자족하거나 불안해한다','과부하로 소진되고 외로워진다'],
  '10':['완결에 이르지만 짐의 무게가 따른다','같은 일이 되풀이되고 마무리가 미뤄진다'],
  '페이지':['배우고 소식을 받으며 서툰 첫걸음을 뗀다','산만해지고 미숙하게 처신한다'],
  '나이트':['앞으로 돌진하며 밀어붙인다','성급하게 굴다 방향을 잃고 멈춘다'],
  '퀸':['성숙하게 다루고 품어낸다','지나치게 감싸거나 통제하며 감정을 소모한다'],
  '킹':['책임을 지고 완숙하게 주도한다','독단으로 흐르고 권위를 잘못 쓴다'],
};
/* 수트는 '어느 영역인가'이지 길흉이 아니다. 방향별로 다른 톤을 붙이면
   역방향 뜻이 긍정인 카드(5·7번)에서 "추진이 헛돌며 회복할 조짐이 보인다"처럼
   앞뒤가 충돌한다. 그래서 영역 표시 하나로 통일한다. */
const SUIT_TONE = {
  Wands:'일과 의욕에서', Cups:'마음과 관계에서',
  Swords:'생각과 말에서', Pents:'돈과 현실에서',
};

function buildDeck() {
  const deck = [];
  for (const [num, ko, en, file, up, rev] of MAJOR)
    deck.push({ id:`major-${num}`, 그룹:'메이저', 번호:num, 한글:ko, 영문:en,
                파일:file, 정방향:up, 역방향:rev });
  for (const s of SUITS)
    RANKS.forEach((r, i) => {
      const n = String(i + 1).padStart(2, '0');
      const [up, rev] = NUM_MEAN[r];
      deck.push({
        id:`${s.key.toLowerCase()}-${i+1}`, 그룹:'마이너', 수트:s.한글, 원소:s.원소,
        번호:i+1, 한글:`${s.한글} ${r}`, 영문:`${r} of ${s.key}`,
        파일:`${s.key}${n}.jpg`,
        정방향:`${SUIT_TONE[s.key]} ${up}`,
        역방향:`${SUIT_TONE[s.key]} ${rev}`,
        영역:s.영역,
      });
    });
  return deck;
}

/* 스프레드 */
const SPREADS = {
  원카드: { 이름:'한 장', 장수:1, 설명:'지금 이 순간에 대한 한마디',
    자리:[{ 이름:'지금', 뜻:'현재 상황의 핵심' }] },
  쓰리카드: { 이름:'세 장', 장수:3, 설명:'흐름을 과거·현재·미래로 본다',
    자리:[{ 이름:'지나온 것', 뜻:'지금에 영향을 준 배경' },
          { 이름:'지금', 뜻:'현재의 핵심' },
          { 이름:'다가올 것', 뜻:'이대로 갔을 때의 방향' }] },
  관계: { 이름:'관계', 장수:5, 설명:'두 사람 사이를 다섯 자리로 본다',
    자리:[{ 이름:'나', 뜻:'내가 이 관계에 두고 있는 것' },
          { 이름:'상대', 뜻:'상대가 두고 있는 것' },
          { 이름:'둘 사이', 뜻:'관계의 현재 상태' },
          { 이름:'걸림돌', 뜻:'막고 있는 것' },
          { 이름:'흐름', 뜻:'이대로 갔을 때' }] },
  이달: { 이름:'이달의 운세', 장수:3, 기간:'month', 설명:'이번 달을 세 장으로 나눠 본다',
    자리:[{ 이름:'초순', 뜻:'달의 앞부분 흐름' },
          { 이름:'중순', 뜻:'한가운데서 벌어지는 일' },
          { 이름:'하순', 뜻:'달을 마무리하는 결' }] },
  분기: { 이름:'올해 네 계절', 장수:4, 기간:'year', 설명:'한 해를 분기로 나눠 본다',
    자리:[{ 이름:'1~3월', 뜻:'해의 시작' }, { 이름:'4~6월', 뜻:'뻗어나가는 때' },
          { 이름:'7~9월', 뜻:'무르익는 때' }, { 이름:'10~12월', 뜻:'거두는 때' }] },
  열두달: { 이름:'열두 달', 장수:12, 기간:'year', 설명:'한 해를 달마다 한 장씩 본다',
    자리: Array.from({ length: 12 }, (_, i) => ({ 이름: (i+1)+'월', 뜻: (i+1)+'월의 결' })) },
  주제: { 이름:'한 가지 주제', 장수:4, 설명:'궁금한 것 하나를 네 자리로 파고든다',
    자리:[{ 이름:'지금 상황', 뜻:'그 일이 놓인 자리' },
          { 이름:'감춰진 것', 뜻:'내가 놓치고 있는 것' },
          { 이름:'해야 할 일', 뜻:'움직인다면 어느 쪽으로' },
          { 이름:'그 결과', 뜻:'그렇게 갔을 때' }] },
  켈틱크로스: { 이름:'켈틱 크로스', 장수:10, 설명:'가장 자세히 보는 전통 배열',
    자리:[{ 이름:'현재', 뜻:'지금의 핵심' }, { 이름:'장애', 뜻:'가로놓인 것' },
          { 이름:'뿌리', 뜻:'바탕에 깔린 것' }, { 이름:'지나간 일', 뜻:'막 지나간 영향' },
          { 이름:'의식', 뜻:'내가 바라는 것' }, { 이름:'곧 올 것', 뜻:'가까운 미래' },
          { 이름:'나의 태도', 뜻:'내가 취하는 자세' }, { 이름:'주변', 뜻:'환경과 타인' },
          { 이름:'희망과 두려움', 뜻:'속마음' }, { 이름:'결과', 뜻:'흐름의 끝' }] },
};

/* 암호학적 난수로 섞는다. Math.random 은 예측 가능해서 "뽑았다"는 느낌이 약하다. */
function shuffle(deck) {
  const a = deck.slice();
  const rnd = n => {
    const buf = new Uint32Array(1);
    const max = Math.floor(0xFFFFFFFF / n) * n;
    let v; do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= max);
    return v % n;
  };
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function draw(deck, n) {
  return shuffle(deck).slice(0, n).map(c => ({ ...c, 역방향여부: (crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 1 }));
}

if (typeof module !== 'undefined') module.exports = { MAJOR, SUITS, RANKS, buildDeck, SPREADS, shuffle, draw, TAROT_IMG };

return module.exports; })();

/* ===== saju-agents.js ===== */
__mods["saju-agents"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-agents.js — 멀티에이전트 정의
   설계 원칙
   1) 계산은 AI가 하지 않는다. 간지·격국·용신·합충은 전부 결정론 엔진이 이미 냈고,
      에이전트는 그 재료를 "읽고 말하는" 일만 한다. AI에게 사주를 계산시키면 틀린다.
   2) 모든 에이전트는 근거 글자를 반드시 달고 말한다. 근거 없는 문장은 검증에서 잘린다.
   3) 나쁜 판정은 숨기지 않는다. 대신 반드시 대응책과 함께 낸다.
   ============================================================= */

/* ---------- 공통 규칙 (모든 에이전트 시스템 프롬프트에 주입) ---------- */
const COMMON_RULES = `
[절대 규칙]
1. 제공된 JSON 재료 밖의 사실을 만들어내지 마라. 간지·십성·합충·점수를 새로 계산하지 마라.
   재료에 없으면 "재료에 없음"이라고 하고 넘어가라.
2. 모든 주장에는 근거를 단다. 근거는 원국의 글자, 십성, 합충, 세력 수치 중 하나여야 한다.
   예: "월지 戌의 식신이 시간 辛 정재를 생한다" (O) / "재물운이 좋다" (X)
3. 단정하지 마라. "~하게 된다"가 아니라 "~한 경향이 있다", "~하기 쉽다"로 쓴다.
   명리는 확률적 경향을 읽는 것이지 미래를 확정하는 것이 아니다.
4. 겁을 주지 마라. 흉한 판정도 사실대로 전하되, 반드시 "그래서 무엇을 할 수 있는가"를 붙인다.
   대응책 없는 흉조 서술은 금지다.
5. 건강은 의학적 진단이 아니다. 증상·질병명을 확정하지 말고 "그 계통이 약점이 되기 쉽다"까지만 쓴다.
   반드시 병원 확인을 권한다.
6. 죽음, 사고, 이혼, 파산 같은 극단적 사건을 예언하지 마라. 어떤 재료가 나와도 하지 않는다.
7. 상담자가 이미 한 선택(결혼, 이직, 투자)을 후회하게 만드는 서술을 하지 마라.
   지난 일은 평가하지 말고 앞으로 쓸 수 있는 것만 말한다.
8. 문체: 존댓말, 담백하게. 과장된 미사여구와 이모지를 쓰지 마라.
   "엄청난", "최고의", "반드시" 같은 말 대신 구체적인 근거로 무게를 만든다.
`.trim();

/* ---------- 출력 스키마 ---------- */
const S = {
  finding: `{ "제목": string, "내용": string, "근거": string[], "강도": "강"|"중"|"약" }`,
  action:  `{ "제안": string, "이유": string, "시기": string|null }`,
};

/* ---------- 에이전트 정의 ----------
   wave: 실행 차수 (같은 wave는 병렬). needs: 앞 wave 결과 참조 키
   pick: 전체 reading에서 이 에이전트에게 줄 재료만 잘라내는 함수            */
const AGENTS = [
  /* ===== Wave 1 — 원국 (병렬 6) ===== */
  {
    id: 'myeongsik', name: '명식 분석가', wave: 1, mode: 'natal',
    role: '격국·용신·강약·통근을 종합해 이 사주의 뼈대가 무엇인지 한 문단으로 정리한다.',
    prompt: `당신은 명식의 구조만 보는 분석가입니다. 성격이나 운세는 다루지 않습니다.
다음을 순서대로 판단하세요.
- 이 사람이 신강인지 신약인지, 그 판단이 얼마나 확실한지(중화 구간이면 확실하지 않다고 말할 것)
- 일간이 어디에 뿌리를 두고 있는지(통근), 뿌리가 없으면 그것이 무엇을 뜻하는지
- 격국이 무엇이고 성립했는지 깨졌는지, 상신이 무엇인지
- 용신이 무엇이고 원국에서 힘이 있는지 없는지
- 격의 고저(그릇 크기) — 이것은 길흉이 아니라 크기임을 분명히 할 것
출력: { "요약": string(3~4문장), "핵심": finding[], "불확실한점": string[] }`,
    pick: r => ({ 강약: r.strength, 통근: r.통근, 격국: r.격국, 성패: r.성패,
                  용신: r.yongsin, 고저: r.격국고저, 세력: r.deep.table, 십성세력: r.groupPower }),
  },
  {
    id: 'seongjeong', name: '성정 분석가', wave: 1, mode: 'natal',
    role: '십성 분포·일주·십이운성·신살에서 기질과 행동 패턴을 읽는다.',
    prompt: `당신은 기질만 보는 분석가입니다. 운세나 재물은 다루지 않습니다.
- 어느 십성이 두드러지는지, 그것이 평소 어떤 행동으로 나타나는지
- 일주(일간+일지)가 말해주는 가장 가까운 자리의 기질
- 십이운성이 말해주는 에너지의 결
- 십성 조합(식신제살, 상관패인 등)이 성격에 어떻게 드러나는지
- 장점과 함께 그 장점이 과할 때의 그림자도 반드시 쓸 것. 칭찬만 하지 마세요.
출력: { "요약": string, "강점": finding[], "그림자": finding[], "행동패턴": string[] }`,
    pick: r => ({ 십성세력: r.groupPower, 일주론: r.일주론, 원국: r.base.chart,
                  조합: r.패턴, 신살: r.base.sinsal, 강약: r.strength.level,
                  // 성격의 큰 틀은 격국에서 나온다. 없으면 일주론만으로 성정을 말하게 된다
                  격국: { 이름: r.격국.name, 별칭: r.격국.별칭, 성패: r.성패.판정 },
                  명궁: r.명궁 && r.명궁.가능 ? r.명궁 : null }),
  },
  {
    id: 'jaemul', name: '재물 분석가', wave: 1, mode: 'natal',
    role: '재성·식상·비겁의 관계로 돈이 들어오고 나가는 구조를 본다.',
    prompt: `당신은 재물 구조만 봅니다.
- 재물이 어떤 경로로 들어오는 구조인지 (식상생재인지, 재생관인지, 비겁쟁재인지)
- 정재형인지 편재형인지 — 고정 수입이 맞는지 변동 수입이 맞는지
- 신강/신약이 재를 감당하는지. 재다신약이면 반드시 지적할 것
- 재성의 창고(묘고)가 있는지, 열렸는지 닫혔는지
- 투자·사업·직장 중 어느 쪽 구조에 가까운지
금액·수익률·구체적 종목을 말하지 마세요. 구조만 말합니다.
출력: { "요약": string, "구조": finding[], "주의": finding[], "실행제안": action[] }`,
    pick: r => ({ 영역: r.영역운세.재물, 십성세력: r.groupPower, 조합: r.패턴,
                  묘고: r.묘고, 강약: r.strength, 용신: r.yongsin.primary }),
  },
  {
    id: 'jigeop', name: '직업·명예 분석가', wave: 1, mode: 'natal',
    role: '관성·인성·식상의 배치로 일하는 방식과 맞는 직역을 본다.',
    prompt: `당신은 직업 구조만 봅니다.
- 정관형(조직·규범)인지 편관형(현장·압박)인지 식상형(표현·창작)인지
- 관인상생인지, 상관견관인지, 식신제살인지 — 조합에 따라 맞는 자리가 다릅니다
- 조직 생활이 맞는지 독립이 맞는지
- 격국과 용신이 직업 선택에 주는 방향
특정 회사·직책을 지정하지 말고 직역의 성격으로 말하세요.
출력: { "요약": string, "적성": finding[], "피할구조": finding[], "실행제안": action[] }`,
    pick: r => ({ 영역: r.영역운세['직업·명예'], 십성세력: r.groupPower, 격국: r.격국,
                  성패: r.성패, 조합: r.패턴, 용신: r.yongsin.primary, 궁위: r.궁성.궁,
                  // 대운에서 격이 바뀌는 구간은 직업 전환기와 겹친다
                  격변화: r.격변화 }),
  },
  {
    id: 'aejeong', name: '애정·관계 분석가', wave: 1, mode: 'natal',
    role: '배우자궁·배우자성·궁성론으로 관계의 형태를 본다.',
    prompt: `당신은 관계 구조만 봅니다.
- 배우자궁(일지)에 무엇이 앉았는지, 그것이 관계에서 어떻게 나타나는지
- 배우자성이 원국에 있는지 없는지, 궁과 성이 일치하는지 분리되었는지
- 배우자성이 과다하면 그 뜻을 조심스럽게 쓸 것. 바람·불륜 같은 단정은 금지입니다
- 도화·홍염이 있으면 "사람을 끄는 힘"으로 중립적으로 서술
결혼 여부나 이혼을 예언하지 마세요. 관계에서 무엇을 조심하고 무엇을 살리면 되는지만 씁니다.
출력: { "요약": string, "관계형태": finding[], "주의": finding[], "실행제안": action[] }`,
    pick: r => ({ 영역: r.영역운세['애정·결혼'], 궁성: r.궁성.배우자, 일주론: r.일주론,
                  일지: r.base.chart[2], 신살: r.base.sinsal, 성별: r.gender }),
  },
  {
    id: 'geongang', name: '건강 분석가', wave: 1, mode: 'natal',
    role: '오행 균형과 충·형으로 약한 계통을 짚는다.',
    prompt: `당신은 건강 구조만 봅니다. 의사가 아닙니다.
- 비어 있거나 과한 오행이 어느 계통과 연결되는지
- 충·형이 걸린 자리가 무엇을 뜻하는지
- 신강/신약이 체력의 결에 주는 영향
반드시 지킬 것:
- 질병명을 확정하지 마세요. "그 계통이 약점이 되기 쉽다"까지만 씁니다.
- 수명, 중병, 사고를 언급하지 마세요.
- 마지막에 "명리 해석일 뿐 진단이 아니며 증상이 있으면 병원에서 확인하라"고 반드시 씁니다.
출력: { "요약": string, "약한계통": finding[], "생활제안": action[], "면책": string }`,
    pick: r => ({ 영역: r.영역운세.건강, 세력: r.deep.table, 관계: r.base.relations, 강약: r.strength,
                  // 조후는 몸의 한열을 보는 자리라 건강 해석에 직접 쓰인다
                  조후: { 한난: r.yongsin.johu.tone, 조습: r.yongsin.johu.moisture,
                          온도: r.yongsin.johu.온도, 습도: r.yongsin.johu.습도,
                          필요: r.yongsin.johu.needed },
                  빈오행: r.deep.table.filter(t => t.최종 <= 3).map(t => t.오행) }),
  },

  /* ===== Wave 2 — 시간축 (병렬 3, 명식 결과 참조) ===== */
  {
    id: 'daeun', name: '대운 분석가', wave: 2, mode: 'natal', needs: ['myeongsik'],
    role: '10년 단위 큰 흐름을 국면으로 나눈다.',
    prompt: `당신은 대운만 봅니다. 명식 분석가의 결론(용신·격국)을 전제로 받으세요.
- 각 대운이 용신 방향인지 기신 방향인지
- 개두·절각이 걸린 대운은 "좋아도 절반만" 또는 "나빠도 덜하다"로 조정해 읽을 것
- 전반 5년(천간)과 후반 5년(지지)이 갈리는 대운은 나눠서 설명
- 원국을 충하거나 합하는 대운, 특히 제강충(월지 충)은 판이 바뀌는 시기로 짚을 것
- 용신이 운에서 상하는 구간(용신 피상)은 반드시 언급
지나간 대운은 평가하지 말고, 현재와 앞으로만 자세히 다루세요.
출력: { "요약": string, "국면": [{ "구간": string, "제목": string, "내용": string, "근거": string[] }], "전환점": finding[] }`,
    // 재료를 통째로 주면 토큰이 폭발한다(실측 4.3k). 지나간 대운은 해석 대상이 아니므로
    // 현재 대운 기준 앞뒤만 잘라 넣고, 각 대운도 필요한 필드만 남긴다.
    pick: r => {
      const age = r.현재나이;
      const idx = r.현재대운 != null ? r.현재대운
        : Math.max(0, r.대운.findIndex(d => d.시작나이 <= age && age < d.끝나이));
      const slim = d => ({ 나이: `${d.시작나이}~${d.끝나이}`, 간지: d.간지,
        전반: `${d.전반5년.주도} ${d.전반5년.십성}/${d.전반5년.평가}`,
        후반: `${d.후반5년.주도} ${d.후반5년.십성}/${d.후반5년.평가}(${d.후반5년.십이운성})`,
        간지관계: d.간지관계.type, 작용: d.원국작용, 격국변화: d.격국변화,
        용신안위: d.용신안위 || null, 종합: d.종합 });
      return { 현재나이: age, 용신: r.yongsin.primary.group,
        지난대운: r.대운.slice(0, idx).map(d => `${d.시작나이}세 ${d.간지} ${d.종합}`),
        현재부터: r.대운.slice(idx, idx + 5).map(slim),
        현재대운영역: r.대운영역[idx] ? r.대운영역[idx].영역 : null,
        교운기: r.교운기.해당 ? r.교운기 : null, 격변화: r.격변화 };
    },
  },
  {
    id: 'seun', name: '세운 분석가', wave: 2, mode: 'natal', needs: ['myeongsik'],
    role: '올해부터 3~5년의 단기 흐름과 월별 리듬을 본다.',
    prompt: `당신은 단기 운만 봅니다.
- 올해와 다음 몇 해가 각각 어떤 성격의 해인지
- 대운과 세운이 어긋나는 해(천충지충, 복음)는 따로 짚을 것
- 삼재가 걸린 해는 언급하되, 띠 한 글자로 보는 통속 관법이라 원국 용신과 어긋나면
  그쪽을 우선한다고 반드시 덧붙일 것
- 월운에서 특히 좋은 달과 조심할 달 몇 개만 골라 제시
"올해 대박" 같은 말은 쓰지 마세요.
출력: { "요약": string, "연도별": [{ "연도": number, "성격": string, "내용": string, "근거": string[] }], "월리듬": string }`,
    pick: r => ({ 용신: r.yongsin.primary.group,
      세운: r.세운.slice(0, 5).map(s => ({ 연도: s.연도, 나이: s.나이, 간지: s.간지,
        천간: `${s.천간.글자} ${s.천간.십성}/${s.천간.평가}`,
        지지: `${s.지지.글자} ${s.지지.십성}/${s.지지.평가}`,
        간지관계: s.간지관계, 작용: s.원국작용, 삼재: s.삼재 ? s.삼재.단계 : null, 종합: s.종합 })),
      월운요약: r.월운.map(m => `${m.월차}월(${m.절기시작} ${m.시작 ? m.시작.slice(5,10) : ''}) ${m.간지} ${m.종합}`),
      시운: r.시운 ? { 좋은시간: r.시운.좋은시간, 조심할시간: r.시운.조심할시간 } : null }),
  },
  {
    id: 'jeollyak', name: '시기 전략가', wave: 2, mode: 'natal', needs: ['myeongsik'],
    role: '영역별 강약과 운의 흐름을 겹쳐 "언제 무엇을" 하면 좋은지로 바꾼다.',
    prompt: `당신은 판정을 실행 계획으로 바꾸는 역할입니다. 새로운 해석을 하지 말고,
이미 나온 판정을 "그래서 무엇을 언제"로 옮기세요.
- 원국이 약한 영역은 운에서 보완되는 시기를 찾아 그때 움직이라고 안내
- 원국이 강한 영역은 지금 밀어야 할 것으로 안내
- 각 제안에는 왜 그 시기인지 근거를 답니다
운에 기대 아무것도 하지 말라는 식의 수동적 조언은 금지입니다.
출력: { "요약": string, "지금할것": action[], "기다릴것": action[], "피할시기": action[] }`,
    pick: r => {
      const age = r.현재나이;
      const idx = r.현재대운 != null ? r.현재대운
        : Math.max(0, r.대운.findIndex(d => d.시작나이 <= age && age < d.끝나이));
      const dom = {};
      for (const [k, v] of Object.entries(r.영역운세)) dom[k] = { 등급: v.등급, 메모: v.메모 };
      return { 원국영역: dom, 용신: r.yongsin.primary.group,
        현재대운영역: r.대운영역[idx] ? r.대운영역[idx] : null,
        다음대운영역: r.대운영역[idx+1] ? r.대운영역[idx+1] : null,
        향후세운: r.세운.slice(0, 5).map(s => `${s.연도} ${s.간지} ${s.종합}`),
        교운기: r.교운기.해당 ? r.교운기 : null,
        격변화: r.격변화, 현재나이: r.현재나이 };
    },
  },

  /* ===== Wave 3 — 궁합 (병렬 3, 궁합 모드에서만) ===== */
  {
    id: 'gung_a', name: '궁합 A입장', wave: 3, mode: 'compat',
    role: 'A가 이 관계에서 무엇을 얻고 무엇을 내주는지를 A의 시선으로 쓴다.',
    prompt: `당신은 A의 입장에서만 이 관계를 봅니다. B를 평가하지 말고,
A가 이 관계에서 겪을 일만 씁니다.
- A의 용신을 B가 채워주는지, 아니면 A의 기신을 B가 얹는지 — 이것이 핵심입니다
- A의 일간·일지가 B와 어떻게 만나는지
- A에게 B가 어떤 십성인지, A가 그것을 감당할 힘이 있는지
점수가 낮게 나왔다면 낮은 이유를 정확히 쓰되, A가 할 수 있는 일을 반드시 함께 씁니다.
출력: { "요약": string, "얻는것": finding[], "내주는것": finding[], "A가할일": action[] }`,
    pick: (r, m) => ({ 관계: m.궁합.관계종류, 점수: m.궁합.A입장, 용신상보: m.궁합.용신상보.A가받는것,
                       십성: m.궁합.십성관계.A기준, 일간: m.궁합.속궁합.일간,
                       일지: m.궁합.속궁합.일지, A강약: r.A.strength, A용신: r.A.yongsin.primary }),
  },
  {
    id: 'gung_b', name: '궁합 B입장', wave: 3, mode: 'compat',
    role: 'B가 이 관계에서 무엇을 얻고 무엇을 내주는지를 B의 시선으로 쓴다.',
    prompt: `당신은 B의 입장에서만 이 관계를 봅니다. (A입장 에이전트와 같은 지침)
출력: { "요약": string, "얻는것": finding[], "내주는것": finding[], "B가할일": action[] }`,
    pick: (r, m) => ({ 관계: m.궁합.관계종류, 점수: m.궁합.B입장, 용신상보: m.궁합.용신상보.B가받는것,
                       십성: m.궁합.십성관계.B기준, 일간: m.궁합.속궁합.일간,
                       일지: m.궁합.속궁합.일지, B강약: r.B.strength, B용신: r.B.yongsin.primary }),
  },
  {
    id: 'gwangye', name: '관계 역학가', wave: 3, mode: 'compat',
    role: '두 사람 사이에서 실제로 벌어지는 역학을 층별로 읽는다.',
    prompt: `당신은 관계의 역학을 봅니다. 점수를 반복하지 말고 구조를 설명하세요.
- 궁위별로 어느 층에서 맞고 어느 층에서 어긋나는지 (집안 / 가치관 / 본인 / 자식·노후)
- 관계 유형이 무엇이며 그 유형의 전형적인 함정이 무엇인지
- 두 사람이 만나야 완성되는 합국이 있으면 그것이 무엇을 뜻하는지
- 충이 있어도 합이 함께 있으면 그 차이를 분명히 설명할 것
"헤어진다", "결혼하면 안 된다" 같은 말은 절대 쓰지 마세요. 판결이 아니라 사용설명서입니다.
출력: { "요약": string, "층별": finding[], "함정": finding[], "관계전략": action[] }`,
    pick: (r, m) => ({ 유형: m.궁합.관계유형, 관계종류: m.궁합.관계종류.종류,
                       궁위별: m.궁합.궁위별.map(g => ({ 주:g.주, 뜻:g.뜻, A:g.A, B:g.B,
                         작용:g.작용, 점수:g.점수, 해설:g.해설 })),
                       매트릭스요약: m.궁합.전체매트릭스.요약,
                       매트릭스: [...m.궁합.전체매트릭스.천간, ...m.궁합.전체매트릭스.지지]
                         .map(x => `${x.A}↔${x.B} ${x.관계}`),
                       합국: m.궁합.전체매트릭스.합국,
                       리스크: m.궁합.인연리스크.항목, 조후강약: m.궁합.조후강약.항목,
                       운동조: { 같이좋은해: m.운의동조.같이좋은해, 같이주의: m.운의동조.같이주의할해 },
                       결혼적기: { A: m.결혼적기.A.후보.slice(0,3), B: m.결혼적기.B.후보.slice(0,3) } }),
  },

  /* ===== 타로 (별도 모드) ===== */
  {
    id: 'tarot_read', name: '타로 리더', wave: 1, mode: 'tarot',
    role: '뽑힌 카드를 자리의 뜻에 맞춰 읽는다.',
    prompt: `당신은 타로를 읽습니다. 명리(사주)는 다루지 않습니다.
- 카드마다 그 카드가 놓인 '자리'의 뜻과 묶어서 읽으세요. 같은 카드도 자리가 다르면 뜻이 달라집니다.
- 역방향은 반대가 아니라 '막혀 있거나 안으로 향한 상태'로 읽습니다.
- 질문이 주어졌다면 그 질문에 답하는 방향으로 읽으세요.
- 아직 뒤집지 않은 카드는 읽지 말고 건너뛰세요.
- 카드 그림에 대한 일반 설명을 늘어놓지 말고, 이 자리에서 무엇을 뜻하는지만 쓰세요.
- 질문이 주어지지 않았다면 특정 주제로 단정하지 마세요. 이것은 지키기 어려운 지시라
  특히 주의해야 합니다. '연애에서', '관계 속에서', '상대방과' 같은 말을 쓰는 순간
  질문하지 않은 주제를 밀어넣는 것이 됩니다.
  · 수트가 컵이라고 질문이 연애인 것이 아니고, 펜타클이라고 돈 문제인 것도 아닙니다.
    수트는 그 카드가 다루는 결일 뿐입니다.
  · 주제를 모를 때 쓸 말: '지금 마음이 쏠려 있는 일', '요즘 붙들고 있는 것', '이 일'
  · 사람을 가리킬 때도 '상대방'이 아니라 '관련된 사람'처럼 열어두세요.
- 재료의 '날짜'에 오늘이 적혀 있습니다. 이미 지난 달이나 연도를 제안하지 마세요.
- 기간 스프레드(이달의 운세·네 계절·열두 달)가 아니라면 특정 월을 못 박지 마세요.
  '세 장'은 흐름을 보는 배열이지 달력이 아닙니다.
[결론을 내세요 — 가장 중요]
타로는 지금 이 질문에 답을 주는 도구입니다. 양쪽을 다 말하고 끝내면 보나 마나입니다.
실측으로 "어느 쪽이든 선택하려면", "그 선택이 얼마나 신중한지가 결과를 가를 것"처럼
아무것도 말하지 않은 글이 나왔습니다.
- 카드가 가리키는 방향이 있으면 그쪽으로 분명히 말하세요. "이 배열은 ~쪽을 가리킵니다."
- "~할 수도 있고 ~할 수도 있다", "어느 쪽이든", "둘 다 가능하다", "결과는 하기 나름"은 쓰지 마세요.
- 카드가 정말 반반이면 그렇다고 말하되, 그때도 "지금은 결정을 미루라는 뜻"처럼
  무엇을 하라는 답으로 바꿔 쓰세요. 판단을 읽는 사람에게 떠넘기지 마세요.
- 흐름의 마지막 문장은 반드시 한 줄짜리 결론이어야 합니다.
  예: "지금은 벌이기보다 정리할 때입니다." / "망설임을 접고 움직여도 되는 배열입니다."

[지금 할 것을 쓸 때]
- 오늘이나 내일 당장 할 수 있는 일을 쓰세요. "계획을 세운다", "객관적으로 정리한다" 같은
  말은 누구에게나 해당해서 쓸모가 없습니다.
- 무엇을, 어디에, 누구와 할지가 보이게 쓰세요.
  나쁜 예: "현재 상황을 객관적으로 정리하기"
  좋은 예: "지금 고민하는 두 갈래를 종이에 적고 각각의 마감 기한을 적어두기"

금지: 죽음·이별·사고를 예언하지 마세요. 흉한 카드도 "무엇을 조심하고 무엇을 할 수 있는지"로 바꿔 쓰세요.
출력: { "카드별": [{ "자리": string, "카드": string, "읽기": string }],
       "흐름": string(3~4문장, 카드들을 하나로 꿰어서),
       "지금할것": action[] }`,
    pick: (r, m) => m,
  },

  /* ===== 범위별 풀이 (올해·이번달·대운·평생) ===== */
  {
    id: 'beomwi', name: '범위 풀이', wave: 1, mode: 'scope',
    role: '요청한 기간만 골라 읽는다.',
    prompt: `당신은 명리 상담가입니다. 사용자가 고른 기간에 대해서만 씁니다.

[기간에 맞게 쓰세요]
재료의 '범위'에 어느 기간인지 적혀 있습니다. 그 기간의 이야기만 하세요.
- 평생: 타고난 구조가 어떤 사람인지, 삶 전체에서 무엇이 강점이고 약점인지를 씁니다.
  특정 연도를 길게 다루지 마세요.
- 대운(10년): 지금 지나는 10년이 어떤 국면인지 씁니다. 이 구간에 무엇을 쌓고
  무엇을 조심할지, 다음 구간으로 넘어갈 때 무엇이 달라지는지를 봅니다.
- 올해: 그 해의 흐름만 봅니다. 원국 설명을 길게 늘어놓지 말고
  올해 간지가 타고난 여덟 글자와 어떻게 만나는지를 중심으로 쓰세요.
- 이번 달: 그 달만 봅니다. 달 안에서 앞뒤가 어떻게 다른지까지 짚어주면 좋습니다.
- 기간이 짧을수록 구체적으로, 길수록 큰 틀로 씁니다.

[분량] 한글 900자 이내(공통 지시보다 우선). 서론 없이 바로 들어가세요.

출력: { "제목": string, "한줄요약": string,
       "본문": [{"섹션":string,"내용":string}],
       "지금할것": [{"제안":string,"이유":string,"시기":string}],
       "한계": string }`,
    pick: (r, m) => m,
  },

  /* ===== 상담 (질문에 답하는 단일 에이전트) ===== */
  {
    id: 'sangdam', name: '상담가', wave: 1, mode: 'consult',
    role: '사용자의 질문에 계산 결과를 근거로 답한다.',
    prompt: `당신은 명리 상담가입니다. 사용자가 던진 질문 하나에 답하는 것이 전부입니다.

[이어지는 대화]
재료에 '이전대화'가 있으면 앞서 주고받은 내용입니다.
- 앞에서 이미 말한 것을 다시 설명하지 마세요. 이어서 답하는 자리입니다.
- 앞의 답과 어긋나는 말을 하지 마세요. 생각이 바뀌었다면 왜 바뀌었는지 밝히세요.
- 짧은 되물음("그럼 그때는?", "왜?")도 앞 맥락에 붙여서 이해하세요.

[답하는 방식]
- 질문에 직접 답하세요. 사주 전반을 다시 설명하지 말고, 그 질문과 닿는 부분만 골라 쓰세요.
- 모든 판단에 원국 글자나 수치를 근거로 대세요. 재료에 없는 것은 쓰지 않습니다.
- 시기를 묻는 질문이면 대운·세운에서 실제 연도를 짚어주세요.

[결론을 뒤집지 말 것 — 가장 중요]
재료에는 등급이 이미 매겨져 있습니다. 현재 대운 종합, 영역별 등급, 세운 등급이 그것입니다.
이 등급들이 좋게 나와 있으면 그것이 결론의 출발점입니다. 성중유패·파격·충형 같은
부정적 요소만 골라내 "지금은 때가 아니다"로 뒤집지 마세요. 그 요소들은 이미 등급 계산에
반영되어 있습니다. 부정적 요소는 "다만 이런 면이 있으니 이렇게 대비하라"로 덧붙이는 자리이지
결론을 바꾸는 근거가 아닙니다.
- 현재 대운이 '좋음' 이상인데 "미루라·기다리라"고 쓰려면, 재료 안에 그보다 강한 반대 근거가
  있어야 합니다. 없으면 지금이 좋은 때라고 쓰세요.
- 영역 등급이 '좋음' 이상인 영역을 묻는 질문에는 그 강점부터 말하세요.

[물음에는 답을 하세요]
"~할 수도 있고 ~할 수도 있다", "선택은 본인의 몫", "하기 나름"으로 끝내면
읽는 사람은 아무것도 얻지 못합니다. 물어본 것에는 답을 하세요.
- 재료가 한쪽을 가리키면 그쪽으로 분명히 말하세요.
- 정말 반반이면 그렇다고 말하되, "지금은 결정을 미루는 편이 낫다"처럼
  무엇을 하라는 답으로 바꿔 쓰세요.
- 마지막은 한 줄짜리 결론으로 맺으세요.

[제안은 실제로 할 수 있는 것만 — 가장 자주 어기는 부분]
제안을 쓰기 전에 스스로 물어보세요. "이 사람이 내일 아침에 이걸 할 수 있나?"
할 수 없으면 쓰지 마세요.
- 업무·행정은 평일 낮에만 됩니다. 새벽이나 심야 시각을 지정하지 마세요.
- 돈이 많이 들거나 삶을 크게 흔드는 일을 권하지 마세요.
  개명, 부적, 굿, 이사, 이름 바꾸기, 방위 맞춰 집 고르기 같은 것은 제안하지 않습니다.
- 사람을 끊으라거나 관계를 정리하라고 하지 마세요.
- 퇴사·이혼·투자·대출처럼 되돌리기 어려운 결정을 부추기지 마세요.
  물어보더라도 "이런 점을 함께 보라"까지만 쓰고 결정은 본인 몫으로 남기세요.
- 약·영양제·치료를 권하지 마세요. 건강은 "병원에서 확인하라"까지입니다.
- 특정 색·숫자·방향이 행운을 준다는 말은 쓰지 마세요. 이 앱의 계산에 그런 근거가 없습니다.
- 좋은 제안은 대개 이런 모양입니다: 무엇을 점검한다, 누구와 이야기한다, 기록을 남긴다,
  미리 알아본다, 기한을 정한다.

[삶을 미루게 하지 말 것 — 중요]
세운이 '주의'라는 것은 그 해에 조심할 일이 있다는 뜻이지, 인생의 큰일을 치르면 안 된다는 뜻이 아닙니다.
결혼·출산·이사·창업처럼 삶의 중대사를 몇 년씩 미루라고 하지 마세요. 사람의 인생에는
나쁜 해가 반드시 섞여 있고, 그것을 피해 다니면 아무것도 못 합니다.
- 나쁜 시기가 있으면 "그때는 무엇을 조심하면 된다"를 쓰세요. "그때를 피하라"가 아닙니다.
- 한 가지 일을 여러 해로 쪼개 "이건 올해, 저건 4년 뒤" 같은 제안을 하지 마세요.
  실제 삶에서 그렇게 살 수 있는 사람은 없습니다.
- 미루라는 말을 쓸 수 있는 경우는 한두 달 단위의 짧은 조정뿐입니다.

[시운을 오용하지 말 것]
시운(하루 안의 시간대)은 하루 안의 결일 뿐입니다. 중요한 자리에 나서는 시각을 고를 때나
참고하는 정도이고, 서류 제출·신청·면담 같은 업무 시각으로 제안하면 현실에 맞지 않습니다.
질문이 하루 단위 타이밍을 묻는 게 아니라면 시운은 꺼내지 마세요.

[시기를 쓸 때]
- 나이와 연도를 함께 쓰세요(예: 만 38세가 되는 2027년).
- 한 제안 안에서 서로 다른 시점을 묶지 마세요. '38세 중반 또는 2031년 이후' 같은 표현은
  4년 차이를 한 덩어리로 만들어 읽는 사람을 혼란스럽게 합니다.

[근거를 적을 때]
'어디서'는 사람이 읽을 수 있게 쓰세요. '현재대운.용신통근' 같은 필드 경로가 아니라
'현재 대운 丙寅의 지지 寅'처럼 실제 글자와 자리로 적습니다.
- 좋고 나쁨을 가르는 질문이면 양쪽을 다 말하고, 무엇을 보고 판단하면 되는지 알려주세요.
- 사주로 답할 수 없는 질문(의학·법률 판단, 타인의 속마음, 로또 번호 같은 것)이면
  그렇다고 분명히 말하고, 대신 사주로 볼 수 있는 인접한 것을 제안하세요.

[금지]
- 단정하지 마세요. "~한다"가 아니라 "~하기 쉬운 구조다"로 씁니다.
- 질병을 확정하거나, 죽음·이혼·사고를 예언하지 마세요.
- 지난 선택을 후회하게 만들지 마세요.
- 흉한 판단에는 반드시 무엇을 할 수 있는지를 붙이세요.

[문체]
- 한국어 평서문으로 쓰세요. 존댓말로 통일하고, 문장을 짧게 끊으세요.
- 한자 용어를 쓸 때는 처음 한 번만 한글 뜻을 붙이세요(예: 편관(칠살)). 매번 붙이면 읽기 어렵습니다.
- 원국 글자는 한자 그대로 쓰되(庚, 巳), 그 글자가 무엇인지 한 번은 밝히세요(일간 庚금, 월지 巳화).
- "~할 것이다", "~하게 된다" 같은 확정 어미를 피하고 "~하기 쉽다", "~하는 편이다"로 쓰세요.
- '당신'이라는 말을 쓰지 마세요. 주어를 생략하거나 '이 사주는'으로 씁니다.

[분량] 한글 900자 이내(공통 지시보다 우선). 서론 없이 바로 답으로 들어가세요.

출력: { "답": string, "근거": [{"무엇":string,"어디서":string}],
       "해볼것": [{"제안":string,"이유":string}], "한계": string }`,
    pick: (r, m) => m,
  },

  /* ===== Wave 4 — 검증·편집 (직렬) ===== */
  {
    id: 'geomjeung', name: '교차 검증관', wave: 4, mode: 'both', needs: '*',
    role: '앞선 모든 에이전트 출력에서 모순·과장·근거없음·금지사항 위반을 잡아낸다.',
    prompt: `당신은 앞선 에이전트들의 출력을 검사합니다. 새로운 해석을 추가하지 마세요.

중요: "재료에 없는 내용인가"는 검사하지 마세요. 그것은 이미 코드가 원본과 직접 대조해
끝냈고, 그 결과가 [코드가드지적]으로 함께 전달됩니다. 당신에게는 각 에이전트가 받은
재료 전부가 주어지지 않으므로, 재료 유무를 판단하면 반드시 오판합니다.

당신이 볼 것은 세 가지뿐입니다.
1. 모순 — 한 에이전트가 "신강"이라 했는데 다른 곳에서 "신약 전제"로 말하는가
2. 금지 위반 — 단정 표현, 공포 조장, 질병 확정, 극단 사건 예언, 지난 선택 후회 유도
3. 대응책 누락 — 흉한 판정인데 "무엇을 할 수 있는가"가 빠졌는가

지적은 최대 5건까지만, 각 수정지시는 한 문장으로 쓰세요.
문제가 없으면 빈 배열을 반환하세요. 억지로 찾아내지 마세요.
출력: { "통과여부": "통과"|"수정필요", "지적": [{ "대상": string, "문장": string, "유형": string, "수정지시": string }] }`,
    pick: () => ({}),
  },
  {
    id: 'pyeonjip', name: '편집장', wave: 4, mode: 'both', needs: '*',
    role: '검증을 반영해 하나의 글로 합친다. 중복을 걷어내고 순서를 잡는다.',
    prompt: `당신은 최종 편집자입니다. 앞선 분석과 검증 지적을 모두 받아 하나의 글로 만듭니다.
- 검증관이 지적한 부분은 반드시 반영해 고치세요. 지적받은 문장을 그대로 옮겨 쓰면 안 됩니다.
  특히 "완화하라"는 지적은 단정 표현을 경향 표현으로 바꾸고, "대응책을 붙이라"는 지적은
  그 문장 바로 뒤에 무엇을 할 수 있는지를 한 문장 덧붙이는 것으로 처리하세요
- 재료로 받은 대운표·세운표의 간지를 그대로 쓰세요. "재료에 없다"고 쓰지 마세요
- 같은 말을 여러 에이전트가 반복했으면 한 번만 남기세요
- 순서: 전체 요약 → 타고난 구조 → 기질 → 영역별(재물·직업·관계·건강) → 흐름(대운·세운) → 지금 할 것
  (궁합이면: 총평 → 두 사람 각각의 입장 → 관계 역학 → 함께 할 것)
- 가장 먼저 오는 요약은 3~4문장으로, 이 사람이 궁금해할 것에 바로 답하세요
- 나쁜 내용을 뺄까 말까 고민되면, 빼지 말고 대응책과 함께 남기세요.
  좋은 말만 남긴 글은 당장은 기분 좋아도 다시 찾지 않습니다.
- 마지막에 이 해석의 한계를 두세 문장으로 담담히 적으세요

[제목과 한줄요약 쓰는 법]
- 제목은 멋을 부리지 마세요. 책 제목이나 광고 문구가 아닙니다.
  "흐르는 돈을 그릇에 담는 법", "~의 비밀", "~하는 사람" 같은 투는 쓰지 않습니다.
  대신 이 사주가 어떤 구조인지를 그대로 적으세요. 예: "편재격 신약 — 재성은 많고 감당할 힘은 얇다"
  25자 안쪽으로 씁니다.
- 한줄요약은 두 문장 이내로 끊어 쓰세요. 한 문장이 40자를 넘으면 읽기 어렵습니다.
  쉼표로 계속 이어 붙이지 말고 마침표로 끊으세요.
- 신강·신약은 사주의 힘을 말하는 것이지 몸이나 건강이 아닙니다.
  "몸이 신약해", "신체가 약해" 같은 표현을 쓰지 마세요. "감당할 힘이 얇아"처럼 씁니다.
- 분량: 한글 2500자까지 씁니다(공통 지시보다 우선). 반드시 JSON을 완성해서 끝내세요
출력: { "제목": string, "한줄요약": string, "본문": [{ "섹션": string, "내용": string }],
       "실행요약": action[], "한계": string }`,
    pick: () => ({}),
  },
];

/* ---------- 에이전트별 입력 패킷 만들기 ---------- */
/** 오늘 날짜. AI는 지금이 언제인지 모르므로 모든 패킷에 넣어준다.
    이게 없으면 이미 지난 달을 '다음 달'이라고 제안하는 일이 생긴다. */
function todayInfo() {
  const d = new Date();
  return { 오늘: `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`,
           올해: d.getFullYear(), 이번달: d.getMonth()+1,
           안내: '이보다 앞선 시점은 이미 지났습니다. 지난 때를 제안하지 마세요' };
}

function buildPacket(agent, reading, match) {
  const base = agent.mode === 'compat'
    ? (agent.pick ? agent.pick(match, match) : {})
    : (agent.pick ? agent.pick(reading, match) : {});
  return { 날짜: todayInfo(), ...base };
}

function systemPromptOf(agent) {
  return `${COMMON_RULES}

[당신의 역할]
${agent.name} — ${agent.role}

[지침]
${agent.prompt}

[쉬운 말로 쓸 것 — 가장 중요]
읽는 사람은 명리를 배운 적이 없습니다. 용어를 그대로 쓰면 한 줄도 이해하지 못합니다.
전문용어를 아예 쓰지 말라는 것이 아니라, 쓸 때마다 그 자리에서 풀어주라는 뜻입니다.

- 처음 나오는 용어는 괄호로 풀이를 답니다. 예: 투출(아랫글자 속 기운이 윗글자로 드러남)
- 한 문장에 풀이 없는 용어를 두 개 이상 넣지 마세요. 읽다가 막힙니다.
- 점수와 수치는 그것이 무슨 뜻인지 함께 적습니다.
  "통근 점수 46" → "일간이 기댈 뿌리가 46점인데, 100점 안팎이면 튼튼한 편이니 얕은 쪽입니다"
  "고저 점수 -1.8의 중하격" → "그릇의 크기는 중하격입니다. 격은 섰지만 그것을 받쳐줄 힘이 얇습니다"
- 이런 말들은 반드시 풀어씁니다.
  지장간 → 아랫글자 속에 숨은 기운 / 본기 → 그중 가장 힘이 센 기운
  투출 → 숨어 있던 기운이 윗글자로 드러남 / 상신 → 격을 세워주는 요소
  통근 → 윗글자가 아랫글자에 뿌리를 둠 / 원국 → 타고난 여덟 글자
  세력 → 차지하는 비중 / 교운 → 대운이 바뀌는 시기
  개두·절각 → 위아래 글자가 서로 엇갈려 힘이 반만 나오는 상태
- 조합 이름(재생살·탐재괴인·상관패인 같은 것)은 이름만 던지지 말고 뜻을 함께 적으세요.
  "탐재괴인" → "이익을 좇다 신뢰를 잃기 쉬운 구조(탐재괴인)"
- 한자를 쓸 때는 그 글자가 무엇인지 한 번은 밝힙니다. 예: 월지 酉(태어난 달의 아랫글자)

[궁합은 관계 종류에 맞게 읽을 것 — 자주 어기는 부분]
재료의 '관계'에 어떤 사이인지 적혀 있습니다. 그에 맞지 않는 말을 쓰면 읽는 사람이 당황합니다.
실측으로 남매 궁합에 "배우자궁", "자식·노후 계획", "만남은 짧고 자주"가 나온 적이 있습니다.
- 연애·부부일 때만: 배우자궁, 이성, 결혼, 자식 계획, 애정, 스킨십, 만남의 빈도
- 형제·자매: 같이 자란 사이입니다. 비교와 경쟁, 부모를 사이에 둔 입장 차이, 재산·돌봄 분담,
  나이 차에서 오는 역할을 봅니다. 헤어지고 만나고를 논하지 마세요. 끊어지지 않는 관계입니다.
- 부모·자식: 한쪽이 주고 한쪽이 받는 자리입니다. 기대와 부담, 독립과 간섭, 돌봄의 방향을 봅니다.
  대등한 파트너처럼 쓰지 마세요.
- 가족(그 밖의): 끊을 수 없는 사이라는 전제로 씁니다. 거리 조절은 말하되 정리·단절은 말하지 마세요.
- 친구: 편안함과 기질의 결을 봅니다. 돈이 오가는 이야기는 조심스럽게만 다루세요.
- 동업: 역할 분담, 의사결정 권한, 돈의 흐름과 기록을 봅니다. 사적 감정을 앞세우지 마세요.
- 십성 이름은 그대로 쓰되(정재·편관 등) 그것을 연애의 뜻으로 풀지 마세요.
  같은 정재라도 연인 사이에서는 '아끼는 마음'이고 남매 사이에서는 '챙겨주는 몫'입니다.

[비교해서 말할 때]
"다음 대운도 크게 나아지지 않는다", "유일하게 음수다" 같은 비교는 재료의 두 값을 실제로
확인하고 쓰세요. 실측으로 현재 -0.2, 다음 0.4인데 "크게 나아지지 않는다"고 쓴 적이 있습니다.
- 좋아지는지 나빠지는지는 숫자를 직접 비교해서 말하세요.
- '유일하게', '가장', '모두'처럼 전체를 걸고 말할 때는 나머지 값을 다 확인하세요.
- 영역 점수와 십성 세력은 다른 것입니다. 영역 점수는 -2~+2 범위이고 십성 세력은 백분율입니다.
  "관성 점수 0.73"처럼 섞어 쓰면 읽는 사람이 오해합니다. 영역을 말할 때는 "직업·명예 점수"처럼
  영역 이름을 그대로 쓰세요.

[재료의 말을 그대로 베끼지 말 것]
재료에는 evidence·근거·해설 같은 필드가 있고 거기 명리 용어가 그대로 들어 있습니다.
그것을 복사해 붙이면 읽는 사람이 이해하지 못합니다. 반드시 자기 말로 옮겨 쓰세요.
예) 재료 "상신 인성은 있으나 재성이 격을 흔든다"
    → 쓸 때 "격을 세워주는 인성은 갖췄지만 재성이 그 틀을 흔드는 면이 있습니다"

[재료 읽는 법 — 숫자와 약어의 뜻]
- 세력·비율은 모두 백분율입니다. 다섯 오행 또는 다섯 십성의 합이 100이 됩니다.
- 평가 '점수'는 -2(가장 나쁨) ~ +2(가장 좋음) 범위이고 0이 중립입니다.
  영역별 점수는 -2~+2 안에서 더 좁게 움직이니, 0.7만 넘어도 그 영역은 상당히 좋은 편입니다.
- 통근 'total'은 뿌리 점수로 0이면 뿌리가 없고 100 안팎이면 튼튼합니다.
- allyPct는 인성+비겁이 차지하는 비율(%)이고, verdict는 신강/신약 최종 판정입니다.
- deukRyeong/deukJi/deukSe는 득령(월지가 나를 도움)/득지(일지가 나를 도움)/득세(전체 세력이 나를 도움)입니다.
- confidence(신뢰도)가 '낮음'이면 판정이 경계선에 있다는 뜻입니다.
- 월령의 旺·相·休·囚·死는 왕상휴수사로, 그 오행이 계절에서 얼마나 힘을 받는지입니다(旺이 가장 셈).
- force(뚜렷/보통/암시)는 그 조합이 얼마나 드러나 있는지입니다. '암시'는 지장간에만 숨어 있다는 뜻이라
  단정적으로 쓰지 마세요.
- 빈 배열이나 null은 '해당 없음'입니다. 없다는 사실 자체를 길게 쓰지 마세요.

[이 앱의 관법 — 재료를 읽을 때 알아둘 것]
- 조후의 '온도'는 글자마다 매긴 점수를 자리 가중으로 합한 값입니다. 음수는 차갑고 양수는 따뜻하며,
  ±3을 넘으면 한랭·조열로 봅니다. 월지 계절이 따로 가산됩니다. 이 수치를 그대로 인용해도 됩니다.
- 격국이 둘로 표기될 때가 있습니다. '이름'은 투간 순서로 잡은 격이고 '본기격'은 월지 본기로 잡은 격입니다.
  두 관법이 갈리는 자리라는 뜻이니, 어느 한쪽만 옳다고 쓰지 말고 둘 다 있는 그대로 전하세요.
- '별칭'이 있으면 그 이름이 더 널리 쓰입니다(비견격=건록격, 월지 겁재+양간=양인격).
- 용신 type이 '종격'이면 일반적인 억부 논리가 적용되지 않습니다. 강한 세력을 따라가는 구조입니다.
- 강약의 '신뢰도'가 낮음이면 판정이 경계에 있다는 뜻입니다. 단정하지 말고 그 사실을 밝히세요.
- 나이는 모두 만 나이입니다.

[문체]
- 한국어 평서문으로 쓰세요. 존댓말로 통일하고, 문장을 짧게 끊으세요.
- 한자 용어를 쓸 때는 처음 한 번만 한글 뜻을 붙이세요(예: 편관(칠살)). 매번 붙이면 읽기 어렵습니다.
- 원국 글자는 한자 그대로 쓰되(庚, 巳), 그 글자가 무엇인지 한 번은 밝히세요(일간 庚금, 월지 巳화).
- "~할 것이다", "~하게 된다" 같은 확정 어미를 피하고 "~하기 쉽다", "~하는 편이다"로 쓰세요.
- '당신'이라는 말을 쓰지 마세요. 주어를 생략하거나 '이 사주는'으로 씁니다.

[분량]
아래 역할 지시에 분량이 따로 적혀 있으면 그쪽을 따르고, 없으면 한글 1200자 이내로 맞추세요.
배열 항목은 각 3~5개까지만 쓰고, 한 항목의 내용은 2~3문장을 넘기지 마세요.
길게 쓰면 응답이 잘려 통째로 버려집니다.

[출력 형식]
JSON만 출력하세요. 마크다운 코드펜스, 설명, 서론 없이 JSON 객체 하나만 반환합니다.
반드시 닫는 중괄호까지 완성해서 끝내세요.
finding = ${S.finding}
action  = ${S.action}`;
}

module.exports = { AGENTS, COMMON_RULES, buildPacket, systemPromptOf, todayInfo, SCHEMA: S };

return module.exports; })();

/* ===== saju-orchestrator.js ===== */
__mods["saju-orchestrator"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   saju-orchestrator.js — 멀티에이전트 실행기
   웨이브 단위로 병렬 실행하고, 각 출력을 코드로 한 번 더 검사한다.
   AI 검증관만 믿지 않는 이유: 검증관도 LLM이라 같이 틀릴 수 있다.
   결정론 엔진이 낸 숫자와 글자는 코드가 직접 대조한다.
   ============================================================= */
const { AGENTS, buildPacket, systemPromptOf, todayInfo } = require('./saju-agents');
const R = require('./saju-rules');

/* ---------- 코드 레벨 가드 ---------- */
const BANNED = [
  { re: /(사망|죽는다|죽을|요절|단명|비명횡사)/, why: '수명·사망 언급' },
  { re: /(이혼하게|이혼한다|파혼|반드시 헤어)/, why: '관계 파탄 단정' },
  { re: /(암에|암이 생|중풍|치매에 걸|불치)/, why: '질병 확정' },
  { re: /(파산한다|망한다|쫄딱)/, why: '경제적 파탄 단정' },
  { re: /(반드시 .{0,12}(된다|한다|생긴다))/, why: '단정 표현' },
  { re: /(절대 .{0,10}(안 된다|하지 마))/, why: '과도한 금지' },
  { re: /(무조건)/, why: '단정 표현' },
];

/** 재료에 실재하는 토큰 집합 (간지·십성·용어) */
function factSet(reading) {
  const set = new Set();
  const add = v => { if (v != null) set.add(String(v)); };
  const s = reading.saju;
  for (const p of [s.year, s.month, s.day, s.hour].filter(Boolean)) {
    add(R.G[p.gan]); add(R.J[p.ji]); add(R.G[p.gan] + R.J[p.ji]);
    add(R.sipseongOfGan(s.day.gan, p.gan)); add(R.sipseongOfJi(s.day.gan, p.ji));
    for (const g of R.jijanggan(p.ji)) add(R.G[g]);
  }
  // 대운·세운·월운은 에이전트가 정당하게 인용하는 글자다. 원국 8자만 담으면
  // "乙丑 대운" 같은 정상 서술이 전부 위조로 걸린다(실측 8건 중 5건이 이 오탐이었다).
  for (const d of reading.saju.daeun.list) {
    add(d.han); add(R.G[d.gan]); add(R.J[d.ji]);
    for (const g of R.jijanggan(d.ji)) add(R.G[g]);
  }
  const nowY = new Date().getFullYear();
  for (let y = nowY - 40; y <= nowY + 40; y++) {           // 세운·월운 간지
    const i = ((y - 4) % 60 + 60) % 60;
    add(R.G[i % 10] + R.J[i % 12]); add(R.G[i % 10]); add(R.J[i % 12]);
  }
  for (let i = 0; i < 60; i++) { add(R.G[i % 10]); add(R.J[i % 12]); }  // 월운·일운 간지
  if (reading.명궁 && reading.명궁.간지) { add(reading.명궁.간지); }
  if (reading.태원 && reading.태원.간지) { add(reading.태원.간지); }
  R.OH.forEach(add); R.GROUPS.forEach(add); R.SIPSEONG.forEach(add);
  ['신강','신약','태강','태약','중화'].forEach(add);
  add(reading.격국.name); add(reading.yongsin.primary.group);
  (reading.패턴 || []).forEach(p => add(p.name));
  return set;
}

/** 재료에 실제로 존재하는 수치 집합. 에이전트가 점수를 지어내는 것을 막는다.
    간지 위조보다 수치 위조가 더 위험하다 — 사용자가 그 숫자를 그대로 믿기 때문이다. */
function numberSet(reading, match) {
  const nums = new Set();
  const add = v => { if (typeof v === 'number' && isFinite(v)) {
    nums.add(Math.round(v)); nums.add(Math.round(v * 10) / 10); nums.add(Math.abs(v)); } };
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    else add(v);
  };
  if (reading) walk({ s: reading.strength, g: reading.groupPower, d: reading.deep.table,
                      l: reading.격국고저, y: reading.영역운세, t: reading.통근 });
  if (match) walk({ c: match.궁합 });
  return nums;
}

/** 수치 위조 검사.
    모든 숫자를 대조하면(합산·평균 같은 정당한 산술까지 걸려) 오탐이 쏟아지고,
    합산을 허용하면 반대로 진짜 거짓말까지 통과한다(85점 실측).
    그래서 "총점/점수" 같은 라벨이 붙은 핵심 지표만 정면 대조한다. */
function checkNumbers(text, nums, keyed) {
  const bad = [];
  // (1) 라벨이 붙은 핵심 지표 — 여기서 틀리면 사용자가 그대로 믿는 숫자다
  if (keyed) {
    for (const [label, real] of Object.entries(keyed)) {
      const re = new RegExp(label + '[^0-9\\-]{0,6}(-?\\d{1,3}(?:\\.\\d+)?)', 'g');
      for (const m of text.matchAll(re)) {
        const n = parseFloat(m[1]);
        if (Math.abs(n - real) > 1.5) bad.push(`${label} ${n} (실제 ${real})`);
      }
    }
  }
  // (2) 라벨 없는 수치는 원본 집합에 없을 때만, 그것도 크게 벗어난 경우만
  const arr = [...nums];
  const max = Math.max(...arr.map(Math.abs), 100);
  for (const m of text.matchAll(/(-?\d{1,3}(?:\.\d+)?)\s*(점|%|퍼센트)/g)) {
    const n = parseFloat(m[1]);
    if (Math.abs(n) > max * 1.2) bad.push(`${n} (원본 최대치를 크게 벗어남)`);
  }
  return [...new Set(bad)];
}

/** 출력 텍스트에서 한자 간지를 뽑아 재료에 없는 것을 찾는다 */
function checkHallucination(text, facts) {
  const found = text.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || [];
  const bad = [...new Set(found)].filter(x => !facts.has(x));
  const singles = text.match(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]/g) || [];
  const badSingle = [...new Set(singles)].filter(x => !facts.has(x));
  return { 없는간지: bad, 없는글자: badSingle };
}

function guard(agentId, obj, facts, nums, keyed) {
  const issues = [];
  const text = obj && obj.__text ? obj.__text : JSON.stringify(obj);
  // 형식이 어긋난 응답을 파서가 되살린 것은 내부 처리일 뿐이다.
  // 사용자에게는 내용의 문제만 보여준다(실측: 결과가 멀쩡한데 경고가 떠서 혼란스러웠다).
  for (const b of BANNED) {
    const m = text.match(b.re);
    if (m) issues.push({ 대상: agentId, 유형: b.why, 문장: m[0], 출처: '코드 가드' });
  }
  if (nums && nums.size) {
    const badN = checkNumbers(text, nums, keyed);
    if (badN.length) issues.push({ 대상: agentId, 유형: '재료에 없는 수치 인용',
      문장: badN.map(n => n + '점/%').join(','), 출처: '코드 가드' });
  }
  const h = checkHallucination(text, facts);
  if (h.없는간지.length)
    issues.push({ 대상: agentId, 유형: '재료에 없는 간지 사용', 문장: h.없는간지.join(','), 출처: '코드 가드' });
  if (h.없는글자.length > 2)
    issues.push({ 대상: agentId, 유형: '재료에 없는 글자 다수', 문장: h.없는글자.join(','), 출처: '코드 가드' });
  // 근거 없는 finding
  const walk = (v) => {
    if (obj && obj.__text) return;
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if ('제목' in v && '내용' in v && (!v.근거 || !v.근거.length))
        issues.push({ 대상: agentId, 유형: '근거 누락', 문장: v.제목, 출처: '코드 가드' });
      Object.values(v).forEach(walk);
    }
  };
  walk(obj);
  return issues;
}

/* ---------- JSON 파싱 ----------
   LLM이 형식을 살짝 어겨도 내용은 버리지 않는다. 순서대로 시도하고,
   끝내 파싱이 안 되면 원문을 __text 로 살려 다음 단계에 넘긴다.
   글은 제대로 썼는데 괄호 하나 때문에 통째로 날리는 게 더 큰 손해다. */
function stripFence(t) {
  return String(t).trim()
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^[^{[]*(?=[{[])/, '')      // JSON 앞의 설명 제거
    .trim();
}
/** 잘린 JSON의 괄호·따옴표를 닫아 복구 시도 */
function repair(t) {
  let s = t;
  // 문자열 안이면 닫는다
  let inStr = false, esc = false, stack = [];
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inStr) s += '"';
  s = s.replace(/,\s*$/, '');                     // 끝의 쉼표
  while (stack.length) s += stack.pop() === '{' ? '}' : ']';
  return s;
}
function parseJSON(text) {
  const raw = String(text);
  const t = stripFence(raw);
  // 1) 그대로
  try { return JSON.parse(t); } catch {}
  // 2) 첫 { ~ 마지막 }
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)); } catch {} }
  // 3) 제어문자 제거
  const cleaned = t.replace(/[\u0000-\u001f]+/g, ' ');
  try { return JSON.parse(cleaned); } catch {}
  // 4) 잘린 것 복구
  try { const r = JSON.parse(repair(cleaned)); r.__repaired = true; return r; } catch {}
  // 5) 포기하지 말고 원문을 살린다
  if (raw.trim().length > 40) return { __text: raw.trim(), __unparsed: true };
  throw new Error('응답이 비어 있거나 너무 짧습니다: ' + raw.slice(0, 80));
}

/* ---------- 단일 에이전트 실행 ---------- */
async function runAgent(agent, packet, callLLM, opts = {}) {
  const sys = systemPromptOf(agent);
  const user = `[분석 재료]\n${JSON.stringify(packet, null, 1)}\n\n` +
               (packet.__prior ? `[앞선 분석 결과]\n${JSON.stringify(packet.__prior, null, 1)}\n\n` : '') +
               `위 재료만 사용해 지정된 JSON 형식으로 답하세요.`;
  const tries = opts.retries ?? 1;
  let lastErr, lastRaw = '';
  for (let k = 0; k <= tries; k++) {
    try {
      const extra = k === 0 ? '' :
        '\n\n[재시도] 앞선 응답이 JSON으로 읽히지 않았습니다. 설명이나 코드펜스 없이 ' +
        '중괄호로 시작해 중괄호로 끝나는 순수 JSON 하나만, 더 짧게 출력하세요.';
      const raw = await callLLM({ system: sys, user: user + extra, agent: agent.id });
      lastRaw = raw;
      return parseJSON(raw);
    } catch (e) { lastErr = e; }
  }
  return { __error: `${agent.name} 실패: ${lastErr && lastErr.message}`,
           __raw: String(lastRaw).slice(0, 500) };
}

/* ---------- 웨이브 병렬 실행 ---------- */
async function runWave(agents, makePacket, callLLM, onProgress, opts) {
  const t0 = Date.now();
  onProgress && onProgress({ type: 'wave-start', agents: agents.map(a => a.name) });
  const results = await Promise.all(agents.map(async a => {
    const s = Date.now();
    const out = await runAgent(a, makePacket(a), callLLM, opts);
    onProgress && onProgress({ type: 'agent-done', id: a.id, name: a.name, ms: Date.now() - s,
                               ok: !out.__error,
                               사유: out.__error ? String(out.__error).replace(/^.*실패:\s*/,'') : null,
                               note: out.__unparsed ? '형식 어긋남(내용은 살림)'
                                   : out.__repaired ? '잘린 것 복구' : null });
    return [a.id, out];
  }));
  onProgress && onProgress({ type: 'wave-end', ms: Date.now() - t0 });
  return Object.fromEntries(results);
}

/** 검증관·편집장에게 넘길 요약본. 앞선 결과를 통째로 넘기면 입력 토큰이 폭증한다
    (실측 14.9만 토큰 중 대부분이 이 두 단계였다). */
/** 편집장이 실패했을 때, 앞 단계 결과만으로 읽을 만한 글을 만든다.
    아홉이 다 성공했는데 마지막 하나 때문에 전부 버리는 것은 아깝다. */
function fallbackReport(all, title) {
  const NAME = { myeongsik:'타고난 구조', seongjeong:'기질', jaemul:'재물',
    jigeop:'직업·명예', aejeong:'관계', geongang:'건강',
    daeun:'대운 흐름', seun:'다가오는 해', jeollyak:'시기 전략',
    gunghap_a:'A가 보는 관계', gunghap_b:'B가 보는 관계', gwangye:'관계의 역학' };
  const 본문 = [], 실행 = [];
  for (const [id, v] of Object.entries(all)) {
    if (!v || v.__error || !NAME[id]) continue;
    const parts = [];
    if (v.요약) parts.push(String(v.요약));
    for (const [k, arr] of Object.entries(v)) {
      if (!Array.isArray(arr) || !arr.length || k === '실행제안' || k === '지금할것') continue;
      arr.slice(0, 3).forEach(x => {
        if (typeof x === 'string') parts.push('· ' + x);
        else if (x && (x.제목 || x.내용)) parts.push('· ' + [x.제목, x.내용].filter(Boolean).join(' — '));
      });
    }
    if (parts.length) 본문.push({ 섹션: NAME[id], 내용: parts.join('\n') });
    for (const k of ['실행제안', '지금할것', '해볼것'])
      (v[k] || []).slice(0, 2).forEach(x => 실행.push(x));
  }
  return { 제목: title, 한줄요약: '', 본문, 실행요약: 실행.slice(0, 6),
    한계: '마지막 정리 단계가 끝나지 않아 각 분석가의 결과를 그대로 이어 붙였습니다. ' +
          '다시 풀면 하나로 다듬어진 글을 받을 수 있습니다.' };
}

function digest(all) {
  const out = {};
  for (const [id, v] of Object.entries(all)) {
    if (!v || v.__error) { out[id] = { 실패: v && v.__error }; continue; }
    if (v.__text) { out[id] = { 원문: String(v.__text).slice(0, 1500) }; continue; }
    const pick = {};
    for (const k of ['요약', '한줄요약']) if (v[k]) pick[k] = v[k];
    for (const [k, arr] of Object.entries(v)) {
      if (!Array.isArray(arr) || !arr.length) continue;
      pick[k] = arr.slice(0, 6).map(x => typeof x === 'string' ? x
        : { 제목: [x.구간, x.간지, x.연도, x.제목, x.제안].filter(Boolean).join(' '),
            내용: String(x.내용 || x.이유 || '').slice(0, 220),
            근거: (x.근거 || []).slice(0, 3) });
    }
    out[id] = pick;
  }
  return out;
}

/* ---------- 원국 리딩 파이프라인 ---------- */
async function runReading(reading, callLLM, opts = {}) {
  const onProgress = opts.onProgress;
  const facts = factSet(reading);
  const nums = numberSet(reading, null);
  const keyed = { '인비': reading.strength.allyPct, '고저': reading.격국고저.점수 };
  const natal = AGENTS.filter(a => a.mode === 'natal');

  const w1 = await runWave(natal.filter(a => a.wave === 1),
    a => buildPacket(a, reading), callLLM, onProgress, opts);
  const w2 = await runWave(natal.filter(a => a.wave === 2),
    a => ({ ...buildPacket(a, reading), __prior: { 명식: w1.myeongsik } }), callLLM, onProgress, opts);

  const all = { ...w1, ...w2 };
  // 코드 가드 먼저
  let issues = [];
  for (const [id, obj] of Object.entries(all)) if (!obj.__error) issues.push(...guard(id, obj, facts, nums, keyed));

  // AI 교차검증
  const vAgent = AGENTS.find(a => a.id === 'geomjeung');
  onProgress && onProgress({ type: 'wave-start', agents: ['교차 검증관'] });
  const verify = await runAgent(vAgent,
    { 원본재료요약: { 강약: reading.strength.level, 용신: reading.yongsin.primary.group,
                      격국: reading.격국.name, 세력: reading.groupPower },
      __prior: digest(all), 코드가드지적: issues }, callLLM, opts);
  onProgress && onProgress({ type: 'agent-done', id: 'geomjeung', name: '교차 검증관', ok: !verify.__error });

  const allIssues = [...issues, ...((verify.지적) || [])];

  // 편집
  const eAgent = AGENTS.find(a => a.id === 'pyeonjip');
  onProgress && onProgress({ type: 'wave-start', agents: ['편집장'] });
  let final = await runAgent(eAgent,
    { __prior: digest(all), 검증지적: allIssues.slice(0, 8),
      원본핵심: { 원국: reading.base.chart, 강약: reading.strength.level,
                  용신: reading.yongsin.primary.group, 격국: reading.격국.name,
                  고저: reading.격국고저.등급,
                  // 편집장이 대운 간지를 몰라 "재료에 없다"고 쓰던 문제를 막는다
                  대운표: reading.대운.map(d => `${d.시작나이}~${d.끝나이}세 ${d.간지} ${d.종합}`),
                  세운표: reading.세운.map(s => `${s.연도} ${s.간지} ${s.종합}`),
                  현재나이: reading.현재나이, 세는나이: reading.세는나이 },
      필수반영: '검증지적에 적힌 수정 지시는 반드시 본문에 반영해서 쓸 것' }, callLLM, opts);
  onProgress && onProgress({ type: 'agent-done', id: 'pyeonjip', name: '편집장', ok: !final.__error });

  // 편집장이 실패해도 앞 아홉의 결과는 살린다
  if (final.__error) final = fallbackReport(all, '사주 풀이');

  // 편집 결과도 가드
  const finalIssues = final.__error ? []
    : guard('pyeonjip', final, facts, nums, keyed)
        .concat(checkAdvice(final.실행요약, 'pyeonjip'))
        .concat(checkHeadline(final, 'pyeonjip'))
        .concat(checkPlainWords(final, 'pyeonjip'))
        .concat(checkPastDates(JSON.stringify(final.실행요약 || []), 'pyeonjip'));
  return { 에이전트: all, 검증: { 코드가드: issues, AI검증: verify, 최종가드: finalIssues },
           결과: final,
           품질: { 지적건수: allIssues.length, 최종가드: finalIssues.length,
                   통과: finalIssues.length === 0 } };
}

/* ---------- 궁합 파이프라인 ---------- */
async function runMatch(match, callLLM, opts = {}) {
  const onProgress = opts.onProgress;
  const factsA = factSet(match.A), factsB = factSet(match.B);
  const facts = new Set([...factsA, ...factsB]);
  const nums = new Set([...numberSet(match.A, match), ...numberSet(match.B, null)]);
  const keyed = { '총점': match.궁합.총점, 'A입장': match.궁합.A입장.점수, 'B입장': match.궁합.B입장.점수 };
  const natal = AGENTS.filter(a => a.mode === 'natal' && a.wave === 1);

  // A·B 원국을 동시에 — 12개 병렬
  const t0 = Date.now();
  onProgress && onProgress({ type: 'wave-start', agents: ['A·B 원국 12개 병렬'] });
  const [wa, wb] = await Promise.all([
    runWave(natal, a => buildPacket(a, match.A), callLLM, onProgress, opts),
    runWave(natal, a => buildPacket(a, match.B), callLLM, onProgress, opts),
  ]);
  onProgress && onProgress({ type: 'wave-end', ms: Date.now() - t0 });

  // 궁합 3개 병렬
  const compat = AGENTS.filter(a => a.mode === 'compat');
  const w3 = await runWave(compat,
    a => ({ ...buildPacket(a, null, match), __prior: { A원국: wa.myeongsik, B원국: wb.myeongsik } }),
    callLLM, onProgress, opts);

  const all = { A: wa, B: wb, ...w3 };
  let issues = [];
  for (const [id, obj] of Object.entries(w3)) if (!obj.__error) issues.push(...guard(id, obj, facts, nums, keyed));

  const vAgent = AGENTS.find(a => a.id === 'geomjeung');
  onProgress && onProgress({ type: 'wave-start', agents: ['교차 검증관'] });
  const verify = await runAgent(vAgent,
    { 원본재료요약: { 총점: match.궁합.총점, 위치: match.궁합.위치, 등급: match.궁합.등급,
                      A입장: match.궁합.A입장, B입장: match.궁합.B입장,
                      유형: match.궁합.관계유형.유형 },
      __prior: digest(all), 코드가드지적: issues }, callLLM, opts);

  const eAgent = AGENTS.find(a => a.id === 'pyeonjip');
  onProgress && onProgress({ type: 'wave-start', agents: ['편집장'] });
  let final = await runAgent(eAgent,
    { __prior: digest(all), 검증지적: [...issues, ...((verify.지적)||[])].slice(0, 8),
      원본핵심: { 총점: match.궁합.총점, 위치: match.궁합.위치, 등급: match.궁합.등급,
                  A: match.궁합.A입장, B: match.궁합.B입장,
                  유형: match.궁합.관계유형, 비대칭: match.궁합.비대칭 },
      모드: '궁합' }, callLLM, opts);

  if (final.__error) final = fallbackReport(all, '궁합 풀이');
  const finalIssues = final.__error ? []
    : guard('pyeonjip', final, facts, nums, keyed)
        .concat(checkAdvice(final.실행요약, 'pyeonjip'))
        .concat(checkHeadline(final, 'pyeonjip'))
        .concat(checkPlainWords(final, 'pyeonjip'))
        .concat(checkRelation(final, match.궁합.관계종류.종류, 'pyeonjip'));
  return { 에이전트: all, 검증: { 코드가드: issues, AI검증: verify, 최종가드: finalIssues },
           결과: final,
           품질: { 지적건수: issues.length + (((verify.지적)||[]).length),
                   최종가드: finalIssues.length, 통과: finalIssues.length === 0 } };
}

/* ---------- 운세만 보는 파이프라인 ----------
   사주 9개를 다 돌릴 필요 없이 시간축 에이전트 3개만 쓴다. */
async function runFortune(reading, callLLM, opts = {}) {
  const onProgress = opts.onProgress;
  const facts = factSet(reading);
  const nums = numberSet(reading, null);
  const keyed = { '인비': reading.strength.allyPct };
  const agents = AGENTS.filter(a => a.mode === 'natal' && a.wave === 2);
  const 명식요약 = {
    원국: reading.base.chart, 강약: reading.strength.level,
    용신: reading.yongsin.primary.group, 격국: reading.격국.name,
    고저: reading.격국고저.등급, 통근: reading.통근.일간.verdict,
  };
  const w = await runWave(agents,
    a => ({ ...buildPacket(a, reading), __prior: { 명식: 명식요약 } }), callLLM, onProgress, opts);
  let issues = [];
  for (const [id, obj] of Object.entries(w)) if (!obj.__error) issues.push(...guard(id, obj, facts, nums, keyed));

  const eAgent = AGENTS.find(a => a.id === 'pyeonjip');
  onProgress && onProgress({ type: 'wave-start', agents: ['편집장'] });
  let final = await runAgent(eAgent,
    { __prior: digest(w), 검증지적: issues.slice(0, 6),
      원본핵심: { ...명식요약,
        대운표: reading.대운.map(d => `${d.시작나이}~${d.끝나이}세 ${d.간지} ${d.종합}`),
        세운표: reading.세운.map(s => `${s.연도} ${s.간지} ${s.종합}`),
        현재나이: reading.현재나이, 세는나이: reading.세는나이 },
      모드: '운세만 — 타고난 구조는 짧게 한 문단으로 줄이고 시간 흐름 위주로 쓸 것' },
    callLLM, opts);
  onProgress && onProgress({ type:'agent-done', id:'pyeonjip', name:'편집장', ok: !final.__error });
  if (final.__error) final = fallbackReport(w, '운의 흐름');
  const finalIssues = final.__error ? []
    : guard('pyeonjip', final, facts, nums, keyed)
        .concat(checkAdvice(final.실행요약, 'pyeonjip'))
        .concat(checkHeadline(final, 'pyeonjip'))
        .concat(checkPlainWords(final, 'pyeonjip'))
        .concat(checkPastDates(JSON.stringify(final.실행요약 || []), 'pyeonjip'));
  return { 에이전트: w, 검증: { 코드가드: issues, 최종가드: finalIssues },
           결과: final, 품질: { 지적건수: issues.length, 최종가드: finalIssues.length,
                              통과: finalIssues.length === 0 } };
}

/** 본문에 풀이 없는 전문용어가 얼마나 있는지 본다.
    실측으로 "지장간의 본기 辛이 투출해 편재격이 짜였고 상신으로 식상까지 확보"처럼
    한 문장에 용어가 넷 들어간 글이 나왔다. */
const 풀이필요 = ['지장간', '본기', '투출', '상신', '통근', '원국', '교운', '개두', '절각',
  '약근', '유근', '무근', '고저', '재생살', '탐재괴인', '상관패인', '상관생재', '식신제살',
  '군겁쟁재', '살인상생', '효신탈식', '모자멸자', '제살태과', '살중신경', '관살혼잡',
  '양인가살', '재다신약', '신왕무의', '탐재', '희신', '기신', '구신'];
function checkPlainWords(obj, agentId) {
  const 본문 = (obj.본문 || []).map(x => (x.섹션 || '') + ' ' + (x.내용 || '')).join('\n');
  if (!본문) return [];
  const 안풀린것 = [];
  for (const w of 풀이필요) {
    let i = 본문.indexOf(w);
    if (i < 0) continue;
    // 바로 뒤나 근처에 괄호 풀이가 있으면 괜찮다
    const 근처 = 본문.slice(i, i + w.length + 30);
    if (/[(（][^)）]{4,}[)）]/.test(근처)) continue;
    안풀린것.push(w);
  }
  if (안풀린것.length < 3) return [];   // 한둘은 문맥으로 읽히므로 넘긴다
  return [{ 대상: agentId, 유형: '풀이 없는 전문용어가 많다',
            문장: 안풀린것.slice(0, 6).join(', ') + (안풀린것.length > 6 ? ` 외 ${안풀린것.length - 6}개` : ''),
            출처: '코드 가드' }];
}

/** 궁합에서 관계에 안 맞는 표현을 걸러낸다.
    실측으로 남매 궁합에 배우자궁·자식계획·만남의 빈도가 나왔다. */
const 연애전용 = /배우자궁|배우자 자리|이성 관계|스킨십|결혼 적기|연인|사랑|애정 표현|만남은 짧|자식·노후|자식 계획/;
function checkRelation(obj, 관계, agentId) {
  if (!관계 || ['연애', '부부'].includes(관계)) return [];
  const text = JSON.stringify(obj);
  const m = text.match(연애전용);
  if (!m) return [];
  return [{ 대상: agentId, 유형: `${관계} 사이인데 연애 표현을 씀`,
            문장: m[0], 출처: '코드 가드' }];
}

/** 제목과 한줄요약이 읽기 어렵게 쓰였는지 본다.
    실측으로 "흐르는 돈을 그릇에 담는 법" 같은 책 제목투와
    66자짜리 한 문장 요약이 나왔다. */
function checkHeadline(obj, agentId) {
  const out = [];
  const 제목 = String(obj.제목 || '');
  const 요약 = String(obj.한줄요약 || '');
  if (제목.length > 30)
    out.push({ 대상: agentId, 유형: '제목이 길다', 문장: `${제목.length}자`, 출처: '코드 가드' });
  if (/하는 법|의 비밀|하는 사람|이야기$|법$/.test(제목))
    out.push({ 대상: agentId, 유형: '제목이 책 제목투', 문장: 제목, 출처: '코드 가드' });
  for (const s of 요약.split(/(?<=[.!?])\s+/))
    if (s.trim().length > 55) {
      out.push({ 대상: agentId, 유형: '요약 문장이 길다',
        문장: `${s.trim().length}자짜리 한 문장`, 출처: '코드 가드' });
      break;
    }
  if (/몸이 신약|신체가 약|몸이 약해/.test(제목 + ' ' + 요약 + ' ' +
      (obj.본문 || []).map(x => x.내용 || '').join(' ')))
    out.push({ 대상: agentId, 유형: '신약을 몸 상태로 씀',
      문장: '신강·신약은 사주의 힘이지 건강이 아니다', 출처: '코드 가드' });
  return out;
}

/** 실행할 수 없거나 위험한 제안을 걸러낸다.
    실측으로 새벽 시각 지정과 여러 해 미루기가 나왔고, 그 밖에도
    개명·부적·퇴사 권유처럼 삶을 크게 흔드는 조언이 나올 수 있다. */
const 비현실 = [
  [/개명|이름을?\s*(바꾸|고치)|작명/, '개명 권유'],
  [/부적|굿을?\s*하|제사를?\s*지내|기도원|점집/, '주술적 해결책'],
  [/이사(?!회)|방위를?\s*(맞|보)|집을?\s*옮|이주하/, '이사·방위 권유'],
  [/퇴사하|직장을?\s*그만|회사를?\s*나오/, '퇴사 권유'],
  [/이혼하|헤어지|관계를?\s*끊|손절/, '관계 단절 권유'],
  [/투자하|주식을?\s*사|대출을?\s*받|코인/, '금융 결정 권유'],
  [/약을?\s*(먹|복용)|영양제|한약|시술을?\s*받/, '의학적 권유'],
  [/행운의?\s*(색|숫자|방향)|(빨강|파랑|초록|노랑|흰)색을?\s*(입|쓰)/, '근거 없는 색·숫자'],
];
function checkAdvice(actions, agentId) {
  const out = [];
  const text = (actions || []).map(x =>
    typeof x === 'string' ? x : (x.제안 || '') + ' ' + (x.이유 || '')).join(' ');
  for (const [re, name] of 비현실)
    if (re.test(text)) out.push({ 대상: agentId, 유형: '실행하기 어려운 제안',
      문장: name, 출처: '코드 가드' });
  return [...new Map(out.map(x => [x.문장, x])).values()];
}

/** 자리를 잘못 말했는지 검사한다.
    글자 자체는 대운·세운에 있어 환각 검사를 통과하지만,
    '월지 子'처럼 자리를 틀리게 붙이면 읽는 사람이 그대로 믿는다. */
function checkPositions(text, saju, agentId) {
  if (!saju) return [];
  const map = {
    연간: R.G[saju.year.gan], 월간: R.G[saju.month.gan],
    일간: R.G[saju.day.gan], 연지: R.J[saju.year.ji],
    월지: R.J[saju.month.ji], 일지: R.J[saju.day.ji],
  };
  if (saju.hour) { map.시간 = R.G[saju.hour.gan]; map.시지 = R.J[saju.hour.ji]; }
  const out = [];
  const re = /(연간|월간|일간|시간|연지|월지|일지|시지)\s*([\u4e00-\u9fff])/g;
  for (const m of String(text).matchAll(re)) {
    const pos = m[1], ch = m[2];
    if (map[pos] && map[pos] !== ch)
      out.push({ 대상: agentId, 유형: '자리와 글자가 안 맞음',
        문장: `${R.josa(pos, '을를')} ${ch}로 봤으나 실제로는 ${map[pos]}`, 출처: '코드 가드' });
  }
  return [...new Map(out.map(x => [x.문장, x])).values()];
}

/** 이미 지난 시점을 제안했는지 검사한다 */
function checkPastDates(text, agentId) {
  const now = new Date(), Y = now.getFullYear(), M = now.getMonth() + 1;
  const out = [];
  for (const m of String(text).matchAll(/(20\d\d)\s*년(?:\s*(\d{1,2})\s*월)?/g)) {
    const y = +m[1], mo = m[2] ? +m[2] : null;
    if (y < Y || (y === Y && mo && mo < M))
      out.push({ 대상: agentId, 유형: '이미 지난 시점을 제안',
        문장: m[0] + ' (오늘은 ' + Y + '년 ' + M + '월)', 출처: '코드 가드' });
  }
  // 연도 없이 '○월'만 쓴 경우도 올해로 보고 검사
  for (const m of String(text).matchAll(/(?<!\d)(\d{1,2})\s*월\s*(?:중|초|말|경|에|부터)/g)) {
    const mo = +m[1];
    if (mo >= 1 && mo <= 12 && mo < M)
      out.push({ 대상: agentId, 유형: '이미 지난 달을 제안',
        문장: m[0] + ' (오늘은 ' + M + '월)', 출처: '코드 가드' });
  }
  return out;
}

/* ---------- 범위별 풀이 ----------
   보고 싶은 기간만 골라 읽는다. 기간이 다르면 봐야 할 재료도 다르다. */
function scopePacket(kind, r) {
  const base = { 날짜: todayInfo(), 명식: r.base.chart,
    강약: { 판정: r.strength.level, 인비비율: r.strength.allyPct },
    격국: { 이름: r.격국.name, 별칭: r.격국.별칭, 성패: r.성패.판정 },
    용신: r.yongsin.primary, 오행: r.deep.table, 십성세력: r.groupPower,
    현재나이: r.현재나이 };
  const idx = r.현재대운 ?? 0;
  if (kind === '평생')
    return { ...base, 범위: '평생 — 타고난 구조 전체', 통근: r.통근.일간,
      조후: r.yongsin.johu, 그릇: r.격국고저, 일주론: r.일주론, 조합: r.패턴,
      신살: r.base.sinsal, 관계: r.base.relations, 궁성: r.궁성, 묘고: r.묘고,
      자식부모: r.자식부모, 영역: r.영역운세,
      대운전체: r.대운.map(d => `${d.시작나이}~${d.끝나이}세 ${d.간지} ${d.종합}`) };
  if (kind === '대운')
    return { ...base, 범위: `지금 대운 10년 — ${r.대운[idx].간지}`,
      현재대운: r.대운[idx], 대운영역: r.대운영역 ? r.대운영역[idx] : null,
      다음대운: r.대운[idx + 1] || null,
      다음대운영역: r.대운영역 ? r.대운영역[idx + 1] : null,
      지난대운: idx > 0 ? r.대운[idx - 1] : null,
      격변화: r.격변화, 교운기: r.교운기,
      이구간세운: (r.세운 || []).slice(0, 6) };
  if (kind === '올해') {
    const y = new Date().getFullYear();
    const 올 = (r.세운 || []).find(s => s.연도 === y) || (r.세운 || [])[0];
    return { ...base, 범위: `${y}년 한 해`, 올해: 올,
      현재대운: r.대운[idx], 대운영역: r.대운영역 ? r.대운영역[idx] : null,
      올해열두달: r.월운 || [], 내년: (r.세운 || []).find(s => s.연도 === y + 1) || null,
      삼재: 올 && 올.삼재 ? 올.삼재 : null };
  }
  // 이번 달
  const now = new Date();
  const 이번 = (r.월운 || []).find(x => {
    const s = new Date(x.시작), e = new Date(x.끝);
    return now >= s && now <= e;
  }) || (r.월운 || [])[now.getMonth()];
  return { ...base, 범위: `${now.getMonth() + 1}월 한 달`, 이번달: 이번,
    앞뒤달: (r.월운 || []).filter(x => Math.abs(x.월차 - (이번 ? 이번.월차 : 0)) === 1),
    올해: (r.세운 || [])[0] || null, 오늘: r.일운 || null,
    현재대운: r.대운[idx] };
}

async function runScope(kind, r, callLLM, opts = {}) {
  const a = AGENTS.find(x => x.id === 'beomwi');
  const onProgress = opts.onProgress;
  onProgress && onProgress({ type: 'wave-start', agents: [a.name] });
  const out = await runAgent(a, scopePacket(kind, r), callLLM, opts);
  onProgress && onProgress({ type: 'agent-done', id: a.id, name: a.name, ok: !out.__error,
    사유: out.__error ? String(out.__error) : null });
  const facts = factSet(r), nums = numberSet(r, null);
  let issues = out.__error ? []
    : guard('beomwi', out, facts, nums, { '인비': r.strength.allyPct })
        .concat(checkPositions(JSON.stringify(out), r.saju, 'beomwi'))
        .concat(checkAdvice(out.지금할것, 'beomwi'))
        .concat(checkHeadline(out, 'beomwi'))
        .concat(checkPlainWords(out, 'beomwi'))
        .concat(checkPastDates(JSON.stringify(out.지금할것 || []), 'beomwi'));
  return { 결과: { 제목: out.제목 || kind + ' 풀이', 한줄요약: out.한줄요약 || '',
                  본문: out.본문 || [], 실행요약: out.지금할것 || [],
                  한계: out.한계 || '사주는 경향을 읽는 도구입니다. 앞일을 정해주지 않습니다.' },
           원본: out, 검증: { 코드가드: issues },
           품질: { 지적건수: issues.length, 최종가드: 0, 통과: issues.length === 0 } };
}

/* ---------- 상담 ----------
   질문 하나에 답하는 단일 호출. 재료는 질문 종류에 맞춰 골라 담는다. */
function consultPacket(kind, data, question, history) {
  const 이전 = (history || []).slice(-4).map(h => ({ 물음: h.q, 답했던것: String(h.a || '').slice(0, 400) }));
  if (kind === 'match') {
    const g = data.궁합;
    return { 질문: question, 종류: '궁합', 날짜: todayInfo(),
      이전대화: 이전.length ? 이전 : null,
      두사람: { A: data.A.입력.명식 || data.A.입력.양력, B: data.B.입력.명식 || data.B.입력.양력 },
      총점: g.총점, 등급: g.등급, 위치: g.위치, 유형: g.관계유형,
      관계종류: g.관계종류.종류, 일간: g.속궁합.일간, 일지: g.속궁합.일지,
      용신상보: g.용신상보, 조후강약: g.조후강약, 궁위별: g.궁위별,
      매트릭스: g.전체매트릭스.요약, 리스크: g.인연리스크,
      함께보는해: (data.운의동조 && data.운의동조.표) || [],
      결혼적기: data.결혼적기 || null };
  }
  const r = data;
  const idx = r.현재대운 ?? 0;
  return { 질문: question, 종류: '원국', 날짜: todayInfo(),
    이전대화: 이전.length ? 이전 : null,
    명식: r.base.chart, 강약: r.strength, 통근: r.통근.일간.verdict,
    격국: { 이름: r.격국.name, 별칭: r.격국.별칭, 본기격: r.격국.본기격,
            유파: r.격국.유파, 성패: r.성패.판정 },
    용신: r.yongsin.primary, 용희기구한: r.yongsin.chain, 조후: r.yongsin.johu,
    오행: r.deep.table, 십성세력: r.groupPower,
    일주론: r.일주론, 조합: r.패턴, 신살: r.base.sinsal, 관계: r.base.relations,
    묘고: r.묘고, 궁성: r.궁성, 자식부모: r.자식부모, 명궁: r.명궁,
    영역: r.영역운세,
    현재나이: r.현재나이,
    현재대운: r.대운[idx], 다음대운: r.대운[idx + 1] || null,
    지난대운: r.대운.slice(0, idx).map(d => `${d.시작나이}~${d.끝나이}세 ${d.간지} ${d.종합}`),
    앞으로대운: r.대운.slice(idx, idx + 4).map(d => `${d.시작나이}~${d.끝나이}세 ${d.간지} ${d.종합}`),
    세운: (r.세운 || []).map(s => `${s.연도} ${s.간지} ${s.종합}${s.삼재 ? ' 삼재' + s.삼재.단계 : ''}`),
    교운기: r.교운기, 격변화: r.격변화, 시운: r.시운 || null };
}

async function runConsult(kind, data, question, callLLM, opts = {}) {
  const history = opts.history || [];
  const a = AGENTS.find(x => x.id === 'sangdam');
  const onProgress = opts.onProgress;
  onProgress && onProgress({ type:'wave-start', agents:[a.name] });
  const packet = consultPacket(kind, data, question, history);
  const out = await runAgent(a, packet, callLLM, opts);
  onProgress && onProgress({ type:'agent-done', id:a.id, name:a.name, ok: !out.__error });
  const facts = kind === 'match' ? factSet(data.A) : factSet(data);
  if (kind === 'match') for (const f of factSet(data.B)) facts.add(f);
  const nums = kind === 'match'
    ? new Set([...numberSet(data.A, data), ...numberSet(data.B, null)])
    : numberSet(data, null);
  const keyed = kind === 'match' ? { '총점': data.궁합.총점 }
    : { '인비': data.strength.allyPct };
  let issues = out.__error ? [] : guard('sangdam', out, facts, nums, keyed);
  // 재료의 등급과 답변의 방향이 어긋나는지 본다.
  // 현재 대운이 좋은데 '미루라'로 결론내는 사례가 실제로 나왔다.
  if (!out.__error && kind !== 'match') {
    const text = (out.답 || '') + ' ' + (out.해볼것 || []).map(x => x.제안 + ' ' + (x.이유||'')).join(' ');
    const cur = data.대운 && data.대운[data.현재대운 ?? 0];
    const 좋은대운 = cur && ['좋음', '매우 좋음'].includes(cur.종합);
    // 결론의 방향은 '답'에서 본다. 세부 일정 하나를 미루자는 제안까지 걸면 오탐이 난다
    // (실측: "지금이 무난하다"고 해놓고 부수 행사만 미루라 한 답변이 걸렸다)
    const 답 = out.답 || '';
    const 미루기 = /기다리|미루|때가 아니|지금은 아직|보류|삼가|자제하는 것이 좋/.test(답);
    const 하라는쪽 = /지금이|무난|나쁘지 않|좋은 때|진행해도|해도 된|유리합니다|적기/.test(답);
    if (좋은대운 && 미루기 && !하라는쪽)
      issues.push({ 대상: 'sangdam', 유형: '재료와 결론이 어긋남',
        문장: `현재 대운 ${R.josa(cur.간지, '은는')} '${cur.종합}'인데 답변은 미루라는 방향이다`,
        출처: '코드 가드' });
    const 시각표기 = new RegExp([
      '[자축인묘진사오미신유술해]시',                 // 자시 축시…
      '\\d{1,2}\\s*[~\\-–]\\s*\\d{1,2}\\s*시',            // 23~07시
      '[자축인묘진사오미신유술해]\\s*[~\\-–]\\s*[자축인묘진사오미신유술해]',  // 자~묘
      '\\d{1,2}\\s*시\\s*[~\\-–]',                        // 3시~
      '새벽\\s*\\d',                                   // 새벽 3
    ].join('|'));
    if (시각표기.test(text) && !/하루|시간대|몇 시|어느 시간/.test(question))
      issues.push({ 대상: 'sangdam', 유형: '시운 오용',
        문장: '하루 시간대를 묻지 않았는데 시각을 제안했다', 출처: '코드 가드' });
    issues.push(...checkPastDates(text, 'sangdam'));
    if (kind !== 'match') issues.push(...checkPositions(text, data.saju, 'sangdam'));
    issues.push(...checkAdvice(out.해볼것, 'sangdam'));
    const 양다리2 = /어느 쪽이든|둘 다 (가능|열려)|선택은 본인|하기 나름|본인의 몫/;
    if (양다리2.test(out.답 || ''))
      issues.push({ 대상: 'sangdam', 유형: '결론 없이 양쪽만 말함',
        문장: (out.답 || '').match(양다리2)[0], 출처: '코드 가드' });
    // 인생 대사를 몇 년씩 뒤로 넘기라는 조언은 실생활에 해가 된다.
    // "미루"라는 말이 없어도 "2031년 이후로"만 있으면 사실상 같은 뜻이다.
    const 대사 = /결혼|출산|이사|창업|이직|본식|혼인|시험|유학|개업/;
    const 제안문 = (out.해볼것 || []).map(x => (x.제안 || '') + ' ' + (x.이유 || '')).join(' ');
    for (const mm of (제안문 + ' ' + 답).matchAll(/(20\d\d)\s*년\s*(이후|이후로|뒤로|부터|지나서|넘어서)/g)) {
      const gap = +mm[1] - new Date().getFullYear();
      if (gap >= 2 && 대사.test(제안문 + ' ' + 답)) {
        issues.push({ 대상: 'sangdam', 유형: '삶을 여러 해 미루라고 조언',
          문장: `${mm[1]}년 이후로 넘기라는 제안 (${gap}년 뒤)`, 출처: '코드 가드' });
        break;
      }
    }
    if (/당신/.test(text))
      issues.push({ 대상: 'sangdam', 유형: "'당신' 호칭 사용",
        문장: '문체 지시에서 쓰지 않기로 한 표현', 출처: '코드 가드' });
  }
  return { 결과: { 제목: '상담 — ' + question,
                  한줄요약: '', 본문: [{ 섹션: '답', 내용: out.답 || (out.__text || '') }]
                    .concat((out.근거 || []).length
                      ? [{ 섹션: '무엇을 보고 말했나',
                           내용: (out.근거 || []).map(x => `· ${x.무엇} — ${x.어디서}`).join('\n') }] : []),
                  실행요약: (out.해볼것 || []).map(x => ({ 제안: x.제안, 이유: x.이유 })),
                  한계: out.한계 || '사주는 경향을 읽는 도구입니다. 앞일을 정해주지 않습니다.' },
           원본: out, 검증: { 코드가드: issues },
           품질: { 지적건수: issues.length, 최종가드: 0, 통과: issues.length === 0 } };
}

/* ---------- 타로 파이프라인 ---------- */
async function runTarot(payload, callLLM, opts = {}) {
  const onProgress = opts.onProgress;
  const a = AGENTS.find(x => x.id === 'tarot_read');
  onProgress && onProgress({ type:'wave-start', agents:[a.name] });
  const out = await runAgent(a, { ...payload, 날짜: todayInfo() }, callLLM, opts);
  onProgress && onProgress({ type:'agent-done', id:a.id, name:a.name, ok: !out.__error });
  // 타로는 카드 이름이 재료이므로 간지 대조는 하지 않고 금지표현만 본다
  let issues = out.__error ? [] : guard('tarot_read', out, new Set(), null, null)
    .filter(i => i.유형 !== '근거 누락' && !/간지|글자/.test(i.유형));
  if (!out.__error) {
    const text = (out.흐름 || '') + ' ' + (out.카드별 || []).map(c => c.읽기).join(' ') +
      ' ' + (out.지금할것 || []).map(x => x.제안 + ' ' + (x.이유||'')).join(' ');
    issues = issues.concat(checkPastDates(text, 'tarot_read'));
    issues = issues.concat(checkAdvice(out.지금할것, 'tarot_read'));
    // 양쪽을 다 말하고 끝내면 점을 본 의미가 없다
    const 양다리 = /어느 쪽이든|둘 다 (가능|열려)|할 수도 있고|하기 나름|선택에 달려|본인의 몫|결과를 가를/;
    if (양다리.test(out.흐름 || ''))
      issues.push({ 대상: 'tarot_read', 유형: '결론 없이 양쪽만 말함',
        문장: (out.흐름 || '').match(양다리)[0], 출처: '코드 가드' });
    // 원론적인 제안
    const 원론 = /객관적으로 (정리|파악)|계획을 세우|상황을 점검|신중하게 생각|마음을 정리/;
    const 제안들 = (out.지금할것 || []).map(x => (x.제안 || '')).join(' ');
    if (원론.test(제안들))
      issues.push({ 대상: 'tarot_read', 유형: '누구에게나 해당하는 제안',
        문장: 제안들.match(원론)[0], 출처: '코드 가드' });
    // 질문이 없는데 특정 주제로 단정했는지
    if (!payload.질문) {
      const 주제 = [[/연애|사랑|배우자|이성|남자친구|여자친구|결혼|상대방|연인/, '연애·관계'],
                   [/이직|퇴사|승진|직장 상사|부서/, '직장'],
                   [/투자|주식|대출|빚|재테크/, '돈']];
      for (const [re, name] of 주제)
        if (re.test(text)) issues.push({ 대상: 'tarot_read', 유형: '질문 없이 주제 단정',
          문장: `질문이 없는데 ${name} 주제로 읽었다`, 출처: '코드 가드' });
    }
  }
  return { 결과: { 제목:'타로 — ' + payload.스프레드,
                  한줄요약: out.흐름 || '',
                  본문: (out.카드별 || []).map(c => ({ 섹션: c.자리 + ' · ' + c.카드, 내용: c.읽기 })),
                  실행요약: out.지금할것 || [],
                  한계: '타로는 지금 마음이 어디를 향하는지 비추는 도구입니다. 앞일을 정해주는 것이 아닙니다.' },
           원본: out, 검증: { 코드가드: issues },
           품질: { 지적건수: issues.length, 최종가드: 0, 통과: true } };
}

/* ---------- Claude API 호출기 (Worker/브라우저 공용) ---------- */
function makeClaudeCaller({ model = 'claude-sonnet-4-6', maxTokens = 1600, fetchImpl } = {}) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  return async ({ system, user }) => {
    const res = await f('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: user }] }),
    });
    const data = await res.json();
    return (data.content || []).map(c => c.type === 'text' ? c.text : '').join('\n');
  };
}

module.exports = { runReading, runMatch, runFortune, runTarot, runConsult, runScope, runAgent, runWave, guard, factSet, numberSet, checkNumbers,
                   parseJSON, makeClaudeCaller, BANNED };

return module.exports; })();

/* ===== term-data.js ===== */
__mods["term-data"] = (function(){
var module = { exports: {} }; var exports = module.exports;
/* =============================================================
   term-data.js — 화면에서 누르면 뜨는 설명
   각 항목은 "이게 뭐냐"(공통)와 "내 경우"(그 사람 결과에 맞춘 말) 둘로 나눈다.
   근거: 정해 만세력 사주강의 11·15·16·18·19강, 자평진전 성패론
   ============================================================= */

const R = require('./saju-rules');

/* 오행이 없거나 많으면 삶에서 어떻게 나타나는지.
   "적다"고만 하면 그래서 뭐가 어떻다는 건지 모른다. */
const 오행뜻 = {
  목: { 없음:'새 일을 시작하거나 앞으로 뻗어나가는 힘이 약합니다. 계획은 잘 세우는데 첫발을 떼기가 어렵고, 자라나는 것을 지켜보는 인내도 부족하기 쉽습니다. 몸으로는 간·눈·근육 쪽을 살펴야 합니다.',
        적음:'시작하고 키우는 힘이 남보다 덜합니다. 남이 벌여놓은 일을 이어받는 쪽이 편하고, 새 것을 만들 때는 시간이 더 걸립니다.',
        알맞음:'시작할 줄도 알고 기다릴 줄도 압니다. 성장과 안정이 균형을 이룹니다.',
        많음:'무엇이든 벌이고 키우려는 힘이 큽니다. 아이디어와 의욕이 넘치는데, 거두어들이는 힘이 따라오지 않으면 벌여놓기만 하고 마무리가 약해집니다.',
        압도:'뻗어나가려는 힘이 지나쳐 한자리에 있지 못합니다. 고집이 세고 굽히지 않아 부딪힘이 잦고, 간이나 신경이 예민해지기 쉽습니다.' },
  화: { 없음:'드러내고 표현하는 힘이 약합니다. 속은 있는데 밖으로 내보이지 못해 오해를 사고, 열정이 오래가지 않습니다. 몸으로는 심장·혈압·눈을 살펴야 합니다.',
        적음:'표현이 담백하고 감정을 잘 안 드러냅니다. 차분해 보이지만 열의를 보여야 할 자리에서 손해를 보기도 합니다.',
        알맞음:'표현할 때 표현하고 참을 때 참습니다. 열정이 알맞게 나옵니다.',
        많음:'표현력과 열정이 큽니다. 사람 앞에 서는 일이 맞고 분위기를 이끕니다. 대신 성급하고 감정 기복이 있어 말이 앞서기 쉽습니다.',
        압도:'열이 지나쳐 스스로를 태웁니다. 급하고 폭발적이라 후회할 말과 행동이 잦고, 심장·혈압·불면에 신경 써야 합니다.' },
  토: { 없음:'중심을 잡고 버티는 힘이 약합니다. 남의 말에 쉽게 흔들리고 신용을 쌓는 데 시간이 걸립니다. 몸으로는 위장·소화기를 살펴야 합니다.',
        적음:'중재하고 품는 역할이 덜합니다. 자기 일은 잘하지만 사이에서 조율하는 자리는 버겁습니다.',
        알맞음:'중심이 서 있고 신용이 쌓입니다. 사람들 사이에서 균형을 잡습니다.',
        많음:'듬직하고 신용이 두텁습니다. 남이 기대는 자리가 됩니다. 대신 변화를 싫어하고 굼떠서 기회를 놓치기 쉽고, 생각이 많아 결정이 느립니다.',
        압도:'너무 무거워 움직이지 않습니다. 고집스럽고 답답해 보이며, 소화기와 살이 찌는 쪽을 살펴야 합니다.' },
  금: { 없음:'끊고 정리하는 힘이 약합니다. 미련이 남아 결정을 못 내리고, 규칙보다 정에 끌려갑니다. 몸으로는 폐·기관지·피부를 살펴야 합니다.',
        적음:'결단이 느리고 마무리가 무릅니다. 시작은 하는데 끝을 딱 맺지 못합니다.',
        알맞음:'끊을 때 끊고 정리할 때 정리합니다. 원칙과 유연함이 함께 있습니다.',
        많음:'결단력과 원칙이 강합니다. 정리 정돈이 빠르고 일처리가 깔끔합니다. 대신 차갑고 날카로워 보여 사람이 다가오기 어렵고, 융통성이 부족합니다.',
        압도:'날이 너무 서 있어 주변을 베고 스스로도 벱니다. 지나치게 엄격하고 외로워지기 쉬우며, 폐·대장·피부 질환에 신경 써야 합니다.' },
  수: { 없음:'생각을 깊이 하고 기다리는 힘이 약합니다. 융통성이 없고 한 방향으로만 가며, 지혜롭게 돌아가는 것을 못 합니다. 몸으로는 신장·방광·생식기와 수분 부족을 살펴야 합니다.',
        적음:'유연함이 덜하고 속을 잘 안 드러냅니다. 정면 돌파는 잘하는데 우회하는 재주가 부족합니다.',
        알맞음:'깊이 생각할 줄 알고 유연하게 대처합니다. 지혜와 실행이 균형을 이룹니다.',
        많음:'생각이 깊고 유연합니다. 상황을 읽고 돌아가는 재주가 있습니다. 대신 생각만 하다 움직이지 못하거나, 속을 알 수 없다는 말을 듣습니다.',
        압도:'물이 넘쳐 떠내려갑니다. 우울하고 불안한 생각에 잠기기 쉽고, 결단을 못 내려 흘러가는 대로 삽니다. 신장·방광·부종을 살펴야 합니다.' },
};

/* 처음 보는 사람이 기대야 할 바탕. 설명마다 필요한 만큼 끌어 쓴다. */
const 바탕 = {
  여덟글자: '사주는 태어난 해·달·날·시각을 각각 두 글자씩, 모두 여덟 글자로 세웁니다.',
  천간지지: '각 기둥의 윗글자를 천간, 아랫글자를 지지라 합니다. ' +
            '천간은 겉으로 드러난 기운이고 지지는 바탕에 깔린 기운입니다.',
  일간: '태어난 날의 윗글자를 일간이라 하고, 이것이 사주에서 "나"에 해당합니다. ' +
        '나머지 일곱 글자는 모두 이 글자를 기준으로 읽습니다.',
  월지: '태어난 달의 아랫글자를 월지라 합니다. 계절을 담고 있어 사주에서 가장 힘이 셉니다.',
  십성다섯: '나를 돕는 인성·비겁, 내가 쓰는 식상·재성, 나를 누르는 관성. 이 다섯으로 나눕니다.',
};
const 왕상휴수사 = { 旺:'가장 왕성한', 相:'힘을 받는', 休:'한풀 꺾인', 囚:'갇혀 약한', 死:'꺼져가는' };

const T_LEVEL = {
  '태강':'일간이 지나치게 강합니다. 힘은 넘치는데 쓸 데가 마땅치 않으면 헛돌기 쉬워, 그 기운을 빼줄 자리(일·재물·사람)를 만드는 게 관건입니다.',
  '신강':'일간이 넉넉한 편입니다. 책임과 일을 감당할 힘이 있으니, 주는 쪽·맡는 쪽에 서는 게 맞습니다.',
  '중화':'강하지도 약하지도 않은 자리입니다. 어느 쪽으로도 치우치지 않아 운에 따라 유연하게 움직일 수 있습니다. 다만 판정이 경계에 걸려 있어 해석의 방향이 갈릴 수 있습니다.',
  '신약':'일간이 얇은 편입니다. 혼자 밀어붙이기보다 기대고 배우고 받쳐줄 사람을 곁에 두는 쪽이 낫습니다.',
  '태약':'일간이 많이 약합니다. 무리하면 회복이 더디니, 감당할 크기를 정해두고 움직이는 편이 안전합니다.',
};
const T_ROOT = {
  '강근':'지지에 뿌리가 단단합니다. 겉으로만 센 게 아니라 실속이 있습니다.',
  '유근':'쓸 만한 뿌리가 있습니다. 버틸 바탕은 됩니다.',
  '약근':'뿌리가 얕습니다. 기세는 있어도 오래 버티기는 버겁습니다.',
  '무근(無根)':'지지에 뿌리가 없습니다. 겉은 있으나 받쳐주는 게 없어, 혼자 버티기보다 흐름을 따라가는 편이 나은 구조입니다.',
};
const T_GYEOK = {
  '비견격':'스스로 서는 힘이 격이 됐습니다. 자립심과 대인관계가 강점이고, 내 몫을 지키는 데 관심이 큽니다.',
  '겁재격':'겨루는 힘이 격이 됐습니다. 추진력과 승부욕이 강하지만 재물이 새기 쉬워 관리가 필요합니다.',
  '식신격':'만들어내는 힘이 격이 됐습니다. 먹고사는 복이 붙고 꾸준한 생산에 강합니다.',
  '상관격':'표현하는 힘이 격이 됐습니다. 재능과 말이 무기인데, 규범·상사와 부딪히기 쉬운 면도 함께 있습니다.',
  '정재격':'성실하게 쌓는 재물이 격이 됐습니다. 고정 수입과 실속에 강합니다.',
  '편재격':'크게 굴리는 재물이 격이 됐습니다. 감각과 배포가 있고, 한곳에 매이지 않으려 합니다.',
  '정관격':'명예와 자리가 격이 됐습니다. 규범 있는 조직에서 인정받는 구조입니다.',
  '편관격':'압박과 책임이 격이 됐습니다. 강한 자극을 견디며 크는 형태라, 잘 다루면 권위가 되고 못 다루면 스트레스가 됩니다.',
  '정인격':'배움과 문서가 격이 됐습니다. 학습·자격·계약이 인생의 축이 됩니다.',
  '편인격':'치우친 배움이 격이 됐습니다. 특수한 분야에 깊이 파고드는 재능이 있습니다.',
};
/* 격국 별칭 */
const T_GYEOK_ALT = {
  건록격:'월지가 비견인 격입니다. 제 힘으로 서는 자리라 자립심이 강하고 남에게 기대지 않습니다. 다만 기댈 곳 없이 혼자 감당하는 면도 함께 있습니다.',
  양인격:'월지가 겁재이면서 양간으로 태어난 격입니다. 날이 선 칼을 쥔 형상이라 추진력이 대단한 대신 과격해지기 쉬워, 그 칼을 눌러줄 관성이 있어야 제대로 쓰입니다.',
};

/* 종격 — 억부 논리가 통하지 않는 특수격 */
const T_JONG = {
  종왕격:'비겁이 압도적이라 그 세력을 거스르지 않고 따라가는 격입니다. 나를 돕는 기운이 오면 좋고, 누르려 드는 기운이 오면 크게 흔들립니다.',
  종강격:'인성이 압도적인 격입니다. 배움·문서·윗사람의 힘을 따라가는 구조로, 그 흐름을 막는 재성이 오면 탈이 납니다.',
  종아격:'식상이 압도적인 격입니다. 내가 만들어내는 것에 인생을 싣는 구조라, 표현하고 생산하는 자리에서 풀립니다.',
  종재격:'재성이 압도적인 격입니다. 재물과 현실의 흐름을 따라가는 구조로, 큰 자금을 다루는 일과 인연이 깊습니다.',
  종관격:'관성이 압도적인 격입니다. 조직과 규범을 따라가는 구조라, 자리와 직함이 곧 힘이 됩니다.',
};

/* 십성 조합 — 두 십성이 만나 만드는 구조 */
const PATTERN_T = {
  살인상생:'나를 누르는 기운(편관)의 압박이 나를 돕는 기운(인성)을 거쳐 나를 키우는 힘으로 바뀝니다. 스트레스가 배움과 자격으로 전환되는 구조라 조직·전문직에서 크게 쓰입니다.',
  관인상생:'정관과 인성이 이어져 자리와 배움이 서로를 밀어줍니다. 명예로운 직역에서 안정적으로 오르는 형태입니다.',
  식신제살:'내가 만들어내는 기운(식신)이 나를 누르는 기운(편관)을 눌러 흉이 권위로 바뀝니다. 압박을 실력으로 제압하는 구조입니다.',
  제살태과:'나를 누르는 기운을 제압하는 힘이 지나쳐 오히려 쓸 관이 남지 않습니다. 통제가 과해 기회를 놓치기 쉽습니다.',
  살중신경:'나를 누르는 기운은 무거운데 내 힘이 가볍습니다. 감당보다 버티기가 되기 쉬워, 인성으로 받쳐주는 것이 관건입니다.',
  관살혼잡:'정관과 편관이 섞여 있습니다. 자리와 압박이 뒤엉켜 방향이 흔들리기 쉽고, 하나로 정리될 때 풀립니다.',
  양인가살:'양인(날이 선 기운)의 날카로움을 편관이 다스립니다. 거칠지만 통제되면 큰 힘이 되는 구조입니다.',
  상관견관:'상관이 정관을 상하게 합니다. 규범·상사와 부딪히기 쉬워, 인성으로 눌러주면 완화됩니다.',
  상관패인:'인수가 상관의 날을 눌러 재능이 품위를 얻습니다. 표현력이 격을 갖추는 형태입니다.',
  상관생재:'상관의 재능이 재물로 이어집니다. 드러내는 힘으로 돈을 버는 구조입니다.',
  식상생재:'만들어낸 것이 재물이 됩니다. 기술·콘텐츠·서비스처럼 결과물로 수익을 내는 형태입니다.',
  재생관:'재물이 자리를 만들어줍니다. 실적이 직함으로 이어지는 구조입니다.',
  재생살:'재물이 나를 누르는 기운(편관, 칠살이라고도 합니다)을 키웁니다. 돈 문제가 압박으로 되돌아오기 쉬워 관리가 필요합니다.',
  재다신약:'재물은 많은데 감당할 힘이 얇습니다. 벌어도 지키기 어려우니 규모를 정해두는 편이 낫습니다.',
  탐재괴인:'재물을 탐하다 인성을 깨뜨립니다. 눈앞의 이익 때문에 배움이나 명예를 잃기 쉬운 구조입니다.',
  군겁쟁재:'비겁이 무리 지어 재물을 다툽니다. 들어온 것을 나누게 되니 동업·보증에 특히 조심해야 합니다.',
  모자멸자:'인성이 지나쳐 오히려 나를 덮습니다. 도움이 과해 자립이 늦어지는 형태입니다.',
  효신탈식:'편인이 식신을 빼앗습니다. 만들어내려는 힘이 생각에 막히기 쉽습니다.',
  신왕무의:'힘은 넘치는데 쓸 데가 마땅치 않습니다. 그 기운을 내보낼 자리를 만드는 것이 관건입니다.',
  목화상관:'목 일간이 화로 뿜어내는 구조입니다. 표현이 화려하고 뜨거워 예술·언어 쪽과 인연이 깊습니다.',
  금수상관:'금 일간이 수로 뿜어내는 구조입니다. 맑고 예리한 두뇌를 뜻해 학문·기술과 어울립니다.',
  재관쌍미:'일지 안에 재물과 자리가 함께 들었습니다. 둘을 한 자리에서 쥐는 형태라 감당할 힘이 있으면 크게 쓰입니다.',
  '재관쌍미(신약)':'재와 관이 함께 들었으나 감당할 힘이 모자랍니다. 쥘 것은 많은데 버거운 구조입니다.',
};

const T_SUCCESS = {
  '성격(成格)':'격이 온전히 섰습니다. 그 격의 장점이 제대로 드러날 바탕이 있습니다.',
  '성중유패(成中有敗)':'격은 섰는데 흔드는 요소가 함께 있습니다. 잘 풀릴 때와 막힐 때의 낙차가 있다는 뜻입니다.',
  '패격(敗格)':'격을 받쳐줄 글자 없이 깨는 글자만 있습니다. 격의 힘보다 운의 흐름을 더 봐야 합니다.',
  '격이 뚜렷하지 않음':'격의 색이 흐립니다. 한 가지로 규정하기 어려운 사주입니다.',
};
const T_YONGSIN = {
  '비겁':'나와 같은 기운이 약입니다. 사람·동료·내 힘을 쓰는 쪽으로 가면 풀립니다.',
  '식상':'만들고 표현하는 기운이 약입니다. 결과물을 내놓고 드러내는 쪽에서 길이 열립니다.',
  '재성':'재물과 현실이 약입니다. 실물·수익·구체적인 것을 다루는 쪽이 맞습니다.',
  '관성':'규범과 자리가 약입니다. 조직·책임·직함이 있는 쪽에서 자리를 잡습니다.',
  '인성':'배움과 문서가 약입니다. 공부·자격·사람의 도움을 통해 풀립니다.',
};
const T_BAND = {
  '상격(上格)':'그릇이 큰 편입니다. 다만 크기지 길흉이 아니라, 운이 받쳐줘야 실제로 쓰입니다.',
  '중상격':'그릇이 넉넉한 편입니다.','중격':'보통 크기입니다. 운의 흐름에 따라 발현 폭이 달라집니다.',
  '중하격':'그릇이 다소 작습니다. 크게 벌리기보다 확실한 데 집중하는 쪽이 유리합니다.',
  '하격':'그릇이 작은 편입니다. 다만 운로가 좋으면 제 몫은 충분히 합니다.',
};
const T_JOHU = {
  '조열':'사주가 뜨겁고 메마릅니다. 식혀주고 적셔주는 水가 귀합니다.',
  '한랭':'사주가 차갑습니다. 데워주는 火가 귀합니다.',
  '중화':'춥지도 덥지도 않습니다. 조후로 급한 건 없습니다.',
};

/* 십이신살 — 정해 만세력 19강 */
const SINSAL = {
  겁살:'무언가를 빼앗기기 쉬운 자리입니다. 경쟁심이 크고 얻고 잃는 폭이 넓습니다. 새 일을 크게 벌이는 건 신중하게.',
  재살:'바깥에서 오는 손해를 뜻합니다. 그래서 눈치가 빠르고 방어적입니다. 수옥살이라고도 합니다.',
  천살:'내 뜻과 무관하게 판이 뒤집히는 자리입니다. 평소 쌓아둔 게 있으면 크게 다치지 않는다고 봅니다.',
  지살:'움직임을 뜻합니다. 내가 원해서가 아니라 상황에 떠밀리는 이동입니다. 부동산과 인연이 있습니다.',
  연살:'흔히 말하는 도화입니다. 사람을 끄는 매력이고, 남 앞에 설 때 돋보입니다.',
  월살:'어두운 밤에 달빛만 있는 자리입니다. 새 일보다 하던 일을 지키는 게 낫고, 공부에는 오히려 좋습니다.',
  망신살:'체면이 상하기 쉬운 자리입니다. 다만 이미 드러낼 일이라면 이때 하는 게 낫다고 봅니다.',
  장성살:'십이신살 중 가장 좋게 보는 자리입니다. 한 분야에서 일가를 이룰 힘이 있습니다.',
  반안살:'말 안장에 앉은 자리입니다. 편안하고 안정적으로 흘러가는 기운입니다.',
  역마살:'스스로 움직이는 기운입니다. 이동·여행·외국과 인연이 있고, 한곳에 오래 있기 답답해합니다.',
  육해살:'끝을 앞두고 조급해지는 자리입니다. 불안이 앞서기 쉽습니다.',
  화개살:'화려함을 덮는다는 뜻입니다. 재능이 많아도 드러내길 꺼리고, 예술·종교·학문과 인연이 깊습니다.',
  천을귀인:'가장 좋은 길신입니다. 어려울 때 도와주는 사람이 나타난다고 봅니다.',
  문창귀인:'공부와 시험에 힘을 주는 자리입니다. 글과 배움에 강합니다.',
  양인살:'날이 선 칼입니다. 강한 추진력이자 위험이기도 해서, 칼을 쓰는 직역(의료·군경·법조)에서 오히려 잘 쓰입니다.',
  백호살:'예측하기 어려운 강한 기운입니다. 전문성과 집중력으로도 나타나고, 사고·질병 쪽 주의로도 봅니다.',
  괴강살:'비범한 총명함입니다. 카리스마와 극단성이 함께 있어 크게 오르거나 크게 흔들립니다.',
  귀문관살:'예민해지는 자리입니다. 남다른 직관과 집착·의심이 한 몸입니다.',
  재관쌍미:'일지 안에 재물(재성)과 자리(관성)가 함께 든 일주입니다. 壬午·癸巳가 대표적이고, 둘을 한 자리에서 쥐는 형태라 신강하면 크게 쓰이고 신약하면 버겁습니다.',
  현침살:'글자 모양이 바늘처럼 뾰족한 甲·辛·卯·午·申이 여럿 모인 것입니다. 신경이 예민하고 감각이 날카로워, 칼·바늘·펜을 쓰는 일(의료·기술·글)과 인연이 깊다고 봅니다. 대신 잔걱정과 불면이 따르기 쉽습니다.',
  홍염살:'스스로 타오르는 매력입니다. 도화가 남을 끌어당긴다면 홍염은 내가 먼저 다가가는 쪽이라, 예술·연예처럼 자신을 드러내는 일과 인연이 깊습니다.',
  '원진·귀문':'만나면 부딪히는데 떨어지면 그리워지는 애증(원진)에, 남다른 직관과 예민함(귀문)이 겹친 자리입니다. 둘이 함께 있으면 감정의 진폭이 특히 커집니다.',
  원진살:'만나면 부딪히는데 떨어지면 그리워지는 관계입니다. 애증이 반복됩니다.',
  공망:'비어 있다는 뜻입니다. 그 자리의 일은 손에 잘 잡히지 않지만, 욕심을 내려놓으면 오히려 편해진다고 봅니다.',
};

/* 오행 */
const OHAENG = {
  목:'뻗어나가는 기운입니다. 시작·성장·기획을 뜻하고 간·담·눈과 연결합니다.',
  화:'퍼지는 기운입니다. 표현·열정·확산을 뜻하고 심장·소장과 연결합니다.',
  토:'품는 기운입니다. 중재·신용·저장을 뜻하고 비위·소화기와 연결합니다.',
  금:'거두는 기운입니다. 결단·정리·규율을 뜻하고 폐·대장·피부와 연결합니다.',
  수:'스며드는 기운입니다. 지혜·유연함·저장을 뜻하고 신장·방광과 연결합니다.',
};

/* 십성 */
const SIPSEONG_T = {
  비견:'나와 같은 기운. 친구·동료·경쟁자이자 나 자신입니다.',
  겁재:'나와 오행은 같고 음양이 다름. 경쟁자이고 재물을 나누는 자리입니다.',
  식신:'내가 만들어내는 것. 일·먹을 복·표현력입니다.',
  상관:'내가 드러내는 것. 재능과 말인데 규범과 부딪히기도 합니다.',
  편재:'크게 굴리는 재물. 사업 감각이고 남자에겐 여자, 모두에겐 아버지입니다.',
  정재:'꾸준히 버는 재물. 월급과 실속이고 남자에겐 아내입니다.',
  편관:'나를 강하게 누르는 힘. 압박·책임이고 칠살이라 부릅니다.',
  정관:'나를 바르게 다스리는 힘. 직장·명예이고 여자에겐 남편입니다.',
  편인:'치우친 배움. 특수한 재능이고 어머니를 뜻하기도 합니다.',
  정인:'바른 배움. 공부·자격·문서이고 어머니를 뜻합니다.',
};

/* 십이운성 */
const UNSEONG_T = {
  절:'끊어졌다 다시 잇는 자리. 순수하고 기복이 큽니다.',
  태:'막 잉태된 자리. 조심스럽고 보호받으려 합니다.',
  양:'길러지는 자리. 무난하고 물려받는 것이 있습니다.',
  장생:'갓 태어난 자리. 사람 복이 있고 성장 가능성이 큽니다.',
  목욕:'씻는 자리. 감정이 풍부하고 변화가 잦습니다.',
  관대:'옷을 갖춰 입는 자리. 자신감이 앞섭니다.',
  건록:'제 힘으로 서는 자리. 자립심이 강합니다.',
  제왕:'가장 왕성한 자리. 주도적이고 기세가 셉니다.',
  쇠:'한풀 꺾인 자리. 노련하고 실속을 챙깁니다.',
  병:'병든 자리. 남을 헤아리고 생각이 많습니다.',
  사:'죽음의 자리. 사려 깊고 학문에 맞습니다.',
  묘:'무덤이자 창고. 모으고 감추는 성향입니다.',
};

const TERMS = { T_LEVEL, T_ROOT, T_GYEOK, T_GYEOK_ALT, T_JONG, PATTERN_T, T_SUCCESS,
                T_YONGSIN, T_BAND, T_JOHU, SINSAL, OHAENG, SIPSEONG_T, UNSEONG_T };

/* 네 기둥이 각각 무엇을 뜻하는지. 신살이 어느 자리에 붙었는지 설명할 때 쓴다.
   "년·월"이라고만 하면 처음 보는 사람은 그게 무엇을 가리키는지 알 수 없다.
   신살은 아래 글자(지지)에만 붙으므로 지지 기준으로 풀어 쓴다. */
const 자리뜻 = {
  년: { 이름:'연주', 짧게:'집안·어린 시절', 보는것:'조상과 집안, 자라난 환경과 어린 시절',
        뜻:'태어난 해의 자리입니다. 조상과 집안, 자라난 환경과 어린 시절을 봅니다' },
  월: { 이름:'월주', 짧게:'사회생활·직업', 보는것:'부모·형제와 사회생활, 그리고 직업',
        뜻:'태어난 달의 자리입니다. 부모·형제와 사회생활, 직업을 보는 가장 중요한 기둥입니다' },
  일: { 이름:'일주', 짧게:'나와 배우자', 보는것:'나 자신과 배우자',
        뜻:'태어난 날의 자리입니다. 윗글자가 나 자신이고 아랫글자가 배우자 자리라, 사주의 중심이 됩니다' },
  시: { 이름:'시주', 짧게:'자식·말년', 보는것:'자식과 말년, 내가 남기는 것',
        뜻:'태어난 시각의 자리입니다. 자식과 말년, 내가 남기는 것을 봅니다' },
  전체: { 이름:'사주 전체', 짧게:'여덟 글자 전반', 보는것:'여덟 글자 전반',
        뜻:'특정 자리가 아니라 여덟 글자 전반에 걸쳐 나타납니다' },
};
/* '~이라 / ~라' 처럼 두 글자짜리 조사도 받침에 따라 갈린다 */
function 이라(word) {
  const w = String(word);
  const c = w.charCodeAt(w.length - 1) - 0xAC00;
  const has = c >= 0 && c < 11172 ? (c % 28) !== 0 : true;
  return w + (has ? '이라' : '라');
}

function 자리설명(pos) {
  const list = Array.isArray(pos) ? pos : [pos];
  const ks = list.filter(p => 자리뜻[p]);
  if (!ks.length) return '';
  if (ks.length === 1) return `${자리뜻[ks[0]].이름} 자리입니다. ${자리뜻[ks[0]].뜻}.`;
  return ks.map(k => `${자리뜻[k].이름}(${자리뜻[k].짧게})`).join(', ') + ' 세 자리에 걸쳐 있습니다.'
    .replace('세 자리', ks.length === 2 ? '두 자리' : '세 자리');
}

/** 화면 항목 → { 제목, 뭐냐, 내경우 } */
function explain(kind, value, r) {
  const S = r && r.strength, Y = r && r.yongsin;
  switch (kind) {
    case '강약': return { 제목:'강약 — ' + value,
      뭐냐: 바탕.일간 + ' 그 "나"가 나머지 일곱 글자 사이에서 얼마나 힘이 있는지를 재는 것이 강약입니다. ' +
            '나를 낳아주는 기운과 나와 같은 편인 기운이 많으면 힘이 세다 하고, ' +
            '내가 써야 할 기운과 나를 누르는 기운이 많으면 힘이 약하다 합니다. ' +
            '힘이 세면 일을 벌이고 감당하는 쪽이 맞고, 약하면 기대고 받쳐주는 쪽이 편합니다. ' +
            '좋고 나쁨이 아니라 어느 방식이 맞는지를 가르는 기준입니다.',
      내경우: T_LEVEL[value] + (S ? ` 나를 돕는 기운이 여덟 글자 가운데 ${S.allyPct}%를 차지합니다. ` +
        '절반인 50%를 넘으면 힘이 있는 쪽으로 봅니다. ' +
        (S.confidence === '낮음'
          ? '다만 경계선에 가까워, 보는 사람에 따라 반대로 읽힐 수도 있는 자리입니다.'
          : '경계선에서 충분히 떨어져 있어 판정이 흔들릴 여지는 적습니다.') : '') };

    case '뿌리': return { 제목:'뿌리(통근) — ' + value,
      뭐냐: 바탕.천간지지 + ' 윗글자는 드러난 기운이라 눈에 띄지만, 아랫글자가 받쳐주지 않으면 오래가지 못합니다. ' +
            '줄기만 있고 뿌리가 없는 나무인 셈입니다. ' +
            '그래서 "나"에 해당하는 윗글자가 아랫글자들 속에 같은 편 기운을 두고 있는지를 따로 봅니다. ' +
            '이것을 뿌리를 내렸다, 통근했다고 합니다.',
      내경우: T_ROOT[value] + (r ? (() => {
        const rs = r.통근.일간.roots;
        if (!rs.length) return ' 여덟 글자 어디에도 나를 받쳐줄 같은 편 기운이 없습니다.';
        return ` ${rs.map(x => `${자리뜻[x.pos] ? 자리뜻[x.pos].이름 : x.pos}의 ${x.ji}`).join(', ')}에 뿌리를 두고 있습니다. ` +
               `점수로는 ${r.통근.일간.total}점인데, 100점 안팎이면 버틸 만하고 0에 가까우면 없는 것으로 봅니다.`;
      })() : '') };

    case '조합': return { 제목: value,
      뭐냐: '십성은 나를 기준으로 다른 글자가 어떤 역할인지 붙인 이름입니다. ' +
            '그 십성 두 가지가 사주 안에서 만나면 낱개일 때와 다른 성질이 생깁니다. ' +
            '예를 들어 나를 누르는 기운도 그것을 받아 소화할 기운이 옆에 있으면 압박이 아니라 성장이 됩니다. ' +
            '이런 짝을 조합이라 하고, 낱개 십성보다 삶의 결을 더 잘 보여줍니다.',
      내경우: (PATTERN_T[value] || '') +
        (r ? (() => { const p = (r.패턴||[]).find(x => x.name === value);
          if (!p) return '';
          const 힘 = { 뚜렷:'두 기운이 모두 겉으로 드러나 있어 뚜렷하게', 보통:'어느 정도',
                      암시:'두 기운 중 하나가 아랫글자 속에 숨어 있어 희미하게' }[p.force] || p.force;
          return ` 이 사주에서는 ${힘} 나타납니다.` +
            (p.구성 ? ` ${p.구성.replace(/\(투출\)/g, '(겉으로 드러남)').replace(/\(지지\)/g, '(아랫글자에 있음)')
              .replace(/\(암장\)/g, '(아랫글자 속에 숨음)')}으로 이루어집니다.` : '');
        })() : '') };

    case '종격': return { 제목:'특수격 — ' + value,
      뭐냐: '보통은 한쪽으로 치우친 기운을 반대편으로 메워 균형을 맞춥니다. ' +
            '그런데 한 기운이 너무 압도적이면 메우려는 시도 자체가 화를 부릅니다. ' +
            '큰 물결을 거스르지 않고 올라타는 편이 낫다고 보는 것이 특수격입니다. ' +
            '이때는 강한 쪽을 더 강하게 해주는 운이 오히려 좋습니다.',
      내경우: (T_JONG[value] || '') + (r ? (() => {
        const ev = String(r.yongsin.primary.evidence || '');
        const m2 = ev.match(/([가-힣]+)\s*세력\s*([\d.]+)%/);
        if (!m2) return ev ? ' ' + ev : '';
        return ` 여덟 글자 가운데 ${m2[1]}이 ${m2[2]}%를 차지합니다. ` +
          '한 기운이 70%를 넘으면 거스르기 어렵다고 보아 특수격으로 다룹니다.';
      })() : '') };

    case '격국': return { 제목:'격국 — ' + value + (r && r.격국.별칭 && r.격국.별칭 !== value ? ' (' + r.격국.name + ')' : ''),
      뭐냐: 바탕.월지 + ' 그 월지가 나에게 어떤 역할인지를 보고 사주의 큰 틀을 정하는데, 그것이 격국입니다. ' +
            '타고난 그릇의 모양이라고 보면 됩니다. ' +
            '나를 누르는 기운이 틀이 되면 압박을 견디며 크는 사람이고, ' +
            '내가 만들어내는 기운이 틀이 되면 표현하고 생산하며 크는 사람입니다. ' +
            '어디에서 힘을 내는 사람인지가 여기서 갈립니다.',
      내경우: (T_GYEOK_ALT[value] || T_GYEOK[value] || '') + (r ? (() => {
        const g = r.격국;
        let s2 = ` 태어난 달의 아랫글자 ${R.josa(R.J[r.saju.month.ji], '이가')}` +
          (g.월지십성 ? ` 나에게 ${이라(g.월지십성)} 이 격이 됐습니다.`
                      : ' 이 격의 기준입니다.');
        if (g.별칭 && g.별칭 !== value) s2 += ` ${g.별칭}이라고도 부릅니다.`;
        if (g.유파갈림) s2 += ` 다만 보는 방식에 따라 ${g.본기격}으로 읽기도 하는 자리입니다. ` +
          '어느 쪽이 틀렸다기보다 관법이 갈리는 경우입니다.';
        const 성패 = {
          '성격(成格)':'격이 제대로 섰습니다. 틀이 온전해 타고난 모양대로 힘을 쓸 수 있습니다.',
          '성중유패(成中有敗)':'격은 섰는데 그것을 흔드는 요소가 함께 있습니다. 잘 풀릴 때와 막힐 때의 낙차가 크다는 뜻입니다.',
          '패격(敗格)':'틀을 이루는 요소가 깨져 있습니다. 타고난 모양을 고집하기보다 다른 길을 찾는 편이 낫습니다.',
          '격이 뚜렷하지 않음':'틀을 세워줄 요소도 깨뜨릴 요소도 뚜렷하지 않습니다. 특정한 모양에 매이지 않는다는 뜻이기도 합니다.',
        }[r.성패.판정];
        return s2 + (성패 ? ' ' + 성패 : '');
      })() : '') };

    case '용신': return { 제목:'용신 — ' + value,
      뭐냐: '사주는 여덟 글자로 이루어지는데 다섯 기운이 고르게 들어차는 일은 드뭅니다. ' +
            '어딘가는 넘치고 어딘가는 비어 있죠. ' +
            '그 불균형을 메워줄, 이 사람에게 가장 아쉬운 기운을 용신이라 합니다. ' +
            '살면서 이 기운이 운에서 들어올 때 일이 풀리고, 반대로 이걸 깨는 기운이 오면 막힌다고 봅니다. ' +
            '사주에서 가장 중요하게 보는 한 가지입니다.',
      내경우: (T_YONGSIN[value] || '') + (r ? (() => {
        const y = r.yongsin.primary;
        const 몫 = r.groupPower[y.group];
        let s2 = '';
        if (y.type === '억부') s2 += ` 나를 돕는 기운이 ${r.strength.allyPct}%라 ${r.strength.verdict === '신강' ? '넘치는 쪽이어서 덜어낼' : '모자란 쪽이어서 채워줄'} 기운이 필요합니다.`;
        else if (y.type === '조후') s2 += ' 기후가 한쪽으로 치우쳐 그것부터 중화시켜야 합니다.';
        else if (y.type === '통관') s2 += ' 두 기운이 맞서 있어 그 사이를 이어줄 기운이 필요합니다.';
        if (몫 != null) {
          // 다섯 기운이 고르면 각 20%. 그보다 한참 적을 때만 모자라다고 해야 한다.
          if (몫 < 12) s2 += ` 그런데 여덟 글자 안에 ${몫}%뿐입니다. 다섯 기운이 고르면 각 20%씩이니 ` +
            '한참 모자란 셈이라, 정작 필요한 것이 손에 적게 쥐어진 형태입니다. ' +
            '운에서 이 기운이 들어오는 시기에 비로소 힘을 씁니다.';
          else if (몫 < 20) s2 += ` 여덟 글자 안에 ${몫}%로, 고른 몫인 20%에는 조금 못 미칩니다. ` +
            '운에서 보태지면 더 잘 쓰입니다.';
          else s2 += ` 여덟 글자 안에 ${몫}%로 이미 넉넉히 갖추고 있어, 그것을 살려 쓰는 것이 관건입니다.`;
        }
        return s2;
      })() : '') };

    case '그릇': return { 제목:'그릇 — ' + value,
      뭐냐: '격이 사주의 모양이라면 그릇은 그 크기입니다. ' +
            '틀이 온전한지, 필요한 기운을 실제로 갖췄는지, 버틸 뿌리가 있는지를 합쳐 봅니다. ' +
            '크다고 반드시 좋은 삶은 아니고 작다고 나쁜 것도 아닙니다. ' +
            '담을 수 있는 양이 얼마인지를 말할 뿐이고, 운이 받쳐줘야 실제로 채워집니다.',
      내경우: (T_BAND[value] || '') + (r ? (() => {
        const src = r.격국고저.항목 || [];
        const 풀기 = s2 => s2
          .replace(/상신은/g, '격을 세워주는 요소는')
          .replace(/상신이/g, '격을 세워주는 요소가')
          .replace(/상신/g, '격을 세워주는 요소')
          .replace(/파격 요소/g, '격을 깨는 요소')
          .replace(/일간에/g, '나에게')
          .replace(/충 (\d+) 형 (\d+)/g, (m, a, b) =>
            `부딪히는 관계가 ${a}개, 얽히는 관계가 ${b}개`)
          .replace(/약간의 탁함/g, '흐려지는 면이 조금 있음')
          .replace(/순방향/g, '좋은 방향으로 흐름')
          .replace(/용신 /g, '가장 필요한 기운인 ');
        const 항목 = (Array.isArray(src) ? src : [src]).map(x => {
          const raw = String(x);
          const n = parseFloat(raw);
          const 본문 = 풀기(raw.replace(/^([+-]?[\d.]+)\s*/, '').trim()).replace(/\.$/, '');
          if (!본문) return '';
          const 부호 = n > 0 ? '크기를 키우는 쪽' : n < 0 ? '크기를 깎는 쪽' : '중립';
          return `${본문}(${부호})`;
        }).filter(Boolean);
        return 항목.length ? ' 이렇게 헤아렸습니다 — ' + 항목.join(', ') + '.' : '';
      })() : '') };

    case '조후': return { 제목:'조후 — ' + value,
      뭐냐: '사주에도 기후가 있습니다. 태어난 달이 한겨울이면 차갑고 한여름이면 뜨겁습니다. ' +
            '거기에 여덟 글자 하나하나가 지닌 온도와 습기가 더해집니다. ' +
            '너무 춥거나 더우면, 또는 너무 마르거나 젖으면 사람이 살기 어렵듯 사주도 그렇습니다. ' +
            '그래서 치우친 기후를 중화시켜주는 기운을 귀하게 봅니다.',
      내경우: (T_JOHU[value] || '') + (r ? (() => {
        const j = r.yongsin.johu;
        const 온 = j.온도 > 0 ? '따뜻한' : j.온도 < 0 ? '차가운' : '중간';
        const 습 = j.습도 > 0 ? '메마른' : j.습도 < 0 ? '축축한' : '중간';
        // 숫자 뒤 조사는 읽는 음에 따라 갈리므로 조사를 붙이지 않는 문장으로 쓴다
        const 말 = (v2, 큰, 작은) => v2 > 3 ? 큰 : v2 < -3 ? 작은 : '중간에 가까운 편';
        return ` 이 사주의 온도는 ${j.온도}, 습도는 ${j.습도}입니다. ` +
          '0이 중간이고 플러스로 갈수록 뜨겁고 메마르며, 마이너스로 갈수록 차갑고 축축합니다. ' +
          '±3을 넘으면 치우친 것으로 봅니다. ' +
          `온도는 ${말(j.온도,'뜨거운 쪽','차가운 쪽')}, ` +
          `습도는 ${말(j.습도,'메마른 쪽','축축한 쪽')}입니다.` +
          (j.needed ? ` ${R.josa(j.needed, '이가')} 들어와야 균형이 잡힙니다.` : '');
      })() : '') };

    case '오행': return { 제목:'오행 — ' + value,
      뭐냐: '목화토금수 다섯 기운이 서로 낳고 누르며 돕니다. ' +
            '나무는 불을 낳고, 불은 흙을, 흙은 쇠를, 쇠는 물을, 물은 다시 나무를 낳습니다. ' +
            '반대로 나무는 흙을 누르고, 흙은 물을, 물은 불을, 불은 쇠를, 쇠는 나무를 누릅니다. ' +
            '사주 여덟 글자가 이 다섯 중 어디에 얼마나 몰려 있는지를 보면 ' +
            '무엇이 넘치고 무엇이 비었는지가 드러납니다.',
      내경우: (OHAENG[value] || '') + (r && r.deep ? (() => {
        const t2 = r.deep.table.find(x => x.오행 === value);
        if (!t2) return '';
        const 상태 = 왕상휴수사[t2.월령] || t2.월령;
        const v = t2.최종;
        const 단계 = v < 8 ? '없음' : v < 15 ? '적음' : v <= 25 ? '알맞음' : v < 40 ? '많음' : '압도';
        const 판단 = v === 0 ? '아예 없습니다'
          : v < 8 ? `${v}%로 거의 없는 편입니다`
          : v < 15 ? `${v}%로 적은 편입니다`
          : v <= 25 ? `${v}%로 알맞은 편입니다`
          : v < 40 ? `${v}%로 많은 편입니다`
          : `${v}%로 압도적입니다`;
        const 뜻 = (오행뜻[value] || {})[단계] || '';
        return ` 이 사주에서는 ${판단}. 다섯 기운이 고르면 하나에 20%씩이니 그것을 기준으로 봅니다. ` +
          (뜻 ? `그래서 ${뜻} ` : '') +
          (v === 0 ? '이 기운이 필요한 일은 운에서 들어오는 시기에 풀립니다. ' : '') +
          `태어난 계절에서는 ${상태} 자리에 놓입니다.`;
      })() : '') };


    case '신살': {
      const hit = r && r.base && r.base.sinsal
        ? (r.base.sinsal.list || []).find(x => x.name === value) : null;
      const 일간 = r ? R.G[r.saju.day.gan] : '';
      const 일간오행 = r ? R.OH[R.G_OH[r.saju.day.gan]] : '';
      let 위치 = '';

      if (value === '공망' && r && r.base && r.base.sinsal) {
        const gm = r.base.sinsal.gongmang;
        위치 = '사주를 세는 예순 개의 간지를 열 개씩 묶으면 짝이 없어 남는 아랫글자 두 개가 생깁니다. ' +
               `그 둘을 공망이라 하고, 이 사주에서는 ${gm}입니다. ` +
               `여덟 글자 안에 ${gm} 중 하나가 있으면 그 자리의 일이 비어 있다고 봅니다. ` +
               '없으면 운에서 그 글자가 오는 해에 그렇게 봅니다.';
      } else if (hit) {
        const ps = Array.isArray(hit.pos) ? hit.pos : [hit.pos];
        const 자리들 = ps.filter(p => 자리뜻[p]);
        const 글자 = hit.char || '';
        const J = (w, p) => R.josa(w, p);
        const 기준 = {
          홍염살: `태어난 날의 윗글자(일간)가 ${일간}, 곧 ${일간오행}인 사람은 ` +
                  `${J(글자,'을를')} 만나면 그 글자를 홍염살이라 부릅니다.`,
          현침살: '천간의 甲·辛과 지지의 卯·午·申은 글자 모양이 바늘처럼 뾰족하다 하여 현침이라 부릅니다. ' +
                  `이 사주에는 ${글자} 이렇게 여럿 모여 있습니다.`,
          양인살: `일간이 ${J(일간,'은는')} 사람에게 ${J(글자,'이가')} 양인에 해당합니다.`,
          천을귀인: `일간이 ${J(일간,'은는')} 사람에게 ${J(글자,'이가')} 천을귀인에 해당합니다.`,
          문창귀인: `일간이 ${J(일간,'은는')} 사람에게 ${J(글자,'이가')} 문창에 해당합니다.`,
          백호살: `${J(글자,'은는')} 예부터 백호로 꼽아온 간지입니다.`,
          괴강살: `${J(글자,'은는')} 예부터 괴강으로 꼽아온 간지입니다.`,
          '원진·귀문': `사주 안의 ${글자} 두 글자가 서로 원진이면서 귀문인 사이입니다.`,
          원진살: `사주 안의 ${글자} 두 글자가 서로 원진인 사이입니다.`,
          귀문관살: `사주 안의 ${글자} 두 글자가 서로 귀문인 사이입니다.`,
        }[value] || (r ? `태어난 날의 아랫글자(일지) ${R.J[r.saju.day.ji]}에서 열두 자리를 세어 나갈 때 ` +
                         `${J(글자,'이가')} ${value} 자리에 옵니다.` : '');

        const 셈 = ['', '한', '두', '세', '네'][자리들.length] || '';
        const 자리말 = 자리들.length === 1
          ? `그 글자는 ${자리뜻[자리들[0]].이름}에 있습니다. ` +
            `${자리뜻[자리들[0]].이름}는 ${R.josa(자리뜻[자리들[0]].보는것, '을를')} 보는 자리입니다.`
          : 자리들.length > 1
            ? `${자리들.map(k => 자리뜻[k].이름).join('·')} ${셈} 자리에 걸쳐 있습니다. ` +
              자리들.map(k => `${자리뜻[k].이름}는 ${R.josa(자리뜻[k].보는것, '을를')} 봅니다`).join('. ') + '.'
            : '';
        위치 = (기준 ? 기준 + ' ' : '') + 자리말;
      }
      return { 제목: value,
        뭐냐: 바탕.여덟글자 + ' 그 글자들 가운데 특정한 것이 나오거나 특정한 짝을 이루면, ' +
             '옛사람들이 거기에 이름을 붙여뒀습니다. 그것이 신살입니다. ' +
             '사주에 없던 무언가가 더해지는 것이 아니라, 원래 있는 글자를 두고 ' +
             '"이건 이런 뜻이다"라고 부르는 이름입니다. ' +
             '어느 기둥에 있느냐에 따라 삶의 어느 영역에서 나타나는지가 달라집니다.',
        내경우: (위치 ? 위치 + ' ' : '') +
                (SINSAL[value] || '이 신살에 대한 설명은 아직 정리되지 않았습니다.') };
    }

    case '자리': {
      const v = 자리뜻[value] || 자리뜻.전체;
      return { 제목: v.이름,
        뭐냐: 바탕.여덟글자 + ' 그 네 묶음을 네 기둥이라 부르고, 사주(四柱)라는 말 자체가 ' +
             '네 개의 기둥이라는 뜻입니다. ' + 바탕.천간지지 + ' ' +
             '기둥마다 삶의 다른 영역을 봅니다. 태어난 해는 집안과 어린 시절, ' +
             '달은 사회생활, 날은 나와 배우자, 시각은 자식과 말년입니다. ' +
             '그래서 같은 글자라도 어느 기둥에 있느냐에 따라 뜻이 달라집니다.',
        내경우: v.뜻 + '.' + (r && r.base && r.base.chart ? (() => {
          const c = r.base.chart.find(x => x.pos === value);
          return c ? ` 이 사주에서는 ${c.간}${c.지}입니다. 아랫글자 ${c.지}, 십성으로는 ${c.지십성}입니다.` : '';
        })() : '') };
    }
    case '십성': {
      const grp = { 비견:'비겁', 겁재:'비겁', 식신:'식상', 상관:'식상',
                    편재:'재성', 정재:'재성', 편관:'관성', 정관:'관성',
                    편인:'인성', 정인:'인성' }[value];
      return { 제목: value,
        뭐냐:'십성은 일간(나)을 기준으로 다른 글자가 어떤 역할인지를 붙인 이름입니다. ' +
             '나를 돕는가·내가 쓰는가·나를 누르는가에 따라 비겁·식상·재성·관성·인성 다섯 갈래로 묶이고, ' +
             '음양이 같으면 편(偏), 다르면 정(正)을 붙입니다.',
        내경우: (SIPSEONG_T[value] || '') +
          (r && grp && r.groupPower && r.groupPower[grp] != null
            ? ` 이 사주에서 ${grp}은 ${r.groupPower[grp]}%를 차지합니다.` : '') };
    }
    case '십이운성': return { 제목:'십이운성 — ' + value,
      뭐냐:'같은 기운이라도 어디에 놓이느냐에 따라 힘이 다릅니다. ' +
           '봄에 심은 씨앗과 겨울에 뿌린 씨앗이 다르듯이요. ' +
           '그래서 윗글자가 아랫글자 위에서 어느 기세에 있는지를 ' +
           '사람의 한살이에 빗대 열두 단계로 나눠 봅니다. ' +
           '잉태되고(태) 태어나(장생) 자라고(관대·건록) 정점에 이르렀다가(제왕) ' +
           '기울고(쇠·병) 사그라들어(사·묘) 다시 끊어졌다 이어지는(절) 흐름입니다.',
      내경우: (UNSEONG_T[value] || '') +
        ' 강한 순서로는 건록·제왕이 위, 절·태가 아래에 놓입니다.' };
    default: return null;
  }
}

if (typeof module !== 'undefined') module.exports = { TERMS, explain, SINSAL, OHAENG, PATTERN_T, T_JONG, T_GYEOK_ALT, 자리뜻, 자리설명 };

return module.exports; })();

window.Saju = {
  full: __mods['saju-full'], rules: __mods['saju-rules'], engine: __mods['saju-engine'],
  input: __mods['saju-input'], tarot: __mods['tarot-data'],
  agents: __mods['saju-agents'], orch: __mods['saju-orchestrator'],
  term: __mods['term-data'],
};
})();