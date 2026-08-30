import {ReactNode, useEffect, useState} from "react";
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

const MILLISECONDS_PER_SECOND = 1_000;

type CityCollectorProps = {
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	submitting: boolean;
};

type CityEntry = {reaction: ReactionCollectorReaction; index: number};

function useSecondsLeft(endTime: number): number {
	const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / MILLISECONDS_PER_SECOND)));

	useEffect(() => {
		const interval = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / MILLISECONDS_PER_SECOND))), MILLISECONDS_PER_SECOND);
		return (): void => clearInterval(interval);
	}, [endTime]);

	return secondsLeft;
}

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

function cityRowSubtitle(reaction: ReactionCollectorReaction): string | undefined {
	switch (reaction.type) {
		case CITY_REACTION_KINDS.EXIT:
			return i18n.t("commands:report.city.reactions.exit.description");
		case GENERIC_REACTION_KINDS.REFUSE:
			return i18n.t("app:city.subtitles.stay");
		case CITY_REACTION_KINDS.SHOP:
			return i18n.t(`commands:report.city.shops.${reaction.data.shopId}.description`);
		case CITY_REACTION_KINDS.INN_MEAL:
		case CITY_REACTION_KINDS.INN_ROOM:
			return i18n.t("commands:report.city.reactions.inn.description");
		case CITY_REACTION_KINDS.BUY_HOME:
		case CITY_REACTION_KINDS.UPGRADE_HOME:
		case CITY_REACTION_KINDS.MOVE_HOME:
			return i18n.t("app:city.subtitles.notary");
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
				title={reactionLabel(reaction, collector.data)}
				subtitle={cityRowSubtitle(reaction)}
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
			case CITY_REACTION_KINDS.APARTMENT_BUY:
			case CITY_REACTION_KINDS.APARTMENT_CLAIM_RENT:
				groups.guild.push(entry);
				break;
			default:
				groups.services.push(entry);
		}
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
	const secondsLeft = useSecondsLeft(collector.endTime);
	const [answered, setAnswered] = useState(false);
	if (collector.data.type !== CITY_DATA_KINDS.CITY) {
		return null;
	}
	const locked = answered || submitting || secondsLeft === 0;
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
			<Note>
				{submitting
					? i18n.t("app:collector.answering")
					: secondsLeft === 0 ? i18n.t("app:collector.expired") : i18n.t("app:collector.timeLeft", {seconds: secondsLeft})}
			</Note>
		</Screen>
	);
}
