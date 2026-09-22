// Types for the parts of Electron the plugin uses on desktop. Obsidian ships Electron, so it is not an npm dependency.

declare module 'electron' {
    export interface BrowserWindow {
        loadURL(url: string): Promise<void>;
        webContents: {
            executeJavaScript(code: string): Promise<unknown>;
            printToPDF(options: Record<string, unknown>): Promise<Uint8Array>;
        };
        isDestroyed(): boolean;
        close(): void;
    }
    export type BrowserWindowConstructor = new (options: Record<string, unknown>) => BrowserWindow;
    export const shell: {
        openPath(path: string): Promise<string>;
        openExternal(url: string): Promise<void>;
    };
    export const remote: { BrowserWindow?: BrowserWindowConstructor } | undefined;
}

declare module '@electron/remote' {
    import type { BrowserWindowConstructor } from 'electron';
    export const BrowserWindow: BrowserWindowConstructor | undefined;
}
