import {ReactNode, useState} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS, CITY_REACTION_KINDS, GENERIC_REACTION_KINDS,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {AppIcons} from "@/src/AppIcons";
import {isChoosable, reactionLabel} from "@/src/collectors/CollectorLabels";
import {Hero, Note, Panel, Row, Screen, SectionHeader} from "@/src/design/Primitives";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {i18n} from "@/src/translations/i18n";

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type CityEntry = {reaction: ReactionCollectorReaction; index: number};

const CITY_ICON_PATHS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[GENERIC_REACTION_KINDS.REFUSE]: "city.stay",
	[CITY_REACTION_KINDS.EXIT]: "city.exit",
	[CITY_REACTION_KINDS.INN_MEAL]: "city.inn",
	[CITY_REACTION_KINDS.INN_ROOM]: "city.inn",
	[CITY_REACTION_KINDS.ENCHANT]: "city.services.enchanter",
	[CITY_REACTION_KINDS.BUY_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.MOVE_HOME]: "city.manageHome",
	[CITY_REACTION_KINDS.HOME_MENU]: "city.home.5",
	[CITY_REACTION_KINDS.HOME_BED]: "city.homeUpgrades.bed",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "city.homeUpgrades.upgradeEquipment",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "city.services.blacksmith",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "city.blacksmith.disenchant",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "city.services.scrapDealer",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "city.services.royalBlacksmith",
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_WATER]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: "city.homeUpgrades.garden",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "city.guildDomain.menu",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "city.guildDomainNotary",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "city.apartmentNotary.menu",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "city.apartmentNotary.menu"
};

function cityIconPath(reaction: ReactionCollectorReaction): string | undefined {
	if (reaction.type === CITY_REACTION_KINDS.SHOP) {
		return `city.shops.${reaction.data.shopId}`;
	}
	return CITY_ICON_PATHS[reaction.type];
}

function cityRowIcon(reaction: ReactionCollectorReaction): ReactNode | undefined {
	const emoji = cityIconPath(reaction);
	return emoji && AppIcons.getIconOrNull(emoji)
		? <TwemojiIcon emoji={AppIcons.getIcon(emoji)} size={Theme.fontSize.rowTitle} />
		: undefined;
}

function cityRowTitle(reaction: ReactionCollectorReaction, collectorData: ReactionCollectorCreation["data"]): string {
	if (collectorData.type !== CITY_DATA_KINDS.CITY) {
		return reactionLabel(reaction, collectorData);
	}

	switch (reaction.type) {
		case GENERIC_REACTION_KINDS.REFUSE:
			// In a city this is the Discord "Rester en ville" action, not a generic cancel.
			return i18n.t("commands:report.city.reactions.stay.label");
		case CITY_REACTION_KINDS.HOME_MENU:
			return i18n.t("app:city.actions.home");
		case CITY_REACTION_KINDS.INN_MEAL:
			return i18n.t(`commands:report.city.inns.meals.${reaction.data.mealId}`);
		case CITY_REACTION_KINDS.INN_ROOM:
			return i18n.t(`commands:report.city.inns.rooms.${reaction.data.roomId}`);
		default:
			return reactionLabel(reaction, collectorData);
	}
}

function compactCityDescription(description: string): string {
	const firstParagraph = description.split("\n\n")[0].trim();
	const firstSentence = firstParagraph.match(/^.*?[.!?](?:\s|$)/)?.[0];
	return (firstSentence ?? firstParagraph).trim();
}

const CITY_SUBTITLE_KEYS: Partial<Record<ReactionCollectorReaction["type"], string>> = {
	[GENERIC_REACTION_KINDS.REFUSE]: "commands:report.city.reactions.stay.description",
	[CITY_REACTION_KINDS.EXIT]: "commands:report.city.reactions.exit.description",
	[CITY_REACTION_KINDS.ENCHANT]: "commands:report.city.reactions.enchanter.description",
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: "commands:report.city.blacksmith.menuDescription",
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: "commands:report.city.blacksmith.upgradeDescription",
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: "commands:report.city.blacksmith.disenchantDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: "commands:report.city.scrapDealer.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: "commands:report.city.royalBlacksmith.menuDescription",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "commands:report.city.guildDomain.description",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "commands:report.city.guildDomain.notaryDescription",
	[CITY_REACTION_KINDS.BUY_HOME]: "commands:report.city.homes.manageHomeDescriptionNew",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "commands:report.city.homes.manageHomeDescriptionUpgrade",
	[CITY_REACTION_KINDS.MOVE_HOME]: "commands:report.city.homes.manageHomeDescriptionMove",
	[CITY_REACTION_KINDS.HOME_MENU]: "commands:report.city.homes.goToOwnedHomeDescription",
	[CITY_REACTION_KINDS.HOME_BED]: "commands:report.city.homes.bed.menuDescription"
};

