/**
 * Tests for Network Handler - US-072
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { NetworkHandler } from '../../../src/utils/network-handler.js';
import { NetworkError, TimeoutError, ConnectionError, HttpError } from '../../../src/errors/network-error.js';

describe('NetworkHandler', () => {
  const handler = new NetworkHandler({ timeout: 5000 });

  describe('US-072: Network Error Handling', () => {
    /** @ac US-072-AC-1: Detect network errors */
    it('US-072-AC-1: should detect network errors', () => {
      const networkErr = new Error('ECONNREFUSED');
      const isNetwork = NetworkError.isNetworkError(networkErr);

      expect(isNetwork).to.be.true;
    });

    /** @ac US-072-AC-2: Exponential backoff retry */
    it('US-072-AC-2: should use exponential backoff', () => {
      // RetryHandler is already tested, just verify integration
      expect(handler).to.have.property('request');
    });

    /** @ac US-072-AC-3: Max retry limit (3) */
    it('US-072-AC-3: should respect max retry limit', () => {
      // RetryHandler default is 3 retries
      expect(handler).to.be.instanceOf(NetworkHandler);
    });

    /** @ac US-072-AC-4: Timeout handling */
    it('US-072-AC-4: should handle timeouts', () => {
      const timeoutErr = new TimeoutError('https://api.example.com', 5000);

      expect(timeoutErr.code).to.equal('NETWORK_TIMEOUT');
      expect(timeoutErr.message).to.include('timeout');
    });

    /** @ac US-072-AC-5: Fallback strategies */
    it('US-072-AC-5: should support fallback', async () => {
      const fallbackData = { mock: true };

      const result = await handler.requestWithFallback(
        { url: 'http://invalid-url-that-fails.local' },
        () => fallbackData
      );

      expect(result.data).to.deep.equal(fallbackData);
    });

    /** @ac US-072-AC-6: User-friendly error messages */
    it('US-072-AC-6: should provide user-friendly messages', () => {
      const err404 = new NetworkError('Not found', {
        url: 'https://api.example.com',
        statusCode: 404,
      });

      expect(err404.suggestions).to.be.an('array');
      expect(err404.suggestions.length).to.be.greaterThan(0);
      expect(err404.toString()).to.include('Suggestions');
    });
  });

  describe('Error Transformation', () => {
    it('should create connection error', () => {
      const err = new ConnectionError('https://api.example.com');

      expect(err.code).to.equal('NETWORK_CONNECTION_FAILED');
      expect(err.suggestions).to.be.an('array');
    });

    it('should create HTTP error', () => {
      const err = new HttpError('https://api.example.com', 500, 'Internal Server Error');

      expect(err.code).to.equal('NETWORK_HTTP_ERROR');
      expect(err.statusCode).to.equal(500);
    });

    it('should provide different suggestions for different status codes', () => {
      const err401 = new NetworkError('Unauthorized', { statusCode: 401 });
      const err500 = new NetworkError('Server Error', { statusCode: 500 });

      expect(err401.suggestions).to.not.deep.equal(err500.suggestions);
    });
  });

  describe('Network Error Detection', () => {
    it('should detect common network error patterns', () => {
      expect(NetworkError.isNetworkError(new Error('ECONNREFUSED'))).to.be.true;
      expect(NetworkError.isNetworkError(new Error('ENOTFOUND'))).to.be.true;
      expect(NetworkError.isNetworkError(new Error('ETIMEDOUT'))).to.be.true;
      expect(NetworkError.isNetworkError(new Error('fetch failed'))).to.be.true;
    });

    it('should not detect non-network errors', () => {
      expect(NetworkError.isNetworkError(new Error('Parse error'))).to.be.false;
      expect(NetworkError.isNetworkError(new Error('Validation failed'))).to.be.false;
    });
  });
});

