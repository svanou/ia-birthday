const form = document.querySelector('#inquiry');
const dateInput = document.querySelector('#date');
const today = new Date();
dateInput.min = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
document.querySelectorAll('[data-region]').forEach(link => link.addEventListener('click', () => { document.querySelector('#region').value = link.dataset.region; }));
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const date = new Date(`${data.get('date')}T12:00:00`).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
  document.querySelector('#prepared').value = `Bonjour Sylvain,\n\nJe souhaiterais organiser un anniversaire Pixel le ${date}, à ${data.get('region')}, pour ${data.get('children')} enfants.\n${data.get('message') ? `\n${data.get('message')}\n` : ''}\nPourriez-vous me préciser vos disponibilités et les modalités ?\n\n${data.get('parent')}`;
  document.querySelector('#result').hidden = false;
  document.querySelector('#copy-status').textContent = '';
  window.location.href = `mailto:svanou@gmail.com?subject=${encodeURIComponent('Demande d’anniversaire Pixel')}&body=${encodeURIComponent(document.querySelector('#prepared').value)}`;
});
document.querySelector('#copy').addEventListener('click', async () => {
  const message = document.querySelector('#prepared');
  try { await navigator.clipboard.writeText(message.value); document.querySelector('#copy-status').textContent = 'Message copié.'; }
  catch { message.focus(); message.select(); document.querySelector('#copy-status').textContent = 'Sélectionnez puis copiez le message avec votre appareil.'; }
});
