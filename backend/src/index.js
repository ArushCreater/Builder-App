const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8081;
const dbUrl = process.env.DATABASE_URL;
const BODY_LIMIT = process.env.BODY_LIMIT || '12mb';
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const FILES_BUCKET = process.env.FILES_BUCKET || process.env.FILES_BUCKET_NAME || 'builder-app-dev-files-saving-guppy';

let pool;
if (dbUrl) {
  pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
}

const s3 = new S3Client({ region: REGION });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// CORS handling based on env
const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowAll = allowedOrigins.includes('*') || allowedOrigins.length === 0;

const isDevOrigin = (origin = '') => origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
const isVercelOrigin = (origin = '') => origin.includes('.vercel.app');

const corsOptions = {
  origin: allowAll
    ? (origin, callback) => callback(null, origin || '*')
    : (origin, callback) => {
        if (!origin) return callback(null, false);
        if (allowedOrigins.includes(origin) || isDevOrigin(origin) || isVercelOrigin(origin)) return callback(null, origin);
        return callback(new Error('Not allowed by CORS'));
      },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(morgan('tiny'));
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const PUBLIC_PATHS = new Set(['/', '/health', '/api/ping']);
const jwksCache = new Map();
let joseModulePromise;

function getJose() {
  if (!joseModulePromise) {
    joseModulePromise = import('jose');
  }
  return joseModulePromise;
}

function getTokenMetadata(token) {
  const decoded = jwt.decode(token, { complete: true }) || {};
  return {
    header: decoded.header || {},
    payload: decoded.payload || {},
  };
}

async function getJwksForIssuer(issuer) {
  if (!jwksCache.has(issuer)) {
    const { createRemoteJWKSet } = await getJose();
    const issuerUrl = issuer.endsWith('/') ? issuer : `${issuer}/`;
    const jwksUrl = new URL('.well-known/jwks.json', issuerUrl);
    jwksCache.set(issuer, createRemoteJWKSet(jwksUrl));
  }
  return jwksCache.get(issuer);
}

async function verifyAccessToken(token) {
  const { header, payload } = getTokenMetadata(token);
  const algorithm = header.alg;

  if (algorithm === 'HS256') {
    if (!JWT_SECRET) {
      throw new Error('SUPABASE_JWT_SECRET not configured');
    }
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  }

  if (!payload.iss) {
    throw new Error('JWT issuer missing');
  }

  const { jwtVerify } = await getJose();
  const jwks = await getJwksForIssuer(String(payload.iss));
  const verificationOptions = { issuer: String(payload.iss) };
  if (payload.aud) {
    verificationOptions.audience = payload.aud;
  }

  const verified = await jwtVerify(token, jwks, verificationOptions);
  return verified.payload;
}

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC_PATHS.has(req.path)) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const payload = await verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

async function ensureTables() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id uuid PRIMARY KEY,
        first_name text,
        last_name text,
        email text,
        phone text,
        status text,
        source text,
        estimated_value numeric,
        notes text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY,
        name text,
        description text,
        type text,
        status text,
        address text,
        city text,
        state text,
        zip_code text,
        start_date date,
        end_date date,
        estimated_budget numeric,
        actual_cost numeric,
        owner_id text,
        progress numeric DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress numeric DEFAULT 0;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id uuid PRIMARY KEY,
        title text,
        description text,
        status text,
        priority text,
        assignee text,
        project_id text,
        project_name text,
        due_date date,
        completed boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id uuid PRIMARY KEY,
        name text,
        phone text,
        email text,
        company text,
        office_number text,
        address text,
        designation text,
        favorite boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS favorite boolean DEFAULT false;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS proposals (
        id uuid PRIMARY KEY,
        title text,
        client_name text,
        project_id text,
        project_name text,
        amount numeric,
        status text,
        valid_until date,
        file_url text,
        file_name text,
        file_type text,
        created_at timestamptz DEFAULT now()
      );
      ALTER TABLE proposals ADD COLUMN IF NOT EXISTS file_url text;
      ALTER TABLE proposals ADD COLUMN IF NOT EXISTS file_name text;
      ALTER TABLE proposals ADD COLUMN IF NOT EXISTS file_type text;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedule_events (
        id uuid PRIMARY KEY,
        title text,
        project_id text,
        project_name text,
        type text,
        start_date date,
        end_date date,
        assignee text,
        description text,
        location text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_logs (
        id uuid PRIMARY KEY,
        project_id text,
        project_name text,
        date date,
        weather text,
        temperature text,
        work_performed text,
        crew_size int,
        hours_worked numeric,
        equipment_used text,
        materials_received text,
        notes text,
        photos int,
        created_by text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id uuid PRIMARY KEY,
        invoice_number text,
        project_id text,
        project_name text,
        client_name text,
        amount numeric,
        status text,
        due_date date,
        issue_date date,
        description text,
        file_url text,
        file_name text,
        file_type text,
        type text,
        created_at timestamptz DEFAULT now()
      );
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS type text;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id uuid PRIMARY KEY,
        task_id uuid,
        title text,
        type text,
        category text,
        vendor text,
        amount numeric,
        tax numeric,
        total numeric,
        status text,
        payment_method text,
        date date,
        due_date date,
        project_id text,
        project_name text,
        notes text,
        receipt_url text,
        receipt_name text,
        receipt_type text,
        created_at timestamptz DEFAULT now()
      );
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS task_id uuid;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_name text;
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_type text;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id uuid PRIMARY KEY,
        name text,
        description text,
        quantity numeric,
        unit text,
        cost_per_unit numeric,
        total_cost numeric,
        supplier text,
        project_name text,
        project_id text,
        status text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS selections (
        id uuid PRIMARY KEY,
        category text,
        item text,
        description text,
        choice text,
        cost numeric,
        status text,
        project_name text,
        project_id text,
        client_name text,
        due_date date,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id uuid PRIMARY KEY,
        vendor text,
        amount numeric,
        status text,
        scope text,
        project_name text,
        project_id text,
        submitted_date date,
        valid_until date,
        contact text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id uuid PRIMARY KEY,
        title text,
        type text,
        status text,
        date date,
        scheduled_date date,
        project_name text,
        project_id text,
        inspector text,
        notes text,
        completed_date date,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment (
        id uuid PRIMARY KEY,
        name text,
        type text,
        status text,
        location text,
        project_id text,
        project_name text,
        assigned_to text,
        purchase_date date,
        purchase_price numeric,
        last_service date,
        next_maintenance date,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sold_properties (
        id uuid PRIMARY KEY,
        project_name text,
        buyer text,
        sale_price numeric,
        profit numeric,
        close_date date,
        status text,
        handoff_notes text,
        address text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_doc_pages (
        id uuid PRIMARY KEY,
        project_id text NOT NULL,
        title text,
        content text,
        images jsonb DEFAULT '[]'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_project_doc_pages_project ON project_doc_pages(project_id);`);
    await client.query(`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS task_id text;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_schedule_events_task_id ON schedule_events(task_id);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key text PRIMARY KEY,
        value text
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id uuid PRIMARY KEY,
        first_name text NOT NULL DEFAULT '',
        last_name text NOT NULL DEFAULT '',
        email text NOT NULL DEFAULT '',
        role text NOT NULL DEFAULT 'contractor',
        phone text DEFAULT '',
        status text NOT NULL DEFAULT 'active',
        avatar text,
        created_at timestamptz DEFAULT now()
      );
    `);
    await seedDemoData(client);
  } finally {
    client.release();
  }
}

async function syncTaskToSchedule(task) {
  if (!pool || !task.dueDate) return;
  try {
    const existing = await pool.query('SELECT id FROM schedule_events WHERE task_id = $1', [task.id]);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE schedule_events SET title=$1, project_id=$2, project_name=$3, start_date=$4, end_date=$5, assignee=$6, description=$7, updated_at=now() WHERE task_id=$8`,
        [task.title, task.projectId || null, task.projectName || null, task.dueDate, task.dueDate, task.assignee || null, task.description || null, task.id]
      );
    } else {
      await pool.query(
        `INSERT INTO schedule_events (id, title, project_id, project_name, type, start_date, end_date, assignee, description, task_id)
         VALUES ($1,$2,$3,$4,'task',$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [randomUUID(), task.title, task.projectId || null, task.projectName || null, task.dueDate, task.dueDate, task.assignee || null, task.description || null, task.id]
      );
    }
  } catch {}
}

async function seedDemoData(client) {
  const ids = {
    proj1: randomUUID(),
    proj2: randomUUID(),
    task1: randomUUID(),
    task2: randomUUID(),
    prop1: randomUUID(),
    prop2: randomUUID(),
    inv1: randomUUID(),
    inv2: randomUUID(),
    mat1: randomUUID(),
    mat2: randomUUID(),
    sel1: randomUUID(),
    sel2: randomUUID(),
    insp1: randomUUID(),
    insp2: randomUUID(),
  };

  // Projects
  const projCount = await client.query('SELECT count(*)::int AS c FROM projects');
  if (projCount.rows[0].c === 0) {
    const demoProjects = [
      {
        id: ids.proj1,
        name: 'Harborview Residences',
        description: '12-story mixed-use tower with retail podium',
        type: 'residential',
        status: 'IN_PROGRESS',
        address: '1 Ocean Ave',
        city: 'Sydney',
        state: 'NSW',
        zip_code: '2000',
        start_date: '2024-06-01',
        end_date: '2025-05-15',
        estimated_budget: 18500000,
        actual_cost: 6200000,
        owner_id: 'seed-owner',
        progress: 38,
      },
      {
        id: ids.proj2,
        name: 'Northbridge Logistics Hub',
        description: 'Distribution center with automated racking',
        type: 'commercial',
        status: 'PLANNING',
        address: '88 Industrial Rd',
        city: 'Melbourne',
        state: 'VIC',
        zip_code: '3000',
        start_date: '2024-09-01',
        end_date: '2025-12-20',
        estimated_budget: 9200000,
        actual_cost: 1200000,
        owner_id: 'seed-owner',
        progress: 12,
      },
    ];
    for (const p of demoProjects) {
      await client.query(
        `INSERT INTO projects (id, name, description, type, status, address, city, state, zip_code, start_date, end_date, estimated_budget, actual_cost, owner_id, progress)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          p.id,
          p.name,
          p.description,
          p.type,
          p.status,
          p.address,
          p.city,
          p.state,
          p.zip_code,
          p.start_date,
          p.end_date,
          p.estimated_budget,
          p.actual_cost,
          p.owner_id,
          p.progress,
        ]
      );
    }
  }

  // Tasks
  const taskCount = await client.query('SELECT count(*)::int AS c FROM tasks');
  if (taskCount.rows[0].c === 0) {
    const tasksSeed = [
      {
        id: ids.task1,
        title: 'Site prep & utilities',
        description: 'Trenching and temporary power',
        status: 'IN_PROGRESS',
        priority: 'high',
        assignee: 'Foreman Lee',
        project_id: ids.proj1,
        project_name: 'Harborview Residences',
        due_date: '2024-12-05',
      },
      {
        id: ids.task2,
        title: 'Core & shell level 4',
        description: 'Pour slab, set rebar cages',
        status: 'PLANNING',
        priority: 'medium',
        assignee: 'Concrete Crew',
        project_id: ids.proj1,
        project_name: 'Harborview Residences',
        due_date: '2025-01-15',
      },
    ];
    for (const t of tasksSeed) {
      await client.query(
        `INSERT INTO tasks (id, title, description, status, priority, assignee, project_id, project_name, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee,
          t.project_id,
          t.project_name,
          t.due_date,
        ]
      );
    }
  }

  // Proposals
  const proposalCount = await client.query('SELECT count(*)::int AS c FROM proposals');
  if (proposalCount.rows[0].c === 0) {
    await client.query(
      `INSERT INTO proposals (id, title, client_name, project_id, project_name, amount, status, valid_until, file_url, file_name, file_type)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
       ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        ids.prop1,
        'Facade & glazing package',
        'Skyline Glass',
        ids.proj1,
        'Harborview Residences',
        4800000,
        'sent',
        '2025-02-01',
        null,
        null,
        null,
        ids.prop2,
        'Fire systems and sprinklers',
        'SafeFlow',
        ids.proj2,
        'Northbridge Logistics Hub',
        725000,
        'draft',
        '2025-03-15',
        null,
        null,
        null,
      ]
    );
  }

  // Invoices
  const invoiceCount = await client.query('SELECT count(*)::int AS c FROM invoices');
  if (invoiceCount.rows[0].c === 0) {
    await client.query(
      `INSERT INTO invoices (id, invoice_number, project_id, project_name, client_name, amount, status, due_date, issue_date, description, type)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
       ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        ids.inv1,
        'INV-001',
        ids.proj1,
        'Harborview Residences',
        'Acme Developments',
        320000,
        'paid',
        '2024-12-20',
        '2024-12-01',
        'Progress claim #3 - structure',
        'invoice',
        ids.inv2,
        'INV-002',
        ids.proj2,
        'Northbridge Logistics Hub',
        'Global Logistics Pty',
        185000,
        'unpaid',
        '2025-01-30',
        '2025-01-05',
        'Deposit for racking install',
        'invoice',
      ]
    );
  }

  // Materials
  const matCount = await client.query('SELECT count(*)::int AS c FROM materials');
  if (matCount.rows[0].c === 0) {
    await client.query(
      `INSERT INTO materials (id, name, description, quantity, unit, cost_per_unit, total_cost, supplier, project_name, project_id, status)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
       ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        ids.mat1,
        'Post-tension cables',
        'PT kits for levels 3-5',
        45,
        'ea',
        950,
        42750,
        'CableCo',
        'Harborview Residences',
        ids.proj1,
        'ordered',
        ids.mat2,
        'HVAC air handlers',
        'Rooftop AHUs with VFD',
        4,
        'units',
        22000,
        88000,
        'CoolAir',
        'Northbridge Logistics Hub',
        ids.proj2,
        'in-stock',
      ]
    );
  }

  // Selections
  const selCount = await client.query('SELECT count(*)::int AS c FROM selections');
  if (selCount.rows[0].c === 0) {
    await client.query(
      `INSERT INTO selections (id, category, item, description, choice, cost, status, project_name, project_id, client_name, due_date)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
       ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        ids.sel1,
        'Lobby finishes',
        'Flooring',
        'Large format porcelain tile',
        'Matte charcoal',
        145000,
        'approved',
        'Harborview Residences',
        ids.proj1,
        'Acme Developments',
        '2025-01-15',
        ids.sel2,
        'Warehouse lighting',
        'High-bay LEDs',
        'General warehouse illumination',
        'Neutral white 4000K',
        82000,
        'pending',
        'Northbridge Logistics Hub',
        ids.proj2,
        'Global Logistics Pty',
        '2025-02-10',
      ]
    );
  }

  // Inspections
  const inspCount = await client.query('SELECT count(*)::int AS c FROM inspections');
  if (inspCount.rows[0].c === 0) {
    await client.query(
      `INSERT INTO inspections (id, title, type, status, date, scheduled_date, project_name, project_id, inspector, notes, completed_date)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11),
       ($12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        ids.insp1,
        'Framing Inspection L2',
        'framing',
        'scheduled',
        '2025-01-08',
        '2025-01-08',
        'Harborview Residences',
        ids.proj1,
        'City Inspector',
        'Check shear walls and PT cables',
        null,
        ids.insp2,
        'Fire system hydro',
        'fire',
        'pending',
        '2025-02-05',
        '2025-02-05',
        'Northbridge Logistics Hub',
        ids.proj2,
        'SafeFlow',
        'Witness hydrostatic test',
        null,
      ]
    );
  }
}

// --- In-memory demo data ---
const projects = [
  {
    id: 'p-1',
    name: 'Sunrise Apartments',
    description: '12-unit multifamily build',
    type: 'residential',
    status: 'IN_PROGRESS',
    address: '12 Main St',
    city: 'Sydney',
    state: 'NSW',
    zipCode: '2000',
    startDate: '2024-01-05',
    endDate: '2024-08-15',
    estimatedBudget: 750000,
    actualCost: 320000,
    progress: 45,
    ownerId: 'u-1',
    createdAt: '2024-01-01',
    updatedAt: '2024-02-01',
  },
  {
    id: 'p-2',
    name: 'Downtown Office',
    description: '5-story steel frame',
    type: 'commercial',
    status: 'PLANNING',
    address: '200 George St',
    city: 'Sydney',
    state: 'NSW',
    zipCode: '2000',
    startDate: '2024-04-01',
    endDate: '2025-02-01',
    estimatedBudget: 1500000,
    actualCost: 0,
    progress: 10,
    ownerId: 'u-2',
    createdAt: '2024-03-10',
    updatedAt: '2024-03-10',
  },
];

