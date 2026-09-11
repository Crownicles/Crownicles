import {Fragment, ReactNode, useState} from "react";
import {InventoryRes} from "ws-packets/src/fromServer/inventory/InventoryRes";
import {MaterialQuantity} from "ws-packets/src/objects/MaterialQuantity";
import {InventoryItemRow} from "@/src/components/InventoryItemRow";
import {i18n} from "@/src/translations/i18n";
import {AppIcons} from "@/src/AppIcons";
import {INVENTORY_MENUS, useCommandMenus} from "@/src/store/useInventoryMenus";
import {KeyValue, Note, Panel, QuickAction, QuickActions, Row, SectionHeader} from "@/src/design/Primitives";
import {SegmentedControl} from "@/src/design/SegmentedControl";
import {formatNumber} from "@/src/display/Amounts";

export type InventoryData = NonNullable<InventoryRes["data"]>;
type InventoryArtifacts = Pick<InventoryRes, "hasTalisman" | "hasCloneTalisman" | "hasRemoteHarvestTalisman">;
type InventoryView = "equipped" | "reserve" | "materials" | "plants";
type InventoryCategory = {equipped: "weapon" | "armor" | "potion" | "object"; reserve: "backupWeapons" | "backupArmors" | "backupPotions" | "backupObjects"; slots: keyof InventoryData["slots"]};

const EQUIPPED_SLOT_COUNT = 1;
const INVENTORY_VIEWS: InventoryView[] = ["equipped", "reserve", "materials", "plants"];
const CATEGORIES: InventoryCategory[] = [
	{equipped: "weapon", reserve: "backupWeapons", slots: "weapons"},
	{equipped: "armor", reserve: "backupArmors", slots: "armors"},
	{equipped: "potion", reserve: "backupPotions", slots: "potions"},
	{equipped: "object", reserve: "backupObjects", slots: "objects"}
];

function InventoryEquipment({data}: {data: InventoryData}): ReactNode {
	return <Panel>{CATEGORIES.map(category => <InventoryItemRow key={category.equipped} item={data[category.equipped]} location={i18n.t(`items:${category.equipped}`, {count: 1})} />)}</Panel>;
}

function InventoryReserve({data}: {data: InventoryData}): ReactNode {
	return CATEGORIES.map(category => {
		const items = [...data[category.reserve]].sort((first, second) => first.slot - second.slot);
		const maximum = Math.max(0, data.slots[category.slots] - EQUIPPED_SLOT_COUNT);
		return <Fragment key={category.equipped}>
			<SectionHeader>{i18n.t(`items:${category.equipped}`, {count: maximum})}</SectionHeader>
			<Panel>{items.length > 0
				? items.map(item => <InventoryItemRow key={item.slot} item={item.display} location={i18n.t("app:equipment.slot", {slot: item.slot})} />)
				: <Note>{i18n.t("app:equipment.emptyReserve")}</Note>}
			</Panel>
			<Note>{i18n.t("app:equipment.capacity", {count: items.length, max: maximum})}</Note>
		</Fragment>;
	});
}

function InventoryMaterials({materials}: {materials: MaterialQuantity[]}): ReactNode {
	if (materials.length === 0) return <Note>{i18n.t("app:inventory.noMaterials")}</Note>;
	return <Panel>{materials.map(material => <KeyValue key={material.materialId} label={i18n.t(`models:materials.${material.materialId}`)} value={formatNumber(material.quantity)} />)}</Panel>;
}

function InventoryPlants({plants}: {plants: InventoryData["plants"]}): ReactNode {
	if (!plants) return <Note>{i18n.t("app:inventory.noPlants")}</Note>;
	return <>
		<Panel>
			<KeyValue label={i18n.t("app:inventory.seed")} value={plants.seed ? i18n.t(`models:plants.${plants.seed}`) : i18n.t("app:profile.values.none")} />
			{plants.plantSlots.map(plant => <KeyValue key={plant.slot} label={i18n.t(`models:plants.${plant.plantId}`)} value={i18n.t("app:inventory.plantSlot", {slot: plant.slot})} />)}
		</Panel>
		<Note>{i18n.t("app:equipment.capacity", {count: plants.plantSlots.length, max: plants.maxPlantSlots})}</Note>
	</>;
}

const ARTIFACTS = [
	{field: "hasTalisman", name: "expedition"},
	{field: "hasCloneTalisman", name: "clone"},
	{field: "hasRemoteHarvestTalisman", name: "harvest"}
] as const;

function InventoryArtifactList({artifacts}: {artifacts: InventoryArtifacts}): ReactNode {
	return <>
		<SectionHeader>{i18n.t("app:inventory.artifacts.title")}</SectionHeader>
		<Panel>{ARTIFACTS.map(artifact => <Row
			key={artifact.field}
			title={i18n.t(`app:inventory.artifacts.${artifact.name}`)}
			end={i18n.t(artifacts[artifact.field] ? "app:inventory.owned" : "app:inventory.absent")}
		/>)}</Panel>
	</>;
}

function InventoryContent({view, data, artifacts}: {view: InventoryView; data: InventoryData; artifacts?: InventoryArtifacts}): ReactNode {
	switch (view) {
		case "equipped": return <><InventoryEquipment data={data} />{artifacts ? <InventoryArtifactList artifacts={artifacts} /> : null}</>;
		case "reserve": return <InventoryReserve data={data} />;
		case "materials": return <InventoryMaterials materials={data.materials} />;
		default: return <InventoryPlants plants={data.plants} />;
	}
}

const ACTIONS = [
	{menu: INVENTORY_MENUS.EQUIP, label: "equip", icon: "unitValues.attack"},
	{menu: INVENTORY_MENUS.SELL, label: "sell", icon: "unitValues.money"},
	{menu: INVENTORY_MENUS.DRINK, label: "drink", icon: "items.drinkPotion"},
	{menu: INVENTORY_MENUS.DAILY, label: "daily", icon: "unitValues.xp"}
];

export function Inventory({inventoryData, artifacts}: {inventoryData: InventoryData | null; artifacts?: InventoryArtifacts}): ReactNode {
	const [view, setView] = useState<InventoryView>("equipped");
	const {message, pending, open} = useCommandMenus();
	if (!inventoryData) return <Note>{i18n.t("app:common.loading")}</Note>;
	return <>
		<SegmentedControl options={INVENTORY_VIEWS.map(value => ({value, label: i18n.t(`app:inventory.views.${value}`)}))} value={view} onChange={setView} label={i18n.t("app:profile.titles.inventory")} />
		{message ? <Note>{message}</Note> : null}
		<InventoryContent view={view} data={inventoryData} artifacts={artifacts} />
		<SectionHeader>{i18n.t("app:inventory.actions.title")}</SectionHeader>
		<QuickActions>{ACTIONS.map(action => <QuickAction key={action.label} icon={AppIcons.getIcon(action.icon)} disabled={pending} onPress={(): Promise<void> => open(action.menu)}>{i18n.t(`app:inventory.actions.${action.label}`)}</QuickAction>)}</QuickActions>
	</>;
}
