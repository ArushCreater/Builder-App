const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TASKS_TABLE = process.env.TASKS_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;

/**
 * Tasks Lambda Function
 * Handles CRUD operations for project tasks
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
    if (method === 'GET' && projectId && !pathParameters.taskId) {
      return await getProjectTasks(projectId);
    } else if (method === 'GET' && projectId && pathParameters.taskId) {
      return await getTaskById(projectId, pathParameters.taskId);
    } else if (method === 'POST' && projectId) {
      return await createTask(projectId, body, userId);
    } else if (method === 'PUT' && projectId && pathParameters.taskId) {
      return await updateTask(projectId, pathParameters.taskId, body);
    } else if (method === 'DELETE' && projectId && pathParameters.taskId) {
      return await deleteTask(projectId, pathParameters.taskId);
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
 * Get all tasks for a project
 */
async function getProjectTasks(projectId) {
  const result = await dynamodb
    .query({
      TableName: TASKS_TABLE,
      IndexName: 'projectId-index',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId,
      },
    })
    .promise();

  return response(200, { tasks: result.Items || [] });
}

/**
 * Get task by ID
 */
async function getTaskById(projectId, taskId) {
  const result = await dynamodb
    .get({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    })
    .promise();

  if (!result.Item || result.Item.projectId !== projectId) {
    return response(404, { error: 'Task not found' });
  }

  return response(200, { task: result.Item });
}

/**
 * Create task
 */
async function createTask(projectId, body, userId) {
  const { title, description, status, priority, assignedTo, dueDate } = body;

  if (!title) {
    return response(400, { error: 'Title is required' });
  }

  const task = {
    id: uuidv4(),
    projectId,
    title,
    description: description || null,
    status: status || 'TODO',
    priority: priority || 'MEDIUM',
    assignedTo: assignedTo || null,
    dueDate: dueDate || null,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: TASKS_TABLE,
      Item: task,
    })
    .promise();

  return response(201, { task });
}

/**
 * Update task
 */
async function updateTask(projectId, taskId, body) {
  // Get existing task
  const existingResult = await dynamodb
    .get({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Task not found' });
  }

  // Build update expression
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = [
    'title',
    'description',
    'status',
    'priority',
    'assignedTo',
    'dueDate',
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
    TableName: TASKS_TABLE,
    Key: { id: taskId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();

  return response(200, { task: result.Attributes });
}

/**
 * Delete task
 */
async function deleteTask(projectId, taskId) {
  // Get existing task
  const existingResult = await dynamodb
    .get({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Task not found' });
  }

  await dynamodb
    .delete({
      TableName: TASKS_TABLE,
      Key: { id: taskId },
    })
    .promise();

  return response(200, { message: 'Task deleted successfully' });
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
