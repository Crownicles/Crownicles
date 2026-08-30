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

function cityIconPath(reaction: ReactionCollectorReaction): string | undefined {
	switch (reaction.type) {
		case GENERIC_REACTION_KINDS.REFUSE:
			return "city.stay";
		case CITY_REACTION_KINDS.EXIT:
			return "city.exit";
		case CITY_REACTION_KINDS.INN_MEAL:
		case CITY_REACTION_KINDS.INN_ROOM:
			return "city.inn";
		case CITY_REACTION_KINDS.ENCHANT:
			return "city.services.enchanter";
		case CITY_REACTION_KINDS.SHOP:
			return `city.shops.${reaction.data.shopId}`;
		case CITY_REACTION_KINDS.BUY_HOME:
		case CITY_REACTION_KINDS.UPGRADE_HOME:
		case CITY_REACTION_KINDS.MOVE_HOME:
			return "city.manageHome";
		case CITY_REACTION_KINDS.HOME_MENU:
			return "city.home.5";
		case CITY_REACTION_KINDS.HOME_BED:
			return "city.homeUpgrades.bed";
		case CITY_REACTION_KINDS.UPGRADE_ITEM:
			return "city.homeUpgrades.upgradeEquipment";
		case CITY_REACTION_KINDS.BLACKSMITH_MENU:
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
			return "city.services.blacksmith";
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
			return "city.blacksmith.disenchant";
		case CITY_REACTION_KINDS.SCRAP_DEALER_MENU:
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE:
			return "city.services.scrapDealer";
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU:
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE:
			return "city.services.royalBlacksmith";
		case CITY_REACTION_KINDS.GARDEN_HARVEST:
		case CITY_REACTION_KINDS.GARDEN_WATER:
		case CITY_REACTION_KINDS.GARDEN_COMPOST:
			return "city.homeUpgrades.garden";
		case CITY_REACTION_KINDS.GUILD_DOMAIN_MENU:
			return "city.guildDomain.menu";
		case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY:
			return "city.guildDomainNotary";
		case CITY_REACTION_KINDS.APARTMENT_BUY:
		case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT:
			return "city.apartmentNotary.menu";
		default:
			return undefined;
	}
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

function cityRowSubtitle(reaction: ReactionCollectorReaction): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.EXIT:
			return compactCityDescription(i18n.t("commands:report.city.reactions.exit.description"));
		case GENERIC_REACTION_KINDS.REFUSE:
			return compactCityDescription(i18n.t("commands:report.city.reactions.stay.description"));
		case CITY_REACTION_KINDS.SHOP:
			return compactCityDescription(i18n.t(`commands:report.city.shops.${reaction.data.shopId}.description`));
		case CITY_REACTION_KINDS.INN_MEAL:
			return `${i18n.t(`commands:report.city.inns.names.${reaction.data.innId}`)} · ${compactCityDescription(i18n.t("commands:report.city.inns.mealDescription", reaction.data))}`;
		case CITY_REACTION_KINDS.INN_ROOM:
			return `${i18n.t(`commands:report.city.inns.names.${reaction.data.innId}`)} · ${compactCityDescription(i18n.t("commands:report.city.inns.roomDescription", reaction.data))}`;
		case CITY_REACTION_KINDS.BUY_HOME:
			return compactCityDescription(i18n.t("commands:report.city.homes.manageHomeDescriptionNew"));
		case CITY_REACTION_KINDS.UPGRADE_HOME:
			return compactCityDescription(i18n.t("commands:report.city.homes.manageHomeDescriptionUpgrade"));
		case CITY_REACTION_KINDS.MOVE_HOME:
			return compactCityDescription(i18n.t("commands:report.city.homes.manageHomeDescriptionMove"));
		case CITY_REACTION_KINDS.HOME_MENU:
			return compactCityDescription(i18n.t("commands:report.city.homes.goToOwnedHomeDescription"));
		case CITY_REACTION_KINDS.HOME_BED:
			return compactCityDescription(i18n.t("commands:report.city.homes.bed.menuDescription"));
		case CITY_REACTION_KINDS.ENCHANT:
			return compactCityDescription(i18n.t("commands:report.city.reactions.enchanter.description"));
		case CITY_REACTION_KINDS.BLACKSMITH_MENU:
			return compactCityDescription(i18n.t("commands:report.city.blacksmith.menuDescription"));
		case CITY_REACTION_KINDS.BLACKSMITH_UPGRADE:
			return compactCityDescription(i18n.t("commands:report.city.blacksmith.upgradeDescription"));
		case CITY_REACTION_KINDS.BLACKSMITH_DISENCHANT:
			return compactCityDescription(i18n.t("commands:report.city.blacksmith.disenchantDescription"));
		case CITY_REACTION_KINDS.SCRAP_DEALER_MENU:
			return compactCityDescription(i18n.t("commands:report.city.scrapDealer.menuDescription"));
		case CITY_REACTION_KINDS.SCRAP_DEALER_RECYCLE:
			return compactCityDescription(i18n.t("commands:report.city.scrapDealer.menuDescription"));
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_MENU:
			return compactCityDescription(i18n.t("commands:report.city.royalBlacksmith.menuDescription"));
		case CITY_REACTION_KINDS.ROYAL_BLACKSMITH_UPGRADE:
			return compactCityDescription(i18n.t("commands:report.city.royalBlacksmith.menuDescription"));
		case CITY_REACTION_KINDS.GUILD_DOMAIN_MENU:
			return compactCityDescription(i18n.t("commands:report.city.guildDomain.description"));
		case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY:
			return compactCityDescription(i18n.t("commands:report.city.guildDomain.notaryDescription"));
		default:
			return undefined;
	}
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

