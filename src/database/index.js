const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { getTashkentDate, getTashkentTime, getTashkentDateTime } = require('../utils/helpers');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bs_shoes.db');
let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

function initDatabase(db) {
  // 1. Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default settings
  const defaultSettings = [
    ['admin_login', 'admin'],
    ['admin_password', 'admin777'],
    ['work_start_worker', '09:00'],
    ['work_start_student', '13:00'],
    ['work_end_time', '18:00'],
    ['grace_period_minutes', '15'],
    ['late_fine_amount', '10000'],
    ['on_time_bonus_amount', '5000'],
    ['factory_latitude', ''],
    ['factory_longitude', ''],
    ['factory_radius_meters', '250'],
    ['factory_location_enabled', '0']
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // 2. Admins
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      full_name TEXT NOT NULL,
      username TEXT DEFAULT '',
      role TEXT DEFAULT 'admin', -- 'super_admin', 'admin'
      created_at TEXT NOT NULL
    );
  `);

  // 3. Workers
  db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT,
      username TEXT DEFAULT '',
      role TEXT DEFAULT 'worker', -- 'worker' (oddiy ishchi), 'student' (maktab o'quvchisi)
      work_start_time TEXT DEFAULT '09:00',
      balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // 4. Job types (bo'limlar va ish turlari)
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT DEFAULT 'juft',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // Seed standard job types if empty
  const countJobs = db.prepare(`SELECT count(*) as c FROM job_types`).get();
  if (countJobs.c === 0) {
    const defaultJobs = [
      ['Tortuv', 2000, 'juft'],
      ['Zagatovka', 3500, 'juft'],
      ['Padoj', 2500, 'juft'],
      ['Stirka', 1800, 'juft'],
      ['Qadoqlash', 1000, 'juft']
    ];
    const insJob = db.prepare(`INSERT INTO job_types (name, price, unit, is_active, created_at) VALUES (?, ?, ?, 1, ?)`);
    const now = getTashkentDateTime();
    for (const [name, price, unit] of defaultJobs) {
      insJob.run(name, price, unit, now);
    }
  }

  // 5. Attendance
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      check_in_time TEXT,
      check_out_time TEXT,
      worked_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'present', -- 'present', 'late', 'absent', 'completed'
      bonus_amount REAL DEFAULT 0,
      fine_amount REAL DEFAULT 0,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);

  // 6. Payroll periods
  db.exec(`
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_number INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      total_payout REAL DEFAULT 0,
      status TEXT DEFAULT 'active', -- 'active', 'closed'
      created_at TEXT NOT NULL
    );
  `);

  // Ensure an active payroll period exists
  const activePeriod = db.prepare(`SELECT * FROM payroll_periods WHERE status = 'active'`).get();
  if (!activePeriod) {
    const maxPeriod = db.prepare(`SELECT max(period_number) as m FROM payroll_periods`).get();
    const nextNum = (maxPeriod && maxPeriod.m ? maxPeriod.m : 0) + 1;
    db.prepare(`INSERT INTO payroll_periods (period_number, start_date, status, created_at) VALUES (?, ?, 'active', ?)`).run(
      nextNum,
      getTashkentDateTime(),
      getTashkentDateTime()
    );
  }

  // 7. Work submissions (Tasdiqlash qutisi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      job_type_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      original_quantity REAL,
      admin_note TEXT,
      approved_by INTEGER,
      approved_at TEXT,
      period_id INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
      FOREIGN KEY (job_type_id) REFERENCES job_types(id)
    );
  `);

  // 8. Advances (Avanslar)
  db.exec(`
    CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'given', -- 'requested', 'given', 'rejected'
      period_id INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);

  // 9. Fines (Jarimalar)
  db.exec(`
    CREATE TABLE IF NOT EXISTS fines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      period_id INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
    );
  `);

  // 10. Clients
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      username TEXT,
      company_name TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 11. Client orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      packs_quantity REAL NOT NULL,
      price_per_pack REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      debt_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // 12. Client messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL, -- 'client', 'admin'
      text TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // 13. Payroll settlements history
  db.exec(`
    CREATE TABLE IF NOT EXISTS payroll_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_id INTEGER NOT NULL,
      worker_id INTEGER NOT NULL,
      worker_name TEXT NOT NULL,
      total_work_sum REAL DEFAULT 0,
      total_bonus REAL DEFAULT 0,
      total_late_fine REAL DEFAULT 0,
      total_other_fine REAL DEFAULT 0,
      total_advance REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      settled_at TEXT NOT NULL,
      FOREIGN KEY (period_id) REFERENCES payroll_periods(id)
    );
  `);
}

// ----------------- SETTINGS METHODS -----------------
function getSetting(key) {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, String(value));
}

function getAllSettings() {
  const rows = getDb().prepare(`SELECT key, value FROM settings`).all();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}

// ----------------- ADMINS METHODS -----------------
function getAdminByTelegramId(telegramId) {
  if (!telegramId) return null;
  return getDb().prepare(`SELECT * FROM admins WHERE telegram_id = ?`).get(Number(telegramId));
}

function getAllAdmins() {
  return getDb().prepare(`SELECT * FROM admins ORDER BY id ASC`).all();
}

function addAdmin(telegramId, fullName, username = '', role = 'admin') {
  const db = getDb();
  const existing = getAdminByTelegramId(telegramId);
  if (existing) {
    db.prepare(`UPDATE admins SET full_name = ?, username = ?, role = ? WHERE telegram_id = ?`).run(
      fullName,
      username,
      role,
      Number(telegramId)
    );
    return existing.id;
  }
  const stmt = db.prepare(`INSERT INTO admins (telegram_id, full_name, username, role, created_at) VALUES (?, ?, ?, ?, ?)`);
  const res = stmt.run(Number(telegramId), fullName, username, role, getTashkentDateTime());
  return res.lastInsertRowid;
}

function removeAdmin(id) {
  return getDb().prepare(`DELETE FROM admins WHERE id = ?`).run(Number(id));
}

// ----------------- WORKERS METHODS -----------------
function getAllWorkers(onlyActive = true) {
  const query = onlyActive
    ? `SELECT * FROM workers WHERE is_active = 1 ORDER BY full_name ASC`
    : `SELECT * FROM workers ORDER BY is_active DESC, full_name ASC`;
  return getDb().prepare(query).all();
}

function getWorkerById(id) {
  return getDb().prepare(`SELECT * FROM workers WHERE id = ?`).get(Number(id));
}

function getWorkerByTelegramId(telegramId) {
  if (!telegramId) return null;
  return getDb().prepare(`SELECT * FROM workers WHERE telegram_id = ?`).get(Number(telegramId));
}

function getWorkerByPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  return getDb().prepare(`SELECT * FROM workers WHERE phone LIKE ? OR phone LIKE ?`).get(`%${cleanPhone}%`, `%${cleanPhone.slice(-9)}%`);
}

function createWorker({ fullName, phone, role = 'worker', workStartTime = null, telegramId = null }) {
  const settings = getAllSettings();
  const startTime = workStartTime || (role === 'student' ? settings.work_start_student : settings.work_start_worker);
  const stmt = getDb().prepare(`
    INSERT INTO workers (full_name, phone, role, work_start_time, balance, is_active, telegram_id, created_at)
    VALUES (?, ?, ?, ?, 0, 1, ?, ?)
  `);
  const res = stmt.run(fullName, phone || '', role, startTime, telegramId ? Number(telegramId) : null, getTashkentDateTime());
  return res.lastInsertRowid;
}

function updateWorker(id, updates) {
  const worker = getWorkerById(id);
  if (!worker) return false;

  const fullName = updates.fullName !== undefined ? updates.fullName : worker.full_name;
  const phone = updates.phone !== undefined ? updates.phone : worker.phone;
  const role = updates.role !== undefined ? updates.role : worker.role;
  const workStartTime = updates.workStartTime !== undefined ? updates.workStartTime : worker.work_start_time;
  const telegramId = updates.telegramId !== undefined ? updates.telegramId : worker.telegram_id;
  const isActive = updates.isActive !== undefined ? updates.isActive : worker.is_active;

  getDb().prepare(`
    UPDATE workers SET full_name = ?, phone = ?, role = ?, work_start_time = ?, telegram_id = ?, is_active = ?
    WHERE id = ?
  `).run(fullName, phone, role, workStartTime, telegramId ? Number(telegramId) : null, isActive ? 1 : 0, Number(id));
  return true;
}

function deleteWorker(id) {
  // Soft delete
  return getDb().prepare(`UPDATE workers SET is_active = 0 WHERE id = ?`).run(Number(id));
}

function adjustWorkerBalance(workerId, deltaAmount) {
  return getDb().prepare(`UPDATE workers SET balance = balance + ? WHERE id = ?`).run(Number(deltaAmount), Number(workerId));
}

// ----------------- JOB TYPES METHODS -----------------
function getAllJobTypes(onlyActive = true) {
  const query = onlyActive
    ? `SELECT * FROM job_types WHERE is_active = 1 ORDER BY name ASC`
    : `SELECT * FROM job_types ORDER BY is_active DESC, name ASC`;
  return getDb().prepare(query).all();
}

function getJobTypeById(id) {
  return getDb().prepare(`SELECT * FROM job_types WHERE id = ?`).get(Number(id));
}

function createJobType(name, price, unit = 'juft') {
  const stmt = getDb().prepare(`INSERT INTO job_types (name, price, unit, is_active, created_at) VALUES (?, ?, ?, 1, ?)`);
  const res = stmt.run(name, Number(price), unit, getTashkentDateTime());
  return res.lastInsertRowid;
}

function updateJobType(id, updates) {
  const job = getJobTypeById(id);
  if (!job) return false;
  const name = updates.name !== undefined ? updates.name : job.name;
  const price = updates.price !== undefined ? Number(updates.price) : job.price;
  const unit = updates.unit !== undefined ? updates.unit : job.unit;
  const isActive = updates.isActive !== undefined ? updates.isActive : job.is_active;
  getDb().prepare(`UPDATE job_types SET name = ?, price = ?, unit = ?, is_active = ? WHERE id = ?`).run(
    name,
    price,
    unit,
    isActive ? 1 : 0,
    Number(id)
  );
  return true;
}

function deleteJobType(id) {
  return getDb().prepare(`UPDATE job_types SET is_active = 0 WHERE id = ?`).run(Number(id));
}

// ----------------- ATTENDANCE METHODS -----------------
function getTodayAttendance(date = null) {
  const targetDate = date || getTashkentDate();
  return getDb().prepare(`
    SELECT a.*, w.full_name, w.role, w.work_start_time, w.phone
    FROM attendance a
    JOIN workers w ON a.worker_id = w.id
    WHERE a.date = ?
    ORDER BY a.check_in_time ASC
  `).all(targetDate);
}

function getWorkerTodayAttendance(workerId, date = null) {
  const targetDate = date || getTashkentDate();
  return getDb().prepare(`
    SELECT * FROM attendance WHERE worker_id = ? AND date = ?
  `).get(Number(workerId), targetDate);
}

function checkInWorker(workerId, { checkInTime, bonusAmount = 0, fineAmount = 0, latitude = null, longitude = null }) {
  const date = getTashkentDate();
  const time = checkInTime || getTashkentTime();
  const existing = getWorkerTodayAttendance(workerId, date);
  if (existing) {
    return existing;
  }
  const status = fineAmount > 0 ? 'late' : 'present';
  const stmt = getDb().prepare(`
    INSERT INTO attendance (worker_id, date, check_in_time, status, bonus_amount, fine_amount, latitude, longitude, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    Number(workerId),
    date,
    time,
    status,
    Number(bonusAmount),
    Number(fineAmount),
    latitude ? Number(latitude) : null,
    longitude ? Number(longitude) : null,
    getTashkentDateTime()
  );

  // If there is an on-time bonus, credit to balance; if late fine, deduct from balance
  if (bonusAmount > 0) {
    adjustWorkerBalance(workerId, bonusAmount);
  }
  if (fineAmount > 0) {
    adjustWorkerBalance(workerId, -fineAmount);
  }

  return { id: res.lastInsertRowid, date, checkInTime: time, bonusAmount, fineAmount };
}

