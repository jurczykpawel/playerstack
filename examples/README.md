# Examples

Representative use cases. Each folder is a self-contained example with its own README explaining what it does and how to run it.

| #   | Folder                                          | Stack           | What it shows                                              |
| --- | ----------------------------------------------- | --------------- | ---------------------------------------------------------- |
| 1   | [vanilla-html](./01-vanilla-html)               | HTML + CDN      | Simplest possible embed — one script tag, one element      |
| 2   | [multi-instance](./02-multi-instance)           | HTML            | Multiple players on one page, each with its own config     |
| 3   | [gdpr-click-to-load](./03-gdpr-click-to-load)   | HTML            | Privacy-first: no third-party cookies until user clicks    |
| 4   | [analytics-tracking](./04-analytics-tracking)   | HTML + JS       | Send `cta:click`, `thumb:click` to your analytics endpoint |
| 5   | [custom-plugin](./05-custom-plugin)             | TS              | Write your own plugin (chapter markers)                    |
| 6   | [react-component](./06-react-component)         | React + TS      | React wrapper with proper SSR fallback                     |
| 7   | [vue-component](./07-vue-component)             | Vue 3 SFC       | Vue component with reactive config                         |
| 8   | [astro-component](./08-astro-component)         | Astro           | Astro `.astro` component for static sites                  |
| 9   | [next-js-app](./09-next-js-app)                 | Next.js 15      | Next.js with dynamic import (no SSR for the player)        |
| 10  | [tailwind-styled](./10-tailwind-styled)         | HTML + Tailwind | Styling overrides via Tailwind utilities                   |
| 11  | [wordpress-shortcode](./11-wordpress-shortcode) | PHP             | WordPress shortcode without a plugin                       |
| 12  | [sellf-integration](./12-sellf-integration)     | TS              | Drive config from a Sellf product endpoint                 |

## Running locally

Most HTML examples can be opened directly in the browser via:

```sh
cd examples/01-vanilla-html
python3 -m http.server 8000
# open http://localhost:8000
```

Framework examples (React/Vue/Astro/Next.js) have their own install/run instructions in their README.

## Using local Playerstack

By default, every example loads the standalone script hosted by the documentation site. The URL follows the currently hosted build; download and self-host a copy if you need to pin the artifact. To test against the local build instead:

```sh
# from repo root
bun run --cwd packages/embed build
```

Then in any example's `index.html`, replace:

```html
<script
  src="https://playerstack.techskills.academy/playerstack.min.js"
  defer
></script>
```

with:

```html
<script src="../../packages/embed/dist/playerstack.min.js" defer></script>
```
