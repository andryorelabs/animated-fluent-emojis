import { Emoji } from 'animated-fluent-emojis/react'
import { CopyIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'

import { effectiveTone } from '../../gallery/filter'
import {
  fileUrl,
  type PublicEmoji,
  type SkinTone,
} from '../../gallery/public-index'
import { localePath, type Locale } from '../../i18n/locales'
import { CopySnippetButton } from './CopySnippetButton'
import type { GalleryStrings } from './EmojiDetail'
import { FileActionButton } from './FileActionButton'
import { StatusToast, useStatusAnnouncer } from './StatusToast'

const ZOOMS = [1, 2] as const
const PREVIEW_SIZE = 64
const KEYWORD_LIMIT = 8

const STAGE_DOTS = 'bg-dots-border bg-grid-16'

export const EMOJI_SHEET_HEADING_ID = 'emoji-sheet-heading'

/**
 * Properties of {@link EmojiSheetBody}.
 */
export interface EmojiSheetBodyProps {
  emoji: PublicEmoji
  name: string
  tone: SkinTone | undefined
  size: number
  locale: Locale
  strings: GalleryStrings
  closeControl?: ReactNode
}

/**
 * The three columns of the emoji sheet: the previewed emoji with a 1×/2× zoom,
 * its name, id, category and keywords, and the file, snippet and page actions.
 * While the files load the preview shimmers; if they fail, a red line with a
 * retry replaces them and the file actions are disabled.
 * @param props - The emoji, its localized name, the global tone and size, the
 * locale and the UI strings.
 * @returns The sheet content.
 */
export function EmojiSheetBody(props: EmojiSheetBodyProps) {
  type PreviewStatus = 'loading' | 'ready' | 'error'

  const { emoji, name, tone, size, locale, strings, closeControl } = props
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1)
  const [preview, setPreview] = useState<{ key: string; state: PreviewStatus }>(
    { key: '', state: 'loading' },
  )
  const [attempt, setAttempt] = useState(0)
  const { message, visible, announce, copy, handleNotice } =
    useStatusAnnouncer(strings)

  const appliedTone = effectiveTone(emoji, tone)
  const files =
    emoji.tones.find((variant) => variant.tone === appliedTone) ?? emoji
  const previewKey = `${emoji.id}-${appliedTone ?? 'default'}-${String(attempt)}`
  const previewState = preview.key === previewKey ? preview.state : 'loading'
  const hasError = previewState === 'error'

  return (
    <div className="grid gap-4 split:grid-cols-sheet split:gap-8">
      <div
        className={`relative flex h-38 items-center justify-center overflow-hidden rounded-xl bg-muted/40 ${STAGE_DOTS}`}
      >
        <div
          role="group"
          aria-label={strings.zoomLabel}
          className="absolute top-2 right-2 z-10 flex rounded-lg border border-border bg-card p-0.5"
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
        {previewState === 'loading' && (
          <div
            data-testid="sheet-preview-skeleton"
            className="shimmer absolute inset-0 rounded-xl bg-secondary"
          />
        )}
        {!hasError && (
          <div
            data-testid="sheet-preview"
            data-ready={previewState === 'ready'}
            className="relative size-(--preview-size) transform-(--preview-transform) transition-transform-opacity durations-200-150 ease-(--ease-out-strong) data-[ready=false]:opacity-0"
            style={
              {
                '--preview-size': `${String(PREVIEW_SIZE)}px`,
                '--preview-transform': `scale(${String(zoom)})`,
              } as CSSProperties
            }
          >
            <Emoji
              key={previewKey}
              id={emoji.id}
              size={PREVIEW_SIZE}
              {...(appliedTone && { skinTone: appliedTone })}
              animationIterations="infinite"
              alt={name}
              onLoad={() => {
                setPreview({ key: previewKey, state: 'ready' })
              }}
              onError={() => {
                setPreview({ key: previewKey, state: 'error' })
              }}
            />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <div className="flex items-center gap-1">
            <h2
              id={EMOJI_SHEET_HEADING_ID}
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
            <span className="ml-auto">{closeControl}</span>
          </div>
          <div className="flex items-center gap-1">
            <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
              <span className="sr-only">{strings.idLabel}: </span>
              {emoji.id}
            </p>
            <Button
              variant="quiet"
              size="icon-sm"
              className="size-6 shrink-0 pointer-coarse:size-9"
              aria-label={strings.copyId}
              onClick={() => void copy(emoji.id)}
            >
              <CopyIcon />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {strings.categoryLabel}:
          </span>{' '}
          {emoji.category}
        </p>
        {emoji.keywords.length > 0 && (
          <ul
            aria-label={strings.keywordsLabel}
            className="flex flex-wrap gap-1.5"
          >
            {emoji.keywords.slice(0, KEYWORD_LIMIT).map((keyword) => (
              <li
                key={keyword}
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {keyword}
              </li>
            ))}
          </ul>
        )}
        {hasError && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            <span>{strings.filesError}</span>
            <button
              type="button"
              className="cursor-pointer font-semibold underline underline-offset-2"
              onClick={() => {
                setAttempt((count) => count + 1)
              }}
            >
              {strings.retry}
            </button>
          </p>
        )}
      </div>
      <fieldset
        disabled={hasError}
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0 split:w-55"
      >
        <FileActionButton
          target={{
            filenameBase: files.slug,
            urlFor: (format) => fileUrl(files.urls[format]),
          }}
          strings={strings}
          onNotice={handleNotice}
        />
        <CopySnippetButton
          emoji={emoji}
          size={size}
          tone={appliedTone}
          strings={strings}
          onNotice={announce}
        />
        <a
          href={localePath(locale, `/emojis/${emoji.slug}/`)}
          className={buttonVariants({ variant: 'outline' })}
        >
          <ExternalLinkIcon />
          {strings.openPage}
        </a>
      </fieldset>
      <StatusToast message={message} visible={visible} />
    </div>
  )
}

/**
 * Properties of {@link EmojiSheet}.
 */
export interface EmojiSheetProps extends EmojiSheetBodyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  finalFocus: RefObject<HTMLElement | null>
  onHeightChange: (height: number) => void
}

/**
 * The emoji sheet: a non-modal panel docked to the bottom of the gallery with
 * no overlay, so the grid stays clickable. Choosing another tile updates it in
 * place; the close button and Escape close it and return focus to the tile.
 * It reports its height so the grid can reserve the same space.
 * @param props - The emoji content, the open state and its change handler, the
 * element to refocus on close and a height callback.
 * @returns The portaled sheet.
 */
export function EmojiSheet(props: EmojiSheetProps) {
  const { open, onOpenChange, finalFocus, onHeightChange, ...body } = props
  const observerRef = useRef<ResizeObserver | undefined>(undefined)

  const measure = useCallback(
    (element: HTMLElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = undefined
      if (!element) {
        onHeightChange(0)
        return
      }
      const observer = new ResizeObserver(() => {
        onHeightChange(element.offsetHeight)
      })
      observer.observe(element)
      observerRef.current = observer
      onHeightChange(element.offsetHeight)
    },
    [onHeightChange],
  )

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
      disablePointerDismissal
    >
      <SheetContent
        ref={measure}
        side="bottom"
        role="region"
        showOverlay={false}
        aria-labelledby={EMOJI_SHEET_HEADING_ID}
        initialFocus={false}
        finalFocus={finalFocus}
        flush
      >
        <div className="site-container pt-4 pb-safe-4">
          <EmojiSheetBody
            {...body}
            closeControl={
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={body.strings.closeDetail}
                  />
                }
              >
                <XIcon />
              </SheetClose>
            }
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
