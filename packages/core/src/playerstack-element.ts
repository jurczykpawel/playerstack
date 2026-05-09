import "vidstack/player";
import "vidstack/player/layouts/default";
import "vidstack/player/ui";

const OBSERVED_ATTRS = ["src", "poster", "title"] as const;

export class PlayerstackElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  private mediaPlayer: HTMLElement | null = null;

  connectedCallback(): void {
    if (this.mediaPlayer) return;
    this.render();
  }

  disconnectedCallback(): void {
    this.mediaPlayer = null;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.mediaPlayer) return;
    if (value === null) {
      this.mediaPlayer.removeAttribute(name);
    } else {
      this.mediaPlayer.setAttribute(name, value);
    }
  }

  private render(): void {
    const src = this.getAttribute("src") ?? "";
    const poster = this.getAttribute("poster") ?? "";
    const title = this.getAttribute("title") ?? "";

    const player = document.createElement("media-player");
    player.setAttribute("src", src);
    if (poster) player.setAttribute("poster", poster);
    if (title) player.setAttribute("title", title);
    player.setAttribute("crossorigin", "");
    player.setAttribute("playsinline", "");
    player.style.width = "100%";
    player.style.aspectRatio = "16 / 9";

    const provider = document.createElement("media-provider");
    const layout = document.createElement("media-video-layout");

    player.appendChild(provider);
    player.appendChild(layout);

    this.appendChild(player);
    this.mediaPlayer = player;
  }
}

export function definePlayerstackElement(): void {
  if (customElements.get("player-stack")) return;
  customElements.define("player-stack", PlayerstackElement);
}
