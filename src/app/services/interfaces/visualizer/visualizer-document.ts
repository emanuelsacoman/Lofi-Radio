import { VisualizerConfig } from './visualizerconfig';

/** A saved creation. The document ID is supplied by Firestore, never by a form. */
export interface VisualizerDocument extends VisualizerConfig {
  description: string;
  enabled: boolean;
  /** Catalog metadata; appearance edits must not overwrite the saved order. */
  order?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VisualizerDraft = Omit<VisualizerDocument, 'id' | 'order' | 'createdAt' | 'updatedAt'>;
