import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection } from '@angular/fire/compat/firestore';
import { serverTimestamp } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { VisualizerDocument, VisualizerDraft } from './interfaces/visualizer/visualizer-document';
import { VisualizerCustomization } from './interfaces/visualizer/visualizerconfig';
import {
  normalizeVisualizerCustomization, VISUALIZER_CUSTOMIZATION_CHOICES,
  VISUALIZER_CUSTOMIZATION_LIMITS
} from './visualizer-customization';

type NumericField = {
  [K in keyof VisualizerDraft]-?: VisualizerDraft[K] extends number ? K : never
}[keyof VisualizerDraft];

const NUMBER_LIMITS: Record<NumericField, readonly [number, number, boolean?]> = {
  amplitude: [0, 100], audioSensitivity: [0.2, 4], frequency: [0.25, 12],
  speed: [0, 5], harmonics: [1, 12, true], phase: [-360, 360],
  lineWidth: [0.5, 10], glow: [0, 40], opacity: [0, 1],
  layers: [1, 8, true], resolution: [48, 768, true],
  barCount: [12, 96, true], rotation: [-5, 5]
};

const COLOR_TOKENS = ['theme', 'accent', 'secondary', 'accentLight', 'text'];

/** The admin and the public player share the same durable Firestore catalog. */
@Injectable({ providedIn: 'root' })
export class VisualizerCatalogService {
  private readonly path = 'visualizers';
  private readonly maxOrder = 1000000;
  private readonly maxBatchWrites = 500;

  constructor(private readonly firestore: AngularFirestore) {}

  watchAll(): Observable<VisualizerDocument[]> {
    return this.observe(this.firestore.collection<VisualizerDraft>(this.path));
  }

  watchPublished(): Observable<VisualizerDocument[]> {
    // Required by the rules: draft documents must never enter a public query.
    return this.observe(this.firestore.collection<VisualizerDraft>(
      this.path, ref => ref.where('enabled', '==', true)
    ));
  }

  async create(draft: VisualizerDraft): Promise<string> {
    const data = this.validate(draft);
    const collection = this.firestore.collection<Omit<VisualizerDocument, 'id'>>(this.path);
    const snapshot = await collection.ref.get();
    const records = snapshot.docs.flatMap(document => {
      const stored = document.data();
      try {
        return [{ id: document.id, name: this.validate(stored).name, order: this.readOrder(stored.order) }];
      } catch {
        // Do not modify malformed records omitted from the visible catalog.
        return [];
      }
    });
    const highestOrder = records.reduce((highest, document) => Math.max(highest, document.order ?? 0), 0);
    const legacy = records.filter(document => document.order === undefined)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
    const order = highestOrder + legacy.length + 1;
    if (order > this.maxOrder) {
      throw new Error('Reorganize a biblioteca antes de adicionar outro visualizer.');
    }
    // Use AngularFire's timestamp factory so it uses the same Firebase SDK
    // version as AngularFirestore (the repository also has a newer root SDK).
    const timestamp = serverTimestamp();
    if (legacy.length) {
      if (legacy.length + 1 > this.maxBatchWrites) {
        throw new Error('Organize a ordem da biblioteca antes de adicionar outro visualizer.');
      }
      // Keep existing unranked entries in their visible sequence, then append
      // the new creation. A single commit avoids a partly migrated catalog.
      const document = collection.doc();
      const batch = this.firestore.firestore.batch();
      legacy.forEach((item, index) => {
        batch.update(collection.doc(item.id).ref, {
          order: highestOrder + index + 1, updatedAt: timestamp
        });
      });
      batch.set(document.ref, { ...data, order, createdAt: timestamp, updatedAt: timestamp });
      await batch.commit();
      return document.ref.id;
    }
    const document = await collection.add({
      ...data, order, createdAt: timestamp, updatedAt: timestamp
    });
    return document.id;
  }

  async update(id: string, draft: VisualizerDraft): Promise<void> {
    const documentId = this.validateId(id);
    const data = this.validate(draft);
    // update intentionally fails if the document was removed in another tab.
    await this.firestore.collection(this.path).doc(documentId).update({
      ...data, updatedAt: serverTimestamp()
    });
  }

  async delete(id: string): Promise<void> {
    const documentId = this.validateId(id);
    await this.firestore.collection(this.path).doc(documentId).delete();
  }

