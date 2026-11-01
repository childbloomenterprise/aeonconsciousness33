"""Sprint 3 battery: cue-free v3 memory (BOCPD) and v3 hybrid (MMAC fallback) vs v2, MMAC, PID on fresh seeds."""
import argparse, datetime, hashlib, json, time
from multiprocessing import Pool
from pathlib import Path
import numpy as np
from developmental_v0_2.actors import WARMUP
from developmental_cases.common import paired, save
from integration_sprint import sprint
from battery.battery import BatteryWorld, TESTS, FAMILIES, PID
from baseline_benchmark.benchmark import Controller
from integration_sprint_v3.sprint3 import V3Actor, V3Hybrid

ROOT = Path(__file__).resolve().parent
SEEDS = (31001,31013,31019,31033,31039,31051,31063,31069,31079,31081)
CONFIGS = ('aeon_v3_hybrid','aeon_v3','aeon_v2','aeon_v2_no_retrieval','mmac','pid')
COMPARISONS = [('aeon_v3_hybrid',c) for c in CONFIGS[1:]] + [('aeon_v3','aeon_v2_no_retrieval'),('aeon_v3','aeon_v2')]

def make(config):
    if config=='aeon_v2': return sprint.IntegratedActor('integrated')
    if config=='aeon_v2_no_retrieval': return sprint.IntegratedActor('no_retrieval')
    if config=='aeon_v3': return V3Actor()
    if config=='aeon_v3_hybrid': return V3Hybrid()
    return Controller(config,PID,None)

def run(test, seed, family, config):
    world=BatteryWorld(seed,family,**TESTS[test]); agent=make(config); aeon=config.startswith('aeon'); errors=[]
    start=time.perf_counter()
    for _ in range(world.total()):
        obs=world.observe(); cue=world.cue()
        a=agent.decide(obs,cue)['action'] if aeon else agent.decide(obs)
        world.step(a)
        if aeon: agent.learn(world.observe())
        errors.append(abs(world.body-world.target()))
    wall=time.perf_counter()-start; P=world.phase_len; n=len(world.seq); e=np.array(errors)
    row={'test':test,'seed':seed,'family':family,'condition':config,'absolute_errors':errors,
         'us_per_decision':1e6*wall/len(errors),
         'loss':float(e[(n-1)*P:(n-1)*P+20].sum()),'overall':float(e[WARMUP:].mean()),
         'final_phase':float(e[(n-1)*P:].mean()),'max_error':float(e[WARMUP:].max()),
         'loss_of_control':bool(e[WARMUP:].max()>1.0)}
    if TESTS[test].get('seq')=='ABCBA': row['loss_B_return']=float(e[3*P:3*P+20].sum())
    if config.startswith('aeon_v3'):
        row.update(declarations=list(agent.declarations),restores=agent.retrieval_restored,attempts=agent.retrieval_attempts,
                   fallback_ticks=len(getattr(agent,'fallback_ticks',[])))
    return row

def _job(a): return run(*a)

def analyze(rows):
    res={}
    for t in TESTS:
        tr=[r for r in rows if r['test']==t]; res[t]={}
        for m in ('loss','overall','final_phase')+(('loss_B_return',) if t=='T4_revisits_ABCBA' else ()):
            res[t][m]={f'{a}__vs__{b}':paired(tr,a,b,m) for a,b in COMPARISONS}
        res[t]['loss_of_control_runs']={c:sum(r['loss_of_control'] for r in tr if r['condition']==c) for c in CONFIGS}
        res[t]['us_per_decision']={c:float(np.mean([r['us_per_decision'] for r in tr if r['condition']==c])) for c in CONFIGS}
        for c in ('aeon_v3','aeon_v3_hybrid'):
            v=[r for r in tr if r['condition']==c]
            res[t][c+'_diag']={'restores_per_run':float(np.mean([r['restores'] for r in v])),
                               'declarations_per_run':float(np.mean([len(r['declarations']) for r in v])),
                               'fallback_ticks_per_run':float(np.mean([r['fallback_ticks'] for r in v]))}
    return res

def main():
    p=argparse.ArgumentParser(); p.add_argument('--out',type=Path,required=True); a=p.parse_args()
    freeze=json.loads((ROOT/'protocol_freeze.json').read_text())
    for n,sha in freeze['files'].items():
        if hashlib.sha256(Path(n).read_bytes()).hexdigest()!=sha: raise RuntimeError('Frozen file changed: '+n)
    a.out.mkdir(parents=True,exist_ok=False); start=time.perf_counter()
    with Pool() as pool: rows=pool.map(_job,[(t,s,f,c) for t in TESTS for f in FAMILIES for s in SEEDS for c in CONFIGS])
    with (a.out/'outcomes.jsonl').open('x') as log:
        for r in rows: log.write(json.dumps(r)+'\n')
    res=analyze([{k:v for k,v in r.items() if k!='absolute_errors'} for r in rows])
    save(a.out/'results.json',{'runs':len(rows),'analysis':res,'wall_seconds':time.perf_counter()-start,
         'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
    print('runs',len(rows),'wall',round(time.perf_counter()-start,1))
if __name__=='__main__': main()
