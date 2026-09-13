import {ReactNode} from "react";
import {ReactionCollectorCreation} from "ws-packets/src/fromServer/common/ReactionCollectorCreation";
import {CityMobileSnapshot} from "ws-packets/src/fromServer/collectors";
import type {CitySubmenu, CityEntry, CityNavigationItem} from "@/src/collectors/CityCollector";
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
import {Button, ButtonRow, Hero, Note, Screen} from "@/src/design/Primitives";
import {GuildDomain} from "@/src/components/GuildDomain";
import {i18n} from "@/src/translations/i18n";

type SubmenuProps = {
	view: CitySubmenu; innId?: string; entries: CityEntry[]; collector: ReactionCollectorCreation; snapshot?: CityMobileSnapshot;
	onChoose: (index: number) => void; onNavigate: (item: CityNavigationItem) => void; onBack: () => void; locked: boolean; backLabel?: string;
};

function submenuIcon(view: CitySubmenu, snapshot?: CityMobileSnapshot): string | null {
	if (view === "inn") return AppIcons.getIconOrNull("city.inn");
	if (view === "home") return AppIcons.getIconOrNull(homeIconPath(snapshot?.home?.owned?.level));
	return AppIcons.getIconOrNull(cityNavigationMeta(view).iconPath);
}

const INTERACTIVE_SUBMENUS: Partial<Record<CitySubmenu, () => ReactNode>> = {guild: GuildDomain};

export function CitySubmenuView({view, innId, entries, collector, snapshot, onChoose, onNavigate, onBack, locked, backLabel}: SubmenuProps): ReactNode {
	const details = submenuTitle(view, innId);
	const InteractiveSubmenu = INTERACTIVE_SUBMENUS[view];
	if (InteractiveSubmenu) return <Screen>
		<Hero eyebrow={details.eyebrow} title={details.title} />
		<InteractiveSubmenu />
		<ButtonRow><Button onPress={onBack}>{i18n.t("app:city.actions.back")}</Button></ButtonRow>
	</Screen>;
	const icon = submenuIcon(view, snapshot);
	const sections = submenuSections(view, entries, snapshot, {homeFeatureItems, gardenPlotItems, enchantmentCatalogItems});
	const visibleSections = sections.filter(section => section.items.length > 0);
	return <Screen>
		<Hero eyebrow={details.eyebrow} title={`${icon ? `${icon} ` : ""}${details.title}`} subtitle={details.subtitle} />
		<CitySnapshotSummary view={view} snapshot={snapshot} />
		{visibleSections.map((section, index) => <CitySection key={section.title} title={section.title} items={section.items} collector={collector} onChoose={onChoose} onNavigate={onNavigate} locked={locked} first={index === 0} iconForPath={iconForPath} rowIcon={cityRowIcon} rowTitle={cityRowTitle} rowSubtitle={cityRowSubtitle} rowEnd={cityRowEnd} reactionAvailable={cityReactionAvailable} />)}
		{citySnapshotNote(view, snapshot)}
		{visibleSections.length === 0 ? <Note>{i18n.t("app:city.subtitles.noActions")}</Note> : null}
		<ButtonRow><Button disabled={locked} onPress={locked ? undefined : onBack}>{backLabel ?? i18n.t("app:city.actions.back")}</Button></ButtonRow>
	</Screen>;
}