const leads = [
  {
    id: 'l-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@example.com',
    phone: '+61 412 345 678',
    status: 'new',
    source: 'Website',
    estimatedValue: 150000,
    createdAt: '2024-02-01',
    notes: 'Wants timeline and budget clarity',
  },
  {
    id: 'l-2',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+61 498 222 333',
    status: 'contacted',
    source: 'Referral',
    estimatedValue: 250000,
    createdAt: '2024-02-10',
    notes: 'Requested design options',
  },
];

const tasks = [
  {
    id: 't-1',
    title: 'Site prep',
    description: 'Clear and grade site',
    status: 'todo',
    priority: 'high',
    assignee: 'Alex',
    projectName: 'Sunrise Apartments',
    dueDate: '2024-04-10',
    completed: false,
  },
];

const users = [
  {
    id: 'u-1',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    role: 'admin',
    phone: '+61 400 000 000',
    avatar: '',
    status: 'active',
    createdAt: '2024-01-01',
  },
  {
    id: 'u-2',
    firstName: 'Project',
    lastName: 'Manager',
    email: 'pm@example.com',
    role: 'manager',
    phone: '+61 411 222 333',
    avatar: '',
    status: 'active',
    createdAt: '2024-01-02',
  },
];

const materials = [
  { id: 'm-1', name: 'Concrete', description: 'Ready-mix 25 MPa', quantity: 30, unit: 'm3', costPerUnit: 120, totalCost: 3600, supplier: 'BuildCo', projectName: 'Sunrise Apartments', projectId: 'p-1', status: 'in-stock' },
  { id: 'm-2', name: 'Steel Rebar', description: 'Grade 500N', quantity: 2, unit: 'ton', costPerUnit: 950, totalCost: 1900, supplier: 'SteelWorks', projectName: 'Downtown Office', projectId: 'p-2', status: 'ordered' },
];

const expenses = [
  {
    id: 'exp-1',
    title: 'Site utilities setup',
    type: 'project',
    category: 'Site Services',
    vendor: 'UtilityCo',
    amount: 2400,
    tax: 240,
    total: 2640,
    status: 'approved',
    paymentMethod: 'credit_card',
    date: '2024-12-01',
    dueDate: '2024-12-15',
    projectId: 'p-1',
    projectName: 'Sunrise Apartments',
    notes: 'Temporary power & water',
    receiptUrl: '',
    receiptName: '',
    receiptType: '',
  },
  {
    id: 'exp-2',
    title: 'Office phone line',
    type: 'non-project',
    category: 'Operations',
    vendor: 'Telco',
    amount: 120,
    tax: 12,
    total: 132,
    status: 'paid',
    paymentMethod: 'ach',
    date: '2024-11-22',
    dueDate: '2024-11-22',
    projectId: '',
    projectName: '',
    notes: 'Monthly plan',
    receiptUrl: '',
    receiptName: '',
    receiptType: '',
  },
];

// Expenses
app.get('/api/expenses', (req, res) => {
  const { type, projectId, search, status } = req.query;
  if (!pool) {
    let list = [...expenses];
    if (type && type !== 'all') list = list.filter(e => e.type === type);
    if (projectId) list = list.filter(e => e.projectId === projectId);
    if (status) list = list.filter(e => e.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        e =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.vendor || '').toLowerCase().includes(q) ||
          (e.category || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    return res.json({ expenses: list });
  }
  const clauses = [];
  const values = [];
  if (type && type !== 'all') {
    clauses.push(`type = $${clauses.length + 1}`);
    values.push(type);
  }
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(
      `(LOWER(title) LIKE $${clauses.length + 1} OR LOWER(vendor) LIKE $${clauses.length + 1} OR LOWER(category) LIKE $${clauses.length + 1})`
    );
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM expenses ${where} ORDER BY date DESC NULLS LAST, created_at DESC`, values)
    .then(result =>
      res.json({
        expenses: result.rows.map(r => ({
          id: r.id,
          title: r.title,
          type: r.type,
          category: r.category,
          vendor: r.vendor,
          amount: Number(r.amount || 0),
          tax: Number(r.tax || 0),
          total: Number(r.total || 0),
          status: r.status,
          paymentMethod: r.payment_method,
          date: r.date,
          dueDate: r.due_date,
          projectId: r.project_id,
          projectName: r.project_name,
          notes: r.notes,
          receiptUrl: r.receipt_url,
          receiptName: r.receipt_name,
          receiptType: r.receipt_type,
        })),
      })
    )
    .catch(() => res.json({ expenses }));
});

app.post('/api/expenses', (req, res) => {
  const body = req.body || {};
  const amount = parseFloat(body.amount) || 0;
  const tax = parseFloat(body.tax) || 0;
  const total = body.total !== undefined ? parseFloat(body.total) || 0 : amount + tax;
  const expense = {
    id: randomUUID(),
    title: body.title || 'Expense',
    type: body.type || (body.projectId ? 'project' : 'non-project'),
    category: body.category || 'General',
    vendor: body.vendor || '',
    amount,
    tax,
    total,
    status: body.status || 'draft',
    paymentMethod: body.paymentMethod || '',
    date: body.date || null,
    dueDate: body.dueDate || null,
    projectId: body.projectId || '',
    projectName: body.projectName || '',
    notes: body.notes || '',
    receiptUrl: body.receiptUrl,
    receiptName: body.receiptName,
    receiptType: body.receiptType,
  };
  if (!pool) {
    expenses.unshift(expense);
    return res.json({ expense });
  }
  pool
    .query(
      `INSERT INTO expenses (id, title, type, category, vendor, amount, tax, total, status, payment_method, date, due_date, project_id, project_name, notes, receipt_url, receipt_name, receipt_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        expense.id,
        expense.title,
        expense.type,
        expense.category,
        expense.vendor,
        expense.amount,
        expense.tax,
        expense.total,
        expense.status,
        expense.paymentMethod,
        expense.date || null,
        expense.dueDate || null,
        expense.projectId,
        expense.projectName,
        expense.notes,
        expense.receiptUrl,
        expense.receiptName,
        expense.receiptType,
      ]
    )
    .then(result => res.json({ expense: result.rows[0] }))
    .catch(() => res.json({ expense }));
});

