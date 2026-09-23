// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true
