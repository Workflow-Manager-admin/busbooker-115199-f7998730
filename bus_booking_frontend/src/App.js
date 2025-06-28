import React, { useState, useEffect } from "react";
import "./App.css";

// Color palette from project spec
const COLORS = {
  primary: "#1976D2",
  secondary: "#388E3C",
  accent: "#FFC107",
};

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// PUBLIC_INTERFACE
function App() {
  // UI routing/page management
  const [page, setPage] = useState("search");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Auth state
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  // Search/filter state
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [busList, setBusList] = useState([]);
  const [loadingBuses, setLoadingBuses] = useState(false);
  const [busSearchError, setBusSearchError] = useState("");

  // Seat selection/booking state
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState({ card: "", name: "" });
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [ticketDownloadUrl, setTicketDownloadUrl] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Theme
  const [theme, setTheme] = useState("light");

  // =========================
  // Auth Logic
  // =========================
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Persist auth using localStorage if needed
    const saved = localStorage.getItem("bbAuth");
    if (saved) {
      const data = JSON.parse(saved);
      setToken(data.token);
      setUser(data.user);
    }
    // eslint-disable-next-line
  }, []);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("bbAuth");
    setPage("search");
  };

  // PUBLIC_INTERFACE
  const handleAuth = async (mode, form) => {
    if (!form.email || !form.password) {
      return { error: "Both fields required." };
    }
    try {
      const url =
        mode === "login"
          ? `${API_BASE}/auth/login`
          : `${API_BASE}/auth/register`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await resp.json();
      if (!resp.ok) {
        return { error: json.detail || "Authentication failed" };
      }
      setToken(json.access_token);
      setUser(json.user || { email: form.email });
      localStorage.setItem(
        "bbAuth",
        JSON.stringify({ token: json.access_token, user: json.user })
      );
      setShowAuth(false);
      return {};
    } catch (e) {
      return { error: "Network error" };
    }
  };

  // =========================
  // Bus Search
  // =========================
  const searchBuses = async () => {
    setBusList([]);
    setLoadingBuses(true);
    setBusSearchError("");
    setSelectedBus(null);
    setSelectedSeats([]);
    try {
      const resp = await fetch(
        `${API_BASE}/buses?from=${encodeURIComponent(
          from
        )}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!resp.ok) {
        const json = await resp.json();
        throw new Error(json.detail || "Search failed");
      }
      const buses = await resp.json();
      setBusList(buses || []);
    } catch (e) {
      setBusSearchError(e.message || "Failed to fetch buses");
    }
    setLoadingBuses(false);
  };

  // =========================
  // Seat Selection & Booking
  // =========================
  const chooseBus = (bus) => {
    setSelectedBus(bus);
    setSelectedSeats([]);
    setBookingModalOpen(true);
    setBookingError("");
    setBookingSuccess("");
  };

  const toggleSeat = (row, col) => {
    const seatKey = `${row + 1}-${col + 1}`;
    setSelectedSeats((prev) =>
      prev.includes(seatKey)
        ? prev.filter((s) => s !== seatKey)
        : prev.length < 6 // max 6 seats
        ? prev.concat([seatKey])
        : prev
    );
  };

  const bookSeats = async () => {
    setBookingError("");
    setBookingSuccess("");
    if (!(selectedBus && selectedSeats.length)) {
      setBookingError("Select at least one seat.");
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bus_id: selectedBus.id,
          seats: selectedSeats,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json.detail || "Booking failed");
      }
      setBookingSuccess("Seats reserved. Proceed to payment.");
      setShowPayment(true);
      // Save booking reference if needed for payment
      setPaymentInfo((prev) => ({
        ...prev,
        booking_id: json.booking_id,
        amount: json.amount || selectedSeats.length * selectedBus.price,
      }));
    } catch (e) {
      setBookingError(e.message || "Failed to book");
    }
  };

  // =========================
  // Payment
  // =========================
  const payForTicket = async (info) => {
    setPaymentError("");
    setPaymentProcessing(true);
    setTicketDownloadUrl(null);
    try {
      const resp = await fetch(`${API_BASE}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          booking_id: paymentInfo.booking_id,
          card: info.card,
          name: info.name,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.detail || "Payment failed");
      setPaymentProcessing(false);
      setTicketDownloadUrl(result.ticket_pdf_url || "");
      setShowPayment(false);
      setBookingSuccess("Payment successful!");
      setTimeout(() => setBookingModalOpen(false), 1800);
    } catch (e) {
      setPaymentProcessing(false);
      setPaymentError(e.message);
    }
  };

  // =========================
  // Booking History
  // =========================
  const loadHistory = async () => {
    setLoadingHistory(true);
    setHistory([]);
    try {
      const resp = await fetch(`${API_BASE}/bookings/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error("Could not fetch tickets.");
      const json = await resp.json();
      setHistory(json);
    } catch (e) {
      setHistory([]);
    }
    setLoadingHistory(false);
  };

  // UI Pages
  const showPage = (screen) => {
    setPage(screen);
    if (screen === "history" && token) loadHistory();
  };

  // Auth Modal Form
  function AuthModal({ mode, onClose, onDone }) {
    const [form, setForm] = useState({ email: "", password: "" });
    const [msg, setMsg] = useState("");
    async function submit(e) {
      e.preventDefault();
      setMsg("");
      const r = await handleAuth(mode, form);
      if (r.error) setMsg(r.error);
      else {
        setForm({ email: "", password: "" });
        if (onDone) onDone();
      }
    }
    return (
      <div style={modalBackdropStyle}>
        <form className="modal" onSubmit={submit}>
          <h2>{mode === "login" ? "Sign in" : "Register"}</h2>
          <input
            autoFocus
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            style={inputStyle}
          />
          <button className="btn btn-primary" style={{ ...primaryBtnStyle, width: "100%" }}>
            {mode === "login" ? "Login" : "Register"}
          </button>
          {msg && <p style={{ color: "#d32f2f"}}>{msg}</p>}
          <div style={{ marginTop: 16 }}>
            {mode === "login" ? (
              <span>
                No account?{" "}
                <button
                  type="button"
                  style={linkBtnStyle}
                  onClick={() => setAuthMode("register")}
                >
                  Register
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  style={linkBtnStyle}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ ...secondaryBtnStyle, width: "100%", marginTop: 12 }}
          >
            Close
          </button>
        </form>
      </div>
    );
  }

  // Payment modal
  function PaymentModal({ onClose, bookingId, amount }) {
    const [form, setForm] = useState({ card: "", name: "" });
    return (
      <div style={modalBackdropStyle}>
        <form className="modal" onSubmit={(e) => { e.preventDefault(); payForTicket(form); }}>
          <h2>Payment</h2>
          <p>Booking ID: <strong>{bookingId}</strong></p>
          <p>Total: <strong>₹{amount}</strong></p>
          <input
            required
            placeholder="Card Number"
            type="text"
            value={form.card}
            onChange={(e) => setForm((f) => ({ ...f, card: e.target.value }))}
            style={inputStyle}
            maxLength={16}
          />
          <input
            required
            placeholder="Cardholder Name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          <button
            disabled={paymentProcessing}
            className="btn btn-primary"
            style={{ ...primaryBtnStyle, width: "100%" }}
          >
            {paymentProcessing ? "Processing..." : "Pay"}
          </button>
          {paymentError && <p style={{ color: "#d32f2f" }}>{paymentError}</p>}
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ ...secondaryBtnStyle, width: "100%", marginTop: 12 }}
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  // Seat map UI for minimal 4x8 seat bus (configurable)
  function SeatSelector({ bus, taken, selected, onToggle }) {
    // Assume a grid: rows=4, cols=8 for demo
    const rows = 4, cols = 8;
    const seats = [];
    for (let r = 0; r < rows; ++r) {
      const rowSeats = [];
      for (let c = 0; c < cols; ++c) {
        const seatKey = `${r + 1}-${c + 1}`;
        let status = "available";
        if ((taken || []).includes(seatKey)) status = "taken";
        if ((selected || []).includes(seatKey)) status = "selected";
        rowSeats.push(
          <button
            key={seatKey}
            className="seat"
            style={{
              ...seatStyle,
              background:
                status === "selected"
                  ? COLORS.secondary
                  : status === "taken"
                  ? "#ccc"
                  : "#FFF",
              color:
                status === "taken"
                  ? "#888"
                  : status === "selected"
                  ? "#FFF"
                  : "#222",
              borderColor: status === "selected" ? COLORS.secondary : "#bbb",
              cursor: status === "taken" ? "not-allowed" : "pointer",
            }}
            disabled={status === "taken"}
            onClick={() => onToggle(r, c)}
            aria-label={
              status === "taken"
                ? "Seat taken"
                : status === "selected"
                ? "Selected"
                : "Available"
            }
          >
            {seatKey}
          </button>
        );
      }
      seats.push(
        <div key={r} style={{ display: "flex", gap: 6 }}>
          {rowSeats}
        </div>
      );
    }
    return (
      <div style={{ margin: "24px 0" }}>
        <h4 style={{ margin: "10px 0 4px 0" }}>Choose seats</h4>
        {seats}
        <div style={{ fontSize: 12, marginTop: 8, color: "#888" }}>
          <strong>Legend:</strong>{" "}
          <span style={{ color: "#1976D2" }}>Available</span> |{" "}
          <span style={{ color: COLORS.secondary }}>Selected</span> |{" "}
          <span style={{ color: "#888" }}>Taken</span>
        </div>
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="App" style={{ minHeight: "100vh", background: "var(--bg-primary)", fontFamily: "Inter, sans-serif" }}>
      {/* Top Navigation */}
      <nav style={navbarStyle}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={logoStyle}>🚌 BusBooker</span>
        </div>
        <div>
          <button
            style={{
              ...topNavBtnStyle,
              color: page === "search" ? COLORS.primary : "#222",
            }}
            onClick={() => showPage("search")}
          >
            Find Bus
          </button>
          {token && (
            <button
              style={{
                ...topNavBtnStyle,
                color: page === "history" ? COLORS.primary : "#222",
              }}
              onClick={() => showPage("history")}
            >
              My Tickets
            </button>
          )}
        </div>
        <div>
          {user ? (
            <span>
              <span style={{ fontWeight: 500, marginRight: 8 }}>Hello, {user.email?.split("@")[0] || "user"}</span>
              <button style={secondaryBtnStyle} onClick={handleLogout}>Logout</button>
            </span>
          ) : (
            <span>
              <button
                style={primaryBtnStyle}
                onClick={() => {
                  setShowAuth(true);
                  setAuthMode("login");
                }}
              >
                Login
              </button>
            </span>
          )}
          <button
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.3em",
              marginLeft: 10,
              cursor: "pointer",
              verticalAlign: "middle",
            }}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </nav>
      {/* Main content */}
      <div style={{ display: "flex", flexGrow: 1, justifyContent: "center", margin: "0 auto", maxWidth: 1200 }}>
        {page === "search" && (
          <section style={{ flex: "1 1 60%", padding: 24 }}>
            {/* Bus search form */}
            <h2>
              <span style={{ color: COLORS.primary }}>Search Buses</span>
            </h2>
            <form
              style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}
              onSubmit={(e) => {
                e.preventDefault();
                searchBuses();
              }}
            >
              <input
                type="text"
                placeholder="From"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="To"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={inputStyle}
              />
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
              <button
                type="submit"
                className="btn"
                style={primaryBtnStyle}
                disabled={loadingBuses}
              >
                {loadingBuses ? "Searching..." : "Search"}
              </button>
            </form>
            {busSearchError && (
              <div style={errorBoxStyle}>{busSearchError}</div>
            )}
            {/* List Buses */}
            {busList.length > 0 && (
              <>
                <h4>
                  {busList.length} buses found
                </h4>
                <div style={busListStyle}>
                  {busList.map((bus) => (
                    <BusCard
                      key={bus.id}
                      bus={bus}
                      onSelect={() => chooseBus(bus)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
        {page === "history" && token && (
          <section style={{ flex: 1, padding: 24 }}>
            <h2>
              <span style={{ color: COLORS.primary }}>My Tickets</span>
            </h2>
            {loadingHistory ? (
              <p>Loading...</p>
            ) : (
              <TicketHistoryList history={history} />
            )}
          </section>
        )}
      </div>

      {/* Booking Modal */}
      {bookingModalOpen && selectedBus && (
        <div style={modalBackdropStyle}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3>
              <span style={{ color: COLORS.primary }}>Book seats</span> on{" "}
              <span style={{ color: COLORS.secondary }}>{selectedBus.name}</span>
            </h3>
            <p>
              Date: <strong>{date}</strong>, Route: {selectedBus.route}
            </p>
            <p>
              Price per seat: <strong>₹{selectedBus.price}</strong>
            </p>
            <SeatSelector
              bus={selectedBus}
              taken={selectedBus.taken_seats || []}
              selected={selectedSeats}
              onToggle={toggleSeat}
            />
            <div style={{ marginTop: 18 }}>
              <button
                disabled={selectedSeats.length === 0}
                onClick={bookSeats}
                className="btn"
                style={primaryBtnStyle}
              >
                Book Selected ({selectedSeats.length})
              </button>
              <button
                style={secondaryBtnStyle}
                onClick={() => setBookingModalOpen(false)}
              >
                Cancel
              </button>
            </div>
            {bookingError && (
              <div style={errorBoxStyle}>{bookingError}</div>
            )}
            {bookingSuccess && (
              <div style={successBoxStyle}>{bookingSuccess}</div>
            )}
            {/* Payment */}
            {showPayment && (
              <PaymentModal
                onClose={() => setShowPayment(false)}
                bookingId={paymentInfo.booking_id}
                amount={paymentInfo.amount}
              />
            )}
            {ticketDownloadUrl && (
              <a
                href={ticketDownloadUrl}
                download
                style={{
                  ...primaryBtnStyle,
                  display: "block",
                  textAlign: "center",
                  marginTop: 10,
                  background: COLORS.accent,
                  color: "#000",
                }}
              >
                Download Ticket PDF
              </a>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onDone={() => setShowAuth(false)}
        />
      )}

      {/* Footer */}
      <footer style={footerStyle}>
        <span>
          © {new Date().getFullYear()} BusBooker &bull; Powered by Kavia
        </span>
      </footer>
    </div>
  );
}

// =====================
// Helper Components
// =====================
function BusCard({ bus, onSelect }) {
  // Simple bus info card, highly minimal
  return (
    <div style={busCardStyle}>
      <h4 style={{ color: COLORS.primary }}>{bus.name}</h4>
      <div style={{ fontSize: 13, color: "#666" }}>
        <span>
          {bus.from} <span style={{ color: COLORS.accent }}>⟶</span> {bus.to}
        </span>
      </div>
      <div style={{ fontWeight: 600 }}>
        Departure: {bus.departure_time} &nbsp;|&nbsp;
        Price: <span style={{ color: COLORS.secondary }}>₹{bus.price}</span>
      </div>
      <div>
        Seats left: {bus.total_seats - (bus.booked_seats || 0)}
      </div>
      <button
        className="btn"
        style={{
          ...primaryBtnStyle,
          marginTop: 8,
          fontSize: 15,
          padding: "7px 18px",
        }}
        onClick={onSelect}
      >
        Book Now
      </button>
    </div>
  );
}

function TicketHistoryList({ history }) {
  if (!history?.length)
    return <div style={{ color: "#888" }}>No tickets booked yet.</div>;
  return (
    <div>
      {history.map((t) => (
        <div key={t.booking_id} style={historyCardStyle}>
          <div>
            <div style={{ fontWeight: 600, color: COLORS.primary }}>
              {t.bus_name}
            </div>
            <div style={{ fontSize: 13 }}>
              {t.route} | {t.date}
            </div>
            <div>
              <strong>Seats:</strong> {t.seats.join(", ")}
              <span style={{ paddingLeft: 10 }}>
                <strong>Total:</strong> ₹{t.total}
              </span>
            </div>
          </div>
          {t.ticket_pdf_url && (
            <a
              href={t.ticket_pdf_url}
              download
              style={{
                background: COLORS.accent,
                color: "#000",
                padding: "3px 10px",
                borderRadius: 5,
                textDecoration: "none",
                marginLeft: 10,
              }}
            >
              PDF
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// =====================
// Styling: inline for minimal setup, using color constants
// =====================
const navbarStyle = {
  background: "#FFF",
  borderBottom: "1px solid #e0e0e0",
  padding: "15px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  position: "sticky",
  top: 0,
  zIndex: 2,
};
const logoStyle = {
  fontWeight: 700,
  fontSize: "1.25em",
  letterSpacing: "0.02em",
  color: COLORS.primary,
  display: "flex",
  alignItems: "center",
  gap: 7,
  userSelect: "none",
};

const topNavBtnStyle = {
  background: "transparent",
  border: "none",
  fontWeight: 500,
  fontSize: 17,
  margin: "0 7px",
  padding: "0px 7px",
  cursor: "pointer",
  outline: "none",
  letterSpacing: "0.01em",
};

const footerStyle = {
  background: "#f8f9fa",
  color: "#4C6177",
  padding: "20px 0 13px 0",
  fontSize: 14,
  textAlign: "center",
  borderTop: "1px solid #ececec",
  marginTop: 40,
};

const busListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16,
  marginTop: 20,
  marginBottom: 40,
};

const busCardStyle = {
  borderRadius: 14,
  boxShadow: "0 2px 12px #0001",
  background: "#FFF",
  padding: "18px 20px",
  minWidth: 280,
  maxWidth: 400,
  margin: "0 auto 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const inputStyle = {
  border: "1px solid #bdbdbd",
  borderRadius: 7,
  padding: "7px 14px",
  fontSize: 16,
  minWidth: 110,
  outline: "none",
  background: "#fcfcfc",
  marginRight: 0,
};

const primaryBtnStyle = {
  background: COLORS.primary,
  color: "#FFF",
  border: "none",
  borderRadius: 7,
  fontWeight: 600,
  padding: "8px 27px",
  fontSize: 15,
  margin: "0 7px",  
  marginTop: 0,
  cursor: "pointer",
  letterSpacing: "0.01em",
  transition: "background 0.2s",
};
const secondaryBtnStyle = {
  background: "#F5F5F5",
  color: COLORS.primary,
  border: `1px solid ${COLORS.primary}`,
  borderRadius: 7,
  fontWeight: 500,
  padding: "7px 18px",
  margin: "0 7px",
  fontSize: 15,
  cursor: "pointer",
};

const seatStyle = {
  width: 36,
  height: 36,
  borderRadius: 5,
  border: "1.5px solid #bbb",
  margin: "2px 4px",
  fontWeight: 500,
  fontSize: 15,
  transition: "background 0.12s",
};

const modalBackdropStyle = {
  position: "fixed",
  zIndex: 20,
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const linkBtnStyle = {
  background: "transparent",
  border: "none",
  color: COLORS.primary,
  fontWeight: 500,
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: 15,
  padding: 0,
  margin: 0,
};

const errorBoxStyle = {
  color: "#d32f2f",
  fontSize: 15,
  margin: "8px 0",
  background: "#fff5f5",
  padding: "5px 10px",
  borderRadius: 5,
  border: "1px solid #ffd2d2",
};
const successBoxStyle = {
  color: "#388E3C",
  fontSize: 16,
  fontWeight: 500,
  margin: "8px 0",
  background: "#f2ffe9",
  padding: "5px 10px",
  borderRadius: 5,
  border: "1px solid #b0edac",
};
const historyCardStyle = {
  background: "#FFF",
  borderRadius: 9,
  boxShadow: "0 1.5px 6px #0001",
  padding: "14px 15px",
  marginBottom: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 15,
  gap: 11,
};

export default App;
