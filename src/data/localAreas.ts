import type { TodoValue, ValueOrTodo } from "../types/business.config";

export interface LocalAreaItem {
  id: TodoValue | string;
  name: string;
  description: string;
  postalCodes: readonly string[];
  latitude: ValueOrTodo<number>;
  longitude: ValueOrTodo<number>;
  href?: string;
}

export const localAreas = [
  {
    id: "TODO_LOCAL_AREA_ID",
    name: "TODO_LOCAL_AREA_NAME",
    description: "TODO_LOCAL_AREA_DESCRIPTION",
    postalCodes: ["TODO_LOCAL_AREA_POSTAL_CODE"],
    latitude: "TODO_LOCAL_AREA_LATITUDE",
    longitude: "TODO_LOCAL_AREA_LONGITUDE",
    href: "/TODO_LOCAL_AREA_PATH",
  },
] as const satisfies readonly LocalAreaItem[];
