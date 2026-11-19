import { VisualizerConfig } from './visualizerconfig';

/** A saved creation. The document ID is supplied by Firestore, never by a form. */
export interface VisualizerDocument extends VisualizerConfig {
  description: string;
  enabled: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VisualizerDraft = Omit<VisualizerDocument, 'id' | 'createdAt' | 'updatedAt'>;
