"""Integrated sprint: frozen development experiment, no providers or LLMs."""
import argparse
import copy
from dataclasses import asdict
import datetime
import hashlib
import json
import math
from pathlib import Path
import time
import traceback
import zipfile
import numpy as np
from aeon_developmental.world import noise
from aeon_developmental.experiment import canonical
from developmental_v0_2.actors import Actor, Regression, WARMUP
from developmental_v0_2.worlds import World, Observation
from developmental_cases.membership import ValidatedActor
from developmental_cases.common import keyed, Evidence, paired, save

SEEDS=(17001,17003,17009,17011,17021,17027,17033,17041,17047,17053)
FAMILIES=('variable_delay','sensor_dropout','delay_dropout')
CONFIGS=('integrated','no_retrieval','adaptive_baseline','shuffled')
PHASE=192
TOTAL=4*PHASE
START=3*PHASE
ROOT=Path(__file__).resolve().parent

class RepeatingWorld(World):
    def __init__(self,seed,family):
        if family not in FAMILIES: raise ValueError(family)
        super().__init__(seed,'variable_delay',shift=10**9)
        self.sprint_family=family
    def cue(self):
        base=((.1,.2),(.8,.1),(.3,.9),(.1,.2))[min(self.tick//PHASE,3)]
        return [v+.012*keyed(self.seed,self.tick,f'cue{j}') for j,v in enumerate(base)]
    def observe(self):
        obs=super().observe()
        phase=self.tick//PHASE
        if phase in (1,2) and self.sprint_family in ('sensor_dropout','delay_dropout'):
            missing=phase-1
            if self.tick%29<19: obs.signals.pop(self.sensors[missing],None)
            obs.signals[self.sensors[1-missing]]+=.025*noise(self.seed,self.tick,'degraded')
        return obs
    def step(self,action):
        phase=self.tick//PHASE
        old=self.shift
        if phase in (1,2) and self.sprint_family in ('variable_delay','delay_dropout'):
            self.shift=self.tick-(0 if phase==1 else 32)
        try: super().step(action)
        finally: self.shift=old
    @classmethod
    def restore(cls,state):
        w=cls(state['seed'],state['sprint_family'])
        w.__dict__.update(copy.deepcopy(state));w.ports=tuple(w.ports)
        return w

class IntegratedActor(ValidatedActor):
    def __init__(self,mode='integrated'):
        if mode not in CONFIGS or mode=='adaptive_baseline':raise ValueError(mode)
        super().__init__()
        self.mode=mode;self.context=None;self.bank=[];self.retrievals=0
    def decide(self,obs,cue):
        changed=self.context is None or np.linalg.norm(np.array(cue)-self.context)>.3
        recalled=False;selected_context=None
        if changed:
            if self.context is not None:
                self.bank.append({'cue':list(self.context),'models':{s:r.state() for s,r in self.models.items()}})
                self.bank=self.bank[-3:]
            # This branch is the sole read path from memory to learned parameters.
            if self.mode!='no_retrieval' and self.bank:
                distances=[float(np.linalg.norm(np.array(r['cue'])-cue)) for r in self.bank]
                nearest=int(np.argmin(distances))
                if distances[nearest]<.2:
                    selected=(nearest+1)%len(self.bank) if self.mode=='shuffled' else nearest
                    record=self.bank[selected]
                    self.models={s:Regression.restore(r) for s,r in record['models'].items()}
                    recalled=True;selected_context=record['cue'];self.retrievals+=1
            self.context=list(cue)
        d=super().decide(obs)
        d.update(retrieved=recalled,retrieved_context=selected_context,bank_size=len(self.bank))
        return d
    @classmethod
    def restore(cls,state):
        a=cls(state['mode']);base=Actor.restore(state)
        a.__dict__.update(base.__dict__)
        return a

class Session:
    def __init__(self,seed,family,config):
        self.world=RepeatingWorld(seed,family);self.config=config
        self.actor=Actor('adaptive_baseline') if config=='adaptive_baseline' else IntegratedActor(config)
    def decide(self,obs,cue):
        if self.config=='adaptive_baseline':
            d=self.actor.decide(obs);d.update(retrieved=False,retrieved_context=None,bank_size=0)
            return d
        return self.actor.decide(obs,cue)
    def cycle(self,evidence=None):
        obs=self.world.observe();cue=self.world.cue()
        d=self.decide(obs,cue)
        if evidence:evidence.decision({'observation':asdict(obs),'cue':cue,**d})
        self.world.step(d['action']);after=self.world.observe();self.actor.learn(after)
        error=abs(self.world.body-self.world.target())
        if not math.isfinite(error) or not all(np.isfinite(m.w).all() and np.isfinite(m.p).all() for m in self.actor.models.values()):
            raise FloatingPointError('Nonfinite world or model')
        if evidence:evidence.outcome({'tick':self.world.tick,'body':self.world.body,'target':self.world.target(),'absolute_error':error})
        return d,error
    def state(self):return {'world':self.world.state(),'actor':self.actor.state(),'config':self.config}
    @classmethod
    def restore(cls,state):
        a=cls(state['world']['seed'],state['world']['sprint_family'],state['config'])
        a.world=RepeatingWorld.restore(state['world'])
        a.actor=Actor.restore(state['actor']) if a.config=='adaptive_baseline' else IntegratedActor.restore(state['actor'])
        return a

def metric(errors):return float(sum(errors[START:START+20]))

def qualify(out):
    checks={};start=time.perf_counter()
    # One common-action tape; every actor receives byte-identical observation/cue payloads.
    world=RepeatingWorld(19001,'delay_dropout')
    sessions=[Session(19001,'delay_dropout',c) for c in CONFIGS]
    input_hashes={c:[] for c in CONFIGS};checkpoints=out/'checkpoints';checkpoints.mkdir()
    for tick in range(TOTAL):
        obs=world.observe();cue=world.cue()
        for session in sessions:
            own=copy.deepcopy(obs);owncue=copy.deepcopy(cue)
            input_hashes[session.config].append(hashlib.sha256(canonical({'observation':asdict(own),'cue':owncue}).encode()).hexdigest())
            session.decide(own,owncue)
        action=sessions[0].actor.pending[1]
        # Feedback must correspond to common executed action for this replay fixture.
        # Use its shared trajectory only to establish input equality; not performance.
        world.step(action);after=world.observe()
        for session in sessions:session.actor.learn(copy.deepcopy(after))
    assert all(v==input_hashes['integrated'] for v in input_hashes.values())
    checks['identical_replay_inputs']=True
    save(out/'replay_input_hashes.json',input_hashes)
    assert set(sessions[0].actor.members)==set(world.sensors[:2])
    checks['repaired_membership']=True
    # Independent exact continuation checks at calibration, delayed state, and after return.
    for config in CONFIGS:
        a=Session(19001,'delay_dropout',config)
        for tick in range(START+24):
            if tick in (64,220,START+1):
                state=a.state();save(checkpoints/f'{config}_{tick}.json',state)
                b=Session.restore(json.loads(canonical(state)))
                clone=Session.restore(json.loads(canonical(state)))
                for _ in range(7):
                    da,ea=b.cycle();db,eb=clone.cycle()
                    assert canonical(da)==canonical(db) and ea==eb
                # Compare against original in-memory state, not two restored objects only.
                live=copy.deepcopy(a)
                for _ in range(7):live.cycle()
                assert canonical(live.state())==canonical(b.state()),(config,tick)
            a.cycle()
        checks[f'restart_{config}']=True
    # Poison memories without touching current learned parameters; disabled recall cannot matter.
    source=sessions[0].actor.state()
    a=IntegratedActor.restore(source);b=IntegratedActor.restore(source)
    a.mode=b.mode='no_retrieval';a.context=b.context=[.8,.1]
    b.bank=[{'cue':[.1,.2],'models':{'poison':'must not read'}}]
    obs=world.observe();cue=[.1,.2]
    da=a.decide(obs,cue);db=b.decide(obs,cue)
    for key in ('action','prediction','body_estimate','attention'):
        assert canonical(da[key])==canonical(db[key])
    assert not da['retrieved'] and not db['retrieved']
    checks['retrieval_ablation_poison_test']=True
    # Synthetic controlled model fixture verifies bank values enter the planner immediately.
    a=IntegratedActor.restore(source);b=IntegratedActor.restore(source)
    for actor in (a,b):
        actor.context=[.8,.1]
        models={s:r.state() for s,r in actor.models.items()}
        for r in models.values():r['w']=[0.]*len(r['w']);r['w'][1]=.2
        actor.bank=[{'cue':[.1,.2],'models':models}]
        for r in actor.models.values():r.w[:]=0.;r.w[1]=-.2
        actor.history=[];actor.velocity=0.;actor.previous=None
    b.mode='no_retrieval'
    signals={s:0. for s in a.models};signals[obs.target_channel]=.4
    fixture=Observation(START,signals,obs.ports,obs.target_channel)
    da=a.decide(fixture,[.1,.2]);db=b.decide(fixture,[.1,.2])
    assert da['retrieved'] and not db['retrieved']
    assert da['action']!=db['action']
    # Compare the learned predictions for one fixed action; chosen actions may
    # legitimately compensate for opposite models and predict the same motion.
    assert all(a.models[k].w[1] == .2 and b.models[k].w[1] == -.2 for k in a.members)
    checks['retrieval_changes_planning_and_prediction']=True
    a=IntegratedActor.restore(source);a.mode='shuffled';a.context=[.3,.9]
    a.bank=[{'cue':[.1,.2],'models':source['models']},{'cue':[.8,.1],'models':source['models']}]
    d=a.decide(fixture,[.1,.2]);assert d['retrieved_context']==[.8,.1]
    checks['shuffled_retrieves_wrong_context']=True
    assert metric(list(range(TOTAL)))==sum(range(START,START+20))
    checks['metric_exactly_20_return_actions']=True
    checks['elapsed_seconds']=time.perf_counter()-start
    return checks

def trial(seed,family,config,out):
    session=Session(seed,family,config);path=out/'traces'/f'{family}_{seed}_{config}.jsonl.gz'
    evidence=Evidence(path);errors=[];recalls=[];start=time.perf_counter();cpu=time.process_time()
    try:
        for t in range(TOTAL):
            d,e=session.cycle(evidence);errors.append(e)
            if d['retrieved']:recalls.append({'tick':t,'context':d['retrieved_context']})
        row={'seed':seed,'family':family,'condition':config,'loss':metric(errors),'return_squared_error':sum(e*e for e in errors[START:START+20]),'absolute_errors':errors,'retrievals':recalls,'wall_seconds':time.perf_counter()-start,'cpu_seconds':time.process_time()-cpu,'actions':len(errors)}
        row.update(evidence.close())
        save(out/'checkpoints'/f'{family}_{seed}_{config}_final.json',session.state())
        return row
    except Exception:
        evidence.trace.close()
        save(out/f'partial_{family}_{seed}_{config}.json',{'errors':errors,'tick':session.world.tick})
        raise

def analyze(rows,failures):
    result={'completed':len(rows),'failures':len(failures)}
    if failures or len(rows)!=120:result['decision']='BLOCKED';return result
    result['pooled']={c:paired(rows,'integrated',c) for c in CONFIGS[1:]}
    result['by_family']={f:{c:paired([r for r in rows if r['family']==f],'integrated',c) for c in CONFIGS[1:]} for f in FAMILIES}
    mandatory=[result['pooled'][c] for c in ('no_retrieval','adaptive_baseline')]
    passed=all(p['improvement_percent'] is not None and p['improvement_percent']>=15 and p['ci95'][0]>0 for p in mandatory)
    result['success']=passed
    result['decision']='RETAIN' if passed else ('REVISE' if all(p['control_minus_full']>0 for p in mandatory) else 'SIMPLIFY')
    result['largest_errors']=[{k:r[k] for k in ('family','seed','condition','loss')} for r in sorted(rows,key=lambda r:r['loss'],reverse=True)[:10]]
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=('qualify','run'));p.add_argument('--out',type=Path,required=True);args=p.parse_args()
    args.out.mkdir(parents=True,exist_ok=False)
    start=time.perf_counter();cpu=time.process_time()
    if args.mode=='qualify':
        try:
            checks=qualify(args.out);save(args.out/'qualification.json',{'passed':True,'checks':checks});print(json.dumps(checks),flush=True)
        except Exception:
            save(args.out/'qualification.json',{'passed':False,'error':traceback.format_exc()});raise
        return
    qualification=ROOT/'qualification'/'qualification.json'
    if not qualification.exists() or not json.loads(qualification.read_text())['passed']:raise RuntimeError('Qualification required')
    freeze=json.loads((ROOT/'protocol_freeze.json').read_text())
    for name,sha in freeze['files'].items():
        if hashlib.sha256(Path(name).read_bytes()).hexdigest()!=sha:raise RuntimeError('Frozen source changed: '+name)
    sources=[ROOT/'sprint.py',ROOT/'PROTOCOL.md']
    sources += [Path(n) for n in freeze['files'] if n.endswith('.py')]
    manifest={'measurement_started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in sources},'qualification_sha256':hashlib.sha256(qualification.read_bytes()).hexdigest(),'protocol_sha256':hashlib.sha256((ROOT/'PROTOCOL.md').read_bytes()).hexdigest()}
    save(args.out/'manifest.json',manifest)
    with zipfile.ZipFile(args.out/'source_measured.zip','x',zipfile.ZIP_DEFLATED) as z:
        for f in sources:z.write(f, f.relative_to(Path.cwd()) if f.is_absolute() else f)
    (args.out/'traces').mkdir();(args.out/'checkpoints').mkdir();rows=[];failures=[]
    with (args.out/'outcomes.jsonl').open('x',encoding='utf-8') as log:
        for family in FAMILIES:
            for seed in SEEDS:
                for config in CONFIGS:
                    try:
                        row=trial(seed,family,config,args.out);rows.append(row);event={'status':'completed',**row}
                    except Exception:
                        event={'status':'failed','family':family,'seed':seed,'condition':config,'error':traceback.format_exc()};failures.append(event)
                    log.write(json.dumps(event,allow_nan=False)+'\n');log.flush()
                print(f'{family} seed={seed}: completed={len(rows)}, failures={len(failures)}, elapsed={time.perf_counter()-start:.1f}s',flush=True)
    analysis=analyze(rows,failures)
    timing={'wall_seconds':time.perf_counter()-start,'cpu_seconds':time.process_time()-cpu,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    save(args.out/'results.json',{'runs':rows,'failures':failures,'analysis':analysis,'timing':timing})
    print(json.dumps({'analysis':analysis,'timing':timing}),flush=True)
if __name__=='__main__':main()
