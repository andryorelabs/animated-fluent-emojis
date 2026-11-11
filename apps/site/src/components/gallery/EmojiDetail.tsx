import { Emoji } from 'animated-fluent-emojis/react'
import { CopyIcon } from 'lucide-react'
import { useState, type CSSProperties } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utilities'

import { effectiveTone } from '../../gallery/filter'
import {
  fileUrl,
  type PublicEmoji,
  type SkinTone,
} from '../../gallery/public-index'
import { generateSnippet, type SnippetKind } from '../../gallery/snippets'
import type { EmojiPageTabs } from '../../home/content'
import type { UiStrings } from '../../i18n/ui'
import CodeBlock, { type CodeBlockTab } from '../CodeBlock'
import { FileActionButton } from './FileActionButton'
import {
  resolvePlaying,
  STAGE_BACKGROUND_CLASSES,
  StageToolbarControls,
  usePrefersReducedMotion,
  type StageBackground,
} from './StageToolbar'
import { StatusToast, useStatusAnnouncer } from './StatusToast'

export type GalleryStrings = UiStrings['gallery']

const TABS: readonly { kind: SnippetKind; label: keyof GalleryStrings }[] = [
  { kind: 'react', label: 'tabReact' },
  { kind: 'vue', label: 'tabVue' },
  { kind: 'svelte', label: 'tabSvelte' },
  { kind: 'astro', label: 'tabAstro' },
  { kind: 'element', label: 'tabHtml' },
  { kind: 'no-code', label: 'tabNoCode' },
]

const ZOOMS = [1, 2] as const

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/**
 * Wraps plain snippet text in the same line markup the build-time highlighter
 * emits, so the shared code block can show it unhighlighted.
 * @param code - The plain snippet.
 * @returns Escaped markup with one `ec-line` per line.
 */
