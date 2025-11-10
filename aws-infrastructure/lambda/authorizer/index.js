const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Lambda Authorizer for API Gateway
 * Validates JWT tokens and returns IAM policy
 */
exports.handler = async (event) => {
  console.log('Authorizer invoked:', JSON.stringify(event, null, 2));

  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    console.log('Token decoded:', decoded);

    // Generate IAM policy
    const policy = generatePolicy(decoded.id, 'Allow', event.methodArn, decoded);

    return policy;
  } catch (error) {
    console.error('Token validation failed:', error.message);
    throw new Error('Unauthorized');
  }
};

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(principalId, effect, resource, context) {
  const authResponse = {
    principalId,
  };

  if (effect && resource) {
    // Extract the API Gateway ARN parts
    const arnParts = resource.split(':');
    const apiGatewayArnPart = arnParts[5];
    const [apiId, stage] = apiGatewayArnPart.split('/');

    // Create a wildcard resource that allows all methods on this API
    const wildcardResource = `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${apiId}/${stage}/*/*`;

    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: wildcardResource,
        },
      ],
    };
    authResponse.policyDocument = policyDocument;
  }

  // Add user context to be passed to Lambda functions
  authResponse.context = {
    userId: String(context.id),
    email: String(context.email),
    role: String(context.role),
  };

  return authResponse;
}
