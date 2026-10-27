"""Sprint 2: identical design to integration_sprint, with the planner's lead bias removed.

The only behavioural change is LandingActor's candidate score. sprint.py is imported
unchanged; its actor classes are swapped for planner-fixed subclasses.
"""
import argparse
import datetime
import hashlib
import json
import math
from pathlib import Path
import time
import traceback
import zipfile
import numpy as np
import developmental_v0_2.actors as base_actors
from developmental_v0_2.actors import Actor, WARMUP, LAGS, DIM, CANDIDATES, features
from developmental_cases.common import paired, save
import integration_sprint.sprint as sprint

SEEDS=(23001,23003,23009,23011,23021,23027,23033,23041,23047,23053)
QUALIFICATION_SEED=19001
ROOT=Path(__file__).resolve().parent

def landing_weights(positions):
    """Share of the candidates' model-predicted effect first arriving at each horizon.

    positions: (candidates, horizons); row 0 is the zero action. Uniform if the
    model predicts no action effect (untrained), matching the original equal weighting.
    """
    delta=positions[1:]-positions[:1]
    increments=np.abs(np.diff(np.concatenate([np.zeros((len(delta),1)),delta],axis=1),axis=1)).mean(axis=0)
    total=increments.sum()
    if not math.isfinite(total) or total<1e-9:return np.full(positions.shape[1],1/positions.shape[1])
    return increments/total

