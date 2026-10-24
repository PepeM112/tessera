/** API that the preload script exposes to the renderer as `window.api`. */
export interface TesseraApi {
  platform: string;
  versions: {
    electron: string;
    chrome: string;
    node: string;
  };
}
