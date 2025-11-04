import axios from 'axios';

describe('GET /v1/health', () => {
    it('should return gateway health status', async () => {
        const res = await axios.get(`/v1/health`);

        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('status', 'ok');
        expect(res.data).toHaveProperty('gatewayId');
        expect(res.data).toHaveProperty('buffer');
        expect(res.data).toHaveProperty('uplink');
    });
});
