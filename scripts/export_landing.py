"""Export the public pilot presentation from the locally running React app.
No app URL is invented: until deployment, calls to action request an invitation.
Run with the API and Vite started, in the repo root.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page();page.goto('http://localhost:5173/',wait_until='networkidle')
 page.evaluate('''() => {
 document.querySelectorAll('.mode-banner,.error').forEach(e=>e.remove());
 for(const button of document.querySelectorAll('button')){
  const a=document.createElement('a');a.className=button.className||'button';
  if(button.textContent.includes('Confidentialité')){a.href='#informations';a.textContent=button.textContent;}
  else {a.href='mailto:svanou@gmail.com?subject=Participer%20au%20pilote%20Pixel';a.textContent='Demander une invitation';}
  button.replaceWith(a);
 }
 for(const image of document.querySelectorAll('img[src="/pixel.svg"]')) image.setAttribute('src','assets/pixel.svg');
 document.querySelector('header .brand').setAttribute('href','#');
 }''')
 html=page.locator('#root').inner_html();b.close()
legal='''<section id="informations"><h2>Informations du pilote</h2><p>Pixel est un projet présenté par Sylvain. Contact : <a href="mailto:svanou@gmail.com">svanou@gmail.com</a>. Le pilote est sur invitation ; les ventes ne sont pas ouvertes. L’identité complète du vendeur et les conditions commerciales seront précisées avant toute vente.</p><p>Cette page est hébergée sur GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis). Elle n’utilise ni formulaire de collecte, ni cookie publicitaire, ni outil d’analyse. Les liens de contact ouvrent votre application e-mail. Les messages reçus servent à répondre aux demandes d’information sur le pilote. Pour toute demande d’accès, de correction ou de suppression des données échangées : svanou@gmail.com.</p><p>GitHub peut traiter des données techniques pour l’hébergement : consultez sa <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">politique de confidentialité</a>. Les traitements de la future plateforme seront présentés avant sa mise en service.</p></section>'''
Path('index.html').write_text('''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixel — L’anniversaire IA animé par les parents</title><meta name="description" content="Animez vous-même un anniversaire créatif avec Pixel. 4 heures d’accès, jusqu’à 10 enfants, 39 € par fête. Découvrez le pilote privé."><meta name="theme-color" content="#f8f5ee"><link rel="stylesheet" href="assets/style.css"><link rel="canonical" href="https://svanou.github.io/ia-birthday/"></head><body>'''+html+legal+'</body></html>')
shutil.copyfile('platform/src/style.css','assets/style.css');shutil.copyfile('platform/public/pixel.svg','assets/pixel.svg')
print('Public pilot presentation exported without login, API calls or simulation controls.')
