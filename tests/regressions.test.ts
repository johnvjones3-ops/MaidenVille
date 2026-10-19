import { describe, expect, it, vi, afterEach } from 'vitest';
import { CONTROLS, GAME, MODES, POWERUPS } from '../src/config';
import { InputManager } from '../src/input/input';
import { RunSim } from '../src/sim/run';
import { SaveManager, sanitize, type StorageLike } from '../src/save/save';
import { settleRun, stamp, type RunSummary } from '../src/save/progression';
import { LANDMARKS, LANDMARK_BY_ID, landmarkWorld } from '../src/world/landmarks';
import { ROUTE } from '../src/world/route';
import { autopilot } from './helpers';

const memory = (): StorageLike => {
  const data = new Map<string, string>();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
};
const summary = (runId: string, mode: RunSummary['mode'] = 'explorer'): RunSummary => ({ runId, mode, stars: 10, score: 50, distance: 20, landmarksVisited: [], words: 0, lettersProgress: 0, deliveries: [], powerups: 0, longestNoDamage: 0, hits: 0, shieldPops: 0 });
const advance = (sim: RunSim, seconds: number) => { for (let i = 0; i < seconds * 120; i++) { sim.step(); sim.events.length = 0; } };

describe('City reference and safe tour', () => {
  it('preserves the reference north/south and left/right landmark arrangement', () => {
    const w = (id: keyof typeof LANDMARK_BY_ID) => landmarkWorld(LANDMARK_BY_ID[id]);
    expect(w('church').x).toBeLessThan(w('house_turquoise').x);
    expect(w('school').x).toBeGreaterThan(w('house_pink').x);
    expect(w('emergency').x).toBeLessThan(w('hospital').x);
    expect(w('hospital').x).toBeLessThan(0);
    expect(w('store').x).toBeGreaterThan(0);
    for (const id of ['church', 'school', 'house_turquoise', 'house_pink'] as const) {
      expect(w(id).z).toBeLessThan(w('hospital').z);
      expect(w(id).z).toBeLessThan(w('store').z);
    }
  });
  it('reaches all seven landmarks within 180 seconds without requiring a speed power-up', () => {
    const sim = new RunSim('explorer', { seed: 7, tutorial: true });
    while (sim.time < 180 && sim.visited.size < 7 && !sim.over) {
      sim.pickups = sim.pickups.filter(p => p.kind !== 'powerup');
      autopilot(sim); sim.step(); sim.events.length = 0;
    }
    expect(sim.visited.size).toBe(7);
    expect(sim.hits).toBe(0);
    expect(sim.time).toBeLessThan(180);
  });
});

describe('Persistent reward and save regressions', () => {
  it('never re-awards an old result after more than fifty newer runs and a reload', () => {
    const st = memory(), save = new SaveManager(st);
    settleRun(save, summary('original'));
    for (let i = 0; i < 75; i++) settleRun(save, summary(`later-${i}`));
    const reload = new SaveManager(st), before = reload.data.stars;
    expect(settleRun(reload, summary('original')).alreadySettled).toBe(true);
    expect(reload.data.stars).toBe(before);
  });
  it('the sightseeing explorer badge grants no spendable stars or records', () => {
    const save = new SaveManager(memory());
    for (const l of LANDMARKS) stamp(save, l.id);
    expect(settleRun(save, summary('visit', 'explore')).achievements.map(a => a.id)).toContain('a_explorer');
    for (let i = 0; i < 10; i++) settleRun(save, summary(`visit-${i}`, 'explore'));
    expect(save.data.stars).toBe(0);
    expect(save.data.records.challenge.runs).toBe(0);
    expect(save.data.records.explorer.runs).toBe(0);
  });
  it('rejects unknown progress identifiers and non-integer records', () => {
    const save = sanitize({ stamps: ['church','imaginary'], achievements:['fake'], goalsCompleted:['fake'], missionsDelivered:['fake'], records:{ challenge:{bestScore:4.7,runs:2.2} } });
    expect(save.stamps).toEqual(['church']); expect(save.achievements).toEqual([]);
    expect(save.goalsCompleted).toEqual([]); expect(save.missionsDelivered).toEqual([]);
    expect(save.records.challenge.bestScore).toBe(4); expect(save.records.challenge.runs).toBe(2);
  });
  it('backs up an unsupported save version and retains valid settings', () => {
    const st = memory(); st.setItem(GAME.saveKey, JSON.stringify({ version: 999, stars: 9999, settings:{ muted:true } }));
    const save = new SaveManager(st);
    expect(save.recovered).toBe(true); expect(save.data.stars).toBe(0);
    expect(save.data.settings.muted).toBe(true); expect(st.getItem(GAME.saveKey+'-version-backup')).toBeTruthy();
  });
});

