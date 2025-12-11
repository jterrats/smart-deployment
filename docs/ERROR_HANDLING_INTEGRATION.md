# 🛡️ Error Handling Integration Guide

## 📋 Overview

Esta guía documenta cómo integrar el error handling en nuevos features desde el inicio del desarrollo.

## ✅ Infraestructura Existente

### 1. Base Error Classes (✅ Implementado)

```typescript
// src/errors/base-error.ts
SmartDeploymentError  // Base para todos los errores
├── DependencyError   // Errores de dependencias
├── DeploymentError   // Errores de deployment
├── ParsingError      // Errores de parsing
└── ValidationError   // Errores de validación
```

**Uso:**
```typescript
import { ParsingError } from '../errors/parsing-error.js';

throw new ParsingError({
  file: 'MyClass.cls',
  line: 42,
  message: 'Unexpected token',
  originalError: error,
  suggestions: ['Check syntax', 'Ensure valid Apex code']
});
```

### 2. Error Aggregator (✅ US-076)

```typescript
import { ErrorAggregator } from '../utils/error-aggregator.js';

const aggregator = new ErrorAggregator();

// Agregar errores
aggregator.addError({
  severity: 'error',
  category: 'parsing',
  message: 'Failed to parse file',
  context: { file: 'MyClass.cls' }
});

// Generar reporte
const report = aggregator.generateReport();
console.log(report.formatted);
```

### 3. Error Resilient Parser (✅ US-071)

```typescript
import { ErrorResilientParser } from '../parsers/error-resilient-parser.js';

const parser = new ErrorResilientParser();

// Parse con error handling automático
const result = await parser.parseWithResilience(
  files,
  async (file) => await parseFile(file)
);

// result.errors contiene todos los errores encontrados
// result.successful contiene archivos parseados exitosamente
```

### 4. Retry Handler (✅ US-088)

```typescript
import { RetryHandler } from '../deployment/retry-handler.js';

const retryHandler = new RetryHandler({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000
});

const result = await retryHandler.executeWithRetry(
  async () => await deployComponent(component),
  'deploy-component'
);
```

### 5. Circuit Breaker (✅ US-060)

```typescript
import { CircuitBreaker } from '../ai/circuit-breaker.js';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 60000
});

const result = await breaker.execute(
  async () => await aiService.analyze(),
  () => staticAnalysis() // Fallback
);
```

### 6. Logger (✅ Implementado)

```typescript
import { getLogger } from '../utils/logger.js';

const logger = getLogger('MyService');

logger.info('Operation started');
logger.warn('Potential issue', { context: data });
logger.error('Operation failed', { error });
```

---

## 🎯 Patrones de Integración

### Pattern 1: Feature con Parse Errors

```typescript
import { ErrorResilientParser } from '../parsers/error-resilient-parser.js';
import { ParsingError } from '../errors/parsing-error.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('MyFeature');

export class MyFeature {
  private readonly parser = new ErrorResilientParser();

  async processFiles(files: string[]): Promise<Result> {
    const result = await this.parser.parseWithResilience(
      files,
      async (file) => {
        try {
          return await this.parseFile(file);
        } catch (error) {
          throw new ParsingError({
            file,
            message: 'Parse failed',
            originalError: error instanceof Error ? error : undefined,
            suggestions: ['Check file syntax', 'Ensure valid format']
          });
        }
      }
    );

    // Log errores pero continuar
    if (result.errors.length > 0) {
      logger.warn(`Parsed with errors: ${result.errors.length}`);
    }

    return result;
  }
}
```

### Pattern 2: Feature con Network Calls

