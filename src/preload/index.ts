import { contextBridge } from "electron";

import type { TesseraApi } from "@shared/api";

// Expose only a small typed API. Never expose ipcRenderer itself: the renderer must not send on any channel it likes.
const api: TesseraApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
};

contextBridge.exposeInMainWorld("api", api);