function checkOutWorker(workerId, { checkOutTime, workedMinutes }) {
  const date = getTashkentDate();
  const time = checkOutTime || getTashkentTime();
  const attendance = getWorkerTodayAttendance(workerId, date);
  if (!attendance) return null;

  getDb().prepare(`
    UPDATE attendance SET check_out_time = ?, worked_minutes = ?, status = 'completed'
    WHERE id = ?
  `).run(time, Number(workedMinutes), attendance.id);

  return { ...attendance, check_out_time: time, worked_minutes: workedMinutes, status: 'completed' };
}

function getAttendanceHistory(workerId, limit = 15) {
  return getDb().prepare(`
    SELECT * FROM attendance WHERE worker_id = ? ORDER BY date DESC, id DESC LIMIT ?
  `).all(Number(workerId), limit);
}

function getAttendanceReportData(startDate, endDate) {
  return getDb().prepare(`
    SELECT a.*, w.full_name, w.role, w.work_start_time
    FROM attendance a
    JOIN workers w ON a.worker_id = w.id
    WHERE a.date >= ? AND a.date <= ?
    ORDER BY a.date DESC, a.check_in_time ASC
  `).all(startDate, endDate);
}

// ----------------- WORK SUBMISSIONS METHODS (Tasdiqlash qutisi) -----------------
function createWorkSubmission(workerId, jobTypeId, quantity) {
  const job = getJobTypeById(jobTypeId);
  if (!job) throw new Error('Bunday ish turi mavjud emas');
  const unitPrice = job.price;
  const totalPrice = unitPrice * Number(quantity);
  const activePeriod = getCurrentPeriod();

  const stmt = getDb().prepare(`
    INSERT INTO work_submissions (worker_id, job_type_id, quantity, unit_price, total_price, status, original_quantity, period_id, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `);
  const res = stmt.run(
    Number(workerId),
    Number(jobTypeId),
    Number(quantity),
    Number(unitPrice),
    Number(totalPrice),
    Number(quantity),
    activePeriod.id,
    getTashkentDateTime()
  );
  return { id: res.lastInsertRowid, totalPrice, unitPrice };
}

