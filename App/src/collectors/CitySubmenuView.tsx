import {ReactNode} from "react";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import type {CitySubmenu, CityEntry, CityNavigationItem, CityMenuData} from "@/src/collectors/CityCollector";
import {AppIcons} from "@/src/AppIcons";
import {CitySnapshotSummary} from "@/src/collectors/CitySnapshotSummary";
import {citySnapshotNote} from "@/src/collectors/CitySnapshotNote";
import {gardenPlotItems, homeFeatureItems, homeIconPath} from "@/src/collectors/CityHomeItems";
import {enchantmentCatalogItems} from "@/src/collectors/CityGuildItems";
import {cityRowEnd, cityRowSubtitle} from "@/src/collectors/CityRowDetails";
import {cityReactionAvailable, cityRowIcon, cityRowTitle, iconForPath} from "@/src/collectors/CityRowPresentation";
import {cityNavigationMeta, submenuTitle} from "@/src/collectors/CityMenuModel";
import {CitySection} from "@/src/collectors/CityRows";
import {submenuSections} from "@/src/collectors/CitySubmenuSections";
import {plainStory} from "@/src/display/Markdown";
import {Note, Screen} from "@/src/design/Primitives";
import {BackButton, Standing} from "@/src/design/Sections";
import {SwipeBack} from "@/src/design/SwipeBack";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {GuildDomain} from "@/src/components/GuildDomain";
import {i18n} from "@/src/translations/i18n";

const SUBMENU_EMBLEM_SIZE = 34;

type SubmenuProps = {
	view: CitySubmenu; innId?: string; entries: CityEntry[]; collector: CityMenuData; snapshot?: CityMobileSnapshot;
	onChoose: (index: number) => void; onNavigate: (item: CityNavigationItem) => void; onBack: () => void; locked: boolean; backLabel?: string; overlay?: boolean;
};

function submenuIcon(view: CitySubmenu, snapshot?: CityMobileSnapshot): string | null {
	if (view === "inn") return AppIcons.getIconOrNull("city.inn");
	if (view === "home") return AppIcons.getIconOrNull(homeIconPath(snapshot?.home?.owned?.level));
	return AppIcons.getIconOrNull(cityNavigationMeta(view).iconPath);
}

const INTERACTIVE_SUBMENUS: Partial<Record<CitySubmenu, () => ReactNode>> = {guild: GuildDomain};

function SubmenuHeading({view, snapshot, innId}: {view: CitySubmenu; snapshot?: CityMobileSnapshot; innId?: string}): ReactNode {
	const details = submenuTitle(view, innId);
	const icon = submenuIcon(view, snapshot);
	return <Standing
		{...icon ? {emblem: <TwemojiIcon emoji={icon} size={SUBMENU_EMBLEM_SIZE} />} : {}}
		caption={details.eyebrow}
		title={plainStory(details.title)}
		{...details.subtitle ? {subtitle: plainStory(details.subtitle)} : {}}
	/>;
}

export function CitySubmenuView({view, innId, entries, collector, snapshot, onChoose, onNavigate, onBack, locked, backLabel, overlay}: SubmenuProps): ReactNode {
	const leave = (): void => {
		if (!locked) onBack();
	};
	const swipe = {
		onClose: leave,
		...overlay ? {overlay} : {}
	};
	const heading = <>
		<BackButton label={backLabel ?? i18n.t("app:city.actions.back")} onClose={leave} />
		<SubmenuHeading view={view} snapshot={snapshot} innId={innId} />
	</>;
	const InteractiveSubmenu = INTERACTIVE_SUBMENUS[view];
	if (InteractiveSubmenu) return <SwipeBack {...swipe}><Screen>{heading}<InteractiveSubmenu /></Screen></SwipeBack>;
	const sections = submenuSections(view, entries, snapshot, {homeFeatureItems, gardenPlotItems, enchantmentCatalogItems});
	const visibleSections = sections.filter(section => section.items.length > 0);
	return <SwipeBack {...swipe}>
		<Screen>
			{heading}
			<CitySnapshotSummary view={view} snapshot={snapshot} />
			{visibleSections.map((section, index) => <CitySection key={section.title} title={section.title} items={section.items} collector={collector} onChoose={onChoose} onNavigate={onNavigate} locked={locked} first={index === 0} iconForPath={iconForPath} rowIcon={cityRowIcon} rowTitle={cityRowTitle} rowSubtitle={cityRowSubtitle} rowEnd={cityRowEnd} reactionAvailable={cityReactionAvailable} />)}
			{citySnapshotNote(view, snapshot)}
			{visibleSections.length === 0 ? <Note>{i18n.t("app:city.subtitles.noActions")}</Note> : null}
		</Screen>
	</SwipeBack>;
}
