/** Resolve public art beside either app entry, including GitHub repository subpaths. */
export function officeAssetUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ""), document.baseURI).href;
}
