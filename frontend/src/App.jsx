import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminDashboardPage } from "./components/AdminDashboardPage.jsx";
import { AuthPage } from "./components/AuthPage.jsx";
import { CollectionPage } from "./components/CollectionPage.jsx";
import { categoryPages, pageMeta } from "./data/dashboard-meta.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { useIdleLogout } from "./hooks/useIdleLogout.js";
import { clearFirebaseSession, loginUser, signUpUser } from "./lib/auth-service.js";
import {
  getDisplayedConsentCount,
  getDisplayedSessionCount,
  getFilteredLocations,
  sumBodyParts,
} from "./lib/dashboard-selectors.js";
import { createLegacyAdjustment } from "./lib/legacy-adjustments-service.js";

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

export default function App() {
  const [view, setView] = useState(getViewFromLocation());
  const [pageKey, setPageKey] = useState(getPageKeyFromLocation());
  const [authProfile, setAuthProfile] = useState(() => readJsonFromStorage(AUTH_PROFILE_KEY));
  const [authSession, setAuthSession] = useState(() => readJsonFromStorage(AUTH_ADMIN_SESSION_KEY));
  const [collectorSession, setCollectorSession] = useState(() =>
    readJsonFromStorage(AUTH_COLLECTOR_SESSION_KEY),
  );
  const [authNotice, setAuthNotice] = useState("");
  const [adjustmentDrawerOpen, setAdjustmentDrawerOpen] = useState(false);
  const [adjustmentSubmitting, setAdjustmentSubmitting] = useState(false);
  const { data, loading, refresh } = useDashboardData();

  const sessionRoles = getSessionRoles(authSession);
  const hasAdminSession = sessionRoles.includes("admin");
  const isCollectorSession = Boolean(collectorSession);

  useEffect(() => {
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
    if (!authSession) {
      return;
    }

    if (!hasAdminSession) {
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
  }, [authSession, hasAdminSession, view]);

  useEffect(() => {
    if (hasAdminSession) {
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
  }, [collectorSession, hasAdminSession, view]);

  const dashboardData = data ?? {
    source: "loading",
    updatedAt: "",
    locations: [],
    recentAdjustments: [],
  };

  const currentPage = pageMeta[pageKey] || pageMeta.main;
  const pageLocationName = categoryPages[pageKey]?.matchName;

  const filteredLocations = useMemo(
    () => getFilteredLocations(dashboardData.locations, pageLocationName),
    [dashboardData.locations, pageLocationName],
  );

  const displayedConsentCount = useMemo(
    () => getDisplayedConsentCount(filteredLocations),
    [filteredLocations],
  );
  const displayedSessionCount = useMemo(
    () => getDisplayedSessionCount(filteredLocations),
    [filteredLocations],
  );
  const displayedBodyParts = useMemo(() => sumBodyParts(filteredLocations), [filteredLocations]);

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
        result.message || "회원가입이 완료되었습니다. 같은 정보로 로그인하면 수집 화면으로 이동합니다.",
      );
      setView("login");
      navigateTo({ view: "login" });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "회원가입 처리 중 알 수 없는 오류가 발생했습니다.",
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
      const nextSessionRoles = getSessionRoles(session);

      if (mode === "admin-login" && !nextSessionRoles.includes("admin")) {
        return {
          ok: false,
          message: "관리자 대시보드는 관리자 계정으로만 접근 가능합니다.",
        };
      }

      if (mode !== "admin-login" && !nextSessionRoles.includes("collector")) {
        return {
          ok: false,
          message: "이 계정은 일반 수집 권한이 없습니다. 관리자 로그인을 사용해 주세요.",
        };
      }

      setAuthNotice("");
      window.localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(session));
      setAuthProfile(session);

      if (mode === "admin-login") {
        const adminSession = { ...session, role: "admin", roles: nextSessionRoles };
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
          role: nextSessionRoles.includes("collector") ? "collector" : session.role,
          roles: nextSessionRoles,
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
        message: error?.message || "로그인 처리 중 알 수 없는 오류가 발생했습니다.",
      };
    }
  }

  function handleNavigatePage(nextPageKey) {
    setPageKey(nextPageKey);
    setView("dashboard");
    navigateTo({ page: nextPageKey });
  }

  const handleAdminLogout = useCallback(async () => {
    await clearFirebaseSession().catch(() => {});
    window.localStorage.removeItem(AUTH_ADMIN_SESSION_KEY);
    setAuthSession(null);
    setAdjustmentDrawerOpen(false);
    setView("login");
    navigateTo({ view: "login" });
  }, []);

  const handleCollectorLogout = useCallback(async () => {
    await clearFirebaseSession().catch(() => {});
    window.localStorage.removeItem(AUTH_COLLECTOR_SESSION_KEY);
    setCollectorSession(null);
    setView("login");
    navigateTo({ view: "login" });
  }, []);

  const logoutCountdownLabel = useIdleLogout({
    enabled: isCollectorSession,
    onLogout: handleCollectorLogout,
  });

  const handleSubmitAdjustment = useCallback(
    async (form) => {
      setAdjustmentSubmitting(true);

      try {
        await createLegacyAdjustment({
          adminSession: authSession,
          location: form.location,
          bodyPartKey: form.bodyPartKey,
          sessionDelta: form.sessionDelta,
          consentDelta: form.consentDelta,
          note: form.note,
          targetUser: form.targetUser,
        });
        await refresh();
      } finally {
        setAdjustmentSubmitting(false);
      }
    },
    [authSession, refresh],
  );

  useEffect(() => {
    if (hasAdminSession) {
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
  }, [collectorSession, currentPage.title, hasAdminSession, view]);

  if (hasAdminSession) {
    return (
      <AdminDashboardPage
        currentPage={currentPage}
        pageKey={pageKey}
        displayedSessionCount={displayedSessionCount}
        displayedConsentCount={displayedConsentCount}
        filteredLocations={filteredLocations}
        dashboardData={dashboardData}
        displayedBodyParts={displayedBodyParts}
        loading={loading}
        onNavigatePage={handleNavigatePage}
        onLogout={handleAdminLogout}
        adjustmentDrawerOpen={adjustmentDrawerOpen}
        onOpenAdjustmentDrawer={() => setAdjustmentDrawerOpen(true)}
        onCloseAdjustmentDrawer={() => setAdjustmentDrawerOpen(false)}
        onSubmitAdjustment={handleSubmitAdjustment}
        adjustmentSubmitting={adjustmentSubmitting}
      />
    );
  }

  if (collectorSession) {
    return (
      <CollectionPage
        session={collectorSession}
        profile={authProfile}
        onLogout={handleCollectorLogout}
        logoutCountdownLabel={logoutCountdownLabel}
      />
    );
  }

  return (
    <AuthPage mode={view} notice={authNotice} onLogin={handleLogin} onSignup={handleSignup} />
  );
}