function getPendingSubmissions() {
  return getDb().prepare(`
    SELECT ws.*, w.full_name as worker_name, w.role as worker_role, jt.name as job_name, jt.unit as job_unit
    FROM work_submissions ws
    JOIN workers w ON ws.worker_id = w.id
    JOIN job_types jt ON ws.job_type_id = jt.id
    WHERE ws.status = 'pending'
    ORDER BY ws.id ASC
  `).all();
}

function getSubmissionById(id) {
  return getDb().prepare(`
    SELECT ws.*, w.full_name as worker_name, w.telegram_id as worker_tg_id, jt.name as job_name, jt.unit as job_unit
    FROM work_submissions ws
    JOIN workers w ON ws.worker_id = w.id
    JOIN job_types jt ON ws.job_type_id = jt.id
    WHERE ws.id = ?
  `).get(Number(id));
}

function approveSubmission(id, adminTgId) {
  const sub = getSubmissionById(id);
  if (!sub || sub.status !== 'pending') return null;

  const now = getTashkentDateTime();
  getDb().prepare(`
    UPDATE work_submissions
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(Number(adminTgId), now, Number(id));

  // Add to worker balance
  adjustWorkerBalance(sub.worker_id, sub.total_price);
  return sub;
}

function editAndApproveSubmission(id, adminTgId, newQuantity, adminNote = '') {
  const sub = getSubmissionById(id);
  if (!sub || sub.status !== 'pending') return null;

  const newQty = Number(newQuantity);
  const newTotal = newQty * sub.unit_price;
  const now = getTashkentDateTime();

  getDb().prepare(`
    UPDATE work_submissions
    SET quantity = ?, total_price = ?, status = 'approved', admin_note = ?, approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(newQty, newTotal, adminNote, Number(adminTgId), now, Number(id));

  // Add adjusted amount to worker balance
  adjustWorkerBalance(sub.worker_id, newTotal);
  return { ...sub, quantity: newQty, total_price: newTotal, admin_note: adminNote };
}

function rejectSubmission(id, adminTgId, reason = '') {
  const sub = getSubmissionById(id);
  if (!sub || sub.status !== 'pending') return null;

  const now = getTashkentDateTime();
  getDb().prepare(`
    UPDATE work_submissions
    SET status = 'rejected', admin_note = ?, approved_by = ?, approved_at = ?
    WHERE id = ?
  `).run(reason, Number(adminTgId), now, Number(id));

  return { ...sub, admin_note: reason };
}

function getWorkerSubmissionsByPeriod(workerId, periodId) {
  return getDb().prepare(`
    SELECT ws.*, jt.name as job_name, jt.unit as job_unit
    FROM work_submissions ws
    JOIN job_types jt ON ws.job_type_id = jt.id
    WHERE ws.worker_id = ? AND ws.period_id = ? AND ws.status = 'approved'
    ORDER BY ws.id DESC
  `).all(Number(workerId), Number(periodId));
}

// ----------------- ADVANCES & FINES METHODS -----------------
function createAdvance(workerId, amount, reason = '', status = 'given') {
  const period = getCurrentPeriod();
  const numAmount = Number(amount);
  const stmt = getDb().prepare(`
    INSERT INTO advances (worker_id, amount, reason, status, period_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(Number(workerId), numAmount, reason, status, period.id, getTashkentDateTime());

  if (status === 'given') {
    adjustWorkerBalance(workerId, -numAmount);
  }
  return res.lastInsertRowid;
}

function createFine(workerId, amount, reason) {
  const period = getCurrentPeriod();
  const numAmount = Number(amount);
  const stmt = getDb().prepare(`
    INSERT INTO fines (worker_id, amount, reason, period_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const res = stmt.run(Number(workerId), numAmount, reason, period.id, getTashkentDateTime());

  adjustWorkerBalance(workerId, -numAmount);
  return res.lastInsertRowid;
}

function getWorkerPeriodFinancials(workerId, periodId) {
  const db = getDb();
  // Approved work
  const work = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as total_work
    FROM work_submissions
    WHERE worker_id = ? AND period_id = ? AND status = 'approved'
  `).get(Number(workerId), Number(periodId));

  // Attendance bonuses & late fines
  const att = db.prepare(`
    SELECT COALESCE(SUM(bonus_amount), 0) as total_bonus, COALESCE(SUM(fine_amount), 0) as total_late_fine
    FROM attendance
    WHERE worker_id = ? AND date >= (SELECT SUBSTR(start_date, 1, 10) FROM payroll_periods WHERE id = ?)
  `).get(Number(workerId), Number(periodId));

  // Advances
  const adv = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_advances
    FROM advances
    WHERE worker_id = ? AND period_id = ? AND status = 'given'
  `).get(Number(workerId), Number(periodId));

  // Other Fines
  const fn = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_fines
    FROM fines
    WHERE worker_id = ? AND period_id = ?
  `).get(Number(workerId), Number(periodId));

  const totalWork = work ? work.total_work : 0;
  const totalBonus = att ? att.total_bonus : 0;
  const totalLateFine = att ? att.total_late_fine : 0;
  const totalAdvances = adv ? adv.total_advances : 0;
  const totalFines = fn ? fn.total_fines : 0;

  const netSalary = totalWork + totalBonus - totalLateFine - totalFines - totalAdvances;

  return {
    totalWork,
    totalBonus,
    totalLateFine,
    totalFines,
    totalAdvances,
    netSalary
  };
}

// ----------------- CLIENTS METHODS -----------------
function getAllClients() {
  return getDb().prepare(`SELECT * FROM clients ORDER BY name ASC`).all();
}

function getClientById(id) {
  return getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(Number(id));
}

function getClientByTelegramId(telegramId) {
  if (!telegramId) return null;
  return getDb().prepare(`SELECT * FROM clients WHERE telegram_id = ?`).get(Number(telegramId));
}

function createClient({ name, phone, telegramId = null, username = '', companyName = '' }) {
  const stmt = getDb().prepare(`
    INSERT INTO clients (name, phone, telegram_id, username, company_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(
    name,
    phone || '',
    telegramId ? Number(telegramId) : null,
    username || '',
    companyName || '',
    getTashkentDateTime()
  );
  return res.lastInsertRowid;
}

function updateClient(id, updates) {
  const client = getClientById(id);
  if (!client) return false;
  const name = updates.name !== undefined ? updates.name : client.name;
  const phone = updates.phone !== undefined ? updates.phone : client.phone;
  const username = updates.username !== undefined ? updates.username : client.username;
  const companyName = updates.companyName !== undefined ? updates.companyName : client.company_name;
  const telegramId = updates.telegramId !== undefined ? updates.telegramId : client.telegram_id;

  getDb().prepare(`
    UPDATE clients SET name = ?, phone = ?, username = ?, company_name = ?, telegram_id = ?
    WHERE id = ?
  `).run(name, phone, username, companyName, telegramId ? Number(telegramId) : null, Number(id));
  return true;
}

function deleteClient(id) {
  return getDb().prepare(`DELETE FROM clients WHERE id = ?`).run(Number(id));
}

function createClientOrder({ clientId, productName, packsQuantity, pricePerPack, paidAmount = 0 }) {
  const packs = Number(packsQuantity);
  const price = Number(pricePerPack);
  const total = packs * price;
  const paid = Number(paidAmount);
  const debt = total - paid;

  const stmt = getDb().prepare(`
    INSERT INTO client_orders (client_id, product_name, packs_quantity, price_per_pack, total_amount, paid_amount, debt_amount, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(Number(clientId), productName, packs, price, total, paid, debt, getTashkentDateTime());
  return { id: res.lastInsertRowid, totalAmount: total, debtAmount: debt };
}

function getClientOrders(clientId) {
  return getDb().prepare(`
    SELECT * FROM client_orders WHERE client_id = ? ORDER BY id DESC
  `).all(Number(clientId));
}

function getClientFinancialSummary(clientId) {
  const row = getDb().prepare(`
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_bought,
      COALESCE(SUM(paid_amount), 0) as total_paid,
      COALESCE(SUM(debt_amount), 0) as total_debt,
      COALESCE(SUM(packs_quantity), 0) as total_packs,
      COUNT(id) as total_orders
    FROM client_orders
    WHERE client_id = ?
  `).get(Number(clientId));
  return row;
}

function saveClientMessage(clientId, senderType, text) {
  const stmt = getDb().prepare(`
    INSERT INTO client_messages (client_id, sender_type, text, is_read, created_at)
    VALUES (?, ?, ?, 0, ?)
  `);
  return stmt.run(Number(clientId), senderType, text, getTashkentDateTime());
}

function getClientMessages(clientId, limit = 20) {
  return getDb().prepare(`
    SELECT * FROM client_messages WHERE client_id = ? ORDER BY id DESC LIMIT ?
  `).all(Number(clientId), limit);
}

// ----------------- PAYROLL & SETTLEMENTS -----------------
function getCurrentPeriod() {
  let period = getDb().prepare(`SELECT * FROM payroll_periods WHERE status = 'active'`).get();
  if (!period) {
    const maxPeriod = getDb().prepare(`SELECT max(period_number) as m FROM payroll_periods`).get();
    const nextNum = (maxPeriod && maxPeriod.m ? maxPeriod.m : 0) + 1;
    const res = getDb().prepare(`INSERT INTO payroll_periods (period_number, start_date, status, created_at) VALUES (?, ?, 'active', ?)`).run(
      nextNum,
      getTashkentDateTime(),
      getTashkentDateTime()
    );
    period = { id: res.lastInsertRowid, period_number: nextNum, start_date: getTashkentDateTime(), status: 'active' };
  }
  return period;
}

function closePeriodAndSettleAll() {
  const db = getDb();
  const currentPeriod = getCurrentPeriod();
  const workers = getAllWorkers(true);
  const now = getTashkentDateTime();

  let totalPayout = 0;
  const settlements = [];

  for (const w of workers) {
    const fin = getWorkerPeriodFinancials(w.id, currentPeriod.id);
    totalPayout += fin.netSalary;

    db.prepare(`
      INSERT INTO payroll_settlements (
        period_id, worker_id, worker_name, total_work_sum, total_bonus, 
        total_late_fine, total_other_fine, total_advance, net_salary, settled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      currentPeriod.id,
      w.id,
      w.full_name,
      fin.totalWork,
      fin.totalBonus,
      fin.totalLateFine,
      fin.totalFines,
      fin.totalAdvances,
      fin.netSalary,
      now
    );

    // Reset worker balance to 0 for new period
    db.prepare(`UPDATE workers SET balance = 0 WHERE id = ?`).run(w.id);

    settlements.push({
      worker: w,
      financials: fin
    });
  }

  // Close current period
  db.prepare(`
    UPDATE payroll_periods
    SET status = 'closed', end_date = ?, total_payout = ?
    WHERE id = ?
  `).run(now, totalPayout, currentPeriod.id);

  // Open next period
  const nextNum = currentPeriod.period_number + 1;
  const newPeriodRes = db.prepare(`
    INSERT INTO payroll_periods (period_number, start_date, status, created_at)
    VALUES (?, ?, 'active', ?)
  `).run(nextNum, now, now);

  return {
    closedPeriod: { ...currentPeriod, end_date: now, total_payout: totalPayout },
    newPeriodId: newPeriodRes.lastInsertRowid,
    settlements,
    totalPayout
  };
}

module.exports = {
  getDb,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // Admins
  getAdminByTelegramId,
  getAllAdmins,
  addAdmin,
  removeAdmin,
  // Workers
  getAllWorkers,
  getWorkerById,
  getWorkerByTelegramId,
  getWorkerByPhone,
  createWorker,
  updateWorker,
  deleteWorker,
  adjustWorkerBalance,
  // Job Types
  getAllJobTypes,
  getJobTypeById,
  createJobType,
  updateJobType,
  deleteJobType,
  // Attendance
  getTodayAttendance,
  getWorkerTodayAttendance,
  checkInWorker,
  checkOutWorker,
  getAttendanceHistory,
  getAttendanceReportData,
  // Work Submissions
  createWorkSubmission,
  getPendingSubmissions,
  getSubmissionById,
  approveSubmission,
  editAndApproveSubmission,
  rejectSubmission,
  getWorkerSubmissionsByPeriod,
  // Advances & Fines
  createAdvance,
  createFine,
  getWorkerPeriodFinancials,
  // Clients
  getAllClients,
  getClientById,
  getClientByTelegramId,
  createClient,
  updateClient,
  deleteClient,
  createClientOrder,
  getClientOrders,
  getClientFinancialSummary,
  saveClientMessage,
  getClientMessages,
  // Payroll
  getCurrentPeriod,
  closePeriodAndSettleAll
};
