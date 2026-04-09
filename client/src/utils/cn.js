import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A professional utility for merging Tailwind CSS classes efficiently.
 * It combines arrays, objects, and strings dynamically while removing Tailwind conflicts.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