function cityRowSubtitle(reaction: ReactionCollectorReaction): string | undefined {
	if (reaction.type === CITY_REACTION_KINDS.SHOP) {
		return compactCityDescription(i18n.t(`commands:report.city.shops.${reaction.data.shopId}.description`));
	}
	if (reaction.type === CITY_REACTION_KINDS.INN_MEAL || reaction.type === CITY_REACTION_KINDS.INN_ROOM) {
		const detailKey = reaction.type === CITY_REACTION_KINDS.INN_MEAL
			? "commands:report.city.inns.mealDescription"
			: "commands:report.city.inns.roomDescription";
		return `${i18n.t(`commands:report.city.inns.names.${reaction.data.innId}`)} · ${compactCityDescription(i18n.t(detailKey, reaction.data))}`;
	}
	const key = CITY_SUBTITLE_KEYS[reaction.type];
	return key ? compactCityDescription(i18n.t(key)) : undefined;
}

function cityRowEnd(reaction: ReactionCollectorReaction): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.INN_MEAL:
			return `+${reaction.data.energy} ${AppIcons.getIcon("unitValues.energy")}`;
		case CITY_REACTION_KINDS.INN_ROOM:
			return `+${reaction.data.health} ${AppIcons.getIcon("unitValues.health")}`;
		default:
			return undefined;
	}
}

function CityRows({entries, collector, onChoose, locked}: {
	entries: CityEntry[];
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	locked: boolean;
}): ReactNode {
	return entries.map(({reaction, index}) => {
		const choosable = isChoosable(reaction, collector.data);
		const disabled = locked || !choosable;
		return (
			<Row
				key={`${collector.id}-${index}`}
				disabled={disabled}
				onPress={disabled ? undefined : (): void => onChoose(index)}
				icon={cityRowIcon(reaction)}
				title={cityRowTitle(reaction, collector.data)}
				subtitle={cityRowSubtitle(reaction)}
				end={cityRowEnd(reaction)}
				tone={reaction.type === CITY_REACTION_KINDS.EXIT ? "danger" : undefined}
				chevron={choosable && !locked}
			/>
		);
	});
}

type CityGroup = "housing" | "services" | "shops" | "guild" | "elsewhere" | "quit";

const CITY_REACTION_GROUPS: Partial<Record<ReactionCollectorReaction["type"], CityGroup>> = {
	[CITY_REACTION_KINDS.EXIT]: "quit",
	[CITY_REACTION_KINDS.BUY_HOME]: "housing",
	[CITY_REACTION_KINDS.UPGRADE_HOME]: "housing",
	[CITY_REACTION_KINDS.MOVE_HOME]: "housing",
	[CITY_REACTION_KINDS.HOME_MENU]: "housing",
	[CITY_REACTION_KINDS.HOME_BED]: "housing",
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: "housing",
	[CITY_REACTION_KINDS.SHOP]: "shops",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: "guild",
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: "guild",
	[CITY_REACTION_KINDS.APARTMENT_BUY]: "housing",
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: "housing"
};

const CITY_REACTION_ORDER: Partial<Record<ReactionCollectorReaction["type"], number>> = {
	[CITY_REACTION_KINDS.HOME_MENU]: 0,
	[CITY_REACTION_KINDS.BUY_HOME]: 1,
	[CITY_REACTION_KINDS.UPGRADE_HOME]: 2,
	[CITY_REACTION_KINDS.MOVE_HOME]: 3,
	[CITY_REACTION_KINDS.APARTMENT_BUY]: 4,
	[CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT]: 5,
	[CITY_REACTION_KINDS.HOME_BED]: 6,
	[CITY_REACTION_KINDS.UPGRADE_ITEM]: 7,
	[CITY_REACTION_KINDS.INN_MEAL]: 0,
	[CITY_REACTION_KINDS.INN_ROOM]: 1,
	[CITY_REACTION_KINDS.BLACKSMITH_MENU]: 2,
	[CITY_REACTION_KINDS.BLACKSMITH_UPGRADE]: 3,
	[CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT]: 4,
	[CITY_REACTION_KINDS.SCRAP_DEALER_MENU]: 5,
	[CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE]: 6,
	[CITY_REACTION_KINDS.ENCHANT]: 7,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU]: 8,
	[CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE]: 9,
	[CITY_REACTION_KINDS.GARDEN_HARVEST]: 10,
	[CITY_REACTION_KINDS.GARDEN_WATER]: 11,
	[CITY_REACTION_KINDS.GARDEN_COMPOST]: 12,
	[CITY_REACTION_KINDS.SHOP]: 0,
	[CITY_REACTION_KINDS.GUILD_DOMAIN_MENU]: 0,
	[CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY]: 1,
	[CITY_REACTION_KINDS.EXIT]: 0,
	[GENERIC_REACTION_KINDS.REFUSE]: 1
};

