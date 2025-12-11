# 🛡️ Error Catalog - US-077

Complete catalog of all error codes, recovery procedures, and troubleshooting guides.

## 📋 Error Categories

### Parsing Errors (PARSE\_\*)

#### PARSE_ERROR

**Description:** Failed to parse metadata file

**Common Causes:**

- Invalid XML syntax
- Malformed JSON
- Corrupted file
- Unsupported encoding

**Recovery:**

```bash
# Check file syntax
cat path/to/file.xml | xmllint -

# Fix encoding
iconv -f ISO-8859-1 -t UTF-8 file.xml > file_fixed.xml
```

**Prevention:**

- Use valid XML/JSON
- Check encoding (UTF-8)
- Validate before deployment

**Links:**

- [XML Validation](https://www.w3schools.com/xml/xml_validator.asp)
- [JSON Validation](https://jsonlint.com/)

---

#### PARSE_APEX_ERROR

**Description:** Failed to parse Apex code

**Common Causes:**

- Syntax errors
- Invalid Apex keywords
- Missing closing braces

**Recovery:**

```bash
# Validate Apex syntax
sf org dev execute --command "System.debug('test');"
```

**Prevention:**

- Use IDE with Apex support
- Enable real-time syntax checking
- Run local validation

---

### Dependency Errors (DEPENDENCY\_\*)

#### CIRCULAR_DEPENDENCY

**Description:** Circular dependency detected

**Common Causes:**

- Class A depends on Class B, B depends on A
- Trigger → Class → Trigger cycle

**Recovery:**

1. Review dependency graph
2. Break cycle by removing unnecessary reference
3. Use interfaces to decouple

**Prevention:**

- Design with clear layers
- Avoid bi-directional dependencies
- Use dependency injection

**Links:**

- [docs/DEPENDENCY_MANAGEMENT.md](./DEPENDENCY_MANAGEMENT.md)

---

#### INVALID_DEPENDENCY

**Description:** Reference to non-existent component

**Common Causes:**

- Typo in component name
- Component not included in deployment
- Incorrect namespace

**Recovery:**

1. Check component name spelling
2. Include missing component
3. Verify namespace

**Prevention:**

- Use autocomplete in IDE
- Run dependency analyzer before deploy

---

### Deployment Errors (DEPLOYMENT\_\*)

#### DEPLOYMENT_TIMEOUT

**Description:** Deployment exceeded timeout

**Common Causes:**

- Large deployment
- Org under heavy load
- Network issues

**Recovery:**

```bash
# Resume deployment
sf smart-deployment resume

# Or split into smaller waves
sf smart-deployment start --max-wave-size 100
```

**Prevention:**

- Split large deployments
- Deploy during off-peak hours
- Increase timeout in config

---

#### DEPLOYMENT_LIMIT_EXCEEDED

**Description:** Salesforce deployment limits exceeded

**Common Causes:**

- Too many components (>10,000)
- Too many test classes
- CMT records >200

**Recovery:**

```bash
# Split deployment
sf smart-deployment start --split-large-waves
```

**Prevention:**

- Use wave splitting
- Deploy incrementally
- Check SF limits

**Links:**

- [SF Deployment Limits](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deployapi.htm)

---

#### UNABLE_TO_LOCK_ROW

**Description:** Record locked by another process

**Common Causes:**

- Concurrent deployment
- Background process
- User editing record

**Recovery:**

- Wait 30 seconds and retry
- Check for concurrent operations
- This error is automatically retried (3x)

**Prevention:**

- Coordinate deployments
- Deploy during maintenance window

---

### Network Errors (NETWORK\_\*)

#### NETWORK_TIMEOUT

**Description:** Network request timed out

**Common Causes:**

- Slow network
- SF API slow response
- Large payload

**Recovery:**

- Retry (automatic)
- Check network connection
- Increase timeout setting

**Prevention:**

- Use stable network
- Deploy smaller batches
- Configure appropriate timeouts

---

#### NETWORK_CONNECTION_FAILED

**Description:** Cannot connect to service

**Common Causes:**

- No internet connection
- Firewall blocking
- VPN issues
- Service down

**Recovery:**

1. Check internet connection
2. Check firewall settings
3. Verify SF status: https://status.salesforce.com
4. Check proxy/VPN

**Prevention:**

- Stable network connection
- Whitelist SF IPs
- Monitor SF status

---

### AI Errors (AI\_\*)

#### AI_SERVICE_UNAVAILABLE

**Description:** Agentforce AI service unavailable

**Common Causes:**

- AI service down
- Rate limit exceeded
- Invalid API key
- Circuit breaker open

**Recovery:**

- Automatic fallback to static analysis
- Check AI service status
- Verify API credentials

**Prevention:**

- Configure fallback strategies
- Monitor AI usage
- Set appropriate rate limits

**Fallback:** Static analysis automatically used ✅

---

### Validation Errors (VALIDATION\_\*)

#### INVALID_METADATA

**Description:** Metadata validation failed

**Common Causes:**

- Missing required fields
- Invalid field values
- Type mismatch

**Recovery:**

1. Review validation error message
2. Fix metadata file
3. Re-run validation

**Prevention:**

- Use metadata templates
- Validate before commit
- Enable IDE validation

---

## 🔧 General Troubleshooting

### Step 1: Check Logs

```bash
# View logs
tail -100 .sf/smart-deployment.log

# Search for errors
grep ERROR .sf/smart-deployment.log
```

### Step 2: Run Validation

```bash
# Validate project
sf smart-deployment validate

# Check dependencies
sf smart-deployment analyze
```

### Step 3: Check Status

```bash
# View deployment status
sf smart-deployment status

# Check if can resume
sf smart-deployment resume --dry-run
```

### Step 4: Get Help

```bash
# View command help
sf smart-deployment --help

# View specific command
sf smart-deployment start --help
```

---

## 📞 Support

- **Documentation:** [docs/](.)
- **Issues:** [GitHub Issues](https://github.com/jterrats/smart-deployment/issues)
- **Examples:** [docs/examples/](./examples/)

---

## 🔄 Quick Recovery Commands

```bash
# Resume failed deployment
sf smart-deployment resume

# Retry with validation only
sf smart-deployment validate

# Check what failed
sf smart-deployment status

# Start fresh
sf smart-deployment start --dry-run
```