```typescript
import { RetryHandler } from '../deployment/retry-handler.js';
import { CircuitBreaker } from '../ai/circuit-breaker.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('NetworkFeature');

export class NetworkFeature {
  private readonly retryHandler = new RetryHandler();
  private readonly breaker = new CircuitBreaker();

  async fetchData(url: string): Promise<Data> {
    return this.breaker.execute(
      async () => {
        return this.retryHandler.executeWithRetry(
          async () => {
            try {
              return await fetch(url);
            } catch (error) {
              // Log y re-throw para retry
              logger.warn('Fetch failed, will retry', { url, error });
              throw error;
            }
          },
          `fetch-${url}`
        );
      },
      () => this.getFallbackData() // Circuit breaker fallback
    );
  }

  private getFallbackData(): Data {
    logger.info('Using fallback data');
    return { /* cached/default data */ };
  }
}
```

### Pattern 3: Feature con AI Calls

```typescript
import { CircuitBreaker } from '../ai/circuit-breaker.js';
import { AgentforceService } from '../ai/agentforce-service.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('AIFeature');

export class AIFeature {
  private readonly aiService: AgentforceService;
  private readonly breaker = new CircuitBreaker();
  private readonly errorAggregator = new ErrorAggregator();

  async analyze(components: Component[]): Promise<Result> {
    // Try AI with circuit breaker
    return this.breaker.execute(
      async () => {
        try {
          const result = await this.aiService.sendRequest({
            prompt: this.buildPrompt(components),
            model: 'gpt-4',
          });
          return this.parseAIResult(result);
        } catch (error) {
          this.errorAggregator.addError({
            severity: 'warning',
            category: 'ai',
            message: 'AI analysis failed',
            context: { error }
          });
          throw error; // Let circuit breaker handle
        }
      },
      () => {
        logger.warn('AI unavailable, using static analysis');
        return this.staticAnalysis(components);
      }
    );
  }

  private staticAnalysis(components: Component[]): Result {
    // Fallback implementation
    return { /* static analysis result */ };
  }
}
```

### Pattern 4: Feature con Validación

```typescript
import { ValidationError } from '../errors/validation-error.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ValidationFeature');

export class ValidationFeature {
  private readonly errorAggregator = new ErrorAggregator();

  validate(data: Data): ValidationResult {
    const errors: ValidationError[] = [];

    // Validación 1
    if (!data.required) {
      const error = new ValidationError({
        message: 'Missing required field',
        field: 'required',
        value: data.required,
        suggestions: ['Add required field', 'Check documentation']
      });
      errors.push(error);
      this.errorAggregator.addError({
        severity: 'error',
        category: 'validation',
        message: error.message,
        context: error.context
      });
    }

    // Validación 2
    if (data.value < 0) {
      const error = new ValidationError({
        message: 'Value must be positive',
        field: 'value',
        value: data.value,
        suggestions: ['Use positive number']
      });
      errors.push(error);
      this.errorAggregator.addError({
        severity: 'error',
        category: 'validation',
        message: error.message,
        context: error.context
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      report: this.errorAggregator.generateReport()
    };
  }
}
```

### Pattern 5: Feature con Deployment

```typescript
import { DeploymentError } from '../errors/deployment-error.js';
import { RetryHandler } from '../deployment/retry-handler.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('DeploymentFeature');

export class DeploymentFeature {
  private readonly retryHandler = new RetryHandler();
  private readonly errorAggregator = new ErrorAggregator();

  async deploy(components: Component[]): Promise<DeploymentResult> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => {
          const result = await this.executeDeploy(components);

          if (!result.success) {
            throw new DeploymentError({
              message: 'Deployment failed',
              componentsFailed: result.failed,
              originalError: result.error,
              suggestions: [
                'Check component dependencies',
                'Review Salesforce limits',
                'Verify permissions'
              ]
            });
          }

          return result;
        },
        'deploy-components'
      );
    } catch (error) {
      // Agregar a error aggregator
      this.errorAggregator.addError({
        severity: 'error',
        category: 'deployment',
        message: 'Deployment failed after retries',
        context: {
          components: components.length,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      // Re-throw con contexto
      if (error instanceof DeploymentError) {
        throw error;
      }

      throw new DeploymentError({
        message: 'Unexpected deployment error',
        originalError: error instanceof Error ? error : undefined,
        suggestions: ['Check logs', 'Review error details']
      });
    }
  }
}
```

