/**
 * Functional Programming Utilities
 */

/**
 * Executes functions left-to-right
 *
 * @ac US-001-AC-1
 */
export function pipe<InitialValue, FinalValue>(
  firstTransform: (input: InitialValue) => FinalValue | Promise<FinalValue>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function pipe<InitialValue, AfterFirst, FinalValue>(
  firstTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>,
  secondTransform: (input: AfterFirst) => FinalValue | Promise<FinalValue>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function pipe<InitialValue, AfterFirst, AfterSecond, FinalValue>(
  firstTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>,
  secondTransform: (input: AfterFirst) => AfterSecond | Promise<AfterSecond>,
  thirdTransform: (input: AfterSecond) => FinalValue | Promise<FinalValue>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function pipe<InitialValue, AfterFirst, AfterSecond, AfterThird, FinalValue>(
  firstTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>,
  secondTransform: (input: AfterFirst) => AfterSecond | Promise<AfterSecond>,
  thirdTransform: (input: AfterSecond) => AfterThird | Promise<AfterThird>,
  fourthTransform: (input: AfterThird) => FinalValue | Promise<FinalValue>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function pipe(...transformations: Array<(input: unknown) => unknown>): (input: unknown) => unknown {
  if (transformations.length === 0) {
    return (input: unknown) => input;
  }

  return (initialValue: unknown) => {
    let currentValue: unknown = initialValue;

    for (const transform of transformations) {
      if (currentValue instanceof Promise) {
        currentValue = currentValue.then(transform);
      } else {
        currentValue = transform(currentValue);
      }
    }

    return currentValue;
  };
}

/**
 * Executes functions right-to-left
 *
 * @ac US-001-AC-2
 */
export function compose<InitialValue, FinalValue>(
  firstTransform: (input: InitialValue) => FinalValue | Promise<FinalValue>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function compose<InitialValue, AfterFirst, FinalValue>(
  firstTransform: (input: AfterFirst) => FinalValue | Promise<FinalValue>,
  secondTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function compose<InitialValue, AfterFirst, AfterSecond, FinalValue>(
  firstTransform: (input: AfterSecond) => FinalValue | Promise<FinalValue>,
  secondTransform: (input: AfterFirst) => AfterSecond | Promise<AfterSecond>,
  thirdTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function compose<InitialValue, AfterFirst, AfterSecond, AfterThird, FinalValue>(
  firstTransform: (input: AfterThird) => FinalValue | Promise<FinalValue>,
  secondTransform: (input: AfterSecond) => AfterThird | Promise<AfterThird>,
  thirdTransform: (input: AfterFirst) => AfterSecond | Promise<AfterSecond>,
  fourthTransform: (input: InitialValue) => AfterFirst | Promise<AfterFirst>
): (input: InitialValue) => FinalValue | Promise<FinalValue>;
export function compose(...transformations: Array<(input: unknown) => unknown>): (input: unknown) => unknown {
  return pipe(...(transformations.reverse() as [(input: unknown) => unknown]));
}

/**
 * Enables partial application
 *
 * @ac US-001-AC-3
 */
export function curry<FirstParameter, ReturnValue>(
  originalFunction: (first: FirstParameter) => ReturnValue
): (first: FirstParameter) => ReturnValue;
export function curry<FirstParameter, SecondParameter, ReturnValue>(
  originalFunction: (first: FirstParameter, second: SecondParameter) => ReturnValue
): {
  (first: FirstParameter): (second: SecondParameter) => ReturnValue;
  (first: FirstParameter, second: SecondParameter): ReturnValue;
};
export function curry<FirstParameter, SecondParameter, ThirdParameter, ReturnValue>(
  originalFunction: (first: FirstParameter, second: SecondParameter, third: ThirdParameter) => ReturnValue
): {
  (first: FirstParameter): {
    (second: SecondParameter): (third: ThirdParameter) => ReturnValue;
    (second: SecondParameter, third: ThirdParameter): ReturnValue;
  };
  (first: FirstParameter, second: SecondParameter): (third: ThirdParameter) => ReturnValue;
  (first: FirstParameter, second: SecondParameter, third: ThirdParameter): ReturnValue;
};
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
export function curry(originalFunction: (...parameters: any[]) => any): any {
  return function curriedFunction(...providedParameters: any[]): any {
    if (providedParameters.length >= originalFunction.length) {
      return originalFunction(...providedParameters);
    }

    return (...remainingParameters: any[]) => curriedFunction(...providedParameters, ...remainingParameters);
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

/**
 * Memoization options
 */
export type MemoizeOptions = {
  maxSize?: number;
  keyGenerator?: (...parameters: unknown[]) => string;
};

/**
 * Caches results based on arguments
 *
 * @ac US-001-AC-4
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
export function memoize<ExpensiveFunction extends (...parameters: any[]) => any>(
  expensiveFunction: ExpensiveFunction,
  options: MemoizeOptions = {}
): ExpensiveFunction {
  const { maxSize = Infinity, keyGenerator = JSON.stringify } = options;

  const cachedResults = new Map<string, ReturnType<ExpensiveFunction>>();
  const accessOrder: string[] = [];

  return ((...parameters: any[]): any => {
    const cacheKey = keyGenerator(...(parameters as [unknown]));

    if (cachedResults.has(cacheKey)) {
      return cachedResults.get(cacheKey)!;
    }

    const computedValue = expensiveFunction(...parameters);

    if (cachedResults.size >= maxSize) {
      const oldestKey = accessOrder.shift();
      if (oldestKey !== undefined) {
        cachedResults.delete(oldestKey);
      }
    }

    cachedResults.set(cacheKey, computedValue);
    accessOrder.push(cacheKey);

    return computedValue;
  }) as ExpensiveFunction;
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
