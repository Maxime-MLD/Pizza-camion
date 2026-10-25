export function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

export function isNavigationItemActive(
  currentPathname: string,
  href: string,
  external = false,
): boolean {
  if (external || href.startsWith("#")) {
    return false;
  }

  const targetPathname = new URL(href, "https://starter.invalid").pathname;

  return normalizePathname(currentPathname) === normalizePathname(targetPathname);
}
