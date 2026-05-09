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
 * Loads the Playerstack bundle from jsDelivr CDN once per page (regardless of
 * how many shortcodes are on the page).
 */

if (!defined('ABSPATH')) {
    exit;
}

class PlayerstackShortcode
{
    private const PLAYERSTACK_VERSION = '0.1.0';

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
        if (!empty($atts['accent'])) {
            $config['controls'] = ['accent' => $atts['accent']];
        }
        if ($atts['click_to_load'] === 'true' || $atts['click_to_load'] === '1') {
            $config['brandedThumb'] = ['enabled' => true, 'clickToLoad' => true];
        }
        if (!empty($atts['cta_label']) && !empty($atts['cta_url'])) {
            $config['ctaEnd'] = [
                'enabled' => true,
                'title' => $atts['cta_title'] ?: '',
                'button' => array_filter([
                    'label' => $atts['cta_label'],
                    'url' => $atts['cta_url'],
                    'utm' => $atts['cta_utm'],
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
            $attributes[] = "data-config='" . wp_json_encode($config) . "'";
        }

        return sprintf(
            '<div class="playerstack-wrap" style="background:#000;border-radius:12px;overflow:hidden;aspect-ratio:16/9;"><player-stack %s></player-stack></div>',
            implode(' ', $attributes)
        );
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
            'https://cdn.jsdelivr.net/npm/playerstack@' . self::PLAYERSTACK_VERSION . '/dist/playerstack.min.js',
            [],
            self::PLAYERSTACK_VERSION,
            ['strategy' => 'defer']
        );
    }
}

new PlayerstackShortcode();
