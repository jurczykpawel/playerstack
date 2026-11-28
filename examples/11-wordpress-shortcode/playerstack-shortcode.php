<?php
/**
 * Playerstack shortcode for WordPress — no plugin needed.
 *
 * Drop this file into your child theme's functions.php or a mu-plugin.
 * Then in any post / page editor, use:
 *
 *   [playerstack src="https://youtu.be/abc123"]
 *   [playerstack src="..." poster="https://..." accent="#008aff"]
 *   [playerstack src="..." cta_label="Buy now" cta_url="https://example.com/buy"]
 *
 * Loads the Playerstack bundle from the documentation site once per page (regardless of
 * how many shortcodes are on the page).
 */

if (!defined('ABSPATH')) {
    exit;
}

class PlayerstackShortcode
{
    private const PLAYERSTACK_URL = 'https://playerstack.techskills.academy/playerstack.min.js';

    private bool $assets_enqueued = false;

    public function __construct()
    {
        add_shortcode('playerstack', [$this, 'render']);
    }

    public function render($atts): string
    {
        $atts = shortcode_atts([
            'src' => '',
            'poster' => '',
            'title' => '',
            'accent' => '',
            'click_to_load' => '',
            'cta_title' => '',
            'cta_label' => '',
            'cta_url' => '',
            'cta_utm' => '',
        ], $atts, 'playerstack');

        if (empty($atts['src'])) {
            return '<!-- playerstack: missing src attribute -->';
        }

        $this->enqueue_assets();

        $config = [];
        $accent = sanitize_hex_color($atts['accent']);
        if (!empty($accent)) {
            $config['controls'] = ['accent' => $accent];
        }
        if ($atts['click_to_load'] === 'true' || $atts['click_to_load'] === '1') {
            $config['brandedThumb'] = ['enabled' => true, 'clickToLoad' => true];
        }
        $cta_url = esc_url_raw($this->decoded($atts['cta_url']));
        if (!empty($atts['cta_label']) && !empty($cta_url)) {
            $config['ctaEnd'] = [
                'enabled' => true,
                'title' => sanitize_text_field($this->decoded($atts['cta_title'])),
                'button' => array_filter([
                    'label' => sanitize_text_field($this->decoded($atts['cta_label'])),
                    'url' => $cta_url,
                    'utm' => sanitize_text_field($this->decoded($atts['cta_utm'])),
                ]),
                'showReplay' => true,
            ];
        }

        $attributes = [
            'src="' . esc_url($atts['src']) . '"',
        ];
        if (!empty($atts['poster'])) {
            $attributes[] = 'poster="' . esc_url($atts['poster']) . '"';
        }
        if (!empty($atts['title'])) {
            $attributes[] = 'title="' . esc_attr($atts['title']) . '"';
        }
        if (!empty($config)) {
            // JSON_HEX_* writes & < > ' " as \u00XX. esc_attr keeps existing
            // character references such as &quot;, and the browser would decode
            // them into JSON quotes, letting post authors add their own keys.
            $json = wp_json_encode($config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
            $attributes[] = "data-config='" . esc_attr($json) . "'";
        }

        return sprintf(
            '<div class="playerstack-wrap" style="background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;"><player-stack %s></player-stack></div>',
            implode(' ', $attributes)
        );
    }

    /**
     * Post content stores characters such as & as HTML entities (&amp;).
     * Decode them here: the JSON below is written with JSON_HEX_*, so the
     * browser no longer decodes entities inside data-config.
     */
    private function decoded(string $value): string
    {
        return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private function enqueue_assets(): void
    {
        if ($this->assets_enqueued) {
            return;
        }
        $this->assets_enqueued = true;

        // Media Chrome ships its own UI as Web Components (shadow DOM); no external CSS needed.
        wp_enqueue_script(
            'playerstack',
            self::PLAYERSTACK_URL,
            [],
            null,
            ['strategy' => 'defer']
        );
    }
}

new PlayerstackShortcode();
