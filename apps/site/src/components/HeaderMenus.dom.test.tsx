import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

import HeaderMenus from "./HeaderMenus";

const props = {
  menuLabel: "Open menu",
  navLabel: "Main navigation",
  links: [
    { href: "/docs/", label: "Docs" },
    { href: "https://example.com/changelog", label: "Changelog" },
  ],
  languageLabel: "Language",
  themeLabel: "Theme",
  themeNames: { system: "System", light: "Light", dark: "Dark" },
  repositoryLabel: "Repository",
  repositoryHref: "https://github.com/example/repo",
  opensInNewTabLabel: "opens in a new tab",
  currentLocale: "en",
  locales: [
    { code: "en", name: "English", href: "/" },
    { code: "es", name: "Español", href: "/es/" },
  ],
};

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

test("the navigation menu lists internal links plainly and marks external ones", async () => {
  const user = userEvent.setup();
  render(<HeaderMenus {...props} />);

  await user.click(screen.getByRole("button", { name: "Open menu" }));

  const docs = await screen.findByRole("menuitem", { name: "Docs" });
  expect(docs.getAttribute("href")).toBe("/docs/");
  expect(docs.hasAttribute("target")).toBe(false);
  const external = screen.getByRole("menuitem", { name: /Changelog/ });
  expect(external.getAttribute("target")).toBe("_blank");
  expect(external.getAttribute("rel")).toBe("noopener noreferrer");
  expect(external.textContent).toContain("(opens in a new tab)");
});

test("the language menu links every locale and flags the current one", async () => {
  const user = userEvent.setup();
  render(<HeaderMenus {...props} />);

  await user.click(screen.getByRole("button", { name: "Language" }));

  const english = await screen.findByRole("menuitem", { name: /English/ });
  const spanish = screen.getByRole("menuitem", { name: /Español/ });
  expect(english.getAttribute("aria-current")).toBe("true");
  expect(spanish.hasAttribute("aria-current")).toBe(false);
  expect(spanish.getAttribute("href")).toBe("/es/");
  expect(spanish.getAttribute("hreflang")).toBe("es");
  expect(spanish.getAttribute("lang")).toBe("es");
});

test("choosing a theme stores it and applies it to the document", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(<HeaderMenus {...props} />);

  await user.click(screen.getByRole("button", { name: "Theme" }));
  expect(await screen.findByRole("menuitemradio", { name: "System" })).toBeTruthy();
  await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

  expect(localStorage.getItem("afe:theme")).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("the server render shows the system theme icon before hydration", () => {
  const html = renderToString(<HeaderMenus {...props} />);

  expect(html).toContain('aria-label="Theme"');
  expect(html).toContain("lucide-monitor");
});

test("the repository link opens in a new tab with a descriptive label", () => {
  render(<HeaderMenus {...props} />);

  const link = screen.getByRole("link", {
    name: "Repository (opens in a new tab)",
  });
  expect(link.getAttribute("href")).toBe("https://github.com/example/repo");
  expect(link.getAttribute("target")).toBe("_blank");
});
