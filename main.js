const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'✕':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}));


// FormSubmit AJAX: retain the current page and report the actual API result.
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  const status = document.getElementById('formStatus');
  const sendButton = contactForm.querySelector('button[type="submit"]');
  const defaultButtonMarkup = sendButton.innerHTML;
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity() || sendButton.disabled) return;
    const payload = new FormData(contactForm);
    // Keep the optional anti-bot field in the request, but never show it.
    sendButton.disabled = true;
    sendButton.textContent = '送信中…';
    status.hidden = false;
    status.className = 'form-status is-pending';
    status.textContent = 'お問い合わせを送信しています。しばらくお待ちください。';
    try {
      const response = await fetch('https://formsubmit.co/ajax/code4aichi@gmail.com', {
        method: 'POST',
        body: payload,
        headers: { 'Accept': 'application/json' }
      });
      let result;
      try { result = await response.json(); } catch { result = null; }
      const accepted = response.ok && result && (result.success === 'true' || result.success === true);
      if (!accepted) {
        throw new Error(result && (result.message || result.error) || '送信を確認できませんでした。');
      }
      status.className = 'form-status is-success';
      status.textContent = '送信が完了しました。お問い合わせありがとうございます。';
      contactForm.reset();
    } catch (error) {
      status.className = 'form-status is-error';
      status.textContent = '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。';
      console.error('Contact form submission error:', error);
    } finally {
      sendButton.disabled = false;
      sendButton.innerHTML = defaultButtonMarkup;
    }
  });
}
