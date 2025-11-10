# Fixes Summary

## Issues Fixed

### 1. ✅ LeadsPage.tsx:290 - "leads.map is not a function" Error

**Problem:** The Lambda function returns leads wrapped in an object `{ leads: [...] }`, but the frontend was expecting an array directly.

**Solution:**
- Updated LeadsPage.tsx to properly extract the leads array from the response object
- Changed `useQuery` to expect `{ leads: Lead[] }` type
- Added proper empty state handling when no leads are found
- File: `web/src/pages/leads/LeadsPage.tsx`

### 2. ✅ API 403 Forbidden Error - "Permission denied: User is not authorized"

**Problem:** The Lambda authorizer was generating an incorrect IAM policy for API Gateway. The resource ARN pattern wasn't properly formatted, causing API Gateway to reject authorized requests.

**Solution:**
- Fixed the `generatePolicy` function in the authorizer to properly construct wildcard ARNs
- Changed from simple string manipulation to proper ARN parsing
- Ensured context values are converted to strings for proper transmission to Lambda functions
- File: `aws-infrastructure/lambda/authorizer/index.js`

### 3. ✅ Created Deployment Script

**Added:** New script to quickly update the authorizer Lambda without full CloudFormation deployment
- File: `aws-infrastructure/scripts/update-authorizer-lambda.sh`

## What You Need to Do Next

### Step 1: Deploy the Updated Authorizer Lambda

Run this command from the `aws-infrastructure` directory:

```bash
./scripts/update-authorizer-lambda.sh dev
```

This will:
1. Package the updated authorizer code
2. Upload it to S3
3. Update the Lambda function in AWS
4. Takes about 30 seconds

**Wait 10-15 seconds** after the script completes for the Lambda to fully update.

### Step 2: Clear Browser Cache and Refresh

After deploying the authorizer:
1. Open your browser's Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Cmd+Shift+R on Mac)

### Step 3: Test the Fixes

1. **Test Login:**
   - Navigate to the login page
   - Login with your credentials
   - Verify you're not getting 403 errors

2. **Test Leads Page:**
   - Navigate to the Leads page
   - Verify leads are displaying correctly
   - Try creating a new lead

3. **Test Projects Page:**
   - Navigate to the Projects page
   - Try creating a new project
   - Verify no 403 errors

4. **Test Dashboard:**
   - Navigate to the dashboard
   - Verify data is loading correctly

## Technical Details

### Authorizer Fix Details

**Before:**
```javascript
Resource: resource.split('/').slice(0, -1).join('/') + '/*'
```
This simple string manipulation wasn't creating valid ARNs.

**After:**
```javascript
const arnParts = resource.split(':');
const apiGatewayArnPart = arnParts[5];
const [apiId, stage] = apiGatewayArnPart.split('/');
const wildcardResource = `arn:aws:execute-api:${arnParts[3]}:${arnParts[4]}:${apiId}/${stage}/*/*`;
```
This properly parses the ARN and creates a valid wildcard pattern: `arn:aws:execute-api:region:account:apiId/stage/*/*`

### LeadsPage Fix Details

**Before:**
```typescript
const { data: leads, isLoading } = useQuery({
  queryFn: () => apiClient.get<Lead[]>(`/leads?${params}`),
});
// leads?.map(...) // leads is actually { leads: [...] }, not an array
```

**After:**
```typescript
const { data: leadsData, isLoading } = useQuery({
  queryFn: () => apiClient.get<{ leads: Lead[] }>(`/leads?${params}`),
});
const leads = leadsData?.leads || [];
// leads.map(...) // leads is now always an array
```

## Additional Notes

### Other Pages Status
- **ProjectsPage:** ✅ Already correctly implemented
- **DashboardHome:** ✅ Already correctly implemented
- **Other pages:** May need similar fixes if they expect arrays directly from Lambda functions

### Future Improvements
If you encounter similar issues on other pages, use the same pattern:
1. Update the type to expect `{ data: Type[] }` instead of `Type[]`
2. Extract the data: `const items = response?.data || []`
3. Add proper empty state handling

## If Issues Persist

### Check CloudWatch Logs
```bash
# For authorizer logs
aws logs tail /aws/lambda/buildertrend-authorizer-dev --follow

# For other Lambda logs
aws logs tail /aws/lambda/buildertrend-projects-dev --follow
```

### Check API Gateway
Verify the API Gateway deployment in AWS Console:
1. Go to API Gateway → buildertrend-api-dev
2. Check the "Authorizers" section
3. Verify the authorizer is attached to protected routes

### Verify JWT Token
Check if your JWT token is valid:
1. Open Browser DevTools → Application/Storage
2. Check localStorage for 'auth_token'
3. Decode the token at jwt.io to verify it's not expired

## Need Help?

If you're still experiencing issues after following these steps:
1. Check the error messages in the browser console
2. Check CloudWatch logs for Lambda errors
3. Verify AWS credentials and permissions
4. Ensure the CloudFormation stack deployed successfully

## Summary of Changes

```
✅ Fixed Lambda authorizer policy generation
✅ Fixed LeadsPage response handling
✅ Added deployment script for quick updates
✅ Committed and pushed all changes
```

All changes are now in the `claude/buildertrend-clone-app-011CUunfowDSjCuXKo458SLK` branch.
