import type { TodoValue } from "../types/business.config";

export interface FaqItem {
  id: TodoValue | string;
  question: string;
  answer: string;
}

export const faqItems = [
  {
    id: "TODO_FAQ_ID",
    question: "TODO_FAQ_QUESTION",
    answer: "TODO_FAQ_ANSWER",
  },
] as const satisfies readonly FaqItem[];
