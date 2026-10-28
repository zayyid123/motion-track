declare module 'gifshot' {
  interface GifshotOptions {
    images?: (string | HTMLCanvasElement | ImageData)[];
    video?: string[];
    gifWidth?: number;
    gifHeight?: number;
    interval?: number;
    numFrames?: number;
    frameDuration?: number;
    sampleInterval?: number;
    numWorkers?: number;
    progressCallback?: (captureProgress: number) => void;
    completeCallback?: (obj: { error: boolean; errorCode: string; errorMsg: string; image: string }) => void;
  }

  export function createGIF(
    options: GifshotOptions,
    callback: (obj: { error: boolean; errorCode: string; errorMsg: string; image: string }) => void
  ): void;

  export function isSupported(): boolean;
}
