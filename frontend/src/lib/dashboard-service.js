import { collection, getDocs } from "firebase/firestore";
import { BODY_PART_OPTIONS, LOCATION_META } from "./collection-service.js";
import { getFirebaseDb, waitForFirebaseAuthReady } from "./firebase-client.js";

const LOCATION_ORDER = ["jangdeok", "hyocheon", "aim"];

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
    SessionCount: 0,
    BodyParts: createEmptyBodyParts(),
  };
}

function createEmptyDashboardData() {
  const locations = LOCATION_ORDER.map((locationKey) => createLocationBucket(locationKey));

  return {
    source: "firebase-empty",
    updatedAt: "",
    ConsentCount: 0,
    SessionCount: 0,
    Categories: locations.map((location) => location.DisplayName),
    locations,
    recentAdjustments: [],
  };
}

function sortAdjustmentDocs(adjustmentDocs) {
  return [...adjustmentDocs].sort((leftDoc, rightDoc) => {
    const leftDate = leftDoc.data().CreatedAt?.toMillis?.() || 0;
    const rightDate = rightDoc.data().CreatedAt?.toMillis?.() || 0;
    return rightDate - leftDate;
  });
}

function aggregateDashboard(participantDocs, sessionDocs, adjustmentDocs) {
  const locationMap = new Map(
    LOCATION_ORDER.map((locationKey) => [locationKey, createLocationBucket(locationKey)]),
  );

  participantDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;

    if (!locationMap.has(locationKey)) {
      return;
    }

    locationMap.get(locationKey).ConsentCount += 1;
  });

  sessionDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;
    const bodyPartKey = data.BodyPart;

    if (!locationMap.has(locationKey)) {
      return;
    }

    const locationBucket = locationMap.get(locationKey);
    locationBucket.SessionCount += 1;

    if (Object.prototype.hasOwnProperty.call(locationBucket.BodyParts, bodyPartKey)) {
      locationBucket.BodyParts[bodyPartKey] += 1;
    }
  });

  adjustmentDocs.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const locationKey = data.Location;
    const bodyPartKey = data.BodyPart;

    if (!locationMap.has(locationKey)) {
      return;
    }

    const locationBucket = locationMap.get(locationKey);
    locationBucket.ConsentCount += Number(data.ConsentDelta || 0);
    locationBucket.SessionCount += Number(data.SessionDelta || 0);

    if (Object.prototype.hasOwnProperty.call(locationBucket.BodyParts, bodyPartKey)) {
      locationBucket.BodyParts[bodyPartKey] += Number(data.SessionDelta || 0);
    }
  });

  const locations = LOCATION_ORDER.map((locationKey) => locationMap.get(locationKey));
  const consentCount = locations.reduce((total, location) => total + location.ConsentCount, 0);
  const sessionCount = locations.reduce((total, location) => total + location.SessionCount, 0);
  const recentAdjustments = sortAdjustmentDocs(adjustmentDocs).slice(0, 5).map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  }));

  return {
    source: sessionCount || consentCount ? "firebase" : "firebase-empty",
    updatedAt: new Date().toLocaleString("ko-KR"),
    ConsentCount: consentCount,
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
    const [participantSnapshot, sessionSnapshot, adjustmentSnapshot] = await Promise.all([
      getDocs(collection(db, "locationParticipants")),
      getDocs(collection(db, "collectionSessions")),
      getDocs(collection(db, "legacyAdjustments")),
    ]);

    if (participantSnapshot.empty && sessionSnapshot.empty && adjustmentSnapshot.empty) {
      return createEmptyDashboardData();
    }

    return aggregateDashboard(
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
