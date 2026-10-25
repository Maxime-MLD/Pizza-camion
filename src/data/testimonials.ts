import type { TodoValue, ValueOrTodo } from "../types/business.config";

export type TestimonialStatus = "placeholder" | "published";

export interface TestimonialItem {
  id: TodoValue | string;
  status: TestimonialStatus;
  quote: string;
  authorName: string;
  authorRole?: string;
  rating?: ValueOrTodo<number>;
  sourceUrl?: string;
}

export const testimonials = [
  {
    id: "TODO_TESTIMONIAL_ID",
    status: "placeholder",
    quote: "TODO_TESTIMONIAL_QUOTE_NOT_PUBLISHED",
    authorName: "TODO_TESTIMONIAL_AUTHOR",
    authorRole: "TODO_TESTIMONIAL_AUTHOR_ROLE",
    rating: "TODO_TESTIMONIAL_RATING",
    sourceUrl: "TODO_TESTIMONIAL_SOURCE_URL",
  },
] as const satisfies readonly TestimonialItem[];
