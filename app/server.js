const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || "7.8";
const ENVIRONMENT = process.env.ENVIRONMENT || "PRODUCTION";

const DB_HOST = process.env.DB_HOST || "orders-db";
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || "ordersuser";
const DB_PASSWORD = process.env.DB_PASSWORD || "orderspass";
const DB_NAME = process.env.DB_NAME || "ordersdb";

app.use(express.json());

function getDbConnection() {
    return mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        connectTimeout: 3000
    });
}

// Basic application endpoint
app.get("/", (req, res) => {
    res.json({
        application: "orders-api",
        version: APP_VERSION,
        environment: ENVIRONMENT,
        message: "Orders API is running"
    });
});

// Health endpoint
app.get("/health", async (req, res) => {
    try {
        const connection = await getDbConnection();

        await connection.query("SELECT 1");

        await connection.end();

        res.status(200).json({
            status: "HEALTHY",
            version: APP_VERSION,
            environment: ENVIRONMENT,
            database: "CONNECTED"
        });
    } catch (error) {
        res.status(500).json({
            status: "UNHEALTHY",
            version: APP_VERSION,
            environment: ENVIRONMENT,
            database: "DISCONNECTED",
            error: error.message
        });
    }
});

// Version endpoint for deployment traceability
app.get("/version", (req, res) => {
    res.json({
        application: "orders-api",
        version: APP_VERSION,
        environment: ENVIRONMENT,
        gitCommit: process.env.GIT_COMMIT || "unknown"
    });
});

// Simple orders endpoint
app.get("/orders", (req, res) => {
    res.json([
        {
            id: 1,
            customer: "Customer One",
            status: "CONFIRMED"
        },
        {
            id: 2,
            customer: "Customer Two",
            status: "SHIPPED"
        }
    ]);
});

// Start server
if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`orders-api version ${APP_VERSION} started`);
        console.log(`Environment: ${ENVIRONMENT}`);
        console.log(`Listening on port ${PORT}`);
        console.log(`Database host: ${DB_HOST}`);
    });
}

module.exports = app;