  /** Persist one complete ordering atomically; no appearance fields are touched. */
  async reorder(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length > this.maxBatchWrites) {
      throw new Error('É possível ordenar até 500 visualizers por vez.');
    }
    const normalizedIds = ids.map(id => this.validateId(id));
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      throw new Error('A ordem contém visualizers repetidos.');
    }
    if (!normalizedIds.length) return;

    const collection = this.firestore.collection<VisualizerDocument>(this.path);
    const snapshot = await collection.ref.get();
    const currentIds = new Set(snapshot.docs.filter(document => {
      try { this.validate(document.data()); return true; } catch { return false; }
    }).map(document => document.id));
    if (currentIds.size !== normalizedIds.length || normalizedIds.some(id => !currentIds.has(id))) {
      throw new Error('A biblioteca mudou. Atualize a lista antes de ordenar novamente.');
    }

    const batch = this.firestore.firestore.batch();
    const updatedAt = serverTimestamp();
    normalizedIds.forEach((id, index) => {
      batch.update(collection.doc(id).ref, { order: index + 1, updatedAt });
    });
    await batch.commit();
  }

  private observe(collection: AngularFirestoreCollection<VisualizerDraft>): Observable<VisualizerDocument[]> {
    return collection.snapshotChanges().pipe(map(changes => {
      const documents: VisualizerDocument[] = [];
      for (const change of changes) {
        const snapshot = change.payload.doc;
        const data = snapshot.data() as VisualizerDocument;
        try {
          documents.push({
            ...this.validate(data), id: snapshot.id,
            ...(this.readOrder(data.order) === undefined ? {} : { order: data.order }),
            createdAt: data.createdAt, updatedAt: data.updatedAt
          });
        } catch {
          // Legacy or malformed records cannot break the player/render loop.
        }
      }
      return documents.sort((a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)
      );
    }));
  }

  private readOrder(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= this.maxOrder
      ? value : undefined;
  }

  private validateId(id: string): string {
    const value = typeof id === 'string' ? id.trim() : '';
    if (!value || value.includes('/') || value === '.' || value === '..') {
      throw new Error('Identificador do visualizer inválido.');
    }
    return value;
  }

  private validate(draft: VisualizerDraft): VisualizerDraft {
    if (!draft || typeof draft !== 'object') throw new Error('Visualizer inválido.');
    const name = typeof draft.name === 'string' ? draft.name.trim() : '';
    if (!name || name.length > 60) throw new Error('Informe um nome de até 60 caracteres.');
    if (typeof draft.description !== 'string' || draft.description.trim().length > 280) {
      throw new Error('A descrição deve ter até 280 caracteres.');
    }
    if (typeof draft.enabled !== 'boolean') throw new Error('Status de publicação inválido.');
    if (!['wave', 'bars'].includes(draft.geometry) || !['silk', 'bars', 'fireflies'].includes(draft.visualStyle)) {
      throw new Error('Estilo de visualizer inválido.');
    }
    if (draft.geometry !== (draft.visualStyle === 'bars' ? 'bars' : 'wave')) {
      throw new Error('A geometria deve corresponder ao estilo do visualizer.');
    }
    if (typeof draft.icon !== 'string' || !/^[a-z_]{1,40}$/.test(draft.icon)) {
      throw new Error('Ícone de visualizer inválido.');
    }
    const numericValues = {} as Record<NumericField, number>;
    for (const key of Object.keys(NUMBER_LIMITS) as NumericField[]) {
      const value = draft[key];
      const [min, max, integer] = NUMBER_LIMITS[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
          (integer && !Number.isInteger(value))) {
        throw new Error(`Parâmetro inválido: ${key}.`);
      }
      numericValues[key] = value;
    }
    // Explicit fields prevent form-only state, IDs or client timestamps from
    // becoming stored document data, even when callers pass a full document.
    return {
      name, description: draft.description.trim(), enabled: draft.enabled,
      icon: draft.icon, geometry: draft.geometry, visualStyle: draft.visualStyle,
      color: this.validateColor(draft.color),
      secondaryColor: this.validateColor(draft.secondaryColor), ...numericValues,
      ...this.validateCustomization(draft)
    };
  }

  private validateCustomization(draft: VisualizerDraft): VisualizerCustomization {
    for (const key of Object.keys(VISUALIZER_CUSTOMIZATION_LIMITS) as Array<keyof typeof VISUALIZER_CUSTOMIZATION_LIMITS>) {
      const value = draft[key];
      if (value === undefined) continue;
      const [min, max, integer] = VISUALIZER_CUSTOMIZATION_LIMITS[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max ||
          (integer && !Number.isInteger(value))) {
        throw new Error(`Parâmetro inválido: ${key}.`);
      }
    }
    if (draft.mirrorX !== undefined && typeof draft.mirrorX !== 'boolean') {
      throw new Error('Opção de espelhamento inválida.');
    }
    for (const key of Object.keys(VISUALIZER_CUSTOMIZATION_CHOICES) as Array<keyof typeof VISUALIZER_CUSTOMIZATION_CHOICES>) {
      const value = draft[key];
      const choices: readonly string[] = VISUALIZER_CUSTOMIZATION_CHOICES[key];
      if (value !== undefined && (typeof value !== 'string' || !choices.includes(value))) {
        throw new Error(`Opção inválida: ${key}.`);
      }
    }
    // Only missing legacy fields receive defaults. Invalid supplied values fail.
    return normalizeVisualizerCustomization(draft);
  }

  private validateColor(color: string): string {
    const value = typeof color === 'string' ? color.trim() : '';
    if (!COLOR_TOKENS.includes(value) && !/^#[\da-fA-F]{3}(?:[\da-fA-F]{3})?$/.test(value)) {
      throw new Error('Selecione uma cor do tema ou um hexadecimal válido.');
    }
    return value;
  }
}
