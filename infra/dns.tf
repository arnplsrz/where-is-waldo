data "cloudflare_zone" "site" {
  filter = {
    name = var.cloudflare_zone_name
  }
}

resource "aws_acm_certificate" "site" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "cloudflare_dns_record" "certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.site.domain_validation_options : option.domain_name => option
  }

  zone_id = data.cloudflare_zone.site.zone_id
  name    = trimsuffix(each.value.resource_record_name, ".")
  type    = each.value.resource_record_type
  content = trimsuffix(each.value.resource_record_value, ".")
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "site" {
  certificate_arn         = aws_acm_certificate.site.arn
  validation_record_fqdns = [for record in cloudflare_dns_record.certificate_validation : record.name]
}

resource "cloudflare_dns_record" "site" {
  zone_id = data.cloudflare_zone.site.zone_id
  name    = var.domain_name
  type    = "CNAME"
  content = aws_cloudfront_distribution.site.domain_name
  ttl     = 300
  proxied = false
}