app.put('/api/expenses/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const exp = expenses.find(e => e.id === req.params.id);
    if (!exp) return res.status(404).json({ message: 'Not found' });
    const amount = body.amount !== undefined ? parseFloat(body.amount) || 0 : exp.amount;
    const tax = body.tax !== undefined ? parseFloat(body.tax) || 0 : exp.tax;
    const total = body.total !== undefined ? parseFloat(body.total) || amount + tax : exp.total;
    Object.assign(exp, {
      title: body.title ?? exp.title,
      type: body.type ?? exp.type,
      category: body.category ?? exp.category,
      vendor: body.vendor ?? exp.vendor,
      amount,
      tax,
      total,
      status: body.status ?? exp.status,
      paymentMethod: body.paymentMethod ?? exp.paymentMethod,
      date: body.date === '' ? null : body.date ?? exp.date,
      dueDate: body.dueDate === '' ? null : body.dueDate ?? exp.dueDate,
      projectId: body.projectId ?? exp.projectId,
      projectName: body.projectName ?? exp.projectName,
      notes: body.notes ?? exp.notes,
      receiptUrl: body.receiptUrl ?? exp.receiptUrl,
      receiptName: body.receiptName ?? exp.receiptName,
      receiptType: body.receiptType ?? exp.receiptType,
    });
    return res.json({ expense: exp });
  }
  pool
    .query('SELECT * FROM expenses WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      const amount = body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount;
      const tax = body.tax !== undefined ? parseFloat(body.tax) || 0 : current.tax;
      const total = body.total !== undefined ? parseFloat(body.total) || amount + tax : current.total;
      return pool
        .query(
          `UPDATE expenses SET
             title=$1, type=$2, category=$3, vendor=$4, amount=$5, tax=$6, total=$7, status=$8, payment_method=$9,
             date=$10, due_date=$11, project_id=$12, project_name=$13, notes=$14, receipt_url=$15, receipt_name=$16, receipt_type=$17
           WHERE id=$18
           RETURNING *`,
          [
            body.title ?? current.title,
            body.type ?? current.type,
            body.category ?? current.category,
            body.vendor ?? current.vendor,
            amount,
            tax,
            total,
            body.status ?? current.status,
            body.paymentMethod ?? current.payment_method,
            body.date === '' ? current.date : body.date ?? current.date,
            body.dueDate === '' ? current.due_date : body.dueDate ?? current.due_date,
            body.projectId ?? current.project_id,
            body.projectName ?? current.project_name,
            body.notes ?? current.notes,
            body.receiptUrl ?? current.receipt_url,
            body.receiptName ?? current.receipt_name,
            body.receiptType ?? current.receipt_type,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ expense: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/expenses/:id', (req, res) => {
  if (!pool) {
    const idx = expenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = expenses.splice(idx, 1);
    return res.json({ expense: removed });
  }
  pool
    .query('DELETE FROM expenses WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ expense: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Health endpoints for EB
app.get('/', (_req, res) => res.json({ status: 'ok' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const selections = [
  { id: 's-1', category: 'Cabinetry', item: 'Kitchen Cabinets', description: 'Shaker style', choice: 'Matte White', cost: 4500, status: 'pending', projectName: 'Sunrise Apartments', projectId: 'p-1', clientName: 'John Smith', dueDate: '2024-05-01' },
  { id: 's-2', category: 'Flooring', item: 'Flooring', description: 'Engineered timber', choice: 'Oak', cost: 8200, status: 'approved', projectName: 'Downtown Office', projectId: 'p-2', clientName: 'Jane Doe', dueDate: '2024-04-15' },
];

const dailyLogs = [
  { id: 'd-1', projectName: 'Sunrise Apartments', date: '2024-03-01', weather: 'Sunny', temperature: '22C', workPerformed: 'Site prep complete', crewSize: 8, hoursWorked: 8, equipmentUsed: 'Excavator', materialsReceived: 'Gravel', notes: 'Good progress', photos: 0, createdBy: 'Admin' },
  { id: 'd-2', projectName: 'Downtown Office', date: '2024-03-02', weather: 'Cloudy', temperature: '19C', workPerformed: 'Footings poured', crewSize: 10, hoursWorked: 7.5, equipmentUsed: 'Concrete pump', materialsReceived: 'Rebar', notes: 'No issues', photos: 0, createdBy: 'PM' },
];

const projectTasks = {};
const projectDocuments = {};
const projectDocPages = {};

const documents = [
  {
    id: 'doc-1',
    name: 'Contract.pdf',
    type: 'pdf',
    category: 'contract',
    size: '2.3 MB',
    projectName: 'Sunrise Apartments',
    projectId: 'p-1',
    uploadedBy: 'Admin User',
    uploadedAt: '2024-02-01',
    url: '#',
  },
  {
    id: 'doc-2',
    name: 'Floorplan.dwg',
    type: 'dwg',
    category: 'plans',
    size: '5.1 MB',
    projectName: 'Downtown Office',
    projectId: 'p-2',
    uploadedBy: 'PM User',
    uploadedAt: '2024-02-05',
    url: '#',
  },
];

const bids = [
  { id: 'b-1', vendor: 'ABC Electrical', amount: 55000, status: 'submitted', scope: 'Electrical rough-in', projectName: 'Sunrise Apartments', projectId: 'p-1', submittedDate: '2024-03-01', validUntil: '2024-03-20', contact: 'estimator@abcelectrical.com' },
  { id: 'b-2', vendor: 'Prime Plumbing', amount: 42000, status: 'review', scope: 'Plumbing rough-in', projectName: 'Downtown Office', projectId: 'p-2', submittedDate: '2024-03-02', validUntil: '2024-03-18', contact: 'pm@primeplumbing.com' },
];

const inspections = [
  { id: 'i-1', title: 'Framing Inspection', type: 'framing', status: 'scheduled', date: '2024-06-01', projectName: 'Sunrise Apartments', projectId: 'p-1', inspector: 'City Inspector' },
  { id: 'i-2', title: 'Electrical Inspection', type: 'electrical', status: 'pending', date: '2024-06-15', projectName: 'Downtown Office', projectId: 'p-2', inspector: 'Safety First' },
];

const equipment = [
  { id: 'e-1', name: 'Excavator', type: 'heavy', status: 'in_use', location: 'Site A', lastService: '2024-02-10', nextMaintenance: '2024-04-15', projectId: 'p-1', projectName: 'Sunrise Apartments', purchaseDate: '2023-06-01', purchasePrice: 75000 },
  { id: 'e-2', name: 'Scissor Lift', type: 'lift', status: 'available', location: 'Yard', lastService: '2024-01-20', nextMaintenance: '2024-03-20', purchaseDate: '2023-01-15', purchasePrice: 32000 },
];

const sold = [];

const contacts = [
  {
    id: 'c-1',
    name: 'Alex Turner',
    phone: '+61 400 111 222',
    email: 'alex@turnerco.com',
    company: 'Turner Co.',
    officeNumber: '02 8000 1234',
    address: '12 Market St, Sydney',
    designation: 'Owner',
    favorite: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'c-2',
    name: 'Priya Singh',
    phone: '+61 412 987 654',
    email: 'priya@designhub.com',
    company: 'DesignHub',
    officeNumber: '03 9600 5555',
    address: '55 Collins St, Melbourne',
    designation: 'Architect',
    favorite: false,
    createdAt: new Date().toISOString(),
  },
];

const messages = [
  { id: 'msg-1', sender: 'Admin', content: 'Kickoff meeting at 9am tomorrow', timestamp: '2024-03-01T08:00:00Z' },
  { id: 'msg-2', sender: 'PM', content: 'Materials delivery confirmed for Friday', timestamp: '2024-03-01T10:30:00Z' },
];

const proposals = [
  {
    id: 'pr-1',
    title: 'Electrical Package',
    clientName: 'Acme Corp',
    projectName: 'Sunrise Apartments',
    projectId: 'p-1',
    amount: 55000,
    status: 'sent',
    validUntil: '2024-04-15',
    createdAt: '2024-03-20',
  },
];

const invoices = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2024-001',
    projectId: 'p-1',
    projectName: 'Sunrise Apartments',
    clientName: 'John Smith',
    amount: 45000,
    status: 'paid',
    dueDate: '2024-01-15',
    issueDate: '2024-01-01',
    description: 'Foundation and framing work',
    type: 'invoice',
    createdAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2024-002',
    projectId: 'p-2',
    projectName: 'Downtown Office',
    clientName: 'ABC Corporation',
    amount: 78500,
    status: 'unpaid',
    dueDate: '2024-02-28',
    issueDate: '2024-02-01',
    description: 'Electrical and plumbing installation',
    type: 'invoice',
    createdAt: '2024-02-01T10:00:00Z',
  },
];

const scheduleEvents = [
  {
    id: 'sch-1',
    title: 'Kickoff Meeting',
    projectId: 'p-1',
    projectName: 'Sunrise Apartments',
    type: 'meeting',
    startDate: '2024-04-02',
    endDate: '2024-04-02',
    assignee: 'Admin User',
    description: 'Project kickoff with client and GC',
    location: 'Site Office',
  },
  {
    id: 'sch-2',
    title: 'Concrete Pour',
    projectId: 'p-2',
    projectName: 'Downtown Office',
    type: 'delivery',
    startDate: '2024-04-05',
    endDate: '2024-04-06',
    assignee: 'Project Manager',
    description: 'Coordinate concrete trucks and pump',
    location: 'Site B',
  },
];

const conversations = [
  {
    id: 'c-1',
    participant: { id: 'u-2', name: 'Project Manager', avatar: '' },
    lastMessage: 'Materials delivery confirmed for Friday',
    timestamp: '2024-03-01T10:30:00Z',
    unreadCount: 1,
  },
];

const conversationMessages = {
  'c-1': [
    { id: 'msg-1', sender: { id: 'u-1', name: 'Admin' }, content: 'Kickoff meeting at 9am tomorrow', timestamp: '2024-03-01T08:00:00Z', read: true },
    { id: 'msg-2', sender: { id: 'u-2', name: 'Project Manager' }, content: 'Materials delivery confirmed for Friday', timestamp: '2024-03-01T10:30:00Z', read: false },
  ],
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.ENV || 'dev' });
});

// Example route
app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

// Projects
app.get('/api/projects', (_req, res) => {
  if (!pool) {
    return res.json({ projects });
  }
  pool
    .query('SELECT * FROM projects ORDER BY created_at DESC')
    .then(result =>
      res.json({
        projects: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          type: row.type,
          status: row.status,
          address: row.address,
          city: row.city,
          state: row.state,
          zipCode: row.zip_code,
          startDate: row.start_date,
          endDate: row.end_date,
          estimatedBudget: Number(row.estimated_budget || 0),
          actualCost: Number(row.actual_cost || 0),
          progress: Number(row.progress || 0),
          ownerId: row.owner_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    )
    .catch(() => res.json({ projects }));
});

app.post('/api/projects', (req, res) => {
  const body = req.body || {};
  const project = {
    id: randomUUID(),
    name: body.name || 'Untitled Project',
    description: body.description || '',
    type: body.type || 'residential',
    status: 'IN_PROGRESS',
    address: body.address || '',
    city: body.city || '',
    state: body.state || '',
    zipCode: body.zipCode || '',
    startDate: body.startDate,
    endDate: body.endDate,
    estimatedBudget: body.estimatedBudget || 0,
    actualCost: body.actualCost || 0,
    progress: body.progress !== undefined ? Number(body.progress) || 0 : 0,
    ownerId: 'u-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!pool) {
    projects.push(project);
    return res.json({ project });
  }
  pool
    .query(
      `INSERT INTO projects
        (id, name, description, type, status, address, city, state, zip_code, start_date, end_date, estimated_budget, actual_cost, owner_id, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        project.id,
        project.name,
        project.description,
        project.type,
        project.status,
        project.address,
        project.city,
        project.state,
        project.zipCode,
        project.startDate,
        project.endDate,
        project.estimatedBudget,
        project.actualCost,
        project.ownerId,
        project.progress,
      ]
    )
    .then(result => res.json({ project: { ...project, ...result.rows[0] } }))
    .catch(() => res.json({ project }));
});

app.get('/api/projects/:id', (req, res) => {
  if (!pool) {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    return res.json({ project });
  }
  pool
    .query('SELECT * FROM projects WHERE id = $1', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({
        project: {
          id: row.id,
          name: row.name,
          description: row.description,
          type: row.type,
        status: row.status,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        startDate: row.start_date,
        endDate: row.end_date,
        estimatedBudget: Number(row.estimated_budget || 0),
        actualCost: Number(row.actual_cost || 0),
        progress: Number(row.progress || 0),
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
    })
    .catch(() => res.status(404).json({ message: 'Not found' }));
});

app.put('/api/projects/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ message: 'Not found' });
    Object.assign(project, {
      name: body.name ?? project.name,
      description: body.description ?? project.description,
      type: body.type ?? project.type,
      status: body.status ?? project.status,
      address: body.address ?? project.address,
      city: body.city ?? project.city,
      state: body.state ?? project.state,
      zipCode: body.zipCode ?? project.zipCode,
      startDate: body.startDate ?? project.startDate,
      endDate: body.endDate ?? project.endDate,
      estimatedBudget:
        body.estimatedBudget !== undefined ? Number(body.estimatedBudget) || 0 : project.estimatedBudget,
      actualCost: body.actualCost !== undefined ? Number(body.actualCost) || 0 : project.actualCost,
      progress: body.progress !== undefined ? Number(body.progress) || 0 : project.progress,
      updatedAt: new Date().toISOString(),
    });
    return res.json({ project });
  }
  pool
    .query('SELECT * FROM projects WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });

      const next = {
        name: body.name ?? current.name,
        description: body.description ?? current.description,
        type: body.type ?? current.type,
        status: body.status ?? current.status,
        address: body.address ?? current.address,
        city: body.city ?? current.city,
        state: body.state ?? current.state,
        zip_code: body.zipCode ?? current.zip_code,
        start_date: body.startDate ?? current.start_date,
        end_date: body.endDate ?? current.end_date,
        estimated_budget:
          body.estimatedBudget !== undefined ? Number(body.estimatedBudget) || 0 : current.estimated_budget,
        actual_cost: body.actualCost !== undefined ? Number(body.actualCost) || 0 : current.actual_cost,
        progress: body.progress !== undefined ? Number(body.progress) || 0 : current.progress,
      };

      return pool
        .query(
          `UPDATE projects SET
            name=$1, description=$2, type=$3, status=$4, address=$5, city=$6, state=$7, zip_code=$8,
            start_date=$9, end_date=$10, estimated_budget=$11, actual_cost=$12, progress=$13, updated_at=now()
           WHERE id=$14 RETURNING *`,
          [
            next.name,
            next.description,
            next.type,
            next.status,
            next.address,
            next.city,
            next.state,
            next.zip_code,
            next.start_date,
            next.end_date,
            next.estimated_budget,
            next.actual_cost,
            next.progress,
            req.params.id,
          ]
        )
        .then(updateResult => {
          const row = updateResult.rows[0];
          res.json({
            project: {
              id: row.id,
              name: row.name,
              description: row.description,
              type: row.type,
              status: row.status,
              address: row.address,
              city: row.city,
              state: row.state,
              zipCode: row.zip_code,
              startDate: row.start_date,
              endDate: row.end_date,
              estimatedBudget: Number(row.estimated_budget || 0),
              actualCost: Number(row.actual_cost || 0),
              progress: Number(row.progress || 0),
              ownerId: row.owner_id,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            },
          });
        });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.post('/api/projects/:id/tasks', async (req, res) => {
  const body = req.body || {};
  const task = {
    id: randomUUID(),
    projectId: req.params.id,
    title: body.title || 'Task',
    description: body.description || '',
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    assignedTo: body.assignedTo || '',
    dueDate: body.dueDate || '',
    projectName: body.projectName || '',
    createdBy: body.createdBy || 'System',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!pool) {
    projectTasks[req.params.id] = projectTasks[req.params.id] || [];
    projectTasks[req.params.id].push(task);
    // Global task list is derived from projectTasks in the /api/tasks handler, avoid double-inserting here.
    try {
      await maybeCreateExpenseForTask(
        {
          id: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          projectId: task.projectId,
          projectName: task.projectName,
        },
        body
      );
    } catch {}
    return res.json({ task });
  }
  pool
    .query(
      `INSERT INTO tasks (id, title, description, status, priority, assignee, project_id, project_name, due_date, completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assignedTo,
        task.projectId,
        task.projectName,
        task.dueDate || null,
        task.status === 'completed' || task.status === 'done',
      ]
    )
    .then(async result => {
      try {
        await maybeCreateExpenseForTask(
          {
            id: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            projectId: task.projectId,
            projectName: task.projectName,
          },
          body
        );
      } catch {}
      res.json({ task: { ...task, ...result.rows[0] } });
    })
    .catch(() => res.json({ task }));
});

app.put('/api/projects/:id/tasks/:taskId', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const bucket = (projectTasks[req.params.id] = projectTasks[req.params.id] || []);
    let task = bucket.find(t => t.id === req.params.taskId);
    if (!task) {
      task = {
        id: req.params.taskId,
        projectId: req.params.id,
        title: body.title || 'Task',
        description: body.description || '',
        status: body.status || 'todo',
        priority: body.priority || 'medium',
        assignedTo: body.assignedTo || '',
        dueDate: body.dueDate || '',
        createdBy: body.createdBy || 'System',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bucket.push(task);
    } else {
      task.title = body.title ?? task.title;
      task.description = body.description ?? task.description;
      task.status = body.status ?? task.status;
      task.priority = body.priority ?? task.priority;
      task.assignedTo = body.assignedTo ?? task.assignedTo;
      task.dueDate = body.dueDate ?? task.dueDate;
      task.updatedAt = new Date().toISOString();
    }
    // Keep global tasks list in sync so Tasks page reflects project updates immediately.
    const globalTask = tasks.find(t => t.id === task.id);
    if (globalTask) {
      globalTask.title = task.title;
      globalTask.description = task.description;
      globalTask.status = task.status;
      globalTask.priority = task.priority;
      globalTask.assignee = task.assignedTo || '';
      globalTask.projectId = task.projectId;
      globalTask.projectName = task.projectName || globalTask.projectName || '';
      globalTask.dueDate = task.dueDate;
      globalTask.completed = task.status === 'done' || task.status === 'completed';
    }
    return res.json({ task });
  }

  pool
    .query('SELECT * FROM tasks WHERE id = $1 AND project_id = $2', [req.params.taskId, req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      const next = {
        title: body.title ?? current.title,
        description: body.description ?? current.description,
        status: body.status ?? current.status,
        priority: body.priority ?? current.priority,
        assignee: body.assignedTo ?? current.assignee,
        due_date: body.dueDate ?? current.due_date,
        project_name: body.projectName ?? current.project_name,
      };
      return pool
        .query(
          `UPDATE tasks SET
            title=$1, description=$2, status=$3, priority=$4, assignee=$5, due_date=$6, project_name=$7, updated_at=now()
           WHERE id=$8 AND project_id=$9
           RETURNING *`,
          [
            next.title,
            next.description,
            next.status,
            next.priority,
            next.assignee,
            next.due_date,
            next.project_name,
            req.params.taskId,
            req.params.id,
          ]
        )
        .then(updateResult => {
          const row = updateResult.rows[0];
          if (!row) return res.status(404).json({ message: 'Not found' });
          res.json({
            task: {
              id: row.id,
              projectId: row.project_id,
              projectName: row.project_name,
              title: row.title,
              description: row.description,
              status: row.status,
              priority: row.priority,
              assignedTo: row.assignee,
              dueDate: row.due_date,
              createdBy: 'System',
              createdAt: row.created_at,
              updatedAt: row.updated_at,
            },
          });
        });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.post('/api/projects/:id/documents', (req, res) => {
  const body = req.body || {};
  const doc = {
    id: randomUUID(),
    projectId: req.params.id,
    name: body.name || 'Document',
    type: body.type || 'file',
    category: body.category || 'other',
    fileSize: body.fileSize || 0,
    mimeType: body.mimeType || '',
    uploadedBy: body.uploadedBy || 'System',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    url: body.url,
    key: body.key,
  };
  projectDocuments[req.params.id] = projectDocuments[req.params.id] || [];
  projectDocuments[req.params.id].push(doc);
  res.json({ document: doc });
});

app.delete('/api/projects/:id', async (req, res) => {
  const projectId = req.params.id;

  const deleteFromMemory = () => {
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      const [removed] = projects.splice(idx, 1);
      return removed;
    }
    return null;
  };

  if (!pool) {
    const removed = deleteFromMemory();
    if (!removed) return res.status(404).json({ message: 'Not found' });
    return res.json({ project: removed });
  }

  try {
    // Cascade-delete all associated data before removing the project
    const relatedTables = [
      'tasks',
      'proposals',
      'schedule_events',
      'daily_logs',
      'invoices',
      'expenses',
      'materials',
      'selections',
      'bids',
      'inspections',
      'equipment',
      'project_doc_pages',
    ];
    for (const table of relatedTables) {
      await pool.query(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
    }

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: 'Project not found' });

    return res.json({
      project: {
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        status: row.status,
        address: row.address,
        city: row.city,
        state: row.state,
        zipCode: row.zip_code,
        startDate: row.start_date,
        endDate: row.end_date,
        estimatedBudget: Number(row.estimated_budget || 0),
        actualCost: Number(row.actual_cost || 0),
        progress: Number(row.progress || 0),
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (err) {
    console.error('Project delete failed', err);
    return res.status(500).json({ message: 'Failed to delete project' });
  }
});

app.get('/api/projects/:id/tasks', (req, res) => {
  if (!pool) {
    const tasks = projectTasks[req.params.id] || [];
    return res.json({ tasks });
  }
  pool
    .query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
    .then(result =>
      res.json({
        tasks: result.rows.map(row => ({
          id: row.id,
          projectId: row.project_id,
          projectName: row.project_name,
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          assignedTo: row.assignee,
          dueDate: row.due_date,
          createdBy: 'System',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      })
    )
    .catch(() => {
      const tasks = projectTasks[req.params.id] || [];
      res.json({ tasks });
    });
});

app.get('/api/projects/:id/budget', (_req, res) => {
  res.json({ items: [], summary: { totalBudget: 0, totalSpent: 0, totalRemaining: 0, overBudgetItems: 0 } });
});

app.get('/api/projects/:id/documents', (_req, res) => {
  const docs = projectDocuments[_req.params.id] || [];
  res.json({ documents: docs });
});

// Leads
app.get('/api/leads', (_req, res) => {
  if (!pool) return res.json({ leads });
  pool
    .query('SELECT * FROM leads ORDER BY created_at DESC')
    .then(result =>
      res.json({
        leads: result.rows.map(row => ({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          status: row.status || 'new',
          source: row.source || '',
          estimatedValue: Number(row.estimated_value || 0),
          createdAt: row.created_at,
          notes: row.notes || '',
        })),
      })
    )
    .catch(() => res.json({ leads }));
});

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  const lead = {
    id: randomUUID(),
    firstName: body.firstName || 'First',
    lastName: body.lastName || 'Last',
    email: body.email || '',
    phone: body.phone || '',
    status: body.status || 'new',
    source: body.source || 'web',
    estimatedValue: body.estimatedValue || 0,
    createdAt: new Date().toISOString(),
    notes: body.notes || '',
  };
  if (!pool) {
    leads.push(lead);
    return res.json({ lead });
  }
  pool
    .query(
      `INSERT INTO leads
        (id, first_name, last_name, email, phone, status, source, estimated_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        lead.id,
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.status,
        lead.source,
        lead.estimatedValue,
        lead.notes,
      ]
    )
    .then(result => res.json({ lead: { ...lead, ...result.rows[0] } }))
    .catch(() => res.json({ lead }));
});

app.get('/api/leads/:id', (req, res) => {
  if (!pool) {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ message: 'Not found' });
    return res.json(lead);
  }
  pool
    .query('SELECT * FROM leads WHERE id = $1', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        source: row.source,
        estimatedValue: Number(row.estimated_value || 0),
        createdAt: row.created_at,
        notes: row.notes || '',
      });
    })
    .catch(() => res.status(404).json({ message: 'Not found' }));
});

app.get('/api/leads/:id/proposals', (_req, res) => {
  res.json([]);
});

app.put('/api/leads/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ message: 'Not found' });
    lead.firstName = body.firstName ?? lead.firstName;
    lead.lastName = body.lastName ?? lead.lastName;
    lead.email = body.email ?? lead.email;
    lead.phone = body.phone ?? lead.phone;
    lead.status = body.status ?? lead.status;
    lead.source = body.source ?? lead.source;
    lead.estimatedValue =
      body.estimatedValue !== undefined ? Number(body.estimatedValue) || 0 : lead.estimatedValue;
    lead.notes = body.notes ?? lead.notes;
    lead.updatedAt = new Date().toISOString();
    return res.json({ lead });
  }
  pool
    .query(
      `UPDATE leads
         SET first_name=$1, last_name=$2, email=$3, phone=$4, status=$5, source=$6, estimated_value=$7, notes=$8, updated_at=now()
       WHERE id=$9
       RETURNING *`,
      [
        body.firstName,
        body.lastName,
        body.email,
        body.phone,
        body.status,
        body.source,
        body.estimatedValue !== undefined ? Number(body.estimatedValue) || 0 : null,
        body.notes,
        req.params.id,
      ]
    )
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({
        lead: {
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          status: row.status,
          source: row.source,
          estimatedValue: Number(row.estimated_value || 0),
          createdAt: row.created_at,
          notes: row.notes || '',
        },
      });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/leads/:id', (req, res) => {
  if (!pool) {
    const idx = leads.findIndex(l => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = leads.splice(idx, 1);
    return res.json({ lead: removed });
  }
  pool
    .query('DELETE FROM leads WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ lead: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Tasks
function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function resolveProjectName({ projectId, projectName }) {
  if (projectName) return projectName;
  if (!projectId) return '';
  if (!pool) {
    const proj = (projects || []).find(p => p.id === projectId);
    return proj ? proj.name : '';
  }
  try {
    const result = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    return result.rows?.[0]?.name || '';
  } catch {
    return '';
  }
}

async function maybeCreateExpenseForTask(task, body) {
  const expenseInput = body.expense || {};
  const createExpense =
    body.createExpense === true ||
    expenseInput.create === true ||
    expenseInput.enabled === true;
  if (!createExpense) return null;

  const amount = parseMoney(expenseInput.amount ?? body.expenseAmount);
  const tax = parseMoney(expenseInput.tax ?? body.expenseTax);
  const total =
    expenseInput.total !== undefined || body.expenseTotal !== undefined
      ? parseMoney(expenseInput.total ?? body.expenseTotal)
      : amount + tax;

  if (total <= 0) return null;

  const projectId = expenseInput.projectId ?? body.projectId ?? task.projectId ?? '';
  const type = projectId ? 'project' : 'non-project';
  const projectName = await resolveProjectName({
    projectId,
    projectName: expenseInput.projectName ?? body.projectName ?? task.projectName,
  });

  const expense = {
    id: randomUUID(),
    taskId: task.id,
    title: expenseInput.title ?? `Task: ${task.title}`,
    type,
    category: expenseInput.category ?? body.expenseCategory ?? 'Labor',
    vendor: expenseInput.vendor ?? body.expenseVendor ?? '',
    amount,
    tax,
    total,
    status: expenseInput.status ?? body.expenseStatus ?? 'pending',
    paymentMethod: expenseInput.paymentMethod ?? body.expensePaymentMethod ?? 'credit_card',
    date: expenseInput.date ?? body.expenseDate ?? task.dueDate ?? null,
    dueDate: expenseInput.dueDate ?? body.expenseDueDate ?? null,
    projectId,
    projectName,
    notes: expenseInput.notes ?? body.expenseNotes ?? task.description ?? '',
    receiptUrl: expenseInput.receiptUrl ?? '',
    receiptName: expenseInput.receiptName ?? '',
    receiptType: expenseInput.receiptType ?? '',
  };

  if (!pool) {
    expenses.unshift(expense);
    return expense;
  }

  try {
    await pool.query(
      `INSERT INTO expenses (id, task_id, title, type, category, vendor, amount, tax, total, status, payment_method, date, due_date, project_id, project_name, notes, receipt_url, receipt_name, receipt_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        expense.id,
        expense.taskId,
        expense.title,
        expense.type,
        expense.category,
        expense.vendor,
        expense.amount,
        expense.tax,
        expense.total,
        expense.status,
        expense.paymentMethod,
        expense.date || null,
        expense.dueDate || null,
        expense.projectId,
        expense.projectName,
        expense.notes,
        expense.receiptUrl,
        expense.receiptName,
        expense.receiptType,
      ]
    );
    return expense;
  } catch {
    return null;
  }
}

app.get('/api/tasks', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    // Flatten project-specific tasks into the global view so all tasks appear here, de-duped by id
    const merged = [];
    const seen = new Set();
    const pushUnique = (t) => {
      if (seen.has(t.id)) return;
      seen.add(t.id);
      merged.push(t);
    };
    tasks.forEach(pushUnique);
    Object.entries(projectTasks).forEach(([pid, taskList]) => {
      (taskList || []).forEach(t =>
        pushUnique({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          assignee: t.assignedTo || '',
          projectId: pid,
          projectName: t.projectName || '',
          dueDate: t.dueDate || '',
          completed: t.status === 'done' || t.status === 'completed',
        })
      );
    });
    return res.json({ tasks: merged });
  }

  const clauses = [];
  const values = [];
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (search) {
    clauses.push(`(LOWER(title) LIKE $${clauses.length + 1} OR LOWER(description) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`, values)
    .then(result =>
      res.json({
        tasks: result.rows.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          status: row.status,
          priority: row.priority,
          assignee: row.assignee,
          projectId: row.project_id,
          projectName: row.project_name,
          dueDate: row.due_date,
          completed: !!row.completed,
        })),
      })
    )
    .catch(() => res.json({ tasks: [] }));
});

app.post('/api/tasks', async (req, res) => {
  const body = req.body || {};
  const task = {
    id: randomUUID(),
    title: body.title || 'Untitled',
    description: body.description || '',
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    assignee: body.assignee || '',
    projectName: body.projectName || '',
    projectId: body.projectId,
    dueDate: body.dueDate || '',
    completed: !!body.completed,
  };

  if (!pool) {
    tasks.push(task);
    if (task.projectId) {
      const bucket = (projectTasks[task.projectId] = projectTasks[task.projectId] || []);
      bucket.push({
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignee,
        dueDate: task.dueDate,
        projectName: task.projectName,
        createdBy: 'System',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    try {
      await maybeCreateExpenseForTask(task, body);
    } catch {}
    return res.json(task);
  }

  pool
    .query(
      `INSERT INTO tasks (id, title, description, status, priority, assignee, project_id, project_name, due_date, completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        task.id,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.assignee,
        task.projectId,
        task.projectName,
        task.dueDate || null,
        task.completed,
      ]
    )
    .then(async result => {
      const row = result.rows[0];
      const savedTask = { ...task, ...row };
      try { await maybeCreateExpenseForTask(task, body); } catch {}
      try { await syncTaskToSchedule(savedTask); } catch {}
      res.json({ task: savedTask });
    })
    .catch(() => res.json({ task }));
});

app.patch('/api/tasks/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    let task = tasks.find(t => t.id === req.params.id);
    if (task) {
      if (body.completed !== undefined) task.completed = !!body.completed;
      if (body.status) task.status = body.status;
      if (body.title) task.title = body.title;
      if (body.description) task.description = body.description;
      if (body.priority) task.priority = body.priority;
      if (body.assignee) task.assignee = body.assignee;
      if (body.projectName) task.projectName = body.projectName;
      if (body.projectId) task.projectId = body.projectId;
      if (body.dueDate) task.dueDate = body.dueDate;
    }

    Object.values(projectTasks).forEach(list => {
      const t = list.find(x => x.id === req.params.id);
      if (t) {
        if (!task) {
          task = {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            assignee: t.assignedTo || '',
            projectId: t.projectId,
            projectName: t.projectName || '',
            dueDate: t.dueDate,
            completed: t.status === 'done' || t.status === 'completed',
          };
          tasks.push(task);
        }
        if (body.completed !== undefined) t.status = body.completed ? 'done' : t.status || 'todo';
        if (body.status) t.status = body.status;
        if (body.title) t.title = body.title;
        if (body.description) t.description = body.description;
        if (body.priority) t.priority = body.priority;
        if (body.assignee) t.assignedTo = body.assignee;
        if (body.projectName) t.projectName = body.projectName;
        if (body.projectId) t.projectId = body.projectId;
        if (body.dueDate) t.dueDate = body.dueDate;
      }
    });

    if (!task) return res.status(404).json({ message: 'Not found' });
    return res.json({ task });
  }

  pool
    .query(
      `UPDATE tasks SET
        completed=COALESCE($1, completed),
        status=COALESCE($2, status),
        title=COALESCE($3, title),
        description=COALESCE($4, description),
        priority=COALESCE($5, priority),
        assignee=COALESCE($6, assignee),
        project_id=COALESCE($7, project_id),
        project_name=COALESCE($8, project_name),
       due_date=COALESCE($9, due_date),
       updated_at=now()
      WHERE id=$10
      RETURNING *`,
      [
        body.completed,
        body.status,
        body.title,
        body.description,
        body.priority,
        body.assignee,
        body.projectId,
        body.projectName,
        body.dueDate,
        req.params.id,
      ]
    )
    .then(async result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      const updatedTask = {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        projectId: row.project_id,
        projectName: row.project_name,
        dueDate: row.due_date,
        completed: !!row.completed,
      };
      try { await syncTaskToSchedule(updatedTask); } catch {}
      res.json({ task: updatedTask });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/tasks/:id', (req, res) => {
  if (!pool) {
    const idx = tasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = tasks.splice(idx, 1);
    Object.keys(projectTasks).forEach(pid => {
      projectTasks[pid] = (projectTasks[pid] || []).filter(t => t.id !== req.params.id);
    });
    return res.json({ task: removed });
  }

  pool
    .query('DELETE FROM tasks WHERE id = $1 RETURNING *', [req.params.id])
    .then(async result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      try { await pool.query('DELETE FROM schedule_events WHERE task_id = $1', [req.params.id]); } catch {}
      res.json({ task: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Contacts
app.get('/api/contacts', (req, res) => {
  const { search } = req.query;
  if (!pool) {
    let list = [...contacts];
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => (a.favorite === b.favorite ? (a.name || '').localeCompare(b.name || '') : a.favorite ? -1 : 1));
    return res.json({ contacts: list });
  }

  const clauses = [];
  const values = [];
  if (search) {
    clauses.push(`(LOWER(name) LIKE $${clauses.length + 1} OR LOWER(email) LIKE $${clauses.length + 1} OR LOWER(company) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM contacts ${where} ORDER BY favorite DESC, name ASC`, values)
    .then(result =>
      res.json({
        contacts: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          company: row.company,
          officeNumber: row.office_number,
          address: row.address,
          designation: row.designation,
          favorite: !!row.favorite,
          createdAt: row.created_at,
        })),
      })
    )
    .catch(() => res.json({ contacts }));
});

app.post('/api/contacts', (req, res) => {
  const body = req.body || {};
  const contact = {
    id: randomUUID(),
    name: body.name || 'Untitled',
    phone: body.phone,
    email: body.email,
    company: body.company,
    officeNumber: body.officeNumber,
    address: body.address,
    designation: body.designation,
    favorite: !!body.favorite,
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    contacts.unshift(contact);
    return res.json({ contact });
  }
  pool
    .query(
      `INSERT INTO contacts (id, name, phone, email, company, office_number, address, designation, favorite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [contact.id, contact.name, contact.phone, contact.email, contact.company, contact.officeNumber, contact.address, contact.designation, contact.favorite]
    )
    .then(result => res.json({ contact: result.rows[0] }))
    .catch(() => res.json({ contact }));
});

app.put('/api/contacts/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const contact = contacts.find(c => c.id === req.params.id);
    if (!contact) return res.status(404).json({ message: 'Not found' });
    Object.assign(contact, {
      name: body.name ?? contact.name,
      phone: body.phone ?? contact.phone,
      email: body.email ?? contact.email,
      company: body.company ?? contact.company,
      officeNumber: body.officeNumber ?? contact.officeNumber,
      address: body.address ?? contact.address,
      designation: body.designation ?? contact.designation,
      favorite: body.favorite ?? contact.favorite,
    });
    return res.json({ contact });
  }
  pool
    .query(`UPDATE contacts SET
              name=COALESCE($1,name),
              phone=COALESCE($2,phone),
              email=COALESCE($3,email),
              company=COALESCE($4,company),
              office_number=COALESCE($5,office_number),
              address=COALESCE($6,address),
              designation=COALESCE($7,designation),
              favorite=COALESCE($8,favorite),
              created_at=created_at
            WHERE id=$9
            RETURNING *`,
      [body.name, body.phone, body.email, body.company, body.officeNumber, body.address, body.designation, body.favorite, req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ contact: row });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/contacts/:id', (req, res) => {
  if (!pool) {
    const idx = contacts.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = contacts.splice(idx, 1);
    return res.json({ contact: removed });
  }
  pool
    .query('DELETE FROM contacts WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ contact: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Users
app.get('/api/users', (req, res) => {
  const { search } = req.query;
  if (!pool) {
    let list = [...users];
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    }
    return res.json(list);
  }
  const clauses = [];
  const values = [];
  if (search) {
    clauses.push(`(LOWER(first_name || ' ' || last_name) LIKE $1 OR LOWER(email) LIKE $1 OR LOWER(role) LIKE $1)`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM app_users ${where} ORDER BY created_at DESC`, values)
    .then(result =>
      res.json(
        result.rows.map(row => ({
          id: row.id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          role: row.role,
          phone: row.phone || '',
          status: row.status || 'active',
          avatar: row.avatar || null,
          createdAt: row.created_at,
        }))
      )
    )
    .catch(() => res.json(users));
});

app.post('/api/users', (req, res) => {
  const body = req.body || {};
  const user = {
    id: randomUUID(),
    firstName: body.firstName || 'First',
    lastName: body.lastName || 'Last',
    email: body.email || '',
    role: body.role || 'contractor',
    phone: body.phone || '',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    users.push(user);
    return res.json(user);
  }
  pool
    .query(
      `INSERT INTO app_users (id, first_name, last_name, email, role, phone, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user.id, user.firstName, user.lastName, user.email, user.role, user.phone, user.status]
    )
    .then(result => {
      const row = result.rows[0];
      res.json({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        role: row.role,
        phone: row.phone || '',
        status: row.status,
        createdAt: row.created_at,
      });
    })
    .catch(() => {
      users.push(user);
      res.json(user);
    });
});

app.delete('/api/users/:id', (req, res) => {
  if (!pool) {
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = users.splice(idx, 1);
    return res.json({ user: removed });
  }
  pool
    .query('DELETE FROM app_users WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      if (!result.rows[0]) return res.status(404).json({ message: 'Not found' });
      res.json({ user: result.rows[0] });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Analytics — derive from real DB data
app.get('/api/analytics', async (req, res) => {
  if (!pool) {
    return res.json({
      revenue: { total: 2500000, change: 12, data: [{ month: 'Jan', amount: 300000 }, { month: 'Feb', amount: 320000 }] },
      projects: { total: projects.length, active: projects.filter(p => p.status === 'IN_PROGRESS').length, completed: projects.filter(p => p.status === 'COMPLETED').length, data: [] },
      efficiency: { onTime: 92, delayed: 1, avgDuration: 120 },
      costs: { data: [{ category: 'Labor', amount: 120000 }, { category: 'Materials', amount: 95000 }] },
    });
  }
  try {
    const [projResult, expResult, matResult, invResult] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int as count, COALESCE(SUM(estimated_budget),0)::float as budget, COALESCE(SUM(actual_cost),0)::float as spent FROM projects GROUP BY status`),
      pool.query(`SELECT COALESCE(SUM(total),0)::float as total FROM expenses`),
      pool.query(`SELECT COALESCE(SUM(total_cost),0)::float as total FROM materials`),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float as total FROM invoices WHERE status='paid'`),
    ]);
    const projRows = projResult.rows;
    const totalProjects = projRows.reduce((s, r) => s + r.count, 0);
    const activeProjects = projRows.filter(r => ['IN_PROGRESS','in_progress','active'].includes((r.status||'').toLowerCase())).reduce((s, r) => s + r.count, 0);
    const completedProjects = projRows.filter(r => ['COMPLETED','completed'].includes((r.status||'').toLowerCase())).reduce((s, r) => s + r.count, 0);
    const totalRevenue = invResult.rows[0]?.total || 0;
    const expenseTotal = expResult.rows[0]?.total || 0;
    const materialTotal = matResult.rows[0]?.total || 0;
    res.json({
      revenue: { total: totalRevenue, change: 0, data: [] },
      projects: { total: totalProjects, active: activeProjects, completed: completedProjects, data: projRows.map(r => ({ status: r.status, count: r.count })) },
      efficiency: { onTime: 92, delayed: totalProjects - completedProjects, avgDuration: 120 },
      costs: { data: [{ category: 'Expenses', amount: expenseTotal }, { category: 'Materials', amount: materialTotal }] },
    });
  } catch {
    res.json({
      revenue: { total: 0, change: 0, data: [] },
      projects: { total: 0, active: 0, completed: 0, data: [] },
      efficiency: { onTime: 0, delayed: 0, avgDuration: 0 },
      costs: { data: [] },
    });
  }
});

// Budget — derive from real project + expense + material data
app.get('/api/budget/summary', async (req, res) => {
  const { project } = req.query;
  if (!pool) {
    const filteredProjects = project ? projects.filter(p => p.id === project) : projects;
    const totalBudget = filteredProjects.reduce((s, p) => s + (p.estimatedBudget || 0), 0);
    const totalSpent = filteredProjects.reduce((s, p) => s + (p.actualCost || 0), 0);
    return res.json({ totalBudget, totalSpent, totalRemaining: totalBudget - totalSpent, overBudgetItems: filteredProjects.filter(p => (p.actualCost||0) > (p.estimatedBudget||0)).length });
  }
  try {
    const projectClause = project ? `WHERE id = $1` : '';
    const projectValues = project ? [project] : [];
    const projResult = await pool.query(
      `SELECT COALESCE(SUM(estimated_budget),0)::float as budget, COALESCE(SUM(actual_cost),0)::float as spent, COUNT(CASE WHEN actual_cost > estimated_budget THEN 1 END)::int as over_count FROM projects ${projectClause}`,
      projectValues
    );
    const row = projResult.rows[0];
    const totalBudget = row.budget || 0;
    const totalSpent = row.spent || 0;
    res.json({ totalBudget, totalSpent, totalRemaining: totalBudget - totalSpent, overBudgetItems: row.over_count || 0 });
  } catch {
    res.json({ totalBudget: 0, totalSpent: 0, totalRemaining: 0, overBudgetItems: 0 });
  }
});

app.get('/api/budget/items', async (req, res) => {
  const { project } = req.query;
  if (!pool) {
    const filteredProjects = project ? projects.filter(p => p.id === project) : projects;
    return res.json(filteredProjects.map(p => ({
      id: p.id,
      category: p.name,
      budgeted: p.estimatedBudget || 0,
      actual: p.actualCost || 0,
      variance: (p.estimatedBudget || 0) - (p.actualCost || 0),
      percentage: p.estimatedBudget ? Math.round(((p.actualCost || 0) / p.estimatedBudget) * 100) : 0,
    })));
  }
  try {
    const clause = project ? `WHERE id = $1` : '';
    const values = project ? [project] : [];
    const result = await pool.query(
      `SELECT id, name, estimated_budget, actual_cost FROM projects ${clause} ORDER BY name`,
      values
    );
    res.json(result.rows.map(row => ({
      id: row.id,
      category: row.name,
      budgeted: parseFloat(row.estimated_budget) || 0,
      actual: parseFloat(row.actual_cost) || 0,
      variance: (parseFloat(row.estimated_budget) || 0) - (parseFloat(row.actual_cost) || 0),
      percentage: row.estimated_budget ? Math.round((parseFloat(row.actual_cost) / parseFloat(row.estimated_budget)) * 100) : 0,
    })));
  } catch {
    res.json([]);
  }
});

// Materials
app.get('/api/materials', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...materials];
    if (projectId) list = list.filter(m => m.projectId === projectId);
    if (status) list = list.filter(m => m.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        m =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          (m.projectName || '').toLowerCase().includes(q) ||
          (m.supplier || '').toLowerCase().includes(q)
      );
    }
    return res.json({ materials: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(
      `(LOWER(name) LIKE $${clauses.length + 1} OR LOWER(description) LIKE $${clauses.length + 1} OR LOWER(supplier) LIKE $${clauses.length + 1} OR LOWER(project_name) LIKE $${clauses.length + 1})`
    );
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM materials ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({ materials: result.rows }))
    .catch(() => res.json({ materials }));
});

app.post('/api/materials', (req, res) => {
  const body = req.body || {};
  const quantity = parseFloat(body.quantity) || 0;
  const costPerUnit = parseFloat(body.costPerUnit) || 0;
  const material = {
    id: randomUUID(),
    name: body.name || 'Material',
    description: body.description || '',
    quantity,
    unit: body.unit || '',
    costPerUnit,
    totalCost: quantity * costPerUnit,
    supplier: body.supplier || '',
    projectName: body.projectName || '',
    projectId: body.projectId || '',
    status: body.status || 'in-stock',
  };
  if (!pool) {
    materials.push(material);
    return res.json(material);
  }
  pool
    .query(
      `INSERT INTO materials (id, name, description, quantity, unit, cost_per_unit, total_cost, supplier, project_name, project_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        material.id,
        material.name,
        material.description,
        material.quantity,
        material.unit,
        material.costPerUnit,
        material.totalCost,
        material.supplier,
        material.projectName,
        material.projectId,
        material.status,
      ]
    )
    .then(result => res.json(result.rows[0]))
    .catch(() => res.json(material));
});

app.put('/api/materials/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const material = materials.find(m => m.id === req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });
    const nextQuantity = body.quantity !== undefined ? parseFloat(body.quantity) || 0 : material.quantity;
    const nextCostPerUnit = body.costPerUnit !== undefined ? parseFloat(body.costPerUnit) || 0 : material.costPerUnit;
    Object.assign(material, {
      name: body.name ?? material.name,
      description: body.description ?? material.description,
      quantity: nextQuantity,
      unit: body.unit ?? material.unit,
      costPerUnit: nextCostPerUnit,
      totalCost: nextQuantity * nextCostPerUnit,
      supplier: body.supplier ?? material.supplier,
      projectName: body.projectName ?? material.projectName,
      projectId: body.projectId ?? material.projectId,
      status: body.status ?? material.status,
    });
    return res.json({ material });
  }

  pool
    .query('SELECT * FROM materials WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      const nextQuantity = body.quantity !== undefined ? parseFloat(body.quantity) || 0 : current.quantity;
      const nextCostPerUnit = body.costPerUnit !== undefined ? parseFloat(body.costPerUnit) || 0 : current.cost_per_unit;
      const totalCost = nextQuantity * nextCostPerUnit;
      return pool
        .query(
          `UPDATE materials SET
             name=$1, description=$2, quantity=$3, unit=$4, cost_per_unit=$5, total_cost=$6, supplier=$7, project_name=$8, project_id=$9, status=$10
           WHERE id=$11
           RETURNING *`,
          [
            body.name ?? current.name,
            body.description ?? current.description,
            nextQuantity,
            body.unit ?? current.unit,
            nextCostPerUnit,
            totalCost,
            body.supplier ?? current.supplier,
            body.projectName ?? current.project_name,
            body.projectId ?? current.project_id,
            body.status ?? current.status,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ material: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/materials/:id', (req, res) => {
  if (!pool) {
    const idx = materials.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = materials.splice(idx, 1);
    return res.json({ material: removed });
  }
  pool
    .query('DELETE FROM materials WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ material: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Selections
app.get('/api/selections', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...selections];
    if (projectId) list = list.filter(s => s.projectId === projectId);
    if (status) list = list.filter(s => s.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        s =>
          s.category.toLowerCase().includes(q) ||
          s.item.toLowerCase().includes(q) ||
          (s.projectName || '').toLowerCase().includes(q) ||
          (s.clientName || '').toLowerCase().includes(q)
      );
    }
    return res.json({ selections: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(
      `(LOWER(category) LIKE $${clauses.length + 1} OR LOWER(item) LIKE $${clauses.length + 1} OR LOWER(description) LIKE $${clauses.length + 1} OR LOWER(client_name) LIKE $${clauses.length + 1} OR LOWER(project_name) LIKE $${clauses.length + 1})`
    );
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM selections ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({ selections: result.rows }))
    .catch(() => res.json({ selections }));
});

app.post('/api/selections', (req, res) => {
  const body = req.body || {};
  const selection = {
    id: randomUUID(),
    category: body.category || '',
    item: body.item || '',
    description: body.description || '',
    choice: body.choice || '',
    cost: parseFloat(body.cost) || 0,
    status: body.status || 'pending',
    projectName: body.projectName || '',
    projectId: body.projectId || '',
    clientName: body.clientName || '',
    dueDate: body.dueDate || null,
  };
  if (!pool) {
    selections.unshift(selection);
    return res.json({ selection });
  }
  pool
    .query(
      `INSERT INTO selections (id, category, item, description, choice, cost, status, project_name, project_id, client_name, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        selection.id,
        selection.category,
        selection.item,
        selection.description,
        selection.choice,
        selection.cost,
        selection.status,
        selection.projectName,
        selection.projectId,
        selection.clientName,
        selection.dueDate,
      ]
    )
    .then(result => res.json({ selection: result.rows[0] }))
    .catch(() => res.json({ selection }));
});

app.put('/api/selections/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const selection = selections.find(s => s.id === req.params.id);
    if (!selection) return res.status(404).json({ message: 'Not found' });
    Object.assign(selection, {
      category: body.category ?? selection.category,
      item: body.item ?? selection.item,
      description: body.description ?? selection.description,
      choice: body.choice ?? selection.choice,
      cost: body.cost !== undefined ? parseFloat(body.cost) || 0 : selection.cost,
      status: body.status ?? selection.status,
      projectName: body.projectName ?? selection.projectName,
      projectId: body.projectId ?? selection.projectId,
      clientName: body.clientName ?? selection.clientName,
      dueDate: body.dueDate ?? selection.dueDate,
    });
    return res.json({ selection });
  }

  pool
    .query('SELECT * FROM selections WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE selections SET
             category=$1, item=$2, description=$3, choice=$4, cost=$5, status=$6, project_name=$7, project_id=$8, client_name=$9, due_date=$10
           WHERE id=$11
           RETURNING *`,
          [
            body.category ?? current.category,
            body.item ?? current.item,
            body.description ?? current.description,
            body.choice ?? current.choice,
            body.cost !== undefined ? parseFloat(body.cost) || 0 : current.cost,
            body.status ?? current.status,
            body.projectName ?? current.project_name,
            body.projectId ?? current.project_id,
            body.clientName ?? current.client_name,
            body.dueDate ?? current.due_date,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ selection: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/selections/:id', (req, res) => {
  if (!pool) {
    const idx = selections.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = selections.splice(idx, 1);
    return res.json({ selection: removed });
  }

  pool
    .query('DELETE FROM selections WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ selection: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Daily Logs
app.get('/api/daily-logs', (req, res) => {
  const { projectId, projectName } = req.query;
  if (!pool) {
    let list = [...dailyLogs];
    if (projectId) list = list.filter(l => l.projectId === projectId);
    if (projectName) list = list.filter(l => l.projectName === projectName);
    return res.json({ logs: list });
  }
  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (projectName) {
    clauses.push(`project_name = $${clauses.length + 1}`);
    values.push(projectName);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM daily_logs ${where} ORDER BY date DESC NULLS LAST, created_at DESC`, values)
    .then(result =>
      res.json({
        logs: result.rows.map(r => ({
          id: r.id,
          projectId: r.project_id,
          projectName: r.project_name,
          date: r.date,
          weather: r.weather,
          temperature: r.temperature,
          workPerformed: r.work_performed,
          crewSize: r.crew_size,
          hoursWorked: Number(r.hours_worked || 0),
          equipmentUsed: r.equipment_used,
          materialsReceived: r.materials_received,
          notes: r.notes,
          photos: r.photos,
          createdBy: r.created_by,
        })),
      })
    )
    .catch(() => res.json({ logs: dailyLogs }));
});

app.post('/api/daily-logs', (req, res) => {
  const body = req.body || {};
  const log = {
    id: randomUUID(),
    projectId: body.projectId || '',
    projectName:
      body.projectName ||
      projects.find(p => p.id === body.projectId)?.name ||
      '',
    date: body.date || new Date().toISOString().split('T')[0],
    weather: body.weather || '',
    temperature: body.temperature || '',
    workPerformed: body.workPerformed || '',
    crewSize: parseInt(body.crewSize) || 0,
    hoursWorked: parseFloat(body.hoursWorked) || 0,
    equipmentUsed: body.equipmentUsed || '',
    materialsReceived: body.materialsReceived || '',
    notes: body.notes || '',
    photos: body.photos || 0,
    createdBy: body.createdBy || 'System',
  };
  if (!pool) {
    dailyLogs.push(log);
    return res.json(log);
  }
  pool
    .query(
      `INSERT INTO daily_logs (id, project_id, project_name, date, weather, temperature, work_performed, crew_size, hours_worked, equipment_used, materials_received, notes, photos, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        log.id,
        log.projectId,
        log.projectName,
        log.date || null,
        log.weather,
        log.temperature,
        log.workPerformed,
        log.crewSize,
        log.hoursWorked,
        log.equipmentUsed,
        log.materialsReceived,
        log.notes,
        log.photos,
        log.createdBy,
      ]
    )
    .then(result => res.json(result.rows[0]))
    .catch(() => res.json(log));
});

app.delete('/api/daily-logs/:id', (req, res) => {
  const { id } = req.params;
  if (!pool) return res.json({ success: true });
  pool
    .query('DELETE FROM daily_logs WHERE id = $1', [id])
    .then(() => res.json({ success: true }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Documents
const listDocuments = async (req, res) => {
  const { search, category, projectId, folder } = req.query;
  const prefixProject = projectId ? String(projectId) : '';
  const prefixFolder = folder ? String(folder).replace(/^\//, '') : '';
  const prefix = prefixProject ? `documents/${prefixProject}/${prefixFolder}` : 'documents/';

  const extToCategory = (key = '') => {
    const ext = key.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return 'plans';
    if (['doc', 'docx'].includes(ext)) return 'contract';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'photo';
    return 'other';
  };

  const signedUrlFor = (key) =>
    getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: FILES_BUCKET,
        Key: key,
      }),
      { expiresIn: 60 * 60 * 24 * 7 } // 7 days
    );

  const toDoc = (obj, signedUrl) => {
    const parts = (obj.Key || '').split('/');
    const projId = parts.length > 1 ? parts[1] : undefined;
    const projName = projects.find(p => p.id === projId)?.name || '';
    return {
      id: obj.Key,
      name: obj.Key?.split('/').pop() || 'File',
      type: obj.Key?.split('.').pop() || 'file',
      category: extToCategory(obj.Key),
      size: `${Math.max(1, Math.round((obj.Size || 0) / 1024))} KB`,
      projectId: projId,
      projectName: projName,
      uploadedBy: 'S3',
      uploadedAt: obj.LastModified || new Date().toISOString(),
      url: signedUrl || `https://${FILES_BUCKET}.s3.${REGION}.amazonaws.com/${obj.Key}`,
      key: obj.Key,
    };
  };

  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: FILES_BUCKET,
        Prefix: prefix,
      })
    );

    const objects = (data.Contents || []).filter(item => item.Key && !item.Key.endsWith('/'));
    const signedMap = await Promise.all(
      objects.map(async obj => [obj.Key, await signedUrlFor(obj.Key)])
    );
    const signedLookup = Object.fromEntries(signedMap);

    let list = objects.map(obj => toDoc(obj, signedLookup[obj.Key]));

    // Merge in-memory docs so seeded items still display
    let memoryDocs = [...documents];
    if (projectId) memoryDocs = memoryDocs.filter(d => d.projectId === projectId);
    list = [...list, ...memoryDocs];

    if (projectId) list = list.filter(d => d.projectId === projectId);
    if (category) list = list.filter(d => d.category === category);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        d =>
          (d.name || '').toLowerCase().includes(q) ||
          (d.projectName || '').toLowerCase().includes(q) ||
          (d.category || '').toLowerCase().includes(q)
      );
    }
    res.json({ documents: list });
  } catch (err) {
    // fallback to in-memory only
    let list = [...documents];
    if (projectId) list = list.filter(d => d.projectId === projectId);
    if (category) list = list.filter(d => d.category === category);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        d =>
          d.name.toLowerCase().includes(q) ||
          (d.projectName || '').toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }
    res.json({ documents: list });
  }
};

const createDocument = (req, res) => {
  const body = req.body || {};
  const doc = {
    id: body.id || randomUUID(),
    name: body.name || 'Document',
    type: body.type || 'pdf',
    category: body.category || 'other',
    size: body.size || 'N/A',
    projectName: body.projectName || '',
    projectId: body.projectId,
    uploadedBy: body.uploadedBy || 'System',
    uploadedAt: new Date().toISOString(),
    url: body.url || '#',
    key: body.key,
  };
  documents.push(doc);
  res.json({ document: doc });
};

const deleteDocument = (req, res) => {
  const keyParam = req.query.key || (req.body && req.body.key) || req.params.id;
  const idx = documents.findIndex(d => d.id === keyParam);
  if (idx !== -1) {
    const [removed] = documents.splice(idx, 1);
    if (removed.key) {
      s3
        .send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: removed.key }))
        .catch(() => null);
    }
    return res.json({ document: removed });
  }

  if (!keyParam) return res.status(404).json({ message: 'Not found' });

  s3
    .send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: keyParam }))
    .then(() => res.json({ document: { id: keyParam } }))
    .catch(() => res.status(404).json({ message: 'Not found' }));
};

