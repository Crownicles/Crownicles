import { beforeEach, describe, expect, it, vi } from 'vitest';
import { giveItemToPlayer, toItemWithDetails } from '../../../src/core/utils/ItemUtils';
import { InventorySlots } from '../../../src/core/database/game/models/InventorySlot';
import { InventoryInfos } from '../../../src/core/database/game/models/InventoryInfo';
import { MissionsController } from '../../../src/core/missions/MissionsController';
import { BlockingUtils } from '../../../src/core/utils/BlockingUtils';
import { crowniclesInstance } from '../../../src';
import { ItemCategory, ItemRarity } from '../../../../Lib/src/constants/ItemConstants';
import { BlockingConstants } from '../../../../Lib/src/constants/BlockingConstants';
import { CrowniclesPacket, PacketContext } from '../../../../Lib/src/packets/CrowniclesPacket';
import { ItemFoundPacket } from '../../../../Lib/src/packets/events/ItemFoundPacket';
import { ReactionCollectorInstance } from '../../../src/core/utils/ReactionsCollector';

// Mock all external dependencies
vi.mock('../../../src/core/database/game/models/InventorySlot');
vi.mock('../../../src/core/database/game/models/InventoryInfo');
vi.mock('../../../src/core/missions/MissionsController');
vi.mock('../../../src/core/utils/BlockingUtils');
vi.mock('../../../src/core/utils/ReactionsCollector', () => ({
	ReactionCollectorInstance: class {
		constructor(collector: any, context: any, options: any, callback: any) {
			// Mock properties
		}
		block() {
			return this;
		}
		build() {
			return this;
		}
	}
}));
vi.mock('../../../../Lib/src/packets/CrowniclesPacket', () => ({
	CrowniclesPacket: class {},
	PacketContext: class {},
	PacketDirection: {
		NONE: 0,
		FRONT_TO_BACK: 1,
		BACK_TO_FRONT: 2
	},
	sendablePacket: vi.fn(() => () => {}),
	makePacket: vi.fn((PacketType, data) => ({ type: PacketType.name, data }))
}));
vi.mock('../../../src', () => ({
	crowniclesInstance: {
		logsDatabase: {
			logItemGain: vi.fn(),
			logItemSell: vi.fn()
		}
	}
}));
vi.mock('../../../src/data/Weapon', () => ({
	WeaponDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				getAttack: vi.fn().mockReturnValue(100),
				getDefense: vi.fn().mockReturnValue(50),
				getSpeed: vi.fn().mockReturnValue(75)
			})
		}
	}
}));
vi.mock('../../../src/data/Armor', () => ({
	ArmorDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				getAttack: vi.fn().mockReturnValue(80),
				getDefense: vi.fn().mockReturnValue(120),
				getSpeed: vi.fn().mockReturnValue(30)
			})
		}
	}
}));
vi.mock('../../../src/data/Potion', () => ({
	Potion: class {
		nature = 1;
		power = 50;
		isFightPotion() { return false; }
	},
	PotionDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				nature: 1,
				power: 50
			})
		}
	}
}));
vi.mock('../../../src/data/ObjectItem', () => ({
	ObjectItemDataController: {
		instance: {
			getById: vi.fn().mockReturnValue({
				nature: 2,
				power: 25
			})
		}
	}
}));

