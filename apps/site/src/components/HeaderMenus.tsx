import {
  CheckIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useSyncExternalStore } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utilities";

import {
  applyThemeAnimated,
  isTheme,
  readStoredTheme,
  storeTheme,
  subscribeTheme,
  type Theme,
} from "../scripts/theme";
import { externalLinkAttributes, isExternalHref } from "../site-links";

interface MenuLink {
  href: string;
  label: string;
}

interface LocaleOption {
  code: string;
  name: string;
  href: string;
}

interface HeaderMenusProps {
  menuLabel: string;
  navLabel: string;
  links: MenuLink[];
  languageLabel: string;
  themeLabel: string;
  themeNames: Record<Theme, string>;
  repositoryLabel: string;
  repositoryHref: string;
  opensInNewTabLabel: string;
  currentLocale: string;
  locales: LocaleOption[];
}

const THEME_ICONS = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
} as const;

const THEME_ORDER: readonly Theme[] = ["system", "light", "dark"];

function IconLink(props: React.ComponentProps<"a">) {
  const { children, ...rest } = props;
  return (
    <a className={buttonVariants({ variant: "ghost", size: "icon" })} {...rest}>
      {children}
    </a>
  );
}

function GroupDivider() {
  return <span aria-hidden="true" className="h-4 w-px bg-border" />;
}

function RepositoryMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="size-4">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function ThemeMenu(props: { label: string; names: Record<Theme, string> }) {
  const { label, names } = props;
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readStoredTheme, () => "system");

  const ActiveIcon = THEME_ICONS[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={label} render={<Button variant="ghost" size="icon" />}>
        <ActiveIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent variant="nova" className="w-36" aria-label={label}>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (!isTheme(value)) return;
            storeTheme(value);
            applyThemeAnimated(value);
          }}
        >
          {THEME_ORDER.map((name) => {
            const Icon = THEME_ICONS[name];
            return (
              <DropdownMenuRadioItem key={name} value={name} closeOnClick>
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{names[name]}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The header's right-hand control group: the mobile navigation menu, the
 * language picker, the theme picker and the repository link, as ghost icon
 * buttons separated by hairlines. Language entries are real links, so
 * navigation survives a failed hydration.
 * @param props - Translated labels, the nav links, and the locale options.
 * @returns The icon buttons with their popups.
 */
export default function HeaderMenus(props: HeaderMenusProps) {
  const {
    menuLabel,
    navLabel,
    links,
    languageLabel,
    themeLabel,
    themeNames,
    repositoryLabel,
    repositoryHref,
    opensInNewTabLabel,
    currentLocale,
    locales,
  } = props;
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={menuLabel}
            render={<Button variant="ghost" size="icon" className="min-[860px]:hidden" />}
          >
            <MenuIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent variant="nova" className="w-48" aria-label={navLabel}>
            {links.map((link) => {
              const external = isExternalHref(link.href);
              return (
                <DropdownMenuLinkItem
                  key={link.href}
                  href={link.href}
                  variant="compact"
                  {...(external ? externalLinkAttributes() : {})}
                >
                  {link.label}
                  {external && (
                    <>
                      <ExternalLinkIcon aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="sr-only"> ({opensInNewTabLabel})</span>
                    </>
                  )}
                </DropdownMenuLinkItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={languageLabel}
            render={<Button variant="ghost" size="icon" />}
          >
            <GlobeIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent variant="nova" className="max-h-80 w-56" aria-label={languageLabel}>
            {locales.map((option) => (
              <DropdownMenuLinkItem
                key={option.code}
                href={option.href}
                lang={option.code}
                hrefLang={option.code}
                aria-current={option.code === currentLocale ? "true" : undefined}
                variant="compact"
              >
                <span className="flex-1 truncate">{option.name}</span>
                <span className="text-xs text-muted-foreground uppercase">{option.code}</span>
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    option.code === currentLocale ? "" : "invisible",
                  )}
                />
              </DropdownMenuLinkItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <GroupDivider />
        <ThemeMenu label={themeLabel} names={themeNames} />
        <GroupDivider />

        <Tooltip>
          <TooltipTrigger
            render={
              <IconLink
                href={repositoryHref}
                aria-label={`${repositoryLabel} (${opensInNewTabLabel})`}
                {...externalLinkAttributes()}
              />
            }
          >
            <RepositoryMark />
          </TooltipTrigger>
          <TooltipContent>{repositoryLabel}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