app.get('/api/documents', listDocuments);
app.get('/documents', listDocuments);

app.post('/api/documents', createDocument);
app.post('/documents', createDocument);

app.delete('/api/documents', deleteDocument);
app.delete('/api/documents/:id', deleteDocument);
app.delete('/documents', deleteDocument);
app.delete('/documents/:id', deleteDocument);

const handleDocumentUpload = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });
  const projectId = req.body.projectId || 'global';
  const folder = (req.body.folder || '').replace(/^\//, '');
  const basePrefix = `documents/${projectId}/${folder}`;
  const key = `${basePrefix}/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: FILES_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: FILES_BUCKET,
        Key: key,
      }),
      { expiresIn: 60 * 60 * 24 * 7 }
    );
    res.json({
      key,
      url,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('S3 upload failed', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// document upload routes are registered below in the OneDrive section

// Project doc pages (lightweight wiki/notes per project)
const mapDocPage = (row) => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  content: row.content,
  images: Array.isArray(row.images) ? row.images : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

app.get('/api/projects/:id/doc-pages', (req, res) => {
  if (!pool) {
    const pages = projectDocPages[req.params.id] || [];
    return res.json({ pages });
  }
  pool
    .query('SELECT * FROM project_doc_pages WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
    .then(result => res.json({ pages: result.rows.map(mapDocPage) }))
    .catch(err => {
      console.error('doc-pages GET failed', err);
      res.status(500).json({ message: 'Failed to load pages' });
    });
});

app.post('/api/projects/:id/doc-pages', (req, res) => {
  const body = req.body || {};
  const page = {
    id: randomUUID(),
    projectId: req.params.id,
    title: body.title || 'Untitled Page',
    content: body.content || '',
    images: Array.isArray(body.images) ? body.images : [],
  };
  if (!pool) {
    projectDocPages[req.params.id] = projectDocPages[req.params.id] || [];
    projectDocPages[req.params.id].unshift({ ...page, updatedAt: new Date().toISOString() });
    return res.json({ page });
  }
  pool
    .query(
      `INSERT INTO project_doc_pages (id, project_id, title, content, images)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [page.id, page.projectId, page.title, page.content, JSON.stringify(page.images)]
    )
    .then(result => res.json({ page: mapDocPage(result.rows[0]) }))
    .catch(err => {
      console.error('doc-pages POST failed', err);
      res.status(500).json({ message: 'Failed to create page' });
    });
});

