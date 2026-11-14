resource "aws_iam_role" "worker" {
  name               = "where-is-waldo-worker"
  assume_role_policy = local.lambda_assume_role
}

resource "aws_iam_role_policy" "worker" {
  name = "worker"
  role = aws_iam_role.worker.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.worker.arn}:*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = aws_sqs_queue.scores.arn
      },
      {
        Effect   = "Allow"
        Action   = "ssm:GetParameter"
        Resource = local.database_url_parameter_arn
      },
    ]
  })
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/where-is-waldo-worker"
  retention_in_days = 14
}

resource "aws_lambda_function" "worker" {
  function_name    = "where-is-waldo-worker"
  role             = aws_iam_role.worker.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  memory_size      = 512
  timeout          = 10
  filename         = data.archive_file.api_stub.output_path
  source_code_hash = data.archive_file.api_stub.output_base64sha256
  depends_on       = [aws_cloudwatch_log_group.worker]

  environment {
    variables = {
      NODE_OPTIONS       = "--enable-source-maps"
      DATABASE_URL_PARAM = var.database_url_parameter
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_event_source_mapping" "scores" {
  event_source_arn        = aws_sqs_queue.scores.arn
  function_name           = aws_lambda_function.worker.arn
  batch_size              = 10
  function_response_types = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 2
  }
}
