const form = document.querySelector('#inquiry');
const dateInput = document.querySelector('#date');
const today = new Date();
dateInput.min = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
document.querySelectorAll('[data-region]').forEach(link => link.addEventListener('click', () => { document.querySelector('#region').value = link.dataset.region; }));
const priceFor = count => 349 + Math.max(0, count - 8) * 25;
const groupSize = document.querySelector('#group-size');
const childCount = document.querySelector('#children');
function updatePrice() {
  document.querySelector('#group-count').textContent = groupSize.value;
  document.querySelector('#group-price').textContent = `${priceFor(Number(groupSize.value))} €`;
  const n = Number(childCount.value);
  document.querySelector('#form-price').textContent = n >= 1 && n <= 12 ? `${priceFor(n)} €` : '1 à 12 enfants';
}
groupSize.addEventListener('input', () => { childCount.value = groupSize.value; updatePrice(); });
childCount.addEventListener('input', updatePrice);
updatePrice();
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const date = new Date(`${data.get('date')}T12:00:00`).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'});
  document.querySelector('#prepared').value = `Bonjour Sylvain,\n\nJe souhaiterais organiser un anniversaire Pixel le ${date}, à ${data.get('region')}, pour ${data.get('children')} enfants. L’enfant fêté a ${data.get('age')}. Budget indicatif : ${priceFor(Number(data.get('children')))} €.\n${data.get('message') ? `\n${data.get('message')}\n` : ''}\nPourriez-vous me préciser vos disponibilités et les modalités ?\n\n${data.get('parent')}`;
  document.querySelector('#result').hidden = false;
  document.querySelector('#copy-status').textContent = '';
  document.querySelector('#send-email').href = `mailto:svanou@gmail.com?subject=${encodeURIComponent('Demande d’anniversaire Pixel')}&body=${encodeURIComponent(document.querySelector('#prepared').value)}`;
});
document.querySelector('#copy').addEventListener('click', async () => {
  const message = document.querySelector('#prepared');
  try { await navigator.clipboard.writeText(message.value); document.querySelector('#copy-status').textContent = 'Message copié.'; }
  catch { message.focus(); message.select(); document.querySelector('#copy-status').textContent = 'Sélectionnez puis copiez le message avec votre appareil.'; }
});
