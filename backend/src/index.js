const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');

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
        created_at timestamptz DEFAULT now()
      );
    `);
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
        created_at timestamptz DEFAULT now()
      );
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
  } finally {
    client.release();
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

app.post('/api/projects/:id/tasks', (req, res) => {
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
    // Keep global list in sync so tasks page can see project tasks
    tasks.push({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: task.assignedTo || '',
      projectName: task.projectName || '',
      projectId: task.projectId,
      dueDate: task.dueDate,
      completed: task.status === 'done' || task.status === 'completed',
    });
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
    .then(result => res.json({ task: { ...task, ...result.rows[0] } }))
    .catch(() => res.json({ task }));
});

app.put('/api/projects/:id/tasks/:taskId', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const tasks = (projectTasks[req.params.id] = projectTasks[req.params.id] || []);
    let task = tasks.find(t => t.id === req.params.taskId);
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
      tasks.push(task);
    } else {
      task.title = body.title ?? task.title;
      task.description = body.description ?? task.description;
      task.status = body.status ?? task.status;
      task.priority = body.priority ?? task.priority;
      task.assignedTo = body.assignedTo ?? task.assignedTo;
      task.dueDate = body.dueDate ?? task.dueDate;
      task.updatedAt = new Date().toISOString();
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

  // In-memory fallback
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
    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    const row = result.rows[0];
    if (row) {
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
    }
  } catch (err) {
    // fall through to memory + success response
  }

  const removed = deleteFromMemory();
  if (removed) return res.json({ project: removed });

  // If it was already gone, still return success so the UI can continue
  return res.json({ project: { id: projectId } });
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
app.get('/api/tasks', (req, res) => {
  const { search, status, projectId } = req.query;
  if (!pool) {
    // Flatten project-specific tasks into the global view so all tasks appear here
    const projectTaskList = Object.entries(projectTasks).flatMap(([pid, taskList]) =>
      (taskList || []).map(t => ({
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
      }))
    );
    return res.json({ tasks: [...tasks, ...projectTaskList] });
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

app.post('/api/tasks', (req, res) => {
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
    .then(result => res.json({ task: { ...task, ...result.rows[0] } }))
    .catch(() => res.json({ task }));
});

app.patch('/api/tasks/:id', (req, res) => {
  const body = req.body || {};
  if (!pool) {
    const task = tasks.find(t => t.id === req.params.id);
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
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({
        task: {
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
        },
      });
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
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
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
    .query(`SELECT * FROM contacts ${where} ORDER BY created_at DESC`, values)
    .then(result => res.json({ contacts: result.rows }))
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
    createdAt: new Date().toISOString(),
  };
  if (!pool) {
    contacts.unshift(contact);
    return res.json({ contact });
  }
  pool
    .query(
      `INSERT INTO contacts (id, name, phone, email, company, office_number, address, designation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [contact.id, contact.name, contact.phone, contact.email, contact.company, contact.officeNumber, contact.address, contact.designation]
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
              created_at=created_at
            WHERE id=$8
            RETURNING *`,
      [body.name, body.phone, body.email, body.company, body.officeNumber, body.address, body.designation, req.params.id])
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
app.get('/api/users', (_req, res) => {
  res.json(users);
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
  users.push(user);
  res.json(user);
});

// Analytics stub
app.get('/api/analytics', (_req, res) => {
  res.json({
    revenue: { total: 2500000, change: 12, data: [{ month: 'Jan', amount: 300000 }, { month: 'Feb', amount: 320000 }] },
    projects: { total: projects.length, active: projects.filter(p => p.status === 'IN_PROGRESS').length, completed: projects.filter(p => p.status === 'COMPLETED').length, data: [{ status: 'IN_PROGRESS', count: 1 }, { status: 'PLANNING', count: 1 }] },
    efficiency: { onTime: 92, delayed: 1, avgDuration: 120 },
    costs: { data: [{ category: 'Labor', amount: 120000 }, { category: 'Materials', amount: 95000 }] },
  });
});

// Budget summary/items stub
app.get('/api/budget/summary', (_req, res) => {
  res.json({ totalBudget: 500000, totalSpent: 220000, totalRemaining: 280000, overBudgetItems: 1 });
});

app.get('/api/budget/items', (_req, res) => {
  res.json([
    { id: 'b1', category: 'Labor', budgeted: 200000, actual: 180000, variance: 20000, percentage: 40 },
    { id: 'b2', category: 'Materials', budgeted: 150000, actual: 120000, variance: 30000, percentage: 30 },
  ]);
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
app.get('/api/daily-logs', (_req, res) => {
  res.json({ logs: dailyLogs });
});

app.post('/api/daily-logs', (req, res) => {
  const body = req.body || {};
  const log = {
    id: randomUUID(),
    projectName: body.projectName || '',
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
  dailyLogs.push(log);
  res.json(log);
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

app.post('/api/documents/upload', upload.single('file'), handleDocumentUpload);
// Alias without /api in case baseURL already includes /api
app.post('/documents/upload', upload.single('file'), handleDocumentUpload);

// Project doc pages (lightweight wiki/notes per project)
app.get('/api/projects/:id/doc-pages', (req, res) => {
  const pages = projectDocPages[req.params.id] || [];
  res.json({ pages });
});

app.post('/api/projects/:id/doc-pages', (req, res) => {
  const body = req.body || {};
  const page = {
    id: randomUUID(),
    title: body.title || 'Untitled Page',
    content: body.content || '',
    images: Array.isArray(body.images) ? body.images : [],
    updatedAt: new Date().toISOString(),
  };
  projectDocPages[req.params.id] = projectDocPages[req.params.id] || [];
  projectDocPages[req.params.id].unshift(page);
  res.json({ page });
});

app.put('/api/projects/:id/doc-pages/:pageId', (req, res) => {
  const body = req.body || {};
  const pages = projectDocPages[req.params.id] || [];
  const page = pages.find(p => p.id === req.params.pageId);
  if (!page) return res.status(404).json({ message: 'Not found' });
  page.title = body.title ?? page.title;
  page.content = body.content ?? page.content;
  page.images = Array.isArray(body.images) ? body.images : page.images;
  page.updatedAt = new Date().toISOString();
  res.json({ page });
});

app.delete('/api/projects/:id/doc-pages/:pageId', (req, res) => {
  const pages = projectDocPages[req.params.id] || [];
  const idx = pages.findIndex(p => p.id === req.params.pageId);
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  const [removed] = pages.splice(idx, 1);
  res.json({ page: removed });
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
    .then(result => res.json({ inspections: result.rows }))
    .catch(() => res.json({ inspections }));
});

app.post('/api/inspections', (req, res) => {
  const body = req.body || {};
  const inspection = {
    id: randomUUID(),
    title: body.title || body.type || 'Inspection',
    type: body.type || 'general',
    status: body.status || 'scheduled',
    date: body.date || body.scheduledDate || '',
    scheduledDate: body.scheduledDate || body.date || '',
    projectName: body.projectName || '',
    projectId: body.projectId || '',
    inspector: body.inspector || '',
    notes: body.notes || '',
    completedDate: body.completedDate || '',
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
        inspection.date,
        inspection.scheduledDate,
        inspection.projectName,
        inspection.projectId,
        inspection.inspector,
        inspection.notes,
        inspection.completedDate,
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
            body.date ?? current.date,
            body.scheduledDate ?? current.scheduled_date,
            body.projectName ?? current.project_name,
            body.projectId ?? current.project_id,
            body.inspector ?? current.inspector,
            body.notes ?? current.notes,
            body.completedDate ?? current.completed_date,
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
    .then(result => res.json({ equipment: result.rows }))
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
    purchaseDate: body.purchaseDate || '',
    purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : 0,
    lastService: body.lastService || '',
    nextMaintenance: body.nextMaintenance || '',
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
        item.purchaseDate,
        item.purchasePrice,
        item.lastService,
        item.nextMaintenance,
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
      purchaseDate: body.purchaseDate ?? item.purchaseDate,
      purchasePrice: body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : item.purchasePrice,
      lastService: body.lastService ?? item.lastService,
      nextMaintenance: body.nextMaintenance ?? item.nextMaintenance,
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
            body.purchaseDate ?? current.purchase_date,
            body.purchasePrice !== undefined ? Number(body.purchasePrice) || 0 : current.purchase_price,
            body.lastService ?? current.last_service,
            body.nextMaintenance ?? current.next_maintenance,
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
    .then(result => res.json({ proposals: result.rows }))
    .catch(() => res.json({ proposals }));
});

app.get('/api/projects/:id/proposals', (req, res) => {
  if (!pool) {
    const list = proposals.filter(p => p.projectId === req.params.id);
    return res.json({ proposals: list });
  }
  pool
    .query('SELECT * FROM proposals WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id])
    .then(result => res.json({ proposals: result.rows }))
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
      `INSERT INTO proposals (id, title, client_name, project_id, project_name, amount, status, valid_until, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        proposal.id,
        proposal.title,
        proposal.clientName,
        proposal.projectId,
        proposal.projectName,
        proposal.amount,
        proposal.status,
        proposal.validUntil,
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
      `INSERT INTO proposals (id, title, client_name, project_id, project_name, amount, status, valid_until, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        proposal.id,
        proposal.title,
        proposal.clientName,
        proposal.projectId,
        proposal.projectName,
        proposal.amount,
        proposal.status,
        proposal.validUntil,
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
             title=$1, client_name=$2, project_id=$3, project_name=$4, amount=$5, status=$6, valid_until=$7
           WHERE id=$8
           RETURNING *`,
          [
            body.title ?? current.title,
            body.clientName ?? current.client_name,
            body.projectId ?? current.project_id,
            body.projectName ?? current.project_name,
            body.amount !== undefined ? parseFloat(body.amount) || 0 : current.amount,
            body.status ?? current.status,
            body.validUntil ?? current.valid_until,
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
    .then(result => res.json({ invoices: result.rows }))
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
    return res.json({ event });
  }
  pool
    .query(
      `INSERT INTO schedule_events (id, title, project_id, project_name, type, start_date, end_date, assignee, description, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
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
      ]
    )
    .then(result => res.json({ event: result.rows[0] }))
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
        .then(updateResult => res.json({ event: updateResult.rows[0] }));
    })
    .catch(() => res.status(500).json({ message: 'Update failed' }));
});

app.delete('/api/schedule/events/:id', (req, res) => {
  if (!pool) {
    const idx = scheduleEvents.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = scheduleEvents.splice(idx, 1);
    return res.json({ event: removed });
  }
  pool
    .query('DELETE FROM schedule_events WHERE id = $1 RETURNING *', [req.params.id])
    .then(result => {
      const row = result.rows[0];
      if (!row) return res.status(404).json({ message: 'Not found' });
      res.json({ event: row });
    })
    .catch(() => res.status(500).json({ message: 'Delete failed' }));
});

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
