import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { Routes, Route, Link, NavLink, Navigate, useNavigate, useParams } from "react-router-dom";
import { api } from "./api";

const CATEGORIES = ["Electronics", "Books", "ID Card", "Clothing", "Accessories", "Keys", "Other"];
const slug = s => s.toLowerCase().replace(/\s+/g, "-");
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/* ---------- auth ---------- */
const AuthCtx = createContext(null);
const useAuth = () => useContext(AuthCtx);
const norm = u => u && { id: u.id || u._id, name: u.name, email: u.email, role: u.role };

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("cf_user") || "null"); } catch { return null; } });
  const [ready, setReady] = useState(!localStorage.getItem("cf_token"));
  const store = u => { localStorage.setItem("cf_user", JSON.stringify(u)); setUser(u); };
  const logout = useCallback(() => { localStorage.removeItem("cf_token"); localStorage.removeItem("cf_user"); setUser(null); }, []);
  const save = d => { localStorage.setItem("cf_token", d.token); store(norm(d.user)); };

  useEffect(() => {
    // refresh role/name from the server so admin changes apply without re-login
    if (localStorage.getItem("cf_token"))
      api("/auth/me").then(d => store(norm(d.user))).catch(() => {}).finally(() => setReady(true));
    window.addEventListener("cf-logout", logout);
    return () => window.removeEventListener("cf-logout", logout);
  }, [logout]);

  return <AuthCtx.Provider value={{ user, ready, save, logout }}>{children}</AuthCtx.Provider>;
}

function Protected({ children, admin = false }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="empty">Checking your session…</div>;
  if (!user) return <div className="empty">Please <Link to="/login">log in</Link> to continue.</div>;
  if (admin && user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

/* ---------- shared bits ---------- */
function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header>
      <Link className="brand" to="/">Campus<span>Find</span></Link>
      <nav>
        <NavLink to="/" end>Explore</NavLink>
        {user && <><NavLink to="/post">Report item</NavLink><NavLink to="/mine">My dashboard</NavLink></>}
        {user?.role === "admin" && <NavLink className="adminlink" to="/admin">Admin</NavLink>}
        {!user
          ? <Link className="navbtn" to="/login">Login</Link>
          : <button className="ghost" onClick={() => { logout(); nav("/"); }}>Logout</button>}
      </nav>
    </header>
  );
}
function Shell({ children }) {
  return <><Nav /><main>{children}</main><footer>CampusFind. A campus community, helping things find their way home.</footer></>;
}
const Notice = ({ error }) => (error ? <p className="notice" role="alert">{error}</p> : null);
const Status = ({ value }) => <span className={`status s-${slug(value)}`}>{value}</span>;

function ItemCard({ item }) {
  return (
    <Link className="item-card" to={`/items/${item._id}`}>
      <div className="card-top"><span className={`tag ${item.type.toLowerCase()}`}>{item.type}</span><Status value={item.status} /></div>
      <h3>{item.title}</h3>
      <p>{item.description.slice(0, 105)}{item.description.length > 105 ? "…" : ""}</p>
      <div className="meta"><span>{item.location}</span><span>{fmtDate(item.eventDate)}</span></div>
      <div className="card-foot"><span>{item.category}</span><b>View details</b></div>
    </Link>
  );
}

/* ---------- home ---------- */
function Home() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ search: "", type: "", category: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
        setItems((await api(`/items?${q}`)).items); setError("");
      } catch (e) { setError(e.message); }
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [f]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const filtered = Object.values(f).some(Boolean);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Lost something? Found something?</p>
        <h1>Give lost things a way back home.</h1>
        <p className="sub">A shared noticeboard for your campus. Report an item, search listings, and help reunite people with their belongings.</p>
        <div className="hero-actions"><Link className="btn" to="/post">Report an item</Link><a className="textlink" href="#listings">Browse listings</a></div>
      </section>
      <section id="listings" className="section">
        <div className="section-head">
          <div><p className="eyebrow">Community board</p><h2>Recent reports</h2></div>
          <div className="filters">
            <input placeholder="Search item or location…" value={f.search} onChange={e => set("search", e.target.value)} />
            <select value={f.type} onChange={e => set("type", e.target.value)}><option value="">Lost and found</option><option>Lost</option><option>Found</option></select>
            <select value={f.category} onChange={e => set("category", e.target.value)}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            <select value={f.status} onChange={e => set("status", e.target.value)}><option value="">Any status</option><option>Open</option><option>Claim Pending</option><option>Returned</option></select>
          </div>
        </div>
        <Notice error={error} />
        {loading && !items.length ? <div className="cards">{[1, 2, 3].map(i => <div key={i} className="item-card skeleton" />)}</div>
          : <div className="cards">{items.map(i => <ItemCard key={i._id} item={i} />)}</div>}
        {!loading && !items.length && !error && (
          <div className="empty">{filtered ? "No reports match these filters. Try clearing a filter." : "No listings yet. Be the first to report an item."}</div>
        )}
      </section>
    </>
  );
}

