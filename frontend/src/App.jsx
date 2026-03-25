import { useEffect, useMemo, useState } from "react";
import { AuthPage } from "./components/AuthPage.jsx";
import { BodyMapPanel } from "./components/BodyMapPanel.jsx";
import { CategoryCard } from "./components/CategoryCard.jsx";
import { SummaryPanel } from "./components/SummaryPanel.jsx";
import { categoryPages, pageMeta } from "./data/dashboard-meta.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { loginUser, signUpUser } from "./lib/auth-service.js";

// 로컬 저장소에는 화면 복원에 필요한 최소 인증 정보만 보관한다.
const AUTH_PROFILE_KEY = "withcue-auth-profile";
const AUTH_ADMIN_SESSION_KEY = "withcue-admin-session";

function getViewFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "login";
  return ["dashboard", "login", "signup", "admin-login"].includes(view) ? view : "login";
}

function getPageKeyFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page") || "main";
  return pageMeta[page] ? page : "main";
}

function readJsonFromStorage(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function navigateTo(paramsObject) {
  // 내부 이동은 전체 새로고침 없이 주소만 바꿔서 현재 상태를 유지한다.
  const params = new URLSearchParams(paramsObject);
  window.history.replaceState({}, "", `/?${params.toString()}`);
}

function buildCollectionAppUrl(session) {
  // 수집 사용자는 촬영에 필요한 최소 정보만 들고 로컬 Flask 앱으로 이동한다.
  const params = new URLSearchParams();
  params.set("site", session?.location || "aim");

  if (session?.name) {
    params.set("name", session.name);
  }

  if (session?.birthDate) {
    params.set("birthDate", String(session.birthDate));
  }

  if (session?.gender) {
    params.set("gender", session.gender);
  }

  return `http://127.0.0.1:5000/?${params.toString()}`;
}

function sumBodyParts(locations) {
  // 바디맵은 항상 하나의 합산 객체를 받으므로 현재 페이지 기준 수치를 먼저 모은다.
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

export default function App() {
  const [view, setView] = useState(getViewFromLocation());
  const [pageKey, setPageKey] = useState(getPageKeyFromLocation());
  const [authProfile, setAuthProfile] = useState(() => readJsonFromStorage(AUTH_PROFILE_KEY));
  const [authSession, setAuthSession] = useState(() => readJsonFromStorage(AUTH_ADMIN_SESSION_KEY));
  const [authNotice, setAuthNotice] = useState("");
  const { data, loading } = useDashboardData();

  useEffect(() => {
    // 브라우저 뒤로가기나 주소 직접 수정이 있어도 React 상태를 같은 위치로 맞춘다.
    const handleLocationChange = () => {
      setView(getViewFromLocation());
      setPageKey(getPageKeyFromLocation());
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    // 대시보드 경로에는 관리자 세션만 남아 있도록 제한한다.
    if (!authSession) {
      if (view === "dashboard") {
        setView("login");
        navigateTo({ view: "login" });
      }
      return;
    }

    if (authSession.role !== "admin") {
      window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
      setAuthSession(null);
      setView("login");
      navigateTo({ view: "login" });
      return;
    }

    if (view === "login" || view === "signup" || view === "admin-login") {
      setView("dashboard");
      navigateTo({ page: "main" });
    }
  }, [authSession, view]);

  const dashboardData = data ?? {
    source: "loading",
    updatedAt: "",
    locations: [],
  };

  const currentPage = pageMeta[pageKey] || pageMeta.main;
  const pageLocationName = categoryPages[pageKey]?.matchName;

  const filteredLocations = useMemo(() => {
    if (!dashboardData.locations) {
      return [];
    }

    return pageLocationName
      ? dashboardData.locations.filter((location) => location.Name === pageLocationName)
      : dashboardData.locations;
  }, [dashboardData.locations, pageLocationName]);

  const displayedConsentCount = filteredLocations.reduce(
    (total, location) => total + Number(location.ConsentCount || 0),
    0,
  );

  const displayedSessionCount = filteredLocations.reduce(
    (total, location) => total + Number(location.SessionCount || 0),
    0,
  );

  const displayedBodyParts = sumBodyParts(filteredLocations);

  async function handleSignup(form) {
    try {
      // 회원가입은 Firestore에 저장한 뒤 일반 로그인 화면으로 다시 돌려보낸다.
      const result = await signUpUser(form);

      if (!result.ok) {
        return result;
      }

      const profile = result.profile;
      window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
      setAuthProfile(profile);
      setAuthNotice(result.message || "회원가입이 완료되었습니다. 같은 정보로 로그인해 주세요.");
      setView("login");
      navigateTo({ view: "login" });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "회원가입 중 오류가 발생했습니다.",
      };
    }
  }

  async function handleLogin(form, mode) {
    try {
      // 로그인은 Firestore 기준으로 확인해서 배포 환경에서도 로컬 가입 기록에 의존하지 않는다.
      const result = await loginUser(form);

      if (!result.ok) {
        return result;
      }

      const session = result.session;

      if (mode === "admin-login" && session.role !== "admin") {
        return {
          ok: false,
          message: "관리자 계정만 대시보드에 접근할 수 있습니다.",
        };
      }

      setAuthNotice("");

      if (session.role === "admin") {
        window.localStorage.setItem(AUTH_ADMIN_SESSION_KEY, JSON.stringify(session));
        setAuthSession(session);
        setView("dashboard");
        setPageKey("main");
        navigateTo({ page: "main" });
      } else {
        // 수집 사용자는 SPA에 머물지 않고 곧바로 로컬 촬영 페이지로 이동한다.
        window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
        setAuthSession(null);
        setView("login");
        navigateTo({ view: "login" });
        window.location.assign(buildCollectionAppUrl(session));
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "로그인 중 오류가 발생했습니다.",
      };
    }
  }

  function handleNavigatePage(nextPageKey) {
    // 카테고리 전환은 즉시 반응해야 하고 인증 상태도 그대로 유지되어야 한다.
    setPageKey(nextPageKey);
    setView("dashboard");
    navigateTo({ page: nextPageKey });
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
    setAuthSession(null);
    setView("login");
    navigateTo({ view: "login" });
  }

  useEffect(() => {
    // 로그인, 회원가입, 관리자 로그인, 대시보드별로 탭 제목을 읽기 쉽게 맞춘다.
    if (!authSession) {
      if (view === "login") {
        document.title = "WithCue 관리자 대시보드 - 로그인";
        return;
      }

      if (view === "signup") {
        document.title = "WithCue 관리자 대시보드 - 회원가입";
        return;
      }

      if (view === "admin-login") {
        document.title = "WithCue 관리자 대시보드 - 관리자 로그인";
        return;
      }
    }

    document.title = `WithCue 관리자 대시보드 - ${currentPage.title}`;
  }, [authSession, currentPage.title, view]);

  if (!authSession) {
    return (
      <AuthPage
        mode={view}
        notice={authNotice}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    );
  }

  return (
    <main className="dashboard">
      <section className="command-board">
        <header className="board-header">
          <div className="board-title board-title--compact">
            <p className="hero__description visually-hidden">{currentPage.description}</p>
          </div>
          <button type="button" className="dashboard-logout" onClick={handleLogout}>
            로그아웃
          </button>
        </header>

        <section className="board-layout">
          <aside className="info-panel">
            <SummaryPanel
              pageKey={pageKey}
              displayedSessionCount={displayedSessionCount}
              displayedConsentCount={displayedConsentCount}
              locations={filteredLocations}
              data={dashboardData}
            />
            <CategoryCard pageKey={pageKey} onNavigatePage={handleNavigatePage} />
          </aside>

          <BodyMapPanel bodyParts={displayedBodyParts} />
        </section>

        {loading ? (
          <div className="visually-hidden" aria-live="polite">
            데이터를 불러오는 중입니다.
          </div>
        ) : null}
      </section>
    </main>
  );
}
