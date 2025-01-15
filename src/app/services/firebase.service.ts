import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Chip } from './interfaces/chip';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private PATH: string = "radios";

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
}
