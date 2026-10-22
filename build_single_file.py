from pathlib import Path
import base64, json

root=Path(__file__).resolve().parent
dist=root/'dist'
html=(dist/'index.html').read_text(encoding='utf8')
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(dist/'style.css').read_text(encoding='utf8')+'</style>')
assets={p.name:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (dist/'assets').glob('*.png')}
html=html.replace('<script src="config.js"></script>','<script>window.EMBEDDED_ASSETS='+json.dumps(assets)+';</script><script>'+(dist/'config.js').read_text(encoding='utf8')+'</script>')
for name in ['reporting.js','questions.js','challenge.js','app.js']:
    source=(dist/name).read_text(encoding='utf8')
    if name=='questions.js':
        for filename,data in assets.items():source=source.replace('assets/'+filename,data)
    if name=='app.js':source=source.replace('function openImage(src,title){',"function openImage(src,title){src=window.EMBEDDED_ASSETS[src.replace('assets/','')]||src;")
    html=html.replace('<script src="'+name+'"></script>','<script>'+source+'</script>')
output=root.parent/'地理第3-4課精熟練習_成績回傳版.html'
output.write_text(html,encoding='utf8')
print('Standalone reporting edition built. GAS endpoint configuration still required.')
