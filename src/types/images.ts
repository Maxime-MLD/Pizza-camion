import type { ImageMetadata } from "astro";

import type { TodoValue } from "./business.config";

export type ContentImageSource = ImageMetadata | TodoValue;

export type ContentImage =
  | {
      src: ContentImageSource;
      alt: "";
      decorative: true;
    }
  | {
      src: ContentImageSource;
      alt: string;
      decorative?: false;
    };
