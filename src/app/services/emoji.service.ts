import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';

@Injectable({
  providedIn: 'root',
})
export class EmojiService {
  constructor(private db: AngularFireDatabase) {}

  getEmojis() {
    return this.db.list('emojis').valueChanges(); 
  }

  sendEmoji(emoji: string) {
    const emojiRef = this.db.list('emojis');
    const newEmoji = emojiRef.push({ emoji });
    
    newEmoji.then(() => {
      setTimeout(() => {
        newEmoji.remove();
      }, 5000);
    });
  }

  getLastEmoji() {
    return this.db.list('emojis', ref => ref.limitToLast(1)).valueChanges();
  }
}
