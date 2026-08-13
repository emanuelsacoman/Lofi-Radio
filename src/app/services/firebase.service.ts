import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Chip } from './interfaces/chip';
import { Youtuber } from './interfaces/youtuber';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private PATH: string = "radios";
  private YOUTUBERS_PATH: string = "youtubers";

  constructor(private firestore: AngularFirestore, private storage: AngularFireStorage) {}

  obterTodosChip() {
    return this.firestore.collection(this.PATH).snapshotChanges();
  }

  private obterMaiorOrdem(): Promise<number> {
    return this.firestore.collection(this.PATH).ref.orderBy('order', 'desc').limit(1).get().then(snapshot => {
      const maxOrder = snapshot.docs.length > 0 ? (snapshot.docs[0].data() as Chip).order : 0;
      return maxOrder;
    });
  }

  private reordenarOrdem(deletedOrder: number): Promise<void> {
    return this.firestore.collection(this.PATH).ref.where('order', '>', deletedOrder).get().then(snapshot => {
      const batch = this.firestore.firestore.batch();
      snapshot.forEach(doc => {
        const ref = this.firestore.collection(this.PATH).doc(doc.id).ref;
        batch.update(ref, { order: (doc.data() as Chip).order - 1 });
      });
      return batch.commit();
    });
  }

  cadastrarChip(chip: Chip) {
    return this.obterMaiorOrdem().then(maxOrder => {
      return this.firestore.collection(this.PATH).add({
        chipname: chip.chipname,
        order: maxOrder + 1
      });
    });
  }

  excluirChip(id: string) {
    return this.firestore.collection(this.PATH).doc(id).get().toPromise().then(doc => {
      if (!doc?.exists) {
        throw new Error('Document does not exist');
      }
      const deletedOrder = (doc.data() as Chip).order;
      return this.firestore.collection(this.PATH).doc(id).delete().then(() => {
        return this.reordenarOrdem(deletedOrder);
      });
    });
  }

  excluirChipsEmLote(ids: string[]): Promise<number> {
    const idsToDelete = new Set(ids.filter(Boolean));

    if (!idsToDelete.size) {
      return Promise.resolve(0);
    }

    return this.firestore.collection(this.PATH).ref.get().then(snapshot => {
      const batch = this.firestore.firestore.batch();
      const remainingChips: Array<{ id: string; order: number }> = [];
      let deletedCount = 0;

      snapshot.forEach(doc => {
        const chip = doc.data() as Partial<Chip>;

        if (idsToDelete.has(doc.id)) {
          batch.delete(doc.ref);
          deletedCount++;
          return;
        }

        remainingChips.push({
          id: doc.id,
          order: chip.order || 0
        });
      });

      if (!deletedCount) {
        return 0;
      }

      remainingChips
        .sort((a, b) => a.order - b.order)
        .forEach((chip, index) => {
          const ref = this.firestore.collection(this.PATH).doc(chip.id).ref;
          batch.update(ref, { order: index + 1 });
        });

      return batch.commit().then(() => deletedCount);
    });
  }

  atualizarChip(id: string, data: Partial<Chip>): Promise<void> {
    return this.firestore.collection(this.PATH).doc(id).update(data);
  }

  atualizarOrdemChips(ids: string[]): Promise<void> {
    return this.atualizarOrdem(this.PATH, ids);
  }

  obterTodosYoutubers() {
    return this.firestore.collection(this.YOUTUBERS_PATH).snapshotChanges();
  }

  cadastrarYoutuber(youtuber: Omit<Youtuber, 'id'>): Promise<{ created: boolean; id: string }> {
    const collection = this.firestore.collection(this.YOUTUBERS_PATH);

    return collection.ref
      .where('channelId', '==', youtuber.channelId)
      .limit(1)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          return {
            created: false,
            id: snapshot.docs[0].id
          };
        }

        const ref = collection.doc(youtuber.channelId).ref;

        return this.firestore.firestore.runTransaction(transaction =>
          transaction.get(ref).then(existingDocument => {
            if (existingDocument.exists) {
              return {
                created: false,
                id: existingDocument.id
              };
            }

            transaction.set(ref, {
              channelId: youtuber.channelId,
              title: youtuber.title,
              order: youtuber.order || 1,
              handle: youtuber.handle || '',
              thumbnailUrl: youtuber.thumbnailUrl || '',
              createdAt: youtuber.createdAt || new Date().toISOString()
            });

            return {
              created: true,
              id: ref.id
            };
          })
        );
      });
  }

  excluirYoutuber(id: string): Promise<void> {
    return this.firestore.collection(this.YOUTUBERS_PATH).doc(id).delete();
  }

  atualizarOrdemYoutubers(ids: string[]): Promise<void> {
    return this.atualizarOrdem(this.YOUTUBERS_PATH, ids);
  }

  cadastrarChipsEmLote(videoIds: string[]): Promise<number> {
    const uniqueVideoIds = Array.from(new Set(videoIds.filter(Boolean)));

    if (!uniqueVideoIds.length) {
      return Promise.resolve(0);
    }

    return this.firestore.collection(this.PATH).ref.get().then(snapshot => {
      const existingVideoIds = new Set<string>();
      let maxOrder = 0;

      snapshot.forEach(doc => {
        const chip = doc.data() as Partial<Chip>;

        if (chip.chipname) {
          existingVideoIds.add(chip.chipname);
        }

        maxOrder = Math.max(maxOrder, chip.order || 0);
      });

      const newVideoIds = uniqueVideoIds.filter(videoId => !existingVideoIds.has(videoId));

      if (!newVideoIds.length) {
        return 0;
      }

      const batch = this.firestore.firestore.batch();

      newVideoIds.forEach((videoId, index) => {
        const ref = this.firestore.collection(this.PATH).doc().ref;
        batch.set(ref, {
          chipname: videoId,
          order: maxOrder + index + 1
        });
      });

      return batch.commit().then(() => newVideoIds.length);
    });
  }

  private atualizarOrdem(path: string, ids: string[]): Promise<void> {
    if (!ids.length) {
      return Promise.resolve();
    }

    const batch = this.firestore.firestore.batch();

    ids.forEach((id, index) => {
      const ref = this.firestore.collection(path).doc(id).ref;
      batch.update(ref, { order: index + 1 });
    });

    return batch.commit();
  }
}
