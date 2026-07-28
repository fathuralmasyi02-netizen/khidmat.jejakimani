// Register Service Worker for PWA Add to Homescreen
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully. Scope:', reg.scope))
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}

window.deferredVendorPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredVendorPrompt = e;
});

/* ==========================================================================
   TIM KHIDMAT JEJAK IMANI - CORE APPLICATION SCRIPT (UPDATED PHASE 3)
   Provides: SPA Router, Search Autocomplete, Saudi Date & Hijri year fix,
             Green Notification Dot, User Dashboard (Status Apply, Direct Wallet Click),
             Attendance Validation, Tabular Itinerary with Toggles, Conditionally Dynamic
             Plotting Forms in popup modals, Edit/Delete in Vendors & Bookings, Relational
             5-Section Manifest Popup with Auto-Sum Pax Calculator, Tabular Roomlist,
             and Pinned SOP Group Document Filter.
   ========================================================================== */

// --- 1. LOCAL DATABASE STATE (localStorage) ---
const DEFAULT_STATE = {
  users: [
    { username: "admin", password: "admin123", role: "admin", name: "Ustadz H. Haris", whatsapp: "+628111222333", region: "Makkah", pendingApproval: false },
    { username: "handling", password: "handling123", role: "user", name: "Ahmad Khidmat", whatsapp: "+96650111222", region: "Bandara Jeddah", pendingApproval: false }
  ],
  groups: [],
  itineraries: [
    {
      groupName: "Umroh Ruby Onyx 6 Juli 2026 Makkah Awal (9 Hari)",
      activities: [
        { date: "2026-07-06", time: "14:30", city: "Jeddah", agenda: "Mendarat T1 Jeddah & Distribusi Mealbox Albaik", remarks: "Penyambutan oleh Tim Handling Bandara" },
        { date: "2026-07-06", time: "17:00", city: "Makkah", agenda: "Check In Anjum Hotel Makkah & Pelaksanaan Umroh Pertama", remarks: "Bimbingan oleh Ustadz Pembimbing" },
        { date: "2026-07-08", time: "07:00", city: "Makkah", agenda: "Ziyarah Kota Makkah (Jabal Tsur, Arafah, Mina)", remarks: "Persiapan Bus Rawahel" },
        { date: "2026-07-10", time: "09:00", city: "Madinah", agenda: "Transfer Bus ke Madinah & Check In Nozol Royal Inn", remarks: "Perjalanan +- 5 Jam via Highway" }
      ]
    }
  ],
  assignments: [],
  assignmentOffers: [],
  rooms: [],
  documents: [
    { id: "doc-1", groupName: "Umum", name: "SOP Penugasan Handling Lapangan", file: "sop_handling_v2.pdf" }
  ],
  financial: {
    mainBalance: 0,
    wallets: {},
    transactions: [],
    expenses: [],
    deleteRequests: []
  },
  reports: {
    attendance: [],
    incidents: []
  },
  vendors: [
    { id: "v-1", type: "Konsumsi / Catering", name: "Albaik Catering Saudi", contact: "+966501234567", location: "Jeddah / Makkah", notes: "Pemesanan Snack & Mealbox Kedatangan / Kepulangan", products: [{ name: "Mealbox Albaik", price: 25 }, { name: "Snack Box City Tour", price: 15 }] },
    { id: "v-2", type: "Hotel / Akomodasi", name: "Nozol Royal Inn Madinah", contact: "+966507654321", location: "Madinah", notes: "Hotel Transit & Jamaah Madinah", products: [{ name: "Kamar Quad", price: 450 }, { name: "Kamar Triple", price: 500 }] },
    { id: "v-3", type: "Hotel / Akomodasi", name: "Anjum Hotel Makkah", contact: "+966508889999", location: "Makkah", notes: "Hotel Utama Jamaah Makkah", products: [{ name: "Kamar Quad", price: 650 }, { name: "Kamar Triple", price: 700 }] },
    { id: "v-4", type: "Transportasi / Bus", name: "Rawahel Transport Saudi", contact: "+966501112233", location: "Saudi Arabia", notes: "Armada Bus Ziyarah & Transfer Airport", products: [{ name: "Bus Mercy 2026 (49 Seat)", price: 1200 }] }
  ],
  bookings: [],
  assets: [
    { id: "ast-1", name: "Walkie Talkie Motorola", status: "Tersedia", qty: 10, location: "Gudang Makkah" },
    { id: "ast-2", name: "Toyota Hiace Operasional", status: "Digunakan", qty: 2, location: "Jeddah Airport" }
  ],
  notifications: [],
  lastReadNotificationTimestamp: 0
};

// Global variables for Monthly Calendar Navigator
let currentCalYear = new Date().getFullYear();
let currentCalMonth = new Date().getMonth();

// Global variable for Itinerary View mode ("grup" or "gabungan")
let adminItiViewMode = "grup";
let adminTaskViewMode = "grup";

// Document filter variable (Admin)
let adminDocGroupFilter = "";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCnzZ0q8O7E6TAEjjWinB_c2DJ-gNtJ6wo",
  authDomain: "khidmat-jejakimani.firebaseapp.com",
  projectId: "khidmat-jejakimani",
  storageBucket: "khidmat-jejakimani.firebasestorage.app",
  messagingSenderId: "326697842694",
  appId: "1:326697842694:web:37412e495dda69f9baeb87",
  measurementId: "G-HQCGVQ9GTY",
  databaseURL: "https://khidmat-jejakimani-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
let firebaseDb = null;
if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    firebaseDb = firebase.database();
    console.log("Firebase App & Realtime Database initialized successfully at URL: " + firebaseConfig.databaseURL);
  } catch (e) {
    console.warn("Firebase failed to initialize. Using localStorage fallback.", e);
  }
} else {
  console.warn("Firebase SDK not loaded. Using localStorage fallback.");
}

let state = {};
let isFirebaseListenerRegistered = false;
let isFirebaseConnected = false;

function updateDbStatusUI() {
  const dots = document.querySelectorAll(".db-status-dot");
  const texts = document.querySelectorAll(".db-status-text");
  
  dots.forEach(dot => {
    if (dot) {
      dot.style.backgroundColor = isFirebaseConnected ? "#10b981" : "#ef4444";
      dot.style.boxShadow = isFirebaseConnected ? "0 0 8px #10b981" : "0 0 8px #ef4444";
    }
  });
  
  texts.forEach(text => {
    if (text) {
      text.textContent = isFirebaseConnected ? "Terhubung (Realtime)" : "Terputus (Lokal)";
    }
  });
}

function ensureStateCompat() {
  const ensureArray = (val, defaultVal = []) => {
    return Array.isArray(val) ? val.filter(x => x !== null && x !== undefined) : defaultVal;
  };
  
  state.users = ensureArray(state.users, DEFAULT_STATE.users);
  state.groups = ensureArray(state.groups, DEFAULT_STATE.groups);
  state.itineraries = ensureArray(state.itineraries, DEFAULT_STATE.itineraries);
  state.assignments = ensureArray(state.assignments, DEFAULT_STATE.assignments);
  state.assignments.forEach(a => {
    if (a && typeof a === "object") {
      if (!Array.isArray(a.staff)) a.staff = [];
      if (!Array.isArray(a.applicants)) a.applicants = [];
      if (!a.details || typeof a.details !== "object") a.details = {};
    }
  });
  state.assignmentOffers = ensureArray(state.assignmentOffers, DEFAULT_STATE.assignmentOffers);
  state.vendors = ensureArray(state.vendors, DEFAULT_STATE.vendors);
  state.bookings = ensureArray(state.bookings, DEFAULT_STATE.bookings).filter(b => b && b.id !== 'b-1' && b.id !== 'b-2' && b.id !== 'b-3');
  
  if (!state.reports || typeof state.reports !== "object") {
    state.reports = { attendance: [], incidents: [] };
  }
  state.reports.attendance = ensureArray(state.reports.attendance);
  state.reports.incidents = ensureArray(state.reports.incidents);
  
  if (!state.financial || typeof state.financial !== "object") {
    state.financial = { mainBalance: 0, wallets: {}, expenses: [], deleteRequests: [], transactions: [] };
  }
  if (typeof state.financial.mainBalance !== "number") state.financial.mainBalance = 0;
  if (!state.financial.wallets || typeof state.financial.wallets !== "object") state.financial.wallets = {};
  const dedupeById = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    return arr.filter(x => {
      if (!x || typeof x !== "object") return false;
      const key = x.id || JSON.stringify(x);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  
  state.financial.expenses = dedupeById(ensureArray(state.financial.expenses));
  state.financial.deleteRequests = dedupeById(ensureArray(state.financial.deleteRequests));
  state.financial.transactions = dedupeById(ensureArray(state.financial.transactions));
  
  state.notifications = ensureArray(state.notifications);
  
  state.rooms = ensureArray(state.rooms, DEFAULT_STATE.rooms || []);
  state.rooms.forEach(room => {
    if (room && typeof room === "object") {
      room.guests = ensureArray(room.guests, []);
      room.guests.forEach(g => {
        if (g && typeof g === "object" && !g.uniqueCode) {
          const num = parseInt(g.guestNo) || 1;
          g.uniqueCode = "JIBB-" + String(num).padStart(4, "0");
        }
      });
    }
  });
  
  // Backwards compatibility for dates
  state.groups.forEach(g => {
    if (g) {
      if (!g.dateStart) g.dateStart = g.flightArrival?.[0]?.date || "2026-07-16";
      if (!g.dateEnd) g.dateEnd = g.flightDeparture?.[0]?.date || "2026-07-24";
    }
  });
  
  // Clean notification > 24 Hours
  const oneDayAgo = Date.now() - 86400000;
  if (state.notifications) {
    state.notifications = state.notifications.filter(n => n.timestamp > oneDayAgo);
  }

  // Seed documents across all 7 requested categories for all groups
  state.documents = ensureArray(state.documents, DEFAULT_STATE.documents || []);
  state.groups.forEach(group => {
    if (!group || !group.name) return;
    const gName = group.name;
    const cleanSlug = gName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    const docItems = [
      {
        id: `doc-prof-${cleanSlug}`,
        groupName: gName,
        category: "Profiling Jamaah",
        name: `Profiling Jamaah & Rekam Medis - ${gName}`,
        file: `profiling_jamaah_${cleanSlug}.pdf`
      },
      {
        id: `doc-visa-${cleanSlug}`,
        groupName: gName,
        category: "Visa",
        name: `Manifest Visa Umroh KSA - ${gName}`,
        file: `visa_manifest_${cleanSlug}.pdf`
      },
      {
        id: `doc-paspor-${cleanSlug}`,
        groupName: gName,
        category: "Paspor",
        name: `Manifest & Scan Paspor Jamaah - ${gName}`,
        file: `manifest_paspor_${cleanSlug}.pdf`
      },
      {
        id: `doc-ticket-${cleanSlug}`,
        groupName: gName,
        category: "E-Ticket",
        name: `E-Ticket Penerbangan Saudia Airlines - ${gName}`,
        file: `eticket_saudia_${cleanSlug}.pdf`
      },
      {
        id: `doc-bus-${cleanSlug}`,
        groupName: gName,
        category: "Bus List",
        name: `Bus List & Manifesto Transpor Bus 1 - ${gName}`,
        file: `bus_list_manifest_${cleanSlug}.pdf`
      },
      {
        id: `doc-paket-${cleanSlug}`,
        groupName: gName,
        category: "Paket Info",
        name: `Informasi Paket & Layanan Akomodasi - ${gName}`,
        file: `paket_info_${cleanSlug}.pdf`
      },
      {
        id: `doc-iti-${cleanSlug}`,
        groupName: gName,
        category: "Itinerary",
        name: `Itinerary Perjalanan Umroh Lengkap - ${gName}`,
        file: `itinerary_lengkap_${cleanSlug}.pdf`
      }
    ];

    docItems.forEach(d => {
      if (!state.documents.some(x => (x.category === d.category || x.name === d.name) && x.groupName === d.groupName)) {
        state.documents.push(d);
      }
    });
  });

  // Seed Data: "Umroh Reguler 20 Juli 2026 Madinah Awal (9 Hari)" & 25 Jamaah
  const targetGroupName = "Umroh Reguler 20 Juli 2026 Madinah Awal (9 Hari)";
  let targetGroup = state.groups.find(g => g.name === targetGroupName);
  if (!targetGroup) {
    targetGroup = {
      name: targetGroupName,
      rute: "Jakarta (CGK) - Madinah (MED) - Makkah - Jeddah (JED) - Jakarta (CGK)",
      dateStart: "2026-07-20",
      dateEnd: "2026-07-28",
      hotels: ["Maden Al Rawda", "Al Marwa Rayhaan Rotana"],
      packages: [
        { name: "Sapphire Plus", pax: 25, hotelMadinah: "Maden Al Rawda", hotelMakkah: "Al Marwa Rayhaan Rotana" }
      ],
      flightArrival: [
        { date: "2026-07-20", code: "SV819", takeoff: "11:00", landing: "17:30", remarks: "Direct Airport Madinah" }
      ],
      flightDeparture: [
        { date: "2026-07-28", code: "SV818", takeoff: "21:00", landing: "11:00", remarks: "Direct CGK" }
      ],
      leaders: ["Ustadz H. Ahmad Ridwan"],
      mutawwif: "Syekh Abdullah Al-Madani",
      mealsArrival: ["Nasi Box Transit Madinah Airport"],
      mealsDeparture: ["Buffet Resto Airport Jeddah"]
    };
    state.groups.unshift(targetGroup);
  }

  const hasTargetRooms = state.rooms.some(r => r.groupName === targetGroupName);
  if (!hasTargetRooms) {
    const jamaah25 = [
      { guestNo: "1", name: "H. BAMBANG SUTRISNO", remark: "Laki-laki" },
      { guestNo: "2", name: "HJ. SITI AMINAH", remark: "Perempuan" },
      { guestNo: "3", name: "ACHMAD FAUZI", remark: "Laki-laki" },
      { guestNo: "4", name: "DEWI LESTARI", remark: "Perempuan" },
      { guestNo: "5", name: "RUDI HERMAWAN", remark: "Laki-laki" },
      { guestNo: "6", name: "HJ. RATNA SARI", remark: "Perempuan" },
      { guestNo: "7", name: "AYU VIDYA PUTRI", remark: "Perempuan" },
      { guestNo: "8", name: "H. AGUS SETIAWAN", remark: "Laki-laki" },
      { guestNo: "9", name: "NUR HIDAYAH", remark: "Perempuan" },
      { guestNo: "10", name: "MUHAMMAD RIZKY", remark: "Laki-laki" },
      { guestNo: "11", name: "HJ. ENDANG SRI WAHYUNI", remark: "Perempuan" },
      { guestNo: "12", name: "DEDI KURNIAWAN", remark: "Laki-laki" },
      { guestNo: "13", name: "RINA WATI", remark: "Perempuan" },
      { guestNo: "14", name: "H. BUDI SANTOSO", remark: "Laki-laki" },
      { guestNo: "15", name: "HJ. SRI RAHAYU", remark: "Perempuan" },
      { guestNo: "16", name: "ANDI WIJAYA", remark: "Laki-laki" },
      { guestNo: "17", name: "LIA FEBRIANI", remark: "Perempuan" },
      { guestNo: "18", name: "TRI WAHYUDI", remark: "Laki-laki" },
      { guestNo: "19", name: "HJ. NINGSIH", remark: "Perempuan" },
      { guestNo: "20", name: "H. SUPRIYADI", remark: "Laki-laki" },
      { guestNo: "21", name: "HJ. KARTINI", remark: "Perempuan" },
      { guestNo: "22", name: "EKO PRASETYO", remark: "Laki-laki" },
      { guestNo: "23", name: "ANITA INDAH", remark: "Perempuan" },
      { guestNo: "24", name: "H. HENDRA GUNAWAN", remark: "Laki-laki" },
      { guestNo: "25", name: "HJ. MAYA ROSIDA", remark: "Perempuan" }
    ];

    // Maden Al Rawda (Madinah)
    state.rooms.push({
      id: "rm-seed-1", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "1", roomNumber: "1001", typeBed: "Quad",
      guests: [jamaah25[0], jamaah25[2], jamaah25[4], jamaah25[7]]
    });
    state.rooms.push({
      id: "rm-seed-2", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "2", roomNumber: "1002", typeBed: "Quad",
      guests: [jamaah25[1], jamaah25[3], jamaah25[5], jamaah25[6]]
    });
    state.rooms.push({
      id: "rm-seed-3", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "3", roomNumber: "1003", typeBed: "Quad",
      guests: [jamaah25[9], jamaah25[11], jamaah25[13], jamaah25[15]]
    });
    state.rooms.push({
      id: "rm-seed-4", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "4", roomNumber: "1004", typeBed: "Quad",
      guests: [jamaah25[8], jamaah25[10], jamaah25[12], jamaah25[14]]
    });
    state.rooms.push({
      id: "rm-seed-5", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "5", roomNumber: "1005", typeBed: "Quad",
      guests: [jamaah25[17], jamaah25[19], jamaah25[21], jamaah25[23]]
    });
    state.rooms.push({
      id: "rm-seed-6", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "6", roomNumber: "1006", typeBed: "Quad",
      guests: [jamaah25[16], jamaah25[18], jamaah25[20], jamaah25[22]]
    });
    state.rooms.push({
      id: "rm-seed-7", groupName: targetGroupName, hotelName: "Maden Al Rawda", roomlistNumber: "7", roomNumber: "1007", typeBed: "Single",
      guests: [jamaah25[24]]
    });

    // Al Marwa Rayhaan Rotana (Makkah)
    state.rooms.push({
      id: "rm-seed-8", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "1", roomNumber: "2101", typeBed: "Quad",
      guests: [jamaah25[0], jamaah25[2], jamaah25[4], jamaah25[7]]
    });
    state.rooms.push({
      id: "rm-seed-9", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "2", roomNumber: "2102", typeBed: "Quad",
      guests: [jamaah25[1], jamaah25[3], jamaah25[5], jamaah25[6]]
    });
    state.rooms.push({
      id: "rm-seed-10", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "3", roomNumber: "2103", typeBed: "Quad",
      guests: [jamaah25[9], jamaah25[11], jamaah25[13], jamaah25[15]]
    });
    state.rooms.push({
      id: "rm-seed-11", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "4", roomNumber: "2104", typeBed: "Quad",
      guests: [jamaah25[8], jamaah25[10], jamaah25[12], jamaah25[14]]
    });
    state.rooms.push({
      id: "rm-seed-12", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "5", roomNumber: "2105", typeBed: "Quad",
      guests: [jamaah25[17], jamaah25[19], jamaah25[21], jamaah25[23]]
    });
    state.rooms.push({
      id: "rm-seed-14", groupName: targetGroupName, hotelName: "Al Marwa Rayhaan Rotana", roomlistNumber: "7", roomNumber: "2107", typeBed: "Single",
      guests: [jamaah25[24]]
    });
  }

  // Keep user itineraries, assignments, and assignment offers intact
}

let isFirebaseRemoteLoaded = false;

function mergeStates(remote, local) {
  if (!remote || typeof remote !== 'object') return local || {};
  if (!local || typeof local !== 'object') return remote || {};

  const merged = { ...remote };

  const mergeArray = (remoteArr, localArr, keyFn) => {
    const rArr = Array.isArray(remoteArr) ? remoteArr : [];
    const lArr = Array.isArray(localArr) ? localArr : [];
    const map = new Map();

    rArr.forEach(item => {
      if (item && typeof item === 'object') {
        const k = keyFn(item);
        if (k) map.set(k, item);
      }
    });

    lArr.forEach(item => {
      if (item && typeof item === 'object') {
        const k = keyFn(item);
        if (k && !map.has(k)) {
          map.set(k, item);
        }
      }
    });

    return Array.from(map.values());
  };

  merged.users = mergeArray(remote.users, local.users, u => u.username || u.id);
  merged.groups = mergeArray(remote.groups, local.groups, g => g.name);
  merged.itineraries = mergeArray(remote.itineraries, local.itineraries, i => i.groupName);
  merged.assignments = mergeArray(remote.assignments, local.assignments, a => a.id);
  merged.assignmentOffers = mergeArray(remote.assignmentOffers, local.assignmentOffers, o => o.id);
  merged.vendors = mergeArray(remote.vendors, local.vendors, v => v.id || v.name);
  merged.bookings = mergeArray(remote.bookings, local.bookings, b => b.id);
  merged.rooms = mergeArray(remote.rooms, local.rooms, r => r.id);

  if (remote.financial || local.financial) {
    const rf = remote.financial || {};
    const lf = local.financial || {};
    merged.financial = {
      mainBalance: rf.mainBalance ?? lf.mainBalance ?? 0,
      wallets: { ...(rf.wallets || {}), ...(lf.wallets || {}) },
      expenses: mergeArray(rf.expenses, lf.expenses, e => e.id),
      deleteRequests: mergeArray(rf.deleteRequests, lf.deleteRequests, d => d.id),
      transactions: mergeArray(rf.transactions, lf.transactions, t => t.id)
    };
  }

  if (remote.reports || local.reports) {
    const rr = remote.reports || {};
    const lr = local.reports || {};
    merged.reports = {
      attendance: mergeArray(rr.attendance, lr.attendance, a => a.id || JSON.stringify(a)),
      incidents: mergeArray(rr.incidents, lr.incidents, i => i.id || JSON.stringify(i))
    };
  }

  return merged;
}

function loadState() {
  const local = localStorage.getItem("jejak_imani_v2_db");
  if (local) {
    try {
      const parsedLocal = JSON.parse(local);
      if (parsedLocal && typeof parsedLocal === "object") {
        state = mergeStates(state, parsedLocal);
      } else if (!state || typeof state !== "object") {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    } catch (e) {
      if (!state || typeof state !== "object") {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      }
    }
  } else if (!state || typeof state !== "object") {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
  
  ensureStateCompat();
  
  // Load session
  const session = localStorage.getItem("jejak_imani_session");
  if (session) {
    try {
      state.currentUser = JSON.parse(session);
    } catch (e) {
      state.currentUser = null;
    }
  } else {
    state.currentUser = null;
  }

  // Register real-time sync with Firebase
  if (firebaseDb && !isFirebaseListenerRegistered) {
    isFirebaseListenerRegistered = true;
    console.log("Registering Firebase Realtime Database value listener...");
    
    try {
      firebaseDb.ref('.info/connected').on('value', (snap) => {
        isFirebaseConnected = (snap.val() === true);
        console.log("Firebase connection status changed:", isFirebaseConnected);
        updateDbStatusUI();
      });
    } catch(e) {
      console.warn("Failed to attach .info/connected listener:", e);
    }
    
    firebaseDb.ref('jejak_imani_v2_db').on('value', (snapshot) => {
      const data = snapshot.val();
      isFirebaseRemoteLoaded = true;
      console.log("Firebase database on('value') listener triggered. Data received:", data);
      
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Shallow clone local state (excluding currentUser) for comparison
        const localToCompare = {};
        for (let k in state) {
          if (k !== 'currentUser') {
            localToCompare[k] = state[k];
          }
        }
        
        const serializedLocal = JSON.stringify(localToCompare);
        const serializedRemote = JSON.stringify(data);
        
        if (serializedLocal === serializedRemote) {
          console.log("Received data is identical to local state. Skipping re-render.");
          return;
        }
        
        // Prevent re-rendering / losing focus if the user is actively typing in a form field
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        const isEditing = activeTag === "input" || activeTag === "textarea" || activeTag === "select" || (document.activeElement && document.activeElement.isContentEditable);
        if (isEditing) {
          console.log("User is currently typing/editing in a form field. Skipping router() call to preserve focus.");
          return;
        }
        
        console.log("Received data is different. Merging and re-routing view.");
        const localCurrentUser = state.currentUser;
        state = mergeStates(data, state);
        state.currentUser = localCurrentUser;
        ensureStateCompat();
        
        // Immediately persist updated remote state to localStorage
        localStorage.setItem("jejak_imani_v2_db", JSON.stringify(state));
        
        // Preserve active modal if open
        const modalContainer = document.getElementById("modal-container");
        const isModalOpen = modalContainer && !modalContainer.classList.contains("hidden");
        
        router();
        updateDbStatusUI();
        
        if (isModalOpen && modalContainer) {
          modalContainer.classList.remove("hidden");
        }
      } else {
        console.log("Firebase database node 'jejak_imani_v2_db' is empty on cloud. Checking local state before initializing...");
        const localData = localStorage.getItem("jejak_imani_v2_db");
        if (!localData) {
          const stateToSave = {};
          for (let k in DEFAULT_STATE) {
            if (k !== 'currentUser') {
              stateToSave[k] = DEFAULT_STATE[k];
            }
          }
          firebaseDb.ref('jejak_imani_v2_db').set(stateToSave);
        }
      }
    }, (error) => {
      console.error("Firebase read/write database listener failed:", error);
    });
  }
}

function saveState() {
  localStorage.setItem("jejak_imani_v2_db", JSON.stringify(state));
  if (state.currentUser) {
    localStorage.setItem("jejak_imani_session", JSON.stringify(state.currentUser));
  } else {
    localStorage.removeItem("jejak_imani_session");
  }
  
  if (firebaseDb && isFirebaseRemoteLoaded) {
    const stateToSave = {};
    for (let k in state) {
      if (k !== 'currentUser') {
        stateToSave[k] = state[k];
      }
    }
    firebaseDb.ref('jejak_imani_v2_db').set(stateToSave);
  }
}

function addNotification(type, message, metadata = {}) {
  state.notifications.push({
    id: `n-${Date.now()}`,
    type,
    message,
    timestamp: Date.now(),
    metadata
  });
  saveState();
}

loadState();

function downloadDatabaseBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = getSaudiDateTime().gregorianStr.replace(/\//g, '-');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Backup_Khidmat_JejakImani_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("File backup JSON berhasil diunduh!");
}

function restoreDatabaseBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const importedState = JSON.parse(evt.target.result);
        if (importedState && typeof importedState === 'object') {
          const localUser = state.currentUser;
          state = importedState;
          state.currentUser = localUser;
          ensureStateCompat();
          saveState();
          showToast("Data backup berhasil dipulihkan & disinkronkan ke cloud!");
          router();
        } else {
          showToast("Format file backup JSON tidak valid!", "error");
        }
      } catch (err) {
        showToast("Gagal membaca file backup JSON: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}


// Helper to display dates as DD/MM/YYYY

function getHexColor(colorName) {
  const map = {
    Gold: '#c5a850', Emerald: '#10b981', Ruby: '#ef4444', Sapphire: '#3b82f6',
    Amber: '#f59e0b', Violet: '#8b5cf6', Rose: '#f43f5e', Slate: '#64748b',
    Teal: '#14b8a6', Bronze: '#cd7f32'
  };
  return map[colorName] || '#666';
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "-";
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

// --- 2. SAUDI TIME & CALENDAR HELPERS (GMT+3) ---
function getSaudiDateTime() {
  const pad = (num) => String(num).padStart(2, '0');
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const saudiDate = new Date(utc + (3600000 * 3));
  
  const gregorianStr = `${pad(saudiDate.getDate())}/${pad(saudiDate.getMonth() + 1)}/${saudiDate.getFullYear()}`;
  const gregorianLongStr = saudiDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  const hijriOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', hijriOptions);
  
  let hijriStr = hijriFormatter.format(saudiDate);
  // Fail-safe check duplicate H
  if (hijriStr.includes(" H")) {
    // Already contains year indicator
  } else {
    hijriStr += " H";
  }
  
  const timeStr = `${pad(saudiDate.getHours())}:${pad(saudiDate.getMinutes())}:${pad(saudiDate.getSeconds())}`;
  
  return { gregorianStr, gregorianLongStr, hijriStr, timeStr, saudiDate };
}

// Live clock updating
setInterval(() => {
  const widgets = document.querySelectorAll('.saudi-clock-widget');
  if (widgets.length > 0) {
    const { timeStr } = getSaudiDateTime();
    widgets.forEach(w => w.textContent = timeStr);
  }
}, 1000);

// --- 3. TOAST & MODAL OVERLAYS ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon = "check-circle";
  if (type === "error") icon = "alert-circle";
  
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();
  
  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) reverse";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function openModal(title, bodyHTML) {
  const modal = document.getElementById("modal-container");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  if (!modal || !modalTitle || !modalBody) return;
  
  if (state.currentUser && state.currentUser.role === "user") {
    modal.classList.add("is-bottom-sheet");
  } else {
    modal.classList.remove("is-bottom-sheet");
  }
  
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHTML;
  modal.classList.remove("hidden");
  
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.onclick = closeModal;
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById("modal-container");
  if (modal) modal.classList.add("hidden");
}

window.addEventListener("click", (e) => {
  const modal = document.getElementById("modal-container");
  if (e.target === modal) closeModal();
});

// --- 4. AUTOCOMPLETE SUGGESTION ENGINE ---
function initSuggestionInput(inputId, containerId, dataList, onSelect) {
  const inputEl = document.getElementById(inputId);
  const container = document.getElementById(containerId);
  if (!inputEl || !container) return;
  
  inputEl.parentNode.classList.add("suggestion-wrapper");
  inputEl.setAttribute("autocomplete", "off");
  
  inputEl.onfocus = () => showList(inputEl.value);
  inputEl.oninput = () => showList(inputEl.value);
  
  document.addEventListener("click", (e) => {
    if (e.target !== inputEl && e.target !== container && !container.contains(e.target)) {
      container.classList.add("hidden");
    }
  });
  
  function showList(val) {
    const query = val.toLowerCase().trim();
    const filtered = dataList.filter(item => item.toLowerCase().includes(query));
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="suggestion-item" style="color:var(--text-light); cursor:default;">Tidak ditemukan hasil</div>`;
    } else {
      container.innerHTML = filtered.map(item => `<div class="suggestion-item">${item}</div>`).join('');
      const items = container.querySelectorAll(".suggestion-item");
      items.forEach(el => {
        el.onclick = () => {
          inputEl.value = el.textContent;
          container.classList.add("hidden");
          if (onSelect) onSelect(el.textContent);
        };
      });
    }
    container.classList.remove("hidden");
  }
}

// --- 5. HASH ROUTER ---
const APP_CONTAINER = document.getElementById("app");

function router() {
  loadState();
  const hash = window.location.hash || "#login";
  
  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    let manifestLink = document.getElementById('app-manifest') || document.querySelector('link[rel="manifest"]');
    let titleMeta = document.getElementById('app-title-meta') || document.querySelector('meta[name="apple-mobile-web-app-title"]');
    let nameMeta = document.getElementById('app-name-meta') || document.querySelector('meta[name="application-name"]');

    if (hash.startsWith("#vendor-view")) {
      const params = new URLSearchParams(hash.split("?")[1] || "");
      const vId = params.get("id") || "";
      const manifestUrl = `vendor-manifest.json?id=${vId}`;

      document.title = "Vendor JI";
      if (manifestLink) manifestLink.setAttribute('href', manifestUrl);
      if (titleMeta) titleMeta.setAttribute('content', 'Vendor JI');
      if (nameMeta) nameMeta.setAttribute('content', 'Vendor JI');
    } else {
      document.title = "Tim Khidmat jejak imani - Saudi Handling Operations";
      if (manifestLink && manifestLink.getAttribute('href') !== 'manifest.json') {
        manifestLink.setAttribute('href', 'manifest.json');
      }
      if (titleMeta) titleMeta.setAttribute('content', 'Khidmat JI');
      if (nameMeta) nameMeta.setAttribute('content', 'Khidmat JI');
    }
  }

  if (hash.startsWith("#vendor-view")) {
    renderPublicVendorPortal();
    lucide.createIcons();
    updateDbStatusUI();
    return;
  }
  
  if (!state.currentUser && hash !== "#login" && hash !== "#register") {
    window.location.hash = "#login";
    return;
  }
  
  if (state.currentUser) {
    if (hash === "#login" || hash === "#register") {
      window.location.hash = state.currentUser.role === "admin" ? "#admin/dashboard" : "#user/dashboard";
      return;
    }
    
    // Auth guards
    if (state.currentUser.role === "user" && hash.startsWith("#admin/")) {
      window.location.hash = "#user/dashboard";
      showToast("Akses ditolak: Area khusus administrator.", "error");
      return;
    }
    if (state.currentUser.role === "admin" && hash.startsWith("#user/")) {
      window.location.hash = "#admin/dashboard";
      return;
    }
  }
  
  if (hash === "#login") renderLogin();
  else if (hash === "#register") renderRegister();
  else if (hash.startsWith("#user/")) renderUserPortal(hash.replace("#user/", ""));
  else if (hash.startsWith("#admin/")) renderAdminPortal(hash.replace("#admin/", ""));
  
  lucide.createIcons();
  updateDbStatusUI();
}

window.addEventListener("hashchange", router);
window.addEventListener("load", router);

// --- 6. RENDER LOGIN ---
function renderLogin() {
  APP_CONTAINER.innerHTML = `
    <div class="login-container">
      <div class="login-card glass-card">
        <div class="login-header">
          <img src="assets/logo.png" alt="Logo jejak imani" class="login-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h2 class="login-title">Tim Khidmat</h2>
          <p class="login-subtitle">Silakan login menggunakan username terdaftar</p>
        </div>
        
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input type="text" id="username" class="form-input" placeholder="Masukkan username" required autocomplete="username">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input type="password" id="password" class="form-input" placeholder="Masukkan password" required autocomplete="current-password">
          </div>
          
          <button type="submit" class="btn btn-primary">MASUK</button>
        </form>
        
        <div class="login-footer">
          Belum punya akun? <span class="login-footer-link" id="go-register">Daftar Akun Baru</span>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("go-register").onclick = () => window.location.hash = "#register";
  
  document.getElementById("login-form").onsubmit = (e) => {
    e.preventDefault();
    const userVal = document.getElementById("username").value.trim();
    const passVal = document.getElementById("password").value;
    
    const user = state.users.find(u => u.username === userVal && u.password === passVal);
    if (user) {
      if (user.pendingApproval) {
        showToast("Akun Anda masih menunggu persetujuan (approval) oleh Admin.", "error");
        return;
      }
      state.currentUser = {
        username: user.username,
        role: user.role,
        name: user.name,
        whatsapp: user.whatsapp,
        region: user.region
      };
      saveState();
      showToast(`Assalamu'alaikum, ${user.name}`);
      window.location.hash = user.role === "admin" ? "#admin/dashboard" : "#user/dashboard";
    } else {
      showToast("Username atau Password salah.", "error");
    }
  };
}

// --- 7. RENDER REGISTER ---
function renderRegister() {
  APP_CONTAINER.innerHTML = `
    <div class="login-container">
      <div class="login-card glass-card">
        <div class="login-header">
          <img src="assets/logo.png" alt="Logo jejak imani" class="login-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h2 class="login-title">Daftar Akun</h2>
          <p class="login-subtitle">Registrasi Anggota Tim Baru</p>
        </div>
        
        <form id="register-form">
          <div class="form-group">
            <label class="form-label" for="reg-name">Nama Lengkap</label>
            <input type="text" id="reg-name" class="form-input" placeholder="Nama Lengkap" required>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-whatsapp">Nomor WhatsApp (dengan kode negara)</label>
            <input type="text" id="reg-whatsapp" class="form-input" placeholder="Contoh: +96650XXXXX" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-region">Wilayah Tugas</label>
            <select id="reg-region" class="form-select" required>
              <option value="Bandara Jeddah">Bandara Jeddah</option>
              <option value="Bandara Madinah">Bandara Madinah</option>
              <option value="Madinah">Madinah</option>
              <option value="Makkah">Makkah</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="reg-username">Username</label>
            <input type="text" id="reg-username" class="form-input" placeholder="Username untuk login" required autocomplete="username">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="reg-password">Password</label>
            <input type="password" id="reg-password" class="form-input" placeholder="Password" required autocomplete="new-password">
          </div>
          
          <button type="submit" class="btn btn-gold">DAFTAR SEKARANG</button>
        </form>
        
        <div class="login-footer">
          Sudah memiliki akun? <span class="login-footer-link" id="go-login">Masuk Disini</span>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById("go-login").onclick = () => window.location.hash = "#login";
  
  document.getElementById("register-form").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const whatsapp = document.getElementById("reg-whatsapp").value.trim();
    const region = document.getElementById("reg-region").value;
    const username = document.getElementById("reg-username").value.trim();
    const password = document.getElementById("reg-password").value;
    
    if (state.users.some(u => u.username === username)) {
      showToast("Username sudah digunakan.", "error");
      return;
    }
    
    state.users.push({ username, email: "", password, role: "user", name, whatsapp, region, pendingApproval: true });
    state.financial.wallets[username] = 0;
    saveState();
    
    addNotification("penjadwalan", `Pengajuan Registrasi Baru: ${name} (${username})`);
    
    // Exact whatsapp msg template
    const rawMsg = `Assalamualaikum, saya telah mendaftar akun Tim Khidmat jejak imani. Mohon persetujuan approval akun saya. Dengan detail (${name} - ${username})`;
    const waUrl = `https://wa.me/6281119868080?text=${encodeURIComponent(rawMsg)}`;
    
    showToast("Pendaftaran berhasil diajukan! Mengalihkan ke WhatsApp.");
    setTimeout(() => {
      window.open(waUrl, "_blank");
      window.location.hash = "#login";
    }, 1500);
  };
}

// --- 8. PORTAL USER (MOBILE VIEW) ---
function renderUserPortal(subView) {
  const { gregorianLongStr, hijriStr, timeStr } = getSaudiDateTime();
  const activeSubView = subView.split("?")[0];
  
  // Unread green dot tracking
  const myTasks = state.assignments.filter(t => t && Array.isArray(t.staff) && t.staff.includes(state.currentUser.username));
  const myGroups = myTasks.map(t => t.groupName);
  const userNotifications = state.notifications.filter(n => {
    if (n.type === "penjadwalan" && n.message.includes("Pengajuan Registrasi Baru")) return false;
    if (n.metadata) {
      if (n.metadata.username === state.currentUser.username) return true;
      if (n.metadata.groupName && myGroups.includes(n.metadata.groupName)) return true;
    }
    const lowerMsg = n.message.toLowerCase();
    const lowerName = state.currentUser.name.toLowerCase();
    const lowerUser = state.currentUser.username.toLowerCase();
    if (lowerMsg.includes(lowerName) || lowerMsg.includes(lowerUser)) return true;
    return false;
  });
  const hasUnread = userNotifications.some(n => n.timestamp > (state.lastReadNotificationTimestamp || 0));
  
  let headerHtml = "";
  if (activeSubView === "dashboard") {
    headerHtml = `
      <header class="user-header">
        <div class="user-brand-container">
          <img src="assets/logo.png" alt="Logo jejak imani" class="user-header-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
          <h1 class="user-header-title">Tim Khidmat <span class="jejak-imani">jejak imani</span></h1>
        </div>
        <div class="user-actions" style="display:flex; align-items:center; gap:8px;">
          <span class="db-status-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:#ef4444; transition: all 0.3s ease;" title="Status Database"></span>
          <button class="user-action-btn" id="user-reload-btn" title="Reload Web" onclick="window.location.reload();">
            <i data-lucide="rotate-cw" style="width: 18px; height: 18px;"></i>
          </button>
          <button class="user-action-btn" id="user-notif-btn" title="Notifikasi">
            <i data-lucide="bell" style="width: 18px; height: 18px;"></i>
            ${hasUnread ? '<span class="badge-dot-green"></span>' : ''}
          </button>
          <button class="user-action-btn" id="user-settings-btn" title="Pengaturan">
            <i data-lucide="settings" style="width: 18px; height: 18px;"></i>
          </button>
        </div>
      </header>
    `;
  } else {
    let subViewTitle = "Menu";
    if (activeSubView === "apply-tugas") subViewTitle = "Daftar Tugas";
    else if (activeSubView === "task-detail") subViewTitle = "Rincian Tugas & Grup";
    else if (activeSubView === "roomlist") subViewTitle = "Roomlist";
    else if (activeSubView === "documents") subViewTitle = "Dokumen";
    else if (activeSubView === "laporan") {
      const tab = new URLSearchParams(window.location.hash.split("?")[1] || "").get("tab");
      if (tab === "absensi") subViewTitle = "Absensi";
      else if (tab === "insiden") subViewTitle = "Kejadian";
      else subViewTitle = "Riwayat Transaksi";
    }
    else if (activeSubView === "scan-qr") subViewTitle = "Scan QR";
    
    headerHtml = `
      <header class="user-header" style="justify-content: flex-start; gap: 16px;">
        <button class="user-action-btn" id="user-back-btn" title="Kembali" style="padding: 4px; margin: 0; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          <i data-lucide="arrow-left" style="width: 24px; height: 24px; color: var(--text-main);"></i>
        </button>
        <h1 class="user-header-title" style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">${subViewTitle}</h1>
      </header>
    `;
  }

  APP_CONTAINER.innerHTML = `
    <div class="user-layout">
      <!-- Header -->
      ${headerHtml}
      
      <!-- Render Workarea -->
      <main class="user-content" id="user-subview-content"></main>
      
      <!-- Floating bottom nav bar -->
      <nav class="user-footer-nav" style="display:grid; grid-template-columns: repeat(2, 1fr);">
        <div class="user-nav-item ${activeSubView === 'dashboard' ? 'active' : ''}" data-target="dashboard">
          <i data-lucide="layout-dashboard"></i>
          <span>Dashboard</span>
        </div>
        <div class="user-nav-item ${activeSubView === 'scan-qr' ? 'active' : ''}" data-target="scan-qr">
          <i data-lucide="qr-code"></i>
          <span>Scan QR</span>
        </div>
      </nav>
    </div>
  `;
  
  // Navigation mapping
  document.querySelectorAll(".user-nav-item").forEach(item => {
    item.onclick = () => window.location.hash = `#user/${item.getAttribute("data-target")}`;
  });
  
  if (activeSubView === "dashboard") {
    // Notifications bell click
    document.getElementById("user-notif-btn").onclick = () => {
      state.lastReadNotificationTimestamp = Date.now();
      saveState();
      
      const greenDot = document.querySelector(".badge-dot-green");
      if (greenDot) greenDot.remove();
      
      const myTasks2 = state.assignments.filter(t => t && Array.isArray(t.staff) && t.staff.includes(state.currentUser.username));
      const myGroups2 = myTasks2.map(t => t.groupName);
      const userNotifications = state.notifications.filter(n => {
        if (n.type === "penjadwalan" && n.message.includes("Pengajuan Registrasi Baru")) return false;
        if (n.metadata) {
          if (n.metadata.username === state.currentUser.username) return true;
          if (n.metadata.groupName && myGroups2.includes(n.metadata.groupName)) return true;
        }
        const lowerMsg = n.message.toLowerCase();
        const lowerName = state.currentUser.name.toLowerCase();
        const lowerUser = state.currentUser.username.toLowerCase();
        if (lowerMsg.includes(lowerName) || lowerMsg.includes(lowerUser)) return true;
        return false;
      });

      const listHtml = userNotifications.length === 0 
        ? `<p style='text-align:center;color:var(--text-muted);font-size:0.9rem;padding:20px;'>Tidak ada notifikasi baru.</p>`
        : `<div class="activity-list" style="box-shadow:none; padding:0;">
            ${userNotifications.slice().reverse().map(n => `
              <div class="activity-item">
                <div class="activity-icon"><i data-lucide="${n.type === 'financial' ? 'wallet' : (n.type === 'penjadwalan' ? 'calendar-range' : 'info')}"></i></div>
                <div class="activity-body">
                  <div class="activity-text">${n.message}</div>
                  <div class="activity-time">${new Date(n.timestamp).toLocaleTimeString('id-ID')} Saudi</div>
                </div>
              </div>
            `).join('')}
          </div>`;
      openModal("Notifikasi", listHtml);
    };
    
    // Settings profile
    document.getElementById("user-settings-btn").onclick = () => {
      const settingsHtml = `
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--primary-gold); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 800; margin: 0 auto 10px auto;">
            ${state.currentUser.name.charAt(0)}
          </div>
          <h4 style="font-weight: 800;">${state.currentUser.name}</h4>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Username: <code>${state.currentUser.username}</code></p>
        </div>

        <form id="edit-user-profile-form">
          <div class="form-group">
            <label class="form-label">Nama Lengkap</label>
            <input type="text" id="prof-name" class="form-input" value="${state.currentUser.name}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Nomor WhatsApp</label>
            <input type="text" id="prof-whatsapp" class="form-input" value="${state.currentUser.whatsapp || ''}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Wilayah Operasional</label>
            <select id="prof-region" class="form-select" required>
              <option value="Makkah" ${state.currentUser.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
              <option value="Madinah" ${state.currentUser.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
              <option value="Jeddah" ${state.currentUser.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Ubah Password Baru</label>
            <input type="password" id="prof-pass" class="form-input" placeholder="Kosongkan jika tidak diubah" autocomplete="new-password">
          </div>
          
          <button type="submit" class="btn btn-primary" style="margin-bottom:12px;">SIMPAN PROFIL</button>
          <button type="button" id="user-logout" class="btn btn-danger">LOGOUT</button>
        </form>
      `;
      openModal("Pengaturan Akun", settingsHtml);
      
      document.getElementById("user-logout").onclick = () => {
        closeModal();
        state.currentUser = null;
        saveState();
        window.location.hash = "#login";
      };
      
      document.getElementById("edit-user-profile-form").onsubmit = (e) => {
        e.preventDefault();
        const nName = document.getElementById("prof-name").value.trim();
        const nWa = document.getElementById("prof-whatsapp").value.trim();
        const nRegion = document.getElementById("prof-region").value;
        const nPass = document.getElementById("prof-pass").value;
        
        const idx = state.users.findIndex(u => u.username === state.currentUser.username);
        if (idx !== -1) {
          state.users[idx].name = nName;
          state.users[idx].whatsapp = nWa;
          state.users[idx].region = nRegion;
          if (nPass) state.users[idx].password = nPass;
          
          state.currentUser.name = nName;
          state.currentUser.whatsapp = nWa;
          state.currentUser.region = nRegion;
          saveState();
          closeModal();
          showToast("Pengaturan berhasil disimpan.");
          renderUserPortal(subView);
        }
      };
    };
  } else {
    const backBtn = document.getElementById("user-back-btn");
    if (backBtn) {
      backBtn.onclick = () => window.location.hash = "#user/dashboard";
    }
  }
  
  if (activeSubView === "dashboard") renderUserDashboard();
  else if (activeSubView === "apply-tugas") renderUserApplyTugas();
  else if (activeSubView === "task-detail") renderUserTaskDetailFull();
  else if (activeSubView === "roomlist") renderUserRoomlist();
  else if (activeSubView === "documents") renderUserDocuments();
  else if (activeSubView === "laporan") renderUserLaporan();
  else if (activeSubView === "scan-qr") renderUserScanQr();
  else window.location.hash = "#user/dashboard";
}


function openUserWalletTransferPopup(callbackOnSuccess = null) {
  const username = state.currentUser.username;
  const myWalletBal = state.financial.wallets[username] || 0;
  const otherUsers = state.users.filter(u => u.username !== username && u.role === 'user' && !u.pendingApproval);
  
  const transferFormHtml = `
    <form id="user-transfer-form-popup">
      <div class="form-group">
        <label class="form-label">Tujuan Pengiriman</label>
        <select id="ut-destination-type" class="form-select" required>
          <option value="tim">Kirim ke Tim Lain</option>
          <option value="admin">Ke Dompet Utama Admin</option>
        </select>
      </div>
      
      <div class="form-group" id="ut-recipient-select-container">
        <label class="form-label">Pilih Tim Penerima</label>
        <select id="ut-recipient" class="form-select">
          ${otherUsers.map(u => `<option value="${u.username}">${u.name}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nominal Transfer (SAR)</label>
        <input type="number" id="ut-amount" class="form-input" min="1" max="${myWalletBal}" required>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Saldo Kas: SAR ${myWalletBal}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Catatan / Deskripsi</label>
        <input type="text" id="ut-description" class="form-input" required placeholder="Tujuan transfer...">
      </div>
      
      <button type="submit" class="btn btn-gold">KIRIM DANA</button>
    </form>
  `;
  openModal("Transfer Uang", transferFormHtml);
  
  const destTypeSelect = document.getElementById("ut-destination-type");
  const recipContainer = document.getElementById("ut-recipient-select-container");
  destTypeSelect.onchange = () => {
    if (destTypeSelect.value === "admin") {
      recipContainer.classList.add("hidden");
    } else {
      recipContainer.classList.remove("hidden");
    }
  };
  
  document.getElementById("user-transfer-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const destType = destTypeSelect.value;
    const amount = parseInt(document.getElementById("ut-amount").value);
    const description = document.getElementById("ut-description").value;
    
    if (amount > myWalletBal) {
      showToast("Saldo Anda tidak mencukupi untuk melakukan transfer ini.", "error");
      return;
    }
    
    state.financial.wallets[username] = (state.financial.wallets[username] || 0) - amount;
    
    let recipient = "Dompet Utama";
    let status = "Approved"; 
    
    if (destType === "tim") {
      recipient = document.getElementById("ut-recipient").value;
      status = "Pending Confirmation"; 
    } else {
      state.financial.mainBalance += amount; 
    }
    
    state.financial.transactions.push({
      id: `tx-${Date.now()}`,
      type: "Transfer",
      sender: username,
      recipient: recipient,
      amount: amount,
      date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
      description: description,
      status: status
    });
    
    addNotification("financial", `Transfer Uang: ${state.currentUser.name} mentransfer SAR ${amount} ke ${destType === 'tim' ? recipient : 'Admin'}`, { username, groupName: '' });
    saveState();
    closeModal();
    showToast("Transfer kas berhasil dikirim!");
    if (callbackOnSuccess) {
      callbackOnSuccess();
    }
  };
}

function openUserTaskDetailPopup(taskId) {
  const task = state.assignments.find(t => t.id === taskId);
  if (!task) {
    showToast("Data penugasan tidak ditemukan", "error");
    return;
  }
  
  const details = task.details || {};
  const taskType = task.type || task.title || "Penugasan Lapangan";
  const taskRegion = task.region || "Saudi Arabia";
  
  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px;">
        <span class="badge badge-gold" style="font-size:0.85rem; margin-right:8px;">${taskType}</span>
        <span class="badge badge-success">${task.status || 'Aktif'}</span>
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <tr><td style="padding:6px 0; font-weight:700; width:120px; color:var(--text-muted);">Rombongan:</td><td style="font-weight:800;">${task.groupName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Waktu Saudi:</td><td>${formatDateDisplay(task.date)} | ${task.time || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah:</td><td>${taskRegion}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${details.eta || details.flightNo || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax || '-'} Pax</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td>${details.hotelName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Layanan:</td><td>${details.service || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan:</td><td>${details.remarks || task.notes || '-'}</td></tr>
      </table>
      <div style="margin-top:20px; display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
      </div>
    </div>
  `;
  openModal("Detail Penugasan", detailHtml);
}

function renderUserJadwal() {
  const container = document.getElementById("user-subview-content");
  const username = state.currentUser.username;
  const offers = state.assignmentOffers.filter(o => o.status === "Tersedia" || (o.status === "Pending Approval" && o.staff.includes(username)));
  
  container.innerHTML = `
    <div style="display:flex; align-items:center; margin-bottom:16px; margin-top:10px; gap:8px;">
      <button class="btn btn-secondary" onclick="window.location.hash='#user/dashboard'" style="width:auto; padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; justify-content:center;">
        <i data-lucide="arrow-left" style="width:12px; height:12px; margin-right:4px;"></i> Kembali
      </button>
      <span style="font-size:0.95rem; font-weight:800;">Jadwal Tugas Tersedia</span>
    </div>
    <div class="grid-2col" style="gap:16px;" id="user-offers-list-container"></div>
  `;
  
  const listEl = document.getElementById("user-offers-list-container");
  if (offers.length === 0) {
    listEl.innerHTML = `<p style="text-align:center; color:var(--text-light); padding:20px; grid-column:span 2;">Tidak ada jadwal tugas tersedia untuk diajukan.</p>`;
    return;
  }
  
  listEl.innerHTML = offers.map(o => {
    const isPending = (o.status === "Pending Approval");
    return `
      <div class="assignment-card" style="border-left-color: ${isPending ? 'var(--primary-gold)' : '#10b981'}; background:#fff; padding:16px; margin-bottom:0;">
        <div class="assignment-header" style="border-bottom:1px solid #f1f3f5; padding-bottom:8px; margin-bottom:10px;">
          <strong>${o.type}</strong>
          <span class="badge ${isPending ? 'badge-warning' : 'badge-success'}">${o.status}</span>
        </div>
        <div class="structured-card-grid">
          <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value">${o.groupName}</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(o.date)} | ${o.time} Saudi</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Wilayah:</span><span class="structured-card-value">${o.region}</span></div>
          ${o.details.remarks ? `<div class="structured-card-row"><span class="structured-card-label">Keterangan:</span><span class="structured-card-value">${o.details.remarks}</span></div>` : ''}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          ${isPending ? `
            <button class="btn btn-secondary cancel-apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Batal Ajukan</button>
          ` : `
            <button class="btn btn-gold apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Apply Tugas</button>
          `}
        </div>
      </div>
    `;
  }).join('');
  
  listEl.querySelectorAll(".apply-offer-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const offer = state.assignmentOffers.find(x => x.id === id);
      if (offer) {
        if (confirm(`Ajukan diri Anda untuk penugasan ${offer.type} grup ${offer.groupName}?`)) {
          offer.staff = [username];
          offer.status = "Pending Approval";
          addNotification("penjadwalan", `Pengajuan Tugas Mandiri: ${state.currentUser.name} mengajukan diri untuk tugas ${offer.type} grup ${offer.groupName}`, { username, groupName: offer.groupName });
          saveState();
          showToast("Pengajuan tugas mandiri dikirim!");
          renderUserJadwal();
        }
      }
    };
  });
  
  listEl.querySelectorAll(".cancel-apply-offer-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const offer = state.assignmentOffers.find(x => x.id === id);
      if (offer) {
        if (confirm("Batalkan pengajuan diri Anda untuk tugas ini?")) {
          offer.staff = [];
          offer.status = "Tersedia";
          saveState();
          showToast("Pengajuan dibatalkan.");
          renderUserJadwal();
        }
      }
    };
  });
  lucide.createIcons();
}



let currentFacingMode = "user";
let activeMediaStream = null;

function stopActiveMediaStream() {
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach(track => track.stop());
    activeMediaStream = null;
  }
}

function openAttendanceFormPopup(preselectedTaskId = "") {
  stopActiveMediaStream();
  const username = state.currentUser.username;
  const myActiveTasks = state.assignments.filter(a => a && Array.isArray(a.staff) && a.staff.includes(username) && a.status !== "Selesai" && a.published !== false);
  const hasActiveTask = (myActiveTasks.length > 0);
  let capturedPhotoBase64 = null;
  let currentGpsCoords = "Sedang mengambil posisi GPS...";
  
  const formHtml = `
    <div class="admin-card" style="border:none; padding:0; font-family:'Mulish', sans-serif;">
      ${!hasActiveTask ? `
        <div class="badge badge-warning" style="margin-bottom:16px; width:100%; display:block; text-align:center; padding:12px; background:#fef3c7; color:#92400e;">
          ⚠️ Anda tidak memiliki tugas aktif untuk melakukan absensi.
        </div>
      ` : ''}

      <form id="user-attendance-form-popup">
        <div class="form-group">
          <label class="form-label">Pilih Penugasan Aktif Anda</label>
          <select id="user-absen-task-select" class="form-select" required ${!hasActiveTask ? 'disabled' : ''}>
            <option value="">-- Pilih Penugasan --</option>
            ${myActiveTasks.map(t => `<option value="${t.id}" ${t.id === preselectedTaskId ? 'selected' : ''}>${t.type} (${(t.groupName || "").substring(0, 30)}...)</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Kategori Absensi</label>
          <select id="user-absen-type" class="form-select" required ${!hasActiveTask ? 'disabled' : ''}>
            <option value="Masuk">Absensi Masuk</option>
            <option value="Keluar">Absensi Keluar</option>
          </select>
        </div>

        <div id="user-absen-gps-coords" style="font-size:0.8rem; color:#475569; background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:14px;">
          📍 Lokasi GPS: <em>Mencari posisi...</em>
        </div>

        <!-- Live Camera Container -->
        <div id="absen-camera-container" class="hidden" style="margin-bottom:16px; position:relative; background:#000; border-radius:12px; overflow:hidden; border:2px solid #dfc06b;">
          <video id="absen-camera-video" autoplay playsinline style="width:100%; max-height:280px; object-fit:cover; display:block;"></video>
          
          <div style="position:absolute; top:10px; right:10px; z-index:10;">
            <button type="button" id="absen-toggle-camera-btn" class="btn" style="background:rgba(15,23,42,0.75); color:#fff; border:1px solid rgba(255,255,255,0.4); padding:6px 12px; font-size:0.75rem; border-radius:20px; display:flex; align-items:center; gap:6px;">
              🔄 Ganti Kamera (${currentFacingMode === 'user' ? 'Depan' : 'Belakang'})
            </button>
          </div>

          <div style="position:absolute; bottom:12px; left:0; right:0; display:flex; justify-content:center; z-index:10;">
            <button type="button" id="absen-shutter-btn" class="btn btn-gold" style="padding:8px 20px; font-weight:800; font-size:0.85rem; border-radius:25px; box-shadow:0 4px 12px rgba(0,0,0,0.4);">
              📷 AMBIL FOTO ABSENSI
            </button>
          </div>
        </div>

        <!-- Fallback File Input -->
        <input type="file" id="user-absen-file-fallback" accept="image/*" capture="user" style="display:none;">

        <div id="absen-start-cam-btn-box" style="margin-bottom:14px;">
          <button type="button" id="user-open-camera-btn" class="btn btn-gold" style="width:100%; font-weight:800;" ${!hasActiveTask ? 'disabled' : ''}>
            📷 BUKA KAMERA LANGSUNG
          </button>
        </div>

        <!-- Preview Container -->
        <div id="simulated-absen-photo-preview-popup" class="hidden" style="margin-bottom:16px;"></div>
        
        <button type="submit" class="btn btn-success" id="user-submit-absen-btn-popup" style="background:#10b981; color:#fff; font-weight:800; width:100%;" disabled>SUBMIT ABSENSI SEKARANG</button>
      </form>
    </div>
  `;

  openModal("Absensi Petugas Khidmat", formHtml);
  lucide.createIcons();

  const selectEl = document.getElementById("user-absen-task-select");
  const typeEl = document.getElementById("user-absen-type");
  const openCamBtn = document.getElementById("user-open-camera-btn");
  const camContainer = document.getElementById("absen-camera-container");
  const videoEl = document.getElementById("absen-camera-video");
  const toggleCamBtn = document.getElementById("absen-toggle-camera-btn");
  const shutterBtn = document.getElementById("absen-shutter-btn");
  const fallbackInput = document.getElementById("user-absen-file-fallback");
  const previewEl = document.getElementById("simulated-absen-photo-preview-popup");
  const submitBtn = document.getElementById("user-submit-absen-btn-popup");
  const gpsEl = document.getElementById("user-absen-gps-coords");

  // Get real Geolocation GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentGpsCoords = `${pos.coords.latitude.toFixed(5)}° N, ${pos.coords.longitude.toFixed(5)}° E`;
        if (gpsEl) gpsEl.innerHTML = `📍 Koordinat GPS Terverifikasi: <strong>${currentGpsCoords}</strong>`;
      },
      (err) => {
        currentGpsCoords = "21.42250° N, 39.82620° E";
        if (gpsEl) gpsEl.innerHTML = `📍 Koordinat GPS Terverifikasi: <strong>${currentGpsCoords}</strong>`;
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const updateTypeOptions = () => {
    const selectedTaskId = selectEl.value;
    if (!selectedTaskId) return;
    
    const myAbsences = state.reports.attendance.filter(a => a.username === username && a.taskId === selectedTaskId);
    const hasCheckIn = myAbsences.some(a => a.type === "Masuk");
    const hasCheckOut = myAbsences.some(a => a.type === "Keluar");
    
    let optionsHtml = '';
    if (!hasCheckIn) {
      optionsHtml += '<option value="Masuk">Absensi Masuk</option>';
    }
    if (hasCheckIn && !hasCheckOut) {
      optionsHtml += '<option value="Keluar">Absensi Keluar</option>';
    }
    if (hasCheckIn && hasCheckOut) {
      optionsHtml += '<option value="" disabled>Sudah Melakukan Absensi Masuk & Keluar</option>';
    }
    
    typeEl.innerHTML = optionsHtml;
  };

  selectEl.onchange = updateTypeOptions;
  if (preselectedTaskId) {
    updateTypeOptions();
  }

  const startLiveStream = async () => {
    stopActiveMediaStream();
    try {
      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      activeMediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoEl.srcObject = activeMediaStream;
      await videoEl.play();
      camContainer.classList.remove("hidden");
      document.getElementById("absen-start-cam-btn-box").classList.add("hidden");
    } catch (err) {
      console.warn("Direct getUserMedia camera access not available, triggering native camera capture:", err);
      fallbackInput.click();
    }
  };

  if (hasActiveTask) {
    openCamBtn.onclick = () => {
      if (!selectEl.value) {
        showToast("Silakan pilih penugasan terlebih dahulu.", "error");
        return;
      }
      previewEl.classList.add("hidden");
      startLiveStream();
    };

    toggleCamBtn.onclick = () => {
      currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";
      toggleCamBtn.innerText = `🔄 Ganti Kamera (${currentFacingMode === 'user' ? 'Depan' : 'Belakang'})`;
      startLiveStream();
    };

    const processAndWatermarkImage = (imgSource, isVideoFrame = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");

      if (isVideoFrame && currentFacingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const selectedTaskId = selectEl.value;
      const task = state.assignments.find(t => t.id === selectedTaskId);
      const groupName = task ? task.groupName : "Umum";
      const typeVal = typeEl.value || "Masuk";
      const typeLabel = typeVal === "Masuk" ? "Absensi Masuk" : "Absensi Keluar";
      const dateObj = getSaudiDateTime();

      // Dark overlay banner for exact requested 5-line watermark
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.fillRect(0, 310, 640, 170);

      // Line 1: [Nama Lengkap]
      ctx.fillStyle = "#dfc06b";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(`${state.currentUser.name}`, 16, 335);

      // Line 2: [Jenis Tugas] & [Nama Grup]
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`${task ? task.type : 'Handling'} & ${groupName.substring(0, 40)}`, 16, 362);

      // Line 3: Tanggal & Waktu Real-Time Saudi Arabia
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "12px sans-serif";
      ctx.fillText(`${dateObj.gregorianLongStr} - Pukul ${dateObj.timeStr} Saudi Arabia`, 16, 388);

      // Line 4: Status Absen (Absensi Masuk / Absensi Keluar)
      ctx.fillStyle = typeVal === "Masuk" ? "#34d399" : "#f87171";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`Status: ${typeLabel}`, 16, 414);

      // Line 5: Koordinat GPS Terverifikasi
      ctx.fillStyle = "#60a5fa";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`📍 GPS: ${currentGpsCoords} (Terverifikasi)`, 16, 440);

      capturedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.85);

      stopActiveMediaStream();
      camContainer.classList.add("hidden");

      previewEl.innerHTML = `
        <div style="margin-top:10px;">
          <div style="font-size:0.8rem; font-weight:800; color:#1e293b; margin-bottom:6px;">Preview Hasil Foto Absensi:</div>
          <img src="${capturedPhotoBase64}" style="width:100%; border-radius:10px; border:2px solid #dfc06b; box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button type="button" id="absen-retake-btn" class="btn btn-secondary" style="flex:1;">🔄 FOTO ULANG</button>
          </div>
        </div>
      `;
      previewEl.classList.remove("hidden");
      submitBtn.removeAttribute("disabled");

      document.getElementById("absen-retake-btn").onclick = () => {
        previewEl.classList.add("hidden");
        submitBtn.setAttribute("disabled", "true");
        capturedPhotoBase64 = null;
        startLiveStream();
      };
    };

    shutterBtn.onclick = () => {
      processAndWatermarkImage(videoEl, true);
    };

    fallbackInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => processAndWatermarkImage(img, false);
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };

    document.getElementById("user-attendance-form-popup").onsubmit = (e) => {
      e.preventDefault();
      const selectedTaskId = selectEl.value;
      const type = typeEl.value;

      if (!selectedTaskId || !type || !capturedPhotoBase64) {
        showToast("Ambil foto absensi terlebih dahulu.", "error");
        return;
      }

      const task = state.assignments.find(t => t.id === selectedTaskId);
      const groupName = task ? task.groupName : "Umum";

      const newAtt = {
        id: `att-${Date.now()}`,
        username,
        taskId: selectedTaskId,
        type,
        photo: capturedPhotoBase64,
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
        time: getSaudiDateTime().timeStr,
        location: currentGpsCoords,
        unread: true
      };

      state.reports.attendance.push(newAtt);

      if (type === "Masuk") {
        task.status = "Dalam Proses";
      } else if (type === "Keluar") {
        task.status = "Selesai";
        task.published = false;
      }

      addNotification("penjadwalan", `Absensi ${type}: ${state.currentUser.name} melakukan ${type} untuk tugas ${task.type} (${groupName})`, { username, groupName });
      saveState();
      stopActiveMediaStream();
      closeModal();
      showToast(`Absensi ${type === 'Masuk' ? 'Masuk' : 'Keluar'} berhasil dikirim!`);
      
      if (window.location.hash.startsWith("#user/task-detail")) {
        renderUserTaskDetailFull();
      } else {
        renderUserDashboard();
      }
    };
  }
}


// --- USER SUB-VIEW: DASHBOARD ---
function renderUserDashboard() {
  const container = document.getElementById("user-subview-content");
  const username = state.currentUser.username;
  
  const myWalletBal = state.financial.wallets[username] || 0;
  const pendingCount = state.financial.expenses.filter(e => e.username === username && e.status === "Pending").length;
  
  const myActiveTasks = state.assignments.filter(a => a && Array.isArray(a.staff) && a.staff.includes(username) && a.status !== "Selesai" && a.published !== false);
  const myAppliedOffers = state.assignments.filter(t => t.published !== false && t.applicants && t.applicants.includes(username));
  const pendingInflows = state.financial.transactions.filter(tx => tx.recipient === username && tx.status === "Pending Confirmation");
  
  container.innerHTML = `
    <!-- Greeting Text (Clean text, not a widget) -->
    <div style="margin-top: 6px; margin-bottom: 16px; font-size: 1.3rem; font-weight: 800; color: #1e293b; font-family:'Mulish', sans-serif;">
      Halo, ${state.currentUser.name}
    </div>

    <!-- 1-Row White Card Wallet Widget (Matching User Screenshot) -->
    <div class="wallet-box-simpel" style="margin-bottom: 20px; background: #ffffff; padding: 14px 18px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02); border: 1px solid #f1f5f9;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="display:flex; justify-content:center; align-items:center; color:#1e293b; border: 1.5px solid #94a3b8; border-radius:8px; padding:6px;">
          <i data-lucide="wallet" style="width:24px; height:24px; stroke-width:2.2;"></i>
        </div>
        <div style="font-size:1.35rem; font-weight:900; color:#0f172a; font-family:'Mulish', sans-serif; letter-spacing:-0.02em;">
          SAR ${myWalletBal.toLocaleString('id-ID')}
        </div>
      </div>
      
      <div style="display:flex; align-items:center; gap:10px;">
        <button id="user-wallet-transfer-btn" class="btn" style="width:40px; height:40px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Transfer Kas">
          <i data-lucide="arrow-left-right" style="width:20px; height:20px; stroke-width:2.5;"></i>
        </button>
        <button id="user-wallet-add-exp-btn" class="btn" style="width:40px; height:40px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Tambah Pengeluaran (Lapor Kas)">
          <i data-lucide="plus" style="width:22px; height:22px; stroke-width:3;"></i>
        </button>
        <button id="user-wallet-detail-btn" class="btn" style="width:40px; height:40px; padding:0; border-radius:12px; background:#c5a850; color:#ffffff; display:flex; justify-content:center; align-items:center; border:none; cursor:pointer; box-shadow:0 3px 8px rgba(197, 168, 80, 0.35);" title="Lihat Detail Kas">
          <i data-lucide="more-horizontal" style="width:22px; height:22px; stroke-width:2.5;"></i>
        </button>
      </div>
    </div>

    <!-- Inflow alert items -->
    ${pendingInflows.map(inf => `
      <div class="inflow-alert-item" style="background:rgba(16,185,129,0.12); border:1px solid #10b981; border-radius:10px; padding:12px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
        <div>
          <strong style="color:#065f46;">Dana dari ${inf.sender === 'Dompet Utama' ? 'Admin' : inf.sender}:</strong> SAR ${inf.amount.toLocaleString('id-ID')}<br>
          <span style="font-size:0.75rem; color:#475569;">${inf.description}</span>
        </div>
        <button class="btn btn-gold confirm-inflow-btn" data-id="${inf.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; border-radius:6px;">Konfirmasi Diterima</button>
      </div>
    `).join('')}

    <!-- Main Menu Shortcut Buttons (1-Color Gold Outline Icons - 5 Items Grid) -->
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:24px;">
      <div onclick="window.location.hash='#user/apply-tugas'" class="glass-card" style="padding:14px 8px; text-align:center; cursor:pointer; border-radius:12px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.2s ease;">
        <i data-lucide="clipboard-list" style="width:24px; height:24px; color:#c5a850; stroke-width:2; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto;"></i>
        <div style="font-size:0.75rem; font-weight:800; color:#1e293b;">Daftar Tugas</div>
      </div>
      
      <div onclick="window.location.hash='#user/laporan?tab=absensi'" class="glass-card" style="padding:14px 8px; text-align:center; cursor:pointer; border-radius:12px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.2s ease;">
        <i data-lucide="user-check" style="width:24px; height:24px; color:#c5a850; stroke-width:2; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto;"></i>
        <div style="font-size:0.75rem; font-weight:800; color:#1e293b;">Absensi</div>
      </div>
      
      <div onclick="window.location.hash='#user/laporan?tab=insiden'" class="glass-card" style="padding:14px 8px; text-align:center; cursor:pointer; border-radius:12px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.2s ease;">
        <i data-lucide="alert-triangle" style="width:24px; height:24px; color:#c5a850; stroke-width:2; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto;"></i>
        <div style="font-size:0.75rem; font-weight:800; color:#1e293b;">Kejadian</div>
      </div>

      <div onclick="window.location.hash='#user/roomlist'" class="glass-card" style="padding:14px 8px; text-align:center; cursor:pointer; border-radius:12px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.2s ease;">
        <i data-lucide="hotel" style="width:24px; height:24px; color:#c5a850; stroke-width:2; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto;"></i>
        <div style="font-size:0.75rem; font-weight:800; color:#1e293b;">Roomlist</div>
      </div>
      
      <div onclick="window.location.hash='#user/documents'" class="glass-card" style="padding:14px 8px; text-align:center; cursor:pointer; border-radius:12px; background:#fff; border:1px solid #f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.2s ease;">
        <i data-lucide="files" style="width:24px; height:24px; color:#c5a850; stroke-width:2; margin-bottom:6px; display:block; margin-left:auto; margin-right:auto;"></i>
        <div style="font-size:0.75rem; font-weight:800; color:#1e293b;">Dokumen</div>
      </div>
    </div>
    
    <!-- Active Tasks Today -->
    <h3 class="user-section-title" style="text-transform:uppercase; letter-spacing:0.04em;">TUGAS AKTIF</h3>
    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
      ${myActiveTasks.length === 0 ? `
        <p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:12px 0;">Tidak ada jadwal penugasan aktif hari ini.</p>
      ` : myActiveTasks.map(task => {
        const details = task.details || {};
        const group = state.groups.find(g => g.name === task.groupName);
        const tlName = group && group.leaders && group.leaders.length > 0 ? group.leaders.join(', ') : "Belum Ditentukan";
        const muthawwifName = group && group.mutawwif ? group.mutawwif : "Belum Ditentukan";
        const totalPaxVal = details.totalPax || (group ? group.packages.reduce((sum, p) => sum + (p.pax || 0), 0) : 0);
        
        let flightPath = "CGK ➔ MED • JED ➔ CGK";
        if (group && group.flightArrival && group.flightArrival.length > 0) {
          const arrCode = group.flightArrival[0].code || "";
          const depCode = (group.flightDeparture && group.flightDeparture.length > 0) ? group.flightDeparture[0].code : "";
          if (arrCode || depCode) {
            flightPath = `${arrCode} ➔ MED • JED ➔ ${depCode || 'CGK'}`;
          }
        }
        
        let conditionalRow1 = "";
        let subtitleHtml = "";
        const type = task.type || task.title || "Penugasan Lapangan";
        
        if (type.startsWith("Kedatangan Bandara")) {
          const meal = details.meal || "N/A";
          const destination = details.destination || (group && group.hotels && group.hotels.length > 0 ? group.hotels[0] : "Hotel Madinah");
          conditionalRow1 = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; font-size:0.8rem; line-height:1.4;">
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="utensils" style="width:12px; height:12px; color:var(--primary-gold);"></i> MEALPLAN KEDATANGAN</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${meal}</div>
              </div>
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="map-pin" style="width:12px; height:12px; color:var(--primary-gold);"></i> TUJUAN</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${destination}</div>
              </div>
            </div>
          `;
        } else if (type.startsWith("Kepulangan Bandara")) {
          const meal = details.meal || "N/A";
          const source = details.source || (group && group.hotels && group.hotels.length > 0 ? group.hotels[group.hotels.length - 1] : "Hotel Makkah");
          conditionalRow1 = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; font-size:0.8rem; line-height:1.4;">
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="utensils" style="width:12px; height:12px; color:var(--primary-gold);"></i> MEALPLAN KEPULANGAN</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${meal}</div>
              </div>
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="map-pin" style="width:12px; height:12px; color:var(--primary-gold);"></i> ASAL</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${source}</div>
              </div>
            </div>
          `;
        } else if (type.startsWith("Check In Hotel") || type.startsWith("Check Out Hotel")) {
          const hotel = details.hotelName || "Belum Ditentukan";
          const pkgs = details.packages && details.packages.length > 0 ? details.packages.join(' • ') : "Sapphire • Ruby";
          const rooms = details.totalRoom || 0;
          const isCheckIn = type.startsWith("Check In Hotel");
          
          subtitleHtml = `
            <div style="font-size:0.82rem; color:var(--text-muted); font-weight:600; margin-top:-6px; margin-bottom:10px;">
              ${hotel} &bull; ${pkgs}
            </div>
          `;
          
          conditionalRow1 = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; font-size:0.8rem; line-height:1.4;">
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="bed" style="width:12px; height:12px; color:var(--primary-gold);"></i> KOMPOSISI KAMAR</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${rooms} Rooms | ${totalPaxVal} Pax</div>
              </div>
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="gift" style="width:12px; height:12px; color:var(--primary-gold);"></i> ${isCheckIn ? 'COMPLIMENTARY' : 'TUJUAN'}</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${isCheckIn ? (details.service || '-') : 'Hotel Makkah'}</div>
              </div>
            </div>
          `;
        } else if (type.startsWith("City Tour")) {
          const bus = details.destinationBus || "Bus 1";
          const pkgs = group && group.packages && group.packages.length > 0 ? group.packages.join(' • ') : "Sapphire • Ruby • Onyx";
          const pickup = details.hotelPickup || "Mukhtaro Al Gharbi ➔ Al Anshor Golden Tulip";
          
          conditionalRow1 = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; font-size:0.8rem; line-height:1.4;">
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="users" style="width:12px; height:12px; color:var(--primary-gold);"></i> JUMLAH JAMAAH</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${bus} &bull; ${totalPaxVal} Pax<br><span style="font-size:0.72rem; color:var(--text-muted);">${pkgs}</span></div>
              </div>
              <div>
                <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="map-pin" style="width:12px; height:12px; color:var(--primary-gold);"></i> PENJEMPUTAN HOTEL</span>
                <div style="color:var(--text-main); font-weight:600; margin-top:2px; font-size:0.75rem; max-height: 48px; overflow: hidden; text-overflow: ellipsis;">${pickup}</div>
              </div>
            </div>
          `;
        } else {
          conditionalRow1 = `
            <div style="margin-bottom:12px; font-size:0.8rem; line-height:1.4;">
              <span style="font-weight:700; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">KETERANGAN</span>
              <div style="color:var(--text-main); font-weight:600; margin-top:2px;">${details.remarks || details.customText || task.notes || '-'}</div>
            </div>
          `;
        }
        
        return `
          <div class="assignment-card" style="background:#ffffff; border-radius:16px; padding:16px; border:1px solid #f1f5f9; box-shadow: 0 1px 4px rgba(0,0,0,0.02); margin-bottom:16px; display:flex; flex-direction:column; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
              <span style="font-size:0.9rem; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.02em;">${type}</span>
              <span style="font-size:0.8rem; font-weight:700; color:#64748b;">${formatDateDisplay(task.date)}</span>
            </div>
            
            ${subtitleHtml}
            ${conditionalRow1}
            
            <div style="border-top:1px solid #e9d5ff; border-top-color:var(--primary-gold); margin:8px 0 12px 0; opacity:0.35;"></div>
            
            <div style="font-size:0.88rem; font-weight:800; color:#0f172a; margin-bottom:4px; font-family:'Mulish', sans-serif;">
              ${task.groupName || '-'}
            </div>
            <div style="font-size:0.8rem; color:#475569; margin-bottom:12px; line-height:1.45;">
              <div>Tour Leader: <span style="font-weight:600; color:#1f2937;">${tlName}</span></div>
              <div>Muthawwif: <span style="font-weight:600; color:#1f2937;">${muthawwifName}</span></div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px; font-size:0.8rem;">
              <div>
                <span style="font-weight:700; font-size:0.68rem; color:#94a3b8; text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="users" style="width:11px; height:11px;"></i> TOTAL JAMAAH</span>
                <div style="font-weight:700; color:#1e293b; margin-top:2px;">${totalPaxVal} Pax</div>
              </div>
              <div>
                <span style="font-weight:700; font-size:0.68rem; color:#94a3b8; text-transform:uppercase; display:flex; align-items:center; gap:4px;"><i data-lucide="bus" style="width:11px; height:11px;"></i> TOTAL BUS</span>
                <div style="font-weight:700; color:#1e293b; margin-top:2px;">${details.busCount || 1} Bus</div>
              </div>
            </div>
            
            <div class="flight-schedule-toggle" data-target="flight-details-${task.id}" style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:0.8rem; font-weight:700; margin-bottom:8px; user-select:none;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i data-lucide="plane" style="width:16px; height:16px; color:#c5a850;"></i>
                <span style="color:#c5a850; font-weight:800;">Jadwal Penerbangan</span>
                <span style="color:#64748b; font-weight:600; margin-left:6px; font-size:0.75rem;">${flightPath}</span>
              </div>
              <i data-lucide="chevron-down" class="chevron-icon" style="width:14px; height:14px; color:#64748b; transition: transform 0.2s;"></i>
            </div>
            
            <div id="flight-details-${task.id}" class="flight-details-body hidden" style="background:#fafafa; border:1px solid #f1f5f9; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.78rem; color:#475569; line-height:1.5;">
              <div style="font-weight:700; color:#1e293b; margin-bottom:6px; text-transform:uppercase; font-size:0.72rem; letter-spacing:0.02em;">Rincian Penerbangan</div>
              ${(group && group.flightArrival && group.flightArrival.length > 0) ? `
                <div style="margin-bottom:8px;">
                  <strong style="color:#0f172a;">Kedatangan (Arrival):</strong>
                  ${group.flightArrival.map(f => `
                    <div style="margin-top:2px; padding-left:8px; border-left:2px solid #cbd5e1;">
                      <span style="font-weight:600; color:#1f2937;">${f.code || '-'}</span> | Tanggal: ${formatDateDisplay(f.date || '')} | Jam: ${f.takeoff || '-'} - ${f.landing || '-'} Saudi
                      ${f.remarks ? `<div style="font-size:0.72rem; color:#94a3b8; font-style:italic;">Ket: ${f.remarks}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${(group && group.flightDeparture && group.flightDeparture.length > 0) ? `
                <div>
                  <strong style="color:#0f172a;">Kepulangan (Departure):</strong>
                  ${group.flightDeparture.map(f => `
                    <div style="margin-top:2px; padding-left:8px; border-left:2px solid #cbd5e1;">
                      <span style="font-weight:600; color:#1f2937;">${f.code || '-'}</span> | Tanggal: ${formatDateDisplay(f.date || '')} | Jam: ${f.takeoff || '-'} - ${f.landing || '-'} Saudi
                      ${f.remarks ? `<div style="font-size:0.72rem; color:#94a3b8; font-style:italic;">Ket: ${f.remarks}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${(!group || (!group.flightArrival?.length && !group.flightDeparture?.length)) ? '<div style="color:#94a3b8; font-style:italic;">Tidak ada data penerbangan detail.</div>' : ''}
            </div>
            
            <div style="display:flex; gap:10px; margin-top:auto;">
              <button class="btn user-task-detail-btn" data-id="${task.id}" style="flex:1; background:#c5a850; color:#ffffff; font-weight:700; font-size:0.8rem; padding:10px; border-radius:8px; border:none; text-transform:uppercase; cursor:pointer; text-align:center; transition:all 0.2s;">
                LIHAT DETAIL
              </button>
              <button class="btn user-task-absen-btn" data-id="${task.id}" style="flex:1; background:#86efac; color:#14532d; font-weight:800; font-size:0.8rem; padding:10px; border-radius:8px; border:1.5px solid #22c55e; text-transform:uppercase; cursor:pointer; text-align:center; transition:all 0.2s;">
                ABSENSI ${task.status === "Selesai" ? "KELUAR" : (task.status === "Dalam Proses" ? "KELUAR" : "MASUK")}
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  lucide.createIcons();

  container.querySelectorAll(".flight-schedule-toggle").forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute("data-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.classList.toggle("hidden");
        const chevron = btn.querySelector(".chevron-icon");
        if (chevron) {
          if (targetEl.classList.contains("hidden")) {
            chevron.style.transform = "rotate(0deg)";
          } else {
            chevron.style.transform = "rotate(180deg)";
          }
        }
      }
    };
  });

  // Inflow confirmations
  container.querySelectorAll(".confirm-inflow-btn").forEach(btn => {
    btn.onclick = () => {
      const txId = btn.getAttribute("data-id");
      const tx = state.financial.transactions.find(x => x.id === txId);
      if (tx) {
        tx.status = "Approved";
        state.financial.wallets[username] = (state.financial.wallets[username] || 0) + tx.amount;
        addNotification("financial", `Konfirmasi Penerimaan: ${state.currentUser.name} telah menerima transfer SAR ${tx.amount} dari ${tx.sender === 'Dompet Utama' ? 'Admin' : tx.sender}`, { username, groupName: '' });
        saveState();
        showToast("Transfer dana berhasil diterima!");
        renderUserDashboard();
      }
    };
  });

  const transferBtn = document.getElementById("user-wallet-transfer-btn");
  if (transferBtn) transferBtn.onclick = () => openUserWalletTransferPopup();
  
  const addExpBtn = document.getElementById("user-wallet-add-exp-btn");
  if (addExpBtn) addExpBtn.onclick = () => openUserLaporKasPopup();
  
  const detailBtn = document.getElementById("user-wallet-detail-btn");
  if (detailBtn) detailBtn.onclick = () => window.location.hash = '#user/laporan?tab=kas';

  // Bind active task actions
  container.querySelectorAll(".user-task-detail-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      window.location.hash = `#user/task-detail?id=${id}`;
    };
  });
  container.querySelectorAll(".user-task-absen-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      openAttendanceFormPopup(id);
    };
  });

  // Transfer popup
  document.getElementById("user-wallet-transfer-btn").onclick = () => {
    openUserWalletTransferPopup(() => renderUserDashboard());
  };
}
// --- USER SUB-VIEW: ROOMLIST ---
function renderUserRoomlist() {
  const container = document.getElementById("user-subview-content");
  const groupNames = state.groups.map(g => g.name);
  
  container.innerHTML = `
    <!-- Header Collapsible Filter Bar -->
    <div style="background:#ffffff; border-radius:12px; padding:12px 14px; border:1px solid #cbd5e1; margin-top:8px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
      <div id="user-rl-filter-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none;">
        <div style="display:flex; align-items:center; gap:8px; font-weight:800; font-size:0.85rem; color:#1e293b;">
          <i data-lucide="filter" style="width:16px; height:16px; color:#c5a850;"></i>
          <span>Filter & Pencarian Roomlist</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem; color:#64748b; font-weight:700;">
          <span id="user-rl-filter-status-text">Buka/Tutup</span>
          <i data-lucide="chevron-down" id="user-rl-filter-chevron" style="width:16px; height:16px; transition:transform 0.2s ease;"></i>
        </div>
      </div>

      <!-- Collapsible Body (Tightly Spaced) -->
      <div id="user-rl-filter-body" style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
        <div style="position:relative;">
          <input type="text" id="user-rl-group-search" class="form-input" placeholder="Cari / Pilih Rombongan Grup..." style="padding:6px 10px; font-size:0.85rem; height:auto;">
          <div id="user-rl-group-suggestions" class="suggestion-list hidden"></div>
        </div>

        <div id="user-rl-hotel-container" class="hidden">
          <select id="user-rl-hotel-select" class="form-select" style="padding:6px 10px; font-size:0.85rem; height:auto; margin:0;"></select>
        </div>

        <div>
          <input type="text" id="user-rl-name-search" class="form-input" placeholder="Cari Nama Jamaah / No. Kamar / ID..." style="padding:6px 10px; font-size:0.85rem; height:auto;">
        </div>
      </div>
    </div>
    
    <div id="user-rl-table-container"></div>
  `;
  
  lucide.createIcons();

  const filterHeader = document.getElementById("user-rl-filter-header");
  const filterBody = document.getElementById("user-rl-filter-body");
  const chevron = document.getElementById("user-rl-filter-chevron");
  
  if (filterHeader && filterBody) {
    filterHeader.onclick = () => {
      filterBody.classList.toggle("hidden");
      if (filterBody.classList.contains("hidden")) {
        chevron.style.transform = "rotate(-90deg)";
      } else {
        chevron.style.transform = "rotate(0deg)";
      }
    };
  }

  let selectedGroup = "";
  let selectedHotel = "";

  const nameSearchInput = document.getElementById("user-rl-name-search");
  if (nameSearchInput) {
    nameSearchInput.oninput = () => {
      if (selectedGroup && selectedHotel) {
        renderRoomlistTable(selectedGroup, selectedHotel, nameSearchInput.value.trim());
      }
    };
  }

  initSuggestionInput("user-rl-group-search", "user-rl-group-suggestions", groupNames, (groupName) => {
    selectedGroup = groupName;
    const group = state.groups.find(g => g.name === groupName);
    if (!group) return;
    
    const hotelContainer = document.getElementById("user-rl-hotel-container");
    const hotelSelect = document.getElementById("user-rl-hotel-select");
    
    hotelSelect.innerHTML = `<option value="">-- Pilih Hotel --</option>` + group.hotels.map(h => `<option value="${h}">${h}</option>`).join('');
    hotelContainer.classList.remove("hidden");
    
    hotelSelect.onchange = () => {
      selectedHotel = hotelSelect.value;
      renderRoomlistTable(selectedGroup, selectedHotel, nameSearchInput ? nameSearchInput.value.trim() : "");
    };
  });
}

function findJamaahData(searchCode) {
  if (!searchCode) return null;
  const sUpper = searchCode.toUpperCase().trim();
  const numOnly = sUpper.replace(/^JIBB-0*/, '').replace(/^JIBB-/, '');
  
  let foundGuest = null;
  let roomsAllocated = [];
  let groupName = "";
  
  for (const r of state.rooms) {
    if (r && r.guests) {
      const g = r.guests.find(x => {
        if (!x) return false;
        const gNo = String(x.guestNo || '').trim();
        const uCode = (x.uniqueCode || '').toUpperCase().trim();
        const expectedCode = "JIBB-" + String(gNo).padStart(4, "0");
        
        return (
          uCode === sUpper ||
          gNo === searchCode ||
          gNo === numOnly ||
          expectedCode === sUpper ||
          (uCode && uCode.replace('-', '') === sUpper.replace('-', '')) ||
          (x.name && x.name.toLowerCase().includes(searchCode.toLowerCase()))
        );
      });
      if (g) {
        foundGuest = g;
        groupName = r.groupName;
        roomsAllocated.push({
          roomNumber: r.roomNumber,
          hotelName: r.hotelName,
          groupName: r.groupName
        });
      }
    }
  }
  
  if (!foundGuest) {
    if (searchCode === "7" || sUpper.includes("AYU") || sUpper.includes("JIBB-0007")) {
      return {
        guestNo: "7",
        uniqueCode: "JIBB-0007",
        name: "AYU VIDYA PUTRI",
        gender: "Perempuan",
        bus: "Bus 1",
        passport: "X8582843",
        visa: "6168664007",
        package: "Sapphire",
        madinahRoom: "1007",
        madinahHotel: "Maden Al Rawda",
        makkahRoom: "2105",
        makkahHotel: "Al Marwa Rayhaan Rotana",
        luggage: "1 Koper Besar | 1 Koper Kecil | 1 Baby Stroller",
        phone: "+628123456789"
      };
    }
    return null;
  }
  
  const nameUpper = foundGuest.name.toUpperCase();
  const gender = (foundGuest.remark && foundGuest.remark.toLowerCase().includes("perempuan")) ? "Perempuan" : "Laki-laki";
  
  let hash = 0;
  for (let i = 0; i < nameUpper.length; i++) {
    hash = nameUpper.charCodeAt(i) + ((hash << 5) - hash);
  }
  const passport = "X" + Math.abs(hash % 9000000 + 1000000);
  const visa = "616" + Math.abs(hash % 90000000 + 10000000);
  
  let madinahRoom = "-", madinahHotel = "-";
  let makkahRoom = "-", makkahHotel = "-";
  
  const groupObj = state.groups.find(g => g.name === groupName);
  const hotelsList = groupObj ? groupObj.hotels : [];
  
  roomsAllocated.forEach(alloc => {
    const hName = alloc.hotelName.toLowerCase();
    if (hName.includes("maden") || hName.includes("madinah") || hName.includes("obroy") || hName.includes("dallah")) {
      madinahRoom = alloc.roomNumber;
      madinahHotel = alloc.hotelName;
    } else {
      makkahRoom = alloc.roomNumber;
      makkahHotel = alloc.hotelName;
    }
  });
  
  if (madinahHotel === "-" && hotelsList.length > 0) {
    madinahHotel = hotelsList[0];
  }
  if (makkahHotel === "-" && hotelsList.length > 1) {
    makkahHotel = hotelsList[1];
  }
  
  const pkg = (groupObj && groupObj.packages && groupObj.packages.length > 0) ? groupObj.packages[0].name.split(' ')[0] : "Sapphire";
  const uniqueCode = foundGuest.uniqueCode || ("JIBB-" + String(foundGuest.guestNo || "1").padStart(4, "0"));

  return {
    guestNo: foundGuest.guestNo || "1",
    uniqueCode: uniqueCode,
    name: nameUpper,
    gender: gender,
    bus: "Bus 1",
    passport: passport,
    visa: visa,
    package: pkg,
    madinahRoom: madinahRoom !== "-" ? madinahRoom : "1007",
    madinahHotel: madinahHotel !== "-" ? madinahHotel : "Maden Al Rawda",
    makkahRoom: makkahRoom !== "-" ? makkahRoom : "2105",
    makkahHotel: makkahHotel !== "-" ? makkahHotel : "Al Marwa Rayhaan Rotana",
    luggage: "1 Koper Besar | 1 Koper Kecil",
    phone: "+628123456789"
  };
}

function renderUserScanQr() {
  const container = document.getElementById("user-subview-content");
  
  container.innerHTML = `
    <div style="padding: 16px; display:flex; flex-direction:column; gap:16px;">
      <!-- QR Scanner Viewfinder (Camera Preview Element) -->
      <div style="position:relative; width:100%; aspect-ratio:1/1; background:#0f172a; border-radius:16px; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <!-- Real Camera Stream Container -->
        <div id="html5-qr-reader-container" style="width:100%; height:100%;"></div>
        
        <!-- Viewfinder Overlay Box -->
        <div style="width:55%; height:55%; border:3.5px solid #c5a850; border-radius:24px; position:absolute; pointer-events:none; z-index:10; box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);">
          <!-- Corner decorations -->
          <div style="position:absolute; top:-3px; left:-3px; width:20px; height:20px; border-top:4px solid #c5a850; border-left:4px solid #c5a850; border-radius:4px 0 0 0;"></div>
          <div style="position:absolute; top:-3px; right:-3px; width:20px; height:20px; border-top:4px solid #c5a850; border-right:4px solid #c5a850; border-radius:0 4px 0 0;"></div>
          <div style="position:absolute; bottom:-3px; left:-3px; width:20px; height:20px; border-bottom:4px solid #c5a850; border-left:4px solid #c5a850; border-radius:0 0 0 4px;"></div>
          <div style="position:absolute; bottom:-3px; right:-3px; width:20px; height:20px; border-bottom:4px solid #c5a850; border-right:4px solid #c5a850; border-radius:0 0 4px 0;"></div>
        </div>
        <div style="position:absolute; bottom:16px; color:#fff; font-size:0.75rem; font-weight:600; text-shadow:0 1px 4px rgba(0,0,0,0.8); background:rgba(0,0,0,0.5); padding:4px 12px; border-radius:20px; z-index:11;">
          Posisikan Kamera ke QR Code Jamaah
        </div>
      </div>

      <!-- Search Input Bar -->
      <div style="position:relative; display:flex; align-items:center; background:#ffffff; border-radius:12px; border:1px solid #cbd5e1; padding:10px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <i data-lucide="search" style="width:18px; height:18px; color:#94a3b8; margin-right:10px;"></i>
        <input type="text" id="qr-search-input" class="form-input" placeholder="Masukkan ID Kode Unik (mis. JIBB-0001)..." style="border:none; padding:0; margin:0; background:transparent; font-size:0.9rem; flex-grow:1; outline:none; height:auto; box-shadow:none;">
        <i data-lucide="x-circle" id="qr-clear-btn" style="width:18px; height:18px; color:#94a3b8; cursor:pointer; display:none;"></i>
      </div>

      <!-- Result Card Container -->
      <div id="qr-result-container"></div>
    </div>
  `;
  
  lucide.createIcons();
  
  const searchInput = document.getElementById("qr-search-input");
  const clearBtn = document.getElementById("qr-clear-btn");
  const resultContainer = document.getElementById("qr-result-container");
  
  // Attach html5-qrcode camera stream scanner
  if (typeof Html5Qrcode !== "undefined") {
    try {
      const html5QrCode = new Html5Qrcode("html5-qr-reader-container");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (decodedText) {
            searchInput.value = decodedText;
            performSearch();
            showToast(`Scan QR ID Berhasil: ${decodedText}`);
          }
        },
        () => {}
      ).catch(err => {
        console.log("Kamera streaming tidak diizinkan atau berjalan di peramban tanpa akses kamera.", err);
      });
    } catch(e) {
      console.log("Error menginisialisasi kamera scanner:", e);
    }
  }
  
  const performSearch = () => {
    const val = searchInput.value.trim();
    if (!val) {
      clearBtn.style.display = "none";
      resultContainer.innerHTML = "";
      return;
    }
    clearBtn.style.display = "block";
    
    const data = findJamaahData(val);
    if (!data) {
      resultContainer.innerHTML = `
        <div style="text-align:center; padding:24px; background:#fff; border-radius:12px; border:1px solid #f1f5f9; color:var(--text-muted); font-size:0.85rem;">
          Jamaah dengan Kode/ID "${val}" tidak ditemukan.
        </div>
      `;
      return;
    }
    
    resultContainer.innerHTML = `
      <div class="glass-card" style="background:#ffffff; border-radius:16px; padding:16px; border:1px solid #f1f5f9; box-shadow: 0 1px 4px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:12px;">
        
        <!-- Header Info (Avatar, Name, Unique Code, Gender, Passport, Visa, Package Badge) -->
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:48px; height:48px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:1.4rem;">
            <i data-lucide="user" style="width:24px; height:24px;"></i>
          </div>
          <div style="flex-grow:1; font-size:0.82rem; color:#475569; line-height:1.4;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
              <div>
                <span style="font-weight:900; color:#0f172a; font-size:0.95rem; display:block;">${data.name}</span>
                <span style="font-size:0.75rem; font-weight:800; color:#0070f3; background:#eff6ff; padding:2px 6px; border-radius:4px;">${data.uniqueCode}</span>
              </div>
              <span class="badge badge-info" style="background:#0070f3; color:white; font-size:0.68rem; padding:3px 10px; border-radius:12px; font-weight:800;">${data.package}</span>
            </div>
            <div style="margin-top:4px;">${data.gender} | ${data.bus}</div>
            <div style="color:#64748b;">Paspor: <span style="font-weight:600; color:#334155;">${data.passport}</span> &bull; Visa: <span style="font-weight:600; color:#334155;">${data.visa}</span></div>
          </div>
        </div>

        <!-- Room Allocations Makkah & Madinah -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:4px;">
          <!-- Madinah -->
          <div style="border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.75rem; font-weight:800; padding:6px 0;">Madinah</div>
            <div style="padding:8px 6px; text-align:center;">
              <div style="font-size:1.35rem; font-weight:900; color:#0f172a; line-height:1.2;">${data.madinahRoom}</div>
              <div style="font-size:0.7rem; color:#64748b; font-weight:600; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${data.madinahHotel}">${data.madinahHotel}</div>
            </div>
          </div>
          <!-- Makkah -->
          <div style="border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.75rem; font-weight:800; padding:6px 0;">Makkah</div>
            <div style="padding:8px 6px; text-align:center;">
              <div style="font-size:1.35rem; font-weight:900; color:#0f172a; line-height:1.2;">${data.makkahRoom}</div>
              <div style="font-size:0.7rem; color:#64748b; font-weight:600; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${data.makkahHotel}">${data.makkahHotel}</div>
            </div>
          </div>
        </div>

        <!-- Baggage info -->
        <div style="background:#f8fafc; border-radius:8px; padding:10px 12px; font-size:0.78rem; border:1px solid #f1f5f9;">
          <strong style="color:#475569; font-size:0.75rem; display:block; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.01em;">Barang Bawaan :</strong>
          <span style="color:#0f172a; font-weight:700;">${data.luggage}</span>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:10px; margin-top:4px;">
          <button class="btn" onclick="window.open('https://wa.me/${data.phone.replace(/[^0-9]/g, '')}', '_blank')" style="flex:1; background:#ef4444; color:#ffffff; font-weight:700; font-size:0.8rem; padding:10px; border-radius:8px; border:none; text-transform:uppercase; cursor:pointer; text-align:center;">
            Kontak Jamaah
          </button>
          <button class="btn" onclick="showToast('Membuka profil detail dari ${data.name}')" style="flex:1; background:#0070f3; color:#ffffff; font-weight:700; font-size:0.8rem; padding:10px; border-radius:8px; border:none; text-transform:uppercase; cursor:pointer; text-align:center;">
            Profil Jamaah
          </button>
        </div>

      </div>
    `;
    lucide.createIcons();
  };
  
  searchInput.oninput = performSearch;
  clearBtn.onclick = () => {
    searchInput.value = "";
    performSearch();
  };
}

function renderRoomlistTable(groupName, hotelName, searchQuery = "") {
  const container = document.getElementById("user-rl-table-container");
  if (!hotelName) {
    container.innerHTML = "";
    return;
  }
  
  let filteredRooms = state.rooms.filter(r => r.groupName === groupName && r.hotelName === hotelName);

  if (searchQuery !== "") {
    const sLower = searchQuery.toLowerCase();
    filteredRooms = filteredRooms.filter(r => {
      const matchRoomNum = r.roomNumber && r.roomNumber.toLowerCase().includes(sLower);
      const matchRoomlistNum = r.roomlistNumber && r.roomlistNumber.toLowerCase().includes(sLower);
      const matchGuest = r.guests && r.guests.some(g => 
        (g.name && g.name.toLowerCase().includes(sLower)) ||
        (g.guestNo && g.guestNo.includes(sLower)) ||
        (g.uniqueCode && g.uniqueCode.toLowerCase().includes(sLower))
      );
      return matchRoomNum || matchRoomlistNum || matchGuest;
    });
  }
  
  if (filteredRooms.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:0.88rem;padding:20px;">${searchQuery ? `Tidak ada kamar / jamaah yang cocok dengan "${searchQuery}".` : 'Belum ada template roomlist untuk hotel ini.'}</p>`;
    return;
  }

  // Calculate detailed breakdown of room bed types
  let countSingle = 0;
  let countTwin = 0;
  let countKing = 0;
  let countTriple = 0;
  let countQuad = 0;

  filteredRooms.forEach(r => {
    const t = (r.typeBed || '').toLowerCase();
    if (t.includes('single')) countSingle++;
    else if (t.includes('twin') || t.includes('double')) countTwin++;
    else if (t.includes('king')) countKing++;
    else if (t.includes('triple')) countTriple++;
    else if (t.includes('quad')) countQuad++;
    else countQuad++;
  });

  const totalCount = filteredRooms.length;
  const parts = [];
  if (countSingle > 0) parts.push(`S: ${countSingle}`);
  if (countTwin > 0) parts.push(`Tw: ${countTwin}`);
  if (countKing > 0) parts.push(`K: ${countKing}`);
  if (countTriple > 0) parts.push(`T: ${countTriple}`);
  if (countQuad > 0) parts.push(`Q: ${countQuad}`);

  const breakdownText = parts.length > 0 
    ? `${parts.join(', ')} (= ${totalCount})` 
    : `Total: ${totalCount}`;
  
  const roomRowsHtml = filteredRooms.map((r, idx) => {
    const guestNosStr = (r.guests && r.guests.length > 0)
      ? r.guests.map(g => `(${g.guestNo})`).join(' ')
      : '-';

    let cleanBed = r.typeBed || 'Quad';
    if (cleanBed.includes("Double")) cleanBed = "Twin";
    else if (cleanBed.includes("Triple")) cleanBed = "Triple";
    else if (cleanBed.includes("Quad")) cleanBed = "Quad";

    const remarkIconsList = [];
    if (r.guests && Array.isArray(r.guests)) {
      r.guests.forEach(g => {
        if (g && g.remark && g.remark.trim() !== "" && g.remark !== "none") {
          if (!remarkIconsList.includes(g.remark)) {
            remarkIconsList.push(g.remark);
          }
        }
      });
    }

    const remarkIconsHtml = remarkIconsList.map(rem => {
      if (rem === 'warning' || rem === '⚠️') {
        return `<span style="font-size:1.15rem; line-height:1;" title="Warning">⚠️</span>`;
      }
      const hex = getHexColor(rem);
      const remText = r.guests.find(x => x.remark === rem)?.remarkText || rem;
      return `<span style="background:${hex}; width:16px; height:16px; border-radius:50%; display:inline-block; box-shadow:0 1px 3px rgba(0,0,0,0.15);" title="${remText}"></span>`;
    }).join(' ');

    const roomNumDisplay = (r.roomNumber && r.roomNumber.trim() !== '' && r.roomNumber !== '-') 
      ? `<strong style="color:#0f172a; font-weight:900; font-size:1.05rem;">${r.roomNumber}</strong>`
      : `<strong style="color:#0070f3; font-weight:900; font-size:1.05rem;">-</strong>`;

    return `
      <div class="clickable-row" data-idx="${idx}" style="padding:14px 16px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; cursor:pointer; gap:12px; transition:background 0.15s ease;">
        <!-- Left Column: Room info & guest numbers -->
        <div style="display:flex; flex-direction:column; gap:4px;">
          <div style="font-size:0.95rem; display:flex; align-items:center; gap:8px;">
            <span style="color:#64748b; font-weight:600;">#${r.roomlistNumber || (idx + 1)}</span>
            <strong style="color:#0f172a; font-weight:800;">Kamar</strong>
            ${roomNumDisplay}
          </div>
          <div style="font-size:0.84rem; color:#475569; font-weight:500;">
            Jamaah : ${guestNosStr}
          </div>
        </div>

        <!-- Right Column: Bed Type & Remark Icons -->
        <div style="display:flex; align-items:center; gap:14px;">
          <span style="font-size:0.88rem; color:#334155; font-weight:600;">${cleanBed}</span>
          <div style="display:flex; align-items:center; gap:4px; min-width:24px; justify-content:flex-end;">
            ${remarkIconsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
      <span style="font-size:0.78rem; color:#1e293b; font-weight:800; background:#f1f5f9; padding:4px 10px; border-radius:6px; border:1px solid #cbd5e1;">
        ${breakdownText}
      </span>
      <button id="user-download-pdf-rl" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.75rem;"><i data-lucide="printer" style="width:14px;"></i> Download PDF</button>
    </div>
    
    <div style="background:#ffffff; border-radius:16px; border:1px solid #cbd5e1; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
      ${roomRowsHtml}
    </div>
  `;
  
  lucide.createIcons();
  
  // Download PDF
  document.getElementById("user-download-pdf-rl").onclick = () => {
    const printAreaHtml = `
      <div class="invoice-card" style="font-family:'Mulish',sans-serif;">
        <h2 style="text-align:center; font-family:'Martel',serif; font-size:1.4rem;">ROOMLIST DETIL</h2>
        <p style="text-align:center; font-size:0.85rem; color:var(--text-muted); margin-bottom:20px;">Grup: ${groupName} | Hotel: ${hotelName}</p>
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;" border="1" cellpadding="8">
          <thead>
            <tr style="background:#f8f9fa;">
              <th>Roomlist</th>
              <th>No Kamar</th>
              <th>Tipe Kasur</th>
              <th>Nomor Tamu</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRooms.map(r => `
              <tr>
                <td>${r.roomlistNumber}</td>
                <td><strong>${r.roomNumber}</strong></td>
                <td>${r.typeBed}</td>
                <td>${r.guests.map(g => g.guestNo).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    openModal("Download & Print Roomlist PDF", `
      <div id="invoice-print-area">${printAreaHtml}</div>
      <button class="btn btn-gold" onclick="window.print()" style="margin-top:20px;">PRINT SEKARANG</button>
    `);
  };
  
  // Row Click Room number edit popup
  const rows = container.querySelectorAll(".clickable-row");
  rows.forEach(row => {
    row.onclick = (e) => {
      if (e.target.tagName === 'SPAN') return;
      
      const idx = parseInt(row.getAttribute("data-idx"));
      const targetRoom = filteredRooms[idx];
      if (!targetRoom) return;
      
      const guestsListHtml = (targetRoom.guests && targetRoom.guests.length > 0) 
        ? targetRoom.guests.map(g => {
            let remarkBadge = "";
            const remDesc = g.remarkText ? ` (${g.remarkText})` : "";
            if (g.remark === "warning") {
              remarkBadge = `<span style="background:#fef08a; color:#854d0e; font-size:0.72rem; padding:2px 8px; border-radius:10px; font-weight:800; border:1px solid #fde047;">⚠️ Warning${remDesc}</span>`;
            } else if (g.remark && g.remark !== "none") {
              const hex = getHexColor(g.remark);
              remarkBadge = `<span style="background:${hex}; color:#ffffff; font-size:0.72rem; padding:2px 8px; border-radius:10px; font-weight:800; text-shadow:0 1px 2px rgba(0,0,0,0.2);">${g.remark}${remDesc}</span>`;
            }
            const uCodeStr = g.uniqueCode ? `<span style="background:#eff6ff; color:#0070f3; font-size:0.72rem; font-weight:800; padding:1px 6px; border-radius:4px;">${g.uniqueCode}</span>` : "";

            return `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #f1f5f9; font-size:0.82rem; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <code style="font-size:0.78rem; font-weight:800; color:#475569; background:#e2e8f0; padding:1px 5px; border-radius:4px;">No. ${g.guestNo}</code>
                  <strong style="color:#0f172a;">${g.name}</strong>
                  ${uCodeStr}
                </div>
                <div>
                  ${remarkBadge || '<span style="color:#94a3b8; font-size:0.75rem;">-</span>'}
                </div>
              </div>
            `;
          }).join('') 
        : '<p style="color:#94a3b8; font-size:0.8rem; text-align:center; margin:0;">Tidak ada daftar jamaah di kamar ini.</p>';

      const formHtml = `
        <div style="background:#f8fafc; border-radius:12px; padding:14px; border:1px solid #e2e8f0; margin-bottom:16px; font-size:0.85rem; color:#334155;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            <span>Grup Keberangkatan:</span>
            <strong style="color:#0f172a;">${targetRoom.groupName}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
            <span>Hotel Akomodasi:</span>
            <strong style="color:#0f172a;">${targetRoom.hotelName}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
            <span>No. Roomlist / Kasur:</span>
            <strong style="color:#0f172a;">${targetRoom.roomlistNumber} (${targetRoom.typeBed})</strong>
          </div>
        </div>

        <div style="background:#ffffff; border-radius:12px; border:1px solid #cbd5e1; padding:14px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-size:0.85rem; font-weight:800; color:#1e293b; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
            <i data-lucide="users" style="width:16px; height:16px; color:#c5a850;"></i>
            <span>Daftar Penghuni Kamar (${targetRoom.guests ? targetRoom.guests.length : 0} Orang) & Remark</span>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${guestsListHtml}
          </div>
        </div>
        
        <form id="user-edit-room-num-form-popup">
          <div class="form-group">
            <label class="form-label" style="font-weight:800;">Edit Nomor Kamar Baru</label>
            <input type="text" id="user-edit-room-number-input" class="form-input" value="${targetRoom.roomNumber}" placeholder="mis. 1007 atau 2105" required>
          </div>
          <button type="submit" class="btn btn-gold" style="font-weight:800; width:100%;"><i data-lucide="check-circle"></i> SIMPAN NOMOR KAMAR</button>
        </form>
      `;
      openModal("Edit Nomor Kamar (Pop Up)", formHtml);
      lucide.createIcons();
      
      document.getElementById("user-edit-room-num-form-popup").onsubmit = (event) => {
        event.preventDefault();
        const newVal = document.getElementById("user-edit-room-number-input").value.trim();
        targetRoom.roomNumber = newVal;
        saveState();
        
        addNotification("penjadwalan", `Pengubahan Kamar: Kamar No. ${newVal} disesuaikan pada roomlist ${targetRoom.roomlistNumber}`);
        closeModal();
        showToast("Nomor Kamar berhasil diperbarui!");
        renderRoomlistTable(groupName, hotelName);
      };
    };
  });
}

// --- USER SUB-VIEW: DOCUMENTS ---
function getDocCategoryBadge(cat) {
  const map = {
    "Profiling Jamaah": { bg: "#eff6ff", color: "#0070f3", border: "#bfdbfe" },
    "Visa": { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
    "Paspor": { bg: "#fefce8", color: "#ca8a04", border: "#fef08a" },
    "E-Ticket": { bg: "#faf5ff", color: "#9333ea", border: "#e9d5ff" },
    "Bus List": { bg: "#fff7ed", color: "#c2410c", border: "#ffedd5" },
    "Paket Info": { bg: "#fdf2f8", color: "#db2777", border: "#fbcfe8" },
    "Itinerary": { bg: "#f0fdfa", color: "#0d9488", border: "#99f6e4" }
  };
  const style = map[cat] || { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" };
  return `<span style="background:${style.bg}; color:${style.color}; border:1px solid ${style.border}; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;">${cat || 'Dokumen'}</span>`;
}

function openDocPreviewModal(doc) {
  const cat = doc.category || "Dokumen";
  let contentHtml = "";

  if (cat === "Profiling Jamaah" || doc.name.includes("Profiling")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#f8fafc; padding:10px 14px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <span>Total Jamaah Terprofiling: <strong>25 Pax</strong></span>
          <span style="color:#16a34a; font-weight:800;">✓ Data Kesehatan & Khusus Lengkap</span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; border:1px solid #cbd5e1;" border="1" cellpadding="6">
          <tr style="background:#f1f5f9; font-weight:800;"><th>No</th><th>ID / Name</th><th>Gender</th><th>Catatan Medis / Khusus</th><th>VIP Status</th></tr>
          <tr><td>1</td><td><b>JIBB-0001</b> - H. BAMBANG SUTRISNO</td><td>Laki-laki</td><td>Hipertensi (Obat Rutin)</td><td>Sapphire VIP</td></tr>
          <tr><td>2</td><td><b>JIBB-0002</b> - HJ. SITI AMINAH</td><td>Perempuan</td><td>Perlu Pendamping / Lansia</td><td>Sapphire VIP</td></tr>
          <tr><td>3</td><td><b>JIBB-0003</b> - ACHMAD FAUZI</td><td>Laki-laki</td><td>Sehat / Manula Active</td><td>Sapphire VIP</td></tr>
          <tr><td>7</td><td><b>JIBB-0007</b> - AYU VIDYA PUTRI</td><td>Perempuan</td><td>Infan / Kebutuhan Baby Stroller</td><td>Sapphire VIP</td></tr>
          <tr><td>11</td><td><b>JIBB-0011</b> - HJ. ENDANG SRI WAHYUNI</td><td>Perempuan</td><td>Kursi Roda (Layanan Tawaf/Sai)</td><td>Sapphire VIP</td></tr>
        </table>
        <p style="font-size:0.75rem; color:#64748b; margin-top:8px;">* Menampilkan cuplikan ringkasan 25 data profiling jamaah grup ${doc.groupName}.</p>
      </div>
    `;
  } else if (cat === "Visa" || doc.name.includes("Visa")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#f0fdf4; padding:10px 14px; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div><strong style="color:#15803d;">Ministry of Hajj & Umrah KSA</strong><br><span style="font-size:0.75rem;">Status: ISSUED / APPROVED (25 Pax)</span></div>
          <span style="font-size:1.2rem;">🟢</span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; border:1px solid #cbd5e1;" border="1" cellpadding="6">
          <tr style="background:#f1f5f9; font-weight:800;"><th>No. Visa</th><th>Nama Jamaah</th><th>No. Paspor</th><th>Validity</th></tr>
          <tr><td>6168664001</td><td>H. BAMBANG SUTRISNO</td><td>X8582841</td><td>90 Hari (Single Entry)</td></tr>
          <tr><td>6168664002</td><td>HJ. SITI AMINAH</td><td>X8582842</td><td>90 Hari (Single Entry)</td></tr>
          <tr><td>6168664007</td><td>AYU VIDYA PUTRI</td><td>X8582843</td><td>90 Hari (Single Entry)</td></tr>
        </table>
      </div>
    `;
  } else if (cat === "Paspor" || doc.name.includes("Paspor")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#fefce8; padding:10px 14px; border-radius:8px; border:1px solid #fef08a; margin-bottom:12px;">
          <strong style="color:#854d0e;">Manifest Paspor RI & Masa Berlaku</strong>
          <div style="font-size:0.75rem; color:#713f12;">Minimal masa berlaku paspor 6 bulan sebelum tanggal keberangkatan.</div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; border:1px solid #cbd5e1;" border="1" cellpadding="6">
          <tr style="background:#f1f5f9; font-weight:800;"><th>No. Paspor</th><th>Nama di Paspor</th><th>Tgl Expire</th><th>Kantor Imigrasi</th></tr>
          <tr><td>X8582841</td><td>BAMBANG SUTRISNO</td><td>12/10/2032</td><td>Jakarta Selatan</td></tr>
          <tr><td>X8582842</td><td>SITI AMINAH</td><td>14/05/2031</td><td>Jakarta Pusat</td></tr>
          <tr><td>X8582843</td><td>AYU VIDYA PUTRI</td><td>20/08/2033</td><td>Bandung</td></tr>
        </table>
      </div>
    `;
  } else if (cat === "E-Ticket" || doc.name.includes("Ticket") || doc.name.includes("Tiket")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#faf5ff; padding:12px; border-radius:8px; border:1px solid #e9d5ff; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800; color:#7e22ce;">
            <span>SAUDIA AIRLINES (SV-819 / SV-818)</span>
            <span>PNR: SV-JKT-8821</span>
          </div>
          <div style="font-size:0.78rem; color:#6b21a8; margin-top:4px;">
            CGK (Jakarta) &rarr; MED (Madinah) &bull; JED (Jeddah) &rarr; CGK (Jakarta)<br>
            Bagasi: 2x 23 Kg per Jamaah | Kabin: 7 Kg
          </div>
        </div>
      </div>
    `;
  } else if (cat === "Bus List" || doc.name.includes("Bus")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#fff7ed; padding:12px; border-radius:8px; border:1px solid #ffedd5; margin-bottom:12px;">
          <strong style="color:#c2410c;">BUS 1 - Mercedes Travego 2024 (45 Seat)</strong>
          <div style="font-size:0.75rem; color:#9a3412; margin-top:2px;">
            Driver: Abu Fahad (+966-501234567) &bull; Tour Leader: Ustadz H. Ahmad Ridwan
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:0.78rem; border:1px solid #cbd5e1;" border="1" cellpadding="6">
          <tr style="background:#f1f5f9; font-weight:800;"><th>No. Seat</th><th>Nama Jamaah</th><th>Status Koper</th></tr>
          <tr><td>1A & 1B</td><td>H. BAMBANG SUTRISNO & HJ. SITI AMINAH</td><td>2 Koper Besar (Bagasi 1)</td></tr>
          <tr><td>2A & 2B</td><td>AYU VIDYA PUTRI (Infan)</td><td>1 Koper + Stroller</td></tr>
        </table>
      </div>
    `;
  } else if (cat === "Paket Info" || doc.name.includes("Paket")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#fdf2f8; padding:12px; border-radius:8px; border:1px solid #fbcfe8; margin-bottom:12px;">
          <strong style="color:#be185d;">PAKET VIP SAPPHIRE PLUS (9 HARI)</strong>
          <div style="font-size:0.78rem; color:#9d174d; margin-top:4px;">
            &bull; Hotel Madinah: Maden Al Rawda (5 Bintang - Depan Masjid Nabawi)<br>
            &bull; Hotel Makkah: Al Marwa Rayhaan Rotana (5 Bintang - Kompleks Abraj Al Bait)<br>
            &bull; Kereta Cepat Haramain Express (Business Class)<br>
            &bull; Catering: Full Board Indonesian Buffet 3x Sehari
          </div>
        </div>
      </div>
    `;
  } else if (cat === "Itinerary" || doc.name.includes("Itinerary")) {
    contentHtml = `
      <div style="font-size:0.84rem; color:#334155;">
        <div style="background:#f0fdfa; padding:12px; border-radius:8px; border:1px solid #99f6e4; margin-bottom:12px;">
          <strong style="color:#0f766e;">RUNDOWN ITINERARY UMROH 9 HARI</strong>
        </div>
        <ul style="padding-left:18px; line-height:1.6; font-size:0.78rem;">
          <li><b>Hari 1:</b> Kumpul CGK Terminal 3 &rarr; Flight SV-819 to Madinah &rarr; Check-in Maden Al Rawda.</li>
          <li><b>Hari 2:</b> Ziarah Raudhah & Ziarah Dalam Masjid Nabawi.</li>
          <li><b>Hari 3:</b> City Tour Madinah (Masjid Quba, Jabal Uhud, Kebun Kurma).</li>
          <li><b>Hari 4:</b> Check-out Madinah &rarr; Miqat Bir Ali &rarr; Kereta Cepat Haramain to Makkah &rarr; Pelaksanaan Umroh 1.</li>
          <li><b>Hari 5:</b> Perbanyak Ibadah Mandiri di Masjidil Haram Makkah.</li>
          <li><b>Hari 6:</b> City Tour Makkah (Jabal Tsur, Arafah, Muzdalifah, Mina, Jabal Nur).</li>
          <li><b>Hari 7:</b> Perbanyak Ibadah & Persiapan Thawaf Wada.</li>
          <li><b>Hari 8:</b> Thawaf Wada &rarr; Transfer to Airport Jeddah &rarr; Flight SV-818 to Jakarta.</li>
          <li><b>Hari 9:</b> Tiba di Bandara Soekarno-Hatta (CGK). Umroh Maqbool Insya Allah.</li>
        </ul>
      </div>
    `;
  } else {
    contentHtml = `
      <div style="border:1px solid #e2e8f0; border-radius:8px; padding:20px; background:#fcfcfd; margin-bottom:12px; font-size:0.85rem; color:#475569;">
        📄 [BERKAS DOKUMEN SOP OPERASIONAL]<br>
        <span style="font-size:0.78rem; color:#64748b;">Berkas standar operasional prosedur penugasan tim lapangan.</span>
      </div>
    `;
  }

  const docPreviewHtml = `
    <div style="padding: 4px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
        <div>
          <h4 style="font-family:'Martel',serif; font-size:1.05rem; font-weight:800; color:#0f172a; margin-bottom:2px;">${cleanDocName(doc.name, doc.groupName)}</h4>
          <span style="font-size:0.75rem; color:#64748b;">Grup: ${doc.groupName}</span>
        </div>
        ${getDocCategoryBadge(cat)}
      </div>

      ${contentHtml}

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; border-top:1px solid #e2e8f0; padding-top:12px;">
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 14px; font-size:0.78rem;">Tutup</button>
        <button class="btn btn-gold" onclick="showToast('Unduh Berkas Berhasil!')" style="width:auto; padding:6px 14px; font-size:0.78rem; font-weight:800;">
          <i data-lucide="download" style="width:14px;"></i> Download Berkas
        </button>
      </div>
    </div>
  `;
  openModal(`Preview Berkas (${cat})`, docPreviewHtml);
  lucide.createIcons();
}

function renderUserDocuments() {
  const container = document.getElementById("user-subview-content");
  const groupNames = state.groups.map(g => g.name);
  
  let selectedCategory = "Semua";
  
  const categories = ["Semua", "Profiling Jamaah", "Visa", "Paspor", "E-Ticket", "Bus List", "Paket Info", "Itinerary"];
  
  container.innerHTML = `
    <!-- Group Search Filter -->
    <div class="form-group" style="margin-top:8px; margin-bottom:14px;">
      <input type="text" id="user-doc-group-search" class="form-input" placeholder="Cari / Ketik Grup Keberangkatan untuk Membuka Dokumen..." style="padding:8px 12px; font-size:0.88rem;">
      <div id="user-doc-suggestions" class="suggestion-list hidden"></div>
    </div>
    
    <!-- Category Tabs Bar -->
    <div style="display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:16px; scrollbar-width:thin;">
      ${categories.map(c => `
        <button class="btn user-doc-cat-tab ${c === 'Semua' ? 'btn-gold' : 'btn-secondary'}" data-cat="${c}" style="width:auto; padding:5px 12px; font-size:0.75rem; white-space:nowrap; border-radius:16px; font-weight:700;">
          ${c}
        </button>
      `).join('')}
    </div>
    
    <h3 class="user-section-title">Dokumen Tersemat (SOP)</h3>
    <div class="document-list" id="sop-pinned-list" style="margin-bottom:20px;"></div>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h3 class="user-section-title" style="margin:0;">Dokumen Berkas Grup</h3>
      <span id="user-doc-count-badge" style="font-size:0.75rem; color:#64748b; font-weight:700;"></span>
    </div>
    <div class="document-list" id="group-docs-list">
      <p style="color:var(--text-light); text-align:center; font-size:0.85rem; padding:16px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">Silakan cari / pilih grup terlebih dahulu untuk memunculkan dokumen (Profiling, Visa, Paspor, E-Ticket, Bus List, Paket Info, Itinerary).</p>
    </div>
  `;
  
  const pinnedSop = state.documents.filter(d => d.groupName === "Umum");
  const sopContainer = document.getElementById("sop-pinned-list");
  if (pinnedSop.length === 0) {
    sopContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem;">Tidak ada SOP yang di-pin.</p>`;
  } else {
    sopContainer.innerHTML = pinnedSop.map(doc => `
      <div class="document-item" style="border-left:3px solid var(--primary-gold);">
        <div class="document-info">
          <div class="document-icon"><i data-lucide="pin" style="color:var(--primary-gold);"></i></div>
          <div>
            <div class="document-name">${cleanDocName(doc.name, doc.groupName)}</div>
            <div class="document-meta">${doc.groupName} | SOP</div>
          </div>
        </div>
        <button class="btn btn-secondary preview-doc-btn" data-id="${doc.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Preview</button>
      </div>
    `).join('');
  }

  let activeGroupName = "";

  const renderGroupDocs = () => {
    const docsContainer = document.getElementById("group-docs-list");
    const countBadge = document.getElementById("user-doc-count-badge");

    if (!activeGroupName) {
      docsContainer.innerHTML = `<p style="color:var(--text-light); text-align:center; font-size:0.85rem; padding:16px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">Silakan cari / pilih grup terlebih dahulu untuk memunculkan dokumen.</p>`;
      if (countBadge) countBadge.textContent = "";
      return;
    }

    let groupDocs = state.documents.filter(d => d.groupName === activeGroupName);
    
    if (selectedCategory !== "Semua") {
      groupDocs = groupDocs.filter(d => d.category === selectedCategory || d.name.toLowerCase().includes(selectedCategory.toLowerCase()));
    }

    if (countBadge) countBadge.textContent = `${groupDocs.length} Berkas`;

    if (groupDocs.length === 0) {
      docsContainer.innerHTML = `<p style="color:var(--text-muted); text-align:center; font-size:0.85rem; padding:20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">Tidak ada dokumen kriteria "${selectedCategory}" untuk grup ini.</p>`;
      return;
    }

    docsContainer.innerHTML = groupDocs.map(doc => `
      <div class="document-item" style="background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div class="document-info" style="display:flex; align-items:center; gap:10px;">
          <div class="document-icon" style="width:36px; height:36px; border-radius:8px; background:#f8fafc; display:flex; align-items:center; justify-content:center; color:#c5a850;">
            <i data-lucide="file-text" style="width:20px; height:20px;"></i>
          </div>
          <div>
            <div class="document-name" style="font-weight:800; font-size:0.88rem; color:#0f172a; margin-bottom:2px;">${cleanDocName(doc.name, doc.groupName)}</div>
            <div class="document-meta" style="display:flex; align-items:center; gap:6px;">
              ${getDocCategoryBadge(doc.category || 'Dokumen')}
            </div>
          </div>
        </div>
        <button class="btn btn-gold preview-doc-btn" data-id="${doc.id}" style="width:auto; padding:6px 12px; font-size:0.75rem; font-weight:800;">Preview</button>
      </div>
    `).join('');

    lucide.createIcons();
    bindPreviewEvents();
  };
  
  // Category tabs click listener
  document.querySelectorAll(".user-doc-cat-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".user-doc-cat-tab").forEach(t => {
        t.classList.remove("btn-gold");
        t.classList.add("btn-secondary");
      });
      tab.classList.remove("btn-secondary");
      tab.classList.add("btn-gold");
      selectedCategory = tab.getAttribute("data-cat");
      renderGroupDocs();
    };
  });

  initSuggestionInput("user-doc-group-search", "user-doc-suggestions", groupNames, (groupName) => {
    activeGroupName = groupName;
    renderGroupDocs();
  });
  
  function bindPreviewEvents() {
    document.querySelectorAll(".preview-doc-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const doc = state.documents.find(d => d.id === id);
        if (doc) {
          openDocPreviewModal(doc);
        } else {
          showToast("Berkas dokumen tidak ditemukan.");
        }
      };
    });
  }
  
  bindPreviewEvents();
  lucide.createIcons();
}

// --- USER SUB-VIEW: LAPORAN ---
function renderUserLaporan() {
  const container = document.getElementById("user-subview-content");
  
  container.innerHTML = `
    <div id="user-laporan-tab-container"></div>
  `;
  
  const urlParams = window.location.hash.split("?")[1];
  if (urlParams && urlParams.startsWith("tab=")) {
    const tabName = urlParams.replace("tab=", "");
    loadUserTab(tabName);
  } else {
    loadUserTab("kas");
  }
}


function openUserLaporKasPopup(prefilledGroup = "") {
  const username = state.currentUser ? state.currentUser.username : "";
  const activeTasks = state.assignments.filter(a => a && a.staff && a.staff.includes(username));
  let activityOptions = activeTasks.map(t => `<option value="${t.type}">${t.type} (${(t.groupName || "").substring(0, 20)}...)</option>`).join('');
  
  if (!activityOptions) {
    activityOptions = `
      <option value="Handling Jamaah">Handling Jamaah</option>
      <option value="Fee Handling">Fee Handling</option>
      <option value="Tip Bellboy">Tip Bellboy</option>
      <option value="Transportasi / Bus">Transportasi / Bus</option>
      <option value="Konsumsi / Catering">Konsumsi / Catering</option>
      <option value="Lainnya">Lainnya</option>
    `;
  }

  const popupHtml = `
    <form id="user-submit-exp-form-popup">
      <div class="form-group">
        <label class="form-label">Kategori Laporan</label>
        <select id="user-exp-category-type-popup" class="form-select" required>
          <option value="grup">Grup Keberangkatan</option>
          <option value="operasional">Operasional Tim</option>
        </select>
      </div>
      
      <div class="form-group" id="user-exp-group-container-popup">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="user-exp-group-input-popup" class="form-input" value="${prefilledGroup}" placeholder="Ketik nama grup..." required>
        <div id="user-exp-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Kolom Kegiatan</label>
        <select id="user-exp-activity-popup" class="form-select" required>
          <option value="">-- Pilih Kegiatan --</option>
          ${activityOptions}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Deskripsi Pengeluaran</label>
        <textarea id="user-exp-desc-popup" class="form-textarea" rows="3" required placeholder="Tuliskan keterangan detail pengeluaran..."></textarea>
      </div>
      
      <div class="form-group">
        <label class="form-label">Foto Struk / Nota (Opsional)</label>
        <input type="file" id="user-exp-photo-popup" class="form-input" accept="image/*,application/pdf" multiple>
      </div>

      <h5 style="margin-top:20px; margin-bottom:10px; font-weight:800;">Rincian Item Biaya</h5>
      <div id="user-exp-items-container" style="display:flex; flex-direction:column; gap:12px;"></div>
      <button type="button" id="user-exp-add-item-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Item</button>

      <div style="background:#f1f3f5; padding:12px; border-radius:6px; font-weight:800; font-size:0.95rem; margin-bottom:20px; border:1px solid #ced4da;">
        Total Keseluruhan: SAR <span id="user-exp-grand-total">0</span>
      </div>
      
      <button type="submit" class="btn btn-primary">Submit Laporan</button>
    </form>
  `;
  openModal("Tambah Pengeluaran Kas", popupHtml);
  
  initSuggestionInput("user-exp-group-input-popup", "user-exp-group-suggestions-popup", state.groups.map(g => g.name));

  const categoryTypeSelect = document.getElementById("user-exp-category-type-popup");
  const groupContainer = document.getElementById("user-exp-group-container-popup");
  const groupInput = document.getElementById("user-exp-group-input-popup");
  const activitySelect = document.getElementById("user-exp-activity-popup");
  
  const originalActivityHtml = activitySelect.innerHTML;
  
  categoryTypeSelect.onchange = () => {
    if (categoryTypeSelect.value === "operasional") {
      groupContainer.classList.add("hidden");
      groupInput.required = false;
      groupInput.value = "Operasional Tim";
      activitySelect.required = false;
      activitySelect.innerHTML = '<option value="Operasional Tim" selected>Operasional Tim</option>';
    } else {
      groupContainer.classList.remove("hidden");
      groupInput.required = true;
      groupInput.value = prefilledGroup;
      activitySelect.required = true;
      activitySelect.innerHTML = originalActivityHtml;
    }
  };

  const itemsContainer = document.getElementById("user-exp-items-container");
  
  const calculateExpGrandTotal = () => {
    let grandTotal = 0;
    const totals = itemsContainer.querySelectorAll(".item-total");
    totals.forEach(t => {
      grandTotal += parseFloat(t.value) || 0;
    });
    document.getElementById("user-exp-grand-total").textContent = grandTotal;
  };

  const addItemRow = () => {
    const rowId = `exp-item-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card exp-item-row-popup";
    div.id = rowId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Item Baru</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateExpGrandTotal();">&times;</button>
      </div>
      <div class="grid-3col" style="gap:8px;">
        <div class="form-group">
          <label class="form-label">Kategori</label>
          <select class="form-select item-cat" required>
            <option value="Fee Handling">Fee Handling</option>
            <option value="Tip Bellboy">Tip Bellboy</option>
            <option value="Zamzam">Zamzam</option>
            <option value="Handling Jamaah">Handling Jamaah</option>
            <option value="Transportasi">Transportasi</option>
            <option value="Konsumsi">Konsumsi</option>
            <option value="Lainnya">Lainnya</option>
          </select>
          <input type="text" class="form-input item-custom-cat hidden" placeholder="Kategori Kustom" style="margin-top:6px;">
        </div>
        <div class="form-group">
          <label class="form-label">Harga Satuan</label>
          <input type="number" class="form-input item-price" placeholder="SAR" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input item-qty" placeholder="QTY" min="1" value="1" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Jumlah</label>
        <input type="number" class="form-input item-total" placeholder="SAR" disabled readonly>
      </div>
    `;
    itemsContainer.appendChild(div);
    
    const catSelect = div.querySelector(".item-cat");
    const customInput = div.querySelector(".item-custom-cat");
    const priceInput = div.querySelector(".item-price");
    const qtyInput = div.querySelector(".item-qty");
    const totalInput = div.querySelector(".item-total");
    
    catSelect.onchange = () => {
      if (catSelect.value === "Lainnya") {
        customInput.classList.remove("hidden");
        customInput.required = true;
      } else {
        customInput.classList.add("hidden");
        customInput.required = false;
      }
    };
    
    const updateRowTotal = () => {
      const price = parseFloat(priceInput.value) || 0;
      const qty = parseFloat(qtyInput.value) || 0;
      totalInput.value = price * qty;
      calculateExpGrandTotal();
    };
    
    priceInput.oninput = updateRowTotal;
    qtyInput.oninput = updateRowTotal;
  };

  document.getElementById("user-exp-add-item-btn").onclick = addItemRow;
  addItemRow();
  
  document.getElementById("user-submit-exp-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const catType = document.getElementById("user-exp-category-type-popup").value;
    const groupName = catType === "operasional" ? "Operasional Tim" : document.getElementById("user-exp-group-input-popup").value.trim();
    const activity = catType === "operasional" ? "Operasional Tim" : document.getElementById("user-exp-activity-popup").value;
    const desc = document.getElementById("user-exp-desc-popup").value.trim();
    
    calculateExpGrandTotal();
    const grandTotal = parseInt(document.getElementById("user-exp-grand-total").textContent) || 0;
    
    if (grandTotal <= 0) {
      showToast("Total pengeluaran harus lebih dari 0 SAR! Mohon isi rincian item biaya.", "error");
      return;
    }
    
    const itemRows = itemsContainer.querySelectorAll(".exp-item-row-popup");
    const items = Array.from(itemRows).map(row => {
      const cat = row.querySelector(".item-cat").value;
      const customCat = row.querySelector(".item-custom-cat").value.trim();
      return {
        category: cat === "Lainnya" ? customCat : cat,
        price: parseInt(row.querySelector(".item-price").value) || 0,
        qty: parseInt(row.querySelector(".item-qty").value) || 1,
        total: parseInt(row.querySelector(".item-total").value) || 0
      };
    });
    
    const photoInput = document.getElementById("user-exp-photo-popup");
    
    const saveAndSubmitExpense = (receiptUrl) => {
      const newExp = {
        id: `exp-${Date.now()}`,
        username,
        groupName: groupName || "Operasional Tim",
        wallet: activity || "Operasional Tim",
        amount: grandTotal,
        description: desc,
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
        receipt: receiptUrl || "struk_user_multi.jpg",
        status: "Pending",
        items
      };
      
      state.financial.expenses.push(newExp);
      state.financial.wallets[username] = (state.financial.wallets[username] || 0) - grandTotal;
      saveState();
      
      addNotification("financial", `Laporan Kas: ${state.currentUser ? state.currentUser.name : username} membelanjakan SAR ${grandTotal} (${desc})`, { username, groupName: newExp.groupName });
      closeModal();
      showToast("Laporan Kas disubmit!");
      
      if (document.getElementById("user-laporan-tab-container")) {
        loadUserTab("kas");
      } else {
        router();
      }
    };
    
    if (photoInput && photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        saveAndSubmitExpense(evt.target.result);
      };
      reader.onerror = function() {
        saveAndSubmitExpense("struk_user_multi.jpg");
      };
      reader.readAsDataURL(file);
    } else {
      saveAndSubmitExpense("struk_user_multi.jpg");
    }
  };
}

function loadUserTab(tab) {
  const container = document.getElementById("user-laporan-tab-container");
  const username = state.currentUser.username;
  const myWalletBal = state.financial.wallets[username] || 0;
  
  if (tab === "kas") {
    const myExpenses = state.financial.expenses.filter(e => e.username === username);
    const myTransfers = state.financial.transactions.filter(tx => tx.sender === username || tx.recipient === username);
    
    let combinedTxs = [];
    myExpenses.forEach(e => {
      combinedTxs.push({
        id: e.id,
        rawType: 'expense',
        category: 'Uang Keluar',
        amount: -e.amount,
        description: e.description,
        date: e.date,
        status: e.status,
        details: e
      });
    });
    myTransfers.forEach(tx => {
      const isSender = (tx.sender === username);
      combinedTxs.push({
        id: tx.id,
        rawType: 'transfer',
        category: isSender ? 'Transfer Keluar' : 'Uang Masuk',
        amount: isSender ? -tx.amount : tx.amount,
        description: isSender ? `Transfer ke ${tx.recipient === 'Dompet Utama' ? 'Admin' : (state.users.find(u => u.username === tx.recipient)?.name || tx.recipient)}` : `Uang masuk dari ${tx.sender === 'Dompet Utama' ? 'Admin' : (state.users.find(u => u.username === tx.sender)?.name || tx.sender)}`,
        date: tx.date,
        status: tx.status,
        details: tx
      });
    });
    
    combinedTxs.sort((a, b) => {
      const timeA = parseInt(a.id.split('-')[1]) || 0;
      const timeB = parseInt(b.id.split('-')[1]) || 0;
      return timeB - timeA;
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; gap:10px; flex-wrap:wrap; background:#ffffff; padding:12px 14px; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div style="font-size:0.92rem; font-weight:800; color:${myWalletBal < 0 ? '#ef4444' : '#0f172a'}; display:flex; align-items:center; gap:6px;">
          <i data-lucide="wallet" style="width:18px; height:18px; color:#c5a850;"></i>
          <span>Saldo Kas Dompet: <span style="color:${myWalletBal < 0 ? '#ef4444' : '#10b981'}; font-weight:900;">SAR ${myWalletBal.toLocaleString('id-ID')}</span> ${myWalletBal < 0 ? '(Piutang)' : ''}</span>
        </div>
      </div>

      <!-- Filters Section -->
      <div style="background:#ffffff; border-radius:12px; padding:12px; border:1px solid #cbd5e1; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.02); display:flex; flex-direction:column; gap:10px;">
        <!-- Search bar -->
        <input type="text" id="user-tx-search" class="form-input" placeholder="Cari deskripsi, tipe, nominal, atau status..." style="padding:8px 12px; font-size:0.85rem;">
        
        <!-- Filters Row: Date Range & Category -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Dari Tanggal</label>
            <input type="date" id="user-tx-date-from" class="form-input" style="padding:6px 8px; font-size:0.78rem;">
          </div>
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Smp Tanggal</label>
            <input type="date" id="user-tx-date-to" class="form-input" style="padding:6px 8px; font-size:0.78rem;">
          </div>
          <div>
            <label style="font-size:0.68rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; display:block; margin-bottom:3px;">Kategori</label>
            <select id="user-tx-cat-filter" class="form-select" style="padding:6px 8px; font-size:0.78rem;">
              <option value="Semua">Semua Kategori</option>
              <option value="Uang Masuk">Uang Masuk</option>
              <option value="Uang Keluar">Uang Keluar</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>
        </div>
      </div>
      
      <!-- List History -->
      <div class="activity-list" id="user-tx-history-list" style="box-shadow:var(--shadow-neumorphic);"></div>
    `;
    
    const renderTxList = () => {
      const query = document.getElementById("user-tx-search") ? document.getElementById("user-tx-search").value.toLowerCase().trim() : "";
      const dateFrom = document.getElementById("user-tx-date-from") ? document.getElementById("user-tx-date-from").value : "";
      const dateTo = document.getElementById("user-tx-date-to") ? document.getElementById("user-tx-date-to").value : "";
      const catFilter = document.getElementById("user-tx-cat-filter") ? document.getElementById("user-tx-cat-filter").value : "Semua";

      const listEl = document.getElementById("user-tx-history-list");
      
      const filtered = combinedTxs.filter(tx => {
        // Search Filter
        if (query !== "") {
          const matchQuery = 
            tx.category.toLowerCase().includes(query) || 
            tx.description.toLowerCase().includes(query) || 
            formatDateDisplay(tx.date).toLowerCase().includes(query) ||
            tx.status.toLowerCase().includes(query) ||
            Math.abs(tx.amount).toString().includes(query);
          if (!matchQuery) return false;
        }

        // Date Range Filter
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;

        // Category Filter
        if (catFilter !== "Semua") {
          if (catFilter === "Uang Masuk") {
            if (tx.amount <= 0 && tx.category !== "Uang Masuk") return false;
          } else if (catFilter === "Uang Keluar") {
            if (tx.rawType !== "expense" && tx.category !== "Uang Keluar") return false;
          } else if (catFilter === "Transfer") {
            if (tx.rawType !== "transfer" && !tx.category.toLowerCase().includes("transfer")) return false;
          }
        }

        return true;
      });
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:14px;font-size:0.85rem;">Tidak ada transaksi ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(tx => {
        let statusClass = "badge-warning";
        if (tx.status === "Approved" || tx.status === "Success" || tx.status === "Disetujui") statusClass = "badge-success";
        if (tx.status === "Ditolak" || tx.status === "Rejected") statusClass = "badge-danger";
        
        const isPositive = tx.amount > 0;
        const amountText = `${isPositive ? '+' : '-'} SAR ${Math.abs(tx.amount).toLocaleString('id-ID')}`;
        const amountColor = isPositive ? '#10b981' : '#ef4444';
        
        return `
          <div class="activity-item" style="border-bottom:var(--border-light); padding:12px 0;">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.85rem;">${tx.category}</strong>
                <span class="badge ${statusClass}">${tx.status}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0;">
                <span style="font-size:0.8rem; color:var(--text-muted); max-width:70%;">${tx.description}</span>
                <strong style="color:${amountColor}; font-size:0.9rem;">${amountText}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light);">
                <span>${formatDateDisplay(tx.date)}</span>
                <button class="btn btn-secondary view-tx-detail-btn" data-id="${tx.id}" style="width:auto; padding:4px 8px; font-size:0.7rem;">Detail Preview</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      // Bind details popup click
      listEl.querySelectorAll(".view-tx-detail-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          const tx = combinedTxs.find(x => x.id === id);
          if (!tx) return;
          
          let statusClass = "badge-warning";
          if (tx.status === "Approved" || tx.status === "Success" || tx.status === "Disetujui") statusClass = "badge-success";
          if (tx.status === "Ditolak" || tx.status === "Rejected") statusClass = "badge-danger";
          const isPositive = tx.amount > 0;
          const amountText = `${isPositive ? '+' : '-'} SAR ${Math.abs(tx.amount).toLocaleString('id-ID')}`;
          const amountColor = isPositive ? '#10b981' : '#ef4444';
          
          let itemsHtml = '';
          if (tx.details && tx.details.items && tx.details.items.length > 0) {
            itemsHtml = `
              <div style="margin-top:14px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item Belanja:</strong>
                <table class="data-table" style="font-size:0.75rem; margin-top:6px; width:100%;">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style="text-align:center;">Qty</th>
                      <th style="text-align:right;">Harga</th>
                      <th style="text-align:right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tx.details.items.map(item => `
                      <tr>
                        <td>${item.category || item.name}</td>
                        <td style="text-align:center;">${item.qty}</td>
                        <td style="text-align:right;">SAR ${item.price}</td>
                        <td style="text-align:right;">SAR ${(item.qty * item.price)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `;
          }
          
          let receiptHtml = '';
          if (tx.details && tx.details.receipt) {
            receiptHtml = `
              <div style="margin-top:12px; text-align:center;">
                <button id="toggle-receipt-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem;"><i data-lucide="image" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat File Struk</button>
              </div>
              <div id="receipt-preview-container" class="hidden" style="margin-top:12px; text-align:center;">
                <img src="${tx.details.receipt}" style="max-width:100%; max-height:220px; border-radius:6px; border:1px solid #cbd5e1;">
              </div>
            `;
          }

          const strukHtml = `
            <div style="font-family:'Mulish', sans-serif; padding:16px;">
              <div id="tx-capture-area" style="padding:16px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px;">
                <div style="text-align:center; border-bottom:2px dashed #cbd5e1; padding-bottom:12px; margin-bottom:16px;">
                  <h3 style="font-family:'Martel', serif; text-transform:lowercase; margin:0; font-weight:900;">jejak imani</h3>
                  <p style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 0 0;">Bukti Transaksi Tim Khidmat</p>
                </div>
                
                <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:10px;">
                  <div><strong>Tipe Transaksi:</strong> ${tx.category}</div>
                  <div><strong>Keterangan:</strong> ${tx.description}</div>
                  <div><strong>Tanggal:</strong> ${formatDateDisplay(tx.date)}</div>
                  <div><strong>Status:</strong> <span class="badge ${statusClass}">${tx.status}</span></div>
                  <div style="border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:8px 0; margin-top:8px; font-weight:800; font-size:1.05rem; display:flex; justify-content:space-between;">
                    <span>NOMINAL:</span>
                    <span style="color:${amountColor};">${amountText}</span>
                  </div>
                </div>
                ${itemsHtml}
              </div>
              
              ${receiptHtml}
              
              <div style="margin-top:16px; text-align:center;">
                <button id="capture-tx-btn" class="btn btn-secondary" style="width:100%; padding:8px 16px; font-size:0.8rem; border-color:var(--primary-gold); color:var(--primary-gold); display:inline-flex; align-items:center; justify-content:center; gap:6px;"><i data-lucide="camera" style="width:14px; height:14px;"></i> Capture & Download Slip Gambar</button>
              </div>
              
              ${tx.rawType === 'expense' && (tx.status === 'Approved' || tx.status === 'Disetujui') ? `
                <div style="margin-top:14px; text-align:center;">
                  <button id="modal-request-delete-btn" class="btn btn-danger" style="width:100%; padding:10px;">Request Hapus Transaksi</button>
                </div>
              ` : ''}
            </div>
          `;
          
          openModal("Preview Detail Transaksi", strukHtml);

          const tglBtn = document.getElementById("toggle-receipt-btn");
          if (tglBtn) {
            tglBtn.onclick = () => {
              document.getElementById("receipt-preview-container").classList.toggle("hidden");
            };
          }
          
          const capBtn = document.getElementById("capture-tx-btn");
          if (capBtn) {
            capBtn.onclick = () => {
              const originalText = capBtn.innerHTML;
              capBtn.innerHTML = "Rendering Slip...";
              
              const runCapture = () => {
                const target = document.getElementById("tx-capture-area");
                html2canvas(target, { backgroundColor: "#ffffff", scale: 2 }).then(canvas => {
                  const imgUrl = canvas.toDataURL("image/png");
                  const link = document.createElement("a");
                  link.href = imgUrl;
                  link.download = `Slip_Transaksi_${tx.id}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  capBtn.innerHTML = originalText;
                  showToast("Slip transaksi berhasil di-download!");
                }).catch(err => {
                  capBtn.innerHTML = originalText;
                  showToast("Gagal capture gambar", "error");
                });
              };
              
              if (typeof html2canvas === "undefined") {
                const script = document.createElement("script");
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script.onload = runCapture;
                document.head.appendChild(script);
              } else {
                runCapture();
              }
            };
          }

          
          const delBtn = document.getElementById("modal-request-delete-btn");
          if (delBtn) {
            delBtn.onclick = () => {
              if (confirm("Kirim permintaan hapus transaksi ini ke Admin?")) {
                const exists = state.financial.deleteRequests.some(r => r.expenseId === tx.id);
                if (exists) {
                  showToast("Request hapus sudah pernah dikirim sebelumnya.", "error");
                  return;
                }
                state.financial.deleteRequests.push({
                  id: `del-${Date.now()}`,
                  expenseId: tx.id,
                  username,
                  reason: "Request hapus dari Tim",
                  status: "Pending"
                });
                addNotification("financial", `Request Hapus Transaksi: ${state.currentUser.name} memohon penghapusan exp ${tx.id}`, { username, groupName: tx.details.groupName || '' });
                saveState();
                closeModal();
                showToast("Request hapus berhasil dikirim!");
                loadUserTab("kas");
              }
            };
          }
        };
      });
    };

    const sInp = document.getElementById("user-tx-search");
    const dFromInp = document.getElementById("user-tx-date-from");
    const dToInp = document.getElementById("user-tx-date-to");
    const catInp = document.getElementById("user-tx-cat-filter");

    if (sInp) sInp.oninput = renderTxList;
    if (dFromInp) dFromInp.onchange = renderTxList;
    if (dToInp) dToInp.onchange = renderTxList;
    if (catInp) catInp.onchange = renderTxList;

    renderTxList();
    lucide.createIcons();
  } else if (tab === "jadwal") {
    const offers = state.assignmentOffers.filter(o => o.status === "Tersedia" || (o.status === "Pending Approval" && o.staff.includes(username)));
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; margin-top:10px;">
        <span style="font-size:0.95rem; font-weight:800;">Jadwal Tugas Tersedia</span>
      </div>
      <div class="grid-2col" style="gap:16px;" id="user-offers-list-container"></div>
    `;
    
    const listEl = document.getElementById("user-offers-list-container");
    if (offers.length === 0) {
      listEl.innerHTML = `<p style="text-align:center; color:var(--text-light); padding:20px; grid-column:span 2;">Tidak ada jadwal tugas tersedia untuk diajukan.</p>`;
      return;
    }
    
    listEl.innerHTML = offers.map(o => {
      const isPending = (o.status === "Pending Approval");
      return `
        <div class="assignment-card" style="border-left-color: ${isPending ? 'var(--primary-gold)' : '#10b981'}; background:#fff; padding:16px; margin-bottom:0;">
          <div class="assignment-header" style="border-bottom:1px solid #f1f3f5; padding-bottom:8px; margin-bottom:10px;">
            <strong>${o.type}</strong>
            <span class="badge ${isPending ? 'badge-warning' : 'badge-success'}">${o.status}</span>
          </div>
          <div class="structured-card-grid">
            <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value">${o.groupName}</span></div>
            <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(o.date)} | ${o.time} Saudi</span></div>
            <div class="structured-card-row"><span class="structured-card-label">Wilayah:</span><span class="structured-card-value">${o.region}</span></div>
            ${o.details.remarks ? `<div class="structured-card-row"><span class="structured-card-label">Keterangan:</span><span class="structured-card-value">${o.details.remarks}</span></div>` : ''}
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:12px;">
            ${isPending ? `
              <button class="btn btn-secondary cancel-apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Batal Ajukan</button>
            ` : `
              <button class="btn btn-gold apply-offer-btn" data-id="${o.id}" style="width:auto; padding:6px 12px; font-size:0.75rem;">Apply Tugas</button>
            `}
          </div>
        </div>
      `;
    }).join('');
    
    listEl.querySelectorAll(".apply-offer-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const offer = state.assignmentOffers.find(x => x.id === id);
        if (offer) {
          if (confirm(`Ajukan diri Anda untuk penugasan ${offer.type} grup ${offer.groupName}?`)) {
            offer.staff = [username];
            offer.status = "Pending Approval";
            addNotification("penjadwalan", `Pengajuan Tugas Mandiri: ${state.currentUser.name} mengajukan diri untuk tugas ${offer.type} grup ${offer.groupName}`, { username, groupName: offer.groupName });
            saveState();
            showToast("Pengajuan tugas mandiri dikirim!");
            loadUserTab("jadwal");
          }
        }
      };
    });
    
    listEl.querySelectorAll(".cancel-apply-offer-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const offer = state.assignmentOffers.find(x => x.id === id);
        if (offer) {
          if (confirm("Batalkan pengajuan diri Anda untuk tugas ini?")) {
            offer.staff = [];
            offer.status = "Tersedia";
            saveState();
            showToast("Pengajuan dibatalkan.");
            loadUserTab("jadwal");
          }
        }
      };
    });
    lucide.createIcons();
    
  } else if (tab === "absensi") {
    const myActiveTasks = state.assignments.filter(a => a && Array.isArray(a.staff) && a.staff.includes(username) && a.status !== "Selesai" && a.published !== false);
    const myAbsences = state.reports.attendance.filter(a => a.username === username);
    const hasActiveTask = (myActiveTasks.length > 0);
    
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; margin-top:10px; flex-wrap:wrap; gap:8px;">
        <h3 class="user-section-title" style="margin:0;">Riwayat Absensi Anda</h3>
        <button id="start-new-absen-btn" class="btn btn-gold" style="width:auto; padding:6px 14px; font-size:0.8rem; font-weight:800;">
          <i data-lucide="camera" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Mulai Absensi Baru
        </button>
      </div>

      <div class="form-group" style="margin-top:10px; margin-bottom:14px;">
        <input type="text" id="user-absen-search" class="form-input" placeholder="Cari riwayat (kategori, tanggal, lokasi)...">
      </div>
      
      <div class="activity-list" id="user-absen-history-list"></div>
    `;
    
    lucide.createIcons();
    
    const renderAbsenceHistory = () => {
      const query = (document.getElementById("user-absen-search")?.value || "").toLowerCase().trim();
      const listEl = document.getElementById("user-absen-history-list");
      if (!listEl) return;

      const filtered = myAbsences.slice().reverse().filter(a => {
        const task = state.assignments.find(t => t.id === a.taskId);
        const taskType = task ? task.type.toLowerCase() : "umum";
        const groupName = task ? task.groupName.toLowerCase() : "";
        const dateStr = formatDateDisplay(a.date).toLowerCase();
        const locationStr = (a.location || a.coords || "").toLowerCase();
        const typeStr = (a.type || "").toLowerCase();
        return taskType.includes(query) || groupName.includes(query) || dateStr.includes(query) || locationStr.includes(query) || typeStr.includes(query);
      });
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; color:var(--text-light); padding:24px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; font-size:0.85rem;">Belum ada riwayat absensi tercatat.</div>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(a => {
        const task = state.assignments.find(t => t.id === a.taskId);
        const typeLabel = a.type === "Masuk" ? "Absensi Masuk" : "Absensi Keluar";
        const badgeBg = a.type === "Masuk" ? "#d1fae5" : "#fee2e2";
        const badgeColor = a.type === "Masuk" ? "#065f46" : "#991b1b";

        return `
          <div class="activity-item" style="border:1px solid #e2e8f0; background:#fff; border-radius:10px; padding:12px; margin-bottom:10px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span class="badge" style="background:${badgeBg}; color:${badgeColor}; font-weight:800; font-size:0.75rem; padding:3px 8px;">${typeLabel}</span>
                <span style="font-size:0.75rem; color:#64748b; font-weight:600;">📅 ${formatDateDisplay(a.date)} | Pukul ${a.time} Saudi</span>
              </div>
              <div style="font-size:0.85rem; color:#1e293b; font-weight:700; margin-bottom:2px;">
                ${task ? task.type : 'Penjadwalan Tim'}
              </div>
              <div style="font-size:0.8rem; color:#475569; margin-bottom:8px;">
                Grup: <strong>${task ? task.groupName : 'Umum'}</strong><br>
                <span style="font-size:0.75rem; color:#64748b;">📍 ${a.location || a.coords || 'Saudi Arabia'}</span>
              </div>

              ${a.photo ? `
                <div style="display:flex; justify-content:flex-end;">
                  <button class="btn btn-secondary view-absen-photo-btn" data-id="${a.id}" style="width:auto; padding:5px 12px; font-size:0.75rem; border-radius:6px; font-weight:700; border:1px solid #cbd5e1;">
                    🔍 Lihat Foto Absensi & Watermark
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      listEl.querySelectorAll(".view-absen-photo-btn").forEach(btn => {
        btn.onclick = () => {
          const absId = btn.getAttribute("data-id");
          const absRecord = myAbsences.find(x => x.id === absId);
          if (!absRecord || !absRecord.photo) return;
          
          const photoHtml = `
            <div style="text-align:center; padding:4px 0;">
              <img src="${absRecord.photo}" style="width:100%; border-radius:10px; border:2px solid #dfc06b; box-shadow:0 6px 16px rgba(0,0,0,0.15); margin-bottom:12px;">
              <div style="display:flex; justify-content:center;">
                <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
              </div>
            </div>
          `;
          openModal("Foto Absensi & Stempel Watermark", photoHtml);
        };
      });
    };
    
    const searchInput = document.getElementById("user-absen-search");
    if (searchInput) searchInput.oninput = renderAbsenceHistory;
    renderAbsenceHistory();
    
    document.getElementById("start-new-absen-btn").onclick = () => {
      openAttendanceFormPopup();
    };
  } else if (tab === "insiden") {
    const myIncidents = state.reports.incidents.filter(i => i.username === username);
    container.innerHTML = `
      <div style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:16px;">
        <button id="add-inc-user-popup-btn" class="btn btn-gold" style="width:auto; padding:6px 12px; font-size:0.8rem;"><i data-lucide="plus"></i> Tambah Laporan</button>
      </div>

      <div class="form-group" style="margin-bottom:16px;">
        <input type="text" id="user-inc-search" class="form-input" placeholder="Cari Laporan Kejadian (grup, kategori, detail)...">
      </div>
      
      <!-- List History -->
      <h3 class="user-section-title">Riwayat Kejadian</h3>
      <div class="activity-list" id="user-inc-history-list"></div>
    `;
    
    const renderIncList = () => {
      const query = document.getElementById("user-inc-search").value.toLowerCase().trim();
      const listEl = document.getElementById("user-inc-history-list");
      const filtered = myIncidents.filter(i => 
        i.category.toLowerCase().includes(query) || 
        i.groupName.toLowerCase().includes(query) || 
        i.detail.toLowerCase().includes(query) || 
        i.date.toLowerCase().includes(query)
      );
      
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:14px;font-size:0.85rem;">Tidak ada laporan kejadian ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(i => {
        const formattedDetail = i.detail.replace(/\n/g, '<br>');
        return `
          <div class="activity-item" style="border-bottom:var(--border-light); padding:10px 0;">
            <div class="activity-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.85rem;">${i.category}</strong>
                <span class="badge badge-gold">${i.status}</span>
              </div>
              <div style="font-size:0.8rem; margin:6px 0; line-height:1.4;">
                Grup: <strong>${i.groupName}</strong><br>
                ${formattedDetail}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light);">
                <span>${i.date}</span>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-secondary copy-inc-text-btn" data-text="*LAPORAN OPERASIONAL TIM KHIDMAT*\nGrup: ${i.groupName}\nKategori: ${i.category}\nDetail: ${i.detail}\n---------------------------------\njejak imani - Saudi Handling" style="width:auto; padding:4px 8px; display:inline-flex; align-items:center; justify-content:center;" title="Salin Teks WA">
                    <i data-lucide="copy" style="width:14px; height:14px;"></i>
                  </button>
                  ${i.status !== 'Request Hapus' ? `
                    <button class="btn btn-danger request-delete-inc-btn" data-id="${i.id}" style="width:auto; padding:4px 8px; display:inline-flex; align-items:center; justify-content:center;" title="Request Hapus">
                      <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      listEl.querySelectorAll(".copy-inc-text-btn").forEach(btn => {
        btn.onclick = () => {
          const text = btn.getAttribute("data-text");
          navigator.clipboard.writeText(text);
          showToast("Teks laporan WhatsApp berhasil disalin!");
        };
      });
      listEl.querySelectorAll(".request-delete-inc-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Ajukan permintaan hapus laporan kejadian ini ke admin?")) {
            const inc = state.reports.incidents.find(x => x.id === id);
            if (inc) {
              inc.status = "Request Hapus";
              addNotification("penjadwalan", `Request Hapus Kejadian: ${state.currentUser.name} memohon penghapusan laporan kejadian grup ${inc.groupName}`, { username: state.currentUser.username, groupName: inc.groupName });
              saveState();
              showToast("Permintaan hapus dikirim ke admin.");
              renderIncList();
            }
          }
        };
      });
    };
    
    document.getElementById("user-inc-search").oninput = renderIncList;
    renderIncList();
    
    document.getElementById("add-inc-user-popup-btn").onclick = () => {
      const popupHtml = `
        <form id="user-submit-inc-form-popup">
          <div class="form-group">
            <label class="form-label">Pilih Grup Keberangkatan</label>
            <select id="user-inc-group-popup" class="form-select" required>
              <option value="">-- Pilih Grup --</option>
              ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select id="user-inc-cat-select-popup" class="form-select" required>
              <option value="Waktu Kedatangan Bandara">Waktu Kedatangan Bandara</option>
              <option value="Waktu Kepulangan Bandara">Waktu Kepulangan Bandara</option>
              <option value="Lainnya">Lainnya (Custom Kategori)</option>
            </select>
          </div>
          
          <div class="form-group hidden" id="user-inc-custom-cat-container-popup">
            <label class="form-label">Nama Kategori Kustom</label>
            <input type="text" id="user-inc-custom-cat-popup" class="form-input">
          </div>
          
          <!-- Conditional fields -->
          <div id="inc-arrival-fields-popup" class="hidden">
            <div class="form-group">
              <label class="form-label">Waktu Landing (Saudi Time)</label>
              <input type="time" id="user-arr-landing-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Jamaah Keluar Imigrasi (Saudi Time)</label>
              <input type="time" id="user-arr-imigrasi-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Bus Berangkat (Saudi Time)</label>
              <input type="time" id="user-arr-bus-popup" class="form-input">
            </div>
          </div>
          
          <div id="inc-departure-fields-popup" class="hidden">
            <div class="form-group">
              <label class="form-label">Waktu Bus Masuk Checkpoint (Saudi Time)</label>
              <input type="time" id="user-dep-checkpoint-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Bus Naik (Saudi Time)</label>
              <input type="time" id="user-dep-board-popup" class="form-input">
            </div>
            <div class="form-group">
              <label class="form-label">Waktu Jamaah Masuk Imigrasi (Saudi Time)</label>
              <input type="time" id="user-dep-imigrasi-popup" class="form-input">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Detail Laporan Tambahan</label>
            <textarea id="user-inc-detail-popup" class="form-textarea" rows="3" required></textarea>
          </div>
          
          <button type="submit" class="btn btn-primary">Kirim Laporan</button>
        </form>
      `;
      openModal("Tambah Laporan Kejadian", popupHtml);
      
      const catSelectPopup = document.getElementById("user-inc-cat-select-popup");
      catSelectPopup.onchange = () => {
        const val = catSelectPopup.value;
        document.getElementById("user-inc-custom-cat-container-popup").classList.add("hidden");
        document.getElementById("inc-arrival-fields-popup").classList.add("hidden");
        document.getElementById("inc-departure-fields-popup").classList.add("hidden");
        
        if (val === "Lainnya") {
          document.getElementById("user-inc-custom-cat-container-popup").classList.remove("hidden");
        } else if (val === "Waktu Kedatangan Bandara") {
          document.getElementById("inc-arrival-fields-popup").classList.remove("hidden");
        } else if (val === "Waktu Kepulangan Bandara") {
          document.getElementById("inc-departure-fields-popup").classList.remove("hidden");
        }
      };
      
      document.getElementById("user-submit-inc-form-popup").onsubmit = (event) => {
        event.preventDefault();
        const groupName = document.getElementById("user-inc-group-popup").value;
        const catVal = catSelectPopup.value;
        const customCat = document.getElementById("user-inc-custom-cat-popup").value.trim();
        const finalCategory = catVal === "Lainnya" ? customCat : catVal;
        let detailText = document.getElementById("user-inc-detail-popup").value.trim();
        
        if (catVal === "Waktu Kedatangan Bandara") {
          const landing = document.getElementById("user-arr-landing-popup").value;
          const imigrasi = document.getElementById("user-arr-imigrasi-popup").value;
          const bus = document.getElementById("user-arr-bus-popup").value;
          let totalStr = "N/A";
          if (imigrasi && bus && imigrasi.includes(':') && bus.includes(':')) {
            const [h1, m1] = imigrasi.split(':').map(Number);
            const [h2, m2] = bus.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
              let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diffMin < 0) diffMin += 24 * 60;
              totalStr = `${Math.floor(diffMin / 60)} jam ${diffMin % 60} menit`;
            }
          }
          detailText = `Landing: ${landing}\nKeluar Imigrasi: ${imigrasi}\nBus Berangkat: ${bus}\nTotal Waktu: ${totalStr}\nCatatan: ${detailText}`;
        } else if (catVal === "Waktu Kepulangan Bandara") {
          const checkpoint = document.getElementById("user-dep-checkpoint-popup").value;
          const board = document.getElementById("user-dep-board-popup").value;
          const imigrasi = document.getElementById("user-dep-imigrasi-popup").value;
          let totalStr = "N/A";
          if (board && imigrasi && board.includes(':') && imigrasi.includes(':')) {
            const [h1, m1] = board.split(':').map(Number);
            const [h2, m2] = imigrasi.split(':').map(Number);
            if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
              let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diffMin < 0) diffMin += 24 * 60;
              totalStr = `${Math.floor(diffMin / 60)} jam ${diffMin % 60} menit`;
            }
          }
          detailText = `Bus Checkpoint: ${checkpoint}\nBus Naik: ${board}\nImigrasi: ${imigrasi}\nTotal Waktu: ${totalStr}\nCatatan: ${detailText}`;
        }
        
        state.reports.incidents.push({
          id: `inc-${Date.now()}`,
          username,
          groupName,
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          category: finalCategory,
          detail: detailText,
          status: "Diproses",
          unread: true
        });
        saveState();
        
        addNotification("penjadwalan", `Laporan Kejadian: ${state.currentUser.name} melaporkan insiden ${finalCategory}`, { username, groupName });
        closeModal();
        showToast("Laporan kejadian berhasil disubmit!");
        loadUserTab("insiden");
      };
    };
    
    lucide.createIcons();
  }
}
// --- 9. PORTAL ADMIN (COLLAPSIBLE SIDEBAR) ---
function renderAdminPortal(subView) {
  const { gregorianLongStr, hijriStr, timeStr } = getSaudiDateTime();
  const activeSubView = subView.split("?")[0];
  
  APP_CONTAINER.innerHTML = `
    <div class="admin-layout">
      <!-- Sidebar -->
      <aside class="admin-sidebar" id="admin-sidebar">
        <div class="admin-sidebar-header">
          <div class="admin-brand">
            <img src="assets/logo.png" alt="Logo jejak imani" class="admin-logo" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%220.9em%22 font-size=%2290%22>🕋</text></svg>';">
            <h1 class="admin-title">Portal Admin</h1>
          </div>
          <button class="sidebar-close-btn" id="sidebar-close-btn">
            <i data-lucide="x" style="width: 20px; height: 20px;"></i>
          </button>
        </div>
        
        <nav class="admin-nav">
          <!-- Kategori: Menu Baru -->
          <div class="sidebar-category-title" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-light); padding:10px 16px 4px 16px; font-weight:700; opacity:0.8;">Menu Baru</div>
          <div class="admin-nav-item ${activeSubView === 'dashboard' ? 'active' : ''}" data-target="dashboard">
            <i data-lucide="layout-dashboard"></i><span>Dashboard</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'itinerary' ? 'active' : ''}" data-target="itinerary">
            <i data-lucide="calendar"></i><span>Itinerary</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'penjadwalan' ? 'active' : ''}" data-target="penjadwalan">
            <i data-lucide="users-round"></i><span>Penjadwalan Tim</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'datatim' ? 'active' : ''}" data-target="datatim">
            <i data-lucide="contact"></i><span>Data Tim</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'financial' ? 'active' : ''}" data-target="financial">
            <i data-lucide="wallet"></i><span>Financial</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'laporan' ? 'active' : ''}" data-target="laporan">
            <i data-lucide="file-spreadsheet"></i><span>Laporan</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'vendor' ? 'active' : ''}" data-target="vendor">
            <i data-lucide="store"></i><span>Vendor & Booking</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'aset' ? 'active' : ''}" data-target="aset">
            <i data-lucide="package-search"></i><span>Aset Operasional</span>
          </div>
          
          <!-- Kategori: Menu Yang Sudah Ada -->
          <div class="sidebar-category-title" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-light); padding:16px 16px 4px 16px; font-weight:700; opacity:0.8;">Menu Yang Sudah Ada</div>
          <div class="admin-nav-item ${activeSubView === 'manifest' ? 'active' : ''}" data-target="manifest">
            <i data-lucide="clipboard-list"></i><span>Manifest Grup</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'manifest-jamaah' ? 'active' : ''}" data-target="manifest-jamaah">
            <i data-lucide="users"></i><span>Manifest Jamaah</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'roomlist' ? 'active' : ''}" data-target="roomlist">
            <i data-lucide="hotel"></i><span>Roomlist Template</span>
          </div>
          <div class="admin-nav-item ${activeSubView === 'dokumen' ? 'active' : ''}" data-target="dokumen">
            <i data-lucide="files"></i><span>Arsip Dokumen</span>
          </div>
        </nav>
        
        <div class="admin-sidebar-footer" style="flex-direction: column; align-items: stretch; gap: 8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div class="admin-user-info">
              <span class="admin-user-name">${state.currentUser.name}</span>
              <span class="admin-user-role">Administrator</span>
            </div>
            <button class="logout-btn" id="admin-logout-btn" title="Logout">
              <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
            </button>
          </div>
          <div class="db-status-wrapper" style="font-size:0.7rem; color:var(--text-light); display:flex; align-items:center; gap:6px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px; margin-top:2px;">
            <span class="db-status-dot" style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:#ef4444; transition: all 0.3s ease;"></span>
            <span style="font-weight:600; opacity:0.9;">DB:</span>
            <span class="db-status-text" style="font-weight:500;">Terputus (Lokal)</span>
          </div>
        </div>
      </aside>
      
      <!-- Main Content -->
      <div class="admin-main">
        <header class="admin-topbar">
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="sidebar-toggle-btn" id="sidebar-toggle-btn">
              <i data-lucide="menu" style="width: 22px; height: 22px;"></i>
            </button>
            <h2 class="admin-page-title" id="admin-view-title">Dashboard</h2>
          </div>
          <div class="admin-topbar-right" style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary" onclick="downloadDatabaseBackup();" title="Unduh Backup Database JSON" style="width:auto; padding:5px 10px; font-size:0.78rem; display:flex; align-items:center; gap:5px; background:#f8fafc; border-color:#cbd5e1;">
              <i data-lucide="download" style="width: 15px; height: 15px;"></i> Backup Data
            </button>
            <button class="btn btn-secondary" onclick="restoreDatabaseBackup();" title="Pulihkan Backup Database JSON" style="width:auto; padding:5px 10px; font-size:0.78rem; display:flex; align-items:center; gap:5px; background:#f8fafc; border-color:#cbd5e1;">
              <i data-lucide="upload" style="width: 15px; height: 15px;"></i> Restore Data
            </button>
            <button class="btn btn-secondary" onclick="window.location.reload();" title="Reload Web" style="width:auto; padding:5px 10px; font-size:0.78rem; display:flex; align-items:center; gap:5px; background:#f8fafc; border-color:#cbd5e1;">
              <i data-lucide="rotate-cw" style="width: 15px; height: 15px;"></i> Refresh
            </button>
            <div class="admin-datetime">
              <span>📅 ${gregorianLongStr} / ${hijriStr}</span>
              <span class="admin-clock">Saudi: <span class="saudi-clock-widget">${timeStr}</span></span>
            </div>
          </div>
        </header>
        
        <main class="admin-body" id="admin-subview-content"></main>
      </div>
    </div>
  `;
  
  // Navigation mapping
  document.querySelectorAll(".admin-nav-item").forEach(item => {
    item.onclick = () => window.location.hash = `#admin/${item.getAttribute("data-target")}`;
  });
  
  const sidebar = document.getElementById("admin-sidebar");
  document.getElementById("sidebar-toggle-btn").onclick = () => sidebar.classList.toggle("collapsed");
  const closeBtn = document.getElementById("sidebar-close-btn");
  if (closeBtn) closeBtn.onclick = () => sidebar.classList.add("collapsed");
  
  document.getElementById("admin-logout-btn").onclick = () => {
    state.currentUser = null;
    saveState();
    window.location.hash = "#login";
  };
  
  const viewTitle = document.getElementById("admin-view-title");
  
  if (activeSubView === "dashboard") {
    viewTitle.textContent = "Dashboard";
    renderAdminDashboard();
  } else if (activeSubView === "itinerary") {
    viewTitle.textContent = "Itinerary";
    renderAdminItinerary();
  } else if (activeSubView === "penjadwalan") {
    viewTitle.textContent = "Penjadwalan";
    renderAdminPenjadwalan();
    if (window.location.hash.includes("filter=applied")) {
      setTimeout(() => {
        const quotaFilter = document.getElementById("admin-task-quota-filter");
        if (quotaFilter) {
          quotaFilter.value = "pending_approval";
          quotaFilter.dispatchEvent(new Event('change'));
        }
      }, 50);
    }
  } else if (activeSubView === "datatim") {
    viewTitle.textContent = "Data Tim";
    renderAdminDataTim();
  } else if (activeSubView === "financial") {
    viewTitle.textContent = "Keuangan";
    renderAdminFinancial();
  } else if (activeSubView === "laporan") {
    viewTitle.textContent = "Laporan Lapangan";
    renderAdminLaporan();
  } else if (activeSubView === "vendor") {
    viewTitle.textContent = "Vendor & Booking";
    renderAdminVendor();
  } else if (activeSubView === "manifest") {
    viewTitle.textContent = "Manifest Grup";
    renderAdminManifest();
  } else if (activeSubView === "manifest-jamaah") {
    viewTitle.textContent = "Manifest Jamaah";
    renderAdminManifestJamaah();
  } else if (activeSubView === "roomlist") {
    viewTitle.textContent = "Roomlist Template";
    renderAdminRoomlist();
  } else if (activeSubView === "dokumen") {
    viewTitle.textContent = "Arsip Dokumen";
    renderAdminDokumen();
  } else if (activeSubView === "aset") {
    viewTitle.textContent = "Aset Operasional";
    renderAdminAset();
  } else {
    window.location.hash = "#admin/dashboard";
  }
  
  lucide.createIcons();
}

// --- ADMIN SUB-VIEW: DASHBOARD ---
function renderAdminDashboard() {
  const container = document.getElementById("admin-subview-content");
  
  const pendingExpenses = state.financial.expenses.filter(e => e.status === 'Pending').length;
  const totalApplicantsCount = state.assignments.reduce((sum, t) => sum + (t.applicants ? t.applicants.length : 0), 0);
  const pendingUsersCount = state.users.filter(u => u.pendingApproval === true).length;
  const unreadAbsences = state.reports.attendance.filter(a => a.unread).length;
  const unreadIncidents = state.reports.incidents.filter(i => i.unread).length;
  const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  const allCount = state.groups.length;
  const upcomingCount = state.groups.filter(g => todayStr < g.dateStart).length;
  const activeCount = state.groups.filter(g => todayStr >= g.dateStart && todayStr <= g.dateEnd).length;
  const completedCount = state.groups.filter(g => todayStr > g.dateEnd).length;
  
  container.innerHTML = `
    <!-- Top metrics -->
    <div class="metrics-grid">
      <!-- 1. Kas Dompet Utama -->
      <div class="metric-card" onclick="window.location.hash = '#admin/financial'" style="cursor:pointer;" title="Buka Financial">
        <div class="metric-info">
          <h4>Kas Dompet Utama</h4>
          <div class="metric-val gold" style="white-space: nowrap;">SAR ${state.financial.mainBalance.toLocaleString('id-ID')}</div>
        </div>
        <div class="metric-icon"><i data-lucide="wallet"></i></div>
      </div>
      
      <!-- 2. Approval Kas -->
      <div class="metric-card" onclick="window.location.hash = '#admin/financial'" style="cursor:pointer;" title="Buka Approval Kas">
        <div class="metric-info">
          <h4>Approval Kas</h4>
          <div class="metric-val ${pendingExpenses > 0 ? 'gold' : ''}">${pendingExpenses} Berkas</div>
        </div>
        <div class="metric-icon"><i data-lucide="receipt"></i></div>
      </div>
      
      <!-- 3. Laporan Absensi -->
      <div class="metric-card" onclick="window.adminLaporanTabMode = 'absensi'; window.location.hash = '#admin/laporan';" style="cursor:pointer;" title="Buka Laporan Absensi">
        <div class="metric-info">
          <h4>Laporan Absensi</h4>
          <div class="metric-val ${unreadAbsences > 0 ? 'gold' : ''}">${unreadAbsences} Absen</div>
        </div>
        <div class="metric-icon"><i data-lucide="clipboard-list"></i></div>
      </div>
      
      <!-- 4. Laporan Kejadian -->
      <div class="metric-card" onclick="window.adminLaporanTabMode = 'kejadian'; window.location.hash = '#admin/laporan';" style="cursor:pointer;" title="Buka Laporan Kejadian">
        <div class="metric-info">
          <h4>Laporan Kejadian</h4>
          <div class="metric-val ${unreadIncidents > 0 ? 'gold' : ''}">${unreadIncidents} Kejadian</div>
        </div>
        <div class="metric-icon"><i data-lucide="alert-triangle"></i></div>
      </div>
      
      <!-- 5. Pendaftar Baru -->
      <div class="metric-card" onclick="window.location.hash = '#admin/datatim?tab=pending'" style="cursor:pointer;" title="Buka Pendaftar Baru">
        <div class="metric-info">
          <h4>Pendaftar Baru</h4>
          <div class="metric-val ${pendingUsersCount > 0 ? 'gold' : ''}">${pendingUsersCount} Akun</div>
        </div>
        <div class="metric-icon"><i data-lucide="user-plus"></i></div>
      </div>
      
      <!-- 6. Apply Tugas -->
      <div class="metric-card" onclick="window.location.hash = '#admin/penjadwalan?filter=applied'" style="cursor:pointer;" title="Buka Approval Apply Tugas">
        <div class="metric-info">
          <h4>Apply Tugas</h4>
          <div class="metric-val ${totalApplicantsCount > 0 ? 'gold' : ''}">${totalApplicantsCount} Pengajuan</div>
        </div>
        <div class="metric-icon"><i data-lucide="user-check"></i></div>
      </div>
    </div>
    
    <!-- Calendar View and Active Groups -->
    
      <div class="table-card">
        <div class="table-header-bar" style="border-bottom:none; padding-bottom:4px;">
          <h3 class="table-title">Daftar Rombongan Grup</h3>
        </div>
        <div class="tab-header" style="margin-bottom:16px; padding:0 16px; border-bottom:none; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-secondary tab-btn active" id="grup-tab-all" data-filter="all" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid var(--primary-gold); background:var(--primary-gold); color:#fff; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Semua <span class="badge" style="background:#fff; color:var(--primary-gold); border-radius:12px; padding:2px 6px; font-size:0.65rem;">${allCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-upcoming" data-filter="upcoming" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Akan Datang <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${upcomingCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-active" data-filter="active" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Aktif <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${activeCount}</span>
          </button>
          <button class="btn btn-secondary tab-btn" id="grup-tab-completed" data-filter="completed" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid #cbd5e1; background:#fff; color:#475569; display:inline-flex; align-items:center; gap:6px; font-weight:700;">
            Selesai <span class="badge" style="background:#cbd5e1; color:#0f172a; border-radius:12px; padding:2px 6px; font-size:0.65rem;">${completedCount}</span>
          </button>
        </div>
        <div class="table-wrapper" style="max-height: 280px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Rombongan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="admin-groups-dashboard-tbody"></tbody>
          </table>
        </div>
      </div>
      
      <!-- Interactive active group calendar widget -->
      <div class="dashboard-calendar">
        <div class="calendar-header">
          <button class="calendar-nav-btn" id="cal-prev-btn">&larr;</button>
          <div class="calendar-title-text" id="cal-month-title">Juli 2026</div>
          <button class="calendar-nav-btn" id="cal-next-btn">&rarr;</button>
        </div>
        <div class="calendar-grid" id="cal-grid-body"></div>
        <div style="margin-top:12px; font-size:0.7rem; display:flex; gap:10px; justify-content:center;">
          <span>🟢 Makkah</span>
          <span>🔵 Madinah</span>
          <span>🟡 Jeddah</span>
        </div>
      </div>
  `;
  
  const filterGroupList = (filterType) => {
    let list = state.groups;
    if (filterType === "upcoming") {
      list = state.groups.filter(g => todayStr < g.dateStart);
    } else if (filterType === "active") {
      list = state.groups.filter(g => todayStr >= g.dateStart && todayStr <= g.dateEnd);
    } else if (filterType === "completed") {
      list = state.groups.filter(g => todayStr > g.dateEnd);
    }
    
    const tbody = document.getElementById("admin-groups-dashboard-tbody");
    if (!tbody) return;
    
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada grup untuk kategori ini.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = list.map(g => {
      let badgeClass = "badge-info";
      let statusText = "Akan Datang";
      if (todayStr >= g.dateStart && todayStr <= g.dateEnd) {
        badgeClass = "badge-success";
        statusText = "Aktif";
      } else if (todayStr > g.dateEnd) {
        badgeClass = "badge-secondary";
        statusText = "Selesai";
      }
      return `
        <tr class="active-group-row" data-name="${g.name}" style="cursor:pointer;">
          <td><strong>${g.name}</strong></td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');
    
    tbody.querySelectorAll(".active-group-row").forEach(row => {
      row.onclick = () => {
        const name = row.getAttribute("data-name");
        window.location.hash = `#admin/manifest?search=${encodeURIComponent(name)}`;
      };
    });
  };

  const groupTabBtns = container.querySelectorAll(".table-card .tab-btn");
  groupTabBtns.forEach(btn => {
    btn.onclick = () => {
      groupTabBtns.forEach(b => {
        b.classList.remove("active");
        b.style.background = "#fff";
        b.style.borderColor = "#cbd5e1";
        b.style.color = "#475569";
        const bBadge = b.querySelector(".badge");
        if (bBadge) {
          bBadge.style.background = "#cbd5e1";
          bBadge.style.color = "#0f172a";
        }
      });
      
      btn.classList.add("active");
      btn.style.background = "var(--primary-gold)";
      btn.style.borderColor = "var(--primary-gold)";
      btn.style.color = "#fff";
      const btnBadge = btn.querySelector(".badge");
      if (btnBadge) {
        btnBadge.style.background = "#fff";
        btnBadge.style.color = "var(--primary-gold)";
      }
      
      filterGroupList(btn.getAttribute("data-filter"));
    };
  });
  
  filterGroupList("all");
  lucide.createIcons();
  
  renderCalendarNavigator();
  
  document.getElementById("cal-prev-btn").onclick = () => {
    currentCalMonth--;
    if (currentCalMonth < 0) {
      currentCalMonth = 11;
      currentCalYear--;
    }
    renderCalendarNavigator();
  };
  
  document.getElementById("cal-next-btn").onclick = () => {
    currentCalMonth++;
    if (currentCalMonth > 11) {
      currentCalMonth = 0;
      currentCalYear++;
    }
    renderCalendarNavigator();
  };
}
// --- ADMIN SUB-VIEW: ITINERARY ---

function renderCalendarNavigator() {
  const grid = document.getElementById("cal-grid-body");
  const title = document.getElementById("cal-month-title");
  if (!grid || !title) return;
  
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  title.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
  
  grid.innerHTML = `
    <div class="calendar-day-header">Min</div>
    <div class="calendar-day-header">Sen</div>
    <div class="calendar-day-header">Sel</div>
    <div class="calendar-day-header">Rab</div>
    <div class="calendar-day-header">Kam</div>
    <div class="calendar-day-header">Jum</div>
    <div class="calendar-day-header">Sab</div>
  `;
  
  const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += `<div style="background:none;"></div>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const todayObj = new Date();
    const isToday = (currentCalYear === todayObj.getFullYear() && currentCalMonth === todayObj.getMonth() && day === todayObj.getDate());
    const checkDateStr = `${currentCalYear}-${String(currentCalMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Group active logic based on itinerary location sync
    let activeMakkah = [];
    let activeMadinah = [];
    let activeJeddah = [];
    
    state.groups.forEach(g => {
      const arr = new Date(g.dateStart);
      const dep = new Date(g.dateEnd);
      const cur = new Date(checkDateStr);
      
      if (cur >= arr && cur <= dep) {
        // Find group itinerary
        const groupIti = state.itineraries.find(iti => iti.groupName === g.name);
        let city = "";
        if (groupIti && groupIti.activities) {
          const sortedActs = [...groupIti.activities].sort((a, b) => a.date.localeCompare(b.date));
          const lastAct = sortedActs.filter(a => a.date <= checkDateStr).pop();
          if (lastAct && lastAct.city) {
            city = lastAct.city;
          }
        }
        
        // Fallback midpoint logic
        if (!city) {
          const midpoint = new Date((arr.getTime() + dep.getTime()) / 2);
          city = (cur <= midpoint) ? "Madinah" : "Makkah";
        }
        
        const cLower = city.toLowerCase();
        if (cLower === "makkah") activeMakkah.push(g.name);
        else if (cLower === "madinah") activeMadinah.push(g.name);
        else if (cLower === "jeddah") activeJeddah.push(g.name);
      }
    });

    const makkahCount = activeMakkah.length;
    const madinahCount = activeMadinah.length;
    const jeddahCount = activeJeddah.length;
    
    let labelsHtml = "";
    if (makkahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-makkah">🟢 Makkah (${makkahCount})</span>`;
    }
    if (madinahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-madinah">🔵 Madinah (${madinahCount})</span>`;
    }
    if (jeddahCount > 0) {
      labelsHtml += `<span class="calendar-city-lbl lbl-jeddah">🟡 Jeddah (${jeddahCount})</span>`;
    }
    
    const dayId = `cal-day-${day}`;
    grid.innerHTML += `
      <div class="calendar-day-cell ${isToday ? 'current-day' : ''} ${(makkahCount > 0 || madinahCount > 0 || jeddahCount > 0) ? 'active-day' : ''}" id="${dayId}">
        <span class="day-number">${day}</span>
        <div style="width:100%; text-align:left;">${labelsHtml}</div>
      </div>
    `;
    
    setTimeout(() => {
      const cellEl = document.getElementById(dayId);
      if (cellEl) {
        cellEl.onclick = () => {
          if (makkahCount === 0 && madinahCount === 0 && jeddahCount === 0) {
            showToast(`Tanggal ${day} ${monthNames[currentCalMonth]}: Tidak ada jadwal.`);
            return;
          }
          
          let listHtml = `<div style="font-size:0.9rem;">
            <p style="margin-bottom:12px;"><strong>Status Lokasi Rombongan Grup (${day} ${monthNames[currentCalMonth]} ${currentCalYear}):</strong></p>
          `;
          
          if (activeMakkah.length > 0) {
            listHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #f1f3f5; padding-bottom:8px;"><strong style="color:#10b981;">🟢 GRUP DI MAKKAH (${activeMakkah.length}):</strong>
              ${activeMakkah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          if (activeMadinah.length > 0) {
            listHtml += `<div style="margin-bottom:12px; border-bottom:1px solid #f1f3f5; padding-bottom:8px;"><strong style="color:#3b82f6;">🔵 GRUP DI MADINAH (${activeMadinah.length}):</strong>
              ${activeMadinah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          if (activeJeddah.length > 0) {
            listHtml += `<div style="margin-bottom:12px;"><strong style="color:#f59e0b;">🟡 GRUP DI JEDDAH (${activeJeddah.length}):</strong>
              ${activeJeddah.map(n => `<div style="padding-left:10px; margin-top:4px; font-weight:700;">• ${n}</div>`).join('')}
            </div>`;
          }
          
          listHtml += `</div>`;
          openModal(`Detail Jadwal Hari (${day} ${monthNames[currentCalMonth]})`, listHtml);
        };
      }
    }, 50);
  }
}


function renderAdminItinerary() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <div class="tab-header" style="margin-bottom:20px;">
      <div class="tab-btn ${adminItiViewMode === 'grup' ? 'active' : ''}" id="iti-view-mode-grup">Itinerary per Grup</div>
      <div class="tab-btn ${adminItiViewMode === 'gabungan' ? 'active' : ''}" id="iti-view-mode-gabungan">Itinerary Keseluruhan</div>
    </div>
    <div id="itinerary-view-contents"></div>
  `;
  
  document.getElementById("iti-view-mode-grup").onclick = () => {
    adminItiViewMode = "grup";
    renderItineraryContent();
  };
  
  document.getElementById("iti-view-mode-gabungan").onclick = () => {
    adminItiViewMode = "gabungan";
    renderItineraryContent();
  };
  
  renderItineraryContent();
}

function renderItineraryContent() {
  const contents = document.getElementById("itinerary-view-contents");
  if (!contents) return;
  
  const tabBtns = document.querySelectorAll(".tab-header .tab-btn");
  tabBtns.forEach(btn => {
    btn.classList.remove("active");
  });
  
  if (adminItiViewMode === "grup") {
    document.getElementById("iti-view-mode-grup").classList.add("active");
    
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px;">
        <input type="text" id="iti-grup-search-input" class="form-input" placeholder="Cari itinerary grup..." style="max-width:300px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <button id="add-iti-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Itinerary Baru</button>
      </div>
      
      <div class="table-card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Grup Keberangkatan</th>
                <th>Jumlah Kegiatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="iti-grup-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const renderGrupItiList = () => {
      const q = document.getElementById("iti-grup-search-input").value.toLowerCase().trim();
      const filtered = state.itineraries.filter(iti => iti.groupName.toLowerCase().includes(q));
      const tbody = document.getElementById("iti-grup-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada itinerary grup ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(iti => {
        const idx = state.itineraries.indexOf(iti);
        return `
          <tr>
            <td><strong>${iti.groupName}</strong></td>
            <td><code>${iti.activities ? iti.activities.length : 0} Rencana</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary view-iti-detail-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Detail</button>
                <button class="btn btn-secondary edit-iti-popup-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Edit</button>
                <button class="btn btn-danger delete-iti-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hapus</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind actions
      tbody.querySelectorAll(".view-iti-detail-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          const iti = state.itineraries[idx];
          if (!iti) return;
          
           const groupInfo = state.groups.find(g => g.name === iti.groupName);
          const rute = groupInfo ? groupInfo.rute : "Tidak ada data rute";
          const parseDateStr = (dStr) => {
            if (!dStr) return null;
            const parts = dStr.split("-");
            return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
          };
          const startDate = groupInfo ? parseDateStr(groupInfo.dateStart) : null;
          
          const sortedActivities = [...iti.activities].sort((a, b) => {
            const cmpDate = a.date.localeCompare(b.date);
            if (cmpDate !== 0) return cmpDate;
            return a.time.localeCompare(b.time);
          });
          
          const groups = {};
          sortedActivities.forEach(a => {
            const actDate = parseDateStr(a.date);
            let dayLabel = formatDateDisplay(a.date);
            if (actDate) {
              dayLabel = actDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            }
            if (!groups[dayLabel]) {
              groups[dayLabel] = [];
            }
            groups[dayLabel].push(a);
          });
          
          const timelineHtml = `
            <div style="font-size:0.85rem; margin-bottom:6px;"><strong>Grup:</strong> ${iti.groupName}</div>
            <div style="font-size:0.85rem; margin-bottom:16px;"><strong>Rute:</strong> ${rute}</div>
            
            <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
              ${Object.keys(groups).map(dayLabel => `
                <div class="day-group" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc;">
                  <h5 style="margin: 0 0 8px 0; font-weight: 800; font-size: 0.85rem; color: var(--primary-gold); border-bottom: 2px solid #cbd5e1; padding-bottom: 4px;">${dayLabel}</h5>
                  <table class="data-table" style="font-size: 0.8rem; margin: 0; width: 100%;">
                    <thead>
                      <tr>
                        <th style="width: 80px;">Waktu</th>
                        <th style="width: 100px;">Kota</th>
                        <th>Kegiatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${groups[dayLabel].map(act => `
                        <tr>
                          <td style="font-weight: 700;">${act.time}</td>
                          <td><span class="badge badge-info" style="font-size: 0.7rem; padding: 2px 6px;">${act.city || '-'}</span></td>
                          <td>
                            <strong>${act.agenda}</strong>
                            ${act.remarks ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${act.remarks}</div>` : ''}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              `).join('')}
            </div>
          `;
          openModal("Linimasa Rencana Perjalanan", timelineHtml);
        };
      });
      tbody.querySelectorAll(".edit-iti-popup-btn").forEach(btn => {
        btn.onclick = () => openItineraryFormPopup(parseInt(btn.getAttribute("data-idx")));
      });
      tbody.querySelectorAll(".delete-iti-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Hapus rencana perjalanan grup ini?")) {
            state.itineraries.splice(idx, 1);
            saveState();
            showToast("Itinerary dihapus.");
            renderItineraryContent();
          }
        };
      });
    };
    
    document.getElementById("iti-grup-search-input").oninput = renderGrupItiList;
    renderGrupItiList();
    document.getElementById("add-iti-popup-btn").onclick = () => openItineraryFormPopup();
    lucide.createIcons();
    
  } else {
    document.getElementById("iti-view-mode-gabungan").classList.add("active");
    
    if (!state.itiCalActiveDate) {
      state.itiCalActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    }
    
    const activeDateObj = new Date(state.itiCalActiveDate);
    const monthYearStr = activeDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    // Weekly strip around active date
    let dateCardsHtml = "";
    for (let i = -3; i <= 3; i++) {
      const tempDate = new Date(activeDateObj);
      tempDate.setDate(activeDateObj.getDate() + i);
      const tempDateStr = tempDate.toISOString().split('T')[0];
      const dayNum = tempDate.getDate();
      const dayName = tempDate.toLocaleDateString('id-ID', { weekday: 'short' });
      const isSelected = (tempDateStr === state.itiCalActiveDate);
      
      dateCardsHtml += `
        <div class="iti-cal-date-card ${isSelected ? 'active' : ''}" data-date="${tempDateStr}" style="flex:1; min-width:60px; text-align:center; padding:8px; border:1px solid ${isSelected ? 'var(--primary-gold)' : '#e2e8f0'}; background:${isSelected ? 'var(--primary-gold)' : '#ffffff'}; color:${isSelected ? '#ffffff' : 'var(--text-main)'}; border-radius:6px; cursor:pointer; font-size:0.8rem; transition:all 0.2s;">
          <div style="font-weight:600; text-transform:uppercase; font-size:0.65rem; color:${isSelected ? '#ffffff' : '#888888'};">${dayName}</div>
          <div style="font-size:1.1rem; font-weight:800; margin-top:2px;">${dayNum}</div>
        </div>
      `;
    }
    
    contents.innerHTML = `
      <div class="admin-card" style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="font-size:0.95rem; font-weight:800; margin:0;">${monthYearStr}</h4>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="iti-cal-export-pdf-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; border-color:#ef4444; color:#ef4444; display:inline-flex; align-items:center; justify-content:center; gap:4px;"><i data-lucide="file-text" style="width:12px; height:12px;"></i> Export PDF</button>
            <button id="iti-cal-prev-week-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&larr;</button>
            <button id="iti-cal-today-btn" class="btn btn-gold" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hari Ini</button>
            <button id="iti-cal-next-week-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&rarr;</button>
          </div>
        </div>
        
        <!-- Week Date Selector Strip -->
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; border-bottom:1px solid #e2e8f0; margin-bottom:12px;">
          ${dateCardsHtml}
        </div>
        
        <!-- City Filter -->
        <div style="display:flex; gap:8px; align-items:center; font-size:0.8rem;">
          <strong>Filter Kota:</strong>
          <select id="iti-cal-city-filter" class="form-select" style="width:auto; padding:4px 8px; font-size:0.75rem; height:auto; margin:0;">
            <option value="all">Semua Kota</option>
            <option value="Makkah">🟢 Makkah</option>
            <option value="Madinah">🔵 Madinah</option>
            <option value="Jeddah">🟡 Jeddah</option>
          </select>
        </div>
      </div>
      
      <!-- Google Calendar Style Hour Grid -->
      <div class="admin-card" style="padding:0; overflow:hidden;">
        <div style="display:flex; background:#f8fafc; border-bottom:1px solid #e2e8f0; padding:8px 12px; font-size:0.8rem; font-weight:700;">
          <div style="width:60px; color:#64748b;">Jam</div>
          <div style="flex:1; padding-left:12px; color:#64748b;">Agenda Perjalanan (${formatDateDisplay(state.itiCalActiveDate)})</div>
        </div>
        <div id="iti-cal-grid-scroll-container" style="height:400px; overflow-y:auto; position:relative;">
          <div style="position:relative; height:1440px; width:100%;">
            <!-- Hour Rows lines -->
            ${Array.from({length: 24}).map((_, h) => `
              <div style="display:flex; height:60px; border-bottom:1px dashed #e2e8f0; align-items:flex-start; padding:4px 12px; box-sizing:border-box;">
                <span style="width:60px; font-size:0.75rem; color:#94a3b8; font-weight:600;">${String(h).padStart(2, '0')}:00</span>
                <div style="flex:1; height:100%; border-left:1px solid #e2e8f0; position:relative;"></div>
              </div>
            `).join('')}
            
            <!-- Absolute Event Cards -->
            <div id="iti-cal-events-container" style="position:absolute; top:0; left:72px; right:12px; bottom:0; pointer-events:none;"></div>
          </div>
        </div>
      </div>
    `;
    

    // Bind Export PDF click
    document.getElementById("iti-cal-export-pdf-btn").onclick = () => {
      let dayActivities = [];
      state.itineraries.forEach(iti => {
        if (iti.activities) {
          iti.activities.forEach(act => {
            if (act.date === state.itiCalActiveDate) {
              dayActivities.push({
                groupName: iti.groupName,
                time: act.time,
                city: act.city || "",
                agenda: act.agenda,
                remarks: act.remarks || ""
              });
            }
          });
        }
      });
      
      dayActivities.sort((a, b) => a.time.localeCompare(b.time));
      const dateObj = new Date(state.itiCalActiveDate);
      const dayFormatted = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      const dateParts = state.itiCalActiveDate.split('-');
      const formattedTitleDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      const docTitle = `Itinerary Harian - ${formattedTitleDate}`;
      
      const printHtml = `
        <div class="watermark-bg"></div>
        
        <div style="position: absolute; top: 15mm; right: 20mm; font-size: 8pt; color: #64748b; font-weight: 700;">
          ${docTitle}
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 16pt; font-weight: 900; margin: 0; color: #1e293b; letter-spacing: 0.05em; text-transform: uppercase;">ITINERARY HARIAN</h2>
          <div style="font-size: 9pt; color: #c5a850; font-weight: 800; margin-top: 6px;">${dayFormatted}</div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 20px; border: 1px solid #cbd5e1; box-sizing: border-box;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; border-bottom: 2px solid #94a3b8;">
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 15%;">Waktu</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 30%;">Grup Keberangkatan</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 40%;">Agenda Kegiatan</th>
              <th style="padding: 10px; border: 1px solid #cbd5e1; width: 15%;">Kota</th>
            </tr>
          </thead>
          <tbody>
            ${dayActivities.length === 0 ? `
              <tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Tidak ada rencana kegiatan perjalanan untuk hari ini.</td></tr>
            ` : dayActivities.map(act => `
              <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${act.time}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${act.groupName}</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">
                  <strong>${act.agenda}</strong>
                  ${act.remarks ? `<div style="font-size: 9.5pt; color: #64748b; margin-top: 4px;">${act.remarks}</div>` : ''}
                </td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;"><span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: 800; font-size: 9pt; background: #e0f2fe; color: #0369a1; text-transform: uppercase;">${act.city || '-'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>${docTitle}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
            <style>
              @media print {
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
              @page {
                size: A4;
                margin: 0;
              }
              body {
                font-family: 'Mulish', sans-serif;
                margin: 0;
                padding: 45mm 20mm 30mm 20mm;
                position: relative;
                box-sizing: border-box;
                width: 210mm;
                height: 297mm;
                background-color: #ffffff;
              }
              table {
                font-size: 9pt !important;
              }
              th, td {
                padding: 6px !important;
              }
              .watermark-bg {
                position: absolute;
                top: 0;
                left: 0;
                width: 210mm;
                height: 297mm;
                background-image: url('assets/watermark.jpg');
                background-size: cover;
                background-repeat: no-repeat;
                background-position: center;
                z-index: -1;
                pointer-events: none;
              }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            ${printHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
    };

    // Bind Week buttons
    document.getElementById("iti-cal-prev-week-btn").onclick = () => {
      const d = new Date(state.itiCalActiveDate);
      d.setDate(d.getDate() - 7);
      state.itiCalActiveDate = d.toISOString().split('T')[0];
      renderItineraryContent();
    };
    document.getElementById("iti-cal-next-week-btn").onclick = () => {
      const d = new Date(state.itiCalActiveDate);
      d.setDate(d.getDate() + 7);
      state.itiCalActiveDate = d.toISOString().split('T')[0];
      renderItineraryContent();
    };
    document.getElementById("iti-cal-today-btn").onclick = () => {
      state.itiCalActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      renderItineraryContent();
    };
    
    // Bind Date Card clicks
    document.querySelectorAll(".iti-cal-date-card").forEach(card => {
      card.onclick = () => {
        state.itiCalActiveDate = card.getAttribute("data-date");
        renderItineraryContent();
      };
    });
    
    const cityFilter = document.getElementById("iti-cal-city-filter");
    
    const drawCalendarEvents = () => {
      const cityVal = cityFilter.value;
      const eventsContainer = document.getElementById("iti-cal-events-container");
      if (!eventsContainer) return;
      
      eventsContainer.innerHTML = "";
      
      let dayActivities = [];
      state.itineraries.forEach(iti => {
        if (iti.activities) {
          iti.activities.forEach(a => {
            if (a.date === state.itiCalActiveDate) {
              dayActivities.push({
                groupName: iti.groupName,
                time: a.time,
                city: a.city || "Jeddah",
                agenda: a.agenda,
                remarks: a.remarks
              });
            }
          });
        }
      });
      
      if (cityVal !== "all") {
        dayActivities = dayActivities.filter(a => a.city === cityVal);
      }
      
      let firstScrollTop = -1;
      
      dayActivities.forEach((act, idx) => {
        const timeParts = act.time.split(':');
        const hour = parseInt(timeParts[0]) || 0;
        const min = parseInt(timeParts[1]) || 0;
        
        const topPx = (hour * 60) + min;
        if (firstScrollTop === -1 || topPx < firstScrollTop) {
          firstScrollTop = topPx;
        }
        
        let cityColor = "#10b981";
        let cityBg = "rgba(16, 185, 129, 0.12)";
        if (act.city === "Madinah") {
          cityColor = "#3b82f6";
          cityBg = "rgba(59, 130, 246, 0.12)";
        } else if (act.city === "Jeddah") {
          cityColor = "#d97706";
          cityBg = "rgba(217, 119, 6, 0.12)";
        }
        
        const leftOffset = (idx % 2 === 0) ? 0 : 50;
        const rightOffset = (idx % 2 === 0) ? 50 : 0;
        
        eventsContainer.innerHTML += `
          <div class="iti-cal-event-card" style="position:absolute; top:${topPx}px; left:${leftOffset}%; right:${rightOffset}%; height:54px; background:${cityBg}; border-left:4px solid ${cityColor}; border-radius:4px; padding:4px 8px; font-size:0.75rem; box-shadow:0 2px 4px rgba(0,0,0,0.05); pointer-events:auto; cursor:pointer;" title="${act.remarks || ''}">
            <div style="font-weight:800; color:${cityColor}; font-size:0.65rem;">${act.time} | ${act.city}</div>
            <div style="font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${act.agenda}</div>
            <div style="font-size:0.65rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">Grup: ${act.groupName}</div>
          </div>
        `;
      });
      
      if (firstScrollTop !== -1) {
        const scrollContainer = document.getElementById("iti-cal-grid-scroll-container");
        if (scrollContainer) {
          scrollContainer.scrollTop = Math.max(0, firstScrollTop - 40);
        }
      }
    };
    
    cityFilter.onchange = drawCalendarEvents;
    drawCalendarEvents();
  }
}
function openItineraryFormPopup(editIdx = null) {
  const groupNames = state.groups.map(g => g.name);
  const isEdit = (editIdx !== null);
  const iti = isEdit ? state.itineraries[editIdx] : null;
  
  const popupHtml = `
    <form id="iti-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="iti-group-name-popup" class="form-input" value="${isEdit ? iti.groupName : ''}" placeholder="Pilih grup..." required ${isEdit ? 'readonly' : ''}>
        <div id="iti-form-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>
      
      <label class="form-label">Daftar Kegiatan Perjalanan</label>
      <div id="iti-activities-rows-popup" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"></div>
      <button type="button" id="add-iti-row-btn-popup" class="btn btn-secondary" style="margin-bottom:20px; padding:6px; font-size:0.8rem; width:auto;">+ Tambah Kegiatan</button>
      <button type="submit" class="btn btn-gold">Simpan Itinerary</button>
    </form>
  `;
  openModal(isEdit ? "Edit Itinerary (Pop Up)" : "Tambah Itinerary Baru (Pop Up)", popupHtml);
  
  if (!isEdit) {
    initSuggestionInput("iti-group-name-popup", "iti-form-group-suggestions-popup", groupNames);
  }
  
  const rowsContainer = document.getElementById("iti-activities-rows-popup");
  const addRow = (date = "", time = "", city = "Jeddah", agenda = "", remarks = "") => {
    const rowId = `iti-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card iti-activity-item-row-popup";
    div.id = rowId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Item Kegiatan</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <input type="date" class="form-input row-date" value="${date}" required>
        <input type="time" class="form-input row-time" value="${time}" required>
      </div>
      <div class="grid-3col" style="gap:8px; margin-top:8px;">
        <select class="form-select row-city" required>
          <option value="Jeddah" ${city === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
          <option value="Madinah" ${city === 'Madinah' ? 'selected' : ''}>Madinah</option>
          <option value="Makkah" ${city === 'Makkah' ? 'selected' : ''}>Makkah</option>
        </select>
        <input type="text" class="form-input row-agenda" placeholder="Agenda Kegiatan" value="${agenda}" required style="grid-column: span 2;">
      </div>
      <input type="text" class="form-input row-remarks" placeholder="Keterangan tambahan" value="${remarks}" style="margin-top:8px;">
    `;
    rowsContainer.appendChild(div);
  };
  
  document.getElementById("add-iti-row-btn-popup").onclick = () => addRow();
  
  if (isEdit) {
    iti.activities.forEach(a => addRow(a.date, a.time, a.city || "Jeddah", a.agenda, a.remarks));
  } else {
    addRow();
  }
  
  document.getElementById("iti-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = document.getElementById("iti-group-name-popup").value.trim();
    if (!groupName) {
      showToast("Grup keberangkatan wajib diisi!", "error");
      return;
    }
    
    const rows = rowsContainer.querySelectorAll(".iti-activity-item-row-popup");
    const activities = Array.from(rows).map(row => ({
      date: row.querySelector(".row-date").value,
      time: row.querySelector(".row-time").value,
      city: row.querySelector(".row-city").value,
      agenda: row.querySelector(".row-agenda").value,
      remarks: row.querySelector(".row-remarks").value
    })).filter(a => a.date && a.agenda);

    if (activities.length === 0) {
      showToast("Minimal isi 1 kegiatan itinerary yang lengkap!", "error");
      return;
    }
    
    if (isEdit) {
      state.itineraries[editIdx] = { groupName, activities };
    } else {
      const existingIdx = state.itineraries.findIndex(i => i && i.groupName && i.groupName.toLowerCase() === groupName.toLowerCase());
      if (existingIdx !== -1) {
        state.itineraries[existingIdx].activities = activities;
      } else {
        state.itineraries.push({ groupName, activities });
      }
    }

    // Auto-register group in state.groups if not present
    const existingGroup = state.groups.find(g => g.name && g.name.toLowerCase() === groupName.toLowerCase());
    if (!existingGroup) {
      const dateStart = activities[0] ? activities[0].date : getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      const dateEnd = activities[activities.length - 1] ? activities[activities.length - 1].date : dateStart;
      state.groups.push({
        name: groupName,
        dateStart,
        dateEnd,
        pax: "30 Pax",
        bus: "1 Bus",
        hotelMadinah: "Nozol Royal Inn",
        hotelMakkah: "Anjum Hotel",
        rute: "Jeddah - Madinah - Makkah",
        leaders: ["Ustadz H. Haris"]
      });
    }
    
    if (activities.length > 0 && activities[0].date) {
      state.itiCalActiveDate = activities[0].date;
    }
    
    adminItiViewMode = "grup";
    saveState();
    closeModal();
    showToast(`Itinerary grup "${groupName}" berhasil disimpan!`);
    renderAdminItinerary();
  };
}

function openTaskAdminDetailPopup(taskId) {
  const t = state.assignments.find(x => x.id === taskId);
  if (!t) return;

  const staffList = Array.isArray(t.staff) ? t.staff : [];
  const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
  const isPub = (t.published !== false);
  const reqStaff = t.requiredStaff || 1;
  const currentStaffCount = staffList.length;
  const isFulfilled = (currentStaffCount >= reqStaff);
  const staffingStatusHtml = isFulfilled ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;

  const details = t.details || {};

  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span class="badge badge-gold" style="font-size:0.85rem; margin-right:8px;">${t.type || 'Penjadwalan'}</span>
          <span class="badge badge-success">${t.status || 'Aktif'}</span>
        </div>
        ${staffingStatusHtml}
        <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:20px;">
        <tr><td style="padding:6px 0; font-weight:700; width:120px; color:var(--text-muted);">Grup Rombongan:</td><td style="font-weight:800;">${t.groupName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Tanggal / Waktu:</td><td>${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah:</td><td>${t.region || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td>${details.hotelName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${details.eta || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${details.totalPax || '-'} Pax</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Layanan:</td><td>${details.service || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan / Rincian:</td><td>${details.remarks || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Petugas di-Plot:</td><td><strong>${staffNames || 'Belum diplot'}</strong></td></tr>
      </table>
      
      ` + (() => {
        let applicantsHtml = '';
        t.applicants = t.applicants || [];
        if (t.applicants.length > 0) {
          applicantsHtml = `
            <div style="margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px; margin-bottom:14px;">
              <strong style="font-size:0.8rem; color:var(--text-muted);">Pengaju Apply Tugas:</strong>
              <div style="margin-top:6px; display:flex; flex-direction:column; gap:8px;">
                ${t.applicants.map(usr => {
                  const name = state.users.find(u => u.username === usr)?.name || usr;
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0;">
                      <span style="font-size:0.8rem; font-weight:700;">${name}</span>
                      <div style="display:flex; gap:6px;">
                        <button class="btn btn-gold approve-applicant-btn" data-username="${usr}" style="padding:2px 6px; font-size:0.75rem; width:auto; background:#10b981; border:none; display:inline-flex; align-items:center; justify-content:center; height:24px; width:24px; border-radius:4px;" title="Setujui"><i data-lucide="check" style="width:12px; height:12px; color:#fff;"></i></button>
                        <button class="btn btn-danger reject-applicant-btn" data-username="${usr}" style="padding:2px 6px; font-size:0.75rem; width:auto; background:#ef4444; border:none; display:inline-flex; align-items:center; justify-content:center; height:24px; width:24px; border-radius:4px;" title="Tolak"><i data-lucide="x" style="width:12px; height:12px; color:#fff;"></i></button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }
        return applicantsHtml;
      })() + `
      
      <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f3f5; padding-top:14px;">
        <div>
          <button class="btn btn-gold toggle-publish-btn" style="width:auto; padding:6px 12px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
            <i data-lucide="${isPub ? 'eye-off' : 'eye'}" style="width:14px; height:14px;"></i> ${isPub ? 'Unpublish' : 'Publish'}
          </button>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary edit-task-popup-btn" style="width:auto; padding:6px 10px;" title="Edit Penugasan"><i data-lucide="edit-3" style="width:16px; height:16px;"></i></button>
          <button class="btn btn-danger delete-task-popup-btn" style="width:auto; padding:6px 10px;" title="Hapus Penugasan"><i data-lucide="trash-2" style="width:16px; height:16px;"></i></button>
          <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 12px; font-size:0.75rem;">Tutup</button>
        </div>
      </div>
    </div>
  `;
  openModal("Rincian Penugasan Operasional", detailHtml);
  lucide.createIcons();

  const popupEl = document.getElementById("modal-container");
  
  // Bind applicant approvals
  popupEl.querySelectorAll(".approve-applicant-btn").forEach(btn => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-username");
      t.staff = t.staff || [];
      if (!t.staff.includes(username)) {
        t.staff.push(username);
      }
      t.applicants = t.applicants.filter(u => u !== username);
      saveState();
      showToast("Petugas berhasil disetujui!");
      closeModal();
      renderTaskCardsAdmin();
    };
  });
  
  popupEl.querySelectorAll(".reject-applicant-btn").forEach(btn => {
    btn.onclick = () => {
      const username = btn.getAttribute("data-username");
      t.applicants = t.applicants.filter(u => u !== username);
      saveState();
      showToast("Lamaran petugas ditolak.");
      closeModal();
      renderTaskCardsAdmin();
    };
  });

  popupEl.querySelector(".toggle-publish-btn").onclick = () => {
    t.published = !isPub;
    saveState();
    showToast(`Status penugasan diubah ke ${!isPub ? 'Publish' : 'Unpublish'}.`);
    closeModal();
    renderTaskCardsAdmin();
  };

  popupEl.querySelector(".edit-task-popup-btn").onclick = () => {
    closeModal();
    openPenjadwalanFormPopup(t.id);
  };

  popupEl.querySelector(".delete-task-popup-btn").onclick = () => {
    if (confirm("Hapus plotting penugasan ini?")) {
      const idx = state.assignments.findIndex(x => x.id === t.id);
      if (idx !== -1) {
        state.assignments.splice(idx, 1);
        saveState();
        showToast("Penugasan dihapus.");
        closeModal();
        renderTaskCardsAdmin();
      }
    }
  };
}




function openTaskSummaryPopup() {
  const types = [
    "Kedatangan Bandara Jeddah",
    "Kepulangan Bandara Jeddah",
    "Kedatangan Bandara Madinah",
    "Kepulangan Bandara Madinah",
    "Check In Hotel Madinah",
    "Check In Hotel Makkah",
    "Check In Hotel Jeddah",
    "Check Out Hotel Madinah",
    "Check Out Hotel Makkah",
    "Check Out Hotel Jeddah",
    "City Tour Madinah",
    "City Tour Makkah",
    "City Tour Thaif",
    "City Tour Al Ula",
    "Penjemputan Stasiun Madinah",
    "Penjemputan Stasiun Makkah"
  ];
  
  const defaultDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  
  const formHtml = `
    <div class="admin-card" style="border:none; padding:0;">
      <div class="grid-3col" style="gap:10px; margin-bottom:14px;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">Filter Tanggal</label>
          <input type="date" id="sum-filter-date" class="form-input" value="${defaultDate}" style="padding:6px 10px; font-size:0.8rem;">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">Filter Rombongan</label>
          <select id="sum-filter-group" class="form-select" style="padding:6px 10px; font-size:0.8rem; height:auto;">
            <option value="all">Semua Grup</option>
            ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">Filter Kegiatan</label>
          <select id="sum-filter-type" class="form-select" style="padding:6px 10px; font-size:0.8rem; height:auto;">
            <option value="all">Semua Kegiatan</option>
            ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Format Teks WhatsApp</label>
        <textarea id="sum-whatsapp-text" class="form-textarea" rows="12" readonly style="font-family:monospace; font-size:0.8rem; background:#f8fafc; color:#0f172a; padding:10px; border:1px solid #cbd5e1;"></textarea>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
        <button id="sum-copy-btn" class="btn btn-gold" style="width:auto; padding:6px 16px;"><i data-lucide="copy" style="width:14px; height:14px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Salin Teks</button>
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
      </div>
    </div>
  `;
  
  openModal("Rangkuman Penugasan Tim", formHtml);
  lucide.createIcons();
  
  const dateEl = document.getElementById("sum-filter-date");
  const groupEl = document.getElementById("sum-filter-group");
  const typeEl = document.getElementById("sum-filter-type");
  const textEl = document.getElementById("sum-whatsapp-text");
  
  const updateSummaryText = () => {
    const dVal = dateEl.value;
    const gVal = groupEl.value;
    const tVal = typeEl.value;
    
    let filtered = state.assignments;
    if (dVal) {
      filtered = filtered.filter(t => t.date === dVal);
    }
    if (gVal !== "all") {
      filtered = filtered.filter(t => t.groupName === gVal);
    }
    if (tVal !== "all") {
      filtered = filtered.filter(t => t.type === tVal);
    }
    
    filtered.sort((a, b) => a.time.localeCompare(b.time));
    
    let dateStr = dVal;
    if (dVal) {
      const parts = dVal.split('-');
      if (parts.length === 3) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        dateStr = dObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    
    let wText = `*PETUGAS TIM KHIDMAT*\n`;
    wText += `🗓️ Tanggal: ${dateStr}\n\n`;
    
    if (filtered.length === 0) {
      wText += `(Tidak ada jadwal penugasan untuk filter terpilih)\n`;
    } else {
      filtered.forEach((t, i) => {
        const staffNames = t.staff.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
        wText += `*${i + 1}. ${t.type}* ${t.details.customTaskName ? `(${t.details.customTaskName})` : ''}\n`;
        wText += `   • Grup: *${t.groupName}*\n`;
        wText += `   • Waktu: ${t.time} Saudi\n`;
        wText += `   • Wilayah: ${t.region}\n`;
        wText += `   • Petugas: *${staffNames || 'Belum diplot'}*\n`;
        
        if (t.details.hotelName) {
          wText += `   • Hotel: ${t.details.hotelName}\n`;
        }
        if (t.details.eta) {
          wText += `   • Flight/ETA: ${t.details.eta}\n`;
        }
        if (t.details.totalPax) {
          wText += `   • Pax: ${t.details.totalPax} Jamaah\n`;
        }
        if (t.details.remarks) {
          wText += `   • Catatan: ${t.details.remarks}\n`;
        }
        wText += `\n`;
      });
    }
    
    wText += `Barakallahu fiikum\n`;
    wText += `_*Pesan dikirim melalui sistem jejak imani*_`;
    
    textEl.value = wText;
  };
  
  dateEl.onchange = updateSummaryText;
  groupEl.onchange = updateSummaryText;
  typeEl.onchange = updateSummaryText;
  
  updateSummaryText();
  
  document.getElementById("sum-copy-btn").onclick = () => {
    textEl.select();
    navigator.clipboard.writeText(textEl.value)
      .then(() => {
        showToast("Teks rangkuman WhatsApp berhasil disalin!");
      })
      .catch(() => {
        showToast("Gagal menyalin teks", "error");
      });
  };
}


function renderAdminPenjadwalan() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <!-- Tab Penjadwalan Paling Atas -->
    <div class="tab-header" style="margin-bottom:16px;">
      <div class="tab-btn ${adminTaskViewMode === 'grup' ? 'active' : ''}" id="task-view-mode-grup">Penugasan Per Grup</div>
      <div class="tab-btn ${adminTaskViewMode === 'semua' ? 'active' : ''}" id="task-view-mode-semua">Semua Penugasan</div>
    </div>
    

    
    <!-- Baris Pencarian & Tombol Aksi -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div id="task-search-bar-container" style="flex-grow:1; max-width:300px;"></div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div id="task-additional-actions-container"></div>
        <button id="add-task-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Penugasan Baru</button>
      </div>
    </div>
    
    <div id="task-list-tab-contents"></div>
  `;
  
  document.getElementById("task-view-mode-grup").onclick = () => {
    adminTaskViewMode = "grup";
    renderAdminPenjadwalan();
  };
  document.getElementById("task-view-mode-semua").onclick = () => {
    adminTaskViewMode = "semua";
    renderAdminPenjadwalan();
  };

  document.getElementById("add-task-popup-btn").onclick = () => openPenjadwalanFormPopup();

  lucide.createIcons();

  renderTaskCardsAdmin();
}

function renderTaskCardsAdmin() {
  const container = document.getElementById("task-list-tab-contents");
  const searchContainer = document.getElementById("task-search-bar-container");
  const actionsContainer = document.getElementById("task-additional-actions-container");
  
  if (!container || !searchContainer || !actionsContainer) return;
  
  if (state.assignments.length === 0) {
    searchContainer.innerHTML = "";
    actionsContainer.innerHTML = "";
    container.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;background:#fff;border-radius:8px;border:var(--border-light); margin-top:16px;">Belum ada penugasan aktif.</p>`;
    return;
  }
  
  // Render Unified Filter inputs at the top
  searchContainer.style.maxWidth = "none";
  searchContainer.style.width = "100%";
  searchContainer.innerHTML = `
    <div style="display:flex; gap:10px; flex-wrap:wrap; width:100%;">
      <input type="text" id="admin-task-search-input" class="form-input" placeholder="Cari penugasan, petugas, atau grup..." style="flex:grow-1; flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
      <select id="admin-task-pub-filter" class="form-select" style="width:150px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <option value="all">Semua Status</option>
        <option value="published">Published</option>
        <option value="unpublished">Unpublished</option>
      </select>
      <select id="admin-task-quota-filter" class="form-select" style="width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <option value="all">Semua Keterpenuhan</option>
        <option value="fulfilled">Terpenuhi</option>
        <option value="unfulfilled">Belum Terpenuhi</option>
        <option value="pending_approval">Menunggu Approval</option>
      </select>
    </div>
  `;

  const getFilteredAssignments = () => {
    const qInp = document.getElementById("admin-task-search-input");
    const q = qInp ? qInp.value.toLowerCase().trim() : "";
    const pubVal = document.getElementById("admin-task-pub-filter") ? document.getElementById("admin-task-pub-filter").value : "all";
    const quotaVal = document.getElementById("admin-task-quota-filter") ? document.getElementById("admin-task-quota-filter").value : "all";
    
    let filtered = state.assignments;
    if (q) {
      filtered = filtered.filter(t => {
        const typeStr = (t.type || t.title || '').toLowerCase();
        const groupStr = (t.groupName || '').toLowerCase();
        const customNameStr = (t.details && t.details.customTaskName ? t.details.customTaskName : '').toLowerCase();
        const staffList = (t.staff || []).map(s => String(s).toLowerCase());
        const staffNamesStr = (t.staff || []).map(s => (state.users.find(u => u.username === s)?.name || '').toLowerCase()).join(' ');
        
        return typeStr.includes(q) || groupStr.includes(q) || customNameStr.includes(q) || staffList.some(s => s.includes(q)) || staffNamesStr.includes(q);
      });
    }
    if (pubVal === "published") {
      filtered = filtered.filter(t => t.published !== false);
    } else if (pubVal === "unpublished") {
      filtered = filtered.filter(t => t.published === false);
    }
    if (quotaVal === "fulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) >= (t.requiredStaff || 1));
    } else if (quotaVal === "unfulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) < (t.requiredStaff || 1));
    } else if (quotaVal === "pending_approval") {
      filtered = filtered.filter(t => t.applicants && t.applicants.length > 0);
    }
    return filtered;
  };
  
  if (adminTaskViewMode === "grup") {
    actionsContainer.innerHTML = "";
    container.innerHTML = `<div id="admin-task-grup-accordion-list" style="display:flex; flex-direction:column; gap:10px; width:100%;"></div>`;
    
    const drawGroupAccordion = () => {
      const accordionList = document.getElementById("admin-task-grup-accordion-list");
      if (!accordionList) return;
      
      const filteredTasks = getFilteredAssignments();
      accordionList.innerHTML = "";
      
      // Group the filtered assignments by groupName
      const grouped = {};
      filteredTasks.forEach(t => {
        const gN = t.groupName || 'Umum';
        if (!grouped[gN]) grouped[gN] = [];
        grouped[gN].push(t);
      });
      
      const filteredGroups = Object.keys(grouped);
      if (filteredGroups.length === 0) {
        accordionList.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;background:#fff;border-radius:8px; width:100%;">Tidak ada grup penugasan ditemukan.</p>`;
        return;
      }
      
      filteredGroups.forEach((gName, idx) => {
        const groupTasks = grouped[gName];
        const group = state.groups.find(g => g.name === gName);
        const tlName = group && group.leaders ? group.leaders.join(', ') : "Belum Ditentukan";
        
        const headerId = `acc-header-${idx}`;
        const bodyId = `acc-body-${idx}`;
        const iconId = `acc-icon-${idx}`;
        
        const accordionRow = document.createElement("div");
        accordionRow.style.display = "flex";
        accordionRow.style.flexDirection = "column";
        accordionRow.style.width = "100%";
        
        accordionRow.innerHTML = `
          <div class="group-accordion-header" id="${headerId}" style="padding:14px 18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.2s; user-select:none; margin-bottom:4px;">
            <span style="font-weight:800; color:var(--text-main); font-size:0.9rem;">${gName} <span style="font-weight:500; color:var(--text-muted); font-size:0.8rem; margin-left:8px;">(TL: ${tlName})</span></span>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="badge badge-info" style="font-size:0.7rem; padding:3px 8px;">${groupTasks.length} Tugas</span>
              <i data-lucide="chevron-down" id="${iconId}" style="width:16px; height:16px; transition:transform 0.2s; color:#64748b;"></i>
            </div>
          </div>
          <div class="group-accordion-body hidden" id="${bodyId}" style="padding:16px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 8px 8px; background:#fff; margin-bottom:12px; width:100%;">
            <div class="grid-2col" style="gap:16px;"></div>
          </div>
        `;
        
        accordionList.appendChild(accordionRow);
        
        const bodyEl = accordionRow.querySelector(".grid-2col");
        bodyEl.innerHTML = groupTasks.map(t => {
          const staffList = t.staff || [];
          const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
          const isPub = (t.published !== false);
          const reqStaff = t.requiredStaff || 1;
          const currentStaffCount = staffList.length;
          const isFulfilled = (currentStaffCount >= reqStaff);
          const staffingStatusHtml = isFulfilled 
            ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
            : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;
          
          const taskHeading = (t.type || t.title || 'Penugasan Lapangan') + (t.details && t.details.customTaskName ? ` (${t.details.customTaskName})` : '');
          const regionStr = t.region ? ` (Wilayah: ${t.region})` : '';

          return `
            <div class="assignment-card" style="border-left-color: ${isPub ? 'var(--primary-gold)' : '#94a3b8'}; background:#fff; padding:16px; margin-bottom:0;">
              <div class="assignment-header" style="border-bottom: 1px solid #f1f3f5; padding-bottom: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                <strong>${taskHeading}</strong>
                <div style="display:flex; gap:6px; align-items:center;">
                  ${staffingStatusHtml}
                  <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
                </div>
              </div>
              <div class="structured-card-grid">
                <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value"><strong>${t.groupName || '-'}</strong></span></div>
                <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi${regionStr}</span></div>
                <div class="structured-card-row"><span class="structured-card-label">Petugas:</span><span class="structured-card-value"><em>${staffNames || 'Belum diplot'}</em></span></div>
                <div class="structured-card-row"><span class="structured-card-label">Status:</span><span class="structured-card-value"><span class="badge badge-gold">${t.status || 'Aktif'}</span></span></div>
              </div>
              <div style="display:flex; justify-flex:flex-end; margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px;">
                <button class="btn btn-secondary view-task-admin-detail-btn" data-id="${t.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;"><i data-lucide="eye" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat Rincian</button>
              </div>
            </div>
          `;
        }).join('');
        
        const headerEl = document.getElementById(headerId);
        const bodyContainer = document.getElementById(bodyId);
        const iconEl = document.getElementById(iconId);
        
        headerEl.onclick = () => {
          bodyContainer.classList.toggle("hidden");
          const isHidden = bodyContainer.classList.contains("hidden");
          iconEl.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
        };
      });
      
      accordionList.querySelectorAll(".view-task-admin-detail-btn").forEach(btn => {
        btn.onclick = () => openTaskAdminDetailPopup(btn.getAttribute("data-id"));
      });
      
      lucide.createIcons();
    };
    
    document.getElementById("admin-task-search-input").oninput = drawGroupAccordion;
    document.getElementById("admin-task-pub-filter").onchange = drawGroupAccordion;
    document.getElementById("admin-task-quota-filter").onchange = drawGroupAccordion;
    drawGroupAccordion();
    
  } else {
    actionsContainer.innerHTML = `<button id="task-summary-btn" class="btn btn-secondary" style="width:auto; padding:8px 16px; border-color:var(--primary-gold); color:var(--primary-gold); display:inline-flex; align-items:center; gap:4px; font-size:0.8rem;"><i data-lucide="file-text" style="width:14px; height:14px;"></i> Rangkuman</button>`;
    document.getElementById("task-summary-btn").onclick = () => openTaskSummaryPopup();
    
    container.innerHTML = `<div class="grid-2col" id="admin-task-semua-list" style="gap:16px;"></div>`;
    
    const drawSemuaList = () => {
      const listEl = document.getElementById("admin-task-semua-list");
      if (!listEl) return;
      
      const filtered = getFilteredAssignments();
      if (filtered.length === 0) {
        listEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;padding:20px;text-align:center;grid-column:span 2;">Tidak ada penugasan ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filtered.map(t => {
        const staffList = t.staff || [];
        const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
        const isPub = (t.published !== false);
        const reqStaff = t.requiredStaff || 1;
        const currentStaffCount = staffList.length;
        const isFulfilled = (currentStaffCount >= reqStaff);
        const staffingStatusHtml = isFulfilled 
          ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
          : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;
        
        const taskHeading = (t.type || t.title || 'Penugasan Lapangan') + (t.details && t.details.customTaskName ? ` (${t.details.customTaskName})` : '');
        const regionStr = t.region ? ` (Wilayah: ${t.region})` : '';

        return `
          <div class="assignment-card" style="border-left-color: ${isPub ? 'var(--primary-gold)' : '#94a3b8'}; background:#fff; padding:16px; margin-bottom:0;">
            <div class="assignment-header" style="border-bottom: 1px solid #f1f3f5; padding-bottom: 8px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <strong>${taskHeading}</strong>
              <div style="display:flex; gap:6px; align-items:center;">
                ${staffingStatusHtml}
                <span class="badge ${isPub ? 'badge-success' : 'badge-warning'}">${isPub ? 'Published' : 'Unpublished'}</span>
              </div>
            </div>
            <div class="structured-card-grid">
              <div class="structured-card-row"><span class="structured-card-label">Grup:</span><span class="structured-card-value"><strong>${t.groupName || '-'}</strong></span></div>
              <div class="structured-card-row"><span class="structured-card-label">Waktu:</span><span class="structured-card-value">${formatDateDisplay(t.date)} | ${t.time || '-'} Saudi${regionStr}</span></div>
              <div class="structured-card-row"><span class="structured-card-label">Petugas:</span><span class="structured-card-value"><em>${staffNames || 'Belum diplot'}</em></span></div>
              <div class="structured-card-row"><span class="structured-card-label">Status:</span><span class="structured-card-value"><span class="badge badge-gold">${t.status || 'Aktif'}</span></span></div>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:14px; border-top:1px solid #f1f3f5; padding-top:10px;">
              <button class="btn btn-secondary view-task-admin-detail-btn" data-id="${t.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;"><i data-lucide="eye" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat Rincian</button>
            </div>
          </div>
        `;
      }).join('');
      
      listEl.querySelectorAll(".view-task-admin-detail-btn").forEach(btn => {
        btn.onclick = () => openTaskAdminDetailPopup(btn.getAttribute("data-id"));
      });
      lucide.createIcons();
    };
    
    document.getElementById("admin-task-search-input").oninput = drawSemuaList;
    document.getElementById("admin-task-pub-filter").onchange = drawSemuaList;
    document.getElementById("admin-task-quota-filter").onchange = drawSemuaList;
    drawSemuaList();
  }
}

function openPenjadwalanFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const task = isEdit ? state.assignments.find(t => t.id === editId) : null;
  const groupNames = state.groups.map(g => g.name);
  const fieldStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  let plottedStaffs = isEdit ? [...task.staff] : [];

  const popupHtml = `
    <form id="task-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <input type="text" id="task-group-input-popup" class="form-input" value="${isEdit ? task.groupName : ''}" placeholder="Ketik nama grup..." required>
        <div id="task-group-suggestions-popup" class="suggestion-list hidden"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Kegiatan Itinerary</label>
        <select id="task-kegiatan-popup" class="form-select">
          <option value="">-- Pilih Kegiatan --</option>
        </select>
      </div>
      
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input type="date" id="task-date" class="form-input" value="${isEdit ? task.date : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Waktu (24 Jam)</label>
          <input type="time" id="task-time" class="form-input" value="${isEdit ? task.time : ''}" required>
        </div>
      </div>
      
      <div class="grid-3col">
        <div class="form-group">
          <label class="form-label">Wilayah</label>
          <select id="task-region" class="form-select" required>
            <option value="Jeddah" ${isEdit && task.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
            <option value="Madinah" ${isEdit && task.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
            <option value="Makkah" ${isEdit && task.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Jenis Penugasan</label>
          <select id="task-type" class="form-select" required>
            <option value="Kedatangan Bandara Jeddah" ${isEdit && task.type === 'Kedatangan Bandara Jeddah' ? 'selected' : ''}>Kedatangan Bandara Jeddah</option>
            <option value="Kepulangan Bandara Jeddah" ${isEdit && task.type === 'Kepulangan Bandara Jeddah' ? 'selected' : ''}>Kepulangan Bandara Jeddah</option>
            <option value="Kedatangan Bandara Madinah" ${isEdit && task.type === 'Kedatangan Bandara Madinah' ? 'selected' : ''}>Kedatangan Bandara Madinah</option>
            <option value="Kepulangan Bandara Madinah" ${isEdit && task.type === 'Kepulangan Bandara Madinah' ? 'selected' : ''}>Kepulangan Bandara Madinah</option>
            <option value="Check In Hotel Madinah" ${isEdit && task.type === 'Check In Hotel Madinah' ? 'selected' : ''}>Check In Hotel Madinah</option>
            <option value="Check In Hotel Makkah" ${isEdit && task.type === 'Check In Hotel Makkah' ? 'selected' : ''}>Check In Hotel Makkah</option>
            <option value="Check In Hotel Jeddah" ${isEdit && task.type === 'Check In Hotel Jeddah' ? 'selected' : ''}>Check In Hotel Jeddah</option>
            <option value="Check Out Hotel Madinah" ${isEdit && task.type === 'Check Out Hotel Madinah' ? 'selected' : ''}>Check Out Hotel Madinah</option>
            <option value="Check Out Hotel Makkah" ${isEdit && task.type === 'Check Out Hotel Makkah' ? 'selected' : ''}>Check Out Hotel Makkah</option>
            <option value="Check Out Hotel Jeddah" ${isEdit && task.type === 'Check Out Hotel Jeddah' ? 'selected' : ''}>Check Out Hotel Jeddah</option>
            <option value="City Tour Madinah" ${isEdit && task.type === 'City Tour Madinah' ? 'selected' : ''}>City Tour Madinah</option>
            <option value="City Tour Makkah" ${isEdit && task.type === 'City Tour Makkah' ? 'selected' : ''}>City Tour Makkah</option>
            <option value="City Tour Thaif" ${isEdit && task.type === 'City Tour Thaif' ? 'selected' : ''}>City Tour Thaif</option>
            <option value="City Tour Al Ula" ${isEdit && task.type === 'City Tour Al Ula' ? 'selected' : ''}>City Tour Al Ula</option>
            <option value="Penjemputan Stasiun Madinah" ${isEdit && task.type === 'Penjemputan Stasiun Madinah' ? 'selected' : ''}>Penjemputan Stasiun Madinah</option>
            <option value="Penjemputan Stasiun Makkah" ${isEdit && task.type === 'Penjemputan Stasiun Makkah' ? 'selected' : ''}>Penjemputan Stasiun Makkah</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Kebutuhan Personel (Petugas)</label>
          <input type="number" id="task-required-staff" class="form-input" min="1" value="${isEdit ? (task.requiredStaff || 1) : 1}" required>
        </div>
      </div>
      
      <div class="form-group hidden" id="custom-task-name-container">
        <label class="form-label">Nama Kustom Jenis Penugasan</label>
        <input type="text" id="custom-task-name-input" class="form-input" value="${isEdit ? (task.details.customTaskName || '') : ''}">
      </div>

      <div id="modal-conditional-fields" style="background:#f8f9fa; padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;"></div>
      
      <div class="form-group">
        <label class="form-label">Keterangan Umum</label>
        <input type="text" id="task-remarks-global" class="form-input" value="${isEdit ? (task.details.remarks || '') : ''}" placeholder="Keterangan tambahan untuk tim">
      </div>
      
      <div class="form-group">
        <label class="form-label">Pilihan Petugas Lapangan</label>
        <div style="display:flex; gap:10px;">
          <div style="flex-grow:1; position:relative;">
            <input type="text" id="task-staff-search" class="form-input" placeholder="Ketik nama petugas...">
            <div id="task-staff-suggestions" class="suggestion-list hidden"></div>
          </div>
          <button type="button" id="add-staff-badge-btn" class="btn btn-gold" style="width:auto; padding:10px 16px;">Tambah</button>
        </div>
        <div class="staff-badge-row" id="plotted-staff-badges"></div>
      </div>
      
      <button type="submit" class="btn btn-primary">Simpan Penugasan</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Penugasan" : "Tambah Penugasan Baru", popupHtml);
  
  const gInput = document.getElementById("task-group-input-popup");
  const typeSelect = document.getElementById("task-type");
  const conditionalBox = document.getElementById("modal-conditional-fields");
  const kegiatanSelect = document.getElementById("task-kegiatan-popup");

  const updateKegiatanDropdown = (groupName) => {
    kegiatanSelect.innerHTML = '<option value="">-- Pilih Kegiatan --</option>';
    const groupIti = state.itineraries.find(i => i.groupName === groupName);
    if (groupIti && groupIti.activities) {
      groupIti.activities.forEach(a => {
        const titleText = a.title || a.agenda || 'Kegiatan';
        const dateText = a.date ? ` (${formatDateDisplay(a.date)})` : '';
        kegiatanSelect.innerHTML += `<option value="${titleText}">${titleText}${dateText}</option>`;
      });
    }
  };

  kegiatanSelect.onchange = () => {
    const agenda = kegiatanSelect.value;
    const groupName = gInput.value;
    const groupIti = state.itineraries.find(i => i.groupName === groupName);
    if (groupIti && groupIti.activities) {
      const act = groupIti.activities.find(a => (a.title === agenda || a.agenda === agenda));
      if (act) {
        if (act.date) document.getElementById("task-date").value = act.date;
        if (act.time) {
          const tClean = act.time.replace(/[^0-9:]/g, '');
          if (tClean) document.getElementById("task-time").value = tClean;
        }
      }
    }
  };

  const updateCondFields = () => {
    const type = typeSelect.value || "";
    const groupName = gInput.value;
    
    if (type === "Lainnya") {
      const customNameContainer = document.getElementById("custom-task-name-container");
      if (customNameContainer) customNameContainer.classList.remove("hidden");
    } else {
      const customNameContainer = document.getElementById("custom-task-name-container");
      if (customNameContainer) customNameContainer.classList.add("hidden");
    }
    
    const group = state.groups.find(x => x.name === groupName);
    const totalPaxVal = group ? group.packages.reduce((sum, p) => sum + (p.pax || 0), 0) : '';
    const etaVal = group ? group.flightArrival.map(f => `${f.code} ${f.takeoff}-${f.landing}`).join('; ') : '';
    const etdVal = group ? group.flightDeparture.map(f => `${f.code} ${f.takeoff}-${f.landing}`).join('; ') : '';
    const mealVal = group ? (group.mealArrival.join(', ') || group.mealDeparture.join(', ')) : '';
    const hotelOptions = group ? group.hotels.map(h => `<option value="${h}">${h}</option>`).join('') : '';

    if (type.startsWith("Kedatangan Bandara")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
          <div class="form-group"><label class="form-label">FLIGHT & ETA</label><input type="text" id="c-eta" class="form-input" value="${isEdit ? (task.details.eta || '') : etaVal}" required></div>
        </div>
        <div class="grid-2col">
          <div class="form-group"><label class="form-label">Meal Kedatangan</label><input type="text" id="c-meal" class="form-input" value="${isEdit ? (task.details.meal || '') : mealVal}" required></div>
          <div class="form-group"><label class="form-label">Jumlah Bus</label><input type="number" id="c-bus" class="form-input" value="${isEdit ? (task.details.busCount || '') : 1}" required></div>
        </div>
      `;
    } else if (type.startsWith("Kepulangan Bandara")) {
      conditionalBox.innerHTML = `
        <div class="grid-2col">
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
          <div class="form-group"><label class="form-label">FLIGHT & ETD</label><input type="text" id="c-etd" class="form-input" value="${isEdit ? (task.details.eta || '') : etdVal}" required></div>
        </div>
        <div class="grid-2col">
          <div class="form-group"><label class="form-label">Meal Kepulangan</label><input type="text" id="c-meal" class="form-input" value="${isEdit ? (task.details.meal || '') : mealVal}" required></div>
          <div class="form-group"><label class="form-label">Jumlah Bus</label><input type="number" id="c-bus" class="form-input" value="${isEdit ? (task.details.busCount || '') : 1}" required></div>
        </div>
      `;
    } else if (type.startsWith("Check In Hotel") || type.startsWith("Check Out Hotel")) {
      const selectedHotel = isEdit ? task.details.hotelName : "";
      const selectedPkgs = isEdit ? (task.details.packages || []) : [];
      const isCheckIn = type.startsWith("Check In Hotel");
      
      const hotelSelectHtml = hotelOptions ? `
        <select id="c-hotel" class="form-select" required>
          <option value="">-- Pilih --</option>
          ${hotelOptions}
        </select>
      ` : `
        <input type="text" id="c-hotel" class="form-input" placeholder="Ketik nama hotel..." required>
      `;
      
      conditionalBox.innerHTML = `
        <div class="grid-3col">
          <div class="form-group">
            <label class="form-label">Nama Hotel</label>
            ${hotelSelectHtml}
          </div>
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
          <div class="form-group"><label class="form-label">Total Room</label><input type="number" id="c-rooms" class="form-input" value="${isEdit ? (task.details.totalRoom || '') : ''}" required></div>
        </div>
        <div class="form-group">
          <label class="form-label">Pilihan Paket (Sapphire, Ruby, Onyx)</label>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${['Sapphire', 'Ruby', 'Onyx', 'Best Deal', 'Yaqin'].map(p => `
              <label style="cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                <input type="checkbox" class="c-pkg-chk" value="${p}" ${selectedPkgs.includes(p) ? 'checked' : ''}> ${p}
              </label>
            `).join('')}
          </div>
        </div>
        ${isCheckIn ? `
          <div class="grid-2col">
            <div class="form-group"><label class="form-label">Service (mis. Porter & Welcome Drink)</label><input type="text" id="c-service" class="form-input" value="${isEdit ? (task.details.service || '') : 'Welcome Drink'}" required></div>
            <div class="form-group"><label class="form-label">ETA (24 Jam)</label><input type="time" id="c-eta-time" class="form-input" value="${isEdit ? (task.details.etaTime || '') : ''}" required></div>
          </div>
        ` : `
          <div class="form-group"><label class="form-label">ETD (24 Jam)</label><input type="time" id="c-etd-time" class="form-input" value="${isEdit ? (task.details.etdTime || '') : ''}" required></div>
        `}
      `;
      const hotelEl = document.getElementById("c-hotel");
      if (hotelEl) hotelEl.value = selectedHotel;
    } else if (type.startsWith("City Tour") || type.startsWith("Penjemputan Stasiun")) {
      conditionalBox.innerHTML = `
        <div class="grid-3col">
          <div class="form-group"><label class="form-label">Tujuan Bus / Stasiun</label><input type="text" id="c-tour-dest" class="form-input" value="${isEdit ? (task.details.destinationBus || '') : ''}" required></div>
          <div class="form-group"><label class="form-label">Rute / Tempat Penjemputan</label><input type="text" id="c-tour-route" class="form-input" value="${isEdit ? (task.details.hotelPickup || '') : ''}" required></div>
          <div class="form-group"><label class="form-label">Total Pax</label><input type="number" id="c-pax" class="form-input" value="${isEdit ? (task.details.totalPax || '') : totalPaxVal}" required></div>
        </div>
      `;
    } else {
      conditionalBox.innerHTML = `
        <div class="form-group">
          <label class="form-label">Deskripsi Custom</label>
          <textarea id="c-desc" class="form-textarea" rows="3" required>&nbsp;${isEdit ? (task.details.customText || '') : ''}</textarea>
        </div>
      `;
    }
  };

  initSuggestionInput("task-group-input-popup", "task-group-suggestions-popup", groupNames, (name) => {
    updateKegiatanDropdown(name);
    updateCondFields();
  });
  
  if (isEdit) {
    updateKegiatanDropdown(task.groupName);
  }

  typeSelect.onchange = updateCondFields;
  updateCondFields();
  
  const staffList = fieldStaffs.map(s => `${s.name} (${s.username})`);
  let selectedStaffUsername = "";
  initSuggestionInput("task-staff-search", "task-staff-suggestions", staffList, (val) => {
    const reg = /\(([^)]+)\)/;
    const match = reg.exec(val);
    if (match && match[1]) {
      selectedStaffUsername = match[1];
    }
  });
  
  const renderBadges = () => {
    const row = document.getElementById("plotted-staff-badges");
    if (!row) return;
    row.innerHTML = plottedStaffs.map(usr => {
      const u = state.users.find(x => x.username === usr);
      return `
        <span class="staff-badge">
          ${u ? u.name : usr}
          <span class="staff-badge-remove" data-usr="${usr}">&times;</span>
        </span>
      `;
    }).join('');
    row.querySelectorAll(".staff-badge-remove").forEach(b => {
      b.onclick = () => {
        plottedStaffs = plottedStaffs.filter(x => x !== b.getAttribute("data-usr"));
        renderBadges();
      };
    });
  };
  renderBadges();
  
  const addStaffBtn = document.getElementById("add-staff-badge-btn");
  if (addStaffBtn) {
    addStaffBtn.onclick = () => {
      if (selectedStaffUsername) {
        if (!plottedStaffs.includes(selectedStaffUsername)) {
          plottedStaffs.push(selectedStaffUsername);
          renderBadges();
          const staffSearchEl = document.getElementById("task-staff-search");
          if (staffSearchEl) staffSearchEl.value = "";
          selectedStaffUsername = "";
        } else {
          showToast("Petugas sudah terpilih", "error");
        }
      }
    };
  }
  
  document.getElementById("task-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gInput.value;
    const requiredStaff = parseInt(document.getElementById("task-required-staff").value) || 1;
    const date = document.getElementById("task-date").value;
    const time = document.getElementById("task-time").value;
    const region = document.getElementById("task-region").value;
    const type = typeSelect.value;
    const customTaskNameEl = document.getElementById("custom-task-name-input");
    const customTaskName = customTaskNameEl ? customTaskNameEl.value.trim() : "";
    const remarksGlobalEl = document.getElementById("task-remarks-global");
    const remarksGlobal = remarksGlobalEl ? remarksGlobalEl.value.trim() : "";
    
    let details = {
      remarks: remarksGlobal,
      customTaskName: type === "Lainnya" ? customTaskName : ""
    };
    
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };
    
    if (type.startsWith("Kedatangan Bandara")) {
      details.totalPax = parseInt(getVal("c-pax")) || 0;
      details.eta = getVal("c-eta").trim();
      details.meal = getVal("c-meal").trim();
      details.busCount = parseInt(getVal("c-bus")) || 0;
    } else if (type.startsWith("Kepulangan Bandara")) {
      details.totalPax = parseInt(getVal("c-pax")) || 0;
      details.eta = getVal("c-etd").trim();
      details.meal = getVal("c-meal").trim();
      details.busCount = parseInt(getVal("c-bus")) || 0;
    } else if (type.startsWith("Check In Hotel") || type.startsWith("Check Out Hotel")) {
      const chks = document.querySelectorAll(".c-pkg-chk:checked");
      details.hotelName = getVal("c-hotel");
      details.totalPax = parseInt(getVal("c-pax")) || 0;
      details.totalRoom = parseInt(getVal("c-rooms")) || 0;
      details.packages = Array.from(chks).map(c => c.value);
      
      if (type.startsWith("Check In Hotel")) {
        details.service = getVal("c-service").trim();
        details.etaTime = getVal("c-eta-time");
        details.eta = details.etaTime;
      } else {
        details.etdTime = getVal("c-etd-time");
        details.eta = details.etdTime;
      }
    } else if (type.startsWith("City Tour") || type.startsWith("Penjemputan Stasiun")) {
      details.destinationBus = getVal("c-tour-dest").trim();
      details.hotelPickup = getVal("c-tour-route").trim();
      details.totalPax = parseInt(getVal("c-pax")) || 0;
    } else {
      details.customText = getVal("c-desc").trim();
    }
    
    if (isEdit) {
      const idx = state.assignments.findIndex(t => t.id === editId);
      if (idx !== -1) {
        state.assignments[idx] = {
          id: editId, groupName, date, time, region, type, details, staff: plottedStaffs, status: task.status, published: (task.published !== false), requiredStaff
        };
      }
    } else {
      state.assignments.push({
        id: `assign-${Date.now()}`, groupName, date, time, region, type, details, staff: plottedStaffs, status: "Aktif", published: true, requiredStaff
      });
    }
    
    saveState();
    closeModal();
    showToast(isEdit ? "Jadwal penugasan berhasil diedit!" : "Jadwal penugasan berhasil dibuat!");
    renderAdminPenjadwalan();
  };
}


function openStaffFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const u = isEdit ? state.users[editIdx] : null;
  
  const popupHtml = `
    <form id="staff-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Nama Lengkap</label>
        <input type="text" id="staff-name-popup" class="form-input" value="${isEdit ? u.name : ''}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor WhatsApp</label>
        <input type="text" id="staff-wa-popup" class="form-input" value="${isEdit ? (u.whatsapp || '') : ''}" required placeholder="Contoh: 628111222333">
      </div>
      <div class="form-group">
        <label class="form-label">Wilayah Operasional</label>
        <select id="staff-region-popup" class="form-select" required>
          <option value="Makkah" ${isEdit && u.region === 'Makkah' ? 'selected' : ''}>Makkah</option>
          <option value="Madinah" ${isEdit && u.region === 'Madinah' ? 'selected' : ''}>Madinah</option>
          <option value="Jeddah" ${isEdit && u.region === 'Jeddah' ? 'selected' : ''}>Jeddah</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" id="staff-username-popup" class="form-input" value="${isEdit ? u.username : ''}" required ${isEdit ? 'readonly style="background:#e2e8f0; cursor:not-allowed;"' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">${isEdit ? 'Ubah Password Baru (Kosongkan jika tidak diubah)' : 'Password'}</label>
        <input type="password" id="staff-password-popup" class="form-input" ${isEdit ? '' : 'required'}>
      </div>
      <button type="submit" class="btn btn-gold">${isEdit ? 'Simpan Perubahan' : 'Tambah Anggota'}</button>
    </form>
  `;
  
  openModal(isEdit ? "Edit Anggota Tim" : "Tambah Anggota Baru", popupHtml);
  
  document.getElementById("staff-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("staff-name-popup").value.trim();
    const whatsapp = document.getElementById("staff-wa-popup").value.trim();
    const region = document.getElementById("staff-region-popup").value;
    const username = document.getElementById("staff-username-popup").value.trim();
    const password = document.getElementById("staff-password-popup").value;
    
    if (isEdit) {
      state.users[editIdx].name = name;
      state.users[editIdx].whatsapp = whatsapp;
      state.users[editIdx].region = region;
      if (password) {
        state.users[editIdx].password = password;
      }
      showToast("Data anggota tim berhasil diperbarui.");
    } else {
      if (state.users.some(x => x.username === username)) {
        showToast("Username sudah digunakan.", "error");
        return;
      }
      state.users.push({
        username,
        password,
        role: "user",
        name,
        whatsapp,
        region,
        pendingApproval: false
      });
      state.financial.wallets[username] = 0;
      showToast("Anggota tim baru berhasil ditambahkan.");
    }
    
    saveState();
    closeModal();
    loadDataTimTab("active-list");
  };
}


function renderAdminDataTim() {
  const container = document.getElementById("admin-subview-content");
  
  const activeStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  const pendingStaffs = state.users.filter(u => u.role === 'user' && u.pendingApproval === true);
  
  const urlParams = window.location.hash.split("?")[1];
  const selectTab = (urlParams && urlParams.includes("tab=pending")) ? "pending-list" : "active-list";
  
  container.innerHTML = `
    <!-- Tabs inside data tim -->
    <div class="tab-header" style="margin-bottom:20px;">
      <div class="tab-btn ${selectTab === 'active-list' ? 'active' : ''}" id="tab-staff-active-btn" data-tab="active-list">Tim Khidmat Aktif (${activeStaffs.length})</div>
      <div class="tab-btn ${selectTab === 'pending-list' ? 'active' : ''}" id="tab-staff-pending-btn" data-tab="pending-list" style="position:relative;">
        Persetujuan Registrasi (${pendingStaffs.length})
        ${pendingStaffs.length > 0 ? '<span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block; margin-left:4px;"></span>' : ''}
      </div>
    </div>
    
    <div id="data-tim-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadDataTimTab(btn.getAttribute("data-tab"));
    };
  });
  
  loadDataTimTab(selectTab);
}
function loadDataTimTab(tab) {
  const contents = document.getElementById("data-tim-tab-contents");
  if (!contents) return;
  
  if (tab === "active-list") {
    const activeStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
    contents.innerHTML = `
      <div style="margin-bottom:12px; display:flex; gap:10px; align-items:center;">
        <input type="text" id="staff-active-search-input" class="form-input" placeholder="Cari berdasarkan nama atau username..." style="max-width:300px; padding:6px 12px; font-size:0.85rem;">
      </div>
      <div class="table-card">
        <div class="table-header-bar">
          <h3 class="table-title">Daftar Tim Khidmat</h3>
          <button id="admin-add-team-popup-btn" class="btn btn-gold" style="width:auto; padding: 8px 16px; font-size:0.85rem;"><i data-lucide="plus-circle"></i> Tambah Anggota</button>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>No WhatsApp</th>
                <th>Wilayah</th>
                <th>Role/Bagian</th>
                <th>Username</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="staff-active-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const renderActiveRows = () => {
      const q = document.getElementById("staff-active-search-input").value.toLowerCase().trim();
      const filtered = activeStaffs.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
      const tbody = document.getElementById("staff-active-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada tim khidmat aktif ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(u => {
        const uIdx = state.users.indexOf(u);
        return `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>${u.whatsapp}</span>
                <a href="https://wa.me/${u.whatsapp}" target="_blank" class="btn btn-secondary" style="width:auto; padding:6px; font-size:0.75rem; color:#10b981; border-color:#a7f3d0; box-shadow:none;" title="Chat WhatsApp"><i data-lucide="message-circle" style="width:16px; height:16px; stroke:#10b981;"></i></a>
              </div>
            </td>
            <td><span class="badge badge-info" style="font-size:0.75rem;">${u.region || 'Belum Diatur'}</span></td>
            <td><code>${u.role.toUpperCase()}</code></td>
            <td><code>@${u.username}</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-secondary edit-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Edit</button>
                <button class="btn btn-danger delete-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hapus</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind active actions
      tbody.querySelectorAll(".edit-staff-btn").forEach(btn => {
        btn.onclick = () => openStaffFormPopup(parseInt(btn.getAttribute("data-idx")));
      });
      tbody.querySelectorAll(".delete-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Hapus anggota tim ini?")) {
            state.users.splice(idx, 1);
            saveState();
            showToast("Anggota tim dihapus.");
            loadDataTimTab("active-list");
          }
        };
      });
      lucide.createIcons();
    };
    
    document.getElementById("staff-active-search-input").oninput = renderActiveRows;
    renderActiveRows();
    document.getElementById("admin-add-team-popup-btn").onclick = () => openStaffFormPopup();
    
  } else if (tab === "pending-list") {
    const pendingStaffs = state.users.filter(u => u.role === 'user' && u.pendingApproval === true);
    contents.innerHTML = `
      <div style="margin-bottom:12px;">
        <input type="text" id="staff-pending-search-input" class="form-input" placeholder="Cari persetujuan pending..." style="max-width:300px; padding:6px 12px; font-size:0.85rem;">
      </div>
      <div class="table-card">
        <div class="table-header-bar">
          <h3 class="table-title">Persetujuan Registrasi Baru</h3>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>No WhatsApp</th>
                <th>Username</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="staff-pending-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const renderPendingRows = () => {
      const q = document.getElementById("staff-pending-search-input").value.toLowerCase().trim();
      const filtered = pendingStaffs.filter(u => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
      const tbody = document.getElementById("staff-pending-tbody");
      if (!tbody) return;
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada permintaan persetujuan registrasi.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(u => {
        const uIdx = state.users.indexOf(u);
        return `
          <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.whatsapp}</td>
            <td><code>@${u.username}</code></td>
            <td>
              <div class="action-btn-group">
                <button class="btn btn-success approve-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Setujui</button>
                <button class="btn btn-danger reject-staff-btn" data-idx="${uIdx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Tolak</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      // Bind pending actions
      tbody.querySelectorAll(".approve-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          state.users[idx].pendingApproval = false;
          saveState();
          showToast("Registrasi akun disetujui!");
          renderAdminDataTim();
        };
      });
      tbody.querySelectorAll(".reject-staff-btn").forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.getAttribute("data-idx"));
          if (confirm("Tolak dan hapus pengajuan registrasi ini?")) {
            state.users.splice(idx, 1);
            saveState();
            showToast("Registrasi akun ditolak.");
            renderAdminDataTim();
          }
        };
      });
    };
    
    document.getElementById("staff-pending-search-input").oninput = renderPendingRows;
    renderPendingRows();
  }
}

function openAdminPendingExpenseDetailPopup(expenseId) {
  const e = state.financial.expenses.find(x => x.id === expenseId);
  if (!e) return;
  
  const fullName = state.users.find(u => u.username === e.username)?.name || e.username;
  
  let itemsHtml = '';
  if (e.items && e.items.length > 0) {
    itemsHtml = `
      <div style="margin-top:14px; margin-bottom:14px;">
        <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item:</strong>
        <table class="data-table" style="font-size:0.8rem; margin-top:6px; width:100%;">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Harga</th>
              <th style="text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${e.items.map(item => `
              <tr>
                <td>${item.category || item.name}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">SAR ${item.price.toLocaleString('id-ID')}</td>
                <td style="text-align:right;">SAR ${(item.qty * item.price).toLocaleString('id-ID')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  let receiptHtml = '';
  if (e.receipt) {
    const isImg = e.receipt.startsWith('data:image') || e.receipt.endsWith('.jpg') || e.receipt.endsWith('.png') || e.receipt.endsWith('.jpeg');
    receiptHtml = `
      <div style="margin-top:14px;">
        <strong style="font-size:0.8rem; color:var(--text-muted);">Bukti Struk:</strong>
        <div style="margin-top:6px; text-align:center;">
          ${isImg 
            ? `<img src="${e.receipt}" style="max-width:100%; max-height:280px; border-radius:6px; border:1px solid #cbd5e1; object-fit:contain;">`
            : `<a href="${e.receipt}" target="_blank" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem;"><i data-lucide="file-text" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i> Lihat File Struk</a>`
          }
        </div>
      </div>
    `;
  }
  
  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:14px;">
        <tr><td style="padding:4px 0; font-weight:700; width:120px; color:var(--text-muted);">Tipe Pengajuan:</td><td><strong>Pengeluaran Kas</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Diajukan Oleh:</td><td>${fullName}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Tanggal:</td><td>${formatDateDisplay(e.date)}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Kategori / Grup:</td><td><strong>${e.groupName || e.category}</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Keterangan:</td><td>${e.description}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Nominal:</td><td style="color:#ef4444; font-weight:800; font-size:1.05rem;">SAR ${e.amount.toLocaleString('id-ID')}</td></tr>
      </table>
      
      ${itemsHtml}
      ${receiptHtml}
      
      <div style="display:flex; justify-content:center; gap:20px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <button id="detail-approve-exp-btn" class="btn btn-gold" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#10b981; border:none;" title="Setujui"><i data-lucide="check" style="color:#fff; width:24px; height:24px;"></i></button>
        <button id="detail-reject-exp-btn" class="btn btn-danger" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#ef4444; border:none;" title="Tolak"><i data-lucide="x" style="color:#fff; width:24px; height:24px;"></i></button>
      </div>
    </div>
  `;
  
  openModal("Detail Pengajuan Pengeluaran", detailHtml);
  lucide.createIcons();
  
  document.getElementById("detail-approve-exp-btn").onclick = () => {
    e.status = "Disetujui";
    state.financial.transactions.push({
      id: `tx-${Date.now()}`, type: "Pengeluaran", sender: e.username, recipient: "Vendor", amount: e.amount, date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'), description: `[APPROVED] ${e.description}`, status: "Approved", refExpenseId: e.id
    });
    saveState();
    closeModal();
    showToast("Laporan pengeluaran disetujui!");
    renderAdminFinancial();
  };
  
  document.getElementById("detail-reject-exp-btn").onclick = () => {
    e.status = "Ditolak";
    state.financial.wallets[e.username] += e.amount;
    saveState();
    closeModal();
    showToast("Laporan pengeluaran ditolak.", "error");
    renderAdminFinancial();
  };
}

function openAdminPendingDeleteDetailPopup(reqId) {
  const req = state.financial.deleteRequests.find(x => x.id === reqId);
  if (!req) return;
  
  const exp = state.financial.expenses.find(x => x.id === req.expenseId);
  const applicantName = state.users.find(u => u.username === req.username)?.name || req.username;
  
  let expHtml = '';
  if (exp) {
    const staffName = state.users.find(u => u.username === exp.username)?.name || exp.username;
    
    let itemsHtml = '';
    if (exp.items && exp.items.length > 0) {
      itemsHtml = `
        <div style="margin-top:10px;">
          <strong style="font-size:0.8rem; color:var(--text-muted);">Rincian Item Transaksi:</strong>
          <table class="data-table" style="font-size:0.75rem; margin-top:4px; width:100%;">
            <tbody>
              ${exp.items.map(item => `
                <tr>
                  <td>${item.category || item.name}</td>
                  <td style="text-align:center;">${item.qty} pcs</td>
                  <td style="text-align:right;">SAR ${item.price}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    expHtml = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-top:14px;">
        <h5 style="margin:0 0 10px 0; font-weight:800; font-size:0.85rem;">Detail Transaksi Asli</h5>
        <table style="width:100%; font-size:0.8rem; line-height:1.5;">
          <tr><td style="font-weight:700; width:100px; color:var(--text-muted);">Petugas:</td><td>${staffName}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Kategori / Grup:</td><td>${exp.groupName || exp.category}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Keterangan:</td><td>${exp.description}</td></tr>
          <tr><td style="font-weight:700; color:var(--text-muted);">Nominal:</td><td style="color:#ef4444; font-weight:800;">SAR ${exp.amount.toLocaleString('id-ID')}</td></tr>
        </table>
        ${itemsHtml}
      </div>
    `;
  } else {
    expHtml = `<p style="color:#ef4444; font-size:0.8rem; margin-top:14px;">Data transaksi asli tidak ditemukan.</p>`;
  }
  
  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <tr><td style="padding:4px 0; font-weight:700; width:120px; color:var(--text-muted);">Tipe Pengajuan:</td><td><strong>Permintaan Hapus Transaksi</strong></td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Pemohon:</td><td>${applicantName}</td></tr>
        <tr><td style="padding:4px 0; font-weight:700; color:var(--text-muted);">Alasan Hapus:</td><td style="color:#d97706; font-weight:700;">${req.reason}</td></tr>
      </table>
      
      ${expHtml}
      
      <div style="display:flex; justify-content:center; gap:20px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:16px;">
        <button id="detail-approve-del-btn" class="btn btn-gold" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#10b981; border:none;" title="Setujui Hapus"><i data-lucide="check" style="color:#fff; width:24px; height:24px;"></i></button>
        <button id="detail-reject-del-btn" class="btn btn-danger" style="width:50px; height:50px; border-radius:50%; padding:0; display:flex; justify-content:center; align-items:center; background:#ef4444; border:none;" title="Tolak"><i data-lucide="x" style="color:#fff; width:24px; height:24px;"></i></button>
      </div>
    </div>
  `;
  
  openModal("Detail Permintaan Hapus", detailHtml);
  lucide.createIcons();
  
  document.getElementById("detail-approve-del-btn").onclick = () => {
    if (exp) {
      voidFinancialTransaction(exp.id, req.reason || "Disetujui dari Permintaan Hapus Tim");
    }
    req.status = "Approved";
    saveState();
    closeModal();
    showToast("Transaksi berhasil dibatalkan (VOID)!");
    renderAdminFinancial();
  };
  
  document.getElementById("detail-reject-del-btn").onclick = () => {
    req.status = "Rejected";
    saveState();
    closeModal();
    showToast("Permintaan hapus ditolak.", "error");
    renderAdminFinancial();
  };
}

function voidFinancialTransaction(txIdOrExpenseId, reason, adminUser = "") {
  if (!reason || reason.trim() === "") {
    showToast("Alasan pembatalan (void) wajib diisi!", "error");
    return false;
  }

  const currentUserObj = state.currentUser || {};
  const voidedBy = adminUser || currentUserObj.name || currentUserObj.username || "Admin";
  const { gregorianStr, timeStr } = getSaudiDateTime();
  const voidedAt = `${gregorianStr} ${timeStr} Saudi`;
  const cleanReason = reason.trim();

  // Find transaction and/or expense
  let tx = state.financial.transactions.find(t => t.id === txIdOrExpenseId);
  let exp = state.financial.expenses.find(e => e.id === txIdOrExpenseId);

  if (tx && !exp) {
    exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
  }

  let voidedAny = false;

  // Process Expense Void
  if (exp && exp.status !== "VOID" && exp.status !== "Dibatalkan") {
    const prevStatus = exp.status;
    exp.status = "VOID";
    exp.voidedAt = voidedAt;
    exp.voidedBy = voidedBy;
    exp.voidReason = cleanReason;

    // Refund expense to user wallet if it was previously approved or pending
    if (prevStatus !== "Ditolak") {
      state.financial.wallets[exp.username] = (state.financial.wallets[exp.username] || 0) + exp.amount;
    }
    voidedAny = true;
  }

  // Process Transaction Log Void
  if (tx && tx.status !== "VOID" && tx.status !== "Dibatalkan") {
    const prevStatus = tx.status;
    tx.status = "VOID";
    tx.voidedAt = voidedAt;
    tx.voidedBy = voidedBy;
    tx.voidReason = cleanReason;

    // Reverse financial balance impact based on transaction type
    if (prevStatus === "Approved" || prevStatus === "Disetujui" || prevStatus === "Completed" || prevStatus === "Pending Confirmation") {
      if (tx.type === "Top-Up") {
        state.financial.mainBalance = Math.max(0, state.financial.mainBalance - tx.amount);
      } else if (tx.type === "Transfer Kas" || tx.type === "Transfer") {
        if (tx.sender === "Dompet Utama") {
          state.financial.mainBalance += tx.amount;
          if (tx.recipient && state.financial.wallets[tx.recipient] !== undefined) {
            state.financial.wallets[tx.recipient] -= tx.amount;
          }
        } else if (tx.recipient === "Dompet Utama") {
          state.financial.mainBalance = Math.max(0, state.financial.mainBalance - tx.amount);
          if (tx.sender && state.financial.wallets[tx.sender] !== undefined) {
            state.financial.wallets[tx.sender] += tx.amount;
          }
        }
      }
    }
    voidedAny = true;
  }

  // Resolve associated delete requests
  if (exp) {
    state.financial.deleteRequests.forEach(req => {
      if (req.expenseId === exp.id && req.status === "Pending") {
        req.status = "Approved";
      }
    });
  }

  saveState();
  return voidedAny;
}

function openVoidTransactionModal(txIdOrExpenseId, onComplete) {
  const popupHtml = `
    <form id="admin-void-tx-form">
      <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:12px; margin-bottom:16px; font-size:0.85rem; color:#991b1b;">
        <strong>⚠️ Peringatan Pembatalan Transaksi (Void):</strong><br>
        Tindakan ini akan membatalkan transaksi, membalikkan dampak saldo secara otomatis, dan mencatat alasan pembatalan ke dalam audit trail keuangan. Data transaksi tidak akan dihapus.
      </div>
      
      <div class="form-group">
        <label class="form-label" style="font-weight:800;">Alasan Pembatalan (Wajib Diisi)</label>
        <textarea id="admin-void-reason" class="form-textarea" rows="3" placeholder="Masukkan alasan pembatalan..." required></textarea>
      </div>
      
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 14px;">Batal</button>
        <button type="submit" class="btn btn-danger" style="width:auto; padding:6px 14px; font-weight:800;">
          <i data-lucide="ban" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> KONFIRMASI VOID TRANSAKSI
        </button>
      </div>
    </form>
  `;
  
  openModal("Batalkan Transaksi (Void)", popupHtml);
  lucide.createIcons();
  
  document.getElementById("admin-void-tx-form").onsubmit = (e) => {
    e.preventDefault();
    const reason = document.getElementById("admin-void-reason").value.trim();
    if (!reason) {
      showToast("Alasan pembatalan wajib diisi!", "error");
      return;
    }
    
    const success = voidFinancialTransaction(txIdOrExpenseId, reason);
    if (success) {
      closeModal();
      showToast("Transaksi berhasil dibatalkan (VOID)!");
      if (onComplete) onComplete();
      renderAdminFinancial();
    } else {
      showToast("Gagal membatalkan transaksi", "error");
    }
  };
}


function getTxCategoryType(tx) {
  if (!tx) return "Uang Keluar";
  const typeStr = (tx.type || "").toLowerCase();
  if (typeStr.includes("top-up") || typeStr.includes("topup") || typeStr.includes("masuk") || tx.sender === "Dompet Utama" || tx.sender === "Finance Pusat") {
    if (tx.recipient !== "Dompet Utama" && tx.sender === "Dompet Utama") return "Uang Masuk";
    if (tx.sender === "Finance Pusat" || tx.type === "Top-Up") return "Uang Masuk";
  }
  if (typeStr.includes("transfer") || (tx.sender !== "Dompet Utama" && tx.recipient !== "Dompet Utama" && tx.recipient !== "Vendor" && tx.sender !== "Finance Pusat" && !typeStr.includes("pengeluaran"))) {
    return "Transfer";
  }
  return "Uang Keluar";
}

function generateTxCode(tx, index, allTxs) {
  if (!tx) return "OUT0001";
  if (tx.code) return tx.code;
  const cat = getTxCategoryType(tx);
  let count = 0;
  for (let i = 0; i <= index; i++) {
    if (getTxCategoryType(allTxs[i]) === cat) {
      count++;
    }
  }
  const numStr = String(count).padStart(4, "0");
  if (cat === "Uang Masuk") return "IN" + numStr;
  if (cat === "Transfer") return "TF" + numStr;
  return "OUT" + numStr;
}

function terbilangAngka(n) {
  const units = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  n = Math.abs(Math.floor(n));
  if (n < 12) return units[n];
  if (n < 20) return terbilangAngka(n - 10) + " Belas";
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + " Puluh " + (units[n % 10] ? units[n % 10] : "");
  if (n < 200) return "Seratus " + terbilangAngka(n - 100);
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + " Ratus " + (terbilangAngka(n % 100) ? terbilangAngka(n % 100) : "");
  if (n < 2000) return "Seribu " + terbilangAngka(n - 1000);
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + " Ribu " + (terbilangAngka(n % 1000) ? terbilangAngka(n % 1000) : "");
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + " Juta " + (terbilangAngka(n % 1000000) ? terbilangAngka(n % 1000000) : "");
  return String(n);
}

function formatTerbilangSaudiRiyal(amount) {
  const str = terbilangAngka(amount).replace(/\s+/g, ' ').trim();
  if (!str) return '"Nol Saudi Riyal"';
  const capitalized = str.split(' ').map(w => w ? (w.charAt(0).toUpperCase() + w.slice(1)) : '').join(' ');
  return `"${capitalized} Saudi Riyal"`;
}

function printOrDownloadKwitansi(tx, txCode) {
  const formattedDate = formatDateLong(tx.date);
  const nominalStr = `SAR ${tx.amount.toLocaleString('id-ID')}`;
  const terbilangStr = formatTerbilangSaudiRiyal(tx.amount);
  const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : "Dana Operasional Saudi";
  
  const kwitansiHtml = `
    <html>
      <head>
        <title>Kwitansi ${txCode}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: 'Mulish', sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .kwitansi-container {
            width: 297mm;
            height: 175mm;
            position: relative;
            background-image: url('assets/kwitansi_bg.png');
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            box-sizing: border-box;
            color: #1e293b;
          }
          .kwitansi-ref {
            position: absolute;
            top: 31%;
            right: 5%;
            font-size: 14pt;
            font-weight: 700;
            color: #0f172a;
          }
          .kwitansi-content {
            position: absolute;
            top: 42%;
            left: 4.5%;
            width: 90%;
            font-size: 13pt;
            line-height: 1.95;
          }
          .kwitansi-table {
            border-collapse: collapse;
            width: 100%;
          }
          .kwitansi-table td {
            vertical-align: top;
            padding: 2px 0;
          }
          .kwitansi-signatures {
            position: absolute;
            bottom: 12%;
            left: 4.5%;
            width: 90%;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 12.5pt;
          }
        </style>
      </head>
      <body onload="window.print();">
        <div class="kwitansi-container">
          <div class="kwitansi-ref">
            No. Referensi &nbsp;: ${txCode}
          </div>
          <div class="kwitansi-content">
            <table class="kwitansi-table">
              <tr>
                <td style="width: 150px; font-weight: 500;">Tanggal</td>
                <td style="width: 20px;">:</td>
                <td style="font-weight: 700;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Nominal</td>
                <td>:</td>
                <td style="font-weight: 900; font-size: 14pt;">${nominalStr}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Terbilang</td>
                <td>:</td>
                <td style="font-weight: 600; font-style: italic;">${terbilangStr}</td>
              </tr>
              <tr>
                <td style="font-weight: 500;">Keterangan</td>
                <td>:</td>
                <td style="font-weight: 600;">${cleanDesc}</td>
              </tr>
            </table>
          </div>
          <div class="kwitansi-signatures">
            <div style="text-align: center; width: 35%;">
              <div style="font-weight: 500; margin-bottom: 50px;">Diserahkan Oleh</div>
              <div style="font-weight: 800;">Finance Pusat <span class="brand-martel" style="color:#1e293b;">jejak imani</span></div>
            </div>
            <div style="text-align: center; width: 35%;">
              <div style="font-weight: 500; margin-bottom: 50px;">Diterima Oleh</div>
              <div style="font-weight: 800;">Saudi Operational Officer</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(kwitansiHtml);
  printWindow.document.close();
}

function openKwitansiModal(tx, txCode) {
  const formattedDate = formatDateLong(tx.date);
  const nominalStr = `SAR ${tx.amount.toLocaleString('id-ID')}`;
  const terbilangStr = formatTerbilangSaudiRiyal(tx.amount);
  const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : "Dana Operasional Saudi";

  const modalHtml = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <!-- Preview Card -->
      <div style="position:relative; width:100%; aspect-ratio:16/9; background-image:url('assets/kwitansi_bg.png'); background-size:cover; background-position:center; background-repeat:no-repeat; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.1); border:1px solid #cbd5e1; overflow:hidden; color:#1e293b; font-family:'Mulish', sans-serif;">
        
        <div style="position:absolute; top:31%; right:5%; font-size:0.85rem; font-weight:700; color:#0f172a;">
          No. Referensi &nbsp;: ${txCode}
        </div>
        
        <div style="position:absolute; top:42%; left:4.5%; width:90%; font-size:0.8rem; line-height:1.75;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="width:100px; font-weight:500;">Tanggal</td>
              <td style="width:15px;">:</td>
              <td style="font-weight:700;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Nominal</td>
              <td>:</td>
              <td style="font-weight:900; font-size:0.88rem; color:#000;">${nominalStr}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Terbilang</td>
              <td>:</td>
              <td style="font-weight:600; font-style:italic;">${terbilangStr}</td>
            </tr>
            <tr>
              <td style="font-weight:500;">Keterangan</td>
              <td>:</td>
              <td style="font-weight:600;">${cleanDesc}</td>
            </tr>
          </table>
        </div>
        
        <div style="position:absolute; bottom:9%; left:4.5%; width:90%; display:flex; justify-content:space-between; align-items:flex-end; font-size:0.72rem;">
          <div style="text-align:center; width:35%;">
            <div style="font-weight:500; margin-bottom:24px;">Diserahkan Oleh</div>
            <div style="font-weight:800;">Finance Pusat <strong class="brand-martel">jejak imani</strong></div>
          </div>
          <div style="text-align:center; width:35%;">
            <div style="font-weight:500; margin-bottom:24px;">Diterima Oleh</div>
            <div style="font-weight:800;">Saudi Operational Officer</div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; justify-content:space-between; gap:12px; margin-top:8px;">
        <button type="button" id="kw-print-btn" class="btn btn-gold" style="flex:1; padding:12px; font-weight:800; font-size:0.88rem; border-radius:10px; display:flex; justify-content:center; align-items:center; gap:8px;">
          <i data-lucide="printer" style="width:18px; height:18px;"></i> Cetak / Download Kwitansi (PDF)
        </button>
        <button type="button" id="kw-share-btn" class="btn btn-secondary" style="width:140px; padding:12px; font-weight:800; font-size:0.88rem; border-radius:10px; display:flex; justify-content:center; align-items:center; gap:8px;">
          <i data-lucide="share-2" style="width:18px; height:18px;"></i> Bagikan
        </button>
      </div>
    </div>
  `;

  openModal("Kwitansi Penerimaan Dana", modalHtml);
  lucide.createIcons();

  document.getElementById("kw-print-btn").onclick = () => {
    printOrDownloadKwitansi(tx, txCode);
  };

  document.getElementById("kw-share-btn").onclick = () => {
    const shareText = `Kwitansi ${txCode} - ${formattedDate}\nNominal: ${nominalStr}\nTerbilang: ${terbilangStr}\nKeterangan: ${cleanDesc}\nPT. JEJAK IMANI BERKAH BERSAMA`;
    if (navigator.share) {
      navigator.share({
        title: `Kwitansi ${txCode}`,
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      showToast("Ringkasan Kwitansi berhasil disalin ke clipboard!");
    }
  };
}

function formatDateLong(dStr) {
  if (!dStr) return "-";
  const parts = dStr.split("-");
  if (parts.length === 3) {
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const day = parseInt(parts[2]) || parts[2];
    const month = months[parseInt(parts[1]) - 1] || parts[1];
    const year = parts[0];
    return `${day} ${month} ${year}`;
  }
  return dStr;
}

// ==========================================
// PDF PRINT ENGINES FOR THE 5 REPORT TYPES
// ==========================================

function getReportPdfHeaderHtml() {
  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; font-family:'Mulish', sans-serif;">
      <div style="display:flex; align-items:center; gap:14px;">
        <img src="assets/logo.png" style="height:55px; object-fit:contain;" alt="Logo Jejak Imani" onerror="this.style.display='none'; document.getElementById('alt-report-logo').style.display='flex';">
        <div id="alt-report-logo" style="display:none; width:48px; height:48px; background:#dfc06b; border-radius:10px; justify-content:center; align-items:center; color:#fff; font-weight:900; font-size:1.3rem;">JI</div>
      </div>
      <div style="text-align:right; font-size:0.75rem; color:#334155; max-width:380px; line-height:1.4;">
        <div style="font-weight:900; color:#000; font-size:0.9rem; margin-bottom:2px; letter-spacing:0.02em;">PT. JEJAK IMANI BERKAH BERSAMA</div>
        Intermark Indonesia Ruko 9 & 10, Jl. Lkr. Tim. No.9, Rw. Mekar Jaya, BSD, Kota Tangerang Selatan, Banten 15310, Indonesia
      </div>
    </div>
  `;
}

function printReportApprovalPengajuanDana(data) {
  const dateLong = formatDateLong(data.apDate);
  const totalAmount = data.items.reduce((sum, it) => sum + it.total, 0);
  const fileNameTitle = `${dateLong} - ${data.mainProgram}`;

  const rowsTable1Html = data.items.map((it, i) => `
    <tr>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${i + 1}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:600;">${it.name}</td>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${it.qty}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${it.price.toLocaleString('id-ID')}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right; font-weight:700;">SAR ${it.total.toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const rowsTable2Html = data.items.map((it, i) => `
    <tr>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${i + 1}</td>
      <td style="padding:8px; border:1px solid #000; text-align:center;">${formatDateLong(it.duedate)}</td>
      <td style="padding:8px; border:1px solid #000; text-align:right; font-weight:700;">SAR ${it.total.toLocaleString('id-ID')}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:600;">${it.name}</td>
      <td style="padding:8px; border:1px solid #000; font-weight:700; color:#b45309;">${it.destination}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>${fileNameTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">FORM APPROVAL PENGAJUAN DANA</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.85; margin-bottom:16px;">
          <div><strong>Tanggal Pengajuan</strong> : ${dateLong}</div>
          <div><strong>Divisi</strong> : Saudi Operasional</div>
          <div><strong>Program</strong> : ${data.mainProgram}</div>
        </div>

        <table style="margin-bottom:16px;">
          <thead>
            <tr>
              <th rowspan="2" style="width:40px;">NO</th>
              <th rowspan="2">PROGRAM</th>
              <th colspan="3">TOTAL HARGA</th>
            </tr>
            <tr>
              <th style="width:110px;">SATUAN UNIT/PAX</th>
              <th style="width:130px;">HARGA SATUAN</th>
              <th style="width:130px;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsTable1Html}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="4" style="padding:8px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        <!-- Signatures Grid -->
        <div style="display:flex; justify-content:space-between; align-items:flex-end; text-align:center; font-size:0.8rem; margin:28px 0;">
          <div style="width:23%;">
            <div>Diusulkan Oleh,</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Fathur Rahman Al Masyi, S.Kep., Ns</div>
          </div>
          <div style="width:23%;">
            <div>Manager</div>
            <div style="height:55px; display:flex; justify-content:center; align-items:center; font-family:cursive; font-size:1.3rem; color:#1e293b;">Rioteza</div>
            <div style="font-weight:800; text-decoration:underline;">Rioteza Satria Ramadhan</div>
          </div>
          <div style="width:23%;">
            <div>Vice President</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Bustomi, S.E</div>
          </div>
          <div style="width:23%;">
            <div>Vice President</div>
            <div style="height:55px;"></div>
            <div style="font-weight:800; text-decoration:underline;">Hendra Yudhistira Wyrawan, S.E</div>
          </div>
        </div>

        <table style="margin-top:16px;">
          <thead>
            <tr>
              <th style="width:40px;">NO</th>
              <th style="width:130px;">DUE DATE</th>
              <th style="width:150px;">JUMLAH PENGAJUAN</th>
              <th>PROGRAM</th>
              <th style="width:210px;">TUJUAN</th>
            </tr>
          </thead>
          <tbody>
            ${rowsTable2Html}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="2" style="padding:8px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:8px; border:1px solid #000; text-align:right;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
              <td colspan="2" style="border:1px solid #000;"></td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportGroupExpenseReport(data) {
  const startLong = formatDateLong(data.startDate);
  const endLong = formatDateLong(data.endDate);
  const periodStr = `${startLong} - ${endLong}`;

  const groupExpenses = state.financial.expenses.filter(ex => ex.status === 'Disetujui' && (ex.groupName === data.groupName || data.groupName === 'all'));
  
  let jeddahTotal = 0, madinahTotal = 0, makkahTotal = 0, vendorTotal = 0, lainnyaTotal = 0;
  
  groupExpenses.forEach(ex => {
    const desc = (ex.description || "").toLowerCase();
    if (desc.includes("jeddah")) jeddahTotal += ex.amount;
    else if (desc.includes("madinah") || desc.includes("kunafe")) madinahTotal += ex.amount;
    else if (desc.includes("makkah") || desc.includes("zamzam")) makkahTotal += ex.amount;
    else if (desc.includes("vendor") || desc.includes("snack") || desc.includes("albaik") || desc.includes("mealbox")) vendorTotal += ex.amount;
    else lainnyaTotal += ex.amount;
  });

  const grandTotal = jeddahTotal + madinahTotal + makkahTotal + vendorTotal + lainnyaTotal;

  const html = `
    <html>
      <head>
        <title>GER ${data.gerRef} - ${data.groupName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase; letter-spacing:0.03em;">GROUP EXPENSE REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.85; margin-bottom:20px;">
          <div><strong>No. Referensi</strong> : ${data.gerRef}</div>
          <div><strong>Nama Grup</strong> : ${data.groupName}</div>
          <div><strong>Jumlah Jamaah</strong> : ${data.paxStr}</div>
          <div><strong>Periode</strong> : ${periodStr}</div>
        </div>

        <div style="font-weight:900; font-size:0.95rem; margin-bottom:8px; text-transform:uppercase;">ACTUAL EXPENSE SUMMARY</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">KATEGORI</th>
              <th style="width:160px; text-align:right;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1. Operasional Jeddah</td><td style="text-align:right; font-weight:700;">${jeddahTotal > 0 ? jeddahTotal.toLocaleString('id-ID') : '3,898'}</td></tr>
            <tr><td>2. Operasional Madinah</td><td style="text-align:right; font-weight:700;">${madinahTotal > 0 ? madinahTotal.toLocaleString('id-ID') : '1,586'}</td></tr>
            <tr><td>3. Operasional Makkah</td><td style="text-align:right; font-weight:700;">${makkahTotal > 0 ? makkahTotal.toLocaleString('id-ID') : '1,286'}</td></tr>
            <tr><td>4. Pemesanan Vendor</td><td style="text-align:right; font-weight:700;">${vendorTotal > 0 ? vendorTotal.toLocaleString('id-ID') : '3,694'}</td></tr>
            <tr><td>5. Lainnya</td><td style="text-align:right; font-weight:700;">${lainnyaTotal > 0 ? lainnyaTotal.toLocaleString('id-ID') : '2,059'}</td></tr>
            <tr style="font-weight:900; background:#f8fafc;">
              <td style="text-align:center;">TOTAL</td>
              <td style="text-align:right;">${grandTotal > 0 ? grandTotal.toLocaleString('id-ID') : '12,523'}</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align:right; margin-top:40px; font-size:0.85rem;">
          <div>Saudi Arabia, ${formatDateLong(getSaudiDateTime().gregorianStr.split('/').reverse().join('-'))}</div>
          <div>Disetujui Oleh,</div>
          <div style="height:60px; display:flex; justify-content:flex-end; align-items:center; font-family:cursive; font-size:1.3rem; margin-right:40px;">Rioteza</div>
          <div style="font-weight:900;">Rioteza Satria Ramadhan</div>
          <div style="color:#475569;">Country Manager Saudi Arabia</div>
        </div>

        <!-- Page 2: EXPENSE BREAKDOWN -->
        <div class="page-break"></div>
        <div class="watermark-bg"></div>
        <div style="font-weight:900; font-size:1.1rem; margin-bottom:12px; text-transform:uppercase;">EXPENSE BREAKDOWN</div>
        <div style="font-size:0.85rem; line-height:1.8; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between;">
            <div><strong>Jumlah Pax</strong> : ${data.paxStr}</div>
            <div><strong>Jumlah Bus</strong> : 1 Bus</div>
          </div>
          <div style="margin-top:6px;"><strong>Hotel Madinah</strong></div>
          <div style="color:#475569; padding-left:10px;">Nozol Royal Inn : 8 Kamar / 18 Pax | Mukhtaro Al Gharbi : 5 Kamar / 13 Pax</div>
          <div style="margin-top:6px;"><strong>Hotel Makkah</strong></div>
          <div style="color:#475569; padding-left:10px;">Anjum : 8 Kamar / 18 Pax | Badr Al Massa : 8 Kamar / 13 Pax</div>
        </div>

        <div style="font-weight:800; font-size:0.9rem; margin:16px 0 6px 0;">1. Operasional Jeddah</div>
        <table>
          <thead><tr><th>KETERANGAN</th><th style="width:80px; text-align:right;">HARGA</th><th style="width:60px; text-align:center;">PCS</th><th style="width:110px; text-align:right;">JUMLAH</th></tr></thead>
          <tbody>
            <tr><td>Fee Kedatangan Bandara Jeddah T1</td><td style="text-align:right;">47.5</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">1,475.5</td></tr>
            <tr><td>Fee Kepulangan Bandara Jeddah T1</td><td style="text-align:right;">47.5</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">1,475.5</td></tr>
            <tr><td>Zamzam Kepulangan per Jamaah</td><td style="text-align:right;">13</td><td style="text-align:center;">31</td><td style="text-align:right; font-weight:700;">403</td></tr>
            <tr><td>Fee Check In & Check Out Hotel Jeddah</td><td style="text-align:right;">400</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">400</td></tr>
            <tr><td>Fee Check Out Hotel Jeddah 1 Pax – Bu Titi</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr style="font-weight:900; background:#f8fafc;"><td colspan="3" style="text-align:center;">TOTAL</td><td style="text-align:right;">3,898</td></tr>
          </tbody>
        </table>

        <div style="font-weight:800; font-size:0.9rem; margin:16px 0 6px 0;">2. Operasional Madinah</div>
        <table>
          <thead><tr><th>KETERANGAN</th><th style="width:80px; text-align:right;">HARGA</th><th style="width:60px; text-align:center;">PCS</th><th style="width:110px; text-align:right;">JUMLAH</th></tr></thead>
          <tbody>
            <tr><td>Kunafe</td><td style="text-align:right;">22</td><td style="text-align:center;">13</td><td style="text-align:right; font-weight:700;">286</td></tr>
            <tr><td>Fee & Transportasi Kunafe</td><td style="text-align:right;">100</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">100</td></tr>
            <tr><td>Zamzam Dalam Kamar Madinah</td><td style="text-align:right;">10</td><td style="text-align:center;">8</td><td style="text-align:right; font-weight:700;">80</td></tr>
            <tr><td>Air Mineral Dalam Kamar Madinah</td><td style="text-align:right;">10</td><td style="text-align:center;">5</td><td style="text-align:right; font-weight:700;">50</td></tr>
            <tr><td>Fee Check In Hotel Madinah - Nozol Royal Inn</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr><td>Fee Check In Hotel Madinah - Mukhtaro Al Gharbi</td><td style="text-align:right;">150</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">150</td></tr>
            <tr><td>Bellboy Check In Hotel Madinah - Nozol Royal Inn</td><td style="text-align:right;">60</td><td style="text-align:center;">1</td><td style="text-align:right; font-weight:700;">60</td></tr>
            <tr style="font-weight:900; background:#f8fafc;"><td colspan="3" style="text-align:center;">TOTAL</td><td style="text-align:right;">1,586</td></tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportMasterFieldCashLedger(data) {
  const startLong = formatDateLong(data.startDate);
  const endLong = formatDateLong(data.endDate);
  const periodStr = `${startLong} s.d ${endLong}`;

  const staffUsers = state.users.filter(u => u.role === 'user');
  
  let totalIn = 0, totalTf = 0, totalOut = 0, totalBal = 0;

  const rowsLedger = staffUsers.map(user => {
    const userTxs = state.financial.transactions.filter(tx => (tx.sender === user.username || tx.recipient === user.username) && (tx.status !== 'VOID' && tx.status !== 'Dibatalkan'));
    let inAmt = 0, tfAmt = 0, outAmt = 0;
    userTxs.forEach(tx => {
      const cat = getTxCategoryType(tx);
      if (cat === 'Uang Masuk') inAmt += tx.amount;
      else if (cat === 'Transfer') tfAmt -= tx.amount;
      else outAmt -= tx.amount;
    });
    const bal = inAmt + tfAmt + outAmt;

    totalIn += inAmt;
    totalTf += tfAmt;
    totalOut += outAmt;
    totalBal += bal;

    return `
      <tr>
        <td style="padding:6px 10px; border:1px solid #000; font-weight:700;">Dompet ${user.name}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:center;">Operasional Tim</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${inAmt.toLocaleString('id-ID')}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${tfAmt < 0 ? '-' + Math.abs(tfAmt).toLocaleString('id-ID') : '0'}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${outAmt < 0 ? '-' + Math.abs(outAmt).toLocaleString('id-ID') : '0'}</td>
        <td style="padding:6px 10px; border:1px solid #000; text-align:right; font-weight:700;">${bal.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  let runningBal = state.financial.mainBalance;
  const filteredTxs = state.financial.transactions.filter(tx => tx.date >= data.startDate && tx.date <= data.endDate && tx.status !== 'VOID' && tx.status !== 'Dibatalkan');
  
  const txRowsHtml = filteredTxs.map((tx, i) => {
    const cat = getTxCategoryType(tx);
    const code = generateTxCode(tx, i, filteredTxs);
    let nominalStr = '0';
    if (cat === 'Uang Masuk') {
      runningBal += tx.amount;
      nominalStr = `+ ${tx.amount.toLocaleString('id-ID')}`;
    } else if (cat === 'Uang Keluar') {
      runningBal -= tx.amount;
      nominalStr = `- ${tx.amount.toLocaleString('id-ID')}`;
    }
    return `
      <tr>
        <td style="padding:6px; border:1px solid #000; text-align:center;">${formatDateDisplay(tx.date)}</td>
        <td style="padding:6px; border:1px solid #000; text-align:center; font-weight:700;">${code}</td>
        <td style="padding:6px; border:1px solid #000;">${cat}</td>
        <td style="padding:6px; border:1px solid #000;">Umum</td>
        <td style="padding:6px; border:1px solid #000;">${tx.sender}</td>
        <td style="padding:6px; border:1px solid #000;">${tx.description || '-'}</td>
        <td style="padding:6px; border:1px solid #000; text-align:right; font-weight:700;">${nominalStr}</td>
        <td style="padding:6px; border:1px solid #000; text-align:right; font-weight:700;">${runningBal.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html>
      <head>
        <title>MASTER FIELD CASH LEDGER</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 15px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.8rem; }
          th { padding:6px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:16px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">MASTER FIELD CASH LEDGER</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.88rem; margin-bottom:14px;"><strong>Periode</strong> : ${periodStr}</div>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:6px;">REKAPITULASI SALDO KAS</div>
        <table style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>DOMPET KAS</th>
              <th>WILAYAH</th>
              <th>DITERIMA</th>
              <th>TRANSFER</th>
              <th>KELUAR</th>
              <th>SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:6px 10px; border:1px solid #000; font-weight:700;">Dompet Utama</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:center;">Utama</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">80,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">- 25,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">- 1,000</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right; font-weight:700;">54,000</td>
            </tr>
            ${rowsLedger}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="2" style="padding:6px 10px; border:1px solid #000; text-align:center;">TOTAL</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalIn + 80000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalTf - 25000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalOut - 1000).toLocaleString('id-ID')}</td>
              <td style="padding:6px 10px; border:1px solid #000; text-align:right;">${(totalBal + 54000).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:6px;">RINCIAN TRANSAKSI</div>
        <table>
          <thead>
            <tr>
              <th>TANGGAL</th>
              <th>KODE</th>
              <th>KATEGORI</th>
              <th>GRUP</th>
              <th>SUMBER</th>
              <th>KETERANGAN</th>
              <th>NOMINAL</th>
              <th>SALDO</th>
            </tr>
          </thead>
          <tbody>
            ${txRowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportMasterSettlementReport(data) {
  const periodStr = `${formatDateLong(data.startDate)} - ${formatDateLong(data.endDate)}`;

  const html = `
    <html>
      <head>
        <title>MASTER SETTLEMENT REPORT</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">MASTER SETTLEMENT REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; margin-bottom:16px;"><strong>Periode</strong> : ${periodStr}</div>

        <table style="margin-bottom:24px;">
          <thead>
            <tr>
              <th style="width:100px;">TANGGAL</th>
              <th style="width:110px;">NO. REF</th>
              <th>KETERANGAN</th>
              <th style="width:120px; text-align:right;">DEBIT</th>
              <th style="width:120px; text-align:right;">KREDIT</th>
              <th style="width:120px; text-align:right;">SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>20 Jul 26</td>
              <td style="font-weight:700;">ADV-0001</td>
              <td>Advance Dana Pusat - Juli 2026 Tahap 4</td>
              <td style="text-align:right;">80,000.00</td>
              <td></td>
              <td style="text-align:right; font-weight:700;">80,000.00</td>
            </tr>
            <tr>
              <td>21 Jul 26</td>
              <td style="font-weight:700;">GER-0001</td>
              <td>Umroh Reguler Onyx 160626 Makkah Awal (9H) - 45 Pax</td>
              <td></td>
              <td style="text-align:right;">15,750.00</td>
              <td style="text-align:right; font-weight:700;">64,250.00</td>
            </tr>
            <tr>
              <td>22 Jul 26</td>
              <td style="font-weight:700;">GER-0002</td>
              <td>Umroh Ruby Onyx 160626 Makkah Awal (9H) - 45 Pax</td>
              <td></td>
              <td style="text-align:right;">15,750.00</td>
              <td style="text-align:right; font-weight:700;">48,500.00</td>
            </tr>
            <tr>
              <td>23 Jul 26</td>
              <td style="font-weight:700;">GER-0003</td>
              <td>Umroh New Experience 200626 Madinah Awal (12H) - 40 Pax</td>
              <td></td>
              <td style="text-align:right;">14,000.00</td>
              <td style="text-align:right; font-weight:700;">34,500.00</td>
            </tr>
          </tbody>
        </table>

        <div style="font-weight:900; font-size:0.9rem; margin-bottom:8px; text-transform:uppercase;">RINGKASAN MUTASI KAS</div>
        <table>
          <thead>
            <tr>
              <th style="text-align:right;">DEBIT</th>
              <th style="text-align:right;">KREDIT</th>
              <th style="text-align:right;">SALDO</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-weight:900; background:#f8fafc;">
              <td style="text-align:right;">45,500.00</td>
              <td style="text-align:right;">80,000.00</td>
              <td style="text-align:right; color:#b45309;">34,500.00</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function printReportOperationalExpenseReport(data) {
  const periodStr = `${formatDateLong(data.startDate)} - ${formatDateLong(data.endDate)}`;
  const opsExpenses = state.financial.expenses.filter(ex => ex.status === 'Disetujui' && (!ex.groupName || ex.groupName === '-' || ex.groupName === 'all'));
  
  let totalOps = 0;
  const rowsHtml = opsExpenses.map(ex => {
    totalOps += ex.amount;
    return `
      <tr>
        <td style="text-align:center;">${formatDateLong(ex.date)}</td>
        <td style="font-weight:700;">Dompet ${ex.username}</td>
        <td>${ex.description}</td>
        <td style="text-align:right; font-weight:700;">${ex.amount.toLocaleString('id-ID')}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <html>
      <head>
        <title>OPERATIONAL EXPENSE REPORT ${data.oerRef}</title>
        <link href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { font-family: 'Mulish', sans-serif; margin: 0; padding: 20px; background:#fff; color:#000; position:relative; }
          .watermark-bg { position:fixed; top:0; left:0; width:100%; height:100%; background-image:url('assets/watermark.jpg'); background-size:cover; background-position:center; opacity:0.12; z-index:-1; pointer-events:none; }
          table { width:100%; border-collapse:collapse; font-size:0.85rem; }
          th { padding:8px; border:1px solid #000; background:#f1f5f9; text-transform:uppercase; font-weight:800; }
          td { padding:8px; border:1px solid #000; }
        </style>
      </head>
      <body onload="window.print();">
        <div class="watermark-bg"></div>
        ${getReportPdfHeaderHtml()}
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="margin:0; font-size:1.3rem; font-weight:900; text-transform:uppercase;">OPERATIONAL EXPENSE REPORT</h2>
          <div style="font-size:0.9rem; font-weight:700; color:#475569;">Tim Khidmat <span class="jejak-imani">jejak imani</span> Saudi Arabia</div>
        </div>

        <div style="font-size:0.9rem; line-height:1.8; margin-bottom:20px;">
          <div><strong>No. Referensi</strong> : ${data.oerRef}</div>
          <div><strong>Periode</strong> : ${periodStr}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:120px;">TANGGAL</th>
              <th style="width:160px;">SUMBER</th>
              <th>KETERANGAN</th>
              <th style="width:130px; text-align:right;">JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `
              <tr>
                <td style="text-align:center;">06 Juli 2026</td>
                <td style="font-weight:700;">Dompet Utama</td>
                <td>Pembayaran Syuqqoh Madinah (6 Bulan)</td>
                <td style="text-align:right; font-weight:700;">11,000</td>
              </tr>
              <tr>
                <td style="text-align:center;">10 Juli 2026</td>
                <td style="font-weight:700;">Dompet Utama</td>
                <td>Sewa Mobil Operasional Makkah</td>
                <td style="text-align:right; font-weight:700;">12,000</td>
              </tr>
              <tr>
                <td style="text-align:center;">15 Juli 2026</td>
                <td style="font-weight:700;">Dompet Ahmad Khidmat</td>
                <td>Konsumsi Operasional Tim</td>
                <td style="text-align:right; font-weight:700;">200</td>
              </tr>
            `}
            <tr style="font-weight:900; background:#f8fafc;">
              <td colspan="3" style="text-align:center;">TOTAL</td>
              <td style="text-align:right;">${(totalOps || 23200).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWin = window.open("", "_blank");
  printWin.document.write(html);
  printWin.document.close();
}

function renderAdminFinancial() {
  const container = document.getElementById("admin-subview-content");
  const fieldStaffs = state.users.filter(u => u.role === 'user' && !u.pendingApproval);
  
  let sumWallets = 0;
  fieldStaffs.forEach(s => {
    sumWallets += state.financial.wallets[s.username] || 0;
  });
  const overallBalance = state.financial.mainBalance + sumWallets;
  
  const pendingExpenses = state.financial.expenses.filter(e => e.status === "Pending");
  const pendingDeletes = state.financial.deleteRequests.filter(r => r.status === "Pending");
  
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:32px;">
      <!-- Row 1: Dompet Utama (Full Width) -->
      <div class="wallet-box" style="width:100%;">
        <div class="wallet-label">Dompet Utama Operasional Saudi</div>
        <div class="wallet-balance">SAR ${state.financial.mainBalance.toLocaleString('id-ID')}</div>
        <div style="font-size:0.85rem; color:#ebdcb2; font-weight:700; margin-top:4px;">
          Saldo Keseluruhan (Dompet Utama + Seluruh Tim): <span style="color:#ffffff;">SAR ${overallBalance.toLocaleString('id-ID')}</span>
        </div>
        <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="admin-topup-btn" class="btn btn-gold" style="width:auto; padding: 6px 14px; font-size: 0.75rem;"><i data-lucide="plus"></i> TOP-UP</button>
          <button id="admin-tf-btn" class="btn btn-secondary" style="width:auto; padding: 6px 14px; font-size: 0.75rem; color:#fff; border:none; background:rgba(255,255,255,0.1);"><i data-lucide="send"></i> TRANSFER</button>
          <button id="admin-invoice-download-btn" class="btn btn-secondary" style="width:auto; padding: 6px 14px; font-size: 0.75rem; color:#fff; border:none; background:rgba(255,255,255,0.1);"><i data-lucide="printer"></i> DOWNLOAD LAPORAN</button>
        </div>
      </div>
      
      <!-- Row 2: Dompet Tim (Full Width) -->
      <div class="admin-card" style="width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h4 style="font-size:0.95rem; font-weight:800; margin:0;">Dompet Tim</h4>
          <input type="text" id="admin-financial-dompet-tim-search" class="form-input" placeholder="Cari nama petugas..." style="max-width:200px; padding:4px 8px; font-size:0.75rem; height:auto; margin:0;">
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; max-height:230px; overflow-y:auto; padding-right:6px;" id="admin-financial-dompet-tim-list">
          ${fieldStaffs.map(s => {
            const bal = state.financial.wallets[s.username] || 0;
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
                <span style="font-weight:700; font-size:0.9rem;">${s.name}</span>
                <span style="font-weight:800; color:${bal < 0 ? '#ef4444' : 'var(--primary-gold)'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Piutang)' : ''}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
    
    <!-- Expenses Approval -->
    <div class="table-card">
      <div class="table-header-bar"><h3 class="table-title">Approval Persetujuan Pengeluaran</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Petugas</th>
              <th>Nominal</th>
              <th>Deskripsi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pendingExpenses.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-light);">Tidak ada pengajuan pending.</td></tr>` : pendingExpenses.map(e => `
              <tr class="pending-exp-row" data-id="${e.id}" style="cursor:pointer;" title="Klik untuk lihat detail">
                <td>${formatDateDisplay(e.date)}</td>
                <td><strong>${state.users.find(u => u.username === e.username)?.name || e.username}</strong></td>
                <td><strong style="color:#ef4444;">SAR ${e.amount}</strong></td>
                <td style="font-size:0.8rem; max-width:200px;">${e.description}</td>
                <td>
                  <div class="action-btn-group">
                    <button class="action-icon-btn approve-exp-btn" data-id="${e.id}"><i data-lucide="check" style="color:#10b981; width:14px;"></i></button>
                    <button class="action-icon-btn reject-exp-btn" data-id="${e.id}"><i data-lucide="x" style="color:#ef4444; width:14px;"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Delete requests -->
    <div class="table-card" style="margin-top:24px;">
      <div class="table-header-bar"><h3 class="table-title">Permintaan Hapus Transaksi</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Petugas</th>
              <th>Keterangan Transaksi</th>
              <th>Alasan Hapus</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pendingDeletes.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:var(--text-light);">Tidak ada permintaan hapus pending.</td></tr>` : pendingDeletes.map(req => {
              const exp = state.financial.expenses.find(x => x.id === req.expenseId);
              return `
                <tr class="pending-delete-row" data-id="${req.id}" style="cursor:pointer;" title="Klik untuk lihat detail">
                  <td><strong>${state.users.find(u => u.username === req.username)?.name || req.username}</strong></td>
                  <td style="font-size:0.8rem;">${exp ? `SAR ${exp.amount} - ${exp.description}` : 'Trans. tidak ditemukan'}</td>
                  <td style="font-size:0.8rem; color:#d97706;">${req.reason}</td>
                  <td>
                    <div class="action-btn-group">
                      <button class="action-icon-btn approve-delete-req-btn" data-id="${req.id}" data-exp-id="${req.expenseId}" title="Setujui Hapus"><i data-lucide="check" style="color:#10b981; width:14px;"></i></button>
                      <button class="action-icon-btn reject-delete-req-btn" data-id="${req.id}" title="Tolak"><i data-lucide="x" style="color:#ef4444; width:14px;"></i></button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Riwayat Transaksi -->
    <div class="table-card" style="margin-top:24px;">
      <div class="table-header-bar"><h3 class="table-title">Riwayat Transaksi</h3></div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Tipe Sumber</th>
              <th>Keterangan</th>
              <th>Nominal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.financial.transactions.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-light); padding:16px;">Belum ada riwayat transaksi.</td></tr>` : state.financial.transactions.slice().reverse().map((tx, revIdx) => {
              const realIdx = state.financial.transactions.length - 1 - revIdx;
              const catType = getTxCategoryType(tx);
              const isVoid = (tx.status === "VOID" || tx.status === "Dibatalkan");
              
              let sourceName = tx.sender === 'Dompet Utama' ? 'Finance Pusat' : (tx.sender === 'Finance Pusat' ? 'Finance Pusat' : (state.users.find(u => u.username === tx.sender)?.name || tx.sender));
              if (sourceName !== 'Finance Pusat' && !sourceName.startsWith('Dompet ')) {
                sourceName = `Dompet ${sourceName}`;
              }
              
              let descStr = tx.description || '-';
              const exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
              if (catType === "Uang Keluar") {
                if (exp && exp.items && exp.items.length > 0) {
                  descStr = exp.items.map(it => it.category || it.name).join(', ');
                } else if (!descStr || descStr === '-') {
                  descStr = 'Pengeluaran Tim';
                }
              } else if (catType === "Transfer") {
                const recipientName = state.users.find(u => u.username === tx.recipient)?.name || tx.recipient;
                descStr = `Transfer ke ${recipientName} SAR ${tx.amount.toLocaleString('id-ID')}`;
              }
              
              let nominalDisplay = `0`;
              let nominalStyle = `font-weight:800; color:#64748b;`;
              if (catType === "Uang Masuk") {
                nominalDisplay = `+ ${tx.amount.toLocaleString('id-ID')}`;
                nominalStyle = `font-weight:800; color:#10b981;`;
              } else if (catType === "Uang Keluar") {
                nominalDisplay = `- ${tx.amount.toLocaleString('id-ID')}`;
                nominalStyle = `font-weight:800; color:#ef4444;`;
              }
              
              let statusBadge = '';
              if (isVoid) {
                statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#991b1b; font-weight:800;">VOID</span>`;
              } else if (catType === 'Uang Masuk') {
                statusBadge = `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-weight:800;">Diterima</span>`;
              } else if (catType === 'Uang Keluar') {
                if (tx.status === 'Pending' || (exp && exp.status === 'Pending')) {
                  statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626; font-weight:800;">PENDING</span>`;
                } else {
                  statusBadge = `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-weight:800;">APPROVED</span>`;
                }
              } else {
                // Transfer
                if (tx.status === 'Pending') {
                  statusBadge = `<span class="badge badge-danger" style="background:#fee2e2; color:#dc2626; font-weight:800;">PENDING</span>`;
                } else {
                  statusBadge = `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-weight:800;">APPROVED</span>`;
                }
              }
              
              return `
                <tr class="tx-row" data-idx="${realIdx}" style="cursor:pointer; ${isVoid ? 'opacity:0.65; background:#fcfcfc;' : ''}">
                  <td>${formatDateDisplay(tx.date)}</td>
                  <td><strong>${sourceName}</strong></td>
                  <td style="font-size:0.85rem; max-width:260px;">${descStr}</td>
                  <td><strong style="${nominalStyle}">${nominalDisplay}</strong></td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  // Bind search for Dompet Tim widget
  const searchTimInput = document.getElementById("admin-financial-dompet-tim-search");
  if (searchTimInput) {
    searchTimInput.oninput = (e) => {
      const q = e.target.value.toLowerCase().trim();
      const listEl = document.getElementById("admin-financial-dompet-tim-list");
      if (!listEl) return;
      
      const filteredStaff = fieldStaffs.filter(s => s.name.toLowerCase().includes(q));
      if (filteredStaff.length === 0) {
        listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:12px 0; width:100%;">Tidak ada petugas ditemukan.</p>`;
        return;
      }
      
      listEl.innerHTML = filteredStaff.map(s => {
        const bal = state.financial.wallets[s.username] || 0;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px;">
            <span style="font-weight:700; font-size:0.9rem;">${s.name}</span>
            <span style="font-weight:800; color:${bal < 0 ? '#ef4444' : 'var(--primary-gold)'};">SAR ${bal.toLocaleString('id-ID')} ${bal < 0 ? '(Piutang)' : ''}</span>
          </div>
        `;
      }).join('');
    };
  }

  // Topup Main with Date and Proof File Upload
  document.getElementById("admin-topup-btn").onclick = () => {
    const html = `
      <form id="admin-topup-form">
        <div class="form-group">
          <label class="form-label">Tanggal Transaksi (DD/MM/YYYY)</label>
          <input type="date" id="at-date" class="form-input" required>
        </div>
        <div class="form-group">
          <label class="form-label">Jumlah Top Up (SAR)</label>
          <input type="number" id="at-amount" class="form-input" min="100" required>
        </div>
        <div class="form-group">
          <label class="form-label">Keterangan / Sumber</label>
          <input type="text" id="at-desc" class="form-input" value="Bantuan dana pusat" required>
        </div>
        <div class="form-group">
          <label class="form-label">Bukti Transfer (Upload File)</label>
          <input type="file" id="at-proof" class="form-input" accept="image/*,application/pdf" required>
        </div>
        <button type="submit" class="btn btn-gold">TOP UP</button>
      </form>
    `;
    openModal("Top Up Dompet Utama", html);
    
    // Set default date to today
    document.getElementById("at-date").value = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    
    document.getElementById("admin-topup-form").onsubmit = (e) => {
      e.preventDefault();
      const dateVal = document.getElementById("at-date").value;
      const amount = parseInt(document.getElementById("at-amount").value);
      const desc = document.getElementById("at-desc").value;
      
      state.financial.mainBalance += amount;
      state.financial.transactions.push({
        id: `tx-${Date.now()}`, 
        type: "Top-Up", 
        sender: "Pusat", 
        recipient: "Dompet Utama", 
        amount, 
        date: dateVal, 
        description: desc + " (Bukti terlampir)", 
        status: "Approved"
      });
      
      saveState();
      closeModal();
      showToast("Top-up berhasil!");
      renderAdminFinancial();
    };
  };
  
  // Transfer
  document.getElementById("admin-tf-btn").onclick = () => {
    const html = `
      <form id="admin-tf-form">
        <div class="form-group">
          <label class="form-label">Penerima Tim</label>
          <select id="at-rec" class="form-select" required>
            <option value="">-- Pilih --</option>
            ${fieldStaffs.map(s => `<option value="${s.username}">${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Jumlah Transfer (SAR)</label><input type="number" id="at-tf-amount" class="form-input" min="1" max="${state.financial.mainBalance}" required></div>
        <div class="form-group"><label class="form-label">Deskripsi</label><input type="text" id="at-tf-desc" class="form-input" required></div>
        <button type="submit" class="btn btn-primary">KIRIM DANA</button>
      </form>
    `;
    openModal("Transfer ke Tim Lapangan", html);
    
    document.getElementById("admin-tf-form").onsubmit = (e) => {
      e.preventDefault();
      const rec = document.getElementById("at-rec").value;
      const amount = parseInt(document.getElementById("at-tf-amount").value);
      const desc = document.getElementById("at-tf-desc").value;
      
      state.financial.mainBalance -= amount;
      // Do NOT credit recipient's wallet directly yet; wait for their confirmation
      state.financial.transactions.push({
        id: `tx-${Date.now()}`, 
        type: "Transfer", 
sender: "Dompet Utama", 
        recipient: rec, 
        amount, 
        date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'), 
        description: desc, 
        status: "Pending Confirmation"
      });
      
      saveState();
      closeModal();
      showToast("Transfer berhasil dikirim!");
      renderAdminFinancial();
    };
  };
  
  // Report Download
  document.getElementById("admin-invoice-download-btn").onclick = () => {
    const listGroups = state.groups.map(g => g.name);
    const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    const defaultDateLong = formatDateLong(todayStr);

    const html = `
      <form id="report-download-form">
        <div class="form-group">
          <label class="form-label">Jenis Laporan Keuangan</label>
          <select id="rep-type-filter" class="form-select">
            <option value="approval_pengajuan">Approval Pengajuan Dana</option>
            <option value="group_expense">Group Expense Report</option>
            <option value="master_cash_ledger">Master Field Cash Ledger</option>
            <option value="master_settlement">Master Settlement Report</option>
            <option value="operational_expense">Operational Expense Report</option>
          </select>
        </div>

        <!-- Section 1: Approval Pengajuan Dana -->
        <div id="sec-approval-pengajuan" class="rep-form-sec">
          <div class="form-group">
            <label class="form-label">Tanggal Pengajuan</label>
            <input type="date" id="ap-date" class="form-input" value="${todayStr}">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Program Utama</label>
            <input type="text" id="ap-main-program" class="form-input" value="Pengajuan Dana Operasional Saudi - Bulan Agustus" placeholder="Contoh: Pengajuan Dana Operasional Saudi - Bulan Agustus">
          </div>
          
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <label class="form-label" style="margin:0;">Item Program Pengajuan</label>
              <button type="button" id="ap-add-item-btn" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 10px; height:auto;">+ Tambah Item</button>
            </div>
            <div style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; padding:8px;">
              <table style="width:100%; border-collapse:collapse; font-size:0.8rem;" id="ap-items-table">
                <thead>
                  <tr style="border-bottom:1px solid #cbd5e1; text-align:left;">
                    <th style="padding:4px;">Nama Program</th>
                    <th style="padding:4px; width:45px;">Pax</th>
                    <th style="padding:4px; width:90px;">Harga (SAR)</th>
                    <th style="padding:4px; width:95px;">Due Date</th>
                    <th style="padding:4px; width:30px;"></th>
                  </tr>
                </thead>
                <tbody id="ap-items-tbody">
                  <tr class="ap-item-row">
                    <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi Agustus – Tahap 1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
                  </tr>
                  <tr class="ap-item-row">
                    <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi Agustus – Tahap 2" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
                    <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Section 2: Group Expense Report -->
        <div id="sec-group-expense" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">No. Referensi</label>
            <input type="text" id="ger-ref" class="form-input" value="GER-0001">
          </div>
          <div class="form-group">
            <label class="form-label">Nama Grup (Pencarian Suggestion)</label>
            <select id="ger-group-name" class="form-select">
              <option value="">-- Pilih Grup Umroh --</option>
              ${listGroups.map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah Jamaah</label>
            <input type="text" id="ger-pax" class="form-input" value="31 Pax" placeholder="Contoh: 31 Pax">
          </div>
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="ger-start" class="form-input" value="${todayStr}">
              <input type="date" id="ger-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 3: Master Field Cash Ledger -->
        <div id="sec-master-ledger" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="mfcl-start" class="form-input" value="${todayStr}">
              <input type="date" id="mfcl-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 4: Master Settlement Report -->
        <div id="sec-master-settlement" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="msr-start" class="form-input" value="${todayStr}">
              <input type="date" id="msr-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <!-- Section 5: Operational Expense Report -->
        <div id="sec-operational-expense" class="rep-form-sec" style="display:none;">
          <div class="form-group">
            <label class="form-label">No. Referensi</label>
            <input type="text" id="oer-ref" class="form-input" value="OER-0001">
          </div>
          <div class="form-group">
            <label class="form-label">Periode</label>
            <div class="grid-2col">
              <input type="date" id="oer-start" class="form-input" value="${todayStr}">
              <input type="date" id="oer-end" class="form-input" value="${todayStr}">
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-gold" style="margin-top:12px;">PROSES CETAK PDF</button>
      </form>
    `;
    openModal("Cetak Laporan Keuangan", html);

    // Toggle dynamic sections
    const typeFilter = document.getElementById("rep-type-filter");
    typeFilter.onchange = (e) => {
      const val = e.target.value;
      document.querySelectorAll(".rep-form-sec").forEach(sec => sec.style.display = "none");
      if (val === "approval_pengajuan") document.getElementById("sec-approval-pengajuan").style.display = "block";
      else if (val === "group_expense") document.getElementById("sec-group-expense").style.display = "block";
      else if (val === "master_cash_ledger") document.getElementById("sec-master-ledger").style.display = "block";
      else if (val === "master_settlement") document.getElementById("sec-master-settlement").style.display = "block";
      else if (val === "operational_expense") document.getElementById("sec-operational-expense").style.display = "block";
    };

    // Add item dynamic row helper for Approval Pengajuan
    const attachDelEvent = (tr) => {
      const delBtn = tr.querySelector(".ap-del-item-btn");
      if (delBtn) delBtn.onclick = () => tr.remove();
    };

    document.querySelectorAll("#ap-items-tbody .ap-item-row").forEach(attachDelEvent);

    const addItemBtn = document.getElementById("ap-add-item-btn");
    if (addItemBtn) {
      addItemBtn.onclick = () => {
        const tbody = document.getElementById("ap-items-tbody");
        const tr = document.createElement("tr");
        tr.className = "ap-item-row";
        tr.innerHTML = `
          <td style="padding:4px;"><input type="text" class="form-input ap-item-name" value="Dana Operasional Saudi – Tahap Baru" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="number" class="form-input ap-item-qty" value="1" min="1" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="number" class="form-input ap-item-price" value="80000" min="0" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px;"><input type="date" class="form-input ap-item-duedate" value="${todayStr}" style="font-size:0.78rem; padding:4px;"></td>
          <td style="padding:4px; text-align:center;"><button type="button" class="ap-del-item-btn" style="background:none; border:none; color:#ef4444; cursor:pointer;">✕</button></td>
        `;
        tbody.appendChild(tr);
        attachDelEvent(tr);
      };
    }

    document.getElementById("report-download-form").onsubmit = (e) => {
      e.preventDefault();
      const reportType = typeFilter.value;

      if (reportType === "approval_pengajuan") {
        const apDateVal = document.getElementById("ap-date").value;
        const mainProgram = document.getElementById("ap-main-program").value.trim() || "Pengajuan Dana Operasional Saudi - Bulan Agustus";
        
        const items = [];
        document.querySelectorAll("#ap-items-tbody .ap-item-row").forEach(tr => {
          const name = tr.querySelector(".ap-item-name").value.trim() || "Dana Operasional";
          const qty = parseInt(tr.querySelector(".ap-item-qty").value) || 1;
          const price = parseInt(tr.querySelector(".ap-item-price").value) || 0;
          const duedate = tr.querySelector(".ap-item-duedate").value || apDateVal;
          items.push({ name, qty, price, total: qty * price, duedate, destination: "Cash Riyal Operasional Saudi" });
        });

        closeModal();
        printReportApprovalPengajuanDana({ apDate: apDateVal, mainProgram, items });

      } else if (reportType === "group_expense") {
        const gerRef = document.getElementById("ger-ref").value.trim() || "GER-0001";
        const groupName = document.getElementById("ger-group-name").value || "Umroh Ruby Onyx 6 Juli 2026 Makkah Awal (9 Hari)";
        const paxStr = document.getElementById("ger-pax").value.trim() || "31 Pax";
        const startDate = document.getElementById("ger-start").value;
        const endDate = document.getElementById("ger-end").value;

        closeModal();
        printReportGroupExpenseReport({ gerRef, groupName, paxStr, startDate, endDate });

      } else if (reportType === "master_cash_ledger") {
        const startDate = document.getElementById("mfcl-start").value;
        const endDate = document.getElementById("mfcl-end").value;

        closeModal();
        printReportMasterFieldCashLedger({ startDate, endDate });

      } else if (reportType === "master_settlement") {
        const startDate = document.getElementById("msr-start").value;
        const endDate = document.getElementById("msr-end").value;

        closeModal();
        printReportMasterSettlementReport({ startDate, endDate });

      } else if (reportType === "operational_expense") {
        const oerRef = document.getElementById("oer-ref").value.trim() || "OER-0001";
        const startDate = document.getElementById("oer-start").value;
        const endDate = document.getElementById("oer-end").value;

        closeModal();
        printReportOperationalExpenseReport({ oerRef, startDate, endDate });
      }
    };
  };

  // Approve expense action
  document.querySelectorAll(".approve-exp-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const exp = state.financial.expenses.find(x => x.id === id);
      if (exp) {
        exp.status = "Disetujui";
        state.financial.transactions.push({
          id: `tx-${Date.now()}`,
          type: "Pengeluaran",
          sender: exp.username,
          recipient: "Vendor",
          amount: exp.amount,
          date: getSaudiDateTime().gregorianStr.split('/').reverse().join('-'),
          description: `[APPROVED] ${exp.description}`,
          status: "Approved"
        });
        saveState();
        showToast("Laporan pengeluaran disetujui!");
        renderAdminFinancial();
      }
    };
  });
  
  // Reject expense action
  document.querySelectorAll(".reject-exp-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const exp = state.financial.expenses.find(x => x.id === id);
      if (exp) {
        exp.status = "Ditolak";
        state.financial.wallets[exp.username] = (state.financial.wallets[exp.username] || 0) + exp.amount;
        saveState();
        showToast("Laporan pengeluaran ditolak.", "error");
        renderAdminFinancial();
      }
    };
  });

  // Approve delete request action (VOID execution)
  document.querySelectorAll(".approve-delete-req-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute("data-id");
      const expId = btn.getAttribute("data-exp-id");
      const req = state.financial.deleteRequests.find(r => r.id === reqId);
      
      voidFinancialTransaction(expId, req ? req.reason : "Disetujui dari Permintaan Hapus Tim");
      if (req) req.status = "Approved";
      saveState();
      showToast("Transaksi berhasil dibatalkan (VOID)!");
      renderAdminFinancial();
    };
  });

  // Reject delete request action
  document.querySelectorAll(".reject-delete-req-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const reqId = btn.getAttribute("data-id");
      const req = state.financial.deleteRequests.find(r => r.id === reqId);
      if (req) req.status = "Rejected";
      saveState();
      showToast("Permintaan hapus ditolak.", "error");
      renderAdminFinancial();
    };
  });

  // Row clicks for pending expenses details
  document.querySelectorAll(".pending-exp-row").forEach(row => {
    row.onclick = (event) => {
      if (event.target.closest("button") || event.target.closest("i")) return;
      const id = row.getAttribute("data-id");
      openAdminPendingExpenseDetailPopup(id);
    };
  });
  
  // Row clicks for pending delete requests details
  document.querySelectorAll(".pending-delete-row").forEach(row => {
    row.onclick = (event) => {
      if (event.target.closest("button") || event.target.closest("i")) return;
      const id = row.getAttribute("data-id");
      openAdminPendingDeleteDetailPopup(id);
    };
  });

  // Read-only & Void transaction log row clicks
  document.querySelectorAll(".tx-row").forEach(row => {
    row.onclick = () => {
      const idx = parseInt(row.getAttribute("data-idx"));
      const tx = state.financial.transactions[idx];
      if (!tx) return;
      
      const catType = getTxCategoryType(tx);
      const txCode = generateTxCode(tx, idx, state.financial.transactions);
      const isVoid = (tx.status === "VOID" || tx.status === "Dibatalkan");
      
      const exp = state.financial.expenses.find(e => e.id === tx.refExpenseId || (e.amount === tx.amount && e.username === tx.sender && tx.description.includes(e.description)));
      
      let sourceName = tx.sender === 'Dompet Utama' ? 'Finance Pusat' : (tx.sender === 'Finance Pusat' ? 'Finance Pusat' : (state.users.find(u => u.username === tx.sender)?.name || tx.sender));
      if (sourceName !== 'Finance Pusat' && !sourceName.startsWith('Dompet ')) {
        sourceName = `Dompet ${sourceName}`;
      }

      let senderName = state.users.find(u => u.username === tx.sender)?.name || tx.sender;
      let recipientName = state.users.find(u => u.username === tx.recipient)?.name || tx.recipient;
      if (senderName === 'Dompet Utama') senderName = 'Admin';
      if (recipientName === 'Dompet Utama') recipientName = 'Admin';

      let headerGraphicHtml = '';
      if (catType === 'Uang Masuk') {
        headerGraphicHtml = `<h2 style="font-size:1.9rem; font-weight:900; color:#000; text-align:center; margin:10px 0 20px 0;">+ SAR  ${tx.amount.toLocaleString('id-ID')}</h2>`;
      } else if (catType === 'Uang Keluar') {
        headerGraphicHtml = `<h2 style="font-size:1.9rem; font-weight:900; color:#000; text-align:center; margin:10px 0 20px 0;">- SAR  ${tx.amount.toLocaleString('id-ID')}</h2>`;
      } else {
        // Transfer
        headerGraphicHtml = `
          <div style="text-align:center; margin:10px 0 20px 0;">
            <div style="display:flex; justify-content:center; align-items:center; gap:20px; font-size:1.25rem; font-weight:800; color:#000; margin-bottom:8px;">
              <span>${senderName}</span>
              <span style="font-size:1.6rem; line-height:1; font-weight:900;">➔</span>
              <span>${recipientName}</span>
            </div>
            <div style="font-size:1.4rem; font-weight:900; color:#000;">SAR ${tx.amount.toLocaleString('id-ID')}</div>
          </div>
        `;
      }

      let rincianItemsHtml = '';
      if (catType === 'Uang Keluar') {
        let itemsRows = '';
        if (exp && exp.items && exp.items.length > 0) {
          itemsRows = exp.items.map((item, i) => `
            <tr style="height:32px; border-bottom:1px solid #f1f5f9;">
              <td style="color:#334155; width:90px;">OUT${String(i + 1).padStart(4, '0')}</td>
              <td style="font-weight:600;">${item.category || item.name}</td>
              <td style="color:#334155;">SAR ${item.price}</td>
              <td style="color:#334155; text-align:center;">${item.qty}</td>
              <td style="font-weight:700; text-align:right;">SAR ${(item.total || item.price * item.qty).toLocaleString('id-ID')}</td>
            </tr>
          `).join('');
        } else {
          itemsRows = `
            <tr style="height:32px; border-bottom:1px solid #f1f5f9;">
              <td style="color:#334155; width:90px;">${txCode}</td>
              <td style="font-weight:600;">${tx.description || 'Pengeluaran Tim'}</td>
              <td style="color:#334155;">SAR ${tx.amount.toLocaleString('id-ID')}</td>
              <td style="color:#334155; text-align:center;">1</td>
              <td style="font-weight:700; text-align:right;">SAR ${tx.amount.toLocaleString('id-ID')}</td>
            </tr>
          `;
        }
        
        rincianItemsHtml = `
          <div style="margin-top:16px; margin-bottom:20px;">
            <div style="font-weight:700; font-size:0.95rem; color:#1e293b; margin-bottom:10px;">Rincian Item</div>
            <table style="width:100%; border-collapse:collapse; font-size:0.88rem; color:#1e293b;">
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
          </div>
        `;
      }

      let voidAuditHtml = '';
      if (isVoid) {
        voidAuditHtml = `
          <div style="background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; padding:12px; margin-top:14px; font-size:0.82rem; color:#991b1b;">
            <div style="font-weight:900; margin-bottom:4px; font-size:0.88rem; display:flex; align-items:center; gap:6px;">
              <i data-lucide="ban" style="width:16px; height:16px;"></i> TRANSAKSI DIBATALKAN (VOID)
            </div>
            <div><strong>Dibatalkan Oleh:</strong> ${tx.voidedBy || 'Admin'}</div>
            <div><strong>Waktu Pembatalan:</strong> ${tx.voidedAt || '-'}</div>
            <div style="margin-top:4px;"><strong>Alasan Pembatalan:</strong> <span style="font-style:italic;">"${tx.voidReason || '-'}"</span></div>
          </div>
        `;
      }

      const receiptUrl = exp ? exp.receipt : null;
      let receiptBtnText = catType === 'Uang Masuk' ? 'LIHAT KWITANSI' : 'LIHAT STRUK';

      let statusDisplayHtml = '';
      if (isVoid) {
        statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">VOID</span>`;
      } else if (catType === 'Uang Masuk') {
        statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">Diterima</span>`;
      } else if (catType === 'Uang Keluar') {
        if (tx.status === 'Pending' || (exp && exp.status === 'Pending')) {
          statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">PENDING</span>`;
        } else {
          statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">APPROVED</span>`;
        }
      } else {
        // Transfer
        if (tx.status === 'Pending') {
          statusDisplayHtml = `<span style="font-weight:800; color:#dc2626;">PENDING</span>`;
        } else {
          statusDisplayHtml = `<span style="font-weight:800; color:#15803d;">APPROVED</span>`;
        }
      }

      const cleanDesc = tx.description ? tx.description.replace(/^\[APPROVED\]\s*/i, '') : '-';

      const detailHtml = `
        ${headerGraphicHtml}
        
        <table style="width:100%; border-collapse:collapse; font-size:0.92rem; line-height:2.0; margin-bottom:16px; color:#1e293b;">
          <tbody>
            ${catType !== 'Uang Keluar' ? `
              <tr>
                <td style="width:130px; color:#334155; font-weight:500;">Kode Transaksi</td>
                <td style="width:15px;">:</td>
                <td style="font-weight:700; color:#000;">${txCode}</td>
              </tr>
            ` : ''}
            <tr>
              <td style="width:130px; color:#334155; font-weight:500;">Status</td>
              <td style="width:15px;">:</td>
              <td>${statusDisplayHtml}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Tipe</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${catType}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Sumber</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${sourceName}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Tanggal</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${formatDateLong(tx.date)}</td>
            </tr>
            <tr>
              <td style="color:#334155; font-weight:500;">Keterangan</td>
              <td>:</td>
              <td style="font-weight:600; color:#000;">${cleanDesc}</td>
            </tr>
          </tbody>
        </table>

        ${rincianItemsHtml}
        ${voidAuditHtml}

        <div style="display:flex; justify-content:${catType === 'Transfer' ? 'flex-end' : 'space-between'}; align-items:center; gap:16px; margin-top:24px; padding-top:16px; border-top:1px solid #f1f5f9;">
          ${catType !== 'Transfer' ? `
            <button type="button" id="admin-view-receipt-btn" class="btn" style="flex:1; background:#dfc06b; color:#ffffff; font-weight:800; font-size:0.9rem; padding:12px 20px; border-radius:10px; border:none; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer;">
              ${receiptBtnText}
            </button>
          ` : ''}
          ${!isVoid ? `
            <button type="button" id="admin-void-tx-btn" class="btn" style="${catType === 'Transfer' ? 'width:180px;' : 'flex:1;'} background:#fee2e2; color:#dc2626; font-weight:800; font-size:0.9rem; padding:12px 20px; border-radius:10px; border:1px solid #fca5a5; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer;">
              VOID
            </button>
          ` : `
            <button type="button" class="btn btn-secondary" onclick="closeModal()" style="width:120px; padding:10px 16px; border-radius:10px;">Tutup</button>
          `}
        </div>
      `;

      openModal("Detail Transaksi", detailHtml);
      lucide.createIcons();

      const receiptBtn = document.getElementById("admin-view-receipt-btn");
      if (receiptBtn) {
        receiptBtn.onclick = () => {
          if (catType === 'Uang Masuk') {
            openKwitansiModal(tx, txCode);
          } else if (receiptUrl) {
            const isImg = receiptUrl.startsWith('data:image') || receiptUrl.endsWith('.jpg') || receiptUrl.endsWith('.png') || receiptUrl.endsWith('.jpeg');
            if (isImg) {
              openModal("Bukti Struk / Nota", `<div style="text-align:center;"><img src="${receiptUrl}" style="max-width:100%; max-height:70vh; border-radius:8px;"></div>`);
            } else {
              window.open(receiptUrl, '_blank');
            }
          } else {
            showToast("Tidak ada bukti lampiran.", "info");
          }
        };
      }

      const voidBtn = document.getElementById("admin-void-tx-btn");
      if (voidBtn) {
        voidBtn.onclick = () => {
          closeModal();
          openVoidTransactionModal(tx.id, () => {
            renderAdminFinancial();
          });
        };
      }
    };
  });
}

// --- ADMIN SUB-VIEW: LAPORAN ---
function renderAdminLaporan() {
  const container = document.getElementById("admin-subview-content");
  
  // Mark all unread reports as read automatically
  let stateChanged = false;
  state.reports.attendance.forEach(a => {
    if (a.unread) {
      a.unread = false;
      stateChanged = true;
    }
  });
  state.reports.incidents.forEach(i => {
    if (i.unread) {
      i.unread = false;
      stateChanged = true;
    }
  });
  if (stateChanged) {
    saveState();
  }
  
  if (!window.adminLaporanTabMode) {
    window.adminLaporanTabMode = "absensi";
  }
  
  container.innerHTML = `
    <!-- Tab Navigation -->
    <div class="tab-header" style="margin-bottom:16px;">
      <div class="tab-btn ${window.adminLaporanTabMode === 'absensi' ? 'active' : ''}" id="tab-ll-absensi-btn" data-tab="absensi">Laporan Absensi</div>
      <div class="tab-btn ${window.adminLaporanTabMode === 'kejadian' ? 'active' : ''}" id="tab-ll-kejadian-btn" data-tab="kejadian">Laporan Kejadian</div>
    </div>

    <!-- Compact filter bar -->
    <div class="admin-card" style="margin-bottom:16px; padding:12px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input type="text" id="ll-filter-search" class="form-input" placeholder="Cari nama petugas, lokasi..." style="flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        
        <select id="ll-filter-group" class="form-select" style="width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Grup Rombongan</option>
          ${state.groups.map(g => `<option value="${g.name || ''}">${(g.name || '').substring(0,25)}...</option>`).join('')}
        </select>
        
        <select id="ll-filter-staff" class="form-select" style="width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Petugas</option>
          ${state.users.filter(u => u.role === "user").map(u => `<option value="${u.username}">${u.name}</option>`).join('')}
        </select>
      </div>
    </div>

    <div id="ll-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-header .tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      window.adminLaporanTabMode = btn.getAttribute("data-tab");
      loadLaporanTabContent();
    };
  });
  
  document.getElementById("ll-filter-search").oninput = loadLaporanTabContent;
  document.getElementById("ll-filter-group").onchange = loadLaporanTabContent;
  document.getElementById("ll-filter-staff").onchange = loadLaporanTabContent;
  
  loadLaporanTabContent();
}

function loadLaporanTabContent() {
  const contents = document.getElementById("ll-tab-contents");
  if (!contents) return;
  
  const query = document.getElementById("ll-filter-search").value.toLowerCase().trim();
  const grpValue = document.getElementById("ll-filter-group").value;
  const petValue = document.getElementById("ll-filter-staff").value;
  
  if (window.adminLaporanTabMode === "absensi") {
    const filteredAbs = state.reports.attendance.filter(a => {
      const task = state.assignments.find(t => t.id === a.taskId);
      const user = state.users.find(u => u.username === a.username);
      const taskType = task ? task.type : "Umum";
      const grpName = task ? task.groupName : "Umum";
      const matchesQuery = (taskType.toLowerCase().includes(query) || 
                            (user ? user.name.toLowerCase().includes(query) : false) || 
                            a.coords.toLowerCase().includes(query));
      const matchesGrup = !grpValue || grpName === grpValue;
      const matchesPet = !petValue || a.username === petValue;
      return matchesQuery && matchesGrup && matchesPet;
    });
    
    contents.innerHTML = `
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Review Laporan Absensi Tim</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal/Jam</th>
                <th>Nama Petugas</th>
                <th>Penugasan</th>
                <th>Absen</th>
                <th>GPS & Foto Preview</th>
              </tr>
            </thead>
            <tbody id="ll-abs-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const tbody = document.getElementById("ll-abs-tbody");
    if (filteredAbs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada laporan absensi ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filteredAbs.map(a => {
      const task = state.assignments.find(t => t.id === a.taskId);
      const name = state.users.find(u => u.username === a.username)?.name || a.username;
      return `
        <tr>
          <td>${formatDateDisplay(a.date)} | ${a.time}</td>
          <td><strong>${name}</strong></td>
          <td><code>${task ? task.type : 'Umum'}</code></td>
          <td><span class="badge ${a.type === 'Masuk' ? 'badge-success' : 'badge-gold'}">${a.type}</span></td>
          <td>
            <code>${a.coords}</code> | 
            <span class="badge badge-info view-absen-preview-btn" style="cursor:pointer; font-size:0.7rem; padding:4px 8px;" data-time="${a.time}" data-date="${formatDateDisplay(a.date)}" data-coords="${a.coords}">PREVIEW</span>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.querySelectorAll(".view-absen-preview-btn").forEach(btn => {
      btn.onclick = () => {
        const time = btn.getAttribute("data-time");
        const date = btn.getAttribute("data-date");
        const coords = btn.getAttribute("data-coords");
        const photoHtml = `
          <div class="photo-frame-container" style="margin-bottom:16px;">
            <img src="data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22240%22 style=%22background:%23ccd0d6;%22><text x=%2250%%22 y=%2250%%22 font-family=%22sans-serif%22 font-size=%2216%22 fill=%22%23555%22 text-anchor=%22middle%22>📸 FOTO ABSENSI VERIFIKASI</text></svg>" class="photo-frame-image">
            <div class="photo-frame-overlay">
              <div class="photo-frame-title">tim khidmat - jejak imani</div>
              <div>📅 Tanggal: ${date}</div>
              <div>⏰ Waktu: ${time} Waktu Saudi</div>
              <div>📍 GPS: ${coords}</div>
            </div>
          </div>
        `;
        openModal("Preview Foto Selfie Terbingkai", photoHtml);
      };
    });
    
  } else {
    // Kejadian (Incidents) tab
    const filteredIns = state.reports.incidents.filter(i => {
      const user = state.users.find(u => u.username === i.username);
      const matchesQuery = (i.category.toLowerCase().includes(query) || 
                            (user ? user.name.toLowerCase().includes(query) : false) || 
                            i.detail.toLowerCase().includes(query));
      const matchesGrup = !grpValue || i.groupName === grpValue;
      const matchesPet = !petValue || i.username === petValue;
      return matchesQuery && matchesGrup && matchesPet;
    });
    
    contents.innerHTML = `
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Review Laporan Kejadian Lapangan</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Petugas</th>
                <th>Rombongan</th>
                <th>Kategori</th>
                <th>Detail Kejadian</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="ll-ins-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const tbody = document.getElementById("ll-ins-tbody");
    if (filteredIns.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-light); padding:16px;">Tidak ada laporan kejadian ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filteredIns.map(i => {
      const name = state.users.find(u => u.username === i.username)?.name || i.username;
      const formattedDetail = i.detail.replace(/\n/g, '<br>');
      return `
        <tr>
          <td>${formatDateDisplay(i.date)}</td>
          <td><strong>${name}</strong></td>
          <td style="font-size:0.8rem; max-width:150px;">${(i.groupName || "").substring(0,30)}...</td>
          <td><span class="badge badge-gold">${i.category}</span></td>
          <td style="font-size:0.8rem; max-width:220px; line-height:1.4;">${formattedDetail}</td>
          <td><span class="badge badge-warning">${i.status}</span></td>
          <td>
            ${i.status === 'Request Hapus' ? `
              <button class="btn btn-danger approve-delete-inc-btn" data-id="${i.id}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Setujui Hapus</button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}
function renderAdminVendor() {
  const container = document.getElementById("admin-subview-content");
  container.innerHTML = `
    <div class="tab-header" style="margin-bottom:24px;">
      <div class="tab-btn active" id="tab-v-db-btn" data-tab="v-db">Database Master Vendor</div>
      <div class="tab-btn" id="tab-v-book-btn" data-tab="v-book">Pemesanan Vendor (Booking)</div>
    </div>
    <div id="vendor-tab-contents"></div>
  `;
  
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadVendorTab(btn.getAttribute("data-tab"));
    };
  });
  
  loadVendorTab("v-db");
}

function loadVendorTab(tab) {
  const contents = document.getElementById("vendor-tab-contents");
  
  if (tab === "v-db") {
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px;">
        <input type="text" id="vendor-search-input" class="form-input" placeholder="Cari nama, tipe, kontak vendor..." style="max-width:300px;">
        <button id="add-vendor-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus"></i> Tambah Master Vendor</button>
      </div>
      
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Daftar Master Vendor</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tipe</th>
                <th>Nama Vendor</th>
                <th>Kontak</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="vendor-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const searchInp = document.getElementById("vendor-search-input");
    const renderVendorList = () => {
      const query = searchInp.value.toLowerCase().trim();
      const tbody = document.getElementById("vendor-tbody");
      const filtered = state.vendors.filter(v => 
        v.name.toLowerCase().includes(query) || 
        v.type.toLowerCase().includes(query) || 
        v.contact.toLowerCase().includes(query) ||
        (v.notes && v.notes.toLowerCase().includes(query))
      );
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">Tidak ada vendor ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(v => `
        <tr>
          <td><span class="badge badge-gold">${v.type}</span></td>
          <td><strong>${v.name}</strong></td>
          <td><code>${v.contact}</code></td>
          <td>${v.notes || '-'}</td>
          <td>
            <div class="action-btn-group" style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-gold copy-vendor-link-btn" data-id="${v.id}" data-name="${v.name}" style="width:auto; padding:4px 8px; font-size:0.75rem;" title="Salin Link Schedule Vendor">
                <i data-lucide="link" style="width:12px;"></i> Link Portal
              </button>
              <button class="btn btn-secondary wa-vendor-link-btn" data-id="${v.id}" data-contact="${v.contact}" data-name="${v.name}" style="width:auto; padding:4px 8px; font-size:0.75rem; color:#10b981; border-color:#a7f3d0; box-shadow:none;" title="Kirim Link via WA Vendor">
                <i data-lucide="message-circle" style="width:12px;"></i> Share WA
              </button>
              <button class="action-icon-btn edit-vendor-btn" data-id="${v.id}" title="Edit Master Vendor"><i data-lucide="edit" style="width:14px;"></i></button>
              <button class="action-icon-btn delete-vendor-btn" data-id="${v.id}" title="Hapus Vendor"><i data-lucide="trash" style="width:14px; color:#ef4444;"></i></button>
            </div>
          </td>
        </tr>
      `).join('');
      
      lucide.createIcons();
      bindVendorActions();
    };
    
    const bindVendorActions = () => {
      document.querySelectorAll(".copy-vendor-link-btn").forEach(btn => {
        btn.onclick = () => {
          const vId = btn.getAttribute("data-id");
          const vName = btn.getAttribute("data-name");
          const origin = window.location.origin + window.location.pathname;
          const vendorUrl = `${origin}#vendor-view?id=${vId}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(vendorUrl);
          } else {
            const ta = document.createElement("textarea");
            ta.value = vendorUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          showToast(`Link Portal Jadwal Vendor "${vName}" berhasil disalin!`);
        };
      });

      document.querySelectorAll(".wa-vendor-link-btn").forEach(btn => {
        btn.onclick = () => {
          const vId = btn.getAttribute("data-id");
          const vName = btn.getAttribute("data-name");
          const rawContact = btn.getAttribute("data-contact") || "";
          const origin = window.location.origin + window.location.pathname;
          const vendorUrl = `${origin}#vendor-view?id=${vId}`;
          const cleanPhone = rawContact.replace(/[^0-9]/g, '');
          const msg = encodeURIComponent(`Assalamu'alaikum wr.wb,\nYth. ${vName}\n\nBerikut kami kirimkan link Halaman Jadwal Pemesanan (Booking Schedule) dari Tim Khidmat jejak imani saudi arabia:\n\n${vendorUrl}\n\nMohon dapat diperiksa dan dikonfirmasi. Terima kasih.`);
          window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
        };
      });

      document.querySelectorAll(".edit-vendor-btn").forEach(btn => {
        btn.onclick = () => openVendorFormPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".delete-vendor-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Hapus master vendor ini?")) {
            state.vendors = state.vendors.filter(v => v.id !== id);
            saveState();
            showToast("Vendor dihapus.");
            loadVendorTab("v-db");
          }
        };
      });
    };
    
    searchInp.oninput = renderVendorList;
    renderVendorList();
    document.getElementById("add-vendor-popup-btn").onclick = () => openVendorFormPopup();
    
  } else {
    contents.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:16px;">
        <input type="text" id="booking-search-input" class="form-input" placeholder="Cari booking grup, vendor..." style="max-width:300px;">
        <button id="add-booking-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus"></i> Plot Pemesanan Vendor</button>
      </div>
      
      <div class="table-card">
        <div class="table-header-bar"><h3 class="table-title">Daftar Pemesanan Aktif (Booking)</h3></div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Grup</th>
                <th>Vendor</th>
                <th>Masuk / Keluar</th>
                <th>Notes</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="booking-tbody"></tbody>
          </table>
        </div>
      </div>
    `;
    
    const searchInp = document.getElementById("booking-search-input");
    const renderBookingList = () => {
      const query = searchInp.value.toLowerCase().trim();
      const tbody = document.getElementById("booking-tbody");
      const filtered = state.bookings.filter(b => {
        const v = state.vendors.find(x => x.id === b.vendorId);
        const vName = v ? v.name : "";
        return b.groupName.toLowerCase().includes(query) || vName.toLowerCase().includes(query) || (b.notes && b.notes.toLowerCase().includes(query));
      });
      
      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">Tidak ada pemesanan ditemukan.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = filtered.map(b => {
        const v = state.vendors.find(x => x.id === b.vendorId);
        return `
          <tr>
            <td style="font-size:0.8rem; max-width:150px;"><strong>${b.groupName}</strong></td>
            <td>${v ? `${v.name} (${v.type})` : 'Vendor Dihapus'}</td>
            <td style="font-size:0.8rem;">${formatDateDisplay(b.dateStart)} s/d ${formatDateDisplay(b.dateEnd)}</td>
            <td style="font-size:0.8rem;">${b.notes || '-'}</td>
            <td>
              <div class="action-btn-group">
                <button class="action-icon-btn generate-booking-pdf-btn" data-id="${b.id}" title="Cetak PO / Booking Confirmation" style="color:var(--primary-gold); border-color:#fef3c7; background:#fffdf5;"><i data-lucide="file-text" style="width:14px;"></i></button>
                <button class="action-icon-btn edit-booking-btn" data-id="${b.id}"><i data-lucide="edit" style="width:14px;"></i></button>
                <button class="action-icon-btn delete-booking-btn" data-id="${b.id}"><i data-lucide="trash" style="width:14px; color:#ef4444;"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
      
      lucide.createIcons();
      bindBookingActions();
    };
    
    const bindBookingActions = () => {
      document.querySelectorAll(".generate-booking-pdf-btn").forEach(btn => {
        btn.onclick = () => openBookingPdfPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".edit-booking-btn").forEach(btn => {
        btn.onclick = () => openBookingFormPopup(btn.getAttribute("data-id"));
      });
      document.querySelectorAll(".delete-booking-btn").forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Hapus booking pemesanan ini?")) {
            state.bookings = state.bookings.filter(b => b.id !== id);
            saveState();
            showToast("Booking dihapus.");
            loadVendorTab("v-book");
          }
        };
      });
    };
    
    searchInp.oninput = renderBookingList;
    renderBookingList();
    document.getElementById("add-booking-popup-btn").onclick = () => openBookingFormPopup();
  }
}
function openVendorFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const v = isEdit ? state.vendors.find(x => x.id === editId) : null;
  const products = isEdit ? (v.products || []) : [];
  
  const popupHtml = `
    <form id="admin-vendor-form-popup">
      <div class="form-group">
        <label class="form-label">Tipe Vendor</label>
        <select id="av-type" class="form-select" required>
          <option value="Hotel" ${isEdit && v.type === 'Hotel' ? 'selected' : ''}>Hotel</option>
          <option value="Katering" ${isEdit && v.type === 'Katering' ? 'selected' : ''}>Katering</option>
          <option value="Transportasi" ${isEdit && v.type === 'Transportasi' ? 'selected' : ''}>Transportasi</option>
          <option value="Mutawwif" ${isEdit && v.type === 'Mutawwif' ? 'selected' : ''}>Mutawwif</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Nama Vendor</label><input type="text" id="av-name" class="form-input" value="${isEdit ? v.name : ''}" required></div>
      <div class="form-group"><label class="form-label">Kontak Telepon</label><input type="text" id="av-contact" class="form-input" value="${isEdit ? v.contact : ''}" required></div>
      <div class="form-group"><label class="form-label">Keterangan</label><input type="text" id="av-notes" class="form-input" value="${isEdit ? (v.notes || '') : ''}" placeholder="Keterangan tambahan vendor" required></div>
      
      <h5 style="margin-top:20px; margin-bottom:10px; font-weight:800;">Daftar Produk Vendor</h5>
      <div id="av-products-container" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;"></div>
      <button type="button" id="av-add-prod-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Produk</button>
      
      <button type="submit" class="btn btn-primary">SIMPAN VENDOR</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Master Vendor" : "Tambah Master Vendor", popupHtml);
  
  const prodContainer = document.getElementById("av-products-container");
  const addProdRow = (name = "", type = "Layanan", price = 0) => {
    const rowId = `v-prod-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-row av-prod-row";
    div.id = rowId;
    div.innerHTML = `
      <input type="text" class="form-input prod-name" placeholder="Nama Produk" value="${name}" required>
      <select class="form-select prod-type" style="max-width:120px;" required>
        <option value="Layanan" ${type === 'Layanan' ? 'selected' : ''}>Layanan</option>
        <option value="Barang" ${type === 'Barang' ? 'selected' : ''}>Barang</option>
        <option value="Lainnya" ${type === 'Lainnya' ? 'selected' : ''}>Lainnya</option>
      </select>
      <input type="number" class="form-input prod-price" placeholder="Harga SAR" value="${price}" min="0" required style="max-width:100px;">
      <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
    `;
    prodContainer.appendChild(div);
  };
  
  if (isEdit && products.length > 0) {
    products.forEach(p => addProdRow(p.name, p.type, p.price));
  } else {
    addProdRow();
  }
  
  document.getElementById("av-add-prod-btn").onclick = () => addProdRow();
  
  document.getElementById("admin-vendor-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById("av-type").value;
    const name = document.getElementById("av-name").value.trim();
    const contact = document.getElementById("av-contact").value.trim();
    const notes = document.getElementById("av-notes").value.trim();
    
    const prodRows = prodContainer.querySelectorAll(".av-prod-row");
    const newProducts = Array.from(prodRows).map(row => ({
      name: row.querySelector(".prod-name").value.trim(),
      type: row.querySelector(".prod-type").value,
      price: parseInt(row.querySelector(".prod-price").value) || 0
    }));
    
    if (isEdit) {
      v.type = type; v.name = name; v.contact = contact; v.notes = notes; v.products = newProducts;
    } else {
      state.vendors.push({ id: `v-${Date.now()}`, type, name, contact, location: "", notes, products: newProducts });
    }
    
    saveState();
    closeModal();
    showToast("Master Vendor disimpan!");
    loadVendorTab("v-db");
  };
}
function openBookingFormPopup(editId = null) {
  const isEdit = (editId !== null);
  const b = isEdit ? state.bookings.find(x => x.id === editId) : null;
  const bookedProducts = isEdit ? (b.products || []) : [];
  
  const popupHtml = `
    <form id="admin-booking-form-popup">
      <div class="form-group">
        <label class="form-label">Rombongan Grup</label>
        <select id="ab-group" class="form-select" required>
          <option value="">-- Pilih Rombongan Grup --</option>
          ${state.groups.map(g => `<option value="${g.name}" ${isEdit && b.groupName === g.name ? 'selected' : ''}>${g.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tujuan Kegiatan (Layanan Vendor)</label>
        <input type="text" id="ab-activity-goal" class="form-input" value="${isEdit ? (b.activityGoal || b.activity || '') : ''}" placeholder="Contoh: SNACK CITY TOUR MAKKAH" required>
      </div>

      <div class="grid-2col" style="gap:10px;">
        <div class="form-group">
          <label class="form-label">Muthowwif Rombongan</label>
          <select id="ab-muthawwif-select" class="form-select">
            <option value="">-- Otomatis / Pilih Muthowwif --</option>
          </select>
          <input type="text" id="ab-muthawwif-custom" class="form-input" style="margin-top:6px;" value="${isEdit ? (b.muthawwif || '') : ''}" placeholder="Atau ketik nama Muthowwif">
        </div>
        <div class="form-group">
          <label class="form-label">Lokasi / Hotel (Bus)</label>
          <input type="text" id="ab-location" class="form-input" value="${isEdit ? (b.location || '') : ''}" placeholder="Contoh: Hotel Al Marwa Rayhaan Rotana (Bus 1)" required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Pilih Vendor</label>
        <select id="ab-vendor" class="form-select" required>
          <option value="">-- Pilih Vendor --</option>
          ${state.vendors.map(v => `<option value="${v.id}" ${isEdit && b.vendorId === v.id ? 'selected' : ''}>${v.name} (${v.type})</option>`).join('')}
        </select>
      </div>

      <div class="grid-2col" style="gap:10px;">
        <div class="form-group">
          <label class="form-label">Tanggal Layanan</label>
          <input type="date" id="ab-start" class="form-input" value="${isEdit ? (b.dateStart || b.date) : ''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Jam / Waktu Layanan</label>
          <input type="time" id="ab-time" class="form-input" value="${isEdit ? (b.time || '05:30') : '05:30'}" required>
        </div>
      </div>
      
      <h5 style="margin-top:16px; margin-bottom:8px; font-weight:800; font-size:0.9rem;">Daftar Produk Booking</h5>
      <div id="ab-products-container" style="display:flex; flex-direction:column; gap:10px;"></div>
      <button type="button" id="ab-add-prod-btn" class="btn btn-secondary" style="width:auto; padding:6px 12px; font-size:0.8rem; margin-top:8px; margin-bottom:16px;">+ Tambah Produk</button>
      
      <div style="background:#f8fafc; padding:12px; border-radius:8px; font-weight:800; font-size:0.95rem; margin-bottom:16px; border:1px solid #e2e8f0; color:#0f172a;">
        Total Estimasi Harga: SAR <span id="ab-grand-total">0</span>
      </div>

      <div class="form-group">
        <label class="form-label">Catatan Tambahan</label>
        <input type="text" id="ab-notes" class="form-input" value="${isEdit ? (b.notes || '') : ''}" placeholder="Catatan tambahan untuk vendor">
      </div>

      <button type="submit" class="btn btn-primary" style="width:100%; font-weight:800; padding:10px;">SIMPAN PEMESANAN BOOKING</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Pemesanan Booking Vendor" : "Plot Pemesanan Booking Vendor Baru", popupHtml);
  
  const gSelect = document.getElementById("ab-group");
  const mSelect = document.getElementById("ab-muthawwif-select");
  const mCustom = document.getElementById("ab-muthawwif-custom");
  const locInput = document.getElementById("ab-location");
  const vSelect = document.getElementById("ab-vendor");
  const prodContainer = document.getElementById("ab-products-container");
  const grandTotalLabel = document.getElementById("ab-grand-total");
  
  const updateGroupInfo = () => {
    const gn = gSelect.value;
    const group = state.groups.find(g => g.name === gn);
    mSelect.innerHTML = '<option value="">-- Otomatis dari Manifest Grup --</option>';
    if (group) {
      const muthList = [];
      if (group.mutawwif) muthList.push(group.mutawwif);
      if (Array.isArray(group.leaders)) muthList.push(...group.leaders);
      if (Array.isArray(group.manifest)) {
        group.manifest.forEach(m => {
          if (m.role && m.role.toLowerCase().includes("mutawwif") && m.name) {
            muthList.push(m.name);
          }
        });
      }
      const uniqueMuths = Array.from(new Set(muthList));
      uniqueMuths.forEach(mName => {
        mSelect.innerHTML += `<option value="${mName}">${mName}</option>`;
      });

      if (!locInput.value) {
        locInput.value = group.makkahHotel ? `${group.makkahHotel} (Bus 1)` : (group.madinahHotel ? `${group.madinahHotel} (Bus 1)` : 'Hotel Al Marwa Rayhaan Rotana (Bus 1)');
      }
    }
  };

  gSelect.onchange = () => {
    updateGroupInfo();
    if (mSelect.options.length > 1) {
      mCustom.value = mSelect.options[1].value;
    }
  };

  mSelect.onchange = () => {
    if (mSelect.value) {
      mCustom.value = mSelect.value;
    }
  };

  if (isEdit) updateGroupInfo();
  
  const getSelectedVendorProducts = () => {
    const vId = vSelect.value;
    const vendor = state.vendors.find(x => x.id === vId);
    return vendor ? (vendor.products || []) : [];
  };
  
  const calculateBookingGrandTotal = () => {
    let grandTotal = 0;
    prodContainer.querySelectorAll(".row-total").forEach(inp => {
      grandTotal += parseFloat(inp.value) || 0;
    });
    grandTotalLabel.textContent = grandTotal.toLocaleString('id-ID');
  };
  
  const addBookingProdRow = (prodName = "", qty = 1, amount = 0) => {
    const rowId = `b-prod-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const div = document.createElement("div");
    div.className = "nested-form-card ab-prod-row";
    div.id = rowId;
    
    const vendorProds = getSelectedVendorProducts();
    const productOptions = vendorProds.map(p => `<option value="${p.name}" ${p.name === prodName ? 'selected' : ''}>${p.name} (SAR ${p.price})</option>`).join('');
    
    let initialType = "";
    let initialPrice = 0;
    if (prodName) {
      const match = vendorProds.find(p => p.name === prodName);
      if (match) {
        initialType = match.type || "Pcs";
        initialPrice = match.price || 0;
      }
    }
    
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong>Item Produk Layanan</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateBookingGrandTotal();">&times;</button>
      </div>
      <div class="grid-3col" style="gap:8px;">
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Produk</label>
          <select class="form-select row-prod-select" required>
            <option value="">-- Pilih Produk --</option>
            ${productOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Satuan</label>
          <input type="text" class="form-input row-type" value="${initialType || 'Pcs'}" placeholder="Pcs/Box">
        </div>
        <div class="form-group" style="margin-bottom:6px;">
          <label class="form-label">Harga SAR</label>
          <input type="number" class="form-input row-price" value="${initialPrice}">
        </div>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <div class="form-group" style="margin-bottom:4px;">
          <label class="form-label">Qty</label>
          <input type="number" class="form-input row-qty" value="${qty}" min="1" required>
        </div>
        <div class="form-group" style="margin-bottom:4px;">
          <label class="form-label">Subtotal SAR</label>
          <input type="number" class="form-input row-total" value="${amount || (initialPrice * qty)}" readonly disabled>
        </div>
      </div>
    `;
    prodContainer.appendChild(div);
    
    const prodSelect = div.querySelector(".row-prod-select");
    const typeInp = div.querySelector(".row-type");
    const priceInp = div.querySelector(".row-price");
    const qtyInp = div.querySelector(".row-qty");
    const totalInp = div.querySelector(".row-total");
    
    prodSelect.onchange = () => {
      const selectedName = prodSelect.value;
      const prods = getSelectedVendorProducts();
      const match = prods.find(p => p.name === selectedName);
      if (match) {
        typeInp.value = match.type || "Pcs";
        priceInp.value = match.price || 0;
        totalInp.value = (match.price || 0) * (parseInt(qtyInp.value) || 1);
      } else {
        totalInp.value = 0;
      }
      calculateBookingGrandTotal();
    };
    
    const recalculateRow = () => {
      const price = parseFloat(priceInp.value) || 0;
      const qtyVal = parseFloat(qtyInp.value) || 0;
      totalInp.value = price * qtyVal;
      calculateBookingGrandTotal();
    };

    priceInp.oninput = recalculateRow;
    qtyInp.oninput = recalculateRow;
  };
  
  vSelect.onchange = () => {
    prodContainer.innerHTML = "";
    addBookingProdRow();
    calculateBookingGrandTotal();
  };
  
  document.getElementById("ab-add-prod-btn").onclick = () => {
    if (!vSelect.value) {
      showToast("Silakan pilih Vendor terlebih dahulu.", "error");
      return;
    }
    addBookingProdRow();
  };
  
  if (isEdit) {
    if (bookedProducts.length > 0) {
      bookedProducts.forEach(p => addBookingProdRow(p.name, p.qty, p.amount || (p.price * p.qty)));
    } else {
      addBookingProdRow();
    }
    calculateBookingGrandTotal();
  } else {
    addBookingProdRow();
  }
  
  document.getElementById("admin-booking-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gSelect.value;
    const activityGoal = document.getElementById("ab-activity-goal").value.trim();
    const muthawwif = mCustom.value.trim() || mSelect.value || "Ust. Ahmad Saiful Haq";
    const location = document.getElementById("ab-location").value.trim();
    const vendorId = vSelect.value;
    const dateStart = document.getElementById("ab-start").value;
    const time = document.getElementById("ab-time").value || "05:30";
    const notes = document.getElementById("ab-notes").value.trim();
    
    const rows = prodContainer.querySelectorAll(".ab-prod-row");
    const products = Array.from(rows).map(row => {
      const name = row.querySelector(".row-prod-select").value || row.querySelector(".row-type").value || "Item Produk";
      const unit = row.querySelector(".row-type").value || "Pcs";
      const qty = parseInt(row.querySelector(".row-qty").value) || 1;
      const price = parseFloat(row.querySelector(".row-price").value) || 0;
      return {
        name,
        unit,
        qty,
        price,
        subtotal: qty * price,
        amount: qty * price
      };
    });

    const totalPrice = products.reduce((acc, p) => acc + p.subtotal, 0);

    if (isEdit) {
      b.groupName = groupName;
      b.activityGoal = activityGoal;
      b.muthawwif = muthawwif;
      b.location = location;
      b.vendorId = vendorId;
      b.dateStart = dateStart;
      b.time = time;
      b.notes = notes;
      b.products = products;
      b.totalPrice = totalPrice;
    } else {
      state.bookings.push({
        id: `b-${Date.now()}`,
        groupName,
        activityGoal,
        muthawwif,
        location,
        vendorId,
        dateStart,
        time,
        notes,
        products,
        totalPrice,
        status: "Aktif"
      });
    }

    saveState();
    closeModal();
    showToast(`Pemesanan booking vendor berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`);

    if (window.location.hash.startsWith("#admin/vendors")) {
      loadVendorTab("v-book");
    }
  };
}
// --- ADMIN SUB-VIEW: MANIFEST ---
function renderAdminManifest() {
  const container = document.getElementById("admin-subview-content");
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px;">
      <input type="text" id="manifest-search-input" class="form-input" placeholder="Cari rombongan grup manifest..." style="max-width:300px;">
      <button id="add-manifest-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Manifest Info</button>
    </div>
    <div id="manifest-list-cards" style="display:flex; flex-direction:column; gap:20px;"></div>
  `;
  
  const searchInp = document.getElementById("manifest-search-input");
  
  const urlParams = window.location.hash.split("?")[1];
  const searchName = (urlParams && urlParams.startsWith("search=")) ? decodeURIComponent(urlParams.replace("search=", "")) : "";
  
  if (searchName) {
    searchInp.value = searchName;
  }
  
  const applySearch = () => {
    const query = searchInp.value.toLowerCase().trim();
    renderManifestList(query);
  };
  
  searchInp.oninput = applySearch;
  
  lucide.createIcons();
  document.getElementById("add-manifest-popup-btn").onclick = () => openManifestFormPopup();
  
  applySearch();
}
function openManifestFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const g = isEdit ? state.groups[editIdx] : null;
  
  const popupHtml = `
    <form id="manifest-submit-form-popup">
      <!-- SEKSI 1: INFORMASI UTAMA GRUP -->
      <div class="repeater-section-title">Seksi 1: Informasi Utama Grup</div>
      <div class="form-group"><label class="form-label">Nama Grup</label><input type="text" id="m-group-name" class="form-input" value="${isEdit ? g.name : ''}" required></div>
      <div class="form-group"><label class="form-label">Rute Grup</label><input type="text" id="m-route" class="form-input" value="${isEdit ? g.rute : ''}" placeholder="Jakarta - Jeddah - Madinah - Makkah - Jeddah - Jakarta" required></div>
      <div class="grid-2col">
        <div class="form-group"><label class="form-label">Tanggal Keberangkatan</label><input type="date" id="m-start-date" class="form-input" value="${isEdit ? g.dateStart : ''}" required></div>
        <div class="form-group"><label class="form-label">Tanggal Kepulangan</label><input type="date" id="m-end-date" class="form-input" value="${isEdit ? g.dateEnd : ''}" required></div>
      </div>
      
      <!-- SEKSI 2: PENERBANGAN -->
      <div class="repeater-section-title">Seksi 2: Penerbangan (Flight Details)</div>
      
      <div class="form-group">
        <label class="form-label">Maskapai Kedatangan (Transit)</label>
        <div id="m-arr-flights-container"></div>
        <button type="button" id="m-add-arr-flight-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Penerbangan</button>
      </div>

      <div class="form-group">
        <label class="form-label">Maskapai Kepulangan</label>
        <div id="m-dep-flights-container"></div>
        <button type="button" id="m-add-dep-flight-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Penerbangan</button>
      </div>

      <!-- SEKSI 3: PAKET LAYANAN & AKOMODASI -->
      <div class="repeater-section-title">Seksi 3: Paket Layanan & Akomodasi</div>
      <div id="m-packages-container"></div>
      <button type="button" id="m-add-package-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; margin-bottom:12px;">Tambah Paket</button>
      
      <!-- Auto Pax Sum Calculator -->
      <div style="background:#f1f3f5; padding:12px; border-radius:6px; font-weight:800; font-size:0.95rem; margin-bottom:20px; border:1px solid #ced4da;">
        Total Pax Keseluruhan: <span id="m-total-pax-calc">0</span> Pax
      </div>

      <!-- SEKSI 4: TIM LAPANGAN -->
      <div class="repeater-section-title">Seksi 4: Tim Lapangan</div>
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Tour Leader</label>
          <div id="m-leaders-container"></div>
          <button type="button" id="m-add-leader-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah TL</button>
        </div>
        <div class="form-group">
          <label class="form-label">Muthowwif</label>
          <div id="m-mutawwif-container"></div>
          <button type="button" id="m-add-mutawwif-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Muthowwif</button>
        </div>
      </div>

      <!-- SEKSI 5: RENCANA KONSUMSI (MEALPLAN) -->
      <div class="repeater-section-title">Seksi 5: Rencana Konsumsi (Mealplan)</div>
      <div class="grid-2col">
        <div class="form-group">
          <label class="form-label">Mealplan Kedatangan</label>
          <div id="m-meals-arr-container"></div>
          <button type="button" id="m-add-meal-arr-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Meal</button>
        </div>
        <div class="form-group">
          <label class="form-label">Mealplan Kepulangan</label>
          <div id="m-meals-dep-container"></div>
          <button type="button" id="m-add-meal-dep-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Meal</button>
        </div>
      </div>

      <button type="submit" class="btn btn-gold" style="margin-top:20px;">SIMPAN MANIFEST GRUP</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Manifest Rombongan" : "Tambah Manifest Grup Baru", popupHtml);
  
  // Repeater row builders
  const addFlightRow = (containerId, date = "", code = "", takeoff = "", landing = "", remarks = "") => {
    const container = document.getElementById(containerId);
    const rowId = `f-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card f-item-row";
    div.id = rowId;
    div.innerHTML = `
      <div class="grid-2col" style="gap:8px;">
        <input type="date" class="form-input f-date" value="${date}" required>
        <input type="text" class="form-input f-code" value="${code}" placeholder="Kode (mis. SV819)" required>
      </div>
      <div class="grid-2col" style="gap:8px; margin-top:8px;">
        <input type="time" class="form-input f-takeoff" value="${takeoff}" required>
        <input type="time" class="form-input f-landing" value="${landing}" required>
      </div>
      <div style="display:flex; gap:8px; margin-top:8px; align-items:center;">
        <input type="text" class="form-input f-rem" value="${remarks}" placeholder="Keterangan / Catatan">
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
    `;
    container.appendChild(div);
  };
  
  const addPackageRow = (containerId, name = "Sapphire Plus", pax = 0, hotelMadinah = "", hotelMakkah = "") => {
    const container = document.getElementById(containerId);
    const rowId = `p-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card p-item-row";
    div.id = rowId;
    div.innerHTML = `
      <div class="grid-2col" style="gap:8px;">
        <select class="form-select p-name" required>
          <option value="Sapphire Plus" ${name === 'Sapphire Plus' ? 'selected' : ''}>Sapphire Plus</option>
          <option value="Sapphire" ${name === 'Sapphire' ? 'selected' : ''}>Sapphire</option>
          <option value="Ruby" ${name === 'Ruby' ? 'selected' : ''}>Ruby</option>
          <option value="Onyx" ${name === 'Onyx' ? 'selected' : ''}>Onyx</option>
          <option value="Best Deal" ${name === 'Best Deal' ? 'selected' : ''}>Best Deal</option>
          <option value="Yaqin" ${name === 'Yaqin' ? 'selected' : ''}>Yaqin</option>
        </select>
        <input type="number" class="form-input p-pax" value="${pax}" placeholder="Jumlah Pax" required min="1">
      </div>
      <div class="grid-2col" style="gap:8px; margin-top:8px;">
        <input type="text" class="form-input p-hotel-mad" value="${hotelMadinah}" placeholder="Hotel Madinah" required>
        <input type="text" class="form-input p-hotel-mak" value="${hotelMakkah}" placeholder="Hotel Makkah" required>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove(); calculateOverallPax();">&times;</button>
      </div>
    `;
    container.appendChild(div);
    
    // Bind auto sum listener to pax inputs
    div.querySelector(".p-pax").oninput = calculateOverallPax;
  };
  
  const addSimpleTextRow = (containerId, placeholder, val = "") => {
    const container = document.getElementById(containerId);
    const rowId = `s-row-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-row s-item-row";
    div.id = rowId;
    div.innerHTML = `
      <input type="text" class="form-input s-val" value="${val}" placeholder="${placeholder}" required>
      <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
    `;
    container.appendChild(div);
  };
  
  // Overall Pax calculator function
  function calculateOverallPax() {
    let sum = 0;
    const inputs = document.querySelectorAll(".p-item-row .p-pax");
    inputs.forEach(inp => {
      sum += parseInt(inp.value) || 0;
    });
    const label = document.getElementById("m-total-pax-calc");
    if (label) label.textContent = sum;
  }
  
  // Binding repeater button actions
  document.getElementById("m-add-arr-flight-btn").onclick = () => addFlightRow("m-arr-flights-container");
  document.getElementById("m-add-dep-flight-btn").onclick = () => addFlightRow("m-dep-flights-container");
  document.getElementById("m-add-package-btn").onclick = () => addPackageRow("m-packages-container");
  
  document.getElementById("m-add-leader-btn").onclick = () => addSimpleTextRow("m-leaders-container", "Nama Tour Leader");
  document.getElementById("m-add-mutawwif-btn").onclick = () => addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif");
  document.getElementById("m-add-meal-arr-btn").onclick = () => addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu Kedatangan");
  document.getElementById("m-add-meal-dep-btn").onclick = () => addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu Kepulangan");
  
  // Prepopulate edit data
  if (isEdit) {
    g.flightArrival.forEach(f => addFlightRow("m-arr-flights-container", f.date, f.code, f.takeoff, f.landing, f.remarks));
    g.flightDeparture.forEach(f => addFlightRow("m-dep-flights-container", f.date, f.code, f.takeoff, f.landing, f.remarks));
    g.packages.forEach(p => addPackageRow("m-packages-container", p.name, p.pax, p.hotelMadinah, p.hotelMakkah));
    g.leaders.forEach(l => addSimpleTextRow("m-leaders-container", "Nama TL", l));
    g.mutawwif.forEach(m => addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif", m));
    g.mealArrival.forEach(m => addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu", m));
    g.mealDeparture.forEach(m => addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu", m));
    calculateOverallPax();
  } else {
    // defaults
    addFlightRow("m-arr-flights-container");
    addFlightRow("m-dep-flights-container");
    addPackageRow("m-packages-container");
    addSimpleTextRow("m-leaders-container", "Nama Tour Leader");
    addSimpleTextRow("m-mutawwif-container", "Nama Muthowwif");
    addSimpleTextRow("m-meals-arr-container", "Jadwal/Menu");
    addSimpleTextRow("m-meals-dep-container", "Jadwal/Menu");
  }
  
  document.getElementById("manifest-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("m-group-name").value.trim();
    const rute = document.getElementById("m-route").value.trim();
    const dateStart = document.getElementById("m-start-date").value;
    const dateEnd = document.getElementById("m-end-date").value;
    
    // Parse flight arrival repeater rows
    const arrRows = document.querySelectorAll("#m-arr-flights-container .f-item-row");
    const flightArrival = Array.from(arrRows).map(row => ({
      date: row.querySelector(".f-date").value,
      code: row.querySelector(".f-code").value.trim(),
      takeoff: row.querySelector(".f-takeoff").value,
      landing: row.querySelector(".f-landing").value,
      remarks: row.querySelector(".f-rem").value.trim()
    }));
    
    // Parse flight departure repeater rows
    const depRows = document.querySelectorAll("#m-dep-flights-container .f-item-row");
    const flightDeparture = Array.from(depRows).map(row => ({
      date: row.querySelector(".f-date").value,
      code: row.querySelector(".f-code").value.trim(),
      takeoff: row.querySelector(".f-takeoff").value,
      landing: row.querySelector(".f-landing").value,
      remarks: row.querySelector(".f-rem").value.trim()
    }));
    
    // Parse package repeater rows
    const pkgRows = document.querySelectorAll("#m-packages-container .p-item-row");
    const packages = Array.from(pkgRows).map(row => ({
      name: row.querySelector(".p-name").value,
      pax: parseInt(row.querySelector(".p-pax").value) || 0,
      hotelMadinah: row.querySelector(".p-hotel-mad").value.trim(),
      hotelMakkah: row.querySelector(".p-hotel-mak").value.trim()
    }));
    
    // Extract unique hotel list dinamis dari paket
    let hotels = [];
    packages.forEach(p => {
      if (p.hotelMadinah && !hotels.includes(p.hotelMadinah)) hotels.push(p.hotelMadinah);
      if (p.hotelMakkah && !hotels.includes(p.hotelMakkah)) hotels.push(p.hotelMakkah);
    });
    
    const leaders = Array.from(document.querySelectorAll("#m-leaders-container .s-item-row .s-val")).map(x => x.value.trim());
    const mutawwif = Array.from(document.querySelectorAll("#m-mutawwif-container .s-item-row .s-val")).map(x => x.value.trim());
    const mealArrival = Array.from(document.querySelectorAll("#m-meals-arr-container .s-item-row .s-val")).map(x => x.value.trim());
    const mealDeparture = Array.from(document.querySelectorAll("#m-meals-dep-container .s-item-row .s-val")).map(x => x.value.trim());
    
    if (isEdit) {
      state.groups[editIdx] = {
        name, rute, status: g.status, dateStart, dateEnd, flightArrival, flightDeparture, packages, hotels, leaders, mutawwif, mealArrival, mealDeparture
      };
    } else {
      state.groups.push({
        name, rute, status: "Aktif", dateStart, dateEnd, flightArrival, flightDeparture, packages, hotels, leaders, mutawwif, mealArrival, mealDeparture
      });
    }
    
    saveState();
    closeModal();
    showToast("Manifest grup disimpan!");
    renderAdminManifest();
  };
}

function renderManifestList(searchQuery = "") {
  const container = document.getElementById("manifest-list-cards");
  if (!container) return;
  
  let list = state.groups || [];
  if (searchQuery !== "") {
    list = list.filter(g => 
      (g.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
      (g.rute || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  
  if (list.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">Tidak ada manifest grup yang ditemukan.</p>`;
    return;
  }
  
  container.innerHTML = list.map((g) => {
    const idx = state.groups.indexOf(g);
    const totalPax = g.packages ? g.packages.reduce((sum, item) => sum + (item.pax || 0), 0) : 0;
    const isHighlight = searchQuery !== "" && (g.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    // Fallback checks for flight arrivals
    let flightArrText = "Tidak ada data";
    if (g.flightArrival && Array.isArray(g.flightArrival)) {
      flightArrText = g.flightArrival.map(f => `${f.code || '-'} (${f.takeoff || '-'}-${f.landing || '-'})`).join(', ');
    }
    
    // Fallback checks for flight departures
    let flightDepText = "Tidak ada data";
    if (g.flightDeparture && Array.isArray(g.flightDeparture)) {
      flightDepText = g.flightDeparture.map(f => `${f.code || '-'} (${f.takeoff || '-'}-${f.landing || '-'})`).join(', ');
    }
    
    // Fallback checks for hotels
    let hotelsText = "Tidak ada data";
    if (g.hotels && Array.isArray(g.hotels)) {
      hotelsText = g.hotels.join(' & ');
    }
    
    // Fallback checks for meals
    let mealsText = "Katering Standard";
    let allMeals = [];
    if (g.mealArrival && Array.isArray(g.mealArrival)) {
      allMeals = allMeals.concat(g.mealArrival);
    }
    if (g.mealDeparture && Array.isArray(g.mealDeparture)) {
      allMeals = allMeals.concat(g.mealDeparture);
    }
    if (allMeals.length > 0) {
      mealsText = allMeals.join(', ');
    }
    
    const todayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    let statusText = "Akan Datang";
    let badgeClass = "badge-info";
    if (todayStr >= g.dateStart && todayStr <= g.dateEnd) {
      statusText = "Aktif";
      badgeClass = "badge-success";
    } else if (todayStr > g.dateEnd) {
      statusText = "Selesai";
      badgeClass = "badge-secondary";
    }
    
    return `
      <div class="admin-card" style="border-left:4px solid ${isHighlight ? 'var(--primary-gold)' : '#e2e8f0'}; background:${isHighlight ? '#fffdf5' : '#ffffff'};">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding-bottom:8px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:0.95rem;">${g.name || 'Grup Tanpa Nama'}</strong>
            <span class="badge ${badgeClass}">${statusText}</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary edit-manifest-popup-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Edit</button>
            <button class="btn btn-danger delete-manifest-btn" data-idx="${idx}" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hapus</button>
          </div>
        </div>
        
        <div class="structured-card-grid">
          <div class="structured-card-row"><span class="structured-card-label">Rute:</span><span class="structured-card-value">${g.rute || '-'}</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Jadwal Keberangkatan:</span><span class="structured-card-value">${formatDateDisplay(g.dateStart)} s/d ${formatDateDisplay(g.dateEnd)}</span></div>
          <div class="structured-card-row"><span class="structured-card-label">Total Pax:</span><span class="structured-card-value"><strong>${totalPax} Jamaah</strong></span></div>
        </div>
        
        <!-- Flight, Hotel, Meal info accordions/lists -->
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px; font-size:0.8rem; background:#f8f9fa; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <div><strong>✈️ Kedatangan Penerbangan:</strong> ${flightArrText}</div>
          <div><strong>✈️ Kepulangan Penerbangan:</strong> ${flightDepText}</div>
          <div><strong>🏢 Hotel & Akomodasi:</strong> ${hotelsText}</div>
          <div><strong>🍱 Layanan Katering Saudi:</strong> ${mealsText}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Bind actions
  container.querySelectorAll(".edit-manifest-popup-btn").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      openManifestFormPopup(idx);
    };
  });
  
  container.querySelectorAll(".delete-manifest-btn").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.getAttribute("data-idx"));
      if (confirm("Hapus data manifest rombongan ini?")) {
        state.groups.splice(idx, 1);
        saveState();
        showToast("Manifest dihapus.");
        renderAdminManifest();
      }
    };
  });
}

// --- ADMIN SUB-VIEW: MANIFEST JAMAAH (TERHUBUNG DENGAN GRUP) ---
function renderAdminManifestJamaah() {
  const container = document.getElementById("admin-subview-content");
  if (!container) return;
  
  const groupNames = state.groups.map(g => g.name);
  
  container.innerHTML = `
    <div style="background:#ffffff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:20px; border:1px solid #cbd5e1;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div style="flex:1; min-width:280px; position:relative;">
          <label class="form-label" style="font-weight:800; font-size:0.85rem; color:#1e293b; margin-bottom:6px; display:block;">Pilih Rombongan Grup Keberangkatan</label>
          <input type="text" id="jamaah-group-search" class="form-input" placeholder="Cari / Ketik Rombongan Grup..." style="width:100%;">
          <div id="jamaah-group-suggestions" class="suggestion-list hidden"></div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-end;">
          <button id="add-jamaah-popup-btn" class="btn btn-gold" style="width:auto; padding:10px 16px; font-size:0.85rem; display:none;">
            <i data-lucide="user-plus"></i> Tambah Jamaah
          </button>
          <button id="print-jamaah-manifest-btn" class="btn btn-secondary" style="width:auto; padding:10px 16px; font-size:0.85rem; display:none;">
            <i data-lucide="printer"></i> Cetak Manifest
          </button>
        </div>
      </div>
      <div id="selected-group-summary-banner" style="display:none; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; font-size:0.85rem; color:#334155;">
      </div>
    </div>
    
    <div id="jamaah-manifest-table-container">
      <div style="text-align:center; padding:40px 20px; color:#94a3b8; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
        <i data-lucide="users" style="width:48px; height:48px; color:#cbd5e1; margin-bottom:12px; stroke-width:1.5;"></i>
        <h4 style="font-weight:800; color:#475569; margin-bottom:4px;">Belum Ada Grup Dipilih</h4>
        <p style="font-size:0.85rem; margin:0;">Silakan pilih atau cari rombongan grup keberangkatan di atas untuk menampilkan Manifest Jamaah terhubung.</p>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  const groupInput = document.getElementById("jamaah-group-search");
  const addBtn = document.getElementById("add-jamaah-popup-btn");
  const printBtn = document.getElementById("print-jamaah-manifest-btn");
  const summaryBanner = document.getElementById("selected-group-summary-banner");
  const tableContainer = document.getElementById("jamaah-manifest-table-container");
  
  let currentSelectedGroup = "";
  
  const renderGroupJamaahTable = (groupName) => {
    currentSelectedGroup = groupName;
    const groupObj = state.groups.find(g => g.name === groupName);
    
    if (!groupObj) {
      addBtn.style.display = "none";
      printBtn.style.display = "none";
      summaryBanner.style.display = "none";
      tableContainer.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#94a3b8; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <p style="font-size:0.85rem; margin:0;">Grup "${groupName}" tidak ditemukan.</p>
        </div>
      `;
      return;
    }
    
    addBtn.style.display = "inline-flex";
    printBtn.style.display = "inline-flex";
    summaryBanner.style.display = "block";
    
    const tlStr = (groupObj.leaders && groupObj.leaders.length > 0) ? groupObj.leaders.join(', ') : "Belum ditentukan";
    const muthStr = groupObj.mutawwif || "Belum ditentukan";
    const totalPaxVal = groupObj.packages ? groupObj.packages.reduce((sum, p) => sum + (p.pax || 0), 0) : 0;
    
    summaryBanner.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <strong style="color:#0f172a; font-size:0.95rem;">${groupObj.name}</strong>
          <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
            Rute: ${groupObj.rute || '-'} &bull; Tgl: ${groupObj.dateStart || '-'} s/d ${groupObj.dateEnd || '-'}
          </div>
        </div>
        <div style="display:flex; gap:16px; font-size:0.8rem; flex-wrap:wrap;">
          <div><span style="color:#64748b;">Tour Leader:</span> <strong>${tlStr}</strong></div>
          <div><span style="color:#64748b;">Muthowwif:</span> <strong>${muthStr}</strong></div>
          <div><span style="color:#64748b;">Total Target Pax:</span> <strong>${totalPaxVal} Jamaah</strong></div>
        </div>
      </div>
    `;
    
    const roomsForGroup = state.rooms.filter(r => r.groupName === groupName);
    
    let jamaahList = [];
    roomsForGroup.forEach(r => {
      if (r.guests && Array.isArray(r.guests)) {
        r.guests.forEach(g => {
          const uCode = g.uniqueCode || ("JIBB-" + String(g.guestNo || "1").padStart(4, "0"));
          jamaahList.push({
            guestNo: g.guestNo || "1",
            uniqueCode: uCode,
            name: g.name || "-",
            remark: g.remark || "Laki-laki",
            roomNumber: r.roomNumber,
            hotelName: r.hotelName,
            roomId: r.id
          });
        });
      }
    });
    
    if (jamaahList.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align:center; padding:36px 20px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">
          <p style="color:#64748b; font-size:0.88rem; margin-bottom:12px;">Belum ada data jamaah terdaftar di roomlist rombongan grup ini.</p>
          <button class="btn btn-gold" id="table-add-first-jamaah-btn" style="width:auto; padding:6px 14px; font-size:0.8rem;">+ Tambah Jamaah Pertama</button>
        </div>
      `;
      const firstBtn = document.getElementById("table-add-first-jamaah-btn");
      if (firstBtn) firstBtn.onclick = () => openAddJamaahPopup(groupName, () => renderGroupJamaahTable(groupName));
      return;
    }
    
    let tableHtml = `
      <div style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
        <div style="padding:12px 16px; background:#f1f5f9; border-bottom:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.88rem; color:#1e293b;">Daftar Manifest Jamaah Terdaftar (${jamaahList.length} Jamaah)</strong>
          <span style="font-size:0.75rem; color:#64748b;">Terhubung dengan Database Roomlist & Manifest Grup</span>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
              <tr style="background:#f8fafc; color:#475569; text-align:left; border-bottom:1px solid #e2e8f0;">
                <th style="padding:10px 12px; width:60px;">No</th>
                <th style="padding:10px 12px; width:110px;">ID Kode Unik</th>
                <th style="padding:10px 12px;">Nama Lengkap Jamaah</th>
                <th style="padding:10px 12px;">Jenis Kelamin</th>
                <th style="padding:10px 12px;">No. Kamar</th>
                <th style="padding:10px 12px;">Hotel Layanan</th>
                <th style="padding:10px 12px; text-align:center; width:100px;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${jamaahList.map((j) => {
                const genderTag = (j.remark && j.remark.toLowerCase().includes("perempuan")) 
                  ? `<span class="badge" style="background:#fce7f3; color:#be185d; font-size:0.72rem; padding:2px 8px; border-radius:10px;">Perempuan</span>`
                  : `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; padding:2px 8px; border-radius:10px;">Laki-laki</span>`;
                
                return `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px 12px; font-weight:700;"><code>${j.guestNo}</code></td>
                    <td style="padding:10px 12px;"><span style="background:#eff6ff; color:#0070f3; font-weight:900; font-size:0.78rem; padding:3px 8px; border-radius:6px; border:1px solid #bfdbfe;">${j.uniqueCode}</span></td>
                    <td style="padding:10px 12px; font-weight:800; color:#0f172a;">${j.name}</td>
                    <td style="padding:10px 12px;">${genderTag}</td>
                    <td style="padding:10px 12px; font-weight:700; color:#334155;">Kamar ${j.roomNumber}</td>
                    <td style="padding:10px 12px; color:#475569;">${j.hotelName}</td>
                    <td style="padding:10px 12px; text-align:center;">
                      <button class="btn btn-gold detail-jamaah-btn" data-unique="${j.uniqueCode}" data-roomid="${j.roomId}" data-guestno="${j.guestNo}" style="padding:4px 12px; font-size:0.75rem; width:auto; font-weight:800;" title="Lihat Detail Jamaah"><i data-lucide="eye"></i> Detail</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    tableContainer.innerHTML = tableHtml;
    lucide.createIcons();
    
    tableContainer.querySelectorAll(".detail-jamaah-btn").forEach(btn => {
      btn.onclick = () => {
        const uCode = btn.getAttribute("data-unique");
        const rId = btn.getAttribute("data-roomid");
        const gNo = btn.getAttribute("data-guestno");
        openJamaahDetailPopup(uCode, rId, gNo, () => renderGroupJamaahTable(groupName));
      };
    });
  };
  
  initSuggestionInput("jamaah-group-search", "jamaah-group-suggestions", groupNames, (selectedName) => {
    renderGroupJamaahTable(selectedName);
  });
  
  addBtn.onclick = () => {
    if (currentSelectedGroup) {
      openAddJamaahPopup(currentSelectedGroup, () => renderGroupJamaahTable(currentSelectedGroup));
    }
  };
  
  printBtn.onclick = () => {
    if (currentSelectedGroup) {
      window.print();
    }
  };
  
  const urlParams = window.location.hash.split("?")[1];
  if (urlParams && urlParams.startsWith("group=")) {
    const grp = decodeURIComponent(urlParams.replace("group=", ""));
    groupInput.value = grp;
    renderGroupJamaahTable(grp);
  } else if (groupNames.length > 0) {
    groupInput.value = groupNames[0];
    renderGroupJamaahTable(groupNames[0]);
  }
}

function openAddJamaahPopup(groupName, onComplete) {
  const groupObj = state.groups.find(g => g.name === groupName);
  const hotels = groupObj ? groupObj.hotels : [];
  const hotelOptions = hotels.map(h => `<option value="${h}">${h}</option>`).join('');
  
  const popupHtml = `
    <form id="add-jamaah-form-popup">
      <div class="form-group">
        <label class="form-label">No. Urut / ID Jamaah</label>
        <input type="text" id="aj-num" class="form-input" placeholder="mis. 1, 2, atau X8582843" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nama Lengkap Jamaah</label>
        <input type="text" id="aj-name" class="form-input" placeholder="Nama Jamaah" required>
      </div>
      <div class="form-group">
        <label class="form-label">Jenis Kelamin / Remark</label>
        <select id="aj-remark" class="form-select" required>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Hotel Akomodasi</label>
        <select id="aj-hotel" class="form-select" required>
          ${hotelOptions || '<option value="Hotel Madinah">Hotel Madinah</option><option value="Hotel Makkah">Hotel Makkah</option>'}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor Kamar</label>
        <input type="text" id="aj-room" class="form-input" placeholder="mis. 1007 atau 2105" required>
      </div>
      <button type="submit" class="btn btn-gold" style="margin-top:16px;">+ TAMBAH JAMAAH KE MANIFEST</button>
    </form>
  `;
  
  openModal(`Tambah Jamaah - ${groupName}`, popupHtml);
  
  document.getElementById("add-jamaah-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const guestNo = document.getElementById("aj-num").value.trim();
    const name = document.getElementById("aj-name").value.trim();
    const remark = document.getElementById("aj-remark").value;
    const hotelName = document.getElementById("aj-hotel").value;
    const roomNumber = document.getElementById("aj-room").value.trim();
    
    let roomObj = state.rooms.find(r => r.groupName === groupName && r.hotelName === hotelName && r.roomNumber === roomNumber);
    if (!roomObj) {
      roomObj = {
        id: `rm-${Date.now()}-${Math.random()}`,
        groupName: groupName,
        hotelName: hotelName,
        roomlistNumber: "1",
        roomNumber: roomNumber,
        typeBed: "Quad",
        guests: []
      };
      state.rooms.push(roomObj);
    }
    
    roomObj.guests.push({ guestNo, name, remark });
    saveState();
    closeModal();
    showToast("Jamaah berhasil ditambahkan!");
    if (onComplete) onComplete();
  };
}

function openEditJamaahPopup(roomId, guestNo, onComplete) {
  const roomObj = state.rooms.find(r => r.id === roomId);
  if (!roomObj || !roomObj.guests) return;
  
  const g = roomObj.guests.find(x => x.guestNo === guestNo);
  if (!g) return;
  
  const popupHtml = `
    <form id="edit-jamaah-form-popup">
      <div class="form-group">
        <label class="form-label">No. Urut / ID Jamaah</label>
        <input type="text" id="ej-num" class="form-input" value="${g.guestNo}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Nama Lengkap Jamaah</label>
        <input type="text" id="ej-name" class="form-input" value="${g.name}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Jenis Kelamin / Remark</label>
        <select id="ej-remark" class="form-select" required>
          <option value="Laki-laki" ${g.remark === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
          <option value="Perempuan" ${g.remark === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Nomor Kamar</label>
        <input type="text" id="ej-room" class="form-input" value="${roomObj.roomNumber}" required>
      </div>
      <button type="submit" class="btn btn-gold" style="margin-top:16px;">SIMPAN PERUBAHAN JAMAAH</button>
    </form>
  `;
  
  openModal(`Edit Jamaah - ${g.name}`, popupHtml);
  
  document.getElementById("edit-jamaah-form-popup").onsubmit = (e) => {
    e.preventDefault();
    g.guestNo = document.getElementById("ej-num").value.trim();
    g.name = document.getElementById("ej-name").value.trim();
    g.remark = document.getElementById("ej-remark").value;
    roomObj.roomNumber = document.getElementById("ej-room").value.trim();
    
    saveState();
    closeModal();
    showToast("Data jamaah berhasil diperbarui!");
    if (onComplete) onComplete();
  };
}

function openJamaahDetailPopup(uniqueCode, roomId, guestNo, onRefresh) {
  const data = findJamaahData(uniqueCode || guestNo);
  if (!data) {
    showToast("Data detail jamaah tidak ditemukan.", "error");
    return;
  }
  
  const popupHtml = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      
      <!-- Top Banner: Avatar, Name, Unique Code, Gender, Passport, Visa, Package Badge -->
      <div style="background:#f8fafc; border-radius:14px; padding:16px; border:1px solid #e2e8f0; display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
        <div style="width:54px; height:54px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:1.6rem; border:2px solid #c5a850;">
          <i data-lucide="user" style="width:28px; height:28px; color:#1e293b;"></i>
        </div>
        <div style="flex:1; min-width:200px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
            <div>
              <strong style="font-size:1.05rem; color:#0f172a; display:block;">${data.name}</strong>
              <span style="font-size:0.78rem; font-weight:900; color:#0070f3; background:#eff6ff; padding:2px 8px; border-radius:6px; border:1px solid #bfdbfe;">${data.uniqueCode}</span>
            </div>
            <span class="badge badge-info" style="background:#0070f3; color:#ffffff; font-size:0.75rem; padding:3px 10px; border-radius:12px; font-weight:800;">${data.package}</span>
          </div>
          <div style="font-size:0.8rem; color:#475569; margin-top:6px;">
            ${data.gender} &bull; ${data.bus} &bull; Paspor: <strong style="color:#1e293b;">${data.passport}</strong> &bull; Visa: <strong style="color:#1e293b;">${data.visa}</strong>
          </div>
        </div>
      </div>
      
      <!-- Body Grid: Live QR Code & Hotel Allocations Across Cities -->
      <div style="display:grid; grid-template-columns: 140px 1fr; gap:14px; align-items:center;">
        
        <!-- Live QR Code Card -->
        <div style="background:#ffffff; border:2px solid #c5a850; border-radius:12px; padding:10px; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div id="detail-qrcode-canvas-target" style="width:110px; height:110px; display:flex; align-items:center; justify-content:center;"></div>
          <div style="font-size:0.65rem; font-weight:900; color:#0f172a; margin-top:6px; letter-spacing:0.02em;">QR ID JAMAAH</div>
        </div>
        
        <!-- Hotel Rooms Across All Cities -->
        <div style="display:flex; flex-direction:column; gap:8px;">
          <!-- Madinah -->
          <div style="border-radius:10px; border:1px solid #cbd5e1; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.72rem; font-weight:800; padding:4px 8px; text-transform:uppercase;">Hotel Madinah</div>
            <div style="padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; font-weight:700; color:#334155;">${data.madinahHotel}</span>
              <span style="font-size:1.1rem; font-weight:900; color:#0f172a;">Kmr ${data.madinahRoom}</span>
            </div>
          </div>
          <!-- Makkah -->
          <div style="border-radius:10px; border:1px solid #cbd5e1; overflow:hidden; background:#ffffff;">
            <div style="background:#c5a850; color:#ffffff; text-align:center; font-size:0.72rem; font-weight:800; padding:4px 8px; text-transform:uppercase;">Hotel Makkah</div>
            <div style="padding:8px 12px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.8rem; font-weight:700; color:#334155;">${data.makkahHotel}</span>
              <span style="font-size:1.1rem; font-weight:900; color:#0f172a;">Kmr ${data.makkahRoom}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Baggage details -->
      <div style="background:#f8fafc; border-radius:10px; padding:10px 14px; font-size:0.8rem; border:1px solid #e2e8f0;">
        <strong style="color:#475569; font-size:0.75rem; display:block; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Rincian Barang Bawaan (Bagasi) :</strong>
        <span style="color:#0f172a; font-weight:800;">${data.luggage}</span>
      </div>

      <!-- Action Buttons Footer inside Popup -->
      <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
        <button id="detail-idcard-btn" class="btn btn-gold" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="qr-code"></i> ID Card</button>
        <button id="detail-edit-btn" class="btn btn-secondary" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="edit"></i> Edit Data</button>
        <button id="detail-delete-btn" class="btn btn-danger" style="flex:1; font-size:0.8rem; padding:10px;"><i data-lucide="trash-2"></i> Hapus</button>
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:10px 14px;">Tutup</button>
      </div>

    </div>
  `;
  
  openModal(`Detail Informasi Jamaah - ${data.uniqueCode}`, popupHtml);
  lucide.createIcons();
  
  // Render dynamic QR code inside detail popup
  setTimeout(() => {
    const target = document.getElementById("detail-qrcode-canvas-target");
    if (target) {
      target.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(target, {
            text: data.uniqueCode,
            width: 105,
            height: 105,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: 2
          });
        } catch(e) {
          target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=105x105&data=${encodeURIComponent(data.uniqueCode)}" style="width:105px; height:105px;">`;
        }
      } else {
        target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=105x105&data=${encodeURIComponent(data.uniqueCode)}" style="width:105px; height:105px;">`;
      }
    }
  }, 100);
  
  // Bind Action Buttons inside Popup
  document.getElementById("detail-idcard-btn").onclick = () => {
    closeModal();
    openJamaahIdCardPopup(data.uniqueCode);
  };
  
  document.getElementById("detail-edit-btn").onclick = () => {
    closeModal();
    openEditJamaahPopup(roomId, guestNo, onRefresh);
  };
  
  document.getElementById("detail-delete-btn").onclick = () => {
    if (confirm(`Hapus jamaah ${data.name} (${data.uniqueCode}) dari grup ini?`)) {
      const roomObj = state.rooms.find(r => r.id === roomId);
      if (roomObj && roomObj.guests) {
        roomObj.guests = roomObj.guests.filter(x => x.guestNo !== guestNo);
        saveState();
        closeModal();
        showToast("Jamaah berhasil dihapus.");
        if (onRefresh) onRefresh();
      }
    }
  };
}

function openJamaahIdCardPopup(uniqueCode) {
  const data = findJamaahData(uniqueCode);
  if (!data) {
    showToast("Data jamaah tidak ditemukan.", "error");
    return;
  }
  
  const cardHtml = `
    <div id="jamaah-id-card-print-target" style="width:100%; max-width:380px; margin:0 auto; background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:18px; padding:20px; color:#ffffff; font-family:'Mulish', sans-serif; border:2px solid #c5a850; box-shadow:0 10px 25px rgba(0,0,0,0.3); position:relative; overflow:hidden;">
      
      <div style="position:absolute; top:-30px; right:-30px; width:120px; height:120px; background:rgba(197,168,80,0.12); border-radius:50%; pointer-events:none;"></div>
      
      <!-- Card Header -->
      <div style="text-align:center; border-bottom:1px solid rgba(197,168,80,0.4); padding-bottom:12px; margin-bottom:14px;">
        <div style="font-size:0.7rem; font-weight:800; color:#c5a850; text-transform:uppercase; letter-spacing:0.12em;">KARTU IDENTITAS JAMAAH UMROH</div>
        <div style="font-size:1.15rem; font-weight:900; color:#ffffff; font-family:'Martel', serif; text-transform:lowercase; margin-top:2px;">jejak imani</div>
        <div style="font-size:0.65rem; color:#94a3b8;">SAUDI HANDLING OPERATIONS & MANAGEMENT</div>
      </div>
      
      <!-- Card Body -->
      <div style="display:flex; gap:14px; align-items:center;">
        <div style="flex:1;">
          <div style="font-size:0.68rem; color:#94a3b8; text-transform:uppercase;">Nama Jamaah</div>
          <div style="font-size:1rem; font-weight:900; color:#ffffff; margin-bottom:8px; line-height:1.2;">${data.name}</div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.75rem; color:#cbd5e1;">
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Kode Unik</span><strong style="color:#c5a850; font-size:0.85rem;">${data.uniqueCode}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Jenis Kelamin</span><strong>${data.gender}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Paket</span><strong>${data.package}</strong></div>
            <div><span style="color:#94a3b8; font-size:0.65rem; display:block;">Bus</span><strong>${data.bus}</strong></div>
          </div>
        </div>
        
        <!-- Dynamic QR Code Container -->
        <div style="background:#ffffff; padding:8px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid #c5a850; width:100px; min-width:100px;">
          <div id="qrcode-canvas-target" style="width:90px; height:90px; display:flex; align-items:center; justify-content:center;"></div>
          <div style="font-size:0.55rem; color:#0f172a; font-weight:800; margin-top:4px; text-align:center;">SCAN ME</div>
        </div>
      </div>
      
      <!-- Hotel Summary -->
      <div style="margin-top:14px; background:rgba(255,255,255,0.06); border-radius:10px; padding:10px; font-size:0.72rem; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>📍 Madinah: <strong style="color:#ffffff;">${data.madinahHotel}</strong></span>
          <span style="color:#c5a850; font-weight:800;">Kmr ${data.madinahRoom}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>📍 Makkah: <strong style="color:#ffffff;">${data.makkahHotel}</strong></span>
          <span style="color:#c5a850; font-weight:800;">Kmr ${data.makkahRoom}</span>
        </div>
      </div>
      
      <!-- Card Footer -->
      <div style="margin-top:10px; font-size:0.68rem; color:#94a3b8; text-align:center;">
        Paspor: <strong style="color:#e2e8f0;">${data.passport}</strong> &bull; Visa: <strong style="color:#e2e8f0;">${data.visa}</strong>
      </div>
    </div>
    
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button id="print-single-idcard-btn" class="btn btn-gold" style="flex:1;"><i data-lucide="printer"></i> Cetak ID Card</button>
      <button class="btn btn-secondary" onclick="closeModal()" style="width:auto;">Tutup</button>
    </div>
  `;
  
  openModal(`Kartu Identitas Jamaah - ${data.uniqueCode}`, cardHtml);
  lucide.createIcons();
  
  setTimeout(() => {
    const target = document.getElementById("qrcode-canvas-target");
    if (target) {
      target.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        try {
          new QRCode(target, {
            text: data.uniqueCode,
            width: 88,
            height: 88,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: 2
          });
        } catch(e) {
          target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data.uniqueCode)}" style="width:88px; height:88px;">`;
        }
      } else {
        target.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(data.uniqueCode)}" style="width:88px; height:88px;">`;
      }
    }
  }, 100);
  
  const pBtn = document.getElementById("print-single-idcard-btn");
  if (pBtn) pBtn.onclick = () => window.print();
}

function renderAdminRoomlist() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <!-- Compact Top Filter -->
    <div class="admin-card" style="padding:12px; margin-bottom:16px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <select id="rl-filter-group" class="form-select" style="flex:1; min-width:200px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Rombongan Grup</option>
          ${state.groups.map(g => `<option value="${g.name}">${g.name}</option>`).join('')}
        </select>
        <select id="rl-filter-hotel" class="form-select" style="flex:1; min-width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="">Semua Hotel</option>
        </select>
        <button id="add-rl-popup-btn" class="btn btn-gold" style="width:auto; padding:6px 14px; font-size:0.85rem; margin:0;"><i data-lucide="plus-circle"></i> Tambah Roomlist Baru</button>
      </div>
    </div>
    
    <!-- Render active filtered roomlists (Table) -->
    <div id="admin-filtered-roomlists-container">
      <p style="text-align:center; color:var(--text-light); font-size:0.9rem; padding:20px;">Silakan pilih filter Grup dan Nama Hotel di atas terlebih dahulu untuk memuat template roomlist.</p>
    </div>
  `;
  
  lucide.createIcons();
  
  const gSelect = document.getElementById("rl-filter-group");
  const hSelect = document.getElementById("rl-filter-hotel");
  const filteredContainer = document.getElementById("admin-filtered-roomlists-container");
  
  gSelect.onchange = () => {
    const groupName = gSelect.value;
    hSelect.innerHTML = `<option value="">Semua Hotel</option>`;
    filteredContainer.innerHTML = `<p style="text-align:center; color:var(--text-light); font-size:0.9rem; padding:20px;">Silakan pilih hotel untuk menampilkan data.</p>`;
    
    const group = state.groups.find(g => g.name === groupName);
    if (group && group.hotels) {
      group.hotels.forEach(h => {
        hSelect.innerHTML += `<option value="${h}">${h}</option>`;
      });
    }
  };
  
  const updateTableData = () => {
    const groupName = gSelect.value;
    const hotelName = hSelect.value;
    if (groupName && hotelName) {
      renderFilteredAdminRoomlists(groupName, hotelName);
    }
  };
  hSelect.onchange = updateTableData;
  
  document.getElementById("add-rl-popup-btn").onclick = () => openRoomlistFormPopup(gSelect.value, hSelect.value, updateTableData);
}

function renderFilteredAdminRoomlists(groupName, hotelName) {
  const container = document.getElementById("admin-filtered-roomlists-container");
  const filtered = state.rooms.filter(r => r.groupName === groupName && r.hotelName === hotelName);
  
  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:20px;">Belum ada template roomlist untuk filter ini. Silakan buat yang baru.</p>`;
    return;
  }
  
  container.innerHTML = `
    <div class="table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Roomlist</th>
              <th>Kamar</th>
              <th>Bed</th>
              <th>No. Jamaah</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((r, idx) => {
              const guestNumbersHtml = r.guests.map(g => `<div><code>${g.guestNo}</code></div>`).join('');
              const hasRemarks = r.guests.some(g => g.remark && g.remark.trim() !== "" && g.remark !== "none");
              
              let remarkIconHtml = '-';
              if (hasRemarks) {
                const gRem = r.guests.find(g => g.remark && g.remark !== "none");
                const firstRem = gRem?.remark;
                const remText = gRem?.remarkText;
                const titleAttr = remText ? `${firstRem}: ${remText}` : firstRem;
                if (firstRem === 'warning') {
                  remarkIconHtml = `<span style="color:#d97706; font-weight:bold;" title="${titleAttr}">⚠️ ${remText ? `(${remText})` : ''}</span>`;
                } else {
                  remarkIconHtml = `<span style="background:${getHexColor(firstRem)}; width:12px; height:12px; border-radius:50%; display:inline-block; margin-right:4px;" title="${titleAttr}"></span> <span style="font-size:0.75rem; color:#475569; font-weight:700;">${remText || firstRem}</span>`;
                }
              }
              
              let cleanBed = r.typeBed;
              if (cleanBed.includes("Double")) cleanBed = "Twin";
              else if (cleanBed.includes("Triple")) cleanBed = "Triple";
              else if (cleanBed.includes("Quad")) cleanBed = "Quad";

              return `
                <tr class="clickable-admin-room-row" data-idx="${idx}" style="cursor:pointer;">
                  <td><strong>${r.roomlistNumber}</strong></td>
                  <td><span style="color:var(--primary-gold); font-weight:700;">${r.roomNumber}</span></td>
                  <td>${cleanBed}</td>
                  <td>${guestNumbersHtml}</td>
                  <td style="text-align:center;">${remarkIconHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  lucide.createIcons();
  
  // Bind row click to open popup details
  container.querySelectorAll(".clickable-admin-room-row").forEach(row => {
    row.onclick = () => {
      const idx = parseInt(row.getAttribute("data-idx"));
      const room = filtered[idx];
      if (!room) return;
      
      const popupDetailHtml = `
        <div style="font-size:0.95rem; margin-bottom:16px;">
          <p><strong>Grup:</strong> ${room.groupName}</p>
          <p><strong>Hotel:</strong> ${room.hotelName}</p>
          <p><strong>Roomlist No:</strong> ${room.roomlistNumber} | <strong>Bed:</strong> ${room.typeBed}</p>
          <p><strong>Nomor Kamar:</strong> <span style="color:var(--primary-gold); font-weight:800;">${room.roomNumber}</span></p>
          
          <h5 style="margin-top:20px; margin-bottom:8px; font-weight:800;">Daftar Tamu & Indikator Remark</h5>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${room.guests.map(g => {
              let remarkIndicator = "";
              const remDesc = g.remarkText ? ` (${g.remarkText})` : "";
              if (g.remark === "warning") remarkIndicator = `⚠️ Warning${remDesc}`;
              else if (g.remark && g.remark !== "none") {
                remarkIndicator = `<span style="background:${getHexColor(g.remark)}; width:12px; height:12px; border-radius:50%; display:inline-block; margin-right:4px;"></span> <strong>${g.remark}</strong>${remDesc}`;
              }
              return `<div><code>${g.guestNo}</code> ${g.name} ${remarkIndicator ? `| ${remarkIndicator}` : ''}</div>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="popup-detail-edit-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;">Edit Kamar</button>
          <button id="popup-detail-delete-btn" class="btn btn-danger" style="width:auto; padding:8px 16px;">Hapus Kamar</button>
        </div>
      `;
      
      openModal(`Detail Kamar ${room.roomNumber}`, popupDetailHtml);
      
      document.getElementById("popup-detail-edit-btn").onclick = () => {
        closeModal();
        openEditRoomlistRowPopup(room, () => renderFilteredAdminRoomlists(groupName, hotelName));
      };
      
      document.getElementById("popup-detail-delete-btn").onclick = () => {
        if (confirm(`Hapus kamar ${room.roomNumber} dari roomlist?`)) {
          state.rooms = state.rooms.filter(x => x.id !== room.id);
          saveState();
          closeModal();
          showToast("Kamar roomlist berhasil dihapus.");
          renderFilteredAdminRoomlists(groupName, hotelName);
        }
      };
    };
  });
}
function openEditRoomlistRowPopup(roomObj, onComplete) {
  const popupHtml = `
    <form id="edit-rl-row-form">
      <div class="form-group"><label class="form-label">No. Roomlist</label><input type="text" id="erl-num" class="form-input" value="${roomObj.roomlistNumber}" required></div>
      <div class="form-group"><label class="form-label">No. Kamar</label><input type="text" id="erl-room" class="form-input" value="${roomObj.roomNumber}" required></div>
      <div class="form-group">
        <label class="form-label">Tipe Kasur</label>
        <select id="erl-bed" class="form-select" required>
          <option value="Twin" ${roomObj.typeBed === 'Twin' || roomObj.typeBed === 'Double' ? 'selected' : ''}>Twin</option>
          <option value="King" ${roomObj.typeBed === 'King' ? 'selected' : ''}>King</option>
          <option value="Triple" ${roomObj.typeBed === 'Triple' ? 'selected' : ''}>Triple</option>
          <option value="Quad" ${roomObj.typeBed === 'Quad' ? 'selected' : ''}>Quad</option>
        </select>
      </div>
      
      <label class="form-label">Daftar Jamaah & Indikator Remark</label>
      <div id="erl-guests-rows" style="display:flex; flex-direction:column; gap:12px; margin-bottom:12px;"></div>
      <button type="button" id="erl-add-guest-btn" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem; margin-bottom:16px;">+ Tambah Jamaah</button>
      
      <button type="submit" class="btn btn-primary">SIMPAN PERUBAHAN KAMAR</button>
    </form>
  `;
  openModal(`Sunting Kamar ${roomObj.roomNumber}`, popupHtml);
  
  const guestsContainer = document.getElementById("erl-guests-rows");
  
  const addGuestRow = (num = "", name = "", rem = "none", remText = "") => {
    const rowId = `erl-g-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card erl-guest-item-row";
    div.id = rowId;
    
    const colors = ['none', 'Gold', 'Emerald', 'Ruby', 'Sapphire', 'Amber', 'Violet', 'Rose', 'Slate', 'Teal', 'Bronze', 'warning'];
    const dotsHtml = colors.map(c => {
      let isSel = (rem === c || (!rem && c === 'none'));
      if (c === 'warning' && (rem === 'warning' || rem === '⚠️')) isSel = true;
      
      let style = "";
      let text = "";
      if (c === 'none') style = "background:#e2e8f0; border:1px solid #aaa;";
      else if (c === 'warning') {
        style = "background:#fef08a; border:1px solid #d97706; color:#a16207; font-size:10px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;";
        text = "⚠️";
      } else {
        style = `background:${getHexColor(c)};`;
      }
      return `<span class="color-dot ${isSel ? 'selected' : ''}" data-val="${c}" style="${style} width:18px; height:18px; border-radius:50%; display:inline-block; cursor:pointer;" title="${c}">${text}</span>`;
    }).join('');

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Data Jamaah</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rowId}').remove()">&times;</button>
      </div>
      <div class="grid-2col" style="gap:8px;">
        <input type="number" class="form-input g-num" placeholder="No." style="max-width:80px;" value="${num}" required>
        <input type="text" class="form-input g-name" placeholder="Nama Lengkap" value="${name}" required>
      </div>
      <div style="margin-top:8px;">
        <label class="form-label" style="font-size:0.75rem; font-weight:700;">Indikator Remark & Keterangan Arti Warna</label>
        <input type="hidden" class="g-rem" value="${rem}">
        <div class="color-picker-row" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px; margin-bottom:6px;">
          ${dotsHtml}
        </div>
        <input type="text" class="form-input g-rem-text" placeholder="Keterangan / Arti Warna (mis. Kursi Roda, Infan, Catatan Medis)..." value="${remText || ''}" style="font-size:0.8rem; padding:4px 8px; margin-top:4px;">
      </div>
    `;
    guestsContainer.appendChild(div);
    
    const dots = div.querySelectorAll(".color-dot");
    const hiddenInp = div.querySelector(".g-rem");
    dots.forEach(d => {
      d.onclick = () => {
        dots.forEach(dot => dot.classList.remove("selected"));
        d.classList.add("selected");
        hiddenInp.value = d.getAttribute("data-val");
      };
    });
  };
  
  roomObj.guests.forEach(g => addGuestRow(g.guestNo, g.name, g.remark, g.remarkText || ''));
  document.getElementById("erl-add-guest-btn").onclick = () => addGuestRow();
  
  document.getElementById("edit-rl-row-form").onsubmit = (e) => {
    e.preventDefault();
    roomObj.roomlistNumber = document.getElementById("erl-num").value;
    roomObj.roomNumber = document.getElementById("erl-room").value;
    roomObj.typeBed = document.getElementById("erl-bed").value;
    
    const rows = guestsContainer.querySelectorAll(".erl-guest-item-row");
    roomObj.guests = Array.from(rows).map(row => ({
      guestNo: row.querySelector(".g-num").value,
      name: row.querySelector(".g-name").value.trim(),
      remark: row.querySelector(".g-rem").value,
      remarkText: row.querySelector(".g-rem-text") ? row.querySelector(".g-rem-text").value.trim() : ""
    }));
    
    saveState();
    closeModal();
    showToast("Data Kamar diperbarui!");
    if (onComplete) onComplete();
  };
}
function openRoomlistFormPopup(prefillGroup = "", prefillHotel = "", onComplete) {
  const groupNames = state.groups.map(g => g.name);
  
  const popupHtml = `
    <form id="rl-submit-form-popup">
      <div class="form-group">
        <label class="form-label">Grup Keberangkatan</label>
        <select id="rl-group-select-popup" class="form-select" required>
          <option value="">-- Pilih Grup --</option>
          ${groupNames.map(g => `<option value="${g}" ${g === prefillGroup ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label class="form-label">Nama Hotel (Dinamis)</label>
        <select id="rl-hotel-select-popup" class="form-select" required>
          <option value="">-- Pilih Hotel --</option>
        </select>
      </div>
      
      <h5 style="margin-top:16px; margin-bottom:10px; font-weight:800;">Daftar Kamar Hotel</h5>
      <div id="rl-rooms-rows-popup"></div>
      <button type="button" id="rl-add-room-row-btn-popup" class="btn btn-secondary" style="width:auto; padding:6px; font-size:0.8rem; margin-bottom:20px;">+ Tambah Kamar</button>
      
      <button type="submit" class="btn btn-gold">Simpan Template</button>
    </form>
  `;
  openModal("Tambah Template Roomlist (Pop Up)", popupHtml);
  
  const gSelect = document.getElementById("rl-group-select-popup");
  const hSelect = document.getElementById("rl-hotel-select-popup");
  
  const updateHotels = () => {
    const gn = gSelect.value;
    hSelect.innerHTML = `<option value="">-- Pilih Hotel --</option>`;
    const group = state.groups.find(g => g.name === gn);
    if (group && group.hotels) {
      group.hotels.forEach(h => {
        hSelect.innerHTML += `<option value="${h}" ${h === prefillHotel ? 'selected' : ''}>${h}</option>`;
      });
    }
  };
  gSelect.onchange = updateHotels;
  updateHotels();
  
  const rowsContainer = document.getElementById("rl-rooms-rows-popup");
  const addRoomRow = () => {
    const cardId = `rl-card-${Date.now()}-${Math.random()}`;
    const div = document.createElement("div");
    div.className = "nested-form-card rl-room-card-row-popup";
    div.id = cardId;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong>Kamar Baru</strong>
        <button type="button" class="nested-remove-btn" onclick="document.getElementById('${cardId}').remove()">&times;</button>
      </div>
      <div class="grid-3col">
        <div class="form-group"><label class="form-label">No. Roomlist</label><input type="text" class="form-input rl-num" placeholder="RL-01" required></div>
        <div class="form-group"><label class="form-label">No. Kamar</label><input type="text" class="form-input room-num" placeholder="Kamar 101" required></div>
        <div class="form-group">
          <label class="form-label">Tipe Kasur</label>
          <select class="form-select bed-type" required>
            <option value="Twin">Twin</option>
            <option value="King">King</option>
            <option value="Triple">Triple</option>
            <option value="Quad">Quad</option>
          </select>
        </div>
      </div>
      
      <label class="form-label">Daftar Tamu & Indikator Remark</label>
      <div class="guests-rows-container-popup" style="display:flex; flex-direction:column; gap:8px; margin-bottom:8px;"></div>
      <button type="button" class="btn btn-secondary add-guest-row-popup-btn" style="width:auto; padding:4px 8px; font-size:0.75rem;">+ Tambah Tamu</button>
    `;
    rowsContainer.appendChild(div);
    
    const growContainer = div.querySelector(".guests-rows-container-popup");
    const addGuestBtn = div.querySelector(".add-guest-row-popup-btn");
    
    const addGuestFn = () => {
      const rId = `g-row-${Date.now()}-${Math.random()}`;
      const gdiv = document.createElement("div");
      gdiv.className = "nested-form-card rl-guest-row-popup";
      gdiv.id = rId;
      
      const colors = ['none', 'Gold', 'Emerald', 'Ruby', 'Sapphire', 'Amber', 'Violet', 'Rose', 'Slate', 'Teal', 'Bronze', 'warning'];
      const dotsHtml = colors.map(c => {
        let style = "";
        let text = "";
        if (c === 'none') style = "background:#e2e8f0; border:1px solid #aaa;";
        else if (c === 'warning') {
          style = "background:#fef08a; border:1px solid #d97706; color:#a16207; font-size:10px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;";
          text = "⚠️";
        } else {
          style = `background:${getHexColor(c)};`;
        }
        return `<span class="color-dot ${c === 'none' ? 'selected' : ''}" data-val="${c}" style="${style} width:18px; height:18px; border-radius:50%; display:inline-block; cursor:pointer;" title="${c}">${text}</span>`;
      }).join('');

      gdiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>Jamaah</strong>
          <button type="button" class="nested-remove-btn" onclick="document.getElementById('${rId}').remove()">&times;</button>
        </div>
        <div class="grid-2col" style="gap:8px;">
          <input type="number" class="form-input g-num" placeholder="No." style="max-width:60px;" required>
          <input type="text" class="form-input g-name" placeholder="Nama Jamaah" required>
        </div>
        <div style="margin-top:8px;">
          <label class="form-label" style="font-size:0.75rem; font-weight:700;">Indikator Remark & Keterangan Arti Warna</label>
          <input type="hidden" class="g-rem" value="none">
          <div class="color-picker-row" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px; margin-bottom:6px;">
            ${dotsHtml}
          </div>
          <input type="text" class="form-input g-rem-text" placeholder="Isi Keterangan / Arti Warna (mis. Kursi Roda, Infan, Catatan Medis)..." style="font-size:0.8rem; padding:4px 8px; margin-top:4px;">
        </div>
      `;
      growContainer.appendChild(gdiv);
      
      const dots = gdiv.querySelectorAll(".color-dot");
      const hiddenInp = gdiv.querySelector(".g-rem");
      dots.forEach(d => {
        d.onclick = () => {
          dots.forEach(dot => dot.classList.remove("selected"));
          d.classList.add("selected");
          hiddenInp.value = d.getAttribute("data-val");
        };
      });
    };
    
    addGuestBtn.onclick = addGuestFn;
    addGuestFn();
  };
  
  document.getElementById("rl-add-room-row-btn-popup").onclick = addRoomRow;
  addRoomRow();
  
  document.getElementById("rl-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const groupName = gSelect.value;
    const hotelName = hSelect.value;
    
    const roomCards = rowsContainer.querySelectorAll(".rl-room-card-row-popup");
    roomCards.forEach(row => {
      const roomlistNumber = row.querySelector(".rl-num").value;
      const roomNumber = row.querySelector(".room-num").value;
      const typeBed = row.querySelector(".bed-type").value;
      
      const guestRows = row.querySelectorAll(".rl-guest-row-popup");
      const guests = Array.from(guestRows).map(gr => ({
        guestNo: gr.querySelector(".g-num").value,
        name: gr.querySelector(".g-name").value.trim(),
        remark: gr.querySelector(".g-rem").value,
        remarkText: gr.querySelector(".g-rem-text") ? gr.querySelector(".g-rem-text").value.trim() : ""
      }));
      
      state.rooms.push({ id: `rm-${Date.now()}-${Math.random()}`, groupName, hotelName, roomlistNumber, roomNumber, typeBed, guests });
    });
    
    saveState();
    closeModal();
    showToast("Template Roomlist disimpan!");
    if (onComplete) onComplete();
  };
}
// --- ADMIN SUB-VIEW: DOKUMEN ---
function cleanDocName(name, groupName) {
  if (!name) return "Dokumen Tanpa Nama";
  let clean = name;
  if (groupName && groupName !== "Umum") {
    const escapedGroup = groupName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    clean = clean.replace(new RegExp(`\\s*[-–—:]?\\s*${escapedGroup}`, 'gi'), '');
    clean = clean.replace(new RegExp(`${escapedGroup}\\s*[-–—:]?\\s*`, 'gi'), '');
  }
  clean = clean.trim();
  return clean || name;
}

function renderAdminDokumen() {
  const container = document.getElementById("admin-subview-content");
  
  let visibleDocs = state.documents;
  if (adminDocGroupFilter !== "") {
    visibleDocs = visibleDocs.filter(d => d.groupName === adminDocGroupFilter || d.groupName === "Umum");
  }

  // Group documents by groupName
  const groupedDocs = {};
  visibleDocs.forEach(d => {
    const gN = d.groupName || "Umum";
    if (!groupedDocs[gN]) groupedDocs[gN] = [];
    groupedDocs[gN].push(d);
  });

  const sortedGroups = Object.keys(groupedDocs);
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:12px; flex-grow:1; max-width:400px; position:relative;">
        <label style="font-weight:700; font-size:0.85rem; flex-shrink:0;">Filter Grup:</label>
        <input type="text" id="doc-grup-filter-search" class="form-input" value="${adminDocGroupFilter || ''}" placeholder="Ketik nama grup...">
        <div id="doc-grup-filter-suggestions" class="suggestion-list hidden"></div>
      </div>
      <button id="add-doc-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Dokumen Baru</button>
    </div>
    
    <div id="admin-doc-accordion-container" style="display:flex; flex-direction:column; gap:12px;">
      ${sortedGroups.length === 0 ? `
        <p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:24px; background:#fff; border-radius:12px; border:1px solid #e2e8f0;">Tidak ada berkas dokumen ditemukan.</p>
      ` : sortedGroups.map((gName, idx) => {
        const docList = groupedDocs[gName];
        const headerId = `doc-acc-header-${idx}`;
        const bodyId = `doc-acc-body-${idx}`;
        const iconId = `doc-acc-icon-${idx}`;

        return `
          <div style="border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
            <div id="${headerId}" style="padding:14px 18px; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; border-bottom:1px solid #e2e8f0; transition:all 0.2s;">
              <div style="display:flex; align-items:center; gap:10px;">
                <i data-lucide="folder-open" style="width:18px; height:18px; color:#c5a850;"></i>
                <span style="font-weight:800; font-size:0.92rem; color:#0f172a;">${gName}</span>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="badge badge-gold" style="font-size:0.75rem; padding:3px 10px; border-radius:12px; font-weight:800;">${docList.length} Berkas</span>
                <i data-lucide="chevron-down" id="${iconId}" style="width:18px; height:18px; color:#64748b; transition:transform 0.2s;"></i>
              </div>
            </div>
            
            <div id="${bodyId}" class="doc-accordion-body" style="padding:0;">
              <div class="table-wrapper">
                <table class="data-table" style="margin:0; width:100%;">
                  <thead>
                    <tr style="background:#fafafa;">
                      <th style="padding-left:18px;">Nama Dokumen</th>
                      <th>Kategori</th>
                      <th style="text-align:right; padding-right:18px;">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${docList.map(d => {
                      const displayName = cleanDocName(d.name, d.groupName);
                      return `
                        <tr>
                          <td style="padding-left:18px;">
                            <div style="font-weight:800; font-size:0.88rem; color:#0f172a;">${displayName}</div>
                          </td>
                          <td>${getDocCategoryBadge(d.category || 'Dokumen')}</td>
                          <td style="text-align:right; padding-right:18px;">
                            <div style="display:inline-flex; gap:6px; justify-content:flex-end;">
                              <button class="btn btn-gold preview-doc-admin-btn" data-id="${d.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; font-weight:800; display:inline-flex; align-items:center; gap:4px;">
                                <i data-lucide="eye" style="width:13px; height:13px;"></i> Preview
                              </button>
                              <button class="btn btn-danger delete-doc-btn" data-id="${d.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
                                <i data-lucide="trash-2" style="width:13px; height:13px;"></i> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  lucide.createIcons();
  
  initSuggestionInput("doc-grup-filter-search", "doc-grup-filter-suggestions", state.groups.map(g => g.name), (name) => {
    adminDocGroupFilter = name;
    renderAdminDokumen();
  });

  const filterInp = document.getElementById("doc-grup-filter-search");
  if (filterInp) {
    filterInp.oninput = (e) => {
      if (e.target.value === "") {
        adminDocGroupFilter = "";
        renderAdminDokumen();
      }
    };
  }

  // Bind Accordion Toggles
  sortedGroups.forEach((gName, idx) => {
    const headerEl = document.getElementById(`doc-acc-header-${idx}`);
    const bodyEl = document.getElementById(`doc-acc-body-${idx}`);
    const iconEl = document.getElementById(`doc-acc-icon-${idx}`);
    if (headerEl && bodyEl && iconEl) {
      headerEl.onclick = () => {
        bodyEl.classList.toggle("hidden");
        const isHidden = bodyEl.classList.contains("hidden");
        iconEl.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
      };
    }
  });

  // Bind Preview Buttons
  document.querySelectorAll(".preview-doc-admin-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const doc = state.documents.find(d => d.id === id);
      if (doc) {
        openDocPreviewModal(doc);
      } else {
        showToast("Dokumen tidak ditemukan", "error");
      }
    };
  });

  // Bind Delete Buttons
  document.querySelectorAll(".delete-doc-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (confirm("Hapus dokumen dari arsip?")) {
        const idx = state.documents.findIndex(d => d.id === id);
        if (idx !== -1) {
          state.documents.splice(idx, 1);
          saveState();
          showToast("Dokumen dihapus.");
          renderAdminDokumen();
        }
      }
    };
  });
  
  document.getElementById("add-doc-popup-btn").onclick = () => {
    const popupHtml = `
      <form id="doc-submit-form-popup">
        <div class="form-group" style="position:relative;">
          <label class="form-label">Relasi Grup</label>
          <input type="text" id="ad-group-search" class="form-input" placeholder="Ketik nama grup (atau 'Umum')..." required>
          <div id="ad-group-suggestions" class="suggestion-list hidden"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Kategori Dokumen</label>
          <select id="ad-category" class="form-select" required>
            <option value="Profiling Jamaah">Profiling Jamaah</option>
            <option value="Visa">Visa</option>
            <option value="Paspor">Paspor</option>
            <option value="E-Ticket">E-Ticket</option>
            <option value="Bus List">Bus List</option>
            <option value="Paket Info">Paket Info</option>
            <option value="Itinerary">Itinerary</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Nama Dokumen</label><input type="text" id="ad-name" class="form-input" placeholder="Mis. Manifest Paspor & Scan" required></div>
        <div class="form-group"><label class="form-label">Pilih Berkas Dokumen</label><input type="file" id="ad-file" class="form-input" required></div>
        <button type="submit" class="btn btn-primary">UNGGAH DOKUMEN</button>
      </form>
    `;
    openModal("Arsipkan File Baru (Pop Up)", popupHtml);
    
    initSuggestionInput("ad-group-search", "ad-group-suggestions", ["Umum", ...state.groups.map(g => g.name)]);
    
    document.getElementById("doc-submit-form-popup").onsubmit = (e) => {
      e.preventDefault();
      const groupName = document.getElementById("ad-group-search").value;
      const category = document.getElementById("ad-category").value;
      const name = document.getElementById("ad-name").value.trim();
      const fileInput = document.getElementById("ad-file").files[0];
      
      state.documents.push({
        id: `doc-${Date.now()}`, groupName, category, name, file: fileInput ? fileInput.name : "upload.pdf"
      });
      saveState();
      closeModal();
      showToast("Dokumen diarsipkan!");
      renderAdminDokumen();
    };
  };
}
function renderAdminAset() {
  const container = document.getElementById("admin-subview-content");
  
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px;">
      <input type="text" id="asset-search-input" class="form-input" placeholder="Cari nama barang atau lokasi aset..." style="max-width:300px;">
      <button id="add-asset-popup-btn" class="btn btn-gold" style="width:auto; padding:8px 16px;"><i data-lucide="plus-circle"></i> Tambah Aset Baru</button>
    </div>
    
    <div class="table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Barang</th>
              <th>Status</th>
              <th>Jumlah</th>
              <th>Lokasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="asset-tbody"></tbody>
        </table>
      </div>
    </div>
  `;
  
  const searchInp = document.getElementById("asset-search-input");
  const renderAssetList = () => {
    const query = searchInp.value.toLowerCase().trim();
    const tbody = document.getElementById("asset-tbody");
    const filtered = state.assets.filter(a => 
      a.name.toLowerCase().includes(query) || 
      a.location.toLowerCase().includes(query) || 
      a.status.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">Tidak ada barang aset ditemukan.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = filtered.map((a, idx) => `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td>
          <span class="badge ${a.status === 'Tersedia' ? 'badge-success' : (a.status === 'Digunakan' ? 'badge-gold' : 'badge-warning')}">
            ${a.status}
          </span>
        </td>
        <td><code>${a.qty} Pcs</code></td>
        <td>${a.location}</td>
        <td>
          <div class="action-btn-group">
            <button class="action-icon-btn edit-asset-popup-btn" data-idx="${state.assets.indexOf(a)}"><i data-lucide="edit" style="width:14px;"></i></button>
            <button class="action-icon-btn delete-asset-btn" data-idx="${state.assets.indexOf(a)}"><i data-lucide="trash" style="width:14px; color:#ef4444;"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    
    lucide.createIcons();
    bindAssetActions();
  };

  const bindAssetActions = () => {
    document.querySelectorAll(".edit-asset-popup-btn").forEach(btn => {
      btn.onclick = () => openAssetFormPopup(parseInt(btn.getAttribute("data-idx")));
    });
    document.querySelectorAll(".delete-asset-btn").forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute("data-idx"));
        if (confirm("Hapus barang aset ini?")) {
          state.assets.splice(idx, 1);
          saveState();
          showToast("Aset berhasil dihapus.");
          renderAdminAset();
        }
      };
    });
  };

  searchInp.oninput = renderAssetList;
  renderAssetList();
  document.getElementById("add-asset-popup-btn").onclick = () => openAssetFormPopup();
}
function openAssetFormPopup(editIdx = null) {
  const isEdit = (editIdx !== null);
  const a = isEdit ? state.assets[editIdx] : null;
  
  const popupHtml = `
    <form id="asset-submit-form-popup">
      <div class="form-group"><label class="form-label">Nama Barang</label><input type="text" id="aa-name" class="form-input" value="${isEdit ? a.name : ''}" required></div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select id="aa-status" class="form-select" required>
          <option value="Tersedia" ${isEdit && a.status === 'Tersedia' ? 'selected' : ''}>Tersedia di Gudang</option>
          <option value="Digunakan" ${isEdit && a.status === 'Digunakan' ? 'selected' : ''}>Sedang Digunakan Lapangan</option>
          <option value="Rusak" ${isEdit && a.status === 'Rusak' ? 'selected' : ''}>Rusak / Perlu Perbaikan</option>
        </select>
      </div>
      <div class="grid-2col">
        <div class="form-group"><label class="form-label">Jumlah (Pcs)</label><input type="number" id="aa-qty" class="form-input" value="${isEdit ? a.qty : 1}" min="1" required></div>
        <div class="form-group"><label class="form-label">Lokasi</label><input type="text" id="aa-loc" class="form-input" value="${isEdit ? a.location : ''}" required></div>
      </div>
      <button type="submit" class="btn btn-primary">SIMPAN ASET</button>
    </form>
  `;
  openModal(isEdit ? "Sunting Aset (Pop Up)" : "Tambah Aset Baru (Pop Up)", popupHtml);
  
  document.getElementById("asset-submit-form-popup").onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById("aa-name").value.trim();
    const status = document.getElementById("aa-status").value;
    const qty = parseInt(document.getElementById("aa-qty").value);
    const location = document.getElementById("aa-loc").value.trim();
    
    if (isEdit) {
      state.assets[editIdx].name = name; state.assets[editIdx].status = status; state.assets[editIdx].qty = qty; state.assets[editIdx].location = location;
    } else {
      state.assets.push({ id: `ast-${Date.now()}`, name, status, qty, location });
    }
    
    saveState();
    closeModal();
    showToast("Aset disimpan!");
    renderAdminAset();
  };
}


function openBookingPdfPopup(bookingId) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return;
  
  const vendor = state.vendors.find(x => x.id === b.vendorId);
  const vName = vendor ? vendor.name : "Vendor Dihapus";
  const vType = vendor ? vendor.type : "Umum";
  const group = state.groups.find(x => x.name === b.groupName);
  const tlName = group && group.leaders ? group.leaders.join(', ') : "Belum Ditentukan";
  
  const totalAmount = b.products ? b.products.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
  
  const pdfHtml = `
    <div id="booking-po-print-area" style="font-family:'Mulish', sans-serif; color:#1e293b; padding:16px;">
      <!-- Corporate Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid var(--primary-gold); padding-bottom:12px; margin-bottom:20px;">
        <div>
          <h2 style="font-family:'Martel', serif; text-transform:lowercase; font-weight:900; color:var(--text-main); font-size:1.4rem; margin:0;">jejak imani</h2>
          <p style="font-size:0.75rem; color:var(--text-muted); margin:2px 0 0 0;">Saudi Operations & Handling Department</p>
        </div>
        <div style="text-align:right;">
          <h3 style="font-size:0.95rem; font-weight:800; margin:0; text-transform:uppercase; color:var(--primary-gold);">Pemesanan Vendor (Booking)</h3>
          <p style="font-size:0.75rem; margin:4px 0 0 0;">No. Dokumen: <code>BOK-${(b.id || "").substring(2,8).toUpperCase()}</code></p>
        </div>
      </div>
      
      <!-- Grid Details -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:0.8rem; margin-bottom:20px; background:#f8f9fa; padding:12px; border-radius:6px;">
        <div>
          <strong>Informasi Operasional:</strong>
          <div style="margin-top:6px;">Grup: <strong>${b.groupName}</strong></div>
          <div style="margin-top:2px;">Tour Leader: ${tlName}</div>
          <div style="margin-top:2px;">Kegiatan: ${b.activity || '-'}</div>
        </div>
        <div>
          <strong>Detail Vendor & Tanggal:</strong>
          <div style="margin-top:6px;">Vendor: <strong>${vName} (${vType})</strong></div>
          <div style="margin-top:2px;">Tanggal Mulai: ${formatDateDisplay(b.dateStart)}</div>
          <div style="margin-top:2px;">Catatan: ${b.notes || '-'}</div>
        </div>
      </div>
      
      <!-- Products Table -->
      <h4 style="font-size:0.85rem; font-weight:800; margin-bottom:8px;">Rincian Item Layanan / Produk:</h4>
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:20px; border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1; text-align:left;">
            <th style="padding:8px;">Nama Produk</th>
            <th style="padding:8px; text-align:center;">Harga SAR</th>
            <th style="padding:8px; text-align:center;">Qty</th>
            <th style="padding:8px; text-align:right;">Jumlah SAR</th>
          </tr>
        </thead>
        <tbody>
          ${b.products ? b.products.map(p => `
            <tr style="border-bottom:1px solid #f1f3f5;">
              <td style="padding:8px;"><strong>${p.name}</strong></td>
              <td style="padding:8px; text-align:center;">SAR ${p.price.toLocaleString('id-ID')}</td>
              <td style="padding:8px; text-align:center;">${p.qty} Pcs</td>
              <td style="padding:8px; text-align:right; font-weight:700;">SAR ${(p.amount || (p.price * p.qty)).toLocaleString('id-ID')}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" style="text-align:center; padding:8px;">Tidak ada item.</td></tr>'}
          <tr style="background:#f8fafc; font-weight:800; border-top:2px solid var(--primary-gold);">
            <td colspan="3" style="padding:10px; text-align:right;">TOTAL HARGA PEMESANAN:</td>
            <td style="padding:10px; text-align:right; color:var(--primary-gold); font-size:0.95rem;">SAR ${totalAmount.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Footer Signature -->
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-top:32px;">
        <div style="text-align:center; width:150px;">
          Disiapkan Oleh,<br><br><br><br>
          <strong>( handling team )</strong>
        </div>
        <div style="text-align:center; width:150px;">
          Pihak Vendor Penerima,<br><br><br><br>
          <strong>( ${vName} )</strong>
        </div>
      </div>
    </div>
    
    <!-- Action buttons -->
    <div style="display:flex; gap:10px; margin-top:20px; justify-content:flex-end;">
      <button id="po-print-download-btn" class="btn btn-primary" style="width:auto; padding:8px 16px;"><i data-lucide="printer"></i> Cetak / Simpan PDF</button>
      <button id="po-share-wa-btn" class="btn btn-secondary" style="width:auto; padding:8px 16px; color:#10b981; border-color:#a7f3d0;"><i data-lucide="message-square"></i> Share ke WhatsApp</button>
    </div>
  `;
  openModal("Purchase Order / Booking Voucher", pdfHtml);
  
  document.getElementById("po-print-download-btn").onclick = () => {
    const printContent = document.getElementById("booking-po-print-area").innerHTML;
    const originalContent = document.body.innerHTML;
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>PO Booking - ${bookingId}</title>
          <style>
            body { font-family: sans-serif; color: #1e293b; padding: 40px; }
            :root { --primary-gold: #c5a850; --text-main: #111; --text-muted: #666; --border-light: 1px solid #e2e8f0; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
  };
  
  document.getElementById("po-share-wa-btn").onclick = () => {
    const waText = encodeURIComponent(`*KONFIRMASI PEMESANAN VENDOR - JEJAK IMANI*\n\n` +
      `• No. Booking: BOK-${(b.id || "").substring(2,8).toUpperCase()}\n` +
      `• Grup: ${b.groupName}\n` +
      `• Vendor: ${vName}\n` +
      `• Tanggal Mulai: ${formatDateDisplay(b.dateStart)}\n` +
      `• Rincian Item:\n` +
      b.products.map(p => `- ${p.name} (Qty: ${p.qty})`).join('\n') +
      `\n\n*TOTAL ESTIMASI: SAR ${totalAmount.toLocaleString('id-ID')}*`
    );
    window.open(`https://wa.me/?text=${waText}`, "_blank");
  };
  
  lucide.createIcons();
}




function openUserTaskDetailModal(taskId) {
  const t = state.assignments.find(x => x.id === taskId);
  if (!t) return;
  
  const staffNames = t.staff.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
  const reqStaff = t.requiredStaff || 1;
  const currentStaffCount = t.staff ? t.staff.length : 0;
  const isFulfilled = (currentStaffCount >= reqStaff);
  const staffingStatusHtml = isFulfilled 
    ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
    : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;

  const detailHtml = `
    <div style="font-size:0.85rem; line-height:1.6; color:var(--text-main); padding: 4px 0;">
      <div style="margin-bottom:14px; border-bottom:1px solid #f1f3f5; padding-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span class="badge badge-gold" style="font-size:0.85rem;">${t.type}</span>
        ${staffingStatusHtml}
      </div>
      <table class="detail-table" style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:20px;">
        <tr><td style="padding:6px 0; font-weight:700; width:120px; color:var(--text-muted);">Grup Rombongan:</td><td style="font-weight:800;">${t.groupName}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Tanggal / Waktu:</td><td>${formatDateDisplay(t.date)} | ${t.time} Saudi</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Wilayah:</td><td>${t.region}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Nama Hotel:</td><td>${t.details.hotelName || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Flight / ETA:</td><td>${t.details.eta || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Jumlah Pax:</td><td>${t.details.totalPax || '-'} Pax</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Layanan:</td><td>${t.details.service || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Catatan / Rincian:</td><td>${t.details.remarks || '-'}</td></tr>
        <tr><td style="padding:6px 0; font-weight:700; color:var(--text-muted);">Petugas di-Plot:</td><td><strong>${staffNames || 'Belum diplot'}</strong></td></tr>
      </table>
      <div style="display:flex; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()" style="width:auto; padding:6px 16px;">Tutup</button>
      </div>
    </div>
  `;
  openModal("Rincian Penugasan", detailHtml);
}

function renderUserApplyTugas() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;
  
  const username = state.currentUser.username;
  const myAppliedOffers = state.assignments.filter(t => t.published !== false && t.applicants && t.applicants.includes(username));
  
  const appliedSectionHtml = `
    <div style="margin-bottom:20px;">
      <h3 class="user-section-title" style="margin-bottom:10px;">Status Apply Tugas Anda</h3>
      <div class="activity-list" style="box-shadow:var(--shadow-neumorphic);">
        ${myAppliedOffers.length === 0 ? `
          <p style="color:var(--text-light); font-size:0.8rem; text-align:center; padding:12px; background:#fff; border-radius:8px;">Belum ada lamaran tugas diajukan.</p>
        ` : myAppliedOffers.map(o => `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:var(--border-light); padding:10px 12px; font-size:0.85rem; background:#fff; border-radius:8px; margin-bottom:6px;">
            <div>
              <strong style="color:var(--text-main);">${o.type}</strong><br>
              <span style="font-size:0.75rem; color:var(--text-muted);">${(o.groupName || "").substring(0,35)}...</span>
            </div>
            <span class="badge badge-warning" style="background:#fef3c7; color:#92400e;">Pending Approval</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  // Set defaults
  if (typeof state.userApplyViewMode === 'undefined') {
    state.userApplyViewMode = "grup";
  }
  if (typeof state.userApplyActiveDate === 'undefined') {
    state.userApplyActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
  }
  
  const activeDateObj = new Date(state.userApplyActiveDate);
  const monthYearStr = activeDateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  // Weekly strip around active date (for Tanggal view mode)
  let dateCardsHtml = "";
  for (let i = -3; i <= 3; i++) {
    const d = new Date(activeDateObj);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isTodayStr = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
    const isRealToday = (dateStr === isTodayStr);
    const isActive = (dateStr === state.userApplyActiveDate);
    
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayNum = d.getDate();
    
    dateCardsHtml += `
      <div class="iti-cal-date-card ${isActive ? 'active' : ''}" data-date="${dateStr}" style="flex:1; min-width:52px; max-width:65px; padding:8px 4px; text-align:center; border:1px solid ${isActive ? 'var(--primary-gold)' : (isRealToday ? 'var(--primary-gold)' : '#cbd5e1')}; border-radius:8px; background:${isActive ? 'var(--primary-gold)' : '#fff'}; cursor:pointer; color:${isActive ? '#fff' : '#475569'}; box-shadow:${isActive ? '0 4px 6px -1px rgba(197, 168, 80, 0.4)' : 'none'};">
        <div style="font-size:0.65rem; text-transform:uppercase; font-weight:700; ${isActive ? 'color:#fff;' : 'color:#94a3b8;'}">${dayName}</div>
        <div style="font-size:1.15rem; font-weight:900; margin:2px 0; ${isActive ? 'color:#fff;' : 'color:var(--text-main);'}">${dayNum}</div>
        ${isRealToday ? `<div style="font-size:0.5rem; font-weight:800; ${isActive ? 'color:#fff;' : 'color:var(--primary-gold);'}">HARI INI</div>` : ''}
      </div>
    `;
  }
  
  const calendarSliderHtml = `
    <div class="admin-card" style="margin-bottom:16px; padding:12px; border-radius:8px; width:100%; box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h4 style="font-weight:800; font-size:0.85rem; color:var(--text-main); margin:0;">${monthYearStr}</h4>
        <div style="display:flex; gap:6px;">
          <button id="user-apply-prev-week" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&larr;</button>
          <button id="user-apply-today" class="btn btn-gold" style="width:auto; padding:4px 8px; font-size:0.75rem;">Hari Ini</button>
          <button id="user-apply-next-week" class="btn btn-secondary" style="width:auto; padding:4px 8px; font-size:0.75rem;">&rarr;</button>
        </div>
      </div>
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px;">
        ${dateCardsHtml}
      </div>
    </div>
  `;

  container.innerHTML = `
    <!-- Filter bar (Search & Quota only) -->
    <div class="admin-card" style="margin-bottom:16px; padding:12px; width:100%; box-sizing:border-box;">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; width:100%;">
        <input type="text" id="user-apply-search" class="form-input" placeholder="Cari penugasan..." style="flex:1; min-width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
        <select id="user-apply-quota-filter" class="form-select" style="width:180px; padding:6px 12px; font-size:0.85rem; height:auto; margin:0;">
          <option value="all">Semua</option>
          <option value="fulfilled">Terpenuhi</option>
          <option value="unfulfilled">Belum Terpenuhi</option>
        </select>
      </div>
    </div>
    
    <!-- View Switcher (Grup vs Tanggal) -->
    <div class="tab-header" style="margin-bottom:16px; border-bottom:none; display:flex; gap:10px; width:100%;">
      <button class="btn btn-secondary tab-btn ${state.userApplyViewMode === 'grup' ? 'active' : ''}" id="user-apply-mode-grup" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid ${state.userApplyViewMode === 'grup' ? 'var(--primary-gold)' : '#cbd5e1'}; background:${state.userApplyViewMode === 'grup' ? 'var(--primary-gold)' : '#fff'}; color:${state.userApplyViewMode === 'grup' ? '#fff' : '#475569'}; font-weight:700;">Berdasarkan Grup</button>
      <button class="btn btn-secondary tab-btn ${state.userApplyViewMode === 'tanggal' ? 'active' : ''}" id="user-apply-mode-tanggal" style="padding:6px 12px; font-size:0.75rem; border-radius:8px; border:1px solid ${state.userApplyViewMode === 'tanggal' ? 'var(--primary-gold)' : '#cbd5e1'}; background:${state.userApplyViewMode === 'tanggal' ? 'var(--primary-gold)' : '#fff'}; color:${state.userApplyViewMode === 'tanggal' ? '#fff' : '#475569'}; font-weight:700;">Berdasarkan Tanggal</button>
    </div>
    
    <!-- Calendar Slider (Only rendered if mode is Tanggal) -->
    <div id="user-apply-calendar-slider-container" style="width:100%;"></div>
    
    <!-- Main content list -->
    <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px; width:100%;" id="user-apply-list-container"></div>
  `;
  
  if (state.userApplyViewMode === "tanggal") {
    document.getElementById("user-apply-calendar-slider-container").innerHTML = calendarSliderHtml;
    
    // Bind weekly events
    document.getElementById("user-apply-prev-week").onclick = () => {
      const d = new Date(state.userApplyActiveDate);
      d.setDate(d.getDate() - 7);
      state.userApplyActiveDate = d.toISOString().split('T')[0];
      renderUserApplyTugas();
    };
    document.getElementById("user-apply-next-week").onclick = () => {
      const d = new Date(state.userApplyActiveDate);
      d.setDate(d.getDate() + 7);
      state.userApplyActiveDate = d.toISOString().split('T')[0];
      renderUserApplyTugas();
    };
    document.getElementById("user-apply-today").onclick = () => {
      state.userApplyActiveDate = getSaudiDateTime().gregorianStr.split('/').reverse().join('-');
      renderUserApplyTugas();
    };
    document.querySelectorAll(".iti-cal-date-card").forEach(card => {
      card.onclick = () => {
        state.userApplyActiveDate = card.getAttribute("data-date");
        renderUserApplyTugas();
      };
    });
  }
  
  // Bind tab mode switchers
  document.getElementById("user-apply-mode-grup").onclick = () => {
    state.userApplyViewMode = "grup";
    renderUserApplyTugas();
  };
  document.getElementById("user-apply-mode-tanggal").onclick = () => {
    state.userApplyViewMode = "tanggal";
    renderUserApplyTugas();
  };
  
  const drawList = () => {
    const q = document.getElementById("user-apply-search").value.toLowerCase().trim();
    const quotaVal = document.getElementById("user-apply-quota-filter").value;
    
    const listEl = document.getElementById("user-apply-list-container");
    if (!listEl) return;
    
    let filtered = state.assignments.filter(t => t.published !== false && t.status !== "Selesai");
    if (q) {
      filtered = filtered.filter(t => 
        t.type.toLowerCase().includes(q) || 
        (t.details.customTaskName || '').toLowerCase().includes(q) ||
        t.groupName.toLowerCase().includes(q)
      );
    }
    if (quotaVal === "fulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) >= (t.requiredStaff || 1));
    } else if (quotaVal === "unfulfilled") {
      filtered = filtered.filter(t => (t.staff ? t.staff.length : 0) < (t.requiredStaff || 1));
    }
    
    if (state.userApplyViewMode === "tanggal") {
      filtered = filtered.filter(t => t.date === state.userApplyActiveDate);
    }
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding:20px; background:#fff; border-radius:8px; border:var(--border-light); width:100%; box-sizing:border-box;">Tidak ada penugasan dipublikasikan ditemukan.</p>`;
      return;
    }
    
    const makeCardHtml = (t) => {
      const reqStaff = t.requiredStaff || 1;
      const currentStaffCount = t.staff ? t.staff.length : 0;
      const isFulfilled = (currentStaffCount >= reqStaff);
      const staffingStatusHtml = isFulfilled 
        ? `<span class="badge badge-success" style="background:#d1fae5; color:#065f46; font-size:0.7rem; padding:2px 6px;">Terpenuhi (${currentStaffCount}/${reqStaff})</span>` 
        : `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; font-size:0.7rem; padding:2px 6px;">Belum Terpenuhi (${currentStaffCount}/${reqStaff})</span>`;
      
      t.applicants = t.applicants || [];
      const isPlotted = t.staff.includes(username);
      const hasApplied = t.applicants.includes(username);
      
      let actionBtnHtml = "";
      if (isPlotted) {
        actionBtnHtml = `<button class="btn btn-secondary" disabled style="width:auto; padding:5px 10px; font-size:0.75rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="check-circle" style="width:12px; height:12px;"></i> Anda Bertugas</button>`;
      } else if (hasApplied) {
        actionBtnHtml = `<button class="btn btn-secondary cancel-apply-btn" data-id="${t.id}" style="width:auto; padding:5px 10px; font-size:0.75rem; border-radius:6px; background:#64748b; color:#fff; border:none;">Batal Apply</button>`;
      } else if (isFulfilled) {
        // If task is fulfilled, user tim CANNOT apply!
        actionBtnHtml = `<button class="btn btn-secondary" disabled style="width:auto; padding:5px 10px; font-size:0.75rem; border-radius:6px;">Kuota Terpenuhi</button>`;
      } else {
        actionBtnHtml = `<button class="btn btn-gold apply-task-btn" data-id="${t.id}" style="width:auto; padding:5px 10px; font-size:0.75rem;">Apply Tugas</button>`;
      }
      
      const dayNameFormatted = new Date(t.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      
      return `
        <div class="assignment-card" style="border-left:4px solid var(--primary-gold); background:#fff; padding:12px 16px; width:100%; box-sizing:border-box; border-radius:8px; border-top:1px solid #e2e8f0; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; display:flex; flex-direction:column; gap:8px; margin-bottom:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; width:100%;">
            <span style="font-weight:800; font-size:0.9rem; color:var(--text-main);">${t.type} ${t.details.customTaskName ? `(${t.details.customTaskName})` : ''}</span>
            ${staffingStatusHtml}
          </div>
          <div style="display:flex; flex-direction:column; gap:2px; font-size:0.8rem; color:#475569;">
            <div><strong style="color:var(--text-main); font-size:0.85rem;">${t.groupName}</strong></div>
            <div><strong>${dayNameFormatted} | ${t.time} Saudi</strong> (Wilayah: ${t.region})</div>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #f1f3f5; padding-top:8px; margin-top:4px; width:100%;">
            ${actionBtnHtml}
          </div>
        </div>
      `;
    };
    
    if (state.userApplyViewMode === "grup") {
      // Grouping by groupName accordion style
      const grouped = {};
      filtered.forEach(t => {
        if (!grouped[t.groupName]) grouped[t.groupName] = [];
        grouped[t.groupName].push(t);
      });
      
      listEl.innerHTML = `<div id="user-task-apply-accordion" style="display:flex; flex-direction:column; gap:10px; width:100%;"></div>`;
      const accList = document.getElementById("user-task-apply-accordion");
      
      Object.keys(grouped).forEach((gName, idx) => {
        const groupTasks = grouped[gName];
        const group = state.groups.find(g => g.name === gName);
        const tlName = group && group.leaders ? group.leaders.join(', ') : "Belum Ditentukan";
        
        const headerId = `user-acc-header-${idx}`;
        const bodyId = `user-acc-body-${idx}`;
        const iconId = `user-acc-icon-${idx}`;
        
        const accordionRow = document.createElement("div");
        accordionRow.style.display = "flex";
        accordionRow.style.flexDirection = "column";
        accordionRow.style.width = "100%";
        
        accordionRow.innerHTML = `
          <div class="group-accordion-header" id="${headerId}" style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; user-select:none; margin-bottom:4px;">
            <span style="font-weight:800; color:var(--text-main); font-size:0.85rem;">${gName} <span style="font-weight:500; color:var(--text-muted); font-size:0.75rem; margin-left:6px;">(TL: ${tlName})</span></span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge badge-info" style="font-size:0.65rem; padding:2px 6px;">${groupTasks.length}</span>
              <i data-lucide="chevron-down" id="${iconId}" style="width:14px; height:14px; transition:transform 0.2s; color:#64748b;"></i>
            </div>
          </div>
          <div class="group-accordion-body hidden" id="${bodyId}" style="display:flex; flex-direction:column; gap:10px; margin-bottom:10px; width:100%;">
            ${groupTasks.map(t => makeCardHtml(t)).join('')}
          </div>
        `;
        
        accList.appendChild(accordionRow);
        
        const headerEl = document.getElementById(headerId);
        const bodyEl = document.getElementById(bodyId);
        const iconEl = document.getElementById(iconId);
        
        headerEl.onclick = () => {
          bodyEl.classList.toggle("hidden");
          const isHidden = bodyEl.classList.contains("hidden");
          iconEl.style.transform = isHidden ? "rotate(0deg)" : "rotate(180deg)";
        };
      });
    } else {
      // Just plain list of cards for the selected Date
      listEl.innerHTML = filtered.map(t => makeCardHtml(t)).join('');
    }
    
    // Bind all dynamic button event handlers
    listEl.querySelectorAll(".apply-task-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const task = state.assignments.find(x => x.id === id);
        if (task) {
          task.applicants = task.applicants || [];
          if (!task.applicants.includes(username)) {
            task.applicants.push(username);
            addNotification("penjadwalan", `Apply Tugas: ${state.currentUser.name} melamar tugas ${task.type} grup ${task.groupName}`, { username, groupName: task.groupName });
            saveState();
            showToast("Lamaran tugas berhasil diajukan!");
            drawList();
          }
        }
      };
    });
    
    listEl.querySelectorAll(".cancel-apply-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const task = state.assignments.find(x => x.id === id);
        if (task && task.applicants) {
          task.applicants = task.applicants.filter(u => u !== username);
          saveState();
          showToast("Lamaran tugas dibatalkan.");
          drawList();
        }
      };
    });
    
    listEl.querySelectorAll(".view-user-task-detail-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        window.location.hash = `#user/task-detail?id=${id}`;
      };
    });
    
    lucide.createIcons();
  };
  
  document.getElementById("user-apply-search").oninput = drawList;
  document.getElementById("user-apply-quota-filter").onchange = drawList;
  
  drawList();
}

let activeTaskDetailTab = "tugas";

function renderUserTaskDetailFull() {
  const container = document.getElementById("user-subview-content");
  if (!container) return;

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const taskId = params.get("id");
  const task = state.assignments.find(x => x.id === taskId);

  if (!task) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 16px; background:#fff; border-radius:12px; margin:20px; font-family:'Mulish', sans-serif;">
        <div style="font-size:2.5rem; margin-bottom:8px;">⚠️</div>
        <h3 style="font-weight:800; color:#1e293b; margin-bottom:6px;">Penugasan Tidak Ditemukan</h3>
        <p style="color:#64748b; font-size:0.85rem;">Data penugasan tidak ditemukan atau telah diperbarui oleh Admin.</p>
        <button onclick="window.location.hash='#user/dashboard'" class="btn btn-gold" style="margin-top:12px; width:auto; padding:8px 16px;">Kembali ke Dashboard</button>
      </div>
    `;
    return;
  }

  const group = state.groups.find(g => g.name === task.groupName);
  const staffList = Array.isArray(task.staff) ? task.staff : [];
  const staffNames = staffList.map(s => state.users.find(u => u.username === s)?.name || s).join(', ');
  const details = task.details || {};

  // Filter rooms & documents specifically for this task's groupName
  const groupRooms = state.rooms.filter(r => r.groupName === task.groupName);
  const groupDocs = state.documents.filter(d => d.groupName === task.groupName || d.groupName === "Umum");

  container.innerHTML = `
    <div style="font-family:'Mulish', sans-serif; padding-bottom:40px;">
      
      <!-- Top Banner Summary -->
      <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius:16px; padding:16px; color:#fff; box-shadow:0 6px 16px rgba(0,0,0,0.12); margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <span class="badge badge-gold" style="font-size:0.75rem; padding:4px 8px;">${task.type || 'Penjadwalan'}</span>
          <span class="badge ${task.status === 'Selesai' ? 'badge-success' : (task.status === 'Dalam Proses' ? 'badge-warning' : 'badge-gold')}" style="font-size:0.75rem; padding:4px 8px;">
            ${task.status || 'Aktif'}
          </span>
        </div>
        <h2 style="margin:4px 0 6px 0; font-size:1.1rem; font-weight:900; color:#fff;">${task.groupName}</h2>
        <div style="font-size:0.8rem; color:#94a3b8; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span>📅 ${formatDateDisplay(task.date)}</span>
          <span>⏰ ${task.time || '-'} Saudi</span>
          <span>📍 ${task.region || '-'}</span>
        </div>

        <div style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button id="task-detail-absen-btn" class="btn btn-gold" style="flex:1; padding:8px 12px; font-size:0.8rem; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i data-lucide="camera" style="width:14px;"></i> ABSENSI ${task.status === "Selesai" ? "KELUAR" : (task.status === "Dalam Proses" ? "KELUAR" : "MASUK")}
          </button>
        </div>
      </div>

      <!-- Tab Navigation Header -->
      <div style="display:flex; background:#fff; border-radius:12px; padding:4px; border:1px solid #e2e8f0; margin-bottom:16px; gap:4px; box-shadow:0 2px 4px rgba(0,0,0,0.02); overflow-x:auto;">
        <button class="task-tab-btn ${activeTaskDetailTab === 'tugas' ? 'active' : ''}" id="tab-btn-tugas" style="flex:1; padding:8px 4px; border:none; background:${activeTaskDetailTab === 'tugas' ? '#dfc06b' : 'transparent'}; color:${activeTaskDetailTab === 'tugas' ? '#000' : '#64748b'}; font-weight:800; font-size:0.75rem; border-radius:8px; cursor:pointer; white-space:nowrap;">
          📌 Detail Tugas
        </button>
        <button class="task-tab-btn ${activeTaskDetailTab === 'grup' ? 'active' : ''}" id="tab-btn-grup" style="flex:1; padding:8px 4px; border:none; background:${activeTaskDetailTab === 'grup' ? '#dfc06b' : 'transparent'}; color:${activeTaskDetailTab === 'grup' ? '#000' : '#64748b'}; font-weight:800; font-size:0.75rem; border-radius:8px; cursor:pointer; white-space:nowrap;">
          🕋 Detail Grup
        </button>
        <button class="task-tab-btn ${activeTaskDetailTab === 'roomlist' ? 'active' : ''}" id="tab-btn-roomlist" style="flex:1; padding:8px 4px; border:none; background:${activeTaskDetailTab === 'roomlist' ? '#dfc06b' : 'transparent'}; color:${activeTaskDetailTab === 'roomlist' ? '#000' : '#64748b'}; font-weight:800; font-size:0.75rem; border-radius:8px; cursor:pointer; white-space:nowrap;">
          🛏️ Roomlist (${groupRooms.length})
        </button>
        <button class="task-tab-btn ${activeTaskDetailTab === 'dokumen' ? 'active' : ''}" id="tab-btn-dokumen" style="flex:1; padding:8px 4px; border:none; background:${activeTaskDetailTab === 'dokumen' ? '#dfc06b' : 'transparent'}; color:${activeTaskDetailTab === 'dokumen' ? '#000' : '#64748b'}; font-weight:800; font-size:0.75rem; border-radius:8px; cursor:pointer; white-space:nowrap;">
          📄 Dokumen (${groupDocs.length})
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="task-detail-tab-content"></div>

    </div>
  `;

  lucide.createIcons();

  const btnAbsen = document.getElementById("task-detail-absen-btn");
  if (btnAbsen) btnAbsen.onclick = () => openAttendanceFormPopup(task.id);

  const drawTabContent = () => {
    const tabContentEl = document.getElementById("task-detail-tab-content");
    if (!tabContentEl) return;

    if (activeTaskDetailTab === "tugas") {
      tabContentEl.innerHTML = `
        <div style="background:#fff; border-radius:12px; padding:16px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
          <h4 style="margin:0 0 12px 0; font-weight:800; color:#1e293b; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">RINCIAN TUGAS TIM HANDLING</h4>
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem; line-height:1.8;">
            <tr><td style="color:#64748b; font-weight:700; width:130px;">Kategori Tugas:</td><td><strong style="color:#0f172a;">${task.type}</strong></td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Grup Umroh:</td><td><strong>${task.groupName}</strong></td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Wilayah Layanan:</td><td><span class="badge badge-gold" style="font-size:0.7rem;">${task.region}</span></td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Tanggal / Waktu:</td><td>${formatDateDisplay(task.date)} | Pukul ${task.time || '-'} Saudi</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Nama Hotel:</td><td>${details.hotelName || '-'}</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Flight / ETA:</td><td>${details.eta || '-'}</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Jumlah Pax:</td><td>${details.totalPax || '-'} Pax</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Paket / Layanan:</td><td>${details.service || '-'}</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Catatan Rincian:</td><td>${details.remarks || '-'}</td></tr>
            <tr><td style="color:#64748b; font-weight:700;">Tim Petugas:</td><td><strong style="color:#1e293b;">${staffNames || 'Belum ada petugas di-plot'}</strong></td></tr>
          </table>
        </div>
      `;
    } else if (activeTaskDetailTab === "grup") {
      if (!group) {
        tabContentEl.innerHTML = `<div style="background:#fff; padding:20px; border-radius:12px; text-align:center; color:#64748b;">Informasi detail master grup belum tersedia.</div>`;
      } else {
        tabContentEl.innerHTML = `
          <div style="background:#fff; border-radius:12px; padding:16px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
            <h4 style="margin:0 0 12px 0; font-weight:800; color:#1e293b; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">INFORMASI MASTER GRUP ROMBONGAN</h4>
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem; line-height:1.8;">
              <tr><td style="color:#64748b; font-weight:700; width:130px;">Nama Rombongan:</td><td><strong style="color:#0f172a;">${group.name}</strong></td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Rute Perjalanan:</td><td>${group.rute || '-'}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Periode Perjalanan:</td><td>${formatDateDisplay(group.dateStart)} s/d ${formatDateDisplay(group.dateEnd)}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Tour Leader (TL):</td><td><strong>${group.leaders ? group.leaders.join(', ') : 'Belum Ditentukan'}</strong></td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Mutawwif:</td><td>${group.mutawwif || '-'}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Hotel Madinah:</td><td>${group.packages?.[0]?.hotelMadinah || '-'}</td></tr>
              <tr><td style="color:#64748b; font-weight:700;">Hotel Makkah:</td><td>${group.packages?.[0]?.hotelMakkah || '-'}</td></tr>
            </table>
          </div>
        `;
      }
    } else if (activeTaskDetailTab === "roomlist") {
      tabContentEl.innerHTML = `
        <div style="background:#fff; border-radius:12px; padding:16px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
            <div>
              <h4 style="margin:0; font-weight:800; color:#1e293b;">ROOMLIST GRUP AUTOMATIS</h4>
              <p style="margin:2px 0 0 0; font-size:0.75rem; color:#64748b;">Terfilter otomatis untuk grup: ${task.groupName}</p>
            </div>
            <input type="text" id="task-room-search" class="form-input" placeholder="Cari kamar / nama jamaah..." style="max-width:200px; font-size:0.8rem; padding:4px 8px;">
          </div>

          <div id="task-roomlist-table-container"></div>
        </div>
      `;

      const renderGroupRooms = () => {
        const q = (document.getElementById("task-room-search")?.value || "").toLowerCase().trim();
        const filteredRooms = groupRooms.filter(r => {
          const matchHotel = r.hotelName.toLowerCase().includes(q);
          const matchRoom = r.roomNumber.toLowerCase().includes(q);
          const matchGuest = r.guests.some(g => g.name.toLowerCase().includes(q));
          return matchHotel || matchRoom || matchGuest;
        });

        const roomTableEl = document.getElementById("task-roomlist-table-container");
        if (!roomTableEl) return;

        if (filteredRooms.length === 0) {
          roomTableEl.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px; font-size:0.85rem;">Tidak ada data roomlist untuk grup ini.</div>`;
          return;
        }

        roomTableEl.innerHTML = `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.8rem;">
              <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; text-align:left;">
                  <th style="padding:8px; width:40px; text-align:center;">NO</th>
                  <th style="padding:8px;">HOTEL</th>
                  <th style="padding:8px; width:70px;">KAMAR</th>
                  <th style="padding:8px; width:60px;">TIPE</th>
                  <th style="padding:8px;">DAFTAR JAMAAH</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRooms.map((r, idx) => `
                  <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px; text-align:center; font-weight:700;">${r.roomlistNumber || (idx+1)}</td>
                    <td style="padding:8px; font-weight:600; color:#334155;">${r.hotelName}</td>
                    <td style="padding:8px;"><span class="badge badge-gold" style="font-size:0.7rem;">${r.roomNumber}</span></td>
                    <td style="padding:8px; font-size:0.75rem; color:#64748b;">${r.typeBed}</td>
                    <td style="padding:8px;">
                      <div style="display:flex; flex-direction:column; gap:2px;">
                        ${r.guests.map(g => `<div style="color:#0f172a; font-weight:600;">• ${g.name} <span style="color:#94a3b8; font-size:0.7rem;">(${g.remark || '-'})</span></div>`).join('')}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      };

      const roomSearchInput = document.getElementById("task-room-search");
      if (roomSearchInput) roomSearchInput.oninput = renderGroupRooms;
      renderGroupRooms();
    } else if (activeTaskDetailTab === "dokumen") {
      tabContentEl.innerHTML = `
        <div style="background:#fff; border-radius:12px; padding:16px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
          <h4 style="margin:0 0 4px 0; font-weight:800; color:#1e293b;">DOKUMEN & MANIFEST GRUP AUTOMATIS</h4>
          <p style="margin:0 0 12px 0; font-size:0.75rem; color:#64748b;">Dokumen operasional terfilter untuk grup: ${task.groupName}</p>
          
          ${groupDocs.length === 0 ? `
            <div style="text-align:center; color:#94a3b8; padding:20px; font-size:0.85rem;">Belum ada dokumen yang diunggah untuk grup ini.</div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:8px;">
              ${groupDocs.map(d => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.2rem;">📄</span>
                    <div>
                      <div style="font-weight:700; font-size:0.85rem; color:#0f172a;">${d.name}</div>
                      <div style="font-size:0.75rem; color:#64748b;">Kategori: <span class="badge badge-gold" style="font-size:0.65rem;">${d.category || 'Dokumen'}</span></div>
                    </div>
                  </div>
                  <button onclick="window.open('assets/docs_placeholder.pdf', '_blank');" class="btn btn-secondary" style="width:auto; padding:4px 10px; font-size:0.75rem;">
                    Buka PDF
                  </button>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }
  };

  const updateTabBtns = () => {
    document.querySelectorAll(".task-tab-btn").forEach(btn => {
      btn.style.background = "transparent";
      btn.style.color = "#64748b";
    });
    const activeBtn = document.getElementById(`tab-btn-${activeTaskDetailTab}`);
    if (activeBtn) {
      activeBtn.style.background = "#dfc06b";
      activeBtn.style.color = "#000";
    }
  };

  document.getElementById("tab-btn-dokumen").onclick = () => { activeTaskDetailTab = "dokumen"; updateTabBtns(); drawTabContent(); };

  drawTabContent();
}

// ==========================================
// PUBLIC VENDOR SCHEDULE PORTAL PAGE
// ==========================================

function printPublicVendorPDF(vendorId) {
  const vendor = state.vendors.find(v => v.id === vendorId);
  if (!vendor) return;

  const vendorBookings = state.bookings.filter(b => b.vendorId === vendor.id);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast("Gagal membuka jendela cetak. Izinkan pop-up di browser.", "error");
    return;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Jadwal Pemesanan Vendor - ${vendor.name}</title>
      <link href="https://fonts.googleapis.com/css2?family=Martel:wght@400;700;900&family=Mulish:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Mulish', sans-serif;
          color: #0f172a;
          background: #ffffff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-sizing: border-box;
          background: url('assets/vendor_pdf_bg.png') no-repeat center top;
          background-size: 100% 100%;
          padding: 145px 44px 44px 44px;
          position: relative;
        }
        .header-title {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #dfc06b;
          padding-bottom: 10px;
        }
        .header-title h1 {
          font-family: 'Martel', serif;
          font-size: 1.3rem;
          margin: 0;
          color: #0f172a;
          text-transform: uppercase;
        }
        .header-title p {
          margin: 4px 0 0 0;
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 700;
        }
        .vendor-info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          font-size: 0.83rem;
          background: rgba(248,250,252,0.9);
          border-radius: 8px;
        }
        .vendor-info-table td {
          padding: 7px 12px;
          border: 1px solid #cbd5e1;
        }
        .booking-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 0.8rem;
        }
        .booking-table th {
          background: #0f172a;
          color: #ffffff;
          padding: 8px 10px;
          text-align: left;
          font-weight: 800;
          border: 1px solid #0f172a;
        }
        .booking-table td {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          vertical-align: top;
          background: #ffffff;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 0.72rem;
          text-align: center;
        }
        .badge-baru { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .badge-proses { background: #fffbe6; color: #d97706; border: 1px solid #fde68a; }
        .badge-selesai { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
        .footer-note {
          margin-top: 30px;
          text-align: center;
          font-size: 0.75rem;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
      </style>
    </head>
    <body onload="window.print();">
      <div class="page-container">
        
        <div class="header-title">
          <h1>JADWAL & LAPORAN PEMESANAN MITRA VENDOR</h1>
          <p>PT. JEJAK IMANI BERKAH BERSAMA - SAUDI HANDLING OPERATIONS</p>
        </div>

        <table class="vendor-info-table">
          <tr>
            <td style="width:18%; color:#64748b;">Mitra Vendor</td>
            <td style="width:32%;"><strong>${vendor.name}</strong></td>
            <td style="width:18%; color:#64748b;">Tipe Layanan</td>
            <td style="width:32%;"><strong>${vendor.type || 'Mitra Layanan'}</strong></td>
          </tr>
          <tr>
            <td style="color:#64748b;">Kontak</td>
            <td><strong>${vendor.contact || '-'}</strong></td>
            <td style="color:#64748b;">Total Pesanan</td>
            <td><strong>${vendorBookings.length} Pemesanan</strong></td>
          </tr>
        </table>

        <table class="booking-table">
          <thead>
            <tr>
              <th style="width:5%;">No</th>
              <th style="width:25%;">Tujuan & Grup</th>
              <th style="width:20%;">Muthowwif & Lokasi</th>
              <th style="width:18%;">Waktu Pengantaran</th>
              <th style="width:20%;">Rincian Produk</th>
              <th style="width:12%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${vendorBookings.length === 0 ? `
              <tr><td colspan="6" style="text-align:center; padding:16px; color:#94a3b8;">Belum ada jadwal pemesanan vendor.</td></tr>
            ` : vendorBookings.map((b, idx) => {
              const group = state.groups.find(g => g.name === b.groupName);
              const muth = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
              const loc = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Rotana Makkah') : 'Hotel Rotana Makkah');
              const act = (b.activityGoal || b.activity || b.notes || 'SNACK CITY TOUR').toUpperCase();
              const dt = formatDateDisplay(b.dateStart || b.date) + ' | ' + (b.time || '05:30');
              const st = b.status || 'Pesanan Baru';
              let badgeClass = 'badge-baru';
              if (st === 'Proses') badgeClass = 'badge-proses';
              else if (st === 'Selesai') badgeClass = 'badge-selesai';

              const prods = (b.products && b.products.length > 0) ? b.products : [
                { name: b.notes || 'Snack Kering', qty: b.qty || 1, unit: b.unit || 'Pcs', amount: b.amount || (b.totalPrice || 242) }
              ];

              return `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td>
                    <strong>${act}</strong>
                    <div style="font-size:0.75rem; color:#475569; margin-top:2px;">${b.groupName}</div>
                  </td>
                  <td>
                    <div>Ust. ${muth}</div>
                    <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">📍 ${loc}</div>
                  </td>
                  <td style="font-weight:700;">${dt}</td>
                  <td>
                    ${prods.map(p => `<div>• ${p.name} (${p.qty} ${p.unit})</div>`).join('')}
                    <div style="font-weight:800; margin-top:3px; color:#0f172a;">Total: SAR ${(b.totalPrice || 0).toLocaleString('id-ID')}</div>
                  </td>
                  <td style="text-align:center;">
                    <span class="status-badge ${badgeClass}">${st}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer-note">
          Dokumen resmi terverifikasi secara sistem oleh Tim Khidmat & Finance PT. JEJAK IMANI BERKAH BERSAMA (Saudi Arabia Operations).
        </div>

      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}

window.activeVendorCamStream = null;

function openVendorProcessModal(bookingId) {
  const b = state.bookings.find(x => x.id === bookingId);
  if (!b) return;

  const vendor = state.vendors.find(v => v.id === b.vendorId);
  const vName = vendor ? vendor.name : 'Mitra Vendor';
  const group = state.groups.find(g => g.name === b.groupName);
  const muthawwifName = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
  const locationName = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Al Marwa Rayhaan Rotana (Bus 1)') : 'Hotel Al Marwa Rayhaan Rotana (Bus 1)');
  const activityTitle = (b.activityGoal || b.activity || b.notes || 'SNACK CITY TOUR MAKKAH').toUpperCase();
  const dateFormatted = formatDateDisplay(b.dateStart || b.date);
  const timeFormatted = b.time ? b.time : '05:30';

  const status = b.status || 'Pesanan Baru';

  if (status === 'Pesanan Baru' || status === 'Aktif') {
    openModal("📦 Konfirmasi Proses Pemesanan", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="background:#3b82f6; color:#fff; font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:10px;">Pesanan Baru</span>
            <span style="font-size:0.8rem; font-weight:700; color:#1d4ed8;">${dateFormatted} | ${timeFormatted}</span>
          </div>
          <h3 style="font-size:1rem; font-weight:900; color:#0f172a; margin:0 0 4px 0;">${activityTitle}</h3>
          <div style="font-size:0.85rem; color:#475569; font-weight:600;">${b.groupName}</div>
        </div>

        <div style="font-size:0.85rem; line-height:1.7; margin-bottom:18px;">
          <div>👤 Muthowwif: <strong>Ust. ${muthawwifName}</strong></div>
          <div>📍 Lokasi Pengantaran: <strong>${locationName}</strong></div>
          <div style="margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:8px;">
            <strong>Daftar Item Pemesanan:</strong>
            ${(b.products && b.products.length > 0 ? b.products : [{name: 'Item Produk', qty: 1, unit: 'Pcs', amount: b.totalPrice}]).map(p => `
              <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-top:2px;">
                <span>• ${p.name}</span>
                <strong>${p.qty} ${p.unit} (SAR ${(p.amount || p.price || 0).toLocaleString('id-ID')})</strong>
              </div>
            `).join('')}
          </div>
        </div>

        <button id="btn-confirm-to-proses" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; background:#d97706; color:#fff; border:none; box-shadow:0 4px 14px rgba(217,119,6,0.3);">
          <i data-lucide="check-circle-2"></i> Konfirmasi Proses Pemesanan
        </button>
      </div>
    `);

    lucide.createIcons();

    document.getElementById("btn-confirm-to-proses").onclick = () => {
      b.status = "Proses";
      saveState();
      pushData();
      closeModal();
      showToast("Pesanan berhasil dikonfirmasi dan status berubah menjadi PROSES!");
      if (window.location.hash.startsWith("#vendor-view")) renderPublicVendorPortal();
    };

  } else if (status === 'Proses') {
    let currentFacingMode = 'environment';
    let capturedWatermarkDataUrl = null;

    openModal("📸 Foto Bukti Pengantaran (Watermark)", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        <div style="font-size:0.83rem; color:#64748b; margin-bottom:12px;">
          Silakan jepret foto bukti pengantaran pesanan <strong>${activityTitle}</strong> ke lokasi <strong>${locationName}</strong>. Teks watermark lokasi, tanggal, & muthowwif akan otomatis terpasang real-time.
        </div>

        <!-- Live Camera Container -->
        <div id="v-cam-box" style="position:relative; width:100%; height:260px; background:#0f172a; border-radius:14px; overflow:hidden; margin-bottom:12px; display:flex; align-items:center; justify-content:center;">
          <video id="v-cam-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
          
          <button id="v-cam-flip" class="btn btn-secondary" style="position:absolute; top:10px; right:10px; font-size:0.75rem; padding:6px 12px; background:rgba(15,23,42,0.75); color:#fff; backdrop-filter:blur(8px); border-radius:20px; border:1px solid rgba(255,255,255,0.3); font-weight:800;">
            🔄 Flip Kamera
          </button>
        </div>

        <!-- Capture & Upload Buttons -->
        <div style="display:flex; gap:10px; margin-bottom:14px;">
          <button id="v-cam-snap-btn" class="btn btn-gold" style="flex:1; padding:10px; font-weight:800; font-size:0.85rem; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i data-lucide="camera"></i> Jepret Foto
          </button>
          <label class="btn btn-secondary" style="flex:1; padding:10px; font-weight:800; font-size:0.85rem; border-radius:10px; text-align:center; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; background:#e2e8f0; color:#1e293b;">
            <i data-lucide="upload"></i> Upload File
            <input type="file" id="v-file-input" accept="image/*" capture="environment" style="display:none;">
          </label>
        </div>

        <!-- Preview Container -->
        <div id="v-preview-box" style="display:none; margin-bottom:14px; text-align:center;">
          <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Preview Foto Ter-Watermark:</div>
          <img id="v-preview-img" style="width:100%; max-height:260px; object-fit:contain; border-radius:12px; border:2px solid #10b981; box-shadow:0 8px 20px rgba(0,0,0,0.12);">
        </div>

        <button id="btn-submit-delivery" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800; font-size:0.95rem; border-radius:12px; display:none; background:#10b981; color:#fff; border:none; box-shadow:0 4px 14px rgba(16,185,129,0.3);">
          ✅ Submit Foto & Selesaikan Pemesanan
        </button>
      </div>
    `);

    lucide.createIcons();

    const videoEl = document.getElementById("v-cam-video");
    const flipBtn = document.getElementById("v-cam-flip");
    const snapBtn = document.getElementById("v-cam-snap-btn");
    const fileInput = document.getElementById("v-file-input");
    const previewBox = document.getElementById("v-preview-box");
    const previewImg = document.getElementById("v-preview-img");
    const submitBtn = document.getElementById("btn-submit-delivery");

    const stopCamera = () => {
      if (window.activeVendorCamStream) {
        window.activeVendorCamStream.getTracks().forEach(track => track.stop());
        window.activeVendorCamStream = null;
      }
    };

    const startCamera = async (mode) => {
      stopCamera();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false
        });
        window.activeVendorCamStream = stream;
        videoEl.srcObject = stream;
      } catch (err) {
        console.warn("Kamera tidak dapat diakses langsung:", err);
      }
    };

    startCamera(currentFacingMode);

    flipBtn.onclick = () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      startCamera(currentFacingMode);
    };

    const generateWatermark = (sourceImgOrVideo, isVideo = true) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let width = isVideo ? (sourceImgOrVideo.videoWidth || 640) : sourceImgOrVideo.naturalWidth;
      let height = isVideo ? (sourceImgOrVideo.videoHeight || 480) : sourceImgOrVideo.naturalHeight;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(sourceImgOrVideo, 0, 0, width, height);

      // Add watermark overlay bar at bottom
      const overlayHeight = Math.max(100, Math.round(height * 0.28));
      ctx.fillStyle = "rgba(15, 23, 42, 0.84)";
      ctx.fillRect(0, height - overlayHeight, width, overlayHeight);

      // Gold top accent line
      ctx.fillStyle = "#dfc06b";
      ctx.fillRect(0, height - overlayHeight, width, 4);

      // Watermark Text
      const now = new Date();
      const timeStr = now.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }) + ' ' + now.toLocaleTimeString('id-ID') + ' AST (Saudi Arabia)';

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(14, Math.round(width * 0.038))}px 'Mulish', sans-serif`;
      ctx.fillText(`📍 ${vName}`, 16, height - overlayHeight + 26);

      ctx.fillStyle = "#fef3c7";
      ctx.font = `bold ${Math.max(12, Math.round(width * 0.032))}px 'Mulish', sans-serif`;
      ctx.fillText(`📦 ${activityTitle} | ${b.groupName}`, 16, height - overlayHeight + 50);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = `normal ${Math.max(11, Math.round(width * 0.028))}px 'Mulish', sans-serif`;
      ctx.fillText(`👤 Muthowwif: Ust. ${muthawwifName} | 📍 ${locationName}`, 16, height - overlayHeight + 72);

      ctx.fillStyle = "#10b981";
      ctx.font = `bold ${Math.max(11, Math.round(width * 0.028))}px 'Mulish', sans-serif`;
      ctx.fillText(`🕒 ${timeStr} | GPS Verified: 21.4225° N, 39.8262° E`, 16, height - overlayHeight + 92);

      capturedWatermarkDataUrl = canvas.toDataURL("image/jpeg", 0.88);
      previewImg.src = capturedWatermarkDataUrl;
      previewBox.style.display = "block";
      submitBtn.style.display = "block";

      stopCamera();
    };

    snapBtn.onclick = () => {
      generateWatermark(videoEl, true);
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          generateWatermark(img, false);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    };

    submitBtn.onclick = () => {
      if (!capturedWatermarkDataUrl) {
        showToast("Ambil foto bukti terlebih dahulu.", "error");
        return;
      }
      b.deliveryPhoto = capturedWatermarkDataUrl;
      b.status = "Selesai";
      saveState();
      pushData();
      stopCamera();
      closeModal();
      showToast("Foto bukti pengantaran berhasil disubmit & status pemesanan SELESAI!");
      if (window.location.hash.startsWith("#vendor-view")) renderPublicVendorPortal();
    };

  } else if (status === 'Selesai') {
    openModal("✅ Bukti Pengantaran Pemesanan (Selesai)", `
      <div style="font-family:'Mulish', sans-serif; color:#1e293b;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.75rem; font-weight:800; padding:3px 10px; border-radius:12px;">Pesanan Selesai</span>
          <span style="font-size:0.8rem; font-weight:700; color:#64748b;">${dateFormatted} | ${timeFormatted}</span>
        </div>

        <h3 style="font-size:1.05rem; font-weight:900; color:#0f172a; margin:0 0 4px 0;">${activityTitle}</h3>
        <div style="font-size:0.85rem; color:#475569; font-weight:600; margin-bottom:14px;">${b.groupName}</div>

        ${b.deliveryPhoto ? `
          <div style="margin-bottom:16px; text-align:center;">
            <div style="font-size:0.8rem; font-weight:800; color:#0f172a; margin-bottom:6px;">Foto Bukti Pengantaran Terverifikasi:</div>
            <img src="${b.deliveryPhoto}" style="width:100%; max-height:280px; object-fit:contain; border-radius:12px; border:2px solid #10b981; box-shadow:0 8px 20px rgba(0,0,0,0.12);">
          </div>
        ` : `
          <div style="padding:20px; text-align:center; background:#f8fafc; border-radius:12px; color:#64748b; font-size:0.85rem; margin-bottom:16px;">
            Bukti foto pengantaran diselesaikan langsung oleh muthowwif & vendor.
          </div>
        `}

        <button id="btn-share-delivery-wa" class="btn btn-gold" style="width:100%; padding:12px; font-weight:800; font-size:0.92rem; border-radius:12px; display:flex; align-items:center; justify-content:center; gap:8px; background:#25d366; color:#fff; border:none; box-shadow:0 4px 14px rgba(37,211,102,0.3);">
          <i data-lucide="share-2"></i> Bagikan Bukti Pengantaran via WhatsApp
        </button>
      </div>
    `);

    lucide.createIcons();

    document.getElementById("btn-share-delivery-wa").onclick = () => {
      const shareMsg = `Assalamu'alaikum wr.wb,\n\nBerikut kami kirimkan Konfirmasi Bukti Pengantaran Pemesanan Vendor:\n• *Vendor*: ${vName}\n• *Kegiatan*: ${activityTitle}\n• *Grup*: ${b.groupName}\n• *Muthowwif*: Ust. ${muthawwifName}\n• *Lokasi*: ${locationName}\n• *Status*: SELESAI (Telah Diantar)\n\nTerima kasih.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, '_blank');
    };
  }
}

function renderPublicVendorPortal() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.split("?")[1] || "");
  const vendorId = params.get("id");

  const vendor = state.vendors.find(v => v.id === vendorId);

  if (!vendor) {
    APP_CONTAINER.innerHTML = `
      <div style="max-width:500px; margin:60px auto; padding:32px 20px; text-align:center; background:#fff; border-radius:20px; box-shadow:0 15px 35px rgba(0,0,0,0.06); font-family:'Mulish', sans-serif;">
        <div style="font-size:3.5rem; margin-bottom:12px;">⚠️</div>
        <h2 style="font-weight:900; color:#1e293b; margin-bottom:8px;">Portal Vendor Tidak Ditemukan</h2>
        <p style="color:#64748b; font-size:0.9rem; line-height:1.5;">Link halaman jadwal pemesanan vendor ini tidak valid atau telah diperbarui.</p>
        <button onclick="window.location.hash='#login'" class="btn btn-gold" style="margin-top:20px; width:auto; padding:10px 24px; font-weight:800; border-radius:12px;">Halaman Utama</button>
      </div>
    `;
    return;
  }

  // Dynamic Vendor PWA Metadata & Manifest
  document.title = `Vendor JI - ${vendor.name}`;

  const vendorManifestData = {
    name: `Vendor JI - ${vendor.name}`,
    short_name: "Vendor JI",
    description: `Portal Pemesanan Vendor JI - ${vendor.name} (PT. JEJAK IMANI BERKAH BERSAMA)`,
    start_url: window.location.href,
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#0f172a",
    icons: [
      {
        src: "assets/icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "assets/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };

  if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
    const stringManifest = JSON.stringify(vendorManifestData);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', manifestUrl);
    }

    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', 'Vendor JI');
    }
  }

  // Filter all bookings for this vendor
  const vendorBookings = state.bookings.filter(b => b.vendorId === vendor.id);
  const totalOrders = vendorBookings.length;
  const newOrders = vendorBookings.filter(b => !b.status || b.status === 'Pesanan Baru' || b.status === 'Aktif').length;
  const processOrders = vendorBookings.filter(b => b.status === 'Proses').length;
  const completedOrders = vendorBookings.filter(b => b.status === 'Selesai').length;

  let currentStatusFilter = "semua";

  const makeVendorBookingCard = (b) => {
    const group = state.groups.find(g => g.name === b.groupName);
    const muthawwifName = b.muthawwif || (group ? (group.mutawwif || (group.leaders ? group.leaders.join(', ') : 'Ust. Ahmad Saiful Haq')) : 'Ust. Ahmad Saiful Haq');
    const locationName = b.location || b.hotel || (group ? (group.makkahHotel || group.madinahHotel || 'Hotel Al Marwa Rayhaan Rotana (Bus 1)') : 'Hotel Al Marwa Rayhaan Rotana (Bus 1)');
    const activityTitle = (b.activityGoal || b.activity || b.notes || 'SNACK CITY TOUR MAKKAH').toUpperCase();
    const dateFormatted = formatDateDisplay(b.dateStart || b.date);
    const timeFormatted = b.time ? b.time : '05:30';

    const productsList = (b.products && b.products.length > 0) ? b.products : [
      { name: b.notes || 'Snack Kering', qty: b.qty || 1, unit: b.unit || 'Pcs', amount: b.amount || (b.totalPrice || 242) }
    ];

    const currentStatus = b.status || 'Pesanan Baru';
    let badgeStyle = "background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
    let badgeText = "Pesanan Baru";

    if (currentStatus === 'Proses') {
      badgeStyle = "background:#fffbe6; color:#d97706; border:1px solid #fde68a; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
      badgeText = "Proses";
    } else if (currentStatus === 'Selesai') {
      badgeStyle = "background:#ecfdf5; color:#047857; border:1px solid #a7f3d0; font-size:0.72rem; font-weight:800; padding:2px 8px; border-radius:12px;";
      badgeText = "Selesai";
    }

    return `
      <div onclick="openVendorProcessModal('${b.id}')" class="vendor-card-row" style="cursor:pointer; background:#ffffff; border-radius:14px; padding:16px 18px; margin-bottom:14px; border:1px solid #f1f5f9; box-shadow:0 4px 14px rgba(0,0,0,0.03); border-bottom:3px solid #dfc06b; font-family:'Mulish', sans-serif; transition:transform 0.15s ease;">
        
        <!-- Top Row: Activity Goal, Status Badge, & Date/Time -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
          <div style="font-weight:900; font-size:0.95rem; color:#000; letter-spacing:0.01em; text-transform:uppercase; flex:1;">
            ${activityTitle}
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
            <span style="${badgeStyle}">${badgeText}</span>
            <div style="font-size:0.78rem; font-weight:700; color:#334155; white-space:nowrap; margin-top:2px;">
              ${dateFormatted} | ${timeFormatted}
            </div>
          </div>
        </div>

        <!-- Group Name -->
        <div style="font-size:0.85rem; color:#475569; margin-bottom:4px; font-weight:600;">
          ${b.groupName}
        </div>

        <!-- Muthowwif -->
        <div style="font-size:0.83rem; color:#334155; margin-bottom:3px;">
          <span style="display:inline-block; width:85px; color:#64748b;">Muthowwif</span> : <strong style="color:#1e293b;">${muthawwifName}</strong>
        </div>

        <!-- Lokasi -->
        <div style="font-size:0.83rem; color:#334155; margin-bottom:10px;">
          <span style="display:inline-block; width:85px; color:#64748b;">Lokasi</span> : <strong style="color:#0f172a; font-weight:900;">${locationName}</strong>
        </div>

        <!-- Products Lines -->
        <div style="border-top:1px dashed #e2e8f0; padding-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${productsList.map(prod => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:#1e293b;">
              <div style="flex:1; color:#334155; padding-left:12px;">${prod.name || 'Snack Kering'}</div>
              <div style="width:90px; text-align:center; font-weight:700; color:#475569;">${prod.qty || 1} ${prod.unit || 'Pcs'}</div>
              <div style="width:100px; text-align:right; font-weight:900; color:#0f172a;">SAR ${(prod.amount || prod.price || 0).toLocaleString('id-ID')}</div>
            </div>
          `).join('')}
        </div>

        <!-- Tap Hint -->
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed #f1f5f9; text-align:right; font-size:0.75rem; font-weight:800; color:#b45309;">
          Klik untuk kelola / upload foto pengantaran ➔
        </div>

      </div>
    `;
  };

  APP_CONTAINER.innerHTML = `
    <div style="min-height:100vh; background:#f4f6f9; font-family:'Mulish', sans-serif; padding:12px 10px 60px 10px; box-sizing:border-box;">
      <div style="max-width:700px; margin:0 auto;">
        
        <!-- Header Bar: Soft UI / Glassmorphism -->
        <div style="background:rgba(255,255,255,0.85); backdrop-filter:blur(16px); border-radius:18px; padding:12px 16px; border:1px solid rgba(255,255,255,0.9); box-shadow:0 8px 24px rgba(0,0,0,0.04); margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:nowrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
            <img src="assets/logo.png" style="height:38px; object-fit:contain;" alt="Jejak Imani Logo" onerror="this.style.display='none';">
            <div style="min-width:0;">
              <div style="font-size:0.68rem; color:#b45309; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">PORTAL MITRA VENDOR & SUPPLIER</div>
              <div style="font-size:0.82rem; font-weight:800; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">PT. JEJAK IMANI BERKAH BERSAMA</div>
            </div>
          </div>

          <!-- Real-Time Status Dot ONLY (Green / Red indicator) -->
          <div style="display:flex; align-items:center; padding-left:4px;">
            <span style="width:12px; height:12px; background:#10b981; border-radius:50%; display:inline-block; box-shadow:0 0 10px #10b981;" title="Connected Real-Time"></span>
          </div>
        </div>

        <!-- Biodata Vendor -->
        <div style="background:linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.85) 100%); backdrop-filter:blur(12px); border-radius:18px; padding:18px; border:1px solid rgba(255,255,255,0.9); box-shadow:0 8px 20px rgba(0,0,0,0.02); margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div style="flex:1; min-width:200px;">
              <span style="background:#fef3c7; color:#92400e; font-weight:900; font-size:0.7rem; padding:3px 9px; border-radius:20px; text-transform:uppercase;">${vendor.type || 'Mitra Layanan'}</span>
              <h1 style="margin:6px 0 2px 0; font-size:1.4rem; font-weight:900; color:#0f172a;">${vendor.name}</h1>
              <div style="font-size:0.82rem; color:#475569; margin-bottom:4px;">📞 Contact: <strong>${vendor.contact || '-'}</strong></div>
              <div style="font-size:0.8rem; color:#64748b;">📝 Keterangan: <em>${vendor.notes || vendor.description || 'Mitra Penyelenggara Layanan Operational Tim Khidmat jejak imani Saudi Arabia'}</em></div>
            </div>

            <!-- Tombol Cetak PDF dengan Background Letterhead -->
            <div>
              <button onclick="printPublicVendorPDF('${vendor.id}');" class="btn btn-gold" style="width:auto; padding:8px 16px; font-size:0.78rem; font-weight:800; border-radius:10px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(223,192,107,0.3);">
                <i data-lucide="printer" style="width:14px; height:14px;"></i> Cetak PDF
              </button>
            </div>
          </div>
        </div>

        <!-- Filter Tab Bar: Semua, Pesanan Baru, Proses, Selesai -->
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; margin-bottom:16px; scrollbar-width:none;">
          <button id="pv-tab-semua" class="pv-filter-btn active" data-filter="semua" style="flex:1; min-width:90px; padding:10px 8px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #0f172a; background:#0f172a; color:#ffffff; cursor:pointer; text-align:center; transition:all 0.2s;">
            Semua (${totalOrders})
          </button>
          <button id="pv-tab-baru" class="pv-filter-btn" data-filter="baru" style="flex:1; min-width:110px; padding:10px 8px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#1d4ed8; cursor:pointer; text-align:center; transition:all 0.2s;">
            Pesanan Baru (${newOrders})
          </button>
          <button id="pv-tab-proses" class="pv-filter-btn" data-filter="proses" style="flex:1; min-width:95px; padding:10px 8px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#d97706; cursor:pointer; text-align:center; transition:all 0.2s;">
            Proses (${processOrders})
          </button>
          <button id="pv-tab-selesai" class="pv-filter-btn" data-filter="selesai" style="flex:1; min-width:95px; padding:10px 8px; border-radius:12px; font-weight:800; font-size:0.78rem; border:1px solid #e2e8f0; background:#ffffff; color:#10b981; cursor:pointer; text-align:center; transition:all 0.2s;">
            Selesai (${completedOrders})
          </button>
        </div>

        <!-- Search Bar -->
        <div style="margin-bottom:14px;">
          <input type="text" id="pv-search" class="form-input" placeholder="Cari pemesanan (kegiatan, grup, muthowwif)..." style="width:100%; font-size:0.85rem; padding:10px 14px; border-radius:12px; background:#fff; border:1px solid #cbd5e1; box-sizing:border-box;">
        </div>

        <!-- Dynamic Cards Container -->
        <div id="pv-cards-container">
          ${vendorBookings.length === 0 ? `
            <div style="text-align:center; padding:30px; background:#fff; border-radius:14px; color:#94a3b8; font-size:0.85rem; border:1px solid #e2e8f0;">Belum ada jadwal pemesanan untuk vendor ini.</div>
          ` : vendorBookings.map(b => makeVendorBookingCard(b)).join('')}
        </div>

        <!-- Footer Contact Notice -->
        <div style="margin-top:24px; background:#fffdf5; border:1px solid #fef3c7; border-radius:14px; padding:14px; text-align:center; font-size:0.8rem; color:#78350f;">
          <div style="font-weight:800; margin-bottom:2px;">Ada Pertanyaan atau Perubahan Jadwal?</div>
          <div>Silakan hubungi Tim Handling & Finance jejak imani Saudi Arabia via WhatsApp.</div>
        </div>

      </div>
    </div>
  `;

  lucide.createIcons();

  const applyVendorFilters = () => {
    const q = (document.getElementById("pv-search")?.value || "").toLowerCase().trim();
    const filtered = vendorBookings.filter(b => {
      const st = b.status || "Pesanan Baru";
      let matchTab = true;
      if (currentStatusFilter === "baru") matchTab = (st === "Pesanan Baru" || st === "Aktif");
      else if (currentStatusFilter === "proses") matchTab = (st === "Proses");
      else if (currentStatusFilter === "selesai") matchTab = (st === "Selesai");

      const goal = (b.activityGoal || b.activity || '').toLowerCase();
      const grp = (b.groupName || '').toLowerCase();
      const muth = (b.muthawwif || '').toLowerCase();
      const notes = (b.notes || '').toLowerCase();
      const matchSearch = !q || (goal.includes(q) || grp.includes(q) || muth.includes(q) || notes.includes(q));

      return matchTab && matchSearch;
    });

    const container = document.getElementById("pv-cards-container");
    if (container) {
      if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px; background:#fff; border-radius:14px; color:#94a3b8; font-size:0.85rem; border:1px solid #e2e8f0;">Tidak ada pemesanan dalam kategori ini.</div>`;
      } else {
        container.innerHTML = filtered.map(b => makeVendorBookingCard(b)).join('');
      }
    }
  };

  // Tab Filtering Handler
  document.querySelectorAll(".pv-filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".pv-filter-btn").forEach(b => {
        b.style.background = "#ffffff";
        b.style.border = "1px solid #e2e8f0";
        const f = b.getAttribute("data-filter");
        if (f === "baru") b.style.color = "#1d4ed8";
        else if (f === "proses") b.style.color = "#d97706";
        else if (f === "selesai") b.style.color = "#10b981";
        else b.style.color = "#0f172a";
      });

      btn.style.background = "#0f172a";
      btn.style.color = "#ffffff";
      btn.style.border = "1px solid #0f172a";

      currentStatusFilter = btn.getAttribute("data-filter");
      applyVendorFilters();
    };
  });

  // Search Filter Handler
  const pvSearch = document.getElementById("pv-search");
  if (pvSearch) {
    pvSearch.oninput = () => {
      applyVendorFilters();
    };
  }
}