function plainCodeHtml(code: string): string {
  const lines = code
    .split('\n')
    .map((line) => {
      const escaped = line.replaceAll(
        /[&<>"]/g,
        (character) => HTML_ESCAPES[character] ?? '',
      )
      return `<div class="ec-line"><span class="code">${escaped}</span></div>`
    })
    .join('')
  return `<pre><code>${lines}</code></pre>`
}

const HIGHLIGHTED_LABELS: Partial<Record<SnippetKind, keyof GalleryStrings>> =
  Object.fromEntries(TABS.map((tab) => [tab.kind, tab.label]))

/**
 * Picks the build-time highlighted tabs that match the current tone and gives
 * them the localized labels and the plain code that copy writes.
 * @param snippetTabs - The highlighted tabs without and with a tone attribute.
 * @param emoji - The shown emoji.
 * @param tone - The applied skin tone, if any.
 * @param size - The shown size.
 * @param strings - The gallery strings holding the tab labels.
 * @returns The tabs for the code block.
 */
function highlightedTabs(
  snippetTabs: EmojiPageTabs,
  emoji: PublicEmoji,
  tone: SkinTone | undefined,
  size: number,
  strings: GalleryStrings,
): CodeBlockTab[] {
  const source =
    tone && snippetTabs.toned.length > 0 ? snippetTabs.toned : snippetTabs.plain
  return source.map((tab) => {
    const labelKey = HIGHLIGHTED_LABELS[tab.id as SnippetKind]
    return {
      ...tab,
      label: labelKey ? strings[labelKey] : tab.label,
      code: generateSnippet(emoji, tab.id as SnippetKind, { size, tone }),
    }
  })
}

/**
 * Properties of {@link EmojiIdRow}.
 */
export interface EmojiIdRowProps {
  id: string
  strings: GalleryStrings
  onCopy: (text: string) => Promise<void>
}

/**
 * The emoji id in mono type with its copy button.
 * @param props - The emoji id, the strings and the copy handler.
 * @returns The mono id text beside a button that copies it.
 */
export function EmojiIdRow(props: EmojiIdRowProps) {
  const { id, strings, onCopy } = props
  return (
    <div className="flex items-center gap-1">
      <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
        <span className="sr-only">{strings.idLabel}: </span>
        {id}
      </p>
      <Button
        variant="quiet"
        size="icon-sm"
        className="size-6 shrink-0 pointer-coarse:size-9"
        aria-label={strings.copyId}
        onClick={() => void onCopy(id)}
      >
        <CopyIcon />
      </Button>
    </div>
  )
}

/**
 * Properties of {@link EmojiDetail}.
 */
export interface EmojiDetailProps {
  emoji: PublicEmoji
  name: string
  tone: SkinTone | undefined
  size: number
  strings: GalleryStrings
  headingId?: string
  page?: boolean
  snippetTabs?: EmojiPageTabs
}

/**
 * Self-contained detail view of one emoji: live preview, snippet tabs, copy
 * and download actions, and the "Copied" live region. With `page`, the stage
 * is square and the name heading is left to the emoji page.
 * @param props - The emoji, its localized name and the global tone and size.
 * @returns The detail view.
 */
export function EmojiDetail(props: EmojiDetailProps) {
  const {
    emoji,
    name,
    tone,
    size,
    strings,
    headingId,
    page = false,
    snippetTabs,
  } = props
  const [kind, setKind] = useState<SnippetKind>('react')
  const { message, visible, copy, handleNotice } = useStatusAnnouncer(strings)
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1)
  const [loadedKey, setLoadedKey] = useState<string>()
  const [background, setBackground] = useState<StageBackground>('dots')
  const [playback, setPlayback] = useState<{
    key: string
    playing: boolean
  }>()
  const reducedMotion = usePrefersReducedMotion()

  const appliedTone = effectiveTone(emoji, tone)
  const files =
    emoji.tones.find((variant) => variant.tone === appliedTone) ?? emoji
  const previewKey = `${emoji.id}-${appliedTone ?? 'default'}`
  const playing = playback?.key === previewKey ? playback.playing : undefined
  const running = resolvePlaying(playing, reducedMotion)
  const animated = loadedKey === previewKey
  const tabs = snippetTabs
    ? highlightedTabs(snippetTabs, emoji, appliedTone, size, strings)
    : TABS.map((tab) => {
        const code = generateSnippet(emoji, tab.kind, {
          size,
          tone: appliedTone,
        })
        return {
          id: tab.kind,
          label: strings[tab.label],
          code,
          html: plainCodeHtml(code),
        }
      })
  const slotValues = snippetTabs
    ? {
        id: emoji.id,
        size: String(size),
        unicode: emoji.unicode,
        ...(appliedTone && { tone: appliedTone }),
      }
    : undefined

  const transitionName = page ? `emoji-${emoji.slug}` : undefined

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-xl',
          STAGE_BACKGROUND_CLASSES[background],
          page
            ? 'aspect-square split:aspect-auto split:h-110'
            : 'aspect-square max-h-72 w-full',
        )}
      >
        <div className="absolute top-2 right-2 left-2 z-10 flex flex-wrap items-center justify-end gap-1.5">
          <StageToolbarControls
            strings={strings}
            background={background}
            onBackgroundChange={setBackground}
            running={running}
            onToggleRunning={() => {
              setPlayback({ key: previewKey, playing: !running })
            }}
          />
          <div
            role="group"
            aria-label={strings.zoomLabel}
            className="flex h-8 items-center rounded-lg border border-border bg-card p-0.5"
          >
            {ZOOMS.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={zoom === level}
                onClick={() => {
                  setZoom(level)
                }}
                className="h-6 min-w-8 cursor-pointer rounded-md px-1.5 font-mono text-xs text-muted-foreground transition-transform-color-bg duration-150 ease-(--ease-out-strong) outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-97 aria-pressed:bg-muted aria-pressed:text-foreground pointer-coarse:size-9"
              >
                {level}×
              </button>
            ))}
          </div>
        </div>
        <div
          className="relative size-(--stage-size) transform-(--stage-transform) transition-transform duration-200 ease-(--ease-out-strong) view-transition-class-current view-transition-name-current"
          style={
            {
              '--stage-size': `${String(size)}px`,
              '--stage-transform': `scale(${String(zoom)})`,
              '--view-transition-name': transitionName,
              '--view-transition-class': transitionName ? 'emoji' : undefined,
            } as CSSProperties
          }
        >
          {page && !animated && (
            <img
              src={fileUrl(files.urls.png)}
              alt=""
              width={size}
              height={size}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0"
            />
          )}
          <Emoji
            key={previewKey}
            id={emoji.id}
            size={size}
            {...(appliedTone && { skinTone: appliedTone })}
            animationIterations="infinite"
            {...(playing !== undefined && { playing })}
            alt={name}
            onLoad={() => {
              setLoadedKey(previewKey)
            }}
          />
        </div>
      </div>
      {!page && (
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2
              id={headingId}
              className="min-w-0 truncate text-xl font-extrabold"
            >
              {name}
            </h2>
            <Button
              variant="quiet"
              size="icon-sm"
              className="size-6 shrink-0 pointer-coarse:size-9"
              aria-label={strings.copyName}
              onClick={() => void copy(name)}
            >
              <CopyIcon />
            </Button>
          </div>
          <EmojiIdRow id={emoji.id} strings={strings} onCopy={copy} />
        </div>
      )}
      <CodeBlock
        tabs={tabs}
        labels={{
          tabsLabel: strings.snippetLabel,
          copy: strings.copySnippet,
          copied: strings.copied,
        }}
        lineNumbers={snippetTabs !== undefined}
        slotValues={slotValues}
        activeId={kind}
        onActiveChange={(id) => {
          setKind(id as SnippetKind)
        }}
      />
      {!page && (
        <FileActionButton
          target={{
            filenameBase: files.slug,
            urlFor: (format) => fileUrl(files.urls[format]),
          }}
          strings={strings}
          onNotice={handleNotice}
        />
      )}
      <StatusToast message={message} visible={visible} />
    </div>
  )
}
