"""Send synthetic test records only; reruns reuse the same IDs to avoid duplicates."""
from pathlib import Path
import json, urllib.request, urllib.parse, uuid

root=Path(__file__).resolve().parent
config=(root/'dist/config.js').read_text(encoding='utf8')
import re
url=re.search(r"gasUrl:\s*'([^']+)'",config).group(1)
fixture=root/'outputs/gas-smoke.json'
if fixture.exists():
    events=json.loads(fixture.read_text(encoding='utf8'))
else:
    from datetime import datetime,timezone
    training=str(uuid.uuid4())
    events=[dict(assignmentId='geography-ch34-v2',trainingId=training,
        student=dict(className='測試班',seat='99',name='測試學生'),questionId='3-1',selected=0,
        eventId=str(uuid.uuid4()),receiptToken=str(uuid.uuid4()),createdAt=datetime.now(timezone.utc).isoformat()) for _ in range(2)]
    fixture.parent.mkdir(exist_ok=True)
    fixture.write_text(json.dumps(events,ensure_ascii=False),encoding='utf8')
for n,event in enumerate([events[0],events[0],events[1]],1):
    req=urllib.request.Request(url,data=json.dumps(event,ensure_ascii=False).encode('utf8'),headers={'Content-Type':'text/plain;charset=utf-8'},method='POST')
    with urllib.request.urlopen(req,timeout=45) as response:
        result=json.loads(response.read().decode('utf8'))
        print('POST',n,json.dumps(result,ensure_ascii=False))
        assert result.get('ok') is True,'GAS did not confirm writing'
    callback='geoReceipt_'+uuid.uuid4().hex
    query=urllib.parse.urlencode(dict(action='receipt',eventId=event['eventId'],receiptToken=event['receiptToken'],callback=callback))
    with urllib.request.urlopen(url+'?'+query,timeout=25) as response:
        raw=response.read().decode('utf8');assert raw.startswith(callback+'(')
        receipt=json.loads(raw[len(callback)+1:-2]);print('RECEIPT',n,receipt)
        assert receipt.get('ok') is True
print('PASS: two synthetic correct answers and one duplicate retry acknowledged. Expected two detail rows; one summary row; first score 5/100; mastery 1/20.')
