// jsdom ships no types; the tests use only the constructor and the window.
declare module 'jsdom' {
  export class VirtualConsole {}
  export class JSDOM {
    constructor(html: string, options?: { url?: string; virtualConsole?: VirtualConsole });
    window: Window & typeof globalThis;
  }
}
