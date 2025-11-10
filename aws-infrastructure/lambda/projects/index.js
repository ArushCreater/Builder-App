const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;

/**
 * Projects Lambda Function
 * Handles CRUD operations for projects
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const pathParameters = event.pathParameters || {};
  const queryParameters = event.queryStringParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.requestContext.authorizer.userId;
  const userRole = event.requestContext.authorizer.role;

  try {
    // Route handling
    if (method === 'GET' && !pathParameters.id) {
      return await getAllProjects(queryParameters, userId, userRole);
    } else if (method === 'GET' && pathParameters.id) {
      return await getProjectById(pathParameters.id, userId, userRole);
    } else if (method === 'POST') {
      return await createProject(body, userId);
    } else if (method === 'PUT' && pathParameters.id) {
      return await updateProject(pathParameters.id, body, userId, userRole);
    } else if (method === 'DELETE' && pathParameters.id) {
      return await deleteProject(pathParameters.id, userId, userRole);
    } else {
      return response(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};

/**
 * Get all projects
 */
async function getAllProjects(queryParams, userId, userRole) {
  const { status, search } = queryParams;

  let params = {
    TableName: PROJECTS_TABLE,
  };

  // If not admin, filter by owner
  if (userRole !== 'ADMIN') {
    params.IndexName = 'ownerId-index';
    params.KeyConditionExpression = 'ownerId = :ownerId';
    params.ExpressionAttributeValues = {
      ':ownerId': userId,
    };
  }

  // Filter by status if provided
  if (status && status !== 'all') {
    if (params.ExpressionAttributeValues) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues[':status'] = status.toUpperCase();
    } else {
      params.IndexName = 'status-index';
      params.KeyConditionExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues = { ':status': status.toUpperCase() };
    }
  }

  const result = params.KeyConditionExpression
    ? await dynamodb.query(params).promise()
    : await dynamodb.scan(params).promise();

  let projects = result.Items || [];

  // Client-side search if needed
  if (search) {
    const searchLower = search.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
    );
  }

  return response(200, { projects });
}

/**
 * Get project by ID
 */
async function getProjectById(projectId, userId, userRole) {
  const result = await dynamodb
    .get({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
    })
    .promise();

  if (!result.Item) {
    return response(404, { error: 'Project not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && result.Item.ownerId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  return response(200, { project: result.Item });
}

/**
 * Create project
 */
async function createProject(body, userId) {
  const {
    name,
    description,
    type,
    address,
    city,
    state,
    zipCode,
    startDate,
    endDate,
    estimatedBudget,
  } = body;

  if (!name || !type || !address || !city || !state || !zipCode) {
    return response(400, { error: 'Missing required fields' });
  }

  const project = {
    id: uuidv4(),
    name,
    description: description || null,
    type,
    status: 'PLANNING',
    address,
    city,
    state,
    zipCode,
    startDate: startDate || null,
    endDate: endDate || null,
    estimatedBudget: estimatedBudget || 0,
    actualCost: 0,
    ownerId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: PROJECTS_TABLE,
      Item: project,
    })
    .promise();

  return response(201, { project });
}

/**
 * Update project
 */
async function updateProject(projectId, body, userId, userRole) {
  // Get existing project
  const existingResult = await dynamodb
    .get({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
    })
    .promise();

  if (!existingResult.Item) {
    return response(404, { error: 'Project not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingResult.Item.ownerId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  // Build update expression
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = [
    'name',
    'description',
    'type',
    'status',
    'address',
    'city',
    'state',
    'zipCode',
    'startDate',
    'endDate',
    'estimatedBudget',
    'actualCost',
  ];

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = body[field];
    }
  });

  if (updateExpressions.length === 0) {
    return response(400, { error: 'No fields to update' });
  }

  // Always update updatedAt
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  const params = {
    TableName: PROJECTS_TABLE,
    Key: { id: projectId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();

  return response(200, { project: result.Attributes });
}

/**
 * Delete project
 */
async function deleteProject(projectId, userId, userRole) {
  // Get existing project
  const existingResult = await dynamodb
    .get({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
    })
    .promise();

  if (!existingResult.Item) {
    return response(404, { error: 'Project not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingResult.Item.ownerId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  await dynamodb
    .delete({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
    })
    .promise();

  return response(200, { message: 'Project deleted successfully' });
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
