/**
 * Neutral OS and Module metadata contract.
 * Shared between Yansha Core and independent OSes.
 */
export type YanshaOSIdentifier = "workout" | "study" | "finance" | "sahwa" | "core";

export interface YanshaOSManifest {
  readonly id: YanshaOSIdentifier;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly defaultRoute: string;
  readonly accentHue?: "blue" | "purple" | "gold" | "red" | "green";
}
