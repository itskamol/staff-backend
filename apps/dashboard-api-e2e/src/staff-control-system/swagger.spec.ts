import axios from 'axios';

describe('Swagger Endpoints (Dashboard API)', () => {
    const BASE_URL = 'http://localhost:3000';

    it('should return the Swagger UI page', async () => {
        const res = await axios.get(`${BASE_URL}/api/docs`);
        expect(res.status).toBe(200);
        expect(res.data).toContain('<title>Swagger UI</title>');
    });

    it('should return the Swagger JSON specification', async () => {
        const res = await axios.get(`${BASE_URL}/api/docs-json`);
        expect(res.status).toBe(200);
        expect(res.data.openapi).toBe('3.0.0');
        expect(res.data.info.title).toBe('Staff Control System - Dashboard API');
    });
});
