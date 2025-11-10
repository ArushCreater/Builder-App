const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;

/**
 * Budget Lambda Function
 * Handles CRUD operations for project budget items
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const pathParameters = event.pathParameters || {};
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.requestContext.authorizer.userId;
  const userRole = event.requestContext.authorizer.role;
  const projectId = pathParameters.projectId;

  try {
    // Verify project access
    if (projectId) {
      const hasAccess = await verifyProjectAccess(projectId, userId, userRole);
      if (!hasAccess) {
        return response(403, { error: 'Not authorized to access this project' });
      }
    }

    // Route handling
    if (method === 'GET' && projectId && !pathParameters.itemId) {
      return await getProjectBudget(projectId);
    } else if (method === 'GET' && projectId && pathParameters.itemId) {
      return await getBudgetItemById(projectId, pathParameters.itemId);
    } else if (method === 'POST' && projectId) {
      return await createBudgetItem(projectId, body);
    } else if (method === 'PUT' && projectId && pathParameters.itemId) {
      return await updateBudgetItem(projectId, pathParameters.itemId, body);
    } else if (method === 'DELETE' && projectId && pathParameters.itemId) {
      return await deleteBudgetItem(projectId, pathParameters.itemId);
    } else {
      return response(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};

/**
 * Verify user has access to project
 */
async function verifyProjectAccess(projectId, userId, userRole) {
  if (userRole === 'ADMIN') {
    return true;
  }

  const result = await dynamodb
    .get({
      TableName: PROJECTS_TABLE,
      Key: { id: projectId },
    })
    .promise();

  if (!result.Item) {
    return false;
  }

  return result.Item.ownerId === userId;
}

/**
 * Get all budget items for a project
 */
async function getProjectBudget(projectId) {
  const result = await dynamodb
    .query({
      TableName: BUDGET_TABLE,
      IndexName: 'projectId-index',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId,
      },
    })
    .promise();

  const items = result.Items || [];

  // Calculate totals
  const totalBudget = items.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);
  const totalActual = items.reduce((sum, item) => sum + (item.actualAmount || 0), 0);

  return response(200, {
    items,
    summary: {
      totalBudget,
      totalActual,
      variance: totalBudget - totalActual,
      percentUsed: totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0,
    },
  });
}

/**
 * Get budget item by ID
 */
async function getBudgetItemById(projectId, itemId) {
  const result = await dynamodb
    .get({
      TableName: BUDGET_TABLE,
      Key: { id: itemId },
    })
    .promise();

  if (!result.Item || result.Item.projectId !== projectId) {
    return response(404, { error: 'Budget item not found' });
  }

  return response(200, { item: result.Item });
}

/**
 * Create budget item
 */
async function createBudgetItem(projectId, body) {
  const { category, description, budgetedAmount, actualAmount } = body;

  if (!category || budgetedAmount === undefined) {
    return response(400, { error: 'Category and budgeted amount are required' });
  }

  const item = {
    id: uuidv4(),
    projectId,
    category,
    description: description || null,
    budgetedAmount: parseFloat(budgetedAmount),
    actualAmount: actualAmount !== undefined ? parseFloat(actualAmount) : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: BUDGET_TABLE,
      Item: item,
    })
    .promise();

  return response(201, { item });
}

/**
 * Update budget item
 */
async function updateBudgetItem(projectId, itemId, body) {
  // Get existing item
  const existingResult = await dynamodb
    .get({
      TableName: BUDGET_TABLE,
      Key: { id: itemId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Budget item not found' });
  }

  // Build update expression
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = ['category', 'description', 'budgetedAmount', 'actualAmount'];

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updateExpressions.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      const value =
        field === 'budgetedAmount' || field === 'actualAmount'
          ? parseFloat(body[field])
          : body[field];
      expressionAttributeValues[`:${field}`] = value;
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
    TableName: BUDGET_TABLE,
    Key: { id: itemId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();

  return response(200, { item: result.Attributes });
}

/**
 * Delete budget item
 */
async function deleteBudgetItem(projectId, itemId) {
  // Get existing item
  const existingResult = await dynamodb
    .get({
      TableName: BUDGET_TABLE,
      Key: { id: itemId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Budget item not found' });
  }

  await dynamodb
    .delete({
      TableName: BUDGET_TABLE,
      Key: { id: itemId },
    })
    .promise();

  return response(200, { message: 'Budget item deleted successfully' });
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
