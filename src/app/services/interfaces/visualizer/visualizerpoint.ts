/** Coordenadas normalizadas: o Canvas decide quantos pixels cada unidade ocupa. */
export interface VisualizerPoint {
  x: number;
  y: number;
}

export interface VisualizerPath {
  points: VisualizerPoint[];
  closed: boolean;
  layer: number;
  kind: 'curve' | 'bar';
}
