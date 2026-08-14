import { Injectable } from '@angular/core';
import { AngularFirestore, DocumentChangeAction } from '@angular/fire/compat/firestore';
import { Observable } from 'rxjs';
import { Chip } from './interfaces/chip';
import { Youtuber } from './interfaces/youtuber';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly PATH = 'radios';
  private readonly YOUTUBERS_PATH = 'youtubers';
  private readonly MAX_BATCH_WRITES = 500;

  constructor(private firestore: AngularFirestore) {}

  obterTodosChip(): Observable<DocumentChangeAction<Chip>[]> {
    // Keep legacy documents that predate the `order` field. Both consumers
    // apply a deterministic order after reading the complete collection.
    return this.firestore.collection<Chip>(this.PATH).snapshotChanges();
  }

  cadastrarChip(chip: Chip) {
    const videoId = this.normalizeId(chip.chipname);

    if (!videoId) {
      return Promise.reject(new Error('Video ID is required'));
    }

    const collection = this.firestore.collection(this.PATH);
    const ref = collection.doc(videoId).ref;
    const highestOrderQuery = collection.ref.orderBy('order', 'desc').limit(1);
    const legacyDuplicateQuery = collection.ref.where('chipname', '==', videoId).limit(1);

    return Promise.all([
      highestOrderQuery.get(),
      legacyDuplicateQuery.get()
    ]).then(([orderSnapshot, duplicateSnapshot]) => {
      if (!duplicateSnapshot.empty) {
        throw new Error('Radio already exists');
      }

      const maxOrder = orderSnapshot.docs.length > 0
        ? (orderSnapshot.docs[0].data() as Partial<Chip>).order || 0
        : 0;

      return this.firestore.firestore.runTransaction(transaction =>
        transaction.get(ref).then(document => {
          if (document.exists) {
            throw new Error('Radio already exists');
          }

          transaction.set(ref, {
            chipname: videoId,
            order: maxOrder + 1
          });
          return ref;
        })
      );
    });
  }

  excluirChip(id: string) {
    const collection = this.firestore.collection<Chip>(this.PATH);

    return collection.doc(id).get().toPromise().then(async doc => {
      if (!doc?.exists) {
        throw new Error('Document does not exist');
      }

      const deletedOrder = (doc.data() as Chip).order;
      const following = await collection.ref.where('order', '>', deletedOrder).get();

      if (following.size + 1 > this.MAX_BATCH_WRITES) {
        throw new Error('The catalog is too large for an atomic delete');
      }

      const batch = this.firestore.firestore.batch();
      batch.delete(collection.doc(id).ref);
      following.forEach(followingDocument => {
        batch.update(followingDocument.ref, {
          order: (followingDocument.data() as Chip).order - 1
        });
      });

      return batch.commit();
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

      if (snapshot.size > this.MAX_BATCH_WRITES) {
        throw new Error('The catalog is too large for a single atomic cleanup');
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
    const updates: Record<string, string | number> = {};
    const videoId = data.chipname === undefined ? '' : this.normalizeId(data.chipname);

    if (data.chipname !== undefined) {
      if (!videoId) {
        return Promise.reject(new Error('Video ID is required'));
      }
      updates['chipname'] = videoId;
    }

    if (data.order !== undefined) {
      if (!Number.isFinite(data.order) || data.order < 1) {
        return Promise.reject(new Error('Order must be a positive number'));
      }
      updates['order'] = data.order;
    }

    if (data.creator !== undefined) {
      updates['creator'] = data.creator.trim();
    }

    if (data.title !== undefined) {
      updates['title'] = data.title.trim();
    }

    if (!Object.keys(updates).length) {
      return Promise.resolve();
    }

    return this.firestore.collection(this.PATH).doc(id).update(updates);
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
    const uniqueVideoIds = Array.from(new Set(
      videoIds.map(videoId => this.normalizeId(videoId)).filter(Boolean)
    ));

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

      if (newVideoIds.length > this.MAX_BATCH_WRITES) {
        throw new Error('Too many radios for a single batch');
      }

      const batch = this.firestore.firestore.batch();

      newVideoIds.forEach((videoId, index) => {
        const ref = this.firestore.collection(this.PATH).doc(videoId).ref;
        batch.set(ref, {
          chipname: videoId,
          order: maxOrder + index + 1
        });
      });

      return batch.commit().then(() => newVideoIds.length);
    });
  }

  private atualizarOrdem(path: string, ids: string[]): Promise<void> {
    const uniqueIds = Array.from(new Set(ids.map(id => this.normalizeId(id)).filter(Boolean)));

    if (!uniqueIds.length) {
      return Promise.resolve();
    }

    if (uniqueIds.length > this.MAX_BATCH_WRITES) {
      return Promise.reject(new Error('Too many records for a single reorder'));
    }

    const batch = this.firestore.firestore.batch();

    uniqueIds.forEach((id, index) => {
      const ref = this.firestore.collection(path).doc(id).ref;
      batch.update(ref, { order: index + 1 });
    });

    return batch.commit();
  }

  private normalizeId(value: string): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
