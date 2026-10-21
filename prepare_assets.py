from pathlib import Path
import pdfplumber, pypdfium2 as pdfium, re, json

root=Path(__file__).parent
out=root/'dist/assets'
student=next(root.parent.glob('*練習本*學用.pdf'))
teacher=next(root.parent.glob('*練習本*教用.pdf'))
pdf=pdfium.PdfDocument(str(student))
# Coordinates use the original PDF points. All visual content is from the student PDF.
pages={13:[(1,94,363),(2,363,699)],14:[(3,51,190),(4,190,371),(5,371,711)],15:[(6,96,391),(7,391,701)],16:[(8,345,417),(9,417,574),(10,574,675)],18:[(1,94,319),(2,319,705)],19:[(3,51,234),(4,234,503),(5,503,708)],20:[(6,96,281),(7,281,514),(8,514,708)],21:[(9,355,490),(10,490,655)]}
explanations={3:[
'第一級產業就業人口比例下降，第二、三級產業合計已超過一半，顯示目前以工商業為主。',
'市場對飲食的需求改變，使農民轉種經濟價值較高的作物。',
'豐富礦產與能源、鄰近中亞，是西部大開發地區的特色；圖中的丁最符合。',
'改革開放初期設立的經濟特區位於東南沿海，圖中為丙。',
'中國西部內陸降水稀少，以乾燥氣候為主，過度墾耕與灌溉容易造成沙漠化及鹽鹼化。',
'煤礦多分布在中國北部。冬季盛行西北季風，汙染物可隨風影響鄰國。',
'東部沿海外商投資遠高於西部內陸，反映沿海與內陸發展不均衡。',
'中國基本工資上漲，使生產成本提高，臺商對中國的投資比例因此下降。',
'「騰籠換鳥」以服務業、高科技與新興產業取代傳統勞力密集製造業，AI 產業最符合。',
'臺商移往工資較低、勞力充足的國家，可以降低生產成本。'],4:[
'龐大人口同時提供充足勞力與廣大消費市場，使中國兼具生產大國和消費大國的角色。',
'一帶一路透過貸款與合作興建交通等基礎建設，財政困難的參與國可能面臨債務危機。',
'寮國需要償還龐大的鐵路借款，反映一帶一路可能帶來的債務陷阱。',
'乙路線通過中國西北與中亞，貫通歐亞，並避開甲路線較寒冷的高緯地區。',
'甲位於內蒙古自治區，傳統產業以畜牧業為主，大量開採可能影響牛乳加工業。',
'最低月薪上升代表廉價勞力優勢減弱，使勞力密集產業外移，世界工廠地位受到挑戰。',
'區域全面經濟夥伴協定（RCEP）透過關稅減免，促進中國與鄰國的貿易交流。',
'嬰兒車、雨傘等用品多屬勞力密集產業，中國廉價且充足的勞力能降低生產成本。',
'燃煤排放二氧化碳等溫室氣體。減少對煤炭的依賴，有助於減緩全球暖化。',
'中國煤炭消費量龐大，足以影響全球趨勢，反映中國是世界主要消費國。']}
questions=[]
with pdfplumber.open(teacher) as t, pdfplumber.open(student) as s:
 for page,regions in pages.items():
  chapter=3 if page<17 else 4
  answers={int(n):ord(a)-ord('Ａ') for a,n in re.findall(r'\(\s*([Ａ-Ｄ])\s*\)\s*(\d+)\.',t.pages[page-1].extract_text())}
  im=pdf[page-1].render(scale=2.5).to_pil().convert('RGB')
  def crop(name,x0,y0,x1,y1):
   im.crop(tuple(round(v*2.5) for v in (x0,y0,x1,y1))).save(out/name)
  for n,start,end in regions:
   name=f'q-{chapter}-{n}.png';crop(name,67,start,574,end)
   text=s.pages[page-1].crop((67,start,574,end)).extract_text() or ''
   questions.append(dict(id=f'{chapter}-{n}',chapter=chapter,number=n,page=page+1,pdfPage=page,image='assets/'+name,passage=('assets/passage-'+str(chapter)+'.png') if page in [16,21] else None,answer=answers[n],explanation=explanations[chapter][n-1],text=text))
  if page in [16,21]:crop(f'passage-{chapter}.png',75,50,574,345 if page==16 else 355)
 # Chapter review pages are included as original images.
 for i in [11,16]:
  pdf[i].render(scale=2).to_pil().save(out/f'review-{3 if i==11 else 4}.png')
(root/'dist/questions.js').write_text('window.QUESTIONS = '+json.dumps(questions,ensure_ascii=False)+';\n',encoding='utf8')
assert len(questions)==20 and len(set(q['id'] for q in questions))==20
print('Prepared and checked 20 question images, 2 passages, and teacher answer keys.')
