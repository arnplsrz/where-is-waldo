variable "database_url_parameter" {
  type    = string
  default = "neon-url"
}

locals {
  database_url_parameter     = var.lab_vpc ? "lab-postgres-url" : var.database_url_parameter
  database_url_parameter_arn = "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter/${trimprefix(local.database_url_parameter, "/")}"
}

resource "aws_dynamodb_table" "sessions" {
  name         = "where-is-waldo-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

resource "aws_sns_topic" "scores" {
  name = "where-is-waldo-scores"
}

resource "aws_sqs_queue" "scores_dlq" {
  name                      = "where-is-waldo-scores-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "scores" {
  name                       = "where-is-waldo-scores"
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.scores_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "scores" {
  queue_url = aws_sqs_queue.scores.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "sns.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.scores.arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_sns_topic.scores.arn } }
    }]
  })
}

resource "aws_sns_topic_subscription" "scores" {
  topic_arn            = aws_sns_topic.scores.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.scores.arn
  raw_message_delivery = true
}

output "scores_dlq_url" {
  value = aws_sqs_queue.scores_dlq.url
}
