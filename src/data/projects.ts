import type { TodoValue, ValueOrTodo } from "../types/business.config";
import type { ContentImage } from "../types/images";

export interface ProjectItem {
  id: TodoValue | string;
  title: string;
  category: string;
  summary: string;
  location: string;
  year: ValueOrTodo<number>;
  image: ContentImage;
  href: string;
  featured: boolean;
}

export const projects = [
  {
    id: "TODO_PROJECT_ID",
    title: "TODO_PROJECT_TITLE",
    category: "TODO_PROJECT_CATEGORY",
    summary: "TODO_PROJECT_SUMMARY",
    location: "TODO_PROJECT_LOCATION",
    year: "TODO_PROJECT_YEAR",
    image: {
      src: "TODO_PROJECT_IMAGE_IMPORT",
      alt: "TODO_PROJECT_IMAGE_ALT",
      decorative: false,
    },
    href: "/TODO_PROJECT_PATH",
    featured: false,
  },
] as const satisfies readonly ProjectItem[];
