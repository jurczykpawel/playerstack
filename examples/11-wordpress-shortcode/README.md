# 11 — WordPress shortcode (no plugin)

A drop-in PHP file that adds the `[playerstack]` shortcode to any WordPress site. No plugin upload, no admin UI.

## Install

Three options, easiest first:

### Option 1: child theme `functions.php`

Paste the contents of `playerstack-shortcode.php` (without the opening `<?php`) into your child theme's `functions.php`.

### Option 2: must-use plugin

```sh
# On your server
mkdir -p wp-content/mu-plugins
cp playerstack-shortcode.php wp-content/mu-plugins/
```

`mu-plugins` are auto-loaded — no activation needed. They survive plugin updates and theme switches.

### Option 3: regular plugin

Add a header to the file:

```php
<?php
/*
Plugin Name: Playerstack Shortcode
*/
```

Zip and upload via Plugins → Add New → Upload.

## Usage

In any post or page editor:

```
[playerstack src="https://youtu.be/dQw4w9WgXcQ"]
```

With config:

```
[playerstack
  src="https://youtu.be/dQw4w9WgXcQ"
  poster="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
  title="Welcome video"
  accent="#008aff"
  click_to_load="true"
  cta_title="Get the course"
  cta_label="Buy now"
  cta_url="https://example.com/buy"
  cta_utm="utm_source=video&utm_campaign=welcome"
]
```

## All shortcode attributes

| Attribute       | Type              | Description                          |
| --------------- | ----------------- | ------------------------------------ |
| `src`           | string (required) | Video URL — YouTube, Vimeo, MP4, HLS |
| `poster`        | URL               | Custom poster image                  |
| `title`         | string            | Accessible title                     |
| `accent`        | CSS color         | Theme color (e.g. `#008aff`)         |
| `click_to_load` | `true` / `false`  | GDPR-friendly click-to-load          |
| `cta_title`     | string            | Heading at end of video              |
| `cta_label`     | string            | CTA button text                      |
| `cta_url`       | URL               | CTA destination                      |
| `cta_utm`       | string            | UTM query string appended to CTA url |

## Why not just use Presto Player?

Presto Player is a great WordPress plugin if you're all-in on WP. Playerstack is for cases where:

- You want the same player on a WordPress site **and** on a static landing page **and** in a Sellf product
- You don't want to maintain a WP plugin codebase
- You want MIT licensing (Presto is GPL — fine for distribution but locks you into copyleft if you fork)

For a pure-WP setup with no other touchpoints, Presto is probably easier.

## Performance

The shortcode loads the Playerstack bundle **once per page**, regardless of how many `[playerstack]` shortcodes are on the page. WordPress's `wp_enqueue_script` deduplicates automatically. (Media Chrome ships its own UI as Web Components, so no separate stylesheet is needed.)

The bundle is `defer`-loaded (Strategy API in WP 6.3+), so it doesn't block render.
