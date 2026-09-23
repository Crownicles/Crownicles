import {Fragment, ReactNode, useState} from "react";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {MaterialQuantity} from "ws-packets/src/objects/MaterialQuantity";
import {InventoryItemRow} from "@/src/components/InventoryItemRow";
import {InventoryItemCard} from "@/src/components/InventoryItemCard";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";
import {
	EQUIPPED_SLOT, givesDailyBonus, InventoryItem, InventoryItemActions, itemActions, ItemKind, useInventoryItemActions
} from "@/src/store/useInventoryItemActions";
import {EmptyState, Note, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {Theme} from "@/src/design/Theme";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {useExpandedEntry} from "@/src/design/useExpandedEntry";
import {Clock3} from "@/src/design/FightIcons";
import {formatNumber} from "@/src/display/Amounts";
import {formatDurationMinutes} from "@/src/display/ItemEffects";
import {materialName, plantName} from "@/src/display/Resources";
import {EntryRow, ExpandableList, Fact, Lock} from "@/src/design/Sections";

export type InventoryData = NonNullable<InventoryRes["data"]>;
type InventoryArtifacts = Pick<InventoryRes, "hasTalisman" | "hasCloneTalisman" | "hasRemoteHarvestTalisman">;
type InventoryView = "equipped" | "reserve" | "materials" | "plants";
type InventoryCategory = {equipped: ItemKind; reserve: "backupWeapons" | "backupArmors" | "backupPotions" | "backupObjects"; slots: keyof InventoryData["slots"]; icon: string};

const EQUIPPED_SLOT_COUNT = 1;
const MILLISECONDS_PER_MINUTE = 60_000;

/** The same emoji the Discord inventory uses, so the two front ends name a category the same way. */
const VIEW_ICONS: Record<InventoryView, string> = {
	equipped: "itemCategories.0",
	reserve: "inventory.stock",
	materials: "inventory.materials",
	plants: "city.homeUpgrades.garden"
};
const INVENTORY_VIEWS: InventoryView[] = ["equipped", "reserve", "materials", "plants"];
const CATEGORIES: InventoryCategory[] = [
	{equipped: "weapon", reserve: "backupWeapons", slots: "weapons", icon: "itemCategories.0"},
	{equipped: "armor", reserve: "backupArmors", slots: "armors", icon: "itemCategories.1"},
	{equipped: "potion", reserve: "backupPotions", slots: "potions", icon: "itemCategories.2"},
	{equipped: "object", reserve: "backupObjects", slots: "objects", icon: "itemCategories.3"}
];

function reserveCapacity(data: InventoryData, category: InventoryCategory): number {
	return Math.max(0, data.slots[category.slots] - EQUIPPED_SLOT_COUNT);
}

/** A section title wearing the emoji of what it holds, the way the Discord inventory does. */
function CategoryHeader({category, count, first, hint}: {
	category: InventoryCategory;
	count: number;
	first: boolean;
	hint?: string;
}): ReactNode {
	return <SectionHeader
		icon={AppIcons.getIconOrNull(category.icon) ?? undefined}
		first={first}
		{...hint === undefined ? {} : {action: {hint}}}
	>{i18n.t(`items:${category.equipped}`, {count})}</SectionHeader>;
}

function InventoryEquipment({data, rows}: {data: InventoryData; rows: ItemRows}): ReactNode {
	return CATEGORIES.map((category, index) => <Fragment key={category.equipped}>
		<CategoryHeader category={category} count={1} first={index === 0} />
		<ExpandableList>{rows.render(
			{item: data[category.equipped], kind: category.equipped, slot: EQUIPPED_SLOT, equipped: true},
			category
		)}</ExpandableList>
	</Fragment>);
}

function InventoryReserve({data, rows}: {data: InventoryData; rows: ItemRows}): ReactNode {
	return CATEGORIES.map((category, index) => {
		const items = [...data[category.reserve]].sort((first, second) => first.slot - second.slot);
		const maximum = reserveCapacity(data, category);
		return <Fragment key={category.equipped}>
			<CategoryHeader
				category={category}
				count={maximum}
				first={index === 0}
				hint={i18n.t("app:profile.formats.progress", {value: items.length, max: maximum})}
			/>
			<ExpandableList>{items.length > 0
				? items.map(item => <Fragment key={item.slot}>{rows.render(
					{item: item.display, kind: category.equipped, slot: item.slot, equipped: false},
					category
				)}</Fragment>)
				: <EmptyState>{i18n.t("app:equipment.emptyReserve")}</EmptyState>}
			</ExpandableList>
		</Fragment>;
	});
}

function InventoryMaterials({materials}: {materials: MaterialQuantity[]}): ReactNode {
	return <>
		<SectionHeader first action={{hint: formatNumber(materials.length)}}>{i18n.t("app:inventory.views.materials")}</SectionHeader>
		<ExpandableList>{materials.length > 0
			? materials.map(material => <Fact key={material.materialId} label={materialName(material.materialId)} value={formatNumber(material.quantity)} />)
			: <EmptyState>{i18n.t("app:inventory.noMaterials")}</EmptyState>}
		</ExpandableList>
	</>;
}

function InventoryPlants({plants}: {plants: InventoryData["plants"]}): ReactNode {
	return <>
		<SectionHeader
			first
			{...plants ? {action: {hint: i18n.t("app:profile.formats.progress", {value: plants.plantSlots.length, max: plants.maxPlantSlots})}} : {}}
		>{i18n.t("app:inventory.views.plants")}</SectionHeader>
		<ExpandableList>{plants
			? <>
				<Fact label={i18n.t("app:inventory.seed")} value={plants.seed ? plantName(plants.seed) : i18n.t("app:profile.values.none")} />
				{plants.plantSlots.map(plant => <Fact key={plant.slot} label={plantName(plant.plantId)} value={i18n.t("app:inventory.plantSlot", {slot: plant.slot})} />)}
			</>
			: <EmptyState>{i18n.t("app:inventory.noPlants")}</EmptyState>}
		</ExpandableList>
	</>;
}

const ARTIFACTS = [
	{field: "hasTalisman", name: "expedition", icon: "expedition.talisman"},
	{field: "hasCloneTalisman", name: "clone", icon: "expedition.cloneTalisman"},
	{field: "hasRemoteHarvestTalisman", name: "harvest", icon: "city.gardenStatus.remoteHarvestTalisman"}
] as const;

function InventoryArtifactList({artifacts}: {artifacts: InventoryArtifacts}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:inventory.artifacts.title")}</SectionHeader>
		<ExpandableList>{ARTIFACTS.map(artifact => <EntryRow
			key={artifact.field}
			disabled={!artifacts[artifact.field]}
			emblem={<TwemojiIcon emoji={AppIcons.getIcon(artifact.icon)} size={Theme.dimensions.headerIcon} />}
			title={i18n.t(`app:inventory.artifacts.${artifact.name}`)}
			end={i18n.t(artifacts[artifact.field] ? "app:inventory.owned" : "app:inventory.absent")}
		/>)}</ExpandableList>
	</>;
}

function InventoryContent({view, data, artifacts, rows}: {view: InventoryView; data: InventoryData; artifacts?: InventoryArtifacts; rows: ItemRows}): ReactNode {
	switch (view) {
		case "equipped": return <><InventoryEquipment data={data} rows={rows} />{artifacts ? <InventoryArtifactList artifacts={artifacts} /> : null}</>;
		case "reserve": return <InventoryReserve data={data} rows={rows} />;
		case "materials": return <InventoryMaterials materials={data.materials} />;
		default: return <InventoryPlants plants={data.plants} />;
	}
}

/** The daily bonus is the one action with a delay, so the screen says how long it still has to run. */
function dailyBonusLock(availableAt: number | undefined): Lock | undefined {
	const remaining = availableAt === undefined ? 0 : availableAt - Date.now();
	if (remaining <= 0) return undefined;
	return {
		reason: i18n.t("app:dailyBonus.locked", {time: formatDurationMinutes(remaining / MILLISECONDS_PER_MINUTE)}),
		icon: Clock3
	};
}

/** Draws an item row, which knows from the whole inventory what the item allows. */
type ItemRows = {render: (entry: InventoryItem, category: InventoryCategory) => ReactNode};

function useItemRows(data: InventoryData, dailyBonusAvailableAt: number | undefined, actions: InventoryItemActions): ItemRows {
	const unfolding = useExpandedEntry<string>();
	const dailyLock = dailyBonusLock(dailyBonusAvailableAt);
	const equippedObjectGivesDaily = givesDailyBonus(data.object);
	return {
		render: (entry, category): ReactNode => {
			if (entry.item.id === 0) return <InventoryItemRow item={entry.item} />;
			const reserveFull = data[category.reserve].length >= reserveCapacity(data, category);
			return <InventoryItemCard
				entry={entry}
				choices={itemActions(entry, {reserveFull, dailyLock, equippedObjectGivesDaily})}
				actions={actions}
				unfolding={unfolding}
			/>;
		}
	};
}

function InventoryScreen({data, artifacts, dailyBonusAvailableAt}: {
	data: InventoryData;
	artifacts: InventoryArtifacts | undefined;
	dailyBonusAvailableAt: number | undefined;
}): ReactNode {
	const [view, setView] = useState<InventoryView>("equipped");
	const actions = useInventoryItemActions();
	const rows = useItemRows(data, dailyBonusAvailableAt, actions);
	return <>
		<SegmentedControl options={INVENTORY_VIEWS.map(value => ({value, label: i18n.t(`app:inventory.views.${value}`), ...AppIcons.getIconOrNull(VIEW_ICONS[value]) === null ? {} : {icon: AppIcons.getIcon(VIEW_ICONS[value])}}))} value={view} onChange={setView} label={i18n.t("app:profile.titles.inventory")} />
		{actions.message ? <Note>{actions.message}</Note> : null}
		<InventoryContent view={view} data={data} artifacts={artifacts} rows={rows} />
	</>;
}

export function Inventory({inventoryData, artifacts, dailyBonusAvailableAt}: {
	inventoryData: InventoryData | null;
	artifacts?: InventoryArtifacts;
	dailyBonusAvailableAt?: number;
}): ReactNode {
	if (!inventoryData) return <Note>{i18n.t("app:common.loading")}</Note>;
	return <InventoryScreen data={inventoryData} artifacts={artifacts} dailyBonusAvailableAt={dailyBonusAvailableAt} />;
}
