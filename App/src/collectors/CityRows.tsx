import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {
	CITY_DATA_KINDS,
	CITY_REACTION_KINDS,
	CityMobileSnapshot,
	ReactionCollectorReaction
} from "ws-packets/src/fromServer/collectors";
import {isChoosable} from "@/src/collectors/CollectorLabels";
import {Panel, Row, SectionHeader} from "@/src/design/Primitives";

type CityEntry = {reaction: ReactionCollectorReaction; index: number};
type CitySubmenu = "home" | "homeBed" | "homeChest" | "homeGarden" | "homeCooking" | "homeUpgrade" | "notary" | "inn" | "enchanter" | "blacksmith" | "scrapDealer" | "royalBlacksmith" | "guild";
type CityNavigationItem = {kind: "navigation"; key: string; view: CitySubmenu; innId?: string; iconPath: string; title: string; subtitle?: string};
type CityInfoItem = {kind: "info"; key: string; iconPath: string; title: string; subtitle: string};
type CityReactionItem = {kind: "reaction"; entry: CityEntry};
type CityListItem = CityNavigationItem | CityInfoItem | CityReactionItem;

type CityRowsProps = {
	items: CityListItem[];
	collector: ReactionCollectorCreation;
	onChoose: (reactionIndex: number) => void;
	onNavigate: (item: CityNavigationItem) => void;
	locked: boolean;
	iconForPath: (iconPath: string) => ReactNode | undefined;
	rowIcon: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => ReactNode | undefined;
	rowTitle: (reaction: ReactionCollectorReaction, collectorData: ReactionCollectorCreation["data"], snapshot?: CityMobileSnapshot) => string;
	rowSubtitle: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => string | undefined;
	rowEnd: (reaction: ReactionCollectorReaction, snapshot?: CityMobileSnapshot) => string | undefined;
	reactionAvailable: (reaction: ReactionCollectorReaction, snapshot: CityMobileSnapshot | undefined) => boolean;
};

export function CityRows({items, collector, onChoose, onNavigate, locked, iconForPath, rowIcon, rowTitle, rowSubtitle, rowEnd, reactionAvailable}: CityRowsProps): ReactNode {
	return items.map(item => {
		if (item.kind === "navigation") {
			return <Row
				key={`${collector.id}-${item.key}`}
				disabled={locked}
				onPress={locked ? undefined : (): void => onNavigate(item)}
				icon={iconForPath(item.iconPath)}
				title={item.title}
				subtitle={item.subtitle}
				chevron={!locked}
			/>;
		}
		if (item.kind === "info") {
			return <Row
				key={`${collector.id}-${item.key}`}
				disabled
				icon={iconForPath(item.iconPath)}
				title={item.title}
				subtitle={item.subtitle}
			/>;
		}

		const {reaction, index} = item.entry;
		const snapshot = collector.data.type === CITY_DATA_KINDS.CITY ? collector.data.data.snapshot : undefined;
		const choosable = isChoosable(reaction, collector.data) && reactionAvailable(reaction, snapshot);
		const disabled = locked || !choosable;
		return <Row
			key={`${collector.id}-${index}`}
			disabled={disabled}
			onPress={disabled ? undefined : (): void => onChoose(index)}
			icon={rowIcon(reaction, snapshot)}
			title={rowTitle(reaction, collector.data, snapshot)}
			subtitle={rowSubtitle(reaction, snapshot)}
			end={rowEnd(reaction, snapshot)}
			tone={reaction.type === CITY_REACTION_KINDS.EXIT ? "danger" : undefined}
			chevron={choosable && !locked}
		/>;
	});
}

export function CitySection({title, hint, items, collector, onChoose, onNavigate, locked, first = false, ...rowRenderers}: CityRowsProps & {title: string; hint?: string; first?: boolean}): ReactNode {
	if (items.length === 0) {
		return null;
	}
	return <>
		<SectionHeader first={first} action={hint ? {hint} : undefined}>{title}</SectionHeader>
		<Panel><CityRows
			items={items}
			collector={collector}
			onChoose={onChoose}
			onNavigate={onNavigate}
			locked={locked}
			{...rowRenderers}
		/></Panel>
	</>;
}
