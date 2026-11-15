data "archive_file" "api_stub" {
  type        = "zip"
  source_file = "${path.module}/stub/index.mjs"
  output_path = "${path.module}/.build/api-stub.zip"
}

locals {
  lambda_assume_role = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role" "api" {
  name               = "where-is-waldo-api"
  assume_role_policy = local.lambda_assume_role
}

resource "aws_iam_role_policy" "api_logs" {
  name = "logs"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.api.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "api_data" {
  name = "data"
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.sessions.arn
      },
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.scores.arn
      },
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = local.database_url_parameter_arn
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/where-is-waldo-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "where-is-waldo-api"
  role             = aws_iam_role.api.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  memory_size      = 512
  timeout          = 10
  filename         = data.archive_file.api_stub.output_path
  source_code_hash = data.archive_file.api_stub.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.api_vpc]

  environment {
    variables = {
      NODE_OPTIONS       = "--enable-source-maps"
      SESSIONS_TABLE     = aws_dynamodb_table.sessions.name
      SCORES_TOPIC_ARN   = aws_sns_topic.scores.arn
      DATABASE_URL_PARAM = local.database_url_parameter
    }
  }

  vpc_config {
    subnet_ids         = var.lab_vpc ? aws_subnet.private[*].id : []
    security_group_ids = var.lab_vpc ? [aws_security_group.lambda[0].id] : []
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "where-is-waldo"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

resource "aws_budgets_budget" "monthly" {
  name         = "where-is-waldo-monthly"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
