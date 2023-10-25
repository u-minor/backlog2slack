import { response } from './response';

describe('response', () => {
  it('should return valid object when status code is 200', () => {
    const res = response(200);

    expect(res).toEqual({ body: 'OK', statusCode: 200 });
  });

  it('should return valid object when status code is 403', () => {
    const res = response(403);

    expect(res).toEqual({ body: 'Forbidden', statusCode: 403 });
  });

  it('should return valid object when status code is 500', () => {
    const res = response(500);

    expect(res).toEqual({ body: 'Internal Server Error', statusCode: 500 });
  });
});
