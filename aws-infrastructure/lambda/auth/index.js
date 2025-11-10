const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = process.env.USERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Auth Lambda Function
 * Handles login, register, and user management
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const path = event.path || event.requestContext?.resourcePath;
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};

  try {
    // Route handling
    if (path.endsWith('/login') && method === 'POST') {
      return await login(body);
    } else if (path.endsWith('/register') && method === 'POST') {
      return await register(body);
    } else if (path.endsWith('/me') && method === 'GET') {
      const userId = event.requestContext.authorizer.userId;
      return await getCurrentUser(userId);
    } else {
      return response(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};

/**
 * Login user
 */
async function login(body) {
  const { email, password } = body;

  if (!email || !password) {
    return response(400, { error: 'Email and password required' });
  }

  // Demo mode: Allow login with demo credentials without database check
  if (email === 'demo@buildertrend.com' && password === 'demo123') {
    const demoUser = {
      id: 'demo-user-id',
      email: 'demo@buildertrend.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'ADMIN',
      phone: '555-0100',
      company: 'BuilderTrend Demo',
      status: 'ACTIVE',
      avatar: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const token = jwt.sign(
      { id: demoUser.id, email: demoUser.email, role: demoUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('Demo user logged in successfully');

    return response(200, {
      user: demoUser,
      token,
    });
  }

  // Find user by email
  const result = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    })
    .promise();

  const user = result.Items?.[0];

  if (!user) {
    return response(401, { error: 'Invalid credentials' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    return response(401, { error: 'Invalid credentials' });
  }

  // Check if user is active
  if (user.status !== 'ACTIVE') {
    return response(403, { error: 'Account is not active' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Remove password from response
  delete user.password;

  return response(200, {
    user,
    token,
  });
}

/**
 * Register new user
 */
async function register(body) {
  const { email, password, firstName, lastName, role, phone, company } = body;

  if (!email || !password || !firstName || !lastName || !role) {
    return response(400, { error: 'Missing required fields' });
  }

  // Check if user already exists
  const existingUser = await dynamodb
    .query({
      TableName: USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email,
      },
    })
    .promise();

  if (existingUser.Items?.length > 0) {
    return response(400, { error: 'User with this email already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = {
    id: uuidv4(),
    email,
    password: hashedPassword,
    firstName,
    lastName,
    role,
    phone: phone || null,
    company: company || null,
    status: 'ACTIVE',
    avatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: USERS_TABLE,
      Item: user,
    })
    .promise();

  // Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Remove password from response
  delete user.password;

  return response(201, {
    message: 'User registered successfully',
    user,
    token,
  });
}

/**
 * Get current user
 */
async function getCurrentUser(userId) {
  const result = await dynamodb
    .get({
      TableName: USERS_TABLE,
      Key: { id: userId },
    })
    .promise();

  if (!result.Item) {
    return response(404, { error: 'User not found' });
  }

  delete result.Item.password;

  return response(200, { user: result.Item });
}

/**
 * HTTP response helper
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
