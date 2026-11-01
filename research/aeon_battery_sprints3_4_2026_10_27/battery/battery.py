"""AEON capability battery: sprint-2 controller (unchanged) vs MMAC and PID under stress conditions."""
import argparse, copy, datetime, hashlib, json, math, time
from multiprocessing import Pool
from pathlib import Path
import numpy as np
from aeon_developmental.world import noise
from developmental_v0_2.actors import WARMUP
from developmental_v0_2.worlds import World
from developmental_cases.common import keyed, paired, save
from integration_sprint import sprint
from integration_sprint_v2 import sprint2
from baseline_benchmark.benchmark import Controller
sprint2.install()

ROOT = Path(__file__).resolve().parent
SEEDS = (29001,29003,29009,29011,29021,29027,29033,29041,29047,29053)
QUAL_SEED = 19001
FAMILIES = sprint.FAMILIES
CONFIGS = ('aeon_integrated','aeon_no_retrieval','mmac','pid')
PID = {'kp':.3,'ki':.01,'kd':.1}  # frozen in baseline_benchmark/protocol_freeze.json
CUES = {'A':(.1,.2),'B':(.8,.1),'C':(.3,.9),'D':(.9,.8)}
DELAY = {'A':0,'B':1,'C':3,'D':2}
MISSING = {'A':None,'B':0,'C':1,'D':0}
SHIFT_FOR_DELAY = {1:0,3:32,2:64}
TESTS = {
 'T1_replication':{},
 'T2_cue_noise_x4':{'cue_noise':4.},
 'T2_cue_noise_x10':{'cue_noise':10.},
 'T3_no_cue':{'no_cue':True},
 'T4_capacity_ABCDA':{'seq':'ABCDA'},
 'T4_revisits_ABCBA':{'seq':'ABCBA'},
 'T5_changed_physics_on_return':{'return_gain':.5},
 'T6_sensor_noise_x2':{'sensor_noise':2.},
 'T6_sensor_noise_x4':{'sensor_noise':4.},
 'T7_phase_96':{'phase':96},
 'T7_phase_64':{'phase':64},
}

