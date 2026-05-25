variable "aws_profile" {
  description = "AWS CLI profile to use."
  type        = string
  default     = "wallyweb"
}

variable "aws_region" {
  description = "AWS region for ECS, RDS, ALB, and S3."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Resource name prefix."
  type        = string
  default     = "cortex"
}

variable "hosted_zone_name" {
  description = "Route 53 hosted zone name."
  type        = string
  default     = "wallyweb.com"
}

variable "frontend_domain_name" {
  description = "Public frontend domain."
  type        = string
  default     = "cortex.wallyweb.com"
}

variable "api_domain_name" {
  description = "Public API domain."
  type        = string
  default     = "api.cortex.wallyweb.com"
}

variable "base_sepolia_rpc_url" {
  description = "Base Sepolia RPC endpoint."
  type        = string
  default     = "https://sepolia.base.org"
}

variable "start_block" {
  description = "Indexer start block, usually the contract deployment block."
  type        = number
  default     = 0
}

variable "agent_registry_address" {
  description = "Base Sepolia AgentRegistry address."
  type        = string
  default     = ""
}

variable "intent_book_address" {
  description = "Base Sepolia IntentBook address."
  type        = string
  default     = ""
}

variable "policy_module_address" {
  description = "Base Sepolia PolicyModule address."
  type        = string
  default     = ""
}

variable "attestation_registry_address" {
  description = "Base Sepolia AttestationRegistry address."
  type        = string
  default     = ""
}

variable "solver_registry_address" {
  description = "Base Sepolia SolverRegistry address."
  type        = string
  default     = ""
}

variable "attestor_registry_address" {
  description = "Base Sepolia AttestorRegistry address."
  type        = string
  default     = ""
}

variable "commerce_registry_address" {
  description = "Base Sepolia CommerceRegistry address."
  type        = string
  default     = ""
}

variable "api_desired_count" {
  description = "Number of API tasks. Keep 0 until an image has been pushed to ECR."
  type        = number
  default     = 0
}

variable "indexer_desired_count" {
  description = "Number of indexer tasks. Keep 0 until contract addresses are configured and an image has been pushed to ECR."
  type        = number
  default     = 0
}

variable "container_image_tag" {
  description = "ECR image tag used by ECS services."
  type        = string
  default     = "latest"
}

variable "db_name" {
  description = "Postgres database name."
  type        = string
  default     = "cortex"
}

variable "db_username" {
  description = "Postgres username."
  type        = string
  default     = "cortex"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB."
  type        = number
  default     = 20
}
