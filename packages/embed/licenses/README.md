# License source notes

`legal-notices.ts` reads the package roots contributing bytes to each esbuild output. It copies complete LICENSE/COPYING files and NOTICE files from the installed versions, and preserves legal comments extracted by esbuild. The generated notices do not contain local paths.

The pinned releases of nine packages from [Mux media-elements](https://github.com/muxinc/media-elements) declare MIT and author `@muxinc` in their package.json but ship no license file. The exact reviewed package versions are listed in `legal-notices.ts`. For these releases, `media-elements-MIT.txt` supplies the full MIT permission and warranty text, taken from the installed `media-chrome@4.19.2/LICENSE`; each generated entry also preserves its package name, version, declared author, repository, and SPDX license. No copyright year is inferred where the package supplies none. Any new version without its own license file requires an explicit review of this list.

Other dependencies use their own installed license texts, including `media-chrome`, `@vimeo/player` and `hls.js`. The hls.js archive supplies a short Apache notice, so Apache-2.0 entries also include the full, unmodified license from https://www.apache.org/licenses/LICENSE-2.0.txt (vendored as `Apache-2.0.txt`). Repository licensing is independent of these third-party notices.
