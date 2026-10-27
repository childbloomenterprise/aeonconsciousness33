import numpy as np
from integration_sprint.sprint import Session,SEEDS,FAMILIES,START,TOTAL
rows={}
for fam in FAMILIES:
  for seed in SEEDS:
    for cfg in ('integrated','no_retrieval'):
        s=Session(seed,fam,cfg);se=[];v=[]
        for t in range(TOTAL):
            obs=s.world.observe();d=s.actor.decide(obs,s.world.cue())
            s.world.step(d['action']);after=s.world.observe();s.actor.learn(after)
            se.append(s.world.body-s.world.target())
        rows[fam,seed,cfg]=np.array(se)
# target velocity per tick
import math
def tv(seed,t): 
    f=lambda k:0.55*math.sin(0.035*k+seed*0.13)+0.18*math.sin(0.087*k)
    return f(t+1)-f(t)
for name,(a,b) in {'A1 MPC 150-192':(150,192),'return 576-596':(576,596),'late A2 676-768':(676,768)}.items():
  for cfg in ('integrated','no_retrieval'):
    e=np.concatenate([rows[f,s,cfg][a:b] for f in FAMILIES for s in SEEDS])
    vel=np.concatenate([[tv(s,t+1) for t in range(a,b)] for f in FAMILIES for s in SEEDS])
    k=float(e@vel/(vel@vel)); r=float(np.corrcoef(e,vel)[0,1])
    print(f"{name:18s} {cfg:13s} mean|err|={np.abs(e).mean():.4f} signed err ≈ {k:.2f} x target-velocity (corr {r:.2f}); |err| explained by lead: {np.abs(k*vel).mean():.4f}")