function groupEntries(entries: CityEntry[]): Record<string, CityEntry[]> {
	const groups: Record<string, CityEntry[]> = {
		housing: [], services: [], shops: [], guild: [], elsewhere: [], quit: []
	};
	for (const entry of entries) {
		switch (entry.reaction.type) {
			case GENERIC_REACTION_KINDS.REFUSE:
				// Staying in a city is the server default. The mobile app keeps this state in the
				// background instead of exposing Discord's explicit "Rester en ville" button.
				break;
			case CITY_REACTION_KINDS.EXIT:
				groups.quit.push(entry);
				break;
			case CITY_REACTION_KINDS.BUY_HOME:
			case CITY_REACTION_KINDS.UPGRADE_HOME:
			case CITY_REACTION_KINDS.MOVE_HOME:
			case CITY_REACTION_KINDS.HOME_MENU:
			case CITY_REACTION_KINDS.HOME_BED:
			case CITY_REACTION_KINDS.UPGRADE_ITEM:
				groups.housing.push(entry);
				break;
			case CITY_REACTION_KINDS.SHOP:
				groups.shops.push(entry);
				break;
			case CITY_REACTION_KINDS.GUILD_DOMAIN_MENU:
			case CITY_REACTION_KINDS.GUILD_DOMAIN_NOTARY:
				groups.guild.push(entry);
				break;
			case CITY_REACTION_KINDS.APARTMENT_BUY:
			case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT:
				// Apartments are managed by the notary and belong with the player's housing.
				groups.housing.push(entry);
				break;
			default:
				groups.services.push(entry);
		}
	}

	// The packet is intentionally ordered for Discord's reaction collector, not for a mobile
	// screen. Keep the same reading order as the city mockup: entry point first, then details.
	const order: Record<string, number> = {
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
	for (const group of Object.values(groups)) {
		group.sort((left, right) => (order[left.reaction.type] ?? Number.MAX_SAFE_INTEGER) - (order[right.reaction.type] ?? Number.MAX_SAFE_INTEGER));
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
