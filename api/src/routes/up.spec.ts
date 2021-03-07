import { route } from './up';
import { NextFunction, Request, Response } from 'express';
import { AppContext } from '../lib/types';

describe('routes/up', () => {

  describe('route', () => {
    const header = jest.fn().mockReturnValue(undefined);
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const req = { header } as unknown as Request;
    const res = { status } as unknown as Response;

    it('should 415 if the content type is invalid',async () => {
      await route({} as unknown as AppContext)(req, res, null as unknown as NextFunction);
      expect(status).toHaveBeenCalledWith(415)
      expect(send).toHaveBeenCalledWith({ error: 'unsupported_media_type' });
      expect(route).toBeTruthy();
    });
  });
});
