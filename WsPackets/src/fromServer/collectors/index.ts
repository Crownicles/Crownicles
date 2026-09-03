/**
 * Entry point of the reaction collector contract: import from here, never from `ReactionCollectorProtocol`
 * directly. Re-exporting every family from a single module guarantees each augmentation belongs to
 * the consumer's compilation unit, so the unions are never silently truncated.
 *
 * Adding a family: create `families/<Name>.ts` with its augmentation, then add one line below.
 */

export * from "./ReactionCollectorProtocol";
export * from "./families/GenericReactions";
export * from "./families/DrinkCollector";
export * from "./families/BigEventCollector";
export * from "./families/SmallEventCollectors";
export * from "./families/ItemCollectors";
export * from "./families/ReportCollectors";
export * from "./families/CityCollectors";
export * from "./families/ShopCollector";
