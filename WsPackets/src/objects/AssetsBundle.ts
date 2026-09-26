export type AssetsBundleLanguage = "fr" | "en" | "it" | "es" | "de" | "pt";

export interface AssetsBundle {
	language: AssetsBundleLanguage;
	namespaces: Record<string, object>;
	icons: Record<string, unknown>;
}
