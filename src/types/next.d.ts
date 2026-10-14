/// <reference types="next" />
/// <reference types="next/image-types/global" />

// Next writes next-env.d.ts on its first build, which is generated and not committed. This
// file carries the same ambient references so that `npm run typecheck` works in a clean clone
// before anything has been built.
