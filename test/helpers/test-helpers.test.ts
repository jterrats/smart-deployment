/**
 * Tests for Test Helpers - US-061
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  createMockComponent,
  createMockGraph,
  createMockWave,
  assertUnique,
  assertSorted,
  assertAcyclic,
  waitFor,
  measureTime,
  assertPerformance,
  generateRandomComponents,
} from './test-helpers.js';

describe('Test Helpers', () => {
  describe('US-061: Test Framework Setup', () => {
    /** @ac US-061-AC-1: Test utilities available */
    it('US-061-AC-1: should provide test utilities', () => {
      expect(createMockComponent).to.be.a('function');
      expect(waitFor).to.be.a('function');
      expect(measureTime).to.be.a('function');
    });

    /** @ac US-061-AC-2: Mock data generators */
    it('US-061-AC-2: should generate mock components', () => {
      const component = createMockComponent({ name: 'TestClass' });

      expect(component.name).to.equal('TestClass');
      expect(component.type).to.equal('ApexClass');
      expect(component.dependencies).to.be.instanceOf(Set);
    });

    it('US-061-AC-2: should generate mock graph', () => {
      const components = [
        createMockComponent({ name: 'A' }),
        createMockComponent({ name: 'B' }),
      ];

      const graph = createMockGraph(components);

      expect(graph.size).to.equal(2);
      expect(graph.has('A')).to.be.true;
      expect(graph.has('B')).to.be.true;
    });

    it('US-061-AC-2: should generate mock waves', () => {
      const wave = createMockWave(1, 10);

      expect(wave.number).to.equal(1);
      expect(wave.components).to.have.lengthOf(10);
      expect(wave.metadata.componentCount).to.equal(10);
    });

    it('US-061-AC-2: should generate random components', () => {
      const components = generateRandomComponents(5);

      expect(components).to.have.lengthOf(5);
      for (const component of components) {
        expect(component.name).to.match(/Component\d+/);
      }
    });

    /** @ac US-061-AC-3: Assertion helpers */
    it('US-061-AC-3: should validate uniqueness', () => {
      assertUnique([1, 2, 3, 4]);

      expect(() => assertUnique([1, 2, 2, 3])).to.throw('unique');
    });

    it('US-061-AC-3: should validate sorted arrays', () => {
      assertSorted([1, 2, 3, 4]);

      expect(() => assertSorted([1, 3, 2, 4])).to.throw('sorted');
    });

    it('US-061-AC-3: should validate acyclic graphs', () => {
      const a = createMockComponent({ name: 'A' });
      const b = createMockComponent({ name: 'B' });
      a.dependencies.add('B');

      const graph = createMockGraph([a, b]);

      assertAcyclic(graph); // Should not throw
    });

    it('US-061-AC-3: should detect cycles in graphs', () => {
      const a = createMockComponent({ name: 'A' });
      const b = createMockComponent({ name: 'B' });
      a.dependencies.add('B');
      b.dependencies.add('A'); // Cycle!

      const graph = createMockGraph([a, b]);

      expect(() => assertAcyclic(graph)).to.throw('cycle');
    });

    /** @ac US-061-AC-4: Performance measurement */
    it('US-061-AC-4: should measure execution time', async () => {
      const { result, duration } = await measureTime(() => 42);

      expect(result).to.equal(42);
      expect(duration).to.be.a('number');
      expect(duration).to.be.at.least(0);
    });

    /** @ac US-061-AC-5: Async utilities */
    it('US-061-AC-5: should wait for condition', async () => {
      let counter = 0;

      setTimeout(() => {
        counter = 1;
      }, 50);

      await waitFor(() => counter === 1, { timeout: 200 });

      expect(counter).to.equal(1);
    });

    it('US-061-AC-5: should timeout if condition not met', async () => {
      try {
        await waitFor(() => false, { timeout: 100, message: 'Test timeout' });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('timeout');
      }
    });

    /** @ac US-061-AC-6: Performance assertions */
    it('US-061-AC-6: should assert performance bounds', async () => {
      const result = await assertPerformance(() => 42, 100);

      expect(result).to.equal(42);
    });

    it('US-061-AC-6: should fail if too slow', async () => {
      try {
        await assertPerformance(
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
          },
          50
        );
        throw new Error('Should have thrown');
      } catch (error) {
        expect((error as Error).message).to.include('execution');
      }
    });
  });
});
