export interface NavigationItem {
  label: string;
  href: string;
  ariaLabel?: string;
  external?: boolean;
  children?: readonly NavigationItem[];
}

export interface NavigationConfig {
  items: readonly NavigationItem[];
  legalItems: readonly NavigationItem[];
  labels: {
    primaryNavigation: string;
    mobileNavigation: string;
    footerNavigation: string;
    legalNavigation: string;
    openMenu: string;
    closeMenu: string;
  };
}

export const navigationConfig = {
  items: [
    {
      label: "TODO_NAV_HOME_LABEL",
      href: "/",
      ariaLabel: "TODO_NAV_HOME_ARIA_LABEL",
      external: false,
    },
    {
      label: "TODO_NAV_SERVICES_LABEL",
      href: "/services",
      ariaLabel: "TODO_NAV_SERVICES_ARIA_LABEL",
      external: false,
      children: [
        {
          label: "TODO_NAV_SERVICE_CHILD_LABEL",
          href: "/services#TODO_SERVICE_SECTION_ID",
          ariaLabel: "TODO_NAV_SERVICE_CHILD_ARIA_LABEL",
          external: false,
        },
      ],
    },
    {
      label: "TODO_NAV_ABOUT_LABEL",
      href: "/a-propos",
      ariaLabel: "TODO_NAV_ABOUT_ARIA_LABEL",
      external: false,
    },
    {
      label: "TODO_NAV_CONTACT_LABEL",
      href: "/contact",
      ariaLabel: "TODO_NAV_CONTACT_ARIA_LABEL",
      external: false,
    },
  ],
  legalItems: [
    {
      label: "Mentions légales",
      href: "/mentions-legales",
      ariaLabel: "Consulter les mentions légales",
      external: false,
    },
    {
      label: "Politique de confidentialité",
      href: "/politique-confidentialite",
      ariaLabel: "Consulter la politique de confidentialité",
      external: false,
    },
  ],
  labels: {
    primaryNavigation: "TODO_PRIMARY_NAVIGATION_ARIA_LABEL",
    mobileNavigation: "TODO_MOBILE_NAVIGATION_ARIA_LABEL",
    footerNavigation: "TODO_FOOTER_NAVIGATION_ARIA_LABEL",
    legalNavigation: "TODO_LEGAL_NAVIGATION_ARIA_LABEL",
    openMenu: "TODO_OPEN_MENU_ARIA_LABEL",
    closeMenu: "TODO_CLOSE_MENU_ARIA_LABEL",
  },
} as const satisfies NavigationConfig;
