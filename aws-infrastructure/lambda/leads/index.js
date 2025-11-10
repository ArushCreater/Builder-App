const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const LEADS_TABLE = process.env.LEADS_TABLE;

/**
 * Leads Lambda Function
 * Handles CRUD operations for leads
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
      return await getAllLeads(queryParameters, userId, userRole);
    } else if (method === 'GET' && pathParameters.id) {
      return await getLeadById(pathParameters.id, userId, userRole);
    } else if (method === 'POST') {
      return await createLead(body, userId);
    } else if (method === 'PUT' && pathParameters.id) {
      return await updateLead(pathParameters.id, body, userId, userRole);
    } else if (method === 'DELETE' && pathParameters.id) {
      return await deleteLead(pathParameters.id, userId, userRole);
    } else {
      return response(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};

/**
 * Get all leads
 */
async function getAllLeads(queryParams, userId, userRole) {
  const { status, search } = queryParams;

  let params = {
    TableName: LEADS_TABLE,
  };

  // If not admin, filter by assignedTo
  if (userRole !== 'ADMIN') {
    params.IndexName = 'assignedToId-index';
    params.KeyConditionExpression = 'assignedToId = :assignedToId';
    params.ExpressionAttributeValues = {
      ':assignedToId': userId,
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

  let leads = result.Items || [];

  // Client-side search if needed
  if (search) {
    const searchLower = search.toLowerCase();
    leads = leads.filter(
      (l) =>
        l.firstName.toLowerCase().includes(searchLower) ||
        l.lastName.toLowerCase().includes(searchLower) ||
        l.email?.toLowerCase().includes(searchLower) ||
        l.phone?.includes(searchLower)
    );
  }

  return response(200, { leads });
}

/**
 * Get lead by ID
 */
async function getLeadById(leadId, userId, userRole) {
  const result = await dynamodb
    .get({
      TableName: LEADS_TABLE,
      Key: { id: leadId },
    })
    .promise();

  if (!result.Item) {
    return response(404, { error: 'Lead not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && result.Item.assignedToId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  return response(200, { lead: result.Item });
}

/**
 * Create lead
 */
async function createLead(body, userId) {
  const {
    firstName,
    lastName,
    email,
    phone,
    source,
    estimatedValue,
    notes,
  } = body;

  if (!firstName || !lastName || !email || !phone) {
    return response(400, { error: 'Missing required fields' });
  }

  const lead = {
    id: uuidv4(),
    firstName,
    lastName,
    email,
    phone,
    status: 'NEW',
    source: source || null,
    estimatedValue: estimatedValue || 0,
    notes: notes || null,
    assignedToId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: LEADS_TABLE,
      Item: lead,
    })
    .promise();

  return response(201, { lead });
}

/**
 * Update lead
 */
async function updateLead(leadId, body, userId, userRole) {
  // Get existing lead
  const existingResult = await dynamodb
    .get({
      TableName: LEADS_TABLE,
      Key: { id: leadId },
    })
    .promise();

  if (!existingResult.Item) {
    return response(404, { error: 'Lead not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingResult.Item.assignedToId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  // Build update expression
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'status',
    'source',
    'estimatedValue',
    'notes',
    'assignedToId',
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
    TableName: LEADS_TABLE,
    Key: { id: leadId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();

  return response(200, { lead: result.Attributes });
}

/**
 * Delete lead
 */
async function deleteLead(leadId, userId, userRole) {
  // Get existing lead
  const existingResult = await dynamodb
    .get({
      TableName: LEADS_TABLE,
      Key: { id: leadId },
    })
    .promise();

  if (!existingResult.Item) {
    return response(404, { error: 'Lead not found' });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && existingResult.Item.assignedToId !== userId) {
    return response(403, { error: 'Not authorized' });
  }

  await dynamodb
    .delete({
      TableName: LEADS_TABLE,
      Key: { id: leadId },
    })
    .promise();

  return response(200, { message: 'Lead deleted successfully' });
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