describe('Sightseeing and flight regressions', () => {
  it('Stop freezes travel immediately, and Go restarts it', () => {
    const sim = new RunSim('explore', {seed:1,tutorial:false}); advance(sim,2);
    sim.stopped = true; const d=sim.d; advance(sim,2);
    expect(sim.d).toBe(d); expect(sim.speed).toBe(0);
    sim.stopped=false; advance(sim,1); expect(sim.d).toBeGreaterThan(d);
  });
  it('map travel alone never stamps landmarks that were skipped', () => {
    const sim = new RunSim('explore', {seed:1,tutorial:false});
    sim.travelTo(ROUTE.wrap(LANDMARK_BY_ID.store.s-20));
    expect(sim.visited.size).toBe(0); advance(sim,5);
    expect([...sim.visited]).toEqual(['store']);
  });
  it('a renewed glide reserves and clears a new landing span, even if rainbow starts later', () => {
    const sim = new RunSim('challenge', {seed:14,tutorial:false});
    sim.activate('glide'); advance(sim,3);
    sim.activate('glide'); sim.activate('rainbow');
    const future = sim.d + (sim.glideT + POWERUPS.glide.landing) * MODES.challenge.maxSpeed * POWERUPS.rainbow.speedMul;
    expect(sim.gen.isProtected(future)).toBe(true);
    const h=sim.hearts; advance(sim,sim.glideT+0.8);
    expect(sim.hearts).toBe(h); expect(sim.y).toBe(0); expect(sim.protectedNow).toBe(true);
  });
  it('glide renewal clears an already generated obstacle in the extended landing zone', () => {
    const sim = new RunSim('challenge', {seed:21,tutorial:false});
    sim.activate('glide'); advance(sim,4);
    const d=sim.d+110;
    sim.obstacles.push({id:999999,kind:'closed',lane:1,d,length:10,hit:false,practice:false});
    sim.activate('glide');
    expect(sim.obstacles.find(o=>o.id===999999)).toBeUndefined();
  });
});

class Surface extends EventTarget { setPointerCapture() {} }
function pointer(target: EventTarget, type: string, props: Record<string, unknown>) {
  const event = new Event(type, {cancelable:true});
  Object.assign(event, {pointerId:1,isPrimary:true,clientX:100,clientY:100,...props});
  target.dispatchEvent(event);
}
afterEach(()=>vi.unstubAllGlobals());
describe('Input event contract', () => {
  function setup() {
    const win = new Surface(); Object.assign(win,{innerWidth:390,innerHeight:844}); vi.stubGlobal('window',win);
    const surface = new Surface(), input=new InputManager(surface as unknown as HTMLElement);
    input.enabled=true; const actions: string[]=[]; input.onAction=a=>actions.push(a);
    return {win,surface,input,actions};
  }
  it('locks a swipe to one action and ignores further movement in the same gesture', () => {
    const {surface,actions}=setup(); pointer(surface,'pointerdown',{});
    pointer(surface,'pointermove',{clientX:160}); pointer(surface,'pointermove',{clientX:240,clientY:10});
    pointer(surface,'pointerup',{}); expect(actions).toEqual(['right']);
  });
  it('cancel and pause discard in-progress gestures', () => {
    const {surface,input,actions}=setup(); pointer(surface,'pointerdown',{}); pointer(surface,'pointercancel',{});
    pointer(surface,'pointermove',{clientX:220});
    pointer(surface,'pointerdown',{}); input.enabled=false; input.enabled=true;
    pointer(surface,'pointermove',{clientX:220}); expect(actions).toEqual([]);
  });
  it('touch buttons and keyboard activation each emit once', () => {
    const {input,actions}=setup(), button=new Surface(); input.bindButton(button as unknown as HTMLElement,'jump');
    pointer(button,'pointerdown',{}); pointer(button,'click',{detail:1});
    pointer(button,'click',{detail:0}); expect(actions).toEqual(['jump','jump']);
  });
  it('keyboard repeats are ignored and the configured lane timing remains 0.16 seconds', () => {
    const {win,actions}=setup(); pointer(win,'keydown',{key:'ArrowLeft',repeat:false});
    pointer(win,'keydown',{key:'ArrowLeft',repeat:true}); expect(actions).toEqual(['left']);
    expect(CONTROLS.laneChangeTime).toBe(0.16);
  });
});