/* ---------- auth pages ---------- */
function AuthPage({ mode }) {
  const { save } = useAuth(), nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { save(await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(form) })); nav("/"); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }
  const login = mode === "login";
  return (
    <div className="form-wrap">
      <form className="panel" onSubmit={submit}>
        <p className="eyebrow">{login ? "Welcome back" : "Join the campus community"}</p>
        <h2>{login ? "Sign in" : "Create your account"}</h2>
        <Notice error={error} />
        {!login && <label>Full name<input required value={form.name} onChange={e => set("name", e.target.value)} /></label>}
        <label>Email<input type="email" required value={form.email} onChange={e => set("email", e.target.value)} /></label>
        <label>Password<input type="password" minLength="6" required value={form.password} onChange={e => set("password", e.target.value)} /></label>
        <button className="btn full" disabled={busy}>{busy ? "Please wait…" : login ? "Login" : "Register"}</button>
        <p className="muted">{login ? "New here? " : "Already registered? "}<Link to={login ? "/register" : "/login"}>{login ? "Create an account" : "Sign in"}</Link></p>
      </form>
    </div>
  );
}

/* ---------- post ---------- */
function Post() {
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: "", description: "", category: "Electronics", type: "Lost", location: "", eventDate: today, contact: "" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try { nav(`/items/${(await api("/items", { method: "POST", body: JSON.stringify(form) })).item._id}`); }
    catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <div className="form-wrap">
      <form className="panel wide" onSubmit={submit}>
        <p className="eyebrow">Make a report</p>
        <h2>Tell the campus what happened.</h2>
        <Notice error={error} />
        <div className="two">
          <label>Report type<select value={form.type} onChange={e => set("type", e.target.value)}><option>Lost</option><option>Found</option></select></label>
          <label>Category<select value={form.category} onChange={e => set("category", e.target.value)}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
        </div>
        <label>Item title<input required maxLength="80" value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Black water bottle" /></label>
        <label>Description<textarea required rows="4" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Add colour, brand, identifying marks…" /></label>
        <div className="two">
          <label>Location<input required value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Library, Block B" /></label>
          <label>Date<input type="date" required max={today} value={form.eventDate} onChange={e => set("eventDate", e.target.value)} /></label>
        </div>
        <label>Contact details<input required value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="Email or phone (use demo details)" /></label>
        <p className="hint">Contact details are only shown to logged-in members.</p>
        <button className="btn full" disabled={busy}>{busy ? "Publishing…" : "Publish report"}</button>
      </form>
    </div>
  );
}