class BatteryWorld(World):
    def __init__(self, seed, family, seq='ABCA', phase=192, cue_noise=1., no_cue=False, return_gain=1., sensor_noise=1.):
        super().__init__(seed,'variable_delay',shift=10**9)
        self.sprint_family=family; self.seq=seq; self.phase_len=phase; self.cue_noise=cue_noise
        self.no_cue=no_cue; self.return_gain=return_gain; self.sensor_noise=sensor_noise
    def ctx(self): return self.seq[min(self.tick//self.phase_len,len(self.seq)-1)]
    def final(self): return self.tick//self.phase_len>=len(self.seq)-1
    def cue(self):
        base=CUES['A' if self.no_cue else self.ctx()]
        return [v+.012*self.cue_noise*keyed(self.seed,self.tick,f'cue{j}') for j,v in enumerate(base)]
    def observe(self):
        obs=super().observe(); m=MISSING[self.ctx()]
        if m is not None and self.sprint_family in ('sensor_dropout','delay_dropout'):
            if self.tick%29<19: obs.signals.pop(self.sensors[m],None)
            obs.signals[self.sensors[1-m]]+=.025*noise(self.seed,self.tick,'degraded')
        if self.sensor_noise!=1.:
            extra=math.sqrt(self.sensor_noise**2-1)
            for i,sd in ((0,.004),(1,.015)):
                if self.sensors[i] in obs.signals: obs.signals[self.sensors[i]]+=extra*sd*noise(self.seed,self.tick,f'extra{i}')
        return obs
    def step(self, action):
        d=DELAY[self.ctx()]; old_shift, old_gains=self.shift, self.gains
        if d and self.sprint_family in ('variable_delay','delay_dropout'): self.shift=self.tick-SHIFT_FOR_DELAY[d]
        if self.final() and self.return_gain!=1.: self.gains=tuple(g*self.return_gain for g in old_gains)
        try: super().step(action)
        finally: self.shift, self.gains=old_shift, old_gains
    def total(self): return self.phase_len*len(self.seq)

def run(test, seed, family, config):
    kw=TESTS[test]; world=BatteryWorld(seed,family,**kw); errors=[]; recalls=[]
    if config.startswith('aeon'): actor=sprint.IntegratedActor(config[5:])
    else: ctl=Controller(config,PID,None)
    start=time.perf_counter()
    for _ in range(world.total()):
        obs=world.observe(); cue=world.cue()
        if config.startswith('aeon'):
            d=actor.decide(obs,cue); a=d['action']
            if d['retrieved']: recalls.append({'tick':obs.tick,'context':d['retrieved_context']})
        else: a=ctl.decide(obs)
        world.step(a)
        if config.startswith('aeon'): actor.learn(world.observe())
        errors.append(abs(world.body-world.target()))
    wall=time.perf_counter()-start
    P=world.phase_len; n=len(world.seq)
    row={'test':test,'seed':seed,'family':family,'condition':config,'absolute_errors':errors,'recalls':recalls,
         'us_per_decision':1e6*wall/len(errors),
         'loss':float(sum(errors[(n-1)*P:(n-1)*P+20])),'overall':float(np.mean(errors[WARMUP:])),
         'final_phase':float(np.mean(errors[(n-1)*P:]))}
    if kw.get('seq')=='ABCBA': row['loss_B_return']=float(sum(errors[3*P:3*P+20]))
    return row

def _job(a): return run(*a)

def qualify(out):
    checks={}
    # Default battery world must reproduce the sprint-2 world exactly.
    for f in FAMILIES:
        for c in ('integrated','no_retrieval'):
            s=sprint.Session(QUAL_SEED,f,c); ref=[s.cycle()[1] for _ in range(sprint.TOTAL)]
            mine=run('T1_replication',QUAL_SEED,f,'aeon_'+c)['absolute_errors']
            assert ref==mine,(f,c); checks[f'exact_sprint_world_{f}_{c}']=True
    names=list(CUES); checks['min_cue_distance']=min(math.dist(CUES[a],CUES[b]) for a in names for b in names if a<b)
    with Pool() as p: rows=p.map(_job,[(t,QUAL_SEED,f,c) for t in TESTS for f in FAMILIES for c in CONFIGS])
    checks['all_tests_run_on_qualification_seed']=len(rows)==len(TESTS)*12 and all(math.isfinite(r['overall']) for r in rows)
    return checks

def analyze(rows):
    res={}
    for t in TESTS:
        tr=[r for r in rows if r['test']==t]; res[t]={}
        metrics=('loss','overall','final_phase')+(('loss_B_return',) if t=='T4_revisits_ABCBA' else ())
        for m in metrics:
            res[t][m]={'pooled':{c:paired(tr,'aeon_integrated',c,m) for c in CONFIGS[1:]},
                       'by_family':{f:{c:paired([r for r in tr if r['family']==f],'aeon_integrated',c,m) for c in CONFIGS[1:]} for f in FAMILIES}}
        ai=[r for r in tr if r['condition']=='aeon_integrated']
        res[t]['recalls_per_run']=float(np.mean([len(r['recalls']) for r in ai]))
        res[t]['us_per_decision']={c:float(np.mean([r['us_per_decision'] for r in tr if r['condition']==c])) for c in CONFIGS}
    return res

def main():
    p=argparse.ArgumentParser(); p.add_argument('mode',choices=('qualify','run')); p.add_argument('--out',type=Path,required=True)
    a=p.parse_args(); a.out.mkdir(parents=True,exist_ok=False); start=time.perf_counter()
    if a.mode=='qualify':
        checks=qualify(a.out); save(a.out/'qualification.json',{'passed':True,'checks':checks}); print(json.dumps(checks,indent=1)); return
    freeze=json.loads((ROOT/'protocol_freeze.json').read_text())
    for n,sha in freeze['files'].items():
        if hashlib.sha256(Path(n).read_bytes()).hexdigest()!=sha: raise RuntimeError('Frozen file changed: '+n)
    with Pool() as p: rows=p.map(_job,[(t,s,f,c) for t in TESTS for f in FAMILIES for s in SEEDS for c in CONFIGS])
    with (a.out/'outcomes.jsonl').open('x') as log:
        for r in rows: log.write(json.dumps(r)+'\n')
    res=analyze([{k:v for k,v in r.items() if k!='absolute_errors'} for r in rows])
    save(a.out/'results.json',{'runs':len(rows),'analysis':res,'wall_seconds':time.perf_counter()-start,
         'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    print('runs',len(rows),'wall',round(time.perf_counter()-start,1))
if __name__=='__main__': main()
