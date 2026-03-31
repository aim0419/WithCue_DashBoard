import { collection, getDocs } from "firebase/firestore";
import { BODY_PART_OPTIONS, LOCATION_META } from "./collection-service.js";
import { getFirebaseDb, waitForFirebaseAuthReady } from "./firebase-client.js";

const LOCATION_ORDER = ["jangdeok", "hyocheon", "aim"];
const POSTURE_TYPES = ["all", "correct", "incorrect"];

function createEmptyBodyParts() {
  return BODY_PART_OPTIONS.reduce((accumulator, bodyPart) => {
    accumulator[bodyPart.key] = 0;
    return accumulator;
  }, {});
}

function createLocationBucket(locationKey) {
  const locationMeta = LOCATION_META[locationKey];

  return {
    id: locationMeta.docId,
    Name: locationMeta.name,
    DisplayName: locationMeta.displayName,
    ConsentCount: 0,
    ConsentUserIds: [],
    SessionCount: 0,
    BodyParts: createEmptyBodyParts(),
    Variants: POSTURE_TYPES.reduce((accumulator, postureType) => {
      accumulator[postureType] = {
        ConsentCount: 0,
        SessionCount: 0,
        BodyParts: createEmptyBodyParts(),
      };
      return accumulator;
    }, {}),
  };
}

function createEmptyDashboardData() {
  const locations = LOCATION_ORDER.map((locationKey) => createLocationBucket(locationKey));

  return {
    source: "firebase-empty",
    updatedAt: "",
    ConsentCount: 0,
    ConsentUserIds: [],
    SessionCount: 0,
    Categories: locations.map((location) => location.DisplayName),
    locations,
    recentAdjustments: [],
  };
}

function normalizePostureType(value) {
  return value === "incorrect" ? "incorrect" : "correct";
}

function incrementSession(locationBucket, postureType, bodyPartKey, amount) {
  locationBucket.SessionCount += amount;
  locationBucket.Variants.all.SessionCount += amount;
  locationBucket.Variants[postureType].SessionCount += amount;

  if (Object.prototype.hasOwnProperty.call(locationBucket.BodyParts, bodyPartKey)) {
    locationBucket.BodyParts[bodyPartKey] += amount;
    locationBucket.Variants.all.BodyParts[bodyPartKey] += amount;
    locationBucket.Variants[postureType].BodyParts[bodyPartKey] += amount;
  }
}

function sortAdjustmentDocs(adjustmentDocs) {
  return [...adjustmentDocs].sort((leftDoc, rightDoc) => {
    const leftDate = leftDoc.data().CreatedAt?.toMillis?.() || 0;
    const rightDate = rightDoc.data().CreatedAt?.toMillis?.() || 0;
    return rightDate - leftDate;
  });
}

function addConsentUserId(locationBucket, userId) {
  if (!userId) {
    return;
  }

  if (!locationBucket._consentUserIds) {
    locationBucket._consentUserIds = new Set();
  }

  locationBucket._consentUserIds.add(userId);
}

function aggregateDashboard(userDocs, participantDocs, sessionDocs, adjustmentDocs) {
  const locationMap = new Map(
    LOCATION_ORDER.map((locationKey) => [locationKey, createLocationBucket(locationKey)]),
  );
  const consentedUserIds = new Set();

  userDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();

    if (data.ConsentAgreed === true) {
      consentedUserIds.add(snapshotDoc.id);
    }
  });

  participantDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;

    if (!locationMap.has(locationKey)) {
      return;
    }

    if (consentedUserIds.has(data.UserId)) {
      addConsentUserId(locationMap.get(locationKey), data.UserId);
    }
  });

  sessionDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;
    const bodyPartKey = data.BodyPart;
    const postureType = normalizePostureType(data.PostureType);

    if (!locationMap.has(locationKey)) {
      return;
    }

    const locationBucket = locationMap.get(locationKey);
    incrementSession(locationBucket, postureType, bodyPartKey, 1);
  });

  adjustmentDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;
    const bodyPartKey = data.BodyPart;
    const postureType = normalizePostureType(data.PostureType);
    const sessionDelta = Number(data.SessionDelta || 0);

    if (!locationMap.has(locationKey)) {
      return;
    }

    const locationBucket = locationMap.get(locationKey);
    incrementSession(locationBucket, postureType, bodyPartKey, sessionDelta);

    if (Number(data.ConsentDelta || 0) > 0 && data.TargetUserId) {
      consentedUserIds.add(data.TargetUserId);
      addConsentUserId(locationBucket, data.TargetUserId);
    }
  });

  const locations = LOCATION_ORDER.map((locationKey) => {
    const locationBucket = locationMap.get(locationKey);
    const consentUserIds = [...(locationBucket._consentUserIds || new Set())];
    const consentCount = consentUserIds.length;

    locationBucket.ConsentUserIds = consentUserIds;
    locationBucket.ConsentCount = consentCount;
    locationBucket.Variants.all.ConsentCount = consentCount;
    locationBucket.Variants.correct.ConsentCount = consentCount;
    locationBucket.Variants.incorrect.ConsentCount = consentCount;
    delete locationBucket._consentUserIds;

    return locationBucket;
  });

  const consentCount = consentedUserIds.size;
  const sessionCount = locations.reduce((total, location) => total + location.SessionCount, 0);
  const recentAdjustments = sortAdjustmentDocs(adjustmentDocs).slice(0, 5).map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  }));

  return {
    source: sessionCount || consentCount ? "firebase" : "firebase-empty",
    updatedAt: new Date().toLocaleString("ko-KR"),
    ConsentCount: consentCount,
    ConsentUserIds: [...consentedUserIds],
    SessionCount: sessionCount,
    Categories: locations.map((location) => location.DisplayName),
    locations,
    recentAdjustments,
  };
}

export async function getDashboardData() {
  try {
    await waitForFirebaseAuthReady();

    const db = getFirebaseDb();
    const [userSnapshot, participantSnapshot, sessionSnapshot, adjustmentSnapshot] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "locationParticipants")),
      getDocs(collection(db, "collectionSessions")),
      getDocs(collection(db, "legacyAdjustments")),
    ]);

    if (
      userSnapshot.empty &&
      participantSnapshot.empty &&
      sessionSnapshot.empty &&
      adjustmentSnapshot.empty
    ) {
      return createEmptyDashboardData();
    }

    return aggregateDashboard(
      userSnapshot.docs,
      participantSnapshot.docs,
      sessionSnapshot.docs,
      adjustmentSnapshot.docs,
    );
  } catch (error) {
    return {
      ...createEmptyDashboardData(),
      source: "firebase-error",
      errorMessage: error.message,
      errorCode: error.code || "",
    };
  }
}
