import { Address, BigInt } from "@graphprotocol/graph-ts";
import { WEEK_SECONDS } from "./constants";
import { getOrCreateCauldron } from "./getOrCreateCauldron";
import { getOrCreateCauldronWeekSnapshot } from "./getOrCreateCauldronWeekSnapshot";
import { getOrCreateUser } from "./getOrCreateUser";
import { getOrCreateUserCauldronWeekSnapshot } from "./getOrCreateUserCauldronWeekSnapshot";
import { getOrCreateUserPosition } from "./getOrCreateUserPosition";

export function updateCollateral(
	userAddress: Address,
	cauldronAddress: Address,
	shareChange: BigInt,
	timestamp: BigInt,
): void {
	const cauldron = getOrCreateCauldron(cauldronAddress);
	const cauldronWeekSnapshot = getOrCreateCauldronWeekSnapshot(
		cauldronAddress,
		timestamp,
	);

	getOrCreateUser(userAddress);
	const userPosition = getOrCreateUserPosition(userAddress, cauldronAddress);
	const userCauldronWeekSnapshot = getOrCreateUserCauldronWeekSnapshot(
		userAddress,
		cauldronAddress,
		timestamp,
	);

	// Update cumulative numbers as they need to be updated before the raw entity numbers
	// Note default updatedAt is week start
	const secondsSinceCauldronUpdatedAt = timestamp.minus(
		cauldronWeekSnapshot.updatedAt,
	);
	cauldronWeekSnapshot.preliminaryCumulativeCollateralShare =
		cauldronWeekSnapshot.preliminaryCumulativeCollateralShare.plus(
			secondsSinceCauldronUpdatedAt.times(cauldron.collateralShare),
		);

	// Note default updatedAt is week start
	const secondsSinceUserUpdatedAt = timestamp.minus(
		userCauldronWeekSnapshot.updatedAt,
	);
	userCauldronWeekSnapshot.preliminaryCumulativeCollateralShare =
		userCauldronWeekSnapshot.preliminaryCumulativeCollateralShare.plus(
			secondsSinceUserUpdatedAt.times(userPosition.collateralShare),
		);

	// Update raw entity numbers
	cauldron.collateralShare = cauldron.collateralShare.plus(shareChange);
	cauldron.save();
	userPosition.collateralShare = userPosition.collateralShare.plus(shareChange);
	userPosition.save();

	cauldronWeekSnapshot.updatedAt = timestamp;
	cauldronWeekSnapshot.latestCollateralShare = cauldron.collateralShare;

	userCauldronWeekSnapshot.updatedAt = timestamp;
	userCauldronWeekSnapshot.latestCollateralShare = userPosition.collateralShare;

	// Update time weighted average numbers
	const secondsUntilWeekEnd = cauldronWeekSnapshot.weekStartTimestamp
		.plus(WEEK_SECONDS)
		.minus(timestamp);

	cauldronWeekSnapshot.expectedTimeWeightedAverageCollateralShare =
		cauldronWeekSnapshot.preliminaryCumulativeCollateralShare
			.plus(cauldron.collateralShare.times(secondsUntilWeekEnd)) // Add remaining cumulative share until EOW
			.div(WEEK_SECONDS);
	cauldronWeekSnapshot.save();

	userCauldronWeekSnapshot.expectedTimeWeightedAverageCollateralShare =
		userCauldronWeekSnapshot.preliminaryCumulativeCollateralShare
			.plus(userPosition.collateralShare.times(secondsUntilWeekEnd)) // Add remaining cumulative share until EOW
			.div(WEEK_SECONDS);
	userCauldronWeekSnapshot.save();
}
