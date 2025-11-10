const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME;

/**
 * File Upload Lambda Function
 * Handles file uploads to S3 with signed URLs
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : {};
  const userId = event.requestContext.authorizer.userId;

  try {
    if (method === 'POST' && event.path.endsWith('/upload/presigned-url')) {
      return await getPresignedUrl(body, userId);
    } else if (method === 'POST' && event.path.endsWith('/upload')) {
      return await uploadFile(body, userId);
    } else if (method === 'DELETE') {
      return await deleteFile(body, userId);
    } else {
      return response(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Error:', error);
    return response(500, { error: error.message || 'Internal server error' });
  }
};

/**
 * Get presigned URL for direct upload from browser
 */
async function getPresignedUrl(body, userId) {
  const { fileName, fileType, folder = 'general' } = body;

  if (!fileName || !fileType) {
    return response(400, { error: 'fileName and fileType required' });
  }

  // Generate unique file key
  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;
  const key = `${folder}/${userId}/${uniqueFileName}`;

  // Generate presigned URL for PUT operation
  const presignedUrl = s3.getSignedUrl('putObject', {
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
    Expires: 300, // URL expires in 5 minutes
  });

  // Generate public URL
  const publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

  return response(200, {
    uploadUrl: presignedUrl,
    fileUrl: publicUrl,
    key,
  });
}

/**
 * Upload file directly (for base64 encoded files)
 */
async function uploadFile(body, userId) {
  const { fileName, fileType, fileData, folder = 'general' } = body;

  if (!fileName || !fileType || !fileData) {
    return response(400, { error: 'fileName, fileType, and fileData required' });
  }

  // Generate unique file key
  const fileExtension = fileName.split('.').pop();
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;
  const key = `${folder}/${userId}/${uniqueFileName}`;

  // Decode base64 if needed
  let buffer;
  if (fileData.startsWith('data:')) {
    // Remove data URL prefix
    const base64Data = fileData.split(',')[1];
    buffer = Buffer.from(base64Data, 'base64');
  } else {
    buffer = Buffer.from(fileData, 'base64');
  }

  // Upload to S3
  await s3
    .putObject({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: fileType,
      ACL: 'public-read',
    })
    .promise();

  const fileUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;

  return response(201, {
    fileUrl,
    key,
    fileName: uniqueFileName,
  });
}

/**
 * Delete file from S3
 */
async function deleteFile(body, userId) {
  const { key } = body;

  if (!key) {
    return response(400, { error: 'key required' });
  }

  // Verify the file belongs to the user (check if key starts with userId)
  if (!key.includes(`/${userId}/`)) {
    return response(403, { error: 'Not authorized to delete this file' });
  }

  await s3
    .deleteObject({
      Bucket: BUCKET_NAME,
      Key: key,
    })
    .promise();

  return response(200, { message: 'File deleted successfully' });
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
