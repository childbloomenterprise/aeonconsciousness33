import json
from multiprocessing import Pool
from integration_sprint import sprint
from integration_sprint_v2 import sprint2
sprint2.install()
def job(a):
    s,f,c=a; ses=sprint.Session(s,f,c); return a,[ses.cycle()[1] for _ in range(sprint.TOTAL)]
if __name__=='__main__':
    res=json.load(open('integration_sprint_v2/evaluation/results.json'))
    rows=res['rows'] if 'rows' in res else res
    ref={(r['seed'],r['family'],r['condition']):r['absolute_errors'] for r in map(json.loads,open('integration_sprint_v2/evaluation/outcomes.jsonl'))}
    with Pool() as p: out=p.map(job,list(ref))
    ok=sum(e==ref[k] for k,e in out); print(json.dumps({'runs':len(out),'bit_exact':ok}))
    json.dump({'runs':len(out),'bit_exact':ok},open('battery/repro_sprint2.json','w'))