function groupEntries(entries: CityEntry[]): Record<CityGroup, CityEntry[]> {
	const groups: Record<CityGroup, CityEntry[]> = {
		housing: [], services: [], shops: [], guild: [], elsewhere: [], quit: []
	};
	for (const entry of entries) {
		if (entry.reaction.type === GENERIC_REACTION_KINDS.REFUSE) {
			// Staying in a city is the server default. The mobile app keeps this state in the
			// background instead of exposing Discord's explicit "Rester en ville" button.
			continue;
		}
		groups[CITY_REACTION_GROUPS[entry.reaction.type] ?? "services"].push(entry);
	}

	for (const group of Object.values(groups)) {
		group.sort((left, right) => (CITY_REACTION_ORDER[left.reaction.type] ?? Number.MAX_SAFE_INTEGER) - (CITY_REACTION_ORDER[right.reaction.type] ?? Number.MAX_SAFE_INTEGER));
	}
	return groups;
}

function CitySection({title, entries, collector, onChoose, locked, first = false}: {
	title: string;
	entries: CityEntry[];
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	locked: boolean;
	first?: boolean;
}): ReactNode {
	if (entries.length === 0) {
		return null;
	}
	return (
		<>
			<SectionHeader first={first}>{title}</SectionHeader>
			<Panel><CityRows entries={entries} collector={collector} onChoose={onChoose} locked={locked} /></Panel>
		</>
	);
}

export function CityCollector({collector, onChoose, submitting}: CityCollectorProps): ReactNode {
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== CITY_DATA_KINDS.CITY) {
		return null;
	}
	// Expiration is owned by CollectorsStore. It removes this collector even when the app is in the
	// background, so this view does not need a visible countdown or a second ticking timer.
	const locked = answered || submitting;
	const entries = collector.reactions.map((reaction, index) => ({reaction, index}));
	const groups = groupEntries(entries);
	const locationName = i18n.t(`models:map_locations.${collector.data.data.mapLocationId}.name`);
	const locationDescription = i18n.t(`models:map_locations.${collector.data.data.mapLocationId}.description`);
	const mapIcon = AppIcons.getIconOrNull(`mapTypes.${collector.data.data.mapTypeId}`);
	const choose = (index: number): void => {
		if (locked) {
			return;
		}
		setAnswered(true);
		onChoose(index);
	};

	return (
		<Screen>
			<Hero
				eyebrow={i18n.t("app:city.titles.eyebrow")}
				title={`${mapIcon ?? "📍"} ${locationName}`}
				subtitle={locationDescription}
			/>
			<CitySection title={i18n.t("app:city.titles.housing")} entries={groups.housing} collector={collector} onChoose={choose} locked={locked} first />
			<CitySection title={i18n.t("app:city.titles.services")} entries={groups.services} collector={collector} onChoose={choose} locked={locked} />
			<CitySection title={i18n.t("app:city.titles.shops")} entries={groups.shops} collector={collector} onChoose={choose} locked={locked} />
			<CitySection title={i18n.t("app:city.titles.guild")} entries={groups.guild} collector={collector} onChoose={choose} locked={locked} />
			{groups.elsewhere.length > 0 ? (
				<CitySection title={i18n.t("app:city.titles.otherCities")} entries={groups.elsewhere} collector={collector} onChoose={choose} locked={locked} />
			) : null}
			<CitySection title={i18n.t("app:city.titles.quit")} entries={groups.quit} collector={collector} onChoose={choose} locked={locked} />
			{submitting ? <Note>{i18n.t("app:collector.answering")}</Note> : null}
		</Screen>
	);
}
