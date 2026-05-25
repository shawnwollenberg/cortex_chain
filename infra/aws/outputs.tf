output "api_ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "indexer_ecr_repository_url" {
  value = aws_ecr_repository.indexer.repository_url
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "frontend_url" {
  value = "https://${var.frontend_domain_name}"
}

output "api_url" {
  value = "https://${var.api_domain_name}"
}

output "database_secret_arn" {
  value     = aws_secretsmanager_secret.app.arn
  sensitive = true
}
