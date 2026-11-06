"""Run against npm run api + npm run dev; requires Playwright and Chromium."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
import base64,time,uuid
BASE='http://localhost:5173'
fixture=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle')
 for width in [1440,768,390,320]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow {width}'
 page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path='/tmp/pixel-platform-home.png',full_page=True)
 page.get_by_role('button',name='Espace parent ↗',exact=True).click();page.get_by_label('Votre e-mail').fill(f'pilot-{uuid.uuid4()}@example.com');page.get_by_role('button',name='Ouvrir la simulation locale').click();page.get_by_role('button',name='Créer un forfait de simulation').click()
 page.get_by_label('Les pseudonymes').fill('Luna\nNova');page.get_by_role('button',name='Enregistrer ma préparation').click();expect(page.get_by_role('option',name='Luna',exact=True)).to_have_count(1)
 fixture=base64.b64decode(page.evaluate("() => { const c=document.createElement('canvas'); c.width=c.height=200; const x=c.getContext('2d'); x.fillStyle='#f4df99';x.fillRect(0,0,200,200);x.fillStyle='#7560b5';x.fillRect(50,50,100,100); return c.toDataURL('image/png').split(',')[1]; }"))
 page.locator('input[type=file]').set_input_files({'name':'dessin.png','mimeType':'image/png','buffer':fixture})
 page.get_by_label('Je confirme que cette image').check();page.get_by_role('button',name='Faire mon essai',exact=True).click();expect(page.get_by_role('button',name='Essai déjà utilisé')).to_be_visible(timeout=20000)
 party=context.request.get(BASE+'/api/parties').json()[0];pid=party['id']
 def detail():return context.request.get(BASE+'/api/parties/'+pid).json()
 for _ in range(30):
  d=detail()
  if d['jobs'] and d['jobs'][0]['status'] in ['done','failed']:break
  page.wait_for_timeout(500)
 assert d['jobs'][0]['status']=='done',d
 assert d['credits']==20 and not d['trialAvailable']
 before=context.request.post(BASE+f'/api/parties/{pid}/generate',data={'id':str(uuid.uuid4()),'kind':'image','alias':'Luna','upload':str(uuid.uuid4())});assert before.status==403
 page.get_by_label('Je souhaite démarrer maintenant').check();page.get_by_role('button',name='C’est le jour J').click();expect(page.get_by_text('ANIMATION',exact=False)).to_be_visible()
 d=detail();ends=d['ends_at'];assert d['phase']=='active'
 assert context.request.post(BASE+f'/api/parties/{pid}/activate',data={'confirm':True}).status==409
 assert detail()['ends_at']==ends
 # Two isolated browser sessions represent a screen and a different family.
 other=browser.new_context();other.request.post(BASE+'/api/local/login',data={'email':'other@example.com'});assert other.request.get(BASE+f'/api/parties/{pid}').status==404
 code=context.request.post(BASE+f'/api/parties/{pid}/pair',data={'role':'display'}).json()['url'].split('#pair=')[1]
 screen=browser.new_context();assert screen.request.post(BASE+'/api/pair',data={'code':code}).status==200
 assert screen.request.post(BASE+'/api/pair',data={'code':code}).status==403
 assert screen.request.get(BASE+f'/api/parties/{pid}').json()['jobs']==[]
 job=d['jobs'][0]['id'];assert screen.request.get(BASE+f'/api/parties/{pid}/images/{job}').status==404
 assert screen.request.post(BASE+f'/api/parties/{pid}/step',data={'step':2}).status==404
 assert context.request.post(BASE+f'/api/parties/{pid}/approve',data={'job':job,'approved':True}).status==200
 assert len(screen.request.get(BASE+f'/api/parties/{pid}').json()['jobs'])==1
 assert screen.request.get(BASE+f'/api/parties/{pid}/images/{job}').status==200
 assert context.request.post(BASE+f'/api/parties/{pid}/story',data={}).status==200
 assert screen.request.get(BASE+f'/api/parties/{pid}').json()['story'] is None
 assert context.request.post(BASE+f'/api/parties/{pid}/approve',data={'job':'story','approved':True}).status==200
 assert len(screen.request.get(BASE+f'/api/parties/{pid}').json()['story'])==3
 page.reload();expect(page.get_by_role('button',name='Ouvrir la fête')).to_be_visible();page.get_by_role('button',name='Ouvrir la fête').click()
 with page.expect_download() as download:page.get_by_role('button',name='Livret souvenir').click()
 result=download.value;assert not result.failure();assert Path(result.path()).read_bytes().startswith(b'%PDF')
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path='/tmp/pixel-platform-party.png',full_page=True)
 assert not errors,errors
 print('PASS: responsive 4 sizes; login; preparation; queue/R2 trial; fixed activation; family isolation; single-use pairing; display permissions; approval; story; PDF; no JS errors.')
 browser.close()
