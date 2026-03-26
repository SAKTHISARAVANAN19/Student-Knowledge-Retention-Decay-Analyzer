import { useCallback, useEffect, useState } from "react";
import loginLogoDarkMode from "./login-logo-dark-mode.png";

const API_URL = "http://localhost:5000";
const COURSES = [
  "Artificial Intelligence",
  "Machine Learning",
  "Computer Networks",
  "DBMS",
  "Cloud Computing",
];

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const savedUser = window.sessionStorage.getItem("skrda_user");
    if (!savedUser) return null;
    const parsedUser = JSON.parse(savedUser);
    if (parsedUser?.id && parsedUser?.name && parsedUser?.email) {
      return parsedUser;
    }
  } catch (_) {
    window.sessionStorage.removeItem("skrda_user");
  }
  return null;
}

function App() {
  const storedUser = getStoredUser();
  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [user, setUser] = useState(storedUser);
  const [mode, setMode] = useState("login");
  const [view, setView] = useState("home");
  const [recordsCourseFilter, setRecordsCourseFilter] = useState("");
  const [recordsLevelFilter, setRecordsLevelFilter] = useState("");
  const [recordsStudentFilter, setRecordsStudentFilter] = useState("");
  const [recordsFromDate, setRecordsFromDate] = useState("");
  const [recordsToDate, setRecordsToDate] = useState("");
  const [analyzerCourse, setAnalyzerCourse] = useState("");
  const [customAnalyzerCourse, setCustomAnalyzerCourse] = useState("");
  const [previousMark, setPreviousMark] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [theme, setTheme] = useState("light");
  const [openRowMenuId, setOpenRowMenuId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editInitial, setEditInitial] = useState("");
  const [editFinal, setEditFinal] = useState("");

  const colors =
    theme === "dark"
      ? {
          bg: "#0b1220",
          surface: "#111827",
          panel: "#1f2937",
          border: "#334155",
          text: "#e5e7eb",
          muted: "#94a3b8",
          brand: "#7c3aed",
          brandText: "#ffffff",
          danger: "#fca5a5",
          success: "#86efac",
          active: "#334155",
        }
      : {
          bg: "#f3f4f6",
          surface: "#ffffff",
          panel: "#f8fafc",
          border: "#e5e7eb",
          text: "#111827",
          muted: "#6b7280",
          brand: "#7c3aed",
          brandText: "#ffffff",
          danger: "#b91c1c",
          success: "#166534",
          active: "#e2e8f0",
        };

  const handleSignOut = () => {
    window.sessionStorage.removeItem("skrda_user");
    setUser(null);
    setView("home");
    setUserMenuOpen(false);
  };

  const cardStyle = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "14px",
    boxShadow: theme === "dark" ? "0 10px 26px rgba(0, 0, 0, 0.35)" : "0 10px 26px rgba(15, 23, 42, 0.08)",
  };

  const authInputStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "15px",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: `1px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
  };

  const authButtonStyle = {
    width: "100%",
    padding: "10px 12px",
    fontSize: "15px",
    borderRadius: "10px",
    border: `1px solid ${colors.brand}`,
    background: colors.brand,
    color: colors.brandText,
    cursor: "pointer",
  };

  const formInputStyle = {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    background: colors.surface,
    color: colors.text,
  };

  const formSelectStyle = {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    background: colors.surface,
    color: colors.text,
  };

  const formButtonStyle = {
    width: "100%",
    padding: "12px",
    fontSize: "16px",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: `1px solid ${colors.brand}`,
    background: colors.brand,
    color: colors.brandText,
    cursor: "pointer",
  };

  const loadRecords = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        const text = String(value || "").trim();
        if (text) params.append(key, text);
      });

      const url = params.toString() ? `${API_URL}/records?${params.toString()}` : `${API_URL}/records`;
      const response = await fetch(url);
      if (!response.ok) {
        const res = await response.json();
        setError(res.error || "Failed to load records.");
        return;
      }
      const data = await response.json();
      setRecords(data);
      setError("");
    } catch (_) {
      setError("Backend not reachable. Make sure Flask is running.");
    }
  }, []);

  const loadKpis = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/dashboard-kpis`);
      if (!response.ok) return;
      const data = await response.json();
      setKpis(data);
    } catch (_) {
      // ignore KPI load failures
    }
  }, []);

  useEffect(() => {
    loadRecords({});
  }, [loadRecords]);

  useEffect(() => {
    if (user) {
      loadKpis();
    }
  }, [user, loadKpis]);

  useEffect(() => {
    if (user && view === "records") {
      loadRecords({});
    }
  }, [user, view, loadRecords]);

  const lookupExisting = async (form) => {
    const studentId = form?.student_id?.value;
    const name = form?.name?.value?.trim();
    const subject =
      analyzerCourse === "Others" ? customAnalyzerCourse.trim() : form?.subject?.value?.trim();

    if (!studentId || !subject) return;

    try {
      const response = await fetch(
        `${API_URL}/records/lookup?student_id=${studentId}&name=${encodeURIComponent(
          name || ""
        )}&subject=${encodeURIComponent(subject)}`
      );
      const res = await response.json();

      if (response.ok && res.exists) {
        setPreviousMark(String(res.previous_mark));
        setAutoFilled(true);
        setError("");
      } else if (response.status === 409) {
        setError(res.error || "Student ID already exists with a different name.");
      } else {
        setPreviousMark("");
        setAutoFilled(false);
      }
    } catch (_) {
      // ignore
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    const data = {
      student_id: e.target.student_id.value,
      name: e.target.name.value.trim(),
      subject: analyzerCourse === "Others" ? customAnalyzerCourse.trim() : e.target.subject.value.trim(),
      initial: previousMark !== "" ? previousMark : e.target.initial.value,
      final: e.target.final.value,
    };

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const res = await response.json();
      if (!response.ok) {
        setError(res.error || "Request failed.");
        return;
      }

      setResult(res);
      loadRecords();
      loadKpis();
      e.target.reset();
      setAnalyzerCourse("");
      setCustomAnalyzerCourse("");
      setPreviousMark("");
      setAutoFilled(false);
    } catch (_) {
      setError("Backend not reachable. Make sure Flask is running.");
    }
  };

  const getActiveRecordFilters = () => ({
    course: recordsCourseFilter,
    level: recordsLevelFilter,
    student: recordsStudentFilter,
    from_date: recordsFromDate,
    to_date: recordsToDate,
  });

  const openEditRecordModal = (record) => {
    setEditingRecord(record);
    setEditInitial(String(record.initial));
    setEditFinal(String(record.final));
    setOpenRowMenuId(null);
  };

  const handleEditRecord = async () => {
    if (!editingRecord) return;
    const initial = Number(editInitial);
    const final = Number(editFinal);
    if (Number.isNaN(initial) || Number.isNaN(final) || initial < 1 || initial > 100 || final < 1 || final > 100) {
      setError("Marks must be numbers between 1 and 100.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/records/${editingRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial, final }),
      });
      const res = await response.json();
      if (!response.ok) {
        setError(res.error || "Failed to update record.");
        return;
      }
      setError("");
      setOpenRowMenuId(null);
      setEditingRecord(null);
      setEditInitial("");
      setEditFinal("");
      await loadRecords(getActiveRecordFilters());
      loadKpis();
    } catch (_) {
      setError("Backend not reachable. Make sure Flask is running.");
    }
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setEditInitial("");
    setEditFinal("");
  };

  const handleDeleteRecord = async (record) => {
    if (!window.confirm("Delete this record permanently?")) return;
    try {
      const response = await fetch(`${API_URL}/records/${record.id}`, {
        method: "DELETE",
      });
      const res = await response.json();
      if (!response.ok) {
        setError(res.error || "Failed to delete record.");
        return;
      }
      setError("");
      setOpenRowMenuId(null);
      await loadRecords(getActiveRecordFilters());
      loadKpis();
    } catch (_) {
      setError("Backend not reachable. Make sure Flask is running.");
    }
  };

  const sectionTitleStyle = {
    fontSize: "17px",
    fontWeight: 600,
    color: colors.text,
    marginBottom: "12px",
  };

  const mutedTextStyle = {
    color: colors.muted,
    fontSize: "14px",
    lineHeight: "1.6",
  };

  const shellBg =
    theme === "dark"
      ? "linear-gradient(180deg, #0b1220 0%, #111827 100%)"
      : "radial-gradient(circle at top, rgba(96, 165, 250, 0.14), transparent 28%), linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)";

  const shellCardStyle = {
    background: theme === "dark" ? "rgba(17, 24, 39, 0.88)" : "rgba(255, 255, 255, 0.9)",
    border: `1px solid ${colors.border}`,
    borderRadius: "18px",
    boxShadow: theme === "dark" ? "0 24px 60px rgba(0,0,0,0.35)" : "0 20px 50px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(10px)",
  };

  const navButtonStyle = (active) => ({
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    marginBottom: "10px",
    borderRadius: "12px",
    border: `1px solid ${active ? colors.brand : colors.border}`,
    background: active
      ? theme === "dark"
        ? "linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(59, 130, 246, 0.18))"
        : "linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(59, 130, 246, 0.1))"
      : colors.surface,
    color: colors.text,
    cursor: "pointer",
    fontWeight: active ? 700 : 600,
    letterSpacing: "0.2px",
    transition: "all 0.2s ease",
  });

  const authPageColors = {
    page: "#eef4ff",
    panel: "#f8fbff",
    panelBorder: "#cdd9ee",
    text: "#1f2a44",
    muted: "#61708d",
    line: "#9fb0cc",
    inputBg: "#ffffff",
    inputBorder: "#c8d5ea",
    inputText: "#1f2a44",
    action: "#4a7ef0",
    actionHover: "#3f6edd",
    link: "#3f6edd",
    error: "#b91c1c",
    success: "#166534",
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        margin: 0,
        boxSizing: "border-box",
        fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
        background: colors.bg,
        color: colors.text,
        fontSize: "16px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap');
        ::selection {
          background: ${theme === "dark" ? "#1d4ed8" : "#93c5fd"};
          color: #ffffff;
        }
        button:focus-visible, input:focus-visible, select:focus-visible {
          outline: 3px solid #60a5fa;
          outline-offset: 2px;
        }
        body {
          font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>

      <div
        style={{
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: user ? `1px solid ${colors.border}` : "none",
          background: user ? colors.panel : authPageColors.page,
          position: user ? "sticky" : "static",
          top: user ? 0 : "auto",
          zIndex: 5,
        }}
      >
        {user ? (
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: colors.active,
              color: colors.text,
              border: "none",
              fontSize: "20px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            =
          </button>
        ) : (
          <div style={{ width: "36px" }} />
        )}

        <div
          style={{
            fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
            letterSpacing: "0.2px",
            color: user ? colors.text : authPageColors.text,
            fontSize: "20px",
            fontWeight: 600,
            textAlign: "center",
            flex: 1,
          }}
        >
          {user ? "Student Knowledge Retention Decay Analyzer" : ""}
        </div>

        {user ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: "18px",
                color: colors.text,
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "4px 10px",
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {String(user.name || "").toUpperCase()}
              </span>
              <span
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#2563eb",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                {user.name?.[0]?.toUpperCase() || "U"}
              </span>
            </button>

            {userMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "46px",
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: "8px",
                  boxShadow: "0 6px 18px rgba(17, 24, 39, 0.1)",
                  minWidth: "140px",
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setView("profile");
                    setUserMenuOpen(false);
                    setProfileMessage("");
                    setProfileError("");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    color: colors.text,
                    cursor: "pointer",
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    color: colors.text,
                    cursor: "pointer",
                  }}
                >
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    if (window.confirm("Do you want to exit?")) {
                      handleSignOut();
                    }
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    color: colors.text,
                    cursor: "pointer",
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: "36px" }} />
        )}
      </div>

      {!user && (
        <div
          style={{
            height: "calc(100vh - 64px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 16px",
            boxSizing: "border-box",
            overflow: "hidden",
            background:
              "radial-gradient(circle at top, rgba(102, 153, 255, 0.18), transparent 32%), linear-gradient(180deg, #f7faff 0%, #edf3ff 100%)",
          }}
        >
          <div
            style={{
              maxWidth: "360px",
              width: "100%",
              padding: "14px 14px 10px",
              border: `1px solid ${authPageColors.panelBorder}`,
              borderRadius: "16px",
              background: authPageColors.panel,
              boxShadow: "0 22px 50px rgba(86, 110, 148, 0.16)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: 0,
              }}
            >
              <div style={{ fontSize: "20px", color: authPageColors.muted, marginBottom: "12px" }}>
                Welcome Back!
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: "238px",
                  margin: "0 auto 0",
                }}
              >
                <img
                  src={loginLogoDarkMode}
                  alt="Bannari Amman Institute of Technology logo"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "230px",
                    margin: "0 auto",
                    objectFit: "contain",
                  filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.22))",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: "4px",
                  color: "#000000",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "26px",
                    lineHeight: "0.96",
                    fontWeight: 700,
                    letterSpacing: "0.3px",
                    textTransform: "uppercase",
                  }}
                >
                  BANNARI AMMAN
                </div>
                <div
                  style={{
                    fontSize: "15px",
                    lineHeight: "1.02",
                    fontWeight: 700,
                    letterSpacing: "0.2px",
                    textTransform: "uppercase",
                    marginTop: "2px",
                  }}
                >
                  Institute of Technology
                </div>
                <div
                  style={{
                    width: "100%",
                    maxWidth: "250px",
                    height: "2px",
                    background: "#000000",
                    margin: "5px auto 0",
                  }}
                />
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "26px",
                    lineHeight: "1",
                    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
                    color: "#000000",
                  }}
                >
                  Stay Ahead
                </div>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  fontSize: "18px",
                  lineHeight: "1.25",
                  fontWeight: 600,
                  color: "#334155",
                  textAlign: "center",
                }}
              >
                Student Knowledge
                <br />
                Retention Decay Analyzer
              </div>
            </div>

            <div
              style={{
                padding: "12px 0 0",
                textAlign: "center",
              }}
            >
              {mode === "signup" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAuthError("");
                    setAuthInfo("");
                    const payload = {
                      name: e.target.name.value.trim(),
                      email: e.target.email.value.trim(),
                      password: e.target.password.value,
                    };

                    try {
                      const response = await fetch(`${API_URL}/signup`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      const res = await response.json();
                      if (!response.ok) {
                        setAuthError(res.error || "Signup failed.");
                        return;
                      }
                      e.target.reset();
                      setMode("login");
                    } catch (_) {
                      setAuthError("Backend not reachable. Make sure Flask is running.");
                    }
                  }}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderRadius: 0,
                    padding: "0",
                    boxShadow: "none",
                  }}
                >
                  <input
                    name="name"
                    type="text"
                    placeholder="Full Name"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "8px" }} />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "8px" }} />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "10px" }} />
                  <button
                    type="submit"
                    style={{
                      ...authButtonStyle,
                      background: authPageColors.action,
                      border: `1px solid ${authPageColors.action}`,
                    }}
                  >
                    Create Account
                  </button>
                  <div style={{ marginTop: "12px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setAuthError("");
                        setAuthInfo("");
                      }}
                      style={{ background: "none", border: "none", color: authPageColors.link, cursor: "pointer" }}
                    >
                      I have an account
                    </button>
                  </div>
                </form>
              ) : mode === "login" ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAuthError("");
                    setAuthInfo("");
                    const payload = {
                      email: e.target.email.value.trim(),
                      password: e.target.password.value,
                    };

                    try {
                      const response = await fetch(`${API_URL}/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      const res = await response.json();
                      if (!response.ok) {
                        setAuthError(res.error || "Login failed.");
                        return;
                      }
                      window.sessionStorage.setItem("skrda_user", JSON.stringify(res));
                      setUser(res);
                      setView("home");
                      e.target.reset();
                    } catch (_) {
                      setAuthError("Backend not reachable. Make sure Flask is running.");
                    }
                  }}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderRadius: 0,
                    padding: "0",
                    boxShadow: "none",
                  }}
                >
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "8px" }} />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "10px" }} />
                  <button
                    type="submit"
                    style={{
                      ...authButtonStyle,
                      background: authPageColors.action,
                      border: `1px solid ${authPageColors.action}`,
                    }}
                  >
                    Login
                  </button>
                  <div style={{ marginTop: "8px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setAuthError("");
                        setAuthInfo("");
                      }}
                      style={{ background: "none", border: "none", color: authPageColors.link, cursor: "pointer", padding: 0 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAuthError("");
                    setAuthInfo("");
                  const payload = {
                    email: e.target.email.value.trim(),
                    current_password: e.target.current_password.value,
                    new_password: e.target.new_password.value,
                  };

                    try {
                      const response = await fetch(`${API_URL}/forgot-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      const res = await response.json();
                      if (!response.ok) {
                        setAuthError(res.error || "Password reset failed.");
                        return;
                      }
                      e.target.reset();
                      setAuthInfo("Password reset successful. Please login.");
                      setMode("login");
                    } catch (_) {
                      setAuthError("Backend not reachable. Make sure Flask is running.");
                    }
                  }}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    borderRadius: 0,
                    padding: "0",
                    boxShadow: "none",
                  }}
                >
                  <input
                    name="email"
                    type="email"
                    placeholder="Registered Email"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "8px" }} />
                  <input
                    name="current_password"
                    type="password"
                    placeholder="Current Password"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "8px" }} />
                  <input
                    name="new_password"
                    type="password"
                    placeholder="New Password"
                    required
                    style={{
                      ...authInputStyle,
                      background: authPageColors.inputBg,
                      border: `1px solid ${authPageColors.inputBorder}`,
                      color: authPageColors.inputText,
                    }}
                  />
                  <div style={{ height: "10px" }} />
                  <button
                    type="submit"
                    style={{
                      ...authButtonStyle,
                      background: authPageColors.action,
                      border: `1px solid ${authPageColors.action}`,
                    }}
                  >
                    Reset Password
                  </button>
                  <div style={{ marginTop: "12px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setAuthError("");
                        setAuthInfo("");
                      }}
                      style={{ background: "none", border: "none", color: authPageColors.link, cursor: "pointer" }}
                    >
                      Back to login
                    </button>
                  </div>
                </form>
              )}

              {mode !== "forgot" && (
                <div style={{ marginTop: "10px", textAlign: "center" }}>
                  {mode === "login" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setAuthError("");
                        setAuthInfo("");
                      }}
                      style={{ background: "none", border: "none", color: authPageColors.link, cursor: "pointer" }}
                    >
                      Create a new account
                    </button>
                  ) : null}
                </div>
              )}

              {authError && <div style={{ marginTop: "12px", color: authPageColors.error }}>{authError}</div>}
              {authInfo && <div style={{ marginTop: "12px", color: authPageColors.success }}>{authInfo}</div>}
            </div>
          </div>
        </div>
      )}

      {user && (
        <div
          style={{
            display: "flex",
            minHeight: "calc(100vh - 64px)",
            background: shellBg,
          }}
        >
          <aside
            style={{
              width: sidebarOpen ? "248px" : "72px",
              background: theme === "dark" ? "rgba(15, 23, 42, 0.82)" : "rgba(255, 255, 255, 0.72)",
              borderRight: `1px solid ${colors.border}`,
              padding: "18px 14px",
              transition: "width 0.2s ease",
              backdropFilter: "blur(10px)",
            }}
          >
            {sidebarOpen && (
              <>
                <div style={{ padding: "8px 8px 14px", marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: colors.muted }}>
                    Navigation
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: 700, color: colors.text }}>
                    Retention Hub
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setView("home")}
                  style={navButtonStyle(view === "home")}
                >
                  Home
                </button>

                <button
                  type="button"
                  onClick={() => setView("dashboard")}
                  style={navButtonStyle(view === "dashboard")}
                >
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setView("analyzer")}
                  style={navButtonStyle(view === "analyzer")}
                >
                  Analyzer
                </button>

                <button
                  type="button"
                  onClick={() => setView("records")}
                  style={navButtonStyle(view === "records")}
                >
                  Student Records
                </button>
              </>
            )}
          </aside>

          <main id="main-content" style={{ flex: 1, padding: "20px 24px 28px" }}>
            <div style={{ maxWidth: "1320px", margin: "0 auto" }}>

            {view === "home" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <div
                  style={{
                    ...shellCardStyle,
                    padding: "28px 30px",
                    background:
                      theme === "dark"
                        ? "linear-gradient(135deg, rgba(17, 24, 39, 0.96), rgba(30, 41, 59, 0.92))"
                        : "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,247,255,0.92))",
                  }}
                >
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: colors.muted, marginBottom: "10px" }}>
                    Overview
                  </div>
                  <div
                    style={{
                      fontSize: "32px",
                      fontWeight: 700,
                      color: "#0f172a",
                      marginBottom: "8px",
                      letterSpacing: "-0.6px",
                      lineHeight: "1.1",
                    }}
                  >
                    <span>Welcome back, </span>
                    <span style={{ color: "#7c3aed", textTransform: "uppercase" }}>{user.name}</span>
                  </div>
                  <div style={{ ...mutedTextStyle, maxWidth: "760px", fontSize: "16px" }}>
                    Track knowledge retention, review intervention risk, and compare course performance from one workspace.
                    Use the analyzer to update marks and open student records to investigate low-retention cases quickly.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", marginTop: "22px" }}>
                    <div style={{ ...cardStyle, padding: "16px 18px", background: theme === "dark" ? "#0f172a" : "#ffffff" }}>
                      <div style={mutedTextStyle}>Total Records</div>
                      <div style={{ marginTop: "6px", fontSize: "24px", fontWeight: 700 }}>{kpis?.overall?.total_records ?? records.length}</div>
                    </div>
                    <div style={{ ...cardStyle, padding: "16px 18px", background: theme === "dark" ? "#0f172a" : "#ffffff" }}>
                      <div style={mutedTextStyle}>Average Retention</div>
                      <div style={{ marginTop: "6px", fontSize: "24px", fontWeight: 700 }}>
                        {kpis?.overall ? `${Number(kpis.overall.average_retention).toFixed(2)}%` : "0.00%"}
                      </div>
                    </div>
                    <div style={{ ...cardStyle, padding: "16px 18px", background: theme === "dark" ? "#0f172a" : "#ffffff" }}>
                      <div style={mutedTextStyle}>Low Retention</div>
                      <div style={{ marginTop: "6px", fontSize: "24px", fontWeight: 700, color: colors.danger }}>
                        {kpis?.overall?.low_retention_count ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === "dashboard" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <div style={{ ...shellCardStyle, padding: "22px 24px" }}>
                  <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "2px", color: colors.muted, marginBottom: "8px" }}>
                    Dashboard
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color: colors.text, marginBottom: "6px" }}>
                    Course performance at a glance
                  </div>
                  <div style={mutedTextStyle}>
                    Monitor retention quality, spot high-risk students, and compare course outcomes from a single dashboard.
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                  <div style={{ ...shellCardStyle, padding: "18px" }}>
                    <div style={mutedTextStyle}>Total Records</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.text }}>{kpis?.overall?.total_records ?? records.length}</div>
                  </div>
                  <div style={{ ...shellCardStyle, padding: "18px" }}>
                    <div style={mutedTextStyle}>Courses</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.text }}>
                      {kpis?.overall?.course_count ?? new Set(records.map((r) => r.subject)).size}
                    </div>
                  </div>
                  <div style={{ ...shellCardStyle, padding: "18px" }}>
                    <div style={mutedTextStyle}>Average Retention</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.text }}>
                      {kpis?.overall ? `${Number(kpis.overall.average_retention).toFixed(2)}%` : "0.00%"}
                    </div>
                  </div>
                  <div style={{ ...shellCardStyle, padding: "18px" }}>
                    <div style={mutedTextStyle}>Low Retention Count</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: colors.danger }}>
                      {kpis?.overall?.low_retention_count ?? 0}
                    </div>
                  </div>
                </div>

                {kpis?.courses?.length > 0 && (
                  <div style={{ ...shellCardStyle, padding: "18px" }}>
                    <div style={{ ...sectionTitleStyle, marginBottom: "10px" }}>Course Dashboard KPIs</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                      {kpis.courses.map((courseItem) => (
                        <div
                          key={courseItem.course}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: "14px",
                            padding: "14px",
                            background: theme === "dark" ? "rgba(15, 23, 42, 0.76)" : "rgba(255,255,255,0.86)",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: colors.text, marginBottom: "6px" }}>{courseItem.course}</div>
                          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "8px", color: colors.muted }}>
                            <div>Avg Retention: <strong>{Number(courseItem.average_retention).toFixed(2)}%</strong></div>
                            <div>Low Retention: <strong>{courseItem.low_retention_count}</strong></div>
                          </div>
                          <div style={{ marginBottom: "6px", color: colors.text, fontWeight: 600 }}>Top Improved Students</div>
                          <div style={{ marginBottom: "8px", color: colors.muted }}>
                            {courseItem.top_improved_students?.length
                              ? courseItem.top_improved_students.map((s) => `${s.student_id} - ${s.name} (+${Number(s.gained_pct).toFixed(2)}%)`).join(", ")
                              : "No improved students"}
                          </div>
                          <div style={{ marginBottom: "6px", color: colors.text, fontWeight: 600 }}>High-Risk Students</div>
                          <div style={{ color: colors.danger }}>
                            {courseItem.high_risk_students?.length
                              ? courseItem.high_risk_students.map((s) => `${s.student_id} - ${s.name} (${Number(s.retention).toFixed(2)}%)`).join(", ")
                              : "No high-risk students"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === "profile" && (
              <div style={{ ...cardStyle, padding: "18px", maxWidth: "560px" }}>
                <h3 style={sectionTitleStyle}>Profile Settings</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setProfileError("");
                    setProfileMessage("");
                    const payload = {
                      name: e.target.name.value.trim(),
                      email: e.target.email.value.trim(),
                      current_password: e.target.current_password.value,
                      new_password: e.target.new_password.value,
                    };
                    try {
                      const response = await fetch(`${API_URL}/profile/${user.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      const res = await response.json();
                      if (!response.ok) {
                        setProfileError(res.error || "Profile update failed.");
                        return;
                      }
                      window.sessionStorage.setItem("skrda_user", JSON.stringify(res));
                      setUser(res);
                      e.target.current_password.value = "";
                      e.target.new_password.value = "";
                      setProfileMessage("Profile updated successfully.");
                    } catch (_) {
                      setProfileError("Backend not reachable. Make sure Flask is running.");
                    }
                  }}
                >
                  <input name="name" type="text" defaultValue={user.name} required style={formInputStyle} />
                  <div style={{ height: "10px" }} />
                  <input
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    required
                    readOnly
                    style={{ ...formInputStyle, background: colors.panel, cursor: "not-allowed" }}
                  />
                  <div style={{ height: "10px" }} />
                  <input name="current_password" type="password" placeholder="Current Password" style={formInputStyle} />
                  <div style={{ height: "10px" }} />
                  <input name="new_password" type="password" placeholder="New Password" style={formInputStyle} />
                  <div style={{ height: "14px" }} />
                  <button type="submit" style={formButtonStyle}>Update Profile</button>
                </form>
                {profileError && <div style={{ color: "#b91c1c", marginTop: "12px" }}>{profileError}</div>}
                {profileMessage && <div style={{ color: "#166534", marginTop: "12px" }}>{profileMessage}</div>}
              </div>
            )}

            {view === "analyzer" && (
              <>
                <form onSubmit={handleSubmit} style={{ ...cardStyle, padding: "16px", margin: "12px auto 0", maxWidth: "100%" }}>
                  <input
                    name="student_id"
                    type="number"
                    placeholder="Student ID"
                    required
                    style={formInputStyle}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setPreviousMark("");
                        setAutoFilled(false);
                      }
                    }}
                    onBlur={(e) => lookupExisting(e.target.form)}
                  />
                  <div style={{ height: "10px" }} />

                  <input
                    name="name"
                    type="text"
                    placeholder="Student Name"
                    required
                    style={formInputStyle}
                    onChange={(e) => {
                      if (!e.target.value.trim()) {
                        setPreviousMark("");
                        setAutoFilled(false);
                      }
                    }}
                    onBlur={(e) => lookupExisting(e.target.form)}
                  />
                  <div style={{ height: "10px" }} />

                  <select
                    name="subject"
                    required
                    value={analyzerCourse}
                    onChange={(e) => {
                      setAnalyzerCourse(e.target.value);
                      if (e.target.value !== "Others") {
                        setCustomAnalyzerCourse("");
                      }
                      if (!e.target.value) {
                        setPreviousMark("");
                        setAutoFilled(false);
                      }
                    }}
                    onBlur={(e) => lookupExisting(e.target.form)}
                    style={{ ...formSelectStyle, color: analyzerCourse ? "#111827" : "#6b7280" }}
                  >
                    <option value="">Select Course</option>
                    {COURSES.map((course) => (
                      <option key={course} value={course}>
                        {course}
                      </option>
                    ))}
                    <option value="Others">Others</option>
                  </select>
                  <div style={{ height: "10px" }} />

                  {analyzerCourse === "Others" && (
                    <>
                      <input
                        name="custom_subject"
                        type="text"
                        placeholder="Enter Course Name"
                        required
                        value={customAnalyzerCourse}
                        onChange={(e) => setCustomAnalyzerCourse(e.target.value)}
                        onBlur={(e) => lookupExisting(e.target.form)}
                        style={formInputStyle}
                      />
                      <div style={{ height: "10px" }} />
                    </>
                  )}

                  <input
                    name="initial"
                    type="number"
                    placeholder="Previous Exam Mark"
                    min="1"
                    max="100"
                    required
                    value={previousMark}
                    onChange={(e) => {
                      setPreviousMark(e.target.value);
                      setAutoFilled(false);
                    }}
                    style={formInputStyle}
                    readOnly={autoFilled}
                  />
                  <div style={{ height: "10px" }} />

                  <input
                    name="final"
                    type="number"
                    placeholder="Current Exam Mark"
                    min="1"
                    max="100"
                    required
                    style={formInputStyle}
                  />
                  <div style={{ height: "14px" }} />

                  <button type="submit" style={formButtonStyle}>
                    Analyze
                  </button>
                </form>

                {error && <div style={{ color: "#b91c1c", marginTop: "16px" }}>{error}</div>}

                {result && (
                  <div style={{ ...cardStyle, marginTop: "20px", padding: "12px" }}>
                    <h3 style={sectionTitleStyle}>Result</h3>
                    {result.needs_intervention && (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #fca5a5",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          fontWeight: 600,
                        }}
                      >
                        Needs intervention: Retention is below {Number(result.intervention_threshold ?? 50)}%.
                      </div>
                    )}
                    <div><strong>Student ID:</strong> {result.student_id}</div>
                    <div><strong>Name:</strong> {result.name}</div>
                    <div><strong>Course:</strong> {result.subject}</div>
                    <div><strong>Previous Exam Mark:</strong> {result.initial}</div>
                    <div><strong>Current Exam Mark:</strong> {result.final}</div>
                    <div><strong>Knowledge Lost %:</strong> {result.lost_pct.toFixed(2)}</div>
                    <div><strong>Knowledge Gained %:</strong> {result.gained.toFixed(2)}</div>
                    <div><strong>Retention %:</strong> {result.retention.toFixed(2)}</div>
                    <div><strong>Retention Level:</strong> {result.retention_level}</div>
                  </div>
                )}
              </>
            )}

            {view === "records" && (
              <div style={{ ...cardStyle, marginTop: "24px", padding: "16px" }}>
                <h3 style={sectionTitleStyle}>Student Records</h3>
                <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "14px", alignItems: "start" }}>
                  <div style={{ ...cardStyle, padding: "12px", boxShadow: "none" }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: colors.text, marginBottom: "10px" }}>Filters</div>
                    <input
                      type="text"
                      placeholder="Student ID / Name"
                      value={recordsStudentFilter}
                      onChange={(e) => setRecordsStudentFilter(e.target.value)}
                      style={formInputStyle}
                    />
                    <div style={{ height: "10px" }} />
                    <select
                      value={recordsCourseFilter}
                      onChange={(e) => setRecordsCourseFilter(e.target.value)}
                      style={{
                        ...formSelectStyle,
                        color: recordsCourseFilter ? "#111827" : "#6b7280",
                      }}
                    >
                      <option value="">All Courses</option>
                      {COURSES.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                    <div style={{ height: "10px" }} />
                    <select
                      value={recordsLevelFilter}
                      onChange={(e) => setRecordsLevelFilter(e.target.value)}
                      style={{
                        ...formSelectStyle,
                        color: recordsLevelFilter ? "#111827" : "#6b7280",
                      }}
                    >
                      <option value="">All Levels</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                    <div style={{ height: "10px" }} />
                    <input
                      type="date"
                      value={recordsFromDate}
                      onChange={(e) => setRecordsFromDate(e.target.value)}
                      style={{
                        ...formInputStyle,
                        color: recordsFromDate ? "#111827" : "#6b7280",
                      }}
                    />
                    <div style={{ height: "10px" }} />
                    <input
                      type="date"
                      value={recordsToDate}
                      onChange={(e) => setRecordsToDate(e.target.value)}
                      style={{
                        ...formInputStyle,
                        color: recordsToDate ? "#111827" : "#6b7280",
                      }}
                    />
                    <div style={{ height: "10px" }} />
                    <button
                      type="button"
                      onClick={() =>
                        loadRecords({
                          course: recordsCourseFilter,
                          level: recordsLevelFilter,
                          student: recordsStudentFilter,
                          from_date: recordsFromDate,
                          to_date: recordsToDate,
                        })
                      }
                      style={formButtonStyle}
                    >
                      Apply Filters
                    </button>
                    <div style={{ height: "10px" }} />
                    <button
                      type="button"
                      onClick={() => {
                        setRecordsCourseFilter("");
                        setRecordsLevelFilter("");
                        setRecordsStudentFilter("");
                        setRecordsFromDate("");
                        setRecordsToDate("");
                        loadRecords({
                          course: "",
                          level: "",
                          student: "",
                          from_date: "",
                          to_date: "",
                        });
                      }}
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "16px",
                        borderRadius: "10px",
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        color: "#111827",
                        cursor: "pointer",
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>

                  <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>S.No</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Student ID</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Name</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Course</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Past Mark</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Current Mark</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Lost %</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Gained %</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Retention %</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Level</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Alert</th>
                        <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "12px", whiteSpace: "nowrap" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, index) => {
                          const past = Number(r.initial);
                          const current = Number(r.final);
                          const lostPct = past > 0 && current <= past ? ((past - current) / past) * 100 : 0;
                          const gainedPct = past > 0 && current > past ? ((current - past) / past) * 100 : 0;

                          return (
                            <tr key={r.id}>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{index + 1}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.student_id}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.name}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.subject}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.initial}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.final}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{lostPct.toFixed(2)}%</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{gainedPct.toFixed(2)}%</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{Number(r.retention).toFixed(2)}%</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>{r.retention_level}</td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", color: r.needs_intervention ? "#b91c1c" : "#166534", fontWeight: 600 }}>
                                {r.needs_intervention ? "Needs intervention" : "OK"}
                              </td>
                              <td style={{ padding: "12px", borderBottom: "1px solid #eee", whiteSpace: "nowrap", position: "relative" }}>
                                <button
                                  type="button"
                                  onClick={() => setOpenRowMenuId((prev) => (prev === r.id ? null : r.id))}
                                  style={{
                                    border: `1px solid ${colors.border}`,
                                    background: colors.surface,
                                    color: colors.text,
                                    borderRadius: "8px",
                                    width: "34px",
                                    height: "30px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  aria-label={`Actions for ${r.name}`}
                                >
                                  <span style={{ display: "inline-flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: colors.text }} />
                                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: colors.text }} />
                                    <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: colors.text }} />
                                  </span>
                                </button>
                                {openRowMenuId === r.id && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      right: "12px",
                                      top: "44px",
                                      zIndex: 20,
                                      minWidth: "120px",
                                      background: colors.surface,
                                      border: `1px solid ${colors.border}`,
                                      borderRadius: "8px",
                                      boxShadow: "0 6px 18px rgba(17, 24, 39, 0.18)",
                                      display: "flex",
                                      flexDirection: "column",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => openEditRecordModal(r)}
                                      style={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "8px 10px",
                                        border: "none",
                                        borderBottom: `1px solid ${colors.border}`,
                                        background: "transparent",
                                        color: colors.text,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r)}
                                      style={{
                                        display: "block",
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "8px 10px",
                                        border: "none",
                                        background: "transparent",
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}
            </div>
          </main>
        </div>
      )}

      {editingRecord && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              ...cardStyle,
              padding: "16px",
            }}
          >
            <div style={{ ...sectionTitleStyle, marginBottom: "8px" }}>Edit Marks</div>
            <div style={{ ...mutedTextStyle, marginBottom: "12px" }}>
              {editingRecord.student_id} - {editingRecord.name}
            </div>
            <input
              type="number"
              min="1"
              max="100"
              value={editInitial}
              onChange={(e) => setEditInitial(e.target.value)}
              placeholder="Previous Exam Mark"
              style={formInputStyle}
            />
            <div style={{ height: "10px" }} />
            <input
              type="number"
              min="1"
              max="100"
              value={editFinal}
              onChange={(e) => setEditFinal(e.target.value)}
              placeholder="Current Exam Mark"
              style={formInputStyle}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button
                type="button"
                onClick={closeEditModal}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditRecord}
                style={{ ...formButtonStyle, flex: 1 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


