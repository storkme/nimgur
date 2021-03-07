import { route } from './up';
import { Request, Response } from 'express';

describe('routes/up', () => {

  describe('route', () => {
    const header = jest.fn().mockReturnValue(undefined);
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const req = { header } as unknown as Request;
    const res = { status } as unknown as Response;

    it('should 415 if the content type is invalid', () => {
      route(req, res);
      expect(status).toHaveBeenCalledWith(415)
      expect(send).toHaveBeenCalledWith({ error: 'unsupported_media_type' });
      expect(route).toBeTruthy();
    });

    it('should ')
  });
});