app.put('/api/projects/:id/doc-pages/:pageId', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const pages = projectDocPages[req.params.id] || [];
    const page = pages.find(p => p.id === req.params.pageId);
    if (!page) return res.status(404).json({ message: 'Not found' });
    page.title = body.title ?? page.title;
    page.content = body.content ?? page.content;
    page.images = Array.isArray(body.images) ? body.images : page.images;
    page.updatedAt = new Date().toISOString();
    return res.json({ page });
  }
  const fields = [];
  const values = [];
  if (body.title !== undefined) { fields.push(`title = $${fields.length + 1}`); values.push(body.title); }
  if (body.content !== undefined) { fields.push(`content = $${fields.length + 1}`); values.push(body.content || ''); }
  if (Array.isArray(body.images)) {
    fields.push(`images = $${fields.length + 1}::jsonb`);
    values.push(JSON.stringify(body.images));
  }
  fields.push(`updated_at = now()`);
  values.push(req.params.pageId, req.params.id);
  pool
    .query(
      `UPDATE project_doc_pages SET ${fields.join(', ')}
       WHERE id = $${values.length - 1} AND project_id = $${values.length}
       RETURNING *`,
      values
    )
    .then(result => {
      if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ page: mapDocPage(result.rows[0]) });
    })
    .catch(err => {
      console.error('doc-pages PUT failed', err);
      res.status(500).json({ message: 'Failed to update page' });
    });
});