---

## 📝 Checklist para Nuevos Features

Antes de implementar un nuevo feature, asegúrate de:

### 1. Planning Phase
- [ ] Identificar posibles errores (usa EDD - Error-Driven Development)
- [ ] Definir estrategia de fallback (si aplica)
- [ ] Decidir si necesita retry logic
- [ ] Decidir si necesita circuit breaker
- [ ] Planear logging strategy

### 2. Implementation Phase
- [ ] Importar error classes apropiadas
- [ ] Usar `ErrorAggregator` para colectar errores
- [ ] Usar `ErrorResilientParser` para parsing
- [ ] Usar `RetryHandler` para operaciones con posible fallo temporal
- [ ] Usar `CircuitBreaker` para servicios externos (AI, APIs)
- [ ] Agregar logging con contexto (`getLogger`)
- [ ] Throw errores custom con suggestions
- [ ] Implementar fallbacks cuando sea posible

### 3. Testing Phase
- [ ] Test happy path
- [ ] Test error scenarios (EDD)
- [ ] Test retry logic
- [ ] Test circuit breaker behavior
- [ ] Test fallback functionality
- [ ] Test error messages are user-friendly
- [ ] Verificar coverage de error paths (>90%)

---

## 🚨 Errores Pendientes de Implementar

### US-072: Network Error Handling
**Status**: Parcialmente implementado (RetryHandler existe)
**Falta**:
- Network-specific error detection
- Timeout handling mejorado
- User-friendly network error messages

### US-073: Agentforce Error Handling
**Status**: Parcialmente implementado (CircuitBreaker existe)
**Falta**:
- Integration con AgentforceService
- AI usage statistics reporting
- Better fallback strategies

### US-074: Deployment Error Handling
**Status**: Parcialmente implementado (DeploymentError + RetryHandler)
**Falta**:
- Save/restore deployment state
- Resume from failure logic
- Different retry strategies

### US-075: Validation Error Reporting
**Status**: Implementado (ValidationError)
**Falta**:
- Link to documentation
- Better severity categorization

### US-077: Error Documentation
**Status**: No implementado
**Necesita**:
- Error code catalog
- Troubleshooting guide
- Recovery procedures

### US-078: Error Analytics
**Status**: No implementado
**Necesita**:
- Error metrics tracking
- Trending analysis
- Dashboard/reporting

---

## 💡 Best Practices

1. **Siempre usar custom errors**: No hacer `throw new Error()`, usar clases específicas
2. **Agregar context**: Incluir información útil para debugging
3. **Incluir suggestions**: Ayudar al usuario a resolver el problema
4. **Log apropiadamente**:
   - `debug`: Información de desarrollo
   - `info`: Flujo normal
   - `warn`: Problemas no críticos
   - `error`: Problemas críticos
5. **Fail gracefully**: Siempre tener un fallback cuando sea posible
6. **Test error paths**: Coverage >90% incluye paths de error
7. **User-friendly messages**: Errores técnicos → mensajes claros

---

## 🔗 Referencias

- `docs/methodology/ERROR_DRIVEN_DEVELOPMENT.md` - Metodología EDD
- `src/errors/` - Error classes
- `src/utils/error-aggregator.ts` - Error aggregation
- `src/parsers/error-resilient-parser.ts` - Resilient parsing
- `src/deployment/retry-handler.ts` - Retry logic
- `src/ai/circuit-breaker.ts` - Circuit breaker pattern

---

## 📞 Soporte

Si tienes dudas sobre error handling:
1. Revisa esta guía
2. Revisa `ERROR_DRIVEN_DEVELOPMENT.md`
3. Busca ejemplos en el codebase
4. Consulta los tests unitarios de error handling

