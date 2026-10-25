import type { TodoValue } from "../types/business.config";

export type PracticalInfoKind =
  | "access"
  | "appointment"
  | "parking"
  | "payment"
  | "other";

export interface PracticalInfoItem {
  id: TodoValue | string;
  kind: PracticalInfoKind;
  title: string;
  value: string;
  description?: string;
  icon?: string;
}

export const practicalInfo = [
  {
    id: "TODO_PRACTICAL_INFO_ID",
    kind: "other",
    title: "TODO_PRACTICAL_INFO_TITLE",
    value: "TODO_PRACTICAL_INFO_VALUE",
    description: "TODO_PRACTICAL_INFO_DESCRIPTION",
    icon: "TODO_PRACTICAL_INFO_ICON",
  },
] as const satisfies readonly PracticalInfoItem[];
