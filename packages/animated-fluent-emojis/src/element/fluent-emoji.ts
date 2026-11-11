import styles from '../components/Emoji.module.css'
import {
  createEmoji,
  type EmojiController,
  type EmojiOptions,
} from '../vanilla/create-emoji.js'
import type { FluentEmojiProperties } from './types.js'

type PropertyName = keyof FluentEmojiProperties

interface PropertySpec {
  property: PropertyName
  attribute: string
  parse: (value: string) => unknown
}

const parseBoolean = (value: string): boolean => value !== 'false'

const parseSize = (value: string): number | string =>
  /^\d+(\.\d+)?$/.test(value) ? Number(value) : value

const parseIterations = (value: string): number | 'infinite' => {
  if (value === 'infinite') return value
  const count = Number(value)
  return Number.isFinite(count) ? count : 2
}

const PROPERTY_SPECS: readonly PropertySpec[] = [
  { property: 'id', attribute: 'id', parse: String },
  { property: 'size', attribute: 'size', parse: parseSize },
  { property: 'playOnHover', attribute: 'play-on-hover', parse: parseBoolean },
  {
    property: 'animationIterations',
    attribute: 'animation-iterations',
    parse: parseIterations,
  },
  { property: 'autoPlay', attribute: 'auto-play', parse: parseBoolean },
  { property: 'playing', attribute: 'playing', parse: parseBoolean },
  { property: 'skinTone', attribute: 'skin-tone', parse: String },
  { property: 'alt', attribute: 'alt', parse: String },
]

const OBSERVED_ATTRIBUTES = PROPERTY_SPECS.map((spec) => spec.attribute)

const imageClass = styles.emojiImage ?? ''
const hoverClass = styles.animateOnHover ?? ''

const SHADOW_STYLES = `
:host{display:inline-block;line-height:0}
:host([hidden]){display:none}
@keyframes emoji-play{from{transform:translateY(0)}to{transform:translateY(-100%)}}
.${imageClass}{animation-name:emoji-play}
.${hoverClass} .${imageClass}{animation-name:none}
@media (hover:hover) and (pointer:fine){.${hoverClass}:hover .${imageClass}{animation-name:emoji-play}}
`

/**
 * A stylesheet that reserves the emoji's footprint while `<fluent-emoji>` is
 * still undefined, so the page does not shift when the element upgrades. It
 * reads the `size` attribute in pixels and falls back to 100px.
 */
export const FLUENT_EMOJI_PRE_UPGRADE_CSS =
  'fluent-emoji:not(:defined){display:inline-block;width:attr(size px,100px);height:attr(size px,100px)}'

const FALLBACK_SLOT_SELECTOR = ':scope > [slot="fallback"]'

const createSlotFallback = (): Node => {
  const slot = document.createElement('slot')
  slot.name = 'fallback'
  return slot
}

const createElementClass = (): CustomElementConstructor => {
  class FluentEmoji extends HTMLElement {
    static observedAttributes: string[] = OBSERVED_ATTRIBUTES

    private controller: EmojiController | undefined
    private readonly shadow: ShadowRoot
    private readonly slotObserver: MutationObserver
    readonly state: Partial<Record<PropertyName, unknown>> = {}

    constructor() {
      super()
      this.shadow = this.attachShadow({ mode: 'open' })
      const stylesheet = document.createElement('style')
      stylesheet.textContent = SHADOW_STYLES
      this.shadow.append(stylesheet)
      this.slotObserver = new MutationObserver(() => {
        this.controller?.update({ fallback: this.resolveFallback() })
      })
    }

    private resolveFallback(): EmojiOptions['fallback'] {
      return this.querySelector(FALLBACK_SLOT_SELECTOR)
        ? createSlotFallback
        : undefined
    }

    private buildOptions(): EmojiOptions {
      const { state } = this
      return {
        id: typeof state.id === 'string' ? state.id : '',
        size: state.size as EmojiOptions['size'],
        playOnHover: state.playOnHover as EmojiOptions['playOnHover'],
        animationIterations:
          state.animationIterations as EmojiOptions['animationIterations'],
        autoPlay: state.autoPlay as EmojiOptions['autoPlay'],
        playing: state.playing as EmojiOptions['playing'],
        skinTone: state.skinTone as EmojiOptions['skinTone'],
        alt: state.alt as EmojiOptions['alt'],
        fallback: this.resolveFallback(),
        onLoad: () => {
          this.emit('emoji-load')
        },
        onError: () => {
          this.emit('emoji-error')
        },
        onPlaybackEnd: () => {
          this.emit('playback-end')
        },
      }
    }

    private emit(type: string): void {
      this.dispatchEvent(
        new CustomEvent(type, { bubbles: true, composed: true }),
      )
    }

    connectedCallback(): void {
      for (const { property } of PROPERTY_SPECS) {
        if (!Object.hasOwn(this, property)) continue
        const value: unknown = Reflect.get(this, property)
        Reflect.deleteProperty(this, property)
        Reflect.set(this, property, value)
      }
      this.slotObserver.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['slot'],
      })
      this.controller ??= createEmoji(this.shadow, this.buildOptions())
    }

    disconnectedCallback(): void {
      this.slotObserver.disconnect()
      this.controller?.destroy()
      this.controller = undefined
    }

    attributeChangedCallback(
      name: string,
      _previous: string | null,
      value: string | null,
    ): void {
      const spec = PROPERTY_SPECS.find((entry) => entry.attribute === name)
      if (!spec) return
      this.state[spec.property] = value === null ? undefined : spec.parse(value)
      this.refresh()
    }

    refresh(): void {
      this.controller?.update(this.buildOptions())
    }
  }

  for (const { property, parse } of PROPERTY_SPECS) {
    Object.defineProperty(FluentEmoji.prototype, property, {
      configurable: true,
      get(this: FluentEmoji): unknown {
        return this.state[property]
      },
      set(this: FluentEmoji, value: unknown) {
        this.state[property] = typeof value === 'string' ? parse(value) : value
        this.refresh()
      },
    })
  }

  return FluentEmoji
}

/**
 * Registers the `<fluent-emoji>` custom element, once, and only where custom
 * elements exist, so importing this module on the server is safe.
 * @param tagName - The element name to register; defaults to `fluent-emoji`.
 */
export const defineFluentEmoji = (tagName = 'fluent-emoji'): void => {
  if (
    typeof customElements === 'undefined' ||
    customElements.get(tagName) !== undefined
  ) {
    return
  }
  customElements.define(tagName, createElementClass())
}
