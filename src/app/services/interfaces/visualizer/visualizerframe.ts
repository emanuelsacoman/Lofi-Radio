export interface VisualizerFrame{
    deltaTime: number;
    isPlaying: boolean;
    intensity: number;
    primaryColor: string;
    secondaryColor: string;
    audioSource: 'simulated' | 'real';
}