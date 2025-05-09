module.exports = {
    dbConfig: {
        host: "145.223.29.205",
        user: "listavip",
        password: "listavip",
        database: "listavip",
        waitForConnections: true, 
        connectionLimit: 10, 
        queueLimit: 0 
    },
    orderQuantityDefault: 2,
    fetchInterval: 30 * 60 * 1000, 
    queueProcessInterval: 5000,
    port: 1100,

    webhookUrl: 'https://api.rifax.net/api/check/pay2m',
    encryptionKey: "38bf01a8c4bebb7a6b898b0da3a293b3646677232f6c22983cfeabd4c0f413b8",
    
    allowedOrigins: [
        'http://localhost:1234',
        'http://localhost:3000',
        'http://192.168.15.53:1234',
        'https://listavip.conexaocode.com'
    ],
};
