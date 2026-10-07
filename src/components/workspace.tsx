"use client";

import {
  useEffect,
  useState,
  useId,
  Children,
  isValidElement,
  cloneElement,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  Archive,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Globe,
  Grid2X2,
  LayoutDashboard,
  Lightbulb,
  Link as LinkIcon,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Terminal,
  Trash2,
  Users,
  X,
  Pencil,
  Send,
  Clock,
  ChevronRight,
} from "lucide-react";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  kind: string;
  note?: string;
};
type Account = {
  id: string;
  label: string;
  role: string;
  login: string;
  password: string;
  url: string;
  note: string;
};
type Task = { id: string; text: string; done: boolean };
type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  platform: string;
  ownership: string;
  groupId: string | null;
  tags: string[];
  favorite: boolean;
  links: LinkItem[];
  accounts: Account[];
  tasks: Task[];
  notes: string;
  domainExpiresAt: string | null;
  hostingExpiresAt: string | null;
  monitor: {
    enabled: boolean;
    url: string;
    expectedStatus: number;
    lastCheckedAt?: string | null;
    status?: string;
    error?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};
type Group = { id: string; name: string; color: string };
type State = {
  projects: Project[];
  groups: Group[];
  settings: {
    login: string;
    zipPasswordConfigured: boolean;
    telegramConfigured: boolean;
    telegramChatId: string;
  };
  backups: {
    id: string;
    status: string;
    createdAt: string;
    sentAt?: string;
    error?: string;
  }[];
  worker: { lastHeartbeatAt: string | null };
};
const statusLabels: Record<string, string> = {
  idea: "G‘oya / reja",
  building: "Ishlab chiqilmoqda",
  live: "Ishlayapti",
  paused: "To‘xtatilgan",
  archived: "Arxiv",
};
const platformLabels: Record<string, string> = {
  website: "Veb sayt",
  telegram: "Telegram bot",
  mobile: "Mobil ilova",
  api: "API",
  other: "Boshqa",
};
const navItems = [
  { id: "dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { id: "projects", label: "Barcha loyihalar", icon: FolderOpen },
  { id: "favorites", label: "Sevimlilar", icon: Star },
  { id: "ideas", label: "G‘oyalar va rejalar", icon: Lightbulb },
  { id: "monitoring", label: "Monitoring", icon: Activity },
];
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("uz-UZ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Hali yo‘q";
const day = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("uz-UZ", { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Belgilanmagan";
const uid = () => crypto.randomUUID();
const blank = (): Project => ({
  id: "",
  name: "",
  description: "",
  status: "idea",
  platform: "website",
  ownership: "solo",
  groupId: null,
  tags: [],
  favorite: false,
  links: [],
  accounts: [],
  tasks: [],
  notes: "",
  domainExpiresAt: null,
  hostingExpiresAt: null,
  monitor: { enabled: false, url: "", expectedStatus: 200 },
  createdAt: "",
  updatedAt: "",
});
async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers:
      options.body instanceof FormData
        ? options.headers
        : { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response
    .json()
    .catch(() => ({ error: "Serverdan javob olinmadi." }));
  if (!response.ok) throw new Error(body.error || "Amal bajarilmadi.");
  return body;
}
function PlatformIcon({
  platform,
  size = 21,
}: {
  platform: string;
  size?: number;
}) {
  const Icon =
    platform === "telegram"
      ? Send
      : platform === "api"
        ? Terminal
        : platform === "mobile"
          ? LayoutDashboard
          : Globe;
  return <Icon size={size} />;
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`${secondary ? "button secondary" : "button"} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "select", "textarea"].includes(String(child.type))
          ? cloneElement(
              child as ReactElement<{
                id: string;
                "aria-describedby"?: string;
              }>,
              { id, "aria-describedby": hint ? id + "-hint" : undefined },
            )
          : child,
      )}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const el = document.querySelector<HTMLDialogElement>("dialog[data-modal]");
    el?.showModal();
    return () => {
      el?.close();
      prev?.focus();
    };
  }, []);
  return (
    <dialog
      data-modal
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">MY PROJECTS</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Yopish">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function Workspace() {
  const [state, setState] = useState<State | null>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState("dashboard"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState(""),
    [platform, setPlatform] = useState(""),
    [status, setStatus] = useState(""),
    [ownership, setOwnership] = useState(""),
    [layout, setLayout] = useState("grid"),
    [sidebar, setSidebar] = useState(false),
    [editing, setEditing] = useState<Project | null>(null),
    [detail, setDetail] = useState<Project | null>(null),
    [groupModal, setGroupModal] = useState(false),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [loginError, setLoginError] = useState("");
  const notify = (message: string) => {
    setToast(message);
  };
  async function reload() {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (response.status === 401) {
        setState(null);
        return;
      }
      if (!response.ok) throw new Error("Ma’lumotlar yuklanmadi.");
      setState(await response.json());
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 5500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      await reload();
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(project: Project) {
    setBusy(true);
    try {
      await api(`/api/projects${project.id ? "/" + project.id : ""}`, {
        method: project.id ? "PUT" : "POST",
        body: JSON.stringify(project),
      });
      await reload();
      setEditing(null);
      setDetail(null);
      notify("Loyiha saqlandi. Zaxira yuborish navbatiga qo‘shildi.");
    } catch (e) {
      notify((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function favorite(project: Project) {
    try {
      await api("/api/projects/" + project.id, {
        method: "PUT",
        body: JSON.stringify({ ...project, favorite: !project.favorite }),
      });
      await reload();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Nusxalandi.");
    } catch {
      notify("Nusxalashga ruxsat berilmadi.");
    }
  }
  function navigate(next: string) {
    setView(next);
    setGroup("");
    setQuery("");
    setStatus("");
    setPlatform("");
    setOwnership("");
    setSidebar(false);
  }
  if (loading)
    return (
      <main className="loading-screen">
        <div className="brand-mark">
          <Folder size={28} />
        </div>
        <LoaderCircle className="spin" />
        <p>Ish maydoni ochilmoqda…</p>
      </main>
    );
  if (!state)
    return (
      <main className="login-page">
        <section className="login-story">
          <a className="brand" href="/">
            <div className="brand-mark">
              <Folder />
            </div>
            <span>
              my projects<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="login-story-body">
            <span className="eyebrow">SHAXSIY ISH MAYDONI</span>
            <h1>
              Har bir loyiha.
              <br />
              O‘z joyida.
            </h1>
            <p>
              G‘oyadan ishga tushirishgacha — loyihalaringiz, havolalaringiz va
              hisoblaringiz bir joyda.
            </p>
            <div className="login-feature">
              <FolderOpen />
              <span>Loyihalar va g‘oyalar</span>
            </div>
            <div className="login-feature">
              <LockKeyhole />
              <span>Shifrlangan hisob ma’lumotlari</span>
            </div>
            <div className="login-feature">
              <Activity />
              <span>Monitoring va Telegram xabarlari</span>
            </div>
          </div>
          <span className="login-footer">
            Faqat siz uchun yaratilgan maydon.
          </span>
        </section>
        <section className="login-form-wrap">
          <form className="login-form" onSubmit={login}>
            <div className="login-lock">
              <LockKeyhole size={25} />
            </div>
            <span className="eyebrow">XUSH KELIBSIZ</span>
            <h2>Ish maydoniga kirish</h2>
            <p>Davom etish uchun hisobingizga kiring.</p>
            <Field label="Login">
              <input
                name="login"
                required
                autoComplete="username"
                placeholder="Loginingiz"
                autoFocus
              />
            </Field>
            <Field label="Parol">
              <input
                name="password"
                required
                type="password"
                autoComplete="current-password"
                placeholder="Parolingiz"
              />
            </Field>
            {loginError && (
              <p role="alert" className="form-error">
                {loginError}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <LockKeyhole size={17} />
              )}
              Kirish
            </Button>
            <div className="private-note">
              <ShieldCheck size={16} /> Shaxsiy platforma · Ro‘yxatdan o‘tish
              yopiq
            </div>
          </form>
        </section>
      </main>
    );
  const projects = state.projects;
  const active = projects.filter((p) => p.status !== "archived");
  const monitored = projects.filter((p) => p.monitor.enabled);
  const failed = monitored.filter((p) =>
    ["down", "error"].includes(p.monitor.status || ""),
  );
  let filtered = projects.filter((p) =>
    view === "archive" ? p.status === "archived" : p.status !== "archived",
  );
  if (view === "favorites") filtered = filtered.filter((p) => p.favorite);
  if (view === "ideas") filtered = filtered.filter((p) => p.status === "idea");
  if (view === "monitoring")
    filtered = filtered.filter((p) => p.monitor.enabled);
  if (group) filtered = filtered.filter((p) => p.groupId === group);
  filtered = filtered.filter(
    (p) =>
      (!query ||
        `${p.name} ${p.description} ${p.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!platform || p.platform === platform) &&
      (!status || p.status === status) &&
      (!ownership || p.ownership === ownership),
  );
  filtered.sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) ||
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const title = group
    ? state.groups.find((g) => g.id === group)?.name
    : view === "archive"
      ? "Arxiv"
      : view === "settings"
        ? "Sozlamalar"
        : navItems.find((n) => n.id === view)?.label;
  const latestBackup = state.backups.find(
    (b) => b.status === "sent" || b.status === "completed",
  );
  const deadlines = active
    .flatMap((p) => [
      { p, type: "Domen", date: p.domainExpiresAt },
      { p, type: "Hosting", date: p.hostingExpiresAt },
    ])
    .filter(
      (d) => d.date && new Date(d.date).getTime() <= Date.now() + 30 * 86400000,
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          aria-label="Menyuni yopish"
          className="sidebar-scrim"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a href="/" className="brand">
          <div className="brand-mark">
            <Folder size={21} />
          </div>
          <span>
            my projects<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <div className="avatar">J</div>
          <div>
            <strong>Shaxsiy maydon</strong>
            <small>Faqat o‘zingiz uchun</small>
          </div>
          <LockKeyhole size={14} />
        </div>
        <div className="nav-label">ISH MAYDONI</div>
        <nav>
          {navItems.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id && !group ? "active" : ""}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "projects" && <em>{active.length}</em>}
              {n.id === "monitoring" && failed.length > 0 && (
                <em className="alert-count">{failed.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label group-label">
          <span>GURUHLAR</span>
          <button
            aria-label="Guruh qo‘shish"
            onClick={() => setGroupModal(true)}
          >
            <Plus size={17} />
          </button>
        </div>
        <nav>
          {state.groups.length ? (
            state.groups.map((g) => (
              <button
                key={g.id}
                className={`nav-item ${group === g.id ? "active" : ""}`}
                onClick={() => {
                  setGroup(g.id);
                  setView("projects");
                  setSidebar(false);
                }}
              >
                <span className="group-dot" style={{ background: g.color }} />
                <span>{g.name}</span>
                <em>{active.filter((p) => p.groupId === g.id).length}</em>
              </button>
            ))
          ) : (
            <button className="nav-empty" onClick={() => setGroupModal(true)}>
              Birinchi guruhni qo‘shish
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${view === "archive" ? "active" : ""}`}
            onClick={() => navigate("archive")}
          >
            <Archive size={19} />
            <span>Arxiv</span>
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings size={19} />
            <span>Sozlamalar</span>
          </button>
          <div className="sidebar-security">
            <ShieldCheck size={18} />
            <div>
              <strong>Shaxsiy va himoyalangan</strong>
              <small>Hisoblaringiz shifrlanadi</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Menyu"
              onClick={() => setSidebar(true)}
            >
              <Menu />
            </button>
            <span>Ish maydoni</span>
            <ChevronRight size={15} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <LockKeyhole size={13} /> Shaxsiy
            </span>
            <button
              className="user-button"
              onClick={() => navigate("settings")}
              title="Hisob sozlamalari"
            >
              {state.settings.login.slice(0, 1).toUpperCase()}
            </button>
            <button
              className="icon-button"
              title="Chiqish"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                setState(null);
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          {view === "settings" ? (
            <SettingsPanel state={state} reload={reload} notify={notify} />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {view === "dashboard"
                      ? "HAMMASI BIR JOYDA"
                      : "SHAXSIY KATALOG"}
                  </span>
                  <h1>
                    {view === "dashboard"
                      ? "Loyihalaringiz, bir qarashda."
                      : title}
                  </h1>
                  <p>
                    {view === "dashboard"
                      ? "G‘oyalarni tartiblang. Loyihalarni kuzating. Ishni davom ettiring."
                      : view === "monitoring"
                        ? "Manzillaringiz holati va oxirgi tekshiruvlar."
                        : view === "ideas"
                          ? "Keyingi katta ish shu yerdan boshlanadi."
                          : view === "archive"
                            ? "Keyinroq qaytish uchun saqlangan loyihalar."
                            : "Kerakli loyiha, havola va hisobni tez toping."}
                  </p>
                </div>
                <Button onClick={() => setEditing(blank())}>
                  <Plus size={19} />
                  Loyiha qo‘shish
                </Button>
              </div>
              {view === "dashboard" && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label="Jami loyihalar"
                      value={active.length}
                      icon={<FolderOpen />}
                      note="Faol katalogda"
                    />
                    <Stat
                      label="Ishlayapti"
                      value={active.filter((p) => p.status === "live").length}
                      icon={<Globe />}
                      note="Ishga tushirilgan"
                    />
                    <Stat
                      label="G‘oyalar va rejalar"
                      value={active.filter((p) => p.status === "idea").length}
                      icon={<Lightbulb />}
                      note="Boshlashni kutmoqda"
                    />
                    <Stat
                      label="Monitoring"
                      value={monitored.length}
                      icon={<Activity />}
                      note={
                        failed.length
                          ? `${failed.length} ta muammo aniqlandi`
                          : "Kuzatuv yoqilgan"
                      }
                      alert={!!failed.length}
                    />
                  </div>
                  {deadlines.length > 0 && (
                    <div className="deadline-banner">
                      <Bell size={19} />
                      <div>
                        <strong>Yaqinlashayotgan muddatlar</strong>
                        <span>
                          {deadlines
                            .slice(0, 3)
                            .map(
                              (d) =>
                                `${d.p.name}: ${d.type.toLowerCase()} — ${day(d.date)}`,
                            )
                            .join(" · ")}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="section-heading">
                    <h2>
                      Loyihalar kutubxonasi <span>{filtered.length}</span>
                    </h2>
                    <span className="subtle">
                      So‘nggi o‘zgarishlar bo‘yicha
                    </span>
                  </div>
                </>
              )}
              <div className="filter-bar">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="Loyihalarni qidirish"
                    placeholder="Loyiha yoki teg bo‘yicha qidirish…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Qidiruvni tozalash"
                      onClick={() => setQuery("")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="filter-controls">
                  <select
                    aria-label="Platforma filtri"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    <option value="">Barcha turlar</option>
                    {Object.entries(platformLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Holat filtri"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">Barcha holatlar</option>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Bajarilish turi"
                    value={ownership}
                    onChange={(e) => setOwnership(e.target.value)}
                  >
                    <option value="">O‘zim / jamoa</option>
                    <option value="solo">O‘zim</option>
                    <option value="team">Jamoa bilan</option>
                  </select>
                  <div className="layout-switch">
                    <button
                      className={layout === "grid" ? "selected" : ""}
                      aria-label="Kartochka ko‘rinishi"
                      onClick={() => setLayout("grid")}
                    >
                      <Grid2X2 size={17} />
                    </button>
                    <button
                      className={layout === "list" ? "selected" : ""}
                      aria-label="Ro‘yxat ko‘rinishi"
                      onClick={() => setLayout("list")}
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
              </div>
              {filtered.length ? (
                <div
                  className={`project-grid ${layout === "list" ? "list-view" : ""}`}
                >
                  {filtered.map((p) => (
                    <article key={p.id} className="project-card">
                      <div className="card-top">
                        <button
                          className={`project-icon platform-${p.platform}`}
                          aria-label={`${p.name}ni ochish`}
                          onClick={() => setDetail(p)}
                        >
                          <PlatformIcon platform={p.platform} />
                        </button>
                        <span className={`status status-${p.status}`}>
                          {statusLabels[p.status]}
                        </span>
                        <button
                          className={`icon-button favorite ${p.favorite ? "is-favorite" : ""}`}
                          aria-label={
                            p.favorite
                              ? "Sevimlilardan olib tashlash"
                              : "Sevimlilarga qo‘shish"
                          }
                          onClick={() => void favorite(p)}
                        >
                          <Star
                            size={18}
                            fill={p.favorite ? "currentColor" : "none"}
                          />
                        </button>
                      </div>
                      <button
                        className="card-main"
                        onClick={() => setDetail(p)}
                      >
                        <h3>{p.name}</h3>
                        <p>{p.description || "Tavsif hali qo‘shilmagan."}</p>
                      </button>
                      <div className="tags">
                        <span>{platformLabels[p.platform]}</span>
                        {p.ownership === "team" && (
                          <span>
                            <Users size={12} />
                            Jamoa
                          </span>
                        )}
                        {p.tags.slice(0, 2).map((t) => (
                          <span key={t}>#{t}</span>
                        ))}
                      </div>
                      {view === "monitoring" && (
                        <div
                          className={`monitor-line ${p.monitor.status === "down" ? "danger" : ""}`}
                        >
                          <Activity size={14} />
                          <span>
                            {monitorLabel(p.monitor.status)}
                            <small>{date(p.monitor.lastCheckedAt)}</small>
                          </span>
                        </div>
                      )}
                      <div className="card-footer">
                        <button onClick={() => setDetail(p)}>
                          <LinkIcon size={14} />
                          {p.links.length} havola{" "}
                          <span className="footer-divider" />
                          <LockKeyhole size={13} />
                          {p.accounts.length} hisob
                        </button>
                        {p.links[0] ? (
                          <a
                            href={p.links[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="open-project"
                            title="Asosiy havolani ochish"
                          >
                            Ochish <ArrowUpRight size={15} />
                          </a>
                        ) : (
                          <button
                            className="open-project"
                            onClick={() => setDetail(p)}
                          >
                            Batafsil <ChevronRight size={15} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">
                    {view === "ideas" ? (
                      <Lightbulb size={32} />
                    ) : view === "monitoring" ? (
                      <Activity size={32} />
                    ) : (
                      <FolderOpen size={32} />
                    )}
                  </div>
                  <h2>
                    {query || platform || status || ownership
                      ? "Mos loyiha topilmadi"
                      : view === "favorites"
                        ? "Sevimlilar hali bo‘sh"
                        : view === "monitoring"
                          ? "Kuzatuv hali yoqilmagan"
                          : view === "archive"
                            ? "Arxiv hozircha bo‘sh"
                            : "Birinchi loyihangizdan boshlang"}
                  </h2>
                  <p>
                    {query || platform || status || ownership
                      ? "Qidiruv yoki filtrlarni o‘zgartirib ko‘ring."
                      : view === "monitoring"
                        ? "Loyihani tahrirlab, monitoring manzilini kiriting."
                        : view === "favorites"
                          ? "Tez kirish uchun loyiha yonidagi yulduzni bosing."
                          : view === "archive"
                            ? "Arxivlangan loyihalar shu yerda ko‘rinadi."
                            : "Tayyor sayt, Telegram bot yoki hali qog‘ozdagi g‘oya — barchasiga joy bor."}
                  </p>
                  {!query &&
                    !platform &&
                    !status &&
                    !ownership &&
                    !["archive", "favorites", "monitoring"].includes(view) && (
                      <Button onClick={() => setEditing(blank())}>
                        <Plus size={18} />
                        Birinchi loyihani qo‘shish
                      </Button>
                    )}
                </div>
              )}
              {view === "dashboard" && (
                <div className="dashboard-bottom">
                  <div>
                    <ShieldCheck size={16} />
                    <span>
                      Oxirgi zaxira:{" "}
                      <strong>{date(latestBackup?.sentAt)}</strong>
                    </span>
                  </div>
                  <button onClick={() => navigate("settings")}>
                    Zaxira va sozlamalar <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>my projects.</span>
          <span>G‘oyadan natijagacha.</span>
        </footer>
      </div>
      {editing && (
        <ProjectEditor
          project={editing}
          groups={state.groups}
          onSave={save}
          busy={busy}
          onClose={() => !busy && setEditing(null)}
        />
      )}
      {detail && !editing && (
        <ProjectDetail
          project={detail}
          groups={state.groups}
          onClose={() => setDetail(null)}
          onEdit={() =>
            setEditing({
              ...detail,
              accounts: detail.accounts.map((a) => ({ ...a, password: "" })),
            })
          }
          copy={copy}
          notify={notify}
          onSave={save}
        />
      )}
      {groupModal && (
        <GroupManager
          groups={state.groups}
          onClose={() => setGroupModal(false)}
          reload={reload}
          notify={notify}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Bell size={18} />
          <span>{toast}</span>
          <button aria-label="Xabarni yopish" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  note,
  alert = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  note: string;
  alert?: boolean;
}) {
  return (
    <div className={`stat-card ${alert ? "stat-alert" : ""}`}>
      <div className="stat-label">
        {label}
        {icon}
      </div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{note}</span>
    </div>
  );
}
function monitorLabel(status?: string) {
  return status === "up"
    ? "Ishlayapti"
    : status === "down"
      ? "Ulanishda muammo"
      : status === "error"
        ? "Tekshiruv xatosi"
        : "Tekshiruv kutilmoqda";
}

function ProjectEditor({
  project,
  groups,
  onSave,
  onClose,
  busy,
}: {
  project: Project;
  groups: Group[];
  onSave: (p: Project) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [p, setP] = useState<Project>(() => structuredClone(project)),
    [section, setSection] = useState("general"),
    [error, setError] = useState("");
  const change = <K extends keyof Project>(key: K, value: Project[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!p.name.trim()) {
      setSection("general");
      setError("Loyiha nomini kiriting.");
      return;
    }
    if (p.monitor.enabled && !p.monitor.url) {
      setSection("extra");
      setError("Monitoring manzilini kiriting.");
      return;
    }
    try {
      await onSave({
        ...p,
        name: p.name.trim(),
        tags: [...new Set(p.tags.map((t) => t.trim()).filter(Boolean))],
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const tabs = [
    ["general", "Asosiy"],
    ["links", `Havolalar (${p.links.length})`],
    ["accounts", `Hisoblar (${p.accounts.length})`],
    ["extra", "Reja va monitoring"],
  ];
  return (
    <Modal
      title={p.id ? "Loyihani tahrirlash" : "Yangi loyiha"}
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="editor-tabs">
          {tabs.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={section === key ? "selected" : ""}
              onClick={() => setSection(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="modal-body editor-body">
          {section === "general" && (
            <div className="form-grid">
              <Field label="Loyiha nomi *">
                <input
                  autoFocus
                  value={p.name}
                  maxLength={160}
                  onChange={(e) => change("name", e.target.value)}
                  placeholder="Masalan, Savdo platformasi"
                />
              </Field>
              <Field label="Guruh">
                <select
                  value={p.groupId || ""}
                  onChange={(e) => change("groupId", e.target.value || null)}
                >
                  <option value="">Guruhsiz</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="full">
                <Field label="Qisqa tavsif">
                  <textarea
                    rows={3}
                    value={p.description}
                    onChange={(e) => change("description", e.target.value)}
                    placeholder="Loyiha nima vazifa bajaradi?"
                  />
                </Field>
              </div>
              <Field label="Platformasi">
                <select
                  value={p.platform}
                  onChange={(e) => change("platform", e.target.value)}
                >
                  {Object.entries(platformLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Holati">
                <select
                  value={p.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bajarilishi">
                <select
                  value={p.ownership}
                  onChange={(e) => change("ownership", e.target.value)}
                >
                  <option value="solo">O‘zim</option>
                  <option value="team">Jamoa bilan</option>
                </select>
              </Field>
              <Field label="Teglar" hint="Vergul bilan ajrating">
                <input
                  value={p.tags.join(", ")}
                  onChange={(e) =>
                    change(
                      "tags",
                      e.target.value.split(",").map((t) => t.trimStart()),
                    )
                  }
                  placeholder="savdo, shaxsiy, mijoz"
                />
              </Field>
              <label className="checkbox-field full">
                <input
                  type="checkbox"
                  checked={p.favorite}
                  onChange={(e) => change("favorite", e.target.checked)}
                />
                <Star size={17} />
                Sevimli loyihalarga qo‘shish
              </label>
            </div>
          )}
          {section === "links" && (
            <>
              <div className="form-section-intro">
                <h3>Loyihaning barcha manzillari</h3>
                <p>
                  Sayt, bot, admin panel va kod manzilini bir joyda saqlang.
                </p>
              </div>
              {p.links.map((link, index) => (
                <div className="repeat-item" key={link.id}>
                  <div className="repeat-heading">
                    <strong>Havola {index + 1}</strong>
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Havola ${index + 1}ni olib tashlash`}
                      onClick={() =>
                        change(
                          "links",
                          p.links.filter((l) => l.id !== link.id),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label="Nomi">
                      <input
                        value={link.label}
                        onChange={(e) =>
                          change(
                            "links",
                            p.links.map((l) =>
                              l.id === link.id
                                ? { ...l, label: e.target.value }
                                : l,
                            ),
                          )
                        }
                        placeholder="Asosiy sayt"
                      />
                    </Field>
                    <Field label="Turi">
                      <select
                        value={link.kind}
                        onChange={(e) =>
                          change(
                            "links",
                            p.links.map((l) =>
                              l.id === link.id
                                ? { ...l, kind: e.target.value }
                                : l,
                            ),
                          )
                        }
                      >
                        {[
                          "website",
                          "telegram",
                          "github",
                          "admin",
                          "docs",
                          "other",
                        ].map((k) => (
                          <option key={k} value={k}>
                            {
                              (
                                {
                                  website: "Sayt",
                                  telegram: "Telegram",
                                  github: "GitHub",
                                  admin: "Admin panel",
                                  docs: "Hujjatlar",
                                  other: "Boshqa",
                                } as Record<string, string>
                              )[k]
                            }
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="full">
                      <Field label="Manzil">
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) =>
                            change(
                              "links",
                              p.links.map((l) =>
                                l.id === link.id
                                  ? { ...l, url: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          placeholder="https://…"
                        />
                      </Field>
                    </div>
                    <div className="full">
                      <Field label="Havola izohi">
                        <input
                          value={link.note || ""}
                          onChange={(e) =>
                            change(
                              "links",
                              p.links.map((l) =>
                                l.id === link.id
                                  ? { ...l, note: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          placeholder="Ixtiyoriy eslatma"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                secondary
                onClick={() =>
                  change("links", [
                    ...p.links,
                    {
                      id: uid(),
                      label: "",
                      url: "",
                      kind: "website",
                      note: "",
                    },
                  ])
                }
              >
                <Plus size={17} />
                Havola qo‘shish
              </Button>
            </>
          )}
          {section === "accounts" && (
            <>
              <div className="form-section-intro">
                <h3>Rollar va kirish ma’lumotlari</h3>
                <p>
                  Har bir rol uchun alohida hisob kiriting. Parollar shifrlangan
                  holda saqlanadi.
                </p>
              </div>
              {p.accounts.map((a, index) => {
                const update = (key: keyof Account, value: string) =>
                  change(
                    "accounts",
                    p.accounts.map((item) =>
                      item.id === a.id ? { ...item, [key]: value } : item,
                    ),
                  );
                return (
                  <div className="repeat-item" key={a.id}>
                    <div className="repeat-heading">
                      <strong>Hisob {index + 1}</strong>
                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={`Hisob ${index + 1}ni olib tashlash`}
                        onClick={() =>
                          change(
                            "accounts",
                            p.accounts.filter((x) => x.id !== a.id),
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="form-grid">
                      <Field label="Hisob nomi">
                        <input
                          value={a.label}
                          onChange={(e) => update("label", e.target.value)}
                          placeholder="Asosiy administrator"
                        />
                      </Field>
                      <Field label="Rol">
                        <input
                          value={a.role}
                          onChange={(e) => update("role", e.target.value)}
                          placeholder="Administrator"
                        />
                      </Field>
                      <Field label="Login">
                        <input
                          autoComplete="off"
                          value={a.login}
                          onChange={(e) => update("login", e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Parol"
                        hint={
                          p.id
                            ? "Bo‘sh qoldirilsa, mavjud parol saqlanadi."
                            : undefined
                        }
                      >
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={a.password}
                          onChange={(e) => update("password", e.target.value)}
                          placeholder={
                            p.id ? "Yangi parol yoki bo‘sh qoldiring" : "Parol"
                          }
                        />
                      </Field>
                      <Field label="Tegishli manzil">
                        <input
                          type="url"
                          value={a.url}
                          onChange={(e) => update("url", e.target.value)}
                          placeholder="https://…"
                          list="project-links"
                        />
                        <datalist id="project-links">
                          {p.links.map((l) => (
                            <option key={l.id} value={l.url}>
                              {l.label}
                            </option>
                          ))}
                        </datalist>
                      </Field>
                      <Field label="Izoh">
                        <input
                          value={a.note}
                          onChange={(e) => update("note", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
              <Button
                secondary
                onClick={() =>
                  change("accounts", [
                    ...p.accounts,
                    {
                      id: uid(),
                      label: "",
                      role: "",
                      login: "",
                      password: "",
                      url: "",
                      note: "",
                    },
                  ])
                }
              >
                <Plus size={17} />
                Hisob qo‘shish
              </Button>
            </>
          )}
          {section === "extra" && (
            <>
              <div className="form-section-intro">
                <h3>Reja va eslatmalar</h3>
              </div>
              {p.tasks.map((t) => (
                <div className="task-edit" key={t.id}>
                  <input
                    aria-label="Vazifa bajarildi"
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) =>
                      change(
                        "tasks",
                        p.tasks.map((x) =>
                          x.id === t.id ? { ...x, done: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="Vazifa matni"
                    value={t.text}
                    onChange={(e) =>
                      change(
                        "tasks",
                        p.tasks.map((x) =>
                          x.id === t.id ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Bajariladigan ish"
                  />
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Vazifani olib tashlash"
                    onClick={() =>
                      change(
                        "tasks",
                        p.tasks.filter((x) => x.id !== t.id),
                      )
                    }
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
              <Button
                secondary
                onClick={() =>
                  change("tasks", [
                    ...p.tasks,
                    { id: uid(), text: "", done: false },
                  ])
                }
              >
                <Plus size={16} />
                Vazifa qo‘shish
              </Button>
              <div className="spaced">
                <Field label="Eslatmalar">
                  <textarea
                    rows={3}
                    value={p.notes}
                    onChange={(e) => change("notes", e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-grid spaced">
                <Field label="Domen tugash sanasi">
                  <input
                    type="date"
                    value={p.domainExpiresAt?.slice(0, 10) || ""}
                    onChange={(e) =>
                      change("domainExpiresAt", e.target.value || null)
                    }
                  />
                </Field>
                <Field label="Hosting tugash sanasi">
                  <input
                    type="date"
                    value={p.hostingExpiresAt?.slice(0, 10) || ""}
                    onChange={(e) =>
                      change("hostingExpiresAt", e.target.value || null)
                    }
                  />
                </Field>
              </div>
              <div className="monitor-settings">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={p.monitor.enabled}
                    onChange={(e) =>
                      change("monitor", {
                        ...p.monitor,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  <Activity size={18} />
                  <strong>Soatlik monitoring</strong>
                </label>
                <p>
                  Manzilga ulanishda muammo bo‘lsa, Telegram orqali xabar
                  olasiz.
                </p>
                {p.monitor.enabled && (
                  <div className="form-grid">
                    <Field label="Tekshiriladigan manzil">
                      <input
                        type="url"
                        value={p.monitor.url}
                        onChange={(e) =>
                          change("monitor", {
                            ...p.monitor,
                            url: e.target.value,
                          })
                        }
                        placeholder="https://example.uz/health"
                      />
                    </Field>
                    <Field label="Kutiladigan HTTP kod">
                      <input
                        type="number"
                        min={100}
                        max={599}
                        value={p.monitor.expectedStatus}
                        onChange={(e) =>
                          change("monitor", {
                            ...p.monitor,
                            expectedStatus: Number(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <span className="save-note">
            <ShieldCheck size={15} />
            Saqlanganda zaxira olinadi
          </span>
          <Button secondary onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectDetail({
  project: p,
  groups,
  onClose,
  onEdit,
  copy,
  notify,
  onSave,
}: {
  project: Project;
  groups: Group[];
  onClose: () => void;
  onEdit: () => void;
  copy: (value: string) => Promise<void>;
  notify: (value: string) => void;
  onSave: (p: Project) => Promise<void>;
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({}),
    [working, setWorking] = useState(false);
  async function reveal(a: Account, clipboard = false) {
    try {
      const value =
        revealed[a.id] ??
        (await api(`/api/projects/${p.id}/accounts/${a.id}/reveal`)).password;
      if (clipboard) await copy(value);
      else setRevealed((prev) => ({ ...prev, [a.id]: value }));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <Modal title={p.name} onClose={onClose} wide>
      <div className="modal-body detail-body">
        <div className="detail-meta">
          <span className={`status status-${p.status}`}>
            {statusLabels[p.status]}
          </span>
          <span>{platformLabels[p.platform]}</span>
          <span>{p.ownership === "team" ? "Jamoa bilan" : "O‘zim"}</span>
          {p.groupId && (
            <span>{groups.find((g) => g.id === p.groupId)?.name}</span>
          )}
        </div>
        <p className="detail-description">
          {p.description || "Tavsif qo‘shilmagan."}
        </p>
        <div className="tags">
          {p.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
        <section className="detail-section">
          <h3>
            <LinkIcon size={18} />
            Havolalar <span>{p.links.length}</span>
          </h3>
          {p.links.length ? (
            p.links.map((l) => (
              <div className="link-row" key={l.id}>
                <div className="link-row-icon">
                  <Globe size={18} />
                </div>
                <div>
                  <strong>{l.label || "Havola"}</strong>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.url}
                  </a>
                  {l.note && <p className="account-note">{l.note}</p>}
                </div>
                <button
                  className="icon-button"
                  aria-label="Havolani nusxalash"
                  onClick={() => void copy(l.url)}
                >
                  <Copy size={16} />
                </button>
                <a
                  className="icon-button"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Havolani ochish"
                >
                  <ArrowUpRight size={19} />
                </a>
              </div>
            ))
          ) : (
            <p className="section-empty">Havolalar hali qo‘shilmagan.</p>
          )}
        </section>
        <section className="detail-section">
          <h3>
            <LockKeyhole size={18} />
            Hisoblar <span>{p.accounts.length}</span>
          </h3>
          {p.accounts.length ? (
            p.accounts.map((a) => (
              <div className="account-card" key={a.id}>
                <div className="account-heading">
                  <strong>{a.label || a.role || "Hisob"}</strong>
                  <span>{a.role}</span>
                </div>
                <div className="credentials-grid">
                  <div>
                    <label>Login</label>
                    <div className="credential-value">
                      <code>{a.login || "—"}</code>
                      <button
                        className="icon-button"
                        aria-label="Loginni nusxalash"
                        onClick={() => void copy(a.login)}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label>Parol</label>
                    <div className="credential-value">
                      <code>
                        {revealed[a.id] !== undefined
                          ? revealed[a.id]
                          : "••••••••••"}
                      </code>
                      <button
                        className="icon-button"
                        aria-label={
                          revealed[a.id] !== undefined
                            ? "Parolni yashirish"
                            : "Parolni ko‘rsatish"
                        }
                        onClick={() =>
                          revealed[a.id] !== undefined
                            ? setRevealed((prev) => {
                                const next = { ...prev };
                                delete next[a.id];
                                return next;
                              })
                            : void reveal(a)
                        }
                      >
                        {revealed[a.id] !== undefined ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Parolni nusxalash"
                        onClick={() => void reveal(a, true)}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {a.url && (
                  <a
                    className="account-url"
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowUpRight size={14} />
                    {a.url}
                  </a>
                )}
                {a.note && <p className="account-note">{a.note}</p>}
              </div>
            ))
          ) : (
            <p className="section-empty">Hisoblar hali qo‘shilmagan.</p>
          )}
        </section>
        {p.tasks.length > 0 && (
          <section className="detail-section">
            <h3>
              <Check size={18} />
              Vazifalar{" "}
              <span>
                {p.tasks.filter((t) => t.done).length}/{p.tasks.length}
              </span>
            </h3>
            {p.tasks.map((t) => (
              <label className={`task-row ${t.done ? "done" : ""}`} key={t.id}>
                <input
                  disabled={working}
                  type="checkbox"
                  checked={t.done}
                  onChange={async (e) => {
                    setWorking(true);
                    try {
                      await onSave({
                        ...p,
                        tasks: p.tasks.map((x) =>
                          x.id === t.id ? { ...x, done: e.target.checked } : x,
                        ),
                      });
                    } catch {
                    } finally {
                      setWorking(false);
                    }
                  }}
                />
                <span>{t.text}</span>
              </label>
            ))}
          </section>
        )}
        {p.notes && (
          <section className="detail-section">
            <h3>Eslatmalar</h3>
            <p className="notes-text">{p.notes}</p>
          </section>
        )}
        {(p.domainExpiresAt || p.hostingExpiresAt) && (
          <div className="detail-dates">
            <div>
              <small>Domen muddati</small>
              <strong>{day(p.domainExpiresAt)}</strong>
            </div>
            <div>
              <small>Hosting muddati</small>
              <strong>{day(p.hostingExpiresAt)}</strong>
            </div>
          </div>
        )}
        {p.monitor.enabled && (
          <section className="detail-section">
            <h3>
              <Activity size={18} />
              Monitoring
            </h3>
            <div className="monitor-summary">
              <span
                className={p.monitor.status === "down" ? "danger" : "success"}
              >
                {monitorLabel(p.monitor.status)}
              </span>
              <small>Oxirgi tekshiruv: {date(p.monitor.lastCheckedAt)}</small>
              <span className="break-all">{p.monitor.url}</span>
              {p.monitor.error && (
                <p className="form-error">{p.monitor.error}</p>
              )}
            </div>
          </section>
        )}
        <p className="updated-note">Yangilangan: {date(p.updatedAt)}</p>
      </div>
      <div className="modal-actions">
        <Button
          secondary
          onClick={async () => {
            try {
              await onSave({
                ...p,
                status: p.status === "archived" ? "paused" : "archived",
              });
            } catch {}
          }}
        >
          <Archive size={16} />
          {p.status === "archived" ? "Arxivdan chiqarish" : "Arxivlash"}
        </Button>
        <Button onClick={onEdit}>
          <Pencil size={16} />
          Tahrirlash
        </Button>
      </div>
    </Modal>
  );
}

function GroupManager({
  groups,
  onClose,
  reload,
  notify,
}: {
  groups: Group[];
  onClose: () => void;
  reload: () => Promise<void>;
  notify: (value: string) => void;
}) {
  const [name, setName] = useState(""),
    [color, setColor] = useState("#82a95d"),
    [editId, setEditId] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/groups" + (editId ? "/" + editId : ""), {
        method: editId ? "PUT" : "POST",
        body: JSON.stringify({ name, color }),
      });
      await reload();
      setName("");
      setEditId("");
      notify("Guruh saqlandi.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Guruhlarni boshqarish" onClose={onClose}>
      <div className="modal-body">
        <form onSubmit={submit}>
          <div className="group-create">
            <Field label="Guruh nomi">
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan, Shaxsiy loyihalar"
              />
            </Field>
            <Field label="Rang">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </Field>
          </div>
          <Button disabled={busy} type="submit">
            <Plus size={16} />
            {editId ? "Yangilash" : "Guruh qo‘shish"}
          </Button>
          {editId && (
            <Button
              secondary
              onClick={() => {
                setEditId("");
                setName("");
              }}
            >
              Bekor qilish
            </Button>
          )}
        </form>
        <div className="group-list">
          {groups.map((g) => (
            <div className="group-row" key={g.id}>
              <span className="group-dot" style={{ background: g.color }} />
              <strong>{g.name}</strong>
              <button
                className="icon-button"
                aria-label={`${g.name} guruhini tahrirlash`}
                onClick={() => {
                  setEditId(g.id);
                  setName(g.name);
                  setColor(g.color);
                }}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`${g.name} guruhini o‘chirish`}
                onClick={async () => {
                  if (
                    !confirm(
                      "Guruh o‘chirilsinmi? Ichidagi loyihalar saqlanadi.",
                    )
                  )
                    return;
                  try {
                    await api("/api/groups/" + g.id, { method: "DELETE" });
                    await reload();
                    notify("Guruh o‘chirildi.");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function SettingsPanel({
  state,
  reload,
  notify,
}: {
  state: State;
  reload: () => Promise<void>;
  notify: (value: string) => void;
}) {
  const [busy, setBusy] = useState("");
  async function settings(e: FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    setBusy(kind);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(data) });
      notify("Sozlamalar saqlandi.");
      form.reset();
      await reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function restore(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !confirm(
        "Zaxiradagi ma’lumotlar hozirgi loyihalar va guruhlar o‘rniga tiklanadi. Davom etasizmi?",
      )
    )
      return;
    setBusy("restore");
    try {
      await api("/api/restore", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      notify("Zaxira muvaffaqiyatli tiklandi.");
      await reload();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SHAXSIY MAYDON</span>
          <h1>Sozlamalar</h1>
          <p>Hisobingiz, Telegram va avtomatik zaxiralar.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-heading">
            <LockKeyhole />
            <div>
              <h2>Kirish ma’lumotlari</h2>
              <p>Platformaga kirish login va paroli.</p>
            </div>
          </div>
          <form onSubmit={(e) => void settings(e, "auth")}>
            <Field label="Login">
              <input
                name="login"
                defaultValue={state.settings.login}
                required
                autoComplete="username"
              />
            </Field>
            <Field label="Joriy parol">
              <input
                name="currentPassword"
                required
                type="password"
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="Yangi parol"
              hint="O‘zgartirmaslik uchun bo‘sh qoldiring."
            >
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" disabled={!!busy}>
              {busy === "auth" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Saqlash
            </Button>
          </form>
        </section>
        <section className="settings-card">
          <div className="settings-heading">
            <Send />
            <div>
              <h2>Telegram va fon xizmati</h2>
              <p>Xabarlar faqat shaxsiy chattingizga yuboriladi.</p>
            </div>
          </div>
          <div className="setting-status">
            <span>Telegram bot</span>
            <strong
              className={
                state.settings.telegramConfigured ? "success" : "danger"
              }
            >
              {state.settings.telegramConfigured ? "Ulangan" : "Sozlanmagan"}
            </strong>
          </div>
          <div className="setting-status">
            <span>Qabul qiluvchi ID</span>
            <code>{state.settings.telegramChatId || "—"}</code>
          </div>
          <div className="setting-status">
            <span>Fon xizmati oxirgi ishlagan</span>
            <strong>{date(state.worker?.lastHeartbeatAt)}</strong>
          </div>
          <div className="info-box">
            <Bell size={18} />
            <p>
              Botga loyiha nomini yuboring — kerakli havolalarni topib beradi.
              Monitoring va muddat xabarlari ham shu yerga keladi.
            </p>
          </div>
        </section>
        <section className="settings-card">
          <div className="settings-heading">
            <ShieldCheck />
            <div>
              <h2>Parolli ZIP zaxira</h2>
              <p>Har qo‘shish va tahrirlashdan keyin avtomatik.</p>
            </div>
          </div>
          <div className="setting-status">
            <span>Doimiy ZIP paroli</span>
            <strong className="success">
              {state.settings.zipPasswordConfigured
                ? "O‘rnatilgan"
                : "O‘rnatilmagan"}
            </strong>
          </div>
          <form onSubmit={(e) => void settings(e, "backup")}>
            <Field label="Joriy kirish paroli">
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="Yangi doimiy ZIP paroli"
              hint="Keyingi zaxiralar yangi parol bilan yaratiladi."
            >
              <input
                name="backupPassword"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </Field>
            <Button secondary type="submit" disabled={!!busy}>
              ZIP parolini yangilash
            </Button>
          </form>
          <div className="settings-divider" />
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy("manual");
              try {
                await api("/api/backups", { method: "POST" });
                notify("Zaxira Telegramga yuborish navbatiga qo‘shildi.");
                await reload();
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            <Download size={17} />
            Hozir zaxira olish
          </Button>
        </section>
        <section className="settings-card">
          <div className="settings-heading">
            <Archive />
            <div>
              <h2>Zaxiradan tiklash</h2>
              <p>Telegramdan olingan ZIP arxivni tanlang.</p>
            </div>
          </div>
          <form onSubmit={(e) => void restore(e)}>
            <Field label="ZIP fayl">
              <input
                type="file"
                name="file"
                accept=".zip,application/zip"
                required
              />
            </Field>
            <Field label="Arxiv paroli">
              <input
                name="password"
                required
                type="password"
                autoComplete="off"
              />
            </Field>
            <p className="restore-note">
              Tiklash mavjud loyihalar va guruhlarni zaxiradagi nusxa bilan
              almashtiradi. Platformaga kirish parolingiz o‘zgarmaydi.
            </p>
            <Button secondary type="submit" disabled={!!busy}>
              {busy === "restore" ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Archive size={16} />
              )}
              Zaxirani tiklash
            </Button>
          </form>
        </section>
      </div>
      <section className="settings-card backup-history">
        <div className="settings-heading">
          <Clock />
          <div>
            <h2>Zaxiralar tarixi</h2>
            <p>Oxirgi zaxiralar va Telegramga yuborish holati.</p>
          </div>
        </div>
        {state.backups.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Yaratilgan</th>
                  <th>Holati</th>
                  <th>Yuborilgan</th>
                  <th>Izoh</th>
                </tr>
              </thead>
              <tbody>
                {state.backups.map((b) => (
                  <tr key={b.id}>
                    <td>{date(b.createdAt)}</td>
                    <td>
                      <span
                        className={`status ${["sent", "completed"].includes(b.status) ? "status-live" : b.status === "failed" ? "status-paused" : "status-building"}`}
                      >
                        {(
                          {
                            sent: "Yuborildi",
                            completed: "Yuborildi",
                            pending: "Navbatda",
                            processing: "Yuborilmoqda",
                            failed: "Qayta uriniladi",
                            retry: "Qayta uriniladi",
                          } as Record<string, string>
                        )[b.status] || b.status}
                      </span>
                    </td>
                    <td>{date(b.sentAt)}</td>
                    <td>{b.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="section-empty">
            Birinchi o‘zgarishingizdan keyin zaxira shu yerda ko‘rinadi.
          </p>
        )}
      </section>
    </>
  );
}
