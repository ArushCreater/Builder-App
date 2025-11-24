output "alb_url" {
  description = "Public URL of the Elastic Beanstalk environment"
  value       = aws_elastic_beanstalk_environment.api_env.endpoint_url
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint"
  value       = aws_db_instance.postgres.address
}

output "dynamodb_tables" {
  description = "Created DynamoDB table names"
  value = {
    leads    = aws_dynamodb_table.leads.name
    projects = aws_dynamodb_table.projects.name
  }
}

output "files_bucket" {
  description = "S3 bucket for file storage"
  value       = aws_s3_bucket.files.bucket
}
