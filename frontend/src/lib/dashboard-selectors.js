// 현재 페이지 기준으로 보여줄 지점 목록을 고름.
export function getFilteredLocations(locations, pageLocationName) {
  if (!Array.isArray(locations)) {
    return [];
  }

  if (!pageLocationName) {
    return locations;
  }

  return locations.filter((location) => location.Name === pageLocationName);
}

function countUniqueConsentUsers(locations) {
  const uniqueUserIds = new Set();

  locations.forEach((location) => {
    (location?.ConsentUserIds || []).forEach((userId) => {
      if (userId) {
        uniqueUserIds.add(userId);
      }
    });
  });

  return uniqueUserIds.size;
}

function getSelectedVariant(location, postureType) {
  if (postureType === "correct" || postureType === "incorrect") {
    return location?.Variants?.[postureType] || {
      ConsentCount: 0,
      SessionCount: 0,
      BodyParts: {},
    };
  }

  return {
    ConsentCount: Number(location?.ConsentCount || 0),
    SessionCount: Number(location?.SessionCount || 0),
    BodyParts: location?.BodyParts || {},
  };
}

// 선택된 자세 필터 기준으로 동의 인원을 합산.
export function getDisplayedConsentCount(locations, overallConsentUserIds = null) {
  if (Array.isArray(overallConsentUserIds)) {
    return new Set(overallConsentUserIds.filter(Boolean)).size;
  }

  return countUniqueConsentUsers(locations);
}

// 선택된 자세 필터 기준으로 세션 건수를 합산.
export function getDisplayedSessionCount(locations, postureType = "all") {
  return locations.reduce(
    (total, location) => total + Number(getSelectedVariant(location, postureType).SessionCount || 0),
    0,
  );
}

// 바디맵에 보여줄 부위별 수치를 한 번에 합산.
export function sumBodyParts(locations, postureType = "all") {
  return locations.reduce(
    (totals, location) => {
      const bodyParts = getSelectedVariant(location, postureType).BodyParts || {};
      totals.Neck += Number(bodyParts.Neck || 0);
      totals.Hip += Number(bodyParts.Hip || 0);
      totals.LeftShoulder += Number(bodyParts.LeftShoulder || 0);
      totals.RightShoulder += Number(bodyParts.RightShoulder || 0);
      totals.LeftKnee += Number(bodyParts.LeftKnee || 0);
      totals.RightKnee += Number(bodyParts.RightKnee || 0);
      return totals;
    },
    {
      Neck: 0,
      Hip: 0,
      LeftShoulder: 0,
      RightShoulder: 0,
      LeftKnee: 0,
      RightKnee: 0,
    },
  );
}
