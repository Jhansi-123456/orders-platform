const request = require("supertest");
const app = require("../app/server");

describe("Orders API", () => {

    test("GET / should return application information", async () => {
        const response = await request(app)
            .get("/");

        expect(response.statusCode).toBe(200);
        expect(response.body.application).toBe("orders-api");
        expect(response.body.version).toBeDefined();
        expect(response.body.environment).toBeDefined();
    });

    test("GET /version should return version information", async () => {
        const response = await request(app)
            .get("/version");

        expect(response.statusCode).toBe(200);
        expect(response.body.application).toBe("orders-api");
        expect(response.body.version).toBeDefined();
    });

    test("GET /orders should return orders", async () => {
        const response = await request(app)
            .get("/orders");

        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
    });

});