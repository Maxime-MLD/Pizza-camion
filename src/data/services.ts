import type { TodoValue } from "../types/business.config";

export interface ServiceItem {
  id: TodoValue | string;
  title: string;
  shortDescription: string;
  description: string;
  icon: string;
  href: string;
  featured: boolean;
}

export const services = [
  {
    id: "TODO_SERVICE_ID",
    title: "TODO_SERVICE_TITLE",
    shortDescription: "TODO_SERVICE_SHORT_DESCRIPTION",
    description: "TODO_SERVICE_DESCRIPTION",
    icon: "TODO_SERVICE_ICON",
    href: "/TODO_SERVICE_PATH",
    featured: false,
  },
] as const satisfies readonly ServiceItem[];
