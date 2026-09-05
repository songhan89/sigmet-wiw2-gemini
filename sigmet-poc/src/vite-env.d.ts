/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPTILER_API: string;
  readonly MAPTILER_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
