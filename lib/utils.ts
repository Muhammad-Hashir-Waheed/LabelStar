import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines clsx for conditional classes and twMerge for Tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