app.delete('/api/projects/:id/doc-pages/:pageId', (req, res) => {
  if (!pool) {
    const pages = projectDocPages[req.params.id] || [];
    const idx = pages.findIndex(p => p.id === req.params.pageId);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = pages.splice(idx, 1);
    return res.json({ page: removed });
  }
  pool
    .query(
      'DELETE FROM project_doc_pages WHERE id = $1 AND project_id = $2 RETURNING *',
      [req.params.pageId, req.params.id]
    )
    .then(result => {
      if (result.rowCount === 0) return res.status(404).json({ message: 'Not found' });
      res.json({ page: mapDocPage(result.rows[0]) });
    })
    .catch(err => {
      console.error('doc-pages DELETE failed', err);
      res.status(500).json({ message: 'Failed to delete page' });
    });
});

// Bids
app.get('/api/bids', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...bids];
    if (projectId) list = list.filter(b => b.projectId === projectId);
    if (status) list = list.filter(b => b.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        b =>
          b.vendor.toLowerCase().includes(q) ||
          (b.projectName || '').toLowerCase().includes(q) ||
          (b.scope || '').toLowerCase().includes(q)
      );
    }
    return res.json({ bids: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(
      `(LOWER(vendor) LIKE $${clauses.length + 1} OR LOWER(scope) LIKE $${clauses.length + 1} OR LOWER(project_name) LIKE $${clauses.length + 1})`
    );
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM bids ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({ bids: result.rows }))
    .catch(() => res.json({ bids }));
});

