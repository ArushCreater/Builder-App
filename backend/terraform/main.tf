terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_elastic_beanstalk_solution_stack" "node" {
  name_regex  = "64bit Amazon Linux 2.*Node\\.js.*"
  most_recent = true
}

locals {
  name_prefix   = "${var.project_name}-${var.environment}"
  eb_app_name   = "${local.name_prefix}-api"
  eb_env_name   = "${local.name_prefix}-env"
  db_name       = replace(var.project_name, "-", "_")
  cors_origins  = join(",", var.cors_allowed_origins)
}

# --- Networking (simple public-subnet setup for speed) ---
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  map_public_ip_on_launch = true
  availability_zone       = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${local.name_prefix}-public-${count.index + 1}"
  }
}

data "aws_availability_zones" "available" {}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public_assoc" {
  count          = length(aws_subnet.public)
  route_table_id = aws_route_table.public.id
  subnet_id      = aws_subnet.public[count.index].id
}

# --- Security Groups ---
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "ALB security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "eb" {
  name        = "${local.name_prefix}-eb-sg"
  description = "Elastic Beanstalk EC2 security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port                = 0
    to_port                  = 0
    protocol                 = "-1"
    security_groups          = [aws_security_group.alb.id]
    description              = "From ALB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Postgres access from EB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eb.id]
    description     = "Postgres from EB"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# --- RDS Postgres ---
resource "aws_db_subnet_group" "db_subnets" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = aws_subnet.public[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnets"
  }
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-db"
  allocated_storage       = 20
  engine                  = "postgres"
  instance_class          = var.db_instance_class
  db_name                 = local.db_name
  username                = var.db_username
  password                = var.db_password
  skip_final_snapshot     = true
  backup_retention_period = 0
  multi_az                = false
  publicly_accessible     = false
  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_subnet_group_name    = aws_db_subnet_group.db_subnets.name

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}

# --- DynamoDB tables (examples) ---
resource "aws_dynamodb_table" "leads" {
  name         = "${local.name_prefix}-leads"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${local.name_prefix}-leads"
  }
}

resource "aws_dynamodb_table" "projects" {
  name         = "${local.name_prefix}-projects"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Name = "${local.name_prefix}-projects"
  }
}

# --- S3 bucket for file storage ---
resource "random_pet" "files" {
  length = 2
}

resource "aws_s3_bucket" "files" {
  bucket = var.files_bucket_name != "" ? var.files_bucket_name : "${local.name_prefix}-files-${random_pet.files.id}"

  tags = {
    Name = "${local.name_prefix}-files"
  }
}

# --- IAM for EB EC2 instances ---
resource "aws_iam_role" "eb_instance_role" {
  name               = "${local.name_prefix}-eb-instance-role"
  assume_role_policy = data.aws_iam_policy_document.eb_assume_role.json
}

data "aws_iam_policy_document" "eb_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "eb_s3" {
  role       = aws_iam_role.eb_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_role_policy_attachment" "eb_dynamodb" {
  role       = aws_iam_role.eb_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "eb_webtier" {
  role       = aws_iam_role.eb_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role" "eb_service_role" {
  name               = "${local.name_prefix}-eb-service-role"
  assume_role_policy = data.aws_iam_policy_document.eb_service_assume_role.json
}

data "aws_iam_policy_document" "eb_service_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["elasticbeanstalk.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "eb_service_enhanced_health" {
  role       = aws_iam_role.eb_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_instance_profile" "eb_instance_profile" {
  name = "${local.name_prefix}-eb-instance-profile"
  role = aws_iam_role.eb_instance_role.name
}

# --- Elastic Beanstalk ---
resource "aws_elastic_beanstalk_application" "api" {
  name        = local.eb_app_name
  description = "API for ${var.project_name}"
}

locals {
  app_version_name = var.app_version_key != "" ? replace(replace(var.app_version_key, ".zip", ""), "/", "-") : "${local.eb_app_name}-v1"
}

resource "aws_elastic_beanstalk_application_version" "api" {
  count         = var.deploy_with_s3 ? 1 : 0
  name          = local.app_version_name
  application   = aws_elastic_beanstalk_application.api.name
  description   = "Deployed via Terraform"
  bucket        = var.app_version_bucket
  key           = var.app_version_key
  force_delete  = true
}

resource "aws_elastic_beanstalk_environment" "api_env" {
  name                = local.eb_env_name
  application         = aws_elastic_beanstalk_application.api.name
  solution_stack_name = data.aws_elastic_beanstalk_solution_stack.node.name
  version_label       = var.deploy_with_s3 ? aws_elastic_beanstalk_application_version.api[0].name : null

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.eb_instance_profile.name
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = aws_vpc.main.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = join(",", aws_subnet.public[*].id)
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "ELBSubnets"
    value     = join(",", aws_subnet.public[*].id)
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.eb.id
  }

  setting {
    namespace = "aws:elb:loadbalancer"
    name      = "SecurityGroups"
    value     = aws_security_group.alb.id
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PORT"
    value     = var.api_port
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DATABASE_URL"
    value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${local.db_name}"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "CORS_ALLOWED_ORIGINS"
    value     = local.cors_origins
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "AWS_REGION"
    value     = var.aws_region
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "FILES_BUCKET"
    value     = aws_s3_bucket.files.bucket
  }

  # Ensure ALB health checks hit the API health endpoint
  setting {
    namespace = "aws:elasticbeanstalk:environment:process:default"
    name      = "HealthCheckPath"
    value     = "/health"
  }

  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.eb_service_role.name
  }
}