class LandingActor(Actor):
    """Actor.decide with one change: each horizon's tracking error is weighted by when the
    candidate action's predicted effect lands, instead of equally. Equal weighting of a
    single held action against a moving target made the planner lead the target."""
    def decide(self,obs):
        if self.pending is not None: raise RuntimeError('Feedback required before another action')
        for s in obs.signals: self.models.setdefault(s,base_actors.Regression())
        if obs.tick==WARMUP: self.establish_members(obs.target_channel)
        if self.previous:
            self.velocity=float(np.clip(.5*self.velocity+.5*(obs.signals[obs.target_channel]-self.previous.signals[obs.target_channel]),-.1,.1))
        available=[s for s in self.members if s in obs.signals]
        if available:
            if self.condition=='adaptive_baseline':
                selected=self.locked if self.locked in available else available[0]
                weights={selected:1.}
            else:
                raw={s:1/(1e-5+self.models[s].error) for s in available}
                weights={s:v/sum(raw.values()) for s,v in raw.items()}
            body=sum(weights[s]*obs.signals[s] for s in weights)
        else:
            weights={}
            body=self.last_body+self.last_delta
        horizon_weights=None
        if obs.tick<WARMUP:
            p=obs.tick%2
            amount=(-1.,-.5,.5,1.)[((obs.tick//2)*7+obs.tick//11)%4]
            action=np.array([amount if j==p else 0. for j in range(2)])
            rollouts=0
        else:
            bank=self.planner_weights if self.condition=='planner_disconnected' else {s:r.w for s,r in self.models.items()}
            w=sum((weights[s]*bank[s] for s in weights),np.zeros(DIM))
            positions=np.full(len(CANDIDATES),body)
            trajectory=np.zeros((len(CANDIDATES),LAGS));goals=np.zeros(LAGS)
            histories=[self.history[:] for _ in CANDIDATES]
            target=obs.signals[obs.target_channel]
            for horizon in range(LAGS):
                actions=CANDIDATES if horizon==0 else np.zeros_like(CANDIDATES)
                xx=np.stack([features(a,h) for a,h in zip(actions,histories)])
                positions+=np.clip(xx@w,-.6,.6)
                trajectory[:,horizon]=positions;goals[horizon]=target+self.velocity*(horizon+1)
                for h,a in zip(histories,actions): h.append(list(a)); h[:]=h[-LAGS:]
            horizon_weights=landing_weights(trajectory)
            scores=((trajectory-goals)**2)@horizon_weights*LAGS
            scores+=.002*np.sum(CANDIDATES**2,axis=1)
            action=CANDIDATES[int(np.argmin(scores))].copy()
            rollouts=len(CANDIDATES)*LAGS
            self.prediction_evaluations+=rollouts
        x=features(action,self.history)
        predicted={s:float(x@r.w) for s,r in self.models.items() if s in obs.signals}
        self.last_body=float(body)
        self.last_delta=sum(weights[s]*predicted[s] for s in weights)
        self.pending=(obs,action.tolist(),x,predicted)
        return {'action':action.tolist(),'prediction':predicted,'body_estimate':float(body),
                'attention':weights,'revision':self.revision,'planner_frozen':self.condition=='planner_disconnected',
                'rollout_predictions':rollouts,
                'horizon_weights':None if horizon_weights is None else horizon_weights.tolist()}

class IntegratedLanding(sprint.IntegratedActor,LandingActor):
    pass

def install():
    """Swap the planner-fixed actors and fresh seeds into the unchanged sprint module."""
    if sprint.Actor is LandingActor:return
    sprint.Actor=LandingActor
    sprint.IntegratedActor=IntegratedLanding
    sprint.SEEDS=SEEDS

def target_at(seed,tick):
    return 0.55*math.sin(0.035*tick+seed*0.13)+0.18*math.sin(0.087*tick)

def lead_slope(signed,seed,start,stop):
    """Signed post-action error regressed on target velocity; 0 means no lead or lag."""
    e=np.array(signed[start:stop]);v=np.array([target_at(seed,t+1)-target_at(seed,t) for t in range(start,stop)])
    return float(e@v/(v@v))

def run_signed(seed,family,config,stop=sprint.TOTAL):
    s=sprint.Session(seed,family,config);signed=[]
    for _ in range(stop):
        s.cycle();signed.append(s.world.body-s.world.target())
    return signed

LEAD_WINDOW=(150,192)

def qualify(out):
    install()
    checks=sprint.qualify(out)
    # Planner-fix checks: synthetic landing weights, then measured lead on the qualification seed only.
    flat=np.zeros((len(CANDIDATES),LAGS))
    assert np.allclose(landing_weights(flat),1/LAGS)
    for lag in range(LAGS):
        effect=np.zeros((len(CANDIDATES),LAGS));effect[:,lag:]=CANDIDATES[:,:1]*.15
        assert int(np.argmax(landing_weights(effect)))==lag and landing_weights(effect)[lag]>.99
    checks['landing_weights_synthetic']=True
    slopes={}
    for family in sprint.FAMILIES:
        for config in sprint.CONFIGS:
            signed=run_signed(QUALIFICATION_SEED,family,config,LEAD_WINDOW[1])
            slopes[f'{family}/{config}']=lead_slope(signed,QUALIFICATION_SEED,*LEAD_WINDOW)
    assert all(abs(v)<1. for v in slopes.values()),slopes
    checks['lead_bias_removed_qualification_seed']=slopes
    return checks

def trial(seed,family,config,out):
    row=sprint.trial(seed,family,config,out)
    signed=run_signed(seed,family,config)
    errors=[abs(v) for v in signed]
    if errors!=row['absolute_errors']:raise RuntimeError('Signed replay diverged from measured trial')
    row['lead_slope_A1']=lead_slope(signed,seed,*LEAD_WINDOW)
    row['lead_slope_return']=lead_slope(signed,seed,sprint.START,sprint.START+20)
    return row

def analyze(rows,failures):
    result=sprint.analyze(rows,failures)
    if result['decision']=='BLOCKED':return result
    shuffled=result['pooled']['shuffled']
    memory_specific=shuffled['control_minus_full']>0 and shuffled['ci95'][0]>0
    result['memory_specific']=memory_specific
    result['success']=bool(result['success'] and memory_specific)
    if result['decision']=='RETAIN' and not memory_specific:result['decision']='REVISE'
    result['lead_slope']={c:{w:float(np.mean([r[f'lead_slope_{w}'] for r in rows if r['condition']==c])) for w in ('A1','return')} for c in sprint.CONFIGS}
    return result

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=('qualify','run'));p.add_argument('--out',type=Path,required=True);args=p.parse_args()
    args.out.mkdir(parents=True,exist_ok=False);install()
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
    manifest={'measurement_started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sources':freeze['files'],
              'qualification_sha256':hashlib.sha256(qualification.read_bytes()).hexdigest()}
    save(args.out/'manifest.json',manifest)
    with zipfile.ZipFile(args.out/'source_measured.zip','x',zipfile.ZIP_DEFLATED) as z:
        for name in freeze['files']:z.write(name)
    (args.out/'traces').mkdir();(args.out/'checkpoints').mkdir();rows=[];failures=[]
    with (args.out/'outcomes.jsonl').open('x',encoding='utf-8') as log:
        for family in sprint.FAMILIES:
            for seed in SEEDS:
                for config in sprint.CONFIGS:
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
