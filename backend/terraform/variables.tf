variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-southeast-2"
}

variable "project_name" {
  description = "Project name, used for naming resources"
  type        = string
  default     = "builder-app"
}

variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.20.0.0/16"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "builder"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
  default     = "ChangeMe123!"
}

variable "api_port" {
  description = "Port your Node/Express API listens on"
  type        = string
  default     = "8081"
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS (comma-joined into env var)"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "files_bucket_name" {
  description = "Optional explicit S3 bucket name for files (must be globally unique). If empty, a unique name will be generated."
  type        = string
  default     = ""
}

variable "deploy_with_s3" {
  description = "Whether to deploy an application bundle from S3"
  type        = bool
  default     = false
}

variable "app_version_bucket" {
  description = "S3 bucket containing the EB application bundle (zip)"
  type        = string
  default     = ""
}

variable "app_version_key" {
  description = "S3 key of the EB application bundle (zip)"
  type        = string
  default     = ""
}
