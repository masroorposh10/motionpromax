terraform {
  required_providers {
    aws = {
      version = ">= 4.0.0"
      source  = "hashicorp/aws"
    }
  }
}

# specify the provider region
provider "aws" {
  region = "ca-central-1"
}

# the locals block is used to declare constants that 
# you can use throughout your code
locals {
  save_name   = "save-note-30156171"
  get_name    = "get-notes-30156171"
  delete_name = "delete-note-30156171"

  handler_name = "main.handler"

  save_artifact   = "save-artifact.zip"
  get_artifact    = "get-artifact.zip"
  delete_artifact = "delete-artifact.zip"
}

data "archive_file" "delete_zip" {
  type = "zip"
  # this file (main.py) needs to exist in the same folder as this 
  # Terraform configuration file
  source_file = "../functions/delete-note/main.py"
  output_path = local.delete_artifact
}
data "archive_file" "get_zip" {
  type = "zip"
  # this file (./functions/main.py) needs to exist in the same folder as this 
  # Terraform configuration file
  source_file = "../functions/get-notes/main.py"
  output_path = local.get_artifact
}
data "archive_file" "save_zip" {
  type = "zip"
  # this file (functions/main.py) needs to exist in the same folder as this 
  # Terraform configuration file
  source_file = "../functions/save-note/main.py"
  output_path = local.save_artifact
}

# Create an S3 bucket
resource "aws_s3_bucket" "lambda" {}

# Create an IAM role for the Lambda function to access DynamoDB
resource "aws_iam_role" "lambda" {
  name               = "iam-for-lambda"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

# create a policy for publishing logs to CloudWatch
# see the docs: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy
resource "aws_iam_policy" "logs" {
  name        = "lambda-logging"
  description = "IAM policy for logging from a lambda"

  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource":["arn:aws:dynamodb:::table/","arn:aws:logs:::","arn:aws:dynamodb:ca-central-1:341576245914:table/lotion-30156171"],
      "Effect": "Allow"
    }
  ]
}
EOF
}

# attach the above policy to the function role
# see the docs: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy_attachment
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.logs.arn
}


resource "aws_lambda_function" "lambda" {
  role             = aws_iam_role.lambda.arn
  function_name    = local.save_name
  handler          = local.handler_name
  filename         = local.save_artifact
  source_code_hash = data.archive_file.save_zip.output_base64sha256

  # see all available runtimes here: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
  runtime = "python3.9"
}
resource "aws_lambda_function" "lambda-delete" {
  role             = aws_iam_role.lambda.arn
  function_name    = local.delete_name
  handler          = local.handler_name
  filename         = local.delete_artifact
  source_code_hash = data.archive_file.delete_zip.output_base64sha256

  # see all available runtimes here: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
  runtime = "python3.9"
}
resource "aws_lambda_function" "lambda-get" {
  role             = aws_iam_role.lambda.arn
  function_name    = local.get_name
  handler          = local.handler_name
  filename         = local.get_artifact
  source_code_hash = data.archive_file.get_zip.output_base64sha256
  
  # see all available runtimes here: https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-Runtime
  runtime = "python3.9"


}

resource "aws_lambda_function_url" "url" {
  function_name      = aws_lambda_function.lambda.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE"]
    allow_headers     = ["*"]
    expose_headers    = ["keep-alive", "date"]
  }
}
resource "aws_lambda_function_url" "url-delete" {
  function_name      = aws_lambda_function.lambda-delete.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE"]
    allow_headers     = ["*"]
    expose_headers    = ["keep-alive", "date"]
  }
}
resource "aws_lambda_function_url" "url-get" {
  function_name      = aws_lambda_function.lambda-get.function_name
  authorization_type = "NONE"

  //path_part = "{email}"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE"]
    allow_headers     = ["*"]
    expose_headers    = ["keep-alive", "date"]
  }
}

# Dynamo table
resource "aws_dynamodb_table" "lotion-30156171" {
  name           = "lotion-30156171"
  hash_key       = "email"
  range_key      = "id"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1

  attribute {
    name = "email"
    type = "S"
  }
  attribute {
    name = "id"
    type = "S"
  }
}

# show the Function URL after creation
output "lambda_url_save" {
  value = aws_lambda_function_url.url.function_url
}
output "lambda_url_delete" {
  value = aws_lambda_function_url.url-delete.function_url
}
output "lambda_url_get" {
  value = aws_lambda_function_url.url-get.function_url
}

# output the name of the bucket after creation
output "bucket_name" {
  value = aws_s3_bucket.lambda.bucket
}