/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;
declare const __COMMIT_URL__: string;

declare module "abcjs" {
  interface VoiceItemNote {
    chord?: Array<{ name: string }>;
    startBeam?: boolean;
    endBeam?: boolean;
    gracenotes?: Array<{ name: string; pitch?: number; duration?: number }>;
  }
}
