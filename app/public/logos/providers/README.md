# Provider logo tiles

`ModelLogo` loads SVGs from this directory through same-origin paths such as
`/logos/providers/openai.svg`. It uses the mappings in
`app/src/components/ui/model-logo.tsx`; providers without a mapped tile render
a colored initials badge. A failed primary image uses an additional local tile
when configured, otherwise initials.

The primary tiles were sourced from
[homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons).
The directory also contains the custom Mercury, Coinbase and Gonka tiles.

When adding a tile, verify that its viewBox and visible shapes render at the
20–36 pixel sizes used by the interface. Add the mapping only after checking the
image in a browser. Keep the local logo tests aligned with the mapping; do not
add a remote CDN dependency to the page.