/* ---------- detail ---------- */
function Detail() {
  const { id } = useParams(), nav = useNavigate(), { user } = useAuth();
  const [data, setData] = useState(null), [message, setMessage] = useState("");
  const [error, setError] = useState(""), [refresh, setRefresh] = useState(0);

  useEffect(() => { api(`/items/${id}`).then(d => { setData(d); setError(""); }).catch(e => setError(e.message)); }, [id, refresh, user?.id]);
  const act = fn => async (...a) => { try { await fn(...a); setError(""); setRefresh(x => x + 1); } catch (e) { setError(e.message); } };

  const claim = act(async e => { e.preventDefault(); await api(`/claims/${id}`, { method: "POST", body: JSON.stringify({ message }) }); setMessage(""); });
  const decide = act((cid, status) => api(`/claims/${cid}`, { method: "PATCH", body: JSON.stringify({ status }) }));
  const setStatus = act(status => api(`/items/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }));
  async function remove() {
    if (!confirm("Delete this listing and all its claims? This cannot be undone.")) return;
    try { await api(`/items/${id}`, { method: "DELETE" }); nav("/"); } catch (e) { setError(e.message); }
  }

  if (!data) return <div className="empty">{error || "Loading item…"}</div>;
  const { item, claims, myClaim, canManage } = data;
  const isOwner = user && item.owner?._id === user.id;
  const isAdmin = user?.role === "admin";

  return (
    <section className="detail panel">
      <Link to="/" className="textlink">Back to listings</Link>
      <div className="detail-head"><span className={`tag ${item.type.toLowerCase()}`}>{item.type}</span><Status value={item.status} /></div>
      <h1>{item.title}</h1>
      <p className="detail-desc">{item.description}</p>
      <div className="detail-grid">
        <div><small>Location</small><b>{item.location}</b></div>
        <div><small>Date</small><b>{fmtDate(item.eventDate)}</b></div>
        <div><small>Category</small><b>{item.category}</b></div>
        <div><small>Reported by</small><b>{item.owner?.name || "Campus member"}</b></div>
      </div>
      <div className="contact-box"><small>Contact details</small>{item.contact ? <b>{item.contact}</b> : <span><Link to="/login">Log in</Link> to see contact details</span>}</div>
      <Notice error={error} />

      {canManage && (
        <div className="manage">
          <p className="eyebrow">{isAdmin && !isOwner ? "Admin controls" : "Manage listing"}</p>
          <div className="row">
            {item.status !== "Returned"
              ? <button className="btn" onClick={() => setStatus("Returned")}>Mark as returned</button>
              : <button className="ghost" onClick={() => setStatus("Open")}>Reopen listing</button>}
            <button className="danger" onClick={remove}>Delete listing</button>
          </div>
          <h3>Claims received</h3>
          {!claims.length && <p className="muted left">No claims yet.</p>}
          {claims.map(c => (
            <div className="claim" key={c._id}>
              <div className="row between"><b>{c.claimant?.name || "Deleted user"}</b><Status value={c.status} /></div>
              <p>{c.message}</p>
              {c.claimant?.email && <small className="muted left">{c.claimant.email}</small>}
              {c.status === "Pending" && <div className="row"><button onClick={() => decide(c._id, "Approved")}>Approve</button><button className="ghost" onClick={() => decide(c._id, "Rejected")}>Reject</button></div>}
            </div>
          ))}
        </div>
      )}

      {user && !canManage && myClaim && (
        <div className="claim"><div className="row between"><b>Your claim</b><Status value={myClaim.status} /></div><p>{myClaim.message}</p></div>
      )}
      {user && !canManage && !myClaim && item.type === "Found" && item.status !== "Returned" && (
        <form onSubmit={claim} className="claim-form">
          <h3>Think this belongs to you?</h3>
          <label>Describe identifying details<textarea rows="3" required value={message} onChange={e => setMessage(e.target.value)} placeholder="Mention details only the owner would know…" /></label>
          <button className="btn">Submit claim</button>
        </form>
      )}
      {!user && item.type === "Found" && <p className="muted left"><Link to="/login">Log in</Link> to claim this item.</p>}
    </section>
  );
}

/* ---------- my dashboard ---------- */
function Mine() {
  const [items, setItems] = useState([]), [claims, setClaims] = useState([]), [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/items/mine"), api("/claims/mine")]).then(([a, b]) => { setItems(a.items); setClaims(b.claims); }).catch(e => setError(e.message));
  }, []);
  return (
    <section className="section">
      <p className="eyebrow">Your activity</p><h2>My dashboard</h2>
      <Notice error={error} />
      <h3>Your reports</h3>
      <div className="cards">{items.map(i => <ItemCard key={i._id} item={i} />)}</div>
      {!items.length && <div className="empty">You have not reported anything yet. <Link to="/post">Report an item</Link></div>}
      <h3>Your submitted claims</h3>
      {claims.map(c => (
        <div className="claim" key={c._id}>
          <div className="row between">{c.item ? <Link to={`/items/${c.item._id}`}><b>{c.item.title}</b></Link> : <b>Listing removed</b>}<Status value={c.status} /></div>
          <p>{c.message}</p>
        </div>
      ))}
      {!claims.length && <p className="muted left">No claims submitted.</p>}
    </section>
  );
}

/* ---------- admin ---------- */
function Admin() {
  const [ov, setOv] = useState(null), [items, setItems] = useState([]), [q, setQ] = useState(""), [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const [a, b] = await Promise.all([api("/admin/overview"), api("/items")]); setOv(a); setItems(b.items); setError(""); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(item) {
    if (!confirm(`Delete "${item.title}" and its claims?`)) return;
    try { await api(`/items/${item._id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  }
  const shown = items.filter(i => `${i.title} ${i.location} ${i.owner?.name || ""}`.toLowerCase().includes(q.toLowerCase()));
  const s = ov?.stats;

  return (
    <section className="section">
      <p className="eyebrow">Moderation</p><h2>Admin panel</h2>
      <Notice error={error} />
      {s && <div className="stats">
        {[["Users", s.users], ["Listings", s.items], ["Open", s.open], ["Returned", s.returned], ["Pending claims", s.pendingClaims]].map(([l, n]) => <div className="stat" key={l}><b>{n}</b><span>{l}</span></div>)}
      </div>}
      <div className="section-head"><h3>All listings</h3><div className="filters"><input placeholder="Filter by title, place or owner…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Item</th><th>Type</th><th>Status</th><th>Owner</th><th>Posted</th><th></th></tr></thead>
        <tbody>{shown.map(i => (
          <tr key={i._id}>
            <td><Link to={`/items/${i._id}`}>{i.title}</Link><small>{i.location}</small></td>
            <td><span className={`tag ${i.type.toLowerCase()}`}>{i.type}</span></td>
            <td><Status value={i.status} /></td>
            <td>{i.owner?.name || "Deleted user"}</td>
            <td>{fmtDate(i.createdAt)}</td>
            <td><button className="danger" onClick={() => remove(i)}>Delete</button></td>
          </tr>))}
        </tbody>
      </table>{!shown.length && <div className="empty">No listings found.</div>}</div>
      <h3>Newest users</h3>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
        <tbody>{ov?.users.map(u => <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{fmtDate(u.createdAt)}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/post" element={<Protected><Post /></Protected>} />
          <Route path="/items/:id" element={<Detail />} />
          <Route path="/mine" element={<Protected><Mine /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<div className="empty">Page not found. <Link to="/">Go home</Link></div>} />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}
