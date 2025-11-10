const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;
const FILE_BUCKET = process.env.FILE_BUCKET;

/**
 * Documents Lambda Function
 * Handles CRUD operations for project documents
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
    if (method === 'GET' && projectId && !pathParameters.documentId) {
      return await getProjectDocuments(projectId);
    } else if (method === 'GET' && projectId && pathParameters.documentId) {
      return await getDocumentById(projectId, pathParameters.documentId);
    } else if (method === 'POST' && projectId) {
      return await createDocument(projectId, body, userId);
    } else if (method === 'PUT' && projectId && pathParameters.documentId) {
      return await updateDocument(projectId, pathParameters.documentId, body);
    } else if (method === 'DELETE' && projectId && pathParameters.documentId) {
      return await deleteDocument(projectId, pathParameters.documentId);
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
 * Get all documents for a project
 */
async function getProjectDocuments(projectId) {
  const result = await dynamodb
    .query({
      TableName: DOCUMENTS_TABLE,
      IndexName: 'projectId-index',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId,
      },
    })
    .promise();

  const documents = result.Items || [];

  // Generate presigned URLs for documents
  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      if (doc.fileKey) {
        try {
          const url = await s3.getSignedUrlPromise('getObject', {
            Bucket: FILE_BUCKET,
            Key: doc.fileKey,
            Expires: 3600, // 1 hour
          });
          return { ...doc, url };
        } catch (error) {
          console.error('Error generating presigned URL:', error);
          return doc;
        }
      }
      return doc;
    })
  );

  return response(200, { documents: documentsWithUrls });
}

/**
 * Get document by ID
 */
async function getDocumentById(projectId, documentId) {
  const result = await dynamodb
    .get({
      TableName: DOCUMENTS_TABLE,
      Key: { id: documentId },
    })
    .promise();

  if (!result.Item || result.Item.projectId !== projectId) {
    return response(404, { error: 'Document not found' });
  }

  const doc = result.Item;

  // Generate presigned URL if file exists
  if (doc.fileKey) {
    try {
      const url = await s3.getSignedUrlPromise('getObject', {
        Bucket: FILE_BUCKET,
        Key: doc.fileKey,
        Expires: 3600,
      });
      doc.url = url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
    }
  }

  return response(200, { document: doc });
}

/**
 * Create document
 */
async function createDocument(projectId, body, userId) {
  const { name, type, category, fileKey, fileSize, mimeType } = body;

  if (!name || !type) {
    return response(400, { error: 'Name and type are required' });
  }

  const document = {
    id: uuidv4(),
    projectId,
    name,
    type, // 'file', 'link', 'note'
    category: category || 'GENERAL',
    fileKey: fileKey || null,
    fileSize: fileSize || null,
    mimeType: mimeType || null,
    uploadedBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb
    .put({
      TableName: DOCUMENTS_TABLE,
      Item: document,
    })
    .promise();

  return response(201, { document });
}

/**
 * Update document
 */
async function updateDocument(projectId, documentId, body) {
  // Get existing document
  const existingResult = await dynamodb
    .get({
      TableName: DOCUMENTS_TABLE,
      Key: { id: documentId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Document not found' });
  }

  // Build update expression
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const allowedFields = ['name', 'category', 'type'];

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
    TableName: DOCUMENTS_TABLE,
    Key: { id: documentId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  const result = await dynamodb.update(params).promise();

  return response(200, { document: result.Attributes });
}

/**
 * Delete document
 */
async function deleteDocument(projectId, documentId) {
  // Get existing document
  const existingResult = await dynamodb
    .get({
      TableName: DOCUMENTS_TABLE,
      Key: { id: documentId },
    })
    .promise();

  if (!existingResult.Item || existingResult.Item.projectId !== projectId) {
    return response(404, { error: 'Document not found' });
  }

  const doc = existingResult.Item;

  // Delete file from S3 if exists
  if (doc.fileKey) {
    try {
      await s3
        .deleteObject({
          Bucket: FILE_BUCKET,
          Key: doc.fileKey,
        })
        .promise();
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Continue with document deletion even if S3 delete fails
    }
  }

  // Delete document from DynamoDB
  await dynamodb
    .delete({
      TableName: DOCUMENTS_TABLE,
      Key: { id: documentId },
    })
    .promise();

  return response(200, { message: 'Document deleted successfully' });
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
