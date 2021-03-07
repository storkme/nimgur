import { generateString } from './utils';

describe('utils', () => {
  describe('generateString', () => {
    it('should return a string with length 6', () => {
      expect(typeof generateString()).toEqual('string');
      expect(generateString()).toHaveLength(6);
    });
  });
});
