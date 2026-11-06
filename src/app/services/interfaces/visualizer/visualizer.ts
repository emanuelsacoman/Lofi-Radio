import { VisualizerFrame } from "./visualizerframe";

export interface Visualizer {
    readonly id: string;
    init(canvas: HTMLCanvasElement): void;
    update(frame: VisualizerFrame): void;
    resize(width: number, height: number): void;
    destroy(): void;

}