app.post('/api/bids', (req, res) => {
  const body = req.body || {};
  const bid = {
    id: randomUUID(),
    vendor: body.vendor || 'Vendor',
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'submitted',
    scope: body.scope || '',
    projectName: body.projectName || '',
    projectId: body.projectId || '',
    submittedDate: body.submittedDate || new Date().toISOString().split('T')[0],
    validUntil: body.validUntil || '',
    contact: body.contact || '',
  };
  if (!pool) {
    bids.unshift(bid);
    return res.json({ bid });
  }
  pool
    .query(
      `INSERT INTO bids (id, vendor, amount, status, scope, project_name, project_id, submitted_date, valid_until, contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        bid.id,
        bid.vendor,
        bid.amount,
        bid.status,
        bid.scope,
        bid.projectName,
        bid.projectId,
        bid.submittedDate,
        bid.validUntil,
        bid.contact,
      ]
    )
    .then(result => res.json({ bid: result.rows[0] }))
    .catch(() => res.json({ bid }));
});

app.put('/api/bids/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const bid = bids.find(b => b.id === req.params.id);
    if (!bid) return res.status(404).json({ message: 'Not found' });
    Object.assign(bid, {
      vendor: body.vendor ?? bid.vendor,
      amount: body.amount !== undefined ? parseFloat(body.amount) || 0 : bid.amount,
      status: body.status ?? bid.status,
      scope: body.scope ?? bid.scope,
      projectName: body.projectName ?? bid.projectName,
      projectId: body.projectId ?? bid.projectId,
      submittedDate: body.submittedDate ?? bid.submittedDate,
      validUntil: body.validUntil ?? bid.validUntil,
      contact: body.contact ?? bid.contact,
    });
    return res.json({ bid });
  }

  pool
    .query('SELECT * FROM bids WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE bids SET
             vendor=$1, amount=$2, status=$3, scope=$4, project_name=$5, project_id=$6, submitted_date=$7, valid_until=$8, contact=$9
           WHERE id=$10
           RETURNING *`,
          [
            body.vendor ?? current.vendor,
            body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount,
            body.status ?? current.status,
            body.scope ?? current.scope,
            body.projectName ?? current.project_name,
            body.projectId ?? current.project_id,
            body.submittedDate ?? current.submitted_date,
            body.validUntil ?? current.valid_until,
            body.contact ?? current.contact,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ bid: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.patch('/api/bids/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const bid = bids.find(b => b.id === req.params.id);
    if (!bid) return res.status(404).json({ message: 'Not found' });
    if (body.status) bid.status = body.status;
    if (body.amount !== undefined) bid.amount = parseFloat(body.amount) || bid.amount;
    return res.json({ bid });
  }

  pool
    .query('SELECT * FROM bids WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE bids SET status=$1, amount=$2 WHERE id=$3 RETURNING *`,
          [
            body.status ?? current.status,
            body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ bid: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/bids/:id', (req, res) => {
  if (!pool) {
    const idx = bids.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = bids.splice(idx, 1);
    return res.json({ bid: removed });
  }

  pool
    .query('DELETE FROM bids WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ bid: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Inspections
app.get('/api/inspections', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...inspections];
    if (projectId) list = list.filter(i => i.projectId === projectId);
    if (status) list = list.filter(i => i.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        i =>
          (i.title || '').toLowerCase().includes(q) ||
          (i.type || '').toLowerCase().includes(q) ||
          (i.projectName || '').toLowerCase().includes(q)
      );
    }
    return res.json({ inspections: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(`(LOWER(title) LIKE $${clauses.length + 1} OR LOWER(type) LIKE $${clauses.length + 1} OR LOWER(project_name) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM inspections ${where} ORDER BY created_at DESC`, values)
    .then(result => {
      const mapped = result.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type,
        status: row.status || 'scheduled',
        date: row.date || row.scheduled_date,
        scheduledDate: row.scheduled_date || row.date,
        projectName: row.project_name,
        projectId: row.project_id,
        inspector: row.inspector,
        notes: row.notes,
        completedDate: row.completed_date,
      }));
      // Merge with in-memory fallback in case DB insert failed but UI expects to see local data
      const combined = [...mapped];
      inspections.forEach(mem => {
        if (!combined.find(r => r.id === mem.id)) {
          combined.push(mem);
        }
      });
      res.json({ inspections: combined });
    })
    .catch(() => res.json({ inspections }));
});

app.post('/api/inspections', (req, res) => {
  const body = req.body || {};
  const inspection = {
    id: randomUUID(),
    title: body.title || body.type || 'Inspection',
    type: body.type || 'general',
    status: body.status || 'scheduled',
    date: body.date || body.scheduledDate || null,
    scheduledDate: body.scheduledDate || body.date || null,
    projectName: body.projectName || '',
    projectId: body.projectId || '',
    inspector: body.inspector || '',
    notes: body.notes || '',
    completedDate: body.completedDate || null,
  };
  if (!pool) {
    inspections.unshift(inspection);
    return res.json({ inspection });
  }

  pool
    .query(
      `INSERT INTO inspections (id, title, type, status, date, scheduled_date, project_name, project_id, inspector, notes, completed_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        inspection.id,
        inspection.title,
        inspection.type,
        inspection.status,
        inspection.date || null,
        inspection.scheduledDate || null,
        inspection.projectName,
        inspection.projectId,
        inspection.inspector,
        inspection.notes,
        inspection.completedDate || null,
      ]
    )
    .then(result => res.json({ inspection: result.rows[0] }))
    .catch(() => res.json({ inspection }));
});

app.put('/api/inspections/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const inspection = inspections.find(i => i.id === req.params.id);
    if (!inspection) return res.status(404).json({ message: 'Not found' });
    Object.assign(inspection, {
      title: body.title ?? inspection.title,
      type: body.type ?? inspection.type,
      status: body.status ?? inspection.status,
      date: body.date ?? inspection.date,
      scheduledDate: body.scheduledDate ?? inspection.scheduledDate,
      projectName: body.projectName ?? inspection.projectName,
      projectId: body.projectId ?? inspection.projectId,
      inspector: body.inspector ?? inspection.inspector,
      notes: body.notes ?? inspection.notes,
      completedDate: body.completedDate ?? inspection.completedDate,
    });
    return res.json({ inspection });
  }

  pool
    .query('SELECT * FROM inspections WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE inspections SET
             title=$1, type=$2, status=$3, date=$4, scheduled_date=$5, project_name=$6, project_id=$7, inspector=$8, notes=$9, completed_date=$10
           WHERE id=$11
           RETURNING *`,
          [
            body.title ?? current.title,
            body.type ?? current.type,
            body.status ?? current.status,
            body.date === '' ? current.date : body.date ?? current.date,
            body.scheduledDate === '' ? current.scheduled_date : body.scheduledDate ?? current.scheduled_date,
            body.projectName ?? current.project_name,
            body.projectId ?? current.project_id,
            body.inspector ?? current.inspector,
            body.notes ?? current.notes,
            body.completedDate === '' ? current.completed_date : body.completedDate ?? current.completed_date,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ inspection: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.patch('/api/inspections/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const inspection = inspections.find(i => i.id === req.params.id);
    if (!inspection) return res.status(404).json({ message: 'Not found' });
    if (body.status) inspection.status = body.status;
    if (body.completedDate) inspection.completedDate = body.completedDate;
    return res.json({ inspection });
  }

  pool
    .query('SELECT * FROM inspections WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE inspections SET status=$1, completed_date=$2 WHERE id=$3 RETURNING *`,
          [body.status ?? current.status, body.completedDate ?? current.completed_date, req.params.id]
        )
        .then(updateResult => res.json({ inspection: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/inspections/:id', (req, res) => {
  if (!pool) {
    const idx = inspections.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = inspections.splice(idx, 1);
    return res.json({ inspection: removed });
  }

  pool
    .query('DELETE FROM inspections WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ inspection: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Equipment
app.get('/api/equipment', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...equipment];
    if (projectId) list = list.filter(e => e.projectId === projectId);
    if (status) list = list.filter(e => e.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e.projectName || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
      );
    }
    return res.json({ equipment: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(`(LOWER(name) LIKE $${clauses.length + 1} OR LOWER(project_name) LIKE $${clauses.length + 1} OR LOWER(location) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM equipment ${where} ORDER BY created_at DESC`, values)
    .then(result =>
      res.json({
        equipment: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          status: row.status === 'in_use' ? 'in-use' : row.status,
          location: row.location,
          projectId: row.project_id,
          projectName: row.project_name,
          assignedTo: row.assigned_to,
          purchaseDate: row.purchase_date,
          purchasePrice: Number(row.purchase_price || 0),
          lastMaintenance: row.last_service,
          nextMaintenance: row.next_maintenance,
        })),
      })
    )
    .catch(() => res.json({ equipment }));
});

app.post('/api/equipment', (req, res) => {
  const body = req.body || {};
  const item = {
    id: randomUUID(),
    name: body.name || 'Equipment',
    type: body.type || 'general',
    status: body.status || 'available',
    location: body.location || '',
    projectId: body.projectId || '',
    projectName: body.projectName || '',
    assignedTo: body.assignedTo || '',
    purchaseDate: body.purchaseDate || null,
    purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : 0,
    lastService: body.lastService || body.lastMaintenance || null,
    nextMaintenance: body.nextMaintenance || null,
  };
  if (!pool) {
    equipment.unshift(item);
    return res.json({ equipment: item });
  }

  pool
    .query(
      `INSERT INTO equipment (id, name, type, status, location, project_id, project_name, assigned_to, purchase_date, purchase_price, last_service, next_maintenance)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        item.id,
        item.name,
        item.type,
        item.status,
        item.location,
        item.projectId,
        item.projectName,
        item.assignedTo,
        item.purchaseDate || null,
        item.purchasePrice,
        item.lastService || null,
        item.nextMaintenance || null,
      ]
    )
    .then(result => res.json({ equipment: result.rows[0] }))
    .catch(() => res.json({ equipment: item }));
});

app.put('/api/equipment/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const item = equipment.find(e => e.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    Object.assign(item, {
      name: body.name ?? item.name,
      type: body.type ?? item.type,
      status: body.status ?? item.status,
      location: body.location ?? item.location,
      projectId: body.projectId ?? item.projectId,
      projectName: body.projectName ?? item.projectName,
      assignedTo: body.assignedTo ?? item.assignedTo,
      purchaseDate: body.purchaseDate === '' ? null : body.purchaseDate ?? item.purchaseDate,
      purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : item.purchasePrice,
      lastService: body.lastService === '' ? null : body.lastService ?? item.lastService,
      nextMaintenance: body.nextMaintenance === '' ? null : body.nextMaintenance ?? item.nextMaintenance,
    });
    return res.json({ equipment: item });
  }

  pool
    .query('SELECT * FROM equipment WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE equipment SET
             name=$1, type=$2, status=$3, location=$4, project_id=$5, project_name=$6, assigned_to=$7, purchase_date=$8, purchase_price=$9, last_service=$10, next_maintenance=$11
           WHERE id=$12
           RETURNING *`,
          [
            body.name ?? current.name,
            body.type ?? current.type,
            body.status ?? current.status,
            body.location ?? current.location,
            body.projectId ?? current.project_id,
            body.projectName ?? current.project_name,
            body.assignedTo ?? current.assigned_to,
            body.purchaseDate === '' ? current.purchase_date : body.purchaseDate ?? current.purchase_date,
            body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : current.purchase_price,
            body.lastService === ''
              ? current.last_service
              : (body.lastService ?? body.lastMaintenance) ?? current.last_service,
            body.nextMaintenance === '' ? current.next_maintenance : body.nextMaintenance ?? current.next_maintenance,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ equipment: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/equipment/:id', (req, res) => {
  if (!pool) {
    const idx = equipment.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = equipment.splice(idx, 1);
    return res.json({ equipment: removed });
  }

  pool
    .query('DELETE FROM equipment WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ equipment: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Manage Sold (sold properties)
app.get('/api/sold', (req, res) => {
  const { search, status } = req.query;
  if (!pool) {
    let list = [...sold];
    if (status) list = list.filter(s => s.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        s =>
          (s.projectName || '').toLowerCase().includes(q) ||
          (s.buyer || '').toLowerCase().includes(q) ||
          (s.address || '').toLowerCase().includes(q)
      );
    }
    return res.json({ sold: list });
  }

  const clauses = [];
  const values = [];
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(`(LOWER(project_name) LIKE $${clauses.length + 1} OR LOWER(buyer) LIKE $${clauses.length + 1} OR LOWER(address) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  pool
    .query(`SELECT * FROM sold_properties ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({ sold: result.rows }))
    .catch(() => res.json({ sold }));
});

app.post('/api/sold', (req, res) => {
  const body = req.body || {};
  const record = {
    id: randomUUID(),
    projectName: body.projectName || '',
    buyer: body.buyer || '',
    salePrice: parseFloat(body.salePrice) || 0,
    profit: parseFloat(body.profit) || 0,
    closeDate: body.closeDate || '',
    status: body.status || 'pending',
    handoffNotes: body.handoffNotes || '',
    address: body.address || '',
  };
  if (!pool) {
    sold.unshift(record);
    return res.json({ sold: record });
  }

  pool
    .query(
      `INSERT INTO sold_properties (id, project_name, buyer, sale_price, profit, close_date, status, handoff_notes, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        record.id,
        record.projectName,
        record.buyer,
        record.salePrice,
        record.profit,
        record.closeDate,
        record.status,
        record.handoffNotes,
        record.address,
      ]
    )
    .then(result => res.json({ sold: result.rows[0] }))
    .catch(() => res.json({ sold: record }));
});

app.put('/api/sold/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const record = sold.find(s => s.id === req.params.id);
    if (!record) return res.status(404).json({ message: 'Not found' });
    Object.assign(record, {
      projectName: body.projectName ?? record.projectName,
      buyer: body.buyer ?? record.buyer,
      salePrice: body.salePrice !== undefined ? parseFloat(body.salePrice) || 0 : record.salePrice,
      profit: body.profit !== undefined ? parseFloat(body.profit) || 0 : record.profit,
      closeDate: body.closeDate ?? record.closeDate,
      status: body.status ?? record.status,
      handoffNotes: body.handoffNotes ?? record.handoffNotes,
      address: body.address ?? record.address,
    });
    return res.json({ sold: record });
  }

  pool
    .query('SELECT * FROM sold_properties WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE sold_properties SET
             project_name=$1, buyer=$2, sale_price=$3, profit=$4, close_date=$5, status=$6, handoff_notes=$7, address=$8
           WHERE id=$9
           RETURNING *`,
          [
            body.projectName ?? current.project_name,
            body.buyer ?? current.buyer,
            body.salePrice !== undefined ? parseFloat(body.salePrice) || 0 : current.sale_price,
            body.profit !== undefined ? parseFloat(body.profit) || 0 : current.profit,
            body.closeDate ?? current.close_date,
            body.status ?? current.status,
            body.handoffNotes ?? current.handoff_notes,
            body.address ?? current.address,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ sold: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/sold/:id', (req, res) => {
  if (!pool) {
    const idx = sold.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = sold.splice(idx, 1);
    return res.json({ sold: removed });
  }

  pool
    .query('DELETE FROM sold_properties WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ sold: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Messages
app.get('/api/messages', (_req, res) => {
  res.json({ messages });
});

app.post('/api/messages', (req, res) => {
  const body = req.body || {};
  const message = {
    id: randomUUID(),
    sender: body.sender || 'User',
    content: body.content || '',
    timestamp: new Date().toISOString(),
  };
  messages.push(message);
  res.json(message);
});

// Proposals
app.get('/api/proposals', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    let list = [...proposals];
    if (projectId) list = list.filter(p => p.projectId === projectId);
    if (status) list = list.filter(p => p.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q) ||
          (p.projectName || '').toLowerCase().includes(q)
      );
    }
    return res.json({ proposals: list });
  }
  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (search) {
    clauses.push(`(LOWER(title) LIKE $${clauses.length + 1} OR LOWER(client_name) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM proposals ${where} ORDER BY created_at DESC`, values)
    .then(result =>
      res.json({
        proposals: result.rows.map(row => ({
          ...row,
          projectId: row.project_id,
          projectName: row.project_name,
          clientName: row.client_name,
          validUntil: row.valid_until,
          fileUrl: row.file_url,
          fileName: row.file_name,
          fileType: row.file_type,
        })),
      })
    )
    .catch(() => res.json({ proposals }));
});

app.get('/api/projects/:id/proposals', (req, res) => {
  if (!pool) {
    const list = proposals.filter(p => p.projectId === req.params.id);
    return res.json({ proposals: list });
  }
  pool
    .query('SELECT * FROM proposals WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
    .then(result =>
      res.json({
        proposals: result.rows.map(row => ({
          ...row,
          projectId: row.project_id,
          projectName: row.project_name,
          clientName: row.client_name,
          validUntil: row.valid_until,
          fileUrl: row.file_url,
          fileName: row.file_name,
          fileType: row.file_type,
        })),
      })
    )
    .catch(() => res.json({ proposals: [] }));
});

app.post('/api/proposals', (req, res) => {
  const body = req.body || {};
  const proposal = {
    id: randomUUID(),
    title: body.title || 'Proposal',
    clientName: body.clientName || '',
    projectName: body.projectName || '',
    projectId: body.projectId,
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'draft',
    validUntil: body.validUntil || body.dueDate || '',
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    proposals.push(proposal);
    return res.json({ proposal });
  }
  pool
    .query(
      `INSERT INTO proposals (id, title, client_name, project_id, project_name, amount, status, valid_until, file_url, file_name, file_type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        proposal.id,
        proposal.title,
        proposal.clientName,
        proposal.projectId,
        proposal.projectName,
        proposal.amount,
        proposal.status,
        proposal.validUntil || null,
        proposal.fileUrl,
        proposal.fileName,
        proposal.fileType,
        proposal.createdAt,
      ]
    )
    .then(result => res.json({ proposal: result.rows[0] }))
    .catch(() => res.json({ proposal }));
});

app.post('/api/projects/:id/proposals', (req, res) => {
  const body = req.body || {};
  const proposal = {
    id: randomUUID(),
    title: body.title || 'Proposal',
    clientName: body.clientName || '',
    projectName: body.projectName || '',
    projectId: req.params.id,
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'draft',
    validUntil: body.validUntil || '',
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    proposals.push(proposal);
    return res.json({ proposal });
  }
  pool
    .query(
      `INSERT INTO proposals (id, title, client_name, project_id, project_name, amount, status, valid_until, file_url, file_name, file_type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        proposal.id,
        proposal.title,
        proposal.clientName,
        proposal.projectId,
        proposal.projectName,
        proposal.amount,
        proposal.status,
        proposal.validUntil || null,
        proposal.fileUrl,
        proposal.fileName,
        proposal.fileType,
        proposal.createdAt,
      ]
    )
    .then(result => res.json({ proposal: result.rows[0] }))
    .catch(() => res.json({ proposal }));
});

app.put('/api/proposals/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const proposal = proposals.find(p => p.id === req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Not found' });
    Object.assign(proposal, {
      title: body.title ?? proposal.title,
      clientName: body.clientName ?? proposal.clientName,
      projectName: body.projectName ?? proposal.projectName,
      projectId: body.projectId ?? proposal.projectId,
      amount: body.amount !== undefined ? parseFloat(body.amount) || 0 : proposal.amount,
      status: body.status ?? proposal.status,
      validUntil: body.validUntil ?? proposal.validUntil,
      fileUrl: body.fileUrl ?? proposal.fileUrl,
      fileName: body.fileName ?? proposal.fileName,
      fileType: body.fileType ?? proposal.fileType,
    });
    return res.json({ proposal });
  }
  pool
    .query('SELECT * FROM proposals WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE proposals SET
             title=$1, client_name=$2, project_id=$3, project_name=$4, amount=$5, status=$6, valid_until=$7, file_url=$8, file_name=$9, file_type=$10
           WHERE id=$11
           RETURNING *`,
          [
            body.title ?? current.title,
            body.clientName ?? current.client_name,
            body.projectId ?? current.project_id,
            body.projectName ?? current.project_name,
            body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount,
            body.status ?? current.status,
            body.validUntil ?? current.valid_until,
            body.fileUrl ?? current.file_url,
            body.fileName ?? current.file_name,
            body.fileType ?? current.file_type,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ proposal: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.patch('/api/proposals/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const proposal = proposals.find(p => p.id === req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Not found' });
    if (body.status) proposal.status = body.status;
    if (body.amount !== undefined) proposal.amount = parseFloat(body.amount) || proposal.amount;
    if (body.validUntil !== undefined) proposal.validUntil = body.validUntil;
    return res.json({ proposal });
  }
  pool
    .query('SELECT * FROM proposals WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE proposals SET
             status=COALESCE($1,status),
             amount=COALESCE($2,amount),
             valid_until=COALESCE($3,valid_until)
           WHERE id=$4
           RETURNING *`,
          [
            body.status ?? current.status,
            body.amount !== undefined ? parseFloat(body.amount) || current.amount : current.amount,
            body.validUntil ?? current.valid_until,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ proposal: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/proposals/:id', (req, res) => {
  if (!pool) {
    const idx = proposals.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = proposals.splice(idx, 1);
    return res.json({ proposal: removed });
  }
  pool
    .query('DELETE FROM proposals WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ proposal: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Invoices
app.get('/api/invoices', (req, res) => {
  const { search, status, projectId, type } = req.query;
  if (!pool) {
    let list = [...invoices];
    if (projectId) list = list.filter(i => i.projectId === projectId);
    if (status) list = list.filter(i => i.status === status);
    if (type) list = list.filter(i => i.type === type);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        i =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          (i.projectName || '').toLowerCase().includes(q) ||
          i.clientName.toLowerCase().includes(q)
      );
    }
    return res.json({ invoices: list });
  }

  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (status) {
    clauses.push(`status = $${clauses.length + 1}`);
    values.push(status);
  }
  if (type) {
    clauses.push(`type = $${clauses.length + 1}`);
    values.push(type);
  }
  if (search) {
    clauses.push(`(LOWER(invoice_number) LIKE $${clauses.length + 1} OR LOWER(client_name) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({
      invoices: result.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        projectId: row.project_id,
        projectName: row.project_name,
        clientName: row.client_name,
        amount: Number(row.amount || 0),
        status: row.status,
        dueDate: row.due_date,
        issueDate: row.issue_date,
        description: row.description,
        fileUrl: row.file_url,
        fileName: row.file_name,
        fileType: row.file_type,
        type: row.type,
        createdAt: row.created_at,
      })),
    }))
    .catch(() => res.json({ invoices }));
});

app.post('/api/invoices', (req, res) => {
  const body = req.body || {};
  const invoiceNumber = body.invoiceNumber && String(body.invoiceNumber).trim()
    ? body.invoiceNumber
    : `INV-${Date.now()}`;
  const projectName = body.projectName || body.project_name || '';
  const dueDate = body.dueDate || body.due_date || null;
  const issueDate = body.issueDate || body.issue_date || null;
  const invoice = {
    id: randomUUID(),
    invoiceNumber,
    projectId: body.projectId,
    projectName,
    clientName: body.clientName || '',
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'draft',
    dueDate,
    issueDate,
    description: body.description || '',
    fileUrl: body.fileUrl,
    fileName: body.fileName,
    fileType: body.fileType,
    type: body.type || 'invoice',
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    invoices.unshift(invoice);
    return res.json({ invoice });
  }
  pool
    .query(
      `INSERT INTO invoices (id, invoice_number, project_id, project_name, client_name, amount, status, due_date, issue_date, description, file_url, file_name, file_type, type, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        invoice.id,
        invoice.invoiceNumber,
        invoice.projectId,
        invoice.projectName,
        invoice.clientName,
        invoice.amount,
        invoice.status,
        invoice.dueDate || null,
        invoice.issueDate || null,
        invoice.description,
        invoice.fileUrl,
        invoice.fileName,
        invoice.fileType,
        invoice.type,
        invoice.createdAt,
      ]
    )
    .then(result => res.json({ invoice: result.rows[0] }))
    .catch(() => res.json({ invoice }));
});

app.put('/api/invoices/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const invoice = invoices.find(i => i.id === req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Not found' });
    const invoiceNumber = body.invoiceNumber && String(body.invoiceNumber).trim()
      ? body.invoiceNumber
      : invoice.invoiceNumber || `INV-${Date.now()}`;
    Object.assign(invoice, {
      invoiceNumber,
      projectId: body.projectId ?? invoice.projectId,
      projectName: body.projectName ?? invoice.projectName,
      clientName: body.clientName ?? invoice.clientName,
      amount: body.amount !== undefined ? parseFloat(body.amount) || 0 : invoice.amount,
      status: body.status ?? invoice.status,
      dueDate: body.dueDate === '' ? invoice.dueDate : body.dueDate ?? invoice.dueDate,
      issueDate: body.issueDate === '' ? invoice.issueDate : body.issueDate ?? invoice.issueDate,
      description: body.description ?? invoice.description,
      fileUrl: body.fileUrl ?? invoice.fileUrl,
      fileName: body.fileName ?? invoice.fileName,
      fileType: body.fileType ?? invoice.fileType,
      type: body.type ?? invoice.type,
    });
    return res.json({ invoice });
  }
  pool
    .query('SELECT * FROM invoices WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      const nextInvoiceNumber = body.invoiceNumber && String(body.invoiceNumber).trim()
        ? body.invoiceNumber
        : current.invoice_number || `INV-${Date.now()}`;
      const nextProjectName = body.projectName ?? current.project_name;
      const nextDue = body.dueDate === '' ? current.due_date : body.dueDate ?? current.due_date;
      const nextIssue = body.issueDate === '' ? current.issue_date : body.issueDate ?? current.issue_date;
      return pool
        .query(
          `UPDATE invoices SET
             invoice_number=$1,
             project_id=$2,
             project_name=$3,
             client_name=$4,
             amount=$5,
             status=$6,
             due_date=$7,
             issue_date=$8,
             description=$9,
             file_url=$10,
             file_name=$11,
             file_type=$12,
             type=$13
           WHERE id=$14
           RETURNING *`,
          [
            nextInvoiceNumber,
            body.projectId ?? current.project_id,
            nextProjectName,
            body.clientName ?? current.client_name,
            body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount,
            body.status ?? current.status,
            nextDue,
            nextIssue,
            body.description ?? current.description,
            body.fileUrl ?? current.file_url,
            body.fileName ?? current.file_name,
            body.fileType ?? current.file_type,
            body.type ?? current.type,
            req.params.id,
          ]
        )
        .then(updateResult => res.json({ invoice: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.patch('/api/invoices/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const invoice = invoices.find(i => i.id === req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Not found' });
    if (body.status) invoice.status = body.status;
    return res.json({ invoice });
  }
  pool
    .query(
      `UPDATE invoices SET status=COALESCE($1,status) WHERE id=$2 RETURNING *`,
      [body.status, req.params.id]
    )
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ invoice: row });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/invoices/:id', (req, res) => {
  if (!pool) {
    const idx = invoices.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = invoices.splice(idx, 1);
    return res.json({ invoice: removed });
  }
  pool
    .query('DELETE FROM invoices WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ invoice: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// Conversations/messages for UI
app.get('/api/messages/conversations', (_req, res) => {
  res.json({ conversations });
});

app.get('/api/messages/conversation/:id', (req, res) => {
  const { id } = req.params;
  const msgs = conversationMessages[id] || [];
  res.json({ messages: msgs });
});

app.post('/api/messages/conversation/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const msg = {
    id: randomUUID(),
    sender: { id: body.senderId || 'u-1', name: body.senderName || 'User' },
    content: body.content || '',
    timestamp: new Date().toISOString(),
    read: false,
  };
  conversationMessages[id] = conversationMessages[id] || [];
  conversationMessages[id].push(msg);
  res.json(msg);
});

// Schedule (in-memory only)
app.get('/api/schedule/events', (req, res) => {
  const { projectId, type, search } = req.query;
  if (!pool) {
    let list = [...scheduleEvents];
    if (projectId) {
      const projectMatchName =
        projects.find(p => p.id === projectId)?.name ||
        projectDocuments[projectId]?.projectName ||
        '';
      list = list.filter(
        e => e.projectId === projectId || (!!projectMatchName && e.projectName === projectMatchName)
      );
    }
    if (type) list = list.filter(e => e.type === type);
    if (search) {
      const q = String(search).toLowerCase();
      list = list.filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          (e.projectName || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
      );
    }
    return res.json({ events: list });
  }
  const clauses = [];
  const values = [];
  if (projectId) {
    clauses.push(`project_id = $${clauses.length + 1}`);
    values.push(projectId);
  }
  if (type) {
    clauses.push(`type = $${clauses.length + 1}`);
    values.push(type);
  }
  if (search) {
    clauses.push(`(LOWER(title) LIKE $${clauses.length + 1} OR LOWER(description) LIKE $${clauses.length + 1})`);
    values.push(`%${String(search).toLowerCase()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  pool
    .query(`SELECT * FROM schedule_events ${where} ORDER BY start_date ASC`, values)
    .then(result =>
      res.json({
        events: result.rows.map(row => ({
          id: row.id,
          title: row.title,
          projectId: row.project_id,
          projectName: row.project_name,
          type: row.type,
          startDate: row.start_date,
          endDate: row.end_date,
          assignee: row.assignee,
          description: row.description,
          location: row.location,
          taskId: row.task_id || null,
        })),
      })
    )
    .catch(() => res.json({ events: scheduleEvents }));
});

app.post('/api/schedule/events', (req, res) => {
  const body = req.body || {};
  const event = {
    id: randomUUID(),
    title: body.title || 'Event',
    projectId: body.projectId,
    projectName:
      body.projectName ||
      projects.find(p => p.id === body.projectId)?.name ||
      '',
    type: body.type || 'task',
    startDate: body.startDate || '',
    endDate: body.endDate || body.startDate || '',
    assignee: body.assignee || '',
    description: body.description || '',
    location: body.location || '',
  };
  if (!pool) {
    scheduleEvents.push(event);
    // if this is a task-type event, mirror it into tasks for visibility on Tasks page
    if (event.type === 'task') {
      const task = {
        id: event.id,
        title: event.title,
        description: event.description,
        status: 'todo',
        priority: 'medium',
        assignee: event.assignee || '',
        projectId: event.projectId || '',
        projectName: event.projectName || '',
        dueDate: event.endDate || event.startDate || '',
        completed: false,
      };
      tasks.push(task);
      if (task.projectId) {
        const bucket = (projectTasks[task.projectId] = projectTasks[task.projectId] || []);
        bucket.push({
          id: task.id,
          projectId: task.projectId,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assignee,
          dueDate: task.dueDate,
          projectName: task.projectName,
          createdBy: 'System',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return res.json({ event });
  }
  pool
    .query(
      `INSERT INTO schedule_events (id, title, project_id, project_name, type, start_date, end_date, assignee, description, location, task_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        event.id,
        event.title,
        event.projectId,
        event.projectName,
        event.type,
        event.startDate || null,
        event.endDate || null,
        event.assignee,
        event.description,
        event.location,
        event.type === 'task' ? event.id : null,
      ]
    )
    .then(result => {
      const row = result.rows[0];
      if (event.type === 'task') {
        const taskPayload = {
          id: event.id,
          title: event.title,
          description: event.description,
          status: 'todo',
          priority: 'medium',
          assignee: event.assignee || '',
          projectId: event.projectId,
          projectName: event.projectName,
          dueDate: event.endDate || event.startDate || null,
          completed: false,
        };
        pool
          .query(
            `INSERT INTO tasks (id, title, description, status, priority, assignee, project_id, project_name, due_date, completed)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (id) DO NOTHING`,
            [
              taskPayload.id,
              taskPayload.title,
              taskPayload.description,
              taskPayload.status,
              taskPayload.priority,
              taskPayload.assignee,
              taskPayload.projectId,
              taskPayload.projectName,
              taskPayload.dueDate || null,
              taskPayload.completed,
            ]
          )
          .catch(() => {});
      }
      return res.json({ event: row });
    })
    .catch(() => res.json({ event }));
});

app.put('/api/schedule/events/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const event = scheduleEvents.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ message: 'Not found' });
    Object.assign(event, {
      title: body.title ?? event.title,
      projectId: body.projectId ?? event.projectId,
      projectName:
        body.projectName ??
        event.projectName ??
        (body.projectId ? projects.find(p => p.id === body.projectId)?.name : undefined),
      type: body.type ?? event.type,
      startDate: body.startDate ?? event.startDate,
      endDate: body.endDate ?? event.endDate,
      assignee: body.assignee ?? event.assignee,
      description: body.description ?? event.description,
      location: body.location ?? event.location,
    });
    return res.json({ event });
  }

  pool
    .query('SELECT * FROM schedule_events WHERE id = $1', [req.params.id])
    .then(result => {
      const current = result.rows[0];
      if (!current) return res.status(404).json({ message: 'Not found' });
      return pool
        .query(
          `UPDATE schedule_events SET
             title=$1, project_id=$2, project_name=$3, type=$4, start_date=$5, end_date=$6, assignee=$7, description=$8, location=$9, updated_at=now()
           WHERE id=$10
           RETURNING *`,
          [
            body.title ?? current.title,
            body.projectId ?? current.project_id,
            body.projectName ?? current.project_name,
            body.type ?? current.type,
            body.startDate ?? current.start_date,
            body.endDate ?? current.end_date,
            body.assignee ?? current.assignee,
            body.description ?? current.description,
            body.location ?? current.location,
            req.params.id,
          ]
        )
        .then(updateResult => {
          const updated = updateResult.rows[0];
          if ((body.type ?? current.type) === 'task') {
            const taskUpdate = {
              title: body.title ?? current.title,
              description: body.description ?? current.description,
              assignee: body.assignee ?? current.assignee,
              projectId: body.projectId ?? current.project_id,
              projectName: body.projectName ?? current.project_name,
              dueDate: body.endDate ?? current.end_date ?? body.startDate ?? current.start_date,
            };
            pool
              .query('SELECT * FROM tasks WHERE id = $1', [req.params.id])
              .then(taskResult => {
                if (taskResult.rows[0]) {
                  return pool.query(
                    `UPDATE tasks SET title=$1, description=$2, assignee=$3, project_id=$4, project_name=$5, due_date=$6 WHERE id=$7`,
                    [
                      taskUpdate.title,
                      taskUpdate.description,
                      taskUpdate.assignee,
                      taskUpdate.projectId,
                      taskUpdate.projectName,
                      taskUpdate.dueDate || null,
                      req.params.id,
                    ]
                  );
                }
                return pool.query(
                  `INSERT INTO tasks (id, title, description, status, priority, assignee, project_id, project_name, due_date, completed)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                  [
                    req.params.id,
                    taskUpdate.title,
                    taskUpdate.description,
                    'todo',
                    'medium',
                    taskUpdate.assignee,
                    taskUpdate.projectId,
                    taskUpdate.projectName,
                    taskUpdate.dueDate || null,
                    false,
                  ]
                );
              })
              .catch(() => {});
          }
          return res.json({ event: updated });
        });
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/schedule/events/:id', (req, res) => {
  if (!pool) {
    const idx = scheduleEvents.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = scheduleEvents.splice(idx, 1);
    if (removed.type === 'task') {
      const tIdx = tasks.findIndex(t => t.id === removed.id);
      if (tIdx !== -1) tasks.splice(tIdx, 1);
    }
    return res.json({ event: removed });
  }
  pool
    .query('DELETE FROM schedule_events WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      if (row.type === 'task') {
        pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]).catch(() => {});
      }
      res.json({ event: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

// ─────────────────────────────────────────────────────────────────────────────
// OneDrive / Microsoft Graph — Delegated OAuth2 flow
// Works with personal Microsoft accounts (hotmail, outlook, live)
// Required env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
// One-time setup: visit /api/onedrive/auth to connect your account
// ─────────────────────────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const OD_APP_ROOT = 'BuilderApp';
const OD_REDIRECT_URI = 'https://srv-d7jgoefavr4c73c9n8k0.onrender.com/api/onedrive/callback';
const OD_SCOPES = 'Files.ReadWrite offline_access User.Read';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

// In-memory access token cache
let _odAccessToken = null;
let _odAccessTokenExpiry = 0;

async function odGetSetting(key) {
  if (!pool) return null;
  try {
    const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    return r.rows[0]?.value || null;
  } catch { return null; }
}

async function odSetSetting(key, value) {
  if (!pool) return;
  await pool.query(
    'INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, value]
  );
}

async function getOneDriveToken() {
  // Return cached token if still valid
  if (_odAccessToken && Date.now() < _odAccessTokenExpiry - 60_000) return _odAccessToken;

  const refreshToken = await odGetSetting('od_refresh_token');
  if (!refreshToken) throw new Error('OneDrive not authorised. Visit /api/onedrive/auth to connect.');

  const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  const { data } = await axios.post(
    MS_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: AZURE_CLIENT_ID,
      client_secret: AZURE_CLIENT_SECRET,
      refresh_token: refreshToken,
      scope: OD_SCOPES,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  _odAccessToken = data.access_token;
  _odAccessTokenExpiry = Date.now() + data.expires_in * 1000;
  if (data.refresh_token) await odSetSetting('od_refresh_token', data.refresh_token);
  return _odAccessToken;
}

async function odGet(token, path) {
  const { data } = await axios.get(`${GRAPH_BASE}/me/drive${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function odPost(token, path, body) {
  const { data } = await axios.post(`${GRAPH_BASE}/me/drive${path}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data;
}

async function odPut(token, path, buffer, contentType) {
  const { data } = await axios.put(`${GRAPH_BASE}/me/drive${path}`, buffer, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data;
}

async function odDelete(token, itemId) {
  await axios.delete(`${GRAPH_BASE}/me/drive/items/${itemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function odEnsureFolder(token, folderPath) {
  const segments = folderPath.split('/').filter(Boolean);
  let builtPath = '';
  for (const seg of segments) {
    const parentApiPath = builtPath ? `/root:/${builtPath}:/children` : '/root/children';
    const fullSeg = builtPath ? `${builtPath}/${seg}` : seg;
    try {
      await odGet(token, `/root:/${fullSeg}`);
    } catch (err) {
      if (err.response?.status === 404) {
        await odPost(token, parentApiPath, {
          name: seg,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'replace',
        });
      } else throw err;
    }
    builtPath = fullSeg;
  }
}

async function odUploadFile(token, folderPath, filename, buffer, contentType) {
  const safeName = filename.replace(/\s+/g, '_');
  return odPut(token, `/root:/${folderPath}/${safeName}:/content`, buffer, contentType || 'application/octet-stream');
}

// ── Middleware: require OneDrive to be authorised ────────────────────────────
async function requireOneDrive(req, res, next) {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'OneDrive not configured', configured: false });
  }
  const token = await odGetSetting('od_refresh_token');
  if (!token) {
    return res.status(503).json({
      error: 'OneDrive not authorised',
      configured: false,
      needsAuth: true,
      authUrl: '/api/onedrive/auth',
    });
  }
  next();
}

// ── GET /api/onedrive/auth ── redirect user to Microsoft login ───────────────
app.get('/api/onedrive/auth', (req, res) => {
  const { AZURE_CLIENT_ID } = process.env;
  if (!AZURE_CLIENT_ID) return res.status(503).send('AZURE_CLIENT_ID not configured');
  const url = `${MS_AUTH_URL}?${new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: OD_REDIRECT_URI,
    scope: OD_SCOPES,
    response_mode: 'query',
  }).toString()}`;
  res.redirect(url);
});

// ── GET /api/onedrive/callback ── Microsoft redirects here after login ───────
app.get('/api/onedrive/callback', async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) return res.status(400).send(`Auth error: ${error} — ${error_description}`);
  if (!code) return res.status(400).send('No code received from Microsoft');
  try {
    const { data } = await axios.post(
      MS_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.AZURE_CLIENT_ID,
        client_secret: process.env.AZURE_CLIENT_SECRET,
        code,
        redirect_uri: OD_REDIRECT_URI,
        scope: OD_SCOPES,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    await odSetSetting('od_refresh_token', data.refresh_token);
    await odSetSetting('od_access_token', data.access_token);
    _odAccessToken = data.access_token;
    _odAccessTokenExpiry = Date.now() + data.expires_in * 1000;
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:48px;max-width:480px;margin:0 auto;text-align:center">
      <div style="font-size:48px">✅</div>
      <h2 style="color:#16a34a;margin-top:16px">OneDrive Connected!</h2>
      <p style="color:#64748b">Your OneDrive has been linked to BuilderApp.<br>You can close this tab and return to the app.</p>
    </body></html>`);
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('OneDrive callback error', detail);
    res.status(500).send(`Failed to connect OneDrive: ${JSON.stringify(detail)}`);
  }
});

// ── GET /api/onedrive/status ─────────────────────────────────────────────────
app.get('/api/onedrive/status', async (req, res) => {
  const hasCredentials = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
  if (!hasCredentials) return res.json({ configured: false });
  try {
    const token = await odGetSetting('od_refresh_token');
    res.json({ configured: !!token, needsAuth: !token });
  } catch {
    res.json({ configured: false });
  }
});

// ── GET /api/onedrive/browse?path=Images/ProjectName ────────────────────────
app.get('/api/onedrive/browse', requireOneDrive, async (req, res) => {
  try {
    const token = await getOneDriveToken();
    const rawPath = (req.query.path || '').replace(/^\/+|\/+$/g, '');
    const fullPath = rawPath ? `${OD_APP_ROOT}/${rawPath}` : OD_APP_ROOT;
    await odEnsureFolder(token, fullPath);
    const { value } = await odGet(token, `/root:/${fullPath}:/children`);
    const items = (value || []).map(it => ({
      id: it.id,
      name: it.name,
      type: it.folder ? 'folder' : 'file',
      size: it.size,
      mimeType: it.file?.mimeType,
      webUrl: it.webUrl,
      createdAt: it.createdDateTime,
    }));
    res.json({ items, path: fullPath });
  } catch (err) {
    const msg = err.response?.data?.error
      ? `${err.response.data.error.code}: ${err.response.data.error.message}`
      : err.message;
    console.error('OneDrive browse error', msg);
    res.status(500).json({ error: msg });
  }
});

// ── POST /api/onedrive/folder ────────────────────────────────────────────────
app.post('/api/onedrive/folder', requireOneDrive, async (req, res) => {
  try {
    const token = await getOneDriveToken();
    const parentPath = (req.body.path || '').replace(/^\/+|\/+$/g, '');
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const fullParent = parentPath ? `${OD_APP_ROOT}/${parentPath}` : OD_APP_ROOT;
    await odEnsureFolder(token, fullParent);
    const item = await odPost(token, `/root:/${fullParent}:/children`, {
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    });
    res.json({ id: item.id, name: item.name, type: 'folder', webUrl: item.webUrl });
  } catch (err) {
    if (err.response?.status === 409) return res.status(409).json({ error: 'Folder already exists' });
    console.error('OneDrive create folder error', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/onedrive/upload ────────────────────────────────────────────────
app.post('/api/onedrive/upload', requireOneDrive, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const token = await getOneDriveToken();
    const folderPath = (req.body.path || '').replace(/^\/+|\/+$/g, '');
    const fullPath = folderPath ? `${OD_APP_ROOT}/${folderPath}` : OD_APP_ROOT;
    await odEnsureFolder(token, fullPath);
    const item = await odUploadFile(token, fullPath, file.originalname, file.buffer, file.mimetype);
    res.json({
      id: item.id,
      name: item.name,
      size: item.size,
      mimeType: file.mimetype,
      url: item['@content.downloadUrl'] || item.webUrl,
      webUrl: item.webUrl,
    });
  } catch (err) {
    console.error('OneDrive upload error', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/onedrive/item/:itemId ────────────────────────────────────────
app.delete('/api/onedrive/item/:itemId', requireOneDrive, async (req, res) => {
  try {
    const token = await getOneDriveToken();
    await odDelete(token, req.params.itemId);
    res.json({ success: true });
  } catch (err) {
    console.error('OneDrive delete error', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/onedrive/thumbnail/:itemId ──────────────────────────────────────
app.get('/api/onedrive/thumbnail/:itemId', requireOneDrive, async (req, res) => {
  try {
    const token = await getOneDriveToken();
    const data = await odGet(token, `/items/${req.params.itemId}/thumbnails`);
    const url = data.value?.[0]?.large?.url || data.value?.[0]?.medium?.url || null;
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Document upload: use OneDrive when authorised, fall back to S3 ───────────
const handleDocumentUploadV2 = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'No file uploaded' });
  const projectId = req.body.projectId || 'global';
  const folder = (req.body.folder || '').replace(/^\//, '');

  const hasCredentials = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
  const refreshToken = hasCredentials ? await odGetSetting('od_refresh_token') : null;

  if (refreshToken) {
    try {
      const token = await getOneDriveToken();
      const folderPath = folder ? `Documents/${projectId}/${folder}` : `Documents/${projectId}`;
      const fullPath = `${OD_APP_ROOT}/${folderPath}`;
      await odEnsureFolder(token, fullPath);
      const item = await odUploadFile(token, fullPath, file.originalname, file.buffer, file.mimetype);
      return res.json({
        key: item.id, url: item['@content.downloadUrl'] || item.webUrl,
        name: file.originalname, size: file.size, type: file.mimetype, source: 'onedrive',
      });
    } catch (err) {
      console.error('OneDrive doc upload failed, falling back to S3', err.message);
    }
  }

  // S3 fallback
  const key = `documents/${projectId}/${folder ? folder + '/' : ''}${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: FILES_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: FILES_BUCKET, Key: key }), { expiresIn: 60 * 60 * 24 * 7 });
    res.json({ key, url, name: file.originalname, size: file.size, type: file.mimetype, source: 's3' });
  } catch (err) {
    console.error('S3 upload failed', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};

// Replace the old upload handlers
app.post('/api/documents/upload', upload.single('file'), handleDocumentUploadV2);
app.post('/documents/upload', upload.single('file'), handleDocumentUploadV2);

// Fallback
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

ensureTables()
  .catch(err => {
    // eslint-disable-next-line no-console
    console.error('Failed to ensure tables', err);
  })
  .finally(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on port ${port}`);
    });
  });
