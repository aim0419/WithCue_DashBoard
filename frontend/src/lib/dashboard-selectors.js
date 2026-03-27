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

// 지점별 동의 인원 수를 합산함.
export function getDisplayedConsentCount(locations) {
  return locations.reduce((total, location) => total + Number(location.ConsentCount || 0), 0);
}

// 지점별 세션 건수를 합산함.
export function getDisplayedSessionCount(locations) {
  return locations.reduce((total, location) => total + Number(location.SessionCount || 0), 0);
}

// 바디맵에서 쓸 부위별 수치를 한 번에 합산함.
export function sumBodyParts(locations) {
  return locations.reduce(
    (totals, location) => {
      totals.Neck += Number(location.BodyParts?.Neck || 0);
      totals.Hip += Number(location.BodyParts?.Hip || 0);
      totals.LeftShoulder += Number(location.BodyParts?.LeftShoulder || 0);
      totals.RightShoulder += Number(location.BodyParts?.RightShoulder || 0);
      totals.LeftKnee += Number(location.BodyParts?.LeftKnee || 0);
      totals.RightKnee += Number(location.BodyParts?.RightKnee || 0);
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
