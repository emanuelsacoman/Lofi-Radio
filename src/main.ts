import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// 1) ignora erros de rede no Firestore e Realtime DB
window.addEventListener('error', (event) => {
  const src = event.filename || '';
  if (
    src.includes('firestore.googleapis.com') ||
    src.includes('.firebaseio.com')
  ) {
    // impede que o erro vá ao console
    event.stopImmediatePropagation();
    event.preventDefault();
  }
});

// 2) ignora promise rejections de NET_TIMED_OUT / NAME_NOT_RESOLVED
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  if (
    msg.includes('ERR_TIMED_OUT') ||
    msg.includes('ERR_NAME_NOT_RESOLVED')
  ) {
    event.preventDefault();
  }
});

// depois inicialize normalmente o Angular
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
