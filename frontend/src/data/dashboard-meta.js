// 페이지/지점 메타데이터를 한 곳에서 관리하는 설정 파일임.
export const pageMeta = {
  main: {
    title: "전체",
    description: "개인정보 동의 인원, 세션 건수, 부위별 수집 현황을 통합 확인하는 관리자 화면임.",
  },
  jangdeok: {
    title: "이끌림(장덕)",
    description: "이끌림(장덕) 지점 수집 현황만 별도로 확인하는 관리자 화면임.",
  },
  hyocheon: {
    title: "이끌림(효천점)",
    description: "이끌림(효천점) 지점 수집 현황만 별도로 확인하는 관리자 화면임.",
  },
  company: {
    title: "AIM",
    description: "AIM 지점 수집 현황만 별도로 확인하는 관리자 화면임.",
  },
};

export const categoryPages = {
  main: { label: "전체", href: "/?page=main", matchName: null },
  company: { label: "AIM", href: "/?page=company", matchName: "회사" },
  jangdeok: {
    label: "이끌림(장덕)",
    href: "/?page=jangdeok",
    matchName: "필라테스 이끌림 장덕점",
  },
  hyocheon: {
    label: "이끌림(효천점)",
    href: "/?page=hyocheon",
    matchName: "필라테스 이끌림 효천점",
  },
};

export const bodyPartMeta = [
  { key: "Neck", label: "목", className: "body-part-card body-part-card--neck" },
  { key: "Hip", label: "허리", className: "body-part-card body-part-card--hip" },
  { key: "LeftShoulder", label: "왼쪽 어깨", className: "body-part-card body-part-card--left-shoulder" },
  { key: "RightShoulder", label: "오른쪽 어깨", className: "body-part-card body-part-card--right-shoulder" },
  { key: "LeftKnee", label: "왼쪽 무릎", className: "body-part-card body-part-card--left-knee" },
  { key: "RightKnee", label: "오른쪽 무릎", className: "body-part-card body-part-card--right-knee" },
];

// 도넛 그래프 색상 고정 배열임.
export const donutColors = [
  "rgb(255, 99, 132)",
  "rgb(54, 162, 235)",
  "rgb(75, 192, 192)",
  "rgb(255, 159, 64)",
];
