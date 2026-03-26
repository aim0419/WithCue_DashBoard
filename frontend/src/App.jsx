import { useEffect, useMemo, useState } from "react";
import { AuthPage } from "./components/AuthPage.jsx";
import { BodyMapPanel } from "./components/BodyMapPanel.jsx";
import { CategoryCard } from "./components/CategoryCard.jsx";
import { CollectionPage } from "./components/CollectionPage.jsx";
import { SummaryPanel } from "./components/SummaryPanel.jsx";
import { categoryPages, pageMeta } from "./data/dashboard-meta.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { clearFirebaseSession, loginUser, signUpUser } from "./lib/auth-service.js";

// 관리자 세션과 수집 세션을 분리 보관해 화면 전환 기준을 단순화한 구조임.
const AUTH_PROFILE_KEY = "withcue-auth-profile";
const AUTH_ADMIN_SESSION_KEY = "withcue-admin-session";
const AUTH_COLLECTOR_SESSION_KEY = "withcue-collector-session";

function getSessionRoles(session) {
  if (Array.isArray(session?.roles) && session.roles.length > 0) {
    return session.roles;
  }

  if (session?.role === "admin") {
    return ["admin"];
  }

  if (session?.role === "collector") {
    return ["collector"];
  }

  return [];
}

function getViewFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "login";
  return ["dashboard", "login", "signup", "admin-login", "collect"].includes(view)
    ? view
    : "login";
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
  const params = new URLSearchParams(paramsObject);
  window.history.replaceState({}, "", `/?${params.toString()}`);
}

function sumBodyParts(locations) {
  // 대시보드 바디맵은 현재 페이지 기준 문서를 먼저 합산한 뒤 렌더링하는 구조임.
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
  const [collectorSession, setCollectorSession] = useState(() =>
    readJsonFromStorage(AUTH_COLLECTOR_SESSION_KEY),
  );
  const [authNotice, setAuthNotice] = useState("");
  const { data, loading } = useDashboardData();

  useEffect(() => {
    // 브라우저 뒤로가기나 수동 주소 변경이 있어도 화면 상태를 URL 기준으로 복원하는 처리임.
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
    // 관리자 세션이 남아 있으면 인증 화면 대신 대시보드로 고정하는 처리임.
    if (!authSession) {
      return;
    }

    if (!getSessionRoles(authSession).includes("admin")) {
      window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
      setAuthSession(null);
      setView("login");
      navigateTo({ view: "login" });
      return;
    }

    if (["login", "signup", "admin-login", "collect"].includes(view)) {
      setView("dashboard");
      setPageKey("main");
      navigateTo({ page: "main" });
    }
  }, [authSession, view]);

  useEffect(() => {
    // 수집 세션은 별도 화면으로 유지하고 세션이 없는데 collect 경로만 남아 있으면 로그인 화면으로 되돌리는 처리임.
    if (getSessionRoles(authSession).includes("admin")) {
      return;
    }

    if (!collectorSession && view === "collect") {
      setView("login");
      navigateTo({ view: "login" });
      return;
    }

    if (collectorSession && ["login", "signup", "admin-login"].includes(view)) {
      setView("collect");
      navigateTo({ view: "collect" });
    }
  }, [authSession, collectorSession, view]);

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
      const result = await signUpUser(form);

      if (!result.ok) {
        return result;
      }

      const profile = result.profile;
      window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
      setAuthProfile(profile);
      setAuthNotice(
        result.message || "회원가입이 완료됐음. 같은 정보로 로그인하면 수집 화면으로 이동함.",
      );
      setView("login");
      navigateTo({ view: "login" });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "회원가입 처리 중 알 수 없는 오류가 발생했음.",
      };
    }
  }

  async function handleLogin(form, mode) {
    try {
      const result = await loginUser(form);

      if (!result.ok) {
        return result;
      }

      const session = result.session;
      const sessionRoles = getSessionRoles(session);

      if (mode === "admin-login" && !sessionRoles.includes("admin")) {
        return {
          ok: false,
          message: "관리자 대시보드는 관리자 계정으로만 접근 가능함.",
        };
      }

      if (mode !== "admin-login" && !sessionRoles.includes("collector")) {
        return {
          ok: false,
          message: "이 계정은 일반 수집 권한이 없음. 관리자 로그인을 사용해야 함.",
        };
      }

      setAuthNotice("");
      window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(session));
      setAuthProfile(session);

      if (mode === "admin-login") {
        const adminSession = { ...session, role: "admin", roles: sessionRoles };
        window.localStorage.setItem(AUTH_ADMIN_SESSION_KEY, JSON.stringify(adminSession));
        window.localStorage.removeItem(AUTH_COLLECTOR_SESSION_KEY);
        setCollectorSession(null);
        setAuthSession(adminSession);
        setView("dashboard");
        setPageKey("main");
        navigateTo({ page: "main" });
      } else {
        const collectorSessionData = {
          ...session,
          role: sessionRoles.includes("collector") ? "collector" : session.role,
          roles: sessionRoles,
        };
        window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
        window.localStorage.setItem(
          AUTH_COLLECTOR_SESSION_KEY,
          JSON.stringify(collectorSessionData),
        );
        setAuthSession(null);
        setCollectorSession(collectorSessionData);
        setView("collect");
        navigateTo({ view: "collect" });
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "로그인 처리 중 알 수 없는 오류가 발생했음.",
      };
    }
  }

  function handleNavigatePage(nextPageKey) {
    // 카테고리 전환은 새로고침 없이 URL과 화면 상태를 같이 갱신하는 처리임.
    setPageKey(nextPageKey);
    setView("dashboard");
    navigateTo({ page: nextPageKey });
  }

  async function handleAdminLogout() {
    await clearFirebaseSession().catch(() => {});
    window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
    setAuthSession(null);
    setView("login");
    navigateTo({ view: "login" });
  }

  async function handleCollectorLogout() {
    await clearFirebaseSession().catch(() => {});
    window.localStorage.removeItem(AUTH_COLLECTOR_SESSION_KEY);
    setCollectorSession(null);
    setView("login");
    navigateTo({ view: "login" });
  }

  useEffect(() => {
    // 문서 제목을 현재 사용자 흐름에 맞춰 로그인, 수집, 대시보드 상태로 구분하는 처리임.
    if (getSessionRoles(authSession).includes("admin")) {
      document.title = `WithCue 관리자 대시보드 - ${currentPage.title}`;
      return;
    }

    if (collectorSession) {
      document.title = "WithCue 데이터 수집";
      return;
    }

    if (view === "signup") {
      document.title = "WithCue 데이터 수집 - 회원가입";
      return;
    }

    if (view === "admin-login") {
      document.title = "WithCue 관리자 대시보드 - 관리자 로그인";
      return;
    }

    document.title = "WithCue 데이터 수집 - 로그인";
  }, [authSession, collectorSession, currentPage.title, view]);

  if (getSessionRoles(authSession).includes("admin")) {
    return (
      <main className="dashboard">
        <section className="command-board">
          <header className="board-header">
            <div className="board-title board-title--compact">
              <p className="hero__description visually-hidden">{currentPage.description}</p>
            </div>
            <button type="button" className="dashboard-logout" onClick={handleAdminLogout}>
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
              데이터를 불러오는 중임.
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (collectorSession) {
    return (
      <CollectionPage
        session={collectorSession}
        profile={authProfile}
        onLogout={handleCollectorLogout}
      />
    );
  }

  return (
    <AuthPage mode={view} notice={authNotice} onLogin={handleLogin} onSignup={handleSignup} />
  );
}
