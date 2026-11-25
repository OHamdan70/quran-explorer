// ---------- PWA glue: offline cache, install prompt, updates, feedback ----------
// Set FEEDBACK to a mailto: address or a form link to show a "send feedback" button for testers.
const FEEDBACK = 'mailto:osamah@supernodeconsulting.com';

(function () {
  const bar = document.getElementById('appbar');
  const top = document.getElementById('installBar');
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  function banner(html, key) {
    if (key && ls.get(key)) return null;
    const d = document.createElement('div');
    d.className = 'banner';
    d.innerHTML = '<div>' + html + '</div><button class="ghost" aria-label="إغلاق">✕</button>';
    d.querySelector('button[aria-label]').onclick = () => { d.remove(); if (key) ls.set(key, '1'); };
    top.appendChild(d);
    return d;
  }

  // install hint
  if (!standalone) {
    if (isIOS) {
      banner('<b>ثبّت التطبيق على هاتفك:</b> في Safari اضغط زر المشاركة <svg width="16" height="20" viewBox="0 0 16 20" style="vertical-align:-3px" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1v12M4 5l4-4 4 4M5 8H2v11h12V8h-3"/></svg> (أسفل الشاشة) ثم اختر «إضافة إلى الشاشة الرئيسية».', 'iosHint');
    }
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferred = e;
      const d = banner('<b>ثبّت «مستكشف القرآن»</b> على جهازك ليفتح كتطبيق ويعمل دون إنترنت.', 'andHint');
      if (!d) return;
      const b = document.createElement('button'); b.textContent = 'تثبيت';
      b.onclick = async () => { deferred.prompt(); await deferred.userChoice; d.remove(); };
      d.insertBefore(b, d.lastChild);
    });
  }

  // feedback button for testers
  if (FEEDBACK) {
    const a = document.createElement('a');
    a.href = FEEDBACK + (FEEDBACK.startsWith('mailto:') ? '?subject=' + encodeURIComponent('ملاحظات على مستكشف القرآن ' + (document.getElementById('ver') || {}).textContent) : '');
    a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = '<button>أرسل ملاحظاتك</button>';
    bar.appendChild(a);
  }

  // service worker
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const status = document.createElement('span');
    status.className = 'muted';
    status.style.marginInlineStart = '10px';
    bar.appendChild(status);
    status.textContent = 'جارٍ تجهيز العمل دون إنترنت…';
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      status.textContent = '✓ جاهز للعمل دون إنترنت';
    }).catch(() => { status.textContent = ''; });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; }
      const d = banner('<b>تحديث جديد متوفر.</b>', null);
      const b = document.createElement('button'); b.textContent = 'تحديث الآن'; b.onclick = () => location.reload();
      d.insertBefore(b, d.lastChild);
    });
  }
})();
