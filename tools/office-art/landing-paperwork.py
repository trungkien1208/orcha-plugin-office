from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,random
root=Path('packages/web/public'); out=root/'office/landing/paperwork';out.mkdir(parents=True,exist_ok=True)
m=json.load(open(root/'office/manifest.json')); random.seed(17)
for theme in ['office','compound']:
 paper,edge,ink,cork=('#fff3cf','#b9a281','#514b3b','#b38b59') if theme=='office' else ('#253129','#566451','#c9d4bd','#3e4b37')
 def save(name,size,fn):
  im=Image.new('RGBA',size);d=ImageDraw.Draw(im);fn(d,size);im.save(out/f'{theme}-{name}.png',optimize=True);return f'office/landing/paperwork/{theme}-{name}.png'
 paths={}
 paths['cork']=save('cork',(64,64),lambda d,s:d.rectangle((0,0,63,63),fill=cork))
 im=Image.open(root/paths['cork']);d=ImageDraw.Draw(im)
 for _ in range(240):
  x,y=random.randrange(64),random.randrange(64);d.point((x,y),fill=edge if theme=='office' else '#4c5b42')
 im.save(root/paths['cork'],optimize=True)
 for name,w,h in [('note',96,112),('noteAlt',96,112),('wallNotice',128,144),('timeCard',128,180),('masthead',160,40)]:
  def draw(d,s):
   w,h=s;d.rectangle((1,1,w-2,h-2),fill=paper,outline=edge,width=1)
   if name=='wallNotice':
    d.rectangle((14,0,40,7),fill=edge);d.rectangle((w-41,0,w-15,7),fill=edge)
   if name=='timeCard':
    for y in [30,62,94,126,158]:d.line((5,y,w-6,y),fill=edge)
    for y in range(10,h-8,12):d.rectangle((0,y,3,y+4),fill=cork)
   if name=='masthead':
    for y in [4,7,h-8,h-5]:d.line((5,y,w-6,y),fill=ink)
   if name=='noteAlt':d.line((w-12,h-2,w-2,h-12),fill=edge,width=1)
  paths[name]=save(name,(w,h),draw)
 paths['pin']=save('pin',(12,14),lambda d,s:(d.line((6,7,6,13),fill=ink,width=2),d.rectangle((2,1,9,7),fill='#ac5835' if theme=='office' else '#aa6c53',outline=ink),d.point((3,2),fill=paper)))
 paths['punch']=save('punch',(20,20),lambda d,s:(d.rectangle((3,3,16,16),outline=ink,width=2),d.line((6,9,9,13,14,6),fill=ink,width=2)))
 m['landing'][theme+'Paperwork']=paths
logo=Image.open(root/m['landing']['brandMark']).convert('RGBA')
for n in [144,224,32,180]:
 im=logo.copy();im.thumbnail((n,n),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(n,n));canvas.alpha_composite(im,((n-im.width)//2,(n-im.height)//2));path=f'office/landing/brand/easy-chair-{n}.png';canvas.save(root/path,optimize=True);m['landing'][{144:'brandMark144',224:'brandMark224',32:'favicon32',180:'appleTouch'}[n]]=path
og=Image.new('RGB',(1200,630),'#f1eadd');d=ImageDraw.Draw(og);d.rectangle((30,30,1170,600),outline='#b9a281',width=2)
logo.thumbnail((224,224),Image.Resampling.LANCZOS);og.paste(logo,(70,90),logo)
font='/System/Library/Fonts/Supplemental/Arial Bold.ttf';regular='/System/Library/Fonts/Supplemental/Arial.ttf'
d.text((70,330),'easy job',font=ImageFont.truetype(font,68),fill='#42392d');d.text((74,423),'Your Orcha Projects on the Floor',font=ImageFont.truetype(regular,23),fill='#514b3b')
shot=Image.open('docs/review/landing-revamp-before-office-office-1440.png');shot=shot.crop((shot.width//6,230,shot.width*2//3,780));shot.thumbnail((550,500),Image.Resampling.NEAREST);og.paste(shot,(590,70));og.save(out/'social-preview.png',optimize=True);m['landing']['ogImage']='office/landing/paperwork/social-preview.png'
open(root/'office/manifest.json','w').write(json.dumps(m,indent=2)+'\n')
