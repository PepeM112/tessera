import type { TesseraApi } from "@shared/api";

declare global {
  interface Window {
    api: TesseraApi;
  }
}
