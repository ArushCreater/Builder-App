const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 8081;
const dbUrl = process.env.DATABASE_URL;

let pool;
if (dbUrl) {
  pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
}

// CORS handling based on env
const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsEnv
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowAll = allowedOrigins.includes('*') || allowedOrigins.length === 0;

const corsOptions = {
  origin: allowAll
    ? (origin, callback) => callback(null, origin || '*')
    : (origin, callback) => {
        if (!origin) return callback(null, false);
        if (allowedOrigins.includes(origin)) return callback(null, origin);
        return callback(new Error('Not allowed by CORS'));
      },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(morgan('tiny'));
app.use(express.json());
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
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
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
  { id: 'm-1', name: 'Concrete', description: 'Ready-mix 25 MPa', quantity: 30, unit: 'm3', costPerUnit: 120, totalCost: 3600, supplier: 'BuildCo', projectName: 'Sunrise Apartments', status: 'in-stock' },
  { id: 'm-2', name: 'Steel Rebar', description: 'Grade 500N', quantity: 2, unit: 'ton', costPerUnit: 950, totalCost: 1900, supplier: 'SteelWorks', projectName: 'Downtown Office', status: 'ordered' },
];

const selections = [
  { id: 's-1', category: 'Cabinetry', item: 'Kitchen Cabinets', description: 'Shaker style', choice: 'Matte White', cost: 4500, status: 'pending', projectName: 'Sunrise Apartments', clientName: 'John Smith', dueDate: '2024-05-01' },
  { id: 's-2', category: 'Flooring', item: 'Flooring', description: 'Engineered timber', choice: 'Oak', cost: 8200, status: 'approved', projectName: 'Downtown Office', clientName: 'Jane Doe', dueDate: '2024-04-15' },
];

const dailyLogs = [
  { id: 'd-1', projectName: 'Sunrise Apartments', date: '2024-03-01', weather: 'Sunny', temperature: '22C', workPerformed: 'Site prep complete', crewSize: 8, hoursWorked: 8, equipmentUsed: 'Excavator', materialsReceived: 'Gravel', notes: 'Good progress', photos: 0, createdBy: 'Admin' },
  { id: 'd-2', projectName: 'Downtown Office', date: '2024-03-02', weather: 'Cloudy', temperature: '19C', workPerformed: 'Footings poured', crewSize: 10, hoursWorked: 7.5, equipmentUsed: 'Concrete pump', materialsReceived: 'Rebar', notes: 'No issues', photos: 0, createdBy: 'PM' },
];

const documents = [
  {
    id: 'doc-1',
    name: 'Contract.pdf',
    type: 'pdf',
    category: 'contract',
    size: '2.3 MB',
    projectName: 'Sunrise Apartments',
    uploadedBy: 'Admin User',
    uploadedAt: '2024-02-01',
    url: '#',
  },
];

const bids = [
  { id: 'b-1', vendor: 'ABC Electrical', amount: 55000, status: 'submitted', scope: 'Electrical rough-in' },
  { id: 'b-2', vendor: 'Prime Plumbing', amount: 42000, status: 'review', scope: 'Plumbing rough-in' },
];

const inspections = [
  { id: 'i-1', title: 'Framing Inspection', status: 'scheduled', date: '2024-06-01' },
  { id: 'i-2', title: 'Electrical Inspection', status: 'pending', date: '2024-06-15' },
];

const equipment = [
  { id: 'e-1', name: 'Excavator', status: 'in_use', location: 'Site A', lastService: '2024-02-10' },
  { id: 'e-2', name: 'Scissor Lift', status: 'available', location: 'Yard', lastService: '2024-01-20' },
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
    amount: 55000,
    status: 'sent',
    dueDate: '2024-04-15',
    createdAt: '2024-03-20',
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
        (id, name, description, type, status, address, city, state, zip_code, start_date, end_date, estimated_budget, actual_cost, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
          ownerId: row.owner_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    })
    .catch(() => res.status(404).json({ message: 'Not found' }));
});

app.get('/api/projects/:id/tasks', (_req, res) => {
  res.json({ tasks: [] });
});

app.get('/api/projects/:id/budget', (_req, res) => {
  res.json({ items: [], summary: { totalBudget: 0, totalSpent: 0, totalRemaining: 0, overBudgetItems: 0 } });
});

app.get('/api/projects/:id/documents', (_req, res) => {
  res.json({ documents: [] });
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
app.get('/api/tasks', (_req, res) => {
  res.json(tasks);
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
    dueDate: body.dueDate || '',
    completed: !!body.completed,
  };
  tasks.push(task);
  res.json(task);
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
app.get('/api/materials', (_req, res) => {
  res.json({ materials });
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
    status: body.status || 'in-stock',
  };
  materials.push(material);
  res.json(material);
});

// Selections
app.get('/api/selections', (_req, res) => {
  res.json({ selections });
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
    clientName: body.clientName || '',
    dueDate: body.dueDate || '',
  };
  selections.push(selection);
  res.json(selection);
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
app.get('/api/documents', (_req, res) => {
  res.json({ documents });
});

app.post('/api/documents', (req, res) => {
  const body = req.body || {};
  const doc = {
    id: randomUUID(),
    name: body.name || 'Document',
    type: body.type || 'pdf',
    category: body.category || 'other',
    size: body.size || 'N/A',
    projectName: body.projectName || '',
    uploadedBy: body.uploadedBy || 'System',
    uploadedAt: new Date().toISOString(),
    url: body.url || '#',
  };
  documents.push(doc);
  res.json(doc);
});

// Bids
app.get('/api/bids', (_req, res) => {
  res.json({ bids });
});

app.post('/api/bids', (req, res) => {
  const body = req.body || {};
  const bid = {
    id: randomUUID(),
    vendor: body.vendor || 'Vendor',
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'submitted',
    scope: body.scope || '',
  };
  bids.push(bid);
  res.json(bid);
});

// Inspections
app.get('/api/inspections', (_req, res) => {
  res.json({ inspections });
});

app.post('/api/inspections', (req, res) => {
  const body = req.body || {};
  const inspection = {
    id: randomUUID(),
    title: body.title || 'Inspection',
    status: body.status || 'scheduled',
    date: body.date || '',
  };
  inspections.push(inspection);
  res.json(inspection);
});

// Equipment
app.get('/api/equipment', (_req, res) => {
  res.json({ equipment });
});

app.post('/api/equipment', (req, res) => {
  const body = req.body || {};
  const item = {
    id: randomUUID(),
    name: body.name || 'Equipment',
    status: body.status || 'available',
    location: body.location || '',
    lastService: body.lastService || '',
  };
  equipment.push(item);
  res.json(item);
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
app.get('/api/proposals', (_req, res) => {
  res.json({ proposals });
});

app.post('/api/proposals', (req, res) => {
  const body = req.body || {};
  const proposal = {
    id: randomUUID(),
    title: body.title || 'Proposal',
    clientName: body.clientName || '',
    projectName: body.projectName || '',
    amount: parseFloat(body.amount) || 0,
    status: body.status || 'draft',
    dueDate: body.dueDate || '',
    createdAt: new Date().toISOString(),
  };
  proposals.push(proposal);
  res.json(proposal);
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
