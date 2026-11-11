/**
 * One external repository of the differential corpus, fetched at exactly
 * `commit` so a run is reproducible.
 */
export interface CorpusRepository {
  name: string;
  url: string;
  subdirectory: string;
  commit: string;
}

/**
 * The pinned external TS/React corpus. It is cloned into
 * `.cache/lint-parity/corpus` by the harness and never committed.
 */
export const CORPUS: readonly CorpusRepository[] = [
  {
    name: "vercel-commerce",
    url: "https://github.com/vercel/commerce.git",
    subdirectory: ".",
    commit: "f7521d57d29f0eb3d23c1399cf9bb299d61fcd21",
  },
  {
    name: "shadcn-taxonomy",
    url: "https://github.com/shadcn-ui/taxonomy.git",
    subdirectory: ".",
    commit: "298a8857c7128a0d121e7f699dfd729f23b3966d",
  },
  {
    name: "pmndrs-zustand",
    url: "https://github.com/pmndrs/zustand.git",
    subdirectory: "src",
    commit: "382d29c485e67018c06e75ec7235130d0968522c",
  },
];
