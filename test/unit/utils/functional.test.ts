import { expect } from 'chai';
import { pipe, compose, curry, memoize } from '../../../src/utils/functional.js';

describe('Functional Utilities', () => {
  describe('pipe', () => {
    /**
     * @ac US-001-AC-1: pipe() function executes functions left-to-right
     */
    it('should execute functions left-to-right (sync)', () => {
      const addOne = (value: number) => value + 1;
      const multiplyByTwo = (value: number) => value * 2;
      const subtractThree = (value: number) => value - 3;

      const finalResult = pipe(addOne, multiplyByTwo, subtractThree)(5);
      expect(finalResult).to.equal(9);
    });

    /**
     * @ac US-001-AC-5: All utilities work with both sync and async functions
     */
    it('should execute async functions left-to-right', async () => {
      const addOneAsync = async (value: number) => value + 1;
      const multiplyByTwoAsync = async (value: number) => value * 2;
      const subtractThreeAsync = async (value: number) => value - 3;

      const finalResult = await pipe(addOneAsync, multiplyByTwoAsync, subtractThreeAsync)(5);
      expect(finalResult).to.equal(9);
    });

    /**
     * @ac US-001-AC-6: Type safety is maintained through TypeScript generics
     */
    it('should maintain type safety across different types', () => {
      const addNumberPrefix = (value: number) => `num: ${value}`;
      const convertToUpperCase = (text: string) => text.toUpperCase();
      const getStringLength = (text: string) => text.length;

      const finalResult = pipe(addNumberPrefix, convertToUpperCase, getStringLength)(42);
      expect(finalResult).to.equal(7);
    });
  });

  describe('compose', () => {
    /**
     * @ac US-001-AC-2: compose() function executes functions right-to-left
     */
    it('should execute functions right-to-left (sync)', () => {
      const addOne = (value: number) => value + 1;
      const multiplyByTwo = (value: number) => value * 2;
      const subtractThree = (value: number) => value - 3;

      const finalResult = compose(subtractThree, multiplyByTwo, addOne)(5);
      expect(finalResult).to.equal(9);
    });

    /**
     * @ac US-001-AC-5: All utilities work with both sync and async functions
     */
    it('should execute async functions right-to-left', async () => {
      const addOneAsync = async (value: number) => value + 1;
      const multiplyByTwoAsync = async (value: number) => value * 2;
      const subtractThreeAsync = async (value: number) => value - 3;

      const finalResult = await compose(subtractThreeAsync, multiplyByTwoAsync, addOneAsync)(5);
      expect(finalResult).to.equal(9);
    });
  });

  describe('curry', () => {
    /**
     * @ac US-001-AC-3: curry() function enables partial application
     */
    it('should enable partial application (2 args)', () => {
      const addNumbers = (firstNumber: number, secondNumber: number) => firstNumber + secondNumber;
      const curriedAdd = curry(addNumbers);

      expect(curriedAdd(2)(3)).to.equal(5);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(curriedAdd(2, 3)).to.equal(5);
    });

    /**
     * @ac US-001-AC-5: All utilities work with both sync and async functions
     */
    it('should work with async functions', async () => {
      const addNumbersAsync = async (firstNumber: number, secondNumber: number) => firstNumber + secondNumber;
      const curriedAddAsync = curry(addNumbersAsync);

      const finalResult = await curriedAddAsync(2)(3);
      expect(finalResult).to.equal(5);
    });

    /**
     * @ac US-001-AC-6: Type safety is maintained through TypeScript generics
     */
    it('should maintain type safety', () => {
      const concatenateStrings = (firstString: string, secondString: string, thirdString: string) =>
        firstString + secondString + thirdString;
      const curriedConcat = curry(concatenateStrings);

      const finalResult = curriedConcat('Hello')(' ')('World');
      expect(finalResult).to.equal('Hello World');
    });
  });

  describe('memoize', () => {
    /**
     * @ac US-001-AC-4: memoize() function caches results based on arguments
     */
    it('should cache results based on arguments', () => {
      let invocationCount = 0;
      const expensiveCalculation = (value: number) => {
        invocationCount++;
        return value * 2;
      };

      const memoizedCalculation = memoize(expensiveCalculation);

      expect(memoizedCalculation(5)).to.equal(10);
      expect(invocationCount).to.equal(1);

      expect(memoizedCalculation(5)).to.equal(10);
      expect(invocationCount).to.equal(1);
    });

    /**
     * @ac US-001-AC-5: All utilities work with both sync and async functions
     */
    it('should work with async functions', async () => {
      let invocationCount = 0;
      const expensiveAsyncCalculation = async (value: number) => {
        invocationCount++;
        return value * 2;
      };

      const memoizedCalculation = memoize(expensiveAsyncCalculation);

      expect(await memoizedCalculation(5)).to.equal(10);
      expect(invocationCount).to.equal(1);

      expect(await memoizedCalculation(5)).to.equal(10);
      expect(invocationCount).to.equal(1);
    });

    /**
     * @ac US-001-AC-6: Type safety is maintained through TypeScript generics
     */
    it('should handle cache size limits', () => {
      let invocationCount = 0;
      const expensiveOperation = (value: number) => {
        invocationCount++;
        return value * 2;
      };

      const memoizedWithLimit = memoize(expensiveOperation, { maxSize: 2 });

      memoizedWithLimit(1);
      memoizedWithLimit(2);
      memoizedWithLimit(3);
      expect(invocationCount).to.equal(3);

      memoizedWithLimit(2);
      memoizedWithLimit(3);
      expect(invocationCount).to.equal(3);

      memoizedWithLimit(1);
      expect(invocationCount).to.equal(4);
    });
  });
});
