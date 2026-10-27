import json,numpy as np,copy
from integration_sprint.sprint import Session,SEEDS,FAMILIES,START,TOTAL,metric
from developmental_v0_2.actors import features
orig={}
for l in open('/home/ubuntu/aeon_ex/integration_sprint/evaluation/outcomes.jsonl'):
    r=json.loads(l);orig[r['family'],r['seed'],r['condition']]=r['loss']
def impulse(model,a=(0.5,0.)):
    # predicted per-tick body change when action a was taken k ticks ago (k=0..4), nothing else
    out=[]
    for k in range(5):
        hist=[[0.,0.]]*5
        if k==0: x=features(np.array(a),hist)
        else:
            h=[[0.,0.]]*5; h[-k]=list(a); x=features(np.array([0.,0.]),h)
        out.append(float(x@model.w - features(np.zeros(2),[[0.,0.]]*5)@model.w))
    return np.round(out,3)
res={}
for fam in FAMILIES:
  for seed in SEEDS:
    for cfg in ('integrated','no_retrieval','shuffled'):
        s=Session(seed,fam,cfg);errs=[];resid=[];acts=[]
        for t in range(TOTAL):
            if t==START:
                lk=s.actor.locked
                imp=impulse(s.actor.models[lk]) if False else None
            obs=s.world.observe();cue=s.world.cue();d=s.actor.decide(obs,cue) if cfg!='adaptive_baseline' else None
            if t==START: imp=impulse(s.actor.models[s.actor.locked])
            s.world.step(d['action']);after=s.world.observe()
            lk=s.actor.locked
            if START<=t<START+20 and lk in obs.signals and lk in after.signals:
                resid.append(abs(after.signals[lk]-obs.signals[lk]-d['prediction'][lk]))
            if START<=t<START+20: acts.append(max(abs(v) for v in d['action']))
            s.actor.learn(after);errs.append(abs(s.world.body-s.world.target()))
        res[fam,seed,cfg]=dict(loss=metric(errs),match=abs(metric(errs)-orig[fam,seed,cfg])<1e-9,resid=float(np.mean(resid)),act=float(np.mean(acts)),imp=imp.tolist(),gains=s.world.gains)
json.dump({'|'.join(map(str,k)):v for k,v in res.items()},open('diag.json','w'))
print('all reproduce exactly:',all(v['match'] for v in res.values()))
for fam in FAMILIES:
    print('\n',fam)
    for cfg in ('integrated','no_retrieval','shuffled'):
        v=[res[fam,s,cfg] for s in SEEDS]
        print(f"{cfg:13s} loss={np.mean([x['loss'] for x in v]):.3f} 1-step body pred err={np.mean([x['resid'] for x in v]):.4f} mean|action|={np.mean([x['act'] for x in v]):.3f} impulse(lag0..4, seed{SEEDS[0]})={v[0]['imp']}")
    print('true gain*0.5 for seed',SEEDS[0],res[fam,SEEDS[0],'integrated']['gains'][0]*.5)