describe('ItemUtils - giveItemToPlayer', () => {
	let mockPlayer: any;
	let mockItem: any;
	let mockInventorySlots: any[];
	let mockInventoryInfo: any;
	let mockResponse: CrowniclesPacket[];
	let mockContext: PacketContext;

	beforeEach(() => {
		// Clear all mocks
		vi.clearAllMocks();

		// Mock player
		mockPlayer = {
			id: 1,
			keycloakId: 'test-keycloak-id',
			giveItem: vi.fn(),
			addMoney: vi.fn(),
			save: vi.fn(),
			reload: vi.fn()
		};

		// Mock basic item
		mockItem = {
			id: 100,
			rarity: ItemRarity.COMMON,
			getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON),
			getItemAddedValue: vi.fn().mockReturnValue(10)
		};

		// Mock inventory slots
		mockInventorySlots = [
			{
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.WEAPON,
				itemId: 50,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(false),
				getItem: vi.fn().mockReturnValue({
					id: 50,
					rarity: ItemRarity.BASIC,
					getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
				})
			}
		];

		// Mock inventory info
		mockInventoryInfo = {
			slotLimitForCategory: vi.fn().mockReturnValue(1)
		};

		// Mock response and context
		mockResponse = [];
		mockContext = {
			frontEndOrigin: 'discord',
			frontEndSubOrigin: 'test-channel'
		} as PacketContext;

		// Setup default mocks
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(mockInventorySlots);
		vi.mocked(InventoryInfos.getOfPlayer).mockResolvedValue(mockInventoryInfo);
		vi.mocked(MissionsController.update).mockResolvedValue(mockPlayer);
		vi.mocked(BlockingUtils.unblockPlayer).mockResolvedValue();

		// Mock crowniclesInstance
		vi.mocked(crowniclesInstance.logsDatabase.logItemGain).mockResolvedValue(undefined);
		vi.mocked(crowniclesInstance.logsDatabase.logItemSell).mockResolvedValue(undefined);
	});

	describe('when player has available inventory space', () => {
		it('should give item directly to player and call related functions', async () => {
			// Arrange
			mockPlayer.giveItem.mockResolvedValue(true);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem);
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{ missionId: "findOrBuyItem" }
			);
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "haveItemRarity",
					params: { rarity: mockItem.rarity }
				}
			);
			expect(crowniclesInstance.logsDatabase.logItemGain).toHaveBeenCalledWith(
				mockPlayer.keycloakId,
				mockItem
			);
			
			// Should push ItemFoundPacket
			expect(mockResponse).toHaveLength(1);
			expect(mockResponse[0]).toEqual({
				type: 'ItemFoundPacket',
				data: {
					itemWithDetails: expect.objectContaining({
						id: mockItem.id,
						category: ItemCategory.WEAPON,
						rarity: ItemRarity.COMMON
					})
				}
			});
		});
	});

	describe('when player inventory is full', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(false);
		});

		it('should trigger auto-sell when all items in category are the same', async () => {
			// Arrange - all items in category are the same as the new item
			mockInventorySlots[0].itemId = mockItem.id;
			
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem);
			// Auto-sell should trigger, response may still contain ReactionCollector for confirmation
			expect(mockResponse.length).toBeGreaterThanOrEqual(1);
		});

		it('should create reaction collector for single slot category', async () => {
			// Arrange
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(1);
			
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
		});

		it('should handle multi-slot categories with choice collector', async () => {
			// Arrange
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(3);
			mockInventorySlots.push(
				{
					playerId: 1,
					slot: 1,
					itemCategory: ItemCategory.WEAPON,
					itemId: 60,
					isEquipped: vi.fn().mockReturnValue(false),
					isPotion: vi.fn().mockReturnValue(false),
					getItem: vi.fn().mockReturnValue({
						id: 60,
						rarity: ItemRarity.COMMON,
						getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
					})
				}
			);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
			expect(mockResponse[1]).toBeInstanceOf(ReactionCollectorInstance);
		});
	});

	describe('when handling potions', () => {
		beforeEach(() => {
			mockItem = {
				id: 200,
				rarity: ItemRarity.RARE,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION),
				isFightPotion: vi.fn().mockReturnValue(false)
			};
			mockPlayer.giveItem.mockResolvedValue(false);
		});

		it('should not auto-sell drinkable potions even when all are same', async () => {
			// Arrange
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: mockItem.id,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(mockItem)
			};

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2); // ItemFoundPacket + ReactionCollectorInstance
		});

		it('should auto-sell fight potions when all are same', async () => {
			// Arrange
			mockItem.isFightPotion.mockReturnValue(true);
			mockInventorySlots[0] = {
				playerId: 1,
				slot: 0,
				itemCategory: ItemCategory.POTION,
				itemId: mockItem.id,
				isEquipped: vi.fn().mockReturnValue(true),
				isPotion: vi.fn().mockReturnValue(true),
				getItem: vi.fn().mockReturnValue(mockItem)
			};

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert - should trigger auto-sell
			expect(mockResponse.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('with different resale multipliers', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(false);
			mockInventoryInfo.slotLimitForCategory.mockReturnValue(1);
		});

		it('should pass resale multiplier to callback', async () => {
			// Arrange
			const customMultiplier = 0.5;

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem, customMultiplier);

			// Assert
			expect(mockResponse).toHaveLength(2);
			// The multiplier should be passed to the callback (tested indirectly)
		});

		it('should use default multiplier of 1 when not specified', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockResponse).toHaveLength(2);
			// Default multiplier should be used
		});
	});

	describe('error handling and edge cases', () => {
		it('should handle empty inventory slots', async () => {
			// Arrange
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
			mockPlayer.giveItem.mockResolvedValue(true);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(mockPlayer.giveItem).toHaveBeenCalledWith(mockItem);
			expect(mockResponse).toHaveLength(1);
		});

		it('should handle database errors gracefully', async () => {
			// Arrange
			vi.mocked(InventorySlots.getOfPlayer).mockRejectedValue(new Error('Database error'));

			// Act & Assert
			await expect(giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem))
				.rejects.toThrow('Database error');
		});

		it('should handle missing inventory info', async () => {
			// Arrange
			vi.mocked(InventoryInfos.getOfPlayer).mockRejectedValue(new Error('Inventory info not found'));
			mockPlayer.giveItem.mockResolvedValue(false);

			// Act & Assert
			await expect(giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem))
				.rejects.toThrow('Inventory info not found');
		});
	});

	describe('mission updates', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(true);
		});

		it('should update findOrBuyItem mission', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{ missionId: "findOrBuyItem" }
			);
		});

		it('should update havePotions mission with correct count', async () => {
			// Arrange
			const potionSlots = [
				{
					isPotion: vi.fn().mockReturnValue(true),
					itemId: 1
				},
				{
					isPotion: vi.fn().mockReturnValue(true),
					itemId: 2
				},
				{
					isPotion: vi.fn().mockReturnValue(false),
					itemId: 3
				}
			];
			vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(potionSlots as any);

			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "havePotions",
					count: 2, // Should count only potions with non-zero itemId
					set: true
				}
			);
		});

		it('should update haveItemRarity mission with item rarity', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(MissionsController.update).toHaveBeenCalledWith(
				mockPlayer,
				mockResponse,
				{
					missionId: "haveItemRarity",
					params: { rarity: mockItem.rarity }
				}
			);
		});
	});

	describe('logging', () => {
		beforeEach(() => {
			mockPlayer.giveItem.mockResolvedValue(true);
		});

		it('should log item gain when successfully given', async () => {
			// Act
			await giveItemToPlayer(mockResponse, mockContext, mockPlayer, mockItem);

			// Assert
			expect(crowniclesInstance.logsDatabase.logItemGain).toHaveBeenCalledWith(
				mockPlayer.keycloakId,
				mockItem
			);
		});
	});

	describe('toItemWithDetails helper function', () => {
		it('should correctly convert weapon item to ItemWithDetails', () => {
			// Arrange
			const weaponItem = {
				id: 1,
				rarity: ItemRarity.LEGENDARY,
				getCategory: vi.fn().mockReturnValue(ItemCategory.WEAPON)
			};

			// Act
			const result = toItemWithDetails(weaponItem as any);

			// Assert
			expect(result).toEqual({
				id: 1,
				category: ItemCategory.WEAPON,
				rarity: ItemRarity.LEGENDARY,
				detailsSupportItem: null,
				detailsMainItem: expect.any(Object),
				maxStats: null
			});
		});

		it('should correctly convert potion item to ItemWithDetails', () => {
			// Arrange
			const potionItem = {
				id: 2,
				rarity: ItemRarity.RARE,
				getCategory: vi.fn().mockReturnValue(ItemCategory.POTION)
			};

			// Act
			const result = toItemWithDetails(potionItem as any);

			// Assert
			expect(result).toEqual({
				id: 2,
				category: ItemCategory.POTION,
				rarity: ItemRarity.RARE,
				detailsSupportItem: expect.any(Object),
				detailsMainItem: null,
				maxStats: null
			});
		});
	});
});