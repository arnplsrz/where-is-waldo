variable "lab_vpc" {
  type    = bool
  default = false
}

locals {
  vpc_cidr = "10.0.0.0/16"
  azs      = ["us-east-1a", "us-east-1b"]
  lab      = var.lab_vpc ? 1 : 0
}

resource "aws_vpc" "lab" {
  count                = local.lab
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true
  tags                 = { Name = "where-is-waldo-lab" }
}

resource "aws_subnet" "public" {
  count             = local.lab
  vpc_id            = aws_vpc.lab[0].id
  cidr_block        = "10.0.0.0/24"
  availability_zone = local.azs[0]
  tags              = { Name = "where-is-waldo-public" }
}

resource "aws_subnet" "private" {
  count             = var.lab_vpc ? length(local.azs) : 0
  vpc_id            = aws_vpc.lab[0].id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = local.azs[count.index]
  tags              = { Name = "where-is-waldo-private-${count.index}" }
}

resource "aws_internet_gateway" "lab" {
  count  = local.lab
  vpc_id = aws_vpc.lab[0].id
}

resource "aws_eip" "nat" {
  count  = local.lab
  domain = "vpc"
}

resource "aws_nat_gateway" "lab" {
  count         = local.lab
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.lab]
}

resource "aws_route_table" "public" {
  count  = local.lab
  vpc_id = aws_vpc.lab[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.lab[0].id
  }
}

resource "aws_route_table_association" "public" {
  count          = local.lab
  subnet_id      = aws_subnet.public[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table" "private" {
  count  = local.lab
  vpc_id = aws_vpc.lab[0].id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.lab[0].id
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_vpc_endpoint" "gateway" {
  for_each          = var.lab_vpc ? toset(["s3", "dynamodb"]) : toset([])
  vpc_id            = aws_vpc.lab[0].id
  service_name      = "com.amazonaws.us-east-1.${each.key}"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private[0].id]
}

resource "aws_network_acl" "private" {
  count      = local.lab
  vpc_id     = aws_vpc.lab[0].id
  subnet_ids = aws_subnet.private[*].id

  egress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }

  egress {
    rule_no    = 110
    action     = "allow"
    protocol   = "tcp"
    cidr_block = local.vpc_cidr
    from_port  = 5432
    to_port    = 5432
  }

  egress {
    rule_no    = 120
    action     = "allow"
    protocol   = "tcp"
    cidr_block = local.vpc_cidr
    from_port  = 1024
    to_port    = 65535
  }

  ingress {
    rule_no    = 100
    action     = "allow"
    protocol   = "tcp"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
}

resource "aws_security_group" "lambda" {
  count  = local.lab
  name   = "where-is-waldo-lambda"
  vpc_id = aws_vpc.lab[0].id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  count  = local.lab
  name   = "where-is-waldo-db"
  vpc_id = aws_vpc.lab[0].id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role_policy_attachment" "api_vpc" {
  count      = local.lab
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy_attachment" "worker_vpc" {
  count      = local.lab
  role       = aws_iam_role.worker.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role" "db" {
  count = local.lab
  name  = "where-is-waldo-lab-db"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "db_ssm" {
  count      = local.lab
  role       = aws_iam_role.db[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "db" {
  count = local.lab
  name  = "where-is-waldo-lab-db"
  role  = aws_iam_role.db[0].name
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "random_password" "db" {
  count   = local.lab
  length  = 32
  special = false
}

resource "aws_instance" "db" {
  count                  = local.lab
  ami                    = nonsensitive(data.aws_ssm_parameter.al2023.value)
  instance_type          = "t4g.micro"
  subnet_id              = aws_subnet.private[0].id
  vpc_security_group_ids = [aws_security_group.db[0].id]
  iam_instance_profile   = aws_iam_instance_profile.db[0].name
  depends_on             = [aws_route_table_association.private]
  tags                   = { Name = "where-is-waldo-lab-db" }

  metadata_options {
    http_tokens = "required"
  }

  user_data = <<-EOT
    #!/bin/bash
    set -eux
    dnf install -y postgresql16-server
    postgresql-setup --initdb
    echo "listen_addresses = '*'" >> /var/lib/pgsql/data/postgresql.conf
    sed -i 's/ident$/scram-sha-256/' /var/lib/pgsql/data/pg_hba.conf
    echo "host all all ${local.vpc_cidr} scram-sha-256" >> /var/lib/pgsql/data/pg_hba.conf
    systemctl enable --now postgresql
    sudo -u postgres psql -c "create user waldo password '${random_password.db[0].result}'"
    sudo -u postgres createdb -O waldo waldo
  EOT
}

resource "aws_ssm_parameter" "lab_db" {
  count = local.lab
  name  = "lab-postgres-url"
  type  = "SecureString"
  value = "postgresql://waldo:${random_password.db[0].result}@${aws_instance.db[0].private_ip}:5432/waldo"
}

output "lab_db_instance_id" {
  value = var.lab_vpc ? aws_instance.db[0].id : null
}
