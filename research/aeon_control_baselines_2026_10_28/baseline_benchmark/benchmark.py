"""AEON sprint-2 controller vs standard control baselines on the sprint-2 worlds.

No LLMs. Worlds, seeds, action set, warmup excitation and metrics are those of
integration_sprint_v2; AEON's rows are read from its frozen results, not re-run.
"""
import argparse, datetime, hashlib, itertools, json, math, time
from multiprocessing import Pool
from pathlib import Path
import numpy as np
from developmental_v0_2.actors import CANDIDATES, WARMUP
from developmental_cases.common import paired, save
from integration_sprint.sprint import RepeatingWorld, FAMILIES, TOTAL, START, PHASE

ROOT = Path(__file__).resolve().parent
SPRINT2 = ROOT.parent/'integration_sprint_v2'/'evaluation'/'results.json'
EVAL_SEEDS = (23001,23003,23009,23011,23021,23027,23033,23041,23047,23053)
QUAL_SEED = 19001
CONTROLLERS = ('oracle','mpc_known','mmac','pid')
DELAYS = range(5)
PID_GRID = {'kp':(.1,.2,.3,.5,.7,1.),'ki':(0.,.01,.03,.1),'kd':(0.,.1,.3,.6)}
WINDOWS = {'A1':(WARMUP,PHASE),'B':(PHASE,2*PHASE),'C':(2*PHASE,3*PHASE),'A2':(3*PHASE,TOTAL)}

def excitation(t):
    p=t%2; amount=(-1.,-.5,.5,1.)[((t//2)*7+t//11)%4]
    return [amount if j==p else 0. for j in range(2)]

def true_delay(world):
    phase=world.tick//PHASE
    if world.sprint_family in ('variable_delay','delay_dropout'):
        return {1:1,2:3}.get(phase,0)
    return 0

class Controller:
    """Shared classical front end: warmup system ID, body-sensor selection, sensor fusion."""
    def __init__(self, kind, pid=None, world=None):
        self.kind, self.pid, self.world = kind, pid, world
        self.data = {}; self.prev_obs=None; self.prev_action=None
        self.actions=[]; self.velocity=0.; self.body=0.; self.prev_body=None
        self.members=None; self.weights=None; self.gains=None
        self.integral=0.; self.prev_error=None
        self.delay_error=np.full(len(DELAYS),.01); self.delay_choice=[]

    def identify(self, target):
        fits={}
        for s,rows in self.data.items():
            if s==target or len(rows)<20: continue
            X=np.array([[1.,u[0],u[1]] for u,_ in rows]); y=np.array([d for _,d in rows])
            b,*_=np.linalg.lstsq(X,y,rcond=None); resid=y-X@b
            fits[s]=(b[1:], float(np.var(resid))+1e-12)
        score={s:np.linalg.norm(b)/math.sqrt(v) for s,(b,v) in fits.items()}
        self.members=sorted(score,key=score.get,reverse=True)[:2]
        inv={s:1/fits[s][1] for s in self.members}
        self.weights={s:v/sum(inv.values()) for s,v in inv.items()}
        self.gains=sum(self.weights[s]*fits[s][0] for s in self.members)

    def estimate(self, obs):
        avail=[s for s in self.members if s in obs.signals]
        if not avail: return self.body
        w=sum(self.weights[s] for s in avail)
        return sum(self.weights[s]*obs.signals[s] for s in avail)/w

    def past(self, k):
        i=len(self.actions)-k
        return np.array(self.actions[i]) if i>=0 else np.zeros(2)

    def landing_choice(self, gains, d, target):
        queued=sum((gains@self.past(k) for k in range(1,d+1)),0.)
        goal=target+self.velocity*(d+1)
        pred=self.body+queued+CANDIDATES@gains
        scores=(pred-goal)**2+.002*np.sum(CANDIDATES**2,axis=1)
        return CANDIDATES[int(np.argmin(scores))]

    def decide(self, obs):
        t=obs.tick; target=obs.signals[obs.target_channel]
        if self.prev_obs is not None:
            self.velocity=float(np.clip(.5*self.velocity+.5*(target-self.prev_obs.signals[self.prev_obs.target_channel]),-.1,.1))
            if t<=WARMUP:
                for s in obs.signals.keys() & self.prev_obs.signals.keys():
                    self.data.setdefault(s,[]).append((self.prev_action,obs.signals[s]-self.prev_obs.signals[s]))
        if t==WARMUP: self.identify(obs.target_channel)
        if t<WARMUP:
            action=np.array(excitation(t))
        else:
            self.body=self.estimate(obs)
            if self.kind=='mmac' and self.prev_body is not None:
                delta=self.body-self.prev_body
                for d in DELAYS:
                    pred=float(self.gains@self.past(d+1))
                    self.delay_error[d]=.9*self.delay_error[d]+.1*(delta-pred)**2
            if self.kind=='pid':
                e=target-self.body
                self.integral=float(np.clip(self.integral+e,-1/max(self.pid['ki'],1e-9),1/max(self.pid['ki'],1e-9))) if self.pid['ki']>0 else 0.
                de=0. if self.prev_error is None else e-self.prev_error
                self.prev_error=e
                desired=self.velocity+self.pid['kp']*e+self.pid['ki']*self.integral+self.pid['kd']*de
                action=CANDIDATES[int(np.argmin(np.abs(CANDIDATES@self.gains-desired)))]
            elif self.kind=='mmac':
                d=int(np.argmin(self.delay_error)); self.delay_choice.append(d)
                action=self.landing_choice(self.gains,d,target)
            elif self.kind=='mpc_known':
                action=self.landing_choice(np.array(self.world.gains),true_delay(self.world),target)
            elif self.kind=='oracle':
                action=self.oracle()
            self.prev_body=self.body
        self.prev_obs=obs; self.prev_action=list(map(float,action)); self.actions.append(self.prev_action)
        return self.prev_action

    def oracle(self):
        # Clairvoyant greedy bound: simulates the true world (dynamics, delay, noise) per candidate.
        state=self.world.state(); d=true_delay(self.world); best=None
        for c in CANDIDATES:
            w=RepeatingWorld.restore(state); w.step(list(c))
            for _ in range(d): w.step([0.,0.])
            score=(w.body-w.target())**2+.002*float(c@c)
            if best is None or score<best[0]: best=(score,c)
        return best[1]

def run(seed,family,kind,pid=None):
    world=RepeatingWorld(seed,family); ctl=Controller(kind,pid,world); errors=[]
    for _ in range(TOTAL):
        before=hashlib.sha256(json.dumps(world.state(),sort_keys=True,default=list).encode()).hexdigest() if kind=='oracle' else None
        a=ctl.decide(world.observe())
        if before is not None:
            assert before==hashlib.sha256(json.dumps(world.state(),sort_keys=True,default=list).encode()).hexdigest()
        world.step(a); errors.append(abs(world.body-world.target()))
    return {'seed':seed,'family':family,'condition':kind,'absolute_errors':errors,'members':ctl.members,
            'true_members':list(world.sensors[:2]),'gains_identified':[float(g) for g in ctl.gains],'gains_true':list(world.gains),
            'delay_choice':ctl.delay_choice,**metrics(errors)}

def metrics(errors):
    m={'loss':float(sum(errors[START:START+20])),'overall':float(np.mean(errors[WARMUP:]))}
    m.update({f'mean_{k}':float(np.mean(errors[a:b])) for k,(a,b) in WINDOWS.items()})
    return m

def _job(args): return run(*args)

def qualify(out):
    checks={}
    with Pool() as pool:
        combos=[dict(zip(PID_GRID,v)) for v in itertools.product(*PID_GRID.values())]
        results=pool.map(_job,[(QUAL_SEED,f,'pid',c) for c in combos for f in FAMILIES])
        grid=[{'pid':c,'overall':float(np.mean([r['overall'] for r in results[i*3:(i+1)*3]]))} for i,c in enumerate(combos)]
        best=min(grid,key=lambda g:g['overall'])
        rows=pool.map(_job,[(QUAL_SEED,f,k,best['pid']) for f in FAMILIES for k in CONTROLLERS])
    checks['pid_tuned']=best
    checks['members_identified']=all(set(r['members'])==set(r['true_members']) for r in rows)
    checks['gain_error_max']=max(abs(a-b)/abs(b) for r in rows for a,b in zip(r['gains_identified'],r['gains_true']))
    for f in FAMILIES:
        by={r['condition']:r for r in rows if r['family']==f}
        checks[f'overall_{f}']={k:by[k]['overall'] for k in CONTROLLERS}
        checks[f'oracle_best_{f}']=all(by['oracle']['overall']<=by[k]['overall'] for k in CONTROLLERS)
        choice=np.array(by['mmac']['delay_choice'])
        truth=np.array([{1:1,2:3}.get(t//PHASE,0) if f!='sensor_dropout' else 0 for t in range(WARMUP,TOTAL)])
        checks[f'mmac_delay_accuracy_{f}']=float(np.mean(choice==truth))
    assert checks['members_identified'] and checks['gain_error_max']<.1
    assert all(checks[f'oracle_best_{f}'] for f in FAMILIES)
    save(out/'pid_grid.json',grid)
    return checks

def analyze(rows):
    aeon=json.loads(SPRINT2.read_text())['runs']
    for r in aeon:
        if r['condition'] in ('integrated','no_retrieval'):
            rows.append({'seed':r['seed'],'family':r['family'],'condition':'aeon_'+r['condition'],**metrics(r['absolute_errors'])})
    assert len(rows)==180
    names=('aeon_no_retrieval',)+CONTROLLERS
    res={}
    for m in ('loss','overall')+tuple(f'mean_{k}' for k in WINDOWS):
        res[m]={'pooled':{c:paired(rows,'aeon_integrated',c,m) for c in names},
                'by_family':{f:{c:paired([r for r in rows if r['family']==f],'aeon_integrated',c,m) for c in names} for f in FAMILIES}}
    return res

def main():
    p=argparse.ArgumentParser(); p.add_argument('mode',choices=('qualify','run')); p.add_argument('--out',type=Path,required=True)
    a=p.parse_args(); a.out.mkdir(parents=True,exist_ok=False); start=time.perf_counter()
    if a.mode=='qualify':
        checks=qualify(a.out); save(a.out/'qualification.json',{'passed':True,'checks':checks}); print(json.dumps(checks,indent=1)); return
    freeze=json.loads((ROOT/'protocol_freeze.json').read_text())
    for name,sha in freeze['files'].items():
        if hashlib.sha256(Path(name).read_bytes()).hexdigest()!=sha: raise RuntimeError('Frozen file changed: '+name)
    pid=freeze['pid']
    with Pool() as pool:
        rows=pool.map(_job,[(s,f,k,pid) for f in FAMILIES for s in EVAL_SEEDS for k in CONTROLLERS])
    with (a.out/'outcomes.jsonl').open('x') as log:
        for r in rows: log.write(json.dumps(r)+'\n')
    res=analyze([{k:v for k,v in r.items() if k!='absolute_errors'} for r in rows])
    save(a.out/'results.json',{'analysis':res,'wall_seconds':time.perf_counter()-start,
        'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    for m in ('loss','overall'):
        print(m,{c:(round(v['mean_control'],4),round(v['improvement_percent'],1),[round(x,4) for x in v['ci95']]) for c,v in res[m]['pooled'].items()},'aeon',round(res[m]['pooled']['pid']['mean_full'],4))
if __name__=='__main__': main()
